# Dyżur 100 — Moja Praca — pakiet odbioru właściciela

Data: 2026-08-29  
Gałąź: `codex/day100-mojapraca-odbior-20260829`  
Marker: `8c7a853a6cb82c9b498210049c5487ea033caa9b`  
Werdykt: `PARTIAL / OWNER_REVIEW_POSSIBLE_FOR_3_OF_5_SURFACES / NOT_ACCEPTED`

## 1. Tożsamość i stan wejściowy

Wynik markera, dosłownie:

```text
MARKER OK
```

Wynik sanity, dosłownie:

```text
8c7a853a6cb82c9b498210049c5487ea033caa9b
```

`git status --short | head -3` nie wypisał żadnej linii. Dysk przed startem:
`45 GiB` wolne. Porty `5983`, `4862` i `4863` nie miały listenerów ani
kontenera dyżuru. Tip `github-backup/codex/m03-admin-20260824` był przed
startem o 16 commitów przed markerem; zgodnie z §0.1 pracowałem dokładnie z
markera. Lista rozjazdu i lista 14 ścieżek są w logu sesji; nie scalałem tipa.

Korekta właściciela: marker z bloku wklejki `188cb75f...` był błędny. Wiążący
jest marker z wydanej instrukcji `8c7a853a...`.

Trasa frontendowa: `src/routes/routeConfig.ts:56` — `/my-work`. Montaż backendu:
`server/src/Gateway.ts:201,1036` — `myWorkRoutes` pod `/api/my-work`.

## 2. Kontrakt seedera — 4 z 4 przed kontenerem

1. Seeder leży w `scripts/dev/seed-wave3-my-work-owner-review-owned.mjs`.
   W1 pokazało także starszy wariant bez `-owned`; wariant owned ma strażnik
   lokalnego hosta i nazwy bazy (`:38-53`) oraz marker własności (`:187-193`).
2. Tworzenie bazy jest w `provision()` (`:67-119`), uruchamiane komendą
   `provision` przez dispatch `main()` (`:430-439`).
3. `provision()` uruchamia `npm run db:migrate:strict` (`:78-82`). W tym dyżurze
   wiążący §0.2c utworzył bazę przez kontener i uruchomił runner migracji dwa
   razy przed seedem.
4. Seeder zakłada organizacje, użytkowników i membershipy: `INSERT INTO
   organizations` (`:194-197`), `INSERT INTO users` (`:205-208`) oraz
   `INSERT INTO organization_members` (`:209-212`). Nie występuje zamek
   `SELECT` bez `INSERT`.

## 3. B.1 — fixture i readback

- migracja 1: `863 z 863` zastosowanych, `Postgres migrations complete`;
- migracja 2: `0 z 863` nowych, `Postgres migrations complete`;
- licznik SQL po migracjach: `863 z 863` wierszy successful;
- SMTP w bazie przed startem runtime: `0 z 0` wierszy `settings.key LIKE
  'smtp%'`;
- próba seed 1 z 3: FAIL — `node` nie rozwiązał importu `.js` wskazującego na
  plik TypeScript;
- próba seed 2 z 3 przez `tsx`: fixture zapisany; `readback` zielony;
- readback: `1 z 1` pełnego łańcucha, `5 z 5` person, proposal
  `MATERIALIZED`, receipt `SUCCEEDED`, task źródłowy `in_progress`, granice:
  self `409`, MEMBER `403`, revoked `403`, foreign `404`, stale `409`, stale
  CAS writes `0`.

Defekt tylko do odczytu: `provision/reset` po udanych 863 migracjach wypisuje
`n is not defined`, ponieważ `n` powstaje wewnątrz `try` (`:101-108`), a jest
używane poza blokiem (`:112-119`). Nie zmieniałem seedera. Baza została jednak
utworzona i zmigrowana; następujące `seed` oraz niezależne `readback` przeszły.

Pułapki §0.2d: (a) `ENABLE_V8_GLOBAL=true`; (b)
`RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`; (c) `MOCK_DB=false` i
`DB_TYPE=postgres`; (d) `ENABLE_TEST_AUTH_BYPASS=false`; (e) wykluczony przez
jawne inserty użytkowników i organizacji. Seeder montuje goły `express()` i
nie jest dowodem produkcyjnej osiągalności; zrzuty wykonano później przez pełny
kanoniczny runtime i realne logowanie.

## 4. Z30 i runtime

