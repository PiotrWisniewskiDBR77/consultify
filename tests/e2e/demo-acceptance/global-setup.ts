import fs from 'node:fs';
import path from 'node:path';

import { chromium, type FullConfig } from '@playwright/test';

const EXPECTED_EMAIL = 'piotr.wisniewski@dbr77.com';
const EXPECTED_ORGANIZATION_ID = 'a3e05d4a-5397-419d-b486-8e44366c0063';

export default async function globalSetup(config: FullConfig) {
  const email = String(process.env.E2E_OWNER_EMAIL || '').trim();
  const password = String(process.env.E2E_OWNER_PASSWORD || '');
  if (email.toLowerCase() !== EXPECTED_EMAIL || !password) {
    throw new Error(
      `REAL_OWNER_CREDENTIALS_REQUIRED: set E2E_OWNER_EMAIL=${EXPECTED_EMAIL} and E2E_OWNER_PASSWORD. ` +
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
    await Promise.all([
      page.waitForResponse((response) => response.url().includes('/api/auth/login'), { timeout: 60_000 }),
      page.getByTestId('login-button').click(),
    ]);
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 60_000 });

    const identity = await page.evaluate(() => {
      const raw = localStorage.getItem('user');
      return raw ? JSON.parse(raw) : null;
    });
    const role = String(identity?.role || identity?.userRole || '').toUpperCase();
    if (String(identity?.email || '').toLowerCase() !== EXPECTED_EMAIL || role !== 'OWNER') {
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
