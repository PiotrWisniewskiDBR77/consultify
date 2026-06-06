# COMPLETION DOSSIER — Module 04: Narzędzia / Tools + Assessment

**Audit date:** 2026-06-03  
**Score trajectory:** 52 (2026-06-02 audit) → 65 (2026-06-03 re-audit) → **current: ~65/100**  
**Gap to 100%:** 35 points across 11 concrete items  

---

## 1. Purpose / Goal / Vision

Module 04 is the **consulting-grade tools and frameworks engine** of Consultify. Vision (from `docs/modules/04_narzedzia/01_PURPOSE.md`, `02_SCOPE.md`, `functions/NZ_*.md`):

- Consultant launches a named tool session (SWOT, Porter, Ansoff, SOP, A3, etc.) inside a project; Teresa helps frame the mission, find signals, build analysis cards, synthesize insights, and finalize outputs — all governed by a proposal→review→approve lifecycle.
- Output is a persistent **source object** (tool session) that feeds initiatives, roadmap, reports, and deliverables with full traceability — never a dead-end form.
- **Assessment lane** (`NZ_ASSESSMENT_HUB`): DRD/SIRI/ADMA/CMMI/LEAN licensed frameworks run through structured evidence editors, produce maturity reports with AI-assisted section generation, and hand off to initiatives via `TransferToRoadmapModal`.
- **Megatrends lane** (`NZ_MEGATRENDS_WORKSPACE`): industry baseline + custom trend tracking seeded from a curated DB, with radar visualization and AI-derived strategic insights.
- **Entry-door role**: module is the canonical bridge from diagnostic/discovery context (Module 03) to the actionable initiative backlog (Module 05) — every consulting engagement is expected to run at least one tool or assessment.

At 100%: consultant starts a tool from the library, Teresa co-pilots every phase with real streaming AI suggestions, the output auto-promotes to initiatives with one click, all frameworks are gated/available correctly, and Megatrends is populated and actionable from first install.

---

## 2. Readiness to 100% — Score and Gap

**Current honest score: 65/100**

What moved the score from 52 → 65 (+13):
- "Step content not implemented yet" fallback eliminated; 14 launchable tools all dispatch to real components (`ToolCanvas.tsx:668`)
- 17 hidden tools double-gated: `isComingSoon: true` in seed + `ACTIVE_KNOWN_TOOL_TYPES` set guard (`KnownToolsService.ts:199–217`) + start-button disable (`KnownToolPreviewV3.tsx:564`)
- `GenericDomainStep` created for 3 digital tools: `ai-discovery`, `pain-explorer`, `rpa-scanner` (`ToolCanvas.tsx:590–609`)
- 5 operational tools get domain-specific step components: SOP, A3, SMED, DMS, Inventory (`ToolCanvas.tsx:542–588`)
- Seed count-guard removed — upsert loop always runs with ON CONFLICT DO UPDATE (`KnownToolsService.ts:705–734`)
- Megatrends error panel on 503 (`IndustryBaselineCard.tsx:57–63`)

**Remaining gap (35 points):**

