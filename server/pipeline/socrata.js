const SOCRATA_BASE_URL =
  process.env.SOCRATA_BASE_URL || "https://data.montgomeryal.gov/resource";
const SOCRATA_APP_TOKEN = process.env.SOCRATA_APP_TOKEN || "";

const ARCGIS_PORTAL_BASE_URL =
  process.env.ARCGIS_PORTAL_BASE_URL || "https://opendata.montgomeryal.gov";
const ARCGIS_ORG_ID = process.env.ARCGIS_ORG_ID || "xNUwUjOJqYE54USz";
const ARCGIS_DATASETS_API = `${ARCGIS_PORTAL_BASE_URL.replace(/\/$/, "")}/api/v3/datasets`;

const ENDPOINTS = {
  crime:
    process.env.CIVIC_CRIME_ENDPOINT ||
    process.env.SOCRATA_CRIME_ENDPOINT ||
    "https://services7.arcgis.com/xNUwUjOJqYE54USz/arcgis/rest/services/Emergency_911_Calls/FeatureServer/0",
  permits:
    process.env.CIVIC_PERMITS_ENDPOINT ||
    process.env.SOCRATA_PERMITS_ENDPOINT ||
    "https://services7.arcgis.com/xNUwUjOJqYE54USz/arcgis/rest/services/All_Permit_viewlayer/FeatureServer/0",
  tickets:
    process.env.CIVIC_TICKETS_ENDPOINT ||
    process.env.SOCRATA_TICKETS_ENDPOINT ||
    "https://services7.arcgis.com/xNUwUjOJqYE54USz/arcgis/rest/services/Code_Enforcement_view/FeatureServer/0",
  blight:
    process.env.CIVIC_BLIGHT_ENDPOINT ||
    process.env.SOCRATA_BLIGHT_ENDPOINT ||
    "https://services7.arcgis.com/xNUwUjOJqYE54USz/arcgis/rest/services/Code_Enforcement/FeatureServer/0",
};

const LIMITS = {
  crime: 120,
  permits: 180,
  tickets: 240,
  blight: 180,
};

const DISCOVERY_TERMS = {
  crime: ["911", "incident", "crime", "public safety"],
  permits: ["permit", "building permit", "all permit"],
  tickets: ["311", "service request", "code enforcement"],
  blight: ["blight", "vacant", "code violations", "nuisance"],
};

function normalizeEndpoint(endpoint) {
  const raw = String(endpoint || "").trim();
  if (!raw) {
    return "";
  }

  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return raw;
  }

  if (raw.endsWith(".json")) {
    return raw;
  }

  return `${raw}.json`;
}

function isAbsoluteUrl(value) {
  return value.startsWith("http://") || value.startsWith("https://");
}

function isArcGisServiceEndpoint(value) {
  return /\/(FeatureServer|MapServer)(\/\d+)?(\/query)?(\?|$)/i.test(value);
}

function normalizeArcGisServiceEndpoint(endpoint) {
  if (!isArcGisServiceEndpoint(endpoint)) {
    return endpoint;
  }

  if (/\/(FeatureServer|MapServer)$/i.test(endpoint)) {
    return `${endpoint}/0`;
  }

  return endpoint;
}

function withSocrataLimit(urlLike, limit) {
  const separator = urlLike.includes("?") ? "&" : "?";
  if (/[$]limit=/i.test(urlLike)) {
    return urlLike;
  }
  return `${urlLike}${separator}$limit=${limit}`;
}

function buildSocrataUrl(endpoint, limit) {
  const normalized = normalizeEndpoint(endpoint);
  const url = isAbsoluteUrl(normalized)
    ? normalized
    : `${SOCRATA_BASE_URL.endsWith("/") ? SOCRATA_BASE_URL.slice(0, -1) : SOCRATA_BASE_URL}/${normalized}`;

  return withSocrataLimit(url, limit);
}

