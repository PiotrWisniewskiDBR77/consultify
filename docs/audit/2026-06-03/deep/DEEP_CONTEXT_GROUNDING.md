# DEEP CONTEXT GROUNDING + GOVERNANCE — Code Trace (2026-06-03)

Scope: what grounds a Teresa response, retrieval quality, the policy layer, freshness, failure modes, multi-tenant safety. Code-verified, no builds.

## TL;DR
- Grounding is **rich but loosely budgeted**. Two assembly paths exist: the **live path** = `AIPipeline.buildSystemPrompt` (server/src/services/ai/AIPipeline.ts:1063) consuming `AIContextBuilder.buildContext` (server/src/services/aiContextBuilder.ts:171). A **legacy path** `AIOrchestrator._buildPrompt` (aiOrchestrator.ts:439) renders only a thin slice and is bypassed by `/chat/stream`.
- Retrieval is **real hybrid RAG** (OpenAI `text-embedding-3-small` + JS cosine + BM25 + optional reranker) with a keyword `LIKE` fallback — NOT a stub. But the ACL-hardened `ContextRetrievalService` is wired ONLY to explicit attachment grounding; the broad org/project doc grounding goes through `KnowledgeService.getDocuments` + legacy ragService.
- Governance policy is real and enforced server-side (contextGovernance.ts:109), with a backend API — but **zero frontend UI**. Several default categories are stripped silently.
- Freshness: **excellent** — `buildResolvedContext` does live DB reads every call, no caching, so new interview answers/docs reach the next call immediately.
- Multi-tenant: **safe** in the grounding path — every query is scoped by `organizationId` from the auth token.

---

## 1. Ordered grounding sources + token allocation

