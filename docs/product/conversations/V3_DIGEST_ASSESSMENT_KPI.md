## Scope

Digest rozmów o **Licensed Assessments (DRD/SIRI/ADMA)** oraz o **KPI/ROI (Benefits/Results)** jako dowodzie dowiezienia wartości po wdrożeniu.

## Decisions (hard)

- **Assessment = Licensed Tools**: moduł i mental model powinien komunikować “licencjonowane metodologie”, nie “nasze autorskie narzędzia”.
- **Parity**: SIRI i ADMA muszą osiągnąć **parytet** z DRD (pytania, scoring, wizualizacja wyników, outputy report/deck).
- **Traceability**: outputy (report/deck/initiatives) z assessmentów mają `source_type=assessment` + `source_id=assessmentReportId`.
- **KPI/ROI jako proof**: Results/KPI/ROI to nie “ładny dashboard”, tylko kontrakt: dowozimy po wdrożeniu (plan vs realized).

## Requirements (MUST / SHOULD)

- **MUST**: Methodology Pack jako kanoniczny model metodologii (framework_code + knowledge assets + scoring model + runtime config + output mapping).
- **MUST**: Z assessmentu da się wygenerować report + deck na standardowych generatorach (traceable).
- **MUST**: KPI można agregować z inicjatyw i/lub dodawać globalnie; mapping KPI↔initiative jest widoczny.
- **MUST**: ROI plan vs realized (minimalnie: manual realized + porównanie).
- **SHOULD**: templates report/deck dla DRD/SIRI/ADMA “executive-ready”.
- **SHOULD**: Tool Knowledge Bank (RAG) jako warstwa “konsultant-expert” dla metodologii (evidence-first + propose→accept) oraz zasilanie bazy wiedzy w DB (prod).

## Open questions

- Jak daleko idziemy w “attribution” KPI (heurystyki vs stricte manual assumptions).
- Czy KPI→finanse (mapowanie do BS/P&L/CF) jest R2 czy R1 (w zależności od demo need).

## SSOT impact (files to update / keep aligned)

- `docs/product/ASSESSMENT_WORKBENCH_STANDARD_V3.md`
- `docs/product/RESULTS_V3.md`
- `docs/product/ROI_TRACKING_CONTRACT_V3.md`
- `docs/product/TOOLS_SSOT_SOURCES_V3.md` (KPI/SIRI/ADMA jako SSOT sources)
- `docs/product/TOOLS_KNOWLEDGE_BANK_V3.md` (Tool Knowledge Packs + ingest + runbook)
- `docs/product/TOOLS_GAP_ANALYSIS_V3.md` (code vs SSOT gaps jako podstawa do tasków)

## Backlog extraction (mapowanie na V3)

- **V3-E06** — Tools: Licensed methodologies parity (SIRI/ADMA)
- **V3-H01** — Results: KPI table core (agregacja + add + tracking)
- **V3-H02** — Results: ROI plan vs realized
- **V3-H03** — Results: Operational analysis + ROI analysis views

## Notes (źródła rozmów)

- Cursor transcript: `518c688e-48f6-41f0-909a-629f129253f2` (rename Assessment→Licensed Tools, finalize SIRI+ADMA, KPI/ROI tasks 46–49).
- Cursor transcript: `11b0194f-a470-49fe-ac8d-94207298158c` (SSOT sources ladder, Tool Knowledge Bank/RAG + readiness/gap podejście, SIRI knowledge inputs).

