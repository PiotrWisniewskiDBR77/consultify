/** @vitest-environment node
 *
 * Modul17 domkniecie — KROK 1 (przygotowanie BEZ MODELU).
 *
 * Cel: dowiesc, ze pelna sciezka HTTP (JWT -> ApiGateway -> /api/ai/chat/stream
 * -> AIPipeline (atrapa, wzorzec z day217-gf-agt-02.realdb.test.ts) ->
 * context.executeReadTool('search_knowledge_base', { vault_project_id: NAZWA })
 * -> real executeKBSearch -> real Postgres) dziala end-to-end, ZANIM wydamy
 * jedyny dozwolony przebieg realnego modelu. Atrapa modelu podaje dokladnie
 * ten ksztalt argumentu co zywy model w dyzurze 217: vault_project_id jako
 * NAZWA projektu, nie UUID.
 */
import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { assertRealPostgresTestEnvironment } from './_helpers/assertRealPostgres.js';
import { EmbeddingService } from '../../server/src/services/ai/embeddingService.js';

process.env.ENABLE_TERESA_TOOL_LOOP = 'true';

const PROJECT_NAME = 'Modul17 Krok1 Project';
const MARKER = `ZNACZNIK-MODUL17-K1-${randomUUID().slice(0, 8)}`;

vi.mock('../../server/src/services/ai/AIPipeline.js', async () => {
  const actual = (await vi.importActual('../../server/src/services/ai/AIPipeline.js')) as any;
  class InjectedM17Pipeline {
    static getInstance() {
      return new InjectedM17Pipeline();
    }
    async process(pipelineRequest: any) {
      const executeRead = pipelineRequest?.options?.readTools?.context?.executeReadTool;
      let readResult = '';
      if (typeof executeRead === 'function') {
        // Dokladnie ksztalt argumentu z dyzuru 217: NAZWA, nie UUID.
        readResult = await executeRead('search_knowledge_base', {
          query: MARKER,
          vault_scope: 'project',
          vault_project_id: PROJECT_NAME,
        });
      }
      return { success: true, content: `atrapa odpowiedzi: ${readResult}`, metadata: {} };
    }
  }
  return { ...actual, AIPipeline: InjectedM17Pipeline };
});

const NO_RETRY = { retry: 0 } as const;
const databaseUrl = process.env.DATABASE_URL ?? '';

describe('Modul17 Krok1 — atrapa modelu przez pelna sciezke HTTP', NO_RETRY, () => {
  const organizationId = randomUUID();
  const userId = randomUUID();
  const projectId = randomUUID();
  const docId = `m17-k1-doc-${randomUUID()}`;
  const pool = new Pool({ connectionString: databaseUrl });
  const app = express();
  let authorization = '';

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
    await pool.query(`INSERT INTO organizations(id,name,status) VALUES($1,$2,'active')`, [organizationId, 'Modul17 Krok1 org']);
    await pool.query(`UPDATE organizations SET onboarding_status='ORG_SETUP_COMPLETED' WHERE id=$1`, [organizationId]);
    await pool.query(
      `INSERT INTO users(id,organization_id,email,password,role,status,email_verified)
       VALUES($1,$2,$3,'unused','OWNER','active',1)`,
      [userId, organizationId, `m17-k1-${userId}@test.invalid`]
    );
    await pool.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status)
       VALUES($1,$2,$3,'OWNER','ACTIVE')`,
      [randomUUID(), organizationId, userId]
    );
    await pool.query(`INSERT INTO projects(id,organization_id,name,status,owner_id) VALUES($1,$2,$3,'active',$4)`, [projectId, organizationId, PROJECT_NAME, userId]);
    await pool.query(`INSERT INTO project_ai_settings(project_id,ai_role) VALUES($1,'OPERATOR')`, [projectId]);
    await pool.query(`INSERT INTO ai_policies(id,organization_id,name,policy_level,max_policy_level) VALUES($1,$2,'Modul17 Krok1 policy','ASSISTED','ASSISTED')`, [randomUUID(), organizationId]);
    // Route sprawdza obecnosc skonfigurowanego providera PRZED wejsciem w
    // AIPipeline (nawet atrapowany) — bez tego wiersza dostajemy
    // NO_LLM_PROVIDER i atrapa nigdy nie jest wywolana (zmierzone: pierwszy
    // przebieg tego testu). Wzorzec z day217-gf-agt-02.realdb.test.ts.
    await pool.query(
      `INSERT INTO llm_providers(id,name,provider,model_id,api_key,tier,is_active,is_default)
       VALUES($1,'Modul17 Krok1 injected','openrouter','openai/gpt-4o-mini','injected-not-sent','standard',true,true)
       ON CONFLICT(id) DO NOTHING`,
      [`m17-k1-provider-${organizationId}`]
    );

    const { default: KnowledgeService } = await import('../../server/src/services/KnowledgeService.js');
    await KnowledgeService.addDocument('m17-k1.txt', '/m17-k1/doc.txt', organizationId, projectId, MARKER.length, 'test', [], docId, userId, 'project');
    await KnowledgeService.processDocument(docId, MARKER, organizationId);

    authorization = `Bearer ${jwt.sign({ id: userId, userId, organizationId, organization_id: organizationId, role: 'OWNER', email: `m17-k1-${userId}@test.invalid` }, config.JWT_SECRET, { expiresIn: '30m', jwtid: randomUUID() })}`;
  }, 30_000);

  beforeEach(() => {
    vi.spyOn(EmbeddingService.prototype, 'generateEmbedding').mockResolvedValue(Array.from({ length: 1536 }, () => 0.01));
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM llm_providers WHERE id=$1`, [`m17-k1-provider-${organizationId}`]);
    await pool.query(`DELETE FROM knowledge_chunks WHERE doc_id=$1`, [docId]);
    await pool.query(`DELETE FROM knowledge_docs WHERE id=$1`, [docId]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id=$1`, [organizationId]);
    await pool.query(`DELETE FROM ai_policies WHERE organization_id=$1`, [organizationId]);
    await pool.query(`DELETE FROM project_ai_settings WHERE project_id=$1`, [projectId]);
    await pool.query(`DELETE FROM projects WHERE id=$1`, [projectId]);
    await pool.query(`DELETE FROM users WHERE id=$1`, [userId]);
    await pool.query(`DELETE FROM organizations WHERE id=$1`, [organizationId]);
    await pool.end();
    const pgModule = await import('../../server/src/database/PostgresDatabase.js');
    await (pgModule as any).closePool?.();
  });

  it('200, niepuste events, tresc ze znacznikiem gdy narzedzie dostaje NAZWE projektu', async () => {
    const chat = await request(app)
      .post('/api/ai/chat/stream')
      .set('Authorization', authorization)
      .send({ message: `${MARKER} sprawdz baze wiedzy`, history: [], conversationId: randomUUID(), context: { projectId } });
    expect(chat.status).toBe(200);
    const events = String(chat.text || '')
      .split('\n')
      .filter((line) => line.startsWith('data: '))
      .map((line) => {
        try {
          return JSON.parse(line.slice(6));
        } catch {
          return null;
        }
      })
      .filter(Boolean);
    expect(events.length, JSON.stringify(events)).toBeGreaterThan(0);
    const joined = JSON.stringify(events);
    expect(joined, `events: ${joined}`).toContain(MARKER);
  });
});
