#!/usr/bin/env tsx
/**
 * P28-B rollout smoke (static): weryfikuje obecność artefaktów wdrożenia workbench bez live DB.
 * Uruchom: npx tsx server/scripts/smoke-p28-workbench-b.ts
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function ok(name: string, pass: boolean): void {
  console.log(pass ? `✓ ${name}` : `✗ ${name}`);
  if (!pass) process.exitCode = 1;
}

function main(): void {
  const service = read('server/src/services/assessment/AssessmentWorkbenchService.ts');
  const routes = read('server/src/routes/v8/assessment.routes.ts');
  const migration = read('server/migrations/20260331_p28_workbench_p29_partner_program_ledger.sql');
  const e2e = read('server/src/services/assessment/__tests__/assessmentWorkbench.p28b-e2e.test.ts');

  ok('P28-B: buildWhatNextGuidance + P28_METHODOLOGY_PRESETS in service', service.includes('buildWhatNextGuidance') && service.includes('P28_METHODOLOGY_PRESETS'));
  ok('P28-B: methodology-preset + whatNext on GET workbench in routes', routes.includes('methodology-preset') && routes.includes('whatNext'));
  ok('P28-B: 409 score-proposal includes whatNext', routes.includes('whatNext: e.whatNext'));
  ok('Migration adds p28_workbench_v1', migration.includes('p28_workbench_v1'));
  ok('E2E test covers preset → blocked → evidence → complete → promotion', e2e.includes('P28_AWAITING_EVIDENCE') && e2e.includes('recordPromotion'));
}

main();
