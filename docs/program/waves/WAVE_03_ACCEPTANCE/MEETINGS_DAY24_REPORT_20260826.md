# Meetings dzień 24 (blok 3) — raport dyżuru 20260826

Baza: `codex/m03-admin-20260824` @ `c7647e9a23`  
Marker: `POTWIERDZONY`  
Gałąź: `codex/meetings-day24-20260826`  
Worktree: `/private/tmp/consultify-meetings-day24`  
Port PG: `5497` · obraz: `pgvector/pgvector:pg16` · kontener `cx-day24-pg` usunięty: `TAK` · wolumeny usunięte: `TAK`

## Oświadczenie o chronionym checkoutcie (Z5/DEC-86)

Chroniony checkout `/Users/piotrwisniewski/Developer/Consultify` nie był czytany ani zmieniany. Jedyny kontakt to dozwolony symlink `node_modules` używany do odczytu zależności. Cała praca powstała w `/private/tmp/consultify-meetings-day24`.

## Dowód celu połączenia (Z19/DEC-96)

```text
 current_database | inet_server_port
------------------+------------------
 cx_day24         |             5432
(1 row)
```

Każda komenda testu DB miała w tej samej linii: `DATABASE_URL="postgres://postgres:cx@localhost:5497/cx_day24" RUN_DB_TESTS=1 NODE_ENV=test MOCK_DB=false` (oraz `DB_TYPE=postgres`).

## Warunki wstępne

| Warunek                     | Wynik                                                                                  |
| --------------------------- | -------------------------------------------------------------------------------------- |
| Marker                      | `MARKER OK`; HEAD wejściowy `a6c4605ca9` z instrukcją na markerze                      |
| Dzień 16 + FIX-1..9         | PASS: serwisy, migracja `20261075`, `blocked_demo`, strażnicy `not.toHaveBeenCalled()` |
| Dzień 19 + FIX-1..4         | PASS: realne cancellation, retry precondition i migracja `20261090`                    |
| Ledger                      | 180 linii zamiast oczekiwanych 177; DEC-87/92/98/108/111 obecne i zgodne               |
| Migracje bazowe             | `851 / 0 / 0` (pierwszy / drugi / dry-run)                                             |
| Namespace 20261150-20261159 | pusty; nie utworzono migracji                                                          |
| `idx_tasks_idempotency_org` | obecny na świeżej bazie                                                                |
| Inwentarz tras              | 31 przed zmianą; pozycja F dodaje jedną trasę                                          |
| Baseline §0.4a              | `228/229 PASS`, `0 SKIPPED` przed pierwszym commitem                                   |
| Anonim 401/200              | errata potwierdzona: mounted-auth z `MOCK_DB=false` ma `22/22 PASS`, anonim `401`      |

## Pozycje — tabela zbiorcza

| Pozycja                   | Status        | Commit               | Dowód                                                                                                                                                |
| ------------------------- | ------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| A (macierz G.2)           | `NIE_ZACZĘTE` | —                    | Nie powstało 75 behawioralnych komórek; nie deklaruję macierzy na podstawie przewidywań.                                                             |
| B (13 tras + tenant)      | `NIE_ZACZĘTE` | —                    | Nie powstały dwa wymagane pakiety 13×4 ani neutralizacja filtrów.                                                                                    |
| C (DST)                   | `CZĘŚCIOWO`   | `908ec7434d`         | RealPG `2/2` w `TZ=UTC` i `2/2` w `TZ=Europe/Warsaw`; brak osobnego pomiaru `recurrenceId` bez strefy.                                               |
| D (`materialTitle`)       | `CZĘŚCIOWO`   | `908ec7434d`         | Oba odczyty używają `getArtifactForUser`, lista cache'uje unikalne artifactId; brak wymaganego pakietu 6 testów i odtworzenia wycieku przed naprawą. |
| E (bramka occurrence)     | `CZĘŚCIOWO`   | `908ec7434d`         | RealPG `4/4`: twórca PATCH 200/DELETE 403, uczestnik 404/403 bez zmian, admin 200, obcy tenant 404; brak pełnych 8 testów i osobnego spy wysyłki.    |
| F (funnel My Work)        | `CZĘŚCIOWO`   | `908ec7434d`         | RealPG `5/5`: zapis+readback, replay, błędy, tenant/rola, concurrency; brak pełnych 8 osobnych przypadków i udowodnionej listy UI My Work.           |
| G (częściowa awaria SMTP) | `NIE_ZACZĘTE` | —                    | `meetingInvitationService.ts` ma pusty diff, ale nie powstał wymagany test real-router/PG z lokalnym mockiem mailera.                                |
| R.1                       | `CZĘŚCIOWO`   | następny commit docs | Dodano atomowy wpis wyłącznie o faktycznie dowiezionym zakresie, bez podnoszenia owner gate.                                                         |

