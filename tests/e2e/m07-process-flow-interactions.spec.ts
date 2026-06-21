/**
 * M07 — Process Flow — REAL-MOUSE interaction acceptance.
 *
 * Drives the canvas with real pointer/mouse events (ReactFlow ignores synthetic
 * clicks for selection/drag). Runs against a WRITE-ACCESS harness:
 *   E2E_API_URL=http://127.0.0.1:3009  (backend with ENABLE_TEST_SUPPORT, staging DB)
 *   E2E_BASE_URL=http://localhost:3011 (frontend → :3009)
 *   E2E_REQUIRE_TEST_SUPPORT=true      (global-setup mints a full non-demo token)
 * register-demo gives a read-only DEMO session, so test-support is required to edit.
 *
 * Covers TESTY_M07 interaction scenarios that need real mouse: §3 add shapes,
 * §4.2 step metrics, §6.1 drag-to-connect, §19.1 reload-persistence.
 */
import fs from 'node:fs';
import path from 'node:path';

import { APIResponse, expect, Page, test } from '@playwright/test';

import { readTestSupportState } from './_helpers/testSupportState';

const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3009';
const TEST_SUPPORT_KEY = process.env.TEST_SUPPORT_KEY || 'local-test-support-key-change-me';
const SHOTS_DIR = path.resolve('docs/qa/screens/m07-headless-2026-06-20');
const ERROR_BOUNDARY_RE = /Coś poszło nie tak|Something went wrong/i;
const WORKSPACE_REGION = /Idea map workspace|Obszar roboczy mapy idei/;

