# CODEX DAY 180 — limity planów agenta

Data: 2026-08-30. Marker `18661cc6a0`. Gałąź `codex/day180-agent-limity-20260830`.

## Werdykt

- R1 **ZROBIONE / RealPG + RealRedis**: plan bez `canonicalRunId` używa rezerwacji; odmowa kosztowa jest w kroku i rezerwacji, a `create_task` nie tworzy rekordu.
- R2 **ZROBIONE / RealPG + RealRedis**: anulowanie długiego kroku zwraca `cancelled`, receipt kończy `SUCCEEDED` w pierwszym podejściu, aktywna dzierżawa jest wyczyszczona.
- R3 **ZROBIONE tylko monitoringowo**: warn dla sukcesu i porażki ponad próg, brak warn poniżej. To nie jest timeout/F6.
- `ENABLE_AI_TASKS_WORKER` nie zmieniono w repo; było `true` wyłącznie w powłoce testów.

## Wejście

Marker i sanity, dosłownie:

```text
MARKER OK
18661cc6a007769dd419060ff3089860f1163afc
```

Status był pusty. Dysk: `9.8Gi`. Porty 6089, 5030, 5031, 6408 były wolne. Powstały tylko `cx-day180-pg` (`pgvector/pgvector:pg16`) i `cx-day180-redis`. Migracje: pierwszy przebieg kompletny, drugi `Applying migrations: 0`. Tip bazowy uciekł do `2ec857243a`; zgodnie z DEC-2026-08-26-95 pozostałem na markerze, bez rebase.

## R1

Wybrano wariant B: `projectId=agent-plan-chat:v1` na organizację, `runId=plan.id`, idempotencja `planner-chat:<planId>:<operationKey>` rozłączna od `planner:<canonicalRunId>:...`. Wszystkie plany czatowe organizacji dzielą concurrency: cztery aktywne rezerwacje wyczerpują domyślny limit, piąta jest odrzucona. Koszt jest per plan. Leniwy INSERT może dodać najwyżej 1 politykę na organizację dla tego zakresu.

Odrzucono A: `conversation_id` nie ma FK, a `conversations.project_id` jest nullable. Odrzucono C: tworzyłby politykę per plan. `executeGovernedEnqueue` pozostawiono bez zmian: dotyczy enqueue, ma koszt 0, a `agent_plan.enqueue` nie istnieje w zamkniętym cenniku. Wybrano fail-closed: bez Postgresa narzędzie nie rusza; nie dodano flagi fail-open.

## R2

Pomiar zastany skorygował T6: pierwszy attempt jest `FAILED` z `Execution lease lost` i zostawia dzierżawę, lecz BullMQ (`attempts: 3`) ponawia; drugi attempt widzi `cancelled`, więc finalny receipt jest `SUCCEEDED`, `attempt_count=2`, nadal z przeciekiem.

Naprawa po utracie lease odczytuje status; dla `cancelled` czyści tylko przy zgodnym owner+fencing, bez wymagania niewygasłej daty. Obsługuje też krok >300 s, ale nie czyści cudzej dzierżawy. Nie zmieniono `renewExecutionLease`, `aiWorker` ani stanów receipt. `execution_fencing_token` pozostaje monotoniczny; czyszczone są owner, expiry i heartbeat, zgodnie z istniejącym FIX-174.

## R3 i env

- `AGENT_PLAN_HEARTBEAT_INTERVAL_MS`, default `60000`; test `10`.
- `AGENT_PLAN_LONG_STEP_WARNING_MS`, default `120000`; test `50`.

Relacja: `60 s heartbeat < 120 s warning < 300 s lease`. Log: `planId`, `stepIndex`, `toolName`, `durationMs`, `thresholdMs`. Nie przerywa i nie zmienia statusu.

## Dowody

- `day180-r1-green-final.json`: 1 total, 1 pass, 0 fail, 0 pending.
- `day180-r2-r3-green-final.json`: 2 total, 2 pass, 0 fail, 0 pending.
- `day180-r1-mutation-red.json`: 1 fail po przywróceniu ucieczki (`completed` zamiast odmowy).
- `day180-r2-mutation-red.json`: 1 fail z `AgentExecutionLeaseLostError` po usunięciu obsługi okna.
- `day180-r3-mutation-red.json`: 1 fail, 0 warn zamiast 2 po mutacji progu.
- `day180-final-related.json`: **PARTIAL / NIE-DOWÓD**, 13 total, 9 pass, 4 fail; równoległe pakiety kasowały wspólną kolejkę (3 timeouty), a DAY165 miał niezależne 401.

