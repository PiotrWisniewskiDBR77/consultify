# ODBIÓR 207 — Propozycja zapisu (write-proposal) w czacie Teresy

**Data audytu:** 2026-08-31
**Audytor:** sesja adwersaryjna (obalanie tez wykonawcy)
**Gałąź:** `codex/day207-write-proposal-20260831` @ `/private/tmp/cx-day207-write-proposal`
**Merge-base:** `91e02b8ea8` (`github-backup/codex/m03-admin-20260824`)
**Commity:** `944a5caea4`, `1b57ef9621`, `c637cc2bde` (wip NIEZWERYFIKOWANA)

## WERDYKT: SCALIĆ PO FIX

## OCENA: B (działa przez interfejs, z nazwanymi ograniczeniami — patrz FIX 1 i 2, które
dotyczą architektonicznego długu POZA zakresem dyżuru 207, a nie samego mechanizmu propozycji)

---

## 1. Co realnie weszło (`git log --stat` od merge-base)

| Commit | Plik | Rola |
|---|---|---|
| 944a5ca | `server/src/config/FeatureFlags.ts` | nowa flaga `ENABLE_TERESA_TOOL_LOOP_WRITE` (default **false**) |
| 944a5ca | `server/src/routes/ai.routes.ts` | `onProposalToolCall` — łączy narzędzie modelu z `aiActionExecutor`, `checkChatPermission`, emituje SSE `execution_proposal` |
| 944a5ca | `server/src/services/ai/AIPipeline.ts` | wydziela `create_task`/`create_decision` z listy zwykłych narzędzi MCP do `proposalTools` (gdy flaga ON) |
| 944a5ca | `server/src/services/ai/llmService.ts` | rejestruje `proposalTools` w `callStream`; `execute()` narzędzia = wyłącznie wywołanie `onProposalToolCall`, fail-closed gdy callback brak |
| 944a5ca | `server/src/services/aiActionExecutor.ts` | nowa `requestChatToolProposal()` — mapuje `create_task`/`create_decision` na istniejący cykl życia `ai_actions` |
| 944a5ca | `server/src/services/aiPolicyEngine.ts` | drobna poprawka `safeDbGet` (patrz komit c637cc2 niżej — **anulowana**) |
| 944a5ca | 2 pliki testów backend | `day207.write-proposal.contract.test.ts`, `.static.test.ts` |
| 1b57ef9 | `src/components/AIChat/UnifiedChatPanel.tsx` | `onExecutionProposal` → dodaje wiadomość `type:'execution_proposal'`; handlery approve/reject/execute wołające istniejące `Api.approveAIAction/rejectAIAction/executeAIAction` |
| 1b57ef9 | `src/hooks/useAIStream.ts` | obsługa zdarzenia SSE `execution_proposal` |
| 1b57ef9 | `src/hooks/useActionHandler.ts` | **usunięty w całości** (532 linie) — sprawdzone: zero pozostałych importów, tylko 2 martwe komentarze w `AppRoutes.tsx:728` i `presentationWizardRedirect.ts:11` wspominają starą nazwę |
| 1b57ef9 | `src/hooks/useChatActions.ts`, `src/services/chatActionHandler.ts`, `src/components/Chat/ChatSmartSuggestions.tsx` | przewiązanie 5 nawigacyjnych akcji czatu (GENERATE_REPORT/GENERATE_PRESENTATION/USE_TEMPLATE/BROWSE_TEMPLATES/RECORD_KPI) na `/document-studio`, `/prezentacje`, `/results/kpi/:id` — **niepowiązane z mechanizmem propozycji zapisu**, czysta nawigacja |
| 1b57ef9 | `dev-render/screens/day207-write-proposal.tsx` | harness izolowanego komponentu (patrz pkt 7) |
| 1b57ef9 | 1 plik testu integracyjnego | `tests/integration/day207-write-proposal.realdb.test.ts` (189 linii) |
| c637cc2 | `server/src/services/aiPolicyEngine.ts` | **odwraca** poprawkę `safeDbGet` z 944a5ca — plik wraca 1:1 do stanu merge-base (`git diff` puste) |
| c637cc2 | `tests/integration/day207-write-proposal.realdb.test.ts` | +7 linii (komentarz o dryfcie schematu + `ALTER TABLE ... ADD COLUMN IF NOT EXISTS governance_settings`) |

