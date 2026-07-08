/**
 * WARSTWA B (live/staging) — test kontraktu DB na żywej apce (2026-07-08, odtworzony po przerwie).
 * Per narzędzie: POST /tools (create) → PUT /tools/:id (fill fixturą) → GET (readback:
 * czy sekcje persystują z właściwymi kluczami?) → adapter+silnik na odczytanych danych
 * (grounded?) → cleanup (DELETE lub oznaczenie prefiksem do skryptu sprzątającego).
 *
 * demo=twarz: wszystkie sesje mają nazwę z prefiksem HARNESS_PREFIX → cleanup je kasuje.
 * NIE uruchamiaj na demo. Domyślnie staging. Sprawdź tier LLM PRZED (osobno).
 *
 * Uruchom:
 *   STAGING_API_URL="https://api.staging.consultify.app/api" \
 *   STAGING_JWT="<bearer>" \
 *   TOOLS_HARNESS_PROJECT_ID="<opcjonalny project>" \
 *   npx tsx src/config/__toolsHarnessB_live.mts
 *
 * Bez STAGING_JWT skrypt tylko wypisze plan (dry-run) i NIE uderzy w API.
 */
import { VSM_FIXTURE } from './vsmbuilder/fixture.ts';
import { buildVsmConclusionPrompt, toVsmSession } from './vsmbuilder/index.ts';
import { CONSTRAINT_FIXTURE } from './constraintcontrol/fixture.ts';
import { buildConstraintConclusionPrompt, toConstraintSession } from './constraintcontrol/index.ts';
import { CONTROL_TOWER_FIXTURE } from './controltower/fixture.ts';
import { buildControlTowerConclusionPrompt, toControlTowerSession } from './controltower/index.ts';
import { AUTOMATION_PIPELINE_FIXTURE } from './automationpipeline/fixture.ts';
import { buildAutomationPipelineConclusionPrompt, toAutomationPipelineSession } from './automationpipeline/index.ts';
import { ROBOTICS_FIXTURE } from './roboticsfeasibility/fixture.ts';
import { buildRoboticsConclusionPrompt, toRoboticsSession } from './roboticsfeasibility/index.ts';
import { LOGISTICS_FIXTURE } from './logisticsautomation/fixture.ts';
import { buildLogisticsConclusionPrompt, toLogisticsSession } from './logisticsautomation/index.ts';
import { INTEGRATION_FIXTURE } from './integrationdiagnostic/fixture.ts';
import { buildIntegrationConclusionPrompt, toIntegrationSession } from './integrationdiagnostic/index.ts';
import { DATA_INVENTORY_FIXTURE } from './datainventory/fixture.ts';
import { buildDataInventoryConclusionPrompt, toDataInventorySession } from './datainventory/index.ts';
import { DECISION_FIXTURE } from './decisionengine/fixture.ts';
import { buildDecisionConclusionPrompt, toDecisionSession } from './decisionengine/index.ts';
import { VALUE_POOL_FIXTURE } from './digitalvaluepool/fixture.ts';
import { buildValuePoolConclusionPrompt, toValuePoolSession } from './digitalvaluepool/index.ts';
import { LEGACY_FIXTURE } from './legacyanalyzer/fixture.ts';
import { buildLegacyConclusionPrompt, toLegacySession } from './legacyanalyzer/index.ts';

const HARNESS_PREFIX = '[HARNESS-TEST]';
const API = process.env.STAGING_API_URL ?? '';
const JWT = process.env.STAGING_JWT ?? '';
const PROJECT_ID = process.env.TOOLS_HARNESS_PROJECT_ID;
// WAF na demo/staging wymaga realnego User-Agent (finding_demo_deploy_and_api_retest)
const UA = 'Mozilla/5.0 (Consultify-ToolsHarness) AppleWebKit/537.36';

type Tool = {
  toolType: string;
  fixture: { context?: unknown; sections: Record<string, unknown[]> };
  grounded: (sections: Record<string, unknown[]>) => string | null;
};

