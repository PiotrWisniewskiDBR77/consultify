# CLOSEOUT-10 — statusy inicjatyw w skryptach seedujących demo

**Data:** 2026-08-10
**Gałąź:** `codex/finance-v3-closeout-co10-seeds`
**Commity:** `0565767d48` (naprawa), `6ceddedb28` (test)
**Poprzednicy:** CLOSEOUT-2 (DEFAULT kolumny), CLOSEOUT-8 (runtime DDL)

---

## 1. Wynik

Naprawione. Pięć skryptów seedujących demo zapisywało do `initiatives.status`
wartości odrzucane przez `initiatives_status_check`. Po naprawie realny seed
`seed-archilex-demo-org.js` przechodzi na w pełni zmigrowanej bazie
(`EXIT=0`, 15/15 inicjatyw), a przed naprawą pada na pierwszym INSERT-cie.

---

## 2. Dwie korekty do diagnozy z CLOSEOUT-8

### 2.1 Zakres był WĘŻSZY niż rzeczywistość — nie 2, a 7 literałów

CLOSEOUT-8 wskazał `'step3'` i `'step3_list'`. Realny słownik legacy to cała
rodzina lejka DRD plus problem wielkości liter:

| Literał | Skąd | Status |
|---|---|---|
| `step3` | seed_demo_organization | odrzucany |
| `step2_assess` | legolex/technolex v3 | odrzucany |
| `step2_assessment` | archilex | odrzucany |
| `step3_list` | 4 seedy | odrzucany |
| `step4_pilot` | 4 seedy | odrzucany |
| `step5_full` | 4 seedy | odrzucany |
| `cancelled` (małe litery) | archilex | **odrzucany** |

### 2.2 CHECK jest ŚCIŚLE wielkoliterowy — dlatego `'cancelled'` też pada

Diagnoza wskazywała migracje `20260624`/`20260802` zamiennie. To istotna
różnica, bo mają **różne** definicje:

- `20260624_initiative_status_normalize.sql` → `CHECK (UPPER(status) IN (...))` — tolerancyjny
- `000_z_core_baseline.sql` / `20260802_mvp_core_schema_parity.sql` → `CHECK (status IN (...))` — ścisły

Na świeżo zmigrowanej bazie obowiązuje wersja **ścisła** (zweryfikowane
`pg_get_constraintdef`):

```
CHECK ((status = ANY (ARRAY['DRAFT'::text, 'PENDING_REVIEW'::text, 'REVIEW'::text,
 'PROMOTED'::text, 'PLANNING'::text, 'APPROVED'::text, 'SCHEDULED'::text,
 'EXECUTING'::text, 'BLOCKED'::text, 'DONE'::text, 'TRACKING'::text,
 'CANCELLED'::text, 'ARCHIVED'::text])))
```

Konsekwencja: małoliterowe `'cancelled'` w archilex **nie jest kosmetyką**,
tylko realnym defektem. Gdyby ktoś diagnozował po treści `20260624`, uznałby
je za nieszkodliwe.

`DEFAULT` kolumny to `'DRAFT'::text` — naprawa CLOSEOUT-2 potwierdzona obecna.

---

## 3. Pełna lista trafień z klasyfikacją

| # | Plik | Linie | Wartości | Docelowa kolumna | Żywy? |
|---|---|---|---|---|---|
| 1 | `server/scripts/seed-archilex-demo-org.js` | 180–194 (13) | `step4_pilot` ×5, `step5_full` ×3, `step3_list` ×3, `step2_assessment`, `cancelled` | `initiatives.status` | **ŻYWY** — `import db from '../database.js'` (realna warstwa serwera → Postgres) |
| 2 | `server/seed/seed_legolex_demo_v3.js` | 697–841 (12) + 925–944 (16) + 958 | `step2_assess`, `step3_list`, `step4_pilot`, `step5_full` | `initiatives.status` (+ klucze `statusDistribution`, wartości `initiativeStatuses`) | **ŻYWY** — Postgres przy `DATABASE_URL` |
| 3 | `server/scripts/seedLegolexDemoOrg.js` | 1054–1137 (10) | `step3_list`, `step4_pilot`, `step5_full` | `initiatives.status` | **ŻYWY** — `import db from '../database.js'` |
| 4 | `server/seed/seed_technolex_demo_v3.js` | 692–836 (12) | `step2_assess`, `step3_list`, `step4_pilot`, `step5_full` | `initiatives.status` | **ŻYWY w intencji, MARTWY dla Postgresa** — patrz §6.1 |
| 5 | `server/seed/seed_demo_organization.js` | 1309–1312, 1339 | `step3` ×2, `step4_pilot`, `step5_full`, fallback `step3` | `initiatives.status` | **ŻYWY tylko dla SQLite** — patrz §6.2 |
| — | `server/scripts/migrate-to-postgres.js` | 137 | `status TEXT DEFAULT 'step3'` | DDL, nie seed | **poza zakresem** — patrz §6.3 |

