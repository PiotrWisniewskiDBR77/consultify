# Stan integracji MVP — 12.09.2026

Cel: pełny MVP właściciela i klienta według S1/S2 i obowiązujących decyzji. Pełna Fala 2 pozostaje dalszym zakresem planu. Plan przyjęty niezależnie; produkt nadal NIEODEBRANY.

Izolowany branch `codex/integrator-mvp-20260912`, baza `7c7dd88091f2a28ad73b55a6fc63d85261991b17`. Owner WIP nietknięty. Brak push/deploy/live.

| Paczka | Stan | Dowód / granica |
| --- | --- | --- |
| C2b | Scalona lokalnie `33b5286283` | Przyjęta dostawa 1629b4e9f3; MOVE poza dostawą, flagi nadal OFF |
| C4 E1–E3 | Scalone lokalnie `e05f3db4d3` | E3 PARTIAL: mniej JS, bez dowodu poprawy zimnego czasu; dwa zastane autoPUT403 na CLOSED pozostają |
| C8 E0 | Scalona lokalnie `6494a5b239` | DEC-470 Coming soon; pełne Finanse pozostają w Fali 2 |
| C4 E4 | Scalona lokalnie `251a15c9f3` po niezależnym odbiorze | Fix1db4da4806: real PG13/13; na kandydacie dodatkowo43/43 pure. Live nieuruchomione |
| C6 | HOLD, poprawki w toku | Sześć findingów w dołączonym review. Nie scalono staregoe29dd98236 |
| Interview | Kolejna paczka po zwolnieniu slotu | Cztery luki UI i brak pełnego cyklu jednego rekordu w browser; szczegóły briefu |

Po połączeniu C2b+C4E1–E3+C8: 66/66 testów w9plikach Finance/Meeting gates i Teresa voice PASS. Log lokalny w handoff `INTEGRATION_FINANCE_VOICE_TESTS.log`. Test komponentu/hooka nie dowodzi realnego dostawcy voice ani runtime całego wydania. Hooki wszystkich trzech merge commitów PASS bez obejścia. TSC serwera (`tsc --noEmit --pretty false`) zakończony exit0 na kandydacie6494a5b239; log pusty. Pełny build, runtime kandydata i bramki live jeszcze nieodebrane.

Kolejność: naprawy C4/C6 → niezależny retest → integracja; równolegle wyłącznie odczyt bramek S1/S2. Następnie Interview, pełny odbiór połączonego kandydata oraz kolejne niezamknięte wymagania. Max2paczki implementacyjne. Pilotaż4osób/14dni, poczta i rzeczywiste wdrożenie pozostają wymagane.

Plan i macierz w tym katalogu są przeniesieniem trwałego handoff integratora, nie nową listą funkcji. 111wierszy obejmuje90doprecyzowań i21odziedziczonych pozycjiW2, nie procent gotowości.

Aktualizacja: C4 E4 fix `1db4da480664276c727e6b7bef905eea1b5086cf` dostarczony przez autora (race13/13 i safety43/43); niezależny retest w toku, nadal HOLD. Autor otrzymał następną paczkę Interview, bez modyfikacji E4.

Końcowy odbiór E4: niezależny13/13 PASS, scalono251a15c9f3. Front build kodu6494a5b239 PASS przy Node8GiB; domyślny build wcześniejOOM, oba logi zachowane. E4 nie zmienia kodu bundla. Server tsc0, backend build w toku. Pełna macierz27bramek S1/S2 dołączona; zachować historyczny akcept S1.1/S1.4 i nie żądać ponownie ogólnego Tak. Heartbeat5min, aktywna praca bez przerw harmonogramowych.

Backend build na251a15c9f3 zakończony exit0: 11runtime mirrors zgodnych, tsc build i kopiowanie fontów PASS. Front type-check w toku. Diff katalogów migracji od7c7dd88091 pusty.
