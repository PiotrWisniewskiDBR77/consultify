/**
 * Headless review helper: dla [module, tab, theme] robi LIST + PREVIEW screen.
 * Usage: node docs/qa/review-capture.mjs "My Work" "Notebook" light
 * Out: docs/qa/screens/review/{slug}-list.png + {slug}-preview.png + pomiar selekcji.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
const AUTH = JSON.parse(fs.readFileSync('/tmp/consultify-auth.json','utf8'));
const [MOD, TAB='', THEME='light'] = process.argv.slice(2);
const slug = (s)=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const base = `docs/qa/screens/review/${slug(MOD)}${TAB?'-'+slug(TAB):''}`;
fs.mkdirSync('docs/qa/screens/review',{recursive:true});

const b = await chromium.launch();
const ctx = await b.newContext({ viewport:{width:1500,height:950} });
await ctx.addInitScript((ls)=>{for(const k of Object.keys(ls))localStorage.setItem(k,ls[k]);}, AUTH);
const p = await ctx.newPage();
const setTheme=async()=>p.evaluate((t)=>{try{const k='consultify-storage';const s=JSON.parse(localStorage.getItem(k)||'{}');if(s.state)s.state.theme=t;localStorage.setItem(k,JSON.stringify(s||{state:{theme:t}}));}catch{}document.documentElement.classList.toggle('dark',t==='dark');},THEME);
const settle=async(ms=4500)=>{try{await p.waitForLoadState('networkidle',{timeout:6000});}catch{}await p.waitForTimeout(ms);};

await p.goto('http://localhost:3000/',{waitUntil:'domcontentloaded'});
await setTheme(); await p.waitForTimeout(1500);
await p.locator(`nav button[title="${MOD}"]`).first().click({timeout:9000});
await settle();
if (TAB) { await p.locator('main').getByRole('button',{name:TAB,exact:true}).first().click({timeout:6000}).catch(async()=>{await p.locator('main').getByText(TAB,{exact:true}).first().click({timeout:4000});}); await settle(3500); }
await setTheme(); await p.mouse.move(700,500); await p.waitForTimeout(400);
await p.screenshot({path:`${base}-list.png`});

// otwórz preview — klik pierwszego wiersza danych
let opened=false;
for (const sel of ['main table tbody tr','main [role=row]','main [data-row]','main li[role=button]']) {
  const loc = p.locator(sel);
  const n = await loc.count().catch(()=>0);
  if (n>0) { await loc.first().click({timeout:4000}).catch(()=>{}); opened=true; break; }
}
if(!opened){ // fallback: pierwszy klikalny tytuł w tabeli
  await p.locator('main button, main a').nth(8).click({timeout:4000}).catch(()=>{});
}
await settle(3000);
await setTheme(); await p.mouse.move(700,500); await p.waitForTimeout(400);
await p.screenshot({path:`${base}-preview.png`});

// pomiar: czy panel preview obecny + bg zaznaczonego wiersza
const m = await p.evaluate(()=>{
  const rose=[...document.querySelectorAll('*')].find(e=>{const c=getComputedStyle(e).backgroundColor.match(/\d+/g);return c&&+c[0]>235&&+c[0]-+c[1]>10&&+c[0]-+c[2]>10&&e.clientWidth>300&&e.clientHeight>20&&e.clientHeight<90;});
  const openBtn=[...document.querySelectorAll('button')].some(b=>/^\s*(Open|Otwórz)\s*$/.test(b.textContent||''));
  return {selBg: rose?getComputedStyle(rose).backgroundColor:'none', previewOpenBtn: openBtn};
});
await b.close();
console.log(JSON.stringify({list:`${base}-list.png`,preview:`${base}-preview.png`,...m}));