function buildArcGisUrl(endpoint, limit) {
  const normalized = normalizeArcGisServiceEndpoint(
    normalizeEndpoint(endpoint),
  );
  const base = /\/query(\?|$)/i.test(normalized)
    ? normalized
    : `${normalized.replace(/\/$/, "")}/query`;

  const url = new URL(base);
  if (!url.searchParams.has("f")) {
    url.searchParams.set("f", "json");
  }
  if (!url.searchParams.has("where")) {
    url.searchParams.set("where", "1=1");
  }
  if (!url.searchParams.has("outFields")) {
    url.searchParams.set("outFields", "*");
  }
  if (!url.searchParams.has("resultRecordCount")) {
    url.searchParams.set("resultRecordCount", String(limit));
  }
  if (!url.searchParams.has("returnGeometry")) {
    url.searchParams.set("returnGeometry", "true");
  }
  if (!url.searchParams.has("outSR")) {
    url.searchParams.set("outSR", "4326");
  }

  return url.toString();
}

function buildRequestUrl(endpoint, limit) {
  const normalized = normalizeEndpoint(endpoint);
  if (isArcGisServiceEndpoint(normalized)) {
    return {
      url: buildArcGisUrl(normalized, limit),
      mode: "arcgis",
    };
  }

  return {
    url: buildSocrataUrl(normalized, limit),
    mode: "socrata",
  };
}

function socrataHeaders() {
  const headers = {
    Accept: "application/json",
  };

  if (SOCRATA_APP_TOKEN) {
    headers["X-App-Token"] = SOCRATA_APP_TOKEN;
  }

  return headers;
}

function extractSocrataDomain() {
  try {
    return new URL(SOCRATA_BASE_URL).hostname;
  } catch (_error) {
    return "data.montgomeryal.gov";
  }
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function parseCoordPair(value) {
  if (Array.isArray(value) && value.length >= 2) {
    const lon = toNumber(value[0]);
    const lat = toNumber(value[1]);
    if (lat !== null && lon !== null) {
      return [lat, lon];
    }
  }

  if (typeof value === "string") {
    const parts = value.trim().split(/\s+/);
    if (parts.length >= 2) {
      const lon = toNumber(parts[0]);
      const lat = toNumber(parts[1]);
      if (lat !== null && lon !== null) {
        return [lat, lon];
      }
    }
  }

  return null;
}

function centroid(points) {
  if (!points.length) {
    return null;
  }

  const sum = points.reduce(
    (acc, point) => {
      acc.lat += point[0];
      acc.lon += point[1];
      return acc;
    },
    { lat: 0, lon: 0 },
  );

  return [sum.lat / points.length, sum.lon / points.length];
}

function extractArcGisPoint(geometry) {
  if (!geometry || typeof geometry !== "object") {
    return null;
  }

  if (toNumber(geometry.y) !== null && toNumber(geometry.x) !== null) {
    return [Number(geometry.y), Number(geometry.x)];
  }

  if (Array.isArray(geometry.coordinates) && geometry.coordinates.length >= 2) {
    return parseCoordPair(geometry.coordinates);
  }

  if (Array.isArray(geometry.rings)) {
    const points = [];
    for (const ring of geometry.rings) {
      if (!Array.isArray(ring)) {
        continue;
      }
      for (const pair of ring) {
        const point = parseCoordPair(pair);
        if (point) {
          points.push(point);
        }
      }
    }
    return centroid(points);
  }

  if (Array.isArray(geometry.paths)) {
    const points = [];
    for (const path of geometry.paths) {
      if (!Array.isArray(path)) {
        continue;
      }
      for (const pair of path) {
        const point = parseCoordPair(pair);
        if (point) {
          points.push(point);
        }
      }
    }
    return centroid(points);
  }

  return null;
}

function extractRecords(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.features)) {
    return payload.features.map((feature) => {
      const row = {
        ...(feature?.attributes || {}),
      };

      const point = extractArcGisPoint(feature?.geometry);
      if (point) {
        row.latitude = point[0];
        row.longitude = point[1];
      }

      return row;
    });
  }

  throw new Error("Dataset payload format is not supported");
}

