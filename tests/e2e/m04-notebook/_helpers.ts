/**
 * M04 Notatnik — wspólny harness dla manualnych testów E2E (Playwright).
 *
 * Zasada: to NIE są smoke ani testy kodu. Każdy spec gna ŻYWE UI (localhost:3000)
 * i/lub weryfikuje stan przez REALNE API backendu (:3001, staging DB) — Bearer = odpowiednik
 * "zrzutu DB" ze specyfikacji manualnej `Harvard/Testy manualne/TESTY_M04_NOTATNIK.md`.
 *
 * Auth: token z `/tmp/consultify-auth.json` (wyciągnięty z zalogowanej sesji OWNER DBR77).
 *       Brak ważnego tokenu → cała seria `test.skip` (uczciwy skip, nie fałszywa zieleń).
 *
 * Run (serwery dev już działają):
 *   E2E_USE_WEB_SERVER=false E2E_API_URL=http://127.0.0.1:3001 E2E_BASE_URL=http://localhost:3000 \
 *   npx playwright test tests/e2e/m04-notebook --project=chromium --workers=1 --reporter=list
 */
import fs from 'node:fs';

import { APIRequestContext, Page, expect, request as pwRequest } from '@playwright/test';

export const API_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3001';
export const AUTH_FILE = process.env.CONSULTIFY_AUTH_FILE || '/tmp/consultify-auth.json';

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
  if (!a) throw new Error('M04 E2E: brak ważnego tokenu w ' + AUTH_FILE);
  return a.token || a.authToken!;
}

/** Wstrzyknij sesję do localStorage zanim aplikacja wystartuje (LIVE auth). */
export async function setupAuth(page: Page): Promise<void> {
  const auth = loadAuth();
  if (!auth) return;
  await page.addInitScript((ls: AuthBundle) => {
    for (const [k, v] of Object.entries(ls)) {
      if (typeof v === 'string') localStorage.setItem(k, v);
    }
    // upewnij się że axios znajdzie token także pod 'authToken'
    if (ls.token && !ls.authToken) localStorage.setItem('authToken', ls.token);
  }, auth as Record<string, string>);
}

/** Klient REST z Bearerem — używany jako "zrzut DB"/Network w asercjach. */
export async function makeApi(): Promise<APIRequestContext> {
  const token = authToken();
  return pwRequest.newContext({
    baseURL: API_URL,
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  });
}

/** Klient REST z DOWOLNYM tokenem — do scenariuszy cross-account (2 konta). */
export async function makeApiWithToken(token: string): Promise<APIRequestContext> {
  return pwRequest.newContext({
    baseURL: API_URL,
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  });
}

/**
 * Zarejestruj ŚWIEŻE konto demo (inna organizacja) i zwróć jego token — do testów
 * izolacji cross-user/cross-org. Zwraca null gdy register-demo niedostępny na env
 * (wtedy caller robi uczciwy skip).
 *
 * CELOWO register-demo, NIE test-support/bootstrap: ten scenariusz POTRZEBUJE konta
 * NIEUPRZYWILEJOWANEGO (publiczna rejestracja demo daje rolę TEAM_MEMBER w read-only
 * organizacji demo). To jest wymaganie testu ACL, nie zaniedbanie — nie „naprawiaj"
 * tego na tests/e2e/_helpers/privilegedSession.ts.
 */
export async function freshToken(page: Page): Promise<string | null> {
  const runId = `m04-${Math.random().toString(36).slice(2, 10)}`;
  const reg = await page.request
    .post(`${API_URL}/api/auth/register-demo`, {
      data: {
        email: `e2e+${runId}@local.test`,
        password: `E2E-Pass1-${runId}`,
        firstName: 'E2E',
      },
    })
    .catch(() => null);
  if (reg && reg.ok()) {
    const payload = (await reg.json().catch(() => ({}))) as any;
    const tok = String(payload?.token || payload?.accessToken || payload?.data?.token || '');
    return tok || null;
  }
  return null;
}

