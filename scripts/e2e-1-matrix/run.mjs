#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

import {
  MODULES,
  ORG_NAMES,
  SURFACE_KINDS,
  matrixContract,
  parseVariant,
  routeMatchesModule,
  variantKey,
} from './contract.mjs';
import { validateVariantResult, writeVariantArtifacts } from './evidence.mjs';
import { isDomainMutationRequest } from './network.mjs';
import { settle as settleAndWait } from './settle.mjs';

const args = process.argv.slice(2);
const value = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};

if (args.includes('--plan')) {
  process.stdout.write(`${JSON.stringify(matrixContract(), null, 2)}\n`);
  process.exit(0);
}

const BASE = String(
  value('--base', process.env.E2E_BASE_URL || 'https://staging.consultify.ai')
).replace(/\/+$/, '');
const variant = parseVariant(value('--variant', process.env.E2E_VARIANT || ''));
const VARIANT = variantKey(variant);
const OUT = path.resolve(value('--out', path.join('test-results', 'e2e-1-matrix', VARIANT)));
const PREVIOUS = value('--previous', '');
const HEADLESS = value('--headed', '0') !== '1';
const SHA = process.env.GITHUB_SHA || process.env.E2E_APP_SHA || 'UNKNOWN';

const actorPrefix = variant.secretPrefix;
const email = process.env[`${actorPrefix}_EMAIL`];
const password = process.env[`${actorPrefix}_PASSWORD`];
if (!email || !password) {
  throw new Error(`Missing GitHub Secrets ${actorPrefix}_EMAIL / ${actorPrefix}_PASSWORD`);
}

const createPattern = /\b(create|new|add|utw[oó]rz|now[yae]|dodaj)\b/i;
const aiPattern = /\b(ai|teresa|assistant|generate|analy[sz]e|review|copilot)\b/i;
const kebabPattern = /\b(more|actions|options|menu|wi[eę]cej|akcje|opcje)\b/i;
const closePattern = /^(close|cancel|anuluj|zamknij)$/i;
function isDomainMutation(request) {
  return isDomainMutationRequest({ url: request.url(), method: request.method() }, BASE);
}

fs.mkdirSync(path.join(OUT, 'screenshots'), { recursive: true });

function readPrevious() {
  if (!PREVIOUS) return null;
  if (!fs.existsSync(PREVIOUS)) return null;
  const candidate = fs.statSync(PREVIOUS).isDirectory()
    ? path.join(PREVIOUS, 'result.json')
    : PREVIOUS;
  return fs.existsSync(candidate) ? JSON.parse(fs.readFileSync(candidate, 'utf8')) : null;
}

function slug(input) {
  return String(input)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 90);
}

async function api(page, request) {
  return page.evaluate(async (input) => {
    const token = localStorage.getItem('token');
    const response = await fetch(input.url, {
      method: input.method || 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: input.body ? JSON.stringify(input.body) : undefined,
      credentials: 'include',
      cache: 'no-store',
    });
    return { status: response.status, body: await response.json().catch(() => null) };
  }, request);
}

async function authenticate(page) {
  await page.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  const login = await api(page, {
    method: 'POST',
    url: '/api/auth/login',
    body: { email, password },
  });
  const token = login.body?.token;
  if (login.status !== 200 || !token)
    throw new Error(`Login failed (${login.status}) for ${variant.actor}`);
  await page.evaluate((nextToken) => localStorage.setItem('token', nextToken), token);

  const before = await api(page, { url: '/api/auth/me' });
  const beforeUser = before.body?.user || before.body || {};

  const organizations = await api(page, { url: '/api/organizations/current' });
  const list = organizations.body?.organizations || organizations.body || [];
  const targetName = ORG_NAMES[variant.org];
  const target = Array.isArray(list)
    ? list.find(
        (org) =>
          String(org.name || '')
            .trim()
            .toLowerCase() === targetName.toLowerCase()
      )
    : null;
  if (!target) throw new Error(`Organization ${targetName} unavailable for ${variant.actor}`);
  const switched = await api(page, {
    method: 'POST',
    url: '/api/auth/switch-organization',
    body: { organizationId: target.id },
  });
  if (switched.status !== 200) throw new Error(`Switch organization failed (${switched.status})`);
  if (switched.body?.token) {
    await page.evaluate(
      (nextToken) => localStorage.setItem('token', nextToken),
      switched.body.token
    );
  }
  const me = await api(page, { url: '/api/auth/me' });
  const user = me.body?.user || me.body || {};
  const actualRole = String(user.role || user.accessLevel || '').toUpperCase();
  if (user.organizationId !== target.id || actualRole !== variant.expectedRole) {
    throw new Error(
      `Principal mismatch: expected ${target.id}/${variant.expectedRole}, got ${user.organizationId}/${actualRole}`
    );
  }
  return {
    organizationId: target.id,
    organizationName: target.name,
    role: actualRole,
    userId: user.id,
    restoreOrganizationId:
      beforeUser.organizationId && beforeUser.organizationId !== target.id
        ? beforeUser.organizationId
        : null,
  };
}

