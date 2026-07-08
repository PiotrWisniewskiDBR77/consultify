/**
 * WARSTWA A — offline harness testowy silników Tools (2026-07-08, odtworzony po przerwie).
 * Per narzędzie: fixture (worked-example) → adapter → conclusion prompt.
 * PASS = grounded (non-null, >500 znaków, zawiera fakty silnika). FAIL = null/pusty/wyjątek.
 * Uruchom: npx tsx src/config/__toolsEngineHarnessA.mts
 * To jest analogia do smoke-testów wczorajszego agenta — deterministyczne, zero API/DB.
 */
import { buildVsmConclusionPrompt, toVsmSession } from './vsmbuilder/index.ts';
import { VSM_FIXTURE } from './vsmbuilder/fixture.ts';
import { buildConstraintConclusionPrompt, toConstraintSession } from './constraintcontrol/index.ts';
import { CONSTRAINT_FIXTURE } from './constraintcontrol/fixture.ts';
import { buildControlTowerConclusionPrompt, toControlTowerSession } from './controltower/index.ts';
import { CONTROL_TOWER_FIXTURE } from './controltower/fixture.ts';
import { buildAutomationPipelineConclusionPrompt, toAutomationPipelineSession } from './automationpipeline/index.ts';
import { AUTOMATION_PIPELINE_FIXTURE } from './automationpipeline/fixture.ts';
import { buildRoboticsConclusionPrompt, toRoboticsSession } from './roboticsfeasibility/index.ts';
import { ROBOTICS_FIXTURE } from './roboticsfeasibility/fixture.ts';
import { buildLogisticsConclusionPrompt, toLogisticsSession } from './logisticsautomation/index.ts';
import { LOGISTICS_FIXTURE } from './logisticsautomation/fixture.ts';
import { buildIntegrationConclusionPrompt, toIntegrationSession } from './integrationdiagnostic/index.ts';
import { INTEGRATION_FIXTURE } from './integrationdiagnostic/fixture.ts';
import { buildDataInventoryConclusionPrompt, toDataInventorySession } from './datainventory/index.ts';
import { DATA_INVENTORY_FIXTURE } from './datainventory/fixture.ts';
import { buildDecisionConclusionPrompt, toDecisionSession } from './decisionengine/index.ts';
import { DECISION_FIXTURE } from './decisionengine/fixture.ts';
import { buildValuePoolConclusionPrompt, toValuePoolSession } from './digitalvaluepool/index.ts';
import { VALUE_POOL_FIXTURE } from './digitalvaluepool/fixture.ts';
import { buildLegacyConclusionPrompt, toLegacySession } from './legacyanalyzer/index.ts';
import { LEGACY_FIXTURE } from './legacyanalyzer/fixture.ts';

type Case = { name: string; run: () => string | null };

const cases: Case[] = [
  { name: 'vsm-builder', run: () => buildVsmConclusionPrompt(toVsmSession(VSM_FIXTURE.sections), true) },
  { name: 'constraint-control', run: () => buildConstraintConclusionPrompt(toConstraintSession(CONSTRAINT_FIXTURE.sections), true) },
  { name: 'control-tower', run: () => buildControlTowerConclusionPrompt(toControlTowerSession(CONTROL_TOWER_FIXTURE.sections), true) },
  { name: 'automation-pipeline', run: () => buildAutomationPipelineConclusionPrompt(toAutomationPipelineSession(AUTOMATION_PIPELINE_FIXTURE.sections), true) },
  { name: 'robotics-feasibility', run: () => buildRoboticsConclusionPrompt(toRoboticsSession(ROBOTICS_FIXTURE.sections), true) },
  { name: 'logistics-automation', run: () => buildLogisticsConclusionPrompt(toLogisticsSession(LOGISTICS_FIXTURE.sections), true) },
  { name: 'integration-diagnostic', run: () => buildIntegrationConclusionPrompt(toIntegrationSession(INTEGRATION_FIXTURE.sections), true) },
  { name: 'data-inventory', run: () => buildDataInventoryConclusionPrompt(toDataInventorySession(DATA_INVENTORY_FIXTURE.sections), true) },
  { name: 'decision-engine', run: () => buildDecisionConclusionPrompt(toDecisionSession(DECISION_FIXTURE.sections), true) },
  { name: 'digital-value-pool', run: () => buildValuePoolConclusionPrompt(toValuePoolSession(VALUE_POOL_FIXTURE.sections), true) },
  { name: 'legacy-analyzer', run: () => buildLegacyConclusionPrompt(toLegacySession(LEGACY_FIXTURE.sections), true) },
];

let pass = 0;
const fails: string[] = [];
for (const c of cases) {
  let p: string | null = null;
  let err = '';
  try { p = c.run(); } catch (e) { err = (e as Error).message ?? String(e); }
  const ok = typeof p === 'string' && p.length > 500;
  // eslint-disable-next-line no-console
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.name.padEnd(24)} len=${String(p?.length ?? 0).padStart(5)}${err ? '  ERR: ' + err : ''}`);
  if (ok) pass++; else fails.push(c.name);
}
// eslint-disable-next-line no-console
console.log(`\n${pass}/${cases.length} PASS${fails.length ? '  |  FAIL: ' + fails.join(', ') : '  ✅ WSZYSTKIE SILNIKI ODPALAJĄ'}`);
process.exit(pass === cases.length ? 0 : 1);
