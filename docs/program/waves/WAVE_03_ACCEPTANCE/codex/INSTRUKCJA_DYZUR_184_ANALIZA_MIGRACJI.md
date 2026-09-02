# INSTRUKCJA DYŻURU nr 184 — Codex — „ANALIZA (bez migracji): inwentarz magazynu legacy `tasks` i kanonu `ie_aggregate_state`, mapowanie pol, projekt migracji addytywnej, los bramy 409 i plan odwrotu"

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
> **wyłącznie** `/private/tmp/cx-day184-analiza-migracji`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `18661cc6a0`**
> **Gałąź bazowa: `github-backup/codex/m03-admin-20260824`**
> **Stan dokumentu: WYDANY**
>
> Jeżeli w polu „Stan dokumentu" widzisz `WYDANY` — możesz zaczynać.
> Jeżeli widzisz `PROJEKT` albo jakiekolwiek niewypelnione pole szablonu — **dokument nie
> jest wydany, nie zaczynasz i zgłaszasz to nadzorcy**.
> Ta ramka jest **jedynym** miejscem, w którym rozstrzyga się stan wydania.
> Objaśnienia w innych blokach cytowanych **nie** są powodem do STOP-u.

Data wystawienia: 2026-08-30.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.
Zakres: **Realizacja — magazyn zadan. Dyzur ANALITYCZNY wykonujacy pierwsza polowe decyzji wlasciciela D-7 (migracja legacy→kanon w MVP): najpierw analiza, potem osobny dyzur wykonania. ★ ZERO ZMIAN KODU PRODUKTU**.
Trasy front: `brak zmian. Odczyt kontekstowy (nie zmieniasz, wymieniasz w dokumencie jako zaleznosc): `src/components/Initiatives/InitiativeTasksTab.tsx` (~:64 — `console.error` bez komunikatu przy 409), `src/components/dashboard/UserTaskList.tsx` (~:49 — okno znika bez slowa), `src/hooks/useActionHandler.ts` (~:428 — jedyna uczciwa obsluga). Cztery ciche powierzchnie z odbioru 160 — inwentarz, NIE naprawa`. Trasy tył: `LEGACY: `POST|PUT|DELETE /api/tasks` oraz `/api/pmo/tasks` (`server/src/routes/pmo/tasks.routes.ts`, montowany w `server/src/Gateway.ts:903` i `:1150`) -> brama `requireCanonicalExecutionWriter` (`tasks.routes.ts:67`; `server/src/middleware/executionSpineLegacyReadOnly.middleware.ts:22-44`) -> **409 `EXECUTION_RUNTIME_V1_WRITE_REQUIRED`**; pozostale punkty montazu: `Gateway.ts:1389` (`/api/execution-control`), `Gateway.ts:1454` (`/api/v8/execution-control/manager`), `server/src/routes/v8/index.ts:107`, wariant waski `server/src/routes/pmo/initiatives.routes.ts:160`. Sciezki POZA brama (do policzenia): m.in. `POST /api/my-work/personal-tasks` (odbior 160: **201**, wiersz utworzony). KANON: `POST /execution-cases/:executionCaseId/tasks/:taskId` na routerze runtime-v1 (`server/src/routes/pmo/initiativesExecutionRuntime.routes.ts:4157-4194`, `canonicalWriter: '/api/initiatives/runtime-v1'`) -> `createExecutionTask` (`server/src/domain/initiatives-execution/executionWork.ts:124-...`) -> `executeMaterialCommand` (`materialCommand.ts:457`, koperta `:3-16`) -> `postgresMaterialCommandUnitOfWork.ts:287,295` -> tabele `ie_aggregate_state`, `ie_command_receipts`, `ie_audit_events`, `ie_outbox_events`, `ie_aggregate_relations` (`server/migrations/932_initiatives_execution_material_commands.sql:33,68,82,99,117`). Czytelnicy kanonu: `postgresInitiativeReader.ts` (m.in. `:436-466`), `server/src/services/executionControl/**`, `server/src/services/executionBvpService.ts`. Migracje legacy: `000_initdb_core_tables.sql:198` + kilkanascie ALTER-ow, ostatni `20260830_day175_task_risk_alternatives.sql:3-4``.

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
WT=/private/tmp/cx-day184-analiza-migracji
MARKER=18661cc6a0

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/codex/m03-admin-20260824
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/codex/m03-admin-20260824 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day184-analiza-migracji-20260830 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day184-analiza-migracji/config.worktree"
cat "$VAULT/worktrees/cx-day184-analiza-migracji/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day184-analiza-migracji-scratch
mkdir -p /private/tmp/cx-day184-analiza-migracji-artefakty

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
git -C "$VAULT" log --oneline 18661cc6a0..github-backup/codex/m03-admin-20260824
git -C "$VAULT" diff --name-only 18661cc6a0..github-backup/codex/m03-admin-20260824
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day184-analiza-migracji-20260830
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only 18661cc6a0..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `dziewiec` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd /private/tmp/cx-day184-analiza-migracji

# (T1) SCIEZKI ZE ZLECENIA SA BLEDNE — SPRAWDZ, ZANIM ZACZNIESZ CZYTAC
ls -l server/src/repositories/postgresMaterialCommandUnitOfWork.ts 2>&1 | tail -1
ls -l server/src/repositories/postgresInitiativeReader.ts 2>&1 | tail -1
ls -l server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork.ts
ls -l server/src/domain/initiatives-execution/postgresInitiativeReader.ts
#   oczekiwane: DWIE PIERWSZE komendy = "No such file or directory". Oba pliki leza
#   w `server/src/domain/initiatives-execution/`. ★ Wpisz te korekte do dokumentu.

# (T2) DWA ROZNE TYPY AGREGATU: 'task' I 'execution_task'
sed -n '93,105p'  server/src/domain/initiatives-execution/postgresInitiativeReader.ts
sed -n '436,456p' server/src/domain/initiatives-execution/postgresInitiativeReader.ts
grep -n "aggregate_type = 'task'\|aggregate_type='task'" server/src/domain/initiatives-execution/postgresInitiativeReader.ts
#   oczekiwane: `:94` to NIE zapytanie, tylko pole `aggregateType: 'task' | 'decision'`
#   w interfejsie `PendingDefinitionRemediationReadModel`; zapytanie o `execution_task`
#   jest w `listMyExecutionWork` (`:436-466`, SQL w `:443`); a `aggregate_type = 'task'`
#   to praca NAPRAWCZA filtrowana po `payload_json->>'workType'`.
#   ★ To sa DWA ROZNE typy. Pomylenie ich zatruje cale mapowanie.

# (T3) "22 OPERACJI" NIE ISTNIEJE W KODZIE — PRZELICZ SAM
grep -cE "^router\.(post|put|patch|delete)\(" server/src/routes/pmo/tasks.routes.ts
grep -rn "INSERT INTO tasks" --include='*.ts' server/src/ | grep -v '/dist/' | grep -v '_backup' | wc -l
grep -rn "INSERT INTO tasks\|UPDATE tasks\|DELETE FROM tasks" --include='*.ts' server/src/ | grep -v '/dist/' | grep -v '_backup' | cut -d: -f1 | sort -u | wc -l
#   oczekiwane: tras mutujacych **24** (odbior 160 liczyl 23 — dyzur 175 dolozyl
#   `PUT /:id/risk-alternatives` w `:1339`); liczba plikow-pisarzy do porownania
#   z "22 plikami" z odbioru 160. ★ Liczba "22 operacji" ze zlecenia NIE JEST
#   artefaktem kodu — podaj wlasny pomiar i roznice wobec odbioru 160.

# (T4) KANON TO PIEC TABEL, NIE JEDNA — I MA TWARDA INWARIANTE
sed -n '1,10p'    server/migrations/932_initiatives_execution_material_commands.sql
grep -n "CREATE TABLE IF NOT EXISTS ie_" server/migrations/932_initiatives_execution_material_commands.sql
sed -n '33,41p'   server/migrations/932_initiatives_execution_material_commands.sql
sed -n '82,115p'  server/migrations/932_initiatives_execution_material_commands.sql
#   oczekiwane: naglowek `:2-3` — "Every material write commits aggregate state, audit,
#   outbox and its idempotency receipt in one transaction"; piec tabel:
#   `ie_aggregate_state` (:33), `ie_command_receipts` (:68), `ie_audit_events` (:82),
#   `ie_outbox_events` (:99), `ie_aggregate_relations` (:117); audyt i outbox maja
#   `UNIQUE (organization_id, aggregate_type, aggregate_id, aggregate_version)`.
#   ★ Migracja piszaca TYLKO do `ie_aggregate_state` lamie te inwariante — i te same
#   UNIQUE decyduja o tym, czy plan odwrotu jest w ogole wykonalny.

# (T5) UTWORZENIE ZADANIA KANONICZNEGO PODBIJA WERSJE SPRAWY
sed -n '23,47p'   server/src/domain/initiatives-execution/executionWork.ts
sed -n '78,115p'  server/src/domain/initiatives-execution/executionWork.ts
sed -n '124,170p' server/src/domain/initiatives-execution/executionWork.ts
sed -n '3,16p'    server/src/domain/initiatives-execution/materialCommand.ts
#   oczekiwane: `interface ExecutionTask` (:23-47) — pelny kształt payloadu;
#   `caseAndRollup` (:78-115) ZADA agregatu `execution_case` w stanie 'ACTIVE'
#   o DOKLADNEJ wersji i PODBIJA ja o jeden; `createExecutionTask` (:124-...) wymaga
#   `executionCaseId`, `initiativeId`, niepustego `title`, `assigneeId`, `ownerId`
#   oraz parsowalnych `dueAt` i `slaAt`; koperta `MaterialCommandEnvelope` (:3-16)
#   wymaga `actorId`, `clientRequestId`, `correlationId`, `policyId`, `policyVersion`.
#   ★ Wniosek: "migracja addytywna, ktora nie nadpisuje istniejacych agregatow" jest
#   w literalnym brzmieniu NIEWYKONALNA — agregat sprawy JEST modyfikowany.

# (T6) ILU JEST PISARZY KANONU, A ILU LEGACY
grep -rn "INSERT INTO ie_aggregate_state\|UPDATE ie_aggregate_state" --include='*.ts' server/src/ | grep -v '/dist/' | grep -v '__tests__'
sed -n '278,300p' server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork.ts
#   oczekiwane: w sciezce produkcyjnej DOKLADNIE JEDEN plik —
#   `postgresMaterialCommandUnitOfWork.ts:287` (UPDATE z CAS po `version`) i `:295`
#   (INSERT z `ON CONFLICT ... DO NOTHING`). Wszyscy inni pisarze to testy.
#   Porownaj z liczba pisarzy `tasks` z komendy (T3).

# (T7) BRAMA 409 NIE MA ZADNEJ FLAGI — DECYDUJE METODA I MONTAZ
sed -n '1,44p'   server/src/middleware/executionSpineLegacyReadOnly.middleware.ts
grep -n "requireCanonicalExecutionWriter" server/src/Gateway.ts server/src/routes/v8/index.ts server/src/routes/pmo/tasks.routes.ts
grep -n "app.use('/api/tasks'\|app.use('/api/pmo/tasks'" server/src/Gateway.ts
grep -rn "process.env" server/src/middleware/executionSpineLegacyReadOnly.middleware.ts || echo "ZERO zmiennych srodowiskowych w bramie — brama jest BEZWARUNKOWA"
#   oczekiwane: kod `EXECUTION_RUNTIME_V1_WRITE_REQUIRED` (:3); przepuszczane
#   GET/HEAD/OPTIONS (:5); JEDYNY wyjatek `DELETE /budget/entries/:id` (:6-12);
#   montaz w `tasks.routes.ts:67`, a ten router na DWOCH sciezkach
#   (`Gateway.ts:903` i `:1150`), plus `/api/execution-control` (`Gateway.ts:1389`),
#   `/api/v8/execution-control/manager` (`:1454`) i `routes/v8/index.ts:107`;
#   wariant waski dla inicjatyw w `routes/pmo/initiatives.routes.ts:160`.
#   ★ ZERO `process.env` — nie ma zadnego przelacznika legacy/kanon dla zadan.

# (T8) KOLUMNY DYZURU 175 I PULAPKA `never-ran/`
cat server/migrations/20260830_day175_task_risk_alternatives.sql
grep -rln "ALTER TABLE tasks ADD COLUMN" server/migrations/ | sort
grep -rln "ALTER TABLE tasks ADD COLUMN" server/migrations/never-ran/ | sort
#   oczekiwane: `risks JSONB` i `alternatives JSONB` dodane addytywnie i idempotentnie;
#   lista plikow dokladajacych kolumny do `tasks` — ★ z ktorych czesc lezy
#   w `never-ran/` i NIGDY NIE POBIEGLA. Sprawdzianem rozstrzygajacym jest
#   `information_schema.columns` na TWOJEJ bazie po migracji od zera, nie suma plikow.

# (T9) SEED: KTORY WOLNO, A KTORY MA CUDZEGO STRAZNIKA
sed -n '40,52p' scripts/dev/case-workspace-seed-local.mjs
sed -n '55,68p' scripts/dev/seed-wave3-execution-owner-review.mjs
#   oczekiwane: `case-workspace-seed-local.mjs` ma JEDYNA bariere — host loopback —
#   wiec zadziala na Twojej bazie; `seed-wave3-execution-owner-review.mjs` WYMAGA
#   nazwy bazy pasujacej do `^consultify_w3_execution_owner_[a-z0-9_]+$` oraz
#   `EXE_OWNER_FIXTURE_CONFIRM=YES`. ★ To cudzy straznik — NIE zmieniasz go
#   i NIE nazywasz swojej bazy pod niego.
```

---

### 0.2. Bezwzględne ZAKAZY — `Z1`–`Z40`

| # | Zakaz | Dlaczego (incydent) |
| --- | --- | --- |
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day184-analiza-migracji-20260830` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6093`. Twój JEDYNY port harnessu to `5038 i 5039`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day184-pg`**. **ZAKAZANE:** `6012, 5433, 6047, 6054-6067, 6068-6088 oraz 5010-5029 (dyzury 170-179 wraz z odbiorami i FIX-ami), 6404-6408 (Redis dyzurow agenta, w tym 6408 = dyzur 180), 6089 i 5030-5031 (dyzur 180), 6090-6092 i 5032-5037 (rownolegla partia 181-183), 6094-6096 i 5040-5045 (rownolegla partia 185-187). Ten dyzur NIE POTRZEBUJE Redisa — jesli uznasz, ze potrzebuje, to znak, ze wyszedles poza zakres. ★ PORT 5000 ZAJETY NA STALE przez macOS Control Center`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `Brak. Ten dyzur nie dodaje, nie usuwa i nie zmienia zadnej flagi ani zmiennej srodowiskowej — ma licencje zapisu wylacznie na dwa pliki `.md`. ★ Jesli w dokumencie PROPONUJESZ flage dla przyszlego dyzuru wykonania, opisz ja jako propozycje z bezpieczna wartoscia domyslna i zaznacz, ze NIE zostala wprowadzona`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``server/src/middleware/**` (w szczegolnosci `executionSpineLegacyReadOnly.middleware.ts` — przedmiot analizy, NIE zmian), `server/src/services/ai/aiRoleGuard.ts`, `server/src/services/chatPermissionService.ts`, `server/src/routes/auth*.ts`, wszystko pod `server/src/services/betaAccess*``. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY184_ANALIZA_MIGRACJI_REPORT.md`. Nie zmieniasz zadnego `MODULE_ACCEPTANCE.md`. Jedyny dokument produktowy, jaki tworzysz, to `docs/program/funkcje/PLAN_MIGRACJI_TASKS_KANON.md`. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day184-analiza-migracji-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
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
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day184-analiza-migracji-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
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
| `Z40` | ★★ **ZERO ZMIAN KODU PRODUKTU.** Licencja zapisu obejmuje DWA pliki `.md` (dokument planu + raport) i nic wiecej. Zadnej nowej migracji SQL, zadnej zmiany w istniejacych migracjach, zadnej zmiany w bramie, zadnego 'przy okazji' w pisarzach `tasks`, zadnej naprawy czterech cichych powierzchni obslugi 409 z odbioru 160. Wszystko, co uznasz za wymagajace naprawy, idzie do dokumentu jako **zalecenie** — to jest cala wartosc dyzuru analitycznego. ★★ **NIE MIGRUJESZ DANYCH** — nawet na wlasnej bazie, nawet 'na probe'. Jesli chcesz sprawdzic wykonalnosc, opisz eksperyment w dokumencie razem z tym, czego NIE sprawdziles. ★★ **NIE ZDEJMUJESZ ANI NIE ZAWEZASZ BRAMY 409** — wlasciciel zdecydowal, ze zostaje **do konca migracji** (D-7). Dokument moze zaproponowac, kiedy i jak ja zdjac; dyzur tego nie robi. ★★ **NIE ZMIENIASZ SKRYPTOW SEEDUJACYCH ANI NIE OBCHODZISZ CUDZYCH STRAZNIKOW.** `scripts/dev/seed-wave3-execution-owner-review.mjs` odmawia startu poza baza `^consultify_w3_execution_owner_[a-z0-9_]+$` z `EXE_OWNER_FIXTURE_CONFIRM=YES` — to nie jest blad do obejscia; uzywasz `scripts/dev/case-workspace-seed-local.mjs`, ktorego jedyna bariera jest host loopback. ★★ **NIE PRZEPISUJESZ LICZB Z ODBIORU 160** ('22 pliki', '23 trasy', '28→26 INSERT-ow') — to pomiar sprzed dyzurow 161-179. Przelicz i podaj roznice. ★★ **NIE LICZYSZ `server/src/_backup/**` DO INWENTARZA PRODUKTU** — to kod martwy; wymien go osobno. Tak samo odrozniaj `server/migrations/never-ran/` od migracji, ktore realnie pobiegly. ★★ **`Z31`: ZAKAZ PRZYPINANIA CZEGOKOLWIEK DO NAZWY BAZY, PORTU ALBO HOSTA** — w kodzie testu, w skrypcie pomiarowym i w komendach wklejanych do dokumentu; `assertRealPostgresTestEnvironment()` wolasz BEZ ARGUMENTOW. Czwarty incydent w programie. ★★ **ZAKAZ `git stash`.** **Zero polaczen do bazy zdalnej, demo, stagingu i produkcji** — wszystko na lokalnym kontenerze `cx-day184-pg` (port 6093). Produkcja `consultify.ai` jest nietykalna, dane demo sa twarza produktu. Sprzatasz po sobie: kontener zatrzymany i usuniety. | Wlasciciel podjal 30.08 decyzje **D-7** (`docs/program/funkcje/DECYZJE_WLASCICIELA_2026-08-30_WIECZOR.md`): **MIGRACJA legacy→kanon W MVP** — najdrozsza z rozwazanych opcji, wybrana swiadomie — ze skutkiem operacyjnym: *najpierw dyzur ANALIZY (inwentarz danych `tasks` vs `ie_aggregate_state`, plan migracji addytywnej, ryzyka), potem dyzur wykonania; brama 409 zostaje do konca migracji*. To jest ten dyzur analizy. Podstawe do decyzji dal dyzur 160 (`ODBIOR_160_BRAMA_ZADANIA.md`), ktory zmierzyl brame end-to-end: `POST/PUT/DELETE /api/tasks` = **409 `EXECUTION_RUNTIME_V1_WRITE_REQUIRED`**, stan tabeli niezmieniony, dowod przeszedl niezalezna mutacje — i policzyl inwentarz pisarzy (wtedy: 22 pliki, 23 trasy mutujace). Pilnosc dolozyl dyzur 175 (`ODBIOR_175_KARTA_BEZ_REGRESJI.md`, pozycja Z-2): karta zadania **NADAL gubi ryzyka po zamknieciu**, bo jedyny pisarz `tasks.risks/alternatives` stoi za brama — i odbior konczy sie zdaniem: *dyzur analizy migracji MUSI objac te kolumny*. Czyli produkt ma dzis kolumny, ktorych nie da sie zapisac, i kanon, ktory nie ma dla nich miejsca. Ten dyzur ma to policzyc i zaprojektowac wyjscie — albo uczciwie pokazac, gdzie wyjscia bez decyzji wlasciciela nie ma |

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
cd /private/tmp/cx-day184-analiza-migracji

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day184-pg psql -U postgres -d cx184 \
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
cd /private/tmp/cx-day184-analiza-migracji

docker run -d --name cx-day184-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx184 \
  -p 127.0.0.1:6093:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day184-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6093/cx184 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6093/cx184 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day184-analiza-migracji && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6093/cx184 \
JWT_SECRET=cx184-test-secret-do-not-reuse \
npx vitest run server/src/routes/__tests__ oraz server/src/routes/pmo/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day184-analiza-migracji-artefakty/day184-vitest.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day184-analiza-migracji && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run server/src/routes/__tests__ oraz server/src/routes/pmo/__tests__ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day184-analiza-migracji-artefakty/day184-vitest.json
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
   **musisz** utworzyć `<vault>/worktrees/cx-day184-analiza-migracji/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day184-pg psql -U postgres -d cx184 -c '…'`.
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
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day184-pg`.
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
> **(e) ★★ **Pierwsza, i uderza od razu: DWIE Z TRZECH SCIEZEK PODANYCH W ZLECENIU NIE ISTNIEJA.** `server/src/repositories/postgresMaterialCommandUnitOfWork.ts` i `server/src/repositories/postgresInitiativeReader.ts` nie ma; oba pliki leza w **`server/src/domain/initiatives-execution/`**. W `server/src/repositories/` sa INNE pliki (m.in. `ManagementReportRepository.ts`, ktory czyta `tasks`) — nie pomyl ich z warstwa domenowa. Wpisz korekte do dokumentu. ★★ **Druga: `'task'` to NIE JEST `'execution_task'`.** Adres `postgresInitiativeReader.ts:94` ze zlecenia nie jest zapytaniem — to pole `aggregateType: 'task' | 'decision'` w interfejsie `PendingDefinitionRemediationReadModel`. Typ `'task'` niesie **prace naprawcza po bramce Definition**, filtrowana po `payload_json->>'workType' = 'FINANCE_EVIDENCE'`; zadania wykonawcze to `'execution_task'` (SQL w `:443`, wewnatrz `listMyExecutionWork` `:436-466`). Zmapowanie legacy `tasks` na zly typ agregatu byloby bledem, ktorego nikt by nie zauwazyl az do produkcji. ★★ **Trzecia: '22 operacje objete brama' nie istnieja jako artefakt kodu.** Liczba 22 pochodzi z odbioru 160 i oznacza **22 PLIKI piszace do `tasks`**; tras mutujacych bylo wtedy 23, a dzis jest **24** (dyzur 175 dolozyl `PUT /:id/risk-alternatives`, `tasks.routes.ts:1339`). Odbior 160 sam sprostowal blad redakcyjny w tym miejscu ('23 pliki' zamiast 22). **Przelicz oba inwentarze i podaj roznice** — przepisanie liczby ze starego odbioru bedzie odrzucone. ★★ **Czwarta: kanon to PIEC tabel, nie jedna, i ma twarda inwariante.** Naglowek `932_initiatives_execution_material_commands.sql:2-3` mowi: *kazdy zapis materialny commituje stan agregatu, audyt, outbox i pokwitowanie idempotencji w JEDNEJ transakcji*. Migracja piszaca surowym SQL tylko do `ie_aggregate_state` wyprodukuje **dane, ktore wygladaja kanonicznie, a nie przeszly przez kanon** — bez audytu, bez outboxu, bez pokwitowania. To jest glowna decyzja projektowa dokumentu, nie detal. ★★ **Piata, najciezsza: 'migracja addytywna, ktora nie nadpisuje istniejacych agregatow' jest w literalnym brzmieniu NIEWYKONALNA.** `createExecutionTask` wola `caseAndRollup` (`executionWork.ts:78-115`), ktore **zada** agregatu `execution_case` w stanie `ACTIVE` o **DOKLADNEJ** oczekiwanej wersji i **podbija ja o jeden** (`persistRelatedAggregate(..., expectedCaseVersion, expectedCaseVersion + 1, ...)`). Czyli kazde przeniesione zadanie MODYFIKUJE agregat sprawy, a przenoszenie musi byc **szeregowe per sprawa** i odporne na przerwanie w polowie. Nazwij to i przeprojektuj wokol tego caly rozdzial A4. ★★ **Szosta: czesc zadan legacy NIE MA KANONICZNEGO DOMU.** `createExecutionTask` wymaga `executionCaseId`, `initiativeId`, niepustego `title`, `assigneeId`, `ownerId` oraz parsowalnych `dueAt` I `slaAt` (`executionWork.ts:138-149`). W legacy `initiative_id` jest **nullowalne**, a `task_type='personal'` oznacza zadanie osobiste bez inicjatywy. Zmierz, ilu wierszy to dotyczy, i rozstrzygnij zakres migracji pomiarem, nie wygoda. ★★ **Siodma: idempotencja ma gotowy ksztalt, tylko trzeba go wybrac.** `ie_command_receipts` ma `PRIMARY KEY (organization_id, client_request_id)`, a `executeMaterialCommand:469-495` przy trafieniu w istniejace pokwitowanie zwraca **`REPLAYED`** zamiast pisac drugi raz — ale **rzuca konflikt**, gdy `commandType`/`aggregateType`/`aggregateId`/odcisk zadania sie nie zgadzaja. Deterministyczny `clientRequestId` wyprowadzony z identyfikatora wiersza legacy daje idempotencje za darmo; klucz losowy przy powtornym przebiegu zrobi duplikaty. ★★ **Osma: plan odwrotu moze byc niewykonalny — i to tez jest wynik.** `ie_audit_events` i `ie_outbox_events` maja `UNIQUE (organization_id, aggregate_type, aggregate_id, aggregate_version)`. Skasowanie agregatu bez sprzatniecia audytu i outboxu **zablokuje ponowne przeniesienie tego samego zadania**. Uczciwe 'odwrotu nie ma, dlatego migracja idzie partiami z rozliczeniem po kazdej' jest lepszym wynikiem niz optymistyczny rollback, ktory nie zadziala. ★★ **Dziewiata: brama nie ma zadnej flagi.** `requireCanonicalExecutionWriter` (`executionSpineLegacyReadOnly.middleware.ts:22-44`) nie czyta zadnej zmiennej srodowiskowej — decyduje metoda HTTP plus jedna lista wyjatkow (`:6-12`, dzis jedna pozycja: `DELETE /budget/entries/:id`). Jedynym 'przelacznikiem' jest fizyczne (de)zamontowanie middleware, a punktow montazu jest **szesc**, nie jeden. Sprawdz wszystkie, zanim napiszesz cokolwiek o 'zdjeciu bramy'. ★★ **Dziesiata: brama siedzi na TRASACH, nie na tabeli — wiec legacy rosnie dalej.** Odbior 160 zmierzyl, ze `POST /api/my-work/personal-tasks` zwraca **201 i tworzy wiersz**. Pisarz w serwisie wolany z trasy bez tego middleware pisze do `tasks` do dzis. **Policz, ile takich drog jest** — ta liczba decyduje, czy migracja jednorazowa ma w ogole sens. ★★ **Jedenasta, schematowa: `server/migrations/never-ran/` klamie inwentarzowi.** Kilka plikow w tym katalogu dokłada kolumny do `tasks` i **nigdy nie pobieglo**. Sprawdzianem rozstrzygajacym jest `information_schema.columns` na TWOJEJ bazie po pelnej migracji od zera, nie suma plikow migracji. ★★ **Dwunasta, migracyjna: porzadek uruchamiania NIE JEST alfabetyczny.** `server/scripts/migrationOrdering.ts` sortuje fazami (0: `NNN_`, 1: `YYYYMMDD_`, 2: manifest, 3: reszta), wiec plik datowany biegnie PO wszystkich numerowanych; `compareMigrationOrder` rzuca `DuplicateSortKeyError` przy kolizji klucza; nazwa musi przejsc `server/scripts/validate-migration-naming.ts`. Uruchom `npm run test:migrations:day161:fresh` jako pomiar stanu wejsciowego i wklej wynik — a w projekcie odpowiedz, gdzie w lancuchu moze stanac migracja czytajaca `tasks.risks` (dodane dopiero `20260830_day175_...`). ★★ **Trzynasta, seedowa: dwa seedy, jeden strażnik.** `scripts/dev/case-workspace-seed-local.mjs` ma JEDYNA bariere — host loopback — i zasieje organizacje, uzytkownika, `organization_members` ACTIVE, projekt i flagi V8 na dowolnej nazwie bazy. `scripts/dev/seed-wave3-execution-owner-review.mjs` **ODMOWI startu** poza baza `^consultify_w3_execution_owner_[a-z0-9_]+$`. Zaden z nich nie tworzy ani zadan, ani agregatow — dane do pomiaru wytwarzasz **realnymi sciezkami produktu**, a wiersze legacy (ktorych przez brame utworzyc SIE NIE DA) jawnie oznaczonym `INSERT`-em, opisanym w dokumencie jako **syntetyczne**.**
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
| „`psql` nie istnieje na hoście" | `docker exec cx-day184-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day184-analiza-migracji-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`rozdzialy A1-A4 dokumentu — inwentarz obu magazynow, inwentarz pisarzy i czytelnikow z klasyfikacja za brama / poza brama, mapowanie pol z jawna lista pol BEZ odpowiednika, oraz projekt migracji addytywnej z rozstrzygnieta droga zapisu i idempotencja. A5-A7 (los bramy, ryzyka i odwrot, pomiar) sa obowiazkowe, ale jesli zabraknie czasu, to A1-A4 maja byc KOMPLETNE, a reszta uczciwie opisana jako niezrobiona`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6093` albo `5038 i 5039` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6093` albo `5038 i 5039`** (`Z7`).

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

Właściciel podjął 30.08 decyzję **D-7**
(`docs/program/funkcje/DECYZJE_WLASCICIELA_2026-08-30_WIECZOR.md`):

> **MIGRACJA legacy→kanon W MVP** (najdroższa opcja — decyzja świadoma) · najpierw
> dyżur **ANALIZY** (inwentarz danych `tasks` vs `ie_aggregate_state`, plan migracji
> addytywnej, ryzyka), potem dyżur wykonania; brama 409 zostaje do końca migracji.

**To jest ten dyżur analizy.** Nie migruje — **mierzy i projektuje**. Produktem jest
JEDEN dokument i komplet komend pomiarowych, którymi da się go odtworzyć.

## Dlaczego akurat teraz i dlaczego to boli

Dyżur 160 (`docs/program/funkcje/ODBIOR_160_BRAMA_ZADANIA.md`) zmierzył bramę zapisu:
`POST/PUT/DELETE /api/tasks` odpowiada **409 `EXECUTION_RUNTIME_V1_WRITE_REQUIRED`**,
a stan tabeli `tasks` po żądaniu jest niezmieniony (`tasks 0→0`). Dowód przeszedł
niezależną mutację. Wtedy właściciel dostał policzalną podstawę do wyboru: „zbudować
polecenia kanoniczne" albo „zawęzić bramę". **D-7 wybrało pierwsze.**

Dyżur 175 (`docs/program/funkcje/ODBIOR_175_KARTA_BEZ_REGRESJI.md`) pokazał, co ta
brama robi z produktem, na jednym konkretnym przykładzie:

> **Z-2 ★★ warstwa tyłu martwa z konstrukcji**: jedyny pisarz `tasks.risks/alternatives`
> za bramą 409 → karta **NADAL gubi ryzyka** po zamknięciu. To skutek decyzji „brama
> zostaje" — realne domknięcie przyjdzie z migracją legacy→kanon (decyzja D-7);
> **dyżur analizy migracji MUSI objąć te kolumny.**

Czyli: dyżur 175 dołożył do legacy dwie kolumny (`risks`, `alternatives`,
`server/migrations/20260830_day175_task_risk_alternatives.sql:3-4`) i **jedynego ich
pisarza za bramą** (`TaskController.updateTaskRiskAlternatives` — `UPDATE tasks SET
risks = CAST(? AS JSONB), alternatives = CAST(? AS JSONB) ...`). Dane, których dziś
nie da się zapisać, a które w kanonie nie mają odpowiednika. **To jest miniatura
całego problemu.**

## Czego ten dyżur ma dowieść

Że migracja `tasks` → kanon jest **wykonalna, policzalna i odwracalna** — albo że
w którymś miejscu nie jest, i wtedy **gdzie dokładnie**. Uczciwe „tego nie da się
przenieść bez decyzji właściciela o X" jest tu wynikiem lepszym niż optymistyczny plan.

## Czym ten dyżur NIE jest

**Nie jest migracją.** Zero zmian kodu produktu, zero nowych migracji SQL, zero zmian
w bramie 409. Nie jest zdjęciem bramy — brama zostaje do końca migracji (D-7). Nie jest
przeglądem UI ani naprawą czterech cichych powierzchni obsługi 409 opisanych w odbiorze
160 (`InitiativeTasksTab.tsx:64`, `dashboard/UserTaskList.tsx:49` i dalej) — to osobna
robota, którą **wymieniasz w dokumencie jako zależność**, ale jej nie robisz. Nie jest
pomiarem na bazie demo, stagingu ani produkcji.

# 2. TEZY ZLECENIA

Poniższe zweryfikowano wobec markera `18661cc6a0`. **Trzy z nich są korektą wobec
zlecenia nadzorcy** — traktuj to jako dowód, że adresów się nie przepisuje.

- **T1 (★ korekta).** Pliki wskazane w zleceniu jako `server/src/repositories/
  postgresMaterialCommandUnitOfWork.ts` i `server/src/repositories/
  postgresInitiativeReader.ts` **nie istnieją pod tą ścieżką**. Rzeczywista lokalizacja
  obu to `server/src/domain/initiatives-execution/`.
- **T2 (★ korekta).** Istnieją **DWA różne** typy agregatu związane z zadaniem:
  `'execution_task'` (praca wykonawcza) i `'task'` (praca naprawcza po bramce
  Definition, filtrowana po `payload_json->>'workType' = 'FINANCE_EVIDENCE'`). Adres
  `postgresInitiativeReader.ts:94` ze zlecenia **nie jest zapytaniem** — to pole
  `aggregateType: 'task' | 'decision'` w interfejsie
  `PendingDefinitionRemediationReadModel`. Zapytanie o `execution_task` jest w
  `listMyExecutionWork` (`:436-466`, SQL w `:443`).
- **T3 (★ korekta).** „22 operacji objętych bramą" **nie istnieje jako artefakt kodu**.
  Liczba 22 pochodzi z odbioru 160 i oznacza **22 PLIKI piszące do tabeli `tasks`**;
  tras mutujących w `server/src/routes/pmo/tasks.routes.ts` było wtedy **23**.
  Dziś jest ich **24** — dyżur 175 dołożył `PUT /:id/risk-alternatives` (`:1339`).
  **Przelicz oba inwentarze sam i podaj różnicę wobec odbioru 160.**
- **T4.** Kanon to **nie jedna tabela**. `server/migrations/932_initiatives_execution_
  material_commands.sql` tworzy pięć: `ie_aggregate_state` (`:33`),
  `ie_command_receipts` (`:68`), `ie_audit_events` (`:82`), `ie_outbox_events` (`:99`)
  i `ie_aggregate_relations` (`:117`). Nagłówek pliku (`:2-3`) mówi wprost: *każdy
  zapis materialny commituje stan agregatu, audyt, outbox i pokwitowanie idempotencji
  w JEDNEJ transakcji*. Migracja pisząca tylko do `ie_aggregate_state` **łamie tę
  inwariantę**.
- **T5.** Utworzenie agregatu `execution_task` **wymaga istniejącego, AKTYWNEGO
  agregatu `execution_case` o DOKŁADNEJ oczekiwanej wersji** i **podbija jego wersję
  o jeden** (`server/src/domain/initiatives-execution/executionWork.ts:78-115`,
  `caseAndRollup`). To znaczy, że „migracja addytywna, która nie nadpisuje istniejących
  agregatów" **jest w literalnym brzmieniu niewykonalna** — agregat sprawy JEST
  modyfikowany przy każdym przeniesionym zadaniu. Nazwij to w dokumencie i zaproponuj,
  co to zmienia w projekcie.
- **T6.** W ścieżce produkcyjnej istnieje **dokładnie jeden pisarz**
  `ie_aggregate_state`: `postgresMaterialCommandUnitOfWork.ts:287` (UPDATE z CAS po
  `version`) i `:295` (INSERT z `ON CONFLICT ... DO NOTHING`). Wszyscy pozostali
  pisarze to testy. Tabela `tasks` ma pisarzy **kilkudziesięciu**.
- **T7.** **Nie istnieje żadna flaga przełączająca legacy↔kanon dla zadań.**
  `requireCanonicalExecutionWriter`
  (`server/src/middleware/executionSpineLegacyReadOnly.middleware.ts:22-44`) nie czyta
  żadnej zmiennej środowiskowej — decyduje wyłącznie metoda HTTP plus jedna lista
  wyjątków (`:6-12`, dziś jedna pozycja: `DELETE /budget/entries/:id`). Jedynym
  „przełącznikiem" jest fizyczne (de)zamontowanie middleware. **Zweryfikuj to sam** —
  od tego zależy cały rozdział o losie bramy.

# 3. POZYCJE DYŻURU

Produkt dyżuru: **`docs/program/funkcje/PLAN_MIGRACJI_TASKS_KANON.md`** (nowy plik) —
plus raport wykonawcy pod ścieżką raportu z nagłówka. Dokument ma mieć siedem
rozdziałów opisanych niżej, **w tej kolejności**, i **każde twierdzenie liczbowe ma
mieć obok komendę, którą je zmierzyłeś**. Dokument bez komend jest opinią, nie analizą.

Front-matter dokumentu — wzorem sąsiadów w tym katalogu:

```
---
doc_id: funkcje-plan-migracji-tasks-kanon
status: canonical
owner: piotr
truth_type: design
established: 2026-08-30
---
```

## A1 — inwentarz obu magazynów

**Legacy `tasks`.** Pełna lista kolumn z **plikiem i linią migracji, która ją dodała**.
Tabela powstaje w `server/migrations/000_initdb_core_tables.sql:198` i jest rozszerzana
w kilkunastu plikach — m.in. `060_work_dimensions.sql`, `247_initiative_enhancements.sql`,
`731_tasks_missing_columns.sql`, `20260127_pmo_task_fields.sql`,
`20260213_task_source_origin.sql`, `20260311_origin_tracking.sql`,
`20260801_exe002004_idempotency_keys.sql` i — **kluczowe dla powodu tego dyżuru** —
`20260830_day175_task_risk_alternatives.sql:3-4` (`risks JSONB`, `alternatives JSONB`).
★ Uwaga: w `server/migrations/never-ran/` leżą pliki dokładające kolumny, które
**nigdy nie pobiegły** — **odróżnij je**, inaczej Twój inwentarz będzie opisywał
schemat, którego nie ma. Sprawdzianem rozstrzygającym jest `information_schema.columns`
na **Twojej** bazie po pełnej migracji od zera, nie suma plików.

**Kanon.** Pełny DDL pięciu tabel z `932_initiatives_execution_material_commands.sql`
plus późniejsze zmiany (`935_plan_scenario_time_basis.sql` — `CHECK ... NOT VALID` na
payloadzie; `20261110_initiatives_day21_list_keyset_index.sql` — indeks listy).
Wypisz **komplet występujących `aggregate_type`** (grep po literałach SQL i po
`aggregateType: '...'` w TS), z zaznaczeniem, które dotyczą pracy zadaniowej.
★ **Rozróżnij `'execution_task'` od `'task'`** (T2) — to nie synonimy i pomylenie ich
zatruje całe mapowanie.

**Kształt payloadu zadania kanonicznego.** ★ Pułapka: `postgresMaterial
CommandUnitOfWork.ts` jest **generyczny** — `payload_json` to `JSON.stringify(mutation)`
podanej przez handler domenowy (`:287` UPDATE, `:295` INSERT). Kształt definiuje
`server/src/domain/initiatives-execution/executionWork.ts:23-47`
(`interface ExecutionTask`), a wypełnia `:157-166`. Wypisz go polem po polu.

## A2 — inwentarz pisarzy i czytelników obu magazynów

Dla **każdej** pozycji: `plik:linia — co robi — czy jest za bramą 409, czy poza nią`.
Rozdziel: **kod produkcyjny · testy · skrypty dowodowe · kod martwy/backup**
(`server/src/_backup/**` **nie liczy się** do inwentarza produktu; wymień osobno).

Wymagane komendy grepowe **wklej do dokumentu**, razem z liczbami, które zwróciły —
tak, żeby następny czytelnik mógł je powtórzyć i dostać to samo. Zestaw minimalny:
`INSERT INTO tasks`, `UPDATE tasks`, `DELETE FROM tasks`, `FROM tasks` w `server/src/`
(z wykluczeniem `/dist/`), oraz `INSERT INTO ie_aggregate_state`,
`UPDATE ie_aggregate_state`, `FROM ie_aggregate_state`.

★ **Klasyfikacja „za bramą / poza bramą" jest sednem tego rozdziału, nie ozdobą.**
Brama siedzi na **routerach**, nie na tabeli: `server/src/routes/pmo/tasks.routes.ts:67`
(`router.use(requireCanonicalExecutionWriter)`, komentarz uzasadniający w `:63-66`),
a router jest montowany na **dwóch** ścieżkach (sprawdź w `server/src/Gateway.ts` —
`/api/tasks` i `/api/pmo/tasks`). Poza tym middleware wisi na `/api/execution-control`,
`/api/v8/execution-control/manager` (`server/src/routes/v8/index.ts:107`) i — w wersji
wąskiej, `requireCanonicalInitiativeExecutionWriter` — na routerze inicjatyw
(`server/src/routes/pmo/initiatives.routes.ts:160`). **Pisarz w serwisie wołany z trasy
BEZ tego middleware pisze do `tasks` do dziś.** Odbiór 160 zmierzył, że
`POST /api/my-work/personal-tasks` zwraca **201 i tworzy wiersz** — czyli produkt ma
działającą drogę tworzenia zadania obok bramy. **Policz, ile takich dróg jest.**
To jest liczba, która decyduje o tym, czy migracja jednorazowa w ogóle ma sens, czy
zaraz po niej legacy znów zacznie rosnąć.

## A3 — mapowanie pól `tasks` → payload kanonu

Tabela trójkolumnowa: `kolumna tasks` · `odpowiednik w payloadzie ExecutionTask` ·
`uwagi/utrata`. Osobna, **wyróżniona** lista: **pola BEZ odpowiednika** — do decyzji
właściciela. Z tego, co widać już przy składaniu instrukcji, na tej liście prawie na
pewno znajdą się `risks` i `alternatives` (powód całego dyżuru 175), a także m.in.
`priority`, `tags`, `checklist`, `attachments`, `estimated_hours`, `progress`,
`story_points`, `why`, `expected_outcome`, `acceptance_criteria`, `custom_fields_json`
i cała rodzina kolumn powiadomień/SLA. **Nie przepisuj tej listy z instrukcji — zmierz
ją i podaj kompletną.**

Odwrotny kierunek też jest wymagany: pola payloadu kanonu, które **nie mają źródła
w legacy** i są **wymagane przy tworzeniu** (`executionWork.ts:138-149`):
`executionCaseId`, `initiativeId`, niepusty `title`, `assigneeId`, `ownerId`, parsowalne
`dueAt` **i** `slaAt`. Dla każdego: **skąd wziąć wartość dla wiersza legacy, który jej
nie ma** — i policz, ilu wierszy to dotyczy na Twojej zasianej bazie.
★ Szczególnie: `tasks.initiative_id` jest **nullowalne**, a `task_type='personal'`
oznacza zadanie osobiste bez inicjatywy. **Zadanie bez inicjatywy nie ma kanonicznego
domu.** Rozstrzygnij zakres migracji (które wiersze w ogóle podlegają przeniesieniu)
i uzasadnij pomiarem, nie wygodą.

## A4 — projekt migracji addytywnej

Wymagania, które projekt ma spełnić, i pułapki, które musi obejść:

**(1) Rozstrzygnij drogę zapisu — to najważniejsza decyzja dokumentu.**
Dwie i tylko dwie sensowne:

- *Przez `executeMaterialCommand`* (`server/src/domain/initiatives-execution/
  materialCommand.ts:457`). Zaleta: audyt, outbox, pokwitowanie i CAS **za darmo**,
  inwarianta z nagłówka migracji 932 dotrzymana, idempotencja gotowa. Wada: musisz
  dostarczyć pełną kopertę `MaterialCommandEnvelope` (`materialCommand.ts:3-16`) —
  `actorId`, `clientRequestId`, `correlationId`, `policyId`, `policyVersion`,
  `expectedVersion`. **Rozstrzygnij każde z tych pól dla migracji**: kto jest aktorem
  przeniesienia? (użytkownik, który utworzył legacy? konto systemowe? — jeśli konto
  systemowe, to czy audyt nadal ma sens?) jaka polityka? (ścieżka produktowa używa
  `policyId: 'execution-work', policyVersion: 1` —
  `initiativesExecutionRuntime.routes.ts:4186-4187`).
- *Surowym SQL do `ie_aggregate_state`*. Zaleta: szybko, sterowalnie. Wada: agregaty
  **bez audytu, bez outboxu, bez pokwitowania** — czyli dane, które wyglądają
  kanonicznie, a nie przeszły przez kanon. **Jeśli wybierzesz tę drogę, wypisz
  imiennie, które inwarianty łamiesz i czym to nadrabiasz.**

**(2) Idempotencja ma nazwę i kształt.** `ie_command_receipts` ma
`PRIMARY KEY (organization_id, client_request_id)`, a `executeMaterialCommand:469-495`
przy trafieniu w istniejące pokwitowanie zwraca **`REPLAYED`** zamiast pisać drugi raz
— **pod warunkiem, że `commandType`, `aggregateType`, `aggregateId` i odcisk żądania
się zgadzają; inaczej rzuca konflikt.** Deterministyczny `clientRequestId` wyprowadzony
z identyfikatora wiersza legacy daje idempotencję **za darmo**. Klucz losowy przy
powtórnym przebiegu zrobi duplikaty. Napisz to wprost.

**(3) „Nie nadpisuje istniejących agregatów" wymaga doprecyzowania (T5).**
`createExecutionTask` → `caseAndRollup` (`executionWork.ts:78-115`) **żąda** agregatu
`execution_case` w stanie `ACTIVE` o **dokładnej** wersji i **podbija ją**. Wnioski
do rozstrzygnięcia w dokumencie: czy sprawy wykonawcze w ogóle istnieją dla inicjatyw
niosących legacy zadania (**zmierz to**); czy migracja musi je najpierw utworzyć;
i jak radzi sobie z tym, że **każde przeniesione zadanie zmienia wersję sprawy**,
więc przenoszenie musi być **szeregowe per sprawa** i odporne na przerwanie w połowie.

**(4) Pełny przebieg od pustej bazy.** Jeśli projekt zakłada nowy plik migracji SQL,
opisz jego nazwę i miejsce w porządku uruchamiania. ★ **Porządek NIE JEST alfabetyczny**:
`server/scripts/migrationOrdering.ts` sortuje **fazami** (0: `NNN_`, 1: `YYYYMMDD_`,
2: manifest, 3: reszta), więc plik datowany biegnie **po wszystkich** numerowanych;
`compareMigrationOrder` rzuca `DuplicateSortKeyError` przy kolizji klucza; nazwa musi
przejść `server/scripts/validate-migration-naming.ts`. **Bramka
`npm run test:migrations:day161:fresh` wymaga pełnego przebiegu od PUSTEJ bazy** —
uruchom ją w tym dyżurze (bez dodawania migracji, jako pomiar stanu wejściowego)
i wklej wynik.
★ I pamiętaj o lekcji z rejestru: **migracja czytająca kolumnę dodawaną później
w porządku wywraca cały łańcuch na bazie od zera.** Twój projekt musi wprost odpowiedzieć,
gdzie w łańcuchu może stanąć migracja czytająca `tasks.risks` (dodane
`20260830_day175_...`).

**(5) Jak liczyć przeniesione i pominięte.** Zaprojektuj **konkretne zapytania**
(nie „należy policzyć"): ile wierszy `tasks` kwalifikuje się do przeniesienia, ile
przeniesiono, ile pominięto i **z jakiego powodu** — rozbite po powodach. Zaprojektuj,
gdzie ten rachunek ma być zapisany (tabela? plik raportu? log?) i jak sprawdzić, że
suma się zgadza. Bez rozliczenia co do wiersza migracja nie jest weryfikowalna.

## A5 — los bramy 409 po migracji

Odpowiedz na cztery pytania, każde z dowodem z kodu:

1. **Co dokładnie brama blokuje dziś?** Metoda + ścieżka, per punkt montażu.
   Pamiętaj o jedynym wyjątku (`DELETE /budget/entries/:id`,
   `executionSpineLegacyReadOnly.middleware.ts:6-12`) i o wąskim wariancie dla
   inicjatyw (`:52-75`).
2. **Kiedy można ją zdjąć — i czy w ogóle „zdjąć" jest właściwym słowem?** Zdjęcie
   bramy **przywraca** zapisy do legacy, czyli odwraca kierunek. Rozważ warianty:
   zdjąć / zostawić na zawsze / zamienić na przekierowanie do kanonu / zostawić
   bramę, ale przepisać trasy legacy na wołanie poleceń kanonicznych.
3. **Co z pisarzami poza bramą?** (patrz A2 — `POST /api/my-work/personal-tasks`
   i pozostałe). Migracja jednorazowa ich nie dotyczy; **legacy będzie rosło dalej.**
   Nazwij to i zaproponuj, co z tym zrobić.
4. **Co z liczbą, którą zlecenie nazwało „22 operacjami"?** (T3) Podaj **własny,
   dzisiejszy pomiar** i różnicę wobec odbioru 160, z wyjaśnieniem, skąd różnica.

## A6 — ryzyka i plan odwrotu

Minimum trzy ryzyka nazwane w zleceniu — **podwójny zapis w oknie przejścia**,
**konflikt wersji agregatu**, **dane osierocone** — plus te, które sam zmierzysz.
Dla każdego: *jak się objawi u użytkownika · jak je wykryć zapytaniem · co zrobić*.

Plan odwrotu ma odpowiedzieć na jedno konkretne pytanie: **jak wycofać połowicznie
wykonaną migrację**, skoro `ie_audit_events` i `ie_outbox_events` mają
`UNIQUE (organization_id, aggregate_type, aggregate_id, aggregate_version)` — kasowanie
agregatu bez sprzątnięcia audytu/outboxu zablokuje ponowne przeniesienie tego samego
zadania. **Czy odwrót w ogóle jest możliwy, czy jedynym wyjściem jest „naprzód
i napraw"?** Uczciwa odpowiedź „odwrotu nie ma, dlatego migracja musi być
partiami i z rozliczeniem po każdej" jest wynikiem, nie porażką.

## A7 — pomiar na własnej, lokalnej bazie

Wszystkie liczby w dokumencie mają pochodzić z **Twojego** kontenera z nagłówka
instrukcji, po pełnej migracji od pustej bazy. **Zero połączeń do demo, stagingu
i produkcji** — to nie jest formalność: dane demo są twarzą produktu, a produkcja
`consultify.ai` jest nietykalna.

Zasianie: `scripts/dev/case-workspace-seed-local.mjs` zakłada komplet wymagany przez
realny łańcuch autoryzacji (organizacja, użytkownik, `organization_members` ze statusem
ACTIVE, **projekt** i flagi V8) i **jedyną barierą, jaką ma, jest host loopback** —
działa na dowolnej nazwie bazy. ★ **Pułapka, sprawdź zanim sięgniesz gdzie indziej:**
`scripts/dev/seed-wave3-execution-owner-review.mjs` **ODMÓWI startu na Twojej bazie** —
wymaga nazwy pasującej do `^consultify_w3_execution_owner_[a-z0-9_]+$` i
`EXE_OWNER_FIXTURE_CONFIRM=YES`. To nie jest błąd do obejścia; to cudzy strażnik.
**Nie zmieniaj go i nie nazywaj swojej bazy pod niego.**

Sam seed nie tworzy ani zadań, ani agregatów. **Dane do pomiaru wytwórz realnymi
ścieżkami produktu**, nie surowym `INSERT`-em:
- zadanie kanoniczne — `POST /execution-cases/:executionCaseId/tasks/:taskId` na
  routerze runtime-v1 (`server/src/routes/pmo/initiativesExecutionRuntime.routes.ts:
  4157-4194`; ścieżkę montażu podaje sama brama:
  `canonicalWriter: '/api/initiatives/runtime-v1'`);
- zadanie legacy — **przez bramę się nie da (to jest cały problem)**; udokumentuj
  próbę i jej wynik `409`, a wiersze legacy do pomiaru wytwórz **jawnie oznaczonym**
  `INSERT`-em i **napisz w dokumencie, że są syntetyczne**. Nie udawaj, że to
  zastane dane.
- ★ Jeśli użyjesz ścieżki poza bramą (`POST /api/my-work/personal-tasks`) — tym
  lepiej, ale zaznacz, że mierzysz zadanie osobiste, nie wykonawcze.

**Sprzątasz po sobie.** Kontener po dyżurze zatrzymujesz i usuwasz; żaden wiersz
testowy nie zostaje nigdzie poza Twoją bazą.

## A8 — dowody

Ten dyżur **nie ma dowodu mutacyjnego w zwykłym sensie** — nie zmienia kodu produktu.
Ma za to obowiązek **odtwarzalności**: dla każdej liczby w dokumencie musi istnieć
komenda, którą czytelnik uruchomi i dostanie tę samą liczbę. Do raportu wykonawcy
wklej **dosłownie**:

- wynik pełnej migracji od pustej bazy (liczba zastosowanych migracji, zero błędów),
- wynik `npm run test:migrations:day161:fresh`,
- wyjście każdej komendy inwentarza (grep) razem z liczbą trafień,
- wyjście każdego zapytania SQL użytego do policzenia wierszy,
- sumy kontrolne artefaktów, jeśli je zapisujesz do plików.

★ Jeżeli **mimo braku zmian w kodzie produktu** dopiszesz jakikolwiek plik testowy
(np. zapytanie pomiarowe opakowane w test), obowiązuje go `Z31`: **żadnej nazwy bazy,
portu ani hosta w kodzie testu**; `assertRealPostgresTestEnvironment()` wołasz **bez
argumentów**. To był **czwarty** taki incydent w programie.
**`skipped` i `No test files found` to nie jest `PASS`.**

# 4. TABELA LICENCJI PLIKOWYCH

★★ **Ten dyżur ma licencję ZAPISU na DWA pliki. Nic więcej.** Wszystko inne jest
odczytem. Jeżeli w trakcie pracy uznasz, że musisz coś poprawić w kodzie — **zapisz to
w dokumencie jako zalecenie i zostaw**; to jest cała wartość dyżuru analitycznego.

| Zakres | Ścieżki |
|---|---|
| Zapis | `docs/program/funkcje/PLAN_MIGRACJI_TASKS_KANON.md` — **nowy plik**, produkt dyżuru |
| Zapis | raport `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY184_ANALIZA_MIGRACJI_REPORT.md` |
| Odczyt | `server/migrations/**` — cały katalog, w szczególności `000_initdb_core_tables.sql`, `000_z_core_baseline.sql`, `731_tasks_missing_columns.sql`, `20260127_pmo_task_fields.sql`, `20260801_exe002004_idempotency_keys.sql`, `20260830_day175_task_risk_alternatives.sql`, `932_initiatives_execution_material_commands.sql`, `935_plan_scenario_time_basis.sql`, `20261110_initiatives_day21_list_keyset_index.sql` oraz podkatalog `never-ran/` (do ODRÓŻNIENIA, nie do liczenia) |
| Odczyt | `server/src/domain/initiatives-execution/**` — `materialCommand.ts` (koperta `:3-16`, `executeMaterialCommand` `:457`), `postgresMaterialCommandUnitOfWork.ts` (jedyny pisarz kanonu, `:287`, `:295`), `postgresInitiativeReader.ts` (czytelnicy, m.in. `:436-466`), `executionWork.ts` (kształt i walidacja zadania, `:23-47`, `:78-115`, `:124-175`), `executionWorkHardening.ts`, `operationalAllocation.ts`, `resolveDefinitionRemediationWork.ts` |
| Odczyt | `server/src/middleware/executionSpineLegacyReadOnly.middleware.ts` — brama 409 |
| Odczyt | `server/src/routes/pmo/tasks.routes.ts` (montaż bramy `:67`, trasy mutujące), `server/src/routes/pmo/initiatives.routes.ts:160`, `server/src/routes/v8/index.ts:107`, `server/src/Gateway.ts` (punkty montażu), `server/src/routes/pmo/initiativesExecutionRuntime.routes.ts` (polecenia kanoniczne, `:4157-4194`) |
| Odczyt | wszystkie pisarze i czytelnicy `tasks` w `server/src/**` — pełny inwentarz A2; **żadnego z nich nie zmieniasz** |
| Odczyt | `server/src/services/executionControl/**`, `server/src/services/executionBvpService.ts` — czytelnicy kanonu |
| Odczyt | `server/scripts/migrationOrdering.ts`, `server/scripts/validate-migration-naming.ts`, `scripts/dev/day161-fresh-migration-check.sh` — reguły migracji; **nie zmieniasz** |
| Odczyt | `scripts/dev/case-workspace-seed-local.mjs` — seed, którego używasz; **nie zmieniasz**. `scripts/dev/seed-wave3-execution-owner-review.mjs` — cudzy strażnik nazwy bazy; **nie zmieniasz i nie obchodzisz** |
| Odczyt | `docs/program/funkcje/ODBIOR_160_BRAMA_ZADANIA.md`, `ODBIOR_175_KARTA_BEZ_REGRESJI.md`, `DECYZJE_WLASCICIELA_2026-08-30_WIECZOR.md` (D-7) — źródła decyzji; **nie zmieniasz** |
| Odczyt | `src/components/Initiatives/InitiativeTasksTab.tsx`, `src/components/dashboard/UserTaskList.tsx`, `src/hooks/useActionHandler.ts` — ciche powierzchnie obsługi 409 z odbioru 160; **wymieniasz w dokumencie jako zależność, NIE naprawiasz** |

**Nietykalne imiennie:** cały `server/src/**` i cały `src/**` do zapisu — **zero zmian
kodu produktu**; wszystkie istniejące pliki `server/migrations/**`; brama
`executionSpineLegacyReadOnly.middleware.ts`; skrypty seedujące; `server/src/_backup/**`
(kod martwy — **nie wchodzi do inwentarza produktu**, wymień go osobno).

★ **Rozłączność z dyżurami działającymi równolegle:** dyżur 180 pracuje w
`server/src/services/ai/**` i `server/src/workers/**` — **Ty nie zapisujesz nigdzie
w `server/src/**`**, więc kolizji być nie może. Partia 181-183 i 185-187 pracuje na
innych modułach i innych portach. Jedyny plik, o który mógłby ktoś zahaczyć, to
`docs/program/funkcje/PLAN_MIGRACJI_TASKS_KANON.md` — **on nie istnieje przed Twoim
dyżurem**; jeśli zastaniesz go istniejącym, **zatrzymaj się i zgłoś**.

★ **Pułapka nazw, zweryfikowana w repo:** ścieżki `server/src/repositories/
postgresMaterialCommandUnitOfWork.ts` i `server/src/repositories/postgresInitiativeReader.ts`
**nie istnieją** (T1). W `server/src/repositories/` leżą inne pliki (m.in.
`ManagementReportRepository.ts`, który **czyta `tasks`**) — nie pomyl ich z warstwą
domenową.

# 5. TWARDE ZASADY

- ★★ **ZERO ZMIAN KODU PRODUKTU.** Ten dyżur ma licencję zapisu na dwa pliki `.md`
  i tylko na nie. Żadnej nowej migracji SQL, żadnej zmiany w bramie, żadnego
  „przy okazji" w pisarzach `tasks`. Wszystko, co uznasz za wymagające naprawy, idzie
  do dokumentu jako zalecenie.
- ★★ **NIE ZDEJMUJESZ ANI NIE ZAWĘŻASZ BRAMY 409.** Właściciel zdecydował, że brama
  zostaje **do końca migracji** (D-7). Twój dokument może zaproponować, kiedy i jak
  ją zdjąć — ale nie robi tego.
- ★★ **NIE MIGRUJESZ DANYCH.** Nawet na własnej bazie, nawet „na próbę". Jeżeli chcesz
  sprawdzić wykonalność, opisz eksperyment w dokumencie razem z tym, czego **nie**
  sprawdziłeś.
- ★★ **KAŻDĄ CYTOWANĄ LINIĘ I KAŻDĄ LICZBĘ SPRAWDZASZ SAM.** Numery w tej instrukcji
  zweryfikowano wobec markera **18661cc6a0**, ale plik żyje — a **trzy adresy ze
  zlecenia nadzorcy okazały się błędne** (T1, T2, T3) i zostały poprawione w sekcji 2.
  Jeżeli znajdziesz czwarty — **popraw i zapisz jako korektę**, nie przemilczaj.
- ★★ **NIE PRZEPISUJESZ LICZB Z ODBIORU 160.** „22 pliki", „23 trasy", „28→26
  INSERT-ów" to pomiar sprzed dyżurów 161-179. **Przelicz i podaj różnicę.**
- ★★ **`Z31`: ZAKAZ PRZYPINANIA CZEGOKOLWIEK DO NAZWY BAZY, PORTU ALBO HOSTA** —
  w kodzie testu, w skrypcie pomiarowym i w komendach wklejanych do dokumentu.
  Nazwa bazy i port wchodzą wyłącznie przez `DATABASE_URL` z powłoki, a komendy
  w dokumencie mają być przenośne. **Czwarty incydent w programie** — nie rób piątego.
- ★★ **ZAKAZ `git stash`.**
- **Zero połączeń do bazy zdalnej, demo, stagingu i produkcji.** Wszystko na lokalnym
  kontenerze `cx-day184-pg` z nagłówka. Produkcja `consultify.ai` jest nietykalna;
  dane demo są twarzą produktu.
- **Sprzątasz po sobie** — kontener zatrzymany i usunięty, zero rekordów testowych
  gdziekolwiek poza nim.
- ★ Port **5000 jest zajęty na stałe przez macOS Control Center** — nie używaj go do
  żadnego serwera pomocniczego.
- **Sekcja „TWIERDZENIA NIEZWERYFIKOWANE" w raporcie jest obowiązkowa.** Wypisz
  w niej wprost co najmniej: które pozycje inwentarza pisarzy sklasyfikowałeś
  „zależy od wywołującego" bez wejścia w wołacza; czy sprawdziłeś **wszystkie** punkty
  montażu bramy, czy tylko te wymienione w instrukcji; czy zmierzyłeś, ile inicjatyw
  niosących legacy zadania ma w ogóle aktywną sprawę wykonawczą; czy Twoja propozycja
  aktora i polityki dla koperty migracyjnej jest sprawdzona w kodzie, czy założona;
  oraz czy plan odwrotu został przez Ciebie przemyślany do końca, czy jest szkicem.
