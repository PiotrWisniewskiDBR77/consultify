/**
 * M01 Czat — composer manual scenarios as HEADLESS Playwright E2E
 *
 * Headless, deterministyczna wersja skryptu manualnego
 * `Harvard/Testy manualne/TESTY_M01_CZAT.md` (3 przyciski composera +/✎/👥
 * + przekrojowe). Zastępuje sterowanie żywą przeglądarką — działa też to,
 * czego nie dało się zrobić interaktywnie (responsywność via setViewportSize,
 * determinizm, brak zależności od balansu providera AI).
 *
 * System: E2E_MODE + mock DB + AI_PROVIDER_MODE=mock (jak wave-1-chat-trust).
 *
 * Run:
 *   QA_AI_MODE=true AI_PROVIDER_MODE=mock E2E_MODE=true E2E_USE_WEB_SERVER=true \
 *   E2E_BACKEND_RUNNER=tsx E2E_MOCK_DB=true \
 *   E2E_API_URL=http://127.0.0.1:3101 E2E_BASE_URL=http://127.0.0.1:3100 \
 *   npx playwright test --config playwright.smoke.config.ts \
 *   tests/e2e/smoke/m01-composer-manual-e2e.spec.ts --project=chromium --workers=1
 */
import { expect, type Page, test } from '@playwright/test';

import {
  collectRuntimeGateIssues,
  expectAppMounted,
  expectNoRuntimeGateIssues,
  gotoRuntimeGateRoute,
  seedE2EAuthWithBootstrap,
} from './runtime-gate-helpers';

const TOOLS = '[data-testid="chat-tools-button"]';
const COTHINKER = '[data-testid="chat-cothinker-button"]';
const CHAT_INPUT = 'textarea[data-testid="chat-input"]:visible';

// AddFiles trigger has only a title (i18n), no testid/aria-label → match by role+name.
const addFilesTrigger = (page: Page) =>
  page.getByRole('button', { name: /^Add files$|^Dodaj pliki$/i }).first();

async function dismissWelcomeDialog(page: Page) {
  // First-run onboarding dialog "Welcome to Consultify — Meet Teresa" mounts
  // ASYNC after chat loads; its backdrop-blur (z-50) intercepts pointer events.
  // Must wait for it to appear, then click ONLY the skip control (never
  // "Get started", which advances the wizard instead of closing it).
  const dialog = page.getByRole('dialog');
  await dialog.first().waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
  for (let i = 0; i < 8; i++) {
    if (!(await dialog.first().isVisible().catch(() => false))) return;
    const skip = page
      .getByRole('button', { name: /Skip for now|Pomiń( na razie)?|Maybe later/i })
      .first();
    if (await skip.isVisible().catch(() => false)) {
      await skip.click({ force: true }).catch(() => {});
    } else {
      await page.keyboard.press('Escape').catch(() => {});
    }
    await dialog.first().waitFor({ state: 'detached', timeout: 2000 }).catch(() => {});
  }
}

async function openChat(page: Page) {
  await seedE2EAuthWithBootstrap(page);
  // Suppress first-run onboarding dialog (mounts async after chat loads and its
  // backdrop intercepts pointer events). Local "done" flag = instant guard
  // (useFirstRunOnboarding.ts:85 short-circuits before the server check).
  await page.addInitScript(() => {
    try {
      // helper always seeds currentUser.id = 'e2e-user-id'
      localStorage.setItem('consultify_onboarding_done:e2e-user-id', 'true');
    } catch {
      /* localStorage unavailable */
    }
  });
  await gotoRuntimeGateRoute(page, '/chat');
  await expectAppMounted(page);
  await dismissWelcomeDialog(page); // backstop if id differs
  await expect(page.locator(CHAT_INPUT).first()).toBeVisible({ timeout: 30000 });
  // Ensure no blocking overlay/backdrop remains before interacting.
  await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 10000 });
}

async function closeMenus(page: Page) {
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(150);
}

