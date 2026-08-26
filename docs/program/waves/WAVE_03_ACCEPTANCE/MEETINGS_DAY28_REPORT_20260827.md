# Meetings dzień 28 (blok 4) — raport dyżuru 2026-08-27

Baza porównawcza: `codex/m03-admin-20260824` @ `fed3b9d85568057773a514f96fff3c37f190094a`  
Marker: **POTWIERDZONY** (`git merge-base --is-ancestor ...` → exit 0, `MARKER OK`)  
Gałąź: `codex/meetings-day28-20260827`  
Worktree: `/private/tmp/consultify-meetings-day28`  
PG: port 5507, `pgvector/pgvector:pg16`; kontener `cx-day28-pg` usunięty: TAK; wolumeny usunięte: TAK.

## Oświadczenie o chronionym checkoutcie (Z5/DEC-86)

Nie czytałem ani nie zapisywałem chronionego checkoutu. Jedyny kontakt to dozwolony symlink `node_modules` używany do odczytu zależności. Praca i wszystkie zapisy odbyły się w `/private/tmp/consultify-meetings-day28`.

## Dowód celu połączenia (Z19/DEC-96)

Komenda przed pomiarami DB:

```text
docker exec cx-day28-pg psql -U postgres -d cx_day28 -c "SELECT current_database(), inet_server_port();"
 current_database | inet_server_port
------------------+------------------
 cx_day28         |
(1 row)
```

Puste `inet_server_port()` wynika z połączenia `docker exec` po unix socket; wszystkie testy miały jawne `DATABASE_URL=postgres://postgres:cx@localhost:5507/cx_day28 DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false` w tej samej linii.

## Weryfikacja erraty §1.2

1. POTWIERDZONY: `cutover` wpływa na `this` i `this_and_following`; pomiar A wykazał różnicę 1 h.
2. POTWIERDZONY: brak klienta `recurrenceId` w `src/`; literały pozytywne miały `Z`.
3. POTWIERDZONY: `RRULE_UNTIL_RE` dopuszczał brak `Z`; zaostrzono.
4. POTWIERDZONY: `materializeInstances` ma konsumenta wyłącznie w My Work.
5. POTWIERDZONY: przed testami dwa trafienia `materialTitle`, brak konsumenta w `src/`.
6. POTWIERDZONY: produkcyjny handler to `server/src/utils/ErrorHandler.ts::errorHandlerMiddleware`; test E montuje właśnie go.
7. POTWIERDZONY: `emailService` czyta `settings`; `smtp_%` = 0.
8. POTWIERDZONY: ICS emituje UTC `Z` i nie został zmieniony.
9. POTWIERDZONY: 32 trasy, plik wejściowy 1299 linii.
10. POTWIERDZONY: 17 kształtów klienta, 15 tras bez konsumenta.
11. POTWIERDZONY: `meetings.start_at` ma typ `TEXT`; pozostawiono jako znalezisko.
12. POTWIERDZONY: zero użyć effective-access w routerze Meetings.
13. POTWIERDZONY: ledger ma 192 linie, DEC-134 występuje raz.
14. POTWIERDZONY: najwyższa migracja `20261123`, namespace `20261170–79` pusty.

## Warunki wstępne

| Warunek      | Wynik                                                                                                                                                          |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Blok 3       | merge `e6e923d441`; `908ec7434d`: 6 plików, 675 insercji                                                                                                       |
| Migracje     | 854 / 0 / dry-run pending 0                                                                                                                                    |
| Tabele       | meetings recurrence, materializations, invitation deliveries i artifacts istnieją                                                                              |
| Idempotencja | `idx_tasks_idempotency_org` istnieje                                                                                                                           |
| SMTP DB      | `SELECT count(*) ... smtp_%` → 0                                                                                                                               |
| Namespace    | brak plików `2026117*`                                                                                                                                         |
| Moduł        | `MODULE_MEETING: 'closed'`                                                                                                                                     |
| Fetch        | `origin` i `github-backup` pobrane; martwy lokalny remote `icloud-source=/private/tmp/consultify-staging-deploy-e6ca` zwrócił błąd i jest korektą środowiskową |

Tip `codex/m03-admin-20260824` ma trzy commity po markerze (`f6a712ab3c`, `1dd29f29b0`, `936842bd16`) dotyczące Tools Insights; zgodnie z DEC-95 nie zostały włączone.

## Inwentarz endpointów i konsumentów