fs.mkdirSync(SHOTS_DIR, { recursive: true });

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'content-type': 'application/json' };
}
function uniqueLabel(p: string) {
  return `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
async function shot(page: Page, id: string) {
  await page.screenshot({ path: path.join(SHOTS_DIR, `${id}.png`), fullPage: false });
}

async function createIdea(page: Page, token: string, title: string) {
  const res: APIResponse = await page.request.post(`${API_BASE_URL}/api/my-work/my-ideas`, {
    headers: authHeaders(token),
    data: { title, tags: ['m07', 'interactions'] },
    timeout: 40000,
  });
  if (!res.ok()) throw new Error(`createIdea failed: ${res.status()} ${await res.text()}`);
  return (await res.json()) as { id: string; title: string };
}
async function seedProcessFlow(page: Page, token: string, ideaId: string) {
  await page.request
    .put(`${API_BASE_URL}/api/my-work/my-ideas/${ideaId}/map`, {
      headers: authHeaders(token),
      data: { nodes: [], edges: [], version: 1, preferredTool: 'process_flow' },
      timeout: 40000,
    })
    .catch(() => null);
}

async function openCanvas(page: Page, label: string) {
  const { token, userId } = readTestSupportState();
  await page.addInitScript((uid) => {
    try {
      if (uid) localStorage.setItem(`consultify_onboarding_done:${uid}`, 'true');
    } catch {
      /* noop */
    }
  }, userId);
  const idea = await createIdea(page, token, uniqueLabel(label));
  await seedProcessFlow(page, token, idea.id);
  await page.goto(`/my-work/ideas/${idea.id}/workspace/process_flow`, {
    waitUntil: 'domcontentloaded',
    timeout: 90000,
  });
  await expect(page.getByRole('region', { name: WORKSPACE_REGION })).toBeVisible({ timeout: 60000 });
  await expect(page.locator('.react-flow').first()).toBeVisible({ timeout: 60000 });
  return idea;
}

/** Real toolbar click to add a shape (button has title attr). */
async function addShape(page: Page, title: string) {
  const before = await page.locator('.react-flow__node').count();
  await page.locator(`button[title="${title}"]`).first().click();
  await expect(page.locator('.react-flow__node')).toHaveCount(before + 1, { timeout: 15000 });
}

test.describe('M07 Process Flow — real-mouse interactions', () => {
  test('§3 add Start + Action via toolbar (real clicks) persist after reload', async ({ page }) => {
    test.setTimeout(180000);
    const idea = await openCanvas(page, 'm07i-add');
    // empty-state "Add start" first, then toolbar shapes
    const addStart = page.getByRole('button', { name: /Add start|Dodaj start/i }).first();
    if (await addStart.isVisible().catch(() => false)) {
      await addStart.click();
      await expect(page.locator('.react-flow__node')).toHaveCount(1, { timeout: 15000 });
    } else {
      await addShape(page, 'Start');
    }
    await addShape(page, 'Action');
    await shot(page, 'i1-two-nodes');
    await expect(page.getByText(ERROR_BOUNDARY_RE)).toHaveCount(0);

    // reload → both persist (autosave)
    await page.waitForTimeout(3500); // > 2.5s autosave debounce
    await page.goto(`/my-work/ideas/${idea.id}/workspace/process_flow`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.react-flow').first()).toBeVisible({ timeout: 60000 });
    await expect(page.locator('.react-flow__node')).toHaveCount(2, { timeout: 30000 });
    await shot(page, 'i2-persisted-after-reload');
  });

  test('§4.2 selecting a node opens properties with step-metric fields', async ({ page }) => {
    test.setTimeout(180000);
    await openCanvas(page, 'm07i-props');
    const addStart = page.getByRole('button', { name: /Add start|Dodaj start/i }).first();
    if (await addStart.isVisible().catch(() => false)) await addStart.click();
    else await addShape(page, 'Action');
    const node = page.locator('.react-flow__node').first();
    await expect(node).toBeVisible({ timeout: 15000 });
    await node.click(); // REAL click → ReactFlow selection
    await page.keyboard.press('F2'); // open properties for selected node
    await page.waitForTimeout(800);
    await shot(page, 'i3-properties-open');
    // The properties panel should show node-type / step-metric affordances.
    const metricsVisible = await page
      .getByText(/Czas|Time|Koszt|Cost|FTE|Automation|Oszczęd|Savings|Typ węzła|Node type/i)
      .first()
      .isVisible()
      .catch(() => false);
    expect(metricsVisible, 'step-metric / node-type fields should render when a node is selected').toBe(true);
  });

  test('§6.1 drag-to-connect two nodes creates an edge that persists', async ({ page }) => {
    test.setTimeout(200000);
    const idea = await openCanvas(page, 'm07i-connect');
    const addStart = page.getByRole('button', { name: /Add start|Dodaj start/i }).first();
    if (await addStart.isVisible().catch(() => false)) await addStart.click();
    else await addShape(page, 'Start');
    await expect(page.locator('.react-flow__node')).toHaveCount(1, { timeout: 15000 });
    await addShape(page, 'Action');
    await expect(page.locator('.react-flow__node')).toHaveCount(2, { timeout: 15000 });

    // Drag from a source handle of node 1 to a target handle of node 2 (real mouse).
    const sourceHandle = page.locator('.react-flow__node').nth(0).locator('.react-flow__handle.source, .react-flow__handle-right, .react-flow__handle').last();
    const targetHandle = page.locator('.react-flow__node').nth(1).locator('.react-flow__handle.target, .react-flow__handle-left, .react-flow__handle').first();
    const s = await sourceHandle.boundingBox();
    const t = await targetHandle.boundingBox();
    if (!s || !t) throw new Error('handles not found for drag-to-connect');
    await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2);
    await page.mouse.down();
    await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 12 });
    await page.mouse.up();

    await expect(page.locator('.react-flow__edge')).toHaveCount(1, { timeout: 15000 });
    await shot(page, 'i4-edge-created');

    // reload → edge persists
    await page.waitForTimeout(3500);
    await page.goto(`/my-work/ideas/${idea.id}/workspace/process_flow`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.react-flow').first()).toBeVisible({ timeout: 60000 });
    await expect(page.locator('.react-flow__edge')).toHaveCount(1, { timeout: 30000 });
    await shot(page, 'i5-edge-persisted');
  });
});
