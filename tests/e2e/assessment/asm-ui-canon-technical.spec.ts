import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import {
  addMember,
  bootstrap,
  cleanup,
  grantApprover,
  prepareForReview,
  sessionIdFrom,
  signedContext,
  type AssessmentPersona,
} from './_helpers/assessmentUiTechnicalFixture';

test.describe('ASM-UI-CANON server-authoritative technical journey', () => {
  let owner: AssessmentPersona | undefined;
  let foreign: AssessmentPersona | undefined;

  test.afterEach(async ({ request }) => {
    await cleanup(request, ...[owner?.runId, foreign?.runId].filter((id): id is string => Boolean(id)));
    owner = undefined;
    foreign = undefined;
  });

  test('permission denial, approver freeze and cold persisted downstream readback', async ({ browser, request }) => {
    const runId = `asm-ui-${Date.now()}`;
    owner = await bootstrap(request, runId);
    const approver = await addMember(request, owner, 'ADMIN');
    const ownerContext = await signedContext(browser, owner);
    const ownerPage = await ownerContext.newPage();

    await ownerPage.goto('/assessment?tab=library');
    await ownerPage
      .getByRole('row', { name: /Digital Readiness Diagnosis DRD/i })
      .getByRole('button', { name: 'Start' })
      .click();
    await expect(ownerPage).toHaveURL(/\/assessment\/drd\//);
    const sessionId = sessionIdFrom(ownerPage.url());
    await grantApprover(request, owner, sessionId, approver);
    await prepareForReview(request, owner, sessionId);
    await ownerPage.reload();
    const ownerSession = await request.get(`/api/method/sessions/${sessionId}`, {
      headers: { Authorization: `Bearer ${owner.token}` },
    });
    expect(ownerSession.status()).toBe(200);
    expect((await ownerSession.json()).roles).not.toContain('approver');
    await ownerPage.getByRole('button', { name: /Wyślij do przeglądu/i }).click();
    await expect(ownerPage.getByRole('button', { name: /Wyślij do przeglądu/i })).toBeDisabled();

    // Owner is not an approver: the UI must not present a successful freeze.
    await expect(ownerPage.getByTestId('freeze-button')).toBeDisabled();

    const approverContext = await signedContext(browser, approver);
    const approverPage = await approverContext.newPage();
    await approverPage.goto(`/assessment/drd/${sessionId}`);
    await approverPage.getByTestId('freeze-button').click();
    await expect(approverPage.getByTestId('drd-http-frozen-output-view')).toBeVisible();
    // SoD stays exact: the approver freezes; the owner creates the governed
    // downstream artifacts from the immutable Output.
    await ownerPage.reload();
    await expect(ownerPage.getByTestId('drd-http-frozen-output-view')).toBeVisible();
    await ownerPage.getByRole('button', { name: /Generuj raport z Outputu/i }).click();
    await ownerPage.getByRole('button', { name: /Wygeneruj z findingów/i }).click();

    const coldContext = await signedContext(browser, owner, { width: 390, height: 844 });
    const coldPage = await coldContext.newPage();
    await coldPage.goto(`/assessment/drd/${sessionId}`);
    await expect(coldPage.getByTestId('output-panel')).toContainText('AssessmentOutput');
    await expect(coldPage.getByTestId('report-panel')).not.toContainText('Brak zapisanego raportu');
    await expect(coldPage.getByTestId('initiative-panel')).not.toContainText('Brak zapisanego Initiative Proposal');
    await coldPage.reload();
    await expect(coldPage.getByTestId('drd-http-frozen-output-view')).toBeVisible();

    const axe = await new AxeBuilder({ page: coldPage }).analyze();
    expect(axe.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')).toEqual([]);
    await ownerContext.close();
    await approverContext.close();
    await coldContext.close();
  });

  test('two signed contexts expose a stale CAS conflict and foreign tenant fails closed', async ({ browser, request }) => {
    owner = await bootstrap(request, `asm-stale-${Date.now()}`);
    const first = await signedContext(browser, owner);
    const firstPage = await first.newPage();
    await firstPage.goto('/assessment?tab=library');
    await firstPage
      .getByRole('row', { name: /Digital Readiness Diagnosis DRD/i })
      .getByRole('button', { name: 'Start' })
      .click();
    await expect(firstPage).toHaveURL(/\/assessment\/drd\//);
    const sessionId = sessionIdFrom(firstPage.url());
    await prepareForReview(request, owner, sessionId);

    const second = await signedContext(browser, owner);
    const secondPage = await second.newPage();
    await Promise.all([firstPage.goto(`/assessment/drd/${sessionId}`), secondPage.goto(`/assessment/drd/${sessionId}`)]);
    await expect(firstPage.getByRole('button', { name: /Wyślij do przeglądu/i })).toBeEnabled();
    await expect(secondPage.getByRole('button', { name: /Wyślij do przeglądu/i })).toBeEnabled();
    // Both pages hydrate the same version first. Advance the canonical row in
    // the first context, then submit the deliberately stale second context.
    // Sequencing removes scheduler-dependent refresh races while preserving
    // the real mounted CAS conflict contract.
    let releaseStaleRequest!: () => void;
    const staleRequestMayContinue = new Promise<void>((resolve) => { releaseStaleRequest = resolve; });
    let staleRequestCaptured!: () => void;
    const staleRequestWasCaptured = new Promise<void>((resolve) => { staleRequestCaptured = resolve; });
    await secondPage.route(`**/api/method/sessions/${sessionId}/transition`, async (route) => {
      staleRequestCaptured();
      await staleRequestMayContinue;
      await route.continue();
    });
    const staleClick = secondPage.getByRole('button', { name: /Wyślij do przeglądu/i }).click();
    await staleRequestWasCaptured;
    await firstPage.getByRole('button', { name: /Wyślij do przeglądu/i }).click();
    await expect(firstPage.getByRole('button', { name: /Wyślij do przeglądu/i })).toBeDisabled();
    releaseStaleRequest();
    await staleClick;
    await expect(secondPage.getByTestId('drd-http-conflict-view')).toBeVisible();
    await expect(firstPage.getByTestId('drd-http-conflict-view')).toHaveCount(0);

    foreign = await bootstrap(request, `asm-foreign-${Date.now()}`);
    const foreignContext = await signedContext(browser, foreign);
    const foreignPage = await foreignContext.newPage();
    await foreignPage.goto(`/assessment/drd/${sessionId}`);
    await expect(foreignPage.getByTestId('drd-http-error-view')).toBeVisible();
    await expect(foreignPage.getByTestId('drd-http-frozen-output-view')).toHaveCount(0);

    await first.close();
    await second.close();
    await foreignContext.close();
  });
});
