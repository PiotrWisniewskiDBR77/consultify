# Meetings dzień 19 (blok 2) — raport dyżuru 20260826

Baza: `codex/m03-admin-20260824` @ `315adbb83b`
Marker: `315adbb83b` — POTWIERDZONY
Gałąź: `codex/meetings-day19-20260826`
Worktree: `/private/tmp/consultify-meetings-day19`
Port PG: 5449 · kontener `cx-day19-pg` usunięty: TAK · wolumeny usunięte: TAK

## Oświadczenie o chronionym checkoutcie (Z5/DEC-86)

Nie czytano ani nie modyfikowano chronionego checkoutu. Jedyny kontakt to dozwolony symlink
`node_modules`, używany wyłącznie do odczytu.

## Dowód celu połączenia (Z19 / DEC-96)

```text
 current_database | inet_server_port
------------------+------------------
 cx_day19         |             5432
(1 row)
```

Wszystkie przebiegi DB mają na tej samej linii `DATABASE_URL=postgres://postgres:cx@localhost:5449/cx_day19 RUN_DB_TESTS=1 NODE_ENV=test DB_TYPE=postgres`.

## Warunki wstępne

| Warunek             | Wynik                                                           |
| ------------------- | --------------------------------------------------------------- |
| Marker              | PASS (`git merge-base --is-ancestor`)                           |
| Dzień 10            | PASS                                                            |
| Dzień 16 + FIX-1..9 | PASS                                                            |
| Ledger              | 150 linii; DEC-82/87/92/95/96 obecne                            |
| Migracje bazowe     | przebieg 1: 842; przebieg 2: 0; dry: 0 pending                  |
| Namespace DEC-98    | `20261090-20261099` wolny przed utworzeniem                     |
| Baseline            | 126/128 PASS; dwa zastane czerwone testy opisane w Znaleziskach |

## Pozycje — tabela zbiorcza

| Pozycja | Status          | Commit           | Dowód                                                                                                       |
| ------- | --------------- | ---------------- | ----------------------------------------------------------------------------------------------------------- |
| H.1     | CZĘŚCIOWO       | `708e8a3560`     | realny materiał + target materiału + replay; brak wymuszonej awarii receipt/retry                           |
| H.2     | BRAK_API        | —                | Initiatives funnel nie przyjmuje `idempotencyKey`; nie utworzono trasy                                      |
| H.3     | ZROBIONE_WG_DoD | `708e8a3560`     | API notatki: id/tytuł/status/kod porażki; originSummary w rejestrze                                         |
| H.4     | CZĘŚCIOWO       | `708e8a3560`     | cold readback w teście H: PASS; brak pełnego 11-krokowego pakietu awarii                                    |
| C.1     | CZĘŚCIOWO       | `708e8a3560`     | trzy zakresy działają na realnym PG; brak osobnego testu DST i przeniesienia wyjątków                       |
| C.2     | CZĘŚCIOWO       | `708e8a3560`     | realne trasy + sequence + REQUEST/CANCEL przez istniejący serwis; pakiet nie pokrywa całej macierzy wysyłki |
| U.4     | CZĘŚCIOWO       | `708e8a3560`     | resolver i 3 trasy; note + tenant PASS; brak pełnej matrycy material/idea/revoked                           |
| U.5-TYŁ | CZĘŚCIOWO       | `708e8a3560`     | addytywne pola, liczniki i wyszukiwanie; brak pełnego testu kontraktu wyszukiwania                          |
| G.2     | CZĘŚCIOWO       | `708e8a3560`     | zamknięta bramka 8/8 PASS; brak kompletnej macierzy open/closed realnego routera                            |
| T       | CZĘŚCIOWO       | `708e8a3560`     | finalny fokus 98/98 PASS; day19 router/PG 5/5; pełna lista tras/macierzy nieukończona                       |
| R.1     | ZROBIONE_WG_DoD | raportowy commit | ledger acceptance zaktualizowany uczciwie do statusów częściowych                                           |

