# DEEP RE-VERIFICATION — Module 16: Organizacja / Org Context Engine

**Date:** 2026-06-03 | **Branch:** feat/wave1-foundations | **Method:** UI→route→service→DB trace, no builds.

This supersedes the surface claims in `COMPLETION_16_organizacja.md`. Two of its headline claims are **REFUTED** by code (KG injection, legacy-builder severity); the SMTP stub is **CONFIRMED**.

---

## Per-feature table

| Feature | Path traced | State | file:line |
|---|---|---|---|
| Claim-based context store (write) | `recordContextSource` INSERTs `organization_context_items` + `organization_context_claims` with `organization_id` + `visibility_scope` | **WORKS** | `OrganizationContextService.ts:699-749` |
| Real write callers | Interview answers, interview context, org profile, V8 interview-insights, V8 processFlow, demo seed | **WORKS** | `InterviewController.ts:5196,6225`; `organization-profiles.routes.ts:558`; `v8/interview-insights.routes.ts:718`; `v8/processFlow.routes.ts:333,364`; `demoSeedService.ts:1780` |
| `buildResolvedContext` (read) | Reads profiles, settings, sso, org context, metadata, ai_contexts, interview insights/evidence, claim counts, snapshot — all org-scoped | **WORKS** | `OrganizationContextService.ts:868-947` |
| Snapshot rebuild | `rebuildSnapshot` upserts `organization_context_snapshots`; cron job + Socket.IO realtime | **WORKS** | `OrganizationContextService.ts:749-789`; `orgContextRebuildJob.ts`; `orgContextRealtime.ts` |
| Org context → Teresa (primary) | `services/aiContextBuilder.ts._buildOrganizationContext` injects resolvedContext + `orgPatterns` + `terminology` + `contextItemsSample` | **WORKS** | `aiContextBuilder.ts:504,716-722` |
| Org context → Teresa (legacy compat) | `ai/aiContextBuilder.ts` `@ts-nocheck`; injects `organization_context_os` only (no sample/patterns/terminology) | **PARTIAL** | `ai/aiContextBuilder.ts:1,39-46` |
| ACL retrieval (Stage 3) | `ContextRetrievalService.retrieveContext` with scope filter (`project`/`user owner_id`) called in stream path | **WORKS** | `ai.routes.ts:3501-3546`; `ContextRetrievalService.ts:146-160` |
| Context governance policy filter | `getOrgContextPolicy` + `filterContextByPolicy` strips categories pre-LLM | **WORKS (no UI)** | `aiContextBuilder.ts:335-348` |
| Knowledge graph → Teresa | `knowledgeGraphService.buildGraphContext(orgId,10)` injected into AIPipeline context parts | **WORKS** ← doc said ABSENT | `AIPipeline.ts:1261-1268`; `knowledgeGraphService.ts:379` |
| KG retrieval (GraphRAG) | `graphRagService` walks entities+relations — but has **zero callers** outside its own file | **MOCK/ORPHAN** | `graphRagService.ts:192` (no importer) |
| Email invitations | All 3 `send*` methods log-only, return link, no SMTP | **MOCK** | `InvitationSendingService.ts:9-38` |
| Chat explicit-context write | No `recordContextSource` caller found in `ai.routes.ts` | **ABSENT** | (no hit in ai.routes) |

---

## 4 Lenses

### Lens 1 — Functionalities
Context store is genuinely real end-to-end: write (`recordContextSource`), claim derivation, snapshot rebuild, timeline/claims listing, all org-scoped. The **only true mock is email invite delivery** (`InvitationSendingService.ts:9-38`): user clicks Invite → toast success → recipient receives nothing. **CONFIRMED P0.**

### Lens 2 — Cross-module flow (THE context engine feeding ALL AI)
`aiContextBuilder` path **CONFIRMED** as the spine. `buildResolvedContext` consumed at Interview (`InterviewController`), Assessment (`assessment-workflow-v2.routes.ts:1510`), Radar (`radar.routes.ts`), Settings (`settings.routes.ts:359`), org-profiles, V8 interview. Policy/limits flow to all modules via `usePolicySnapshot()`. Engine is correctly central.

### Lens 3 — Teresa wiring + KG gap
**REFUTES the completion doc.** KG **IS** injected into Teresa via `AIPipeline.ts:1261-1268` (`buildGraphContext`), gated on `ctx.organization && request.organizationId`. Teresa can reason over entities/relations. The *real* residual gaps: (a) the richer `graphRagService` (semantic entity walk) is orphaned — zero importers; (b) legacy `ai/aiContextBuilder.ts` injects a thinner payload than the primary builder, creating dual-path drift.

### Lens 4 — Contextual memory (PRIMARY org long-term store)
**WORKS thoroughly.** Write: `recordContextSource` → `organization_context_items` (id, organization_id, source_type, source_id, author_user_id, channel, source_label, content_json, is_explicit, visibility_scope) + `organization_context_claims` (claim_path, value_json, confidence, claim_type, status, supersedes_claim_id). Read: `buildResolvedContext` + `listTimeline` + `listClaims`, all `WHERE organization_id = ?`. Scope: `visibility_scope` column on items; ACL enforced in `ContextRetrievalService` for retrieval. Multi-source lineage + supersession present. This is a credible long-term memory substrate.

---

## P0 / P1 / P2

**P0**
- P0-1 Email invite delivery is a logger stub — silent failure on every invite. `InvitationSendingService.ts:9-38`.

**P1**
- P1-1 `graphRagService` orphaned (semantic GraphRAG never reached); only the lighter `buildGraphContext` runs. `graphRagService.ts:192` (no caller).
- P1-2 Legacy `ai/aiContextBuilder.ts` `@ts-nocheck` injects thinner payload (no `contextItemsSample`/`orgPatterns`/`terminology`); dual-path drift. `ai/aiContextBuilder.ts:1,39-46`.
- P1-3 No chat-explicit-context write path (`recordContextSource` not called from `ai.routes.ts`) — user "remember this" in chat does not persist to org memory.

**P2**
- P2-1 Context-governance policy has no admin UI (filter engine exists). `aiContextBuilder.ts:335-348`.
- P2-2 `ContextCacheService` Redis fallback in-memory only. Zero frontend tests for Organization components.

**Net correction vs COMPLETION_16:** KG-not-injected claim is wrong; real KG gap is the orphaned `graphRagService` + missing chat-write path.
