# Organization Context Engine Stage 2 Document Understanding

> Status: Stages 0-8 PASS (GA wired) v34
> Date: 2026-05-04
> Owner: Product + Engineering + Security
> Canonical source: `docs/product/ORGANIZATION_CONTEXT_ENGINE_SOURCE_OF_TRUTH.md`
> Implementation plan: `docs/product/ORGANIZATION_CONTEXT_ENGINE_IMPLEMENTATION_PLAN.md`
> Previous gate: `docs/product/ORGANIZATION_CONTEXT_ENGINE_STAGE_1_SECURITY_HARDENING.md`

> v34 update (Phase 0-8 of GA plan completed): PDF page locators, DOCX paragraph/table
> locators, PPTX slide locators (with speaker notes), legacy DOC/PPT moved to
> `policy_blocked` with honest copy. Image OCR pipeline (`tesseract` + `openai_vision`
> opt-in), audio transcription (`openai_whisper`) with timestamp locators, audio minutes
> quota and retention TTL with lineage-preserving purge (soft + hard delete) are wired.
> Shared `ContextRetrievalService` exposes the four Source Of Truth workflow modes
> (`selected_material_only`, `selected_material_plus_selected_context`,
> `selected_material_plus_approved_org_context`, `org_context_research_mode`); AI Chat
> attachment grounding uses the shared service and writes lineage. Frontend has the
> shared `ContextAssetSelector` component. Always-on scheduler tick, external queue
> consumer tick, retention purge tick are registered in `Scheduler.ts`. Worker loop
> entrypoint (`run-organization-context-worker-loop.ts`) and `Procfile.organization-context-worker`
> support a dedicated worker deployment. Tenant-safe `ContextCacheService` uses the
> required `tenant:{org_id}:` key prefix. ESLint `no-restricted-imports` blocks
> frontend ingestion of pdfjs/mammoth/xlsx/tesseract/jszip/pdf-parse. Smoke (38/38),
> cross-app audit (6/6) and unit tests (40/40) pass. Real-traffic Gate 7 SLO
> validation requires running `npm run loadtest:organization-context-engine` against a
> staging instance with seeded org/user/docs and observing p95 below the configured
> budget. Final GO requires staging canary 48h + production canary 24h with no P0/P1
> incidents per the Release Gate runbook.

---

## 1. Scope Of This Iteration

Completed increments:

- `Stage 2A - Processing job ledger baseline`
- `Stage 2B - Normalized package and source-locator chunking baseline`
- `Stage 2C - Inline worker boundary and format-native locator baseline`
- `Stage 2D - Worker entrypoint, retry policy, and dead-letter baseline`
- `Stage 2E - Worker locking, observability API, and explicit admin control baseline`
- `Stage 2F - Stale-lock recovery, queue-adapter contract, and admin UI control surface`
- `Stage 2G - DB queue adapter summary, scheduler tick contract, and richer worker dashboard`
- `Stage 2H - Queue backend configuration and explicit cron entrypoint`
- `Stage 2I - External queue readiness contract and dedicated worker operations component`
- `Stage 2J - Queue adapter capability contract and standalone admin operations surface`
- `Stage 2K - Org-scoped queue summary, lease metrics, and dead-letter posture`
- `Stage 2L - Dead-letter drill-down and explicit requeue flow`
- `Stage 2M - External enqueue adapter and stale-lock review action`
- `Stage 2N - External consumer contract and explicit lease expiry`
- `Stage 2O - Compare-and-swap worker claiming and external pull contract`
- `Stage 2P - External queue pull/process implementation and lease renewal heartbeat`
- `Stage 2Q - External queue acknowledgement/backoff contract and worker run audit read-back`
- `Stage 2R - Worker operations UI read-back for ack/backoff and run audit identifiers`
- `Stage 2S - Worker operations API contract typing and external queue outcome audit events`
- `Stage 2T - External queue outcome admin audit filters and operations drill-down`
- `Stage 2U - Worker scheduler observability and queue outcome refresh actions`
- `Stage 2V - Worker run history timeline and queue outcome attention counters`
- `Stage 2W - Worker operations audit filters and external broker adapter hardening`
- `Stage 2X - External queue adapter contract tests and worker run correlation drill-down`
- `Stage 2Y - Worker run detail filters and production broker deployment readiness`
- `Stage 2Z - Async worker cutover readiness and document locator upgrade plan`
- `Stage 3A - Async worker cutover implementation plan and guarded execution switch`
- `Stage 3B - Async upload status read-back and external worker deployment verification`
- `Stage 3C - External worker health probe and async upload UX refresh loop`
- `Stage 3D - Async upload user-facing document status refresh and stale processing attention states`
- `Stage 3E - User-facing processing recovery guidance and admin handoff from stale document states`
- `Stage 3F - Document processing notification/read-receipt model and recovery audit read-back`
- `Stage 3G - Persisted processing notification acknowledgement and admin recovery outcome timeline`

This is the first step toward the Stage 2 Document Understanding MVP. It does not yet move extraction to a real worker queue. It creates the durable processing job contract that a worker can later consume without changing upload semantics again.

Stage 2A-3G intentionally keep the current inline upload processing behavior as the default so existing document library and Interview Insight Creator flows keep working. Stage 2D adds a callable worker entrypoint, Stage 2E adds admin control/observability, Stage 2F adds stale-lock recovery plus a visible admin UI control, Stage 2G adds queue summary plus a disabled-by-default scheduler tick contract, Stage 2H adds explicit cron wiring, Stage 2I separates queue readiness from worker execution while extracting a dedicated admin worker operations component, Stage 2J adds enqueue/consume capability reporting plus a standalone Admin > Operations surface, Stage 2K makes queue summary org-scoped with lease/dead-letter posture, Stage 2L adds explicit dead-letter requeue, Stage 2M adds a callable external enqueue adapter plus explicit stale-lock recovery, Stage 2N adds explicit lease expiry plus an external consumer tick contract, Stage 2O adds compare-and-swap claim enforcement plus an external pull URL contract, Stage 2P adds lease renewal heartbeat plus a minimal external pull/process implementation that still routes work through the DB ledger and CAS claim, Stage 2Q adds acknowledgement/backoff contracts plus worker run audit read-back, Stage 2R exposes that read-back in the admin worker operations UI, Stage 2S adds a typed frontend API module plus external queue outcome lineage events, Stage 2T adds admin filters plus an Operations drill-down for those outcome events, Stage 2U adds scheduler observability plus a dedicated queue outcome audit refresh action, Stage 2V adds a recent worker run timeline plus queue outcome attention counters, Stage 2W hardens external queue identity checks while adding read-only attention filtering to the Operations audit drill-down, Stage 2X locks the queue adapter payload shape under tests while adding queue correlation detail to worker run history, Stage 2Y adds run-history outcome filters plus production broker deployment readiness, Stage 2Z adds explicit async cutover blockers plus a document locator upgrade plan, Stage 3A introduces a guarded upload execution switch that only enqueues instead of processing inline when explicit cutover flags and readiness checks pass, Stage 3B adds async upload status read-back plus explicit external worker deployment verification, Stage 3C adds opt-in external worker health probing plus a read-only async upload status refresh loop, Stage 3D carries async processing visibility into the user-facing document library with stale-processing attention states, Stage 3E adds recovery guidance plus a safe admin handoff from stale document states, Stage 3F adds read-only attention receipt plus recovery audit read-back, and Stage 3G adds explicit persisted acknowledgement for stale processing notifications.

---

## 2. Implemented

### 2.1 Processing Job Ledger

Changed:

- `server/src/services/organizationContext/ContextDocumentService.ts`

Behavior now:

- context upload ensures `organization_context_processing_jobs`,
- each accepted context upload creates one processing job with:
  - `organization_id`,
  - `user_id`,
  - `document_id`,
  - `project_id`,
  - `scope`,
  - `pipeline_type`,
  - `status`,
  - `attempt_count`,
  - `processor_version`,
  - `source_upload`,
  - safe error fields,
  - metadata JSON,
  - started/finished timestamps,
- job lifecycle is recorded as `queued -> processing -> completed` for ready documents,
- degraded extraction ends the job as `degraded`,
- failed extraction ends the job as `failed`,
- quota-blocked uploads do not create a processing job because the file is not accepted for processing.

Why:

The engine needs asynchronous processing, retries, dead-letter handling, and worker observability. A durable job ledger is the contract for that future queue. Without it, "async processing" would be only an in-memory behavior and not auditable.

### 2.2 Deleted/Recalled Guard Remains Active

Stage 2A preserves the Stage 1J fail-closed guard:

- SQL still filters `deleted_at IS NULL`,
- service projection also filters rows with `deleted_at` or `deletedAt`,
- access lookup returns `null` if a deleted row leaks through the adapter.

Why:

Processing jobs must never re-enable deleted or revoked context.

### 2.3 Normalized Knowledge Package Baseline

Changed:

- `server/src/services/organizationContext/ContextDocumentService.ts`

Behavior now:

- ready and degraded uploads write `knowledge_docs.normalized_md`,
- ready and degraded uploads write `knowledge_docs.normalized_json`,
- normalized JSON uses schema version `organization_context_normalized_v1`,
- ready text normalization stores a Markdown projection headed by the original filename,
- degraded normalization stores a safe Markdown statement that no readable text was extracted,
- normalized JSON includes filename, MIME type, modality, status, safe error, sections, and a quality report.

Why:

The raw extracted string is not enough for organization context. AI workflows need a stable human-readable and machine-readable knowledge package that can later be inspected, reprocessed, summarized, and cited.

### 2.4 Chunk Source Locator Baseline

Changed:

- `server/src/services/organizationContext/ContextDocumentService.ts`

Behavior now:

- chunks are generated from normalized Markdown,
- `knowledge_chunks.metadata` stores schema version `organization_context_chunk_v1`,
- chunk metadata includes document id, asset version, filename, MIME type, modality, chunk index, and source locator,
- current source locator is character-range based: `type = char_range`, `startChar`, `endChar`.

Why:

RAG chunks must be citeable. Character range locators are a baseline that works across text projections while format-specific locators for page, slide, sheet, row range, image region, or timestamp are added later.

### 2.5 Inline Worker Boundary Marker

Changed:

- `server/src/services/organizationContext/ContextDocumentService.ts`

Behavior now:

- processing job metadata records `executionMode = inline_worker_boundary_v1`,
- upload still processes inline,
- job metadata now distinguishes current inline execution from the future queue/worker execution model.

