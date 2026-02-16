import { beforeEach, describe, expect, it, vi } from 'vitest';

const { dbGet, loggerError } = vi.hoisted(() => ({
  dbGet: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock('../../../../server/src/utils/DbPromise.js', () => ({
  get: (...args: any[]) => dbGet(...args),
}));

vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: {
    error: (...args: any[]) => loggerError(...args),
  },
}));

import { resolveUserChatRole } from '../../../../server/src/services/chatPermissionService.ts';

describe('chatPermissionService: resolveUserChatRole', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns none when userId is missing', async () => {
    await expect(resolveUserChatRole('', 'org-1')).resolves.toBe('none');
  });

  it('returns none when organizationId is missing', async () => {
    await expect(resolveUserChatRole('u-1', '')).resolves.toBe('none');
  });

  it('returns none when membership is not found', async () => {
    dbGet.mockResolvedValueOnce(undefined);
    await expect(resolveUserChatRole('u-1', 'org-1')).resolves.toBe('none');
  });

  it('maps membership role from DB to chat role', async () => {
    dbGet.mockResolvedValueOnce({ role: 'ADMIN' });
    await expect(resolveUserChatRole('u-1', 'org-1')).resolves.toBe('owner');
  });

  it('catches db errors, logs, and returns none', async () => {
    dbGet.mockRejectedValueOnce(new Error('db down'));
    await expect(resolveUserChatRole('u-1', 'org-1')).resolves.toBe('none');
    expect(loggerError).toHaveBeenCalled();
  });
});
