# INSTRUKCJA DYŻURU nr 204 — Codex — „Migracja legacy `tasks` -> kanon Runtime-v1, ETAP 2 (decyzja D-13): rozbrojenie DWOCH MIN z odbioru 197 (fingerprint bez correlationId; claimRelation bez ON CONFLICT) z dowodem mutacyjnym, runner `server/scripts/legacy-task-cutover-runner.ts` z limitem egzekwowanym KODEM (bez `--confirm-batch` DOKLADNIE jedna inicjatywa, sufit partii 10 wg D-13) i pelna proba LOKALNA na bazie o ksztalcie M3 — pilot na stagingu wykonuje NADZORCA po scaleniu, nie ten dyzur"

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
> **wyłącznie** `/private/tmp/cx-day204-migracja-e2`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `c7f13f588f`**
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
Zakres: **Magazyn zadan — granica legacy `tasks` vs kanon Runtime-v1 (`ie_aggregate_state` i rodzina material-command). Dyzur PRZEKROJOWY: dotyka Realizacji, Inicjatyw i Mojej Pracy przez WSPOLNY magazyn, ale nie zmienia zadnego ekranu ani trasy HTTP. Kontrakt: `docs/program/funkcje/PLAN_MIGRACJI_TASKS_KANON.md` (A3, A4.0, A4, A5, A6, A8) + `docs/program/funkcje/ODBIOR_197_MIGRACJA_E1.md` (sekcja `Miny etapu 2`) + `M3` z raportu 197**.
Trasy front: `BRAK ZMIAN FRONTU. Ten dyzur nie dotyka ani jednego pliku w `src/`. Kontekst do ewentualnego ODCZYTU, NIE zmieniasz: `src/components/InitiativeTasksTab.tsx` i `src/components/dashboard/UserTaskList.tsx` — plan (A5) wskazuje je jako ciche zaleznosci UI wobec bramy `409`, do osobnej pracy. ★ Jesli w trakcie dyzuru uznasz, ze potrzebujesz zmiany we froncie — to jest sygnal, ze wyszedles poza etap 2: STOP MERYTORYCZNY pozycji i wpis do raportu, nie zmiana pliku`. Trasy tył: `Ten dyzur NIE dodaje ani nie zmienia zadnej trasy HTTP. Pracujesz o pietro nizej — na warstwie domenowej, w skrypcie i na bazie. Lancuch, ktory ma przejsc Twoj runner (wszystko przez `executeMaterialCommand`, `server/src/domain/initiatives-execution/materialCommand.ts:457-572`), PODLOGA wg karty 197 po FIX-197: candidates (`submitSourceProposal.ts:83`, `source-proposal.submit`) -> `initiative.register` (`registerInitiative.ts:80-89`, konczy w REGISTERED_DRAFT `:134`) -> `initiative.definition.request` + `.decide` (`definitionDecision.ts:112`, `:195`; APPROVED -> DEFINED `:277-278`) -> `initiative.analysis.start` + `.request` + `.decide` (`analysisDecision.ts:55`, `:88`, `:168`; APPROVED -> READY_FOR_DECISION `:245-246`) -> `initiative.portfolio.request` + `.decide` (`portfolioDecision.ts:43`, `:136`; nadaje APPROVED_BACKLOG `:239-240`) -> 3x scenario.mutate (`portfolio.scenario.mutate` `portfolioScenario.ts:84`, `plan.scenario.mutate` `planScenario.ts:115`, `capacity.scenario.mutate` `capacityScenario.ts:108`; kazdy PUBLISHED i powiazany wersjami — walidacja `scheduleDecision.ts:99-152`) -> `initiative.schedule.request` + `.decide` (`scheduleDecision.ts:182`, `:262`; wymaga APPROVED_BACKLOG `:207-208`; przy zatwierdzeniu tworzy `handoff_package`) -> `initiative.handoff.request` + `.decide` (`handoffAcceptance.ts:64`, `:155`; ★ to TY podajesz `executionCaseId`, `:70`/`:113-117`/`:123`; TWORZY `execution_case` v1 `state:'ACTIVE'` `:245-252`) -> `execution.task.create` przez `createExecutionTask` (`executionWork.ts:124-131`, walidacja `:139-148`, `caseAndRollup` `:78-117`, relacja `EXECUTION_CASE_TASK` `:167-176`). ★★ TA LISTA JEST PODLOGA, NIE LICZBA: `definitionReadiness.ts:18-26` wymaga 8 OPUBLIKOWANYCH kart, `analysisReadiness.ts:3-14` wymaga 10 (16 roznych), a kazda karta to osobne polecenie `initiative.card.publish` (`publishInitiativeCard.ts:38-44`); PUBLISH scenariusza jest operacja na istniejacym DRAFT (`portfolioScenario.ts:99`). Zmierz REALNE N i wpisz do raportu. Kazde polecenie zapisuje w JEDNEJ transakcji: `persistAggregate` (`materialCommand.ts:518-525`), `appendAudit` (`:526-538`), `appendOutbox` (`:539-548`), `saveReceipt` (`:560`). Odczyt dowodowy: `postgresInitiativeReader.listExecutionTasks` (`:310`, SQL `:316`). ★ Brama `409` (`server/src/routes/pmo/tasks.routes.ts:67` i dalsze montaze) ZOSTAJE nietknieta`.

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
WT=/private/tmp/cx-day204-migracja-e2
MARKER=c7f13f588f

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/codex/m03-admin-20260824
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/codex/m03-admin-20260824 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day204-migracja-e2-20260831 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day204-migracja-e2/config.worktree"
cat "$VAULT/worktrees/cx-day204-migracja-e2/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day204-migracja-e2-scratch
mkdir -p /private/tmp/cx-day204-migracja-e2-artefakty

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
git -C "$VAULT" log --oneline c7f13f588f..github-backup/codex/m03-admin-20260824
git -C "$VAULT" diff --name-only c7f13f588f..github-backup/codex/m03-admin-20260824
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day204-migracja-e2-20260831
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only c7f13f588f..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `jedenascie` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd /private/tmp/cx-day204-migracja-e2

# (T1) MINA (a) — fingerprint BEZ correlationId ORAZ miejsce, w ktorym stary odcisk
#      jest porownywany z nowym (to jest cena zmiany fingerprinta)
sed -n '319,345p' server/src/domain/initiatives-execution/materialCommand.ts
sed -n '465,495p' server/src/domain/initiatives-execution/materialCommand.ts
#   oczekiwane: canonicalJson (ok. :319-327); fingerprint liczony z aggregateType,
#   aggregateId, commandType, expectedVersion, policyId, policyVersion, payload
#   (ok. :334-342) — BEZ actorId, organizationId, correlationId;
#   oraz porownanie `receipt.requestFingerprint !== requestFingerprint` -> throw
#   MaterialCommandConflictError (ok. :472-484), a `status: 'REPLAYED'` (ok. :487).
#   ★ To ostatnie jest sercem R1a: zmiana ciala funkcji unieważnia stare paragony.

# (T2) MINA (b) — claimRelation BEZ ON CONFLICT i dwa ograniczenia relacji
sed -n '364,382p' server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork.ts
sed -n '17,22p' server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork.ts
sed -n '117,130p' server/migrations/932_initiatives_execution_material_commands.sql
git grep -l "claimRelation" -- server/src/domain/initiatives-execution | wc -l
#   oczekiwane: INSERT INTO ie_aggregate_relations bez ON CONFLICT, zakonczony
#   requireSingleRow(result, 'relation claim'); requireSingleRow rzuca gdy rowCount!==1;
#   w migracji PRIMARY KEY (org, relation_type, source_type, source_id) i
#   UNIQUE (org, relation_type, target_type, target_id); liczba plikow wolajacych
#   claimRelation = promien wybuchu zmiany (wpisz SWOJA liczbe do raportu).

# (T3) KOLEJNOSC STRAZNIKOW — CAS agregatu wykonuje sie PRZED prepare()
sed -n '496,520p' server/src/domain/initiatives-execution/materialCommand.ts
sed -n '160,178p' server/src/domain/initiatives-execution/executionWork.ts
#   oczekiwane: sprawdzenie `!validCreate && currentVersion !== expectedVersion` ->
#   MaterialCommandConflictError (ok. :498-514) PRZED `const change = await prepare(...)`;
#   claimRelation w executionWork jest na samym koncu prepare (ok. :167-176).
#   ★ Jesli to sie potwierdzi, mina (b) moze byc NIEOSIAGALNA na tej sciezce — patrz R1b.

# (T4) KSZTALT LEDGERA Z 197 — czego on NIE przyjmie
cat server/migrations/20261721_legacy_task_cutover_ledger.sql
#   oczekiwane: CHECK (status IN ('PENDING','MIGRATED','SKIPPED','FAILED')) — czyli
#   BRAK 'SKIPPED_PERSONAL' i BRAK 'REPLAYED'; PRIMARY KEY (organization_id,
#   legacy_task_id) — czyli JEDEN wiersz na zadanie, zero miejsca na kroki governance;
#   UNIQUE (organization_id, client_request_id). ★ To wymusza rozstrzygniecie z R2c.

# (T5) KOSZT DOMU — ile KART musi byc opublikowanych, zeby bramki byly READY
sed -n '18,27p' server/src/domain/initiatives-execution/definitionReadiness.ts
sed -n '3,15p' server/src/domain/initiatives-execution/analysisReadiness.ts
grep -n "commandType !== 'initiative.card" server/src/domain/initiatives-execution/publishInitiativeCard.ts server/src/domain/initiatives-execution/reviewInitiativeCard.ts
#   oczekiwane: REQUIREMENTS z 8 kluczami kart (definicja), ANALYSIS_CARD_KEYS z 10
#   (analiza), czesc wspolna 'options' i 'stakeholders' -> 16 roznych kart; kazda
#   publikowana poleceniem 'initiative.card.publish'. ★ Karta 197 mowi ">=16 polecen"
#   i tych publikacji NIE liczy — zmierz sam, ile polecen naprawde przechodzi (R2b).

# (T6) TRZY DALSZE WARUNKI schedule.request, ktorych karta nie wymienia
sed -n '95,178p' server/src/domain/initiatives-execution/scheduleDecision.ts
sed -n '190,200p' server/src/domain/initiatives-execution/scheduleDecision.ts
sed -n '234,250p' server/src/domain/initiatives-execution/portfolioDecision.ts
#   oczekiwane: wymagane trzy PUBLISHED scenariusze powiazane wersjami (ok. :99-152),
#   okno planu przypiete do initiativeVersion (ok. :141-144), petla po commitmentIds
#   z wymogiem CONFIRMED/CONDITIONALLY_CONFIRMED (ok. :159-175), zakaz
#   authorityId === actorId bez selfApprovalAllowed (ok. :194-199); w portfolio
#   wymog czlonkostwa inicjatywy w opublikowanym scenariuszu (ok. :238-248).
#   ★ Sprawdz SAM, czy commitmentIds: [] i criticalPeriodIds: [] przechodza.

# (T7) LANCUCH LIFECYCLE — literalne stany, ktorych nie wolno obejsc
grep -n "lifecycleState" server/src/domain/initiatives-execution/registerInitiative.ts \
  server/src/domain/initiatives-execution/definitionDecision.ts \
  server/src/domain/initiatives-execution/analysisDecision.ts \
  server/src/domain/initiatives-execution/portfolioDecision.ts | grep -v "lifecycleState: string"
#   oczekiwane: REGISTERED_DRAFT -> DEFINED -> ANALYZING -> READY_FOR_DECISION ->
#   APPROVED_BACKLOG. Zaden UPDATE ani seed agregatu nie zastapi tych przejsc.

# (T8) BRAKI POL — co createExecutionTask wymaga TWARDO i jak wyglada legacy
sed -n '139,150p' server/src/domain/initiatives-execution/executionWork.ts
sed -n '158,166p' server/src/domain/initiatives-execution/executionWork.ts
grep -n "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sla_due_at" server/migrations/000_z_core_baseline.sql
sed -n '198,231p' server/migrations/000_initdb_core_tables.sql
#   oczekiwane: rzut 'Task ownership and SLA are required' gdy brak ownerId albo
#   nieparsowalny slaAt; createdAt nadpisywany przez new Date() (ok. :161-163) —
#   historia legacy tracona; sla_due_at w legacy jest typu TEXT; tasks ma FK do
#   organizations/projects/users (ok. :226-230) — seed musi je stworzyc.
#   ★ Zestaw to z M3: bez_sla = 467/467. Patrz znalezisko (f) w sekcji 1.

# (T9) D-13 — dokladne brzmienie decyzji wlasciciela (pilot 1, partie po 10)
grep -n "D-12\|D-13" docs/program/funkcje/DECYZJE_WLASCICIELA_2026-08-30_WIECZOR.md
#   oczekiwane: D-12 (M3 read-only na stagingu, wykonane 31.08) i D-13 (pilot 1,
#   potem partie po 10; PILOT na stagingu wykonuje NADZORCA). ★ Sufit --batch-size = 10.

