## Po co ten dyżur istnieje

Dyżur 310 postawił bezpiecznik przeciw DDL tworzonemu w locie (`noRuntimeDdl.test.ts`) i naprawił
mutację, która przechodziła w `AssessmentController.ts`. Dyżur 319 (scalony) rozszerzył zakres
bezpiecznika z samego `server/src/services/` na całe `server/src`, zmierzył mianownik na PUSTEJ
bazie przez `information_schema` (nie parserem, nie grepem), dołożył 7 tabel + kolumnę
`llm_providers.markup_multiplier` i obalił krążącą tezę „na świeżej bazie nikt się nie
zarejestruje" — realny `POST /api/auth/register` przez `ApiGateway` zwrócił `200`.

Odbiór adwersaryjny (04.09), powtarzając pomiar 319 na bazie zbudowanej OD ZERA (893 migracje,
1914 tabel wg łańcucha migracji, drugi przebieg `Applying migrations: 0` — łańcuch jest
deterministyczny), znalazł trzy rzeczy, których dyżur 319 nie domknął:

**1. `§R6 „B−A jest puste”` jest FAŁSZEM.** Po realnym przebiegu przez `ApiGateway` (nie samym
uruchomieniu migracji) baza urosła `1914 → 1915`. Nadmiarowa tabela: `slack_router_dedupe`,
tworzona WYŁĄCZNIE w locie przez `CREATE TABLE IF NOT EXISTS slack_router_dedupe (...)` w
`server/src/services/slack/slackRouter.ts:147`. Jedyna migracja, która w ogóle wspomina tę nazwę
(`20261670_p2_runtime_schema_repairs.sql`), robi to wewnątrz `IF to_regclass('public.
slack_router_dedupe') IS NOT NULL THEN ALTER TABLE ...` — czyli na CZYSTEJ bazie, gdzie tabela
jeszcze nie istnieje, ten blok **nic nie robi**. To nie jest regresja produktu (plik jest na
liście wyjątków bezpiecznika), ale jest nieodkrytą pozycją długu i fałszywym zdaniem w raporcie
319, które twierdziło coś przeciwnego.

