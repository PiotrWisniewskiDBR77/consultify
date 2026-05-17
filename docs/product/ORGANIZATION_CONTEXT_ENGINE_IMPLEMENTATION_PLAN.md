# Organization Context Engine Implementation Plan

> Status: Implementation Plan v1  
> Owner: Product + Engineering + Security  
> Canonical source: `docs/product/ORGANIZATION_CONTEXT_ENGINE_SOURCE_OF_TRUTH.md`  
> Global standard: `../UI_UX_SOURCE_OF_TRUTH.md` from DRD root  
> Stage 0 audit: `docs/product/ORGANIZATION_CONTEXT_ENGINE_STAGE_0_BASELINE_AUDIT.md`  
> Stage 1 hardening: `docs/product/ORGANIZATION_CONTEXT_ENGINE_STAGE_1_SECURITY_HARDENING.md`  
> Goal: deliver a secure, useful, high-performance organization context engine in controlled stages

---

## 1. Execution Principle

This implementation must optimize for trust before breadth.

The system is strategically important because it becomes the organization's AI memory layer. A broken or unsafe version is worse than no version. The rollout must therefore move through gates:

`foundation -> safe document understanding -> governed AI usage -> multimodal expansion -> scale/cost hardening -> organization-wide rollout`

Each stage must produce working value, but no stage may bypass:

- tenant and ACL enforcement,
- honest degraded UI,
- backend-based ingestion,
- lineage for AI usage,
- storage/cost visibility,
- rollback and observability.

---

## 2. Program Success Definition

The program is successful when:

- users can upload organization/project/user materials from multiple places,
- every material goes through one shared backend ingestion pipeline,
- supported formats become normalized knowledge packages,
- AI uses retrieved chunks/fragments, never raw files,
- every generated output records source lineage,
- degraded or failed understanding is visible and actionable,
- tenant/project/user access is enforced at retrieval and generation,
- large tenants can scale without unacceptable latency or runaway cost,
- admins can understand and manage storage, processing usage, and policy blocks.

---

## 3. Stage 0 - Baseline Audit And Stabilization

### Context

Before adding more capability, the team must know exactly what exists: `knowledge_docs`, `knowledge_chunks`, document library UI, AI attachment ingestion, Interview Insight Creator, chat uploads, reports, canvas, and any module-specific file handling.

This stage prevents parallel systems from growing.

### Scope

- Inventory all upload/file ingestion paths.
- Inventory all tables and services related to documents, chunks, embeddings, attachments, context, and AI generation.
- Identify all browser-only file reads and local metadata-only attachments.
- Identify existing ACL checks and gaps.
- Identify current processing statuses and fake-success states.
- Freeze the target vocabulary and lifecycle from the source-of-truth document.

### Proposed Technology

- Static repo audit using code search.
- DB schema inventory scripts.
- API route inventory.
- Manual UI walk-through for upload and context surfaces.
- Lightweight architecture decision record for canonical store direction.

### Deliverables

- `Context ingestion inventory`.
- `Existing data model map`.
- `Current risk register`.
- Confirmed canonical tables to evolve from: likely `knowledge_docs` / `knowledge_chunks` in the short term.
- List of deprecated module-specific ingestion paths.

### Definition Of Done

- All known upload entry points are listed.
- All known AI context consumers are listed.
- There is one agreed canonical lifecycle/status vocabulary.
- P0/P1 security gaps are documented.
- No implementation begins without knowing whether it extends or replaces existing tables.

### Gate 0 - Architecture Readiness

PASS only if:

- no unknown primary document store remains,
- all candidate ingestion paths are mapped,
- security risks are classified,
- CTO/Product confirms canonical direction.

Failing this gate blocks Stage 1.

---

## 4. Stage 1 - Secure Context Asset Foundation

### Context

This is the backbone. It does not need to understand every file yet. It must safely accept, store, track, scope, and process assets through one common pipeline.

### Scope

- Introduce canonical `ContextAsset` contract.
- Add/extend data model for assets, processing jobs, normalized documents, chunks, lineage, quotas.
- Implement backend upload endpoint(s) for context assets.
- Store owner, organization, project, scope, source upload, hash, version, file size, mime type, status.
- Add processing job records with retries and idempotency.
- Keep raw file storage behind controlled backend access.
- Add basic quota counters even if enforcement is initially permissive.

### Proposed Technology

- Node/Express service layer:
  - `ContextAssetService`
  - `ContextProcessingJobService`
  - `ContextAccessPolicyService`
  - `ContextQuotaService`
- Existing DB layer and migrations.
- Object/file storage abstraction:
  - local dev storage,
  - production object storage ready adapter.
