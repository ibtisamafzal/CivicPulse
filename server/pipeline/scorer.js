const NEIGHBORHOODS = [
  {
    name: "West Montgomery",
    slug: "west-montgomery",
    center: [32.3724, -86.3308],
    boundary: [
      [32.381, -86.357],
      [32.368, -86.357],
      [32.362, -86.336],
      [32.376, -86.324],
    ],
  },
  {
    name: "Cloverdale",
    slug: "cloverdale",
    center: [32.3601, -86.2941],
    boundary: [
      [32.366, -86.306],
      [32.355, -86.306],
      [32.351, -86.291],
      [32.363, -86.286],
    ],
  },
  {
    name: "Garden District",
    slug: "garden-district",
    center: [32.3547, -86.2814],
    boundary: [
      [32.361, -86.289],
      [32.349, -86.289],
      [32.346, -86.275],
      [32.358, -86.271],
    ],
  },
  {
    name: "Oak Park",
    slug: "oak-park",
    center: [32.3778, -86.2688],
    boundary: [
      [32.385, -86.279],
      [32.373, -86.279],
      [32.37, -86.263],
      [32.382, -86.259],
    ],
  },
  {
    name: "Chisholm",
    slug: "chisholm",
    center: [32.3439, -86.3349],
    boundary: [
      [32.35, -86.348],
      [32.338, -86.348],
      [32.334, -86.327],
      [32.346, -86.322],
    ],
  },
];

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function pointInPolygon(point, polygon) {
  const [lat, lon] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const yi = polygon[i][0];
    const xi = polygon[i][1];
    const yj = polygon[j][0];
    const xj = polygon[j][1];

    const intersects =
      yi > lat !== yj > lat &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function extractPoint(record) {
  if (!record || typeof record !== "object") {
    return null;
  }

  const latKeys = ["latitude", "lat", "y", "location_latitude"];
  const lonKeys = ["longitude", "lon", "lng", "x", "location_longitude"];

  for (const latKey of latKeys) {
    for (const lonKey of lonKeys) {
      const lat = toNumber(record[latKey]);
      const lon = toNumber(record[lonKey]);
      if (lat !== null && lon !== null) {
        return [lat, lon];
      }
    }
  }

  const location = record.location || record.geolocation || record.location_1;
  if (location && typeof location === "object") {
    const lat = toNumber(location.latitude);
    const lon = toNumber(location.longitude);
    if (lat !== null && lon !== null) {
      return [lat, lon];
    }

    if (
      Array.isArray(location.coordinates) &&
      location.coordinates.length >= 2
    ) {
      const lonFromCoords = toNumber(location.coordinates[0]);
      const latFromCoords = toNumber(location.coordinates[1]);
      if (latFromCoords !== null && lonFromCoords !== null) {
        return [latFromCoords, lonFromCoords];
      }
    }
  }

  return null;
}

function normalizeText(record) {
  return Object.values(record || {})
    .filter((value) => typeof value === "string")
    .join(" ")
    .toLowerCase();
}

function isMatch(record, neighborhood) {
  const text = normalizeText(record);
  if (text.includes(neighborhood.name.toLowerCase())) {
    return true;
  }

  const point = extractPoint(record);
  if (point) {
    return pointInPolygon(point, neighborhood.boundary);
  }

  return false;
}

function countMatches(records, neighborhood) {
  if (!Array.isArray(records)) {
    return 0;
  }

  return records.filter((row) => isMatch(row, neighborhood)).length;
}

function extractStatus(record) {
  const candidates = [
    record?.status,
    record?.request_status,
    record?.ticket_status,
    record?.case_status,
    record?.work_order_status,
  ]
    .map((value) => String(value || "").toLowerCase())
    .filter(Boolean);

  if (!candidates.length) {
    return "";
  }

  return candidates[0];
}

function summarizeCivicDataForNeighborhood(neighborhood, civicData = {}) {
  const crimeCount = countMatches(civicData.crime, neighborhood);
  const permitCount = countMatches(civicData.permits, neighborhood);

  const neighborhoodTickets = Array.isArray(civicData.tickets)
    ? civicData.tickets.filter((x) => isMatch(x, neighborhood))
    : [];

  const openTickets = neighborhoodTickets.filter((x) => {
    const status = extractStatus(x);
    return (
      status.includes("open") ||
      status.includes("pending") ||
      status.includes("submitted")
    );
  }).length;

  const resolvedTickets = neighborhoodTickets.filter((x) => {
    const status = extractStatus(x);
    return (
      status.includes("resolved") ||
      status.includes("closed") ||
      status.includes("complete") ||
      status.includes("dispatched")
    );
  }).length;

  const blightCount = countMatches(civicData.blight, neighborhood);

  return {
    crimeCount,
    permitCount,
    openTickets,
    resolvedTickets,
    blightCount,
  };
}

function countAnnouncements(neighborhood, crawlData = {}) {
  const all = [
    ...(crawlData.announcements || []),
    ...(crawlData.safetyUpdates || []),
    ...(crawlData.permits || []),
  ];
  return countMatches(all, neighborhood);
}

function buildBreakdown(counts, announcementMentions) {
  const safety = clamp(100 - counts.crimeCount * 9);
  const blight = clamp(100 - counts.blightCount * 12);

  const serviceTotal = counts.openTickets + counts.resolvedTickets;
  const serviceResolvedRate =
    serviceTotal === 0 ? 0.75 : counts.resolvedTickets / serviceTotal;
  const service = clamp(Math.round(serviceResolvedRate * 100));

  const activity = clamp(40 + counts.permitCount * 13);
  const comms = clamp(35 + announcementMentions * 16);

  return {
    safety,
    blight,
    service,
    activity,
    comms,
  };
}

function weightedScore(breakdown) {
  return Math.round(
    breakdown.safety * 0.25 +
      breakdown.blight * 0.25 +
      breakdown.service * 0.2 +
      breakdown.activity * 0.2 +
      breakdown.comms * 0.1,
  );
}

function pickTrend(score, previousScore) {
  if (typeof previousScore !== "number") {
    return "stable";
  }

  if (score - previousScore >= 3) {
    return "up";
  }

  if (previousScore - score >= 3) {
    return "down";
  }

  return "stable";
}

function topIssues(counts, breakdown) {
  const issues = [];

  if (counts.openTickets >= 3 || breakdown.service < 60) {
    issues.push("311 service backlog needs dispatch support");
  }
  if (counts.blightCount >= 2 || breakdown.blight < 65) {
    issues.push("Blight filings are rising and need inspection");
  }
  if (counts.crimeCount >= 3 || breakdown.safety < 65) {
    issues.push("Public safety trend needs targeted patrols");
  }
  if (breakdown.activity < 55) {
    issues.push("Business permit momentum is below city target");
  }

  if (issues.length === 0) {
    issues.push("No major pressure points detected today");
  }

  return issues.slice(0, 3);
}

async function scoreNeighbourhood(
  neighborhood,
  civicData,
  crawlData,
  previous = null,
) {
  const counts = summarizeCivicDataForNeighborhood(neighborhood, civicData);
  const mentions = countAnnouncements(neighborhood, crawlData);
  const breakdown = buildBreakdown(counts, mentions);
  const score = weightedScore(breakdown);

  return {
    name: neighborhood.name,
    boundary: neighborhood.boundary,
    score,
    breakdown,
    trend: pickTrend(score, previous?.score),
    topIssues: topIssues(counts, breakdown),
    summary: "",
    scoredAt: new Date().toISOString(),
    partial: Boolean(civicData?.partial || crawlData?.stale),
    metrics: counts,
  };
}

async function scoreAllNeighborhoods(
  civicData,
  crawlData,
  previousScores = [],
) {
  const previousByName = new Map(previousScores.map((x) => [x.name, x]));

  const promises = NEIGHBORHOODS.map((n) =>
    scoreNeighbourhood(
      n,
      civicData,
      crawlData,
      previousByName.get(n.name) || null,
    ),
  );

  return Promise.all(promises);
}

function detectAnomalies(todayData, baselineData = {}) {
  const alerts = [];
  const detectedAt = new Date().toISOString();

  for (const neighborhood of NEIGHBORHOODS) {
    const counts = summarizeCivicDataForNeighborhood(neighborhood, todayData);
    const base = baselineData[neighborhood.name] || {
      crimeCount: Math.max(1, Math.round(counts.crimeCount * 0.8)),
      blightCount: Math.max(1, Math.round(counts.blightCount * 0.7)),
      openTickets: Math.max(1, Math.round(counts.openTickets * 0.8)),
      permitCount: Math.max(1, Math.round(counts.permitCount * 0.8)),
    };

    if (
      counts.blightCount >= Math.ceil(base.blightCount * 1.6) &&
      counts.blightCount >= 2
    ) {
      alerts.push({
        severity: "HIGH",
        title: `Blight cluster forming in ${neighborhood.name}`,
        body: `Blight filings increased to ${counts.blightCount} vs baseline ${base.blightCount}.`,
        neighbourhood: neighborhood.name,
        detectedAt,
        dataSource: "socrata",
        recommendedAction: "Dispatch code enforcement within 24 hours",
        dismissed: false,
      });
    }

    if (
      counts.openTickets >= Math.ceil(base.openTickets * 1.5) &&
      counts.openTickets >= 3
    ) {
      alerts.push({
        severity: "MEDIUM",
        title: `311 backlog spike in ${neighborhood.name}`,
        body: `${counts.openTickets} open requests need triage against baseline ${base.openTickets}.`,
        neighbourhood: neighborhood.name,
        detectedAt,
        dataSource: "socrata",
        recommendedAction: "Assign additional public works crew",
        dismissed: false,
      });
    }

    if (
      counts.permitCount >= Math.ceil(base.permitCount * 1.8) &&
      counts.permitCount >= 2
    ) {
      alerts.push({
        severity: "LOW",
        title: `Permit momentum rising in ${neighborhood.name}`,
        body: `New permit activity reached ${counts.permitCount}, above baseline ${base.permitCount}.`,
        neighbourhood: neighborhood.name,
        detectedAt,
        dataSource: "socrata",
        recommendedAction: "Coordinate small-business outreach support",
        dismissed: false,
      });
    }
  }

  return alerts.sort((a, b) => {
    const rank = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    return rank[b.severity] - rank[a.severity];
  });
}

module.exports = {
  NEIGHBORHOODS,
  scoreNeighbourhood,
  scoreAllNeighborhoods,
  detectAnomalies,
};
