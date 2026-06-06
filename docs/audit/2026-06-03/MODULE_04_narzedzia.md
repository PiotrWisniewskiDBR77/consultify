# Module 04 — Narzędzia — Re-Audit (2026-06-03)

**Readiness: 65/100 — Tier: Beta (baseline 52 → 65, Δ +13)**
**One-line verdict:** Critical "Step content not implemented yet" fallback eliminated; 14 tools genuinely launchable with all steps covered; 17 hidden tools cleanly double-gated by `isComingSoon: true` + `ACTIVE_KNOWN_TOOL_TYPES`; Megatrends error/empty UI complete but seed not in prod migration runner; cross-module handoffs server-wired. Remaining gaps: `ToolWizardView` is dead code (not mounted), ADMA/CMMI/LEAN create sessions without server-side guard, megatrend seed skipped by migrations-v2, `isComingSoon` upsert bypassed on existing DBs ≥31 tools.

---

## Functionality — tool count: working / hidden / broken

**ACTIVE_KNOWN_TOOL_TYPES** (`server/src/services/KnownToolsService.ts:199–217`) declares exactly 14 launchable tools. All 17 others carry `isComingSoon: true` in the seed.

**14 ship tools — step coverage verified in `ToolCanvas.tsx`:**
- 5 full-phase strategic: `dynamic-swot`, `market-forces`, `growth-paths`, `portfolio-priority`, `risk-uncertainty` — dedicated per-phase components with AI card governance (`ToolCanvas.tsx:128–540`)
- 5 operational with domain steps: `sop-builder` → `SOPStandardsStep`/`SOPChecklistsStep`; `a3-problem-solving` → `A3ProblemStep`/`A3RootCauseStep`/`A3CountermeasuresStep`; `smed-planner`, `dms-builder`, `inventory-autopilot` — resolved in `ToolCanvas.tsx:542–588`
- 3 digital via `GenericDomainStep` (`ToolCanvas.tsx:590–609`): `ai-discovery` (use-cases / prerequisites / pilot-plan), `pain-explorer` (problems / hypotheses / evidence-gaps), `rpa-scanner` (candidates / sizing / backlog)
- `process-automation` — `ProcessMapWorkSurface` + measurement/economics steps (`ToolCanvas.tsx:260–282`)

All 14 ships: every step ID dispatches to a real component before reaching the graceful fallback at `ToolCanvas.tsx:668`. **No shipped tool reaches "not implemented" UI.**

**17 hidden tools cleanly disabled:** `value-chain`, `ambition-decomposer`, `focus-tradeoff`, `capability-mapper`, `narrative-engine`, `vsm-builder`, `constraint-control`, `decision-engine`, `control-tower`, `automation-pipeline`, `robotics-feasibility`, `logistics-automation`, `integration-diagnostic`, `digital-value-pool`, `legacy-analyzer`, `data-inventory`, `pain-to-solution`. Gate: `KnownToolPreviewV3.tsx:564` disables start button; `DiscoveryToolsHub.tsx:2305` returns early on double-check.

**"Step content not implemented yet" — GONE.** Replaced by on-brand graceful panel (`ToolCanvas.tsx:668–681`), belt-and-suspenders only.

**Assessment:** 5 frameworks (DRD, SIRI, ADMA, CMMI, LEAN) with dedicated editors and report templates. DRD + SIRI fully functional. ADMA/CMMI/LEAN editors exist in code but have no `isComingSoon` gate in `assessmentTemplateItems` (`DiscoveryToolsHub.tsx:2522` — all hardcoded `isComingSoon: false`), and `createAndOpenAssessmentSession` (`DiscoveryToolsHub.tsx:2223`) passes any framework type to the server without validation. Server `POST /api/assessments` (`assessments.routes.ts:123`) creates rows for any type, so ADMA/CMMI/LEAN sessions can be created and open to editor shells with no meaningful content.

**Megatrends:** Routes live, store wired, `IndustryBaselineCard.tsx:57–63` shows explicit error panel on 503. But `megatrends` table has no seed in the prod migration runner (migrations-v2 tops at `037_work_canvas_runtime.sql`). Seed migration `20260608_megatrends_seed.sql` exists only in legacy `server/migrations/`; fresh Postgres deployments show empty-state permanently.

---

## Intra-module flow & states

Launch: Library → `KnownToolDetailView` → session create → `ToolDocumentView`. Loading spinner present, auto-save debounced 1500ms (`ToolWorkspace.tsx:395`). Status lifecycle DRAFT→IN_PROGRESS→REVIEW→APPROVED/FINALIZED wired via `CanonicalToolSessionStatus`.

