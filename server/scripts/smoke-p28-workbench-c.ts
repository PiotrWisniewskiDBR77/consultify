#!/usr/bin/env tsx
/**
 * P28-C verification smoke (static): regresje + dowód rollout C.
 * Uruchom: npx tsx server/scripts/smoke-p28-workbench-c.ts
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
  const regression = read('server/src/services/assessment/__tests__/assessmentWorkbench.p28c-regression.test.ts');
  const evidence = read('docs/product/work-packets/cursor-work/final_master/evidence/P28_C_VERIFICATION_ROLLOUT_2026-03-31.md');
  const service = read('server/src/services/assessment/AssessmentWorkbenchService.ts');

  ok('P28-C: regression test file covers promotion guard + RUN_READ_ONLY', regression.includes('P28_PROMOTION_GUARD') && regression.includes('P28_RUN_READ_ONLY'));
  ok('P28-C: evidence doc documents rollback + staging', evidence.includes('Rollback') && evidence.includes('staging'));
  ok('P28-C: workbench still exposes read-only guards', service.includes('P28_RUN_READ_ONLY'));
}

main();
