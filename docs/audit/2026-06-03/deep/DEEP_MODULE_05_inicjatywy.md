# DEEP RE-VERIFICATION — Module 05: Inicjatywy / Initiatives

**Date:** 2026-06-03 (deep pass) · **Method:** end-to-end UI→route→DB/AI, no builds · **Prior dossier:** `COMPLETION_05_inicjatywy.md` (74/100)

Deep verdict: **PARTIAL.** Heuristic spine is solid and DB-backed; the "Generate with Teresa" path is a confirmed MOCK; portfolio AI panel is the only genuine LLM surface and it WORKS end-to-end. Three dead endpoints re-confirmed.

---

## 1. Per-feature verification (file:line)

| Feature | Status | Evidence (file:line) |
|---|---|---|
| Create initiative (wizard candidates → DB) | WORKS | `initiativeWizardService.ts:737` `generateCandidates` reads real session + sourceBasket, INSERTs into `initiative_wizard_candidates` (L762-795); audit event L797 |
| Wizard AI candidate generation (LLM) | MOCK | `initiativeWizardService.ts:753` `buildSeedCandidates` deterministic only; grep for `llmService\|aiPipeline\|getAIPipeline` in file = **zero hits**. "AI baseline" is template/hygiene heuristic |
| Track initiatives (list/grid/kanban) | WORKS | `InitiativesHub.tsx` multi-view; `GET /api/initiative-generator/` lists DB rows org-scoped (`initiative-generator.routes.ts:16-30`) |
| "Generate with Teresa" button → `/api/initiative-generator/generate` | MOCK | `initiative-generator.routes.ts:32-58`: persists hardcoded `'AI Generated Initiative'`, `description = JSON.stringify(context)`, **no LLM call**. Returns `{success, message:'Initiative generation started'}` — illusion of generation |
| Generator PUT `/:id` | PARTIAL | `initiative-generator.routes.ts:61-90`: `estimated_impact` still NOT in allowed fields (SELECT exposes it L24); **also missing org-scoping** — WHERE `id = ?` only, any auth user can update any org's row (see P1-sec) |
| Generator DELETE | BROKEN/MISSING | `initiative-generator.routes.ts`: only GET/POST/PUT — drafts accumulate, no purge |
| AI apply-handlers (PortfolioAiPanel) | WORKS | `Portfolio/PortfolioAiPanel.tsx:79-92` `Promise.allSettled` over real endpoints; `applyPrioritySuggestion` L135-165 → `onQuickUpdate(id,{priority})` real write-back + audit L150; `applyScenario` L300 → `/portfolio-optimization/timeline/apply` L307 |
| AI conflicts/priorities/schedule endpoints | WORKS | `ai.routes.ts:6353` conflicts, `:6413` priorities, `:6268` schedule — all call `aiPipeline.process({capability:'strategic'...})` with structured prompt (verified L6393-6404) |
| `useAssessmentAI.generateInitiatives` → `/ai/generate-initiatives` | BROKEN (dead) | `useAssessmentAI.ts:396-407` POSTs; grep of all `server/src/routes` = **route does not exist** |
| `useAssessmentAI.prioritizeInitiatives` → `/ai/prioritize-initiatives` | BROKEN (dead) | `useAssessmentAI.ts:409-417`; route does not exist |
| `GapAnalysisDashboard.generateInitiatives` → `/api/initiatives/generate-from-assessments` | BROKEN (dead) | `GapAnalysisDashboard.tsx:59`; route does not exist anywhere in server. Plus `alert()` UX L68,71 |
| ROI typing | PARTIAL | `FullROIView.tsx:156` `(a: any)` map of `Api.getEconomicsAnalyses().analyses` — economics API response untyped |
| InitiativeSourceLink traceability | WORKS | `InitiativeSourceLink.tsx` renders navigable source chip (tool/assessment/interview/conclusion) |

---

## 2. Four Lenses

### Lens 1 — Functionalities verified
Deterministic spine (wizard create → triage → candidate→draft, grid/kanban/matrix/timeline, source traceability) is real and DB-persisted. The PortfolioAiPanel is genuinely AI-backed with working apply-to-portfolio. The single most-marketed feature — "Generate with Teresa" one-click generation — is a confirmed mock that writes a placeholder row.

### Lens 2 — Cross-module value chain (each edge)
- **05 → 06 (Execution):** PARTIAL/one-directional. `ExecutionHub` consumes `Api.getInitiatives()` and reads `initiative_id`; but InitiativesHub has **no outbound CTA into Execution** (only inbound). Data-path exists; UI handoff missing.
- **05 → 07 (Results):** WORKS (UI). `InitiativesHub.tsx:1527-1534` `hasExecutingInitiative` gates a "View Results" CTA → `ROUTES.BENEFITS` (L1530). Data shared via `initiative_kpis`.
- **05 → 08 (Finance):** WORKS. Per-row nav `navigate('/economics?tab=models&initiativeId='+id)` at `InitiativesHub.tsx:1327`.
- **05 → 09 (Outputs/EE):** BROKEN. No link from initiative detail into Outputs/EE. Spine gap.

### Lens 3 — Teresa wiring real/dead
- **REAL:** conflicts/priorities/schedule (`ai.routes.ts:6353/6413/6268`) via `aiPipeline.process`; PortfolioAiPanel consumes + applies them.
- **DEAD/MOCK:** generator `/generate` (no LLM), wizard `generateCandidates` (no LLM), and 3 dead endpoints (`/ai/generate-initiatives`, `/ai/prioritize-initiatives`, `/api/initiatives/generate-from-assessments`). Prior "partial apply-handlers" finding **confirmed**: apply-handlers are real, generation is not.

### Lens 4 — Contextual memory usage
`InitiativesHub.tsx` imports `useOpenChatWithContext` — opening chat seeds a conversation with initiative entity context (entityType/entityId/contextData), persisted server-side as a conversation. Real context injection. Wizard `recordWizardAuditEvent` (L797) persists generationMode/evidenceCount as durable audit memory.

---

## 3. P0/P1/P2 (file:line)

**P0**
- `GapAnalysisDashboard.tsx:59` — repoint to `/api/initiative-generator/generate`; replace `alert()` L68,71 with toast. (Dead path today.)
- `initiative-generator.routes.ts:61-90` — add org-scoping to PUT WHERE clause (cross-org write vuln) + add `estimated_impact` to allowed fields + add DELETE `/:id`.

**P1**
- `initiative-generator.routes.ts:44-56` — wire real LLM (import `llmService`/`aiPipeline`), build prompt from `context`, persist LLM title+description. Today fully mock.
- `useAssessmentAI.ts:399,411` — either create `/ai/generate-initiatives` + `/ai/prioritize-initiatives` or redirect to existing working `ai.routes.ts:6413` priorities.
- `initiativeWizardService.ts:753` — optional LLM augmentation of `buildSeedCandidates` with heuristic fallback.

**P2**
- `FullROIView.tsx:156` — type economics response, drop `(a: any)`.
- `InitiativesHub.tsx` — add "Go to Execution" + "Go to Outputs" CTAs (close 05→06, 05→09 edges).
- `Initiatives/__tests__/` — wizard happy-path + view-card lifecycle tests (currently smoke only).
