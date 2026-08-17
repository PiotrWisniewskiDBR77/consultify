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

  const seedBrowserAuth = async (page: import('@playwright/test').Page) => {
    await page.addInitScript(
      ({ signedToken, signedUserId, signedOrganizationId }) => {
        const user = {
          id: signedUserId,
          email: `${signedUserId}@example.test`,
          role: 'OWNER',
          organizationId: signedOrganizationId,
          organizationName: 'Chat recovery browser',
          firstName: 'Chat',
          lastName: 'Owner',
          isAuthenticated: true,
          accessLevel: 'full',
          isDemo: false,
        };
        localStorage.setItem('token', signedToken);
        localStorage.setItem('user', JSON.stringify(user));
        localStorage.setItem(`consultify_onboarding_done:${signedUserId}`, 'true');
        localStorage.setItem(
          'consultify-storage',
          JSON.stringify({
            state: {
              sessionMode: 'FULL',
              isDemoMode: false,
              isDemoSession: false,
              currentUser: user,
              currentOrganization: { id: signedOrganizationId, name: 'Chat recovery browser' },
            },
            version: 0,
          })
        );
      },
      { signedToken: token, signedUserId: userId, signedOrganizationId: organizationId }
    );
  };

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
    let streamInvocations = 0;
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().includes('/api/ai/chat/stream')) {
        streamInvocations += 1;
      }
    });
    await seedBrowserAuth(page);
    await page.goto(`/chat/${conversationId}`);

    const recovery = page.getByTestId('chat-partial-recovery');
    await expect(recovery).toContainText('An interrupted response is available.');
    expect(streamInvocations).toBe(0);
    const resume = recovery.getByRole('button', { name: 'Resume' });
    await resume.focus();
    await expect(resume).toBeFocused();
    await resume.press('Enter');

    await expect.poll(() => streamInvocations).toBe(1);
    await expect(page.getByText(/Recovered partial evidence\./)).toBeVisible();
    await expect(page.getByText(/E2E_OK: Received/)).toBeVisible();
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

  test('a failed explicit resume retains the durable checkpoint for retry', async ({ page }) => {
    await pool.query(
      `INSERT INTO ai_partial_responses
         (id,session_id,user_id,organization_id,content,updated_at)
       VALUES ($1,$2,$3,$4,$5,CURRENT_TIMESTAMP)
       ON CONFLICT(organization_id,user_id,session_id)
       DO UPDATE SET content=excluded.content,updated_at=CURRENT_TIMESTAMP`,
      [randomUUID(), conversationId, userId, organizationId, 'Retryable partial evidence. ']
    );
    let streamInvocations = 0;
    await page.route('**/api/ai/chat/stream', async (route) => {
      streamInvocations += 1;
      await route.abort('failed');
    });
    await seedBrowserAuth(page);
    await page.goto(`/chat/${conversationId}`);
    const recovery = page.getByTestId('chat-partial-recovery');
    await expect(recovery.getByRole('button', { name: 'Resume' })).toBeVisible();
    expect(streamInvocations).toBe(0);
    await recovery.getByRole('button', { name: 'Resume' }).click();
    await expect.poll(() => streamInvocations).toBe(1);
    const residue = await pool.query(
      `SELECT content FROM ai_partial_responses
       WHERE session_id=$1 AND user_id=$2 AND organization_id=$3`,
      [conversationId, userId, organizationId]
    );
    expect(residue.rows).toEqual([{ content: 'Retryable partial evidence. ' }]);
  });
});
