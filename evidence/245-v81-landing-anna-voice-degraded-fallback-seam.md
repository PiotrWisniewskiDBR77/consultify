# V8.1 Evidence - Landing Anna voice degraded fallback Seam

Date: 2026-03-26
Lane: `Landing Anna voice degraded fallback`
Taxonomy: `T4`
Packet: `voice no-technical-details degraded-state continuity`

## Goal

Close the bounded Anna voice degraded-state seam where the public widget still exposed technical setup details and a separate
voice-start error path instead of the contract-safe static unavailable message.

## What changed

1. `src/components/Landing/AnnaAssistantWidget.tsx`
   - aligns `voiceUnavailable` to the same static degraded-state message used on the main Anna surface
   - aligns `voiceError` to the same static degraded-state message
   - removes visitor-facing references to microphone / API-key setup from the degraded voice path
2. `tests/components/Landing/AnnaAssistantWidget.cta-authority.test.tsx`
   - verifies the voice surface shows the static degraded-state message
   - verifies the public widget no longer exposes technical setup details such as `NEXT_PUBLIC_GEMINI_API_KEY`

## Why it matters

Before this packet, the public Anna widget still leaked implementation-level setup language on the voice surface, even though
the contract requires visitor-safe degraded behavior without technical details.

After this packet, both the main chat path and the visible voice degraded path converge on the same contract-safe message.

## Verification

- `npm exec vitest run tests/components/Landing/AnnaAssistantWidget.cta-authority.test.tsx server/src/routes/v8/__tests__/public-anna.routes.test.ts tests/components/ProductEntryPage.kb-preview.test.tsx`
