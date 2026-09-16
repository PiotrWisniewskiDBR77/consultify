/**
 * Read-only M1a receipt for an existing plan scenario.
 *
 * Usage:
 *   DB_TYPE=postgres MOCK_DB=false DATABASE_URL=postgresql://... \
 *   npx tsx scripts/dev/m1-plan-task-demand-readback.ts <organization-id> <plan-scenario-id>
 */
import DbPromise from '../../server/src/utils/DbPromise.js';
import {
  readPlanTaskDemand,
  type PlanDemandPeriod,
} from '../../server/src/services/workload/planTaskDemandService.js';

interface StoredPlan {
  payload_json:
    | string
    | {
        periods?: PlanDemandPeriod[];
        windows?: Array<{ initiativeId?: string }>;
      };
}

async function main(): Promise<void> {
  const organizationId = String(process.argv[2] || '').trim();
  const scenarioId = String(process.argv[3] || '').trim();
  if (!organizationId || !scenarioId)
    throw new Error('organization id and plan scenario id required');

  const stored = await DbPromise.get<StoredPlan>(
    `SELECT payload_json
       FROM ie_aggregate_state
      WHERE organization_id=? AND aggregate_type='plan_scenario' AND aggregate_id=?`,
    [organizationId, scenarioId]
  );
  if (!stored) throw new Error('plan scenario not found in organization scope');
  const payload =
    typeof stored.payload_json === 'string' ? JSON.parse(stored.payload_json) : stored.payload_json;
  const periods = Array.isArray(payload.periods) ? payload.periods : [];
  const initiativeIds = Array.isArray(payload.windows)
    ? payload.windows.map((window) => String(window.initiativeId || '').trim()).filter(Boolean)
    : [];
  const result = await readPlanTaskDemand(organizationId, initiativeIds, periods, {
    asOf: new Date().toISOString(),
  });
  const taskIds = [
    ...new Set(result.cells.flatMap((cell) => cell.contributions.map((item) => item.taskId))),
  ];
  const knownHours = result.cells.reduce((sum, cell) => sum + (cell.demandHours ?? 0), 0);
  const receipt = {
    organizationId,
    scenarioId,
    knowledgeState: result.knowledgeState,
    initiativeCount: result.initiativeIds.length,
    periodCount: result.periods.length,
    cellCount: result.cells.length,
    taskCount: taskIds.length,
    knownDemandHours: Math.round(knownHours * 100) / 100,
    incompleteTasks: result.incompleteTasks,
    cells: result.cells,
  };
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
  if (receipt.knowledgeState !== 'KNOWN') process.exitCode = 2;
}

main()
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => setTimeout(() => process.exit(process.exitCode ?? 0), 25));
