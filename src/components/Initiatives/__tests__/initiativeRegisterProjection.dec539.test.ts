import { describe, expect, it } from 'vitest';

import { resolveInitiativeRegisterLifecycle } from '../initiativeRegisterColumns.shared';
import { toCanonicalInitiativeRegisterItemFromLegacyRow } from '../initiativeRegisterProjection';

describe('STAGE-1 / DEC-539 initiative register projection', () => {
  it('renders the persisted lifecycle stage instead of the seven-code compatibility status', () => {
    const row = toCanonicalInitiativeRegisterItemFromLegacyRow({
      id: 'initiative-1',
      name: 'Lifecycle truth',
      status: 'APPROVED',
      lifecycleStage: 'SCHEDULED',
    });

    expect(row.status).toBe('APPROVED');
    expect(row.displayStatus).toBe('SCHEDULED');
    expect((row as any).canonicalLifecyclePresentation).toBe(true);
    expect(resolveInitiativeRegisterLifecycle(row as any)).toBe('SCHEDULED');
  });

  it('falls back deterministically for a pre-migration row', () => {
    const row = toCanonicalInitiativeRegisterItemFromLegacyRow({
      id: 'initiative-2',
      name: 'Legacy row',
      status: 'PENDING_APPROVAL',
    });
    expect(resolveInitiativeRegisterLifecycle(row as any)).toBe('READY_FOR_DECISION');
  });
});
