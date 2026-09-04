// @vitest-environment node
// KONTRAKT DYŻURU 343 — DEC-388 broniony skutkiem w wyrenderowanym widoku.
import path from 'node:path';

import { chromium } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { INITIATIVE_BOARD_CANONICAL_ORDER } from '../../../src/components/Initiatives/sections/initiativeCardContract';

const EXPECTED_BOARD_IDS = [
  'initiative-definition',
  'tasks',
  'timeline',
  'deliverables-milestones',
  'dependencies',
  'decisions',
  'risk-raid',
  'gates',
  'suggested-changes',
  'change-log',
  'target-state-scope',
  'kpi',
  'okr',
  'hypothesis',
  'financial-analysis',
  'financial-impact',
  'team',
  'workstream-owners',
  'raci',
  'resources',
  'attachments-links',
  'used-in',
  'artifacts',
  'lessons-learned',
] as const;

describe('DEC-388 — realny widok karty zachowuje komplet Menu 3', () => {
  let server: ViteDevServer;

  beforeAll(async () => {
    process.env.VITE_VF1_INITIATIVE_SECTIONS_COMPLETE = '1';
    server = await createServer({
      configFile: path.resolve('dev-render/vite.config.ts'),
      server: { host: '127.0.0.1', port: 5530, strictPort: true },
      logLevel: 'error',
    });
    await server.listen();
  }, 60_000);

  afterAll(async () => {
    await server?.close();
    delete process.env.VITE_VF1_INITIATIVE_SECTIONS_COMPLETE;
  });

  it(
    'renderuje wszystkie imienne sekcje i pięć grup dla quick_win przy fladze ON',
    async () => {
      for (const expectedId of EXPECTED_BOARD_IDS) {
        expect(
          INITIATIVE_BOARD_CANONICAL_ORDER,
          `brak sekcji w INITIATIVE_BOARD_CANONICAL_ORDER: ${expectedId}`
        ).toContain(expectedId);
      }

      const browser = await chromium.launch();
      try {
        const page = await browser.newPage();
        await page.goto(
          'http://127.0.0.1:5530/?screen=karta-initiative&szablon=quick-win&lang=pl&theme=light',
          { waitUntil: 'domcontentloaded', timeout: 45_000 }
        );
        await page.waitForSelector('[data-nmode-section-item]', { timeout: 45_000 });

        const renderedIds = await page.$$eval('[data-nmode-section-item]', (nodes) =>
          nodes.map((node) => node.getAttribute('data-nmode-section-item'))
        );
        const renderedGroups = await page.$$eval('[data-nmode-section-group]', (nodes) =>
          nodes.map((node) => node.getAttribute('data-nmode-section-group'))
        );

        for (const expectedId of EXPECTED_BOARD_IDS) {
          expect(renderedIds, `brak sekcji boardu w DOM: ${expectedId}`).toContain(expectedId);
        }
        expect(renderedIds).toHaveLength(EXPECTED_BOARD_IDS.length);
        expect(renderedGroups).toHaveLength(5);
      } finally {
        await browser.close();
      }
    },
    60_000
  );
});
