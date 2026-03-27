# V8.1 Evidence - Landing Anna German public continuity seam

Date: 2026-03-27
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: `Landing Anna multilingual expansion`
Packet: `Landing Anna German public continuity`
Status: `landed`

## Seam closed

The second bounded multilingual packet now closes the German public-continuity seam for Anna on the live landing surface.

## What changed

1. `server/src/routes/public-anna.routes.ts` now treats German as a supported public Anna language instead of routing German-looking messages into unsupported-language fallback
2. German runtime fallback copy now exists for bounded cases that still need a safe response, including service-unavailable and rate-limit handling
3. `src/components/Landing/AnnaAssistantWidget.tsx` now includes bounded German public copy and German voice-system instruction copy for the visible landing widget
4. `docs/product/ANNA_LP_ASSISTANT_CONTRACT_V8.md` now records the bounded PL/EN/ES/DE public-language cut and the rule that German answers still stay inside approved public knowledge boundaries
5. `server/src/routes/v8/__tests__/public-anna.routes.test.ts` and `tests/components/Landing/AnnaAssistantWidget.cta-authority.test.tsx` now add focused regression for the new German continuity path

## Why this packet matters

Before this packet:

1. the public app locale system already supported `de`
2. but Anna still behaved as if German was unsupported
3. so the live landing assistant still lagged behind the broader public-language surface after Spanish landed

After this packet:

1. German becomes the second real bounded multilingual expansion for public Anna
2. the landing assistant no longer falls back immediately when the visitor starts in German
3. Arabic and Japanese remain visible backlog rather than being silently folded into this packet

## Lane state after this packet

The broader `Landing Anna multilingual expansion` lane remains active.

The next step is to assess the next smallest honest multilingual packet after Spanish and German public continuity are in place.
