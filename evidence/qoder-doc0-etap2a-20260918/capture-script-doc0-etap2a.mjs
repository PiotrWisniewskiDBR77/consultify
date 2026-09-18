// DOC-0 etap 2a (DEC-593, Wpis 106 Q1(b) + Q2) evidence capture — TEMPORARY
// tooling script, not wired into CI. It screenshots the STANDALONE document
// screen `/documents/:artifactId` at 1440x900, EN, light + dark, reached FOUR
// ways: the bare URL and the three rewired in-app callers (real
// `InitiativeCompactPanel` › Outputs row, real `NotebookContextPanel` › Open
// consumed by the real `MyWorkHub` handler, real `RezultatyView` › Open).
// Every click is a REAL click on the production component; the script only
// asserts where the production navigation landed. Contrast is measured
// PIXEL-WISE from the raw capture (pngjs) BEFORE the palette quantization that
// keeps each PNG under the 200 KB limit (sharp).
//
// Run from the repo root with the harness up on port 5421 (pool C):
//   npx vite --config dev-render/vite.config.ts --port 5421 --strictPort
//   node evidence/qoder-doc0-etap2a-20260918/capture-script-doc0-etap2a.mjs
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import sharp from 'sharp';

const OUT = '/Users/piotrwisniewski/Developer/qoder-wt/consultify-c/evidence/qoder-doc0-etap2a-20260918';
const BASE = 'http://127.0.0.1:5421/doc0-etap2a.html';
const REGISTRY = JSON.parse(
  fs.readFileSync(
    '/Users/piotrwisniewski/Developer/qoder-wt/consultify-c/dev-render/mocks/doc0-etap2a-registry.json',
    'utf8'
  )
);
const ARTIFACT_ID = REGISTRY.artifactEnvelope.data.artifactId;
const TITLE = REGISTRY.artifactEnvelope.data.resolvedTitle;

const shots = [];
for (const theme of ['light', 'dark']) {
  for (const entry of ['url', 'initiative', 'notebook', 'rezultaty']) {
    shots.push({ key: `doc0-etap2a-${entry}-en-${theme}`, theme, entry });
  }
}

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
  if (!total) {
    return {
      sampledPixels: 0,
      bgLuminance: null,
      textLuminance: null,
      textPixelShare: null,
      wcagContrastRatio: null,
      wcagAA: false,
    };
  }
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

/** The real click chain per caller — no `navigate()` from the script. */
async function driveEntry(page, entry) {
  if (entry === 'url') return { clicked: 'none (bare deep link)' };
  if (entry === 'initiative') {
    await page.locator('button', { hasText: /^Outputs/ }).first().click();
    await page.locator('button', { hasText: TITLE }).first().waitFor({ timeout: 20000 });
    await page.locator('button', { hasText: TITLE }).first().click();
    return { clicked: 'Outputs tab → output row' };
  }
  if (entry === 'notebook') {
    const open = page.locator('button', { hasText: /^Open$/ }).first();
    await open.waitFor({ timeout: 30000 });
    await open.click();
    return { clicked: 'Linked outputs → Open' };
  }
  if (entry === 'rezultaty') {
    const open = page.locator('button', { hasText: /^Open$/ }).first();
    await open.waitFor({ timeout: 30000 });
    await open.click();
    return { clicked: 'Linked objects → Open' };
  }
  throw new Error(`unknown entry ${entry}`);
}

