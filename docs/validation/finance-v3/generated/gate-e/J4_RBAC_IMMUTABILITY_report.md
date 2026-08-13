# J4 — RBAC macierz rola×stan×akcja, maker-checker (DEC-FIN-001), niemutowalność APPROVED (DEC-FIN-007)

Data: 2026-08-12. Agent J4. Worktree: `/Users/piotrwisniewski/consultify-wt/fv3p-f-baseline`, gałąź
`codex/fv3p-j4-rbac`. Candidate: `ee5736a5a6` (task-specified baseline). Probe/report commits on
top: `447986e122` → `003d536871` → `1b5bef3a88` → `8be7acaa94` (final HEAD at time of writing).

★★★ **P0 — ZGŁOSZENIE W PIERWSZEJ LINII, potwierdzone niezależnym odczytem SQL, dwa niezależne
przebiegi (pierwszy na `j4_rbac`, powtórzony w całości od zera na czystej `j4_rerun` po
przerwaniu sesji), zero mutacji potrzebnych do reprodukcji:**

> **`POST /api/v8/finance-v2/models/:modelId/approve` NIE MA ŻADNEJ kontroli roli.**
> `approveVersion()` w `server/src/services/finance/canonical/artifactVersionService.ts`
> (funkcja `approveVersion`, linie 706-973) przyjmuje parametr `role: FinanceRole`, ale **nigdy
> go nie odczytuje** (potwierdzone `grep`-em treści funkcji — zero wystąpień `params.role`).
> `server/src/routes/v8/finance-v2/models.routes.ts`, trasa `POST /models/:modelId/approve`,
> **też nie ma żadnej bramki roli** przed wywołaniem `approveVersion`. Jedyna kontrola tożsamości,
> jaka tam działa, to sprawdzenie self-approval (`submitted_by === approverUserId`) — nie
> sprawdzenie "czy ten użytkownik w ogóle wolno mu approve'ować". Efekt: **każdy zalogowany
> członek organizacji — w tym `viewer` — może zatwierdzić wersję w `IN_REVIEW`**, o ile nie jest
> jej dosłownym `submitted_by`.
>
> Reprodukcja (real HTTP + real Postgres + niezależny odczyt SQL osobnym `pg.Client`):
> `RULE-P0-VIEWER-APPROVE` — `HTTP 200 {"success":true,"status":"approved"}`, wiersz w bazie
> (odczytany osobnym socketem TCP, nie przez `DbPromise`/pool aplikacji) faktycznie ma
> `status='APPROVED'`. Ten sam efekt dla `RULE-P0-PREPARER-APPROVE-NOT-SUBMITTER` (preparer, który
> NIE jest submitterem, też zatwierdza).
>
> `RULE-CAPABILITY-NOT-A-GATE` pokazuje dokładnie, dlaczego to jest szczególnie niebezpieczne:
> endpoint `GET /artifacts/:id/capabilities` **poprawnie** nie pokazuje `'approve'` na liście
> `allowedActions` dla viewera (`allowedActionsFromStatus` w `lifecycleService.ts` liczy to
> poprawnie) — czyli UI zbudowany na capability wyglądałby bezpiecznie (przycisk „Zatwierdź"
> byłby ukryty). Ale prawdziwy endpoint approve **w ogóle nie konsultuje capability** i zatwierdza
> mimo to. To nie jest "źle policzone uprawnienie" — to brak JAKIEJKOLWIEK bramki na realnym
> endpoincie zatwierdzania.
>
> Reprodukcja jest zacommitowana w `server/scripts/finance-v3-audit/j4-rbac-probe.ts`
> (`RULE-P0-VIEWER-APPROVE`, `RULE-P0-PREPARER-APPROVE-NOT-SUBMITTER`,
> `RULE-CAPABILITY-NOT-A-GATE`) i uruchamialna deterministycznie (patrz `## Jak odtworzyć`
> niżej). Kod produkcyjny NIE został zmieniony (audyt, nie naprawa).

Dla kontrastu: `reopenVersion()` (ten sam plik) **ma** jawną listę `REOPEN_ALLOWED_ROLES` i ją
sprawdza; `transition()` (T2-T7/T10-T11) **ma** sprawdzenie roli przez `validateTransition()`.
`approveVersion()` (T8) jest jedynym z trzech mutujących wywołań lifecycle, które go **nie ma**.
To wygląda na przeoczenie w konkretnym miejscu, nie na świadomą decyzję — reszta systemu
konsekwentnie sprawdza rolę przed każdą inną mutacją.

---

## 0. Środowisko i dyscyplina dowodowa (WYMAGANE po przerwaniu sesji)

**Co się stało**: pierwszy przebieg tej sesji zginął w trakcie mutanta #7 (proces ubity razem z
całą infrastrukturą — nie z winy agenta, awaria sieci ubiła równolegle kilku agentów). Koordynator
zastał drzewo z tymczasowym mutantem (`MUTANT-RESURRECT` w `lifecycleService.ts`, jawnie
oznaczonym `TEMPORARY, DO NOT COMMIT`), sam go usunął przez `git show ee5736a5a6:<plik> > <plik>`,
potwierdził czyste drzewo i kazał **powtórzyć cały J4 od zera, na nowej bazie**, z twardszymi
wymaganiami dowodowymi. Ten dokument jest tym powtórzonym przebiegiem. Poniżej — dyscyplina, jaką
zastosowano od tego momentu (i którą powinien stosować każdy kolejny agent w tym programie):

- **Baza**: `/Users/piotrwisniewski/fv3-pg/newdb.sh j4_rerun` → klaster `127.0.0.1:54330`
  (`fv3-pg` — trzeba było go NAJPIERW zrestartować, bo padł razem z sesją:
  `pg_ctl -D /Users/piotrwisniewski/fv3-pg/data -l /Users/piotrwisniewski/fv3-pg/pg.log
  -o "-p 54330 -k /tmp -c listen_addresses=127.0.0.1" start`). Stara baza `j4_rbac` z
  przerwanej sesji — usunięta (`dropdb j4_rbac`), żeby nie było wątpliwości, że dowody pochodzą
  z bazy, którą ktoś mógł wcześniej dotknąć ręcznie.
- **Bramka czterech zmiennych**, sprawdzana w kodzie sondy (`GATE_OK` w
  `j4-rbac-probe.ts`, plus twardy odczyt hosta `127.0.0.1|localhost`):
  `RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test DATABASE_URL=postgresql://piotrwisniewski@127.0.0.1:54330/j4_rerun`.
