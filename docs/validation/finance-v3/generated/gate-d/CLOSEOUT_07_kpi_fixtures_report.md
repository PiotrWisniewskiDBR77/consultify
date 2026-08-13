# CLOSEOUT-CO7 — brakująca prekondycja `organizations` w fixture'ach KPI realdb

**Data:** 2026-08-10
**Gałąź:** `codex/finance-v3-closeout-co7-kpifixtures` (worktree `closeout-co7-kpifixtures`; `git rev-list --left-right --count origin/demo...HEAD` = `0 234`, czyli 0 za `origin/demo`)
**Baza dowodowa:** postgresql@15.15 (Homebrew), klaster efemeryczny, port 55123 (sprawdzony `lsof` jako wolny, z zakresu 55000–59999), `LC_ALL=C` przy `initdb` ORAZ `pg_ctl start`, `initdb --locale=C -E UTF8`; dwie bazy: `kpi_co7` (pomiar przed/po, kontrola negatywna) i `kpi_co7_fresh` (pełny replay migracji od zera, pomiar potwierdzający)
**Bramka:** `RUN_DB_TESTS=1` **oraz** `MOCK_DB=false`, runner uruchamiany z ROOTA worktree (root `vitest.config.ts` niesie glob `tests/**`; `server/vitest.config.ts` tych plików nie widzi)
**Status:** NAPRAWIONE — `tests/resultsVnext/kpi/` = **16/16 plików, 151/151 testów, 0 failed, 0 skipped**; cały `tests/resultsVnext/` = **55/55 plików, 278/278 testów, 0 failed, 0 skipped**

---

## 1. Diagnoza — potwierdzona pomiarem, nie przyjęta na wiarę

Trzy pliki w `tests/resultsVnext/kpi/` wstawiały wiersze do `initiatives` bez
uprzedniego utworzenia wiersza w `organizations`. Na w pełni zmigrowanym
schemacie `initiatives.organization_id` niesie realny FK
`initiatives_organization_id_fkey` → `organizations(id)` (potwierdzone
`pg_constraint` na bazie dowodowej), więc każdy taki INSERT pada z `23503`.

Maskujący czynnik jest identyczny jak w CLOSEOUT-CO5: każdy z tych plików
otwiera swój `beforeAll` defensywnym

```sql
CREATE TABLE IF NOT EXISTS initiatives (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, name TEXT NOT NULL)
```

— trzykolumnową atrapą pod schemat „tylko slice resultsVnext". Wobec realnego
schematu to **cichy no-op**: tabela już istnieje, RAZEM z FK. Awaria wygląda więc
na problem ze schematem, a jest brakiem prekondycji.

**Przyczyna potwierdzona, nie założona.** W pomiarze bazowym wszystkie trzy
pliki padły z dosłownie tym samym komunikatem serwera bazy:

```
Error: A database is configured but is not reachable (or missing the KPI-E005 schema…);
refusing to report a green run.
error: insert or update on table "initiatives" violates foreign key constraint
"initiatives_organization_id_fkey"
```

Żaden z trzech nie padł z innego powodu — nie było więc alternatywnej hipotezy
do zbadania.

**Niezależna weryfikacja listy plików** (przecięcie dwóch grepów, metoda z CO5):

```
comm -12 <(grep -L "INSERT INTO organizations" tests/resultsVnext/kpi/*.ts | sort) \
         <(grep -l "INSERT INTO initiatives"  tests/resultsVnext/kpi/*.ts | sort)
```

zwraca **dokładnie te same trzy pliki** co pomiar (3 failed / 13 passed). Zbieżność
dwóch niezależnych metod — statycznej i wykonawczej — jest tu dowodem kompletności
listy.

### Trzy naprawione pliki

| # | Plik (`tests/resultsVnext/kpi/`) | Testów | Skipped przed |
|---|---|---|---|
| 1 | `initiativeKpiImpactBaselineFreeze.realdb.test.ts` | 1 | 1 |
| 2 | `kpiIdentityAcrossSurfaces.realdb.test.ts` | 1 | 1 |
| 3 | `kpiInitiativeImpactPerspectivesRoutesRealdb.test.ts` | 3 | 3 |

Czwarty plik z katalogu, który wstawia inicjatywy — `legacyIsolation.realdb
.test.ts` — ma własny, wklejony lokalnie `INSERT INTO organizations (id) VALUES
($1) ON CONFLICT (id) DO NOTHING` (linia 250) wraz z komentarzem tłumaczącym FK.
Był zielony przed naprawą i jest zielony po; nie był dotykany. Pozostałe 12
plików katalogu nie wstawia inicjatyw samodzielnie (to testy jednostkowe na
atrapie `PoolClient`) — zlecenie ich nie dotyczy.