Why:

This gives the processing ledger a migration-safe boundary. Future workers can claim the same job contract without making existing upload events ambiguous.

### 2.6 Format-Native Locator Baseline

Changed:

- `server/src/services/organizationContext/ContextDocumentService.ts`

Behavior now:

- extractors return `sourceBlocks`,
- `normalized_json.sections` stores those source blocks with their source locator,
- TXT/MD/CSV/JSON documents receive `line_range` native locators,
- XLS/XLSX documents receive `sheet_range` native locators with sheet name and row range,
- chunk metadata keeps baseline `sourceLocator = char_range` and adds `nativeSourceLocator` when a matching source block is available.

Why:

AI output needs traceability that users can understand. For text files, "lines 1-4" is more useful than only character offsets. For spreadsheets, "sheet Planning, rows 1-3" is more useful than an opaque text range.

### 2.7 Worker Entrypoint And Retry Baseline

Changed:

- `server/src/services/organizationContext/ContextDocumentService.ts`

Behavior now:

- extraction/chunking/indexing lives behind a shared `processAcceptedContextDocument` boundary,
- upload still calls that boundary inline for backward-compatible behavior,
- `processQueuedContextDocumentJobs({ limit })` can process `queued` and `retry_scheduled` jobs from the ledger,
- worker processing reads the persisted file path from `knowledge_docs.filepath`,
- retryable failures move jobs to `retry_scheduled`,
- final failures move jobs to `dead_letter`,
- dead-lettered documents are marked `failed` with a safe processing error,
- retry policy is `max_attempts_3`.

Why:

This is the first real worker contract. It allows controlled execution from a scheduler, CLI, cron, admin job, or future queue consumer without hiding processing from users or changing current upload semantics.

### 2.8 Worker Locking And Admin Observability

Changed:

- `server/src/services/organizationContext/ContextDocumentService.ts`
- `server/src/routes/auditLog.routes.ts`

Behavior now:

- worker jobs are claimed before processing with status `claimed`,
- processing jobs can store `locked_at` and `locked_by`,
- lock owner is currently `organization-context-worker`,
- admins can read processing jobs through `GET /api/audit-logs/organization-context/processing-jobs`,
- admins can explicitly run one worker batch through `POST /api/audit-logs/organization-context/processing-jobs/run-worker`,
- worker run requires `confirmation = run_context_worker_once`,
- confirmed worker runs write an `audit_log` event with action `organization_context.worker_run_requested`.

Why:

This preserves the no-silent-execution rule for operational mutations. The engine now exposes worker state and an explicit admin trigger while still avoiding an uncontrolled background daemon.

### 2.9 Stale-Lock Recovery And Admin UI Control

Changed:

- `server/src/services/organizationContext/ContextDocumentService.ts`
- `server/src/routes/auditLog.routes.ts`
- `src/services/api.ts`
- `src/views/admin/AuditLogView.tsx`

Behavior now:

- worker entrypoint can recover stale `claimed` jobs back to `retry_scheduled`,
- recovery is part of the explicit worker run path and is not a silent daemon,
- worker run result includes `recoveredLocks`,
- frontend API exposes processing job read and one-time worker run methods,
- admin Audit Log view shows `Processing Jobs` next to lineage and storage events,
- admin Audit Log view exposes `Run worker once`,
- the UI requires browser confirmation before calling the worker endpoint,
- successful worker run shows honest processed/retried/dead-lettered counts and refreshes read-back state.

Why:

The engine now has an operational recovery path for interrupted workers and a visible control surface for admins. This keeps processing auditable and recoverable while preserving the no-silent-execution invariant.

### 2.10 Queue Adapter Summary And Scheduler Tick Contract

Changed:

- `server/src/services/organizationContext/ContextDocumentService.ts`
- `server/src/routes/auditLog.routes.ts`
- `src/services/api.ts`
- `src/views/admin/AuditLogView.tsx`

Behavior now:

- `getContextProcessingQueueSummary()` exposes the queue adapter read model,
- current adapter is `db_ledger_v1`,
- queue summary includes status counts, pending count, blocked count, and generation time,
- `GET /api/audit-logs/organization-context/processing-jobs/summary` returns the admin read model,
- `processScheduledContextDocumentWorkerTick({ enabled })` is the scheduler contract,
- scheduler tick returns `scheduler_disabled` without processing unless explicitly enabled by its caller,
- admin Audit Log view shows adapter, pending jobs, jobs needing attention, and last worker run result.

Why:

This separates queue observability from manual job lists and gives future cron/worker infrastructure a narrow contract. The scheduled tick is intentionally inert unless enabled by explicit caller configuration, preserving the no-hidden-background-work invariant.

### 2.11 Queue Backend Configuration And Cron Entrypoint

Changed:

- `server/src/services/organizationContext/ContextDocumentService.ts`
- `server/scripts/run-organization-context-worker-once.ts`
- `package.json`
- `src/views/admin/AuditLogView.tsx`

Behavior now:

- queue summary reports `configuredBackend`,
- supported configured backend values are:
  - `db_ledger_v1`,
  - `external_queue_unconfigured`,
- `ORG_CONTEXT_QUEUE_BACKEND=external` does not process jobs silently; it returns `external_queue_backend_unconfigured`,
- `ORG_CONTEXT_WORKER_SCHEDULER_ENABLED=true` is required for configured scheduler work,
- `processConfiguredContextDocumentWorkerTick()` reads queue backend and scheduler env,
- `npm run worker:organization-context:once` runs `server/scripts/run-organization-context-worker-once.ts`,
- the script prints `organization_context_worker_cron_tick_v1`,
- without scheduler env enabled, the script reports `scheduler_disabled`,
- admin UI shows configured backend and scheduler enabled/disabled state.

Why:

This gives deployment/cron a concrete entrypoint while keeping production-safe defaults. Cron can be wired explicitly by operations, but the default behavior remains no-op and auditable rather than hidden background processing.

### 2.12 External Queue Readiness And Dedicated Worker Operations Component

Changed:

- `server/src/services/organizationContext/ContextDocumentService.ts`
- `src/views/admin/AuditLogView.tsx`
- `src/views/admin/OrganizationContextWorkerOperationsPanel.tsx`

Behavior now:

- queue summary distinguishes:
  - `db_ledger_v1`,
  - `external_queue_v1`,
  - `external_queue_unconfigured`,
- external queue configuration requires `ORG_CONTEXT_EXTERNAL_QUEUE_URL`,
- queue summary exposes:
  - `queueBackendReady`,
  - `queueBackendReason`,
  - `externalQueueName`,
- `ORG_CONTEXT_QUEUE_BACKEND=external` without a queue URL remains `external_queue_unconfigured`,
- `ORG_CONTEXT_QUEUE_BACKEND=external` with a queue URL reports `external_queue_v1` and readiness, but the local cron worker still returns `external_queue_worker_not_implemented`,
- worker operations UI is extracted into `OrganizationContextWorkerOperationsPanel`,
- the panel shows queue readiness, scheduler state, pending/attention counts, external queue name, and safe readiness copy.

Why:

This prevents false operational readiness. Admins can now see whether the configured queue is ready, missing configuration, or intentionally not executable by the current local worker. The UI change also creates a dedicated component boundary for the future worker operations dashboard without moving contextual AI/admin controls out of the existing admin command area.

### 2.13 Queue Adapter Capability Contract And Standalone Admin Operations Surface

Changed:

- `server/src/services/organizationContext/ContextDocumentService.ts`
- `src/views/admin/OrganizationContextWorkerOperationsPanel.tsx`
- `src/views/admin/OrganizationContextWorkerOperationsView.tsx`
- `src/views/admin/AdminSettingsModule.tsx`
- `src/components/Admin/AdminSettingsSidebar.tsx`

Behavior now:

- queue summary reports adapter capabilities separately:
  - `queueCanEnqueue`,
  - `queueCanConsumeLocally`,
  - `queueAdapterReason`,
- `db_ledger_v1` reports enqueue and local consume as available,
- `external_queue_unconfigured` reports enqueue and local consume as unavailable with `external_queue_url_missing`,
- `external_queue_v1` reports enqueue as available but local consume as unavailable with `external_queue_consumer_not_implemented`,
- `processConfiguredContextDocumentWorkerTick()` now uses the adapter capability contract instead of only checking backend name,
- local cron still refuses to consume external queue jobs until a concrete external consumer exists,
- Admin settings now include an `Operations` section,
- `OrganizationContextWorkerOperationsView` is a standalone admin surface for worker queue posture, job listing, refresh, and explicit one-time worker runs,
- both Audit Log and Operations surfaces keep browser confirmation before any worker execution.

Why:

This creates the concrete adapter boundary needed before introducing a real external queue. The system can now say "this queue can accept work" separately from "this local process can consume it," which avoids fake readiness and makes deployment state visible to admins. The standalone Operations surface also gives worker controls a home outside Audit Log while preserving the Audit Log as audit evidence.

### 2.14 Org-Scoped Queue Summary, Lease Metrics, And Dead-Letter Posture

Changed:

- `server/src/services/organizationContext/ContextDocumentService.ts`
- `server/src/routes/auditLog.routes.ts`
- `src/views/admin/OrganizationContextWorkerOperationsPanel.tsx`
- `src/views/admin/AuditLogView.tsx`
- `src/views/admin/OrganizationContextWorkerOperationsView.tsx`

Behavior now:

- admin queue summary passes `organizationId` from authenticated admin context into the service read model,
- service queue summary can filter processing jobs by organization,
- queue summary reports:
  - `claimedCount`,
  - `staleClaimedCount`,
  - `oldestClaimedAt`,
  - `deadLetterCount`,
  - `latestDeadLetterAt`,
  - `staleLockMs`,
- stale locks are computed against the same default stale-lock window used by worker recovery,
- Operations panel displays `Claimed`, `Stale locks`, `Dead letters`, and lease health copy,
- dead-letter and stale-lock posture is visible without requiring admins to inspect raw job rows.

Why:

Queue posture must be tenant-safe and operationally useful. Global worker metrics would risk tenant leakage, and a plain job list does not tell admins whether the queue is merely busy, stuck, or failing. Stage 2K makes the read model safer and more actionable while still keeping requeue/recovery behind explicit worker execution.

### 2.15 Dead-Letter Drill-Down And Explicit Requeue Flow

Changed:

- `server/src/services/organizationContext/ContextDocumentService.ts`
- `server/src/routes/auditLog.routes.ts`
- `src/services/api.ts`
- `src/views/admin/OrganizationContextWorkerOperationsPanel.tsx`
- `src/views/admin/OrganizationContextWorkerOperationsView.tsx`

Behavior now:

- service exposes `requeueDeadLetterContextProcessingJob`,
- only org-scoped `dead_letter` jobs can be requeued,
- requeue resets the processing job to `retry_scheduled`, clears lock/error fields, resets attempts, and records safe requeue metadata,
- the associated document is moved back to `uploaded` with cleared processing error,
- admin API exposes `POST /api/audit-logs/organization-context/processing-jobs/:jobId/requeue`,
- requeue requires `confirmation = requeue_context_processing_job`,
- confirmed requeue writes an admin audit event `organization_context.processing_job_requeued`,
- Operations UI shows `Requeue dead letter` only for `dead_letter` jobs,
- UI requires browser confirmation before calling the requeue endpoint,
- requeue refreshes worker operations read-back state.

Why:

Dead-letter recovery is a mutation that can trigger more processing later, so it must follow the same no-silent-execution rule as worker runs. Stage 2L gives admins a visible recovery path without hiding retries or reprocessing failed documents in the background.

### 2.16 External Enqueue Adapter And Stale-Lock Review Action

Changed:

- `server/src/services/organizationContext/ContextDocumentService.ts`
- `server/src/routes/auditLog.routes.ts`
- `src/services/api.ts`
- `src/views/admin/OrganizationContextWorkerOperationsPanel.tsx`
- `src/views/admin/OrganizationContextWorkerOperationsView.tsx`

Behavior now:

- service exposes `enqueueContextProcessingJobToConfiguredBackend`,
- `db_ledger_v1` enqueue reports `db_ledger_already_enqueued`,
- configured external queue enqueue posts `organization_context_external_queue_enqueue_v1` to `ORG_CONTEXT_EXTERNAL_QUEUE_URL`,
- optional `ORG_CONTEXT_EXTERNAL_QUEUE_TOKEN` is sent as bearer authorization,
- external enqueue returns safe failure reasons like `external_queue_http_<status>` or `external_queue_enqueue_failed`,
- external enqueue is callable adapter infrastructure only; upload and cron still do not silently push work to an external broker,
- stale lock recovery is now available as a separate admin endpoint:
  - `POST /api/audit-logs/organization-context/processing-jobs/recover-stale-locks`,
  - requires `confirmation = recover_context_stale_locks`,
  - scopes recovery by organization,
  - writes audit event `organization_context.stale_locks_recovered`,
- Operations UI shows `Recover stale locks` only when stale locks exist,
- UI requires browser confirmation before recovering stale locks and refreshes read-back state after the mutation.

Why:

External queue integration needs an enqueue contract before a consumer is introduced, but it must not create hidden processing. Stale-lock recovery also deserves its own explicit admin action instead of being bundled only into "run worker once", because recovery changes queue state even when no job is processed.

### 2.17 External Consumer Contract And Explicit Lease Expiry

Changed:

- `server/src/services/organizationContext/ContextDocumentService.ts`
- `tests/unit/backend/services/contextDocumentService.storage-usage.test.ts`

Behavior now:

- processing jobs include `lease_expires_at`,
- worker claim sets `locked_at`, `locked_by`, and `lease_expires_at`,
- stale-lock recovery uses `COALESCE(lease_expires_at, locked_at)` so existing rows remain recoverable,
- requeue clears `lease_expires_at` together with lock fields,
- queue summary reports `leaseDurationMs`,
- external queue consumer has a callable tick contract:
  - disabled callers receive `external_consumer_disabled`,
  - unconfigured external queue remains disabled,
  - configured external queue returns `external_queue_consumer_not_implemented`,
- consumer tick does not process queue messages yet and does not start a daemon.

Why:

Distributed workers need explicit lease expiry rather than relying only on lock timestamps. Stage 2N makes the lease contract visible in the ledger and adds the consumer boundary without pretending that external broker consumption is implemented.

### 2.18 Compare-And-Swap Worker Claiming And External Pull Contract

Changed:

- `server/src/services/organizationContext/ContextDocumentService.ts`
- `tests/unit/backend/services/contextDocumentService.storage-usage.test.ts`

Behavior now:

- worker claim is compare-and-swap based:
  - claim only succeeds when status is `queued` or `retry_scheduled`,
  - claim also requires no active lock or an expired lease,
  - DB `changes` is checked after `UPDATE`,
- worker skips jobs when another worker already won the claim race,
- worker result includes `claimSkipped`,
- skipped claims do not read files or process documents,
- external consumer tick now distinguishes:
  - disabled consumer,
  - missing external queue configuration,
  - missing `ORG_CONTEXT_EXTERNAL_QUEUE_PULL_URL`,
  - configured pull URL with consumer pull still not implemented,
- external consumer result includes `pulledMessages`.

Why:

Multi-worker safety depends on atomic claim semantics. Stage 2O prevents duplicate local workers from processing the same queued job when the claim race is lost. It also makes the next external consumer dependency explicit by separating enqueue URL from pull URL.

### 2.19 External Queue Pull Processing And Lease Renewal Heartbeat

Changed:

- `server/src/services/organizationContext/ContextDocumentService.ts`
- `tests/unit/backend/services/contextDocumentService.storage-usage.test.ts`

Behavior now:

- processing renews `lease_expires_at` after a job starts, before extraction, and during chunk insertion,
- completed/degraded/failed/retry/dead-letter transitions clear lock and lease fields,
- external consumer tick can call `ORG_CONTEXT_EXTERNAL_QUEUE_PULL_URL`,
- pull requests use contract `organization_context_external_queue_pull_v1`,
- pulled messages are accepted only as identifiers (`organizationId`, `jobId`, `documentId`),
- external pull processing still routes work through `processQueuedContextDocumentJobs`,
- DB ledger filtering, stale-lock recovery, and compare-and-swap claim remain the source of truth,
- empty external pulls are reported as `external_queue_empty` rather than fake success.

Why:

Long document processing must not be falsely recovered as stale while it is still actively extracting or indexing. External queues also must not become a second processing truth. Stage 2P introduces a minimal broker pull contract while keeping actual processing controlled by the audited ledger and CAS worker claim.

### 2.20 External Queue Acknowledgement/Backoff And Worker Run Read-Back

Changed:

- `server/src/services/organizationContext/ContextDocumentService.ts`
- `server/src/routes/auditLog.routes.ts`
- `tests/unit/backend/services/contextDocumentService.storage-usage.test.ts`
- `tests/integration/routes/auditLog.organizationContext.test.ts`

Behavior now:

- worker results include per-job outcome arrays: processed, retried, dead-lettered, and skipped claims,
- external queue pull can restrict DB processing to pulled job ids,
- successful jobs can be acknowledged through `ORG_CONTEXT_EXTERNAL_QUEUE_ACK_URL`,
- retry/dead-letter/skipped jobs can be sent to `ORG_CONTEXT_EXTERNAL_QUEUE_BACKOFF_URL`,
- acknowledgement uses contract `organization_context_external_queue_ack_v1`,
- backoff uses contract `organization_context_external_queue_backoff_v1`,
- missing ack/backoff URLs are reported as `queueActionReason` rather than hidden success,
- manual admin worker run returns `runId`, `auditEventId`, and `auditRecorded`,
- audit log resource id for manual runs is now the stable `runId`.

Why:

External brokers need explicit message outcome handling. Acking everything that was pulled would risk data loss, while never reporting missing ack/backoff configuration would create fake operational confidence. Manual worker runs also need a direct read-back handle so admins can connect the visible result to the audit trail.

### 2.21 Worker Operations UI Read-Back

Changed:

- `src/views/admin/OrganizationContextWorkerOperationsPanel.tsx`
- `src/views/admin/OrganizationContextWorkerOperationsView.tsx`
- `src/views/admin/AuditLogView.tsx`
- `tests/unit/views/admin/OrganizationContextWorkerOperationsView.honesty.test.tsx`

Behavior now:

- Operations panel shows `runId` and `auditEventId` after a confirmed worker run,
- UI explicitly reports whether audit recording failed through `auditRecorded`,
- external queue read-back shows pulled, acknowledged, and backoff message counts,
- missing ack/backoff configuration is rendered as an attention state through `queueActionReason`,
- per-job outcome counts are visible for processed, retried, dead-lettered, and skipped jobs,
- existing confirmation gates for worker run, stale-lock recovery, and dead-letter requeue remain unchanged.

Why:

Stage 2Q made worker run and queue outcomes auditable at the API boundary. Stage 2R closes the UI honesty gap so admins can immediately see what happened, which audit event records it, and whether queue acknowledgement still needs configuration.

### 2.22 Typed Worker Operations API And Queue Outcome Lineage

Changed:

- `src/services/api/organizationContextWorker.api.ts`
- `src/services/api.ts`
- `src/views/admin/OrganizationContextWorkerOperationsView.tsx`
- `server/src/services/organizationContext/ContextDocumentService.ts`
- `tests/unit/backend/services/contextDocumentService.storage-usage.test.ts`
- `tests/unit/views/admin/OrganizationContextWorkerOperationsView.honesty.test.tsx`

Behavior now:

- worker operations frontend calls use a typed module instead of adding more untyped legacy API surface,
- legacy `Api` methods delegate to the typed worker operations module for compatibility,
- Operations UI imports the typed worker contract directly,
- external queue outcome processing writes best-effort lineage events,
- outcome lineage uses `external_queue_outcome_recorded` for clean queue actions,
- outcome lineage uses `external_queue_outcome_attention` when ack/backoff needs configuration or fails,
- outcome lineage stores counts and job/document ids, but not broker receipt handles or raw message bodies.

Why:

The worker operations surface is becoming a critical admin control plane. Typed client contracts reduce accidental UI drift, while queue outcome lineage makes operational effects auditable beyond a transient response payload. The audit payload intentionally excludes broker internals.

### 2.23 Queue Outcome Admin Filters And Operations Drill-Down

Changed:

- `server/src/routes/auditLog.routes.ts`
- `src/services/api.ts`
- `src/services/api/organizationContextWorker.api.ts`
- `src/views/admin/OrganizationContextWorkerOperationsPanel.tsx`
- `src/views/admin/OrganizationContextWorkerOperationsView.tsx`
- `tests/integration/routes/auditLog.organizationContext.test.ts`
- `tests/unit/views/admin/OrganizationContextWorkerOperationsView.honesty.test.tsx`

