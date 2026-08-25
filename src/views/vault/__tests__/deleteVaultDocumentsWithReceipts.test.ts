import { describe, expect, it, vi } from 'vitest';

import { deleteVaultDocumentsWithReceipts } from '../deleteVaultDocumentsWithReceipts';

describe('deleteVaultDocumentsWithReceipts', () => {
  it('returns one honest receipt per item during partial failure', async () => {
    const remove = vi.fn(async (id: string) => {
      if (id === 'b') throw new Error('locked');
    });
    await expect(deleteVaultDocumentsWithReceipts(['a', 'b', 'c'], remove)).resolves.toEqual([
      { id: 'a', status: 'deleted' },
      { id: 'b', status: 'failed', reason: 'locked' },
      { id: 'c', status: 'deleted' },
    ]);
  });

  it('returns an empty receipt list for an empty selection', async () => {
    const remove = vi.fn();
    await expect(deleteVaultDocumentsWithReceipts([], remove)).resolves.toEqual([]);
    expect(remove).not.toHaveBeenCalled();
  });
});
