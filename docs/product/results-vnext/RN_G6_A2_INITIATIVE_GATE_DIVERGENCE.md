# RN-G6-A2 — Rozjazd bramki decyzyjnej cyklu życia inicjatywy

**Worktree:** `/Users/piotrwisniewski/rn-g2-lanes/g6-a2`
**Branch:** `rn-g6-a2`
**HEAD:** `d6bd233a7749c8b7b9549d095bd0bc4f4151d69b` (potwierdzone `git rev-parse HEAD` na starcie)
**`git status --short`:** czysty na starcie i na końcu (zero zmian w kodzie produkcyjnym; jedyne pliki dotknięte to ten raport i trzy tymczasowe skrypty-sondy w `tests/acceptance/`, które zostały usunięte przed zakończeniem — patrz sekcja „Co ruszyłem poza allowlistą”).

## TL;DR

Twierdzenie z briefu jest **POTWIERDZONE, i jest gorsze niż napisano**. To nie jest tylko rozjazd fikstur testowych. To nie jest tylko `BROKEN_RUNTIME_CONTRACT` w sensie „zapis idzie gdzie indziej niż odczyt". To jest sytuacja, w której **żaden reachable kod produkcyjny (route/controller) nigdy nie zapisuje zatwierdzonej decyzji do kanonicznej tabeli**, którą silnik przejść czyta wyłącznie. Efekt: **każde** z pięciu przejść bramkowanych decyzją (`REVIEW→PROMOTED`, `PROMOTED→PLANNING`, `APPROVED→SCHEDULED`, `SCHEDULED/BLOCKED→EXECUTING`, `EXECUTING→DONE`) jest dziś **strukturalnie nieosiągalne** dla realnego użytkownika — nie tylko w testach.

**Klasyfikacja: `BROKEN_RUNTIME_CONTRACT`** (release blocker), z dodatkową, poważniejszą podklasą: nie „zapis idzie do A, odczyt z B", tylko „**zapis do B nie istnieje nigdzie w reachable kodzie**". Human-facing ścieżka zapisu istnieje wyłącznie dla starej tabeli `decisions`; jedyny pisarz nowej tabeli (`executeGovernedInitiativeTransition`) jest martwym, niepodłączonym kodem wywoływanym tylko przez proof-script.

---

## 1. Kanoniczne źródło prawdy (odczyt)

Jedno, jednoznaczne źródło — nowa tabela `initiative_lifecycle_gate_decisions`. Silnik przejść **w ogóle nie zna** starej tabeli `decisions` przy podejmowaniu decyzji bramkowej.

- `server/src/services/initiative/initiativeTransitionService.ts:119-133` — `hasApprovedGateDecision()`, jedyna funkcja wywoływana przy każdej z 5 bramek (linie wywołań: `733`, `763`, `795`, `1016`, `1056`, plus re-check `1220`). Woła wyłącznie `assertCurrentApprovedInitiativeLifecycleGateDecision`.
- `server/src/services/initiative/initiativeLifecycleGateDecisionService.ts:506-551` — `assertCurrentApprovedInitiativeLifecycleGateDecision()` → `readCurrentInitiativeLifecycleGateDecision()` (linia 312) → `readCurrentUnlocked()` (linia 293-309) → `SELECT * FROM initiative_lifecycle_gate_decisions WHERE ... ORDER BY version DESC LIMIT 1`.
- Komentarz w `initiativeTransitionService.ts:1051-1054` explicite dokumentuje intencję: „a legacy/generic approved `decisions` row is not consulted by `hasApprovedGateDecision`" — to jest **świadoma decyzja architektoniczna**, nie przeoczenie.
- Migracja `server/migrations/20260810_t01_initiative_lifecycle_gate_decisions.sql:1-6` też to mówi wprost: „This table is intentionally separate from the broad legacy `decisions` aggregate."

## 2. Historia migracji obu tabel