- **Pomiar kodu wyjścia**: zawsze `cmd > plik 2>&1 & PID=$!; wait $PID; CODE=$?` — nigdy przez
  `| tail`/`| grep`. Filtry (`grep -c "^\[PASS\]"` itd.) uruchamiane OSOBNO na zapisanym pliku
  logu, każdy z osobnym kodem wyjścia zapisanym do osobnego pliku (`/tmp/*_pass.txt` itd.), nie
  odczytywane w tym samym poleceniu co uruchomienie sondy.
- **Fingerprint bazy** (`j4_rerun`, po `CREATE DATABASE ... TEMPLATE fv3_template`, przed
  jakimkolwiek zapisem sondy):
  - `PostgreSQL 15.15 (Homebrew) on aarch64-apple-darwin25.2.0`
  - `public`: **1451** `BASE TABLE` / **8** `VIEW` (świeżo po klonie z szablonu; po uruchomieniu
    aplikacji — patrz niżej — rośnie do 1457, bo bootstrap `PostgresDatabase.ts` dokłada kilka
    tabel kompatybilności przy pierwszym połączeniu; to zachowanie aplikacji, nie mojej sondy)
  - `v8`: **121** `BASE TABLE` / **0** `VIEW`
  - `schema_migrations`: **637** wierszy (zgodne z `INFRA_REPORT.md` tego klastra — `fv3_template`
    był budowany trybem STRICT z 637 migracji)
  - Na dysku w tym worktree jest **842** plików `server/migrations/*.sql` — **więcej niż 637 w
    `schema_migrations`**. To ZNANA, oczekiwana rozbieżność, nie defekt tego audytu: `fv3_template`
    to zamrożony obraz sprzed części nowszych migracji na tej gałęzi, a `schema_migrations` na
    żywych środowiskach jest i tak niewiarygodne z innych audytów tej sesji. Weryfikowałem
    empirycznie, że tabele/triggery istotne dla RBAC i niemutowalności (`finance_business_versions`,
    `trg_finance_bv_immutability`, `finance_exceptions`, `finance_exceptions_current`,
    `compute_jobs` + 3 polityki RLS) SĄ obecne i działają zgodnie z opisem w migracjach z tej
    gałęzi — potwierdzone przez sam fakt, że wszystkie poniższe testy (w tym 8 mutantów łamiących
    dokładnie te mechanizmy) dają oczekiwane wyniki.
  - `git rev-parse HEAD` w chwili uruchamiania sondy (worktree): `447986e1223f889b93aaa396c6033fd3499cd271`
    → finalnie `8be7acaa94...` po wszystkich commitach tej sesji (patrz `git log` gałęzi).
- **Skrypt sondy**: WYŁĄCZNIE `server/scripts/finance-v3-audit/j4-rbac-probe.ts` (997+ linii, jeden
  plik, jak nakazano) + jeden mały pomocniczy runner `server/scripts/finance-v3-audit/run_probe.sh`
  (nie "inny plik sondy" — to tylko bash wrapper wokół `npx tsx ... --rule=<id>`, dodany PO
  wznowieniu specjalnie po to, żeby każdy przebieg mutanta miał samodzielnie weryfikowalny
  dowód: dokładna komenda, PID, kod wyjścia z `wait $!`, czas trwania, ścieżka do pełnego logu —
  wszystko w jednym pliku `/tmp/j4_mutant_<label>.exitcode` obok logu).
- **Cofanie mutantów**: WYŁĄCZNIE `git show ee5736a5a6:<plik> > <plik>`, nigdy `stash`/`reset`/`clean`.
  Po KAŻDYM mutancie: `git diff --stat <plik>` musi być puste, ZANIM przejdę do następnego —
  potwierdzone przy każdym z 8 mutantów niżej, dosłownie w logu tej sesji.

---

## 1. Macierz ROLA × STAN × AKCJA (na poziomie endpointu)

Role: `preparer`, `reviewer`, `approver`, `finance_admin`, `viewer` (WP-B02 §7.1).
Cykl: `DRAFT → READY_FOR_REVIEW → IN_REVIEW → APPROVED → SUPERSEDED / ARCHIVED / INVALIDATED`,
`NEEDS_CHANGES` wraca do `DRAFT`, `reopen` tworzy vN+1.

### 1.1 Mapowanie roli organizacyjnej → `FinanceRole` (jak realny użytkownik w ogóle DOSTAJE rolę)

`mapOrgRoleToFinanceRole()` istnieje w DWÓCH bit-identycznych prywatnych kopiach
(`models.routes.ts` i `_shared.ts`, celowo nie scalone — komentarz w `_shared.ts` tłumaczy dlaczego:
`models.routes.ts` to zamrożony kontrakt WP-C02 z własnymi testami fixture):

| org role (JWT/`req.userRole`) | → FinanceRole |
|---|---|
| `finance_admin` | `finance_admin` |
| `owner`, `admin` | `approver` |
| `editor`, `finance_editor` | `preparer` |
| cokolwiek innego (w tym pusty/nieznany) | `viewer` |

★ **FINDING (strukturalny, nie luka bezpieczeństwa)** — `RULE-REVIEWER-UNREACHABLE`, PASS: **żadna
prawdziwa rola organizacyjna nigdy nie mapuje się na `FinanceRole 'reviewer'`.** Potwierdzone
statycznym odczytem obu kopii `mapOrgRoleToFinanceRole` + `grep`-em całego `server/src` w
poszukiwaniu literału `'reviewer'` jako wartości `org_members.role`/podobnego pola — zero trafień
poza testami wołającymi `checkSelfApproval`/`validateTransition` bezpośrednio z `role: 'reviewer'`
(czyli z pominięciem warstwy HTTP). Skutek: `T4 start_review` i `T6 request_changes`
(`allowedRoles: ['reviewer','approver','finance_admin']`) są dziś **de facto ograniczone do
`approver`/`finance_admin`** dla każdego prawdziwego użytkownika — nikt nie może być samym
"reviewerem" bez też będąc approverem. To zawęża, nie rozszerza, dostępne działania — fail-safe,
nie fail-open — ale oznacza że komórki macierzy z `reviewer` w tej tabeli są dziś teoretyczne, nie
osiągalne przez realnego użytkownika inaczej niż wołając serwis bezpośrednio (co i tak robi tylko
inny kod serwerowy, nigdy żądanie HTTP).

