import fs from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.E2_RENDER_BASE || 'http://127.0.0.1:4216';
const out = 'evidence/f2-2-realizacja/e2-work';
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
const results = [];
const enableEvidenceFlags = () => {
  localStorage.setItem('ff.exec_reports_intel', '1');
  localStorage.setItem('ff.exec_work_analysis', '1');
};

// Warm the just-rebuilt preview once so the evidence contexts never observe
// stale hashed chunks while Vite swaps the output directory.
const warmContext = await browser.newContext();
await warmContext.addInitScript(enableEvidenceFlags);
const warmPage = await warmContext.newPage();
await warmPage.goto(`${base}/execution-work-analysis.html?report=work-shell&state=ready&lang=en&theme=light`, {
  waitUntil: 'networkidle',
  timeout: 60_000,
});
await warmContext.close();

for (const variant of ['ready', 'empty'].flatMap((state) =>
  ['en', 'pl'].flatMap((language) =>
    ['light', 'dark'].map((theme) => ({
      state,
      language,
      theme,
      file: `work-analysis-${state}-${language}-${theme}.png`,
    }))
  )
)) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(enableEvidenceFlags);
  const page = await context.newPage();
  const errors = [];
  page.on('console', (message) => message.type() === 'error' && errors.push(message.text()));
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push(`HTTP ${response.status()} ${response.url()}`);
  });

  await page.goto(
    `${base}/execution-work-analysis.html?report=work-shell&state=${variant.state}&lang=${variant.language}&theme=${variant.theme}`,
    { waitUntil: 'networkidle', timeout: 60_000 }
  );

  const reportPreset = page.getByText(
    variant.language === 'pl' ? 'Raport pracy' : 'Work report',
    { exact: true }
  );
  if ((await reportPreset.count()) === 0) {
    throw new Error(`${variant.language}: work report preset missing: ${await page.locator('body').innerText()}`);
  }
  await reportPreset.last().click();
  await page.waitForURL(/documentKind=intelligence/, { timeout: 30_000 });
  if (variant.state === 'empty') {
    await page.getByTestId('work-intelligence-report').waitFor();
    const rowMenus = page.locator(
      'button[aria-label="Akcje wiersza"], button[aria-label="Row actions"]'
    );
    if ((await rowMenus.count()) !== 0) {
      throw new Error(`${variant.language}/${variant.theme}: empty fixture rendered work rows`);
    }
  } else {
    await page.getByText('North plant transformation', { exact: true }).first().waitFor();
    const projectHeader = page.getByText(variant.language === 'pl' ? 'Projekt' : 'Project', {
      exact: true,
    });
    if ((await projectHeader.count()) === 0) {
      throw new Error(`${variant.language}/${variant.theme}: PROJECT column missing`);
    }

    const firstRowMenu = page
      .locator('button[aria-label="Akcje wiersza"], button[aria-label="Row actions"]')
      .first();
    await firstRowMenu.click();
    await page
      .getByRole('menuitem', {
        name: /Open preview|Otwórz podgląd/,
      })
      .click();

    const open = page.getByRole('button', {
      name: /^(Open|Otwórz)$/,
      exact: true,
    });
    if (!(await open.isEnabled())) throw new Error(`${variant.language}: preview Open is disabled`);
  }

  const body = await page.locator('body').innerText();
  for (const forbidden of ['project-north-plant', 'owner-one', 'owner-two']) {
    if (body.includes(forbidden)) throw new Error(`${variant.language}: raw identifier visible: ${forbidden}`);
  }

  await page.screenshot({ path: `${out}/${variant.file}`, fullPage: false });
  results.push({ ...variant, url: page.url(), errors });
  await context.close();
}

await browser.close();
if (results.some((result) => result.errors.length > 0)) {
  console.error(JSON.stringify(results, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify(results, null, 2));
}