/**
 * Resilient request — backend dev (tsx watch) potrafi restartować przy zmianach plików.
 * Ponawiamy na ECONNREFUSED/reset (jak w istniejącym wzorcu smoke).
 */
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
      const msg = String(e);
      if (/ECONNREFUSED|ECONNRESET|socket hang up|fetch failed/i.test(msg)) {
        await new Promise((r) => setTimeout(r, 2500));
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

/** Domyślny notatnik OWNER-a (kontener L1). */
export async function getDefaultNotebookId(api: APIRequestContext): Promise<string> {
  const res = await req(api, 'get', '/api/my-work/notebooks');
  expect(res.ok(), `GET /api/my-work/notebooks → ${res.status()}`).toBeTruthy();
  const body = await res.json();
  const list = Array.isArray(body) ? body : body.notebooks || body.data || [];
  expect(list.length, 'brak notatników OWNER-a').toBeGreaterThan(0);
  return list[0].id as string;
}

export interface CreatedPage {
  id: string;
  title: string;
}

/** Utwórz stronę przez API (setup). Zwraca {id,title}. Rejestruj do cleanup. */
export async function createPageApi(
  api: APIRequestContext,
  notebookId: string,
  title: string,
  text = ''
): Promise<CreatedPage> {
  const res = await req(api, 'post', '/api/my-work/notebook/pages', {
    data: {
      notebookId,
      title,
      visibility: 'private',
      contentJson: {
        type: 'doc',
        content: text
          ? [{ type: 'paragraph', content: [{ type: 'text', text }] }]
          : [{ type: 'paragraph' }],
      },
      contentText: text,
    },
  });
  expect([200, 201], `POST page → ${res.status()}`).toContain(res.status());
  const body = await res.json();
  const page = body.data || body;
  return { id: page.id, title: page.title ?? title };
}

/** Skasuj stronę przez API (teardown). Idempotentne. */
export async function deletePageApi(api: APIRequestContext, id: string): Promise<void> {
  await req(api, 'delete', `/api/v8/my-work/notebook/pages/${id}`).catch(() => {});
}

export async function getPageApi(api: APIRequestContext, id: string): Promise<any | null> {
  const res = await req(api, 'get', `/api/my-work/notebook/pages/${id}`);
  if (!res.ok()) return null;
  const body = await res.json();
  return body.data || body;
}

/** Unikalny suffix dla izolacji fixtur (bez Date.now w specu testu). */
export function uniq(prefix: string): string {
  const rnd = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${rnd}`;
}

/** Nawiguj do biblioteki notatnika i poczekaj aż się ustabilizuje. */
export async function gotoNotebook(page: Page): Promise<void> {
  await page.goto('/my-work/notebook', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await dismissOverlays(page);
}

/** Wejdź do workspace notatnika (L2: lista stron + edytor) przez deep-link. */
export async function openNotebook(page: Page, notebookId: string): Promise<void> {
  await page.goto(`/my-work/notebook?notebook=${encodeURIComponent(notebookId)}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForTimeout(2500);
  await dismissOverlays(page);
}

/** Otwórz stronę po tytule w liście L2 (czeka aż edytor pokaże tytuł). */
export async function openNote(page: Page, title: string): Promise<void> {
  const item = page.getByText(title, { exact: false }).first();
  await item.waitFor({ state: 'visible', timeout: 15_000 });
  await item.click();
  await page.waitForTimeout(1500);
}

export async function dismissOverlays(page: Page): Promise<void> {
  for (let i = 0; i < 2; i++) {
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(150);
  }
  const skip = page.getByRole('button', { name: /Skip|Pomiń|Zamknij|Got it|Dismiss/i }).first();
  if (await skip.isVisible().catch(() => false)) {
    await skip.click().catch(() => {});
    await page.waitForTimeout(200);
  }
}

/** Stabilne selektory (regex PL/EN — i18n inline-ternar w module). */
export const SEL = {
  newNotebookBtn: /New notebook|Nowy notatnik/i,
  newNoteBtn: /^New note$|^Nowa notatka$|^New page$|^Nowa strona$/i,
  blankTemplate: /Blank page|Pusta strona|Start from scratch|Zacznij od zera/i,
  editorPlaceholder: /Start writing|Zacznij pisać|Type \/ to insert|Wpisz \/ aby/i,
  filterAll: /^All$|^Wszystkie$/i,
  filterInbox: /^Inbox$|^Skrzynka$/i,
  filterActive: /^Active$|^Aktywne$/i,
  scopePersonal: /Personal|Osobiste/i,
  scopeTeam: /^Team$|^Zespół|Zespołowe/i,
  initiativesPill: /^Initiatives$|^Inicjatywy$/i,
  convertPill: /^Convert$|^Konwertuj$/i,
  workTab: /^Work$|^Praca$/i,
  contextTab: /^Context$|^Kontekst$/i,
};
