# V8.1 Evidence - Landing Anna voice enabled authority continuity seam

Date: 2026-03-27
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: `Landing Anna` broader voice UX / architecture
Packet: `Landing Anna voice enabled authority continuity`
Status: `landed`

## Seam closed

The next bounded voice packet now closes the voice-enabled authority seam between the Anna worker runtime and the public landing widget.

## What changed

1. `server/src/routes/public-anna.routes.ts` now makes `GET /api/public/anna/voice-config` respect worker `voice_enabled` when deciding whether public Anna voice is enabled
2. `src/components/Landing/AnnaAssistantWidget.tsx` now respects the bounded `enabled` flag returned by the public voice-config seam instead of deriving voice availability only from API key and browser capability
3. focused backend regression in `server/src/routes/v8/__tests__/public-anna.routes.test.ts` now proves that worker `voice_enabled = false` disables the public voice-config seam even when an API key exists
4. focused widget regression in `tests/components/Landing/AnnaAssistantWidget.cta-authority.test.tsx` now proves that the landing widget does not start live voice when the bounded public config says voice is disabled

## Why this packet matters

Before this packet:

1. the Anna worker model already had a `voice_enabled` runtime field,
2. but the public landing widget still treated voice as available whenever API key and browser support existed,
3. so voice enablement authority was split between worker runtime truth and frontend-local assumptions.

After this packet:

1. the public widget still preserves safe browser capability checks,
2. but worker runtime truth now decides whether public Anna voice is enabled at all,
3. and broader live-voice architecture work remains visible backlog rather than being hidden inside frontend-only gating logic.

## Lane state after this packet

The broader `Landing Anna` broader voice UX / architecture lane remains active.

The next step is to assess whether the smallest remaining packet now sits around broader browser-direct voice authority versus server-mediated typed Anna, rather than same-session continuity or basic config authority.
