# Tools SSOT Sources v3 (Consultify) — KPI / SIRI / ADMA + Tool Knowledge Bank

> **Status:** Draft (v3 SSOT)  
> **Purpose:** define **what is canon** (Source of Truth) for consulting tools, so we can (a) split notes correctly, (b) implement consistently, (c) power a tool-specific RAG “consultant expert” with evidence.

---

## 1) Problem we solve

In tool implementations we always have multiple “truth candidates”:

- licensed methodology sources (PDF/whitepaper/training decks),
- product-level SSOT docs (V3 contracts),
- runtime/UI code that already exists,
- team notes and workshop outputs (non-canonical),
- benchmarks (external data, sometimes outdated),
- AI-generated proposals (never canon by default).

This SSOT defines **a precedence ladder** and **a stable partitioning** so that every note/decision lands in the right place.

---

## 2) SSOT ladder (precedence)

When sources conflict, we resolve in this order:

1) **Methodology SSOT (licensed / canonical)**  
   The official methodology definitions, scoring rules, calculation steps, and required inputs.
2) **Product SSOT (Consultify V3)**  
   How the product must behave: workflow, governance, propose→accept, permissions, exports, artifacts.
3) **Data Contract SSOT (runtime contract)**  
   The canonical data model and API contracts. This is “what we store and compute”.
4) **Implementation SSOT (code)**  
   Current implementation is authoritative *only* when it follows 1–3; otherwise it is “as‑is”, not canon.
5) **Knowledge Bank SSOT (Tool Knowledge Pack)**  
   Curated, compressed, structured knowledge used by the AI assistant and UI hints; must cite 1–2 as provenance.
6) **Notes / workshop artifacts / user inputs**  
   Always non-canonical until accepted and written back into 3–5 (propose→accept).

**Rule:** AI outputs are *proposals*. A human acceptance step is required to promote content into SSOT layers 3–5.

---

## 3) What counts as SSOT in this repo (existing anchors)

### 3.1 Product SSOT (V3)

- `docs/product/CONSULTING_TOOLS_V3.md` — module workflow (Library → Sessions → Outputs → Initiatives) + “licensed methodology packs”
- `docs/product/TOOLS_CATALOG_V3.md` — canonical tool catalog + naming
- `docs/product/V3_IMPLEMENTATION_PROGRAM.md` — propose→accept program contract (how we ship features)
- `docs/product/modules/ai/AI_DEEP_RESEARCH_EVIDENCE_SYSTEM_V3.md` — evidence ledger, claim→snippet model (used by tool expert)
- `docs/product/ASSESSMENT_WORKBENCH_STANDARD_V3.md` — canonical workbench UX/process standard for DRD/SIRI/ADMA
- `docs/product/DRD_ASSESSMENT_PACK_V3.md` — DRD pack (SSOT binding to UI/map/report/help)
- `docs/product/SIRI_ASSESSMENT_PACK_V3.md` — SIRI pack (SSOT binding to UI/map/report/help)
- `docs/product/ADMA_ASSESSMENT_PACK_V3.md` — ADMA pack (SSOT binding + T1–T7 mapping/weights + FoF overlay rules)
- `docs/product/ASSESSMENTS_UNIFICATION_IMPLEMENTATION_BACKLOG_V3.md` — implementation backlog (AC) for unification

### 3.2 Runtime/implementation anchors (as-is)

- DRD editor pattern (layout + right nav): `src/components/assessment/drd/DRDAssessmentEditor.tsx`
- Generic shell (left content + right navigation panel): `src/components/assessment/AssessmentToolShell.tsx`
- Knowledge hints (questions/examples/tech per level): `src/services/assessmentKnowledge/*Knowledge.ts`
- RAG storage + retrieval: `server/src/services/ragService.ts` (`knowledge_docs`, `knowledge_chunks`)
- Tool RAG entrypoint (currently DRD-focused): `server/src/services/ai/tools/searchKnowledgeBase.ts`

---

## 4) Tool-by-tool SSOT map

This section defines **canonical sources** + **scope** for KPI / SIRI / ADMA.

### 4.1 KPI (Results module)

- **Methodology SSOT:** (no single licensed canon)  
  KPI definitions depend on domain; our canon is the **product contract** and governance rules.
