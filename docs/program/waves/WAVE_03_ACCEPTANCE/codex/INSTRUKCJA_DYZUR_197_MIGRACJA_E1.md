# INSTRUKCJA DYŻURU nr 197 — Codex — „Migracja legacy `tasks` -> kanon Runtime-v1, ETAP 1 (decyzja D-7): pomiar denominatora wg A4.0 z karta decyzyjna dla wlasciciela, rejestr `legacy_task_cutover_ledger` i przeniesienie JEDNEGO pilotazowego zadania pelnym lancuchem material-command — z twardym zakazem masowego przenoszenia"

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
> **wyłącznie** `/private/tmp/cx-day197-migracja-e1`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `60581ed6b5`**
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
Zakres: **Magazyn zadan — granica legacy `tasks` vs kanon Runtime-v1 (`ie_aggregate_state` i rodzina material-command). Dyzur PRZEKROJOWY: dotyka Realizacji, Inicjatyw i Mojej Pracy przez WSPOLNY magazyn, ale nie zmienia zadnego ekranu ani trasy HTTP. Kontrakt: `docs/program/funkcje/PLAN_MIGRACJI_TASKS_KANON.md` (rozdzialy A4.0, A4, A5, A6, A7)**.
Trasy front: `BRAK ZMIAN FRONTU. Ten dyzur nie dotyka ani jednego pliku w `src/`. Kontekst do ewentualnego odczytu, NIE zmieniasz: `src/components/InitiativeTasksTab.tsx` i `src/components/dashboard/UserTaskList.tsx` — plan (A5) wskazuje je jako ciche zaleznosci UI wobec bramy `409`, do osobnej pracy. ★ Jesli w trakcie dyzuru uznasz, ze potrzebujesz zmiany we froncie — to jest sygnal, ze wyszedles poza etap 1: STOP MERYTORYCZNY pozycji i wpis do raportu, nie zmiana pliku`. Trasy tył: `Ten dyzur NIE dodaje ani nie zmienia zadnej trasy HTTP. Pracujesz o pietro nizej — na warstwie domenowej i na bazie. Lancuch, ktory ma przejsc Twoj runner (wszystko przez `executeMaterialCommand`, `server/src/domain/initiatives-execution/materialCommand.ts:457-572`): `initiative.register` (`registerInitiative.ts:80-89`) -> `initiative.schedule.request` (`scheduleDecision.ts:182-198`) -> `initiative.schedule.decide` z outcome APPROVED (`scheduleDecision.ts:262-278`, `:354`; tworzy `handoff_package` `:372-379`) -> `initiative.handoff.request` (`handoffAcceptance.ts:64-83`; ★ to TY podajesz `executionCaseId`, `:70`/`:113-117`/`:123`) -> `initiative.handoff.decide` z outcome ACCEPT (`handoffAcceptance.ts:155-171`; warunki `:198-211`; TWORZY `execution_case` v1 `state:'ACTIVE'` `:245-252`) -> `execution.task.create` przez `createExecutionTask` (`executionWork.ts:124-131`, walidacja `:139-148`, `caseAndRollup` `:78-117`, relacja `EXECUTION_CASE_TASK` `:167-176`). Kazde polecenie zapisuje w JEDNEJ transakcji: `persistAggregate` (`materialCommand.ts:518-525`), `appendAudit` (`:526-538`), `appendOutbox` (`:539-548`), `saveReceipt` (`:560`); fizyczny CAS w SQL: `postgresMaterialCommandUnitOfWork.ts:287` (UPDATE ... WHERE version=$6) i `:295` (INSERT ... ON CONFLICT DO NOTHING). Odczyt dowodowy: `postgresInitiativeReader.ts:310` (`listExecutionTasks`, SQL `:316`). ★ Brama `409` (`server/src/routes/pmo/tasks.routes.ts:67` i cztery dalsze montaze) ZOSTAJE nietknieta`.

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
WT=/private/tmp/cx-day197-migracja-e1
MARKER=60581ed6b5

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/codex/m03-admin-20260824
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/codex/m03-admin-20260824 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day197-migracja-e1-20260831 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day197-migracja-e1/config.worktree"
cat "$VAULT/worktrees/cx-day197-migracja-e1/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day197-migracja-e1-scratch
mkdir -p /private/tmp/cx-day197-migracja-e1-artefakty

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
git -C "$VAULT" log --oneline 60581ed6b5..github-backup/codex/m03-admin-20260824
git -C "$VAULT" diff --name-only 60581ed6b5..github-backup/codex/m03-admin-20260824
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day197-migracja-e1-20260831
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 60581ed6b5..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `dziewiec` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd /private/tmp/cx-day197-migracja-e1