## A — macierz dostępu

`75/75 NIEZMIERZONE`. Stan `open` nie został zasymulowany dla pełnej macierzy. Moduł pozostał `closed`. Instrukcja przyszłego otwarcia nie jest przedstawiana jako wykonana: po zmianie `src/utils/betaAccess.ts:53` nadzorca musi uruchomić kolejno `meetingBetaGate`, pełną macierz real-router/PG, pakiet tenant-negatives, wszystkie testy §0.4a i dopiero ocenić flip. Zmiana nie otwiera frontu ani nie zmienia `BETA_ADMINS_EXEMPT`; cofnięcie to przywrócenie `'closed'`.

## B — pokrycie 13 tras

`NIE_ZACZĘTE`. Nie wykonano dowodu mutacyjnego przez neutralizację filtrów. Istniejące pakiety real-PG pozostały zielone, ale nie są przedstawiane jako substytut wymaganego 13×4.

## C — DST

| Kierunek   | recurrenceId               | UNTIL oczekiwany i zmierzony | Wynik |
| ---------- | -------------------------- | ---------------------------- | ----- |
| CEST → CET | `2026-11-01T08:00:00.000Z` | `20261101T075959Z`           | PASS  |
| CET → CEST | `2027-04-04T07:00:00.000Z` | `20270404T065959Z`           | PASS  |

Oba przebiegi przeszły identycznie przy `TZ=UTC` i `TZ=Europe/Warsaw`. Wariant bez jawnej strefy nie został zmierzony; decyzja C.4: `(b) test+errata`, bez zmiany kontraktu wejściowego. Kod `recurrenceEngine.ts` nietknięty.

## D — materialTitle

Oba odczyty (`getMeetingNote`, `listMeetingNotesForMeeting`) przyjmują opcjonalne `userId`/`roleKey`; router przekazuje realnego użytkownika. Brak dostępu lub brak kontekstu użytkownika daje `materialTitle: null`; `materialArtifactId` zostaje jako identyfikator bez renderowalnej treści. Lista używa `Map<artifactId, Promise<title|null>>`, więc rozwiązuje tylko unikalne niepuste identyfikatory. Wołający poza routerem pozostali kompatybilni dzięki parametrom opcjonalnym. Brakuje pomiaru spy `N/K/K`, więc status jest `CZĘŚCIOWO`.

## E — bramka occurrence

| Rola × trasa            | Kod     | Zmiana DB                                    |
| ----------------------- | ------- | -------------------------------------------- |
| USER twórca × PATCH     | 200     | TAK                                          |
| USER twórca × DELETE    | 403     | NIE                                          |
| USER uczestnik × PATCH  | 404     | NIE                                          |
| USER uczestnik × DELETE | 403     | NIE                                          |
| ADMIN × PATCH/DELETE    | 200/200 | TAK; cancellation odczytane jako `cancelled` |
| obcy ADMIN × DELETE     | 404     | NIE                                          |

Podział jest celowy: PATCH ma tę samą dotkliwość co PUT i zachowuje DEC-58 (admin lub twórca); DELETE jest destrukcyjny i wysyła CANCEL, więc wymaga `requireMeetingAdmin`. `PATCH /:id/status` nie dostał i nadal nie ma `requireMeetingAdmin`.

## F — funnel My Work

Trasa: `POST /api/meeting/:id/notes/:noteId/action-items/:index/task`. Klucz `meeting-note-action:<noteId>:<index>`, źródło `meeting_note_action_item`, sourceId `<meetingId>:<noteId>:<index>`. `projectId` jest przekazywany wyłącznie, gdy jest UUID; inaczej `null`. Sekwencyjny replay i dwa równoległe wywołania zostawiają dokładnie jeden wiersz. Readback potwierdził `tasks.source_type/source_id`. Nośnikiem jest istniejący `idx_tasks_idempotency_org`; migracji brak. Ostatnie ogniwo listy My Work nie zostało udowodnione, dlatego `CZĘŚCIOWO`. Initiatives: `BRAK_API`, ponieważ `createInitiativeService` nie przyjmuje idempotencyKey i jest poza licencją dyżuru.

## G — częściowa awaria SMTP

`NIE_ZACZĘTE`. Diff `meetingInvitationService.ts` jest pusty. Nie ustawiano `MEETING_INVITES_LIVE`, `SMTP_HOST` ani `SMTP_USER`; zero realnych wysyłek.

