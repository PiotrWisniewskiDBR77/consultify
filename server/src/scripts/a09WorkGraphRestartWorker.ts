const { reserveAgentResource } =
  await import('../services/v8/agentResourceGovernanceService.js');

const result = await reserveAgentResource({
  organizationId: 'org-work-graph',
  projectId: 'project-restart',
  runId: 'canonical-restart',
  userId: 'worker-user',
  agentId: 'research-agent',
  toolName: 'work_graph.branch.launch',
  idempotencyKey: 'work-graph:canonical-restart:graph-r:task-r:attempt:1',
  estimatedCostUsd: 0,
  now: '2026-08-08T12:00:00.000Z',
  leaseSeconds: 1,
});
if (!result.allowed) throw new Error(result.reason);
console.log('A09_WORK_GRAPH_RESTART_RESERVED');
