# CODEX — DYŻUR 105 — SPOTKANIA — DECYZJA

Stan: **PRZYCZYNA USTALONA / DEFEKT ODTWORZONY / NOT FIXED**. Naprawa komponentu jest poza licencją i nie została wprowadzona.

## 0. Tożsamość i stan wejściowy

- Dokument: `WYDANY`, odczytany w całości: `701 z 701` linii.
- Marker publikacji podany w zleceniu: `74a1d733e9` = `docs(day105-108): trzecia partia — decyzja Spotkan, os czasu, karta Insight, jezyk`.
- Marker bazy z wydanej instrukcji: `5b29e4ec1b2f6180f4006be1f06ca1ebe3597f02`.
- Gałąź: `codex/day105-spotkania-decyzja-20260829`.
- Worktree: `/private/tmp/cx-day105-spotkania-decyzja`.
- Zasoby wyłączne: PostgreSQL `5986`; runtime `4870/4871`.
- Wolne miejsce: `60 GiB` (`60 GiB >= 5 GiB`).
- Porty przed startem: `5986 WOLNY`, `4870 WOLNY`, `4871 WOLNY` (`3 z 3`).

### Wynik markera — dosłownie

```text
74a1d733e9 docs(day105-108): trzecia partia — decyzja Spotkan, os czasu, karta Insight, jezyk
5b29e4ec1b docs(ledger): DEC-335..336 — warunki 1 i 2 stagingu zamkniete, zastrzezenie dev-render
86af83c7a6 fix(flags): orgRedesignV1 fail-CLOSED i domyslnie OFF do czasu odbioru wizualnego
2fdbecfaf4 merge: dyzur day102 — day102-wycena-500
6010daac4f merge: dyzur day101 — day101-spotkania-odbior
51f42bf613 merge: dyzur day100 — day100-mojapraca-odbior
0d331e2599 merge: dyzur day98 — day98-notatnik-spec-a
b7ce79bb08 docs(day101): record owned runtime cleanup evidence
05f7f7096b docs(day98): bind corrected clean dark screenshot
a25cedb828 docs(day100): record owned runtime cleanup
ebc0cc38c4 docs(day102): record owned database cleanup
dacdc89027 docs(day101): record Meetings owner visual acceptance
c9a94c0457 docs(day100): record My Work owner review packet
63192bd3b0 test(finance): diagnose valuation gateway 500
e9814fd34e feat(notebook): adopt SPEC-A shell behind default-off flag
a20e3304e2 merge: odblokowanie seedera Narzedzi — bootstrap wlasciciela + organization_members
9f72faab38 merge: dyzur 99 — kreatory 53 z 53, DoD od 3/16 do 9/16
467dada60d fix(wave3-tools-seed): add organization_members row for the fixture owner
57a396a146 docs(ledger): DEC-333..334 — SPEC-A zmierzone wzrokiem, powloka OK, tresc karty pusta
7f389636ed merge: dyzur 95 — DoD 6/16, 5/16, 3/16; dokument twierdzil 'niemal gotowe'
45cf12f7de docs(day99): record owned runtime cleanup
3afc15dc51 docs(day98,100,101,102): druga partia — Notatnik, Moja Praca, Spotkania, wycena 500
146e6f7caf merge: dyzur 97 — zasadny STOP, wykonal poprawke nadzorcy, uniewaznil wlasne robocze oceny
e87cb11fa4 merge: dyzur 96 — zasadny STOP, 0 z 12 zrzutow, wykryl zamek seedera
32f896d041 docs(day99): record creator visual acceptance evidence
MARKER OK
```

### Wynik sanity worktree — dosłownie

```text
5b29e4ec1b2f6180f4006be1f06ca1ebe3597f02
```

`git status --short | head -3` nie zwrócił żadnej linii (`0 z 3` możliwych linii), czyli worktree był czysty.

### Rozejście marker–tip

`1 z 1` commitów ponad marker jest wyłącznie dokumentacyjny:

```text
74a1d733e9 docs(day105-108): trzecia partia — decyzja Spotkan, os czasu, karta Insight, jezyk
```

Dotyczy `4 z 4` instrukcji dni 105–108; scalenie pozostaje po stronie nadzorcy.

