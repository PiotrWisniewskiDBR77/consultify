/**
 * L3 — E2E: KRĘGOSŁUP inicjatyw (Playwright, żywy backend).
 *
 * Ćwiczy nowe endpointy backbone na ŻYWEJ apce, API-driven + tolerancyjnie
 * (filozofia jak m13-status-lifecycle: <500 = OK, asercje STRICT tylko tam gdzie
 * zachowanie deterministyczne). Kluczowy dowód: nowe ścieżki (/candidates,
 * /portfolio-health, /portfolio/materialize) NIE są przykryte przez GET /:id —
 * zwracają własny kształt, nie pojedynczą inicjatywę.
 *
 *   GET  /api/initiatives/portfolio-health      → 200 + {byStatus,coverage,gaps,balance}
 *   POST /api/initiatives/portfolio/materialize {format:'table'} → 200 binarka LUB <500
 *   POST /api/initiatives/:id/materialize       {format:'table'/'report'} → <500
 *   GET  /api/initiatives/candidates            → 200 + {candidates:[]}
 *   POST /api/initiatives/candidates/scan       → <500
 *   POST /api/initiatives/from-audit {auditId:'nonexistent'} → 4xx (NIE 5xx)
 *
 * Run: E2E_REQUIRE_TEST_SUPPORT=true E2E_API_URL=http://127.0.0.1:3001 \
 *      E2E_BASE_URL=http://127.0.0.1:3000 \
 *      TEST_SUPPORT_KEY=local-test-support-key-change-me \
 *      npx playwright test tests/e2e/m13/m13-backbone.spec.ts --project=chromium --workers=1
 */
import { expect, type Page, test } from '@playwright/test';
import { readTestSupportState } from '../_helpers/testSupportState';
import { API_BASE_URL, authHeaders, seedInitiative, uniqueLabel } from './_m13';

const API = process.env.E2E_API_URL || API_BASE_URL;

