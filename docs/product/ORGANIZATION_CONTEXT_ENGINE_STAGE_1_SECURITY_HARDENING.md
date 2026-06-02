# Organization Context Engine Stage 1 Security Hardening

> Status: Stage 1 Partial Implementation v10  
> Date: 2026-05-03  
> Owner: Product + Engineering + Security  
> Canonical source: `docs/product/ORGANIZATION_CONTEXT_ENGINE_SOURCE_OF_TRUTH.md`  
> Stage 0 audit: `docs/product/ORGANIZATION_CONTEXT_ENGINE_STAGE_0_BASELINE_AUDIT.md`  
> Gate: `Gate 1 - Secure Upload Gate`

---

## 1. Scope Of This Iteration

This document covers the first ten Stage 1 increments:

- `Stage 1A - Security hardening`
- `Stage 1B - Schema compatibility and canonical status projection`
- `Stage 1C - Quota accounting and lineage ledger baseline`
- `Stage 1D - Hard quota gates and lineage read APIs`
- `Stage 1E - Integration matrix expansion`
- `Stage 1F - Admin audit read surfaces`
- `Stage 1G - Frontend admin audit surface`
- `Stage 1H - Runtime schema direction and insight boundary guard`
- `Stage 1I - Quota UI copy and context storage visibility`
- `Stage 1J - V8 route matrix, deleted/revoked guard, and quota management decision`

Stage 1A started with the highest-risk hardening items from Stage 0:

1. Explicit `documentIds` in RAG retrieval must not bypass organization filtering.
2. Chat attachment fallback loading must not read chunks by document id alone.
3. Project-scoped document uploads must validate project access server-side.
4. Tests must prove the new guardrails.

These increments intentionally do not yet complete the full Stage 1 scope:

- migration of every upload surface.

Those remain open Stage 1 items.

---

## 2. Implemented Hardening

### 2.1 RAG Explicit Document ID Guard

Changed:

- `server/src/services/ragService.ts`

Behavior now:

- when `documentIds` are supplied, RAG requires `organizationId`,
- if `organizationId` is missing or `knowledge_docs.organization_id` is unavailable, retrieval fails closed and returns no chunks,
- explicit `documentIds` are filtered by:
  - `d.id IN (...)`,
  - `d.organization_id = ?`,
  - `d.deleted_at IS NULL` when the column exists,
  - `d.status IN ('ready', 'indexed')` when the column exists.

Why:

Document ids must never become the authorization boundary. The retrieval layer must enforce tenant scoping even when callers pass selected ids.

### 2.2 Chat Attachment Fallback Guard

Changed:

- `server/src/routes/ai.routes.ts`

Behavior now:

- direct fallback chunk loading requires request organization id,
- fallback SQL filters `knowledge_docs.organization_id`,
- fallback only allows `ready` or `indexed` documents when status exists.

Why:

The fallback path previously loaded chunks directly by document id. Fallbacks are high-risk because they often bypass the main retrieval service. They must follow the same access model.

### 2.3 Project Scoped Upload Access Guard

Changed:

- `server/src/services/organizationContext/ContextDocumentService.ts`
- `server/src/routes/documents.routes.ts`
- `server/src/routes/v8/interview.routes.ts`

Behavior now:

- `scope=project` upload requires project access check before ingestion,
- privileged org roles may upload to any project in the same organization,
- non-privileged users must have `project_members` membership,
- membership-check errors fail closed,
- project access failure returns `403` with explicit code.

Why:

Project context becomes shared AI memory. A user must not be able to attach documents to a project they do not belong to.

### 2.4 Chunk Schema Compatibility

Changed:

- `server/src/services/ragService.ts`
- `server/src/services/organizationContext/ContextDocumentService.ts`

Behavior now:

- RAG joins `knowledge_chunks` through `doc_id`, `document_id`, or both when both columns exist,
- context document ingestion creates and writes both chunk document id columns when available,
- chunk deletion during re-ingestion clears both identifiers,
- indexes are created for both identifiers where supported by the runtime schema.

Why:

The codebase already has modules writing chunks with either `doc_id` or `document_id`. The organization context engine must not silently lose context because the writer and retriever disagree on the column name.

### 2.5 Canonical Status Projection

Changed:

- `server/src/services/organizationContext/ContextDocumentService.ts`

Behavior now:

- context document output projects legacy statuses into canonical Organization Context Engine statuses,
- `indexed`, `complete`, and `completed` become `ready`,
- `pending` and `queued` become `uploaded`,
- `error` becomes `failed`,
- `archived` and `removed` become `deleted`,
- unknown statuses fail closed to `failed`,
- list filters for canonical statuses also include known legacy equivalents.

Why:

UI and AI workflow logic need a single truthy status vocabulary. Legacy status drift must not create fake success or hide degraded ingestion states.

### 2.6 Storage Usage Accounting Baseline

Changed:

- `server/src/services/organizationContext/ContextDocumentService.ts`

Behavior now:

- context document upload writes an append-only `organization_context_storage_events` row,
- storage events include organization, user, document, project, scope, byte delta, upload source, and metadata,
- upload accounting also best-effort forwards to existing `usageService.recordStorageUsage`,
- project-scoped uploads best-effort forward to `usageService.recordProjectStorageUsage`,
- accounting failures are logged but do not create fake upload failures.

Why:

The context engine needs quota traceability before hard quota gates are enabled. Stage 1C records usage without pretending that all billing plans, project limits, and tenant quota policies are already fully wired.

### 2.7 Context Lineage Ledger Baseline

Changed:

- `server/src/services/InterviewInsightService.ts`

Behavior now:

- Interview Insight context document selection writes to `organization_context_lineage_events`,
- completed insight generation writes a second lineage event with used chunk excerpts, token count, and generation time metadata,
- `generation_context_json` now points to the ledger table via `lineageLedger`,
- lineage payload includes requested ids, selected ids, degraded status, degraded reasons, document versions, chunk ids, chunk indexes, source labels, and short excerpts,
- lineage writes are best-effort and logged on failure so generation does not fail due to audit table drift.

Why:

`generation_context_json` is useful local traceability, but Organization Context needs an append-only ledger that can later power audit views, governance export, read-back, and security investigations.

### 2.8 Hard Quota Gate For Context Uploads

Changed:

- `server/src/services/organizationContext/ContextDocumentService.ts`
- `server/src/routes/documents.routes.ts`
- `server/src/routes/v8/interview.routes.ts`

Behavior now:

- before writing a context file to storage, upload checks organization storage quota via `usageService.checkQuota(..., 'storage')`,
- project-scoped uploads also check project storage via `usageService.checkProjectQuota`,
- when a configured quota cannot fit the file, the service writes a `knowledge_docs` metadata row with `status = 'quota_blocked'`,
- legacy and V8 upload endpoints return `429` with explicit quota code, quota details, and the blocked document metadata,
- quota service unavailability is logged and does not silently mark a file as uploaded or ready.

Why:

Storage limits must be enforced before context becomes durable AI memory. When blocked, users and operators need an auditable object and honest `quota_blocked` state rather than a generic upload failure.

### 2.9 Context Lineage Read API

Changed:

- `server/src/services/InterviewInsightService.ts`
- `server/src/routes/v8/interview.routes.ts`

Behavior now:

- `InterviewInsightService.listContextLineage(organizationId, insightId)` reads append-only lineage events by organization and target insight,
- V8 exposes `GET /api/v8/interview/insights/:id/context-lineage`,
- the route first validates insight existence and organization ownership,
- response includes lineage events with requested document ids, selected document ids, used chunk metadata, degraded reasons, event metadata, and timestamps.

Why:

Traceability must be readable, not only written. This API is the backend foundation for audit panels, read-back, and debugging user-visible AI answers.

### 2.10 Admin Audit Read Surfaces

Changed:

- `server/src/routes/auditLog.routes.ts`

Behavior now:

- admin users can read context lineage events through `GET /api/audit-logs/organization-context/lineage`,
- admin users can read context storage events through `GET /api/audit-logs/organization-context/storage-events`,
- both endpoints are scoped to the caller organization and protected by existing `verifyToken` + `verifyAdmin`,
- responses expose stable contracts:
  - `organization_context_lineage_audit_read_v1`,
  - `organization_context_storage_audit_read_v1`,
- filters include target/document/project identifiers and bounded limits.

Why:

Operators need a backend read surface before a UI audit panel can be trustworthy. This keeps context governance visible without exposing raw internal rows directly.

### 2.11 Frontend Admin Audit Surface

Changed:

- `src/services/api.ts`
- `src/views/admin/AuditLogView.tsx`

Behavior now:

