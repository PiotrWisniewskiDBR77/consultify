# DEEP MEMORY ARCHITECTURE — Consultify Contextual Memory (code-traced)

Date: 2026-06-03 · Method: static code trace (no builds) · Scope: how contextual memory is **assigned** and **used** across **Scope** (User vs Org) × **Duration** (Ephemeral vs Long-term).

All paths are `file:line` in `server/src/...` unless noted.

---

## 0. Two context builders (and which one is live)

- **CANONICAL**: `server/src/services/aiContextBuilder.ts` (1610 lines, typed). Object `AIContextBuilder.buildContext(userId, organizationId, projectId, options)` @ `services/aiContextBuilder.ts:171`. This is what the live chat pipeline uses (`services/ai/AIPipeline.ts:746`).
- **LEGACY / dead-ish**: `server/src/ai/aiContextBuilder.ts` (217 lines, `// @ts-nocheck` @ line 1). Object `AIContextBuilder.buildContext(orgId)` @ `ai/aiContextBuilder.ts:16` — **single-arg, org-only**, no user axis. Only caller is the **AI Coach** batch path `ai/aiCoach.ts:51`. It aggregates tasks/initiatives/help-events/metrics + `organization_context_os` (via `organizationContextService.buildResolvedContext`, `ai/aiContextBuilder.ts:24`). It is NOT in the interactive Teresa chat path.

**Divergence:** the legacy builder has NO user-scope, NO governance filter, NO focus mode, NO KG, NO RAG, NO user/org `ai_*_memory`. The canonical builder has all of these. The note in the prompt ("`src/services/aiContextBuilder.ts` canonical") refers to `server/src/services/aiContextBuilder.ts`; there is no `src/services/aiContextBuilder.ts` at repo root.

---

## 1. THE 2×2 MATRIX (Scope × Duration)

### Cell A — USER × EPHEMERAL (current conversation/turn)
**This is the only user-scoped memory that actually influences a live answer.**

- **Store**: client-held conversation history. Persisted server-side in `conversation_messages` (writers: `routes/conversations.routes.ts:833/1428/1561`, `routes/my-work.routes.ts:6528`, `services/aiActionExecutor.ts:196`, `services/v8/chatExecutionService.ts:361`, `services/ai/conversationBranchingService.ts:68`).
- **Retrieve**: NOT loaded from DB into the prompt. History is supplied **by the caller** on the request: `request.history || request.messages` @ `services/ai/AIPipeline.ts:1014`. Some routes cap it: `const compactHistory = (history||[]).slice(-8)` @ `routes/ai.routes.ts:1331` (Deep-Thinking confirm path only).
- **Inject**: each history msg pushed as `{role, content}` @ `AIPipeline.ts:1015-1022`, after the system prompt, before the current user turn (`AIPipeline.ts:1052`).
- **Scope key**: `conversation_id` (+ `user_id` on the row). Ephemeral selected-entity/screen context also enters here: `options.selectedObjectType/Id`, `currentScreen` → `_buildSelectedEntityContext` (`aiContextBuilder.ts:226`) and `buildScreenContextSection` (`AIPipeline.ts:1221`).
- **TTL**: none at prompt level; truncation is ad-hoc (`slice(-8)` on one path; the global 12 000-char cap @ `aiContextBuilder.ts:355-379` trims *context layers*, NOT history).

### Cell B — USER × LONG-TERM (survives across sessions)
**Largely captured-but-unused / lost. Teresa does NOT meaningfully remember a user across sessions in the live prompt.**

