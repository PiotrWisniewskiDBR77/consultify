# CLOSEOUT-CO5 — brakująca prekondycja `organizations` w fixture'ach ROI realdb

**Data:** 2026-08-10
**Gałąź:** `codex/finance-v3-closeout-co5-fixtures` (worktree `closeout-co5-fixtures`, z tipu fan-in fali CLOSEOUT)
**Baza dowodowa:** postgresql@15.15 (Homebrew), efemeryczny klaster, port 55000, `LC_ALL=C`, `--locale=C`, `initdb --locale=C`; dwie bazy: `roi_co5` (pomiar przed/po) i `roi_co5_fresh` (pełny replay migracji od zera, pomiar końcowy)
**Bramka:** `RUN_DB_TESTS=1` **oraz** `MOCK_DB=false`, runner uruchamiany z ROOTA worktree (root `vitest.config.ts` niesie glob `tests/resultsVnext/**`)
**Status:** NAPRAWIONE — `tests/resultsVnext/roi/` = **37/37 plików, 120/120 testów, 0 failed, 0 skipped**

---

## 1. Diagnoza — potwierdzona, nie przyjęta na wiarę

Osiemnaście plików w `tests/resultsVnext/roi/` wstawiało wiersze do `initiatives`
bez uprzedniego utworzenia wiersza w `organizations`. Na w pełni zmigrowanym
schemacie `initiatives.organization_id` niesie realny FK
`initiatives_organization_id_fkey` → `organizations(id)`, więc każdy taki INSERT
padał z `23503`.

Maskujący czynnik: każdy z tych plików otwiera swój `beforeAll` defensywnym

```sql
CREATE TABLE IF NOT EXISTS initiatives (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, name TEXT NOT NULL)
```

— trzykolumnową atrapą pod schemat „tylko slice resultsVnext". Wobec realnego
schematu to **cichy no-op**: tabela już istnieje, RAZEM z FK. Awaria wygląda więc
jak problem ze schematem, a jest brakiem prekondycji.

**Weryfikacja listy plików** (dwa niezależne grepy, przecięcie):

```
comm -12 <(grep -L "INSERT INTO organizations" tests/resultsVnext/roi/*.ts | sort) \
         <(grep -l "INSERT INTO initiatives"  tests/resultsVnext/roi/*.ts | sort)
```

daje dokładnie 18 plików — liczba pokrywa się z liczbą czerwonych plików w
pomiarze bazowym (18 failed / 19 passed).

### Lista 18 naprawionych plików

| # | Plik (`tests/resultsVnext/roi/`) |
|---|---|
| 1 | `roiActualEntryAppendOnly.realdb.test.ts` |
| 2 | `roiActualSnapshot.realdb.test.ts` |
| 3 | `roiApprovalSnapshotFreeze.realdb.test.ts` |
| 4 | `roiApprovalSnapshotVisibilityJoin.realdb.test.ts` |
| 5 | `roiBaselineFreeze.realdb.test.ts` |
| 6 | `roiCalculationRun.realdb.test.ts` |
| 7 | `roiCaseApproval.realdb.test.ts` |
| 8 | `roiCaseLifecycle.realdb.test.ts` |
| 9 | `roiCaseReapproval.realdb.test.ts` |
| 10 | `roiCaseSubmitGuard.realdb.test.ts` |
| 11 | `roiCompareView.realdb.test.ts` |
| 12 | `roiEconomicModelFreeze.realdb.test.ts` |
| 13 | `roiEconomicModelVisibilityJoin.realdb.test.ts` |
| 14 | `roiForecastActualVisibilityJoin.realdb.test.ts` |
| 15 | `roiForecastVersion.realdb.test.ts` |
| 16 | `roiTrackingTransition.realdb.test.ts` |
| 17 | `roiVariance.realdb.test.ts` |
| 18 | `roiVisibilityJoin.realdb.test.ts` |

Pozostałe pliki z katalogu, których zlecenie NIE dotyczy:
`roiCaseCreate.test.ts`, `roiCaseApprovalSelfApproval.test.ts`,
`roiCalculationEngine.knownAnswer.test.ts`, `roiOrgPirOutcomes.realdb.test.ts`,
`roiPirScheduleAndDue/Start/Close/ColdReopen/TeresaDisposition/VisibilityJoin`
— nie mają `INSERT INTO organizations`, ale też **nie wstawiają inicjatyw
samodzielnie** (część to testy czysto jednostkowe, część korzysta z
`insertOrganization` z helpera ROI-E006). Wszystkie były zielone przed naprawą i
są zielone po.

---

## 2. Wybrane podejście: wspólny helper, NIE 18× kopiuj-wklej

**Sprawdzenie istniejącego helpera.** W katalogu jest już
`roiPirRealdbFixtures.ts` (ROI-E006) — eksportuje m.in.
`insertOrganization(client, organizationId, name)` o dokładnie potrzebnej
semantyce (`INSERT … ON CONFLICT (id) DO NOTHING`). Korzysta z niego 8 plików
PIR, wszystkie zielone. Pozostałe 11 zielonych plików ma własne, wklejone
lokalnie `INSERT INTO organizations` — czyli duplikacja, którą ten helper
powstał, by wyeliminować, ale nigdy nie objął starszych epik.