- tenant admins can see a read-only `Organization Context Audit` section inside the existing admin audit log view,
- the section reads lineage events from `/api/audit-logs/organization-context/lineage`,
- the section reads storage events from `/api/audit-logs/organization-context/storage-events`,
- lineage cards show event type, insight target id, selected document count, used chunk count, and degraded status,
- storage cards show event type, document id, byte delta, source upload, and timestamp,
- loading, empty, refresh, and degraded API failure states are explicit.

Why:

Context governance must be visible where admins already inspect audit activity. This keeps the UI traceable without adding a second audit navigation surface or pretending context audit data loaded when it did not.

### 2.12 Runtime Schema Direction Decision

Changed:

- `docs/product/ORGANIZATION_CONTEXT_ENGINE_SOURCE_OF_TRUTH.md`

Decision:

- Stage 1 Organization Context runtime uses `knowledge_docs` for user-uploaded context document metadata.
- Stage 1 Organization Context runtime uses `knowledge_chunks` for retrievable fragments.
- Chunk compatibility remains explicit for both `doc_id` and `document_id`.
- `knowledge_documents` remains outside the Stage 1 user-upload context runtime and continues to serve specialized/core-docs/governance areas that already depend on it.
- Future convergence must happen through a deliberate adapter, migration, or view rather than by adding another ingestion path.

Why:

The active RAG, AI attachment ingestion, project document counts, Interview Insight document context, and canonical context upload service already depend on `knowledge_docs`. Moving user-uploaded Organization Context to `knowledge_documents` during Stage 1 would create a parallel store and increase tenant safety, lineage, and fake-success risk.

### 2.13 Insight Generation Boundary Guard Test

Changed:

- `tests/unit/backend/services/interviewInsightService.lineage-read.test.ts`

Behavior now covered:

- `InterviewInsightService.create()` receives mixed selected document ids,
- the service queries `knowledge_docs` with `organization_id = ?`,
- user-scoped documents require `(scope = 'user' AND owner_id = ?)`,
- inaccessible selected ids remain in `requestedIds` for traceability,
- inaccessible selected ids are not copied into `selectedIds`,
- generation context and lineage both record the degraded reason `some_documents_not_accessible`.

Why:

The AI generation boundary is where selected context ids become model context. A unit-level service test now proves that a cross-tenant or non-owned id cannot become selected AI context even if the frontend submits it.

### 2.14 Frontend Context Quota Visibility

Changed:

- `src/utils/organizationContextQuotaCopy.ts`
- `src/views/admin/UsageDashboardView.tsx`

Behavior now:

- the admin usage dashboard includes an `Organization Context Storage` card next to existing storage/billing metrics,
- the card explains that document library, Interview Insight Creator, chat, reports, and future AI workflows consume context storage,
- quota copy distinguishes healthy, high usage, critical usage, and blocked states,
- the blocked copy explicitly says new context documents are saved as `quota_blocked` metadata only and are not processed, indexed, or available to AI,
- storage percentage, used amount, plan limit, and progress color reuse the existing usage dashboard behavior.

Why:

Hard quota gates are not enough by themselves. Admins need honest pre-block and blocked-state copy in the existing usage surface, so quota behavior is understandable before users hit an upload failure.

### 2.15 V8 Context Document Route Matrix

Changed:

- `tests/integration/routes/v8Interview.contextDocuments.test.ts`

Behavior now covered:

- V8 context document listing calls the tenant/user-scoped service contract,
- V8 context document upload passes through backend ingestion with `sourceUpload = 'interview.insight_creator'`,
- V8 context upload quota failures return `429` with `quota_blocked` document metadata and `interview_insight_mutation_v1` meta.

Why:

Interview Insight Creator uses the V8 API first. Stage 1 needs route-level proof that the V8 boundary uses backend ingestion and preserves honest quota failure semantics.

### 2.16 Deleted/Recalled Document Fail-Closed Guard

Changed:

- `server/src/services/organizationContext/ContextDocumentService.ts`
- `tests/integration/routes/documentsRoutes.no-stubs.test.ts`

Behavior now:

- `listAccessibleDocuments` still filters `deleted_at IS NULL` in SQL,
- after DB retrieval, rows with `deleted_at` or `deletedAt` are filtered out again before normalization,
- `getDocumentForAccess` returns `null` if a row comes back with `deleted_at` or `deletedAt`,
- route coverage now seeds a deleted document and verifies it is not visible in `/api/documents/all`.

Why:

The mock/SQLite harness revealed that adapter drift can still return a deleted row even when production SQL contains the right predicate. Deleted or revoked context must fail closed before UI listing or AI selection, so the service now guards both at query and post-query projection.