**`ToolWizardView` is dead code.** File exists at `src/components/DiscoveryTools/ToolWizardView.tsx` and wraps `ToolWizardShell`, but is not imported in `DiscoveryToolsHub.tsx` or any routing file. The new wizard lifecycle (finalize, output promotion, missingItems normalization defined in `ToolWizardView.tsx`) is unreachable in production.

DoD gap detection present for `dynamic-swot`, `market-forces`, `growth-paths` in `ToolWorkspace.tsx:241–296`. Other 11 ship tools have no completeness gate before REVIEW.

---

## UI/UX adherence

`DiscoveryToolsHub` uses approved `ModuleHub` shell, `FilterableTable`, `GridView`. `ToolWorkspace + ToolCanvas + ToolHeader + ToolActionBar` form consistent shell: `navy-950` bg, `primary-600` accents, `rounded-xl/2xl`, dark-mode throughout. `MegatrendsWorkspace` uses its own tab layout (not ModuleHub shell) but is self-consistent. Three `as any` casts in `ToolWorkspace.tsx` are isolated. `GenericDomainStep` renders a flat structured-list form — functional but lacks the per-phase wizard chrome of the strategic tools.

---

## Cross-module handoffs

Tools→Initiatives: `Api.promoteToolOutput` → `POST /tools/:toolId/promote` (`tools.routes.ts:52`). `Api.generateToolInitiatives` → `POST /tools/:toolId/generate-initiatives` (`tools.routes.ts:55–58`). Initiative opens inline via `setActiveDocumentId` → `InitiativeDocumentView`. Path server-wired and complete.

Assessment→Initiatives: `POST /api/assessments/:id/generate-initiatives` at `assessments.routes.ts:254`. `TransferToRoadmapModal` present (`assessment/modals/TransferToRoadmapModal.tsx`). Entry door: Tools Library "Assessment" category + `/assessment/*` route — two separate shells coexist.

---

## Risks / regressions / runtime

1. **`ToolWizardView` dead code** — `ToolWizardView.tsx` not imported anywhere. Wizard lifecycle (output promotion, finalize flow) unreachable.
2. **Megatrend seed not in migrations-v2** — `20260608_megatrends_seed.sql` absent from the prod Postgres runner; fresh deployments show empty state permanently despite table existing.
3. **`isComingSoon` upsert skipped on existing DBs** — `KnownToolsService.ts:707`: `if (existing >= SQLITE_KNOWN_TOOLS_SEED.length) return` skips the entire upsert loop. Existing DBs with ≥31 tools will not receive Wave 1 `isComingSoon: true` corrections, potentially leaving formerly-stub tools as launchable.
4. **ADMA/CMMI/LEAN not gated** — `assessmentTemplateItems` hardcodes `isComingSoon: false` for all 5 frameworks; server accepts any type. Clicking ADMA/CMMI/LEAN in the Library creates a real session that opens an empty editor.
5. **5 hidden strategic tools share Porter data model** — `useToolStore.ts:1736–1742` maps `value-chain`, `capability-mapper`, etc. to `createInitialPorterData`; if gating fails they open a Market Forces UI labeled incorrectly.
6. **No frontend unit tests for assessment/megatrend** — 2 smoke tests exist (`toolCanvas.smoke.test.tsx`, `genericDomainStep.smoke.test.tsx`); assessment editors and megatrend workspace have zero coverage.

---

## Top remaining gaps (prioritized)

1. **Add `20260608_megatrends_seed.sql` to migrations-v2** — the only missing step; table and routes are ready.
2. **Fix seed count-guard** — replace the `existing >= SQLITE_KNOWN_TOOLS_SEED.length` short-circuit with always-running upsert to ensure `is_coming_soon` corrections propagate to existing DBs.
3. **Gate ADMA/CMMI/LEAN** — either mark them `isComingSoon: true` in `assessmentTemplateItems` or add a server-side check in `POST /api/assessments` rejecting unsupported framework types.
4. **Wire `ToolWizardView`** into `DiscoveryToolsHub` or delete it — the current state is a latent dead-code regression.
5. **DoD gap detection for 11 non-strategic ship tools** — `sop-builder`, `a3-problem-solving`, `dms-builder`, `smed-planner`, `inventory-autopilot`, 3 digital tools, `process-automation` have no completeness gate before REVIEW.
6. **Unify `AssessmentHub` into `DiscoveryToolsHub`** — `/assessment/*` route opens a separate shell; users see two inconsistent entry points.
