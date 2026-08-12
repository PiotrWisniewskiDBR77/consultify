# RN-G6 — Results Next realny runtime środowiska lokalnego

**Cel dokumentu.** Największa dziura w dowodach programu Results Next: żaden
ekran (`/results/kpi`, `/results/roi`, `/results/okr`) nigdy nie był oglądany
na realnych danych — wszystkie zrzuty pochodziły z `dev-render`, harnessu z
podstawioną warstwą sieciową (dowód UKŁADU komponentu, nie dowód endpointu ani
trwałości). Ten dokument to **kopiowalny runbook**, który stawia realny
PostgreSQL 17 + realne migracje + realistyczny zestaw danych + realny backend
+ realny frontend (`MainLayout`/`BrowserRouter`, prawdziwe logowanie) w ~10
minut, bez zgadywania. Zbudowane i zweryfikowane w tej sesji na gałęzi
`rn-g6-runtime`, HEAD wyjściowy `f97f7de107`.

Właściciel zdecydował: **NIE testujemy na demo.** Kod nigdy tam nie trafił,
flagi są OFF, wejście wymagałoby push+deploy. To środowisko jest lokalne,
efemeryczne i celowo odizolowane od demo/staging/prod.

---

## 0. Skrócona ścieżka (TL;DR)

```bash
# 1) Postgres
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"
export LC_ALL=C LANG=C
mkdir -p /tmp/rn-g6-sock
pg_ctl -D /Users/piotrwisniewski/rn-g6-lanes/pgdata-g6 \
  -o "-p 55821 -k /tmp/rn-g6-sock -c listen_addresses=127.0.0.1" \
  -l /Users/piotrwisniewski/rn-g6-lanes/pgdata-g6/server.log start

# 2) Migracje (jeśli katalog danych świeży — patrz §1 dla initdb/createdb)
cd /Users/piotrwisniewski/rn-g2-lanes/g6-runtime
DATABASE_URL=postgresql://postgres@127.0.0.1:55821/rn_g6_runtime NODE_ENV=test DB_TYPE=postgres \
  npx tsx server/scripts/migrate.postgres.ts

# 3) Seed (realistyczne dane RN — patrz §2)
DATABASE_URL=postgresql://postgres@127.0.0.1:55821/rn_g6_runtime NODE_ENV=test \
  SEED_CONFIRM=YES_SEED_RN_G6_LOCAL \
  npx tsx scripts/rn-g6-seed-runtime-dataset.ts --wipe

# 4) Backend (port 3097) — patrz §3 dla pełnej listy zmiennych i DLACZEGO
cd server
DATABASE_URL=postgresql://postgres@127.0.0.1:55821/rn_g6_runtime NODE_ENV=test DB_TYPE=postgres \
  DB_MANAGED_SCHEMA=off PORT=3097 MOCK_DB=false RUN_DB_TESTS=1 POSTGRES_SKIP_INIT_IN_TEST=1 \
  ENABLE_TEST_GATEWAY=true DISABLE_SCHEDULER=true DISABLE_AI_PROVIDER_SENTINEL=true \
  DISABLE_AI_HEALTH_MONITOR=true DISABLE_STARTUP_HEALTH_MONITOR=true SKIP_STARTUP_VALIDATOR=true \
  DEFER_LLM_CONFIG_INIT_MS=3000 npx tsx src/index.ts
cd ..

# 5) Frontend (port 3197), wskazany na backend z kroku 4
VITE_API_TARGET=http://127.0.0.1:3097 VITE_API_URL= npx vite --port 3197 --strictPort

# 6) Wejdź na http://localhost:3197/results/kpi?ff_resultsVNextKpi=1
#    Zaloguj: rn-g6-user-a-admin@consultify.local / RnG6Runtime!2026 (patrz §5)
```

---

## 1. ZADANIE 1 — realny PostgreSQL 17 z pełnym łańcuchem migracji

Na tej maszynie `psql` nie jest w PATH. Binaria: `/opt/homebrew/opt/postgresql@17/bin/`.

