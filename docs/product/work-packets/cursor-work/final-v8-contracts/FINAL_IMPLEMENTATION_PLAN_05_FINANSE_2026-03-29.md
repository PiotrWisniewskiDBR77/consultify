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

## 3. Authority chain (SSOT)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Detailed plan (direct): `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_FINANSE_2026-03-29.md`
- SSOT: `docs/product/FINANCE_CFO_OPERATING_SYSTEM_AND_GOVERNANCE_V8.md`
- Runtime linkage: `docs/product/RESULTS_KPI_AND_FINANCE_ANALYSIS_LINKAGE_RUNTIME_V8.md`

## 4. Softs inspirations (benchmark apps)
- **Primary**: **missing input** — repo wskazuje `Softs/0 Analiza finansowa`, ale nie ma zdistylowanego benchmark doc z nazwami vendorów.
- **Secondary (adjacent)**: spójność „results → consequence” ma być kompatybilna z KPI/execution contracts, ale bez udawania BI/ERP parity.

## 5. Evidence plan (DoD)
- Acceptance: zadeklarowane mutacje odświeżają właściwe rodziny runtime i nie rozbijają KPI truth na deklarowanych ścieżkach.
- Evidence: staging E2E import→analysis→mutation→KPI readback + testy integracyjne krytycznych zależności.