### 2.17 Quota Management Surface Decision

Decision:

- Stage 1 includes quota visibility and honest blocked-state copy.
- Stage 1 does not add editable tenant/project quota management controls.
- Editable quota changes remain a billing/admin ownership decision for the next stage because they affect plans, entitlements, sales operations, and possibly SuperAdmin-only governance.

Why:

Changing quota limits is a business operation, not just a UI control. Adding write controls before ownership and policy are explicit could create inconsistent entitlements or hidden billing behavior. Stage 1 keeps users informed and upload gates enforced, while leaving quota mutation surfaces for a dedicated billing/admin design pass.

---

## 3. Tests Added / Updated

### 3.1 RAG Access Test

File:

- `tests/unit/backend/services/ragService.document-access.test.ts`

Covers:

- explicit `documentIds` without organization scope fail closed,
- explicit `documentIds` include organization/status/deletion filters in generated SQL.

### 3.2 Document Project ACL Test

File:

- `tests/integration/routes/documentsRoutes.no-stubs.test.ts`

Covers:

- project-scope upload by non-member returns `403 PROJECT_CONTEXT_ACCESS_DENIED`,
- existing document route no-stub behavior still returns real responses instead of fake `503` fallbacks.

### 3.3 Chunk Compatibility And Status Projection Tests

Files:

- `tests/unit/backend/services/ragService.document-access.test.ts`
- `tests/unit/backend/services/contextDocumentService.status.test.ts`

Covers:

- RAG generates a compatible join when both `knowledge_chunks.doc_id` and `knowledge_chunks.document_id` exist,
- legacy document statuses are projected to canonical context document statuses,
- unknown statuses fail closed to `failed`.

### 3.4 Storage Accounting And Lineage Tests

Files:

- `tests/unit/backend/services/contextDocumentService.storage-usage.test.ts`
- `tests/unit/backend/services/interviewInsightService.lineage.test.ts`

Covers:

- context upload storage accounting writes an append-only context storage event,
- context upload storage accounting forwards usage to the existing usage service,
- project-scoped uploads forward project storage usage,
- interview insight lineage payload carries selected documents, used chunks, versions, degradation reasons, and bounded excerpts.

### 3.5 Hard Quota And Lineage Read Tests

Files:

- `tests/unit/backend/services/contextDocumentService.storage-usage.test.ts`
- `tests/unit/backend/services/interviewInsightService.lineage-read.test.ts`

Covers:

- context upload is blocked with `quota_blocked` metadata when org storage quota cannot fit the file,
- blocked upload returns a quota error shape with document metadata,
- lineage read model filters by organization and insight target,
- lineage read model safely parses selected documents, used chunks, degraded reasons, and metadata.

### 3.6 Route-Level Integration Matrix Expansion

File:

- `tests/integration/routes/documentsRoutes.no-stubs.test.ts`

Covers:

- route-level `quota_blocked` response returns `429` with blocked document metadata,
- route-level document listing does not return documents from another organization,
- route-level document listing preserves honest degraded states such as `ocr_required`,
- existing project ACL route coverage remains active.

Note:

The current mock DB harness does not reliably enforce `deleted_at IS NULL`, so deleted/revoked coverage remains a real-DB integration gap. The production SQL includes the filter, but the release gate still needs a Postgres-backed test for that path.

### 3.7 Admin Audit Surface Tests

File:

- `tests/integration/routes/auditLog.organizationContext.test.ts`

Covers:

- admin read of organization context lineage events,
- admin read of organization context storage events,
- stable response contract IDs,
- tenant-scoped query parameters.

### 3.8 Frontend Admin Context Audit Tests

File:

- `tests/unit/views/admin/AuditLogView.honesty.test.tsx`

Covers:

- the admin audit view calls the organization context lineage and storage audit APIs,
- lineage and storage events are rendered in the existing admin audit surface,
- context audit API failure renders a degraded state instead of an empty success state.

### 3.9 Insight Boundary Cross-Tenant Test

File:

- `tests/unit/backend/services/interviewInsightService.lineage-read.test.ts`

Covers:

- cross-tenant/non-owned selected context document ids do not pass into selected context,
- `knowledge_docs` lookup includes organization and owner guards,
- `generation_context_json` and lineage preserve requested-vs-selected distinction.

### 3.10 Frontend Context Quota UI Tests

File:

- `tests/unit/views/admin/UsageDashboardView.honesty.test.tsx`

