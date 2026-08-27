# RAPORT DYŻURU 38 — Bezpieczniki środowisk i wdrożeń (część repozytoryjna)

## 0. Metryka

- Marker: `3e707a9d3c`; wynik: `MARKER OK`.
- Gałąź: `codex/deploy-guards-day38-20260828`.
- Worktree: `/private/tmp/consultify-guards`.
- Data pomiaru: 2026-08-28.
- `git log --oneline 3e707a9d3c..codex/m03-admin-20260824`: wynik pusty — tip nie odszedł od markera.
- Zgodnie z jawną komendą zlecenia worktree utworzono z
  `codex/day38-instrukcja-20260828`; dlatego branch dziedziczy ponad markerem
  dwa commity instrukcyjne: `eea9c2e352` i `05c997f578`.
- Port lokalnego PG: `5617`.
- Dowód celu: `current_database = cx_day38`; `docker port` zwrócił
  `5432/tcp -> 0.0.0.0:5617` oraz `5432/tcp -> [::]:5617`.
- Dowód przez strażnika: `database=cx_day38`, `schema=public`, `host=localhost`,
  `port=5617`, PostgreSQL 17.11.
- Sprzątanie: `docker rm -fv cx-day38-pg` zwróciło `cx-day38-pg`; następujące
  `docker ps -a --filter name=cx-day38 --format '{{.Names}}'` było puste.

Komenda bazowa `git diff --name-only 3e707a9d3c...HEAD` przed commitem raportu:

```text
docs/operations/CRITICAL_SERVICES.md
docs/operations/DB_DATA_RELEASE_GATE.md
docs/operations/RAILWAY_DB_TARGET_RULES.md
docs/program/waves/WAVE_03_ACCEPTANCE/DEPLOY_GUARDS_DAY38_REPORT_20260828.md
docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY38_DEPLOY_ENV_GUARDS_INSTRUKCJA.md
scripts/deploy-demo.sh
scripts/seed-m16-demo.py
scripts/validate-deploy-target.sh
server/scripts/release-migration-gate.ts
server/src/config/__tests__/dbTargetLabel.test.ts
server/src/config/dbTargetLabel.ts
server/src/database/PostgresDatabase.ts
tests/integration/_helpers/assertRealPostgres.ts
tests/unit/deploy/validate-deploy-target.test.mjs
```

Plik instrukcji w tym wyniku jest dziedziczony z jawnie wskazanej przez
zleceniodawcę gałęzi startowej; nie był modyfikowany w tym dyżurze.

## 1. Weryfikacja stanu wejściowego (§0.3)

| Kontrola | Oczekiwane | Otrzymane | Zgodne |
| --- | --- | --- | --- |
| `validate-deploy-target.sh` — linie | 63 | 63 | TAK |
| `allowed_hosts=` | 2 | linie 23 i 28 | TAK |
| `staging.consultify.ai` / `demo)` / DB fingerprint | 0 / 0 / 0 | 0 / 0 / 0 | TAK |
| `host redacted` / `RELEASE_MIGRATION_GATE_PASS` / `[Postgres] Config` | po 1 | linie 236 / 294 / 457 | TAK |
| `DB_TARGET_LABEL` w `server/ src/ scripts/` | 0 | 0 | TAK |
| `gateContract.ts` — linie | 48 | 48 | TAK |
| denylista | 3 wpisy; brak `sakura/thomas/caboose` | 3 wpisy; 0 brakujących nazw | TAK |
| seed — `password` / `caboose` / linie | 1 / 1 / 312 | linie 29 / 15 / 312 | TAK |
| deploy-demo — wywołanie bramki / zewnętrzne skutki | 0 / 2 | 0 / linie 44 i 50 | TAK |
| dokumenty operacyjne — linie | 55 / 47 / 148 | 55 / 47 / 148 | TAK |
| hosty `trolley/sakura/thomas` w `docs/operations` | 0 | 0 | TAK |
| `tests/unit/release` / wzorzec | 2 pliki / `spawnSync`, `node:test` | 2 / obecne | TAK |
| `tests/unit/deploy` | brak | brak | TAK |
| ledger — linie / DEC-165 / DEC-172 | 225 / >=1 / >=1 | 225 / 1 / 1 | TAK |