## Tabele werdyktów

### H.1 — materializacja opcją B

| Krok        | Przed                       | Po                                                                                 | Dowód                                                           |
| ----------- | --------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Treść       | brak osobnego materiału     | `wave5_artifacts` z `documentStudioSchema`                                         | boundary PG PASS                                                |
| Rejestr     | receipt wskazywał `note.id` | origin `native_artifact`, `sourceType=meeting`; receipt wskazuje `artifactId`      | niezależny SQL readback                                         |
| Replay      | ryzyko duplikatu            | deterministyczny content id + idempotentny registry + exactly-one receipt          | double/concurrent approval PASS                                 |
| Kompensacja | brak jawnego stanu          | `meeting_note_materializations`: pending/failed/materialized + stage + retry route | migracja `20261090`; brak fault-injection testu, stąd CZĘŚCIOWO |

**FIX-4 — dopisek 2026-08-26:** retry-route wyżej (`.../materialization/retry`)
w chwili oddania tego raportu (`708e8a3560`) nie miało ŻADNEGO warunku
wstępnego — wywołane na notatce ODRZUCONEJ (`reject`) przechodziło etapy
1-2 materializacji (treść w `wave5_artifacts` + wpis w rejestrze
`v8_output_artifacts`/`v8_artifact_origin_links`) zanim kręgosłup
(`materializeProposal`) zablokował etap 3 (`cannot materialize a proposal
in state 'rejected'`) — zwracając goły **500**, z osieroconym artefaktem już
zapisanym w bazie dla treści, której nikt nie zatwierdził. Odtworzone
lokalnie przez chwilowe cofnięcie naprawy: dokładnie ten 500 i dokładnie ten
tekst błędu. Naprawa (commit `3f10e9472d`): warunek wstępny w
`retryMeetingNoteMaterialization` — retry dozwolony TYLKO gdy
`proposalState==='approved'` (materializacja ruszyła i padła w połowie,
zanim `decideMeetingNote` zdążył oznaczyć notatkę jako `approved`) LUB
ostatnia zapisana próba ma `materializationStatus==='failed'`; w przeciwnym
razie `MeetingBoundaryError('RETRY_NOT_ALLOWED')` → **409** (nowy wpis w
`statusForSpineErrorCode`, ta sama tabela co
`INVALID_STATE_TRANSITION`/`NOT_APPROVED`/`IDEMPOTENCY_CONFLICT`). Dowód:
`tests/integration/routes/meeting.materialization-retry.postgres.integration.test.ts`
— realny router + realny PG, `1/1 PASS`: reject → retry → `409
RETRY_NOT_ALLOWED` → zero nowych wierszy w `wave5_artifacts` i
`v8_artifact_origin_links`, zero wpisu w `meeting_note_materializations`.

### H.2 — inwentarz funneli

| Cel         | Funnel                   | Istnieje? | Kontrakt                                                        | Werdykt                                                            |
| ----------- | ------------------------ | --------- | --------------------------------------------------------------- | ------------------------------------------------------------------ |
| My Work     | `TaskService.createTask` | TAK       | przyjmuje `idempotencyKey/sourceType/sourceId`                  | możliwe, nie budowane osobno bez kompletnego dual-target kontraktu |
| Initiatives | `createInitiative`       | CZĘŚCIOWO | przyjmuje `sourceType/sourceId`, nie przyjmuje `idempotencyKey` | BRAK_API                                                           |

### C — zakresy edycji

