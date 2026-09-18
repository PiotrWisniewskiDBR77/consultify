import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const base = process.env.PMO1A_BASE_URL || 'http://127.0.0.1:4215';
const api = process.env.PMO1A_API_URL || 'http://127.0.0.1:4214/api';
const initiative = process.env.PMO1A_INITIATIVE_ID || '29b45f98-35d5-564c-a88e-ef917c3be2fb';
const initiativeTitle = process.env.PMO1A_INITIATIVE_TITLE || 'Energy Monitoring and ISO 50001';
const out = process.env.PMO1A_SCREENSHOT_PATH;
const theme = process.env.PMO1A_THEME || 'light';
const expectStage = process.env.PMO1A_EXPECT_STAGE !== 'false';
const expectBlockedReason = process.env.PMO1A_EXPECT_BLOCKED_REASON === 'true';
function readAccessFile(){
  const candidates=[process.env.PMO1A_DOSTEP_PATH, path.resolve(process.cwd(), 'DOSTEP.md'), '/Users/piotrwisniewski/Developer/cto-codex/DOSTEP.md', '/Users/piotrwisniewski/Developer/DOSTEP.md'].filter(Boolean);
  for(const candidate of candidates){ try{ if(fs.existsSync(candidate)) return fs.readFileSync(candidate,'utf8'); }catch{} }
  return '';
}
function readAccessValue(name){
  const access=readAccessFile();
  const re=new RegExp(`(?:^|\n)\\s*(?:export\\s+)?${name}\\s*=\\s*["']?([^"'\\n]+)`, 'm');
  const match=access.match(re);
  return match?.[1]?.trim() || '';
}
const loginPassword = process.env.PMO1A_REALPG_LOGIN_PASSWORD || readAccessValue('PMO1A_REALPG_LOGIN_PASSWORD') || readAccessValue('CODEX_LOCAL_PASSWORD') || readAccessValue('LOCAL_TEST_PASSWORD');
if (!loginPassword) throw new Error('PMO1A_REALPG_LOGIN_PASSWORD must be provided via env or DOSTEP.md');
if (!out) throw new Error('PMO1A_SCREENSHOT_PATH is required');

const loginResponse = await fetch(`${api}/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: 'james.whitfield@northwind.example', password: loginPassword }),
});
const login = await loginResponse.json();
if (!loginResponse.ok || !login.token) throw new Error(`login failed: ${loginResponse.status} ${JSON.stringify(login)}`);

const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const consoleMessages = [];
page.on('console', (msg) => {
  if (['error', 'warning'].includes(msg.type())) consoleMessages.push(`${msg.type()}: ${msg.text().slice(0, 240)}`);
});
page.on('pageerror', (err) => consoleMessages.push(`pageerror: ${err.message}`));

await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.evaluate(({ login, theme }) => {
  localStorage.setItem('token', login.token);
  localStorage.setItem('refreshToken', login.refreshToken || '');
  localStorage.setItem('user', JSON.stringify(login.user));
  localStorage.setItem('i18nextLng', 'en');
  localStorage.setItem(
    'consultify-storage',
    JSON.stringify({
      state: {
        currentUser: login.user,
        currentOrganization: { id: login.user.organizationId, name: login.user.companyName },
        sessionMode: 'full',
        theme,
        isSidebarCollapsed: true,
        isChatCollapsed: true,
      },
      version: 0,
    })
  );
}, { login, theme });

await page.goto(`${base}/initiatives?open=${initiative}&mode=doc`, { waitUntil: 'domcontentloaded' });
await page.getByText(initiativeTitle).first().waitFor({ timeout: 20000 });
if (expectStage) {
  const stageHeading = page.getByRole('heading', { name: /stage transition/i }).first();
  await stageHeading.waitFor({ timeout: 20000 });
  await stageHeading.scrollIntoViewIfNeeded();
}
await page.waitForTimeout(1500);
const bodyText = await page.locator('body').innerText({ timeout: 5000 });
const required = expectStage
  ? [initiativeTitle, 'STAGE TRANSITION', 'Decision log']
  : [initiativeTitle, 'Overview'];
for (const marker of required) {
  if (!bodyText.includes(marker)) throw new Error(`missing marker in shell: ${marker}`);
}
if (expectBlockedReason) {
  const reasonText = 'This transition is not supported by the PMO decision request yet.';
  if (!bodyText.includes(reasonText)) throw new Error(`missing blocked reason in shell: ${reasonText}`);
}
if (!expectStage && bodyText.includes('STAGE TRANSITION')) {
  throw new Error('OFF/OFF shell unexpectedly shows PMO Stage Transition panel');
}
await page.screenshot({ path: out, fullPage: false });
console.log(JSON.stringify({ out, theme, expectStage, expectBlockedReason, url: page.url(), markers: required, consoleWarnings: consoleMessages.length }, null, 2));
await browser.close();
