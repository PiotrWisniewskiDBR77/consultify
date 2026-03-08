import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQueryAll = vi.fn();
const mockQueryFirst = vi.fn();
const mockQueryRun = vi.fn();

vi.mock('../../../../server/src/utils/queryHelpers.js', () => ({
  queryAll: (...args: unknown[]) => mockQueryAll(...args),
  queryFirst: (...args: unknown[]) => mockQueryFirst(...args),
  queryRun: (...args: unknown[]) => mockQueryRun(...args),
}));

vi.mock('uuid', () => ({
  v4: () => 'realtime-uuid',
}));

describe('RealtimePlatformService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the existing channel id when createChannel hits a uniqueness conflict', async () => {
    mockQueryRun.mockResolvedValue({ changes: 0 });
    mockQueryFirst.mockResolvedValue({ id: 'existing-channel' });

    const { realtimePlatformService } = await import(
      '../../../../server/src/services/realtimePlatformService.js'
    );
    const result = await realtimePlatformService.createChannel('org-1', {
      channelType: 'idea',
      resourceType: 'idea',
      resourceId: 'idea-1',
    });

    expect(result).toEqual({ id: 'existing-channel' });
    expect(mockQueryFirst).toHaveBeenCalledWith(
      expect.stringContaining('realtime_channels'),
      ['org-1', 'idea', 'idea-1'],
    );
  });

  it('reuses active realtime presence rows instead of inserting duplicates', async () => {
    mockQueryFirst.mockResolvedValue({ id: 'presence-1' });
    mockQueryRun.mockResolvedValue({ changes: 1 });

    const { realtimePlatformService } = await import(
      '../../../../server/src/services/realtimePlatformService.js'
    );
    const result = await realtimePlatformService.upsertPresence('channel-1', {
      userId: 'user-1',
      userName: 'User',
      cursorState: { x: 10, y: 20 },
    });

    expect(result).toEqual({ id: 'presence-1', reused: true });
    expect(mockQueryRun).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE realtime_presence'),
      ['User', null, JSON.stringify({ x: 10, y: 20 }), null, 'presence-1'],
    );
  });

  it('returns the existing CRDT document id when createCrdtDocument conflicts', async () => {
    mockQueryRun.mockResolvedValue({ changes: 0 });
    mockQueryFirst.mockResolvedValue({ id: 'doc-1' });

    const { realtimePlatformService } = await import(
      '../../../../server/src/services/realtimePlatformService.js'
    );
    const result = await realtimePlatformService.createCrdtDocument('org-1', {
      resourceType: 'whiteboard',
      resourceId: 'wb-1',
    });

    expect(result).toEqual({ id: 'doc-1' });
  });

  it('reuses active tool presence rows instead of inserting duplicates', async () => {
    mockQueryFirst.mockResolvedValue({ id: 'tool-presence-1' });
    mockQueryRun.mockResolvedValue({ changes: 1 });

    const { realtimePlatformService } = await import(
      '../../../../server/src/services/realtimePlatformService.js'
    );
    const result = await realtimePlatformService.upsertToolPresence('org-1', {
      toolSessionId: 'session-1',
      userId: 'user-1',
      editingField: 'title',
    });

    expect(result).toEqual({ id: 'tool-presence-1', reused: true });
    expect(mockQueryRun).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE tool_session_presence'),
      [null, null, '{}', null, 'title', 'tool-presence-1'],
    );
  });
});
