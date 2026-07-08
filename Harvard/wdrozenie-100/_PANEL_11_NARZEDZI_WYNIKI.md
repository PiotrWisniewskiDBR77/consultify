# Panel 3 specjalistów — 11 narzędzi zbudowanych 07-08 (próg 5,5/6)

Metodyka: A=Merytoryka, B=Ścieżka pracy z klientem, C=Prezentacja (proxy code-review — realny odbiór wizualny=Piotr osobno). Średnia ≥5,5 → DONE. <5,5 → popraw → re-panel.

| Narzędzie | Runda | A | B | C | Średnia | Status |
|---|---|---|---|---|---|---|
| vsm-builder | 1 | 5 | 5 | ? | ? | **BRAK C rundy 1 — dispatch C, potem fix (demand/takt-time martwe, 7 muda nieoperacjonalizowane)** |
| constraint-control | 1 | 5 | 5 | ? | ? | **BRAK C rundy 1 — dispatch C, potem fix (policy-constraint martwy kod w fixture, validation zahardkodowane)** |
| control-tower | 1 | ? | ? | 5 | ? | **BRAK A+B rundy 1 — dispatch, potem fix wg wyniku** |
| automation-pipeline | 2 | 5,5 | 5,5 | 6 | 5,67 | **✅ DONE — 4 braki rundy 1 naprawione i zweryfikowane runtime (commity 505ec3d620 · b69d14d2f7 · e5063c3db4). Harness 11/11 PASS.** |
| robotics-feasibility | — | — | — | — | — | kolejka |
| logistics-automation | — | — | — | — | — | kolejka |
| integration-diagnostic | — | — | — | — | — | kolejka |
| data-inventory | — | — | — | — | — | kolejka |
| decision-engine | — | — | — | — | — | kolejka |
| digital-value-pool | — | — | — | — | — | kolejka |
| legacy-analyzer | — | — | — | — | — | kolejka |

## Braki merytoryczne rundy 1 (dla fixów, zebrane z konwersacji)
- **automation-pipeline**: brak insightu 80/20 (`pathConcentration` zbierane, nieuinsightowane); `ownerReady` tylko informacyjne (nie karze feasibility); sprawdź czy `validation` w auto-sekwencji jest zahardkodowane jak w constraint-control; TCO płytkie proxy.

## automation-pipeline — RUNDA 2 (fix + re-panel, 07-08)
**Naprawione (wszystkie 4 braki rundy 1), zweryfikowane realnym runtime (`synthesizeAutomationPipeline` na fixture):**
1. **80/20** — `isParetoScopable` (koncentracja ≥80% + technicznie gotowy) → `paretoScopable` per proces + `paretoScopableIds`/`paretoMainPathFteHours` w baseline + zasiany insight §6.4 (automatyzuj główną ścieżkę + eskalacja wyjątków). Runtime: pareto=[A, C, E].
2. **ownerReady karze feasibility** — `computeTco.risk` dodaje +2 gdy `ownerReady===false` (bariera organizacyjna, §4.4/§6.8). Runtime dowód: proces E effort 1,8→**2,2** wyłącznie przez brak właściciela; `technicallyReadyNoOwnerIds`/`noOwnerFteHours` + zasiany insight §6.8.
3. **`validation` NIE zahardkodowane** — usunięty `const VALID`; `buildW2MoveSequence` zwraca `DraftMove[]` → `validateSequencedMove` przepuszcza REALNĄ dwujęzyczną treść ruchu przez `validateW2Move` (PL+EN, unia braków). Test negatywny potwierdza że bramka odrzuca pusty/cienki tekst — pass jest zapracowany, nie stały.
4. **TCO pogłębione** — `effortScore` (płaski mnożnik) zastąpione `computeTco` → `TcoBreakdown{implementation, maintenance, risk}`; effort = 0,45·wdrożenie + 0,35·utrzymanie(2-3 lata) + 0,20·ryzyko. Runtime: A[b3/m2/r1,5]→2,3 · D[b5/m4/r2]→4,1 · E[b2/m2/r3]→2,2. Ćwiartki A-D bez regresji (A quick-win, C fill-in, D strategic-bet, B question-mark).
+ fixture: dodano kandydata E (technicznie gotowy, bez właściciela) — instancjuje insight §6.8, wcześniej niereprezentowany.

**Re-panel (sceptyczny, na poprawionym kodzie):**
- **A=5,5 (Merytoryka):** 4 braki domknięte na poziomie doktryny; kontinuum technologii poprawne; TCO realne. Nity: `errorRisk` wpływa i na impact (jakość) i na effort/risk (compliance) — obronne, ale warte nazwania; wagi blendu TCO wiarygodne, ale dobrane pod fixture; archetyp §6.6 (rosnący koszt utrzymania WDROŻONEGO portfela botów > proces manualny) niemodelowany — poza zakresem diagnostyczno-priorytetyzującym, ale nieobecny.
- **B=5,5 (Ścieżka klienta):** pełna ścieżka discover→sekwencja, insight-first, ruchy W2-uzasadnione; 80/20 daje konkretną rekomendację zakresu, insight §6.8 daje pre-krok „wyznacz właściciela przed budżetem". Nit: procesy fill-in/bez-właściciela (E) pojawiają się jako insight, ale NIE wchodzą do sekwencji fal — roadmapa nie planuje pre-kroku governance (konsultant działa z tekstu insightu).
- **C=6 (Prezentacja/code):** esbuild-clean, harness 11/11, wzorce `DraftMove`/`validateSequencedMove` idiomatyczne, walidacja zapracowana (test negatywny gryzie), zero martwego kodu (`TECH_EFFORT_WEIGHT`→`TECH_BUILD_WEIGHT`, brak wiszących ref.), TCO transparentnie w promptcie. Nit: linia per-proces w promptcie gęsta.

**Średnia (5,5+5,5+6)/3 = 5,67 ≥ 5,5 → DONE.**
Reszta do ew. rundy 3 (nie blokuje DONE): sekwencjonuj pre-krok governance dla procesów bez właściciela; rozważ archetyp §6.6 (przegląd wdrożonego portfela botów); odciążyć double-use `errorRisk`.
- **constraint-control**: `validation: VALID` zahardkodowane w `buildW2MoveSequence`, NIE przechodzi przez `validateW2Move` dla auto-sekwencji; ścieżka policy-constraint (insight #3 doktryny) martwa w fixture (`policyConstraintLikely=false` bo capacityGap dodatni) — dodać move z `step:'policy'` LUB scenariusz w fixture gdzie się uruchamia; brak projekcji przyrostu przepustowości z zamknięcia capacity-gap mimo dostępnych danych; Evaporating Cloud tylko tekstowe pytanie bez struktury danych.
- **vsm-builder**: `demand`/`volume` zbierane ale nigdy nie liczone (brak takt time = dostępny czas/popyt, mimo że doktryna wymaga tego w ramowaniu mapy); 7 typów muda zadeklarowane w typie ale nieużywane do różnicowania insightów (`waste`-lever traktuje cały pure-waste jako jeden worek); fixture nie ćwiczy ścieżki pure-waste wcale (wszystkie kroki `value-add`).
- **control-tower**: (tylko C=5 na razie) zero code-review braków zgłoszonych — czeka na A+B.