---

## 2. Wybrane podejście: jedna implementacja w repo, lokalny alias — i dlaczego

**Stan zastany.** Katalog `tests/resultsVnext/kpi/` nie miał ŻADNEGO wspólnego
pliku pomocniczego (jedyne `.ts` to `.test.ts`). Obok, w `tests/resultsVnext/roi/`,
CLOSEOUT-CO5 zostawił `roiRealdbOrgFixture.ts` z funkcją
`ensureRoiFixtureOrganization(client, organizationId, name)` — semantyka
potrzebna KPI jest z nią identyczna co do znaku (`INSERT INTO organizations …
ON CONFLICT (id) DO NOTHING`).

Rozważone trzy warianty:

| Wariant | Wada |
|---|---|
| (a) 3 pliki importują wprost `../roi/roiRealdbOrgFixture.js` | nazwa „…Roi…" w suite'ach, które z ROI nie mają nic wspólnego — dokładnie ten sam fałsz czytelnościowy, dla którego CO5 odrzucił import modułu „…Pir…" do nie-PIR-owych suite'ów |
| (b) własna kopia INSERT-a w `kpi/` | dwie implementacje tej samej prekondycji → kolejna zmiana schematu `organizations` do znalezienia w dwóch miejscach; to jest właśnie duplikacja, którą CO5 usuwał |
| (c) **wybrany** — `kpi/kpiRealdbOrgFixture.ts` re-eksportujący implementację CO5 pod aliasem `ensureKpiFixtureOrganization` | jedna linia zależności kpi → roi, zamknięta w jednym pliku |

**Decyzja: (c).** Jest to lustrzane odbicie tego, co CO5 zrobił z
`roiPirRealdbFixtures.insertOrganization` (alias re-eksportu tej samej funkcji):
implementacja w repo pozostaje **jedna**, a każde wywołanie w KPI czyta się jako
`ensureKpiFixtureOrganization` — bez „ROI" w suite'ach KPI. Cały plik to docblock
plus jedna linia:

```ts
export { ensureRoiFixtureOrganization as ensureKpiFixtureOrganization } from '../roi/roiRealdbOrgFixture.js';
```

Nie jest plikiem `.test.ts`, więc vitest go nie zbiera.

**Uczciwie o koszcie tego wyboru.** Wprowadza on zależność katalogu `kpi/` od
`roi/` — jedyne takie miejsce, celowo zamknięte w jednym pliku i opisane w jego
docblocku. Naprawdę czystym stanem docelowym byłby jeden fixture na poziomie
`tests/resultsVnext/`, re-eksportowany przez oba katalogi. Ten ruch dotyka
`roi/`, czyli wychodzi poza allowlistę tego zlecenia, więc został zostawiony
jako osobne, czysto porządkowe zadanie (§7).

Kolumny użyte przez helper (`id, name, plan, status`) sprawdzone wobec realnego
schematu: `name/plan/status` są nullowalne z defaultami, `id` NOT NULL — wstawka
jest poprawna.

---

## 3. Zakres zmiany — dlaczego jest minimalny