```bash
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"
export LC_ALL=C LANG=C          # bez tego postmaster pada: "became multithreaded during startup"

DATADIR=/Users/piotrwisniewski/rn-g6-lanes/pgdata-g6
initdb --locale=C -D "$DATADIR" -U postgres

# katalog gniazda MUSI być krótki — ścieżka >103 bajtów przekracza limit systemu
mkdir -p /tmp/rn-g6-sock
pg_ctl -D "$DATADIR" -o "-p 55821 -k /tmp/rn-g6-sock -c listen_addresses=127.0.0.1" \
  -l "$DATADIR/server.log" start

createdb -h /tmp/rn-g6-sock -p 55821 -U postgres rn_g6_runtime
```

Migracje (NIE używaj `--safe` — raportuje padniętą migrację jako `skipped` i
kończy exit 0, czyli kłamie):

```bash
cd /Users/piotrwisniewski/rn-g2-lanes/g6-runtime
DATABASE_URL=postgresql://postgres@127.0.0.1:55821/rn_g6_runtime NODE_ENV=test DB_TYPE=postgres \
  npx tsx server/scripts/migrate.postgres.ts
```

Wynik w tej sesji: **~130 plików migracji, zero błędów**, kończy się
`✅ Postgres migrations complete`. Uwaga: `databaseTargetResolver.ts`
(`assertNoLocalDatabaseOutsideTests`) odmawia połączenia z localhost poza
`NODE_ENV=test/CI/VITEST`, także dla samego skryptu migracji — stąd
`NODE_ENV=test` jest wymagane nawet tutaj.

### Odcisk bazy (przez `information_schema`, NIE `schema_migrations` — ta
tabela bywa w tym repo niewiarygodna):

```sql
select count(*) from information_schema.tables
  where table_schema='public' and table_type='BASE TABLE';        -- 1401
select count(*) from information_schema.tables
  where table_schema='public' and table_name like 'rvn_%';        -- 42
select count(*) from information_schema.tables
  where table_schema='public' and table_name like 'okr_vnext_%';  -- 15
```

**Odkrycie:** domena OKR NIE żyje pod prefiksem `rvn_okr_*` jak KPI/ROI
(`rvn_kpi_*`, `rvn_roi_*`) — używa własnego prefiksu **`okr_vnext_*`** (19
tabel łącznie z `%okr%`, z czego 4 to STARE, przed-vnext tabele:
`okr_cycles`, `okr_key_results`, `okr_objectives`, `okr_check_ins` —
NIE mylić z `okr_vnext_cycles` itd.). Jeśli szukasz danych OKR i grepujesz
tylko `rvn_okr_`, znajdziesz zero wierszy i błędnie uznasz domenę za pustą.

Backend przy starcie uruchamia DODATKOWO własny, wewnętrzny system migracji
("Table Platform" — `server/src/services/tablePlatform/migrationRunner.ts`),
niezależny od `migrate.postgres.ts`. W tej sesji zgłosił `0 applied, 487
already up to date` — czyli zbieżny ze stanem po `migrate.postgres.ts`, ale
policz go jako DRUGI, osobny system, nie zakładaj że jeden pokrywa drugi.

---

## 2. ZADANIE 2 — realistyczny zbiór danych

`server/scripts/build-demo-dataset.ts` (i `db:seed:*` w `package.json`) **NIE
tworzą danych Results Next** (`rvn_*`, `okr_vnext_*`) — to nowa domena, poza
zasięgiem generatora demo. Ten program ma własne zabezpieczenia celujące w
żywe środowiska (`resolveScriptDatabaseTarget`, `DEMO_DATASET_CONFIRM`) —
uszanowane, nie obchodzone: seed RN-G6 to OSOBNY skrypt, `scripts/rn-g6-seed-runtime-dataset.ts`.

```bash
cd /Users/piotrwisniewski/rn-g2-lanes/g6-runtime
DATABASE_URL=postgresql://postgres@127.0.0.1:55821/rn_g6_runtime NODE_ENV=test \
  SEED_CONFIRM=YES_SEED_RN_G6_LOCAL \
  npx tsx scripts/rn-g6-seed-runtime-dataset.ts --wipe
```

