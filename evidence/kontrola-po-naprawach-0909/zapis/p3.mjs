import { otworz, zaloguj, zrzut, nowyLog, BASE } from '/Users/piotrwisniewski/Developer/wt/kontrola-po-naprawach/scripts/dev/kontrola-0909-wspolne.mjs';
const log = nowyLog();
const { browser, page } = await otworz(log);
page.on('dialog', d => d.accept().catch(()=>{}));
await zaloguj(page);
const co = process.argv[2];
async function idz(r,w=8000){ await page.goto(`${BASE}${r}`,{waitUntil:'domcontentloaded'}); await page.waitForTimeout(w); }
function net(){ return log.siec.filter(s=>['POST','PUT','PATCH','DELETE'].includes(s.metoda)&&!/voice-event|auth\/login|materialize/.test(s.url)).map(s=>`${s.status} ${s.metoda} ${s.url}`); }

if (co === 'materialy') {
  await idz('/presentations');
  const zak = await page.evaluate(()=>[...document.querySelectorAll('[role="tab"]')].map((t,i)=>({i,txt:t.innerText.trim()})));
  console.log('zakladki:', JSON.stringify(zak));
  for (const z of zak) {
    await page.locator('[role="tab"]').nth(z.i).click({force:true}).catch(()=>{});
    await page.waitForTimeout(4500);
    const n = await page.locator('tbody tr').count().catch(()=>0);
    const chipy = await page.evaluate(()=> (document.body.innerText||'').split('\n').slice(0,60).join(' | '));
    console.log(`  ${z.txt}: wierszy=${n}`);
    await zrzut(page, `materialy-zak-${z.txt.replace(/\W+/g,'-')}`, 'zapis');
  }
}
if (co === 'spotkania') {
  await idz('/meetings');
  const b = page.getByRole('button', { name: /^New meeting$/ }).first();
  console.log('CTA widoczny:', await b.isVisible({timeout:4000}).catch(()=>false));
  await b.click({force:true}).catch(e=>console.log('klik',String(e).slice(0,60)));
  await page.waitForTimeout(5000);
  await zrzut(page,'spotkania-10-po-cta','zapis');
  const st = await page.evaluate(()=>({url:location.href, dialog: !!document.querySelector('[role="dialog"]'), inputy:[...document.querySelectorAll('input,textarea')].map(i=>i.getAttribute('aria-label')||i.placeholder||i.name||i.type).slice(0,15), przyciski:[...document.querySelectorAll('button')].map(b=>b.innerText.trim()).filter(Boolean).slice(-14)}));
  console.log(JSON.stringify(st,null,1));
}
if (co === 'mojapraca') {
  await idz('/my-work?tab=tasks');
  await page.getByRole('button',{name:/^New Task$/}).first().click({force:true}).catch(e=>console.log('klik',String(e).slice(0,60)));
  await page.waitForTimeout(6000);
  await zrzut(page,'mojapraca-10-edytor','zapis');
  const st = await page.evaluate(()=>({url:location.href, inputy:[...document.querySelectorAll('input,textarea,[contenteditable]')].map(i=>i.getAttribute('aria-label')||i.placeholder||i.getAttribute('data-testid')||i.tagName).slice(0,20), przyciski:[...document.querySelectorAll('button')].map(b=>b.innerText.trim()).filter(Boolean).slice(0,40)}));
  console.log(JSON.stringify(st,null,1));
}
console.log('ZAPISY:', net().join(' | ')||'brak');
console.log('4xx5xx:', [...new Set(log.siec.filter(s=>s.status>=400).map(s=>`${s.status} ${s.metoda} ${s.url.replace(/[0-9a-f-]{20,}/g,'<id>')}`))].join(' | ')||'brak');
console.log('konsola:', log.konsola.length);
await browser.close();
