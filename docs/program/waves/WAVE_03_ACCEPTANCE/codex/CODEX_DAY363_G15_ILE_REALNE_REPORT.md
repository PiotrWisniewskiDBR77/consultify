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

Do uzupełnienia po R2–R5.

## TWIERDZENIA NIEZWERYFIKOWANE

- Na etapie R1 nie rozstrzygnięto jeszcze mechanizmu każdej czerwieni ani jej statusu artefakt/defekt.
