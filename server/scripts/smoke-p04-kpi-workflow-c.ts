/**
 * P04-C static smoke — verifies P04 artifacts and code patterns
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(import.meta.dirname || __dirname, '../..');
let pass = 0;
let fail = 0;

function check(label: string, ok: boolean) {
  if (ok) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.error(`  ❌ ${label}`); }
}

function fileContains(rel: string, needle: string): boolean {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) return false;
  return fs.readFileSync(full, 'utf-8').includes(needle);
}

console.log('\n=== P04-C Smoke ===\n');

check('Contract test exists', fs.existsSync(path.join(ROOT, 'tests/integration/p04-kpi-workflow.contract.test.ts')));
check('Evidence doc exists', fs.existsSync(path.join(ROOT, 'docs/product/work-packets/cursor-work/final_master/evidence/P04_BC_VERIFICATION_2026-03-31.md')));
check('Service has createKpiSignal', fileContains('server/src/services/v8/resultsROIService.ts', 'createKpiSignal'));
check('Service has createKpiNextAction', fileContains('server/src/services/v8/resultsROIService.ts', 'createKpiNextAction'));
check('Service has getKpiWorkflowStatus', fileContains('server/src/services/v8/resultsROIService.ts', 'getKpiWorkflowStatus'));
check('Routes wire reconciliation POST', fileContains('server/src/routes/v8/results.routes.ts', '/reconciliations'));
check('Routes wire signals', fileContains('server/src/routes/v8/results.routes.ts', '/signals'));
check('Routes wire next-actions', fileContains('server/src/routes/v8/results.routes.ts', '/next-actions'));
check('Routes wire workflow-status', fileContains('server/src/routes/v8/results.routes.ts', '/workflow-status'));
check('Migration exists', fs.existsSync(path.join(ROOT, 'server/migrations/20260331_p04b_kpi_signals_next_actions.sql')));

console.log(`\n${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
