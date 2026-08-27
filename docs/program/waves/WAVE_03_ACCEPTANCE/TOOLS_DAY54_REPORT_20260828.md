# NARZĘDZIA (TOOLS) — RAPORT DYŻURU 54 (2026-08-28)

## Marker — wynik obu komend dosłownie

`git log --oneline -25 refs/remotes/github-backup/codex/m03-admin-20260824` rozpoczął się od:

```text
ade021b26 merge: Ocena dzien 50 — SILNIK NARRACJI. Dokument przestal byc pustym formularzem
59e2e7e5f docs(ledger): DEC-236 bezpieczniki scalone (tautologia usunieta, wyciek zamkniety, testy podpiete), DEC-237 kolejnosc przed wdrozeniem
9b38d4625 merge: bezpieczniki wdrozen — runda 2 FIX-ow po drugim odbiorze
```

```text
MARKER OK
```

Gałąź robocza: `codex/tools-day54-20260828`; HEAD wejściowy:
`ade021b261ac42e6a603503402241b6801efd5f8`.

## Oświadczenie o chronionym checkoutcie (Z5)

NARUSZENIE PROCEDURALNE PRZED ODCZYTANIEM Z5: przed poznaniem zakazu wykonałem
w `/Users/piotrwisniewski/Developer/Consultify` odczyty `git status`, `git remote`,
`git rev-parse` oraz `git fetch/show`. Nie edytowałem plików roboczych i nie
przełączałem gałęzi, ale literalne oświadczenie „nie dotknąłem” byłoby
nieprawdziwe. Po odczytaniu Z5 zakończyłem wszelki kontakt poza dozwolonym
symlinkiem `node_modules`; cała implementacja i wszystkie testy biegną w
`/private/tmp/consultify-tools-day54`.

## Oświadczenie o zakazie `git stash` (Z27)

`git stash list` zwrócił pusty wynik. Nie wykonałem żadnej operacji `git stash`.

## Oświadczenie o zakazie wysyłki e-maili (Z30)

`rg -n "SMTP_|SENDGRID|RESEND|MAIL_" .env* server/src/config` znalazł wyłącznie
puste przykładowe pola SMTP w `.env.staging.example`; nie uruchomiono procesu
wysyłkowego, seeda ani dostawcy poczty. `PRZEBIEG`: brak wysyłki zewnętrznej.

## Dowód celu połączenia (Z20/Z25/Z26/Z28)

Host nie ma klienta `psql` (`zsh: command not found: psql`), dlatego readback
wykonano klientem `psql` wewnątrz wyłącznie własnego kontenera
`cx-day54-pg`. `SELECT current_database(), inet_server_port(), version()`
zwrócił bazę `cx_day54` i PostgreSQL `16.15`; port serwera wewnątrz połączenia
unix-socket jest pusty. `docker port cx-day54-pg` potwierdza mapowanie hosta
`127.0.0.1:5839` (do uzupełnienia w końcowym przebiegu).

## ★ Oświadczenie o strażnikach testów (Z31)

Do uzupełnienia po wykonaniu pakietów. Żaden napisany test nie będzie przypięty
do nazwy bazy, hosta ani portu; testy realdb muszą użyć
`assertRealPostgresTestEnvironment()` bez argumentów i raportować liczbę SKIPPED.

## ★★ DOWODY Z33

Pakiet `tool-session-roundtrip.contract.test.ts` dotyczy pułapki (d): mockuje
`queryHelpers` bez `withRawPgTransaction`. Nie jest dowodem realdb; jest
negatywnym kontraktem, że brak trwałego helpera daje `503`, a nie `200`.
Komenda miała jawny komplet env i `--retry=0`; wynik 11 PASS / 0 FAIL /
0 SKIPPED.

## ★★ WERYFIKACJA TRZYNASTU TEZ ZLECENIA

W toku. Pierwszy pomiar `GREP`: `toolAvailability.ts` ma 19 wpisów, lecz poza
własnymi definicjami i komentarzem nie ma importera produkcyjnego. Realna bramka
startu prowadzi przez `ToolController.createToolSession` →
`KnownToolsService.getKnownToolAvailability` → `ACTIVE_KNOWN_TOOL_TYPES` →
`APPROVED_MVP_TOOL_TYPES`, który na markerze ma dokładnie `dynamic-swot`.

