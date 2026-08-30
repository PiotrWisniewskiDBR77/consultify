# CODEX DAY 144 — WSKAŹNIK ROZŁĄCZONY OD CYKLU ŻYCIA INICJATYWY

Data pomiaru: 2026-08-30  
Marker: `c685ea65af`  
Gałąź: `codex/day144-wskaznik-rozlaczenie-20260830`  
Werdykt: **R1–R4 wykonane; B1–B8 spełnione w zakresie bezpośredniego testu realnego PostgreSQL.**

## Stan wejściowy

### §0.1-BIS

```text
$ git merge-base --is-ancestor c685ea65af HEAD && echo "BAZA OK" || echo "MARKER BRAK — STOP"
BAZA OK
$ git status --short
[brak wyjścia]
$ git branch --show-current
codex/day144-wskaznik-rozlaczenie-20260830
$ ls -la node_modules
lrwxr-xr-x@ 1 piotrwisniewski wheel 56 Aug 30 10:22 node_modules -> /Users/piotrwisniewski/Developer/Consultify/node_modules
$ df -h /
Filesystem        Size    Used   Avail Capacity iused ifree %iused  Mounted on
/dev/disk3s1s1   1.8Ti    12Gi    21Gi    37%    459k  216M    0%   /
```

Porty `6030`, `4954` i `4955`: brak procesu nasłuchującego. Kontener uruchomiono jako `cx-day144-pg`, obraz `pgvector/pgvector:pg16`, bind wyłącznie `127.0.0.1:6030`.

### Pełne migracje przed pomiarem

Komenda pierwszego i drugiego przebiegu:

```bash
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6030/cx144 \
  npx tsx server/scripts/migrate.postgres.ts
```

Wynik wejściowy: `864` wpisy `→`, `✅ Postgres migrations complete`. Drugi przebieg: `Applying migrations: 0`, `✅ Postgres migrations complete`.

### Protokół Z30 przed testami

```text
$ env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL|ENABLE_LIVE_EMAIL)" || echo "BRAK ZMIENNYCH POCZTY"
BRAK ZMIENNYCH POCZTY
$ docker exec cx-day144-pg psql -U postgres -d cx144 -c "SELECT key, left(coalesce(value,''),8) FROM settings WHERE key LIKE 'smtp%';"
 key | left
-----+------
(0 rows)
$ grep -n "startNotificationOutboxDrainCron\|outboxWorker\|platformOutboxDrainCron" server/src/Gateway.ts
[brak wyjścia]
```

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

### T1–T4 — komendy wejściowe i wyniki