- Multer or streaming upload middleware with strict file size/type checks.
- Content hash using SHA-256.

### Deliverables

- Canonical upload API.
- Asset metadata persistence.
- Processing job table/service.
- Versioned asset records.
- Initial quota usage table.
- Safe download/read endpoint.
- Migration from existing document library route to the shared service.

### Definition Of Done

- Upload never stores only frontend state.
- Every upload creates a backend asset record and processing job.
- Every asset has tenant/org/user/scope metadata.
- Every asset has a status visible through API.
- File size/type validation exists.
- Upload response is fast and does not block on heavy processing.
- Existing document library can list assets from the canonical service.

### Gate 1 - Secure Upload Gate

PASS only if tests prove:

- user cannot list another tenant's assets,
- project/user scopes are enforced,
- unauthorized download fails,
- upload status is honest,
- failed processing does not produce fake `ready`,
- quota counters increment.

No AI workflow may rely on this foundation until this gate passes.

---

## 5. Stage 2 - Document Understanding MVP

Stage record:

- Stage 2A baseline: `docs/product/ORGANIZATION_CONTEXT_ENGINE_STAGE_2_DOCUMENT_UNDERSTANDING.md`

### Context

This stage delivers immediate user value for business documents while staying honest about unsupported or partial extraction.

Target formats:

- PDF,
- DOCX,
- XLSX,
- PPTX,
- TXT/MD/CSV/JSON.

Legacy DOC/XLS/PPT can be marked degraded unless safe conversion is implemented.

### Scope

- Implement extractor interface:
  - `extract(asset): ExtractedContent`
- Implement parsers:
  - PDF text extraction,
  - DOCX extraction,
  - XLSX workbook/sheet/table extraction,
  - PPTX slide text/notes extraction if library supports it,
  - plain text/Markdown/CSV/JSON extraction.
- Add `ocr_required`, `unreadable`, `partial_ready`, `failed` handling.
- Create `normalized_md` and `normalized_json`.
- Chunk normalized content with stable source locators.
- Write to existing/evolved `knowledge_chunks`.
- Generate embeddings where provider/config is available.

### Proposed Technology

- PDF: `pdf-parse`.
- DOCX: `mammoth`.
- XLSX/XLS: `xlsx` for workbook parsing.
- PPTX: evaluate safe parser options:
  - first preference: existing library if available and stable,
  - fallback: XML extraction from PPTX package,
  - legacy PPT: degraded unless conversion worker exists.
- Text: Node buffer/string processing with encoding detection if needed.
- Chunking:
  - semantic-ish Markdown section chunking,
  - fallback fixed token/character windows,
  - source locator metadata.
- Embeddings:
  - current embedding provider via existing RAG service,
  - async and retryable.

### Deliverables

- `DocumentExtractionService`.
- `KnowledgeNormalizationService`.
- `KnowledgeChunkingService`.
- MVP processors for the target document formats.
- Status and quality report per asset.
- Document library UI shows ready/degraded states.

### Definition Of Done

- PDF text documents become searchable chunks.
- Empty/scanned PDFs are not shown as ready unless OCR exists.
- DOCX text and tables are captured.
- XLSX sheets produce structured, citable chunks.
- PPTX produces slide-based chunks or honest degraded state.
- TXT/MD/CSV/JSON are ingested as text/structured text.
- Every chunk links back to asset/version/source locator.
- Processing errors are safe for users and useful for developers.

### Gate 2 - Document Understanding Gate

PASS only if:

- unit tests cover each supported format,
- integration tests cover upload -> processing -> chunks -> status,
- UI shows degraded states for unreadable formats,
- no raw parser error leaks to business users,
- no metadata-only file can be selected as AI-ready,
- performance test proves large document processing is asynchronous.

---

## 6. Stage 3 - Governed Retrieval And AI Workflow Integration

### Context

Once documents are understood, AI workflows can use them. The critical rule: AI must only receive permission-filtered, workflow-selected chunks.

First target workflow:

- Interview Insight Creator.

Then:

- AI Chat,
- reports,
- notes,
- initiatives,
- canvas/work artifacts.

### Scope

- Build shared `ContextRetrievalService`.
- Add context mode contract to AI workflows.
- Add shared context selector UI.
- Connect Interview Insight Creator to selected assets.
- Add retrieval trace and lineage write.
- Add generated output source read-back.
- Prevent non-ready documents from being selected unless workflow supports `partial_ready`.

### Proposed Technology

- Hybrid retrieval:
  - metadata filter,
  - lexical search,
  - vector search,
  - optional reranking later.
