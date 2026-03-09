const fs = require("node:fs/promises");
const path = require("node:path");

const DEFAULT_PROMPT =
  "You are CivicPulse, Montgomery's 24/7 city assistant. Help residents report issues, get city information, and navigate services. Always confirm ticket numbers when filing reports.";

function envTrim(name) {
  return String(process.env[name] || "").trim();
}

const TTS_VOICE_ID = envTrim("ELEVENLABS_VOICE_ID") || "21m00Tcm4TlvDq8ikWAM";
const TTS_MODEL_ID =
  envTrim("ELEVENLABS_TTS_MODEL_ID") || "eleven_multilingual_v2";
const BRIEFINGS_DIR = path.join(process.cwd(), "public", "assets", "briefings");

const AGENT_CONFIG = {
  agent_id: envTrim("ELEVENLABS_AGENT_ID"),
  prompt: DEFAULT_PROMPT,
};

function isStrictModeEnabled(value) {
  return String(value || "").toLowerCase() === "true";
}

function normalizeResidentContext(input = {}) {
  return {
    residentName: input.residentName || "Resident",
    neighborhood: input.neighborhood || "Montgomery",
  };
}

function briefingAudioUrl(date) {
  return `/assets/briefings/${date}.mp3`;
}

function briefingAudioPath(date) {
  return path.join(BRIEFINGS_DIR, `${date}.mp3`);
}

async function fileExists(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile() && stat.size > 0;
  } catch (_error) {
    return false;
  }
}

async function createSignedConversationUrl(agentId) {
  const url = `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${encodeURIComponent(
    agentId,
  )}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "xi-api-key": envTrim("ELEVENLABS_API_KEY"),
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`ElevenLabs signed URL returned ${response.status}`);
  }

  const payload = await response.json();
  return payload?.signed_url || payload?.url || null;
}

async function createConversationWithContext(agentId, residentContext = {}) {
  const response = await fetch(
    "https://api.elevenlabs.io/v1/convai/conversation",
    {
      method: "POST",
      headers: {
        "xi-api-key": envTrim("ELEVENLABS_API_KEY"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        agent_id: agentId,
        dynamic_variables: {
          resident_name: residentContext.residentName || "Resident",
          neighborhood: residentContext.neighborhood || "Montgomery",
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`ElevenLabs conversation returned ${response.status}`);
  }

  return response.json();
}

async function createConversationSession(residentContext = {}, options = {}) {
  const context = normalizeResidentContext(residentContext);
  const requireLive =
    Boolean(options.requireLive) ||
    isStrictModeEnabled(process.env.VOICE_SESSION_REQUIRE_LIVE);

  if (!envTrim("ELEVENLABS_API_KEY") || !AGENT_CONFIG.agent_id) {
    if (requireLive) {
      const error = new Error(
        "Live voice session is required, but ElevenLabs credentials are missing.",
      );
      error.code = "VOICE_LIVE_REQUIRED";
      throw error;
    }

    return {
      sessionUrl: null,
      sessionId: `local-${Date.now()}`,
      simulated: true,
      context,
      note: "ElevenLabs credentials are not configured.",
    };
  }

  try {
    const signedUrl = await createSignedConversationUrl(AGENT_CONFIG.agent_id);
    if (signedUrl) {
      return {
        sessionUrl: signedUrl,
        sessionId: `conv-${Date.now()}`,
        simulated: false,
        context,
      };
    }

    const payload = await createConversationWithContext(
      AGENT_CONFIG.agent_id,
      context,
    );

    const sessionUrl = payload?.session_url || null;
    if (!sessionUrl && requireLive) {
      const error = new Error(
        "Live voice session is required, but ElevenLabs did not return a session URL.",
      );
      error.code = "VOICE_LIVE_REQUIRED";
      throw error;
    }

    return {
      sessionUrl,
      sessionId: payload?.conversation_id || `conv-${Date.now()}`,
      simulated: false,
      context,
    };
  } catch (caughtError) {
    if (requireLive) {
      const error = new Error(
        `Live voice session is required, but setup failed: ${caughtError.message}`,
      );
      error.code = "VOICE_LIVE_REQUIRED";
      throw error;
    }

    return {
      sessionUrl: null,
      sessionId: `local-${Date.now()}`,
      simulated: true,
      context,
      note: "Fell back to demo mode because ElevenLabs session creation failed.",
    };
  }
}

async function synthesizeBriefingAudio({ date, script }) {
  const text = String(script || "").trim();
  if (!text) {
    return {
      url: briefingAudioUrl(date),
      available: false,
      simulated: true,
      provider: "none",
      note: "No script text available for audio synthesis.",
    };
  }

  if (!envTrim("ELEVENLABS_API_KEY")) {
    return {
      url: briefingAudioUrl(date),
      available: false,
      simulated: true,
      provider: "demo",
      note: "ELEVENLABS_API_KEY is not configured.",
    };
  }

  const outputPath = briefingAudioPath(date);
  if (await fileExists(outputPath)) {
    return {
      url: briefingAudioUrl(date),
      available: true,
      simulated: false,
      provider: "elevenlabs",
    };
  }

  try {
    await fs.mkdir(BRIEFINGS_DIR, { recursive: true });

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(
        TTS_VOICE_ID,
      )}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": envTrim("ELEVENLABS_API_KEY"),
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: TTS_MODEL_ID,
          voice_settings: {
            stability: 0.4,
            similarity_boost: 0.75,
          },
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`ElevenLabs TTS returned ${response.status}`);
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(outputPath, audioBuffer);

    return {
      url: briefingAudioUrl(date),
      available: true,
      simulated: false,
      provider: "elevenlabs",
    };
  } catch (error) {
    return {
      url: briefingAudioUrl(date),
      available: false,
      simulated: true,
      provider: "elevenlabs",
      note: error.message,
    };
  }
}

module.exports = {
  AGENT_CONFIG,
  createConversationSession,
  synthesizeBriefingAudio,
};