Guardrails: `assertNoLocalDatabaseOutsideTests` (ten sam co
`scriptDatabaseTarget.ts`), `SEED_CONFIRM=YES_SEED_RN_G6_LOCAL` wymagane,
`--wipe` robi delete SCOPED po `organization_id` (nigdy `TRUNCATE`) — bezpieczne
do wielokrotnego uruchamiania. Weryfikowane dwa cykle wipe+reseed pod rząd,
identyczne deterministyczne ID za każdym razem (`uid()` = hash tekstowy, nie
losowy UUID).

**WAŻNE — pisze SUROWYM SQL, nie przez warstwę serwisową.** To jest
świadoma decyzja pod presją czasu, nie przeoczenie: replikacja pełnej logiki
biznesowej (silnik ROI, workflow zatwierdzeń KPI, cadence OKR) przez ~90
endpointów byłaby osobnym programem. Kształty kolumn/enumów wzięte z
`\d <tabela>` na tej dokładnej bazie, nie z wyobraźni — ale skrypt NIE
przechodzi przez `server/src/services/resultsVnext/**`, więc nie udowadnia,
że reguły biznesowe API akceptują ten kształt danych na ścieżce zapisu
(tylko że odczyt renderuje się poprawnie — patrz §6 dla dowodu odczytu).

### Co zasiane (identyfikatory realne z ostatniego seeda; `--wipe` je
odtwarza identycznie):

**Organizacje (2 — do testu izolacji tenantów):**
| id | nazwa | uwaga |
|---|---|---|
| `rn-g6-org-przemysl` | Zjednoczona Grupa Przemysłowo-Technologiczna Wschód sp. z o.o. | bogaty zestaw (6 KPI, 4 fazy ROI, aktywny program OKR) |
| `rn-g6-org-doradztwo` | Konsorcjum Doradztwa Strategicznego i Transformacji Cyfrowej S.A. | lekki zestaw (2 KPI, 2 case'y ROI, program OKR TYLKO draft — nigdy aktywowany) |

**Użytkownicy testowi (hasło wspólne, patrz §5):**
| id | email | org | rola DB |
|---|---|---|---|
| `rn-g6-user-a-admin` | rn-g6-user-a-admin@consultify.local | rn-g6-org-przemysl | ADMIN |
| `rn-g6-user-b-admin` | rn-g6-user-b-admin@consultify.local | rn-g6-org-doradztwo | ADMIN |

**KPI (org A, 8 tabel `rvn_kpi_*` zapełnione):**
6 definicji pokrywających WSZYSTKIE stany cyklu — `KPI-A-001`…`KPI-A-006`
(active ×2, draft, pending_approval, suspended, archived). `KPI-A-001` ma
pomiar z DUŻĄ UJEMNĄ kwotą (`-2 450 320.75 PLN`, odchylenie budżetu) i
deviation case `plan_required` (case_id `4d5a5ea1-…`) z corrective action.
`KPI-A-002` ma pomiar z MAKSYMALNYM licznikiem (`999999999` zdarzeń IoT).
`KPI-A-003` (draft) celowo BEZ żadnego pomiaru — uczciwy stan „brak danych".
1 scorecard (`a7a84b5c-…`) z 3 pozycjami + 1 opublikowany review snapshot.
Org B: 2 KPI + 1 deviation case (lżejszy zestaw, wciąż realny).

**ROI (org A, 4 case'y = wszystkie 4 fazy: Build Case → Decision → Realize
Value → Learn, per `03_ROI_IMPLEMENTATION_PLAN.md` §"four phases"):**
| case_id | status | faza | uwaga |
|---|---|---|---|
| `4d60dfca-…` | `modeling` | Build Case | celowo BEZ calculation run → ekran musi pokazać „nieobliczalne"; ma benefit line niefinansową (`amount IS NULL`) |
| `4d60dfcb-…` | `approved` | Decision | MA completed calculation run + approval snapshot (npv, simple_roi, irr realne liczby) |
| `4d60dfcc-…` | `tracking` | Realize Value | actual snapshot + 2 actual entries + 1 OTWARTA wariancja forecast_vs_actual (−313.5%) |
| `4d60dfcd-…` | `post_investment_review` | Learn | finalized PIR, outcome `benefits_partially_realized`, lessons_learned wypełnione |

Org B: 2 case'y (`modeling`, `approved`) na 2 osobnych inicjatywach (unikalny
constraint `ux_rvn_roi_cases_one_active_per_initiative` wymusza 1 aktywny
case na inicjatywę — stąd 6 inicjatyw zasianych łącznie, nie 2).

