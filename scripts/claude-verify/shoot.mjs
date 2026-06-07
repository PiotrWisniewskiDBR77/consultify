// Autonomous visual verification for Claude.
// Logs in programmatically via /api/auth/register-demo (no password typed),
// builds a Playwright storageState, then screenshots the given routes.
//
// Usage: node scripts/claude-verify/shoot.mjs <route> [name] [route2 name2 ...]
import fs from 'node:fs';
import { chromium } from '@playwright/test';

const API = process.env.E2E_API_URL || 'http://127.0.0.1:3001';
const FE = process.env.E2E_BASE_URL || 'http://localhost:3000';
const OUT = '/tmp/claude-shots';
fs.mkdirSync(OUT, { recursive: true });

async function getSession() {
  const email = `claude-verify-${Date.now()}@local.test`;
  const res = await fetch(`${API}/api/auth/register-demo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: `Verify-${Date.now()}-Pass1`, firstName: 'Claude' }),
  });
  if (!res.ok) throw new Error(`register-demo ${res.status}`);
  const p = await res.json();
  const token = p.token || p.accessToken;
  const user = p.user || {};
  return { token, userId: user.id, organizationId: user.organizationId, user };
}

function storageState(s) {
  const seededUser = {
    id: s.userId,
    email: s.user.email || 'claude@local.test',
    role: s.user.role || 'OWNER',
    organizationId: s.organizationId,
    organizationName: s.user.organizationName || 'Demo Org',
    firstName: 'Claude',
    lastName: 'Verify',
    isAuthenticated: true,
    accessLevel: 'full',
  };
  const persisted = JSON.stringify({
    state: { sessionMode: 'FULL', currentUser: seededUser, currentOrganization: { id: s.organizationId, name: seededUser.organizationName } },
    version: 0,
  });
  return {
    cookies: [],
    origins: [{
      origin: FE.replace(/\/$/, ''),
      localStorage: [
        { name: 'token', value: s.token },
        { name: 'accessToken', value: s.token },
        { name: 'refreshToken', value: 'claude-verify-refresh' },
        { name: 'user', value: JSON.stringify(seededUser) },
        { name: 'consultinity-storage', value: persisted },
      ],
    }],
  };
}

const args = process.argv.slice(2);
const routes = [];
for (let i = 0; i < args.length; i += 2) routes.push({ route: args[i], name: args[i + 1] || `shot${i}` });
if (!routes.length) routes.push({ route: '/audit-programs', name: 'audit-programs' });

const s = await getSession();
console.log('session:', s.userId ? 'OK' : 'NO-USER', '| org:', s.organizationId);
const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: storageState(s), viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });

for (const { route, name } of routes) {
  try {
    await page.goto(`${FE}${route}`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);
    // dismiss onboarding / welcome modals (fresh demo user)
    for (const sel of ['text=Skip for now', 'text=Pomiń', 'button:has-text("Skip")', '[aria-label="Close"]']) {
      try { const el = page.locator(sel).first(); if (await el.isVisible({ timeout: 500 })) { await el.click(); await page.waitForTimeout(400); } } catch {}
    }
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(1500);
    const file = `${OUT}/${name}.png`;
    await page.screenshot({ path: file, fullPage: false });
    console.log(`shot: ${route} -> ${file}`);
  } catch (e) {
    console.log(`FAIL ${route}: ${e.message}`);
  }
}
if (errors.length) console.log('console errors:', JSON.stringify([...new Set(errors)].slice(0, 6), null, 2));
await browser.close();
