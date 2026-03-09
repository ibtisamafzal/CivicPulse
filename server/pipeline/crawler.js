let FirecrawlApp;
try {
  ({ FirecrawlApp } = require("@mendable/firecrawl-js"));
} catch (_error) {
  FirecrawlApp = null;
}

const CITY_BASE = "https://www.montgomeryal.gov";

function getMockCrawlData() {
  const scrapedAt = new Date().toISOString();
  return {
    announcements: [
      {
        title: "Road resurfacing starts on Atlanta Highway",
        text: "Road crews begin resurfacing in Garden District corridor with lane closures Thursday and Friday.",
        url: `${CITY_BASE}/news`,
        scrapedAt,
      },
      {
        title: "Streetlight repairs accelerated in West Montgomery",
        text: "Public works issued a repair blitz to clear service backlog in West Montgomery.",
        url: `${CITY_BASE}/government/announcements`,
        scrapedAt,
      },
    ],
    safetyUpdates: [
      {
        title: "Community patrol activity update",
        text: "Police reported lower property crime near Cloverdale and Oak Park this week.",
        url: `${CITY_BASE}/residents/public-safety`,
        scrapedAt,
      },
    ],
    permits: [
      {
        businessName: "Riverfront Tacos",
        type: "Restaurant",
        address: "124 Cloverdale Rd",
        filedAt: scrapedAt,
      },
      {
        businessName: "Chisholm Auto Care",
        type: "Auto Service",
        address: "88 Fairview Ave",
        filedAt: scrapedAt,
      },
    ],
    events: [
      {
        title: "Small Business Permit Workshop",
        date: "2026-03-12",
        location: "City Hall",
      },
    ],
    stale: true,
    source: "mock",
  };
}

function extractText(scrapeResult) {
  if (!scrapeResult) {
    return "";
  }

  const data = scrapeResult.data || scrapeResult;
  if (typeof data.markdown === "string") {
    return data.markdown.slice(0, 1200);
  }

  if (typeof data.content === "string") {
    return data.content.slice(0, 1200);
  }

  return "";
}

async function scrapeUrl(app, url) {
  const result = await app.scrapeUrl(url, {
    formats: ["markdown"],
  });

  const data = result.data || result;
  const title = data?.metadata?.title || data?.title || "City update";
  return {
    title,
    text: extractText(result),
    url,
    scrapedAt: new Date().toISOString(),
  };
}

async function crawlCity() {
  const apiKey = String(process.env.FIRECRAWL_API_KEY || "").trim();
  if (!apiKey) {
    return getMockCrawlData();
  }

  try {
    let FirecrawlCtor = FirecrawlApp;

    if (!FirecrawlCtor) {
      const module = await import("@mendable/firecrawl-js");
      FirecrawlCtor = module?.FirecrawlApp || module?.default || null;
    }

    if (!FirecrawlCtor) {
      return getMockCrawlData();
    }

    const app = new FirecrawlCtor({ apiKey });

    const [news, safety, permits, announcements] = await Promise.all([
      scrapeUrl(app, `${CITY_BASE}/news`),
      scrapeUrl(app, `${CITY_BASE}/residents/public-safety`),
      scrapeUrl(app, `${CITY_BASE}/business/permits`),
      scrapeUrl(app, `${CITY_BASE}/government/announcements`),
    ]);

    return {
      announcements: [news, announcements],
      safetyUpdates: [safety],
      permits: [
        {
          businessName: permits.title,
          type: "Permit activity",
          address: "Montgomery, AL",
          filedAt: permits.scrapedAt,
        },
      ],
      events: [],
      stale: false,
      source: "firecrawl",
    };
  } catch (_error) {
    const fallback = getMockCrawlData();
    fallback.stale = true;
    fallback.source = "fallback";
    return fallback;
  }
}

module.exports = {
  crawlCity,
};
