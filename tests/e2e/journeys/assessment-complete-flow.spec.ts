/**
 * Assessment Complete Flow - E2E User Journey Test
 * 100% Coverage of Assessment User Journey:
 * Start → Progress → Complete → Generate Report
 *
 * @playwright
 */

import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

test.describe('Assessment Complete Flow', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to login
        await page.goto('/login');

        // Login with test credentials
        await page.fill('[data-testid="email-input"]', 'demo@test.com');
        await page.fill('[data-testid="password-input"]', 'testpassword123');
        await page.click('[data-testid="login-button"]');

        // Wait for dashboard
        await page.waitForURL(/\/(dashboard|my-work)/);
    });

    test('should complete DRD assessment from start to report', async ({ page }) => {
        // Step 1: Navigate to Assessments
        await page.click('[data-testid="nav-assessment"]');
        await expect(page).toHaveURL(/\/assessment/);

        // Step 2: Start new assessment
        await page.click('[data-testid="new-assessment-btn"]');
        await page.waitForSelector('[data-testid="assessment-type-modal"]');

        // Step 3: Select DRD assessment type
        await page.click('[data-testid="assessment-type-drd"]');
        await page.click('[data-testid="start-assessment-btn"]');

        // Step 4: Fill assessment name
        await page.fill('[data-testid="assessment-name-input"]', 'E2E Test Assessment');
        await page.click('[data-testid="continue-btn"]');

        // Step 5: Answer questions (multiple dimensions)
        await page.waitForSelector('[data-testid="question-section"]');

        // Answer first 5 questions
        for (let i = 0; i < 5; i++) {
            const questionSelector = `[data-testid="question-${i}"]`;
            if (await page.locator(questionSelector).isVisible()) {
                // Select score 3 for all questions
                await page.click(`${questionSelector} [data-testid="score-3"]`);
            }
        }

        // Navigate to next dimension
        await page.click('[data-testid="next-dimension-btn"]');

        // Answer more questions
        for (let i = 0; i < 5; i++) {
            const questionSelector = `[data-testid="question-${i}"]`;
            if (await page.locator(questionSelector).isVisible()) {
                await page.click(`${questionSelector} [data-testid="score-4"]`);
            }
        }

        // Step 6: Complete assessment
        await page.click('[data-testid="complete-assessment-btn"]');
        await page.waitForSelector('[data-testid="assessment-complete-modal"]');

        // Step 7: Generate report
        await page.click('[data-testid="generate-report-btn"]');
        await page.waitForSelector('[data-testid="report-container"]');

        // Verify report sections exist
        await expect(page.locator('[data-testid="report-summary"]')).toBeVisible();
        await expect(page.locator('[data-testid="report-scores"]')).toBeVisible();
        await expect(page.locator('[data-testid="report-recommendations"]')).toBeVisible();
    });

    test('should save and resume assessment', async ({ page }) => {
        // Start new assessment
        await page.click('[data-testid="nav-assessment"]');
        await page.click('[data-testid="new-assessment-btn"]');
        await page.click('[data-testid="assessment-type-siri"]');
        await page.click('[data-testid="start-assessment-btn"]');

        // Answer some questions
        await page.fill('[data-testid="assessment-name-input"]', 'Resume Test Assessment');
        await page.click('[data-testid="continue-btn"]');

        await page.waitForSelector('[data-testid="question-0"]');
        await page.click('[data-testid="question-0"] [data-testid="score-2"]');

        // Save and exit
        await page.click('[data-testid="save-progress-btn"]');
        await page.waitForSelector('[data-testid="saved-notification"]');

        // Navigate away
        await page.click('[data-testid="nav-dashboard"]');
        await expect(page).toHaveURL(/\/(dashboard|my-work)/);

        // Return to assessments
        await page.click('[data-testid="nav-assessment"]');

        // Find and resume saved assessment
        await page.click('[data-testid="in-progress-tab"]');
        await expect(page.locator('text=Resume Test Assessment')).toBeVisible();

        await page.click('[data-testid="resume-assessment-btn"]');

        // Verify progress was saved
        await expect(page.locator('[data-testid="question-0"] [data-testid="score-2"]')).toHaveClass(/selected/);
    });

    test('should generate initiatives from completed assessment', async ({ page }) => {
        // Navigate to completed assessments
        await page.click('[data-testid="nav-assessment"]');
        await page.click('[data-testid="completed-tab"]');

        // Find a completed assessment
        await page.click('[data-testid="assessment-item-0"]');

        // Generate initiatives
        await page.click('[data-testid="generate-initiatives-btn"]');
        await page.waitForSelector('[data-testid="initiative-generation-modal"]');

        // Select methodology
        await page.click('[data-testid="methodology-impact-feasibility"]');
        await page.fill('[data-testid="initiative-count-input"]', '5');
        await page.click('[data-testid="generate-btn"]');

        // Wait for generation
        await page.waitForSelector('[data-testid="initiatives-generated"]', { timeout: 30000 });

        // Verify initiatives were created
        const initiatives = page.locator('[data-testid^="initiative-item-"]');
        await expect(initiatives).toHaveCount(5);
    });
});

