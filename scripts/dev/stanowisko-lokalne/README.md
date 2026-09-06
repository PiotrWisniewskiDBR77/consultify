# Stanowisko lokalne NOC (06.09) — baza + serwer + frontend + zalogowana sesja

Kompletne, **całkowicie lokalne** środowisko dla nocnych audytorów i robotników:
własna baza Postgres, własny serwer, własny vite i **zapisana sesja Playwright**,
żeby zrzuty ekranów nie wymagały sesji właściciela.

**Nie dotyka stagingu, demo ani produkcji.** Wszystkie porty własne — nie kolidują
z vite innych agentów (3000/3030/3079/3097/3100/3200) ani z obcą bazą na 5433.

| Element   | Port  | Adres                                | PID / kontener              |
|-----------|-------|--------------------------------------|-----------------------------|
| Postgres  | 54400 | `127.0.0.1:54400/consultify_noc`     | docker `consultify-noc-pg`  |
| Serwer    | 4100  | http://127.0.0.1:4100/api/health     | `/private/tmp/stanowisko-noc/server.pid` |
| Frontend  | 3090  | http://localhost:3090                | `/private/tmp/stanowisko-noc/vite.pid`   |

Katalog roboczy (poza repo, sekrety `chmod 600`): `/private/tmp/stanowisko-noc/`
— `server.env` (flagi + klucze AI), `konto.json` (login i hasło), `auth.json`
(sesja Playwright), `server.log`, `vite.log`.

## Start / stop

```bash
bash scripts/dev/stanowisko-lokalne/start.sh      # baza -> serwer -> frontend (idempotentne)
bash scripts/dev/stanowisko-lokalne/stop.sh       # zatrzymuje TYLKO własne PID-y
bash scripts/dev/stanowisko-lokalne/stop.sh --baza  # dodatkowo zatrzymuje kontener
```

`stop.sh` zabija wyłącznie PID-y z `/private/tmp/stanowisko-noc/*.pid`.
**Zakaz `pkill vite` / `pkill node`** — na tej maszynie pracują inni agenci.

## Baza od zera

```bash
docker run -d --name consultify-noc-pg -e POSTGRES_PASSWORD=noc -e POSTGRES_USER=postgres \
  -e POSTGRES_DB=consultify_noc -p 127.0.0.1:54400:5432 pgvector/pgvector:pg16
bash scripts/dev/stanowisko-lokalne/migracje.sh     # 1104 pliki SQL, bez --allow-checksum-drift
```

Migrator wołany dokładnie tak jak w CI:
`DB_TYPE=postgres NODE_ENV=test DATABASE_URL=... npx tsx server/scripts/migrate.postgres.ts`
(wynik: 1803 tabele w `public`).

Podgląd bazy bez psql na hoście:
`docker exec -i consultify-noc-pg psql -U postgres -d consultify_noc -c "..."`

## Sesja Playwright (odświeżanie)

Token żyje ~8 h (`JWT_EXPIRES_IN`). Odświeżenie:

```bash
node scripts/dev/stanowisko-lokalne/zaloguj-api.mjs
```

Skrypt loguje się **formularzem** na `http://localhost:3090/login` (dane z
`konto.json`), wycisza kreator powitalny („Krok 1 z 3 — WITAJ W CONSULTIFY";
`--z-onboardingiem` zostawia go) i zapisuje `storageState` do
`/private/tmp/stanowisko-noc/auth.json`. Plik ma dwa originy —
`http://localhost:3090` i kanoniczny `http://localhost:3000` — więc działa
z `scripts/dev/odbior-zywo/zrzut.mjs` z `--port` i bez.

Zrzut ekranu:

```bash
ODBIOR_AUTH_STATE=/private/tmp/stanowisko-noc/auth.json \
  node scripts/dev/odbior-zywo/zrzut.mjs --url=/my-work --port=3090 \
  --out=/private/tmp/stanowisko-noc/test-mywork.png
```

W `<out>.json` sprawdź `url` (nie może być `/login`) i `bledyKonsoli` (bez 401).

## Konto

`audyt@dbr77.local`, rola ADMIN/OWNER, organizacja **DBR77**.
Hasło: `/private/tmp/stanowisko-noc/konto.json` (chmod 600, poza repo, losowe).
Konto istnieje **wyłącznie w lokalnej bazie** — nie ma go na stagingu/demo/produkcji.

