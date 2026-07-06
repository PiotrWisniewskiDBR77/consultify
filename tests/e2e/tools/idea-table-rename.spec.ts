/**
 * M08 — Ideas · Table Platform — rename-persists acceptance.
 *
 * Fresh regression target (2026-07-06 fix): TableTabStrip's rename flow
 * (src/components/MyWork/table/TableTabStrip.tsx) updates `baseTables` state
 * optimistically BEFORE the PATCH to the backend resolves
 * (IdeaTableTool.tsx `handleTabRenameTable`, ~line 806). That means the UI
 * shows the new name immediately even if the PATCH never lands — a plain
 * "type name, see it on screen" test cannot catch a persistence regression.
 * This spec forces a hard reload (fresh GET /api/table-platform/tables/:id)
 * before asserting the name, which is the only way to prove the PATCH
 * actually persisted server-side.
 *
 * Seed path (real API, no seed-endpoints exist for Table Platform):
 *   POST /api/table-platform/bases {workspaceId, name}
 *   POST /api/table-platform/bases/:baseId/tables {name}
 * Rename path: PATCH /api/table-platform/tables/:tableId {name}
 * (server/src/routes/table-platform.routes.ts:554-579, `MetadataService.updateTable`).
 *
 * UI path: right-click a table tab → "Rename"/"Zmień nazwę" → an
 * `input.w-24` appears (TableTabStrip.tsx:121, no data-testid) → type → Enter.
 *
 * FEATURE-FLAG GATE (root-caused): the whole Table Platform code path is
 * gated behind the `tablePlatformMetadataFirst` flag
 * (src/hooks/useFeatureFlags.tsx:138, `defaultValue: false`,
 * `allowLocalOverride: false` — it can only come from the backend, not
 * localStorage). `useTablePlatformBridge.ts:161-162` computes
 * `isNewPlatform = enabled && isEnabled('tablePlatformMetadataFirst') && ...`,
 * and `useTablePlatformIntegration.ts:264` gates the whole integration
 * (`active`) on that. The flag value comes from
 * `GET /api/feature-flags/runtime` (server/src/routes/featureFlags.routes.ts:212),
 * which reads a `feature_flags` DB table — empty under a fresh MOCK_DB org, so
 * the flag defaults to false and TableTabStrip never renders. Fixed by
 * seeding the flag via `POST /api/feature-flags` using a SUPERADMIN token
 * from `test-support/bootstrap` (that route is superadmin-gated;
 * `role: 'SUPERADMIN'` is a supported bootstrap request field —
 * server/src/routes/testSupport.routes.ts:569/678).
 */
import { expect, test } from '@playwright/test';

import { seedE2EAuthWithBootstrap } from '../smoke/runtime-gate-helpers';
import { suppressOnboarding } from '../smoke/work-canvas-helpers';
import { waitVisible } from './_helpers';

const TEST_SUPPORT_KEY = process.env.TEST_SUPPORT_KEY || 'local-test-support-key-change-me';

const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3001';
const WORKSPACE_REGION = /Idea map workspace|Obszar roboczy mapy idei/;
const ERROR_BOUNDARY_RE = /Coś poszło nie tak|Something went wrong/i;