```text
$ grep -n "initiative_id" -A2 server/migrations/061_initiative_lifecycle.sql | grep -B1 -A1 CASCADE
18:    FOREIGN KEY (initiative_id) REFERENCES initiatives(id) ON DELETE CASCADE,
--
46:    FOREIGN KEY (initiative_id) REFERENCES initiatives(id) ON DELETE CASCADE
--
131:    FOREIGN KEY (initiative_id) REFERENCES initiatives(id) ON DELETE CASCADE,

$ grep -rn "REFERENCES initiative_kpis" server/migrations/*.sql | grep -i cascade
[14 trafień źródłowych; pełny wynik: kpi-cascades-source.log]

$ grep -rn "REFERENCES initiatives(id)" server/migrations/*.sql | grep -i cascade | head -12
server/migrations/000_zz_core_baseline_producers_fresh_db_gap.sql:446: ... ON DELETE CASCADE,
server/migrations/000_zz_core_baseline_producers_fresh_db_gap.sql:447: ... ON DELETE CASCADE
server/migrations/061_initiative_lifecycle.sql:18: ... ON DELETE CASCADE,
server/migrations/061_initiative_lifecycle.sql:46: ... ON DELETE CASCADE
server/migrations/061_initiative_lifecycle.sql:131: ... ON DELETE CASCADE,
server/migrations/065_budget_tracking.sql:27: ... ON DELETE CASCADE,
server/migrations/066_status_reports.sql:63: ... ON DELETE CASCADE,
server/migrations/067_economics_initiative_integration.sql:16: ... ON DELETE CASCADE,
server/migrations/067_economics_initiative_integration.sql:65: ... ON DELETE CASCADE,
server/migrations/067_economics_initiative_integration.sql:110: ... ON DELETE CASCADE,
server/migrations/20260228_budget_initiative_links.sql:40: ... ON DELETE CASCADE,
server/migrations/20260411_p11_status_history_org_id_backfill.sql:7: ... ON DELETE CASCADE,

$ grep -n "CREATE TABLE" -A12 server/migrations/20260810_rvn_kpi_core.sql 2>/dev/null | grep -iE "rvn_kpi_definitions|initiative_id" | head -6
50:CREATE TABLE IF NOT EXISTS rvn_kpi_definitions (
112-  kpi_id UUID NOT NULL REFERENCES rvn_kpi_definitions(kpi_id),
284-  kpi_id UUID NOT NULL REFERENCES rvn_kpi_definitions(kpi_id),

$ grep -rn "initiatives/.*kpis\|/benefits" src/components/Benefits/*.tsx | head -6
src/components/Benefits/BenefitsHub.tsx:199: const kpiResponse = await Api.get(`/initiatives/${i.id}/kpis`);
src/components/Benefits/FinancialMappingPanel.tsx:101: Api.get('/benefits/financial/statement-lines'),
src/components/Benefits/FinancialMappingPanel.tsx:102: Api.get('/benefits/financial/kpi-mappings'),
src/components/Benefits/FinancialMappingPanel.tsx:103: Api.get('/benefits/kpi-mappings'),
src/components/Benefits/FinancialMappingPanel.tsx:145: await Api.post('/benefits/financial/kpi-mappings', {
src/components/Benefits/FinancialMappingPanel.tsx:166: await Api.delete(`/benefits/financial/kpi-mappings/${mappingId}`);
```

T1, T2, T3 i T4 potwierdzone. Źródło prawdy ekranu nie zostało zmienione.

## Korekty wobec instrukcji

1. `§0.2b (2)` wymaga trzech dowodów „ZANIM uruchomisz cokolwiek zapisującego”, ale dowód (b) wymaga tabeli `settings` „Po migracjach”. Zgodnie z bezpieczniejszą wykonalną kolejnością najpierw sprawdziłem brak zmiennych pocztowych, uruchomiłem wyłącznie migrator (bez pełnego serwera i drenaży), a następnie potwierdziłem `0 rows` w `settings` przed testem zapisującym fixture. Nie uruchomiono transportu ani outboxu.
2. Skrót tezy T2 mówi o „więcej niż jednej” kaskadzie. Katalog realnej bazy po pełnych migracjach daje dokładnie 14 relacji bezpośrednio dotyczących `initiative_kpis`: 8 dzieci `CASCADE`, 3 `SET NULL`, 2 kolumny jednego złożonego FK `NO ACTION` oraz relację KPI→inicjatywa (po zmianie `SET NULL`). Liczę katalog bazy, nie liczbę wystąpień w plikach migracji.
3. R3 wymagał osobnej obsługi mapowań: `initiative_kpi_mappings.initiative_id` było `NOT NULL ON DELETE CASCADE`. Bez drugiej zmiany w tej samej migracji mapowanie zostałoby skasowane mimo przeżycia KPI. Zmieniono je na nullable `ON DELETE SET NULL`.
4. Pierwsza próba zewnętrznego configu nie uruchomiła testu (`Cannot find module 'vitest/config'`), druga użyła usuniętej składni Vitest 4, trzecia ujawniła niepoprawną fixture `severity=HIGH`. Żadnej z nich nie zaliczam jako W-A. Czerwony wynik poniżej ma 1 wykonany test i asercję danych.

## R1 — inwentarz wszystkich relacji w łańcuchu KPI

