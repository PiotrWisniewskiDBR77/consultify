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
| anulowanie           | TAK, wyjątek cancelled              | kod bez DELETE serii                    | CZĘŚCIOWO: brak osobnej asercji routerowej |

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

- finalny fokus: `10` plików, `98/98 PASS`;
- day19 real-router/PG: `5/5 PASS`;
- meeting boundary service+routes: `18/18 PASS`;
- meetingService: `13/13 PASS`; routes: `32/32 PASS`;
- day16 meeting services: `10/10 PASS`; ICS: `10/10 PASS`; beta gate: `8/8 PASS`;
- golden + decision/follow-up: `64/65 PASS`; jedyna czerwona asercja golden szuka receipt po starym `target_record_id=note.id`, sprzecznym z wiążącym H.1; plik golden pozostał nietknięty zgodnie z T.3;
- baseline front/auth: 2 zastane czerwone przypadki opisane wyżej;
- **ZASIĘG CZĘŚCIOWY**: brak kompletnej macierzy G.2, pełnego T.1/T.2, fault-injection retry i pełnych testów U.4/U.5.

## Licznik

11 pozycji: 2 `ZROBIONE_WG_DoD`, 8 `CZĘŚCIOWO`, 1 `BRAK_API`. Moduł NIE został otwarty.

## Czego NIE zrobiłem i dlaczego

- Nie otworzyłem modułu, nie dodałem flagi, nie dotknąłem frontu.
- Nie wykonałem deployu, Railway, zdalnej migracji, zdalnego DB ani realnej wysyłki.
- Nie zbudowałem H.2 bez idempotentnego API Initiatives.
- Nie zawyżam statusów niepokrytych pełnym DoD; kod jest gotowy do odbioru przez nadzorcę, nie do otwarcia modułu.
