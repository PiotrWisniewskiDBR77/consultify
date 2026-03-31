/**
 * P07-C smoke — static code checks for Notebook canon artifacts.
 * Run: npx tsx server/scripts/smoke-p07-notebook-c.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');
const SERVER = path.join(ROOT, 'server', 'src');

let pass = 0;
let fail = 0;

function check(label: string, ok: boolean) {
  if (ok) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    console.error(`  ✗ ${label}`);
  }
}

function fileExists(rel: string): boolean {
  return fs.existsSync(path.join(ROOT, rel));
}

function fileContains(rel: string, ...patterns: string[]): boolean {
  const fp = path.join(ROOT, rel);
  if (!fs.existsSync(fp)) return false;
  const content = fs.readFileSync(fp, 'utf-8');
  return patterns.every((p) => content.includes(p));
}

console.log('\n=== P07-C Smoke: Notebook Canon Artifacts ===\n');

console.log('--- Canon ---');
check('notebookCanon.ts exists', fileExists('server/src/services/v8/notebookCanon.ts'));
check('Canon exports P07_CAPTURE_ENTRIES', fileContains('server/src/services/v8/notebookCanon.ts', 'P07_CAPTURE_ENTRIES'));
check('Canon exports P07_PROVENANCE_LANGUAGE', fileContains('server/src/services/v8/notebookCanon.ts', 'P07_PROVENANCE_LANGUAGE'));
check('Canon exports P07_ATTACHMENT_LIFECYCLE_STATES', fileContains('server/src/services/v8/notebookCanon.ts', 'P07_ATTACHMENT_LIFECYCLE_STATES'));
check('Canon exports P07_ATTACHMENT_ERROR_TAXONOMY', fileContains('server/src/services/v8/notebookCanon.ts', 'P07_ATTACHMENT_ERROR_TAXONOMY'));
check('Canon exports P07_SEARCH_BASELINE', fileContains('server/src/services/v8/notebookCanon.ts', 'P07_SEARCH_BASELINE'));
check('Canon exports P07_HANDOFF_TARGETS', fileContains('server/src/services/v8/notebookCanon.ts', 'P07_HANDOFF_TARGETS'));
check('Canon exports P07_ANTI_DUPLICATE_RULES', fileContains('server/src/services/v8/notebookCanon.ts', 'P07_ANTI_DUPLICATE_RULES'));
check('Canon exports P07_DEGRADED_SCENARIOS', fileContains('server/src/services/v8/notebookCanon.ts', 'P07_DEGRADED_SCENARIOS'));
check('Canon exports P07_ACCEPTANCE_CHECKLIST', fileContains('server/src/services/v8/notebookCanon.ts', 'P07_ACCEPTANCE_CHECKLIST'));

console.log('\n--- Handoff Service ---');
check('notebookHandoffService.ts exists', fileExists('server/src/services/v8/notebookHandoffService.ts'));
check('Handoff has buildHandoffCommon', fileContains('server/src/services/v8/notebookHandoffService.ts', 'buildHandoffCommon'));
check('Handoff has buildRadarHandoff', fileContains('server/src/services/v8/notebookHandoffService.ts', 'buildRadarHandoff'));
check('Handoff has buildInitiativeHandoff', fileContains('server/src/services/v8/notebookHandoffService.ts', 'buildInitiativeHandoff'));
check('Handoff has buildTeresaHandoff', fileContains('server/src/services/v8/notebookHandoffService.ts', 'buildTeresaHandoff'));
check('Handoff has validateHandoffPayload', fileContains('server/src/services/v8/notebookHandoffService.ts', 'validateHandoffPayload'));
check('Handoff has getHandoffTargets', fileContains('server/src/services/v8/notebookHandoffService.ts', 'getHandoffTargets'));

console.log('\n--- Search Service ---');
check('notebookSearchService.ts exists', fileExists('server/src/services/v8/notebookSearchService.ts'));
check('Search has parseOperatorHints', fileContains('server/src/services/v8/notebookSearchService.ts', 'parseOperatorHints'));
check('Search has searchNotebook', fileContains('server/src/services/v8/notebookSearchService.ts', 'searchNotebook'));
check('Search has buildSnippet', fileContains('server/src/services/v8/notebookSearchService.ts', 'buildSnippet'));
check('Search has getSearchContract', fileContains('server/src/services/v8/notebookSearchService.ts', 'getSearchContract'));
check('Search has semantic fallback', fileContains('server/src/services/v8/notebookSearchService.ts', 'semanticSearch'));

console.log('\n--- Routes ---');
check('notebook.routes.ts exists', fileExists('server/src/routes/v8/notebook.routes.ts'));
check('Routes has GET /search', fileContains('server/src/routes/v8/notebook.routes.ts', '/search'));
check('Routes has POST /handoff/radar', fileContains('server/src/routes/v8/notebook.routes.ts', '/handoff/radar'));
check('Routes has POST /handoff/inicjatywy', fileContains('server/src/routes/v8/notebook.routes.ts', '/handoff/inicjatywy'));
check('Routes has POST /handoff/teresa', fileContains('server/src/routes/v8/notebook.routes.ts', '/handoff/teresa'));
check('Routes has POST /handoff/validate', fileContains('server/src/routes/v8/notebook.routes.ts', '/handoff/validate'));
check('Routes has GET /attachment-lifecycle', fileContains('server/src/routes/v8/notebook.routes.ts', '/attachment-lifecycle'));
check('Routes has GET /contract', fileContains('server/src/routes/v8/notebook.routes.ts', '/contract'));

console.log('\n--- V8 Router Mount ---');
check('v8/index.ts imports notebookRoutes', fileContains('server/src/routes/v8/index.ts', 'notebookRoutes'));
check('v8/index.ts mounts /notebook', fileContains('server/src/routes/v8/index.ts', "'/notebook'"));

console.log('\n--- Tests ---');
check('Contract test exists', fileExists('tests/integration/p07-notebook-canon.contract.test.ts'));
check('Contract test imports notebookCanon', fileContains('tests/integration/p07-notebook-canon.contract.test.ts', 'notebookCanon'));
check('Contract test imports validateHandoffPayload', fileContains('tests/integration/p07-notebook-canon.contract.test.ts', 'validateHandoffPayload'));
check('Contract test imports parseOperatorHints', fileContains('tests/integration/p07-notebook-canon.contract.test.ts', 'parseOperatorHints'));

console.log('\n--- Evidence & Locks ---');
check('Evidence P07_BC exists', fileExists('docs/product/work-packets/cursor-work/final_master/evidence/P07_BC_VERIFICATION_2026-03-31.md'));
check('Lock P07-B exists', fileExists('docs/product/work-packets/cursor-work/final_master/locks/P07-B.md'));
check('Lock P07-C exists', fileExists('docs/product/work-packets/cursor-work/final_master/locks/P07-C.md'));

console.log(`\n=== P07-C Smoke: ${pass} pass / ${fail} fail / ${pass + fail} total ===\n`);
process.exit(fail > 0 ? 1 : 0);
