/** @vitest-environment node */
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { assertRealPostgresTestEnvironment } from './_helpers/assertRealPostgres.js';
import { EmbeddingService } from '../../server/src/services/ai/embeddingService.js';

process.env.ENABLE_TERESA_TOOL_LOOP = 'true';
process.env.ENABLE_TERESA_TOOL_LOOP_WRITE = 'true';
process.env.ENABLE_ARTIFACT_KNOWLEDGE_INDEX = 'true';

const captured = vi.hoisted(() => ({ prompts: [] as string[], reads: [] as any[] }));
const ORG_CONTEXT_MARKER = 'DAY217-ORG-CONTEXT-89630f9a8a';

vi.mock('../../server/src/services/ai/AIPipeline.js', async () => {
  const actual = (await vi.importActual('../../server/src/services/ai/AIPipeline.js')) as any;
  class InjectedDay217Pipeline {
    static getInstance() {
      return new InjectedDay217Pipeline();
    }
    async process(pipelineRequest: any) {
      const { default: organizationContextService } = await import('../../server/src/services/organizationContext/OrganizationContextService.js');
      const org = await organizationContextService.buildResolvedContext(String(pipelineRequest?.organizationId));
      captured.prompts.push((actual.aiPipeline as any).buildOrganizationSection(org));
      const executeRead = pipelineRequest?.options?.readTools?.context?.executeReadTool;
      if (typeof executeRead === 'function') {
        captured.reads.push(await executeRead('search_knowledge_base', { query: 'Day217' }));
      }
      const propose = pipelineRequest?.options?.writeProposalTools?.context?.onProposalToolCall;
      if (typeof propose === 'function') {
        await propose('create_task', {
          title: String(pipelineRequest?.prompt || 'Day217 task'),
          description: 'GF-AGT-02 injected provider call',
        });
      }
      return { success: true, content: 'Day217 injected turn complete', metadata: {} };
    }
  }
  return { ...actual, AIPipeline: InjectedDay217Pipeline };
});

const NO_RETRY = { retry: 0 } as const;
const databaseUrl = process.env.DATABASE_URL ?? '';
const artifactPath = '/private/tmp/cx-day217-gf-agt-02-artefakty/day217-chain.json';