**2. `§R5 „22 z 93”` — realnie 21.** `073_conversations.sql` jest oznaczony w rejestrze 310/319
jako `MIGRACJA_POMIJANA`, ale **runner GO URUCHAMIA** — plik jest imiennie wymieniony w
`PROMOTED_LEGACY_PRODUCERS` (`server/scripts/migrationOrdering.ts`, komentarz cytuje powód: „Sole
producer of `conversations` / `conversation_messages`... Already Postgres-compatible... no
conflict with baseline"), co odwraca blankietowe wykluczenie „numer < 500" specjalnie dla tego
pliku. Klasyfikację zrobiono **z predykatu w kodzie** (sam numer pliku sugeruje pominięcie)
zamiast z żywej bazy (`information_schema` PRZED i PO przebiegu z tą jedną migracją) — dokładnie
tą metodą, którą sama instrukcja 319 piętnowała jako błąd do unikania. Popraw klasyfikację
pomiarem, nie przeczytaniem kodu na pierwszy rzut oka.

**3. 24 pliki `__tests__` z DDL w `server/src` są pomijane bez wiersza uzasadniającego.**
`noRuntimeDdl.test.ts` ma linię `if (file.includes('/__tests__/')) continue;` — bezwarunkowe
pominięcie całego katalogu. To jest wygodne (testy fixture legalnie tworzą własne tabele
efemeryczne), ale dziś nikt nie sprawdził KTÓRE 24 pliki korzystają z tego wyjątku i CZY każdy
z nich rzeczywiście powinien. Zadanie tego dyżuru to rozstrzygnięcie tych 24 plików, nie zmiana
samego wzorca pomijania (to osobne zadanie, przypisane dyżurowi 327).

**Sprostowanie, którego nie wolno cofnąć.** Teza „na świeżej bazie nikt się nie zarejestruje" jest
**OBALONA** — `POST /api/auth/register` przez realny `ApiGateway` zwraca **200** na bazie
zbudowanej wyłącznie z migracji. Realne ryzyko jest węższe i inne: **27 tabel** istnieją na
czystej bazie wyłącznie dzięki DDL w locie i zapalą się dopiero, gdy ktoś usunie ten kod bez
dopisania migracji zastępczej. Nie buduj tego dyżuru na przekonaniu, że rejestracja jest zepsuta
— potwierdź obalenie na swojej własnej bazie i idź dalej.

## ★ Zmierz moje liczby sam

Twierdzę: `073_conversations.sql` jest w `PROMOTED_LEGACY_PRODUCERS`; rejestr mimo to niesie go
jako `MIGRACJA_POMIJANA`; `slack_router_dedupe` powstaje wyłącznie w `slackRouter.ts:147`, jedyna
migracja wspominająca nazwę jest warunkowa i no-op na czystej bazie; `noRuntimeDdl.test.ts` pomija
`__tests__` bezwarunkowo; 24 pliki `__tests__` w `server/src` mają `CREATE TABLE IF NOT EXISTS`;
najwyższy istniejący numer migracji jest poniżej `20262000`. **Jeśli Twój pomiar przeczy liczbie
podanej w tej instrukcji, obowiązuje TWÓJ pomiar — zapisz rozbieżność wprost**, w szczególności
liczbę tabel PRZED/PO przebiegu przez `ApiGateway` — Twoja własna baza może urosnąć inaczej niż
`1914→1915`, jeśli inne DDL-w-locie też się uruchomią w Twoim scenariuszu testowym.

---

## B.1. TABELA LICENCJI PLIKOWYCH

> **★★ ZASTRZEŻENIE.** Powyższa tabela **JEST** licencją. Jeżeli plik, którego potrzebujesz,
> jest opisany jako „PEŁNA/WĄSKA LICENCJA" — **masz pozwolenie i STOP z tytułu »nie wolno mi«
> jest NIEZASADNY**. Jeżeli pliku nie ma w tabeli w ogóle — domyślnie jest **TYLKO DO ODCZYTU**,
> a Twoim produktem jest czerwony kontrakt + brief, **nie zatrzymanie dyżuru**.

| Plik / wzorzec | Licencja | Co robisz, gdy pozycja wymagałaby zmiany pliku TYLKO-DO-ODCZYTU |
| --- | --- | --- |
| Rejestr klasyfikacji migracji pomijanych z dyżuru 310/319 (dokładna ścieżka do potwierdzenia w R0) | **★ WĄSKA LICENCJA: wyłącznie korekta wiersza `073_conversations.sql`** (status `MIGRACJA_POMIJANA` → poprawny, z dowodem `information_schema`). **ZAKAZ** zmiany innych wierszy bez analogicznego dowodu | — |
| `tests/unit/backend/schema/noRuntimeDdl.test.ts` | **★ WĄSKA LICENCJA: wyłącznie dodanie listy uzasadnień per plik dla wyjątku `__tests__`** (komentarz albo struktura danych z 24 wpisami: plik · powód). **ZAKAZ zmiany linii `if (file.includes('/__tests__/')) continue;`** — sam wzorzec pomijania jest zadaniem dyżuru 327 | Czerwony kontrakt + brief |
| `server/scripts/migrate.postgres.ts`, `server/scripts/migrationOrdering.ts` | **TYLKO ODCZYT — BEZWZGLĘDNIE**, `Z40` | Produktem jest opis w raporcie + ewentualna NOWA migracja addytywna, nigdy zmiana predykatu |
| `server/migrations/2026202[0-9]*.sql`, `server/migrations/2026203[0-9]*.sql` (**NOWE**) | **★ PEŁNA LICENCJA, wyłącznie addytywne**, przedział `20262020`–`20262039`, WYŁĄCZNIE jeśli R3 uzna nową migrację za konieczną dla `slack_router_dedupe` | — |
| `server/src/services/slack/slackRouter.ts` | **TYLKO ODCZYT** — DDL w locie zostaje, dopóki nie ma migracji zastępczej pokrywającej wszystkie środowiska | Wpis w raporcie z dowodem `information_schema`, nie usuwasz kodu |
| `tests/unit/backend/security/**`, `**/*.pg.test.ts` (NOWE) | **★ PEŁNA LICENCJA**, `Z18`/`Z31` | — |
| `000_z_core_baseline.sql`, `000_initdb_*.sql`, katalog `never-ran/` | **TYLKO ODCZYT — BEZWZGLĘDNIE**, `Z40` | Errata w raporcie |
| `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `tests/integration/_helpers/assertRealPostgres.ts` | **TYLKO ODCZYT — `Z18`, NAJOSTRZEJSZY** | Opis w raporcie, jak obszedłeś to zmiennymi w linii komendy |
| `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md` | **TYLKO ODCZYT** (`Z14`) | Errata w raporcie |
| `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY333_SCHEMAT_DOMKNIECIE_REPORT.md` | `§R.2` — **JEDYNY nowy dokument raportowy** (`Z13`) | — |
| **Wszystko inne** | **TYLKO ODCZYT** | Opisujesz potrzebę w raporcie z dowodem plik:linia i idziesz dalej |

---

## B.2. TABELA POZYCJI Z DEFINICJĄ UKOŃCZENIA PER POZYCJA

| Pozycja | Nazwa jednym zdaniem | Rdzeń? | Wymaga plików przekrojowych? | DoD podniesione | Definicja ukończenia | Komenda dowodowa | Commit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R0 | Baza od zera + pomiar A | TAK | NIE | bazowe | Kontener pusty, dwa przebiegi migracji (drugi 0 zmian), liczba tabel A zmierzona przez `information_schema` | `npx tsx server/scripts/migrate.postgres.ts` ×2 | brak |
| R1 | Pomiar B przez `ApiGateway` | TAK | NIE — dowód: `Z12` nie chroni tego pomiaru | bazowe | `POST /api/auth/register` zwraca `200`; liczba tabel B zmierzona PO serii operacji produktowych; różnica B−A policzona i opisana z nazwami tabel | realny `curl`/`fetch` przez `ApiGateway.getInstance().initializeRoutes(app)`, zapisany kod odpowiedzi | `docs(day333): pomiar A/B na bazie od zera (333 R1)` |
| R2 | Naprawa klasyfikacji `073_conversations.sql` | TAK | NIE — dowód: wiersz `B.1` daje wąską licencję | 1 dowód `information_schema` | Status w rejestrze zmieniony z `MIGRACJA_POMIJANA` na poprawny (np. `PROMOWANA_URUCHAMIANA`), z dowodem że tabela `conversations` istnieje PO przebiegu z tą migracją | `SELECT to_regclass('public.conversations')` PRZED/PO | `fix(schema): koryguje klasyfikacje 073_conversations — PROMOTED_LEGACY_PRODUCERS (333 R2)` |
| R3 | `slack_router_dedupe` — decyzja i dokumentacja | TAK | NIE | 1 dowód mutacyjny (no-op migracji) | Potwierdzone mutacyjnie, że istniejąca migracja nic nie robi na czystej bazie; decyzja zapisana: nowa migracja addytywna ALBO udokumentowany dług z uzasadnieniem, dlaczego zostaje jako DDL w locie | `information_schema.tables` PRZED/PO migracji `20261670` na pustej bazie | `docs(schema): slack_router_dedupe — no-op na czystej bazie, decyzja (333 R3)` (+ ewentualny `feat` z nową migracją) |
| R4 | 24 pliki `__tests__` z DDL — uzasadnienie | TAK | NIE | 24 wiersze uzasadnienia | Każdy z 24 plików ma wiersz: plik · powód (fixture izolowany / integracyjny z własną efemeryczną bazą / inne) w bezpieczniku albo towarzyszącym rejestrze | `find server/src -path "*__tests__*" -name "*.ts" \| xargs grep -l "CREATE TABLE IF NOT EXISTS"` → 24, każdy z wierszem | `docs(schema): uzasadnienie 24 wyjatkow __tests__ w noRuntimeDdl (333 R4)` |
| R5 | Raport | NIE | NIE | n/d | Struktura `§R.2`, sekcja „TWIERDZENIA NIEZWERYFIKOWANE" niepusta | — | `docs(day333): raport` |

> Kolumna „Wymaga plików przekrojowych?" — NIE dla wszystkich pozycji, dowód w każdym wierszu.

---

## B.3. TABELA MIANOWNIKÓW

| # | Co liczę | Liczba autora | Komenda | Czy komenda obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | Migracje w łańcuchu (od zera) | 893 (pomiar 319, zweryfikuj swój) | `ls server/migrations/*.sql \| wc -l` (przybliżenie — realna liczba z logu runnera) | TAK |
| 2 | Tabele PRZED (`A`, tylko migracje) | 1914 (pomiar 319/odbiorcy) | `SELECT count(*) FROM information_schema.tables WHERE table_schema='public'` po samych migracjach | TAK — zmierz swoją |
| 3 | Tabele PO (`B`, po przebiegu `ApiGateway`) | 1915 (odbiór adwersaryjny 04.09) | jw., po serii operacji produktowych przez realny `ApiGateway` | TAK — zmierz swoją, może się różnić od scenariusza operacji |
| 4 | Unikalne pliki cytowane jako „Migracja" w rejestrze 310, faktycznie pomijane przez runner | 22 wg 319, **21 wg odbiorcy** (073_conversations.sql jest promowany) | `grep -n PROMOTED_LEGACY_PRODUCERS server/scripts/migrationOrdering.ts` skrzyżowane z listą rejestru | **TAK — sprawdź to osobno, to jest najczęstszy błąd (CZĘŚĆ D szkieletu, błąd 2)** |
| 5 | Pliki `__tests__` w `server/src` z `CREATE TABLE IF NOT EXISTS` | 24 | `find server/src -path "*__tests__*" -name "*.ts" \| xargs grep -l "CREATE TABLE IF NOT EXISTS" \| wc -l` | TAK |
| 6 | Tabele istniejące na czystej bazie wyłącznie dzięki DDL w locie | 27 (pomiar 319) | do potwierdzenia niezależnie w R1, metoda: różnica `information_schema` PRZED/PO minus tabele wprowadzone przez Twoje własne operacje testowe | Częściowo — zmierz swój zestaw operacji, licz ostrożnie |

---

## B.4. TABELA ROZŁĄCZNOŚCI

### B.4.1. Pliki zapisywane NA PEWNO

| # | Plik | Rodzaj | Pozycja | Ryzyko kolizji |
| --- | --- | --- | --- | --- |
| 1 | Rejestr klasyfikacji migracji 310/319 (wiersz `073_conversations.sql`) | istniejący | R2 | ŚREDNIE — plik współdzielony z dyżurem 327 (inny aspekt), koryguj WYŁĄCZNIE ten jeden wiersz |
| 2 | `tests/unit/backend/schema/noRuntimeDdl.test.ts` (wąsko, lista uzasadnień) | istniejący | R4 | ŚREDNIE — dyżur 327 też go dotyka od strony wzorca; Ty dotykasz WYŁĄCZNIE listy uzasadnień, nie wzorca pomijania |
| 3 | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY333_SCHEMAT_DOMKNIECIE_REPORT.md` | NOWY | R5 | ZEROWE |

### B.4.2. Pliki zapisywane WARUNKOWO

| Plik | Pozycja | Warunek |
| --- | --- | --- |
| `server/migrations/20262020-20262039` (NOWE) | R3 | Tylko jeśli decyzja R3 wybiera „nowa migracja addytywna" zamiast „udokumentowany dług" dla `slack_router_dedupe` |

### B.4.3. Pliki, których ten dyżur JAWNIE NIE ZAPISZE

```
server/scripts/migrate.postgres.ts, server/scripts/migrationOrdering.ts — predykat pomijania, ZAKAZ zmiany (Z40)
src/components/Interview/** — dyżur 330
src/components/MyWork/**, server/src/services/report/** — dyżur 331
scripts/dev/testy-puste-skan.mjs, tests/unit/config/noEmptyAssertions.test.ts — dyżur 332
Wzorzec pomijania __tests__ w noRuntimeDdl.test.ts (sama linia continue) — dyżur 327
```

### B.4.4. Zasoby wyłączne

| Zasób | Wartość | Sprawdzone (komenda + wynik) |
| --- | --- | --- |
| Port PostgreSQL | 6359 | `lsof -nP -iTCP:6359 -sTCP:LISTEN` → puste |
| Port harnessu | 5499 | `lsof -nP -iTCP:5499 -sTCP:LISTEN` → puste |
| Nazwa kontenera | `cx-day333-pg` | `docker ps` → brak |
| Nazwa bazy | `cx333` | n/d |
| Przedział migracji | `20262020`–`20262039` | `ls server/migrations/ \| grep -cE '^202620(2[0-9]\|3[0-9])'` → 0 |
| Gałąź | `codex/day333-schemat-domkniecie-20260904` | nie istnieje |
| Worktree | `/private/tmp/cx-day333-schemat-domkniecie` | nie istnieje |
| Flagi funkcyjne | brak | n/d |

### B.4.5. Kontrola przed KAŻDYM commitem (wklej do instrukcji)

```bash
cd /private/tmp/cx-day333-schemat-domkniecie
git diff --name-only --cached | tee /private/tmp/cx-day333-schemat-domkniecie-artefakty/staged.txt
grep -iE 'migrate\.postgres\.ts$|migrationOrdering\.ts$|Interview/|MyWork/|services/report/|testy-puste-skan' /private/tmp/cx-day333-schemat-domkniecie-artefakty/staged.txt \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
```

---

## R0 — BAZA OD ZERA + POMIAR A

Uruchom `pgvector/pgvector:pg16` na porcie 6359, kompletnie pustą bazę `cx333`. Przepuść PEŁNY
łańcuch migracji (`npx tsx server/scripts/migrate.postgres.ts` z pełnym env w tej samej linii).
Drugi przebieg MUSI dać `0` zastosowanych migracji (dowód determinizmu). Policz tabele przez
`information_schema.tables` — to jest Twoja liczba `A`. Zapisz pełną listę nazw tabel do
artefaktów (`a-tabele.txt`), nie tylko liczbę.

Prawo zatrzymania po tej pozycji.

## R1 — POMIAR B PRZEZ REALNY `ApiGateway`

Uruchom serwer z `ApiGateway.getInstance().initializeRoutes(app)` na tej samej bazie. Wykonaj
realny `POST /api/auth/register` z realnym ciałem — zapisz kod odpowiedzi (musi być `200`,
potwierdzając obalenie tezy o niedziałającej rejestracji). Wykonaj rozsądny zestaw dalszych
operacji dotykających znanych miejsc DDL-w-locie (co najmniej: cokolwiek uruchamiające
`slackRouter.ts`, jeśli masz do tego bezpieczny sposób bez realnego Slacka — w przeciwnym razie
zanotuj, że tej ścieżki nie wywołałeś i dlaczego). Policz tabele ponownie — to jest `B`. Policz
`B − A` z nazwami (nie tylko liczbą): każda nowa tabela dostaje wiersz w raporcie z odpowiedzią
na pytanie „skąd się wzięła" (DDL w locie w którym pliku:linii, albo migracja, której nie
uruchomiłeś w R0).

Prawo zatrzymania po tej pozycji.

## R2 — NAPRAWA KLASYFIKACJI `073_conversations.sql`

Potwierdź na SWOJEJ bazie: `SELECT to_regclass('public.conversations')` PRZED przebiegiem R0 z
migracją `073_conversations.sql` usuniętą z łańcucha (kopia testowa poza repo, nie modyfikujesz
prawdziwego katalogu migracji) daje `NULL`; z migracją na miejscu — daje nazwę tabeli. To dowodzi,
że runner FAKTYCZNIE ją uruchamia (zgodnie z wpisem w `PROMOTED_LEGACY_PRODUCERS`). Znajdź
dokładny rejestr/dokument z dyżuru 310/319, który klasyfikuje ten plik jako `MIGRACJA_POMIJANA`,
i popraw WYŁĄCZNIE ten wiersz na poprawny status, z komentarzem cytującym dowód i przyczynę błędu
(klasyfikacja z predykatu numeru pliku, nie z żywej bazy).

Commit po R2.

## R3 — `slack_router_dedupe`: DECYZJA I DOKUMENTACJA

Zweryfikuj mutacyjnie: na czystej bazie (tylko migracje, bez `ApiGateway`) sprawdź
`to_regclass('public.slack_router_dedupe')` → oczekiwane `NULL` (migracja `20261670` nie tworzy
tabeli, bo warunek `IF to_regclass(...) IS NOT NULL` jest fałszywy na pustej bazie). Zdecyduj: (a)
napisz NOWĄ migrację addytywną w przedziale `20262020`-`20262039`, która tworzy
`slack_router_dedupe` bezwarunkowo (`CREATE TABLE IF NOT EXISTS`, bez `to_regclass`), i usuń DDL
w locie z `slackRouter.ts` DOPIERO PO potwierdzeniu, że migracja działa na czystej bazie; ALBO
(b) udokumentuj w raporcie jako świadomie zaakceptowany dług (tabela pomocnicza dla dedupe,
niska stawka, DDL w locie zostaje). Wybierz (a) jeśli koszt jest niski (jedna prosta tabela) —
zamyka realny dług, nie tylko go opisuje.

Commit po R3.

## R4 — 24 PLIKI `__tests__` Z DDL: UZASADNIENIE

Wylistuj wszystkie 24 pliki (`find server/src -path "*__tests__*" -name "*.ts" | xargs grep -l
"CREATE TABLE IF NOT EXISTS"`). Dla każdego: otwórz, ustal czy tworzy tabelę w IZOLOWANEJ,
efemerycznej bazie testowej (legalne — nie dotyczy runtime produkcyjnego) czy coś innego. Zapisz
wiersz: plik · linia · powód pominięcia · czy legalny. Dopisz tę listę jako komentarz/strukturę
w `noRuntimeDdl.test.ts` obok linii pomijającej `__tests__`, żeby przyszły czytelnik widział
DLACZEGO wyjątek istnieje, nie tylko ŻE istnieje. Jeśli znajdziesz plik, który tworzy tabelę
runtime pod pozorem testu (nielegalny wyjątek) — opisz go osobno jako `DO DECYZJI WŁAŚCICIELA`,
nie usuwaj bez zgody (mogłoby zepsuć testy).

Commit po R4.

## R5 — RAPORT

Tabela A/B z nazwami tabel i przyczyną każdej różnicy. Poprawiona klasyfikacja `073_conversations.
sql` z dowodem. Decyzja o `slack_router_dedupe` (migracja albo udokumentowany dług) z dowodem
mutacyjnym no-op. Lista 24 uzasadnień. TWIERDZENIA NIEZWERYFIKOWANE — w szczególności jeśli nie
zdążyłeś wywołać ścieżki Slack w R1, zapisz to jawnie zamiast milczeć.

## Prawo zatrzymania

Obowiązuje po każdej pozycji z osobna. „R0-R2 domknięte, R3 zmierzone bez naprawy (wybrałem
udokumentowanie długu, nie migrację), R4 połowicznie (12 z 24 plików)" jest pełnowartościowym
wynikiem. Fałszywe zdanie „różnica jest pusta" w raporcie kosztuje więcej niż przyznanie się do
27 tabel DDL-w-locie.
