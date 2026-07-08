# HANDOFF: walidacja 19 wcześniej istniejących narzędzi Tools (panel 3 specjalistów, próg 5,5/6)

**Jesteś tu:** `/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify-wt/tools-19-panel`, gałąź `feat/tools-19-validation-panel` (baza `origin/Londyn`). To STABILNY worktree (NIE `/private/tmp` — tam dziś w nocy zniknęły 2 commity między turami sesji, prawdopodobnie ulotność sandboksa; ten katalog jest bezpieczniejszy).

## Cel (zlecenie Piotra, dosłownie)
„Opracuj wszystkie narzędzia consultingowe do końca. Oceń je trzema specjalistami w skali 1-6: (1) opis merytoryczny, (2) prawidłowa ścieżka pracy z klientem, (3) czy prezentacja graficzna będzie akceptowana. Jeśli średnia <5,5 — dopracuj i oceń ponownie. Pracuj w pętli, aż WSZYSTKIE narzędzia będą ≥5,5. Nie przerywaj — 3 godziny."

**Twój zakres: 19 narzędzi wcześniej istniejących na Londyn** (zbudowane w innych sesjach, NIGDY nie przechodziły tej konkretnej 3-specjalistycznej oceny):

**10 strategicznych PEŁNY** (dedykowany handler `src/hooks/discovery/toolAi/`): dynamic-swot, market-forces, growth-paths, portfolio-priority, risk-uncertainty, value-chain, capability-mapper, ambition-decomposer, focus-tradeoff, narrative-engine.
**9 operacyjnych PEŁNY** (wspólny `operationalTool.ts` + realny config): sop-builder, a3-problem-solving, smed-planner, dms-builder, inventory-autopilot, ai-discovery, pain-explorer, rpa-scanner, process-automation.

**NIE dotykaj** 11 nowych narzędzi (vsm-builder, constraint-control, control-tower, automation-pipeline, robotics-feasibility, logistics-automation, integration-diagnostic, data-inventory, decision-engine, digital-value-pool, legacy-analyzer) — te są w OSOBNEJ gałęzi `feat/tools-assessment-dbr77`, walidowane równolegle przez główną sesję. Zero kolizji.

## ZŁOTE ZASADY (nienaruszalne, z CLAUDE.md)
1. Baza gałęzi = `origin/Londyn` (już jesteś na właściwej). Weryfikuj REALNY runtime (`grep` callerów w src/), nie stare docy.
2. **Commituj NATYCHMIAST po każdej zmianie/pliku** — nie zbieraj partii. Dziś w nocy 2 commity zrobione „na końcu" fizycznie zniknęły przy przerwie sesji. Mały krok → commit → następny krok.
3. **Wymiar 3 (prezentacja graficzna) — NIE możesz go finalnie certyfikować.** Złota zasada projektu: odbiór wizualny = ZAWSZE oczy Piotra na żywych zrzutach, nigdy „testy przeszły". Twoi 3 specjaliści oceniają wymiar 3 jako PROXY przez code-review: struktura treści w komponencie renderującym (`ToolWorkspace`/`ToolCanvas`/`KnownToolDetailView`), spójność z kanonem (tokeny `c-*` NIE `primary-*`=crimson), kompletność etykiet PL/EN, czy karty/sekcje mają sensowną długość (nie ściany tekstu, nie puste). To NIE jest finalny odbiór — jasno to komunikuj w werdykcie.
4. Zero push, zero deploy, zero zapisu do bazy demo.

## Metodyka (analogiczna do panelu DBR77 z tej nocy — patrz `feat/tools-assessment-dbr77` historia commitów jeśli chcesz wzór)
Dla KAŻDEGO z 19 narzędzi, w pętli:

**KROK 1 — Zbadaj realny stan.** Przeczytaj: handler w `src/hooks/discovery/toolAi/{tool}.ts` (lub generyczny `operationalTool.ts` + `src/config/{tool}/`), q-bank/deepeningLadder, promptRegistry branch. Oceń: czy treść jest bogata/insight-first, czy generyczna/płytka.

**KROK 2 — Panel 3 specjalistów** (dispatch 3 agenty Task, każdy inny obiektyw, każdy czyta ten sam bundle: handler+config+ewentualny worked-example/fixture jeśli istnieje):
- **Specjalista A — Merytoryka**: czy opis/q-bank/silnik ma realną głębię doktrynalną (nie ogólniki), czy insighty są „co WYNIKA" nie „co zebrano", czy liczby/kryteria są sensowne. Ocena 1-6.
- **Specjalista B — Ścieżka pracy z klientem**: czy drabina pytań ma sensowną progresję (surface→evidence→decyzja), czy prowadzi konsultanta krok po kroku, czy kończy się wykonalną rekomendacją/inicjatywą. Ocena 1-6.
- **Specjalista C — Prezentacja (proxy code-review)**: jak w Złotej Zasadzie #3 powyżej. Ocena 1-6.
Każdy zwraca: ocena 1-6 + uzasadnienie + KONKRETNE braki do poprawy (nie ogólniki).

**KROK 3 — Średnia.** Jeśli ≥5,5 → narzędzie DONE, zapisz werdykt, przejdź dalej. Jeśli <5,5 → KROK 4.

**KROK 4 — Popraw.** Na podstawie konkretnych braków z panelu: dopisz/wzbogać q-bank, popraw drabinę pytań, wyrównaj tokeny/etykiety. Commituj. Wróć do KROKU 2 (re-panel) dla TEGO narzędzia. Powtarzaj aż ≥5,5.

**Nie przerywaj między narzędziami** — po DONE jednego, od razu KROK 1 następnego. Pracuj przez całe 3 godziny albo aż 19/19 osiągnie próg — co nastąpi pierwsze.

## Śledzenie postępu
Prowadź na bieżąco `Harvard/wdrozenie-100/_PANEL_19_NARZEDZI_WYNIKI.md` — tabela: narzędzie | runda | A | B | C | średnia | status. Commituj po każdej aktualizacji.

## Na koniec (lub gdy skończy się czas)
Napisz `_RAPORT_KONCOWY_19_NARZEDZI.md`: co DONE (≥5,5), co nie zdążyło, co zostało do zrobienia. Nie deployuj, nie pushuj — wszystko zostaje na gałęzi do przeglądu Piotra.
