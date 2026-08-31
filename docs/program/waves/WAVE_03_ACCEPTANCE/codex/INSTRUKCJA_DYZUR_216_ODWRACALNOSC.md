# INSTRUKCJA DYŻURU nr 216 — Codex — „Migracja legacy `tasks` -> kanon (dyżur 204 pkt 5-6): zapis do kanonu i wpis do rejestru migracji w JEDNEJ transakcji (dziś dwie osobne operacje, luka między nimi zostawia połowiczny stan), rejestr zaczyna zapisywać `FAILED` zamiast przerywać cala partie bez śladu, i powstaje skrypt cofający jedna partie po `batch_id` z tym samym rygorem co runner (zakres organizacji, dry-run, jawne potwierdzenie, limit) — wyłącznie na lokalnym Postgresie w kontenerze, zero połączeń do stagingu/demo/produkcji"

Dokument samodzielny. Zakładam, że dostajesz **TYLKO ten plik** i repozytorium
Consultify. Nie masz dostępu do rozmowy, w której powstał, ani do instrukcji
poprzednich dyżurów. Wszystko, czego potrzebujesz, jest poniżej albo pod
wskazanymi ścieżkami w repo.

> ### ★★ ZAKAZ NR 1 — KATALOG WŁAŚCICIELA. CZYTASZ TO, ZANIM URUCHOMISZ COKOLWIEK.
>
> **Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani
> do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`,
> ani `git fetch`, ani `git worktree add`.
> To brudny checkout właściciela produktu i jest **NIETYKALNY**.
> Jedyny dozwolony kontakt z tą ścieżką to **symlink `node_modules` (odczyt)**
> wg `DEC-2026-08-26-86`.
>
> **★★ TO JEST NAJCZĘSTSZA PRZYCZYNA STRACONEJ GODZINY W TYM PROGRAMIE.**
> Instrukcja dyżuru 53 kazała wykonać `git fetch --all` i `git worktree add`
> „w root-repo" — wykonawca zrobił to w katalogu właściciela, `Z5` zablokowało
> pracę i dyżur stanął na STOP-ie, który nie miał prawa powstać.
> **Dlatego w `§0.1` masz PEŁNĄ, DOSŁOWNĄ procedurę worktree Z VAULTA.**
> Nie improwizuj jej i nie zastępuj „swoim sposobem". Twoje miejsce pracy to
> **wyłącznie** `/private/tmp/cx-day216-odwracalnosc`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `fe33ce8036`**
> **Gałąź bazowa: `github-backup/codex/m03-admin-20260824`**
> **Stan dokumentu: WYDANY**
>
> Jeżeli w polu „Stan dokumentu" widzisz `WYDANY` — możesz zaczynać.
> Jeżeli widzisz `PROJEKT` albo jakiekolwiek niewypelnione pole szablonu — **dokument nie
> jest wydany, nie zaczynasz i zgłaszasz to nadzorcy**.
> Ta ramka jest **jedynym** miejscem, w którym rozstrzyga się stan wydania.
> Objaśnienia w innych blokach cytowanych **nie** są powodem do STOP-u.

Data wystawienia: 2026-08-31.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.
Zakres: **Migracja danych legacy->kanon (etap 2, dokończenie dyżuru 204) — narzędzie `server/scripts/legacy-task-cutover-runner.ts`, współdzielony silnik poleceń materialnych `server/src/domain/initiatives-execution/materialCommand.ts` + `postgresMaterialCommandUnitOfWork.ts`, tabela rejestru `legacy_task_cutover_ledger` (`server/migrations/20261721_legacy_task_cutover_ledger.sql`). To NIE jest moduł menu głównego — to podsystem techniczny jednorazowej migracji danych, patrz `docs/program/funkcje/PLAN_MIGRACJI_TASKS_KANON.md` i `docs/program/funkcje/LISTA_DYZUROW_211_222.md:52-55` (pozycja 216).**.
Trasy front: `Brak — dyżur nie dotyka żadnego ekranu ani komponentu frontendowego. Nie ma wizualnej powierzchni do zrzutu, `Z11`/reguły zrzutów nie mają tu zastosowania.`. Trasy tył: `Zero NOWYCH tras HTTP. Caly dyżur to CLI: istniejący `npx tsx server/scripts/legacy-task-cutover-runner.ts` (bez trasy Express) i NOWY skrypt CLI cofający partie (patrz pozycja R3), analogiczny w budowie. ★ `createExecutionTask` (`executionWork.ts:124-185`), który ten runner woła, jest TAKŻE żywym wołaczem produkcyjnym z trasy HTTP `server/src/routes/pmo/initiativesExecutionRuntime.routes.ts` — każda zmiana jego zachowania zewnętrznego (nie tylko wewnętrznej struktury) uderza w te trasę. Zmiana w R1 MUSI być behavior-preserving dla tego wołacza — dowodzisz tego istniejącym pakietem `tests/integration/initiatives-execution/executionWork.realdb.test.ts`, zielonym bez zmian w nim.`.

---

### 0.1. ★★ BAZA PRACY, MARKER I GAŁĄŹ — PROCEDURA DOSŁOWNA, Z VAULTA

**Repozytorium, z którego pracujesz, to BARE-vault, a nie checkout właściciela:**

```
/Users/piotrwisniewski/Developer/consultify-recovery-vault-20260820.git
```

Vault ma `extensions.worktreeConfig=true`. **To ma konsekwencję operacyjną,
którą MUSISZ obsłużyć — krok (4).**

**PIERWSZE KOMENDY DYŻURU — wklej dokładnie tak, po kolei:**

```bash
VAULT=/Users/piotrwisniewski/Developer/consultify-recovery-vault-20260820.git
WT=/private/tmp/cx-day216-odwracalnosc
MARKER=fe33ce8036

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/codex/m03-admin-20260824
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/codex/m03-admin-20260824 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day216-odwracalnosc-20260831 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day216-odwracalnosc/config.worktree"
cat "$VAULT/worktrees/cx-day216-odwracalnosc/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day216-odwracalnosc-scratch
mkdir -p /private/tmp/cx-day216-odwracalnosc-artefakty

# (7) sanity
git -C "$WT" rev-parse HEAD
git -C "$WT" status --short | head -3
```

**Wynik komend (2) i (7) wklejasz do raportu dosłownie.**

> **★★ PUŁAPKA — REMOTE `icloud-source` JEST MARTWY.**
> Vault ma trzy remote'y: `github-backup` (żywy, jedyny Twój),
> `origin` (**zakazany do pushu**, `Z1`) i `icloud-source`, wskazujący na
> nieistniejący katalog `/private/tmp/consultify-staging-deploy-e6ca`.
> **Dlatego NIE WOLNO Ci wołać `git fetch --all`.**
> **Błąd `icloud-source` przy jakimkolwiek fetchu NIE JEST negatywnym wynikiem
> markera i NIE JEST powodem do STOP-u.** Jedynym negatywnym wynikiem markera
> jest napis `MARKER BRAK` z komendy `merge-base` powyżej.

**★★ REGUŁA ROZEJŚCIA (`DEC-2026-08-26-95`).**
Jeżeli marker **nie jest** przodkiem tipa albo gałąź nie istnieje — **STOP
całego dyżuru**. Nie improwizujesz bazy: nie startujesz z `origin/demo`,
`main`, `Londyn`, `codex/preserve-*`, `codex/day*-instrukcja-*` ani z żadnej
gałęzi cudzych dyżurów.

Jeżeli marker **JEST** przodkiem, ale **tip uciekł do przodu — to NIE jest
STOP**. Startujesz **dokładnie z markera**, a do raportu wpisujesz:

```bash
git -C "$VAULT" log --oneline fe33ce8036..github-backup/codex/m03-admin-20260824
git -C "$VAULT" diff --name-only fe33ce8036..github-backup/codex/m03-admin-20260824
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day216-odwracalnosc-20260831
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only fe33ce8036..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `dwanaście` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd /private/tmp/cx-day216-odwracalnosc

# (W1) T1 — ile linii ma dziś runner (FIX-204 dołożył bezpieczniki od pierwotnych 294)
wc -l server/scripts/legacy-task-cutover-runner.ts
#   oczekiwane: 452 linie (nie 294 z pierwotnej karty 204 sprzed FIX-u). Rozbieznosc z ta
#   liczba na Twojej bazie nie jest sprzecznością — jest wynikiem, wpisz swoją.

# (W2) T2 — DWIE niezależne operacje: zapis kanonu (własna transakcja) i INSERT ledgera (poza nia)
sed -n '262,362p' server/scripts/legacy-task-cutover-runner.ts
sed -n '877,894p' server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork.ts
#   oczekiwane: `createExecutionTask` (:316) domyka WŁASNA transakcje Postgresa (BEGIN…COMMIT,
#   postgresMaterialCommandUnitOfWork.ts:877-894) w całości PRZED tym, jak runner dojdzie do
#   `pool.query(INSERT INTO legacy_task_cutover_ledger...)` (:344-360). Awaria między tymi
#   dwiema liniami zostawia zadanie zmigrowane BEZ wiersza w rejestrze.

# (W3) T3 — literal 'FAILED' nie występuje w runnerze, mimo ze MigrateOutcome go nie ma
grep -n "MigrateOutcome" server/scripts/legacy-task-cutover-runner.ts
grep -c "FAILED" server/scripts/legacy-task-cutover-runner.ts
#   oczekiwane: `export type MigrateOutcome = 'MIGRATED' | 'SKIPPED' | 'NOOP';` (:65) i
#   `grep -c "FAILED"` -> 0.

# (W4) T4 — pętla bez try/catch, istniejący łatwo odtwarzalny throw CANONICAL_HOME_MISSING
sed -n '377,391p' server/scripts/legacy-task-cutover-runner.ts
sed -n '305,314p' server/scripts/legacy-task-cutover-runner.ts
sed -n '447,452p' server/scripts/legacy-task-cutover-runner.ts
#   oczekiwane: `for (const {task,mapping} of plan) { outcomes.push(await migrateOneTask(...)); }`
#   (:386-389) bez try/catch; throw `CANONICAL_HOME_MISSING:${org}:${initiativeId}` na :312-313
#   gdy execution_case nie jest ACTIVE; oba uciekają do main()'s top-level .catch (:448-451),
#   który przerywa CALY proces (`process.exitCode = 1`), bez wpisu w ledgerze.

# (W5) T5 — schemat JUŻ dopuszcza PENDING/FAILED, migracja NIE jest potrzebna dla R2
cat server/migrations/20261721_legacy_task_cutover_ledger.sql
#   oczekiwane: `status TEXT NOT NULL CHECK (status IN ('PENDING', 'MIGRATED', 'SKIPPED',
#   'FAILED'))` (:9) — wszystkie cztery stany już dopuszczone.

# (W6) T6 — strażnik idempotencji patrzy WYŁĄCZNIE na checksum, nigdy na status
sed -n '262,304p' server/scripts/legacy-task-cutover-runner.ts
#   oczekiwane: `existing.rows[0]` (:282) sprawdza `existing.rows[0].checksum !== taskChecksum`
#   (:283) -> throw, w przeciwnym razie `return 'NOOP'` (:285) — ANI RAZU nie czyta
#   `existing.rows[0].status`. Wiersz PENDING z pasującym checksumem byłby więc potraktowany
#   jak już-zrobiony.

# (W7) T7 — MaterialCommandTransaction: 21 metod, ZERO surowego query()
grep -c "): Promise<" server/src/domain/initiatives-execution/materialCommand.ts | head -1
sed -n '117,271p' server/src/domain/initiatives-execution/materialCommand.ts | grep -n "^\s*[a-zA-Z].*(" | grep -v "^\s*//"
grep -n "query(" server/src/domain/initiatives-execution/materialCommand.ts
#   oczekiwane: interfejs MaterialCommandTransaction (:117-271) — policz metody sam (autor
#   instrukcji naliczył 21); `grep -n "query("` w tym pliku -> 0 trafień (interfejs nie
#   eksponuje surowego SQL-a, każda metoda jest wąska i jednotabelowa).

# (W8) T8 — JEDEN implementator produkcyjny interfejsu
grep -rln "implements MaterialCommandTransaction" --include="*.ts" .
#   oczekiwane: dokładnie JEDEN plik —
#   server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork.ts.

# (W9) T9 — executeMaterialCommand: 105 wywołań w ~46 plikach produkcyjnych (promień rażenia)
grep -rn "executeMaterialCommand(" --include="*.ts" . | grep -v "domain/initiatives-execution/materialCommand.ts" | wc -l
grep -rln "executeMaterialCommand" --include="*.ts" server/src/domain/initiatives-execution | wc -l
#   oczekiwane: ok. 105 wywołań (import + call sites) w ok. 46 plikach produkcyjnych pod
#   server/src/domain/initiatives-execution/. To jest promień rażenia zmiany sygnatury —
#   dlatego R1a zakazuje jej dotykać.

# (W10) T10 — createExecutionTask ma żywego wołacza produkcyjnego POZA runnerem
grep -rln "createExecutionTask" --include="*.ts" --include="*.tsx" . | grep -v node_modules | grep -v __tests__ | grep -v realdb
#   oczekiwane: server/src/routes/pmo/initiativesExecutionRuntime.routes.ts jest wśród
#   wyników — to jest żywa trasa HTTP tworzenia zadań, używająca TEJ SAMEJ funkcji co runner.

# (W11) T11 — case_version_after przechowuje wersje execution_task (zawsze 1), nie execution_case
sed -n '305,362p' server/scripts/legacy-task-cutover-runner.ts
#   oczekiwane: `caseBefore = caseRow.rows[0].version` (:315), `result = await
#   createExecutionTask(...)` z `expectedVersion:0` dla agregatu execution_task (envelope w
#   :316-343) -> `result.aggregateVersion` jest zawsze `1`; ten sam `result.aggregateVersion`
#   jest wiązany do kolumny `case_version_after` w INSERCIE (:344-360, siódmy parametr $7 na
#   linii :356). Wersja execution_case po rollupie (`caseBefore+1`) NIGDZIE nie jest zapisana.

