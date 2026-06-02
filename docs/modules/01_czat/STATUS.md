---
module_id: MODULE_CHAT
doc_kind: STATUS
version: 2.0
owner: user
status: canonical
last_updated: 2026-05-10
---

# Status — Czat / Teresa Chat Engine

## Status Tags (As-Is)

- `real`: `/chat` and `/chat/:conversationId` are routed and mounted in `src/routes/AppRoutes.tsx`.
- `real`: sidebar -> `AppView.AI_CHAT` mapping exists in `src/components/navigation/Sidebar/menuConfig.ts`.
- `partial`: v10 runtime path `/internal/v10-runtime` is present but separate/internal compared to main user path.
- `startup_incomplete / NO_GO`: Canvas user-facing startup path is not proven end-to-end.
- `real`: route transition coverage exists for `/chat` and `/chat/:conversationId`.
- `doc_gap`: prior baseline docs were generic and did not list concrete route/component/service evidence.

## Function Coverage Status

- `real`: `CZ_CHAT_ENGINE` documented and mapped to production chat routes/components.
- `startup_incomplete / NO_GO`: `CZ_CANVAS_WORKSPACE` documented with explicit P0/P1/P2 backlog; P0 startup evidence is still missing.
- `pass`: function contract coverage in module docs is complete (`2/2` functions documented).

## Contract Cycle Status (RAW -> Target 2.0)

- packet status: `APPROVED_FOR_DOCS_NO_GO_RUNTIME`
- module contract status: `APPROVED_FOR_DOCS_WITH_CANVAS_NO_GO`
- implementation plan status: `APPROVED_FOR_DOCS` in `IMPLEMENTATION_PLAN.md`
- gate status: market-parity rerun gate `PASS` (`npm run docs:contract:rerun-gate`)
- next sequence state intent: `APPROVED_FOR_DOCS / NO_GO_FOR_CANVAS_RUNTIME`
- owner acceptance: accepted for corrected Canvas startup scope and `NO_GO` status
- PR metadata bundle prepared in `RAW_TARGET_STATE_2_0_PACKET.md` (section "PR Gate Metadata")
- market-parity addendum: documented as target/deferred; not claimed shipped without evidence

## Runtime Notes (As-Is)

- Chat runtime includes proposal/action/citation building blocks in mounted chat components.
- Security/tenant guarantees depend on shared API + auth layers (`Api` and protected app shell), not on a standalone chat-only gate.
- Canvas/workspace bridge behavior is present in runtime components, but the actual user-facing Canvas startup path is not operationally done.
- Advanced market-parity capabilities (project instructions, shared project chat, agent run plan, artifact diff/versioning, source health UI, meeting recap, knowledge lifecycle, connector catalog) remain target/deferred until implementation evidence is added.

## Canvas Startup Closure

- Current Canvas gate: `NO_GO`.
- Required P0 path: `conversation -> canvas draft -> review_required -> accept/reject -> owner-lane read-back`.
- Runtime implementation must follow `IMPLEMENTATION_PLAN.md` priority order: P0 startup first, P1 governed expansion second, P2 preserved backlog only.
- Do not start another module until owner accepts this module status or explicitly defers Canvas startup completion as a known `NO_GO`.

## Next Implementation Decision

- Locked owner decision: P0 Canvas entrypoint is `selected chat output` (`conversation -> selected output -> canvas draft`).
- Shared `"/ai/work-canvas?kind=*"` route remains target/deferred for later phase.
- P0 implementation status: `READY_TO_IMPLEMENT` (runtime still `NO_GO` until P0 evidence passes).