### 1.2 Dozwolone przejścia (T2-T7, T10-T11) — endpoint `POST /versions/:businessVersionId/transitions`

| id | akcja | z | do | dozwolone role | wymaga reason |
|---|---|---|---|---|---|
| T2 | `submit_for_review` | DRAFT | READY_FOR_REVIEW | preparer, finance_admin | nie |
| T3 | `withdraw` | READY_FOR_REVIEW | DRAFT | preparer, finance_admin | nie |
| T4 | `start_review` | READY_FOR_REVIEW | IN_REVIEW | reviewer, approver, finance_admin | nie |
| T5 | `withdraw` | IN_REVIEW | DRAFT | preparer, finance_admin | nie |
| T6 | `request_changes` | IN_REVIEW | NEEDS_CHANGES | reviewer, approver, finance_admin | **tak** |
| T7 | `resume_editing` | NEEDS_CHANGES | DRAFT | preparer, finance_admin | nie |
| T10 | `archive` | APPROVED | ARCHIVED | approver, finance_admin | nie |
| T11 | `invalidate` | APPROVED | INVALIDATED | finance_admin, approver | **tak** |

Wszystkie 8 przejść **potwierdzone real-HTTP + real-Postgres jako PRZECHODZĄCE** dla właściwej
roli (`RULE-MATRIX-LEGAL-T2` … `T11`, wszystkie PASS w finalnym przebiegu — patrz §5).

T8 (`approve`) i T12 (`reopen`) są osobnymi endpointami (`POST /models/:modelId/{approve,reopen}`)
— T9 (`supersede`) jest efektem ubocznym systemowym wewnątrz `approveVersion`, nigdy nie wywoływane
bezpośrednio.

### 1.3 NIEDOZWOLONE przejścia — ważniejsza połowa, wszystkie sprawdzone przez faktyczny atak HTTP + niezależny odczyt SQL

| id | opis | oczekiwane | wynik (finalny przebieg) |
|---|---|---|---|
| `RULE-MATRIX-VIEWER-SUBMIT` | viewer próbuje `submit_for_review` na DRAFT | 403 FORBIDDEN | **PASS** |
| `RULE-MATRIX-PREPARER-STARTREVIEW` | preparer próbuje `start_review` (T4, nie preparer) | 403 FORBIDDEN | **PASS** |
| `RULE-MATRIX-VIEWER-ARCHIVE` | viewer próbuje `archive` na APPROVED | 403 FORBIDDEN | **PASS** |
| `RULE-MATRIX-INVALIDATE-NO-REASON` | approver `invalidate` bez `reason` | 400 REASON_REQUIRED | **PASS** |
| `RULE-MATRIX-ARCHIVED-RESURRECT` | approver próbuje `submit_for_review` na już-ARCHIVED (terminal→nie-terminal) | 409 STATE_PRECONDITION_FAILED | **PASS** |
| `RULE-MATRIX-INVALIDATED-ARCHIVE` | approver próbuje `archive` na już-INVALIDATED (terminal, zero wyjść) | 409 STATE_PRECONDITION_FAILED | **PASS** |
| `RULE-MATRIX-APPROVED-EDIT-VIA-TRANSITIONS` | preparer próbuje `withdraw` na APPROVED (nie istnieje taka krawędź) | 409 STATE_PRECONDITION_FAILED | **PASS** |
| **`RULE-P0-VIEWER-APPROVE`** | viewer próbuje **`approve`** na IN_REVIEW | 403 FORBIDDEN | ★ **FAIL — zatwierdził, 200, DB=APPROVED** |
| **`RULE-P0-PREPARER-APPROVE-NOT-SUBMITTER`** | preparer (nie submitter) próbuje **`approve`** | 403 FORBIDDEN | ★ **FAIL — zatwierdził, 200, DB=APPROVED** |
| **`RULE-CAPABILITY-NOT-A-GATE`** | capability mówi "brak `approve`" dla viewera, endpoint mimo to zatwierdza | 403 zgodnie z capability | ★ **FAIL — endpoint 200, capability poprawnie mówiło "nie"** |

Każda z powyższych kontroli **potwierdza brak mutacji przy odmowie** przez `verifyIndependently()`
— osobny `pg.Client`, osobne gniazdo TCP, nigdy pula aplikacji — porównując `status`/`version`
przed i po. Dla trzech FAIL powyżej: mutacja **zaszła naprawdę** (nie jest to fałszywy negatyw z
samego kodu HTTP 200 — niezależny SQL potwierdza `status='APPROVED'`).

---

## 2. MAKER-CHECKER (DEC-FIN-001)

### 2.1 Literalny self-approval — DZIAŁA

`RULE-SOD-LITERAL-SELF-APPROVE` (PASS): ten sam fizyczny użytkownik (`finance_admin`), który
`submit_for_review`'ował artefakt `VALUATION_CASE` (HIGH_RISK domyślnie), próbuje go zatwierdzić →
`403 SELF_APPROVAL_FORBIDDEN`, wiersz zostaje w `IN_REVIEW` (niezależny SQL). Ten fragment
`checkSelfApproval()` **działa i jest realnie wywoływany** przez `approveVersion()` — mimo że
`approveVersion()` nie ma bramki roli (§P0), MA bramkę tożsamości submitter'a.

### 2.2 Użytkownik z DWIEMA rolami naraz (preparer + approver) — DZIAŁA, oparte na TOŻSAMOŚCI

`RULE-SOD-DUAL-ROLE-USER` (PASS): jeden fizyczny `userId`, raz działający jako `editor` (→
`preparer`), raz jako `owner` (→ `approver`) — czyli DOKŁADNIE przypadek z zadania: "użytkownik
mający jednocześnie rolę preparer i approver". Submituje jako preparer, próbuje zatwierdzić jako
approver → **`403 SELF_APPROVAL_FORBIDDEN`**. Blokada trzyma się **identycznego `userId`**, nie
patrzy w ogóle na to, jaką rolą się w danym żądaniu przedstawia — dokładnie to, czego wymagało
zadanie ("oparta na TOŻSAMOŚCI UŻYTKOWNIKA, nie tylko na roli").

### 2.3 ★ GAP potwierdzony — self-approval łapie TYLKO literalnego `submitted_by`, nie każdego edytora

`RULE-SOD-EDITOR-NOT-SUBMITTER-GAP` (**FAIL** — świadomie, to jest wynik dowodowy, nie błąd sondy):

