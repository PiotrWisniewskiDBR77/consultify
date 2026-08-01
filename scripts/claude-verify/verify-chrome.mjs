// Live chrome verification for the Insight + Initiative detail views.
// register-demo -> read REAL seeded ids from the API -> deep-link both detail
// views -> screenshot the sidebar/toolbar chrome. No password typed.
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
// Usage: node scripts/claude-verify/verify-chrome.mjs [suffix]
import fs from 'node:fs';
import { chromium } from '@playwright/test';

const API = process.env.E2E_API_URL || 'http://127.0.0.1:3001';
const FE = process.env.E2E_BASE_URL || 'http://localhost:3000';
const OUT = '/tmp/claude-shots';
const SUFFIX = process.argv[2] ? `-${process.argv[2]}` : '';
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

function storageState(s, projectId) {
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
    state: {
      sessionMode: 'FULL',
      currentUser: seededUser,
      currentOrganization: { id: s.organizationId, name: seededUser.organizationName },
      currentProjectId: projectId || null,
    },
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

async function getJson(path, token) {
  try {
    const r = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) return { ok: false, status: r.status };
    return { ok: true, json: await r.json() };
  } catch (e) {
    return { ok: false, status: String(e.message) };
  }
}

function pickList(payload, keys) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  for (const k of keys) if (Array.isArray(payload?.[k])) return payload[k];
  if (Array.isArray(payload?.data?.[keys[0]])) return payload.data[keys[0]];
  return [];
}

const s = await getSession();
console.log('session:', s.userId ? 'OK' : 'NO-USER', '| org:', s.organizationId);

// Pick a project so the PMO/Initiatives routes don't bounce to AI Chat.
let projectId = null;
for (const path of ['/api/projects', '/api/pmo/projects']) {
  const r = await getJson(path, s.token);
  const list = r.ok ? pickList(r.json, ['projects']) : [];
  console.log(`projects ${path}: ${r.ok ? list.length : 'ERR ' + r.status}`);
  if (list.length) { projectId = list[0].id; break; }
}
console.log('projectId:', projectId);

// Discover real seeded ids. Prefer an initiative inside the selected project.
let initiativeId = null;
const initPaths = projectId
  ? [`/api/initiatives?projectId=${projectId}`, '/api/initiatives']
  : ['/api/initiatives', '/api/pmo/initiatives'];
for (const path of initPaths) {
  const r = await getJson(path, s.token);
  const list = r.ok ? pickList(r.json, ['initiatives']) : [];
  console.log(`initiatives ${path}: ${r.ok ? list.length : 'ERR ' + r.status}`);
  if (list.length) {
    const inProj = projectId && list.find((i) => (i.projectId || i.project_id) === projectId);
    initiativeId = (inProj || list[0]).id;
    break;
  }
}
let insightId = null;
for (const path of ['/api/interview/insights', '/api/v8/interview/insights']) {
  const r = await getJson(path, s.token);
  const list = r.ok ? pickList(r.json, ['insights', 'items']) : [];
  console.log(`insights ${path}: ${r.ok ? list.length : 'ERR ' + r.status}`);
  if (list.length) { insightId = list[0].id || list[0].insightId; break; }
}
console.log('initiativeId:', initiativeId, '| insightId:', insightId);

const routes = [];
if (initiativeId) {
  const eid = encodeURIComponent(initiativeId);
  // Try every surface that mounts InitiativeDocumentView; capture the first with a nav.
  routes.push({ route: `/initiatives?open=${eid}&mode=doc`, name: `initiative-initiatives${SUFFIX}` });
  routes.push({ route: `/implementation?open=${eid}&mode=doc`, name: `initiative-implementation${SUFFIX}` });
  routes.push({ route: `/execution?open=${eid}&mode=doc`, name: `initiative-execution${SUFFIX}` });
}
if (insightId) routes.push({ route: `/interview?insightId=${encodeURIComponent(insightId)}`, name: `insight-detail${SUFFIX}` });
if (!routes.length) { console.log('NO IDS — nothing to shoot'); process.exit(2); }

const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: storageState(s, projectId), viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
// Patch console.error BEFORE app code so we capture the JS stack at the moment
// React logs "Maximum update depth" — the offending component/effect frame is in it.
await ctx.addInitScript(() => {
  try { Error.stackTraceLimit = 60; } catch {}
  const orig = console.error.bind(console);
  // @ts-ignore
  window.__cstack = [];
  console.error = function (...a) {
    try {
      if (String(a[0] || '').includes('Maximum update depth')) {
        // @ts-ignore
        if (window.__cstack.length < 3) window.__cstack.push(new Error('trace').stack || '');
      }
    } catch {}
    return orig(...a);
  };
});
const page = await ctx.newPage();
const errors = [];
const deep = [];
page.on('console', (m) => {
  if (m.type() !== 'error') return;
  const t = m.text();
  errors.push(t.slice(0, 200));
  if (/Maximum update depth|same key/.test(t)) {
    Promise.all(m.args().map((a) => a.jsonValue().catch(() => '?')))
      .then((vals) => {
        const stack = vals
          .map((v) => (typeof v === 'string' ? v : JSON.stringify(v)))
          .join(' | ');
        deep.push(`${t.slice(0, 300)}\nARGS: ${stack.slice(0, 1800)}`);
      })
      .catch(() => {});
  }
});
page.on('pageerror', (e) => { deep.push(`PAGEERROR: ${(e.stack || e.message || '').slice(0, 1500)}`); });

for (const { route, name } of routes) {
  try {
    await page.goto(`${FE}${route}`, { waitUntil: 'networkidle', timeout: 40000 });
    await page.waitForTimeout(2000);
    for (const sel of ['text=Skip for now', 'text=Pomiń', 'button:has-text("Skip")', '[aria-label="Close"]']) {
      try { const el = page.locator(sel).first(); if (await el.isVisible({ timeout: 500 })) { await el.click(); await page.waitForTimeout(400); } } catch {}
    }
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(2500);
    const file = `${OUT}/${name}.png`;
    await page.screenshot({ path: file, fullPage: false });
    console.log(`shot: ${route} -> ${file}`);
    try {
      const cs = await page.evaluate(() => window.__cstack || []);
      if (cs.length) deep.push(`MAX-DEPTH STACK @ ${name}:\n${cs[0]}`);
    } catch {}
    // Clipped, readable capture of just the section sidebar (the chrome under test).
    try {
      const nav = page.locator('nav.w-\\[242px\\]').first();
      if (await nav.isVisible({ timeout: 1500 })) {
        const navFile = `${OUT}/${name}-sidebar.png`;
        await nav.screenshot({ path: navFile });
        console.log(`sidebar: -> ${navFile}`);
      } else {
        console.log(`sidebar: nav.w-[242px] not visible for ${name}`);
      }
    } catch (e) {
      console.log(`sidebar FAIL ${name}: ${e.message}`);
    }
  } catch (e) {
    console.log(`FAIL ${route}: ${e.message}`);
  }
}
if (errors.length) console.log('console errors:', JSON.stringify([...new Set(errors)].slice(0, 6), null, 2));
if (deep.length) console.log('\n=== DEEP ===\n' + [...new Set(deep)].slice(0, 4).join('\n---\n'));
try {
  const cstack = await page.evaluate(() => (window.__cstack || []));
  if (cstack.length) console.log('\n=== MAX-DEPTH JS STACK ===\n' + cstack[0]);
} catch {}
await browser.close();
