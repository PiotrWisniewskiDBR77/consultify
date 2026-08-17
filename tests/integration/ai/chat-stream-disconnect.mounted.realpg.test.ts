/** @vitest-environment node */
import http from 'node:http';
import { randomUUID } from 'node:crypto';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../_helpers/assertRealPostgres.js';

const pipeline = vi.hoisted(() => ({ invocations: 0 }));

vi.mock('../../../server/src/services/ai/AIPipeline.js', () => ({
  AIPipeline: class {
    async process() {
      pipeline.invocations += 1;
      const invocation = pipeline.invocations;
      if (invocation === 1) await new Promise((resolve) => setTimeout(resolve, 2_150));
      return {
        success: true,
        metadata: { provider: 'mounted-test', model: 'delayed-stream' },
        stream: (async function* () {
          if (invocation === 1) {
            yield 'Disconnected partial evidence. ';
            await new Promise((resolve) => setTimeout(resolve, 500));
            yield 'must not reach the disconnected client';
            return;
          }
          yield 'Continued final evidence.';
        })(),
      };
    }
  },
}));

const DATABASE_URL = process.env.DATABASE_URL ?? '';
const REAL_DB =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  DATABASE_URL.startsWith('postgres');

describe.skipIf(!REAL_DB)('CHAT mounted disconnect to cold explicit recovery', () => {
  const orgId = randomUUID();
  const userId = randomUUID();
  const conversationId = randomUUID();
  let pool: Pool;
  let server: http.Server;
  let baseUrl = '';
  let token = '';

  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
    process.env.E2E_MODE = 'false';
    process.env.OPENROUTER_API_KEY = 'mounted-test-provider-present';
    pool = new Pool({ connectionString: DATABASE_URL });
    await pool.query(
      `INSERT INTO organizations(id,name,plan,status) VALUES($1,'Chat disconnect','enterprise','active')`,
      [orgId]
    );
    await pool.query(
      `INSERT INTO users(id,organization_id,email,password,role,status)
       VALUES($1,$2,$3,'unused','OWNER','active')`,
      [userId, orgId, `${userId}@example.test`]
    );
    await pool.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status)
       VALUES($1,$2,$3,'OWNER','ACTIVE')`,
      [randomUUID(), orgId, userId]
    );
    await pool.query(
      `INSERT INTO conversations(id,user_id,organization_id,title)
       VALUES($1,$2,$3,'Interrupted provider stream')`,
      [conversationId, userId, orgId]
    );
    await pool.query(
      `INSERT INTO conversation_messages(id,conversation_id,role,content,metadata)
       VALUES($1,$2,'user','Resume the interrupted provider stream','{}'::jsonb)`,
      [randomUUID(), conversationId]
    );

    const { default: config } = await import('../../../server/src/config/Config.js');
    token = jwt.sign(
      { id: userId, organizationId: orgId, role: 'OWNER', email: `${userId}@example.test` },
      config.JWT_SECRET,
      { expiresIn: '10m' }
    );
    const { default: aiRouter } = await import('../../../server/src/routes/ai.routes.js');
    const app = express();
    app.use(express.json());
    app.use('/api/ai', aiRouter);
    server = await new Promise<http.Server>((resolve) => {
      const mounted = app.listen(0, '127.0.0.1', () => resolve(mounted));
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('mounted_chat_address_missing');
    baseUrl = `http://127.0.0.1:${address.port}`;
  }, 60_000);

  afterAll(async () => {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    if (!pool) return;
    await pool.query(`DELETE FROM ai_partial_responses WHERE session_id=$1`, [conversationId]);
    await pool.query(`DELETE FROM conversation_messages WHERE conversation_id=$1`, [
      conversationId,
    ]);
    await pool.query(`DELETE FROM conversations WHERE id=$1`, [conversationId]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id=$1`, [orgId]);
    await pool.query(`DELETE FROM users WHERE id=$1`, [userId]);
    await pool.query(`DELETE FROM organizations WHERE id=$1`, [orgId]);
    await pool.end();
  });

  const body = (resumeFromPartial: boolean) =>
    JSON.stringify({
      message: 'Resume the interrupted provider stream',
      conversationId,
      resumeFromPartial,
      provider: 'openrouter',
    });

  const mountedRequest = (
    method: 'GET' | 'POST',
    path: string,
    payload?: string
  ): Promise<{ status: number; text: string }> =>
    new Promise((resolve, reject) => {
      const req = http.request(
        `${baseUrl}${path}`,
        {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            ...(payload
              ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
              : {}),
          },
        },
        (res) => {
          let text = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => (text += chunk));
          res.on('end', () => resolve({ status: res.statusCode ?? 0, text }));
        }
      );
      req.on('error', reject);
      req.end(payload);
    });

  it('persists an active disconnected stream and resumes only on the explicit cold request', async () => {
    await new Promise<void>((resolve, reject) => {
      const payload = body(false);
      const req = http.request(
        `${baseUrl}/api/ai/chat/stream`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
          },
        },
        (res) => {
          res.setEncoding('utf8');
          res.on('data', (chunk) => {
            if (!String(chunk).includes('Disconnected partial evidence.')) return;
            req.destroy();
            resolve();
          });
        }
      );
      req.on('error', (error) => {
        if ((error as NodeJS.ErrnoException).code === 'ECONNRESET') return;
        reject(error);
      });
      req.end(payload);
    });

    await expect
      .poll(
        async () => {
          const cold = new Pool({ connectionString: DATABASE_URL, max: 1 });
          try {
            const result = await cold.query(
              `SELECT content FROM ai_partial_responses
               WHERE organization_id=$1 AND user_id=$2 AND session_id=$3`,
              [orgId, userId, conversationId]
            );
            return result.rows[0]?.content ?? null;
          } finally {
            await cold.end();
          }
        },
        { timeout: 10_000 }
      )
      .toBe('Disconnected partial evidence. ');

    const beforeDiscovery = pipeline.invocations;
    const discovered = await mountedRequest('GET', `/api/ai/stream/partial/${conversationId}`);
    expect(discovered.status).toBe(200);
    expect(JSON.parse(discovered.text)).toMatchObject({
      content: 'Disconnected partial evidence. ',
      canResume: true,
    });
    expect(pipeline.invocations).toBe(beforeDiscovery);

    const resumed = await mountedRequest('POST', '/api/ai/chat/stream', body(true));
    expect(resumed.status).toBe(200);
    expect(pipeline.invocations).toBe(beforeDiscovery + 1);
    expect(resumed.text).toContain('Disconnected partial evidence.');
    expect(resumed.text).toContain('Continued final evidence.');
    expect(
      Number(
        (
          await pool.query(
            `SELECT count(*)::int n FROM ai_partial_responses
             WHERE organization_id=$1 AND user_id=$2 AND session_id=$3`,
            [orgId, userId, conversationId]
          )
        ).rows[0].n
      )
    ).toBe(0);
  }, 30_000);
});