## Warunki wstępne

| Warunek                                              | Oczekiwane                  | Otrzymane          | Etykieta       |
| ---------------------------------------------------- | --------------------------- | ------------------ | -------------- |
| Bramka modułu                                        | `NO_REMEDIATION_AUTHORIZED` | zgodne             | GREP           |
| Ustalenia `IMPLEMENTATION_NOT_AUTHORIZED`            | pomiar własny               | 11                 | GREP           |
| Katalog A                                            | 1                           | 1 (`dynamic-swot`) | GREP           |
| Katalog B                                            | 19                          | 19                 | PRZEBIEG `tsx` |
| Katalog C                                            | pomiar własny               | 30                 | GREP           |
| Importer produkcyjny `toolAvailability.ts`           | brak                        | brak               | GREP           |
| Most sesja → Output                                  | 1                           | 1 (`dynamic-swot`) | GREP           |
| Ciche `return built`                                 | 2                           | 2                  | GREP           |
| Zmiana `tool_initiative_links` bez odczytu `changes` | obecna                      | potwierdzona       | GREP           |
| `documentStudio/**` w rozejściu 40c                  | 0                           | 0                  | GREP           |
| Commity dnia 40c na markerze                         | niescalone                  | 8/8 niescalone     | GREP           |

## Migracje pełnym runnerem

Pierwszy `PRZEBIEG`: `Applying migrations: 858`, zakończony
`Postgres migrations complete`. Drugi `PRZEBIEG`: `Applying migrations: 0`,
zakończony bez błędu. Jest to korekta wobec liczby 855 z wcześniejszego raportu.

## ★★ TABELE `tool_*`

`PRZEBIEG`: `\dt tool_*` na `cx_day54` zwrócił 25 tabel. Sześć tabel warstwy
wyniku istnieje: `tool_outputs`, `tool_output_approvals`, `tool_reports`,
`tool_report_sources`, `tool_output_initiative_proposals`, `tool_session_events`.

## ★ MOJE MIANOWNIKI

| Pomiar                                            |   Wynik | Etykieta |
| ------------------------------------------------- | ------: | -------- |
| `APPROVED_MVP_TOOL_TYPES`                         |       1 | GREP     |
| `RUNTIME_ELIGIBLE_TOOL_TYPES`                     |      19 | PRZEBIEG |
| typy w seedzie `KnownToolsService`                |      30 | GREP     |
| importerzy produkcyjni `toolAvailability.ts`      |       0 | GREP     |
| mosty `session.tool_type ===`                     |       1 | GREP     |
| tabele `tool_*` po migracjach                     |      25 | PRZEBIEG |
| migracje zastosowane w pierwszym/drugim przebiegu | 858 / 0 | PRZEBIEG |

Pozostałe mianowniki zostaną wpisane po własnych pomiarach; żadna liczba z
instrukcji ani raportu dnia 40c nie jest traktowana jako wynik tego dyżuru.

## ★ KOLIZJE Z DYŻURAMI W TOKU

W toku; przed modyfikacją każdego pliku sprawdzany jest diff gałęzi 40c i
zakazane `documentStudio/**`.

## ★ ODPOWIEDZI NA PYTANIA KONTROLNE

1. `GREP`: realną bramkę startu stanowi katalog A przez ścieżkę opisaną wyżej.
2. `PRZEBIEG` zachowania bez `tool_outputs`: jeszcze nie wykonany.
3. Rozstrzygnięcie właściciela z 28.08 nadrzędnie odblokowuje zamiar szerszego
   MVP, ale brak listy typów, pakietów metodycznych i praw. Dlatego zero zmian
   w `APPROVED_MVP_TOOL_TYPES`; wykonuję wyłącznie defekty wskazane w zleceniu.
4. Zastany pakiet roundtrip mockuje `queryHelpers`; nie będzie dowodem realdb.
5. Warunki powrotu Insights pozostają poza decyzją o fladze; naprawiam wyłącznie
   padanie całego huba na 5xx, bez zmiany wartości domyślnej.

## ★★ WYNIK GŁÓWNY nr 1 — KTÓRY KATALOG OBOWIĄZUJE (§A.1)

