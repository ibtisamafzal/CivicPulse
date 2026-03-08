# CivicPulse Montgomery

AI-powered civic intelligence for Montgomery neighborhoods.

This repository is prepared as a **World Wide Vibes (GenAI Works) hackathon submission**: clear challenge fit, runnable prototype, and judge-focused demo flow.

## Hackathon Snapshot

- Event: GenAI Works World Wide Vibes Hackathon
- Focus: AI + data solutions for real city challenges
- Selected challenge fit:
  - Civic Access & Community Communication
  - Smart Cities, Infrastructure & Public Spaces
  - Public Safety, Emergency Response & City Analytics
- Submission type: Working prototype + short presentation/demo

## Problem

City signals (crime, permits, service requests, blight, announcements) are fragmented across portals. Residents and city teams lose time stitching data together, which delays interventions in neighborhoods that need support most.

## Solution

CivicPulse unifies public civic signals and AI into one daily decision layer:

- Neighborhood health scoring
- Equity map visualization
- Anomaly-based alerting
- Morning briefing (text + audio)
- AI Q&A and voice-first 311 support

## Why This Project Is Competitive

This section maps directly to common hackathon judging dimensions.

### 1) Relevance

- Uses real Montgomery civic datasets and city-context web updates.
- Targets practical city operations: backlog triage, neighborhood risk detection, resident communication.

### 2) Execution Quality

- Full-stack app with deployed backend + deploy-ready frontend.
- End-to-end pipeline: ingest -> score -> alert -> explain -> action.
- API-first design with deterministic fallback behavior.

### 3) Originality

- Combines civic anomaly detection with explainable neighborhood scoring.
- Integrates an AI assistant plus voice workflow for service ticket creation.

### 4) Social Impact

- Makes neighborhood inequity visible in one view.
- Enables faster response to high-risk areas and service gaps.

### 5) Commercial Potential

- Reusable for municipal departments, nonprofits, and civic-tech operators.
- Can scale city-to-city by swapping dataset connectors and boundaries.

## Features With Demo Examples

### Feature 1: Equity Map

- URL: `/features/map`
- What judges should do: Click neighborhood polygons.
- Expected output: Color-coded health status and trend per neighborhood.
- API: `GET /api/scores`

### Feature 2: Neighborhood Health Scores

- URL: `/features/scores`
- What judges should do: Review cards for all neighborhoods.
- Expected output: Composite score, factor breakdown, top pressure points, trend.
- API: `GET /api/scores`

### Feature 3: Signal Snapshot Chart

- URL: `/features/chart`
- What judges should do: Compare neighborhoods side by side.
- Expected output: Fast visual ranking of strongest vs weakest zones.
- API: `GET /api/scores`

### Feature 4: Morning Briefing (AI + Audio)

- URL: `/features/briefing`
- What judges should do: Press play and inspect headline cards.
- Expected output: Daily script summary + optional narration audio.
- API: `GET /api/briefing`

### Feature 5: Proactive Alerts

- URL: `/features/alerts`
- What judges should do: Inspect severity-ranked alerts.
- Expected output: HIGH/MEDIUM/LOW anomalies with recommended operational actions.
- API: `GET /api/alerts`

### Feature 6: Ask CivicPulse (AI Q&A)

- URL: `/features/ask`
- Demo prompt: `Which neighborhood needs urgent intervention today and why?`
- Expected output: Structured answer with concise civic reasoning.
- API: `GET /api/query?q=...`

### Feature 7: Voice + 311 Ticket Agent

- Entry: Floating `311 Agent` button
- Demo prompt: `Streetlight outage at 123 Oak Street. It feels unsafe at night.`
- Expected output: Multi-turn intake, then a created ticket response with priority and ETA.
- APIs: `POST /api/voice/session`, `POST /api/ticket`

## Scoring Model

Each neighborhood score is a weighted composite:

- Safety: 25%
- Blight: 25%
- Service: 20%
- Activity: 20%
- Communications: 10%

Inputs come from crime, permits, 311 ticket signals, blight records, and city web updates.

## System Architecture

- Frontend: Vanilla JS SPA (`public/`)
- Backend: Node.js + Express (`server/index.js`)
- Pipeline flow: `crawler -> civic fetch -> scoring -> anomalies -> briefing`
- Storage/cache: in-memory + `.cache/` snapshot persistence
- Optional live AI providers: Perplexity, Firecrawl, ElevenLabs

## Quick Start (Under 5 Minutes)

### Prerequisites

- Node.js 20+
- npm 10+

### Setup and Run

1. Install dependencies

```bash
npm install
```

2. Create `.env`

```bash
cp .env.example .env
```

PowerShell alternative:

```powershell
Copy-Item .env.example .env
```

3. Optional: generate one fresh pipeline snapshot

```bash
npm run pipeline
```

4. Start the app

```bash
npm start
```

5. Open in browser

```text
http://localhost:8080
```

## Judge Smoke Tests

After startup, run:

```bash
curl http://localhost:8080/health
curl http://localhost:8080/api/scores
curl http://localhost:8080/api/alerts
curl "http://localhost:8080/api/query?q=What%20is%20the%20highest%20scoring%20neighborhood%20today%3F"
```

Sample ticket creation:

```bash
curl -X POST http://localhost:8080/api/ticket \
  -H "Content-Type: application/json" \
  -d '{"type":"Streetlight","address":"123 Oak St","description":"Light out and unsafe at night","residentName":"Judge Demo"}'
```

## Deployment

- Backend (Cloud Run): `https://civicpulse-backend-5xutw32mjq-uc.a.run.app`
- Frontend (Vercel): deploy from `public/` using `public/vercel.json` routing

If you are reviewing from deployed links, replace placeholders below before final submission:

- Live frontend URL: `<ADD_VERCEL_URL>`
- Demo video URL: `<ADD_DEMO_VIDEO_URL>`
- Pitch deck URL: `<ADD_DECK_URL>`

## Environment Variables

Baseline:

- `PIPELINE_SECRET`
- `PORT` (default `8080`)

Recommended for full live quality:

- `FIRECRAWL_API_KEY`
- `PERPLEXITY_API_KEY`
- `PERPLEXITY_MODEL` (default `sonar`)
- `ELEVENLABS_API_KEY`
- `ELEVENLABS_AGENT_ID` (optional)
- `SOCRATA_APP_TOKEN` (recommended)
- `GCS_BUCKET_NAME` (optional)

The prototype still runs in fallback mode when some AI keys are absent.

## Repository Layout

```text
public/           # SPA frontend pages and UI logic
server/           # API routes and intelligence pipeline
scripts/          # utility scripts (manual pipeline run)
cloudbuild.yaml   # CI/CD to Cloud Run
Dockerfile        # backend container build
```

## Submission Checklist

- Working prototype URL
- Public GitHub repository
- Short demo video or live walkthrough
- Brief presentation describing problem, approach, and impact

## Suggested 3-Minute Judge Demo Script

1. Show `/features/scores` and explain scoring logic.
2. Show `/features/map` and identify one low-performing neighborhood.
3. Show `/features/alerts` and connect one anomaly to an operational action.
4. Show `/features/briefing` and play 10-15 seconds of audio.
5. Ask one policy question in `/features/ask`.
6. File one sample ticket through the voice widget.

This sequence demonstrates end-to-end capability: data ingestion, AI reasoning, resident interaction, and actionable city operations.
