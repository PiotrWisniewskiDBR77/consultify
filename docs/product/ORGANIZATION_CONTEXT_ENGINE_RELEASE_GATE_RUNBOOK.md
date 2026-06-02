# Organization Context Engine - Release Gate Runbook

> Companion to `ORGANIZATION_CONTEXT_ENGINE_SOURCE_OF_TRUTH.md` §17 and `ORGANIZATION_CONTEXT_ENGINE_IMPLEMENTATION_PLAN.md` Phase 8.
>
> Purpose: deterministic deployment, rollback and incident-response procedure for the
> Organization Context Engine when promoting from staging to production.

## 0. Prerequisites

- All eight gates report PASS in `ORGANIZATION_CONTEXT_ENGINE_IMPLEMENTATION_PLAN.md`.
- Smoke green: `npm run smoke:organization-context-engine` (38/38).
- Cross-app audit green: `npm run audit:organization-context-cross-app` (6/6).
- Unit + integration tests green for `tests/unit/backend/services/contextDocumentService*.test.ts`,
  `tests/unit/backend/services/contextRetrievalService.test.ts`,
  `tests/unit/backend/services/interviewInsightService.lineage*.test.ts`.
- Synthetic load test PASS against staging:
  `LOADTEST_ORG_ID=... LOADTEST_USER_ID=... LOADTEST_DOC_IDS=... npm run loadtest:organization-context-engine`
- `.env.staging.example` and `.env.production.example` contain all `ORG_CONTEXT_*` keys.

## 1. Deployment Order (cutover)

The engine has two execution modes. Inline mode (default) runs extraction in the upload
request. Async worker mode (Stage 7) decouples upload from worker processing.

### 1.1 Inline mode rollout (low-traffic environments)

1. Apply DB migrations (no separate step; tables created via `ensureSchema` on first
   request to context endpoints).
2. Set in environment:
   ```
   ORG_CONTEXT_WORKER_SCHEDULER_ENABLED=true   # cron tick will recover stale locks
   ORG_CONTEXT_UPLOAD_PROCESSING_MODE=inline
   ORG_CONTEXT_UPLOAD_ASYNC_CUTOVER_ENABLED=false
   ORG_CONTEXT_QUEUE_BACKEND=db_ledger
   ```
3. Deploy single web process. Verify `/api/admin-operations/organization-context/queue-summary`
   reports `queueBackendReady=true`, `schedulerEnabled=true`.

### 1.2 Async worker mode rollout (recommended for production)

1. Provision dedicated worker process (Railway service, Heroku worker, k8s deployment).
   Use `Procfile.organization-context-worker`:
   ```
   web: npm run start
   worker: npm run worker:organization-context:loop
   ```
2. Set on BOTH web and worker:
   ```
   ORG_CONTEXT_WORKER_SCHEDULER_ENABLED=true
   ORG_CONTEXT_UPLOAD_PROCESSING_MODE=async_worker
   ORG_CONTEXT_UPLOAD_ASYNC_CUTOVER_ENABLED=true
   ORG_CONTEXT_QUEUE_BACKEND=db_ledger          # or external (see 1.3)
   ORG_CONTEXT_WORKER_LIMIT=10
   ```
3. Optional external broker (1.3) before flipping cutover flag.
4. Smoke: upload a sample document via `/api/documents/upload`. Verify status becomes
   `processing` then `ready` within the worker tick interval.

### 1.3 External queue (Redis BullMQ / SQS HTTP adapter)

1. Provision broker. Implement HTTP adapter exposing four endpoints:
   - `POST {ORG_CONTEXT_EXTERNAL_QUEUE_URL}` → enqueue `{jobId, documentId, organizationId}`
   - `GET {ORG_CONTEXT_EXTERNAL_QUEUE_PULL_URL}?max=N` → returns array of messages
   - `POST {ORG_CONTEXT_EXTERNAL_QUEUE_ACK_URL}` → ack receipt
   - `POST {ORG_CONTEXT_EXTERNAL_QUEUE_BACKOFF_URL}` → re-queue with delay
2. Set:
   ```
   ORG_CONTEXT_QUEUE_BACKEND=external
   ORG_CONTEXT_EXTERNAL_QUEUE_URL=https://broker/enqueue
   ORG_CONTEXT_EXTERNAL_QUEUE_PULL_URL=https://broker/pull
   ORG_CONTEXT_EXTERNAL_QUEUE_ACK_URL=https://broker/ack
   ORG_CONTEXT_EXTERNAL_QUEUE_BACKOFF_URL=https://broker/backoff
   ORG_CONTEXT_EXTERNAL_QUEUE_TOKEN=<secret>
   ORG_CONTEXT_EXTERNAL_WORKER_HEALTH_URL=https://broker/health
   ORG_CONTEXT_EXTERNAL_WORKER_DEPLOYMENT_VERIFIED=true
   ORG_CONTEXT_EXTERNAL_WORKER_HEALTH_PROBE_ENABLED=true
   ```
3. Verify queue summary shows `brokerDeploymentReady=true` and
   `externalWorkerDeploymentVerification.deploymentMarkerPresent=true`.

## 2. Image OCR / Audio Transcription enablement

Both default to `disabled` (honest degraded UI: images become `ocr_required`, audio
becomes `policy_blocked`).

To enable:

```
ORG_CONTEXT_IMAGE_OCR_PROVIDER=tesseract        # OSS, in-process
# OR
ORG_CONTEXT_IMAGE_OCR_PROVIDER=openai_vision    # paid, requires OPENAI_API_KEY

ORG_CONTEXT_AUDIO_TRANSCRIPTION_PROVIDER=openai_whisper
ORG_CONTEXT_AUDIO_MINUTES_PER_ORG_PER_MONTH=600
```

Cost containment: audit `aiCostControlService` AI Budget controls; image/audio
processing emits `context_document_storage_events` rows for accounting.

## 3. Retention enablement

```
ORG_CONTEXT_RETENTION_TTL_DAYS=365
ORG_CONTEXT_RETENTION_HARD_DELETE_GRACE_DAYS=14
```

Effect: nightly cron at 03:30 soft-deletes documents older than TTL, then hard-deletes
after grace period. Lineage events for `context_document_soft_deleted` /
`context_document_hard_deleted` are preserved with `metadata_json.source_deleted=true`.

## 4. Canary procedure

### 4.1 Staging canary (48 hours)

1. Deploy build to staging.
2. Enable scheduler (`ORG_CONTEXT_WORKER_SCHEDULER_ENABLED=true`).
3. Run synthetic load test daily:
   ```
   LOADTEST_DURATION_MS=300000 LOADTEST_CONCURRENCY=20 \
     npm run loadtest:organization-context-engine
   ```
4. Monitor for 48 hours:
   - Sentry: zero P0/P1 incidents.
   - Queue summary: `staleClaimedCount=0`, `deadLetterCount` stable.
   - DB: `organization_context_lineage_events` row growth matches AI generation rate.
5. PASS criteria: zero P0/P1, p95 retrieval latency below
   `ORG_CONTEXT_RETRIEVAL_P95_BUDGET_MS` (default 5000ms).

### 4.2 Production canary (24 hours, 5% traffic)

1. Route 5% of production traffic to canary build (load balancer weight).
2. Monitor for 24 hours:
   - Sentry P0/P1: zero.
   - Worker dead-letter queue: zero growth.
   - Audit log: `organization_context.*` events present.
3. PASS criteria: same as staging plus user-reported issues triaged.

## 5. Rollback procedure

### 5.1 Soft rollback (disable async upload, keep code)

```
ORG_CONTEXT_UPLOAD_PROCESSING_MODE=inline
ORG_CONTEXT_UPLOAD_ASYNC_CUTOVER_ENABLED=false
```

Effect: new uploads run inline; in-flight worker jobs continue. No data loss.

### 5.2 Disable scheduler (worker freeze)

```
ORG_CONTEXT_WORKER_SCHEDULER_ENABLED=false
```

Effect: no new processing ticks; queued jobs stay queued until re-enabled.
`/api/admin-operations` UI shows `scheduler_disabled` honestly.

### 5.3 Disable image / audio modality

```
ORG_CONTEXT_IMAGE_OCR_PROVIDER=disabled
ORG_CONTEXT_AUDIO_TRANSCRIPTION_PROVIDER=disabled
```

Effect: new image uploads → `ocr_required`, new audio → `policy_blocked`.
Existing chunks remain queryable.

### 5.4 Hard rollback (deploy previous build)

1. Set scheduler disabled (5.2).
2. Wait 60s for in-flight worker jobs to drain.
3. Deploy previous git ref.
4. Re-enable scheduler.

## 6. Monitoring & Alerts

Required alert thresholds (configure in observability stack):

| Metric | Warn | Page |
|---|---|---|
| `organization_context_processing_jobs.dead_letter_count` | > 0 | > 5 |
| Stale processing jobs ( > 30 min ) | > 0 | > 10 |
| Queue depth (`pendingCount + claimedCount`) | > 100 | > 500 |
| Retrieval p95 latency | > 3000 ms | > 5000 ms |
| Image OCR error rate | > 1% | > 5% |
| Audio Whisper error rate | > 1% | > 5% |
| Audio minutes consumed vs quota | > 80% | > 95% |

## 7. Incident response

For any P0 incident (cross-tenant leakage, silent execution, hidden learning):

1. Disable scheduler immediately (`ORG_CONTEXT_WORKER_SCHEDULER_ENABLED=false`).
2. Review `organization_context_lineage_events` for the affected target ids.
3. If unauthorized retrieval suspected: query
   ```
   SELECT * FROM organization_context_lineage_events
   WHERE organization_id = '<affected>'
     AND used_chunks_json::text LIKE '%<other-org>%'
   ```
4. Notify Security team. Snapshot DB. Rotate `ORG_CONTEXT_EXTERNAL_QUEUE_TOKEN` if
   external broker involved.

## 8. Definition of GO

Per implementation plan §5:

- All Gates 0-8 PASS in `ORGANIZATION_CONTEXT_ENGINE_IMPLEMENTATION_PLAN.md`
- Full repo regression green (`npm test`)
- Smoke green (`npm run smoke:organization-context-engine`)
- Cross-app audit green (`npm run audit:organization-context-cross-app`)
- Staging canary 48h: zero P0/P1
- Production canary 24h at 5%: zero P0/P1
- Monitoring + runbook published (this document)
- CTO/Product confirms readiness per Source Of Truth §17
