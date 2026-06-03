# Completion-to-100% Dossier — Module 05: Inicjatywy / Initiatives

**Date:** 2026-06-03  
**Score now:** 74/100 (Tier: Beta). Prior: 58/100 (2026-06-02).  
**Far goal:** Initiatives is the spine centre — evidence → initiative readiness → governed decision → handoff. At 100% every candidate carries LLM-generated content sourced from real evidence, the generator produces usable AI output, ROI is typed, GapAnalysis feeds the canonical endpoint, and the module is test-covered for all major lifecycle paths.

---

## 1. Purpose / Vision

Initiatives is the transformation planning hub: `source/evidence → initiative draft → triage → governance gate → execution handoff`. The module must prove traceability end-to-end. At full maturity (100%) Teresa generates initiative candidates from real basket evidence, the portfolio AI panel provides conflict/priority/scenario analysis backed by LLM, ROI is typed and scenario-comparable, and every initiative carries a navigable source link back to its origin.

---

## 2. Readiness to 100% — Score + Gap

**Score: 74/100.** Key remaining gaps:

| Area | Status | Evidence |
|---|---|---|
| Wizard AI candidate generation | Heuristic only — no LLM | `initiativeWizardService.ts:258-270` — candidates built from `sourceBasket` using hardcoded templates + hygiene pool; `generateCandidates` function calls no LLM service |
| Generator POST `/api/initiative-generator/generate` | Stub — no AI | `initiative-generator.routes.ts:46-57` — saves `'AI Generated Initiative'` with `description = JSON.stringify(context)` |
| GapAnalysisDashboard → 404 path + `alert()` | Regression | `GapAnalysisDashboard.tsx:59` — POSTs to `/api/initiatives/generate-from-assessments` (no route exists); `alert()` on L68,71 |
| `useAssessmentAI.generateInitiatives` → missing endpoint | Dead call | `useAssessmentAI.ts:399` — calls `/ai/generate-initiatives`; grep confirms no such route in `ai.routes.ts` |
| `useAssessmentAI.prioritizeInitiatives` → missing endpoint | Dead call | `useAssessmentAI.ts:411` — calls `/ai/prioritize-initiatives`; not found in server |
| DELETE on `generated_initiatives` | Missing | `initiative-generator.routes.ts` — only GET/POST/PUT; drafts accumulate |
| `estimated_impact` excluded from PUT | Schema mismatch | `initiative-generator.routes.ts:66-84` — field in SELECT but not in allowed PUT fields |
| ROI `any` casts | Type debt | `FullROIView.tsx:156` — `(a: any)` map; no typed interface for economics API response |
| Frontend tests | Smoke only | `InitiativesHub.smoke.test.tsx` + `PortfolioAnalysisView.smoke.test.tsx` — mount + empty state only; no wizard lifecycle, no Kanban/Grid/Matrix/Timeline card test |
| `/initiatives/:id` route | Missing | `AppRoutes.tsx:1663` — only `/initiatives` (flat); no deep-link route for initiative detail; drawer opens via `?open=id` query param only |

---

## 3. Teresa Integration — Depth + Missing

### What is wired (real LLM calls)
- **`POST /api/ai/initiatives/conflicts`** — `ai.routes.ts:6353` — real `aiPipeline.process()` call with structured prompt; returns conflict array.
- **`POST /api/ai/initiatives/priorities`** — `ai.routes.ts:6413` — real LLM call, priority suggestions with rationale.
- **`POST /api/ai/initiatives/schedule`** — `ai.routes.ts:6268` — real LLM roadmap prompt; maps initiative names to quarters.
- **`PortfolioAiPanel`** — `PortfolioAiPanel.tsx:79-133` — `Promise.allSettled` over conflicts + priorities + overlap + nonhuman; apply-to-portfolio confirmed wired (`applyPrioritySuggestion` L135, `applyScenario` L300).
- **`initiativeGenerationService.generateSectionContent`** — `initiativeGenerationService.ts:57-67` — lazy-imports `llmService`; used at `pmo/initiatives.routes.ts:1546` for section-level AI fill-in.

### What is stub / missing
- **`/api/initiative-generator/generate`** — `initiative-generator.routes.ts:46-57` — persists `'AI Generated Initiative'` with context as raw JSON. Zero LLM call. The "Generate with Teresa" button in InitiativesHub (`InitiativesHub.tsx:1487-1501`) succeeds but produces no useful draft content.
- **`initiativeWizardService.generateCandidates`** — `initiativeWizardService.ts:258-713` — deterministic only: reads `sourceBasket` items, maps them to template candidates via hardcoded `opportunityStatement` strings (L442). No LLM service imported or called. Wizard audit events correctly record generation mode/counts, but the "AI baseline" is heuristic.
- **`/ai/generate-initiatives`** (called by `useAssessmentAI.ts:399`) — does not exist in `ai.routes.ts`. Dead endpoint.
- **`/ai/prioritize-initiatives`** (called by `useAssessmentAI.ts:411`) — does not exist. Dead endpoint.
- **`/api/initiatives/generate-from-assessments`** (called by `GapAnalysisDashboard.tsx:59`) — does not exist.