## 1. Kontrakt seedera — 4 z 4 przed kontenerem

1. Seeder: `scripts/dev/seed-wave3-meetings-owner-review.mjs` (`plik:1-15`).
2. Baza powstaje w `provision(url, dbName)` przez `CREATE DATABASE` (`plik:60-63`), pod komendą CLI `provision` wybieraną w `main()` (`plik:145`). W tym dyżurze kontener otrzymuje bazę już przez `POSTGRES_DB`, więc nie wywołuję `provision`; pełny runner migracji wykonuję zgodnie z §0.2c(A).
3. W ścieżce `provision` migracje wykonuje `server/scripts/migrate.postgres.ts` przez `spawnSync` (`plik:62`). W ścieżce dyżuru ten sam runner uruchamiam jawnie dwa razy z kompletem env.
4. Seeder **zakłada** właściciela i członkostwo: `INSERT INTO users` oraz `INSERT INTO organization_members` (`plik:105-123`, dokładne inserty `:111`). Nie ma pułapki zamka SELECT-only.

Strażnik nazwy bazy: prefiks `consultify_w3_meetings_owner_` (`plik:29`) i walidacja loopback/nazwy (`plik:50-57`); `consultify_w3_meetings_owner_day105` pasuje `1 z 1`.

## 2. Z30 — protokół przed pierwszym zapisem

Dowód (a), środowisko powłoki:

```text
BRAK ZMIENNYCH POCZTY
```

Dowód (c), `grep -n "startNotificationOutboxDrainCron\|outboxWorker\|platformOutboxDrainCron" server/src/Gateway.ts`: `0` trafień.

Dowód (b), po pełnych migracjach i ponownie bezpośrednio przed runtime:

```text
 key | left
-----+------
(0 rows)
```

Runtime uruchomiono wyłącznie przez `scripts/dev/start-wave3-owner-runtime.mjs` w trybie `adopt-existing`. Manifest potwierdza `DOTENV` isolation, brak kluczy zabronionych w `5 z 5` procesów grup i lokalne współrzędne `127.0.0.1:5986`, `4870/4871`. Log uczciwie pokazuje start trzech domyślnych drenaży, ale procesy nie miały żadnego klucza `SMTP_*`, `RESEND`, `SENDGRID`, `MAIL*` ani `EMAIL_LIVE_SEND`; po pomiarze `notification_outbox`, `rvn_platform_outbox` i `case_workspace_event_outbox` miały odpowiednio `0/0/0` wierszy. W logu było `0` trafień na próbę SMTP/SendGrid/Resend, realny transporter, wysłany e-mail, zaproszenie lub powiadomienie.

**Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.**

Powyższa deklaracja dotyczy testów i seedera. Dla zrzutów obowiązuje osobna deklaracja:

**Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Uruchomiłem `server/src/index.ts` wyłącznie przez kanoniczny `scripts/dev/start-wave3-owner-runtime.mjs`, na lokalnej bazie dyżuru, tylko w celu wykonania zrzutów. Zweryfikowałem środowisko procesu i log serwera zgodnie z `§0.2b` (4). Żaden e-mail, zaproszenie kalendarzowe ani powiadomienie zewnętrzne nie zostało wysłane.**

## 3. B.1 — fixture i readback

- Migracje: pierwszy przebieg `863/863`, zakończony `✅ Postgres migrations complete`; drugi przebieg `0/863` nowych, również zakończony bez błędu.
- Fixture readback: `3/3` governed notes, `5/5` person, prezentacja `12` uczestników, `2` załączniki, `1` recurrence.
- Zatwierdzony rekord: `note_status=approved`, `proposal_state=materialized`, `receipt_count=1`, `decided_by=w3-mtg-admin-user-v1`.

Niezależny SQL, wynik dosłownie:

```text
         meeting_id         | note_status |                 decisions_json                  | proposal_state |      decided_by      |               decision_reason                | receipt_count
----------------------------+-------------+-------------------------------------------------+----------------+----------------------+----------------------------------------------+---------------
 w3-mtg-approved-meeting-v1 | approved    | [{"decision":"Pilot after readiness evidence"}] | materialized   | w3-mtg-admin-user-v1 | Manual note and readiness condition reviewed |             1
(1 row)
```

