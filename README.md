# CivicPulse Montgomery

CivicPulse Montgomery is an AI-powered civic intelligence platform that turns public city signals into neighborhood-level insights, alerts, and actions.

Built for hackathon judging, this project is optimized for:

- Fast understanding of the problem and solution
- Easy local run in under 5 minutes
- Clear, demo-ready feature walkthroughs

## 1. Hackathon Summary

### Problem

Residents and local leaders often have civic data spread across many portals, making it hard to detect neighborhood decline or prioritize action quickly.

### Solution

CivicPulse combines city data + AI analysis into one daily intelligence experience:

- Composite neighborhood health scores
- Geographic equity map
- Anomaly-based proactive alerts
- Morning briefing (text + audio)
- Ask AI and voice-first 311 assistant

### Why it matters

It helps city teams and communities move from reactive reporting to proactive intervention.

## 2. Core Features (With Demo Examples)

### Feature 1: Equity Map

- What it does: Shows neighborhood polygons color-coded by live health score.
- UI demo: Open `/features/map` and click each neighborhood polygon.
- Expected result: Popups show neighborhood score and trend (`up`, `down`, or `stable`).
- Data source: `GET /api/scores`

### Feature 2: Neighborhood Health Scores

- What it does: Computes weighted score using Safety, Blight, Service, Activity, and Communications.
- UI demo: Open `/features/scores`.
- Expected result: Score cards with breakdown, top issues, and trend per neighborhood.
- Data source: `GET /api/scores`

### Feature 3: Signal Snapshot Chart

- What it does: Visual comparison of neighborhood scores in chart form.
- UI demo: Open `/features/chart`.
- Expected result: Side-by-side score bars for rapid scan of strongest/weakest areas.
- Data source: `GET /api/scores`

### Feature 4: Morning Briefing (AI + Audio)

- What it does: Generates a daily city briefing script and optional MP3 narration.
- UI demo: Open `/features/briefing` and press play.
- Expected result: Headline cards + narration timeline for the current date.
- Data source: `GET /api/briefing`

### Feature 5: Proactive Alerts

- What it does: Detects anomalies vs baseline (for example blight spikes, 311 backlog surges).
- UI demo: Open `/features/alerts`.
- Expected result: Severity-ranked alert feed (`HIGH`, `MEDIUM`, `LOW`) with recommended actions.
- Data source: `GET /api/alerts`

### Feature 6: Ask CivicPulse (AI Q&A)

- What it does: Answers civic questions with concise, structured responses.
- UI demo: Open `/features/ask` and ask:
  `Which neighborhood needs urgent intervention today and why?`
- Expected result: Summary answer with reasoning and confidence.
- Data source: `GET /api/query?q=...`

### Feature 7: Voice + 311 Ticket Agent

- What it does: Conversational assistant that can collect issue details and file service tickets.
- UI demo: Use the floating `311 Agent` button and say:
  `Streetlight outage at 123 Oak Street. It feels unsafe at night.`
- Expected result: Agent requests missing details, then submits a ticket and returns ticket metadata.
- Data source: `POST /api/voice/session`, `POST /api/ticket`

## 3. How Scoring Works

Neighborhood score is a weighted composite:

- Safety: 25%
- Blight: 25%
- Service: 20%
- Activity: 20%
- Communications: 10%

Signals are derived from civic records (crime, permits, 311, blight) and city crawl intelligence.

## 4. Architecture

- Frontend: Vanilla JS SPA in `public/`
- Backend: Node.js + Express in `server/`
- Pipeline: `crawler -> civic fetch -> scoring -> anomalies -> briefing`
- Cache/Storage: in-memory + `.cache/` persistence
- AI services (optional/live): Perplexity, Firecrawl, ElevenLabs

## 5. Quick Start (Local)

### Prerequisites

- Node.js 20+
- npm 10+

### Setup

1. Install dependencies:

```bash
npm install
```

2. Create env file:

```bash
cp .env.example .env
```

PowerShell alternative:

```powershell
Copy-Item .env.example .env
```

3. (Optional but recommended) run one pipeline cycle:

```bash
npm run pipeline
```

4. Start app:

```bash
npm start
```

5. Open:

```text
http://localhost:8080
```

## 6. Judge API Smoke Test

Run these after `npm start`:

```bash
curl http://localhost:8080/health
curl http://localhost:8080/api/scores
curl http://localhost:8080/api/alerts
curl "http://localhost:8080/api/query?q=What%20is%20the%20highest%20scoring%20neighborhood%20today%3F"
```

Example ticket creation:

```bash
curl -X POST http://localhost:8080/api/ticket \
  -H "Content-Type: application/json" \
  -d '{"type":"Streetlight","address":"123 Oak St","description":"Light out and unsafe at night","residentName":"Judge Demo"}'
```

## 7. Environment Variables

Required for baseline run:

- `PIPELINE_SECRET` (for protected pipeline trigger)
- `PORT` (default `8080`)

Recommended for full live demo quality:

- `FIRECRAWL_API_KEY`
- `PERPLEXITY_API_KEY`
- `PERPLEXITY_MODEL` (default `sonar`)
- `ELEVENLABS_API_KEY`
- `ELEVENLABS_AGENT_ID` (optional for live voice session)
- `SOCRATA_APP_TOKEN` (recommended)
- `GCS_BUCKET_NAME` (optional cloud snapshot storage)

If AI keys are missing, the app still runs with fallback behavior for judging.

## 8. Deployment Snapshot

- Backend (Cloud Run): `civicpulse-backend`
- Frontend (Vercel): deploy from `public/` with SPA + API proxy rules in `public/vercel.json`

## 9. Repository Structure

```text
public/           # SPA frontend
server/           # Express app + pipeline modules
scripts/          # Utility scripts (manual pipeline run)
cloudbuild.yaml   # Cloud Build -> Cloud Run pipeline
Dockerfile        # Backend container image
```

## 10. 3-Minute Judge Demo Flow

1. Open homepage and show platform overview.
2. Go to `/features/scores` and explain weighted scoring.
3. Go to `/features/map` and click low-score neighborhood.
4. Go to `/features/alerts` and explain anomaly trigger logic.
5. Go to `/features/briefing` and play daily audio.
6. Go to `/features/ask` and run one policy-style question.
7. Open voice assistant and file one sample ticket.

This sequence demonstrates data ingestion, analytics, AI reasoning, and action workflow end-to-end.
