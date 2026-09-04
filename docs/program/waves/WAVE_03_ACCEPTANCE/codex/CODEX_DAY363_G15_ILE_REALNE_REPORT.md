# Dyżur 363 — G15: ile jest realne

Marker: `2a7273e087cbd3e44344725b524f6ddd79d5badc`.

## R0 — zasady

Orzekam, nie naprawiam produktu ani testów. Mutacja ma trafić w zabezpieczenie, nie w podobny mechanizm. Mianownik i pełne nazwy muszą być identyczne po obu stronach mutacji. Wiersze macierzy odbioru są nietykalne; raport zawiera wyłącznie rekomendacje.

## R1 — zbiór, jednostka i świeży pomiar

Przedmiotem dyżuru jest zbiór B: dziesięć modułów z podtypem `RED_LEGACY_*`, ponieważ to podtyp, a nie sam stan `PARTIAL_PASS`, odpowiada pytaniu o zastaną czerwień. Pomiar daje: zbiór A (`PARTIAL_PASS`) = 10, zbiór B = 10, część wspólna = 6. Dodatkowo fraza `PARTIAL_PASS / SERVER_NOT_MEASURED` występuje w 5 plikach, bo `04_ASSESSMENT` zawiera ją także poza wierszem G15; oczekiwanie 4 dotyczy wierszy G15, a użyta w instrukcji komenda liczy całe pliki.

| Moduł | Numeral podtypu | Czerwieni w treści wiersza | Świeży total | Świeży pass/fail/pending |
| --- | ---: | ---: | ---: | --- |
| 02_INTERVIEW | 7 | 7 | 89 | 88/1/0 |
| 03_TOOLS | 1 | 1 | 621 | 620/1/0 |
| 05_INITIATIVES | 1 | 19 | 873 | 846/18/8 |
| 06_EXECUTION | 1 | 14 | 425 | 412/13/0 |
| 07_MY_WORK_AGENT | 3 | 3 | 582 | 562/4/16 |
| 08_MEETINGS | 1 | 3 | 35 | 32/3/0 |
| 10_FINANCE | 1 | 1 | 924 | 924/0/0 |
| 11_MATERIALS | 2 | 2 | 184 | 182/2/0 |
| 14_ADMIN | 7 | 7 | 248 | 241/7/0 |
| 16_PARTNER | 2 | 9 | 249 | 240/9/0 |
| **Suma** | **26** | **66** | **4230** | **4147/58/24** |

Pod jedną etykietą kryją się trzy jednostki: przypadki, rodziny i pliki. Różnica pomiędzy sumą numeralów a historycznym mianownikiem czerwieni wynosi 40. Świeży pomiar markerowy daje 58 czerwieni, czyli o 8 mniej niż treść dziesięciu wierszy.

Pełne nazwy czerwonych przypadków są w `evidence/g15/day363/r1-nazwy-<moduł>.txt`; surowe JSON-y leżą poza repo w `/private/tmp/cx-day363-g15-ile-realne-artefakty/r1-<nn>.json`.

### Rozbieżności R1

- `02`: 7 → 1 (-6).
- `05`: 19 → 18 (-1).
- `06`: 14 → 13 (-1).
- `07`: 3 → 4 (+1); czwarta czerwień jawnie wymaga nieuruchomionego harnessu 5268.
- `10`: 1 → 0 (-1); pakiet jest dziś zielony 924/924.
- `03`, `08`, `11`, `14`, `16`: liczba czerwieni zgodna z treścią wiersza.
- Artefakty zastane: day336 = 63, day347 = 38 (instrukcja: 39), day351 = 14, day355 katalogi razem = 23 (instrukcja: 22).
- Pierwsza zbiorcza komenda kontroli wejścia została odrzucona przez `zsh: parse error near ')'` przed wykonaniem; pomiar powtórzono prostymi komendami.

### Pułapki środowiska dla pakietów R1

Wszystkie dziesięć przebiegów było czysto frontowych z `RUN_DB_TESTS=0 MOCK_DB=true`, więc nie są dowodem egzekucji ani zapisu DB. Użyto `--retry=0`, JSON reporter i pełne `fullName`. `ENABLE_V8_GLOBAL`, `ENABLE_TEST_AUTH_BYPASS` i `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE` nie były ustawione, ponieważ te przebiegi nie są kwalifikowane jako dowód ścieżki serwerowej; ewentualne testy deklarujące wymóg PostgreSQL są klasyfikowane jako mechanizm pomiarowy, a nie dowód produktu.