- **Store 1 (JSON profile)** — `ai_user_memory` *250-schema* (`migrations/250_ai_memory_system.sql:8`): columns `preferences`, `expertise`, `recent_topics`, `interaction_count`. Read by `aiMemoryService.getUserMemory` @ `services/ai/aiMemoryService.ts:100-111` (`SELECT * ...`).
- **Store 2 (key/value)** — `ai_user_memory` *075-schema* (`migrations/075_ai_user_memory.sql:4`): columns `(user_id, key, value, …)`, `UNIQUE(user_id,key)`. Written by `routes/aiMemory.routes.ts:207/217/336/350`, `routes/ai/aiMemory.routes.ts`, and `services/wave6ContextLearningService.ts:556`.
- **Retrieve**: `AIPipeline.buildContext` calls `getUserMemory(userId)` @ `AIPipeline.ts:765`, and reads custom instructions @ `AIPipeline.ts:791-808` (tries 075 `key='custom_instructions'`, falls back to 250 `preferences` JSON).
- **Inject**: user memory rendered into `## PREFERENCJE UŻYTKOWNIKA` @ `AIPipeline.ts:1165-1180`. **Only** `communicationStyle`, `detailLevel`, `expertise`, `interactionCount` reach the prompt. `customInstructions` → `AIPipeline.ts:1183`.
- **Deliberately stripped**: `preferences.language` (i18n note @ `AIPipeline.ts:1160-1164`) and `recentTopics` (cross-conversation/cross-org leak fix @ `AIPipeline.ts:836-843` and `1173-1176`).
- **CRITICAL GAP — never written at runtime**: `aiMemoryService.updateUserMemory / recordInteraction / addRecentTopic` exist (`aiMemoryService.ts:129/147`) but have **zero runtime callers** (grep: only the getters are invoked, `AIPipeline.ts:685/763/777`). So `interaction_count`, `expertise`, `recent_topics` in the 250 table are **never populated by the chat path** → user long-term memory is effectively dead unless seeded by migrations or the separate `aiMemory.routes` admin/explicit API. The 250-shape getter also collides with the 075-shape table (two different `ai_user_memory` schemas) — `SELECT *` + `row.preferences` returns undefined against a 075 DB.
- **Style profile (separate store)**: `services/ai/userStyleProfileService.ts` `recordInteraction` @ `:295` writes a per-user style profile; consulted via `adaptiveService.buildAdaptiveSystemPrompt` @ `AIPipeline.ts:971`. This is the one user-long-term path with a real writer, but it shapes *tone*, not factual recall.

### Cell C — ORG × EPHEMERAL (per-request, recomputed, not cached)
- **Store**: none persistent — it is *computed every request*. `buildResolvedContext(organizationId)` @ `OrganizationContextService.ts:868` runs ~15 parallel SELECTs (orgs, `organization_profiles`, `organization_settings`, `sso_configurations`, `organization_context`, `organization_metadata`, `ai_contexts`, `interview_insights`, `interview_evidence`, timeline, `organization_context_claims`, `organization_context_snapshots`) and resolves claims live.
- **Retrieve/Inject**: called from `_buildOrganizationContext` @ `aiContextBuilder.ts:550`; result fields (`profile/strategic/operations/systems/stakeholders/signals/trust/conflicts/timeline`) returned @ `aiContextBuilder.ts:693-723`, rendered by `buildOrganizationSection` @ `AIPipeline.ts:1331+`.
- **TTL**: **no in-memory cache / no TTL** — full recompute on every turn (cost + latency risk, not a staleness risk).

### Cell D — ORG × LONG-TERM (persistent, survives sessions)
This is the richest cell and the real "org brain". Multiple stores:

| Store | Table / Migration | Read | Inject |
|---|---|---|---|
| **Context OS claims/snapshot** | `organization_context_items`, `organization_context_claims`, `organization_context_snapshots` (`migrations/669_organization_context_os.sql:4/36/64`) | `buildResolvedContext` `OrganizationContextService.ts:868` | org section + findings `AIPipeline.ts:1416-1421` |
| **`contextItemsSample`** (raw interview Q&A / evidence / manual notes / doc extractions) | `organization_context_items` (`source_type` in interview_answer/interview_evidence/manual_entry/doc_ingestion) | `aiContextBuilder.ts:582-691` (last 60 rows, visibility `organization`/`public`) | `AIPipeline.ts:1432-1460` |
| **`orgPatterns`** (best practices/lessons) | `organization_memory` (top-5 by usage_count) | `aiContextBuilder.ts:519-529` | **STRIPPED by default policy** (see §5) |
| **`terminology`** | `ai_organization_memory` (`memory_key LIKE 'terminology_%'`) | `aiContextBuilder.ts:537-545` | org section `AIPipeline.ts:1398`; also via `orgMemory` `AIPipeline.ts:1192-1197` |
| **Org AI memory (JSON)** | `ai_org_memory` (`migrations/250…:37`): `terminology`, `decision_patterns`, `aiMaturityStage` | `getOrgMemory` `aiMemoryService.ts:221` | `## PAMIĘĆ ORGANIZACJI` `AIPipeline.ts:1188-1207` |
| **Knowledge Graph** | `knowledge_graph_entities` / `knowledge_graph_relations` (auto-created `knowledgeGraphService.ts:432`) | `buildGraphContext` `knowledgeGraphService.ts:379` | `## KNOWLEDGE GRAPH` `AIPipeline.ts:1260-1269` |
| **RAG docs (ACL)** | `knowledge_chunks`/`knowledge_docs` + `c.embedding` (text-embedding-3-small) | `ContextRetrievalService.retrieveContext` `ContextRetrievalService.ts:333`→`ragService.hybridSearch` (`ragService.ts`, cosine @ `:262`/`:390`) | `routes/ai.routes.ts:3501-3546` (chat stream) |
| **Strategies/Approved ideas** | via `KnowledgeService.getActiveStrategies/getApprovedIdeas` | `aiContextBuilder.ts:862/874` | knowledge section `AIPipeline.ts:1225` |

