#!/usr/bin/env node

import { chromium } from 'playwright';

const FRONTEND_URL = 'http://localhost:3100';
const BACKEND_URL = 'http://localhost:3101/api';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function createIdea(title, token) {
  const res = await fetch(`${BACKEND_URL}/my-work/my-ideas`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) {
    throw new Error(`create idea failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function fetchMap(ideaId, token) {
  const res = await fetch(`${BACKEND_URL}/my-work/my-ideas/${encodeURIComponent(ideaId)}/map?language=en`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    throw new Error(`fetch map failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

function toBase64Url(value) {
  return Buffer.from(JSON.stringify(value))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function buildE2EToken() {
  const now = Math.floor(Date.now() / 1000);
  return `${toBase64Url({ alg: 'none', typ: 'JWT' })}.${toBase64Url({
    id: 'e2e-user-id',
    email: 'e2e@local.test',
    name: 'E2E User',
    role: 'ADMIN',
    organizationId: 'e2e-org-id',
    organizationName: 'E2E Organization',
    e2e: true,
    iat: now,
    exp: now + 60 * 60,
  })}.x`;
}

async function waitForNodeCount(page, expected, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const count = await page.evaluate(() => {
      return document.querySelectorAll('.react-flow__node').length;
    });
    if (count === expected) return count;
    await sleep(250);
  }
  return page.evaluate(() => document.querySelectorAll('.react-flow__node').length);
}

async function waitForNodeIncrease(page, baseline, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const count = await page.evaluate(() => {
      return document.querySelectorAll('.react-flow__node').length;
    });
    if (count > baseline) return count;
    await sleep(250);
  }
  return page.evaluate(() => document.querySelectorAll('.react-flow__node').length);
}

async function main() {
  const title = `Mindmap verifier ${Date.now()}`;
  const e2eToken = buildE2EToken();
  const created = await createIdea(title, e2eToken);
  const ideaId = String(created?.id || created?.idea?.id || '').trim();

  if (!ideaId) {
    throw new Error(`missing idea id in create response: ${JSON.stringify(created)}`);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const e2eUser = {
    id: 'e2e-user-id',
    email: 'e2e@local.test',
    name: 'E2E User',
    firstName: 'E2E',
    lastName: 'User',
    role: 'ADMIN',
    organizationId: 'e2e-org-id',
    organizationName: 'E2E Organization',
  };
  await context.addInitScript(
    ({ token, user }) => {
      window.localStorage.setItem('token', token);
      window.localStorage.setItem('user', JSON.stringify(user));
    },
    { token: e2eToken, user: e2eUser }
  );
  await context.addCookies([
    {
      name: 'connect.sid',
      value: 'test-session-bypass',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ]);
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => {
    pageErrors.push(String(err?.message || err));
  });
  page.on('response', async (response) => {
    if (!response.ok() && response.url().includes('/api/my-work/my-ideas/')) {
      failedRequests.push(`${response.status()} ${response.url()}`);
    }
  });

  let initialUiCount = 0;
  let afterTabUiCount = 0;
  let afterRefreshUiCount = 0;
  let afterTabApiCount = 0;
  let afterRefreshApiCount = 0;
  let currentUrl = '';
  let pageTextSnippet = '';
  let caughtError = null;
  let triggerMethod = 'tab';
  let tabWorked = false;

  try {
    await page.goto(`${FRONTEND_URL}/my-work/ideas/${ideaId}/workspace/mindmap`, {
      waitUntil: 'networkidle',
    });
    currentUrl = page.url();

    await page.waitForSelector('.react-flow', { timeout: 15000 });
    initialUiCount = await waitForNodeCount(page, 6, 12000);

    await page.evaluate(() => {
      const surface = document.querySelector('[data-mm-surface="mindmap"]');
      if (surface instanceof HTMLElement) surface.focus();
    });
    await sleep(300);
    await page.evaluate(() => {
      const surface = document.querySelector('[data-mm-surface="mindmap"]');
      if (!(surface instanceof HTMLElement)) return;
      const event = new KeyboardEvent('keydown', {
        key: 'Tab',
        code: 'Tab',
        bubbles: true,
        cancelable: true,
      });
      surface.dispatchEvent(event);
    });
    afterTabUiCount = await waitForNodeIncrease(page, initialUiCount, 12000);

    if (afterTabUiCount > initialUiCount) {
      tabWorked = true;
    } else {
      triggerMethod = 'custom_event';
      await page.evaluate(() => {
        window.dispatchEvent(
          new CustomEvent('idea-mindmap-node-quick-action', {
            detail: { action: 'add_child', nodeId: 'branch-options' },
          })
        );
      });
      afterTabUiCount = await waitForNodeCount(page, 7, 12000);
      if (afterTabUiCount <= initialUiCount) {
        afterTabUiCount = await waitForNodeIncrease(page, initialUiCount, 12000);
      }
    }

    await sleep(2500);
    const afterTabMap = await fetchMap(ideaId, e2eToken);
    afterTabApiCount = Array.isArray(afterTabMap?.map?.nodes) ? afterTabMap.map.nodes.length : 0;

    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('.react-flow', { timeout: 15000 });
    afterRefreshUiCount = await waitForNodeCount(page, afterTabUiCount, 12000);

    await sleep(1500);
    const afterRefreshMap = await fetchMap(ideaId, e2eToken);
    afterRefreshApiCount = Array.isArray(afterRefreshMap?.map?.nodes)
      ? afterRefreshMap.map.nodes.length
      : 0;
  } catch (error) {
    caughtError = error;
  } finally {
    currentUrl = page.url();
    try {
      pageTextSnippet = String((await page.locator('body').textContent()) || '').slice(0, 500);
    } catch {
      pageTextSnippet = '';
    }
    if (!(initialUiCount >= 6 && afterTabUiCount > initialUiCount && afterRefreshUiCount === afterTabUiCount)) {
      try {
        await page.screenshot({ path: 'screenshots/verify-rec-map-blocker-failure.png', fullPage: true });
      } catch {
        /* ignore */
      }
    }
    await browser.close();
  }

  const pass =
    initialUiCount >= 6 &&
    afterTabUiCount > initialUiCount &&
    afterRefreshUiCount === afterTabUiCount &&
    afterTabApiCount === afterTabUiCount &&
    afterRefreshApiCount === afterTabUiCount &&
    caughtError == null &&
    consoleErrors.length === 0 &&
    pageErrors.length === 0 &&
    failedRequests.length === 0;

  console.log(JSON.stringify({
    pass,
    ideaId,
    error: caughtError ? String(caughtError?.message || caughtError) : null,
    triggerMethod,
    tabWorked,
    initialUiCount,
    afterTabUiCount,
    afterRefreshUiCount,
    afterTabApiCount,
    afterRefreshApiCount,
    currentUrl,
    pageTextSnippet,
    consoleErrors: consoleErrors.slice(0, 10),
    pageErrors: pageErrors.slice(0, 10),
    failedRequests: failedRequests.slice(0, 10),
  }, null, 2));

  if (!pass) process.exit(1);
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