**Ważne odkrycie o commicie `c637cc2bde` ("wip ... NIEZWERYFIKOWANA"):** nie jest to nieukończona
poprawka — to **net-zero rewert**. `aiPolicyEngine.ts` po tym komicie jest bajt-w-bajt identyczny
z merge-base. Sam komit "cofnął" bezpieczny `safeDbGet` (try/catch + fallback `{}`) z powrotem do
gołego `dbGet(...) || {}`, które w trybie realnego Postgresa rzuca wyjątkiem zamiast failować
łagodnie przy dryfcie schematu. Test realdb obszedł ten problem ręcznym `ALTER TABLE ADD COLUMN
IF NOT EXISTS`, więc dowód mutacyjny (pkt 5) i tak przeszedł — ale **produkcyjny kod jest dziś
mniej odporny niż w commicie 944a5ca, nie bardziej**. To nie blokuje scalenia (linia jest identyczna
z tym, co jest już na `demo`), ale wymaga świadomej decyzji, nie przypadkowego dryfu.

---

## 2. CZWARTA WARSTWA — czy komponent propozycji jest REALNIE RENDEROWANY w czacie?

Prześledzone ogniwo po ogniwie, każde zweryfikowane odczytem kodu:

1. **Handler trasy** — `server/src/routes/ai.routes.ts:4800-4870` (wewnątrz stream handlera `/api/ai/...`):
   `onProposalToolCall` woła `checkChatPermission` → `aiActionExecutor.requestChatToolProposal` →
   `emitSSE({ type: 'execution_proposal', proposalId, actionType, lifecycleState: 'pending_review', toolName })`.
2. **Rejestracja narzędzia w modelu** — `server/src/services/ai/AIPipeline.ts:439-444` wycina
   `create_task`/`create_decision` z listy zwykłych MCP-tools do `writeProposalToolDefs`, przekazuje
   jako `proposalTools` do `llmService.callStream` (AIPipeline.ts:567-581).
3. **Wykonanie narzędzia po stronie LLM** — `server/src/services/ai/llmService.ts:1307-1332`
   (wewnątrz `callStream`, linia funkcji 1142): `execute: async (args) => onProposalToolCall(def.name, args)`,
   fail-closed (`PROPOSAL_REJECTED`) gdy callback brakuje.
4. **Strumień SSE → hook** — `src/hooks/useAIStream.ts:970-981`: `evt.type === 'execution_proposal'`
   → `options.onExecutionProposal?.({ proposalId, actionType, lifecycleState:'pending_review', toolName })`.
5. **Hook → wiadomość czatu** — `src/components/AIChat/UnifiedChatPanel.tsx:1621-1646`:
   `onExecutionProposal` wywołuje `useProposalLifecycleStore.getState().patchLifecycle(...)` i
   `addChatMessage({ type: 'execution_proposal', metadata: { executionProposal: {...} } })`.
6. **Renderowanie w drzewie React** — `src/components/AIChat/UnifiedChatPanel.tsx:7261`:
   `{displayMessages.map((msg, index) => renderMessage(msg, index))}` — **realny render w liście
   wiadomości**, nie martwy kod. `renderMessage` (linia 6273) osadza `<MessageRenderer .../>` z
   pełnym zestawem propsów `onProposalApprove/Reject/Execute/Inspect` (linie 6355-6358).
7. **Przełącznik typu wiadomości** — `src/components/AIChat/MessageRenderer.tsx:621-644`:
   `V8_EXECUTION_MESSAGE_TYPES` (linia 63-67) zawiera `'execution_proposal'`; gdy `msgType` pasuje,
   funkcja **przechwytuje renderowanie PRZED zwykłą dymkiem** i zwraca `<ExecutionProposalMessage />`.

**Ogniwo nie jest przerwane.** Ścieżka handler→SSE→hook→komponent jest kompletna i realna dla
`create_task`/`create_decision`. To dobra wiadomość — ale z dwoma zastrzeżeniami:

