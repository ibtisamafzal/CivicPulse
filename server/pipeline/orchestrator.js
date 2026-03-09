const { crawlCity } = require("./crawler");
const { fetchCivicData } = require("./socrata");
const { scoreAllNeighborhoods, detectAnomalies } = require("./scorer");
const { enrichScore } = require("./researcher");
const { buildMorningBriefing } = require("./briefing");
const { saveDailySnapshot, loadDailySnapshot } = require("../storage");
const { setSnapshot, getLatestSnapshot } = require("../cache");

const PIPELINE_TIMEZONE = process.env.CIVICPULSE_TZ || "America/Chicago";
const pipelineDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: PIPELINE_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function isoDate(date = new Date()) {
  const parts = pipelineDateFormatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

function buildBaselineFromPrevious(previousSnapshot) {
  const baseline = {};
  const previousScores = previousSnapshot?.scores || [];

  for (const item of previousScores) {
    baseline[item.name] = {
      crimeCount: item?.metrics?.crimeCount || 1,
      blightCount: item?.metrics?.blightCount || 1,
      openTickets: item?.metrics?.openTickets || 1,
      permitCount: item?.metrics?.permitCount || 1,
    };
  }

  return baseline;
}

async function hydrateFromStorageIfMissing(date) {
  const existing = getLatestSnapshot();
  if (existing) {
    return existing;
  }

  const fromStorage = await loadDailySnapshot(date);
  if (!fromStorage) {
    return null;
  }

  setSnapshot(date, fromStorage);
  return { date, snapshot: fromStorage };
}

async function runPipeline({ trigger = "manual" } = {}) {
  const date = isoDate();
  const previous =
    getLatestSnapshot() || (await hydrateFromStorageIfMissing(date));

  const [crawlData, civicData] = await Promise.all([
    crawlCity(),
    fetchCivicData(),
  ]);

  const previousScores = previous?.snapshot?.scores || [];
  const scores = await scoreAllNeighborhoods(
    civicData,
    crawlData,
    previousScores,
  );

  const enrichedScores = await Promise.all(
    scores.map(async (scoreItem) => {
      const enrichment = await enrichScore(scoreItem.name, scoreItem);
      return {
        ...scoreItem,
        summary: enrichment.summary,
        keyInsight: enrichment.keyInsight,
        recommendation: enrichment.recommendation,
      };
    }),
  );

  const baseline = buildBaselineFromPrevious(previous?.snapshot);
  const alerts = detectAnomalies(civicData, baseline);
  const briefing = await buildMorningBriefing({
    date,
    crawlData,
    civicData,
    scores: enrichedScores,
    alerts,
  });

  const snapshot = {
    date,
    generatedAt: new Date().toISOString(),
    trigger,
    scores: enrichedScores,
    alerts,
    briefing,
    telemetry: {
      partial: Boolean(civicData.partial || crawlData.stale),
      civicErrors: civicData.errors || [],
      source: {
        civicData: civicData.partial ? "fallback-partial" : "live",
        crawlData: crawlData.source || "live",
      },
      socrata: civicData.sourceMeta || {},
    },
  };

  setSnapshot(date, snapshot);
  await saveDailySnapshot(date, snapshot);

  return snapshot;
}

module.exports = {
  runPipeline,
};
