/** M1b rollout gate. Missing or any value other than exact `true` is OFF. */
export const isCapacityDemandFromTasksEnabled = (): boolean =>
  process.env.CAPACITY_DEMAND_FROM_TASKS === 'true';