- Existing `ragService` can be evolved behind `ContextRetrievalService`.
- UI shared component:
  - `ContextAssetSelector`,
  - status badges,
  - unavailable reasons,
  - selected context summary.
- Lineage:
  - write into `generation_context_json` short term,
  - dedicated `knowledge_lineage_events` long term.

### Deliverables

- Shared retrieval API.
- Shared selector component.
- Interview Insight Creator uses selected context chunks.
- Generation context stores lineage.
- Insight view can show used sources/degraded warnings.

### Definition Of Done

- AI prompt receives chunks, not raw files.
- Selected documents are enforced backend-side.
- Tenant/project/user ACL is checked before retrieval.
- Lineage records asset id, version, chunk ids, statuses.
- UI shows which documents were selected and which were excluded.
- Existing approved/completed interview flow remains unchanged when no context is selected.

### Gate 3 - AI Trust Gate

PASS only if tests prove:

- unauthorized selected ids are ignored/rejected,
- another tenant's chunk cannot reach prompt,
- non-ready documents do not enter retrieval,
- generated insight stores lineage,
- generated insight can be reproduced/explained from source refs,
- no existing insight generation regression.

This gate is mandatory before expanding to other AI workflows.

---

## 7. Stage 4 - Image Understanding

### Context

Images are a major context source: screenshots, whiteboards, photos, scans, diagrams, org charts, charts, and forms.

The goal is not just OCR. The goal is visual understanding with safe uncertainty.

### Scope

- Add image asset support.
- OCR visible text.
- Generate visual summary.
- Detect likely chart/table/diagram/screenshot/form.
- Store image observations with confidence.
- Chunk OCR and visual summaries.
- Add image source locator where possible.

### Proposed Technology

- OCR:
  - cloud OCR or local OCR depending deployment constraints,
  - adapter-based interface to avoid provider lock.
- Vision model:
  - multimodal model for image summary and chart/diagram interpretation,
  - strict prompt wrapper: "describe evidence, do not infer beyond visible content".
- Image preprocessing:
  - resize,
  - orientation correction,
  - safe format conversion.

### Deliverables

- `ImageUnderstandingService`.
- Image OCR + visual summary normalized package.
- `partial_ready` support for image with summary but low OCR.
- UI status and preview of extracted understanding.

### Definition Of Done

- Uploaded image becomes searchable by OCR/summary.
- Screenshot text can be retrieved.
- Whiteboard/photo can produce cautious summary.
- Low confidence is visible.
- Large images do not block upload.
- Image-derived chunks have modality and source locators.

### Gate 4 - Visual Safety Gate

PASS only if:

- image content is tenant-scoped,
- low-confidence observations are marked,
- model does not present guesses as facts,
- prompt injection in screenshots is treated as untrusted content,
- image processing cost is counted,
- UI distinguishes OCR text from visual interpretation.

---

## 8. Stage 5 - Audio Understanding

### Context

Audio unlocks meeting recordings, interviews, and voice notes. It is high value and high cost. It must be asynchronous, quota-controlled, and timestamp-citable.

### Scope

- Add audio upload support.
- Transcribe speech.
- Preserve timestamps.
- Optional diarization where available.
- Normalize transcript to Markdown and structured segments.
- Chunk by timestamp windows.
- Add audio minutes quota and processing cost.

### Proposed Technology

- ASR provider adapter:
  - cloud transcription first,
  - local/enterprise option later if needed.
- Optional diarization provider.
- Queue workers for long-running jobs.
- Segment-level chunking.
- Timestamp source locators.

### Deliverables

- `AudioUnderstandingService`.
- Audio processing job pipeline.
- Transcript normalized package.
- Timestamp-citable chunks.
- Storage/cost usage tracking.

### Definition Of Done

- Audio uploads are accepted and processed async.
- User sees transcription status.
- Transcript chunks are retrievable.
- AI output lineage can cite time ranges.
- Audio minute quota exists.
- Failed transcription is honest and safe.

### Gate 5 - Audio Cost And Trust Gate

PASS only if:

- long files do not block request threads,
- quota blocks are enforced,
- failed ASR does not become fake success,
- transcript access follows ACL,
- lineage includes timestamps,
- cost metrics are visible to admins/ops.

---

## 9. Stage 6 - Quotas, Admin Governance, And Retention

### Context

At organization scale, context becomes a cost and governance surface. Users need safety; admins need controls.

### Scope

- Enforce storage quotas.
- Enforce processing quotas for OCR/audio/video.
- Add admin usage dashboard.
- Add retention policies.
- Add archive/delete/reprocess controls.
- Add policy block visibility.
- Add audit exports.

