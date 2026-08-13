// Headless screenshot capture for PKG_G Prediction — INDEPENDENT VERIFIER evidence.
// Runs against the already-running dev-render vite server on :58028 (this worktree's own
// .claude/launch.json entry, started manually via `npx vite --config dev-render/vite.config.ts
// --port 58028 --strictPort` because the Claude_Browser MCP's preview_start resolves launch.json
// against the ORIGINATING session's directory, not this worktree — the exact infra problem the
// verification brief (claim 12) asked to diagnose. Passing a bare `url` to preview_start sidesteps
// the launch.json lookup entirely for browsing, but does not persist PNGs to disk — hence this
// script, mirroring PKG-F's `scripts/dev/pkgf-baseline-screenshots.mjs` pattern exactly.
// Temporary tooling script for this report only — not wired into any CI/build; safe to remove
// after the report is finalized.
import { chromium } from 'playwright';

const BASE = 'http://localhost:58028';
const OUT = '/Users/piotrwisniewski/consultify-wt/fv3p-g-prediction/docs/validation/finance-v3/generated/gate-e/visual/pkg-g';

// FINDING (independent verifier): the harness's own doc comment
// (`dev-render/screens/finance-prediction-workspace.tsx:13`) advertises `&view=assumptions|results`,
// but the screen file never actually reads a `view` query param (`grep -n "view\b"` on that file
// matches ONLY the doc comment) — `PredictionWorkspace`'s `activeViewId` always initializes to
// `assumptions` (`PredictionWorkspace.tsx:37`) regardless of the URL. Reaching the Modele/Wyniki
// view therefore requires a real click on the tab, same as an actual user would do — which is also
// a stronger proof than a URL param would be (proves the tab is genuinely clickable, not just that
// a different initial prop renders different JSX).
const shots = [
  { name: 'assumptions-mode-C-light.png', url: `${BASE}/?screen=finance-prediction-workspace&mode=C&theme=light`, wait: 3000 },
  { name: 'results-mode-C-light.png', url: `${BASE}/?screen=finance-prediction-workspace&mode=C&theme=light`, wait: 3000, clickTab: 'Modele/Wyniki' },
  { name: 'assumptions-mode-B-light.png', url: `${BASE}/?screen=finance-prediction-workspace&mode=B&theme=light`, wait: 3000 },
  { name: 'assumptions-mode-A-light.png', url: `${BASE}/?screen=finance-prediction-workspace&mode=A&theme=light`, wait: 3000 },
  { name: 'assumptions-mode-C-dark.png', url: `${BASE}/?screen=finance-prediction-workspace&mode=C&theme=dark`, wait: 3000 },
  { name: 'results-mode-C-dark.png', url: `${BASE}/?screen=finance-prediction-workspace&mode=C&theme=dark`, wait: 3000, clickTab: 'Modele/Wyniki' },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

for (const shot of shots) {
  console.log('navigating', shot.url);
  await page.goto(shot.url, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(shot.wait);
  if (shot.clickTab) {
    console.log('clicking tab', shot.clickTab);
    await page.locator(`button:has-text("${shot.clickTab}")`).first().click();
    await page.waitForTimeout(1500);
  }
  const path = `${OUT}/${shot.name}`;
  await page.screenshot({ path, fullPage: false });
  console.log('saved', path);
}

await browser.close();
console.log('DONE');
