# Panel 3 specjalistów — 11 narzędzi zbudowanych 07-08 (próg 5,5/6)

Metodyka: A=Merytoryka, B=Ścieżka pracy z klientem, C=Prezentacja (proxy code-review — realny odbiór wizualny=Piotr osobno). Średnia ≥5,5 → DONE. <5,5 → popraw → re-panel.

| Narzędzie | Runda | A | B | C | Średnia | Status |
|---|---|---|---|---|---|---|
| vsm-builder | 1 | 5 | 5 | ? | ? | **BRAK C rundy 1 — dispatch C, potem fix (demand/takt-time martwe, 7 muda nieoperacjonalizowane)** |
| constraint-control | 1 | 5 | 5 | ? | ? | **BRAK C rundy 1 — dispatch C, potem fix (policy-constraint martwy kod w fixture, validation zahardkodowane)** |
| control-tower | 1 | ? | ? | 5 | ? | **BRAK A+B rundy 1 — dispatch, potem fix wg wyniku** |
| automation-pipeline | 1 | 5 | 5 | 6 | 5,33 | **<5,5 — fix WYSŁANY (agent a35dacaede32f136d) ale proces przerwany PRZED commitem. Sprawdź `git log -- src/config/automationpipeline/` — jeśli brak commita "runda 2", uruchom fix od nowa.** |
| robotics-feasibility | — | — | — | — | — | kolejka |
| logistics-automation | — | — | — | — | — | kolejka |
| integration-diagnostic | — | — | — | — | — | kolejka |
| data-inventory | — | — | — | — | — | kolejka |
| decision-engine | — | — | — | — | — | kolejka |
| digital-value-pool | — | — | — | — | — | kolejka |
| legacy-analyzer | — | — | — | — | — | kolejka |

## Braki merytoryczne rundy 1 (dla fixów, zebrane z konwersacji)
- **automation-pipeline**: brak insightu 80/20 (`pathConcentration` zbierane, nieuinsightowane); `ownerReady` tylko informacyjne (nie karze feasibility); sprawdź czy `validation` w auto-sekwencji jest zahardkodowane jak w constraint-control; TCO płytkie proxy.
- **constraint-control**: `validation: VALID` zahardkodowane w `buildW2MoveSequence`, NIE przechodzi przez `validateW2Move` dla auto-sekwencji; ścieżka policy-constraint (insight #3 doktryny) martwa w fixture (`policyConstraintLikely=false` bo capacityGap dodatni) — dodać move z `step:'policy'` LUB scenariusz w fixture gdzie się uruchamia; brak projekcji przyrostu przepustowości z zamknięcia capacity-gap mimo dostępnych danych; Evaporating Cloud tylko tekstowe pytanie bez struktury danych.
- **vsm-builder**: `demand`/`volume` zbierane ale nigdy nie liczone (brak takt time = dostępny czas/popyt, mimo że doktryna wymaga tego w ramowaniu mapy); 7 typów muda zadeklarowane w typie ale nieużywane do różnicowania insightów (`waste`-lever traktuje cały pure-waste jako jeden worek); fixture nie ćwiczy ścieżki pure-waste wcale (wszystkie kroki `value-add`).
- **control-tower**: (tylko C=5 na razie) zero code-review braków zgłoszonych — czeka na A+B.
