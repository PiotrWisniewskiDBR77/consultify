---
module_id: MODULE_INTERVIEW
doc_kind: VERIFICATION_REPORT
scope_anchor: 03_wywiad/CREATORS_E2E_VERIFICATION
owner_business: user
owner_tech: user
status: GO_WITH_CONDITIONS
last_updated: 2026-05-10
---

# Interview Creators Verification Report

## 0. Closure Update — 2026-05-10

Closure scope: `03_wywiad/CREATORS_E2E_VERIFICATION`.

Result after remediation: `GO_WITH_CONDITIONS`.

Remediation summary:

- Added a dedicated Interview `Inicjatywy` / `Initiatives` lane in `InterviewHub` as a source-aware candidate review surface.
- The lane does not create hidden initiatives. It presents interview-derived candidates from existing insights and routes users into explicit source review and handoff in `InsightViewer`.
- Added `initiatives` to shared `ModuleHub` tab typing.
- Aligned module documentation indexes: `README.md` now lists `WY_INITIATIVES`; `05_DATA_AND_INTEGRATIONS.md` now defines `WY_INITIATIVES` data and handoff responsibility.
- Aligned P10 confidence tests with the current canon where `contradicted` is a core confidence level and still blocks automatic handoff.
- Fixed `InsightViewer` handoff test harness so N-mode content renders.
- Fixed legacy Interview API smoke setup to respect `E2E_MOCK_DB`.
- Fixed `InterviewController.updateSession` so status-only updates are applied before the `No updates provided` gate, while preserving the assignment-backed session workflow guard.

Validation after remediation:

| Command | Result | Evidence |
| --- | --- | --- |
| `npm run docs:contract:rerun-gate` | `PASS` | 19 modules, 77 function contracts, 0 errors, 0 warnings. |
| Focused Interview Vitest package | `PASS` | 13 files passed, 183 tests passed. |
| `deploy-gate-api-interview.spec.ts` smoke E2E | `PASS` | 20/20 tests passed. |
| IDE lint check for touched files | `PASS` | No linter errors found. |

Remaining conditions before `GO_NOW`:

- Add a dedicated UI regression for the new `WY_INITIATIVES` tab itself, beyond the existing handoff/source tests.
- Add full P2 cross-flow E2E for `sessions -> insights -> initiatives -> handoff/read-back`.
- Confirm product wording for whether the lane is called `Inicjatywy`, `Initiatives`, or uses a route key exposed as `initiatives`.

## 1. Executive Verdict: `NO_GO`

Verification scope: `03_wywiad/CREATORS_E2E_VERIFICATION`.

Mode: verification-only. No runtime code was changed.

Final verdict is `NO_GO` for further Interview creators rollout. The docs gate passes, and many backend/API tests for Interview assignments, insights, findings, candidates and handoff pass. However, the runtime and test evidence do not support a hard `GO` because:

- `WY_INITIATIVES` is contracted as a real Interview initiatives lane, but `InterviewHub` runtime does not define or render a dedicated `initiatives`/`inicjatywy` tab.
- The focused Interview test pack fails: 4 files failed, 8 tests failed, 183 passed, 6 skipped.
- The Interview API smoke E2E fails because a newly created interview session returns no question id, blocking the session/question flow.
- P10 insight confidence semantics are inconsistent between runtime contract/tests: `contradicted` is accepted as a core confidence level while tests still expect only 4 core levels.

Read-order note: `.cursor/SOURCE_OF_TRUTH_INDEX.md` was not present inside `consultify/.cursor`, so the workspace-level `.cursor/SOURCE_OF_TRUTH_INDEX.md` was used.

## 2. Coverage Matrix

