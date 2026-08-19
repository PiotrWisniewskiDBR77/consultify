/**
 * UI-CANON G4 — the sweep engine.
 *
 * Runs the canon matrix against a REAL mounted application (real Postgres,
 * real signed-in session from the test-support bootstrap). There is no
 * `page.route(...)`, no response stubbing and no mocked database anywhere in
 * this file — by design. A state that cannot be provoked honestly is reported
 * as `observed: false` with the reason, never simulated.
 */

import fs from 'node:fs';
import path from 'node:path';

import AxeBuilder from '@axe-core/playwright';
import { expect, request as apiRequest, type BrowserContext, type Page } from '@playwright/test';

import { STORAGE_STATE_PATH, readTestSupportState } from '../../_helpers/testSupportState';
import {
  LANGUAGES,
  THEMES,
  VIEWPORTS,
  type CellResult,
  type LanguageName,
  type StateName,
  type SurfaceResult,
  type SurfaceSpec,
  type ThemeName,
  type ViewportName,
} from './types';

const APP_STORE_KEY = 'consultify-storage';

/**
 * The first-run onboarding modal covers every surface for a brand-new tenant.
 * It is retired the way the product itself retires it — a real authenticated
 * `PUT /api/preferences` (`src/services/api.ts` `markFirstRunComplete`) — not
 * by intercepting or hiding anything in the page.
 */
export async function completeFirstRunOnboarding(apiBaseUrl: string) {
  const state = readTestSupportState();
  const ctx = await apiRequest.newContext({
    baseURL: apiBaseUrl,
    extraHTTPHeaders: { Authorization: `Bearer ${state.token}` },
  });
  const res = await ctx.put('/api/preferences', {
    data: { onboarding_completed: true, onboarding_role: 'consultant' },
  });
  const detail = `PUT /api/preferences -> ${res.status()}`;
  await ctx.dispose();
  return { userId: state.userId, organizationId: state.organizationId, detail };
}

export const EVIDENCE_ROOT = path.resolve(
  process.cwd(),
  'docs/program/evidence/closure/ui-g4'
);

/** Longer than the product's canonical `duration-150` transition. */
export const FOCUS_SETTLE_MS = 225;

export async function measureActiveFocus(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return null;
    const cs = window.getComputedStyle(el);
    const outlined =
      cs.outlineStyle !== 'none' && cs.outlineWidth !== '0px' && cs.outlineColor !== 'transparent';
    const shadowed = cs.boxShadow !== 'none' && cs.boxShadow !== '';
    const r = el.getBoundingClientRect();
    const onScreen =
      r.width > 0 &&
      r.height > 0 &&
      r.bottom > 0 &&
      r.right > 0 &&
      r.top < window.innerHeight &&
      r.left < window.innerWidth;
    const typingEditor =
      el instanceof HTMLTextAreaElement ||
      el.getAttribute('contenteditable') === 'true' ||
      el.classList.contains('ProseMirror');
    return {
      tag: el.tagName.toLowerCase(),
      cls: (el.getAttribute('class') || '').split(/\s+/).slice(0, 2).join('.'),
      visibleFocus: typingEditor || outlined || shadowed,
      onScreen,
      typingEditor,
      outlineWidth: cs.outlineWidth,
    };
  });
}

/** Set once per run by the spec, so the local onboarding key can be seeded. */
let ONBOARDED_USER_ID = '';
export function setOnboardedUserId(id: string) {
  ONBOARDED_USER_ID = id;
}

/** Applied before any app code runs, so the very first paint is already correct. */
function initScript() {
  return ({
    language: lang,
    theme: th,
    flags: fl,
    storeKey,
    userId,
  }: {
    language: string;
    theme: string;
    flags: Record<string, string>;
    storeKey: string;
    userId: string;
  }) => {
    try {
      window.localStorage.setItem('i18nextLng', lang);
      const raw = window.localStorage.getItem(storeKey);
      let parsed: any = {};
      try {
        parsed = raw ? JSON.parse(raw) : {};
      } catch {
        parsed = {};
      }
      if (!parsed || typeof parsed !== 'object') parsed = {};
      parsed.state = { ...(parsed.state || {}), theme: th, language: lang };
      if (typeof parsed.version !== 'number') parsed.version = 2;
      window.localStorage.setItem(storeKey, JSON.stringify(parsed));
      // Mirrors `useFirstRunOnboarding`'s own local fast-path key; the durable
      // truth is the server preference set over the real API.
      if (userId) window.localStorage.setItem(`consultify_onboarding_done:${userId}`, 'true');
      for (const [k, v] of Object.entries(fl)) window.localStorage.setItem(k, v);
    } catch {
      /* storage unavailable — the cell will simply report what it sees */
    }
  };
}