Pierwsze zapytanie diagnostyczne omyłkowo wskazało `p.decisions_json`; PostgreSQL uczciwie zwrócił `column p.decisions_json does not exist` i podpowiedział `n.decisions_json`. Poprawiony pomiar powyżej jest wiążący.

## 4. B.2 — objaw odtworzony 2 z 2 drogami

### 4.1 Test jednostkowy

Komenda miała `RUN_DB_TESTS=0 MOCK_DB=true` i `--retry=0`. Wynik: `8/9 PASS`, dokładnie jeden fail:

```text
MeetingObjectPage Decyzje i działania section shows meeting decisions and follow-ups
Error: Unable to find an element with the text: Ship v2.
```

Pułapki Z33 (a)–(e): pakiet jest czysto jsdom i mockuje `Api` w `MeetingObjectPage.test.tsx:59-71`; nie montuje Gateway, nie dotyka DB ani auth, więc (a)–(e) nie leżą na jego ścieżce. To dowód renderowania, nie dowód egzekucji HTTP.

### 4.2 Realny ekran

Kanoniczny runtime na SHA `8e6cb526cd19d86ca9997965fae35e75f9090dde`: health `200`, ready `200`, frontend `200`, `863/863` migracji, realny login OWNER. Ekran spotkania `Customer pilot readiness — approved minutes` pokazał pustą listę i `Decisions 0`, mimo SQL z decyzją i receipt `1/1`.

Wspólny dowód „ekran + SQL”:
`/private/tmp/cx-day105-spotkania-decyzja-artefakty/day105-screen-plus-sql.png`
SHA-256 `9fe4de34152b0ec5d51670123297ed11a188ee7a5029f60459e206d84ecf2800`.

Konsola przeglądarki po pomiarze: `0` błędów i `0` ostrzeżeń.

## 5. B.3 — gdzie decyzja ginie, 4 z 4

### 5.1 Czy trasa zwraca decyzję? TAK, ale tylko trasa notes

Wszystkie cztery żądania przeszły przez realny `ApiGateway` (`server/src/Gateway.ts:474`, montaż `/api/meeting` `:761`), realny `verifyToken` i lokalny PostgreSQL; każde zwróciło HTTP `200`.

`GET /api/meeting/w3-mtg-approved-meeting-v1`:

```json
{"meeting":{"id":"w3-mtg-approved-meeting-v1","title":"Customer pilot readiness — approved minutes","decisions":[],"followUps":[]}}
```

`GET /api/meeting/w3-mtg-approved-meeting-v1/notes`:

```json
{"notes":[{"status":"approved","decisions":[{"decision":"Pilot after readiness evidence"}],"actionItems":[]}]}
```

`GET /api/meeting/w3-mtg-approved-meeting-v1/decision-records`:

```json
{"decisions":[]}
```

`GET /api/meeting/w3-mtg-approved-meeting-v1/follow-up-records`:

```json
{"followUps":[]}
```

Trasa notes czyta governed notes w `server/src/routes/meeting.routes.ts:1034-1055`. Trasa decision-records wywołuje osobny serwis w `:656-668`, który pyta wyłącznie `meeting_decisions` (`server/src/services/meetingService.ts:640-649`).

Pułapki Z33: (a) wyłączona przez `ENABLE_V8_GLOBAL=true`; (b) ustawiono `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`; (c) runtime manifest potwierdza PostgreSQL `127.0.0.1:5986` i `863` migracje; (d) `ENABLE_TEST_AUTH_BYPASS=false`, `NODE_ENV=development`, login OWNER; (e) nie wystąpiła, wszystkie odpowiedzi miały HTTP `200` i zapisane ciała.

### 5.2 Czy komponent ją dostaje? TAK

`MeetingObjectPage` równolegle woła `loadNotes`, `loadDecisionRecords` i `loadFollowUpRecords` (`src/components/Meeting/MeetingObjectPage.tsx:539-547`). `loadNotes` zapisuje zatwierdzoną decyzję do stanu `notes` (`:316-327`), zaś `loadDecisionRecords` zapisuje pustą kopertę do odrębnego stanu `decisionRecords` (`:362-376`).

### 5.3 Czy komponent ją filtruje? NIE po statusie ani dacie; pomija cały magazyn

