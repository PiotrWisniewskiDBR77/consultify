import fs from 'node:fs';
import path from 'node:path';

import { chromium, type FullConfig } from '@playwright/test';

const PIOTR_EMAIL = 'piotr.wisniewski@dbr77.com';
const EXPECTED_ORGANIZATION_ID = 'a3e05d4a-5397-419d-b486-8e44366c0063';

export default async function globalSetup(config: FullConfig) {
  const email = String(process.env.E2E_ACCEPTANCE_OWNER_EMAIL || process.env.ACCEPTANCE_TEST_OWNER_EMAIL || 'acceptance.owner@consultify.local').trim().toLowerCase();
  const password = String(process.env.E2E_ACCEPTANCE_OWNER_PASSWORD || process.env.ACCEPTANCE_TEST_OWNER_PASSWORD || '');
  if (!email || !password) {
    throw new Error(
      'ACCEPTANCE_OWNER_CREDENTIALS_REQUIRED: set E2E_ACCEPTANCE_OWNER_EMAIL and E2E_ACCEPTANCE_OWNER_PASSWORD. ' +
      'This gate does not use test-support, demo-login, register-demo, synthetic tokens or saved browser sessions.'
    );
  }

  const baseURL = String(config.projects[0]?.use?.baseURL || '');
  const statePath = String(config.projects[0]?.use?.storageState || '');
  fs.mkdirSync(path.dirname(statePath), { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  try {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.getByTestId('email-input').fill(email);
    await page.getByTestId('password-input').fill(password);
    const [loginResponse] = await Promise.all([
      page.waitForResponse((response) => response.url().includes('/api/auth/login'), { timeout: 60_000 }),
      page.getByTestId('login-button').click(),
    ]);
    if (!loginResponse.ok()) {
      throw new Error(`REAL_OWNER_LOGIN_FAILED: HTTP ${loginResponse.status()}`);
    }
    const loginPayload = await loginResponse.json().catch(() => null);
    const serverIdentity = loginPayload?.user || null;
    const serverRole = String(serverIdentity?.role || serverIdentity?.userRole || '').toUpperCase();
    if (
      String(serverIdentity?.email || '').toLowerCase() !== email ||
      serverRole !== 'OWNER' ||
      String(serverIdentity?.organizationId || '') !== EXPECTED_ORGANIZATION_ID
    ) {
      throw new Error(
        `SERVER_OWNER_IDENTITY_MISMATCH: ${JSON.stringify({
          email: serverIdentity?.email,
          role: serverRole,
          organizationId: serverIdentity?.organizationId,
        })}`
      );
    }
    const token = String(loginPayload?.token || loginPayload?.accessToken || '');
    if (!token) throw new Error('REAL_OWNER_LOGIN_FAILED: response did not contain an access token');
    const membersResponse = await page.request.get(
      `${baseURL.replace(/\/$/, '')}/api/organizations/${EXPECTED_ORGANIZATION_ID}/members`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!membersResponse.ok()) {
      throw new Error(`PIOTR_OWNER_READBACK_FAILED: HTTP ${membersResponse.status()}`);
    }
    const members = await membersResponse.json().catch(() => null);
    const piotr = Array.isArray(members)
      ? members.filter((member: any) => String(member?.email || '').toLowerCase() === PIOTR_EMAIL)
      : [];
    if (
      piotr.length !== 1 ||
      String(piotr[0]?.role || '').toUpperCase() !== 'OWNER' ||
      String(piotr[0]?.status || '').toUpperCase() !== 'ACTIVE'
    ) {
      throw new Error(
        `PIOTR_OWNER_READBACK_FAILED: ${JSON.stringify(
          piotr.map((member: any) => ({ email: member?.email, role: member?.role, status: member?.status }))
        )}`
      );
    }
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 60_000 });

    const identity = await page.evaluate(() => {
      const raw = localStorage.getItem('user');
      return raw ? JSON.parse(raw) : null;
    });
    const role = String(identity?.role || identity?.userRole || '').toUpperCase();
    if (String(identity?.email || '').toLowerCase() !== email || role !== 'OWNER') {
      throw new Error(`OWNER_IDENTITY_MISMATCH: ${JSON.stringify({ email: identity?.email, role })}`);
    }
    if (String(identity?.organizationId || '') !== EXPECTED_ORGANIZATION_ID) {
      throw new Error(
        `OWNER_TENANT_MISMATCH: expected ${EXPECTED_ORGANIZATION_ID}, received ${identity?.organizationId || '<missing>'}`
      );
    }
    await context.storageState({ path: statePath });
  } finally {
    await context.close();
    await browser.close();
  }
}