Behavior now:

- lineage audit endpoint accepts `targetType` and `workflow` filters,
- response metadata echoes the applied lineage filters,
- typed worker API exposes `getQueueOutcomeLineage`,
- Operations loads recent `organization_context_worker` / `organization_context_external_queue` events,
- Operations panel renders a queue outcome audit drill-down,
- drill-down shows event type, queue target id, pulled/ack/backoff counts, timestamp, and attention reasons,
- drill-down does not render receipt handles or raw broker message bodies.

Why:

Queue outcome lineage is only useful if admins can filter and inspect it from the operational surface. Stage 2T adds that read path while keeping it scoped to admin audit endpoints and preserving the no raw internals rule.

### 2.24 Scheduler Observability And Queue Outcome Refresh

Changed:

- `src/services/api/organizationContextWorker.api.ts`
- `src/views/admin/OrganizationContextWorkerOperationsPanel.tsx`
- `src/views/admin/OrganizationContextWorkerOperationsView.tsx`
- `tests/unit/views/admin/OrganizationContextWorkerOperationsView.honesty.test.tsx`

Behavior now:

- typed queue summary includes `leaseDurationMs` and `generatedAt`,
- Operations panel shows lease duration in minutes,
- Operations panel shows when the queue summary was generated,
- queue outcome audit has its own refresh action,
- refreshing queue outcome audit does not run or confirm worker execution,
- queue outcome audit shows an honest empty state when no outcome events exist,
- refresh failures show a toast error and do not clear the rest of the worker posture.

Why:

Admins need to distinguish worker execution from audit refresh. Stage 2U makes queue/scheduler timing visible and lets admins refresh broker outcome evidence without mutating processing state.

### 2.25 Worker Run History Timeline And Queue Outcome Attention Counters

Changed:

- `src/services/api/organizationContextWorker.api.ts`
- `src/views/admin/OrganizationContextWorkerOperationsPanel.tsx`
- `src/views/admin/OrganizationContextWorkerOperationsView.tsx`
- `tests/unit/views/admin/OrganizationContextWorkerOperationsView.honesty.test.tsx`

Behavior now:

- typed worker API can read recent manual worker runs from the existing admin `audit_log` endpoint,
- worker run history normalizes safe audit details into `runId`, `auditEventId`, counts, and timestamp,
- Operations view loads recent worker run history alongside jobs, queue summary, and queue outcome lineage,
- Operations panel shows a short worker run history timeline,
- queue outcome audit shows attention outcome count and total backoff messages before the event list,
- these read paths do not trigger worker execution and do not require mutation confirmation.

Why:

The previous Operations surface could show the last run result only inside the current browser session. Stage 2V makes recent manual worker activity visible after refresh while keeping the source of truth in the existing audit ledger. Attention counters make queue degradation visible at a glance without exposing broker internals.

### 2.26 Worker Operations Audit Filters And External Broker Adapter Hardening

Changed:

- `server/src/services/organizationContext/ContextDocumentService.ts`
- `src/views/admin/OrganizationContextWorkerOperationsPanel.tsx`
- `src/views/admin/OrganizationContextWorkerOperationsView.tsx`
- `tests/unit/backend/services/contextDocumentService.storage-usage.test.ts`
- `tests/unit/views/admin/OrganizationContextWorkerOperationsView.honesty.test.tsx`

Behavior now:

- external queue messages are guarded against the DB ledger before any file is read,
- pulled messages must match `jobId`, `documentId`, and `organizationId`,
- mismatched external messages are rejected as `external_queue_message_identity_mismatch`,
- missing ledger rows are reported as `external_queue_message_job_not_found`,
- rejected external messages are sent to backoff when the backoff URL is configured,
- outcome lineage marks backoff/error outcomes as attention even when the broker action itself succeeds,
- Operations queue outcome audit supports read-only `All` and `Attention only` filters,
- filtering queue outcome audit does not run the worker and does not require mutation confirmation.

Why:

The external broker must never become a second trust boundary for tenant or document identity. Stage 2W keeps the processing ledger as the source of truth, sends suspicious messages to backoff, and makes attention filtering available to admins without hiding failures or exposing raw broker internals.

### 2.27 External Queue Adapter Contract Tests And Worker Run Correlation Drill-Down

Changed:

- `src/services/api/organizationContextWorker.api.ts`
- `src/views/admin/OrganizationContextWorkerOperationsPanel.tsx`
- `tests/unit/backend/services/contextDocumentService.storage-usage.test.ts`
- `tests/unit/views/admin/OrganizationContextWorkerOperationsView.honesty.test.tsx`

Behavior now:

- external pull payload is contract-tested for `contract`, `queueName`, and `limit`,
- external ack payload is contract-tested for safe identifier fields and receipt handle only,
- external backoff payload is contract-tested for safe identifier fields and safe reason only,
- ack/backoff tests assert that raw broker body, filepath, or ledger-only mismatch details are not leaked,
- typed worker run history includes queue correlation counts: pulled, acknowledged, backoff,
- typed worker run history includes `queueActionReason` when a prior run needs attention,
- Operations run history cards show queue correlation and attention reason without raw JSON.

Why:

The external broker adapter is now close enough to a production integration that payload shape must be pinned down by tests, not only inferred from implementation. Admins also need to correlate a visible worker run with queue effects after refresh, without opening raw audit JSON.

### 2.28 Worker Run Detail Filters And Production Broker Deployment Readiness

Changed:

- `server/src/services/organizationContext/ContextDocumentService.ts`
- `src/services/api/organizationContextWorker.api.ts`
- `src/views/admin/OrganizationContextWorkerOperationsPanel.tsx`
- `src/views/admin/OrganizationContextWorkerOperationsView.tsx`
- `tests/unit/backend/services/contextDocumentService.storage-usage.test.ts`
- `tests/unit/views/admin/OrganizationContextWorkerOperationsView.honesty.test.tsx`

Behavior now:

- queue summary reports `brokerDeploymentReady`,
- queue summary reports `brokerDeploymentMissing` for missing external broker URLs,
- DB ledger mode reports broker deployment as ready because no external broker is required,
- configured external queue mode distinguishes enqueue readiness from production broker completeness,
- typed worker run history supports `all`, `attention`, and `backoff` outcome filters,
- Operations panel shows broker deployment readiness and missing safe configuration labels,
- Operations panel exposes read-only worker run history filters,
- filtering worker run history does not run the worker and does not require mutation confirmation.

Why:

Admins need to see whether an external queue is merely configured for enqueue or actually ready for a production broker loop with pull, ack, and backoff. Run history also needs focused filters so operators can inspect attention/backoff runs without opening raw audit log JSON.

### 2.29 Async Worker Cutover Readiness And Document Locator Upgrade Plan

Changed:

- `server/src/services/organizationContext/ContextDocumentService.ts`
- `src/services/api/organizationContextWorker.api.ts`
- `src/views/admin/OrganizationContextWorkerOperationsPanel.tsx`
- `tests/unit/backend/services/contextDocumentService.storage-usage.test.ts`
- `tests/unit/views/admin/OrganizationContextWorkerOperationsView.honesty.test.tsx`

Behavior now:

- queue summary reports `asyncCutoverReady`,
- queue summary reports `asyncCutoverBlockers`,
- cutover blockers include disabled scheduler, incomplete broker deployment, stale locks, and dead letters,
- queue summary reports `locatorUpgradePlan`,
- locator baseline readiness lists current `char_range`, text `line_range`, and spreadsheet `sheet_range` support,
- locator remaining work lists PDF page, DOCX paragraph, PPTX slide, image region, and audio timestamp locators,
- Operations UI renders async cutover readiness and blockers,
- Operations UI renders locator upgrade baseline and remaining work without pretending full multimodal traceability is done.

Why:

The system is close to a real async worker cutover, but flipping execution modes needs explicit readiness evidence rather than hidden assumptions. Locator work also needs a visible plan because current chunk metadata is citeable but not yet sufficient for PDFs, DOCX, slides, images, or audio.

### 2.30 Guarded Async Upload Execution Switch

Changed:

- `server/src/services/organizationContext/ContextDocumentService.ts`
- `src/services/api/organizationContextWorker.api.ts`
- `src/views/admin/OrganizationContextWorkerOperationsPanel.tsx`
- `tests/unit/backend/services/contextDocumentService.storage-usage.test.ts`
- `tests/unit/views/admin/OrganizationContextWorkerOperationsView.honesty.test.tsx`

Behavior now:

- upload execution remains `inline_worker_boundary_v1` by default,
- queue summary reports `uploadProcessingMode`,
- queue summary reports `guardedAsyncUploadReady`,
- queue summary reports `guardedAsyncUploadBlockers`,
- queue summary reports `guardedAsyncUploadSwitchPlan`,
- the guarded switch requires:
  - `ORG_CONTEXT_UPLOAD_PROCESSING_MODE=async_worker`,
  - `ORG_CONTEXT_UPLOAD_ASYNC_CUTOVER_ENABLED=true`,
  - `ORG_CONTEXT_WORKER_SCHEDULER_ENABLED=true`,
- the switch also requires enqueue capability and broker deployment readiness,
- when all guards pass, upload creates the processing job and enqueues it instead of extracting inline,
- async-queued uploads return the document as `processing`,
- async-queued job metadata records `executionMode = async_worker_enqueued_v1`,
- Operations UI shows upload execution mode, guarded switch blockers, and rollback env,
- if enqueue fails under the guarded switch, the document remains `uploaded` with a safe processing error instead of pretending extraction happened.

Why:

The product needs upload responses to become fast, but changing upload semantics is high risk. Stage 3A makes the cutover explicit, observable, and reversible. The default remains inline, while production can enable async upload only with two env guards plus worker readiness.

### 2.31 Async Upload Status Read-Back And External Worker Deployment Verification

Changed:

- `server/src/services/organizationContext/ContextDocumentService.ts`
- `src/services/api/organizationContextWorker.api.ts`
- `src/views/admin/OrganizationContextWorkerOperationsPanel.tsx`
- `tests/unit/backend/services/contextDocumentService.storage-usage.test.ts`
- `tests/unit/views/admin/OrganizationContextWorkerOperationsView.honesty.test.tsx`

Behavior now:

- queue summary reports `asyncUploadReadBack`,
- read-back includes processing document count, oldest processing document timestamp, queued job count, retry-scheduled job count, and an attention flag,
- async upload read-back is org-scoped through the existing admin queue summary route,
- queue summary reports `externalWorkerDeploymentVerified`,
- queue summary reports `externalWorkerDeploymentMissing`,
- queue summary reports `externalWorkerDeploymentVerification`,
- external worker verification is `not_required` for DB ledger mode,
- external queue mode requires safe deployment evidence:
  - `ORG_CONTEXT_EXTERNAL_WORKER_HEALTH_URL`,
  - `ORG_CONTEXT_EXTERNAL_WORKER_DEPLOYMENT_VERIFIED=true`,
- Operations UI shows async upload read-back without running the worker,
- Operations UI shows external worker verification state and missing release-gate evidence,
- no raw broker payload, health response, receipt handle, or deployment internals are exposed in the UI.

Why:

Once uploads can return `processing`, admins need a read path that proves those documents are still visible and connected to the worker ledger. External worker deployment also needs an explicit release-gate signal so the UI does not imply that an external queue means an actual worker is deployed and healthy.

### 2.32 External Worker Health Probe And Async Upload UX Refresh Loop

Changed:

- `server/src/services/organizationContext/ContextDocumentService.ts`
- `src/services/api/organizationContextWorker.api.ts`
- `src/views/admin/OrganizationContextWorkerOperationsPanel.tsx`
- `src/views/admin/OrganizationContextWorkerOperationsView.tsx`
- `tests/unit/backend/services/contextDocumentService.storage-usage.test.ts`
- `tests/unit/views/admin/OrganizationContextWorkerOperationsView.honesty.test.tsx`

Behavior now:

- queue summary reports `externalWorkerHealthProbe`,
- external worker health probe statuses are safe labels only:
  - `not_required`,
  - `not_configured`,
  - `not_checked`,
  - `healthy`,
  - `unhealthy`,
- live health probing is opt-in through `ORG_CONTEXT_EXTERNAL_WORKER_HEALTH_PROBE_ENABLED=true`,
- health probe calls `ORG_CONTEXT_EXTERNAL_WORKER_HEALTH_URL` only when explicitly enabled,
- health probe records safe reason codes such as `external_worker_health_probe_disabled` or `external_worker_health_http_<status>`,
- Operations UI renders worker health status and safe reason text,
- Operations UI exposes `Refresh async status`,
- async status refresh reloads only processing jobs and queue summary,
- async status refresh does not run the worker, does not requeue jobs, and does not recover stale locks,
- when processing documents exist, Operations schedules a 15-second read-only refresh loop for async status.

Why:

Async upload users and admins need status feedback while the worker finishes processing, but status refresh must not mutate queue state. External worker health also needs to stay honest: a configured health URL is not enough unless the probe is explicitly enabled and returns a safe healthy result.

### 2.33 User-Facing Document Processing Status Refresh

Changed:

- `server/src/services/organizationContext/ContextDocumentService.ts`
- `src/components/documents/DocumentSidePanel.tsx`
- `src/types/core.ts`
- `tests/integration/routes/documentsRoutes.no-stubs.test.ts`
- `tests/components/documents/DocumentSidePanel.processing-status.test.tsx`

Behavior now:

- document list/read responses include a safe `processingState`,
- `processingState` distinguishes:
  - `not_processing`,
  - `queued`,
  - `claimed`,
  - `processing`,
  - `retry_scheduled`,
  - `stale_processing`,
  - `attention_required`,
- stale processing is flagged after 30 minutes without a terminal document state,
- stale/uncorrelated processing documents get `attentionRequired = true` with safe reason codes,
- user-facing document library shows processing hints without exposing raw worker internals,
- the document panel exposes a manual `Refresh document status` action,
- the document panel refreshes processing documents every 15 seconds while open,
- status refresh only reloads document lists; it does not run workers, requeue jobs, recover locks, or perform hidden mutations,
- file-size display now fails closed to `Unknown size` instead of showing `NaN` when older API rows lack `fileSize`.

Why:

Async upload cannot be only an admin Operations concern. Users who upload a document need a truthful read-back in the document library: queued, actively processing, retrying, stale, or attention required. This preserves no hidden execution and honest degraded UI while keeping the worker controls in admin surfaces.

### 2.34 User-Facing Recovery Guidance And Admin Handoff

Changed:

- `src/components/documents/DocumentSidePanel.tsx`
- `tests/components/documents/DocumentSidePanel.processing-status.test.tsx`

Behavior now:

- stale or attention-required processing documents show a recovery guidance panel,
- admins see an `Open Admin Operations` handoff action,
- the handoff navigates to the existing Admin Operations surface,
- the handoff closes the document side panel so the operational surface is not hidden behind it,
- non-admin users see guidance to ask an organization admin to review worker jobs,
- the guidance does not run workers, requeue jobs, recover locks, delete documents, or perform hidden mutations.

Why:

Stage 3D made stale processing visible, but visibility alone leaves users without a next step. Stage 3E connects the user-facing attention state to the explicit admin recovery surface while preserving the proposal/approval/execution/audit boundary for actual worker recovery.

### 2.35 Processing Attention Read Receipt And Recovery Audit Read-Back

Changed:

- `server/src/services/organizationContext/ContextDocumentService.ts`
- `src/components/documents/DocumentSidePanel.tsx`
- `src/types/core.ts`
- `tests/integration/routes/documentsRoutes.no-stubs.test.ts`
- `tests/components/documents/DocumentSidePanel.processing-status.test.tsx`

Behavior now:

- `processingState` includes `jobId`,
- `processingState.attentionReadBack` reports whether attention is currently visible to the user,
- attention read-back includes a generated-at timestamp for the read model,
- viewing the document list does not write a "mark as read" receipt,
- `processingState.recoveryAuditReadBack` reports whether a related audited recovery event exists,
- recovery audit read-back only exposes safe fields:
  - status,
  - action type,
  - recorded timestamp,
- document list read-back correlates recovery audits from explicit worker run, stale-lock recovery, and requeue audit events,
- the document panel shows attention visibility and recovery audit status without exposing raw audit details or broker internals.

Why:

Users need to know whether a stale processing warning is merely visible or already has audited recovery activity behind it. Stage 3F keeps that read-back honest and read-only: it gives visibility without silently marking notifications read or triggering any recovery execution.

### 2.36 Persisted Processing Notification Acknowledgement

Changed:

- `server/src/services/organizationContext/ContextDocumentService.ts`
- `server/src/routes/documents.routes.ts`
- `src/services/api.ts`
- `src/components/documents/DocumentSidePanel.tsx`
- `src/types/core.ts`
- `tests/integration/routes/documentsRoutes.no-stubs.test.ts`
- `tests/components/documents/DocumentSidePanel.processing-status.test.tsx`

Behavior now:

- processing attention acknowledgement has an explicit backend endpoint:
  - `POST /api/documents/:id/processing-attention/ack`,
- acknowledgement is persisted in `organization_context_processing_attention_receipts`,
- acknowledgement is scoped by organization, user, and document,
- acknowledgement requires document access and only succeeds when attention is actually required,
- document read-back includes `processingState.acknowledgement`,
- the document panel shows acknowledged/unacknowledged state,
- the document panel exposes `Acknowledge attention` as an explicit user action,
- acknowledgement does not run workers, requeue jobs, recover locks, delete files, or modify processing jobs.

Why:

Read-only visibility is useful, but users also need an explicit way to say "I saw this." Stage 3G adds that acknowledgement as its own controlled mutation while keeping recovery execution in Admin Operations.

### 2.37 Final Deployment Scope Assessment

Assessment:

- Code-level document operations are now close to a release candidate for safe async upload visibility and admin recovery handoff.
- The current implementation is not a full `100%` Organization Context Engine according to the source of truth because several production and modality gates remain outside this code slice.

Ready for controlled release after environment validation:

- tenant-scoped document upload/list/read,
- durable processing jobs and retries,
- stale processing visibility,
- explicit admin worker run/requeue/recover actions,
- async upload guarded cutover read model,
- user-facing processing status refresh,
- explicit persisted attention acknowledgement.

Remaining before full program `PASS`:

- always-on deployed worker or verified scheduler,
- production external broker deployment with real health/SLO history,
- full async upload cutover enabled by environment and release gate,
- PPTX slide extraction/locators or explicitly accepted degraded scope,
- PDF page and DOCX paragraph locators,
- OCR/image/audio multimodal pipelines,
- broader Stage 3 governed retrieval coverage across all AI workflows,
- end-to-end production smoke tests with real storage, DB, worker, broker, and AI provider configuration.

Recommended final release plan:

1. Run a release-gate validation in staging with `ORG_CONTEXT_UPLOAD_PROCESSING_MODE=async_worker` behind the guarded flag.
2. Verify worker scheduler/external worker health and deployment marker.
3. Run upload -> queue -> worker -> ready/degraded -> document UI read-back smoke tests.
4. Run one stale-lock recovery and one dead-letter requeue in staging and verify audit read-back.
5. Keep unsupported modalities honest degraded until their extraction/locator milestones are explicitly implemented.

---

## 3. Tests Added / Updated

Files:

- `tests/integration/routes/documentsRoutes.no-stubs.test.ts`
- `tests/unit/backend/services/contextDocumentService.storage-usage.test.ts`
- `tests/integration/routes/auditLog.organizationContext.test.ts`
- `tests/unit/views/admin/AuditLogView.honesty.test.tsx`
- `tests/unit/views/admin/OrganizationContextWorkerOperationsView.honesty.test.tsx`
- `tests/components/documents/DocumentSidePanel.processing-status.test.tsx`

Covers:

- upload persists an `organization_context_processing_jobs` row,
- ready upload records the processing job with organization/user/document/source attribution,
- degraded extraction records a `degraded` processing job with safe error code,
- quota-blocked uploads still return honest `quota_blocked` and do not continue into accepted processing,
- deleted documents remain hidden from document listing.
- ready text upload stores normalized package fields,
- ready chunks include source locator metadata,
- degraded extraction stores safe normalized package fields,
- processing job metadata records the inline worker boundary,
- ready text chunks include `line_range` native locators,
- ready spreadsheet chunks include `sheet_range` native locators.
- queued worker failures move to `retry_scheduled` before max attempts,
- final queued worker failures move to `dead_letter` and mark the document `failed`.
- queued worker jobs are claimed with lock metadata before processing,
- admins can read processing jobs through an org-scoped audit endpoint,
- worker run requires explicit confirmation,
- confirmed worker run is audited.
- stale claimed jobs can be recovered to `retry_scheduled`,
- admin UI renders processing jobs,
- admin UI requires browser confirmation before running the worker,
- admin UI refreshes context audit after confirmed worker execution.
- queue summary endpoint returns `db_ledger_v1` status counts,
- scheduled worker tick does not process jobs unless explicitly enabled,
- admin UI renders queue adapter, pending count, attention count, and last worker run result.
- configured scheduler tick stays disabled without `ORG_CONTEXT_WORKER_SCHEDULER_ENABLED=true`,
- external queue mode is reported as unconfigured instead of silently processing,
- cron entrypoint exists as `worker:organization-context:once`,
- admin UI shows configured backend and scheduler status.
- queue summary reports external queue readiness and safe missing-configuration reasons,
- configured external queue mode is visible but not executed by the local worker until a concrete external worker exists,
- worker operations UI is covered as a dedicated component boundary through `AuditLogView`.
- queue summary exposes enqueue and local-consume capability separately,
- standalone Admin Operations surface renders worker posture and job list,
- standalone Admin Operations surface requires explicit confirmation before worker execution,
- standalone Admin Operations surface shows degraded state when worker operations cannot load.
- processing queue summary is org-scoped from the admin route,
- queue summary reports claimed, stale-lock, and dead-letter metrics,
- Operations panel displays lease health and dead-letter posture without raw internals.
- dead-letter requeue requires explicit backend confirmation,
- confirmed requeue is audit logged,
- Operations UI exposes requeue only for dead-letter jobs and requires browser confirmation.
- external queue enqueue adapter can post a signed queue payload without consuming work locally,
- stale-lock recovery has its own confirmation-gated and audited admin action,
- Operations UI exposes stale-lock recovery only when stale locks exist.
- worker claims now write explicit `lease_expires_at`,
- stale-lock recovery uses lease expiry when available,
- external queue consumer tick exists but is disabled/not implemented by contract.
- worker claims are compare-and-swap enforced through DB `changes`,
- worker results report `claimSkipped`,
- external queue consumer distinguishes missing pull URL from not-yet-implemented pulling.
- worker processing renews active leases during extraction/indexing,
- terminal job states clear lock and lease metadata,
- external queue consumer can pull identifier-only messages and process them through the DB ledger.
- worker result includes per-job outcome arrays for deterministic external queue actions,
- external queue acknowledgement/backoff is explicit and optional by URL,
- missing ack URL is reported instead of pretending message acknowledgement succeeded,
- manual worker run response includes `runId`, `auditEventId`, and `auditRecorded`.
- Operations UI shows worker run audit identifiers and queue action read-back,
- Operations UI surfaces missing queue acknowledgement as an attention state,
- Operations UI test covers confirmed worker run read-back.
- worker operations frontend has a typed API module,
- legacy `Api` delegates worker operations calls to the typed module,
- external queue outcome and attention events are written to lineage without broker internals.
- lineage audit endpoint filters queue outcomes by target type and workflow,
- Operations UI displays recent external queue outcome audit events as a drill-down,
- queue outcome drill-down shows counts and attention reasons without raw broker internals.
- Operations UI shows lease duration and queue summary generation time,
- queue outcome audit can be refreshed separately from worker execution,
- queue outcome audit refresh does not require or trigger worker confirmation.
- worker run history is read from audit logs and rendered as an Operations timeline,
- queue outcome attention counters summarize degraded outcome events and backoff messages.
- external queue messages are rejected before file reads when broker identity disagrees with the DB ledger,
- rejected external messages are sent to backoff and recorded as attention lineage,
- Operations queue outcome audit can be filtered to attention events without running the worker.
- external queue pull/ack/backoff payloads are contract-tested for safe JSON shape,
- worker run history exposes queue correlation counts and attention reasons.
- broker deployment readiness is visible separately from queue enqueue readiness,
- worker run history can be filtered to attention or backoff runs without mutating worker state.
- async worker cutover readiness is visible with safe blockers,
- document locator upgrade readiness is visible without claiming full multimodal locator support.
- guarded async upload cutover requires explicit env flags before upload stops inline extraction,
- async-queued uploads return `processing` rather than fake `ready`,
- Operations UI shows the guarded upload switch plan and rollback env without mutating state.
- async upload read-back reports processing documents and queue correlation without triggering worker execution,
- external worker deployment verification is visible and honest about missing release-gate evidence.
- external worker health probe now provides opt-in safe health read-back,
- Operations can refresh async upload status without running or mutating the worker.
- document list responses expose user-facing `processingState` without running the worker,
- stale processing documents are surfaced as attention states,
- the document library can refresh processing status without upload/delete/move mutations.
- stale processing guidance shows an admin handoff without running worker recovery actions,
- admin handoff navigation is test-covered as a UI-only action.
- processing attention read-back includes a read-only visibility receipt,
- processing recovery audit read-back correlates user-facing stale states to audited worker/requeue/recovery events.
- processing attention acknowledgement persists explicit user acknowledgement,
- acknowledgement endpoint is access-checked and rejects non-attention documents,
- document UI acknowledgement is explicit and does not trigger worker recovery.

---

## 4. Verification

Commands run:

```bash
npx vitest run "tests/unit/backend/services/contextDocumentService.storage-usage.test.ts" "tests/integration/routes/documentsRoutes.no-stubs.test.ts" --maxWorkers=1 --maxConcurrency=1 --no-file-parallelism
```

Result:

`PASS`

```bash
npx vitest run "tests/unit/backend/services/contextDocumentService.storage-usage.test.ts" "tests/integration/routes/auditLog.organizationContext.test.ts" "tests/integration/routes/documentsRoutes.no-stubs.test.ts" --maxWorkers=1 --maxConcurrency=1 --no-file-parallelism
```

Result:

`PASS`

```bash
npx vitest run "tests/unit/backend/services/contextDocumentService.storage-usage.test.ts" "tests/integration/routes/auditLog.organizationContext.test.ts" "tests/unit/views/admin/AuditLogView.honesty.test.tsx" --maxWorkers=1 --maxConcurrency=1 --no-file-parallelism
```

Result:

`PASS`

```bash
npx eslint "server/src/services/organizationContext/ContextDocumentService.ts" "server/src/routes/auditLog.routes.ts"
```

Result:

`PASS_WITH_P2`

Additional targeted lint also covered `src/views/admin/AuditLogView.tsx` and `server/scripts/run-organization-context-worker-once.ts`.

Note: targeted lint has no errors. It still reports existing `@typescript-eslint/no-explicit-any` warnings in `ContextDocumentService.ts` and `auditLog.routes.ts`.

```bash
npx vitest run tests/unit/backend/services/contextDocumentService.storage-usage.test.ts tests/unit/views/admin/AuditLogView.honesty.test.tsx --maxWorkers=1 --maxConcurrency=2
```

Result:

`PASS_WITH_P2`

Note: backend assertions completed `12/12` passing, including Stage 2I external queue readiness cases, but the Vitest pool runner reported `Timeout waiting for worker to respond` after the backend file completed. This is treated as test-runner instability, not a product behavior failure.

```bash
npx vitest run tests/unit/views/admin/AuditLogView.honesty.test.tsx --maxWorkers=1 --maxConcurrency=1
```

Result:

`PASS`

```bash
npx eslint server/src/services/organizationContext/ContextDocumentService.ts src/views/admin/AuditLogView.tsx src/views/admin/OrganizationContextWorkerOperationsPanel.tsx tests/unit/backend/services/contextDocumentService.storage-usage.test.ts tests/unit/views/admin/AuditLogView.honesty.test.tsx --quiet
```

Result:

`PASS`

```bash
npx vitest run tests/unit/views/admin/AuditLogView.honesty.test.tsx tests/unit/views/admin/OrganizationContextWorkerOperationsView.honesty.test.tsx --maxWorkers=1 --maxConcurrency=1
```

Result:

`PASS`

```bash
npx vitest run tests/unit/backend/services/contextDocumentService.storage-usage.test.ts --maxWorkers=1 --maxConcurrency=1
```

Result:

`PASS`

```bash
npx eslint server/src/services/organizationContext/ContextDocumentService.ts src/views/admin/AuditLogView.tsx src/views/admin/OrganizationContextWorkerOperationsPanel.tsx src/views/admin/OrganizationContextWorkerOperationsView.tsx src/views/admin/AdminSettingsModule.tsx src/components/Admin/AdminSettingsSidebar.tsx tests/unit/backend/services/contextDocumentService.storage-usage.test.ts tests/unit/views/admin/AuditLogView.honesty.test.tsx tests/unit/views/admin/OrganizationContextWorkerOperationsView.honesty.test.tsx --quiet
```

Result:

`PASS`

```bash
npx vitest run tests/unit/backend/services/contextDocumentService.storage-usage.test.ts tests/integration/routes/auditLog.organizationContext.test.ts --maxWorkers=1 --maxConcurrency=1
```

Result:

`PASS`

```bash
npx vitest run tests/unit/views/admin/AuditLogView.honesty.test.tsx tests/unit/views/admin/OrganizationContextWorkerOperationsView.honesty.test.tsx --maxWorkers=1 --maxConcurrency=1
```

Result:

`PASS`

```bash
npx eslint server/src/services/organizationContext/ContextDocumentService.ts server/src/routes/auditLog.routes.ts src/views/admin/AuditLogView.tsx src/views/admin/OrganizationContextWorkerOperationsPanel.tsx src/views/admin/OrganizationContextWorkerOperationsView.tsx src/views/admin/AdminSettingsModule.tsx src/components/Admin/AdminSettingsSidebar.tsx tests/unit/backend/services/contextDocumentService.storage-usage.test.ts tests/integration/routes/auditLog.organizationContext.test.ts tests/unit/views/admin/AuditLogView.honesty.test.tsx tests/unit/views/admin/OrganizationContextWorkerOperationsView.honesty.test.tsx --quiet
```

Result:

`PASS`

```bash
npx vitest run tests/unit/backend/services/contextDocumentService.storage-usage.test.ts tests/integration/routes/auditLog.organizationContext.test.ts --maxWorkers=1 --maxConcurrency=1
```

Result:

`PASS`

```bash
npx vitest run tests/unit/views/admin/OrganizationContextWorkerOperationsView.honesty.test.tsx tests/unit/views/admin/AuditLogView.honesty.test.tsx --maxWorkers=1 --maxConcurrency=1
```

Result:

`PASS`