- Komponent `ExecutionProposalMessage.tsx` i `useProposalLifecycleStore.ts` **nie są nowe** —
  istniały już w merge-base (rodzina komunikatów V8 `CHAT_V8_ACTIONS_AND_APPROVALS`, budowana pod
  inny system — asynchroniczne "execution runs"). Dyżur 207 **reużywa** gotową powłokę UI zamiast
  budować nową. To architektonicznie sensowne (jeden kanon zamiast dwóch), ale oznacza, że żaden
  NOWY test frontendowy nie sprawdza tego przełącznika — zero plików testowych w `tests/` dotyka
  `MessageRenderer.tsx`/`UnifiedChatPanel.tsx`/`useAIStream.ts` po stronie day207. Cała weryfikacja
  warstwy 4 to dziś: (a) mój odczyt kodu linia-po-linii, (b) jeden statyczny grep-test
  (`day207.write-proposal.static.test.ts`), który sprawdza WYSTĘPOWANIE literałów w plikach, nie
  zachowanie w drzewie React.
- Patrz punkt 7 niżej — dowód WIZUALNY tej ścieżki to izolowany harness, nie realny czat.

---

## 3. Czy zapis jest NAPRAWDĘ zablokowany bez zatwierdzenia?

**TAK dla ścieżki `requestChatToolProposal`, potwierdzone kodem i własną mutacją (pkt 6).**

- `server/src/services/aiActionExecutor.ts:300-311`: `requestChatToolProposal` zawsze woła
  `requestAction(..., { _forceApproval: true }, ...)`.
- `server/src/services/aiActionExecutor.ts:412`: `requiresApproval = Boolean(permission.requiresApproval
  || payload._forceApproval || isGovernedMutationAction(actionType))` — trzy niezależne przesłanki,
  każda wystarczająca.
- `server/src/services/aiActionExecutor.ts:823-824`: **właściwa brama zapisu** —
  `executeAction()` odmawia (`Action is X, not APPROVED`), jeśli `action.status !== 'APPROVED'`.
  `requestAction()` (linia 466) NIGDY nie wstawia do `tasks` — wyłącznie do `ai_actions`. Zapis do
  `tasks` istnieje jednym miejscem: `aiActionExecutor.ts:1141` wewnątrz `executeAction`, wyłącznie
  po przejściu bramy 823.
- HITL auto-decide (linia 424-460) teoretycznie mogłoby ominąć `requiresApproval`, ale dla
  `CREATE_DRAFT_TASK`/`CREATE_DRAFT_DECISION` `isGovernedMutationAction()` zwraca `true`
  (linia 122 — prawda dla wszystkiego poza `EXPLAIN_CONTEXT`/`ANALYZE_RISKS`), więc ominięcie
  wymaga **jawnej** flagi polityki organizacji (`allowLearnedAutoApproval`/`allowGovernedMutationAutoApproval`/
  `currentLevel==='AUTOPILOT'`, linia 130-140) — nie samego "wyuczonego wzorca". To pre-istniejąca
  infrastruktura (nie zmieniona w dyżurze 207), spójna z resztą Centrum Akcji.

**Obejście, którego szukałem i NIE znalazłem:** nie ma alternatywnej trasy/narzędzia czatu, które
zapisuje `tasks`/`decisions` z pominięciem `ai_actions`. `create_task`/`create_decision` są
**wycinane** z puli zwykłych narzędzi MCP właśnie po to (AIPipeline.ts:439-444) — model fizycznie
nie widzi już "zwykłej", bezpośrednio wykonującej wersji tych dwóch narzędzi, gdy flaga jest ON.

---

## 4. Trasa kanoniczna czy legacy `tasks`? — **LEGACY, gate `requireCanonicalExecutionWriter` NIE OBEJMUJE TEJ ŚCIEŻKI**

To najpoważniejsze odkrycie audytu.

- `server/src/services/aiActionExecutor.ts:1141`: `executeAction()` robi
  **bezpośrednie `INSERT INTO tasks (...)`** (poprzez `_executeCreateTask`), nie przez
  `ie_aggregate_state`/event-sourced silnik wykonania.
- Zweryfikowałem to własnym uruchomieniem `tests/integration/day207-write-proposal.realdb.test.ts`
  na realnym Postgresie wykonawcy (kontener `cx-day207-pg`, port 6147, `postgresql://postgres:cx@127.0.0.1:6147/cx207`)
  — **prawdziwe HTTP** `PATCH /api/ai/actions/:id/approve` + `POST /api/ai/actions/:id/execute`
  przez realny `ApiGateway`, realny JWT. Wynik: `SELECT ... FROM tasks WHERE organization_id=$1 AND
  project_id=$2` zwraca **1 wiersz**. 2/2 testy PASS (własny przebieg, nie log wykonawcy —
  `beforeAll` timeout 30s okazał się za krótki na rozruch pełnego Gatewaya w tym środowisku;
  podniosłem lokalnie do 120s tylko na czas uruchomienia, natychmiast przywróciłem do 30s —
  `git diff` po przywróceniu jest pusty).