Zakładka Minutes mapuje `note.decisions` (`MeetingObjectPage.tsx:681-729`). Zakładka Decisions & actions przechodzi wyłącznie po `decisionRecords` (`:774-815`, mapowanie `:817+`). Nie istnieje warunek statusu/daty odrzucający ten rekord — `notes` nie są w ogóle konsumentem tej sekcji.

### 5.4 Czy to rozjazd nazw pól? NIE jako literówka; TAK jako rozjazd źródeł

Zatwierdzona decyzja jest trwale w `meeting_notes.decisions_json`. Kontrakt materializacji jawnie mówi, że decyzje z note **nie są** osobno materializowane do tabel decyzji (`server/src/services/meetingBoundary/meetingBoundaryService.ts:767-786`). Tymczasem section czyta zasób `meeting_decisions`. Rekord przestaje istnieć dla zakładki na granicy selekcji źródła: `notes` są pobrane, ale `decisionsContent` ich nie łączy.

## 6. B.4 — produkt

Werdykt: **przyczyna ustalona; naprawa niewprowadzona zgodnie z §B.4 i §D**.

Dodano dokładnie `1 z 1` dozwolony nowy plik testu:
`src/components/Meeting/__tests__/MeetingObjectPage.approvedDecision.contract.test.tsx`.

Nagłówek zawiera `// CZERWONY Z ZAŁOŻENIA — nie regresja tego dyżuru`. Kontrakt używa realnego kształtu: approved note zawiera `Pilot after readiness evidence`, a `decision-records` jest puste. Wynik `0/1 PASS`; pełna nazwa:

```text
MeetingObjectPage approved governed decision contract shows an approved note decision in Decisions & actions when decision-records is empty
```

Rekomendacja dla osobnej decyzji naprawczej: w `decisionsContent` zbudować jawny, deduplikowany model odczytu łączący approved governed note decisions z `meeting_decisions`, zachowując provenance i read-only charakter wpisów z note. Nie kopiować ich automatycznie do `meeting_decisions`, bo kontrakt `meetingBoundaryService.ts:767-786` jawnie tego zabrania. Promień: `MeetingObjectPage.tsx`, DTO/model prezentacyjny i focused tests; bez zmiany modelu uprawnień, Gateway ani materializacji.

## 7. Pomiar zasięgu i regresji

Samodzielny `rg` znalazł `5/5` plików testowych odwołujących się do `MeetingObjectPage` (w tym nowy kontrakt). Wykonano:

- pakiety czysto jednostkowe: `28/28` nazw przypadków uruchomionych, `26 PASS`, `2 FAIL`; oba faile są wymienione pełnymi nazwami powyżej, `--retry=0`;
- istniejący pakiet `meeting.decision-follow-up-records.postgres.integration.test.ts`: `0/16` nazw wykonanych, `16/16 SKIP`, suite FAIL w `beforeAll` na `res.body.meeting.id` (`plik:88`). DB identity w logu: `127.0.0.1:5986/consultify_w3_meetings_owner_day105` (`2/2` wypisy).

Pakiet integracyjny mockuje auth i montuje router w gołym `express()` (`plik:35-57`, `:78-80`), więc Z22 zabrania używać go jako dowodu produkcyjnej ścieżki. Pułapka (c) była wyłączona jawnym kompletem env i potwierdzoną DB identity; (a), (b), (d) są zasłonięte przez mock auth/router; (e) nie dotyczy, bo pakiet nie montuje Gateway. Jego `0/16` jest zastanym defektem pakietu, nie PASS i nie dowodem Day105.

Łączny mianownik wykrytego zasięgu: `44` nazw; wykonane `28/44`, PASS `26/44`, oczekiwane czerwienie `2/44`, niewykonane `16/44`. Porównanie odbyło się po `fullName`, nie po samych liczbach.

## 8. Artefakty poza repo

