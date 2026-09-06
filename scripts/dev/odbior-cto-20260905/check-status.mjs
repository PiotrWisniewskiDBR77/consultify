import { chromium } from 'playwright';
import fs from 'node:fs';
const auth = process.env.ODBIOR_AUTH_STATE;
const browser = await chromium.launch({ headless: true });
const sesja = JSON.parse(fs.readFileSync(auth, 'utf8'));
const ctx = await browser.newContext({ storageState: sesja, viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto('http://localhost:3000/my-work', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
const res = await page.evaluate(async (id) => {
  const authToken = localStorage.getItem('token');
  const r = await fetch(`/api/ai/agent-plan/${id}`, { headers: authToken ? { Authorization: `Bearer ${authToken}` } : {} });
  return { status: r.status, body: await r.json().catch(()=>null) };
}, process.argv[2]);
console.log(JSON.stringify(res, null, 2));
await browser.close();