Żaden z 5 seedów nie jest wołany z `package.json`, CI ani z żadnego skryptu
powłoki. Wszystkie to **entrypointy uruchamiane ręcznie**, udokumentowane
nagłówkiem `Usage: node <ścieżka>`. `seed_decisions.js:132` wskazuje
`seed_demo_organization.js` jako wymaganą kolejność.

`'step3'` w `src/` (`step3Completed`) to inna domena — kreator sesji. Nietknięte.
Cały słownik `stepN_*` **nie występuje w `src/` ani `server/src/`** — nikt go
nie czyta, więc zmiana wartości nie ma konsumenta do zepsucia.

---

## 4. Czy `step3_list` to ta sama domena? TAK

Sprawdzone we wszystkich czterech plikach: każde wystąpienie `status:
'step3_list'` trafia do **`initiatives.status`** przez jawny `INSERT INTO
initiatives (... status ...)`. To ten sam byt i ten sam constraint co `'step3'`.

Jeden wyjątek wart uwagi — `seed_legolex_demo_v3.js` używa tego samego tokenu
także jako **klucza wyszukiwania**:

```js
const statusDistribution = { step3_list: ['done','in_progress','in_progress','todo'], ... };
const initiativeStatuses = { [IDS.INIT_03]: 'step3_list', ... };
const numTasks = initStatus === 'step5_full' ? 4 : ...;
```

To nie są zapisy do bazy, ale gdyby zmienić tylko literał w tablicy inicjatyw,
wyszukiwanie przestałoby trafiać i seed cicho wygenerowałby inną liczbę zadań
(fallback `['todo']`). Dlatego token przemianowano **spójnie w całym pliku** —
zmiana jest czysto nazwowa, zachowanie identyczne.

---

## 5. Mapowanie — nie zgadywane, wzięte ze specyfikacji seeda

`docs/demo/ARCHILEX_STORY.md` jest specyfikacją seeda archilex i **nazywa
docelowy status per inicjatywa**. To dało mapowanie całego słownika:

| Legacy | Kanoniczny | Dowód z ARCHILEX_STORY.md |
|---|---|---|
| `step2_assess` / `step2_assessment` | `DRAFT` | F3 „draft" |
| `step3_list` | `PLANNING` | F1/F2/F5 „planning" |
| `step4_pilot` | `EXECUTING` | H1/H2/E1/E2/E3 „executing" |
| `step5_full` | `DONE` | H3/C1/C2 „done" |
| `cancelled` | `CANCELLED` | F4 „cancelled"; SSOT jest UPPERCASE |

Po naprawie seed archilex zgadza się ze swoją specyfikacją **15/15** (pilnuje
tego scenariusz 2 testu).

**`seed_demo_organization.js`** dostał mapowanie z własnych kluczy — mapa
tłumaczy nazwy domenowe na wartości bazy, a klucze same niosą semantykę:

| Klucz | Było | Jest | Uzasadnienie |
|---|---|---|---|
| `IDEA` | `step3` | `DRAFT` | pomysł = stan wejściowy; SSOT: „Initial draft, author is working on it" |
| `PLANNING` | `step3` | `PLANNING` | klucz i status kanoniczny to ta sama nazwa |
| `EXECUTING` | `step4_pilot` | `EXECUTING` | j.w. |
| `COMPLETED` | `step5_full` | `DONE` | `DONE` to kanoniczny odpowiednik „completed" |
| fallback | `step3` | `DRAFT` | zgodnie z polityką `20260624` dla wartości nieznanych |

Uwaga: `IDEA`/`PLANNING` mapowały się **obie** na `step3` — mapowanie było
stratne. Teraz rozróżnia dwa realne stany. Klucze pokrywają cały zbiór
statusów w `DEMO_INITIATIVES`, więc fallback i tak nie powinien się odpalać.

`init.status.toLowerCase()` idzie do `current_stage` — inna kolumna, **bez
CHECK constraintu** (zweryfikowane). Nietknięte.

---

## 6. Trafienia nietknięte lub o ograniczonym zasięgu

