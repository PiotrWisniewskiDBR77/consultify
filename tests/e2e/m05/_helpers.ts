/**
 * M05 Ideas — Zarządzanie · wspólny harness manualnych testów E2E (Playwright).
 *
 * Zasada (jak w m04-notebook): to NIE smoke ani testy kodu. Każdy spec gna ŻYWE UI
 * (localhost:3000) i/lub weryfikuje stan przez REALNE API backendu (:3001, staging DB) —
 * Bearer = odpowiednik „zrzutu DB" ze specyfikacji manualnej
 * `Harvard/Testy manualne/TESTY_M05_IDEAS_ZARZADZANIE.md`.
 *
 * Auth: token z `/tmp/consultify-auth.json` (zalogowana sesja OWNER DBR77).
 *       Brak ważnego tokenu → seria `test.skip` (uczciwy skip, nie fałszywa zieleń).
 *
 * Run (serwery dev już działają):
 *   E2E_USE_WEB_SERVER=false E2E_API_URL=http://127.0.0.1:3001 E2E_BASE_URL=http://localhost:3000 \
 *   npx playwright test tests/e2e/m05 --project=chromium --workers=1 --reporter=list
 */
import fs from 'node:fs';

import { APIRequestContext, Page, expect, request as pwRequest } from '@playwright/test';

export const API_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3001';
export const AUTH_FILE = process.env.CONSULTIFY_AUTH_FILE || '/tmp/consultify-auth.json';
export const MW = '/api/my-work';
export const SHOTS = 'tests/e2e/screenshots/m05';

export interface AuthBundle {
  token: string;
  authToken?: string;
  user?: string;
  'consultify-storage'?: string;
  [k: string]: string | undefined;
}

let cachedAuth: AuthBundle | null | undefined;

/** Wczytaj + zweryfikuj token (exp w przyszłości). Zwraca null gdy brak/wygasł. */
export function loadAuth(): AuthBundle | null {
  if (cachedAuth !== undefined) return cachedAuth;
  try {
    const raw = fs.readFileSync(AUTH_FILE, 'utf8');
    const auth = JSON.parse(raw) as AuthBundle;
    const token = auth.token || auth.authToken || '';
    const parts = token.split('.');
    if (parts.length !== 3) {
      cachedAuth = null;
      return null;
    }
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    const valid = typeof payload.exp === 'number' && payload.exp > Date.now() / 1000;
    cachedAuth = valid ? auth : null;
  } catch {
    cachedAuth = null;
  }
  return cachedAuth;
}

export function authToken(): string {
  const a = loadAuth();
  if (!a) throw new Error('M05 E2E: brak ważnego tokenu w ' + AUTH_FILE);
  return a.token || a.authToken!;
}

export function hasAuth(): boolean {
  return loadAuth() !== null;
}

/** Wstrzyknij sesję do localStorage zanim aplikacja wystartuje (LIVE auth). */
export async function setupAuth(page: Page): Promise<void> {
  const auth = loadAuth();
  if (!auth) return;
  await page.addInitScript((ls: AuthBundle) => {
    for (const [k, v] of Object.entries(ls)) {
      if (typeof v === 'string') localStorage.setItem(k, v);
    }
    if (ls.token && !ls.authToken) localStorage.setItem('authToken', ls.token);
  }, auth as Record<string, string>);
}

/** Klient REST z Bearerem — używany jako „zrzut DB"/Network w asercjach. */
export async function makeApi(): Promise<APIRequestContext> {
  const token = authToken();
  return pwRequest.newContext({
    baseURL: API_URL,
    timeout: 45_000, // staging bywa wolne (AI/agregacje) — nie 15s default
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  });
}

