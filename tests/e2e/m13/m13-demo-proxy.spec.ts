/**
 * M13 — SZEROKA analiza: real-data screenshots via local-frontend → demo-backend.
 *
 * demo.consultify.ai SPA nie hydratuje pod headless-cold Playwrightem → blank.
 * Renderujemy LOKALNY vite (niezawodny) + proxy /api → demo (real Railway demo
 * DB, NIE prod). Auth = Bearer token (localStorage 'token') → cross-origin proxy
 * uwierzytelnia jako Piotr na jego zasianej org demo.
 *
 * Run:
 *   VITE_API_TARGET=https://demo.consultify.ai npx vite --mode staging --port 3200 --strictPort  # background task
 *   E2E_BASE_URL=http://localhost:3200 E2E_API_URL=http://localhost:3200 \
 *     E2E_ALLOW_LOCALHOST_REMOTE=true npx playwright test tests/e2e/m13/m13-demo-proxy.spec.ts --workers=2
 *
 * Wymaga /tmp/m13_e2e_auth.json {token,org,uid} + /tmp/m13_e2e_init.txt (flagship id).
 */
import fs from 'node:fs';
import path from 'node:path';

import { expect, type Page, test } from '@playwright/test';

import { forceTheme } from './_m13';

const EXEC = path.resolve('docs/qa/screens/m13-exec');
const ERR = /Coś poszło nie tak|Something went wrong/i;
const PRESENT = fs.existsSync('/tmp/m13_e2e_auth.json');
const auth = PRESENT
  ? (JSON.parse(fs.readFileSync('/tmp/m13_e2e_auth.json', 'utf8')) as {
      token: string;
      org: string;
      uid: string;
    })
  : { token: '', org: '', uid: '' };
const FLAG = PRESENT ? fs.readFileSync('/tmp/m13_e2e_init.txt', 'utf8').trim() : '';

for (const a of ['initiatives', 'decisions', 'notifications', 'calendar', 'tasks'])
  fs.mkdirSync(path.join(EXEC, a), { recursive: true });

