import { chromium } from 'playwright';
const BASE='http://127.0.0.1:3187';
const b=await chromium.launch();const c=await b.newContext({viewport:{width:1440,height:900}});const p=await c.newPage();
await p.goto(`${BASE}/login`,{waitUntil:'domcontentloaded'});await p.waitForTimeout(2000);
await p.fill('input[type="email"]','piotr.wisniewski@dbr77.com');await p.fill('input[type="password"]','AudytDBR77!2026');
await p.click('button[type="submit"]');await p.waitForTimeout(7000);
await p.evaluate(()=>{try{const r=localStorage.getItem('consultify-storage');const j=r?JSON.parse(r):{state:{}};j.state=j.state||{};j.state.theme='light';localStorage.setItem('consultify-storage',JSON.stringify(j));}catch{}localStorage.setItem('i18nextLng','pl');const u=JSON.parse(localStorage.getItem('user')||'{}');if(u&&u.id)localStorage.setItem(`consultify_onboarding_done:${u.id}`,'1');});
await p.reload({waitUntil:'domcontentloaded'});await p.waitForTimeout(4000);
await c.storageState({path:'/private/tmp/wt-rev-real/auth-piotr.json'});console.log('ok');await b.close();
