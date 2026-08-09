import { beforeEach, describe, expect, it, vi } from 'vitest';

const { dbAll, dbRun, contextGate } = vi.hoisted(() => ({
  dbAll: vi.fn(),
  dbRun: vi.fn(),
  contextGate: vi.fn(),
}));

vi.mock('../../utils/DbPromise.js', () => ({
  all: dbAll,
  get: vi.fn(),
  run: dbRun,
}));
vi.mock('../../services/v8/agentContextGroundingService.js', () => ({
  revalidateCanonicalRunContextForWorker: contextGate,
}));
vi.mock('../../services/v8/agentCanonicalRunService.js', () => ({
  projectCanonicalRunAfterExternalTransition: vi.fn(),
}));
vi.mock('../../services/v8/agentToolExecutionGovernanceService.js', () => ({
  authorizeAgentToolExecution: vi.fn(),
}));

const schedule = {
  schedule_id: 'schedule-1',
  canonical_run_id: 'run-1',
  organization_id: 'org-1',
  owner_user_id: 'owner-1',
  agent_id: 'research-agent',
  cadence: 'once',
  goal: 'Worker context proof',
  status: 'active',
  timeout_seconds: 30,
  max_attempts: 3,
  attempt_count: 0,
  timezone: 'UTC',
};

describe('Wave8 scheduled worker context gate', () => {
  beforeEach(() => {
    dbAll.mockReset().mockResolvedValue([schedule]);
    dbRun.mockReset().mockResolvedValue({ success: true, changes: 1 });
    contextGate.mockReset();
  });

  it('persists a recoverable block and never invokes the execution callback on drift', async () => {
    contextGate.mockResolvedValue({
      decision: 'blocked_drift',
      reason: 'Context drift requires a new snapshot',
      revalidationId: 'revalidation-1',
    });
    const executeSchedule = vi.fn();
    const { processDueWave8AgentSchedules } = await import('../wave8AgentRuntimeService.js');
    const result = await processDueWave8AgentSchedules({
      organizationId: 'org-1',
      now: '2026-08-08T09:00:00.000Z',
      workerId: 'worker-1',
      executeSchedule,
    });
    expect(result).toEqual([]);
    expect(executeSchedule).not.toHaveBeenCalled();
    expect(dbRun).toHaveBeenCalledWith(
      expect.stringContaining("status = 'blocked_context'"),
      expect.arrayContaining(['blocked_drift:Context drift requires a new snapshot', 'schedule-1'])
    );
  });

  it('executes a clean claimed schedule exactly once', async () => {
    contextGate.mockResolvedValue({ decision: 'allowed', reason: 'fresh', revalidationId: 'r-2' });
    const executeSchedule = vi.fn().mockResolvedValue({ run: { runId: 'agent-run-1' } });
    const { processDueWave8AgentSchedules } = await import('../wave8AgentRuntimeService.js');
    const result = await processDueWave8AgentSchedules({
      organizationId: 'org-1',
      now: '2026-08-08T09:00:00.000Z',
      workerId: 'worker-1',
      executeSchedule,
    });
    expect(result).toEqual([{ runId: 'agent-run-1' }]);
    expect(executeSchedule).toHaveBeenCalledTimes(1);
  });
});