Przed zapisem `env` zwrócił `BRAK ZMIENNYCH POCZTY`; grep Gateway nie znalazł
drenaży. Po migracjach oraz po starcie runtime zapytanie SMTP dało `0 z 0`
wierszy. Kanoniczny runtime zakwalifikował: health `200`, ready `200`, frontend
`200`, dokładny SHA serwera/klienta, `863 z 863` migracji, SQL marker i brak
zakazanych kluczy środowiskowych w `5 z 5` procesów grupy. Log uczciwie pokazuje,
że lokalne drenaże outboxów wystartowały; nie miały konfiguracji transportu i
nie wykonano operacji tworzącej wiadomość.

**„Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie
zawiera wierszy konfiguracji SMTP. Uruchomiłem `server/src/index.ts` wyłącznie
przez kanoniczny `scripts/dev/start-wave3-owner-runtime.mjs`, na lokalnej bazie
dyżuru, tylko w celu wykonania zrzutów. Zweryfikowałem środowisko procesu i log
serwera zgodnie z `§0.2b` (4). Żaden e-mail, zaproszenie kalendarzowe ani
powiadomienie zewnętrzne nie zostało wysłane.”**

## 5. B.2 — macierz 20 zrzutów

Powierzchnie wybrane z realnego menu przed pierwszym zrzutem: **Ideas,
Notebook, Inbox, Tasks, Decisions**. Pełny stan to OWNER
`w3-myw-owner-user-v2`; pusty stan to foreign OWNER z osobnej organizacji.
Motywy przełączono realnym sterowaniem Light/Dark w menu profilu.

Pliki: `20 z 20`. Semantycznie zgodne z etykietą stanu: `16 z 20`. Cztery
pliki `ideas-full-*` i `notebook-full-*` są poprawnymi obrazami, ale pełny stan
jest nieosiągalny, bo readback SQL wykazał `ideas=0` i `notebook_pages=0`.
Nie relabelowałem ich.

| # | Zrzut | Obserwacja wzrokowa |
|---:|---|---|
| 1 | `ideas-full-light.png` | EN nagłówki i wartości; 0 rekordów; brak liczb/kwot/dat; brak ucięć; brak UUID; uczciwy empty, ale nie pełny fixture; crimson pill Model. |
| 2 | `ideas-full-dark.png` | Jak #1; dark czytelny; brak nachodzenia; 0 rekordów; niesemantyczny crimson Model. |
| 3 | `ideas-empty-light.png` | EN; liczniki 0 spójne z foreign DB; pusty stan uczy i ma CTA; brak UUID/ucięć; crimson Model. |
| 4 | `ideas-empty-dark.png` | Jak #3; dark czytelny; brak surowych kluczy; crimson Model. |
| 5 | `notebook-full-light.png` | EN; tabela i All/Personal/Organization = 0; brak dat/UUID; pusty mimo etykiety full, zgodny z SQL 0; crimson Model. |
| 6 | `notebook-full-dark.png` | Jak #5; dark czytelny; empty card nie nachodzi; crimson Model. |
| 7 | `notebook-empty-light.png` | EN; 0/0/0 spójne; zamierzony pusty stan; brak dat/UUID i ucięć; crimson Model. |
| 8 | `notebook-empty-dark.png` | Jak #7; dark czytelny; crimson Model. |
| 9 | `inbox-full-light.png` | EN; ALL 2 i dwa wiersze spójne z SQL `inbox=2`; brak UUID; wartości `Just now`, bez polskiego formatu dat; brak ucięć; crimson Model. |
| 10 | `inbox-full-dark.png` | Jak #9; dark czytelny; wszystkie 2 wiersze widoczne; crimson Model. |
| 11 | `inbox-empty-light.png` | EN; ALL 0 i brak wierszy spójne; komunikat uczciwy, ale nie rozróżnia braku zakresu; brak UUID/ucięć; crimson Model. |
| 12 | `inbox-empty-dark.png` | Jak #11; dark czytelny; crimson Model. |
| 13 | `tasks-full-light.png` | EN; All 1 i jeden widoczny `Review pilot`; SQL ma 2 tasks, drugi materialized nie jest przypisany OWNER; brak UUID/dat; prawy fragment menu `Run agent` ucięty; crimson Model. |
| 14 | `tasks-full-dark.png` | Jak #13; dark czytelny; ucięcie menu pozostaje; crimson Model. |
| 15 | `tasks-empty-light.png` | EN; All 0 i uczciwy empty z CTA; brak UUID/dat; `Run agent` ucięty; crimson Model. |
| 16 | `tasks-empty-dark.png` | Jak #15; dark czytelny; ucięcie menu i crimson Model. |
| 17 | `decisions-full-light.png` | EN; All 1 i jeden `Approve pilot`, spójne z SQL; `0d waiting` zamiast polskiej daty; `Client Vault` i `0d waiting` ucięte; brak UUID; crimson Model. |
| 18 | `decisions-full-dark.png` | Jak #17; dark czytelny; oba ucięcia pozostają; crimson Model. |
| 19 | `decisions-empty-light.png` | EN; liczniki 0 i uczciwy empty; `Client Vault` ucięty; brak UUID/dat; crimson Model. |
| 20 | `decisions-empty-dark.png` | Jak #19; dark czytelny; ucięcie i crimson Model. |

