import { otworz, zaloguj, zrzut, nowyLog, BASE } from '/Users/piotrwisniewski/Developer/wt/kontrola-po-naprawach/scripts/dev/kontrola-0909-wspolne.mjs';
const Z='KONTROLA-mtuirqqp';  // rekordy z przebiegu Realizacji
const log=nowyLog(); const {browser,page}=await otworz(log);
page.on('dialog',d=>d.accept().catch(()=>{}));
await zaloguj(page);
const net=()=>log.siec.filter(s=>['POST','PUT','PATCH','DELETE'].includes(s.metoda)&&!/voice-event|auth\/login|materialize/.test(s.url)).map(s=>`${s.status} ${s.metoda} ${s.url}`);
let baza=0; const nowe=()=>{const a=net().slice(baza); baza=net().length; return a;};

async function idz(r,w=9000){ await page.goto(`${BASE}${r}`,{waitUntil:'domcontentloaded'}); await page.waitForTimeout(w); }

// --- ZADANIE: podglad -> edycja -> usuniecie
await idz('/execution?tab=work');
const w = page.locator(`tbody tr:has-text("${Z}")`).first();
console.log('wiersz zadania:', await w.count().catch(()=>0));
await w.click({force:true}); await page.waitForTimeout(4000);
await zrzut(page,'realizacja-20-zadanie-podglad','zapis');
console.log('PODGLAD zapisy:', nowe().join(' | ')||'brak');
// edycja: dwuklik otwiera artefakt/edytor
await w.dblclick({force:true}).catch(()=>{}); await page.waitForTimeout(6000);
await zrzut(page,'realizacja-21-zadanie-edytor','zapis');
const tytul = page.locator('input[placeholder*="itle"], input[type="text"]').first();
if (await tytul.isVisible({timeout:4000}).catch(()=>false)) {
  await tytul.fill(`${Z} task EDYTOWANE`).catch(()=>{});
  await page.waitForTimeout(1500);
  const zap = page.getByRole('button',{name:/^(Save|Zapisz)$/}).first();
  if (await zap.isVisible({timeout:2500}).catch(()=>false)) { await zap.click({force:true}); }
  await page.waitForTimeout(5000);
}
await zrzut(page,'realizacja-22-zadanie-po-edycji','zapis');
console.log('EDYCJA zapisy:', nowe().join(' | ')||'brak');
// usuniecie przez kebab
await idz('/execution?tab=work');
const w2 = page.locator(`tbody tr:has-text("${Z}")`).first();
if (await w2.count().catch(()=>0)) {
  const keb = w2.locator('button[aria-label*="Row actions"], button[aria-label*="actions"]').first();
  if (await keb.isVisible({timeout:3000}).catch(()=>false)) {
    await keb.click({force:true}); await page.waitForTimeout(2000);
    await zrzut(page,'realizacja-23-kebab','zapis');
    const poz = await page.evaluate(()=>[...document.querySelectorAll('[role="menuitem"],[role="menu"] button')].map(x=>x.innerText.trim()).filter(Boolean));
    console.log('KEBAB:', poz.join(' | '));
    const del = page.locator('[role="menuitem"]:has-text("Delete"), [role="menuitem"]:has-text("Remove"), [role="menu"] button:has-text("Delete")').first();
    if (await del.isVisible({timeout:2500}).catch(()=>false)) { await del.click({force:true}); await page.waitForTimeout(5000); }
    else console.log('brak pozycji Delete w kebabie');
  } else console.log('brak kebaba w wierszu');
}
await idz('/execution?tab=work');
console.log('po usunieciu wierszy z znacznikiem:', await page.locator(`tbody tr:has-text("${Z}")`).count().catch(()=>0));
await zrzut(page,'realizacja-24-po-usunieciu','zapis');
console.log('USUNIECIE zapisy:', nowe().join(' | ')||'brak');
console.log('4xx5xx:', [...new Set(log.siec.filter(s=>s.status>=400).map(s=>`${s.status} ${s.metoda} ${s.url.replace(/[0-9a-f-]{20,}/g,'<id>')}`))].join(' | ')||'brak');
console.log('konsola:', log.konsola.length);
await browser.close();
