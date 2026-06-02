---
module_id: MODULE_DOCUMENTS
doc_kind: TESTS
version: 1.0
owner: user
status: canonical
last_updated: 2026-05-11
---

# Acceptance & Tests — Dokumenty / Wordy

## Scope Of Verification (As-Is)

- Verify sidebar -> AppView -> route -> rendered component chain.
- Verify ownership/alias statements against `menuConfig.ts`, `routeConfig.ts`, `AppRoutes.tsx`.
- Verify role/guard behavior where module is protected.
- Verify chat/template handoff behavior for `/wordy` does not over-claim runtime readiness.
- Verify Stage 1.5 split-readiness: `/wordy` route identity is real, active mount is `V4ComingSoonView`, and `WordyView` is not valid mounted-route evidence.

## Required Checks

- [ ] Route opens documented runtime (`workspace` or `placeholder`) exactly as specified.
- [ ] AppView enum and route mapping are consistent in `src/types/core.ts` and `routeConfig.ts`.
- [ ] No contradiction with global ownership decisions in module docs and global docs.
- [ ] If module is placeholder, UI communicates not-ready state explicitly.
- [ ] Hard UX rules are mapped with evidence rows (`Teresa`, `Menu 3`, `next action`, `approval-before-export`).

## Current Gate Expectation

- Expected gate result today: `BLOCKED_P1 until real runtime replaces placeholder.`
- This is As-Is readiness, not target-state implementation readiness.

## Function-Level Acceptance Matrix

| Function | Acceptance focus | Runtime/code evidence | Status |
| --- | --- | --- | --- |
| `DOC_WORDY_PLACEHOLDER` | `/wordy` mounts honest placeholder runtime | `AppRoutes.tsx` -> `V4ComingSoonView` | pass |
| `DOC_STUDIO_RUNTIME_TARGET` | Target runtime remains documented as not mounted | `WordyView` imported, not route-mounted | pass (`partial`) |

## Code-vs-Docs Deep Audit Rows

| Claim | Route evidence | Component evidence | API evidence | Test evidence | Status |
| --- | --- | --- | --- | --- | --- |
| Chat redirect to `/wordy` is truthful to mounted runtime state. | `/wordy` route in `AppRoutes.tsx` | `UnifiedChatPanel` document-intent redirect + confirmation copy | n/a | dedicated UI/regression test missing | `NOT_DONE` |
| Template "use" path opens executable document runtime. | `/wordy?templateArtifactId=...` handoff path | `artifactNavigation.ts` and `WordyView.tsx` | report-builder/artifact substrate available | no front-end route assertion | `NOT_DONE` |
| Route state vocabulary is consistent across sidebar and runtime surface. | sidebar path and module route | `menuConfig.ts` (`soon`) vs `V4ComingSoonView` (`Kontakt wymagany`) | n/a | no consistency test | `NOT_DONE` |
| Existing Wordy e2e smoke test actually proves workspace rendering. | `/wordy` | placeholder page currently mounted | n/a | `deploy-gate-wordy.spec.ts` only checks non-5xx/no-console; description is stronger than assertions | `PASS_WITH_P2` |
| `WordyView` target runtime footprint proves active `/wordy` runtime. | `/wordy` route mount | `WordyView` exists and is lazy-imported, but `AppRoutes.tsx` mounts `V4ComingSoonView` | artifact APIs may exist | no deterministic mount assertion | `NOT_DONE` |

## RAW Thesis Verification Chain

