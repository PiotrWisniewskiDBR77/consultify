const { reserveAgentResource } =
  await import('../services/v8/agentResourceGovernanceService.js');

const result = await reserveAgentResource({
  organizationId: 'org-a09',
  projectId: 'project-restart',
  runId: 'run-stale',
  userId: 'user-a09',
  agentId: 'execution-agent',
  toolName: 'bounded-tool',
  idempotencyKey: 'stale-key',
  estimatedCostUsd: 0.2,
  now: '2026-08-08T10:00:00.000Z',
  leaseSeconds: 1,
});

if (!result.allowed || result.status !== 'reserved') {
  throw new Error(`restart_worker_reservation_failed:${result.reason}`);
}
console.log('A09_RESTART_WORKER_RESERVED');
