import type { Server } from 'node:http';

import { expect, test } from '@playwright/test';
import express from 'express';
import { Pool } from 'pg';

import { PostgresInitiativeReader } from '../../../server/src/domain/initiatives-execution/postgresInitiativeReader';
import { PostgresMaterialCommandUnitOfWork } from '../../../server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork';
import { createInitiativesExecutionRuntimeRouter } from '../../../server/src/routes/pmo/initiativesExecutionRuntime.routes';

const databaseUrl = process.env.DATABASE_URL?.trim();
test.skip(!databaseUrl, 'DATABASE_URL is required for non-mutating WCAG runtime acceptance');
const pool = new Pool({ connectionString: databaseUrl, max: 3 });
let server: Server;
const apiPort = Number(process.env.WCAG_API_PORT ?? 3311);

test.beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as express.Request & { user: Record<string, string> }).user = {
      id: req.header('x-e2e-actor') || 'validator',
      organizationId: 'nordwerk-browser',
      role: 'USER',
    };
    next();
  });
  app.use(
    '/api/initiatives/runtime-v1',
    createInitiativesExecutionRuntimeRouter({
      unitOfWork: new PostgresMaterialCommandUnitOfWork(pool),
      reader: new PostgresInitiativeReader(pool),
      authorize: async (_actor, projectId) => projectId === 'operations-transformation-2027',
      resolvePolicy: async () => ({
        policyId: 'standard-industrial',
        version: 3,
        baseline: 'STANDARD',
        strictness: 3,
        source: 'PROJECT',
        config: { selfApproval: false },
      }),
    })
  );
  await new Promise<void>((resolve) => {
    server = app.listen(apiPort, '127.0.0.1', resolve);
  });
});

test.afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
});

test('WCAG text resize 200% — canonical surfaces retain content and actions', async ({
  page,
}, testInfo) => {
  const initiative = await pool.query(
    `SELECT aggregate_id FROM ie_aggregate_state WHERE organization_id='nordwerk-browser' AND aggregate_type='initiative' ORDER BY updated_at DESC LIMIT 1`
  );
  const initiativeId = initiative.rows[0]?.aggregate_id as string | undefined;
  test.skip(
    !initiativeId,
    'No persisted Initiative: all downstream surfaces would be EMPTY/LIMITED'
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  const surfaces = [
    ['source', '?sourceProposalId=proposal-aco-browser'],
    ['card', `?initiativeId=${encodeURIComponent(initiativeId!)}`],
    ['initiatives', '?mode=initiative-register'],
    ['portfolio', `?mode=portfolio&initiativeId=${encodeURIComponent(initiativeId!)}`],
    ['plan', `?mode=plan&initiativeId=${encodeURIComponent(initiativeId!)}`],
    ['capacity', '?mode=capacity'],
    ['realizations', '?mode=execution-realizations'],
    ['work', '?mode=execution-work'],
    ['resources', '?mode=execution-resources'],
    ['control', '?mode=execution-control'],
    ['reports', '?mode=execution-reports'],
    ['my-work', '?mode=my-work'],
  ] as const;
  const coverage: Record<string, string> = {};
  for (const [name, query] of surfaces) {
    await page.goto(`/tests/e2e/fixtures/initiatives-execution-aco.html${query}`);
    await page.addStyleTag({ content: ':root { font-size: 200% !important; }' });
    await page.waitForTimeout(200);
    await expect(page.locator('#root')).toBeVisible();
    const geometry = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      rows: document.querySelectorAll('tbody tr').length,
      clippedActions: [...document.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]')]
        .filter((element) => {
          const box = element.getBoundingClientRect();
          if (!(box.width > 0 && box.height > 0 && (box.right > innerWidth + 1 || box.left < -1)))
            return false;
          const controlledTableScroll = element.closest<HTMLElement>('.overflow-x-auto');
          return !(
            controlledTableScroll &&
            controlledTableScroll.scrollWidth > controlledTableScroll.clientWidth
          );
        })
        .map(
          (element) =>
            element.getAttribute('aria-label') || element.textContent?.trim() || element.tagName
        ),
    }));
    coverage[name] = geometry.rows ? `DATA rows=${geometry.rows}` : 'EMPTY/LIMITED';
    expect(geometry.documentWidth, `${name}: horizontal document overflow`).toBeLessThanOrEqual(
      geometry.viewportWidth + 1
    );
    expect(geometry.clippedActions, `${name}: clipped actionable controls`).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath(`wcag-text-resize-200-${name}.png`),
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [name, query] of surfaces) {
    await page.goto(`/tests/e2e/fixtures/initiatives-execution-aco.html${query}`);
    await page.waitForTimeout(200);
    await expect(page.locator('#root')).toBeVisible();
    const geometry = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      clippedActions: [...document.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]')]
        .filter((element) => {
          const box = element.getBoundingClientRect();
          if (!(box.width > 0 && box.height > 0 && (box.right > innerWidth + 1 || box.left < -1)))
            return false;
          const controlledTableScroll = element.closest<HTMLElement>('.overflow-x-auto');
          return !(
            controlledTableScroll &&
            controlledTableScroll.scrollWidth > controlledTableScroll.clientWidth
          );
        })
        .map(
          (element) =>
            element.getAttribute('aria-label') || element.textContent?.trim() || element.tagName
        ),
    }));
    expect(geometry.documentWidth, `${name}: narrow horizontal document overflow`).toBeLessThanOrEqual(
      geometry.viewportWidth + 1
    );
    expect(geometry.clippedActions, `${name}: narrow clipped actionable controls`).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath(`responsive-narrow-390x844-${name}.png`),
      fullPage: true,
    });
  }
  await testInfo.attach('surface-coverage.json', {
    body: Buffer.from(JSON.stringify(coverage, null, 2)),
    contentType: 'application/json',
  });
});