|   # | Metoda i ścieżka                                   | Router | Konsument `src/`             |
| --: | -------------------------------------------------- | -----: | ---------------------------- |
|   1 | GET `/`                                            |    268 | `src/services/api.ts:3538`   |
|   2 | GET `/:id`                                         |    301 | `api.ts:3549`                |
|   3 | POST `/`                                           |    312 | `api.ts:3554`                |
|   4 | PUT `/:id`                                         |    365 | `api.ts:3563`                |
|   5 | GET `/:id/participants`                            |    417 | BRAK KONSUMENTA              |
|   6 | POST `/:id/participants`                           |    432 | BRAK KONSUMENTA              |
|   7 | PATCH `/:id/participants/:participantId`           |    471 | BRAK KONSUMENTA              |
|   8 | DELETE `/:id/participants/:participantId`          |    511 | BRAK KONSUMENTA              |
|   9 | POST `/:id/invitations/send`                       |    532 | BRAK KONSUMENTA              |
|  10 | DELETE `/:id`                                      |    567 | `api.ts:3572`                |
|  11 | PATCH `/:id/status`                                |    582 | `api.ts:3583`                |
|  12 | GET `/:id/decision-records`                        |    614 | `api.ts:3635`                |
|  13 | POST `/:id/decision-records`                       |    629 | `api.ts:3645`                |
|  14 | PATCH `/:id/decision-records/:decisionId`          |    651 | `api.ts:3659`                |
|  15 | DELETE `/:id/decision-records/:decisionId`         |    678 | `api.ts:3674`                |
|  16 | GET `/:id/follow-up-records`                       |    695 | `api.ts:3686`                |
|  17 | POST `/:id/follow-up-records`                      |    710 | `api.ts:3696`                |
|  18 | PATCH `/:id/follow-up-records/:followUpId`         |    731 | `api.ts:3716`                |
|  19 | DELETE `/:id/follow-up-records/:followUpId`        |    766 | `api.ts:3731`                |
|  20 | POST `/:id/decisions`                              |    783 | BRAK KONSUMENTA (legacy 410) |
|  21 | POST `/:id/follow-ups`                             |    797 | BRAK KONSUMENTA (legacy 410) |
|  22 | PATCH `/:meetingId/follow-ups/:followUpId`         |    811 | BRAK KONSUMENTA (legacy 410) |
|  23 | POST `/:id/generate-notes`                         |    853 | `api.ts:3598`                |
|  24 | GET `/:id/notes`                                   |    997 | `api.ts:3609`                |
|  25 | POST `/:id/notes/:noteId/decision`                 |   1031 | `api.ts:3620`                |
|  26 | POST `/:id/notes/:noteId/materialization/retry`    |   1080 | BRAK KONSUMENTA              |
|  27 | POST `/:id/notes/:noteId/action-items/:index/task` |   1111 | BRAK KONSUMENTA              |
|  28 | GET `/:id/attachments`                             |   1155 | BRAK KONSUMENTA              |
|  29 | POST `/:id/attachments`                            |   1174 | BRAK KONSUMENTA              |
|  30 | DELETE `/:id/attachments/:attachmentId`            |   1211 | BRAK KONSUMENTA              |
|  31 | PATCH `/:id/occurrence`                            |   1297 | BRAK KONSUMENTA              |
|  32 | DELETE `/:id/occurrence`                           |   1301 | BRAK KONSUMENTA              |

Razem: **32 trasy; 17 z klientem, 15 bez konsumenta**.

## Pozycje

| Pozycja | Status          | Commit         | Dowód skrócony                                                                        |
| ------- | --------------- | -------------- | ------------------------------------------------------------------------------------- |
| A       | ZROBIONE_WG_DoD | `38492486af`   | 6/6 w UTC i 6/6 Warszawa; readback i zero mailera po odmowie                          |
| B       | ZROBIONE_WG_DoD | `78e7b2ecd1`   | 4/4 w obu TZ; niezależna siatka `rrule` + Luxon                                       |
| C       | CZĘŚCIOWO       | `e201c1a60f`   | 6/6 real PG; brak dowodu dokładnego K wywołań i odpowiedzi retry z tytułem            |
| D       | ZROBIONE_WG_DoD | `4334ad463b`   | osiem przypadków w 4 testach; readback, spy mailera; oba mutanty czerwone             |
| E       | CZĘŚCIOWO       | `b299a809c8`   | 9 przypadków w 7 testach; race i realny handler; brak testu ostatniego ogniwa My Work |
| F       | STOP            | —              | nadrzędne polecenie użytkownika: mail wyłącznie `captured`; nie ustawiono live        |
| R.1     | ZROBIONE_WG_DoD | `5324a2d763`   | atomowy wpis, moduł nadal closed                                                      |
| R.2     | ZROBIONE_WG_DoD | commit raportu | ten plik                                                                              |

