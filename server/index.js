require("dotenv").config();

const path = require("node:path");
const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");

const { runPipeline } = require("./pipeline/orchestrator");
const { answerQuery } = require("./pipeline/researcher");
const { getLatestSnapshot, pushTicket } = require("./cache");
const { startScheduler } = require("./scheduler");
const { createConversationSession } = require("./voice");

const app = express();
const port = Number(process.env.PORT || 8080);

function readBoolEnv(name, fallback = false) {
  const raw = String(process.env[name] || "")
    .trim()
    .toLowerCase();
  if (!raw) return fallback;
  return raw === "1" || raw === "true" || raw === "yes";
}

function buildContactTransporter() {
  const host = String(process.env.CONTACT_SMTP_HOST || "").trim();
  const port = Number(process.env.CONTACT_SMTP_PORT || 587);
  const secure = readBoolEnv("CONTACT_SMTP_SECURE", port === 465);
  const user = String(process.env.CONTACT_SMTP_USER || "").trim();
  const pass = String(process.env.CONTACT_SMTP_PASS || "").trim();

  if (!host || !port || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(process.cwd(), "public")));

function requirePipelineSecret(req, res, next) {
  const expected = String(process.env.PIPELINE_SECRET || "").trim();
  if (!expected) {
    return next();
  }

  const provided = req.headers["x-pipeline-secret"] || req.query.secret;
  if (provided !== expected) {
    return res.status(401).json({ error: "Unauthorized pipeline trigger" });
  }

  return next();
}

async function ensureSnapshot() {
  const current = getLatestSnapshot();
  if (current) {
    return current.snapshot;
  }

  return runPipeline({ trigger: "startup" });
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "civicpulse-montgomery" });
});

app.post("/api/pipeline/run", requirePipelineSecret, async (_req, res) => {
  try {
    const snapshot = await runPipeline({ trigger: "manual-api" });
    res.json({
      ok: true,
      generatedAt: snapshot.generatedAt,
      date: snapshot.date,
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get("/api/scores", async (_req, res) => {
  try {
    const snapshot = await ensureSnapshot();
    res.json({
      date: snapshot.date,
      generatedAt: snapshot.generatedAt,
      scores: snapshot.scores,
      briefing: snapshot.briefing || null,
      telemetry: snapshot.telemetry,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/alerts", async (_req, res) => {
  try {
    const snapshot = await ensureSnapshot();
    res.json({
      date: snapshot.date,
      alerts: snapshot.alerts,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/briefing", async (_req, res) => {
  try {
    const snapshot = await ensureSnapshot();
    const briefing = snapshot.briefing || null;
    if (!briefing) {
      return res.status(404).json({ error: "Briefing is not available yet." });
    }

    return res.json({
      date: snapshot.date,
      generatedAt: briefing.generatedAt || snapshot.generatedAt,
      briefing,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.get("/api/query", async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) {
    return res.status(400).json({ error: "Query parameter q is required." });
  }

  try {
    const snapshot = await ensureSnapshot();
    const response = await answerQuery(q, {
      date: snapshot.date,
      scores: snapshot.scores,
      alerts: snapshot.alerts,
    });

    return res.json(response);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post("/api/ticket", (req, res) => {
  const { type, address, description, residentName } = req.body || {};
  if (!type || !address || !description || !residentName) {
    return res.status(400).json({
      error: "type, address, description, and residentName are required",
    });
  }

  const lower = String(description).toLowerCase();
  const priority =
    lower.includes("danger") ||
    lower.includes("outage") ||
    lower.includes("unsafe")
      ? 1
      : 2;

  const ticketId = `#${Math.floor(1000 + Math.random() * 9000)}`;
  const ticket = {
    ticketId,
    type,
    address,
    description,
    residentName,
    priority,
    status: "open",
    createdAt: new Date().toISOString(),
    estimatedResolution: priority === 1 ? "8-12 hours" : "18-36 hours",
    linkedTickets: [],
  };

  pushTicket(ticket);
  return res.status(201).json(ticket);
});

app.post("/api/voice/session", async (req, res) => {
  const body = req.body || {};
  const requireLive =
    body.requireLive === true ||
    body.mode === "live-only" ||
    String(process.env.VOICE_SESSION_REQUIRE_LIVE || "").toLowerCase() ===
      "true";

  const residentContext = {
    residentName: body.residentName,
    neighborhood: body.neighborhood,
  };

  try {
    const session = await createConversationSession(residentContext, {
      requireLive,
    });

    if (requireLive && session.simulated) {
      return res.status(503).json({
        error:
          "Live voice session is unavailable right now. Demo fallback is disabled.",
      });
    }

    return res.json(session);
  } catch (error) {
    if (error.code === "VOICE_LIVE_REQUIRED") {
      return res.status(503).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message });
  }
});

app.post("/api/contact", async (req, res) => {
  const name = String(req.body?.name || "").trim();
  const email = String(req.body?.email || "").trim();
  const subjectRaw = String(req.body?.subject || "general").trim();
  const message = String(req.body?.message || "").trim();

  if (!name || !email || !message) {
    return res
      .status(400)
      .json({ error: "name, email, and message are required" });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: "Invalid email address" });
  }

  const recipient = String(process.env.CONTACT_TO_EMAIL || "").trim();
  const fromAddress = String(process.env.CONTACT_FROM_EMAIL || "").trim();
  const transporter = buildContactTransporter();
  if (!recipient || !fromAddress || !transporter) {
    return res.status(503).json({
      error: "Contact email service is not configured",
    });
  }

  const safeSubject = subjectRaw.replace(/[\r\n]+/g, " ").slice(0, 120);
  const safeName = name.replace(/[\r\n]+/g, " ").slice(0, 120);

  const text = [
    "CivicPulse contact form submission",
    "",
    `Name: ${safeName}`,
    `Email: ${email}`,
    `Subject: ${safeSubject || "general"}`,
    "",
    "Message:",
    message,
  ].join("\n");

  try {
    await transporter.sendMail({
      from: fromAddress,
      to: recipient,
      replyTo: email,
      subject: `[CivicPulse Contact] ${safeSubject || "General Inquiry"}`,
      text,
    });

    return res.json({ ok: true });
  } catch (error) {
    console.error("[contact] email send failed:", error.message);
    return res.status(502).json({ error: "Unable to send message right now" });
  }
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "index.html"));
});

app.listen(port, async () => {
  const schedulerTimezone =
    process.env.CIVICPULSE_TZ || process.env.TZ || "America/Chicago";

  console.log(`[civicpulse] server listening on http://localhost:${port}`);

  try {
    await runPipeline({ trigger: "startup" });
    console.log("[civicpulse] initial pipeline snapshot generated");
  } catch (error) {
    console.error("[civicpulse] startup pipeline failed:", error.message);
  }

  startScheduler(runPipeline);
  console.log(`[civicpulse] scheduler active at 02:00 ${schedulerTimezone}`);
});
