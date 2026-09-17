import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import type { PortfolioInitiative } from '@/types';
import {
  countInitiativeRegisterStatuses,
  resolveInitiativePlanLifecycle,
  resolveInitiativePresetLifecycle,
  resolveInitiativeRegisterLifecycle,
} from '../initiativeRegisterColumns.shared';
import { createInitiativeRegisterColumns } from '../initiativeRegisterColumns.shared';
import {
  runtimeLifecycleToInitiativeStatus,
  toCanonicalInitiativeRegisterItemFromLegacyRow,
} from '../initiativeRegisterProjection';

describe('STAGE-1 / DEC-539 initiative register projection', () => {
  it('renders the persisted lifecycle stage instead of the seven-code compatibility status', () => {
    const row = toCanonicalInitiativeRegisterItemFromLegacyRow({
      id: 'initiative-1',
      name: 'Lifecycle truth',
      status: 'APPROVED',
      lifecycleStage: 'SCHEDULED',
    });

    expect(row.status).toBe('APPROVED');
    expect(row.displayStatus).toBe('APPROVED');
    expect(row.canonicalLifecyclePresentation).toBe(true);
    expect(resolveInitiativeRegisterLifecycle(row, false)).toBe('APPROVED_BACKLOG');
    expect(resolveInitiativeRegisterLifecycle(row, true)).toBe('SCHEDULED');
  });

  it('keeps chip and Next gate on the legacy status while OFF and uses stage 12 while ON', () => {
    const row = toCanonicalInitiativeRegisterItemFromLegacyRow({
      id: 'initiative-parity',
      name: 'Parity',
      status: 'APPROVED',
      lifecycleStage: 'SCHEDULED',
    });
    const translation = (key: string, fallback: string) => fallback || key;
    const off = createInitiativeRegisterColumns({ stages12Enabled: false, t: translation });
    const on = createInitiativeRegisterColumns({ stages12Enabled: true, t: translation });
    const render = (columns: ReturnType<typeof createInitiativeRegisterColumns>, id: string) =>
      renderToStaticMarkup(columns.find((column) => column.id === id)!.render!(row));

    expect(render(off, 'status')).toContain('initiatives.status.APPROVED');
    expect(render(off, 'status')).not.toContain('Scheduled');
    expect(render(off, 'gateName')).toContain('Schedule');
    expect(render(on, 'status')).toContain('Scheduled');
    expect(render(on, 'gateName')).toContain('Handoff');
  });

  it('keeps preset and Plan consumers on their old values while OFF', () => {
    const row = {
      id: 'initiative-consumers',
      name: 'Consumers',
      status: 'APPROVED',
      displayStatus: 'APPROVED',
      p11LifecycleState: 'READY_FOR_DECISION',
      lifecycleStage: 'SCHEDULED',
    } as PortfolioInitiative;

    expect(resolveInitiativePresetLifecycle(row, false)).toBe('APPROVED');
    expect(resolveInitiativePlanLifecycle(row, false)).toBe('READY_FOR_DECISION');
    expect(resolveInitiativePresetLifecycle(row, true)).toBe('SCHEDULED');
    expect(resolveInitiativePlanLifecycle(row, true)).toBe('SCHEDULED');
  });

  it('falls back deterministically for a pre-migration row', () => {
    const row = toCanonicalInitiativeRegisterItemFromLegacyRow({
      id: 'initiative-2',
      name: 'Legacy row',
      status: 'PENDING_APPROVAL',
    });
    expect(resolveInitiativeRegisterLifecycle(row)).toBe('READY_FOR_DECISION');
  });

  it.each(['EXECUTING', '', '???'])(
    'never returns an undefined seven-code status for malformed runtime lifecycle %j',
    (rawLifecycle) => {
      expect(runtimeLifecycleToInitiativeStatus(rawLifecycle)).toBeDefined();
      expect(runtimeLifecycleToInitiativeStatus(rawLifecycle)).toBe(
        rawLifecycle === 'EXECUTING' ? 'IN_EXECUTION' : 'DRAFT'
      );
    }
  );

  it('puts an unknown stage in a visible counter/filter bucket while stage-12 mode is ON', () => {
    const row = toCanonicalInitiativeRegisterItemFromLegacyRow({
      id: 'initiative-unknown-stage',
      name: 'Unknown stage',
      status: 'DRAFT',
      lifecycleStage: 'FUTURE_STAGE',
    });
    const columns = createInitiativeRegisterColumns({
      stages12Enabled: true,
      t: (_key, fallback) => fallback,
    });
    const statusColumn = columns.find((column) => column.id === 'status');

    expect(resolveInitiativeRegisterLifecycle(row, true)).toBe('UNKNOWN');
    expect(countInitiativeRegisterStatuses([row], true)).toEqual({ all: 1, UNKNOWN: 1 });
    expect(statusColumn?.filterOptions?.some((option) => option.value === 'UNKNOWN')).toBe(true);
    expect(renderToStaticMarkup(statusColumn!.render!(row))).toContain('Unknown / Other');
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
      'UNKNOWN',
    ]);
  });
});
