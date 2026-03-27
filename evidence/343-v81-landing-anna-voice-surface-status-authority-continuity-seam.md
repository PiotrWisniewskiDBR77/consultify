# V8.1 Evidence - Landing Anna voice surface/status authority continuity seam

Date: 2026-03-27
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: `Landing Anna` broader voice UX / architecture
Packet: `Landing Anna voice surface/status authority continuity`
Status: `landed`

## Seam closed

The next bounded voice packet now closes the public voice authority seam where Anna worker status or surface could disagree with the landing widget's voice availability.

## What changed

1. `server/src/routes/public-anna.routes.ts` now makes `GET /api/public/anna/voice-config` respect Anna worker `status` and `surface`, not only `voice_enabled`
2. public Anna voice is now disabled when the worker is not `active` or is not exposed on a public surface (`landing_page` or `both`)
3. focused regression in `server/src/routes/v8/__tests__/public-anna.routes.test.ts` now proves that `status = disabled` or `surface = in_platform` disables the bounded public voice-config seam even when API key and voice name are present

## Why this packet matters

Before this packet:

1. the public voice-config seam already respected `voice_enabled`,
2. but it could still expose landing voice when the Anna worker itself was disabled or not assigned to a public surface,
3. so public voice availability authority remained split between worker runtime truth and the landing seam.

After this packet:

1. public Anna voice remains bounded to the same runtime worker object that already owns status and surface policy,
2. landing voice availability no longer ignores worker lifecycle/public-surface authority,
3. and broader browser-direct versus server-mediated voice architecture work remains visible backlog instead of being hidden inside config gating.

## Lane state after this packet

The broader `Landing Anna` broader voice UX / architecture lane remains active.

The next step is to assess whether the smallest remaining packet now sits around deeper browser-direct voice authority versus server-mediated typed Anna, rather than same-session continuity or basic public config policy.
