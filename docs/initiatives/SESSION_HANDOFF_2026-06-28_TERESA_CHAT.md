# Handoff — Teresa-chat → inicjatywa działa end-to-end (2026-06-28)

> **Pełny kontekst do przeniesienia.** Ta sesja domknęła „Teresa tworzy inicjatywę przez czat".
> Zaczęło się od odbioru Piotra (czat robił DOKUMENT zamiast inicjatywy), a skończyło na
> udowodnionym na żywo pełnym przepływie: komenda czatu → realna encja inicjatywy + 6 kart AI.
> Następny agent owns chat/canvas/ideas/notes/deliverables — sekcja „DLA CIEBIE" niżej.

---

## 0. TL;DR — stan na teraz
- **Demo** (`demo.consultify.ai`) — gałąź `feat/deliverables-w1` = `demo`; aktualne fixy: 3a doc-gen (`f452d4f2fd`), 3d business_value (`009e23bb5e`), 3b duplikaty + EMPTY_STREAM rescue (`e57fba5faa`+`d214d9c633`). **Uwaga: build Railway potrafi mocno odstawać** od tipa gałęzi (wielu agentów pushuje równolegle) — sprawdzaj `gitSha` w `/api/health` zanim testujesz.
- **Teresa przez czat tworzy inicjatywę** (`source_type=teresa_chat`), z 6 kartami AI wypełnionymi po polsku, hydrowanymi do typowanych kolumn. **Udowodnione na żywo** (HTTP `/api/ai/chat/stream` + weryfikacja w DB: 124→128, treść kart obecna).
- Dane testowe **sprzątnięte** (0 śmieci).
- Baza demo = **trolley** (demo+staging współdzielą). PROD = centerbeam = **NIETKNIĘTE**.

---

## 1. WIELKI WYNIK — co naprawiłem (z commitami)
Odbiór Piotra: „stwórz inicjatywę" w czacie robiło **dokument** (English placeholdery, „AI returned no output"). Diagnoza ujawniła **łańcuch 7 blokerów** — każdy naprawiony i zweryfikowany:

| # | Bloker | Root cause | Fix (commit) |
|---|---|---|---|
| 1 | Puste szablony sekcji | generator inicjatyw miał 0 `ai_prompt_template` | seed 6 core (wcześniejsza sesja) |
| 2 | LLM down na demo | 3/4 dostawców unhealthy (klucze) | routing → **openrouter** (config DB trolley) |
| 3 | Generator martwy mimo szablonów | `is_active = 1` przepisywane na `= TRUE` na kolumnie INTEGER → `operator does not exist: integer = boolean` | usunięto `initiative_section_types` z `BOOLEAN_IS_ACTIVE_TABLES` — `28bd654ac9` |
| 4 | „AI returned no output" (czat crash) | `_identifyDataSources` czytał `.length` na undefined (schema drift) | optional-chaining — `08391f5374` |
| 5 | Teresa blokowana | demo org `token_balance = 0` (billing PENDING) | doładowane do 5M na trolley |
| 6 | **Teresa robi dokument, nie inicjatywę** | `AIPipeline` podawał LLM-owi **tylko** `generate_deliverable` — `generate_initiative` zarejestrowane, ale nigdy nieoferowane | eksponuję oba narzędzia — `b5032410d4` |
| 7 | Czat wisi >90s | full-fill (6 kart × LLM) leciał **synchronicznie** w narzędziu wewnątrz streamu | fire-and-forget full-fill — `f883522cd1` |
| + | persona nudge | „inicjatywa to nie dokument → użyj narzędzia" | `7d99c2e166` (wspiera #6) |

**Dowód #6 (na żywo):** mint HS256 JWT (OWNER) → `POST /api/ai/chat/stream` „Stwórz inicjatywę: Transformacja cyfrowa DBR77…" → DB: nowa inicjatywa `source_type=teresa_chat`, DRAFT, kolumny `problem_statement`/`scope_in`/`success_criteria` wypełnione PL, `ai_generated_sections` = {problemDefinition, targetState, kpis, scope, control, financialImpact}.

