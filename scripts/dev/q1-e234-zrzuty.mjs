// Q1 P3 E2-E4 — full InitiativesHub evidence in EN/PL and light/dark.
// Usage: node scripts/dev/q1-e234-zrzuty.mjs [--port 4214]
import fs from 'node:fs';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const valueOf = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const port = valueOf('port', '4214');
const outputDirectory = 'evidence/q1-p3-workload';
fs.mkdirSync(outputDirectory, { recursive: true });

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
const captures = [
  ...['en', 'pl'].flatMap((language) =>
    ['light', 'dark'].map((theme) => ({ language, theme, mode: 'proposals' }))
  ),
  { language: 'en', theme: 'light', mode: 'availability' },
  { language: 'en', theme: 'dark', mode: 'availability' },
  { language: 'pl', theme: 'light', mode: 'availability' },
];

for (const { language, theme, mode } of captures) {
    const context = await browser.newContext({ viewport: { width: 1720, height: 980 } });
    const page = await context.newPage();
    await page.route('**/favicon.ico', (route) =>
      route.fulfill({ status: 204, contentType: 'image/x-icon', body: '' })
    );
    const errors = [];
    page.on('console', (message) => message.type() === 'error' && errors.push(message.text()));
    page.on('pageerror', (error) => errors.push(String(error)));
    page.on('response', (response) => {
      if (response.status() >= 400) errors.push(`HTTP ${response.status()} ${response.url()}`);
    });

    const modeQuery = mode === 'proposals' ? 'openProposals=1' : 'openPreview=1';
    const url = `http://127.0.0.1:${port}/?screen=z30-inicjatywy-obciazenie&tab=capacity&e234=1&${modeQuery}&lang=${language}&theme=${theme}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    if (mode === 'proposals') {
      await page.waitForSelector('[data-testid="workload-proposals-panel"]', { timeout: 30_000 });
      await page
        .getByText(language === 'pl' ? 'Tylko planowanie' : 'Planning only')
        .first()
        .waitFor({ timeout: 10_000 });
    } else {
      await page
        .getByLabel(language === 'pl' ? 'Procent dostępności' : 'Availability percent')
        .waitFor({ timeout: 30_000 });
    }
    await page.waitForTimeout(500);

    const imagePath = `${outputDirectory}/e234-${mode}-${language}-${theme}.jpg`;
    await page.screenshot({ path: imagePath, type: 'jpeg', quality: 78, fullPage: false });
    fs.writeFileSync(
      `${imagePath}.json`,
      JSON.stringify({ url, errors, viewport: { width: 1720, height: 980 } }, null, 2)
    );
    console.log(`${imagePath}: errors=${errors.length}`);
    await context.close();
}
await browser.close();