# (T10) BRAMKA day161 — wlasny kontener, wlasny port, PASS tylko na stdout
sed -n '1,60p' scripts/dev/day161-fresh-migration-check.sh
grep -n "test:migrations:day161:fresh" package.json
#   oczekiwane: DAY161_CONTAINER_NAME/DAY161_PG_PORT/DAY161_DATABASE_NAME/
#   DAY161_ARTIFACT_DIR jako zmienne (ok. :5-9), odmowa adopcji kontenera (ok. :22-25),
#   odmowa zajetego portu (ok. :26-29), trap cleanup docker rm -fv (ok. :14-18),
#   echo DAY161_FRESH_MIGRATION_GATE=PASS PO ostatnim tee (ok. :55).
#   Sekwencja obejscia kolizji portu (uzyj TYLKO jesli bierzesz migracje 20261722):
#     docker rm -f -v cx-day204-pg 2>/dev/null || true
#     DAY161_CONTAINER_NAME=cx-day204-pg-day161gate DAY161_PG_PORT=6144 \
#     DAY161_DATABASE_NAME=cx204gate DAY161_ARTIFACT_DIR=/private/tmp/cx-day204-migracja-e2-artefakty \
#       npm run test:migrations:day161:fresh 2>&1 | tee /private/tmp/cx-day204-migracja-e2-artefakty/day204-day161-gate.txt
#     # potem odtworz swoj kontener i pelne migracje (§0.2c wariant A)

# (T11) MIGRACJE — czy przedzial 20261722-20261729 jest WOLNY i ile dlugu ma walidator
ls server/migrations | grep -E '^[0-9]{8}_.*\.sql$' | sort | tail -5
ls server/migrations | grep -E '^2026172[2-9]_' || echo "PRZEDZIAL 20261722-20261729 WOLNY"
grep -n "VALID_DATE_GENERIC\|process.exit" server/scripts/validate-migration-naming.ts | head -5
npx tsx server/scripts/validate-migration-naming.ts 2>&1 | tail -5
#   oczekiwane: maksymalny klucz DATED to 20261721_legacy_task_cutover_ledger.sql
#   (prefiksy sa PSEUDO-datami, nie kalendarzem); przedzial 20261722-20261729 wolny;
#   walidator konczy sie NIEZEROWYM kodem juz dzis — ZAPISZ liczbe bledow PRZED swoja
#   zmiana, zeby moc pokazac, ze NIE WZROSLA. ★ Raport 197 podaje 92 — NIE przepisuj
#   tej liczby, zmierz swoja.
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
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day204-migracja-e2-20260831` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6144`. Twój JEDYNY port harnessu to `5078 i 5079`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day204-pg`**. **ZAKAZANE:** `6012, 5433, 6047, 6054-6143, 5010-5077, 6404-6411 (zajete przez wczesniejsze dyzury i odbiory nadzorcy). Twoj wylaczny przydzial to baza `6144` i harness `5078 i 5079` — nic wiecej. ★ PORT 5000 ZAJETY NA STALE przez macOS Control Center. ★ PORT 5037 ZAJETY przez `adb` (serwer Androida). ★ PORTY 5060-5061 ZAJETE. ★★ Bramka `day161` stawia WLASNY kontener i WLASNY port (domyslnie `cx-day161-pg` na `6049`) — nie bierzesz dla niej drugiego portu, tylko usuwasz swoj kontener na czas jej przebiegu i odtwarzasz po nim (dokladna sekwencja w bloku (T10) komend weryfikacji wejscia). Bramke uruchamiasz TYLKO jesli bierzesz migracje `20261722_`. ★ Ta lista jest rozkazem pomiarowym, nie gwarancja — zweryfikuj `lsof -i` i `docker ps` przed startem i wpisz wynik `X z 3` do raportu`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `brak nowej flagi i brak potrzeby jej wprowadzenia — ten dyzur nie ma powierzchni wizualnej (`CLAUDE.md` §7 dotyczy ekranow, a Ty nie dotykasz `src/`). ★★ ROLE FLAGI PELNI TU CO INNEGO I MA BYC ROWNIE TWARDE — TRZY BEZPIECZNIKI RUNNERA, KAZDY EGZEKWOWANY KODEM I KAZDY Z WLASNYM TESTEM: (1) **dry-run jako zachowanie domyslne** — bez `--write` runner nie wykonuje ani jednego polecenia materialnego i nie pisze do ledgera; (2) **jawne potwierdzenie srodowiskowe** przez `requireConfirmation` (wzorzec `server/scripts/lib/scriptDatabaseTarget.ts:104-113`) — `--write` bez zmiennej potwierdzajacej konczy sie wyjatkiem i kodem niezerowym; (3) **twardy limit: bez `--confirm-batch` DOKLADNIE JEDNA inicjatywa, niezaleznie od `--batch-size`**, a `--batch-size` ma sufit 10 (D-13: `pilot 1, potem partie po 10`) — wartosc > 10 to blad wejscia. Runner, ktory pisze bez (1)+(2) naraz albo przekracza (3), jest odrzuceniem pozycji — niezaleznie od jakosci reszty; limit ma miec dowod mutacyjny (usuniecie limitu -> test czerwony). ★ Nie zmieniasz wartosci domyslnej ZADNEJ istniejacej flagi (`Z10`), w szczegolnosci niczego, co dotyka bramy `409``, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/**` (w szczegolnosci `executionSpineLegacyReadOnly.middleware.ts` i kazdy `requireCanonicalExecutionWriter` / `requireCanonicalInitiativeExecutionWriter`), `server/src/routes/pmo/tasks.routes.ts` (montaz bramy na `:67` i wszystkie mutujace trasy), `server/src/routes/my-work.routes.ts` (`POST /personal-tasks` `:1283`, `INSERT INTO tasks` `:1379` — luki NIE domykasz, to analiza A5), `server/src/Gateway.ts`, `server/src/routes/v8/index.ts`, `server/src/services/aiRoleGuard.ts`, `server/src/services/chatPermissionService.ts`, `server/src/routes/auth*.ts`, wszystko pod `server/src/services/betaAccess*`, scheduler i `aiWorker`, oraz caly `server/src/domain/initiatives-execution/**` (odczyt TAK, zapis NIE — z DWOMA waskimi, WARUNKOWYMI wyjatkami opisanymi w tabeli licencji: `materialCommandFingerprint` i `claimRelation`)`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY204_MIGRACJA_E2_REPORT.md`. Nie zmieniasz zadnego `MODULE_ACCEPTANCE.md` — ten dyzur jest przekrojowy (magazyn zadan obsluguje Realizacje, Inicjatywy i Moja Prace naraz, a zaden z tych trzech dokumentow nie ma dzis wiersza o migracji legacy->kanon; dopisanie go byloby tworzeniem nowego stanu w rejestrze, ktorego nikt nie zamowil). Jedyny inny dokument do zmiany: `docs/program/funkcje/PLAN_MIGRACJI_TASKS_KANON.md` — DOPISUJESZ nowy rozdzial `A9. Wykonanie — etap 2 (Day204)` (wyniki R1/R2/R3, zmierzone N polecen lancucha, rozstrzygniecie rejestru krokow, arytmetyka brakow pol wobec M3, otwarte decyzje wlasciciela) i KORYGUJESZ rozdzial `A4.0` w miejscu, gdzie mowi o `pieciu komendach` — na zmierzona liczbe. Nie przepisujesz A1-A8, nie zmieniasz werdyktu planu ani jego rekomendacji. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day204-migracja-e2-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day204-migracja-e2-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★ **ZELAZNA KOLEJNOSC R1 -> R2 -> R3, udowodniona KOLEJNOSCIA COMMITOW.** Miny maja byc zmierzone i rozbrojone (albo uczciwie uznane za nieosiagalne) PRZED napisaniem runnera. Runner napisany przed pomiarem min jest podstawa odrzucenia pozycji, nawet gdyby dzialal. ★★ **ZERO POLACZEN ZDALNYCH (`Z28`)** — do bazy demo, stagingu, produkcji, w kazda strone i kazdym narzedziem. **PILOT NA STAGINGU WYKONUJE NADZORCA PO SCALENIU, NIE TY** (D-13). Liczby z M3 cytujesz jako CUDZY pomiar z 31.08, nigdy jako swoj; zdanie `na stagingu pewnie zachowa sie tak samo` jest ekstrapolacja i jest zakazane. ★★ **BRAMA `409` ZOSTAJE** — nie zdejmujesz, nie oslabiasz, nie dodajesz wyjatku, nie odmontowujesz zadnego routera ani middleware (`Z12`, `Z19`; plan A5 mowi wprost `Nie zdejmowac`). Nie domykasz tez luki `POST /api/my-work/personal-tasks` — trzy warianty z A5 to ANALIZA, nie decyzja. ★★ **SCHEDULER I `aiWorker` NIETYKALNE** — runner nie planuje sie sam, nie wpina sie w kolejke, nie zostawia zadania okresowego. ★★ **KSZTALT LEDGERA Z 197 NIETYKALNY** — nie zmieniasz `server/migrations/20261721_legacy_task_cutover_ledger.sql`, nie robisz na nim `ALTER`, nie poszerzasz jego `CHECK`. Jesli brakuje miejsca na kroki governance — NOWA tabela, nie przerobka starej. ★★ **ZERO NOWYCH MIGRACJI SQL** — z JEDNYM wyjatkiem: jesli R1a wybierze wariant B (klucz ponowienia w ledgerze) albo R2c droge (i) (druga tabela na kroki), wolno Ci wziac DOKLADNIE JEDNA migracje z zarezerwowanego przedzialu `20261722`-`20261729`. Wtedy obowiazkowo: **czysto addytywna** (`CREATE TABLE IF NOT EXISTS` + indeksy, zero `ALTER` na cudzych tabelach, zero odczytu cudzej kolumny, zero `FOREIGN KEY`), **pelny przebieg od pustej bazy** i **bramka `day161`**. Sufiks literowy po dacie (`20261722a_...`) jest ZAKAZANY — lamie `DATED_RE` (`migrationOrdering.ts:26`) i konczy sie `UnclassifiedMigrationFilenameError`. Zaden inny powod nie uprawnia Cie do nowej migracji. ★★ **ZAKAZ SUROWEGO SQL DO KANONU** — zero `INSERT`/`UPDATE`/`DELETE` na `ie_aggregate_state`, `ie_command_receipts`, `ie_audit_events`, `ie_outbox_events`, `ie_aggregate_relations`. To omija CAS, audyt, outbox, paragon i claim relacji; plan A4 odrzuca to wprost. Zakaz dotyczy rowniez seedow i testow poza jawnym sprzataniem po wlasnej organizacji testowej. ★★ **ZAKAZ OBCHODZENIA LIFECYCLE** — zadnego surowego `UPDATE` na `payload_json->>'lifecycleState'` ani seedowania agregatu w docelowym stanie, zeby skrocic lancuch. Jesli lancuch nie przechodzi — to jest wynik do raportu, nie problem do obejscia. ★★ **ZAKAZ SYNTETYCZNEGO `legacy_task_id`** w `legacy_task_cutover_ledger` (np. `governance:<initiativeId>:<krok>`) — rozwala arytmetyke kontrolna planu A4 (`total = MIGRATED + SKIPPED + FAILED`, `unmatched = 0`), bo wiersze governance policzyly by sie jako przeniesione zadania. ★★ **ZAKAZ WYBIERANIA POLITYKI BRAKOW POL ZA WLASCICIELA** — domyslna polityka to SCISLE A3 (brak wymaganego pola = `SKIPPED` z `reason_code`, zero zgadywania). Fallbacki (`--owner-fallback`, `--sla-offset-days`) implementujesz jako flagi domyslnie WYLACZONE i podajesz w raporcie arytmetyke wobec M3 dla kazdej z nich osobno. ★★ **`Z31` — ZAKAZ PINOWANIA STRAZNIKA REALDB DO HOSTA, PORTU ALBO NAZWY BAZY.** Wolasz `await assertRealPostgresTestEnvironment()` BEZ ARGUMENTOW, w szczegolnosci bez `expectedDatabase`; zakaz asercji na `DATABASE_URL`, na porcie i na nazwie kontenera. Powod: dyzur 43 przypial straznika do swojej bazy i po usunieciu kontenera 30 przypadkow dowodowych stalo sie trwalym `SKIP` przy `exit 0`; w programie odnotowano SZESC takich incydentow, a dyzur 193 zamowiono wylacznie po to, zeby je zbiorczo odpiac. Nie dokladaj siodmego. Test `day160` jest zepsuty dokladnie tym wzorcem (plan A7) — ODNOTOWUJESZ to, ale go w tym dyzurze NIE naprawiasz. ★★ **`Z29` — DOWOD MUTACYJNY W OBIE STRONY.** `Test zielony` nie jest dowodem naprawy. Dowodem jest: czerwony przed -> zielony po -> CZERWONY PONOWNIE po odwroceniu naprawy. Dotyczy R1a, R1b, limitera runnera i naprawy do przodu. ★★ **`Z15` obowiazuje w calosci — zero modelu jezykowego.** Ten dyzur nie ma licencji na zaden klucz dostawcy; zaden pomiar, seed, runner ani test nie wola `llmService`, `/api/ai/**` ani `GoogleGenerativeAI`. ★★ **`Z27` — ZAKAZ `git stash`** w kazdej postaci (`stash`, `stash -u`, `stash pop`, `stash apply`). Dowody mutacyjne robisz przez `cp` do `/private/tmp/cx-day204-migracja-e2-scratch` i powrot przez `cp`; schowek jest wspoldzielony miedzy wszystkimi worktree tego repozytorium. ★★ **Sprzatanie kontenera: `docker rm -f -v`** — z flaga `-v`, inaczej wolumen zostaje na dysku. Dotyczy tez kontenera bramki `day161`. ★★ **Zakaz naprawiania przez wyciszanie** (`@ts-ignore`, `.skip`, poszerzanie `exclude`, `--no-verify`) i zakaz usuwania zastanych testow — asercje wolno ZMIENIC z uzasadnieniem, nie skasowac; w szczegolnosci NIE kasujesz `tests/integration/day197-legacy-task-cutover.realdb.test.ts`. ★ **Zrzuty:** ten dyzur ich nie ma (zero powierzchni wizualnej). Jesli jakikolwiek zrzut mimo to powstanie — obowiazuje przy nim pomiar `mean_luma`, bez wyjatku. ★ **`Z13`:** logi, `.sql` pomiarowe, wyjscia bramki, dzienniki przebiegu runnera NIE wchodza do repo — leza w `/private/tmp/cx-day204-migracja-e2-artefakty`, a raport podaje sciezki i `shasum -a 256`. ★ **`§0.4a` — pomiar zasiegu testow jest warunkiem oddania raportu** (`Z24`); zawezony wybor albo przepisanie cudzej liczby to zawyzenie i podstawa odrzucenia | Wlasciciel podjal decyzje D-13 (`docs/program/funkcje/DECYZJE_WLASCICIELA_2026-08-30_WIECZOR.md:39`): migracja E2 rusza — pilot 1, potem partie po 10; dyzur 204 dostarcza miny + runner + probe lokalna, a PILOT NA STAGINGU WYKONUJE NADZORCA po scaleniu (procedura promocji). Podstawa D-13 jest karta decyzyjna z dyzuru 197 po FIX-197 (`cac843372b`) oraz pomiar M3 wykonany przez nadzorce na stagingu za zgoda D-12 (`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY197_MIGRACJA_E1_REPORT.md`, sekcja `★ M3 — WYNIK REALNY`): `active_execution_cases=14`, `legacy_initiatives_with_tasks=67`, `tasks total=467` (osobistych 265, bez ownera 411, bez due 195, bez sla 467). Odbior 197 (`ODBIOR_197_MIGRACJA_E1.md`) zamknal etap 1 werdyktem: kod scalony, ledger 9/10, pilotaz STOP zasadny (lancuch A4.0 nieprzechodni), i zostawil ETAPOWI 2 DWIE MINY, ktore ten dyzur ma rozbroic. ★★ PIEC ZNALEZISK POMIAROWYCH, ktore ta instrukcja dodaje do karty i planu i ktore masz OBALIC albo POTWIERDZIC: (a) zamowienie `dolaczyc correlationId do fingerprinta` jest NIEBEZPIECZNE — `materialCommand.ts:473-484` porownuje zapisany `request_fingerprint` z policzonym i przy roznicy rzuca `MaterialCommandConflictError`, wiec zmiana ciala funkcji zamienia kazdy zastany paragon w twardy konflikt zamiast idempotentnego `REPLAYED`; dlatego wariant `osobne pole w ledgerze` jest w tej instrukcji rownorzedny, a wybor nastepuje PO pomiarze; (b) mina (b) moze byc NIEOSIAGALNA — CAS agregatu glownego (`materialCommand.ts:504-516`) wykonuje sie PRZED `prepare`, a wiec przed `claimRelation` (`executionWork.ts:167-176`); przy tym samym `taskId` konflikt wersji strzeli pierwszy; `nie znalazlem osiagalnej sciezki` jest tu pelnowartosciowym wykonaniem pozycji; (c) ksztalt ledgera z 197 NIE PRZYJMIE zamowienia `kazdy krok do ledgera`: `CHECK (status IN ('PENDING','MIGRATED','SKIPPED','FAILED'))` odrzuca `SKIPPED_PERSONAL` i nie zna `REPLAYED`, a `PRIMARY KEY (organization_id, legacy_task_id)` miesci DOKLADNIE JEDEN wiersz na zadanie, zero miejsca na >=16 krokow governance — stad korekta: zadania osobiste to `status='SKIPPED'` + `reason_code='PERSONAL_NO_INITIATIVE'`, a kroki governance ida albo do DRUGIEJ tabeli addytywnej (`20261722_`), albo do dziennika w artefaktach; syntetyczny `legacy_task_id` jest ZAKAZANY, bo rozwala arytmetyke kontrolna z planu A4; (d) `>=16 polecen` z karty jest PODLOGA i prawdopodobnie zanizona DRUGI raz: `definitionReadiness.ts:18-26` wymaga 8 opublikowanych kart, `analysisReadiness.ts:3-14` wymaga 10 (16 roznych), kazda karta to polecenie `initiative.card.publish`, a PUBLISH scenariusza jest operacja na istniejacym DRAFT — realny koszt domu moze wynosic ~38 polecen, co podnosi rachunek etapu 2 z ~850-1070 do ~2000-2500; (e) regula A3 planu (`bez zgadywania fallbackow`) zestawiona z M3 (`bez_sla = 467/467`) i z twarda walidacja `executionWork.ts:145-148` daje ZERO migrowalnych zadan na stagingu — to jest bramka decyzyjna dla wlasciciela, o ktorej karta 197 nie mowi. ★ Dodatkowo: `legacy_task_cutover_ledger` jest dzis tabela BEZ PISARZA I BEZ CZYTELNIKA (odbior 197, mina 4) — Twoj runner jest jej pierwszym pisarzem w tym repozytorium i nie ma dla niego precedensu |

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
cd /private/tmp/cx-day204-migracja-e2

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day204-pg psql -U postgres -d cx204 \
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
cd /private/tmp/cx-day204-migracja-e2

