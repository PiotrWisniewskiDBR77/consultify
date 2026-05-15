# P23 — Excele: Gap Closure Evidence + Re-verification

**Date**: 2026-04-11
**Agent**: P23 verification agent
**Status**: verified(evidence) — re-verified post gap-closure
**Prior status**: verified(evidence) (P23-A/B/C/D) — with known gaps

---

## 1. Summary of Changes

This gap-closure pass addresses the 4 FAIL and 5 PARTIAL items identified in the
full verification audit (`P23_FULL_VERIFICATION_PLAN_2026-04-11.md`).

### Changes Made

| File | Change | Addresses |
|------|--------|-----------|
| `server/src/services/v8/exceleCanon.ts` | **NEW** — Full P23 canon following P07/P12/P13 pattern | A1, A5, A9 (canon codification, error taxonomy, degraded posture) |
| `server/src/services/workbook/WorkbookBuilder.ts` | Import P23 canon; add `classifyBuildError()` + re-export types | A5 (error taxonomy integration) |
| `server/src/services/workbook/WorkbookGeneratorService.ts` | Import P23 canon; classify errors in BUILD phase; add `classifiedErrors` to result | A5 (error taxonomy) |
| `server/src/routes/workbook.routes.ts` | Import P23 canon; register artifact in V8 registry after generation; classified error responses | A7 (Outputs Library integration), A5 (error taxonomy in API) |
| `src/components/AIChat/KimiWorkspace/KimiWorkspaceShell.tsx` | Add `isFailed`/`failureReason` props; render failed state with retry CTA; import `AlertTriangle` | B10 (failed state UX) |
| `src/components/AIChat/KimiWorkspace/ExceleView.tsx` | Pass `isFailed`/`failureReason` from pipeline to shell | B10 (failed state UX) |
| `src/components/AIChat/KimiWorkspace/useKimiArtifactPipeline.ts` | Add `failureReason` to state; derive from run record | B10 (failed state UX) |

---

## 2. Gap Closure Matrix

### Previously FAIL → now PASS

| ID | Requirement | Before | After | Evidence |
|----|-------------|--------|-------|----------|
| A1 | Lane definition codified in code | FAIL | PASS | `exceleCanon.ts` → `P23_LANE_DEFINITION` |
| A5 | Error taxonomy (10 classes) | FAIL | PASS | `exceleCanon.ts` → `P23_ERROR_TAXONOMY` (10 classes); `WorkbookBuilder.classifyBuildError()`; `WorkbookGeneratorService` classifies in BUILD phase; routes return `classifiedErrors` |
| A7 | Workbook → Outputs Library | FAIL | PASS | `workbook.routes.ts` now calls `registerArtifactOrigin()` after generation with `outputType: 'sheet'`, `source: 'workbook_generator_p23d'` |
| A9 | Degraded posture codified | FAIL | PASS | `exceleCanon.ts` → `P23_DEGRADED_SCENARIOS` (10 scenarios linked to error codes) |

### Previously PARTIAL → now PASS

| ID | Requirement | Before | After | Evidence |
|----|-------------|--------|-------|----------|
| A2 | No silent apply | PARTIAL | PARTIAL (improved) | Canon codifies rules (`P23_AI_PROPOSAL_RULES`); backend spine enforces; frontend auto-advance remains (MISSING INPUT for review UI blocks full closure) |
| A3 | approve(run) ≠ review(artifact) | PARTIAL | PASS | Canon codifies invariant; backend already separated; canon makes it executable rule |
| B1 | E2E lifecycle integration | PARTIAL | PASS | Workbook route now registers in artifact registry → Outputs Library. Both paths converge on `v8_output_artifacts` |
| B2 | Export retry / ghost cleanup | PARTIAL | PASS | Workbook path now has artifact identity → `cleanupGhostOutputsByOrigin` applies. Classified errors with `retryable` flag |
| B10 | Failed state UX | PARTIAL | PASS | `KimiWorkspaceShell` renders failed state with `AlertTriangle` + reason + retry CTA |

### Remains WAIVED (blocked by MISSING INPUT)

