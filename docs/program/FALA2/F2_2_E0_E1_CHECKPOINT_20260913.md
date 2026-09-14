# F2-2 Realizacja — checkpoint E0 i niezależnej części E1

**Werdykt: FROZEN FOR SECOND INDEPENDENT REVIEW / HOLD — P1 i P2 z pierwszego przeglądu zostały naprawione i mają zielony dowód zachowania; produkcyjna sygnalizacja, szósty filtr i pełne 29/29 pozostają jawnie wstrzymane.**

## Tożsamość

- baza: `bc40d5327c6cf133f8cfd2b0e68a5295fb782189`
- gałąź: `codex/realizacja-cztery-przyciski-20260913`
- flaga: `VITE_EXECUTION_FOUR_BUTTONS`, domyślnie OFF
- migracje: 0 nowych i 0 zmodyfikowanych; migracja nie jest potrzebna

## E0 — wynik do decyzji

`docs/ssot/SYGNALIZACJA_RYZYKA_REALIZACJI.md` opisuje trzy warianty, rekomenduje A jako codzienny widok i C jako legendę oraz zachowuje reguły DEC-487/493. Statyczny ekran w `dev-render/` został zbudowany osobno i sprawdzony lokalnym Playwrightem przy 1440×900.

- light: `evidence/f2-2-realizacja/e0/risk-signal-e0-light-1440x900.png`, SHA-256 `0de99e84b39f4e85013e0a19ff22ef6c9ad06cf1605e170edb7651b7f319ff43`
- dark: `evidence/f2-2-realizacja/e0/risk-signal-e0-dark-1440x900.png`, SHA-256 `85a9713f2dd25d2fc73d997725807aa418f900f54f2da21af4898501b1234f40`
- sumy są różne; oba rendery mają viewport i scroll 1440×900; błędy i ostrzeżenia konsoli: 0
- izolowany build: PASS, 1690 modułów, 12.29 s
- pełny historyczny dev-render: FAIL przez odziedziczony brak importu `AuditFindingsTab`; nie dotyczy nowego entrypointu E0
- zgodność z `8c073b0a`: **EVIDENCE_MISSING**, bo artefakt nie jest dostępny

To nie jest akceptacja właściciela. Nie powstał produkcyjny model, komponent ani filtr sygnału.

## E1 — część niezależna

Bank korzysta z jednego kanonicznego zbioru we wszystkich czterech istniejących widokach. Model:

- zachowuje jeden użytkowy rekord Inicjatywy, wybierając deterministycznie najnowszy `execution_case` jako niewidoczny cień;
- ma filtry projektu, statusu, właściciela, priorytetu i półotwartego okna czasu; `projectId = null` jest jawnym koszykiem;
- pokazuje pozycję względem baseline i forecast/actual z kontrolowanym `asOf`;
- używa wspólnego okna 1/3/6/12 miesięcy w tabeli, kanbanie, kalendarzu i Gantcie;
- przy fladze OFF zachowuje starą tożsamość wierszy; dowodzi tego osobny test regresji.

Focused behavior po naprawach niezależnego przeglądu: **23/23 PASS, 4/4 pliki, retry=0**. Dowód: `evidence/f2-2-realizacja/e0-e1/11-independent-review-fixes-green.log`.

Pełny frontend `tsc --noEmit` kończy się kodem 2 z **189 odziedziczonymi błędami**, czyli nie przekracza rejestru CTO `≤192`. Dwanaście historycznych trafień `ExecutionHub.tsx` leży poza zmienionymi odcinkami; w pozostałych zmienionych plikach nie ma trafień. Dowód: `evidence/f2-2-realizacja/e0-e1/13-typecheck-after-review-fixes.log`.

## Naprawy po pierwszym niezależnym przeglądzie

Raport `INDEPENDENT_REVIEW.md` miał dwa P1 i jedno P2. Wszystkie trzy zostały naprawione:

- flaga OFF zachowuje dokładny legacy denominator i oddzielne renderowanie dwóch `execution_case`; nowe deduplikowanie i kolumny działają wyłącznie przy fladze ON;
- pięć osiągalnych kontrolek projektu, statusu, właściciela, priorytetu i czasu steruje tym samym zbiorem tabeli, kanbanu, kalendarza i Gantta; zachowanie obejmuje jawny koszyk `No project`;
- podgląd nie pokazuje `UNKNOWN` ani `v—`, właściwości są tabelą, a pusta sekcja Relations jest pomijana.

RED→GREEN: `10-independent-review-fixes-red.log` (22/23, porażka oczekująca pojedynczego wiersza legacy) → `11-independent-review-fixes-green.log` (23/23).

## Kontrolowane czerwienie i mianownik

Pełna mapa pozostaje 29/29. Checkpoint: **3 COMPLETE · 21 PARTIAL · 5 MISSING**. Szczegóły: `evidence/f2-2-realizacja/e0-e1/coverage-29-checkpoint.json`.

Test kontraktu pozostaje **2/4 PASS, 2/4 RED**:

1. pełne 29/29 nie jest jeszcze dostarczone;
2. `riskSignalLevels` nie istnieje, ponieważ zależy od nieudzielonej jeszcze akceptacji E0.

Dowód po naprawach: `evidence/f2-2-realizacja/e0-e1/12-controlled-red-after-review-fixes.log`.

## Bramka

Po literze właściciela można zaimplementować dokładnie zaakceptowany wariant sygnalizacji i podłączyć szósty filtr. Bez tej litery E1 pozostaje HOLD, a E2–E4 nie rozpoczynają się w tej paczce.
