import { chromium } from 'playwright';
import fs from 'fs';
const OUT = process.env.OUT || '/tmp/shots';
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 } });
const p = await ctx.newPage();
const net = [];
p.on('console', m => { if (m.type()==='error') console.log('CONSOLE ERR:', m.text().slice(0,200)); });
p.on('response', r => { const u=r.url(); if (u.includes('/api/') && (r.status()>=400 || /runtime-v1|\/api\/projects/.test(u))) net.push(`${r.status()} ${r.request().method()} ${u.replace('http://127.0.0.1:5370','')}`); });
await p.goto('http://127.0.0.1:5370/login', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(3000);
await p.fill('input[type="email"]', 'pawel.mroczkowski@dbr77.com');
await p.fill('input[type="password"]', 'Local!Repro123');
await p.click('button[type="submit"]');
await p.waitForTimeout(7000);
// skip onboarding
for (const label of ['Skip for now','Skip','Close']) {
  const el = p.locator(`text="${label}"`).first();
  if (await el.count() && await el.isVisible().catch(()=>false)) { await el.click().catch(()=>{}); await p.waitForTimeout(1500); }
}
await p.goto('http://127.0.0.1:5370/initiatives', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(7000);
for (const label of ['Skip for now']) {
  const el = p.locator(`text="${label}"`).first();
  if (await el.count() && await el.isVisible().catch(()=>false)) { await el.click().catch(()=>{}); await p.waitForTimeout(1500); }
}
await p.screenshot({ path: `${OUT}/01-initiatives.png` });

// open New initiative menu
await p.locator('text=New initiative').first().click();
await p.waitForTimeout(1200);
await p.screenshot({ path: `${OUT}/02-menu.png` });
await p.locator('text=Fill in the form').first().click();
await p.waitForTimeout(2500);
await p.screenshot({ path: `${OUT}/03-modal-open.png` });

const dump = async (tag) => {
  const v = await p.evaluate(() => {
    const s = document.getElementById('required-project-picker');
    return s ? { value: s.value, selectedIndex: s.selectedIndex, text: s.options[s.selectedIndex]?.text, options: [...s.options].map(o=>o.value+'|'+o.text).slice(0,20) } : null;
  });
  console.log(tag, JSON.stringify(v));
};
await dump('AFTER_OPEN');

await p.fill('#initiatives-new-modal-title', 'Paweł repro — manual initiative');
await p.waitForTimeout(600);
await dump('AFTER_TITLE');

await p.selectOption('#required-project-picker', { label: 'DBR77 Digital Transformation' });
await p.waitForTimeout(900);
await dump('AFTER_PROJECT');
await p.screenshot({ path: `${OUT}/04-project-selected.png` });

await p.locator('textarea').first().fill('Short summary typed after selecting the project.');
await p.waitForTimeout(1500);
await dump('AFTER_SUMMARY');
await p.waitForTimeout(30000);
await dump('AFTER_30S_IDLE');
await p.screenshot({ path: `${OUT}/05-after-summary.png` });

// click Create
const create = p.locator('button', { hasText: /^Create$/ }).last();
await create.click();
await p.waitForTimeout(6000);
await dump('AFTER_CREATE');
await p.screenshot({ path: `${OUT}/06-after-create.png` });
const toasts = await p.evaluate(() => [...document.querySelectorAll('[class*=toast], [role=status], [role=alert]')].map(e=>e.textContent?.trim()).filter(Boolean));
console.log('TOASTS:', JSON.stringify(toasts));
console.log('NET:\n' + net.join('\n'));
await b.close();
