# CODEX DAY 143 — Spotkania: pomiar bramy i pełnej ścieżki

Data: 2026-08-30  
Marker: `251ca29e53`  
Gałąź: `codex/day143-spotkania-otwarcie-20260830`  
Werdykt: **PARTIAL — pełna ścieżka utworzenia spotkania działa dla OWNER; brama pozostaje zamknięta dla zwykłych ról; ekran nie jest jeszcze gotowy do pokazania klientowi.**

## Stan wejściowy

Instrukcję odczytano w całości ze scratcha bez gita i sieci. Zgodnie z `§0.1-BIS` pominięto kroki `(1)`, `(3)`, `(4)`, `(5)`, `(6)` i nie wykonano pushu.

```text
$ git merge-base --is-ancestor 251ca29e53 HEAD && echo "BAZA OK" || echo "MARKER BRAK — STOP"
BAZA OK
$ git status --short
[brak wyjścia]
$ git branch --show-current
codex/day143-spotkania-otwarcie-20260830
$ ls -la node_modules
lrwxr-xr-x@ 1 piotrwisniewski wheel 56 Aug 30 09:48 node_modules -> /Users/piotrwisniewski/Developer/Consultify/node_modules
$ df -h /
Filesystem        Size    Used   Avail Capacity iused ifree %iused Mounted on
/dev/disk3s1s1   1.8Ti    12Gi    24Gi    34%    459k  250M    0% /
$ git rev-parse HEAD
251ca29e539b41ee3a143eb0cfa0a5c7c2b78198
```

Porty `6029`, `4952`, `4953` nie miały procesu `LISTEN`; kontener `cx-day143-pg` nie istniał. Uruchomiono `pgvector/pgvector:pg16` wyłącznie jako `127.0.0.1:6029 -> 5432`, baza `cx143`.

Migracje, pełny env w tej samej linii:

```text
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6029/cx143 npx tsx server/scripts/migrate.postgres.ts
...
✅ Postgres migrations complete

# drugi identyczny przebieg
Applying migrations: 0
✅ Postgres migrations complete
```

Logi: `/private/tmp/cx-day143-spotkania-otwarcie-artefakty/migrate-1.log` i `migrate-2.log`.

## Korekty wobec instrukcji

1. Teza liczbowa „~3077 linii serwisów i router ~1348” nie jest wynikiem tego drzewa. Własny pomiar szerokim kryterium instrukcji dał **11 plików i 4522 linie łącznie**. Jest to wynik, nie sprzeczność.
2. `§0.2b (2)` mówi, że trzy dowody Z30 mają być przed czymkolwiek zapisującym, ale dowód `(b)` nakazuje zapytanie do tabeli `settings` „po migracjach”. Wybrałem bezpieczne znaczenie operacyjne: nie uruchomiłem serwera ani drenażu; po migracjach potwierdziłem brak zmiennych poczty i brak rekordów SMTP. Sama kontrola powłoki została wykonana po migracjach, więc kolejność tej jednej kontroli oznaczam jako nieidealną, nie ukrywam jej.
3. `Z34a` nakazuje push po commitach, a `§0.1-BIS` rozstrzyga konflikt: **NIE PUSHUJESZ**. Nie pushowałem.
4. `Z24` odsyła do nieistniejącego `§0.4a`; zgodnie z `§0.1-BIS` martwe odwołanie pominięto.
5. Tabela bramek zawiera zdublowany identyczny wiersz `B8`; potraktowano go jako jeden warunek.

## Z30 — brak wysyłki

```text
$ env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL|ENABLE_LIVE_EMAIL)" || echo "BRAK ZMIENNYCH POCZTY"
BRAK ZMIENNYCH POCZTY
$ docker exec cx-day143-pg psql -U postgres -d cx143 -c "SELECT key, left(coalesce(value,''),8) FROM settings WHERE key LIKE 'smtp%';"
 key | left
-----+-----
(0 rows)
$ grep -n "startNotificationOutboxDrainCron\|outboxWorker\|platformOutboxDrainCron" server/src/Gateway.ts
[0 trafień]
```

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## R1 — pomiar czterowarstwowy

