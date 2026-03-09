# CivicPulse Montgomery

AI-powered neighborhood intelligence for Montgomery, Alabama.

## Hackathon Summary

- Event: GenAI Works World Wide Vibes Hackathon (March 2026)
- Challenge fit:
  - Civic Access and Community Communication
  - Smart Cities, Infrastructure and Public Spaces
  - Public Safety, Emergency Response and City Analytics
- Judging criteria (publicly listed): relevance, execution quality, originality, social impact, commercial potential

## What This Project Solves

Montgomery civic signals are spread across multiple systems. CivicPulse unifies those signals into one daily operating view so residents and city teams can identify neighborhood issues faster and act earlier.

## Core Product Capabilities

- Neighborhood health scoring across 5 weighted factors
- Interactive equity map by neighborhood
- Signal comparison chart
- Daily AI briefing (script + optional audio)
- Proactive anomaly alerts
- AI Q and A over live civic context
- Voice-first 311 ticket assistant

## Judging-Focused Evidence

### Relevance

- Uses Montgomery civic data sources and city update crawling.
- Targets operational use cases: service backlog, blight, neighborhood risk, and resident reporting.

### Execution Quality

- Full-stack working app: Node/Express backend + SPA frontend.
- Daily pipeline orchestration: crawl -> fetch civic datasets -> score -> detect anomalies -> briefing.
- Fallback-safe design: app still runs if some providers fail.

### Originality

- Combines explainable neighborhood scoring, anomaly detection, and conversational service intake in one civic UX.

### Social Impact

- Makes neighborhood inequity visible.
- Improves response loop for high-risk or under-served areas.

### Commercial Potential

- Replicable architecture for other cities.
- Municipal, nonprofit, and civic-tech deployment fit.

## Feature-to-Endpoint Map

| Feature | UI Route | API | Status |
| --- | --- | --- | --- |
| Equity Map | `/features/map` | `GET /api/scores` | Working |
| Health Scores | `/features/scores` | `GET /api/scores` | Working |
| Signal Snapshot | `/features/chart` | `GET /api/scores` | Working |
| Morning Briefing | `/features/briefing` | `GET /api/briefing` | Working |
| Proactive Alerts | `/features/alerts` | `GET /api/alerts` | Working |
| Ask CivicPulse | `/features/ask` | `GET /api/query?q=...` | Working |
| Voice Session API | Backend voice integration endpoint | `POST /api/voice/session` | Working, supports optional live-only mode |
| Ticket Creation | Voice flow | `POST /api/ticket` | Working |

## Scoring Model (Implemented)

Weighted neighborhood score:

- Safety: 25%
- Blight: 25%
- Service: 20%
- Activity: 20%
- Communications: 10%

## Live and Local Verification

Verified on 2026-03-09:

- Local: `http://localhost:8080/health`, `/api/scores`, `/api/alerts`, `/api/briefing`, `/api/query`, `/api/ticket`
- Deployed backend: `https://civicpulse-backend-5xutw32mjq-uc.a.run.app/health`, `/api/scores`, `/api/briefing`, `/api/query`, `POST /api/voice/session`
- Live voice check: `POST /api/voice/session` with `requireLive=true` returns live ElevenLabs session (`simulated: false`)
- Live briefing audio check: `GET /api/briefing` reports `audio.available=true`; `/assets/briefings/<date>.mp3` serves `audio/mpeg`
- Demo render artifact exists: `out/civicpulse-demo.mp4`

## Submission Assets

- Backend URL: `https://civicpulse-backend-5xutw32mjq-uc.a.run.app`
- Frontend routing config for Vercel: `public/vercel.json`
- Demo video source and tooling: `video/README.md`
- Rendered demo artifact: `out/civicpulse-demo.mp4`

Before final submission, fill in these links:

- Live frontend URL: `<ADD_FRONTEND_URL>`
- Public demo video URL: `<ADD_VIDEO_URL>`
- Pitch deck URL: `<ADD_DECK_URL>`

## Local Run

### Prerequisites

- Node.js 20+
- npm 10+

### Start

1. Install dependencies.

```bash
npm install
```

1. Copy env file.

```powershell
Copy-Item .env.example .env
```

1. Optional: run one manual pipeline pass.

```bash
npm run pipeline
```

1. Start server.

```bash
npm start
```

1. Open:

```text
http://localhost:8080
```

## Environment Variables

Required baseline:

- `PIPELINE_SECRET`
- `PORT` (default `8080`)

Recommended for full quality:

- `PERPLEXITY_API_KEY`
- `PERPLEXITY_MODEL` (default `sonar`)
- `FIRECRAWL_API_KEY`
- `ELEVENLABS_API_KEY`
- `ELEVENLABS_AGENT_ID`
- `VOICE_SESSION_REQUIRE_LIVE` (`true` disables simulated voice-session fallback)
- `SOCRATA_APP_TOKEN`
- `GCS_BUCKET_NAME`

## Architecture

- Frontend: Vanilla JS SPA in `public/`
- Backend: Express API in `server/index.js`
- Pipeline: `server/pipeline/`
- Persistence: in-memory cache + `.cache/` or GCS
- Deploy: Cloud Run backend + Vercel frontend routing

## Repo Layout

```text
public/           SPA client
server/           API and pipeline
scripts/          Manual pipeline trigger
video/            Remotion demo project
cloudbuild.yaml   Cloud Run CI/CD
Dockerfile        Backend container
```

## Known Gaps Before Final Judging

- Frontend public URL is not documented yet in this repository.
- Judging guide page is partially gated by login, so public criteria were used.
- Sponsor bonus potential for Bright Data is not explicitly implemented in current runtime stack.
- Daily generated briefing audio files are runtime artifacts and are ignored from git by pattern.

## Fast 3-Minute Demo Flow

1. Show `/features/scores` and explain scoring factors.
1. Show `/features/map` and highlight one low-score neighborhood.
1. Show `/features/alerts` and recommended action.
1. Show `/features/briefing` and play audio if available.
1. Ask one high-value question in `/features/ask`.
1. File one sample issue through the voice widget.
