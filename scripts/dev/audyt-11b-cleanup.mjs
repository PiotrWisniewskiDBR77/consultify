import { chromium } from 'playwright';
const AUTH = '/private/tmp/stanowisko-noc/auth-11b.json';
const BASE = 'http://127.0.0.1:3117';
const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: AUTH });
const page = await ctx.newPage();
await page.goto(`${BASE}/chat`, { waitUntil: 'networkidle', timeout: 30000 });

async function del(url) {
  const res = await page.evaluate(async (u) => {
    const token = localStorage.getItem('token');
    const r = await fetch(u, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    return { status: r.status, body: await r.text() };
  }, url);
  console.log(url, '->', res.status, res.body.slice(0,200));
}

// notebook pages created via message-level "Zapisz jako notatkę"
await del(`${BASE}/api/my-work/notebook/pages/8f982343-b831-4e2a-ac97-aa3f53e7493b`);

// idea created via message-level "Zapisz jako pomysł"
await del(`${BASE}/api/my-work/my-ideas/idea-1788688170012-d0h09t`);

await browser.close();
