import { describe, expect, it } from 'vitest';

import {
  flattenInboxDisplayGroups,
  groupItems,
  nextInboxPreviewItem,
  type InboxGroup,
  type InboxItem,
} from '../../src/components/MyWork/InboxContent';

/**
 * M03 Inbox flat mode → StandardTable grouped-rows (kanon TRIADA §27, flag
 * ff_m03InboxStandardTable). Guards the pure group/flatten/mirror pipeline
 * WITHOUT mounting the component (wzór tests/unit/myWorkOpenItemRouting.test.ts) —
 * `renderStandardFlatView`/`inboxStandardColumns` are exercised visually via
 * the flagged screenshot harness, not here.
 *
 * The invariant under test: dedup-group expand/collapse (Layers xN badge)
 * and keyboard-nav focus (`__visibleIndex`) must survive StandardTable's
 * native per-column sort/filter, which operate on the FLAT row array and
 * would otherwise scatter a group's children away from its representative.
 */

let seq = 0;
const makeItem = (overrides: Partial<InboxItem> & { _key: InboxItem['_key'] }): InboxItem => {
  seq += 1;
  return {
    id: overrides.id ?? `item-${seq}`,
    type: 'new_assignment',
    section: 'assigned_tasks',
    title: `Item ${seq}`,
    receivedAt: '2026-07-15T10:00:00.000Z',
    urgency: 'normal',
    triaged: false,
    itemStatus: 'open',
    reason: 'assigned',
    isActionable: false,
    ...overrides,
  } as InboxItem;
};

describe('groupItems (M03 Inbox dedup)', () => {
  it('groups items sharing the same _key, representative = first occurrence', () => {
    const a1 = makeItem({ _key: 'notification:abc', title: 'First' });
    const a2 = makeItem({ _key: 'notification:abc', title: 'Duplicate' });
    const b = makeItem({ _key: 'task:xyz', title: 'Unrelated' });

    const groups = groupItems([a1, a2, b]);

    expect(groups).toHaveLength(2);
    const dupeGroup = groups.find((g) => g.key === 'notification:abc')!;
    expect(dupeGroup.count).toBe(2);
    expect(dupeGroup.representative).toBe(a1);
    expect(dupeGroup.items).toEqual([a1, a2]);

    const singleGroup = groups.find((g) => g.key === 'task:xyz')!;
    expect(singleGroup.count).toBe(1);
    expect(singleGroup.representative).toBe(b);
  });

  it('preserves single items as count-1 groups (no dupe badge)', () => {
    const items = [
      makeItem({ _key: 'task:1' }),
      makeItem({ _key: 'task:2' }),
      makeItem({ _key: 'task:3' }),
    ];
    const groups = groupItems(items);
    expect(groups).toHaveLength(3);
    expect(groups.every((g) => g.count === 1)).toBe(true);
  });
});

describe('Inbox preview comparison pin', () => {
  const first = makeItem({ id: 'preview-a', _key: 'task:preview-a' });
  const second = makeItem({ id: 'preview-b', _key: 'task:preview-b' });

  it('keeps the pinned record when another row is requested', () => {
    expect(nextInboxPreviewItem(first, second, true)).toBe(first);
  });

  it('switches or closes normally when preview is not pinned', () => {
    expect(nextInboxPreviewItem(first, second, false)).toBe(second);
    expect(nextInboxPreviewItem(first, first, false)).toBeNull();
  });
});

