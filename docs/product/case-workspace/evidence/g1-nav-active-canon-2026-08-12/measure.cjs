/**
 * G1 BottomNavigation ACTIVE-item canon fix — reproducible measurement.
 *
 * Scope: packet G1 (2026-08-12), the ACTIVE item + its indicator bar + the
 * inactive items' :active (touch-press) state. The INACTIVE resting state was
 * already fixed/measured in packet F2 (docs/product/case-workspace/evidence/
 * f2-bottomnav-contrast-2026-08-12/) and is reproduced here unmodified for
 * composed-background parity only — not re-litigated.
 *
 * Renders the EXACT markup/classes (fixture.html, before/after) with the
 * project's REAL compiled Tailwind CSS (compiled.css — see build.sh, built
 * from the real tailwind.config.js + src/index.css), then for each width x
 * theme x variant:
 *
 *  1. ACTIVE item label: foreground via getComputedStyle vs. composed
 *     background (real screenshot pixel sample, captures bg-white/95 or
 *     bg-navy-900/95 + backdrop-blur-xl as actually painted) -> WCAG text
 *     contrast ratio (AA floor 4.5:1).
 *  2. ACTIVE indicator bar (top pill, non-text UI component that conveys
 *     "this is the selected tab"): sampled bar-fill pixel vs. an adjacent
 *     composed-background pixel just outside the bar -> WCAG non-text
 *     contrast ratio (WCAG 1.4.11 floor 3:1).
 *  3. INACTIVE items' resting label (parity re-check, unchanged since F2).
 *  4. INACTIVE items' :active (touch-press) label: same measurement, but
 *     triggered via a real mouse press (page.mouse.down over the button) so
 *     the :active pseudo-class is genuinely engaged, not guessed.
 *  5. axe-core color-contrast, independent confirmation.
 *
 * Usage (from this directory):
 *   ./build.sh                          # compiles compiled.css + installs local axe-core
 *   node measure.cjs                    # writes results.json
 *   node screenshot.cjs                 # writes nav-<theme>-<variant>.png
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

function samplePixel(png, x, y) {
  const localX = Math.min(png.width - 1, Math.max(0, Math.round(x)));
  const localY = Math.min(png.height - 1, Math.max(0, Math.round(y)));
  const idx = (png.width * localY + localX) << 2;
  return [png.data[idx], png.data[idx + 1], png.data[idx + 2]];
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

        await page.evaluate((v) => {
          document.getElementById('before').style.display = v === 'before' ? '' : 'none';
          document.getElementById('after').style.display = v === 'after' ? '' : 'none';
        }, variant);

        // transition-all duration-200 on buttons: let the theme-toggle transition settle
        // before sampling anything (same correctness note as packet F2's measure.cjs —
        // verified there that the first-sampled item can land ~8% off mid-interpolation).
        await page.waitForTimeout(350);

        const navId = variant;

        for (const testid of ITEMS) {
          const btnSel = `#${navId} [data-testid="${testid}"]`;
          const btn = page.locator(btnSel);
          const label = page.locator(`${btnSel} [data-role="label"]`);

          const active = await btn.getAttribute('aria-current');
          const isActive = active === 'page';

          const box = await btn.boundingBox();
          if (!box) {
            results.push({
              width,
              theme,
              variant,
              testid,
              note: 'nav not rendered at this width (md:hidden, by design — component is mobile-only)',
            });
            continue;
          }

          // ---- 1) resting-state label contrast (active item's real color, or
          //         inactive item's resting/untouched color) ----
          const fgColor = await label.evaluate((el) => getComputedStyle(el).color);
          const fgRgb = parseRgb(fgColor);
          let shot = await page.screenshot({ clip: { x: box.x, y: box.y, width: box.width, height: box.height } });
          let png = PNG.sync.read(shot);
          const bgRgb = samplePixel(png, 4, png.height / 2);
          const ratio = contrastRatio(fgRgb, bgRgb);

          results.push({
            width,
            theme,
            variant,
            testid,
            state: isActive ? 'active-resting' : 'inactive-resting',
            isActive,
            fgColor: `rgb(${fgRgb.join(',')})`,
            bgColorComposed: `rgb(${bgRgb.join(',')})`,
            contrastRatio: Math.round(ratio * 100) / 100,
            passesAA: ratio >= 4.5,
          });

          // ---- 2) ACTIVE item only: indicator bar non-text contrast (WCAG 1.4.11,
          //         floor 3:1) — bar-fill pixel vs. an adjacent composed-bg pixel just
          //         outside the bar (same button screenshot, no re-shoot needed) ----
          if (isActive) {
            const indicator = page.locator(`${btnSel} [data-role="indicator"]`);
            const ibox = await indicator.boundingBox();
            if (ibox) {
              // Sample bar center (relative to the button screenshot already taken).
              const barLocalX = ibox.x + ibox.width / 2 - box.x;
              const barLocalY = ibox.y + ibox.height / 2 - box.y;
              const barRgb = samplePixel(png, barLocalX, barLocalY);
              // Adjacent background: a few px to the side of the bar, same row —
              // still inside the button, outside the bar's horizontal extent.
              const bgLocalX = Math.min(png.width - 1, ibox.x - box.x + ibox.width + 6);
              const bgLocalY = barLocalY;
              const barBgRgb = samplePixel(png, bgLocalX, bgLocalY);
              const barRatio = contrastRatio(barRgb, barBgRgb);
              results.push({
                width,
                theme,
                variant,
                testid,
                state: 'active-indicator-bar',
                isActive: true,
                fgColor: `rgb(${barRgb.join(',')})`,
                bgColorComposed: `rgb(${barBgRgb.join(',')})`,
                contrastRatio: Math.round(barRatio * 100) / 100,
                passesNonText3to1: barRatio >= 3,
              });
            }
          }

          // ---- 3) INACTIVE items only: real :active (touch-press) state, engaged via
          //         a genuine mouse press (not guessed/typed) ----
          if (!isActive) {
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
            await page.mouse.down();
            // Buttons carry transition-all duration-200; :active engages the CSS rule
            // immediately but the *color* animates. 50ms sampled mid-interpolation
            // (verified live: rgb(81,75,96), neither the resting nor the pressed
            // color) — wait a full 350ms for parity with the theme-toggle wait above.
            await page.waitForTimeout(350);
            const pressFg = await label.evaluate((el) => getComputedStyle(el).color);
            const pressFgRgb = parseRgb(pressFg);
            const pressShot = await page.screenshot({ clip: { x: box.x, y: box.y, width: box.width, height: box.height } });
            const pressPng = PNG.sync.read(pressShot);
            const pressBgRgb = samplePixel(pressPng, 4, pressPng.height / 2);
            const pressRatio = contrastRatio(pressFgRgb, pressBgRgb);
            await page.mouse.up();

            results.push({
              width,
              theme,
              variant,
              testid,
              state: 'inactive-active-press',
              isActive: false,
              fgColor: `rgb(${pressFgRgb.join(',')})`,
              bgColorComposed: `rgb(${pressBgRgb.join(',')})`,
              contrastRatio: Math.round(pressRatio * 100) / 100,
              passesAA: pressRatio >= 4.5,
            });
          }
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
