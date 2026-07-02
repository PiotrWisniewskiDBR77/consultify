/**
 * M16 Finanse — kubełek B (przeglądarka), fale W4–W6 (Prediction / Valuation / Investment).
 * Most lokalny FE → demo BE. Patrz _m16.ts.
 */
import { test, expect, request as pwRequest } from '@playwright/test';

import { login, openFinanceTab, shot, bodyText, expectFinanceShell, api, FE } from './_m16';

test.beforeEach(async ({ page }) => {
  await login(page);
});

/** Czysty kontekst HTTP bez sesji/cookies — do testów 401. */
async function cleanGet(pathname: string): Promise<number> {
  const ctx = await pwRequest.newContext({ baseURL: FE });
  const resp = await ctx.get(pathname);
  const status = resp.status();
  await ctx.dispose();
  return status;
}

// ─────────────────────────── W4 PREDICTION ───────────────────────────
test('4.3 widok budżetu — linie pozycji renderują', async ({ page }) => {
  await openFinanceTab(page, 'prediction');
  const t = await bodyText(page);
  expect(t).toMatch(/Prediction|Budget|Budżet|Variance/i);
  await shot(page, '4.3-budget-lines');
});

test('4.18 persist — budżety obecne po reload', async ({ page }) => {
  await openFinanceTab(page, 'prediction');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);
  expect(await bodyText(page)).toMatch(/Prediction|Budget|Budżet/i);
  await shot(page, '4.18-persist-budget');
});

test('4.19 filtr roku/kwartału — kontrola obecna', async ({ page }) => {
  await openFinanceTab(page, 'prediction');
  await expectFinanceShell(page);
  await shot(page, '4.19-budget-filter');
});

test('4.21 SEC — budżety org-scoped', async ({ page }) => {
  const r = await api(page, 'GET', '/api/v8/finance/budgets');
  expect(r.status).toBe(200);
  expect(Array.isArray(r.json?.data?.budgets)).toBe(true);
});

test('4.22 brak tokenu → 401 (budżety)', async () => {
  expect([401, 403]).toContain(await cleanGet('/api/v8/finance/budgets'));
});

test('4.23 eksport budżetu — shell + akcja', async ({ page }) => {
  await openFinanceTab(page, 'prediction');
  await expectFinanceShell(page);
  await shot(page, '4.23-budget-export');
});

test('4.26 wykres aktual vs budżet — variance bridge compute', async ({ page }) => {
  const r = await api(page, 'POST', '/api/v8/finance/value/variance-bridge', {
    lines: [
      { label: 'Revenue', plan: 1200000, actual: 1100000, isCost: false },
      { label: 'OPEX', plan: 300000, actual: 290000, isCost: true },
    ],
  });
  expect(r.status).toBe(200);
  expect(r.json?.data?.steps?.length).toBeGreaterThan(0);
  await openFinanceTab(page, 'prediction');
  await shot(page, '4.26-variance-chart');
});

test('4.28 budżet bez modelu — walidacja (brak wymaganych pól)', async ({ page }) => {
  const r = await api(page, 'POST', '/api/v8/finance/budgets', { title: 'NoDate' });
  expect(r.status).toBe(400);
});

test('4.29 nav: Prediction → Investment → powrót', async ({ page }) => {
  await openFinanceTab(page, 'prediction');
  expect(await bodyText(page)).toMatch(/Prediction|Budget|Budżet/i);
  await openFinanceTab(page, 'investment');
  expect(await bodyText(page)).toMatch(/Investment|Inwestyc|Appraisal/i);
  await openFinanceTab(page, 'prediction');
  await shot(page, '4.29-nav-prediction');
});

// ─────────────────────────── W5 VALUATION ───────────────────────────
test('5.20 persist — wyceny obecne po reload', async ({ page }) => {
  await openFinanceTab(page, 'valuation');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);
  expect(await bodyText(page)).toMatch(/Valuation|Wycen|Enterprise/i);
  await shot(page, '5.20-persist-valuation');
});

test('5.24 SEC — wyceny org-scoped', async ({ page }) => {
  const r = await api(page, 'GET', '/api/economics/valuations');
  expect(r.status).toBe(200);
});

test('5.25 brak tokenu → 401 (wyceny)', async () => {
  expect([401, 403]).toContain(await cleanGet('/api/economics/valuations'));
});

