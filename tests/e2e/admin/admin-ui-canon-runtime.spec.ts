import { expect, test } from '@playwright/test';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';

import config from '../../../server/src/config/Config';
import {
  getPrivilegedSession,
  makeRunId,
  type PrivilegedSession,
} from '../_helpers/privilegedSession';
import { injectSession } from '../m06/_m06';

const API = process.env.E2E_API_URL || 'http://127.0.0.1:3001';
const SUPPORT_KEY = process.env.TEST_SUPPORT_KEY || 'local-test-support-key-change-me';
const realDb =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  (process.env.DATABASE_URL || '').startsWith('postgres');

const headers = (token: string) => ({ Authorization: `Bearer ${token}` });

async function cleanup(request: any, runId: string) {
  const response = await request.post(`${API}/api/test-support/cleanup`, {
    headers: { 'x-test-support-key': SUPPORT_KEY, 'content-type': 'application/json' },
    data: { runId },
  });
  expect(response.ok(), await response.text()).toBe(true);
}

async function seedBrowser(page: any, session: PrivilegedSession) {
  await injectSession(page, {
    token: session.token,
    user: {
      id: session.userId,
      email: session.email,
      role: session.role,
      organizationId: session.organizationId,
    },
  });
}

test.describe('ADM-UI-CANON-001 mounted role and authoritative-state matrix', () => {
  test.skip(!realDb, 'requires mounted application and real PostgreSQL');
  test.describe.configure({ mode: 'serial' });
  const runIds: string[] = [];

  test.afterEach(async ({ request }) => {
    while (runIds.length) await cleanup(request, runIds.pop()!);
  });

  test('ADMIN and OWNER open IAM/audit/health while MEMBER, GUEST, revoked and SUPERADMIN fail closed', async ({
    page,
    browser,
    request,
  }) => {
    const adminRun = makeRunId('adm-ui-admin');
    runIds.push(adminRun);
    const admin = await getPrivilegedSession(request, { runId: adminRun, role: 'ADMIN' });

    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
    await pool.query(`UPDATE users SET role='OWNER' WHERE id=$1 AND organization_id=$2`, [
      admin.userId,
      admin.organizationId,
    ]);
    await pool.query(
      `UPDATE organization_members SET role='OWNER' WHERE user_id=$1 AND organization_id=$2`,
      [admin.userId, admin.organizationId]
    );
    const ownerToken = jwt.sign(
      {
        id: admin.userId,
        email: admin.email,
        role: 'OWNER',
        organizationId: admin.organizationId,
        runId: adminRun,
      },
      config.JWT_SECRET,
      { expiresIn: '10m' }
    );
    const owner: PrivilegedSession = { ...admin, token: ownerToken, role: 'OWNER' };

    const addAdmin = await request.post(`${API}/api/test-support/member`, {
      headers: { 'x-test-support-key': SUPPORT_KEY, 'content-type': 'application/json' },
      data: { runId: adminRun, role: 'ADMIN' },
    });
    expect(addAdmin.status(), await addAdmin.text()).toBe(201);
    const adminMemberPayload = (await addAdmin.json()) as Pick<
      PrivilegedSession,
      'runId' | 'organizationId' | 'userId' | 'token'
    >;
    const adminMember: PrivilegedSession = {
      ...adminMemberPayload,
      role: 'ADMIN',
      isSuperAdmin: false,
      email: `e2e+${adminRun}-admin@local.test`,
    };

    for (const session of [owner, adminMember]) {
      for (const endpoint of [
        '/api/admin/iam/policy',
        '/api/admin/audit-logs?limit=1',
        '/api/admin/health-panel/probes',
      ]) {
        const response = await request.get(`${API}${endpoint}`, {
          headers: headers(session.token),
        });
        expect(response.status(), `${session.role} ${endpoint}`).toBe(200);
      }
    }

    await seedBrowser(page, owner);
    await page.goto('/admin/security?tab=iam');
    await expect(page.getByText('Enterprise IAM Governance')).toBeVisible();
    await page.goto('/admin/audit');
    await expect(page.getByText('Total logs')).toBeVisible();
    await page.goto('/admin/health');
    await expect(page.getByText(/Health/).first()).toBeVisible();

    for (const role of ['USER', 'GUEST'] as const) {
      const runId = makeRunId(`adm-ui-${role.toLowerCase()}`);
      runIds.push(runId);
      const session = await getPrivilegedSession(request, { runId, role });
      const response = await request.get(`${API}/api/admin/iam/policy`, {
        headers: headers(session.token),
      });
      expect(response.status()).toBe(403);
    }

    const revokedMember = await request.post(`${API}/api/test-support/member`, {
      headers: { 'x-test-support-key': SUPPORT_KEY, 'content-type': 'application/json' },
      data: { runId: adminRun, role: 'ADMIN' },
    });
    expect(revokedMember.status(), await revokedMember.text()).toBe(201);
    const revoked = (await revokedMember.json()) as PrivilegedSession;
    await pool.query(
      `UPDATE organization_members SET status='REVOKED' WHERE organization_id=$1 AND user_id=$2`,
      [admin.organizationId, revoked.userId]
    );
    const revokedResponse = await request.get(`${API}/api/admin/audit-logs`, {
      headers: headers(revoked.token),
    });
    expect(revokedResponse.status()).toBe(403);

    const foreignRun = makeRunId('adm-ui-foreign');
    runIds.push(foreignRun);
    const foreign = await getPrivilegedSession(request, { runId: foreignRun, role: 'ADMIN' });
    const spoof = await request.get(
      `${API}/api/admin/audit-logs?organizationId=${encodeURIComponent(admin.organizationId)}&limit=1`,
      { headers: headers(foreign.token) }
    );
    expect(spoof.status()).toBe(200);
    const spoofBody = await spoof.json();
    expect(JSON.stringify(spoofBody)).not.toContain(admin.organizationId);

    const superRun = makeRunId('adm-ui-super');
    runIds.push(superRun);
    const superadmin = await getPrivilegedSession(request, { runId: superRun, role: 'SUPERADMIN' });
    const superContext = await browser.newContext();
    const superPage = await superContext.newPage();
    await seedBrowser(superPage, superadmin);
    await superPage.goto('/admin/security?tab=iam');
    await expect(superPage).toHaveURL(/\/superadmin(?:\/|$)/);
    await superContext.close();
    await pool.end();
  });

  test('backup UI is characterized as SuperAdmin read-only/degraded and never invokes restore', async ({
    page,
    request,
  }) => {
    const runId = makeRunId('adm-ui-backup');
    runIds.push(runId);
    const superadmin = await getPrivilegedSession(request, { runId, role: 'SUPERADMIN' });
    await seedBrowser(page, superadmin);
    let restoreCalls = 0;
    page.on('request', (req) => {
      if (req.url().includes('/api/admin/backups/restore')) restoreCalls += 1;
    });
    await page.goto('/superadmin/system?tab=backup');
    await page.getByRole('button', { name: 'Backup', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Backup & Recovery' })).toBeVisible();
    expect(restoreCalls).toBe(0);
  });
});
