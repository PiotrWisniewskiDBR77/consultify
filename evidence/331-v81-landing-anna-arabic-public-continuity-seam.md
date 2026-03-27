# V8.1 Evidence - Landing Anna Arabic public continuity seam

Date: 2026-03-27
Program: `POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM`
Lane: `Landing Anna multilingual expansion`
Packet: `Landing Anna Arabic public continuity`
Status: `landed`

## Seam closed

The final bounded multilingual packet now closes the Arabic public-continuity seam for Anna on the live landing surface.

## What changed

1. `server/src/routes/public-anna.routes.ts` now treats Arabic as a supported public Anna language instead of routing Arabic script traffic into unsupported-language fallback
2. Arabic runtime fallback copy now exists for bounded safe-response cases, including service-unavailable and rate-limit handling
3. `src/components/Landing/AnnaAssistantWidget.tsx` now includes bounded Arabic public copy, Arabic voice-system instruction, and minimal RTL-safe widget direction handling
4. `docs/product/ANNA_LP_ASSISTANT_CONTRACT_V8.md` now records Arabic inside the bounded public-language set and keeps Arabic answers inside the same approved public-knowledge boundaries
5. `server/src/routes/v8/__tests__/public-anna.routes.test.ts` and `tests/components/Landing/AnnaAssistantWidget.cta-authority.test.tsx` now add focused regression for the Arabic continuity path and move unsupported-language proof to a language still outside the accepted cut

## Why this packet matters

Before this packet:

1. the public app locale system already exposed `ar`
2. but Anna still collapsed Arabic input into unsupported-language fallback
3. so the multilingual lane still had one honest residual packet after Spanish, German, and Japanese

After this packet:

1. Anna now covers the full currently exposed public app-locale set: `PL`, `EN`, `ES`, `DE`, `JP`, and `AR`
2. the multilingual lane no longer has a smaller honest language packet left inside its bounded scope
3. broader Anna analytics and broader voice-product work remain separate lanes rather than being folded into multilingual closure