Źródło: `pg_constraint` realnego Postgresa po pełnych migracjach. Złożony FK `fk_initiative_kpis_current_version` ma dwie kolumny i jest pokazany w dwóch wierszach katalogu.

| Relacja                                             | Dziecko → rodzic                                           | `ON DELETE` po zmianie | Skutek fizycznego usunięcia inicjatywy                 |
| --------------------------------------------------- | ---------------------------------------------------------- | ---------------------- | ------------------------------------------------------ |
| `initiative_kpis_initiative_id_fkey`                | `initiative_kpis.initiative_id` → `initiatives.id`         | `SET NULL`             | KPI przeżywa; odnośnik inicjatywy jawnie znika         |
| `initiative_kpi_mappings_initiative_id_fkey`        | `initiative_kpi_mappings.initiative_id` → `initiatives.id` | `SET NULL`             | mapowanie przeżywa; bezpośredni odnośnik jawnie znika  |
| `initiative_kpi_mappings_kpi_id_fkey`               | `initiative_kpi_mappings.kpi_id` → KPI                     | `CASCADE`              | nie uruchamia się, bo KPI przeżywa; `kpi_id` zachowany |
| `kpi_definition_versions_kpi_id_fkey`               | `kpi_definition_versions.kpi_id` → KPI                     | `CASCADE`              | jak wyżej                                              |
| `kpi_deviation_cases_kpi_id_fkey`                   | `kpi_deviation_cases.kpi_id` → KPI                         | `CASCADE`              | jak wyżej                                              |
| `kpi_financial_mappings_kpi_id_fkey`                | `kpi_financial_mappings.kpi_id` → KPI                      | `CASCADE`              | jak wyżej                                              |
| `kpi_measurements_kpi_id_fkey`                      | `kpi_measurements.kpi_id` → KPI                            | `CASCADE`              | jak wyżej                                              |
| `kpi_recovery_cards_kpi_id_fkey`                    | `kpi_recovery_cards.kpi_id` → KPI                          | `CASCADE`              | jak wyżej                                              |
| `kpi_scorecard_items_kpi_id_fkey`                   | `kpi_scorecard_items.kpi_id` → KPI                         | `CASCADE`              | jak wyżej                                              |
| `kpi_time_series_kpi_id_fkey`                       | `kpi_time_series.kpi_id` → KPI                             | `CASCADE`              | jak wyżej                                              |
| `initiative_benefits_source_initiative_kpi_id_fkey` | benefit → KPI                                              | `SET NULL`             | nie uruchamia się, bo KPI przeżywa                     |
| `fk_okr_kr_kpi`                                     | OKR KR → KPI                                               | `SET NULL`             | nie uruchamia się, bo KPI przeżywa                     |
| `v8_kpi_definitions_canonical_kpi_id_fkey`          | V8 KPI → KPI                                               | `SET NULL`             | nie uruchamia się, bo KPI przeżywa                     |
| `fk_initiative_kpis_current_version`                | `(KPI.id,current_definition_version)` → definition version | `NO ACTION`            | niezależne od usunięcia inicjatywy                     |

Pełny wynik katalogu: `/private/tmp/cx-day144-wskaznik-rozlaczenie-artefakty/kpi-constraints-after.log`.

## R2 — migracja addytywna

Utworzono wyłącznie `server/migrations/20260830_day144_kpi_lifecycle_decouple.sql`. Migracja nie kasuje tabel, kolumn ani danych. Zdejmuje dwa destrukcyjne FK, ustawia kolumny nullable i odtwarza FK jako `ON DELETE SET NULL` w jednej transakcji.

Po dodaniu migracji runner podał:

```text
Applying migrations: 1
→ 20260830_day144_kpi_lifecycle_decouple.sql
✅ Postgres migrations complete
Applying migrations: 0
✅ Postgres migrations complete
```

## R3 — wiersze zależne

Test danych tworzy KPI oraz mapowanie, przypadek odchylenia i pomiar. Po fizycznym `DELETE FROM initiatives`:

```text
DAY144_SELECT_AFTER [{"kpi_id":"a99a333c-42a0-4f99-83e7-440ec5dade0a","initiative_id":null,"current_value":40,"target_value":100,"unit":"percent","mapping_id":"79afdcce-ef27-4619-8082-60a8a73b1e31","mapping_initiative_id":null,"deviation_id":"4dce7eee-1e07-48d7-aff9-9a4e53741868","measurement_id":"d23e0c28-efcb-465f-888e-8705e2277a60","measurement_value":40}]
```

KPI, mapowanie, odchylenie i pomiar przeżyły; wartości KPI i pomiaru są zachowane. Dzieci nadal mają `kpi_id`; oba odnośniki do nieistniejącej inicjatywy są jawnie `NULL`. Zero kasowania danych w migracji.

## R4 — odwracalność

Odwrócenie jest możliwe, ale nie może być bezrefleksyjnym DDL:

1. Znaleźć wszystkie `initiative_kpis` i `initiative_kpi_mappings` z `initiative_id IS NULL`.
2. Każdy wiersz jawnie przyłączyć do istniejącej inicjatywy albo podjąć decyzję retencyjną. Próba przywrócenia `NOT NULL` przed rozstrzygnięciem ma paść.
3. Zastąpić oba FK `SET NULL` constraintami `ON DELETE CASCADE`.
4. Przywrócić `NOT NULL` dopiero gdy liczba `NULL` wynosi zero.

Skutek cofnięcia: przyszłe fizyczne usunięcie inicjatywy znów będzie destrukcyjne dla KPI i mapowania. Wiersze, które utraciły odnośnik w okresie obowiązywania migracji, nie mogą automatycznie odzyskać historycznego ID usuniętej inicjatywy; wymagają jawnego mapowania lub decyzji właściciela.

## W-A i W-C — para przebiegów po pełnej nazwie

Ta sama komenda testowa, ten sam lokalny PostgreSQL, `--retry=0`, zewnętrzny config bez `DB_TYPE='sqlite'`:

```bash
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6030/cx144 \
JWT_SECRET=cx144-test-secret-do-not-reuse \
npx vitest run src/routes/__tests__/day144.kpi-physical-delete-survival.pg.test.ts \
  --config /private/tmp/cx-day144-wskaznik-rozlaczenie-scratch/day144.vitest.config.ts \
  --retry=0 --reporter=json --outputFile=<before-lub-after.json>
```

Przed migracją:

```text
numTotalTests: 1
numPassedTests: 0
numFailedTests: 1
numPendingTests: 0
fullName: Day 144 — KPI lifecycle decoupling from physical initiative deletion preserves the KPI values and dependent rows after the initiative is physically deleted
status: failed
AssertionError: expected [] to have a length of 1 but got +0
```

Po migracji:

```text
numTotalTests: 1
numPassedTests: 1
numFailedTests: 0
numPendingTests: 0
fullName: Day 144 — KPI lifecycle decoupling from physical initiative deletion preserves the KPI values and dependent rows after the initiative is physically deleted
status: passed
```

Porównanie różnicowe po `fullName`: ten sam jeden przypadek zmienił stan `failed → passed`; nie pojawił się przypadek pominięty ani zastępczy.

## Pułapki (a)–(e) dla pakietu Day 144

