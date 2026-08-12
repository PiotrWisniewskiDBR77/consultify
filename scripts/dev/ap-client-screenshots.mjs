// Headless screenshot capture for AP-CLIENT (Gate J) evidence — five standalone
// components, light+dark. Runs against the already-running dev-render vite server
// on a fixed local port (see PKG_F's pkgf-baseline-screenshots.mjs for the same
// pattern/rationale: preview_start resolves launch.json against the orchestrator's
// cwd, not this worktree, so this script starts/points at its own server instead).
// Temporary tooling script for this package's report — not wired into CI/build.
import { chromium } from 'playwright';

const BASE = process.env.AP_CLIENT_BASE_URL || 'http://localhost:58045';
const OUT = '/Users/piotrwisniewski/consultify-wt/fv3p-j-security/docs/validation/finance-v3/generated/gate-e/visual/ap-client';

const shots = [
  { name: 'lineage-navigator-light.png', url: `${BASE}/?screen=finance-lineage-navigator&scene=default&theme=light`, wait: 1200 },
  { name: 'lineage-navigator-dark.png', url: `${BASE}/?screen=finance-lineage-navigator&scene=default&theme=dark`, wait: 1200 },
  { name: 'lineage-navigator-error-light.png', url: `${BASE}/?screen=finance-lineage-navigator&scene=error&theme=light`, wait: 1200 },
  { name: 'lineage-navigator-flag-off-light.png', url: `${BASE}/?screen=finance-lineage-navigator&scene=off&theme=light`, wait: 800 },

  { name: 'compare-panel-light.png', url: `${BASE}/?screen=finance-compare-panel&scene=default&theme=light`, wait: 1200 },
  { name: 'compare-panel-dark.png', url: `${BASE}/?screen=finance-compare-panel&scene=default&theme=dark`, wait: 1200 },

  { name: 'comments-panel-light.png', url: `${BASE}/?screen=finance-comments-panel&scene=default&theme=light`, wait: 1200 },
  { name: 'comments-panel-dark.png', url: `${BASE}/?screen=finance-comments-panel&scene=default&theme=dark`, wait: 1200 },

  { name: 'saved-views-panel-light.png', url: `${BASE}/?screen=finance-saved-views-panel&scene=default&theme=light`, wait: 1200 },
  { name: 'saved-views-panel-dark.png', url: `${BASE}/?screen=finance-saved-views-panel&scene=default&theme=dark`, wait: 1200 },

  { name: 'export-import-panel-light.png', url: `${BASE}/?screen=finance-export-import-panel&scene=default&theme=light`, wait: 1200 },
  { name: 'export-import-panel-dark.png', url: `${BASE}/?screen=finance-export-import-panel&scene=default&theme=dark`, wait: 1200 },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

for (const shot of shots) {
  console.log('navigating', shot.url);
  try {
    await page.goto(shot.url, { waitUntil: 'networkidle', timeout: 60000 });
  } catch (e) {
    console.error('NAV FAILED', shot.url, e.message);
    continue;
  }
  await page.waitForTimeout(shot.wait);
  const path = `${OUT}/${shot.name}`;
  await page.screenshot({ path, fullPage: true });
  console.log('saved', path);
}

await browser.close();
console.log('DONE');