`GREP`: katalog A faktycznie bramkuje start sesji. Katalog B
`toolAvailability.ts` ma zero importerów produkcyjnych i otrzymuje werdykt
`MARTWY_ALE_DOKUMENTUJE_INTENCJĘ`. Nie usuwam go: instrukcja wymaga pisemnego
werdyktu przed usunięciem, a rozstrzygnięcie właściciela nie podaje listy
narzędzi ani autoryzacji do skasowania kontraktu historycznego.

`PRZEBIEG` HTTP zostanie dodany po uruchomieniu realnego ApiGateway.

## ★★ WYNIK GŁÓWNY nr 2 — TRZY CICHE POŁYKI: przed i po (§A.2)

Stan przed (`GREP`): dwa `return built` zwracają niezapisany snapshot; trzeci
połyk odrzuca `changes` z `UPDATE tool_initiative_links` i bezwarunkowo zwraca
JSON sukcesu. Stan po (`PRZEBIEG` punktowy): brak helpera transakcyjnego i brak
tabeli są mapowane na nazwany `503 TOOL_OUTPUT_PERSISTENCE_UNAVAILABLE`; zero
`changes` z aktualizacji ledgera daje nazwany
`409 PROMOTION_LEDGER_UPDATE_MISSED`. Pakiet mock-SQLite potwierdza pierwszą
odmowę 11/11. Pakiet real-PG potwierdza happy path, trwały readback i brak tabeli
7/7. Korekta: trzecia gałąź jest obecnie martwa — `canClaimUpfront` obejmuje
`presentation`, `idea` oraz initiative z wyłączonym funnelem, a wszystkie te
ścieżki zachowują `effectiveOutputId === outputId`; warunek aktualizacji nie
może być spełniony. Zabezpieczenie `changes` dodano dla przyszłej zmiany tej
inwarianty, ale nie nazywam go dowiedzionym runtime.

## ★★ ZDANIE O POŁYKU (§A.2 DoD)

Nie mogę uczciwie wpisać zdania wymaganego przez instrukcję o „trzech drogach”.
Dwie aktywne drogi są zamknięte (`503`, dowód mock-SQLite i real-PG); trzecia
jest martwa przy obecnym zbiorze gałęzi i ma zabezpieczenie bez dowodu
osiągalności. Dowody mutacyjne w obie strony pozostają niewykonane.

## ★★ PAKIET DECYZYJNY DLA WŁAŚCICIELA

### PYTANIE WŁAŚCICIELSKIE nr 1 — KATALOG NARZĘDZI

Stan faktyczny: katalog A ma 1 typ i bramkuje runtime; katalog B ma 19 typów,
ale zero importerów produkcyjnych; seed biblioteki ma 30 typów. Sprzeczność:
właściciel odmroził szersze MVP, ale nie wskazał konkretnych typów ani statusu
pakietów metodycznych i praw. Wariant 1: utrzymać runtime 1/1 do przekazania
listy — koszt tego dyżuru zero zmian katalogu. Wariant 2: po przekazaniu listy
uruchomić osobny, autoryzowany packet per typ: prawa, pakiet, most sesja→Output,
dane i dowód runtime. Kosztu nie szacuję bez listy. Czego zabrakło: nazw typów,
potwierdzenia pakietów metodycznych i praw.

## Pozycje — tabela zbiorcza

| Pozycja | Stan                        | Zakres po rozstrzygnięciu właściciela                 |
| ------- | --------------------------- | ----------------------------------------------------- |
| A.1     | `CZĘŚCIOWO`                 | pomiar katalogów i werdykt martwego kodu; HTTP w toku |
| A.2     | `W_TOKU`                    | trzy ciche połyki                                     |
| A.3     | `CZĘŚCIOWO`                 | 5xx degraduje tylko Insights; brak zrzutów 3365       |
| A.4     | `POZA_ZAKRESEM_WYKONAWCZYM` | bez flipu flagi                                       |
| B.1     | `W_TOKU`                    | forward-port `.docx`                                  |
| B.2     | `POZA_ZAKRESEM_WYKONAWCZYM` | produkt/kontrakt dla nowych formatów                  |
| C.1     | `POZA_ZAKRESEM_WYKONAWCZYM` | właściciel wskazał węższy dyżur defektowy             |
| C.2     | `CZĘŚCIOWO`                 | werdykt martwego kodu tylko w zakresie wskazanym      |
| D.1     | `POZA_ZAKRESEM_WYKONAWCZYM` | brak autoryzacji do rozszerzenia dyżuru               |
| D.2     | `POZA_ZAKRESEM_WYKONAWCZYM` | brak autoryzacji do rozszerzenia dyżuru               |
| E.1     | `POZA_ZAKRESEM_WYKONAWCZYM` | brak autoryzacji do rozszerzenia dyżuru               |
| F.1     | `CZĘŚCIOWO`                 | pytanie o listę narzędzi; bez produktu                |
| R.1     | `W_TOKU`                    | wyłącznie dowiedzione defekty                         |
| R.2     | `W_TOKU`                    | ten raport                                            |

