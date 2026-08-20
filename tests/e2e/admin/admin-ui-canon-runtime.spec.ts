import { expect, test } from '@playwright/test';
import { Pool } from 'pg';

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

  test('ADMIN opens organization controls; MEMBER, GUEST and revoked fail closed while SUPERADMIN stays global', async ({
    page,
    browser,
    request,
  }) => {
    const adminRun = makeRunId('adm-ui-admin');
    runIds.push(adminRun);
    const admin = await getPrivilegedSession(request, { runId: adminRun, role: 'ADMIN' });

    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
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

    for (const session of [admin, adminMember]) {
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

    await seedBrowser(page, admin);
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

    for (const endpoint of ['/api/admin/audit-logs', '/api/admin/health-panel/probes']) {
      const response = await request.get(`${API}${endpoint}`, {
        headers: headers(superadmin.token),
      });
      expect(response.status(), `global SUPERADMIN can inspect ${endpoint}`).toBe(200);
    }

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

  test('stale role intent reconciles authoritatively and lost response recovers only after cold read-back', async ({
    page,
    request,
  }) => {
    const runId = makeRunId('adm-ui-stale');
    runIds.push(runId);
    const admin = await getPrivilegedSession(request, { runId, role: 'ADMIN' });
    const memberSeed = await request.post(`${API}/api/test-support/member`, {
      headers: { 'x-test-support-key': SUPPORT_KEY, 'content-type': 'application/json' },
      data: { runId, role: 'USER' },
    });
    expect(memberSeed.status(), await memberSeed.text()).toBe(201);
    const member = (await memberSeed.json()) as PrivilegedSession;
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
    const memberIdentity = await pool.query(`SELECT email FROM users WHERE id=$1`, [member.userId]);
    const memberEmail = String(memberIdentity.rows[0]?.email || '');
    expect(memberEmail).toBeTruthy();
    await pool.query(
      `UPDATE organization_members SET role='MEMBER' WHERE organization_id=$1 AND user_id=$2`,
      [admin.organizationId, member.userId]
    );
    const rolePatchUrl = new RegExp(
      `/api/organizations/${admin.organizationId}/admin/members/${member.userId}/role(?:\\?|$)`
    );
    const commandIds: string[] = [];
    page.on('request', (req) => {
      if (!rolePatchUrl.test(req.url()) || req.method() !== 'PATCH') return;
      commandIds.push(req.headers()['x-idempotency-key'] || '');
    });

    await seedBrowser(page, admin);
    await page.goto('/admin/people');
    const roleSelect = page
      .getByRole('row', { name: new RegExp(memberEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) })
      .getByRole('combobox', { name: /Role for/i });
    await expect(roleSelect).toHaveValue('MEMBER');

    // A second administrator wins before this browser submits its MEMBER-based
    // intent. The mounted UI must not silently overwrite or keep replaying the
    // permanently stale command identity.
    await pool.query(
      `UPDATE organization_members SET role='GUEST' WHERE organization_id=$1 AND user_id=$2`,
      [admin.organizationId, member.userId]
    );
    await roleSelect.selectOption('ADMIN');
    await expect(page.getByTestId('admin-operation-error')).toContainText(
      /Membership changed on the server\. Current role: Guest\. Review and retry\./i
    );
    await expect(roleSelect).toHaveValue('GUEST');
    expect(commandIds).toHaveLength(1);
    expect(commandIds[0]).toBeTruthy();

    // A deliberate new intent uses the reconciled GUEST precondition and a new
    // command identity, then succeeds only after the canonical member GET.
    await roleSelect.selectOption('ADMIN');
    await expect(
      page
        .getByRole('region', { name: 'Members & Roles' })
        .getByRole('status')
        .filter({ hasText: /Member role updated/i })
    ).toBeVisible();
    await expect(roleSelect).toHaveValue('ADMIN');
    expect(commandIds).toHaveLength(2);
    expect(commandIds[1]).toBeTruthy();
    expect(commandIds[1]).not.toBe(commandIds[0]);

    // Execute the next command on the real server but drop its response. The UI
    // may report recovery only after its independent members read-back observes
    // the exact committed role.
    let droppedResponse = false;
    await page.route(rolePatchUrl, async (route) => {
      if (droppedResponse) return route.continue();
      droppedResponse = true;
      const response = await route.fetch();
      expect(response.status()).toBe(200);
      await route.abort('connectionfailed');
    });
    await roleSelect.selectOption('MEMBER');
    await expect(
      page
        .getByRole('region', { name: 'Members & Roles' })
        .getByRole('status')
        .filter({ hasText: /already updated and has been reconciled from the server/i })
    ).toBeVisible();
    await expect(roleSelect).toHaveValue('MEMBER');
    expect(droppedResponse).toBe(true);

    const cold = await pool.query(
      `SELECT role, status FROM organization_members WHERE organization_id=$1 AND user_id=$2`,
      [admin.organizationId, member.userId]
    );
    expect(cold.rows).toEqual([{ role: 'MEMBER', status: 'ACTIVE' }]);
    await pool.end();
  });
});
