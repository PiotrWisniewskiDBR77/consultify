/**
 * RN-G5 §G #8 — `buildKpiScorecardItemRowMenu`'s real move-up/move-down
 * edge lock (was a client-side-only "not built" lock before this package;
 * now a genuine business-state lock — TRIADA §C3: a disabled kebab entry
 * stays VISIBLE with a reason, never hidden, and the reason must be the
 * REAL edge condition, not a fabricated one).
 */
import { describe, expect, it, vi } from 'vitest';

import { buildKpiScorecardItemRowMenu } from '../../../src/components/ResultsVNext/kpiScorecards/kpiScorecardPresenters';
import type { KpiScorecardItemDto } from '../../../src/components/ResultsVNext/kpiScorecards/kpiScorecardApi';

function item(itemId: string, sortOrder: number): KpiScorecardItemDto {
  return {
    itemId,
    scorecardId: 'sc-1',
    kpiId: `kpi-${itemId}`,
    organizationId: 'org-1',
    role: 'primary',
    sortOrder,
    displayConfig: null,
    addedBy: 'user-1',
    addedAt: '2026-08-01T00:00:00Z',
  };
}

function findAction(menu: ReturnType<typeof buildKpiScorecardItemRowMenu>, id: string) {
  return menu.statusTransitions?.find((a) => a.id === id);
}

describe('buildKpiScorecardItemRowMenu — move up/down edge lock', () => {
  it('locks "move up" (with a real reason) for the first row, leaves "move down" enabled', () => {
    const row = item('item-1', 1);
    const menu = buildKpiScorecardItemRowMenu(row, false, {
      onPreview: vi.fn(),
      onOpenKpi: vi.fn(),
      onMoveUp: vi.fn(),
      onMoveDown: vi.fn(),
      onRemove: vi.fn(),
      isFirst: true,
      isLast: false,
    });

    const up = findAction(menu, 'move-up');
    const down = findAction(menu, 'move-down');
    expect(up?.disabled).toBe(true);
    expect(up?.note).toBeTruthy();
    expect(up?.onClick).toBeUndefined();
    expect(down?.disabled).toBeFalsy();
    expect(typeof down?.onClick).toBe('function');
  });

  it('locks "move down" for the last row, leaves "move up" enabled', () => {
    const row = item('item-3', 3);
    const menu = buildKpiScorecardItemRowMenu(row, false, {
      onPreview: vi.fn(),
      onOpenKpi: vi.fn(),
      onMoveUp: vi.fn(),
      onMoveDown: vi.fn(),
      onRemove: vi.fn(),
      isFirst: false,
      isLast: true,
    });

    const up = findAction(menu, 'move-up');
    const down = findAction(menu, 'move-down');
    expect(down?.disabled).toBe(true);
    expect(down?.note).toBeTruthy();
    expect(up?.disabled).toBeFalsy();
    expect(typeof up?.onClick).toBe('function');
  });

  it('enables both directions for a middle row, and destructive "Remove item" always calls onRemove', () => {
    const row = item('item-2', 2);
    const onRemove = vi.fn();
    const menu = buildKpiScorecardItemRowMenu(row, false, {
      onPreview: vi.fn(),
      onOpenKpi: vi.fn(),
      onMoveUp: vi.fn(),
      onMoveDown: vi.fn(),
      onRemove,
      isFirst: false,
      isLast: false,
    });

    expect(findAction(menu, 'move-up')?.disabled).toBeFalsy();
    expect(findAction(menu, 'move-down')?.disabled).toBeFalsy();

    menu.destructive?.onClick?.();
    expect(onRemove).toHaveBeenCalledWith(row);
  });
});