### Najważniejszy plik #6 (gdyby trzeba cofnąć/rozszerzyć)
`server/src/services/ai/AIPipeline.ts` ~343 — `CHAT_CREATION_TOOLS = {generate_deliverable, generate_initiative}` filtruje `getToolDefinitions()`. Kontekst (`organizationId/userId/language`) już płynie z route (`ai.routes.ts:4231` `deliverableTools.context`); `callStream` (`llmService.ts:847`) odpala każde narzędzie z tym kontekstem. Handler: `server/src/services/ai/tools/generateInitiative.ts`.

---

## 2. Stan demo / zmiany infra (trolley DB)
- **Deployed:** `f883522cd1`. Demo **auto-deployuje na push do gałęzi `demo`** (`git push origin <tip>:demo` wystarcza; ręczny Railway trigger NIE jest potrzebny).
- **DB (trolley) zmiany tej sesji:**
  - `llm_providers`: tylko `openrouter` aktywny+healthy; openai/google/deepseek `is_active=false` (były down).
  - `organizations.token_balance` demo-org = 5,000,000 (było 0). **Zostawione** — demo potrzebuje tokenów.
  - Utworzone brakujące tabele: `ai_system_prompts`, `ai_response_feedback`.
- **Railway token** wygasa (`Not Authorized`) — ratunek tylko `railway login` (Piotr). Ale demo auto-deployuje na push, więc deploy nie jest zablokowany.

---

## 3. DLA CIEBIE (następny agent — chat/canvas/ideas/notes/deliverables)
Te rzeczy są w TWOIM pasie. Zostawiam z pełną diagnozą:

### 3a. ✅ `[DeliverablesGen:doc] row.join is not a function` — ROZWIĄZANE (`f452d4f2fd`)
**Root cause był inny niż w pierwotnej diagnozie:** fix renderera (`normalizeTableContent` w `documentSchemaRenderer.ts`, do który woła `docGenerationRuntime.ts:1311`) istniał **tylko w working tree — nigdy nie zacommitowany**. Handoff błędnie przypisał go do `501b53a64f` (grep `normalizeTableContent` w tamtym HEAD = 0). Demo deployuje z pushniętej gałęzi, więc wciąż leciał stary `row.join(...)` na keyed-row → crash → cały dokument spadał do angielskiego stubu. **Nie było „drugiej ścieżki `.join`"** — był jeden niezacommitowany fix. Zacommitowany+wypchnięty+demo `f452d4f2fd`; regresja `documentSchemaRendererTable.test.ts` 4/4 zielona. (Sprawdzone czyste: `wave5ArtifactRuntimeService.ts:279` twarde tablice, `docGenerationRuntime.ts:629` `fields.map().join`.) Chip `task_91c639ac` można zamknąć.