### T1 — backend

```text
$ find server/src -ipath '*meeting*' -name '*.ts' | grep -v __tests__ | wc -l
11
$ find server/src -ipath '*meeting*' -name '*.ts' | grep -v __tests__ | xargs wc -l 2>/dev/null | tail -1
4522 total
```

Główne elementy: `server/src/routes/meeting.routes.ts`, `server/src/services/meetingService.ts`, sześć wyspecjalizowanych serwisów Spotkań oraz trzy integracje/granice AI/legacy. Liczba 4522 obejmuje wszystkie pliki pasujące do literalnego kryterium instrukcji, nie tylko router i serwisy główne.

### T2 — tabela i serwis

```text
CREATE TABLE IF NOT EXISTS meeting_attachments
CREATE TABLE IF NOT EXISTS meeting_decisions
CREATE TABLE IF NOT EXISTS meeting_follow_ups
CREATE TABLE IF NOT EXISTS meeting_invitation_deliveries
CREATE TABLE IF NOT EXISTS meeting_note_materializations
CREATE TABLE IF NOT EXISTS meeting_notes
CREATE TABLE IF NOT EXISTS meeting_participants
CREATE TABLE IF NOT EXISTS meetings
```

Wynik: **8 unikalnych tabel**. `meetingService.ts` realizuje listę, odczyt, utworzenie, aktualizację, status i usunięcie; serwisy domenowe obsługują uczestników, zaproszenia, załączniki, wystąpienia cykliczne, notatki i funnel zadań.

### T3 — brama

- `src/utils/betaMenuStatus.ts:57`: `MODULE_MEETING: 'closed'`.
- `src/components/navigation/Sidebar/menuConfig.ts:176-180`: pozycja menu istnieje i ma `AppView.MEETING` oraz badge `beta`.
- `src/routes/AppRoutes.tsx:2617-2734`: `BetaGate moduleId="MODULE_MEETING"` otacza listę, kartę obiektu, protokół, decyzje i deep link notatki — brama zamyka **całą kanoniczną powierzchnię UI**, nie pojedynczą operację.
- `server/src/routes/meeting.routes.ts:300-306`: backend ma własny `closedBetaModuleGate` po `verifyToken` i `isAuthenticated`.
- `server/src/middleware/betaGate.middleware.ts:40-49`: `OWNER`, `ADMIN`, `ADMINISTRATOR`, `SUPERADMIN` są zwolnieni; zwykłe role dostają `403 {code: BETA_LOCKED}`.

Brama nie została zmieniona.

### T4 — komponent, wołacz, render

Łańcuch: `menuConfig.ts MODULE_MEETING` → `AppView.MEETING` → `routeConfig.ts` mapuje na `/meetings` → `AppRoutes.tsx` → `BetaGate` → `MeetingHub`. Alias `/meeting` przekierowuje na `/meetings`; `/meetings/:meetingId` i podtrasy renderują `MeetingObjectPage`.

Realny konsument istnieje: `MeetingHub.tsx` wywołuje `Api.getMeetings`, `createMeeting`, `updateMeeting`, `deleteMeeting`, `updateMeetingStatus` i API notatek. `src/services/api.ts` mapuje je na `/api/meeting...`.

Po otwarciu bramy zwykły użytkownik zobaczyłby listę/tabelę i kalendarz Spotkań, filtry lifecycle, utworzenie spotkania, kartę obiektu z sekcjami Szczegóły/Protokół/Decyzje oraz uczciwy pusty stan „No meetings yet”. Błędy listy przechodzą do `ErrorState` z retry.

Co nadal nie jest gotowe: karta obiektu pokazuje „Edytuj spotkanie — Już wkrótce”, „Generuj notatki AI — Już wkrótce” i „Usuń spotkanie — Już wkrótce”; harness zgłasza błąd konsoli OrgContext. Dostęp zwykłych ról do API pozostaje `BETA_LOCKED`. Nie wykonano klientowego runtime po otwarciu bramy, bo otwarcie jest zabronione.

