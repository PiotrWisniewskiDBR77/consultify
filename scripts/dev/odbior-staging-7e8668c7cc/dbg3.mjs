import { chromium } from 'playwright';
import fs from 'node:fs';
const S='/private/tmp/claude-501/-Users-piotrwisniewski-Developer-Consultify/646e7b40-15a2-49d1-b55f-c3d22cf9b27c/scratchpad';
const s=JSON.parse(fs.readFileSync(`${S}/sesja-staging-owner.json`,'utf8'));
const b=await chromium.launch({headless:true});
const ctx=await b.newContext({viewport:{width:1440,height:900}});
await ctx.addInitScript(({ls})=>{for(const[k,v]of Object.entries(ls))localStorage.setItem(k,v);},{ls:{token:s.token,refreshToken:s.refreshToken,user:JSON.stringify(s.user)}});
const p=await ctx.newPage();
p.on('response',async r=>{ if(r.status()>=400){ let t=''; try{t=(await r.text()).slice(0,200);}catch{} console.log('HTTP',r.status(),r.request().method(),r.url().replace(s.base,''),t);} });
await p.goto(s.base+'/my-work',{waitUntil:'load',timeout:60000});
for (const w of [5,10,15,25,35]) {
  await p.waitForTimeout(w===5?5000:(w-(w===10?5:w===15?10:w===25?15:25))*1000);
  const inf = await p.evaluate(()=>({len:document.getElementById('root')?.innerHTML.length??-1, txt:document.body.innerText.replace(/\s+/g,' ').slice(0,300), url:location.pathname}));
  console.log(`t=${w}s rootLen=${inf.len} url=${inf.url} txt="${inf.txt}"`);
}
await p.screenshot({path:'/tmp/dbg3.png'});
await b.close();
