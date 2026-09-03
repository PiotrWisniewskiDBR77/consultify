# CODEX DAY 286 — G15 samokontrola integratora

Stan: W TOKU. Marker `35afcb15fd`; baza porównawcza `f65c4ff6a0`; gałąź `codex/day286-g15-samokontrola-20260903`.

## Dowód wejścia

```text
MARKER OK
35afcb15fd7a432ab83df04208eb2114f1aa44e9
git status --short: pusty
```

Tip `github-backup/grafika/m03-20260902` uciekł do przodu; zgodnie z `DEC-2026-08-26-95` praca zaczęła się dokładnie z markera, bez rebase. Nowszy tip scala nadzorca.

## Korekty wobec instrukcji

1. `§0.1`, weryfikacja (5), oczekuje tych samych dziewięciu czerwieni po obu stronach. Pomiar z `--retry=0` dał na bazie `3 failed | 1 passed`, a na markerze `9 failed | 1 passed`. Sześć czerwieni `executionWorkResources` jest zatem NOWYCH; nie wolno ich nazwać zastanymi.
2. `§0.1`, weryfikacja (6), oczekuje pięciu testów bezpiecznika. Lokalny plik na markerze zawiera i uruchamia dwa; wynik `2 passed`. Bezpiecznik jest zielony, lecz liczba autora jest nieaktualna.
3. `§0.1` umieszcza testy przed uruchomieniem bazy, natomiast `Z20` nakazuje najpierw kontener i pełne migracje. Zastosowano bezpieczniejszą regułę `Z20`: lokalny `pgvector/pgvector:pg16` na `127.0.0.1:6290`, 885 migracji w pierwszym przebiegu i 0 w drugim.
4. `§0.1` kieruje do `tests/setup.ts:855-900`; definicja atrapy `global.fetch` zaczyna się później i zwraca `ok: true`, `status: 200`, `{data: []}`. Teza o atrapie jest potwierdzona, wskazany zakres linii jest nieprecyzyjny.
5. Instrukcja odwołuje się do nieobecnego `§0.3` i „tabeli licencji”. W wydanym pliku po `§0.2d` następuje `§0.5`; brakującej tabeli nie improwizowano. Pliki niewymienione imiennie są tylko do odczytu, a zmiana produktu będzie ograniczona do czerwonego testu zgodnie z `Z40`.

## Pomiary wejściowe

- Zasięg produktu między markerami: `118 files changed, 3227 insertions(+), 2583 deletions(-)`.
- Dwie migracje P0 istnieją: `20260903_ai_user_tiers.sql`, `20260903_help_categories.sql`.
- Porty `6290`, `5250`, `5251` były wolne; wolne miejsce przy starcie: 29 GiB.
- Serwerowa komenda kontrolna z cwd `server/` uruchomiła pliki i zakończyła się po 32,35 s; `No test files found` nie wystąpiło.

## Z30 — brak wysyłki

Przed przebiegami zapisującymi: środowisko zwróciło `BRAK ZMIENNYCH POCZTY`; zapytanie `settings WHERE key LIKE 'smtp%'` zwróciło 0 wierszy; `server/src/Gateway.ts` nie montuje drenaży outboxu. Nie uruchomiono `server/src/index.ts` ani żadnego drenażu.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## R1 — mapa i dwa markery

Mapa 16 modułów, katalogi testów, mianowniki i lista współdzielonych zmian znajdują się w `REJESTR_G15_SAMOKONTROLA_20260903.md`. Worktree bazowy `/private/tmp/cx-day286-baza` wskazuje `f65c4ff6a01c1eb3b3bcb2d1e84a1d299649d711`; worktree dyżuru wskazuje `35afcb15fd7a432ab83df04208eb2114f1aa44e9`.

## Pułapki dowodowe

Każdy dalszy pakiet otrzyma indywidualny wpis: atrapa `fetch`, mock bazy, cwd/config serwera, porównanie baza/marker oraz strażniki wyłączające się w `NODE_ENV=test`. Wynik liczbowy bez pełnych nazw z JSON nie będzie traktowany jako dowód G15.

## Tabela G15 per moduł

