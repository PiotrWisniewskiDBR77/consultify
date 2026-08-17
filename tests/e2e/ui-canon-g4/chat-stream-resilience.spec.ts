import { randomUUID } from 'node:crypto';

import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import { expect, test } from '@playwright/test';

const databaseUrl = process.env.DATABASE_URL ?? '';
const runReal =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  databaseUrl.startsWith('postgres');

test.describe('CHAT-UI canonical interrupted-stream recovery', () => {
  test.skip(!runReal, 'requires the mounted app and real PostgreSQL');
  // Mounted application validators and several adjacent canonical readers use
  // UUID identities. Keep fixture labels in names/email, never in authority IDs.
  const organizationId = randomUUID();
  const userId = randomUUID();
  const conversationId = randomUUID();
  let pool: Pool;
  let token = '';

  test.beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });
    await pool.query(
      `INSERT INTO organizations (id,name,plan,status) VALUES ($1,$2,'enterprise','active')`,
      [organizationId, 'Chat recovery browser']
    );
    await pool.query(
      `INSERT INTO users (id,organization_id,email,password,role,status)
       VALUES ($1,$2,$3,'unused','OWNER','active')`,
      [userId, organizationId, `${userId}@example.test`]
    );
    await pool.query(
      `INSERT INTO organization_members (id,organization_id,user_id,role,status)
       VALUES ($1,$2,$3,'OWNER','ACTIVE')`,
      [randomUUID(), organizationId, userId]
    );
    await pool.query(
      `INSERT INTO conversations (id,user_id,organization_id,title) VALUES ($1,$2,$3,$4)`,
      [conversationId, userId, organizationId, 'Interrupted response']
    );
    await pool.query(
      `INSERT INTO conversation_messages (id,conversation_id,role,content,metadata)
       VALUES ($1,$2,'user',$3,'{}'::jsonb)`,
      [randomUUID(), conversationId, 'Resume the interrupted analysis']
    );
    await pool.query(
      `INSERT INTO ai_partial_responses
         (id,session_id,user_id,organization_id,content,updated_at)
       VALUES ($1,$2,$3,$4,$5,CURRENT_TIMESTAMP)`,
      [randomUUID(), conversationId, userId, organizationId, 'Recovered partial evidence. ']
    );
    const { default: config } = await import('../../../server/src/config/Config.js');
    token = jwt.sign(
      { id: userId, organizationId, role: 'OWNER', email: `${userId}@example.test` },
      config.JWT_SECRET,
      { expiresIn: '10m' }
    );
  });

  test.afterAll(async () => {
    if (!pool) return;
    await pool.query(`DELETE FROM ai_partial_responses WHERE session_id=$1`, [conversationId]);
    await pool.query(`DELETE FROM conversation_messages WHERE conversation_id=$1`, [
      conversationId,
    ]);
    await pool.query(`DELETE FROM conversations WHERE id=$1`, [conversationId]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id=$1`, [organizationId]);
    await pool.query(`DELETE FROM users WHERE id=$1`, [userId]);
    await pool.query(`DELETE FROM organizations WHERE id=$1`, [organizationId]);
    await pool.end();
  });

  test('cold deep-link offers an explicit keyboard-operable resume and clears the checkpoint', async ({
    page,
  }) => {
    await page.addInitScript((signedToken) => localStorage.setItem('token', signedToken), token);
    await page.goto(`/chat/${conversationId}`);

    const recovery = page.getByTestId('chat-partial-recovery');
    await expect(recovery).toContainText('An interrupted response is available.');
    const resume = recovery.getByRole('button', { name: 'Resume' });
    await resume.focus();
    await expect(resume).toBeFocused();
    await resume.press('Enter');

    await expect(recovery).toBeHidden();
    await expect
      .poll(async () => {
        const result = await pool.query(
          `SELECT count(*)::int AS n FROM ai_partial_responses WHERE session_id=$1`,
          [conversationId]
        );
        return result.rows[0].n;
      })
      .toBe(0);
  });
});