### 6.1 `seed_technolex_demo_v3.js` — martwy dla Postgresa (defekt przedistniejący)

Wartości poprawiono (plik jest żywym entrypointem), ale **seed nie kończy się
sukcesem z powodów niezwiązanych** z tą pracą: gałąź Postgresa używa `require()`
w module ESM.

```
ReferenceError: require is not defined in ES module scope
```

3 wystąpienia `require(` — **identycznie przed i po** naprawie (`HEAD~1` = `HEAD`),
więc to defekt przedistniejący. Siostrzany `seed_legolex_demo_v3.js` używa
poprawnego `await import()` — technolex to nieodświeżona kopia. Poza allowlistą.

### 6.2 `seed_demo_organization.js` — SQLite-only, NIE mógł wywalić constraintu

CLOSEOUT-8 zapisał: „Na bazie z `initiatives_status_check` ten seed pada."
**To nieprawda.** Skrypt otwiera `sqlite3` na sztywno:

```js
import sqlite3 from 'sqlite3';
const dbPath = path.join(__dirname, '../consultinity.db');
```

Nie ma gałęzi Postgresa, `server/consultinity.db` **nie istnieje**, a `sqlite3`
nie jest zależnością `server/package.json`. Ten seed nigdy nie dosięgnie
constraintu.

Wartości poprawiono mimo to: są niezgodne z SSOT niezależnie od dialektu, a to
było ostatnie miejsce w repo, gdzie literał `'step3'` jeszcze powstawał.
**Naprawa dla spójności z SSOT, nie dlatego, że coś dziś pada.**

### 6.3 `server/scripts/migrate-to-postgres.js:137` — poza allowlistą

`status TEXT DEFAULT 'step3'` w DDL jednorazowego narzędzia migracji
SQLite→Postgres. To DDL, nie seed, i nie jest ścieżką bootu. Zgłoszone,
nietknięte.

### 6.4 Przedistniejący błąd weryfikatora w archilex (znaleziony po drodze)

Seed raportuje `[FAIL] Users: 4 / 4` i `[FAIL] Projects: 4 / 4` mimo
poprawnych danych:

```js
checks.push({ name: 'Users', passed: userCount.count === 4, ... });
```

`COUNT(*)` wraca z node-pg jako **string** (`'4'`), więc `'4' === 4` to `false`.
Sprawdzenia używające `>=` przechodzą, bo tam następuje koercja. Efekt: seed
kończy się komunikatem „Some checks failed" mimo poprawnego przebiegu.
Niezwiązane ze statusami, poza allowlistą.

---

## 7. Dowód czerwony-przed / zielony-po

Własny efemeryczny klaster PostgreSQL 15.15, `LC_ALL=C`, port 55000
(sprawdzony `lsof`). Zero kontaktu z bazami demo/prod. Baza `co10_test`
zmigrowana pełnym runnerem `server/scripts/migrate.postgres.ts` → **exit 0**,
1463 tabel w `public`.

### 7.1 Poziom literału

Wszystkie 7 literałów, INSERT wprost do zmigrowanej bazy:

```
'step3'            -> REJECTED by initiatives_status_check
'step3_list'       -> REJECTED by initiatives_status_check
'step4_pilot'      -> REJECTED by initiatives_status_check
'step5_full'       -> REJECTED by initiatives_status_check
'step2_assess'     -> REJECTED by initiatives_status_check
'step2_assessment' -> REJECTED by initiatives_status_check
'cancelled'        -> REJECTED by initiatives_status_check
```

Kontrola dodatnia — `DRAFT`, `PLANNING`, `EXECUTING`, `DONE`, `CANCELLED`:
`INSERT 0 1` każdy.

### 7.2 Poziom realnego seeda (forma mocna)

Ten sam skrypt, ta sama baza, różnica tylko w commicie:

**PRZED (`HEAD~1`):**
```
EXIT=1
Failed SQL: INSERT INTO initiatives (id, organization_id, project_id, name, axis,
            status, owner_business_id, blocked_reason, created_at) VALUES (...)
Error: new row for relation "initiatives" violates check constraint
       "initiatives_status_check"
```

**PO (`HEAD`):**
```
EXIT=0
SEEDING COMPLETED
[OK] Initiatives: 15 / 15
```

Stan bazy po seedowaniu (archilex + legolex v3, 27 inicjatyw):

