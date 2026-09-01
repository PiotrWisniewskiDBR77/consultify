# INSTRUKCJA DYŻURU nr 239 — Codex — „★★ REALIZACJA — DWA NIEZALEŻNE MAGAZYNY ZADAŃ, POMIAR POD DECYZJĘ WŁAŚCICIELA, ZERO MIGRACJI. Legacy `tasks` (SQL znormalizowany, `server/migrations/000_initdb_core_tables.sql:198`) ma dziś ZABLOKOWANY zapis dla wszystkiego poza odczytem (`409 EXECUTION_RUNTIME_V1_WRITE_REQUIRED`, `server/src/middleware/executionSpineLegacyReadOnly.middleware.ts:24-41`, zamontowane w `server/src/routes/pmo/tasks.routes.ts:67`) — a mimo to moduł Moja Praca (`src/services/api/tasks.api.ts`, `src/components/MyWork/MyProjects.tsx`, `src/components/MyWork/TaskDetailView.tsx`) nadal go czyta, podczas gdy Execution Hub (`src/components/Execution/ExecutionHub.tsx:88`) czyta WYŁĄCZNIE kanoniczny agregat `ie_aggregate_state` (`server/migrations/932_initiatives_execution_material_commands.sql:33-40`, `aggregateType: 'execution_task'`) przez `src/services/initiatives-execution/runtimeApi.ts` — dwa ekrany dla tego samego użytkownika mogą dziś pokazywać RÓŻNE zadania. Most scalający (`legacy_task_cutover_ledger` + `legacy_task_cutover_step_ledger`, dyżury 197/204/216) istnieje w kodzie, ale wg cudzego pomiaru (`CODEX_DAY204_MIGRACJA_E2_REPORT.md:78`) przy ścisłej regule wymaganych pól wychodzi `0 z 467` zadań migrowalnych, a cofnięcie choć jednej migracji nieodwracalnie kasuje jej ślad audytowy, jeśli ma dopuszczać ponowienie (`CODEX_DAY216_ODWRACALNOSC_REPORT.md`, sekcja STOP R3)"

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
> **wyłącznie** `/private/tmp/cx-day239-realizacja`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `9a794efdc0`**
> **Gałąź bazowa: `github-backup/codex/m03-admin-20260824`**
> **Stan dokumentu: WYDANY**
>
> Jeżeli w polu „Stan dokumentu" widzisz `WYDANY` — możesz zaczynać.
> Jeżeli widzisz `PROJEKT` albo jakiekolwiek niewypelnione pole szablonu — **dokument nie
> jest wydany, nie zaczynasz i zgłaszasz to nadzorcy**.
> Ta ramka jest **jedynym** miejscem, w którym rozstrzyga się stan wydania.
> Objaśnienia w innych blokach cytowanych **nie** są powodem do STOP-u.