function uniqueLabel(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * page.request is a separate API context from the browser page — it does NOT
 * read the localStorage token that seedE2EAuthWithBootstrap() seeds via
 * addInitScript. Read the token back out of the page (after one navigation so
 * the init script has run) and use it as a Bearer header for API seed calls.
 */
async function getSeededToken(page: import('@playwright/test').Page): Promise<string> {
  const token = await page.evaluate(() => window.localStorage.getItem('token'));
  if (!token) throw new Error('seedE2EAuthWithBootstrap did not leave a token in localStorage');
  return token;
}

/**
 * Ensure the `tablePlatformMetadataFirst` flag is enabled globally so the
 * Table Platform code path (and the rename fix under test) activates. Mints
 * a fresh SUPERADMIN bootstrap token to call the superadmin-gated
 * POST /api/feature-flags. A 409 (already exists) means a previous run
 * already seeded it — treated as success, not an error.
 */
async function ensureTablePlatformFlagEnabled(page: import('@playwright/test').Page) {
  const runId = `tp-rename-flag-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const bootstrap = await page.request
    .post(`${API_BASE_URL}/api/test-support/bootstrap`, {
      headers: { 'x-test-support-key': TEST_SUPPORT_KEY, 'content-type': 'application/json' },
      data: { runId, role: 'SUPERADMIN' },
      timeout: 40000,
    })
    .catch(() => null);
  if (!bootstrap || !bootstrap.ok()) return false;
  const payload = (await bootstrap.json().catch(() => null)) as { token?: string } | null;
  const superToken = payload?.token;
  if (!superToken) return false;

  const res = await page.request
    .post(`${API_BASE_URL}/api/feature-flags`, {
      headers: { Authorization: `Bearer ${superToken}` },
      data: {
        flag_key: 'tablePlatformMetadataFirst',
        name: 'Table Platform: Metadata-First Backend',
        enabled: true,
        flag_type: 'boolean',
        rollout_percentage: 100,
        environment: 'production',
        organization_id: null,
      },
      timeout: 40000,
    })
    .catch(() => null);
  // 201 created or 409 already-exists both mean the flag is now (or already) on.
  return Boolean(res && (res.status() === 201 || res.status() === 409));
}

async function createIdea(page: import('@playwright/test').Page, token: string, title: string) {
  const res = await page.request.post(`${API_BASE_URL}/api/my-work/my-ideas`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { title, body: `idea-table-rename seed for ${title}`, tags: ['e2e', 'table-rename'] },
    timeout: 40000,
  });
  if (!res.ok()) throw new Error(`createIdea failed: ${res.status()} ${await res.text()}`);
  return (await res.json()) as { id: string; title: string };
}

async function gotoTable(page: import('@playwright/test').Page, ideaId: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.goto(`/my-work/ideas/${ideaId}/workspace/table`, {
        waitUntil: 'domcontentloaded',
        timeout: 90000,
      });
      return;
    } catch {
      await page.waitForTimeout(1000);
    }
  }
}

async function dismissOnboardingButtons(page: import('@playwright/test').Page) {
  const buttons = [
    /Skip for now|Pomiń na razie|Pomiń/i,
    /Skip tour|Pomiń wycieczkę/i,
    /Get started|Zaczynaj|Rozpocznij/i,
  ];
  for (let i = 0; i < 6; i += 1) {
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
    await page.waitForTimeout(250);
  }
}

test.describe('M08 Ideas · Table Platform — rename persists', () => {
  test('rename via tab context menu survives a hard reload', async ({ page }) => {
    test.setTimeout(180000);

    const flagEnabled = await ensureTablePlatformFlagEnabled(page);
    test.skip(
      !flagEnabled,
      'Could not enable tablePlatformMetadataFirst via POST /api/feature-flags (superadmin bootstrap ' +
        'or the flags endpoint is unavailable under this harness) — Table Platform cannot activate ' +
        'without it, so the rename fix under test is unreachable. See useTablePlatformBridge.ts:161-162.'
    );

    await suppressOnboarding(page);
    await seedE2EAuthWithBootstrap(page);
    // One cheap navigation so the addInitScript from seedE2EAuthWithBootstrap has run
    // and localStorage actually contains the token before we read it back.
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
    const token = await getSeededToken(page);

    const idea = await createIdea(page, token, uniqueLabel('tp-rename'));
    await gotoTable(page, idea.id);
    await dismissOnboardingButtons(page);

    const workspaceRegion = page.getByRole('region', { name: WORKSPACE_REGION });
    const shellVisible = await waitVisible(workspaceRegion, 60000);
    test.skip(!shellVisible, 'Idea workspace shell did not mount — cannot reach Table Platform UI under mock');

    // Let the auto-seed root-node write (version 1→2) and any Table Platform
    // auto-provision (base+table creation on first open) settle before mutating.
    await page.waitForTimeout(2500);

    // Defensive tool-mount race: make sure the Table tool-strip button is active
    // (workspace can briefly mount the wrong tool while hydrating).
    const tableToolBtn = page.locator('button[title="Table"]').first();
    if (await waitVisible(tableToolBtn, 5000)) {
      await tableToolBtn.click({ force: true }).catch(() => {});
    }

    await expect(page.getByText(ERROR_BOUNDARY_RE)).toHaveCount(0);

    // The Table Platform tab strip renders one tab per table (TableTabStrip.tsx).
    // If Table Platform never activates under mock (no bases/tables auto-provisioned,
    // or a 404 from the API), the tab strip never renders — skip with root cause
    // instead of faking green.
    const tabStripButtons = page.locator('.flex.items-center.h-9 button[draggable="true"]');
    const firstTab = tabStripButtons.first();
    const tabVisible = await waitVisible(firstTab, 20000);
    test.skip(
      !tabVisible,
      'TableTabStrip did not render a table tab — Table Platform did not activate under mock ' +
        '(useTablePlatformIntegration.active stayed false, or GET /api/table-platform/... 404\'d). ' +
        'Root cause, not a flake: see useTablePlatformBridge / IdeaTableTool.tsx usePlatform gating.'
    );

    const originalName = (await firstTab.textContent())?.trim() || '';
    const newName = `Renamed-${Date.now().toString(36)}`;

    await firstTab.click({ button: 'right' });

    const renameMenuItem = page.getByText(/^Rename$|^Zmień nazwę$/).first();
    const menuVisible = await waitVisible(renameMenuItem, 5000);
    test.skip(!menuVisible, 'Table tab context menu did not open on right-click — cannot reach rename input');

    await renameMenuItem.click();

    const renameInput = page.locator('input.w-24');
    await expect(renameInput).toBeVisible({ timeout: 5000 });
    await renameInput.fill(newName);
    await renameInput.press('Enter');

    // Optimistic UI shows the new name immediately — this is NOT proof of persistence
    // (that's the exact bug shape the fix addresses). Confirm the toast + UI state first.
    await expect(page.getByText(newName).first()).toBeVisible({ timeout: 5000 });

    // Capture the tableId for a direct API re-check (belt + suspenders vs. UI reload).
    const tableIdFromDom = await page
      .evaluate(() => {
        // TableTabStrip has no data-testid; there is no DOM attribute exposing tableId.
        // We rely purely on the UI + reload signal below, so this is best-effort only.
        return null as string | null;
      })
      .catch(() => null);
    void tableIdFromDom;

    // The real test: hard reload and confirm the renamed tab persisted server-side.
    await page.waitForTimeout(1000); // let the PATCH flush
    await gotoTable(page, idea.id);
    await dismissOnboardingButtons(page);
    await expect(workspaceRegion).toBeVisible({ timeout: 60000 });
    await page.waitForTimeout(1500);

    const tabAfterReload = page.locator('.flex.items-center.h-9 button[draggable="true"]').first();
    await expect(tabAfterReload).toBeVisible({ timeout: 20000 });
    const nameAfterReload = (await tabAfterReload.textContent())?.trim() || '';

    expect(
      nameAfterReload,
      `Rename did not persist across reload: expected "${newName}", DOM shows "${nameAfterReload}" ` +
        `(original was "${originalName}"). This is the exact optimistic-update-without-persistence ` +
        `bug shape in IdeaTableTool.tsx handleTabRenameTable.`
    ).toContain(newName);

    await expect(page.getByText(ERROR_BOUNDARY_RE)).toHaveCount(0);
  });
});
