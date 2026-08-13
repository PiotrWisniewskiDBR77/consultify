// One-off role-diversity check for RN-G6 B2/B3 — NOT part of the repo, lives
// in the scratchpad. Logs in as each of the 5 seeded org-A users + the org-B
// admin, then tries /results/kpi?ff_resultsVNextKpi=1, and records whether
// the app bounced them to /interview (isPilotRestrictedRole gate) or let
// them see the real registry.
import { chromium } from 'playwright';

const BASE = 'http://localhost:3197';
const USERS = [
  { id: 'rn-g6-user-a-owner', concept: 'wlasciciel/OWNER' },
  { id: 'rn-g6-user-a-admin', concept: 'menedzer/ADMIN' },
  { id: 'rn-g6-user-a-contributor', concept: 'wspoltworca/MEMBER' },
  { id: 'rn-g6-user-a-reviewer', concept: 'recenzent/CONSULTANT' },
  { id: 'rn-g6-user-a-outsider', concept: 'obcy/GUEST' },
  { id: 'rn-g6-user-b-admin', concept: 'org-B admin (tenant isolation)' },
];

const browser = await chromium.launch();
const results = [];

for (const u of USERS) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 30000 }).catch(() => {});
  await page.locator('input').first().fill(`${u.id}@consultify.local`);
  await page.locator('input[type="password"]').first().fill('RnG6Runtime!2026');
  await page.locator('button:has-text("Log in")').first().click();
  await page.waitForTimeout(3000);

  await page.goto(`${BASE}/results/kpi?ff_resultsVNextKpi=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  const finalPath = await page.evaluate(() => window.location.pathname);
  const bodySnippet = await page.evaluate(() => document.body.innerText.slice(0, 150));

  // Also fetch /api/auth/me directly to see the effective role string.
  const meRole = await page.evaluate(async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      const j = await res.json();
      return { status: res.status, role: j.role ?? j.user?.role ?? null };
    } catch (e) {
      return { error: String(e) };
    }
  });

  results.push({ user: u.id, concept: u.concept, finalPath, meRole, bodySnippet });
  await context.close();
}

await browser.close();
console.log(JSON.stringify(results, null, 2));
