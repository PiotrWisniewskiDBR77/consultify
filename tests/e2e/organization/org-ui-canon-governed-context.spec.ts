import { expect, test } from '@playwright/test';

import {
  type OrgUiGovernedFixture,
  createOrgUiGovernedFixture,
  seedOrgUiBrowserAuth,
} from './orgUiGovernedContextFixture';

const realDb =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  (process.env.DATABASE_URL ?? '').startsWith('postgres');

if (realDb) {
  if (process.env.ORG_UI_ALLOW_IMMUTABLE_FIXTURE_CLEANUP !== '1') {
    throw new Error('ORG_UI_ALLOW_IMMUTABLE_FIXTURE_CLEANUP=1 is required');
  }
  if (!process.env.ORG_UI_DISPOSABLE_DB_PREFIX) {
    throw new Error('ORG_UI_DISPOSABLE_DB_PREFIX is required');
  }
}

test.describe('ORG-UI-CANON-001 governed context journey', () => {
  test.skip(!realDb, 'requires mounted application and real PostgreSQL');
  test.describe.configure({ mode: 'serial' });
  let fixture: OrgUiGovernedFixture;

  test.beforeAll(async () => {
    fixture = await createOrgUiGovernedFixture();
  });

  test.afterAll(async () => {
    await fixture?.cleanup();
  });

  test('owner reviews document claims, publishes, reopens exact versions and cold-reloads them', async ({
    page,
    browser,
  }) => {
    await seedOrgUiBrowserAuth(page, fixture, 'owner');
    await page.goto('/organization/context-governance');
    await expect(page.getByTestId('governed-context-workspace')).toBeVisible();
    await expect(page.getByText('evidence.documentExtraction')).toBeVisible();
    await expect(page.getByText('metadata.custom')).toBeVisible();

    const approve = page.getByRole('button', { name: 'Approve', exact: true });
    for (let remaining = await approve.count(); remaining > 0; remaining -= 1) {
      await expect(approve.first()).toBeEnabled();
      await approve.first().click();
      await expect(approve).toHaveCount(remaining - 1);
    }
    const publish = page.getByRole('button', { name: 'Publish approved claims' });
    await expect(publish).toBeEnabled();
    await publish.click();
    await expect(page.getByText('Immutable version 1 was published.')).toBeVisible();
    const firstHash = (await page.getByText(/^[a-f0-9]{64}$/).first().textContent()) ?? '';
    expect(firstHash).toHaveLength(64);

    await publish.click();
    await expect(page.getByText('Immutable version 2 was published.')).toBeVisible();
    await page.getByRole('button', { name: 'Open exact version' }).last().click();
    await expect(page.getByRole('region', { name: 'Version 1' })).toContainText(firstHash);

    const cold = await browser.newContext({ storageState: undefined });
    await seedOrgUiBrowserAuth(cold, fixture, 'owner');
    const coldPage = await cold.newPage();
    await coldPage.goto('/organization/context-governance');
    await expect(coldPage.getByText('Version 2')).toBeVisible();
    await expect(coldPage.getByText('Version 1')).toBeVisible();
    await cold.close();
  });

  test('member is read-only, confidentiality filtered, revoked and foreign tenants fail closed', async ({
    browser,
    request,
  }) => {
    const member = await browser.newContext({ storageState: undefined });
    await seedOrgUiBrowserAuth(member, fixture, 'member');
    const memberPage = await member.newPage();
    await memberPage.goto('/organization/context-governance');
    await expect(memberPage.getByText(/read-only access/i)).toBeVisible();
    await expect(memberPage.getByText('metadata.custom')).toHaveCount(0);
    await expect(memberPage.getByRole('button', { name: 'Approve', exact: true })).toHaveCount(0);
    await member.close();

    const apiBase = process.env.E2E_BACKEND_URL || 'http://127.0.0.1:3001';
    const revoked = await request.get(`${apiBase}/api/organization-context/governed/claims`, {
      headers: { Authorization: `Bearer ${fixture.tokens.revoked}` },
    });
    expect(revoked.status()).toBe(403);
    expect(await revoked.json()).toMatchObject({ code: 'ORG_MEMBERSHIP_REVOKED' });

    const foreignClaims = await request.get(
      `${apiBase}/api/organization-context/governed/versions/1`,
      { headers: { Authorization: `Bearer ${fixture.tokens.foreign}` } }
    );
    expect(foreignClaims.status()).toBe(404);
  });
});