Wspólny wniosek językowy: nagłówki i wartości są po angielsku `20 z 20`; nie
zaobserwowano mieszaniny języków w pojedynczej tabeli, ale nie jest to odbiór PL.
Format kwot: `NIE DOTYCZY 20 z 20`; jawne daty kalendarzowe nie wystąpiły,
a względne `Just now` / `0d waiting` są EN. Surowe UUID: `0 z 20`. Widoczne
ucięcia: `8 z 20` (Tasks i Decisions). Crimson poza semantyką krytyczną:
`20 z 20` (pill Model; dodatkowo znak 77).

Artefakty leżą poza repo w
`/private/tmp/cx-day100-mojapraca-artefakty`. SHA-256 wszystkich PNG:

```text
8d54095202358bc4d843221668d30eb5b8b3c0ba9159128b21c166b496aa4d38 decisions-empty-dark.png
a7a80d1229a4947de78761b30ad6200c329057ca31a4f89aa54ace94d749d287 decisions-empty-light.png
2127e448af46268b58a305b9af0383229d903c2ad48a3d372b03741eeeff4f39 decisions-full-dark.png
08e10aa6d5ec4d4f9a177943768046ea0f5394371c526309d7db450f66f5f334 decisions-full-light.png
4e4e58338d1bf0e15b3adb44baee37fbcc673e640135109377df4a29b8b08442 ideas-empty-dark.png
5c323dfabd891c2674fdedfb8bf2dcb4df349b19a41fb599dd3a6f16d5daf2e6 ideas-empty-light.png
241bb8f469b35d6bebeedda76f17b82d489718c92081a751ed5842de0a34a93b ideas-full-dark.png
85254e873e1492dae4422509d73b61808e21eae953017277ec33690fdc8ee1cf ideas-full-light.png
9a19937275fbb1c99c9e49e327ba75fdc984b09a77ac4b30ba46244bbec3b030 inbox-empty-dark.png
7045609fc283005bd42fd71f5c88591785d385b7123f1d9921cbabe467d6051a inbox-empty-light.png
0c33da7e4384b84a5364a63453c8327d5d7a0e0ba04ee4633957bc05694e7cbe inbox-full-dark.png
2fd5e8bb7d17b66b9164ce18077026d19bf8238029bed1c2d8e1519f60174e11 inbox-full-light.png
bc7d6604a734b18155beefb09e2faeacef768ac2cac47f63186c21a0fbb71b6f notebook-empty-dark.png
018761ce36ede742107a2afd659401f55e089ae9bd0d436548fcb9e8f7c8d878 notebook-empty-light.png
8de147a348710f451f851d6927e6f97c0dac15ab19cc657a46ee0f7d188e49e2 notebook-full-dark.png
95feb0b1b6d22016250d837015f33f85d6e5b08acac521c8e1ea5773fe50fffe notebook-full-light.png
250fde3d4a3567e3a4bc79e3a0d42e49a2a7938c1906f0de015ab5c25f15c8a9 tasks-empty-dark.png
bd75ce8ed49bca58ed148e03487ddc4d49301c029abfd18d6cf409cea8b01000 tasks-empty-light.png
81bc728f744bbf8f912f2864c60707c302bc5efcbb3ada5e115d2ff0b597a113 tasks-full-dark.png
0b2e843f556baba0abf0c8106e3ae51aa19131f4a1b39a06fbc5300496b9f4be tasks-full-light.png
```

## 6. DoD §18.1 — 3 z 16

