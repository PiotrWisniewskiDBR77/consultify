import { otworz, zaloguj, zrzut, nowyLog, BASE } from '/Users/piotrwisniewski/Developer/wt/kontrola-po-naprawach/scripts/dev/kontrola-0909-wspolne.mjs';
const Z='KONTROLA-mtuirqqp';
const log=nowyLog(); const {browser,page}=await otworz(log);
page.on('dialog',d=>d.accept().catch(()=>{}));
await zaloguj(page);
const net=()=>log.siec.filter(s=>['POST','PUT','PATCH','DELETE'].includes(s.metoda)&&!/voice-event|auth\/login|materialize/.test(s.url)).map(s=>`${s.status} ${s.metoda} ${s.url}`);
await page.goto(`${BASE}/execution?tab=work`,{waitUntil:'domcontentloaded'}); await page.waitForTimeout(9000);
const w=page.locator(`tbody tr:has-text("${Z}")`).first();
await w.locator('button[aria-label*="Row actions"]').first().click({force:true}); await page.waitForTimeout(1800);
await page.locator('[role="menuitem"]:has-text("Open task")').first().click({force:true}); await page.waitForTimeout(9000);
await page.getByRole('button',{name:/^Edit$/}).first().click({force:true}).catch(()=>{});
await page.waitForTimeout(4000);
const ta = page.locator('textarea').first();
await ta.click({force:true}); await page.keyboard.type('EDYCJA KONTROLA 09.09 — opis zmieniony przez UI.');
await page.waitForTimeout(1500);
await page.keyboard.press('Tab');            // blur → zapis
await page.waitForTimeout(6000);
const przyciski = await page.evaluate(()=>[...document.querySelectorAll('button')].map(b=>b.innerText.trim()).filter(x=>/save|zapisz|done|apply/i.test(x)));
console.log('przyciski zapisu na ekranie:', przyciski.join(' | ')||'brak');
for (const p of przyciski.slice(0,2)) { await page.getByRole('button',{name:new RegExp('^'+p.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$')}).first().click({force:true}).catch(()=>{}); await page.waitForTimeout(5000); }
await zrzut(page,'realizacja-29-edycja-opisu','zapis');
console.log('ZAPISY:', net().join(' | ')||'brak');
console.log('4xx5xx:', [...new Set(log.siec.filter(s=>s.status>=400).map(s=>`${s.status} ${s.metoda} ${s.url.replace(/[0-9a-f-]{20,}/g,'<id>')}`))].join(' | ')||'brak');
console.log('konsola:', log.konsola.length);
await browser.close();
