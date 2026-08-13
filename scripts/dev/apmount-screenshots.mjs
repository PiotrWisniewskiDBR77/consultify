// Headless screenshot capture for AP_MOUNT evidence (Prediction/Baseline/
// Analysis/Valuation/StatementPackWorkspaceV2 — light + dark). Runs against
// the dedicated dev-render vite server started for THIS worktree on
// :58234 (fv3p-l-goldco has no launch.json entry of its own, and
// preview_start resolves launch.json relative to the ORCHESTRATOR's
// directory, not this worktree — see AP_MOUNT_report.md §screenshots).
// Temporary tooling script for this report — not wired into any CI/build.
import { chromium } from 'playwright';

const BASE = 'http://localhost:58234';
const OUT = '/Users/piotrwisniewski/consultify-wt/fv3p-l-goldco/docs/validation/finance-v3/generated/gate-e/visual/ap-mount';

const screens = [
  // &mode=C: richer, already-existing demo data (initiative+impact), not fabricated —
  // mode A (Base/passthrough) is structurally empty by design, see AP_MOUNT_report.md
  // dead-space measurement section.
  { key: 'prediction', screen: 'finance-prediction-workspace', params: '&mode=C' },
  { key: 'baseline', screen: 'finance-baseline-workspace', params: '' },
  // &scene=draft-with-kpis: real KPI rows already defined in the harness (not fabricated).
  { key: 'analysis', screen: 'finance-analysis-workspace', params: '&scene=draft-with-kpis' },
  { key: 'valuation', screen: 'finance-valuation-workspace', params: '' },
  { key: 'statement-pack-v2', screen: 'finance-statement-pack-workspace-v2', params: '' },
];

const themes = ['light', 'dark'];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

for (const s of screens) {
  for (const theme of themes) {
    const url = `${BASE}/?screen=${s.screen}&theme=${theme}${s.params || ''}`;
    console.log('navigating', url);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2500);
    const path = `${OUT}/${s.key}-${theme}.png`;
    await page.screenshot({ path, fullPage: false });
    console.log('saved', path);
  }
}

await browser.close();
console.log('DONE');
