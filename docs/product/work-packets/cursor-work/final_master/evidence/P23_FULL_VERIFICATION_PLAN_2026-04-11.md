# P23 — Excele: Full Verification Plan + Gap Closure

**Date**: 2026-04-11
**Agent**: P23 verification agent
**Status**: verification_in_progress
**Scope**: 100% DoD compliance, purposefulness audit, UI/UX alignment, gap closure

---

## Part I — 100% DoD Compliance Audit

### Methodology

Each requirement from the contract (§2–§10) is mapped to concrete code evidence.
Status codes: `PASS` (code verified), `PARTIAL` (partially implemented), `FAIL` (not implemented), `WAIVED` (blocked by MISSING INPUT per §6).

### P23-A — Scope Approval (§2.3 Canon)

| # | Requirement | Evidence | Status |
|---|-------------|----------|--------|
| A1 | Lane definition: Excele = deliverable sheet lane, not BI/ETL/tables OS | Contract §2.3 frozen; `menuConfig.ts` P23 comment; `exceleCanon.ts` (to be created) | PARTIAL → needs canon codification |
| A2 | No silent apply: propose→review→apply is explicit | `executionSpineService.ts` has state machine; `useKimiArtifactPipeline.ts` auto-advances via timer | FAIL → auto-advance bypasses human review |
| A3 | approve(run) ≠ review(artifact) | `artifactRegistryService.ts` separates both; `approveRun` hook imported but `.mutate` never called | PARTIAL → backend OK, frontend unused |
| A4 | Bounded import posture + validation | No import flow implemented | WAIVED (MISSING INPUT §6) |
| A5 | Error taxonomy (10 classes from §7.1) | Not implemented in any P23 code file | FAIL |
| A6 | MISSING INPUT flags explicit | §6 evidence mapping has 7+ MISSING INPUT flags documented | PASS |
| A7 | Governance: home = Outputs Library (P19) | Governed table path: OK (`registerGovernedTableSheetArtifact`). Workbook path: `generated_workbooks` is parallel registry — violation | FAIL for workbook path |
| A8 | Anti-duplicate: no parallel tables OS (P15) | Excele does not create relational tables — consumes table-platform | PASS |
| A9 | Degraded posture (8+ scenarios) | Defined in contract §7.1 but not codified as `*Canon.ts` | FAIL |
| A10 | Index readiness | `EXECUTION_INDEX.md` #23 = `verified(evidence)` | PASS |

### P23-B — Lifecycle Closure

| # | Requirement | Evidence | Status |
|---|-------------|----------|--------|
| B1 | E2E lifecycle: create/materialize → persist → list/open → reopen → export | Two paths exist: (1) workbook generator with `generated_workbooks` DB + cache, (2) V8 governed table via artifact registry. Paths NOT integrated | PARTIAL |
| B2 | Export failure → retry without ghost artifacts | V8 path: `cleanupGhostOutputsByOrigin` exists and is called on failure + retry. Workbook path: no ghost cleanup (no artifact registry integration) | PARTIAL |
| B3 | KIMI split-screen: chat↔sheet | `KimiWorkspaceShell` (420px left chat + right preview); `ExceleView` wires hook | PASS |
| B4 | Preview: data table with columns + rows | HTML `<table>` with max 25 rows from table-platform API; KPI cards | PASS (bounded) |
| B5 | Download XLSX | Via `/api/table-platform/tables/{id}/export/xlsx` or `/api/workbook/{id}/download` | PASS |
| B6 | Progress bar: pipeline states | 8-step `TaskProgressBar` mapped from `ArtifactRunRecord` states | PASS |
| B7 | Replay/Remix | `handleReplay` re-runs `startGeneration(lastGoal)`; `handleRemix` resets to goal input | PASS |
| B8 | Sidebar entry | `AppView.EXCELE` in `menuConfig.ts`; `FileSpreadsheet` icon | PASS |
| B9 | Reopen via artifact link | `artifactLinks.ts`: sheet → `/excele?artifactId=${id}` | PASS |
| B10 | Integration/regression tests | `workbook.p23ext.test.ts`: 14/14 pass (schema, builder, formulas, merges, API). No frontend/KIMI tests | PARTIAL |

### P23-C — Verification + Rollout

| # | Requirement | Evidence | Status |
|---|-------------|----------|--------|
| C1 | Evidence ledger §10 filled | P23-A/B/C/D rows complete with commits, tests, staging proof, known limits | PASS |
| C2 | Rollback validated | Disable sidebar + route; preserve read-only + export | PASS |
| C3 | Known limits documented | §10 notes: no inline editing, no import, no schema gating, no code execution panel, no cancel | PASS |

### P23-D — Intelligent Workbook Builder (Extension)