test.describe('Interview Session Flow', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/login');
        await page.fill('[data-testid="email-input"]', 'demo@test.com');
        await page.fill('[data-testid="password-input"]', 'testpassword123');
        await page.click('[data-testid="login-button"]');
        await page.waitForURL(/\/(dashboard|my-work)/);
    });

    test('should complete interview from template selection to results', async ({ page }) => {
        // Navigate to Interviews
        await page.click('[data-testid="nav-discovery"]');
        await page.click('[data-testid="interview-tool"]');

        // Select template
        await page.waitForSelector('[data-testid="template-list"]');
        await page.click('[data-testid="template-stakeholder-analysis"]');

        // Start interview
        await page.click('[data-testid="start-interview-btn"]');

        // Answer interview questions
        await page.waitForSelector('[data-testid="interview-question-0"]');

        // Fill first question
        await page.fill('[data-testid="interview-answer-0"]', 'Answer to first question');
        await page.click('[data-testid="next-question-btn"]');

        // Fill second question
        await page.fill('[data-testid="interview-answer-1"]', 'Answer to second question');
        await page.click('[data-testid="next-question-btn"]');

        // Complete interview
        await page.click('[data-testid="complete-interview-btn"]');

        // View results
        await page.waitForSelector('[data-testid="interview-results"]');
        await expect(page.locator('[data-testid="insights-section"]')).toBeVisible();
    });
});

test.describe('Decision Management Flow', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/login');
        await page.fill('[data-testid="email-input"]', 'admin@test.com');
        await page.fill('[data-testid="password-input"]', 'adminpassword123');
        await page.click('[data-testid="login-button"]');
        await page.waitForURL(/\/(dashboard|my-work)/);
    });

    test('should create and approve decision', async ({ page }) => {
        // Navigate to MyWork Decisions tab
        await page.click('[data-testid="nav-my-work"]');
        await page.click('[data-testid="tab-decisions"]');

        // Create new decision
        await page.click('[data-testid="new-decision-btn"]');
        await page.waitForSelector('[data-testid="decision-modal"]');

        // Fill decision details
        await page.fill('[data-testid="decision-title"]', 'E2E Test Decision');
        await page.fill('[data-testid="decision-description"]', 'Description for test decision');
        await page.selectOption('[data-testid="decision-type"]', 'APPROVAL');

        // Set deadline
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        await page.fill('[data-testid="decision-deadline"]', tomorrow.toISOString().split('T')[0]);

        // Submit
        await page.click('[data-testid="create-decision-btn"]');
        await page.waitForSelector('[data-testid="decision-created-notification"]');

        // Find the decision in pending list
        await expect(page.locator('text=E2E Test Decision')).toBeVisible();

        // Approve decision
        await page.click('[data-testid="decision-E2E Test Decision"]');
        await page.click('[data-testid="approve-btn"]');
        await page.fill('[data-testid="rationale-input"]', 'Approved after E2E review');
        await page.click('[data-testid="confirm-approve-btn"]');

        // Verify approved status
        await expect(page.locator('[data-testid="decision-status-approved"]')).toBeVisible();
    });
});

// ---------------------------------------------------------------------------
// ASM-UI-CANON-001 — Assessment five surfaces (Library/Processes/Outputs/
// Reports/Initiatives), viewport/theme/language/state/a11y evidence.
//
// This block is independent of the three `describe`s above (which predate the
// current AssessmentHub and use selectors/credentials that no longer exist in
// the app — left untouched, not weakened). It relies on the SAME real,
// authenticated Playwright context every other spec in this suite gets from
// `tests/e2e/smoke/global-setup.ts` (real Postgres, real login, no mocking) —
// no manual login, no route interception, no localStorage feature injection
// for anything the app treats as a source of truth for pass/fail.
//
// Evidence (screenshots, axe JSON) is written OUTSIDE the repo, to the
// lane-A scratchpad — see docs/program/evidence/closure/a/ASM-UI-CANON-001/
// BROWSER_HARNESS.md and UI_INVENTORY.md for the harness command and a full
// account of what states were reachable vs blocked, and why.
// ---------------------------------------------------------------------------

