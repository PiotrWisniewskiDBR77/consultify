# Organization Context Engine Stage 0 Baseline Audit

> Status: Stage 0 Audit v1  
> Date: 2026-05-03  
> Owner: Product + Engineering + Security  
> Canonical source: `docs/product/ORGANIZATION_CONTEXT_ENGINE_SOURCE_OF_TRUTH.md`  
> Implementation plan: `docs/product/ORGANIZATION_CONTEXT_ENGINE_IMPLEMENTATION_PLAN.md`  
> Gate: `Gate 0 - Architecture Readiness`

---

## 1. Executive Summary

Stage 0 confirms that Consultify already has several important building blocks for an Organization Context Engine:

- `knowledge_docs` and `knowledge_chunks` are already used by RAG flows.
- AI attachment ingestion already extracts PDFs/DOCX/text and writes chunks.
- `documents.library` and Interview Insight Creator now have early context document integration.
- `OrganizationContextService` can record extracted context claims.
- Some degraded UI patterns already exist in superadmin/insight/chat surfaces.

However, the current system is not yet safe or coherent enough for broad organization-memory rollout.

The biggest findings:

1. **There are multiple parallel ingestion and knowledge stores.**
2. **Some retrieval paths trust caller-supplied document ids too much.**
3. **Project-scoped uploads need stronger backend authorization.**
4. **Some UI upload surfaces still behave like local attachments, not governed context.**
5. **Status vocabularies are inconsistent across `indexed`, `pending`, `uploaded`, `ready`, etc.**
6. **There is no complete Stage 1-3 test gate for ACL, retrieval, lineage, quotas, and degraded states.**

Gate 0 result:

`BLOCKED_P1`

Reason:

The architecture direction is clear, but Stage 1 implementation must first close the high-risk retrieval/ACL and schema-coherence gaps listed in this document.

---

## 2. Canonical Direction Confirmed

Stage 0 confirms this direction:

`extend and converge existing knowledge infrastructure rather than create a parallel document memory system`

Short-term canonical base:

- `knowledge_docs`
- `knowledge_chunks`
- existing RAG service paths
- `ContextDocumentService`
- `generation_context_json` for first lineage integration

Long-term target:

- evolve toward the source-of-truth model:
  - `knowledge_assets`
  - `knowledge_processing_jobs`
  - `knowledge_normalized_documents`
  - `knowledge_chunks`
  - `knowledge_embeddings`
  - `knowledge_lineage_events`
  - `tenant_storage_quotas`

Important:

`knowledge_documents` already exists as a richer enterprise KB concept, but the runtime document/RAG flows currently also use `knowledge_docs`. Stage 1 must explicitly decide whether `knowledge_docs` becomes the compatibility facade, the runtime table, or a migration bridge into `knowledge_documents`.

---

## 3. Backend Inventory

### 3.1 Primary Upload And Ingestion Routes

| Surface | Path | Current behavior |
| --- | --- | --- |
| Document library upload | `server/src/routes/documents.routes.ts` | `POST /api/documents/upload`, multer upload, delegates to `contextDocumentService.uploadAndIngest` |
| AI chat attachment ingest | `server/src/routes/ai.routes.ts` | `POST /api/ai/attachments/ingest`, extracts PDF/DOCX/text, writes `knowledge_docs` / `knowledge_chunks` |
| AI URL attachment ingest | `server/src/routes/ai.routes.ts` | `POST /api/ai/attachments/ingest-url`, fetches URL and writes knowledge chunks |
| V8 Interview context upload | `server/src/routes/v8/interview.routes.ts` | `POST /api/v8/interview/context-documents/upload`, delegates to `contextDocumentService.uploadAndIngest` |
| Media ingestion placeholders | `server/src/routes/media-ingestion.routes.ts` | Metadata routes exist; ingest endpoints honestly return `503` when not configured |
| Interview evidence/artifact ingestion | `server/src/controllers/InterviewController.ts` | Uses `IngestionPipeline` for some artifacts; stores in a separate embedding path |
| Notebook attachments | `server/src/routes/my-work/notebook.routes.ts` | Separate attachment system; not yet unified with context engine |

### 3.2 Core Services