- **Org LT writers**: KG `processConversation` (writer) IS called from the chat stream `routes/ai.routes.ts:4517-4520` (so org KG self-populates). `organization_context_items`/claims written by interview/context ingestion (Context OS module). `ai_org_memory.decision_patterns` writer `learnDecisionPattern` `aiMemoryService.ts:311` — **no runtime caller** (same dead-writer problem as user memory).

---

## 2. END-TO-END PIPELINE (write → read), in prose

**WRITE side (how memory accrues):**
1. *Interview / Context OS*: VTS interview answers, uploaded evidence, manual notes → `organization_context_items` (+ derived `organization_context_claims`, snapshot in `organization_context_snapshots`). Org-scoped, long-term.
2. *Chat*: each turn → `conversation_messages` (user-scoped, conversation-keyed). Same turn → KG `processConversation` extracts entities/relations into `knowledge_graph_*` (org-scoped) `ai.routes.ts:4517`.
3. *Docs*: uploaded docs chunked + embedded into `knowledge_chunks.embedding` (`ragService.generateEmbedding`, model `text-embedding-3-small` `ragService.ts:330`).
4. *Style*: `userStyleProfileService.recordInteraction` updates per-user tone profile.
5. *NOT written by the runtime*: `ai_user_memory` (250 JSON), `ai_org_memory.decision_patterns` — their update methods are orphaned.