| Gap | Points | Evidence |
|-----|--------|----------|
| Megatrend seed not in migrations-v2 | 7 | `server/migrations-v2/` tops at `037_work_canvas_runtime.sql`; `20260608_megatrends_seed.sql` only in legacy `server/migrations/` |
| Teresa AI missing for 9 non-strategic ship tools | 7 | `useToolAI.ts:386–440` rethink + apply paths guard on `dynamic-swot/market-forces/growth-paths/portfolio-priority/risk-uncertainty` only; `sop-builder`, `a3-problem-solving`, `smed-planner`, `dms-builder`, `inventory-autopilot`, `ai-discovery`, `pain-explorer`, `rpa-scanner`, `process-automation` have no `find-signals`, `build-analysis`, or `rethink` handlers |
| ADMA/CMMI/LEAN not gated | 5 | `DiscoveryToolsHub.tsx:2516` hardcodes `isComingSoon: false` for all 5 assessment frameworks; server `POST /api/assessments` (`assessments.routes.ts:123`) accepts any type — creates real sessions opening empty editors |
| `ToolWizardView` dead code | 5 | `src/components/DiscoveryTools/ToolWizardView.tsx` exists (155 LOC) — not imported anywhere in routing or hub; wizard lifecycle (finalize, output promotion, missingItems normalization) unreachable in production |
| DoD gap detection for 11 non-strategic ship tools | 4 | `ToolWorkspace.tsx:241–296` only checks `dynamic-swot`, `market-forces`, `growth-paths`; `sop-builder`, `a3-problem-solving`, `dms-builder`, `smed-planner`, `inventory-autopilot`, 3 digital tools, `process-automation` proceed to REVIEW with no completeness gate |
| `AssessmentHub` not unified into `DiscoveryToolsHub` | 3 | `/assessment/*` route (`AppRoutes.tsx:1644–1652`) renders separate `AssessmentHub` shell; `/tools` route renders `DiscoveryToolsHub`; two inconsistent UX shells for the same licensed category |
| Megatrends has zero Teresa AI integration | 3 | `MegatrendsWorkspace.tsx`, `AIInsightsCard.tsx`, `megatrendStore.ts` contain no `useAIStream`, no LLM calls — `AIInsightsCard` is pure client-side heuristic (`megatrends.sort().slice(0,5)`); `megatrend.routes.ts` has no `/ai` endpoint |
| No frontend unit tests for operational/assessment/megatrend | 3 | 2 smoke tests exist (`toolCanvas.smoke.test.tsx`, `genericDomainStep.smoke.test.tsx`); assessment editors (`ReportBuilderWorkspace`, `DRDAuditReportView`), megatrend workspace, `AssessmentHub` — zero coverage |
| File copy debris still present | 2 | `find /src/components/DiscoveryTools -name "* [0-9].tsx" 2>/dev/null` — space-named duplicates `GrowthPathQuadrantStep 4/5/6.tsx`, `PortfolioItemsStep 2/4/5.tsx`, `MarketForcesLibraryGraphic 2.tsx`, report template `index 3/4.ts` in `aiCardGovernance 2.ts`, `ProposalCardGovernance 2.tsx` still present in main branch worktree |
| 5 hidden strategic tools map to wrong data model | 1 | `useToolStore.ts:1736–1742` maps `value-chain`, `ambition-decomposer`, `focus-tradeoff`, `capability-mapper`, `narrative-engine` to `createInitialPorterData` — if gating ever fails they open a Market Forces UI labeled incorrectly |

---

## 3. Teresa Integration — Depth and Missing

### What works (strategic tools only)

`useToolAI.ts` (649 LOC) wraps `useAIStream` with full tool-specific logic for the 5 strategic tools:

- **Signal extraction** (`find-signals`): `getToolSuggestionPrompt` → `promptRegistry.ts` returns domain JSON prompts for `dynamic-swot`, `market-forces`, `growth-paths`, `portfolio-priority`, `risk-uncertainty` and the operational fallback (`promptRegistry.ts:450`).
- **Full session draft** (`draft-session`): `buildDynamicSwotFullSessionPrompt`, `buildMarketForcesFullSessionPrompt`, etc. generate the entire session in one shot with JSON application (`useToolAI.ts:340`).
- **Build analysis** (`build-analysis`): per-tool structured prompts → `applyDynamicSwotPendingAction` / `applyMarketForcesPendingAction` / etc. parse streamed JSON and write to store (`useToolAI.ts:463–600`).
- **Synthesis** (`synthesize-insights`): `buildRiskSynthesisPrompt`, `buildPortfolioSynthesisPrompt`, `buildGrowthPathsSynthesisPrompt`, `buildMarketForcesImplicationsPrompt` (`useToolAI.ts:211–267`).
- **Rethink per card**: `rethinkCard` → per-tool rethink prompt → `updateCardAfterRethink` (`useToolAI.ts:386–440`).
- **Mission frame** (`frame-mission`): suggests `ConsultingMissionContext` JSON; `applyMissionSuggestion` merges into store (`useToolAI.ts:367–384`).
- **Org context injection**: `useOrganizationContext.formatForPrompt()` included in all full-session prompts.

### Missing Teresa integration (critical gaps)

