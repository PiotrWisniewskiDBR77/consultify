/**
 * Z-43/Z-48 real-browser regression gate.
 *
 * jsdom cannot calculate table layout. This test uses Chromium against the
 * production ProjectStageGatesPanel mounted by the dev-render harness and
 * checks the live bounding boxes at the owner's 360 px viewport.
 */
import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

test.use({ viewport: { width: 360, height: 900 } });

test('PL360 keeps both columns and exact approved status inside the table viewport', async ({
  page,
}) => {
  await page.goto('/?screen=z41-pmo-projekty&lang=pl&theme=light&state=full&gateState=passed&uwagi=0', {
    waitUntil: 'networkidle',
  });
  await page.locator('table tbody tr').first().click();

  const panel = page.getByTestId('project-stage-gates-panel');
  const mobileList = panel.getByTestId('project-stage-gates-mobile-list');
  await expect(mobileList.getByText('Zatwierdzony', { exact: true }).first()).toBeVisible();

  const measurement = await panel.evaluate((root) => {
    const list = root.querySelector<HTMLElement>('[data-testid="project-stage-gates-mobile-list"]');
    if (!list) throw new Error('ProjectStageGatesPanel mobile list not found');
    const rect = (element: Element) => {
      const value = element.getBoundingClientRect();
      return { left: value.left, right: value.right, width: value.width };
    };
    const rows = Array.from(
      list.querySelectorAll('[data-testid="project-stage-gate-mobile-row"]')
    ).map(rect);
    const statuses = Array.from(
      list.querySelectorAll('[data-testid="project-stage-gate-mobile-status"]')
    ).map(rect);
    const status = Array.from(list.querySelectorAll('span')).find(
      (element) => element.textContent?.trim() === 'Zatwierdzony'
    );
    if (!status) throw new Error('Exact status Zatwierdzony not found');
    return {
      viewport: rect(list),
      clientWidth: list.clientWidth,
      scrollWidth: list.scrollWidth,
      rows,
      statuses,
      status: rect(status),
    };
  });

  expect(measurement.scrollWidth).toBeLessThanOrEqual(measurement.clientWidth + 1);
  for (const row of measurement.rows) {
    expect(row.left).toBeGreaterThanOrEqual(measurement.viewport.left - 1);
    expect(row.right).toBeLessThanOrEqual(measurement.viewport.right + 1);
  }
  for (const status of measurement.statuses) {
    expect(status.left).toBeGreaterThanOrEqual(measurement.viewport.left - 1);
    expect(status.right).toBeLessThanOrEqual(measurement.viewport.right + 1);
  }
  expect(measurement.status.left).toBeGreaterThanOrEqual(measurement.viewport.left - 1);
  expect(measurement.status.right).toBeLessThanOrEqual(measurement.viewport.right + 1);
  const evidenceDir = 'evidence/d3-review-fixes/screens';
  mkdirSync(evidenceDir, { recursive: true });
  await panel.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${evidenceDir}/pmo-stage-gate-pl-360-light.png` });
  writeFileSync(
    `${evidenceDir}/pmo-stage-gate-pl-360-light.json`,
    `${JSON.stringify(measurement, null, 2)}\n`
  );
});