| Area | Status | Evidence | Notes |
| --- | --- | --- | --- |
| Docs contract gate | `PASS` | `npm run docs:contract:rerun-gate` -> 19 modules, 77 function contracts, 0 errors, 0 warnings | Documentation structure is syntactically gate-clean. |
| Route evidence | `PASS_WITH_GAPS` | `src/routes/AppRoutes.tsx` mounts `InterviewHub` for `/discovery`, `/interview`, `/project-intelligence`; `src/routes/routeConfig.ts` defines `INTERVIEW` and `DISCOVERY_CONSULTANT` | Routes converge correctly, but there is no route/tab evidence for dedicated `WY_INITIATIVES`. |
| Sidebar/Menu entry | `PASS` | `src/components/navigation/Sidebar/menuConfig.ts` maps `INTERVIEW` to `AppView.DISCOVERY_CONSULTANT` | Top-level Interview entry exists. |
| Runtime tabs | `FAIL` | `src/components/Interview/InterviewHub.tsx` `InterviewTab` union only includes `my_assignments`, `sessions`, `templates`, `insights`, `managed`, `pending_review`; tabs builder does not push initiatives | Contract says `WY_INITIATIVES` is real, but runtime lane is `NOT_IMPLEMENTED`. |
| Initiative creator | `NOT_IMPLEMENTED` | `docs/modules/03_wywiad/functions/WY_INITIATIVES.md`; no dedicated `InterviewHub` initiatives tab/runtime state; handoff exists inside `InsightViewer` | There is an insight-to-initiative handoff modal, but not the contracted Interview initiatives creator/lane. |
| Initiative provenance/handoff | `PARTIAL` | `src/services/api/v8/interview.ts` exposes `handoffFinding`; `server/src/services/v8/interviewInsightFindingsService.ts` builds and records handoff payloads with evidence pointers | Backend handoff skeleton/provenance exists. Dedicated creator review/read-back UX is not proven. |
| Insight creator | `PARTIAL_PASS` | `InterviewHub` uses `InsightCreatorModal`, `V8InterviewApi.createInsight`, `listInsights`; focused tests include `InsightCreatorModal.error-state.test.ts` pass | Create/list/read paths are covered, but P10 confidence tests fail. |
| Insight review flow | `PARTIAL_PASS` | `server/src/routes/v8/interview-insights.routes.ts` lifecycle endpoint requires review/publish permissions and validates transitions | Permissioned lifecycle exists; confidence semantics mismatch blocks rollout confidence. |
| Pending review | `PASS_WITH_GAPS` | `InterviewHub` derives `pendingReviewInsights` from `reviewStatus/status === in_review`; `WY_PENDING_REVIEW` contract is permission-gated | Runtime path exists; no full cross-flow UI E2E proving submit -> pending review -> publish. |
| Templates/topics creator | `PARTIAL_PASS` | `InterviewHub` loads `/interview/templates`, question preview via `/interview/templates/:id/questions`, clone/delete actions | Template list and preview paths exist. No dedicated test proves template/topic -> insight/initiative flow. |
| Sessions -> questions E2E | `FAIL` | `deploy-gate-api-interview.spec.ts` failed at `GET /api/interview/sessions/:sessionId/questions returns questions array`; `firstQuestionId` was empty | Blocks session/question smoke flow and downstream update assertions. |
| Assignments -> review | `PASS` | `InterviewAssignmentsController.test.ts` passed 8/8; V8 interview routes passed assignment start/submit/send-back/approve/revoke/archive envelope tests | Backend assignment/review state transitions are covered. |
| Role/tenant safety | `PARTIAL_PASS` | `useInterviewPermissions.test.ts` passed; routes use `requirePermission`; lifecycle publish checks `INTERVIEW_INSIGHTS_PUBLISH`; tests include outside-org 404 for candidates | No P0 tenant leak found. Coverage remains incomplete for dedicated `WY_INITIATIVES` because lane is not implemented. |
| Automated test evidence | `FAIL` | Focused Vitest: 4 failed files, 8 failed tests, 183 passed, 6 skipped. E2E smoke: 7 passed, 1 failed, 12 did not run | Failing tests block `GO_NOW`. |

## 3. Findings By Severity

### P0

| ID | Finding | Evidence | Impact | Required action |
| --- | --- | --- | --- | --- |
| `QA-WY-CREATORS-P0-001` | Contract says Interview initiatives are a real `WY_INITIATIVES` function, but runtime has no dedicated initiatives tab/lane. | `04_UI_UX.md` and `WY_INITIATIVES.md` define the lane; `InterviewHub.tsx` tab union and tab builder omit initiatives. | Initiative creator cannot be verified end-to-end. This is `NOT_IMPLEMENTED`, but it prevents rollout of the contracted creator area. | Implement or downgrade docs status from real to planned before rollout. |
| `QA-WY-CREATORS-P0-002` | P10 confidence semantics are inconsistent. | `P10_CONFIDENCE_LEVELS` contains 5 values including `contradicted`; tests expect exactly 4 core levels and expect `isValidP10ConfidenceLevel('contradicted')` to be false. | Status/confidence contract affects publish/handoff gating and can change CTA availability. | Decide whether `contradicted` is core or extended, then align canon, validators, UI and tests. |
| `QA-WY-CREATORS-P0-003` | Interview API smoke flow fails after session creation because no question id is returned. | Playwright smoke failed: `GET /api/interview/sessions/:sessionId/questions returns questions array`, `firstQuestionId` was empty; 12 later tests did not run. | Cross-flow session -> questions -> answer/update -> completed session is not rollout-ready. | Ensure created sessions have usable questions or define/recover empty-question behavior in smoke contract. |

### P1

| ID | Finding | Evidence | Impact | Required action |
| --- | --- | --- | --- | --- |
| `QA-WY-CREATORS-P1-001` | `InsightViewer.p10-handoff.test.tsx` fails because its `NModeHeader` mock lacks the default export expected by `NModeShell`. | Vitest unhandled error: `No "default" export is defined on the "@/components/shared/NModeLayout/NModeHeader" mock`. | Handoff component evidence is inconclusive; may be test harness drift, but it masks real UI regressions. | Fix test harness/mock, then rerun `InsightViewer` handoff tests. |
| `QA-WY-CREATORS-P1-002` | `README.md` function coverage does not list `WY_INITIATIVES`. | `docs/modules/03_wywiad/README.md` lists six functions and omits `WY_INITIATIVES`; other docs include it. | Contract index is inconsistent and can mislead future agents. | Update module README after owner confirms `WY_INITIATIVES` remains a function. |
| `QA-WY-CREATORS-P1-003` | `05_DATA_AND_INTEGRATIONS.md` groups only sessions/templates/insights and does not define data responsibility for `WY_INITIATIVES`. | Data contract table lacks `WY_INITIATIVES`. | Provenance and handoff responsibilities are under-specified at data layer. | Add Interview initiatives data row covering candidate envelope, handoff payload and downstream ownership. |