- **`decisions`** (stara) — istnieje od dawna, wielokrotnie modyfikowana (np. `20260803_decision_boolean_schema_normalization.sql`); szeroka, ogólna tabela do wielu typów decyzji (`GO_NO_GO`, `APPROVAL`, `RESOURCE_ALLOCATION`, `SCOPE_CHANGE`, ...), używana też poza inicjatywami.
- **`initiative_lifecycle_gate_decisions`** (nowa) — `server/migrations/20260810_t01_initiative_lifecycle_gate_decisions.sql`. `CREATE TABLE IF NOT EXISTS`, immutable-by-design (trigger `reject_initiative_lifecycle_gate_decision_mutation` blokuje `UPDATE`/`DELETE`, wymusza append-only wersjonowanie). Struktura wymaga **NOT NULL FK** do `v8_agent_proposal_versions.a05_proposal_version_id` i `v8_agent_proposal_scope_reviews.a05_approval_receipt_ref` — czyli każdy wiersz musi być powiązany z zatwierdzoną propozycją agenta AI (v8 „A05" governance).
- **Brak backfillu.** Migracja `20260810_t01_initiative_lifecycle_gate_decisions.sql` zawiera tylko `CREATE TABLE`/`CREATE INDEX`/`CREATE TRIGGER` + osobny `DO $$` blok, który wypełnia `v8_tool_catalog`/`v8_consumer_tool_policies` (rejestrację narzędzia agenta), **zero `INSERT ... SELECT FROM decisions`**. Sprawdzone `grep`-em po całym pliku migracji — nie ma żadnego backfillu danych ze starej tabeli.

## 3. Produkcyjna ścieżka ODCZYTU

Jedna, jednoznaczna: silnik przejść czyta wyłącznie `initiative_lifecycle_gate_decisions` (sekcja 1). Zero fallbacku, zero odczytu zgodnościowego ze starej tabeli.

## 4. Produkcyjna ścieżka ZAPISU — pytanie kluczowe

**Znalezisko krytyczne: dwa rozłączne, nigdy niepotwierdzone łączące się światy zapisu.**

### 4a. Standardowa (human-facing) ścieżka zapisu decyzji → wyłącznie STARA tabela

- `server/src/services/decisionService.ts:234` — `INSERT INTO decisions (...)`. To jedyny production writer decyzji dla ludzkiego przepływu (moduł Decisions).
- Podłączony przez `server/src/controllers/DecisionController.ts` (import `decisionService` potwierdzony), trasy w `server/src/routes/work-canvas.routes.ts`, `server/src/routes/v8/interview-insights.routes.ts`, `server/src/routes/economics.routes.ts`.
- `DecisionController.ts:479-489` (funkcja `decide()`, cascade-unblock po zatwierdzeniu decyzji) — po zatwierdzeniu decyzji w STAREJ tabeli, kod **próbuje** odblokować inicjatywę wołając `executeInitiativeTransition`, i **jawnie dokumentuje w komentarzu**, że odmowa `GATE_DECISION_REQUIRED` w tym miejscu jest „CORRECT, EXPECTED outcome" — deweloper wiedział, że zatwierdzenie starej-tabelowej decyzji NIE satysfakcjonuje bramki, i zaakceptował to jako projektowo poprawne zachowanie (initiative zostaje `BLOCKED`).

### 4b. Jedyny production writer NOWEJ tabeli → funkcja nigdy niewywoływana przez żaden route

- `server/src/services/initiative/initiativeLifecycleGateDecisionService.ts:464` — `INSERT INTO initiative_lifecycle_gate_decisions (...)` wewnątrz `recordInitiativeLifecycleGateDecision()`.
- Jedyny nie-testowy, nie-proof-script caller: `server/src/services/v8/transformationInitiativeTransitionAdapterService.ts:233` (wewnątrz `executeGovernedInitiativeTransition`, eksportowanej z linii 61).
- **`executeGovernedInitiativeTransition` nie ma ŻADNEGO callera w `server/src/routes/**` ani `server/src/controllers/**`.** Zweryfikowane trzema niezależnymi `grep`ami po całym `server/src`:
  - `grep -rn "executeGovernedInitiativeTransition" server/src` → tylko `server/src/scripts/t01InterviewRealDbProof.ts` (4 wywołania) i definicja w `transformationInitiativeTransitionAdapterService.ts:61`.
  - `grep -rn "transformationInitiativeTransitionAdapterService" server/src` → te same dwa pliki, zero innych.
  - `grep -rln "'transformation.initiative_lifecycle.transition'"` (nazwa narzędzia w rejestrze v8) → te same dwa pliki; brak generycznego dispatchera tool-name→handler, który mógłby to wołać pośrednio w runtime.
- Migracja rejestruje to narzędzie w `v8_tool_catalog`/`v8_consumer_tool_policies` (`20260810_t01_initiative_lifecycle_gate_decisions.sql`, blok `DO $$` na końcu) jako `risk_class='high_risk'`, `default_approval_mode='policy_approvable'` — czyli architektonicznie jest to narzędzie **agenta AI**, wymagające pełnego łańcucha A05 (proposal → scope review → approval receipt), nie zwykłej ludzkiej akcji „zatwierdź Go/No-Go".

**Wniosek 4:** to nie jest „UI zapisuje do starej, runtime czyta z nowej" w prostym sensie „ktoś zapomniał przepiąć". To jest: **istnieje w kodzie kompletna, świadomie zaprojektowana ścieżka zapisu do nowej tabeli (agentowa, A05-governed), ale nic w reachable production kodzie jej nie wywołuje.** Human-facing „zatwierdź Go/No-Go" (moduł Decisions) pisze do zupełnie innej, niekompatybilnej tabeli i strukturalnie **nie może** zasilić nowej (brak UI/API do wypełnienia wymaganych pól: `a05_proposal_version_id`, `a05_approval_receipt_ref`, `source_digest`, `baseline_refs_json` itd. — to nie są pola, które człowiek klikający „Zatwierdź" w standardowym module Decisions kiedykolwiek wypełnia).

