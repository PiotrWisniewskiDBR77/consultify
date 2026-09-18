import { chromium } from 'playwright';

const url =
  process.env.RE3B_RENDER_URL || 'http://127.0.0.1:3237/dev-render/re3b-rollout-boundary.html';
const out =
  process.env.RE3B_RENDER_OUT ||
  '/Users/piotrwisniewski/Developer/cto-codex/a-re3b-w249/render-proof.json';
const screenshot =
  process.env.RE3B_RENDER_SCREENSHOT ||
  '/Users/piotrwisniewski/Developer/cto-codex/a-re3b-w249/rollout-boundary.png';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  colorScheme: 'light',
});
const errors = [];
page.on('pageerror', (err) => errors.push(String(err.message || err)));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});
await page.goto(url, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: /Risk Register/i }).click();
const badge = page.getByTestId('rollout-work-risk-boundary');
await badge.waitFor({ state: 'visible' });
const proof = {
  url,
  badgeText: await badge.innerText(),
  titleVisible: await page.getByText('Northwind rollout: Overdue by 22 days').isVisible(),
  screenshot,
  errors,
};
await page.screenshot({ path: screenshot, fullPage: true });
await browser.close();
await import('node:fs/promises').then((fs) => fs.writeFile(out, JSON.stringify(proof, null, 2)));
console.log(JSON.stringify(proof, null, 2));
if (
  !proof.titleVisible ||
  !/Work\/risk boundary/.test(proof.badgeText) ||
  !/red/i.test(proof.badgeText) ||
  !/L3/.test(proof.badgeText)
) {
  process.exit(1);
}
if (errors.length) process.exit(1);
