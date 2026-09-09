import { otworz, zaloguj, zrzut, nowyLog, BASE } from '/Users/piotrwisniewski/Developer/wt/kontrola-po-naprawach/scripts/dev/kontrola-0909-wspolne.mjs';
const Z = process.env.ZNACZNIK || 'KONTROLA-x';
const log = nowyLog();
const { browser, page } = await otworz(log);
page.on('dialog', d => d.accept().catch(()=>{}));
await zaloguj(page);
async function idz(r,w=8000){ await page.goto(`${BASE}${r}`,{waitUntil:'domcontentloaded'}); await page.waitForTimeout(w); }
const net = () => log.siec.filter(s=>['POST','PUT','PATCH','DELETE'].includes(s.metoda)&&!/voice-event|auth\/login|materialize/.test(s.url)).map(s=>`${s.status} ${s.metoda} ${s.url}`);
const co = process.argv[2];

if (co === 'spotkania') {
  await idz('/meetings');
  await page.getByRole('button',{name:/^New meeting$/}).first().click({force:true});
  await page.waitForTimeout(3500);
  await page.locator('input[type="text"]').first().fill(`${Z} meeting`).catch(e=>console.log('tytul',String(e).slice(0,60)));
  const dt = page.locator('input[type="datetime-local"]');
  if (await dt.count()>0) { await dt.nth(0).fill('2026-10-12T10:00').catch(()=>{}); }
  if (await dt.count()>1) { await dt.nth(1).fill('2026-10-12T11:00').catch(()=>{}); }
  await zrzut(page,'spotkania-11-formularz-wypelniony','zapis');
  await page.getByRole('button',{name:/^Create meeting$/}).first().click({force:true});
  await page.waitForTimeout(6000);
  await zrzut(page,'spotkania-12-po-zapisie','zapis');
  await idz('/meetings');
  const n = await page.locator(`tbody tr:has-text("${Z}")`).count().catch(()=>0);
  console.log('na liscie:', n, '| wierszy:', await page.locator('tbody tr').count().catch(()=>0));
  await zrzut(page,'spotkania-13-lista-po','zapis');
}
if (co === 'mojapraca') {
  await idz('/my-work?tab=tasks');
  await page.getByRole('button',{name:/^New Task$/}).first().click({force:true});
  await page.waitForTimeout(7000);
  const pola = await page.evaluate(()=>[...document.querySelectorAll('input,textarea,[contenteditable="true"]')].map((i,k)=>({k, typ:i.tagName, aria:i.getAttribute('aria-label'), ph:i.placeholder||'', tid:i.getAttribute('data-testid')||''})));
  console.log('POLA:', JSON.stringify(pola.slice(0,12)));
  // tytul artefaktu: najczesciej pierwsze pole tekstowe / contenteditable naglowka
  const cel = page.locator('input[type="text"], [contenteditable="true"]').first();
  if (await cel.isVisible({timeout:4000}).catch(()=>false)) {
    await cel.click({force:true}).catch(()=>{});
    await cel.fill(`${Z} mywork`).catch(async()=>{ await page.keyboard.type(`${Z} mywork`); });
    await page.waitForTimeout(1500);
  }
  await zrzut(page,'mojapraca-11-edytor-wypelniony','zapis');
  const zapisz = page.getByRole('button',{name:/^(Save|Create|Start)$/}).first();
  if (await zapisz.isVisible({timeout:3000}).catch(()=>false)) { await zapisz.click({force:true}); await page.waitForTimeout(6000); }
  await zrzut(page,'mojapraca-12-po-zapisie','zapis');
  await idz('/my-work?tab=tasks');
  console.log('na ekranie:', (await page.evaluate(()=>document.body.innerText||'')).includes(Z));
  await zrzut(page,'mojapraca-13-lista-po','zapis');
}
console.log('ZAPISY:', net().join(' | ')||'brak');
console.log('4xx5xx:', [...new Set(log.siec.filter(s=>s.status>=400).map(s=>`${s.status} ${s.metoda} ${s.url.replace(/[0-9a-f-]{20,}/g,'<id>')}`))].join(' | ')||'brak');
console.log('konsola:', log.konsola.length, log.konsola.slice(0,3));
await browser.close();
