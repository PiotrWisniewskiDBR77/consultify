/**
 * M13 Inicjatywy — shared E2E harness for the manual-test gate.
 *
 * Mirrors the m13-acceptance pattern: a write-access (non-demo) token from the
 * test-support global-setup, an initiative seeded via the real API, and the hub
 * deep-link (/portfolio?open=<id>&mode=doc) that renders InitiativeDocumentView
 * inline. Adds a richer seed + section-nav + screenshot helpers so each manual
 * scenario can save its required PNG artifact into docs/qa/screens/m13-<date>/.
 *
 * Run (e2e webServer, MOCK_DB + ENABLE_TEST_SUPPORT):
 *   E2E_USE_WEB_SERVER=true npx playwright test tests/e2e/m13/m13-manual.spec.ts
 */
import fs from 'node:fs';
import path from 'node:path';

import { type APIResponse, expect, type Page } from '@playwright/test';

export const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3001';
export const SHOTS_DIR = path.resolve('docs/qa/screens/m13-2026-06-21');
export const ERROR_BOUNDARY_RE = /Coś poszło nie tak|Something went wrong/i;

fs.mkdirSync(SHOTS_DIR, { recursive: true });

export function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'content-type': 'application/json' };
}
export function uniqueLabel(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
export async function shot(page: Page, name: string) {
  await page.screenshot({ path: path.join(SHOTS_DIR, `${name}.png`), fullPage: false });
}

/** Seed an initiative with enough payload that the core sections render content. */
export async function seedInitiative(
  page: Page,
  token: string,
  title: string
): Promise<{ id: string }> {
  const create = (): Promise<APIResponse> =>
    page.request.post(`${API_BASE_URL}/api/initiatives`, {
      headers: authHeaders(token),
      data: {
        title,
        summary: `Automatyzacja procesu onboardingu — ${title}. Cel: skrócić czas i wyeliminować ręczne kroki.`,
        hypothesis:
          'Jeśli zautomatyzujemy onboarding to skrócimy czas o 40% bo usuniemy ręczne przepisywanie danych',
        problemStatement:
          'Onboarding trwa 5 dni roboczych; 3 zespoły przepisują te same dane ręcznie między 4 systemami.',
      },
      timeout: 40000,
    });
  const res = await create();
  if (!res.ok()) throw new Error(`seedInitiative failed: ${res.status()} ${await res.text()}`);
  const body = (await res.json()) as any;
  return { id: String(body?.id || body?.initiative?.id || '') };
}

/** Seed N tasks bound to an initiative so Timeline/Gantt/Tasks render real content. */
export async function seedTasks(page: Page, token: string, initiativeId: string) {
  const base = Date.parse('2026-07-01T09:00:00.000Z');
  const day = 24 * 60 * 60 * 1000;
  const tasks = [
    { title: 'Analiza obecnego procesu', off: 0, dur: 3 },
    { title: 'Projekt automatyzacji', off: 4, dur: 5 },
    { title: 'Wdrożenie pilotażowe', off: 10, dur: 7 },
  ];
  for (const t of tasks) {
    await page.request
      .post(`${API_BASE_URL}/api/pmo/tasks`, {
        headers: authHeaders(token),
        data: {
          title: t.title,
          initiativeId,
          status: 'todo',
          startedAt: new Date(base + t.off * day).toISOString(),
          dueDate: new Date(base + (t.off + t.dur) * day).toISOString(),
        },
        timeout: 30000,
      })
      .catch(() => null);
  }
}

/** Force a theme BEFORE the app boots (init script), so light-mode is real.
 *
 * The app drives the `dark` class from a Zustand store (`useAppStore.theme`,
 * default 'dark'), persisted under localStorage key `consultify-storage`
 * (version 2). Setting a bare `theme` key did NOT flip it — ThemeSync reads the
 * store, not that key. We pre-seed the persisted store so the app boots with the
 * requested theme; the partial state merges over slice defaults on rehydrate. */
export async function forceTheme(page: Page, theme: 'light' | 'dark') {
  await page.addInitScript((th) => {
    try {
      localStorage.setItem('consultify-storage', JSON.stringify({ state: { theme: th }, version: 2 }));
      const el = document.documentElement;
      if (th === 'dark') el.classList.add('dark');
      else el.classList.remove('dark');
    } catch {
      /* ignore */
    }
  }, theme);
}

export async function suppressOnboarding(page: Page, userId: string) {
  await page.addInitScript((uid) => {
    try {
      if (uid) localStorage.setItem(`consultify_onboarding_done:${uid}`, 'true');
    } catch {
      /* ignore */
    }
  }, userId);
}

export async function dismissOnboarding(page: Page) {
  const buttons = [/Skip for now|Pomiń na razie|Pomiń/i, /Get started|Rozpocznij/i];
  for (let i = 0; i < 3; i += 1) {
    let acted = false;
    for (const re of buttons) {
      const btn = page.getByRole('button', { name: re }).first();
      if (await btn.isVisible().catch(() => false)) {
        await btn.click({ timeout: 1000, force: true }).catch(() => {});
        acted = true;
      }
    }
    await page.keyboard.press('Escape').catch(() => {});
    if (!acted) break;
    await page.waitForTimeout(200);
  }
}

export async function gotoHub(page: Page) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.goto('/portfolio', { waitUntil: 'domcontentloaded', timeout: 60000 });
      return;
    } catch {
      await page.waitForTimeout(1000);
    }
  }
}

