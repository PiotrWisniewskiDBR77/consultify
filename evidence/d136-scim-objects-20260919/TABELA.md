# D-136 / QD20 (DEC-685, KANAL [D] Wpis 214 A) — migracja 20262304: 5 brakujących obiektów SCIM

Baza dowodowa zmierzona 2026-09-19 03:40–04:23 CDT na KOPII dumpu stagingu
(`staging-auto-20260919T0330.dump` → kontener `qoder-d-pg-6`, 127.0.0.1:6635, `consultify_d136`,
PostgreSQL 18.6, pg_restore RC=0 / 0 błędów / 27 s) oraz odczytem stagingu żywego (read-only).
Sekrety: wyłącznie w środowisku, w plikach dowodowych brak haseł i URL z hasłem (REGUŁA 10).

## 1. KROK 0 — premisa zmierzona, nie założona

| pomiar | staging żywy (deployment 30) | świeża kopia dumpu |
| --- | --- | --- |
| `users.scim_external_id` | BRAK | BRAK |
| `users.scim_provisioned` | BRAK | BRAK |
| `users.scim_last_sync_at` | BRAK | BRAK |
| `idx_users_scim_external_id` | BRAK | BRAK |
| `idx_scim_conflicts_org` | BRAK | BRAK |
| **razem** | **0 / 5** | **0 / 5** |
| rodzice: `users` / `scim_conflict_log` / `scim_group_mappings` | istnieją | istnieją |
| wierszy w `users` / w `scim_conflict_log` | 52 / 0 | 52 / 0 |

Pliki: `krok0-staging-zywy.txt`, `krok0-kopia.txt`.

## 2. Pochodzenie definicji (blob zgodny z ledgerem)

| element | wartość |
| --- | --- |
| wiersz ledgera stagingu | `656_v4_scim_enhanced.sql`, status `skipped`, applied_at `2026-03-16T17:31:37.078Z` |
| checksum z ledgera | `skipped:cf5aec4e30dda698a16219cf05f161b6761571a1cee40712eb46d74f513a5b75` |
| blob git o tym sha256 (kopia audytu D-126) | `evidence/d126-skipped-migrations-20260919/historia/zrodla/` |
| sha256 pliku, który PRZETRWAŁ w `never-ran/` | `1db8422dc439c2c13f9e2f99cdf3d0b53fde805f8b6c8902d8933d37b97eb856` — **ROZJECHANY** (dodaje blok `CREATE TABLE scim_group_mappings`, którego plik z epoki ledgera nie miał) |
| obiekt → linia pliku historycznego | `users.scim_external_id` :3 · `users.scim_provisioned` :4 · `users.scim_last_sync_at` :5 · `idx_users_scim_external_id` :7 · `idx_scim_conflicts_org` :25 |
| sha256 nowej migracji `20262304_scim_missing_objects.sql` | `451917cec8776426478856ea284a9f81ff0c879a0b05aaa3d2685cb6143af0b0` |
| sha256 `rollback/20262304_scim_missing_objects.down.sql` | `0e108e8589a9d075a4d04271c65eb14b842ffe5ff6fc54f0654cb4bef0f0c82b` |

Zakres: DOKŁADNIE 5 obiektów, wszystkie `IF NOT EXISTS`, typy z pliku historycznego
(`TEXT` / `BOOLEAN DEFAULT FALSE` / `TIMESTAMPTZ`). `scim_group_mappings` i `scim_conflict_log`
pochodzą z `20260719_baseline_gap.sql:8615-8651` i NIE są powtarzane. Trasy SCIM niewyłączone.
Zero zapisów danych, zero `DROP` w migracji UP.

## 3. Preflight na kopii — asercja `pending == 1`

`migrate.postgres.ts --dry-run` (realny runner, bez zapisów): `preflight-dry-run.log`

```
Pending migrations: 1
- 20262304_scim_missing_objects.sql
```

## 4. Cykl UP → DOWN → UP (realny runner, kopia dumpu)

`udu.sh` → `udu-wyniki.txt`, `up1.log`, `down.log`, `up2.log`, `obiekty/00..03`, `diff-*.txt`

| krok | RC | obiekty 5-ciu | `pg_dump -s` (znormalizowany) |
| --- | --- | --- | --- |
| baseline | — | **0 / 5** | `dumpy/baseline.sql` |
| UP1 | **0** (ledger `success`, `Applying migrations: 1`) | **5 / 5** | diff baseline→UP1 = **23 linie** (19 dodanych + 4 znaczników diff), wyłącznie 5 obiektów |
| DOWN | **0** | **0 / 5** | diff baseline→DOWN = **0 linii** |
| UP2 (po usunięciu wiersza ledgera) | **0** (ledger `success`) | **5 / 5** | diff UP1→UP2 = **0 linii** |

`down` transakcyjny (`BEGIN;` … `COMMIT;`), operacji destrukcyjnych wobec cudzych obiektów: **0**
(2 × `DROP INDEX IF EXISTS`, 3 × `ALTER TABLE users DROP COLUMN IF EXISTS` — wyłącznie to, co dodał UP).

Treść diff baseline→UP1 (`diff-baseline-po-up1.txt`) — poza 5 obiektami jedynie przecinek
domykający listę kolumn `users` i nagłówki/blanki generowane przez `pg_dump`, zero linii attnum:

```
>     scim_external_id text,
>     scim_provisioned boolean DEFAULT false,
>     scim_last_sync_at timestamp with time zone
> CREATE INDEX idx_scim_conflicts_org ON public.scim_conflict_log USING btree (organization_id);
> CREATE UNIQUE INDEX idx_users_scim_external_id ON public.users USING btree (scim_external_id) WHERE (scim_external_id IS NOT NULL);
```

**WERDYKT cyklu = PASS** (RC 0/0/0, obiekty 5→0→5, diff baseline↔po-DOWN = 0, diff UP1↔UP2 = 0).
Zrzuty 4 × ~3,9 MB (`dumpy/*.sql`) pozostają poza commitem (waga); w commicie są diffy i logi.

## 5. Test RealPG — `server/src/routes/integrations/__tests__/scimMissingObjects.pg.test.ts`

Uruchomienie (kopia dumpu, pętla zwrotna wymuszona w pliku — test wykonuje `DROP COLUMN`):

```
DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL=<kopia-na-loopback> \
  npx vitest run server/src/routes/integrations/__tests__/scimMissingObjects.pg.test.ts --retry=0
```

Wynik: `test-realpg.log` → **9 / 9 PASS**, RC=0, pliki testowe 1 passed.
Bramka fail-closed (standard W164b): w CI bez `RUN_DB_TESTS` plik rzuca przy kolekcji.

| test | co dowodzi |
| --- | --- |
| T0 | kopia dumpu ma 0 / 5 obiektów (preflight stanu) |
| T1 | **wpięcie PRE**: zapytanie trasy (`scim.routes.ts:327-329`, verbatim) z `fallback: true` zwraca `[]` po cichu, z `fallback: false` rzuca `column "scim_external_id" does not exist` — mechanizm `totalResults: 0` |
| T2 | UP **wczytany z pliku** tworzy dokładnie te 5 obiektów |
| T3 | typy/domyślne (`text`, `boolean DEFAULT false`, `timestamptz`) + definicje indeksów (UNIQUE częściowy `WHERE (scim_external_id IS NOT NULL)`, zwykły na `scim_conflict_log(organization_id)`) |
| T4 | **wpięcie PO**: to samo zapytanie trasy zwraca wiersz z kluczami `scim_*` (`totalResults` trasy = długość tej tablicy) |
| T5 | unikalny indeks częściowy działa: duplikat `external_id` → `23505`, NULL wielokrotnie dozwolony |
| T6 | idempotencja: ponowny UP nie zmienia schematu (5 / 5) |
| T7 | kontrakt źródła UP: 3 × `ADD COLUMN IF NOT EXISTS`, 2 × `CREATE … INDEX IF NOT EXISTS`, zero `DROP`, zero `CREATE TABLE` |
| T8 | kontrakt + działanie DOWN: 3 × `DROP COLUMN IF EXISTS`, 2 × `DROP INDEX IF EXISTS`, guard `RAISE EXCEPTION`, bez `DROP TABLE`; liczba kolumn `users` i `scim_conflict_log` wraca do baseline |

## 6. Dowód mutacyjny — `mutacje.sh` → `mutacje-wyniki.txt`

Każda mutacja: zmiana pliku → przebieg testu → przywrócenie → porównanie sha256 z baseline (wszystkie „zgodny").

| mutacja | usunięty obiekt | RC | testy |
| --- | --- | --- | --- |
| M1 | `users.scim_last_sync_at` (UP) | **1** | 7 × RED / 2 × GREEN; T7: `expected [...] to have a length of 3 but got 2` |
| M2 | `idx_scim_conflicts_org` (UP) | **1** | 7 × RED / 2 × GREEN; T7: indeksy `length of 2 but got 1` |
| M3 | `users.scim_external_id` (UP) — **wpięcie** | **1** | 7 × RED / 2 × GREEN; T4/T5: `column "scim_external_id" of relation "users" does not exist` |
| M4 | `DROP COLUMN scim_provisioned` (DOWN) | **1** | T8 RED (`DROP COLUMN IF EXISTS` 3 → 2), pozostałe 8 GREEN |
| przebieg końcowy (pliki bazowe) | — | **0** | **9 / 9 PASS**, sha256 obu plików = baseline |

## 7. Znalezione poza zakresem (DEC-607 — jedno zdanie, ZERO naprawy)

Po zastosowaniu 20262304 ścieżka UPDATE (`scim.routes.ts:388`, `:1161`) działa, ale ścieżka INSERT
nowego użytkownika (`scim.routes.ts:403-405`) wciąż pada na `column "scim_provisioned" is of type
boolean but expression is of type integer` (literał `1` w liście VALUES omija early-out
`normalizeBooleanFlags`, `PostgresDatabase.ts:434`), a wynik `dbRun` nie jest sprawdzany i trasa
odpowiada `201 Created` z ciałem z fallbacku (`:421-430`) — pomiar: `probe-write-path.txt`.

## 8. Stan po pracy

Kopia `consultify_d136`: 3 kolumny + 2 indeksy obecne (5 / 5), `users` = 52 wierszy (sondy usunięte),
org sondy usunięta. Pliki migracji i downa = baseline sha256. Sonda `server/src/scratch/` usunięta.