**OKR (org A — pełny, org B — program TYLKO draft):**
Program `f6c45d26-…` (status `active`) → cykl `cbf590dc-…` (Q3 2026, status
`active`, 2 checkin occurrences) → set `f772dd20-…` (status `active`,
`overall_progress=0.58`, `attention_state=watch`) → 2 objectives:
- `f770ff2b-…` — 2 key results, w tym **`73562c7a-…` z `progress=1.3333`
  (133%, PRZEKROCZONY cel, NIEKLAMPOWANY)** — dokładnie ten kształt danych
  (`0–1` string dziesiętny, bez `Math.min(1, …)`) który w tym programie mock
  w skali 0–100 wcześniej zamaskował.
- `f770ff2c-…` — status `at_risk`, jeden key result (`73562c7b-…`) celowo
  BEZ żadnego check-inu — uczciwy stan „—"/nieobliczalne.
1 alignment (`contributes_to`, `accepted`) między obydwoma objectives.
Org B: program `a2056448-…` istnieje w bazie ale ma `status='draft'` i ZERO
cykli/setów — sprawdza, że ekran nie zakłada „program zawsze ma treść".

Pełny surowy JSON z ostatniego seeda (ID + summary) zapisany też przy
uruchomieniu — powtórz `--wipe` żeby odtworzyć identyczny wydruk.

---

## 3. ZADANIE 3 — realny backend i realny frontend

**NIE `dev-render`** — to harness z podstawionym `Api.get`, nie aplikacja.
Tu chodzi o `MainLayout` + `BrowserRouter`, prawdziwe trasy, prawdziwe
uwierzytelnianie przez `/api/auth/login`.

### 3.1 Backend (port 3097)

```bash
cd /Users/piotrwisniewski/rn-g2-lanes/g6-runtime/server
DATABASE_URL=postgresql://postgres@127.0.0.1:55821/rn_g6_runtime \
NODE_ENV=test DB_TYPE=postgres DB_MANAGED_SCHEMA=off PORT=3097 \
MOCK_DB=false RUN_DB_TESTS=1 POSTGRES_SKIP_INIT_IN_TEST=1 ENABLE_TEST_GATEWAY=true \
DISABLE_SCHEDULER=true DISABLE_AI_PROVIDER_SENTINEL=true DISABLE_AI_HEALTH_MONITOR=true \
DISABLE_STARTUP_HEALTH_MONITOR=true SKIP_STARTUP_VALIDATOR=true DEFER_LLM_CONFIG_INIT_MS=3000 \
npx tsx src/index.ts
```

Sprawdź gotowość: `curl http://127.0.0.1:3097/api/ready` → musi zwrócić
`{"status":"ready", "migrations":{"state":"ok", …}}`. Uruchamia się w
~20-40 sekund (Table Platform migrations + template seeding).

**DLACZEGO te dokładnie zmienne (znalezione live, nie z dokumentacji):**

1. **`NODE_ENV=test` + `ENABLE_TEST_GATEWAY=true` razem, nie osobno.**
   `server/src/index.ts` linia ~253: cała ścieżka inicjalizacji bazy
   (`databaseInitPromise`) jest opakowana w
   `!isTest || E2E_MODE==='true' || ENABLE_TEST_GATEWAY==='true'`. Z samym
   `NODE_ENV=test` (bez żadnej z tych dwóch flag) `dbReady` NIGDY nie
   zostaje ustawione — serwer wisi w wiecznym `{"status":"not_ready"}`
   BEZ ŻADNEGO logu błędu (bo cała gałąź kodu jest pomijana, nie rzuca
   wyjątku). To pierwsza, najbardziej myląca pułapka tej sesji — brak logu
   = brak podpowiedzi, gdzie szukać.
