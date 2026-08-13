// Headless screenshot capture for ID_BRIDGE (Gate E) evidence.
// Runs against the already-running dev-render vite server on :58040.
// Temporary tooling script for this package's report — not wired into any
// CI/build; safe to remove after the report is finalized.
import { chromium } from 'playwright';

const BASE = 'http://localhost:58040';
const OUT =
  '/Users/piotrwisniewski/consultify-wt/fv3p-l-goldco/docs/validation/finance-v3/generated/gate-e/visual/id-bridge';

const shots = [
  // ── Prediction ANTY-CICHA-PUSTKA (most important — task brief priority) ──
  { name: 'prediction-bridge-ok-light.png', url: `${BASE}/?screen=finance-prediction-workspace&bridge=ok`, theme: 'light', wait: 1800 },
  { name: 'prediction-bridge-ok-dark.png', url: `${BASE}/?screen=finance-prediction-workspace&bridge=ok&theme=dark`, theme: 'dark', wait: 1800 },
  { name: 'prediction-bridge-missing-light.png', url: `${BASE}/?screen=finance-prediction-workspace&bridge=missing`, theme: 'light', wait: 1200 },
  { name: 'prediction-bridge-missing-dark.png', url: `${BASE}/?screen=finance-prediction-workspace&bridge=missing&theme=dark`, theme: 'dark', wait: 1200 },
  { name: 'prediction-bridge-notfound-light.png', url: `${BASE}/?screen=finance-prediction-workspace&bridge=notfound`, theme: 'light', wait: 1800 },
  { name: 'prediction-bridge-notfound-dark.png', url: `${BASE}/?screen=finance-prediction-workspace&bridge=notfound&theme=dark`, theme: 'dark', wait: 1800 },
  { name: 'prediction-bridge-error-light.png', url: `${BASE}/?screen=finance-prediction-workspace&bridge=error`, theme: 'light', wait: 1800 },
  { name: 'prediction-bridge-error-dark.png', url: `${BASE}/?screen=finance-prediction-workspace&bridge=error&theme=dark`, theme: 'dark', wait: 1800 },

  // ── FinanceLegacyBridgeGate — the FinanceHub-level mount gate, one representative kind each ──
  { name: 'gate-baseline-resolved-light.png', url: `${BASE}/?screen=finance-id-bridge&kind=baseline&state=resolved`, theme: 'light', wait: 1500 },
  { name: 'gate-baseline-resolved-dark.png', url: `${BASE}/?screen=finance-id-bridge&kind=baseline&state=resolved&theme=dark`, theme: 'dark', wait: 1500 },
  { name: 'gate-baseline-missing-light.png', url: `${BASE}/?screen=finance-id-bridge&kind=baseline&state=missing`, theme: 'light', wait: 1200 },
  { name: 'gate-baseline-missing-dark.png', url: `${BASE}/?screen=finance-id-bridge&kind=baseline&state=missing&theme=dark`, theme: 'dark', wait: 1200 },
  { name: 'gate-baseline-quarantined-light.png', url: `${BASE}/?screen=finance-id-bridge&kind=baseline&state=quarantined`, theme: 'light', wait: 1200 },
  { name: 'gate-baseline-error-light.png', url: `${BASE}/?screen=finance-id-bridge&kind=baseline&state=error`, theme: 'light', wait: 1200 },
  { name: 'gate-prediction-resolved-light.png', url: `${BASE}/?screen=finance-id-bridge&kind=prediction&state=resolved`, theme: 'light', wait: 1500 },
  { name: 'gate-analysis-resolved-light.png', url: `${BASE}/?screen=finance-id-bridge&kind=analysis&state=resolved`, theme: 'light', wait: 1500 },
  { name: 'gate-valuation-resolved-light.png', url: `${BASE}/?screen=finance-id-bridge&kind=valuation&state=resolved`, theme: 'light', wait: 1500 },
];

const browser = await chromium.launch();

for (const shot of shots) {
  // Fresh browser CONTEXT per shot (not just a fresh page) — localStorage is
  // per-context, and this harness's feature-flag override + PanelUwag both
  // persist to localStorage; a fresh context prevents an ON state leaking
  // into a screenshot labeled OFF (known pitfall, see task brief).
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: shot.theme === 'dark' ? 'dark' : 'light',
  });
  const page = await context.newPage();
  console.log('navigating', shot.url);
  await page.goto(shot.url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(shot.wait);
  const path = `${OUT}/${shot.name}`;
  await page.screenshot({ path, fullPage: false });
  console.log('saved', path);
  await context.close();
}

await browser.close();
console.log('DONE');