- Brama `requireCanonicalExecutionWriter` (`server/src/middleware/executionSpineLegacyReadOnly.middleware.ts:22`)
  jest zamontowana WYŁĄCZNIE na `/api/execution-control` (Gateway.ts:1384-1390),
  `/api/v8/execution-control/*` (Gateway.ts:1444-1454, routes/v8/index.ts:107) i całym routerze
  `pmo/tasks.routes.ts:67`. Trasa `/api/ai/actions/:id/execute` jest zamontowana pod `/api/ai`
  (Gateway.ts:600, `app.use('/api/ai', aiRoutes)`) — **bez żadnego middleware kanonicznego zapisu**.
  Nawet gdyby była zamontowana pod chronioną ścieżką, `INSERT INTO tasks` w `aiActionExecutor.ts:1141`
  to wywołanie serwisowe wewnątrz procesu, nie osobny request HTTP do `pmo/tasks.routes.ts` —
  middleware express strukturalnie nie ma jak w to wejść.

**Wniosek:** zatwierdzenie propozycji NIE idzie trasą kanoniczną i NIE omija bramy 409 w sensie
"złamania" jej — omija ją, bo brama nigdy nie była na tę trasę nałożona. To dług architektoniczny
sprzed dyżuru 207 (executor `CREATE_DRAFT_TASK`/`_executeCreateTask` istniał już w merge-base —
`git blame`/obecność w merge-base potwierdzone), ale **dyżur 207 świadomie podłączył pod niego nowy,
promowany mechanizm "propozycji zapisu"**, więc dziedziczy dług 1:1. Skutek praktyczny: zatwierdzony
`create_task` z czatu tworzy rekord w tabeli, którą reszta systemu traktuje jako read-only-legacy —
rozjazd z resztą execution-spine (M03/Runtime-v1) jest realny, nie hipotetyczny.

---

## 5. Testy — uruchomione samodzielnie (nie logi wykonawcy)

| Zestaw | Plik(i) | Wynik własnego przebiegu |
|---|---|---|
| static + contract (mock DB) | `tests/unit/backend/day207.write-proposal.{static,contract}.test.ts` | **7/7 PASS** (esbuild/vitest per-plik) |
| realdb (prawdziwy Postgres, prawdziwy HTTP, prawdziwy JWT) | `tests/integration/day207-write-proposal.realdb.test.ts` | **2/2 PASS** na `cx-day207-pg:6147/cx207` |
| esbuild sanity (bez pełnego tsc) | 8 dotkniętych plików: `aiActionExecutor.ts`, `ai.routes.ts`, `llmService.ts`, `AIPipeline.ts`, `aiPolicyEngine.ts`, `MessageRenderer.tsx`, `ExecutionProposalMessage.tsx`, `useAIStream.ts` | **8/8 bez błędów składni/rozwiązywania modułów** |

Nie uruchamiałem pełnego `tsc`/`vitest` na całym repo (zgodnie z ograniczeniem zadania).

---

## 6. MUTACJA WŁASNYMI RĘKAMI — wynik: **brama jest realna, ale delivered test suite jej NIE testuje**

Cel: usunąć warunek wymagający zatwierdzenia i sprawdzić, czy coś czerwienieje.

**Mutacja:** `server/src/services/aiActionExecutor.ts:822` —
`if (action.status !== ACTION_STATUS.APPROVED)` → `if (false && action.status !== ACTION_STATUS.APPROVED)`
(pozwala `executeAction` wykonać się na dowolnym statusie, w tym `PENDING`, bez zatwierdzenia).

**Krok 1 — własny sondujący test** (napisany przeze mnie, nie plik dostawy — wywołuje
`requestChatToolProposal` i OD RAZU `executeAction`, pomijając `approveAction`):
- Bez mutacji: **PASS** (`execResult.success === false`, 0 zadań w `tasks`) — dowód, że brama
  aktywnie coś blokuje (nie martwy kod).
