# V8.1 Evidence - Landing Anna guardrails Rate-Limit Seam

Date: 2026-03-26
Lane: `Landing Anna guardrails`
Taxonomy: `T4`
Packet: `anna public rate-limit guardrail`

## Goal

Close the bounded Anna public-assistant seam where the contract requires per-session rate limiting with a polite CTA-oriented
handoff, but the live runtime has no Anna-specific limiter and the widget collapses `429` responses to a generic error.

## What changed

1. `server/src/routes/public-anna.routes.ts`
   - adds a bounded per-session rate-limit store for `POST /api/public/anna/chat`
   - keys the limiter by `sessionId` when present and falls back to IP when it is not
   - returns a polite `429` payload with retry timing and public CTA guidance
   - exports a test reset helper for deterministic route regression
2. `src/components/Landing/AnnaAssistantWidget.tsx`
   - reads Anna's `429` payload instead of collapsing to a generic connectivity error
   - surfaces the polite guardrail message back into the chat transcript
   - preserves visible `Demo`, `Trial`, and `Contact` handoff controls while rate-limited
3. `server/src/routes/v8/__tests__/public-anna.routes.test.ts`
   - verifies the bounded per-session limiter
   - verifies a fresh session remains usable after another session is capped
4. `tests/components/Landing/AnnaAssistantWidget.cta-authority.test.tsx`
   - verifies the widget surfaces the polite rate-limit message instead of generic failure copy

## Why it matters

Before this packet, Anna's contract promised abuse guardrails that did not actually exist in the live runtime, and the active
widget surface would have reduced any future `429` to an unhelpful generic error.

After this packet, the runtime enforces a bounded Anna-specific session cap and the widget keeps the experience legible by
showing a polite message while leaving the public CTA paths available.

## Verification

- `npm exec vitest run server/src/routes/v8/__tests__/public-anna.routes.test.ts tests/components/Landing/AnnaAssistantWidget.cta-authority.test.tsx tests/components/ProductEntryPage.kb-preview.test.tsx`
