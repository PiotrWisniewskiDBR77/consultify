import { describe, expect, it, vi } from 'vitest';

import { PostgresInitiativeReader } from '../postgresInitiativeReader.js';

describe('capacity scenario readback', () => {
  it('propagates a database failure instead of turning it into scenario not found', async () => {
    const databaseFailure = new Error('database connection refused');
    const reader = new PostgresInitiativeReader({
      query: vi.fn().mockRejectedValue(databaseFailure),
    } as never);

    await expect(reader.findCapacityScenario('org-1', 'capacity-1')).rejects.toBe(databaseFailure);
  });
});
