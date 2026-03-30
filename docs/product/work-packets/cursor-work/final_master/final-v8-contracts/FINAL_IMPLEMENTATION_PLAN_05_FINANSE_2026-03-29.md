# Final Implementation Contract — Finanse (Position 5/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: draft (contract wrapper over existing plan)

## 1. Executive summary
- **Intent**: Poprawa modeli (import + dane historyczne) + analityka 1/2/3 poziomów + pełne narzędzia pracy z modelem.
- **Primary users**: owner/management, analityk finansowy, PMO.
- **Success metric**: bounded, ale wiarygodny „consequence-management lane” z uczciwą mutacją i spójnością z KPI oraz inicjatywami.

## 2. Scope
### 2.1 In-scope
- Deklarowane ścieżki finansowe (analysis + mutation) z zachowaniem spójności od KPI do konsekwencji.
- Import/historyczne dane w zakresie opisanym w planie.

### 2.2 Out-of-scope / non-goals
- Pełna parity CFO OS / ERP / accounting suite.
- “Piękne raporty” bez audytowalnej mutacji i bez spójności z KPI (anty-cel).
- Przejęcie ownership finansów “na całej platformie” (tylko zadeklarowane sub-lanes Wave 1).

## 3. Authority chain (SSOT)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Detailed plan (direct): `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_FINANSE_2026-03-29.md`
- SSOT: `docs/product/FINANCE_CFO_OPERATING_SYSTEM_AND_GOVERNANCE_V8.md`
- Runtime linkage: `docs/product/RESULTS_KPI_AND_FINANCE_ANALYSIS_LINKAGE_RUNTIME_V8.md`

## 4. Softs inspirations (benchmark apps)
### 4.1 Primary benchmark family (SSOT)
- Plan modułu wskazuje `Softs/0 Analiza finansowa` jako primary benchmark family (`WAVE1_FINAL_IMPLEMENTATION_PLAN_FINANSE_2026-03-29.md`).

### 4.2 Local Softs evidence (concrete artifacts)
- **Anaplan (modeling + workflow surfaces)**:
  - `Softs/0 Analiza finansowa/anaplan.zip :: anaplan/help.anaplan.com/create-transformation-views-7a0d42ac-97b6-4fb6-a4b5-d2a22be6d81d.html` (transformation view: format source dataset to push into model).
  - `Softs/0 Analiza finansowa/anaplan.zip :: anaplan/help.anaplan.com/publish-a-process-to-a-dashboard-cd348496-8fdb-479b-b2f4-7c1aa5e67146.html` (publish a process as a button on a dashboard; run process).
  - `Softs/0 Analiza finansowa/anaplan.zip :: anaplan/help.anaplan.com/export-versions-62e64f25-a3b4-44ec-bee6-72b8b7b5f839.html` (versions export: current/actual versions, switchover dates, formulas).
- **Apiary (Anaplan Integration API mirror)**:
  - `Softs/0 Analiza finansowa/Apiary.zip :: Apiary/anaplan.docs.apiary.io/∩╣ƒ/introduction/bulk-api-index.html` (Bulk API index page in local mirror).
  - `Softs/0 Analiza finansowa/Apiary.zip :: Apiary/anaplan.docs.apiary.io/∩╣ƒ/introduction/transactional-api-index.html` (Transactional API index page in local mirror).
  - `Softs/0 Analiza finansowa/Apiary.zip :: Apiary/anaplan.docs.apiary.io/∩╣ƒ/reference/import-actions.html` (import actions reference page in local mirror).
  - `Softs/0 Analiza finansowa/Apiary.zip :: Apiary/anaplan.docs.apiary.io/∩╣ƒ/reference/completion-failure-and-data-error-warning-codes-for-import-and-export-actions.html` (error/warning codes page in local mirror).
  - Uwaga: część treści w Apiary mirror może być ładowana dynamicznie (JS), ale obecność tych stron w Softs jest wystarczającym “evidence pointer” do parity checklist.

### 4.3 Parity checklist vs Softs (approval-grade)
**Parity oznacza “consequence-management lane z modelową gramatyką”, nie “ERP/accounting suite”.**

- **Transformation / mapping layer (Anaplan)**:
  - Jawny etap “transform source dataset → model-ready format” (transformation views / mapping).
  - Import nie jest “wrzuć CSV i licz” — musi istnieć warstwa walidacji i dopasowania.
- **Workflow-as-button / action surfaces (Anaplan)**:
  - Procesy/mutacje są produktowe: uruchamiane z dashboardu/operacyjnej powierzchni; mają stan i wynik.
- **Versioning semantics (Anaplan)**:
  - Różnica current vs actual; switchover dates; formuły/version rules są jawne i audytowalne.
- **Import + error taxonomy (Apiary mirror)**:
  - Import/export actions mają completion/failure/error/warning codes jako część kontraktu operacyjnego (to redukuje “zgadywanie” i koszty supportu).
- **Consultify-specific consequence spine**:
  - Finanse muszą utrzymać spójność z KPI i inicjatywami: “results → consequence” bez split-truth.
  - Mutacje finansowe muszą odświeżać właściwe rodziny runtime (jak w planie Wave 1).

### 4.4 Gap ledger vs Softs (what we are missing — derived from current plans)
Źródło prawdy “co mamy / czego brakuje” to: `WAVE1_FINAL_IMPLEMENTATION_PLAN_FINANSE_2026-03-29.md` + governance SSOT.

| Capability cluster (Softs parity target) | What Softs implies | Current truth (per plan) | Gap statement (contract requirement) | Priority |
| --- | --- | --- | --- | --- |
| Broader mutation parity | processes/actions must stay coherent | “mutation parity outside active lane partial” | Domknąć deklarowane mutacje poza wąskim lane, z poprawnym refresh | P0 |
| Lane breadth beyond analysis | models/imports/statements/valuation breadth | “breadth remains uneven” | Ujednolicić minimalną gramatykę: import→analysis→mutation→readback | P0 |
| KPI↔Finance coherence | one consequence truth | “truth fragments outside bounded lanes” | Domknąć runtime unification na zadeklarowanej ścieżce KPI→Finance | P0 |
| Governance & audit clarity | roles + versioning + evidence | “overclaim risk” | Wyraźny kontrakt audytu, wersji, i dowodów mutacji | P1 |

## 5. Evidence plan (DoD)
### 5.1 Acceptance criteria
- Zadeklarowane mutacje odświeżają właściwe rodziny runtime i nie rozbijają KPI truth na deklarowanych ścieżkach.
- Import→analysis→mutation→readback jest spójny i audytowalny (kto/co/kiedy; wynik).
- Versioning (current vs actual / switchover) jest jawne na deklarowanym zakresie (nie “magia w tle”).

### 5.2 Tests
- Integracyjne: KPI↔Finance linkage (z `RESULTS_KPI_AND_FINANCE_ANALYSIS_LINKAGE_RUNTIME_V8.md`).
- Regression: mutacja finansowa → refresh → KPI readback spójny.
- Import validation: błędne dane → czytelny błąd i recovery path (bez silent corruption).

### 5.3 Staging proof checklist
- Staging E2E: import → analysis (L1/L2/L3) → mutation → KPI readback.
- Demo “error taxonomy”: import failure/warning → widoczny stan + rekomendowana akcja.

