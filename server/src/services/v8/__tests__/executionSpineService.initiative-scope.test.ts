import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDbRun = vi.fn().mockResolvedValue({ success: true });
const mockDbGet = vi.fn().mockResolvedValue(null);
const mockDbAll = vi.fn().mockResolvedValue([]);

vi.mock('../../../utils/DbPromise.js', () => ({
  run: (...args: unknown[]) => mockDbRun(...args),
  get: (...args: unknown[]) => mockDbGet(...args),
  all: (...args: unknown[]) => mockDbAll(...args),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { getActiveRuns, getRunsByOrg } from '../executionSpineService.js';

const ORG_ID = '00000000-0000-4000-8000-000000000001';
const INITIATIVE_ID = 'init-scope-1';

describe('executionSpineService initiative scope SQL guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adds initiative JSON filter to getRunsByOrg only when initiativeId is provided', async () => {
    await getRunsByOrg(ORG_ID, 'drafting', 25, INITIATIVE_ID);

    expect(mockDbAll).toHaveBeenCalledTimes(1);
    const [scopedSql, scopedParams] = mockDbAll.mock.calls[0] as [string, unknown[]];
    expect(scopedSql).toContain(`metadata::jsonb->>'initiativeId' = ?`);
    expect(scopedParams).toEqual([ORG_ID, 'drafting', INITIATIVE_ID, 25]);

    vi.clearAllMocks();
    await getRunsByOrg(ORG_ID, 'drafting', 25);
    const [unscopedSql, unscopedParams] = mockDbAll.mock.calls[0] as [string, unknown[]];
    expect(unscopedSql).not.toContain(`metadata::jsonb->>'initiativeId' = ?`);
    expect(unscopedParams).toEqual([ORG_ID, 'drafting', 25]);
  });

  it('adds initiative JSON filter to getActiveRuns only when initiativeId is provided', async () => {
    await getActiveRuns(ORG_ID, INITIATIVE_ID);

    expect(mockDbAll).toHaveBeenCalledTimes(1);
    const [scopedSql, scopedParams] = mockDbAll.mock.calls[0] as [string, unknown[]];
    expect(scopedSql).toContain(`metadata::jsonb->>'initiativeId' = ?`);
    expect(scopedParams).toEqual([ORG_ID, INITIATIVE_ID]);

    vi.clearAllMocks();
    await getActiveRuns(ORG_ID);
    const [unscopedSql, unscopedParams] = mockDbAll.mock.calls[0] as [string, unknown[]];
    expect(unscopedSql).not.toContain(`metadata::jsonb->>'initiativeId' = ?`);
    expect(unscopedParams).toEqual([ORG_ID]);
  });
});