```bash
npx eslint server/src/services/organizationContext/ContextDocumentService.ts server/src/routes/auditLog.routes.ts src/services/api.ts src/views/admin/AuditLogView.tsx src/views/admin/OrganizationContextWorkerOperationsPanel.tsx src/views/admin/OrganizationContextWorkerOperationsView.tsx tests/unit/backend/services/contextDocumentService.storage-usage.test.ts tests/integration/routes/auditLog.organizationContext.test.ts tests/unit/views/admin/OrganizationContextWorkerOperationsView.honesty.test.tsx --quiet
```

Result:

`PASS`

```bash
npx vitest run tests/unit/backend/services/contextDocumentService.storage-usage.test.ts --maxWorkers=1 --maxConcurrency=1
```

Result:

`PASS`

```bash
npx eslint server/src/services/organizationContext/ContextDocumentService.ts tests/unit/backend/services/contextDocumentService.storage-usage.test.ts --quiet
```

Result:

`PASS`

```bash
npx vitest run tests/unit/backend/services/contextDocumentService.storage-usage.test.ts --maxWorkers=1 --maxConcurrency=1
```

Result:

`PASS`

```bash
npx eslint server/src/services/organizationContext/ContextDocumentService.ts tests/unit/backend/services/contextDocumentService.storage-usage.test.ts --quiet
```

Result:

`PASS`

```bash
npx vitest run tests/unit/backend/services/contextDocumentService.storage-usage.test.ts tests/integration/routes/auditLog.organizationContext.test.ts --maxWorkers=1 --maxConcurrency=1
```

Result:

`PASS`

```bash
npx vitest run tests/unit/views/admin/OrganizationContextWorkerOperationsView.honesty.test.tsx tests/unit/views/admin/AuditLogView.honesty.test.tsx --maxWorkers=1 --maxConcurrency=1
```

Result:

`PASS`

```bash
npx eslint server/src/services/organizationContext/ContextDocumentService.ts server/src/routes/auditLog.routes.ts src/services/api.ts src/views/admin/AuditLogView.tsx src/views/admin/OrganizationContextWorkerOperationsPanel.tsx src/views/admin/OrganizationContextWorkerOperationsView.tsx tests/unit/backend/services/contextDocumentService.storage-usage.test.ts tests/integration/routes/auditLog.organizationContext.test.ts tests/unit/views/admin/OrganizationContextWorkerOperationsView.honesty.test.tsx --quiet
```

Result:

`PASS`

```bash
npx vitest run tests/unit/backend/services/contextDocumentService.storage-usage.test.ts --maxWorkers=1 --maxConcurrency=1
```

Result:

`PASS`

```bash
npx eslint server/src/services/organizationContext/ContextDocumentService.ts tests/unit/backend/services/contextDocumentService.storage-usage.test.ts --quiet
```

Result:

`PASS`

```bash
npx vitest run tests/unit/backend/services/contextDocumentService.storage-usage.test.ts tests/integration/routes/auditLog.organizationContext.test.ts --maxWorkers=1 --maxConcurrency=1
```

Result:

`PASS`

```bash
npx eslint server/src/services/organizationContext/ContextDocumentService.ts server/src/routes/auditLog.routes.ts tests/unit/backend/services/contextDocumentService.storage-usage.test.ts tests/integration/routes/auditLog.organizationContext.test.ts --quiet
```

Result:

`PASS`

```bash
npx vitest run tests/unit/views/admin/OrganizationContextWorkerOperationsView.honesty.test.tsx tests/unit/views/admin/AuditLogView.honesty.test.tsx --maxWorkers=1 --maxConcurrency=1
```

Result:

`PASS`

```bash
npx eslint src/views/admin/OrganizationContextWorkerOperationsPanel.tsx src/views/admin/OrganizationContextWorkerOperationsView.tsx src/views/admin/AuditLogView.tsx tests/unit/views/admin/OrganizationContextWorkerOperationsView.honesty.test.tsx tests/unit/views/admin/AuditLogView.honesty.test.tsx --quiet
```

Result:

`PASS`

```bash
npx vitest run tests/unit/backend/services/contextDocumentService.storage-usage.test.ts tests/unit/views/admin/OrganizationContextWorkerOperationsView.honesty.test.tsx tests/unit/views/admin/AuditLogView.honesty.test.tsx --maxWorkers=1 --maxConcurrency=1
```

Result:

`PASS`

```bash
npx eslint server/src/services/organizationContext/ContextDocumentService.ts src/services/api.ts src/services/api/organizationContextWorker.api.ts src/views/admin/OrganizationContextWorkerOperationsView.tsx src/views/admin/OrganizationContextWorkerOperationsPanel.tsx src/views/admin/AuditLogView.tsx tests/unit/backend/services/contextDocumentService.storage-usage.test.ts tests/unit/views/admin/OrganizationContextWorkerOperationsView.honesty.test.tsx tests/unit/views/admin/AuditLogView.honesty.test.tsx --quiet
```

Result:

`PASS`

```bash
npx vitest run tests/integration/routes/auditLog.organizationContext.test.ts tests/unit/views/admin/OrganizationContextWorkerOperationsView.honesty.test.tsx tests/unit/views/admin/AuditLogView.honesty.test.tsx --maxWorkers=1 --maxConcurrency=1
```

Result:

`PASS`

```bash
npx eslint server/src/routes/auditLog.routes.ts src/services/api.ts src/services/api/organizationContextWorker.api.ts src/views/admin/OrganizationContextWorkerOperationsPanel.tsx src/views/admin/OrganizationContextWorkerOperationsView.tsx tests/integration/routes/auditLog.organizationContext.test.ts tests/unit/views/admin/OrganizationContextWorkerOperationsView.honesty.test.tsx tests/unit/views/admin/AuditLogView.honesty.test.tsx --quiet
```

Result:

`PASS`

```bash
npx vitest run tests/unit/views/admin/OrganizationContextWorkerOperationsView.honesty.test.tsx tests/unit/views/admin/AuditLogView.honesty.test.tsx --maxWorkers=1 --maxConcurrency=1
```

Result:

`PASS`

```bash
npx eslint src/services/api/organizationContextWorker.api.ts src/views/admin/OrganizationContextWorkerOperationsPanel.tsx src/views/admin/OrganizationContextWorkerOperationsView.tsx tests/unit/views/admin/OrganizationContextWorkerOperationsView.honesty.test.tsx tests/unit/views/admin/AuditLogView.honesty.test.tsx --quiet
```

Result:

`PASS`

```bash
npx vitest run tests/unit/views/admin/OrganizationContextWorkerOperationsView.honesty.test.tsx --maxWorkers=1 --maxConcurrency=1
```

Result:

`PASS`

```bash
npx eslint src/services/api/organizationContextWorker.api.ts src/views/admin/OrganizationContextWorkerOperationsView.tsx src/views/admin/OrganizationContextWorkerOperationsPanel.tsx tests/unit/views/admin/OrganizationContextWorkerOperationsView.honesty.test.tsx --quiet
```

Result:

`PASS`

```bash
npx vitest run tests/unit/backend/services/contextDocumentService.storage-usage.test.ts --maxWorkers=1 --maxConcurrency=1
```

Result:

`PASS`

```bash
npx vitest run tests/unit/views/admin/OrganizationContextWorkerOperationsView.honesty.test.tsx --maxWorkers=1 --maxConcurrency=1
```

Result:

`PASS`

```bash
npx eslint server/src/services/organizationContext/ContextDocumentService.ts src/services/api/organizationContextWorker.api.ts src/views/admin/OrganizationContextWorkerOperationsView.tsx src/views/admin/OrganizationContextWorkerOperationsPanel.tsx tests/unit/backend/services/contextDocumentService.storage-usage.test.ts tests/unit/views/admin/OrganizationContextWorkerOperationsView.honesty.test.tsx --quiet
```

Result:

`PASS`

```bash
npx vitest run tests/unit/backend/services/contextDocumentService.storage-usage.test.ts --maxWorkers=1 --maxConcurrency=1
```

Result:

`PASS`

```bash
npx vitest run tests/unit/views/admin/OrganizationContextWorkerOperationsView.honesty.test.tsx --maxWorkers=1 --maxConcurrency=1
```

Result:

`PASS`

```bash
npx eslint server/src/services/organizationContext/ContextDocumentService.ts src/services/api/organizationContextWorker.api.ts src/views/admin/OrganizationContextWorkerOperationsPanel.tsx src/views/admin/OrganizationContextWorkerOperationsView.tsx tests/unit/backend/services/contextDocumentService.storage-usage.test.ts tests/unit/views/admin/OrganizationContextWorkerOperationsView.honesty.test.tsx --quiet
```

Result:

`PASS`

```bash
npx vitest run tests/unit/backend/services/contextDocumentService.storage-usage.test.ts --maxWorkers=1 --maxConcurrency=1
```

Result:

`PASS`

```bash
npx vitest run tests/unit/views/admin/OrganizationContextWorkerOperationsView.honesty.test.tsx --maxWorkers=1 --maxConcurrency=1
```

Result:

`PASS`

```bash
npx eslint server/src/services/organizationContext/ContextDocumentService.ts src/services/api/organizationContextWorker.api.ts src/views/admin/OrganizationContextWorkerOperationsPanel.tsx src/views/admin/OrganizationContextWorkerOperationsView.tsx tests/unit/backend/services/contextDocumentService.storage-usage.test.ts tests/unit/views/admin/OrganizationContextWorkerOperationsView.honesty.test.tsx --quiet
```

Result:

`PASS`

```bash
npx vitest run tests/unit/backend/services/contextDocumentService.storage-usage.test.ts --maxWorkers=1 --maxConcurrency=1
```

Result:

`PASS`

```bash
npx vitest run tests/unit/views/admin/OrganizationContextWorkerOperationsView.honesty.test.tsx --maxWorkers=1 --maxConcurrency=1
```

Result:

`PASS`

```bash
npx eslint server/src/services/organizationContext/ContextDocumentService.ts src/services/api/organizationContextWorker.api.ts src/views/admin/OrganizationContextWorkerOperationsPanel.tsx tests/unit/backend/services/contextDocumentService.storage-usage.test.ts tests/unit/views/admin/OrganizationContextWorkerOperationsView.honesty.test.tsx --quiet
```

Result:

`PASS`

```bash
npx vitest run tests/unit/backend/services/contextDocumentService.storage-usage.test.ts --maxWorkers=1 --maxConcurrency=1
```

Result:

`PASS`