## Flagi i klucze (parytet ze stagingiem)

`/private/tmp/stanowisko-noc/server.env` powstaje z:

```bash
railway variables --environment staging --service consultify --json > railway-staging.json
node scripts/dev/stanowisko-lokalne/flagi-ze-stagingu.mjs   # przenosi ENABLE_*/VITE_*/klucze AI
```

**Świadomie NIE przenosimy**: `DATABASE_URL`/`DATABASE_PUBLIC_URL`, `REDIS_*`,
`APP_BUILD_SHA`, `FORCE_SUPERADMIN_EMAILS` (robi trwały UPDATE `users.role`),
`RAILWAY_*` (włączyłyby `isRunningInsideRailway` i wywróciły strażniki bazy),
`STRIPE_*`, `SMTP_*`, webhooki Slacka, `SENTRY_DSN`, sekrety OAuth, `DB_*` stagingu.

## Założenia, które trzeba znać

1. **`CI=true` przy `NODE_ENV=development`.** `databaseTargetResolver.ts`
   (`allowLocalDatabaseForTests`) odrzuca bazę na `127.0.0.1` poza testami.
   Przełączenie `NODE_ENV=test` byłoby gorsze: bez `RUN_DB_TESTS=1` podstawia
   **atrapę bazy** (`shouldUseMockDatabase`). `CI` jest w `server/src` czytane
   dokładnie w tym jednym miejscu — nic innego nie zmienia zachowania.
2. **`DB_MANAGED_SCHEMA=off`** — schemat stawiają migracje, nie `initDb()`.
3. **`VITE_DOTENV_DISABLED=1`** dla vite: repo-owy `.env.local` kieruje
   `VITE_API_TARGET` na **staging** i w `vite.config.ts` wygrywa z `process.env`.
   Bez tej flagi proxy `/api` poszłoby na staging zamiast na `:4100`.
4. **Redis nie jest wymagany** — `RedisRateLimitStore` fail-open.
5. `npm run dev:*` **nie nadaje się** do stanowiska: `scripts/dev/reject-local-db.mjs`
   twardo blokuje lokalne cele bazy. Dlatego `start.sh` woła `tsx`/`vite` wprost.

## Dane (seedy)

Uruchamiane z org DBR77 (`SEED_ORG_ID` = uuid organizacji z `konto.json`),
env: `DB_TYPE=postgres NODE_ENV=development CI=true DOTENV_DISABLED=1 DATABASE_URL=...`

| Seed | Efekt |
|------|-------|
| `server/scripts/seed-wyniki-dbr77.ts --org=DBR77 --apply` | KPI/OKR/ROI (`rvn_*`, `okr_vnext_*`) |
| `server/scripts/seed-production-dbr77-users.ts` | 18 użytkowników org (wymaga `SEED_USER_PASSWORD`, `SEED_MODE=production`, `SEED_CONFIRM=YES_I_UNDERSTAND_PRODUCTION`) |
| `server/scripts/seed-mywork-demo.ts` | zadania, decyzje, pomysły, notatnik, powiadomienia |
| `server/scripts/seed-interview-demo.ts` | szablony, sesje, insighty (wymaga `SEED_USER_PASSWORD`) |
| `server/scripts/seed-insights-initiatives-rich-demo.ts` | insighty + inicjatywy (wymaga `SEED_CONFIRM=YES` i `SEED_PROJECT_ID`) |
| `server/scripts/seed-full-assessment-module.ts` | oceny DRD/SIRI/ADMA + raporty (`TARGET_ORG_ID`) |
| `server/scripts/seed-execution-reports-data.ts` | Realizacja: RAID, kamienie milowe, budżety — **stała `const ORG = 'dbr77'` w pliku**; uruchamiać na kopii z podmienionym uuid |

### Realizacja › Zasoby — podaż godzin (1.12-R2, 06.09)

