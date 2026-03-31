/**
 * P05-C static smoke — verifies P05 artifacts and code patterns
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

console.log('\n=== P05-C Smoke ===\n');

check('Contract test exists', fs.existsSync(path.join(ROOT, 'tests/integration/p05-finance-lane.contract.test.ts')));
check('Evidence doc exists', fs.existsSync(path.join(ROOT, 'docs/product/work-packets/cursor-work/final_master/evidence/P05_BC_VERIFICATION_2026-03-31.md')));
check('Lane service exists', fs.existsSync(path.join(ROOT, 'server/src/services/v8/financeLaneService.ts')));
check('Service has startLaneRun', fileContains('server/src/services/v8/financeLaneService.ts', 'startLaneRun'));
check('Service has advanceLaneStep', fileContains('server/src/services/v8/financeLaneService.ts', 'advanceLaneStep'));
check('Service has recordMutationAudit', fileContains('server/src/services/v8/financeLaneService.ts', 'recordMutationAudit'));
check('Service has createVersionSnapshot', fileContains('server/src/services/v8/financeLaneService.ts', 'createVersionSnapshot'));
check('Service has checkKpiLinkageCoherence', fileContains('server/src/services/v8/financeLaneService.ts', 'checkKpiLinkageCoherence'));
check('Routes wire lane endpoints', fileContains('server/src/routes/v8/finance.routes.ts', '/lane/start'));
check('Routes wire version endpoints', fileContains('server/src/routes/v8/finance.routes.ts', '/versions/snapshot'));
check('Migration exists', fs.existsSync(path.join(ROOT, 'server/migrations/20260331_v8_finance_lane_p05b.sql')));

console.log(`\n${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
