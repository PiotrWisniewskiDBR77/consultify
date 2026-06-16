/** Batch: list+preview wszystkich ekranów in-scope (light) + pomiar. Headless. */
import { chromium } from 'playwright';
import fs from 'node:fs';
const AUTH = JSON.parse(fs.readFileSync('/tmp/consultify-auth.json','utf8'));
const SCREENS = [
  ['My Work','Inbox'],['My Work','Calendar'],['My Work','Tasks'],['My Work','Decisions'],['My Work','Manager'],
  ['Interview','Inbox'],['Interview','Sessions'],['Interview','Assigned'],['Interview','Templates'],['Interview','Insights'],['Interview','Initiatives'],
  ['Tools','Library'],['Tools','Sessions'],['Tools','Reports & Presentations'],['Tools','Initiatives'],
  ['Initiatives','Portfolio'],['Initiatives','Analysis'],
  ['Execution','Summary'],['Execution','Rollout'],['Execution','Reporting'],['Execution','Management'],
  ['Results','Initiatives'],['Results','KPI'],['Results','KPI Reports'],['Results','ROI'],['Results','ROI Analysis'],
];
const slug=(s)=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
fs.mkdirSync('docs/qa/screens/review',{recursive:true});
const b=await chromium.launch();
const ctx=await b.newContext({viewport:{width:1500,height:950}});
await ctx.addInitScript((ls)=>{for(const k of Object.keys(ls))localStorage.setItem(k,ls[k]);},AUTH);
const p=await ctx.newPage();
const light=async()=>p.evaluate(()=>{try{const k='consultify-storage';const s=JSON.parse(localStorage.getItem(k)||'{}');if(s.state)s.state.theme='light';localStorage.setItem(k,JSON.stringify(s));}catch{}document.documentElement.classList.remove('dark');});
const settle=async(ms=4000)=>{try{await p.waitForLoadState('networkidle',{timeout:6000});}catch{}await p.waitForTimeout(ms);};
const out=[];
for (const [MOD,TAB] of SCREENS){
  const base=`docs/qa/screens/review/${slug(MOD)}-${slug(TAB)}`;
  try{
    await p.goto('http://localhost:3000/',{waitUntil:'domcontentloaded'}); await light(); await p.waitForTimeout(1200);
    await p.locator(`nav button[title="${MOD}"]`).first().click({timeout:9000}); await settle();
    await p.locator('main').getByRole('button',{name:TAB,exact:true}).first().click({timeout:6000}).catch(async()=>{await p.locator('main').getByText(TAB,{exact:true}).first().click({timeout:4000}).catch(()=>{});});
    await settle(3500); await light(); await p.mouse.move(700,500); await p.waitForTimeout(300);
    await p.screenshot({path:`${base}-list.png`});
    // preview: klik 1. wiersza
    let ok=false;
    for(const sel of ['main table tbody tr','main [role=row]']){const loc=p.locator(sel);if(await loc.count().catch(()=>0)){await loc.first().click({timeout:3500}).catch(()=>{});ok=true;break;}}
    await settle(2500); await light(); await p.mouse.move(700,500); await p.waitForTimeout(300);
    await p.screenshot({path:`${base}-preview.png`});
    const m=await p.evaluate(()=>{const open=[...document.querySelectorAll('button')].some(b=>/^\s*(Open|Otwórz)\s*$/.test(b.textContent||''));return {preview:open};});
    out.push(`OK ${slug(MOD)}-${slug(TAB)} preview=${m.preview}`);
  }catch(e){out.push(`FAIL ${slug(MOD)}-${slug(TAB)} :: ${String(e.message).slice(0,50)}`);}
}
await b.close();
console.log(out.join('\n'));
console.log('DONE '+out.filter(x=>x.startsWith('OK')).length+'/'+SCREENS.length);