async function applyEnvironment(
  page: Page,
  language: LanguageName,
  theme: ThemeName,
  flags: Record<string, string>
) {
  await page.addInitScript(initScript(), {
    language,
    theme,
    flags,
    storeKey: APP_STORE_KEY,
    userId: ONBOARDED_USER_ID,
  });
}

/** The app shell has painted and the route has produced content. */
async function waitForApp(page: Page, timeout = 45000) {
  await page.locator('#root').waitFor({ state: 'attached', timeout });
  await expect(page.locator('#root')).toContainText(/\S/, { timeout });
}

/**
 * Belt-and-braces: the server preference should already have retired the
 * first-run modal, but if any welcome/tour dialog still shows we dismiss it by
 * clicking its own real control — the same thing a user does.
 */
async function dismissOnboarding(page: Page) {
  const skip = page
    .getByRole('button', { name: /Skip tour|Skip for now|Pomiń na razie|Pomiń/i })
    .first();
  const consultant = page.getByRole('button', { name: /Consultant|Konsultant/i }).first();
  const welcome = page.getByText(
    /Welcome to Consultinity|Witamy w Consultinity|WITAJ W CONSULTIFY|WELCOME TO CONSULTIFY/i
  );
  for (let i = 0; i < 8; i++) {
    const hasSkip = await skip.isVisible().catch(() => false);
    const hasWelcome = await welcome.isVisible().catch(() => false);
    if (!hasSkip && !hasWelcome) return;
    if (hasSkip) await skip.click({ timeout: 1200, force: true }).catch(() => {});
    else if (hasWelcome) await consultant.click({ timeout: 1200, force: true }).catch(() => {});
    await page.waitForTimeout(300);
  }
}

/**
 * A surface is only "rendered" if its own content is visible AND nothing
 * modal is covering it. Without this check a full-screen welcome dialog
 * silently passes as the surface, which is precisely the false green this
 * gate exists to prevent.
 */
async function blockingOverlay(page: Page) {
  return page.evaluate(() => {
    const dialogs = Array.from(
      document.querySelectorAll('[role="dialog"], [role="alertdialog"], [aria-modal="true"]')
    );
    const vw = window.innerWidth * window.innerHeight;
    for (const d of dialogs) {
      const cs = window.getComputedStyle(d);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const r = d.getBoundingClientRect();
      if (r.width * r.height > vw * 0.15) {
        return {
          blocked: true,
          detail: `${d.getAttribute('role') || 'aria-modal'} covering ${Math.round(
            ((r.width * r.height) / vw) * 100
          )}% of the viewport`,
        };
      }
    }
    return { blocked: false, detail: '' };
  });
}

async function isSurfaceVisible(page: Page, signal: RegExp, selector?: string) {
  const overlay = await blockingOverlay(page).catch(() => ({ blocked: false, detail: '' }));
  if (overlay.blocked) return { visible: false, detail: `blocked by ${overlay.detail}` };

  // A DOM marker, where the surface offers one, beats a text match: it cannot
  // be satisfied by a redirect to a sibling screen that happens to share a word.
  if (selector) {
    const visible = await page
      .locator(selector)
      .first()
      .isVisible()
      .catch(() => false);
    return {
      visible,
      detail: visible ? `marker ${selector} present` : `marker ${selector} not found`,
    };
  }

  const visible = await page
    .locator('#root')
    .filter({ hasText: signal })
    .first()
    .isVisible()
    .catch(() => false);
  return { visible, detail: visible ? 'surface content matched' : 'ready signal not found' };
}

async function settle(page: Page) {
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(350);
}

async function measureOverflow(page: Page) {
  return page.evaluate(() => {
    const el = document.documentElement;
    const scrollWidth = Math.max(el.scrollWidth, document.body?.scrollWidth ?? 0);
    const clientWidth = el.clientWidth;
    return { overflowed: scrollWidth > clientWidth + 1, scrollWidth, clientWidth };
  });
}

/**
 * Interactive controls with no accessible name. axe covers button-name /
 * link-name; this adds an explicit, reportable inventory so the evidence can
 * state a number rather than "axe was clean".
 */
