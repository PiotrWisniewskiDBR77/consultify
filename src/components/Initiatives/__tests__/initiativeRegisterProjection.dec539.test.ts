import { describe, expect, it } from 'vitest';

import { resolveInitiativeRegisterLifecycle } from '../initiativeRegisterColumns.shared';
import { createInitiativeRegisterColumns } from '../initiativeRegisterColumns.shared';
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
    expect(row.canonicalLifecyclePresentation).toBe(true);
    expect(resolveInitiativeRegisterLifecycle(row)).toBe('SCHEDULED');
  });

  it('falls back deterministically for a pre-migration row', () => {
    const row = toCanonicalInitiativeRegisterItemFromLegacyRow({
      id: 'initiative-2',
      name: 'Legacy row',
      status: 'PENDING_APPROVAL',
    });
    expect(resolveInitiativeRegisterLifecycle(row)).toBe('READY_FOR_DECISION');
  });

  it('keeps the seven-code filter contract when OFF and exposes stages plus dispositions when ON', () => {
    const offStatus = createInitiativeRegisterColumns({ stages12Enabled: false }).find(
      (column) => column.id === 'status'
    );
    const onStatus = createInitiativeRegisterColumns({ stages12Enabled: true }).find(
      (column) => column.id === 'status'
    );

    expect(offStatus?.filterOptions?.map((option) => option.value)).toEqual([
      'PROPOSED',
      'DRAFT',
      'PENDING_APPROVAL',
      'APPROVED',
      'IN_EXECUTION',
      'CLOSED',
      'REJECTED',
    ]);
    expect(onStatus?.filterOptions?.map((option) => option.value)).toEqual([
      'REGISTERED_DRAFT',
      'DEFINED',
      'ANALYZING',
      'READY_FOR_DECISION',
      'APPROVED_BACKLOG',
      'SCHEDULED',
      'IN_EXECUTION',
      'DELIVERED',
      'BENEFITS_TRACKING',
      'EFFECTIVENESS_REVIEWED',
      'CLOSED',
      'ARCHIVED',
      'PROPOSED',
      'REJECTED',
    ]);
  });
});