const ASM_EVIDENCE_DIR =
  process.env.ASM_UI_CANON_EVIDENCE_DIR ||
  '/private/tmp/claude-501/-Users-piotrwisniewski-Library-Mobile-Documents-com-apple-CloudDocs-Documents-Antygracity-DRD-consultify/57900fca-ffc2-4ffd-a712-1046beddf550/scratchpad/asmui/evidence';

const ASM_VIEWPORTS = [
  { name: 'desktop-1440x900', width: 1440, height: 900 },
  { name: 'tablet-768x1024', width: 768, height: 1024 },
  { name: 'mobile-390x844', width: 390, height: 844 },
] as const;

// ASM-001A stable tab ids (AssessmentHub.tsx `FIVE_SURFACES_TAB_IDS`), URL
// source of truth (`?tab=`) — driving surfaces by URL rather than by clicking
// the tab pill is more robust and exercises the URL-sync contract for free.
const ASM_SURFACES = ['library', 'processes', 'outputs', 'reports', 'initiatives'] as const;

// Mirrors tests/e2e/smoke/login.spec.ts's `dismissTourModal` (not exported
// there) — the first-run "Welcome to Consultinity" tour is a REAL modal that
// properly traps focus, so a keyboard-traversal test that doesn't dismiss it
// first gets stuck cycling inside the tour forever (confirmed: this is what
// happened on the first run of the keyboard test in this pass — it's a sign
// the tour's own focus trap works, not a test bug, but this helper is needed
// so the traversal test can get past it to the actual Assessment surface).
async function dismissTourModalIfPresent(page: Page) {
  const skipTour = page.getByRole('button', { name: /Skip tour|Skip for now|Pomiń/i }).first();
  for (let i = 0; i < 12; i++) {
    const visible = await skipTour.isVisible().catch(() => false);
    if (!visible) return;
    await skipTour.click({ timeout: 1500, force: true }).catch(() => {});
    await page.waitForTimeout(200);
  }
}

async function gotoAssessmentSurface(page: Page, surface: (typeof ASM_SURFACES)[number]) {
  await page.goto(`/assessment?tab=${surface}`);
  await page.waitForLoadState('networkidle');
  await dismissTourModalIfPresent(page);
  // AssessmentHub's own Menu-2 tab pill for this surface must be the active
  // one — proves the URL-sync contract (ASM-001A), not just "some page
  // rendered". Scoped to the `role="tablist" aria-label="Module sections"`
  // (ModuleNavBar.tsx) because the Outputs surface embeds its OWN nested
  // Outputs/Reports/Initiatives sub-tablist with an overlapping "Outputs"
  // label — an unscoped getByRole('tab', {name}) matches both and Playwright
  // (correctly) refuses the ambiguity.
  await expect(
    page.getByRole('tablist', { name: 'Module sections' }).getByRole('tab', {
      name: new RegExp(surface, 'i'),
    })
  ).toHaveAttribute('aria-selected', 'true', { timeout: 15000 });
}

async function setColorScheme(page: Page, theme: 'light' | 'dark') {
  await page.evaluate((t) => {
    document.documentElement.classList.toggle('dark', t === 'dark');
    document.documentElement.style.colorScheme = t;
  }, theme);
  // MainLayout/shared controls animate theme colors for ~300ms — settle
  // before screenshot/axe so a mid-transition frame is never captured as if
  // it were a passing/failing contrast state (see ideas-navigation-matrix
  // .spec.ts, which hit exactly this race first).
  await page.waitForTimeout(400);
}

