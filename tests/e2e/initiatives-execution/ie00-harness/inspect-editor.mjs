import { chromium } from 'playwright';
import fs from 'node:fs';
const dir = '/Users/piotrwisniewski/Developer/codex-wt/codex7-artefakty/ie00';
const tokens = JSON.parse(fs.readFileSync(`${dir}/local-test-tokens.json`));
const id = JSON.parse(fs.readFileSync(`${dir}/ui-create-receipt.json`)).body.response.initiativeId;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
await page.addInitScript((token) => {
  localStorage.setItem('token', token);
  localStorage.setItem('i18nextLng', 'en');
}, tokens['owner-1']);
await page.goto(`http://127.0.0.1:5598/?view=initiative&initiativeId=${id}`);
await page.getByText('Gates', { exact: true }).click();
await page.getByText('Definition card content and review', { exact: true }).click();
await page.waitForTimeout(1000);
fs.writeFileSync(`${dir}/ui-editor.txt`, await page.locator('body').innerText());
fs.writeFileSync(
  `${dir}/ui-editor-controls.json`,
  JSON.stringify(
    await page
      .locator('label')
      .evaluateAll((ls) => ls.map((l) => ({ text: l.innerText, html: l.innerHTML }))),
    null,
    2
  )
);
fs.writeFileSync(`${dir}/ui-editor-aria.txt`, await page.locator('body').ariaSnapshot());
await page.screenshot({ path: `${dir}/ui-editor.png`, fullPage: true });
await browser.close();
