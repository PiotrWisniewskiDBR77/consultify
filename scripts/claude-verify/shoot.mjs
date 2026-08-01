// Autonomous visual verification for Claude.
// Logs in programmatically via /api/auth/register-demo (no password typed),
// builds a Playwright storageState, then screenshots the given routes.
//
// IMPORTANT — register-demo is the PUBLIC demo signup and is UNPRIVILEGED BY DESIGN:
// it mints a TEAM_MEMBER in the read-only demo org. Any route behind an admin/owner
// guard will redirect away and the screenshot will silently capture the WRONG page.
// assertPrivileged() below refuses to continue in that case; when you need to shoot a
// privileged route, mint the session with test-support bootstrap instead
// (POST /api/test-support/bootstrap with header x-test-support-key; requires
// ENABLE_TEST_SUPPORT=true and TEST_SUPPORT_KEY on the backend) — see
// tests/e2e/_helpers/privilegedSession.ts.
//
// Usage: node scripts/claude-verify/shoot.mjs <route> [name] [route2 name2 ...]
import fs from 'node:fs';
import { chromium } from '@playwright/test';

const API = process.env.E2E_API_URL || 'http://127.0.0.1:3001';
const FE = process.env.E2E_BASE_URL || 'http://localhost:3000';
const OUT = '/tmp/claude-shots';
// Roles that actually pass the admin/owner route guards.
const PRIVILEGED_ROLES = ['OWNER', 'ADMIN', 'SUPERADMIN'];
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

// Fail LOUDLY instead of screenshotting a redirect target. The old `role || 'OWNER'`
// default is dead: register-demo now returns a truthy, non-admin role.
function assertPrivileged(s) {
  const role = String(s.user?.role || '').toUpperCase();
  if (PRIVILEGED_ROLES.includes(role)) return role;
  throw new Error(
    [
      `claude-verify: register-demo returned role "${role || '<none>'}" — NOT privileged.`,
      'Admin/owner-guarded routes will redirect, so every screenshot would show the wrong page.',
      'register-demo is the public demo signup and is unprivileged by design (TEAM_MEMBER,',
      'read-only demo org). Mint the session via test-support bootstrap instead:',
      '  POST /api/test-support/bootstrap   header x-test-support-key: $TEST_SUPPORT_KEY',
      '  backend needs ENABLE_TEST_SUPPORT=true, TEST_SUPPORT_KEY=<>=12 chars>, NODE_ENV != production',
      'Reference implementation: tests/e2e/_helpers/privilegedSession.ts',
    ].join('\n')
  );
}

function storageState(s) {
  const role = assertPrivileged(s);
  const seededUser = {
    id: s.userId,
    email: s.user.email || 'claude@local.test',
    role,
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
