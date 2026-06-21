/**
 * M03 — graphical sign-off capture (light + dark).
 *
 * Photographs every organizer surface (Inbox · Calendar · Tasks · Decisions ·
 * Manager) in BOTH the light and the dark theme, with seeded content, so the
 * UI can be approved graphically. Output:
 *   docs/qa/screens/m03-theme-2026-06-20/{light,dark}-<surface>.png
 */
import fs from 'node:fs';
import path from 'node:path';

import { expect, Page, test } from '@playwright/test';

import { readTestSupportState } from '../_helpers/testSupportState';

const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3001';
const SHOTS_DIR = path.resolve('docs/qa/screens/m03-theme-2026-06-20');

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'content-type': 'application/json' };
}
function label(p: string) {
  return `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const SURFACES: Array<{ key: string; route: string }> = [
  { key: 'inbox', route: '/my-work/inbox' },
  { key: 'calendar', route: '/my-work/calendar' },
  { key: 'tasks', route: '/my-work/tasks' },
  { key: 'decisions', route: '/my-work/decisions' },
  { key: 'manager', route: '/my-work/manager' },
];

// Seed a little content (via the page's request context — proven path) so the
// surfaces are not empty in the captures.
async function seedContent(page: Page, token: string) {
  const post = (url: string, data: unknown) =>
    page.request.post(`${API_BASE_URL}${url}`, { headers: authHeaders(token), data, timeout: 30000 });
  const taskIds: string[] = [];
  for (let i = 0; i < 3; i += 1) {
    const res = await post('/api/my-work/personal-tasks', {
      title: label(`m03-theme-task-${i}`),
      priority: ['high', 'medium', 'critical'][i],
      status: ['todo', 'in_progress', 'todo'][i],
      dueDate: new Date(Date.now() + i * 86400000).toISOString().slice(0, 10),
    });
    if (res.ok()) taskIds.push(String((await res.json())?.id || ''));
  }
  for (let i = 0; i < 2; i += 1) {
    if (!taskIds[i]) continue;
    await post('/api/decisions', {
      title: label(`m03-theme-decision-${i}`),
      priority: ['high', 'critical'][i],
      relatedObjectType: 'task',
      relatedObjectId: taskIds[i],
    });
  }
  await post('/api/my-work/inbox/materialize', {}).catch(() => {});
}

async function dismissTour(page: Page) {
  for (let i = 0; i < 5; i += 1) {
    const skip = page.getByRole('button', { name: /Skip tour|Pomiń|Pomín/i }).first();
    if (await skip.isVisible().catch(() => false)) {
      await skip.click({ timeout: 1000, force: true }).catch(() => {});
    }
    await page.keyboard.press('Escape').catch(() => {});
    if (!(await skip.isVisible().catch(() => false))) return;
    await page.waitForTimeout(150);
  }
}

async function capture(page: Page, route: string, file: string) {
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 90000 });
      await dismissTour(page);
      await expect(page.getByTestId('mywork-view')).toBeVisible({ timeout: 30000 });
      break;
    } catch {
      await page.waitForTimeout(1000);
    }
  }
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  await page
    .getByText(/^Loading\.\.\.$|^Ładowanie/i)
    .first()
    .waitFor({ state: 'hidden', timeout: 8000 })
    .catch(() => {});
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(SHOTS_DIR, `${file}.png`), fullPage: false });
}

for (const theme of ['light', 'dark'] as const) {
  test.describe(`M03 ${theme} theme sign-off`, () => {
    test.beforeEach(async ({ page }) => {
      const { userId } = readTestSupportState();
      await page.addInitScript(
        ({ uid, t }: { uid: string; t: string }) => {
          try {
            const k = 'consultify-storage';
            const cur = JSON.parse(localStorage.getItem(k) || '{}');
            const state = (cur && cur.state) || {};
            state.theme = t;
            localStorage.setItem(k, JSON.stringify({ state, version: 2 }));
            localStorage.setItem(`consultify_onboarding_done:${uid}`, 'true');
            localStorage.setItem('consultify_onboarding_done', 'true');
          } catch {
            /* storage unavailable */
          }
        },
        { uid: userId, t: theme }
      );
    });

    test(`captures all five organizer surfaces in ${theme}`, async ({ page }) => {
      test.setTimeout(180000);
      const { token } = readTestSupportState();
      await page.goto('/my-work', { waitUntil: 'domcontentloaded' });
      await seedContent(page, token);
      for (const surface of SURFACES) {
        await capture(page, surface.route, `${theme}-${surface.key}`);
        // Sanity: the route error boundary must not be showing.
        await expect(page.getByText(/Coś poszło nie tak|Something went wrong/i)).toHaveCount(0);
      }
    });
  });
}
