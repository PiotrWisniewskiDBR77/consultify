# Final Implementation Contract — KPI (Position 4/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: draft (contract wrapper over existing plan)

## 1. Executive summary
- **Intent**: KPI są dobrze opisane — teraz trzeba je dobrze zbudować.
- **Primary users**: operatorzy wyników (management/PMO/owner).
- **Success metric**: KPI to nie „dashboard” tylko lane: signal → report/reconciliation → next action, spójne z konsekwencjami finansowymi.

## 2. Scope
### 2.1 In-scope
- KPI inspection + report workflow + reconciliation semantics.
- KPI ↔ finanse: konsekwencje i spójność runtime na deklarowanych ścieżkach.

### 2.2 Out-of-scope / non-goals
- Pełny BI suite (Looker/Tableau parity).
- “Wykresy bez zamknięcia pętli” (to jest anty-cel; KPI ma kończyć się decyzją i akcją).
- Zastąpienie modułu `Finanse` i `Wdrożenia` (KPI ma je zasilać i linkować, nie przejmować).

## 3. Authority chain (SSOT)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Detailed plan (direct): `docs/product/work-packets/cursor-work/wave1-full-audit/WAVE1_FINAL_IMPLEMENTATION_PLAN_KPI_2026-03-29.md`
- SSOT: `docs/product/RESULTS_V8_SSOT.md`
- Runtime linkage: `docs/product/RESULTS_KPI_AND_FINANCE_ANALYSIS_LINKAGE_RUNTIME_V8.md`

## 4. Softs inspirations (benchmark apps)
### 4.1 Primary benchmark family (SSOT)
- Plan modułu wskazuje `Softs/0 KPI` jako primary benchmark family (`WAVE1_FINAL_IMPLEMENTATION_PLAN_KPI_2026-03-29.md`).

### 4.2 Local Softs evidence (concrete artifacts)
- **Quantive (OKR/KPI operating module)**:
  - `Softs/0 KPI/ QUANTIVE/help.quantive.com/en/articles/10738974-revamped-kpi-module-beta.html` (KPI page: filters, tags, grid, bulk actions, saved/shared views).
  - `Softs/0 KPI/ QUANTIVE/help.quantive.com/en/articles/11154200-kpi-chart.html` (KPI chart: periods, aggregation, calculation methods, color-coding, stats cards).
  - `Softs/0 KPI/ QUANTIVE/help.quantive.com/en/articles/11144303-kpi-targets.html` (targets: projection line; prerequisites/permissions; activity history for targets).
- **Databox (metric builder / data source → metric)**:
  - `Softs/0 KPI/Databox/help.databox.com/overview-metric-builder-for-postgresql.html` (Metric Builder: custom metrics via SQL; add to dashboard; constraints like Date column).
- **WorkBoard (operating rhythm + scorecards; anti-vanity doctrine)**:
  - `Softs/0 KPI/WORKBOARD 1/www.workboard.com/resources/blog/avoid-vanity-metrics.html` (“watermelon/vanity metrics” as false-positive signals; focus on what matters).
  - `Softs/0 KPI/WORKBOARD 1/www.workboard.com/resources/blog/reviews-with-scorecards.html` (scorecard as “metrics-on-a-page” + commentary + go-forward plan; reduces manual deck-making).
- **Perdoo (KPI vs OKR doctrine)**:
  - `Softs/0 KPI/PERDOO 1/www.perdoo.com/resources/ebooks-downloads/cheat-sheet-kpis-vs-okrs.html` (doctrine framing KPIs vs OKRs; strategic clarity).
- **Adjacents present in Softs** (not fully distilled here): `Looker`, `Tableau`, `Databox`, `Workboard`, `Perdoo` folders under `Softs/0 KPI/`.

### 4.3 Parity checklist vs Softs (approval-grade)
**Parity oznacza “closed-loop results lane”, nie “BI dashboard builder”.**

- **KPI grid as an operator surface (Quantive)**:
  - Filtry (owner/tag/time period), wyszukiwanie, sortowanie.
  - Widoki zapisane i współdzielone (transparency + alignment).
  - Bulk actions (np. assignment, szybkie tagowanie).
