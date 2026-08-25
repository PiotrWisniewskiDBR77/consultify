import { describe, expect, it } from 'vitest';

import { mapLegacyFinanceStatusToV3 } from '../FinanceHub';

describe('mapLegacyFinanceStatusToV3', () => {
  it.each([
    ['DRAFT', 'DRAFT'],
    ['REVIEW', 'IN_REVIEW'],
    ['APPROVED', 'APPROVED'],
  ] as const)('maps legacy %s to %s', (legacy, expected) => {
    expect(mapLegacyFinanceStatusToV3(legacy)).toBe(expected);
  });
});