const TOOLS: Tool[] = [
  { toolType: 'vsm-builder', fixture: VSM_FIXTURE as any, grounded: (s) => buildVsmConclusionPrompt(toVsmSession(s), true) },
  { toolType: 'constraint-control', fixture: CONSTRAINT_FIXTURE as any, grounded: (s) => buildConstraintConclusionPrompt(toConstraintSession(s), true) },
  { toolType: 'control-tower', fixture: CONTROL_TOWER_FIXTURE as any, grounded: (s) => buildControlTowerConclusionPrompt(toControlTowerSession(s), true) },
  { toolType: 'automation-pipeline', fixture: AUTOMATION_PIPELINE_FIXTURE as any, grounded: (s) => buildAutomationPipelineConclusionPrompt(toAutomationPipelineSession(s), true) },
  { toolType: 'robotics-feasibility', fixture: ROBOTICS_FIXTURE as any, grounded: (s) => buildRoboticsConclusionPrompt(toRoboticsSession(s), true) },
  { toolType: 'logistics-automation', fixture: LOGISTICS_FIXTURE as any, grounded: (s) => buildLogisticsConclusionPrompt(toLogisticsSession(s), true) },
  { toolType: 'integration-diagnostic', fixture: INTEGRATION_FIXTURE as any, grounded: (s) => buildIntegrationConclusionPrompt(toIntegrationSession(s), true) },
  { toolType: 'data-inventory', fixture: DATA_INVENTORY_FIXTURE as any, grounded: (s) => buildDataInventoryConclusionPrompt(toDataInventorySession(s), true) },
  { toolType: 'decision-engine', fixture: DECISION_FIXTURE as any, grounded: (s) => buildDecisionConclusionPrompt(toDecisionSession(s), true) },
  { toolType: 'digital-value-pool', fixture: VALUE_POOL_FIXTURE as any, grounded: (s) => buildValuePoolConclusionPrompt(toValuePoolSession(s), true) },
  { toolType: 'legacy-analyzer', fixture: LEGACY_FIXTURE as any, grounded: (s) => buildLegacyConclusionPrompt(toLegacySession(s), true) },
];

const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${JWT}`, 'User-Agent': UA });
const log = (...a: unknown[]) => console.log(...a);

async function runOne(t: Tool): Promise<{ ok: boolean; note: string }> {
  const createRes = await fetch(`${API}/tools`, {
    method: 'POST', headers: headers(),
    body: JSON.stringify({ toolType: t.toolType, name: `${HARNESS_PREFIX} ${t.toolType}`, ...(PROJECT_ID ? { projectId: PROJECT_ID } : {}) }),
  });
  if (!createRes.ok) return { ok: false, note: `CREATE ${createRes.status}` };
  const { id } = await createRes.json() as { id: string };
  try {
    const putRes = await fetch(`${API}/tools/${id}`, {
      method: 'PUT', headers: headers(),
      body: JSON.stringify({ answers: { context: (t.fixture as any).context ?? {}, sections: t.fixture.sections }, status: 'IN_PROGRESS', completionPercent: 80 }),
    });
    if (!putRes.ok) return { ok: false, note: `PUT ${putRes.status}` };
    const getRes = await fetch(`${API}/tools/${id}`, { headers: headers() });
    if (!getRes.ok) return { ok: false, note: `GET ${getRes.status}` };
    const row = await getRes.json() as any;
    const persisted = row?.answers?.sections ?? row?.answers_json?.sections ?? {};
    const expectedKeys = Object.keys(t.fixture.sections);
    const missing = expectedKeys.filter((k) => !(k in persisted));
    if (missing.length) return { ok: false, note: `READBACK brak kluczy: ${missing.join(',')}` };
    const prompt = t.grounded(persisted);
    if (!prompt || prompt.length < 500) return { ok: false, note: 'ENGINE null/pusty na danych z DB' };
    return { ok: true, note: `grounded len=${prompt.length}` };
  } finally {
    await fetch(`${API}/tools/${id}`, { method: 'DELETE', headers: headers() }).catch(() => {});
  }
}

(async () => {
  if (!API || !JWT) {
    log('DRY-RUN (brak STAGING_API_URL/STAGING_JWT). Plan testu B-DB dla 11 narzędzi:');
    for (const t of TOOLS) log(`  • ${t.toolType}: POST /tools → PUT (sekcje: ${Object.keys(t.fixture.sections).join(', ')}) → GET readback → engine grounded → DELETE`);
    log(`\nUruchom z STAGING_API_URL + STAGING_JWT. Cleanup awaryjny: server/scripts/cleanup-test-tool-sessions.ts (prefiks "${HARNESS_PREFIX}").`);
    return;
  }
  let pass = 0;
  for (const t of TOOLS) {
    const r = await runOne(t).catch((e) => ({ ok: false, note: String((e as Error).message) }));
    log(`${r.ok ? 'PASS' : 'FAIL'}  ${t.toolType.padEnd(24)} ${r.note}`);
    if (r.ok) pass++;
  }
  log(`\n${pass}/${TOOLS.length} PASS (B-DB live)`);
  process.exit(pass === TOOLS.length ? 0 : 1);
})();
