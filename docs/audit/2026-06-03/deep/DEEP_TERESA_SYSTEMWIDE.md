# DEEP AUDIT — How Teresa AI Works System-Wide (Code-Traced, No Builds)

Date: 2026-06-03 · Repo: consultify · Branch: feat/wave1-foundations
Method: source read only. All claims carry `file:line`.

---

## 1. The Single End-to-End Teresa Call Pipeline

There is **one shared LLM pipeline**, but a fragmented set of *callers*.

**Entry points (server):**
- `POST /api/ai/chat/stream` — SSE streaming chat. The canonical Teresa surface. `server/src/routes/ai.routes.ts:1423`. Body carries `assistantScope: 'anna_public' | 'teresa_tenant'`, `memoryScope`, `screenContext`, `projectId`, `selectedTier`, `selectedModelId`, `aiModes`, `knowledgeSources`, `responseStyle` (`ai.routes.ts:1446-1467`).
- `POST /api/ai/chat` — non-streaming, used by most in-module "generate" buttons (`Api.post('/ai/chat', …)`).
- `POST /api/ai/chat/confirm` — structured-output "confirm understanding" gate for Deep Thinking (`ai.routes.ts:~1299`, model picked via `modelMeetsRequirements`).

**Core class:** `AIPipeline` (`server/src/services/ai/AIPipeline.ts:197`).
- `process()` (`:225`) / `processStream()` (`:507`) → `buildContext()` (`:625`) → `buildPrompt()` (`:932`) → `buildSystemPrompt()` (`:1063`) → `selectModel()` (`:1996`) → `executeWithProvider()` (`:2157`) / `executeStreamingWithProvider()` (`:2280`).
- **System prompt** is the unified persona: `buildPersonaPrompt(currentScreen, language)` (`server/src/ai/persona.ts:446`) → core BCG/PM/Financial-analyst identity (`persona.ts:84`), consulting frameworks (`:125`), challenge/citation/artifact instructions, plus **screen-aware emphasis** (`getScreenEmphasis`, `:480`). A "Prompt SSOT" registry is preferred and falls back to persona (`AIPipeline.ts:1075-1140`).
- **Context plug-in points:** org/project context via `aiContextBuilder` (`AIPipeline.ts:33,625`), `userMemory.preferences` (language, custom instructions) at `:707,825,1182`, conversation language detection (`persona.ts:425`).

**Model selection / providers:** `modelRouter.select()` (`server/src/services/ai/modelRouter.ts`). Real backend is **OpenRouter as the single stable provider** (`MODEL_PROVIDER_MAP`, `:50`): BUDGET `openai/gpt-4o-mini`, STANDARD `openai/gpt-4o`, PREMIUM `anthropic/claude-sonnet-4-6`, REASONING `openai/o1-mini` (`TIER_DEFAULTS :117`). Capability→tier map at `:34`. Cross-provider fallback chains exist and are actually exercised in the stream path (`AIPipeline.ts:325-360`). Ollama loopback is allowed only behind `ENABLE_USER_LOCAL_LLM` (`ai.routes.ts:1494`).

**"DBR77 Vector" is NOT a model in the call path.** It exists only as *product knowledge content* injected into Anna's public answers (`server/src/services/ai/annaKnowledgeService.ts:64-83`). No code routes inference to a DBR77/Vector model. **BYOK is org/provider-level, not per-user:** API keys come from DB provider rows / env in `modelRouter.getProviderConfig` (`:1355,1401,1417`), never from a per-user key.

---

## 2. MODULE × TERESA MATRIX (19)

