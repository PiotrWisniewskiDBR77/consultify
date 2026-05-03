# Organization Context Engine Stage 2 Document Understanding

> Status: Stage 2L Partial Implementation v12  
> Date: 2026-05-03  
> Owner: Product + Engineering + Security  
> Canonical source: `docs/product/ORGANIZATION_CONTEXT_ENGINE_SOURCE_OF_TRUTH.md`  
> Implementation plan: `docs/product/ORGANIZATION_CONTEXT_ENGINE_IMPLEMENTATION_PLAN.md`  
> Previous gate: `docs/product/ORGANIZATION_CONTEXT_ENGINE_STAGE_1_SECURITY_HARDENING.md`

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

This is the first step toward the Stage 2 Document Understanding MVP. It does not yet move extraction to a real worker queue. It creates the durable processing job contract that a worker can later consume without changing upload semantics again.

Stage 2A-2L intentionally keep the current inline upload processing behavior so existing document library and Interview Insight Creator flows keep working. Stage 2D adds a callable worker entrypoint, Stage 2E adds admin control/observability, Stage 2F adds stale-lock recovery plus a visible admin UI control, Stage 2G adds queue summary plus a disabled-by-default scheduler tick contract, Stage 2H adds explicit cron wiring, Stage 2I separates queue readiness from worker execution while extracting a dedicated admin worker operations component, Stage 2J adds enqueue/consume capability reporting plus a standalone Admin > Operations surface, Stage 2K makes queue summary org-scoped with lease/dead-letter posture, and Stage 2L adds explicit dead-letter requeue. None of these starts a silent background process.

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

---

## 3. Tests Added / Updated

Files:

- `tests/integration/routes/documentsRoutes.no-stubs.test.ts`
- `tests/unit/backend/services/contextDocumentService.storage-usage.test.ts`
- `tests/integration/routes/auditLog.organizationContext.test.ts`
- `tests/unit/views/admin/AuditLogView.honesty.test.tsx`
- `tests/unit/views/admin/OrganizationContextWorkerOperationsView.honesty.test.tsx`

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
- the system is closer to an async worker model without breaking current upload flows.

Why not full `PASS`:

- upload extraction still runs inline for compatibility,
- there is no always-on worker process, concrete external queue backend, or distributed lock lease yet,
- cron script exists but deployment scheduling remains an operations task,
- worker operations now have a standalone Admin section, but no deep-linked dedicated route outside the Admin module shell yet,
- external queue readiness and capability reporting exist, but concrete external queue enqueue/consume implementation is still pending,
- stale-lock recovery still runs only through explicit worker execution, not through a dedicated stale-lock review action,
- requeued jobs are scheduled for retry, but actual processing still depends on explicit worker execution or configured cron,
- PDF/DOCX still use baseline character locators, not page/paragraph locators,
- PPT/PPTX still lacks slide-level extraction and slide locators,
- images and audio are not yet normalized into region/timestamp locators,
- PPTX remains honest degraded instead of understood.

Recommended next milestone:

`Stage 2M - Concrete external queue enqueue adapter and stale-lock review action`
