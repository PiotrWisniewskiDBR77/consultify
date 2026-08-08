import { v4 as uuidv4 } from 'uuid';

import { processDueWave8AgentSchedules } from '../services/wave8AgentRuntimeService.js';
import logger from '../utils/Logger.js';

export interface Wave8AgentScheduleTickResult {
  processed: number;
  workerId: string;
}

/** Durable sweep. Database leases make overlapping ticks and restarts safe. */
export async function runWave8AgentScheduleTick(): Promise<Wave8AgentScheduleTickResult> {
  const workerId = `wave8-cron-${process.pid}-${uuidv4()}`;
  const runs = await processDueWave8AgentSchedules({ workerId });
  if (runs.length > 0) {
    logger.info('[Wave8AgentScheduleJob] Tick completed', { workerId, processed: runs.length });
  }
  return { workerId, processed: runs.length };
}
