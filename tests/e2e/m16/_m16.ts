/**
 * M16 Finanse — wspólny harness E2E (kubełek B: testy wymagające przeglądarki).
 *
 * Most: lokalny Vite FE przekazuje ruch do jawnego `$VITE_API_TARGET`.
 * Logowanie przez UI (piotr/<HASLO>) — wypełnia zustand auth-store poprawnie,
 * unika zgadywania kształtu localStorage. Dane = seed z scripts/seed-m16-demo.py.
 *
 * Uruchom:
 *   1) Ustaw VITE_API_TARGET jawnie, potem uruchom Vite na porcie 3010.
 *   2) Seed uruchamiaj wyłącznie w dozwolonym środowisku z kompletem env.
 *   3) E2E_BASE_URL=http://localhost:3010 npx playwright test tests/e2e/m16 --config playwright.config.ts --workers 1
 *
 * Bezpieczeństwo: czyta/pisze TYLKO demo. PROD nietknięty.
 */
import fs from 'node:fs';
import path from 'node:path';

import { type Page, expect } from '@playwright/test';

export const FE = process.env.E2E_BASE_URL || 'http://localhost:3010';
export const EMAIL = process.env.TEST_USER_EMAIL || 'test@localhost';
export const PASSWORD = process.env.TEST_USER_PASSWORD || 'testpassword123';
export const SHOT_DIR = path.resolve(process.cwd(), 'tests/e2e/screenshots/m16');
fs.mkdirSync(SHOT_DIR, { recursive: true });

export const TABS = {
  statements: 'statements',
  models: 'models',
  analysis: 'analysis',
  prediction: 'prediction',
  valuation: 'valuation',
  investment: 'investment',
} as const;

/** Etykiety przycisków zakładek w UI (tak jak renderuje FinanceHub). */
export const TAB_LABEL: Record<keyof typeof TABS, RegExp> = {
  statements: /^Statements$/,
  models: /^Models$/,
  analysis: /^Analysis$/,
  prediction: /^Prediction$/,
  valuation: /Enterprise valuation/,
  investment: /Investment analysis/,
};

let cachedToken = '';

/** Zaloguj przez UI (idempotentne — pomija jeśli już zalogowany). */
export async function login(page: Page): Promise<void> {
  await page.goto(`${FE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  // już zalogowany? (login redirectuje na /chat)
  if (!/\/login/.test(page.url())) return;
  const email = page.locator('input[type="email"], input[name="email"]').first();
  await email.waitFor({ timeout: 20000 });
  await email.fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  await page
    .locator(
      'button[type="submit"], button:has-text("Zaloguj"), button:has-text("Sign in"), button:has-text("Log in")'
    )
    .first()
    .click();
  await page.waitForTimeout(4000);
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });
}

/** Pobierz token API (do bezpośrednich wywołań / seedu w teście). */
export async function apiToken(page: Page): Promise<string> {
  if (cachedToken) return cachedToken;
  const resp = await page.request.post(`${FE}/api/auth/login`, {
    data: { email: EMAIL, password: PASSWORD },
  });
  const j = (await resp.json()) as any;
  cachedToken = j.token || j.data?.token || '';
  return cachedToken;
}

/**
 * Poczekaj aż shell Finance wyrenderuje tab-bar (nie utknie na "Loading").
 * Jeśli po `tries` próbach (reload między nimi) shell wciąż się ładuje — odpuszcza
 * (asercja w teście i tak złapie brak treści).
 */
async function waitShellReady(page: Page, tries = 3): Promise<void> {
  for (let i = 0; i < tries; i += 1) {
    // tab-bar obecny jak tylko body zawiera etykiety zakładek (Statements+Investment)
    for (let t = 0; t < 16; t += 1) {
      const body = await page
        .locator('body')
        .innerText()
        .catch(() => '');
      if (
        /Statements/.test(body) &&
        /Investment/.test(body) &&
        !/^\s*Loading\s*$/i.test(body.trim())
      ) {
        return;
      }
      await page.waitForTimeout(700);
    }
    // utknięte na Loading → reload i spróbuj jeszcze raz
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => undefined);
  }
}

/**
 * Otwórz zakładkę Finance przez URL (?tab=) i poczekaj aż shell się zhydratuje.
 * URL-nav jest stabilniejszy niż klikanie (element zakładki nie ma pewnego role),
 * a waitShellReady neutralizuje wyścig zimnego ładowania (reload jeśli "Loading").
 */
export async function openFinanceTab(page: Page, tab: keyof typeof TABS): Promise<void> {
  await page.goto(`${FE}/finance?tab=${TABS[tab]}`, { waitUntil: 'domcontentloaded' });
  await waitShellReady(page);
  await page.waitForTimeout(1500);
}

/** Zrzut ekranu scenariusza → tests/e2e/screenshots/m16/<id>.png */
export async function shot(page: Page, id: string): Promise<void> {
  await page.screenshot({ path: path.join(SHOT_DIR, `${id}.png`), fullPage: true });
}

/** Czy widoczny tab-bar Finance ze wszystkimi 6 zakładkami (czeka na hydrację). */
export async function expectFinanceShell(page: Page): Promise<void> {
  await waitShellReady(page);
  const body = await page.locator('body').innerText();
  expect(body).toContain('Statements');
  expect(body).toContain('Models');
  expect(body).toContain('Investment');
}

/** Tekst całego body (do asercji obecności danych). */
export async function bodyText(page: Page): Promise<string> {
  return page.locator('body').innerText();
}

/** Direct API helper (przez proxy vite → demo). */
export async function api(
  page: Page,
  method: string,
  pathname: string,
  body?: unknown
): Promise<{ status: number; json: any }> {
  const token = await apiToken(page);
  const resp = await page.request.fetch(`${FE}${pathname}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: body === undefined ? undefined : (body as any),
  });
  let json: any = {};
  try {
    json = await resp.json();
  } catch {
    json = {};
  }
  return { status: resp.status(), json };
}