```bash
npx vitest run tests/unit/views/admin/OrganizationContextWorkerOperationsView.honesty.test.tsx --maxWorkers=1 --maxConcurrency=1
```

Result:

`PASS`

```bash
npx eslint server/src/services/organizationContext/ContextDocumentService.ts src/services/api/organizationContextWorker.api.ts src/views/admin/OrganizationContextWorkerOperationsPanel.tsx tests/unit/backend/services/contextDocumentService.storage-usage.test.ts tests/unit/views/admin/OrganizationContextWorkerOperationsView.honesty.test.tsx --quiet
```

Result:

`PASS`

```bash
npx vitest run tests/unit/backend/services/contextDocumentService.storage-usage.test.ts --maxWorkers=1 --maxConcurrency=1
```

Result:

`PASS`

```bash
npx vitest run tests/unit/views/admin/OrganizationContextWorkerOperationsView.honesty.test.tsx --maxWorkers=1 --maxConcurrency=1
```

Result:

`PASS`

```bash
npx eslint server/src/services/organizationContext/ContextDocumentService.ts src/services/api/organizationContextWorker.api.ts src/views/admin/OrganizationContextWorkerOperationsPanel.tsx tests/unit/backend/services/contextDocumentService.storage-usage.test.ts tests/unit/views/admin/OrganizationContextWorkerOperationsView.honesty.test.tsx --quiet
```

Result:

`PASS`

```bash
npx vitest run tests/unit/backend/services/contextDocumentService.storage-usage.test.ts --maxWorkers=1 --maxConcurrency=1
```

Result:

`PASS`

```bash
npx vitest run tests/unit/views/admin/OrganizationContextWorkerOperationsView.honesty.test.tsx --maxWorkers=1 --maxConcurrency=1
```

Result:

`PASS`

```bash
npx eslint server/src/services/organizationContext/ContextDocumentService.ts src/services/api/organizationContextWorker.api.ts src/views/admin/OrganizationContextWorkerOperationsPanel.tsx src/views/admin/OrganizationContextWorkerOperationsView.tsx tests/unit/backend/services/contextDocumentService.storage-usage.test.ts tests/unit/views/admin/OrganizationContextWorkerOperationsView.honesty.test.tsx --quiet
```

Result:

`PASS`

```bash
npx vitest run tests/integration/routes/documentsRoutes.no-stubs.test.ts --maxWorkers=1 --maxConcurrency=1
```

Result:

`PASS`

```bash
npx vitest run tests/components/documents/DocumentSidePanel.processing-status.test.tsx --maxWorkers=1 --maxConcurrency=1
```

Result:

`PASS`

```bash
npx eslint server/src/services/organizationContext/ContextDocumentService.ts src/components/documents/DocumentSidePanel.tsx src/types/core.ts tests/integration/routes/documentsRoutes.no-stubs.test.ts tests/components/documents/DocumentSidePanel.processing-status.test.tsx --quiet
```

Result:

`PASS`

```bash
npx vitest run tests/integration/routes/documentsRoutes.no-stubs.test.ts --maxWorkers=1 --maxConcurrency=1
```

Result:

`PASS`

```bash
npx vitest run tests/components/documents/DocumentSidePanel.processing-status.test.tsx --maxWorkers=1 --maxConcurrency=1
```

Result:

`PASS`

```bash
npx eslint server/src/services/organizationContext/ContextDocumentService.ts server/src/routes/documents.routes.ts src/services/api.ts src/components/documents/DocumentSidePanel.tsx src/types/core.ts tests/integration/routes/documentsRoutes.no-stubs.test.ts tests/components/documents/DocumentSidePanel.processing-status.test.tsx --quiet
```

Result:

`PASS`

```bash
npx vitest run tests/components/documents/DocumentSidePanel.processing-status.test.tsx --maxWorkers=1 --maxConcurrency=1
```

Result:

`PASS`

```bash
npx eslint src/components/documents/DocumentSidePanel.tsx tests/components/documents/DocumentSidePanel.processing-status.test.tsx --quiet
```

Result:

`PASS`

```bash
npx vitest run tests/integration/routes/documentsRoutes.no-stubs.test.ts --maxWorkers=1 --maxConcurrency=1
```

Result:

`PASS`

```bash
npx vitest run tests/components/documents/DocumentSidePanel.processing-status.test.tsx --maxWorkers=1 --maxConcurrency=1
```

Result:

`PASS`

```bash
npx eslint server/src/services/organizationContext/ContextDocumentService.ts src/components/documents/DocumentSidePanel.tsx src/types/core.ts tests/integration/routes/documentsRoutes.no-stubs.test.ts tests/components/documents/DocumentSidePanel.processing-status.test.tsx --quiet
```

Result:

`PASS`

Note: an initial `npm test -- --run ...` command accidentally invoked the repository-wide `test:all` script instead of a focused Vitest file run. That surfaced unrelated pre-existing suite failures in research session, billing validator, role guard, permission middleware, and auth middleware tests. The accidental full runs were stopped and replaced with direct focused `npx vitest run ...` commands above.

---

## 5. Gate 2 Status

Current Gate 2 status:

`PASS_WITH_P2`

What improved:

- accepted uploads now have durable processing job traceability,
- processor version and pipeline type are recorded,
- ready/degraded lifecycle is now test-covered,
- ready and degraded uploads now persist normalized Markdown/JSON,
- chunks now carry baseline and native source locator metadata,
- processing jobs now identify the inline worker boundary,
- queued jobs can be processed through a callable worker entrypoint,
- retry and dead-letter outcomes are now explicit and test-covered,
- processing jobs now have claim/lock metadata,
- admins can inspect worker jobs and trigger one explicit worker run,
- explicit worker runs are audit logged,
- stale worker locks can be recovered during explicit worker runs,
- admin UI shows processing jobs and provides a confirmation-gated worker control,
- worker queue summary is available to API and UI,
- scheduler tick has an explicit disabled-by-default contract,
- worker dashboard now shows queue posture and last run read-back,
- cron/worker script exists and remains disabled by default,
- external queue backend option is visible but safely unconfigured,
- queue backend readiness now differentiates missing configuration from configured-but-not-yet-executable external queues,
- admin worker operations are extracted into a dedicated component boundary,
- queue adapter capabilities now distinguish enqueue support from local consume support,
- Admin settings now have a standalone Operations surface for worker posture and explicit runs,
- processing queue summary is now org-scoped from the admin route,
- worker lease and dead-letter posture is visible without exposing raw internals,
- dead-letter recovery now exists as an explicit confirmation-gated and audited requeue flow,
- stale-lock recovery now exists as a separate explicit and audited admin action,
- external queue enqueue now has a concrete callable adapter contract,
- worker locks now have explicit lease expiry,
- external consumer tick contract exists without hidden processing,
- worker claiming now skips jobs when compare-and-swap loses the race,
- external consumer dependency is split into enqueue URL and pull URL,
- active processing renews worker leases before expensive extraction/indexing work,
- finished/retry/dead-letter jobs clear stale lock and lease metadata,
- external queue pull can now process identifier-only messages through the DB ledger,
- external queue ack/backoff contracts now exist and remain honest when URLs are missing,
- manual worker runs return audit read-back identifiers,
- Operations UI now displays audit identifiers, queue action counts, and queue attention reasons,
- worker operations UI now uses a typed API module instead of adding to the untyped client surface,
- external queue outcomes are recorded as lineage audit events without broker internals,
- external queue outcome lineage is filterable by target type and workflow,
- Operations UI includes a queue outcome audit drill-down,
- Operations UI shows queue summary timing and lease duration,
- Operations UI can refresh queue outcome audit without running the worker,
- Operations UI shows recent manual worker run history from audit logs,
- Operations UI summarizes queue outcome attention and backoff counts,
- external queue consumer now verifies broker messages against ledger identity before processing,
- backoff/error queue outcomes now create attention lineage even when broker backoff succeeds,
- Operations UI can filter queue outcome audit to attention events without mutating worker state,
- external queue adapter payloads are now contract-tested for pull, ack, and backoff,
- worker run history now correlates audit events with queue pulled/ack/backoff counts and attention reason,
- broker deployment readiness now distinguishes incomplete production broker setup from enqueue readiness,
- worker run history can now be filtered by all, attention, and backoff runs,
- async cutover readiness now reports blockers before any execution mode change,
- locator upgrade plan now distinguishes baseline locators from remaining document/media locator work,
- upload execution now has a two-flag guarded async switch with an explicit rollback env,
- guarded async uploads can enqueue and return `processing` without running extraction inline,
- async upload read-back now correlates processing documents with queued/retry worker jobs,
- external worker deployment verification now requires safe health URL and release-gate marker evidence,
- external worker health probe can be enabled as an opt-in safe live read-back,
- Operations now has a read-only async upload refresh loop and manual status refresh action,
- document library responses now expose safe processing-state read-back for async uploads,
- stale processing documents now surface as user-facing attention states instead of silent spinners,
- the document side panel can refresh processing status without triggering worker execution or document mutations,
- stale document states now include recovery guidance and an admin Operations handoff,
- admin handoff is navigation-only and keeps worker recovery behind explicit audited admin controls,
- stale processing attention now has read-only visibility receipt read-back,
- stale processing documents now show whether audited recovery activity has already been recorded,
- processing attention can now be explicitly acknowledged and persisted per user/document,
- acknowledgement is separated from worker recovery so viewing or acknowledging does not mutate processing jobs,
- the system is closer to an async worker model without breaking current upload flows.

Why not full `PASS`:

- upload extraction still runs inline by default for compatibility,
- there is no always-on worker process yet,
- cron script exists but deployment scheduling remains an operations task,
- worker operations now have a standalone Admin section, but no deep-linked dedicated route outside the Admin module shell yet,
- external queue enqueue, pull, ack, and backoff contracts exist, but production broker adapters still need deployment-specific implementation,
- external worker health probing is opt-in and does not yet include latency/SLO history,
- stale processing attention is currently a read-only signal; remediation still happens through Admin Operations,
- requeued jobs are scheduled for retry, but actual processing still depends on explicit worker execution or configured cron,
- PDF/DOCX still use baseline character locators, not page/paragraph locators,
- PPT/PPTX still lacks slide-level extraction and slide locators,
- images and audio are not yet normalized into region/timestamp locators,
- PPTX remains honest degraded instead of understood.

Recommended next milestone:

`Release Gate - Staging async cutover validation, worker deployment verification, and modality locator backlog decision`