W każdym z trzech plików: **jeden import, jedno wywołanie w `beforeAll`, jedna
symetryczna linia sprzątania w `afterAll`** (plus 4 linie komentarza
tłumaczącego pułapkę „CREATE TABLE IF NOT EXISTS jest no-opem").

```diff
+import { ensureKpiFixtureOrganization } from './kpiRealdbOrgFixture.js';
...
+      // `initiatives.organization_id` carries a real FK to `organizations(id)`
+      // on a fully-migrated schema, which makes the defensive
+      // `CREATE TABLE IF NOT EXISTS initiatives` below a no-op rather than the
+      // stub it looks like — so the organization row has to exist first.
+      await ensureKpiFixtureOrganization(client, ORG_ID, '<suite> realdb fixture org');
       await client.query(
         `CREATE TABLE IF NOT EXISTS initiatives (
...
       await client.query(`DELETE FROM initiatives WHERE organization_id = $1`, [ORG_ID]);
+      await client.query(`DELETE FROM organizations WHERE id = $1`, [ORG_ID]);
```

`git diff --stat`: **3 pliki, 24 wstawienia, 0 usunięć.** Diff nie zawiera ani
jednej linii dotykającej `expect(`, `it(` ani `describe(` (sprawdzone gerpem po
diffie: 0 trafień).

**Czego NIE zmieniono:** ani jednej asercji, ani jednego `it`/`describe`, ani
jednego progu, ani jednej ścieżki produkcyjnej (`server/src/**` nietknięty), ani
jednej migracji. Nie usunięto ani nie odblokowano żadnego przypadku testowego.
Konwencja skip/probe tych suite'ów nie została ruszona.

Wywołanie umieszczono **przed** defensywnym `CREATE TABLE IF NOT EXISTS
initiatives`, wewnątrz istniejącego `try` — czyli w tym samym miejscu i pod tą
samą polityką błędu, w jakiej robi to `legacyIsolation.realdb.test.ts` i 11
zielonych plików ROI.

---

## 4. Sprzątanie po sobie

Wszystkie trzy pliki miały już `DELETE FROM initiatives WHERE organization_id =
$1` w `afterAll`. Dodano jedną symetryczną linię `DELETE FROM organizations
WHERE id = $1` bezpośrednio po niej. Po pełnym zielonym przebiegu katalogu
sprawdzone na bazie:

```sql
SELECT id FROM organizations WHERE id LIKE 'kpi-e005-baseline-freeze-org-%'
   OR id LIKE 'kpi-e005-identity-org-%' OR id LIKE 'kpi-e005-routes-org-%';   -- 0 wierszy
SELECT count(*) FROM initiatives WHERE organization_id LIKE 'kpi-e005-%';     -- 0
```

Żadnej resztki.

---

## 5. Pomiar przed / po

Runner identyczny we wszystkich pomiarach, uruchamiany z ROOTA worktree:

```bash
MOCK_DB=false RUN_DB_TESTS=1 DB_TYPE=postgres NODE_ENV=test \
DATABASE_URL="postgresql://postgres@127.0.0.1:55123/kpi_co7" \
npx vitest run tests/resultsVnext/kpi/ --no-file-parallelism
```

### `tests/resultsVnext/kpi/`

| Pomiar | Pliki | Testy |
|---|---|---|
| **PRZED** | 3 failed / 13 passed (16) | 146 passed / **5 skipped** (151) |
| **PO** | **16 passed (16)** | **151 passed (151)** — 0 failed, 0 skipped |

### `tests/resultsVnext/` (cały)

| Pomiar | Pliki | Testy |
|---|---|---|
| **PRZED** | 3 failed / 52 passed (55) | 273 passed / **5 skipped** (278) |
| **PO** | **55 passed (55)** | **278 passed (278)** — 0 failed, 0 skipped |
| **PO, baza od zera** (`kpi_co7_fresh`, pełny replay migracji) | **55 passed (55)** | **278 passed (278)** — 0 failed, 0 skipped |

Pomiar „PRZED" dla całego katalogu wykonany rzetelnie: trzy naprawione pliki
cofnięte do stanu z HEAD (`git checkout --`), przebieg na tej samej bazie,
następnie przywrócone. Liczba odtworzyła się co do jednego z diagnozą podaną w
zleceniu (3 failed / 273 passed / 5 skipped).

Trzeci wiersz jest istotny: dowodzi, że zieleń nie zależy od resztek po
wcześniejszych przebiegach — pełny replay `server/migrations/` (628 migracji, bez
ani jednego `skipped`/`failed` w logu, 1457 tabel) na pustej bazie plus jeden
przebieg katalogu daje ten sam wynik.

**Czerwonych nie zostało.** Żaden test nie padł po naprawie z innego powodu — nie
było więc czego badać jako osobne znalezisko (punkt 3 zlecenia: nie wystąpił).

---

## 6. Pięć „skipped" — przyczyna ta sama, nie osobna

Pomijane było 5 testów, dokładnie w tych samych trzech plikach, które padały
(1 + 1 + 3 — tabela w §1). **To nie był `describe.skip` ani brama środowiskowa.**
We wszystkich trzech plikach INSERT do `initiatives` stoi w samym `beforeAll`.
`beforeAll` łapie wyjątek i przerzuca go jako `A database is configured but is
not reachable …; refusing to report a green run.` — vitest raportuje wtedy błąd
na poziomie suite'a (`FAIL`), a poszczególne `it` oznacza jako **skipped**. Pięć
„pominiętych" to więc pięć testów, które nigdy nie ruszyły, bo ich prekondycja
padła na tym samym FK.

Środowisko było pełne (`RUN_DB_TESTS=1` **oraz** `MOCK_DB=false`) już w pomiarze
PRZED — dowód: pozostałe 146 testów w tym samym przebiegu realnie uderzało w
Postgresa, a same błędy `23503` pochodzą z serwera bazy.

**Po naprawie wszystkie 5 realnie się wykonuje i przechodzi** — nic nie zostało
odkomentowane ani odblokowane, znikła tylko przyczyna:

```
✓ tests/resultsVnext/kpi/kpiInitiativeImpactPerspectivesRoutesRealdb.test.ts (3 tests) 357ms
✓ tests/resultsVnext/kpi/initiativeKpiImpactBaselineFreeze.realdb.test.ts (1 test) 181ms
✓ tests/resultsVnext/kpi/kpiIdentityAcrossSurfaces.realdb.test.ts (1 test) 243ms
```

Sumaryczne `151 passed (151)` bez pozycji `skipped` (zero znaczników `↓` w logu)
jest tego drugim, niezależnym potwierdzeniem. Wzorzec identyczny jak 8 „skipped"
w CLOSEOUT-CO5.

---

## 7. Kontrola negatywna — zieleń nie jest próżniowa

Naprawa cofnięta w jednym pliku (`kpiInitiativeImpactPerspectivesRoutesRealdb
.test.ts`), ta sama baza, ten sam runner:

```
Test Files  1 failed | 15 passed (16)
     Tests  148 passed | 3 skipped (151)

error: insert or update on table "initiatives" violates foreign key constraint
"initiatives_organization_id_fkey"
  ❯ tests/resultsVnext/kpi/kpiInitiativeImpactPerspectivesRoutesRealdb.test.ts:186:13
```

Plik natychmiast czerwienieje, z **dokładnie tym samym** `23503` co w pomiarze
bazowym, i wraca do swoich 3 skipped. Po przywróceniu wywołania — ponownie
`16 passed (16) / 151 passed (151)`. Zieleń jest skutkiem naprawy, nie zniknięcia
pomiaru.

Dodatkowo, cofnięcie wszystkich trzech plików naraz (pomiar „PRZED" z §5)
odtworzyło stan bazowy co do jednego testu — druga, szersza kontrola negatywna.

---

## 8. Znaleziska poboczne (NIE naprawiane — poza allowlistą)

1. **Fixture `organizations` nadal żyje w dwóch nazwach.** Po tej naprawie repo
   ma jedną implementację (`roi/roiRealdbOrgFixture.ts`) i dwa aliasy
   (`insertOrganization` w `roi/roiPirRealdbFixtures.ts`,
   `ensureKpiFixtureOrganization` w `kpi/kpiRealdbOrgFixture.ts`) plus zależność
   `kpi/` → `roi/`. Czysty stan docelowy: jeden plik na poziomie
   `tests/resultsVnext/`, re-eksportowany przez oba katalogi. Wymaga dotknięcia
   `roi/` — kandydat na osobne, czysto porządkowe przepięcie.
2. **`legacyIsolation.realdb.test.ts` (plik zielony, nie dotykany)** ma własny,
   wklejony `INSERT INTO organizations` zamiast wspólnego helpera. Działa;
   objęte tym samym porządkowym kandydatem co punkt 1 (razem z 11 analogicznymi
   plikami ROI odnotowanymi w CO5 §8.2).
3. **Nagłówek `kpiInitiativeImpactPerspectivesRoutesRealdb.test.ts` (linie
   36–46) jest już nieaktualny.** Opisuje ręczne stawianie „minimalnej tabeli
   `initiatives`" jako procedurę uruchomienia i mówi o „Postgres 16", podczas
   gdy baza dowodowa to zmigrowany Postgres 15, w którym ta atrapa jest no-opem.
   Analogicznie docblock `initiativeKpiImpactBaselineFreeze.realdb.test.ts`
   (linia 6) mówi „real Postgres 16". Czysto komentarzowe; nie ruszane, bo poza
   minimalnym zakresem naprawy.

---

## 9. Higiena środowiska

Klaster efemeryczny: `initdb --locale=C -E UTF8` z `LC_ALL=C`, `pg_ctl start` z
`LC_ALL=C`, port **55123** (sprawdzony `lsof` jako wolny, z zakresu 55000–59999),
gniazdo w katalogu tymczasowym sesji, `listen_addresses=127.0.0.1`. Żadna żywa
baza (dev/demo/prod) nie była dotykana; porty 5432/28711/52824 nigdy nie użyte.
Po zakończeniu prac klaster zatrzymany (`pg_ctl stop`) i skasowany (`rm -rf`
katalogu danych i gniazda) — także w ścieżce błędu.
