import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRun = vi.fn();
const mockAll = vi.fn();
const mockFireBudgetHealthExport = vi.fn();

vi.mock('../../utils/DbPromise.js', () => ({
  run: (...args: unknown[]) => mockRun(...args),
  all: (...args: unknown[]) => mockAll(...args),
}));
vi.mock('../executionResultsBridge.js', () => ({
  fireBudgetHealthExport: (...args: unknown[]) => mockFireBudgetHealthExport(...args),
}));

import { deleteBudgetEntry } from '../executionBudgetService.js';

describe('execution budget destructive action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fails closed on a wrong tenant/initiative/id tuple and causes no downstream effects', async () => {
    mockRun.mockResolvedValue({ changes: 0 });

    await expect(deleteBudgetEntry('org-a', 'missing-entry', 'initiative-a')).resolves.toBe(false);

    expect(mockRun).toHaveBeenCalledWith(
      expect.stringContaining('AND initiative_id = ?'),
      ['missing-entry', 'org-a', 'initiative-a'],
      { fallback: false }
    );
    expect(mockAll).not.toHaveBeenCalled();
    expect(mockFireBudgetHealthExport).not.toHaveBeenCalled();
  });
});
