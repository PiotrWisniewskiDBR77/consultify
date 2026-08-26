# Meetings dzień 16 — raport dyżuru 20260826 (R2)

Baza: `codex/day16-instrukcja-20260826` @ `1901293fc8`
Marker: `c2f90af290` — POTWIERDZONY
Gałąź: `codex/meetings-day16-r2-20260826`
Worktree: `/private/tmp/consultify-meetings-day16-r2`
Port: 4306 · kontener `cx-day16-pg` usunięty: TAK

## Bezpieczeństwo i koordynacja

Nie czytałem ani nie modyfikowałem źródeł/WIP w chronionym checkoutcie. Użyłem
wyłącznie autoryzowanego symlinka `node_modules`. Nie wykonano fetch, push,
deployu, Railway, zdalnej bazy, zdalnych migracji ani realnej wysyłki e-mail.
Prawy panel (`a6b74f67ce`) pozostał własnością osobnego robotnika i nie został
dotknięty. Backend dnia 10 jest SCALONY. Moduł pozostaje zamknięty.

## Pozycje

| Pozycja | Status          | Commit                     | Dowód / ograniczenie                                                              |
| ------- | --------------- | -------------------------- | --------------------------------------------------------------------------------- |
| H.1     | STOP            | —                          | brak atomowego kontraktu rejestru materiałów                                      |
| H.2     | BRAK_API        | —                          | nie zbudowano automatu ani kontrolki                                              |
| H.3–H.4 | NIE_ZACZĘTE     | —                          | zależne od H.1                                                                    |
| U.1     | CZĘŚCIOWO       | `734a9dd0da`               | kolumna, API, readback; brak UI/i18n/zrzutów                                      |
| U.2     | CZĘŚCIOWO       | `734a9dd0da`               | model danych; brak rozwijania listy i limitu                                      |
| U.3     | CZĘŚCIOWO       | `734a9dd0da`               | tabela, backfill, organizer, CRUD/API, testy PG; brak UI i pełnych testów routera |
| U.4     | CZĘŚCIOWO       | `734a9dd0da`               | tabela przygotowana; brak bezpiecznego resolvera dostępu/API/UI                   |
| U.5     | NIE_ZACZĘTE     | —                          | zero atrap przy niepełnych U/C                                                    |
| C.1–C.2 | NIE_ZACZĘTE     | —                          | brak uczciwych trzech zakresów i tras occurrence                                  |
| I.1     | ZROBIONE_WG_DoD | `734a9dd0da`               | ICS: TZID, RRULE, ATTENDEE, ORGANIZER, SEQUENCE, REQUEST/CANCEL                   |
| I.2     | CZĘŚCIOWO       | `734a9dd0da`               | realny repo-mailer i prawdomówny status; brak testu częściowej awarii SMTP        |
| I.3     | ZROBIONE_WG_DoD | `734a9dd0da`, `9e666406a1` | `captured` i `blocked_demo` przed mailerem                                        |
| G.2     | NIE_ZACZĘTE     | —                          | brak pełnej macierzy open/closed realnego routera                                 |
| T/R     | CZĘŚCIOWO       | —                          | brak UI, zrzutów i pełnych testów tras; acceptance nie podniesiony                |

## U.3 — uczestnicy

| Rodzaj         | Walidacja                                      | Stan                       | Negatyw                   |
| -------------- | ---------------------------------------------- | -------------------------- | ------------------------- |
| użytkownik org | `users.id + organization_id + status='active'` | trwała tożsamość/status    | obcy tenant odrzucony     |
| gość           | serwerowa walidacja e-mail                     | jawny guest, bez uprawnień | błędny e-mail odrzucony   |
| organizator    | backfill z `created_by`, accepted              | nieusuwalny                | próba usunięcia odrzucona |

`attendees_json` pozostaje nietknięte. Backfill używa `ON CONFLICT DO NOTHING`.

## I — wysyłka i DEC-65

| Scenariusz        | Wynik                                                                      |
| ----------------- | -------------------------------------------------------------------------- |
| dev/test bez LIVE | `captured`, SMTP nietknięty — PASS PG                                      |
| `DEMO_ORG_ID`     | `blocked_demo` przed mailerem — PASS PG                                    |
| ICS REQUEST       | TZID/RRULE/organizer/attendee — PASS unit                                  |
| update/cancel     | SEQUENCE/CANCEL — PASS unit generatora; brak C.2                           |
| live SMTP         | kod wywołuje `emailService.send(requireDelivery:true)`; celowo niewykonane |

**Z tego dyżuru nie wyszedł ani jeden realny e-mail.** Testy nie ustawiały
`SMTP_HOST`; ścieżki `captured` i `blocked_demo` kończą się przed mailerem.

## STOP — H.1 atomowa materializacja

`registerArtifactOrigin` (`artifactRegistryService.ts:1289`) wykonuje osobne,
nietransakcyjne inserty przez globalny `DbPromise`, nie przyjmuje darowanej
transakcji i sam dokumentuje ryzyko TOCTOU. `materializeProposal` przyjmuje
donated query. Nie da się objąć materiału i receipt jedną transakcją bez zmiany
współdzielonego `artifactRegistryService`, zabronionej przez Z17. Nie utworzono
półmateriału. Następne zamknięcie: osobno odebrany kontrakt donated-query dla
`registerArtifactOrigin` albo formalna decyzja o kompensacji failed/retry.

## Migracje

`20261075_meetings_day16_calendar_participants.sql` — namespace sprawdzony jako
wolny; wyłącznie addytywne DDL/backfill, bez FK do Meetings. Przebieg ponowny:
`Applying migrations: 0`; dry-run: `Pending migrations: 0`. Status:
**MIGRATION_PREPARED / REMOTE_EXECUTION_NOT_AUTHORIZED**.

## Testy

- golden real PG: `49/49` PASS;
- routes: `26/26` PASS;
- meetingService: `13/13` PASS;
- closed beta gate: `8/8` PASS;
- ICS: `4/4` PASS;
- day16 participants + delivery guards real PG: `7/7` PASS;
- meetingBoundary baseline ma zastane czerwone testy przy współdzielonej bazie
  testowej; nie osłabiono asercji ani globalnych mocków.

**ZASIĘG CZĘŚCIOWY.** Brak H, pełnego C, U.5, G.2, testów wszystkich nowych
tras i zrzutów. `MODULE_ACCEPTANCE.md` nie został podniesiony.

## Korekty wobec instrukcji

1. Ledger ma 136, nie 134 wiersze; wymagane decyzje są na oczekiwanych liniach.
2. Przydzielony namespace to `20261075_*`, bo `20260914_` i `20260915_` są zajęte.
3. Mount bramki jest na linii 154, nie około 146.
4. Rejestr materiałów nie ma donated-query, więc H.1 nie spełni atomowości.

## Licznik

17 pozycji: 2 ZROBIONE_WG_DoD · 6 CZĘŚCIOWO · 2 STOP/BRAK_API · 7
NIE_ZACZĘTE. Moduł NIE został otwarty. Brak zrzutów; powierzchnie wizualne nie
są gotowe do odbioru przez nadzorcę.
