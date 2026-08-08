import { processDueRecoveryExperiments } from '../services/results/kpiRecoveryExperimentService.js';
import { all as dbAll } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

export async function runRecoveryExperimentRemeasurementTick() {
  const due = await processDueRecoveryExperiments({
    all: (sql: string, params?: unknown[]) => dbAll(sql, params, { fallback: false }),
  } as any);
  if (due.length)
    logger.info('[RecoveryExperimentRemeasurementJob] Due experiments claimed', {
      count: due.length,
    });
  return { processed: due.length };
}