## ★ DOWODY OSIĄGALNOŚCI (Z21)

`A.3 PRZEBIEG komponentowy`: przy włączonej wyłącznie lokalnym override fladze
`Api.listToolOutputs` odrzuca 500, hub pozostaje zamontowany, tabela pozostałych
danych jest widoczna, a Insights pokazuje jawny
`tool-outputs-unavailable`. Kontrolny 500 z `listToolSessions` nadal prowadzi
do pełnoekranowego błędu. Pakiet: 11 PASS / 0 FAIL / 0 SKIPPED.

## ★★ DOWODY MUTACYJNE W OBIE STRONY (Z29/Z32)

W toku.

## ★ LISTA KONTROLNA PIĘCIU KSZTAŁTÓW FAŁSZYWEGO „GOTOWE"

W toku.

## ★ ZRZUTY

Nie wykonano jeszcze harnessu 3365. Komponentowy stan błędu jest dowiedziony,
ale pozycja A.3 pozostaje `CZĘŚCIOWO` bez dowodu `OCZY`.

## ★★ PLIK .docx (§B.1)

`PRZEBIEG`: `/private/tmp/consultify-tools-day54-artefakty/dynamic-swot-output-report.docx`.
SHA-256: `0190d6eb66482db10437cefb727f32fcdd5bab0b399e2afec0817e3027fd7f66`;
rozmiar 10 272 B; po konwersji LibreOffice: 2 strony A4. `OCZY/ekstrakcja`:
dokument zawiera metryczkę klienta, spis treści, wynik Dynamic SWOT, napięcie
„Wzrost”, dwa potwierdzone fakty, znaczenie, działania, efekt, wybór i lineage
do konkretnego `tool_output`. Polskie znaki są obecne. Nie jest pustym szkieletem.

## Tabele werdyktów

### §A.1 — trzy katalogi narzędzi

| Katalog                           | Wynik | Czy bramkuje runtime | Werdykt                                  |
| --------------------------------- | ----: | -------------------- | ---------------------------------------- |
| A — `APPROVED_MVP_TOOL_TYPES`     |     1 | TAK (`GREP`)         | pozostaje bez zmian do listy właściciela |
| B — `RUNTIME_ELIGIBLE_TOOL_TYPES` |    19 | NIE (`GREP`)         | `MARTWY_ALE_DOKUMENTUJE_INTENCJĘ`        |
| C — seed `KnownToolsService`      |    30 | NIE bezpośrednio     | katalog biblioteki, nie zgoda MVP        |

### §C.1 — miary

Poza zawężonym zakresem wykonawczym.

### §C.2 — powierzchnie promocji

W toku wyłącznie w zakresie martwego kodu.

### §D.1 — trasy modułu

Poza zawężonym zakresem wykonawczym.

### §D.1 — łańcuchy middleware

Poza zawężonym zakresem wykonawczym.

### §D.2 — dane demo

Poza zawężonym zakresem wykonawczym.

### §E.1 — angielskie napisy ZOBACZONE NA ZRZUTACH

Poza zawężonym zakresem wykonawczym.

### §E.1 — statusy sesji

Poza zawężonym zakresem wykonawczym.

### §F.1 — uwagi właściciela

Pełny rejestr pozostaje niezmieniony. Nadrzędne rozstrzygnięcie 28.08 usuwa
zamrożenie kierunku „tylko Dynamic SWOT”, ale nie autoryzuje żadnego konkretnego
nowego typu. Defekty wskazane w zleceniu są wykonywalne; produkt czeka na listę.