## A — strefa w recurrenceId

Pomiar przed naprawą:

| Scope                | `TZ=UTC`                   | `TZ=Europe/Warsaw`         | Różnica |
| -------------------- | -------------------------- | -------------------------- | ------: |
| `this`               | `2026-11-01T08:00:00.000Z` | `2026-11-01T07:00:00.000Z` |     1 h |
| `this_and_following` | `UNTIL=20261101T075959Z`   | `UNTIL=20261101T065959Z`   |     1 h |

Po naprawie wymagany jest sufiks `Z` albo `±HH:MM`; brak strefy daje `400 INVALID_OCCURRENCE`. Strażnika w serwisie nie dodano, aby nie dublować kontraktu routera. `UNTIL` date-time bez `Z` daje `400 INVALID_RECURRENCE_RULE`; date-only nadal jest zgodne z dotychczasowym kontraktem.

## B — DST związany z siatką

Mutant +1 h przed zmianą testu: **2/2 PASS**, co potwierdziło, że test sprawdzał własną formułę. Nowa siatka powstaje z `rrule` jako lokalny kalendarz tygodniowy, a wall-clock jest niezależnie mapowany na `Europe/Warsaw` przez Luxon. Jesień: okazja `2026-11-01T08:00:00.000Z`; wiosna: `2027-04-04T07:00:00.000Z`. Instant spoza siatki z jawnym `Z` nadal daje `200`; proponowany przyszły kontrakt to `404 RECURRENCE_NOT_FOUND`. Nie zbudowano walidacji siatki (Z16 i nowa funkcja poza zakresem).

## C — materialTitle

Realny router/PG: własny prywatny artefakt zwraca tytuł; po zmianie `owner_user_id` tytuł jest `null`, a identyfikator zostaje; brak materializacji daje oba pola `null`; obcy tenant i brak spotkania zwracają 404 bez tytułu. Tymczasowe cofnięcie resolvera zapaliło test revocation (`Restricted board pack` zamiast `null`); po przywróceniu 6/6 PASS. Retry przekazuje `userId: materializedBy, roleKey:'owner'`.

Ostatnie ogniwo = koperta HTTP `res.json({notes})`; brak konsumenta `materialTitle` w `src/`. Braki DoD: nie zmierzono spy'em dokładnie K wywołań oraz nie zbudowano pełnego udanego retry zwracającego tytuł — status pozostaje CZĘŚCIOWO.

## D — bramka occurrence

Pakiet pokrywa ADMIN PATCH/DELETE, twórcę USER PATCH/DELETE, uczestnika nietwórcę PATCH/DELETE i obcy tenant obie trasy. Odmowy zachowują wiersz i nie wołają `sendMeetingInvitations`. Mutant bez bramki DELETE zapalił 2 testy; mutant bez bramki PATCH zapalił 1 test. `PATCH /:id/status` i serwis zaproszeń mają pusty diff.

## E — funnel

Pakiet obejmuje approved, replay, proposed, rejected, zły indeks, USER, obcy tenant, projekt bez członkostwa i wyścig. Produkcyjny handler `server/src/utils/ErrorHandler.ts` zwraca `403`, a kod jest pod `error.code='AUTHORIZATION_ERROR'`. Wyścig jest serializowany przez `pg_advisory_xact_lock(hashtext(org),hashtext(idempotencyKey))` w tej samej transakcji co pre-read i `TaskService`; wyniki to dokładnie `[false,true]`, jeden wiersz.

Ostatnie ogniwo My Work nie ma osobnego testu odczytu w tym commicie; znane zapytania konsumenckie istnieją w `server/src/routes/my-work*.ts`, ale nie deklaruję DoD bez testu. Initiatives = `BRAK_API`: instrukcja zabrania rozszerzenia `createInitiativeService`.

## F — STOP

### STOP — F

