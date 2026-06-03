# DEEP RE-VERIFICATION — Module 04 Narzędzia / Tools + Discovery

**Date:** 2026-06-03
**Method:** End-to-end stack trace (UI → hook → route → controller → DB/AI). No builds.
**Verdict:** Strategic tools have a real Teresa loop. The 9 non-strategic shippable tools render Teresa buttons but have NO apply-handler — **CONFIRMED**. The "megatrends seed never runs" / DB-init-mismatch claim is **PARTIALLY REFUTED** with an important nuance (see Lens 2).

---

## A. Headline claims — CONFIRM / REFUTE (file:line)

| Claim | Verdict | Evidence |
|---|---|---|
| 9 active tools show Teresa buttons with NO apply-handler | **CONFIRMED** | `ACTIVE_KNOWN_TOOL_TYPES` (`KnownToolsService.ts:199–217`) = 14 tools. Only 5 strategic have apply logic. The apply `useEffect` early-returns for any toolType not in {dynamic-swot, market-forces, growth-paths, portfolio-priority, risk-uncertainty} (`useToolAI.ts:448–453`). Buttons still render: `toolAiActions.ts:118–128` returns `find-signals` for ANY step `id==='input'`; `:186–194` returns `build-analysis` for ANY aiAssisted step. So `process-automation, sop-builder, a3-problem-solving, smed-planner, dms-builder, inventory-autopilot, ai-discovery, pain-explorer, rpa-scanner` (9) show buttons; clicking streams text that is never applied to the store. |
| DB init mismatch — megatrends seed only in legacy, never runs | **PARTIALLY REFUTED** | The canonical TP runner (`tablePlatform/migrationRunner.ts:26` pattern `/^(7\d{2}\|\d{8})_.*\.sql$/`) scans `server/migrations/` (`:30–33`). `20260608_megatrends_seed.sql` MATCHES that pattern and lives in a scanned dir → it IS discovered/applied on Postgres. The doc conflated `migrations-v2/` (separate baseline system, where the table is created — `migrations-v2/001_baseline_20260413.sql`) with the TP seed runner. **Real residual risk:** the CREATE-TABLE file `20251212-create-megatrends.sql.sql` does NOT match the pattern (hyphen, not `_`), so the seed relies on the table pre-existing from `migrations-v2/001`/`006`. If the v2 baseline hasn't run, the seed INSERT (`INSERT INTO megatrends ...`) fails. |

---

## B. Per-feature verification (WORKS / PARTIAL / MOCK / BROKEN)

| Feature | Status | Path (file:line) |
|---|---|---|
| Tool library load | **WORKS** | `KnownToolsService.ts:199` active set; 14 dispatch to real components (`ToolCanvas.tsx`); 17 double-gated coming-soon |
| Run a framework (5 strategic) | **WORKS** | full `useToolAI` loop: find-signals → build-analysis → synthesize → finalize |
| Run a framework (9 non-strategic) | **PARTIAL/BROKEN** | UI steps render (operational + GenericDomainStep), but Teresa apply is dead — streamed content never written (`useToolAI.ts:448`) |
| AI-assist apply (strategic) | **WORKS** | `applyDynamicSwotPendingAction` / Market/Growth/Portfolio/Risk (`useToolAI.ts:463–600`) |
| AI-assist apply (non-strategic) | **BROKEN** | No `applyOperationalPendingAction`; effect bails for these types |
| Persistence (tool sessions) | **WORKS** | `tool_sessions` table, `context_snapshot` JSON (`ToolController.ts:614,1071`) |
| Tools → Initiatives | **WORKS** | `POST /tools/:id/generate-initiatives` (`tools.routes.ts:55`) |
| Assessment → Initiatives | **WORKS** | `POST /api/assessments/:id/generate-initiatives` |
| Megatrends baseline | **PARTIAL** | seed matches TP pattern (runs) but depends on v2 table existing; route `GET /api/megatrends/baseline` (`megatrend.routes.ts:64`) |
| Megatrends Teresa AI | **MISSING** | no LLM call anywhere; `AIInsightsCard` is pure client-side sort/filter |