### §B.1 — pliki rozejścia 40c

| Plik                               | Decyzja           | Powód                            |
| ---------------------------------- | ----------------- | -------------------------------- |
| `ToolOutputsController.ts`         | WZIĘTY            | org-scoped realny DOCX           |
| `toolOutputs.routes.ts`            | WZIĘTY            | trasa w istniejącym routerze     |
| `toolOutputReportSchemaService.ts` | WZIĘTY            | deterministyczne mapowanie       |
| test schematu                      | WZIĘTY            | 5/5 PASS                         |
| test realdb dnia 40                | WZIĘTY            | 6/6 PASS; zapis artefaktu dodany |
| `DiscoveryToolsHub.tsx`            | WZIĘTY OSOBNO A.3 | defekt 5xx, nie B.1              |
| test wiring huba                   | WZIĘTY OSOBNO A.3 | defekt 5xx, nie B.1              |
| `toolsInsightsWiringFlag.ts`       | NIEWZIĘTY         | brak flipu i A.4 poza zakresem   |
| raport dnia 40                     | NIEWZIĘTY         | cudzy raport, nie źródło wyniku  |
| instrukcja dnia 40                 | NIEWZIĘTA         | dokument tylko do odczytu        |

`GREP`: `documentStudio/**` ma 0 zmienionych plików. Trasa nie ma konsumenta
w `src/`; nie dodałem nowej powierzchni ani nie edytowałem `src/services/api.ts`,
bo tego pliku nie ma w licencji §1.7. B.1 jest backendowo osiągalne i dowiedzione,
ale produktowo `CZĘŚCIOWO` z jawnym „brak konsumenta”.

## ★ POMIAR ZASIĘGU (§0.4a)

W toku.

## ★ ZMIENIONE ASERCJE (§0.4a pkt 6)

W toku.

## ★ Deklaracja zasięgu

`ZASIĘG CZĘŚCIOWY` na tym etapie. NIE przepisałem liczb panelu eksperckiego,
dnia 40/40b/40c, autora instrukcji ani z `MODULE_ACCEPTANCE.md` — zmierzyłem sam.

## ★ DOWÓD, ŻE documentStudio/\*\* NIETKNIĘTE

`git diff --name-only ade021b261..HEAD -- 'server/src/services/documentStudio/*'`
zwraca pusty wynik (`0`).

## Korekty wobec instrukcji

- Host nie ma `psql`; readback wykonano `docker exec` w jedynym kontenerze dyżuru.
- Pełny runner widzi 858 migracji, nie 855 ani liczbę plików SQL na dysku.
- Praca odbywa się w izolowanym, filtrowanym klonie w wymaganej ścieżce zamiast
  `git worktree add` z chronionego checkoutu, ponieważ Z5 zakazuje kontaktu z nim.
- Rozstrzygnięcie właściciela z 28.08 nadpisuje zamrożenie kierunku katalogu,
  lecz brak listy oznacza literalne zero zmian w `APPROVED_MVP_TOOL_TYPES`.

## STOP-y (jeśli były)

Brak STOP-u całego dyżuru. Naruszenie Z5 sprzed odczytania instrukcji opisano
jawnie; nie doszło do edycji chronionego checkoutu ani połączenia z obcą bazą.

## ★★ TWIERDZENIA NIEZWERYFIKOWANE

- Zachowanie realnego HTTP dla trzech katalogów nie zostało jeszcze zmierzone.
- Zamknięcie trzech dróg cichego połyku nie zostało jeszcze dowiedzione.
- Jakość i paginacja `.docx` w Microsoft Word pozostaną niezweryfikowane, jeśli
  nie będzie dostępny Word; spójność danych zostanie sprawdzona niezależnie.
- Stan Railway/demo/staging/produkcji jest celowo niezweryfikowany (Z28).

## Rekomendacje dla nadzorcy

1. Przyjąć od właściciela konkretną listę typów oraz potwierdzenie pakietów i praw.
2. Dopiero w osobnym, autoryzowanym dyżurze zmienić katalog i mosty tych typów.
3. Nie usuwać `toolAvailability.ts` przed pisemnym wyborem docelowego katalogu.