```
 archilex-org-001    | BLOCKED   | 2      legolex-demo-org-v3 | DONE      | 3
 archilex-org-001    | CANCELLED | 1      legolex-demo-org-v3 | DRAFT     | 2
 archilex-org-001    | DONE      | 3      legolex-demo-org-v3 | EXECUTING | 4
 archilex-org-001    | DRAFT     | 1      legolex-demo-org-v3 | PLANNING  | 3
 archilex-org-001    | EXECUTING | 5
 archilex-org-001    | PLANNING  | 3
```

Wierszy niekanonicznych w całej bazie: **0**. Rozkład archilex zgadza się
z `ARCHILEX_STORY.md` co do sztuki.

### 7.3 Forma dowodu per seed — uczciwie

| Seed | Forma dowodu |
|---|---|
| `seed-archilex-demo-org.js` | **mocna** — pełny przebieg, czerwony przed / zielony po |
| `seed_legolex_demo_v3.js` | **mocna** — pełny przebieg, `EXIT=0`, 12 inicjatyw kanonicznych |
| `seedLegolexDemoOrg.js` | **słabsza** — pada w Fazie 5 (`partners`), **przed** fazą inicjatyw; `initiatives_status_check` nie pojawia się w logu ani razu. Blokada przedistniejąca i niezwiązana → dowód przez test na literałach |
| `seed_technolex_demo_v3.js` | **słabsza** — `require()` w ESM (§6.1) blokuje uruchomienie pod Postgresem → dowód przez test na literałach |
| `seed_demo_organization.js` | **słabsza** — SQLite-only (§6.2), nie dosięga constraintu → dowód statyczny (brak literałów legacy) |

Dla trzech ostatnich dowodem jest test wstawiający **dokładnie te wartości,
które seed wstawia** — bo samego seeda nie da się uruchomić w izolacji
z powodów niezwiązanych ze statusami.

---

## 8. Test regresyjny

`tests/integration/closeout-co10-demo-seed-statuses.realdb.test.ts` — 9 testów, 5 scenariuszy:

1. żaden z 5 seedów nie zawiera literału `stepN_*` / `'step3'` (per plik, statycznie)
2. seed archilex zgadza się z `ARCHILEX_STORY.md` 15/15
3. każdy status archilex jest kanoniczny i wielkoliterowy
4. **kontrola negatywna** — stare literały nadal są odrzucane
5. każdy status, który seedy teraz piszą, wchodzi do bazy

Scenariusz 4 jest konieczny: bez niego scenariusz 5 przeszedłby także na bazie
**bez** constraintu, czyli nie dowodziłby niczego.

Skaner rozbiera komentarze przed skanowaniem — przy pierwszym uruchomieniu test
złapał własny komentarz wyjaśniający, który cytuje stare literały.

**Walidacja testu (czy w ogóle potrafi zaczerwienić):** na kodzie sprzed
naprawy **8/9 scenariuszy czerwieni się**; zielony zostaje tylko scenariusz 4,
prawdziwy w obu stanach. Test nie jest pusty.

---

## 9. Regresja

| Zakres | Wynik |
|---|---|
| `server/src/services/finance/canonical/__tests__/` | **309 / 309** (22 pliki) |
| `server/src/services/finance/` (baseline 476) | **491 / 491** (30 plików) |
| `closeout-co2` + `closeout-co10` | **13 / 13** |

Bramka: `RUN_DB_TESTS=1`, `MOCK_DB=false`, `DB_TYPE=postgres`, vitest z `server/`.
Zero regresji; +15 testów wobec baseline'u pochodzi z wcześniejszych prac CLOSEOUT.

---

## 10. Backlog (poza allowlistą, nienaprawione)

| # | Rzecz | Plik |
|---|---|---|
| B1 | `require()` w module ESM blokuje seed pod Postgresem | `server/seed/seed_technolex_demo_v3.js:46,47,53` |
| B2 | Weryfikator raportuje `[FAIL] 4 / 4` — `count === 4` na stringu z node-pg | `server/scripts/seed-archilex-demo-org.js:418,420` |
| B3 | Seed pada w Fazie 5 na `partners` (schemat) | `server/scripts/seedLegolexDemoOrg.js:537+` |
| B4 | DDL `status TEXT DEFAULT 'step3'` | `server/scripts/migrate-to-postgres.js:137` |
| B5 | Seed SQLite-only, wskazuje na nieistniejący plik bazy | `server/seed/seed_demo_organization.js:27-29` |
| B6 | Dwie sprzeczne definicje `initiatives_status_check` (`UPPER()` vs ścisła) współistnieją w migracjach | `20260624` vs `20260802` / `000_z_core_baseline` |
