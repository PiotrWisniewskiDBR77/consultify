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
body: { expectedVersion, clientRequestId, mitigationType, description, ... }
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

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie zweryfikowano jeszcze R2 przez realny HTTP/ApiGateway na Day141; wynik R1 jest na tym etapie pomiarem statycznym.
- Nie zweryfikowano jeszcze pełnego inwentarza R3 żądaniami HTTP.
- Nie zweryfikowano interfejsu przeglądarkowego na runtime 4948/4949.
