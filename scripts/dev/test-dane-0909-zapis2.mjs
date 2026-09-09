#!/usr/bin/env node
/** TEST-DANE 09.09 — B4 pelny: utworz -> lista -> edytuj -> podglad -> usun, per modul. */
import { chromium } from 'playwright';
import fs from 'node:fs'; import path from 'node:path';
const BASE='http://127.0.0.1:3227';
const OUT='/Users/piotrwisniewski/Developer/wt/test-dane/evidence/test-jezyk-dane-0909/dane/zapis';
fs.mkdirSync(OUT,{recursive:true});
const PW=fs.readFileSync('/Users/piotrwisniewski/Developer/consultify-secrets/northwind-konta-STAGING.txt','utf8').match(/has(?:ł|l)o[^:]*:\s*(\S+)/i)[1];
const S='ZZTEST-'+Date.now().toString(36).toUpperCase();
let net=[];
const b=await chromium.launch(); const c=await b.newContext({viewport:{width:1440,height:900},colorScheme:'light'}); const p=await c.newPage();
p.on('response',async r=>{const m=r.request().method(); if(/\/api\//.test(r.url())&&['POST','PUT','PATCH','DELETE'].includes(m)&&!/voice-event|materialize/.test(r.url())){let t='';try{t=(await r.text()).slice(0,200)}catch{} net.push(`${m} ${r.status()} ${r.url().replace(/^https?:\/\/[^/]+/,'').split('?')[0]} :: ${t.replace(/\s+/g,' ').slice(0,120)}`);}});
const zrzut=n=>p.screenshot({path:path.join(OUT,n+'.png')}).catch(()=>{});
const flush=t=>{if(net.length){console.log('   API['+t+']: '+net.join(' | '));} net=[];};
const klik=async(nazwa,exact=false,czekaj=2500)=>{const el=p.getByRole('button',{name:nazwa,exact}).first(); if(await el.isVisible({timeout:2500}).catch(()=>false)){await el.click({force:true}).catch(()=>{}); await p.waitForTimeout(czekaj); return true;} return false;};
const klikTekst=async(t,czekaj=2500)=>{const el=p.getByText(t,{exact:false}).first(); if(await el.isVisible({timeout:2500}).catch(()=>false)){await el.click({force:true}).catch(()=>{}); await p.waitForTimeout(czekaj); return true;} return false;};
const jest=async t=>(await p.evaluate(x=>(document.body.innerText||'').includes(x),t).catch(()=>false));

await p.goto(`${BASE}/login`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(2500);
await p.fill('input[type="email"]','james.whitfield@northwind.example'); await p.fill('input[type="password"]',PW);
await p.click('button[type="submit"]'); await p.waitForTimeout(9000);
await p.evaluate(()=>{localStorage.setItem('i18nextLng','en');for(const k of ['demo_tour_skipped','demo_tour_completed','teresa_onboarding_dismissed','consultify_teresa_onboarding_seen'])localStorage.setItem(k,'1');});
await p.reload({waitUntil:'domcontentloaded'}); await p.waitForTimeout(4000); net=[];

// ---------- 1. MOJA PRACA: zadanie ----------
console.log('\n### B4 MOJA PRACA (zadanie)');
await p.goto(`${BASE}/my-work`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(4000);
await klik('Tasks'); await zrzut('mp-00-lista');
const otw = await klik('New task')||await klik('New')||await klik('Add task')||await klik('Add');
console.log('  kreator otwarty:',otw);
await zrzut('mp-01-kreator');
const pola=await p.evaluate(()=>{const d=document.querySelector('[role="dialog"]')||document.body;return [...d.querySelectorAll('input,textarea')].map(i=>i.getAttribute('placeholder')||i.getAttribute('aria-label')||i.getAttribute('name')||'').filter(Boolean).slice(0,12);});
console.log('  pola:',JSON.stringify(pola));
const tytul=`${S} zadanie testowe`;
const inp=p.locator('[role="dialog"] input[type="text"], [role="dialog"] input:not([type]), [role="dialog"] textarea').first();
if(await inp.isVisible({timeout:2000}).catch(()=>false)){ await inp.fill(tytul); await p.waitForTimeout(500); }
await zrzut('mp-02-wypelniony');
await klik('Create')||await klik('Save')||await klik('Add'); flush('mp-utworz');
await p.waitForTimeout(3000); await zrzut('mp-03-po-utworzeniu');
console.log('  widoczny na liscie:', await jest(S));

// ---------- 2. REALIZACJA: decyzja ----------
console.log('\n### B4 REALIZACJA (decyzja)');
await p.goto(`${BASE}/execution`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(4000);
await klik('Decisions & risks'); await zrzut('re-00-lista');
console.log('  kreator otwarty:', await klik('New decision'));
await zrzut('re-01-kreator');
const pola2=await p.evaluate(()=>{const d=document.querySelector('[role="dialog"]')||document.body;return{h:(d.querySelector('h1,h2,h3')?.innerText||'').slice(0,60),pola:[...d.querySelectorAll('input,textarea,select')].map(i=>i.getAttribute('placeholder')||i.getAttribute('aria-label')||i.getAttribute('name')||i.tagName).filter(Boolean).slice(0,12),btn:[...d.querySelectorAll('button')].map(x=>(x.innerText||'').trim()).filter(Boolean).slice(0,12)};});
console.log('  '+JSON.stringify(pola2));
const inp2=p.locator('[role="dialog"] input[type="text"], [role="dialog"] input:not([type])').first();
if(await inp2.isVisible({timeout:2000}).catch(()=>false)){ await inp2.fill(`${S} decyzja testowa`); await p.waitForTimeout(500); }
await zrzut('re-02-wypelniony');
await klik('Create')||await klik('Save')||await klik('Add decision'); flush('re-utworz');
await p.waitForTimeout(3000); await zrzut('re-03-po-utworzeniu');
console.log('  widoczna na liscie:', await jest(S));

// ---------- 3. MATERIALY: dokument ----------
console.log('\n### B4 MATERIALY (dokument)');
await p.goto(`${BASE}/presentations`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(4000);
await klik('All'); await zrzut('ma-00-lista');
await klik('New material')||await klik('New presentation')||await klik('New');
await p.waitForTimeout(2500); await zrzut('ma-01-wybor-trybu');
console.log('  tryb Blank:', await klikTekst('Blank',5000));
await p.waitForTimeout(4000); await zrzut('ma-02-edytor');
console.log('  url po utworzeniu:', p.url().replace(BASE,''));
flush('ma-utworz');

// ---------- 4. INICJATYWY: kreator ----------
console.log('\n### B4 INICJATYWY (kreator 5 krokow)');
await p.goto(`${BASE}/initiatives`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(4000);
console.log('  kreator otwarty:', await klik('New initiative',false,4000));
await zrzut('in-01-kreator');
const kroki=await p.evaluate(()=>{const d=document.querySelector('[role="dialog"]')||document.body;return{h:(d.querySelector('h1,h2,h3')?.innerText||'').slice(0,80),btn:[...d.querySelectorAll('button')].map(x=>(x.innerText||'').trim().split('\n')[0]).filter(Boolean).slice(0,16)};});
console.log('  '+JSON.stringify(kroki));
console.log('  Next/Continue:', await klik('Next')||await klik('Continue'));
await p.waitForTimeout(2500); await zrzut('in-02-krok2');
flush('in-krok');
console.log('\nSTEMPEL='+S);
await b.close();