async function shot(page: Page, art: string, id: string) {
  await page.screenshot({ path: path.join(EXEC, art, `${id}.png`), fullPage: false });
}
async function injectAuth(page: Page) {
  await page.addInitScript(
    ({ token, uid, org }) => {
      try {
        localStorage.setItem('token', token);
        localStorage.setItem('authToken', token);
        if (org) localStorage.setItem('consultify_current_org_id', org);
        if (uid) localStorage.setItem(`consultify_onboarding_done:${uid}`, 'true');
      } catch {
        /* ignore */
      }
    },
    auth
  );
}
async function dismiss(page: Page) {
  for (let i = 0; i < 3; i += 1) {
    let acted = false;
    for (const re of [/Skip|Pomiń/i, /Get started|Rozpocznij|Consultant|Konsultant/i]) {
      const b = page.getByRole('button', { name: re }).first();
      if (await b.isVisible().catch(() => false)) {
        await b.click({ timeout: 1000, force: true }).catch(() => {});
        acted = true;
      }
    }
    await page.keyboard.press('Escape').catch(() => {});
    if (!acted) break;
    await page.waitForTimeout(250);
  }
}
async function goHub(page: Page) {
  await page.goto('/portfolio', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await dismiss(page);
  await page
    .getByText(/New initiative|Nowa inicjatywa/i)
    .first()
    .waitFor({ state: 'visible', timeout: 45000 })
    .catch(() => {});
  await page.waitForTimeout(1200);
}
async function openDoc(page: Page) {
  await page.goto(`/portfolio?open=${FLAG}&mode=doc`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await dismiss(page);
  await page
    .getByText(/Initiative Scope|^Tasks$|^Zadania$|Description.*Context|Opis.*Kontekst/i)
    .first()
    .waitFor({ state: 'visible', timeout: 45000 })
    .catch(() => {});
  await page.waitForTimeout(1500);
}
async function openSection(page: Page, label: string) {
  const nav = page.locator('nav, [data-section-nav], aside').getByText(label, { exact: true }).first();
  if (await nav.isVisible({ timeout: 6000 }).catch(() => false)) {
    await nav.click({ force: true }).catch(() => {});
    await page.waitForTimeout(1100);
  }
}

test.describe('M13 — szeroka analiza real-data (local FE → demo BE)', () => {
  test.skip(!PRESENT, '/tmp/m13_e2e_auth.json absent');
  test.setTimeout(150000);
  test.beforeEach(async ({ page }) => {
    await injectAuth(page);
  });

  // ───── INICJATYWY: widoki huba ─────
  test('INI hub — kanban active + All + view toggles', async ({ page }) => {
    await goHub(page);
    await expect(page.locator('body')).not.toContainText(ERR);
    await shot(page, 'initiatives', 'real-ini-hub');
    const all = page.getByRole('button', { name: /^All$|^Wszystkie$/i }).first();
    if (await all.isVisible().catch(() => false)) {
      await all.click({ force: true }).catch(() => {});
      await page.waitForTimeout(1000);
      await shot(page, 'initiatives', 'real-ini-hub-all');
    }
    // view toggle icons (list/kanban/calendar/grid) — best-effort by position
    const toggles = page.locator('header button, [role="toolbar"] button');
    const n = await toggles.count().catch(() => 0);
    void n;
    for (const [name, re] of [
      ['real-ini-list', /list|lista/i],
      ['real-ini-grid', /grid|siatka/i],
      ['real-ini-timeline', /timeline|oś czasu/i],
    ] as const) {
      const b = page.getByRole('button', { name: re }).first();
      if (await b.isVisible().catch(() => false)) {
        await b.click({ force: true }).catch(() => {});
        await page.waitForTimeout(900);
        if (!(await page.locator('body').innerText()).match(ERR)) await shot(page, 'initiatives', name);
      }
    }
  });

  test('INI hub — Analysis tab (zasoby/portfolio)', async ({ page }) => {
    await goHub(page);
    const an = page.getByRole('tab', { name: /Analysis|Analiza/i }).first();
    const anBtn = page.getByRole('button', { name: /Analysis|Analiza/i }).first();
    const target = (await an.isVisible().catch(() => false)) ? an : anBtn;
    if (await target.isVisible().catch(() => false)) {
      await target.click({ force: true }).catch(() => {});
      await page.waitForTimeout(1500);
      await expect(page.locator('body')).not.toContainText(ERR);
      await shot(page, 'initiatives', 'real-ini-analysis');
    }
  });

  test('INI hub — dark + light', async ({ page }) => {
    await forceTheme(page, 'dark');
    await goHub(page);
    await shot(page, 'initiatives', 'real-ini-hub-dark');
    await forceTheme(page, 'light');
    await goHub(page);
    await shot(page, 'initiatives', 'real-ini-hub-light');
  });

  // ───── INICJATYWY: dokument + sekcje ─────
  test('INI document — flagship + kluczowe sekcje', async ({ page }) => {
    await openDoc(page);
    await expect(page.locator('body')).not.toContainText(ERR);
    await shot(page, 'initiatives', 'real-ini-document');
    for (const [label, name] of [
      ['Tasks', 'real-tsk-section'],
      ['Decisions', 'real-dec-section'],
      ['Gates', 'real-ini-gates'],
      ['Risk & RAID', 'real-ini-raid'],
      ['KPIs & Benefits', 'real-ini-kpis'],
      ['Financial Analysis', 'real-ini-financial'],
    ] as const) {
      await openSection(page, label);
      if (!(await page.locator('body').innerText()).match(ERR)) {
        const artifact = name.startsWith('real-tsk')
          ? 'tasks'
          : name.startsWith('real-dec')
            ? 'decisions'
            : 'initiatives';
        await shot(page, artifact, name);
      }
    }
  });

  // ───── KALENDARZ + GANTT (Timeline) ─────
  test('Timeline — Calendar month/week + Gantt (zoom/deps/critical)', async ({ page }) => {
    await openDoc(page);
    await openSection(page, 'Timeline');
    const cal = page.getByRole('button', { name: /^Calendar$|^Kalendarz$/i }).first();
    if (await cal.isVisible({ timeout: 8000 }).catch(() => false)) {
      await cal.click({ force: true });
      await page.waitForTimeout(1300);
      await shot(page, 'calendar', 'real-cal-month');
      const week = page.getByRole('button', { name: /^Week$|^Tydzień$/i }).first();
      if (await week.isVisible().catch(() => false)) {
        await week.click({ force: true });
        await page.waitForTimeout(900);
        await shot(page, 'calendar', 'real-cal-week');
      }
    }
    const gantt = page.getByRole('button', { name: /^Gantt$/i }).first();
    if (await gantt.isVisible().catch(() => false)) {
      await gantt.click({ force: true });
      await page.waitForTimeout(1300);
      await shot(page, 'calendar', 'real-gantt-deps-critical');
      // zoom day + month
      for (const [z, nm] of [
        [/^Day$|^Dzień$/i, 'real-gantt-zoom-day'],
        [/^Month$|^Miesiąc$/i, 'real-gantt-zoom-month'],
      ] as const) {
        const zb = page.getByRole('button', { name: z }).first();
        if (await zb.isVisible().catch(() => false)) {
          await zb.click({ force: true }).catch(() => {});
          await page.waitForTimeout(700);
          await shot(page, 'calendar', nm);
        }
      }
    }
  });

  test('Timeline — Calendar dark + light', async ({ page }) => {
    await forceTheme(page, 'dark');
    await openDoc(page);
    await openSection(page, 'Timeline');
    let cal = page.getByRole('button', { name: /^Calendar$|^Kalendarz$/i }).first();
    if (await cal.isVisible({ timeout: 8000 }).catch(() => false)) {
      await cal.click({ force: true });
      await page.waitForTimeout(1100);
      await shot(page, 'calendar', 'real-cal-dark');
    }
    await forceTheme(page, 'light');
    await openDoc(page);
    await openSection(page, 'Timeline');
    cal = page.getByRole('button', { name: /^Calendar$|^Kalendarz$/i }).first();
    if (await cal.isVisible({ timeout: 8000 }).catch(() => false)) {
      await cal.click({ force: true });
      await page.waitForTimeout(1100);
      await shot(page, 'calendar', 'real-cal-light');
    }
  });

  // ───── TASKI dark/light ─────
  test('Tasks section — dark + light', async ({ page }) => {
    await forceTheme(page, 'dark');
    await openDoc(page);
    await openSection(page, 'Tasks');
    await shot(page, 'tasks', 'real-tsk-dark');
    await forceTheme(page, 'light');
    await openDoc(page);
    await openSection(page, 'Tasks');
    await shot(page, 'tasks', 'real-tsk-light');
  });

  // ───── DECYZJE dark/light ─────
  test('Decisions section — dark + light', async ({ page }) => {
    await forceTheme(page, 'dark');
    await openDoc(page);
    await openSection(page, 'Decisions');
    await shot(page, 'decisions', 'real-dec-dark');
    await forceTheme(page, 'light');
    await openDoc(page);
    await openSection(page, 'Decisions');
    await shot(page, 'decisions', 'real-dec-light');
  });

  // ───── GANTT: asercja DOM linii zależności + ścieżki krytycznej (D1b ROZWIĄZANE) ─────
  // Po D1 (backend: task-dependencies zwraca realne ID) + D1b opcja A
  // (TimelinePlanner.rows.dependsOnId wyprowadzony z task_dependencies) + fix
  // ganttDependencies (sourceTaskId+dedup) — OBA Gantty rysują linie z realnych
  // danych: TimelinePlanner (`<path stroke-dasharray="4 2">`) ORAZ InitiativeGantt
  // (`stroke #94a3b8|#f43f5e` + ścieżka krytyczna `.ring-rose-400`).
  test('Gantt — linie zależności + ścieżka krytyczna RENDERUJĄ (DOM, real-data)', async ({
    page,
  }) => {
    await openDoc(page);
    await openSection(page, 'Timeline');
    // Click every "Gantt" toggle (TimelinePlanner Table↔Gantt + scheduleView Calendar↔Gantt).
    const gbtns = page.getByRole('button', { name: /^Gantt$/i });
    const n = await gbtns.count();
    for (let i = 0; i < n; i += 1) {
      await gbtns
        .nth(i)
        .click({ force: true })
        .catch(() => {});
      await page.waitForTimeout(1200); // proxy latency: dependencies fetch + render
    }
    const counts = await page.evaluate(() => {
      const paths = Array.from(document.querySelectorAll('svg path')) as SVGPathElement[];
      const plannerDep = paths.filter(
        (p) => (p.getAttribute('stroke-dasharray') || '') === '4 2'
      ).length;
      const igDep = paths.filter((p) => {
        const s = (p.getAttribute('stroke') || '').toLowerCase();
        return s === '#94a3b8' || s === '#f43f5e';
      }).length;
      const critRings = document.querySelectorAll('.ring-rose-400').length;
      return { plannerDep, igDep, critRings };
    });
    // eslint-disable-next-line no-console
    console.log('[GANTT-DOM]', JSON.stringify(counts));
    await shot(page, 'calendar', 'real-gantt-deps-critical');
    expect(
      counts.plannerDep + counts.igDep,
      'linie zależności renderują (TimelinePlanner lub InitiativeGantt)'
    ).toBeGreaterThan(0);
    expect(counts.critRings, 'ścieżka krytyczna wyróżniona (ring-rose)').toBeGreaterThan(0);
  });

  // ───── NOTYFIKACJE: centrum in-app ─────
  test('Notifications — centrum in-app (My Work)', async ({ page }) => {
    for (const url of ['/my-work?tab=notifications', '/notifications', '/my-work']) {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
      await dismiss(page);
      await page.waitForTimeout(1500);
      if (!(await page.locator('body').innerText()).match(ERR)) break;
    }
    await shot(page, 'notifications', 'real-not-center');
  });
});
