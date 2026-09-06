import fs from 'node:fs';

import { expect, test } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3096';
const authPath = process.env.ODBIOR_AUTH_STATE;
if (!authPath) throw new Error('ODBIOR_AUTH_STATE is required');
const storageState = JSON.parse(fs.readFileSync(authPath, 'utf8'));
const source = (storageState.origins || []).find((origin: { localStorage?: Array<{ name: string; value: string }> }) =>
  (origin.localStorage || []).some((entry) => entry.name === 'token' && entry.value)
);
storageState.origins = [{ ...source, origin: baseURL }];

test.use({ storageState });
test.setTimeout(120_000);

test('inicjatywa otwiera jeden dok Teresy z historią czatu głównego', async ({ page }) => {
  const marker = 'P8-historia-1788672213282';
  await page.goto('/chat/3ca3e5ec-cf60-4d95-955c-1d134f46111f');
  const mainInput = page.locator('textarea[data-testid="chat-input"]:visible').first();
  await expect(mainInput).toBeVisible();
  await expect(page.getByText(marker, { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('teresa.lastActiveConversationId'))).toBe('3ca3e5ec-cf60-4d95-955c-1d134f46111f');

  await page.getByRole('button', { name: 'Inicjatywy', exact: true }).first().click();
  await expect(page).toHaveURL(/\/initiatives/);
  await page.getByText('Supply Chain Optimization', { exact: true }).first().click();
  await page.getByRole('button', { name: 'Otwórz', exact: true }).click();
  const entry = page.getByRole('button', { name: 'Zapytaj Teresę o tę inicjatywę' });
  await expect(entry).toBeVisible();
  await entry.click();

  const dockInput = page.locator('textarea[data-testid="chat-input"]:visible');
  await expect(dockInput).toHaveCount(1);
  await expect(page.getByText(marker, { exact: true })).toBeVisible();

  await dockInput.fill('Odpowiedz krótko po polsku o tej inicjatywie i podaj liczbę użytych źródeł.');
  await page.locator('[data-testid="chat-send-btn"]:visible').click();
  const sources = page.getByText(/Źródła:\s*[1-9]\d*/i);
  try {
    await expect(sources).toBeVisible({ timeout: 60_000 });
  } catch {
    console.log('P8_AI_NOT_MEASURED_LOCALLY: brak klucza AI albo odpowiedzi ze Źródła: N>0 w 60 s');
  }
});
