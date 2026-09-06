// Evidence capture — ZLECENIE 1.1-I (panel notatnika domyslnie zamkniety,
// sekcje zwiniete po otwarciu, edycja tytulu w miejscu).
// Uzywa REALNEJ aplikacji (nie dev-render harnessu) na porcie 3124, logujac
// sie prawdziwym kontem lokalnym audyt@dbr77.local — bo test dotyczy zywego
// stanu (localStorage/Zustand persist + prawdziwe PUT /api), nie statycznego
// mocka.
// Usage: node scripts/dev/11i-notatnik-screenshots.mjs
import fs from 'fs';
import { chromium } from 'playwright';

const BASE = process.env.APP_BASE_URL || 'http://127.0.0.1:3124';
const OUT = process.argv[2] || '/private/tmp/wt-11i/evidence/1-1-i';
const EMAIL = 'audyt@dbr77.local';
const PASSWORD = 'kir04NSqGjSa5hPB';

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();

const consoleErrors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
const badResponses = [];
page.on('response', (res) => {
  if (res.status() >= 400) badResponses.push(`${res.status()} ${res.url()}`);
});

// --- login ---
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 60000 });
await page.fill('input[type="email"], input[name="email"]', EMAIL).catch(async () => {
  const inputs = await page.locator('input').all();
  await inputs[0].fill(EMAIL);
});
await page.fill('input[type="password"], input[name="password"]', PASSWORD).catch(async () => {
  const inputs = await page.locator('input').all();
  await inputs[1].fill(PASSWORD);
});
await page.getByRole('button', { name: /log in/i }).click();
await page.waitForTimeout(1500);

// --- go straight to notebook ---
await page.goto(`${BASE}/my-work/notebook`, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(500);

// Open the first notebook, then the first (only) page.
const notebookRow = page.getByText('Moje notatki').first();
if (await notebookRow.count()) {
  await notebookRow.click();
  await page.waitForTimeout(700);
}

// If a page row exists in the left list, open it; else create a blank one.
const pageRow = page.locator('[class*="cursor-pointer"]').filter({ hasText: /./ }).first();
let opened = false;
try {
  const rows = await page.locator('aside, div').locator('text=/./').all();
} catch {}

// Simplify: look for a clickable note title in the left column list.
const noteListItem = page.locator('button, div').filter({ hasText: 'SEED' }).first();
if (await noteListItem.count()) {
  await noteListItem.click();
  opened = true;
  await page.waitForTimeout(600);
}

if (!opened) {
  // No page yet — create a Blank page from the template gallery.
  const newNoteBtn = page.getByRole('button', { name: /new note/i }).first();
  if (await newNoteBtn.count()) {
    await newNoteBtn.click();
    await page.waitForTimeout(400);
    const blank = page.getByText('Blank page').first();
    if (await blank.count()) {
      await blank.click();
      await page.waitForTimeout(700);
    }
  }
}

// Make sure the right panel is CLOSED before the (a) screenshot — close it if
// a previous run left it open (persisted via Zustand/localStorage).
const closeBtn = page.getByRole('button', { name: /close panel/i }).first();
if (await closeBtn.count()) {
  await closeBtn.click();
  await page.waitForTimeout(300);
  // Reload so we exercise the REAL "open a note" cold-start path, not just
  // the in-session close.
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const noteListItem2 = page.locator('button, div').filter({ hasText: 'SEED' }).first();
  if (await noteListItem2.count()) {
    await noteListItem2.click();
    await page.waitForTimeout(600);
  }
}

// (a) Note open, right panel CLOSED.
await page.screenshot({ path: `${OUT}/a-panel-zamkniety.png` });
console.log('saved a-panel-zamkniety.png');

// (b) Open the panel — ALL sections must render collapsed.
const openPanelBtn = page.getByRole('button', { name: /open side panel/i }).first();
if (await openPanelBtn.count()) {
  await openPanelBtn.click();
  await page.waitForTimeout(400);
}
await page.screenshot({ path: `${OUT}/b-panel-otwarty-sekcje-zwiniete.png` });
console.log('saved b-panel-otwarty-sekcje-zwiniete.png');

// (c) Click the title above the editor -> edit mode (select-all).
const titleInput = page.locator('input[placeholder="Untitled"]').first();
await titleInput.click();
await page.waitForTimeout(150);
await page.screenshot({ path: `${OUT}/c-tytul-tryb-edycji.png` });
console.log('saved c-tytul-tryb-edycji.png');

// (d) Type the new title, commit with Enter -> visible everywhere.
await page.keyboard.type('Q2 Strategy — Market expansion playbook');
await page.keyboard.press('Enter');
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/d-tytul-po-enter.png` });
console.log('saved d-tytul-po-enter.png');

// Reload to prove the title survived a real server round-trip.
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(600);
const noteListItem3 = page.locator('button, div').filter({ hasText: 'SEED' }).first();
if (await noteListItem3.count()) {
  await noteListItem3.click();
  await page.waitForTimeout(600);
}
await page.screenshot({ path: `${OUT}/e-tytul-po-odswiezeniu.png` });
console.log('saved e-tytul-po-odswiezeniu.png');

fs.writeFileSync(
  `${OUT}/console-network-log.json`,
  JSON.stringify({ consoleErrors, badResponses }, null, 2)
);
console.log('console errors:', consoleErrors.length, 'bad responses:', badResponses.length);

await browser.close();