- (a) `ENABLE_V8_GLOBAL=true` ustawione w tej samej linii. Test nie używa HTTP ani V8 gate, więc nie jest dowodem osiągalności API; zmienna zamyka możliwość przypadkowej fałszywej 404 przy imporcie ścieżki serwerowej.
- (b) `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce` ustawione w tej samej linii. Test nie używa middleware widoczności Results.
- (c) dotyczy bezpośrednio. `DB_TYPE=postgres` jest ustawione w komendzie, config poza repo nie zawiera nadpisania `DB_TYPE`, pierwszy hook asertuje `expect(process.env.DB_TYPE).toBe('postgres')`, a `assertRealPostgresTestEnvironment()` bez argumentów wykonuje `SELECT version()`, `current_database()` i `current_schema()`.
- (d) `ENABLE_TEST_AUTH_BYPASS=false` ustawione. Test nie jest dowodem autoryzacji ani ścieżki HTTP; fizyczny `DELETE` wykonuje bezpośrednio przez `pg` zgodnie z celem R2.
- (e) dotyczy bezpośrednio. Katalog `pg_constraint` zmierzono przed projektem; test obejmuje mapowanie, odchylenie i pomiar. Pozostałe relacje sklasyfikowano na podstawie realnego katalogu.

## W-D — granica rozłączności

```text
$ git diff --name-only c685ea65af..HEAD
server/migrations/20260830_day144_kpi_lifecycle_decouple.sql
server/src/routes/__tests__/day144.kpi-physical-delete-survival.pg.test.ts
docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY144_WSKAZNIK_ROZLACZENIE_REPORT.md
```

Każdy plik ma imienną licencję. Nie zmieniono frontu, historycznej migracji `061`, configów testowych ani globalnych helperów. Nie wykonano pushu.

## Artefakty poza repo

| Artefakt                    | SHA-256                                                            |
| --------------------------- | ------------------------------------------------------------------ |
| `day144-before.json`        | `350d9c2f38cb9cc2e12ceb357c453d65d255706534a7251a99365bbb7773e171` |
| `day144-after.json`         | `53940e7a2616343008773f0b4b94a74a7c49737932b97a17fecd2f4d9225d33c` |
| `day144-after-verbose.log`  | `811bcfff41b38bcaa08c9a87112b3dd5c5514b55658fc6c666596a67addfa88e` |
| `migrate-first.log`         | `1c597592b3bc489b56af4016abba053f861b1f2408e3a9275435fedc9b466e79` |
| `migrate-second.log`        | `3741d4a362ac4a53517ddb6e3e801d3d48346fb7c47757c80e584f35485a8df3` |
| `migrate-day144-first.log`  | `4c1f2afd26ea075391466ec5229a2574615d4127bc983ee68dae0fd72008a525` |
| `migrate-day144-second.log` | `1019ab02425d7fa8cbbaba18cdeb8c1ef38a8bcc1d4bdb525d89c4c9b1f5c286` |
| `kpi-cascades-source.log`   | `efbfc0613347f9074a498fcaf9f0b59479219c24d1c1a7cfd479d032c53c5ce2` |
| `kpi-constraints-after.log` | `ac324e55ac96344f5a21ae6184cdc8b861d5670d4fc4080b65f6ea5b4fde9e9d` |

Wszystkie ścieżki zaczynają się od `/private/tmp/cx-day144-wskaznik-rozlaczenie-artefakty/`.

## TWIERDZENIA NIEZWERYFIKOWANE

1. Nie wykonałem procedury cofnięcia na osobnej bazie; odwracalność jest opisana i wynika z jawnych kroków DDL/danych, ale nie ma zielonego artefaktu rollbacku.
2. Test danych bezpośrednio obejmuje mapowanie, odchylenie i pomiar. Zachowanie `kpi_definition_versions`, `kpi_financial_mappings`, `kpi_recovery_cards`, `kpi_scorecard_items` i `kpi_time_series` po usunięciu inicjatywy jest potwierdzone przez realny katalog FK i fakt przeżycia rodzica KPI, lecz nie przez osobne fixture każdego typu.
3. Nie uruchamiałem pełnej ścieżki HTTP przez `ApiGateway`, ponieważ badana operacja to fizyczny `DELETE` i dyżur licencjonuje migrację oraz test danych, nie trasę kasowania. Raport nie twierdzi, że produkcyjny endpoint fizycznego kasowania istnieje lub jest osiągalny.
4. Nie uruchamiałem runtime na portach `4954/4955`; nie było zmiany UI ani potrzeby zrzutów.