## 5. Backfill / odczyt zgodnościowy

**Nie istnieje.** Ani backfill w migracji (sekcja 2), ani odczyt fallback w `hasApprovedGateDecision`/`readCurrentInitiativeLifecycleGateDecision` (sekcja 1 — kod czyta wyłącznie nową tabelę, bez żadnego `UNION`/`COALESCE`/drugiego zapytania do `decisions`).

## 6. Liczba rekordów w obu tabelach (świeże środowisko testowe, pełne migracje)

Postawiłem Postgres 17 lokalnie (`127.0.0.1:55891`, `LC_ALL=C LANG=C`, `initdb --locale=C`, gniazdo `/tmp/rn-a2-sock`), uruchomiłem `server/scripts/migrate.postgres.ts` **bez `--safe`** — **0 błędów, 0 skipped, wszystkie migracje zbieżne** (`✅ Postgres migrations complete`).

Na świeżej bazie `rn_a2_fresh_check` (zero seedów, zaraz po migracjach):

```sql
SELECT (SELECT count(*) FROM decisions) AS decisions,
       (SELECT count(*) FROM initiative_lifecycle_gate_decisions) AS lifecycle_gate_decisions;
-- decisions | lifecycle_gate_decisions
-- ----------+--------------------------
--         0 |                        0
```

Obie tabele startują puste — zgodne z brakiem backfillu (sekcja 5). To nie rozstrzyga samo w sobie nic o produkcji/demo (nie miałem i nie próbowałem dostępu do żywej bazy demo/dev — poza zakresem tej sondy i zakazane przez mandat), ale potwierdza, że **na czystej instalacji nowa tabela nie dostaje żadnych danych automatycznie**.

## 7. Wynik reprodukcji empirycznej (real Postgres, real router, real auth)

Środowisko: `rn_a2_test`, migracje bez `--safe`, `NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false`, żądania przez `supertest` przeciw prawdziwemu `server/src/routes/pmo/initiatives.routes.ts` + prawdziwemu `verifyToken`.

### 7a. Test z rejestru: `tests/acceptance/h16-start-execution.e2e.test.ts`

Uruchomiony 1:1 (bez modyfikacji) przez `npx vitest run --config vitest.acceptance.config.ts tests/acceptance/h16-start-execution.e2e.test.ts`:

```
✓ bez tokenu → 401
✓ DRAFT → 400 (INVALID_TRANSITION)
✓ REGRESJA H16: APPROVED → 400 INVALID_TRANSITION
× PRAWDZIWA ścieżka happy-path: SCHEDULED + zatwierdzona decyzja GO/NO-GO → 200 ...
   AssertionError: expected 400 to be 200
× uruchomiona inicjatywa JEST widoczna w GET execution summary
   AssertionError: expected 400 to be 200
Test Files  1 failed (1)
Tests  2 failed | 3 passed (5)
```

Dokładnie zgodne z twierdzeniem z briefu — 2 z 5 testów w tym pliku padają, oba na happy-path który wstawia decyzję do STAREJ tabeli (`insertGoDecision`, `h16-start-execution.e2e.test.ts:122-131`, `INSERT INTO decisions ... 'GO_NO_GO' ... 'GOVERNANCE_DECISION_MAKING'`).

### 7b. Sonda ad hoc — decyzja w STAREJ tabeli → wynik przejścia

Napisałem tymczasowy skrypt (`tests/acceptance/__probe_gate_readonly.mjs`, usunięty po użyciu — patrz „Co ruszyłem poza allowlistą"), który 1:1 replikuje `insertGoDecision` z testu H16, ale przez pełny, niezależny zestaw org/user/project/initiative, i woła realny endpoint:

```
STATUS: 400
BODY: {
  "error": "Go/No-Go decision is required to start execution of this initiative",
  "rule": "GATE_DECISION_REQUIRED",
  "initiativeId": "probe--init-scheduled"
}
```

**Decyzja w starej tabeli → transition ZAWSZE 400 GATE_DECISION_REQUIRED**, niezależnie od statusu/pmo_domain w `decisions`.

### 7c. Sonda ad hoc — decyzja w NOWEJ tabeli → wynik przejścia

Drugi tymczasowy skrypt wstawił wiersz bezpośrednio do `initiative_lifecycle_gate_decisions`, z pełnym łańcuchem FK spełnionym ręcznie (`transformation_cases`, `v8_agent_proposal_versions` status `approved`, `v8_agent_proposal_scope_reviews` decision `approved`) — czyli dokładnie to, co *musiałaby* zbudować realna ścieżka A05, gdyby istniała podłączona:

```
STATUS: 200
BODY: {
  "success": true,
  "message": "Initiative execution started",
  "initiativeId": "probe2--init-scheduled",
  "newStatus": "EXECUTING"
}
DB ROW AFTER: { status: 'EXECUTING', execution_started_at: 2026-08-12T15:41:58.744Z }
```

**Decyzja w nowej tabeli → transition 200, stan realnie zapisany w bazie** (`status='EXECUTING'`, `execution_started_at` ustawiony). To definitywnie rozstrzyga: silnik działa poprawnie WEDŁUG SWOJEJ WŁASNEJ architektury — problem nie jest w logice porównania, tylko w tym, że nic po stronie produkcyjnej nie potrafi dostarczyć takiego wiersza (sekcja 4b).

## 8. Czy `catch` maskuje błąd infrastruktury — DOWÓD

**Tak, potwierdzone empirycznie, nie tylko czytaniem kodu.**

Kod: `server/src/services/initiative/initiativeTransitionService.ts:129-133`:
```ts
try {
  const decision = await assertCurrentApprovedInitiativeLifecycleGateDecision(client, {...});
  return { ok: true, decisionId: decision.decisionId };
} catch {
  return { ok: false, decisionId: null };
}
```
Pusty `catch {}` — łapie **wszystko**: strukturalne `InitiativeLifecycleGateDecisionError` (`INITIATIVE_GATE_DECISION_NOT_FOUND` linia 513, `_NOT_APPROVED` linia 520, `_EXPIRED` linia 527 w `initiativeLifecycleGateDecisionService.ts`), ale też dowolny surowy błąd SQL (`relation does not exist`, błąd uprawnień, timeout, cokolwiek rzucone przez `client.query`). Brak `logger.error`/`logger.warn`, brak rozróżnienia kodu błędu, brak re-throw.

**Empiryczny dowód:** w mojej sandboxowej bazie tymczasowo zmieniłem nazwę tabeli (`ALTER TABLE initiative_lifecycle_gate_decisions RENAME TO ..._renamed_for_probe`, wyłącznie w moim jednorazowym `rn_a2_test`, przywrócone natychmiast po teście — nie dotyka to żadnego pliku migracji ani współdzielonej bazy) — czyli symulacja prawdziwego błędu infrastruktury (`relation "initiative_lifecycle_gate_decisions" does not exist`). Trzeci skrypt-sonda wywołał ten sam endpoint na SCHEDULED inicjatywie bez żadnej decyzji nigdzie:

```
STATUS (with table renamed away / missing): 400
BODY: {
  "error": "Go/No-Go decision is required to start execution of this initiative",
  "rule": "GATE_DECISION_REQUIRED",
  "initiativeId": "probe3--init-scheduled"
}
```

**Identyczna odpowiedź jak w normalnym przypadku „brak decyzji".** Zerowa różnica dla klienta API czy dla logów aplikacji między „nikt jeszcze nie podjął decyzji" a „tabela bramkowa zniknęła / migracja padła / błąd SQL". To jest **osobny defekt** — nawet gdyby ścieżka zapisu 4b była podłączona, awaria samej tabeli/kolumny/uprawnień na produkcji byłaby nierozróżnialna od zwykłego stanu biznesowego, więc żaden monitoring/alert oparty na kodzie błędu jej nie wyłapie.

## KLASYFIKACJA: `BROKEN_RUNTIME_CONTRACT`

Uzasadnienie:
1. Odczyt (silnik przejść) i jedyny istniejący human-facing zapis (moduł Decisions → `decisions`) są **strukturalnie niekompatybilne** — nie „różne tabele przypadkiem", tylko różne schematy z różnymi wymaganymi polami (A05 governance chain vs. proste pola decyzji).
2. Jedyna ścieżka zapisu zgodna ze schematem odczytu (`executeGovernedInitiativeTransition`) **istnieje w kodzie, ale nie jest podłączona do żadnego route'a** — jest martwym kodem osiągalnym wyłącznie z proof-scriptu deweloperskiego.
3. Efekt na produkcji (nie tylko w testach): **wszystkie 5 przejść bramkowanych decyzją w cyklu życia inicjatywy są dziś niewykonalne przez żadnego użytkownika** — `REVIEW→PROMOTED`, `PROMOTED→PLANNING`, `APPROVED→SCHEDULED`, `SCHEDULED/BLOCKED→EXECUTING`, `EXECUTING→DONE`. To nie „18 testów w 6 plikach pada" — to cały moduł PMO Initiatives jest zablokowany za tym punktem dla realnych klientów, jeśli ten kod trafi/jest na środowisku z żywym ruchem.
4. Dodatkowo (punkt 8): nawet gdyby ścieżka zapisu istniała, błąd infrastruktury byłby nierozróżnialny od stanu biznesowego „brak decyzji" — co ukrywałoby przyszłe awarie tej samej klasy.

To NIE jest `STALE_FIXTURES` — naprawienie samych fikstur (wstawianie do nowej tabeli zamiast starej) zamaskowałoby ten problem w testach, nie naprawiając faktu, że żaden prawdziwy użytkownik nie ma sposobu wygenerowania takiego wiersza.

To NIE jest (wyłącznie) `MISSING_MIGRATION` — nie chodzi o osierocone dane historyczne (sekcja 6 pokazuje, że i tak obie tabele są puste na świeżej instalacji), tylko o brak jakiejkolwiek działającej ścieżki zapisu going forward.

## Plan naprawczy (BEZ WYKONANIA — decyzja należy do orkiestratora)

Trzy warianty, rosnący zakres:

**A. Minimalny „unblock" (szybki, ryzykowny architektonicznie):** dodać wąski, human-facing writer do `initiative_lifecycle_gate_decisions`, wołany np. z `DecisionController.decide()` po zatwierdzeniu decyzji `GO_NO_GO`/`GOVERNANCE_DECISION_MAKING` (i analogicznie dla `SCHEDULE_MILESTONES`, `RESOURCE_RESPONSIBILITY`, `CLOSURE`) — wypełniający wymagane A05-pola wartościami syntetycznymi/no-op (np. dedykowany „human-direct" proposal-version/review rekord zamiast prawdziwego agentowego). Ryzyko: obchodzi sens kolumn `a05_*` (które explicite reprezentują governance AI-agenta), może zaciemnić przyszłe audyty „czy ta decyzja przeszła przez agenta".