2. **`MOCK_DB=false RUN_DB_TESTS=1` razem.** Bez `RUN_DB_TESTS=1`,
   `DatabaseInitializer.ts` traktuje `NODE_ENV=test` jako sygnał do cichego
   mocka (`MOCK_DB enabled; skipping schema initialization/verification`) —
   to jest DOKŁADNIE 13. pułapka z `finance-v3-fala-produktowa-2026-08-12.md`
   w pamięci tej sesji, potwierdzona live drugi raz w innym programie.
3. **`POSTGRES_SKIP_INIT_IN_TEST=1`** pomija wewnętrzny `initDb()` w
   `PostgresDatabase.ts` (plik forbidden do edycji, ale flaga środowiskowa
   to nie edycja) — bez tego próbuje re-inicjalizować schemat, którego
   `migrate.postgres.ts` już dopilnował.
4. **`DB_MANAGED_SCHEMA=off`** — jawnie wyłącza auto-DDL na starcie, zgodne
   z `.env.staging.local.example`'s konwencją „migracje ręcznie, serwer nic
   nie dotyka schematu".

### 3.2 Frontend (port 3197, wskazany na backend z 3.1)

```bash
cd /Users/piotrwisniewski/rn-g2-lanes/g6-runtime
VITE_API_TARGET=http://127.0.0.1:3097 VITE_API_URL= npx vite --port 3197 --strictPort
```

`vite.config.ts` czyta `VITE_API_TARGET` i proxy'uje `/api/*` tam. Pierwsze
skompilowanie każdej nowej trasy (lazy chunk) w dev-mode Vite trwa **5-8
sekund** — ekran bywa PUSTY (`#root` innerHTML pusty) przez ten czas, to NIE
jest błąd, to kompilacja na żądanie. Czekaj na `document.getElementById('root').innerHTML.length > 0`
zanim ocenisz ekran jako zepsuty.

Nie modyfikowano `.claude/launch.json` (plik wspólny między sesjami — patrz
CLAUDE.md) — backend/frontend uruchamiane bezpośrednio przez `npx`/Bash, nie
przez `preview_start` z konfiguracją w launch.json.

---

## 4. Sprzątanie / zatrzymanie

```bash
# Backend i frontend — zabij DOKŁADNIE swój PID, NIGDY pkill -f po wzorcu
# (patrz §7 "Incydent" — pkill -f "tsx src/index.ts" zabił serwery innych
# sesji na tej maszynie).
kill <backend_pid> <frontend_pid>

# Postgres — ZOSTAW URUCHOMIONY (kolejne tory Results Next go użyją):
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"
pg_ctl -D /Users/piotrwisniewski/rn-g6-lanes/pgdata-g6 status   # sprawdź czy żyje

# Gdy naprawdę trzeba zatrzymać Postgres:
pg_ctl -D /Users/piotrwisniewski/rn-g6-lanes/pgdata-g6 stop
```

Katalog danych: `/Users/piotrwisniewski/rn-g6-lanes/pgdata-g6` (poza repo,
trwały między sesjami dopóki nikt go nie skasuje). Port `55821`, gniazdo
`/tmp/rn-g6-sock`, baza `rn_g6_runtime`.

**Stan na koniec tej sesji: Postgres URUCHOMIONY, backend i frontend
ZATRZYMANE** (uruchamiane ad hoc na czas dowodu §6, nie zostawione jako
stałe procesy w tle — restart wg §0/§3 w razie potrzeby).

---

## 5. Logowanie i flagi