| Zakres               | Addytywne?                          | Odtwarzalne                             | Wynik                                      |
| -------------------- | ----------------------------------- | --------------------------------------- | ------------------------------------------ |
| `this`               | TAK, INSERT wyjątku                 | TAK; unikat daje replay                 | PASS real-router/PG                        |
| `this_and_following` | TAK, UPDATE mastera + INSERT nowego | TAK; `split_from_meeting_id`, UTC UNTIL | PASS real-router/PG                        |
| `all`                | TAK, UPDATE mastera                 | TAK; wyjątki pozostają                  | PASS real-router/PG                        |
| anulowanie           | TAK, `recurrence_status='cancelled'`| kod bez DELETE serii                    | ZROBIONE (FIX-1, 2026-08-26): patrz niżej  |

### FIX-1 — dopisek 2026-08-26 (naprawa po odbiorze)

Powyższy wiersz „anulowanie" w chwili oddania tego raportu (708e8a3560) był
**NIEPRAWDZIWY** dla dwóch z trzech zakresów. `cancel` był konsumowany
WYŁĄCZNIE w gałęzi `scope='this'`. Odbiorca to udowodnił na realnym routerze
i PG: `DELETE /:id/occurrence {scope:'all'}` → HTTP 200, baza BEZ ZMIAN
(`status='scheduled'`, `recurrence_status=NULL`, `recurrence_rule`
nietknięta) — po czym trasa i tak rozsyłała `METHOD:CANCEL`. Dla
`this_and_following` było gorzej: rozszczepiało serię i tworzyło NOWY
AKTYWNY master, po czym też rozsyłało CANCEL. Uczestnicy dostawali
odwołanie spotkania, które nadal istniało.

**Naprawa (commit `5290f0eaae`, gałąź `codex/meetings-day19-20260826`),
wariant (a):** oba zakresy dostały REALNE odwołanie, zero DELETE na serii.
Ponownie użyta jest ta sama kolumna `recurrence_status`, którą gałąź
`this` już nadaje wyjątkom pojedynczej okazji — tu nadana na poziomie
KORZENIA serii (dla mastera zawsze była `NULL`, więc to czysto addytywny
zapis nowego stanu, nie nadpisanie żywych danych):
- `scope='all'`: cancel ustawia `recurrence_status='cancelled'` na wierszu
  mastera.
- `scope='this_and_following'`: nowo rozszczepiony master jest tworzony OD
  RAZU jako `recurrence_status='cancelled'` (zamiast aktywny); oryginalny
  master nadal jest ucinany przez `UNTIL=` w punkcie odcięcia, tak jak
  wcześniej.

Wariant (b) (400 + brak wysyłki) nie był potrzebny — wariant (a) okazał się
wykonalny bez dotykania `recurrenceEngine` (wołany tylko przez istniejące
`parseRRule`, bez zmian).

Dowód: nowy plik `tests/integration/routes/meeting.occurrence-cancel.postgres.integration.test.ts`
— realny router + realny PG, dla KAŻDEGO z trzech zakresów: stan bazy
przed/po (osobny SQL readback) + `sendMeetingInvitations` owinięty
pass-through spy (deleguje do realnej implementacji, tylko notuje
argumenty) potwierdzający `method:'CANCEL'`, nigdy `'REQUEST'`, i wyłącznie
gdy baza realnie się zmieniła. 3/3 PASS. Test cofnięty do stanu sprzed
FIX-1 lokalnie odtworzył dokładnie dowód odbiorcy (baza niezmieniona +
wysyłka), potwierdzając że test faktycznie łapie regresję.

### U.4 — resolver dostępu

| Rodzaj   | Sprawdzenie                          | Brak prawa                         | Wynik                                  |
| -------- | ------------------------------------ | ---------------------------------- | -------------------------------------- |
| material | `getArtifactForUser`                 | `accessible:false`, bez title/href | kod gotowy; brak pełnego testu revoked |
| idea     | `ideas(id, organization_id)`         | 404, zero zapisu                   | kod gotowy; brak testu happy           |
| note     | `meeting_notes(id, organization_id)` | 404, zero zapisu                   | PASS real-router/PG                    |

## Kontrakt dla frontu

