# CivicPulse Montgomery

AI-powered civic intelligence for Montgomery neighborhoods.

This repository contains a complete, runnable civic data platform with a frontend app, backend APIs, and an AI-powered daily intelligence pipeline.

## Live Links

- Frontend URL: `https://civic-pulse-beta.vercel.app`
- Backend URL: `https://civicpulse-backend-5xutw32mjq-uc.a.run.app`
- Demo video URL: `<ADD_DEMO_VIDEO_URL>`
- Slide deck URL: `<ADD_SLIDE_DECK_URL>`

## Project Snapshot

- Event: GenAI Works World Wide Vibes Hackathon
- Focus: AI + data solutions for real city challenges
- Selected challenge fit:
  - Civic Access & Community Communication
  - Smart Cities, Infrastructure & Public Spaces
  - Public Safety, Emergency Response & City Analytics
- Project type: Working prototype with live deploy support

## Problem

City signals (crime, permits, service requests, blight, announcements) are fragmented across portals. Residents and city teams lose time stitching data together, which delays interventions in neighborhoods that need support most.

## Solution

CivicPulse unifies public civic signals and AI into one daily decision layer:

- Neighborhood health scoring
- Equity map visualization
- Anomaly-based alerting
- Morning briefing (text + audio)
- AI Q&A and voice-first 311 support

## Features With Demo Examples

### Feature 1: Equity Map

- URL: `/features/map`
- Try this: Click neighborhood polygons.
- Expected output: Color-coded health status and trend per neighborhood.
- API: `GET /api/scores`

### Feature 2: Neighborhood Health Scores

- URL: `/features/scores`
- Try this: Review cards for all neighborhoods.
- Expected output: Composite score, factor breakdown, top pressure points, trend.
- API: `GET /api/scores`

### Feature 3: Signal Snapshot Chart

- URL: `/features/chart`
- Try this: Compare neighborhoods side by side.
- Expected output: Fast visual ranking of strongest vs weakest zones.
- API: `GET /api/scores`

### Feature 4: Morning Briefing (AI + Audio)

- URL: `/features/briefing`
- Try this: Press play and inspect headline cards.
- Expected output: Daily script summary + narration audio when available.
- API: `GET /api/briefing`

### Feature 5: Proactive Alerts

- URL: `/features/alerts`
- Try this: Inspect severity-ranked alerts.
- Expected output: High/medium/low anomalies with recommended actions.
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

## System Architecture

- Frontend: Vanilla JS SPA (`public/`)
- Backend: Node.js + Express (`server/index.js`)
- Pipeline flow: `crawler -> civic fetch -> scoring -> anomalies -> briefing`
- Storage/cache: in-memory + `.cache/` snapshot persistence
- Optional live AI providers: Perplexity, Firecrawl, ElevenLabs

## Diagrams

### Architecture Diagram

![Architecture Diagram](public/Diagrams/Architecture%20Diagram.svg)

### Pipeline Diagram

![Pipeline Diagram](public/Diagrams/Pipeline%20Diagram.svg)

### Use Case Diagram

![Use Case Diagram](public/Diagrams/Use%20Case%20Diagram.svg)

### Sequence Diagram (Ask AI Flow)

![Sequence Diagram (Ask AI Flow)](public/Diagrams/Sequence%20Diagram%20%28Ask%20AI%20Flow%29.svg)

### Deployment Diagram

![Deployment Diagram](public/Diagrams/Deployment%20Diagram.svg)

## Quick Start (Under 5 Minutes)

### Prerequisites

- Node.js 20+
- npm 10+

### Setup and Run

1. Install dependencies.

```bash
npm install
```

1. Create `.env`.

```powershell
Copy-Item .env.example .env
```

1. Optional: generate one fresh pipeline snapshot.

```bash
npm run pipeline
```

1. Start the app.

```bash
npm start
```

1. Open in browser.

```text
http://localhost:8080
```

## API Smoke Tests

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
  -d '{"type":"Streetlight","address":"123 Oak St","description":"Light out and unsafe at night","residentName":"Demo User"}'
```

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
- `VOICE_SESSION_REQUIRE_LIVE` (optional, disables simulated voice fallback)

## Repository Layout

```text
public/           # SPA frontend pages and UI logic
server/           # API routes and intelligence pipeline
scripts/          # utility scripts (manual pipeline run)
video/            # remotion demo project
cloudbuild.yaml   # CI/CD to Cloud Run
Dockerfile        # backend container build
```

## Team

Developed by **GenAI Innovators**.
