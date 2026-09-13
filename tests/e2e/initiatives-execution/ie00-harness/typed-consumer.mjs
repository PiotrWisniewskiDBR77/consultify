import { chromium } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const dir = '/Users/piotrwisniewski/Developer/codex-wt/codex7-artefakty/ie00';
const tokens = JSON.parse(fs.readFileSync(`${dir}/local-test-tokens.json`));
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
await context.addInitScript((token) => {
  localStorage.setItem('token', token);
  localStorage.setItem('i18nextLng', 'en');
}, tokens['definition-authority-1']);
const page = await context.newPage();
const evidence = { writes: [], genericOpens: [], status: 'RUNNING' };
page.on('request', (r) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(r.method()) && r.url().includes('/api/'))
    evidence.writes.push({ method: r.method(), url: r.url() });
});
try {
  await page.goto('http://127.0.0.1:5598/?view=decisions');
  const title = page.getByText('IE00 UI Definition vertical — Definition', { exact: true });
  await title.waitFor();
  const row = title.locator('xpath=ancestor::tr');
  fs.writeFileSync(`${dir}/typed-consumer-row.html`, await row.evaluate((el) => el.outerHTML));
  const checkbox = row.getByRole('checkbox');
  await checkbox.click();
  assert.equal(
    await checkbox.isChecked(),
    false,
    'native decision cannot enter generic bulk selection'
  );
  await title.dblclick();
  await page.getByRole('region', { name: 'Definition approval' }).waitFor();
  evidence.genericOpens = await page.evaluate(() => window.__ie00GenericDecisionOpens || []);
  assert.deepEqual(evidence.genericOpens, [], 'doubleclick remains in typed presenter');
  await page.getByText('Decision: Approved', { exact: true }).waitFor();
  evidence.previewText = await page
    .getByRole('region', { name: 'Definition approval' })
    .innerText();
  assert.ok(evidence.previewText.includes('Approved'));
  assert.equal(evidence.writes.filter((r) => r.url.includes('/decisions/')).length, 0);
  evidence.status = 'PASS';
  await page.screenshot({ path: `${dir}/typed-consumer.png`, fullPage: true });
} catch (e) {
  evidence.status = 'FAIL';
  evidence.error = String(e);
  throw e;
} finally {
  fs.writeFileSync(`${dir}/typed-consumer.json`, JSON.stringify(evidence, null, 2));
  await browser.close();
}