| # | Requirement | Evidence | Status |
|---|-------------|----------|--------|
| D1 | WorkbookSchema (Zod): sheets[], columns[], rows[], formulas, styles, merges, freeze panes | `WorkbookSchema.ts`: complete with all fields | PASS |
| D2 | WorkbookBuilder (ExcelJS): multi-sheet .xlsx with real formulas | `WorkbookBuilder.ts`: `{ formula }` for ExcelJS, cross-sheet refs, formatting, merges, freeze | PASS |
| D3 | 5-phase LLM pipeline: plan→confirm→generate→review→build | `WorkbookGeneratorService.ts`: all 5 phases implemented with retry, repair, quality scoring | PASS |
| D4 | API: generate, download, generate-and-download, list | `workbook.routes.ts`: 4 endpoints, auth + rate limiting | PASS |
| D5 | Pipeline observability: PipelinePhaseLog[], qualityScore | Persisted in `generated_workbooks` DB table | PASS |
| D6 | Tests: 14/14 pass | `workbook.p23ext.test.ts` | PASS |

### DoD Summary

| Packet | Total checks | PASS | PARTIAL | FAIL | WAIVED |
|--------|-------------|------|---------|------|--------|
| P23-A | 10 | 3 | 2 | 4 | 1 |
| P23-B | 10 | 7 | 3 | 0 | 0 |
| P23-C | 3 | 3 | 0 | 0 | 0 |
| P23-D | 6 | 6 | 0 | 0 | 0 |
| **Total** | **29** | **19** | **5** | **4** | **1** |

**Current DoD compliance: 65.5% PASS, 17.2% PARTIAL, 13.8% FAIL, 3.4% WAIVED**

---

## Part II — Purposefulness Audit (Module in Application Context)

### Position in Program Architecture

P23 Excele is position 23/35 in the Final V8 program. Its role is:
- **KIMI lane** for bounded sheet deliverables (alongside P22 Wordy for documents, future Prezentacje for decks)
- **Consumer** of: P17 ArtifactRun (execution spine), P18 Provenance (trust-state), P19 Outputs Library (canonical home)
- **Neighbor** of: P15 Tabele (relational Tables OS — explicit non-overlap)

### Purposefulness Assessment

| Dimension | Assessment | Score |
|-----------|-----------|-------|
| **User value** | KIMI-style "chat to spreadsheet" fills a real gap — users need structured deliverables from AI. P23-D's 5-phase pipeline produces genuinely useful multi-sheet workbooks with formulas | 8/10 |
| **Architectural fit** | Follows KIMI lane pattern (same as Wordy/Prezentacje); reuses V8 artifact pipeline, split-screen shell, sidebar pattern. Consistent | 9/10 |
| **Dependency consumption** | P17/P18/P19 properly consumed via governed table path. Workbook path (P23-D) bypasses these — architectural debt | 6/10 |
| **Anti-duplication** | Governed table path: clean. Workbook `generated_workbooks` table: creates parallel artifact storage | 5/10 |
| **Completeness** | Core generation works. Lifecycle gaps (reopen, error taxonomy, human review) reduce delivered value | 6/10 |
| **Non-goal honesty** | Explicitly states "no Excel parity" — honest and bounded | 10/10 |

**Overall purposefulness: 7.3/10** — Strong concept, solid P23-D engine, but integration gaps reduce delivered value.

### Critical Purposefulness Gaps

1. **Workbook artifacts invisible in Outputs Library** — Users who generate workbooks via P23-D won't find them alongside reports/presentations. This breaks the "single home for deliverables" promise.
2. **No human review gate** — AI generates and auto-applies. For a "deliverable" module, this is below the trust bar set by P17/P18.
3. **No canon codification** — Unlike P07/P12/P13/P14 which have `*Canon.ts` files freezing rules, P23 has no canon. This means rules exist only in markdown.

---

## Part III — UI/UX Alignment Audit

### Design System Compliance

| Pattern | App standard | P23 implementation | Status |
|---------|-------------|-------------------|--------|
| **Split-screen layout** | `KimiWorkspaceShell`: 420px left chat, flex-1 right preview | Used correctly | PASS |
| **Color system** | Tailwind DBR77 neutrals + brand purple; dark mode `navy-*` | Shell uses `bg-slate-50 dark:bg-navy-950` correctly | PASS |
| **Lane accent** | Per-lane accent (purple for wordy, emerald for excele) | `getAccentForLane('excele')` → emerald variants | PASS |
| **Sidebar pattern** | `menuConfig.ts` entry with `viewId: AppView.*`, icon, label | Present with `FileSpreadsheet` icon | PASS |
| **Route pattern** | `/[module]` with lazy loading in `AppRoutes.tsx` | `/excele` with lazy `ExceleView` | PASS |
| **Progress bar** | `TaskProgressBar` shared across KIMI lanes | Used with 8 steps | PASS |
| **Chat integration** | `UnifiedChatPanel` with `mode="split"` | Used correctly | PASS |
| **Preview pane** | `ArtifactPreviewPane` with type-specific rendering | XLSX type shows table + KPIs + sheet tabs | PASS |

