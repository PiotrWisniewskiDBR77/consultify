import { chromium } from 'playwright';
const S='/private/tmp/claude-501/-Users-piotrwisniewski-Developer-Consultify/c567f897-e8c7-489d-89b6-c2d26dd765cf/scratchpad';
const OUT='/private/tmp/wt-fable-inicjatywy/evidence/odbior-noc-0809/realizacja/37-lista-pigulka-wstrzymana.png';
const b=await chromium.launch(); const c=await b.newContext({viewport:{width:1440,height:900},colorScheme:'light',storageState:`${S}/auth-audyt.json`,locale:'pl-PL'});
const p=await c.newPage(); const errs=[]; p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,200))});
await p.goto('http://localhost:3184/',{waitUntil:'domcontentloaded'});
await p.evaluate(()=>{const K='consultify-storage';const r=localStorage.getItem(K);const o=r?JSON.parse(r):{state:{},version:0};o.state={...(o.state||{}),theme:'light'};localStorage.setItem(K,JSON.stringify(o));});
await p.goto('http://localhost:3184/execution',{waitUntil:'domcontentloaded'}); await p.waitForTimeout(2500);
const pomin=p.getByText('Pomiń na razie',{exact:true}); if(await pomin.first().isVisible({timeout:1500}).catch(()=>false)){await pomin.first().click({force:true});await p.waitForTimeout(500);}
await p.waitForSelector('table tbody tr',{timeout:20000});
const n=await p.locator('table tbody tr').filter({hasText:'Wstrzymana'}).count();
const total=await p.locator('table tbody tr').count();
await p.screenshot({path:OUT});
console.log(JSON.stringify({wierszeWstrzymana:n,wierszy:total,bledyKonsoli:errs,url:p.url()}));
await b.close();
