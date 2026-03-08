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

  const deepResearchService = read(root, 'server/src/services/ai/deepResearchService.ts');
  const researchLedgerSmoke = read(root, 'server/scripts/smoke-ai-research-ledger.ts');
  const aiRoutes = read(root, 'server/src/routes/ai.routes.ts');
  const agentAuditRoutes = read(root, 'server/src/routes/ai/agent-audit.routes.ts');
  const agentAuditStore = read(root, 'server/src/services/ai/agentAudit/agentAuditStore.ts');
  const agentAuditPanel = read(root, 'src/components/AIChat/AgentAudit/AgentAuditVerdictPanel.tsx');
  const messageRenderer = read(root, 'src/components/AIChat/MessageRenderer.tsx');
  const researchProgress = read(root, 'src/components/AIChat/ResearchProgress.tsx');

  checks.push({
    name: 'N08 deep research computes evidence coverage and unsupported claim rate',
    pass: includesAll(deepResearchService, [
      'evidenceCoverage',
      'unsupportedClaimRate',
      'citations',
      'sources',
      'metadata: {',
    ]),
  });

  checks.push({
    name: 'N08 research ledger smoke enforces citation coverage contract',
    pass: includesAll(researchLedgerSmoke, [
      'evaluateResearchLedgerContract',
      'citationCoverage',
      'unsupportedClaimRate',
      'expectedClaims',
    ]),
  });

  checks.push({
    name: 'N08 AI route streams and persists agent-audit research verdicts',
    pass: includesAll(aiRoutes, [
      "type: 'agent_audit_verdict'",
      'runAgentAudit({',
      'createAgentAuditRun({',
      'decisionContext',
      'reviews: auditOut.reviews',
    ]),
  });

  checks.push({
    name: 'N08 admin metrics expose research quality and source mix',
    pass: includesAll(agentAuditRoutes, [
      "router.get(\n  '/metrics'",
      'avgConflictRate',
      'gatesCount',
      'avgSources',
      'kb_snippet',
      'web_source',
    ]),
  });

  checks.push({
    name: 'N08 audit store persists findings, conflicts, and source counts',
    pass: includesAll(agentAuditStore, [
      'createAgentAuditRun',
      'sourcesCounts',
      'findingsTotal',
      'conflictsTotal',
      'activity_logs',
    ]),
  });

  checks.push({
    name: 'N08 viewer UI renders findings, sources, and conflicts with snippets',
    pass: includesAll(messageRenderer, [
      'activeReview.findings',
      'f.sourcesUsed',
      "s.type === 'kb_snippet'",
      "s.type === 'web_source'",
      'activeReview.conflicts',
    ]) && includesAll(agentAuditPanel, [
      'sourcesSummary',
      'kb_snippet',
      'web_source',
      'source.snippet',
      'conflicts:',
    ]),
  });

  checks.push({
    name: 'N08 research progress viewer exposes activity, queries, and source panels',
    pass: includesAll(researchProgress, [
      "activeTab, setActiveTab",
      "'queries' | 'activity' | 'sources'",
      'research.topSources',
      'research.noSourcesYet',
      'sources.length',
    ]),
  });

  const failed = checks.filter((check) => !check.pass);

  console.log('\n[smoke-v3-research-viewer] Summary:');
  for (const check of checks) {
    console.log(` - ${check.pass ? 'OK' : 'FAIL'} ${check.name}`);
  }

  if (failed.length > 0) {
    throw new Error(`Smoke failed: ${failed.map((item) => item.name).join(', ')}`);
  }

  console.log('\n[smoke-v3-research-viewer] Contract checks passed.');
}

try {
  main();
} catch (error) {
  console.error('[smoke-v3-research-viewer] Failed:', (error as Error)?.message || error);
  process.exit(1);
}
