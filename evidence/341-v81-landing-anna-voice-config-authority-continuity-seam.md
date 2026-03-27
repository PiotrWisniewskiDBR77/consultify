# V8.1 Evidence - Landing Anna voice config authority continuity seam

Date: 2026-03-27
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: `Landing Anna` broader voice UX / architecture
Packet: `Landing Anna voice config authority continuity`
Status: `landed`

## Seam closed

The next bounded voice packet now closes the voice-name authority seam between the public Anna worker runtime and the browser widget.

## What changed

1. `server/src/routes/public-anna.routes.ts` now extends `GET /api/public/anna/voice-config` to return the worker-configured Anna `voiceName` when available
2. `src/components/Landing/AnnaAssistantWidget.tsx` now reads that bounded `voiceName` from the public voice-config seam and uses it in Gemini Live setup instead of assuming only the local fallback constant
3. focused backend regression in `server/src/routes/v8/__tests__/public-anna.routes.test.ts` now proves the public voice-config seam returns the worker-configured voice name
4. focused widget regression in `tests/components/Landing/AnnaAssistantWidget.cta-authority.test.tsx` now proves the live voice session uses the configured voice name from the seam

## Why this packet matters

Before this packet:

1. the active public Anna voice widget used a fixed browser-side voice constant,
2. while the worker model already had a runtime `voice_name` field,
3. so voice identity authority was split between worker runtime truth and frontend-local assumptions.

After this packet:

1. the public voice widget still has a safe local fallback,
2. but worker-configured voice identity now flows through the bounded public voice-config seam,
3. and broader model/prompt/architecture productization remains visible backlog rather than being smuggled into this authority packet.

## Lane state after this packet

The broader `Landing Anna` broader voice UX / architecture lane remains active.

The next step is to assess whether the smallest remaining packet now sits around broader server-mediated authority for live voice, rather than continuity, channel truth, or voice-name configuration.