| RAW thesis | Decision | Evidence | Status |
| --- | --- | --- | --- |
| Artifact-native document lifecycle is mandatory. | `KEEP` | packet + function contracts + cards (`DOC-STUDIO-*`) | `PASS_DOCS` |
| Teresa-executed document work is mandatory. | `ENHANCE` | impact-only `104` mapped in UI/behavior + execution cards | `NOT_DONE` (mounted runtime proof for draft/edit/review/read-back) |
| Menu 3/right-side action placement is mandatory. | `KEEP` + `ENHANCE` | `04_UI_UX.md` hard-rule matrix + acceptance rows | `NOT_DONE` (mounted runtime proof) |
| No fake active-runtime claim while `/wordy` is placeholder. | `ENHANCE` | deep contradiction rows + behavior register (`DGA-P0-*`) | `OPEN` |
| Approval-before-export claims require explicit state. | `KEEP` | contract rows in `04_UI_UX.md`, function cards | `NOT_DONE` |

## Critical Evidence Rows (RAW-aligned)

| Claim | Route evidence | Component evidence | API evidence | Test evidence | Status |
| --- | --- | --- | --- | --- | --- |
| Placeholder route truth is explicit and non-deceptive. | `/wordy` route map | `V4ComingSoonView` | n/a | route/navigation smoke | `PASS_DOCS` |
| Teresa can create and edit document artifacts through the `/wordy` runtime. | target `/wordy` runtime contract | command-row + conversation orchestration + document editor in active runtime | document artifact APIs | dedicated runtime interaction test for draft/edit/review/read-back | `NOT_DONE` |
| Contextual AI actions are Menu 3/right-side only (no duplicate toolbar). | target module route shell | command row right slot, no canvas duplication | n/a | UI assertion/screenshot evidence | `NOT_DONE` |
| Mandatory states expose next-action guidance. | stateful route behavior contract | loading/empty/error/degraded/success views | status read endpoints | state matrix tests/manual runbook | `NOT_DONE` |
| Review/approval is explicit before export claims. | review/export route transitions | approval card/diff/review components | artifact review/export endpoints | approval-before-export regression | `NOT_DONE` |

## Stage 1.5 Acceptance Rows

| Stage 1.5 claim | Required proof | Current status |
| --- | --- | --- |
| `/wordy` is a real route but not an active Document Studio runtime. | `routeConfig.ts` route identity + `AppRoutes.tsx` mount evidence. | `PASS_AS_IS` |
| Teresa/chat handoff copy is truthful to mounted runtime. | copy/behavior must not say work starts unless route can execute; handoff should target active runtime. | `PASS_WITH_P1` (Wave 1 reroute to Outputs active tabs; end-to-end execution evidence pending) |
| Template-use handoff is truthful to mounted runtime. | template use path should target active runtime or explicit blocked state. | `PASS_WITH_P1` (Wave 1 reroute to active runtime; full regression evidence pending) |
| Menu 3/right-side-only AI actions are enforceable. | mounted runtime component evidence. | `NOT_DONE` |
| Approval-before-export is enforceable. | route + component + API + regression evidence. | `NOT_DONE` |

## Evidence Pointers

- `src/components/navigation/Sidebar/menuConfig.ts`
- `src/routes/routeConfig.ts`
- `src/routes/AppRoutes.tsx`
- `src/types/core.ts`
- `src/components/AIChat/UnifiedChatPanel.tsx`
- `src/components/ReportsAndPresentations/artifactNavigation.ts`
- `src/utils/artifactLinks.ts`
- `src/views/V4ComingSoonView.tsx`
- `tests/e2e/smoke/deploy-gate-wordy.spec.ts`
- `tests/integration/routes/wordy-p22.pipeline.test.ts`
- `docs/modules/10_dokumenty/DEEP_RAW_GAP_AUDIT_2026-05-11.md`

## Gate Summary (Docs Pass)

- docs contract gate: `APPROVED_FOR_DOCS`
- runtime readiness gate: `BLOCKED_P1`
- quality gate decision: `PASS_WITH_P2` (docs), `INCONCLUSIVE` (runtime evidence not executed)
- deep-audit decision: `NEEDS_OWNER_DECISION` (`/wordy` standalone mount strategy)
- Stage 1.5 decision: `PASS_WITH_P1` for handoff reroute + `NEEDS_OWNER_DECISION` for standalone lane strategy