### UI/UX Gaps

| Gap | Severity | Description |
|-----|----------|-------------|
| **Double chat column** | Medium | On large screens, both global AI panel (MainLayout) and KIMI embedded chat render — `VIEWS_WITHOUT_CHAT_PANEL` doesn't include `EXCELE` | UX confusion |
| **Sheet tab switching non-functional** | Medium | Tabs render from `sheetNames` but clicking doesn't change `tableData` | Misleading UI |
| **Failed state not surfaced** | High | `isFailed` from hook unused in `ExceleView` — no error UI | Missing UX |
| **No cancel-mid-generation** | Low | KIMI reference shows cancel capability; not implemented | Gap vs benchmark |
| **Preview limited to 25 rows** | Low | Bounded by design but not communicated to user | Minor UX |

### Comparison with Peer KIMI Lanes

| Feature | Wordy (P22) | Prezentacje | Excele (P23) | Alignment |
|---------|-------------|-------------|-------------|-----------|
| Split-screen | Yes | Yes | Yes | OK |
| Auto-trigger | Yes (same logic) | Yes (same logic) | Yes (same logic) | OK |
| Polling interval | 3s | 3s | 3s | OK |
| Preview type | PDF iframe | Deck slides | HTML table | OK (type-specific) |
| Download | PDF | PPTX | XLSX | OK |
| Reopen via `?artifactId=` | No | Yes | Yes (route config) | OK |
| System prompt | Report-focused | Deck-focused | Spreadsheet-focused | OK |
| Failed state handling | Same gap | Same gap | Same gap | Systemic (all lanes) |

---

## Part IV — Gap Closure Implementation Plan

### Priority 1: Canon codification (P23 `exceleCanon.ts`)

**File**: `server/src/services/v8/exceleCanon.ts`
**Pattern**: Follow P07 `notebookCanon.ts` (most structured canon)

Contents:
- `P23_LANE_DEFINITION` — frozen lane definition constants
- `P23_LIFECYCLE_STATES` — sheet artifact lifecycle
- `P23_ERROR_TAXONOMY` — 10 classes from §7.1 with `retryable` + `userMessage`
- `P23_DEGRADED_SCENARIOS` — 10 scenarios from §7.1
- `P23_AI_PROPOSAL_RULES` — propose→review→apply rules
- `P23_ANTI_DUPLICATE_RULES` — no parallel registry/tables OS
- `P23_NON_GOALS` — explicit non-goals
- `P23_ACCEPTANCE_CHECKLIST` — frozen acceptance checklist
- `P23_WORKBOOK_CAPABILITIES` — bounded capabilities declaration

### Priority 2: Error taxonomy integration

**Files**: `server/src/services/workbook/WorkbookBuilder.ts`, `WorkbookGeneratorService.ts`
- Import and use `P23_ERROR_TAXONOMY` for classified errors
- Wrap existing error paths with taxonomy codes
- Return structured errors to routes

### Priority 3: Workbook → Artifact Registry integration

**File**: `server/src/routes/workbook.routes.ts`
- After successful generation, call `artifactRegistryService.registerArtifactOrigin` with `outputType: 'sheet'`
- Remove parallel `generated_workbooks` table dependency for artifact identity (keep for schema storage)
- Ensure workbooks appear in Outputs Library

### Priority 4: Failed state UX in ExceleView

**File**: `src/components/AIChat/KimiWorkspace/ExceleView.tsx`
- Consume `pipeline.isFailed` + `pipeline.failureReason`
- Pass to `KimiWorkspaceShell` for error display

### Priority 5: Excele in `VIEWS_WITHOUT_CHAT_PANEL`

**File**: `src/layouts/MainLayout.tsx`
- Add `AppView.EXCELE` to `VIEWS_WITHOUT_CHAT_PANEL` to prevent double chat column

---

## Part V — Acceptance Gate (post-implementation)

After gap closure, re-run the DoD matrix. Target: **100% PASS** (except WAIVED items blocked by documented MISSING INPUT).

Expected final state:
- P23-A: 10/10 (6 PASS + 3 now-PASS + 1 WAIVED)
- P23-B: 10/10 (all PASS)
- P23-C: 3/3 (all PASS)
- P23-D: 6/6 (all PASS)
