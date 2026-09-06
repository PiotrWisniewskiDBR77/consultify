/**
 * Kanban ↔ initiative lifecycle coverage (regression guard).
 *
 * Owner decision 2026-08-29: the INITIATIVE LIFECYCLE is the truth; the
 * Kanban columns must mirror it. The board must never silently swallow a
 * record whose status has no column — that failure mode shipped twice
 * (DRAFT, 2026-06 M13 P1; EXECUTING, 2026-08), both times invisibly,
 * because the grouping step used `if (grouped[status])` and dropped the
 * record without a sound.
 *
 * These tests are deliberately pure (no React render): the invariant is
 * about data, and a rendering test would be slower and flakier without
 * proving anything extra.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { InitiativeStatus, type PortfolioInitiative } from '../../../types';
import { ACTIVE_HIDDEN_STATUSES, ACTIVE_STATUSES, ALL_STATUSES } from '../../../utils/initiativeHelpers';
import {
  getColumnsForScope,
  groupInitiativesByColumn,
  warnOnHomelessStatuses,
  type KanbanScope,
} from '../PortfolioKanbanView';

const EVERY_STATUS = Object.values(InitiativeStatus) as InitiativeStatus[];

const makeInitiative = (status: InitiativeStatus): PortfolioInitiative =>
  ({
    id: `init-${status}`,
    name: `Initiative ${status}`,
    status,
    priority: 'HIGH',
  }) as unknown as PortfolioInitiative;

describe('Kanban columns cover the initiative lifecycle', () => {
  it('scope "all" gives every InitiativeStatus a column', () => {
    const covered = new Set(getColumnsForScope('all').map((c) => String(c.id)));
    const homeless = EVERY_STATUS.filter((s) => !covered.has(String(s)));
    expect(homeless).toEqual([]);
    expect(covered.size).toBe(EVERY_STATUS.length);
  });

  it('scope "active" gives every non-terminal InitiativeStatus a column', () => {
    const covered = new Set(getColumnsForScope('active').map((c) => String(c.id)));
    const hidden = new Set(ACTIVE_HIDDEN_STATUSES.map(String));
    const homeless = EVERY_STATUS.filter((s) => !covered.has(String(s)) && !hidden.has(String(s)));
    expect(homeless).toEqual([]);
  });

  it('ACTIVE_STATUSES ∪ ACTIVE_HIDDEN_STATUSES partitions the enum exactly', () => {
    const active = ACTIVE_STATUSES.map(String);
    const hidden = ACTIVE_HIDDEN_STATUSES.map(String);
    expect(active.filter((s) => hidden.includes(s))).toEqual([]);
    expect([...active, ...hidden].sort()).toEqual(EVERY_STATUS.map(String).sort());
  });

  it('ACTIVE_STATUSES keeps the ALL_STATUSES lifecycle order', () => {
    const order = ALL_STATUSES.map(String);
    const indices = ACTIVE_STATUSES.map((s) => order.indexOf(String(s)));
    expect(indices).not.toContain(-1);
    expect([...indices].sort((a, b) => a - b)).toEqual(indices);
  });
});

describe('EXECUTING initiative is visible on the board', () => {
  it.each<KanbanScope>(['active', 'all'])(
    'lands in a column and is counted in scope "%s"',
    (scope) => {
      const columns = getColumnsForScope(scope);
      const executing = makeInitiative(InitiativeStatus.IN_EXECUTION);
      const { grouped, homelessStatuses } = groupInitiativesByColumn([executing], columns);

      expect(homelessStatuses).toEqual([]);
      const total = Object.values(grouped).reduce((sum, list) => sum + list.length, 0);
      expect(total).toBe(1);
      expect(grouped[InitiativeStatus.IN_EXECUTION]).toHaveLength(1);
      expect(grouped[InitiativeStatus.IN_EXECUTION][0].id).toBe(executing.id);
    }
  );

  it('every non-terminal status is counted, none silently dropped (scope "active")', () => {
    const hidden = new Set(ACTIVE_HIDDEN_STATUSES.map(String));
    const visible = EVERY_STATUS.filter((s) => !hidden.has(String(s)));
    const columns = getColumnsForScope('active');
    const { grouped, homelessStatuses } = groupInitiativesByColumn(
      visible.map(makeInitiative),
      columns
    );

    expect(homelessStatuses).toEqual([]);
    const total = Object.values(grouped).reduce((sum, list) => sum + list.length, 0);
    expect(total).toBe(visible.length);
  });

  it('every status is counted in scope "all"', () => {
    const columns = getColumnsForScope('all');
    const { grouped, homelessStatuses } = groupInitiativesByColumn(
      EVERY_STATUS.map(makeInitiative),
      columns
    );

    expect(homelessStatuses).toEqual([]);
    const total = Object.values(grouped).reduce((sum, list) => sum + list.length, 0);
    expect(total).toBe(EVERY_STATUS.length);
  });
});

describe('anti-regression guard: a homeless status is never swallowed in silence', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('reports the homeless status instead of dropping it without a trace', () => {
    // A column set that deliberately omits EXECUTING — i.e. the exact shape
    // of the shipped defect. The grouping must SAY SO.
    const truncatedColumns = getColumnsForScope('active').filter(
      (c) => c.id !== InitiativeStatus.IN_EXECUTION
    );
    const { grouped, homelessStatuses } = groupInitiativesByColumn(
      [makeInitiative(InitiativeStatus.IN_EXECUTION)],
      truncatedColumns
    );

    const total = Object.values(grouped).reduce((sum, list) => sum + list.length, 0);
    expect(total).toBe(0);
    expect(homelessStatuses).toEqual(['EXECUTING']);
  });

  it('warns on the developer console, naming the status', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    warnOnHomelessStatuses('active', ['EXECUTING']);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('EXECUTING');
  });

  it('stays quiet when nothing is homeless', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    warnOnHomelessStatuses('active', []);
    expect(warn).not.toHaveBeenCalled();
  });
});
