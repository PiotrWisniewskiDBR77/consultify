---
module_id: MODULE_PRESENTATIONS
doc_kind: BEHAVIOR
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-09
---

# Behavior — Prezentacje / Generator Lane

## As-Is Runtime Behavior

- Route `/prezentacje` exists as standalone generator lane but currently shows placeholder state.
- Route family `/presentations` is active and owned by Outputs (`09_outputs`) as canonical presentations library/runtime.
- Legacy/related report routes redirect into `/presentations?tab=documents`, reinforcing Outputs ownership.

## Function Runtime Breakdown

- `PR_GEN_PLACEHOLDER`: active standalone lane function on `/prezentacje`.
- `PR_GEN_RUNTIME_TARGET`: target generator runtime function, currently not mounted.
- `PR_OUTPUTS_OWNERSHIP_BOUNDARY`: explicit boundary function preserving ownership split with module 09.

## Deep Audit — Code vs Docs (2026-05-11)

Code-backed As-Is map:

- `/prezentacje` -> `V4ComingSoonView` (protected, blocked lane).
- `/presentations` -> `ReportsAndPresentationsHub` (active Outputs runtime).
- `/presentations/wizard` -> `PresentationWizard` (active).
- `/presentations/builder/:deckId` -> `DeckBuilder` (active).
- `PrezentacjeView` is imported but not mounted on `/prezentacje`.

Key behavior gaps identified:

- `P0`: `/prezentacje` placeholder copy does not explicitly hand off users to `/presentations`, despite ownership doctrine in module docs.
- `P1`: stale evidence path appears in function contracts (`src/router/routeConfig.ts` vs real `src/routes/routeConfig.ts`).
- `P1`: blocked lane state semantics are not explicitly tied to ownership handoff behavior in the placeholder UX.

## Teresa Rule Status (Impact-Only Source)

- source: `docs/UI_UX/104_RAW_CONVERSATIONAL_WORK_OS_TERESA_CHAT_ENGINE_2026-05-09.md` (`impact-only`)
- module-12 status: `EXPLICIT_OWNER_DECISION_REQUIRED`
- value: `PENDING_OWNER_DECISION`
- note: this pass does not silently close the rule; closure must be explicit (`impact-only` or `mandatory-for-target-runtime`).

## Stage 1.5 Ultra-Deep Runtime Ownership Map (2026-05-11)

Source: `STAGE_1_5_ULTRA_DEEP_GAP_AUDIT_2026-05-11.md`.

| Surface | Ownership lane | Current behavior | Decision |
| --- | --- | --- | --- |
| `/prezentacje` | `12_prezentacje` | protected placeholder via `V4ComingSoonView` | `KEEP + ENHANCE` |
| `AppView.PREZENTACJE_GEN` | `12_prezentacje` | maps to `/prezentacje`; sidebar badge `soon` | `KEEP` |
| `/presentations` | `09_outputs` | active Outputs Library hub | `KEEP_AS_09_RUNTIME` |
| `/presentations/wizard` | `09_outputs` runtime tool | active presentation wizard | `KEEP_AS_09_RUNTIME` |
| `/presentations/builder/:deckId` | `09_outputs` runtime tool | active deck builder/editor | `KEEP_AS_09_RUNTIME` |
| `PrezentacjeView` | `12_prezentacje` target candidate | imported but not mounted | `NEW_DOC_TARGET + DEFER_RUNTIME` |

Stage 1.5 behavior conclusion:

- Module 12 owns the standalone `/prezentacje` lane and target generator doctrine.
- Module 09 owns the active production `/presentations` library/runtime family.
- Module 12 may reference `/presentations` as active dependency/handoff path, but must not claim it as shipped lane-12 runtime.
- Runtime edits remain out of scope for this docs-only cycle.

## Must

- MUST keep route/appview/sidebar mapping aligned across `menuConfig.ts`, `routeConfig.ts`, and `AppRoutes.tsx`.
- MUST preserve module ownership boundaries defined in global operating docs.
- MUST expose blocked/placeholder state honestly when runtime is not yet mounted.
- MUST show `/prezentacje` and `/presentations` as separate ownership lanes in docs and acceptance evidence.
- MUST treat Teresa deck-work execution doctrine as `PENDING_OWNER_DECISION` until explicitly closed.

## Must Not

- MUST NOT treat target-state RAW assumptions as current behavior.
- MUST NOT move ownership from canonical module boundaries documented in As-Is global docs.
- MUST NOT hide route aliasing or legacy surfaces from module contract narrative.
- MUST NOT claim `/presentations` hub/wizard/builder as module-12 shipped runtime.
- MUST NOT close Menu 3/right-side AI action compliance without function-level evidence.

## Acceptance Criteria (Behavior)

- [ ] Direct navigation to launch route resolves to documented current runtime.
- [ ] AppView-to-route mapping resolves to the same module owner.
- [ ] Cross-module ownership statements match global resolved decisions.
