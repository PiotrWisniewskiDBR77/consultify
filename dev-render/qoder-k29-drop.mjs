/* eslint-disable */
/**
 * K-29 (Wpis 138 / QB2) — evidence driver: task attachments drag & drop.
 *
 * Renders the REAL <AttachmentsSection> via the dev-render harness and
 * dispatches REAL `drop` events (DataTransfer + DragEvent) on the card:
 *   - small image File  -> uploads, card auto-expands, thumbnail + success toast
 *   - 26 MB File        -> rejected by the 25 MB guard, error toast, NOT uploaded
 *
 * Server:  npx vite --config dev-render/vite.config.ts --port 5418 --strictPort
 * Run:     node dev-render/qoder-k29-drop.mjs <outDir> [light|dark|all]
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const PORT = 5418;
const outDir = process.argv[2] || 'evidence/qoder-k29-attachments-20260918';
const themes = process.argv[3] && process.argv[3] !== 'all' ? [process.argv[3]] : ['light', 'dark'];
fs.mkdirSync(outDir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 1x1 transparent PNG fallback; the real thumbnail is drawn on a canvas in-page.
async function dropSmallImage(page) {
  await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 160;
    c.height = 100;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#2563eb';
    ctx.fillRect(0, 0, 160, 100);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('K-29 proof', 22, 56);
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    const file = new File([blob], 'k29-photo.png', { type: 'image/png' });
    const dt = new DataTransfer();
    dt.items.add(file);
    const el = document.querySelector('[data-testid="attachments-card"]');
    el.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  });
}

async function dropLargeFile(page) {
  await page.evaluate(() => {
    const f = new File(['x'], 'movie-26mb.mp4', { type: 'application/octet-stream' });
    Object.defineProperty(f, 'size', { value: 26 * 1024 * 1024 });
    const dt = new DataTransfer();
    dt.items.add(f);
    const el = document.querySelector('[data-testid="attachments-card"]');
    el.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  });
}

function readState() {
  const card = document.querySelector('[data-testid="attachments-card"]');
  const gridItems = card ? card.querySelectorAll('.grid > div').length : 0;
  const hasThumb = !!(card && card.querySelector('img'));
  const expanded = !!(card && card.querySelector('.grid'));
  const toasts = Array.from(document.querySelectorAll('[role="status"], [data-testid="toast"], .react-hot-toast'))
    .map((t) => (t.textContent || '').trim())
    .filter(Boolean);
  const bodyText = document.body.innerText || '';
  return {
    gridItems,
    hasThumb,
    expanded,
    toasts,
    tooLargeMsg: /too large/i.test(bodyText),
    uploadedMsg: /Uploaded/i.test(bodyText),
  };
}

async function shoot(browser, theme) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 200));
  });
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e).slice(0, 200)));
  await page.route('**/*', (route) => {
    const u = route.request().url();
    if (/^http:\/\/(localhost|127\.0\.0\.1)/.test(u) || u.startsWith('data:') || u.startsWith('blob:'))
      return route.continue();
    const isImg = /\.(png|jpe?g|gif|svg|webp|ico)(\?|$)/i.test(u);
    if (isImg)
      return route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
          'base64'
        ),
      });
    return route.fulfill({ status: 200, contentType: 'text/plain', body: '' });
  });

  const url = `http://localhost:${PORT}/?screen=k29-attachments-drop&lang=en&theme=${theme}`;

  // --- BEFORE: collapsed, empty card ---
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
  await sleep(2500);
  const before = await page.evaluate(readState);
  await page.screenshot({ path: path.join(outDir, `k29-${theme}-before.png`) });

  // --- AFTER small: real drop of an image file ---
  await dropSmallImage(page);
  await sleep(1500);
  const afterSmall = await page.evaluate(readState);
  await page.screenshot({ path: path.join(outDir, `k29-${theme}-small-uploaded.png`) });

  // --- AFTER large: reload, drop a 26 MB file ---
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
  await sleep(2500);
  await dropLargeFile(page);
  await sleep(1200);
  const afterLarge = await page.evaluate(readState);
  await page.screenshot({ path: path.join(outDir, `k29-${theme}-large-rejected.png`) });

  console.log(
    `[${theme}] BEFORE ${JSON.stringify(before)}\n` +
      `        SMALL  ${JSON.stringify(afterSmall)}\n` +
      `        LARGE  ${JSON.stringify(afterLarge)}\n` +
      `        ERRORS ${errors.length ? errors.join(' | ') : 'none'}`
  );
  await page.close();
  return errors;
}

const browser = await chromium.launch(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {});
let total = 0;
for (const theme of themes) {
  const errs = await shoot(browser, theme);
  total += errs.length;
}
await browser.close();
console.log('DONE. bledyKonsoli(lacznie):', total, '->', outDir);