1. **Operational ship tools** (`sop-builder`, `a3-problem-solving`, `smed-planner`, `dms-builder`, `inventory-autopilot`): `getToolPhaseAiActions` returns button definitions for `find-signals` / `build-analysis` / `finalize-outputs`; `ToolPhaseAiActions.tsx` renders them — but `runPhaseAiAction` in `useToolAI.ts:342–364` only dispatches for `frame-mission`, `find-signals`, `build-analysis`, `synthesize-insights`, `finalize-outputs`, `draft-session`. For operational tools `find-signals` → `requestSuggestions` → `getToolSuggestionPrompt` returns the generic operational summary prompt (`promptRegistry.ts:450`) — no domain-specific JSON schema. No apply handler exists for operational JSON responses; the streamed text lands in `streamedContent` but is never applied to store.

2. **Digital ship tools** (`ai-discovery`, `pain-explorer`, `rpa-scanner`): Same gap — `GenericDomainStep` renders items list but has no AI action button (component receives no `onAiAction` prop); `useToolAI` has no apply logic for these tools.

3. **Assessment section AI** (`ReportBuilderWorkspace.tsx`): AI is real but uses a request/response pattern (`useReportSections.ts:395–442` → `POST /api/assessment-reports/:reportId/sections/:sectionId/ai`) with 5 actions: summarize, expand, regenerate, improve, translate. Chat side panel uses `addChatMessage`/`setIsBotTyping` from `useAppStore` (global Teresa chat store) — so chat is wired to the global chat, **not** to report context. This means report AI editing does not use Teresa streaming and has no report-awareness.

4. **Megatrends AI**: Zero. `AIInsightsCard` is pure algorithmic (sort + filter by type). No Teresa prompts exist for trend analysis, signal interpretation, or strategic recommendations generation.

---

## 4. System Integration

### Tools → Initiatives (wired, real)
`Api.generateToolInitiatives(toolSessionId, payload)` → `POST /tools/:toolId/generate-initiatives` (`tools.routes.ts:55–58`). `Api.promoteToolOutput` → `POST /tools/:toolId/promote` (`tools.routes.ts:52`). Initiative opens inline via `setActiveDocumentId` → `InitiativeDocumentView`. Path verified.

### Assessment → Initiatives (wired, real)
`POST /api/assessments/:id/generate-initiatives` (`assessments.routes.ts:254`). `TransferToRoadmapModal` present (`src/components/assessment/modals/TransferToRoadmapModal.tsx`). Path verified.

### Entry-door role (partial)
`DiscoveryToolsHub` receives `initialCategory` prop from `AppRoutes.tsx:1433,1473,1488,1503` for strategic/operational/digital/automation tabs — correct deep-link entry. Assessment is a **separate shell** at `/assessment/*` (`AppRoutes.tsx:1644`), not subordinate to DiscoveryToolsHub. Users arriving via `/tools` and via the header nav "Assessment" see different shells.

### ADMA/CMMI/LEAN gating (broken)
`assessmentTemplateItems` useMemo (`DiscoveryToolsHub.tsx:2497–2522`) maps all 5 frameworks with `isComingSoon: false`. Server `POST /api/assessments` has no framework-type allowlist. Clicking ADMA/CMMI/LEAN creates a real DB session and opens an empty editor with no content model.

### Megatrend seed in migrations-v2 (missing)
`server/migrations-v2/` has 037 files; `20260608_megatrends_seed.sql` is only in legacy `server/migrations/`. `DatabaseInitializer.ts:172` lists `'megatrends'` in the table-existence check but does not run the seed migration. Fresh Postgres deployments return empty arrays permanently from `GET /api/megatrends/baseline`.

---

## 5. Completion Plan to 100%

### P0 — Must ship before GA (blocks demo + correctness)

| # | Task | Effort | File:Line |
|---|------|--------|-----------|
| P0-1 | Add `20260608_megatrends_seed.sql` to `migrations-v2/` as `038_megatrends_seed.sql` and reference it in `DatabaseInitializer.ts` | 2h | `server/migrations-v2/` + `server/src/database/DatabaseInitializer.ts:172` |
| P0-2 | Gate ADMA/CMMI/LEAN: set `isComingSoon: true` for ADMA/CMMI/LEAN in `assessmentTemplateItems` (`DiscoveryToolsHub.tsx:2516`) OR add server-side allowlist `['DRD','SIRI']` in `POST /api/assessments` (`assessments.routes.ts:123`) | 1h | `DiscoveryToolsHub.tsx:2516` / `assessments.routes.ts:123` |
| P0-3 | Wire or delete `ToolWizardView` — if keeping: import and render from `DiscoveryToolsHub` on tool finalize/output-promotion action; if deleting: remove `src/components/DiscoveryTools/ToolWizardView.tsx` and `ToolWizardShell` reference | 3h | `src/components/DiscoveryTools/ToolWizardView.tsx:1` |