**Logowanie** (dwóch użytkowników testowych, NIE dane właściciela):
- `rn-g6-user-a-admin@consultify.local` / `RnG6Runtime!2026` (org A, bogaty zestaw)
- `rn-g6-user-b-admin@consultify.local` / `RnG6Runtime!2026` (org B, izolacja tenantów)

**Flagi domenowe — WYŁĄCZNIE przez parametr adresu**, kolejność
rozstrzygania query → localStorage → env → default `false`
(`resultsVNextFeatureFlags.ts`, niezmienione w tej sesji):
```
http://localhost:3197/results/kpi?ff_resultsVNextKpi=1
http://localhost:3197/results/roi?ff_resultsVNextRoi=1
http://localhost:3197/results/okr?ff_resultsVNextOkr=1
```

---

## 6. ZADANIE 4 — dymny dowód (Playwright, nie dev-render)

Skrypt: `scripts/rn-g6-smoke-screenshot.mjs`. Loguje się jako
`rn-g6-user-a-admin`, otwiera trzy trasy z flagami, zrzuca ekran + raport
konsoli/sieci do `docs/qa/screens/rn-g6-runtime/`.

```bash
cd /Users/piotrwisniewski/rn-g2-lanes/g6-runtime
node scripts/rn-g6-smoke-screenshot.mjs
```

(Zbudowany po tym, jak zrzuty z wbudowanego Browser pane tej sesji okazały
się niewiarygodne — patrz §7 "Fałszywy alarm: czarny zrzut ekranu".)

### Wynik (ten przebieg, zrzuty w `docs/qa/screens/rn-g6-runtime/`):

| trasa | zrzut | wyrenderowało się | błędy konsoli | odpowiedzi ≥400 |
|---|---|---|---|---|
| `/results/kpi?ff_resultsVNextKpi=1` | `kpi.png` | TAK — realny `StandardTable`, 6/6 KPI ze wszystkimi statusami cyklu, liczniki filtrów poprawne (Draft 1, Pending approval 1, Active 2, Suspended 1, Archived 1) | 1 (patrz niżej) | 1 (patrz niżej) |
| `/results/roi?ff_resultsVNextRoi=1` | `roi.png` | TAK — 4/4 case'y ROI, wszystkie 4 fazy widoczne z realnymi polskimi tytułami, statusy Modeling/Approved/Tracking/Post-investment review, kłódki na zamkniętych fazach | 1 (jw.) | 1 (jw.) |
| `/results/okr?ff_resultsVNextOkr=1` | `okr.png` | TAK — 1 OKR set, progress **58%** (poprawnie pomnożony z ułamka `0.58`), confidence Medium, attention Watch | 1 (jw.) | 1 (jw.) |

**Jedyny błąd na wszystkich trzech trasach: `GET /api/v8/admin/flags → 404`.**
Zweryfikowane jako PRZEDISTNIEJĄCE i NIEZWIĄZANE z Results Next — strzela je
jakiś globalny hook layoutu na każdej stronie aplikacji (odtwarzalne też na
`/chat`), nie coś co ten program wprowadził czy powinien naprawiać.

Pełny surowy raport (wszystkie wywołania API per trasa, nie tylko błędy):
`docs/qa/screens/rn-g6-runtime/smoke-report.json`.

**Czego TO NIE dowodzi:** to nie jest odbiór wg 40-punktowej listy
czekowania TRIADA/SPEC-A (menu/kebab/preview/kanban/dark+light) ani test
zapisu (formularze „New KPI"/„New ROI case" nie klikane) — to dowód, że
środowisko stoi i że realne ekrany renderują realne dane z realnego API.

---

## 7. Znaleziska (to jest najcenniejsza część)

### 7.1 BUG realny, nienaprawiony (poza allowlistą) — `/api/auth/me` zawsze
zwraca rolę `USER` dla użytkownika bez wiersza w `organization_members`

**Objaw:** zalogowany jako `ADMIN` (potwierdzone w odpowiedzi
`POST /api/auth/login`), ale `GET /api/auth/me` zwraca `"role":"USER"`.
Efekt kaskadowy: `RouterSync.tsx`'s `isPilotRestrictedRole('USER')===true`
→ KAŻDA nawigacja na `/results/*` (i każdą inną chronioną trasę) jest
natychmiast przekierowywana na `/interview` z logiem
`[RouterSync] Restricted pilot user redirected to /interview from /results/kpi`
— żaden błąd w konsoli, wygląda jak martwa trasa.