| Moduł | Plików | Testów na markerze | Zielone | ZASTANE | NOWE naprawione | Pozostałe | Gotowe zdanie G15 |
| --- | ---: | ---: | ---: | --- | --- | --- | --- |
| 01_ORGANIZATION | 11 | 22 | 22 | 0 | 0 | 0; trzy pliki obecne, lecz bez wykonanych przypadków | `G15 PASS — 11 plików, 22/22 przypadki zielone na 35afcb15fd; porównanie z f65c4ff6a0 wykazało 1 czerwień naprawioną dziś i 2 nowe przypadki; brak nowych czerwieni.` |
| 02_INTERVIEW | 26 | 147 | 124 | 7 (4 front, 3 serwer) | 0 | 16 oczekujących testów DB; 1 czerwień naprawiona dziś | `G15 PARTIAL — 26 plików: marker 124 PASS, 7 FAIL potwierdzonych także na f65c4ff6a0, 16 pending; jedna czerwień naprawiona dziś, brak czerwieni NOWYCH; brak tabeli licencji uniemożliwia bezpieczną zmianę 7 zastanych kontraktów.` |
| 03_TOOLS | 36 | 621 | 620 | 1 | 0 | 0 | `G15 PARTIAL — ukierunkowany front: 36 plików, 620/621 PASS; ta sama pełna nazwa jednej czerwieni ToolCanvas występuje na f65c4ff6a0 i 35afcb15fd, brak czerwieni NOWYCH; serwerowe katalogi narzędzi pozostają do pomiaru.` |
| 04_ASSESSMENT | 17 | 620 | 620 po korekcie kontraktu | 0 | 1 (`AssessmentLibraryTab.day178.empty-state`) | 0 | `G15 PARTIAL — ukierunkowany front: baza 608/608 PASS; marker przed korektą 619/620, po korekcie 620/620. NOWA czerwień była nieaktualną asercją wobec zatwierdzonego napisu produktu; serwerowe katalogi Assessment pozostają do pomiaru.` |
| 05_INITIATIVES | 61 | 868 | 840 | 6 | 13 nierozstrzygniętych | 8 pending; 1 czerwień naprawiona dziś | `G15 FAIL — ukierunkowany front: marker 840 PASS, 19 FAIL, 8 pending. Para z f65c4ff6a0 dowodzi 13 czerwieni NOWYCH, 6 ZASTANYCH oraz 1 naprawionej dziś. Bezpiecznik initiativeRecordCanon 2/2 PASS. Brak wydanej tabeli licencji blokuje bezpieczną korektę nowych kontraktów/harnessu.` |
| 06_EXECUTION | 102 | 440 | 426 | 0 | 14 nierozstrzygniętych | 0 | `G15 FAIL — ukierunkowany front: baza 404/404 PASS, marker 426/440 PASS. Wszystkie 14 czerwieni są NOWE, w tym sześć executionWorkResources; brak tabeli licencji blokuje zmianę harnessu/testów lub produktu.` |
| 07_MY_WORK_AGENT | 93 | 566 | 554 | 2 | 1 nierozstrzygnięta | 9 pending | `G15 FAIL — ukierunkowany front: marker 554 PASS, 3 FAIL, 9 pending; para dowodzi 2 czerwieni ZASTANYCH i 1 NOWEJ (MYW-IDEAS-010). Serwer pozostaje do pomiaru.` |
| 08_MEETINGS | 6 | 35 | 32 | 0 | 3 nierozstrzygnięte | 0 | `G15 FAIL — ukierunkowany front: baza 2/2 PASS, marker 32/35 PASS; wszystkie 3 czerwienie są NOWE (dwa uczciwe stany błędu briefu i sekcja decyzji/działań). Serwer pozostaje do pomiaru.` |
| 09_RESULTS | 30 | 418 | 418 | 0 | 0 | 0 | `G15 PARTIAL/PASS front — baza 408/408, marker 418/418; 10 nowych zielonych przypadków, zero czerwieni. Flagi pozostały OFF; serwer pozostaje do pomiaru.` |
| 10_FINANCE | 79 | 924 | 923 | 0 | 1 nowa w zmienionym zakresie | 0 | `G15 FAIL — ukierunkowany front: baza 850/851, marker 923/924. Stary czerwony benchmark 1.2M-cell zniknął, nowy benchmark 1000-cell paste-batch jest czerwony; Z37 zabrania uznać równą liczbę czerwieni za brak zmiany. Flagi pozostały OFF.` |
| 11_MATERIALS | 20 | 184 | 182 | 2 | 0 | 0 | `G15 PARTIAL — ukierunkowany front: marker 182/184 PASS; te same dwie pełne nazwy są czerwone na bazie i markerze, brak czerwieni NOWYCH; serwer pozostaje do pomiaru.` |
| 12_AUDITS | 3 | 17 | 17 | 0 | 0 | 0 | `G15 PARTIAL/PASS front — baza 4/4, marker 17/17; 13 nowych zielonych przypadków, zero czerwieni. Serwer Audytów pozostaje do pomiaru.` |
| 13_CHAT | 45 | 439 | 439 | 0 | 0 | 0 | `G15 PARTIAL/PASS front — baza 416/416, marker 439/439; 23 nowe zielone przypadki, zero czerwieni. Serwer pozostaje do pomiaru.` |
| 14_ADMIN | 38 | 248 | 241 | 7 | 0 | 0 | `G15 PARTIAL — ukierunkowany front: marker 241/248 PASS; te same 7 pełnych nazw czerwonych na bazie i markerze, 6 nowych zielonych przypadków, brak czerwieni NOWYCH. Serwer pozostaje do pomiaru.` |
| 15_SETTINGS | 7 | 13 | 13 | 0 | 0 | 0 | `G15 PARTIAL/PASS front — 13/13 PASS na bazie i markerze, zero zmian nazw i zero czerwieni; serwer poza mianownikiem R1.` |
| 16_PARTNER | 42 uruchomione | 195 | 186 | 0 | 9 nierozstrzygniętych | 0 | `G15 FAIL — ukierunkowany front/unit: baza 112/112 PASS, marker 186/195 PASS. Dziewięć czerwieni jest NOWYCH i dotyczy fail-closed oraz pierwszeństwa tras V8 dla payout/company-info/regions/specializations. Testy RealPG Partnera nie są w tym przebiegu.` |