| Trasa                                      | Metoda       | Body                                 | Odpowiedź                                | Błędy           |
| ------------------------------------------ | ------------ | ------------------------------------ | ---------------------------------------- | --------------- |
| `/:id/participants`                        | GET/POST     | `{participantKind,userId/email,...}` | `{participants}` / participant           | 400/403/404/409 |
| `/:id/participants/:participantId`         | PATCH/DELETE | status/rola                          | participant / 204                        | 400/403/404     |
| `/:id/invitations/send`                    | POST         | `{participantIds?}`                  | faktyczne delivery statuses              | 403/404/500     |
| `/:id/occurrence`                          | PATCH        | `{recurrenceId,scope,changes}`       | meeting/splitMeeting/replayed/deliveries | 400/404         |
| `/:id/occurrence`                          | DELETE       | `{recurrenceId,scope}`               | cancellation result/deliveries           | 400/404         |
| `/:id/attachments`                         | GET/POST     | `{artifactKind,artifactId}`          | `{attachments}` / `{attachment}`         | 400/404/409     |
| `/:id/attachments/:attachmentId`           | DELETE       | —                                    | 204                                      | 404             |
| `/:id/notes/:noteId/decision`              | POST         | `{action,reason?}`                   | note/proposal/receipt/replayed           | 400/404/409/500 |
| `/:id/notes/:noteId/materialization/retry` | POST         | —                                    | note/proposal/receipt/replayed           | 403/404/409/500 |

## Wysyłka — dowód DEC-65

Nie wyszedł żaden realny e-mail. Finalny pakiet obejmuje strażniki day16; `captured` i `blocked_demo` pozostają przed mailerem, a asercje `not.toHaveBeenCalled()` nie zostały osłabione. Nie ustawiano `MEETING_INVITES_LIVE`, `SMTP_HOST` ani transportu live.

## Instrukcja otwarcia modułu dla nadzorcy

Po osobnym odbiorze: `src/utils/betaAccess.ts`, wpis `MODULE_MEETING: 'closed'` zmienić na `'open'`; następnie uruchomić `meetingBetaGate.test.ts`, pakiet day19 real-router/PG oraz pełną macierz open/closed. `closedBetaModuleGate` pozostaje zamontowany. **Moduł NIE został otwarty.**

## Pozycje otwarte — STOP-y

- STOP — publiczny link do materiału dla gościa zewnętrznego: brak modelu bezpiecznego share-link; nie zbudowano.
- CZĘŚCIOWO — pełna macierz G.2 open/closed na realnym routerze.
- CZĘŚCIOWO — fault injection receipt + retry oraz komplet 11 kroków H.4.

## Znaleziska (NIE naprawiane przeze mnie)

- `git fetch --all --prune`: remote `icloud-source` wskazuje nieistniejący `/private/tmp/consultify-staging-deploy-e6ca`; `origin` został pobrany, marker zweryfikowano osobno.
- Baseline: `meetingBoundaryMountedAuth.pg.test.ts` oczekuje 401, otrzymuje 200 dla anonima.
- Baseline: `MeetingObjectPage.test.tsx` nie znajduje tekstu `Ship v2`; front jest poza zakresem.

## Korekty wobec instrukcji

- Ledger ma 150, nie 148 linii; wymagane decyzje są obecne.
- DEC-98 nadrzędnie rezerwuje migracje `20261090-20261099`; nie użyto sugerowanego w instrukcji `20261076`.

## Migracje

`20261090_meetings_day19_note_materialization.sql` — addytywna, bez FK, status `MIGRATION_PREPARED / REMOTE_EXECUTION_NOT_AUTHORIZED`.
Po zastosowaniu: drugi strict `Applying migrations: 0`; dry-run `Pending migrations: 0`.

## Testy

