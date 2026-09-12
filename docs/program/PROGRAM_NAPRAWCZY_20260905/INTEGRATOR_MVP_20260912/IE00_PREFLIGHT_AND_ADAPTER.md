# IE-00 — preflight i adapter decyzji, 2026-09-12

**READY_FOR_CODE_START po zwolnieniu slotu Interview przez integratora.** Wyłącznie odczyt; żadnej implementacji, migracji, bazy, builda ani testu w tym preflight. Wnioski o zachowaniu są SOURCE_FINDING / NOT_PROVEN runtime. Nie ogłaszam zamknięcia historycznego C7 ani pełnych 12 stanów.

## 1. Stanowisko i mandat

- WT `/Users/piotrwisniewski/Developer/codex-wt/codex7-zatwierdzanie`; branch `codex/ie00-governance-20260912`; exact HEAD `ee397109a072b41a39a938fdd48c267f0d58e9e2`; `git status --short --branch` czysty.
- Stary raport odczytany przez `git show 590915fc89:docs/program/PROGRAM_NAPRAWCZY_20260905/CODEX7_ZATWIERDZANIE_INICJATYW/98_RAPORT.md`. Na nowej bazie ten plik nie istnieje; nie odtwarzano ani nie usunięto historii.
- Brak AGENTS.md w WT i sprawdzonych katalogach nadrzędnych. Przeczytano całą instrukcję C7 oraz Z1–Z24 C4. Nowsze polecenie integratora zastępuje starą gałąź/marker i dawny STOP braku miejsca UI.
- Odczytano owner function canon oraz cały indeksowany pakiet `docs/modules/initiatives-execution-canon/00…12`. Ucięte fragmenty wyjść doczytano osobno. Nowsza notatka i DEC-2026091202 zastępują stare menu 4/5; zachowują role, snapshoty i lifecycle.
- DEC-2026091202 w indeksie programu: linia654. Root zaakceptował teraz techniczny adapter wg documentOrigin: runtime DEFINITION pozostaje własną canonical Decision, legacy Case/A05 tylko dla rzeczywistego Case; wspólny aktywny presenter; bez zamiany Definition w GO i bez fake Case. Pełne 12 stanów i dalsze gates pozostają w kolejce.
- `df -h /`: 11 GiB wolnego. `docker ps -a`: brak `cx-codex7-pg`; `lsof` dla6458/4217/5217/5598: brak listenerów. Odczyt nie rezerwuje zasobów. Nie uruchamiać full restore ani cudzego kontenera; po START potwierdzić przydział6458/cx7*/API4217/UI5217/harness5598.
- Freeze sprawdzony w rzeczywistym JSON: `InitiativeDocumentView.tsx` →05_INITIATIVES; `DecisionsPanelContent.tsx` →07_MY_WORK_AGENT; `runtimeApi.ts` →WSPOLNE. Przy commitach użyć DEC-2026091202 oraz właściwych znaczników, w tym07 dla aktywnego panelu; hook nie może być obchodzony.

## 2. Zmierzony przewód i trzy różne kontrakty

| Kontrakt | Aktywny lub istniejący przewód | Wniosek |
|---|---|---|
| Nowa Initiative runtime-v1 | `src/services/initiativeWriteTruth.ts:createInitiativeWriteTruth` →submit/registerSourceProposal →`server/src/domain/initiatives-execution/registerInitiative.ts` →`ie_aggregate_state`, `REGISTERED_DRAFT` | Nie wymaga z definicji legacy `initiatives` ani Transformation Case. Nie fabrykować ich tylko dla starego CTA. |
| Definition runtime-v1 | `definitionDecision.ts:requestDefinitionDecision/decideDefinition` →material UoW →related aggregate `decision`, relation `INITIATIVE_DEFINITION_DECISION`, wymagane cardVersions/policy, gate i `DEFINED` w tej samej komendzie | Właściwa decyzja Definition już istnieje. Nie jest biznesowym GO do backlog i nie ma stać się legacy receipt. |
| Legacy lifecycle GO | `initiativeLifecycleGateDecisionService.ts:recordInitiativeLifecycleGateDecision` →append-only `initiative_lifecycle_gate_decisions`; `initiativeTransitionService.ts:126` czyta wyłącznie tę tabelę | Wymaga rzeczywistej Case lineage, A05 proposal/scope-review, aktywnego człowieka, deadline i advisory lock; generic Decision nie odblokowuje GO. |
| Aktywna lista My Work | `DecisionsPanelContent.tsx:856` Api.getDecisions; :1020/:1046/:1314 Api.decideDecision →`DecisionController.ts:1604` →finalizeDecisionTransition nad `decisions` | Nie konsumuje samoczynnie Definition ani A05; zwykłe approve nie jest dowodem gate decision. |
| Aktywna karta status | `InitiativeDocumentView.tsx:3328` commitStatusTransition →`initiativeWriteTruth.ts:updateInitiativeStatusWriteTruth` →PATCH `/initiatives/:id/status` | Wymaga rozdzielenia wg źródła. Obecne źródło lokalnie wpisuje targetStatus po komendzie, choć refresh może oddać null; nowe działanie ma ufać cold readback, nie żądanemu statusowi. |

