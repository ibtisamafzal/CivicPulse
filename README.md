# CivicPulse Montgomery

CivicPulse Montgomery is a full-stack web app for neighborhood equity intelligence.

## Quick Start

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create environment file:

   ```bash
   cp .env.example .env
   ```

3. Start server:

   ```bash
   npm start
   ```

4. Open `http://localhost:8080`.

## Current Implementation Status

This starter implementation includes:

- Express server with core API routes
- Initial pipeline modules and orchestration
- Leaflet-based dashboard and score cards
- Alert feed and voice widget shell

Next steps are to connect live APIs (Firecrawl, Socrata, Perplexity, ElevenLabs) with production credentials and refine scoring calibration.

## Live Mode Notes

When these keys are configured in `.env`, CivicPulse now runs with live providers:

- `FIRECRAWL_API_KEY`: Live city-site crawling in pipeline runs.
- `PERPLEXITY_API_KEY`: Live enrichment for neighborhood insights, Q&A, and morning briefing script generation.
- `PERPLEXITY_MODEL` (optional): Defaults to `sonar`; fallback model retry is built in.
- `ELEVENLABS_API_KEY`: Daily briefing MP3 synthesis to `public/assets/briefings/<date>.mp3`.
- `ELEVENLABS_AGENT_ID` (optional): Enables live ConvAI voice sessions for `/api/voice/session`.
- `SOCRATA_APP_TOKEN` (optional but recommended): Higher-rate, authenticated Socrata requests.

The Socrata fetcher now supports:

- Direct endpoint names (for example `abcd-1234.json`)
- Absolute dataset URLs
- Automatic catalog discovery fallback if configured endpoints return errors

## Quick Verification

1. Run pipeline manually:

   ```bash
   npm run pipeline
   ```

2. Start app:

   ```bash
   npm start
   ```

3. Check live endpoints:

   - `GET /api/scores`
   - `GET /api/alerts`
   - `GET /api/briefing`
   - `GET /api/query?q=...`

If `ELEVENLABS_AGENT_ID` is empty, `/api/voice/session` intentionally returns demo-mode metadata while the rest of the stack can still run fully live.
