/**
 * R1 Smoke: V4-EXEC-03..05,07,08 — Realtime Platform Service
 * Verifies: channels, presence, CRDT, facilitation, voting, outcomes, tool presence, edit locks
 */

vi.mock('../../../../server/src/utils/queryHelpers.js', () => ({
  queryAll: vi.fn().mockResolvedValue([]),
  queryOne: vi.fn().mockResolvedValue(null),
  queryRun: vi.fn().mockResolvedValue({ changes: 1 }),
}));
vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { realtimePlatformService } from '../../../../server/src/services/realtimePlatformService.js';

describe('V4-EXEC: Realtime Platform Service', () => {
  it('exports createChannel', () => {
    expect(typeof realtimePlatformService.createChannel).toBe('function');
  });
  it('exports listChannels', () => {
    expect(typeof realtimePlatformService.listChannels).toBe('function');
  });
  it('exports upsertPresence', () => {
    expect(typeof realtimePlatformService.upsertPresence).toBe('function');
  });
  it('exports createCrdtDocument', () => {
    expect(typeof realtimePlatformService.createCrdtDocument).toBe('function');
  });
  it('exports createFacilitationSession', () => {
    expect(typeof realtimePlatformService.createFacilitationSession).toBe('function');
  });
  it('exports castVote', () => {
    expect(typeof realtimePlatformService.castVote).toBe('function');
  });
  it('exports createOutcome', () => {
    expect(typeof realtimePlatformService.createOutcome).toBe('function');
  });
  it('exports acquireEditLock', () => {
    expect(typeof realtimePlatformService.acquireEditLock).toBe('function');
  });

  it('listChannels() returns an array', async () => {
    const result = await realtimePlatformService.listChannels('org-1');
    expect(Array.isArray(result)).toBe(true);
  });
});
