// U-43 / DECK-1A — evidence capture for the Deck Builder "Review" panel.
// Serve the harness first: npx vite --config dev-render/vite.config.ts --port 4571
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
const OUT = '/Users/piotrwisniewski/Developer/wt/deck-1a/evidence/u43-deck-review-20260916';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const jobs = [
  ['after', 4571], // add ['before', 4572] when a baseline worktree is served
];
for (const [phase, port] of jobs) {
  for (const theme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.setDefaultNavigationTimeout(180000);
    page.setDefaultTimeout(180000);
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    await page.goto(`http://localhost:${port}/index.html?screen=u43-deck-review&lang=en&theme=${theme}&uwagi=0`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    // open the left-rail Review/QA tab
    const tabName = phase === 'after' ? 'Review' : 'QA and review';
    const clicked = await page.evaluate((name) => {
      const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
      const target = tabs.find((el) => (el.textContent || '').trim() === name);
      if (!target) return false;
      target.click();
      return true;
    }, tabName);
    if (!clicked) throw new Error('tab not found: ' + tabName);
    await page.waitForTimeout(1500);
    const file = path.join(OUT, `${phase}-${theme}.png`);
    await page.screenshot({ path: file });
    const contrast = await page.evaluate(() => {
      const srgb = (c) => { c/=255; return c<=0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4); };
      const lum = (rgb) => { const [r,g,b]=rgb; return 0.2126*srgb(r)+0.7152*srgb(g)+0.0722*srgb(b); };
      const parse = (s) => (s.match(/\d+(\.\d+)?/g)||[]).slice(0,3).map(Number);
      const bgOf = (el) => { let n=el; while(n){ const c=getComputedStyle(n).backgroundColor; const p=parse(c); const a=(c.match(/[\d.]+\)$/)||['1'])[0]; if(p.length===3 && parseFloat(a)>0.9) return p; n=n.parentElement; } return [255,255,255]; };
      const panel = document.querySelector('[data-testid="presentation-review-findings"]');
      if (!panel) return null;
      const out = [];
      for (const el of panel.querySelectorAll('p,h4,span,button')) {
        const txt = (el.textContent||'').trim();
        if (!txt || el.querySelector('p,h4,span')) continue;
        const fg = parse(getComputedStyle(el).color);
        const bg = bgOf(el);
        const l1 = lum(fg), l2 = lum(bg);
        const ratio = (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05);
        out.push({ txt: txt.slice(0,44), ratio: Math.round(ratio*100)/100 });
      }
      return out.sort((a,b)=>a.ratio-b.ratio).slice(0,6);
    });
    console.log('---', phase, theme, 'errors=', errs.length, errs[0] || '');
    console.log(JSON.stringify(contrast, null, 1));
    await page.close();
  }
}
await browser.close();