docker run -d --name cx-day204-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx204 \
  -p 127.0.0.1:6144:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day204-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6144/cx204 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6144/cx204 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day204-migracja-e2 && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6144/cx204 \
JWT_SECRET=cx204-test-secret-do-not-reuse \
npx vitest run tests/integration/day204-legacy-task-cutover-runner.realdb.test.ts --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day204-migracja-e2-artefakty/day204-migracja-etap2.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day204-migracja-e2 && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run tests/integration/day204-legacy-task-cutover-runner.realdb.test.ts --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day204-migracja-e2-artefakty/day204-migracja-etap2.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day204-migracja-e2/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day204-pg psql -U postgres -d cx204 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day204-pg`.
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
> **(e) ★★ **Pierwsza: zmiana fingerprinta jest zmiana o promieniu calego produktu.** `materialCommandFingerprint` (`materialCommand.ts:329-345`) jest wolany przez KAZDE polecenie materialne, a `:473-484` porownuje zapisany odcisk z policzonym i przy roznicy rzuca `MaterialCommandConflictError` zamiast zwrocic `REPLAYED`. Najlatwiejszym bledem tego dyzuru jest `naprawienie` miny (a) przez dopisanie `correlationId` — i unieważnienie wszystkich paragonow, ktore juz istnieja na stagingu. Zmierz cene PRZED zmiana, nie po. ★★ **Druga: mina (b) moze byc nieosiagalna, a `nie znalazlem` jest tu poprawna odpowiedzia.** Kolejnosc straznikow to: paragon (`:467-494`) -> CAS agregatu glownego (`:504-516`) -> `prepare` (walidacja domenowa, `caseAndRollup`) -> `claimRelation` na samym koncu (`executionWork.ts:167-176`). Przy ponowieniu tego samego `taskId` konflikt wersji strzeli PIERWSZY. Nie zmieniaj produkcyjnego `claimRelation`, dopoki nie odtworzysz scenariusza, w ktorym relacja istnieje, a agregat nie. ★★ **Trzecia: samo `ON CONFLICT DO NOTHING` nie robi no-opa, tylko zmienia komunikat bledu.** `claimRelation` konczy sie `requireSingleRow(result, 'relation claim')` (`postgresMaterialCommandUnitOfWork.ts:19-21`: `rowCount !== 1` -> `Error`). Bez zmiany tej linii kazda kolizja zamienia sie w `relation claim affected 0 rows`. A `requireSingleRow` obsluguje kilkanascie innych operacji — **nie zmieniasz go globalnie**, obchodzisz lokalnie. Do tego `ie_aggregate_relations` ma DWA ograniczenia (PK po zrodle i UNIQUE po celu, `932_...:117-129`) — `ON CONFLICT DO NOTHING` BEZ listy kolumn obejmuje oba, z lista tylko jedno. ★★ **Czwarta: `expectedCaseVersion` to nie ozdoba — to trzy warunki naraz i rosnaca wersja.** `caseAndRollup` (`executionWork.ts:78-117`) czyta `execution_case` FOR UPDATE i wymaga JEDNOCZESNIE `version === expectedCaseVersion`, zgodnego `initiativeId` ORAZ `state === 'ACTIVE'` (`:87-93`), po czym podbija wersje sprawy o 1 (`:108-115`). Przy DRUGIM zadaniu w tej samej sprawie `expectedCaseVersion` jest juz inne — runner musi isc SZEREGOWO per sprawa i odswiezac wersje, nigdy losowo ponawiac. ★★ **Piata: wersja INICJATYWY rosnie po kazdym poleceniu, a scenariusze ja przypinaja.** `portfolioDecision.ts:238-248` wymaga czlonkostwa inicjatywy w opublikowanym scenariuszu z pasujacym `initiativeVersion`, a `scheduleDecision.ts:141-144` wymaga okna planu przypietego do `initiativeVersion` rownej `handoff.sourceVersions.initiative`. Scenariusze trzeba wiec publikowac w oknie wersji, ktore PRZETRWA do momentu uzycia. To jest najtrudniejszy wezel calego lancucha — rozrysuj kolejnosc ZANIM napiszesz pierwsza linie runnera. ★★ **Szosta: kazda brama governance zada NIEZALEZNEGO autorytetu.** `definitionDecision.ts:124-126`, `portfolioDecision.ts:62-65`, `scheduleDecision.ts:194-199`: `!selfApprovalAllowed && authorityId === actorId` konczy sie odrzuceniem. Runner migracyjny ma wiec albo DWIE tozsamosci, albo jawne `selfApprovalAllowed: true` — to jest swiadoma utrata rozdzielnosci rol i idzie do karty, nie do komentarza w kodzie. ★★ **Siodma: `createExecutionTask` nie pozwala zachowac historii.** `status`, `createdAt` i `completedAt` sa wyciete z payloadu (`Omit`, `executionWork.ts:126-129`) i nadpisywane (`:161-163`), a `createdAt` to zawsze `new Date().toISOString()`. Historyczne `tasks.created_at` jest tracone bezpowrotnie. Do tego ~60 kolumn `tasks` nie ma odpowiednika (lista w A3). Wypisz te utraty jawnie. ★★ **Osma: odczyt dowodowy potrafi sie wysadzic na JEDNYM zlym wierszu.** `postgresInitiativeReader.listExecutionTasks` (`:310`, SQL `:316`) sortuje po `(payload_json->>'dueAt')::timestamptz`, a walidacja tworzaca przepuszcza `dueAt` przez `Date.parse` (`executionWork.ts:145`), ktore akceptuje formaty, jakich Postgres `::timestamptz` moze nie przyjac. Jeden zle sformatowany `dueAt` wywala CALY odczyt sprawy — na stagingu wyglada to jak `migracja zepsula Realizacje`. ★★ **Dziewiata: seed o ksztalcie M3 ma dwie pulapki, na ktorych polegl dyzur 197.** (1) `initiatives_status_check` — `db:seed:demo:contract` zatrzymal sie na statusie `completed`; odczytaj AKTUALNA definicje constraintu z bazy (`pg_get_constraintdef`) zanim cokolwiek wstawisz. (2) `tasks` ma klucze obce do `organizations`, `projects`, `users` (`000_initdb_core_tables.sql:226-230`), a `sla_due_at` jest typu **TEXT** (`000_z_core_baseline.sql:367`, plan A3 nazywa to `tekst legacy`) — seed musi to odtworzyc, inaczej mierzysz cos innego niz staging. ★★ **Dziesiata: bramka `day161` nie wypisuje swojego PASS do zadnego logu.** `scripts/dev/day161-fresh-migration-check.sh:55` echuje `DAY161_FRESH_MIGRATION_GATE=PASS` na stdout, JUZ PO ostatnim `tee`. Lap PASS z wyjscia procesu, nie z pliku logu, i napisz w raporcie, skad go wziales. Bramka stawia tez WLASNY kontener i odmawia zajetego portu — sekwencja obejscia jest w bloku (T10) komend weryfikacji wejscia. ★★ **Jedenasta: `walidator nazw migracji przeszedl` nie moze znaczyc `exit 0`.** `server/scripts/validate-migration-naming.ts:144` konczy sie niezerowym kodem juz dzis, przez zastane pliki. Moze znaczyc wylacznie: moj plik pasuje do `VALID_DATE_GENERIC` (`:36`) i liczba bledow NIE WZROSLA. Raport 197 podaje 92 — **nie przepisuj tej liczby, zmierz swoja przed i po****
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day204-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day204-migracja-e2-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1 — DWIE MINY z odbioru 197, rozbrojone z DOWODEM MUTACYJNYM W OBIE STRONY: (a) fingerprint (`materialCommand.ts:329-345`) — NAJPIERW pomiar ceny zmiany (`:473-484` porownuje zapisany odcisk z policzonym i rzuca konflikt zamiast `REPLAYED`, wiec zmiana ciala funkcji uniewaznia WSZYSTKIE zastane paragony), POTEM wybor wariantu A (zmiana fingerprinta, dozwolona tylko przy zerowym promieniu wybuchu) albo B (osobne pole klucza ponowienia w ledgerze, bez dotykania `materialCommand.ts`); (b) `claimRelation` (`postgresMaterialCommandUnitOfWork.ts:364-382`) — NAJPIERW odtworzenie realnej czesciowej awarii i zapisanie, KTORY straznik strzela pierwszy (CAS agregatu `materialCommand.ts:504-516` wykonuje sie PRZED `prepare`, wiec mina moze byc NIEOSIAGALNA — i to tez jest poprawny wynik), POTEM ewentualne `ON CONFLICT DO NOTHING` bez listy kolumn + weryfikacja zgodnosci istniejacego wiersza. R2 — RUNNER `server/scripts/legacy-task-cutover-runner.ts`: trzy bezpieczniki z testami, pelny lancuch domu kanonicznego przez `executeMaterialCommand` ze ZMIERZONA liczba polecen `N` (karta 197 mowi `>=16` i NIE liczy 16 publikacji kart), rozstrzygniecie sprzecznosci ledgera (jeden wiersz na zadanie vs `kazdy krok do ledgera`), mapowanie brakow pol wg A3 z domyslna polityka SCISLA (brak pola = SKIPPED, zero zgadywania; fallbacki jako flagi domyslnie WYLACZONE), naprawa do przodu. R3 — PROBA LOKALNA na seedzie o ksztalcie M3 (3 inicjatywy z zadaniami o brakach jak M3 + 2 zadania osobiste): dry-run -> 1 inicjatywa -> oglad -> `--confirm-batch` na 2 pozostale -> ledger kompletny (`total = MIGRATED + SKIPPED + FAILED`, `unmatched = 0`) -> odczyt readerem -> replay calosci 100% `REPLAYED`; DWA dowody mutacyjne: limiter i naprawa do przodu (kill w srodku lancucha)`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6144` albo `5078 i 5079` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6144` albo `5078 i 5079`** (`Z7`).

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