- Z mutacją: **RED** (`expected true to be false`) — mój sondujący test poprawnie wychwytuje
  ominięcie zatwierdzenia.

**Krok 2 — delivered `day207.write-proposal.contract.test.ts` z tą samą mutacją:**
**4/4 testy pozostają ZIELONE.** Żaden z czterech dostarczonych testów (blokada roli, brak
projektu, "tworzy pending", "mutuje dokładnie raz PO zatwierdzeniu") nie wywołuje `executeAction`
na niezatwierdzonym `proposal` — wszystkie idą ścieżką happy-path `approveAction()` →
`executeAction()` w tej kolejności, więc mutacja bramy `status !== APPROVED` jest dla nich
niewidoczna. To dokładnie kształt "testu-tautologii" z instrukcji audytu: log wykonawcy
(`day207-mutation-red.log`) pokazuje, że ICH mutacja (inna niż moja — prawdopodobnie w ścieżce
insertu `tasks`, bo failuje na `expected [] to have a length of 1`) wychwyciła regresję na
happy-pathie, ale **żaden test w dostawie nie mutuje/sprawdza samej bramy zatwierdzenia** — luki tej
nie widać bez własnej, niezależnej mutacji.

Mutacja przywrócona natychmiast po pomiarze — `git diff` na `aiActionExecutor.ts` jest **pusty**
(potwierdzone `git diff --stat` po rewercie). Plik sondujący (`tests/unit/backend/_adversary-day207-bypass-probe.test.ts`)
usunięty, worktree czysty (`git status --short` bez wyjścia).

---

## 7. Zrzuty light/dark — **atrapa/storybook, NIE realny kontekst czatu**

`dev-render/screens/day207-write-proposal.tsx` renderuje **wyłącznie** `<ExecutionProposalMessage />`
na pustej stronie (`<main>` z jednym `<section>`), z ręcznie sklejonym obiektem `message` — bez
`UnifiedChatPanel`, bez wątku wiadomości, bez kompozytora, bez sidebaru, bez innych wiadomości w tle.
Obejrzane oba zrzuty (`day207-write-proposal-{light,dark}.png`): pojedyncza karta propozycji na
pustym tle z etykietą "TERESA · SAME-TURN WRITE PROPOSAL" i przyciskami "Approve"/"Odrzuć"/"View run".

