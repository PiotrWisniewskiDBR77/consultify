import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { InitiativeStatus } from '@/types';

import {
  pmoQueueCounts,
  pmoQueueForInitiative,
  pmoResponsible,
  pmoStageLabel,
  type InitiativeRegisterRow,
} from '../pmoQueues';
import { createInitiativeRegisterColumns } from '../initiativeRegisterColumns.shared';

const row = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'i-1',
    name: 'Initiative',
    axis: 'operational',
    status: InitiativeStatus.DRAFT,
    displayStatus: 'DEFINED',
    priority: 'MEDIUM',
    progress: 0,
    budget: 0,
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
    ...overrides,
  }) as InitiativeRegisterRow;

describe('PMO-1a queues', () => {
  const now = new Date('2026-09-16T12:00:00Z');

  it('assigns exactly one queue using the documented priority', () => {
    expect(
      pmoQueueForInitiative(
        row({ displayStatus: 'READY_FOR_DECISION', onHold: true, plannedEndDate: '2026-09-15' }),
        now
      )
    ).toBe('overdue');
    expect(pmoQueueForInitiative(row({ onHold: true }), now)).toBe('blocked');
    expect(pmoQueueForInitiative(row({ displayStatus: 'DELIVERED' }), now)).toBe('approve');
    expect(pmoQueueForInitiative(row({ gateReadiness: 'PARTIAL' }), now)).toBe('discuss');
    expect(pmoQueueForInitiative(row(), now)).toBe('review');
  });

  it('counts the same exclusive classification used by filtering', () => {
    const rows = [
      row(),
      row({ id: 'i-2', gateReadiness: 'PARTIAL' }),
      row({ id: 'i-3', displayStatus: 'READY_FOR_DECISION' }),
      row({ id: 'i-4', onHold: true }),
      row({ id: 'i-5', plannedEndDate: '2026-09-15' }),
    ];
    expect(pmoQueueCounts(rows, now)).toEqual({
      review: 1,
      discuss: 1,
      approve: 1,
      blocked: 1,
      overdue: 1,
    });
  });

  it('builds human stage and responsible labels without exposing ids', () => {
    const item = row({
      displayStatus: 'ANALYZING',
      ownerBusiness: { id: 'uuid-owner', firstName: 'Irina', lastName: 'Dubois' },
    });
    expect(pmoStageLabel(item, false)).toBe('3 · Analyzing');
    expect(pmoResponsible(item, false)).toBe('Irina Dubois · Owner');
    expect(pmoResponsible(row(), false)).toBe('Unassigned · Owner');
  });

  it('preserves the frozen register by default and replaces it only when enabled', () => {
    const frozen = createInitiativeRegisterColumns().map((column) => column.id);
    expect(frozen).not.toContain('pmoStage');
    expect(frozen).toContain('status');

    expect(
      createInitiativeRegisterColumns({ pmoQueuesEnabled: true }).map((column) => column.id)
    ).toEqual(['name', 'pmoStage', 'pmoResponsible', 'pmoDue', 'pmoNextStep']);

    const register = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/Initiatives/CanonicalInitiativeRegister.tsx'),
      'utf8'
    );
    expect(register).toContain("direction: pmoQueuesEnabled ? 'asc' : 'desc'");
  });

  it('prefers the canonical lifecycle state when it is available', () => {
    expect(
      pmoStageLabel(row({ lifecycleState: 'BENEFITS_TRACKING', displayStatus: 'DRAFT' }), false)
    ).toBe('9 · Benefits tracking');
  });
});
