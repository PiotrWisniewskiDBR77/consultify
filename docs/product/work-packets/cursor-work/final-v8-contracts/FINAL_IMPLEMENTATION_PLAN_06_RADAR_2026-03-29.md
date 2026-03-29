# Final Implementation Contract — Radar (Position 6/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: draft (contract wrapper over existing plan)

## 1. Executive summary
- **Intent**: Radar ma być czytelny + „sexy” i działać jak decyzyjny cockpit (nie nieczytelny wykres).
- **Primary users**: management/PMO; użytkownicy startujący dzień w `MyWork`.
- **Success metric**: Radar mówi: co jest najważniejsze teraz, dlaczego, i co zrobić dalej — z explainability i uczciwym trust boundary.

## 2. Scope
### 2.1 In-scope
- Priorytetyzacja sygnałów + rekomendacje z uzasadnieniem.
- Handoff do downstream modułów (`Inicjatywy`, `Wdrożenia`, `Notatki`).

### 2.2 Out-of-scope / non-goals
- Zastąpienie BI suite; autonomiczne „always correct” rekomendacje.

## 3. Authority chain (SSOT)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Detailed plan (direct): `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_RADAR_2026-03-29.md`
- SSOT stack: `docs/product/MYWORK_RADAR_V8_SSOT.md` (+ powiązane runtime docs wymienione w planie)

## 4. Softs inspirations (benchmark apps)
- **Primary (projects/execution cockpit patterns)**: `Linear` (triage discipline), `ClickUp` / `monday.com` (dashboards + operational signals) z `PROJECT_MANAGEMENT_V8_BENCHMARK.md` i `EXECUTION_MANAGEMENT_BENCHMARK_V8.md`.
- **KPI family**: KPI vendor list w repo = **missing input**, ale cockpit logic może czerpać z execution dashboards patterns.

## 5. Evidence plan (DoD)
- Acceptance: ranking + explainability + handoff działają; user nie musi „czytać całej strony”, żeby zrozumieć co jest P0.
- Evidence: staging demo „signal → why → next action → landing w module docelowym” + testy dla recommendation/trust grammar.

