# V8.1 Evidence - Landing Anna Spanish public continuity seam

Date: 2026-03-27
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: `Landing Anna multilingual expansion`
Packet: `Landing Anna Spanish public continuity`
Status: `landed`

## Seam closed

The first bounded multilingual packet now closes the Spanish public-continuity seam for Anna on the live landing surface.

## What changed

1. `server/src/routes/public-anna.routes.ts` now treats Spanish as a supported public Anna language instead of routing Spanish-looking messages into unsupported-language fallback
2. Spanish runtime fallback copy now exists for bounded cases that still need a safe response, including service-unavailable and rate-limit handling
3. `src/components/Landing/AnnaAssistantWidget.tsx` now includes bounded Spanish public copy and Spanish voice-system instruction copy for the visible landing widget
4. `docs/product/ANNA_LP_ASSISTANT_CONTRACT_V8.md` now records the bounded PL/EN/ES public-language cut and the rule that Spanish answers still stay inside approved public knowledge boundaries
5. `server/src/routes/v8/__tests__/public-anna.routes.test.ts` and `tests/components/Landing/AnnaAssistantWidget.cta-authority.test.tsx` now add focused regression for the new Spanish continuity path

## Why this packet matters

Before this packet:

1. the public shell could already expose `es` as an app locale
2. but Anna still behaved as if Spanish was unsupported
3. so the live landing assistant lagged behind the rest of the public language surface

After this packet:

1. Spanish becomes the first real bounded multilingual expansion for public Anna
2. the landing assistant no longer falls back immediately when the visitor starts in Spanish
3. broader multilingual breadth for `de`, `ar`, and `jp` remains visible backlog rather than being silently folded into this first cut

## Lane state after this packet

The broader `Landing Anna multilingual expansion` lane remains active.

The next step is to assess the next smallest honest multilingual packet after Spanish public continuity is in place.