| # | Module | Invocation (file:line) | Context passed | Apply-handler | LLM or fake |
|---|--------|------------------------|----------------|---------------|-------------|
| 01 | Chat / Teresa Panel | `ChatPanel.tsx:148,201` → `onSendMessage` → `/api/ai/chat/stream` | full: scope, screenContext, memoryScope, aiModes | n/a (is the chat) | **REAL LLM** |
| 02 | Home / MyWork Focus | `NudgeStrip.tsx:23` `/api/ai/nudges`; HomeView Teresa entry | nudge ctx | read-only feed | REAL (nudges svc) |
| 03 | Wywiad / Interview | `InterviewHub.tsx:5574` `/ai/chat`; `AIInterviewModal.tsx` | interview prompt | writes answers | **REAL LLM** for hub. **BUT** `ConversationalPanel`+`SufficiencyIndicator` exported in `Interview/index.ts:41` and **imported nowhere** → built, never mounted. **CONFIRMED dead.** |
| 04 | Narzędzia / DiscoveryTools | `useToolAI.ts:134` `useAIStream` → `/api/ai/chat/stream`; actions `toolAiActions.ts` | tool system prompt + step ctx | `extractObject(stream)` → `applyDynamicSwot/MarketForces/GrowthPaths/Portfolio/RiskPendingAction` (`useToolAI.ts:465-558`) | **REAL LLM + REAL APPLY. PRIOR CLAIM "no apply handler" REFUTED.** |
| 05 | Discovery / Assessment | `assessment/ReportEditorModal.tsx:194` `/api/ai/assessment/report-section`; `MaturityMatrix.tsx` | section ctx | writes report section | **REAL LLM** |
| 06 | Initiatives / Strategy | `InitiativeDetailModal.tsx:254,287,314,371` `/api/ai/execution-strategy`, `/strategic-fit`, `/generate-list`, `/autofill-initiative`; `InitiativeIntelligenceTab.tsx:20` `/insights` | initiative payload | autofill writes fields | **REAL LLM** |
| 07 | Projects / PMO | `PMORoleSelector.tsx`, `ProjectTeamBoard.tsx` Teresa refs | project ctx | role/team suggestions | REAL (insights) |
| 08 | Ideas (Mind Map / Process Flow / Table / Whiteboard) | chat → **CustomEvent** `idea-workspace-quick-action` / `idea-workspace-ai-proposal` (`IdeaRecommendationMap.tsx:2288,4385`; `IdeaProcessFlowTool.tsx:1347`); bridge `useIdeasTeresaBridge.ts:46` | ideaId, toolType, action | event-driven apply to canvas store; `AIProposalPanel.tsx`, `FrameworkGenerator.tsx` | **REAL LLM via chat** + **event-bus apply** (no function-calling) |
| 09 | Reports / ReportBuilder | `ReportAgentChat.tsx:141` `/report-builder/:id/agent/message`; apply `:165` `/agent/apply/:messageId` → `applyAgentAction` (`report-builder.routes.ts:4743,4750`) | report id, message | **REAL apply endpoint** | **REAL LLM agent** |
| 10 | Dokumenty / Document Studio | `DocumentStudio/api.ts:138` `/api/document-studio/generate`; prose via `documentBlockProseGenerator.ts:27` → `aiService.generateChatResponse` | intake, schema, blocks | writes prose into blocks | **REAL LLM.** `documentTeresaIntent.ts` referenced **only in 2 test files** (`documentStudio/__tests__/`) → that intent layer is **CONFIRMED test-only / not wired**, but generation itself is real. |
| 11 | Document QA | `DocumentStudioQaPanel.tsx`; `/api/document-studio` QA gate | doc + question | answers / QA gate | REAL LLM |
| 12 | Prezentacje / Presentation Studio | `presentations.routes.ts:2180` `/decks/:id/agent-edit`; accept `:2299` | deck + prompt | `applyPresentationEditPlan` (`presentationAgentEditService.ts:308`) | **FAKE/regex.** `parsePresentationEditIntent` is `matchAll(/slajd|slide/)` + `normalized.includes('summary'|'concise'…)` (`:20-60, 333-388`). **No LLM. PRIOR CLAIM CONFIRMED.** Deck *generation* elsewhere uses LLM; the agent-edit is keyword-only. |
| 13 | Meeting | `meetingIntelligenceService.ts:48` `llmClient=null`; `setLLMClient()` (`:51`) **never called anywhere** | transcript | falls to non-LLM branch (`:61` guard) | **FAKE.** `generateWithLLM` unreachable. **PRIOR CLAIM CONFIRMED.** |
| 14 | Studio / Canvas | `useStudioAI.tsx:113` `/api/studio/ai/chat`; `StudioChat.tsx` | studio ctx | writes to canvas | **REAL LLM** |
| 15 | Notifications | `NotificationDetailView.tsx:782` `/ai/chat` | notification ctx | summarize/draft | **REAL LLM** |
| 16 | Tasks / Decisions | `TaskDetailView.tsx:1773,3901`, `DecisionDetailView.tsx:2120,2385…4007` `/ai/chat` (12+ call sites) | task/decision prompt + comments | writes comment/field text | **REAL LLM** (free-text completions, parsed by string-strip, not function-calling) |
| 17 | Admin / AI Control | `AccessLimitsTab.tsx:104,151` `/api/ai-settings/org/:id`; `AICostDashboard.tsx`, `AdminAIControlCenterPanel.tsx` | org settings | writes settings | **PARTIALLY REAL.** Budgets ARE enforced in pipeline (`AIPipeline.ts:306` `checkBudget` reads `ai_budgets` table, `aiBudgetService.ts:303`), gated by `AI_BUDGETS_ENABLED` (`:257`). **BUT** `ai.routes.ts` never reads `organization_limits`, and the Admin UI writes `ai-settings/org`, not `ai_budgets` — so the **UI tier/limit knobs are not proven to feed the enforced table.** Prior "decorative" claim is **partly refuted** (enforcement path exists) and **partly confirmed** (UI↔budget-table linkage unverified). |
| 18 | Ustawienia / AI Settings | `AIModelParametersSettings.tsx` `/api/ai-settings/user`; `ModelSelector.tsx:62` `/available-models` | user prefs | persists | **PERSISTED, MOSTLY UNREAD.** Pipeline reads `userMemory.preferences` (language, custom instructions) at `AIPipeline.ts:825,1182`, but **does not read `/ai-settings/user` model/temperature** to shape the call (`selectedModelId`/`selectedTier` come from the request body, not stored user prefs). **PRIOR CLAIM LARGELY CONFIRMED.** |
| 19 | Organization / Knowledge Graph | `OrgContextSummaryBanner.tsx`, `KnowledgeGraphExplorer.tsx` Teresa refs; org context via `aiContextBuilder` | org graph | context injection only | REAL (context feed, no apply) |

