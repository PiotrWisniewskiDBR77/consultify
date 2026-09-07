import { chromium } from 'playwright';
const BASE='http://localhost:3150';
const b=await chromium.launch();
const c=await b.newContext({viewport:{width:1440,height:900},colorScheme:'light',storageState:'/private/tmp/wt-zapisy/.auth-zapisy.json',locale:'pl-PL'});
const p=await c.newPage();
await p.goto(`${BASE}/initiatives`,{waitUntil:'domcontentloaded'});
await p.waitForTimeout(5000);
const w=p.locator('table tbody tr',{hasText:'Supply Chain Optimization'}).first();
await w.scrollIntoViewIfNeeded();await p.waitForTimeout(400);await w.dblclick();
await p.waitForTimeout(8000);
const info=await p.evaluate(()=>{
  const out=[];
  document.querySelectorAll('*').forEach(el=>{
    if(el.children.length===0 && (el.textContent||'').trim()==='Edycja'){
      let n=el, chain=[];
      for(let i=0;i<4&&n;i++){chain.push(`${n.tagName}${n.className?('.'+String(n.className).slice(0,60)):''}`);n=n.parentElement;}
      out.push(chain.join(' < '));
    }
  });
  return out;
});
console.log(JSON.stringify(info,null,1));
await b.close();
