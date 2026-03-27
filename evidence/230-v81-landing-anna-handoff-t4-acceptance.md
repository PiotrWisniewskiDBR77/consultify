# V8.1 Evidence - Landing Anna handoff T4 Acceptance

Date: 2026-03-26
Lane: `Landing Anna handoff`
Taxonomy: `T4`
Status: `accepted`

## Acceptance basis

This bounded `Landing Anna handoff` lane is ready for `T4` acceptance because the live public Anna surface now exposes the
contract-required handoff paths and canonical `/` routes them through the shared landing conversion contract.

1. Anna now exposes visible `Demo`, `Trial`, and `Contact` handoff controls on the widget itself
2. canonical `/` now routes Anna `Demo` and `Trial` handoffs through the same shared modal-backed conversion authority used by
   the rest of the landing surface
3. Anna retains safe fallback navigation for public routes when those shared callbacks are not supplied
4. focused regressions prove both widget authority and homepage wiring

## Why this is sufficient

The lane was scoped as one bounded handoff-continuity cut, not as a full Anna redesign. Within that scope, the contract-vs-
surface gap around public CTA handoffs is closed.

Any future Anna prompt, KB, rate-limit, unsupported-language, analytics, or broader landing-placement work remains visible
backlog and should only re-enter execution through a separate explicit promotion.

## Evidence chain

1. `evidence/228-v81-landing-anna-handoff-split-brain-map.md`
2. `evidence/229-v81-landing-anna-handoff-cta-authority-seam.md`
