import { describe, expect, it } from 'vitest';

describe('day173 root Vitest DB_TYPE contract', () => {
  it('uses the DB_TYPE selected by the root config', () => {
    expect(process.env.DB_TYPE).toBe(process.env.DAY173_EXPECTED_DB_TYPE || 'sqlite');
  });
});