**Decyzja.** Import modułu o nazwie „…Pir…" do 18 suite'ów, które z PIR nie mają
nic wspólnego, byłby czytelnościowym fałszem. Zamiast tego:

1. Nowy plik `tests/resultsVnext/roi/roiRealdbOrgFixture.ts` — jedna, neutralnie
   nazwana funkcja `ensureRoiFixtureOrganization(client, organizationId, name)`,
   z docblockiem tłumaczącym pułapkę „CREATE TABLE IF NOT EXISTS jest no-opem".
   Nie jest plikiem `.test.ts`, vitest go nie zbiera.
2. `roiPirRealdbFixtures.ts` — `insertOrganization` zamieniony na
   **re-eksport aliasu** tej samej funkcji. Publiczne API modułu nie zmienia się
   ani o znak, 8 plików PIR nie było dotykanych, a implementacja została jedna.
3. 18 plików: **jeden import + jedno wywołanie** w `beforeAll` (plus symetryczne
   sprzątanie, §4). Zero powielonego SQL-a.

Kopiuj-wklej w 18 miejscach został świadomie odrzucony: 18 kopii tego samego
INSERT-a to 18 miejsc, w których kolejna zmiana schematu `organizations` musiałaby
zostać znaleziona i poprawiona.

---

## 3. Zakres zmiany — dlaczego jest minimalna

W każdym z 18 plików dokładnie trzy linie zmiany treści (plus 4 linie komentarza):

