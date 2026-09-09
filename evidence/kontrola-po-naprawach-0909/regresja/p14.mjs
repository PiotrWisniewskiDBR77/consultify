import { otworz, zaloguj, zrzut, nowyLog, BASE } from '/Users/piotrwisniewski/Developer/wt/kontrola-po-naprawach/scripts/dev/kontrola-0909-wspolne.mjs';
const log=nowyLog(); const {browser,page}=await otworz(log);
await zaloguj(page);
await page.goto(`${BASE}/presentations`,{waitUntil:'domcontentloaded'}); await page.waitForTimeout(9000);
await page.locator('[role="tab"]').first().click({force:true}).catch(()=>{});   // zakladka All
await page.waitForTimeout(4500);
const vs = page.getByRole('button',{name:/View settings|Column|Kolumn/i}).first();
console.log('pstryczek kolumn:', await vs.isVisible({timeout:3000}).catch(()=>false));
await vs.click({force:true}).catch(()=>{});
await page.waitForTimeout(2500);
await zrzut(page,'DOSIEW-5-pstryczek-kolumn','regresja');
const poz = await page.evaluate(()=>[...document.querySelectorAll('[role="menuitem"],[role="menuitemcheckbox"],label')].map(x=>x.innerText.trim()).filter(Boolean).slice(0,40));
console.log('pozycje:', poz.join(' | ').slice(0,600));
for (const n of ['FORMAT','SOURCE','Format','Source']) {
  const el = page.locator(`[role="menuitemcheckbox"]:has-text("${n}"), [role="menuitem"]:has-text("${n}"), label:has-text("${n}")`).first();
  if (await el.isVisible({timeout:1500}).catch(()=>false)) { await el.click({force:true}).catch(()=>{}); await page.waitForTimeout(1500); console.log('wlaczono', n); }
}
await page.keyboard.press('Escape').catch(()=>{});
await page.waitForTimeout(3500);
await zrzut(page,'DOSIEW-5-kolumny-po','regresja');
const naglowki = await page.evaluate(()=>[...document.querySelectorAll('thead th')].map(x=>x.innerText.trim()));
console.log('NAGLOWKI:', naglowki.join(' | '));
const dane = await page.evaluate(()=>{const th=[...document.querySelectorAll('thead th')].map(x=>x.innerText.trim()); const iF=th.indexOf('FORMAT'), iS=th.indexOf('SOURCE'); return [...document.querySelectorAll('tbody tr')].map(r=>{const c=[...r.querySelectorAll('td')].map(x=>x.innerText.trim()); return `${(c[1]||'').slice(0,32)} :: FORMAT=${c[iF]} :: SOURCE=${c[iS]}`;});});
console.log('WIERSZE:\n' + dane.join('\n'));
console.log('4xx5xx:', [...new Set(log.siec.filter(s=>s.status>=400).map(s=>`${s.status} ${s.metoda} ${s.url.replace(/[0-9a-f-]{20,}/g,'<id>')}`))].join(' | ')||'brak');
console.log('konsola:', log.konsola.length);
await browser.close();
