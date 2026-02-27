# Tools Gap Analysis v3 — DRD / SIRI / ADMA / KPI (SSOT vs code)

> **Cel:** jednoznacznie pokazać “co jest już w kodzie” vs “co SSOT wymaga”, aby można było bezpiecznie generować taski.

## 1) DRD — status i gap

### 1.1 Co jest (code as-is)

- workbench editor: `src/components/assessment/drd/DRDAssessmentEditor.tsx`
- shell: `src/components/assessment/AssessmentToolShell.tsx`
- multi-framework persistence/workflow: `server/src/controllers/AssessmentController.ts`

### 1.2 Braki vs SSOT

- QBank/Help istnieją jako packi, ale UI nadal korzysta z `src/services/assessmentKnowledge/*` (bridge).
- brak jawnego “export deck” kontraktowo dla DRD (jest report generator w backend, ale brak SSOT binding per template w kodzie).

## 2) SIRI — status i gap

### 2.1 Co jest (code as-is)

- runtime model: `src/services/siriStructure.ts` = **8 dimensions** + 16 prioritisation areas (0–5)
- editor + map + report template istnieją:
  - `src/components/assessment/siri/SIRIAssessmentEditor.tsx`
  - `src/components/assessment/maps/SIRIAssessmentMap.tsx`
  - `src/components/assessment/reports/templates/SIRIReportTemplate.tsx`

### 2.2 Krytyczny gap vs SSOT (canon 16D)

SSOT (`docs/product/TOOLS_SSOT_SOURCES_V3.md` + `docs/product/SIRI_ASSESSMENT_PACK_V3.md`) mówi, że:

- “prawda metodologiczna” to **16 dimensions** (Assessment Matrix),
- UI może mieć 8D nawigację, ale data layer ma zachować 16D (i jawne mapowanie).

**W kodzie nie ma 16D modelu** — obecnie dane są zbierane i liczone w 8D.

**Tasky (do utworzenia):**

- dodać kanoniczny model 16D (data contract + UI capture albo import),
- dodać jawne mapowanie 16D→8D (render-only),
- dodać raport/deck z 16D view (appendix) + provenance do źródeł.

## 3) ADMA — status i gap

### 3.1 Co jest (code as-is)

- runtime model: `src/services/admaStructure.ts` = 5 pillars / 12 dimensions (1–5)
- editor + map + report template istnieją:
  - `src/components/assessment/adma/ADMAAssessmentEditor.tsx`
  - `src/components/assessment/maps/ADMAAssessmentMap.tsx`
  - `src/components/assessment/reports/templates/ADMAReportTemplate.tsx`

### 3.2 Krytyczny gap vs SSOT (T1–T7 + FoF)

SSOT (`docs/product/ADMA_ASSESSMENT_PACK_V3.md`) wymaga:

- agregacji 12 dims → **T1–T7** (z wagami),
- overlay **FoF benchmark** w raporcie/decku,
- inicjatyw per “gap→patterns”.

**W kodzie report template nie pokazuje T1–T7 ani FoF overlay** (as-is report jest pillar/dimension centric).

**Tasky (do utworzenia):**

- dodać agregację T1–T7 (library function + testy),
- rozszerzyć `ADMAReportTemplate` o T1–T7 tabelę + benchmark + gap,
- wpiąć pack `adma/initiatives` do generatora inicjatyw (RAG tool-scoped).

## 4) KPI (Results) — status i gap

### 4.1 Co jest (code as-is)

- time-series storage: `kpi_time_series` (zapis przez `server/src/routes/benefits.routes.ts`)
- mapping KPI↔initiative: `initiative_kpi_mappings` + heurystyczna atrybucja:
  - `server/src/services/kpiAttributionService.ts`
- UI drawer istnieje: `src/components/Results/KPITimeSeriesDrawer.tsx`

### 4.2 Krytyczne luki vs SSOT (deviation action loop + kontrakty danych)

- brak implementacji `Deviation Case` (w kodzie brak tabel/serwisów/workflow; SSOT: `docs/product/RESULTS_KPI_DEVIATION_MANAGEMENT_V3.md`)
- progi Green/Amber/Red nie są obsłużone w runtime (w UI i API widać tylko prosty “on target/below”)
- **API mismatch**: `KPITimeSeriesDrawer` oczekuje pól `measuredAt` i “gołych tablic”, backend zwraca `period_start/period_end` i opakowanie `{success,data}`

**Tasky (do utworzenia):**

- ujednolicić kontrakt API time-series (albo zmienić UI, albo backend) + dopisać typy
- dodać threshold bands i deterministyczną ewaluację statusu
- dodać tabelę i workflow `Deviation Case` + notyfikacje + UI “actionable KPI”

## 5) RAG / Knowledge Bank — status i gap

### 5.1 Co jest (code as-is)

- repo tool packs: `knowledge/tool-kb/**`
- indexer + endpoint:
  - `server/src/services/ai/knowledgeIndexer.ts`
  - `POST /api/ai-operations/knowledge/tool-packs/index`
- tool-scoped retrieval: `server/src/services/ai/tools/searchKnowledgeBase.ts` (filters: toolSlug/packType/language)

### 5.2 Brak vs target (external provider + case knowledge)

- brak adaptera do zewnętrznego vector store przez API (SSOT: `docs/product/TOOLS_KNOWLEDGE_BANK_V3.md` §9)
- brak pipeline “capture→review→publish” dla wiedzy z case’ów/klientów (SSOT: `TOOLS_KNOWLEDGE_BANK_V3.md` §10)

