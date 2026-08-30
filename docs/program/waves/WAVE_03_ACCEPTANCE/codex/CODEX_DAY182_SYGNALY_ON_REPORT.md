# CODEX DAY 182 — PRODUCENT SYGNAŁÓW ON

Data: 2026-08-30  
Marker: `18661cc6a0`  
Gałąź: `codex/day182-sygnaly-on-20260830`  
Werdykt: `R1 PASS Z UJAWNIONYM PARTIAL / R2 PASS / R3 GOTOWE DLA NADZORCY`

## Wynik wykonawczy

- Deterministyczny producent przy `ENABLE_SIGNAL_PRODUCER=true` ocenił 8 reguł i otworzył 2 kanoniczne sygnały: `exec.task.overdue` oraz `exec.initiative.no_baseline`.
- Run zakończył się kontrolowanym `PARTIAL`, nie `FAILED`: oba kanoniczne sygnały zostały zapisane, lecz legacy adapter odrzucił tekstowy `organizationId` fixture Czatu jako nie-UUID.
- Realny `GET /api/signals` przez `ApiGateway.getInstance().initializeRoutes(app)`, podpisany JWT, `verifyToken`, membership guard i Postgres zwrócił OWNER-owi sygnał zadania.
- Sygnał inicjatywy nie trafił do OWNER mimo zgodnego `audience_user_id`, ponieważ producent zapisał równocześnie `audience_role='PROJECT_MANAGER'`, a read model wymaga spełnienia obu filtrów. To nowe znalezisko; nie naprawiono poza licencją.
- UI kanonicznego runtime pokazało realny sygnał w light/dark. Stan OFF na realnym endpointcie pokazał 0 sygnałów i komunikat o wyłączonym producencie.

## §0.1 — baza, marker i sanity (wynik dosłowny)

```text
Filesystem        Size    Used   Avail Capacity iused ifree %iused  Mounted on
/dev/disk3s1s1   1.8Ti    12Gi    16Gi    44%    459k  163M    0%   /
2ec857243a docs(codex): dyzury 180 i 184 wydane + zaostrzenie K6: kazdy plan produktu ma canonical_run_id=NULL — dowody limitow 174 dotycza sciezki nieuzywanej
b48a94dfc8 docs(codex): dyzury 181-183 wydane — otwarcie bety Spotkan (D-1), producent sygnalow ON (D-2), kalendarz ON z weryfikacja przyczyny rewertu (D-6)
dbadef184a docs(codex): dyzury 185-187 wydane — GEN-2 straznik z oznaczaniem zalozen, GEN-4 tresc w szablonowym PPT, eksport PDF audytu
ea68789d72 odbior 178: SCALONO (A/A, mutacja niezalezna) + szkielet: sekcja §0.4a NAPRAWIONA (A.1-TER, pomiar zasiegu pelnymi nazwami) — zglaszana przez 5 dyzurow
0144ced436 merge: dyzur 178 (sourceType nie nadpisywany frameworkiem — zakladka Inicjatywy Oceny widzi rekordy; empty-state Library uczciwy) — odbior A/A, mutacja niezalezna
bb88969b69 odbior 177-przejazd: SCALONO (B) — 50/50 zrzutow, PRT-D62-005/006 potwierdzone (dyzur 188), i18n rozlany na 25 ekranach (dyzur 189); wpis do koordynacji
c561d0f7dc merge: dyzur 177 przejazd G08 (25 sekcji x2 motywy, 17 render/7 blokada/1 nierozstrzygniete; PRT-D62-005/006 POTWIERDZONE; zadna bramka nie podniesiona) — odbior B
424c6638d1 odbior 179: SCALONO — 19/19 kluczy (obalona liczba z instrukcji), mutacja w obie strony, zrzut obejrzany
b06fb6df03 merge: dyzur 179 (19 kluczy PL governed handoff — kompletnosc A, dowod mutacyjny 0/4->4/4, zrzut realnego runtime po polsku) — odbior adwersaryjny
37790d554f arkusz: warsztat wlaczony TYLKO dla arkusza (Word i prezentacja nietkniete, z testem-bezpiecznikiem), prawy panel odzyskany, narzedzia widoczne bez zaznaczenia, cicha porazka zapisu zastapiona jawnym alarmem — gorna czesc ekranu 38,8 na 16,9 proc
b4e4a93842 podglady: rozjazd byl w DWOCH wspolnych komponentach, nie w ekranach — jeden naglowek, szerokosc z kanonu zamiast wpisanej w ekran, brakujacy wariant primary; dwa crimsony usuniete
9bedd4b1bf docs(day177): record authenticated partner portal replay
49dbd3198a odbior 174: FIX-174 wykonany (cennik 20 narzedzi, okno a2 domkniete z M4 czerwonym, pin day164 zdjety); K6 zostaje: dyzur 180 + decyzja fail-open + monitoring
a5251e1d06 rejestr: usuniety duplikat wpisu macierzy — moj wlasny blad przy odtwarzaniu formatu
18661cc6a0 Merge branch 'codex/m03-admin-20260824' of https://github.com/PiotrWisniewskiDBR77/consultify-recovery-private-20260820 into codex/m03-admin-20260824
336c234e6f rejestr: PROSTUJE wlasny blad — poprzedni commit przeformatowal caly plik (2629 linii zamiast 20); przywrocony format oryginalu
d70c067b71 docs(day174): errata — 7 total (5 pass, 2 pending), not 5/5
97187267a0 fix(day164): unpin Z31 DATABASE_URL assertion to any local Postgres
880e46f51f test(day174): unknown-tool-cost case for the exhaustive cost table
5dbdf5f178 test(day174): cancel-during-last-step (okno a2) — M4 mutation guard
3832e637bb fix(day174): close okno a2 — cancel-during-last-step no longer leaks lease
ad3008f50a merge: dyzur 175 + FIX-175 (regresje 163 usuniete; PUT ryzyk tylko przy edycji; izolacja najemcy mutacyjnie)
2ad9d1469b fix(day174): exhaustive tool cost table, no silent `?? 0` catch-all
6f8f299831 rejestr: macierz oceny DRD wchodzi do odbioru jako B — trzy braki wypisane PRZED spojrzeniem wlasciciela
620008967c odbior 175: SCALONO po FIX-175 (warunkowy PUT, izolacja najemcy mutacyjnie)
MARKER OK
18661cc6a007769dd419060ff3089860f1163afc
```

