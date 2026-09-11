import { chromium } from 'playwright';
import fs from 'node:fs';
const S='/private/tmp/claude-501/-Users-piotrwisniewski-Developer-Consultify/646e7b40-15a2-49d1-b55f-c3d22cf9b27c/scratchpad';
const s=JSON.parse(fs.readFileSync(`${S}/sesja-staging-owner.json`,'utf8'));
const b=await chromium.launch({headless:true});
const c=await b.newContext({viewport:{width:1440,height:900},locale:'en-US'});
await c.addCookies(Object.entries(s.cookies).map(([name,value])=>({name,value,domain:'staging.consultify.ai',path:'/'})));
await c.addInitScript(ls=>{for(const[k,v]of Object.entries(ls))localStorage.setItem(k,v);},{token:s.token,refreshToken:s.refreshToken,user:JSON.stringify(s.user)});
const p=await c.newPage();
await p.goto(s.base+'/my-work',{waitUntil:'domcontentloaded'});
await p.waitForFunction(()=>document.getElementById('root')?.innerHTML.length>20000,null,{timeout:90000});
await p.waitForTimeout(4000);
const nav=await p.evaluate(()=>{
  const n=document.querySelector('nav')||document.querySelector('[role="navigation"]');
  return n?n.innerText:'BRAK NAV';
});
console.log('--- NAV TEKST ---\n'+nav);
// klik po kolei w pozycje menu i odczyt adresu
const etykiety=nav.split('\n').map(x=>x.trim()).filter(Boolean);
for(const e of etykiety){
  try{
    const loc=p.locator(`nav >> text="${e}"`).first();
    if(!(await loc.isVisible({timeout:500})))continue;
    await loc.click({timeout:3000}); await p.waitForTimeout(1400);
    console.log(`${e.padEnd(28)} -> ${p.url().replace(s.base,'')}`);
  }catch(err){console.log(`${e.padEnd(28)} -> [nieklikalne]`);}
}
await b.close();
