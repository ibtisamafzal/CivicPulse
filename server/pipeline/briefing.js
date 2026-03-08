const DEFAULT_MODEL = process.env.PERPLEXITY_MODEL || "sonar";
const { synthesizeBriefingAudio } = require("../voice");

function countNeighborhoodTrend(scores = [], predicate) {
  return scores.filter(predicate).length;
}

function pickTopNeighborhood(scores = []) {
  if (!scores.length) {
    return null;
  }
  return scores.slice().sort((a, b) => b.score - a.score)[0];
}

function pickLowestNeighborhood(scores = []) {
  if (!scores.length) {
    return null;
  }
  return scores.slice().sort((a, b) => a.score - b.score)[0];
}

function buildFallbackHeadlines({ crawlData = {}, scores = [], alerts = [] }) {
  const top = pickTopNeighborhood(scores);
  const lowest = pickLowestNeighborhood(scores);
  const firstAnnouncement = (crawlData.announcements || [])[0];
  const firstEvent = (crawlData.events || [])[0];

  const headlineOne = firstAnnouncement
    ? {
        icon: "road",
        category: "Traffic",
        headline: firstAnnouncement.title,
        detail: "City announcement detected in today's crawl.",
      }
    : {
        icon: "city",
        category: "City",
        headline: "Daily city updates are available",
        detail: "No fresh announcement headline was captured this run.",
      };

  const headlineTwo = top
    ? {
        icon: "shield",
        category: "Neighborhood",
        headline: `${top.name} leads today's health score at ${top.score}/100`,
        detail: `Trend: ${top.trend}. Service ${top.breakdown?.service ?? "n/a"}, safety ${top.breakdown?.safety ?? "n/a"}.`,
      }
    : {
        icon: "chart",
        category: "Neighborhood",
        headline: "Neighborhood score update pending",
        detail:
          "Score cards will appear after the next completed pipeline run.",
      };

  const alertCount = alerts.length;
  const headlineThree = lowest
    ? {
        icon: "alert",
        category: "Watch",
        headline: `${lowest.name} needs attention at ${lowest.score}/100`,
        detail:
          alertCount > 0
            ? `${alertCount} active anomaly alert(s) are being tracked citywide.`
            : "No anomaly alerts were generated in this snapshot.",
      }
    : firstEvent
      ? {
          icon: "calendar",
          category: "Events",
          headline: firstEvent.title,
          detail: `${firstEvent.location || "City location"}${
            firstEvent.date ? ` on ${firstEvent.date}` : ""
          }`,
        }
      : {
          icon: "calendar",
          category: "Events",
          headline: "Community events stream is ready",
          detail: "Event cards will expand as feed coverage grows.",
        };

  return [headlineOne, headlineTwo, headlineThree];
}

function buildFallbackScript({
  date,
  headlines = [],
  scores = [],
  alerts = [],
}) {
  const weakCount = countNeighborhoodTrend(scores, (x) => x.score < 50);
  const strongCount = countNeighborhoodTrend(scores, (x) => x.score >= 70);

  const headlineLines = headlines
    .map((h) => `${h.category}: ${h.headline}. ${h.detail}`)
    .join(" ");

  return [
    `Good morning, Montgomery. It is ${date}. Here is your CivicPulse daily briefing.`,
    headlineLines,
    `Citywide snapshot shows ${strongCount} neighborhoods in the strong band and ${weakCount} in the watch or critical band.`,
    alerts.length
      ? `There are ${alerts.length} anomaly alerts requiring monitoring by city staff.`
      : "No anomaly spikes were detected in this cycle.",
    "That is your Montgomery Morning update. Have a great day.",
  ].join(" ");
}