## 2. Kolizje (§0.7)

Dosłowne wyniki przed pierwszą zmianą §D:

```text
$ ls docs/program/waves/WAVE_03_ACCEPTANCE/codex/ | grep -i "DAY3[4-7]"
(brak wyniku)

$ grep -rln "seed-m16-demo" docs/program/waves/WAVE_03_ACCEPTANCE/codex/
docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY38_DEPLOY_ENV_GUARDS_INSTRUKCJA.md

$ git branch -a --list 'codex/*day3[4-7]*'
+ codex/day34-instrukcja-20260828
+ codex/day35-instrukcja-20260828
+ codex/day36-instrukcja-20260828
+ codex/day37-instrukcja-20260828
+ codex/demo-data-day36-20260828
+ codex/document-visual-day34-20260828
+ codex/execution-day35-20260828
+ codex/org-context-day37-20260828
```

Rozstrzygnięcie: instrukcja dnia 36 nie istnieje w drzewie tej bazy i żaden
dostępny dokument dnia 34–37 nie wymienia `seed-m16-demo.py`; §D wykonano.
D38 zmienił wyłącznie trzy przydzielone pliki w `scripts/`; nie dotknął seedów
przydzielonych D36.

Lista własnych plików jest listą z komendy bazowej w §0, z wyłączeniem
dziedziczonego pliku instrukcji i z dodanym niniejszym raportem.

## 3. Pozycje §A–§G

### §A — ZROBIONE_WG_DoD

- Allowlisty: staging tylko `staging.consultify.ai`; demo ma dwie faktyczne
  domeny; production bez zmiany.
- Brak faktycznego albo deklarowanego fingerprintu i ich rozjazd kończą się
  `exit 1`. Porównanie robi pośrednie rozwinięcie bash, trim i lower-case.
- Sukces drukuje `db target fingerprint verified`; grep realnych hostów baz
  w skrypcie zwrócił brak trafień.
- Osiągalność: workflow `.github/workflows/railway-deploy.yml:79-85` uruchamia
  `scripts/validate-deploy-target.sh`; odmowa jest w `:84-96`, komunikat w `:22`,
  test realnego pliku w `tests/unit/deploy/validate-deploy-target.test.mjs`.
- Ostatnie ogniwo pozostaje poza repo: wymagane zmienne ustawia nadzorca.
- Commity: `ba8ce1ddbf`, `86e9772e1a`.

### §B — ZROBIONE_WG_DoD

- `resolveDbTargetLabel` normalizuje do `[a-z0-9-]`, 40 znaków, zwraca `unset`,
  nigdy nie rzuca i odrzuca wartość wyglądającą jak URL z poświadczeniami.
- Bramka ma `dbTarget=` w logu weryfikacji i na końcu linii PASS; aplikacja ma
  to samo pole w `[Postgres] Config:`. Logika połączenia i bramki nie zmieniła się.
- Osiągalność: `railway.json`/`railway.api.json` prowadzą do
  `server/scripts/release-migration-gate.ts:235-239,298`; start puli prowadzi do
  `server/src/database/PostgresDatabase.ts:458-464`; test normalizatora ma 10/10.
- Ostatnie ogniwo pozostaje poza repo: `DB_TARGET_LABEL` ustawia nadzorca.
- Commity: `ec74b87636`, `b2a6b03e8a`, `e4a015b9e6`, `23a13efe4c`.

### §C — ZROBIONE_WG_DoD

- Denylista ma 6 hostów. `caboose` i `ballast` są jawnie opisane jako o
  nieustalonym pochodzeniu; komentarz trolley opisuje demo i historyczny błąd
  `DATABASE_URL` aplikacji stagingu, nie przypisuje hosta do stagingu.
- Kolejność bezpieczna: lista jest sprawdzana w
  `tests/integration/_helpers/assertRealPostgres.ts:80-83`; `new Client` i
  `connect()` są dopiero w `:86-88`.
