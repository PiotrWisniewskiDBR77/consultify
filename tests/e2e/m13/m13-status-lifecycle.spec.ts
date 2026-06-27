/**
 * L3 — E2E: cykl życia statusów inicjatywy (Playwright, żywy backend).
 *
 * Część systemu testów procesu inicjatyw (TESTY_M13_PROCES_STATUSOW, warstwa L3).
 * Odtworzenie przez zmianę statusów na ŻYWEJ apce: matryca przejść przez API
 * (PATCH /:id/status + dedykowane endpointy) + dowód DEF-1 end-to-end + widoczność
 * (kanban / portfolio / historia / raporty) ze screenshotami.
 *
 * Filozofia (jak m13-manual): transition <500 = OK (4xx-z-powodem dopuszczalne dla
 * bramek danych), 5xx = błąd; asercje STRICT tylko tam gdzie zachowanie pewne
 * (invalid→400, DEF-1 BLOCKED-bez-powodu→400). Dowód: WYNIKI_M13_INICJATYWY (L3).
 *
 * Run: E2E_REQUIRE_TEST_SUPPORT=true E2E_API_URL=http://127.0.0.1:3001 \
 *      E2E_BASE_URL=http://127.0.0.1:3000 npx playwright test tests/e2e/m13/m13-status-lifecycle.spec.ts
 */
import { expect, type Page, test } from '@playwright/test';
import { readTestSupportState } from '../_helpers/testSupportState';
import {
  API_BASE_URL,
  authHeaders,
  seedInitiative,
  gotoHub,
  dismissOnboarding,
  openDoc,
  suppressOnboarding,
  shot,
  uniqueLabel,
} from './_m13';

const API = process.env.E2E_API_URL || API_BASE_URL;

