# V8.1 Evidence - Landing Anna public funnel ingest continuity seam

Date: 2026-03-27
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: `Landing Anna backend analytics / dashboard breadth`
Packet: `Landing Anna public funnel ingest continuity`
Status: `landed`

## Seam closed

The first bounded backend analytics packet now closes the public Anna funnel ingest continuity seam between the live landing widget and durable backend/operator truth.

## What changed

1. `server/src/routes/public-anna.routes.ts` now exposes bounded `POST /api/public/anna/funnel-event` ingest for the existing Landing Anna funnel event set
2. `server/src/services/annaAnalyticsService.ts` now persists those public Anna funnel events into reusable `conversion_events` storage under `source = landing_anna` and computes a thin summary read model
3. `server/src/services/demoTrialTelemetryService.ts` now exposes a reusable `recordConversionEvent` seam so Anna analytics can reuse existing conversion telemetry storage instead of creating a separate analytics table
4. `server/src/routes/analytics-superadmin.routes.ts` now exposes `GET /api/superadmin/analytics/anna-funnel` for bounded operator-facing summary readback
5. `src/services/publicAnnaAnalytics.ts` and `src/components/Landing/AnnaAssistantWidget.tsx` now forward the existing `landing_anna_*` widget events to the new backend seam without changing current widget UX
6. focused regression now covers public ingest, superadmin summary read, frontend helper behavior, and widget continuity

## Why this packet matters

Before this packet:

1. the public Anna widget emitted funnel events only into client-local/session analytics paths
2. anonymous landing Anna funnel activity had no reliable durable backend truth
3. backend/operator analytics for Anna remained partial and conversation-centric

After this packet:

1. the current public Anna funnel event set now has a durable backend ingest path
2. a thin superadmin summary can read real Landing Anna funnel data from backend storage
3. broader Anna dashboard/UI breadth remains visible backlog rather than being silently folded into this first packet

## Lane state after this packet

The broader `Landing Anna backend analytics / dashboard breadth` lane remains active.

The next step is to assess the next smallest honest packet after public funnel ingest continuity is in place, likely around bounded operator/dashboard surface continuity rather than more client-only telemetry.