### Proposed Technology

- `ContextQuotaService`.
- Usage event table.
- Aggregated usage rollups.
- Admin APIs and UI.
- Scheduled jobs for rollups and retention.
- Policy engine hooks for DLP/restricted assets.

### Deliverables

- Tenant/project/user quota model.
- Usage dashboard.
- Quota warning states.
- `quota_blocked` status.
- Retention policy controls.
- Admin audit view.

### Definition Of Done

- Upload/process can be blocked by quota.
- User receives clear reason and next action.
- Admin can see usage by modality and scope.
- Deletion/archive behavior is defined.
- Historical lineage remains explainable after deletion according to policy.

### Gate 6 - Governance Gate

PASS only if:

- quota enforcement tests pass,
- retention tests pass,
- admin usage numbers reconcile with asset records,
- blocked states are honest in UI,
- policy and quota blocks cannot be bypassed by module-specific endpoints.

---

## 10. Stage 7 - Performance Hardening And Scale

### Context

The engine becomes strategic only if it works under real organization load. This stage makes it fast, observable, and scalable.

### Scope

- Add performance indexes.
- Optimize chunk retrieval.
- Add tenant-safe caching.
- Add hierarchical retrieval for large corpora.
- Add queue concurrency controls.
- Add processing backpressure.
- Add load tests and latency SLOs.

### Proposed Technology

- DB indexes on:
  - `organization_id`,
  - `project_id`,
  - `asset_id`,
  - `status`,
  - `scope`,
  - vector index where supported.
- Queue metrics and worker scaling.
- Cache:
  - scoped by tenant/org/workflow/query hash,
  - no raw unauthorized content.
- Retrieval pipeline:
  - metadata candidate set,
  - lexical/vector hybrid,
  - reranking,
  - prompt pack compression.

### Deliverables

- Retrieval latency SLOs.
- Processing throughput SLOs.
- Load test suite.
- Observability dashboard.
- Backpressure and dead-letter handling.
- Safe cache layer.

### Definition Of Done

- Retrieval remains interactive at target corpus sizes.
- Upload remains fast under load.
- Workers recover from failures.
- Dead-letter jobs are visible.
- Cache cannot leak across tenants.
- Large documents do not blow prompt budget.

### Gate 7 - Scale Gate

PASS only if:

- load tests meet agreed SLOs,
- no tenant cache leakage is possible in tests/review,
- worker retry/dead-letter flow is tested,
- retrieval result quality remains acceptable,
- ops dashboard shows latency, failures, and cost.

---

## 11. Stage 8 - Cross-Application Rollout

### Context

After the engine is safe and scalable, every module should stop building local context logic and use the shared engine.

### Scope

Roll out context engine to:

- AI Chat,
- reports,
- notes,
- initiatives,
- canvas/work artifacts,
- admin/superadmin knowledge governance,
- partner/client shared surfaces where appropriate.

### Proposed Technology

- Shared SDK/client:
  - `ContextAssetsApi`,
  - `ContextRetrievalApi`,
  - `ContextLineageApi`.
- Shared UI:
  - context selector,
  - source read-back,
  - degraded context banner,
  - quota banner.
- Module adapters:
  - thin wrappers around canonical APIs.

### Deliverables

- Module migration checklist.
- Shared frontend API client.
- Shared context UI kit.
- Deprecation of local ingestion paths.
- Context source read-back in generated outputs.

### Definition Of Done

- No module has private ingestion logic.
- Every AI module has explicit context mode.
- Every AI output using context has lineage.
- Every module shows degraded/blocked states consistently.
- Module-specific tests prove shared engine usage.

### Gate 8 - Product Consistency Gate

PASS only if:

- code search shows no browser-only heavy file ingestion for AI context,
- module upload UIs delegate to canonical backend,
- context selector behavior is consistent,
- source read-back is consistent,
- old endpoints are removed or wrapped safely.

---

## 12. Testing Strategy

### Unit Tests

Required for:

- extractor selection,
- status transitions,
- chunking,
- normalization,
- ACL checks,
- quota calculations,
- lineage payload creation.

### Integration Tests

Required for:

- upload -> job -> extraction -> normalized doc -> chunks,
- retrieval with ACL,
- AI generation with lineage,
- degraded extraction,
- quota blocked upload/processing.

### Security Tests

Required for:

- cross-tenant asset ids,
- cross-project asset ids,
- user-scope private docs,
- deleted/revoked assets,
- prompt injection inside uploaded files,
- signed URL expiry.

### Performance Tests

Required for:

- large PDF,
- large XLSX,
- many small documents,
- concurrent uploads,
- retrieval over large chunk sets,
- long audio job queue.

### UI Tests

Required for:

- ready/degraded/processing states,
- retry/reprocess action,
- context selector selection rules,
- generated output source read-back,
- quota warning/blocking.

---

## 13. Release Strategy

### Release 1 - Safe Documents MVP

Includes stages 0-3 for text/business documents.

Allowed claim:

`The system can safely ingest common business documents and use selected ready chunks in Interview Insight generation with lineage.`

Not allowed claim:

`The system fully understands all organization material.`

### Release 2 - Visual Context

Adds Stage 4.

Allowed claim:

`The system can extract text and cautious visual summaries from images/screenshots/scans.`

### Release 3 - Audio Context

Adds Stage 5.

Allowed claim:

`The system can transcribe and retrieve timestamped audio context under quota.`

### Release 4 - Governance And Scale

Adds stages 6-8.

Allowed claim:

`The system is the shared organization context layer across AI workflows with quotas, lineage, and admin governance.`

---

## 14. Rollback Strategy

Every stage must support rollback:

- new upload endpoints can be feature-flagged,
- processing workers can be paused,
- AI context usage can be disabled per workflow,
- old document listing can remain read-only temporarily,
- lineage write failures must not silently succeed,
- retrieval errors must degrade honestly and not block unrelated non-context workflows.

Rollback must never delete raw user assets unless explicitly requested and audited.

---

## 15. Feature Flags

Recommended flags:

- `context_engine_upload_enabled`
- `context_engine_processing_enabled`
- `context_engine_pdf_enabled`
- `context_engine_office_enabled`
- `context_engine_image_enabled`
- `context_engine_audio_enabled`
- `context_engine_ai_retrieval_enabled`
- `context_engine_lineage_required`
- `context_engine_quota_enforcement_enabled`
- `context_engine_admin_dashboard_enabled`

Flags must be tenant-aware where possible.

---

## 16. Operating Metrics

Program health metrics:

- processing success rate,
- processing failure rate by modality,
- average processing latency,
- p95 retrieval latency,
- retrieval no-result rate,
- number of context-backed AI generations,
- lineage write success rate,
- quota block count,
- policy block count,
- storage growth by tenant,
- cost units by modality.

Minimum launch SLOs should be agreed before Stage 3 reaches production.

---

## 17. Team Workstreams

### Backend Platform

- data model,
- upload service,
- processing jobs,
- extractors,
- retrieval service,
- lineage,
- quotas.

### Frontend Product

- document library states,
- shared context selector,
- source read-back,
- quota/degraded UI,
- module integrations.

### AI/RAG

- chunking,
- embeddings,
- retrieval ranking,
- prompt packaging,
- prompt injection defense,
- answer citation behavior.

### Security/Governance

- ACL model,
- DLP hooks,
- audit events,
- policy blocks,
- signed file access.

### QA/Release

- gates,
- regression packs,
- performance tests,
- security test cases,
- release readiness.

---

## 18. Critical Path

The critical path is:

1. Canonical asset and job model.
2. Secure upload and listing.
3. Document extraction and chunking.
4. Retrieval service with ACL.
5. Interview Insight Creator integration.
6. Lineage read/write.
7. Quotas and governance.
8. Multimodal expansion.

Do not start broad multimodal rollout before the retrieval + lineage + ACL core is proven.

---

## 19. Mandatory Gates Summary

| Gate | Name | Blocks |
| --- | --- | --- |
| Gate 0 | Architecture Readiness | Any implementation |
| Gate 1 | Secure Upload Gate | AI usage of assets |
| Gate 2 | Document Understanding Gate | Document context production use |
| Gate 3 | AI Trust Gate | Expansion beyond Interview Insight |
| Gate 4 | Visual Safety Gate | Image context release |
| Gate 5 | Audio Cost And Trust Gate | Audio context release |
| Gate 6 | Governance Gate | Organization-scale rollout |
| Gate 7 | Scale Gate | Large tenant rollout |
| Gate 8 | Product Consistency Gate | Full cross-app claim |

---

## 20. Final Delivery Standard

The implementation is complete only when the product can truthfully say:

`Users can add the real materials of their organization, and Consultify safely turns them into permission-aware, searchable, citable, cost-managed AI context across the application.`

If the system is fast but unsafe, it fails.

If the system is safe but not useful in AI workflows, it fails.

If the system produces AI answers without lineage, it fails.

If the UI claims understanding where only metadata exists, it fails.

The success condition is the combination:

`secure + useful + fast + auditable + honest`
