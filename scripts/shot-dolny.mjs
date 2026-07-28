/**
 * Zrzuty dolnego paska Idei (4 narzędzia × motyw × flaga).
 * Uruchomienie: node scripts/shot-dolny.mjs <katalog-wyjscia> [ff]
 *   ff = wartosc query `ff_ideaBottomBarUnified` (np. 1 / 0). Pusty = brak parametru.
 */
import { chromium } from 'playwright';
import fs from 'fs';

const OUT = process.argv[2] || '/private/tmp/u-dolny-shots/base';
const FF = process.argv[3] || '';
fs.mkdirSync(OUT, { recursive: true });

const SCREENS = [
  ['mapa', 'mindmap-canvas'],
  ['tablica', 'whiteboard-canvas'],
  ['przeplyw', 'processflow-canvas'],
  ['tabela', 'idea-table-timeline-stuck'],
];

const CORNER = { x: 900, y: 500, width: 580, height: 340 };

const browser = await chromium.launch();
for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext({
    viewport: { width: 1480, height: 840 },
    colorScheme: theme,
    deviceScaleFactor: 2,
  });
  for (const [name, screen] of SCREENS) {
    const page = await ctx.newPage();
    const errs = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errs.push(m.text().slice(0, 200));
    });
    page.on('pageerror', (e) => errs.push('PAGEERROR ' + String(e).slice(0, 300)));
    let url = `http://localhost:3332/?screen=${screen}&theme=${theme}`;
    if (FF !== '') url += `&ff_ideaBottomBarUnified=${FF}`;
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForTimeout(4500);
    await page.screenshot({ path: `${OUT}/${name}-${theme}-full.png` });
    await page.screenshot({ path: `${OUT}/${name}-${theme}-rog.png`, clip: CORNER });
    // inwentarz: co realnie siedzi w prawym dolnym rogu
    const inv = await page.evaluate(() => {
      const out = [];
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      for (const el of document.querySelectorAll('button, [data-testid]')) {
        const r = el.getBoundingClientRect();
        if (r.width < 8 || r.height < 8) continue;
        if (r.right < vw - 420 || r.bottom < vh - 160) continue;
        out.push({
          tag: el.tagName,
          testid: el.getAttribute('data-testid') || '',
          title: el.getAttribute('title') || el.getAttribute('aria-label') || '',
          text: (el.textContent || '').trim().slice(0, 24),
          x: Math.round(r.left),
          y: Math.round(r.top),
          w: Math.round(r.width),
          h: Math.round(r.height),
        });
      }
      const pct = [...document.querySelectorAll('div')]
        .filter((d) => /^\d{1,3}%$/.test((d.textContent || '').trim()) && d.children.length === 0)
        .map((d) => (d.textContent || '').trim());
      return { items: out, pct };
    });
    fs.writeFileSync(
      `${OUT}/${name}-${theme}.json`,
      JSON.stringify({ inv, errs: errs.slice(0, 12) }, null, 2)
    );
    await page.close();
  }
  await ctx.close();
}
await browser.close();
console.log('OK ->', OUT);
