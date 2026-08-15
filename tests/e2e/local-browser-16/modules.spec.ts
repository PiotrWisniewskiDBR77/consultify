import fs from 'node:fs';
import path from 'node:path';

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';

type ModuleContract = { module: string; path: string; visibleText: RegExp; mixedAvailabilityCatalog?: boolean };

const modules: ModuleContract[] = [
  { module: '01-chat', path: '/chat', visibleText: /Chat|Teresa|conversation|rozmow/i },
  { module: '02-my-work', path: '/my-work', visibleText: /My Work|Moja praca|Inbox|Tasks|Zadania/i },
  { module: '03-interview', path: '/interview', visibleText: /Interview|Wywiad/i },
  { module: '04-tools', path: '/discovery-tools', visibleText: /Tools|Narzędzia/i, mixedAvailabilityCatalog: true },
  { module: '05-assessment', path: '/assessment/overview', visibleText: /Assessment|Ocena|DRD/i },
  { module: '06-initiatives', path: '/initiatives', visibleText: /Initiatives|Inicjatywy/i },
  { module: '07-execution', path: '/execution', visibleText: /Execution|Realizacja|Wdrożenie/i },
  { module: '08-results', path: '/results/kpi', visibleText: /Results|Wyniki|KPI/i },
  { module: '09-finance', path: '/finance', visibleText: /Finance|Finanse/i },
  { module: '10-materials', path: '/presentations', visibleText: /Materials|Materiały|Presentation|Prezentac/i },
  { module: '11-audits', path: '/audit-programs', visibleText: /Audit|Audyt/i },
  { module: '12-meeting', path: '/meeting', visibleText: /Meeting|Spotkani/i },
  { module: '13-organization', path: '/organization/profile', visibleText: /Organization|Organizacja|Company|Firma/i },
  { module: '14-admin', path: '/admin', visibleText: /Admin|Overview|Przegląd/i },
  { module: '15-settings', path: '/settings/profile', visibleText: /Settings|Ustawienia|Profile|Profil/i },
  { module: '16-partner-portal', path: '/partner', visibleText: /Partner/i },
];

const ignoredExternal = /favicon|analytics|telemetry|sentry|clarity|intercom|googletagmanager|google-analytics|fonts\.gstatic/i;
const forbiddenShell = /coming soon|wkrótce|module is disabled|moduł.*wyłączony|not available yet/i;
const stuckLoading = /loading\.\.\.|ładowanie\.\.\.|please wait|proszę czekać/i;

function evidenceFile(testInfo: TestInfo, module: string, extension: string) {
  const root = process.env.E2E_EVIDENCE_DIR || '/tmp/consultify-local-browser-16';
  return path.join(root, 'runtime', testInfo.project.name, `${module}.${extension}`);
}

function observe(page: Page) {
  let phase: 'initial' | 'reload' | 'post-reload' = 'initial';
  const consoleErrors: string[] = [];
  const failedRequests: Array<{ url: string; error: string }> = [];
  const reloadCausedAborts: Array<{ url: string; error: string; phase: 'reload' }> = [];
  const badApiResponses: Array<{ url: string; status: number }> = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && !ignoredExternal.test(message.location().url || message.text())) {
      consoleErrors.push(message.text());
    }
  });
  page.on('requestfailed', (request) => {
    const error = request.failure()?.errorText || 'unknown';
    const requestUrl = new URL(request.url());
    const isReloadCancelledHealthProbe =
      error === 'net::ERR_ABORTED' && requestUrl.pathname === '/api/health';
    const isReloadCancelledSocketPoll =
      phase === 'reload' &&
      error === 'net::ERR_ABORTED' &&
      requestUrl.pathname === '/socket.io/' &&
      requestUrl.searchParams.get('transport') === 'polling';
    if (isReloadCancelledSocketPoll) {
      reloadCausedAborts.push({ url: request.url(), error, phase: 'reload' });
      return;
    }
    if (error !== 'cancelled' && !isReloadCancelledHealthProbe && !ignoredExternal.test(request.url())) {
      failedRequests.push({ url: request.url(), error });
    }
  });
  page.on('response', (response) => {
    if (response.status() >= 400 && response.url().includes('/api/') && !ignoredExternal.test(response.url())) {
      badApiResponses.push({ url: response.url(), status: response.status() });
    }
  });
  return {
    consoleErrors,
    failedRequests,
    reloadCausedAborts,
    badApiResponses,
    setPhase(next: 'initial' | 'reload' | 'post-reload') { phase = next; },
  };
}

