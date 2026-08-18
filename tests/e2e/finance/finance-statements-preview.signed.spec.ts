import { expect, test } from '@playwright/test';
import pg from 'pg';

import { getAuthHeader, readTestSupportState } from '../_helpers/testSupportState';
import {
  assertAndLockFinanceStatementsPreviewDatabase,
  assertFinanceStatementsPreviewOptIn,
  cleanupFinanceStatementsPreviewFixture,
  financeStatementsPreviewResidue,
  seedFinanceStatementsPreviewFixture,
  type FinanceStatementsPreviewFixture,
  unlockFinanceStatementsPreviewDatabase,
} from './financeStatementsPreviewFixture';

const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3001';
const WEB_BASE_URL = process.env.E2E_BASE_URL || 'http://127.0.0.1:4173';

test('signed real-PG statement pack opens canonical preview across visual matrix', async ({
  browser,
  request,
}, testInfo) => {
  test.setTimeout(240_000);
  const { databaseUrl, expectedDatabase } = assertFinanceStatementsPreviewOptIn();
  const state = readTestSupportState();
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 2 });
  let client: pg.PoolClient | undefined;
  let fixture: FinanceStatementsPreviewFixture | undefined;
  let locked = false;
  try {
    client = await pool.connect();
    await assertAndLockFinanceStatementsPreviewDatabase(client, expectedDatabase);
    locked = true;
    fixture = await seedFinanceStatementsPreviewFixture(client, state.organizationId, state.userId);
    expect(await financeStatementsPreviewResidue(client, state.organizationId, fixture)).toEqual({
      packs: 1,
      statements: 3,
    });

    const api = await request.get(`${API_BASE_URL}/api/v8/finance/statement-packs`, {
      headers: getAuthHeader(),
    });
    expect(api.status()).toBe(200);
    const body = await api.json();
    expect(body.data.count).toBeGreaterThanOrEqual(1);
    expect(body.data.statementPacks.map((pack: { id: string }) => pack.id)).toContain(fixture.packId);

    const matrix = (['en', 'pl'] as const).flatMap((locale) =>
      (['light', 'dark'] as const).flatMap((scheme) => [
        { locale, scheme, width: 1440, height: 1000 },
        { locale, scheme, width: 390, height: 844 },
      ])
    );
    expect(matrix).toHaveLength(8);
    for (const entry of matrix) {
      const context = await browser.newContext({
        colorScheme: entry.scheme,
        locale: entry.locale === 'pl' ? 'pl-PL' : 'en-US',
        viewport: { width: entry.width, height: entry.height },
      });
      try {
        const page = await context.newPage();
        await page.addInitScript(
          ({ token, organizationId, userId, locale, scheme }) => {
            const user = {
              id: userId,
              organizationId,
              organizationName: 'E2E Organization',
              email: 'finance-statements-preview@local.test',
              role: 'OWNER',
              isAuthenticated: true,
              accessLevel: 'full',
            };
            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(user));
            localStorage.setItem('i18nextLng', locale);
            localStorage.setItem('theme', scheme);
            localStorage.setItem(
              'consultinity-storage',
              JSON.stringify({
                state: {
                  sessionMode: 'FULL',
                  currentUser: user,
                  currentOrganization: { id: organizationId, name: 'E2E Organization' },
                },
                version: 0,
              })
            );
          },
          {
            token: state.token,
            organizationId: state.organizationId,
            userId: state.userId,
            locale: entry.locale,
            scheme: entry.scheme,
          }
        );
        await page.goto(`${WEB_BASE_URL}/finance?tab=statements&lang=${entry.locale}`);
        const onboarding = page.getByRole('button', { name: /Skip for now|Pomiń/i });
        if (await onboarding.waitFor({ state: 'visible', timeout: 5_000 }).then(() => true).catch(() => false)) {
          await onboarding.click();
        }

        const rowText = page.getByText(fixture.entityName, { exact: true }).first();
        await expect(rowText).toBeVisible();
        await rowText.click();
        const preview = page.locator('[data-preview-pane]');
        await expect(preview).toHaveCount(1);
        const currencyRow = preview.locator('tr').filter({ hasText: /Currency|Waluta/i });
        const docsRow = preview.locator('tr').filter({ hasText: /Docs|Dok\./i });
        const mappedRow = preview.locator('tr').filter({ hasText: /Mapped lines|Zmapowane/i });
        await expect(currencyRow.getByText('EUR', { exact: true })).toBeVisible();
        await expect(docsRow.getByText('3', { exact: true })).toBeVisible();
        await expect(mappedRow.getByText('0 / 0', { exact: true })).toBeVisible();
        await expect(preview.locator('button[title="Close"], button[title="Zamknij"]')).toHaveCount(1);
        if (entry.width === 390) {
          await expect(page.getByTestId('mobile-preview-overlay')).toHaveCount(1);
        } else {
          await expect(page.getByTestId('mobile-preview-overlay')).toHaveCount(0);
        }
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
        ).toBe(true);
        await page.screenshot({
          path: testInfo.outputPath(
            `finance-statements-preview-${entry.locale}-${entry.scheme}-${entry.width}.png`
          ),
          fullPage: true,
        });

        await page.keyboard.press('Escape');
        await expect(page.locator('[data-preview-pane]')).toHaveCount(0);
        await page.waitForTimeout(100);
        await expect(page.locator('[data-preview-pane]')).toHaveCount(0);
        await rowText.click();
        await expect(page.locator('[data-preview-pane]')).toHaveCount(1);
      } finally {
        await context.close();
      }
    }
  } finally {
    try {
      if (client && fixture) {
        await cleanupFinanceStatementsPreviewFixture(client, state.organizationId, fixture);
        expect(await financeStatementsPreviewResidue(client, state.organizationId, fixture)).toEqual(
          fixture.baselineResidue
        );
      }
    } finally {
      try {
        if (client && locked) await unlockFinanceStatementsPreviewDatabase(client);
      } finally {
        client?.release();
        await pool.end();
      }
    }
  }
});
