# CLOSEOUT-CO2 — `initiatives.status` DEFAULT vs `initiatives_status_check`

**Data:** 2026-08-10
**Gałąź:** `codex/finance-v3-closeout-co2-initstatus` (worktree `closeout-co2-initstatus`)
**Baza dowodowa:** postgresql@15.15 (Homebrew), efemeryczny klaster, port 55131, `LC_ALL=C`, `--locale=C`
**Status:** NAPRAWIONE — z jedną, niezależną **drugą przyczyną** wykrytą i udokumentowaną (poza zakresem naprawy)

---

## 1. Diagnoza — fakty, nie domysły

Kolumna `initiatives.status` miała `DEFAULT 'step3'`, którego CHECK `initiatives_status_check`
nie dopuszcza. Każdy `INSERT INTO initiatives (...)` bez jawnego `status` wpadał w default
i był odrzucany.

**Odczyt z żywego schematu** (świeża baza po pełnym replayu `server/migrations/`):

```
DEFAULT = 'step3'::text
CHECK   = CHECK ((status = ANY (ARRAY['DRAFT','PENDING_REVIEW','REVIEW','PROMOTED','PLANNING',
          'APPROVED','SCHEDULED','EXECUTING','BLOCKED','DONE','TRACKING','CANCELLED','ARCHIVED'])))
```

### Skąd bierze się DEFAULT

| Plik | Linia | Uwaga |
|---|---|---|
| `server/migrations/000_z_core_baseline.sql` | 226 | `CREATE TABLE ... status TEXT DEFAULT 'step3'` — **realne źródło na Postgresie** |
| `server/migrations/000_z_core_baseline.sql` | 264 | `ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'step3'` |
| `server/migrations/000_initdb_core_tables.sql` | 481 | **NIE dotyczy Postgresa** — runner (`isSqliteOnlyMigration`) wyklucza wszystkie `000_initdb_*` |
| `server/src/database/PostgresDatabase.ts` | 2526 | runtime DDL `initDb()` — poza zakresem allowlisty, patrz §6 |

### Skąd bierze się CHECK

| Plik | Uwaga |
|---|---|
| `server/migrations/20260624_initiative_status_normalize.sql` | krok 3 — zakłada CHECK po backfillu |
| `server/migrations/20260802_mvp_core_schema_parity.sql` | zakłada ten sam CHECK, jeśli go nie ma |

**Kolejność ma znaczenie i jest poprawna:** oba pliki najpierw backfillują niekanoniczne
statusy do `DRAFT`, dopiero potem zakładają CHECK — dlatego założenie constraintu nigdy nie
wywala się na istniejących wierszach. Brakowało wyłącznie poprawienia samego DEFAULT-u.

### Czy w bazie demo/produkcyjnej mogą istnieć wiersze ze `step3`

Ustalone **z kodu i migracji** (bez łączenia się z jakąkolwiek żywą bazą — zgodnie ze
zleceniem). Odpowiedź: **nie na bazie, która przeszła 20260624 lub 20260802.** Oba pliki
przepisują `step3` → `DRAFT` *przed* założeniem CHECK-a, a po jego założeniu Postgres nie
przepuści już takiego wiersza. Wiersze `step3` są możliwe tylko w stanie pośrednim —
np. gdy tabelę utworzył runtime'owy `initDb()` i żadna z tych dwóch migracji jeszcze nie
przeszła. Migracja naprawcza obsługuje ten przypadek defensywnie (§3).

---

## 2. Wybór naprawy: **(a) DEFAULT → `'DRAFT'`** — nie (b) rozszerzenie CHECK

`step3` jest **sierotą**, nie realnym statusem inicjatywy. Dowód z kodu:

1. **SSOT enumu** — `server/src/constants/initiativeStatuses.ts` definiuje 13 wartości
   UPPERCASE; `step3` nie występuje. Udokumentowany stan wejściowy cyklu życia to `DRAFT`:
   > `DRAFT → REVIEW → PROMOTED → PLANNING → APPROVED → SCHEDULED → EXECUTING → DONE → TRACKING`

2. **Jedyny produkcyjny zapis inicjatywy** —
   `server/src/services/initiative/InitiativeDefinitionService.ts:168`:
   ```ts
   push('status', data.status || 'DRAFT'); // Uspójnienie F1.11 — 'step3' (legacy, nieprawidłowy) → DRAFT
   ```
   Aplikacja nigdy nie polega na DEFAULT-cie kolumny i nigdy nie zapisuje `step3`.

3. **Migracje same nazywają `step3` śmieciem.** `20260624` (komentarz kroku 1):
   „Obejmuje: NULL, pusty string, **znany śmieciowy `step3`**" — i backfilluje go do `DRAFT`.
   `20260802` mapuje każdą niekanoniczną wartość → `DRAFT`. Intencja produktu jest więc już
   dwukrotnie zapisana w migracjach.

4. **Pozostałe wystąpienia „step3" w `src/`** to `step3Completed` (flagi kreatora sesji)
   oraz klucze i18n (`mfa.setup.step3`) — inna domena, nie status inicjatywy.

5. **Istniejący test już opisywał ten defekt** —
   `server/src/services/initiative/__tests__/initiativeCapabilityMatrix.pg.test.ts:241`:
   „`status` carries `initiatives_status_check`, whose column default (`'step3'`) is itself
   not an accepted value" — obchodził go, podając status jawnie.

**Wniosek:** wariant (b) zabetonowałby śmieć w kanonicznym słowniku statusów i rozjechał bazę
z enumem SSOT. Wariant (a) przywraca niezmiennik `DEFAULT ⊆ CHECK` i jest zgodny z tym, co kod
i tak robi.

---

## 3. Migracja

**Plik:** `server/migrations/20260821_initiatives_status_default_draft.sql`

- **Addytywna** — zero `DROP`, zero `DELETE`, zero zmian typu kolumny.
- **Idempotentna** — `SET DEFAULT` jest z natury idempotentny; całość pod strażą istnienia
  tabeli (`to_regclass`) i kolumny (`information_schema.columns`), więc jest no-opem tam,
  gdzie nie ma czego naprawiać. Zweryfikowane podwójnym zaaplikowaniem.
- **Nazwa przechodzi reguły discovery runnera** (`isSqliteOnlyMigration`): bez `seed`/`mock`/
  `demo`/`sqlite`/`fts5`, bez prefiksu `add_`, bez podwójnego rozszerzenia, wersja `20260821`
  ≥ 500, brak `DATETIME` w treści. `validate-migration-naming.ts` nie zgłasza jej wcale
  (0 uwag dotyczących tego pliku).

**Dane istniejące — decyzja: PRZEMAPOWAĆ, nie kasować.** Wiersze ze statusem `step3`
(dowolna wielkość liter) są przepisywane na `DRAFT`, *przed* zmianą DEFAULT-u. Uzasadnienie:
`step3` nie niesie żadnej informacji domenowej — powstawał wyłącznie jako artefakt DEFAULT-u
kolumny — a obie wcześniejsze migracje podjęły dokładnie tę samą decyzję. Żaden wiersz nie
jest usuwany, żadna inna kolumna nie jest dotykana, statusy spoza `step3` pozostają nietknięte.

**CHECK-a celowo nie ruszamy.** Istnieje już w każdej bazie po `20260624`/`20260802`, a
zakładanie go tutaj wymagałoby przepisania także innych niekanonicznych statusów — to
wykracza poza zakres tej naprawy i byłoby cichą zmianą danych.

---

## 4. Dowód czerwony-przed / zielony-po

Klaster efemeryczny, dwie bazy: `roi_before` (pełny replay migracji **bez** naprawy) i
`roi_fresh` (pełny replay **z** naprawą).

