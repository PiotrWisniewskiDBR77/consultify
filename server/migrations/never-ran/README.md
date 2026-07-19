# never-ran/ — martwe migracje klasy `.sql.sql`

## Co to jest

61 plików z podwójnym rozszerzeniem `*.sql.sql` (np. `001_upgrade_tasks.sql.sql`).
To artefakty wczesnej ery SQLite projektu — każdy plik w środku ma nagłówek
w stylu `-- 035_gdpr_requests.sql` (pojedyncze rozszerzenie), więc rozszerzenie
`.sql.sql` powstało przez błąd w jakimś kroku kopiowania/eksportu, nie przez
świadome nazewnictwo. Treść jest w dialekcie SQLite (`AUTOINCREMENT`, `DATETIME`,
`PRAGMA`, inline `CHECK(...)`, `TEXT PRIMARY KEY`) — nie jest to poprawny,
uruchamialny Postgres.

## Dlaczego są martwe (nigdy się nie odpalają)

Jedyny runner migracji wołany na boot produkcyjnym to
`runTablePlatformMigrations()` w `server/src/database/DatabaseInitializer.ts`
(sekcja `TABLE PLATFORM MIGRATION RUNNER`). Jego wzorzec plików to:

```
/^(7\d{2}|\d{8})_.*\.sql$/
```

— czyli WYŁĄCZNIE pliki zaczynające się od `7XX_` (700-799) albo 8-cyfrowej
daty, kończące się dokładnie na `.sql`. Żaden z tych 61 plików nie pasuje
(numery 001-210, żaden nie zaczyna się od `7`), więc runner boot-owy nigdy ich
nie widział i nie widzi.

Dodatkowo, przenosząc je do podkatalogu `never-ran/`, wypadają one także z
zasięgu innych, mniej ścisłych skanerów katalogu migracji, które robią płytki
(nierekursywny) `readdirSync(migrationsDir)` na `server/migrations` — m.in.
`server/scripts/migrate.ts` (filtr `f.endsWith('.sql')`, który sam w sobie
złapałby też `.sql.sql`, bo string kończy się na `.sql`) oraz
`server/scripts/run-migrations-staging.cjs`. Dwa inne skrypty
(`server/scripts/migrate.postgres.ts` i `server/scripts/verify-schema-vs-migrations.ts`)
już mają jawny wyjątek `if (f.endsWith('.sql.sql')) return true;` (pomiń) —
podkatalog czyni to zabezpieczenie nadmiarowym, ale nieszkodliwym.

## Czym zastąpione

Schemat, który te pliki próbowały tworzyć/uzupełniać dla tabel typu
`organizations`, `gdpr_requests`, `admin_sessions`, `email_templates`,
`permission_requests`, `security_events`, `user_sessions`, `login_history`,
`partner_certifications` itd., jest dziś pokryty przez:

- nowsze, natywne-Postgres migracje `791_organizations_dunning_columns.sql`
  … `799_partner_certifications_missing_columns.sql` w `server/migrations/`
  (seria "missing columns" — dopisuje brakujące kolumny na już istniejących
  tabelach Postgres) oraz
- inline `CREATE TABLE IF NOT EXISTS` w samym `DatabaseInitializer.ts`
  (funkcje bootstrapujące krytyczne tabele niezależnie od katalogu migracji),
- kanoniczny baseline Postgres w `server/migrations-v2/`
  (`001_baseline_20260413.sql` + kolejne przyrostowe).

Historyczna kopia tych samych 61 plików istnieje też w
`server/migrations-archive/` (pełne archiwum wcześniejszej struktury katalogu
migracji) — ten katalog (`never-ran/`) jest odrębny i celowy: to jawne
oznaczenie klasy „nigdy nie zostanie odpalone", nie ogólne archiwum.

## Zasada: NIE przemianowywać

Pliki są przeniesione, nie zmienione. Podwójne rozszerzenie `.sql.sql`
zostaje jak było — zmiana nazwy na `.sql` byłaby ryzykowna: przywróciłaby
zgodność z wzorcem `\d{8}_.*\.sql$` lub innym skanerem i mogłaby sprawić, że
plik SQLite-owy odpali się na Postgresie z nieznanym skutkiem (błąd,
częściowe zastosowanie, albo — gorzej — cichy no-op maskujący prawdziwy brak
kolumny). Guard `scripts/check-sqlsql.sh` (patrz niżej) pilnuje, żeby nowe
pliki `*.sql.sql` nie trafiały z powrotem do `server/migrations/` poza tym
katalogiem.

## Guard

`scripts/check-sqlsql.sh`, wpięty w `.husky/pre-commit` oraz dostępny jako
`npm run check:sqlsql` — blokuje commit, jeśli w `server/migrations/` (poza
`never-ran/`) pojawi się nowy plik `*.sql.sql`.

Decyzja CTO (Fable, backlog E-SQL-01): archiwizacja zamiast rename.