**Przyczyna źródłowa** (`server/src/utils/platformRoles.ts`,
`resolveAuthEffectiveRole`):
```ts
return normalizePlatformRole(params.membershipRole) || userRole;
```
Komentarz w kodzie mówi „prefer organization_members.role … fall back to
users.role". Ale `normalizePlatformRole(null)` NIE zwraca `null` — zwraca
STRING `'USER'` (fallback wewnątrz `normalizeApplicationRole`'s ostatniej
linii `return ApplicationRole.USER;` dla nierozpoznanej/pustej wartości).
String `'USER'` jest prawdziwy (`truthy`), więc `|| userRole` NIGDY się nie
wykonuje. Każdy użytkownik BEZ wiersza w `organization_members` dla swojej
aktualnej organizacji jest cicho degradowany do `USER`, niezależnie od
`users.role`.

**Zasięg:** dotyczy każdego usera stworzonego wyłącznie przez
`users.organization_id` bez towarzyszącego wiersza `organization_members`
(prawdopodobnie NIE dotyczy normalnej rejestracji, jeśli ta zawsze wstawia
oba wiersze — niesprawdzone w tej sesji, poza zakresem). Odtworzone
100% powtarzalnie na tym seedzie.

**Co zrobiono:** NIE naprawiono `server/src/` (poza allowlistą tej sesji).
Obejście lokalne: `scripts/rn-g6-seed-runtime-dataset.ts` wstawia teraz
wiersz `organization_members` z `role='ADMIN'` dla obu użytkowników
testowych — patrz commit `4782f16d48` i komentarz w skrypcie. **Zalecenie
dla właściciela:** jednoliniowa poprawka w `platformRoles.ts` —
`normalizePlatformRole(params.membershipRole) || null` (zwróć `null`
zamiast `'USER'`) albo sprawdzaj `params.membershipRole` PRZED normalizacją,
nie po.

### 7.2 Incydent operacyjny — `pkill -f "tsx src/index.ts"` zabił procesy
INNYCH sesji na tej maszynie

Podczas debugowania zawieszonego backendu, ta sesja użyła
`pkill -f "tsx src/index.ts"` żeby posprzątać własny proces. To dopasowało
i zabiło WSZYSTKIE procesy `tsx src/index.ts` na maszynie — w `ps aux`
sprzed tej komendy widoczne były PID-y należące do innej ścieżki roboczej
(`/private/tmp/consultify-artifact-qa-292bafd4/server`) oraz co najmniej
jednej innej równoległej sesji e2e. Nie da się ustalić z tej sesji, czy te
serwery należały do aktywnej pracy innego agenta w danym momencie — jeśli
tak, ich sesje straciły backend bez ostrzeżenia. **Wniosek dla przyszłych
sesji:** nigdy `pkill -f` po wzorcu komendy na współdzielonej maszynie —
zawsze zabijaj precyzyjny, zapisany PID (`kill $(cat backend.pid)`), tak jak
robi to reszta tego dokumentu od §3 w dół.

