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
await p.waitForTimeout(3500);
const opisy=await p.evaluate(()=>[...document.querySelectorAll('button,[role="button"],a')].map((e,i)=>({i,t:(e.getAttribute('aria-label')||e.getAttribute('title')||e.innerText||'').replace(/\s+/g,' ').trim().slice(0,50),x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y})).filter(o=>o.t&&o.x<70));
console.log('LEWY PASEK:',JSON.stringify(opisy,null,1));
for(const o of opisy){
  try{const el=p.locator('button,[role="button"],a').nth(o.i);await el.click({timeout:2500});await p.waitForTimeout(1300);
   console.log(`${o.t.padEnd(30)} -> ${p.url().replace(s.base,'')}`);}catch(e){console.log(`${o.t.padEnd(30)} -> [nieklikalne]`);}
}
await b.close();