Artefakty leżą w `/private/tmp/cx-day180-agent-limity-artefakty/`. SHA-256: R1 green `b605414e6c8e5980b2ea32f3fe1ae364adfe424074d0ba05d481c064cacacbb4`; R2/R3 green `82cd69f0ede6f75dbe648b56881d72bc7152bbc6596ee6a660efb999099a9f38`; R1 red `edf85fb58f5a181e8cdb515393c3c8fa946b742a91d3e0d8f678e6b7caa72a0b`; R2 red `cb94e137a8c504022aa992d60e4d8e3d555269e1d01dea4184b62ba0d900c1dd`; R3 red `aa4ff568ebc20ff42818079fd71346ec71ac10d89fdef6a9470f8e66182ac56e`; broad partial `151e273a0da6424a06b299ec6fee5cc262c399639a88021562aa95d66922ab95`.

W zielonych dowodach: `--retry=0`, brak skipped; jawne asercje PG/Redis/worker. Komplet env zawierał `DB_TYPE=postgres`, `MOCK_DB=false`, `MOCK_REDIS=false`, `ENABLE_V8_GLOBAL=true`, `ENABLE_TEST_AUTH_BYPASS=false`, `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`. Host/port/nazwa bazy tylko w powłoce, nie w testach.

## Z30

`BRAK ZMIENNYCH POCZTY`; `settings WHERE key LIKE 'smtp%'` = 0 rows; grep drenaży w `Gateway.ts` = 0 trafień.

„Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.”

## Korekty wobec instrukcji

1. Ucieczka jest ok. 1063–1071, nie 1052–1058.
2. T6: końcowy receipt nie pozostaje FAILED; retry maskuje pierwszy FAILED, ale nie sprząta lease.
3. „Trzy kolumny” rozstrzygnięto jako aktywne owner/expiry/heartbeat; fencing pozostaje monotoniczny.
4. Wydany plik odwołuje się do §0.4a/BLOKU 0 bez odrębnych sekcji; wykonano konkretne pomiary Z7/Z24 i pełne nazwy z JSON.

## TWIERDZENIA NIEZWERYFIKOWANE

- `conversation_id`: **NOT_PROVEN** jako FK. FK brak; `conversations.id` jest text, `ai_conversations.id` integer; lokalnie 0 planów z niepustym polem.
- Kolizja `agent-plan-chat:v1` z `projects.id`: teraz 0, ale **NOT_PROVEN strukturalnie**, bo ID jest dowolnym TEXT. Wymaga kontraktu namespace właściciela.
- SQLite: fail-closed wynika z kodu; osobnego runtime SQLite nie wykonano.
- Scheduler sprawdzono: niekanoniczny enqueue idzie bez governance enqueue, ale worker trafia do poprawionego `executeBackgroundPlan`.
- R2 dowodzi okna (b): executor czeka 150 ms przy heartbeat 10 ms; heartbeat wielokrotnie widzi `cancelled` i realne renew rzuca.
- Pełne HTTP przez `ApiGateway`: **NOT_PROVEN**. R1 dowodzi createPlan bez canonical ID, realnego dispatch/Redis/workera/PG, odmowy i braku skutku narzędzia.

## Pliki

```text
server/src/services/ai/agentPlannerService.ts
server/src/services/ai/__tests__/day180.agent-plan-long-cancel.pg.redis.test.ts
server/src/services/ai/__tests__/day180.agent-plan-resource-limit.pg.redis.test.ts
docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY180_AGENT_LIMITY_REPORT.md
```

---

## ERRATA FIX-180 (2026-08-30, Opus) — cztery wady z sond odbioru

Odbiór 180 (`docs/program/funkcje/ODBIOR_180_AGENT_LIMITY.md`) znalazł cztery
wady, których w powyższym raporcie NIE MA. Wszystkie zamknięte na tej samej
gałęzi, commit per naprawa, mutacja per naprawa. Dowody: własne kontenery
`cx-fix180-pg` (6107) + `cx-fix180-redis` (6411), migracje od pustej bazy
(drugi przebieg `Applying migrations: 0`), testy uruchamiane Z KATALOGU
`server/`, `npx tsc --noEmit` czysto.