- Pozytywna sonda lokalna: PASS z dowodem `cx_day38/public/localhost/5617`.
  Sześć sond negatywnych: 6 × `DENIED_BEFORE_CONNECT`.
- Formalny zakres `vitest tests/integration/_helpers` zawiera 0 plików
  testowych i kończy się kodem 1; nie przedstawiam tego jako PASS.
- Commit: `17a3d66ba8`.

### §D — CZĘŚCIOWE

- Werdykt: skrypt żywy — 3 pliki konsumenckie i 7 odwołań (test E2E, sweep API,
  procedura Harvard). Skrypt pozostał.
- Login i hasło pochodzą wyłącznie z `M16_SEED_EMAIL` i
  `M16_SEED_PASSWORD`; cel z wymaganej `M16_SEED_BASE_URL`. Brak którejkolwiek
  zmiennej kończy się `sys.exit(1)` przed `login()`.
- Wybrano brak wartości domyślnej URL, ponieważ przypadkowe uruchomienie nie
  powinno mieć żadnego celu. AST parsuje się poprawnie; literalne stare
  poświadczenia zniknęły, `caboose` ma 0 trafień.
- Zgodnie z nadrzędnym zakazem zleceniodawcy skryptu nie uruchomiono, więc runtime
  odmowy D-3 pozostaje niezweryfikowany; dowód statyczny: `main()` waliduje
  komplet zmiennych przed `login()`.
- Osiągalność: operator uruchamia dokumentowaną komendę; `main()` odmawia przed
  REST. Ostatnie ogniwo, wartości zmiennych, pozostaje poza repo.
- Commit: `a2a427df87`.

### §E — ZROBIONE_WG_DoD

- Wybrano wariant 1: skrypt uruchamia wspólną bramkę z refem celu pusha
  `refs/heads/demo`. To uczciwie opisuje destination, nie lokalną gałąź.
- Kolejność: bramka `scripts/deploy-demo.sh:26-29`, odczyt tokenu `:31`, push
  `:56`. `bash -n` zwrócił 0. Skrypt nie został uruchomiony.
- Osiągalność: realne wejście operatora zawsze przechodzi przez bramkę; brak
  fingerprintów daje `exit 1` i `deploy-target: missing ...` przed skutkiem.
- Ostatnie ogniwo poza repo: oba fingerprinty demo ustawia nadzorca.
- Commit: `a4e09449ff`.

### §F — ZROBIONE_WG_DoD

- Mapa ma jedno źródło: `RAILWAY_DB_TARGET_RULES.md`, z datą i odwołaniami do
  DEC-165/172. Nie zawiera portów, connection stringów ani ID Railway.
- Dodano pułapkę nazw, tabelę zmiennych, ograniczenia bezpieczników, bramkę
  migracji i procedurę akceptacji dwóch linii logu.
- `CRITICAL_SERVICES.md` zachował sens spisu plików TS i tylko odsyła do mapy.
- Osiągalność: dokumenty wskazują realne wejścia i komunikaty kodu z §A/§B/§C;
  wykonanie ustawień nadal należy do nadzorcy.
- Commit: `2de24673e7`.

### §G — ZROBIONE_WG_DoD

- 10 przypadków uruchamia realny `.sh` przez `spawnSync`; każdy asertuje status
  i stderr. Test dziedziczy tylko `PATH`; realne hosty baz mają 0 trafień.
- Bezpośredni przebieg: 10 PASS, 0 FAIL, 0 SKIPPED. Pełny poprawny glob dwóch
  katalogów przy zatrzymanym PG: 20 PASS, 0 FAIL, 0 SKIPPED.
- Plik dodano przez `git add -f`.
- Osiągalność: wejście to `node --test .../*.test.mjs`, dalej `spawnSync` i
  realny `scripts/validate-deploy-target.sh`, dalej `exit 1`/komunikat.
- Commit: `d76d474f94`.

## 4. Pomiar testów (§0.5, Z23)

