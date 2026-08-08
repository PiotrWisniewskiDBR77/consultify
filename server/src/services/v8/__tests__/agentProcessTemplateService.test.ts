import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbAll = vi.fn();
const dbGet = vi.fn();
const dbRun = vi.fn();
const dbTransaction = vi.fn();
const createWorkGraph = vi.fn();

vi.mock('../../../utils/DbPromise.js', () => ({
  all: dbAll,
  get: dbGet,
  run: dbRun,
  transaction: dbTransaction,
}));
vi.mock('../multiAgentWorkManagerService.js', () => ({ createWorkGraph }));

const runtimeBundle = {
  promptKey: 'agent.transform',
  promptVersion: '1.0.0',
  modelId: 'gpt',
  modelVersion: '2026-08',
  policyVersion: 'policy-1',
  toolPolicyRefs: ['tools-1'],
  agentDefinitionVersions: { 'research-agent': '1.0.0' },
};
const graph = {
  mode: 'router_parallel' as const,
  leadAgentId: 'lead-teresa',
  runtimeBundle,
  tasks: [
    {
      key: 'research',
      specialistAgentId: 'research-agent',
      title: 'Research',
      objective: 'Gather evidence',
    },
  ],
};

describe('agentProcessTemplateService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbRun.mockResolvedValue({ success: true, changes: 1 });
    dbTransaction.mockResolvedValue({ success: true, results: [{ changes: 1 }, { changes: 1 }] });
  });

  it('creates the mutable head and immutable version snapshot atomically', async () => {
    const { createAgentProcessTemplate } = await import('../agentProcessTemplateService.js');
    const created = await createAgentProcessTemplate({
      organizationId: 'org-a',
      actorUserId: 'user-a',
      key: 'transformation',
      title: 'Transformation',
      graph,
    });
    expect(created).toEqual(expect.objectContaining({ version: 1, status: 'DRAFT' }));
    expect(dbTransaction).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ sql: expect.stringContaining('ai_playbook_templates') }),
        expect.objectContaining({ sql: expect.stringContaining('ai_playbook_template_versions') }),
      ])
    );
  });

  it('publishes only a draft and records the exact published version', async () => {
    dbGet.mockResolvedValue({
      id: 'template-1',
      organization_id: 'org-a',
      status: 'DRAFT',
      version: 2,
      template_graph: JSON.stringify(graph),
    });
    const { transitionAgentProcessTemplate } = await import('../agentProcessTemplateService.js');
    await expect(
      transitionAgentProcessTemplate({
        templateId: 'template-1',
        organizationId: 'org-a',
        actorUserId: 'owner-a',
        action: 'publish',
        reason: 'QA passed',
      })
    ).resolves.toEqual({ version: 2, status: 'PUBLISHED' });
    expect(dbRun).toHaveBeenCalledWith(expect.stringContaining('status_at_version'), [
      'PUBLISHED',
      'template-1',
      2,
    ]);
  });

  it('instantiates the immutable published version without changing source content', async () => {
    const { instantiateAgentProcessTemplate, runtimeBundleDigest } =
      await import('../agentProcessTemplateService.js');
    dbGet
      .mockResolvedValueOnce({
        id: 'template-1',
        organization_id: 'org-a',
        status: 'PUBLISHED',
        version: 3,
      })
      .mockResolvedValueOnce({
        template_id: 'template-1',
        version: 3,
        status_at_version: 'PUBLISHED',
        template_graph: JSON.stringify(graph),
        runtime_bundle_digest: runtimeBundleDigest(runtimeBundle),
      });
    createWorkGraph.mockResolvedValue({ graphId: 'graph-1', taskIds: { research: 'branch-1' } });
    await expect(
      instantiateAgentProcessTemplate({
        templateId: 'template-1',
        organizationId: 'org-a',
        actorUserId: 'user-a',
        executionRunId: 'run-1',
      })
    ).resolves.toEqual({ graphId: 'graph-1', templateVersion: 3 });
    expect(createWorkGraph).toHaveBeenCalledWith(
      expect.objectContaining({ tasks: graph.tasks, executionRunId: 'run-1' })
    );
    expect(
      dbRun.mock.calls.some(([sql]) =>
        String(sql).startsWith('UPDATE ai_playbook_template_versions')
      )
    ).toBe(false);
  });

  it('refuses to instantiate a draft or deprecated template', async () => {
    dbGet.mockResolvedValue(null);
    const { instantiateAgentProcessTemplate } = await import('../agentProcessTemplateService.js');
    await expect(
      instantiateAgentProcessTemplate({
        templateId: 'template-1',
        organizationId: 'org-a',
        actorUserId: 'user-a',
        executionRunId: 'run-1',
      })
    ).rejects.toThrow('published_agent_template_not_found');
    expect(createWorkGraph).not.toHaveBeenCalled();
  });
});