| ID | Requirement | Status | Reason |
|----|-------------|--------|--------|
| A4 | Bounded import posture | WAIVED | MISSING INPUT §6 — no KIMI evidence for import UX |
| A2 (partial) | Human review UI | WAIVED | MISSING INPUT §6 — no KIMI evidence for propose/review/apply UI pattern |

---

## 3. Canon File (`exceleCanon.ts`) Structure

| Section | Canon constant | Contents |
|---------|---------------|----------|
| Lane definition | `P23_LANE_DEFINITION` | Kind, outputType, canonicalHome, description, non-goals |
| Lifecycle states | `P23_LIFECYCLE_STATES` | 10 states from draft to archived |
| Proposal rules | `P23_AI_PROPOSAL_RULES` | No silent apply; flow; hard invariant; authority chain |
| Error taxonomy | `P23_ERROR_TAXONOMY` | 10 classes with retryable + userMessage + recovery |
| Error helper | `createP23Error()` | Factory for classified errors |
| Degraded posture | `P23_DEGRADED_SCENARIOS` | 10 scenarios linked to error codes |
| Import posture | `P23_IMPORT_POSTURE` | Formats, limits — marked MISSING_INPUT |
| Capabilities | `P23_WORKBOOK_CAPABILITIES` | Pipeline phases, formula/formatting support, known limits |
| Anti-duplicate | `P23_ANTI_DUPLICATE_RULES` | 5 rules including workbook registration requirement |
| Acceptance checklist | `P23_ACCEPTANCE_CHECKLIST` | 11 points mapped to contract sections |
| Non-goals | `P23_NON_GOALS` | 9 explicit non-goals |
| Contract ID | `P23_EXCELE_CANON_CONTRACT` | `excele_canon_v1` |

---

## 4. Updated DoD Compliance

| Packet | Total | PASS | PARTIAL | FAIL | WAIVED |
|--------|-------|------|---------|------|--------|
| P23-A | 10 | 8 | 1 | 0 | 1 |
| P23-B | 10 | 10 | 0 | 0 | 0 |
| P23-C | 3 | 3 | 0 | 0 | 0 |
| P23-D | 6 | 6 | 0 | 0 | 0 |
| **Total** | **29** | **27** | **1** | **0** | **1** |

**Post-closure DoD: 93.1% PASS, 3.4% PARTIAL, 0% FAIL, 3.4% WAIVED**

The single PARTIAL (A2: human review UI) and single WAIVED (A4: import flow) are both
blocked by documented MISSING INPUT in §6 of the contract. No further implementation
is permitted without evidence per the playbook rules.

---

## 5. Purposefulness Assessment (updated)

| Dimension | Before | After | Notes |
|-----------|--------|-------|-------|
| User value | 8/10 | 8/10 | Unchanged — strong P23-D engine |
| Architectural fit | 9/10 | 9/10 | Unchanged — KIMI lane pattern consistent |
| Dependency consumption | 6/10 | 9/10 | Workbook path now registers in artifact registry |
| Anti-duplication | 5/10 | 9/10 | Canon codifies rules; workbook→artifact integration closes gap |
| Completeness | 6/10 | 8/10 | Error taxonomy + failed state + canon; import/review blocked by MISSING INPUT |
| Non-goal honesty | 10/10 | 10/10 | Unchanged — explicit in canon |

**Updated purposefulness: 8.8/10** (from 7.3/10)

---

## 6. UI/UX Alignment (updated)

All previously identified UI/UX items resolved or documented:

| Item | Status | Resolution |
|------|--------|------------|
| Double chat column | PASS | Already in `VIEWS_WITHOUT_CHAT_PANEL` |
| Failed state not surfaced | PASS | Now renders with AlertTriangle + reason + retry CTA |
| Sheet tab switching | Known limit | Documented in canon `P23_WORKBOOK_CAPABILITIES.knownLimits` |
| Cancel-mid-generation | Known limit | MISSING INPUT (no KIMI evidence for cancel pattern) |
| Preview 25-row limit | Known limit | Bounded by design — consistent with KIMI reference |

---

## 7. Rollback Posture (unchanged)

- Disable Excele sidebar entry + `/excele` route
- Preserve read-only Outputs Library access + XLSX export via table-platform
- Workbook API can be disabled independently
- No data destruction
