# Panel 3 specjalistów — 11 narzędzi zbudowanych 07-08 (próg 5,5/6)

Metodyka: A=Merytoryka, B=Ścieżka pracy z klientem, C=Prezentacja (proxy code-review — realny odbiór wizualny=Piotr osobno). Średnia ≥5,5 → DONE. <5,5 → popraw → re-panel.

| Narzędzie | Runda | A | B | C | Średnia | Status |
|---|---|---|---|---|---|---|
| vsm-builder | 2 | 5,5 | 5,5 | 5,5 | 5,5 | **✅ DONE — recenzja C (4/6) + 4 braki (demand/takt martwe · 7 muda nieoperacjonalizowane · validation zahardkodowane · pure-waste nietestowane) + precyzja PCE naprawione i zweryfikowane runtime (commity 6f91769d26 → b034484874). Harness 12/12 PASS.** |
| constraint-control | 2 | 5,5 | 5,5 | 6 | 5,67 | **✅ DONE — recenzja C (4/6) + 4 braki naprawione i zweryfikowane runtime (commity 6e… → 4d1b37493a). Harness 11/11 PASS.** |
| control-tower | 2 | 6 | 6 | 5 | 5,67 | **✅ DONE — braki A+B rundy 1 naprawione i zweryfikowane runtime (commit 2e68b62460). Harness 11/11 PASS.** |
| automation-pipeline | 2 | 5,5 | 5,5 | 6 | 5,67 | **✅ DONE — 4 braki rundy 1 naprawione i zweryfikowane runtime (commity 505ec3d620 · b69d14d2f7 · e5063c3db4). Harness 11/11 PASS.** |
| robotics-feasibility | — | — | — | — | — | kolejka |
| logistics-automation | 2 | 5,5 | 5,5 | 5,5 | 5,5 | **✅ DONE — 5 braków rundy 1 (drabina+bank martwe w runtime · payback #8 zawsze `unknown` · reslot 16%≠17% · komentarz nieścisły) naprawione i zweryfikowane runtime (commity aebc84dabc → 9e1be31571). Harness 12/12 PASS.** |
| integration-diagnostic | — | — | — | — | — | kolejka |
| data-inventory | 2 | 5,5 | 5,5 | 6 | 5,67 | **✅ DONE — 2 defekty silnika (skala 1-5 min czytana jako max · gotowość AI = ŚREDNIA zamiast bramy najsłabszego wymiaru) + 2 martwe assety (drabina + bank propozycji bez callerów) naprawione i zweryfikowane runtime (commity 2abdf51670 · d9d8bd9af2 · aff10a119e). Harness 12/12 PASS.** |
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

## constraint-control — RUNDA 2 (recenzja C + fix + re-panel, 07-08)
**Recenzja C rundy 1 (proxy code-review): OCENA 4/6.** Kod czysty, dwujęzyczny (PL/EN spójny), REALNY caller (`promptRegistry.ts:686` → `buildConstraintConclusionPrompt(toConstraintSession(...))` — nie fantom), self-contained, esbuild-clean, wierny doktrynie, ZERO `primary-*`/crimson (pliki config, brak JSX). ALE 3 defekty korektności + 1 minor:
- **BRAK C-1 (`constraintEngine.ts` const VALID, 5 ruchów):** `validation: VALID` zahardkodowane — `validateW2Move` był martwym kodem dla auto-sekwencji; komentarz „every synthesized move is self-validated" fałszywy (pułapka „wygląda-na-zrobione").
- **BRAK C-2:** ścieżka policy martwa w kanonicznym fixture (`policyConstraintLikely=false`, capacityGap=+3) — flagowy insight §6.3 nie odpalał na własnym worked-example.
- **BRAK C-3:** brak projekcji przyrostu T z zamknięcia luki mimo pełnych danych (§7 Elevate-ROI).
- **BRAK C-4 (minor):** Evaporating Cloud tylko tekst.
+ **Latent bug:** rationale ruchu policy hardkodował „luka ${gap} ≤ 0" — fałszywy gdy policy współistnieje z fizyczną luką.
Średnia rundy 1 (A=5, B=5, C=4) = 4,67 < 5,5 → fix.

