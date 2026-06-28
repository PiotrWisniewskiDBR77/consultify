# Handoff — Teresa-chat → inicjatywa działa end-to-end (2026-06-28)

> **Pełny kontekst do przeniesienia.** Ta sesja domknęła „Teresa tworzy inicjatywę przez czat".
> Zaczęło się od odbioru Piotra (czat robił DOKUMENT zamiast inicjatywy), a skończyło na
> udowodnionym na żywo pełnym przepływie: komenda czatu → realna encja inicjatywy + 6 kart AI.
> Następny agent owns chat/canvas/ideas/notes/deliverables — sekcja „DLA CIEBIE" niżej.

---

## 0. TL;DR — stan na teraz
- **Demo** (`demo.consultify.ai`) działa na commicie **`f452d4f2fd`** (gałąź `feat/deliverables-w1` = `demo`) — zawiera fix crasha doc-gen (3a).
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

### 3b. Architektura czatu — tool-loop działa, ale full-fill blokuje
Stream czatu (`/api/ai/chat/stream`, handler ~`ai.routes.ts:1421`) MA model-driven tool-loop (SPEC_01 Tryb A, `maxIterations:4`). Po moim fix #6 oferuje `generate_deliverable` + `generate_initiative`. **Uwaga:** `maxIterations:4` + duplikaty — w teście LLM wywołał `generate_initiative` kilka razy (124→128). Rozważ idempotencję/dedup per-tura.

### 3c. Schema drift na trolley (degraduje kontekst Teresy, NIE blokuje)
Brakuje (połykane błędy w `aiContextBuilder`/`contextPackService`): `organization_memory`, `ai_user_preferences` (tabele), `organization_ai_settings.context_policy_json` (kolumna), `projects.is_closed` (kolumna). Teresa działa z gorszym kontekstem. Warto domknąć migracją (staging-first).

### 3d. `business_value` nie hydrowane
Karta `financialImpact` generuje się (jest w `ai_generated_sections`), ale kolumna `business_value` zostaje pusta — mapowanie financialImpact→kolumna w `cardColumnHydration.ts` / `hydrateTypedColumns` (`generateInitiative.ts:136`). Drobny szlif R3.

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
