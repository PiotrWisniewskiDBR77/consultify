/**
 * F2 BottomNavigation contrast — reproducible measurement.
 *
 * Renders the EXACT markup/classes from BottomNavigation.tsx (fixture.html) with the
 * project's REAL compiled Tailwind CSS (compiled.css — see build.sh, built from the
 * real tailwind.config.js + src/index.css, same token pipeline the app ships), then:
 *
 *  1. Reads the foreground text color via getComputedStyle (exact CSS value — the
 *     correct WCAG input, not an anti-aliased pixel).
 *  2. Reads the COMPOSED background by sampling a real rendered pixel next to the text
 *     (captures bg-white/95 or bg-navy-900/95 + backdrop-blur-xl actually painted over
 *     whatever sits behind the fixed nav — not a token read in isolation).
 *  3. Computes the WCAG contrast ratio from those two colors.
 *  4. Runs axe-core 4.10.2 color-contrast check against the live DOM for a second,
 *     independent confirmation.
 *
 * Usage (from this directory):
 *   ./build.sh                          # compiles compiled.css + installs local axe-core
 *   node measure.cjs                    # writes results.json
 *   node screenshot.cjs                 # writes nav-<theme>-<variant>.png
 *
 * Requires: playwright + pngjs (resolved from the project's node_modules — already a
 * dependency of this repo) and axe-core@4.10.2 (installed locally by build.sh, not a
 * project dependency, so it never touches the shared package.json/lockfile).
 */
const path = require('path');
const fs = require('fs');

const REPO_ROOT = path.join(__dirname, '../../../../..');
const { chromium } = require(path.join(REPO_ROOT, 'node_modules/playwright'));
const { PNG } = require(path.join(REPO_ROOT, 'node_modules/pngjs'));

const AXE_PATH = path.join(__dirname, 'node_modules/axe-core/axe.min.js');
const FIXTURE_URL = 'file://' + path.join(__dirname, 'fixture.html');

const WIDTHS = [320, 375, 430, 768];
const THEMES = ['light', 'dark'];
const VARIANTS = ['before', 'after'];
const ITEMS = ['bottom-nav-mywork', 'bottom-nav-assessment', 'bottom-nav-initiatives', 'bottom-nav-ai', 'bottom-nav-more'];

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

  for (const width of WIDTHS) {
    for (const theme of THEMES) {
      for (const variant of VARIANTS) {
        const page = await browser.newPage({ viewport: { width, height: 900 } });
        await page.goto(FIXTURE_URL);

        if (theme === 'dark') {
          await page.evaluate(() => document.documentElement.classList.add('dark'));
        }

        // Show only the nav under test.
        await page.evaluate((v) => {
          document.getElementById('before').style.display = v === 'before' ? '' : 'none';
          document.getElementById('after').style.display = v === 'after' ? '' : 'none';
        }, variant);

        // Buttons carry `transition-all duration-200`, so toggling the `dark` class just
        // above kicks off a 200ms color transition. Let it fully settle before sampling —
        // otherwise the first-measured item can be caught mid-interpolation (verified: an
        // earlier run without this wait showed the first button ~8% off the other, later-
        // measured buttons that share the exact same class list).
        await page.waitForTimeout(350);

        const navId = variant; // 'before' | 'after'

        for (const testid of ITEMS) {
          const btnSel = `#${navId} [data-testid="${testid}"]`;
          const btn = page.locator(btnSel);
          const label = page.locator(`${btnSel} [data-role="label"]`);

          const active = await btn.getAttribute('aria-current');
          const isActive = active === 'page';

          // 1) Exact declared foreground color (WCAG-correct input; not AA pixel noise).
          const fgColor = await label.evaluate((el) => getComputedStyle(el).color);
          const fgRgb = parseRgb(fgColor);

          // 2) Composed background: screenshot the actual painted pixels and sample a
          //    point inside the button but off any glyph/icon, i.e. real backdrop-blur +
          //    opacity composite as rendered, not a CSS token read in isolation.
          const box = await btn.boundingBox();
          if (!box) {
            // BottomNavigation is `md:hidden` — by design it does not render at all at
            // width >= 768 (the `md` breakpoint). Record that explicitly instead of a crash.
            results.push({
              width,
              theme,
              variant,
              testid,
              note: 'nav not rendered at this width (md:hidden, by design — component is mobile-only)',
            });
            continue;
          }
          const shot = await page.screenshot({ clip: { x: box.x, y: box.y, width: box.width, height: box.height } });
          const png = PNG.sync.read(shot);
          // Sample near the left edge, vertically centered: icon+label are horizontally
          // centered (narrow glyphs), the active indicator bar (w-8, ~32px, centered) does
          // not reach this far out, and the nav's top hairline border is well above this y.
          const localX = Math.min(png.width - 1, 4);
          const localY = Math.min(png.height - 1, Math.max(0, Math.round(png.height / 2)));
          const idx = (png.width * localY + localX) << 2;
          const bgRgb = [png.data[idx], png.data[idx + 1], png.data[idx + 2]];

          const ratio = contrastRatio(fgRgb, bgRgb);

          results.push({
            width,
            theme,
            variant,
            testid,
            isActive,
            fgColor: `rgb(${fgRgb.join(',')})`,
            bgColorComposed: `rgb(${bgRgb.join(',')})`,
            contrastRatio: Math.round(ratio * 100) / 100,
            passesAA: ratio >= 4.5,
          });
        }

        // axe-core pass on the visible nav only.
        await page.addScriptTag({ content: axeSource });
        const axeResult = await page.evaluate(async (navId) => {
          // eslint-disable-next-line no-undef
          return await axe.run(document.getElementById(navId), {
            runOnly: { type: 'rule', values: ['color-contrast'] },
          });
        }, navId);

        results.push({
          width,
          theme,
          variant,
          axe: {
            violations: axeResult.violations.map((v) => ({
              id: v.id,
              impact: v.impact,
              nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
            })),
            passes: axeResult.passes.map((p) => p.id),
          },
        });

        await page.close();
      }
    }
  }

  await browser.close();
  return results;
}

run()
  .then((results) => {
    fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify(results, null, 2));
    console.log('Wrote', results.length, 'result rows to results.json');
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