**B. Właściwe podłączenie istniejącej ścieżki (`executeGovernedInitiativeTransition`):** zbudować/podłączyć realny route lub UI-flow, który faktycznie przepuszcza ludzką decyzję przez A05 (proposal → scope review → approval receipt) zanim wywoła `executeGovernedInitiativeTransition`. To jest zgodne z intencją migracji („intentionally separate", `high_risk`/`policy_approvable` w tool catalog) ale wymaga zrozumienia całego A05/A06 governance UI, którego status/dojrzałość nie był przedmiotem tej sondy.

**C. Zdecydować świadomie, że gate ma zostać wyłączony/złagodzony do czasu B:** np. feature-flag wokół `hasApprovedGateDecision` (dziś brak jakiegokolwiek flaga — sekcja z cytatami linii 700-1070 pokazuje unconditional check), żeby nie blokować całego PMO Initiatives lifecycle na produkcji, jeśli A05-flow nie jest jeszcze gotowy do użycia przez ludzi.

**Niezależnie od wariantu:** napraw `catch` w `initiativeTransitionService.ts:129-133`, żeby rozróżniał `InitiativeLifecycleGateDecisionError` (biznesowe „brak/wygasła/niezatwierdzona decyzja" → dzisiejsze zachowanie OK) od innych błędów (infrastruktura/SQL → powinno się propagować jako 500 + log, nie cichy 400).

## Czego to NIE dowodzi

- Nie sprawdzałem stanu środowiska demo/dev/prod (`trolley`/`thomas`/`centerbeam` wg MEMORY) — cała reprodukcja była na moim jednorazowym, lokalnym Postgresie. Nie wiem, czy ten branch/HEAD jest w ogóle wdrożony gdziekolwiek z żywym ruchem, ani czy któraś z tabel ma tam dane historyczne inne niż 0/0.
- Nie sprawdzałem dojrzałości/statusu całego pipeline'u A05 (proposal/review/governance UI) — możliwe, że gdzieś istnieje plan/praca w toku, żeby to podłączyć (Wariant B), której nie widziałem w tym zakresie sondy.
- Nie sprawdzałem pozostałych 4 z „6 plików / 18 testów" wymienionych w briefie (`odbior--ini005--canonical-start-execution`, `--autostart-system-actor`, `--unblock-timeline-lockdown`, `integrate--decision-initiative-block-gate`, `--decision-race`) — zweryfikowałem mechanizm źródłowo i przez `h16-start-execution.e2e.test.ts` (2/5 failing tam), oraz niezależnie przez własne sondy; nie uruchamiałem pozostałych plików testowych z tej listy, więc nie potwierdzam ich dokładnej liczby/przyczyny 1:1 (choć mechanizm bazowy jest ten sam i w pełni zweryfikowany).
- Nie testowałem współbieżności/race ani zachowania `TransitionGateSupersededError` (re-check linia 1220) — poza zakresem tej sondy.

## Co ruszyłem poza allowlistą

Nic trwałego. W trakcie sondy utworzyłem trzy tymczasowe skrypty diagnostyczne w `tests/acceptance/` (`__probe_gate_readonly.mjs`, `__probe_gate_new_table_readonly.mjs`, `__probe_gate_infra_error_readonly.mjs`) — mieszczą się w allowliście `tests/**`, ale usunąłem je po użyciu, żeby nie zostawiać ad hoc artefaktów bez czystego cleanupu (immutable trigger na nowej tabeli uniemożliwił automatyczny `DELETE` w jednym z probe'ów — patrz log w sekcji 7c/8). Cała reprodukcja była na wyłącznie moim, jednorazowym Postgresie (`127.0.0.1:55891`, katalog danych `/tmp/rn-a2-pgdata`, gniazdo `/tmp/rn-a2-sock`) — zatrzymany (`pg_ctl stop`, dokładny PID) i skasowany na końcu. Nie dotykałem `55821` (drugi tor). Zero push/merge/deploy/subagentów. Nie modyfikowałem pięciu zakazanych plików. `git status --short` na koniec — czysty (poza tym raportem).