test.describe('LOCAL-BROWSER-16 normal OWNER UI gate', () => {
  for (const contract of modules) {
    test(`${contract.module}: mounted, reloadable, visual and accessible`, async ({ page }, testInfo) => {
      const runtime = observe(page);
      await page.goto(contract.path, { waitUntil: 'domcontentloaded' });
      await expect(page).not.toHaveURL(/\/login(?:[/?#]|$)/);
      await expect(page.locator('#root')).toContainText(contract.visibleText, { timeout: 45_000 });
      await page.waitForTimeout(1_500);

      const firstPass = await page.locator('body').innerText();
      expect(firstPass.length, 'mounted content density').toBeGreaterThan(80);
      if (contract.mixedAvailabilityCatalog) {
        // Individual library entries may truthfully advertise future
        // availability; the mounted Tools module itself must still expose
        // active tools and actionable content.
        expect(firstPass, 'mixed catalog must contain active tools').toMatch(/Active|Aktywny/i);
      } else {
        expect(firstPass, 'disabled/soon shell mismatch').not.toMatch(forbiddenShell);
      }
      expect(firstPass, 'stuck loading state').not.toMatch(stuckLoading);
      expect(firstPass).not.toMatch(/Something went wrong|Coś poszło nie tak|Internal Server Error/i);

      const ui = await page.evaluate(() => {
        const root = document.querySelector('#root');
        const style = root ? getComputedStyle(root) : null;
        const visible = (element: Element) => {
          const rect = (element as HTMLElement).getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        };
        const interactives = [...document.querySelectorAll('button,a[href],input,select,textarea')].filter(visible);
        const enabled = interactives.filter((element) => !(element as HTMLButtonElement).disabled);
        return {
          title: document.title,
          backgroundColor: style?.backgroundColor || '',
          color: style?.color || '',
          fontFamily: style?.fontFamily || '',
          viewport: { width: window.innerWidth, height: window.innerHeight },
          scrollWidth: document.documentElement.scrollWidth,
          interactiveCount: interactives.length,
          enabledInteractiveCount: enabled.length,
          headings: document.querySelectorAll('h1,h2,h3,[role="heading"]').length,
          mainLandmarks: document.querySelectorAll('main,[role="main"]').length,
        };
      });
      expect(ui.title).not.toBe('');
      expect(ui.fontFamily).not.toBe('');
      expect(ui.enabledInteractiveCount, 'core action must be available').toBeGreaterThan(0);
      expect(ui.headings, 'page heading').toBeGreaterThan(0);
      expect(ui.scrollWidth, 'no material horizontal overflow').toBeLessThanOrEqual(ui.viewport.width + 8);

      const axe = await new AxeBuilder({ page }).analyze();
      const blockingA11y = axe.violations.filter((item) => item.impact === 'critical' || item.impact === 'serious');

      await page.screenshot({ path: evidenceFile(testInfo, contract.module, 'png'), fullPage: true });
      runtime.setPhase('reload');
      await page.reload({ waitUntil: 'domcontentloaded' });
      runtime.setPhase('post-reload');
      await expect(page.locator('#root')).toContainText(contract.visibleText, { timeout: 45_000 });
      await page.waitForTimeout(750);

      const evidence = {
        baseline: process.env.E2E_CANDIDATE_SHA,
        contract,
        finalUrl: page.url(),
        ui,
        a11y: blockingA11y.map(({ id, impact, help, nodes }) => ({ id, impact, help, nodes: nodes.length })),
        consoleErrors: runtime.consoleErrors,
        failedRequests: runtime.failedRequests,
        reloadCausedAborts: runtime.reloadCausedAborts,
        badApiResponses: runtime.badApiResponses,
      };
      const output = evidenceFile(testInfo, contract.module, 'json');
      fs.mkdirSync(path.dirname(output), { recursive: true });
      fs.writeFileSync(output, JSON.stringify(evidence, null, 2));

      expect(runtime.consoleErrors, 'console errors').toEqual([]);
      expect(runtime.failedRequests, 'failed requests').toEqual([]);
      expect(runtime.badApiResponses, 'unexpected API HTTP >=400').toEqual([]);
      expect(blockingA11y, 'serious/critical a11y violations').toEqual([]);
    });
  }
});
