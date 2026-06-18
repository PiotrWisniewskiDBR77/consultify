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

  it('casts facilitation votes with conflict-safe upsert payload', async () => {
    mockQueryRun.mockResolvedValue({ changes: 1 });

    const { realtimePlatformService } = await import(
      '../../../../server/src/services/realtimePlatformService.js'
    );
    const result = await realtimePlatformService.castVote('session-1', {
      voterId: 'user-1',
      voteTargetId: 'node-9',
      voteType: 'upvote',
      voteValue: 2,
      comment: 'top priority',
    });

    expect(result).toEqual({ id: 'realtime-uuid' });
    expect(mockQueryRun).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT (facilitation_session_id, voter_id, vote_target_id, vote_type)'),
      ['realtime-uuid', 'session-1', 'user-1', null, 'node-9', 'upvote', 2, 'top priority'],
    );
  });

  it('creates facilitation outcomes with persisted export metadata', async () => {
    mockQueryRun.mockResolvedValue({ changes: 1 });

    const { realtimePlatformService } = await import(
      '../../../../server/src/services/realtimePlatformService.js'
    );
    const result = await realtimePlatformService.createOutcome('session-7', {
      outcomeType: 'decision',
      title: 'Pick rollout scope',
      description: 'Phase 1 rollout only',
      voteSummary: { 'node-1': 5 },
      exportedToType: 'decision',
      exportedToId: 'dec-22',
    });

    expect(result).toEqual({ id: 'realtime-uuid' });
    expect(mockQueryRun).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO tool_facilitation_outcomes'),
      [
        'realtime-uuid',
        'session-7',
        'decision',
        'Pick rollout scope',
        'Phase 1 rollout only',
        JSON.stringify({ 'node-1': 5 }),
        'decision',
        'dec-22',
      ],
    );
  });

  // ── M09 L-04: shared facilitation session (governance backend) ──

  it('createFacilitationSession is idempotent per (org, toolSessionId) — reuses the existing shared session', async () => {
    // A session already exists for this org + tool session → a 2nd participant must
    // resolve to the SAME session (shared timer/phase/voting/roles), not a private one.
    mockQueryFirst.mockResolvedValue({ id: 'shared-session-1' });

    const { realtimePlatformService } = await import(
      '../../../../server/src/services/realtimePlatformService.js'
    );
    const result = await realtimePlatformService.createFacilitationSession('org-1', {
      toolSessionId: 'tool-session-9',
      facilitatorId: 'user-B',
    });

    expect(result).toEqual({ id: 'shared-session-1' });
    // Looked up by org + tool_session_id, status not ended.
    expect(mockQueryFirst).toHaveBeenCalledWith(
      expect.stringContaining('tool_facilitation_sessions'),
      ['org-1', 'tool-session-9'],
    );
    // No INSERT happened — the existing row was reused.
    expect(mockQueryRun).not.toHaveBeenCalled();
  });

  it('createFacilitationSession inserts a new session when none exists (first participant = facilitator)', async () => {
    mockQueryFirst.mockResolvedValue(null);
    mockQueryRun.mockResolvedValue({ changes: 1 });

    const { realtimePlatformService } = await import(
      '../../../../server/src/services/realtimePlatformService.js'
    );
    const result = await realtimePlatformService.createFacilitationSession('org-1', {
      toolSessionId: 'tool-session-fresh',
      facilitatorId: 'user-A',
    });

    expect(result).toEqual({ id: 'realtime-uuid' });
    expect(mockQueryRun).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO tool_facilitation_sessions'),
      ['realtime-uuid', 'org-1', 'tool-session-fresh', 'user-A', '{}'],
    );
  });

  it('two participants cast votes into the SAME shared session (consistent aggregation target)', async () => {
    mockQueryRun.mockResolvedValue({ changes: 1 });

    const { realtimePlatformService } = await import(
      '../../../../server/src/services/realtimePlatformService.js'
    );
    await realtimePlatformService.castVote('shared-session-1', {
      voterId: 'user-A',
      voteTargetId: 'node-9',
      voteValue: 1,
    });
    await realtimePlatformService.castVote('shared-session-1', {
      voterId: 'user-B',
      voteTargetId: 'node-9',
      voteValue: 1,
    });

    // Both votes target the same facilitation_session_id (arg index 1) and the same
    // node, from two distinct voters — so getVoteSummary aggregates them together.
    const sessionIds = mockQueryRun.mock.calls.map((c) => (c[1] as unknown[])[1]);
    const voterIds = mockQueryRun.mock.calls.map((c) => (c[1] as unknown[])[2]);
    expect(sessionIds).toEqual(['shared-session-1', 'shared-session-1']);
    expect(voterIds).toEqual(['user-A', 'user-B']);
  });
});