- `migrate-1.log` — `cd98011641ca1e3e3e3a5e03c77327d4d22a725afbd0eeeb152398a6c870d174`
- `migrate-2.log` — `c1651dd1763480d22e906d747082b3744dbfdb3392b7c63134f691072680606d`
- `day105-meetings-manifest.json` / `readback.json` — `8240d34540a627e50a6c10fb054c0b7fe6201fdd04549d4bdfac86fc8ef4b0e4`
- `approved-decision-sql.txt` — `5d071603ec2b0452547af34fdd085981f26a5248e0beb858ea64dc601d63f2c7`
- `meeting-object-baseline.json` — `25e9eb5c206fc3670c600de51d5b63cd56f9904077f27bdf0ab00b39a53be4b6`
- `approved-decision-contract-red.json` — `cebb37155eebb9d919e4133271bfc6f14fc5211e68d44f97421d413d32f93a81`
- `meeting-impacted-unit.json` — `0607edef4279dfc1d61bf60a1bea250d2658bb7a7ba996461c6bd14f0c444716`
- `meeting-records-integration.json` — `f2ac05c8ad7e733e320b1a85f37214f7ff60e07af3cdba3b628fc0ef038c74f3`
- `runtime-start.json` — `319165813e4cdf01c7247801fd1eb463c3df6ab153ccd14e90796ad4f50f41e5`
- `runtime-stop.json` — `045f9f3910b0b6ea1a71c584f9733ba7d2007d8b64fb9eecc9a5ecdbb55efc12`
- `http-notes.json` — `48764473c1927b2df61d260cf43eea17181bd8bf6ad33558af7453b2c2f382be`
- `http-decision-records.json` — `422428b889260cb0c98537dbc35df3f6d617224568aefec05f4421cc472a80f8`
- `day105-screen-plus-sql.png` — `9fe4de34152b0ec5d51670123297ed11a188ee7a5029f60459e206d84ecf2800`

Artefakt logowania zawierający token został usunięty po wykonaniu czterech GET; token nie trafił do repo ani raportu.

## 9. Sprzątanie zasobów wyłącznych

- Kanoniczny `stop`: `ownedProcessGroupsOnly=true`, `processGroupsVerifiedTerminated=true`, baza zachowana do niezależnego sprawdzenia, porty `4870/4871` wolne (`2/2`).
- Po potwierdzeniu obecności dokładnie `1` bazy dyżuru usunięto wyłącznie kontener i wolumen `docker rm -fv cx-day105-pg`.
- Końcowo kontener `cx-day105-pg` nie istnieje (`0` trafień), port `5986` jest wolny. Nie dotknięto cudzych kontenerów, portów ani baz.

## Korekty wobec instrukcji

- Wiadomość zlecająca nazywa `74a1d733e9` markerem, natomiast §0.1 wydanej instrukcji nazywa markerem bazy `5b29e4ec…`. Historia rozstrzyga role bez improwizacji: `74a1d733e9` publikuje instrukcje, a `5b29e4ec…` jest jego bezpośrednim przodkiem i bazą kodu. Worktree utworzono dokładnie z `5b29e4ec…`.
- Z24 odwołuje się do `§0.4a`, a tabela STOP do „tabeli licencji”, lecz wydany dokument ma `701/701` linii i nie zawiera ani `§0.4a`, ani tabeli licencji. Bezpieczna interpretacja: §D jest zamkniętą licencją zapisu; zasięg zmierzono samodzielnie przez pełny `rg` i porównanie `fullName`. Brak dokumentu nie poszerzył zapisu.
- Instrukcja twierdziła, że test fixture `decisions: ['Ship v2']` odpowiada utracie zatwierdzonej decyzji. Pomiar wykazał precyzyjniejszy kontrakt: bieżąca ścieżka governed przechowuje decyzję w approved note, a legacy `meeting.decisions` jest celowo puste. Dlatego istniejąca czerwień potwierdza objaw UI, ale nowy kontrakt Day105 wiąże go z rzeczywistym źródłem.

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie zweryfikowano, która dokładna reguła deduplikacji i provenance ma obowiązywać przy połączeniu governed note decisions z ręcznymi `meeting_decisions`; wymaga to decyzji produktowej przed naprawą.
- Nie zweryfikowano tabletu, PL, alternate theme, keyboard/a11y ani właścicielskiego retestu po naprawie, bo naprawa nie należała do dyżuru.
- Nie zweryfikowano `16/16` przypadków istniejącego pakietu real-PG: suite padł w `beforeAll`, a wszystkie przypadki zostały pominięte.