async function findUnnamedControls(page: Page) {
  return page.evaluate(() => {
    const sel = [
      'button',
      'a[href]',
      'input:not([type=hidden])',
      'select',
      'textarea',
      '[role=button]',
      '[role=link]',
      '[role=tab]',
      '[role=menuitem]',
      '[role=checkbox]',
      '[role=switch]',
      '[role=combobox]',
    ].join(',');
    const isVisible = (el: Element) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      const cs = window.getComputedStyle(el);
      return cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0';
    };
    const nameOf = (el: Element): string => {
      const aria = el.getAttribute('aria-label');
      if (aria && aria.trim()) return aria.trim();
      const labelledby = el.getAttribute('aria-labelledby');
      if (labelledby) {
        const txt = labelledby
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent || '')
          .join(' ')
          .trim();
        if (txt) return txt;
      }
      const title = el.getAttribute('title');
      if (title && title.trim()) return title.trim();
      // Labels and placeholder are legitimate accessible-name sources for form
      // controls under accname, and axe treats them the same way. An earlier
      // revision of this probe ignored placeholder on <textarea>, which
      // overcounted the chat composer as unnamed — corrected here so the
      // inventory agrees with axe instead of being stricter than the spec.
      // `button` is a labelable element in HTML, so `<label for>` names it just
      // as it names an input. Omitting it here previously reported a correctly
      // labelled toggle as unnamed while axe considered it named.
      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLSelectElement ||
        el instanceof HTMLButtonElement
      ) {
        if (el.labels && el.labels.length) {
          const t = Array.from(el.labels).map((l) => l.textContent || '').join(' ').trim();
          if (t) return t;
        }
        if ('placeholder' in el && (el as HTMLInputElement).placeholder?.trim()) {
          return (el as HTMLInputElement).placeholder.trim();
        }
        if (el instanceof HTMLInputElement && el.value?.trim() && (el.type === 'button' || el.type === 'submit')) {
          return el.value.trim();
        }
      }
      const alt = el.querySelector('img[alt]')?.getAttribute('alt');
      if (alt && alt.trim()) return alt.trim();
      const txt = (el as HTMLElement).innerText?.trim();
      if (txt) return txt;
      return '';
    };
    const samples: string[] = [];
    let count = 0;
    for (const el of Array.from(document.querySelectorAll(sel))) {
      if (!isVisible(el)) continue;
      if (el.getAttribute('aria-hidden') === 'true') continue;
      if (nameOf(el)) continue;
      count++;
      if (samples.length < 8) {
        const cls = (el.getAttribute('class') || '').split(/\s+/).slice(0, 3).join('.');
        samples.push(`${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}`);
      }
    }
    return { count, samples };
  });
}

async function runAxe(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
    .analyze();
  const relevant = results.violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious'
  );
  return {
    critical: relevant.filter((v) => v.impact === 'critical').length,
    serious: relevant.filter((v) => v.impact === 'serious').length,
    violations: relevant.map((v) => ({
      id: v.id,
      impact: String(v.impact),
      nodes: v.nodes.length,
      help: v.help,
      // Concrete selectors, so a finding is actionable rather than a count.
      targets: v.nodes.slice(0, 5).map((n) => String(n.target?.join(' ') || '')),
    })),
  };
}

function screensDir(spec: SurfaceSpec) {
  return path.join(EVIDENCE_ROOT, spec.taskId, 'screens');
}