| Przebieg | ZASTANE | WPROWADZONE | PASS | FAIL | SKIPPED |
| --- | --- | --- | ---: | ---: | ---: |
| dokładne `node --test tests/unit/release/ tests/unit/deploy/` | Node 24 potraktował katalog release jako moduł | Node 24 potraktował oba katalogi jako moduły | 0 | 2 | 0 |
| poprawny glob `node --test tests/unit/release/*.test.mjs tests/unit/deploy/*.test.mjs` | nie wykonano przed zmianą | wykonano po zmianie | 20 | 0 | 0 |
| `vitest` releaseGate | wykonano | wykonano | 88 | 0 | 0 |
| `vitest` databaseTarget/dbTarget | wykonano | wykonano | 32 | 0 | 0 |
| `vitest tests/integration/_helpers` z 5 env | 0 testów w zakresie | 0 testów w zakresie | 0 | 1 (brak plików) | 0 |
| ad-hoc strażnik real-PG z 5 env | nie wykonano | lokalny pozytywny + 6 odmów przed connect | 7 | 0 | 0 |

Stan przed: releaseGate 88 testów, config-target 22 testy, dokładny node-test
1 syntetyczna porażka katalogu, helper scope 0 testów. Stan po: releaseGate 88,
config-target 32, poprawny pełny glob release+deploy 20, helper scope nadal 0.
Nie zawyżam pustego ani błędnego przebiegu do PASS.

## 5. Migracje (§0.6)

```text
$ ls server/migrations/ | grep -E '^2026127[0-9]' | wc -l
0

$ git diff --name-only 3e707a9d3c...HEAD -- server/migrations/
(pusto)
```

## 6. ★ SKUTKI OPERACYJNE — do wykonania przez nadzorcę PRZED scaleniem

- [ ] Staging: ustawić i zweryfikować
  `RELEASE_TARGET_DB_HOST_FINGERPRINT`, `STAGING_DB_HOST_FINGERPRINT`,
  `DB_TARGET_LABEL`.
- [ ] Demo: ustawić i zweryfikować
  `RELEASE_TARGET_DB_HOST_FINGERPRINT`, `DEMO_DB_HOST_FINGERPRINT`,
  `DB_TARGET_LABEL`.
- [ ] Production: po osobnej zgodzie właściciela E5 ustawić i zweryfikować
  `RELEASE_TARGET_DB_HOST_FINGERPRINT`, `PRODUCTION_DB_HOST_FINGERPRINT`,
  `DB_TARGET_LABEL`. Bez dwóch fingerprintów deploy będzie fail-closed.
- [ ] GitHub: po E0 poprawić `vars.STAGING_FRONTEND_URL` oraz
  `vars.STAGING_API_HEALTH_URL`, aby oba wskazywały staging; inaczej workflow
  będzie blokowany lub nadal sprawdzi niewłaściwe środowisko.
- [ ] Wpiąć poprawną komendę Node z globami do CI/package scriptu.
- [ ] ★ **BEZPIECZEŃSTWO:** hasło konta właściciela na demo było zapisane w
  `scripts/seed-m16-demo.py:29` wersji bazowej i musi zostać zmienione przez
  właściciela. Pozostaje w historii gita, więc usunięcie z pliku nie wystarcza.
  Czyszczenie historii nie należy do tego dyżuru i wymaga osobnej decyzji.

Procedura odbioru:

1. znajdź w logu deployu linię zaczynającą się od `RELEASE_MIGRATION_GATE_PASS`
2. znajdź linię `[Postgres] Config:`
3. porównaj pole `dbTarget=` w obu
   - te same wartości → OK
   - różne wartości → ROZJAZD, wstrzymaj wdrożenie
   - którakolwiek = `unset` → `DB_TARGET_LABEL` nieustawiona w tym środowisku
   - brak pola `dbTarget` w którejś → ta strona chodzi na starym buildzie

Brak pola po jednej stronie oznacza stary build, nie brak etykiety.

## 7. Znaleziska (nie weszły do kodu)

- `scripts/deploy-demo.sh:56` nadal robi `--force-with-lease`, sprzecznie z
  `CLAUDE.md:42-45` („NIGDY force-push na demo”). Propozycja: osobna decyzja i
  push bez `--force`, z czytelną odmową przy non-fast-forward.
