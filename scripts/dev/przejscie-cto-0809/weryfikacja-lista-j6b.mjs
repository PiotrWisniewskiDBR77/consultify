import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
const BASE='http://127.0.0.1:3207'; const OUT='/private/tmp/wt-fable-inicjatywy/evidence/jezyk-j6';
const sql=(q)=>execSync(`docker exec consultify-pg18 psql -U postgres -d consultify_kopia_final -Atc "${q.replace(/"/g,'\\"')}"`,{encoding:'utf8'}).trim();
const b=await chromium.launch(); const c=await b.newContext({viewport:{width:1440,height:900},colorScheme:'light',locale:'pl-PL'}); const p=await c.newPage();
const errs=[]; p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,120))});
await p.goto(`${BASE}/login`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(1500);
await p.locator('input[type="email"]').first().fill('audyt@dbr77.local'); await p.locator('input[type="password"]').first().fill('AudytDBR77!2026'); await p.locator('input[type="password"]').first().press('Enter');
await p.waitForURL(u=>!String(u).includes('/login'),{timeout:30000}); await p.waitForTimeout(1500);
await p.evaluate(()=>{const K='consultify-storage';const r=localStorage.getItem(K);const o=r?JSON.parse(r):{state:{},version:0};o.state={...(o.state||{}),theme:'light'};localStorage.setItem(K,JSON.stringify(o));});
async function shot(lang){ sql(`UPDATE users SET language='${lang}' WHERE email='audyt@dbr77.local'`); await p.evaluate((l)=>localStorage.setItem('i18nextLng',l),lang);
  await p.goto(`${BASE}/initiatives`,{waitUntil:'networkidle'}); await p.waitForSelector('table tbody tr',{timeout:30000}); await p.waitForTimeout(2500);
  const pomin=p.getByText(lang==='pl'?'Pomiń na razie':'Skip for now',{exact:true}); if(await pomin.first().isVisible({timeout:800}).catch(()=>false)){await pomin.first().click({force:true});await p.waitForTimeout(400);}
  await p.screenshot({path:`${OUT}/10-lista-${lang}-cto.png`});
  const menu2=await p.locator('button:has-text("Plan")').first().evaluate(e=>getComputedStyle(e).opacity);
  const chip=await p.locator('main button, main [role=button]').filter({hasText:/^(Wszystkie|All)/}).first().innerText().catch(()=>'BRAK');
  console.log(JSON.stringify({lang,opacityPlan:menu2,chipAll:chip.replace(/\s+/g,' '),bledy:errs.length}));
}
await shot('pl'); await shot('en'); sql(`UPDATE users SET language='pl' WHERE email='audyt@dbr77.local'`); await b.close();
