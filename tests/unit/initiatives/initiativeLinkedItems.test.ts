import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQueryAll = vi.fn();
const mockQueryRun = vi.fn();

vi.mock('../../../server/src/utils/queryHelpers.js', () => ({
  queryAll: (...a: unknown[]) => mockQueryAll(...a),
  queryOne: vi.fn(),
  queryRun: (...a: unknown[]) => mockQueryRun(...a),
}));
vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import {
  addLinkedItem,
  listLinkedItems,
  removeLinkedItem,
} from '../../../server/src/services/initiative/initiativeLinkedItemsService.js';

const ORG = 'org-1';
const INIT = 'init-1';

describe('initiativeLinkedItemsService (K3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryRun.mockResolvedValue(undefined);
  });

  it('list maps rows + is org/initiative scoped', async () => {
    mockQueryAll.mockResolvedValueOnce([
      { id: 'l1', target_type: 'task', target_id: 't9', label: 'Spec', created_at: '2026-06-21' },
    ]);
    const r = await listLinkedItems(ORG, INIT);
    expect(r[0]).toMatchObject({ id: 'l1', targetType: 'task', targetId: 't9', label: 'Spec' });
    expect(mockQueryAll).toHaveBeenCalledWith(expect.any(String), [ORG, INIT]);
  });

  it('list returns [] on query error (fail-safe)', async () => {
    mockQueryAll.mockRejectedValueOnce(new Error('db down'));
    expect(await listLinkedItems(ORG, INIT)).toEqual([]);
  });

  it('add inserts an org-scoped row and returns it', async () => {
    const item = await addLinkedItem(ORG, INIT, {
      targetType: 'decision',
      targetId: 'd5',
      label: 'Go/No-Go',
    });
    expect(item).toMatchObject({ targetType: 'decision', targetId: 'd5', label: 'Go/No-Go' });
    const params = mockQueryRun.mock.calls[0][1];
    expect(params).toContain(ORG);
    expect(params).toContain(INIT);
    expect(params).toContain('decision');
  });

  it('add returns null when required fields are missing (no query)', async () => {
    expect(await addLinkedItem(ORG, INIT, { targetType: '', targetId: 't1' })).toBeNull();
    expect(mockQueryRun).not.toHaveBeenCalled();
  });

  it('add returns null on insert error (fail-safe)', async () => {
    mockQueryRun.mockRejectedValueOnce(new Error('conflict'));
    expect(await addLinkedItem(ORG, INIT, { targetType: 'task', targetId: 't1' })).toBeNull();
  });

  it('remove is org+initiative scoped and returns true', async () => {
    const ok = await removeLinkedItem(ORG, INIT, 'l1');
    expect(ok).toBe(true);
    expect(mockQueryRun).toHaveBeenCalledWith(expect.stringContaining('DELETE'), ['l1', ORG, INIT]);
  });
});