## R2 — pełna ścieżka realnego HTTP

Dodano `server/src/routes/__tests__/meeting.day143.fullPath.pg.test.ts`. Test:

1. sprawdza `DB_TYPE === 'postgres'` i woła `assertRealPostgresTestEnvironment()` bez argumentów;
2. tworzy lokalny, jednoznacznie nazwany tenant/użytkownika/członkostwo OWNER;
3. montuje `ApiGateway.getInstance().initializeRoutes(app)`;
4. podpisuje JWT `HS256` tym samym `JWT_SECRET`;
5. wykonuje `POST /api/meeting`;
6. sprawdza `HTTP 201`, brak `BETA_LOCKED`, a następnie `SELECT` tego samego `id` i tenantu.

Komenda (z katalogu `server/`) użyła configu poza repo, dziedziczącego resolver `server/vitest.config.ts` i usuwającego przypięcie `DB_TYPE='sqlite'`:

```text
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6029/cx143 JWT_SECRET=cx143-test-secret-do-not-reuse-32-chars npx vitest run src/routes/__tests__/meeting.day143.fullPath.pg.test.ts --config /private/tmp/cx-day143-spotkania-otwarcie-scratch/vitest.day143.server.config.ts --retry=0 --reporter=verbose --reporter=json --outputFile=/private/tmp/cx-day143-spotkania-otwarcie-artefakty/day143-full-path-after.json
```

```text
DAY143_HTTP status=201 bytes=756
DAY143_DB id=meeting-68a7933f-64f8-4fa0-8c56-bfa1c6efb534 organization_id=day143-meeting-org title=Day 143 full path 1788076843465
Test Files  1 passed (1)
Tests       1 passed (1)
```

Niezależny readback:

```text
meeting-68a7933f-64f8-4fa0-8c56-bfa1c6efb534 | day143-meeting-org | day143-meeting-owner | Day 143 full path 1788076843465 | 2026-09-03T08:00:00.000Z | 2026-09-03T09:00:00.000Z
(1 row)
```

### Pułapki (a)–(e)

- (a) wyłączona przez `ENABLE_V8_GLOBAL=true` w tej samej linii; trasa odpowiedziała `201`, nie przedwczesnym `404`.
- (b) ustawiono `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`; strażnik Results nie jest częścią trasy Meeting, ale wartość jest jawna.
- (c) zewnętrzny config usuwa `test.env.DB_TYPE`; pierwsza asercja testu wymaga `postgres`, log zawiera `DB_IDENTITY ... 127.0.0.1:6029/cx143`.
- (d) `ENABLE_TEST_AUTH_BYPASS=false`; żądanie używa podpisanego JWT i przechodzi przez realny `verifyToken` w routerze.
- (e) test dowodzi egzekucji, nie istnienia plików: `201` + 756 bajtów + wiersz w bazie + istniejący konsument `MeetingHub`/`Api.createMeeting`.

### W-A i W-C

Nie było pozycji naprawczej w kodzie produkcyjnym, więc mutacyjne czerwony/zielony W-A nie ma zastosowania. Pierwszy uruchomiony wariant testu był czerwony (`HTTP 403`, 1 failed) z powodu braku fixture członkostwa; po dodaniu jawnie należącego do testu tenantu/użytkownika/członkostwa ten sam przypadek ma `HTTP 201`, 1 passed. Nie nazywam tego dowodem mutacyjnym produktu.

Ścisły W-C „ta sama komenda na markerze i po zmianie” **nie został dowiedziony**: plik testu nie istnieje na markerze, a pierwszy i końcowy przebieg różniły się reporterem i długością testowego sekretu. Nie przedstawiam tej pary jako spełnionej bramki B7. Stan: `EVIDENCE_MISSING` dla W-C, mimo że końcowy pakiet ma jednoznaczny pełny `fullName` i wynik PASS.

## R3 — decyzja właściciela

Role zwykłe (`MEMBER`, `USER`, `GUEST` i każda rola poza listą zwolnień) są blokowane zarówno na całej powierzchni UI, jak i na API. Role `OWNER`, `ADMIN`, `ADMINISTRATOR`, `SUPERADMIN` przechodzą bramę, ale dalsze operacje mają własne uprawnienia Meeting.

