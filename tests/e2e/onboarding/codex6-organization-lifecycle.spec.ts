import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';
import bcrypt from 'bcryptjs';
import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || '';
const EVIDENCE_DIR = path.resolve('evidence/pilotaz-organization-lifecycle');
const quoteIdentifier = (value: string) => `"${value.replace(/"/g, '""')}"`;

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
  const rootTable = `cx6_ui_export_root_${suffix}`;
  const childTable = `cx6_ui_export_child_${suffix}`;
  const largeTable = `cx6_ui_export_large_${suffix}`;
  const loginPassword = `Fixture-Password-${suffix}!`;
  const secretSentinels = ['', `fixture-mfa-${suffix}`, `fixture-token-${suffix}`];

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
    secretSentinels[0] = await bcrypt.hash(loginPassword, 4);
    await pool.query('UPDATE users SET password=$2,mfa_secret=$3 WHERE id=$1', [userId, secretSentinels[0], secretSentinels[1]]);
    await pool.query(`CREATE TABLE ${quoteIdentifier(rootTable)} (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id), access_token TEXT, payload TEXT)`);
    await pool.query(`CREATE TABLE ${quoteIdentifier(childTable)} (id TEXT PRIMARY KEY, root_id TEXT NOT NULL REFERENCES ${quoteIdentifier(rootTable)}(id), note TEXT)`);
    await pool.query(`CREATE TABLE ${quoteIdentifier(largeTable)} (id INTEGER PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id), label TEXT)`);
    await pool.query(`INSERT INTO ${quoteIdentifier(rootTable)} VALUES ('ui-root',$1,$2,'ui-root-data')`, [orgId, secretSentinels[2]]);
    await pool.query(`INSERT INTO ${quoteIdentifier(childTable)} VALUES ('ui-child','ui-root','ui-child-data')`);
    await pool.query(`INSERT INTO ${quoteIdentifier(largeTable)} SELECT value,$1,'ui-large-' || value FROM generate_series(1,20001) value`, [orgId]);

    await page.goto('/login');
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(loginPassword);
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
    for (const sentinel of secretSentinels) expect(exported.includes(sentinel)).toBe(false);
    expect(exported).toContain('ui-child-data');
    expect(JSON.parse(exported).rowCounts[largeTable]).toBe(20_001);
    const token = await page.evaluate(() => localStorage.getItem('accessToken') || localStorage.getItem('token'));
    const csv = await page.request.get(`http://127.0.0.1:4216/api/organizations/${orgId}/export?format=csv`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(csv.status()).toBe(200);
    const csvText = await csv.text();
    for (const sentinel of secretSentinels) expect(csvText.includes(sentinel)).toBe(false);
    expect(csvText).toContain('ui-child-data');
    expect(csvText.split(`"${largeTable}"`).length - 1).toBe(20_001);

    await pool.query(`DROP TABLE ${quoteIdentifier(childTable)}`);
    await pool.query(`DROP TABLE ${quoteIdentifier(rootTable)}`);
    await pool.query(`DROP TABLE ${quoteIdentifier(largeTable)}`);

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
    await pool.query(`DROP TABLE IF EXISTS ${quoteIdentifier(childTable)}`).catch(() => undefined);
    await pool.query(`DROP TABLE IF EXISTS ${quoteIdentifier(rootTable)}`).catch(() => undefined);
    await pool.query(`DROP TABLE IF EXISTS ${quoteIdentifier(largeTable)}`).catch(() => undefined);
    await pool.query('DELETE FROM organization_members WHERE organization_id=$1', [orgId]).catch(() => undefined);
    await pool.query('DELETE FROM users WHERE organization_id=$1', [orgId]).catch(() => undefined);
    await pool.query('DELETE FROM organizations WHERE id=$1', [orgId]).catch(() => undefined);
    await pool.end();
  }
});