## Korekty wobec instrukcji

## R2 — orzeczenie per wiersz

| Moduł | Świeża czerwień | Mechanizm | Werdykt | Na czym stoi |
| --- | ---: | --- | --- | --- |
| 02_INTERVIEW | 1 | kontrakt stopki `InterviewPreviewFooter.ownerContract.test.ts:37` wobec `InterviewTemplatePreviewFooter.tsx` | `REALNY_DEFEKT` | własny przebieg: brak autoryzowanej etykiety Edit |
| 03_TOOLS | 1 | fallback nierozpoznanego kroku w `ToolCanvas.tsx`, asercja `toolCanvas.smoke.test.tsx:95` | `REALNY_DEFEKT` | własny render: brak uczciwego tekstu „This step is being prepared” |
| 05_INITIATIVES | 18 | sześć rodzin: `chatActionHandler`, Menu 3, kanoniczny rejestr, `ExecutionControlSurface`, `ExecutionWork/ResourcesSurface`, narrative marker | `REALNY_DEFEKT` | 18 własnych nazw i komunikatów; 13 nazw współdzielonych z 06 |
| 06_EXECUTION | 13 | `canonicalInitiativeRegisterParity`, `ExecutionControlSurface`, `ExecutionWorkSurface.tsx:597`, `ExecutionResourcesSurface.tsx:405`, nawigacja `InitiativesHub` | `REALNY_DEFEKT` | własny przebieg; brak oczekiwanych kontrolek/etykiet i kontraktu nawigacji |
| 07_MY_WORK_AGENT | 4 | dwa testy oczekują Postgresa przy komendzie unit, jedna zmiana `activeTool`, jeden brak harnessu 5268 | `NIEORZECZONY` | wiersz miesza co najmniej trzy mechanizmy; przebieg z `DB_TYPE=postgres` usunął dwie pierwotne nazwy, ale zmienił skład i uruchomił pięć real-DB nazw mimo `RUN_DB_TESTS=0`, więc nie jest kwalifikowanym A/B |
| 08_MEETINGS | 3 | `MeetingHub` operuje na `null` po błędzie; `MeetingObjectPage` nie renderuje decyzji fixture | `REALNY_DEFEKT` | własny render i trzy odrębne komunikaty |
| 10_FINANCE | 0 | historyczna czerwień nie reprodukuje się | `ARTEFAKT_DOWIEDZIONY` | własny pełny przebieg 924/924; plik nazw jest pusty |
| 11_MATERIALS | 2 | mapowanie poufności `DocumentStudioDocumentPanel.tsx:242` i klasa alarmu `PresentationStudioLayoutCapacityAdminPanel.tsx:628-650` | `REALNY_DEFEKT` | własny render: surowy kod poufności i brak klasy rose |
| 14_ADMIN | 7 | siedem paneli Admin nie zachowuje kontraktów surowej wartości/i18n/unikalności | `REALNY_DEFEKT` | własne pełne nazwy i komunikaty per panel |
| 16_PARTNER | 9 | `EarningsSection`/`CommissionView.tsx:356` oraz mutacje company-info/regions/specializations w `PartnerPortalView` | `REALNY_DEFEKT` | własny render: brak oczekiwanych danych i kontrolek |

Na świeżym mianowniku 58: **0 bieżących czerwieni dowiedzionych jako artefakt**, **54 bieżące czerwienie jako realny defekt**, **4 nieorzeczone**. Historyczny wiersz Finansów jest dowiedzionym artefaktem/starym pomiarem, lecz wnosi dziś zero czerwonych nazw. Listy 54 i 4 są dokładnie sumą odpowiednich plików `r1-nazwy-*`; dla `07` wszystkie cztery nazwy pozostają nieorzeczone.

## R3 — mutacja trafiająca we właściwego strażnika

Warunek potwierdzono w `server/src/services/legacyCutover/requireActiveMembership.ts:34`, odpowiedź 403 w linii 35. Kopię wykonano komendą:

`cp server/src/services/legacyCutover/requireActiveMembership.ts /private/tmp/cx-day363-g15-ile-realne-scratch/requireActiveMembership.ts.before`