```diff
+import { ensureRoiFixtureOrganization } from './roiRealdbOrgFixture.js';
...
+      await ensureRoiFixtureOrganization(client, ORG_ID, '<suite> realdb fixture org');
       await client.query(
         `CREATE TABLE IF NOT EXISTS initiatives (
...
       await client.query(`DELETE FROM initiatives WHERE organization_id = $1`, [ORG_ID]);
+      await client.query(`DELETE FROM organizations WHERE id = $1`, [ORG_ID]);
```

**Czego NIE zmieniono:** ani jednej asercji, ani jednego `expect`, ani jednego
`it`/`describe`, ani jednego progu, ani jednej ścieżki produkcyjnej
(`server/src/**` nietknięty), ani jednej migracji. Nie usunięto żadnego przypadku
testowego. Naprawa CLOSEOUT-CO2 (`20260821_initiatives_status_default_draft.sql`,
DEFAULT `'DRAFT'`) pozostaje nietknięta i jest warunkiem koniecznym tej naprawy —
bez niej te same INSERT-y padałyby na `initiatives_status_check`.

Wywołanie umieszczono **przed** defensywnym `CREATE TABLE IF NOT EXISTS
initiatives`, wewnątrz istniejącego `try` — czyli w tym samym miejscu i pod tą
samą polityką błędu co w 11 plikach, które robiły to poprawnie od początku
(np. `roiBenefitsRealizationTransition.realdb.test.ts:280`). Konwencja skip/probe
tych suite'ów nie została ruszona.

---

## 4. Sprzątanie po sobie

Wszystkie 18 plików miało już `DELETE FROM initiatives WHERE organization_id = $1`
w `afterAll`. Dodano jedną symetryczną linię `DELETE FROM organizations WHERE
id = $1` bezpośrednio po niej — dokładnie tak, jak robi to 8 plików zielonych
(`roiFinanceLink`, `roiEvidenceLinkFreshness`, …) i wspólny
`cleanupRoiPirFixtures`. Po pełnym przebiegu na czystej bazie w `organizations`
nie zostaje żaden wiersz z 18 naprawionych suite'ów.

---

## 5. Pomiar przed / po — pełny katalog

Runner (identyczny w obu pomiarach, uruchamiany z ROOTA worktree):

```bash
MOCK_DB=false RUN_DB_TESTS=1 DB_TYPE=postgres NODE_ENV=test \
DATABASE_URL="postgresql://postgres@127.0.0.1:55000/roi_co5" \
npx vitest run tests/resultsVnext/roi/ --no-file-parallelism
```

| Pomiar | Pliki | Testy |
|---|---|---|
| **PRZED** (`roi_co5`) | 18 failed / 19 passed (37) | **33 failed / 79 passed / 8 skipped (120)** |
| **PO** (`roi_co5`) | **37 passed (37)** | **120 passed (120)** — 0 failed, 0 skipped |
| **PO, baza od zera** (`roi_co5_fresh`, pełny replay migracji) | **37 passed (37)** | **120 passed (120)** — 0 failed, 0 skipped |

Trzeci wiersz jest istotny: dowodzi, że zieleń nie zależy od resztek po
wcześniejszych przebiegach — pełny replay `server/migrations/` na pustej bazie
plus jeden przebieg katalogu daje ten sam wynik.

**Czerwonych nie zostało.** Żaden test nie padł po naprawie z innego powodu —
nie było więc czego badać jako osobne znalezisko.

---

## 6. Osiem „skipped" — przyczyna i status

Pomijane były 8 testów w **trzech** plikach:

| Plik | Skipped przed |
|---|---|
| `roiForecastActualVisibilityJoin.realdb.test.ts` | 4 |
| `roiCaseLifecycle.realdb.test.ts` | 3 |
| `roiBaselineFreeze.realdb.test.ts` | 1 |

**Przyczyna: ta sama, nie osobna.** To nie był `describe.skip` ani brama
środowiskowa. W tych trzech plikach INSERT do `initiatives` stoi **w samym
`beforeAll`** (a nie w helperze wołanym z ciała `it`, jak w pozostałych 15).
`beforeAll` łapie wyjątek i przerzuca go jako `A database is configured but is
not reachable (or missing the ROI schema/initiatives fixture); refusing to report
a green run.` — vitest raportuje wtedy błąd na poziomie suite'a (`FAIL`), a
poszczególne `it` oznacza jako **skipped**. Osiem „pominiętych" to więc osiem
testów, które nigdy nie ruszyły, bo ich prekondycja padła na tym samym FK.

Środowisko było już pełne (`RUN_DB_TESTS=1` **oraz** `MOCK_DB=false`) w pomiarze
PRZED — dowód: pozostałe 112 testów w tym samym przebiegu realnie uderzały w
Postgresa (33 z nich padły na błędzie 23503 z serwera bazy).

**Po naprawie wszystkie 8 realnie się wykonuje i przechodzi** — nic nie zostało
odkomentowane ani odblokowane, znikła tylko przyczyna:

```
✓ tests/resultsVnext/roi/roiForecastActualVisibilityJoin.realdb.test.ts (4 tests) 283ms
✓ tests/resultsVnext/roi/roiCaseLifecycle.realdb.test.ts (3 tests) 239ms
✓ tests/resultsVnext/roi/roiBaselineFreeze.realdb.test.ts (1 test) 197ms
```

Sumaryczne `120 passed (120)` bez pozycji `skipped` jest tego drugim,
niezależnym potwierdzeniem.

---

## 7. Kontrola negatywna — zieleń nie jest próżniowa

Naprawa cofnięta w **dwóch** plikach naraz, po jednym z każdego wzorca awarii
(`roiCaseLifecycle` — awaria w `beforeAll` → skipped; `roiVisibilityJoin` —
awaria w ciele `it` → failed). Ta sama baza, ten sam runner:

```
Test Files  2 failed (2)
     Tests  3 failed | 3 skipped (6)

error: insert or update on table "initiatives" violates foreign key constraint "initiatives_organization_id_fkey"
detail: 'Key (organization_id)=(roi-vis-join-it-org-…) is not present in table "organizations".'
```

Oba pliki natychmiast czerwienieją, z **dokładnie tym samym** `23503` co w
pomiarze bazowym, i `roiCaseLifecycle` wraca do 3 skipped. Po przywróceniu
wywołania — ponownie zielone. Zieleń jest skutkiem naprawy, nie zniknięcia
pomiaru.

---

## 8. Znaleziska poboczne (NIE naprawiane — poza allowlistą)

1. **Resztka danych w `roiObligationsSurviveInitiativeClosure.realdb.test.ts`
   (plik zielony, nie dotykany).** Zostawia w bazie wiersze `organizations`,
   `initiatives`, `projects`, `users` z własnym tagiem. To **udokumentowana,
   świadoma decyzja autora**, nie luka: `initiative_lifecycle_gate_decisions` ma
   trigger `BEFORE UPDATE OR DELETE` odrzucający nawet DELETE (migracja
   `20260810_t01_initiative_lifecycle_gate_decisions.sql`), a jego FK blokują
   kasowanie rodziców. Ids są unikalne per przebieg, więc nie interferują z
   niczym. Odnotowane wyłącznie dla porządku — przy wielokrotnych przebiegach na
   tej samej bazie liczba tych wierszy rośnie liniowo.
2. **11 zielonych plików nadal ma własny, wklejony `INSERT INTO organizations`**
   zamiast wspólnego helpera. Nie ruszane — działają, a zlecenie obejmowało
   wyłącznie pliki wymagające naprawy. Kandydat na osobne, czysto porządkowe
   przepięcie.

---

## 9. Higiena środowiska

Klaster efemeryczny: `initdb --locale=C` z `LC_ALL=C`, `pg_ctl start` z
`LC_ALL=C`, port 55000 (sprawdzony `lsof` jako wolny, z zakresu 55000–59999),
gniazdo w katalogu tymczasowym sesji. Żadna żywa baza (dev/demo/prod) nie była
dotykana; porty 5432/28711/52824 nigdy nie użyte. Po zakończeniu prac klaster
zatrzymany (`pg_ctl stop`) i skasowany (`rm -rf` katalogu danych i gniazda).
