#!/usr/bin/env node
/** TEST-DANE 09.09 — B4 poprawiony: Moja Praca, Realizacja, Inicjatywy, Materialy (utworz-edytuj-usun). */
import { chromium } from 'playwright';
import fs from 'node:fs'; import path from 'node:path';
const BASE='http://127.0.0.1:3227';
const OUT='/Users/piotrwisniewski/Developer/wt/test-dane/evidence/test-jezyk-dane-0909/dane/zapis';
fs.mkdirSync(OUT,{recursive:true});
const PW=fs.readFileSync('/Users/piotrwisniewski/Developer/consultify-secrets/northwind-konta-STAGING.txt','utf8').match(/has(?:ł|l)o[^:]*:\s*(\S+)/i)[1];
const S='ZZTEST'+Date.now().toString(36).toUpperCase();
let net=[];
const b=await chromium.launch(); const c=await b.newContext({viewport:{width:1440,height:900},colorScheme:'light'}); const p=await c.newPage();
p.on('response',async r=>{const m=r.request().method(); if(/\/api\//.test(r.url())&&['POST','PUT','PATCH','DELETE'].includes(m)&&!/voice-event|materialize|autosave/.test(r.url())){let t='';try{t=(await r.text()).slice(0,160)}catch{} net.push(`${m} ${r.status()} ${r.url().replace(/^https?:\/\/[^/]+/,'').split('?')[0]} :: ${t.replace(/\s+/g,' ').slice(0,110)}`);}});
const zrzut=n=>p.screenshot({path:path.join(OUT,n+'.png')}).catch(()=>{});
const flush=t=>{console.log('   API['+t+']: '+(net.length?net.join(' | '):'(brak wywolan zapisu)')); net=[];};
const esc=async()=>{await p.mouse.click(700,880).catch(()=>{}); await p.keyboard.press('Escape').catch(()=>{}); await p.waitForTimeout(600);};
const klik=async(n,cz=2500)=>{const el=p.getByRole('button',{name:n,exact:true}).first(); if(await el.isVisible({timeout:2000}).catch(()=>false)){await el.click({force:true}).catch(()=>{}); await p.waitForTimeout(cz); return true;} return false;};
const klikCz=async(n,cz=2500)=>{const el=p.getByRole('button',{name:new RegExp(n,'i')}).first(); if(await el.isVisible({timeout:2000}).catch(()=>false)){await el.click({force:true}).catch(()=>{}); await p.waitForTimeout(cz); return true;} return false;};
const jest=async t=>(await p.evaluate(x=>(document.body.innerText||'').includes(x),t).catch(()=>false));
const btny=async()=>p.evaluate(()=>{const d=document.querySelector('[role="dialog"]')||document.body;return [...d.querySelectorAll('button')].map(x=>(x.innerText||x.getAttribute('aria-label')||'').trim().split('\n')[0]).filter(Boolean).slice(0,26);});

await p.goto(`${BASE}/login`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(2500);
await p.fill('input[type="email"]','james.whitfield@northwind.example'); await p.fill('input[type="password"]',PW);
await p.click('button[type="submit"]'); await p.waitForTimeout(9000);
await p.evaluate(()=>{try{const r=localStorage.getItem('consultify-storage');const j=r?JSON.parse(r):{state:{},version:0};j.state=j.state||{};j.state.theme='light';localStorage.setItem('consultify-storage',JSON.stringify(j));}catch{} localStorage.setItem('i18nextLng','en');for(const k of ['demo_tour_skipped','demo_tour_completed','teresa_onboarding_dismissed','consultify_teresa_onboarding_seen'])localStorage.setItem(k,'1');});
await p.reload({waitUntil:'domcontentloaded'}); await p.waitForTimeout(4000); net=[];

for (const [tag, route, zakladka] of [['mp','/my-work','Tasks'],['re','/execution','Decisions & risks']]) {
  console.log(`\n### B4 ${tag} :: ${route} -> ${zakladka}`);
  await p.goto(`${BASE}${route}`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(4500); await esc();
  console.log('  zakladka klikneta:', await klik(zakladka,3500));
  await esc(); await zrzut(`${tag}2-00-lista`);
  console.log('  przyciski ekranu:', JSON.stringify(await btny()));
  let otw=false;
  for (const n of ['New task','New decision','New','Add task','Add decision','Create task','Add']) { if(await klikCz('^'+n+'$',3000)){otw=true;console.log('  kreator z przycisku:',n);break;} }
  console.log('  kreator otwarty:', otw); await zrzut(`${tag}2-01-kreator`);
  if(otw){
    console.log('  przyciski kreatora:', JSON.stringify(await btny()));
    const inp=p.locator('[role="dialog"] input[type="text"], [role="dialog"] input:not([type]):not([type=checkbox]), [role="dialog"] textarea').first();
    if(await inp.isVisible({timeout:2500}).catch(()=>false)){ await inp.fill(`${S} rekord testowy`); await p.waitForTimeout(600); await zrzut(`${tag}2-02-wypelniony`); }
    for(const n of ['Create','Save','Add','Submit']) if(await klikCz('^'+n,3500)) break;
    flush(tag+'-utworz'); await p.waitForTimeout(2500); await zrzut(`${tag}2-03-po`);
    console.log('  widoczny na liscie:', await jest(S));
  } else flush(tag+'-brak-kreatora');
}

// --- INICJATYWY: kreator ---
console.log('\n### B4 inicjatywy');
await p.goto(`${BASE}/initiatives`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(4500); await esc();
console.log('  kreator otwarty:', await klikCz('^New initiative$',5000));
await zrzut('in2-01-kreator');
console.log('  przyciski:', JSON.stringify(await btny()));
const sel=p.locator('[role="dialog"] select').first();
if(await sel.isVisible({timeout:2000}).catch(()=>false)){ const opts=await sel.evaluate(s=>[...s.options].map(o=>o.text).slice(0,5)); console.log('  projekt opcje:',JSON.stringify(opts)); }
for(const n of ['Next','Continue','Skip']) if(await klikCz('^'+n,3500)){console.log('  przeszedl:',n);break;}
await zrzut('in2-02-krok2'); flush('in-krok'); console.log('  tekst kroku 2:', (await p.evaluate(()=>((document.querySelector('[role="dialog"]')||document.body).innerText||'').slice(0,260))).replace(/\n/g,' | '));

// --- MATERIALY: edycja i usuniecie utworzonego wczesniej ---
console.log('\n### B4 materialy: edycja/usuniecie');
await p.goto(`${BASE}/presentations`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(4500); await esc();
await klik('All',2500); await esc(); await zrzut('ma2-00-lista');
console.log('  "New presentation" na liscie:', await jest('New presentation'));
const w=p.locator('tbody tr').filter({hasText:'New presentation'}).first();
if(await w.isVisible({timeout:2500}).catch(()=>false)){
  await w.locator('button').last().click({force:true}).catch(()=>{}); await p.waitForTimeout(1800); await zrzut('ma2-01-kebab');
  console.log('  kebab:', JSON.stringify(await p.evaluate(()=>[...document.querySelectorAll('[role="menuitem"],[role="menu"] button')].map(x=>(x.innerText||'').trim()).filter(Boolean).slice(0,14))));
  for(const n of ['Delete','Remove','Usuń']){const el=p.getByRole('menuitem',{name:new RegExp(n,'i')}).first(); if(await el.isVisible({timeout:1500}).catch(()=>false)){await el.click({force:true}).catch(()=>{}); await p.waitForTimeout(2000); break;}}
  await zrzut('ma2-02-potwierdzenie');
  for(const n of ['Delete','Confirm','Yes']) if(await klikCz('^'+n,3000)) break;
  flush('ma-usun'); await p.waitForTimeout(2500); await p.reload({waitUntil:'domcontentloaded'}); await p.waitForTimeout(4000);
  await klik('All',2000); await zrzut('ma2-03-po-usunieciu');
  console.log('  po usunieciu nadal na liscie:', await jest('New presentation'));
} else console.log('  BRAK wiersza "New presentation" na liscie');
console.log('\nSTEMPEL='+S);
await b.close();
