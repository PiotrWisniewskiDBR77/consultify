import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createTemplate = vi.fn();
const reviseTemplate = vi.fn();
const transitionTemplate = vi.fn();
const instantiateTemplate = vi.fn();
const listTemplates = vi.fn();
const getRun = vi.fn();

vi.mock('../../../services/v8/agentProcessTemplateService.js', () => ({
  createAgentProcessTemplate: createTemplate,
  reviseAgentProcessTemplate: reviseTemplate,
  transitionAgentProcessTemplate: transitionTemplate,
  instantiateAgentProcessTemplate: instantiateTemplate,
  listAgentProcessTemplates: listTemplates,
}));
vi.mock('../../../services/v8/executionSpineService.js', () => ({ getRun }));

const graph = {
  mode: 'sequential',
  leadAgentId: 'lead-teresa',
  tasks: [
    {
      key: 'one',
      specialistAgentId: 'research-agent',
      title: 'Research',
      objective: 'Gather evidence',
    },
  ],
};

async function appFor(userRole: string, userId = 'user-a') {
  const { default: router } = await import('../agent-process-templates.routes.js');
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).v8Context = { organizationId: 'org-a', userId, userRole, isSuperAdmin: false };
    next();
  });
  app.use('/api/v8/agent-process-templates', router);
  return app;
}

describe('agent process template routes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('denies template creation to a regular consultant', async () => {
    const response = await request(await appFor('CONSULTANT'))
      .post('/api/v8/agent-process-templates')
      .send({ key: 'x', title: 'X', graph });
    expect(response.status).toBe(403);
    expect(createTemplate).not.toHaveBeenCalled();
  });

  it('uses authenticated organization and actor for admin creation', async () => {
    createTemplate.mockResolvedValue({ templateId: 'template-1', version: 1, status: 'DRAFT' });
    const response = await request(await appFor('ADMIN', 'admin-a'))
      .post('/api/v8/agent-process-templates')
      .send({
        key: 'x',
        title: 'X',
        graph,
        organizationId: 'org-foreign',
        actorUserId: 'attacker',
      });
    expect(response.status).toBe(201);
    expect(createTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-a', actorUserId: 'admin-a' })
    );
  });

  it('preserves a governed planning blueprint through template validation', async()=>{
    createTemplate.mockResolvedValue({templateId:'template-plan',version:1,status:'DRAFT'});
    const step={lifecycleStage:'mandate',businessPurpose:'Confirm mandate',moduleTarget:'Agent',capabilityStatus:'PROPOSAL_ONLY',inputs:[],outputs:['plan'],ownerRole:'Sponsor',dependsOn:[],approvalClass:'requires_human_approval',riskClass:'safe_additive',executionMode:'foreground',estimatedEffort:'1 h',blockerReason:'No verified runtime capability binding.'};
    const response=await request(await appFor('OWNER')).post('/api/v8/agent-process-templates').send({key:'planning',title:'Planning',graph:{...graph,planningBlueprint:{intakeDefaults:{mandate:'Transform operations'},steps:[step]}}});
    expect(response.status).toBe(201);expect(createTemplate).toHaveBeenCalledWith(expect.objectContaining({graph:expect.objectContaining({planningBlueprint:expect.objectContaining({steps:[step]})})}));
  });

  it('requires a governance reason for publication', async () => {
    const response = await request(await appFor('OWNER'))
      .post('/api/v8/agent-process-templates/template-1/publish')
      .send({});
    expect(response.status).toBe(400);
    expect(transitionTemplate).not.toHaveBeenCalled();
  });

  it('refuses instantiation when the run is not visible in the tenant', async () => {
    getRun.mockResolvedValue(null);
    const response = await request(await appFor('CONSULTANT'))
      .post('/api/v8/agent-process-templates/template-1/instantiate')
      .send({ executionRunId: 'foreign-run' });
    expect(response.status).toBe(404);
    expect(instantiateTemplate).not.toHaveBeenCalled();
  });
});