async function restorePrincipal(page, principal) {
  if (!principal.restoreOrganizationId) return { required: false, restored: true };
  const response = await api(page, {
    method: 'POST',
    url: '/api/auth/switch-organization',
    body: { organizationId: principal.restoreOrganizationId },
  });
  return { required: true, restored: response.status === 200, status: response.status };
}

async function captureFlags(page) {
  const [runtime, v8] = await Promise.all([
    api(page, { url: '/api/feature-flags/runtime' }),
    api(page, { url: '/api/v8/admin/flags' }),
  ]);
  if (runtime.status !== 200) throw new Error(`Feature flags snapshot failed (${runtime.status})`);
  return {
    runtime: runtime.body?.flags || runtime.body || {},
    v8:
      v8.status === 200
        ? v8.body?.flags || v8.body?.data || v8.body || {}
        : { unavailableStatus: v8.status },
  };
}

async function setPresentationState(page, userId) {
  await page.evaluate(({ locale, theme, userId }) => {
    localStorage.setItem('i18nextLng', locale);
    localStorage.setItem('consultify_language', locale);
    localStorage.setItem('theme', theme);
    // DEC-590 (Wpis 39): the first-run onboarding modal covered every screen in
    // run 1 (147/154 FAIL on locator.click timeout). useFirstRunOnboarding reads
    // `consultify_onboarding_done:{userId}` === 'true' as an instant local guard
    // BEFORE any server call, so setting it here dismisses onboarding for the
    // service account without touching the server-side preference.
    if (userId) {
      localStorage.setItem(`consultify_onboarding_done:${userId}`, 'true');
    }
    const raw = localStorage.getItem('consultify-storage');
    let parsed = {};
    try {
      parsed = raw ? JSON.parse(raw) : {};
    } catch {}
    parsed.state = { ...(parsed.state || {}), theme };
    parsed.version ??= 2;
    localStorage.setItem('consultify-storage', JSON.stringify(parsed));
  }, { locale: variant.locale, theme: variant.theme, userId });
}

async function settle(page, route) {
  // DEC-590 (Wpis 39): spinner-aware wait lives in settle.mjs. This wrapper only
  // binds BASE and the console logger so the 7 call sites stay (page, route).
  return settleAndWait(page, route, { base: BASE, log: (message) => console.log(message) });
}

async function screenshot(page, moduleId, kind, control) {
  const relative = path.join('screenshots', `${slug(`${moduleId}-${kind}-${control}`)}.png`);
  await page.screenshot({ path: path.join(OUT, relative), fullPage: false }).catch(() => {});
  return relative;
}

async function describe(locator, index) {
  return locator.nth(index).evaluate((element) => ({
    text: (element.innerText || element.textContent || '')
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 120),
    aria: element.getAttribute('aria-label') || '',
    testId: element.getAttribute('data-testid') || '',
    tag: element.tagName.toLowerCase(),
  }));
}

async function exerciseLocator({ page, locator, index, module, kind, buffers }) {
  const descriptor = await describe(locator, index);
  const control =
    descriptor.text || descriptor.aria || descriptor.testId || `${descriptor.tag}-${index + 1}`;
  const beforeUrl = page.url();
  let status = 'PASS';
  let note = '';
  try {
    await locator.nth(index).click({ timeout: 8_000 });
    await page.waitForTimeout(700);
  } catch (error) {
    status = 'FAIL';
    note = String(error).slice(0, 240);
  }
  const mutationAttempts = buffers.mutations.splice(0);
  if (mutationAttempts.length && status === 'PASS') {
    status = 'BLOCKED';
    note = `Mutation blocked before network: ${mutationAttempts.map((item) => `${item.method} ${item.url}`).join(', ')}`;
  }
  const shot = await screenshot(page, module.id, kind, `${control}-${index + 1}`);
  const cell = {
    variant: VARIANT,
    module: module.id,
    kind,
    control,
    status,
    note,
    routeBefore: beforeUrl.replace(BASE, ''),
    routeAfter: page.url().replace(BASE, ''),
    screenshot: shot,
    mutationAttempts,
    consoleErrors: buffers.console.splice(0),
    httpErrors: buffers.http.splice(0),
  };
  const closer = page.getByRole('button', { name: closePattern }).last();
  if ((await closer.count()) > 0) await closer.click({ timeout: 2_000 }).catch(() => {});
  return cell;
}

