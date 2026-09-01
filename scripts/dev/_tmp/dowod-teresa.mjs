/* eslint-disable */
import fs from 'fs'; import path from 'path';
import { chromium } from 'playwright';
const OUT = path.resolve(process.cwd(), 'evidence/grafika/119-prezentacja');
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.route('**/*', (r) => { const u = r.request().url();
  return u.startsWith('http://127.0.0.1')||u.startsWith('http://localhost')||u.startsWith('data:')||u.startsWith('blob:') ? r.continue() : r.abort(); });
await p.goto('http://127.0.0.1:3020/?screen=deck-artifact&lang=pl&theme=light', { waitUntil: 'networkidle' }).catch(()=>{});
await p.waitForTimeout(3500);
const m = () => p.evaluate(() => ({
  teresa: document.querySelector('[data-testid="artifact-studio-global-teresa"]')?.getBoundingClientRect().width ?? 0,
  panel: document.querySelector('[data-testid="artifact-studio-right-panel"]')?.getBoundingClientRect().width ?? 0,
  lewa: document.querySelector('[data-testid="mels-left-rail"]')?.getBoundingClientRect().width ?? 0,
  plotno: document.querySelector('[data-testid="mels-canvas"]')?.getBoundingClientRect().width ?? 0,
}));
console.log('PRZED klikiem:', await m());
await p.locator('button', { hasText: 'Zapytaj Teresę' }).first().click().catch(e=>console.log('klik:',e.message.split('\n')[0]));
await p.waitForTimeout(1500);
console.log('PO kliku „Zapytaj Teresę":', await m());
await p.screenshot({ path: path.join(OUT, 'PO-7-teresa-otwarta.png') });
await b.close();