- **Product SSOT (primary):**
  - `docs/product/RESULTS_V3.md`
  - `docs/product/RESULTS_SURFACES_UX_V3.md`
  - `docs/product/ROI_TRACKING_CONTRACT_V3.md`
  - `docs/product/RESULTS_KPI_DEVIATION_MANAGEMENT_V3.md` (threshold bands + deviation case + action loop)
  - `docs/product/RESULTS_KPI_DEVIATION_IMPLEMENTATION_BACKLOG_V3.md` (AC backlog for deviation mgmt)
- **Knowledge / benchmarks (secondary, tool knowledge packs):**
  - `knowledge/KPI/TOP BGD + KPI v2023 — kopia(BSC).csv`
  - `knowledge/KPI/TOP BGD + KPI v2023 — kopia.xlsx`
- **Implementation SSOT anchors (as-is):**
  - KPI attribution logic: `server/src/services/kpiAttributionService.ts`
  - KPI UI surfaces: `src/components/Benefits/KPIAttributionPanel.tsx`, `src/components/MyWork/Executive/KPIGrid.tsx`, `src/components/RolloutKPITab.tsx`
  - KPI time-series API (as-is): `server/src/routes/benefits.routes.ts` (`/benefits/kpis/:kpiId/time-series`)
  - KPI time-series drawer (as-is): `src/components/Results/KPITimeSeriesDrawer.tsx`

**Canon decisions for KPI:**

- **What is “truth”**: stored KPI baseline/target/time series + attribution artifacts; not a chart screenshot.
- **What is “evidence”**: source system extracts, finance exports, operational system logs, or signed-off governance artifacts.

### 4.2 SIRI (licensed methodology pack)

- **Methodology SSOT (primary):**
  - `knowledge/SIRI/[SIRI Assessor Training] Module 2.pdf` (framework + assessment matrix)
  - `knowledge/SIRI/SIRI-PM Whitepaper.pdf` (Prioritisation Matrix/TIER mechanics and required inputs)
  - `knowledge/SIRI/[SIRI Assessor Training] Module 5.pdf` (assessment facilitation, process/deliverables)
  - Supporting benchmarking context: `knowledge/SIRI/wef_the_global_smart_industry_readiness_index_initiative_2022.pdf`
- **Internal “method notes” (secondary, must not contradict canon):**
  - `wdrozenia/modules/assessment/12-SIRI-METHOD.md`
- **Implementation anchors (as-is):**
  - Structure used in app: `src/services/siriStructure.ts` (3 blocks → 8 dimensions → 16 prioritisation areas, scale 0–5)
  - UI editor: `src/components/assessment/siri/SIRIAssessmentEditor.tsx`
  - Knowledge hints: `src/services/assessmentKnowledge/siriKnowledge.ts`
  - SSOT binding: `docs/product/SIRI_ASSESSMENT_PACK_V3.md` + `knowledge/tool-kb/siri/**`

**Canon decisions for SIRI:**

- **Truth model must preserve raw canon** (16 dimensions with 0–5 scoring) even if UI shows aggregated views.  
  If the UI chooses 8-dimension navigation, the data layer still stores the 16D assessment and defines the aggregation rule explicitly.
- **Evidence-first scoring**: every score must allow evidence capture (links/files/notes) and “why” rationale.
- **Prioritisation Matrix** is a *calculation* step requiring explicit inputs (cost profile, KPI categories, horizon, benchmarks). No “magic”.

### 4.3 ADMA (licensed-like methodology pack / internal canon)

- **Methodology SSOT (primary):**
  - `knowledge/ADMA/ADMA_booklet v5_compressed.pdf`
  - `knowledge/ADMA/ADMA_TranS4MErs_Sample_Scan_Results.pdf`
  - `knowledge/ADMA/ADMA_TranS4MErs_Sample_Transformation_Plan (1).pdf`
  - `wdrozenia/modules/assessment/13-ADMA-METHOD.md` (secondary/internal mapping notes; must not contradict the above)
- **Implementation anchors (as-is):**
  - Structure: `src/services/admaStructure.ts` (5 pillars, 12 dimensions, scale 1–5)
  - UI editor: `src/components/assessment/adma/ADMAAssessmentEditor.tsx`
  - Knowledge hints: `src/services/assessmentKnowledge/admaKnowledge.ts`
  - Seed parity note (watch for id mismatches): `server/migrations/602_adma_seed_parity.sql`
  - SSOT binding: `docs/product/ADMA_ASSESSMENT_PACK_V3.md` + `knowledge/tool-kb/adma/**`