### P2

| ID | Finding | Evidence | Impact | Required action |
| --- | --- | --- | --- | --- |
| `QA-WY-CREATORS-P2-001` | Legacy `/api/interview` integration route tests are skipped. | `tests/integration/interview/interview-routes.test.ts` reported 6 skipped tests. | Lower confidence in old endpoint unauthorized behavior. | Decide whether legacy routes are still supported; either reactivate or archive tests. |
| `QA-WY-CREATORS-P2-002` | No dedicated UI E2E covers Interview creators across sessions, templates, insights, review and initiatives. | `07_ACCEPTANCE_AND_TESTS.md` already marks this as missing P2 E2E package. | Full rollout cannot be marked test-complete. | Add P2 E2E after P0/P1 closure. |

## 4. Contract Mismatches

| Contract claim | Runtime/test evidence | Verdict |
| --- | --- | --- |
| `WY_INITIATIVES` is real and visible as Interview `Inicjatywy` lane. | No `initiatives`/`inicjatywy` tab in `InterviewHub`; no runtime state/list for interview initiative candidates. | `MISMATCH_P0` |
| Initiative creator supports 0..N candidates with accept/edit/reject/defer. | No dedicated creator component/state found in Interview runtime. Existing handoff modal creates/links from published findings, not a full candidate creator lane. | `MISMATCH_P0` |
| Every candidate preserves source/provenance envelope. | Backend finding handoff payload preserves source/finding/evidence pointers; no dedicated candidate lane UI evidence. | `PARTIAL` |
| Insight creator supports create/list/read/review. | API and UI paths exist; many tests pass; confidence contract tests fail. | `PARTIAL` |
| Pending review is permission-gated and explicit. | Runtime conditionally shows pending review from `canReviewInsights`; backend lifecycle requires review/publish permissions. | `PASS_WITH_GAPS` |
| Templates support list/preview/use in sessions. | Runtime loads templates and questions; E2E session questions smoke fails before downstream flow can complete. | `PARTIAL_FAIL` |

## 5. Risk Register

| Risk | Severity | Owner | Next action | ETA |
| --- | --- | --- | --- | --- |
| Contracted Interview initiatives lane absent in runtime | `P0` | Product + FE lead | Decide implement vs downgrade docs, then align route/tab/API/test evidence | Before rollout |
| P10 confidence semantics drift | `P0` | Backend lead + QA | Align core/extended confidence levels and rerun P10 tests | Before rollout |
| Session questions smoke failure | `P0` | Backend lead | Ensure created sessions receive usable questions or define supported empty-session recovery | Before rollout |
| Handoff UI test harness broken | `P1` | FE QA | Fix `NModeHeader` mock/default export mismatch and rerun handoff tests | Next QA cycle |
| Module docs index omits `WY_INITIATIVES` | `P1` | Docs owner | Update `README.md` and `05_DATA_AND_INTEGRATIONS.md` once runtime decision is locked | Next docs sync |
| Missing full creators E2E suite | `P2` | QA lead | Add cross-flow E2E after P0/P1 closure | P2 hardening |

## 6. Test Execution Evidence

| Command | Result | Evidence |
| --- | --- | --- |
| `npm run docs:contract:rerun-gate` | `PASS` | Checked modules: 19; function contracts: 77; errors: 0; warnings: 0; report: `test-results/module-contract-gate/module-contract-gate.md`. |
| `npx vitest run ...interview focused files...` | `FAIL` | 4 failed files, 11 passed files; 8 failed tests, 183 passed, 6 skipped; 13 unhandled errors. Key failures: P10 confidence semantics and `InsightViewer` handoff test harness. |
| `CI=true E2E_MODE=true E2E_USE_WEB_SERVER=true ... npx playwright test ...deploy-gate-api-interview.spec.ts` | `FAIL` | 20-test smoke: 7 passed, 1 failed, 12 did not run. Failure: created session returned no usable first question id. |

## 7. Final Readiness Decision: `NO_GO`

Decision: `NO_GO`.

Rationale:

- No P0 security/tenant boundary breach was observed in the sampled evidence.
- Provenance exists partially for insight findings and backend handoff payloads.
- However, the contracted initiative creator lane is `NOT_IMPLEMENTED` in runtime, focused tests fail, and the Interview API smoke flow fails before completing session/question coverage.

Rollout can move to `GO_WITH_CONDITIONS` only after:

1. `WY_INITIATIVES` runtime decision is resolved and docs/runtime/tests are aligned.
2. P10 confidence semantics pass.
3. Interview session/questions smoke passes.
4. Handoff UI tests are runnable and green.
