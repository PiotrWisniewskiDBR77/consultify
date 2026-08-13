// FIXC — dead-space measurement for the three screens still over the 25%
// canon limit after the prior width fix (e36d275410): Prediction, Analysis,
// Valuation/Source step. Same method as scripts/dev/apmount-deadspace-measure.mjs
// (Playwright, bounding-box of painted content vs available canvas under the
// workspace bar), extended to run at BOTH 1280x800 and 1440x900. Fresh
// browser context per measurement (no localStorage bleed between runs).
import { chromium } from 'playwright';

const BASE = process.env.FIXC_BASE_URL || 'http://localhost:58123';

const VIEWPORTS = [
  { key: '1280', width: 1280, height: 800 },
  { key: '1440', width: 1440, height: 900 },
];

const screens = [
  { key: 'prediction', screen: 'finance-prediction-workspace', params: '&mode=C', contentSel: '[data-testid="prediction-assumptions-view"]' },
  { key: 'analysis', screen: 'finance-analysis-workspace', params: '&scene=draft-with-kpis', contentSel: '[data-testid="analysis-workspace"] .flex.min-h-0.flex-1' },
  { key: 'valuation-source', screen: 'finance-valuation-workspace', params: '&step=source', contentSel: '[data-testid="valuation-step-content"]' },
];

const browser = await chromium.launch();
const results = [];

for (const vp of VIEWPORTS) {
  for (const s of screens) {
    // Fresh context per measurement — localStorage does NOT carry over navigations within
    // this run (session memory: it silently poisoned evidence earlier this session).
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();
    const url = `${BASE}/?screen=${s.screen}&theme=light${s.params || ''}`;
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2000);

    const barBox = await page.locator('[data-testid="finance-workspace-bar"]').first().boundingBox();
    const barHeight = barBox ? barBox.height : 0;
    const availableHeight = vp.height - barHeight;
    const availableWidth = vp.width;

    const loc = page.locator(s.contentSel).first();
    const count = await loc.count();
    let box = null;
    if (count > 0) box = await loc.boundingBox();

    let innerBox = null;
    if (count > 0) {
      innerBox = await loc.evaluate((el) => {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        const all = el.querySelectorAll('*');
        let found = false;
        for (const node of all) {
          const r = node.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          if (node.children.length > 0) continue;
          found = true;
          minX = Math.min(minX, r.left);
          minY = Math.min(minY, r.top);
          maxX = Math.max(maxX, r.right);
          maxY = Math.max(maxY, r.bottom);
        }
        if (!found) return null;
        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
      });
    }

    const widthPct = box ? Math.round((box.width / availableWidth) * 1000) / 10 : 0;
    const heightPct = box ? Math.round((box.height / availableHeight) * 1000) / 10 : 0;
    const innerWidthPct = innerBox ? Math.round((innerBox.width / availableWidth) * 1000) / 10 : 0;
    const innerHeightPct = innerBox ? Math.round((innerBox.height / availableHeight) * 1000) / 10 : 0;
    // Area used = inner (actually-painted) width% * height% — same definition
    // apmount-deadspace-measure.mjs used for its "Obszar użyty" column.
    const areaUsedPct = innerBox ? Math.round(((innerBox.width * innerBox.height) / (availableWidth * availableHeight)) * 1000) / 10 : 0;

    const result = {
      viewport: vp.key,
      key: s.key,
      barHeight: Math.round(barHeight),
      availableWidth,
      availableHeight: Math.round(availableHeight),
      contentBox: box ? { w: Math.round(box.width), h: Math.round(box.height) } : null,
      contentWidthPct: widthPct,
      contentHeightPct: heightPct,
      innerContentBox: innerBox ? { w: Math.round(innerBox.width), h: Math.round(innerBox.height) } : null,
      innerWidthPct,
      innerHeightPct,
      areaUsedPct,
      deadSpacePct: Math.round((100 - areaUsedPct) * 10) / 10,
    };
    results.push(result);
    console.log(JSON.stringify(result));
    await context.close();
  }
}

await browser.close();
console.log('---SUMMARY---');
console.log(JSON.stringify(results, null, 0));
console.log('DONE');
