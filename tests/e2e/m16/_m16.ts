/**
 * M16 Finanse — wspólny harness E2E (kubełek B: testy wymagające przeglądarki).
 *
 * Most: lokalny vite FE (:3010) → backend (VITE_API_TARGET).
 * Autoryzacja: ISOLATED E2E test-support tenant — token z pliku stanu global-setup
 * (tests/e2e/_helpers/testSupportState.ts), seedowany do strony przez seedPageAuth.
 *
 * Uruchom (w bramkowanym harnessie z test-support, np. E2E_REQUIRE_TEST_SUPPORT=true):
 *   1) node node_modules/vite/bin/vite.js --port 3010 --strictPort
 *   2) E2E_BASE_URL=http://localhost:3010 npx playwright test tests/e2e/m16 --config playwright.config.ts --workers 1
 *
 * BEZPIECZEŃSTWO (2026-07-13): wcześniej logowało się realnym kontem
 * (piotr.wisniewski@dbr77.com / 123456) i pisało do prawdziwej organizacji DBR77.
 * Teraz używa wyłącznie izolowanego, jednorazowego tenanta E2E — żadne realne
 * konto nie jest używane ani dotykane. Bez bramkowanego harnessu (brak pliku
 * stanu) test kończy się natychmiast (fail-fast) zamiast wpaść na realny login.
 */
import fs from 'node:fs';
import path from 'node:path';

import { type Page, expect } from '@playwright/test';

import { readTestSupportState } from '../_helpers/testSupportState';
import { seedPageAuth } from '../cases/_m07-helpers';

export const FE = process.env.E2E_BASE_URL || 'http://localhost:3010';
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

/** Izolowany token E2E test-support (z pliku stanu global-setup). */
function isolatedToken(): string {
  if (cachedToken) return cachedToken;
  cachedToken = readTestSupportState().token;
  expect(cachedToken, 'test-support state must provide a token').toBeTruthy();
  return cachedToken;
}

/**
 * "Zaloguj" — seeduje izolowany token test-support do strony (localStorage/zustand)
 * przez seedPageAuth. NIE loguje realnym kontem. Wywołuj przed nawigacją
 * (openFinanceTab), bo seedPageAuth używa addInitScript.
 */
export async function login(page: Page): Promise<void> {
  await seedPageAuth(page, isolatedToken());
}

/** Pobierz token API (do bezpośrednich wywołań / seedu w teście). */
export async function apiToken(_page: Page): Promise<string> {
  return isolatedToken();
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
      const body = await page.locator('body').innerText().catch(() => '');
      if (/Statements/.test(body) && /Investment/.test(body) && !/^\s*Loading\s*$/i.test(body.trim())) {
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
