# Meetings dzień 10 — raport dyżuru 2026-08-25

Baza: `codex/m03-admin-20260824 @ 02a4f2fcde`  
Marker: `44ac9bba22` — POTWIERDZONY  
Gałąź robocza: `codex/meetings-day10-20260825`  
Worktree: `/private/tmp/consultify-meetings-day10`  
Porty użyte: `4302` (jednorazowy PostgreSQL); `4300/4301` dotąd nieużyte  
Kontener PG: `cx-day10-pg` (przebieg bazowy; usunięty: TAK)

## Oświadczenie o chronionym WIP (Z4/Z5)

Nie otwierałem, nie czytałem i nie kopiowałem katalogu
`/Users/piotrwisniewski/Developer/Consultify` — ani plików, ani diffów, ani gita.
Jedynym źródłem wymagań były rejestry i kod w izolowanym worktree. **TAK**

## Koordynacja — Blok 0

| Strumień               | Wynik                                                        | Konsekwencja                                                                                                |
| ---------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Dzień 6 / `b61255f514` | NIESCALONY                                                   | Nie konsumuję i nie dotykam szablonów agendy.                                                               |
| Quickfixy              | `3e6bee84eb` jest przodkiem m03; log `m03..quickfixes` pusty | B4/B5/B6/B8/K1–K4 już są w bazie; nie dubluję.                                                              |
| Baza instrukcji        | `b2888a9377` rozgałęziała się przed markerem                 | Przed pierwszym commitem przeniesiono sam commit instrukcji rebasem na `02a4f2fcde`; nowy SHA `1d17fdb88c`. |

## Warunki wstępne i korekty mapy

Marker jest przodkiem m03 i bieżącego HEAD. Materiały wiążące są kompletne:
ledger 110 linii, rejestr Meetings 102 linie, `DEC-58`, `DEC-07`,
`MYW-CAL-REC-001..003`, `MET-F-006` i evidence etap2 obecne.

Mapa instrukcji zestarzała się po quickfixach:

| Element                            | Instrukcja | Stan faktyczny |
| ---------------------------------- | ---------: | -------------: |
| `meeting.routes.ts`                |        591 |            601 |
| `meetingService.ts`                |        405 |            434 |
| `MeetingHub.tsx`                   |       1681 |           1732 |
| `MeetingObjectPage.tsx`            |        575 |            609 |
| asercje `toBe(410)` w golden-flows |          8 |             10 |

Pozostałe kluczowe fakty potwierdzone: trzy stare trasy nadal zwracają 410;
`MODULE_MEETING` pozostaje `closed`; pilot nadal blokuje `MODULE_MEETING`;
materializacja wskazuje `note.id`; Materials nadal używa
`sourceType: raw.originRuntime`; produkcyjnych wywołań legacy writers brak.

## D.1 — inwentarz martwoty

| Element                                    | Werdykt             | Dowód                                                   |
| ------------------------------------------ | ------------------- | ------------------------------------------------------- |
| `POST /:id/decisions`                      | MARTWE / 410 celowe | `meeting.routes.ts:310-322`                             |
| `POST /:id/follow-ups`                     | MARTWE / 410 celowe | `meeting.routes.ts:324-336`                             |
| `PATCH /:meetingId/follow-ups/:followUpId` | MARTWE / 410 celowe | `meeting.routes.ts:338-353`                             |
| `updateMeeting` zapisuje `decisions_json`  | MARTWE              | brak gałęzi w aktualizacji; zapis tylko w legacy writer |
| Produkcyjni konsumenci legacy writers      | BRAK                | `rg` zwraca tylko komentarz E2E i testy                 |
| Kontrakt 410                               | JEST                | 10 asercji `toBe(410)` w golden-flows                   |

## D.3 — strukturalne API

Nowe zasoby zachowują stare trasy 410 bez zmian:

| Grupa      | Trasy                                          | Happy/readback | 400  | 404 rekord | Obcy tenant |
| ---------- | ---------------------------------------------- | -------------- | ---- | ---------- | ----------- |
| decyzje    | GET/POST/PATCH/DELETE `/:id/decision-records`  | PASS           | PASS | PASS       | PASS        |
| follow-upy | GET/POST/PATCH/DELETE `/:id/follow-up-records` | PASS           | PASS | PASS       | PASS        |

Dowód behawioralny na realnym PostgreSQL:
`meeting.day10.records.routes.pg.test.ts` — **6/6 PASS**. Test przechodzi
przez realny router i realne serwisy; mockowana jest wyłącznie autoryzacja
parametryzowana nagłówkami. Pakiet golden-flows po zmianie: **49/49 PASS**,
bez modyfikacji pliku i z zachowaniem 10 asercji 410.

## B.1 — brief operatora

Wybrano wariant A: brief jest renderowany w istniejącej sekcji „Szczegóły”
kanonicznej karty, bez czwartej sekcji i bez zmiany gramatyki tras. Powierzchnia
rozróżnia dane, 404/brak oraz błąd 5xx z ponowieniem. Testy behawioralne:
`MeetingObjectPage.operatorBrief.test.tsx` — **4/4 PASS**; zastany pakiet
`MeetingObjectPage.test.tsx` — **9/9 PASS**. i18n `meeting.*`: PL 181 / EN 181,
parytet pełny. Status pozostaje **CZĘŚCIOWO** do czasu własnych zrzutów light/dark.

