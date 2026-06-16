/** Preview-state capture light+dark + pomiar stopki/selekcji. Resilient na restart backendu. Headless. */
import { chromium } from 'playwright';
import fs from 'node:fs';
const AUTH=JSON.parse(fs.readFileSync('/tmp/consultify-auth.json','utf8'));
const SCREENS=[
 ['My Work','Inbox'],['My Work','Tasks'],['My Work','Decisions'],['My Work','Calendar'],
 ['Interview','Inbox'],['Interview','Sessions'],['Interview','Templates'],['Interview','Insights'],['Interview','Initiatives'],
 ['Tools','Library'],['Initiatives','Portfolio'],
 ['Execution','Summary'],['Results','Initiatives'],['Results','KPI'],
];
const slug=(s)=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
fs.mkdirSync('docs/qa/screens/preview',{recursive:true});
const b=await chromium.launch();
const ctx=await b.newContext({viewport:{width:1500,height:950}});
await ctx.addInitScript((ls)=>{for(const k of Object.keys(ls))localStorage.setItem(k,ls[k]);},AUTH);
const p=await ctx.newPage();
const theme=async(t)=>p.evaluate((x)=>{try{const k='consultify-storage';const s=JSON.parse(localStorage.getItem(k)||'{}');if(!s.state)s.state={};s.state.theme=x;localStorage.setItem(k,JSON.stringify(s));}catch{}document.documentElement.classList.toggle('dark',x==='dark');},t);
const settle=async(ms=3500)=>{try{await p.waitForLoadState('networkidle',{timeout:6000});}catch{}await p.waitForTimeout(ms);};
const out=[];
for(const [MOD,TAB] of SCREENS){
  const base=`docs/qa/screens/preview/${slug(MOD)}-${slug(TAB)}`;
  let done=false;
  for(let attempt=0;attempt<3&&!done;attempt++){
    try{
      await p.goto('http://localhost:3000/',{waitUntil:'domcontentloaded'}); await theme('light'); await p.waitForTimeout(1200);
      await p.locator(`nav button[title="${MOD}"]`).first().click({timeout:9000}); await settle();
      await p.locator('main').getByRole('button',{name:TAB,exact:true}).first().click({timeout:6000}).catch(async()=>{await p.locator('main').getByText(TAB,{exact:true}).first().click({timeout:4000}).catch(()=>{});});
      await settle();
      // open preview: 1. wiersz
      for(const sel of ['main table tbody tr','main [role=row]']){const l=p.locator(sel);if(await l.count().catch(()=>0)){await l.first().click({timeout:3500}).catch(()=>{});break;}}
      await settle(2500);
      await theme('light'); await p.mouse.move(700,500); await p.waitForTimeout(300);
      await p.screenshot({path:`${base}-light.png`});
      await theme('dark'); await p.waitForTimeout(700);
      await p.screenshot({path:`${base}-dark.png`});
      // pomiar
      const m=await p.evaluate(()=>{
        const rose=[...document.querySelectorAll('*')].find(e=>{const c=getComputedStyle(e).backgroundColor.match(/\d+/g);return c&&+c[0]>235&&+c[0]-+c[1]>10&&+c[0]-+c[2]>10&&e.clientWidth>300&&e.clientHeight>20&&e.clientHeight<90;});
        const openBtn=[...document.querySelectorAll('button')].some(b=>/^\s*(Open|Otwórz)\s*$/.test(b.textContent||''));
        return {selBg:rose?getComputedStyle(rose).backgroundColor:'none',openBtn};
      });
      out.push(`OK ${slug(MOD)}-${slug(TAB)} sel=${m.selBg} open=${m.openBtn}`); done=true;
    }catch(e){ if(attempt===2) out.push(`FAIL ${slug(MOD)}-${slug(TAB)} :: ${String(e.message).slice(0,40)}`); else await p.waitForTimeout(4000); }
  }
}
await b.close();
fs.writeFileSync('docs/qa/screens/preview/_measure.txt',out.join('\n'));
console.log(out.join('\n')); console.log('DONE '+out.filter(x=>x.startsWith('OK')).length+'/'+SCREENS.length);
