import { chromium } from 'playwright';
const AUTH = '/private/tmp/stanowisko-noc/auth-11b.json';
const BASE = 'http://127.0.0.1:3117';
const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: AUTH });
const page = await ctx.newPage();
await page.goto(`${BASE}/chat`, { waitUntil: 'networkidle', timeout: 30000 });
const res = await page.evaluate(async (u) => {
  const token = localStorage.getItem('token');
  const r = await fetch(u, { headers: { Authorization: `Bearer ${token}` } });
  return { status: r.status, body: await r.json().catch(()=>null) };
}, `${BASE}/api/my-work/notebook/pages?limit=20`);
console.log(JSON.stringify(res, null, 2).slice(0, 3000));
await browser.close();
