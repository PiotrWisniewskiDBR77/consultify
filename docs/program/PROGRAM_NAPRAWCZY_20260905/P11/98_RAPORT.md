# P11 — raport Plan i Obciążenie (DEC-421)

## Werdykt

**PARTIAL / NOT PROVEN.** Warstwa produktu, karty N, listy, generator, nazwy biznesowe i i18n zostały wdrożone. Nie ma jednak podstaw do ogłoszenia pełnego odbioru: lokalna baza nie zawiera opublikowanego scenariusza portfela, więc nie dało się utworzyć pierwszego realnego planu ani przejść całego przepływu klikowego. Brakuje też serwerowej bramki publikacji planu z konfliktami wraz ze śladem potwierdzenia oraz dwóch wymaganych dowodów RealPG. Każdy niespełniony próg ma wiersz w `99_DECYZJE_WLASCICIELA.md`.

## Przed → po

| miara | przed | po | wynik |
|---|---:|---:|---|
| wpisy `REJESTR_KART_N` | 8 | 10 | PASS |
| karty P11 w standardowej powłoce | 0 | 2 | PASS |
| sekcje karty planu | brak karty | 6 | PASS |
| sekcje karty analizy | brak karty | 5 | PASS |
| chipy Menu 3 Plan / Obciążenie | niezgodne | 3 / 3 | PASS |
| CTA Menu 2 Plan / Obciążenie | brak | 1 / 1 | PASS |
| `btn-primary` w treści obu powierzchni | zastane | 0 | PASS |
| `primary-[0-9]` w dotkniętych plikach P11 | niezmierzone | 0 | PASS |
| celowane testy P11 | brak | 13/13 zielone, 0 failed, 0 skipped | PASS |
| pełny przepływ na realnym rekordzie | brak | brak rekordu źródłowego | NOT PROVEN |
| wymagane mutacje | 0/7 udokumentowanych | 0/7 udokumentowanych | NOT PROVEN |

Baseline przed zmianami: `/private/tmp/p11/baza.json` — 19/19 testów zielonych, 0 failed, 0 skipped. Końcowy pakiet celowany: `/private/tmp/p11/final-tests.json` — 13/13 zielonych, 0 failed, 0 skipped. Nowe czerwone w uruchomionych testach: 0.

## Zaimplementowany zakres

- opcjonalne `name` dla planu i analizy obciążenia, zgodne wstecznie na poziomie schematu;
- osobne listy planów i analiz w `StandardTable` z `StandardPreview`;
- `PlanCard` w `StandardArtifactShell`: Horyzont, Zakres inicjatyw, Kolejność i okna, Zależności i konflikty, Obciążenie ról, Decyzje;
- pięciokrokowy generator korzystający z istniejącej propozycji planu; propozycja nie zmienia planu przed statusem `ACCEPTED`;
- `CapacityAnalysisCard`: Plan źródłowy, Arkusz obciążenia, Luki i presja, Propozycje zmian, Decyzje;
- wspólne liczenie luk oraz polski stan `NoCapacityPressureError`;
- nazwy przez `resolveBusinessDisplayLabel`, bez technicznego identyfikatora jako awaryjnej etykiety;
- wpisy `plan` i `capacity_analysis` w rejestrze kart N oraz klucze PL/EN.

## Progi liczbowe i dowody

- Health stanowiska: `GET http://127.0.0.1:4100/api/health` → HTTP 200, `database=connected`.
- PG `127.0.0.1:54400`: odczyt wykonany przed wdrożeniem wykazał 0 agregatów w `ie_aggregate_state`; identyfikator utworzonego planu: **brak / NOT PROVEN**.
- Na tekstach DOM zapisanych przy zrzutach: 0 wystąpień `aco-`, `ie-`, `scenario-<cyfry>` i UUID; 0 angielskich statusów ze stop-listy. Obie realne listy były puste, więc nie jest to dowód etykiety wiersza z danymi.
- Tabela Plan ma pierwszą kolumnę `NAZWA`, lecz przy 0 rekordów nie udowodniono na żywo, że żaden wiersz nie jest inicjatywą.
- Menu 2: dokładnie `Nowy plan` i `Nowa analiza`; Menu 3: po 3 chipy.
- 5 par PNG, wszystkie 1440×900, każda para ma różne SHA-256. Średnia luminancja light/dark:
  - `01-lista-planow`: 249,05 / 20,08;
  - `02-karta-planu`: 247,48 / 23,85;
  - `03-generator-planu`: 246,87 / 26,04;
  - `04-lista-analiz`: 249,07 / 20,02;
  - `05-karta-analizy`: 247,67 / 23,34.
- Zrzuty list pochodzą z realnej aplikacji i nie mają błędów konsoli. Zrzuty kart/generatora pochodzą z dev-render fixture; każdy ma 7 błędów związanych z 404 i pobraniem organizacji, dlatego są dowodem wyglądu zamontowanego komponentu, nie pełnego runtime.
- `check-list-canon.sh` i `check-artefakt.sh`: exit 0, ratchet bez wzrostu długu.
- `esbuild` dla dotkniętych komponentów i testu nazw: exit 0.
- Serwerowy `tsc --build tsconfig.build.json`: exit 0. Końcowy pełny root `tsc --noEmit` z limitem 8 GB: exit 2, 124 zastane błędy TS; filtrowanie wyniku po dotkniętych ścieżkach P11 dało 0 trafień. Nie uznaję pełnego typechecku za zielony.

## Mutacje §6

Powstały testy zabezpieczeń dla zatwierdzania propozycji, źródła listy planów, nazw bez kodów, rejestru i komunikatu braku presji. Nie wykonano jednak siedmiu kontrolowanych zmian RED i nie zapisano siedmiu artefaktów wynikowych. Dwa wymagane testy RealPG (`planPublish.konflikt.realdb.test.ts`, `planScenario.name.realdb.test.ts`) nie powstały. Próg mutacyjny pozostaje **NOT PROVEN**, a brak jest jawnie skierowany do decyzji właściciela.

## Commity

- `0d7417fe0c` — krok 1, nazwy scenariuszy;
- `f490ea40c3` — krok 2, rejestr kart i harness;
- `c0007c62be` — kroki 3–4, menu i chipy;
- `8242889923` — krok 5, lista planów;
- `6254958f48` — krok 8, lista analiz;
- `35b404927c` — kroki 6–7, karta i generator planu;
- `b322329a85` — krok 9, karta analizy;
- `b2adfce247` — kroki 10–11, etykiety i i18n;
- `c1b9b94437` — krok 12, test nazw i dowody wizualne.

## Niezmierzone albo niespełnione

- realne utworzenie planu i jego identyfikator;
- klikany przepływ od `Nowy plan` do zatwierdzenia propozycji i powrotu do listy;
- persistencja `name` oraz zgodność wsteczna na realnym PG;
- blokada publikacji z konfliktami bez potwierdzenia i zapis potwierdzenia w śladzie;
- siedem mutacji zakończonych RED;
- karta z realnym planem 5 inicjatyw / 12 tygodni i przeciążeniem Controls Engineer;
- zrzuty kart bez błędów konsoli na pełnym runtime.
