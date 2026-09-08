#!/usr/bin/env node
/**
 * D2b — zrzuty ewidencyjne (1440, jasny) dla modulu Audits: lista pakietow,
 * program z kryteriami, ustalenia. Loguje sie jako OWNER Northwind
 * (james.whitfield@northwind.example) na localhost:3212 / API 4194.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const outDir = '/private/tmp/wt-d2b/evidence/dane-pokazowe-en/d2b';
fs.mkdirSync(outDir, { recursive: true });

const EMAIL = 'james.whitfield@northwind.example';
const PASSWORD = process.argv[2];
if (!PASSWORD) {
  console.error('Usage: node zrzut-d2b-audyty.mjs <password>');
  process.exit(1);
}

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  colorScheme: 'light',
});
const page = await context.newPage();

page.on('console', (msg) => {
  if (msg.type() === 'error') console.log('[console:error]', msg.text());
});

await page.goto('http://localhost:3212/login', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1000);
await page.fill('input[type="email"]', EMAIL);
await page.fill('input[type="password"]', PASSWORD);
await page.click('button[type="submit"]');
await page.waitForTimeout(3000);

// Dismiss onboarding modal if present.
try {
  const skip = page.getByRole('button', { name: 'Skip for now' });
  if (await skip.isVisible({ timeout: 2000 })) await skip.click();
} catch {}
await page.waitForTimeout(500);

// Force LIGHT theme (task requires jasny/light screenshots) by patching the
// persisted zustand blob in-place (do NOT overwrite the whole key — it also
// carries currentUser/session bootstrap state) then reloading.
await page.evaluate(() => {
  try {
    const raw = window.localStorage.getItem('consultify-storage');
    const parsed = raw ? JSON.parse(raw) : { state: {}, version: 2 };
    parsed.state = parsed.state || {};
    parsed.state.theme = 'light';
    window.localStorage.setItem('consultify-storage', JSON.stringify(parsed));
  } catch (e) {
    console.error('theme patch failed', e);
  }
});
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3500);

// Navigate to Audits via sidebar (client-side route — direct URL nav loses SPA auth state).
const clicked = await page.evaluate(() => {
  const nav = document.querySelectorAll('nav')[0];
  if (!nav) return false;
  const btns = Array.from(nav.querySelectorAll('button'));
  const labels = btns.map((b) => b.getAttribute('title') || b.textContent.trim());
  const idx = labels.indexOf('Audits');
  if (idx < 0) return false;
  btns[idx].click();
  return true;
});
console.log('Clicked Audits nav:', clicked);
await page.waitForTimeout(2000);

const htmlClass = await page.evaluate(() => document.documentElement.className);
const storedTheme = await page.evaluate(() => {
  try { return JSON.parse(window.localStorage.getItem('consultify-storage')).state.theme; } catch { return 'ERR'; }
});
console.log('html class:', htmlClass, '| stored theme:', storedTheme);

// 1) Library — lista pakietow.
await page.screenshot({ path: `${outDir}/01-audyty-lista.png`, fullPage: false });
console.log('Saved 01-audyty-lista.png');

// Open the pack preview.
await page.click('text=Operational Excellence Audit 2026');
await page.waitForTimeout(1000);
await page.screenshot({ path: `${outDir}/02-audyty-pakiet-podglad.png`, fullPage: false });
console.log('Saved 02-audyty-pakiet-podglad.png');

// 2) Sessions — program.
await page.click('text=Sessions');
await page.waitForTimeout(1500);
await page.screenshot({ path: `${outDir}/03-audyty-sesje-lista.png`, fullPage: false });
console.log('Saved 03-audyty-sesje-lista.png');

// Open the program row.
try {
  await page.click('text=Line 3 Quality and Safety Audit', { timeout: 5000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${outDir}/04-audyty-program-podglad.png`, fullPage: false });
  console.log('Saved 04-audyty-program-podglad.png');
} catch (e) {
  console.log('Could not open program row:', e.message);
}

await browser.close();