Data wystawienia: 2026-09-01.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.
Zakres: ****06 REALIZACJA / EXECUTION (`/execution`) — DWA NIEZALEŻNE MAGAZYNY ZADAŃ pod tym samym modułem, bez wspólnego pomiaru w jednym dyżurze do tej pory.** Magazyn 1 (legacy): tabela SQL `tasks` (`server/migrations/000_initdb_core_tables.sql:198`, kolumny dokładane `server/migrations/000_z_core_baseline.sql:290-333`, `server/migrations/20260127_pmo_task_fields.sql:6` dodaje `owner_id`), obsługiwana przez `server/src/controllers/TaskController.ts` i `server/src/routes/pmo/tasks.routes.ts` pod `/api/tasks`, dla której WSZYSTKIE mutacje poza jednym wąskim wyjątkiem są dziś zablokowane bramką `requireCanonicalExecutionWriter` (`server/src/middleware/executionSpineLegacyReadOnly.middleware.ts:24-41`). Magazyn 2 (kanoniczny, Runtime-v1): agregat JSONB `ie_aggregate_state` (`server/migrations/932_initiatives_execution_material_commands.sql:33-40`), pisany przez `createExecutionTask`/`updateExecutionTask`/`completeExecutionTask` (`server/src/domain/initiatives-execution/executionWork.ts:183,221,279`) przez `server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork.ts`, wystawiony pod `/api/initiatives/runtime-v1/execution-cases/:caseId/tasks/:taskId` (`server/src/routes/pmo/initiatives.routes.ts:155` montuje `initiativesExecutionRuntime.routes.ts`). Trzeci artefakt, który już istnieje w kodzie i którego TEN dyżur nie uruchamia: most scalający `legacy_task_cutover_ledger` (`server/migrations/20261721_legacy_task_cutover_ledger.sql`) + `legacy_task_cutover_step_ledger` (`server/migrations/20261722_legacy_task_cutover_step_ledger.sql`) + runner `server/scripts/legacy-task-cutover-runner.ts`, zbudowany i częściowo zabezpieczony dyżurami 197/204/216, ale wg `CODEX_DAY204_MIGRACJA_E2_REPORT.md` nigdy nie przeniósł ani jednego PRAWDZIWEGO zadania.**.
Trasy front: ``src/services/api/tasks.api.ts` · `src/components/MyWork/MyProjects.tsx` · `src/components/MyWork/TaskDetailView.tsx` · `src/components/Studio/StudioLinkModal.tsx` · `src/services/api.ts` · `src/views/ExecutiveView.tsx` (magazyn legacy, `/api/tasks`) · `src/components/Execution/ExecutionHub.tsx` · `src/components/Initiatives/InitiativesHub.tsx` · `src/services/initiatives-execution/runtimeApi.ts` · `src/components/Execution/executionLocalReviewData.ts` · `src/components/Execution/reports-intelligence/*.tsx` · `src/components/AIChat/GovernedInitiativeHandoffCard.tsx` (magazyn kanoniczny, Runtime-v1)`. Trasy tył: ``server/src/controllers/TaskController.ts` · `server/src/routes/pmo/tasks.routes.ts` · `server/src/middleware/executionSpineLegacyReadOnly.middleware.ts` (magazyn legacy) · `server/src/routes/pmo/initiativesExecutionRuntime.routes.ts` · `server/src/domain/initiatives-execution/executionWork.ts` · `server/src/domain/initiatives-execution/executionWorkHardening.ts` · `server/src/domain/initiatives-execution/materialCommand.ts` · `server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork.ts` (magazyn kanoniczny) · `server/scripts/legacy-task-cutover-runner.ts` · `server/migrations/20261721_legacy_task_cutover_ledger.sql` · `server/migrations/20261722_legacy_task_cutover_step_ledger.sql` (most, TYLKO ODCZYT/TYLKO URUCHOMIENIE ISTNIEJĄCYCH TESTÓW, zero `--write`)`.

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
WT=/private/tmp/cx-day239-realizacja
MARKER=9a794efdc0

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/codex/m03-admin-20260824
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/codex/m03-admin-20260824 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day239-realizacja-20260901 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day239-realizacja/config.worktree"
cat "$VAULT/worktrees/cx-day239-realizacja/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day239-realizacja-scratch
mkdir -p /private/tmp/cx-day239-realizacja-artefakty

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
git -C "$VAULT" log --oneline 9a794efdc0..github-backup/codex/m03-admin-20260824
git -C "$VAULT" diff --name-only 9a794efdc0..github-backup/codex/m03-admin-20260824
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day239-realizacja-20260901
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 9a794efdc0..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `9` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd "$WT"

# (1) TEZA: magazyn legacy to znormalizowana tabela SQL "tasks", BEZ kolumny owner_id w bazowym CREATE TABLE — jest dokladana pozniejsza migracja
grep -n "CREATE TABLE IF NOT EXISTS tasks" server/migrations/000_initdb_core_tables.sql server/migrations/000_z_core_baseline.sql
grep -n "owner_id" server/migrations/20260127_pmo_task_fields.sql
#   oczekiwane: dwie definicje CREATE TABLE (initdb + baseline) bez owner_id w liscie kolumn;
#   20260127_pmo_task_fields.sql:6 dokada "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS owner_id"

# (2) TEZA: magazyn kanoniczny to NIE tabela znormalizowana tylko agregat JSONB ie_aggregate_state,
#     klucz (organization_id, aggregate_type, aggregate_id), a zadania maja aggregate_type='execution_task'
sed -n '33,40p' server/migrations/932_initiatives_execution_material_commands.sql
grep -n "aggregateType !== 'execution_task'" server/src/domain/initiatives-execution/executionWork.ts
#   oczekiwane: CREATE TABLE ie_aggregate_state z payload_json JSONB i PRIMARY KEY (organization_id,
#   aggregate_type, aggregate_id); literal 'execution_task' w warunku createExecutionTask

# (3) TEZA: zapis do legacy /api/tasks jest dzis zablokowany (409) dla kazdej metody poza GET/HEAD/OPTIONS
#     i jednym wyjatkiem budzetowym, ktory nie dotyczy tego routera
sed -n '1,45p' server/src/middleware/executionSpineLegacyReadOnly.middleware.ts
grep -n "requireCanonicalExecutionWriter" server/src/routes/pmo/tasks.routes.ts
#   oczekiwane: funkcja zwraca 409 EXECUTION_RUNTIME_V1_WRITE_REQUIRED dla metod spoza
#   READ_ONLY_METHODS; zamontowana w tasks.routes.ts po verifyToken/requireOrgAccess

# (4) TEZA: front jest rozdzielony miedzy dwa magazyny — Moja Praca czyta legacy /api/tasks,
#     Execution Hub czyta WYLACZNIE kanoniczny runtime-v1 przez runtimeApi
grep -n "api/tasks" src/services/api/tasks.api.ts src/components/MyWork/MyProjects.tsx src/views/ExecutiveView.tsx
grep -n "runtimeApi\|listExecutionCases" src/components/Execution/ExecutionHub.tsx
grep -c "api/tasks" src/components/Execution/ExecutionHub.tsx
#   oczekiwane: trafienia "api/tasks" w kazdym z trzech plikow My Work/Executive; ExecutionHub.tsx
#   importuje z runtimeApi (linia ok. 88) i ma ZERO trafien "api/tasks"

# (5) TEZA: cudzy pomiar M3 (staging, 31.08, nadzorca za zgoda D-12) — NIE Twoj, nie do odtworzenia (Z28) —
#     total 467, bez_ownera 411, bez_assignee 49 (INNA kolumna), bez_sla 467/467, bez_due 195,
#     personal_bez_inicjatywy 265, active_execution_cases 14, legacy_initiatives_with_tasks 67
grep -n "M3 — WYNIK REALNY" -A 8 docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY197_MIGRACJA_E1_REPORT.md
#   oczekiwane: dokladnie te liczby, z etykieta "nadzorca za zgoda wlasciciela D-12", sesja read-only

# (6) TEZA: przy scislej regule wymaganych pol (brak pola = SKIPPED, zero zgadywania) dyzur 204
#     zmierzyl 0 z 467 zadan migrowalnych na miniaturze o ksztalcie M3
grep -n "Scisle A3\|0 z 467" docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY204_MIGRACJA_E2_REPORT.md
#   oczekiwane: linia z "0 z 467" w sekcji "DLA WLASCICIELA"

# (7) TEZA: most scalajacy (ledger + step-ledger + runner) istnieje w kodzie od dnia 197/204/216,
#     ale bez ani jednego PRAWDZIWEGO przeniesionego zadania produkcyjnego
ls server/migrations/ | grep -E "^202617(21|22)_"
ls server/scripts/legacy-task-cutover-runner.ts
find tests/integration -iname "*legacy-task-cutover*" | sort
#   oczekiwane: dwie migracje ledgera, runner istnieje, min. 5 plikow testow integracyjnych day197/204/216

# (8) TEZA: cofniecie migracji JEDNEGO zadania nie pozwala na jego ponowna migracje bez skasowania
#     sladu audytowego — UNIQUE po aggregate_version na ie_audit_events i ie_outbox_events
sed -n '82,115p' server/migrations/932_initiatives_execution_material_commands.sql
#   oczekiwane: UNIQUE (organization_id, aggregate_type, aggregate_id, aggregate_version) na
#   ie_audit_events (ok. linia 96) i z dodatkowym event_type na ie_outbox_events (ok. linia 114)

# (9) TEZA: miejsce na dysku wystarcza na dyzur (rekord: cztery dyzury stanely w pol pracy przy 2,5 GiB)
df -h /
#   oczekiwane: powyzej 5 GB wolnego — ponizej tego STOP calego dyzuru
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day239-realizacja-20260901` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6188`. Twój JEDYNY port harnessu to `5164 i 5165`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day239-pg`**. **ZAKAZANE:** `Zakazane na stałe: 5000 (macOS Control Center), 5037 (adb), 5060-5061. Zajęte przez inne prace (nie ruszasz): 6012, 5433, 6047, 6054-6187, 5010-5163, 6404-6411, 6600-6830. Twoje własne: baza 6188, harness 5164 i 5165. Cudze — siostrzane dyżury TEJ SAMEJ fali, nie dotykasz: baza 6189 i harness 5166-5167 (dyżur 240), baza 6190 i harness 5168-5169 (dyżur 241). Sprawdzasz sam przed startem: lsof -nP -iTCP:PORT -sTCP:LISTEN oraz docker ps`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `ŻADNEJ nowej flagi i ŻADNEJ zmiany wartości domyślnej istniejącej flagi. Jeżeli w trakcie pomiaru natrafisz na flagę bramkującą Runtime-v1 (np. `ENABLE_INITIATIVE_EXECUTION_OUTBOX_CONSUMER`), zostawiasz ją w stanie zastanym (domyślnie WYŁĄCZONA na Twojej lokalnej bazie, chyba że test tego wymaga i sam ją ustawia w linii komendy) i opisujesz w raporcie. `Z10` obowiązuje bez wyjątku`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/executionSpineLegacyReadOnly.middleware.ts` · `server/src/middleware/auth.middleware.ts` · `server/src/middleware/rbac.middleware.ts` · `server/src/middleware/effectiveCapability.middleware.ts` · `server/src/database/Database.ts` · `vitest.config.ts` · `tests/setup.ts``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY239_REALIZACJA_REPORT.md`. Jedyny inny dokument, który wolno Ci dotknąć, to `docs/program/waves/WAVE_03_ACCEPTANCE/modules/06_EXECUTION/MODULE_ACCEPTANCE.md` (§R.1) — WYŁĄCZNIE dopisanie nowej sekcji na końcu pliku ze zmierzonym stanem dwóch magazynów zadań, każde zdanie z dowodem `plik:linia`. Zakaz kasowania, nadpisywania lub przepisywania istniejących wierszy tabel. Zakaz wpisywania `FIXED`/`VERIFIED` — ten dyżur nie naprawia i nie scala niczego, tylko mierzy i dokumentuje pod decyzję właściciela. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day239-realizacja-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day239-realizacja-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | **★★ ZAKAZ MIGROWANIA, SCALANIA LUB PRZENOSZENIA JAKIEGOKOLWIEK ZADANIA — w każdą stronę.** Zakaz uruchamiania `server/scripts/legacy-task-cutover-runner.ts` z `--write` (dry-run bez zapisu jest dozwolony wyłącznie jeśli sam pakiet testowy go wymaga, z jawnym dowodem że nic nie zapisał). Zakaz jakiegokolwiek ręcznego `INSERT`/`UPDATE` do `legacy_task_cutover_ledger`, `legacy_task_cutover_step_ledger`, `ie_aggregate_state`, `ie_aggregate_relations`, `ie_command_receipts`, `ie_audit_events`, `ie_outbox_events` poza tym, co tworzą i sprzątają po sobie ISTNIEJĄCE testy z tabeli licencji. **ZAKAZ ZMIANY `requireCanonicalExecutionWriter` i ZAKAZ jakiejkolwiek zmiany logiki w `executionWork.ts`, `postgresMaterialCommandUnitOfWork.ts`, `TaskController.ts`, `tasks.routes.ts`, `initiativesExecutionRuntime.routes.ts`** — ten dyżur czyta te pliki, nie zmienia ani jednej linii kodu w nich. **ZAKAZ PRÓBY POŁĄCZENIA SIĘ Z BAZĄ DEMO/STAGING** w celu policzenia realnych liczb (`Z28`, `Z9`) — liczby produkcyjne cytujesz WYŁĄCZNIE jako cudzy pomiar z `CODEX_DAY197_MIGRACJA_E1_REPORT.md` (sekcja `★ M3 — WYNIK REALNY`), nigdy jako własny, i nigdy nie ekstrapolujesz „dziś pewnie jest podobnie” bez zastrzeżenia. **ZAKAZ ROZSTRZYGANIA, KTÓRY WARIANT (A/B/C) JEST SŁUSZNY** — `R5` opisuje trzy warianty neutralnie, decyzję podejmuje właściciel | Właściciel zdecydował 2026-09-01 rozstrzygnąć naraz trzy zablokowane moduły, w tym Realizację. Problem nie jest wizualny — jest DANYCH: to samo zadanie może dziś istnieć w dwóch niezależnych magazynach naraz (legacy `tasks` i kanoniczny `ie_aggregate_state`), a każdy dzień zwłoki dokłada nowe zadania wyłącznie do jednego z nich (bo zapis do legacy jest zablokowany bramką `409` od decyzji `AMD-EXE-SPINE-AUTHORITY-004`, a Runtime-v1 wymaga „domu kanonicznego” — aktywnej sprawy wykonawczej — którego wg cudzego pomiaru M3 nie ma dla większości inicjatyw legacy: `active_execution_cases=14` na `legacy_initiatives_with_tasks=67`). Trzy wcześniejsze dyżury (197, 204, 216) zmierzyły ogromną część tego terenu i zbudowały bezpieczny (ale nieużyty na realnych danych) most scalający — TEN dyżur nie powtarza ich pracy technicznej, tylko zbiera jej wynik w JEDEN dokument decyzyjny dla właściciela: ile zadań, gdzie, czego by ubyło przy każdym wyborze, i co jest nieodwracalne |

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
cd /private/tmp/cx-day239-realizacja

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day239-pg psql -U postgres -d cx239 \
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
cd /private/tmp/cx-day239-realizacja

docker run -d --name cx-day239-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx239 \
  -p 127.0.0.1:6188:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day239-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6188/cx239 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6188/cx239 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day239-realizacja && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6188/cx239 \
JWT_SECRET=cx239-test-secret-do-not-reuse \
npx vitest run tests/integration/day197-legacy-task-cutover.realdb.test.ts tests/integration/day204-legacy-task-cutover-runner-options.test.ts tests/integration/day204-legacy-task-cutover-idempotency.realdb.test.ts tests/integration/day204-r1-mines.realdb.test.ts tests/integration/day216-legacy-task-cutover-failed-status.realdb.test.ts tests/integration/day216-legacy-task-cutover-atomicity.realdb.test.ts --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day239-realizacja-artefakty/day239-pakiet.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day239-realizacja && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run tests/integration/day197-legacy-task-cutover.realdb.test.ts tests/integration/day204-legacy-task-cutover-runner-options.test.ts tests/integration/day204-legacy-task-cutover-idempotency.realdb.test.ts tests/integration/day204-r1-mines.realdb.test.ts tests/integration/day216-legacy-task-cutover-failed-status.realdb.test.ts tests/integration/day216-legacy-task-cutover-atomicity.realdb.test.ts --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day239-realizacja-artefakty/day239-pakiet.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day239-realizacja/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day239-pg psql -U postgres -d cx239 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day239-pg`.
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
> **(e) ★★ **NUMERY LINII Z RAPORTÓW 197/204 SĄ CZĘŚCIOWO NIEAKTUALNE — dyżur 216 refaktoryzował `executionWork.ts` i przesunął walidację pól.** Instrukcja 204 cytuje wymóg pól create-tasku jako `executionWork.ts:139-148`; na dzisiejszym markerze ta sama logika (identyczna treściowo: `executionCaseId`, `initiativeId`, `title`, `assigneeId`, `ownerId`, parsowalne `dueAt`/`slaAt`) leży w funkcji `prepareExecutionTaskCreation` w okolicy `:131-145` — **zawsze grepuj `!p.executionCaseId` na SWOIM markerze, nie przepisuj starego numeru linii.** Druga pułapka: `tasks` NIE MA kolumny `owner_id` w bazowym `CREATE TABLE` (`000_initdb_core_tables.sql:198-228`, `000_z_core_baseline.sql:290-333`) — kolumnę dokłada DOPIERO `server/migrations/20260127_pmo_task_fields.sql:6` (`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS owner_id TEXT REFERENCES users(id)`), więc „bez ownera” z cudzego pomiaru M3 dotyczy TEJ dokładanej kolumny, nie `assignee_id` (który ma OSOBNĄ, dużo niższą liczbę `bez_assignee=49` — dwa różne pola, dwie różne liczby, nie myl ich). Trzecia pułapka: `aggregate_type = 'execution_task'` w kodzie ISTNIEJE, ale to nie znaczy, że dowolna organizacja ma choć jeden taki wiersz — powstaje wyłącznie przez `execution.task.create` po przejściu `caseAndRollup`, który wymaga JUŻ AKTYWNEJ sprawy; bez niej runner zwraca `CANONICAL_HOME_MISSING` (`CODEX_DAY204_MIGRACJA_E2_REPORT.md:41`), nie cichy sukces**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day239-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day239-realizacja-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1 (inwentarz statyczny obu magazynów) · R2 (tabela różnic pól — najważniejsza tabela dyżuru) · R3 (pełna lista wołaczy front+tył) · R4 (zapytania rozliczeniowe + próba lokalna w kształcie M3, zero zapisu produkcyjnego) · R5 (trzy warianty rozstrzygnięcia językiem właściciela) · R6 (raport)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6188` albo `5164 i 5165` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6188` albo `5164 i 5165`** (`Z7`).

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

**★★ To jest dyżur POMIAROWY pod decyzję właściciela, nie naprawczy. Ma ZAKAZ migrowania,
scalania albo przenoszenia jakiegokolwiek zadania. Ma zmierzyć i opisać.** Właściciel
zdecydował 2026-09-01 rozstrzygnąć naraz trzy zablokowane moduły — Realizacja jest jednym
z nich. Problem **nie jest wizualny — jest DANYCH**, więc rośnie z każdym dniem zwłoki:
zadanie może dziś istnieć w dwóch niezależnych magazynach naraz, a każdy nowy dzień pracy
w produkcie dokłada rekordy tylko do JEDNEGO z nich (patrz `§1.3`).

## 1.1. Magazyn 1 — legacy, tabela SQL `tasks`

Znormalizowana tabela relacyjna, zdefiniowana dwukrotnie w bazowych migracjach (self-healing
wobec kolejności bootstrapu — komentarz `000_z_core_baseline.sql:331` tłumaczy dlaczego):

- `server/migrations/000_initdb_core_tables.sql:198-228` — `id, project_id, organization_id,
  title, description, status, priority, assignee_id, reporter_id, due_date, estimated_hours,
  checklist, attachments, tags, custom_status_id, created_at, updated_at, completed_at,
  task_type, budget_allocated, budget_spent, risk_rating, acceptance_criteria,
  blocking_issues, step_phase, initiative_id, why` + FK do `projects`, `organizations`,
  `users` (×2: `assignee_id`, `reporter_id`), `custom_statuses`.
- `server/migrations/000_z_core_baseline.sql:290-333` — druga definicja, szersza
  (`sla_hours`, `sla_due_at TEXT`, `escalation_level`, `escalated_to_id`, `expected_outcome`,
  `decision_impact`, `evidence_required`, `strategic_contribution`, `roadmap_initiative_id`,
  `kpi_id`, `raid_item_id`, `assignees`, `progress`, `blocked_reason`…), z blokiem
  `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS …` (`:335-379`) jako siatka bezpieczeństwa.
- **`owner_id` NIE jest w żadnej z tych dwóch definicji bazowych.** Dokłada go dopiero
  `server/migrations/20260127_pmo_task_fields.sql:6`
  (`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS owner_id TEXT REFERENCES users(id) ON DELETE
  SET NULL`), potwierdzone drugi raz w `server/migrations/20260801_exe002004_idempotency_keys.sql:90`.
  **To pole jest INNE niż `assignee_id`** — tabela ma DWA różne pojęcia „kto jest
  odpowiedzialny": `assignee_id` (wykonawca) i `owner_id` (właściciel zadania, dokładany
  później, dużo rzadziej wypełniany — patrz cudzy pomiar `§1.5`).

**Backend:** `server/src/controllers/TaskController.ts` + `server/src/routes/pmo/tasks.routes.ts`,
zamontowana pod `/api/tasks` (`server/src/routes/pmo/index.ts:42`). **Od decyzji
`AMD-EXE-SPINE-AUTHORITY-004` zapis do tej tabeli przez API jest ZABLOKOWANY**
(`§1.3`) — kontroler i większość handlerów w routerze pozostają w kodzie, ale są dziś
nieosiągalne dla żadnej mutacji. To jest znany kształt „biblioteka bez wywołania" —
w tym wypadku odwrotnie: wywołanie istnieje, ale bramka PRZED nim odcina każdą mutację.
Sprawdź to jako `R3`, nie zakładaj.

## 1.2. Magazyn 2 — kanoniczny, agregat JSONB `ie_aggregate_state` (Runtime-v1)

**To NIE jest druga znormalizowana tabela zadań.** `server/migrations/932_initiatives_execution_material_commands.sql:33-40`
definiuje jedną wspólną tabelę agregatów dla WSZYSTKICH typów obiektów Runtime-v1
(inicjatywy, sprawy wykonawcze, zadania, decyzje…):

```sql
CREATE TABLE IF NOT EXISTS ie_aggregate_state (
  organization_id TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version >= 1),
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (organization_id, aggregate_type, aggregate_id)
);
```

Zadanie żyje jako jeden wiersz z `aggregate_type = 'execution_task'`
(literal sprawdzany w `createExecutionTask`, `server/src/domain/initiatives-execution/executionWork.ts`,
warunek `envelope.aggregateType !== 'execution_task'`), a jego kształt to interfejs
`ExecutionTask` w tym samym pliku: `taskId, executionCaseId, initiativeId, title, description,
status, assigneeId, ownerId, dueAt, slaAt, evidenceRefs, blockerDecisionIds,
dependencyTaskIds, milestoneIds, blastRadius, createdAt, completedAt` — **17 pól**, wobec
**dziesiątek kolumn** legacy (dokładna liczba to `R1`/`R2`).

**Zapis:** `createExecutionTask` / `updateExecutionTask` / `completeExecutionTask`
(`executionWork.ts`) przez `server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork.ts`
— KAŻDY zapis to jedna transakcja dotykająca **pięć tabel naraz**: `ie_aggregate_state`,
`ie_aggregate_relations`, `ie_audit_events`, `ie_outbox_events`, `ie_command_receipts`
(policzone statycznie w `CODEX_DAY197_MIGRACJA_E1_REPORT.md:236-239` — **NIEZWERYFIKOWANE
runtime tam**, Twoim zadaniem w `R1` jest to potwierdzić na własnej bazie). **Zapis wymaga
`executionCaseId` — „domu kanonicznego"** (aktywnej sprawy wykonawczej). Bez niego zwraca
`CANONICAL_HOME_MISSING` (`CODEX_DAY204_MIGRACJA_E2_REPORT.md:41`), nie cichy sukces.

**Odczyt:** `postgresInitiativeReader.listExecutionTasks` (cytowany w obu poprzednich
dyżurach; potwierdź ścieżkę pliku sam — `T2`/`R1`). **Wystawiony pod**
`/api/initiatives/runtime-v1/execution-cases/:caseId/tasks/:taskId`
(`server/src/routes/pmo/initiatives.routes.ts:155` montuje
`initiativesExecutionRuntime.routes.ts` pod `/runtime-v1`).

## 1.3. Bramka zapisu — legacy jest dziś ZAMKNIĘTY, nie „równorzędny drugi magazyn"

`server/src/middleware/executionSpineLegacyReadOnly.middleware.ts:24-41`
(`requireCanonicalExecutionWriter`) zwraca `409` z kodem `EXECUTION_RUNTIME_V1_WRITE_REQUIRED`
dla każdej metody spoza `GET/HEAD/OPTIONS`, poza jednym governed wyjątkiem
(`DELETE /budget/entries/:id`, niezwiązanym z zadaniami). Zamontowana w
`server/src/routes/pmo/tasks.routes.ts:67`, PO `verifyToken`/`requireOrgAccess`/
`demoContextMiddleware` (`:57-64`), z komentarzem `AMD-EXE-SPINE-AUTHORITY-004` wprost nad
nią: *„retain the legacy PMO task read model during cutover, but route every mutation
through the receipt-backed Runtime-v1 writer"*. **Innymi słowy: to nie są dziś dwa
równoprawne magazyny do wyboru — to jest JEDEN zamrożony magazyn historyczny (467 zadań
wg cudzego pomiaru, `§1.5`) i JEDEN żywy magazyn zapisu, między którymi nikt jeszcze nie
przeniósł ani jednego rekordu.**

## 1.4. Front jest rozdzielony — dwa ekrany dla tego samego użytkownika mogą pokazywać różne zadania

Wołacze legacy `/api/tasks`: `src/services/api/tasks.api.ts` (`:86,105,111,120,129`),
`src/components/MyWork/MyProjects.tsx` (komentarz `:91` wprost: *„project task slice (GET
/api/tasks?projectId=…)"*), `src/components/MyWork/TaskDetailView.tsx` (`:1900`,
komentarz odsyła do `PUT /api/tasks/:id`), `src/components/Studio/StudioLinkModal.tsx`,
`src/services/api.ts` (`:4765`), `src/views/ExecutiveView.tsx:107`.

Wołacze kanonicznego Runtime-v1: `src/components/Execution/ExecutionHub.tsx:88`
(`import { listExecutionCases } from '@/services/initiatives-execution/runtimeApi'`) —
**ZERO trafień `api/tasks` w całym pliku (6029 linii)**, `src/components/Initiatives/InitiativesHub.tsx`,
`src/services/initiatives-execution/runtimeApi.ts` (funkcje na `/execution-cases/:caseId/tasks/:taskId…`),
`src/components/Execution/executionLocalReviewData.ts`,
`src/components/Execution/reports-intelligence/{ControlLoopReport,ResourcesCapacityReport,UnifiedExecutionReportGenerator}.tsx`,
`src/components/AIChat/GovernedInitiativeHandoffCard.tsx`.

**Konsekwencja do zmierzenia w `R3`:** moduł **Moja Praca** czyta magazyn zamrożony
(pełen historycznych zadań, `§1.5`), a moduł **Realizacja/Execution Hub** czyta magazyn
żywy (dziś niemal pusty dla realnych organizacji, `§1.5`) — użytkownik może NIE widzieć
w Realizacji zadania, które widzi w Mojej Pracy, i odwrotnie.

## 1.5. Cudzy pomiar M3 — CYTUJESZ, NIE POWTARZASZ (Z28/Z9)

`CODEX_DAY197_MIGRACJA_E1_REPORT.md`, sekcja `★ M3 — WYNIK REALNY (staging, 31.08, nadzorca
za zgodą właściciela D-12)`, sesja **read-only** na wspólnej bazie demo/staging:

```
active_execution_cases = 14
legacy_initiatives_with_tasks = 67
tasks: total 467 · personal_bez_inicjatywy 265 · bez_assignee 49
       · bez_ownera 411 · bez_due 195 · bez_sla 467
```

**To jest CUDZY pomiar. `Z28`/`Z9` zakazują Ci połączenia z demo/staging, więc NIE MOŻESZ
go dziś powtórzyć ani zaktualizować.** Zdanie „dziś jest pewnie podobnie" jest ekstrapolacją
i jest zakazane (dokładnie ten błąd wytknęła instrukcja 204, `Z40`). Twoja praca w `R1`/`R4`
to: (a) zacytować te liczby z ich źródłem, (b) rozłożyć każdą etykietę na dokładną definicję
SQL — **`bez_ownera` dotyczy kolumny `owner_id` (dokładanej `20260127_pmo_task_fields.sql:6`),
`bez_assignee` dotyczy INNEJ kolumny `assignee_id` — to jest już wcześniej zidentyfikowana
pułapka, patrz `§0.2e(e)`**, (c) przygotować i przetestować u siebie (na syntetycznej bazie
w kształcie M3) DOKŁADNIE te zapytania, które nadzorca mógłby uruchomić na realnej bazie,
żeby dostać świeży wynik.

**Odpowiedź na pytanie „ile zadań jest sierotami — bez właściciela, bez projektu, bez
kanonicznego miejsca":** `bez_ownera=411/467` i `personal_bez_inicjatywy=265/467` (cudzy
pomiar) to dwie RÓŻNE, częściowo nakładające się definicje sieroctwa (brak `owner_id` vs
brak `initiative_id`) — **`R1` ma wypisać zapytanie, które liczy część wspólną i sumę
mnogościową obu**, nie tylko powtórzyć dwie liczby osobno. „Kanoniczne miejsce" (aktywna
sprawa wykonawcza) istnieje dla `14` z `67` inicjatyw legacy z zadaniami — **teza właściciela,
że kanoniczne miejsca istnieją TYLKO dla organizacji syntetycznych, wymaga weryfikacji
kodem: `executionBvpService.ts:272,424` tworzy `execution_case_links` w ścieżce PRODUKCYJNEJ
(nie tylko w seedach `server/scripts/seed-wave3-*.ts`) — to sugeruje, że teza może być
NIEAKTUALNA, ale bez dostępu do realnej bazy (`Z28`) nie da się potwierdzić, DLA KOGO te
`14` domów realnie istnieją. Napisz to wprost jako granicę pomiaru, nie zgaduj.**

## 1.6. Most scalający istnieje w kodzie od trzech dyżurów, ale nigdy nie przeniósł realnego zadania

Dyżury **197** (ledger + czerwony kontrakt cyklu życia), **204** (runner z dry-run,
`--confirm-batch`, ścisłą regułą `A3`) i **216** (atomowość + FIX-216-1..5 + pomiar
odwracalności) zbudowały: `server/migrations/20261721_legacy_task_cutover_ledger.sql`,
`server/migrations/20261722_legacy_task_cutover_step_ledger.sql`,
`server/scripts/legacy-task-cutover-runner.ts` (452 linie), oraz pakiet testów
(`tests/integration/day197-legacy-task-cutover.realdb.test.ts`,
`day204-legacy-task-cutover-runner-options.test.ts`,
`day204-legacy-task-cutover-idempotency.realdb.test.ts`, `day204-r1-mines.realdb.test.ts`,
`day216-legacy-task-cutover-failed-status.realdb.test.ts`,
`day216-legacy-task-cutover-atomicity.realdb.test.ts`). **Wynik dnia 204 przy ścisłej
regule pól (brak wymaganego pola = `SKIPPED`, zero zgadywania):
`0 z 467` zadań migrowalnych** (`CODEX_DAY204_MIGRACJA_E2_REPORT.md:78`) — bo WSZYSTKIE
467 zadań na stagingu nie mają `sla_due_at` (`bez_sla 467/467`), a `createExecutionTask`
wymaga parsowalnego `slaAt`. Runner NIGDY nie uruchomił się z `--write` na realnych danych
produkcyjnych — jedyny przebieg zapisujący był na lokalnej, syntetycznej miniaturze
(`R3` dnia 204: 3 inicjatywy, 8 zadań, wynik `8 SKIPPED`, `0 MIGRATED`).

## 1.7. Cofnięcie migracji jednego zadania nie jest „za darmo" — day216

`CODEX_DAY216_ODWRACALNOSC_REPORT.md`, sekcja STOP R3 (poprawiona po adwersaryjnym
audycie): cofnięcie SAMEGO zapisu (`tasks`, `ie_aggregate_relations`, `ie_command_receipts`,
`ie_audit_events`, `ie_outbox_events`, `legacy_task_cutover_ledger`) jest zmierzone i
możliwe — 6 z 7 tabel wraca bajtowo identyczne. **Prawdziwa przeszkoda to UNIQUE indeksy
po `aggregate_version`** na `ie_audit_events`
(`server/migrations/932_initiatives_execution_material_commands.sql:96`) i `ie_outbox_events`
(`:114`, z dodatkowym `event_type`): **każde cofnięcie, które ma pozwolić na PONOWNĄ
migrację tego samego zadania, musi skasować jego wpis audytowy i zdarzenie outboxu** — nie
istnieje wariant „zachowaj ślad i pozwól ponowić". To jest decyzja POLITYKI retencji, nie
ograniczenie schematu.

## Czego ten dyżur świadomie NIE robi

- **Nie migruje, nie scala i nie przenosi ŻADNEGO zadania** — ani przez
  `legacy-task-cutover-runner.ts --write`, ani ręcznym `INSERT`, ani seedem udającym
  migrację.
- **Nie łączy się z bazą demo/staging** (`Z28`/`Z9`) — liczby produkcyjne to wyłącznie
  cudzy pomiar M3, zacytowany z adnotacją źródła.
- **Nie zmienia bramki `409`, nie zmienia logiki `executionWork.ts`,
  `postgresMaterialCommandUnitOfWork.ts`, `TaskController.ts` ani routerów** — czyta je,
  nie zmienia ani jednej linii kodu produkcyjnego w nich.
- **Nie rozstrzyga, który wariant (A/B/C z `R5`) jest słuszny** — to decyzja właściciela;
  dyżur dostarcza materiał, nie werdykt.
- **Nie naprawia** empty-screen efektu z `EXE-OWN-004`
  (`docs/program/waves/WAVE_03_ACCEPTANCE/modules/06_EXECUTION/MODULE_ACCEPTANCE.md:121`) —
  tylko go potwierdza/obala pomiarem jako jeden z objawów rozjazdu.

---

# 2. TEZY ZLECENIA

| # | Teza | Jak sprawdzasz |
|---|---|---|
| T1 | Legacy `tasks` to znormalizowana tabela SQL, bez `owner_id` w bazowym `CREATE TABLE` — kolumnę dokłada `20260127_pmo_task_fields.sql:6` | komenda (1) |
| T2 | Kanoniczny magazyn to agregat JSONB `ie_aggregate_state`, nie druga znormalizowana tabela; zadania mają `aggregate_type='execution_task'` | komenda (2) |
| T3 | Zapis do legacy `/api/tasks` jest dziś zablokowany `409` dla każdej metody poza `GET/HEAD/OPTIONS` (i jednego wyjątku spoza zadań) | komenda (3) |
| T4 | Front jest rozdzielony: Moja Praca czyta legacy `/api/tasks`, Execution Hub czyta wyłącznie kanoniczny `runtimeApi` | komenda (4) |
| T5 | Cudzy pomiar M3 (31.08, staging, nadzorca): `total 467 · bez_ownera 411 · bez_assignee 49 · bez_due 195 · bez_sla 467 · personal_bez_inicjatywy 265 · active_execution_cases 14 · legacy_initiatives_with_tasks 67` — NIE do odtworzenia w tym dyżurze (`Z28`) | komenda (5) |
| T6 | Przy ścisłej regule wymaganych pól dzień 204 zmierzył `0 z 467` zadań migrowalnych na miniaturze w kształcie M3 | komenda (6) |
| T7 | Most scalający (ledger + step-ledger + runner) istnieje w kodzie od dni 197/204/216, ale bez ani jednego przeniesionego zadania PRODUKCYJNEGO | komenda (7) |
| T8 | Cofnięcie migracji jednego zadania z możliwością ponowienia wymaga skasowania wpisu audytowego/outboxu (UNIQUE po `aggregate_version`) | komenda (8) |
| T9 | Miejsce na dysku wystarcza | komenda (9) |

---

# 3. POZYCJE DYŻURU

## R1 — INWENTARZ STATYCZNY OBU MAGAZYNÓW (rdzeń, dowodowy)

**Cel:** policzyć i nazwać wprost, z czego każdy magazyn dziś się składa, na własnym,
świeżo zmigrowanym markerze — bez zgadywania i bez przepisywania liczb z raportów 197/204/216.

1. Legacy `tasks`: wypisz WSZYSTKIE kolumny obecne po pełnym łańcuchu migracji na Twojej
   bazie (`\d tasks` przez `docker exec … psql`, albo `getSchemaColumns`/`getTableColumns`
   z `server/src/utils/dbSchema.js`, zaimportowany też w `TaskController.ts:29`) — **licz
   sam, nie licz z listy w `§1.1`, ta lista może być niekompletna wobec migracji spoza
   trzech cytowanych plików**.
2. Kanoniczny `ie_aggregate_state`: policz pola interfejsu `ExecutionTask` w
   `executionWork.ts` (grep `export interface ExecutionTask` i policz pola do
   zamykającego `}`), potwierdź że `payload_json` nie ma sztywnego schematu SQL (JSONB).
3. Potwierdź transakcję pięciu tabel z `§1.2` na WŁASNYM przebiegu: uruchom
   `tests/integration/day197-legacy-task-cutover.realdb.test.ts` (komplet env z `§0.2c(B)`),
   przechwyć SQL (np. `log_statement=all` na kontenerze albo debug w teście, jeśli test
   już go ma) i wypisz realną listę tabel dotkniętych w JEDNEJ transakcji `execution.task.create`.
   Jeśli różni się od pięciu wymienionych w `§1.2` — to jest **obalenie tezy z cudzego
   raportu 197**, zapisz to jako sukces dyżuru (`§A.8` pkt 6), nie jako błąd.
4. Rozłóż `bez_ownera`/`personal_bez_inicjatywy`/`bez_assignee` z `§1.5` na dokładne
   definicje SQL (`owner_id IS NULL`, `initiative_id IS NULL`, `assignee_id IS NULL`) i
   napisz zapytanie liczące ich część wspólną — patrz `R4`.

## R2 — TABELA RÓŻNIC PÓL (rdzeń, ★★ NAJWAŻNIEJSZA TABELA CAŁEGO DYŻURU)

**Cel:** dla KAŻDEJ kolumny legacy `tasks` z `R1` rozstrzygnąć: czy `ExecutionTask` ma
odpowiednik, jak się nazywa, i co konkretnie by ZGINĘŁO, gdyby ten dyżur (albo przyszła
migracja) wybrał magazyn kanoniczny jako jedyny. Szkielet tabeli (uzupełnij WYCZERPUJĄCO
z `R1`, to poniżej to punkt startowy, nie gotowa odpowiedź):

| Kolumna `tasks` (legacy) | Odpowiednik w `ExecutionTask` (kanon) | Co ginie, jeśli wygrywa kanon | Co ginie, jeśli wygrywa legacy |
|---|---|---|---|
| `id` | `taskId` | — (mapowalne 1:1) | — |
| `title` | `title` | — | — |
| `status` | `status` (`OPEN/BLOCKED/COMPLETED/CANCELED`, wyliczane przez `deriveTaskStatus`, NIE wolne pole) | Legacy ma m.in. `todo` jako wartość domyślną — mapowanie wartości status wymaga jawnej tabeli konwersji | Kanon liczy status z `blockerDecisionIds`, nie przechowuje go jako wolnego pola — legacy pozwala na dowolny string |
| `assignee_id` | `assigneeId` | — (mapowalne 1:1, o ile użytkownik istnieje po obu stronach) | — |
| `owner_id` | `ownerId` | — (mapowalne 1:1, ale `owner_id` jest null dla `411/467` wg `§1.5` — fallback trzeba nazwać jawnie) | — |
| `created_at` | `createdAt` | **`createExecutionTask` NADPISUJE `createdAt` na `new Date().toISOString()` w momencie migracji — historyczna data utworzenia jest tracona BEZPOWROTNIE** (potwierdź w `executionWork.ts`, funkcja `prepareExecutionTaskCreation`) | — |
| `completed_at` | `completedAt` | Podobnie: wycinane i nadpisywane przy tworzeniu, nie kopiowane z historii | — |
| `sla_due_at` (TEXT) | `slaAt` (wymagane, parsowalne) | — | Legacy trzyma to jako wolny tekst — `467/467` zadań na stagingu ma to pole PUSTE, więc pole nie ginie, bo nigdy nie istniało treściowo |
| `due_date` | `dueAt` (wymagane, parsowalne) | — | — |
| `checklist`, `attachments`, `tags` | *brak* | **CAŁA zawartość ginie** — `ExecutionTask` nie ma odpowiednika | — |
| `budget_allocated`, `budget_spent` | *brak* | **Ginie** — budżet zadania nie ma pola w kanonie (budżet żyje osobno w `execution_control_*`?, sprawdź) | — |
| `custom_status_id` | *brak* | **Ginie** — status niestandardowy nie ma odpowiednika | — |
| `raid_item_id`, `kpi_id`, `roadmap_initiative_id` | *brak* | **Ginie** — powiązania z RAID/KPI/roadmapą nie mają pola w kanonie | — |
| `sla_hours`, `escalation_level`, `escalated_to_id`, `last_escalated_at` | *brak* | **Ginie** — cały mechanizm eskalacji SLA nie ma odpowiednika | — |
| `task_comments` (tabela osobna, FK `task_id`) | *brak* | **Ginie w całości** — komentarze do zadania nie mają żadnego odpowiednika w Runtime-v1 | — |
| *(uzupełnij pozostałe ~40+ kolumn z `R1` wyczerpująco)* | | | |

**Reguła wypełniania:** żadna komórka „ginie" bez `plik:linia` dowodu, że pole nie
istnieje po drugiej stronie (grep interfejsu, nie domysł). Kolumny bez realnych danych na
stagingu (np. `sla_due_at` — `467/467` puste) opisz jako „pole istnieje, ale jest dziś
zawsze puste" — to inna kategoria niż „pole ginie".

## R3 — PEŁNA LISTA WOŁACZY FRONT + TYŁ (rdzeń)

Rozszerz `§1.4`/`§1.1`/`§1.2` do PEŁNEJ listy: dla każdego pliku wypisanego w
`TRASY_FRONT`/`TRASY_TYL` potwierdź grepem, że rzeczywiście woła dany magazyn, z numerem
linii. Dołącz każdy plik, którego te dwie listy NIE złapały — przeszukaj `src/` i
`server/src/` osobno wzorcami `api/tasks`, `api\.tasks`, `tasksApi`, `runtimeApi`,
`initiativesExecutionRuntime`, `execution-cases.*tasks`, `ie_aggregate_state`,
`aggregate_type.*execution_task` (bez `| head`, `§0.2d` pkt 12). Dla każdego backendowego
pliku sprawdź, czy jest osiągalny z `ApiGateway.getInstance().initializeRoutes` (`Z22`) —
nie z gołego `express()`. Osobno zaznacz, czy `TaskController.ts` ma metody, które są dziś
kodem BEZ ŻADNEGO osiągalnego wołacza (za bramką `409`) — to jest wariant wzorca
„biblioteka bez wywołania", warty jednego zdania w raporcie.

## R4 — ZAPYTANIA ROZLICZENIOWE + PRÓBA LOKALNA W KSZTAŁCIE M3 (rdzeń, dowodowy — ZERO ZAPISU PRODUKCYJNEGO)

**Cel:** przygotować i udowodnić u siebie DOKŁADNIE te zapytania SQL, które odpowiadają na
pytania właściciela — „ile w obu magazynach, ile tylko w jednym, ile kolizji identyfikatorów,
ile sprzecznych wartości tego samego pola" — a NIE liczby z produkcji (do tego nie masz
dostępu, `Z28`).

1. Odtwórz (albo skopiuj wzorcem, jeśli plik istnieje) seed w kształcie M3:
   `scripts/dev/day204-m3-shape-seed-local.mjs` — sprawdź, czy istnieje na Twoim markerze i
   czy jest bezpieczny do ponownego użycia (bariera loopback, brak połączeń zewnętrznych).
   Jeśli tak — użyj go WYŁĄCZNIE do zasiania Twojej WŁASNEJ efemerycznej bazy `cx239`.
   Jeśli nie istnieje na Twoim markerze — napisz równoważny w `/private/tmp/cx-day239-realizacja-artefakty` (nie w repo,
   chyba że zdecydujesz inaczej i jawnie to uzasadnisz w raporcie zgodnie z `Z13`).
2. Na tej lokalnej bazie napisz i uruchom zapytania liczące:
   - ile zadań istnieje TYLKO w `tasks` (dziś: wszystkie, bo `0` migracji się odbyło —
     potwierdź to na swojej świeżej bazie, nie zakładaj);
   - ile istnieje TYLKO w `ie_aggregate_state` z `aggregate_type='execution_task'`;
   - ile (hipotetycznie) miałoby ten sam `legacy_task_id` w obu — zapytanie oparte na
     `legacy_task_cutover_ledger.legacy_task_id`/`canonical_id`;
   - część wspólna i suma mnogościowa `owner_id IS NULL` / `initiative_id IS NULL` /
     `assignee_id IS NULL` (domyka `§1.5` pkt ostatni).
3. **Uruchom istniejący runner WYŁĄCZNIE w `--dry-run`** (bez `--confirm-batch`, bez
   `--write`) na tej lokalnej bazie i wklej pełne wyjście — to jest dowód, że narzędzie
   nadal działa i jakie liczby by pokazał, BEZ zapisu.
4. Zapisz wszystkie zapytania z kroku 2 jako gotowe pliki `.sql` w `/private/tmp/cx-day239-realizacja-artefakty` — to
   jest PRODUKT dla nadzorcy do ewentualnego uruchomienia na realnej bazie później, nie
   Twoje własne twierdzenie o dzisiejszym stanie produkcji.

**★★ Zero `--write`, zero `--confirm-batch`, zero ręcznego `INSERT` do tabel kanonu poza
tym, co tworzą i sprzątają po sobie istniejące testy z tabeli licencji.**

## R5 — TRZY WARIANTY ROZSTRZYGNIĘCIA (rdzeń, dokumentacyjny, JĘZYKIEM WŁAŚCICIELA)

Napisz trzy warianty prostym językiem (bez żargonu inżynierskiego w treści głównej —
szczegóły techniczne w przypisach z `plik:linia`). Dla każdego: **co zyskujemy, co
tracimy, ile danych trzeba ruszyć, co jest NIEODWRACALNE.** Oprzyj się na `R2` (co ginie)
i `§1.7` (nieodwracalność audytu).

### Wariant A — magazyn legacy (`tasks`) staje się jedynym kanonicznym

- **Zyskujemy:** żadna z ~60 kolumn i komentarzy zadań (`R2`) nie ginie; zero migracji do
  wykonania teraz.
- **Tracimy:** cały mechanizm Runtime-v1 (transakcyjność, ślad audytowy, idempotencja
  paragonów, `execution_case` jako „dom" zadania) trzeba by odbudować NAD legacy albo
  porzucić dla zadań — dziś to jest jedyny magazyn z gwarancją atomowości opisaną w `§1.2`.
  Wymaga też ODWRÓCENIA bramki `409` (decyzja `AMD-EXE-SPINE-AUTHORITY-004`), co dotyka
  pliku poza licencją tego dyżuru — tylko opis, zero zmiany.
- **Ile danych ruszyć:** zero teraz (legacy już ma `467` zadań); w przyszłości — nic, jeśli
  ten wariant wygrywa trwale.
- **Co nieodwracalne:** cofnięcie decyzji `409` samo w sobie jest odwracalne (to flaga
  bramki, nie dane) — ale KAŻDY dzień, w którym Runtime-v1 przyjmuje nowe zadania (jeśli
  ktoś by to odblokował), pogłębia rozjazd, który trzeba by wtedy odkręcić w drugą stronę.

### Wariant B — magazyn kanoniczny (Runtime-v1) staje się jedynym kanonicznym

- **Zyskujemy:** jeden model zapisu z transakcyjnością i śladem audytowym; bramka `409`
  jest już wdrożona i nie wymaga zmiany.
- **Tracimy:** wg `R2`, prawdopodobnie kilkanaście kategorii pól bez odpowiednika
  (komentarze zadań, checklisty, załączniki, budżet zadania, powiązania RAID/KPI/roadmapa,
  eskalacje SLA, status niestandardowy) — **dokładna lista to wynik `R2`, nie zgadnij tu
  liczby**. Historyczne `created_at`/`completed_at` giną przy migracji (`§1.2`,
  `prepareExecutionTaskCreation`).
- **Ile danych ruszyć:** `467` zadań legacy (cudzy pomiar, `§1.5`) — a przy ścisłej regule
  pól dzień 204 zmierzył, że `0` przechodzi bez decyzji o fallbackach dla brakującego
  `owner_id`/`slaAt`/`dueAt`. Do tego `N` poleceń governance na każdy „dom" (sprawę
  wykonawczą) — statyczna podłoga **`54`**, nie zmierzony sufit (`CODEX_DAY204…:75-77`).
- **Co nieodwracalne:** wg `§1.7` — cofnięcie migracji JEDNEGO zadania z zachowaniem
  możliwości jego PONOWNEJ migracji wymaga skasowania jego wpisu audytowego/outboxowego
  (UNIQUE po wersji agregatu). Nie da się mieć jednocześnie pełnego śladu audytowego I
  możliwości ponowienia dla tego samego zadania.

### Wariant C — scalenie (oba magazyny współistnieją z jawnym mapowaniem)

- **Zyskujemy:** nic nie trzeba wybierać na twardo od razu; most (ledger + runner) już
  istnieje i jest częściowo zabezpieczony testami (dni 197/204/216).
- **Tracimy:** dopóki scalenie trwa, rozjazd z `§1.4` (dwa ekrany, różne zadania) NIE
  znika — wręcz przeciwnie, każdy dzień dokłada nowe zadania wyłącznie do Runtime-v1
  (bo legacy ma zamknięty zapis), więc rozjazd rośnie, nie maleje, dopóki nikt nie
  przeniesie zaległych `467`.
- **Ile danych ruszyć:** wg `§1.6` — `467` zadań, z czego (rekomendacja planu z dnia 197)
  `265` osobistych zostaje w legacy na stałe, a `~202` z inicjatywą idzie do przeniesienia
  — każde wymaga zbudowania „domu" tam, gdzie go brakuje (`53`-`67` domów × podłoga `54`
  poleceń = **`2862`–`3618`** poleceń governance, statyczne wyliczenie dnia 204, NIE
  zmierzone runtime).
- **Co nieodwracalne:** to samo ograniczenie audytu z Wariantu B dotyczy KAŻDEGO
  pojedynczego zadania przenoszonego w ramach scalenia — decyzja retencji (kasować ślad
  przy cofnięciu, czy nie pozwalać na ponowienie) musi zapaść RAZ, dla całej partii, przed
  pierwszym pilotem.

## R6 — RAPORT DYŻURU (rdzeń)

Struktura wg `§R.2` (patrz `CZĘŚĆ A`), z tabelą mianowników dla KAŻDEJ liczby użytej w
`R1`–`R5`, pełnymi wyjściami komend z `§0`, i osobną, zatytułowaną sekcją **„DLA
WŁAŚCICIELA"** zawierającą WYŁĄCZNIE `R5` (trzy warianty) w formie gotowej do wklejenia —
bez żargonu, bez odwołań do nazw plików w treści głównej (przypisy osobno). Sekcja
„TWIERDZENIA NIEZWERYFIKOWANE" obowiązkowa nawet jeśli pusta — i MUSI zawierać wprost
zdanie o granicy pomiaru z `§1.5` (kto realnie ma te `14` domów kanonicznych).

---

# 4. TABELA LICENCJI PLIKOWYCH

Ten dyżur jest **pomiarowo-dowodowy**, nie buduje ani nie zmienia mechanizmu — licencja
zapisu jest świadomie wąska, ZERO zapisu do tabel produkcyjnych poza tym, co tworzą i
sprzątają po sobie istniejące testy.

| Zakres | Ścieżki |
|---|---|
| Zapis (WĄSKO) | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/06_EXECUTION/MODULE_ACCEPTANCE.md` — WYŁĄCZNIE nowa sekcja na końcu pliku (`§R.1`), zakaz kasowania/przepisywania istniejących wierszy |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY239_REALIZACJA_REPORT.md` |
| Zapis (NOWE, opcjonalnie, `R4` pkt 4) | pliki `.sql` z zapytaniami rozliczeniowymi i ewentualny nowy seed `scripts/dev/day239-…mjs` — jeśli zostają w repo, wyłącznie z jawną nazwą `day239-`; domyślnie leżą w `/private/tmp/cx-day239-realizacja-artefakty`, nie w repo |
| Uruchomienie (bez zapisu do repo) | `server/scripts/legacy-task-cutover-runner.ts` — WYŁĄCZNIE `--dry-run`, zakaz `--write`/`--confirm-batch` |
| Uruchomienie (istniejące testy, bez zmiany treści) | `tests/integration/day197-legacy-task-cutover.realdb.test.ts` · `tests/integration/day204-legacy-task-cutover-runner-options.test.ts` · `tests/integration/day204-legacy-task-cutover-idempotency.realdb.test.ts` · `tests/integration/day204-r1-mines.realdb.test.ts` · `tests/integration/day216-legacy-task-cutover-failed-status.realdb.test.ts` · `tests/integration/day216-legacy-task-cutover-atomicity.realdb.test.ts` |
| Odczyt (ZAKAZ ZAPISU) | `server/src/controllers/TaskController.ts` · `server/src/routes/pmo/tasks.routes.ts` · `server/src/middleware/executionSpineLegacyReadOnly.middleware.ts` · `server/src/routes/pmo/initiativesExecutionRuntime.routes.ts` · `server/src/routes/pmo/initiatives.routes.ts` · `server/src/domain/initiatives-execution/executionWork.ts` · `server/src/domain/initiatives-execution/executionWorkHardening.ts` · `server/src/domain/initiatives-execution/materialCommand.ts` · `server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork.ts` · `server/scripts/legacy-task-cutover-runner.ts` (kod, nie uruchomienie) · wszystkie pliki z `TRASY_FRONT`/`TRASY_TYL` |
| Odczyt (ZAKAZ ZAPISU) | `server/migrations/**` w całości, wliczając `20261721_legacy_task_cutover_ledger.sql` i `20261722_legacy_task_cutover_step_ledger.sql` — **ZERO nowej migracji w tym dyżurze** |
| Odczyt (ZAKAZ ZAPISU) | `CODEX_DAY197_MIGRACJA_E1_REPORT.md` · `INSTRUKCJA_DYZUR_204_MIGRACJA_E2.md` · `CODEX_DAY204_MIGRACJA_E2_REPORT.md` · `INSTRUKCJA_DYZUR_216_ODWRACALNOSC.md` · `CODEX_DAY216_ODWRACALNOSC_REPORT.md` · `docs/program/waves/WAVE_03_ACCEPTANCE/modules/06_EXECUTION/MODULE_ACCEPTANCE.md` (poza dopiskiem `§R.1`) |
| Odczyt (ZAKAZ ZAPISU) | `vitest.config.ts` · `tests/setup.ts` · `server/src/database/Database.ts` (`Z18`) |

**Nietykalne imiennie:** `server/src/middleware/executionSpineLegacyReadOnly.middleware.ts` ·
`server/src/domain/initiatives-execution/executionWork.ts` ·
`server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork.ts` ·
`server/src/controllers/TaskController.ts` · `server/src/routes/pmo/tasks.routes.ts` ·
`server/src/routes/pmo/initiativesExecutionRuntime.routes.ts` · każda migracja SQL ·
każdy inny `MODULE_ACCEPTANCE.md` poza Execution.

---

# 5. TWARDE ZASADY

- ★★ **CEL JEST POMIAR I DECYZYJNY DOKUMENT, NIE NAPRAWA I NIE MIGRACJA.** Jeżeli w trakcie
  pomiaru znajdziesz błąd (np. martwy kod, rozjazd dokumentacji) — nie naprawiasz w locie.
  Opisujesz w raporcie z `plik:linia` i idziesz dalej.
- ★★ **ZERO POŁĄCZEŃ Z DEMO/STAGING.** `Z28`/`Z9` obowiązują bez wyjątku. Każda liczba
  produkcyjna w raporcie jest albo cytatem z `CODEX_DAY197_MIGRACJA_E1_REPORT.md` z jawnym
  „cudzy pomiar, 31.08, nadzorca za zgodą D-12", albo wynikiem z Twojej WŁASNEJ efemerycznej
  bazy z jawnym „mój pomiar, lokalna baza `cx239`" — te dwie kategorie NIGDY się nie
  mieszają w jednym zdaniu bez rozróżnienia.
- ★★ **ZERO ZAPISU DO ŻYWYCH TABEL KANONU POZA TYM, CO SPRZĄTAJĄ PO SOBIE ISTNIEJĄCE TESTY.**
  Runner wyłącznie `--dry-run`. Zero `INSERT`/`UPDATE`/`DELETE` ręcznego na
  `ie_aggregate_state`, `ie_command_receipts`, `ie_audit_events`, `ie_outbox_events`,
  `ie_aggregate_relations`, `legacy_task_cutover_ledger`, `legacy_task_cutover_step_ledger`.
- ★★ **NUMERY LINII Z RAPORTÓW 197/204 MOGĄ BYĆ NIEAKTUALNE PO REFAKTORZE DNIA 216** — patrz
  `§0.2e(e)`. Zawsze grepuj na WŁASNYM markerze, nigdy nie przepisuj cytatu bez ponownego
  sprawdzenia.
- ★★ **ZERO KOREKTY BEZ DOWODU.** `R2` (tabela różnic pól) — żadna komórka „ginie" bez
  `plik:linia` potwierdzającego brak odpowiednika. `R5` — żadna liczba bez odesłania do
  `R1`/`R2`/`R4` albo do cytowanego cudzego pomiaru.
- ★★ **OBALENIE TEZY Z `§2` JEST SUKCESEM, NIE PORAŻKĄ** (`§A.8` pkt 6) — w szczególności
  teza o „kanonicznych miejscach wyłącznie dla organizacji syntetycznych" (`§1.5`) może
  okazać się nieaktualna wobec `executionBvpService.ts:272,424`; jeśli to potwierdzisz albo
  obalisz, zapisz to wprost z dowodem.
- ★ **PUŁAPKI ŚRODOWISKA — SPRAWDŹ KAŻDĄ U SIEBIE:** `server/src/database/Database.ts`
  ok. `:80-88` cicho podstawia atrapę bazy bez `RUN_DB_TESTS=1`; `Database.ts:686` atrapa
  zwraca `changes:1` dla KAŻDEGO `UPDATE` — pomiary danych wyłącznie na realnej bazie;
  `vitest.config.ts:210` przypina `DB_TYPE='sqlite'`; `tests/setup.ts:896` podmienia
  `global.fetch`; **komentarze w kodzie bywają nieaktualne — pięć potwierdzonych
  przypadków wcześniej w programie, plus numery linii z dnia 197/204 tego dyżuru (patrz
  wyżej)** — sprawdzaj logikę, nie ufaj opisowi ani cytatowi z poprzedniego raportu.
- ★ **`Z13`:** logi, wyniki zapytań i pliki wynikowe NIE wchodzą do repo — leżą w
  `/private/tmp/cx-day239-realizacja-artefakty`, raport podaje ścieżki i `shasum -a 256`. Wyjątek: pliki `.sql`/seed z
  `R4`, JEŚLI świadomie zdecydujesz zostawić je w repo pod jawną nazwą `day239-`.
- ★ **PUSH WYŁĄCZNIE NA `github-backup`.** `origin` jest PUBLICZNY.
- ★★ **SEKCJA „TWIERDZENIA NIEZWERYFIKOWANE" W RAPORCIE JEST OBOWIĄZKOWA.** Brak tej sekcji
  jest podstawą odrzucenia dyżuru. Musi zawierać wprost, dla kogo realnie istnieją `14`
  domów kanonicznych z `§1.5` — jeśli tego nie da się ustalić bez dostępu do demo/staging,
  napisz to jako granicę pomiaru, nie jako fakt.
