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
}, `${BASE}/api/my-work/notebook/pages?limit=200`);
const mine = (res.body || []).filter(n => n.createdAt && n.createdAt.startsWith('2026-09-06'));
console.log('today notes count:', mine.length);
for (const n of mine) console.log(n.id, '|', n.title.slice(0,60), '|', n.createdAt);
await browser.close();