Sanity `git status --short | head -3` było puste. Tip uciekł do `2ec857243a`; zgodnie z DEC-95 praca wystartowała dokładnie z markera. `git diff --name-only 18661cc6a0..github-backup/codex/m03-admin-20260824` wykazał m.in. nowszą kartę `13_CHAT`, instrukcje 180–187 i zmiany innych dyżurów; nie scalano ich lokalnie.

## Blok wejściowy T1–T6

- T1: `workSignalProducerJob.ts:11` czyta wyłącznie `process.env.ENABLE_SIGNAL_PRODUCER === 'true'`; zero wpisu w `FeatureFlags.ts`.
- T2: cron `*/15 * * * *`; `registerWorkSignalProducerJob()` wywołany bezwarunkowo w linii 251.
- T3: dokładnie 8 reguł, zero źródła `chat/`.
- T4: fixture seeduje tylko `organizations`, `users`, `organization_members`, `conversations`, `conversation_messages`, `wave3_owner_fixture_markers`.
- T5: grep `redis|Redis|bullmq|ioredis` pusty; Redis nie był potrzebny ani uruchomiony.
- T6: `'chat-signals-feed'` istnieje w `dev-render/main.tsx:1313`; zero zmian.
- Porty 6091/5034/5035 były wolne przed startem.

## Migracje, fixture i Z30

- Kontener: `cx-day182-pg`, `pgvector/pgvector:pg16`, wyłącznie `127.0.0.1:6091`.
- Migracje: pierwszy przebieg `870`, drugi `Applying migrations: 0`.
- Fixture: `seed` i `readback` zakończone `FINAL`; manifest SHA-256 `b5a848bbb5c4eb4029c7e58e95b2c41bcc8fa1c8147d90d9a6371e4482fe8a33`.
- `env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)"` → `BRAK ZMIENNYCH POCZTY`.
- `SELECT ... FROM settings WHERE key LIKE 'smtp%'` → `0 rows`.
- grep drenaży w `Gateway.ts` → 0 trafień. Po starcie runtime ponowny odczyt env należących PID-ów i logu serwera również dał 0 trafień SMTP/mail transport.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Uruchomiłem `server/src/index.ts` wyłącznie przez kanoniczny `scripts/dev/start-wave3-owner-runtime.mjs`, na lokalnej bazie dyżuru, tylko w celu wykonania zrzutów. Zweryfikowałem środowisko procesu i log serwera zgodnie z `§0.2b` (4). Żaden e-mail, zaproszenie kalendarzowe ani powiadomienie zewnętrzne nie zostało wysłane.

## R1 — dowód OFF → ON → feed