| Service | Path | Role |
| --- | --- | --- |
| `ContextDocumentService` | `server/src/services/organizationContext/ContextDocumentService.ts` | Current main service for backend upload, extraction, chunking, status, ACL-ish listing |
| `RagService` | `server/src/services/ragService.ts` | Hybrid/keyword/vector retrieval over `knowledge_docs` / `knowledge_chunks` |
| `OrganizationContextService` | `server/src/services/organizationContext/OrganizationContextService.ts` | Records context items/claims including attachment extraction |
| `IngestionPipeline` | `server/src/services/ai/ingestionPipeline.ts` | Separate AI ingestion path writing to `ai_knowledge_embeddings` |
| `EmbeddingService` | `server/src/services/ai/embeddingService.ts` | Stores chunks in `ai_knowledge_embeddings` for some pipelines |
| `KnowledgeIndexer` | `server/src/services/ai/knowledgeIndexer.ts` | Filesystem/batch indexing into knowledge tables |

### 3.3 Key Backend Finding

The backend has enough pieces to build the engine, but they are fragmented:

- `ContextDocumentService` writes to `knowledge_docs` and `knowledge_chunks`.
- Some AI ingestion writes to `knowledge_docs`/`knowledge_chunks` directly.
- `IngestionPipeline` writes to `ai_knowledge_embeddings`.
- `knowledge_documents` exists in migrations as a richer model.
- `multimodalChunker` references `knowledge_chunks.document_id`, while major RAG paths use `knowledge_chunks.doc_id`.

This must be resolved before scale/multimodal expansion.

---

## 4. Frontend Inventory

### 4.1 Main Document And Context Surfaces

| Surface | Path | Current behavior |
| --- | --- | --- |
| Document library panel | `src/components/documents/DocumentSidePanel.tsx` | Project/user tabs, upload/list/download, status badges |
| Document toggle | `src/components/documents/DocumentToggleButton.tsx` | Opens document side panel |
| Interview Insight Creator | `src/components/Interview/InsightCreatorModal.tsx` | Lists/uploads context documents and submits selected document ids |
| Interview Insight Viewer | `src/components/Interview/InsightViewer.tsx` | Reads source pack and degraded source states |
| Superadmin RAG docs | `src/views/superadmin/AIPlatformModule/Knowledge/DocumentsRAGTab.tsx` | Separate knowledge document upload/admin surface |
| AI Chat | `src/components/AIChat/UnifiedChatPanel.tsx` and `EnhancedChatInput.tsx` | Uploads files/URLs through AI attachment ingestion |
| Work Canvas uploads | `src/components/AIChat/WorkCanvasDocumentPanel.tsx` | Uploads files via chat attachment ingest |
| Notebook attachments | `src/components/notebook/*` | Separate attachment flow |
| Initiative attachments | `src/components/Initiatives/sections/AttachmentsSection.tsx` | Currently local blob/url pattern, not canonical backend context |
| Report builder uploads | `src/components/reports/GenericReportsWorkspace.tsx` | Separate report-builder upload flow |

### 4.2 UI Degraded Handling

Good existing patterns:

- `InsightCreatorModal` disables non-ready context docs.
- `InsightViewer` supports degraded source pack display.
- AI Chat shows partial/all failed upload toasts.
- `DocumentsRAGTab` has degraded state for unavailable knowledge docs.

Gaps:

- `DocumentSidePanel` still has places where failures are `console.error` only.
- `OrganizationContextOverview` and `useOrganizationContext` can turn failed API calls into empty context, which risks fake-success/false-empty interpretation.
- `GenericReportsWorkspace` uses `alert()` and local error handling that does not match enterprise UI standards.
- Initiative attachments are local blobs and can imply persistence without governed backend storage.

---

## 5. Schema And Data Model Inventory

### 5.1 Existing Tables

| Table | Role |
| --- | --- |
| `knowledge_docs` | Runtime lightweight document table used by current RAG/document flows |
| `knowledge_documents` | Richer enterprise KB table from migrations |
| `knowledge_chunks` | Chunk table used by RAG; column shape varies across migrations/runtime |
| `ai_knowledge_embeddings` | Separate pgvector-style embedding store |
| `conversation_message_attachments` | Chat/message attachment pointers |
| `organization_context` | Organization profile/facts |
| `organization_context_items` | Context OS item/event store |
| `organization_context_claims` | Claim-level organization context |
| `organization_context_snapshots` | Resolved context snapshots |
| `organization_context_versions` | Versioned context payloads |
| `interview_quotas` | Interview quota model |
| `api_quotas` / `quota_alerts` | Generic quota infrastructure |

### 5.2 Migration Sources

Important migration files:

- `server/migrations/000_z_core_baseline.sql`
- `server/migrations/000_initdb_core_tables.sql`
- `server/migrations/221_knowledge_base_tables.sql`
- `server/migrations/266_knowledge_rag.sql`
- `server/migrations/295_interview_context.sql`
- `server/migrations/652_v4_interview_enterprise.sql`
- `server/migrations/669_organization_context_os.sql`
- `server/migrations/20260227_01_ai_governance.sql`
- `server/migrations/20260303_schema_alignment.sql`
- `server/migrations/20260331_p35b_canonical_model_completion.sql`
- `server/migrations/init-pgvector.sql`
- `server/migrations/756_interview_insight_downstream_lineage.sql`
- `server/migrations-v2/001_baseline_20260413.sql`

### 5.3 Schema Risk

`knowledge_chunks` has competing conventions:

- `doc_id`
- `document_id`
- JSON/string embeddings
- BYTEA/native embeddings
- separate `ai_knowledge_embeddings`

Stage 1 must define a compatibility bridge and a final target. Otherwise multimodal chunks will be written but not retrievable consistently.

---

## 6. Existing Tests

Current useful coverage:

- `tests/integration/routes/documentsRoutes.no-stubs.test.ts`
- `tests/integration/routes/documents.test.js`
- `tests/components/Interview/InsightCreatorModal.context-documents.test.tsx`
- `tests/components/Interview/InsightCreatorModal.error-state.test.tsx`
- `tests/integration/routes/organization-context.routes.test.ts`
- `tests/unit/backend/services/organizationContextService.test.ts`
- `tests/integration/routes/conversations.context-os.test.ts`
- `tests/unit/backend/services/knowledgeRagService.test.ts`

Major missing coverage:

- real DB tests for `GET/POST /api/v8/interview/context-documents`,
- `InterviewInsightService.buildContextDocumentPack` ACL and status matrix,
- cross-tenant document id retrieval attacks,
- project membership validation for uploads,
- non-ready document exclusion from retrieval,
- lineage write/read-back tests,
- quota enforcement for context uploads,
- degraded UI tests for `ocr_required`, `unreadable`, `failed`, `quota_blocked`, `policy_blocked`,
- prompt injection from uploaded documents.

---

## 7. Risk Register

### P0 Risks

#### P0.1 - Retrieval May Trust Caller-Supplied Document IDs

Some RAG paths skip or weaken `organization_id` filtering when `documentIds` are supplied, relying on the caller to provide authorized ids.

Risk:

Known or guessed document ids could become an authorization boundary.

Affected areas:

- `server/src/services/ragService.ts`
- `server/src/routes/ai.routes.ts`
- any flow passing `attachmentDocIds` or selected context ids into retrieval

Required fix:

Retrieval must always enforce organization/tenant ACL server-side, even when explicit document ids are supplied.

#### P0.2 - Cross-Module Context Paths Can Bypass Canonical Policy

Multiple ingestion paths can store or reference context outside the canonical context engine.

Risk:

A module may allow AI to use material without consistent ACL, status, quota, or lineage.

Required fix:

All module-specific ingestion must wrap or delegate to the canonical context engine.

### P1 Risks

#### P1.1 - Project Uploads Need Project Authorization

Project-scoped uploads accept `projectId` but do not consistently validate project membership/capability before storing scoped context.

Required fix:

Upload must validate project existence and user access before `scope=project` is accepted.

#### P1.2 - Storage/Quota Policy Is Not Enforced For Context Uploads

Quota tables/services exist, but context document uploads do not yet consistently enforce storage or processing quotas.

Required fix:

Stage 1 must at least record usage and Stage 6 must enforce. If quota policy already exists for plans, upload must call it.

#### P1.3 - UI Can Present Failed Context As Empty Context

Some organization context UI paths convert backend failure into empty/fallback context.

Required fix:

Failures must show degraded/unavailable state, not false empty success.

#### P1.4 - Local Blob Attachments In Initiatives

Initiative attachments currently use local blob/object URLs.

Required fix:

Initiative attachments must either be clearly local/transient or move to canonical backend asset upload.

### P2 Risks

#### P2.1 - Status Vocabulary Drift

Current statuses include `pending`, `indexed`, `uploaded`, `processing`, `ready`, etc.

Required fix:

Stage 1 must normalize external API statuses to the canonical vocabulary.

#### P2.2 - Fragmented Embedding Stores