Migracja `20262103_users_weekly_capacity_hours.sql` dodała do `users` dwie
kolumny: `weekly_capacity_hours` i `availability_percent` (obie NULLable;
NULL = „nikt nie ustawił" i serwis podstawia 40 h × 100 %). Endpoint
`GET /api/execution-control/capacity/resource-plan?weeks=8` liczy z nich
podaż, a popyt bierze z `tasks.estimated_hours`.

**Dane pokazowe stanowiska (ustawione ręcznie, nie seedem):**

| Osoba | Ustawienie | Po co |
|------|------------|-------|
| Marta Kamińska (`5009e749-…`) | `weekly_capacity_hours = 40`, `availability_percent = 50` | pół etatu — żeby kolumna „Podaż (h)" nie była jednakowa we wszystkich wierszach i żeby widać było różnicę „z profilu" vs „domyślna" |

Ustawienie z powrotem na domyślne:
`PATCH /api/users/<id>/capacity` z `{"weeklyCapacityHours":null,"availabilityPercent":null}`.

**Czego NIE DA SIĘ dziś utworzyć (zmierzone 06.09):** realizacji
(`ie_aggregate_state.aggregate_type='execution_case'`) — w DBR77 jest ich 0.
Łańcuch kanoniczny to inicjatywa → decyzja harmonogramu (żądanie + zgoda)
→ pakiet handoffu → żądanie handoffu → akcept handoffu → realizacja, a
`scheduleDecision.ts:194` i `:308` wymagają, żeby **zatwierdzający był INNĄ
osobą niż wnioskujący** (`policy.config.selfApproval = false`), i to przy
obu bramkach. Jednym kontem nie da się przejść tej ścieżki — potrzebne są dwa
zalogowane konta w tej organizacji.

### Jak dodać seed

1. Sprawdź, czy skrypt bierze org z env (`SEED_ORG_ID`/`TARGET_ORG_ID`) — jeśli ma
   stałą w pliku, zrób kopię poza repo z podmienionym uuid (nie modyfikuj repo).
2. Uruchom z env jak wyżej; **`NODE_ENV=development CI=true`**, nigdy `NODE_ENV=test`
   (atrapa bazy → „organization not found" mimo istniejącego wiersza).
3. Policz wynik zapytaniem `SELECT count(*) ... WHERE organization_id=...` i dopisz
   do tabeli powyżej.

### Znane braki (stan 06.09, nienaprawione)

- `seed-production-dbr77-sample-data.ts` — pada na
  `null value in column "organization_id" of relation "assessment_workflows"`
  (rozjazd seeda ze schematem). Część danych wchodzi przed błędem.
- **Spotkania**: brak seeda Postgres z parametrem org — tabela `meetings` pusta.
- **Materiały / Audyty**: jw., brak seeda per-org.
- `seed-dbr77-fill-all-tables.ts` — wyłącznie SQLite, nie działa tu.
- `seed-apator-organization.ts` i `build-demo-dataset.ts` zakładają **osobne**
  organizacje (Apator / Atelier Toys) — audytor zalogowany jako DBR77 ich nie zobaczy.

## Typ organizacji (06.09)
Organizacja DBR77 na lokalnej bazie ma `organization_type=PAID` (jak org właściciela na stagingu `a3e05d4a…`). Z `TRIAL` strażnik `highRiskSurfaceGuard` blokuje eksporty (403 `TRIAL_EXPORT_DISABLED`) i audyty meldują fałszywy bloker (host harnessu ≠ produkt). Po odtworzeniu bazy od zera: `UPDATE organizations SET organization_type='PAID' WHERE name='DBR77';`

## Odtworzenie po skasowaniu katalogu (incydent 06.09)
1. `mkdir -p /private/tmp/stanowisko-noc && chmod 700 …`; `railway variables --json --environment staging > …/railway-staging.json`; `node scripts/dev/stanowisko-lokalne/flagi-ze-stagingu.mjs` → `server.env`.
2. Nowe hasło konta audytowego (hash bcryptjs, kolumna `users.password`): `HASH=$(node -e "console.log(require('bcryptjs').hashSync(process.argv[1],10))" "$PW")` → `UPDATE users SET password=$HASH WHERE email='audyt@dbr77.local'`; `konto.json` = `{email, haslo, orgId, orgNazwa}` (chmod 600).
3. `node scripts/dev/stanowisko-lokalne/zaloguj-api.mjs` → `auth.json`. Pliki `server.pid`/`vite.pid` odtworzyć z `lsof -nP -iTCP:4100 -iTCP:3090 -sTCP:LISTEN`.
4. W każdym zleceniu: `rm -rf` wolno TYLKO we własnym worktree; `/private/tmp/stanowisko-noc` jest współdzielony (plik `NIE_USUWAC.txt`).