Powód: polecenie użytkownika ogranicza wysyłkę wyłącznie do trybu `captured`, a scenariusz awarii częściowej wymaga wejścia w gałąź live nawet przy lokalnym mocku.  
Dowód: `MEETING_INVITES_LIVE` nie było ustawione w komendach; `settings smtp_% = 0`.  
Co zrobiłbym po odrębnej zgodzie: lokalny mock `emailService.send`, `smtp.example.invalid`, trzy scenariusze z readbackiem obu tabel.  
Stan: NIE ZACOMMITOWANO.

## Kontrakt dla frontu

| Trasa                          | Metoda       | Body                                                     | Odpowiedź                                   | Błędy                                                   | Front                                                      |
| ------------------------------ | ------------ | -------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------- |
| `/:id/occurrence`              | PATCH/DELETE | `recurrenceId` wyłącznie ISO z `Z` lub `±HH:MM`; `scope` | istniejąca koperta occurrence               | `400 INVALID_OCCURRENCE`, `400 INVALID_RECURRENCE_RULE` | pokaż błąd formatu; nie wysyłaj local datetime bez offsetu |
| `/:id/notes`                   | GET          | —                                                        | `materialArtifactId`, `materialTitle:string | null`                                                   | 404                                                        | gdy tytuł `null`, nie renderuj linku; dziś brak konsumenta |
| `.../action-items/:index/task` | POST         | opcjonalny projekt z meeting                             | `task`, `replayed`                          | 403 `error.code=AUTHORIZATION_ERROR`                    | `replayed=true` oznacza istniejące zadanie po serializacji |

## Migracje

BRAK. Wszystkie wymagane obiekty istniały na świeżej bazie; namespace `20261170–79` pozostał pusty.

## Pomiar testów Z23 — pełny zakres §0.4a

**257/258 PASS, 1 FAIL, 0 SKIPPED; ZASIĘG PEŁNY.** Dodatkowo nowe dowody: A 6/6 w UTC i 6/6 w Warszawie; C 6/6.

Czerwone ZASTANE: `src/components/Meeting/__tests__/MeetingObjectPage.test.tsx` — 1 FAIL, brak tekstu `Ship v2` (cały pakiet frontendowy 30 PASS / 1 FAIL). Potwierdzone przed pierwszym commitem i po ostatnim.  
Czerwone WPROWADZONE: brak.  
SKIPPED: 0.  
Osłabione/usunięte asercje: brak. W plikach dnia 24 zmieniono wyłącznie konstrukcję niezależnej siatki B oraz dodano asercje/spy D i przypadki E.

Per pakiet końcowy: boundary 22; meeting services 10; day10 6; day19 5; cancel 3; retry 1; golden 49; records 16; DST 4; gate 4; funnel 7; My Work 14; routes 32; meetingService 13; invite unit 2; ICS 10; beta gate 8; meeting unit 2; TaskService unit 5; Meeting UI 30/31; canonical route 14.

## Dowód braku atrapy i bezpieczniki

Odmowy A/D/E mają niezależne SELECT-y przed/po i zero wywołań mailera tam, gdzie skutek był możliwy. F nie weszło w live. Nie użyto Railway, zdalnej bazy, SMTP ani push.

Końcowe bramki wymagają pustego diffu dla `src/**`, effective access, recurrence engine, artifact registry, invitation service, email service, ICS builder, TaskService, ErrorHandler, globalnych mocków/configów i torów e2e/acceptance. Moduł pozostaje `closed`.

Sprzątanie: `docker rm -f cx-day28-pg` usunęło kontener; wymagane przez instrukcję `docker volume prune -f` usunęło anonimowy wolumen PG dyżuru `6f45c3a...` oraz drugi wcześniej nieużywany anonimowy wolumen `7fb62b7c...` (prune nie zapewnia odzyskania).

## Znaleziska

- `start_at TEXT` nadal dopuszcza wall-clock bez strefy w tworzeniu/edycji spotkania; poza zakresem.
- 15/32 tras nie ma konsumenta frontowego.
- Serwer akceptuje jawnie zonowany `recurrenceId` spoza realnej siatki; przyszła walidacja wymaga osobnej decyzji.
- C nie ma pełnego licznika K resolvera ani udanego retry-title proof.
- E nie ma testu końcowego odczytu zadania przez My Work.

## Licznik i gotowość

8 pozycji: **5 ZROBIONE_WG_DoD / 2 CZĘŚCIOWO / 1 STOP / 0 BRAK_API / 0 NIE_ZACZĘTE**.  
Gotowość: **TECHNICAL_PARTIAL**. Moduł nadal `closed`; zero push i zero wysyłek rzeczywistych.