Osobno (prawdopodobnie powiązane w czasie, przyczyna nieustalona): sam
proces Postgresa tej sesji też się zatrzymał („received smart shutdown
request" w logu) mniej więcej w tym samym momencie — dane przetrwały
(`pg_ctl start` odzyskał bazę z pełną zawartością), ale warto to odnotować:
**zawsze sprawdź `pg_ctl status` przed poleganiem na bazie**, nie zakładaj
że proces wystartowany wcześniej w sesji wciąż żyje.

### 7.3 Fałszywy alarm: „czarny zrzut ekranu" w Browser pane tej sesji

Wbudowany `computer{action:"screenshot"}` w Browser pane tej sesji zwracał
jednolicie czarny/granatowy obraz (800×450, bez treści) dla KILKU kolejnych
prób na różnych trasach i w świeżo otwartej karcie — mimo że
`document.getElementById('root').innerHTML.length` w tym samym momencie
pokazywał tysiące znaków realnego DOM-u, a `get_page_text` zwracał pełną
treść strony. To był problem z samym mechanizmem przechwytywania zrzutu w
tej sesji (albo z timingiem — zbyt szybki zrzut po nawigacji, zanim
pierwszy paint się odbył), NIE z aplikacją. Rozwiązanie: przełączono się na
headless Playwright (`scripts/rn-g6-smoke-screenshot.mjs`, §6) dla
wiarygodnych zrzutów — zgodnie zresztą z literalnym poleceniem zadania
(„Wejdź przeglądarką (Playwright)"). Zanim to ustalono, kilka minut poszło
na fałszywe podejrzenie, że ekrany faktycznie się nie renderują.

### 7.4 Pierwsze skompilowanie trasy w Vite dev bywa mylone z zepsutym ekranem

Przy PIERWSZYM wejściu na każdą z tras `/results/kpi|roi|okr` w danej
instancji `vite`, strona bywa widocznie pusta (`#root` bez treści, czasem
spinner, czasem kompletna cisza) przez 5-8 sekund, zanim duży lazy chunk
(`ResultsKpiRegistryPage` i pokrewne, dziesiątki plików transformowanych na
żywo) się skompiluje. Kolejne wejścia na tę samą trasę są natychmiastowe
(cache modułu). Nie oceniaj ekranu jako zepsutego bez odczekania i
sprawdzenia `document.readyState`/`#root` innerHTML.

---

## 8. Czego to środowisko NIE dowodzi

- Odbioru wg 40-punktowej listy czekowania TRIADA/SPEC-A (menu, kebab,
  preview, kanban, dark+light) — sprawdzono tylko że tabela główna renderuje
  się z prawdziwymi danymi, nic więcej.
- Ścieżki ZAPISU przez API (tworzenie/edycja KPI/ROI/OKR przez UI) — dane
  wstawione bezpośrednio SQL-em, nie przez formularze; przyciski „New KPI"/
  „New ROI case" widoczne na zrzutach, ale nieklikane.
  reguł biznesowych walidacji na zapisie.
- Silnika obliczeniowego ROI (NPV/IRR/payback) — liczby w seedzie dla case'a
  `approved` są ręcznie wpisane jako realistyczne, NIE przeliczone przez
  faktyczny silnik kalkulacji.
- Uprawnień poza `OPEN_ORG` (SCOPE/MANAGEMENT_CHAIN/PRIVATE/RESTRICTED_ACL w
  `rvn_platform_resource_visibility` nieprzetestowane — patrz §7.1's related
  finding, wszystkie zasiane zasoby mają `visibility_mode='OPEN_ORG'`).
- Wydajności ani zachowania pod wieloma równoczesnymi użytkownikami.
- Że rejestracja przez prawdziwy formularz „Create one" tworzy poprawny
  wiersz `organization_members` (obejście z §7.1 zastosowane ręcznie w
  seedzie, nieprzetestowana ścieżka rejestracji).

---

## 9. Czy ruszono coś poza allowlistą

**Nie.** Kod produkcyjny w `src/`/`server/src/` nieedytowany. Zmiany:
- `scripts/rn-g6-seed-runtime-dataset.ts` (nowy — dozwolony)
- `scripts/rn-g6-smoke-screenshot.mjs` (nowy — dozwolony)
- ten dokument (nowy — dozwolony, dokładnie ta ścieżka z zadania)
- `.claude/launch.json` — NIEZMIENIONY (backend/frontend uruchamiane
  bezpośrednio, nie przez launch.json)

Pięć plików równoległej sesji (`PostgresDatabase.ts`, trzy
`*.realdb.test.ts`, `20260810_fix_initiatives_status_default.sql`) —
nietknięte. `dev:staging`/`dev:railway` — nieużyte, cały czas lokalny
Postgres na porcie 55821.