**Canon decisions for ADMA:**

- **Scale starts at 1** (not 0). Default values must be treated carefully: “1 because unassessed” vs “1 explicitly assessed”.
- Evidence capture and rationale are mandatory, same as DRD/SIRI.

---

## 5) Where notes must live (partitioning rules)

To “divide notes” correctly, every piece of content must land in one of these buckets:

- **Methodology clarifications** → `knowledge/<TOOL>/...` or `docs/product/...` *only if* it is a formal product-level decision.  
- **UI/UX behavior** → product SSOT docs (V3) + code.  
- **Assessment answers (client-specific)** → assessment session data (DB + exports), never in global methodology docs.
- **Tool Knowledge Pack (vector/RAG)** → curated per-tool pack files (see `docs/product/TOOLS_KNOWLEDGE_BANK_V3.md`).
- **Benchmarks** → benchmark dataset + version tag + provenance (year/region/industry).
- **AI proposals** → stored as proposals with acceptance gate; once accepted, written into the correct SSOT layer.

---

## 6) DRD-like mechanics (canonical UX pattern for assessments)

For SIRI/ADMA/KPI-style “assessment tools”, we standardize:

- **Center (primary):** “Questions & scoring” for the currently selected area/dimension (+ evidence capture).  
- **Right side (navigation):** blocks/pillars → dimensions → (levels/areas) with progress indicators and quick jump.  
- **Graphic presentation:** always visible in the workspace (matrix/map/radar/gap chart) as the “state mirror”.

DRD already implements this pattern via:

- shell split: `src/components/assessment/AssessmentToolShell.tsx`
- editor: `src/components/assessment/drd/DRDAssessmentEditor.tsx`
- knowledge questions per level: `src/services/assessmentKnowledge/drdKnowledge.ts`

SIRI/ADMA editors are close; the remaining canon is to enforce the same **question bank + evidence + navigation contract** (see Tool Knowledge Bank SSOT).

---

## 7) Runtime Knowledge Base (RAG) — SSOT binding

This section makes the “knowledge base” implementation explicit, so it is not hand-wavy.

### 7.1 Canonical content source (SSOT)

- Tool packs live in: `knowledge/tool-kb/**` (repo SSOT)
- Canonical spec: `docs/product/TOOLS_KNOWLEDGE_BANK_V3.md`

### 7.2 Runtime storage (implementation SSOT)

Tool packs are indexed into the RAG tables:

- `knowledge_docs` — one row per pack file
- `knowledge_chunks` — chunked + embedded content

### 7.3 How indexing is executed (ops contract)

- Operations endpoint: `POST /api/ai-operations/knowledge/tool-packs/index`
- The endpoint ingests all markdown under `knowledge/tool-kb/` (excluding `_templates`).
- The resulting `knowledge_docs.metadata` is the stable mechanism for tool-scoped retrieval.

### 7.4 Note partitioning (important)

- “Tool knowledge” (global, reusable) goes to packs.
- “Client answers” never go to packs; they stay in assessment sessions and exports.
- “AI proposals” must be accepted before they become SSOT (packs/docs/contracts).

---

## 8) Readiness (SSOT completeness) + known gaps (as-is)

**Goal:** be explicit whether we are ready to generate implementation tasks without “unknown unknowns”.

### 8.1 What is complete enough (SSOT)

- Workbench standard exists: `docs/product/ASSESSMENT_WORKBENCH_STANDARD_V3.md`
- Tool packs exist for DRD/SIRI/ADMA (QBank + Help; ADMA also Initiatives): `knowledge/tool-kb/**`
- KPI governance is described (Results + deviation action loop): `docs/product/RESULTS_V3.md` + `docs/product/RESULTS_KPI_DEVIATION_MANAGEMENT_V3.md`
- RAG ingestion contract exists (tool packs → `knowledge_docs`/`knowledge_chunks`): `docs/product/TOOLS_KNOWLEDGE_BANK_V3.md`

### 8.2 Where to read the implementation gaps (code vs SSOT)

- Gap report (task input): `docs/product/TOOLS_GAP_ANALYSIS_V3.md`

