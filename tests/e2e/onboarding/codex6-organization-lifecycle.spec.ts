import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';
import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || '';
const EVIDENCE_DIR = path.resolve('evidence/pilotaz-organization-lifecycle');
const PASSWORD = 'Codex6-Seed-Owner-Password-123!';

test('organization admin exports and permanently deletes only their tenant', async ({ page }) => {
  test.setTimeout(180_000);
  if (!DATABASE_URL.startsWith('postgres')) throw new Error('DATABASE_URL_REQUIRED');
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  const pool = new Pool({ connectionString: DATABASE_URL });
  const suffix = randomUUID().slice(0, 8);
  const orgId = `cx6-ui-org-${suffix}`;
  const userId = `cx6-ui-admin-${suffix}`;
  const orgName = `CX6 Lifecycle ${suffix}`;
  const email = `${userId}@example.test`;

  try {
    const password = await pool.query<{ password: string }>(
      `SELECT password FROM users WHERE email = 'codex6-seed-owner@test.invalid'`
    );
    expect(password.rowCount).toBe(1);
    await pool.query(
      `INSERT INTO organizations(id,name,organization_type,is_active) VALUES ($1,$2,'PAID',1)`,
      [orgId, orgName]
    );
    await pool.query(
      `INSERT INTO users(id,organization_id,email,password,first_name,last_name,role,status,is_active,onboarding_completed)
       VALUES ($1,$2,$3,$4,'Lifecycle','Admin','ADMIN','active',1,true)`,
      [userId, orgId, email, password.rows[0].password]
    );
    await pool.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES ($1,$2,$3,'ADMIN','ACTIVE')`,
      [randomUUID(), orgId, userId]
    );

    await page.goto('/login');
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(PASSWORD);
    const loginResponse = page.waitForResponse(
      (response) => response.request().method() === 'POST' && response.url().includes('/api/auth/login')
    );
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    expect((await loginResponse).status()).toBe(200);
    await page.waitForLoadState('networkidle');
    await page.goto('/settings/data-controls');
    const skipWelcome = page.getByRole('button', { name: 'Skip for now' });
    await skipWelcome.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => undefined);
    if (await skipWelcome.isVisible()) await skipWelcome.click();

    const controls = page.getByTestId('organization-data-controls');
    await expect(controls).toContainText(orgName);
    await expect(controls.getByRole('button', { name: 'Permanently Delete Organization' })).toBeDisabled();
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '01-export-delete-controls.png'), fullPage: true });

    const downloadEvent = page.waitForEvent('download');
    await controls.getByRole('button', { name: 'Export Organization' }).click();
    const download = await downloadEvent;
    const downloadPath = await download.path();
    expect(download.suggestedFilename()).toBe(`organization-export-${orgId}.json`);
    expect(downloadPath).toBeTruthy();
    const exported = fs.readFileSync(downloadPath!, 'utf8');
    expect(exported).toContain(userId);
    expect(exported).not.toContain('cx6-other-user-');

    await controls.getByLabel('Organization name confirmation').fill('wrong organization');
    await expect(controls.getByRole('button', { name: 'Permanently Delete Organization' })).toBeDisabled();
    expect((await pool.query('SELECT 1 FROM organizations WHERE id=$1', [orgId])).rowCount).toBe(1);

    await controls.getByLabel('Organization name confirmation').fill(orgName);
    const deletionResponse = page.waitForResponse(
      (response) => response.request().method() === 'DELETE' && response.url().endsWith(`/api/organizations/${orgId}`)
    );
    await controls.getByRole('button', { name: 'Permanently Delete Organization' }).click();
    expect((await deletionResponse).status()).toBe(200);
    await expect.poll(async () => (await pool.query('SELECT 1 FROM organizations WHERE id=$1', [orgId])).rowCount).toBe(0);
    expect((await pool.query('SELECT 1 FROM users WHERE id=$1', [userId])).rowCount).toBe(0);
    const receipt = await pool.query(
      'SELECT actor_id FROM organization_self_service_deletion_receipts WHERE target_organization_id=$1',
      [orgId]
    );
    expect(receipt.rows).toEqual([{ actor_id: userId }]);
  } finally {
    await pool.query('DELETE FROM organization_members WHERE organization_id=$1', [orgId]).catch(() => undefined);
    await pool.query('DELETE FROM users WHERE organization_id=$1', [orgId]).catch(() => undefined);
    await pool.query('DELETE FROM organizations WHERE id=$1', [orgId]).catch(() => undefined);
    await pool.end();
  }
});