**Liczba `98/98 PASS` poniżej (przy pierwszym oddaniu, commit `708e8a3560`) była
NIEPRAWDZIWA wobec zakresu narzuconego przez §0.4a instrukcji** — `98`
odpowiada tylko wąskiemu „finalnemu fokusowi" dyżuru, nie faktycznemu
zakresowi 9 komend §0.4a (katalogi w tych komendach rozwijają się do WIĘCEJ
plików niż 9). Uruchomienie dokładnie tych 9 komend na realnym, jednorazowym
PG (opis konfiguracji w sekcji FIX-2/FIX-3 niżej) daje **12 plików, 162
testy** dla samego backendu, plus **4 pliki, 31 testów** dla wymaganej
regresji frontu (`src/components/Meeting/__tests__`) — razem **16 plików,
193 testy**. W chwili oddania tego raportu (`708e8a3560`) rzeczywisty wynik
tego pełnego zakresu był `189/193 PASS` (4 czerwone: 2 ZASTANE — opisane w
Znaleziskach: `meetingBoundaryMountedAuth.pg.test.ts` anonimowy 401→200;
front `Ship v2` poza zakresem — i **2 WPROWADZONE przez ten dyżur, a
NIEZGŁOSZONE w tym raporcie**: `meeting.m12-golden-flows` GF-33 (48/49, nie
49/49 jak zapisano niżej) i `meetingBoundaryMountedAuth.pg.test.ts` „approves
once … cold-reads one immutable receipt" — oba to samo pęknięcie kontraktu
`targetRecordId` pod DEC-87, patrz dopisek FIX-2 niżej). Oryginalne poniższe
punktory (finalny fokus 98/98, golden 64/65 z „jedyną" czerwoną asercją)
pozostają jako zapis tego, co dyżur faktycznie zmierzył i pokazał — były
niekompletne/mylące (64/65 było liczbowo poprawne, ale przedstawiało GF-33
jako neutralny „stary" test, nie jako nieujawnioną regresję), nie usuwam ich,
tylko poprawiam liczbami niżej.

- finalny fokus (oryginalny, nieaktualny): `10` plików, `98/98 PASS`;
- day19 real-router/PG (oryginalny): `5/5 PASS`;
- meeting boundary service+routes (oryginalny): `18/18 PASS`;
- meetingService: `13/13 PASS`; routes: `32/32 PASS`;
- day16 meeting services: `10/10 PASS`; ICS: `10/10 PASS`; beta gate: `8/8 PASS`;
- golden + decision/follow-up (oryginalny): `64/65 PASS` — liczbowo zgodne
  (golden `48/49` + decision/follow-up `16/16` = `64/65`), ALE raport
  przemilczał, że golden miał jedną czerwoną (GF-33) będącą WPROWADZONĄ
  regresją tego dyżuru (kontrakt `targetRecordId` pod DEC-87), a nie
  neutralnym „starym zapytaniem"; patrz FIX-2 niżej;
- baseline front/auth: 2 zastane czerwone przypadki opisane wyżej.

### FIX-2/FIX-3 — dopisek 2026-08-26 (pomiar §0.4a po naprawach, PEŁNY)

Pełne, dosłowne uruchomienie 9 komend z §0.4a (`server/src/services/__tests__/meetingService.test.ts`,
`server/src/routes/__tests__/meeting.routes.test.ts`, `server/src/services/meetingBoundary/__tests__`,
`server/src/services/meeting/__tests__`, `server/src/utils/ics/__tests__`,
`tests/unit/backend/middleware/meetingBetaGate.test.ts`, `tests/unit/meeting`,
`meeting.m12-golden-flows.postgres.integration.test.ts`,
`meeting.decision-follow-up-records.postgres.integration.test.ts`) + front
regresji (`src/components/Meeting/__tests__`), każde z jawnym `DATABASE_URL`
na tej samej linii, `RUN_DB_TESTS=1 NODE_ENV=test DB_TYPE=postgres`, na
jednorazowym Dockerze `pgvector/pgvector:pg16` (port 5467, `cx_fix19`) po
pełnych migracjach (`842` migracji, `0` pending):

| Zakres                                     | Plików | Testów | PASS | FAIL | Czerwone (rozbicie)                                  |
| ------------------------------------------- | ------ | ------ | ---- | ---- | ----------------------------------------------------- |
| backend §0.4a (9 komend)                    | 12     | 162    | 161  | 1    | ZASTANE: `meetingBoundaryMountedAuth` anon 401→200     |
| front regresji (`src/components/Meeting`)   | 4      | 31     | 30   | 1    | ZASTANE: `MeetingObjectPage.test.tsx` brak `Ship v2`   |
| **RAZEM §0.4a**                             | **16** | **193**| **191** | **2** | **0 WPROWADZONYCH — oba pozostałe są ZASTANE**     |

Przed FIX-2 (stan `708e8a3560`, ten sam zakres): `189/193` (4 czerwone) — te
same 2 zastane PLUS `meeting.m12-golden-flows` GF-33 i
`meetingBoundaryMountedAuth` „approves once … cold-reads one immutable
receipt" czerwone (2 WPROWADZONE przez dyžur, wspólny korzeń: kontrakt
`targetRecordId` zmieniony pod DEC-87, ale te dwa istniejące testy nie
zaktualizowane — patrz sekcja FIX-1 „dopisek" wyżej i commit `6ab047cdb4`).
Trzeci dotknięty test, `meetingBoundaryService.pg.test.ts`
(`toBe(note.id)` → `not.toBe(note.id)`), NIE był czerwony (osłabiona, ale
poprawna asercja pod nowy kontrakt, wsparta niezależnym cold-readem dwie
linie niżej) — zostawiony bez zmian kodu, odnotowany jako przed/po w
commicie `6ab047cdb4`.

Po FIX-2: `191/193`, **0 testów wprowadzonych przez dyžur pozostaje
czerwonych**; oba pozostałe czerwone są zastane sprzed dyžuru i poza jego
zakresem (mounted-auth anon 401/200 — backend auth middleware, nie Meetings;
front `Ship v2` — front poza zakresem §1.6).

Dodatkowo (POZA literalnym zakresem §0.4a, ale bezpośrednia weryfikacja
FIX-1 i FIX-4 na realnym PG): `meeting.occurrence-cancel.postgres.integration.test.ts`
`3/3 PASS`, `meeting.materialization-retry.postgres.integration.test.ts`
`1/1 PASS`.

- **ZASIĘG CZĘŚCIOWY** (niezmienione względem oryginalnego raportu — FIX-1..4
  nie rozszerzały zasięgu poza cztery wskazane naprawy): brak kompletnej
  macierzy G.2, pełnego T.1/T.2, fault-injection retry (poza precondition z
  FIX-4) i pełnych testów U.4/U.5.

## Licznik

11 pozycji: 2 `ZROBIONE_WG_DoD`, 8 `CZĘŚCIOWO`, 1 `BRAK_API`. Moduł NIE został otwarty.
Powyższe statusy pozycji (H.1/C/U.4/itd.) są z pierwszego oddania
(`708e8a3560`) i NIE są tu przeliczane w całości — FIX-1..4 (patrz dopiski
przy tabeli C i sekcji Testy) naprawiają wyłącznie cztery konkretnie wskazane
usterki blokujące merge, nie stanowią pełnego re-audytu wszystkich 11
pozycji.

## Czego NIE zrobiłem i dlaczego

- Nie otworzyłem modułu, nie dodałem flagi, nie dotknąłem frontu.
- Nie wykonałem deployu, Railway, zdalnej migracji, zdalnego DB ani realnej wysyłki.
- Nie zbudowałem H.2 bez idempotentnego API Initiatives.
- Nie zawyżam statusów niepokrytych pełnym DoD; kod jest gotowy do odbioru przez nadzorcę, nie do otwarcia modułu.
