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
| I.1     | NAPRAWIONE (było CZĘŚCIOWO po odbiorze) | `734a9dd0da` → `23b4d4c44b`…`a49df5f25b` | pierwotne ZROBIONE_WG_DoD było przedwczesne: odbiór 20260826 znalazł P1 (DTSTART/DTEND 2h błędu, RRULE injection przez CR/LF) blokujące merge; oba i pięć P2 naprawione w warstwie FIX wewnętrznych — patrz sekcja niżej |
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
- routes: `26/26` PASS (+ 6 nowych testów RRULE-walidacji w FIX-2, patrz niżej);
- meetingService: `13/13` PASS;
- closed beta gate: `8/8` PASS;
- ICS: `10/10` PASS (było `4/4` — 6 nowych testów z warstwy FIX wewnętrznych);
- day16 participants + delivery guards real PG: `8/8` PASS (było `7/7` —
  +1 test FIX-9 na brakującą tabelę);
- meetingInvitationService (nowy plik, jednostkowy, bez bazy): `2/2` PASS
  (FIX-7, izolacja awarii per odbiorca);
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

17 pozycji: 1 ZROBIONE_WG_DoD (I.3) · 1 NAPRAWIONE (I.1, po FIX-ach
wewnętrznych 20260826) · 6 CZĘŚCIOWO · 2 STOP/BRAK_API · 7 NIE_ZACZĘTE. Moduł
NIE został otwarty. Brak zrzutów; powierzchnie wizualne nie są gotowe do
odbioru przez nadzorcę.

## FIX-y wewnętrzne 20260826

Odbiór warstwy 1 dyżuru (baza `codex/meetings-day16-r2-20260826` @
`fbd8c77f8b`) znalazł P1 blokujące merge w generatorze ICS i w API
spotkań — patrz I.1 skorygowane wyżej. Naprawy wykonane na osobnej gałęzi
`codex/day16-fixes-20260826` (worktree `/private/tmp/consultify-day16-fixes`,
symlink `node_modules`/`server/node_modules` tylko do odczytu z checkoutu
głównego, zero zapisu poza worktree), commit-per-fix, bez push/merge.