async function discoverArcGisEndpoint(kind) {
  const terms = DISCOVERY_TERMS[kind] || [kind];

  for (const term of terms) {
    const discoveryUrl = `${ARCGIS_DATASETS_API}?page%5Bsize%5D=20&q=${encodeURIComponent(
      term,
    )}&filter%5BorgId%5D=${encodeURIComponent(ARCGIS_ORG_ID)}`;

    try {
      const response = await fetch(discoveryUrl, {
        headers: socrataHeaders(),
      });
      if (!response.ok) {
        continue;
      }

      const payload = await response.json();
      const data = Array.isArray(payload?.data) ? payload.data : [];

      const candidate = data.find((item) => {
        const url = String(item?.attributes?.url || "").trim();
        if (!url) {
          return false;
        }
        if (/WorkspaceServer/i.test(url)) {
          return false;
        }
        return isArcGisServiceEndpoint(url);
      });

      const discoveredUrl = String(candidate?.attributes?.url || "").trim();
      if (discoveredUrl) {
        return normalizeArcGisServiceEndpoint(discoveredUrl);
      }
    } catch (_error) {
      continue;
    }
  }

  return null;
}

async function discoverSocrataEndpoint(kind) {
  const domain = extractSocrataDomain();
  const terms = DISCOVERY_TERMS[kind] || [kind];

  for (const term of terms) {
    const catalogUrl = `https://api.us.socrata.com/api/catalog/v1?domains=${encodeURIComponent(
      domain,
    )}&search_context=${encodeURIComponent(domain)}&q=${encodeURIComponent(
      term,
    )}&limit=10`;

    try {
      const response = await fetch(catalogUrl, {
        headers: socrataHeaders(),
      });

      if (!response.ok) {
        continue;
      }

      const payload = await response.json();
      const results = Array.isArray(payload?.results) ? payload.results : [];

      const dataset = results.find((result) => {
        const id = String(result?.resource?.id || "");
        const type = String(result?.resource?.type || "").toLowerCase();
        return (
          Boolean(id) && (type === "dataset" || type === "filtered dataset")
        );
      });

      const datasetId = dataset?.resource?.id;
      if (datasetId) {
        return `${datasetId}.json`;
      }
    } catch (_error) {
      continue;
    }
  }

  return null;
}

async function discoverDatasetEndpoint(kind) {
  const arcGisEndpoint = await discoverArcGisEndpoint(kind);
  if (arcGisEndpoint) {
    return arcGisEndpoint;
  }

  return discoverSocrataEndpoint(kind);
}

function getFallbackData() {
  return {
    crime: [
      {
        id: "c1",
        neighborhood: "West Montgomery",
        type: "property",
        occurred_at: "2026-03-08",
      },
      {
        id: "c2",
        neighborhood: "Chisholm",
        type: "property",
        occurred_at: "2026-03-08",
      },
      {
        id: "c3",
        neighborhood: "Garden District",
        type: "theft",
        occurred_at: "2026-03-08",
      },
    ],
    permits: [
      {
        permit_id: "p1",
        neighborhood: "Garden District",
        type: "food",
        filed_at: "2026-03-07",
      },
      {
        permit_id: "p2",
        neighborhood: "Cloverdale",
        type: "retail",
        filed_at: "2026-03-06",
      },
      {
        permit_id: "p3",
        neighborhood: "Oak Park",
        type: "business",
        filed_at: "2026-03-06",
      },
    ],
    tickets: [
      {
        ticket_id: "t1",
        neighborhood: "West Montgomery",
        status: "open",
        created_at: "2026-03-08",
      },
      {
        ticket_id: "t2",
        neighborhood: "West Montgomery",
        status: "resolved",
        created_at: "2026-03-07",
      },
      {
        ticket_id: "t3",
        neighborhood: "Chisholm",
        status: "open",
        created_at: "2026-03-08",
      },
      {
        ticket_id: "t4",
        neighborhood: "Oak Park",
        status: "resolved",
        created_at: "2026-03-07",
      },
    ],
    blight: [
      {
        id: "b1",
        neighborhood: "West Montgomery",
        status: "open",
        filed_at: "2026-03-08",
      },
      {
        id: "b2",
        neighborhood: "Chisholm",
        status: "open",
        filed_at: "2026-03-08",
      },
      {
        id: "b3",
        neighborhood: "Chisholm",
        status: "open",
        filed_at: "2026-03-07",
      },
    ],
  };
}

