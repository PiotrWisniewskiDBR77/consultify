/**
 * Visual proof: full nav screenshots, before/after x light/dark, at 375px.
 * Run build.sh first to produce compiled.css. Usage: node screenshot.cjs
 */
const path = require('path');
const REPO_ROOT = path.join(__dirname, '../../../../..');
const { chromium } = require(path.join(REPO_ROOT, 'node_modules/playwright'));
const FIXTURE_URL = 'file://' + path.join(__dirname, 'fixture.html');

async function run() {
  const browser = await chromium.launch();
  for (const theme of ['light', 'dark']) {
    for (const variant of ['before', 'after']) {
      const page = await browser.newPage({ viewport: { width: 375, height: 200 } });
      await page.goto(FIXTURE_URL);
      if (theme === 'dark') await page.evaluate(() => document.documentElement.classList.add('dark'));
      await page.evaluate((v) => {
        document.getElementById('before').style.display = v === 'before' ? '' : 'none';
        document.getElementById('after').style.display = v === 'after' ? '' : 'none';
      }, variant);
      await page.waitForTimeout(350);
      const nav = page.locator(`#${variant}`);
      await nav.screenshot({ path: path.join(__dirname, `nav-${theme}-${variant}.png`) });
      await page.close();
    }
  }
  await browser.close();
  console.log('done');
}
run();