describe('Day217 GF-AGT-02 — injected chain through ApiGateway/JWT/Postgres, repeated 3x', NO_RETRY, () => {
  const organizationId = randomUUID();
  const userId = randomUUID();
  const projectId = randomUUID();
  const pool = new Pool({ connectionString: databaseUrl });
  const app = express();
  let authorization = '';
  const runs: any[] = [];

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    await assertRealPostgresTestEnvironment();
    process.env.INTERNAL_TOOLS_ENABLED = 'true';
    process.env.INTERNAL_TOOLS_ALLOWED_EMAIL_DOMAINS = 'test.invalid';
    const [{ ApiGateway }, { default: config }] = await Promise.all([
      import('../../server/src/Gateway.js'),
      import('../../server/src/config/Config.js'),
    ]);
    app.use(express.json({ limit: '10mb' }));
    ApiGateway.getInstance().initializeRoutes(app);
    await pool.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS governance_settings TEXT DEFAULT '{}'`);
    await pool.query(`INSERT INTO organizations(id,name,status) VALUES($1,$2,'active')`, [organizationId, 'Day217 GF org']);
    await pool.query(
      `INSERT INTO users(id,organization_id,email,password,role,status,email_verified)
       VALUES($1,$2,$3,'unused','OWNER','active',1)`,
      [userId, organizationId, `day217-${userId}@test.invalid`]
    );
    await pool.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status)
       VALUES($1,$2,$3,'OWNER','ACTIVE')`,
      [randomUUID(), organizationId, userId]
    );
    await pool.query(`INSERT INTO projects(id,organization_id,name,status,owner_id) VALUES($1,$2,'Day217 project','active',$3)`, [projectId, organizationId, userId]);
    await pool.query(`INSERT INTO project_ai_settings(project_id,ai_role) VALUES($1,'OPERATOR')`, [projectId]);
    await pool.query(`INSERT INTO ai_policies(id,organization_id,name,policy_level,max_policy_level) VALUES($1,$2,'Day217 policy','ASSISTED','ASSISTED')`, [randomUUID(), organizationId]);
    const { default: organizationContextService } = await import('../../server/src/services/organizationContext/OrganizationContextService.js');
    await organizationContextService.recordOrganizationContextStoreSave({ organizationId, userId, synthesis: { content: ORG_CONTEXT_MARKER } });
    await pool.query(
      `INSERT INTO llm_providers(id,name,provider,model_id,api_key,tier,is_active,is_default)
       VALUES($1,'Day217 injected','openrouter','openai/gpt-4o-mini','injected-not-sent','standard',true,true)
       ON CONFLICT(id) DO NOTHING`,
      [`day217-provider-${organizationId}`]
    );
    authorization = `Bearer ${jwt.sign({ id: userId, userId, organizationId, organization_id: organizationId, role: 'OWNER', email: `day217-${userId}@test.invalid` }, config.JWT_SECRET, { expiresIn: '30m', jwtid: randomUUID() })}`;
  }, 30_000);

  beforeEach(() => {
    vi.spyOn(EmbeddingService.prototype, 'generateEmbedding').mockResolvedValue(Array.from({ length: 1536 }, () => 0.01));
  });

  afterAll(async () => {
    writeFileSync(artifactPath, JSON.stringify({ coordinates: { database: new URL(databaseUrl).port, gateway: 'ApiGateway', jwt: true }, fixture: { organizationId, userId, projectId, organizationContextMarker: ORG_CONTEXT_MARKER }, runs, prompts: captured.prompts, reads: captured.reads }, null, 2));
    await pool.query(`DELETE FROM llm_providers WHERE id=$1`, [`day217-provider-${organizationId}`]);
    await pool.end();
    const pgModule = await import('../../server/src/database/PostgresDatabase.js');
    await (pgModule as any).closePool?.();
  });

  it('approval gate rejects execution of a still-PENDING proposal and leaves tasks unchanged', async () => {
    const { default: executor } = await import('../../server/src/services/aiActionExecutor.js');
    const proposal = await executor.requestChatToolProposal({
      toolName: 'create_task',
      args: { title: 'Day217 pending mutation sentinel' },
      userId,
      organizationId,
      projectId,
    });
    expect(proposal).toMatchObject({ success: true, status: 'PENDING' });
    const result = await executor.executeAction(proposal.actionId, userId);
    expect(result.success).toBe(false);
    const count = await pool.query(`SELECT count(*)::int count FROM tasks WHERE source_id=$1`, [proposal.actionId]);
    expect(count.rows[0].count).toBe(0);
  });

  for (let index = 1; index <= 3; index++) {
    it(`run ${index}: chat READ + proposal approval + My Work task + Document Studio knowledge index`, async () => {
      const marker = `ZNACZNIK-DAY217-${randomUUID().slice(0, 8)}`;
      const chat = await request(app)
        .post('/api/ai/chat/stream')
        .set('Authorization', authorization)
        .send({ message: `${marker} przygotuj zadanie`, history: [], conversationId: randomUUID(), context: { projectId } });
      expect(chat.status).toBe(200);
      const events = String(chat.text || '').split('\n').filter((line) => line.startsWith('data: ')).map((line) => { try { return JSON.parse(line.slice(6)); } catch { return null; } }).filter(Boolean);
      expect(events.some((event: any) => event.type === 'tool_step'), JSON.stringify(events)).toBe(true);
      expect(captured.reads.length).toBeGreaterThanOrEqual(index);
      const proposalEvent = events.find((event: any) => event.type === 'execution_proposal');
      expect(proposalEvent?.proposalId).toBeTruthy();
      const actionId = String(proposalEvent.proposalId);
      expect((await pool.query(`SELECT count(*)::int count FROM tasks WHERE source_id=$1`, [actionId])).rows[0].count).toBe(0);

      const approve = await request(app).patch(`/api/ai/actions/${actionId}/approve`).set('Authorization', authorization).send({});
      expect(approve.status).toBe(200);
      expect((await pool.query(`SELECT status FROM ai_actions WHERE id=$1`, [actionId])).rows[0].status).toBe('APPROVED');
      expect((await pool.query(`SELECT count(*)::int count FROM tasks WHERE source_id=$1`, [actionId])).rows[0].count).toBe(0);
      const execute = await request(app).post(`/api/ai/actions/${actionId}/execute`).set('Authorization', authorization).send({});
      expect(execute.status).toBe(200);
      const task = (await pool.query(`SELECT id,title,source_type,source_id FROM tasks WHERE source_id=$1`, [actionId])).rows;
      expect(task).toHaveLength(1);
      expect(task[0]).toMatchObject({ source_type: 'ai_chat_proposal', source_id: actionId });
      const myWork = await request(app).get('/api/my-work/personal-tasks').set('Authorization', authorization);
      expect(myWork.status).toBe(200);
      expect(myWork.body.some((row: any) => row.id === task[0].id)).toBe(true);

      const generated = await request(app).post('/api/document-studio/generate').set('Authorization', authorization).send({ intake: { title: `Day217 knowledge topic run ${index}`, description: `Poufny materiał ${marker}`, documentType: 'executive_memo', confidentiality: 'internal' }, useLlm: false });
      expect(generated.status).toBe(200);
      const artifactId = String(generated.body.artifactId);
      const knowledgeId = `generated-document-${artifactId}`;
      let knowledge: any;
      for (let attempt = 0; attempt < 30; attempt++) {
        knowledge = (await pool.query(`SELECT id,scope,owner_id,organization_id FROM knowledge_docs WHERE id=$1`, [knowledgeId])).rows[0];
        if (knowledge) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      expect(knowledge).toMatchObject({ scope: 'organization', owner_id: userId, organization_id: organizationId });
      const embeddings = (await pool.query(`SELECT count(*)::int count FROM ai_knowledge_embeddings WHERE document_id=$1`, [knowledgeId])).rows[0].count;
      expect(embeddings).toBeGreaterThan(0);
      const artifact = (await pool.query(`SELECT artifact_id,content_json_native FROM wave5_artifacts WHERE artifact_id=$1 AND organization_id=$2`, [artifactId, organizationId])).rows[0];
      expect(JSON.stringify(artifact)).toContain(marker);
      runs.push({ index, marker, actionId, task: task[0], artifactId, knowledge, embeddings, http: { chat: chat.status, approve: approve.status, execute: execute.status, myWork: myWork.status, generate: generated.status } });
    }, 30_000);
  }
});