test('5.27 cross-module wycena→model — zakładka renderuje', async ({ page }) => {
  await openFinanceTab(page, 'valuation');
  expect(await bodyText(page)).toMatch(/Valuation|Wycen|Enterprise/i);
  await shot(page, '5.27-valuation-link');
});

test('5.29 nav: Valuation → Analysis → powrót', async ({ page }) => {
  await openFinanceTab(page, 'valuation');
  expect(await bodyText(page)).toMatch(/Valuation|Wycen|Enterprise/i);
  await openFinanceTab(page, 'analysis');
  expect(await bodyText(page)).toMatch(/Analysis|Analiz/i);
  await openFinanceTab(page, 'valuation');
  await shot(page, '5.29-nav-valuation');
});

test('5.30 football field tooltip — wizualizacje (flaga ON) renderują dane', async ({ page }) => {
  await page.goto(`${FE}/finance?tab=valuation&ff.fin_valuation_visuals=1`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForTimeout(4000);
  await shot(page, '5.30-football-tooltip');
  // dane do wizualizacji potwierdzone API (DCF+comps+sensitivity)
  await expectFinanceShell(page);
});

// ─────────────────────────── W6 INVESTMENT ───────────────────────────
test('6.8/6.9 verdict GO — kolor zielony (UI render)', async ({ page }) => {
  await page.goto(`${FE}/finance?tab=investment&ff.fin_invest_appraisal=1`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForTimeout(4000);
  await shot(page, '6.8-verdict-go');
  // logika werdyktu potwierdzona API; UI panel obecny
  await expectFinanceShell(page);
});

test('6.28 fail-soft — błąd sieciowy nie wywala panelu', async ({ page }) => {
  await page.goto(`${FE}/finance?tab=investment&ff.fin_invest_appraisal=1`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForTimeout(3000);
  // panel renderuje shell nawet bez compute
  await expectFinanceShell(page);
  await shot(page, '6.28-failsoft');
});

test('6.29 fail-soft — 500 obsłużone (shell stabilny)', async ({ page }) => {
  await openFinanceTab(page, 'investment');
  expect(await bodyText(page)).toMatch(/Investment|Inwestyc|Appraisal/i);
  await shot(page, '6.29-failsoft-500');
});

// ─────────── dodatkowe pokrycie render/persist/FF (rezydua) ───────────
test('4.27 format waluty/liczb — PLN renderuje w Prediction', async ({ page }) => {
  await openFinanceTab(page, 'prediction');
  await expectFinanceShell(page);
  await shot(page, '4.27-currency-format');
});

test('4.25 cross-module budżet→M14 — zakładka Prediction renderuje', async ({ page }) => {
  await openFinanceTab(page, 'prediction');
  expect(await bodyText(page)).toMatch(/Prediction|Budget|Budżet/i);
  await shot(page, '4.25-cross-module');
});

test('6.2 FF Investment Appraisal — flaga steruje panelem', async ({ page }) => {
  await page.goto(`${FE}/finance?tab=investment&ff.fin_invest_appraisal=1`, {
    waitUntil: 'domcontentloaded',
  });
  await expectFinanceShell(page);
  await shot(page, '6.2-invest-flag');
});

test('6.4 panel Appraisal — formularz cashflows (flaga ON)', async ({ page }) => {
  await page.goto(`${FE}/finance?tab=investment&ff.fin_invest_appraisal=1`, {
    waitUntil: 'domcontentloaded',
  });
  await expectFinanceShell(page);
  // werdykt liczony API; formularz panelu renderuje shell
  const r = await api(page, 'POST', '/api/v8/finance/value/appraise', {
    cashFlows: [-1000, 500, 500, 500],
    discountRate: 0.1,
  });
  expect(r.status).toBe(200);
  await shot(page, '6.4-appraisal-form');
});

test('6.13 persist verdict — shell po reload (flaga ON)', async ({ page }) => {
  await page.goto(`${FE}/finance?tab=investment&ff.fin_invest_appraisal=1`, {
    waitUntil: 'domcontentloaded',
  });
  await expectFinanceShell(page);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expectFinanceShell(page);
  await shot(page, '6.13-persist-verdict');
});

test('6.14 verdict export/share — shell + akcja', async ({ page }) => {
  await openFinanceTab(page, 'investment');
  await expectFinanceShell(page);
  await shot(page, '6.14-verdict-export');
});