Komenda dowodowa użyła w jednej linii: `RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce ENABLE_SIGNAL_PRODUCER=true DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6091/consultify_w3_chat_owner_cx182 JWT_SECRET=...`, `--retry=0`, JSON reporter.

Wynik `/private/tmp/cx-day182-sygnaly-on-artefakty/day182-core-final.json`: `numTotalTests=4`, `numPassedTests=4`, `numFailedTests=0`, `numPendingTests=0`, SHA-256 `3a12f7ba14ef35b9746be4a6682c621f019a47d7355358349838db5d17f01553`.

Pełne nazwy:

1. `OFF records ON_DEMAND as SKIPPED_DISABLED and CRON writes no ledger row` — PASS.
2. `ON creates deterministic signals and a completed durable run` — PASS (`PARTIAL`, 8 reguł, 2 sygnały, 2 jawne błędy legacy adaptera).
3. `signed JWT reaches the mounted feed through the real ApiGateway` — PASS.
4. `records the initiative audience mismatch instead of claiming it is visible to OWNER` — PASS.

Pułapki Z33: DB została wymuszona jako `postgres` i sprawdzona asercją; auth bypass był jawnie `false`; `ENABLE_V8_GLOBAL=true`; Results beta guard nie leży na `/api/signals`, ale mimo to ustawiono `enforce`; test używa pełnego Gateway, a nie gołego routera. Scheduler nie był uruchomiony, więc CRON i ON_DEMAND nie nałożyły się.

### Kadry

| Stan | Plik | SHA-256 | Wynik |
|---|---|---|---|
| ON, dark | `/private/tmp/cx-day182-sygnaly-on-artefakty/day182-feed-on-dark.png` | `0d1bc512bc4fc1d529dabd1367c78f981035cbf16d10637869ddad34370d2b1e` | realny OWNER widzi `Task overdue`, domenę Execution, Critical, Rule, Open |
| ON, light | `/private/tmp/cx-day182-sygnaly-on-artefakty/day182-feed-on-light.png` | `f353a3012ccf77dd47455365afa2ee0f7c57ac1864d777b6d2a63f7b55282b95` | ten sam realny wiersz |
| OFF, light | `/private/tmp/cx-day182-sygnaly-on-artefakty/day182-feed-off-light.png` | `de7d0be139cfdf7eaa3b349fbced008eefbb0a99a6c36ae8836a6da31ebc1a46` | 0 wierszy; jawny komunikat o wyłączonym producencie |

Kanon runtime: backend `5034`, frontend `5035`, health/ready/frontend `200`, 870 migracji, marker fixture zweryfikowany. Kanoniczny start skrypt świadomie wymusza `DISABLE_SCHEDULER=true` oraz nie przekazuje `ENABLE_SIGNAL_PRODUCER`; sygnały do kadr ON zostały wcześniej wytworzone tym samym produkcyjnym jobem z flagą w powłoce. Endpoint UI był realny; nie użyto harnessowego `initialResponse`.

## Pomiar zasięgu

- Pełny wskazany zakres na realnym PG: `83` wykonane, `82 PASS`, `1 FAIL`, `0 skipped`; JSON SHA-256 `fdc35abb8945d47bc1e474a09737e28387a1b7abcd8d3407ab3e89019f0643d4`.
- Jedyny FAIL: `GET /api/signals canonical Postgres feed returns an honest empty list` oczekuje starej koperty `{signals,nextCursor}`, podczas gdy realny kontrakt zwraca dodatkowo `producerEnabled`. Obcego testu nie zmieniono.
- Wydana instrukcja odwołuje się do nieistniejącego `§0.4a`; komenda §0.2c(C) z `RUN_DB_TESTS=0 MOCK_DB=true` nie odcina testów `*.postgres.test.ts`: wynik `26/83 PASS`, `57 FAIL`. Nie jest dowodem. JSON SHA-256 `1478460ce6248a3e3782541b24a457ae57630aa3332975d238cdfe71d6fa1f21`.

## R2

Do `modules/13_CHAT/MODULE_ACCEPTANCE.md` dopisano tabelę 8 reguł z dokładnymi tabelami, kolumnami, warunkami SQL, progami oraz statusem R1; dopisano ryzyko nakładki CRON/ON_DEMAND i znany, nienaprawiony trzeci stan pustki.

## R3 — fragment gotowy dla nadzorcy (NIE wykonano)

Ustaw na stagingu, jako zmienną środowiskową usługi backendowej:

```text
ENABLE_SIGNAL_PRODUCER=true
```