## Kontrakt dla frontu

| Trasa                                         | Metoda | Body                           | Odpowiedź                                                          | Błędy                                                               | Co front ma pokazać                                           |
| --------------------------------------------- | ------ | ------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------- | ------------------------------------------------------------- |
| `/:id/notes`                                  | GET    | —                              | `materialTitle` może być `null` przy nie-null `materialArtifactId` | 401/403/404                                                         | Link tylko gdy tytuł jest dostępny; brak tytułu = brak linku. |
| `/:id/occurrence`                             | PATCH  | `recurrenceId, scope, changes` | dotychczasowy wynik occurrence                                     | 404 dla uczestnika nie-twórcy                                       | Nie ujawniać istnienia spotkania.                             |
| `/:id/occurrence`                             | DELETE | `recurrenceId, scope`          | wynik + deliveries                                                 | 403 dla nie-admina                                                  | Pokazać odmowę roli; nie sugerować odwołania.                 |
| `/:id/notes/:noteId/action-items/:index/task` | POST   | brak dodatkowego body          | `{task:{id,title,status}, replayed}`                               | 403, 404 `ACTION_ITEM_NOT_FOUND`, 409 `NOTE_NOT_APPROVED`/collision | Utworzone albo już utworzone wg `replayed`.                   |

## Migracje

Brak migracji. Świeży PG potwierdził `idx_tasks_idempotency_org`; namespace `20261150`–`20261159` pozostał pusty.

## Testy — pomiar §0.4a (Z23)

Baseline: `228/229 PASS`, `0 SKIPPED`.  
Finalny zakres §0.4a + nowe testy: `239/240 PASS`, `0 SKIPPED`.

- czerwone ZASTANE: `src/components/Meeting/__tests__/MeetingObjectPage.test.tsx` — 1 test, brak `Ship v2` (ten sam objaw przed zmianami);
- czerwone WPROWADZONE: brak;
- SKIPPED z powodu env: brak;
- nowe testy Day24: `11/11 PASS`;
- `ZASIĘG CZĘŚCIOWY`: nie powstały wymagane pakiety A/B/G oraz pełne pakiety DoD D/E/F.

## Errata i korekty

1. Anonim `401`, nie `200`, gdy `MOCK_DB=false`; wcześniejsze `200` było artefaktem harnessu.
2. Potwierdzono świadomy brak `requireMeetingAdmin` na PATCH status; nie cofnięto DEC-58.
3. Idempotencja F opiera się na `idx_tasks_idempotency_org`, nie na indeksie follow-upów.
4. `20261124+` nie użyto; przydział 20261150–20261159 pozostał pusty.
5. Ledger ma 180, nie 177 linii — oczekiwana rozbieżność rosnącego rejestru.

## STOP-y i braki

### STOP — A/B/G oraz pełne DoD D/E/F

Powód: nie ukończono wymaganych pakietów dowodowych; nie wolno zastępować ich częściowymi przebiegami ani zawyżać statusu.  
Dowód: brak wymaganych nazw plików A/B/G oraz liczniki w tabeli zbiorczej.  
Co dalej: dopisać dokładnie pakiety z instrukcji na tym samym lokalnym modelu bezpieczeństwa i ponowić pełny pomiar.  
Stan: kod częściowy zacommitowany w `908ec7434d`; brak atrap i brak skutków zewnętrznych.

## Bezpieczniki — dowody

- Z5: tylko symlink zależności;
- Z10: pusty diff `src/utils/betaAccess.ts`; moduł `MODULE_MEETING: 'closed'`;
- Z16: pusty diff `artifactRegistryService.ts`, `recurrenceEngine.ts`, effective access;
- Z17: `meetingInvitationService.ts`, `meetingDay16Service.ts`, `TaskService.ts` nietknięte;
- Z18: pusty diff globalnej infrastruktury testowej;
- DEC-65: zero Railway, zdalnych DB/migracji, deployów i realnych e-maili;
- `meetingInvitationService.ts`: pusty diff;
- `src/**`: pusty diff.

## Licznik

8 pozycji: 0 `ZROBIONE_WG_DoD`, 5 `CZĘŚCIOWO`, 3 `NIE_ZACZĘTE`. Moduł NIE został otwarty.

## Czego NIE zrobiłem i dlaczego

Nie otworzyłem modułu, nie zmieniłem frontu, nie uruchomiłem Railway/deployu/zdalnej bazy, nie utworzyłem migracji, nie wysłałem e-maila i nie dotknąłem strażników dnia 16. Nie przedstawiam częściowych testów jako pełnej macierzy lub pełnego DoD.