test.describe('M01 composer — headless manual E2E [@M01]', () => {
  test.setTimeout(120000);

  // ── Sekcja 1: AddFilesMenu (+) ──────────────────────────────
  test('S1 AddFilesMenu — open, Add link modal + URL validation', async ({ page }) => {
    const issues = collectRuntimeGateIssues(page);
    await openChat(page);

    // 1.1 open
    await addFilesTrigger(page).click();
    await expect(
      page.getByText(/Add link|Dodaj link/i).first()
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Manage cloud sources|Zarządzaj źródłami/i).first()).toBeVisible();
    await expect(page.getByText(/Recent|Ostatnie/i).first()).toBeVisible();

    // 1.3 open Add link modal
    await page.getByText(/^Add link$|^Dodaj link$/i).first().click();
    await expect(page.getByRole('heading', { name: /Add link|Dodaj link/i })).toBeVisible({
      timeout: 10000,
    });
    const urlInput = page.getByPlaceholder(/https:\/\//i).first();
    await expect(urlInput).toBeVisible();

    const addBtn = page.getByRole('button', { name: /^Add$|^Dodaj$/i }).first();
    // empty → Add disabled
    await expect(addBtn).toBeDisabled();

    // ftp:// → rejected
    await urlInput.fill('ftp://example.com');
    await addBtn.click();
    await expect(
      page.getByText(/Only http\(s\)|Obsługiwane są tylko linki http\(s\)/i).first()
    ).toBeVisible({ timeout: 8000 });

    // garbage → Invalid link
    await urlInput.fill('@@@ not a url @@@');
    await addBtn.click();
    await expect(page.getByText(/Invalid link|Nieprawidłowy link/i).first()).toBeVisible({
      timeout: 8000,
    });

    // example.com → auto-https + chip
    await urlInput.fill('example.com');
    await addBtn.click();
    await expect(page.getByText(/example\.com/i).first()).toBeVisible({ timeout: 8000 });

    expectNoRuntimeGateIssues(issues);
  });

  // ── Sekcja 2: ToolsMenu (✎) ─────────────────────────────────
  test('S2 ToolsMenu — AI modes toggle, persistence, Response style modal', async ({ page }) => {
    const issues = collectRuntimeGateIssues(page);
    await openChat(page);

    await page.locator(TOOLS).first().click();
    await expect(page.getByText(/Deep analysis|Głęboka analiza/i).first()).toBeVisible({
      timeout: 10000,
    });

    // toggle Deep analysis → toast enabled
    await page.getByText(/Deep analysis|Głęboka analiza/i).first().click();
    await expect(page.getByText(/enabled|włączone/i).first()).toBeVisible({ timeout: 8000 });

    // toggle Read responses → Voice settings subsection appears
    await page.getByText(/Read responses|Czytaj odpowiedzi/i).first().click();
    await expect(page.getByText(/Voice settings|Ustawienia głosu/i).first()).toBeVisible({
      timeout: 8000,
    });

    // persistence: close + reopen → Voice settings still there (TTS still on)
    await closeMenus(page);
    await page.locator(TOOLS).first().click();
    await expect(page.getByText(/Voice settings|Ustawienia głosu/i).first()).toBeVisible({
      timeout: 8000,
    });

    // Response style modal
    await page.getByText(/Response style|Styl odpowiedzi/i).first().click();
    await expect(
      page.getByRole('heading', { name: /Personalize AI responses|Personalizuj odpowiedzi AI/i })
    ).toBeVisible({ timeout: 8000 });
    // 8 style cards — check a few
    await expect(page.getByText(/^Analyst$|^Analityk$/i).first()).toBeVisible();
    await expect(page.getByText(/^Executive$|^Kierownicz/i).first()).toBeVisible();

    await closeMenus(page);
    expectNoRuntimeGateIssues(issues);
  });

  // ── Sekcja 3: CoThinkerMenu (👥) ────────────────────────────
  test('S3 CoThinker — 6 personas, select, mutual exclusion, clear', async ({ page }) => {
    const issues = collectRuntimeGateIssues(page);
    await openChat(page);

    await page.locator(COTHINKER).first().click();
    // 6 personas present
    for (const re of [
      /Consultant|Konsultant/i,
      /Idea Creator|Twórca pomysłów/i,
      /Analyst|Analityk/i,
      /Auditor|Audytor/i,
      /Editor|Redaktor/i,
      /Market Researcher|Badacz rynku/i,
    ]) {
      await expect(page.getByText(re).first()).toBeVisible({ timeout: 8000 });
    }

    // select Analyst → active pill
    await page.getByText(/^Analyst$|^Analityk$/i).first().click();
    const pill = page.getByTestId('cothinker-active-pill');
    await expect(pill).toBeVisible({ timeout: 8000 });

    // mutual exclusion: open again, pick Market Researcher
    await page.locator(COTHINKER).first().click();
    await page.getByText(/Market Researcher|Badacz rynku/i).first().click();
    await expect(page.getByTestId('chat-cothinker-active-label')).toContainText(
      /Market Researcher|Badacz rynku/i,
      { timeout: 8000 }
    );

    // clear
    await page.getByTestId('cothinker-active-pill').getByRole('button').first().click();
    await expect(page.getByTestId('cothinker-active-pill')).toHaveCount(0, { timeout: 8000 });

    expectNoRuntimeGateIssues(issues);
  });

  // ── Sekcja 4: przekrojowe + DoD #7 ──────────────────────────
  test('S4 i18n steering key resolves (not raw key) + EN/PL', async ({ page }) => {
    await openChat(page);
    await page.locator(TOOLS).first().click();

    const steering = page
      .getByText(/How Teresa should answer|Jak Teresa ma odpowiadać/i)
      .first();
    await expect(steering).toBeVisible({ timeout: 10000 });
    // raw key must NOT appear (regression guard for the 2026-06-20 i18n fix)
    await expect(page.locator('#root')).not.toContainText('aiChat.menu.steeringHeading');
    await closeMenus(page);
  });

  test('S4 a11y — Escape closes ToolsMenu', async ({ page }) => {
    await openChat(page);
    await page.locator(TOOLS).first().click();
    await expect(page.getByText(/Deep analysis|Głęboka analiza/i).first()).toBeVisible({
      timeout: 10000,
    });
    await page.keyboard.press('Escape');
    await expect(page.getByText(/Deep analysis|Głęboka analiza/i)).toHaveCount(0, {
      timeout: 8000,
    });
  });

  test('S4 outside-click isolation — opening one menu closes the other', async ({ page }) => {
    await openChat(page);
    await page.locator(TOOLS).first().click();
    await expect(page.getByText(/Deep analysis|Głęboka analiza/i).first()).toBeVisible({
      timeout: 10000,
    });
    // open CoThinker → ToolsMenu must close
    await page.locator(COTHINKER).first().click();
    await expect(page.getByText(/Consultant|Konsultant/i).first()).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/Deep analysis|Głęboka analiza/i)).toHaveCount(0, {
      timeout: 8000,
    });
  });

  test('S4 responsywność — composer usable at mobile width, no horizontal overflow', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openChat(page);

    // Core responsywność signal: composer input usable + no horizontal overflow.
    // (Action-bar triggers may collapse behind a menu at mobile width — not asserted here.)
    await expect(page.locator(CHAT_INPUT).first()).toBeVisible({ timeout: 30000 });

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 2
    );
    expect(overflow, 'page must not overflow horizontally on mobile').toBe(false);
  });
});