| FIX  | Waga | Opis                                                                                    | Commit       | Test / dowód                                                                                       |
| ---- | ---- | ---------------------------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------- |
| FIX-1 | P1 (P1-1+P1-4) | `DTSTART`/`DTEND` emitowane jako czysty UTC (`...Z`) zamiast `TZID=<strefa>` na nieprzeliczonym czasie — błąd 2h dla Europe/Warsaw. `VTIMEZONE` zbędny po przejściu na UTC; strefa spotkania zachowana informacyjnie w `X-CONSULTIFY-TIMEZONE`. | `23b4d4c44b` | `icsBuilder.test.ts`: nowa asercja na formę `20260826T080000Z`, brak `TZID`/`VTIMEZONE` — PASS (unit) |
| FIX-2 | P1 (P1-2) | Serwerowa walidacja `recurrenceRule` (POST/PUT `/api/meeting`) — whitelist `FREQ`(wymagany DAILY/WEEKLY/MONTHLY/YEARLY)/`INTERVAL`/`COUNT`/`UNTIL`/`BYDAY`/`BYMONTHDAY`/`BYMONTH`/`WKST`, zakaz CR/LF → 400. Builder dostał defensywny strip CR/LF jako druga warstwa. | `b40e723731` | `meeting.routes.test.ts` (6 nowych testów: injection, brak FREQ, nieznany klucz, poprawny przebieg, `null` czyści regułę) + `icsBuilder.test.ts` (strip CR/LF) — PASS (unit) |
| FIX-3 | P2 | `METHOD:CANCEL` emituje też `STATUS:CANCELLED` (RFC 5546 §3.2.5) — bez tego część klientów (Outlook) traktuje CANCEL jak zwykły update. | `fd17d769ed` | `icsBuilder.test.ts`: CANCEL zawiera `STATUS:CANCELLED`, REQUEST nie — PASS (unit) |
| FIX-4 | P2 | Parametry `CN=` (organizer/attendee) cudzysłowowane (DQUOTE) zamiast backslash-escape gdy zawierają `,`/`;`/`:` — RFC 5545 §3.2 nie zna backslasha dla param-value. DQUOTE/CR/LF usuwane z wartości przed cudzysłowowaniem. | `b254d5065f` | `icsBuilder.test.ts`: displayName z przecinkiem+dwukropkiem → cudzysłów; DQUOTE/CR/LF sanityzowane — PASS (unit) |
| FIX-5 | P2 | Zawijanie linii ICS >75 oktetów (CRLF + spacja kontynuacji), liczone po bajtach UTF-8, bez cięcia w środku znaku wielobajtowego. | `369c5b2b92` | `icsBuilder.test.ts`: 120-znakowy SUMMARY foldowany, każda linia ≤75 oktetów, odfoldowanie odtwarza oryginał — PASS (unit) |
| FIX-6 | P2 | Strażnicy `captured`/`blocked_demo` dostały dowód wprost: `vi.spyOn(emailService,'send')` + `not.toHaveBeenCalled()`, nie tylko asercja na zwróconym statusie. | `3c176885a1` | `meetingDay16.pg.test.ts` (real PG) — PASS |
| FIX-7 | P2 | `sendMeetingInvitations` — awaria mailera dla jednego odbiorcy (throw, nie tylko `false`) izolowana do tego odbiorcy przez try/catch; pętla kontynuuje do reszty listy zamiast przerywać cały batch. | `c25567615f` | nowy plik `meetingInvitationService.test.ts` (jednostkowy, mocki, bez bazy): mailer rzuca dla 1 z 2 odbiorców, drugi nadal dostaje dostawę — PASS (unit) |
| FIX-8 | P2 | Logi `info`/`warn` przy wysyłce zawierały pełny ICS i adres e-mail odbiorcy — teraz `info`/`warn` niosą tylko `meetingId`/`participantId`/`status`; pełna treść (ICS + e-mail) tylko na `debug`. | `4f8bdd1e40` | inspekcja kodu + log real-PG run pokazuje rozdział info/debug (brak automatycznej asercji na poziom logu — `winston` nie eksponuje tego czysto do testu jednostkowego) |
| FIX-9 | dodatkowy (adendum odbioru runtime, potwierdzone na żywym PG) | Odczyty/zapisy day16 (`meeting_participants`, `meeting_invitation_deliveries`) szły przez `DbPromise` z domyślnym `fallback:true` — brak tabeli z migracji `20261075` maskował się jako pusta lista (`GET .../participants` → 200 `[]`) albo mylące 404 zamiast twardego błędu. Dodano jawne `{fallback:false}` na każdym takim wywołaniu w `meetingDay16Service.ts` i w INSERT do `meeting_invitation_deliveries`. | `a49df5f25b` | `meetingDay16.pg.test.ts` (real PG, ostatni test w pliku): `ALTER TABLE ... RENAME` usuwa tabelę na czas asercji (nie `DROP` — rename+restore w `finally` gwarantuje identyczny schemat po przywróceniu), `listMeetingParticipants` rzuca zamiast zwracać `[]`; potwierdzone przywrócenie tabeli po teście — PASS (real PG, migracje `20261075` uruchomione na jednorazowym Postgresie z `pgvector/pgvector:pg16`, port 4319, kontener usunięty po przebiegu) |

**Weryfikacja end-to-end na żywym Postgresie.** Uruchomiono jednorazowy
kontener `cx-day16fix-pg` (`pgvector/pgvector:pg16`, port 4319), pełen
`db:migrate` (`1047` plików migracji włącznie z `20261075`), i cały plik
`meetingDay16.pg.test.ts` z `RUN_DB_TESTS=1` — `8/8 PASS`, wliczając FIX-6 i
FIX-9. Log przebiegu potwierdza wizualnie FIX-1 (`DTSTART:20260826T080000Z`,
brak `TZID`/`VTIMEZONE`), FIX-5 (folding widoczny na liniach `ATTENDEE`) i
FIX-8 (info-log bez e-maila, debug-log z pełną treścią) na realnych danych
uczestników z bazy, nie tylko w izolowanych unit testach. Kontener i wolumeny
usunięte po przebiegu (`docker rm -f` + `docker volume prune -f`).

**Co nadal brakuje w I.1 mimo NAPRAWIONE.** `VTIMEZONE` jest teraz zbędny
(świadomie, nie luka — UTC nie go wymaga) i nie jest generowany. Nie
zbudowano C.1–C.2 (prawdziwe okna occurrence dla RRULE) ani pełnego testu
tras dla `POST/PUT recurrenceRule` przez supertest+real-auth (testy tras są
na zmockowanym `meetingService`, zgodnie z resztą pliku — pokrywają walidację
wejścia, nie integrację end-to-end przez HTTP). I.2 (częściowa awaria SMTP)
ma teraz pokrycie jednostkowe (FIX-7) ale wciąż brak testu PG z realnym,
zawodnym transportem — I.2 pozostaje CZĘŚCIOWO, nie podniesione tym dyżurem.
