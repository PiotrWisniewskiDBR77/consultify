import fs from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';
import jwt from 'jsonwebtoken';

const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:4216';
const EVIDENCE_DIR = path.resolve('evidence/pilotaz-feedback');

test.describe('CODEX6 E5 — feedback journal', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('a report submitted from Feedback keeps product context and is readable from the journal API', async ({ page }) => {
    test.setTimeout(180_000);
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

    await page.goto('/login');
    await page.locator('input[type="email"]').fill('codex6-seed-owner@test.invalid');
    await page.locator('input[type="password"]').fill('Codex6-Seed-Owner-Password-123!');
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await page.waitForLoadState('networkidle');
    const skip = page.getByRole('button', { name: 'Skip for now' });
    if ((await skip.count()) > 0 && (await skip.isVisible())) await skip.click();

    await page.getByRole('button', { name: 'Feedback', exact: true }).click();
    await expect(page.getByText('User Feedback & Triage')).toBeVisible();
    await page.getByPlaceholder('Short, specific summary').fill('Pilot task filter hides active work');
    await page
      .getByPlaceholder('Describe what happened and steps to reproduce...')
      .fill('The active-work filter hides a task that is already in progress.');

    const [submitted] = await Promise.all([
      page.waitForResponse(
        (response) => response.url().endsWith('/api/feedback') && response.request().method() === 'POST'
      ),
      page.getByRole('button', { name: 'Submit', exact: true }).click(),
    ]);
    expect(submitted.status()).toBe(200);
    const created = await submitted.json();
    expect(created.id).toBeTruthy();
    await expect(page.getByText('Report number')).toBeVisible();
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '01-feedback-confirmation.png'), fullPage: true });

    const secret = process.env.JWT_SECRET || 'codex6-local-proof-secret-1234567890';
    const superadminToken = jwt.sign(
      { id: 'system', userId: 'system', email: 'system@iris.internal', role: 'SUPERADMIN', organizationId: 'system' },
      secret,
      { algorithm: 'HS256', expiresIn: '10m' }
    );
    const journal = await page.request.get(`${API_BASE_URL}/api/feedback/${created.id}`, {
      headers: { Authorization: `Bearer ${superadminToken}` },
    });
    expect(journal.status()).toBe(200);
    const readback = await journal.json();
    expect(readback.feedback || readback).toMatchObject({
      id: created.id,
      title: 'Pilot task filter hides active work',
    });
    const item = readback.feedback || readback;
    expect(JSON.stringify(item)).toContain('/chat');
    expect(JSON.stringify(item)).toContain('codex6-seed-owner@test.invalid');
  });
});