---

## C. Four-lens analysis

### Lens 1 — Functionalities
Strategic lane is genuinely production-grade (full AI loop + org-context injection). The shippable surface overstates capability: 9 of 14 active tools advertise Teresa actions that produce no store mutation — a silent no-op that a demo user would experience as "AI did nothing." This is the single most damaging correctness gap in the module.

### Lens 2 — Cross-module flow (CRITICAL: does Discovery READ org context?)
**CONFIRMED REAL.** `useToolAI` injects `useOrganizationContext.formatForPrompt()` into full-session prompts; `useOrganizationContext.ts:127` fetches `Api.organizationContextGet()` and renders `signals.interviewInsights` (`:197`). Server-side `ToolController.ts:10` imports `organizationContextService`. So the Interview(03)→OrgContext(16)→Discovery(04) memory path is closed and real **for the 5 strategic tools** — but the 9 non-strategic tools, having no apply handler, never reach `generateFullSession`, so they never consume the injected org context in practice.

**DB-init nuance (corrected):** TP seed runner does pick up the megatrends seed; the real fragility is the unmatched CREATE-TABLE filename + reliance on the separate `migrations-v2` baseline for the table. Not "never runs," but "ordering-fragile."

### Lens 3 — Teresa wiring real / dead
**Real:** 5 strategic tools (`useToolAI.ts` 649 LOC, per-tool prompts + apply). Assessment section AI is real but request/response, wired to GLOBAL chat store not report context (`ReportBuilderWorkspace.tsx`). **Dead:** 9 non-strategic tools (buttons render, apply no-ops). **Missing entirely:** Megatrends AI (no prompts, no route).

### Lens 4 — Contextual / long-term memory
Module 04 is primarily a memory-READER (consumes org context into prompts) and a memory-WRITER into initiatives/roadmap via promote/generate. Tool sessions persist to `tool_sessions.context_snapshot`. It does NOT write back into the org-context snapshot the way Interview does — so Discovery enriches the initiative backlog but is not itself a long-term org-memory source. The 9 broken tools also produce no persisted AI output, weakening their traceability-to-initiative chain.

---

## D. Prioritized findings (file:line)

**P0**
- P0-1 Implement `applyOperationalPendingAction` + domain prompts so the 9 active non-strategic tools actually apply AI output; remove the early-return gate at `useToolAI.ts:448–453` OR hide their AI buttons (`toolAiActions.ts:118,186`) until handlers ship. (Current state = silent no-op in demo.)
- P0-2 Megatrends robustness: ensure `migrations-v2` baseline creates the table before the TP seed runs, OR rename `20251212-create-megatrends.sql.sql` to match `\d{8}_` and add it to the TP-scanned dir; verify `megatrends` is non-empty post-init.
- P0-3 Gate ADMA/CMMI/LEAN — `DiscoveryToolsHub.tsx:2516` hardcodes `isComingSoon:false`; `POST /api/assessments` (`assessments.routes.ts:123`) has no allowlist → ghost empty sessions.

**P1**
- P1-1 Wire `onAiAction` into `GenericDomainStep` (ai-discovery/pain-explorer/rpa-scanner) — no AI prop today.
- P1-2 DoD completeness gate for the 9 non-strategic tools (`ToolWorkspace.tsx:241–296` only checks 3 strategic).
- P1-3 `ToolWizardView.tsx` is dead (no import) — wire or delete.

**P2**
- P2-1 Megatrends Teresa AI route + button (none exist).
- P2-2 Report AI: replace global-chat store with report-scoped `useAIStream` (`ReportBuilderWorkspace.tsx`).
- P2-3 Delete space-named duplicate files (`* 4.sql`, `* 4.tsx`, `index 3/4.ts`).
