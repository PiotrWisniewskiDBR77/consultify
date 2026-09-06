#!/usr/bin/env node
// PRZYRZĄD jednorazowy — inwentarz przycisków ekranu Czat AI + dokument obok (ZLECENIE 1.1-B).
// Ładuje sesję z auth-11b.json (origin 127.0.0.1:3117), otwiera /chat?workPanel=1,
// zbiera elementy button/[role=button] w 4 strefach i zapisuje JSON do evidence/1-1-b/.
import { chromium } from 'playwright';
import fs from 'node:fs';

const AUTH = '/private/tmp/stanowisko-noc/auth-11b.json';
const BASE = 'http://127.0.0.1:3117';
const OUT_DIR = '/private/tmp/wt-11b/evidence/1-1-b';
fs.mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: AUTH, viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const consoleErrors = [];
page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('pageerror', (err) => consoleErrors.push('pageerror: ' + err.message));

await page.goto(`${BASE}/chat?workPanel=1`, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2500);

// Confirm we're not on /login
const url = page.url();
fs.writeFileSync(`${OUT_DIR}/url-po-starcie.txt`, url + '\n');

await page.screenshot({ path: `${OUT_DIR}/00-start.png`, fullPage: false });

// If empty conversation and no document panel visible, try sending a message to trigger canvas open,
// or check for an existing conversation with a document. First check what's rendered.
const bodyText = await page.locator('body').innerText().catch(() => '');
fs.writeFileSync(`${OUT_DIR}/00-body-text.txt`, bodyText.slice(0, 5000));

await browser.close();
console.log('DONE start probe, url=', url);
