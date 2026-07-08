# Panel 3 specjalistów — 11 narzędzi zbudowanych 07-08 (próg 5,5/6)

Metodyka: A=Merytoryka, B=Ścieżka pracy z klientem, C=Prezentacja (proxy code-review — realny odbiór wizualny=Piotr osobno). Średnia ≥5,5 → DONE. <5,5 → popraw → re-panel.

| Narzędzie | Runda | A | B | C | Średnia | Status |
|---|---|---|---|---|---|---|
| vsm-builder | 1 | 5 | 5 | ? | ? | **BRAK C rundy 1 — dispatch C, potem fix (demand/takt-time martwe, 7 muda nieoperacjonalizowane)** |
| constraint-control | 2 | 5,5 | 5,5 | 6 | 5,67 | **✅ DONE — recenzja C (4/6) + 4 braki naprawione i zweryfikowane runtime (commity 6e… → 4d1b37493a). Harness 11/11 PASS.** |
| control-tower | 2 | 6 | 6 | 5 | 5,67 | **✅ DONE — braki A+B rundy 1 naprawione i zweryfikowane runtime (commit 2e68b62460). Harness 11/11 PASS.** |
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

## control-tower — RUNDA 1 (recenzje A+B) + RUNDA 2 (fix + re-panel, 07-08)

**Recenzja A rundy 1 (Merytoryka) = 5/6.** Silnik w większości partner-grade i wierny doktrynie: `deriveMaturity` liczy poziom 1-5 z FAKTÓW konserwatywnie (ślepy łańcuch ≠ predykcyjny mimo deklaracji, §4.1/§5); detection lag avg 22,2h/worst 36h (§4.2/§6); alert fatigue **wolumenowo-ważony** 0,3 (§4.4); Pareto koncentracji 50%/20% (§6); kontrakt W2 + „skok o JEDEN poziom, nigdy do 5 na brudnych danych" (§4.1/§6). Braki: **(1)** `blindSpots` sortowane WYŁĄCZNIE po `flowValue` (mieszając hard i stale) → move#1 „oświetl najdroższe martwe pole" wskazywał **magazyn-b-lodz** (warehouse z WMS, `integrated:true`) i kazał „zintegrować brakujący feed" dla węzła, który już MA feed — sprzeczne z doktryną §7 i własnymi MOVES/INITIATIVES fixtury (03/07/11). **(2)** Brak połączenia „najbardziej ślepy = najbardziej ryzykowny" (§6/§7) — `blindSpots` i `riskConcentration` liczone niezależnie, sygnaturowy insight worked-example nigdy nie surfacowany. **(3)** `blindShare=round1(13/21)=0,6` → 60% vs doktrynalne 62% (niska waga).

**Recenzja B rundy 1 (Ścieżka klienta) = 5/6.** Drabina (4 dźwignie × 4 szczeble surface→evidence→quantification→risk-capability) realnie progresywna i konkretna; sekwencja W2 wykonalna, ruchy z rationale/trade-off/wariantem-odrzuconym osadzone w liczbach. Braki: **(1)** defekt martwego pola bije w wiarygodność sesji na żywo (klient: „mamy WMS w magazynie B"). **(2)** Model reakcji — dźwignia odróżniająca wieżę od dashboardu (§4.3) — modelowana szczątkowo: drabina pyta o SLA/eskalację/cykl reakcji, ale `ExceptionItem` miał tylko `hasThreshold`/`hasOwner`; odpowiedzi o SLA/eskalacji nie miały gdzie wylądować, move#2 „próg+właściciel+SLA" był w części SLA aspiracyjny. **(3)** Komentarz `depth ... used by the synthesis engine for depth scoring` nieprawdziwy (grep: `depth` konsumuje tylko `localizeLadder`).

**Średnia rundy 1: (5+5+5)/3 = 5,0 < 5,5 → NAPRAWA.**

**Naprawione (commit 2e68b62460), zweryfikowane realnym runtime (`synthesizeControlTowerPlan` na fixture):**
1. **Priorytet martwego pola** — `blindSpots` sortowane teraz po `flowValue × severity weight` (hard=1, stale=0,5): hard blind spot bije stale o równej wartości, ale bardzo duży stale wciąż może wyprzedzić mały hard. Runtime: worst = **dostawca-03-tworzywa** (hard, 680000), nie magazyn-b. Remedy move#1 rozgałęziony wg severity (hard→„zintegruj brakujący feed"; stale→„zautomatyzuj/przyspiesz istniejący zbyt wolny feed") — koniec niespójnej recepty.
2. **„Najbardziej ślepy = najbardziej ryzykowny" (§6/§7)** — gdy najdroższe martwe pole jest zarazem czołem `riskConcentration`, move#1 dokłada zdanie insightu („…i to nie przypadek"). Runtime: worst=03 = riskConc head 03 → insight fires.
3. **Model reakcji ląduje w silniku** — dodane tri-state `hasSla`/`hasEscalation` do read-modelu + adapter (`undefined`=nietrackowane→niekarane, `false`=trackowane-i-brak→ungoverned); wpięte w `ungovernedExceptionShare` (§4.3). Runtime dowód: exc. z `hasSla:false` → ungoverned 100%, `true`/undefined → 0%. Fixture bez pól SLA → 0,4 bez zmian (harness stabilny).
4. **Komentarz `depth`** — poprawiony na zgodny z rzeczywistością (silnik ocenia fakty, nie zasięg rozmowy).

**Re-panel (sceptyczny, na poprawionym kodzie):**
- **A=6 (Merytoryka):** flagowy insight doktryny (§6/§7) teraz poprawny w wyniku i zweryfikowany runtime; priorytet + remedy spójne; reszta silnika bez zmian (wierna). Nit (nie sink): `round1` na udziale PRZED porównaniem z progiem (`blindShare`, `concentrationHeadShare` vs bramki `>=0.5`) może przy wartości granicznej flipnąć — brak realnego/fixture case, kosmetyka.
- **B=6 (Ścieżka klienta):** move#1 spójny z rzeczywistością klienta; wszystkie decyzyjnie-krytyczne wymiary (widoczność, governance wyjątków WŁĄCZNIE z SLA/eskalacją, koncentracja, dojrzałość) lądują w silniku; drabina partner-grade. Residual (nie blokuje DONE): numeryczny cykl reakcji detekcja→decyzja→rozwiązanie (rung quantification response) wciąż bez pola liczbowego (jest tylko `detectionLagHours` źródło→wieża); depth-progress niesledzone (świadomy wybór „oceniaj fakty").
- **C=5 (Prezentacja/code, przeniesione z rundy 1):** esbuild-clean, harness 11/11. Residual nit (jak u siblingów): `const VALID`/`validation: VALID` zahardkodowane w `buildW2MoveSequence` — syntetyzowane ruchy NIE przechodzą przez `validateW2Move` (choć ich treść realnie ma 3 nietrywialne pola, więc nie maskuje defektu; kandydat do rundy 3 dla spójności ze wzorcem `DraftMove`/`validateSequencedMove`).

**Średnia (6+6+5)/3 = 5,67 ≥ 5,5 → DONE.**
Reszta do ew. rundy 3 (nie blokuje DONE): przenieś auto-sekwencję na wzorzec `validateSequencedMove` (usuń hardcoded VALID); dodaj pole numeryczne cyklu reakcji dla rung quantification response; rozważ próg-porównania na wartości surowej zamiast `round1`.