# (T1) GENEZA DOMU — jedyne miejsce, w ktorym powstaje `execution_case`
grep -rn "persistRelatedAggregate(" server/src/domain/initiatives-execution/*.ts \
  | grep "execution_case"
sed -n '229,262p' server/src/domain/initiatives-execution/handoffAcceptance.ts
#   oczekiwane: DOKLADNIE JEDNO trafienie grepa (handoffAcceptance.ts), a w wycinku
#   `state: 'ACTIVE'` (ok. :232), `persistRelatedAggregate(..., 'execution_case', ..., 0, 1, ...)`
#   (ok. :245-252) i claim relacji INITIATIVE_EXECUTION_CASE (ok. :253-262).
#   Jesli grep da wiecej niz jedno trafienie — to obala T1 i idzie do Korekt.

# (T2) executionCaseId JEST WEJSCIEM, NIE JEST GENEROWANY PRZEZ KANON
sed -n '64,72p;113,125p' server/src/domain/initiatives-execution/handoffAcceptance.ts
#   oczekiwane: `executionCaseId` jako pole typu payloadu requestu (ok. :70),
#   walidacja na niepusty (ok. :113-117) i zapis do payloadu decyzji (ok. :123).
#   Wniosek dla runnera: identyfikator sprawy wymyslasz TY, deterministycznie.

# (T3) expectedCaseVersion I caseAndRollup — trzy warunki naraz
sed -n '78,117p;124,131p;139,157p' server/src/domain/initiatives-execution/executionWork.ts
#   oczekiwane: w `caseAndRollup` warunek na `version === expectedCaseVersion`,
#   zgodnosc `initiativeId` i `state === 'ACTIVE'` (ok. :87-93) oraz persist
#   `expectedCaseVersion -> +1` (ok. :108-115); w sygnaturze `createExecutionTask`
#   pole `expectedCaseVersion: number` (ok. :128); walidacja rzucajaca
#   'Task ownership and SLA are required' (ok. :148).

# (T4/T5) REPLAY: dokladny literal statusu ORAZ z czego liczony jest fingerprint
grep -n "REPLAYED\|APPLIED" server/src/domain/initiatives-execution/materialCommand.ts
sed -n '319,345p;474,494p' server/src/domain/initiatives-execution/materialCommand.ts
#   oczekiwane: typ `status: 'APPLIED' | 'REPLAYED'` (ok. :19), `status: 'REPLAYED'`
#   (ok. :487), `status: 'APPLIED'` (ok. :563); fingerprint liczony z
#   aggregateType/aggregateId/commandType/expectedVersion/policyId/policyVersion/payload
#   (ok. :334-342) — BEZ actorId, organizationId i correlationId.
#   To ostatnie zdanie zweryfikuj SAM: od niego zalezy, czy batch-id jest
#   bezpiecznym kluczem ponowienia.

# (T6) CO NAPRAWDE JEST ZAPISYWANE W JEDNEJ TRANSAKCJI — policz TABELE, nie wywolania
sed -n '515,562p' server/src/domain/initiatives-execution/materialCommand.ts
grep -n "CREATE TABLE IF NOT EXISTS" server/migrations/932_initiatives_execution_material_commands.sql
#   oczekiwane: cztery wywolania (persistAggregate ok. :518, appendAudit ok. :526,
#   appendOutbox ok. :539, saveReceipt ok. :560) i SZESC tabel `ie_*` w migracji 932.
#   Zamowienie mowilo "6 tabel w transakcji" — policz sam, ile tabel dostaje wiersz
#   przy jednym `execution.task.create`, i wpisz SWOJA liczbe z lista nazw.

# (T7) claimRelation BEZ ON CONFLICT vs PK/UNIQUE relacji
sed -n '360,382p' server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork.ts
sed -n '117,129p' server/migrations/932_initiatives_execution_material_commands.sql
#   oczekiwane: INSERT INTO ie_aggregate_relations bez `ON CONFLICT`, zakonczony
#   requireSingleRow(..., 'relation claim'); w migracji PRIMARY KEY po source i
#   UNIQUE po target. Wniosek: ponowienie z NOWYM clientRequestId uderzy w PK.

# (T8) MIGRACJE — jaki jest NAPRAWDE najpozniejszy klucz fazy DATED
ls server/migrations | grep -E '^[0-9]{8}_.*\.sql$' | sort | tail -5
grep -n "DATED_RE\|NUMBERED_RE" server/scripts/migrationOrdering.ts
npx tsx server/scripts/validate-migration-naming.ts 2>&1 | tail -5
#   oczekiwane: ostatni klucz DATED to `20261720_day131_teresa_knowledge_boundaries.sql`
#   (prefiksy sa PSEUDO-datami, nie kalendarzem); `DATED_RE` ok. :26 bez walidacji
#   zakresu; walidator konczy sie NIEZEROWYM kodem juz dzis — zapisz liczbe bledow
#   PRZED swoja zmiana, zeby moc pokazac, ze NIE WZROSLA.

# (T9) KTORY SEED — 8 flag i ZERO zadan kontra seed, ktory zadania wstawia
grep -c "INSERT INTO tasks" scripts/dev/case-workspace-seed-local.mjs || true
sed -n '70,79p' scripts/dev/case-workspace-seed-local.mjs
grep -n "INSERT INTO tasks" server/scripts/seed-demo-dataset-contract.ts | head -3
#   oczekiwane: `case-workspace-seed-local.mjs` ma ZERO `INSERT INTO tasks` i osiem
#   modulow flag; `seed-demo-dataset-contract.ts` ma `INSERT INTO tasks` (ok. :290).
#   To rozstrzyga, ktory seed idzie do M1, a ktory do M2 (patrz R1).
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day197-migracja-e1-20260831` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6128`. Twój JEDYNY port harnessu to `5066 i 5067`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day197-pg`**. **ZAKAZANE:** `6012, 5433, 6047, 6054-6127, 5010-5065, 6404-6411 (zajete przez wczesniejsze dyzury i odbiory nadzorcy), oraz wzajemnie porty partii rownoleglej: 6128-6132 i 5066-5075 poza wlasnym przydzialem. Twoj wylaczny przydzial to baza `6128` i harness `5066 i 5067` — nic wiecej. ★ PORT 5000 ZAJETY NA STALE przez macOS Control Center. ★ PORT 5037 ZAJETY przez `adb` (serwer Androida). ★★ Bramka `day161` stawia WLASNY kontener i WLASNY port — nie bierzesz dla niej drugiego portu, tylko usuwasz swoj kontener na czas jej przebiegu i odtwarzasz po nim (dokladna sekwencja w pozycji R2a). ★ Ta lista jest rozkazem pomiarowym, nie gwarancja — zweryfikuj `lsof -i` i `docker ps` przed startem i wpisz wynik `X z 3` do raportu`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `brak nowej flagi i brak potrzeby jej wprowadzenia — ten dyzur nie ma powierzchni wizualnej (`CLAUDE.md` §7 dotyczy ekranow, a Ty nie dotykasz `src/`). ★★ ROLE FLAGI PELNI TU CO INNEGO I MA BYC RowNIE TWARDE: nowy runner przenosin ma **dry-run jako zachowanie domyslne** i wchodzi w tryb zapisu wylacznie po jawnym `--write` ORAZ zmiennej potwierdzajacej (`requireConfirmation`, wzorzec `server/scripts/lib/scriptDatabaseTarget.ts:104-113`). Runner, ktory pisze bez obu tych warunkow naraz, jest odrzuceniem pozycji — niezaleznie od jakosci reszty. ★ Nie zmieniasz wartosci domyslnej ZADNEJ istniejacej flagi (`Z10`), w szczegolnosci niczego, co dotyka bramy `409``, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/**` (w szczegolnosci `executionSpineLegacyReadOnly.middleware.ts` i kazdy `requireCanonicalExecutionWriter` / `requireCanonicalInitiativeExecutionWriter`), `server/src/routes/pmo/tasks.routes.ts` (montaz bramy na `:67` i wszystkie 24 mutujace trasy), `server/src/Gateway.ts`, `server/src/routes/v8/index.ts`, `server/src/services/aiRoleGuard.ts`, `server/src/services/chatPermissionService.ts`, `server/src/routes/auth*.ts`, wszystko pod `server/src/services/betaAccess*`, oraz caly `server/src/domain/initiatives-execution/**` (odczyt TAK, zapis NIE)`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY197_MIGRACJA_E1_REPORT.md`. Nie zmieniasz zadnego `MODULE_ACCEPTANCE.md` — ten dyzur jest przekrojowy (magazyn zadan obsluguje Realizacje, Inicjatywy i Moja Prace naraz, a zaden z tych trzech dokumentow nie ma dzis wiersza o migracji legacy->kanon; dopisanie go bylo by tworzeniem nowego stanu w rejestrze, ktorego nikt nie zamowil). Jedyny inny dokument do zmiany: `docs/program/funkcje/PLAN_MIGRACJI_TASKS_KANON.md` — DOPISUJESZ nowy rozdzial `A8. Wykonanie — etap 1` (wyniki R1 i R2, karta decyzyjna w skrocie, otwarte decyzje wlasciciela) i KORYGUJESZ w rozdziale A4 zdanie o dacie migracji rejestru cutover. Nie przepisujesz A1-A7, nie zmieniasz werdyktu planu ani jego rekomendacji. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day197-migracja-e1-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day197-migracja-e1-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★ **ZELAZNA KOLEJNOSC R1 -> R2 -> R3, udowodniona KOLEJNOSCIA COMMITOW.** Karta decyzyjna z R1 ma byc zacommitowana PRZED migracja z R2. Odwrotna kolejnosc jest podstawa odrzucenia pozycji, nawet przy dobrej tresci. ★★ **PRZENOSISZ DOKLADNIE JEDNO ZADANIE.** Zakaz petli po `tasks` (takze z `LIMIT`), zakaz budowania domow kanonicznych dla wiecej niz jednej inicjatywy, zakaz uruchomienia runnera w trybie zapisu na wiecej niz jednym wierszu. Limit ma byc egzekwowany KODEM runnera, nie dobra wola. Etap 2 rusza dopiero po akcepcie wlasciciela na karcie decyzyjnej. ★★ **BRAMA `409` ZOSTAJE** — nie zdejmujesz jej, nie oslabiasz, nie dodajesz wyjatku, nie odmontowujesz zadnego routera ani middleware (`Z12`, `Z19`; rozdzial A5 planu mowi wprost: „Nie zdejmowac”). Nie domykasz tez luki `POST /api/my-work/personal-tasks` — trzy warianty z A5 to ANALIZA, nie decyzja, i zaden z nich nie wchodzi do tego dyzuru. ★★ **MIGRACJA CZYSTO ADDYTYWNA:** `CREATE TABLE IF NOT EXISTS` + indeksy. Zero `ALTER` na cudzych tabelach, zero odczytu jakiejkolwiek kolumny, zero `FOREIGN KEY` do `tasks` ani do `ie_aggregate_state`. Migracja czytajaca kolumne dodawana pozniej w kolejnosci sortowania wywraca caly lancuch na bazie od zera — to udokumentowana klasa bledu w tym programie i dokladnie to, czego szuka bramka `day161`. Przedzial numerow `20261721`-`20261729` jest zarezerwowany dla tego dyzuru (wzorem `DEC-2026-08-26-98` pkt 4); nie bierzesz numeru spoza przedzialu, nawet gdyby byl wolny. Sufiks literowy po dacie (`20261721a_...`) jest ZAKAZANY — lamie `DATED_RE` i konczy sie `UnclassifiedMigrationFilenameError`. ★★ **`Z31` — ZAKAZ PINOWANIA STRAZNIKA REALDB DO HOSTA, PORTU ALBO NAZWY BAZY.** Wolasz `await assertRealPostgresTestEnvironment()` BEZ ARGUMENTOW, w szczegolnosci bez `expectedDatabase`; zakaz asercji na `DATABASE_URL`, na porcie i na nazwie kontenera. Powod: dyzur 43 przypial straznika do swojej bazy i po usunieciu kontenera 30 przypadkow dowodowych stalo sie trwalym `SKIP` przy `exit 0`; w programie odnotowano SZESC takich incydentow, a dyzur 193 zamowiono wylacznie po to, zeby je zbiorczo odpiac. Nie dokladaj siodmego. Test `day160` jest zepsuty dokladnie tym wzorcem (plan A7) — ODNOTOWUJESZ to, ale go w tym dyzurze NIE naprawiasz. ★★ **`Z15` obowiazuje w calosci — zero modelu jezykowego.** Ten dyzur nie ma licencji na zaden klucz dostawcy; zaden pomiar, straznik ani runner nie wola `llmService`, `/api/ai/**` ani `GoogleGenerativeAI`. ★★ **`Z27` — ZAKAZ `git stash`** w kazdej postaci (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkladasz przez `cp` do scratcha i wracasz przez `cp`; schowek jest wspoldzielony miedzy wszystkimi worktree tego repozytorium. ★★ **`Z28` — zero polaczen do bazy zdalnej, demo, stagingu i produkcji, w kazda strone i kazdym narzedziem.** Dotyczy to takze pomiaru M3: paczke zapytan ZOSTAWIASZ w artefaktach, sam jej NIE uruchamiasz. Zdanie „na demo pewnie jest podobnie” jest ekstrapolacja i jest zakazane. ★★ **Sprzatanie kontenera: `docker rm -f -v`** — z flaga `-v`, inaczej wolumen zostaje na dysku. ★★ **Zakaz naprawiania przez wyciszanie** (`@ts-ignore`, `.skip`, poszerzanie `exclude`, `--no-verify`) i zakaz usuwania zastanych testow — asercje wolno ZMIENIC z uzasadnieniem, nie skasowac | Wlasciciel podjal decyzje D-7 (`docs/program/funkcje/DECYZJE_WLASCICIELA_2026-08-30_WIECZOR.md:28`): migracja legacy->kanon w MVP, najpierw dyzur ANALIZY, potem dyzur WYKONANIA, brama `409` zostaje do konca migracji. Analiza (dyzur 184) jest zrobiona i scalona po FIX-184; jej produkt `docs/program/funkcje/PLAN_MIGRACJI_TASKS_KANON.md` jest kontraktem tego dyzuru. Odbior 184 (`ODBIOR_184_ANALIZA_MIGRACJI.md`) zamknal sie odkryciem, ktore ustawia kolejnosc: „Nie istnieje zadne polecenie tworzace `execution_case`. Jedyna geneza: handoffAcceptance.ts:245-251 ... Pierwszym krokiem dyzuru wykonania MUSI byc pomiar denominatora (aktywne sprawy vs distinct initiative_id w tasks) — wynik idzie do wlasciciela PRZED startem wykonania.” Koszt D-7 moze byc przez to zanizony o rzad wielkosci, bo migracja jednego zadania wymaga NAJPIERW przeprowadzenia jego inicjatywy przez piec polecen produktowych (piec transakcji z audytem, outboxem i paragonem kazda). ★★ TRZY ZNALEZISKA POMIAROWE, ktore ta instrukcja dodaje do planu i ktore masz obalic albo potwierdzic: (a) plan mowi, ze nowa migracja ma byc „datowana po 20260830_day175”, ale w fazie DATED jest 142 migracje o wiekszym kluczu, a maksymalny to `20261720_day131_teresa_knowledge_boundaries.sql` — prefiksy sa PSEUDO-datami, nie kalendarzem, wiec `20260901_...` wyladowaloby przed 141 innymi; dlatego nazwa jest `20261721_legacy_task_cutover_ledger.sql`; (b) `server/scripts/validate-migration-naming.ts` NIE JEST DZIS ZIELONY — ma 20 zastanych plikow niepasujacych do zadnego wzorca i konczy sie `exit 1` niezaleznie od Ciebie, wiec „przejsc walidator” moze znaczyc wylacznie „moj plik pasuje do regexa i liczba bledow nie wzrosla”; (c) nazwa „seed demo-kontraktu” prowadzi do zlego pliku: liczby z rozdzialu A7 planu (1 org, 1 user, 1 ACTIVE member, 1 project, 8 flags, 0 tasks) odpowiadaja `scripts/dev/case-workspace-seed-local.mjs`, a `npm run db:seed:demo:contract` (`server/scripts/seed-demo-dataset-contract.ts`) wstawia zadania (`INSERT INTO tasks:290`) i nie dotyka czlonkostw ani flag — oba sa przydatne, ale do ROZNYCH pomiarow. ★ Dodatkowo: zaden skrypt w `server/scripts/` ani `scripts/` nie wola dzis `executeMaterialCommand` ani `createExecutionTask` — Twoj runner bedzie pierwszym skryptem tego gatunku w tym repozytorium i nie ma dla niego precedensu |

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
cd /private/tmp/cx-day197-migracja-e1

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day197-pg psql -U postgres -d cx197 \
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
cd /private/tmp/cx-day197-migracja-e1

docker run -d --name cx-day197-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx197 \
  -p 127.0.0.1:6128:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day197-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6128/cx197 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6128/cx197 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day197-migracja-e1 && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6128/cx197 \
JWT_SECRET=cx197-test-secret-do-not-reuse \
npx vitest run tests/integration/day197-legacy-task-cutover.realdb.test.ts --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day197-migracja-e1-artefakty/day197-migracja-etap1.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day197-migracja-e1 && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run tests/integration/day197-legacy-task-cutover.realdb.test.ts --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day197-migracja-e1-artefakty/day197-migracja-etap1.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day197-migracja-e1/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day197-pg psql -U postgres -d cx197 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day197-pg`.
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
> **(e) ★★ **Pierwsza: `executionCaseId` nie jest generowany przez kanon — TY go podajesz.** `initiative.handoff.request` przyjmuje go jako pole payloadu (`handoffAcceptance.ts:70`), waliduje na niepusty (`:113-117`) i przenosi niezmieniony do `execution_case` (`:230`, `:248`). Jesli zalozysz, ze kanon nada identyfikator sam, polecenie 4 lancucha padnie na walidacji, a Ty stracisz godzine na szukaniu bledu w polecen 5. Zaprojektuj identyfikatory deterministycznie PRZED pierwszym uruchomieniem runnera. ★★ **Druga: `expectedCaseVersion` to nie jest ozdoba — to trzy warunki naraz.** `caseAndRollup` (`executionWork.ts:78-117`) czyta `execution_case` FOR UPDATE i wymaga JEDNOCZESNIE: `version === expectedCaseVersion`, zgodnego `initiativeId` ORAZ `state === 'ACTIVE'` (`:87-93`), po czym podbija wersje sprawy o 1 (`:108-115`). Kazde utworzone zadanie ZMIENIA wersje sprawy — wiec przy drugim zadaniu w tej samej sprawie `expectedCaseVersion` jest juz inne. To jest powod, dla ktorego plan (A4) kaze isc SZEREGOWO per sprawa i odswiezac wersje, a nie ponawiac losowo. ★★ **Trzecia: fingerprint requestu NIE obejmuje `correlationId`.** Liczony jest z `aggregateType, aggregateId, commandType, expectedVersion, policyId, policyVersion, payload` (`materialCommand.ts:329-345`). Skutek praktyczny: zmiana samego `batch-id` pod tym samym `clientRequestId` NIE wywola konfliktu — dostaniesz `REPLAYED` (`:487`). To znaczy, ze `batch_id` w rejestrze cutover NIE JEST kluczem ponowienia i nie chroni przed pomyleniem partii. Zmierz to i napisz w raporcie, bo etap 2 bedzie na tym polegal. ★★ **Czwarta: `claimRelation` nie ma `ON CONFLICT`, a relacja ma PK i UNIQUE.** `postgresMaterialCommandUnitOfWork.ts:364-382` konczy sie `requireSingleRow(..., 'relation claim')`, a `ie_aggregate_relations` ma PRIMARY KEY po zrodle i UNIQUE po celu (`932_initiatives_execution_material_commands.sql:117-129`). Replay jest bezpieczny WYLACZNIE dzieki wczesniejszemu wyjsciu na `REPLAYED`, ktore konczy sie PRZED transakcja (`materialCommand.ts:486-494`). **Ponowienie z NOWYM `clientRequestId` po czesciowej awarii uderzy w PK relacji, nie w no-op.** Jesli to potwierdzisz, jest to znalezisko do planu — bo etap 2 polegnie na tym przy pierwszej partii, a plan A6 mowi o tym tylko posrednio. ★★ **Piata: `createExecutionTask` nie pozwala zachowac historii.** `status`, `createdAt` i `completedAt` sa wyciete z payloadu (`Omit`, `executionWork.ts:126-129`) i nadpisywane (`:161-163`), a `createdAt` to zawsze `new Date().toISOString()` (`:162`). Historyczne `tasks.created_at` jest w tej komendzie tracone bezpowrotnie. Plan A3 mowi o tym ogolnie („zachowanie historii wymaga rozszerzenia commandu”) — Ty masz to POTWIERDZIC pomiarem i wpisac jako swiadoma utrate do karty decyzyjnej, zeby wlasciciel wiedzial, na co sie godzi w etapie 2. ★★ **Szosta: odczyt dowodowy potrafi sie wysadzic na JEDNYM zlym wierszu.** `postgresInitiativeReader.listExecutionTasks` (`:310`, SQL `:316`) sortuje po `(payload_json->>'dueAt')::timestamptz`, a walidacja tworzaca przepuszcza `dueAt` przez `Date.parse` (`executionWork.ts:145`), ktore akceptuje formaty, jakich Postgres `::timestamptz` moze nie przyjac. Jeden zle sformatowany `dueAt` wywala CALY odczyt sprawy, nie jeden wiersz. Zmierz to swiadomie — to jest dokladnie ta klasa bledu, ktora w etapie 2 wyglada jak „migracja zepsula Realizacje”. ★★ **Siodma: bramka `day161` nie wypisuje swojego PASS do zadnego logu.** `scripts/dev/day161-fresh-migration-check.sh:55` echuje `DAY161_FRESH_MIGRATION_GATE=PASS` na stdout, JUZ PO ostatnim `tee`. Odbior 184 slusznie usunal to twierdzenie z planu jako niepodparte („napisu nie ma w logach”). Lap PASS z wyjscia procesu, nie z pliku logu, i napisz w raporcie, skad go wziales. Bramka stawia tez WLASNY kontener i odmawia zajetego portu — sekwencja obejscia w R2a. ★★ **Osma: pomiar, o ktory prosi wlasciciel, jest lokalnie NIEWYKONALNY — i to jest wynik, nie porazka.** Realny denominator dotyczy danych na demo/produkcji, a `Z28` zabrania tam siegac. Najlatwiejszym bledem tego dyzuru jest podanie liczby z lokalnej bazy tak, jakby byla odpowiedzia na pytanie wlasciciela. Podajesz TRZY pomiary z jawnymi mianownikami (M1, M2) i JAWNIE piszesz, ze M3 nie zostal wykonany i dlaczego, zalaczajac paczke zapytan do uruchomienia cudza reka. Uczciwie opisany brak jest tu wart wiecej niz okragla liczba**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day197-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day197-migracja-e1-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1 — POMIAR DENOMINATORA wg A4.0 (trzy pomiary: M1 na seedzie odniesienia, M2 na seedzie z zadaniami, M3 jawnie NIEWYKONALNY lokalnie przez `Z28` + paczka zapytan do uruchomienia cudza reka) zakonczony KARTA DECYZYJNA dla wlasciciela w szesciu punktach, zacommitowana PRZED czymkolwiek innym. R2 — migracja addytywna `server/migrations/20261721_legacy_task_cutover_ledger.sql` (pelny przebieg od pustej bazy + replay `Applying migrations: 0` + bramka `day161`) ORAZ przeniesienie DOKLADNIE JEDNEGO pilotazowego zadania pelnym lancuchem piecu polecen z A4.0, z czterema dowodami: wiersz w rejestrze, odczyt przez `postgresInitiativeReader.listExecutionTasks`, replay ze statusem `REPLAYED`, przetestowana naprawa do przodu`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6128` albo `5066 i 5067` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6128` albo `5066 i 5067`** (`Z7`).

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

Właściciel podjął decyzję **D-7** (`docs/program/funkcje/DECYZJE_WLASCICIELA_2026-08-30_WIECZOR.md:28`):

> **Realizacja: magazyn zadań → MIGRACJA legacy→kanon W MVP** (najdroższa opcja —
> decyzja świadoma); najpierw dyżur ANALIZY, potem **dyżur wykonania**; brama `409`
> zostaje do końca migracji.

Dyżur analizy (184) wykonano, plan `docs/program/funkcje/PLAN_MIGRACJI_TASKS_KANON.md`
scalono po `FIX-184` i **ten plan jest kontraktem tego dyżuru — przeczytaj go
w CAŁOŚCI, zanim cokolwiek napiszesz.** Ty jesteś dyżurem wykonania, **etap 1**.

Odbiór 184 (`docs/program/funkcje/ODBIOR_184_ANALIZA_MIGRACJI.md`) zamknął się
odkryciem, które ustawia kolejność tego dyżuru i której nie wolno przestawić:

> **★★ ODKRYCIE ODBIORU — koszt D-7 może być zaniżony o rząd wielkości.**
> **Nie istnieje żadne polecenie tworzące `execution_case`.** Jedyna geneza:
> `handoffAcceptance.ts:245-251` (łańcuch: agregat initiative → pakiet handoff →
> request → decide(ACCEPTED) → sprawa v1). Migracja zadania wymaga więc NAJPIERW
> zbudowania domu kanonicznego per inicjatywa. **Pierwszym krokiem dyżuru wykonania
> MUSI być pomiar denominatora (aktywne sprawy vs distinct `initiative_id` w `tasks`)
> — wynik idzie do właściciela PRZED startem wykonania.**

Dlatego etap 1 ma **żelazną kolejność `R1 → R2 → R3`** i twardą regułę: **żadnego
masowego przenoszenia w tym dyżurze.**

## Co ten dyżur ma dowieźć, jednym zdaniem na pozycję

- **R1** — **liczba dla właściciela.** Denominator wg `A4.0`, zmierzony u Ciebie,
  z uczciwym mianownikiem i uczciwym ograniczeniem, plus **karta decyzyjna**
  gotowa do wklejenia właścicielowi. To jest artefakt nr 1 całego dyżuru.
- **R2** — **dowód, że łańcuch da się przejść.** Migracja addytywna
  `legacy_task_cutover_ledger` + **przeniesienie JEDNEGO pilotażowego zadania**
  pełnym łańcuchem produktowym, z wierszem w rejestrze, idempotentnym replayem
  i przetestowaną naprawą do przodu.
- **R3** — **jawny zakaz.** Masowe przenoszenie NIE wchodzi do tego dyżuru.

## ★★ Trzy rzeczy, których plan NIE mówi, a które zmierzyłem przy pisaniu tej instrukcji

Wszystkie trzy są **do obalenia przez Ciebie** (`Z24`), ale jeśli się potwierdzą,
oszczędzą Ci pół dnia.

**(a) Data nowej migracji z planu jest za słaba.** Plan (`A4`) mówi: *„ewentualny
DDL rejestru cutover musi byc datowany po `20260830_day175...`"*. To prawda, ale
niewystarczająca: w fazie `DATED` jest **142 migracje o kluczu sortowania większym
niż `20260830`**, a maksymalny klucz to **`20261720_day131_teresa_knowledge_boundaries.sql`**.
Prefiksy są **pseudo-datami**, nie kalendarzem (`20261720` = rok 2026, „miesiąc" 17).
`DATED_RE` (`server/scripts/migrationOrdering.ts:26`) nie waliduje zakresu, więc
takie nazwy przechodzą i sortują się leksykograficznie. Nazwa `20260901_…` spełni
literę planu i wyląduje **przed 141 innymi migracjami**.

**(b) Walidator nazw migracji NIE JEST DZIŚ ZIELONY.** `server/scripts/validate-migration-naming.ts`
ma dziś **20 zastanych plików** niepasujących do żadnego z trzech wzorców `.sql`
(m.in. `067b_…`, `160b_…`, `2026-06-08_qa_schema_drift_catchup.sql`, rodzina
`20260802c/20260810c-f/…`, `951a_…`, `956a_…`, `add_chat_projects.sql`) i kończy
się `exit 1` niezależnie od Ciebie (`:144`). **„Przejść walidator" nie może
znaczyć `exit 0`.** Może znaczyć wyłącznie: Twój plik pasuje do
`^\d{8}_[a-z0-9_]+\.sql$` i **liczba błędów nie rośnie**. Zmierz obie liczby
(przed/po) i podaj je z mianownikiem.

**(c) Nazwa seeda w zamówieniu prowadzi do złego pliku.** Skrypt, którego liczby
odpowiadają rozdziałowi `A7` planu (**1 org, 1 user, 1 ACTIVE member, 1 project,
8 flags, 0 tasks**), to **`scripts/dev/case-workspace-seed-local.mjs`**
(8 flag: `:70-79`; brak jakiegokolwiek `INSERT INTO tasks`; bariera loopback `:40-51`).
Skrypt npm `db:seed:demo:contract` (`server/scripts/seed-demo-dataset-contract.ts`)
to **coś innego**: wstawia zadania (`INSERT INTO tasks` `:290`, `atelier-task-NN`)
i nie dotyka `organization_members` ani flag. **Oba są przydatne, ale do różnych
pomiarów — patrz R1.**

# 2. TEZY ZLECENIA

Wszystkie poniższe to **rozkaz pomiarowy, nie prawda objawiona**. Obalenie
którejkolwiek jest sukcesem dyżuru i wchodzi do „Korekt wobec instrukcji".

- **T1.** Jedyna geneza `execution_case` w kodzie produkcyjnym to
  `handoffAcceptance.ts:245-252` (obiekt `:229-244`, `state:'ACTIVE'` na `:232`).
  Żadne inne polecenie nie tworzy tego agregatu.
- **T2.** ★ `executionCaseId` **NIE jest generowany przez kanon** — jest polem
  WEJŚCIOWYM koperty `initiative.handoff.request` (`handoffAcceptance.ts:70` typ,
  `:113-117` walidacja, `:123` zapis do payloadu decyzji) i jest przenoszony
  niezmieniony do `execution_case` (`:230`, `:248`). To zmienia sposób, w jaki
  projektujesz identyfikatory pilota.
- **T3.** `createExecutionTask` wymaga `expectedCaseVersion` w payloadzie
  (`executionWork.ts:128`), a `caseAndRollup` (`:78-117`) czyta `execution_case`
  `FOR UPDATE` i wymaga **jednocześnie**: `version === expectedCaseVersion`,
  zgodnego `initiativeId` i `state === 'ACTIVE'` (`:87-93`), po czym podbija
  wersję sprawy `expectedCaseVersion → +1` (`:108-115`).
- **T4.** Status powtórzonego polecenia z tym samym `clientRequestId` to dokładnie
  literał **`'REPLAYED'`** (`materialCommand.ts:487`); jedyne dwa dopuszczalne
  statusy to `'APPLIED' | 'REPLAYED'` (`:19`).
- **T5.** ★ Fingerprint requestu **NIE obejmuje** `actorId`, `organizationId` ani
  `correlationId` — liczony jest z `aggregateType, aggregateId, commandType,
  expectedVersion, policyId, policyVersion, payload`
  (`materialCommand.ts:329-345`, kanonizacja `:319-327`). **Skutek: zmiana samego
  `batch-id` (czyli `correlationId`) pod tym samym `clientRequestId` NIE wywoła
  konfliktu — zwróci `REPLAYED`.** Zmiana `expectedVersion` konflikt wywoła.
- **T6.** `executeMaterialCommand` zapisuje w JEDNEJ transakcji cztery rzeczy:
  `persistAggregate` (`:518-525`), `appendAudit` (`:526-538`), `appendOutbox`
  (`:539-548`), `saveReceipt` (`:560`). Do tego `createExecutionTask` dokłada
  `claimRelation` i podbicie wersji sprawy. **Policz sam, ile TABEL naprawdę
  dostaje wiersz w jednej transakcji** — zamówienie mówiło „6 tabel", migracja 932
  tworzy 6 tabel, ale jedna z nich (`ie_governance_policies`) nie jest przez to
  polecenie zapisywana. Podaj swoją liczbę z listą nazw tabel.
- **T7.** ★ `claimRelation` (`postgresMaterialCommandUnitOfWork.ts:364-382`)
  **nie ma `ON CONFLICT`**, a `ie_aggregate_relations` ma PK
  `(organization_id, relation_type, source_type, source_id)` i UNIQUE po celu
  (`932_initiatives_execution_material_commands.sql:117-129`). Replay jest
  bezpieczny **wyłącznie** dzięki wcześniejszemu wyjściu na `REPLAYED`
  (`materialCommand.ts:486-494`) — **retry z NOWYM `clientRequestId` po częściowej
  awarii uderzy w PK relacji.** To jest sedno reguły „nie zmieniasz payloadu pod
  tym samym request ID" z planu `A6`.
- **T8.** ★ `createExecutionTask` nie pozwala ustawić `status`, `createdAt` ani
  `completedAt` (`Omit` w `executionWork.ts:126-129`, nadpisania `:161-163`);
  `createdAt` będzie zawsze `new Date().toISOString()` (`:162`). **Historyczne
  `tasks.created_at` jest w tej komendzie bezpowrotnie tracone** — plan `A3`
  mówi o tym ogólnie, Ty masz to potwierdzić i wpisać do rejestru jako świadomą
  utratę, nie odkryć w etapie 2.
- **T9.** Istnieje dodatkowa bramka, której `A4.0` nie wymienia:
  `assertArchivedInitiativeIsReadOnly` (`materialCommand.ts:497`, implementacja
  `:408-455`) blokuje KAŻDĄ komendę dotykającą zarchiwizowanej inicjatywy.
- **T10.** W repo nie istnieje ani tabela, ani migracja, ani wzmianka o
  `legacy_task_cutover_ledger` (poza planem). **Żaden skrypt w `server/scripts/`
  ani `scripts/` nie importuje `executeMaterialCommand` ani `createExecutionTask`** —
  Twój runner będzie pierwszym skryptem tego gatunku w tym repozytorium.

# 3. POZYCJE DYŻURU

## R1 — POMIAR DENOMINATORA wg A4.0 → KARTA DECYZYJNA DLA WŁAŚCICIELA (rdzeń)

★★ **To jest pierwszy artefakt dyżuru i powstaje PRZED jakimkolwiek zapisem
kanonicznym.** Kolejność commitów ma to udowodnić: commit z pomiarem i kartą
decyzyjną jest wcześniejszy niż commit z migracją ledgera. Odwrotna kolejność
jest podstawą odrzucenia pozycji.

### Zapytania — dokładnie z `A4.0` planu, bez przeredagowania

```sql
-- aktywne sprawy kanoniczne (execution_case, stan ACTIVE)
SELECT count(*) AS active_execution_cases
FROM ie_aggregate_state
WHERE aggregate_type = 'execution_case'
  AND payload_json->>'state' = 'ACTIVE';

-- inicjatywy legacy z co najmniej jednym zadaniem
SELECT count(DISTINCT initiative_id) AS legacy_initiatives_with_tasks
FROM tasks
WHERE initiative_id IS NOT NULL;
```

Wykonalność zweryfikowana na DDL: `ie_aggregate_state` ma `aggregate_type`
(`932_initiatives_execution_material_commands.sql:35`) i `payload_json JSONB`
(`:38`); `tasks.initiative_id` istnieje (`000_initdb_core_tables.sql:224`).
**Sprawdź to sam** i wpisz wynik do raportu.

### ★★ TRZY POMIARY, NIE JEDEN — i jawne przyznanie, czego nie da się zmierzyć

**M1 — baza odniesienia (`A7` planu).** Świeża baza po pełnych migracjach +
`scripts/dev/case-workspace-seed-local.mjs`. Oczekiwany wynik autora:
`active_execution_cases = 0`, `legacy_initiatives_with_tasks = 0`. Ten pomiar
dowodzi, że **sam seed nie tworzy ani jednego domu kanonicznego** i że zapytania
działają. Zero to tu WYNIK, nie porażka.

**M2 — kształt luki na danych o produktowym kształcie.** Ta sama świeża baza
(druga, jednorazowa) + `npm run db:seed:demo:contract`
(`server/scripts/seed-demo-dataset-contract.ts`, wstawia zadania z `initiative_id`
na `:290-301`). Oczekiwany wynik autora: `active_execution_cases = 0`,
`legacy_initiatives_with_tasks > 0`. Ten pomiar pokazuje **kształt** luki:
zadania z inicjatywą istnieją, domów kanonicznych nie ma ani jednego. Do raportu
wchodzi też rozbicie pomocnicze, wzorem `A3`:

```sql
SELECT
  count(*)                                                   AS total,
  count(*) FILTER (WHERE initiative_id IS NULL)              AS personal_bez_inicjatywy,
  count(*) FILTER (WHERE assignee_id IS NULL)                AS bez_assignee,
  count(*) FILTER (WHERE owner_id IS NULL)                   AS bez_ownera,
  count(*) FILTER (WHERE due_date IS NULL)                   AS bez_due,
  count(*) FILTER (WHERE sla_due_at IS NULL)                 AS bez_sla
FROM tasks;
```

**M3 — ★★ REALNEGO DENOMINATORA NIE DA SIĘ ZMIERZYĆ W TYM DYŻURZE. Napisz to
wprost, zamiast podać liczbę, która wygląda jak odpowiedź.** Liczba, o którą pyta
właściciel, dotyczy danych na `demo`/produkcji, a `Z28` zabrania jakiegokolwiek
połączenia w tamtą stronę — to jest jedyny zakaz, którego naruszenie zatrzymuje
CAŁY dyżur. Twoim produktem dla M3 jest zatem **paczka do wykonania cudzą ręką**:

- plik `/private/tmp/cx-day197-migracja-e1-artefakty/day197-denominator.sql` — komplet zapytań **wyłącznie
  odczytujących**, gotowych do wklejenia, z komentarzem przy każdym, co liczy;
- w raporcie jedno zdanie: **kto** ma to uruchomić (nadzorca albo właściciel),
  **na czym** (baza demo/staging), i **jaką procedurą** (skill `consultify-promocja-demo`);
- **zero ekstrapolacji z M1/M2 na produkcję.** Zdanie „na demo pewnie jest podobnie"
  jest w tym programie kształtem fałszywego „gotowe".

### KARTA DECYZYJNA — obowiązkowa sekcja raportu

Osobna sekcja `## KARTA DECYZYJNA D-7 / ETAP 1 — DLA WŁAŚCICIELA`, napisana
**po polsku, bez żargonu, tak żeby dała się przeczytać bez otwierania kodu**.
Ma zawierać dokładnie te elementy i ani jednego więcej:

1. **Trzy liczby** (M1, M2) z mianownikiem i komendą, którą je odtworzyć.
2. **Jedno zdanie o M3** — czego NIE zmierzono i dlaczego (`Z28`), plus ścieżka
   pliku z zapytaniami do uruchomienia cudzą ręką.
3. **Koszt zbudowania JEDNEGO domu kanonicznego**, zmierzony przez Ciebie w R2:
   ile poleceń, ile transakcji, ile wierszy w ilu tabelach, ile trwało.
4. **Trzy warianty skali** dla etapu 2, każdy z kosztem rzędu wielkości —
   wzorem tabeli wariantów `A5` planu (kolumny: wariant · koszt · skutek ·
   rekomendacja). Nie musisz wymyślać nowych: naturalne to (i) zbudować domy dla
   wszystkich inicjatyw z zadaniami, (ii) tylko dla podzbioru spełniającego
   „zakres MVP" z `A3`, (iii) odłożyć etap 2 do czasu pomiaru na demo.
5. **Twoja rekomendacja** — jedna, wybrana, z uzasadnieniem liczbą, nie opinią.
6. **Co się stanie, jeśli właściciel nie zdecyduje** — jedno zdanie.

★ **STOP-CHECKPOINT — brzmienie dosłowne.** Ta karta jest przeznaczona dla
właściciela i **etap 2 nie ma prawa ruszyć bez jego akceptu**. Ale to **nie jest**
powód do zatrzymania tego dyżuru: `§0.5` wymienia wyczerpująco pięć sytuacji,
w których wolno zatrzymać całość, i nie ma wśród nich „czekam na decyzję".
Zamiast tego: **piszesz kartę, commitujesz ją, i DOPIERO POTEM idziesz do R2** —
bo R2 to jeden pilot na domu, który sam budujesz, i to on dostarcza liczbę do
punktu 3 karty. Jeżeli natomiast Twój pomiar wykaże, że nawet zbudowanie
JEDNEGO domu jest niewykonalne (np. łańcuch `A4.0` rzuca na warunku, którego nie
da się spełnić lokalnie), to jest **STOP MERYTORYCZNY pozycji R2** w formacie
z `§0.5` — wpisujesz go, dowozisz czerwony kontrakt zamiast zmiany, i kończysz
dyżur R1+R3.

**Ukończone, gdy:** trzy pomiary opisane (dwa wykonane, jeden jawnie niewykonalny
z podaną przyczyną i paczką zapytań), karta decyzyjna kompletna w sześciu punktach,
commit z kartą wcześniejszy niż commit z migracją.

## R2 — REJESTR CUTOVER + PRZENIESIENIE JEDNEGO PILOTAŻOWEGO ZADANIA (rdzeń)

### R2a — migracja addytywna `legacy_task_cutover_ledger`

**Nazwa pliku jest zarezerwowana dla tego dyżuru i wygląda tak:**

```
server/migrations/20261721_legacy_task_cutover_ledger.sql
```

Uzasadnienie nazwy — zmierzone, do obalenia przez Ciebie:
- maksymalny dzisiejszy klucz fazy `DATED` to `20261720_day131_teresa_knowledge_boundaries.sql`,
  więc `20261721_` biegnie **jako ostatnia** migracja tej fazy;
- pasuje do `VALID_DATE_GENERIC` (`validate-migration-naming.ts:36`) i do
  `DATED_RE` (`migrationOrdering.ts:26`);
- **sufiks literowy po dacie (`20261721a_…`) jest ZAKAZANY** — złamie oba regexy
  i skończy się `UnclassifiedMigrationFilenameError` (`migrationOrdering.ts:345`),
  chyba że dopiszesz plik do manifestu, czego robić nie wolno.
- **Przedział `20261721`–`20261729` jest zarezerwowany dla tego dyżuru** (wzorem
  `DEC-2026-08-26-98` pkt 4, rezerwacja numerów zapobiegająca kolizji dyżurów
  równoległych). Nie bierzesz numeru spoza przedziału, nawet gdyby był wolny.

**Kształt tabeli — z planu `A4`, sekcja „Rozliczenie", bez odejmowania kolumn:**
`organization_id`, `legacy_task_id`, `batch_id`, `status`, `reason_code`,
`client_request_id`, `canonical_id`, `case_version_before`, `case_version_after`,
znaczniki czasu, `checksum`; **unikalność po `(organization_id, legacy_task_id)`**.
Dobór typów i dokładnych nazw kolumn rozstrzygasz Ty — i uzasadniasz w raporcie,
patrząc na sąsiadów tej samej klasy: `server/migrations/20260906_partner_legacy_cutover.sql`
i `20260907_finance_legacy_cutover.sql`.

**Zasady twarde migracji:**
- **czyste `CREATE TABLE IF NOT EXISTS` + indeksy.** Zero `ALTER` na cudzych
  tabelach, zero odczytu jakiejkolwiek kolumny, zero `FOREIGN KEY` do `tasks`
  ani do `ie_aggregate_state`. Powód: migracja, która CZYTA kolumnę dodawaną
  później w kolejności sortowania, wywraca cały łańcuch na bazie od zera —
  to udokumentowana klasa błędu w tym programie.
- **musi być idempotentna** — drugi przebieg `migrate.postgres.ts` ma dać
  `Applying migrations: 0`.

**Bramka `day161` — uruchamiasz ją i pokazujesz wynik.** Skrypt:
`scripts/dev/day161-fresh-migration-check.sh`, wpięty jako
`npm run test:migrations:day161:fresh` (`package.json:12`).

★★ **Kolizja zasobów, którą musisz rozegrać kolejnością, a nie drugim portem.**
Bramka **stawia własny kontener** i: odmawia adopcji istniejącego kontenera o tej
nazwie (`:22-25`), odmawia zajętego portu (`:26-29`), a po sobie sprząta
(`trap cleanup EXIT` → `docker rm -fv`, `:15-18`). Ty masz wg `Z7` **dokładnie
jeden** port bazy — `6128`. Nie bierzesz drugiego. Rozwiązanie: **usuwasz
swój kontener na czas bramki i odtwarzasz go po niej.**

```bash
# 1) zwolnij swój port — bramka nie zaadoptuje cudzego kontenera
docker rm -f -v cx-day197-pg 2>/dev/null || true

# 2) bramka na TWOIM porcie, z TWOJĄ nazwą kontenera i TWOIM katalogiem artefaktów
cd /private/tmp/cx-day197-migracja-e1 && \
DAY161_CONTAINER_NAME=cx-day197-pg-day161gate \
DAY161_PG_PORT=6128 \
DAY161_DATABASE_NAME=cx197gate \
DAY161_ARTIFACT_DIR=/private/tmp/cx-day197-migracja-e1-artefakty \
  npm run test:migrations:day161:fresh 2>&1 | tee /private/tmp/cx-day197-migracja-e1-artefakty/day197-day161-gate.txt
#   oczekiwane w OSTATNIEJ linii wyjścia: DAY161_FRESH_MIGRATION_GATE=PASS
#   oczekiwane w /private/tmp/cx-day197-migracja-e1-artefakty/day161-fresh-migration-gate.log: 'Applying migrations: N' (N>0)
#     oraz '✅ Postgres migrations complete'
#   oczekiwane w /private/tmp/cx-day197-migracja-e1-artefakty/day161-fresh-migration-gate-replay.log:
#     'Applying migrations: 0' oraz '✅ Postgres migrations complete'

# 3) odtwórz swój kontener i pełne migracje (§0.2c wariant A), zanim wrócisz do R2b
```

★ **Napis `DAY161_FRESH_MIGRATION_GATE=PASS` NIE POJAWI SIĘ W ŻADNYM Z DWÓCH
LOGÓW.** Skrypt wypisuje go na stdout w ostatniej linii (`:55`), już po ostatnim
`tee`. Odbiór 184 słusznie usunął to twierdzenie jako niepodparte. **Łap PASS
z wyjścia procesu** (`| tee /private/tmp/cx-day197-migracja-e1-artefakty/day197-day161-gate.txt`), nie z pliku
logu — i napisz w raporcie, skąd go wziąłeś.

### R2b — przeniesienie JEDNEGO zadania pełnym łańcuchem

**Piszesz jednorazowy runner aplikacyjny**, nie migrację SQL. Plan `A4` mówi
wprost: *„Runner SQL nie moze wywolac domenowego command handlera."*

**Wzorzec, który kopiujesz co do kształtu (nie co do treści):**
`server/scripts/reassign-finance-org-to-primary.ts` — ma komplet elementów, których
plan wymaga: `parseArgs` (`:23-37`), **domyślnie OFF** (`const dryRun = args.write !== 'true'`,
`:129`), raport na dysk przed jakimkolwiek zapisem (`:44-49`, `:165-169`), wyjście
po dry-run przed confirmem (`:183-187`), **jawny confirm**
(`requireConfirmation(...)`, `:189-193`), zapis w `BEGIN`/`COMMIT`/`ROLLBACK`
(`:195-213`). Helper confirmu do reużycia:
`server/scripts/lib/scriptDatabaseTarget.ts:104-113` (`requireConfirmation`),
plus `resolveScriptDatabaseTarget` i `logSelectedDatabaseTarget` (`:93-102`).

★ **Twój runner będzie PIERWSZYM skryptem w tym repozytorium, który woła domenowy
command handler** (`grep -rln 'executeMaterialCommand\|createExecutionTask'` po
`server/scripts/` i `scripts/` → zero trafień). Nie ma precedensu — napisz
w raporcie, jak rozwiązałeś podniesienie `unitOfWork` poza kontekstem HTTP.

**Łańcuch, który runner ma przejść — pięć poleceń `A4.0`, każde przez
`executeMaterialCommand`:**

1. `initiative.register` (`registerInitiative.ts:80-89`; wymaga `createIfMissing`
   i `expectedVersion === 0`, `:87-89`; komplet pól wymaganych `:69-75`);
2. `initiative.schedule.request` (`scheduleDecision.ts:182-198`; wymaga
   inicjatywy w `APPROVED_BACKLOG` `:207-208`, niezależnego autorytetu `:191-198`);
3. `initiative.schedule.decide` z outcome `APPROVED` (`:262-278`, `:354`) —
   tworzy `handoff_package` `:372-379`, inicjatywa → `SCHEDULED` `:410`;
4. `initiative.handoff.request` (`handoffAcceptance.ts:64-83`) — ★ **to TY podajesz
   `executionCaseId`** (`:70`, `:113-117`, `:123`);
5. `initiative.handoff.decide` z outcome `ACCEPT` (`:155-171`) — wymaga
   inicjatywy `SCHEDULED` (`:198-199`), `decision.version === 1`, `status === 'PENDING'`
   i **`stored.payload.authorityId === envelope.actorId`** (`:205-211`);
   tworzy `execution_case` v1 `state:'ACTIVE'` (`:245-252`).

Dopiero potem: `execution.task.create` przez `createExecutionTask`
(`executionWork.ts:124-131`), z kopertą wg `A4` planu i **z `expectedCaseVersion`
równym wersji sprawy odczytanej w tej samej transakcji** (`:128`, `:150-157`).

★ **Aktor.** Plan `A4` wymaga „dedykowanego, istniejącego konta systemowego
migracji zatwierdzonego przez właściciela" i sam oznacza to jako **propozycję,
nie potwierdzony kontrakt**; odbiór 184 powtórzył: *„istnienie/autoryzacja konta
systemowego nie są potwierdzone"*. Takiego konta w seedach nie ma. **Dla pilota
używasz użytkownika `OWNER` z seeda, wpisujesz jego identyfikator do rejestru
i do raportu, i nazywasz go wprost `aktor pilotażowy, NIE systemowy`.**
„Konto systemowe migracji" wpisujesz do karty decyzyjnej (R1) jako **otwartą
decyzję właściciela wymaganą przed etapem 2** — nie zakładasz go sam (`Z12`).

**Dowody wymagane od R2b, wszystkie cztery:**

- **(D1) wiersz w rejestrze** — `SELECT` z `legacy_task_cutover_ledger` w raporcie,
  ze `status`, `client_request_id`, `canonical_id`, `case_version_before/after`.
- **(D2) agregat czytelny przez `postgresInitiativeReader`** — nie surowym `SELECT`-em,
  tylko przez `listExecutionTasks(organizationId, executionCaseId)`
  (`postgresInitiativeReader.ts:310`, SQL `:316`). ★ **Pułapka readbacku:** to
  zapytanie sortuje po `(payload_json->>'dueAt')::timestamptz`, a walidacja
  `createExecutionTask` przepuszcza `dueAt` przez `Date.parse` (`executionWork.ts:145`),
  które akceptuje formaty, jakich Postgres `::timestamptz` może nie przyjąć.
  Jeden zły `dueAt` **wysadza cały odczyt, nie jeden wiersz.** Zmierz to i opisz.
- **(D3) replay idempotentny** — powtarzasz DOKŁADNIE to samo polecenie z tym
  samym `clientRequestId` i pokazujesz status **`'REPLAYED'`**
  (`materialCommand.ts:487`) oraz **brak przyrostu** liczby wierszy w agregacie,
  audycie, outboksie i relacjach. ★ **Zmierz też przypadek graniczny z T5:** ten
  sam `clientRequestId` z innym `correlationId` (batch-id) — czy dostajesz
  `REPLAYED` czy konflikt. To rozstrzyga, czy `batch_id` w rejestrze jest
  bezpiecznym kluczem ponowienia, czy pułapką.
- **(D4) naprawa do przodu (`forward repair`), przetestowana** — plan `A6` odrzuca
  destrukcyjny rollback: *„Usuniecie samego agregatu zostawia audit/outbox/receipt/relation
  i blokuje ponowne wersje"*. Udowodnij to zamiast opisać: doprowadź do sytuacji
  częściowej awarii (np. konflikt wersji sprawy), pokaż wiersz `FAILED` z `reason_code`
  w rejestrze, wykonaj korektę **kolejnym poleceniem** i pokaż, że rejestr się
  domyka. ★ **Uwaga T7:** ponowienie z NOWYM `clientRequestId` uderzy w PK
  `ie_aggregate_relations` (`claimRelation` bez `ON CONFLICT`) — jeżeli to
  potwierdzisz, jest to **znalezisko do rejestru i do planu**, bo etap 2 na tym
  polegnie przy pierwszej partii.

**Ukończone, gdy:** migracja przechodzi pełny przebieg od pustej bazy i replay
`Applying migrations: 0`, bramka `day161` uruchomiona z wynikiem w artefaktach,
jedno zadanie przeniesione pełnym łańcuchem, cztery dowody D1-D4 w raporcie,
runner ma `dry-run` domyślnie i jawny confirm.

## R3 — ★★ ZAKAZ MASOWEGO PRZENOSZENIA W TYM DYŻURZE

**Wpisane wprost, żeby nie było wątpliwości:** w tym dyżurze przenosisz
**DOKŁADNIE JEDNO** zadanie — pilotażowe, na domu, który sam zbudowałeś, na swojej
lokalnej bazie. **Zakazane jest:**

- uruchomienie runnera w trybie zapisu na więcej niż jednym wierszu;
- pętla po `tasks`, choćby ograniczona `LIMIT`;
- budowanie domów kanonicznych dla więcej niż jednej inicjatywy;
- jakikolwiek zapis do bazy innej niż Twój jednorazowy kontener (`Z9`, `Z28`);
- zdjęcie albo osłabienie bramy `409` (`A5` planu: *„Nie zdejmowac"*; `Z12`, `Z19`);
- domykanie luki `POST /api/my-work/personal-tasks` (`A5` planu: trzy warianty to
  **analiza, nie decyzja** — żaden nie jest wykonany i żaden nie wchodzi tutaj).

**Etap 2 rusza dopiero po akcepcie właściciela na karcie decyzyjnej z R1.**
Jeżeli uznasz, że masz komplet informacji, żeby ruszyć dalej — **nie ruszaj**,
tylko dopisz do karty decyzyjnej sekcję „gotowość do etapu 2" z listą tego, co
jest gotowe. To jest cała Twoja praca w R3: jedno zdanie w raporcie, że zakaz
został dotrzymany, i wskazanie miejsca w kodzie runnera, które go egzekwuje
(np. twardy limit jednego wiersza w trybie `--write`).

# 4. TABELA LICENCJI PLIKOWYCH

| Zakres | Ścieżki |
|---|---|
| Zapis (NOWY PLIK) | `server/migrations/20261721_legacy_task_cutover_ledger.sql` — czyste `CREATE TABLE IF NOT EXISTS` + indeksy; **przedział `20261721`–`20261729` zarezerwowany dla tego dyżuru**; zakaz `ALTER` na cudzych tabelach i zakaz `FOREIGN KEY` |
| Zapis (NOWY PLIK) | jednorazowy runner przenosin w `server/scripts/` — nazwa w konwencji sąsiadów (np. `migrate-legacy-task-to-canonical.ts`); **dry-run domyślnie**, jawny `requireConfirmation`, twardy limit jednego wiersza |
| Zapis (NOWE PLIKI) | testy `day197.*` — lokalizację i config potwierdź wg sąsiadów (`tests/integration/**` vs `server/vitest.config.ts`); `Z18` i `Z31` obowiązują; **nowe pliki w `tests/` wymagają `git add -f`** |
| Zapis | `docs/program/funkcje/PLAN_MIGRACJI_TASKS_KANON.md` — WYŁĄCZNIE **dopisanie** nowego rozdziału `A8. Wykonanie — etap 1` z wynikami R1/R2 oraz korekta rozdziału `A4` w zdaniu o dacie migracji (patrz znalezisko (a) w sekcji 1). **Nie przepisujesz A1-A7**, nie zmieniasz werdyktu ani rekomendacji planu |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY197_MIGRACJA_E1_REPORT.md` |
| Odczyt (ZAKAZ ZAPISU) | `server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork.ts` — jedyny produkcyjny pisarz kanonu (`persistAggregate:278-304`, CAS SQL `:287`, insert `:295`, `claimRelation:364-382`, `appendAudit:341`, `appendOutbox:832`, `saveReceipt:852`) |
| Odczyt (ZAKAZ ZAPISU) | `server/src/domain/initiatives-execution/executionWork.ts` — `ExecutionTask` (`:23-48`), `caseAndRollup` (`:78-117`), `createExecutionTask` (`:124-131`), walidacja (`:139-148`), relacja (`:167-176`) |
| Odczyt (ZAKAZ ZAPISU) | `server/src/domain/initiatives-execution/handoffAcceptance.ts` — geneza `execution_case` (`:245-252`), warunki decyzji (`:198-211`), przydział `executionCaseId` (`:70`, `:113-117`, `:123`) |
| Odczyt | `server/src/domain/initiatives-execution/materialCommand.ts` — koperta (`:3-16`), walidacja (`:296-317`), fingerprint (`:329-345`), replay (`:474-494`), CAS (`:499-514`), cztery zapisy (`:518`, `:526`, `:539`, `:560`), bramka archiwum (`:408-455`) |
| Odczyt | `server/src/domain/initiatives-execution/registerInitiative.ts`, `scheduleDecision.ts` — polecenia 1-3 łańcucha `A4.0` |
| Odczyt | `server/src/domain/initiatives-execution/postgresInitiativeReader.ts` — `listExecutionTasks` (`:310`/`:316`), `findExecutionCase` (`:262`/`:268`), `listExecutionCases` (`:290`/`:297`) |
| Odczyt | `server/migrations/932_initiatives_execution_material_commands.sql` — kształt sześciu tabel `ie_*`, w szczególności PK/UNIQUE relacji (`:117-129`) i `request_fingerprint` (`:76`) |
| Odczyt | `server/scripts/migrationOrdering.ts` (`NUMBERED_RE:25`, `DATED_RE:26`, `phaseAndKeyFor:316-346`, `sortMigrationsDeterministically:359-361`), `server/scripts/migrate.postgres.ts`, `server/scripts/validate-migration-naming.ts` — porządek i nazewnictwo; **nie zmieniasz ani jednego z nich** |
| Odczyt | `scripts/dev/day161-fresh-migration-check.sh` — bramka świeżej bazy; uruchamiasz, **nie edytujesz** |
| Odczyt | `scripts/dev/case-workspace-seed-local.mjs` (M1) i `server/scripts/seed-demo-dataset-contract.ts` (M2) — seedy; uruchamiasz, **nie edytujesz** |
| Odczyt | `server/scripts/reassign-finance-org-to-primary.ts`, `server/scripts/lib/scriptDatabaseTarget.ts` (`requireConfirmation:104-113`), `server/scripts/backfill-initiative-project.ts` — wzorce runnera z dry-run i confirmem; **nie zmieniasz** |
| Odczyt | `server/migrations/20260906_partner_legacy_cutover.sql`, `20260907_finance_legacy_cutover.sql` — wzorce kształtu rejestru cutover; **nie zmieniasz** |
| Odczyt | `tests/integration/_helpers/assertRealPostgres.ts` (`:57-61` sygnatura, `:109-111` `expectedDatabase`) — `Z18`: **NIETYKALNY** |
| Odczyt | `docs/program/funkcje/PLAN_MIGRACJI_TASKS_KANON.md` (całość), `docs/program/funkcje/ODBIOR_184_ANALIZA_MIGRACJI.md`, `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY184_ANALIZA_MIGRACJI_REPORT.md`, `docs/program/funkcje/DECYZJE_WLASCICIELA_2026-08-30_WIECZOR.md` (D-7, `:28`) |

**Nietykalne imiennie:** brama `409` i jej montaże
(`server/src/routes/pmo/tasks.routes.ts:67`, `Gateway.ts:1389`, `Gateway.ts:1454`,
`server/src/routes/v8/index.ts:107`, `pmo/initiatives.routes.ts:160`,
`executionSpineLegacyReadOnly.middleware.ts`); wszystkie 24 mutujące trasy
`pmo/tasks.routes.ts`; `TaskController.ts` i cała warstwa legacy `tasks`;
`server/src/domain/initiatives-execution/**` (odczyt tak, zapis nie);
`tests/setup.ts`, `tests/helpers/**`, każdy `vitest*.config.ts`.

**Rozłączność z partią równoległą:** ten dyżur dotyka jednej NOWEJ migracji
w zarezerwowanym przedziale, jednego NOWEGO skryptu, nowych testów, jednego
rozdziału w planie i raportu. **Zero plików współdzielonych z dyżurami 198, 200,
202.** Przed pierwszym commitem sprawdź `git log` gałęzi bazowej — jeśli któryś
dyżur równoległy wziął numer z przedziału `20261721`–`20261729`, zgłoś kolizję
zasobową ZANIM zaczniesz pisać, nie po.

# 5. TWARDE ZASADY

- ★★ **ŻELAZNA KOLEJNOŚĆ `R1 → R2 → R3`.** Karta decyzyjna z R1 ma być
  zacommitowana PRZED migracją z R2. Kolejność commitów jest dowodem — odwrotna
  kolejność to podstawa odrzucenia pozycji, nawet jeśli treść jest dobra.
- ★★ **DOKŁADNIE JEDNO zadanie przeniesione.** Brak pętli, brak `LIMIT n>1`, brak
  drugiej inicjatywy. Runner ma egzekwować ten limit **kodem**, nie dobrą wolą.
- ★★ **BRAMA `409` ZOSTAJE.** Nie zdejmujesz, nie osłabiasz, nie dodajesz wyjątku,
  nie odmontowujesz żadnego middleware (`Z12`, `Z19`; `A5` planu).
- ★★ **`Z31` — ZAKAZ PINOWANIA STRAŻNIKA REALDB DO HOSTA, PORTU ALBO NAZWY BAZY.**
  `await assertRealPostgresTestEnvironment()` **BEZ ARGUMENTÓW**, w szczególności
  bez `expectedDatabase` (`assertRealPostgres.ts:109-111` — bez argumentu nazwa
  bazy NIE jest sprawdzana, i o to chodzi). Powód, dosłownie: dyżur 43 przypiął
  strażnika do swojej bazy — po usunięciu kontenera **30 przypadków dowodowych
  stało się trwałym `SKIP`**, a pakiet nadal raportował `exit 0`. W programie
  odnotowano **sześć** takich incydentów; dyżur 193 zamówiono wyłącznie po to,
  żeby je zbiorczo odpiąć. **Nie dokładaj siódmego.** Dotyczy to również testu
  `day160`, który plan `A7` wskazuje jako zepsuty tym samym wzorcem — **ale go
  w tym dyżurze NIE naprawiasz**, tylko odnotowujesz.
- ★★ **`Z27` — ZAKAZ `git stash` w każdej postaci.** Stan odkładasz przez `cp` do
  `/private/tmp/cx-day197-migracja-e1-scratch` i wracasz przez `cp`. Schowek jest współdzielony między wszystkimi
  worktree tego repozytorium.
- ★★ **Zero połączeń do bazy zdalnej, demo, stagingu i produkcji** (`Z28`) — to
  jedyny zakaz, którego naruszenie zatrzymuje CAŁY dyżur. Dotyczy też pomiaru M3:
  **paczkę zapytań zostawiasz, sam jej nie uruchamiasz.**
- ★★ **`Z15` obowiązuje w całości** — zero modelu językowego w tym dyżurze.
  Żaden pomiar, strażnik ani runner nie woła `llmService`, `/api/ai/**` ani
  żadnego dostawcy. Ten dyżur nie ma licencji na klucz.
- ★ **Migracja czysto addytywna.** Zero `ALTER` na cudzych tabelach, zero odczytu
  kolumn, zero `FOREIGN KEY`. Migracja czytająca kolumnę dodawaną później
  w kolejności sortowania wywraca łańcuch na bazie od zera — to udokumentowana
  klasa błędu w tym programie i dokładnie ten typ regresji, którego bramka `day161`
  szuka.
- ★ **„Walidator nazw przeszedł" znaczy: mój plik pasuje do regexa i liczba błędów
  NIE WZROSŁA.** Nie znaczy `exit 0` — walidator ma dziś 20 zastanych błędów.
  Podaj obie liczby (przed/po) z komendą.
- ★ **Sprzątanie kontenera: `docker rm -f -v`** — z flagą `-v`, inaczej wolumen
  zostaje na dysku i po kilku dyżurach kończy się miejsce. Dotyczy to również
  kontenera bramki `day161`, choć ona sprząta po sobie sama.
- ★ **`Z13`: logi, `.sql`, wyjścia bramki i raporty runnera NIE wchodzą do repo.**
  Leżą w `/private/tmp/cx-day197-migracja-e1-artefakty`, a raport podaje ścieżki i `shasum -a 256`.
- ★ **Hook `pre-commit` odpali `check-sqlsql.sh` na Twojej migracji** (klasa
  `*.sql.sql` jest zabroniona poza `never-ran/`) oraz **`verify:canonical-16`
  przy każdym commicie**. Naprawiasz kodem, nie omijasz — `--no-verify` jest
  zakazem, nie STOP-em.
- **Pułapka:** bez `RUN_DB_TESTS=1` testy backendowe idą na MOCK DB. Pułapka:
  `No test files found` **nie jest** `PASS` — sprawdź `numTotalTests > 0`.
  Pułapka: `npx vitest run` bywa kończy się `exit 0` mimo czerwonych testów —
  liczby i **nazwy** czytasz z JSON-a (`Z37`, `§0.4a`).
- ★ Port **5000 zajęty na stałe przez macOS Control Center**; port **5037** zajęty
  przez `adb` — nie używaj żadnego z nich.
- **Sekcja „TWIERDZENIA NIEZWERYFIKOWANE" w raporcie jest obowiązkowa.** Wypisz
  w niej wprost co najmniej: że realny denominator (M3) NIE został zmierzony i
  dlaczego; czy liczba tabel zapisywanych w jednej transakcji (T6) pochodzi
  z pomiaru czy z przepisania; czy sprawdziłeś przypadek `REPLAYED` przy zmienionym
  `correlationId` (T5), czy założyłeś; czy potwierdziłeś kolizję PK relacji przy
  ponowieniu z nowym `clientRequestId` (T7), czy tylko ją zacytowałeś; czy
  `dueAt` przeszedł przez `::timestamptz` w realnym odczycie (D2); że aktor
  pilotażowy NIE jest kontem systemowym i wymaga decyzji właściciela; oraz czy
  test `day160` nadal jest przypięty do bazy `cx160` (`Z31`), skoro go nie
  naprawiałeś. Brak takiej sekcji jest podstawą odrzucenia dyżuru.