`knowledge_chunks.embedding` and `ai_knowledge_embeddings` coexist.

Required fix:

Stage 1/2 must define which store retrieval uses and how compatibility works.

#### P2.3 - Inconsistent UX Across Upload Surfaces

Document library, chat, reports, notebook, initiatives, and superadmin have inconsistent upload/error/status patterns.

Required fix:

Stage 3+ should introduce shared context selector/status UI kit.

---

## 8. Stage 0 Decisions

### Decision 1 - No New Parallel Context Store

Do not create a new unrelated document database for the Organization Context Engine.

Use existing `knowledge_*` infrastructure and evolve it.

### Decision 2 - Retrieval ACL Must Move Into The Retrieval Layer

Every retrieval call must enforce:

- `organization_id`,
- user access,
- project access,
- asset/document status,
- deleted/revoked state,
- selected workflow scope.

This must be true even if callers pass explicit ids.

### Decision 3 - `ContextDocumentService` Is The Short-Term Entry Point

For Stage 1, `ContextDocumentService` should become the consolidation point for:

- document library uploads,
- Interview Insight uploads,
- later chat/canvas/report uploads where feasible.

It may be renamed/evolved toward `ContextAssetService` after Stage 1 stabilizes.

### Decision 4 - Canonical Status Projection Is Required

Even if internal DB rows keep legacy statuses, API/UI must project to:

- `uploaded`
- `processing`
- `ready`
- `partial_ready`
- `ocr_required`
- `unreadable`
- `failed`
- `policy_blocked`
- `quota_blocked`
- `deleted`

### Decision 5 - Stage 1 Must Be Security And Schema First

Do not start image/audio expansion before:

- retrieval ACL is fixed,
- schema direction is chosen,
- project upload authorization is enforced,
- lineage baseline exists.

---

## 9. Gate 0 - Architecture Readiness

### Gate Status

`BLOCKED_P1`

### Why Not PASS Yet

The inventory is complete enough to proceed, but Stage 1 cannot start as "just implementation" until the following blockers are explicitly addressed in the Stage 1 task list:

1. Retrieval must not trust caller-supplied document ids.
2. Project-scoped uploads must validate project membership/capability.
3. `knowledge_docs` vs `knowledge_documents` vs `ai_knowledge_embeddings` must have a migration/compatibility decision.
4. Module-specific ingestion paths must be classified as:
   - canonical,
   - wrapper,
   - deprecated,
   - out of scope.
5. Context upload quota behavior must be defined.

### Gate 0 Exit Criteria

Stage 1 may begin when the Stage 1 implementation plan includes tasks for:

- retrieval ACL hardening,
- schema compatibility decision,
- project upload authorization,
- canonical status projection,
- baseline lineage write,
- test coverage for P0/P1 cases.

### Gate 0 Practical Recommendation

Proceed to Stage 1, but treat the first Stage 1 milestone as:

`Security and schema hardening before new feature expansion`

---

## 10. Immediate Stage 1 Backlog

### Must Do First

1. Add org/user/project ACL enforcement inside retrieval service for explicit `documentIds`.
2. Add server-side validation of `projectId` for project-scoped uploads.
3. Decide and document the runtime source of truth between `knowledge_docs` and `knowledge_documents`.
4. Add migration or compatibility layer for `knowledge_chunks.doc_id` / `document_id`.
5. Add canonical status projection helper.
6. Add tests for cross-tenant selected ids and non-ready documents.

### Should Do In Stage 1

1. Add safe degraded UI in `DocumentSidePanel` failures.
2. Change organization context empty fallback to degraded state on API failure.
3. Add quota usage recording for context uploads.
4. Classify local initiative attachments as non-context until backend persisted.
5. Add source-of-truth links to related module docs.

### Defer Until Later Stages

- image understanding,
- audio understanding,
- video,
- advanced DLP,
- large-scale retrieval reranking,
- full admin quota dashboard.

---

## 11. Final Stage 0 Result

Stage 0 achieved its purpose:

- existing systems are mapped,
- risky fragmentation is visible,
- canonical direction is chosen,
- Gate 0 blockers are explicit,
- Stage 1 can start with the right priorities.

Readiness result:

`INCONCLUSIVE -> BLOCKED_P1 for unrestricted implementation, but READY_FOR_STAGE_1_SECURITY_HARDENING`

Meaning:

The team should continue, but the next work must harden the foundation before expanding modality support or marketing claims.
