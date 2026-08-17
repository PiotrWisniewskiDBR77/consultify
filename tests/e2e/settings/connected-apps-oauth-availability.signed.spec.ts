import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

import { getAuthHeader } from '../_helpers/testSupportState';
import { dismissOverlayIfPresent } from '../smoke/work-canvas-helpers';

const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3001';
const EXPECT_GMAIL_CONFIGURED = process.env.E2E_EXPECT_GMAIL_CONFIGURED === 'true';

async function openConnectedApps(page: Page, language: 'en' | 'pl') {
  await page.addInitScript((lang) => localStorage.setItem('i18nextLng', lang), language);
  await page.goto('/settings/connected-apps');
  await dismissOverlayIfPresent(page);
  await expect(
    page.getByRole('heading', { name: /Connected Apps|Połączone aplikacje/i }).first()
  ).toBeVisible();
  await page.getByPlaceholder(/Search apps|Szukaj aplikacji/i).fill('Gmail');
}

function gmailCard(page: Page) {
  return page.locator('div.group').filter({ hasText: 'Gmail' }).first();
}

async function assertNoBlockingAxeViolations(page: Page) {
  const result = await new AxeBuilder({ page })
    .include('main')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const blocking = result.violations
    .filter(({ impact }) => impact === 'critical' || impact === 'serious')
    .map(({ id, impact, nodes }) => ({
      id,
      impact,
      nodes: nodes.map(({ target, html }) => ({ target, html })),
    }));
  expect(blocking).toEqual([]);
}

test.describe('Connected Apps OAuth availability — mounted signed auth', () => {
  test.setTimeout(120_000);

  test('fails closed without auth and exposes the real Gmail availability decision', async ({
    request,
  }) => {
    const unauthenticated = await request.get(
      `${API_BASE_URL}/api/settings/integrations/oauth/status`
    );
    expect(unauthenticated.status()).toBe(401);

    const authenticated = await request.get(
      `${API_BASE_URL}/api/settings/integrations/oauth/status`,
      { headers: getAuthHeader() }
    );
    expect(authenticated.status()).toBe(200);
    const status = (await authenticated.json()) as {
      availability?: Record<
        string,
        { configured?: boolean; approved?: boolean; authType?: string }
      >;
    };
    expect(status.availability?.gmail).toMatchObject({
      configured: EXPECT_GMAIL_CONFIGURED,
      approved: EXPECT_GMAIL_CONFIGURED,
      authType: 'oauth2',
    });

    if (EXPECT_GMAIL_CONFIGURED) {
      const start = await request.get(
        `${API_BASE_URL}/api/settings/integrations/oauth/start/gmail`,
        { headers: getAuthHeader() }
      );
      expect(start.status()).toBe(200);
      const body = (await start.json()) as { authUrl?: string };
      expect(body.authUrl).toMatch(/^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth\?/);
    }
  });

  for (const language of ['en', 'pl'] as const) {
    test(`${language.toUpperCase()} renders the real availability fail-closed with keyboard and axe`, async ({
      page,
    }) => {
      let popupCount = 0;
      page.on('popup', () => {
        popupCount += 1;
      });

      await openConnectedApps(page, language);
      const card = gmailCard(page);
      await expect(card).toBeVisible();

      if (EXPECT_GMAIL_CONFIGURED) {
        const connect = card.getByRole('button', { name: /Connect|Połącz/i });
        await expect(connect).toBeEnabled();
        await connect.focus();
        await expect(connect).toBeFocused();
        expect(await connect.evaluate((element) => element.matches(':focus-visible'))).toBe(true);
      } else {
        await expect(card.getByLabel(/Gmail unavailable/i)).toBeVisible();
        await expect(card.getByRole('button', { name: /Connect|Połącz/i })).toHaveCount(0);
      }

      await assertNoBlockingAxeViolations(page);
      expect(popupCount).toBe(0);
      expect(page.url()).toMatch(/\/settings\/connected-apps$/);
    });
  }
});
