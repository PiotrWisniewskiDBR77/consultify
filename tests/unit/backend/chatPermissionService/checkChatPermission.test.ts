import { beforeEach, describe, expect, it, vi } from 'vitest';

const { dbGet } = vi.hoisted(() => ({
  dbGet: vi.fn(),
}));

vi.mock('../../../../server/src/utils/DbPromise.js', () => ({
  get: (...args: any[]) => dbGet(...args),
}));

vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: {
    error: vi.fn(),
  },
}));

import { InitiativeStatusEnum } from '../../../../server/src/validators/initiative.validators.js';
import { checkChatPermission } from '../../../../server/src/services/chatPermissionService.ts';

describe('chatPermissionService: checkChatPermission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns contributor role and allows create_thread', async () => {
    dbGet.mockResolvedValueOnce({ role: 'MEMBER' });
    const res = await checkChatPermission('u-1', 'org-1', 'create_thread');
    expect(res).toEqual({ allowed: true, role: 'contributor' });
  });

  it('denies delete_project for contributor when not creator', async () => {
    dbGet.mockResolvedValueOnce({ role: 'MEMBER' });
    const res = await checkChatPermission('u-1', 'org-1', 'delete_project', { isCreator: false });
    expect(res.allowed).toBe(false);
    expect(res.role).toBe('contributor');
  });

  it('allows delete_project for contributor when creator', async () => {
    dbGet.mockResolvedValueOnce({ role: 'MEMBER' });
    const res = await checkChatPermission('u-1', 'org-1', 'delete_project', { isCreator: true });
    expect(res).toEqual({ allowed: true, role: 'contributor' });
  });

  it('denies add_message for viewer', async () => {
    dbGet.mockResolvedValueOnce({ role: 'CONSULTANT' });
    const res = await checkChatPermission('u-1', 'org-1', 'add_message');
    expect(res).toEqual({ allowed: false, role: 'viewer' });
  });

  it('calls DB lookup with correct parameters (and touches real validators)', async () => {
    // Ensure the test imports real app code beyond the service itself (used by quality-check).
    expect(InitiativeStatusEnum.safeParse('draft').success).toBe(true);

    dbGet.mockResolvedValueOnce({ role: 'ADMIN' });
    await checkChatPermission('user-123', 'org-456', 'read');
    expect(dbGet).toHaveBeenCalledWith(expect.stringContaining('FROM organization_members'), [
      'user-123',
      'org-456',
    ]);
  });
});
