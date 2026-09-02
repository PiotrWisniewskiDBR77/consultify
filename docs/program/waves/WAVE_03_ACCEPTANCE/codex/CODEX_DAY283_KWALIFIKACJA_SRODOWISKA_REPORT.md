# CODEX DAY 283 — kwalifikacja środowiska G01

Data pomiaru: 2026-09-02  
Marker: `b68c382874f004aa6cf58697fec0db8925f681b9`  
Gałąź: `codex/day283-kwalifikacja-srodowiska-20260902`  
Werdykt: **16 `PASS`, 0 `NOT_STARTED`, 0 `OWNER_PENDING` dla G01**.

## Zakres i ograniczenie werdyktu

Kwalifikacja mierzy wspólny kontrakt G01: świeży PostgreSQL, dwa przebiegi pełnego migratora, realny serwer HTTP z `ApiGateway.getInstance().initializeRoutes(app)`, rejestrację, świeże logowanie z podpisanym JWT oraz zimny odczyt zapisanego wiersza organizacji z PostgreSQL. Każdy moduł został uruchomiony osobno od pustej bazy.

**Klient nie został uruchomiony.** G01 wymienia klienta, ale dyżur nie obejmował tras frontowych. `PASS` oznacza zatem kwalifikację serwera, runtime'u, bazy i migracji oraz trwałą odtwarzalność dowodu; nie jest dowodem uruchomienia klienta ani funkcjonalności modułu.

Partner (16) przeszedł wyłącznie wspólną ścieżkę środowiskową. Nie twierdzę, że z czystej organizacji osiągalny jest kanoniczny zapis Partnera.

## Wynik markera i sanity — dosłownie

```text
f96d64e58c Merge branch 'agent/economics-gate-20260902' into codex/m03-admin-20260824
d96addd53c Merge branch 'agent/g02-czat-admin-20260902' into codex/m03-admin-20260824
e07816909f test(g02): Administracja — realny test wyscigu rozstrzyga spor o atomicznosc
cbca520583 test(g02): Czat — realny pomiar idempotencji, owner-ingress i izolacji tenantow
f5bbc5409b fix(economics): realna bramka MODULE_ECONOMICS na mouncie /api/economics
48edf8ed56 Merge branch 'agent/ustawienia-url-20260902' into codex/m03-admin-20260824
ca5b2a269e docs(wave3/settings): close G05 to PASS with mutation proof, note G02 partial evidence
02b6d03f9a fix(settings): correct reversed URL segments in notification preferences hook
90b8458037 test(economics): probe pary dowodow dla bramki /api/economics (dowod czerwony)
6b2adbf7e3 instrukcje: dyzur 283 (G01 x16 z dowodem DO REPO) + 284 (domkniecie G06)
1d08dd8b34 Merge branch 'agent/focus-canon-per-plik-20260902' into codex/m03-admin-20260824
50ddc4bfa4 fix(scripts): check-focus-canon.sh — zapadka PER PLIK zamiast globalnej sumy (K-41)
b68c382874 G05: domkniecie 10 modulow pominietych przez zbyt scisly wzorzec
af4a4c58e0 G05 zamkniete pomiarem na 16 modulach: 14 PRZEZYWA, 1 defekt, 1 bez sciezki
3fba4427d6 Merge branch 'agent/g05-pelny-20260902' into codex/m03-admin-20260824
f3c7d6036d docs(g05): R7 rejestr G05 kompletny - 15/16 modulow zmierzone realnie
4496e9dba8 Merge branch 'agent/duchy-bezpiecznikow-20260902' into codex/m03-admin-20260824
293b8fd0e7 test(g05): R6 realny przelot Administracja/Ustawienia/Partner
cfc9c7bd8f test(g05): R5 realny przelot Finanse/Materialy/Audyty/Czat
0f60a39d7c test(g05): R3 realny przelot Wywiad/Narzedzia/Ocena/Inicjatywy
c3fc8bc28c Merge branch 'agent/fala-a-modules-13-16-20260902' into codex/m03-admin-20260824
1139df6b50 Merge branch 'agent/fala-a-modules-05-08-20260902' into codex/m03-admin-20260824
968693deff Merge branch 'agent/fala-a-modules-09-12-20260902' into codex/m03-admin-20260824
5e037f737f sprostowanie: z 13 'martwych' plikow martwe byly DWA
f4039dc3be wave3-falaA: rozstrzygnięcie G00-G04 dla 16_PARTNER (PASS/NOT_STARTED)
MARKER OK
```

Sanity po utworzeniu worktree:

```text
b68c382874f004aa6cf58697fec0db8925f681b9
```

`git status --short | head -3` nie wypisał nic.

Tip wyprzedzał marker o 12 commitów. Pracę rozpoczęto dokładnie z markera; scalenie tipa pozostaje po stronie nadzorcy. Zmienione między markerem a ówczesnym tipem pliki:

```text
.husky/pre-commit
docs/program/waves/WAVE_03_ACCEPTANCE/codex/INSTRUKCJA_DYZUR_283.md
docs/program/waves/WAVE_03_ACCEPTANCE/codex/INSTRUKCJA_DYZUR_284.md
docs/program/waves/WAVE_03_ACCEPTANCE/modules/13_CHAT/MODULE_ACCEPTANCE.md
docs/program/waves/WAVE_03_ACCEPTANCE/modules/14_ADMIN/MODULE_ACCEPTANCE.md
docs/program/waves/WAVE_03_ACCEPTANCE/modules/15_SETTINGS/MODULE_ACCEPTANCE.md
docs/ui-standards/.focus-baseline.json
docs/ui-standards/CANON.md
scripts/check-focus-canon.baseline.txt
scripts/check-focus-canon.sh
server/src/Gateway.ts
server/src/scripts/economics-gate-probe.ts
server/src/scripts/g05-przelot.ts
src/hooks/useUserNotificationPreferences.tsx
```

## Narzędzie i odtwarzalność

Narzędzie: `server/src/scripts/g01-environment-qualification.ts`.

Każdy manifest zawiera dokładną jednoliniową komendę odtworzeniową. Narzędzie wymusza:

- `DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6284/cx283`;
- `MOCK_DB=false`, `DB_TYPE=postgres`, `RUN_DB_TESTS=1`, `CI=true`;
- `ENABLE_V8_GLOBAL=true`, `ENABLE_TEST_AUTH_BYPASS=false` i `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`;
- `MOCK_REDIS=true` i brak `REDIS_URL`;
- port harnessu wyłącznie `5288` albo `5289`;
- kontener wyłącznie `cx-day283-pg`, obraz `pgvector/pgvector:pg16`;
- usunięcie kontenera i wolumenu po każdym przebiegu.

Zmierzony digest obrazu: `sha256:ccc6e83d6e35e931dc7c5def2022729d5a6c370318d099181995567ff1fb4d6b`.

## R2 — deterministyczność

Po naprawie izolacji Redisa moduł `01_ORGANIZATION` uruchomiono od zera dwa razy. Oba manifesty były bajtowo identyczne:

```text
a700f749710902e39d4b8b37255def57b86cc834d7eecec6f35921b49bfa77b6  01_ORGANIZATION-isolated-1.json
a700f749710902e39d4b8b37255def57b86cc834d7eecec6f35921b49bfa77b6  01_ORGANIZATION-isolated-2.json
BRAK POLACZENIA Z REDIS 6379
[Redis] Using Mock Client
```

Surowe logi nie są identyczne, ponieważ zawierają czas i efemeryczne identyfikatory. Deterministyczny manifest celowo zawiera wyłącznie odtwarzalny wynik.

## R3–R5 — szesnaście modułów

Każdy z 16 manifestów ma:

- `result: PASS`;
- `883` zastosowane migracje oraz `0` w drugim przebiegu;
- rejestrację `200`, logowanie z podpisanym JWT `200`, zimny odczyt `200`;
- `matched: true` dla identyfikatora i nazwy organizacji;
- dokładny SHA commita kwalifikowanego przebiegu;
- dokładną komendę odtwarzającą;
- odpowiadający plik `.sha256`.

Zbiorcza weryfikacja:

```text
01_ORGANIZATION.json: OK
02_INTERVIEW.json: OK
03_TOOLS.json: OK
04_ASSESSMENT.json: OK
05_INITIATIVES.json: OK
06_EXECUTION.json: OK
07_MY_WORK_AGENT.json: OK
08_MEETINGS.json: OK
09_RESULTS.json: OK
10_FINANCE.json: OK
11_MATERIALS.json: OK
12_AUDITS.json: OK
13_CHAT.json: OK
14_ADMIN.json: OK
15_SETTINGS.json: OK
16_PARTNER.json: OK
G01 zamkniete w 16 z 16
BRAK POLACZENIA Z REDIS 6379 WE WSZYSTKICH LOGACH
```

Dowody przetrwają restart, ponieważ manifesty i sumy są w repo pod `docs/program/waves/WAVE_03_ACCEPTANCE/evidence/day283-g01-environment/`, a nie wyłącznie w `/private/tmp`.

## §0.4a — pomiar nazw testów

Nie uruchamiano Vitest ani żadnego pakietu testowego jako dowodu. Instrukcja nakazuje dla tego dyżuru samodzielny skrypt `npx tsx`, ponieważ `tests/setup.ts` podmienia `global.fetch`. Nie ogłaszam wyniku `N passed`.

Pliki `przed-nazwy.txt` i `po-nazwy.txt` są puste; `nazwy.diff` jest pusty. Nie dodano ani nie usunięto przypadku Vitest. Jest to jawne `NIE DOTYCZY`, a nie zielony wynik testów.

## Pułapki (a)–(e)

Jedynym pakietem dowodowym jest samodzielny skrypt `npx tsx`:

- (a) `ENABLE_V8_GLOBAL=true` jest asertowane przed startem;
- (b) `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce` jest asertowane;
- (c) nie użyto Vitest; `DB_TYPE=postgres`, `MOCK_DB=false`, `RUN_DB_TESTS=1` i dokładny `DATABASE_URL` są asertowane, a log pokazuje `DB_IDENTITY ... 127.0.0.1:6284/cx283`;
- (d) `ENABLE_TEST_AUTH_BYPASS=false` jest asertowane; login wydaje podpisany JWT użyty przy zimnym odczycie;
- (e) nie załadowano `tests/setup.ts`, użyto natywnego `fetch` do nasłuchującego `ApiGateway`; drugi przebieg migracji ma `0`; nie uznawano odpowiedzi zapisu bez zimnego odczytu; nie ma retry.

## Protokół Z30

Przed migracjami środowisko wypisało `BRAK ZMIENNYCH POCZTY`. Po migracjach zapytanie do `settings WHERE key LIKE 'smtp%'` zwróciło 0 wierszy. `Gateway.ts` nie zawiera startu drenaży. Logi rejestracji pokazują `Using Host: Mock (Console)` dla adresów `local.test`.

**Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.**

## Artefakty poza repo

Surowe logi, kopie porównawcze R2 i pomiar nazw leżą w `/private/tmp/cx-day283-kwalifikacja-artefakty`. Nie są trwałym dowodem G01; służą wyłącznie audytowi bieżącego przebiegu.

`SHA256SUMS.txt` ma SHA-256:

```text
8a3b6779237e3e6b3d61fb7452e9da99ab612f870ef9217b6b9cdb47d0b4e1eb
```

## Korekty wobec instrukcji

1. Instrukcja przewidywała `1099` plików po `ls server/migrations/ | wc -l`; pomiar na markerze dał `1100`. `rg --files server/migrations | wc -l` daje `1277`, bo obejmuje też pliki w podkatalogach. Runner realnie zastosował `883` migracje; to jest liczba wykonawcza użyta w manifestach.
2. Ścieżka z komendy wejściowej `server/src/database/databaseTargetResolver.ts` nie istnieje. Realny odpowiednik to `server/src/config/databaseTargetResolver.ts`.
3. Pierwsze wznowienie użyło istniejącego lokalnego refa gałęzi pozostałego po przerwanym worktree. Zamiast ponownego `-b` wykonano `git worktree add <WT> <istniejąca-gałąź>`; ref wskazywał dokładnie marker.
4. Pierwszy pomiar dysku pokazał `3.7 GiB`, więc dyżur został zatrzymany. Po poleceniu wznowienia pomiar dał `74 GiB`; dopiero wtedy uruchomiono zasoby.
5. Pierwsza seria kwalifikacji ujawniła po fakcie połączenie kodu logowania do zastanego `localhost:6379`. Te manifesty zostały **unieważnione**, narzędzie poprawiono przez obowiązkowe `MOCK_REDIS=true` i zakaz `REDIS_URL`, po czym R2 i wszystkie 16 modułów wykonano ponownie od zera. Zbiorczy skan nowych logów nie znalazł kontaktu z `6379`.
6. Podczas szukania `AGENTS.md` omyłkowo uruchomiono `find ..` z worktree. Proces na krótko wyszedł w `/private/tmp`, został przerwany, zanim zwrócił wynik; nie wykonano żadnego zapisu. Następne wyszukiwanie ograniczono do własnego worktree i nie znaleziono `AGENTS.md`. Jest to naruszenie granicy odczytu Z6, ujawnione tutaj zamiast przemilczenia.

## Twierdzenia niezweryfikowane

- Uruchomienie, build i zachowanie klienta: **NIE ZWERYFIKOWANO**.
- Funkcje i trasy biznesowe poszczególnych modułów: **NIE ZWERYFIKOWANO**; G01 nie jest testem funkcjonalnym.
- Osiągalność kanonicznego zapisu Partnera z czystej organizacji: **NIE ZWERYFIKOWANO**.
- CI, staging, demo, Railway i produkcja: **NIE DOTYKANO, NIE ZWERYFIKOWANO**.
- Konsument w `src/` dla zapisu organizacji: **NIE MIERZONO**; kwalifikacja nie uruchamiała klienta.

## Commity pozycji

- R1: `028f9a456d` — narzędzie; `9daa5bba9a` — zakończenie procesu; `839b0df1c1` — izolacja Redisa.
- R2: `29745c3154` — pierwszy dowód deterministyczności; następnie zastąpiony izolowanym przebiegiem w `d55929c714`.
- R3: `6afc088aa7` — moduły 01–08; dowody następnie zastąpione w `d55929c714`.
- R4: `5ff7d09ecb` — moduły 09–16; dowody następnie zastąpione w `d55929c714`.
- R5: `2a529f2f82` — wiersze G01; sumy i manifesty skorygowane w `d55929c714`.
- R6: commit zawierający ten raport.

## Stan końcowy zasobów

`docker ps --filter name=cx-day283-pg` nie zwraca kontenera. Porty `6284`, `5288` i `5289` nie mają listenerów. Ostatni pomiar dysku: `73 GiB` wolnego.
