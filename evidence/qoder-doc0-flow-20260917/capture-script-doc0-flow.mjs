// DOC-0 etap 1 (b) (DEC-593) evidence capture — TEMPORARY tooling script, not
// wired into CI. Screenshots the REAL open-flow (list -> open -> ONE
// DocumentViewer) from the dev-render harness (port 5421, pool C) at 1440x900,
// EN, light + dark. `case=list` is the registry table before the click;
// `case=open` drives the SAME production `openRow` fork via a real dblclick on
// the approved row's <tr> (FilterableTable onDoubleClick -> openRow -> viewer
// overlay). Contrast is measured PIXEL-WISE from the raw capture (pngjs) BEFORE
// the palette quantization that keeps the PNG under the 200 KB limit (sharp).
import fs from 'node:fs';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import sharp from 'sharp';

const BASE = 'http://127.0.0.1:5421/doc0-document-flow.html';
const OUT = '/Users/piotrwisniewski/Developer/qoder-wt/consultify-c/evidence/qoder-doc0-flow-20260917';

const shots = [
  { key: 'doc0-flow-list-en-light', theme: 'light', kase: 'list' },
  { key: 'doc0-flow-list-en-dark', theme: 'dark', kase: 'list' },
  { key: 'doc0-flow-open-en-light', theme: 'light', kase: 'open' },
  { key: 'doc0-flow-open-en-dark', theme: 'dark', kase: 'open' },
];

function srgb(channel) {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
function luminance(r, g, b) {
  return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
}
function ratio(l1, l2) {
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

function measureContrast(buffer, box) {
  const png = PNG.sync.read(buffer);
  const buckets = new Array(256).fill(0);
  let total = 0;
  for (let y = box.y; y < box.y + box.h && y < png.height; y += 1) {
    for (let x = box.x; x < box.x + box.w && x < png.width; x += 1) {
      const i = (png.width * y + x) << 2;
      const l = luminance(png.data[i], png.data[i + 1], png.data[i + 2]);
      buckets[Math.round(l * 255)] += 1;
      total += 1;
    }
  }
  const bg = buckets.indexOf(Math.max(...buckets));
  let text = bg;
  let best = 0;
  for (let b = 0; b < 256; b += 1) {
    if (buckets[b] < total * 0.0005) continue;
    const r = ratio(bg / 255, b / 255);
    if (r > best) {
      best = r;
      text = b;
    }
  }
  return {
    sampledPixels: total,
    bgLuminance: Number((bg / 255).toFixed(3)),
    textLuminance: Number((text / 255).toFixed(3)),
    textPixelShare: Number((buckets[text] / total).toFixed(4)),
    wcagContrastRatio: Number(best.toFixed(2)),
    wcagAA: best >= 4.5,
  };
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const report = [];
for (const s of shots) {
  const consoleErrors = [];
  const pageErrors = [];
  const onConsole = (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  };
  const onPageError = (e) => pageErrors.push(String(e && e.message));
  page.on('console', onConsole);
  page.on('pageerror', onPageError);

  // Flag ON via URL (highest precedence). case=open drives the real dblclick.
  const url = `${BASE}?lang=en&theme=${s.theme}&ff_doc0_document_viewer=1&case=${s.kase}`;
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector('tbody tr', { timeout: 30000 });

  let overlayPresent = false;
  let viewerTitle = null;
  let viewerNavLabels = [];
  if (s.kase === 'open') {
    // The harness screen dispatches the dblclick ~400ms after mount; wait for the
    // real overlay the production openRow fork renders.
    await page.waitForSelector('[data-testid="doc0-document-viewer-overlay"]', {
      timeout: 15000,
    });
    await page.waitForTimeout(1200);
    overlayPresent = await page.isVisible('[data-testid="doc0-document-viewer-overlay"]');
    // The shell renders the title in its header (not an h1/h2), so assert the
    // title TEXT is present inside the overlay rather than guessing the element.
    viewerTitle = await page
      .evaluate(() => {
        const overlay = document.querySelector('[data-testid="doc0-document-viewer-overlay"]');
        if (!overlay) return null;
        const wanted = 'Digital Roadmap 2026';
        const hit = Array.from(overlay.querySelectorAll('*')).find(
          (el) => (el.textContent || '').trim().startsWith(wanted) && el.children.length === 0
        );
        return hit ? hit.textContent.trim() : null;
      })
      .catch(() => null);
    viewerNavLabels = await page
      .$$eval('[data-testid="doc0-document-viewer-overlay"] nav button, [data-testid="doc0-document-viewer-overlay"] nav a', (els) =>
        els.map((e) => e.textContent?.trim()).filter(Boolean)
      )
      .catch(() => []);
  } else {
    await page.waitForTimeout(600);
  }

  const raw = await page.screenshot({ fullPage: false });
  const contrast = measureContrast(raw, { x: 60, y: 120, w: 1320, h: 720 });

  const file = `${OUT}/${s.key}-1440x900.png`;
  let sizeKb = 0;
  for (const quality of [95, 85, 75, 60]) {
    await sharp(raw).png({ palette: true, quality, effort: 10, compressionLevel: 9 }).toFile(file);
    sizeKb = Number((fs.statSync(file).size / 1024).toFixed(1));
    if (sizeKb <= 200) break;
  }

  const rowTitles = await page.$$eval('tbody tr', (els) =>
    els.map((tr) => tr.textContent?.trim().slice(0, 60)).filter(Boolean)
  );
  const darkClass = await page.evaluate(() => document.documentElement.classList.contains('dark'));

  report.push({
    key: s.key,
    url,
    case: s.kase,
    darkClass,
    sizeKb,
    consoleErrors: consoleErrors.length,
    consoleErrorTexts: consoleErrors.slice(0, 5),
    pageErrors: pageErrors.length,
    pageErrorTexts: pageErrors.slice(0, 5),
    rowCount: rowTitles.length,
    rowTitles,
    overlayPresent,
    viewerTitle,
    viewerNavLabels,
    contrast,
  });

  page.off('console', onConsole);
  page.off('pageerror', onPageError);
}

await browser.close();
fs.writeFileSync(`${OUT}/pomiary.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
