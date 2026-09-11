import { chromium } from 'playwright';
import fs from 'node:fs';
const S='/private/tmp/claude-501/-Users-piotrwisniewski-Developer-Consultify/646e7b40-15a2-49d1-b55f-c3d22cf9b27c/scratchpad';
const s=JSON.parse(fs.readFileSync(`${S}/sesja-staging-owner.json`,'utf8'));
const b=await chromium.launch({headless:true});
async function proba(nazwa,{cookies=false,theme=null,colorScheme=undefined,locale=undefined}){
  const ctx=await b.newContext({viewport:{width:1440,height:900},colorScheme,locale});
  if(cookies) await ctx.addCookies(Object.entries(s.cookies||{}).map(([name,value])=>({name,value,domain:new URL(s.base).hostname,path:'/'})));
  await ctx.addInitScript(({ls,theme})=>{
    for(const[k,v]of Object.entries(ls))localStorage.setItem(k,v);
    if(theme){const raw=localStorage.getItem('consultify-storage');const o=raw?JSON.parse(raw):{state:{},version:0};o.state={...(o.state||{}),theme};localStorage.setItem('consultify-storage',JSON.stringify(o));}
  },{ls:{token:s.token,refreshToken:s.refreshToken,user:JSON.stringify(s.user)},theme});
  const p=await ctx.newPage();
  await p.goto(s.base+'/my-work',{waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForTimeout(26000);
  const r=await p.evaluate(()=>({len:document.getElementById('root')?.innerHTML.length??-1,txt:document.body.innerText.replace(/\s+/g,' ').slice(0,120),url:location.pathname}));
  console.log(nazwa.padEnd(34), 'rootLen=',String(r.len).padEnd(8),'url=',r.url,'txt=',JSON.stringify(r.txt));
  await ctx.close();
}
await proba('A goly (jak dbg)',{});
await proba('B +ciasteczka',{cookies:true});
await proba('C +motyw+colorScheme+locale',{theme:'light',colorScheme:'light',locale:'en-US'});
await b.close();