Mutacja zmieniła wyłącznie `!== 'ACTIVE'` na `=== '\0NIGDY'`. Przebiegi, zawsze jednym wywołaniem trzech pakietów, dały:

- baza: 68/68 PASS, 3 pakiety; SHA-256 `8611761f406842c771ce8472fffe129f356316aae571bbdfeabd0591aecde3d5`;
- mutacja: 47 PASS / 21 FAIL / 68 total, 3 pakiety; SHA-256 `01dbe4ae95bab34ca25feee177b1c73b68c207ab566f1e89552ee27dadb4a343`;
- po cofnięciu: 68/68 PASS, 3 pakiety; SHA-256 `f5998efa0b982dfa9ec873e4b6ce731f086783330bb855a6052d3e7e4edad179`.

Pełne listy 68 nazw są identyczne: diff baza↔mutacja = 0 dodanych / 0 znikniętych, baza↔final = 0/0. Dwadzieścia jeden czerwonych nazw mutacji zapisano w `evidence/g15/day363/r3-mutacja-czerwone-nazwy.txt`. Mutację cofnięto przez `cp /private/tmp/cx-day363-g15-ile-realne-scratch/requireActiveMembership.ts.before src/services/legacyCutover/requireActiveMembership.ts` z `cwd=server`; diff strażnika jest pusty.

Pierwsze cofnięcie miało błędną ścieżkę względem `cwd=server`, zwróciło `No such file or directory` i nie zostało uznane; poprawne cofnięcie wykonano natychmiast przed kwalifikowanym przebiegiem finalnym. Mutacja obejmowała warunek statusu `requireActiveMembership`, lecz **nie** obejmowała odrębnego strażnika roli `requireFinanceEditorMembership`; wynik nie dowodzi ochrony jego warunku roli.

Wymagane dodatkowe parametry, których nie zawierała kompletna linia przykładowa instrukcji, ale wymagają ich same testy: kanoniczny `JWT_SECRET=test-jwt-secret-key-min-32-chars-long-for-validation`, `FINANCE_MEMBERSHIP_GATE_TEST_DB_PREFIX=cx` i `--no-file-parallelism`. Bez nich dwa pakiety miały po 0 przypadków; te przebiegi odrzucono jako błędy komendy.

### §0.2e — pakiety R3

Wszystkie trzy pakiety biegły z `RUN_DB_TESTS=1`, `MOCK_DB=false`, `DB_TYPE=postgres`, `NODE_ENV=test`, `ENABLE_V8_GLOBAL=true`, `ENABLE_TEST_AUTH_BYPASS=false`, `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`, lokalnym `DATABASE_URL` na `127.0.0.1:6434/cx363`, kanonicznym JWT i `--retry=0`. To wyłącza pułapki (a)–(d). Pułapka (e) została wyłączona realnym PostgreSQL i identyczną listą nazw 68/3 po obu stronach mutacji. Pakiet `financeIntelligence` jest kontrolą braku writerów; jego sześć nazw pozostaje zielonych. `auditsStrictMembership` również pozostaje zielony, bo nie montuje mutowanego strażnika. Całe 21 czerwieni pochodzi z `financeValue.membershipGate` i dowodzi egzekucji dokładnie mutowanego warunku.

### Protokół Z30

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## Korekty wobec instrukcji

- Komenda licząca `PARTIAL_PASS / SERVER_NOT_MEASURED` przeszukuje całe pliki, dlatego zwraca 5 mimo czterech takich wierszy G15.
- Świeży pomiar zbioru B to 58, nie historyczne 66; szczegóły w R1.
- W mutacji właściwego strażnika czerwieni 21 z 44 testów financeValue, nie 11; mianownik pozostaje 68/3.
- Przykładowy komplet env R3 nie zawiera dwóch bramek wymaganych przez same pliki testowe i nie wymusza sekwencyjności; bez korekty pakiety nie wykonują 68 przypadków.

## TWIERDZENIA NIEZWERYFIKOWANE

- Na etapie R1 nie rozstrzygnięto jeszcze mechanizmu każdej czerwieni ani jej statusu artefakt/defekt.
- Cztery nazwy 07 pozostają `NIEORZECZONY`: kwalifikowany, stałomianownikowy A/B dla trzech mechanizmów nie został uzyskany.
- R3 dowodzi ochrony `requireActiveMembership`, ale nie ochrony osobnego warunku roli `requireFinanceEditorMembership`.
