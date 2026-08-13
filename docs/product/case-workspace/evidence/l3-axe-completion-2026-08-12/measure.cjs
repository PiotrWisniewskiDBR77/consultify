/**
 * L3 — standalone cross-check of the 3 elements named in Gap 1: the
 * org-avatar chip ("CW") and the two right-panel buttons ("Wczytaj
 * ponownie" / "Wróć do listy zleceń"). Backend-independent (fixture.html),
 * so it stays reproducible even if the shared dev backend goes down again.
 *
 * Method (same lineage as f2-bottomnav-contrast-2026-08-12/measure.cjs):
 *   1. Read the foreground via getComputedStyle('color') (exact declared
 *      value, correct WCAG input).
 *   2. Read the COMPOSED background by screenshotting the real rendered
 *      pixel just outside the glyph (captures the actual alpha-composite of
 *      the translucent button bg over the opaque panel bg — not a token
 *      read in isolation).
 *   3. Compute WCAG contrast ratio.
 *   4. Run axe-core color-contrast on the live DOM as independent
 *      confirmation.
 *
 * Usage: ./build.sh && node measure.cjs
 */
const path = require('path');
const fs = require('fs');

const REPO_ROOT = path.join(__dirname, '../../../../..');
const { chromium } = require(path.join(REPO_ROOT, 'node_modules/playwright'));
const { PNG } = require(path.join(REPO_ROOT, 'node_modules/pngjs'));

const AXE_PATH = path.join(__dirname, 'node_modules/axe-core/axe.min.js');
const FIXTURE_URL = 'file://' + path.join(__dirname, 'fixture.html');

const THEMES = ['light', 'dark'];
const TARGETS = [
  { id: 'avatar-chip', label: 'org-avatar chip (CW)' },
  { id: 'btn-reload', label: 'Wczytaj ponownie' },
  { id: 'btn-back', label: 'Wróć do listy zleceń' },
];

function srgbToLinear(c) {
  c = c / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function relLuminance([r, g, b]) {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}
function contrastRatio(rgbA, rgbB) {
  const L1 = relLuminance(rgbA);
  const L2 = relLuminance(rgbB);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}
function parseRgb(str) {
  const m = str.match(/rgba?\(([^)]+)\)/);
  if (!m) throw new Error('cannot parse color: ' + str);
  const parts = m[1].split(',').map((s) => parseFloat(s.trim()));
  return [parts[0], parts[1], parts[2]];
}

async function run() {
  const browser = await chromium.launch();
  const results = [];
  const axeSource = fs.readFileSync(AXE_PATH, 'utf8');

  for (const theme of THEMES) {
    const page = await browser.newPage({ viewport: { width: 1024, height: 800 } });
    await page.goto(FIXTURE_URL);
    if (theme === 'dark') {
      await page.evaluate(() => document.documentElement.classList.add('dark'));
    }
    await page.waitForTimeout(150);

    for (const t of TARGETS) {
      const el = page.locator('#' + t.id);
      const fgColor = await el.evaluate((e) => getComputedStyle(e).color);
      const fgRgb = parseRgb(fgColor);

      const box = await el.boundingBox();
      const shot = await page.screenshot({ clip: box });
      const png = PNG.sync.read(shot);
      // Sample a corner pixel of the element's own box, away from the glyph.
      const localX = 2;
      const localY = 2;
      const idx = (png.width * localY + localX) << 2;
      const bgRgb = [png.data[idx], png.data[idx + 1], png.data[idx + 2]];

      const ratio = contrastRatio(fgRgb, bgRgb);
      const requiredRatio = 4.5; // all 3 targets are text, AA floor

      results.push({
        theme,
        target: t.id,
        label: t.label,
        fgColor: `rgb(${fgRgb.join(',')})`,
        bgColorComposed: `rgb(${bgRgb.join(',')})`,
        contrastRatio: Math.round(ratio * 100) / 100,
        passesAA: ratio >= requiredRatio,
      });
    }

    // axe-core color-contrast over the whole fixture for this theme.
    await page.addScriptTag({ content: axeSource });
    const axeResult = await page.evaluate(async () => {
      // eslint-disable-next-line no-undef
      return await axe.run(document.body, { runOnly: { type: 'rule', values: ['color-contrast'] } });
    });
    results.push({
      theme,
      axe: {
        violations: axeResult.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
        })),
        passesCount: axeResult.passes.reduce((n, p) => n + p.nodes.length, 0),
      },
    });

    await page.close();
  }

  await browser.close();
  return results;
}

run()
  .then((results) => {
    fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 2));
    console.log('\nWrote', results.length, 'result rows to results.json');
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
