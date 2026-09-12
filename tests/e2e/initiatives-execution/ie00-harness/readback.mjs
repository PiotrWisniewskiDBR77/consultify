import { chromium } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const dir = '/Users/piotrwisniewski/Developer/codex-wt/codex7-artefakty/ie00';
const tokens = JSON.parse(fs.readFileSync(`${dir}/local-test-tokens.json`));
const id = JSON.parse(fs.readFileSync(`${dir}/ui-create-receipt.json`)).body.response.initiativeId;
const off = process.env.IE00_EXPECT_OFF === 'true';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
await context.addInitScript((token) => {
  localStorage.setItem('token', token);
  localStorage.setItem('i18nextLng', 'en');
}, tokens['owner-1']);
const page = await context.newPage();
const evidence = { flag: off ? 'OFF' : 'ON', reads: [] };
try {
  for (const [name, view, initiativeId] of [
    ['list', 'hub', id],
    ['card', 'initiative', id],
    ['legacy', 'initiative', 'ie00-legacy-proof'],
  ]) {
    await page.goto(`http://127.0.0.1:5598/?view=${view}&initiativeId=${initiativeId}`);
    if (view === 'hub')
      await page.getByText('IE00 UI Definition vertical', { exact: true }).waitFor();
    else {
      await page.getByText('Gates', { exact: true }).click();
      await page.waitForTimeout(500);
    }
    await page.waitForTimeout(500);
    const text = await page.locator('body').innerText();
    const gate = await page.getByRole('region', { name: 'Definition approval' }).count();
    if (name === 'legacy' || off) assert.equal(gate, 0);
    else if (name === 'card') {
      assert.equal(gate, 1);
      assert.ok(text.includes('Initiative state: Defined'));
    } else assert.ok(text.includes('Defined'));
    evidence.reads.push({ name, text, definitionApprovalRegions: gate });
    await page.screenshot({ path: `${dir}/readback-${evidence.flag}-${name}.png`, fullPage: true });
  }
  evidence.status = 'PASS';
} catch (e) {
  evidence.status = 'FAIL';
  evidence.error = String(e);
  throw e;
} finally {
  fs.writeFileSync(`${dir}/readback-${evidence.flag}.json`, JSON.stringify(evidence, null, 2));
  await browser.close();
}