Assembled in `AIPipeline.buildSystemPrompt` (AIPipeline.ts:1063-1320), parts joined with `\n\n`. Order = priority (later = nearer the model's most-recent attention; language block is appended LAST by design):

| # | Source | file:line | Budget / cap |
|---|--------|-----------|--------------|
| 1 | Role/persona prompt (SSOT registry → `promptAssembler.assemble`, fallback `buildPersonaPrompt`) | AIPipeline.ts:1076-1141 | registry-defined |
| 2 | **Organization section** — name, profile, industry, strategy, systems, ops, **terminology**, **orgPatterns**, **interview findings** (confidence-tagged), **contextItemsSample** (raw interview Q&A / evidence / manual notes) | AIPipeline.ts:1144-1146, builder aiContextBuilder.ts:504-724, render 1331-1470 | findings/terminology unbounded in builder; contextItemsSample capped: 8 Q&A / 5 evidence / 5 notes / 5 doc-extractions, truncated 240–360 chars (aiContextBuilder.ts:625-668) |
| 3 | Project section (phase, initiatives, governance rules) | AIPipeline.ts:1150-1151; builder 729-773 | small |
| 4 | Execution (tasks/initiatives/decisions/blockers) | AIPipeline.ts:1154-1156; builder 778-840 | LIMIT 10 each |
| 4.5 | User memory (style, expertise; language & recentTopics deliberately NOT rendered for scoping/i18n) | AIPipeline.ts:1165-1180 | expertise inline |
| 4.5b | Custom instructions | AIPipeline.ts:1183-1185 | user text |
| 4.6 | Org memory (terminology ≤10, decision patterns ≤3) | AIPipeline.ts:1188-1207 | hard sliced |
| 5 | Pending approvals (HITL) | AIPipeline.ts:1210-1211; builder 1027-1086 | top 5 |
| 5.5 | Selected entity deep-load (initiative/task/assessment/decision) | AIPipeline.ts:1215-1216; builder 1096-1221 | KPIs ≤10, etc. |
| 6 | Screen context hint | AIPipeline.ts:1220-1221 | tiny |
| 7 | **Knowledge** (project documents list, previous decisions, strategic directions, approved ideas) — gated by `ragDisabled` | AIPipeline.ts:1224-1226; builder 845-1008 | docs/decisions sliced |
| 7.5–7.7 | Assessment scores, financials (V8), historical patterns/RAID/decision memory | AIPipeline.ts:1229-1242; builder 1227-1593 | axes ≤10, scenarios ≤3, RAID ≤10 |
| 7.8 | Industry benchmarks (if assessment present) | AIPipeline.ts:1244-1258 | — |
| 7.9 | **Knowledge graph** context (top 10 entities) | AIPipeline.ts:1260-1269 | 10 entities |
| 7.10 | Help/KB docs (only for product/how-to queries) | AIPipeline.ts:1271-1296 | 3 articles × 1200 chars |
| 8 | Behavioral instructions | AIPipeline.ts:1298-1299 | fixed |
| 9 | **LANGUAGE INSTRUCTION** (appended last, highest priority) | AIPipeline.ts:1301-1317 | fixed |

**RAG retrieved chunks** are NOT injected here — they enter via the `/chat/stream` route as a `systemInstruction` addendum for attachments (ai.routes.ts:3501-3560+) and via legacy ragService chunk injection.

**Token budgeting is crude:** the builder estimates size as `JSON.stringify(ctx).length` and only trims when `> 12000` chars (≈3k tokens), trimming execution then knowledge arrays (aiContextBuilder.ts:354-379). There is **no per-section token accounting**, no priority-aware truncation across sections, and the heavy free-text sections (findings, contextItemsSample, KG, help docs) are added AFTER this cap with no second pass. The orchestrator path has a separate `AIMemoryManager.autoTrimContext` (aiOrchestrator.ts:447) but that path is bypassed by streaming.

## 2. Retrieval mechanism — VERDICT: real hybrid RAG (not stub)

`server/src/services/ragService.ts`:
- `generateEmbedding` → OpenAI `text-embedding-3-small`, 1536-dim (embeddingService.ts:18-19, ragService.ts:298-334). Real API call, gated on `OPENAI_API_KEY` (embeddingService.ts:71).
- `hybridSearch` (ragService.ts:691): runs `bm25Search` + `_vectorSearch` in parallel, fuses with `hybridScore = alpha*vector + (1-alpha)*bm25` (line 748), optional cross-encoder rerank (rerankerService, line 764-779). Real relevance ranking.
- Vector similarity = **in-JS cosine** over embeddings stored as JSON strings in `knowledge_chunks.embedding` (cosineSimilarity ragService.ts:262; `_vectorSearch` 793-844). **No pgvector / ANN index** — brute-force scan of all chunks WHERE `embedding IS NOT NULL`. Scales poorly at high chunk counts.
- Keyword fallback: `getContextKeyword` uses `content LIKE ?` (ragService.ts:436-443), injected at similarity 0.5 when embeddings yield nothing (line 550-560).

**ACL at retrieval:** Strong in `ContextRetrievalService.retrieveContext` (ContextRetrievalService.ts:333) — `fetchAccessibleDocuments` enforces `organization_id = ? AND (scope='project' OR (scope='user' AND owner_id=?))` and drops unauthorized/non-ready docs as "degraded" (lines 135-179). **But this service is only invoked for explicit attachment IDs** (ai.routes.ts:3505-3546). The default broad grounding uses `KnowledgeService.getDocuments(orgId)` (aiContextBuilder.ts:931) whose signature ignores `_userId`/`_role` (KnowledgeService.ts:655) — org-scoped only, no per-user/per-doc ACL there (per-doc visibility is layered separately via `documentGovernance.filterDocumentsByVisibility`, aiContextBuilder.ts:939-973, fail-open on error, line 974).

## 3. Governance / policy — default-strip table + UI gap

`server/src/services/ai/contextGovernance.ts`. SSOT = `organization_ai_settings.context_policy_json`. `filterContextByPolicy` (line 109) applied in builder at aiContextBuilder.ts:326-349.

| Category | DEFAULT (contextGovernance.ts:31-43) | When OFF, strips | Silent? |
|---|---|---|---|
| ORG_PROFILE | true | (profile always passes) | — |
| ORG_TERMINOLOGY | **true** | `org.terminology*` | yes |
| ORG_PATTERNS | **false (off)** | `org.topPatterns`, `org.orgPatterns` | **yes — learned patterns stripped by default** |
| ORG_STRATEGY | true | `knowledge.strategicDirections` | yes |
| ORG_SECURITY_POSTURE | **false (off)** | `filtered.securityPosture` | yes |
| ORG_FINANCIAL_SUMMARY | **false (off)** | `filtered.financialData` | **yes — financials stripped by default** |
| ORG_DOCUMENTS | true | sets `knowledge.projectDocuments = []` | yes |

- **Who can change policy:** backend API exists — `GET/PUT /context-policy` in ai-governance.routes.ts:82-126 calling `getOrgContextPolicy`/`updateOrgContextPolicy`. Persistence is upsert with a typed `ContextGovernancePersistenceError` (contextGovernance.ts:76-103).
- **UI gap:** `grep` for `context_policy|ORG_TERMINOLOGY|updateOrgContextPolicy|ContextGovernance` across `src/**` (frontend) returns **zero** matches. The policy is admin-invisible — no toggle screen. Defaults (`ORG_PATTERNS`, `ORG_FINANCIAL_SUMMARY`, `ORG_SECURITY_POSTURE` off) silently degrade grounding with no operator awareness and no explainability surfaced to the user (only a debug snapshot attached to `aiSettings.orgContextPolicy`, aiContextBuilder.ts:341-348).
- **Silent degradation risk:** stripping `financialData`/`orgPatterns` by default means Teresa can answer "I don't have that" even when the data exists — indistinguishable from a true data gap.

## 4. Freshness / staleness

- `buildResolvedContext` (OrganizationContextService.ts:868) performs **live `Promise.all` DB reads every call** — org, profile, interview context, insights, evidence, claims, timeline, snapshot. **No cache layer** (grep for `cache|NodeCache|lru|new Map()` in the service = none). New interview answers, evidence, manual notes reach the **next** Teresa call immediately.
- `contextItemsSample` is read fresh from `organization_context_items` `ORDER BY updated_at DESC LIMIT 60` (aiContextBuilder.ts:583-590) — also live.
- Policy is read fresh per call (contextGovernance.ts:45-74). No rebuild trigger needed; there is no derived/materialized cache to invalidate.
- Only staleness source: RAG requires the document to be **chunked + embedded** first (ingestion pipeline). A just-uploaded doc not yet embedded is excluded as non-ready (ContextRetrievalService.ts:161-179) — correct, not a grounding bug.

## 5. Failure modes — degrade gracefully, with one hallucination risk

- Every enrichment layer is wrapped in try/catch and returns `null`/empty on failure (PMO health 200-205, AI settings 217-225, assessment 1375, financial 1498, historical 1589, system docs 276-277, workbooks 302). `buildResolvedContext(...).catch(() => null)` (aiContextBuilder.ts:550) — org enrichment failure degrades to bare `organizations.name`.
- Policy enforcement failure is caught and **skipped** (aiContextBuilder.ts:350-352) → **fails OPEN** (context passes unfiltered). Combined with per-doc visibility fail-open (line 974), governance errors expose MORE context, not less — a policy-bypass risk.
- Empty context: prompt parts are `.filter(Boolean)` (AIPipeline.ts:1319), so missing sections simply vanish; persona + language block always remain. Behavioral instructions include "Never claim access to data outside the current tenant" (ai.routes.ts:1804) — a guard, but no explicit "if no grounding, say you lack data" instruction, so an empty-context query can still produce ungrounded prose.
- Over-budget: only the >12000-char trim (section 1) — blunt, pre-enrichment, can still ship oversized prompts after KG/help-docs are appended.

## 6. Multi-tenant safety — SAFE

- All builder queries are parameterized by `organizationId` (e.g. aiContextBuilder.ts:480-590, 901, 931, 1257, 1399, 1428) sourced from `req.organizationId` (auth token) at the route boundary.
- RAG retrieval filters by `organization_id` (ContextRetrievalService.ts:146-152; ragService `_vectorSearch`/`bm25Search` take `organizationId`).
- `contextItemsSample` additionally filters `visibility_scope IN ('organization','public')` (aiContextBuilder.ts:588).
- Cross-tenant memory bleed previously fixed: `recentTopics` (user-level rollup) is deliberately NOT rendered (AIPipeline.ts:1173-1176). `cross_tenant` is an explicit forbidden access reason (ai.routes.ts:4599).
- No code path was found that mixes another org's `organizationId` into the grounding queries. **No cross-org bleed in the grounding path.**

---

## Completion items

### P0 (trust / safety)
- **Governance fails open.** Make policy-enforcement and per-doc visibility failures **fail closed** (or at minimum strip sensitive categories) — aiContextBuilder.ts:350-352 and 974. Currently an exception = full context leak.
- **No "no-grounding → admit gap" instruction.** Add a behavioral rule: when org/knowledge sections are empty, Teresa must state it lacks data rather than generate ungrounded content. AIPipeline.ts:1298 (behavioral instructions).
- **Default-off categories cause silent false "I don't have data".** Either flip `ORG_PATTERNS`/`ORG_FINANCIAL_SUMMARY` defaults to a deliberate product decision or surface a user-visible "X categories disabled by policy" note. contextGovernance.ts:31-43.

### P1 (grounding quality)
- **Wire `ContextRetrievalService` (ACL + lineage) into the default org/project grounding**, not just attachments. Replace the org-only `KnowledgeService.getDocuments` path (aiContextBuilder.ts:931) so all retrieved docs get per-user ACL + degraded-reason reporting.
- **Real token budgeting.** Replace the single `JSON.stringify().length > 12000` cap (aiContextBuilder.ts:354-379) with priority-aware, per-section token accounting applied AFTER all sections (incl. KG/help docs/contextItemsSample) are assembled in AIPipeline.ts.
- **Ship the governance UI.** Backend API (ai-governance.routes.ts:82-126) has no frontend. Build an admin toggle screen for the 7 categories + piiRedaction + retention.

### P2 (scale / observability)
- **Vector search is brute-force JS cosine** over all chunks (ragService.ts:262, 805-844). Move to pgvector/ANN before chunk volume grows.
- **Expose grounding explainability** to the user (which sources fed the answer, degraded reasons) — lineage is already recorded (ContextRetrievalService.ts:516) but only for attachment path; extend to the full prompt and surface in UI.
- **Consolidate the two prompt builders.** `AIOrchestrator._buildPrompt` (aiOrchestrator.ts:439) renders a thin, divergent context and is dead for streaming — retire or align to avoid drift.