- **F3 ZROBIONE** (`fa38aaf298`): krok, którego narzędzie było w locie w chwili
  anulowania, zostawał `running` na zawsze (`cancelPlan` skipuje tylko
  `pending`/`awaiting_approval`, a każda gałąź anulowania w `executePlan`
  wracała bez dotknięcia wiersza — front pokazywał „W toku" bez końca). Obie
  gałęzie (okno b i a2) zamykają go teraz terminalnie: `skipped` +
  `completed_at`, w oknie b także realny `duration_ms`.
  Mutacja: usunięcie obu wywołań → `expected 'running' not to be 'running'`.
- **F4 ZROBIONE** (`ed2e6fc17f`): oba nowe env-y czytane były jako
  `Math.max(x, Number(env || default))`, więc literówka dawała `NaN`:
  `setInterval(NaN)` = 1 ms (UPDATE dzierżawy co milisekundę), a
  `durationMs < NaN` = zawsze fałsz (ostrzeżenie na KAŻDYM kroku). `readEnvMs()`
  wymaga wartości skończonej ≥ minimum, inaczej bierze dokumentowany default.
  Mutacja w dwóch połówkach przy `env='nieprawidlowa'`: przywrócenie wyrażenia
  heartbeatu → 128 renew w kroku 150 ms; przywrócenie progu → 1 ostrzeżenie
  zamiast 0.
- **Happy-path + licznik odmów ZROBIONE** (`77fef4f11e`): brakująca połowa
  dowodu — zwykły plan z czatu (własny tenant, ZERO seedowanej polityki)
  przechodzi end-to-end przez realną kolejkę i workera pod polityką, którą
  governance sam provisionuje: plan `completed`, rezerwacja `settled`, skutek
  narzędzia obecny dokładnie raz, zero odmów. Każda odmowa na tej ścieżce
  przechodzi teraz przez jedno greppowalne miejsce:
  `logger.warn('[AgentResource] admission denied', {reason, organizationId,
  projectId, toolName})` — to jest monitoring z warunku K6(7).
  Mutacje: usunięcie warna → test odmowy czerwony; przywrócenie ucieczki
  „plany z czatu omijają rezerwację" → oba testy czerwone.
- **F1 + F2 ZROBIONE** (`84cadd53fc`) — bez migracji i bez zmiany kontraktu dla
  wave8/multiAgent/adaptera:
  - **F1**: `reserveAgentResource` dostaje OPT-IN `recomputeDeniedAdmission`.
    Wiersz `denied` zapisuje, że NIC się nie wykonało, więc jego wieczny replay
    zamieniał chwilowy szczyt współbieżności w martwy krok na zawsze (retry i
    wznowienie odtwarzają ten sam klucz). Z flagą odmowa jest przeliczana wobec
    bieżącego zużycia, a TEN SAM wiersz aktualizowany w miejscu (bez drugiego
    wiersza, bez podwójnego liczenia). Domyślnie wyłączone — wave8, multiAgent,
    adapter i dowody A09 dostają dokładnie dzisiejszą, trwałą odmowę; nowy test
    asertuje obie połowy. Flagę podaje wyłącznie `agentPlannerService`.
  - **F2**: klucz idempotencji plannera jest teraz per PRÓBA (próba 1 zachowuje
    historyczny klucz co do bajtu, próby 2-3 dostają sufiks `:attempt:N` — ten
    sam kształt, którego od A09 używa wołacz work-graph). Wcześniej porażka
    próby 1 zostawiała rezerwację `released`, a próby 2 i 3 odtwarzały tę odmowę
    zamiast wywołać narzędzie: pętla ponowień była dekoracją, a
    `step.error_message` niósł wewnętrzny kod governance zamiast realnej
    przyczyny. Dedup redelivery zachowany, bo numer próby jest DETERMINISTYCZNY,
    nie licznikiem w bazie: ponowna dostawa joba odtwarza najpierw próbę 1 i
    znajduje `settled`, więc narzędzie, które już się udało, nie wykonuje się
    drugi raz. (Licznik trzymany w bazie zrobiłby dokładnie odwrotnie — nowy
    klucz po redelivery = drugie wykonanie skutku; dlatego go NIE ma.)
  - Mutacje: `readmitDenial := false` → oba testy F1 czerwone (odmowa na zawsze
    / 2 wiersze zamiast 1); `attemptSuffix := ''` → oba testy F2 czerwone
    (1 wywołanie narzędzia zamiast 3, przejściowa porażka nieprzeżyta).

### Stan sąsiadów (bez NOWYCH czerwonych)
16 plików / 70 testów: **1 czerwony, ZASTANY** —
`agentTaskDispatchService.pg.redis.test.ts:173` (`status 'RUNNING'` zamiast
`'SUCCEEDED'`, `attempt_count 4`); identyczny przed zmianami, potwierdzony też w
izolacji. Drugie zastane czerwone z odbioru (day165 `secretOrPrivateKey must
have a value`) było brakiem `JWT_SECRET` w powłoce, nie defektem kodu — z
ustawionym sekretem day165 jest ZIELONY (2/2).

### Nowe pliki testowe
```text
server/src/services/ai/__tests__/day180.agent-plan-env-guard.pg.test.ts
server/src/services/ai/__tests__/day180.agent-plan-retry-admission.pg.test.ts
server/src/services/v8/__tests__/day180.agent-resource-denied-readmission.pg.test.ts
```
