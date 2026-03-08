const fs = require("node:fs/promises");
const path = require("node:path");

let Storage;
try {
  ({ Storage } = require("@google-cloud/storage"));
} catch (_error) {
  Storage = null;
}

const LOCAL_DIR = path.join(process.cwd(), ".cache");

function localPathForDate(date) {
  return path.join(LOCAL_DIR, `scores-${date}.json`);
}

async function writeLocal(date, payload) {
  await fs.mkdir(LOCAL_DIR, { recursive: true });
  await fs.writeFile(
    localPathForDate(date),
    JSON.stringify(payload, null, 2),
    "utf8",
  );
}

async function readLocal(date) {
  try {
    const raw = await fs.readFile(localPathForDate(date), "utf8");
    return JSON.parse(raw);
  } catch (_error) {
    return null;
  }
}

function getGcsClient() {
  if (!Storage || !process.env.GCS_BUCKET_NAME) {
    return null;
  }

  return {
    storage: new Storage({
      projectId: process.env.GCS_PROJECT_ID || undefined,
    }),
    bucket: process.env.GCS_BUCKET_NAME,
  };
}

async function saveDailySnapshot(date, payload) {
  const gcs = getGcsClient();
  if (!gcs) {
    await writeLocal(date, payload);
    return { stored: "local", key: localPathForDate(date) };
  }

  try {
    const file = gcs.storage.bucket(gcs.bucket).file(`daily/${date}.json`);
    await file.save(JSON.stringify(payload), {
      contentType: "application/json",
    });
    return { stored: "gcs", key: `daily/${date}.json` };
  } catch (_error) {
    await writeLocal(date, payload);
    return { stored: "local-fallback", key: localPathForDate(date) };
  }
}

async function loadDailySnapshot(date) {
  const gcs = getGcsClient();
  if (!gcs) {
    return readLocal(date);
  }

  try {
    const file = gcs.storage.bucket(gcs.bucket).file(`daily/${date}.json`);
    const [content] = await file.download();
    return JSON.parse(content.toString("utf8"));
  } catch (_error) {
    return readLocal(date);
  }
}

module.exports = {
  saveDailySnapshot,
  loadDailySnapshot,
};
