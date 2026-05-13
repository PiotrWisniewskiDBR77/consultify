---
module_id: MODULE_DOCUMENTS
doc_kind: STATUS
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-11
---

# Status — Dokumenty / Wordy

## Shipping Status (As-Is)

- Runtime class: `soon + code_gap`
- Launch path is wired in sidebar + route config, then rendered through `AppRoutes`.
- Current ownership decision: As-Is route is active in router and sidebar, but current runtime is placeholder (coming-soon).
- Docs integration decision (`2026-05-11`): `APPROVED_FOR_DOCS`.
- Runtime readiness decision (`2026-05-11`): `BLOCKED_P1` (pending runtime evidence rows).
- Deep-audit decision (`2026-05-11`): `NEEDS_OWNER_DECISION` for `/wordy` runtime strategy vs active upstream chat/template handoffs.
- Deep-RAW-audit decision (`2026-05-11`): `NEEDS_OWNER_DECISION` (hard-rule compliance is documented; runtime strategy remains unresolved).
- Stage 1.5 decision (`2026-05-11`): `NEEDS_OWNER_DECISION` for `/wordy` mount strategy; chat/template handoff is rerouted to active Outputs runtime surfaces in Wave 1.

## Current Risks

- Route exists, but behavior can diverge if imports are present and not mounted.
- Documentation must track mounted runtime, not planned/RAW target-state behavior.
- `/wordy` remains placeholder as standalone lane; Teresa/chat and template-use runtime entry now targets active Outputs delivery surfaces, not `/wordy`.

## Next Contract Work (without changing scope)

- Keep CODEMAP/BEHAVIOR/UI_UX/TESTS aligned with mounted route/component truth.
- Reclassify status only when `AppRoutes` mounts real runtime behavior on launch route.

## Function Coverage Status

- Required functions documented: `2/2`.
- Covered: `DOC_WORDY_PLACEHOLDER`, `DOC_STUDIO_RUNTIME_TARGET`.