- `server/src/config/databaseTargetResolver.ts:41` opiera bezpiecznik produkcji
  na nazwie proxy, która może się zmienić.
- Produkcja wg DEC-165/172 nie ma
  `RELEASE_TARGET_DB_HOST_FINGERPRINT`; nowa bramka zablokuje ją do E5.
- Testy deployu nie są wpięte do `package.json`; należy dodać poprawny glob.
- Dokładna komenda katalogowa z instrukcji nie działa na Node 24; wymaga globów.
- `FORBIDDEN_DB_HOSTS` używa dopasowania dokładnego; zmiany semantyki nie
  wykonano z powodu wąskiego wyjątku Z18.

## 8. Korekty wobec instrukcji

- `CRITICAL_SERVICES.md` nie był dokumentem o środowiskach. To wygenerowany
  spis 19 plików serwisowych TS; mapa pozostała wyłącznie w
  `RAILWAY_DB_TARGET_RULES.md`.
- Jawna komenda zleceniodawcy tworzyła branch z gałęzi instrukcyjnej, a nie
  bezpośrednio z markera. Zachowano polecenie zleceniodawcy; dwa commity
  instrukcyjne są dziedziczone i widoczne w komendzie bazowej.
- `node --test <katalog>` w Node 24 nie odkrywa tu testów. Wynik formalny
  zachowano, a dowód wykonano poprawnym globem obu katalogów.
- `vitest tests/integration/_helpers` ma 0 plików testowych i zwraca kod 1;
  dowód §C wykonano przez bezpośrednie wywołanie prawdziwego strażnika.
- `docker exec ... inet_server_port()` po połączeniu unix-socket zwrócił pustą
  wartość portu; mapowanie 5617 potwierdził `docker port`, a połączenie TCP
  potwierdził sam strażnik (`host=localhost`, `port=5617`).
- Runtime test odmowy skryptu seed pominięto, bo jawne zlecenie nadrzędne mówiło
  „Nie uruchamiasz `seed-m16-demo.py`”; wykonano statyczny parse AST.

## 9. Twierdzenia NIEZWERYFIKOWANE

1. Nie zweryfikowano aktualnych wartości żadnej zmiennej Railway; nadzorca musi
   sprawdzić je per środowisko i usługę.
2. Nie zweryfikowano, czy aktualna aplikacja stagingu i bramka migracji nadal
   celują w różne bazy; nadzorca musi porównać konfigurację i logi po E0–E4.
3. Nie zweryfikowano, czy produkcja nadal nie ma
   `RELEASE_TARGET_DB_HOST_FINGERPRINT`; nadzorca musi sprawdzić to przed E5.
4. Nie zweryfikowano bieżących wartości GitHub
   `vars.STAGING_FRONTEND_URL`/`vars.STAGING_API_HEALTH_URL`; nadzorca musi je
   odczytać i poprawić po rozkrzyżowaniu domen.
5. Nie zweryfikowano, czy ujawnione historycznie hasło zostało już obrócone;
   właściciel musi wykonać rotację i potwierdzić ją poza repo.
6. Nie zweryfikowano pary `dbTarget=` na realnym wdrożeniu; nadzorca musi zrobić
   odbiór z §6 po zbudowaniu obu stron z tej wersji.

## 10. Oświadczenia

- Nie wykonałem żadnego połączenia sieciowego do Railway, demo, stagingu ani
  produkcji (Z28).
- Nie uruchomiłem `scripts/deploy-demo.sh`, `scripts/seed-m16-demo.py`,
  `scripts/test-m16-api-sweep.py` ani testów E2E.
- Nie wykonałem `git push`, `git stash` ani `cp` plików repo.
- Nie odczytałem konfiguracji Railway ani tokenu właściciela.
- Jedyny ruch sieciowy poza lokalnym hostem był dozwolonym przez Z28
  `docker pull postgres:17`.
- Kontener `cx-day38-pg` został usunięty przez `docker rm -fv`; filtr
  `docker ps -a` po usunięciu zwrócił pusty wynik.
