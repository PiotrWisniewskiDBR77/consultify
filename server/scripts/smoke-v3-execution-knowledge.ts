#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';

type Check = { name: string; pass: boolean };

function read(root: string, relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function includesAll(content: string, needles: string[]): boolean {
  return needles.every((needle) => content.includes(needle));
}

function main(): void {
  const root = process.cwd();
  const checks: Check[] = [];

  const executionHub = read(root, 'src/components/Execution/ExecutionHub.tsx');
  const executionTimeline = read(root, 'src/components/Execution/ExecutionTimelineView.tsx');
  const executionControlRoutes = read(root, 'server/src/routes/executionControl.routes.ts');
  const executionController = read(root, 'server/src/controllers/ExecutionController.ts');
  const riskSignalsPanel = read(root, 'src/components/Execution/RiskSignalsPanel.tsx');
  const externalRagProvider = read(root, 'server/src/services/ai/externalRagProvider.ts');
  const knowledgeRoutes = read(root, 'server/src/routes/knowledge.routes.ts');
  const knowledgeService = read(root, 'server/src/services/KnowledgeService.ts');

  checks.push({
    name: 'G02 execution hub exposes summary, reporting, and management tabs',
    pass: includesAll(executionHub, [
      "id: 'list' as ModuleTab",
      "id: 'reports' as ModuleTab",
      "id: 'people_change' as ModuleTab",
      "execution.tabs.reports",
      "execution.tabs.peopleChange",
    ]),
  });

  checks.push({
    name: 'G02 reporting and management surfaces include action queue and missing-plan handling',
    pass: includesAll(executionHub, [
      "filter.value === 'missing_dates'",
      'kpi_deviation_no_plan',
      'renderActionCenter()',
      'ExecutionWorkloadView',
      "t('execution.reports.title', 'Execution reports')",
    ]),
  });

  checks.push({
    name: 'G02 timeline updates persist through execution control API with audit trail',
    pass: includesAll(executionHub, [
      "fetch('/api/execution-control/timeline-update'",
      'handleTimelineUpdate',
      'planned_start_date',
      'planned_end_date',
    ]) && includesAll(executionControlRoutes, [
      "router.post(\n  '/timeline-update'",
      "router.get(\n  '/audit-log'",
      'execution_audit_log',
      'change_reason',
    ]),
  });

  checks.push({
    name: 'G02 execution control exposes closed-loop workout endpoints',
    pass: includesAll(executionControlRoutes, [
      "'/workarounds'",
      "'/workarounds/:id/advance'",
      "'/workarounds/:id/create-mitigation-task'",
      "'/workarounds/:id/verify'",
      'buildWorkaroundFromSignal',
      'advanceWorkaround',
    ]),
  });

  checks.push({
    name: 'G02 execution action queue aggregates overdue, risk, communication, and KPI-plan gaps',
    pass: includesAll(executionController, [
      "type: 'decision_overdue' as const",
      "type: 'risk_high' as const",
      "type: 'comm_overdue' as const",
      "type: 'kpi_deviation_no_plan' as const",
      'counts: {',
    ]),
  });

  checks.push({
    name: 'G02 risk signals are visible from execution reporting workspace',
    pass: includesAll(executionTimeline, [
      'riskSignals',
      'delaySignals',
      'computeTimelineWarnings',
      'validateInitiativeDependencies',
    ]) && includesAll(riskSignalsPanel, [
      "/api/execution-control/risk-signals?",
      '/api/execution-control/risk-signals/dismiss',
      'suggestedAction',
      'execution_risk_signal_viewed',
    ]),
  });

  checks.push({
    name: 'N04 external RAG adapter supports upsert, delete, and filtered search',
    pass: includesAll(externalRagProvider, [
      'export interface ExternalRagProvider',
      'upsertDocument(document: ExternalRagDocument)',
      'deleteDocument(docKey: string)',
      'search(',
      'organizationId',
      'projectId',
      'EXTERNAL_RAG_SOURCE_TYPE',
    ]),
  });

  checks.push({
    name: 'N04 provider persists doc metadata and chunk embeddings through knowledge indexer',
    pass: includesAll(externalRagProvider, [
      'knowledgeIndexer.insertDocument',
      'knowledgeIndexer.insertChunk',
      'generateEmbedding(chunk.content)',
      'docKey',
      'external-rag/',
    ]),
  });

  checks.push({
    name: 'N04 case knowledge capture workflow exposes review and publish states',
    pass: includesAll(knowledgeRoutes, [
      "/candidates/:id/status",
      'project_id is required',
      '/candidates/by-project/:projectId',
      'status = (req.query.status as string) || \'pending\'',
    ]) && includesAll(knowledgeService, [
      'CREATE TABLE IF NOT EXISTS knowledge_candidates',
      "status TEXT DEFAULT 'pending'",
      'updateCandidateStatus',
      'getApprovedIdeas',
      'linkIdeaToProject',
    ]),
  });

  const failed = checks.filter((check) => !check.pass);

  console.log('\n[smoke-v3-execution-knowledge] Summary:');
  for (const check of checks) {
    console.log(` - ${check.pass ? 'OK' : 'FAIL'} ${check.name}`);
  }

  if (failed.length > 0) {
    throw new Error(`Smoke failed: ${failed.map((item) => item.name).join(', ')}`);
  }

  console.log('\n[smoke-v3-execution-knowledge] Contract checks passed.');
}

try {
  main();
} catch (error) {
  console.error('[smoke-v3-execution-knowledge] Failed:', (error as Error)?.message || error);
  process.exit(1);
}