async function matchingButtons(page, pattern, excludePattern) {
  const buttons = page.locator('main button:visible, main [role="button"]:visible');
  const indexes = [];
  for (let index = 0; index < (await buttons.count()); index += 1) {
    const item = await describe(buttons, index);
    const searchable = `${item.text} ${item.aria} ${item.testId}`;
    if (pattern.test(searchable) && !excludePattern?.test(searchable)) indexes.push(index);
  }
  return { buttons, indexes };
}

async function runModule(page, module, allMutations) {
  const buffers = { console: [], http: [], mutations: [] };
  const onConsole = (message) => {
    if (message.type() === 'error' && !/cloudflareinsights|beacon\.min\.js/i.test(message.text())) {
      buffers.console.push(message.text().slice(0, 300));
    }
  };
  const onResponse = (response) => {
    const request = response.request();
    if (response.status() >= 400 && ['xhr', 'fetch'].includes(request.resourceType())) {
      buffers.http.push(
        `${request.method()} ${response.url().replace(BASE, '')} -> ${response.status()}`
      );
    }
  };
  const onRequest = (request) => {
    if (isDomainMutation(request)) {
      const mutation = {
        module: module.id,
        method: request.method(),
        url: request.url().replace(BASE, ''),
      };
      allMutations.push(mutation);
      buffers.mutations.push(mutation);
    }
  };
  page.on('console', onConsole);
  page.on('response', onResponse);
  page.on('request', onRequest);

  const cells = [];
  await settle(page, module.route);
  const landingMutations = buffers.mutations.splice(0);
  const routeAfter = page.url().replace(BASE, '');
  const landingReached = routeMatchesModule(routeAfter, module);
  cells.push({
    variant: VARIANT,
    module: module.id,
    kind: 'menu1',
    control: module.route,
    status: landingMutations.length ? 'BLOCKED' : landingReached ? 'PASS' : 'FAIL',
    note: landingMutations.length
      ? `Mutation on view blocked before network: ${landingMutations.map((item) => `${item.method} ${item.url}`).join(', ')}`
      : '',
    routeAfter,
    screenshot: await screenshot(page, module.id, 'menu1', module.route),
    consoleErrors: buffers.console.splice(0),
    httpErrors: buffers.http.splice(0),
    mutationAttempts: landingMutations,
  });

  const selectors = {
    menu2: 'main [role="tab"]:visible',
    menu3:
      'main button[aria-pressed]:visible, main [data-testid*="menu-3"] button:visible, main [data-testid*="command-row"] button:visible',
  };
  for (const kind of ['menu2', 'menu3']) {
    await settle(page, module.route);
    const locator = page.locator(selectors[kind]);
    const count = await locator.count();
    if (count === 0) {
      cells.push({
        variant: VARIANT,
        module: module.id,
        kind,
        control: 'none',
        status: 'MISSING',
        screenshot: await screenshot(page, module.id, kind, 'missing'),
        consoleErrors: buffers.console.splice(0),
        httpErrors: buffers.http.splice(0),
      });
      continue;
    }
    for (let index = 0; index < count; index += 1) {
      await settle(page, module.route);
      const fresh = page.locator(selectors[kind]);
      if ((await fresh.count()) <= index) break;
      cells.push(await exerciseLocator({ page, locator: fresh, index, module, kind, buffers }));
    }
  }

  await settle(page, module.route);
  const buttons = page.locator('main button:visible, main [role="button"]:visible');
  const buttonCount = await buttons.count();
  const kebabIndexes = [];
  for (let index = 0; index < buttonCount; index += 1) {
    const item = await describe(buttons, index);
    const searchable = `${item.text} ${item.aria} ${item.testId}`;
    const isProfileControl =
      /user.?menu|profile|account/i.test(searchable) ||
      new RegExp(`\\b${variant.actor}\\b`, 'i').test(searchable);
    if (!isProfileControl && (kebabPattern.test(searchable) || item.text === '⋮'))
      kebabIndexes.push(index);
  }
  if (kebabIndexes.length === 0) {
    cells.push({
      variant: VARIANT,
      module: module.id,
      kind: 'kebab',
      control: 'none',
      status: 'MISSING',
      screenshot: await screenshot(page, module.id, 'kebab', 'missing'),
      consoleErrors: [],
      httpErrors: [],
    });
  } else {
    const beforeCells = cells.length;
    for (const index of kebabIndexes) {
      await settle(page, module.route);
      const fresh = page.locator('main button:visible, main [role="button"]:visible');
      if ((await fresh.count()) > index)
        cells.push(
          await exerciseLocator({ page, locator: fresh, index, module, kind: 'kebab', buffers })
        );
    }
    if (cells.length === beforeCells) {
      cells.push({
        variant: VARIANT,
        module: module.id,
        kind: 'kebab',
        control: 'unstable-after-reload',
        status: 'FAIL',
        screenshot: await screenshot(page, module.id, 'kebab', 'unstable-after-reload'),
        consoleErrors: buffers.console.splice(0),
        httpErrors: buffers.http.splice(0),
        mutationAttempts: buffers.mutations.splice(0),
      });
    }
  }

  await settle(page, module.route);
  const firstRow = page.locator('main table tbody tr:visible').first();
  if ((await firstRow.count()) === 0) {
    cells.push({
      variant: VARIANT,
      module: module.id,
      kind: 'right-panel',
      control: 'first-row',
      status: 'MISSING',
      screenshot: await screenshot(page, module.id, 'right-panel', 'missing'),
      consoleErrors: [],
      httpErrors: [],
    });
  } else {
    await firstRow.click({ timeout: 8_000 }).catch(() => {});
    await page.waitForTimeout(700);
    const panel = page.locator(
      'aside:visible, [role="complementary"]:visible, [data-testid*="preview"]:visible, [data-testid*="right-panel"]:visible'
    );
    cells.push({
      variant: VARIANT,
      module: module.id,
      kind: 'right-panel',
      control: 'first-row',
      status: (await panel.count()) > 0 ? 'PASS' : 'FAIL',
      screenshot: await screenshot(page, module.id, 'right-panel', 'first-row'),
      consoleErrors: buffers.console.splice(0),
      httpErrors: buffers.http.splice(0),
    });
  }

  for (const [kind, pattern] of [
    ['create', createPattern],
    ['ai', aiPattern],
  ]) {
    await settle(page, module.route);
    const candidates = await matchingButtons(
      page,
      pattern,
      kind === 'create' && module.id !== '01-chat' ? /conversation|chat/i : undefined
    );
    if (candidates.indexes.length === 0) {
      cells.push({
        variant: VARIANT,
        module: module.id,
        kind,
        control: 'none',
        status: 'MISSING',
        screenshot: await screenshot(page, module.id, kind, 'missing'),
        consoleErrors: [],
        httpErrors: [],
      });
    } else {
      // Step 2 mechanics exercises the entry surface. It never submits a form or
      // generates content blindly; any unexpected write is caught below and fails
      // the cleanup gate instead of leaving a record behind.
      cells.push(
        await exerciseLocator({
          page,
          locator: candidates.buttons,
          index: candidates.indexes[0],
          module,
          kind,
          buffers,
        })
      );
    }
  }

  page.off('console', onConsole);
  page.off('response', onResponse);
  page.off('request', onRequest);
  return { id: module.id, route: module.route, cells };
}

