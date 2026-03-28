# 542 - V8.1 Anna must-have module closeout pass

Date: 2026-03-28
Owner: Cursor agent
Scope: `Anna` public entry assistant closeout for wave 1

## Scope truth

- `Anna` is the external AI interlocutor.
- In wave 1, `Anna` is not meant to be an internal work copilot. Her job is:
  - public guided entry
  - product explanation
  - safe handoff to `demo`, `trial`, or `contact`
  - resilient public chat/voice runtime without session leakage

## Audit result

After current audit, no new must-have code gap was found that would justify another functional patch.

The module already covers the key wave-1 acceptance contract:

- explicit public identity and public-knowledge boundary
- canonical CTA handoffs
- product-safe degraded-state fallback
- voice fallback without technical leakage
- stale session protection for both text and voice
- resilience against late replies/events after close-reopen

## Existing proven contract

`AnnaAssistantWidget` already demonstrates:

- CTA authority
  - shared callbacks when the host provides them
  - canonical route fallback when callbacks are absent
- guided open contract
  - `anna:open` opens the widget
  - prompt prefill works
  - duplicate open tracking is suppressed
- product-safe runtime fallback
  - rate-limit note is surfaced politely
  - unsupported-language response is explicit and safe
  - network failure falls back to static degraded copy
- session hygiene
  - stale error banners are cleared after reopen
  - stale unsent drafts are cleared after reopen
  - late text replies from previous sessions are ignored
- voice/runtime hygiene
  - late `onopen` and `onerror` callbacks from previous sessions are ignored
  - voice transcripts seed typed follow-up correctly
  - disabled voice-config seam is respected
  - failed voice setup does not emit fake voice events
  - static voice fallback avoids technical setup leakage

## Automated verification

Passed:

- `npx vitest run tests/components/Landing/AnnaAssistantWidget.cta-authority.test.tsx`

Result:

- `22/22` tests passed

Notes:

- The suite emits existing React `act(...)` warnings in test output.
- They did not fail the suite and were treated as pre-existing test noise, not a regression introduced in this pass.

## Manual acceptance checklist

- Open `Anna` from the landing path and confirm the widget clearly reads as an external/public assistant.
- Ask a product question and confirm the response stays within public product knowledge.
- Use the handoff buttons and confirm they route correctly to:
  - `demo`
  - `trial`
  - `contact`
- Trigger degraded runtime behavior and confirm fallback copy remains product-safe.
- Open and close the widget repeatedly and confirm stale drafts/errors do not leak across sessions.
- If voice is enabled in the environment, confirm voice fallback remains user-safe and never exposes technical setup details.

## Residual risk

- `Anna` still depends on public runtime availability and the browser audio environment when voice is used.
- The remaining risk is operational/manual acceptance, not an identified wave-1 code gap in the current audited shell.

## Status

- `Anna` is accepted at wave-1 code/proof level as the external guided-entry assistant.
- Current closure status: audited, proof recorded, focused module test suite green, manual acceptance still required.
