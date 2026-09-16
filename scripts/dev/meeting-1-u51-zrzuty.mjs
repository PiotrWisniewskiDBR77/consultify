/**
 * MEETING-1 [U-51] evidence capture — real MeetingObjectPage in its real shell
 * (dev-render harness `meeting-1-u51`), EN, light + dark, 1440×900.
 *
 * Sections captured: Details · Minutes · Decisions & actions.
 * `mean_luma` guards against the "two files, one image" trap (light/dark must
 * differ); page errors / console errors / HTTP >= 400 fail the run.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import sharp from 'sharp';

const OUT = process.env.U51_OUT || 'evidence/meeting-1-u51/screens';
const BASE = process.env.U51_BASE_URL || 'http://127.0.0.1:4251';
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

async function capture({ theme, section }) {
  const name = `u51-en-${theme}-${section}`;
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const localErrors = [];
  // Dev-render nie ma backendu — te dwa zapytania 404-uja w KAZDYM ekranie
  // harnessu (OrgContext + rejestr flag) i nie dotycza karty spotkania.
  // Wpisane jawnie, zeby receipt nie chowal ich, ale tez nie zglaszal jako
  // bledu produktu.
  const SZUM_HARNESSU = ['/api/organizations/current', '/api/v8/admin/flags'];
  const szum = (text) => SZUM_HARNESSU.some((frag) => text.includes(frag));
  const harnessNoise = [];
  page.on('pageerror', (e) => localErrors.push(`pageerror: ${String(e)}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    if (szum(text) || /Failed to load resource|\[OrgContext\]/.test(text)) {
      harnessNoise.push(`console: ${text}`);
      return;
    }
    localErrors.push(`console: ${text}`);
  });
  page.on('response', (r) => {
    if (r.status() < 400) return;
    (szum(r.url()) ? harnessNoise : localErrors).push(`http ${r.status()}: ${r.url()}`);
  });

  await page.goto(
    `${BASE}/?screen=meeting-1-u51&lang=en&theme=${theme}&section=${section}&uwagi=0`,
    { waitUntil: 'domcontentloaded', timeout: 180000 }
  );
  await page.waitForSelector('[data-testid="meeting-object-page"]', { timeout: 180000 });
  // Menu 2 must exist — that is the whole point of U-51 item (1).
  await page.waitForSelector('[data-testid="nmode-menu2"]', { timeout: 30000 });
  await page.getByText('Weekly PMO Review').first().waitFor({ state: 'visible', timeout: 30000 });
  if (section === 'details') {
    await page
      .locator('[data-testid="meeting-participants"]')
      .getByText('James Whitfield')
      .waitFor({ state: 'visible', timeout: 30000 });
  }
  await page.waitForTimeout(700);

  const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  if ((theme === 'dark') !== isDark) localErrors.push(`theme mismatch: dark=${isDark}`);

  const filePath = `${OUT}/${name}.png`;
  await page.screenshot({ path: filePath, fullPage: false });
  const luma = Number((await meanLuma(filePath)).toFixed(1));
  captures.push({ name, theme, section, luma, errors: localErrors.length, harnessNoise: harnessNoise.length });
  errors.push(...localErrors.map((e) => `${name}: ${e}`));
  await page.close();
}

for (const theme of ['light', 'dark']) {
  for (const section of ['details', 'minutes', 'decisions']) await capture({ theme, section });
}

await browser.close();

// Anti-"duplicate instead of theme": every light shot must be brighter than
// its dark twin by a wide margin.
for (const section of ['details', 'minutes', 'decisions']) {
  const light = captures.find((c) => c.theme === 'light' && c.section === section);
  const dark = captures.find((c) => c.theme === 'dark' && c.section === section);
  if (!(light.luma > 150 && dark.luma < 100)) {
    errors.push(`luma gate ${section}: light=${light.luma} dark=${dark.luma}`);
  }
}

const receipt = { baseUrl: BASE, viewport: { width: 1440, height: 900 }, captures, errors };
writeFileSync(`${OUT}/capture-receipt.json`, JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt, null, 2));
if (errors.length) process.exit(1);
