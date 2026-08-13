# Gate B — decyzje orkiestratora (nie właścicielskie)

Log decyzji podjętych w toku Gate B zgodnie z DEC-FIN-012 (standardowe/techniczne — decyduje zespół, nie eskalujemy do Piotra). Format: pytanie → decyzja → uzasadnienie → co eskalowane.

## ORCH-DEC-001 — Los `financial_model_events` typu decyzyjnego (WP-B01 pytanie #1)

**Pytanie:** czy retroaktywnie zrekonstruować Prediction Scenario z istniejących eventów decyzyjnych (debt_drawdown itp.), czy zostawić w kwarantannie do ręcznej odtworzenia.

**Decyzja:** migrować jednoznaczne eventy decyzyjne (mają jasny typ, kwotę, datę, statement line target) do nowo utworzonego Prediction Scenario Version oznaczonego `source=migrated_legacy_event`, per organizacja/model. Eventy niejednoznaczne (brak jasnego mapowania na driver/statement line, sprzeczne/duplikujące się) zostają w QUARANTINE z reason code, nie są cicho odrzucane ani cicho migrowane.

**Uzasadnienie:** DEC-FIN-002 wprost mówi że decyzje finansowania należą do Prediction, nie Baseline — więc kierunek migracji jest już przesądzony przez wcześniejszą decyzję właścicielską. To wykonanie tamtej decyzji, nie nowa decyzja biznesowa. Real backfill (WP-C03) wykona to na żywych danych z pełnym dry-run/checksum przed jakimkolwiek zapisem.

## ORCH-DEC-002 — Trzy równoległe magazyny NPV/IRR/ROI (WP-B01 pytanie #2)

**Pytanie:** merge/deprecate/keep dla `financial_analyses`, `analysis_financials`, `initiative_financials`.

**Decyzja:** `financial_analyses` (Historical Analysis Version wg master planu) staje się jedynym kanonicznym źródłem prawdy dla wskaźników/ratios raportowanych klientowi. `analysis_financials` i `initiative_financials` stają się legacy read-modelami, dostępnymi wyłącznie przez adapter z jawnym `ADAPTER_TARGET` (per WP-A02 klasyfikacja), rekoncyliowane przez exception ledger (WP-B05) podczas Gate C shadow-parity, docelowo deprecated po potwierdzonej parity — nie usuwane w tym programie (brak destructive contract phase, zgodnie z zasadą wykonania #5 master planu).

**Uzasadnienie:** to jest dokładnie "reconciliation ledger" i "additive migration + adapters" mechanizm, który program już projektuje (sekcja 4.1, WP-C02/C04) — nie nowa decyzja, zastosowanie istniejącej architektury do konkretnego przypadku. Rozstrzyga to, którą liczbę klient widzi jako prawdziwą (Historical Analysis), zgodnie z DEC-FIN-011 (Analysis jest diagnostyką, nie równoległym źródłem prawdy).

## ORCH-DEC-003 — Moduł M16 "Value Tracking" (WP-B01 pytanie #3) — ESKALOWANE DO PIOTRA

**Pytanie:** czy M16 (żywy, zamontowany, ale nieobecny w rejestrze OWN-FIN i poza 5 nazwanymi narzędziami handoffu) wchodzi w zakres Finance v3.

**Decyzja robocza (tymczasowa, do potwierdzenia):** POZA ZAKRESEM. Handoff definiuje zakres jako dokładnie 5 narzędzi (Statements/Analysis/Baseline/Prediction/Valuation) — M16 nie jest żadnym z nich, a rozszerzenie zakresu o kolejny moduł jest z definicji "istotną zmianą zakresu produktu" (DEC-FIN-012, kategoria eskalacji), nie decyzją techniczną. Program kontynuuje bez M16; jeśli M16 współdzieli tabele z Finance core, zostanie to potraktowane jako zewnętrzny konsument w WP-A02/adapterach, nie jako wewnętrzny zakres.

**Status:** oczekuje na potwierdzenie właścicielskie. Nie blokuje Gate B/C.
