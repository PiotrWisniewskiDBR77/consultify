import { describe, expect, it } from 'vitest';

import {
  LEGACY_INITIATIVE_STATUSES,
  LEGACY_STATUS_PROJECTIONS,
  projectLegacyInitiativeStatus,
} from '@/contracts/initiatives-execution/legacyCompatibility';

describe('legacy Initiative status compatibility', () => {
  it('covers all thirteen runtime statuses exactly once', () => {
    expect(LEGACY_INITIATIVE_STATUSES).toHaveLength(13);
    expect(new Set(LEGACY_INITIATIVE_STATUSES).size).toBe(13);
    expect(Object.keys(LEGACY_STATUS_PROJECTIONS).sort()).toEqual(
      [...LEGACY_INITIATIVE_STATUSES].sort()
    );
  });

  it('keeps BLOCKED as execution state plus critical overlay, not a target lifecycle', () => {
    expect(projectLegacyInitiativeStatus('BLOCKED')).toMatchObject({
      lifecycle: 'IN_EXECUTION',
      executionState: 'ACTIVE',
      executionHealth: 'CRITICAL',
    });
  });

  it('refuses to guess legacy CANCELLED semantics', () => {
    expect(projectLegacyInitiativeStatus('CANCELLED')).toMatchObject({
      confidence: 'AMBIGUOUS',
      disposition: 'MIGRATION_REVIEW_REQUIRED',
    });
  });

  it('does not infer unknown status values', () => {
    expect(projectLegacyInitiativeStatus('completed')).toBeNull();
    expect(projectLegacyInitiativeStatus('UNKNOWN_FUTURE_STATUS')).toBeNull();
  });
});
