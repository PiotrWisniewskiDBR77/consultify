# Module 04 — Narzędzia — Readiness Scorecard

**Readiness: 52/100 — Tier: Alpha**
**Route(s):** `/discovery-tools`, `/discovery-tools/strategic`, `/discovery-tools/strategic/megatrends`, `/discovery-tools/operational`, `/discovery-tools/digital`, `/discovery-tools/process-automation`, `/assessment/*`, `/licensed-tools/*` (alias → `/assessment`)
**One-line verdict:** Hub shell, routing, and backend API are real and wired, but 20 of 31 tool types use a shared generic step renderer with a literal fallback of "Step content not implemented yet", Megatrends backend requires an unpopulated DB table, and there are zero frontend unit tests.

---

## Tool inventory (count + working count)

31 tool types total (10 strategic, 10 operational, 10 digital, 1 automation) + 5 licensed assessment frameworks (DRD, SIRI, ADMA, CMMI, LEAN).

- **6 fully-worked tools** — dedicated multi-phase step UIs with typed data models and AI integration:
  - `dynamic-swot`, `market-forces`, `growth-paths`, `portfolio-priority`, `risk-uncertainty` (strategic), `process-automation`
- **5 partially-worked operational tools** — tool-specific step schemas but render into shared `OperationalSectionStep` (generic form surface, no tool-specific visuals):
  - `sop-builder`, `a3-problem-solving`, `smed-planner`, `dms-builder`, `inventory-autopilot`
- **5 generic-only strategic tools** (share `PORTER_STEPS` with no dedicated phase UI):
  - `value-chain`, `ambition-decomposer`, `focus-tradeoff`, `capability-mapper`, `narrative-engine`
- **15 stub/generic tools** — `TOOLSET_OPERATIONAL_STEPS` or `TOOLSET_DIGITAL_STEPS` shared steps; any unrecognised step falls through to the literal string "Step content not implemented yet" (`ToolCanvas.tsx:644`):
  - Operational: `vsm-builder`, `constraint-control`, `decision-engine`, `control-tower`, `automation-pipeline`
  - Digital: `robotics-feasibility`, `logistics-automation`, `rpa-scanner`, `ai-discovery`, `integration-diagnostic`, `digital-value-pool`, `legacy-analyzer`, `data-inventory`, `pain-to-solution`, `pain-explorer`
- **5 assessment frameworks** — real backend with dedicated editors (DRD, SIRI, ADMA, CMMI/CMPractice, LEAN) — functional Alpha quality
- **Megatrends** — DB-backed route exists, `megatrends` table schema present, but zero seed data; will return empty arrays on a fresh DB

---

## What's REAL (verified + backend-wired)

- `src/components/Discovery/DiscoveryToolsHub.tsx:895–935` — 5-API parallel bootstrap (`listToolSessions`, `listAssessments`, `getAssessmentReports`, `/report-builder`, `/presentations/decks`) with timeout guards and circuit-breaker handling
- `server/src/routes/tools.routes.ts:32–62` — full CRUD + review/approve/generate-initiatives/promote lifecycle endpoints, all controller-backed
- `server/src/routes/knownTools.routes.ts:17–18` — `GET /known-tools` and `GET /known-tools/:toolType` wired to `KnownToolsController`
- `server/src/routes/assessment.routes.ts` — 62 route handlers covering DRD/SIRI/ADMA/CMMI/LEAN sessions, reports, workflow
- `server/src/routes/assessment-reports.routes.ts` — full report builder CRUD + AI section generation + approve/reject lifecycle
- `server/src/routes/v8/assessment.routes.ts` — bounded V8 assessment API with 433-line test file (14 scenarios)
- `src/components/DiscoveryTools/tools/DynamicSWOT/` — 5 dedicated phase components with real AI card governance
- `src/components/DiscoveryTools/tools/MarketForces/`, `GrowthPaths/`, `PortfolioPriority/`, `RiskUncertainty/` — all have real phase UIs
- `src/components/DiscoveryTools/ProcessAutomation/ProcessMapWorkSurface.tsx` — real interactive map surface
- `src/routes/LicensedToolsRedirect.tsx` — `/licensed-tools/*` → `/assessment/*` alias correctly implemented

---

## What's MOCK / hardcoded / stub

- `src/components/DiscoveryTools/ToolCanvas.tsx:612–638` — 15 operational/digital tool types all fall into `OperationalSectionStep` generic renderer; step IDs outside the common list (`context`, `summary`, `impact-hypothesis`, etc.) fall through to the literal "Step content not implemented yet" string (line 644)
- `src/store/useToolStore.ts:1590–1617` — `value-chain`, `ambition-decomposer`, `focus-tradeoff`, `capability-mapper`, `narrative-engine` all mapped to `PORTER_STEPS` (Market Forces steps), no dedicated data model
- `src/store/useToolStore.ts:1602–1606` — `vsm-builder`, `constraint-control`, `decision-engine`, `control-tower`, `automation-pipeline` share identical `TOOLSET_OPERATIONAL_STEPS`; no VSM canvas, no decision table, etc.
- `src/store/useToolStore.ts:1607–1616` — all 10 digital tools share `TOOLSET_DIGITAL_STEPS`; no domain-specific visuals exist
- `server/src/routes/megatrend.routes.ts:44–53` — dynamic import of `MegatrendService` with silent catch: if model import fails, all routes return 503 `not_configured`; no seed data exists for `megatrends` table so fresh installs return empty arrays
- `src/components/DiscoveryTools/KnownToolPreviewV3.tsx:394–397` — `isComingSoon` flag gates start action; catalog items marked `isComingSoon: true` are non-launchable