---

## 3. Tool-Use / Function-Calling — Does Teresa ACT?

**There is no LLM function/tool-calling registry in the chat path.** Teresa is chat-first; "acting" happens through three *non*-tool-calling mechanisms:

1. **Server signal→action engine (deterministic, not LLM tool-use):** `ActionProposalEngine.generateProposals` (`server/src/ai/actionProposalEngine.ts:49`) maps `SignalEngine.detectSignals` → proposals; execution via `actionExecutionAdapter.ts:165` `switch(actionType)` → `TASK_CREATE`/`PLAYBOOK_ASSIGN`/`MEETING_SCHEDULE` executors (`actionExecutors/`). Wired at `ai.routes.ts:5958,8261`. Real, but rule-based, not model-chosen tools.
2. **Client structured-JSON-in-stream (DiscoveryTools):** model emits JSON, `extractObject` regex-parses it, `applyXxxPendingAction` writes the store (`useToolAI.ts:155,465`). Real apply, brittle parse.
3. **Client CustomEvent bus (Ideas):** `idea-workspace-quick-action` / `-ai-proposal` events dispatched and consumed across `MyWork/*` (`IdeaRecommendationMap.tsx:2288+`). Real apply, DOM-event coupling, no schema contract.

So Teresa can create tasks/playbooks/meetings and edit Ideas/Tools canvases — but via **three parallel ad-hoc mechanisms**, not one tool registry the LLM controls.

---

## 4. Consistency — One Teresa or N?

**Persona/identity: ONE.** Every real call funnels through `buildPersonaPrompt` + `AIPipeline`, so the *voice* and model routing are unified. `assistantScope` cleanly separates public **Anna** from tenant **Teresa** (`ai.routes.ts:1446`).

