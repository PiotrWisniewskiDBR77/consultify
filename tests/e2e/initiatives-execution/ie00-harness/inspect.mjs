import { chromium } from 'playwright';
import fs from 'node:fs';
const dir = '/Users/piotrwisniewski/Developer/codex-wt/codex7-artefakty/ie00';
const tokens = JSON.parse(fs.readFileSync(`${dir}/local-test-tokens.json`, 'utf8'));
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('response', (r) => {
  if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
});
await page.addInitScript((token) => {
  localStorage.setItem('token', token);
  localStorage.setItem('i18nextLng', 'en');
}, tokens['owner-1']);
await page.goto('http://127.0.0.1:5598/?view=hub', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);
await page.getByRole('button', { name: 'initiatives.form.newInitiative', exact: true }).click();
await page.getByText('Fill in the form', { exact: true }).click();
await page.locator('#initiatives-new-modal-title').fill('IE00 UI Definition vertical');
await page.getByRole('dialog').getByRole('combobox').first().selectOption('project-definition');
await page
  .getByRole('dialog')
  .locator('textarea')
  .fill('Reduce changeover time with explicit scope and independent evidence.');
const write = page
  .waitForResponse((r) => r.url().endsWith('/registrations') && r.request().method() === 'POST', {
    timeout: 20000,
  })
  .catch(() => null);
await page.getByRole('button', { name: 'initiatives.form.create', exact: true }).click();
const receipt = await write;
fs.writeFileSync(
  `${dir}/ui-create-receipt.json`,
  JSON.stringify(
    receipt
      ? { status: receipt.status(), body: await receipt.json() }
      : { error: 'No registration response' },
    null,
    2
  )
);

await page.waitForTimeout(2000);
fs.writeFileSync(
  `${dir}/ui-created.json`,
  JSON.stringify({ errors, text: await page.locator('body').innerText() }, null, 2)
);
await page.screenshot({ path: `${dir}/ui-created.png`, fullPage: true });
await browser.close();