/** Open an initiative's document via the hub deep-link and wait for it to render.
 *
 * The deep-link effect (?open=<id>&mode=doc) can race for a freshly-seeded
 * initiative on a fresh org (list empty → falls back to GET /initiatives/:id).
 * A plain title-visible check is NOT enough — the title also shows as a hub
 * LIST ROW, so it passes while we're still on the hub. The real signal that the
 * document shell mounted is the section-nav (SortableNavItem drag handles). We
 * re-navigate up to 3× until those appear. */
export async function openDoc(page: Page, id: string, title: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.goto(`/portfolio?open=${encodeURIComponent(id)}&mode=doc`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await dismissOnboarding(page);
    await expect(page.getByText(title, { exact: false }).first()).toBeVisible({ timeout: 45000 });
    // Poll for the document shell: section-nav buttons (drag-handle marker).
    const ready = await sectionNavLocator(page)
      .first()
      .waitFor({ state: 'visible', timeout: 20000 })
      .then(() => true)
      .catch(() => false);
    if (ready) return;
    // Race: still on the hub. Try clicking the matching list row, then retry.
    const row = page.getByText(title, { exact: false }).first();
    await row.click({ force: true }).catch(() => {});
    await page.waitForTimeout(1200);
    const readyAfterClick = await sectionNavLocator(page)
      .first()
      .isVisible()
      .catch(() => false);
    if (readyAfterClick) return;
  }
}

/** Toggle the app into dark / light mode by setting the documentElement class. */
export async function setDark(page: Page, dark: boolean) {
  await page.evaluate((d) => {
    try {
      const el = document.documentElement;
      if (d) el.classList.add('dark');
      else el.classList.remove('dark');
      localStorage.setItem('theme', d ? 'dark' : 'light');
    } catch {
      /* ignore */
    }
  }, dark);
  await page.waitForTimeout(400);
}

/**
 * Locator for the document's section-nav buttons (NModeLeftNav).
 *
 * Each section button contains a drag-handle span with aria-label
 * "Przeciaganie zakladki" / "Drag section" (SortableNavItem, rendered because
 * InitiativeDocumentView passes onSectionReorder). That marker uniquely
 * identifies section-nav items regardless of how many other <nav>/buttons the
 * app shell renders — `nav.first()` was matching the app sidebar (0 sections).
 */
export function sectionNavLocator(page: Page) {
  return page.locator(
    'button:has([aria-label="Przeciaganie zakladki"]), button:has([aria-label="Drag section"])'
  );
}

/** Return the section-nav buttons as an array of {index, label}. */
export async function sectionNavButtons(page: Page) {
  const buttons = sectionNavLocator(page);
  const n = await buttons.count();
  const out: { index: number; label: string }[] = [];
  for (let i = 0; i < n; i += 1) {
    const label = (await buttons.nth(i).innerText().catch(() => '')).trim();
    if (label) out.push({ index: i, label });
  }
  return out;
}