`MODULE_ACCEPTANCE.md` nie jest edytowany.

### Pułapki — 01_ORGANIZATION

Front jest czysto jednostkowy (`RUN_DB_TESTS=0 MOCK_DB=true`); atrapa `fetch` nie stanowi podstawy żadnej asercji sieciowej w tych czterech przypadkach. Pakiet serwera uruchomiono ponownie z `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6290/cx286 JWT_SECRET=... --retry=0`, z cwd `server/`. Pierwsze przebiegi z `RUN_DB_TESTS=0` dały przypadki oczekujące i nie są zaliczone jako dowód. Para RealPG baza/marker jest podstawą klasyfikacji.

### Pułapki — 02_INTERVIEW

Front uruchomiono z `RUN_DB_TESTS=0 MOCK_DB=true`; cztery czerwienie dotyczą renderowanego kontraktu dostępności, nie wyniku `fetch.ok`. Serwer uruchomiono z cwd `server/`, pełnym env RealPG i `--retry=0`; 16 przypadków pozostało pending mimo `RUN_DB_TESTS=1`, więc nie zaliczono ich jako zielonych. Te same pełne nazwy siedmiu czerwieni występują na bazie i markerze. Brakująca tabela licencji oznacza, że pliki pozostały tylko do odczytu.

### Pułapki — 03_TOOLS

Pakiet frontowy jest jednostkowy (`RUN_DB_TESTS=0 MOCK_DB=true`, `--retry=0`). Czerwień sprawdza renderowany tekst strażnika nieznanego kroku, nie `fetch.ok`; pełna nazwa jest identyczna na obu markerach. Serwerowe 5 plików nie zostało jeszcze uruchomione i nie jest zaliczone do wyniku.

### Pułapki — 04_ASSESSMENT

Pakiet frontowy jest jednostkowy i nie stanowi dowodu sieci/DB. Para JSON pokazała NOWĄ czerwień o dokładnej nazwie `AssessmentLibraryTab day178 empty-state render contract describes an empty static catalog without claiming a load failure`. Produkt na markerze renderuje zatwierdzony, uczciwy napis `Katalog metodyk jest pusty.`; zgodnie z imiennym wyjątkiem `Z40` uaktualniono dokładną asercję, bez jej osłabienia. Ukierunkowany przebieg po zmianie: 1/1 PASS. Serwer nie jest jeszcze zaliczony.

### Pułapki — 05_INITIATIVES

Pakiet jednostkowy uruchomiono identycznie po obu stronach z `RUN_DB_TESTS=0 MOCK_DB=true --retry=0`; klasyfikacja wynika z różnicy pełnych nazw, nie samych liczb. Trzy znane czerwienie `handleChatAction CREATE_INITIATIVE` są potwierdzone po obu stronach. Sześć testów `executionWorkResources` jest NOWYCH i pada, bo filtr `Execution Case` został przeniesiony do callbacku `onRegisterFilterControl`, którego stary test nie montuje; cztery testy `ExecutionControlSurface`, dwie parytetu rejestru oraz intake są także NOWE. To nie jest awaria `fetch.ok`. Bez brakującej tabeli licencji nie wolno zmienić harnessu ani produktu poza imiennymi wyjątkami `Z40`, więc dostarczono czerwony pomiar zamiast improwizacji.

### Pułapki — 06_EXECUTION