function durationFromScript(script) {
  const words = String(script || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(35, Math.min(90, Math.round((words / 145) * 60)));
}

function iconToEmoji(icon) {
  const map = {
    road: "🚧",
    city: "🏛️",
    shield: "🛡️",
    chart: "📊",
    alert: "🚨",
    calendar: "📅",
  };
  return map[icon] || "📰";
}

function normalizeHeadlineCards(headlines = []) {
  return headlines.slice(0, 3).map((item) => ({
    ...item,
    icon: iconToEmoji(item.icon),
    category: item.category || "Update",
    headline: item.headline || "Daily city update",
    detail: item.detail || "No additional details were provided.",
  }));
}

async function queryPerplexity(messages) {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    return null;
  }

  const modelCandidates = Array.from(
    new Set([DEFAULT_MODEL, "sonar", "sonar-pro"]),
  );

  for (const model of modelCandidates) {
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages,
      }),
    });

    if (response.ok) {
      return response.json();
    }

    const errorText = await response.text();
    const invalidModel =
      response.status === 400 &&
      /invalid model|permitted models/i.test(errorText);

    if (!invalidModel) {
      throw new Error(`Perplexity returned ${response.status}: ${errorText}`);
    }
  }

  throw new Error("Perplexity model is invalid. Set PERPLEXITY_MODEL in .env.");
}

function parsePossibleJson(rawContent) {
  const raw = String(rawContent || "").trim();
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (_error) {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      return null;
    }
    try {
      return JSON.parse(match[0]);
    } catch (_error2) {
      return null;
    }
  }
}

async function buildMorningBriefing({
  date,
  crawlData = {},
  civicData = {},
  scores = [],
  alerts = [],
}) {
  const fallbackHeadlines = buildFallbackHeadlines({
    crawlData,
    scores,
    alerts,
  });
  const fallbackScript = buildFallbackScript({
    date,
    headlines: fallbackHeadlines,
    scores,
    alerts,
  });

  let script = fallbackScript;
  let headlines = fallbackHeadlines;
  let citations = [];
  let source = "fallback";

  const prompt = [
    {
      role: "system",
      content:
        "You generate a concise 45-70 second municipal audio briefing for Montgomery, Alabama. Return strict JSON only.",
    },
    {
      role: "user",
      content: [
        `Date: ${date}`,
        "Create JSON with keys script and headlines.",
        "headlines must be an array of exactly 3 cards.",
        "Each headline card keys: icon (road|city|shield|chart|alert|calendar), category, headline, detail.",
        "Script requirements: start with 'Good morning, Montgomery.' and end with 'Have a great day.'",
        `Context: ${JSON.stringify({
          crawlData,
          civicSummary: {
            crimeRows: Array.isArray(civicData.crime)
              ? civicData.crime.length
              : 0,
            permitRows: Array.isArray(civicData.permits)
              ? civicData.permits.length
              : 0,
            ticketRows: Array.isArray(civicData.tickets)
              ? civicData.tickets.length
              : 0,
            blightRows: Array.isArray(civicData.blight)
              ? civicData.blight.length
              : 0,
          },
          scores,
          alerts,
        })}`,
      ].join("\n"),
    },
  ];

  try {
    const payload = await queryPerplexity(prompt);
    if (payload) {
      const content = payload?.choices?.[0]?.message?.content || "";
      const parsed = parsePossibleJson(content);
      if (parsed) {
        script = parsed.script || fallbackScript;
        headlines =
          Array.isArray(parsed.headlines) && parsed.headlines.length
            ? parsed.headlines
            : fallbackHeadlines;
        citations = payload?.citations || [];
        source = "perplexity";
      }
    }
  } catch (_error) {
    source = "fallback";
  }

  const normalizedCards = normalizeHeadlineCards(headlines);
  const durationSeconds = durationFromScript(script);
  const audio = await synthesizeBriefingAudio({ date, script });

  return {
    date,
    generatedAt: new Date().toISOString(),
    source,
    title: `Montgomery Morning - ${date}`,
    durationSeconds,
    script,
    headlines: normalizedCards,
    citations,
    audio,
  };
}

module.exports = {
  buildMorningBriefing,
};
