import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const baseURL = 'http://127.0.0.1:4218';
const suffix = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
const email = `a-d2-pt19-${suffix}@example.com`;
const company = `A D2 P-T19 ${suffix}`;
const evidenceDir = '/Users/piotrwisniewski/Developer/codex-wt/a-d-d2-pilot-20260914/evidence/a-d2-pilot';
await fs.mkdir(evidenceDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const apiResponses = [];
page.on('response', (response) => {
  const url = response.url();
  if (url.includes('/api/auth/register') || url.includes('/api/v8/')) {
    apiResponses.push({ method: response.request().method(), path: new URL(url).pathname, status: response.status() });
  }
});

await page.goto(`${baseURL}/register`);
await page.waitForLoadState('networkidle');
await page.locator('input:not([type])').nth(0).fill('Pilot');
await page.locator('input:not([type])').nth(1).fill('P-T19');
await page.locator('input[type="email"]').first().fill(email);
await page.locator('input:not([type])').nth(2).fill(company);
await page.locator('input[type="password"]').first().fill('PilotP-T19!2026');
const checkbox = page.locator('input[type="checkbox"]').first();
if (await checkbox.count()) await checkbox.click();
const registerResponsePromise = page.waitForResponse(
  (r) => r.url().includes('/api/auth/register') && r.request().method() === 'POST',
  { timeout: 30000 },
);
await page.getByRole('button', { name: 'Create account & start' }).click();
const registerResponse = await registerResponsePromise;
const registerBody = await registerResponse.json().catch(() => ({}));
await page.waitForURL((url) => !url.pathname.includes('/register'), { timeout: 30000 });
const postRegistrationPath = new URL(page.url()).pathname;

const tourSkip = page.getByRole('button', { name: 'Skip for now' });
if ((await tourSkip.count()) && (await tourSkip.isVisible().catch(() => false))) await tourSkip.click();

const token = registerBody?.token ?? registerBody?.accessToken ?? null;
const organizationId = registerBody?.organization?.id ?? registerBody?.user?.organizationId ?? null;
const v8Result = await page.evaluate(async ({ token, organizationId }) => {
  const response = await fetch('/api/v8/interview/sessions', {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(organizationId ? { 'x-organization-id': organizationId } : {}),
    },
  });
  const body = await response.json().catch(() => null);
  return { status: response.status, code: body?.code ?? null, sessionCount: body?.data?.sessions?.length ?? null };
}, { token, organizationId });

await page.goto(`${baseURL}/assessment`);
await page.waitForLoadState('networkidle');
const assessmentTourSkip = page.getByRole('button', { name: 'Skip for now' });
if ((await assessmentTourSkip.count()) && (await assessmentTourSkip.isVisible().catch(() => false))) {
  await assessmentTourSkip.click();
  await page.waitForTimeout(300);
}
const assessmentUi = {
  path: new URL(page.url()).pathname,
  tabs: await page.getByRole('tab').allTextContents(),
  hasV8Unavailable: (await page.getByText(/V8.*unavailable|V8.*niedostęp/i).count()) > 0,
  bodyExcerpt: (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 500),
};
await page.screenshot({ path: `${evidenceDir}/pt19-fresh-org-no-v8-404.png`, fullPage: true });
const receipt = {
  timestamp: new Date().toISOString(),
  baseSha: '4de31efbcb0c286cdcbdb0251b10a894db02848d',
  registration: { status: registerResponse.status(), email, company, organizationId, tokenIssued: Boolean(token) },
  redirectPath: postRegistrationPath,
  v8Result,
  assessmentUi,
  apiResponses,
};
await fs.writeFile(`${evidenceDir}/pt19-browser-receipt.json`, `${JSON.stringify(receipt, null, 2)}\n`);
console.log(JSON.stringify(receipt, null, 2));
await browser.close();
