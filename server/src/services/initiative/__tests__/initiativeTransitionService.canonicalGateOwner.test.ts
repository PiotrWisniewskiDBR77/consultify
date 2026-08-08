import { describe, expect, it, vi } from 'vitest';

import type { PgTransactionClient } from '../../../utils/queryHelpers.js';
import { hasApprovedGateDecision } from '../initiativeTransitionService.js';

describe('initiativeTransitionService canonical lifecycle gate owner', () => {
  it('does not let an approved row in the generic decisions table unlock a transition', async () => {
    let genericDecisionReads = 0;
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('pg_advisory_xact_lock')) return { rows: [], rowCount: 1 };
      if (sql.includes('initiative_lifecycle_gate_decisions')) {
        return { rows: [], rowCount: 0 };
      }
      if (/\bFROM\s+decisions\b/i.test(sql)) {
        genericDecisionReads += 1;
        return {
          rows: [
            {
              id: 'legacy-approved',
              status: 'approved',
              decision_maker_id: 'human-1',
              deadline: '2030-01-01T00:00:00.000Z',
            },
          ],
          rowCount: 1,
        };
      }
      throw new Error(`unexpected query: ${sql}`);
    });

    const result = await hasApprovedGateDecision(
      'org-1',
      'initiative-1',
      'GOVERNANCE_DECISION_MAKING',
      { query } as PgTransactionClient
    );

    expect(result).toEqual({ ok: false, decisionId: null });
    expect(genericDecisionReads).toBe(0);
    expect(query.mock.calls.map(([sql]) => sql)).toEqual([
      expect.stringContaining('pg_advisory_xact_lock'),
      expect.stringContaining('initiative_lifecycle_gate_decisions'),
    ]);
  });
});
