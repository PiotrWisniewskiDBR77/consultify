// Measures dead-space % at 1440x900 for the five AP_MOUNT workspaces.
// For each screen: find the main content region under the workspace bar,
// measure its bounding box vs the available canvas (viewport minus bar
// height), and report width%/height%/area% actually used.
import { chromium } from 'playwright';

const BASE = 'http://localhost:58234';
const VIEWPORT = { width: 1440, height: 900 };

const screens = [
  { key: 'prediction', screen: 'finance-prediction-workspace', params: '&mode=C', contentSel: '[data-testid="prediction-assumptions-view"]' },
  { key: 'baseline', screen: 'finance-baseline-workspace', params: '', contentSel: '[data-testid="baseline-workspace"] .flex-1.flex-col.overflow-hidden' },
  { key: 'analysis', screen: 'finance-analysis-workspace', params: '&scene=draft-with-kpis', contentSel: '[data-testid="analysis-workspace"] .flex.min-h-0.flex-1' },
  { key: 'valuation', screen: 'finance-valuation-workspace', params: '', contentSel: '[data-testid="valuation-step-content"]' },
  { key: 'statement-pack-v2', screen: 'finance-statement-pack-workspace-v2', params: '', contentSel: '[data-testid="statement-pack-workspace-v2"]' },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: VIEWPORT });

for (const s of screens) {
  const url = `${BASE}/?screen=${s.screen}&theme=light${s.params || ''}`;
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(2000);

  const barBox = await page.locator('[data-testid="finance-workspace-bar"]').first().boundingBox();
  const barHeight = barBox ? barBox.height : 0;
  const availableHeight = VIEWPORT.height - barHeight;
  const availableWidth = VIEWPORT.width;

  const loc = page.locator(s.contentSel).first();
  const count = await loc.count();
  let box = null;
  if (count > 0) box = await loc.boundingBox();

  // Also measure the innermost "real content" bbox (union of visible text/table nodes)
  // via the bounding box of the first non-empty child, to see how much of the
  // content-region itself is actually painted vs just present-but-empty.
  let innerBox = null;
  if (count > 0) {
    innerBox = await loc.evaluate((el) => {
      // Find the tightest bounding box of all element children with visible content.
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      const all = el.querySelectorAll('*');
      let found = false;
      for (const node of all) {
        const r = node.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (node.children.length > 0) continue; // leaf-ish nodes only, avoid double counting wrappers
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

  console.log(JSON.stringify({
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
  }, null, 0));
}

await browser.close();
