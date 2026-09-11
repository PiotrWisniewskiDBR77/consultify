// ODBIÓR 2 (60051310d7) — PRZYRZĄD POPRAWIONY wzgl. odbior-staging-7e8668c7cc/harness.mjs:
//  (1) JEDEN browser.newContext() na CAŁĄ serię (zimny kontekst per ekran = 16× zimny start
//      = fałszywe „nie montuje się"; DIAGNOZA_W3_W4_20260911.md §6);
//  (2) nawigacja KLIENCKA (pushState + popstate) zamiast page.goto — mierzy to, co robi
//      użytkownik klikając menu, a nie 16 przeładowań aplikacji;
//  (3) warunek gotowości: #root > 20 000 zn. AND brak „Nie udało się wczytać danych na czas"
//      AND brak wskaźnika ładowania — timeout 60 s zamiast zegara;
//  (4) licznik żądań /api/ per ekran (pomiar N+1).
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const SCRATCH='/private/tmp/claude-501/-Users-piotrwisniewski-Developer-Consultify/646e7b40-15a2-49d1-b55f-c3d22cf9b27c/scratchpad';
const OUT=process.env.OUT_DIR||'/Users/piotrwisniewski/Developer/wt/odbior-2/evidence/odbior-2-60051310d7';
const manifest=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const konto=process.argv[3]||'owner';
const MOTYW=process.argv[4]||'light';
const sesja=JSON.parse(fs.readFileSync(`${SCRATCH}/sesja-staging-${konto}.json`,'utf8'));
const BASE=sesja.base;
fs.mkdirSync(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});
const ctx=await browser.newContext({viewport:{width:1440,height:900},colorScheme:MOTYW,locale:'en-US'});
await ctx.addCookies(Object.entries(sesja.cookies||{}).map(([name,value])=>({name,value,domain:new URL(BASE).hostname,path:'/'})));
await ctx.addInitScript(({theme,ls})=>{try{
  for(const [k,v] of Object.entries(ls)) localStorage.setItem(k,v);
  const raw=localStorage.getItem('consultify-storage');
  const obj=raw?JSON.parse(raw):{state:{},version:0};
  obj.state={...(obj.state||{}),theme};
  localStorage.setItem('consultify-storage',JSON.stringify(obj));
  if(theme==='dark')document.documentElement.classList.add('dark');
}catch(e){}},{theme:MOTYW,ls:{token:sesja.token,refreshToken:sesja.refreshToken,user:JSON.stringify(sesja.user)}});
const page=await ctx.newPage();
let bledy=[],http=[],apiReq=[];
page.on('console',m=>{if(m.type()==='error')bledy.push(m.text().slice(0,240));});
page.on('pageerror',e=>bledy.push('pageerror: '+String(e).slice(0,240)));
page.on('response',r=>{if(r.status()>=400)http.push({status:r.status(),method:r.request().method(),url:r.url().replace(BASE,'')});});
page.on('request',r=>{const u=r.url();if(u.includes('/api/'))apiReq.push(r.method()+' '+u.replace(BASE,''));});
// PUŁAPKA ZŁAPANA W TYM ODBIORZE: przy nawigacji klienckiej poprzedni ekran ZOSTAJE
// w DOM, więc warunek „root > 20 kB i brak kręciołka" jest spełniony NATYCHMIAST
// (zmierzone 3–18 ms, a /tools i /assessment miały identyczny root=91043 znaków).
// Dlatego warunek musi wymagać ZMIANY treści względem poprzedniego ekranu.
const GOTOWE=(prev)=>{
  const root=document.getElementById('root');
  if(!root||root.innerHTML.length<=20000)return false;
  const t=document.body.innerText||'';
  if(t.includes('Nie udało się wczytać danych na czas'))return false;
  if(/(^|\s)(Loading…|Loading\.\.\.|Ładowanie…|Ładowanie\.\.\.)(\s|$)/.test(t))return false;
  if(document.querySelectorAll('.animate-spin').length>0)return false;
  if(prev!==null&&prev!==undefined&&t===prev)return false;
  return true;
};
// stabilność: ta sama treść w 3 kolejnych sprawdzeniach co 400 ms
const STABILNE=(prev)=>{
  const root=document.getElementById('root');
  if(!root||root.innerHTML.length<=20000)return false;
  const t=document.body.innerText||'';
  if(t.includes('Nie udało się wczytać danych na czas'))return false;
  if(/(^|\s)(Loading…|Loading\.\.\.|Ładowanie…|Ładowanie\.\.\.)(\s|$)/.test(t))return false;
  if(document.querySelectorAll('.animate-spin').length>0)return false;
  if(prev!==null&&prev!==undefined&&t===prev)return false;
  const w=window;
  if(w.__odbPrev===t){w.__odbCount=(w.__odbCount||0)+1;return w.__odbCount>=3;}
  w.__odbPrev=t;w.__odbCount=0;return false;
};
// ---- ZIMNY START (raz, mierzony osobno) ----
const tCold=Date.now();
await page.goto(BASE+(manifest[0].url),{waitUntil:'domcontentloaded',timeout:60000});
let zimnyStart=null;
try{await page.waitForFunction(GOTOWE,null,{timeout:90000});zimnyStart=Date.now()-tCold;
  await page.waitForFunction(STABILNE,null,{timeout:60000,polling:400}).catch(()=>{});}