- **KPI chart semantics (Quantive)**:
  - Agregacje (daily/weekly/monthly/quarterly/yearly) + spójność z zakresem czasowym.
  - Metody obliczeń (last/sum/average) jako jawny kontrakt.
  - Color-coding zrozumiały dla operatora (“trend vs direction”).
  - Statystyki typu period-to-date / period-on-period / target vs actual (czytelne, nie mylące).
- **Targets & projection line (Quantive)**:
  - KPI targets jako linia oczekiwań; wymagania uprawnień; edycja i historia zmian (activity log).
- **Scorecards & review cadence (WorkBoard)**:
  - Scorecard = metryki + komentarz + plan działań; ma redukować “deck work” i spory o dane.
- **Anti-vanity & signal honesty (WorkBoard)**:
  - KPI musi unikać “watermelon metrics” i wymuszać jasną semantykę: co jest sygnałem, co jest konsekwencją, co jest działaniem.
- **Metric definition / sourcing (Databox)**:
  - Jawne źródło danych i definicja metryki (np. custom metric builder / query); walidowalność.
- **Consultify-specific bridge (Wave1 intent)**:
  - KPI → Finance consequence → Execution follow-up: spójne przejścia, bez split-truth.

### 4.4 Gap ledger vs Softs (what we are missing — derived from current plans)
Źródło prawdy “co mamy / czego brakuje” to: `WAVE1_FINAL_IMPLEMENTATION_PLAN_KPI_2026-03-29.md` + linkage SSOT.

| Capability cluster (Softs parity target) | What Softs implies | Current truth (per plan) | Gap statement (contract requirement) | Priority |
| --- | --- | --- | --- | --- |
| Closed-loop workflows | KPI must lead to report + reconciliation | “report workflows are too narrow” | Rozszerzyć report workflow: stany, guidance, readback, wynik | P0 |
| Reconciliation semantics | explicit discrepancy handling | “reconciliation depth is limited” | Zdefiniować i dowieźć reconciliation (aligned/pending/requires review) + evidence cues | P0 |
| KPI↔Finance coherence | consequence lane must be coherent | “still not fully unified outside active lane” | Domknąć KPI→Finance runtime unification na deklarowanym zakresie | P0 |
| KPI as operating system (not only dashboard) | scorecard + commentary + next action | “behaves more like bounded dashboard” | Wymusić “next action” flows (execution follow-up) i status tracking | P1

## 5. Product contract (user-facing)
### 5.1 Primary flows
- KPI signal → inspect → report workflow → reconciliation → next action.
- KPI target drift → interpret (trend vs direction) → decide → create/track follow-up.
- KPI discrepancy vs finance → reconciliation state → action owner → resolution.

### 5.2 UI surfaces / entry points
- KPI grid (filter/search/views/bulk) + KPI detail (chart + targets + activity).
- “Scorecard / report” surface: metryki + komentarz + plan działań.
- Link-out: KPI → finance consequence → execution follow-up (z zachowaniem kontekstu).

## 6. Evidence plan (DoD)
### 6.1 Acceptance criteria
- Użytkownik przechodzi KPI→report→reconciliation bez domysłów: są jawne stany i “next action”.
- KPI target/aggregation/trend nie wprowadza w błąd (direction + color-coding + period semantics).
- KPI→Finance consequence działa i nie prowadzi do split-truth na deklarowanym zakresie.

### 6.2 Tests
- Integracyjne: KPI↔Finance linkage (z `RESULTS_KPI_AND_FINANCE_ANALYSIS_LINKAGE_RUNTIME_V8.md`).
- Workflow regression: report generation → reconciliation → follow-up creation.
- Permissions: kto może edytować KPI/targets vs kto tylko przegląda.

### 6.3 Staging proof checklist
- Demo “discrepancy”: KPI signal → report → reconciliation state → finance consequence drill-down → execution follow-up.
- Demo “targets”: ustaw target → odczytaj “target vs actual” → zapisz komentarz/plan działań w scorecard/report.

