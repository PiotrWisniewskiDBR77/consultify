import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import {
  addMember,
  bootstrap,
  cleanup,
  sessionIdFrom,
  signedContext,
  type AssessmentPersona,
} from './_helpers/assessmentUiTechnicalFixture';

test.describe('ASM-UI-CANON mounted Library and cold reopen', () => {
  let owner: AssessmentPersona | undefined;
  let foreign: AssessmentPersona | undefined;

  test.afterEach(async ({ request }) => {
    await cleanup(request, ...[owner?.runId, foreign?.runId].filter((id): id is string => Boolean(id)));
    owner = undefined;
    foreign = undefined;
  });

  test('Library lists exact identity/version, opens read-only, cold reopens and remains responsive/accessible', async ({ browser, request }) => {
    owner = await bootstrap(request, `asm-ui-${Date.now()}`);
    const ownerContext = await signedContext(browser, owner);
    const ownerPage = await ownerContext.newPage();
    await ownerPage.goto('/assessment?tab=library');
    await ownerPage.getByRole('row', { name: /Digital Readiness Diagnosis DRD/i }).getByRole('button', { name: 'Start' }).click();
    await expect(ownerPage).toHaveURL(/\/assessment\/drd\//);
    const sessionId = sessionIdFrom(ownerPage.url());

    const reader = await addMember(request, owner, 'ADMIN');
    const readerContext = await signedContext(browser, reader);
    const readerPage = await readerContext.newPage();
    await readerPage.goto('/assessment?tab=library');
    const sessionRow = readerPage.getByRole('row').filter({ hasText: sessionId });
    await expect(sessionRow).toContainText('2.0.0-methodpack.1');
    await expect(sessionRow).toContainText('v1');
    await sessionRow.getByRole('button', { name: /Open|Otwórz/ }).click();
    await expect(readerPage).toHaveURL(new RegExp(`/assessment/drd/${sessionId}$`));
    await expect(readerPage.getByText(`ID: ${sessionId}`)).toBeVisible();
    await expect(readerPage.getByText('method: drd@2.0.0-methodpack.1')).toBeVisible();
    await expect(readerPage.getByRole('button', { name: 'Zapisz teraz' })).toBeDisabled();
    await readerPage.reload();
    await expect(readerPage.getByText(`ID: ${sessionId}`)).toBeVisible();

    for (const viewport of [
      { width: 1440, height: 900, name: 'desktop' },
      { width: 768, height: 900, name: 'tablet' },
      { width: 390, height: 844, name: 'mobile' },
    ]) {
      await readerPage.setViewportSize(viewport);
      expect(await readerPage.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      await readerPage.screenshot({ path: test.info().outputPath(`asm-${viewport.name}-light.png`), fullPage: true });
    }
    await readerPage.evaluate(() => document.documentElement.classList.add('dark'));
    await readerPage.screenshot({ path: test.info().outputPath('asm-mobile-dark.png'), fullPage: true });
    const axe = await new AxeBuilder({ page: readerPage }).analyze();
    expect(axe.violations.filter((violation) => ['critical', 'serious'].includes(violation.impact ?? ''))).toEqual([]);

    await ownerContext.close();
    await readerContext.close();
  });

  test('foreign tenant is denied or concealed and transport loss is mounted fail-closed with retry', async ({ browser, request }) => {
    owner = await bootstrap(request, `asm-stale-${Date.now()}`);
    const ownerContext = await signedContext(browser, owner);
    const ownerPage = await ownerContext.newPage();
    await ownerPage.goto('/assessment?tab=library');
    await ownerPage.getByRole('row', { name: /Digital Readiness Diagnosis DRD/i }).getByRole('button', { name: 'Start' }).click();
    await expect(ownerPage).toHaveURL(/\/assessment\/drd\//);
    const sessionId = sessionIdFrom(ownerPage.url());

    foreign = await bootstrap(request, `asm-foreign-${Date.now()}`);
    const foreignRead = await request.get(`/api/method/sessions/${sessionId}`, {
      headers: { Authorization: `Bearer ${foreign.token}` },
    });
    expect([403, 404]).toContain(foreignRead.status());
    const foreignContext = await signedContext(browser, foreign);
    const foreignPage = await foreignContext.newPage();
    await foreignPage.goto(`/assessment/drd/${sessionId}`);
    await expect(foreignPage.getByTestId('drd-http-error-view')).toBeVisible();
    await expect(foreignPage.getByTestId('method-workspace-shell')).toHaveCount(0);

    const offlineContext = await signedContext(browser, owner);
    const offlinePage = await offlineContext.newPage();
    await offlinePage.route(`**/api/method/sessions/${sessionId}`, (route) => route.abort('internetdisconnected'));
    await offlinePage.goto(`/assessment/drd/${sessionId}`);
    await expect(offlinePage.getByTestId('drd-http-error-view')).toContainText(/Brak połączenia|Offline/i);
    await expect(offlinePage.getByTestId('error-retry')).toBeEnabled();
    await expect(offlinePage.getByTestId('method-workspace-shell')).toHaveCount(0);

    await ownerContext.close();
    await foreignContext.close();
    await offlineContext.close();
  });
});