test.describe('ASM-UI-CANON-001 — five surfaces canon', () => {
  test.describe.configure({ retries: 0 });

  test('default state (light, EN) across all three canon viewports', async ({ page }) => {
    test.setTimeout(180000);
    fs.mkdirSync(ASM_EVIDENCE_DIR, { recursive: true });

    for (const vp of ASM_VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      for (const surface of ASM_SURFACES) {
        await gotoAssessmentSurface(page, surface);
        await page.screenshot({
          path: path.join(ASM_EVIDENCE_DIR, `${surface}--${vp.name}--light--en.png`),
          fullPage: true,
        });
      }
    }
  });

  test('theme (dark) and language (pl) coverage at desktop viewport', async ({ page }) => {
    test.setTimeout(180000);
    fs.mkdirSync(ASM_EVIDENCE_DIR, { recursive: true });
    await page.setViewportSize({ width: 1440, height: 900 });

    // Dark, EN — every surface.
    for (const surface of ASM_SURFACES) {
      await gotoAssessmentSurface(page, surface);
      await setColorScheme(page, 'dark');
      await page.screenshot({
        path: path.join(ASM_EVIDENCE_DIR, `${surface}--desktop-1440x900--dark--en.png`),
        fullPage: true,
      });
    }
    await setColorScheme(page, 'light');

    // Light, PL — every surface. i18nextLng is the same localStorage key
    // tests/e2e/i18n/language-switch.spec.ts uses; set via addInitScript so
    // it's present before the app boots on every subsequent goto in this test.
    await page.addInitScript(() => localStorage.setItem('i18nextLng', 'pl'));
    for (const surface of ASM_SURFACES) {
      await gotoAssessmentSurface(page, surface);
      await page.screenshot({
        path: path.join(ASM_EVIDENCE_DIR, `${surface}--desktop-1440x900--light--pl.png`),
        fullPage: true,
      });
    }
  });

  test('axe (critical/serious) — light+dark, EN, desktop, all five surfaces', async ({ page }) => {
    test.setTimeout(180000);
    fs.mkdirSync(ASM_EVIDENCE_DIR, { recursive: true });
    await page.setViewportSize({ width: 1440, height: 900 });

    const evidence: Array<{
      surface: string;
      theme: 'light' | 'dark';
      violations: Array<{
        id: string;
        impact: string | null | undefined;
        help: string;
        nodes: number;
        targets: string[][];
        summary: (string | undefined)[];
      }>;
    }> = [];

    for (const theme of ['light', 'dark'] as const) {
      for (const surface of ASM_SURFACES) {
        await gotoAssessmentSurface(page, surface);
        await setColorScheme(page, theme);
        const result = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();
        const blocking = result.violations
          .filter((v) => v.impact === 'critical' || v.impact === 'serious')
          .map((v) => ({
            id: v.id,
            impact: v.impact,
            help: v.help,
            nodes: v.nodes.length,
            targets: v.nodes.map((n) => n.target),
            summary: v.nodes.map((n) => n.failureSummary),
          }));
        evidence.push({ surface, theme, violations: blocking });
      }
    }

    fs.writeFileSync(
      path.join(ASM_EVIDENCE_DIR, 'axe-results.json'),
      `${JSON.stringify(evidence, null, 2)}\n`
    );

    // Fail the run on any critical/serious violation — same bar
    // ideas-navigation-matrix.spec.ts already holds this module to.
    expect(evidence.flatMap((e) => e.violations)).toEqual([]);
  });

  test('keyboard traversal, visible focus, and focus return — New Assessment modal', async ({
    page,
  }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoAssessmentSurface(page, 'processes');

    // Real empty-org state (fresh test-support bootstrap has zero
    // assessments) surfaces "New Assessment" in the module bar — locate it
    // by accessible role+name, not a CSS/testid guess.
    const newAssessmentBtn = page.getByRole('button', { name: /New Assessment/i }).first();
    await expect(newAssessmentBtn).toBeVisible();

    // Tab from the search box forward until the New Assessment trigger gets
    // real keyboard focus — proves it's actually in tab order, not just
    // clickable.
    await page.keyboard.press('Tab');
    let reachedTrigger = false;
    let lastFocused = '';
    for (let i = 0; i < 60; i++) {
      const isFocused = await newAssessmentBtn.evaluate((el) => el === document.activeElement);
      if (isFocused) {
        reachedTrigger = true;
        break;
      }
      lastFocused = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el) return '<none>';
        return `${el.tagName}#${el.id || ''}.${el.className || ''}:"${(el.textContent || '').slice(0, 40)}"`;
      });
      await page.keyboard.press('Tab');
    }
    expect(reachedTrigger, `New Assessment trigger never got focus in 60 Tabs; last focused was ${lastFocused}`).toBe(true);
    // Visible focus ring — c-focus token per CLAUDE.md UI canon (never the
    // browser's invisible default outline:none-with-no-replacement).
    const outlineOrRing = await newAssessmentBtn.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { outline: cs.outlineStyle, outlineWidth: cs.outlineWidth, boxShadow: cs.boxShadow };
    });
    expect(
      outlineOrRing.outline !== 'none' || outlineOrRing.boxShadow !== 'none',
      `expected a visible focus indicator on New Assessment trigger, got ${JSON.stringify(outlineOrRing)}`
    ).toBe(true);

    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await page.screenshot({
      path: path.join(ASM_EVIDENCE_DIR, 'processes--new-assessment-modal--desktop--light--en.png'),
      fullPage: true,
    });

    // Focus must have moved INTO the dialog (real focus trap entry), not
    // stayed on the (now hidden) trigger behind it.
    const focusInsideDialog = await page.evaluate(
      () => document.activeElement?.closest('[role="dialog"]') != null
    );
    expect(focusInsideDialog).toBe(true);

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    // Focus return: closing the modal must hand focus back to the trigger
    // that opened it, not drop it to <body>.
    await expect(newAssessmentBtn).toBeFocused();
  });
});
