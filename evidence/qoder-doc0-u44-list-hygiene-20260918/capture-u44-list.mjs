// Zrzuty harnessu doc0-document-flow case=list (DOC-0/U-44) — 1440x900, light+dark.
// Liczy bledy konsoli, pageerror, odpowiedzi >=400; mierzy kontrast WCAG naglowka TITLE i komorki SOURCE.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const PORT = process.env.PORT || '5420';
const BASE = `http://127.0.0.1:${PORT}/doc0-document-flow.html`;
const OUT = path.resolve(path.dirname(new URL(import.meta.url).pathname));

function luminance(r, g, b) {
  const a = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}
function parseColor(str) {
  const m = str.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const p = m[1].split(',').map((s) => parseFloat(s.trim()));
  return { r: p[0], g: p[1], b: p[2] };
}
function contrast(fg, bg) {
  const l1 = luminance(fg.r, fg.g, fg.b);
  const l2 = luminance(bg.r, bg.g, bg.b);
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

async function capture(browser, theme) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const consoleErrors = [];
  const pageErrors = [];
  const badResponses = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => pageErrors.push(String(err)));
  page.on('response', (res) => {
    if (res.status() >= 400) badResponses.push(`${res.status()} ${res.url()}`);
  });

  const url = `${BASE}?lang=en&theme=${theme}&ff_doc0_document_viewer=1&tab=all&case=list`;
  await page.goto(url, { waitUntil: 'networkidle' });

  // Czekaj na wiersze listy (harness wstrzykuje registry async).
  await page
    .waitForFunction(() => document.querySelectorAll('tbody tr').length > 0, { timeout: 15000 })
    .catch(() => {});
  await page.waitForTimeout(600);

  // Znajdz naglowki kolumn i komorki przez tekst (bez wymyslania atrybutow).
  const probe = await page.evaluate(() => {
    const headers = Array.from(document.querySelectorAll('thead th')).map((th) =>
      (th.textContent || '').trim()
    );
    const firstRowCells = Array.from(document.querySelectorAll('tbody tr:first-child td')).map(
      (td) => (td.textContent || '').trim()
    );
    function styleOf(sel, byText) {
      const nodes = Array.from(document.querySelectorAll(sel));
      const node = byText ? nodes.find((n) => (n.textContent || '').trim().includes(byText)) : nodes[0];
      if (!node) return null;
      const cs = getComputedStyle(node);
      return { color: cs.color, backgroundColor: cs.backgroundColor, fontSize: cs.fontSize, fontWeight: cs.fontWeight };
    }
    const titleHeader = styleOf('thead th', 'Title');
    const sourceCell = styleOf('tbody td', 'Document Studio');
    const bodyBg = getComputedStyle(document.body).backgroundColor;
    return { headers, firstRowCells, titleHeader, sourceCell, bodyBg };
  });

  const shot = path.join(OUT, `doc0-u44-list-en-${theme}-1440x900.png`);
  await page.screenshot({ path: shot, fullPage: false });

  let contrastTitle = null;
  if (probe.titleHeader) {
    const fg = parseColor(probe.titleHeader.color);
    const bg = parseColor(probe.titleHeader.backgroundColor) || parseColor(probe.bodyBg);
    if (fg && bg && !probe.titleHeader.backgroundColor.includes('rgba(0, 0, 0, 0)')) {
      contrastTitle = Number(contrast(fg, bg).toFixed(2));
    } else if (fg) {
      // Przejrzyste tlo naglowka — porownaj z tlem ciala/panelu.
      const panelBg = parseColor(probe.bodyBg);
      if (panelBg) contrastTitle = Number(contrast(fg, panelBg).toFixed(2));
    }
  }

  await page.close();
  return {
    theme,
    url,
    shot: path.basename(shot),
    bledyKonsoli: consoleErrors.length,
    consoleErrors,
    pageErrors,
    badResponses,
    headers: probe.headers,
    firstRowCells: probe.firstRowCells,
    titleHeader: probe.titleHeader,
    sourceCell: probe.sourceCell,
    contrastTitle,
  };
}

const browser = await chromium.launch();
const results = [];
for (const theme of ['light', 'dark']) {
  results.push(await capture(browser, theme));
}
await browser.close();

fs.writeFileSync(path.join(OUT, 'pomiary-u44-list.json'), JSON.stringify(results, null, 2));

for (const r of results) {
  console.log(`\n=== ${r.theme} ===`);
  console.log(`bledyKonsoli=${r.bledyKonsoli} pageErrors=${r.pageErrors.length} badResponses=${r.badResponses.length}`);
  console.log('headers:', JSON.stringify(r.headers));
  console.log('firstRowCells:', JSON.stringify(r.firstRowCells));
  console.log('contrastTitle:', r.contrastTitle);
  if (r.consoleErrors.length) console.log('console:', r.consoleErrors.slice(0, 5));
  if (r.badResponses.length) console.log('bad:', r.badResponses.slice(0, 10));
}