- `checkSelfApproval()` w `lifecycleService.ts` (linie 279-295) przyjmuje `editorUserIds` i
  `reviewStartedBy` jako dodatkowe wejścia do sprawdzenia konfliktu — dokumentacja funkcji mówi
  wprost: *"Caller supplies from artifact_lifecycle_events if it wants full enforcement"*.
- **Jedyny produkcyjny wołający** `approveVersion()` to `models.routes.ts` — **grep całego
  `server/src` potwierdza zero innych wywołań poza testami**. Ten jedyny caller **nigdy nie
  przekazuje** `editorUserIds` ani `reviewStartedBy`.
- Co gorsza: **nie ma skąd ich wziąć**. `autosaveService.ts` — realna ścieżka edycji treści
  roboczej wersji — **nigdy nie zapisuje** do `artifact_lifecycle_events` (grep potwierdza zero
  `INSERT INTO artifact_lifecycle_events` w tym pliku). Kolumna `edited_by` na
  `finance_working_revisions` to pojedyncza wartość "ostatni edytor", nie lista wszystkich
  edytorów od utworzenia wersji.
- Reprodukcja: użytkownik A tworzy artefakt `VALUATION_CASE` (HIGH_RISK), jest `edited_by` na
  working revision. Inny fizyczny użytkownik B submituje w jego imieniu (`submitted_by = B`,
  ≠ A). A (który ma też uprawnienie `approver` przez drugą rolę organizacyjną) zatwierdza.
  **Wynik: `HTTP 200`, zatwierdzone.** `checkSelfApproval` porównuje tylko `submitted_by === A`
  (fałsz, bo `submitted_by=B`) i `editorUserIds.includes(A)` (zawsze fałsz — `editorUserIds` jest
  zawsze `[]` z tego jedynego callera) — więc nic nie wykrywa konfliktu, mimo że A **jest**
  faktycznym autorem treści, którą właśnie zatwierdza.
- To jest DOKŁADNIE "preparer i approver to ten sam fizyczny użytkownik" z innej strony niż §2.2:
  §2.2 pokazuje, że gdy A submituje SAM SIEBIE i próbuje zatwierdzić SAM SIEBIE, blokada trzyma.
  §2.3 pokazuje, że gdy A tylko EDYTUJE (nie submituje osobiście — ktoś inny wciska "submit" w
  jego imieniu, co jest realnym przepływem pracy w zespole), blokada **nie trzyma**, mimo że
  intencja ADR-u (WP-B02 §7.2.6, "Every author of a mutating edit") jest jasna.

### 2.4 LOW risk tier — brak bramki SoD, ZGODNIE Z PROJEKTEM

`RULE-SOD-LOW-TIER-NO-GATE` (PASS): dla `HISTORICAL_ANALYSIS` (domyślnie LOW), ten sam submitter
może być zatwierdzony przez kogokolwiek — self-approval przechodzi. To NIE jest luka:
`checkSelfApproval()` linia 280 (`if (input.riskTier === 'LOW') return { forbidden: false }`) to
świadoma decyzja projektowa z WP-B02 §7.2 ("LOW tier has no SoD gate"), sprawdzona tu tylko po to,
by potwierdzić że system POPRAWNIE rozróżnia poziom ryzyka, a nie że każdy self-approval jest
zawsze dozwolony.

### 2.5 Tryb awaryjny (break-glass / emergency approve) — POTWIERDZONE NIEISTNIEJĄCY

`RULE-EMERGENCY-OVERRIDE-NOT-IMPLEMENTED` (PASS jako "nic do zaatakowania"): `grep` całego
`server/src/services/finance` i `server/src/routes/v8/finance-v2` w poszukiwaniu
`emergency`/`override`/`break.glass`/`breakGlass` daje dokładnie JEDNO trafienie —
`workspaceBarContract.ts:419`, komentarz dokumentacyjny wymieniający "emergency approve" jako
przyszły koncept wymagający `reason`. Zero implementacji, zero endpointu, zero ścieżki kodu. Nie
ma więc czego wymagać (uprawnienie/uzasadnienie/expiry/ślad audytowy) — bo nic takiego nie
istnieje. To jest luka w SCOPE (nieodhaczona funkcja), nie luka bezpieczeństwa.

---

## 3. NIEMUTOWALNOŚĆ APPROVED (DEC-FIN-007)

Wszystkie próby ataku poniżej wykonane **przez prawdziwy endpoint HTTP** (gdzie istnieje) i/lub
**przez surowe SQL na osobnym połączeniu** (`pg.Client`, własny socket), z potwierdzeniem stanu PO
próbie przez TEN SAM niezależny odczyt — 403/409 nie wystarcza, endpoint mógłby odmówić po
zapisie; sprawdzam wiersz.

| id | atak | oczekiwane | wynik |
|---|---|---|---|
| `RULE-IMMUT-NO-MUTATING-ROUTES` | `PUT`/`PATCH`/`DELETE` na `/versions/:id` i `/artifacts/:id` (5 prób) | 404 dla wszystkich (żaden taki route nie istnieje) | **PASS** (potwierdzone `grep`-em routerów + realnymi żądaniami) |
| `RULE-IMMUT-REAPPROVE-VIA-ROUTE` | powtórne `approve` już-APPROVED wersji, przez prawdziwy route | 409 STATE_PRECONDITION_FAILED, wiersz bez zmian | **PASS** |
| `RULE-IMMUT-DIRECT-SQL-TAMPER` | `UPDATE ... SET content_semantic_hash='TAMPERED...'` na APPROVED, surowe SQL, osobne połączenie | SQL rzuca wyjątek (trigger), hash bez zmian | **PASS** |
| `RULE-IMMUT-DIRECT-SQL-DELETE` | `DELETE FROM finance_business_versions WHERE ...APPROVED...`, surowe SQL | `DELETE` odrzucony/no-op | **PASS** — ale patrz ★ niżej |
| `RULE-REOPEN-PRESERVES-PARENT` | `reopen()` na APPROVED, porównanie wiersza-rodzica bajt-w-bajt przed/po | rodzic niezmieniony, dziecko=DRAFT z `parent_version_id`=rodzic | **PASS** |
| `RULE-REOPEN-VIEWER-FORBIDDEN` | viewer próbuje `reopen` na APPROVED | 403 FORBIDDEN, wiersz bez zmian | **PASS** |
| `RULE-APPROVAL-BLOCKED-SECURITY-EXCEPTION` | `approve` gdy istnieje OPEN wyjątek SECURITY | 422 APPROVAL_BLOCKED, wiersz bez zmian | **PASS** |
| `RULE-DRAFT-DELETE` | czy Draft (bez potomków) w ogóle da się usunąć; Draft z potomkami nie powinien | N/A jeśli nieistniejące | **PASS** jako "potwierdzone nieistniejące" |