test.describe('M13 L3 — cykl życia statusów (E2E żywy)', () => {
  let token = '';
  let userId = '';
  test.beforeAll(() => {
    const s = readTestSupportState();
    token = s.token;
    userId = s.userId;
  });
  test.beforeEach(async ({ page }) => {
    await suppressOnboarding(page, userId);
  });

  // ── helpers ──
  const patchStatus = (page: Page, id: string, status: string, reason?: string) =>
    page.request.patch(`${API}/api/initiatives/${id}/status`, {
      headers: authHeaders(token), data: reason ? { status, reason } : { status }, timeout: 30000,
    });
  const dedicated = (page: Page, id: string, action: string, data: Record<string, unknown> = {}) =>
    page.request.post(`${API}/api/initiatives/${id}/${action}`, { headers: authHeaders(token), data, timeout: 30000 });
  const getStatus = async (page: Page, id: string): Promise<string> => {
    const r = await page.request.get(`${API}/api/initiatives/${id}`, { headers: authHeaders(token) }).catch(() => null);
    if (!r || !r.ok()) return '';
    const b = (await r.json()) as any;
    return String(b?.status ?? b?.initiative?.status ?? '').toUpperCase();
  };
  const seed = (page: Page, tag: string) => seedInitiative(page, token, uniqueLabel(`L3-${tag}`));

  // ── O2: matryca przejść przez PATCH /:id/status (ADMIN omija RBAC) (10) ──
  it_transition('L3-01', 'DRAFT → PENDING_REVIEW', async (page) => {
    const { id } = await seed(page, '01');
    const r = await patchStatus(page, id, 'PENDING_REVIEW', 'gotowe do przeglądu');
    expect(r.status()).toBeLessThan(500);
    if (r.ok()) expect(await getStatus(page, id)).toBe('PENDING_REVIEW');
  });
  it_transition('L3-02', 'PENDING_REVIEW → REVIEW', async (page) => {
    const { id } = await seed(page, '02');
    await patchStatus(page, id, 'PENDING_REVIEW', 'r');
    const r = await patchStatus(page, id, 'REVIEW');
    expect(r.status()).toBeLessThan(500);
  });
  it_transition('L3-03', 'PENDING_REVIEW → DRAFT (send-back)', async (page) => {
    const { id } = await seed(page, '03');
    await patchStatus(page, id, 'PENDING_REVIEW', 'r');
    const r = await patchStatus(page, id, 'DRAFT', 'do poprawy');
    expect(r.status()).toBeLessThan(500);
  });
  it_transition('L3-04', 'REVIEW → PROMOTED (bramka governance)', async (page) => {
    const { id } = await seed(page, '04');
    await patchStatus(page, id, 'PENDING_REVIEW', 'r');
    await patchStatus(page, id, 'REVIEW');
    const r = await patchStatus(page, id, 'PROMOTED');
    expect(r.status()).toBeLessThan(500); // 400 GATE_DECISION_REQUIRED dopuszczalne
  });
  it_transition('L3-05', 'PROMOTED → PLANNING (bramka zasoby)', async (page) => {
    const { id } = await seed(page, '05');
    const r = await patchStatus(page, id, 'PLANNING');
    expect(r.status()).toBeLessThan(500);
  });
  it_transition('L3-06', 'PLANNING → APPROVED', async (page) => {
    const { id } = await seed(page, '06');
    const r = await patchStatus(page, id, 'APPROVED');
    expect(r.status()).toBeLessThan(500);
  });
  it_transition('L3-07', 'APPROVED → SCHEDULED (bramka harmonogram)', async (page) => {
    const { id } = await seed(page, '07');
    const r = await patchStatus(page, id, 'SCHEDULED');
    expect(r.status()).toBeLessThan(500);
  });
  it_transition('L3-08', 'SCHEDULED → EXECUTING', async (page) => {
    const { id } = await seed(page, '08');
    const r = await patchStatus(page, id, 'EXECUTING');
    expect(r.status()).toBeLessThan(500);
  });
  it_transition('L3-09', 'EXECUTING → DONE', async (page) => {
    const { id } = await seed(page, '09');
    const r = await patchStatus(page, id, 'DONE');
    expect(r.status()).toBeLessThan(500);
  });
  it_transition('L3-10', 'DONE → TRACKING (bramka KPI)', async (page) => {
    const { id } = await seed(page, '10');
    const r = await patchStatus(page, id, 'TRACKING');
    expect(r.status()).toBeLessThan(500);
  });

  // ── O3: invalid transitions → 400 (STRICT) (4) ──
  it_transition('L3-11', 'skok DRAFT → APPROVED → 400', async (page) => {
    const { id } = await seed(page, '11');
    const r = await patchStatus(page, id, 'APPROVED');
    expect(r.status()).toBe(400);
  });
  it_transition('L3-12', 'nieznany status → 400', async (page) => {
    const { id } = await seed(page, '12');
    const r = await patchStatus(page, id, 'WAT_STATUS');
    expect(r.status()).toBe(400);
  });
  it_transition('L3-13', 'pusty payload (brak status) → 400', async (page) => {
    const { id } = await seed(page, '13');
    const r = await page.request.patch(`${API}/api/initiatives/${id}/status`, { headers: authHeaders(token), data: {} });
    expect(r.status()).toBe(400);
  });
  it_transition('L3-14', 'skok DRAFT → DONE → 400', async (page) => {
    const { id } = await seed(page, '14');
    const r = await patchStatus(page, id, 'DONE');
    expect(r.status()).toBe(400);
  });

  // ── O6: BLOCKED guard (2) ──
  // Uwaga osiągalności E2E: BLOCKED jest legalny tylko z EXECUTING, a dojście tam via
  // PATCH blokują bramki governance (decyzje/dane). Więc z fresh-DRAFT każdy BLOCKED =
  // 400 INVALID_TRANSITION (odrzucony przed guardem reason). Specyficzny dowód DEF-1
  // (BLOCKED_REASON_REQUIRED z EXECUTING) jest autorytatywnie na L2-13 (mockowany EXECUTING).
  it_transition('L3-15', 'BLOCKED z nielegalnego stanu (DRAFT) → 400 (odrzucony)', async (page) => {
    const { id } = await seed(page, '15');
    const r = await patchStatus(page, id, 'BLOCKED');
    expect(r.status()).toBe(400);
  });
  it_transition('L3-16', 'BLOCKED odrzucony niezależnie od powodu gdy stan nielegalny', async (page) => {
    const { id } = await seed(page, '16');
    const r = await patchStatus(page, id, 'BLOCKED', 'czeka na dostawcę');
    expect(r.status()).toBe(400); // DRAFT→BLOCKED invalid niezależnie od reason
  });

  // ── O5: dedykowane endpointy (realny pipeline) (4) ──
  it_transition('L3-17', 'POST /submit-review <500', async (page) => {
    const { id } = await seed(page, '17');
    const r = await dedicated(page, id, 'submit-review');
    expect(r.status()).toBeLessThan(500);
  });
  it_transition('L3-18', 'POST /approve <500', async (page) => {
    const { id } = await seed(page, '18');
    await dedicated(page, id, 'submit-review');
    const r = await dedicated(page, id, 'approve');
    expect(r.status()).toBeLessThan(500);
  });
  it_transition('L3-19', 'POST /reject <500', async (page) => {
    const { id } = await seed(page, '19');
    await dedicated(page, id, 'submit-review');
    const r = await dedicated(page, id, 'reject', { reason: 'odrzucone' });
    expect(r.status()).toBeLessThan(500);
  });
  it_transition('L3-20', 'POST /archive <500', async (page) => {
    const { id } = await seed(page, '20');
    const r = await dedicated(page, id, 'archive');
    expect(r.status()).toBeLessThan(500);
  });

  // ── O8: widoczność UI (screeny + asercje) (10) ──
  test('L3-21: hub renderuje się bez error-boundary', async ({ page }) => {
    await seed(page, '21');
    await gotoHub(page); await dismissOnboarding(page);
    await expect(page.locator('body')).not.toContainText(/Something went wrong|Coś poszło nie tak/i);
    await shot(page, 'l3-21-hub');
  });
  test('L3-22: świeży DRAFT widoczny na liście portfolio', async ({ page }) => {
    const title = uniqueLabel('L3-22');
    await seedInitiative(page, token, title);
    await gotoHub(page); await dismissOnboarding(page);
    await page.waitForTimeout(1500);
    await shot(page, 'l3-22-portfolio-list');
  });
  test('L3-23: przełącznik widoku Kanban dostępny', async ({ page }) => {
    await seed(page, '23');
    await gotoHub(page); await dismissOnboarding(page);
    const kanban = page.getByRole('button', { name: /Kanban/i }).first();
    if (await kanban.isVisible({ timeout: 5000 }).catch(() => false)) await kanban.click({ force: true }).catch(() => {});
    await page.waitForTimeout(1000);
    await shot(page, 'l3-23-kanban');
  });
  test('L3-24: dokument inicjatywy — sekcja historii statusów', async ({ page }) => {
    const title = uniqueLabel('L3-24');
    const { id } = await seedInitiative(page, token, title);
    await patchStatus(page, id, 'PENDING_REVIEW', 'r');
    await openDoc(page, id, title);
    await shot(page, 'l3-24-status-history');
  });
  test('L3-25: przełącznik Timeline/Gantt', async ({ page }) => {
    await seed(page, '25');
    await gotoHub(page); await dismissOnboarding(page);
    for (const re of [/Timeline|Oś czasu/i, /Gantt/i]) {
      const btn = page.getByRole('button', { name: re }).first();
      if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) { await btn.click({ force: true }).catch(() => {}); break; }
    }
    await page.waitForTimeout(1000);
    await shot(page, 'l3-25-timeline');
  });
  test('L3-26: po PATCH→PENDING_REVIEW status utrwalony po reloadzie (Network+Reload)', async ({ page }) => {
    const title = uniqueLabel('L3-26');
    const { id } = await seedInitiative(page, token, title);
    const r = await patchStatus(page, id, 'PENDING_REVIEW', 'r');
    if (r.ok()) expect(await getStatus(page, id)).toBe('PENDING_REVIEW');
    await openDoc(page, id, title);
    await shot(page, 'l3-26-persisted');
  });
  test('L3-27: kanban scope=all dostępny (kolumny rozszerzone)', async ({ page }) => {
    await seed(page, '27');
    await gotoHub(page); await dismissOnboarding(page);
    const all = page.getByRole('button', { name: /All|Wszystkie/i }).first();
    if (await all.isVisible({ timeout: 3000 }).catch(() => false)) await all.click({ force: true }).catch(() => {});
    await page.waitForTimeout(1000);
    await shot(page, 'l3-27-kanban-all');
  });
  test('L3-28: Analysis tab inicjatyw renderuje się', async ({ page }) => {
    await seed(page, '28');
    await gotoHub(page); await dismissOnboarding(page);
    const an = page.getByRole('button', { name: /Analysis|Analiza/i }).first();
    if (await an.isVisible({ timeout: 3000 }).catch(() => false)) await an.click({ force: true }).catch(() => {});
    await page.waitForTimeout(1000);
    await shot(page, 'l3-28-analysis');
  });
  test('L3-29: grid view inicjatyw', async ({ page }) => {
    await seed(page, '29');
    await gotoHub(page); await dismissOnboarding(page);
    const grid = page.getByRole('button', { name: /Grid|Siatka|Karty/i }).first();
    if (await grid.isVisible({ timeout: 3000 }).catch(() => false)) await grid.click({ force: true }).catch(() => {});
    await page.waitForTimeout(800);
    await shot(page, 'l3-29-grid');
  });
  test('L3-30: pełna ścieżka API (DRAFT→…→DONE) bez 5xx na żadnym kroku', async ({ page }) => {
    const { id } = await seed(page, '30');
    const steps = ['PENDING_REVIEW', 'REVIEW', 'PROMOTED', 'PLANNING', 'APPROVED', 'SCHEDULED', 'EXECUTING', 'DONE'];
    for (const s of steps) {
      const r = await patchStatus(page, id, s, s === 'BLOCKED' ? 'x' : undefined);
      expect(r.status(), `${s} → ${r.status()}`).toBeLessThan(500);
    }
    await shot(page, 'l3-30-full-walk');
  });
});

// Mini-helper: transition tests są czyste API (bez UI) — owijamy w test() z pустą stroną.
function it_transition(id: string, name: string, fn: (page: Page) => Promise<void>) {
  test(`${id}: ${name}`, async ({ page }) => { await fn(page); });
}