| # | Wynik | Dowód |
|---:|---|---|
| 1 | NIE | Jest breadcrumb i jeden primary, ale brak kompletnego lifecycle/save/index kontraktu Menu 1. |
| 2 | TAK | Wspólna powłoka pozostaje spójna na pięciu powierzchniach i dwóch motywach. |
| 3 | NIE | Prawy panel z wymaganą kolejnością sekcji nie występuje. |
| 4 | NIE | Powiązania first-class nie są widoczne. |
| 5 | TAK | Stały przycisk AI/sparkles jest w prawym obszarze nagłówka. |
| 6 | NIEZWERYFIKOWANE | Nie otwierano rekordu ani guardu niezapisanych zmian. |
| 7 | TAK | Puste stany nie udają sukcesu i uczą lub wyjaśniają brak danych. |
| 8 | NIE | Light/dark są czytelne, lecz tokenów nie zmierzono, a crimson jest widoczny. |
| 9 | NIE | Pill Model używa crimson bez semantyki krytycznej. |
| 10 | NIEZWERYFIKOWANE | Nie wykonano pełnego Tab/Shift+Tab. |
| 11 | NIEZWERYFIKOWANE | Esc zamknął onboarding, ale nie zmierzono pełnego stosu warstw. |
| 12 | NIEZWERYFIKOWANE | Nie wykonano systematycznego pomiaru fokusa każdego elementu. |
| 13 | NIE DOTYCZY | Żadna z pięciu powierzchni nie pokazywała streamingu Teresy. |
| 14 | NIE DOTYCZY | Oceniane powierzchnie nie są kreatorem/wizardem. |
| 15 | NIE DOTYCZY | Oceniane stany nie są Canvasem. |
| 16 | NIE DOTYCZY | Oceniane stany nie są Canvasem. |

## 7. Korekty wobec instrukcji

1. Z24 odsyła do `§0.4a`, ale wydana instrukcja przechodzi z `§0.2d` do
   `§0.5`. Nie wymyśliłem selektora. Zmienione pliki produkcyjne: `0 z 0`;
   testy mapowane do zmienionego kodu: `0 z 0`; wykonane dowody to migracje,
   seeder/readback oraz pełny runtime/browser, nie suita Vitest.
2. Instrukcja odwołuje się również do nieistniejących `§0.3`, „BLOKU 0”,
   „tabeli licencji” i „TEZ ZLECENIA”. Bezpieczna interpretacja: zapis tylko w
   dwóch plikach jawnie dozwolonych przez §D; pomiar portów wykonany samodzielnie.
3. Seeder `reset/provision` ma błąd zakresu `n is not defined` po udanej
   migracji. Nie oznacza to pustej/nieutworzonej bazy; niezależny seed i readback
   udowodniły stan faktyczny.
4. SQL readback wykazał `tasks=2`, `decisions=1`, `inbox=2`, `ideas=0`,
   `notebook_pages=0`. Dlatego instrukcyjny pełny stan pięciu powierzchni jest
   osiągalny tylko dla trzech z pięciu.

## 8. TWIERDZENIA NIEZWERYFIKOWANE

- PL, tablet, mobile i pozostałe powierzchnie menu nie zostały zmierzone —
  macierz dyżuru ograniczała się do 5 powierzchni × 2 motywy × 2 stany.
- Nie wykonano pełnej ścieżki mutacji w UI, odświeżenia i cold-login readback;
  runtime był wyłącznie odczytowy zgodnie z §0.2b(4).
- Nie wykonano systematycznej klawiatury, a11y, kontrastu ani pomiaru fokus-ring.
- Nie udowodniono, czy pusty foreign state oznacza prawidłowy brak danych czy
  brak zakresu; UI prezentuje ten sam komunikat.
- Nie wykonano browserowego UI propozycji Agent/approval/materialization;
  `MATERIALIZED/SUCCEEDED` pochodzi z fixture readbacku.
- Nie wykonano pomiaru pełnego mianownika testów, bo §0.4a nie istnieje.

## 9. Rozłączność i wynik

Repo ma dokładnie dwa zmienione pliki dokumentacyjne: ten raport oraz
`modules/07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md`. Zero zmian w `src/**`,
`server/src/**`, seederach, migracjach, testach i rejestrze właściciela.

Cleanup: pierwsza próba kanonicznego `stop` odmówiła, ponieważ po commicie HEAD
nie był już kwalifikowanym SHA markera; kontener został już usunięty, więc
adopted bind nie mógł zostać powtórzony. `state.json` wskazywał dokładnie dwie
własne grupy: server PID/PGID `13237` i client PID/PGID `13267`, z komendami w
tym worktree. Po ponownym porównaniu PID, PGID, czasu startu i command line
wysłano `SIGTERM` wyłącznie do tych dwóch grup. Wynik: `0 z 2` grup żywych,
`0 z 3` listenerów na `4862/4863/5983`, kontener `cx-day100-pg` usunięty z
wolumenem. Żadnego cudzego procesu ani kontenera nie sygnalizowano.

Wynik: właściciel może ocenić Inbox, Tasks i Decisions w light/dark oraz uczciwe
empty states. Nie ma podstaw do zdjęcia pełnego starego werdyktu: fixture nie
daje pełnych Ideas/Notebook, występują ucięcia i crimson, a DoD wynosi `3 z 16`.
