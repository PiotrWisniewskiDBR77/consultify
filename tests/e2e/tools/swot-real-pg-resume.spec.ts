import { expect, test } from '@playwright/test';

import { readTestSupportState } from '../_helpers/testSupportState';

const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3001';

test('TLS-02/03: SWOT deep-link, edit, durable autosave and hard-reload resume on real PostgreSQL', async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  const { token } = readTestSupportState();
  const headers = { Authorization: `Bearer ${token}`, 'content-type': 'application/json' };
  const marker = `SWOT durable weakness ${Date.now()}`;

  const create = await request.post(`${API_BASE_URL}/api/tools`, {
    headers,
    data: { toolType: 'dynamic-swot', name: `TLS real-PG SWOT ${Date.now()}` },
  });
  expect(create.status()).toBe(200);
  const sessionId = String((await create.json()).id || '');
  expect(sessionId.length).toBeGreaterThan(8);

  const seed = await request.put(`${API_BASE_URL}/api/tools/${sessionId}`, {
    headers,
    data: {
      status: 'IN_PROGRESS',
      completionPercent: 20,
      confidenceAvg: 4,
      answers: {
        items: [
          {
            id: 'tls-browser-strength-1',
            text: 'Durable strength from PostgreSQL',
            quadrant: 'strengths',
            impact: 'high',
            source: 'user',
            confidence: 4,
            status: 'accepted',
            proposalStatus: 'accepted',
          },
        ],
      },
    },
  });
  expect(seed.status()).toBe(200);

  await page.goto(`/discovery-tools?docId=${encodeURIComponent(sessionId)}`);
  await expect(page).toHaveURL(new RegExp(`docId=${sessionId}`));

  await expect(page.getByRole('button', { name: /SWOT Build/i }).first()).toBeVisible({
    timeout: 30_000,
  });
  const dismissOnboarding = page.getByRole('button', { name: /Skip for now|Pomiń/i });
  const onboardingWasDismissed = await dismissOnboarding
    .waitFor({ state: 'visible', timeout: 3_000 })
    .then(async () => {
      await dismissOnboarding.click();
      return true;
    })
    .catch(() => false);
  if (onboardingWasDismissed) {
    await page.goto(`/discovery-tools?docId=${encodeURIComponent(sessionId)}`);
    await expect(page).toHaveURL(new RegExp(`docId=${sessionId}`));
  }
  const swotPhase = page.getByRole('button', { name: /SWOT Build/i }).first();
  await expect(swotPhase).toBeVisible({ timeout: 30_000 });
  await swotPhase.click();
  await expect(page.getByText('Durable strength from PostgreSQL')).toBeVisible();

  const weaknessInput = page.getByPlaceholder(/Add point|Dodaj punkt/i).nth(1);
  await expect(weaknessInput).toBeVisible();
  await weaknessInput.fill(marker);
  await weaknessInput.locator('..').getByRole('button').click();
  await expect(page.getByText(marker)).toBeVisible();

  await expect
    .poll(
      async () => {
        const read = await request.get(`${API_BASE_URL}/api/tools/${sessionId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (read.status() !== 200) return false;
        const body = await read.json();
        return Array.isArray(body?.answers?.items)
          ? body.answers.items.some((item: any) => item?.text === marker)
          : false;
      },
      { timeout: 20_000, message: 'SWOT edit did not reach PostgreSQL' }
    )
    .toBe(true);

  await page.reload();
  await expect(page).toHaveURL(new RegExp(`docId=${sessionId}`));
  const reopenedSwotPhase = page.getByRole('button', { name: /SWOT Build/i }).first();
  await expect(reopenedSwotPhase).toBeVisible({ timeout: 30_000 });
  await reopenedSwotPhase.click();
  await expect(page.getByText(marker)).toBeVisible();

  const finalRead = await request.get(`${API_BASE_URL}/api/tools/${sessionId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(finalRead.status()).toBe(200);
  const finalBody = await finalRead.json();
  expect(finalBody.id).toBe(sessionId);
  expect(finalBody.answers.items.some((item: any) => item?.text === marker)).toBe(true);
});