/** Palette-quantize to stay under the 200 KB evidence limit; returns KB. */
async function savePng(raw, file) {
  let sizeKb = 0;
  for (const quality of [95, 85, 75, 60]) {
    await sharp(raw).png({ palette: true, quality, effort: 10, compressionLevel: 9 }).toFile(file);
    sizeKb = Number((fs.statSync(file).size / 1024).toFixed(1));
    if (sizeKb <= 200) break;
  }
  return sizeKb;
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

  // Flag ON through the URL — the highest precedence in `documentViewerFlag`.
  const url = `${BASE}?lang=en&theme=${s.theme}&ff_doc0_document_viewer=1&entry=${s.entry}`;
  console.log(`[shot] ${s.key} → ${url}`);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
  const pathBefore = await page.evaluate(() => window.location.pathname);

  // Caller shot: the three in-app entries land on the SAME screen, so without
  // this the evidence would not show where each click started.
  let caller = null;
  if (s.entry !== 'url') {
    if (s.entry === 'initiative') {
      await page.locator('button', { hasText: /^Outputs/ }).first().click();
      await page.locator('button', { hasText: TITLE }).first().waitFor({ timeout: 30000 });
    } else {
      await page.locator('button', { hasText: /^Open$/ }).first().waitFor({ timeout: 30000 });
    }
    await page.waitForTimeout(600);
    // The row that carries the click. Resolved and scrolled into view BEFORE the
    // shot: the case Linked-objects table sits below the fold, so a shot at
    // scroll 0 would not show what was clicked.
    const rowLocator =
      s.entry === 'rezultaty'
        ? page.locator('tbody tr', { hasText: 'Deliverable for the client' }).first()
        : page.getByText(TITLE, { exact: false }).first();
    await rowLocator.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    const callerRaw = await page.screenshot({ fullPage: false });
    const callerFile = path.join(OUT, `${s.key}-caller-1440x900.png`);
    // Measured inside the row's OWN box: the initiative panel sits on a
    // decorative `bg-black/20` scrim, so a full-viewport sample would report
    // the scrim, not the text.
    const box = await rowLocator.boundingBox();
    const pad = 10;
    const rowBox = (() => {
      if (!box) return { x: 60, y: 120, w: 1320, h: 720 };
      const x = Math.max(0, Math.round(box.x - pad));
      const y = Math.max(0, Math.round(box.y - pad));
      return {
        x,
        y,
        w: Math.max(1, Math.min(1440 - x, Math.round(box.width + pad * 2))),
        h: Math.max(1, Math.min(900 - y, Math.round(box.height + pad * 2))),
      };
    })();
    caller = {
      file: path.basename(callerFile),
      sizeKb: await savePng(callerRaw, callerFile),
      rowText: (await rowLocator.innerText().catch(() => ''))
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 120),
      rowBox,
      contrast: measureContrast(callerRaw, rowBox),
    };
  }

  const drive = await driveEntry(page, s.entry);

  // The standalone screen is real when the right panel (SPEC-A PROPERTIES /
  // RELATIONS, `aria-label` = documents.viewer.panelAriaLabel) is mounted and
  // the resolved title from the registry is on screen.
  await page.waitForSelector('[aria-label="Document details"]', { timeout: 30000 });
  await page.waitForFunction(
    (want) => (document.body.innerText || '').includes(want),
    TITLE,
    { timeout: 30000 }
  );
  await page.waitForTimeout(900);

  const observed = await page.evaluate((title) => {
    const panel = document.querySelector('[aria-label="Document details"]');
    const leaf = Array.from(document.querySelectorAll('*')).find(
      (el) => (el.textContent || '').trim().startsWith(title) && el.children.length === 0
    );
    const labels = (scope) =>
      scope
        ? Array.from(scope.querySelectorAll('button, a'))
            .map((e) => (e.textContent || '').trim())
            .filter(Boolean)
        : [];
    return {
      path: window.location.pathname,
      panelPresent: !!panel,
      viewerTitle: leaf ? leaf.textContent.trim() : null,
      panelSections: labels(panel).slice(0, 12),
      crimsonHits: Array.from(document.querySelectorAll('*')).filter((el) => {
        const bg = getComputedStyle(el).backgroundColor;
        const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(bg || '');
        return !!m && Number(m[1]) > 90 && Number(m[1]) < 180 && Number(m[2]) < 60 && Number(m[3]) < 80;
      }).length,
    };
  }, TITLE);

  const raw = await page.screenshot({ fullPage: false });
  const contrast = measureContrast(raw, { x: 60, y: 120, w: 1320, h: 720 });

  const file = path.join(OUT, `${s.key}-1440x900.png`);
  const sizeKb = await savePng(raw, file);

  report.push({
    key: s.key,
    entry: s.entry,
    theme: s.theme,
    url,
    clicked: drive.clicked,
    caller,
    pathBefore,
    pathAfter: observed.path,
    landedOnRoute: observed.path === `/documents/${ARTIFACT_ID}`,
    darkClass: await page.evaluate(() => document.documentElement.classList.contains('dark')),
    panelPresent: observed.panelPresent,
    viewerTitle: observed.viewerTitle,
    panelSections: observed.panelSections,
    crimsonHits: observed.crimsonHits,
    sizeKb,
    consoleErrors: consoleErrors.length,
    consoleErrorTexts: consoleErrors.slice(0, 5),
    pageErrors: pageErrors.length,
    pageErrorTexts: pageErrors.slice(0, 5),
    contrast,
  });

  page.off('console', onConsole);
  page.off('pageerror', onPageError);
}

await browser.close();
fs.writeFileSync(path.join(OUT, 'pomiary.json'), JSON.stringify(report, null, 2));
const summary = report.map((r) => ({
  key: r.key,
  landed: r.landedOnRoute,
  title: !!r.viewerTitle,
  panel: r.panelPresent,
  crimson: r.crimsonHits,
  kb: r.sizeKb,
  callerKb: r.caller ? r.caller.sizeKb : null,
  callerRow: r.caller ? r.caller.rowText : null,
  callerContrast: r.caller ? r.caller.contrast.wcagContrastRatio : null,
  callerAA: r.caller ? r.caller.contrast.wcagAA : null,
  bledyKonsoli: r.consoleErrors + r.pageErrors,
  contrast: r.contrast.wcagContrastRatio,
  aa: r.contrast.wcagAA,
}));
console.log(JSON.stringify(summary, null, 2));
console.log(
  'TOTAL bledyKonsoli=',
  report.reduce((a, r) => a + r.consoleErrors + r.pageErrors, 0),
  ' landed=',
  report.filter((r) => r.landedOnRoute).length + '/' + report.length
);