Istniejące czytniki runtime: `postgresInitiativeReader.ts:listPendingDefinitionDecisions` i `listMyGateSignoffs`; montowane `/runtime-v1/my-work/definition-decisions` (:2908) oraz `/runtime-v1/my-work/gate-signoffs` (:7704). API klienta już ma listMyDefinitionDecisions, getMyGateSignoffs, requestDefinitionDecision, decideDefinition i późniejsze analysis/portfolio itd. Nie potrzeba drugiej kolejki ani tabeli.

**Zakaz dotyczy całego starego stosu**, nie tylko Definition: `src/components/MyWork/__tests__/MyWorkHub.decisionsOwnerFeedback.test.ts` wyklucza także GateSignoffQueue, Analysis/Portfolio/Schedule/Handoff/Delivery/Closure i inne kolejki. Reuse kontraktów i logiki, nie import/montaż tych komponentów.

## 3. Rzeczywisty adapter Case/A05 już istnieje

`server/src/services/v8/transformationInitiativeTransitionAdapterService.ts`:

1. `proposeEarlyInitiativeTransition` ładuje istniejący `loadTransformationAgentExecutionContext`; wymaga Case execution_run_id, canonical run identity, lineage i agent definition. Następnie weryfikuje Case→Initiative i plan, członkostwa oraz rejestruje A05 przez `registerGovernedProposal`.
2. A05 review ma istniejącą trasę `server/src/routes/v8/agent-proposals.routes.ts:95`; ten sam scope reviewer zapisuje prawdziwy review receipt.
3. `executeApprovedEarlyInitiativeTransition` (:166) konsumuje zatwierdzone review; w jednej `withPgTransaction` wywołuje writer receipt (:201) i `executeInitiativeTransition` z tym samym clientem (:219), a efekty postcommit odkłada.
4. API już montuje `/:id/lifecycle-transition-proposals`, `/:id/lifecycle-transition-executions` oraz `/:id/lifecycle-gate-decisions` w `server/src/routes/pmo/initiatives.routes.ts:3865–4020`.

**Nie jest gotowym uniwersalnym rozwiązaniem.** Przygotowanie hardcoduje Sponsor/Steering zamiast effective profile; digest zawiera Case/status/baseline refs, nie pełną materialną treść karty. Retry wykonania po udanym status change może ponownie wejść w expectedCurrentStatus — wymaga osobnego runtime pomiaru przed deklaracją idempotencji całej operacji. To kandydat reuse dla prawdziwego legacy Case, nie powód do przeniesienia nowych runtime rekordów wstecz.

## 4. Proponowany adapter — przyjęty kierunek integratora

### Wspólna projekcja, jawny właściciel komendy

W aktywnej liście i detail użyć typed envelope z minimalnymi polami: `sourceContract`, `decisionId`, `initiativeId`, `initiativeOrigin`, `gate`, `decisionVersion`, `initiativeVersion`, `policyId/policyVersion`, capabilities, source snapshot refs, immutable receipt/readback refs oraz stan synchronizacji. Proponowane discriminants `RUNTIME_INITIATIVE_GATE`, `LEGACY_CASE_A05_GATE`, `CLASSIC_DECISION` są typem adaptera, nie nowym lifecycle ani magazynem.

- Tożsamość row/navigation zawiera źródło+ID; użytkownik otwiera dokładnie ten sam Decision ID z karty i My Work. Nie nadawać zastępczego generic ID tylko dla tabeli.
- Query mapuje trzy zastane źródła do istniejącego renderera. Listy pending nie są dowodem historii; adapter musi mieć również readback decyzji zwróconej/zatwierdzonej po reload.
- Handler routuje wyłącznie po zweryfikowanym sourceContract; server ponownie sprawdza source/relations/org/project i expectedVersion. Nie przechodzi po404/403/409 na drugi writer.
- `documentOrigin` jest informacją routingu, nie uprawnieniem. Backend potwierdza właściwy aggregate; mieszany classic+runtime rekord używa zatwierdzonej mapy adopcji/ownership, nie heurystyki „pierwsza udana odpowiedź”. Niejednoznaczność daje finding zamiast write.
- Tasklist/My Work: gate request i remediation zachowują native Task/Decision ID oraz source relation; brak kopiowania do `tasks`/`decisions` wyłącznie żeby pojawiły się na starej liście. Snooze, bulk, remind/delegate muszą być dostępne tylko dla rzeczywistej obsługiwanej capability; mixed bulk nie uruchamia generic decide nad gate.
- Cold query po komendzie aktualizuje kartę/listę; brak readback to synchronization pending/retry, nigdy wymyślony status. Deep link zawiera source contract i właściwą kartę/gate; odświeżenie strony nie gubi routingu.

### Policy, materialna wersja i odmowy