Covers:

- failed usage loads do not render fake zero metrics,
- high context storage usage renders critical copy in the admin usage dashboard,
- quota exhaustion copy states that `quota_blocked` documents are not processed, indexed, or available to AI.

### 3.11 V8 Context Document Route Tests

File:

- `tests/integration/routes/v8Interview.contextDocuments.test.ts`

Covers:

- V8 context document list contract,
- V8 context document backend upload contract,
- V8 context document quota-blocked upload contract.

### 3.12 Deleted/Recalled Document Route Test

File:

- `tests/integration/routes/documentsRoutes.no-stubs.test.ts`

Covers:

- a document with `deleted_at` is not returned by `/api/documents/all`,
- organization filtering and honest degraded status coverage remain active in the same route matrix.

---

## 4. Verification

Commands run:

```bash
npx vitest run "tests/unit/backend/services/ragService.document-access.test.ts" --maxWorkers=1 --maxConcurrency=1
```

Result:

`PASS`

```bash
npx vitest run "tests/unit/backend/services/ragService.document-access.test.ts" "tests/unit/backend/services/contextDocumentService.status.test.ts" --maxWorkers=1 --maxConcurrency=1
```

Result:

`PASS`

```bash
npx eslint "server/src/services/ragService.ts" "server/src/services/organizationContext/ContextDocumentService.ts"
```

Result:

`PASS_WITH_P2`

Note: targeted lint has no errors. It still reports existing `@typescript-eslint/no-explicit-any` warnings in these services.

```bash
npx vitest run "tests/unit/backend/services/contextDocumentService.storage-usage.test.ts" "tests/unit/backend/services/interviewInsightService.lineage.test.ts" "tests/unit/backend/services/contextDocumentService.status.test.ts" "tests/unit/backend/services/ragService.document-access.test.ts" --maxWorkers=1 --maxConcurrency=1
```

Result:

`PASS`

```bash
npx eslint "server/src/services/organizationContext/ContextDocumentService.ts" "server/src/services/InterviewInsightService.ts" "server/src/services/ragService.ts"
```

Result:

`PASS_WITH_P2`

Note: targeted lint has no errors. It still reports existing `@typescript-eslint/no-explicit-any` warnings in these services.

```bash
npx vitest run "tests/unit/backend/services/contextDocumentService.storage-usage.test.ts" "tests/unit/backend/services/interviewInsightService.lineage.test.ts" "tests/unit/backend/services/interviewInsightService.lineage-read.test.ts" "tests/unit/backend/services/contextDocumentService.status.test.ts" "tests/unit/backend/services/ragService.document-access.test.ts" --maxWorkers=1 --maxConcurrency=1
```

Result:

`PASS`

```bash
npx eslint "server/src/services/organizationContext/ContextDocumentService.ts" "server/src/services/InterviewInsightService.ts" "server/src/routes/documents.routes.ts" "server/src/routes/v8/interview.routes.ts"
```

Result:

`PASS_WITH_P2`

Note: targeted lint has no errors. It still reports existing warnings, mostly `@typescript-eslint/no-explicit-any`; `documents.routes.ts` also has a pre-existing unused `apiAuthRateLimiter` warning.

```bash
npx vitest run "tests/integration/routes/documentsRoutes.no-stubs.test.ts" --maxWorkers=1 --maxConcurrency=1 --no-file-parallelism
```

Result:

`PASS`

```bash
npx vitest run "tests/unit/backend/services/contextDocumentService.storage-usage.test.ts" "tests/unit/backend/services/interviewInsightService.lineage-read.test.ts" "tests/unit/backend/services/interviewInsightService.lineage.test.ts" --maxWorkers=1 --maxConcurrency=1
```

Result:

`PASS`

```bash
npx vitest run "tests/integration/routes/auditLog.organizationContext.test.ts" "tests/integration/routes/documentsRoutes.no-stubs.test.ts" --maxWorkers=1 --maxConcurrency=1 --no-file-parallelism
```

Result:

`PASS`

```bash
npx eslint "server/src/routes/auditLog.routes.ts"
```

Result:

`PASS_WITH_P2`

Note: targeted lint has no errors. It still reports existing `@typescript-eslint/no-explicit-any` warnings in this route.

```bash
npx vitest run "tests/unit/views/admin/AuditLogView.honesty.test.tsx" --maxWorkers=1 --maxConcurrency=1
```

Result:

`PASS`

```bash
npx eslint "src/views/admin/AuditLogView.tsx"
```