/** Resilient request — backend dev (tsx watch) potrafi restartować. */
export async function req(
  api: APIRequestContext,
  method: 'get' | 'post' | 'put' | 'delete',
  url: string,
  opts?: { data?: unknown }
) {
  let lastErr: unknown;
  for (let i = 0; i < 4; i++) {
    try {
      return await api[method](url, opts as any);
    } catch (e) {
      lastErr = e;
      if (/ECONNREFUSED|ECONNRESET|socket hang up|fetch failed/i.test(String(e))) {
        await new Promise((r) => setTimeout(r, 2500));
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

/** Odpakuj `{data:…}` lub surowy obiekt. */
export function unwrap<T = any>(body: any): T {
  return (body && typeof body === 'object' && 'data' in body ? body.data : body) as T;
}

export function asList(body: any): any[] {
  if (Array.isArray(body)) return body;
  return (
    body?.ideas ||
    body?.folders ||
    body?.items ||
    body?.snapshots ||
    body?.comments ||
    body?.activity ||
    body?.events ||
    body?.data ||
    []
  );
}

export function uniq(prefix: string): string {
  const rnd = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${rnd}`;
}

// ─────────────────────────── Idea CRUD (API = setup/zrzut DB) ───────────────────────────

export interface CreatedIdea {
  id: string;
  title: string;
}

export async function createIdeaApi(
  api: APIRequestContext,
  title: string,
  extra: Record<string, unknown> = {}
): Promise<CreatedIdea> {
  const res = await req(api, 'post', `${MW}/my-ideas`, {
    data: { title, body: '', tags: [], stage: 'spark', ...extra },
  });
  expect([200, 201], `POST my-ideas → ${res.status()}`).toContain(res.status());
  const idea = unwrap(await res.json());
  return { id: idea.id, title: idea.title ?? title };
}

export async function getIdeaApi(api: APIRequestContext, id: string): Promise<any | null> {
  const res = await req(api, 'get', `${MW}/my-ideas/${id}`);
  if (!res.ok()) return null;
  return unwrap(await res.json());
}

export async function deleteIdeaApi(api: APIRequestContext, id: string): Promise<void> {
  await req(api, 'delete', `${MW}/my-ideas/${id}`).catch(() => {});
}

export async function listIdeasApi(api: APIRequestContext): Promise<any[]> {
  const res = await req(api, 'get', `${MW}/my-ideas`);
  expect(res.ok(), `GET my-ideas → ${res.status()}`).toBeTruthy();
  return asList(await res.json());
}

// ─────────────────────────── Mapa / sync ───────────────────────────

export async function getMapApi(api: APIRequestContext, id: string): Promise<any> {
  const res = await req(api, 'get', `${MW}/my-ideas/${id}/map`);
  expect(res.ok(), `GET map → ${res.status()}`).toBeTruthy();
  return unwrap(await res.json());
}

/** Sync mapy. Zwraca surową odpowiedź (status czytasz sam — 200 lub 409). */
export async function syncMap(
  api: APIRequestContext,
  id: string,
  baseVersion: number,
  nodes: unknown[] = [],
  edges: unknown[] = []
) {
  return req(api, 'post', `${MW}/my-ideas/${id}/map/sync`, {
    data: { baseVersion, nodes, edges },
  });
}

// ─────────────────────────── UI nawigacja ───────────────────────────

export async function gotoIdeas(page: Page): Promise<void> {
  await page.goto('/my-work/ideas', { waitUntil: 'domcontentloaded' });
  // Cold-load SPA bywa wolny (~8s) — czekaj na stabilny anchor listy Ideas
  await page
    .locator('button, [role="button"], h1, h2')
    .filter({ hasText: SEL.newIdeaBtn })
    .first()
    .waitFor({ state: 'visible', timeout: 35_000 })
    .catch(() => {});
  await page.waitForTimeout(2000);
  await dismissOverlays(page);
}

export async function dismissOverlays(page: Page): Promise<void> {
  for (let i = 0; i < 2; i++) {
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(150);
  }
  const skip = page
    .getByRole('button', { name: /Skip|Pomiń|Zamknij|Got it|Dismiss|Później/i })
    .first();
  if (await skip.isVisible().catch(() => false)) {
    await skip.click().catch(() => {});
    await page.waitForTimeout(200);
  }
}

export async function shot(page: Page, id: string): Promise<void> {
  await page.screenshot({ path: `${SHOTS}/${id}.png`, fullPage: false }).catch(() => {});
}

/** Stabilne selektory (regex PL/EN — i18n inline-ternar w module). */
export const SEL = {
  newIdeaBtn: /New idea|Nowy pomysł|Nowa idea|New Idea|Dodaj pomysł/i,
  viewTable: /^Table$|^Tabela$|widok tabeli/i,
  viewGrid: /^Grid$|^Siatka$|^Kafelki$/i,
  viewGarden: /^Garden$|^Ogród$/i,
  favorites: /Favorites|Ulubione/i,
  recents: /Recent|Ostatnio|Ostatnie/i,
  folders: /Folders|Foldery/i,
  emptyCta: /Stwórz pierwsz|Create your first|No ideas|Brak pomysłów/i,
  search: /Search|Szukaj|Wyszukaj/i,
};
