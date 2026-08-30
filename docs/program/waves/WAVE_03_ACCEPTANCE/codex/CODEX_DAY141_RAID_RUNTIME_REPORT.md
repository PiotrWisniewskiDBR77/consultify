# CODEX DAY 141 — RAID przez kanoniczny runtime

Data: 2026-08-30  
Gałąź: `codex/day141-raid-runtime-20260830`  
Marker: `251ca29e53`

## Stan wejściowy

### §0.1-BIS

```text
$ git merge-base --is-ancestor 251ca29e53 HEAD && echo "BAZA OK" || echo "MARKER BRAK — STOP"
BAZA OK
$ git status --short
[brak wyjścia]
$ git branch --show-current
codex/day141-raid-runtime-20260830
$ ls -la node_modules
lrwxr-xr-x@ 1 piotrwisniewski wheel 56 Aug 30 09:47 node_modules -> /Users/piotrwisniewski/Developer/Consultify/node_modules
$ df -h /
Filesystem        Size    Used   Avail Capacity iused ifree %iused  Mounted on
/dev/disk3s1s1   1.8Ti    12Gi    24Gi    34%    459k  250M    0%   /
```

Kontrola zasobów `docker ps` i `lsof` dla `cx-day141-pg`, `6027`, `4948`, `4949`: brak wyjścia, wszystkie zasoby były wolne.

### T1–T4

```text
$ grep -nE "RaidSection|case 'raid'|raid" src/components/Initiatives/InitiativeDocumentView.tsx | head -10
322:  'risk-raid': 'raid',
363:  'risk-raid': { ai: true }, // RAID Log
545:  const [raidItems, setRaidItems] = useState<RaidItem[]>([]);
858:  const [raidAiRequest, setRaidAiRequest] = useState<{ nonce: number } | null>(null);
873:  const [raidAiNoSuggestionsMessage, setRaidAiNoSuggestionsMessage] = useState<string | null>(null);
874:  const [raidAiProposal, setRaidAiProposal] = useState<{
882:    remove: Array<{ raidId: string; reason: string }>;
884:  const [raidAiSelectedAddIdx, setRaidAiSelectedAddIdx] = useState<Record<number, boolean>>({});
885:  const [raidAiSelectedRemoveIds, setRaidAiSelectedRemoveIds] = useState<Record<string, boolean>>(
1073:    const candidates: Array<{ raidId: string; title: string; type: string; why: string }> = [];

$ grep -nE "'/:id/raid'|raid_items" server/src/routes/pmo/initiatives.routes.ts | head -8
1950:            `INSERT INTO raid_items (id, initiative_id, organization_id, type, title, description, severity, status, created_at, updated_at)
2723:        `SELECT severity FROM raid_items WHERE initiative_id = ? AND organization_id = ? AND status != 'RESOLVED'`,
3697:router.get('/:id/raid', InitiativeController.getRaid);
3699:  '/:id/raid',

$ grep -rn "EXECUTION_RUNTIME_V1_WRITE_REQUIRED" server/src --include='*.ts' | grep -v __tests__ | head -6
server/src/middleware/executionSpineLegacyReadOnly.middleware.ts:3:export const EXECUTION_SPINE_LEGACY_READ_ONLY_CODE = 'EXECUTION_RUNTIME_V1_WRITE_REQUIRED' as const;
server/src/routes/pmo/initiativesExecutionRuntime.routes.ts:2201:            legacyDenialCode: 'EXECUTION_RUNTIME_V1_WRITE_REQUIRED',
server/src/routes/pmo/initiativesExecutionRuntime.routes.ts:2210:            legacyDenialCode: 'EXECUTION_RUNTIME_V1_WRITE_REQUIRED',
server/src/routes/pmo/initiativesExecutionRuntime.routes.ts:2219:            legacyDenialCode: 'EXECUTION_RUNTIME_V1_WRITE_REQUIRED',
server/src/routes/pmo/initiativesExecutionRuntime.routes.ts:2228:            legacyDenialCode: 'EXECUTION_RUNTIME_V1_WRITE_REQUIRED',
server/src/routes/pmo/initiativesExecutionRuntime.routes.ts:2237:            legacyDenialCode: 'EXECUTION_RUNTIME_V1_WRITE_REQUIRED',