Result:

`PASS`

```bash
npx vitest run "tests/unit/backend/services/interviewInsightService.lineage-read.test.ts" "tests/unit/backend/services/interviewInsightService.lineage.test.ts" --maxWorkers=1 --maxConcurrency=1
```

Result:

`PASS`

```bash
npx eslint "server/src/services/InterviewInsightService.ts" "src/views/admin/AuditLogView.tsx"
```

Result:

`PASS_WITH_P2`

Note: targeted lint has no errors. It still reports existing `@typescript-eslint/no-explicit-any` warnings in `InterviewInsightService.ts`.

```bash
npx vitest run "tests/unit/views/admin/UsageDashboardView.honesty.test.tsx" --maxWorkers=1 --maxConcurrency=1
```

Result:

`PASS`

Note: jsdom/Recharts emits expected zero-size chart warnings in this isolated component test.

```bash
npx eslint "src/views/admin/UsageDashboardView.tsx" "src/utils/organizationContextQuotaCopy.ts"
```

Result:

`PASS_WITH_P2`

Note: targeted lint has no errors. It still reports existing warnings in `UsageDashboardView.tsx` for hook dependencies, console use, unused caught error, and `any` types.

```bash
npx vitest run "tests/integration/routes/v8Interview.contextDocuments.test.ts" --maxWorkers=1 --maxConcurrency=1 --no-file-parallelism
```

Result:

`PASS`

```bash
npx vitest run "tests/integration/routes/documentsRoutes.no-stubs.test.ts" --maxWorkers=1 --maxConcurrency=1 --no-file-parallelism
```

Result:

`PASS`

```bash
npx eslint "server/src/services/organizationContext/ContextDocumentService.ts"
```

Result:

`PASS_WITH_P2`

Note: targeted lint has no errors. It still reports existing `@typescript-eslint/no-explicit-any` warnings in `ContextDocumentService.ts`.

Note:

A broader eslint run over `server/src/routes/ai.routes.ts` still reports pre-existing formatting/lint issues unrelated to this Stage 1 change. The codebase should not treat that file-level lint result as proof that this hardening is invalid, but Stage 1 should include a later cleanup or targeted lint strategy before release gate.

---

## 5. Gate 1 Status

Current Gate 1 status:

`PASS_WITH_P2`

What improved:

- the highest-risk explicit document id retrieval path is now tenant scoped,
- direct chat fallback is tenant scoped,
- project uploads are access checked,
- targeted tests prove the new controls.
- schema compatibility now covers both chunk document id columns,
- canonical status projection prevents legacy status drift from leaking into UI/AI decisions.
- context uploads now leave storage accounting events,
- interview insight document usage now leaves a baseline append-only lineage ledger.
- quota-blocked uploads now return explicit `429` and persist blocked metadata,
- insight context lineage can now be read through V8.
- route-level tests now cover quota-blocked upload, cross-org filtering, honest degraded statuses, and project upload ACL.
- admin/audit backend endpoints can now read context lineage and storage event trails.
- the existing admin audit UI now exposes context lineage and storage audit trails with honest degraded states.
- the Stage 1 runtime schema direction is documented: `knowledge_docs + knowledge_chunks` is canonical for user-uploaded Organization Context.
- selected context document ids are now tested at the insight generation boundary for organization/owner filtering.
- admins can now see Organization Context storage quota posture and honest blocked-state copy in the usage dashboard.
- V8 context document list/upload/quota-blocked routes now have route-level coverage.
- deleted/revoked context documents are now filtered fail-closed after DB retrieval as well as in SQL.
- editable quota management is explicitly deferred until billing/admin ownership is defined.

Why not full `PASS`:

- physical convergence of `knowledge_docs` and `knowledge_documents` remains future work, but Stage 1 runtime direction is now explicit,
- not all module-specific upload paths have been wrapped by the canonical engine,
- Postgres-backed execution for deleted/revoked and V8 upload remains an environment gate because current local tests default to mock/SQLite harnesses.

---

## 6. Remaining Stage 1 Work

Must complete before Stage 2:

1. Decide whether editable plan/project quota management belongs in tenant admin, SuperAdmin, billing operations, or external sales ops.
2. Add true Postgres-backed tests when the test environment provides a stable DB:
   - deleted/revoked docs with Postgres-backed execution,
   - V8 context document upload route with real DB.

Recommended next milestone:

`Stage 2A - Async processing pipeline and modality extraction depth`