# (W12) T12 + bezpiecznik FIX-204-4 — napięcie z planem kanonicznym I dowód, że loopback działa
grep -n "Destrukcyjny rollback" docs/program/funkcje/PLAN_MIGRACJI_TASKS_KANON.md
sed -n '287,300p' docs/program/funkcje/PLAN_MIGRACJI_TASKS_KANON.md
grep -n "allowOnlyLoopback" server/scripts/legacy-task-cutover-runner.ts
#   oczekiwane: `PLAN_MIGRACJI_TASKS_KANON.md:299` (w sekcji A6) — "Destrukcyjny rollback jest
#   odrzucony. […] Strategia to forward repair" — w napięciu z zamówieniem R3, do jawnego
#   rozstrzygnięcia zakresu (patrz R3a). Oraz: `allowOnlyLoopback: true` na
#   legacy-task-cutover-runner.ts:402 — bezpiecznik FIX-204-4 istnieje na Twojej bazie i MA
#   działać dalej, nie budujesz go od nowa.
```

---

### §0.4a — pomiar zasięgu testów (warunek oddania raportu, patrz `Z24`)

Zanim ogłosisz jakikolwiek wynik testów, zmierz zasięg PEŁNYMI NAZWAMI, nie liczbami:

1. PRZED zmianami produktu: uruchom pakiet(y) testów wskazane w licencji z
   `--reporter=json` (albo zapisz listę `describe/it` z wyjścia) i zapisz do
   artefaktów plik `przed-nazwy.txt` — po jednej PEŁNEJ nazwie testu na wiersz.
2. PO zmianach: to samo do `po-nazwy.txt`.
3. Do raportu wchodzi: `diff przed-nazwy.txt po-nazwy.txt` — nazwy DODANE (twoje
   nowe testy) i nazwy ZNIKNIĘTE (każda zniknięta = wyjaśnienie albo STOP).
   `N passed` bez nazw NIE jest pomiarem. „Ta sama liczba" przy innym składzie
   nazw to fałszywa zieleń (Z37).
4. Przepisanie liczby z instrukcji, cudzego raportu albo rejestru = zawyżenie
   i podstawa odrzucenia raportu. Liczysz sam, u siebie, na swojej bazie.

---

### 0.2. Bezwzględne ZAKAZY — `Z1`–`Z40`

| # | Zakaz | Dlaczego (incydent) |
| --- | --- | --- |
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day216-odwracalnosc-20260831` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6156`. Twój JEDYNY port harnessu to `5102 i 5103`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day216-pg`**. **ZAKAZANE:** `zajęte 6012, 5433, 6047, 6054-6155, 5010-5101, 6404-6411. ★★ ZABRONIONE na przód: 6157, 5104-5105 (dyżur 217, biegnie równolegle). ★ Zakazane na stale: port 5000 (macOS Control Center), port 5037 (adb), porty 5060-5061 (SIP/ERR_UNSAFE_PORT). Twój WYLACZNY przydział to baza 6156 i harness 5102 i 5103 — nic więcej. Sprawdź sam `lsof -i` i `docker ps` przed startem i wpisz wynik do raportu.`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `Brak. Ten dyżur nie dotyka żadnej flagi `ENABLE_*` ani żadnego ekranu za flaga — to narzędzie operacyjne (CLI dla migracji danych), nie ścieżka produktowa z powierzchnia wizualna. `Z10`/`Z11` w części "nowa flaga" nie mają tu zastosowania, ale ZAKAZ zmiany wartości domyślnej JAKIEJKOLWIEK istniejącej flagi nadal obowiązuje w pełni — ten dyżur i tak żadnej flagi nie czyta ani nie zapisuje.`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/scripts/lib/scriptDatabaseTarget.ts` (`resolveScriptDatabaseTarget`, `allowOnlyLoopback` z FIX-204-4) · `server/src/config/databaseTargetResolver.ts` (`assertNoLocalDatabaseOutsideTests`, `assertNoPrivateRailwayDbHostOutsideRailway`, denylist produkcji) · `server/src/domain/initiatives-execution/materialCommand.ts` (strażnik CAS agregatu w `executeMaterialCommand:496-514`, walidacja koperty `validateEnvelope`) · `tests/integration/_helpers/assertRealPostgres.ts` · `tests/setup.ts` · `vitest*.config.ts` · `server/vitest.config*.ts`. ★★ ŻADNEJ Z NICH NIE ZMIENIASZ w sensie osłabienia — nowa metoda `MaterialCommandTransaction` (R1a) jest DOPISANIEM, nie zmiana istniejącej bramki.`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY216_ODWRACALNOSC_REPORT.md`. Nie zmieniasz żadnego `MODULE_ACCEPTANCE.md` — ten dyżur jest przekrojowym narzędziem technicznym (migracja danych), nie modułem menu głównego. Uzasadnienie do potwierdzenia przez Ciebie: sprawdź, czy w `docs/program/waves/WAVE_03_ACCEPTANCE/modules/**` istnieje wpis dla "migracji"/"legacy cutover" tasks (oczekiwany wynik: brak, bo to nie jest ekran użytkownika). ★ Jedyny inny dokument do zmiany: `docs/program/funkcje/PLAN_MIGRACJI_TASKS_KANON.md` — WYŁĄCZNIE dopisanie nowej podsekcji pod §A6 opisującej zbudowane cofnięcie i jego zakres (lokalne/pilotowe, nigdy produkcyjne/współdzielone), BEZ zmiany istniejącego zdania "Destrukcyjny rollback jest odrzucony" (`:299`) — Twój wpis to DOPRECYZOWANIE zakresu tego zdania dla środowisk efemerycznych, nie jego uchylenie. ZAKAZ zmiany treści §A1-A5, A7-A9 tego dokumentu.. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day216-odwracalnosc-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
| `Z14` | **Nie zmieniasz `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md`** i nie podważasz decyzji w kodzie. Uważasz, że decyzja się myli → **errata w raporcie** | SSOT decyzji właściciela |
| `Z15` | **Zero modelu językowego w tym dyżurze.** Żaden pomiar, strażnik ani ekran nie woła `llmService`, `/api/ai/**` ani `GoogleGenerativeAI` | `DEC-51` — zakaz atrapy AI; bezpieczeństwo nie ma prawa zależeć od sieci |
| `Z16` | **Nie usuwasz i nie „naprawiasz" uczciwych stanów pustych, `503 not_configured`, `null`, `UNKNOWN` ani nagrobków `410`** | „Zero placebo i atrap"; uczciwy `503` jest wzorcem POPRAWNYM |
| `Z17` | **Zakaz wszystkiego poza zakresem tego dyżuru** — z imiennymi licencjami z tabeli licencji | Podział front/tył i rozłączność z dyżurami równoległymi |
| `Z18` | **★★ NAJOSTRZEJSZY — ABSOLUTNY zakaz modyfikowania globalnej infrastruktury testowej:** `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest.config.ts`, każdy `vitest.*.config.ts`, `server/vitest.config*.ts`, `tests/integration/_helpers/assertRealPostgres.ts` | Jedna zmiana globalnego mocka fałszuje wynik całego korpusu |
| `Z19` | **Nie odmontowujesz i nie kasujesz żadnego routera, middleware ani joba CI zamontowanego dziś** | Odmontowanie trasy potrafi zabić ekran, którego nie mierzysz; bramki znikają łatwiej, niż wracają |
| `Z20` | **★★ ZAKAZ uruchamiania testów DB bez jawnego kompletu env wskazującego kontener TEGO dyżuru, W TEJ SAMEJ LINII komendy.** Kolejność BLOKU 0 jest wiążąca: **NAJPIERW kontener + pełne migracje, DOPIERO potem jakikolwiek pomiar** | Trzy incydenty zapisu do cudzej bazy |
| `Z21` | **DoD wymaga DOWODU OSIĄGALNOŚCI, nie istnienia pliku** (`DEC-2026-08-26-104`). Pełna ścieżka: realne wejście HTTP → realny `ApiGateway` → `verifyToken` → trasa → handler → zapytanie → **wiersz w Twojej bazie** → odczyt, który ten wiersz podnosi → konsument w `src/` **albo jawne zdanie „brak konsumenta"** | Istnienie kodu ≠ działanie |
| `Z22` | **★★ Test wstrzykujący zależności albo montujący router w gołym `express()` NIE dowodzi ścieżki produkcyjnej** (`DEC-2026-08-26-107`). Dowodem jest `ApiGateway.getInstance().initializeRoutes(app)` | Replika rozjeżdża się z produkcją i nikt tego nie zauważa |
| `Z23` | **★★ ZERO ATRAP.** `200` z pustą kopertą tam, gdzie zapytanie padło, jest atrapą. `0` tam, gdzie wartość jest nieznana, jest atrapą. Ekran, który zapisuje do magazynu, którego nikt nie czyta, jest atrapą. Przycisk bez trasy jest atrapą | `DEC-2026-08-25-21/22`, `DEC-51` |
| `Z24` | **Pomiar zasięgu testów wg `§0.4a` jest warunkiem oddania raportu.** Zawężony wybór albo **przepisanie cudzej liczby** = zawyżenie i podstawa odrzucenia | Liczby autora instrukcji i nadzorcy krążą po dokumentach i utrwalają się jako „fakt" |
| `Z25` | **★★ Testy realdb WYŁĄCZNIE z jawnym `DATABASE_URL` wskazującym Twój efemeryczny kontener.** `tests/setup.ts` ma bezpiecznik i rzuca błędem zamiast fallbacku | **Port `5432` NASŁUCHUJE i nie jest Twój** — fallback = zapis do cudzych danych |
| `Z26` | **★★ Komplet env w tej samej linii — patrz `§0.2c`.** Bez `MOCK_DB=false` odczyty idą cicho na atrapę bazy; bez `ENABLE_V8_GLOBAL=true` część tras daje `404` **przed uwierzytelnieniem**; bez `ENABLE_TEST_AUTH_BYPASS=false` `verifyToken` **jest omijany** | Tak zginął dzień 23 |
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day216-odwracalnosc-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
| `Z28` | **★★ ZERO POŁĄCZEŃ DO RAILWAY, DEMO, STAGINGU I PRODUKCJI — w każdą stronę i każdym narzędziem.** Zakaz obejmuje `railway` CLI, `psql`/`docker exec psql` do hosta innego niż `127.0.0.1`, `curl`/`wget`/`fetch` do `*.railway.app`, `demo.consultify.ai`, `consultify.ai`, `staging.*` | Produkcja NIETYKALNA; demo i staging są jedną bazą. **To jedyny zakaz, którego naruszenie zatrzymuje CAŁY dyżur** |
| `Z29` | **★★ Testy o kształcie „atak odrzucony + readback bez zmian" MUSZĄ biec BEZ PONAWIANIA: `--retry=0` w KAŻDEJ komendzie** i `retry: 0` w opcjach `describe`/`it`, jeśli plik je ustawia | `vitest.config.ts` ustawia `retry: CI ? 3 : 1`. Przy otwartej dziurze pierwszy przebieg realnie zmienia stan, asercja pada, Vitest ponawia — i test **raportuje `PASS` mimo otwartej dziury**. Udowodnione na module Partner |
| `Z30` | **★★ ZAKAZ REALNEJ WYSYŁKI E-MAILI, ZAPROSZEŃ KALENDARZOWYCH I POWIADOMIEŃ.** Przed pierwszym przebiegiem zapisującym **udowodnij w raporcie**, że dostawca poczty jest atrapą — protokół `§0.2b` | Wysłany e-mail i zaproszenie kalendarzowe są **nieodwracalne** i trafiają do skrzynek osób trzecich |
| `Z31` | **★★ ZAKAZ PRZYPINANIA STRAŻNIKA TESTU REALDB DO HOSTA, PORTU ALBO NAZWY BAZY.** Wołasz `await assertRealPostgresTestEnvironment()` **BEZ ARGUMENTÓW**, w szczególności bez `expectedDatabase` | Dyżur 43 przypiął strażnik do swojej bazy: po usunięciu kontenera **30 przypadków dowodowych stało się trwałym `SKIP`**, pakiet raportuje `exit 0` i wygląda jak sukces |
| `Z32` | **★★ ZAKAZ WPISU `FIXED` / `VERIFIED` / `ZROBIONE_WG_DoD` BEZ DOWODU MUTACYJNEGO W OBIE STRONY.** Psujesz kod produkcyjny → test **CZERWONY**; cofasz → test **ZIELONY**; `git diff` po cofnięciu **pusty**. Obie komendy i oba wyniki dosłownie w raporcie. Mutację cofasz przez `cp` (`Z27`), nigdy `git stash` | Dyżur 44 wpisał `FIXED` dla podatności, **która nigdy nie istniała** — test przechodził także przed zmianą, bo asercja była tautologią |
| `Z33` | **★★ PRZED KAŻDYM POMIAREM SPRAWDZASZ, CZY STRAŻNIK, KTÓRY MIERZYSZ, NIE WYŁĄCZA SIĘ SAM W TRYBIE TESTOWYM** — ramka `§0.2d` | Na `resultsInternalBetaVisibility.middleware.ts` zmierzono **416 fałszywych twierdzeń** o uprawnieniach jednego modułu |
| `Z34` | **★★ GREP DOWODZI, ŻE ŁAŃCUCH ISTNIEJE, NIE ŻE DZIAŁA.** Zdanie „działa" wolno Ci napisać wyłącznie po realnym żądaniu HTTP przez realny `ApiGateway`, z podpisanym JWT, na realnym Postgresie po pełnych migracjach — **i po zapisaniu KODU ODPOWIEDZI** | 28.08 w module kalendarza zmierzono kompletny łańcuch komponent → `fetch` → trasa → handler → `INSERT`. **Każdy realny `POST` zwracał `500`**, bo `req.db` nigdy nie było ustawiane w tej gałęzi montażu |
| `Z34a` | **★★ PO PIERWSZYM COMMICIE ROBISZ PUSH NA `github-backup`**, a potem po każdej pozycji | 28.08 trzy dyżury pracowały cały dzień bez kopii zapasowej |
| `Z35` | **Zakaz „naprawiania" przez wyciszanie:** `@ts-ignore`, `@ts-expect-error`, `eslint-disable`, `.skip`, `.todo`, poszerzanie `exclude`/`testIgnore`, obniżanie progów pokrycia, `--max-warnings`, `continue-on-error: true` na jobie testowym. Uznajesz to za jedyne wyjście → **STOP z uzasadnieniem**, nie cichy commit | To jest choroba, którą program leczy, a nie narzędzie do jej leczenia |
| `Z36` | **Zakaz `eslint --fix` i `prettier --write` na czymkolwiek szerszym niż plik, który i tak zmieniasz z innego powodu.** Zakaz `--fix` na katalogu, na `.`, na globie | Autofix dotknąłby tysięcy plików i skasował pracę **wszystkich** równoległych dyżurów |
| `Z37` | **Porównania testów po NAZWACH przypadków (`fullName`), NIGDY po liczbach.** „Było 300 PASS, jest 300 PASS" nie jest dowodem — jeden test mógł zgasnąć, a drugi się zapalić | Wektor maskowania regresji |
| `Z38` | **Zakaz usuwania i odmontowywania jakiegokolwiek joba CI.** Wolno dodać, wolno poprawić warunek. Usunięcie = STOP z rekomendacją | Bramki znikają łatwiej, niż wracają |
| `Z39` | **Zakaz uruchamiania realnych workflow GitHub Actions** — `gh workflow run`, `gh run rerun`, `act` z realnymi sekretami, push wyzwalający CI na `main`/`develop`/`Londyn`/`demo`. Dowód robisz **statycznie** | Realny przebieg CI dotyka sekretów i środowisk poza Twoją kontrolą |
| `Z40` | ★★ **Zero połączeń do stagingu/demo/produkcji w KTÓRYMKOLWIEK skrypcie, w tym w NOWYM skrypcie cofającym** (`Z28`, `Z9`). Pilot na stagingu (D-13) wykonuje WYŁĄCZNIE nadzorca, osobnym dyżurem (219, `docs/program/funkcje/LISTA_DYZUROW_211_222.md:70-73`) — Ty nie dotykasz niczego poza efemerycznym lokalnym kontenerem tego dyżuru. ★★ **Nie zmieniasz sygnatury ani semantyki `executeMaterialCommand`** (`materialCommand.ts:457`, 105 wywołań w ~46 plikach produkcyjnych) poza dodaniem elementu, którego pozostałe wołania nie muszą przyjąć. Zmiana szeroka jest podstawa odrzucenia pozycji R1. ★★ **`createExecutionTask` (`executionWork.ts:124-185`) ma żywego wołacza produkcyjnego poza tym dyżurem** — trasę HTTP `server/src/routes/pmo/initiativesExecutionRuntime.routes.ts`. Jej zewnętrzne zachowanie dla TEGO wołacza ma zostać bajt w bajt takie samo; dowód to zielony `tests/integration/initiatives-execution/executionWork.realdb.test.ts` BEZ zmian w tym pliku. ★★ **Zakaz wariantu `PENDING`-przed-zapisem bez równoczesnego rozszerzenia strażnika statusu** w `migrateOneTask` — to jest udokumentowana przez FIX-204 pułapka blokująca ponowienie na stale (patrz T6, R1b). ★★ **Destrukcyjny rollback jest odrzucony przez kanoniczny plan migracji dla środowisk współdzielonych** (`docs/program/funkcje/PLAN_MIGRACJI_TASKS_KANON.md:299`, sekcja A6, T12) — NOWY skrypt cofający wolno zbudować WYŁĄCZNIE jako narzędzie dla lokalnego/pilotowego przebiegu, jawnie tak oznaczone w nagłówku pliku i w komunikacie startowym, i wolno Ci WYŁĄCZNIE doprecyzować (nie uchylić ani skasować) odpowiednie zdanie w dokumencie planu. Jeśli po zmierzeniu uznasz, ze nawet zawężony zakres jest zbyt ryzykowny — to jest STOP MERYTORYCZNY tej pozycji z opisem, nie ciche pominięcie napięcia. ★★ **Nie myl `legacy-task-cutover-runner.ts` (ten dyżur) z `legacyCutoverKernel.ts`/`CUTOVER_REGISTRY`** (`server/src/services/legacyCutover/**`) — to jest INNY, niepowiązany system (odwracalne bramki zapisu za flaga dla modułów Finance/Partner/Results/etc., z własnym `rollbackRehearsal.pg.test.ts`), który przypadkiem dzieli słowa "legacy cutover" w nazwie. Zero zapisu w tym katalogu, nawet przypadkowego. ★★ **Zabezpieczenie bez testu, który czerwienieje po jego usunięciu, jest nieudowodnione** (`docs/program/funkcje/WSPOLNA_PRZYCZYNA_ODBIORY_204_210.md`) — każda z trzech pozycji (R1, R2, R3) wymaga dowodu mutacyjnego w OBIE strony. Test scenariusza użycia nie liczy się jako dowód. ★★ **Oba strażniki idempotencji z FIX-204 (`NOT EXISTS` selektora w `selectCandidateTasks`, checksum-continue w `migrateOneTask`) MUSZĄ nadal czerwienieć pod mutacją PO Twoich zmianach** — odtwórz mutacje A i B z `docs/program/funkcje/ODBIOR_204.md` §6 na swoim kodzie, wklej wynik. To jest regresja na cudzej, już przyjętej pracy, nie nowy wymóg. ★★ **`Z31` — zakaz pinowania strażnika realDB do hosta/portu/nazwy bazy.** Wołasz `await assertRealPostgresTestEnvironment()` BEZ argumentów, wzorem `day204-r1-mines.realdb.test.ts:50`. ★★ **`Z29` — testy "atak odrzucony/stan bez zmian" biegną z `--retry=0`** w każdej komendzie i w opcjach `describe`/`it`, jeśli plik je ustawia. ★★ **`Z27` — zakaz `git stash`** w każdej postaci; dowody mutacyjne przez `cp` do `/private/tmp/cx-day216-odwracalnosc-scratch` i powrot przez `cp`. ★ **Zero nowej migracji schematu dla R2** (T5 — schemat już dopuszcza PENDING/FAILED); migracja jest dozwolona WYŁĄCZNIE jeśli R3c wybierze wariant `ROLLED_BACK` zamiast DELETE z ledgera, w wolnym przedziale zaczynającym się od `20261723`. ★ **Sprzątanie kontenera: `docker rm -f -v`** — z flaga `-v`. ★ **Ten dyżur nie ma powierzchni wizualnej** — zakaz tworzenia `dev-render/screens/*`, reguły zrzutów (`Z11`, mean_luma) nie mają tu zastosowania. | Przed nami przeniesienie 467 zadań (265 osobistych) z 67 inicjatyw do 14 domów kanonicznych — realnej pracy realnych ludzi, zmierzonej na stagingu wg decyzji właściciela D-12 (`docs/program/funkcje/DECYZJE_WLASCICIELA_2026-08-30_WIECZOR.md:38`, wynik w `CODEX_DAY197_MIGRACJA_E1_REPORT.md:258-259`). D-13 (`:39`) rozstrzygnęła sposób uruchomienia: pilot jednego rekordu, potem partie po 10, pilot na stagingu wykonuje NADZORCA. Ale pilot ma sens tylko wtedy, gdy z pilota da się wycofać — a dziś ta operacja NIE MA wyjścia awaryjnego. Karta odbioru dyżuru 204 (`docs/program/funkcje/ODBIOR_204.md:19-26`) nazywa to wprost jako świadomie odłożone: "Świadomie NIEZROBIONE (punkt 5, atomowość ledgera): wymaga rozszerzenia współdzielonego interfejsu transakcji, a wariant PENDING przed / MIGRATED po wpadałby we własnego strażnika checksumy i blokował ponowienie na stale. Zostawione jawnie zamiast połowicznie — osobny dyżur." oraz "Nadal otwarte z karty: rollback nie istnieje (jest pełny ślad forensyczny: canonical_id, wersje przed/po, batch_id, checksum); ledger nigdy nie zapisuje FAILED — throw przerywa partie bez śladu." Lista dyżurów (`docs/program/funkcje/LISTA_DYZUROW_211_222.md:52-55`) nazywa ten dyżur wprost pozycja 216, "Atomowość i odwracalność migracji (204 pkt 5-6)", z zyskiem: "migracja 467 zadań przestaje być operacja bez wyjścia awaryjnego". Bramka jakości tego dyżuru nie jest wymysłem autora instrukcji — jest odpowiedzią na zmierzony wzorzec awarii: `docs/program/funkcje/WSPOLNA_PRZYCZYNA_ODBIORY_204_210.md` pokazała, że w TRZECH z czterech odbiorów 31.08 (w tym w DOKŁADNIE TYM SAMYM runnerze, dyżur 204) testy zostały zielone PO skasowaniu zabezpieczenia, bo pisane były wzdłuż scenariusza użycia i nigdy nie próbowały go ominąć: "Zabezpieczenie bez testu, który czerwienieje po jego usunięciu, jest nieudowodnione. Test scenariusza użycia nie liczy się jako dowód zabezpieczenia." Każda z trzech pozycji tego dyżuru ma bramkę zbudowana według tej reguły: dowód mutacyjny w obie strony, nie zielony happy-path. |

---

### 0.2b. ★★ PROTOKÓŁ `Z30` — ZERO WYSYŁKI, A MIMO TO PEŁNY DOWÓD

**(1) Czego NIE WOLNO Ci zrobić — nigdy:**
- ★ **UWAGA — SPROSTOWANIE 2026-08-30.** Ten szkielet wymieniał tu wcześniej
  przełącznik `ENABLE_LIVE_EMAIL`. **Taka flaga NIE ISTNIEJE w kodzie** — `grep`
  po całym `server/src` i `src` daje zero trafień. Był to fantom, powielany
  w każdej wydanej instrukcji. **Nie szukaj go i nie raportuj, że jest wyłączony.**
  Realny warunek wysyłki jest inny i opisany w punkcie (2) poniżej: poczta wychodzi
  wyłącznie wtedy, gdy `emailService.ts:202` zobaczy **jednocześnie** `smtpConfig.host`
  i `smtpConfig.auth.user`, sklejone **najpierw z tabeli `settings`**, dopiero potem
  ze zmiennych środowiskowych. Bez tych dwóch wartości serwis pisze na konsolę;
- ustawić `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_PORT`, `SMTP_FROM`
  w środowisku, w `.env*`, w `docker-compose*` ani nigdzie indziej;
- wstawić wiersza konfiguracji SMTP do tabeli ustawień w swojej bazie;
- uruchomić serwera pełnym `server/src/index.ts` **na potrzeby testów** — tam
  startują drenaże outboxów; testy montują `ApiGateway`, nie cały serwer
  (`Z22`);
- uruchomić `server/src/index.ts` na potrzeby zrzutów inaczej niż przez
  kanoniczny `scripts/dev/start-wave3-owner-runtime.mjs` i bez spełnienia
  wszystkich warunków z punktu (4) poniżej;
- wywołać ręcznie żadnej funkcji `drain*` / `startNotificationOutboxDrainCron`
  / `outboxWorker`.

**(2) Trzy dowody, które wklejasz do raportu ZANIM uruchomisz cokolwiek
zapisującego:**

```bash
cd /private/tmp/cx-day216-odwracalnosc

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day216-pg psql -U postgres -d cx216 \
  -c "SELECT key, left(coalesce(value,''),8) FROM settings WHERE key LIKE 'smtp%';"
#   oczekiwane: 0 wierszy. Jezeli tabela `settings` nie istnieje — wklej TEN blad,
#   to tez jest dowod (nie ma skad wziac konfiguracji poczty).

# (c) dla TESTOW: zaden drenaz outboxu nie dziala w procesie testowym
grep -n "startNotificationOutboxDrainCron\|outboxWorker\|platformOutboxDrainCron" server/src/Gateway.ts
#   oczekiwane: 0 trafien — drenaze startuja w server/src/index.ts, ktorego NIE uruchamiasz
```

**(3) Deklaracja obowiązkowa dla TESTÓW w raporcie, dosłownie:**
**„Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie
zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani
żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało
wysłane."**

**(4) Wyjątek wyłącznie dla ZRZUTÓW ODBIOROWYCH — pełny produkt, nie replika.**
Pełny `server/src/index.ts` wolno uruchomić wyłącznie przez kanoniczny
`scripts/dev/start-wave3-owner-runtime.mjs`, po wykonaniu dowodów (a) i (b),
oraz tylko gdy wszystkie poniższe warunki są spełnione imiennie:

- runtime pracuje wyłącznie na efemerycznej lokalnej bazie dyżuru pod
  `127.0.0.1`, na zasobach przydzielonych w instrukcji; nie wolno adoptować
  bazy zawierającej jakikolwiek klucz `smtp%`;
- środowisko procesu serwera pochodzi z `childEnv(...)`, ma
  `DOTENV_DISABLED='1'` i nie zawiera `SMTP_*`, `RESEND`, `SENDGRID` ani
  `MAIL*`; trzeba to potwierdzić dla uruchomionego procesu, nie tylko dla
  powłoki wywołującej;
- zapytanie z dowodu (b), wykonane po wszystkich migracjach i seedach, zwraca
  `0` wierszy bezpośrednio przed startem runtime'u;
- nie ustawiasz flag drenaży na `true`, nie wywołujesz żadnego drenażu ręcznie
  i nie wykonujesz żadnej operacji, która tworzy wiadomość, zaproszenie lub
  powiadomienie; runtime służy wyłącznie do odczytu i wykonania zrzutów;
- po starcie ponownie sprawdzasz środowisko należącego do Ciebie procesu oraz
  log serwera. Trafienie konfiguracji poczty, próby realnego transportu albo
  niejednoznaczność dowodu oznacza natychmiastowe zatrzymanie runtime'u i STOP
  całego dyżuru (`Z30`).

Brak konfiguracji nie wyłącza samych drenaży: w runtime z realną bazą startują
one domyślnie. Ochroną jest fail-closed protokół powyżej — `emailService`
tworzy realny transporter dopiero przy jednoczesnej obecności hosta i
użytkownika SMTP; bez nich pozostaje atrapą konsolową. Dowody (a) i (b)
obowiązują zatem zarówno testy, jak i zrzuty odbiorowe.

**Deklaracja obowiązkowa dla ZRZUTÓW ODBIOROWYCH w raporcie, dosłownie:**
**„Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie
zawiera wierszy konfiguracji SMTP. Uruchomiłem `server/src/index.ts` wyłącznie
przez kanoniczny `scripts/dev/start-wave3-owner-runtime.mjs`, na lokalnej bazie
dyżuru, tylko w celu wykonania zrzutów. Zweryfikowałem środowisko procesu i log
serwera zgodnie z `§0.2b` (4). Żaden e-mail, zaproszenie kalendarzowe ani
powiadomienie zewnętrzne nie zostało wysłane."**

**Ostrzeżenie wsteczne (`DEC-2026-08-29-314`):** dyżury `70`, `72`, `73`,
`76`, `81` i `85` uruchomiły kanoniczny runtime do zrzutów, przez co
sześciokrotnie naruszyły wcześniejsze bezwarunkowe brzmienie `§0.2b`. Do szkody
nie doszło, ponieważ niezależny protokół `Z30` wymagał wykazania, że dostawca
poczty jest atrapą. To ostrzeżenie nie znosi zakazu ani nie zastępuje dowodów.

---

### 0.2c. ★★ KOMPLET ZMIENNYCH ŚRODOWISKOWYCH — TRZY WARIANTY, ZAWSZE W JEDNEJ LINII

**Zmienna postawiona `export`-em wcześniej NIE LICZY SIĘ.** `vitest.config.ts`
przybija część wartości (`DB_TYPE='sqlite'`), więc komplet musi stać
**w tej samej linii komendy** — i masz **udowodnić, że nadpisał**, a nie założyć.

**(A) MIGRACJE — pełny łańcuch, przed jakimkolwiek pomiarem (`Z20`):**

```bash
cd /private/tmp/cx-day216-odwracalnosc

docker run -d --name cx-day216-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx216 \
  -p 127.0.0.1:6156:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day216-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6156/cx216 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6156/cx216 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day216-odwracalnosc && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6156/cx216 \
JWT_SECRET=cx216-test-secret-do-not-reuse \
npx vitest run tests/integration/day216-legacy-task-cutover-atomicity.realdb.test.ts oraz tests/integration/day216-legacy-task-cutover-failed-status.realdb.test.ts oraz tests/integration/day216-legacy-task-cutover-rollback.realdb.test.ts (nowe) oraz REGRESJA: tests/integration/day204-legacy-task-cutover-idempotency.realdb.test.ts oraz tests/integration/day204-legacy-task-cutover-runner-options.test.ts oraz tests/integration/day197-legacy-task-cutover.realdb.test.ts oraz tests/integration/day204-r1-mines.realdb.test.ts oraz tests/integration/initiatives-execution/executionWork.realdb.test.ts --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day216-odwracalnosc-artefakty/day216-odwracalnosc-legacy-migracja.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day216-odwracalnosc && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run tests/integration/day216-legacy-task-cutover-atomicity.realdb.test.ts oraz tests/integration/day216-legacy-task-cutover-failed-status.realdb.test.ts oraz tests/integration/day216-legacy-task-cutover-rollback.realdb.test.ts (nowe) oraz REGRESJA: tests/integration/day204-legacy-task-cutover-idempotency.realdb.test.ts oraz tests/integration/day204-legacy-task-cutover-runner-options.test.ts oraz tests/integration/day197-legacy-task-cutover.realdb.test.ts oraz tests/integration/day204-r1-mines.realdb.test.ts oraz tests/integration/initiatives-execution/executionWork.realdb.test.ts --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day216-odwracalnosc-artefakty/day216-odwracalnosc-legacy-migracja.json
```

**To NIE jest naruszenie `Z26`, tylko warunek `Z25`:** bez `DATABASE_URL`
`tests/setup.ts` rzuciłby błędem przy `RUN_DB_TESTS=1`.
**Nigdy nie mieszasz: pakiet jednostkowy NIE jest dowodem egzekucji.**

**Znaczenie każdej zmiennej — musisz je znać, zanim ją wpiszesz:**

| Zmienna | Co się stanie, gdy jej zabraknie |
| --- | --- |
| `RUN_DB_TESTS=1` | `tests/setup.ts` pomija testy bazodanowe; pakiet raportuje `exit 0` |
| `MOCK_DB=false` | odczyty idą **cicho** na atrapę bazy, zapisy nigdzie nie lądują |
| `DB_TYPE=postgres` | `vitest.config.ts` przybija `sqlite` — mierzysz inny silnik, niż myślisz |
| `NODE_ENV=test` | runner migracji odmawia albo zwraca MOCK przy bazie lokalnej |
| `ENABLE_V8_GLOBAL=true` | część tras daje **fałszywe `404` PRZED uwierzytelnieniem** |
| `ENABLE_TEST_AUTH_BYPASS=false` | **`verifyToken` JEST OMIJANY** — każdy test uwierzytelniania przechodzi z fałszywego powodu |
| `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce` | strażnik przepuszcza wszystko przy `NODE_ENV=test` (416 fałszywych twierdzeń) |
| `DATABASE_URL` | fallback na `localhost:5432`, który **nasłuchuje i nie jest Twój** |
| `JWT_SECRET` | podpisany JWT nie przejdzie przez `verifyToken`; dostaniesz `401` z niewłaściwego powodu |
| `--retry=0` | test „atak odrzucony" **leczy się skutkiem własnego ataku** i raportuje `PASS` |

---

### 0.2d. ★★ ZNANE PUŁAPKI ŚRODOWISKA — OSIEMNAŚCIE, KAŻDA KOSZTOWAŁA GODZINY

**Czytaj to, ZANIM uznasz cokolwiek za zepsute.**

1. **Vault jest BARE + `extensions.worktreeConfig=true`.** Po `git worktree add`
   **musisz** utworzyć `<vault>/worktrees/cx-day216-odwracalnosc/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day216-pg psql -U postgres -d cx216 -c '…'`.
4. **Runner migracji wymaga `NODE_ENV=test` przy bazie lokalnej.** Bez tego
   strażnik localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
   (`server/scripts/migrate.postgres.ts:640-650`).
5. **`vitest.config.ts` (ok. `:209-210`) twardo ustawia `test.env.DB_TYPE='sqlite'`.**
   Zmienna z powłoki bywa nadpisywana — `DB_TYPE=postgres` musi stać
   **w tej samej linii komendy**, a Ty **udowadniasz w raporcie, że nadpisało**
   (asercja `expect(process.env.DB_TYPE).toBe('postgres')` w pierwszym `it`
   każdego nowego pakietu). Pliku **nie zmieniasz** (`Z18`).
6. **`JSON.parse` na kolumnie typu `json` działa na SQLite i wywala `500` na
   PostgreSQL** — sterownik `pg` zwraca już zdeserializowany obiekt. Jeżeli
   kolumny są `TEXT`, kształt `500` nie występuje, ale występuje kształt
   **cichej utraty danych**. Każdy `500` widoczny na PG a nie na SQLite sprawdź
   najpierw pod tym kątem (`DEC-2026-08-28-245`).
7. **CI NIE URUCHAMIA TESTÓW dla naszych gałęzi.** Joby `test-suite.yml` są
   warunkowane na `main`/`develop`, a my jesteśmy na `Londyn`/`demo`;
   `lint-typecheck` pada na zastanych błędach `tsc`, a `pr-gate` czyta wynik
   pominiętego joba jako sukces (`DEC-2026-08-28-246`). **„CI zielone" nie jest
   w tym repo żadnym dowodem.** Dowodem jest wyłącznie Twój przebieg z `--retry=0`.
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day216-pg`.
9. **Reporter `basic` NIE ISTNIEJE w tej wersji vitest** (`--reporter=basic` →
   `Failed to load custom Reporter from basic`). Do porównania nazw używasz
   `--reporter=json --outputFile=<plik poza repo>`.
10. **`npx vitest run` bywa kończy się `exit 0` mimo czerwonych testów** przy
    przekierowaniu wyjścia. **Nie ufaj kodowi wyjścia** — liczby i nazwy czytasz
    z JSON-a.
11. **Nowe pliki w `tests/` wymagają `git add -f`** (katalog bywa ignorowany
    częściowo). Sprawdzasz `git status --short` po każdym commicie.
12. **`| head` na grepie sierot produkuje FAŁSZYWE SIEROTY.** Werdykt „martwy
    komponent" wymaga grepu **bez obcięcia**, z wykluczeniem `__tests__`
    i komentarzy.
13. **ESM nie honoruje `NODE_PATH`.** Skrypt `.mjs` uruchamiany spoza repo nie
    znajdzie pakietów — rozwiązuj je przez `createRequire(REPO + '/package.json')`.
14. **Na remote `github-backup` NIE MA gałęzi `main`, `develop`, `Londyn` ani
    `demo`** — są na `origin` (`origin/develop` **stoi od 2026-06-02**).
    Pracujemy na linii `Londyn`/`demo`.
15. **`postgres:15` NIE PRZECHODZI migracji** — brak rozszerzenia `vector`.
    Obraz obowiązkowy: `pgvector/pgvector:pg16`.
16. **`prettier` na wielkich plikach potrafi przepisać cały plik.** W repo
    **nie ma** skryptu `format` — wołasz `npx prettier --write <pliki>` wprost.
    Jeżeli wynik reformatu przekracza ~3× liczbę Twoich linii merytorycznych —
    **cofasz reformat** (`cp` z kopii wg `Z27`, nigdy `git stash`), zostawiasz
    styl zastany i wpisujesz to do raportu.
17. **Istnieją testy tekstowe przez `readFileSync` + `toContain`,** które
    asertują **dosłowne linie kodu**. Reformat takiej linii wywala test.
    Jeżeli test zapali się od Twojego reformatu — **to jest regresja Twojego
    reformatu, nie „test do poprawienia"**: cofasz reformat.
18. **`npx vitest` z roota bez właściwego configu daje `No test files found`.**
    To **nie jest `PASS`** — to jest brak pomiaru.

---

> **★★ RAMKA DO `Z33` — PUŁAPKI, KTÓRE FAŁSZUJĄ ZIELONY PRZEBIEG.**
> **Zielona suita w tym repozytorium NIE JEST DOWODEM, dopóki nie wiesz, którą
> pułapkę omija.**
>
> **(a) `ENABLE_V8_GLOBAL` nieustawione → fałszywe `404` PRZED uwierzytelnieniem.**
> `server/src/middleware/v8FeatureGate.middleware.ts:15` czyta
> `process.env.ENABLE_V8_GLOBAL === 'true'`; przy braku zmiennej bramka odcina
> trasę **zanim** cokolwiek sprawdzi tożsamość. Twój test „obcy tenant dostaje
> `404`" przechodzi wtedy z całkiem innego powodu, niż myślisz.
>
> **(b) `resultsInternalBetaVisibility.middleware.ts` przepuszcza wszystko przy
> `NODE_ENV=test`,** dopóki nie ustawisz
> `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`. **Na tym strażniku
> zmierzono 416 fałszywych twierdzeń o uprawnieniach.**
>
> **(c) `vitest.config.ts` twardo ustawia `test.env.DB_TYPE='sqlite'`.** Część
> „testów bazodanowych" idzie na atrapę. `MOCK_DB=false DB_TYPE=postgres`
> w tej samej linii to jedyne wyjście; pliku nie zmieniasz (`Z18`).
>
> **(d) `ENABLE_TEST_AUTH_BYPASS`.** `server/src/middleware/auth.middleware.ts`
> zawiera gałąź: `if (NODE_ENV === 'test' && ENABLE_TEST_AUTH_BYPASS === 'true')`
> — czyli **`verifyToken` potrafi wyłączyć się sam w trybie testowym**.
>
> **(e) ★★ **Pierwsza, najgroźniejsza: rozszerzenie NIEWŁAŚCIWEJ warstwy.** `MaterialCommandTransaction` ma JEDNEGO implementatora (T8) — rozszerzenie GO jest tanie. `executeMaterialCommand` ma 105 wywołań w ~46 plikach (T9) — zmiana JEGO sygnatury jest droga i zakazana. Łatwo pomylić te dwie warstwy, bo obie żyją w tym samym pliku (`materialCommand.ts`). Rozszerzasz WYŁĄCZNIE interfejs, nigdy dyspozytor. ★★ **Druga: wariant `PENDING`-przed-zapisem wygląda jak oczywiste rozwiązanie atomowości i jest pułapka.** Intuicja mówi "zapisz PENDING zanim zaczniesz, żeby mieć ślad na wypadek crasha" — ale strażnik idempotencji w `migrateOneTask` (:278-286) porównuje WYŁĄCZNIE checksum, więc kolejny przebieg zobaczy PENDING z pasującym checksumem i zwróci NOOP, **na zawsze** pomijając zadanie, które nigdy naprawdę nie zostało zmigrowane. FIX-204 nazwał te pułapkę wprost w karcie odbioru — to nie jest Twoje odkrycie, to ostrzeżenie do przeczytania PRZED napisaniem kodu. ★★ **Trzecia: `case_version_after` kłamie nazwa.** Kolumna nazywa się tak, jakby przechowywała wersje `execution_case` po aktualizacji rollupu — a przechowuje wersje `execution_task` (zawsze `1`, T11). Każdy kod cofania, który zaufa tej kolumnie przy ustalaniu wersji `execution_case` do przywrócenia, będzie przywracał złą wersje. Do ustalenia poprawnej wersji użyj bezposredniego odczytu bieżącego stanu, nie tej kolumny. ★★ **Czwarta: destrukcyjny rollback jest ODRZUCONY przez własny kanoniczny dokument planu** (`PLAN_MIGRACJI_TASKS_KANON.md:299`, T12), a zamówienie tego dyżuru chce dokładnie destrukcyjnego rollbacku (cofnięcie do stanu identycznego jak przed). Łatwo przeoczyć to napięcie i albo zignorować dokument planu, albo odmówić budowy tego, co dyżur zamawia. Jedyne wyjście jest jawne rozstrzygnięcie zakresu (R3a): narzędzie działa WYŁĄCZNIE lokalnie/pilotowo, nigdy na środowisku, które ktokolwiek inny obserwuje — i to zdanie idzie do raportu, nie do domysłu. ★★ **Piata: cofnięcie samego wiersza zadania to NIE jest całe cofnięcie.** `createExecutionTask` mutuje TAKŻE rollup i wersje istniejącego agregatu `execution_case` (`caseAndRollup`, executionWork.ts:150-157) — to jest UPDATE istniejącego wiersza, nie INSERT nowego. Usunięcie wyłącznie nowego wiersza `execution_task` zostawi rollup `execution_case` na zawsze zawyżony o liczbę cofniętych zadań. Sprawdź to konkretnie w swoim dowodzie R3d — porównanie `diff` MUSI objąć tabele `ie_aggregate_state` w całości, nie tylko nowe wiersze. ★★ **Szosta: `legacyCutoverKernel.ts` to pułapka nazewnicza, nie zasób do wykorzystania.** System w `server/src/services/legacyCutover/**` ma słowo "rollback" we własnym teście (`rollbackRehearsal.pg.test.ts`) i brzmi kusząco jako gotowy wzorzec — ale to jest rollback FLAGI FUNKCYJNEJ (przywrócenie zamkniętej bramki zapisu), nie rollback DANYCH. Zero wzorca do przeniesienia stamtąd, zero importu, zero zapisu w tym katalogu. ★★ **Siodma: pętla bez try/catch dziś NIE JEST martwym kodem do naprawienia przy okazji — jest zamówionym zakresem R2, ale tylko dla tej JEDNEJ pętli.** Nie rozszerzaj obsługi błędów na inne miejsca runnera (np. `parseRunnerOptions`) poza tym, co R2 wymaga — to byłoby wyjściem poza licencję.**
>
> **Obowiązek dowodowy.** Dla **każdego** pakietu uruchomionego jako dowód
> czegokolwiek raport zawiera akapit: *która z pułapek (a)–(e) dotyczy tego
> pakietu, jak ją wyłączyłem, i co konkretnie dowodzi, że wyłączyłem*.
> Akapit „nie dotyczy" jest dopuszczalny **tylko** z komendą pokazującą, że dany
> strażnik nie leży na ścieżce. **Pomiar bez tego akapitu nie liczy się jako dowód.**

---

### 0.5. Reguła STOP

**Przy jakiejkolwiek wątpliwości MERYTORYCZNEJ: STOP tej POZYCJI i wpis
w raporcie — nigdy improwizacja. W tym programie zasadny STOP jest NAGRADZANY,
a zgadywanie karane** (dzień 23 dostał `SUPERVISOR_ACCEPT` za STOP,
`DEC-2026-08-26-130`).

**Rozróżnij dwa rodzaje:**

- **STOP MERYTORYCZNY** (mile widziany): zmierzyłeś i wyszło inaczej, niż mówi
  ta instrukcja; brakuje informacji, której nikt poza właścicielem nie
  dostarczy; naprawa wymaga decyzji produktowej. **Wpisujesz do raportu
  i IDZIESZ DALEJ do następnej pozycji.**
- **STOP PROCEDURALNY** (zakazany): „instrukcja jest sprzeczna", „ścieżka nie
  istnieje", „nie mam licencji na plik". **Ten rodzaj NIE zatrzymuje niczego** —
  patrz tabela niżej i sekcja końcowa.

### ★★ TABELA: STOP PROCEDURALNY ZAKAZANY — DZIAŁANIE ZASTĘPCZE

| Powód, dla którego chciałbyś stanąć | Co robisz ZAMIAST STOP-u |
| --- | --- |
| „Musiałbym zmienić plik przekrojowy (`auth.middleware.ts` / `Gateway.ts` / bramkę platformową)" | **Czerwony kontrakt testowy + brief wynikowy** (tabela licencji, wiersz 1). Pozycja jest wtedy **ZROBIONA**, nie STOP |
| „Plik, którego potrzebuję, nie jest w tabeli licencji" | Traktujesz go jako **tylko do odczytu** i dajesz czerwony kontrakt + brief. Pozycja **ZROBIONA** |
| „Instrukcja jest wewnętrznie sprzeczna" | Sekcja **„JEŚLI COŚ JEST SPRZECZNE"** na końcu dokumentu. Wybierasz interpretację **bezpieczniejszą**, opisujesz w „Korektach", **kontynuujesz pozostałe pozycje** |
| „Ścieżka podana w instrukcji nie istnieje" | Sprawdzasz `ls`, wpisujesz **swój wynik** do „Korekt", szukasz realnego odpowiednika i **idziesz dalej**. Rozbieżność pomiaru z instrukcją **nie jest sprzecznością — jest WYNIKIEM** |
| „Instrukcja podaje dwie różne liczby" | Mierzysz sam, podajesz **swoją** liczbę z komendą (`Z24`). To **nie jest** powód do STOP-u |
| „`git fetch` zwrócił błąd `icloud-source`" | To **nie jest** błąd. `§0.2d` pkt 2. Idziesz dalej |
| „`psql` nie istnieje na hoście" | `docker exec cx-day216-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day216-odwracalnosc-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1 — ATOMOWOŚĆ ZAPISU: dziś `createExecutionTask` (zapis kanonu, własna transakcja Postgresa wewnątrz `executeMaterialCommand`/`PostgresMaterialCommandUnitOfWork.transaction`) i INSERT do `legacy_task_cutover_ledger` (`pool.query`, POZA ta transakcja) to dwie niezależne operacje (`legacy-task-cutover-runner.ts:316` vs `:344-360`) — awaria między nimi zostawia kanoniczne zadanie zmigrowane bez śladu w rejestrze. Zadanie: zmierzyć mapę `MaterialCommandTransaction` (interfejs `materialCommand.ts:117-271`, 21 metod, ZERO surowego `query()`, JEDEN implementator produkcyjny `PostgresMaterialCommandTransaction`) i wykonać WĄSKIE rozszerzenie: nowa, jednotabelowa metoda (wzorem `appendAudit`/`appendOutbox`/`saveReceipt`) plus wyodrębnienie domknięcia `createExecutionTask` (`executionWork.ts:137-184`) do nazwanej funkcji wołanej z NOWEJ, dodatkowej funkcji dla ścieżki legacy-cutover, która woła ledger-insert na TYM SAMYM `tx` — BEZ zmiany sygnatury `executeMaterialCommand` (105 wywołań w ~46 plikach produkcyjnych, T9). Pułapka do ominięcia: wariant `PENDING`-przed-zapisem wpada w strażnika idempotencji `migrateOneTask:278-286`, który patrzy WYŁĄCZNIE na checksum, nigdy na `status` — blokuje ponowienie na stale (nazwane przez FIX-204). Bramka: test wymuszający awarię WEWNĄTRZ transakcji między zapisem kanonu a wpisem rejestru, dowód, że PO awarii NIE MA żadnego nowego wiersza w żadnej z sześciu dotkniętych tabel, plus mutacja odwrotna dowodząca load-bearing. Regresja: oba strażniki idempotencji z FIX-204 (`NOT EXISTS` w `selectCandidateTasks`, checksum-continue w `migrateOneTask`) MUSZĄ nadal czerwienieć pod mutacją po Twoich zmianach — odtwórz mutacje A i B z `ODBIOR_204.md` §6. R2 — REJESTR ZAPISUJE `FAILED`: `MigrateOutcome` (`:65`) ma dziś trzy warianty (`MIGRATED`/`SKIPPED`/`NOOP`), `FAILED` nie występuje ani razu mimo że schemat (`20261721_...sql:9`) go dopuszcza — schemat NIE wymaga zmiany (T5). Pętla `runLegacyTaskCutover` (`:386-390`) nie ma `try/catch` — każdy `throw` (w tym istniejący, łatwo odtwarzalny `CANONICAL_HOME_MISSING:...` na `:312-313`) przerywa cala partie bez śladu. Zadanie: rozszerzyć `MigrateOutcome` o `FAILED`, owinąć wywołanie `migrateOneTask` w try/catch, w catch zapisać wiersz `FAILED` z `reason_code` i kontynuować pętlę. Zdecydować jawnie, czy zadania `FAILED` sa automatycznie ponawiane (dziś `NOT EXISTS` selektora wyklucza KAŻDY wiersz w ledgerze niezależnie od statusu — więc bez dodatkowej zmiany NIE SA). Bramka: test wymuszający błąd na JEDNYM zadaniu w partii dwóch zadań (użyj istniejącego `CANONICAL_HOME_MISSING`), dowód, że partia idzie dalej (drugie zadanie `MIGRATED`) i wiersz `FAILED` istnieje z przyczyna, plus mutacja odwrotna (cofnięcie try/catch pokazuje czerwień). R3 — ŚCIEŻKA COFNIĘCIA PARTII: rollback nie istnieje w ogóle. Napięcie do rozstrzygnięcia jawnie PRZED kodem: `PLAN_MIGRACJI_TASKS_KANON.md:299` (§A6, kanoniczny) odrzuca destrukcyjny rollback na rzecz `forward repair` dla środowisk współdzielonych — Twój skrypt wolno zbudować WYŁĄCZNIE jako narzędzie dla lokalnego/pilotowego przebiegu (ten dyżur i tak nigdy nie dotyka stagingu/demo/produkcji, `Z28`/`Z9`), jawnie tak oznaczone, z doprecyzowaniem (nie uchyleniem) zdania w dokumencie planu. Zadanie: zmierzyć SZESC tabel dotkniętych przez każde zmigrowane zadanie (`ie_aggregate_state` x2 — UPDATE rollupu `execution_case` I INSERT nowego `execution_task`, `ie_aggregate_relations`, `ie_audit_events`, `ie_outbox_events`, `ie_command_receipts`, plus `legacy_task_cutover_ledger`), NIE ufać kolumnie `case_version_after` w ustaleniu wersji `execution_case` do przywrócenia (ta kolumna przechowuje wersje `execution_task`, zawsze `1` — zmierzony, wcześniej niezgłoszony defekt, T11), zbudować NOWY skrypt `server/scripts/legacy-task-cutover-rollback-runner.ts` z TYM SAMYM rygorem co runner migrujący (`--organization-id` wymagany fail-closed, `--batch-id` wymagany, dry-run domyślny, jawne potwierdzenie INNA zmienna niż migracja, limit, ten sam bezpiecznik `allowOnlyLoopback: true` z FIX-204-4 — zweryfikowany jako działający, nie zbudowany od nowa). Bramka: pełny cykl migracja partii -> cofnięcie -> `diff` migawek bazy PRZED migracja i PO cofnięciu (pusty, dla wszystkich sześciu tabel) -> ponowna migracja tej samej partii przechodzi (`MIGRATED`, nie `NOOP`), plus mutacja odwrotna dowodząca, że usunięcie wiersza ledgera przy cofnięciu jest load-bearing dla możliwości ponowienia.`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6156` albo `5102 i 5103` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6156` albo `5102 i 5103`** (`Z7`).

Format wpisu STOP:

```
### STOP — <pozycja>
Rodzaj: MERYTORYCZNY / PROCEDURALNY
Powód: <jedno zdanie>
Licencja, którą sprawdziłem: <cytat wiersza z tabeli licencji + wynik>
Dowód: <plik:linia albo komenda + wynik>
Co dostarczyłem ZAMIAST zmiany: <czerwony kontrakt / pomiar / gotowy diff / brief>
Co zrobiłbym, gdyby zapadła decyzja X: <2-3 zdania>
Rekomendacja dla nadzorcy: <co zmienić, gdzie, jaki promień rażenia>
Stan: NIE ZACOMMITOWANO / zacommitowano częściowo w <SHA>
Czy kontynuowałem pozostałe pozycje: TAK / NIE + dlaczego
```

**★★ STOP bez wypełnionego pola „Licencja, którą sprawdziłem" jest NIEZASADNY
z definicji. STOP bez wypełnionego pola „Co dostarczyłem ZAMIAST zmiany" jest
NIEZASADNY z definicji.**

---

## ★★ JEŚLI COŚ W TEJ INSTRUKCJI JEST SPRZECZNE LUB NIEWYKONALNE

**Ta instrukcja była pisana i sprawdzana przez człowieka i model. Może mieć
błędy. Nie zatrzymuj przez nie dyżuru.**

**Procedura, dosłownie:**

1. **Opisz sprzeczność w raporcie**, w sekcji „Korekty wobec instrukcji":
   **cytat obu wykluczających się zdań z numerami paragrafów**, na czym polega
   konflikt, jaki masz dowód i co zrobiłeś.
2. **Wybierz interpretację BEZPIECZNIEJSZĄ.** Reguły rozstrzygające,
   w tej kolejności:
   - **nie ruszaj cudzego pliku** — gdy nie wiesz, czy masz licencję, **nie
     masz**; traktuj plik jako tylko do odczytu i dostarcz czerwony kontrakt
     + brief;
   - **nie osłabiaj asercji** — gdy test przeszkadza, opisujesz go, nie
     zmieniasz;
   - **nie kasuj** — gdy werdykt jest niepewny, wpisz `DO DECYZJI WŁAŚCICIELA`
     ze zdaniem **„czego konkretnie mi zabrakło, żeby rozstrzygnąć
     samodzielnie"** (wiersz bez tego zdania liczy się jako nierozstrzygnięty);
   - **nie włączaj** — gdy nie wiesz, czy flaga ma być `ON`, zostaje `OFF`
     (`Z10`/`Z11`);
   - **nie wysyłaj niczego na zewnątrz** — gdy nie masz pewności co do `Z30`,
     nie klikasz;
   - **nie poszerzaj dostępu** — gdy bramka jest niejednoznaczna, **odmawiasz
     zamiast przepuszczać**;
   - **mierz zamiast zgadywać** — gdy instrukcja podaje liczbę, a Twój pomiar
     daje inną, **wiążący jest Twój pomiar z komendą** (`Z24`).
3. **KONTYNUUJESZ POZOSTAŁE POZYCJE.** Sprzeczność w jednym paragrafie nie
   zwalnia z pozostałych ani z raportu.
4. **Zatrzymanie CAŁEGO dyżuru** — wyłącznie z pięciu powodów wymienionych
   w `§0.5`.
5. **Nigdy nie „naprawiaj" instrukcji przez improwizację w kodzie.**
   Sprzeczność w dokumencie rozwiązuje się **wpisem w raporcie**, nie zmianą
   w produkcie.
6. **★ Rozbieżność między pomiarem a tą instrukcją NIE JEST sprzecznością —
   jest WYNIKIEM.** Każda liczba, linia i teza w tym dokumencie to **rozkaz
   pomiarowy**, nie prawda objawiona.

**★ Trzy najcenniejsze rzeczy, jakie możesz oddać:** dowód, że coś, co uchodziło
za działające, nie działa; dowód, że coś, co uchodziło za zepsute, jest sprawne;
i uczciwe zdanie „tego nie zmierzyłem, bo…".

**★ Ostatnie zdanie tej instrukcji i najważniejsze: obalenie którejkolwiek tezy
z sekcji „TEZY ZLECENIA…" jest SUKCESEM dyżuru, a nie porażką. Zapisz to
w „Korektach wobec instrukcji" z dowodem i idź dalej.**

---

# 1. PO CO TEN DYŻUR ISTNIEJE

`server/scripts/legacy-task-cutover-runner.ts` migruje zadania z legacy'owej tabeli
`tasks` do kanonu event-sourced (`ie_aggregate_state` + towarzyszące tabele). Dyżur 204
dowiózł go do stanu **SCALIĆ PO FIX** (`docs/program/funkcje/ODBIOR_204.md:1`, merge
`751c35e5bb`, FIX `ab638ae4f8` + `d9e47dcaec`): zakres organizacji fail-closed, pilot
`--max-tasks` domyślnie 1, idempotencja broniona dwoma strażnikami z dowodem mutacyjnym
w obie strony, bezpiecznik bazy odwrócony na loopback-first. To są **cztery** z sześciu
punktów karty odbioru.

Karta FIX-204 sama nazywa, co zostało **świadomie niedokończone**
(`docs/program/funkcje/ODBIOR_204.md:19-26`), dosłownie:

> Świadomie NIEZROBIONE (punkt 5, atomowość ledgera): wymaga rozszerzenia
> współdzielonego interfejsu transakcji, a wariant „PENDING przed / MIGRATED po"
> wpadałby we własnego strażnika checksumy i blokował ponowienie na stałe. Zostawione
> jawnie zamiast połowicznie — osobny dyżur.
>
> Nadal otwarte z karty: rollback nie istnieje (jest pełny ślad forensyczny:
> `canonical_id`, wersje przed/po, `batch_id`, checksum); ledger nigdy nie zapisuje
> `FAILED` — `throw` przerywa partię bez śladu.

**Ten dyżur jest tym „osobnym dyżurem".** Lista `docs/program/funkcje/LISTA_DYZUROW_211_222.md:52-55`
nazywa go wprost pozycją 216, „Atomowość i odwracalność migracji (204 pkt 5–6)", z zyskiem:
„migracja 467 zadań przestaje być operacją bez wyjścia awaryjnego".

**Skala, na której to ma znaczenie, jest zmierzona, nie szacowana.** Decyzja właściciela
D-12 (`docs/program/funkcje/DECYZJE_WLASCICIELA_2026-08-30_WIECZOR.md:38`) zamówiła
pomiar read-only na stagingu przed jakąkolwiek decyzją o uruchomieniu — wynik: **14 domów
kanonicznych / 67 inicjatyw z zadaniami / 467 zadań, w tym 265 osobistych**
(powtórzone w `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY197_MIGRACJA_E1_REPORT.md:258-259`).
D-13 (ten sam rejestr, `:39`) rozstrzygnęła sposób uruchomienia: **pilot jednego rekordu,
potem partie po dziesięć**, pilot na stagingu wykonuje **nadzorca**, nie Codex. Ten dyżur
nie rusza stagingu (`Z28`, `Z9`) — buduje wyłącznie mechanikę, na której nadzorca będzie
mógł się cofnąć, jeśli pilot pójdzie źle.

**Bramka jakości tego dyżuru nie jest moim wymysłem — jest odpowiedzią na zmierzony wzorzec
awarii.** `docs/program/funkcje/WSPOLNA_PRZYCZYNA_ODBIORY_204_210.md` zmierzyła, że w TRZECH
z czterech odbiorów 31.08 (w tym **204 — dokładnie ten sam runner**) testy zostały zielone
PO skasowaniu zabezpieczenia, bo test pisany był wzdłuż scenariusza użycia i nigdy nie
próbował ominąć strażnika. Cytat, dosłownie (`:39-41`):

> Zabezpieczenie bez testu, który czerwienieje po jego usunięciu, jest nieudowodnione.
> Test scenariusza użycia nie liczy się jako dowód zabezpieczenia. Wymagany jest osobny
> przypadek próbujący je **ominąć**.

Każda z trzech pozycji tego dyżuru (R1 atomowość, R2 `FAILED`, R3 cofanie) ma bramkę
zbudowaną dokładnie wg tej reguły: nie „zadziałało w happy-path", tylko „wymusiłem awarię
i sprawdziłem, że nie ma połowicznego stanu".

# 2. TEZY ZLECENIA

Każda z nich to **rozkaz pomiarowy** na SHA `fe33ce8036` (= HEAD `codex/m03-admin-20260824`
w chwili pisania tej instrukcji). Jeśli u Ciebie linie się przesunęły — wiążący jest plik,
rozbieżność idzie do „Korekt wobec instrukcji". Obalenie którejkolwiek tezy jest sukcesem
dyżuru.

- **T1.** Runner ma dziś **452 linie** (nie 294 z pierwotnej karty 204 sprzed FIX-u) —
  FIX-204 dołożył ok. 160 linii bezpieczników. Licz sam: rozbieżność z tą liczbą nie jest
  sprzecznością, jest wynikiem.
- **T2.** Zapis do kanonu (`createExecutionTask`, `legacy-task-cutover-runner.ts:316`) i wpis
  do rejestru (`pool.query(INSERT INTO legacy_task_cutover_ledger...)`, `:344-360`) to **DWIE
  NIEZALEŻNE operacje na bazie**, nie jedna transakcja. Pierwsza otwiera i domyka WŁASNĄ
  transakcję wewnątrz `executeMaterialCommand`/`PostgresMaterialCommandUnitOfWork.transaction`
  (BEGIN…COMMIT, `postgresMaterialCommandUnitOfWork.ts:877-894`) i **commituje się w całości**
  zanim runner w ogóle dotrze do linii `:344`. Awaria między tymi dwiema liniami zostawia
  kanoniczne zadanie **zmigrowane, bez wiersza w rejestrze**.
- **T3.** `MigrateOutcome` (`:65`) ma dokładnie trzy warianty: `'MIGRATED' | 'SKIPPED' |
  'NOOP'`. Literał `'FAILED'` **nie występuje ani razu** w całym pliku
  (`grep -c "FAILED" server/scripts/legacy-task-cutover-runner.ts` → `0`), mimo że schemat
  go dopuszcza.
- **T4.** Pętla `runLegacyTaskCutover` (`:386-390`) woła `migrateOneTask` **bez `try/catch`**.
  Każdy `throw` — w tym istniejący, łatwo odtwarzalny `CANONICAL_HOME_MISSING:...`
  (`:312-313`, gdy dla inicjatywy zadania nie ma aktywnego `execution_case`) — ucieka do
  `main()`'s top-level `.catch` (`:448-451`) i **przerywa całą partię**, bez śladu w
  rejestrze, które zadanie i dlaczego.
- **T5.** Migracja `20261721_legacy_task_cutover_ledger.sql:9` **już dziś** dopuszcza
  `status IN ('PENDING', 'MIGRATED', 'SKIPPED', 'FAILED')`. R2 **nie wymaga nowej migracji**
  — wyłącznie zmiany w kodzie runnera.
- **T6.** Strażnik idempotencji w `migrateOneTask` (`:278-286`) czyta **wyłącznie
  `checksum`**, nigdy `status`, zanim zwróci `'NOOP'`. Gdyby ktoś dopisał wiersz `PENDING`
  PRZED wywołaniem `createExecutionTask` (żeby mieć ślad na wypadek awarii), a potem awaria
  faktycznie by nastąpiła — kolejny przebieg zobaczy istniejący wiersz z pasującym
  checksumem, zwróci `NOOP` i **nigdy nie spróbuje ponownie**. To jest dokładnie pułapka,
  którą nazwała karta FIX-204 (sekcja 1 wyżej).
- **T7.** `MaterialCommandTransaction` (`materialCommand.ts:117-271`) ma **21 metod**, z
  których **żadna nie jest surowym `query()`** — każda jest wąską, jednotabelową operacją
  domenową (`createRaidItem`, `appendAudit`, `appendOutbox`, `saveReceipt`, …). Interfejs
  **nie eksponuje** klienta Postgresa ani generycznego SQL-a. Policz metody sam.
- **T8.** Interfejs ma dokładnie **JEDNEGO implementatora produkcyjnego**:
  `PostgresMaterialCommandTransaction` (`postgresMaterialCommandUnitOfWork.ts:23-872`).
  `grep -rln "implements MaterialCommandTransaction" --include="*.ts" .` → jeden plik.
- **T9.** `executeMaterialCommand` (`materialCommand.ts:457`) — funkcja, przez którą
  przechodzi KAŻDE polecenie domeny `initiatives-execution` — ma **105 wystąpień wywołania**
  w repozytorium (`grep -rn "executeMaterialCommand(" --include="*.ts" . | grep -v
  materialCommand.ts | wc -l`), rozsianych po **46 plikach produkcyjnych** w
  `server/src/domain/initiatives-execution/`. Jej sygnatura jest przekrojowa najwyższego
  stopnia — zmiana dotyka wszystkich 46.
- **T10.** `createExecutionTask` (`executionWork.ts:124-185`) ma **produkcyjnego wołacza
  poza runnerem**: `server/src/routes/pmo/initiativesExecutionRuntime.routes.ts` — to jest
  ta sama funkcja, którą woła żywa trasa HTTP tworzenia zadań. Jakakolwiek zmiana jej
  zachowania zewnętrznego uderza w produkcję, nie tylko w migrację.
- **T11.** Kolumna `case_version_after` w INSERCIE `MIGRATED` (`:344-360`) jest wypełniana
  wartością `result.aggregateVersion` (`:356`) — a `result` to zwrotka `createExecutionTask`
  dla agregatu **`execution_task`** (`envelope.aggregateType`), którego `expectedVersion`
  zawsze wynosi `0`, więc `result.aggregateVersion` **zawsze wynosi `1`**. To NIE jest wersja
  agregatu `execution_case` po aktualizacji rollupu (`caseAndRollup`, `:150-157`, która
  faktycznie zmienia wersję `execution_case` na `caseBefore+1`). **Nazwa kolumny myli o tym,
  co przechowuje** — to jest defekt niezmierzony przez kartę 204, istotny dla R3.
- **T12.** `docs/program/funkcje/PLAN_MIGRACJI_TASKS_KANON.md:299` (§A6, dokument
  kanoniczny) mówi wprost: „Destrukcyjny rollback jest odrzucony. […] Strategia to
  `forward repair`". To jest **w napięciu** z zamówieniem tego dyżuru („ścieżka cofnięcia
  partii") i wymaga jawnego rozstrzygnięcia zakresu — nie cichego zignorowania żadnej ze
  stron.

# 3. POZYCJE DYŻURU

## R1 — Atomowość zapisu (kanon + rejestr w JEDNEJ transakcji)

**Cel:** awaria w dowolnym momencie między rozpoczęciem zapisu kanonicznego a domknięciem
wpisu do `legacy_task_cutover_ledger` ma zostawiać bazę **albo w stanie sprzed operacji,
albo w pełni po niej** — nigdy pośrodku.

### R1a — mapa `MaterialCommandTransaction` (zmierzona, nie zgadnięta)

Zamówienie tego dyżuru zakłada, że rozszerzenie interfejsu jest drogie, bo jest „szeroko
używany". To prawda i nieprawda naraz — **rozstrzyga to, CO rozszerzasz**:

| Co | Gdzie | Ilu ma użytkowników | Ryzyko zmiany |
| --- | --- | --- | --- |
| Interfejs `MaterialCommandTransaction` (21 metod, `materialCommand.ts:117-271`) | definicja | **1 implementator produkcyjny** (`PostgresMaterialCommandTransaction`) | **NISKIE** — dodanie NOWEJ, wąskiej metody wymaga zmiany w JEDNYM pliku |
| Funkcja `executeMaterialCommand` (`materialCommand.ts:457`) | dyspozytor CAS/idempotencji/audytu | **105 wywołań w ~46 plikach produkcyjnych** | **WYSOKIE** — zmiana sygnatury albo semantyki uderza w cały bounded context |
| `createExecutionTask` (`executionWork.ts:124-185`) | jedna z ~46 komend | **2 wołaczy produkcyjnych**: trasa HTTP `initiativesExecutionRuntime.routes.ts` + ten runner | **ŚREDNIE** — zmiana zewnętrznego zachowania uderza w żywą trasę |

**Wniosek do wykorzystania, nie do ślepego powielenia:** rozszerzasz **wyłącznie**
`MaterialCommandTransaction` o JEDNĄ nową, wąską metodę (wzorem stylu istniejących —
`appendAudit`, `appendOutbox`, `saveReceipt` — czyli jedno-tabelowy `INSERT`, nie generyczny
`query()`, bo to złamałoby całą architekturę zamkniętych operacji domenowych). **NIE
dotykasz** sygnatury `executeMaterialCommand` ani żadnej z jej 105 wywołań poza tymi, które
sam dopiszesz.

Rekomendacja nadzorcy (do potwierdzenia albo obalenia liczbami, nie opinią):

1. Dopisz do `MaterialCommandTransaction` (`materialCommand.ts:117-271`) metodę, np.
   `appendLegacyTaskCutoverLedgerEntry(entry: {...}): Promise<void>` — kształt pól 1:1 z
   dzisiejszym INSERT-em (`:345-347`: `organization_id, legacy_task_id, batch_id, status,
   reason_code, client_request_id, canonical_id, case_version_before, case_version_after,
   actor_id, checksum`). Implementujesz ją w JEDYNYM implementatorze,
   `PostgresMaterialCommandTransaction` (`postgresMaterialCommandUnitOfWork.ts`), jako
   `this.client.query(...)` — dosłownie ten sam SQL co dziś w runnerze, przeniesiony.
2. Wyodrębnij ciało domykające `createExecutionTask` (dziś domknięcie inline,
   `executionWork.ts:137-184`, `async (tx) => { ... }` przekazywane do
   `executeMaterialCommand`) do osobnej, eksportowanej funkcji, np.
   `prepareExecutionTaskCreation(tx, envelope)`, zwracającej dokładnie to, co dziś zwraca
   domknięcie. `createExecutionTask` (`:124-185`) wywołuje ją **bez zmiany zachowania** —
   dowód: `tests/integration/initiatives-execution/executionWork.realdb.test.ts` zielony
   BEZ ŻADNEJ zmiany w nim.
3. Dopisz NOWĄ, eksportowaną funkcję (np. `createExecutionTaskForLegacyCutover(uow,
   envelope, ledgerEntry)`), która woła `executeMaterialCommand(uow, envelope, async (tx,
   envelope) => { const change = await prepareExecutionTaskCreation(tx, envelope); await
   tx.appendLegacyTaskCutoverLedgerEntry(ledgerEntry); return change; })`. Ledger insert
   biegnie na **tym samym `tx`**, czyli w **tej samej transakcji Postgresa** co
   `persistAggregate`/`appendAudit`/`appendOutbox`/`saveReceipt` — jeden `COMMIT` albo jeden
   `ROLLBACK` dla całości. **`executeMaterialCommand` sam w sobie NIE ZMIENIA SIĘ ani
   o jeden znak.**
4. Runner (`migrateOneTask`, `:262-362`) woła `createExecutionTaskForLegacyCutover` zamiast
   dzisiejszej pary `createExecutionTask` + osobny `pool.query(INSERT...)`.

**Jeśli zmierzysz, że ta droga jest niewykonalna albo droższa niż alternatywa —
rozstrzygasz Ty, z liczbami (ile plików, ile linii, ile zastanych testów zmienia sens), nie
opinią. Zakaz jest jeden: nie zmieniasz sygnatury ani semantyki `executeMaterialCommand`
poza dodaniem opcjonalnego elementu, którego 45 pozostałych wołaczy nie musi dotykać.**

### R1b — pułapka `PENDING`-przed (nazwana przez FIX-204, nie przez Ciebie)

**NIE buduj wariantu „zapisz `PENDING` przed, dopisz `MIGRATED` po".** T6 dowodzi, że
dzisiejszy strażnik idempotencji (`:278-286`) porównuje wyłącznie checksum — wiersz
`PENDING` z pasującym checksumem zostanie potraktowany jak już-zrobiony i **zablokuje
ponowienie na stałe** dla tego zadania. Jeśli projekt z R1a-1..4 (ledger insert W TEJ SAMEJ
transakcji co zapis kanonu) się powiedzie, **`PENDING` nigdy nie jest potrzebny** — rejestr
albo widzi pełny `MIGRATED`, albo nie widzi nic (transakcja się nie zdarzyła), bo obie
operacje commitują się albo rollbackują się razem. To jest silniejsze rozwiązanie niż
dwufazowy znacznik, nie tylko prostsze — nazwij to w raporcie jednym zdaniem.

Jeżeli mimo to uznasz (z dowodem), że wariant `PENDING` jest konieczny z innego powodu —
**musisz** rozszerzyć strażnika w `migrateOneTask`, żeby rozróżniał `status`: wiersz
`PENDING` ma oznaczać „spróbuj ponownie", nie „NOOP". Opisz to jako świadomą zmianę
zachowania istniejącego kodu, z uzasadnieniem liczbowym, dlaczego R1a nie wystarczył.

### R1c — dowód: awaria wymuszona pomiędzy zapisem a rejestrem

**Bramka nie jest opcjonalna:** test scenariusza użycia („zmigrowałem i jest wiersz w
rejestrze") **nie jest dowodem atomowości** — `WSPOLNA_PRZYCZYNA_ODBIORY_204_210.md`
zmierzyła to jako przyczynę trzech odrzuconych odbiorów 31.08, jednym z nich był **ten sam
runner**. Wymagany jest test, który:

1. Migruje batch z co najmniej jednym zadaniem, ale **wymusza wyjątek** w trakcie transakcji
   PO `persistAggregate`/`appendAudit`/`appendOutbox` a PRZED `appendLegacyTaskCutoverLedgerEntry`
   (albo — jeśli Twoja implementacja różni się od R1a — w dowolnym miejscu między zapisem
   kanonu a wpisem rejestru, adekwatnie do Twojego projektu). Sposób wymuszenia: np. zaślep
   `appendLegacyTaskCutoverLedgerEntry` w kopii transakcji testowej tak, by rzucała, albo
   podaj dane, które są poprawne dla zapisu kanonu, ale naruszają NOT NULL/CHECK w ledgerze
   (np. pusty `checksum`) — musi to być awaria WEWNĄTRZ tej samej transakcji, nie przed nią
   ani po niej.
2. Sprawdza po awarii: `SELECT count(*) FROM ie_aggregate_state WHERE aggregate_type=
   'execution_task' AND aggregate_id='legacy-task:...'` → **0** (transakcja się cofnęła —
   kanon NIE ma połowicznego zapisu), i analogicznie **0** nowych wierszy w
   `ie_audit_events`/`ie_outbox_events`/`ie_command_receipts` dla tego zadania, i **0**
   wierszy w `legacy_task_cutover_ledger`.
3. **Mutacja odwrotna dowodzi load-bearing**: usuń swoje zabezpieczenie transakcyjne (np.
   wróć tymczasowo do dwóch osobnych wywołań `pool.query`) i pokaż, że TEN SAM test **wtedy
   zieleni się fałszywie** albo wykrywa połowiczny stan (czerwień). Jeden z dwóch dowodów
   musi być w raporcie: albo test bez zabezpieczenia jest czerwony (najlepszy dowód), albo —
   jeśli scenariusz nie da się odtworzyć bez prawdziwego crasha procesu — opisujesz, dlaczego
   i co zamiast tego dowodzi load-bearing (np. inspekcja: dwa niezależne `BEGIN`/`COMMIT` w
   logu Postgresa dla starej wersji, jeden dla nowej).

**Regresja obowiązkowa:** oba strażniki idempotencji z FIX-204 (`NOT EXISTS` w
`selectCandidateTasks`, checksum-continue w `migrateOneTask`) **muszą nadal czerwienić** po
Twoich zmianach — odtwórz mutacje A i B z `ODBIOR_204.md` §6 na SWOIM kodzie i wklej wynik.
To jest test regresji na cudzej, już przyjętej pracy, nie nowy wymóg.

**Ukończone, gdy:** R1a wykonane (mapa + rozszerzenie interfejsu + wołacz); pułapka R1b
nazwana i zamknięta (albo obejściem, albo świadomym strażnikiem statusu); dowód R1c
kompletny w obie strony; oba strażniki FIX-204 nadal czerwienieją pod mutacją; przy
sukcesie zapisu — DOKŁADNIE jeden wiersz w każdej z sześciu tabel (`ie_aggregate_state`
×2 — case i task, `ie_aggregate_relations`, `ie_audit_events`, `ie_outbox_events`,
`ie_command_receipts`, `legacy_task_cutover_ledger`), zmierzone, nie założone.

## R2 — Rejestr zapisuje `FAILED` zamiast przerywać partię bez śladu

**Cel:** błąd na JEDNYM zadaniu w partii nie zabija pozostałych i zostawia w rejestrze
wiersz `FAILED` z przyczyną.

### R2a — zmiana w runnerze

1. Rozszerz `MigrateOutcome` (`:65`) o `'FAILED'`.
2. Owiń wywołanie `migrateOneTask` w pętli `runLegacyTaskCutover` (`:386-390`) w
   `try/catch`. W `catch`: zapisz wiersz `legacy_task_cutover_ledger` ze `status='FAILED'`,
   `reason_code` = zwięzły, stabilny kod błędu (NIE cała wiadomość wyjątku — sprawdź, czy
   `CANONICAL_HOME_MISSING:...` i `checksum conflict for ...` mają wspólny, dający się
   sparsować prefiks; jeśli nie, ujednolić albo zapisać pełny komunikat i to uzasadnić),
   `client_request_id` (możesz go policzyć TAK SAMO jak `migrateOneTask` liczy go dla
   sukcesu — `tasks-canonical-v1:{org}:{taskId}` — dla spójności identyfikacji), `checksum`
   (policzony tak samo jak dla sukcesu, potrzebny do przyszłej idempotencji), `batch_id`,
   `actor_id`. Push `'FAILED'` do `outcomes` i **kontynuuj pętlę** (nie `throw`).
3. **Zdecyduj i zapisz jawnie**, co się dzieje z zadaniem oznaczonym `FAILED` przy KOLEJNYM
   przebiegu: `selectCandidateTasks`'s `NOT EXISTS` (`:208-212`, `:230-234`) wyklucza
   KAŻDY wiersz w ledgerze niezależnie od statusu — czyli zadanie `FAILED` **nie zostanie
   automatycznie ponowione**, tylko trwale pominięte, dopóki operator ręcznie nie usunie
   wiersza. Zdecyduj, czy to jest zamierzone zachowanie (rekomendacja nadzorcy: TAK — błąd
   wymaga interwencji człowieka, nie cichego retry, zwłaszcza że część błędów jak
   `CANONICAL_HOME_MISSING` oznacza brakujący dom kanoniczny, którego retry sam nie naprawi)
   czy chcesz dopisać ścieżkę ręcznego ponowienia. Obie odpowiedzi są poprawne — musi być
   jedna, jawna, z uzasadnieniem.

### R2b — dowód: błąd na JEDNYM zadaniu nie zabija partii

Użyj **istniejącego, łatwo odtwarzalnego** źródła awarii zamiast wymyślać nowe: fixture z
DWOMA zadaniami w tej samej partii, z których JEDNO wskazuje na `initiative_id` bez
aktywnego `execution_case` (rzuca `CANONICAL_HOME_MISSING:...` na `:312-313` — to jest
kod, który **już dziś** biegnie tą ścieżką, nie Twoja nowa mina). Test:

1. Uruchamia `runLegacyTaskCutover` z `--write` na tej partii.
2. Asertuje: `outcomes` zawiera `'FAILED'` dla złego zadania **i** `'MIGRATED'` dla
   dobrego — partia poszła dalej.
3. Asertuje w bazie: wiersz `legacy_task_cutover_ledger` dla złego zadania ma
   `status='FAILED'` i niepusty `reason_code`; wiersz dla dobrego ma `status='MIGRATED'`.
4. **Mutacja odwrotna**: cofnij `try/catch` (usuń go) i pokaż, że TEN SAM test wtedy pada —
   albo cała partia rzuca wyjątkiem (żaden `outcomes` nie istnieje), albo dobre zadanie
   nigdy nie zostaje przetworzone, bo złe (jeśli jest pierwsze w kolejności) zabija pętlę
   wcześniej. To jest dowód load-bearing wg `WSPOLNA_PRZYCZYNA_ODBIORY_204_210.md`.

**Ukończone, gdy:** `FAILED` zapisywany z przyczyną; partia idzie dalej po błędzie na
jednym zadaniu (dowód mutacyjny w obie strony); decyzja o (nie)ponawianiu `FAILED`
zapisana jawnie; żadna migracja schematu nie była potrzebna (T5) — jeśli mimo to
dopisałeś migrację, uzasadnij dlaczego T5 się nie potwierdził.

## R3 — Ścieżka cofnięcia partii

**Cel:** skrypt, który dla danego `batch_id` (w obrębie jednej organizacji) cofa
WSZYSTKIE `MIGRATED` zadania tej partii do stanu sprzed migracji, z tym samym rygorem
bezpieczeństwa co runner migrujący.

### R3a — rozstrzygnięcie napięcia z T12 (obowiązkowe, zanim napiszesz kod)

`PLAN_MIGRACJI_TASKS_KANON.md:299` (§A6, dokument kanoniczny właściciela) odrzuca
destrukcyjny rollback na rzecz `forward repair` — i robi to z dobrego powodu: usunięcie
agregatu na WSPÓŁDZIELONYM środowisku (staging/demo/produkcja) zostawia osierocone
`audit`/`outbox`/`receipt`/`relation` i blokuje ponowne wersje, a inne procesy mogły już
PRZECZYTAĆ zdarzenie z outboksu, zanim je usuniesz.

**To ograniczenie NIE dotyczy tego dyżuru wprost — i musisz to zapisać, nie przemilczeć:**
cały ten dyżur biegnie **wyłącznie** na efemerycznym lokalnym kontenerze (`Z9`, `Z28`),
którego nikt poza Tobą nie obserwuje. Rekomendacja nadzorcy: buduj skrypt cofający jako
**narzędzie odzyskiwania dla lokalnego/pilotowego przebiegu**, jawnie oznaczone w nagłówku
pliku i w `--help`/komunikacie startowym jako **NIEPRZEZNACZONE do cofania partii, którą
ktokolwiek poza Tobą już zaobserwował** (czyli nigdy na demo/staging/produkcji — co i tak
jest zakazane przez `Z28`/`Z9` niezależnie od tej decyzji). Do
`PLAN_MIGRACJI_TASKS_KANON.md` dopisujesz WYŁĄCZNIE doprecyzowanie zakresu pod §A6 (patrz
pole „Jedyny inny dokument do zmiany" w części A) — **nie zmieniasz** zdania „Destrukcyjny
rollback jest odrzucony", bo ono nadal obowiązuje dla środowisk współdzielonych.

Jeśli po zmierzeniu uznasz, że nawet ten zawężony zakres jest zbyt ryzykowny — to jest
**STOP MERYTORYCZNY tej pozycji z opisem**, nie powód do przemilczenia napięcia.

### R3b — co dokładnie trzeba cofnąć (zmierzona lista, nie założona)

Dla KAŻDEGO zmigrowanego zadania `createExecutionTask` zapisuje w JEDNEJ transakcji
(`executionWork.ts:137-184` + `materialCommand.ts:516-560`):

1. **`ie_aggregate_state`** — UPDATE istniejącego wiersza `execution_case` (rollup,
   `caseAndRollup`, `:150-157`: `persistRelatedAggregate` → `persistAggregate`,
   `postgresMaterialCommandUnitOfWork.ts:278-305`) — wersja rośnie o 1, `tasksTotal`
   rośnie o 1.
2. **`ie_aggregate_state`** — INSERT nowego wiersza `execution_task` (agregat samego
   zadania, wersja `1`).
3. **`ie_aggregate_relations`** — INSERT (`claimRelation`, `:167-176`,
   `relationType='EXECUTION_CASE_TASK:{taskId}'`).
4. **`ie_audit_events`** — INSERT (`appendAudit`, wołane z `executeMaterialCommand:526-538`).
5. **`ie_outbox_events`** — INSERT (`appendOutbox`, `:539-548`).
6. **`ie_command_receipts`** — INSERT (`saveReceipt`, `:560`).

Plus, POZA tą transakcją (a po R1 — WEWNĄTRZ niej): **`legacy_task_cutover_ledger`** —
INSERT. To jest **sześć tabel**, nie jedna, i punkt (1) jest UPDATE-em istniejącego
wiersza, nie INSERT-em nowego — cofnięcie musi **przywrócić poprzednią wartość**, nie
tylko usunąć nowe wiersze.

★ **`recomputeTaskMilestones` (`executionWork.ts:166`, `executionMilestone.ts:129-…`) jest
dla tej ścieżki migracji GWARANTOWANYM no-opem** — runner zawsze przekazuje
`milestoneIds: []` (`legacy-task-cutover-runner.ts:339`), więc pętla po
`task.milestoneIds` w `recomputeTaskMilestones` nie ma po czym iterować. Zweryfikuj to
sam (`sed -n '339p' server/scripts/legacy-task-cutover-runner.ts` i przeczytaj ciało
pętli) — jeśli się potwierdzi, promień cofnięcia NIE obejmuje `execution_milestone`
i możesz to zapisać jako zmierzony fakt, nie założenie.

★ **Rollup jest deterministyczny** — runner zawsze przekazuje `blockerDecisionIds: []`
(`:337`), więc `deriveTaskStatus` zawsze zwraca `'OPEN'`, więc delta rollupu jest zawsze
`{tasksTotal: +1, tasksBlocked: +0}` (`:156`). Cofnięcie zawsze odejmuje dokładnie te same
dwie liczby — nie musisz odczytywać delty z nigdzie, możesz ją policzyć z tej samej reguły.

★★ **Nie ufaj kolumnie `case_version_after` w ustaleniu wersji `execution_case` do
przywrócenia** (T11) — ta kolumna przechowuje wersję agregatu `execution_task` (zawsze
`1`), nie `execution_case`. Do ustalenia bieżącej wersji `execution_case` PRZED
cofnięciem użyj bezpośredniego odczytu (`getAggregateVersion` albo równoważne zapytanie
`SELECT version FROM ie_aggregate_state WHERE aggregate_type='execution_case' AND
aggregate_id=...`), NIE tej kolumny. `case_version_before` w ledgerze JEST poprawną
wartością sprzed migracji tego zadania — to jej używasz jako punktu przywrócenia, pod
warunkiem że nic innego nie zmieniło `execution_case` między migracją a cofnięciem
(zweryfikuj to jako strażnik: jeśli bieżąca wersja `execution_case` != `case_version_before
+ liczba_już_scofniętych_zadań_tej_partii_dla_tego_case`, ODMÓW cofnięcia tego wiersza
i zgłoś w wyniku — to jest analogiczny strażnik CAS do tego, który `executeMaterialCommand`
ma dla zapisów w przód).

### R3c — nowy skrypt, ten sam rygor co runner migrujący

Nowy plik, np. `server/scripts/legacy-task-cutover-rollback-runner.ts`, wzorem
`legacy-task-cutover-runner.ts`:

- `--organization-id` **wymagany**, fail-closed przed połączeniem z bazą (wzorem
  `parseRunnerOptions`, `:101-107`);
- `--batch-id` **wymagany** — cofasz jedną, imiennie wskazaną partię, nigdy „wszystko";
- **dry-run domyślny** — bez `--write` wypisujesz plan (które `legacy_task_id` zostaną
  cofnięte, ich bieżący i docelowy stan), zero zapisu;
- **jawne potwierdzenie** dla `--write`, analogicznie do `CONFIRM_LEGACY_TASK_CUTOVER` —
  UŻYJ INNEJ wartości/zmiennej (np. `CONFIRM_LEGACY_TASK_CUTOVER_ROLLBACK`), żeby
  operator nie mógł przypadkiem potwierdzić cofnięcia tym samym sekretem co migrację;
- **limit** — sufit liczby zadań cofanych w jednym przebiegu, wzorem `--max-tasks`;
- `resolveScriptDatabaseTarget({ allowOnlyLoopback: true })` — **dokładnie ta sama
  bramka** co runner migrujący (`:395-403`); to jest strażnik z FIX-204-4, którego
  istnienie na Twojej gałęzi masz zweryfikować (patrz `TU_WSTAWIASZ_KOMENDY` (W12)), NIE
  budować od nowa;
- dla każdego wiersza `MIGRATED` partii: strażnik wersji z R3b, potem w JEDNEJ transakcji
  (`pool.connect()` + `BEGIN`…`COMMIT`/`ROLLBACK`, wzorem
  `PostgresMaterialCommandUnitOfWork.transaction`, `postgresMaterialCommandUnitOfWork.ts:877-894`
  — możesz reużyć ten sam wzorzec transakcyjny wprost, ten skrypt NIE musi przechodzić
  przez `MaterialCommandTransaction`, bo nie jest poleceniem domenowym, jest narzędziem
  operacyjnym): DELETE z `ie_aggregate_state` (wiersz zadania), UPDATE `ie_aggregate_state`
  (przywrócenie wersji i rollupu `execution_case`), DELETE z `ie_aggregate_relations`,
  `ie_audit_events`, `ie_outbox_events`, `ie_command_receipts` dla tego agregatu/polecenia,
  na końcu DELETE z `legacy_task_cutover_ledger` (usunięcie wiersza — **to jest decyzja,
  nie oczywistość**: usunięcie, a nie zmiana statusu, jest konieczne, żeby
  `selectCandidateTasks`'s `NOT EXISTS` znowu dopuściło to zadanie do ponownej migracji —
  zweryfikuj to zdanie sam, patrz `:208-212`, `:230-234`; alternatywa — nowy status
  `ROLLED_BACK` — wymagałaby migracji rozszerzającej `CHECK` w `20261721_...sql:9`, wolny
  przedział prefiksów zaczyna się od `20261723`, zweryfikuj: `ls server/migrations | grep
  -E '^2026172[3-9]_'` → oczekiwane 0 wyników. Wybierasz jedno, uzasadniasz liczbą
  dotkniętych plików/testów, nie opinią).

### R3d — dowód: pełny cykl migracja → cofnięcie → ponowna migracja

**To jest bramka tej pozycji, dosłownie z zamówienia — nie skracaj jej:**

1. Zmigruj małą partię (2 zadania wystarczą) z `--write`. Zrzuć „migawkę" bazy PRZED
   migracją (np. `SELECT * FROM ie_aggregate_state WHERE organization_id=$1 ORDER BY
   aggregate_type, aggregate_id` do pliku w `/private/tmp/cx-day216-odwracalnosc-artefakty`) i PO migracji.
2. Uruchom nowy skrypt z `--write` dla tego `batch_id`.
3. **Porównanie zmierzone, nie deklarowane**: `diff` migawki „PRZED migracją" z migawką
   „PO cofnięciu" dla WSZYSTKICH sześciu tabel z R3b, w zakresie organizacji — musi być
   **pusty**. Samo `outcomes` skryptu mówiące „cofnięto 2" nie jest tym dowodem.
4. Uruchom PONOWNIE dokładnie tę samą komendę migrującą z `:1` (ten sam `batch_id`,
   ta sama partia). Musi zakończyć się `MIGRATED` dla obu zadań (**nie** `NOOP`, **nie**
   `checksum conflict`) — to dowodzi, że cofnięcie nie zostawia śmieci blokujących retry
   (dokładnie to sprawdza strażnik idempotencji z FIX-204, którego regresję i tak
   dowodzisz w R1c).
5. **Mutacja odwrotna**: pomiń krok DELETE z `legacy_task_cutover_ledger` w skrypcie
   cofającym i pokaż, że krok `:4` wtedy PADA (`NOOP` zamiast `MIGRATED`, bo `NOT EXISTS`
   nadal widzi stary wiersz) — to dowodzi, że ten konkretny DELETE jest load-bearing, nie
   kosmetyczny.

**Ukończone, gdy:** R3a rozstrzygnięte i zapisane (albo zbudowane w zawężonym zakresie,
albo STOP MERYTORYCZNY z opisem); R3b — sześć tabel zmierzonych, nie założonych; nowy
skrypt ma wszystkie bezpieczniki R3c; cykl migracja→cofnięcie→ponowna migracja z R3d
przechodzi z dowodem `diff`; mutacja odwrotna R3d.5 potwierdza load-bearing DELETE-a z
ledgera; bezpiecznik loopback z FIX-204 zweryfikowany jako nadal działający (nie
zbudowany od nowa — patrz W12).

# 4. TABELA LICENCJI PLIKOWYCH

Licencja obejmuje CAŁĄ ścieżkę: interfejs poleceń materialnych → implementacja Postgresa →
komenda tworzenia zadania → runner migrujący → nowy skrypt cofający → testy → dokument
planu. Pominięcie ogniwa zmusiłoby Cię do złamania licencji albo do połowy roboty.

| Zakres | Ścieżki |
| --- | --- |
| Zapis | `server/scripts/legacy-task-cutover-runner.ts` — PEŁNA licencja w zakresie R1 (wywołanie nowej funkcji zamiast pary create+insert) i R2 (`MigrateOutcome`, `try/catch` w pętli, insert `FAILED`). **Zakaz** zmiany `parseRunnerOptions`, `selectCandidateTasks`, argumentów CLI istniejących poza tym, co R1/R2 wymagają |
| Zapis (WĄSKA) | `server/src/domain/initiatives-execution/materialCommand.ts` — WYŁĄCZNIE dodanie JEDNEJ nowej metody do `MaterialCommandTransaction` (R1a). **Zakaz** zmiany istniejących 21 metod, `executeMaterialCommand`, `MaterialCommandUnitOfWork`, strażnika CAS (`:496-514`), kolejności operacji w `executeMaterialCommand` |
| Zapis (WĄSKA) | `server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork.ts` — WYŁĄCZNIE implementacja nowej metody z powyższego wiersza, w klasie `PostgresMaterialCommandTransaction`. **Zakaz** zmiany `PostgresMaterialCommandUnitOfWork.transaction` (BEGIN/COMMIT/ROLLBACK, `:877-894`) i wszystkich pozostałych metod |
| Zapis (WĄSKA) | `server/src/domain/initiatives-execution/executionWork.ts` — WYŁĄCZNIE: wyodrębnienie domknięcia `createExecutionTask` do nazwanej funkcji (bez zmiany zachowania) i dopisanie NOWEJ funkcji dla ścieżki legacy-cutover (R1a.2-3). **Zakaz** zmiany zewnętrznego zachowania `createExecutionTask` (dowód: `executionWork.realdb.test.ts` zielony bez zmian) i zakaz dotykania `updateExecutionTask`/innych poleceń w pliku |
| Zapis (NOWY plik) | `server/scripts/legacy-task-cutover-rollback-runner.ts` — PEŁNA licencja (R3) |
| Zapis (warunkowy) | `server/migrations/20261723_*.sql` (numer do zweryfikowania jako wolny) — WYŁĄCZNIE jeśli w R3c wybierzesz wariant `ROLLED_BACK` zamiast DELETE z ledgera; addytywne, wyłącznie rozszerzenie `CHECK` |
| Zapis | NOWE pliki testowe `day216-*.ts` w `tests/integration/` — pełna licencja, z zastrzeżeniem `Z18` i `Z31`. ★ Nowe pliki w `tests/` wymagają `git add -f` |
| Zapis (ograniczony) | `docs/program/funkcje/PLAN_MIGRACJI_TASKS_KANON.md` — WYŁĄCZNIE doprecyzowanie zakresu pod §A6 (R3a), bez zmiany istniejącego zdania o odrzuceniu destrukcyjnego rollbacku |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY216_ODWRACALNOSC_REPORT.md` |
| Odczyt (ZAKAZ ZAPISU) | `server/scripts/lib/scriptDatabaseTarget.ts` · `server/src/config/databaseTargetResolver.ts` — bezpiecznik bazy z FIX-204-4; wołasz go, nie zmieniasz |
| Odczyt (ZAKAZ ZAPISU) | `tests/integration/_helpers/assertRealPostgres.ts` · `tests/setup.ts` · `vitest*.config.ts` · `server/vitest.config*.ts` (`Z18`) |
| Odczyt (ZAKAZ ZAPISU) | `server/migrations/20261721_legacy_task_cutover_ledger.sql` · `20261722_legacy_task_cutover_step_ledger.sql` — schemat istniejący, T5 mówi że R2 go nie potrzebuje; jeśli R3c wybierze `ROLLED_BACK`, ZMIANA idzie do NOWEJ migracji (wiersz wyżej), nie do tego pliku |
| Odczyt (ZAKAZ ZAPISU) | `tests/integration/day204-legacy-task-cutover-idempotency.realdb.test.ts` · `day204-legacy-task-cutover-runner-options.test.ts` · `day197-legacy-task-cutover.realdb.test.ts` · `day204-r1-mines.realdb.test.ts` — REGRESJA obowiązkowa (uruchamiasz, nie zmieniasz) |
| Odczyt (ZAKAZ ZAPISU) | `tests/integration/initiatives-execution/executionWork.realdb.test.ts` i pozostałe `*.realdb.test.ts` w tym katalogu — dowód behavior-preserving dla R1a.2 |
| Odczyt (ZAKAZ ZAPISU) | `server/src/domain/initiatives-execution/*.ts` poza trzema plikami wymienionymi wyżej (pozostałe ~43 komendy przechodzące przez `executeMaterialCommand`) |
| Odczyt (ZAKAZ ZAPISU) | `server/src/routes/pmo/initiativesExecutionRuntime.routes.ts` · `initiativesCapacityAdvisor.routes.ts` — żywe trasy produkcyjne, tylko jako dowód nie-regresji |
| Odczyt (ZAKAZ ZAPISU) | `server/src/services/legacyCutover/**` (`legacyCutoverKernel.ts`, `CUTOVER_REGISTRY`, `rollbackRehearsal.pg.test.ts`) — **INNY SYSTEM**, patrz `PULAPKA` niżej. Nie dotykasz, nie mylisz z tym dyżurem |
| Odczyt | `docs/program/funkcje/ODBIOR_204.md` · `LISTA_DYZUROW_211_222.md` · `WSPOLNA_PRZYCZYNA_ODBIORY_204_210.md` · `DECYZJE_WLASCICIELA_2026-08-30_WIECZOR.md` · `PLAN_MIGRACJI_TASKS_KANON.md` · `CODEX_DAY204_MIGRACJA_E2_REPORT.md` · `CODEX_DAY197_MIGRACJA_E1_REPORT.md` |

**Nietykalne imiennie:** `sideEffectTools.ts` i cała ścieżka czatu Teresy (poza zakresem
tego dyżuru) · `scriptDatabaseTarget.ts` · `databaseTargetResolver.ts` ·
`tests/setup.ts`/`tests/helpers/**`/`vitest*.config.ts` · wszystkie pliki
`server/src/domain/initiatives-execution/*.ts` poza `materialCommand.ts`,
`postgresMaterialCommandUnitOfWork.ts`, `executionWork.ts` · `legacyCutoverKernel.ts` i
cały katalog `server/src/services/legacyCutover/**` · każdy `MODULE_ACCEPTANCE.md`.

**Rozłączność z partią równoległą:** dyżur 217 (`GF-AGT-02`) biegnie w tym samym oknie
czasowym (stąd zarezerwowane porty `6157`/`5104-5105` w tej instrukcji), ale dotyka
`ai.routes.ts`/`llmService.ts`/warstwy czatu — **zero wspólnych plików** z tym dyżurem wg
pomiaru przy pisaniu tej instrukcji (`grep` w opisie 217 nie wymienia
`initiatives-execution` ani `legacy-task-cutover`). Zweryfikuj to sam przed pierwszym
commitem (`git log` gałęzi bazowej pod kątem równoległych dyżurów w Twoich plikach) i
zgłoś kolizję, jeśli jednak istnieje.

# 5. TWARDE ZASADY WŁAŚCIWE TEMU DYŻUROWI

- ★★ **Zero połączeń do stagingu/demo/produkcji w KTÓRYMKOLWIEK skrypcie, w tym w nowym
  skrypcie cofającym** (`Z28`, `Z9`). Pilot na stagingu (D-13) wykonuje WYŁĄCZNIE nadzorca,
  osobnym dyżurem (219) — Ty nie dotykasz niczego poza efemerycznym lokalnym kontenerem.
- ★★ **Nie zmieniasz sygnatury ani semantyki `executeMaterialCommand`** poza dodaniem
  elementu, którego 45 pozostałych wołaczy nie musi przyjąć (T9, R1a). Zmiana szeroka =
  podstawa odrzucenia pozycji R1.
- ★★ **`createExecutionTask` ma żywego wołacza produkcyjnego poza tym dyżurem**
  (`initiativesExecutionRuntime.routes.ts`, T10) — jego zewnętrzne zachowanie dla TEGO
  wołacza musi zostać bajt w bajt takie samo; dowód to zielony
  `executionWork.realdb.test.ts` bez zmian w tym pliku.
- ★★ **Nie buduj wariantu `PENDING`-przed-zapisem bez rozszerzenia strażnika statusu**
  (R1b) — to jest udokumentowana, nazwana przez FIX-204 pułapka blokująca retry na stałe.
- ★★ **Destrukcyjny rollback jest odrzucony przez kanoniczny plan migracji dla środowisk
  współdzielonych** (`PLAN_MIGRACJI_TASKS_KANON.md:299`, T12) — Twój skrypt cofający wolno
  Ci zbudować WYŁĄCZNIE jako narzędzie dla lokalnego/pilotowego przebiegu, jawnie tak
  oznaczone, i wolno Ci WYŁĄCZNIE doprecyzować zakres tego zdania w dokumencie planu, nigdy
  go nie uchylić ani nie skasować.
- ★★ **Nie myl `legacy-task-cutover-runner.ts` (ten dyżur) z `legacyCutoverKernel.ts` /
  `CUTOVER_REGISTRY`** (`server/src/services/legacyCutover/**`) — to jest INNY, niepowiązany
  system (odwracalne bramki zapisu za flagą dla modułów Finance/Partner/Results/etc., ze
  swoim `rollbackRehearsal.pg.test.ts`), który przypadkiem dzieli słowa „legacy cutover" w
  nazwie. Zero zapisu w tym katalogu.
- ★★ **Zabezpieczenie bez testu, który czerwienieje po jego usunięciu, jest
  nieudowodnione** (`WSPOLNA_PRZYCZYNA_ODBIORY_204_210.md`) — KAŻDA z trzech pozycji (R1,
  R2, R3) wymaga dowodu mutacyjnego w OBIE strony, nie testu scenariusza użycia. Brak
  mutacji odwrotnej = pozycja niezrobiona, niezależnie od tego, ile testów jest zielonych.
- ★★ **Oba strażniki idempotencji z FIX-204 (`NOT EXISTS` selektora, checksum-continue w
  `migrateOneTask`) muszą nadal czerwienić pod mutacją PO Twoich zmianach** (regresja na
  cudzej, przyjętej pracy) — odtwórz mutacje A i B z `ODBIOR_204.md` §6.
- ★★ **`Z31` — zakaz pinowania strażnika realDB do hosta/portu/nazwy bazy.** Wołasz
  `await assertRealPostgresTestEnvironment()` BEZ argumentów, wzorem
  `day204-r1-mines.realdb.test.ts:50`.
- ★★ **`Z29` — testy „atak odrzucony / stan bez zmian" biegną z `--retry=0`** w KAŻDEJ
  komendzie i w opcjach `describe`/`it`, jeśli plik je ustawia.
- ★ **`legacy_task_cutover_step_ledger` (`20261722_...sql`) jest martwa dla produkcji
  (jedyny pisarz to test dnia 204, `ODBIOR_204.md:57-59`)** — NIE jest to tabela, której ten
  dyżur ma dotknąć ani wpiąć; jeśli uznasz inaczej, uzasadnij liczbą wołaczy.
- ★ **Sprzątanie kontenera: `docker rm -f -v`** — z flagą `-v`.
- ★ **`Z27` — zakaz `git stash`.** Dowody mutacyjne przez `cp` do
  `/private/tmp/cx-day216-odwracalnosc-scratch` i powrót przez `cp`.
- ★ **Zrzuty nie dotyczą tego dyżuru** (T-brak powierzchni wizualnej) — sekcja `Z11`/`Z9`
  reguł wizualnych nie ma tu zastosowania; nie twórz żadnego `dev-render/screens/*`.
- ★ **`§0.4a` — pomiar zasięgu testów jest warunkiem oddania raportu** (`Z24`).
- ★★ **Sekcja „TWIERDZENIA NIEZWERYFIKOWANE" w raporcie jest OBOWIĄZKOWA.** Wypisz w niej
  wprost co najmniej: czy R1a zbudowałeś wg rekomendacji nadzorcy czy inaczej (i dlaczego);
  czy dowód R1c (awaria wymuszona między zapisem a rejestrem) opiera się na realnym
  wyjątku wewnątrz transakcji czy na inspekcji pośredniej; czy oba strażniki FIX-204 nadal
  czerwienieją pod mutacją na Twoim kodzie, czy założyłeś to z karty 204; czy `FAILED` w R2
  zapisujesz z pełnym komunikatem błędu czy ze stabilnym kodem, i dlaczego; czy zdecydowałeś
  o (nie)ponawianiu zadań `FAILED`; jak rozstrzygnąłeś napięcie R3a (zawężony zakres,
  STOP, czy inaczej) i co dokładnie dopisałeś do `PLAN_MIGRACJI_TASKS_KANON.md`; czy
  policzyłeś sam liczbę metod `MaterialCommandTransaction` i liczbę wywołań
  `executeMaterialCommand`, czy przepisałeś liczby z tej instrukcji; czy cykl
  migracja→cofnięcie→ponowna migracja (R3d) przeszedł z dowodem `diff`, czy inaczej; czy
  zweryfikowałeś kolumnę `case_version_after` (T11) jako niewiarygodną dla ustalenia wersji
  `execution_case`, czy założyłeś to z tej instrukcji. **Brak tej sekcji jest podstawą
  odrzucenia dyżuru.**