---

## 4. System Integration — Spine Centre

### Inbound (Insights/Tools → Initiatives)
- **Assessment workflow** (`assessment-workflow-v2.routes.ts:953`) and `assessment-reports.routes.ts:688` expose `/:id/generate-initiatives` — real LLM-backed paths from assessments to initiative drafts.
- **`useAssessmentAI`** (`hooks/useAssessmentAI.ts:396`) calls `/ai/generate-initiatives` — **404, dead**.
- **`DiscoveryToolsHub`** (confirmed in prior audit at `DiscoveryToolsHub.tsx:4673`) calls `Api.generateInitiatives()` → canonical endpoint (`/api/initiative-generator/generate`) — wired but stub AI.
- **`InitiativeSourceLink`** (`InitiativeSourceLink.tsx:35-111`) — renders navigable source chip for types: tool/assessment/interview/conclusion. Source is displayed and navigates back. Traceability UI is real.

### Outbound (Initiatives → Results / Execution / Outputs)
- **Initiatives → Results**: `hasExecutingInitiative` useMemo (`InitiativesHub.tsx:1506`) + "View Results" CTA navigates to `ROUTES.BENEFITS` (`InitiativesHub.tsx:1530`). Live.
- **Initiatives → Execution**: No explicit CTA from InitiativesHub into Module 06 (Realizacja/Execution). The `ExecutionHub` reads `initiative_id` but the forward link is not surfaced in the UI.
- **Initiatives → Outputs/EE**: No link from initiative detail into EE/Deliverables or OutputsHub. Gap in the spine.
- **`/initiatives/:id` deep-link**: No dedicated route. Detail opens only via `?open=id&mode=drawer` query param. Shareable URL is present (`InitiativesHub.tsx:1296`) but there is no canonical `/initiatives/:id` path for permalink or external handoff.

---

## 5. Completion Plan to 100%

### P0 — Regression / Broken (fix now, ~2–4 h total)

| Item | File:line | Effort |
|---|---|---|
| Fix `GapAnalysisDashboard` path: replace `/api/initiatives/generate-from-assessments` with `/api/initiative-generator/generate`; replace `alert()` with `toast.success/error` | `GapAnalysisDashboard.tsx:59,68,71` | 30 min |
| Add DELETE `/:id` to generator router + add `estimated_impact` to PUT allowed fields | `initiative-generator.routes.ts:61-92` | 30 min |
| Type the economics API response; remove `(a: any)` cast | `FullROIView.tsx:156` | 1 h |

### P1 — Core Teresa wiring (real AI value, ~1–2 days)

| Item | File:line | Effort |
|---|---|---|
| Wire real LLM into `/api/initiative-generator/generate`: import `llmService`, build a structured prompt from `context`, persist title + description from LLM response | `initiative-generator.routes.ts:36-58` | 4 h |
| Wire LLM into wizard `generateCandidates`: call `llmService` with session basket + mode prompt; merge with heuristic hygiene fallback; update audit event | `initiativeWizardService.ts:620-712` | 6 h |
| Add `/ai/generate-initiatives` and `/ai/prioritize-initiatives` endpoints to `ai.routes.ts`; or redirect `useAssessmentAI` to existing working endpoints | `ai.routes.ts` (new routes) + `useAssessmentAI.ts:399,411` | 3 h |

### P2 — Spine / Navigation completeness (~1 day)

| Item | File:line | Effort |
|---|---|---|
| Add `/initiatives/:id` route for deep-link/permalink (renders InitiativeDrawer or FullView in standalone shell) | `AppRoutes.tsx` near L1663 | 2 h |
| Add "Go to Execution" CTA from initiative detail when status = EXECUTING/IN_PROGRESS | `InitiativeDetailCard.tsx` or `InitiativesHub.tsx` | 2 h |
| Add "Go to Outputs" link from initiative detail (EE/Deliverables cross-link) | `InitiativeDetailCard.tsx` | 1 h |
| Expand frontend tests: wizard happy-path (intent → candidate → accept → draft created), Kanban/Grid/Matrix/Timeline view mount + card lifecycle | `Initiatives/__tests__/` | 4 h |

### P3 — Polish / Go-to-market (~half day)

| Item | Effort |
|---|---|
| Expand ROI scenario compare (e.g. per-initiative NPV bar chart, not just table rows) | 3 h |
| i18n audit — wizard strings still hardcoded Polish only (`initiativeWizardService.ts:442`, modal labels in `InitiativeWizardModal.tsx:157-165`) | 2 h |
| `portfolioOptimization.routes.ts` overlap endpoint uses naive Jaccard similarity — no LLM; acceptable for now but flagged | — |

---

**Estimated effort to 100%:** P0 = 2 h · P1 = 13 h · P2 = 9 h · P3 = 5 h → **~29 h total**.  
**Critical path to market-ready (P0+P1):** ~15 h. Without P1 the "Generate with Teresa" button is a UI illusion.