### CZERWONY — przed naprawą (`roi_before`)

```
INSERT INTO initiatives (id, organization_id, name) VALUES ('red-proof-ini','red-proof-org','RED proof initiative');

ERROR:  new row for relation "initiatives" violates check constraint "initiatives_status_check"
DETAIL:  Failing row contains (red-proof-ini, red-proof-org, null, RED proof initiative, ..., step3, ...)
```

### ZIELONY — po naprawie (`roi_fresh`, pełny replay z migracją)

```
20260821_initiatives_status_default_draft.sql :: success
column_default = 'DRAFT'::text

INSERT INTO initiatives (id, organization_id, name) VALUES ('green-ini','green-org','GREEN proof initiative');
INSERT 0 1
   id      | status
-----------+--------
 green-ini | DRAFT
```

### Kontrola negatywna — zestaw testowy NIE jest zielony próżniowo

Po `ALTER TABLE initiatives ALTER COLUMN status SET DEFAULT 'step3'` nowy zestaw
natychmiast czerwienieje: **3 failed | 1 passed** (scenariusz 4 przechodzi słusznie — sam
cofa bazę i aplikuje migrację, więc nie zależy od stanu wyjściowego). Po przywróceniu
naprawy: **4 passed**.

---

## 5. Testy realDB — cztery wymagane scenariusze

**Plik:** `tests/integration/closeout-co2-initiatives-status-default.realdb.test.ts`
(obok pokrewnych `*.realdb.test.ts`, ta sama umowa skip/probe co
`tests/integration/schema-migration-completeness.realdb.test.ts`).

Uruchomienie (realne trafienie do bazy, `RUN_DB_TESTS=1` **oraz** `MOCK_DB=false`):

```bash
MOCK_DB=false RUN_DB_TESTS=1 DB_TYPE=postgres NODE_ENV=test \
DATABASE_URL="postgresql://postgres@127.0.0.1:55131/roi_fresh" \
npx vitest run tests/integration/closeout-co2-initiatives-status-default.realdb.test.ts --no-file-parallelism
```

| # | Scenariusz | Wynik |
|---|---|---|
| 1 | `INSERT` bez jawnego statusu przechodzi | ✅ pass |
| 2 | Wstawiony wiersz ma legalny default (`DRAFT`, wewnątrz CHECK; CHECK realnie obecny) | ✅ pass |
| 3 | FRESH INSTALL — pełny replay migracji commituje poprawiony default; jawny `step3` nadal odrzucany | ✅ pass |
| 4 | UPGRADE — baza cofnięta do stanu sprzed naprawy (default `step3` + zdjęty CHECK), dane wstawione, migracja dolana: default naprawiony, sierota `step3` → `DRAFT`, wiersz `EXECUTING` nietknięty, **nic nie zginęło**, powtórny replay = no-op | ✅ pass |

**`Tests 4 passed (4)`**

Scenariusz 4 przywraca na końcu zdjęty CHECK, więc zostawia bazę w stanie zastanym.
Zestaw sprząta po sobie własne wiersze (`afterAll`).

---

## 6. Ryzyko resztkowe (poza allowlistą — do decyzji właściciela)

`server/src/database/PostgresDatabase.ts:2526` (runtime DDL `initDb()`) nadal deklaruje
`status TEXT DEFAULT 'step3'`. Nie jest to groźne na żadnej bazie, która przechodzi migracje
(mój plik jest ostatni w łańcuchu i nadpisuje default), ale ścieżka „thin bootstrap bez
migracji" odtworzyłaby wadliwy default. Poprawka jednolinijkowa, świadomie **nie** wykonana —
plik nie mieści się w allowliście tego zlecenia.

---

## 7. Testy kanoniczne ROI — nowy pomiar

Cztery pliki wskazane w zleceniu, ta sama baza, ten sam runner, jedyna zmienna to DEFAULT
kolumny:

| Stan | Wynik |
|---|---|
| **PRZED** (`DEFAULT 'step3'`) | **3 passed / 16 failed** (19 testów, 4 pliki czerwone) |
| **PO** (`DEFAULT 'DRAFT'`) | **18 passed / 1 failed** (19 testów, 3 pliki w pełni zielone) |

> Uwaga metodologiczna: podany w zleceniu wcześniejszy pomiar „20 passed / 12 failed" (32 testy)
> nie odpowiada zakresowi tych czterech plików, które łącznie mają 19 testów. Powyższa tabela
> to uczciwy pomiar przed/po na **identycznym** zakresie i identycznej bazie.

Pliki `roiFinanceLink`, `roiFinanceReconciliation`, `roiEvidenceLinkFreshness` — **100% zielone**.

---

## 8. DRUGA PRZYCZYNA (potwierdzona — teza „jest tylko jedna" jest fałszywa)

Jedyny pozostały czerwony test — `roiActualEntryAppendOnly.realdb.test.ts` — pada z zupełnie
innym błędem, **niezwiązanym** ze statusem:

```
insert or update on table "initiatives" violates foreign key constraint "initiatives_organization_id_fkey"
```

**Przyczyna:** ten plik **nigdy nie tworzy wiersza w `organizations`**. Jego `beforeAll`
wstawia tylko politykę widoczności, po czym `buildTrackingCase` wstawia inicjatywę z
`organization_id = ORG_ID`, który w `organizations` nie istnieje. FK jest realny:

```
initiatives_organization_id_fkey :: FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
```

Autor testu założył „cienką" tabelę `initiatives` — plik robi
`CREATE TABLE IF NOT EXISTS initiatives (id, organization_id, name)`, co wobec realnego
schematu jest **no-opem** (ten sam wzorzec opisano już w
`initiativeCapabilityMatrix.pg.test.ts:241`).

**Dowód eksperymentalny:** na jednorazowej kopii pliku (oryginał nietknięty, kopia usunięta)
dołożyłem *jedną* brakującą linię — `INSERT INTO organizations ...` — i zestaw przechodzi
**3 passed / 3**. To domyka diagnozę bez zgadywania.

**Zasięg jest znacznie szerszy niż jeden plik.** W katalogu `tests/resultsVnext/roi/`
**18 plików** wstawia do `initiatives`, nie tworząc wcześniej organizacji:

`roiActualEntryAppendOnly`, `roiActualSnapshot`, `roiApprovalSnapshotFreeze`,
`roiApprovalSnapshotVisibilityJoin`, `roiBaselineFreeze`, `roiCalculationRun`,
`roiCaseApproval`, `roiCaseLifecycle`, `roiCaseReapproval`, `roiCaseSubmitGuard`,
`roiCompareView`, `roiEconomicModelFreeze`, `roiEconomicModelVisibilityJoin`,
`roiForecastActualVisibilityJoin`, `roiForecastVersion`, `roiTrackingTransition`,
`roiVariance`, `roiVisibilityJoin`.

Pełny przebieg katalogu `tests/resultsVnext/roi` po mojej naprawie:
**79 passed / 33 failed / 8 skipped (37 plików: 19 zielonych, 18 czerwonych)** — liczba
czerwonych plików **dokładnie** pokrywa się z listą 18 powyżej. To defekt **fixture'ów
testowych**, nie schematu i nie kodu produkcyjnego; naprawa mieści się poza allowlistą tego
zlecenia i jest zgłaszana do osobnego bloku.

---

## 9. Sprzątanie

Klaster efemeryczny zatrzymany (`pg_ctl stop`) i skasowany (`rm -rf` katalogu danych oraz
gniazda). Żadna żywa baza (dev/demo/prod) nie była dotykana na żadnym etapie — porty
5432/28711/52824 nieużywane.
