/** Dump WSZYSTKICH klikalnych elementów lewego railu (x<70), szczególnie dół. */
import { chromium } from 'playwright';
import fs from 'node:fs';
const AUTH = JSON.parse(fs.readFileSync('/tmp/consultify-auth.json', 'utf8'));
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
await ctx.addInitScript((ls) => { for (const k of Object.keys(ls)) localStorage.setItem(k, ls[k]); }, AUTH);
const page = await ctx.newPage();
await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(6000);

const els = await page.evaluate(() => {
  const out = [];
  for (const e of document.querySelectorAll('button, a, [role="button"], [onclick]')) {
    const r = e.getBoundingClientRect();
    if (r.left < 70 && r.width > 0 && r.height > 0) {
      const icon = e.querySelector('svg')?.classList?.value || '';
      out.push({
        tag: e.tagName.toLowerCase(),
        y: Math.round(r.top),
        title: e.getAttribute('title') || e.getAttribute('aria-label') || e.textContent.trim().slice(0, 30) || '(no-label)',
        href: e.getAttribute('href') || '',
        icon: icon.replace(/lucide-?/g, '').trim().slice(0, 40),
      });
    }
  }
  return out.sort((a, b) => a.y - b.y);
});
console.log('=== LEWY RAIL — wszystkie klikalne (x<70) ===');
for (const e of els) console.log(`  y=${e.y}  <${e.tag}> "${e.title}" ${e.href ? 'href='+e.href : ''} ${e.icon ? 'icon='+e.icon : ''}`);
await browser.close();