**Naprawione, zweryfikowane runtime (`synthesizeConstraintPlan`/`buildConstraintConclusionPrompt` na fixture):**
1. **validateW2Move na żywo** — usunięty `const VALID`; akumulator `Omit<SequencedMove,'validation'>[]` → `withValidation` przepuszcza REALNĄ treść (PL+EN, `mergeW2` unia braków) przez `validateW2Move`. Pass zapracowany.
2. **Ścieżka policy odpala** — fixture: ruch `step:'policy'` (reguła „Partner recenzuje każdy draft osobiście", §7) + para Evaporating Cloud w `evidence[]`. Runtime: `policyConstraintLikely=true`, SEQ = exploit→subordinate→**policy**→elevate.
3. **Projekcja przepustowości** — `computeThroughputProjection`: T/jedn. × luka. Runtime: cap 7, luka 3, T/jedn. 77,1 → **+231,3 T**, Zysk netto 160→**391,3**; na baseline + obie gałęzie Elevate + prompt.
4. **Honest policy rationale** — rozgałęzione `capacityGap<=0` vs `>0` (policy + luka → „domyślna PIERWSZA hipoteza, część luki znika bez CAPEX"). Latent bug usunięty.
+ cleanup: martwy `constraintName/void` + redundantny ternary `roiLine`.
**Zakres #4:** Evaporating Cloud jako ustrukturyzowana treść dowodu (para A/B + ukryte założenie) + wymóg w insight-barze promptu, NIE typowane pole — EC to technika rozumowania, pełny typ = scope creep bez źródła w sesji.

**Re-panel (sceptyczny, na poprawionym kodzie):**
- **A=5,5:** 3 defekty + latent bug domknięte; lokalizacja z kolejki, false-busy nazwany, T/I/OE + 4 wskaźniki poprawne, projekcja modelowana i JAWNIE oznaczona jako estymata, policy żywa, dyscyplina 5FS. Nity: projekcja zakłada shipped≈capacity (zasadne gdy constraint wiążący); EC nietypowany.
- **B=5,5:** drabinka 5×4 partnerska + sekwencja identify(warunkowo)→exploit→subordinate→policy→elevate z REALNIE walidowanymi ruchami W2; policy step = materiał na inicjatywę transformacyjną. Nit: identify pomijany gdy basis=queue (poprawne), sceptyk chciałby jawnego potwierdzenia lokalizacji.
- **C=6:** esbuild-clean, harness 11/11, `validateW2Move` żywy, policy rationale niesprzeczny, zero crimson, realny caller, cosmetics posprzątane.

**Średnia (5,5+5,5+6)/3 = 5,67 ≥ 5,5 → DONE.**
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

## vsm-builder — RUNDA 1 (recenzja C) + RUNDA 2 (fix + re-panel, 07-08)

**Recenzja C rundy 1 (Prezentacja/proxy code-review) = 4/6.** Warstwa prezentacji czysta: pełne PL/EN (`Bilingual` wszędzie, `steps.ts` name/namePl/description/descriptionPl), ZERO `primary-*`/crimson (warstwa logiki, brak JSX), spójna z powłoką generyczną (zarejestrowane w `consultingToolsStandard.ts:246`, `ToolCanvas`, `OperationalToolsView`, `useToolStore`, `promptRegistry` — wzorzec Inventory/SMED). Ale code-review odrzuca 3 defekty „zadeklarowane-lecz-niepodłączone" + 1 fałszywy komentarz:
- **C1 (demand martwy):** `index.ts:140` czyta `session.demand`, silnik nigdy go nie używa; `steps.ts` zbiera krok „Customer demand" *do ramowania takt time*, a takt (dostępny czas/popyt, doktryna §3.3) nigdy nie liczony — wejście podłączone-i-zignorowane.
- **C2 (muda martwe):** `MudaType` (8) + `ProcessStep.muda` zadeklarowane, adapter je parsuje (`index.ts:86,125`), komentarz `vsmEngine.ts:78` mówi „drives insight text" — ale `s.muda` nigdy nieczytane; insight waste traktuje cały pure-waste jako jeden worek.
- **C3 (validation zahardkodowane):** `validation: VALID` na każdym syntetyzowanym ruchu, komentarz twierdzi „every synthesized move is self-validated" — asercja, nie obliczenie.
- **C4 (pure-waste nietestowane):** fixture wszystkie 6 kroków `value-add` → `pureWasteCount=0`, muda nigdy niezasilane; harness nie ćwiczy ścieżki muda.

**Średnia rundy 1: (5+5+4)/3 = 4,67 < 5,5 → NAPRAWA.**

**Naprawione (commity 6f91769d26 · 303ef257c7 · 5c9a685172 · b034484874 + adapter/steps), zweryfikowane realnym runtime (`computeBaseline`/`buildVsmConclusionPrompt` na obu fixturach):**
1. **Takt time (C1)** — `VsmSession.availableTime` + `baseline.taktTime = availableTime/demand` + `overTaktStepIds`; nowy krok wejściowy `availableTime` (PL/EN); adapter czyta `sections['availableTime'][0]`. Runtime (golden): takt=48, żaden krok >takt → insight „proces MA zdolność, problem to kolejki, nie moc" (zgodne z doktryną §7: produkcja ma nadmiar zdolności).
2. **Różnicowanie 7 muda (C2)** — `MUDA_LABEL` (PL/EN) + `wasteByMuda`/`dominantMuda`; ruch waste i insight nazywają dominujące muda. Runtime (waste fixture): `{over-processing:1, transport:1}` → dominant „nadmierne przetwarzanie".
3. **Realna walidacja W2 (C3)** — `buildW2MoveSequence` przepuszcza każdy ruch przez `validateW2Move({rationale,tradeOff,rejectedVariant})` (treść PL) zamiast stałej; komentarz „self-validated" jest teraz prawdziwy. Runtime: wszystkie ruchy `validation.valid===true` (obliczone).
4. **Pokrycie pure-waste (C4)** — `VSM_WASTE_FIXTURE` (proces zatwierdzeń: 2/3 pure-waste, muda over-processing+transport, krok powyżej taktu, %C&A 80% hidden factory) + 12. case w harness. Golden fixture ZOSTAJE wierny doktrynie §7 (all value-add) — §7 to historia kolejek/przeróbek bez pure-waste.
+ **Bonus (precyzja PCE):** `round2` gubił sub-procent (1,6%→2%); `round4` + `formatPcePercent` (1 miejsce) — golden fixture renderuje teraz **PCE 1,6%** i **98,4% czekania** verbatim wg doktryny §7 (spójność silnik↔narracja fixtury).

**Re-panel (sceptyczny, na poprawionym kodzie):**
- **A=5,5 (Merytoryka):** flagowe luki doktryny domknięte i zweryfikowane runtime (demand→takt, muda różnicowane, PCE 1,6% verbatim §7); constraint queue-first + differs-from-intuition poprawne. Nity (nie sink): over-takt liczony z surowego C/T, nie C/T÷uptime (obronialne — §7 traktuje produkcję jako mającą nadmiar zdolności, więc surowe 45<48 zgadza się z narracją); `dominantMuda` po liczbie kroków, nie po lead-time; over-takt nie zasila osobnego RUCHU (tylko insight — takt to ramowanie, nie kaizen).
- **B=5,5 (Ścieżka klienta):** drabina 4 dźwignie × 4 szczeble bez zmian (partner-grade); sekwencja W2 wykonalna i realnie walidowana; krok demand/availableTime teraz prowadzi do widocznego taktu (koniec „po co to zbieram?"). Nit: pre-krok mocy/over-takt nie wchodzi do sekwencji fal (konsultant działa z tekstu insightu).
- **C=5,5 (Prezentacja/code):** esbuild-clean, harness 12/12, pełne PL/EN, zero crimson, zero martwych eksportów (`VSM_WASTE_FIXTURE`/availableTime/muda wszystkie konsumowane), komentarz „self-validated" teraz prawdziwy. Nit: `validation: VALID` wciąż przypisane przy push i nadpisane pętlą (nieszkodliwe, drobny smell).

**Średnia (5,5+5,5+5,5)/3 = 5,5 ≥ 5,5 → DONE.**
Reszta do ew. rundy 3 (nie blokuje DONE): takt uptime-adjusted (C/T÷uptime) z jawnym uzasadnieniem doktrynalnym; `dominantMuda` ważone lead-time; osobny RUCH dla kroków powyżej taktu; usuń redundantny placeholder `validation: VALID`.

## logistics-automation — RUNDA 1 (A=5, B=4, C=6 → 5,0) + RUNDA 2 (fix + re-panel, 07-08)

**Braki rundy 1 (5, udokumentowane):**
1. **[B, najpoważniejszy] Drabina pogłębiająca MARTWA w runtime** — jedynym konsumentem `LOGISTICS_DEEPENING_LADDER` był `buildLogisticsDeepenPrompt`, którego NIC nie wołało w `promptRegistry.ts` (deepen-dispatch a3/sop nieodwzorowany dla logistyki).
2. **[B, drugorzędny] `LOGISTICS_PROPOSAL_BANK` (~192 linie) — ZERO konsumentów** w `src/`/`server/`.
3. **[A, najpoważniejszy] Insight #8 (payback jako obronialna liczba) nigdy nie liczony** — `assessPayback(tech, null)` ZAWSZE z `null` → `verdict` zawsze `'unknown'`; read-model bez pól CAPEX/oszczędności.
4. **[A, drobny] `reslotGainAvailable`=16% (0,1+0,1×0,58) rozjeżdżał się z 17%** deklarowanym w tym samym fixture.
5. **[A, kosmetyczny] Komentarz re-slottingu nieścisły** — „scale by 0.5..1 of full band" gdy faktyczny mnożnik to `clamp(share,0,1)` (0..1).

**Naprawione, zweryfikowane realnym runtime (`toLogisticsSession(LOGISTICS_FIXTURE.sections)` → `computeBaseline`/`rankZones`/`assessPayback`/`buildLogisticsConclusionPrompt`):**
1. **Drabina ŻYWA (B-1)** — `buildLogisticsSectionPrompt` w `promptRegistry.ts` zasila sekcje `zones` (rung kwantyfikacji per strefa przez `buildLogisticsDeepenPrompt`) i `moves` (rung ryzyko/zdolności). ★Kluczowe: dispatch wpięty w OSIĄGALNY blok operacyjny PRZED generycznym early-return; odwzorowanie a3/sop z linii 525 byłoby MARTWE (a3/sop deepen leży PO early-return `OPERATIONAL_TOOL_TYPES` i nie odpala dla narzędzi operacyjnych — sibling-defekt do rundy 3).
2. **Bank propozycji ŻYWY (B-2)** — `LOGISTICS_PROPOSAL_BANK` konsumowany w prompt sekcji `moves` (proces-najpierw poprzedza każdy ruch sprzętowy). 192 linie doktrynalne przestały być martwe.
3. **Payback realny (A-3)** — `estimatedCapex`/`estimatedAnnualSavings`/`reslotGainMeasured` w `WarehouseZone`; `zonePaybackMonths()` + `ZoneScore.paybackMonths`; `assessPayback` dostaje realną liczbę; prompt ma sekcję „PAYBACK — insight #8" z uczciwym fallbackiem „niepoliczalny → NIE zgaduj". Runtime: picking CAPEX 3,8M / oszcz. 2,1M/rok → **payback 21,7 mies., verdict in-band** (pasmo AMR 18-24).
4. **16%→17% (A-4)** — silnik preferuje zmierzony re-slot gain (route-sim §7) nad heurystyką pasma; fixture picking `reslotGainMeasured:0,17`. Runtime: `reslotGainAvailable=0,17`.
5. **Komentarz poprawiony (A-5)** — opisuje `clamp(share,0,1)` skalowania pasma i preferencję pomiaru.

**Re-panel (sceptyczny, na poprawionym kodzie):**
- **A=5,5 (Merytoryka):** flagowy insight #8 (obronialna liczba payback) teraz realny i zweryfikowany runtime (21,7 mies. in-band); proces-przed-technologią mechaniczny; reslot z pomiaru; ranking picking>packing>storage>shipping>receiving zgodny z doktryną. Nity (nie sink): silnik PRZYJMUJE `estimatedAnnualSavings` jako wejście, nie wyprowadza go z delty FTE (ryzyko niespójności savings↔FTE — obronialne, narzędzie diagnostyczne bierze figurę business-case); payback modelowany tylko dla wiodącej strefy (ASRS/storage świadomie `unknown` — odroczony wg §5, poprawne); `reslotGainMeasured` nieclampowany do pasma 10-20% (pomiar bije benchmark — uczciwe).
- **B=5,5 (Ścieżka klienta):** pełna ścieżka context→zones(drabina)→moves(bank proces-najpierw)→summary(sekwencja W2 + payback), drabina i bank teraz ŻYWE (główny sink rundy 1 usunięty), insight-first. Nity: tylko 2 z 4 szczebli wpięte w zasiew sekcji (surface/evidence nie surfacowane w kroku zones); brak znalezionego callera interaktywnego „pogłęb ten szczebel" — drabina zasiana, nie w pełni „wspinalna" na żądanie; `const VALID` (patrz C) osłabia zaufanie do walidacji ruchów.
- **C=5,5 (Prezentacja/code):** esbuild-clean (5 plików), harness 12/12, REALNI callerzy dla OBU ścieżek (conclusion `promptRegistry:829` + teraz suggestion), pełne PL/EN, ZERO crimson (config, brak JSX), liczby zweryfikowane runtime. Nity: `const VALID`/`validation: VALID` wciąż zahardkodowane w `buildW2MoveSequence` (sibling-smell jak vsm — syntetyzowane ruchy nie przechodzą przez `validateW2Move`, choć realnie mają 3 nietrywialne pola); blok banku w promptcie `moves` gęsty.

**Średnia (5,5+5,5+5,5)/3 = 5,5 ≥ 5,5 → DONE.**
Reszta do ew. rundy 3 (nie blokuje DONE): przenieś auto-sekwencję na wzorzec `validateSequencedMove` (usuń hardcoded `VALID`); wepnij surface/evidence rungi w zasiew sekcji lub dodaj interaktywny caller „pogłęb szczebel"; napraw sibling-defekt a3/sop deepen (martwy po early-return `OPERATIONAL_TOOL_TYPES`); rozważ wyprowadzanie `estimatedAnnualSavings` z delty FTE dla spójności.

## data-inventory — RUNDA 1 (A=5/B=4/C=6) + RUNDA 2 (fix + re-panel, 07-08)

**Runda 1: A=5, B=4, C=6 → średnia 5,0 < 5,5 → NAPRAWA.** Cztery udokumentowane braki: (A-1) `asScore01` odwraca minimum skali 1-5 — wartość `1` (najgorsza) czytana jako `1.0` (najlepsza); (A-2) gotowość AI liczona ŚREDNIĄ 5 wymiarów zamiast bramy najsłabszego — domena z availability=0 i resztą ~1.0 dawała ~0,8 i PRZECHODZIŁA próg AI, sprzecznie z własnym bankiem silnika („jeden wymiar na zerze blokuje cały projekt"); (B-3) drabina pogłębiająca `buildDataInventoryDeepenPrompt` bez callerów; (B-4) `DATA_INVENTORY_PROPOSAL_BANK` (185 linii) bez konsumentów.

**Naprawione, zweryfikowane realnym runtime (`toDataInventorySession` → `assessQuality`/`assessAiReadiness` + `buildDataInventoryStepSuggestionPrompt` + harness):**
1. **Skala 1-5 minimum (A-1)** — `asScore01`: granica 0..1 przesunięta na `raw < 1`, więc `1` wpada w gałąź 1-5 (÷5 → 0,2), a minimum skali nie udaje maksimum; ułamki <1 wciąż jako 0..1, 0..100 nietknięte. Runtime probe: `accuracy:1 → 0,2`, `completeness:5 → 1,0`, `consistency:0,6 → 0,6`.
2. **Brama najsłabszego wymiaru (A-2)** — `buildDomainReadiness`: `readiness = Math.min(...scores)` zamiast średniej; pojedynczy wymiar na zerze realnie blokuje domenę niezależnie od reszty (zgodnie z regułą doktryny i istniejącą bramą MIĘDZY domenami). Runtime probe: domena z availability=0, reszta ~0,9 → `readiness=0`, `overall=0`, `ready=false` (stara średnia dałaby ~0,71 i fałszywe „gotowe").
3. **Drabina ŻYWA (B-3)** — nowy `buildDataInventoryStepSuggestionPrompt` mapuje kroki `assets`→inventory, `domains`→jakość+governance+aiReadiness, `useCase`→aiReadiness i wpina `buildDataInventoryDeepenPrompt` w `promptRegistry.getToolSuggestionPrompt` — dispatch w OSIĄGALNYM bloku operacyjnym PRZED generycznym early-return (odwzorowanie logistics; a3/sop z linii 525 są MARTWE po early-return — sibling-defekt do rundy 3).
4. **Bank propozycji ŻYWY (B-4)** — `DATA_INVENTORY_PROPOSAL_BANK` konsumowany w tym samym prompcie jako kandydaci ruchów (wszystkie 4 szczeble jako seed). 185 linii doktrynalnych przestało być martwe. Runtime probe: `domains` prompt len=5191, zawiera markery banku + drabiny + wszystkie 3 dźwignie; `context`/`summary` → null (fall-through do generyka, poprawne).
5. **Fixture (B-5, drobny)** — świadomie ZOSTAWIONY: konsumowany przez harness A ORAZ `__toolsHarnessB_live.mts` dokładnie jak 10 siblingów; żaden sibling nie zasila fixture jako seed runtime — spójne z kohortą, brak zmiany.

**Re-panel (sceptyczny, na poprawionym kodzie):**
- **A=5,5 (Merytoryka):** oba defekty zamknięte i zweryfikowane runtime; reguła „najsłabsze ogniwo" egzekwowana teraz na OBU poziomach (wymiar w domenie + domena między krytycznymi) — spójne. Nity (nie sink): genuine 0..1 score równy dokładnie `1.0` mapuje się teraz na 0,2 (traktowany jak minimum 1-5) — nieusuwalna dwuznaczność wartości `1`, obronialna decyzja doktrynalna, nazwana; brama MIN po ZMIERZONYCH wymiarach — domena z 1 silnym i 4 nieocenionymi czyta się silnie (brak kary za niemierzone — konwencja „assessed-only"); fallback readiness do `qualityOverall` (średnia) gdy brak wymiarów AI — niespójny z bramą MIN, drobny.
- **B=5,5 (Ścieżka klienta):** blokujący defekt rundy 1 (martwa drabina + bank) usunięty i zweryfikowany end-to-end; pełna ścieżka context→assets(inventory)→domains(3 dźwignie)→useCase(aiReadiness)→summary(sekwencja W2 jako inicjatywy), insight-first, Faza 0 przed Fazą 1. Nity: krok `domains` składa 3 dźwignie w jeden prompt na szczeblu `quantification` — pojedynczej dźwigni nie da się pogłębić rung-po-rung tą ścieżką (bank pokrywa 4 szczeble jako seed, ale interaktywny selektor szczebla niewpięty); propozycje banku są generyczne (nagłówek zleca „dopasuj do sesji" modelowi — jak siblingi).
- **C=6 (Prezentacja/code):** esbuild-clean (3 pliki), harness 12/12 (data-inventory len 9857), REALNI callerzy dla OBU martwych eksportów, pełne PL/EN, ZERO crimson (config, brak JSX), liczby zweryfikowane runtime, małe izolowane commity kolizyjno-bezpieczne. Nity: `STEP_LEVERS` kluczowany `Record<string,…>` (rename kroku w `steps.ts` cicho zdejmie zasiew, bez błędu kompilacji); prompt `domains` gęsty (~5,2k znaków); `readiness=Math.min` duplikuje pojęciowo `weakest.score` (nieszkodliwe).

**Średnia (5,5+5,5+6)/3 = 5,67 ≥ 5,5 → DONE.**
Reszta do ew. rundy 3 (nie blokuje DONE): interaktywny caller „pogłęb dźwignię X na szczeblu Y" (dziś rung `quantification` zahardkodowany); typuj `STEP_LEVERS` po id `StepDefinition`; ujednolić fallback readiness (MIN zamiast średniej jakości); wspólny sibling-defekt a3/sop deepen martwy po early-return `OPERATIONAL_TOOL_TYPES`.