**READ side (building Teresa's prompt for one turn):**
`AIPipeline.buildContext` (`AIPipeline.ts:625`) → privacy gate (`userPrivacyService`, `:642`) sets `memoryReadAllowed` (`memoryEnabled && !privateMode && retentionMode!=='none'`, `:658`). If allowed → `AIContextBuilder.buildContext(user,org,project,opts)` (`:746`) assembles the 6-layer context (platform/org/project/execution/knowledge/external) + enrichments (pendingApprovals, aiSettings, selectedEntity, assessment, financial, historical, systemDocs, recentWorkbooks) (`aiContextBuilder.ts:188-322`). Then **focus-mode filter** (`_applyFocusModeFilter` `:324`) → **governance filter** (`filterContextByPolicy` `:338`) → **12k-char cap trim** (`:355`). Back in the pipeline, `getUserMemory`/`getOrgMemory`/custom-instructions are merged (`AIPipeline.ts:758-852`). `buildSystemPrompt` (`AIPipeline.ts:1063`) stitches: persona/SSOT prompt → ORG section → PROJECT → EXECUTION → USER PREFS → CUSTOM INSTR → ORG MEMORY → approvals → selected entity → screen → KNOWLEDGE(+RAG) → assessment → financial → historical → benchmarks → **KG** (`:1264`) → help-docs → behavioral → **strict LANGUAGE block last** (`:1315`). RAG ACL chunks are injected separately in the stream route (`ai.routes.ts:3501`). History + sanitized user prompt appended (`AIPipeline.ts:1008-1055`). Stream out.

---

## 3. SCOPING & ISOLATION

- **org_id** scopes every org store (all SELECTs `WHERE organization_id = ?`). RAG enforces ACL **before** retrieval (`ContextRetrievalService` header `:7-10`, `fetchAccessibleDocuments` `:135`). `contextItemsSample` additionally filters `visibility_scope IN ('organization','public')` (`aiContextBuilder.ts:588`).
- **user_id** scopes `ai_user_memory`, style profile, `conversation_messages`.
- **Known leak, already mitigated**: `userMemory.recentTopics` is a GLOBAL per-user rollup across all orgs/conversations; it was leaking other sessions' topics into Teresa. Now dropped from runtime context (`AIPipeline.ts:836-843`, `:1173-1176`). The underlying store is still global/unscoped — re-enabling it without per-org scoping reintroduces the leak.

---

## 4. GOVERNANCE / FILTERING (`services/ai/contextGovernance.ts`)

- Policy SSOT: `organization_ai_settings.context_policy_json` (`contextGovernance.ts:48`). `DEFAULT_POLICY` @ `:31-43`.
- **Stripped by default** (category=false): `ORG_PATTERNS`, `ORG_SECURITY_POSTURE`, `ORG_FINANCIAL_SUMMARY`. `filterContextByPolicy` deletes `org.topPatterns/orgPatterns` (`:117-120`), `filtered.financialData` (`:129`), `filtered.securityPosture` (`:135`).
- Allowed by default: `ORG_PROFILE`, `ORG_TERMINOLOGY`, `ORG_STRATEGY`, `ORG_DOCUMENTS`.
- Applied @ `aiContextBuilder.ts:337-338` after focus-mode filter.

---

## 5. GAPS

**Captured-but-never-used (DEAD):**
- `ai_user_memory` (250 JSON) `recent_topics`, `expertise`, `interaction_count`, and `ai_org_memory.decision_patterns`: writers (`updateUserMemory`, `recordInteraction`, `learnDecisionPattern`) have **no runtime callers** → never populated from chat; getters return defaults.
- `orgPatterns`: read (`aiContextBuilder.ts:519`) then **stripped by default policy** (`ORG_PATTERNS:false`) → loaded, paid for, deleted before the LLM.
- Legacy `ai/aiContextBuilder.ts` org snapshot fields (`raw.tasks/initiatives/helpEvents`) only feed AI Coach; not Teresa.

**Used-but-never-persisted (LOST):**
- Conversation turn context: the pipeline does **not** load history from `conversation_messages`; it trusts the client to send it. If the client sends nothing, Teresa has zero recall even though turns are persisted.
- No turn → user/org factual memory write-back loop (only KG + style profile self-populate).

**Dual-path inconsistencies:**
- TWO `ai_user_memory` schemas (075 key/value vs 250 JSON) coexist; `aiMemoryService` assumes 250, `AIPipeline` custom-instructions assumes 075-with-250-fallback. Production DB shape determines which silently no-ops.
- TWO context builders with divergent feature sets (canonical vs legacy `@ts-nocheck`).
- KG tables are `knowledge_graph_entities/relations`, not the `kg_entities/kg_relations` named in the brief — confirm any external refs use the real names.

**Missing TTL / cache:**
- `buildResolvedContext` recomputed every request (no cache/TTL) — latency/cost, ~15 SELECTs/turn.
- No invalidation tie between Context OS snapshot writes and prompt reads (always live-read, so no staleness, but no caching either).

**Scoping risks:**
- `recentTopics` store remains org-unscoped (latent leak if re-enabled).
- KG `buildGraphContext` is gated only on `ctx.organization` existing (`AIPipeline.ts:1261`) with no governance category — org entity names bypass the `ORG_PATTERNS`/security policy filter.

---

## 6. COMPLETION ITEMS (to make memory closed-loop)

**P0**
- Reconcile `ai_user_memory` schema collision (075 vs 250). Pick one; migrate; make `aiMemoryService.getUserMemory` (`aiMemoryService.ts:100`) and `AIPipeline.ts:791-808` read the same shape.
- Wire the user/org memory **write-back**: call `aiMemoryService.recordInteraction` / `updateUserMemory` / `learnDecisionPattern` (orphaned at `aiMemoryService.ts:147/129/311`) from the post-stream handler in `routes/ai.routes.ts` (next to the existing KG `processConversation` call @ `:4517`).
- Server-side history hydration: when `request.history` is empty, load last N from `conversation_messages WHERE conversation_id=?` inside `AIPipeline.assembleMessages` (`AIPipeline.ts:1013`) so recall doesn't depend on the client.

**P1**
- Decide `orgPatterns`: either flip `ORG_PATTERNS` default-on (`contextGovernance.ts:36`) or stop loading it (`aiContextBuilder.ts:519`) — currently pure waste.
- Add a governance category for KG and route `buildGraphContext` injection (`AIPipeline.ts:1264`) through `filterContextByPolicy`.
- Add request-scoped memoization/short TTL cache for `buildResolvedContext` (`OrganizationContextService.ts:868`) keyed by `organizationId` + snapshot `updated_at`.

**P2**
- Re-introduce scoped "global user memory" (replace stripped `recentTopics`) as **opt-in, per-org** (per the note @ `AIPipeline.ts:838-841`).
- Delete or fold the legacy `server/src/ai/aiContextBuilder.ts` into the canonical builder once AI Coach migrates, to kill the dual-path.
- Unify history truncation: the global 12k cap (`aiContextBuilder.ts:355`) trims context layers but not history; add a principled token-window for `messages` in `AIPipeline.ts:1013`.