Rekomendacja: **nie otwierać jeszcze bramy klientom**. Najpierw właściciel powinien ocenić zrzuty, zdecydować czy wyłączone akcje karty obiektu są akceptowalne oraz zlecić usunięcie błędu OrgContext w harnessie/środowisku. Dopiero potem osobna, jawnie licencjonowana zmiana `betaAccess` z testem ról i realnym runtime.

## R4 — harness i zrzuty

Marker już zawierał `dev-render/screens/meetings-module.tsx` oraz rejestrację `?screen=meetings-module` w `dev-render/main.tsx`. Harness montuje realne `MeetingHub` i `MeetingObjectPage`, mockuje `Api`, nie wymaga logowania ani żywej bazy. Nie było potrzeby zmiany R4.

Uruchomiono tylko Vite na `127.0.0.1:4952`; `server/src/index.ts` nie był uruchamiany. Zrzuty:

- `/private/tmp/cx-day143-spotkania-otwarcie-artefakty/meetings-list.png` — `b793ad85280371c9b6c232507cf0ce6af2f86afb26f2f518f4e442cddd515d54`
- `/private/tmp/cx-day143-spotkania-otwarcie-artefakty/meetings-object.png` — `b4da1b81c0290742f802bd9c1a1f592c6463e3cceb3cf86096cb54feaccbbd18`

Oba zrzuty są czytelne. W obu przebiegach konsola zgłosiła:

```text
[OrgContext] Error fetching orgs: SyntaxError: Unexpected token '<', "<!doctype "... is not valid JSON
```

To nazwany brak do pokazania klientowi, nie ukryty warning.

## Artefakty

- `day143-full-path-after.json` — `686c83e35fe3fac6b8a3d32ada8b1ab801a07e225ff0880f29edfb0b44345f2d`
- `day143-full-path-after.log` — `587d0e6c21fc469ae7afc9084ff8ead05fd347f1c566824f1a774b32801b3552`
- `day143-select-readback.log` — `5c54b8a4a4619c55d76dede0f732caa8e263d4cb29c288c14a1729f7c90304e8`
- `entry-measurements.log` — `59fa7d4b43d105e04eec86137738289647b52413f800198bbd60e7deaac0f593`
- `migrate-1.log` — `fe6c5e6d5d41ef8ed7915f066473880c3009b8c1ca8f1a99f112e83215f8472f`
- `migrate-2.log` — `990a33d70bed23b104c7c17b1188e2829669dd6a1f05e3129fe603f94a4b3ac5`

## W-D — granica zmian

```text
$ git diff --name-only 251ca29e53..HEAD
docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY143_SPOTKANIA_OTWARCIE_REPORT.md
server/src/routes/__tests__/meeting.day143.fullPath.pg.test.ts
```

Oba pliki są w tabeli licencji. Zero zmian w `betaAccess*`, migracjach, flagach, konfiguracjach globalnych i plikach dyżurów 140–142.

## TWIERDZENIA NIEZWERYFIKOWANE

1. Nie zweryfikowano zachowania zwykłej roli po faktycznym otwarciu bramy; otwarcie było zakazane.
2. Nie zweryfikowano pełnego produktu przez `server/src/index.ts`; R2 używa wymaganego realnego `ApiGateway`, a R4 Vite-only.
3. Nie zweryfikowano wszystkich operacji routera Meeting; R2 dowodzi wyłącznie utworzenia spotkania i readbacku.
4. Nie zweryfikowano wysyłki zaproszeń ani powiadomień; celowo jej nie uruchamiano z powodu Z30.
5. Nie zweryfikowano generowania notatek przez model językowy; Z15 zabraniało użycia modelu.
6. Nie spełniono ścisłego pomiaru różnicowego W-C na markerze i po zmianie; B7 pozostaje `EVIDENCE_MISSING`.
7. Zrzuty nie są akceptacją właściciela; są materiałem do decyzji.
