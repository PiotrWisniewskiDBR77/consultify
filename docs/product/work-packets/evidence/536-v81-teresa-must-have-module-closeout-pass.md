# 536 - V8.1 Teresa must-have module closeout pass

Date: 2026-03-28
Owner: Cursor agent
Scope: `Teresa` must-have closure for the current wave

## Scope truth

- `Anna` is the external/public entry assistant.
- `Teresa` is the internal AI conversation surface for work inside the product.
- `Teresa` does not need to pretend to be a public product guide or a developer console.
- The must-have closure for `Teresa` in this wave is:
  - honest internal identity
  - honest runtime fallbacks
  - canonical user recovery paths
  - no leakage of developer remediation into user-visible copy

## Problem before closeout

- Internal chat surfaces still leaked technical remediation during stream failures:
  - backend logs
  - browser console
  - provider setup / env variable guidance
- Legacy full-screen chat and the unified internal chat did not share one fallback contract.
- Empty AI responses could degrade into a weak or confusing user-visible state.
- Demo overflow inside the internal chat still pointed to a stale auth route instead of the canonical trial path.
- The internal assistant shell still read too generically as `AI Chat`, which weakened the distinction between:
  - external `Anna`
  - internal `Teresa`

## What landed

### 1. One Teresa runtime fallback contract

- Added `src/components/AIChat/teresaRuntimeCopy.ts`
  - `getTeresaStartFailureMessage()`
  - `getTeresaEmptyResponseMessage()`

This became the shared source of truth for Teresa runtime fallback copy.

### 2. Unified internal chat no longer exposes developer instructions

- `src/components/AIChat/UnifiedChatPanel.tsx`
  - replaced stream-start failure copy with a product-safe Teresa message
  - replaced empty-response fallback with Teresa-safe copy
  - removed user-facing references to:
    - backend logs
    - provider configuration
    - raw env variables

### 3. Legacy Teresa surface now behaves the same way

- `src/views/AIChatWelcomeView.tsx`
  - stream failures now use the same Teresa-safe runtime message
  - empty AI responses are normalized into the same Teresa-safe fallback instead of persisting an empty answer

### 4. Demo overflow now uses the canonical trial path

- `src/components/AIChat/UnifiedChatPanel.tsx`
  - demo access-blocked events now point to `/trial` instead of the stale `'/auth?mode=register'`

### 5. Internal identity is now explicit in Teresa shell copy

- `src/components/AIChat/UnifiedChatPanel.tsx`
  - welcome state now says `Talk to Teresa`
  - welcome subtitle now frames the surface as an internal AI work partner
  - placeholder now says `Ask Teresa about your work...`
  - context placeholder now says `How can Teresa help with {{context}}?`

- `src/views/AIChatWelcomeView.tsx`
  - welcome screen now displays a visible `Teresa` badge
  - placeholder now aligns with the same Teresa-specific internal copy

- `public/locales/en/translation.json`
- `public/locales/pl/translation.json`
  - added Teresa-specific translation entries for welcome and placeholder copy

## Automated verification

Passed:

- `npx vitest run tests/components/AIChat/UnifiedChatPanel.test.tsx tests/components/AIChat/AIChatWelcomeView.v8-controls.test.tsx tests/components/AIChat/teresaRuntimeCopy.test.ts`

Coverage includes:

- Teresa fallback copy contains no backend / env remediation
- `UnifiedChatPanel` persists Teresa-safe fallback on stream failure
- `AIChatWelcomeView` persists Teresa-safe fallback on empty response
- demo access-blocked flow uses canonical `/trial`
- unified internal welcome state now renders Teresa-specific identity copy

## Manual acceptance checklist

- Open the internal AI chat and confirm the shell presents itself as `Teresa`, not as a generic public assistant.
- Confirm the main placeholder reads as Teresa-specific internal work guidance, not generic `AI Chat`.
- Simulate a stream failure and confirm the user sees a product-safe message without backend or env setup instructions.
- Simulate an empty AI response and confirm Teresa shows an honest fallback instead of a blank/empty answer.
- In demo mode, exhaust access and confirm the recovery CTA points to the canonical `/trial` route.
- Confirm nothing in Teresa suggests the public `Anna` handoff model (`demo`, `trial`, `contact`) as the main runtime posture for internal work.

## Residual risk

- This closeout does not claim that Teresa is a separate autonomous workflow engine; it remains an internal conversational layer riding stabilized product surfaces.
- Existing test noise with `act(...)` warnings in the broader `UnifiedChatPanel` suite remains pre-existing and was not expanded into a wider test-hygiene refactor here.
- Deeper Teresa productization beyond this wave may still include:
  - richer workspace handoff semantics
  - tighter voice workflow product cues
  - more explicit multi-surface task execution framing

## Status

- `Teresa` now behaves like an internal AI conversation partner rather than a public assistant or a developer-debug surface.
- Current closure status at time of write: code landed, focused tests green, pre-ratification snapshot.
- Current authority: final Wave 1 module ratification is recorded in `548-v81-wave1-final-module-gate-ratification.md`.
