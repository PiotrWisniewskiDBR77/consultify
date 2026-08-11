/* eslint-disable */
/**
 * FALA 0 — driver interaktywny do re-weryfikacji RN-G2 (jednorazowy, do
 * skasowania po zadaniu; nie jest częścią stałego harnessu jak shot.mjs).
 * Jeden proces przeglądarki, jedna karta per ekran, sekwencja kroków
 * (klik/klawiatura/reload) z zrzutem PO KAŻDYM kroku + zbiorem błędów
 * konsoli/sieci per krok. Wypisuje JSON na stdout.
 *
 * node dev-render/verify-f0.mjs > /tmp/f0-report.json
 */
import { chromium } from 'playwright';
import fs from 'fs';

const BASE = 'http://localhost:3601/';
const OUTDIR = 'docs/qa/screens/rn-g3-f0-reverify-2026-08-11';
fs.mkdirSync(OUTDIR, { recursive: true });

// ── plan ekranów ────────────────────────────────────────────────────────
const SCENARIOS = [
  {
    screen: 'shell-kpi',
    url: `${BASE}?screen=results-vnext-registry-shell&domain=kpi&state=ready`,
    steps: [
      { name: 'initial' },
      { name: 'row1-click', click: 'tbody tr:nth-child(1)' },
      { name: 'row1-click-again', click: 'tbody tr:nth-child(1)' },
      { name: 'kebab-row1-open', click: 'tbody tr:nth-child(1) button[aria-label="Row actions"]' },
      { name: 'kebab-esc', key: 'Escape' },
      { name: 'columns-popover-open', click: 'button[aria-label="Columns"], button[title="Columns"], button[aria-label="Kolumny"], button[title="Kolumny"]' },
    ],
  },
  {
    screen: 'shell-roi-locked',
    url: `${BASE}?screen=results-vnext-registry-shell&domain=roi&state=ready`,
    steps: [{ name: 'initial' }],
  },
  {
    screen: 'shell-okr-forbidden',
    url: `${BASE}?screen=results-vnext-registry-shell&domain=okr&state=forbidden`,
    steps: [{ name: 'initial' }],
  },
  {
    screen: 'kpi-registry',
    url: `${BASE}?screen=results-vnext-kpi-registry&state=ready`,
    steps: [
      { name: '00-initial' },
      { name: '01-tab-organizacja', click: 'text=Organizacja' },
      { name: '02-tab-moje', click: 'text=Moje' },
      { name: '03-chip-all', evalClickByText: 'Wszystkie' },
      { name: '04-row-active-click', click: 'tbody tr:nth-child(1)' },
      { name: '05-row-active-click-again', click: 'tbody tr:nth-child(1)' },
      { name: '06-kebab-active-open', click: 'tbody tr:nth-child(1) button[aria-label="Row actions"]' },
      { name: '07-kebab-esc-focus-return', key: 'Escape' },
      { name: '08-kebab-draft-open', click: 'tbody tr:nth-child(2) button[aria-label="Row actions"]' },
      { name: '09-kebab-archived-open', evalClickByText: null, key: 'Escape' },
      { name: '10-tab-karty-wynikow', click: 'text=Karty wyników' },
      { name: '11-tab-back-moje', click: 'text=Moje' },
      { name: '12-columns-popover', click: 'button[aria-label="Kolumny" i], button[title="Kolumny" i]' },
    ],
  },
  {
    screen: 'roi-registry',
    url: `${BASE}?screen=results-vnext-roi-registry&tab=all&state=ready`,
    steps: [
      { name: '00-initial' },
      { name: '01-tab-benefits', click: 'text=Benefits realization, text=Realizacja korzyści' },
      { name: '02-tab-all', click: 'text=All cases, text=Wszystkie sprawy' },
      { name: '03-row1-click', click: 'tbody tr:nth-child(1)' },
      { name: '04-row1-click-again', click: 'tbody tr:nth-child(1)' },
      { name: '05-kebab-row1', click: 'tbody tr:nth-child(1) button[aria-label="Row actions"]' },
      { name: '06-esc', key: 'Escape' },
    ],
  },
  {
    screen: 'roi-model',
    url: `${BASE}?screen=results-vnext-roi-model&tab=settings&selected=roi-case-1`,
    steps: [
      { name: '00-settings' },
      { name: '01-tab-assumptions', click: 'text=Założenia' },
      { name: '02-tab-cost-lines', click: 'text=Koszty, text=Linie kosztów' },
      { name: '03-tab-benefit-lines', click: 'text=Korzyści, text=Linie korzyści' },
    ],
  },
  {
    screen: 'okr-registry',
    url: `${BASE}?screen=results-vnext-okr-registry&tab=org`,
    steps: [
      { name: '00-initial' },
      { name: '01-tab-moje', click: 'text=Moje' },
      { name: '02-tab-firma', click: 'text=Firma' },
      { name: '03-tab-org', click: 'text=Organizacja' },
      { name: '04-row1-click', click: 'tbody tr:nth-child(1)' },
      { name: '05-row1-click-again', click: 'tbody tr:nth-child(1)' },
      { name: '06-kebab-row1', click: 'tbody tr:nth-child(1) button[aria-label="Row actions"]' },
      { name: '07-esc', key: 'Escape' },
    ],
  },
  {
    screen: 'okr-objectives',
    url: `${BASE}?screen=results-vnext-okr-objectives&level=objectives`,
    steps: [
      { name: '00-objectives' },
      { name: '01-row1-click', click: 'tbody tr:nth-child(2)' },
      { name: '02-kebab-row1', click: 'tbody tr:nth-child(1) button[aria-label="Row actions"]' },
      { name: '03-esc', key: 'Escape' },
    ],
  },
  {
    screen: 'okr-objectives-krs',
    url: `${BASE}?screen=results-vnext-okr-objectives&level=keyResults`,
    steps: [
      { name: '00-key-results' },
      { name: '01-kebab-row1', click: 'tbody tr:nth-child(1) button[aria-label="Row actions"]' },
      { name: '02-esc', key: 'Escape' },
    ],
  },
  {
    screen: 'okr-objectives-checkins',
    url: `${BASE}?screen=results-vnext-okr-objectives&level=checkIns`,
    steps: [{ name: '00-check-ins' }],
  },
  {
    screen: 'kpi-scorecards-list',
    url: `${BASE}?screen=results-vnext-kpi-scorecards&view=list`,
    steps: [
      { name: '00-list' },
      { name: '01-row1-click', click: 'tbody tr:nth-child(1)' },
      { name: '02-kebab-row1', click: 'tbody tr:nth-child(1) button[aria-label="Row actions"]' },
      { name: '03-esc', key: 'Escape' },
    ],
  },
  {
    screen: 'kpi-scorecards-detail',
    url: `${BASE}?screen=results-vnext-kpi-scorecards&view=detail&scorecard=sc-1&tab=items`,
    steps: [
      { name: '00-items' },
      { name: '01-tab-snapshots', click: 'text=Migawki, text=Snapshots' },
    ],
  },
  {
    screen: 'legacy-archive',
    url: `${BASE}?screen=results-vnext-legacy-archive&domain=roi`,
    steps: [
      { name: '00-roi' },
      { name: '01-domain-kpi', evalUrl: `${BASE}?screen=results-vnext-legacy-archive&domain=kpi` },
      { name: '02-domain-okr', evalUrl: `${BASE}?screen=results-vnext-legacy-archive&domain=okr` },
    ],
  },
];