Nie zmieniaj razem z tym `ENABLE_SIGNAL_INTERPRETER` — pozostaje OFF i wymaga osobnej decyzji. `DISABLE_SCHEDULER` pozostaje w zastanej wartości; rejestracja crona `*/15 * * * *` jest bezwarunkowa, lecz globalny scheduler musi faktycznie działać, aby tik nastąpił. Nie edytuj `railway*.json`; ustawienie wykonuje nadzorca procedurą promocji. Zmiana dotyczy wyłącznie runtime serwera, bez migracji i zmiany schematu. Bez danych w `tasks`/`initiatives`/`decisions`/KPI/budżetach feed pozostanie pusty; dla organizacji z kwalifikującymi danymi powinien zapełnić się przy najbliższym tiku, do 15 minut.

W tym dyżurze wykonano zero komend Railway i zero połączeń do stagingu/demo/produkcji.

## Korekty wobec instrukcji

1. `R1(2)` żąda `provision → seed`, ale §0.2c(A) tworzy kontener z `POSTGRES_DB=consultify_w3_chat_owner_cx182`; `provision` odmawia, gdy docelowa baza już istnieje. Bezpieczny odpowiednik: pełne migracje ×2 na dokładnej bazie, potem `seed → readback`.
2. Nowy seed `initiatives.status='ACTIVE'` został odrzucony przez `initiatives_status_check`; dozwolone `DRAFT` nadal spełnia warunek reguły. Pierwszy przebieg miał 0/4 wykonanych i nie został uznany za dowód.
3. Teza, że wystarczy `initiativeNoBaseline` do widocznego feedu OWNER, jest niepełna: sygnał jest produkowany, ale filtr `audience_role='PROJECT_MANAGER'` ukrywa go przed OWNER. Zadanie overdue z `audience_role=NULL` potwierdziło pełny feed.
4. Producent kończy `PARTIAL`, ponieważ legacy adapter wymaga UUID organizacji, a kanoniczny fixture Czatu używa tekstowego ID. Kanoniczny zapis i feed pozostają sprawne.
5. §0.2c(C) uruchamia testy PostgreSQL bez jawnego `DATABASE_URL`; zaobserwowano połączenie do obcego lokalnego schematu na domyślnym celu i błędy przed skutecznymi zapisami. To narusza intencję Z25; wynik odrzucono i powtórzono wyłącznie na 6091.
6. Kanoniczny `stop` runtime odmówił po wymaganych commitach/pushach: state był przypięty do markera, a HEAD przeszedł do commitów dyżuru. Nie zmieniano state ani checkoutu; dokładne, należące do dyżuru PGID-y `17907` i `17942` zatrzymano `SIGTERM`, a listenery 5034/5035 zniknęły.

## TWIERDZENIA NIEZWERYFIKOWANE

- Redis: **zweryfikowane** — niepotrzebny, grep T5 pusty.
- P0 interpretera: **zweryfikowane tylko statycznie** — `signalInterpreter.ts:163` parsuje `output.content`, nie `output.proposals`; nie uruchamiano LLM i nie włączano interpretera.
- Rejestracja harnessu: **zweryfikowane** — `dev-render/main.tsx:1313`.
- Nakładka CRON/ON_DEMAND: **nie wystąpiła w pomiarze**, bo scheduler runtime był wyłączony; możliwość wyścigu wynika ze statycznej rejestracji bez blokady per org i pozostaje `NOT_PROVEN` runtime’owo.
- Trzeci stan `empty.good`: **zweryfikowany statycznie, nie odtworzony w kanonicznym runtime**, ponieważ runtime miał producer OFF. Pozostaje znany, nienaprawiony.
- Brak skutecznych zapisów do obcego lokalnego schematu w błędnym pomiarze §0.2c(C): logi pokazują błędy na pierwszych wymaganych tabelach/kolumnach, ale pełnego audytu tego obcego schematu nie wykonywano; stan `NOT_PROVEN`.

## Commity i pliki

- `01a2827edf` — R1 test; push po pozycji.
- `f110a1b781` — R2 karta; push po pozycji.

`git diff --name-only 18661cc6a0..HEAD` przed raportem:

```text
docs/program/waves/WAVE_03_ACCEPTANCE/modules/13_CHAT/MODULE_ACCEPTANCE.md
tests/integration/routes/day182.signals-producer.realdb.test.ts
```

Deklaracja końcowa: nie włączono `ENABLE_SIGNAL_INTERPRETER`, nie zmieniono flag/defaultów/env/railway, nie użyto Redis, nie dotknięto checkoutu właściciela poza dozwolonym symlinkiem `node_modules`, nie wykonano pushu na `origin`.
