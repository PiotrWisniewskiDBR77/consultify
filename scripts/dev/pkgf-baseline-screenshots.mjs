// Headless screenshot capture for PKG_F Baseline evidence (przed/po).
// Runs against the already-running dev-render vite server on :58023.
// Temporary tooling script for this package's report — not wired into any
// CI/build; safe to remove after the report is finalized.
import { chromium } from 'playwright';

const BASE = 'http://localhost:58023';
const OUT = '/Users/piotrwisniewski/consultify-wt/fv3p-f-baseline/docs/validation/finance-v3/generated/gate-e/visual/pkg-f';

const shots = [
  { name: 'PRZED-finance-model-workspace-draft.png', url: `${BASE}/?screen=finance-model-workspace&status=draft`, wait: 2500 },
  { name: 'PO-baseline-workspace-assumptions.png', url: `${BASE}/?screen=finance-baseline-workspace&view=assumptions&scene=default`, wait: 2500 },
  { name: 'PO-baseline-workspace-wyliczenia.png', url: `${BASE}/?screen=finance-baseline-workspace&view=wyliczenia&scene=default`, wait: 2500 },
  {
    name: 'PO-baseline-workspace-fundinggap-alarm.png',
    url: `${BASE}/?screen=finance-baseline-workspace&view=wyliczenia&scene=fundinggap`,
    wait: 2500,
    // Alarm luki finansowania jest sterowany przez `compute.result` (POST
    // .../compute), NIE przez `outputsHook.outputs` (GET .../outputs) —
    // trzeba realnie kliknąć "Przelicz", żeby zobaczyć baner, nie tylko
    // wartości w tabeli (te już są ujemne z samego GET outputs).
    click: 'button:has-text("Przelicz")',
  },
  { name: 'PO-baseline-workspace-approved.png', url: `${BASE}/?screen=finance-baseline-workspace&view=wyliczenia&scene=default&status=APPROVED`, wait: 2500 },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

for (const shot of shots) {
  console.log('navigating', shot.url);
  await page.goto(shot.url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(shot.wait);
  if (shot.click) {
    console.log('clicking', shot.click);
    await page.locator(shot.click).first().click();
    await page.waitForTimeout(1500);
  }
  const path = `${OUT}/${shot.name}`;
  await page.screenshot({ path, fullPage: false });
  console.log('saved', path);
}

await browser.close();
console.log('DONE');
