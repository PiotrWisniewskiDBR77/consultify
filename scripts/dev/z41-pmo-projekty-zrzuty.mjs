/**
 * S5 E3b evidence-only capture: MyProjects full/empty × EN/PL × light/dark.
 * Full fixtures must visibly show different requester and reviewer principals.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import sharp from 'sharp';

const OUT = process.env.Z41_OUT || 'evidence/s5-e3b/screens';
const BASE = process.env.Z41_BASE_URL || 'http://127.0.0.1:4214';
mkdirSync(OUT, { recursive: true });

async function meanLuma(filePath) {
  const { data, info } = await sharp(filePath).raw().toBuffer({ resolveWithObject: true });
  let sum = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return sum / (data.length / info.channels);
}

const browser = await chromium.launch();
const captures = [];
const errors = [];

async function capture({ lang, theme, state }) {
  const name = `s5-e3b-${lang}-${theme}-${state}`;
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const localErrors = [];
  page.on('pageerror', (error) => localErrors.push(`pageerror: ${String(error)}`));
  page.on('console', (message) => {
    if (message.type() === 'error') localErrors.push(`console: ${message.text()}`);
  });
  page.on('response', (response) => {
    if (response.status() >= 400) localErrors.push(`http ${response.status()}: ${response.url()}`);
  });

  await page.goto(
    `${BASE}/?screen=z41-pmo-projekty&lang=${lang}&theme=${theme}&state=${state}&uwagi=0`,
    { waitUntil: 'load', timeout: 45000 }
  );
  await page.waitForSelector('table', { timeout: 20000 });

  if (state === 'full') {
    await page.click('table tbody tr');
    const heading = page.getByText(lang === 'pl' ? 'Wejścia do akceptacji' : 'Approval inputs', {
      exact: true,
    });
    await heading.waitFor({ state: 'visible', timeout: 20000 });
    await heading.scrollIntoViewIfNeeded();
    const requester = lang === 'pl' ? 'Wnioskodawca bramki etapu' : 'Stage-gate requester';
    const reviewer = lang === 'pl' ? 'Osoba zatwierdzająca biznesowo' : 'Business approver';
    await page.locator('li').filter({ hasText: requester }).filter({ hasText: 'Piotr Wiśniewski' })
      .waitFor({ state: 'visible' });
    await page.locator('li').filter({ hasText: reviewer }).filter({ hasText: 'Anna Kowalska' })
      .waitFor({ state: 'visible' });
  } else {
    const emptyText = lang === 'pl' ? /Brak projektów|Nie znaleziono projektów/i : /No projects/i;
    await page.getByText(emptyText).first().waitFor({ state: 'visible', timeout: 20000 });
  }

  await page.waitForTimeout(500);
  const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  if ((theme === 'dark') !== isDark) localErrors.push(`theme mismatch: dark=${isDark}`);

  const filePath = `${OUT}/${name}.png`;
  await page.screenshot({ path: filePath, fullPage: false });
  const luma = Number((await meanLuma(filePath)).toFixed(1));
  captures.push({ name, lang, theme, state, luma, errors: localErrors.length });
  errors.push(...localErrors.map((error) => `${name}: ${error}`));
  await page.close();
}

for (const lang of ['en', 'pl']) {
  for (const theme of ['light', 'dark']) {
    for (const state of ['full', 'empty']) await capture({ lang, theme, state });
  }
}

await browser.close();
const receipt = { baseUrl: BASE, viewport: { width: 1440, height: 900 }, captures, errors };
writeFileSync(`${OUT}/capture-receipt.json`, JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt, null, 2));
if (errors.length) process.exit(1);