### 3b. ✅ Duplikaty inicjatyw — ROZWIĄZANE (`d214d9c633` + `e57fba5faa`); root cause był inny
Pierwotna diagnoza („maxIterations:4 → LLM woła narzędzie kilka razy") była **niepełna**. Żywe trasowanie na demo (logi serwera 2026-06-28) ujawniło prawdziwy mechanizm — **łańcuch**:
1. Model woła `generate_initiative` → narzędzie **tworzy DRAFT i kończy sukcesem** (log `[teresa] hydrated … business_value` + `full-fill done`).
2. Ale model **nie emituje żadnego tekstu** po tool-callu (gpt-4o przez openrouter na kroku post-tool).
3. `callStream` konsumuje pierwszy chunk `textStream`, widzi `done` (zero tekstu) → rzuca **`EMPTY_STREAM`** (`llmService.ts:1211`).
4. `AIPipeline` traktuje to jako porażkę → **retry następnym modelem-kandydatem** (pętla `for candidateModelId`) → narzędzie **odpala się znowu** → kolejny duplikat. Stąd 4 inicjatywy z jednej wiadomości (NIE z pętli `maxSteps`, lecz z retry'ów **między** `callStream`).

**Dwa fixy (oba na demo):**
- **`d214d9c633` — wycięcie u źródła:** `callStream` zapamiętuje `message` udanego narzędzia; gdy stream kończy się pusty, **emituje ten komunikat jako odpowiedź** zamiast `EMPTY_STREAM`. To daje userowi widoczne potwierdzenie ORAZ kasuje wyzwalacz retry'ów. Czysto-pusty stream (bez narzędzia) dalej rzuca `EMPTY_STREAM` i fallbackuje.
- **`e57fba5faa` — idempotencja per-tura (pas + szelki):** memoizacja pierwszego wyniku na współdzielonym obiekcie `context` (`generateInitiative.ts`); każdy powtórny call w turze (pętla maxSteps LUB retry kandydatów — wszystkie dzielą `deliverableTools.context`) zwraca memo zamiast tworzyć. Test `TURN IDEMPOTENCY` (3 wywołania / 1 create).

> **GŁĘBSZA LEKCJA:** „EMPTY_STREAM po udanym tool-callu" promieniuje na KAŻDE narzędzie tworzące (też `generate_deliverable`). Jeśli zobaczysz duplikaty deliverable'ów albo pustą odpowiedź Teresy po akcji — to ten sam mechanizm.

### 3c. Schema drift na trolley (degraduje kontekst Teresy, NIE blokuje) — DALEJ OTWARTE
Brakuje (połykane błędy w `aiContextBuilder`/`contextPackService`): `organization_memory`, `ai_user_preferences` (tabele), `organization_ai_settings.context_policy_json` (kolumna), `projects.is_closed` (kolumna). Teresa działa z gorszym kontekstem. Warto domknąć migracją (staging-first).

### 3d. ✅ `business_value` nie hydrowane — ROZWIĄZANE (`009e23bb5e`)
Karta `financialImpact` generuje się, ale `business_value` zostawała NULL. **Root cause (zobaczony na żywej karcie):** żywy section-prompt emituje kształt `{revenueImpact, costSavings, benefitsRealization}` — a mapper szukał `businessValue/rationale/value`: **zero pokrycia**. `buildTypedColumnUpdates` (`cardColumnHydration.ts`) składa teraz `business_value` z pól narracyjnych (costSavings → revenue → benefits), gdy brak jawnego `businessValue`; jawne nadal wygrywa. +2 testy jednostkowe (14/14). Potwierdzone w logu: `[teresa] hydrated 7 typed column(s) … business_value`.

### 3e. ⚠️ Wybór modelu demo + reasoning-models nie działają na chat-path (OTWARTE — kod)
Stan ustalony 2026-06-28 (live testy na demo). Tier PREMIUM→model rezolwuje z `llm_providers(provider='openrouter').model_id` i jest **cache'owany w procesie** → zmiana w DB **wymaga restartu** (`railway redeploy --service consultify -y`; bywa odrzucony „cannot be redeployed" gdy trwa inny build — wtedy następny push i tak przeładuje config).

Porównanie modeli przez NASZ chat-streaming+tools path:
- **`openai/gpt-4o`** — dobry tool-caller (tworzył inicjatywy 16:00), ale trasa openrouter **miga na pusty stream** (10/10 empty później). NIE kredyty (gpt-4o-mini działał w tym samym czasie) — to flaky trasa gpt-4o.
- **`openai/gpt-4o-mini`** — trasa zdrowa (Teresa odpowiada), ale **słaby tool-caller** (18/18 prób: odpowiadał tekstem, nie wołał `generate_initiative`). **Demo zostawione na tym** (żywe, ale chat→inicjatywa niepewny).
- **`z-ai/glm-4.6` (Z.ai, wybór Piotra)** — działa BEZPOŚREDNIO na openrouter (probe 200 OK), ale przez nasz serwer = `EMPTY_STREAM`. **Root cause:** GLM to model ROZUMUJĄCY — streamuje wyjście w polu `delta.reasoning`, a nasz chat-path ma reasoning **WYŁĄCZONY** (narzędzia podawane tylko gdy reasoning off — patrz `AIPipeline` + `llmService.callStream` `wantsReasoning`), więc `textStream` dostaje pusty `content` → EMPTY_STREAM. Dodatkowo GLM w teście nie wywołał narzędzia (`finish=stop`, `tool_calls=false`).

**ZADANIE (większe, kod):** żeby użyć Z.ai/GLM (lub innego reasoning-modelu) na czacie z narzędziami, trzeba przebudować chat-path tak, by reasoning-models mogły JEDNOCZEŚNIE rozumować I dostawać narzędzia (dziś wzajemnie się wykluczają: `tools` tylko gdy `reasoning` off). To NIE jest szybki fix — wymaga przemyślenia interakcji maxSteps/reasoning/tool-loop + testów. Diagnoza bezpośrednia: `z-ai/glm-4.6` na openrouter zwraca `reasoning` deltas, nie `content`.

---

## 4. Techniki testowe (jak to powtórzyć — bez hasła)
- **Serwisy bezpośrednio (bez auth):** `railway run --environment demo --service consultify -- node --import tsx <skrypt>`; w skrypcie: `process.env.DATABASE_URL = DATABASE_PUBLIC_URL` (prywatny host `.railway.internal` nieosiągalny z laptopa), `DB_TYPE=postgres`, `DOTENV_IGNORE_LOCAL=1`; `getDatabaseAsync()` → `svc.setDependencies?.({db})` (singletony mają własne `this.db`).
- **HTTP jako user (bez hasła):** mint **HS256 JWT** ręcznie z `crypto.createHmac` + `process.env.JWT_SECRET`, payload `{id,email,role:'OWNER',organizationId,jti,iat,exp}`; `User-Agent` przeglądarki (WAF). Endpoint czatu: `POST /api/ai/chat/stream`.
- **WAŻNE:** `AIOrchestrator.processMessage` to TYLKO planowanie (intent/prompt/policy) — tool-loop jest w `AIPipeline` (ścieżka streamingowa). Żeby przetestować realne tworzenie, trzeba streamem.
- **Weryfikuj DANE, nie odpowiedź streamu** — full-fill jest teraz async, więc encja powstaje od razu, karty dochodzą sekundy później (sprawdzaj DB).
- Org/user demo: `ORG=a3e05d4a-5397-419d-b486-8e44366c0063`, `USER=d2b6a316-08c5-47cf-9bf7-4ba50311d5a2` (piotr, OWNER).

---

## 5. Stan kręgosłupa (R1-R7 z planu) — co zostało
SSOT planu: `docs/initiatives/INITIATIVE_BACKBONE_NEXT_AGENT_PLAN.md`. W tej sesji **nie** ruszałem R1-R7 (skupienie na czacie); R1 (5 kart na CardBlockRenderer) ma builders + testy gotowe (`03fcdce682`), 1 sekcja (KPIs) podpięta przez subagenta, reszta sekcji do podpięcia. Generator (R2-payoff) działa żywo.

---

## 6. Pointery
- Plan R1-R7: `docs/initiatives/INITIATIVE_BACKBONE_NEXT_AGENT_PLAN.md`
- Kontekst+historia: `docs/initiatives/INITIATIVE_BACKBONE_HANDOFF.md`
- Wizja+decyzje: `docs/initiatives/INITIATIVE_SYSTEM_SSOT.md`
- Chip (doc-gen+routing): `task_91c639ac` — OBA domknięte (routing #6 + `7d99c2e166`/`f452d4f2fd`; row.join `f452d4f2fd`)
- Pamięć: `finding_teresa_chat_initiative_2026-06-28` (kluczowe fakty tej sesji)
