const DEFAULT_MODEL = String(process.env.PERPLEXITY_MODEL || "sonar").trim();

function parsePossibleJson(rawContent) {
  const raw = String(rawContent || "").trim();
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (_error) {
    const fencedMatch = raw.match(/```json\s*([\s\S]*?)```/i);
    if (fencedMatch && fencedMatch[1]) {
      try {
        return JSON.parse(fencedMatch[1]);
      } catch (_error2) {
        // continue to generic brace match
      }
    }

    const braceMatch = raw.match(/\{[\s\S]*\}/);
    if (!braceMatch) {
      return null;
    }

    try {
      return JSON.parse(braceMatch[0]);
    } catch (_error3) {
      return null;
    }
  }
}

function collectCitations(payload) {
  if (Array.isArray(payload?.citations)) {
    return payload.citations;
  }

  const fromChoices = payload?.choices?.[0]?.message?.citations;
  if (Array.isArray(fromChoices)) {
    return fromChoices;
  }

  return [];
}

function fallbackEnrichment(neighborhood, scoreData) {
  const issueLine = scoreData.topIssues.join("; ");
  const band =
    scoreData.score >= 70
      ? "healthy"
      : scoreData.score >= 50
        ? "watch"
        : "critical";

  return {
    summary: `${neighborhood} is currently in the ${band} band with score ${scoreData.score}/100.`,
    keyInsight: issueLine,
    recommendation:
      scoreData.score < 50
        ? "Prioritize 311 dispatch and blight enforcement this week."
        : "Maintain service response pace and monitor permit momentum.",
  };
}

async function queryPerplexity(messages) {
  const apiKey = String(process.env.PERPLEXITY_API_KEY || "").trim();
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
        temperature: 0.1,
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

async function enrichScore(neighborhood, scoreData) {
  const prompt = [
    {
      role: "system",
      content:
        "You are a municipal equity analyst. Keep language plain and practical for city staff.",
    },
    {
      role: "user",
      content: `Neighborhood: ${neighborhood}\nScore data: ${JSON.stringify(
        scoreData,
      )}\nReturn strict JSON with keys summary, keyInsight, recommendation.`,
    },
  ];

  try {
    const payload = await queryPerplexity(prompt);
    if (!payload) {
      return fallbackEnrichment(neighborhood, scoreData);
    }

    const content = payload?.choices?.[0]?.message?.content || "";
    const parsed = parsePossibleJson(content);
    if (!parsed) {
      return fallbackEnrichment(neighborhood, scoreData);
    }

    return {
      summary:
        parsed.summary || fallbackEnrichment(neighborhood, scoreData).summary,
      keyInsight:
        parsed.keyInsight ||
        fallbackEnrichment(neighborhood, scoreData).keyInsight,
      recommendation:
        parsed.recommendation ||
        fallbackEnrichment(neighborhood, scoreData).recommendation,
    };
  } catch (_error) {
    return fallbackEnrichment(neighborhood, scoreData);
  }
}

async function answerQuery(question, context = {}) {
  const prompt = [
    {
      role: "system",
      content:
        "You are CivicPulse, Montgomery's city intelligence assistant. Give concise, practical answers and mention uncertainty when needed.",
    },
    {
      role: "user",
      content: `Question: ${question}\nContext: ${JSON.stringify(context)}`,
    },
  ];

  try {
    const payload = await queryPerplexity(prompt);
    if (!payload) {
      return {
        answer:
          "Live research is not configured yet, but CivicPulse can still show neighborhood scores, alert trends, and help file a service ticket.",
        sources: ["local-fallback"],
        confidence: "medium",
      };
    }

    const sources = collectCitations(payload);

    return {
      answer: payload?.choices?.[0]?.message?.content || "No answer available.",
      sources,
      confidence: sources.length >= 2 ? "high" : "medium",
    };
  } catch (_error) {
    return {
      answer:
        "I could not reach live research right now. Please retry in a moment, or use the score and alert panels for current neighborhood signals.",
      sources: [],
      confidence: "low",
    };
  }
}

module.exports = {
  enrichScore,
  answerQuery,
};
