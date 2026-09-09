import { otworz, zaloguj, zrzut, nowyLog, BASE } from '/Users/piotrwisniewski/Developer/wt/kontrola-po-naprawach/scripts/dev/kontrola-0909-wspolne.mjs';
const log=nowyLog(); const {browser,page}=await otworz(log);
await zaloguj(page);
await page.goto(`${BASE}/results/kpi`,{waitUntil:'domcontentloaded'}); await page.waitForTimeout(9000);
const zak = await page.evaluate(()=>[...document.querySelectorAll('[role="tab"],button')].map(t=>t.innerText.trim()).filter(x=>/snapshot|review|scorecard/i.test(x)));
console.log('kandydaci:', zak.join(' | '));
for (const n of ['Scorecard','Review snapshots','Snapshots']) {
  const b=page.getByRole('button',{name:new RegExp('^'+n)}).first();
  if (await b.isVisible({timeout:2500}).catch(()=>false)) { await b.click({force:true}); await page.waitForTimeout(5000); console.log('kliknieto', n); }
}
await zrzut(page,'DOSIEW-3-migawka','regresja');
const t=await page.evaluate(()=>document.body.innerText||'');
console.log('Published na ekranie:', /Published/i.test(t), '| wierszy:', await page.locator('tbody tr').count().catch(()=>0));
console.log('4xx5xx:', [...new Set(log.siec.filter(s=>s.status>=400).map(s=>`${s.status} ${s.metoda} ${s.url.replace(/[0-9a-f-]{20,}/g,'<id>')}`))].join(' | ')||'brak');
console.log('konsola:', log.konsola.length);
await browser.close();