## G.1 — jedno źródło statusu modułu

Klient, pilot i serwer czytają teraz `BETA_MENU_STATUS.MODULE_MEETING`.
`MODULE_MEETING` nadal ma wartość **`closed`** i pozostaje skutecznie
zablokowany dla pilota. Zastany pakiet bramki przeszedł bez modyfikacji:
8/8 PASS; konsumenci pilota 4/4 PASS; trasy Meetings 26/26 PASS.

Instrukcja otwarcia dla nadzorcy: w `src/utils/betaAccess.ts` zmienić wyłącznie
`BETA_MENU_STATUS.MODULE_MEETING` z `closed` na `open`, następnie uruchomić
`meetingBetaGate.test.ts`, `pilotAccess.test.ts`, pakiet G.2 i golden-flows.
Otwarcie jest możliwe **jedną zmianą**. Zmiana nie została wykonana.

## G.2 — macierz ról

Status: **CZĘŚCIOWO**. Dzisiejszy stan `closed` ma 8/8 PASS w istniejącym
pakiecie. `createModuleGate` przyjmuje resolver statusu, więc stan `open` można
testować bez zmiany domyślnej, ale pełna macierz realnego routera
`rola × stan × ścieżka × tenant` nie została jeszcze wykonana.

## Testy stanu wyjściowego

| Pakiet                             | Przed                                       |
| ---------------------------------- | ------------------------------------------- |
| `src/components/Meeting/__tests__` | 27/27 PASS                                  |
| `meetingsCanonicalRoute.test.ts`   | 14/14 PASS                                  |
| `meetingService.test.ts`           | 13/13 PASS                                  |
| `meeting.routes.test.ts`           | 26/26 PASS                                  |
| `meetingBetaGate.test.ts`          | 8/8 PASS                                    |
| `tests/unit/meeting`               | 2/2 PASS                                    |
| `check-list-canon.sh`              | 404 naruszenia / baseline 404; brak wzrostu |
| świeży replay migracji             | 839 migracji, PASS                          |

## Pozycje otwarte — STOP-y do zatwierdzenia nadzorcy

### STOP — ścieżka API decyzji

Domyślne rozstrzygnięcie realizacyjne: nowy zasób `/decision-records`, bez
naruszania starego kontraktu 410. Przywrócenie `/decisions` wymagałoby jawnej
decyzji nadzorcy i osobnej zmiany pakietu golden-flows.

### STOP — wysyłka zaproszeń

Nie buduję wysyłki e-mail/ICS/Google/Outlook. Brakuje dostawcy i decyzji
`SET-INT-REC-001`; status zaproszenia może być wyłącznie stanem w bazie.

### STOP — semantyka edycji serii

Domyślnie seria + wyjątki; pełna semantyka „to i następne” wymaga jawnego
potwierdzenia. Nie powstanie kontrolka bez kompletnej operacji backendowej.

### STOP — handoff automatyczny vs decyzja człowieka

Domyślnie osobna, świadoma decyzja człowieka; akceptacja notatki sama nie
tworzy zadań w My Work ani Initiatives.

### STOP — legacy JSON po backfillu

Domyślnie źródła `decisions_json` i `attendees_json` pozostają nietknięte,
a nowe API czyta model strukturalny. Ich usunięcie lub zmiana znaczenia jest
poza zakresem addytywnym.

## Migracje

### D.2 — `20260826_meetings_day10_decisions.sql`

| Właściwość                 | Wynik                                                                                                                |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Addytywność                | TAK: wyłącznie `CREATE ... IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, indeksy i `INSERT ... ON CONFLICT DO NOTHING` |
| Klucze obce                | ZERO                                                                                                                 |
| Źródło legacy              | `meetings.decisions_json` pozostaje nietknięte                                                                       |
| Deduplikacja               | unikat `(organization_id, meeting_id, source_kind, coalesce(source_note_id,''), source_index)`                       |
| Pełny replay (1)           | 840 migracji, PASS                                                                                                   |
| Pełny replay (2)           | `Applying migrations: 0`, PASS                                                                                       |
| Dry-run (3)                | `Pending migrations: 0`, PASS                                                                                        |
| Ręczny replay backfillu 2× | drugi przebieg `INSERT 0 0`                                                                                          |
| Tenant probe               | org A: 2 decyzje, org B: 1; zapytanie A→meeting B: 0                                                                 |
| Docker                     | kontener usunięty, wolumen `cx-day10`: brak                                                                          |

Deklaracja: **IDEMPOTENCJA_PEŁNA**.

## Znaleziska niezmieniane

- B6 i pozostałe quickfixy są własnością nadzorcy i już znajdują się w bazie.
- `calendar_events` nie zapisuje strefy czasowej.
- Materials preferuje runtime zamiast `originSummary.sourceType`.
- Tryb `?sampleData=materials-vnext` podmienia dane.
- Heurystyka szkicu ukrywa tytuły zawierające `test/smoke/probe/E2E`.
