import { describe, expect, it } from 'vitest';

import { normalizeExecutionArrayEnvelope } from '@/components/Execution/executionPayloadGuards';

describe('normalizeExecutionArrayEnvelope', () => {
  it('returns direct arrays unchanged', () => {
    expect(normalizeExecutionArrayEnvelope([{ id: 'a' }], ['signals'])).toEqual([{ id: 'a' }]);
  });

  it('reads arrays from top-level keyed envelopes', () => {
    expect(
      normalizeExecutionArrayEnvelope(
        {
          signals: [{ id: 'risk-1' }],
          count: 1,
        },
        ['signals']
      )
    ).toEqual([{ id: 'risk-1' }]);
  });

  it('reads arrays from nested v8 data envelopes', () => {
    expect(
      normalizeExecutionArrayEnvelope(
        {
          data: {
            warnings: [{ initiativeId: 'i-1' }],
            total: 1,
          },
        },
        ['warnings']
      )
    ).toEqual([{ initiativeId: 'i-1' }]);
  });

  it('returns an empty array for non-array payload drift', () => {
    expect(
      normalizeExecutionArrayEnvelope(
        {
          data: {
            alerts: { userId: 'u-1' },
          },
        },
        ['alerts']
      )
    ).toEqual([]);
  });
});