$ grep -rn "runtime-v1\|runtimeV1" src/components/Initiatives/ --include='*.tsx' | head -8
src/components/Initiatives/InitiativesHub.tsx:931:            await Api.get(`/initiatives/runtime-v1/initiatives/${encodeURIComponent(openId)}`);
src/components/Initiatives/InitiativesHub.tsx:1385:      const response = await fetch('/api/initiatives/runtime-v1/adoptions/accepted-classic', {
src/components/Initiatives/__tests__/InitiativesHub.smoke.test.tsx:187:    expect(url).toBe('/api/initiatives/runtime-v1/adoptions/accepted-classic');
src/components/Initiatives/__tests__/InitiativesHub.smoke.test.tsx:312:  it('opens a runtime-v1 registered deep link in the canonical card', async () => {
src/components/Initiatives/__tests__/InitiativesHub.smoke.test.tsx:322:  it('fails closed when the runtime-v1 registration read fails unexpectedly', async () => {
src/components/Initiatives/__tests__/InitiativesHub.smoke.test.tsx:327:      expect(apiGet).toHaveBeenCalledWith('/initiatives/runtime-v1/initiatives/broken-1')
```

Twardy klucz renderu T1 jest dalej w tym samym pliku: `case 'risk-raid'` w okolicy linii 7678 pobiera `SECTION_REGISTRY['raid']` i montuje komponent dla sekcji z kluczem `raid`. Handler tworzenia w okolicy linii 3607 nadal woła legacy `POST /initiatives/:initiativeId/raid`.

## Korekty wobec instrukcji

1. T4: wzorzec `POST /api/initiatives/runtime-v1/...` istnieje, lecz jedyne trafienie produkcyjne w `src/components/Initiatives/` jest w imiennie nietykalnym `InitiativesHub.tsx`; nie ma wzorca wołacza Runtime-v1 RAID w licencjonowanych plikach.
2. Bramka odbioru `B8` występuje w tabeli dwukrotnie; traktuję ją jako jeden warunek.
3. §0.1-BIS rozstrzyga konflikt Z34a z zakazem pushu: nie pushuję. Martwe odwołanie Z24 do nieistniejącego §0.4a pomijam.
4. Instrukcja twierdzi, że zapis RAID ma skopiować istniejący wzorzec. Pomiar kodu wykazał wyłącznie kanoniczny zapis **mitygacji istniejącego RAID**, a nie utworzenie/usunięcie elementu RAID. To wynik pomiaru, nie interpretacja.

## R1 — warunek bramy i istniejący kontrakt

`server/src/routes/pmo/initiatives.routes.ts` montuje `/runtime-v1` przed `requireCanonicalInitiativeExecutionWriter`. Każdy zapis legacy pasujący m.in. do `/:id/raid` jest odrzucany kodem 409. Warunek przejścia bramy jest więc strukturalny: polecenie musi wejść przez router `/api/initiatives/runtime-v1`, z uwierzytelnionym aktorem i zdolnością projektową, a następnie użyć kanonicznego command service z polami `expectedVersion`, `clientRequestId`, wersją polityki i typem polecenia.

Istniejący kontrakt RAID ma dokładnie postać:

```text
POST /api/initiatives/runtime-v1/initiatives/:initiativeId/raid-mitigations/:raidItemId
body: { expectedVersion, clientRequestId, mitigationPlan, responseStrategy,
        mitigationOwnerId, mitigationDueDate, mitigationStatus }
commandType: raid-mitigation.record
aggregateType: raid_mitigation
aggregateId: raidItemId
createIfMissing: true
```

Ten kontrakt zapisuje agregat `raid_mitigation`; wymaga już istniejącego `raidItemId`. Nie tworzy i nie usuwa wiersza `raid_items`. W routerze Runtime-v1 nie istnieje `raid-items` ani równoważny command do CRUD rejestru.

## Protokół Z30

```text
$ env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL|ENABLE_LIVE_EMAIL)" || echo "BRAK ZMIENNYCH POCZTY"
BRAK ZMIENNYCH POCZTY
$ grep -n "startNotificationOutboxDrainCron\|outboxWorker\|platformOutboxDrainCron" server/src/Gateway.ts
[brak wyjścia]
$ docker exec cx-day141-pg psql -U postgres -d cx141 -c "SELECT key, left(coalesce(value,''),8) FROM settings WHERE key LIKE 'smtp%';"
 key | left
-----+------
(0 rows)
```

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## Migracje

- `/private/tmp/cx-day141-raid-runtime-artefakty/migrate-first.log` — SHA-256 `fe6c5e6d5d41ef8ed7915f066473880c3009b8c1ca8f1a99f112e83215f8472f`; pełny przebieg zakończony `Postgres migrations complete`.
- `/private/tmp/cx-day141-raid-runtime-artefakty/migrate-second.log` — SHA-256 `990a33d70bed23b104c7c17b1188e2829669dd6a1f05e3129fe603f94a4b3ac5`; `Applying migrations: 0`, zakończony poprawnie.

## R2 — STOP MERYTORYCZNY

### STOP — R2

Rodzaj: MERYTORYCZNY

Powód: kanoniczny Runtime-v1 udostępnia zapis mitygacji istniejącego elementu RAID, ale nie udostępnia polecenia tworzenia/usuwania `raid_items`; proponowana ścieżka CRUD zwraca 404.

Licencja, którą sprawdziłem: `src/components/Initiatives/InitiativeDocumentView.tsx | zapis wąski | wyłącznie R2 — wołacz RAID przez ścieżkę runtime`; `server/src/routes/pmo/initiatives.routes.ts | odczyt`; `miejsce wymuszające 409 | ODCZYT — zakaz zapisu`. Wynik: nie istnieje osiągalny endpoint, do którego wolno podpiąć wołacz.

Dowód: `server/src/routes/pmo/initiativesExecutionRuntime.routes.ts` ma tylko `/raid-mitigations/:raidItemId`; realny `POST /api/initiatives/runtime-v1/initiatives/:initiativeId/raid-items/:raidItemId` przez `ApiGateway` zwrócił `404`, a `SELECT` w `raid_items` zwrócił 0 wierszy.

Co dostarczyłem ZAMIAST zmiany: czerwony kontrakt `server/src/routes/pmo/__tests__/day141.raid-runtime-contract.pg.test.ts` z oczekiwanym `POST → SELECT → DELETE → SELECT`, reprodukcję legacy 409 z readbackiem bez zmian oraz brief komendy.

Co zrobiłbym, gdyby zapadła decyzja X: licencjonowany kolejny dyżur powinien dodać command service i trasę Runtime-v1 dla `raid-item.create` oraz `raid-item.delete`, z CAS, idempotencją, audytem, tenant scope i readbackiem. Dopiero potem wołacze `handleCreateRaid`, `handleDeleteRaid` i ścieżkę propozycji AI można przepiąć na ten kontrakt.

Rekomendacja dla nadzorcy: rozszerzyć licencję o `initiativesExecutionRuntime.routes.ts`, właściwy command service/repository i testy; nie dodawać wyjątku do bramy i nie kierować UI do `raid-mitigation.record`.

Stan: R1 zacommitowano w `3a0ec5b1f4`; czerwony kontrakt, STOP R2 i pomiar R3 zacommitowano w `70b9a4bae6`.
Czy kontynuowałem pozostałe pozycje: TAK — R3 jest pomiarowe i nie wymaga zmiany bramy.

Nie zmieniono `InitiativeDocumentView.tsx` ani `RaidSection.tsx`: przepięcie do mitygacji byłoby semantycznie błędne, a pozostawienie optymistycznego UI przy 404/409 byłoby atrapą.

## R3 — inne powierzchnie karty trafiające na tę samą bramę

Realne żądania HTTP przez `ApiGateway`, podpisany JWT i pełne middleware potwierdziły kod `409 EXECUTION_RUNTIME_V1_WRITE_REQUIRED` dla:

```text
POST /api/initiatives/:id/milestones
POST /api/initiatives/:id/resources
POST /api/initiatives/:id/staffing-plans
POST /api/initiatives/:id/budget-items
PUT  /api/initiatives/:id/gate-roles
POST /api/initiatives/:id/start-execution
POST /api/initiatives/:id/block
POST /api/initiatives/:id/move
POST /api/initiatives/:id/apply-template
POST /api/initiatives/:id/apply-blueprint
```

Nie naprawiano żadnej z tych powierzchni.

## Pary przebiegów W-A i pomiar W-C

### Nieważna próba odziedziczonego pakietu Day136

Pakiet `initiativeSections.day136.pg.test.ts` przypina regex `6020/cx136`. Na współrzędnych Day141 reporter wykazał 4 `skipped`, 0 `passed`, więc wynik nie jest dowodem. Artefakt: `/private/tmp/cx-day141-raid-runtime-artefakty/day141-day136-baseline.json`, SHA-256 `d9d4453f391adff07efbb2706d4c54121c59deefe47dd26e9eadf4b2407403c7`.

### Przebieg czerwony — wymagany kontrakt przed naprawą

Komenda została uruchomiona z `server/`, z configiem poza repo, bez przypięcia `DB_TYPE=sqlite`:

```text
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6027/cx141 \
JWT_SECRET=cx141-test-secret-do-not-reuse \
../node_modules/.bin/vitest run src/routes/pmo/__tests__/day141.raid-runtime-contract.pg.test.ts \
  --config /private/tmp/cx-day141-raid-runtime-scratch/vitest.day141.config.ts \
  --retry=0 --reporter=json \
  --outputFile=/private/tmp/cx-day141-raid-runtime-artefakty/day141-red-contract.json
```

Wynik po pełnych nazwach:

```text
PASS ... binds the proof package to explicitly requested real PostgreSQL
PASS ... proves the current legacy RAID POST returns 409 and leaves raid_items unchanged
PASS ... inventories other Initiative-card legacy mutations stopped by the same 409 gate
FAIL ... requires a canonical RAID-item create/read/delete command before the UI can be rewired
AssertionError: expected 404 to be 201
```

Artefakt: `/private/tmp/cx-day141-raid-runtime-artefakty/day141-red-contract.json`, SHA-256 `a89092dc0e8b5c8d36dbb70d7b27cd16f8d5d31c78adf403d749989171d72e8f`. Bezpośredni readback po przebiegu:

```text
SELECT id,initiative_id,title FROM raid_items WHERE organization_id LIKE 'day141-org-%';
(0 rows)
```

Po formatowaniu testu powtórzono pełną komendę: identyczne 3 PASS / 1 FAIL po tych samych pełnych nazwach, nadal `404` zamiast `201`. Artefakt końcowy: `/private/tmp/cx-day141-raid-runtime-artefakty/day141-red-contract-final.json`, SHA-256 `fb6c2942b28563eef94effde67170274549bcc095c00c95eb74998bccc941360`.

### Zielony pomiar stanu istniejącego

Ta sama komenda z `--testNamePattern='binds|proves|inventories'` dała 3 PASS, 0 FAIL i 1 jawny SKIP czerwonego wymagania. Artefakt: `/private/tmp/cx-day141-raid-runtime-artefakty/day141-measurement-green.json`, SHA-256 `3779dcdd257c3ab01112364d3e2ffa595e73bed1604c26e6d8b7081d889d5bde`.

Nie ma pary czerwony→zielony W-A dla R2 i nie ma porównania marker→naprawa W-C, ponieważ naprawa wymaga plików poza licencją. Nie wpisuję `FIXED`, `VERIFIED` ani `ZROBIONE_WG_DoD`. Czerwony kontrakt pozostaje briefem egzekwowalnym dla licencjonowanego dyżuru serwerowego.

## Pułapki (a)–(e) dla pakietu Day141

- (a) wyłączona przez `ENABLE_V8_GLOBAL=true` w tej samej linii; pierwszy test asertuje wartość.
- (b) `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce` ustawione w tej samej linii, choć badana ścieżka Initiative nie używa tego strażnika.
- (c) zewnętrzny config `/private/tmp/cx-day141-raid-runtime-scratch/vitest.day141.config.ts` nie ma `test.env.DB_TYPE`; pierwszy test potwierdził `postgres`.
- (d) `ENABLE_TEST_AUTH_BYPASS=false` w tej samej linii i asercja w pierwszym teście; żądania używały podpisanego JWT.
- (e) osiągalność konsumenta statycznie potwierdza `case 'risk-raid'` → `SECTION_REGISTRY['raid']`; realna ścieżka zapisu z tego widoku nadal jest legacy i jej 409 potwierdził pakiet przez produkcyjny `ApiGateway`.

Pakiet używa `assertRealPostgresTestEnvironment()` bez argumentów, `--retry=0`, pełnych env w tej samej linii i sprząta wyłącznie własne rekordy.

## W-D — granica rozłączności i stan końcowy

```text
$ git merge-base --is-ancestor 251ca29e53 HEAD && echo "BAZA OK" || echo "MARKER BRAK — STOP"
BAZA OK
$ git log --oneline 251ca29e53..HEAD
70b9a4bae6 test(day141): expose missing canonical RAID item writer
3a0ec5b1f4 docs(day141): record RAID runtime gate contract
$ git diff --name-only 251ca29e53..HEAD
docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY141_RAID_RUNTIME_REPORT.md
server/src/routes/pmo/__tests__/day141.raid-runtime-contract.pg.test.ts
$ git status --short
[brak wyjścia]
$ docker exec cx-day141-pg psql -U postgres -d cx141 -c "SELECT count(*) AS raid_rows FROM raid_items;"
 raid_rows
-----------
         0
(1 row)
```

Każdy plik jest w tabeli licencji. Nie zmieniono `MyWork/**`, `Benefits/**`, `Meeting/**`, migracji, flag, wyglądu, bramy ani infrastruktury testowej. Nie wykonano pushu.

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie zweryfikowano udanego R2, ponieważ kanoniczny command CRUD `raid_items` nie istnieje, a zmiana serwera/bramy jest poza licencją.
- Nie zweryfikowano interfejsu przeglądarkowego na runtime 4948/4949; przy STOP R2 nie uruchamiano pary runtime ani nie wykonywano atrapowego zrzutu.
- Nie udowodniono kształtu odpowiedzi przyszłego commandu CRUD; czerwony kontrakt proponuje minimalny kształt do decyzji właściciela/nadzorcy.