### P1 — Required for production quality

| # | Task | Effort | File:Line |
|---|------|--------|-----------|
| P1-1 | Implement Teresa AI apply-handler for 5 operational tools: add `applyOperationalPendingAction` (analogous to `applyDynamicSwotPendingAction`) that parses streamed section-item JSON and calls `updateInputData` for operational tool types; add a domain JSON prompt per tool in `promptRegistry.ts` | 2d | `src/hooks/discovery/useToolAI.ts:386` + `src/hooks/discovery/toolAi/promptRegistry.ts:1` |
| P1-2 | Add AI action wire-up for 3 digital `GenericDomainStep` tools: pass `onAiAction` prop from `ToolCanvas.tsx:590–609` down to `GenericDomainStep`; implement `find-signals` JSON prompt + apply handler for `ai-discovery`, `pain-explorer`, `rpa-scanner` | 1d | `src/components/DiscoveryTools/ToolCanvas.tsx:590` + `src/components/DiscoveryTools/tools/Digital/GenericDomainStep.tsx:20` |
| P1-3 | DoD gap detection for 11 non-strategic ship tools: add completeness checks in `ToolWorkspace.tsx:241–296` for sop/a3/smed/dms/inventory (minimum: context + at least 1 section item), and for digital tools (minimum 1 item per domain section) | 1d | `src/components/DiscoveryTools/ToolWorkspace.tsx:241` |
| P1-4 | Unify AssessmentHub into DiscoveryToolsHub: redirect `/assessment/*` to `/tools/licensed/*` and render assessment session list/detail as a new tab inside `DiscoveryToolsHub` (already has `kind: 'assessment'` items in library catalog) | 2d | `src/routes/AppRoutes.tsx:1644` + `src/components/Discovery/DiscoveryToolsHub.tsx` |

### P2 — Vision completeness

| # | Task | Effort | File:Line |
|---|------|--------|-----------|
| P2-1 | Teresa AI for Megatrends: add `POST /api/megatrends/ai-insights` server route using `llmService` to generate strategic interpretation of top trends in context of org industry/phase; wire to a "Teresa Analyze" button in `MegatrendsWorkspace.tsx` | 1.5d | `server/src/routes/megatrend.routes.ts:1` + `src/components/Megatrend/MegatrendsWorkspace.tsx:33` |
| P2-2 | Assessment report AI context: replace global-chat pattern in `ReportBuilderWorkspace.tsx:56` with a `useAIStream` call scoped to report context, so report section editing uses Teresa streaming with report metadata injected | 1d | `src/components/assessment/ReportBuilderWorkspace.tsx:56` + `src/hooks/useReportSections.ts:395` |
| P2-3 | Delete space-named duplicate files: `GrowthPathQuadrantStep 4/5/6.tsx`, `PortfolioItemsStep 2/4/5.tsx`, `MarketForcesLibraryGraphic 2.tsx`, `aiCardGovernance 2.ts`, `ProposalCardGovernance 2.tsx`, `index 3/4.ts` (report templates) | 1h | `src/components/DiscoveryTools/tools/` (multiple) |
| P2-4 | Frontend test coverage: add integration tests for `DiscoveryToolsHub` library fetch + session create path, `useToolAI` strategic flow, and assessment report lifecycle (`useReportSections`) | 2d | `src/components/DiscoveryTools/__tests__/` + `src/hooks/__tests__/` |
| P2-5 | Fix 5 hidden strategic tools data model: add `createInitialValueChainData` etc. with domain-specific schemas so if gating ever fails they open correct empty state, not Porter data | 0.5d | `src/store/useToolStore.ts:1736` |

---

## 6. Score Projection

| Phase | Score | Delta |
|-------|-------|-------|
| Current | 65 | — |
| After P0 (3 items, ~6h) | 72 | +7 |
| After P1 (4 items, ~6d) | 86 | +14 |
| After P2 (5 items, ~5.5d) | 100 | +14 |

**Estimated total to 100%: ~12 engineering-days.** P0 alone is a single sprint day and unblocks GA correctness (no empty-state Megatrends on demo, no ADMA/CMMI/LEAN ghost sessions, no dead wizard code).