---

## What's BROKEN / NO_GO / missing

- **15 digital + 5 generic operational tools render "Step content not implemented yet"** for their primary work steps (`src/components/DiscoveryTools/ToolCanvas.tsx:644`) — a user who starts any of these tools will see a blank step on the key work phase
- **Megatrends is effectively empty-state-only** — DB table created but never seeded; `MegatrendService` import wrapped in silent try/catch; if import fails (missing migration or model not found), the route silently returns 503 with no visible error in the hub UI
- **Duplicate source files** — space-named duplicates exist throughout `DiscoveryTools/tools/` (e.g., `GrowthPathQuadrantStep 4.tsx`, `5.tsx`, `6.tsx`; `PortfolioItemsStep 2.tsx`, `4.tsx`, `5.tsx`; `MarketForcesLibraryGraphic 2.tsx`; `aiCardGovernance 2.ts`; `ProposalCardGovernance 2.tsx`; report template `index 3.ts`, `index 4.ts`). These are copy-artifact debris and will confuse bundlers if accidentally imported
- **No data-layer for 20+ tool types** — `createInitialOperationalData` / `createInitialDigitalData` produce generic empty containers; no domain schema (e.g., no VSM lane structure, no decision table schema) means AI prompts have nothing domain-specific to operate on
- **Assessment hub is a separate shell** (`AssessmentHub`) not unified into `DiscoveryToolsHub` — users can reach assessments from two routes (`/assessment/*` and the Licensed tab inside Tools), creating two different UX surfaces

---

## Backend wiring

Real for: tool sessions CRUD, known-tools catalog, assessment CRUD+workflow+reports, initiatives generation, presentations/decks listing. The `/tools` and `/assessment*` server route files are non-trivial (tools.routes.ts: 64 lines, 14+ endpoints; assessment.routes.ts: 62 routes). Megatrends has a real DB model but is gated behind a silent import try/catch and requires seeded data.

---

## UI/UX consistency

`DiscoveryToolsHub` and `AssessmentHub` both import from `shared/ModuleHub` and use the approved `ModuleHub` shell, `FilterableTable`, `GridView`, `ItemStatus`, `RowActionsMenu`. The 6 fully-worked strategic tools use the approved `ToolWorkspace`/`ToolCanvas`/`ToolHeader` shell. `MegatrendsWorkspace` is standalone with its own tab/card layout — not on the ModuleHub shell. The 20 stub tools use a shared `OperationalSectionStep` form that deviates heavily from the approved per-tool visual identity (no domain-specific canvas or card system).

---

## Tests

- **Server:** `server/src/routes/v8/__tests__/assessment.routes.test.ts` — 14 real scenarios, Vitest, covers V8 assessment API only
- **Server:** `server/src/routes/__tests__/realtime-platform.tool-session-locks.contract.test.ts` — covers tool-session lock contracts (realtime layer only)
- **Frontend:** 0 test files for `Discovery/`, `DiscoveryTools/`, `assessment/`, or `Megatrend/`
- CODEMAP accurately notes `code_gap` for module-local test absence

---

## Doc-vs-code drift

Moderate drift. Docs (last updated 2026-05-09) claim `real: all six documented functions are represented in runtime routes/components` — this is technically true for routes but overstates functional depth. The 20 stub/generic tools are silently omitted. Docs do not mention: (a) the "Step content not implemented yet" fallback; (b) that 10 strategic tools share a single PORTER_STEPS definition; (c) the Megatrends service import try/catch risk; (d) the file-copy debris. The alias redirect and route structure are accurately documented.

---

## Top gaps to reach market-ready (prioritized)

1. **Implement domain-specific step UIs for at least 5 operational tools** — VSM, A3 Problem Solving, SOP Builder, DMS Builder, and Inventory already have step schemas; replace the generic `OperationalSectionStep` fallback with real canvas surfaces; this is the largest UX regression risk
2. **Seed or import megatrend data** — the table exists but is empty; add a migration seeding industry-baseline rows or provide an admin import; without this the Megatrends tab is permanently empty
3. **Unify AssessmentHub into DiscoveryToolsHub** — currently two separate shells exist for the "licensed" category; merge so users have one consistent entry point
4. **Remove duplicate space-named files** — delete `GrowthPathQuadrantStep 4.tsx`, `5.tsx`, `6.tsx`, `PortfolioItemsStep 2.tsx`, etc. to prevent accidental bundler inclusion and reduce confusion
5. **Add domain data schemas for 5 strategic stubs** — `value-chain`, `ambition-decomposer`, `focus-tradeoff`, `capability-mapper`, `narrative-engine` map to Porter steps; add dedicated `inputData` types and at minimum a context+output step
6. **Add frontend unit tests** — zero coverage for DiscoveryToolsHub, ToolCanvas, ToolDocumentView, all assessment editors; at minimum integration-test the Library tab data fetch and tool session lifecycle
7. **Add error boundary / non-503 fallback for Megatrends** — the silent try/catch on service import means a misconfigured server silently returns 503 with no user-facing explanation; surface the error state in the UI