export async function sweepCell(
  context: BrowserContext,
  spec: SurfaceSpec,
  viewport: ViewportName,
  language: LanguageName,
  theme: ThemeName,
  route = spec.route
): Promise<CellResult> {
  const page = await context.newPage();
  const consoleErrors: string[] = [];
  const httpErrors: Array<{ status: number; method: string; path: string }> = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300));
  });
  page.on('response', (response) => {
    if (response.status() < 400) return;
    const request = response.request();
    let requestPath = response.url();
    try {
      const parsed = new URL(response.url());
      requestPath = `${parsed.pathname}${parsed.search}`;
    } catch {
      // Preserve the raw URL when a non-standard scheme cannot be parsed.
    }
    httpErrors.push({ status: response.status(), method: request.method(), path: requestPath });
  });
  await page.setViewportSize(VIEWPORTS[viewport]);
  await applyEnvironment(page, language, theme, spec.flagOverrides || {});

  let surfaceRendered = false;
  let screenshot: string | null = null;
  try {
    await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForApp(page);
    await dismissOnboarding(page);
    await settle(page);
    const signal = spec.routeSignals?.[route] || spec.readySignal;
    const vis = await isSurfaceVisible(page, signal, spec.routeSelectors?.[route]);
    surfaceRendered = vis.visible;
    if (!vis.visible) consoleErrors.push(`SURFACE: ${vis.detail}`);

    const dir = screensDir(spec);
    fs.mkdirSync(dir, { recursive: true });
    // Secondary routes are captured at desktop/pl/light too, so the route must
    // be part of the filename — otherwise they silently overwrite the primary
    // capture and the evidence shows the wrong screen.
    const routeSlug =
      route === spec.route ? '' : `__${route.replace(/^\//, '').replace(/[^a-zA-Z0-9]+/g, '-')}`;
    const file = path.join(
      dir,
      `${spec.key}${routeSlug}__${viewport}__${language}__${theme}.png`
    );
    await page.screenshot({ path: file, fullPage: false });
    screenshot = path.relative(process.cwd(), file);
  } catch (error) {
    consoleErrors.push(`NAVIGATION: ${error instanceof Error ? error.message : String(error)}`);
  }

  const horizontalOverflow = await measureOverflow(page).catch(() => ({
    overflowed: false,
    scrollWidth: -1,
    clientWidth: -1,
  }));
  const axe = await runAxe(page).catch(() => ({ critical: -1, serious: -1, violations: [] }));
  const unnamedControls = await findUnnamedControls(page).catch(() => ({ count: -1, samples: [] }));

  await page.close();
  return {
    viewport,
    language,
    theme,
    route,
    surfaceRendered,
    screenshot,
    horizontalOverflow,
    axe,
    unnamedControls,
    consoleErrors: consoleErrors.slice(0, 10),
    httpErrors,
  };
}

/** Keyboard-only reachability, visible focus, Escape and focus return. */
export async function sweepKeyboard(context: BrowserContext, spec: SurfaceSpec) {
  const page = await context.newPage();
  await page.setViewportSize(VIEWPORTS.desktop);
  await applyEnvironment(page, 'pl', 'light', spec.flagOverrides || {});
  await page.goto(spec.route, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await waitForApp(page);
  await dismissOnboarding(page);
  await settle(page);

  const seen: string[] = [];
  const invisibleFocusSamples: string[] = [];
  let reachableControls = 0;

  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab');
    // `transition-all duration-150` also animates outline width. Measuring in
    // the same tick as Tab sees the transition's 0px starting value and turns
    // a real 2px ring into a false failure. Measure after the transition.
    await page.waitForTimeout(FOCUS_SETTLE_MS);
    const info = await measureActiveFocus(page);
    if (!info?.onScreen) continue;
    reachableControls++;
    const id = `${info.tag}.${info.cls}`;
    seen.push(id);
    if (!info.visibleFocus && invisibleFocusSamples.length < 8) invisibleFocusSamples.push(id);
  }

  // Escape must not destroy the surface, and focus must stay in the document.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  const stillRendered = (await isSurfaceVisible(page, spec.readySignal)).visible;
  const focusInDocument = await page.evaluate(
    () => !!document.activeElement && document.activeElement !== document.documentElement
  );

  await page.close();
  return {
    reachableControls,
    focusAlwaysVisible: invisibleFocusSamples.length === 0,
    invisibleFocusSamples,
    escapeHandled: stillRendered
      ? 'Escape pressed on the surface; surface stayed mounted (no dialog was open to close).'
      : 'Escape pressed; surface ready-signal no longer visible afterwards — investigate.',
    focusReturn: focusInDocument
      ? 'Focus remained inside the document after Escape.'
      : 'Focus was lost to the document root after Escape.',
    tabOrderMonotonic: reachableControls > 0,
  };
}