Właściciel podjął decyzję **D-13** (`docs/program/funkcje/DECYZJE_WLASCICIELA_2026-08-30_WIECZOR.md:39`):

> **Migracja E2: uruchomienie — TAK: pilot 1, potem partie po 10.** Dyżur 204: miny
> (fingerprint, ON CONFLICT) + runner `--write=1` + próba lokalna; **PILOT na stagingu
> wykonuje NADZORCA** (procedura promocji, zapis za zgodą D-13) → ogląd właściciela →
> partie; brama `409` zostaje do końca migracji.

Ta decyzja stoi na karcie decyzyjnej z dyżuru 197, poprawionej przez `FIX-197`
(`cac843372b`), i na pomiarze `M3` wykonanym przez nadzorcę na stagingu za zgodą
`D-12` (raport 197, sekcja „★ M3 — WYNIK REALNY"):

```
active_execution_cases        = 14
legacy_initiatives_with_tasks = 67
tasks: total 467 · personal_bez_inicjatywy 265 · bez_assignee 49
       · bez_ownera 411 · bez_due 195 · bez_sla 467
```

**Ty NIE dotykasz stagingu.** `Z28` obowiązuje w całości: cały ten dyżur jest
LOKALNY. Pilot na stagingu wykonuje nadzorca po scaleniu Twojej gałęzi. Twoim
produktem jest **narzędzie i dowód, że narzędzie działa** — nie migracja danych.

## Co ten dyżur ma dowieźć, jednym zdaniem na pozycję

- **R1 — dwie miny z odbioru 197, rozbrojone z dowodem mutacyjnym.**
  (a) fingerprint bez `correlationId` → `batch_id` nie jest kluczem ponowienia;
  (b) `claimRelation` bez `ON CONFLICT` → ponowienie po częściowej awarii.
  **Uwaga: rozbrojenie miny może znaczyć „mina jest nieosiągalna" — to też jest wynik.**
- **R2 — runner `server/scripts/legacy-task-cutover-runner.ts`** z limitem
  egzekwowanym KODEM, pełnym łańcuchem domu kanonicznego, rejestrem każdego kroku
  i naprawą do przodu.
- **R3 — próba lokalna na bazie o kształcie `M3`**: miniatura stagingu, 1 inicjatywa →
  ogląd → `--confirm-batch` na 2 pozostałe → ledger kompletny → replay całości `REPLAYED`.

## ★★ SIEDEM RZECZY, KTÓRE ZMIERZYŁEM PRZY PISANIU TEJ INSTRUKCJI

Wszystkie są **rozkazem pomiarowym, nie prawdą objawioną** (`Z24`). Obalenie
którejkolwiek jest sukcesem dyżuru i wchodzi do „Korekt wobec instrukcji".
Cztery z nich **zmieniają treść zamówienia** — czytaj uważnie, bo zamówienie
nadzorcy w tych czterech punktach było błędne i to JA je tu prostuję.

### (a) ★★ Zmiana fingerprinta UNIEWAŻNIA WSZYSTKIE ISTNIEJĄCE PARAGONY

`executeMaterialCommand` przy trafieniu w istniejący paragon **porównuje zapisany
`request_fingerprint` z policzonym teraz** i przy różnicy rzuca
`MaterialCommandConflictError`, a nie zwraca `REPLAYED`:

```
server/src/domain/initiatives-execution/materialCommand.ts:473-484
  if (receipt.commandType !== ... || receipt.requestFingerprint !== requestFingerprint)
    throw new MaterialCommandConflictError('clientRequestId was already used for a different command target', ...)
```

Skutek, który masz **potwierdzić albo obalić pomiarem**: dopisanie `correlationId`
(albo `organizationId`+`actorId`) do `materialCommandFingerprint`
(`materialCommand.ts:329-345`) sprawia, że **każdy paragon zapisany przed zmianą
przestaje być replayowalny** — zamiast idempotentnego `REPLAYED` dostaje twardy
konflikt. Na stagingu paragony JUŻ ISTNIEJĄ (14 aktywnych spraw kanonicznych =
kilkaset paragonów). To nie jest teoria: to jest zmiana, która psuje właśnie tę
własność, dla której mina została zgłoszona.

**Dlatego zamówienie „dołączyć correlationId do fingerprinta" jest w tej instrukcji
warunkowe, a nie nakazowe** — patrz `R1a`. Wariant bezpieczny (osobne pole klucza
ponowienia poza fingerprintem) jest w zamówieniu wymieniony i najprawdopodobniej
jest tym właściwym; ale wybierasz go **po pomiarze**, nie przed.

### (b) ★★ Mina (b) może być NIEOSIĄGALNA — bo wcześniej strzela inny strażnik

Zamówienie mówi: „ponowienie z nowym `clientRequestId` po częściowej awarii =
kolizja PK, nie no-op". Przy `execution.task.create` **kolejność strażników jest inna
niż zakłada mina**:

1. `materialCommand.ts:504-516` — CAS na agregacie GŁÓWNYM: `currentVersion !== expectedVersion`
   i `validCreate === false` (bo `currentVersion !== null`) → `MaterialCommandConflictError`
   **PRZED wywołaniem `prepare`**;
2. dopiero w `prepare` (`executionWork.ts:139-176`) leci `caseAndRollup`, a **na samym
   końcu** `claimRelation` (`:167-176`).

Skoro `relationType` to `EXECUTION_CASE_TASK:${taskId}` (`executionWork.ts:169`), a
`ie_aggregate_relations` ma `PRIMARY KEY (organization_id, relation_type, source_type, source_id)`
(`932_initiatives_execution_material_commands.sql:117-129`), to kolizja PK wymaga
sytuacji, w której **relacja istnieje, a agregat `execution_task` NIE istnieje** —
a oba powstają w JEDNEJ transakcji. **Zmierz, czy taka sytuacja jest w ogóle osiągalna.**

Jeśli NIE jest — **nie zmieniasz produkcyjnego `claimRelation`**. Piszesz test, który
dowodzi, że pierwsza rzecz, w którą uderza ponowienie, to CAS agregatu, i wpisujesz do
raportu: „mina (b) w kształcie z odbioru 197 jest nieosiągalna na ścieżce
`execution.task.create`; osiągalny objaw to X". To jest **poprawna, wartościowa
odpowiedź** i nie jest STOP-em pozycji.

Jeśli JEST osiągalna (szukaj po ścieżkach, gdzie relacja wisi na agregacie GŁÓWNYM,
a tworzony jest agregat POWIĄZANY — np. `portfolioDecision.ts:117-128`,
`definitionDecision.ts`, `handoffAcceptance.ts`) — dopiero wtedy naprawiasz, wg `R1b`.

### (c) ★★ Kształt ledgera z 197 NIE PRZYJMIE tego, co zamawia „każdy krok do ledgera"

Zmierzone w `server/migrations/20261721_legacy_task_cutover_ledger.sql`:

```sql
status TEXT NOT NULL CHECK (status IN ('PENDING','MIGRATED','SKIPPED','FAILED'))
PRIMARY KEY (organization_id, legacy_task_id)
```

Trzy twarde konsekwencje:

1. **`SKIPPED_PERSONAL` NIE JEST dozwoloną wartością** — `INSERT` padnie na CHECK.
   Zadania osobiste zapisujesz jako `status='SKIPPED'` + `reason_code='PERSONAL_NO_INITIATIVE'`.
   **To jest korekta zamówienia, którą wprowadzam ja, autor instrukcji — nie zgaduj innej.**
2. **`REPLAYED` NIE JEST statusem ledgera** — to literał wyniku material-commanda
   (`materialCommand.ts:19`, `:487`). Ledger przy ponowieniu **zostaje** na `MIGRATED`
   z **identycznym `checksum`**, a runner asertuje `result.status === 'REPLAYED'`
   z odpowiedzi polecenia. Dwie różne rzeczy o podobnej nazwie — nie zlewaj ich.
3. **Nie ma kolumny na krok, a PK jest po `legacy_task_id`** — czyli w tej tabeli
   mieści się **dokładnie jeden wiersz na zadanie**, a nie ≥16 wierszy na kroki
   governance domu kanonicznego. Zamówienie „KAŻDY krok do `legacy_task_cutover_ledger`"
   jest w tym kształcie **niewykonalne**. Rozstrzygnięcie jest w `R2c`.

**Zakazane obejście:** syntetyczny `legacy_task_id` w rodzaju `governance:<initiativeId>:<krok>`.
Powód nie jest estetyczny: rozwala arytmetykę kontrolną z planu `A4`
(`total = MIGRATED + SKIPPED + FAILED` oraz `unmatched = 0` z `LEFT JOIN tasks`) —
wiersze governance policzyłyby się jako przeniesione zadania. Nie rób tego.

### (d) ★★ „≥16 poleceń" z karty jest PODŁOGĄ, i prawdopodobnie zaniżoną — DRUGI raz

Karta 197 (po `FIX-197`) mówi: dom kanoniczny = **≥16 poleceń materialnych + 3 PUBLISHED
scenariusze**. Zmierzyłem cztery rzeczy, których karta nie liczy:

1. **`initiative.definition.request` wymaga READY, a READY wymaga OPUBLIKOWANYCH KART.**
   `definitionDecision.ts:136-143` → `currentReadiness` → `evaluateDefinitionReadiness`
   (`definitionReadiness.ts:18-26`) wymaga **ośmiu** kart:
   `summary-scope, strategic-fit, success-criteria, outcomes-benefits, options,
   people-team, roles-raci, stakeholders`; brak karty = `BLOCKER PUBLISHED_CARD_MISSING`.
2. **`initiative.analysis.request` wymaga kolejnych kart** —
   `analysisReadiness.ts:3-14` wylicza **dziesięć**: `options, financial-analysis, kpi,
   resources-capacity, dependencies, risk-raid, technical-specification,
   change-adoption, stakeholders, feasibility-completeness`.
   Część wspólna z definicją to `options` i `stakeholders` → **16 różnych kart**.
3. **Każda karta to osobne polecenie materialne** `initiative.card.publish`
   (`publishInitiativeCard.ts:38-44`), być może poprzedzone `initiative.card.review`
   (`reviewInitiativeCard.ts:28-33`).
4. **`PUBLISH` scenariusza to operacja, nie stan początkowy** —
   `portfolioScenario.ts:99` (`operation === 'PUBLISH' && existing?.status !== 'DRAFT'` → błąd)
   znaczy, że scenariusz musi najpierw powstać jako `DRAFT`, a dopiero potem być
   opublikowany: **potencjalnie 2 polecenia na scenariusz × 3 scenariusze = 6**, nie 3.

Jeśli to się potwierdzi, realny koszt jednego domu to **~16 + ~16 + ~6 ≈ 38 poleceń**,
nie 16. **Rachunek etapu 2 dla właściciela wzrósłby z ~850-1070 do ~2000-2500 poleceń
governance.** Właściciel podjął `D-13` na liczbie „≥16". **Zmierz to i wpisz do raportu
jako pierwszą rzecz, którą nadzorca ma zanieść właścicielowi** — dokładnie tak, jak
`FIX-197` zaniósł korektę z „≥5" na „≥16".

### (e) ★★ Trzy dalsze warunki `schedule.request`, których karta nie wymienia

`scheduleDecision.ts:182-215` + `sources()` (`:95-178`) wymaga JEDNOCZEŚNIE:

- **niezależnego autorytetu**: `!selfApprovalAllowed && authorityId === actorId` → odrzucenie
  (`:194-199`). To samo w `definitionDecision.ts:124-126` i `portfolioDecision.ts:62-65`.
  **Runner migracyjny ma więc albo DWIE tożsamości, albo jawne `selfApprovalAllowed: true`
  — i to jest decyzja do karty, nie detal implementacyjny.**
- **okna w opublikowanym `plan_scenario` przypiętego do `initiativeVersion`**
  (`:141-144`) — a wersja inicjatywy rośnie po KAŻDYM poleceniu, więc scenariusze muszą
  być publikowane w oknie wersji, które przetrwa do `schedule.request`;
- **`resource_commitment` w stanie `CONFIRMED`/`CONDITIONALLY_CONFIRMED`** dla każdego
  `commitmentIds` (`:159-175`). ★ Pętla po pustej tablicy nie robi nic — **sprawdź, czy
  `commitmentIds: []` i `criticalPeriodIds: []` przechodzą walidację** (`criticalCapacityReady`
  na pustej liście zwraca `true` przez `.every`, `:82-90`). Jeśli tak, to jest legalna
  droga skrócenia łańcucha o cały blok zobowiązań zasobowych — i to też jest wynik
  do karty (co migracja świadomie POMIJA).

Do tego `portfolioDecision.ts:238-248`: `initiative.portfolio.request` wymaga, żeby
inicjatywa była **członkiem opublikowanego scenariusza portfela** z pasującym
`initiativeVersion`. Czyli `portfolio.scenario.mutate` musi znać wersję inicjatywy
**z przyszłości** względem swojego wykonania. To jest najtrudniejszy węzeł całego
łańcucha — zaplanuj kolejność na kartce ZANIM napiszesz pierwszą linię runnera.

### (f) ★★ Reguła A3 planu, dosłownie stosowana, daje ZERO migrowalnych zadań na stagingu

Plan `A3` kończy się zdaniem:

> „Zakres MVP: tylko nie-personal, z initiative, aktywna sprawa, assignee+owner
> i parsowalne due+sla; **reszta do jawnego rejestru pominięć, bez zgadywania fallbacków**."

A `createExecutionTask` waliduje twardo `!p.ownerId || !Number.isFinite(Date.parse(p.slaAt))`
→ `'Task ownership and SLA are required'` (`executionWork.ts:145-148`).

Zestaw to z `M3`: **`bez_sla = 467` z `467`.** Czyli przy dosłownym stosowaniu `A3`
kwalifikowalnych zadań na stagingu jest **0 z 467** — cała partia poszłaby do
`SKIPPED`. To nie jest błąd runnera; to jest **bramka decyzyjna dla właściciela**,
o której karta 197 nie mówi.

**Twoje zadanie:** domyślną polityką runnera jest **ścisłe `A3` (SKIP, zero zgadywania)**.
Fallbacki (`--owner-fallback`, `--sla-offset-days`) implementujesz jako **jawne flagi
domyślnie WYŁĄCZONE**, a zastosowaną politykę zapisujesz do `reason_code` i wliczasz
do `checksum`. W raporcie podajesz arytmetykę: ile wierszy z `M3` przechodzi przy
ścisłym `A3`, a ile przy każdym z fallbacków. **Nie wybierasz polityki za właściciela.**

### (g) `D-13` mówi „partie po 10" — a zamówienie mówi `--batch-size N` bez sufitu

`DECYZJE…_WIECZOR.md:39`: *„pilot 1, potem partie po 10"*. Dlatego w tym dyżurze
`--batch-size` ma **sufit 10 egzekwowany kodem** (wartość > 10 = błąd i wyjście
niezerowe), domyślna wartość `1`, a bez `--confirm-batch` runner wykonuje
**dokładnie 1 inicjatywę niezależnie od `--batch-size`**. Trzy testy na te trzy rzeczy.

# 2. TEZY ZLECENIA

Wszystkie do obalenia (`Z24`). Numery linii są z tipa `c7f13f588f`.

- **T1.** `materialCommand.ts:473-484` porównuje `receipt.requestFingerprint` z policzonym
  i rzuca `MaterialCommandConflictError` przy różnicy. **Wniosek do zmierzenia:** zmiana
  ciała `materialCommandFingerprint` (`:329-345`) unieważnia wszystkie zastane paragony.
- **T2.** `materialCommandFingerprint` liczy z `aggregateType, aggregateId, commandType,
  expectedVersion, policyId, policyVersion, payload` — **bez** `actorId`, `organizationId`
  i `correlationId` (`:334-342`, kanonizacja `:319-327`).
- **T3.** `claimRelation` (`postgresMaterialCommandUnitOfWork.ts:364-382`) nie ma
  `ON CONFLICT` i kończy się `requireSingleRow(result, 'relation claim')` (`:19-21`:
  `rowCount !== 1` → `Error`). **Skutek uboczny do zmierzenia:** samo dopisanie
  `ON CONFLICT DO NOTHING` bez zmiany `requireSingleRow` zamienia każdą kolizję
  w `relation claim affected 0 rows` — czyli w INNY błąd, nie w no-op.
- **T4.** CAS agregatu głównego (`materialCommand.ts:504-516`) wykonuje się **przed**
  `prepare`, więc przed `claimRelation`. Kolejność strażników przy ponowieniu jest
  zatem: paragon → CAS agregatu → walidacja domenowa → relacja.
- **T5.** `ie_aggregate_relations` ma `PRIMARY KEY (organization_id, relation_type,
  source_type, source_id)` **oraz** `UNIQUE (organization_id, relation_type, target_type,
  target_id)` (`932_…:117-129`). `ON CONFLICT DO NOTHING` **bez listy kolumn** obejmuje
  oba ograniczenia; z listą — tylko jedno. To jest różnica, która decyduje o poprawności.
- **T6.** Ledger `20261721_…` ma `CHECK (status IN ('PENDING','MIGRATED','SKIPPED','FAILED'))`,
  `PRIMARY KEY (organization_id, legacy_task_id)` i `UNIQUE (organization_id, client_request_id)`.
  Brak kolumny kroku; brak wartości `REPLAYED` i `SKIPPED_PERSONAL`.
- **T7.** `definitionReadiness.ts:18-26` wymaga 8 opublikowanych kart;
  `analysisReadiness.ts:3-14` wymaga 10; część wspólna = `options`, `stakeholders`;
  suma różnych kart = **16**. Publikacja karty to `initiative.card.publish`
  (`publishInitiativeCard.ts:38-44`).
- **T8.** Ścieżka lifecycle jest: `REGISTERED_DRAFT` (`registerInitiative.ts:134`)
  → `DEFINED` (`definitionDecision.ts:277-278`, tylko przy `APPROVED`)
  → `ANALYZING` (`analysisDecision.ts:76`)
  → `READY_FOR_DECISION` (`analysisDecision.ts:245-246`, tylko przy `APPROVED`)
  → `APPROVED_BACKLOG` (`portfolioDecision.ts:239-240`)
  → `SCHEDULED` (`scheduleDecision.ts`) → `IN_EXECUTION` (`handoffAcceptance.ts`).
  **Żadnego z tych przejść nie wolno obejść surowym `UPDATE` ani seedem agregatu.**
- **T9.** `initiative.register` wymaga propozycji źródłowej w `initiative_candidates`
  ze `status='pending'`, `evidenceState='READY'`, `duplicateState='CLEAR'` i zgodną
  wersją (`registerInitiative.ts:95-129`). Produkcyjną drogą jej powstania jest
  polecenie `source-proposal.submit` (`submitSourceProposal.ts:83-90`), które ustawia
  `evidenceState='READY'` **tylko gdy `provenance.evidenceRefs.length > 0`** (`:110-111`).
  ★ Test 197 wstawiał ten wiersz **surowym INSERT-em** — Ty masz zmierzyć, czy da się
  przez polecenie, i jeśli tak, to jest to +1 do licznika z punktu (d).
- **T10.** `postgresInitiativeReader.listExecutionTasks` (`:310`, SQL `:316`) sortuje po
  `(payload_json->>'dueAt')::timestamptz`. Jeden niedobrze sformatowany `dueAt` wywala
  **cały odczyt sprawy**, nie jeden wiersz. `Date.parse` w walidacji (`executionWork.ts:145`)
  przyjmuje formaty, których `::timestamptz` może nie przyjąć.
- **T11.** `scriptDatabaseTarget.ts` daje gotowy wzorzec bezpiecznego runnera:
  `requireConfirmation(envName, expectedValue, label)` (`:104-113`) rzuca, dopóki
  zmienna środowiskowa nie ma dokładnej wartości; `logSelectedDatabaseTarget` (`:92-102`)
  drukuje wybrany cel. **Nie piszesz własnego mechanizmu potwierdzenia.**
- **T12.** `scripts/dev/day161-fresh-migration-check.sh` stawia WŁASNY kontener
  (domyślnie `cx-day161-pg` na porcie `6049`), odmawia adopcji istniejącego kontenera
  (`:22-25`), odmawia zajętego portu (`:26-29`), sprząta `docker rm -fv` w `trap` (`:15-18`)
  i echuje `DAY161_FRESH_MIGRATION_GATE=PASS` **na stdout, po ostatnim `tee`** (`:55`) —
  czyli **napisu nie ma w żadnym logu**. Łapiesz go z wyjścia procesu.

# 3. POZYCJE DYŻURU

★★ **ŻELAZNA KOLEJNOŚĆ `R1 → R2 → R3`, udowodniona kolejnością commitów.** Miny
rozbrajasz PRZED napisaniem runnera. Runner, który powstał przed pomiarem min,
jest podstawą odrzucenia pozycji, nawet gdyby działał.

---

## R1 — DWIE MINY Z ODBIORU 197, ROZBROJONE Z DOWODEM MUTACYJNYM (rdzeń)

Źródło min: `docs/program/funkcje/ODBIOR_197_MIGRACJA_E1.md`, sekcja „Miny etapu 2",
punkty 1 i 2.

### R1a — mina fingerprinta: `batch_id` NIE jest kluczem ponowienia

**Krok 1 — POMIAR ZASIĘGU (obowiązkowy, PRZED jakąkolwiek zmianą kodu).**

Napisz test realDB, który mierzy **cenę zmiany fingerprinta**:

1. wykonaj dowolne proste polecenie materialne przez `executeMaterialCommand`
   i zapisz jego paragon (`ie_command_receipts`);
2. **nie zmieniając produkcyjnej funkcji**, policz „nowy" fingerprint tym samym
   algorytmem rozszerzonym o `correlationId` i podmień go w bazie na wierszu paragonu
   (albo równoważnie: uruchom to samo polecenie ze zmienionym `correlationId` po
   podmianie zapisanego odcisku) — cel jest jeden: **udowodnić, że ścieżka
   `materialCommand.ts:473-484` zwraca konflikt, a nie `REPLAYED`**;
3. zmierz i zapisz w raporcie: ile wierszy jest dziś w `ie_command_receipts`
   na Twojej bazie po `R3`, oraz **ile ich jest na stagingu** — tej drugiej liczby
   NIE mierzysz sam (`Z28`), tylko zostawiasz zapytanie w `/private/tmp/cx-day204-migracja-e2-artefakty` i piszesz
   wprost „nie zmierzone, `Z28`".

**Krok 2 — WYBÓR WARIANTU. Rozstrzygasz Ty, na podstawie kroku 1, i uzasadniasz.**

| Wariant | Kiedy wolno wybrać | Co robisz |
|---|---|---|
| **A — zmiana `materialCommandFingerprint`** | **tylko** jeśli krok 1 wykaże, że stare paragony NIE stają się niereplayowalne | dopisujesz `correlationId` (albo `organizationId`+`actorId`) do `canonicalJson` w `:334-342`; test mutacyjny w obie strony; **w raporcie liczba paragonów, które zmiana unieważnia** |
| **B — osobne pole klucza ponowienia w ledgerze** (wariant z zamówienia) | jeśli krok 1 potwierdzi unieważnienie paragonów | **NIE ruszasz `materialCommand.ts`**; klucz ponowienia trzymasz w ledgerze (patrz `R2c`); `batch_id` przestaje udawać klucz, a runner sam pilnuje, żeby ten sam `clientRequestId` nie wrócił z innym ładunkiem |

★★ **Wariant B otwiera JEDYNY dozwolony wyjątek od zakazu nowych migracji**:
`server/migrations/20261722_<nazwa>.sql`, czysto addytywna, z pełnym przebiegiem
od pustej bazy i bramką `day161`. Przedział `20261722`–`20261729` jest zarezerwowany
dla tego dyżuru. **Żaden inny powód nie uprawnia Cię do nowej migracji.**

★ **Wariant A i B nie są równorzędne pod względem promienia wybuchu.** Wariant A
zmienia funkcję używaną przez KAŻDE polecenie materialne w produkcie. Jeśli go
wybierzesz, w raporcie musi być zdanie: „ta zmiana dotyka N ścieżek poleceń
i unieważnia M zastanych paragonów", z policzonymi N i M — inaczej pozycja jest
odrzucona jako niezmierzona.

**Dowód mutacyjny (obowiązkowy, obie strony):** test czerwony przed naprawą,
zielony po; a następnie odwrócenie naprawy (`git stash` **ZAKAZANY** — kopiujesz
plik do `/private/tmp/cx-day204-migracja-e2-scratch` przez `cp`, mutujesz, uruchamiasz, przywracasz przez `cp`)
i pokazanie, że test wraca na czerwono. Bez tej drugiej połowy „naprawiłem" nie jest
dowodem (`Z29`).

### R1b — mina `claimRelation`: `ON CONFLICT` z weryfikacją zgodności

**Krok 1 — ODTWÓRZ CZĘŚCIOWĄ AWARIĘ NA REALNYM POSTGRESIE.** Nie z opisu, nie
z lektury — scenariuszem:

1. przeprowadź polecenie do końca (transakcja zatwierdzona, relacja w bazie);
2. udaj, że runner padł PO commicie, ale PRZED zapisem do ledgera;
3. ponów ten sam krok z **nowym `clientRequestId`** (bo runner nie wie, że już przeszło);
4. **zapisz, który strażnik strzelił jako PIERWSZY** i z jakim komunikatem.

★★ **Jeśli pierwszy strzela CAS agregatu (`materialCommand.ts:504-516`), a nie
`claimRelation`** — patrz znalezisko (b) — **to mina (b) jest w tym kształcie
nieosiągalna i NIE zmieniasz produkcyjnego `claimRelation`.** Zamiast tego:

- piszesz test, który utrwala **prawdziwą** kolejność strażników (test
  charakteryzujący, nazwany uczciwie — bez słowa „red contract", które odbiór 197
  kazał sprostować);
- szukasz, czy istnieje **inna** ścieżka, gdzie relacja wisi na agregacie GŁÓWNYM,
  a tworzony jest agregat POWIĄZANY (kandydaci: `portfolioDecision.ts:117-128`,
  `definitionDecision.ts`, `analysisDecision.ts`, `handoffAcceptance.ts`,
  `executionWork.ts:167-176`) i czy TAM kolizja PK jest osiągalna;
- wynik — łącznie z „nie znalazłem osiągalnej ścieżki" — wpisujesz do raportu
  i do planu. **To jest pełnowartościowe wykonanie pozycji.**

**Krok 2 — jeśli kolizja JEST osiągalna, naprawiasz tak i tylko tak:**

- `ON CONFLICT DO NOTHING` **bez listy kolumn** (obejmuje PK i UNIQUE naraz — `T5`);
- po `rowCount === 0` **weryfikujesz zgodność**: `SELECT` istniejącego wiersza po PK
  i porównanie **wszystkich** pól claimu (`source_version`, `target_type`, `target_id`,
  `payload_json`); zgodne → cichy no-op; **niezgodne → jawny, nazwany błąd**
  (nie `Error('relation claim affected 0 rows')`);
- jeśli wiersza nie ma po PK, a `rowCount === 0` — to znaczy, że strzeliło `UNIQUE`
  po celu: **to jest prawdziwy konflikt i ma rzucać**;
- `requireSingleRow` w tym jednym miejscu przestaje pasować — **nie zmieniasz go
  globalnie**, bo używa go kilkanaście innych operacji; obchodzisz go lokalnie.

★ **Promień wybuchu do policzenia i wpisania do raportu:** ilu producentów woła
`claimRelation` (`git grep -l claimRelation server/src/domain/initiatives-execution/`
dał mi ≥20 plików). Zmiana jest w JEDNYM miejscu, ale skutkuje we wszystkich.

**Dowód mutacyjny obu stron — jak w `R1a`.** Test musi odtwarzać scenariusz
częściowej awarii, a nie tylko wołać `claimRelation` dwa razy pod rząd.

---

## R2 — RUNNER `legacy-task-cutover-runner.ts` (rdzeń)

Plik: **`server/scripts/legacy-task-cutover-runner.ts`** (nazwa z zamówienia,
nie zmieniaj). Wzorce sąsiadów, z których kopiujesz konwencje:
`server/scripts/backfill-initiative-project.ts`,
`server/scripts/reassign-finance-org-to-primary.ts`,
`server/scripts/lib/scriptDatabaseTarget.ts`.

### R2a — bezpieczniki, egzekwowane KODEM (trzy testy, po jednym na bezpiecznik)

| Bezpiecznik | Zachowanie | Test |
|---|---|---|
| **dry-run domyślnie** | bez `--write` runner **nie wykonuje ani jednego polecenia materialnego i nie pisze do ledgera**; drukuje plan | uruchomienie bez `--write` na seedzie z `R3` → `ie_aggregate_state` i `legacy_task_cutover_ledger` bez zmian (liczby przed/po) |
| **`requireConfirmation`** | `--write` bez zmiennej potwierdzającej → wyjątek i kod niezerowy | wzorzec `scriptDatabaseTarget.ts:104-113` |
| **★★ twardy limit 1** | **bez `--confirm-batch` runner przetwarza DOKŁADNIE JEDNĄ inicjatywę, niezależnie od `--batch-size`** | `--batch-size 5` bez `--confirm-batch` → dokładnie 1 dom zbudowany, 1 grupa zadań; dowód mutacyjny: usuń limit → test czerwony |
| **sufit partii = 10** | `--batch-size 11` → błąd i kod niezerowy (`D-13`: „partie po 10") | osobny przypadek |

Wejście: `--initiative-id <id>` **albo** `--batch-size N` (domyślnie 1, sufit 10).
Podanie obu naraz = błąd wejścia.

★ **Runner NIE łączy się nigdzie poza `DATABASE_URL` wskazany jawnie.** Zero
odczytu sekretów, zero `llmService`, zero `/api/ai/**` (`Z15`).

### R2b — łańcuch domu kanonicznego, per inicjatywa

Każde polecenie idzie przez `executeMaterialCommand` (`materialCommand.ts:457-572`).
**Zero surowego `INSERT`/`UPDATE` do `ie_aggregate_state`, `ie_command_receipts`,
`ie_audit_events`, `ie_outbox_events`, `ie_aggregate_relations`.** To omija CAS,
audyt, outbox, paragon i claim relacji — plan `A4` odrzuca to wprost.

**Podłoga łańcucha (z karty 197 po `FIX-197`):**

```
candidates → register → definition(req+dec) → analysis(start+req+dec)
→ portfolio(req+dec) → 3× scenario.mutate (portfolio/plan/capacity, PUBLISHED,
   powiązane wersjami — scheduleDecision.ts:99-152)
→ schedule(req+dec) → handoff(req+dec) → task.create
```

★★ **To jest PODŁOGA, nie liczba.** Znaleziska (d), (e) i teza `T7` mówią, że
w praktyce dochodzą **publikacje kart** (8 + 10, część wspólna 2 → 16 różnych),
osobne `DRAFT`→`PUBLISH` scenariuszy i ewentualne `source-proposal.submit`.
**Twoim wynikiem R2b jest ZMIERZONA liczba `N` poleceń potrzebnych, żeby łańcuch
faktycznie przeszedł na realnym Postgresie** — z wypisaną listą `commandType`
w kolejności wykonania. Ta liczba idzie do raportu jako pierwsza pozycja
i jest materiałem dla nadzorcy na rozmowę z właścicielem (patrz `R2e`).

**Ograniczenia, o które łańcuch się rozbije, jeśli ich nie zaplanujesz:**

- wersja inicjatywy rośnie po KAŻDYM poleceniu — `portfolio_scenario.memberships`
  (`portfolioDecision.ts:238-248`) i `plan_scenario.windows`
  (`scheduleDecision.ts:141-144`) przypinają konkretną `initiativeVersion`;
- `capacity` musi wskazywać opublikowany `plan`, a `plan` opublikowany `portfolio`
  (`planScenario.ts:139`, `capacityScenario.ts:134`) — kolejność publikacji jest wymuszona;
- `windowUnit` i `timezone` muszą się zgadzać między `plan` i `capacity`
  (`scheduleDecision.ts:146-150`);
- **niezależny autorytet** — albo drugi identyfikator, albo `selfApprovalAllowed: true`;
  **co wybrałeś i dlaczego, idzie do raportu jako świadoma utrata rozdzielności ról**;
- `executionCaseId` **podajesz TY** w `initiative.handoff.request`
  (`handoffAcceptance.ts:70`, `:113-117`, `:123`) — kanon go nie generuje;
  identyfikatory projektujesz **deterministycznie** przed pierwszym uruchomieniem;
- `expectedCaseVersion` w `execution.task.create` (`executionWork.ts:128`) — `caseAndRollup`
  (`:78-117`) wymaga jednocześnie `version === expectedCaseVersion`, zgodnego
  `initiativeId` i `state === 'ACTIVE'`, po czym **podbija wersję sprawy o 1**;
  przy drugim zadaniu w tej samej sprawie wersja jest już inna → **szeregowo, z odświeżeniem**.

### R2c — ★★ REJESTR: rozstrzygnięcie sprzeczności ze znaleziska (c)

Ledger z 197 mieści **jeden wiersz na zadanie**. Kroki governance nie mają się gdzie
zapisać. **Wybierasz jedną z dwóch dróg i uzasadniasz w raporcie:**

| Droga | Co robisz | Koszt |
|---|---|---|
| **(i) druga tabela addytywna** `legacy_task_cutover_step_ledger` w `20261722_…` | `(organization_id, initiative_id, step_key)` jako PK, `client_request_id`, `command_type`, `command_status` (`APPLIED`/`REPLAYED`), `checksum`, znaczniki | nowa migracja → **pełny przebieg od pustej bazy + bramka `day161`** obowiązkowo |
| **(ii) dziennik przebiegu w artefaktach** (JSONL w `/private/tmp/cx-day204-migracja-e2-artefakty`) | zero DDL; ledger zadań bez zmian | **traci trwałość między procesami** — po awarii i restarcie runner nie odtworzy stanu z bazy, tylko z pliku |

★ Jeśli `R1a` wybrał **wariant B**, droga **(i)** jest praktycznie wymuszona (i tak
bierzesz migrację `20261722_`) — ale to Ty to stwierdzasz, nie ja.

★ **Zakazane:** syntetyczny `legacy_task_id` w ledgerze zadań (powód w znalezisku (c)).

**Niezależnie od drogi, w ledgerze ZADAŃ obowiązuje:**

- `clientRequestId` **deterministyczny** per `(inicjatywa, krok)` — wzorzec z planu `A4`:
  `tasks-canonical-v1:<org>:<legacy-id>`; dla kroków governance analogiczny,
  z jawnym kluczem kroku;
- `checksum` = deterministyczny odcisk **wiersza źródłowego + zastosowanego mapowania
  + zastosowanej polityki braków**; przy ponowieniu ten sam wiersz musi dać **ten sam
  checksum** — inaczej to nie jest ponowienie, tylko inna praca pod tym samym kluczem;
- **`REPLAYED` NIE jest statusem ledgera** (`T6`) — jest wartością `result.status`
  z polecenia. Ponowienie zostawia wiersz na `MIGRATED` z identycznym `checksum`
  i asertuje `REPLAYED` z odpowiedzi;
- **zadania osobiste** (`initiative_id IS NULL`) → `status='SKIPPED'`,
  `reason_code='PERSONAL_NO_INITIATIVE'`. **Nie `SKIPPED_PERSONAL`** — CHECK tego nie
  przyjmie (`T6`). Zgodne z rekomendacją planu `A5` wariant (ii): personalne zostają
  w legacy;
- **naprawa do przodu**: przerwanie w środku → ponowny bieg **dokańcza bez duplikatów**.
  Zero kasowania udanych agregatów (plan `A6` odrzuca destrukcyjny rollback wprost).

### R2d — mapowanie braków pól (tabela `A3` planu)

Domyślna polityka: **ścisłe `A3` — brak wymaganego pola = `SKIPPED` z `reason_code`,
zero zgadywania.** Wymagane przez `createExecutionTask` (`executionWork.ts:139-148`):
`executionCaseId`, `initiativeId`, `title`, `assigneeId`, `ownerId`, parsowalne
`dueAt` i `slaAt`.

Fallbacki jako **jawne flagi, domyślnie WYŁĄCZONE**, każda z własnym `reason_code`:
`--owner-fallback=reporter|created_by|migration-actor`, `--sla-offset-days=N`
(liczone od `due_date`; przy braku `due_date` → `SKIPPED`, nie zgadujesz dwa razy).

**W raporcie obowiązkowo arytmetyka wobec `M3`:** ile z `467` przechodzi przy ścisłym
`A3`, ile przy każdym fallbacku osobno. Znalezisko (f) mówi, że przy ścisłym `A3`
odpowiedź to prawdopodobnie **0**. Jeśli tak — **piszesz to wprost**; to jest bramka
dla właściciela, a nie porażka runnera.

★ **Świadome utraty do wypisania** (plan `A3` + `executionWork.ts:161-163`):
`status`, `createdAt`, `completedAt` są **wycinane z ładunku i nadpisywane** —
`createdAt` to zawsze `new Date().toISOString()`. **Historyczne `tasks.created_at`
jest tracone bezpowrotnie.** Plus ~60 kolumn bez odpowiednika z listy w `A3`.

### R2e — bramka przed etapem produkcyjnym (nie kod, ale warunek oddania)

Raport musi zawierać osobną, zatytułowaną sekcję **„DLA WŁAŚCICIELA — CO SIĘ ZMIENIŁO
OD KARTY 197"**, w której są **cztery liczby**:

1. zmierzone `N` poleceń na jeden dom kanoniczny (karta mówi „≥16" — patrz (d));
2. przeliczony rachunek etapu 2: `N × (67 − 14) … N × 67` (karta mówi „~850-1070");
3. ile z `467` zadań przechodzi przy ścisłym `A3` (patrz (f));
4. czy `batch_id` jest już bezpiecznym kluczem ponowienia — TAK/NIE i którym wariantem.

Bez tej sekcji dyżur jest odrzucony: nadzorca nie ma czego zanieść właścicielowi.

---

## R3 — PRÓBA LOKALNA NA BAZIE O KSZTAŁCIE `M3` (rdzeń)

### R3a — seed miniatury stagingu

Nowy plik, w konwencji sąsiadów (`scripts/dev/case-workspace-seed-local.mjs` ma
barierę loopback `:40-51` — **skopiuj ten wzorzec**). Kształt do odtworzenia:

| Element | Liczba | Uzasadnienie |
|---|---|---|
| inicjatywy legacy z zadaniami | **3** | 1 na pilota, 2 na `--confirm-batch` |
| zadania z `initiative_id` | ≥6 (min. 2 na inicjatywę) | dowód, że `expectedCaseVersion` rośnie w obrębie sprawy |
| zadania osobiste (`initiative_id IS NULL`) | **2** | ścieżka `SKIPPED` / `PERSONAL_NO_INITIATIVE` |
| braki pól | jak `M3`: część bez `owner_id`, **wszystkie bez `sla_due_at`**, część bez `due_date` | `M3`: `bez_ownera 411/467`, `bez_sla 467/467`, `bez_due 195/467` |

★★ **Dwie pułapki seeda, na których poległ dyżur 197:**

1. **`initiatives_status_check`** — `db:seed:demo:contract` zatrzymał się na statusie
   `completed`. **Zanim wstawisz cokolwiek do `initiatives`, odczytaj aktualną definicję
   constraintu z bazy** (`pg_get_constraintdef`) i użyj wartości, które przechodzą.
2. **`tasks` ma klucze obce** do `organizations`, `projects`, `users`
   (`000_initdb_core_tables.sql:226-230`) — seed musi je stworzyć w kolejności.
   `owner_id` i `sla_due_at` są dokładane później (`000_z_core_baseline.sql:367` —
   `sla_due_at` jest typu **`TEXT`**, nie timestamp; `A3` planu nazywa to „tekst legacy").

★ **`Z13`:** seed jest narzędziem dyżuru. Jeśli ma zostać w repo — do `scripts/dev/`
z jawną nazwą `day204-…`; jeśli nie — do `/private/tmp/cx-day204-migracja-e2-artefakty`. Rozstrzygnij i napisz który.

### R3b — przebieg

```
1. dry-run na całości              → zero zapisów (liczby przed/po)
2. --write bez --confirm-batch     → DOKŁADNIE 1 inicjatywa
3. ogląd: ledger + odczyt readerem + liczby
4. --write --confirm-batch --batch-size 2  → pozostałe 2 inicjatywy
5. ledger kompletny: total = MIGRATED + SKIPPED + FAILED, unmatched = 0
   (zapytania kontrolne z planu A4, sekcja „Rozliczenie")
6. odczyt agregatów przez postgresInitiativeReader.listExecutionTasks
7. replay CAŁOŚCI                  → 100% wyników = REPLAYED, checksumy identyczne
```

★ **Krok 6 ma pułapkę `T10`:** `listExecutionTasks` sortuje po
`(payload_json->>'dueAt')::timestamptz`. **Świadomie sprawdź, czy `dueAt`, które
wyprodukował Twój runner, przechodzi przez ten rzut** — jeden zły wiersz wywala
odczyt CAŁEJ sprawy. To dokładnie ta klasa błędu, która na stagingu wygląda jak
„migracja zepsuła Realizację".

### R3c — dwa dowody mutacyjne (obowiązkowe)

1. **Limiter:** usuń z runnera egzekwowanie limitu (kopia przez `cp` do `/private/tmp/cx-day204-migracja-e2-scratch`,
   mutacja, przebieg, przywrócenie przez `cp` — **`Z27`: żadnego `git stash`**) →
   test musi zrobić się czerwony. Bez tego „limit egzekwowany kodem" jest deklaracją.
2. **Naprawa do przodu:** zabij runner w środku łańcucha (po `k` poleceniach, `k`
   wybrane tak, żeby wypadło w środku budowy domu — nie po ostatnim kroku) → uruchom
   ponownie → **dokończenie bez duplikatów**: zero nowych agregatów o tych samych
   identyfikatorach, zero drugich wierszy w ledgerze, ponowione kroki jako `REPLAYED`.

---

# 4. TABELA LICENCJI PLIKOWYCH

Licencja obejmuje **całą ścieżkę**: skrypt · polecenia domenowe · unit of work ·
migracje · testy · dokumenty. Czego nie ma w tabeli — nie dotykasz.

| Zakres | Ścieżki |
|---|---|
| Zapis (NOWY PLIK) | **`server/scripts/legacy-task-cutover-runner.ts`** — jednorazowy runner przenosin; dry-run domyślnie, `requireConfirmation`, twardy limit 1 bez `--confirm-batch`, sufit `--batch-size` = 10 |
| Zapis (NOWY PLIK, WARUNKOWO) | **`server/migrations/20261722_<nazwa>.sql`** — TYLKO jeśli `R1a` wybrał wariant B albo `R2c` wybrał drogę (i). Czysto addytywna: `CREATE TABLE IF NOT EXISTS` + indeksy. **Zero `ALTER` na cudzych tabelach, zero `FOREIGN KEY`, zero odczytu cudzej kolumny.** Przedział `20261722`–`20261729` zarezerwowany dla tego dyżuru |
| Zapis (NOWY PLIK) | seed miniatury `M3` — `scripts/dev/day204-m3-shape-seed-local.mjs` **albo** `/private/tmp/cx-day204-migracja-e2-artefakty`; rozstrzygasz i uzasadniasz (`Z13`) |
| Zapis (NOWE PLIKI) | testy `day204.*` — `tests/integration/day204-legacy-task-cutover-runner.realdb.test.ts` i pochodne; `Z18` i `Z31` obowiązują; **nowe pliki w `tests/` wymagają `git add -f`** |
| Zapis (WĄSKA LICENCJA, WARUNKOWO) | `server/src/domain/initiatives-execution/materialCommand.ts` — **wyłącznie** ciało `materialCommandFingerprint` (`:329-345`) i **wyłącznie** jeśli `R1a` wybrał wariant A z policzonym promieniem wybuchu. Żadnej innej linii tego pliku |
| Zapis (WĄSKA LICENCJA, WARUNKOWO) | `server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork.ts` — **wyłącznie** metoda `claimRelation` (`:364-382`) i **wyłącznie** jeśli `R1b` krok 1 wykaże osiągalną kolizję. **`requireSingleRow` (`:19-21`) NIETYKALNY** — obchodzisz go lokalnie, nie zmieniasz globalnie |
| Zapis | `docs/program/funkcje/PLAN_MIGRACJI_TASKS_KANON.md` — WYŁĄCZNIE **dopisanie** rozdziału `A9. Wykonanie — etap 2 (Day204)` oraz **korekta** rozdziału `A4.0` o zmierzoną liczbę poleceń łańcucha. **Nie przepisujesz `A1`-`A8`**, nie zmieniasz werdyktu ani rekomendacji |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY204_MIGRACJA_E2_REPORT.md` |
| Odczyt (ZAKAZ ZAPISU) | `server/src/domain/initiatives-execution/executionWork.ts` — `ExecutionTask` (`:23-48`), `deriveTaskStatus` (`:118-123`), `caseAndRollup` (`:78-117`), `createExecutionTask` (`:124-185`), walidacja (`:139-148`), relacja (`:167-176`), nadpisanie `createdAt` (`:161-163`) |
| Odczyt (ZAKAZ ZAPISU) | `server/src/domain/initiatives-execution/handoffAcceptance.ts` — geneza `execution_case` (`:245-252`), `executionCaseId` jako wejście (`:70`, `:113-117`, `:123`) |
| Odczyt (ZAKAZ ZAPISU) | `server/src/domain/initiatives-execution/scheduleDecision.ts` — `sources()` (`:95-178`), trzy scenariusze (`:99-152`), `criticalCapacityReady` (`:82-90`), `requestScheduleDecision` (`:182-215`), `decideSchedule` (`:262-…`), `handoff_package` (`:372-379`) |
| Odczyt (ZAKAZ ZAPISU) | `server/src/domain/initiatives-execution/portfolioDecision.ts` — `requestPortfolioDecision` (`:43-130`), członkostwo w scenariuszu (`:238-248`), `APPROVED_BACKLOG` (`:239-240`) |
| Odczyt (ZAKAZ ZAPISU) | `server/src/domain/initiatives-execution/definitionDecision.ts` (`currentReadiness:70-108`, `:136-143`, `:277-278`), `analysisDecision.ts` (`:55-86`, `:88-167`, `:168-258`, `:245-246`), `definitionReadiness.ts` (`:18-26`), `analysisReadiness.ts` (`:3-31`) |
| Odczyt (ZAKAZ ZAPISU) | `server/src/domain/initiatives-execution/registerInitiative.ts` (`:80-140`), `submitSourceProposal.ts` (`:83-135`), `publishInitiativeCard.ts` (`:38-44`), `reviewInitiativeCard.ts` (`:28-33`), `portfolioScenario.ts` (`:79-…`, `:99`), `planScenario.ts` (`:111-…`, `:128`, `:139`), `capacityScenario.ts` (`:103-…`, `:123`, `:134`) |
| Odczyt | `server/src/domain/initiatives-execution/materialCommand.ts` — koperta, walidacja (`:296-317`), `canonicalJson` (`:319-327`), fingerprint (`:329-345`), replay i porównanie odcisku (`:467-494`), CAS (`:504-516`), cztery zapisy (`:518`, `:526`, `:539`, `:560`) |
| Odczyt | `server/src/domain/initiatives-execution/postgresInitiativeReader.ts` — `listExecutionTasks` (`:310`/`:316`), `findExecutionCase` (`:262`), `findExecutionCaseByInitiative` (`:283`), `listExecutionCases` (`:290`) |
| Odczyt | `server/migrations/932_initiatives_execution_material_commands.sql` — sześć tabel `ie_*`, PK/UNIQUE relacji (`:117-129`), `request_fingerprint` (`:76`) |
| Odczyt | `server/migrations/20261721_legacy_task_cutover_ledger.sql` — **kształt ledgera jest USTALONY w 197, nie zmieniasz go** |
| Odczyt | `server/migrations/000_initdb_core_tables.sql` (`tasks:198-231`), `000_z_core_baseline.sql` (`:367` — `sla_due_at TEXT`) — kształt legacy pod seed |
| Odczyt | `server/scripts/lib/scriptDatabaseTarget.ts` (`requireConfirmation:104-113`, `logSelectedDatabaseTarget:92-102`), `server/scripts/backfill-initiative-project.ts`, `server/scripts/reassign-finance-org-to-primary.ts` — wzorce runnera; **nie zmieniasz** |
| Odczyt | `server/scripts/migrationOrdering.ts` (`DATED_RE:26`), `server/scripts/migrate.postgres.ts`, `server/scripts/validate-migration-naming.ts` (`VALID_DATE_GENERIC:36`, `process.exit:144`) — **nie zmieniasz ani jednego** |
| Odczyt | `scripts/dev/day161-fresh-migration-check.sh` — bramka; uruchamiasz, **nie edytujesz** |
| Odczyt | `scripts/dev/case-workspace-seed-local.mjs` — wzorzec bariery loopback (`:40-51`); **nie zmieniasz** |
| Odczyt | `tests/integration/_helpers/assertRealPostgres.ts` — `Z18`: **NIETYKALNY** |
| Odczyt | `tests/integration/day197-legacy-task-cutover.realdb.test.ts` — test z 197; **czytasz, nie kasujesz**; asercje wolno ZMIENIĆ z uzasadnieniem, nie skasować |
| Odczyt | `docs/program/funkcje/PLAN_MIGRACJI_TASKS_KANON.md` (całość), `ODBIOR_197_MIGRACJA_E1.md`, `CODEX_DAY197_MIGRACJA_E1_REPORT.md` (sekcja `M3`), `DECYZJE_WLASCICIELA_2026-08-30_WIECZOR.md` (`D-12` `:38`, `D-13` `:39`) |

**Nietykalne imiennie:** brama `409` i wszystkie jej montaże
(`server/src/routes/pmo/tasks.routes.ts:67`, `Gateway.ts`, `server/src/routes/v8/index.ts`,
`pmo/initiatives.routes.ts`, `executionSpineLegacyReadOnly.middleware.ts`,
każdy `requireCanonicalExecutionWriter` / `requireCanonicalInitiativeExecutionWriter`);
wszystkie mutujące trasy `pmo/tasks.routes.ts`; `TaskController.ts` i cała warstwa
legacy `tasks`; `POST /api/my-work/personal-tasks` (`my-work.routes.ts:1283`, `:1379`)
— **luki nie domykasz, to analiza `A5`, nie decyzja**; `server/src/services/aiRoleGuard.ts`,
`chatPermissionService.ts`, `routes/auth*.ts`, `services/betaAccess*`;
scheduler i `aiWorker`; `server/migrations/20261721_legacy_task_cutover_ledger.sql`;
`tests/setup.ts`, `tests/helpers/**`, każdy `vitest*.config.ts`.

**Rozłączność:** ten dyżur dotyka jednego NOWEGO skryptu, co najwyżej jednej NOWEJ
migracji w zarezerwowanym przedziale `20261722`–`20261729`, nowych testów, jednego
seeda, jednego rozdziału planu i raportu — plus co najwyżej **dwóch wąskich,
warunkowych** zmian w plikach domeny. Przed pierwszym commitem sprawdź `git log`
gałęzi bazowej: jeśli dyżur równoległy wziął numer z przedziału `20261722`–`20261729`,
**zgłoś kolizję zasobową ZANIM zaczniesz pisać**, nie po.

# 5. TWARDE ZASADY

- ★★ **ŻELAZNA KOLEJNOŚĆ `R1 → R2 → R3`, dowodzona kolejnością commitów.** Miny
  zmierzone i rozbrojone PRZED runnerem. Runner napisany przed pomiarem min = odrzucenie
  pozycji, nawet gdyby działał.
- ★★ **`Z28` — ZERO POŁĄCZEŃ ZDALNYCH.** Do bazy demo, stagingu, produkcji, w każdą
  stronę, każdym narzędziem. **Pilot na stagingu wykonuje NADZORCA po scaleniu, nie Ty.**
  Zdanie „na stagingu pewnie zachowa się tak samo" jest ekstrapolacją i jest zakazane —
  liczby z `M3` cytujesz jako **cudzy pomiar z 31.08**, nie jako swój.
- ★★ **BRAMA `409` ZOSTAJE.** Nie zdejmujesz, nie osłabiasz, nie dodajesz wyjątku,
  nie odmontowujesz żadnego middleware (`Z12`, `Z19`; plan `A5`: „Nie zdejmować").
- ★★ **ZERO NOWYCH MIGRACJI SQL** — z jednym wyjątkiem opisanym w `R1a`/`R2c`
  (`20261722`–`20261729`). Jeśli bierzesz ten wyjątek: migracja **czysto addytywna**,
  **pełny przebieg od pustej bazy** i **bramka `day161`** są obowiązkowe, a nie opcjonalne.
  Migracja czytająca kolumnę dodawaną później w kolejności sortowania wywraca cały
  łańcuch na bazie od zera — to udokumentowana klasa błędu w tym programie.
  **Sufiks literowy po dacie (`20261722a_…`) jest ZAKAZANY** — łamie `DATED_RE`
  (`migrationOrdering.ts:26`) i kończy się `UnclassifiedMigrationFilenameError`.
- ★★ **KSZTAŁT LEDGERA Z 197 JEST NIETYKALNY.** Nie zmieniasz `20261721_…`, nie robisz
  na nim `ALTER`, nie poszerzasz `CHECK`. Jeśli brakuje Ci miejsca — nowa tabela, nie
  przeróbka starej.
- ★★ **SCHEDULER I `aiWorker` NIETYKALNE.** Runner nie planuje się sam, nie wpina się
  w kolejkę i nie zostawia po sobie zadania okresowego.
- ★★ **`Z31` — ZAKAZ PINOWANIA STRAŻNIKA REALDB DO HOSTA, PORTU ALBO NAZWY BAZY.**
  `await assertRealPostgresTestEnvironment()` **BEZ ARGUMENTÓW**, w szczególności bez
  `expectedDatabase`; zakaz asercji na `DATABASE_URL`, na porcie i na nazwie kontenera.
  Powód dosłowny: dyżur 43 przypiął strażnika do swojej bazy i po usunięciu kontenera
  **30 przypadków dowodowych stało się trwałym `SKIP` przy `exit 0`**. W programie
  odnotowano **sześć** takich incydentów; dyżur 193 zamówiono wyłącznie po to, żeby je
  zbiorczo odpiąć. **Nie dokładaj siódmego.**
- ★★ **`Z27` — ZAKAZ `git stash`** w każdej postaci (`stash`, `stash -u`, `stash pop`,
  `stash apply`). Dowody mutacyjne robisz przez `cp` do `/private/tmp/cx-day204-migracja-e2-scratch` i powrót przez `cp`.
  Schowek jest współdzielony między wszystkimi worktree tego repozytorium.
- ★★ **`Z15` — zero modelu językowego.** Ten dyżur nie ma licencji na żaden klucz
  dostawcy; żaden pomiar, seed, runner ani test nie woła `llmService`, `/api/ai/**`
  ani `GoogleGenerativeAI`.
- ★★ **`Z29` — dowód mutacyjny w OBIE strony.** „Test zielony" nie jest dowodem naprawy.
  Dowodem jest: czerwony przed → zielony po → **czerwony ponownie po odwróceniu naprawy**.
  Dotyczy `R1a`, `R1b`, limitera (`R3c.1`) i naprawy do przodu (`R3c.2`).
- ★★ **Zakaz naprawiania przez wyciszanie** (`@ts-ignore`, `.skip`, poszerzanie
  `exclude`, `--no-verify`) i zakaz usuwania zastanych testów. Asercje wolno **ZMIENIĆ
  z uzasadnieniem**, nie skasować.
- ★ **Sprzątanie kontenera: `docker rm -f -v`** — z flagą `-v`, inaczej wolumen zostaje
  na dysku. Dotyczy też kontenera bramki `day161`, choć ona sprząta po sobie sama.
- ★ **Bramka `day161` bierze WŁASNY kontener i WŁASNY port** (domyślnie `cx-day161-pg`
  na `6049`), odmawia adopcji istniejącego kontenera i zajętego portu. Masz wg `Z7`
  **dokładnie jeden** port bazy — `6144`. **Nie bierzesz drugiego**: usuwasz swój
  kontener na czas bramki i odtwarzasz go po niej. Sekwencja niżej, w komendach wejściowych.
- ★ **`DAY161_FRESH_MIGRATION_GATE=PASS` nie pojawi się w ŻADNYM logu** — jest echowane
  na stdout po ostatnim `tee` (`day161-fresh-migration-check.sh:55`). Łapiesz go
  z wyjścia procesu i piszesz w raporcie, skąd go wziąłeś.
- ★ **„Walidator nazw migracji przeszedł" znaczy: mój plik pasuje do regexa i liczba
  błędów NIE WZROSŁA.** Nie znaczy `exit 0` — walidator ma dziś **92 zastane problemy**
  (liczba z raportu 197; **zmierz ją sam przed i po**, nie przepisuj mojej).
- ★ **`Z13`: logi, `.sql` pomiarowe, wyjścia bramki, dzienniki przebiegu runnera
  i zrzuty NIE wchodzą do repo.** Leżą w `/private/tmp/cx-day204-migracja-e2-artefakty`, a raport podaje ścieżki
  i `shasum -a 256`.
- ★ **Zrzuty ekranu: ten dyżur ich nie ma** (zero powierzchni wizualnej, `src/` nietknięte).
  Jeśli jakikolwiek zrzut mimo to powstanie — obowiązuje pomiar `mean_luma` przy nim,
  bez wyjątku.
- ★ **`§0.4a` — pomiar zasięgu testów jest warunkiem oddania raportu** (`Z24`). Zawężony
  wybór albo **przepisanie cudzej liczby** = zawyżenie i podstawa odrzucenia.
- **Pułapka:** bez `RUN_DB_TESTS=1` testy backendowe idą na MOCK DB. Pułapka:
  `No test files found` **nie jest** `PASS` — sprawdź `numTotalTests > 0`. Pułapka:
  `npx vitest run` bywa kończy się `exit 0` mimo czerwonych testów — liczby **i nazwy**
  czytasz z JSON-a (`Z37`, `§0.4a`). Pułapka: `DB_TYPE` bywa przybity w configu —
  sprawdź, co realnie widzi proces.
- ★ Port **5000 zajęty na stałe** przez macOS Control Center; port **5037** zajęty
  przez `adb`; porty **5060-5061** zajęte. Nie używaj żadnego z nich.
- ★★ **Sekcja „TWIERDZENIA NIEZWERYFIKOWANE" w raporcie jest OBOWIĄZKOWA.** Wypisz
  w niej wprost co najmniej:
  1. że pilot na stagingu **nie został przez Ciebie wykonany** i dlaczego (`Z28`, `D-13`);
  2. czy liczba paragonów unieważnianych przez wariant A (`R1a`) pochodzi z pomiaru,
     czy z oszacowania — i czy zmierzyłeś ją TYLKO lokalnie;
  3. czy kolizja PK relacji (`R1b`) została **odtworzona**, czy tylko **zacytowana**
     z odbioru 197 — a jeśli okazała się nieosiągalna, to na której ścieżce sprawdzałeś;
  4. zmierzone `N` poleceń łańcucha vs „≥16" z karty — i czy `N` jest **kompletne**,
     czy jest kolejną podłogą;
  5. czy `dueAt` wyprodukowany przez runner przeszedł przez `::timestamptz`
     w **realnym** odczycie `listExecutionTasks`, czy tylko przez `Date.parse`;
  6. czy aktor migracji jest kontem systemowym (**nie jest** — decyzja właściciela
     wciąż otwarta z 197) i jak rozwiązałeś wymóg niezależnego autorytetu;
  7. czy zadania osobiste na pewno zostają w legacy (plan `A5` wariant (ii)) — to jest
     **rekomendacja planu, nie zatwierdzona decyzja właściciela**;
  8. czy test `day160` nadal jest przypięty do bazy `cx160` (`Z31`) — **nie naprawiasz
     go w tym dyżurze**, tylko odnotowujesz stan.
  **Brak takiej sekcji jest podstawą odrzucenia dyżuru.**