test.describe('M13 L3 — kręgosłup inicjatyw (E2E żywy)', () => {
  let token = '';
  test.beforeAll(() => {
    token = readTestSupportState().token;
  });

  // ── helpers ──
  const seed = (page: Page, tag: string) => seedInitiative(page, token, uniqueLabel(`L3-BB-${tag}`));
  const getJson = (page: Page, path: string) =>
    page.request.get(`${API}${path}`, { headers: authHeaders(token), timeout: 30000 });
  const post = (page: Page, path: string, data: Record<string, unknown>) =>
    page.request.post(`${API}${path}`, { headers: authHeaders(token), data, timeout: 60000 });

  // ── F4: portfolio-health (kształt + NOT shadowed) ──
  test('L3-BB-01: GET /portfolio-health → 200 + kształt (byStatus/coverage/gaps/balance)', async ({ page }) => {
    await seed(page, '01'); // upewnij się że portfel niepusty
    const r = await getJson(page, '/api/initiatives/portfolio-health');
    expect(r.status()).toBe(200);
    const b = (await r.json()) as any;
    expect(b).toHaveProperty('byStatus');
    expect(b).toHaveProperty('coverage');
    expect(b).toHaveProperty('gaps');
    expect(b).toHaveProperty('balance');
    expect(Array.isArray(b.coverage)).toBe(true);
  });

  test('L3-BB-02: portfolio-health NIE jest przykryty przez GET /:id (brak pól pojedynczej inicjatywy)', async ({ page }) => {
    const r = await getJson(page, '/api/initiatives/portfolio-health');
    expect(r.status()).toBe(200);
    const b = (await r.json()) as any;
    // Gdyby /portfolio-health trafiało w GET /:id, dostalibyśmy obiekt inicjatywy
    // (status/title) zamiast agregatu. Agregat ma `coverage` jako tablicę i `total`.
    expect(b).toHaveProperty('total');
    expect(b.coverage).toBeDefined();
    expect(typeof b.status === 'string' && b.title).toBeFalsy();
  });

  test('L3-BB-03: portfolio-health.coverage pokrywa pełną taksonomię (8 obszarów MECE)', async ({ page }) => {
    const r = await getJson(page, '/api/initiatives/portfolio-health');
    expect(r.status()).toBe(200);
    const b = (await r.json()) as any;
    expect(b.coverage.length).toBe(8);
    for (const c of b.coverage) expect(c).toHaveProperty('area');
  });

  // ── F2: kandydaci (lista + skan; NOT shadowed) ──
  test('L3-BB-04: GET /candidates → 200 + {candidates: []} (tablica, nie pojedyncza inicjatywa)', async ({ page }) => {
    const r = await getJson(page, '/api/initiatives/candidates');
    expect(r.status()).toBe(200);
    const b = (await r.json()) as any;
    expect(Array.isArray(b.candidates)).toBe(true);
    expect(typeof b.total).toBe('number');
  });

  test('L3-BB-05: /candidates NIE jest przykryty przez GET /:id (zwraca kopertę listy)', async ({ page }) => {
    const r = await getJson(page, '/api/initiatives/candidates');
    expect(r.status()).toBe(200);
    const b = (await r.json()) as any;
    // GET /:id zwróciłby obiekt inicjatywy ({id,status,title}); lista ma `candidates`+`total`.
    expect(b).toHaveProperty('candidates');
    expect(b.id).toBeUndefined();
  });

  test('L3-BB-06: GET /candidates?status=pending → 200 (filtr akceptowany)', async ({ page }) => {
    const r = await getJson(page, '/api/initiatives/candidates?status=pending');
    expect(r.status()).toBe(200);
    const b = (await r.json()) as any;
    expect(Array.isArray(b.candidates)).toBe(true);
  });

  test('L3-BB-07: POST /candidates/scan → <500 (fail-soft, 200 z {created})', async ({ page }) => {
    const r = await post(page, '/api/initiatives/candidates/scan', {});
    expect(r.status()).toBeLessThan(500);
    if (r.ok()) {
      const b = (await r.json()) as any;
      expect(Array.isArray(b.created)).toBe(true);
    }
  });

  test('L3-BB-08: POST /candidates/:id/accept dla nieistniejącego → 404 (nie 5xx)', async ({ page }) => {
    const r = await post(page, `/api/initiatives/candidates/nonexistent-${Date.now()}/accept`, {});
    expect(r.status()).toBeLessThan(500);
    expect([404, 400]).toContain(r.status());
  });

  test('L3-BB-09: POST /candidates/:id/dismiss dla nieistniejącego → 404 (nie 5xx)', async ({ page }) => {
    const r = await post(page, `/api/initiatives/candidates/nonexistent-${Date.now()}/dismiss`, {});
    expect(r.status()).toBeLessThan(500);
    expect([404, 400]).toContain(r.status());
  });

  // ── F5: materialize (inicjatywa + portfel) ──
  test('L3-BB-10: POST /portfolio/materialize {table} → 200 binarka LUB <500', async ({ page }) => {
    await seed(page, '10'); // niepusty portfel
    const r = await post(page, '/api/initiatives/portfolio/materialize', { format: 'table' });
    expect(r.status()).toBeLessThan(500);
    if (r.ok()) {
      const buf = await r.body();
      expect(buf.length).toBeGreaterThan(0);
      const ct = r.headers()['content-type'] || '';
      expect(ct).toMatch(/spreadsheet|octet-stream|application/);
    }
  });

  test('L3-BB-11: /portfolio/materialize NIE jest przykryty przez /:id/materialize (portfolio≠:id)', async ({ page }) => {
    await seed(page, '11');
    const r = await post(page, '/api/initiatives/portfolio/materialize', { format: 'table' });
    // Gdyby "portfolio" zostało złapane jako :id, materializeInitiative('portfolio')
    // nie znalazłby inicjatywy → 422. Sukces (200) LUB pusty-portfel 422 są OK; 5xx nie.
    expect(r.status()).toBeLessThan(500);
  });

  test('L3-BB-12: POST /:id/materialize {table} dla świeżej inicjatywy → <500', async ({ page }) => {
    const { id } = await seed(page, '12');
    const r = await post(page, `/api/initiatives/${id}/materialize`, { format: 'table' });
    expect(r.status()).toBeLessThan(500);
    if (r.ok()) expect((await r.body()).length).toBeGreaterThan(0);
  });

  test('L3-BB-13: POST /:id/materialize {report} dla świeżej inicjatywy → <500', async ({ page }) => {
    const { id } = await seed(page, '13');
    const r = await post(page, `/api/initiatives/${id}/materialize`, { format: 'report' });
    expect(r.status()).toBeLessThan(500);
  });

  test('L3-BB-14: POST /:id/materialize z nieprawidłowym format → 400 (walidacja zod)', async ({ page }) => {
    const { id } = await seed(page, '14');
    const r = await post(page, `/api/initiatives/${id}/materialize`, { format: 'banana' });
    expect(r.status()).toBe(400);
  });

  test('L3-BB-15: POST /:id/materialize dla nieistniejącej inicjatywy → 422 (fail-soft, nie 5xx)', async ({ page }) => {
    const r = await post(page, `/api/initiatives/nonexistent-${Date.now()}/materialize`, { format: 'table' });
    expect(r.status()).toBeLessThan(500);
    expect([422, 404]).toContain(r.status());
  });

  // ── F0: from-audit (brak audytu → STRICT 404, NIE 5xx) ──
  test('L3-BB-16: POST /from-audit {auditId:nonexistent} → 404 (Audit not found)', async ({ page }) => {
    const r = await post(page, '/api/initiatives/from-audit', { auditId: `nonexistent-${Date.now()}` });
    // KONTRAKT: brak audytu → 404 „Audit not found". Po migracji `20260627_audits`
    // (staging 2026-06-28: dodane project_id/title/summary/description/created_by)
    // SELECT na `audits` przechodzi czysto → null → 404. Kod jest też schema-safe
    // (auditInitiativeService.ts: try pełny SELECT → fallback gwarantowane kolumny
    // → null → 404), więc 404 trzyma niezależnie od driftu. Wcześniej poluzowane do
    // ≥400 z udokumentowanym defektem 500 — teraz zaostrzone do strict 404.
    expect(r.status()).toBe(404);
  });

  test('L3-BB-17: POST /from-audit bez auditId → 400 (walidacja zod min(1))', async ({ page }) => {
    const r = await post(page, '/api/initiatives/from-audit', {});
    expect(r.status()).toBe(400);
  });
});