async function main() {
  const startedAt = new Date().toISOString();
  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: variant.locale === 'pl' ? 'pl-PL' : 'en-US',
  });
  const page = await context.newPage();
  const principal = await authenticate(page);
  await setPresentationState(page, principal.userId);
  const flags = await captureFlags(page);
  const mutatingRequests = [];
  // The matrix package proves entry-surface reachability without leaving test
  // data. Block every post-auth API mutation before it reaches staging. The
  // request listener still records the attempted write, so read-on-view bugs
  // remain visible and fail the variant.
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    if (isDomainMutation(request)) {
      return route.abort('blockedbyclient');
    }
    return route.continue();
  });
  const modules = [];
  let principalRestore = { required: false, restored: false };
  try {
    for (const module of MODULES) {
      console.log(`[E2E-1] ${VARIANT} ${module.id}`);
      modules.push(await runModule(page, module, mutatingRequests));
    }
  } finally {
    principalRestore = await restorePrincipal(page, principal).catch((error) => ({
      required: Boolean(principal.restoreOrganizationId),
      restored: false,
      error: String(error),
    }));
    await browser.close();
  }

  const result = {
    schemaVersion: 1,
    variant: VARIANT,
    base: BASE,
    sha: SHA,
    startedAt,
    finishedAt: new Date().toISOString(),
    principal: {
      organizationId: principal.organizationId,
      organizationName: principal.organizationName,
      role: principal.role,
    },
    flags,
    modules: modules.map(({ id, route }) => ({ id, route })),
    cells: modules.flatMap((module) => module.cells),
    cleanup: {
      mode: 'entry-surfaces-mutations-blocked-before-network',
      mutatingRequests,
      principalRestore,
      verified: principalRestore.restored,
    },
  };
  const errors = validateVariantResult(result, variant);
  result.contractErrors = errors;
  writeVariantArtifacts({ outDir: OUT, result, previous: readPrevious() });
  if (errors.length || result.summary?.hardFailures || result.delta?.regressions?.length)
    process.exitCode = 1;
}

main().catch((error) => {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(
    path.join(OUT, 'fatal.json'),
    JSON.stringify({ variant: VARIANT, error: String(error), stack: error?.stack }, null, 2)
  );
  console.error(error);
  process.exit(1);
});