**Coherence breaks at:**
- **Memory/context:** only the central chat passes `memoryScope`/`screenContext`. In-module `/ai/chat` callers (Tasks, Decisions, Notifications, Interview) send a bespoke `systemInstruction` + `roleName` and **bypass screen emphasis, user memory, and org context** — so Teresa "forgets" who she is per-feature.
- **Acting:** three disjoint apply mechanisms (§3) with no shared contract.
- **Dead/fake islands:** Presentation agent-edit (regex), Meeting (null LLM), Interview ConversationalPanel (unmounted), document intent (test-only).
- **Settings:** user model/temperature prefs persisted but not honored (§18).

---

## 5. Cost / Governance Hooks

- **Budget enforcement IS in the call path** (stream): `enforceBudgetsAndPerms` → `checkBudget` (block on hard limit) + `getModelPermissions` (model deny-list, per-request token cap) + `recordUsage` on stream completion (`AIPipeline.ts:276-460`; `aiBudgetService.ts:303,344,460`). Gated by `AI_BUDGETS_ENABLED` (`:257`).
- **Gaps:** streaming records `requestCount` only, not token cost (`AIPipeline.ts:401`); `ai.routes.ts` never reads `organization_limits`; Admin UI knobs (`ai-settings/org`) not verified to populate `ai_budgets`; in-module `/ai/chat` bypass not confirmed to traverse the same enforcement (uses `aiService` wrapper).

---

## 6. Systemic Verdict

**~13 of 19 surfaces are real LLM + working apply** (Chat, Interview-hub, Tools, Assessment, Initiatives, Projects, Ideas, Reports, Document Studio, QA, Studio, Notifications, Tasks/Decisions).
**3 are illusion/dead:** Presentation agent-edit (regex), Meeting intelligence (null `llmClient`), Interview ConversationalPanel (unmounted).
**2 governance surfaces are half-wired:** Admin budgets (enforcement real, UI linkage unproven), AI Settings (persisted, unread).
**1 is context-only:** Organization.

Teresa is **one persona over a fragmented nervous system**: unified prompt/model, but N disconnected invocation + apply paths and partial governance.

---

## 7. Completion Items

**P0 — make her act coherently & stop the fakes**
- Wire Presentation agent-edit to the LLM: replace `parsePresentationEditIntent`/`applyPresentationEditPlan` regex with a model-generated structured edit plan (`presentationAgentEditService.ts:20,308`).
- Inject an LLM client into Meeting: call `meetingIntelligenceService.setLLMClient(...)` at boot (currently never called; `meetingIntelligenceService.ts:51`).
- Mount or delete the Interview ConversationalPanel + SufficiencyIndicator (`Interview/index.ts:41`).
- Confirm/repair Admin budget linkage: make `ai-settings/org` writes land in `ai_budgets`, and assert all paths honor `checkBudget` (`AccessLimitsTab.tsx:151` ↔ `aiBudgetService.ts:303`).

**P1 — one Teresa, one context, one tool layer**
- Route every in-module `/ai/chat` call through the persona+context builder (pass `screenContext`/`memoryScope`) instead of bespoke `systemInstruction` (`TaskDetailView.tsx:1773`, `DecisionDetailView.tsx:2120+`, `NotificationDetailView.tsx:782`, `InterviewHub.tsx:5574`).
- Read persisted user AI settings (model/temperature/custom-instructions) in `AIPipeline.buildPrompt`/`selectModel` (`AIPipeline.ts:932,1996`), not just request body.
- Introduce a real tool/function registry the LLM controls, unifying the 3 apply mechanisms (`actionExecutionAdapter.ts:165`, `useToolAI.ts:465`, Ideas CustomEvents).
- Record token cost (not just `requestCount`) on streaming usage (`AIPipeline.ts:401`).

**P2 — productionize the intent/apply layer**
- Replace client regex `extractObject` JSON parsing with schema-validated structured outputs (`useToolAI.ts:155`).
- Replace Ideas DOM-event bus with a typed command contract.
- Wire the `documentTeresaIntent` intent layer into Document Studio (currently test-only) or remove it.
- Surface `organization_limits` enforcement in `ai.routes.ts` and add cost-metering dashboards backed by `recordUsage`.
