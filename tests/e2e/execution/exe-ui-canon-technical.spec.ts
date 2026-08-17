import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import pg from 'pg';

import {
  addAdmin,
  authHeaders,
  bootstrap,
  cleanup,
  seedExecution,
  signedContext,
  type ExecutionPersona,
} from './_helpers/executionUiTechnicalFixture';

const API = process.env.E2E_API_URL || 'http://127.0.0.1:3001';

test.describe.serial('EXE-UI-CANON canonical delivery closure', () => {
  let creator: ExecutionPersona | null = null;
  test.afterEach(async ({ request }) => {
    if (creator) {
      await cleanup(request, creator);
      creator = null;
    }
  });

  test('signed distinct actors complete spine, four-eyes approval, close, receipt, reload and cold reopen', async ({
    browser,
    request,
  }) => {
    creator = await bootstrap(request, `exe-ui-flow-${Date.now().toString(36)}`);
    const approver = await addAdmin(request, creator);
    const seed = await seedExecution(creator);
    const creatorContext = await signedContext(browser, creator);
    const creatorPage = await creatorContext.newPage();
    await creatorPage.goto('/execution?tab=control');
    const panel = creatorPage.getByTestId('execution-delivery-closure');
    await expect(panel).toBeVisible();
    await panel.getByLabel('Initiative ID').fill(seed.initiativeId);
    await panel.getByLabel('Execution case ID').fill(seed.caseId);
    await panel.getByRole('button', { name: 'Start governed closure' }).click();
    await expect(creatorPage).toHaveURL(/executionLinkId=/);
    await creatorPage.waitForLoadState('networkidle');
    const linkId = new URL(creatorPage.url()).searchParams.get('executionLinkId')!;
    for (const [label, value] of [
      ['workRef', 'work:1'],
      ['resourceRef', 'resource:1'],
      ['controlRef', 'control:1'],
      ['reportRef', 'report:1'],
    ] as const) {
      const input = panel.getByLabel(label);
      await input.fill(value);
      await expect(input).toHaveValue(value);
    }
    await panel.getByRole('button', { name: 'Save complete delivery spine' }).click();
    await panel.getByLabel('Evidence artifact link').fill(seed.artifactLinkId);
    await panel.getByLabel('SHA-256').fill('sha256:exe-ui-content');
    await panel.getByRole('button', { name: 'Submit evidence' }).click();
    await expect(panel.getByText('SUBMITTED')).toBeVisible();
    await panel.getByRole('button', { name: 'Approve as independent reviewer' }).click();
    await expect(panel.getByRole('alert')).toBeVisible();
    await expect(panel.getByText('Results receipt persisted')).toHaveCount(0);
    await creatorContext.close();

    const approverContext = await signedContext(browser, approver);
    const page = await approverContext.newPage();
    await page.goto(`/execution?tab=control&executionLinkId=${encodeURIComponent(linkId)}`);
    const adminPanel = page.getByTestId('execution-delivery-closure');
    await adminPanel.getByRole('button', { name: 'Approve as independent reviewer' }).click();
    await expect(adminPanel.getByText('APPROVED')).toBeVisible();
    const closeButton = adminPanel.getByRole('button', {
      name: 'Close execution and emit Results signal',
    });
    await closeButton.dblclick();
    await expect(adminPanel.getByText('Results receipt persisted')).toBeVisible();
    const signalText = await adminPanel.getByText(/^Signal:/).textContent();
    await page.reload();
    await expect(adminPanel.getByText('Results receipt persisted')).toBeVisible();
    expect(await adminPanel.getByText(/^Signal:/).textContent()).toBe(signalText);
    const axe = await new AxeBuilder({ page })
      .include('[data-testid="execution-delivery-closure"]')
      .analyze();
    expect(axe.violations.filter((v) => ['critical', 'serious'].includes(v.impact || ''))).toEqual(
      []
    );
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus-visible')).toBeVisible();
    await approverContext.close();

    const cold = await signedContext(browser, approver);
    const coldPage = await cold.newPage();
    await coldPage.goto(`/execution?tab=control&executionLinkId=${encodeURIComponent(linkId)}`);
    await expect(coldPage.getByText('Results receipt persisted')).toBeVisible();
    expect(await coldPage.getByText(/^Signal:/).textContent()).toBe(signalText);
    await cold.close();
  });

  test('stale concurrent spine has one winner; foreign and revoked reads fail closed', async ({
    request,
  }) => {
    creator = await bootstrap(request, `exe-ui-negative-${Date.now().toString(36)}`);
    const foreign = await bootstrap(request, `exe-ui-foreign-${Date.now().toString(36)}`);
    const seed = await seedExecution(creator);
    const linkResponse = await request.post(`${API}/api/v8/case-workspace/execution-bvp/links`, {
      headers: { ...authHeaders(creator), 'Idempotency-Key': `link-${Date.now()}` },
      data: { initiativeId: seed.initiativeId, caseId: seed.caseId },
    });
    expect(linkResponse.status()).toBe(201);
    const linkId = (await linkResponse.json()).data.link_id;
    const writes = await Promise.all(
      ['a', 'b'].map((x) =>
        request.post(`${API}/api/v8/case-workspace/execution-bvp/links/${linkId}/spine`, {
          headers: authHeaders(creator!),
          data: {
            workRef: `work:${x}`,
            resourceRef: `resource:${x}`,
            controlRef: `control:${x}`,
            reportRef: `report:${x}`,
            expectedVersion: 1,
          },
        })
      )
    );
    expect(writes.map((r) => r.status()).sort()).toEqual([200, 404]);
    const foreignRead = await request.get(
      `${API}/api/v8/case-workspace/execution-bvp/links/${linkId}`,
      { headers: authHeaders(foreign) }
    );
    expect(foreignRead.status()).toBe(404);
    const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await db.connect();
    await db.query(
      `UPDATE organization_members SET status='REVOKED' WHERE organization_id=$1 AND user_id=$2`,
      [creator.organizationId, creator.userId]
    );
    await db.end();
    const revokedRead = await request.get(
      `${API}/api/v8/case-workspace/execution-bvp/links/${linkId}`,
      { headers: authHeaders(creator) }
    );
    expect(revokedRead.status()).toBe(403);
    await cleanup(request, foreign);
  });
});