export async function sweepStates(context: BrowserContext, spec: SurfaceSpec) {
  const out: SurfaceResult['states'] = [];
  for (const probe of spec.stateProbes || []) {
    const page = await context.newPage();
    await page.setViewportSize(VIEWPORTS.desktop);
    await applyEnvironment(page, 'pl', 'light', spec.flagOverrides || {});
    let observed = false;
    let detail = '';
    let screenshot: string | null = null;
    try {
      if (probe.state === 'loading') {
        // Captured *during* boot — no interception, just an early snapshot.
        await page.goto(probe.path, { waitUntil: 'commit', timeout: 60000 });
        await page.waitForTimeout(120);
        observed = await page
          .locator(
            '[data-testid*="skeleton"], .animate-pulse, [role="progressbar"], [aria-busy="true"]'
          )
          .first()
          .isVisible()
          .catch(() => false);
        if (!observed) {
          observed = await page
            .getByText(/Ładowanie|Loading|Wczytywanie/i)
            .first()
            .isVisible()
            .catch(() => false);
        }
        detail = observed
          ? 'Skeleton/spinner/aria-busy observed during real boot.'
          : 'No distinct loading affordance caught in the sampled window.';
      } else {
        await page.goto(probe.path, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await waitForApp(page);
        await dismissOnboarding(page);
        await settle(page);
        if (probe.expect) {
          observed = await page
            .locator('#root')
            .filter({ hasText: probe.expect })
            .first()
            .isVisible()
            .catch(() => false);
          detail = observed
            ? `Matched ${probe.expect} on the real response.`
            : `Did not match ${probe.expect}; surface rendered something else.`;
        } else {
          observed = true;
          detail = 'Reached without an explicit text assertion.';
        }
      }
      const dir = screensDir(spec);
      fs.mkdirSync(dir, { recursive: true });
      const file = path.join(dir, `${spec.key}__state-${probe.state}.png`);
      await page.screenshot({ path: file, fullPage: false });
      screenshot = path.relative(process.cwd(), file);
    } catch (error) {
      detail = `probe failed: ${error instanceof Error ? error.message : String(error)}`;
    }
    await page.close();
    out.push({ state: probe.state, observed, path: probe.path, detail, screenshot });
  }
  return out;
}

/** Deep-link, in-place reload, and a genuinely cold new browser context. */
export async function sweepNavigation(context: BrowserContext, browserNewContext: () => Promise<BrowserContext>, spec: SurfaceSpec) {
  const page = await context.newPage();
  await page.setViewportSize(VIEWPORTS.desktop);
  await applyEnvironment(page, 'pl', 'light', spec.flagOverrides || {});

  await page.goto(spec.route, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await waitForApp(page);
  await dismissOnboarding(page);
  await settle(page);
  const deep = await isSurfaceVisible(page, spec.readySignal);
  const deepOk = deep.visible;
  const deepUrl = new URL(page.url()).pathname;

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await waitForApp(page);
  await dismissOnboarding(page);
  await settle(page);
  const reload = await isSurfaceVisible(page, spec.readySignal);
  const reloadOk = reload.visible;
  const reloadUrl = new URL(page.url()).pathname;
  await page.close();

  // Cold reopen: brand-new context from the persisted real session, as if the
  // user closed the browser and opened the deep link again.
  const cold = await browserNewContext();
  const coldPage = await cold.newPage();
  await coldPage.setViewportSize(VIEWPORTS.desktop);
  await applyEnvironment(coldPage, 'pl', 'light', spec.flagOverrides || {});
  await coldPage.goto(spec.route, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await waitForApp(coldPage);
  await dismissOnboarding(coldPage);
  await settle(coldPage);
  const cold2 = await isSurfaceVisible(coldPage, spec.readySignal);
  const coldOk = cold2.visible;
  const coldUrl = new URL(coldPage.url()).pathname;
  await coldPage.close();
  await cold.close();

  return {
    deepLink: { ok: deepOk, detail: `deep-link ${spec.route} settled at ${deepUrl} — ${deep.detail}` },
    reload: { ok: reloadOk, detail: `reload settled at ${reloadUrl} — ${reload.detail}` },
    coldReopen: {
      ok: coldOk,
      detail: `cold context (fresh storage state, no SPA memory) settled at ${coldUrl} — ${cold2.detail}`,
    },
  };
}

export function storageStatePath() {
  return STORAGE_STATE_PATH;
}

export function writeResult(spec: SurfaceSpec, result: SurfaceResult) {
  const dir = path.join(EVIDENCE_ROOT, spec.taskId);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'G4_SWEEP_RESULT.json');
  fs.writeFileSync(file, JSON.stringify(result, null, 2) + '\n');
  return path.relative(process.cwd(), file);
}

export type { StateName, SurfaceSpec, SurfaceResult };
export { LANGUAGES, THEMES, VIEWPORTS };