To **nie jest** "realny ekran w kontekście czatu" wymagany przez punkt 7 CLAUDE.md ("harness EV
football-field" jako wzór pełnego kontekstu) — jest bliżej storybooka pojedynczego komponentu.
Dodatkowo widoczna niespójność i18n: "Approve"/"View run" po angielsku, "Odrzuć" po polsku — miks
językowy w jednym komponencie (drobna usterka UI, patrz FIX 4).

Sam komponent (kolory, tokeny `c-*`, layout) wygląda spójnie z resztą aplikacji i renderuje się bez
błędów w obu motywach — to dobra wiadomość dla samego komponentu. Ale jako "pierwszy realny zrzut,
który Piotr ma zobaczyć" (reguła 7 CLAUDE.md) — nie spełnia ducha zasady: Piotr nie zobaczy, JAK to
wygląda WEWNĄTRZ wątku czatu (obok innych wiadomości, kompozytora, historii) dopóki ktoś nie
wykona osobnego renderu w realnym `UnifiedChatPanel`.

---

## FIX-y (ponumerowane, z plik:linia)

1. **[BLOKUJĄCY dla pełnego zaufania do trasy zapisu, nie dla samego mechanizmu propozycji]**
   Podłączyć zatwierdzoną propozycję `CREATE_DRAFT_TASK`/`CREATE_DRAFT_DECISION` pod kanoniczny,
   event-sourced writer zamiast bezpośredniego `INSERT INTO tasks` —
   `server/src/services/aiActionExecutor.ts:1141` (`_executeCreateTask`) i analogiczny handler dla
   `_executeCreateDecision`. Alternatywnie: świadomie udokumentować i zaakceptować dług (to nie jest
   nowy dług stworzony w 207, ale 207 go rozszerza na nowo promowaną funkcję), i objąć trasę
   `/api/ai/actions/:id/execute` (Gateway.ts:600) tym samym `requireCanonicalExecutionWriter`, którym
   objęte są `/api/execution-control` (Gateway.ts:1389) i `pmo/tasks.routes.ts:67`.

2. **[Test-gap, nie blokuje scalenia, ale MUSI zostać zamknięty przed CLOSED_FINAL]** Dodać do
   `tests/unit/backend/day207.write-proposal.contract.test.ts` scenariusz wywołujący
   `executor.executeAction(proposal.actionId, ...)` **bez** poprzedzającego `approveAction` i
   asercję `success === false` + `state.tasks` puste — dokładnie test, który napisałem jako sondę
   (patrz pkt 6). Bez niego regresja bramy `aiActionExecutor.ts:823-824` przejdzie CI bez ostrzeżenia.

3. **[Decyzja wymagana od Piotra/nadzorcy, nie fix kodu]** Komit `c637cc2bde` cofnął
   `safeDbGet`-owanie zapytania `governance_settings` w `server/src/services/aiPolicyEngine.ts:192-196`
   z powrotem do gołego `dbGet(...)`. Efekt: przy dryfcie schematu (kolumna `governance_settings`
   brakująca na projekcie) `getEffectivePolicy()` rzuci wyjątkiem zamiast łagodnie fallbackować —
   test realdb obszedł to ręcznym `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` w samym teście
   (`tests/integration/day207-write-proposal.realdb.test.ts:40-42`), więc produkcyjny kod nigdy nie
   został realnie przetestowany na brakującej kolumnie. Zdecydować świadomie: przywrócić
   `safeDbGet` (bezpieczniejsze) albo jawnie zaakceptować fail-closed na dryfcie schematu.

4. **[Kosmetyka, niski priorytet]** `src/components/AIChat/ExecutionProposalMessage.tsx` — przycisk
   "Odrzuć" jest po polsku obok angielskich "Approve"/"View run" (widoczne na obu zrzutach w
   artefaktach). Ujednolicić język etykiet.

5. **[Kosmetyka, bardzo niski priorytet]** Dwa martwe komentarze wspominające usunięty
   `useActionHandler.ts`: `src/routes/AppRoutes.tsx:728`, `src/routes/presentationWizardRedirect.ts:11`
   — zaktualizować odniesienie na `useChatActions.ts`/`chatActionHandler.ts`.

---

## Uzasadnienie werdyktu

Mechanizm propozycji zapisu dla **2 z 4/5 rodzin akcji czatu** (`create_task`, `create_decision`)
jest realny: łańcuch handler→SSE→hook→komponent React jest kompletny i zweryfikowany linia po linii
(nie zaufanie do rejestru/importu), brama zatwierdzenia jest prawdziwym kodem ochronnym potwierdzonym
własną mutacją w obie strony, a nie tautologią — mimo że dostarczony test tej bramy realnie nie
sprawdza (FIX 2). Flaga jest domyślnie OFF, zgodnie z regułą "wygląd tylko za flagą do akceptu".

Pozostałe "akcje czatu" wymienione w `day207.write-proposal.static.test.ts` (GENERATE_REPORT,
GENERATE_PRESENTATION, USE_TEMPLATE, BROWSE_TEMPLATES, RECORD_KPI) to czysta nawigacja do istniejących
ekranów — nie zapisują nic i nie wymagają mechanizmu propozycji; nie są to "akcje zapisu" w sensie
pytania 3-4 audytu.

Powód "PO FIX", nie "NIE SCALAĆ": sam mechanizm gate'owania działa i jest udowodniony mutacyjnie:
żadna droga nie zapisuje z pominięciem `ai_actions`/zatwierdzenia. Powód "PO FIX", nie czyste
"SCALIĆ": zatwierdzony zapis ląduje w tabeli, którą reszta systemu jawnie oznaczyła jako
legacy-do-wygaszenia (FIX 1), a test tej właśnie granicy w dostawie nie istnieje (FIX 2) — to nie są
kosmetyczne braki, to dokładnie ten rodzaj długu, który w przeszłości Consultify kosztował tygodnie
(patrz `naprawa-per-wywolanie-odrasta` w pamięci). Wizualny dowód (pkt 7) też nie spełnia w pełni
reguły 7 CLAUDE.md — wymaga jednego dodatkowego renderu w realnym kontekście czatu przed pokazaniem
Piotrowi.
