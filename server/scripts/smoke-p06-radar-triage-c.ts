/**
 * P06-C static smoke — verifies P06 artifacts and code patterns
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

console.log('\n=== P06-C Smoke ===\n');

check('Contract test exists', fs.existsSync(path.join(ROOT, 'tests/integration/p06-radar-triage.contract.test.ts')));
check('Evidence doc exists', fs.existsSync(path.join(ROOT, 'docs/product/work-packets/cursor-work/final_master/evidence/P06_BC_VERIFICATION_2026-03-31.md')));
check('Triage service exists', fs.existsSync(path.join(ROOT, 'server/src/services/v8/radarTriageService.ts')));
check('Service has createTriageSignal', fileContains('server/src/services/v8/radarTriageService.ts', 'createTriageSignal'));
check('Service has executeHandoff', fileContains('server/src/services/v8/radarTriageService.ts', 'executeHandoff'));
check('Service has computeScore', fileContains('server/src/services/v8/radarTriageService.ts', 'computeScore'));
check('Service has checkHardGates', fileContains('server/src/services/v8/radarTriageService.ts', 'checkHardGates'));
check('Service has 5 categories', fileContains('server/src/services/v8/radarTriageService.ts', 'external_change'));
check('Routes exist', fs.existsSync(path.join(ROOT, 'server/src/routes/v8/radar-triage.routes.ts')));
check('Routes mounted in index', fileContains('server/src/routes/v8/index.ts', 'radar-triage'));
check('Migration exists', fs.existsSync(path.join(ROOT, 'server/migrations/20260331_v8_radar_triage_p06b.sql')));

console.log(`\n${pass} passed, ${fail} failed\n`);
if (fail > 0) process.exit(1);
