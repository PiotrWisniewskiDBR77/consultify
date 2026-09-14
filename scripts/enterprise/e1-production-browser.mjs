import fs from 'node:fs/promises';
import path from 'node:path';

import { chromium } from '@playwright/test';

const baseUrl = process.env.E1_PREVIEW_URL || 'http://127.0.0.1:5215';
const outDir = path.resolve(
  process.env.E1_BROWSER_EVIDENCE_DIR || 'evidence/f2-e-enterprise/e1/production-browser'
);

await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const evidence = [];

for (const locale of ['pl', 'de']) {
  const context = await browser.newContext({ locale: locale === 'pl' ? 'pl-PL' : 'de-DE' });
  const page = await context.newPage();
  const apiRequests = [];
  const pageErrors = [];
  const consoleErrors = [];
  let startCount = 0;
  const user = {
    id: `superadmin-${locale}`,
    email: `superadmin-${locale}@example.test`,
    role: 'SUPERADMIN',
    organizationId: 'admin-org',
    organizationName: 'Admin',
    language: locale,
    isAuthenticated: true,
  };

  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await page.addInitScript(({ locale: requestedLocale, user: storedUser }) => {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
    const payload = btoa(
      JSON.stringify({
        id: storedUser.id,
        email: storedUser.email,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      })
    )
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
    localStorage.setItem(
      'token',
      `${header}.${payload}.e1-browser-signature`
    );
    localStorage.setItem('user', JSON.stringify(storedUser));
    localStorage.setItem('i18nextLng', requestedLocale);
    localStorage.setItem('consultify_account_language', requestedLocale);
    localStorage.setItem(
      'consultify-storage',
      JSON.stringify({
        state: {
          currentUser: storedUser,
          currentOrganization: { id: 'admin-org', name: 'Admin' },
          theme: 'light',
        },
        version: 2,
      })
    );
  }, { locale, user });

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;
    apiRequests.push(`${request.method()} ${pathname}`);

    const json = (body, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });

    if (pathname === '/api/auth/me') return json({ user });
    if (pathname === '/api/organizations/current') {
      return json({
        organizations: [
          { id: 'admin-org', name: 'Admin', role: 'SUPERADMIN', is_current: true },
        ],
      });
    }
    if (pathname === '/api/superadmin/organizations') {
      return json({
        organizations: [
          {
            id: 'org-a',
            name: 'Northstar Manufacturing',
            organization_name: 'Northstar Manufacturing',
            plan: 'enterprise',
            status: 'active',
            user_count: 12,
            created_at: '2026-01-01T00:00:00.000Z',
          },
        ],
      });
    }
    if (pathname === '/api/superadmin/access-requests') return json({ requests: [] });
    if (pathname === '/api/superadmin/access-codes') return json({ codes: [] });
    if (pathname === '/api/superadmin/signals') return json([]);
    if (pathname === '/api/feedback') return json([]);
    if (pathname === '/api/superadmin/platform-stats') {
      return json({
        timestamp: '2026-09-13T00:00:00.000Z',
        infrastructure: { dbSizeMB: 1 },
        users: {
          activeNow: 1,
          totalUsers: 1,
          totalOrgs: 1,
          todaySignups: 0,
          todayLogins: 1,
          recentSignups: [],
        },
        business: {
          trialsExpiring: 0,
          trialsExpiringSoonList: [],
          overdueInvoices: 0,
          overdueInvoicesList: [],
          pendingFeedback: 0,
          recentFeedback: [],
        },
        security: {
          failedLoginsLastHour: 0,
          failedLoginsList: [],
          suspiciousIPs: 0,
          apiErrors15Min: 0,
          recentErrors: [],
        },
        performance: {
          avgApiLatencyMs: 1,
          slowQueries: 0,
          slowQueriesList: [],
          aiRequestsToday: 0,
          aiTokensToday: 0,
          aiErrorsToday: 0,
        },
      });
    }
    if (pathname === '/api/system-health') {
      return json({ database: { connected: true, latency: 1 } });
    }
    if (pathname === '/api/llm/health/detailed') return json({ providers: [] });
    if (pathname === '/api/superadmin/organizations/org-a/export-jobs' && request.method() === 'POST') {
      startCount += 1;
      const id = startCount === 1 ? 'job-a' : startCount === 2 ? 'job-fail' : 'job-retry';
      return json({ job: { id, phase: 'queued' }, resumeToken: `resume-${id}` });
    }
    if (pathname === '/api/superadmin/organizations/org-a/export-jobs/job-fail') {
      return json({
        id: 'job-fail',
        organizationId: 'org-a',
        phase: 'failed',
        completedTables: 12,
        totalTables: 1524,
        rows: 21,
        percent: 1,
        errorCode: 'E1_TEST_FAILURE',
      });
    }
    if (
      pathname === '/api/superadmin/organizations/org-a/export-jobs/job-a' ||
      pathname === '/api/superadmin/organizations/org-a/export-jobs/job-retry'
    ) {
      const id = pathname.endsWith('job-retry') ? 'job-retry' : 'job-a';
      return json({
        id,
        organizationId: 'org-a',
        phase: 'ready',
        completedTables: 1524,
        totalTables: 1524,
        rows: 42,
        percent: 100,
      });
    }
    if (/\/api\/superadmin\/organizations\/org-a\/export-jobs\/(?:job-a|job-retry)\/download$/.test(pathname)) {
      return route.fulfill({
        status: 200,
        contentType: 'application/zip',
        headers: { 'content-disposition': 'attachment; filename="organization-export-org-a.zip"' },
        body: Buffer.from('PK\u0003\u0004e1-browser-proof'),
      });
    }

    // Providers outside this acceptance path fail soft. A successful empty object keeps the
    // browser proof focused on the production Organizations route rather than a custom harness.
    return json({});
  });

  const routeUrl = `${baseUrl}/superadmin/customers/organizations`;
  const response = await page.goto(routeUrl, { waitUntil: 'domcontentloaded' });
  try {
    await page.getByText('Northstar Manufacturing', { exact: true }).waitFor({ timeout: 15_000 });
  } catch (error) {
    await page.screenshot({ path: path.join(outDir, `${locale}-load-failure.png`), fullPage: true });
    await fs.writeFile(
      path.join(outDir, `${locale}-load-failure.json`),
      `${JSON.stringify({ url: page.url(), apiRequests, pageErrors, consoleErrors, body: (await page.locator('body').innerText()).slice(0, 4000) }, null, 2)}\n`
    );
    throw error;
  }

  const row = page.getByRole('row').filter({ hasText: 'Northstar Manufacturing' });
  const trigger = row.locator('button[aria-haspopup="menu"]').last();
  await trigger.click();

  const action = locale === 'pl' ? 'Eksportuj dane' : 'Daten exportieren';
  const ready =
    locale === 'pl'
      ? 'Eksport organizacji jest gotowy (42 wierszy).'
      : 'Der Organisationsexport ist fertig (42 Zeilen).';

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: action }).click();
  const download = await downloadPromise;
  await page.getByRole('main').getByText(ready, { exact: true }).waitFor({ timeout: 10_000 });
  const downloadPath = path.join(outDir, `${locale}-organization-export.zip`);
  await download.saveAs(downloadPath);
  await page.screenshot({ path: path.join(outDir, `${locale}-ready.png`), fullPage: true });

  // Exercise the production failure surface after the successful archive flow.
  await trigger.click();
  await page.getByRole('menuitem', { name: action }).click();
  const failed =
    locale === 'pl'
      ? 'Eksport organizacji nie powiódł się (E1_TEST_FAILURE). Możesz spróbować ponownie.'
      : 'Der Organisationsexport ist fehlgeschlagen (E1_TEST_FAILURE). Sie können es erneut versuchen.';
  const retry = locale === 'pl' ? 'Ponów eksport' : 'Export erneut versuchen';
  await page.getByRole('alert').getByText(failed, { exact: true }).waitFor({ timeout: 10_000 });
  const preparing =
    locale === 'pl'
      ? 'Przygotowywanie pełnego eksportu organizacji…'
      : 'Der vollständige Organisationsexport wird vorbereitet…';
  if (await page.getByText(preparing, { exact: true }).count()) {
    throw new Error(`${locale}: failed state contradicts itself with Preparing copy`);
  }
  const failedStateReadyCount = await page.getByText(ready, { exact: true }).count();
  if (failedStateReadyCount) {
    throw new Error(`${locale}: failed state retains the previous ready/success message`);
  }
  await page.screenshot({ path: path.join(outDir, `${locale}-failed-retry.png`), fullPage: true });
  const retryDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: retry }).click();
  await retryDownloadPromise;
  await page.getByRole('main').getByText(ready, { exact: true }).waitFor({ timeout: 10_000 });

  const assetSrc = await page.locator('script[src*="/assets/"]').first().getAttribute('src');
  const result = {
    locale,
    routeUrl,
    httpStatus: response?.status() ?? null,
    renderedPath: new URL(page.url()).pathname,
    htmlLang: await page.locator('html').getAttribute('lang'),
    assetSrc,
    action,
    ready,
    failed,
    retry,
    failedStatePreparingCount: 0,
    failedStateReadyCount,
    retryRecovered: true,
    suggestedFilename: download.suggestedFilename(),
    downloadedBytes: (await fs.stat(downloadPath)).size,
    apiRequests,
    pageErrors,
    consoleErrors,
  };
  evidence.push(result);
  await fs.writeFile(path.join(outDir, `${locale}.json`), `${JSON.stringify(result, null, 2)}\n`);
  await context.close();
}

await browser.close();
await fs.writeFile(path.join(outDir, 'summary.json'), `${JSON.stringify(evidence, null, 2)}\n`);

if (evidence.some((item) => item.pageErrors.length > 0)) {
  throw new Error('Production browser proof recorded page errors; inspect summary.json');
}

console.log(JSON.stringify(evidence.map(({ locale, renderedPath, action, ready, downloadedBytes }) => ({
  locale,
  renderedPath,
  action,
  ready,
  downloadedBytes,
})), null, 2));
