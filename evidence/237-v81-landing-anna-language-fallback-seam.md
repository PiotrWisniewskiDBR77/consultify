# V8.1 Evidence - Landing Anna language fallback Seam

Date: 2026-03-26
Lane: `Landing Anna language fallback`
Taxonomy: `T4`
Packet: `anna unsupported-language fallback`

## Goal

Close the bounded Anna public-assistant seam where the contract requires an English note for unsupported languages, but the
live runtime has no explicit fallback and the widget therefore has no visible continuity for that case.

## What changed

1. `server/src/routes/public-anna.routes.ts`
   - adds bounded unsupported-language detection for the public Anna route
   - returns a fixed English fallback note when the visitor writes in a non-supported language
   - keeps the normal PL/EN path unchanged for supported conversations
2. `server/src/routes/v8/__tests__/public-anna.routes.test.ts`
   - verifies unsupported-language requests return the English fallback payload
3. `tests/components/Landing/AnnaAssistantWidget.cta-authority.test.tsx`
   - verifies the widget surfaces the unsupported-language note directly in the chat transcript

## Why it matters

Before this packet, Anna's contract promised a safe unsupported-language fallback, but the live route had no such branch.

After this packet, unsupported-language traffic no longer enters the normal Anna model path. The user sees a deterministic
English note that points them back to supported languages and public CTA paths.

## Verification

- `npm exec vitest run server/src/routes/v8/__tests__/public-anna.routes.test.ts tests/components/Landing/AnnaAssistantWidget.cta-authority.test.tsx tests/components/ProductEntryPage.kb-preview.test.tsx`
