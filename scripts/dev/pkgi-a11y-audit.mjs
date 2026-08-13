// Pakiet I (Dostępność) — axe-core scan + zrzuty (zoom 200%, focus) dla
// pięciu workspace'ów Finance + pięciu komponentów AP-CLIENT.
// Uruchamiane przeciw JUŻ URUCHOMIONEMU dev-render na :58023.
// Temporary tooling script for this package's report — not wired into any
// CI/build; safe to remove after the report is finalized.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const AXE_SRC = fs.readFileSync(path.join(REPO_ROOT, 'node_modules/axe-core/axe.min.js'), 'utf8');

const BASE = 'http://localhost:58023';
const VISUAL_OUT = path.join(REPO_ROOT, 'docs/validation/finance-v3/generated/gate-e/visual/pkg-i');
const AXE_OUT = path.join(REPO_ROOT, 'docs/validation/finance-v3/generated/gate-e/pkg-i-axe');

const SCREENS = [
  // Pięć workspace'ów (flaga workspace'u samego ON — czytana z localStorage przez sam ekran dev-render).
  { id: 'baseline', url: `${BASE}/?screen=finance-baseline-workspace&view=assumptions&scene=default`, shot: true },
  { id: 'statement-pack-v2', url: `${BASE}/?screen=finance-statement-pack-workspace-v2&state=populated`, shot: true },
  { id: 'prediction', url: `${BASE}/?screen=finance-prediction-workspace&mode=A&view=assumptions`, shot: true },
  { id: 'analysis', url: `${BASE}/?screen=finance-analysis-workspace&scene=draft-with-kpis`, shot: true },
  { id: 'valuation', url: `${BASE}/?screen=finance-valuation-workspace&step=source`, shot: true },
  // Pięć komponentów AP-CLIENT.
  { id: 'lineage-navigator', url: `${BASE}/?screen=finance-lineage-navigator&scene=default`, shot: true },
  { id: 'compare-panel', url: `${BASE}/?screen=finance-compare-panel&scene=default`, shot: true },
  { id: 'comments-panel', url: `${BASE}/?screen=finance-comments-panel&scene=default`, shot: true },
  { id: 'saved-views-panel', url: `${BASE}/?screen=finance-saved-views-panel&scene=default`, shot: true },
  { id: 'export-import-panel', url: `${BASE}/?screen=finance-export-import-panel&scene=default`, shot: true },
];

async function runAxeOn(page) {
  await page.evaluate(AXE_SRC);
  const result = await page.evaluate(async () => {
    // eslint-disable-next-line no-undef
    return await axe.run(document, {
      resultTypes: ['violations', 'incomplete'],
    });
  });
  return result;
}

async function main() {
  const browser = await chromium.launch();
  const summary = [];

  for (const screen of SCREENS) {
    // Fresh context per screen — localStorage feature-flag overrides must not leak between screens.
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    console.log('navigating', screen.id, screen.url);
    await page.goto(screen.url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2000);

    let axeResult;
    try {
      axeResult = await runAxeOn(page);
    } catch (err) {
      axeResult = { error: String(err) };
    }
    const violations = (axeResult.violations || []).map((v) => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      help: v.help,
      helpUrl: v.helpUrl,
      nodeCount: v.nodes.length,
      nodes: v.nodes.slice(0, 8).map((n) => ({
        target: n.target,
        html: n.html,
        failureSummary: n.failureSummary,
      })),
    }));
    const incomplete = (axeResult.incomplete || []).map((v) => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      nodeCount: v.nodes.length,
      nodes: v.nodes.slice(0, 6).map((n) => ({ target: n.target, html: n.html, failureSummary: n.failureSummary })),
    }));

    fs.writeFileSync(
      path.join(AXE_OUT, `${screen.id}.json`),
      JSON.stringify({ id: screen.id, url: screen.url, violations, incomplete }, null, 2)
    );
    summary.push({ id: screen.id, violationCount: violations.length, incompleteCount: incomplete.length, violationIds: violations.map((v) => v.id) });
    console.log(`  axe: ${violations.length} violations, ${incomplete.length} incomplete`);

    if (screen.shot) {
      await page.screenshot({ path: path.join(VISUAL_OUT, `${screen.id}-1280-light.png`), fullPage: false });

      // Zoom 200% at 1280px — najciaśniejszy realistyczny przypadek (brief §8).
      await page.evaluate(() => {
        document.documentElement.style.zoom = '200%';
      });
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(VISUAL_OUT, `${screen.id}-zoom200-1280-light.png`), fullPage: false });
      await page.evaluate(() => {
        document.documentElement.style.zoom = '100%';
      });
    }

    await context.close();
  }

  fs.writeFileSync(path.join(AXE_OUT, '_summary.json'), JSON.stringify(summary, null, 2));
  console.log('\n=== SUMMARY ===');
  for (const s of summary) {
    console.log(`${s.id}: ${s.violationCount} violations [${s.violationIds.join(', ')}]`);
  }

  await browser.close();
  console.log('DONE');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
