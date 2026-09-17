import { afterEach, describe, expect, it } from 'vitest';

import { isCapacityDemandFromTasksEnabled } from '../capacityDemandFromTasksFlag.js';

const saved = process.env.CAPACITY_DEMAND_FROM_TASKS;

afterEach(() => {
  if (saved === undefined) delete process.env.CAPACITY_DEMAND_FROM_TASKS;
  else process.env.CAPACITY_DEMAND_FROM_TASKS = saved;
});

describe('CAPACITY_DEMAND_FROM_TASKS', () => {
  it('is OFF in code and enables only for exact true', () => {
    delete process.env.CAPACITY_DEMAND_FROM_TASKS;
    expect(isCapacityDemandFromTasksEnabled()).toBe(false);
    process.env.CAPACITY_DEMAND_FROM_TASKS = 'false';
    expect(isCapacityDemandFromTasksEnabled()).toBe(false);
    process.env.CAPACITY_DEMAND_FROM_TASKS = 'true';
    expect(isCapacityDemandFromTasksEnabled()).toBe(true);
  });
});
