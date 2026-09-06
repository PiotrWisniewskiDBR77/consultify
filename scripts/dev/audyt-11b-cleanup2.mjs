import { chromium } from 'playwright';
const AUTH = '/private/tmp/stanowisko-noc/auth-11b.json';
const BASE = 'http://127.0.0.1:3117';
const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: AUTH });
const page = await ctx.newPage();
await page.goto(`${BASE}/chat`, { waitUntil: 'networkidle', timeout: 30000 });
async function del(u) {
  const res = await page.evaluate(async (u) => {
    const token = localStorage.getItem('token');
    const r = await fetch(u, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    return { status: r.status, body: await r.text() };
  }, u);
  console.log(u, '->', res.status, res.body.slice(0,150));
}
await del(`${BASE}/api/my-work/notebook/pages/22e7b751-2d4b-4ccf-ba91-a326e9e02138`);
await browser.close();