★ **Uwaga do `RULE-IMMUT-DIRECT-SQL-DELETE`**: `finance_business_versions` **nie ma żadnego
triggera `BEFORE DELETE`**. Jedyna obrona przed twardym usunięciem to `FK RESTRICT` z tabel
zależnych (`finance_working_revisions`, `finance_compute_snapshots`, `finance_stmt_lines`, itd.) —
w tym konkretnym fixture'ze (BASELINE_MODEL, zatwierdzony) `DELETE` faktycznie zawiódł, bo wiersz
MA dzieci. Ale to jest **przypadkowa** ochrona, nie zaprojektowana: hipotetyczny zatwierdzony
wiersz bez żadnych zależnych rekordów (np. `STATEMENT_PACK` zatwierdzony przed jakąkolwiek
kompilacją stmt_lines) **nie miałby żadnej warstwy DB broniącej przed twardym `DELETE`**. To
jest luka do rozważenia osobno (poza zakresem "audytuj, nie naprawiaj" tej sesji) — flagowana tu
jako obserwacja, nie P0 (bo w praktyce APPROVED zawsze ma co najmniej `finance_compute_snapshots`
dzięki `finance_bv_enforce_immutability`'s `"cannot APPROVE without compute_snapshot_id"` guard).

`RULE-DRAFT-DELETE`: **nie istnieje ŻADNA ścieżka usuwania** `finance_artifacts` /
`finance_business_versions`, dla żadnego statusu, nigdzie w kodzie (`grep` całego `server/src` —
zero `router.delete` dotykających tych ścieżek, zero funkcji `delete*` w `artifactVersionService.ts`
ani żadnym siostrzanym serwisie kanonicznym). Wymaganie "Draft bez potomków może być usuwany" jest
dziś niedostarczone w całości — nie tylko część "z potomkami nie może".

---

## 4. Brak cichego zera na poziomie danych

### 4.1 Naprawa NA-reachability — TRZYMA na realnej bazie

Zamiast budować własny fixture od zera, uruchomiłem istniejący
`kpiComputeService.pg.test.ts` (znany-odpowiedź, niezależna arytmetyka GoldCo, bez importu
`goldco_oracle.ts` do samego kodu produkcyjnego) bezpośrednio przeciw `j4_rerun`:

```
RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test DATABASE_URL="postgresql://piotrwisniewski@127.0.0.1:54330/j4_rerun" \
  npx vitest run src/services/finance/canonical/__tests__/kpiComputeService.pg.test.ts --maxWorkers=2
```
PID=78831, EXIT_CODE=**0**, `Test Files 1 passed (1)`, `Tests 10 passed (10)`, `Duration 688ms`
(pełny log: `/tmp/j4_kpitest_final.log`).

Trzy z tych 10 testów to dokładnie sedno naprawy P1 (`PKG_FIX_CANONICAL_report.md` defekt 2):
- `CURRENT_LIABILITIES` cell **absent** (brakujący mianownik) → `value_status='NA'`,
  `interpretation_text` zawiera `DENOMINATOR_MISSING` — **nigdy `MISSING`, nigdy sfabrykowana
  liczba**, potwierdzone niezależnym odczytem `finance_analysis_kpi_values`.
- `CURRENT_LIABILITIES=0` (zerowy mianownik) → `value_status='NA'`, `DIVISION_BY_ZERO` —
  **nigdy cichy zero, nigdy `NOT_APPLICABLE`** (przedreformowe zachowanie).
- `CURRENT_ASSETS=0` z prawdziwym, zdrowym mianownikiem → `value_status='PRESENT_ZERO'`,
  `value_decimal=0` — **rozróżnialne od powyższego NA-by-zero-denominator**.

Cztery stany (`PRESENT_ZERO`, `PRESENT_NONZERO`, `MISSING`, `NA`) są więc rozróżnialne w
odpowiedzi API/DB na realnej bazie, dla tego samego mechanizmu, który wcześniej (przed fixem)
zawsze zwracał `NOT_APPLICABLE` lub `MISSING`, nigdy `NA`.

### 4.2 ★ Znany otwarty defekt — POTWIERDZONY, nienaprawiony (świadomie, poza zakresem tej sesji)

`RULE-NA-EXCLUDED-VS-FORGOTTEN` (PASS jako "defekt potwierdzony"): linia świadomie wykluczona
przez analityka (`mapStatementLines` z regułą `action: 'EXCLUDE'`, `excludeKind: 'ANALYST_DECISION'`)
jest **nieodróżnialna** od linii po prostu niewpisanej, DLA SILNIKA KPI:

- Kod (`statementMappingService.ts` linie 291-306): gałąź `EXCLUDE` woła `emptyResult(..., 'EXCLUDED', ...)`
  i robi `continue` **PRZED** instrukcją `INSERT INTO finance_stmt_lines` (linia 393+). Czyli
  wykluczona linia **nigdy nie dostaje wiersza** w `finance_stmt_lines` — identycznie jak linia
  kanoniczna, do której nikt nigdy nie zmapował żadnej surowej linii.
- Potwierdzone empirycznie: po wywołaniu `mapStatementLines` z jedną regułą EXCLUDE,
  `SELECT * FROM finance_stmt_lines WHERE business_version_id=? AND canonical_line_id=?` zwraca
  **0 wierszy** — dokładnie to samo, co dałoby zapytanie o linię, o której nikt nigdy nie
  pomyślał.
- `finance_stmt_reconciliation` (osobna tabela-ledger) **faktycznie zapisuje** `bucket='EXCLUDED'`
  z `reason_code` — czyli ślad "analityk to świadomie wykluczył" **istnieje** w bazie. Ale
  `kpiComputeService.ts` (silnik KPI, który faktycznie liczy wskaźniki) **nigdy nie odpytuje**
  `finance_stmt_reconciliation` — jego `CellResolver` czyta wyłącznie `finance_stmt_lines` (grep
  potwierdza jedno miejsce `FROM finance_stmt_lines` w tym pliku, zero odwołań do reconciliation).
- **Skutek dla użytkownika**: raport KPI, który zależy od tej linii, pokazuje `MISSING` (albo `NA`
  jeśli to mianownik ratio) bez żadnej wskazówki w interfejsie, że ktoś to już przejrzał i
  celowo uznał za nieistotne. Odróżnienie "sprawdzone, nie dotyczy" od "jeszcze nie wpisane"
  wymaga dziś ręcznego przejrzenia jednorazowej odpowiedzi HTTP z `POST /statements/:id/map` albo
  ręcznego zapytania do `finance_stmt_reconciliation` — żadne z nich nie jest wystawione przez
  API odczytu KPI/analizy. Klient widzi te same "dziury" niezależnie od tego, czy ktoś je
  przejrzał, czy nie.

To jest zgłoszenie POTWIERDZAJĄCE istniejący defekt (zgodnie z zadaniem — "do POTWIERDZENIA, nie
naprawiania"), nie nowa naprawa.

---

## 5. Kontrola negatywna — 8 mutantów, każdy: czerwony → przywrócony → zielony

Reguła dla całej tej sekcji: **każdy mutant uruchamiany osobno** przez
`server/scripts/finance-v3-audit/run_probe.sh <RULE> <label>`, który wypisuje dokładną komendę,
PID, kod wyjścia (z `wait $!`, nigdy z potoku), czas trwania i ścieżkę do pełnego logu — do pliku
`/tmp/j4_mutant_<label>.exitcode` obok `/tmp/j4_mutant_<label>.log`. Po KAŻDYM mutancie: cofnięcie
przez `git show ee5736a5a6:<plik> > <plik>`, natychmiastowe `git diff --stat <plik>` (puste = OK),
potem ponowne uruchomienie tej samej reguły dla potwierdzenia zieleni.

| # | reguła zdjęta | plik:funkcja | test | RED (dowód) | GREEN po cofnięciu | warstw obrony |
|---|---|---|---|---|---|---|
| 1 | rola w `validateTransition` | `lifecycleService.ts` | `RULE-MATRIX-VIEWER-SUBMIT` | PID 80216, EXIT=1, `HTTP 200`, `DRAFT→READY_FOR_REVIEW` mimo `viewer` | PID 88570, EXIT=0 | **1** (tylko app) |
| 2 | `REOPEN_ALLOWED_ROLES` | `artifactVersionService.ts` reopenVersion | `RULE-REOPEN-VIEWER-FORBIDDEN` | PID 5893, EXIT=1, `HTTP 201`, viewer stworzył DRAFT-dziecko z APPROVED | PID 10716, EXIT=0 | **1** (tylko app) |
| 3 | `isPreparerConflict` w `checkSelfApproval` | `lifecycleService.ts` | `RULE-SOD-LITERAL-SELF-APPROVE` | PID 12021, EXIT=1, ten sam user zatwierdza własny submit, `HTTP 200` | PID 17853, EXIT=0 | **1** (tylko app) |
| 4 | trigger `trg_finance_bv_immutability` (DB, `ALTER TABLE ... DISABLE TRIGGER`) | DB-level | `RULE-IMMUT-DIRECT-SQL-TAMPER` | PID 20453, EXIT=1, surowy `UPDATE` na APPROVED **zaakceptowany**, hash zmieniony na `TAMPERED-BY-J4-PROBE` | PID 20939, EXIT=0 (trigger `ENABLE`) | **1 dla ataku SQL** (brak innej warstwy DB); **2 dla ataku przez HTTP** (nie ma nawet route'u — patrz `RULE-IMMUT-NO-MUTATING-ROUTES`) |
| 5 | `current.status !== 'IN_REVIEW'` w `approveVersion` | `artifactVersionService.ts` | `RULE-IMMUT-REAPPROVE-VIA-ROUTE` | PID 31232, **EXIT=0 (ZIELONE mimo zdjęcia!)** — patrz niżej | PID 34569, EXIT=0 | **3, potwierdzone empirycznie** — patrz §5.1 |
| 6 | `def.requiresReason && !opts.reasonProvided` w `validateTransition` | `lifecycleService.ts` | `RULE-MATRIX-INVALIDATE-NO-REASON` | PID 35155, EXIT=1, `HTTP 500` (nie 400!), ale **wiersz bez zmian** (`APPROVED→APPROVED`) | PID 35948, EXIT=0 | **2** — app-level typowana odmowa zdjęta, DB CHECK (`INVALIDATED requires invalidated_reason`) nadal łapie, ale jako 500, nie typowany 400 |
| 7 | DODANY nielegalny wpis `ARCHIVED→DRAFT` w `TRANSITIONS` | `lifecycleService.ts` | `RULE-MATRIX-ARCHIVED-RESURRECT` | PID 38554, EXIT=1, `HTTP 500` (nie 409!), ale **wiersz bez zmian** (`ARCHIVED→ARCHIVED`) | PID 47008, EXIT=0 | **2** — app-level tabela "oszukana", DB trigger terminal-state guard (`% is % (terminal); no further status transition is allowed`) nadal łapie, jako 500 |
| 8 | blokujący wyjątek SECURITY w `approveVersion` (a3) | `artifactVersionService.ts` | `RULE-APPROVAL-BLOCKED-SECURITY-EXCEPTION` | PID 48134, EXIT=1, `HTTP 200`, zatwierdzone mimo OPEN wyjątku SECURITY | PID 62648, EXIT=0 | **1** (tylko app; brak triggera DB egzekwującego regułę biznesową "brak zatwierdzenia przy OPEN SECURITY exception") |

### 5.1 Mutant #5 — najciekawszy wynik: warstwa aplikacji NIE poczerwieniała, bo istnieje DRUGA niezależna warstwa aplikacji

Zdjęcie samego sprawdzenia statusu wewnątrz `approveVersion()` **nie odtworzyło** luki przez
prawdziwy route `POST /models/:modelId/approve` — bo `models.routes.ts` **przed** wywołaniem
`approveVersion()` sam robi `findCurrentArtifactVersion(organizationId, artifactId, ['IN_REVIEW'])`
i zwraca `409` jeśli nic nie znajdzie. To jest DRUGA, niezależna warstwa na poziomie route'u.

Żeby zmierzyć TRZECIĄ warstwę, wywołałem `approveVersion()` **bezpośrednio z kodu**, z pominięciem
route'u i jego lookupu, na drugim, oddzielnym, jednorazowym skrypcie
(`/tmp/j4_direct_reapprove_rerun.ts`, PID 34304, EXIT_CODE=1 — kod wyjścia 1 tu jest OCZEKIWANY,
oznacza że drugie wywołanie faktycznie rzuciło wyjątek):

```
MUTANT5 CHECK: first approve ok= true APPROVED
MUTANT5 CHECK: status after first approve: APPROVED version: 4
MUTANT5 CHECK ERROR finance_business_versions: 477febf2-d436-422b-a424-7e4383d2e952 is APPROVED;
  only status and its associated metadata columns may change
```

Nawet z DWIEMA warstwami zdjętymi (route lookup pominięty ręcznie w tym skrypcie + service-level
check zamutowany), **trzecia warstwa — trigger DB `trg_finance_bv_immutability` — złapała próbę**
zmiany `content_semantic_hash`/`compute_snapshot_id`/`version` na wierszu, którego `status` był
już `APPROVED` (dokładnie ten sam trigger co Mutant #4). **Wynik: "approve of an already-APPROVED
row" broni dziś TRZY niezależne warstwy** — route lookup, service-level status check, DB trigger —
z których każda z osobna wystarczyłaby.

---

## 6. RLS — lokalny, NIE zastępujący Railway

`RULE-RLS-RESTRICTED-ROLE` (PASS, finalny przebieg PID 71795, EXIT=0): utworzyłem na własnym
efemerycznym klastrze rolę `j4_restricted_<losowa>` z `NOSUPERUSER NOBYPASSRLS`, nadałem jej
minimalne `SELECT/INSERT/UPDATE/DELETE` na `compute_jobs` + `CONNECT` na bazę, wstawiłem po
jednym wierszu `compute_jobs` w dwóch różnych `organization_id`, połączyłem się **jako ta
ograniczona rola** (osobny `pg.Client`, osobny socket), ustawiłem
`SELECT set_config('app.organization_id', $1, true)` w transakcji i zapytałem o oba wiersze po ID.

**Wynik: własny-org wiersz widoczny, cudzy-org wiersz UKRYTY** — polityka `tenant_isolation_compute_jobs`
z `20260826_finance_v3_w2_rls_pilot_policies.sql` działa poprawnie **gdy łączy się rola bez
`BYPASSRLS`**.

★ To NIE dowodzi, że produkcja jest chroniona. Ten sam plik migracji mówi to wprost: jedyna rola,
jaką ten program ma na Railway, to `postgres` — superuser z `rolbypassrls=t`, który **zawsze**
omija RLS, nawet z `FORCE ROW LEVEL SECURITY`. Ten wynik odpowiada wyłącznie na pytanie "czy
polityka jest NAPISANA poprawnie" (tak), nie "czy dane są dziś chronione RLS-em" (nie są — stan
`BLOCKED_EXTERNAL` z wcześniejszych audytów tej gałęzi pozostaje aktualny; wdrożenie
mniej-uprzywilejowanej roli DB to osobna, nieukończona pozycja z Gate A).

Dodatkowa uwaga techniczna: pierwsza próba tego testu zawiesiła się na kilka minut (padły
połączenia w stanie `idle in transaction (aborted)`), bo `SET LOCAL app.organization_id = $1` z
parametrem bindowanym nie jest poprawną składnią SQL — `SET` nie akceptuje placeholderów. Zamiast
tego użyłem `SELECT set_config('app.organization_id', $1, true)`, które JEST parametryzowalne i
semantycznie identyczne do `SET LOCAL`. Ta sama sesja miała też osobny, prawdziwy błąd: funkcja
sprzątająca po tej roli (`REVOKE`+`DROP ROLE`) czyściła tylko uprawnienie na `compute_jobs`, nie
uprawnienie `CONNECT` na bazę nadane osobno — więc `DROP ROLE IF EXISTS` cicho zawodził (pusty
`catch{}`) i zostawiał rolę na klastrze po każdym uruchomieniu. Potwierdzone: 5 osieroconych ról
`j4_restricted_*` na klastrze przed naprawą. Naprawione (`8be7acaa94`), potwierdzone: 0 osieroconych
ról po naprawie.

---

## 7. Cross-org podstawione identyfikatory (uzupełnienie do zakresu J2)

Trzy kontrole, org-A caller podstawiający `businessVersionId`/`artifactId` należący do org-B:

| id | endpoint | oczekiwane | wynik |
|---|---|---|---|
| `RULE-CROSSORG-GET-VERSION` | `GET /versions/:id` | 404 NOT_FOUND | **PASS** |
| `RULE-CROSSORG-TRANSITION` | `POST /versions/:id/transitions` | nigdy 200, wiersz bez zmian | **PASS** |
| `RULE-CROSSORG-APPROVE` | `POST /models/:id/approve` | 404 (getArtifact org-scoped) | **PASS** |

Wszystkie trzy org-scoping guardy (`getBusinessVersion(organizationId, ...)`,
`getArtifact(organizationId, ...)`) trzymają się poprawnie dla powierzchni, którą steruje ten
probe. To jest dodatkowe, wąskie potwierdzenie w obszarze RBAC — pełny audyt cross-tenant (inne
tabele, inne endpointy) to mandat J2, nie powtarzany tu w całości.

---

## 8. Liczba kontroli — zadeklarowane vs wykonane

Zadeklarowane w kodzie sondy (policzone programowo — liczba unikalnych literałów `id:` w
wywołaniach `record()`, z uwzględnieniem dwóch pętli `LEGAL_CASES`×8 i `ILLEGAL_CASES`×7): **37**.

Finalny przebieg (`/tmp/j4_evidence_final.log`, PID 75433, `EXIT_CODE=1` — oczekiwane, bo są
prawdziwe FAIL-e):
```
COMMAND: RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test DATABASE_URL=postgresql://piotrwisniewski@127.0.0.1:54330/j4_rerun npx tsx scripts/finance-v3-audit/j4-rbac-probe.ts --json=/tmp/j4_evidence_final.json
PID=75433
EXIT_CODE=1
DURATION_S=32          (ściana czasu procesu node, mierzona z zewnątrz)
```
Z logu (każde polecenie liczące uruchomione OSOBNO na zapisanym pliku):
- `grep -c "^\[PASS\]"` → **33**
- `grep -c "^\[FAIL\]"` → **4**
- suma → **37** — zgodne z liczbą zadeklarowaną, **zero różnicy, zero kontroli pominiętych**
- `grep -c "fatal error"` → **0** — proces nie padł w trakcie
- linia podsumowania sondy: `j4-rbac-probe: 37 checks, 4 FAIL, duration 913ms` (czas wewnętrzny,
  liczony od `t0` do końca `main()` — różni się od `DURATION_S=32` bo nie obejmuje startu
  procesu node/tsx/importu modułów, ani asynchronicznego bootstrapu schematu
  `PostgresDatabase.ts`, który loguje się PO zakończeniu `main()`)

4 FAIL to DOKŁADNIE te same 4 potwierdzone defekty z §1/§2 — brak niewyjaśnionej rozbieżności.

`exit 134` (OOM) nie wystąpił w żadnym z przebiegów tej sesji (wszystkie EXIT_CODE to 0 albo 1).

---

## 9. Co NIE zostało dostarczone i dlaczego

- **Pełna macierz dla akcji `read`/`edit`/`compute`/`export`** (poszerzony zakres z wznowienia) —
  częściowo pokryta pośrednio (`RULE-CROSSORG-GET-VERSION` = `read`; `RULE-NA-EXCLUDED-VS-FORGOTTEN`
  dotyka `edit`/`compute` przez `mapStatementLines`), ale NIE zbudowałem pełnej osobnej macierzy
  rola×stan dla tych czterech akcji — powód: `read` (GET) nie ma dziś żadnej bramki roli w kodzie
  poza org-scoping (każda rola, łącznie z viewer, może czytać cokolwiek w swojej organizacji — to
  wygląda na zamierzone, nie lukę, ale nie zweryfikowałem tego jawnie dla KAŻDEGO GET endpointu w
  finance-v2), a `compute`/`export` mają własne, osobne routery (`compute.routes.ts`,
  `export-import.routes.ts`) z własną logiką roli, które nie były w pierwotnym zakresie zadania i
  zabrakło czasu sesji na ich pełne zmapowanie po dwukrotnym przebiegu całości. Rekomendacja: osobny
  krótki follow-up specyficznie dla tych czterech akcji, jeśli program tego wymaga.
- **Pełna macierz z `reviewer`** jako faktycznie osiągalną rolą — niemożliwe do zbudowania przez
  HTTP, bo `reviewer` jest strukturalnie nieosiągalna (§1.1); pokryta przez testy jednostkowe
  (`lifecycleService.test.ts`) wołające `validateTransition`/`checkSelfApproval` bezpośrednio z
  `role:'reviewer'` — nie powtarzane tu, bo to już istnieje i przechodzi (nie sprawdzałem tego
  osobno w tej sesji, poza samym faktem że plik istnieje i był wspomniany jako źródło idiomu
  `role:'reviewer'`).
- **Kolumnowe uprawnienia** (czy `preparer` widzi inne pola niż `approver` w tym samym payloadzie
  GET) — nie badane; poza zakresem zadania.

Nic z powyższego nie unieważnia P0 ani żadnego z 4 potwierdzonych defektów — są to luki w
POKRYCIU tego audytu, nie niepewność co do samych wyników.

---

## 10. Jak odtworzyć

```bash
cd /Users/piotrwisniewski/consultify-wt/fv3p-f-baseline/server

# baza (jeśli klaster fv3-pg nie działa, najpierw:
#   export PATH=/opt/homebrew/opt/postgresql@15/bin:$PATH; export LC_ALL=C
#   pg_ctl -D /Users/piotrwisniewski/fv3-pg/data -l /Users/piotrwisniewski/fv3-pg/pg.log \
#     -o "-p 54330 -k /tmp -c listen_addresses=127.0.0.1" start)
/Users/piotrwisniewski/fv3-pg/newdb.sh j4_demo   # drukuje DATABASE_URL na stdout

# pełny przebieg
RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test \
  DATABASE_URL="postgresql://piotrwisniewski@127.0.0.1:54330/j4_demo" \
  npx tsx scripts/finance-v3-audit/j4-rbac-probe.ts --json=/tmp/out.json

# pojedyncza reguła (używane przez cykl mutantów)
bash scripts/finance-v3-audit/run_probe.sh RULE-P0-VIEWER-APPROVE mylabel

# po skończonej pracy
/opt/homebrew/opt/postgresql@15/bin/dropdb -h 127.0.0.1 -p 54330 -U piotrwisniewski j4_demo
```

Pliki: `server/scripts/finance-v3-audit/j4-rbac-probe.ts` (sonda, jeden plik jak nakazano),
`server/scripts/finance-v3-audit/run_probe.sh` (wrapper dowodowy dla cyklu mutantów).

---

## 11. Sprzątanie

- `j4_rerun` (i wcześniej `j4_rbac`) — usunięte na koniec sesji (`dropdb`), zero rekordów
  testowych pozostawionych na współdzielonym klastrze `fv3-pg`.
- Zero osieroconych ról `j4_restricted_*` po naprawie z §6.
- Drzewo git czyste na koniec każdego mutanta (§5) i na koniec sesji — potwierdzone `git status
  --short` / `git diff --stat` puste bezpośrednio przed napisaniem tego zdania.
- Zero kodu produkcyjnego zmienionego trwale — wyłącznie commity dodające/poprawiające
  `server/scripts/finance-v3-audit/*` i ten raport.

## 12. Podsumowanie dla orkiestratora

**P0 potwierdzony, real HTTP + real Postgres + niezależny odczyt SQL, odtwarzalny bez żadnej
mutacji**: `POST /api/v8/finance-v2/models/:modelId/approve` nie ma kontroli roli — dowolny
`viewer` (lub `preparer` niebędący submitterem) zatwierdza wersję `IN_REVIEW`. Endpoint capability
poprawnie odmawia, prawdziwy endpoint mutujący — nie. Drugi, pokrewny, potwierdzony defekt:
self-approval łapie tylko dosłownego `submitted_by`, nie każdego edytora treści (brak danych
źródłowych do rozszerzenia — `autosaveService.ts` nigdy nie loguje edycji do
`artifact_lifecycle_events`).

Wszystko inne w zbadanym zakresie (przejścia legalne/nielegalne, terminal-state guardy,
niemutowalność APPROVED przez HTTP i przez surowe SQL, `reopen` jako nowa wersja a nie mutacja,
naprawa NA-reachability, RLS pod ograniczoną rolą, cross-org podstawione identyfikatory) —
**trzyma**, potwierdzone real-DB, z jawnym policzeniem warstw obrony przez 8 kontrolowanych
mutantów (od 1 do 3 warstw w zależności od reguły — najsłabsze punkty to pojedyncza warstwa
aplikacyjna bez żadnego backupu na poziomie bazy: mutanty #1, #2, #3, #8).
