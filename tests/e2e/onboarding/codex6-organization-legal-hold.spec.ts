import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';
import bcrypt from 'bcryptjs';
import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || '';

test('active legal hold is a readable 423 and preserves tenant data', async ({ page }) => {
  test.setTimeout(120_000);
  if (!DATABASE_URL.startsWith('postgres')) throw new Error('DATABASE_URL_REQUIRED');
  const pool = new Pool({ connectionString: DATABASE_URL });
  const suffix = randomUUID().slice(0, 8);
  const orgId = `cx6-ui-hold-${suffix}`;
  const userId = `cx6-ui-hold-admin-${suffix}`;
  const orgName = `CX6 UI Held ${suffix}`;
  const email = `${userId}@example.test`;
  const password = `Fixture-Hold-${suffix}!`;
  try {
    await pool.query(`INSERT INTO organizations(id,name,organization_type,is_active) VALUES ($1,$2,'PAID',1)`, [orgId, orgName]);
    await pool.query(`INSERT INTO users(id,organization_id,email,password,first_name,last_name,role,status,is_active,onboarding_completed) VALUES ($1,$2,$3,$4,'Held','Admin','ADMIN','active',1,true)`, [userId, orgId, email, await bcrypt.hash(password, 4)]);
    await pool.query(`INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES ($1,$2,$3,'ADMIN','ACTIVE')`, [randomUUID(), orgId, userId]);
    await pool.query(`INSERT INTO org_policies(id,organization_id,legal_hold_enabled) VALUES ($1,$2,1)`, [`cx6-ui-hold-policy-${suffix}`, orgId]);

    await page.goto('/login');
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await page.waitForLoadState('networkidle');
    await page.goto('/settings/data-controls');
    const skipWelcome = page.getByRole('button', { name: 'Skip for now' });
    await skipWelcome.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => undefined);
    if (await skipWelcome.isVisible()) await skipWelcome.click();
    const controls = page.getByTestId('organization-data-controls');
    await controls.getByLabel('Organization name confirmation').fill(orgName);
    const responsePromise = page.waitForResponse(
      (response) => response.request().method() === 'DELETE' && response.url().endsWith(`/api/organizations/${orgId}`)
    );
    await controls.getByRole('button', { name: 'Permanently Delete Organization' }).click();
    expect((await responsePromise).status()).toBe(423);
    await expect(page.getByText('This organization cannot be deleted while a legal hold is active. Contact your compliance administrator.').first()).toBeVisible();
    expect((await pool.query('SELECT 1 FROM organizations WHERE id=$1', [orgId])).rowCount).toBe(1);
    expect((await pool.query('SELECT 1 FROM organization_self_service_deletion_receipts WHERE target_organization_id=$1', [orgId])).rowCount).toBe(0);
  } finally {
    await pool.query('DELETE FROM org_policies WHERE organization_id=$1', [orgId]).catch(() => undefined);
    await pool.query('DELETE FROM organization_members WHERE organization_id=$1', [orgId]).catch(() => undefined);
    await pool.query('DELETE FROM users WHERE organization_id=$1', [orgId]).catch(() => undefined);
    await pool.query('DELETE FROM organizations WHERE id=$1', [orgId]).catch(() => undefined);
    await pool.end();
  }
});