(async () => {
  const browser = await chromium.launch();
  const report = [];

  for (const scenario of SCENARIOS) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    const stepLog = [];
    let consoleErrors = [];
    let netErrors = [];
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 400));
    });
    page.on('pageerror', (e) => consoleErrors.push('PAGEERROR ' + String(e).slice(0, 400)));
    page.on('response', (res) => {
      if (res.status() >= 400) netErrors.push(`${res.status()} ${res.request().method()} ${res.url()}`);
    });
    await page.route('**/*', (route) => {
      const u = route.request().url();
      if (u.startsWith('http://localhost') || u.startsWith('http://127.0.0.1') || u.startsWith('data:') || u.startsWith('blob:')) {
        return route.continue();
      }
      return route.abort();
    });

    try {
      await page.goto(scenario.url, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(1200);
    } catch (e) {
      stepLog.push({ step: 'goto', error: String(e).slice(0, 300) });
    }

    for (const step of scenario.steps) {
      const before = { consoleErrors: consoleErrors.length, netErrors: netErrors.length };
      let actionError = null;
      try {
        if (step.evalUrl) {
          await page.goto(step.evalUrl, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
          await page.waitForTimeout(800);
        }
        if (step.click) {
          const selectors = step.click.split(',').map((s) => s.trim());
          let clicked = false;
          for (const sel of selectors) {
            const loc = sel.startsWith('text=')
              ? page.getByText(sel.slice(5), { exact: false }).first()
              : page.locator(sel).first();
            if (await loc.count()) {
              await loc.click({ timeout: 4000 });
              clicked = true;
              break;
            }
          }
          if (!clicked) actionError = `NIE ZNALEZIONO: ${step.click}`;
          await page.waitForTimeout(500);
        }
        if (step.key) {
          await page.keyboard.press(step.key);
          await page.waitForTimeout(400);
        }
      } catch (e) {
        actionError = String(e).slice(0, 300);
      }

      const shotPath = `${OUTDIR}/${scenario.screen}--${step.name}.png`;
      await page.screenshot({ path: shotPath }).catch((e) => {
        actionError = (actionError ? actionError + ' | ' : '') + 'SCREENSHOT-BLAD: ' + String(e).slice(0, 200);
      });

      stepLog.push({
        step: step.name,
        actionError,
        newConsoleErrors: consoleErrors.slice(before.consoleErrors),
        newNetErrors: netErrors.slice(before.netErrors),
        screenshot: shotPath,
      });
    }

    report.push({ scenario: scenario.screen, url: scenario.url, steps: stepLog });
    await page.close();
  }

  await browser.close();
  console.log(JSON.stringify(report, null, 2));
})();