Pakiet jednostkowy uruchomiono identycznie po obu stronach z `RUN_DB_TESTS=0 MOCK_DB=true --retry=0`. Baza jest w całości zielona; marker ma 14 nowych pełnych nazw czerwonych, więc klasyfikacja NOWA jest jednoznaczna. Sześć `executionWorkResources` nie znajduje filtra zarejestrowanego przez `onRegisterFilterControl`; osiem dalszych czerwieni obejmuje `ExecutionControlSurface`, parytet rejestru Inicjatyw, intake oraz mobilny dialog `TableWithPreviewLayout`. Wynik nie dowodzi sieci ani DB i nie jest tak przedstawiany. Zamiast nieautoryzowanej zmiany pozostawiono czerwony kontrakt i brief.

### Pułapki — 07_MY_WORK_AGENT

Pakiet uruchomiono jako jednostkowy (`RUN_DB_TESTS=0 MOCK_DB=true --retry=0`). Konsola JSDOM zgłaszała `Not implemented: navigation to another Document`; nie uznano jej ani za PASS, ani osobny FAIL poza JSON. NOWA czerwień dotyczy tekstowego kontraktu ścieżki `MYW-IDEAS-010`, a nie sieci. Dwie pozostałe pełne nazwy są czerwone na obu markerach.

### Pułapki — 08_MEETINGS

Pakiet uruchomiono jako jednostkowy z atrapą bazy i nie jest dowodem realnego HTTP. Dwie z trzech nowych czerwieni jawnie sterują odpowiedzią briefu 500/404 i asertują uczciwy stan błędu; globalne `fetch.ok` nie jest podstawą ich zieleni. Marker ma 33 nowe przypadki względem bazy i trzy z nich są czerwone.

### Pułapki — 09_RESULTS

Pakiet frontowy był czysto jednostkowy (`RUN_DB_TESTS=0 MOCK_DB=true --retry=0`). Nie włączono żadnej flagi Wyników i nie wyprowadzono z zieleni twierdzeń o RealPG, HTTP ani uprawnieniach. Pełne nazwy z JSON potwierdzają 10 dodanych przypadków i brak znikniętych.

### Pułapki — 10_FINANCE

Pakiet frontowy uruchomiono bez włączania flag, jako jednostkowy i bez twierdzeń o DB/HTTP. Porównanie `fullName` wykazało wymianę czerwonego benchmarku, mimo identycznej liczby FAIL. To przykład fałszywej zieleni, przed którą chroni `Z37`; nowego benchmarku nie osłabiono ani nie zwiększono budżetu czasowego.

### Pułapki — 11_MATERIALS

Pakiet frontowy uruchomiono jednostkowo z `--retry=0`; dwie czerwienie dotyczą powłoki/right rail oraz bannera ostrzegawczego, nie `fetch.ok`. Pełne nazwy są identyczne po obu stronach. Pięć nowych przypadków na markerze jest zielonych. Serwer nie jest zaliczony.

### Pułapki — 12_AUDITS

Pakiet frontowy jest jednostkowy; z jego zieleni nie wyprowadzono twierdzeń o trasach, uwierzytelnianiu ani Postgresie. Pełne nazwy wykazują 13 dodanych zielonych przypadków i zero znikniętych.

### Pułapki — 13_CHAT

Pakiet jest jednostkowy; globalne atrapy AI i `fetch` oznaczają, że wynik dowodzi wyłącznie renderowania/kontraktów lokalnych, nie realnej sieci ani modelu. Nie wykonano żadnego wywołania LLM. Pełne nazwy: 23 dodane, zero znikniętych i zero czerwonych.

### Pułapki — 14_ADMIN

Pakiet jest jednostkowy i nie dowodzi realnych zapisów API mimo nazw testów sugerujących readback. Siedem czerwieni ma identyczne pełne nazwy po obu stronach; żadnej nie nazwano NOWĄ. Brak tabeli licencji pozostawia je bez zmiany.

### Pułapki — 15_SETTINGS

Pakiet jest jednostkowy i nie dowodzi trwałości ustawień. JSDOM zgłosił `Not implemented: navigation to another Document`, lecz JSON ma 13/13 PASS po obu stronach. Pełne nazwy są identyczne.

### Pułapki — 16_PARTNER

Pakiet uruchomiono z `RUN_DB_TESTS=0 MOCK_DB=true --retry=0`; nie jest dowodem RealPG ani egzekucji uprawnień. Baza ma zero czerwieni, marker dziewięć, więc wszystkie są NOWE. Ponieważ czerwienie obejmują fail-closed i zakaz legacy mutation, ich osłabienie byłoby szczególnie niebezpieczne. Nie zmieniono palety ani decyzji `DEC-2026-08-29-253`.
