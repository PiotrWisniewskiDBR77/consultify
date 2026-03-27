# V8.1 Evidence - Landing Anna degraded fallback Seam

Date: 2026-03-26
Lane: `Landing Anna degraded fallback`
Taxonomy: `T4`
Packet: `anna service-unavailable continuity`

## Goal

Close the bounded Anna degraded-state seam where the contract requires a static service-unavailable message, but the live
route and widget still expose older generic fallback copy.

## What changed

1. `server/src/routes/public-anna.routes.ts`
   - adds a shared service-unavailable fallback message helper
   - returns that static message when the Anna providers are unavailable
   - tags the route response with `fallbackReason: 'service_unavailable'`
2. `src/components/Landing/AnnaAssistantWidget.tsx`
   - aligns the widget's local request-failure copy to the same contract-level message
3. `server/src/routes/v8/__tests__/public-anna.routes.test.ts`
   - verifies the public Anna route returns the static degraded-state message when providers are unavailable
4. `tests/components/Landing/AnnaAssistantWidget.cta-authority.test.tsx`
   - verifies the widget shows the same static degraded-state message when the request fails before reaching the backend

## Why it matters

Before this packet, Anna's degraded-state guidance was split across two different fallback messages depending on whether the
failure happened in the backend or before the request reached it.

After this packet, the runtime and widget converge on the same contract-defined message, while the CTA handoff controls remain
available on the surface.

## Verification

- `npm exec vitest run server/src/routes/v8/__tests__/public-anna.routes.test.ts tests/components/Landing/AnnaAssistantWidget.cta-authority.test.tsx tests/components/ProductEntryPage.kb-preview.test.tsx`