Reuse `postgresGovernancePolicyResolver.ts` (PRODUCT→ORG→PROJECT→INITIATIVE, policy version i role bindings), `organizationGovernance.ts`/`gateSignoff.ts` oraz istniejący material UoW. Brak konfiguracji/binding albo cofnięte członkostwo daje odmowę, bez zastępowania adminem lub requesterem.

D-1 nadal w source: `initiativesExecutionRuntime.routes.ts:2864` łączy brak obiektu i brak initiative.review w404. Lokalnie rozdzielić widoczny rekord bez review→403 z kodem/EN+PL; foreign/missing pozostaje ukryte404. Nie zmieniać global effectiveAccess/shadow.

Definition już utrwala cardVersions i porównuje je przy approve; zbadać policy drift, nowe wymagane karty, źródło, authority revocation, return/edit/resubmit. Nie uznawać samego expectedVersion za pełny material digest. Jeden deterministyczny snapshot resolver musi przypinać wymagane karty/wersje i właściwe scope/time/cost/owner/KPI/risk/external refs, a gate checker czytać ten sam kontrakt pod transakcją. Dla legacy hasApprovedGateDecision obecnie nie podaje expectedSourceDigest do assert — stary receipt może być aktualny czasowo, ale nie dowodzi niezmienionej treści. Zmiana ma zachować immutable history; zakres diffu do wewnętrznego review przed implementacją mostu.

## 5. Kolejność kodowania i ownership

1. Po START mały real test premis: nowy runtime record/card→gate request→aktywny panel; osobno istniejący poprawny Case/A05. Zapis dwóch kontraktów i RED, bez pełnego restore.
2. Typed read/query+command adapter, najpierw Definition request/return/resubmit/approve; server authority i negative actor, same native ID. Nie implementować trzynastu bramek przez kopiowanie jednego handlera.
3. Aktywna karta + DecisionsPanelContent routing/readback, bez nowych paneli; właściwy rationale/snapshot/CTA dla gate, wyłączenie nieobsługiwanych generic bulk.
4. Material snapshot/policy revalidation i local D-1; osobne mutacje ochrony. Legacy Case bridge dopiero z rzeczywistym payloadem i pełnym sprawdzeniem digest/retry, zachowując właściwą semantykę GO.
5. OFF parity + ON end-to-end, review exact SHA; przekazanie kontraktu zespołom IE-01/04. Następne gates i pełne12 stanów według dispatch, nie ogłoszenie ukończenia po Definition.

Wyłączność IE-00: `InitiativeDocumentView.tsx`, `DecisionsPanelContent.tsx` oraz nowe ograniczone adaptery pod `src/services/initiatives-execution/`; `runtimeApi.ts`; gate fragmenty `initiativesExecutionRuntime.routes.ts`; `definitionDecision.ts`, reader i resolver/guard tylko potrzebny zakres. Ewentualny legacy adapter `transformationInitiativeTransitionAdapterService.ts`, lifecycle receipt/transition wyłącznie po review zależności. Wspólne router/UoW/locale: integrator przydziela pojedynczego pisarza. Nie dotykać Finance, live, cudzych writerów ani masowo rejestrować Case.

## 6. Dowód i zasoby po START

Najkrótsze istniejące wzorce: `tests/integration/initiatives-execution/definitionDecision.realdb.test.ts`, `governancePolicy.realdb.test.ts`, odpowiednie gateSignoff testy, `server/src/services/initiative/__tests__/ini-mvp-gate-001-lifecycle-gate-writer.pg.test.ts`; test route z tej samej rodziny ma mocked writer i NIE zastępuje real ApiGateway/JWT/PG. `tests/e2e/initiatives-execution/aco-definition-browser.spec.ts` jest materiałem harnessowym, nie dowodem aktywnego panelu. Wymagany nowy scenariusz przez aktywną kartę i listę.

Stały mianownik RED→GREEN: (1) uprawniony request/return/edit/resubmit/approve, (2) widoczny bez review403, (3) foreign404/zero SQL, (4) cofnięty role/member, (5) self approval/policy/quorum, (6) stale card/digest/nowe required/policy version, (7) retry/timeout/jeden Decision i receipt, (8) rollback wielorekordowej awarii, (9) cold reload tej samej decyzji w karcie i My Work, (10) wrong sourceContract bez fallbacku, (11) runtime-only bez fikcyjnego Case, (12) real legacy A05 flow bez obejścia, (13) OFF parity. Finalny plan testów nada pełne `fullName` przed pierwszą mutacją.

UI: prawdziwe kliknięcia i reload, jasny/ciemny1440, poprawny motyw aplikacji, obserwacja delayed autosave; nie filtrować403 CLOSED. Małe testy per plik po przydziale; server tsc i build wyłącznie w pojedynczym ciężkim slocie; front esbuild per zmieniony plik, bez pełnego tsc frontu. Testowy sink powiadomień, żadnych wiadomości ludziom.

**NOT_PROVEN:** wszystkie lokalne zachowania w tym preflight, real seed/migration subset, treść i gwarancje adaptera typed query, końcowa atomowość/retry/policy/material digest, dostępność UI w każdej roli oraz parytet OFF. To kolejka wykonania, nie nowa ankieta właściciela.
