import fs from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';
import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || '';
const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:4216';
const ORG_ID = '7f66937f-835a-4424-b13e-a5b3d6c989bf';
const EVIDENCE_DIR = path.resolve('evidence/pilotaz-ai-budget');
const PHASE = process.env.E3_PROOF_PHASE || 'below';

test.describe('CODEX6 E3 — organization AI budget', () => {
  test('admin sees PG-backed usage and the real AI HTTP gate blocks only at the limit', async ({ page }) => {
    test.setTimeout(180_000);
    if (!DATABASE_URL.startsWith('postgres')) throw new Error('DATABASE_URL_REQUIRED');
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
    const pool = new Pool({ connectionString: DATABASE_URL });
    try {
      await pool.query(`DELETE FROM ai_budgets WHERE organization_id = $1 AND budget_type = 'cost'`, [ORG_ID]);
      await pool.query(
        `INSERT INTO ai_budgets
          (id, organization_id, budget_type, period, budget_limit, hard_limit, current_usage, is_active, created_by)
         VALUES ('codex6-e3-budget', $1, 'cost', 'monthly', 50, 1, 12.34, true, 'codex6-proof')`,
        [ORG_ID]
      );

      await page.goto('/login');
      await page.locator('input[type="email"]').fill('codex6-seed-owner@test.invalid');
      await page.locator('input[type="password"]').fill('Codex6-Seed-Owner-Password-123!');
      await page.getByRole('button', { name: /sign in|log in/i }).click();
      await page.waitForLoadState('networkidle');
      const token = await page.evaluate(() => localStorage.getItem('accessToken') || localStorage.getItem('token'));
      expect(token).toBeTruthy();
      const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

      await page.goto('/admin/ai/policy-autonomy');
      await page.getByRole('button', { name: 'Limits & Budget', exact: true }).click();
      const usage = page.getByTestId('organization-ai-budget-usage');
      await expect(usage).toContainText('$12.34');
      await expect(usage).toContainText('$50.00');
      await expect(usage).toContainText('$37.66');
      await page.screenshot({ path: path.join(EVIDENCE_DIR, '01-admin-usage.png'), fullPage: true });

      if (PHASE === 'below') {
        await pool.query(`UPDATE ai_budgets SET current_usage = 49 WHERE id = 'codex6-e3-budget'`);
        const below = await page.request.post(`${API_BASE_URL}/api/ai/chat/stream`, {
          headers,
          data: { message: 'Budget gate below-limit proof', language: 'en' },
        });
        expect(await below.text()).not.toContain('AI_BUDGET_EXHAUSTED');
      } else {
        await pool.query(`UPDATE ai_budgets SET current_usage = 50 WHERE id = 'codex6-e3-budget'`);
        const before = await pool.query(`SELECT current_usage FROM ai_budgets WHERE id = 'codex6-e3-budget'`);
        const above = await page.request.post(`${API_BASE_URL}/api/ai/chat/stream`, {
          headers,
          data: { message: 'Budget gate exhausted proof', language: 'en' },
        });
        const blockedBody = await above.text();
        expect(blockedBody).toContain('AI_BUDGET_EXHAUSTED');
        expect(blockedBody).toContain('$50 monthly AI budget');
        const after = await pool.query(`SELECT current_usage FROM ai_budgets WHERE id = 'codex6-e3-budget'`);
        expect(Number(after.rows[0].current_usage)).toBe(Number(before.rows[0].current_usage));
      }
    } finally {
      await pool.query(`DELETE FROM ai_budgets WHERE id = 'codex6-e3-budget'`).catch(() => undefined);
      await pool.end();
    }
  });
});