catch{bledy.push('ZIMNY START > 90 s');}
console.log(`ZIMNY START (${manifest[0].url}) = ${zimnyStart} ms  [konto ${konto}, motyw ${MOTYW}]`);
for(const sel of ['text=Skip for now','text=Pomiń na razie']){try{const l=page.locator(sel).first();if(await l.isVisible({timeout:700})){await l.click();await page.waitForTimeout(1200);}}catch{}}
const wyniki=[];
for(let i=0;i<manifest.length;i++){
  const poz=manifest[i];
  bledy=[];http=[];apiReq=[];
  const t0=Date.now();let tTresc=null;
  try{
    if(i===0){ /* juz jestesmy */ tTresc=zimnyStart; }
    else{
      // NAWIGACJA KLIENCKA — bez przeladowania aplikacji
      // Gdy cel jest tym samym adresem co poprzednia pozycja, treść się NIE zmieni
      // i warunek „tekst inny niż poprzednio" czekałby fałszywe 60 s (zmierzone
      // w przebiegu kart: 4 pozycje × 105 s). Wtedy nie wymagamy zmiany.
      const tenSam = manifest[i-1] && manifest[i-1].url===poz.url;
      const prevText=tenSam?null:await page.evaluate(()=>document.body.innerText||'');
      await page.evaluate(()=>{window.__odbPrev=null;window.__odbCount=0;});
      await page.evaluate(u=>{window.history.pushState({},'',u);window.dispatchEvent(new PopStateEvent('popstate'));},poz.url);
      try{await page.waitForFunction(GOTOWE,prevText,{timeout:60000,polling:150});tTresc=Date.now()-t0;}
      catch{bledy.push('EKRAN NIE POKAZAL NOWEJ TRESCI W 60 s');}
      try{await page.waitForFunction(STABILNE,prevText,{timeout:45000,polling:400});}
      catch{bledy.push('TRESC NIE USTABILIZOWALA SIE W 45 s');}
    }
    await page.waitForTimeout(poz.czekaj??2500);
    for(const krok of poz.kroki||[]){
      try{
        if(krok.klik)await page.locator(krok.klik).first().click({timeout:9000});
        else if(krok.wpisz)await page.locator(krok.wpisz).first().fill(krok.tekst,{timeout:9000});
        else if(krok.zdarzenie)await page.evaluate(({n,d})=>window.dispatchEvent(new CustomEvent(n,{detail:d})),{n:krok.zdarzenie,d:krok.detail});
        else if(krok.reload){const tR=Date.now();await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(GOTOWE,null,{timeout:90000}).catch(()=>bledy.push('PO RELOAD BRAK TRESCI 90 s'));bledy.push('INFO reload->tresc '+(Date.now()-tR)+' ms');}
        await page.waitForTimeout(krok.czekaj??2000);
      }catch(e){bledy.push(`KROK NIEUDANY ${JSON.stringify(krok).slice(0,80)}: ${String(e.message).split('\n')[0].slice(0,130)}`);}
    }
  }catch(e){bledy.push('NAWIGACJA: '+String(e.message).split('\n')[0].slice(0,200));}
  const ms=Date.now()-t0;
  const dom={};
  for(const [k,sel] of Object.entries(poz.dom||{})){try{dom[k]=await page.locator(sel).count();}catch{dom[k]='blad';}}
  let tekst='';try{tekst=(await page.locator('body').innerText()).replace(/\s+/g,' ').slice(0,1500);}catch{}
  let rootLen=0;try{rootLen=await page.evaluate(()=>document.getElementById('root')?.innerHTML.length||0);}catch{}
  const plik=`${poz.nazwa}-${MOTYW==='light'?'jasny':'ciemny'}.png`;
  try{await page.screenshot({path:path.join(OUT,plik),fullPage:!!poz.pelna});}catch(e){bledy.push('ZRZUT: '+e.message.slice(0,120));}
  const meta={nazwa:poz.nazwa,motyw:MOTYW,url:poz.url,urlKoncowy:page.url().replace(BASE,''),konto,
    bledyKonsoli:bledy.length,bledy,http4xx5xx:http,piatkiXX:http.filter(x=>x.status>=500).length,
    zadanApi:apiReq.length,apiReq:apiReq.slice(0,80),dom,msDoTresci:tTresc,msDoZrzutu:ms,rootLen,tekst,zimnyStart:i===0?zimnyStart:undefined};
  fs.writeFileSync(path.join(OUT,plik.replace('.png','.json')),JSON.stringify(meta,null,1));
  wyniki.push(meta);
  console.log(`${plik.padEnd(40)} tresc=${String(tTresc).padStart(6)}ms api=${String(apiReq.length).padStart(3)} konsola=${bledy.length} 4xx/5xx=${http.length}/${meta.piatkiXX} root=${rootLen} url=${meta.urlKoncowy.slice(0,42)}`);
  if(bledy.length)console.log('   BŁĘDY: '+bledy.slice(0,3).join(' || ').slice(0,380));
  if(http.length)console.log('   HTTP: '+http.slice(0,6).map(x=>`${x.status} ${x.method} ${x.url.slice(0,64)}`).join(' | '));
}
await ctx.close();await browser.close();
fs.writeFileSync(path.join(OUT,`_zbiorczo-${MOTYW}-${konto}.json`),JSON.stringify(wyniki,null,2));
console.log('\nGOTOWE:',wyniki.length,'→',OUT);
