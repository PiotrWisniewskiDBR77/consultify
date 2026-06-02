#!/usr/bin/env tsx
/**
 * Smoke check for the Organization Context Engine end-to-end wiring.
 *
 * Static smoke (no live HTTP): asserts that all source-of-truth requirements
 * are wired in code, env templates, scheduler, routes, and frontend surfaces.
 *
 * Usage:
 *   tsx server/scripts/smoke-organization-context-engine.ts
 *
 * Exit code 0 on full PASS, 1 on any check failure.
 */

import fs from 'node:fs';
import path from 'node:path';

type Check = { name: string; pass: boolean; detail?: string };

function readSafe(root: string, relativePath: string): string {
  try {
    return fs.readFileSync(path.join(root, relativePath), 'utf8');
  } catch {
    return '';
  }
}

function includesAll(content: string, needles: string[]): boolean {
  return needles.every((needle) => content.includes(needle));
}

function includesAny(content: string, needles: string[]): boolean {
  return needles.some((needle) => content.includes(needle));
}

function main(): void {
  const root = process.cwd();
  const service = readSafe(root, 'server/src/services/organizationContext/ContextDocumentService.ts');
  const routes = readSafe(root, 'server/src/routes/documents.routes.ts');
  const scheduler = readSafe(root, 'server/src/cron/Scheduler.ts');
  const envExample = readSafe(root, '.env.example');
  const envStaging = readSafe(root, '.env.staging.example');
  const envProd = readSafe(root, '.env.production.example');
  const workerOnce = readSafe(root, 'server/scripts/run-organization-context-worker-once.ts');
  const sourceOfTruth = readSafe(root, 'docs/product/ORGANIZATION_CONTEXT_ENGINE_SOURCE_OF_TRUTH.md');
  const implPlan = readSafe(root, 'docs/product/ORGANIZATION_CONTEXT_ENGINE_IMPLEMENTATION_PLAN.md');
  const stage2Doc = readSafe(
    root,
    'docs/product/ORGANIZATION_CONTEXT_ENGINE_STAGE_2_DOCUMENT_UNDERSTANDING.md'
  );
  const sidePanel = readSafe(root, 'src/components/documents/DocumentSidePanel.tsx');
  const apiClient = readSafe(root, 'src/services/api.ts');
  const interviewService = readSafe(root, 'server/src/services/InterviewInsightService.ts');

  const checks: Check[] = [
    {
      name: 'SoT document exists with multimodal contract',
      pass: includesAll(sourceOfTruth, [
        'Organization Context Engine',
        'understanding',
        'lineage',
        'tenant',
      ]),
    },
    {
      name: 'Implementation plan exists with all 9 stages',
      pass: includesAll(implPlan, [
        'Stage 0',
        'Stage 1',
        'Stage 2',
        'Stage 3',
        'Stage 4',
        'Stage 5',
        'Stage 6',
        'Stage 7',
        'Stage 8',
      ]),
    },
    {
      name: 'Stage 2 status doc exists',
      pass: stage2Doc.length > 1000,
    },
    {
      name: 'ContextDocumentService implements processing job ledger',
      pass: includesAll(service, [
        'organization_context_processing_jobs',
        'CONTEXT_PROCESSOR_MAX_ATTEMPTS',
        'CONTEXT_WORKER_LEASE_MS',
        'claimContextProcessingJob',
        'renewContextProcessingJobLease',
        'recoverStaleContextProcessingLocks',
      ]),
    },
    {
      name: 'ContextDocumentService implements lineage events table',
      pass: includesAll(service, [
        'organization_context_storage_events',
        'recordContextStorageUsage',
      ]),
    },
    {
      name: 'ContextDocumentService implements honest status vocabulary',
      pass: includesAll(service, [
        "'uploaded'",
        "'processing'",
        "'ready'",
        "'partial_ready'",
        "'ocr_required'",
        "'unreadable'",
        "'failed'",
        "'policy_blocked'",
        "'quota_blocked'",
      ]),
    },
    {
      name: 'ContextDocumentService implements queue backend selection',
      pass: includesAll(service, [
        'getConfiguredContextQueueBackend',
        'getContextQueueBackendReadiness',
        'db_ledger_v1',
        'external_queue_v1',
      ]),
    },
    {
      name: 'ContextDocumentService implements processing attention acknowledgement',
      pass: includesAll(service, [
        'organization_context_processing_attention_receipts',
        'acknowledgeProcessingAttention',
      ]),
    },
    {
      name: 'ContextDocumentService exposes locator upgrade plan with PDF/DOCX/PPTX baseline ready',
      pass: includesAll(service, [
        'getLocatorUpgradePlan',
        'baselineReady',
        'pdf_page_locators',
        'docx_paragraph_locators',
        'pptx_slide_locators',
      ]),
    },
    {
      name: 'ContextDocumentService implements per-format extractors with locators',
      pass: includesAll(service, [
        'extractPdfWithPageLocators',
        'extractDocxWithParagraphLocators',
        'extractPptxWithSlideLocators',
        'page_range',
        'paragraph_range',
        'slide_range',
      ]),
    },
    {
      name: 'ContextDocumentService rejects legacy DOC/PPT with policy_blocked',
      pass: includesAll(service, [
        'legacy_doc_format_not_supported_use_docx',
        'legacy_ppt_format_not_supported_use_pptx',
      ]),
    },
    {
      name: 'documents.routes.ts exposes upload + status + acknowledgement endpoints',
      pass: includesAll(routes, [
        '/upload',
        '/processing-attention/ack',
      ]),
    },
    {
      name: 'documents.routes.ts validates MIME types including images',
      pass: includesAll(routes, [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'image/png',
      ]),
    },
    {
      name: 'Scheduler.ts has organization context worker tick (job29)',
      pass: includesAll(scheduler, [
        'Organization Context Worker',
        'ORG_CONTEXT_WORKER_SCHEDULER_ENABLED',
        'processConfiguredContextDocumentWorkerTick',
      ]),
    },
    {
      name: 'Scheduler.ts has external queue consumer tick (job30)',
      pass: includesAll(scheduler, [
        'processExternalContextQueueConsumerTick',
        'ORG_CONTEXT_QUEUE_BACKEND',
      ]),
    },
    {
      name: 'Scheduler.ts has retention purge job (job31)',
      pass: includesAll(scheduler, [
        'purgeExpiredContextDocuments',
        'retention purge',
      ]),
    },
    {
      name: '.env.example documents organization context env vars',
      pass: includesAll(envExample, [
        'ORG_CONTEXT_WORKER_SCHEDULER_ENABLED',
        'ORG_CONTEXT_UPLOAD_PROCESSING_MODE',
        'ORG_CONTEXT_QUEUE_BACKEND',
        'ORG_CONTEXT_RETENTION_TTL_DAYS',
      ]),
    },
    {
      name: '.env.staging.example documents organization context env vars',
      pass: includesAll(envStaging, [
        'ORG_CONTEXT_WORKER_SCHEDULER_ENABLED',
        'ORG_CONTEXT_QUEUE_BACKEND',
        'ORG_CONTEXT_EXTERNAL_QUEUE_URL',
        'ORG_CONTEXT_IMAGE_OCR_PROVIDER',
        'ORG_CONTEXT_AUDIO_TRANSCRIPTION_PROVIDER',
      ]),
    },
    {
      name: '.env.production.example documents organization context env vars',
      pass: includesAll(envProd, [
        'ORG_CONTEXT_WORKER_SCHEDULER_ENABLED',
        'ORG_CONTEXT_QUEUE_BACKEND',
        'ORG_CONTEXT_RETENTION_TTL_DAYS',
        'ORG_CONTEXT_AUDIO_MINUTES_PER_ORG_PER_MONTH',
      ]),
    },
    {
      name: 'worker:organization-context:once script exists with explicit env guard',
      pass: includesAll(workerOnce, [
        'organization_context_worker_cron_tick_v1',
        'ORG_CONTEXT_WORKER_SCHEDULER_ENABLED',
        'processConfiguredContextDocumentWorkerTick',
      ]),
    },
    {
      name: 'DocumentSidePanel surfaces processing state and refresh',
      pass: includesAll(sidePanel, [
        'processingState',
        'attentionRequired',
        'Refresh',
      ]),
    },
    {
      name: 'API client exposes acknowledge processing attention',
      pass: includesAny(apiClient, [
        'acknowledgeDocumentProcessingAttention',
        '/processing-attention/ack',
      ]),
    },
    {
      name: 'Interview Insight wires lineage to organization_context_lineage_events',
      pass: includesAll(interviewService, [
        'organization_context_lineage_events',
        'recordInsightContextLineage',
      ]),
    },
    {
      name: 'Interview Insight builds context document pack from chunks (RAG)',
      pass: includesAll(interviewService, [
        'buildContextDocumentPack',
        'knowledge_chunks',
      ]),
    },
    {
      name: 'Interview Insight maps to Source Of Truth context workflow modes',
      pass: includesAll(interviewService, [
        'SOURCE_OF_TRUTH_CONTEXT_MODES',
        'mapInsightContextModeToWorkflowMode',
        'selected_material_only',
        'selected_material_plus_selected_context',
        'selected_material_plus_approved_org_context',
        'org_context_research_mode',
      ]),
    },
    {
      name: 'Shared ContextRetrievalService exists with all four workflow modes',
      pass: (() => {
        const file = readSafe(
          root,
          'server/src/services/organizationContext/ContextRetrievalService.ts'
        );
        return includesAll(file, [
          'CONTEXT_WORKFLOW_MODES',
          'retrieveContext',
          'recordContextRetrievalLineage',
          'selected_material_only',
          'selected_material_plus_selected_context',
          'selected_material_plus_approved_org_context',
          'org_context_research_mode',
          'organization_context_lineage_events',
        ]);
      })(),
    },
    {
      name: 'AI Chat wires shared ContextRetrievalService for attachments',
      pass: (() => {
        const aiRoutes = readSafe(root, 'server/src/routes/ai.routes.ts');
        return includesAll(aiRoutes, [
          'ContextRetrievalService',
          'ai_chat_context_retrieved',
          'recordContextRetrievalLineage',
        ]);
      })(),
    },
    {
      name: 'Shared ContextAssetSelector React component exists',
      pass: (() => {
        const file = readSafe(root, 'src/components/documents/ContextAssetSelector.tsx');
        return includesAll(file, [
          'ContextAssetSelector',
          'CONTEXT_WORKFLOW_MODES',
          'selected_material_only',
          'selected_material_plus_selected_context',
          'selected_material_plus_approved_org_context',
          'org_context_research_mode',
          'data-testid="context-asset-selector"',
        ]);
      })(),
    },
    {
      name: 'ContextDocumentService implements image OCR pipeline (tesseract + openai_vision)',
      pass: includesAll(service, [
        'extractImageWithOcr',
        'getImageOcrProvider',
        'tesseract',
        'openai_vision',
        'image_region',
        'untrusted_image_content',
      ]),
    },
    {
      name: 'ContextDocumentService implements audio transcription pipeline (whisper)',
      pass: includesAll(service, [
        'extractAudioWithTranscription',
        'getAudioTranscriptionProvider',
        'openai_whisper',
        'timestamp_range',
        'startMs',
        'endMs',
      ]),
    },
    {
      name: 'documents.routes.ts accepts image/webp and audio MIME types',
      pass: includesAll(routes, [
        'image/webp',
        'audio/mpeg',
        'audio/wav',
        'audio/m4a',
        "file.mimetype.startsWith('audio/')",
      ]),
    },
    {
      name: 'ContextDocumentService implements audio minutes quota pre-flight',
      pass: includesAll(service, [
        'getAudioMinutesQuotaPerOrg',
        'checkAudioMinutesQuota',
        'AUDIO_MINUTES_QUOTA_EXCEEDED',
      ]),
    },
    {
      name: 'ContextDocumentService implements retention purge with lineage preservation',
      pass: includesAll(service, [
        'purgeExpiredContextDocuments',
        'context_document_soft_deleted',
        'context_document_hard_deleted',
        'source_deleted',
        'ORG_CONTEXT_RETENTION_TTL_DAYS',
        'ORG_CONTEXT_RETENTION_HARD_DELETE_GRACE_DAYS',
      ]),
    },
    {
      name: 'Worker loop entrypoint exists for dedicated worker deployment',
      pass: (() => {
        const file = readSafe(
          root,
          'server/scripts/run-organization-context-worker-loop.ts'
        );
        return includesAll(file, [
          'organization_context_worker_loop_v1',
          'processConfiguredContextDocumentWorkerTick',
          'processExternalContextQueueConsumerTick',
          'SIGTERM',
        ]);
      })(),
    },
    {
      name: 'Procfile.organization-context-worker defines worker process',
      pass: (() => {
        const file = readSafe(root, 'Procfile.organization-context-worker');
        return includesAll(file, ['worker:', 'worker:organization-context:loop']);
      })(),
    },
    {
      name: 'Tenant-safe ContextCacheService exists with redis fallback',
      pass: (() => {
        const file = readSafe(
          root,
          'server/src/services/organizationContext/ContextCacheService.ts'
        );
        return includesAll(file, [
          'tenant:',
          'organization_id_required',
          'getCachedContextValue',
          'invalidateContextCacheForOrganization',
          "ORG_CONTEXT_CACHE_BACKEND",
        ]);
      })(),
    },
    {
      name: 'Synthetic load test script exists for retrieval p95 budget',
      pass: (() => {
        const file = readSafe(
          root,
          'server/scripts/loadtest-organization-context-engine.ts'
        );
        return includesAll(file, [
          'organization_context_engine_loadtest_v1',
          'ORG_CONTEXT_RETRIEVAL_P95_BUDGET_MS',
          'percentile',
        ]);
      })(),
    },
    {
      name: 'package.json exposes worker:loop and loadtest npm scripts',
      pass: (() => {
        const file = readSafe(root, 'package.json');
        return includesAll(file, [
          '"worker:organization-context:loop"',
          '"loadtest:organization-context-engine"',
          '"smoke:organization-context-engine"',
          '"audit:organization-context-cross-app"',
        ]);
      })(),
    },
    {
      name: 'ESLint config blocks frontend ingestion of pdfjs/mammoth/xlsx/tesseract',
      pass: (() => {
        const file = readSafe(root, 'eslint.config.js');
        return includesAll(file, [
          'no-restricted-imports',
          'pdfjs-dist',
          'tesseract.js',
          'mammoth',
          'xlsx',
          'Frontend OCR is forbidden',
        ]);
      })(),
    },
    {
      name: 'Cross-app audit script exists',
      pass: (() => {
        const file = readSafe(
          root,
          'server/scripts/audit-organization-context-cross-app.ts'
        );
        return includesAll(file, [
          'organization_context_engine_cross_app_audit_v1',
          'forbiddenImportPatterns',
          'recordContextRetrievalLineage',
        ]);
      })(),
    },
    {
      name: 'Release Gate runbook exists with rollback + canary procedures',
      pass: (() => {
        const file = readSafe(
          root,
          'docs/product/ORGANIZATION_CONTEXT_ENGINE_RELEASE_GATE_RUNBOOK.md'
        );
        return includesAll(file, [
          'Release Gate Runbook',
          'Staging canary',
          'Production canary',
          'Rollback procedure',
          'Definition of GO',
          'ORG_CONTEXT_UPLOAD_PROCESSING_MODE=inline',
        ]);
      })(),
    },
  ];

  const failed = checks.filter((c) => !c.pass);
  const summary = {
    contract: 'organization_context_engine_smoke_v1',
    total: checks.length,
    passed: checks.length - failed.length,
    failed: failed.length,
    failedChecks: failed.map((c) => c.name),
  };

  console.log(JSON.stringify(summary, null, 2));

  if (failed.length > 0) {
    console.error('Smoke FAILED for Organization Context Engine');
    process.exit(1);
  }
  console.log('Smoke PASS for Organization Context Engine');
}

main();