async function safeFetchDataset(endpoint, limit, fallback) {
  try {
    const request = buildRequestUrl(endpoint, limit);
    const response = await fetch(request.url, {
      headers: socrataHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Data source returned ${response.status}`);
    }

    const payload = await response.json();
    if (payload?.error?.message) {
      throw new Error(String(payload.error.message));
    }

    const data = extractRecords(payload);

    return {
      data,
      stale: false,
      error: null,
      endpointUsed: endpoint,
      requestUrl: request.url,
      mode: request.mode,
    };
  } catch (error) {
    return {
      data: fallback,
      stale: true,
      error: error.message,
      endpointUsed: endpoint,
      requestUrl: null,
      mode: "fallback",
    };
  }
}

async function fetchDatasetWithDiscovery(
  kind,
  configuredEndpoint,
  limit,
  fallback,
) {
  const primary = await safeFetchDataset(configuredEndpoint, limit, fallback);
  if (!primary.stale) {
    return primary;
  }

  const discoveredEndpoint = await discoverDatasetEndpoint(kind);
  if (!discoveredEndpoint) {
    return primary;
  }

  const discovered = await safeFetchDataset(
    discoveredEndpoint,
    limit,
    fallback,
  );
  if (!discovered.stale) {
    return {
      ...discovered,
      discoveredEndpoint,
      fallbackReason: primary.error,
    };
  }

  return {
    ...primary,
    discoveredEndpoint,
  };
}

async function fetchCivicData() {
  const fallback = getFallbackData();

  const [crimeResult, permitsResult, ticketsResult, blightResult] =
    await Promise.all([
      fetchDatasetWithDiscovery(
        "crime",
        ENDPOINTS.crime,
        LIMITS.crime,
        fallback.crime,
      ),
      fetchDatasetWithDiscovery(
        "permits",
        ENDPOINTS.permits,
        LIMITS.permits,
        fallback.permits,
      ),
      fetchDatasetWithDiscovery(
        "tickets",
        ENDPOINTS.tickets,
        LIMITS.tickets,
        fallback.tickets,
      ),
      fetchDatasetWithDiscovery(
        "blight",
        ENDPOINTS.blight,
        LIMITS.blight,
        fallback.blight,
      ),
    ]);

  return {
    crime: crimeResult.data,
    permits: permitsResult.data,
    tickets: ticketsResult.data,
    blight: blightResult.data,
    partial: [crimeResult, permitsResult, ticketsResult, blightResult].some(
      (x) => x.stale,
    ),
    errors: [crimeResult, permitsResult, ticketsResult, blightResult]
      .map((x) => x.error)
      .filter(Boolean),
    sourceMeta: {
      crimeEndpoint: crimeResult.discoveredEndpoint || crimeResult.endpointUsed,
      permitsEndpoint:
        permitsResult.discoveredEndpoint || permitsResult.endpointUsed,
      ticketsEndpoint:
        ticketsResult.discoveredEndpoint || ticketsResult.endpointUsed,
      blightEndpoint:
        blightResult.discoveredEndpoint || blightResult.endpointUsed,
      crimeMode: crimeResult.mode,
      permitsMode: permitsResult.mode,
      ticketsMode: ticketsResult.mode,
      blightMode: blightResult.mode,
    },
    fetchedAt: new Date().toISOString(),
  };
}

module.exports = {
  fetchCivicData,
};