describe('flattenInboxDisplayGroups (StandardTable grouped-rows)', () => {
  const dupeA = makeItem({
    id: 'dupe-a',
    _key: 'notification:dupe',
    title: 'Representative',
    urgency: 'critical',
    itemStatus: 'open',
  });
  const dupeB = makeItem({
    id: 'dupe-b',
    _key: 'notification:dupe',
    title: 'Duplicate copy',
    // Deliberately DIFFERENT real values than the representative — legacy
    // renderRow(group.items[i]) still shows the CHILD's own values, and the
    // group must stay cohesive regardless of this divergence.
    urgency: 'low',
    itemStatus: 'done',
  });
  const solo = makeItem({ id: 'solo', _key: 'task:solo', title: 'Solo item' });

  const group: InboxGroup = {
    key: dupeA._key,
    representative: dupeA,
    items: [dupeA, dupeB],
    count: 2,
  };
  const soloGroup: InboxGroup = {
    key: solo._key,
    representative: solo,
    items: [solo],
    count: 1,
  };

  it('collapsed: only the representative row is emitted (children hidden)', () => {
    const rows = flattenInboxDisplayGroups([
      { ...group, isExpanded: false },
      { ...soloGroup, isExpanded: false },
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[0].id).toBe('dupe-a');
    expect(rows[0].__isGroupHeader).toBe(true);
    expect(rows[0].__groupCount).toBe(2);
    expect(rows[1].id).toBe('solo');
  });

  it('expanded: child rows appear immediately after their representative', () => {
    const rows = flattenInboxDisplayGroups([
      { ...group, isExpanded: true },
      { ...soloGroup, isExpanded: false },
    ]);

    expect(rows).toHaveLength(3);
    expect(rows[0].id).toBe('dupe-a');
    expect(rows[0].__isGroupHeader).toBe(true);
    expect(rows[1].id).toBe('dupe-b');
    expect(rows[1].__isGroupHeader).toBe(false);
    expect(rows[1].__groupKey).toBe(rows[0].__groupKey);
    expect(rows[2].id).toBe('solo');
  });

  it('re-collapsing makes the child row disappear again', () => {
    const expanded = flattenInboxDisplayGroups([{ ...group, isExpanded: true }]);
    const collapsed = flattenInboxDisplayGroups([{ ...group, isExpanded: false }]);
    expect(expanded).toHaveLength(2);
    expect(collapsed).toHaveLength(1);
    expect(collapsed.some((r) => r.id === 'dupe-b')).toBe(false);
  });

  it("cell-facing __item always carries the ROW'S OWN real values (not mirrored)", () => {
    const rows = flattenInboxDisplayGroups([{ ...group, isExpanded: true }]);
    const [repRow, childRow] = rows;
    expect(repRow.__item.urgency).toBe('critical');
    expect(childRow.__item.urgency).toBe('low');
    expect(repRow.__item.itemStatus).toBe('open');
    expect(childRow.__item.itemStatus).toBe('done');
  });

  it('sort/filter-facing mirrored fields are IDENTICAL across a group (cohesion)', () => {
    const rows = flattenInboxDisplayGroups([{ ...group, isExpanded: true }]);
    const [repRow, childRow] = rows;
    // Mirrored to the representative on BOTH rows, despite the child's own
    // urgency/status genuinely differing (see previous test) — this is what
    // keeps StandardTable's native per-column sort/filter from splitting the
    // group apart (see module doc comment on `flattenInboxDisplayGroups`).
    expect(childRow.urgency).toBe(repRow.urgency);
    expect(childRow.status).toBe(repRow.status);
    expect(childRow.title).toBe(repRow.title);
    expect(childRow.received).toBe(repRow.received);
  });

  it('group cohesion survives a native stable sort by a mirrored key (Array.prototype.sort)', () => {
    // Simulates what StandardTable/FilterableTable's own column sort does:
    // `[...data].sort((a, b) => accessor(a) - accessor(b) ...)` directly on
    // the flat row array. If the child carried its OWN urgency (low) instead
    // of the mirrored (critical) value, sorting by urgency would scatter it
    // away from a differently-urgent group elsewhere in the list.
    const other = makeItem({ id: 'other', _key: 'task:other', title: 'Other', urgency: 'high' });
    const otherGroup: InboxGroup = {
      key: other._key,
      representative: other,
      items: [other],
      count: 1,
    };
    const rows = flattenInboxDisplayGroups([
      { ...otherGroup, isExpanded: false },
      { ...group, isExpanded: true },
    ]);
    const order: Record<string, number> = { critical: 0, high: 1, normal: 2, low: 3 };
    const sorted = [...rows].sort((a, b) => order[a.urgency] - order[b.urgency]);
    // dupe-a (critical) and dupe-b (mirrored to critical) both sort ahead of
    // "other" (high) — and Array.sort's stability keeps dupe-b glued right
    // after dupe-a since they share the exact same sort key.
    expect(sorted.map((r) => r.id)).toEqual(['dupe-a', 'dupe-b', 'other']);
  });

  it('assigns __visibleIndex sequentially over VISIBLE rows only (focus/keyboard-nav parity)', () => {
    const rows = flattenInboxDisplayGroups([
      { ...group, isExpanded: false }, // 1 visible row (representative only)
      { ...soloGroup, isExpanded: false }, // 1 visible row
    ]);
    expect(rows.map((r) => r.__visibleIndex)).toEqual([0, 1]);

    const expandedRows = flattenInboxDisplayGroups([
      { ...group, isExpanded: true }, // 2 visible rows (rep + child)
      { ...soloGroup, isExpanded: false }, // 1 visible row
    ]);
    expect(expandedRows.map((r) => r.__visibleIndex)).toEqual([0, 1, 2]);
  });
});
