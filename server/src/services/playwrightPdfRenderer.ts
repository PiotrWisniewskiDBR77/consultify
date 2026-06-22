/**
 * playwrightPdfRenderer
 *
 * Server-side HTML → PDF renderer backed by Playwright's chromium runtime.
 *
 * Playwright is normally a test dependency, but its `playwright` package
 * exposes the same `chromium` runtime that ships with the headless browser
 * binary. We reuse it here as a "free" PDF engine without adding a
 * production dependency. Two safety layers keep this from breaking
 * production servers that have no chromium binary installed:
 *
 *   1. The `playwright` package is *dynamically* imported the first time
 *      a render is attempted. A missing module resolves to a typed
 *      `unavailable` result rather than throwing at server start.
 *   2. The chromium binary is *lazy-launched* the first time a render is
 *      attempted. A missing binary (`Executable doesn't exist`) resolves
 *      to a typed `unavailable` / `chromium_binary_missing` result.
 *
 * The detection result is cached at the module level for 60s when the
 * probe FAILS (so transient launch errors recover automatically) and
 * cached forever within the process when the probe SUCCEEDS (so the
 * second `renderHtmlToPdf` call doesn't pay the relaunch cost).
 *
 * One chromium `Browser` instance is shared across every render. Each
 * render opens its own `BrowserContext` + `Page` (both cheap) and tears
 * them down in `finally`, so there are no resource leaks even when a
 * render fails or times out.
 *
 * The renderer NEVER throws — every failure mode resolves to a typed
 * `RenderHtmlPdfErr`. Callers that need an HTML fallback (e.g. the
 * Operations Health export endpoint) can branch on `result.status` and
 * fall back deterministically.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface RenderHtmlPdfInput {
  html: string;
  pdfOptions?: {
    format?: 'A4' | 'A3' | 'Letter' | 'Legal';
    landscape?: boolean;
    margin?: {
      top?: string;
      right?: string;
      bottom?: string;
      left?: string;
    };
    printBackground?: boolean;
    headerTemplate?: string;
    footerTemplate?: string;
    displayHeaderFooter?: boolean;
    /** 0.1..2.0 */
    scale?: number;
  };
  /** Hard timeout for the whole render. Default: 10_000 ms. */
  navigationTimeoutMs?: number;
}

export interface RenderHtmlPdfOk {
  status: 'ok';
  buffer: Buffer;
  bytes: number;
  durationMs: number;
}

export type RenderHtmlPdfErrStatus = 'unavailable' | 'launch_failed' | 'render_failed' | 'timeout';

export interface RenderHtmlPdfErr {
  status: RenderHtmlPdfErrStatus;
  reason: string;
  durationMs: number;
}

export type RenderHtmlPdfResult = RenderHtmlPdfOk | RenderHtmlPdfErr;

export interface AvailabilityResult {
  available: boolean;
  reason?: string;
  detectedAt: string;
}

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

const FAILURE_CACHE_TTL_MS = 60_000;
const DEFAULT_NAVIGATION_TIMEOUT_MS = 10_000;
const DEFAULT_PDF_MARGIN = {
  top: '12mm',
  right: '12mm',
  bottom: '12mm',
  left: '12mm',
};

// Loose structural typings that mirror the parts of the Playwright API we
// touch. We intentionally avoid `import type { Browser } from 'playwright'`
// because that would make the `playwright` package a hard module dependency
// at type-check time on production servers that only ship the runtime.
type PdfMargin = {
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
};

interface PdfBrowserPage {
  setContent(html: string, opts?: { waitUntil?: string; timeout?: number }): Promise<void>;
  pdf(opts?: Record<string, unknown>): Promise<Buffer | Uint8Array>;
  close(): Promise<void>;
  setDefaultNavigationTimeout?(ms: number): void;
  setDefaultTimeout?(ms: number): void;
}

interface PdfBrowserContext {
  newPage(): Promise<PdfBrowserPage>;
  close(): Promise<void>;
}

interface PdfBrowser {
  newContext(opts?: Record<string, unknown>): Promise<PdfBrowserContext>;
  close(): Promise<void>;
  isConnected?(): boolean;
}

interface ChromiumApi {
  launch(opts?: Record<string, unknown>): Promise<PdfBrowser>;
}

interface PlaywrightModule {
  chromium: ChromiumApi;
}

interface CachedAvailability {
  result: AvailabilityResult;
  expiresAt: number; // 0 = never expires (success)
}

let cachedAvailability: CachedAvailability | null = null;
let cachedPlaywright: PlaywrightModule | null = null;
let sharedBrowser: PdfBrowser | null = null;
let pendingBrowserLaunch: Promise<PdfBrowser> | null = null;
let pendingAvailabilityProbe: Promise<AvailabilityResult> | null = null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nowIso(): string {
  return new Date().toISOString();
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

function isExecutableMissingError(err: unknown): boolean {
  const msg = errorMessage(err).toLowerCase();
  return (
    msg.includes("executable doesn't exist") ||
    msg.includes('executable does not exist') ||
    msg.includes('please run the following command') ||
    msg.includes('npx playwright install')
  );
}

function setFailureCache(reason: string): AvailabilityResult {
  const result: AvailabilityResult = {
    available: false,
    reason,
    detectedAt: nowIso(),
  };
  cachedAvailability = {
    result,
    expiresAt: Date.now() + FAILURE_CACHE_TTL_MS,
  };
  return result;
}

function setSuccessCache(): AvailabilityResult {
  const result: AvailabilityResult = {
    available: true,
    detectedAt: nowIso(),
  };
  cachedAvailability = { result, expiresAt: 0 };
  return result;
}

async function loadPlaywrightModule(): Promise<PlaywrightModule | null> {
  if (cachedPlaywright) return cachedPlaywright;
  try {
    // Use a dynamic import expression that Vite/esbuild/tsc cannot statically
    // resolve at build time. This lets the server start even if the
    // `playwright` package is missing from `node_modules`.
    const mod = (await import('playwright')) as unknown as PlaywrightModule;
    if (!mod || !mod.chromium || typeof mod.chromium.launch !== 'function') {
      return null;
    }
    cachedPlaywright = mod;
    return mod;
  } catch {
    return null;
  }
}

async function launchBrowser(): Promise<PdfBrowser> {
  if (sharedBrowser && sharedBrowser.isConnected?.() !== false) {
    return sharedBrowser;
  }
  if (pendingBrowserLaunch) {
    return pendingBrowserLaunch;
  }

  const launchPromise = (async () => {
    const pw = await loadPlaywrightModule();
    if (!pw) {
      throw new Error('playwright_not_installed');
    }
    const browser = await pw.chromium.launch({
      headless: true,
      args: ['--no-sandbox'],
    });
    sharedBrowser = browser;
    return browser;
  })();

  pendingBrowserLaunch = launchPromise;
  try {
    return await launchPromise;
  } finally {
    pendingBrowserLaunch = null;
  }
}

async function disposeSharedBrowser(): Promise<void> {
  const browser = sharedBrowser;
  sharedBrowser = null;
  if (!browser) return;
  try {
    await browser.close();
  } catch {
    // best-effort cleanup
  }
}

// ---------------------------------------------------------------------------
// Public surface
// ---------------------------------------------------------------------------

/**
 * Probe whether the renderer can produce real PDFs in this process.
 *
 * Cached results:
 *   - SUCCESS → cached for the lifetime of the process.
 *   - FAILURE → cached for {@link FAILURE_CACHE_TTL_MS} so transient errors
 *     (e.g. CI installing chromium mid-run) recover automatically.
 *
 * NEVER throws.
 */
export async function isPlaywrightPdfRendererAvailable(): Promise<AvailabilityResult> {
  const cached = cachedAvailability;
  if (cached && (cached.expiresAt === 0 || cached.expiresAt > Date.now())) {
    return cached.result;
  }
  if (pendingAvailabilityProbe) {
    return pendingAvailabilityProbe;
  }

  const probe = (async (): Promise<AvailabilityResult> => {
    const pw = await loadPlaywrightModule();
    if (!pw) {
      return setFailureCache('playwright_not_installed');
    }
    try {
      const browser = await pw.chromium.launch({
        headless: true,
        args: ['--no-sandbox'],
      });
      // Reuse this freshly launched browser as the shared one — no point
      // paying to launch twice if the probe just succeeded.
      if (!sharedBrowser) {
        sharedBrowser = browser;
      } else {
        try {
          await browser.close();
        } catch {
          // best-effort
        }
      }
      return setSuccessCache();
    } catch (err) {
      if (isExecutableMissingError(err)) {
        return setFailureCache('chromium_binary_missing');
      }
      return setFailureCache(`chromium_unavailable: ${errorMessage(err)}`);
    }
  })();

  pendingAvailabilityProbe = probe;
  try {
    return await probe;
  } finally {
    pendingAvailabilityProbe = null;
  }
}

/**
 * Render an HTML document to a PDF buffer.
 *
 * Always returns a typed result — never throws. On any failure path
 * (Playwright missing, chromium missing, launch error, render error,
 * timeout) the caller receives a `RenderHtmlPdfErr` describing the
 * failure mode so it can fall back deterministically.
 */
export async function renderHtmlToPdf(input: RenderHtmlPdfInput): Promise<RenderHtmlPdfResult> {
  const startedAt = Date.now();
  const navigationTimeoutMs =
    typeof input.navigationTimeoutMs === 'number' && input.navigationTimeoutMs > 0
      ? input.navigationTimeoutMs
      : DEFAULT_NAVIGATION_TIMEOUT_MS;

  const pdfOptions = buildPdfOptions(input.pdfOptions);

  // Step 1 — availability gate.
  let availability: AvailabilityResult;
  try {
    availability = await isPlaywrightPdfRendererAvailable();
  } catch (err) {
    return {
      status: 'unavailable',
      reason: `availability_probe_threw: ${errorMessage(err)}`,
      durationMs: Date.now() - startedAt,
    };
  }
  if (!availability.available) {
    return {
      status: 'unavailable',
      reason: availability.reason || 'unavailable',
      durationMs: Date.now() - startedAt,
    };
  }

  // Step 2 — make sure the shared browser is up.
  let browser: PdfBrowser;
  try {
    browser = await launchBrowser();
  } catch (err) {
    if (isExecutableMissingError(err)) {
      setFailureCache('chromium_binary_missing');
      return {
        status: 'unavailable',
        reason: 'chromium_binary_missing',
        durationMs: Date.now() - startedAt,
      };
    }
    // Browser launch failed; mark for relaunch on next call.
    await disposeSharedBrowser();
    return {
      status: 'launch_failed',
      reason: errorMessage(err),
      durationMs: Date.now() - startedAt,
    };
  }

  // Step 3 — open context + page, set content, render PDF, with hard timeout.
  let context: PdfBrowserContext | null = null;
  let page: PdfBrowserPage | null = null;
  let timedOut = false;
  let timer: NodeJS.Timeout | null = null;

  try {
    const work = (async (): Promise<RenderHtmlPdfResult> => {
      context = await browser.newContext();
      page = await context.newPage();
      page.setDefaultNavigationTimeout?.(navigationTimeoutMs);
      page.setDefaultTimeout?.(navigationTimeoutMs);

      await page.setContent(input.html, {
        waitUntil: 'networkidle',
        timeout: navigationTimeoutMs,
      });

      const raw = await page.pdf(pdfOptions);
      const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
      return {
        status: 'ok',
        buffer,
        bytes: buffer.length,
        durationMs: Date.now() - startedAt,
      };
    })();

    const timeout = new Promise<RenderHtmlPdfResult>((resolve) => {
      timer = setTimeout(() => {
        timedOut = true;
        resolve({
          status: 'timeout',
          reason: `render_timeout_${navigationTimeoutMs}ms`,
          durationMs: Date.now() - startedAt,
        });
      }, navigationTimeoutMs);
    });

    const result = await Promise.race([work, timeout]);
    return result;
  } catch (err) {
    if (isExecutableMissingError(err)) {
      setFailureCache('chromium_binary_missing');
      await disposeSharedBrowser();
      return {
        status: 'unavailable',
        reason: 'chromium_binary_missing',
        durationMs: Date.now() - startedAt,
      };
    }
    // A fatal browser error (target closed, browser crashed) means the
    // shared browser is poisoned — drop it so the next call relaunches.
    const msg = errorMessage(err).toLowerCase();
    if (
      msg.includes('target closed') ||
      msg.includes('browser has been closed') ||
      msg.includes('browser closed') ||
      msg.includes('disconnected')
    ) {
      await disposeSharedBrowser();
    }
    return {
      status: 'render_failed',
      reason: errorMessage(err),
      durationMs: Date.now() - startedAt,
    };
  } finally {
    if (timer) clearTimeout(timer);
    // Note: `page` and `context` are assigned inside an async closure above,
    // so TypeScript's control-flow analysis cannot prove they were ever set.
    // We cast here to satisfy TS while keeping the safe `if (...)` guard at
    // runtime for the outer cleanup.
    const pageRef = page as PdfBrowserPage | null;
    const contextRef = context as PdfBrowserContext | null;
    if (pageRef) {
      try {
        await pageRef.close();
      } catch {
        // best-effort
      }
    }
    if (contextRef) {
      try {
        await contextRef.close();
      } catch {
        // best-effort
      }
    }
    if (timedOut) {
      // A timed-out page may still be doing work in the background; the
      // close calls above already cancel it. Nothing else to do.
    }
  }
}

function buildPdfOptions(overrides: RenderHtmlPdfInput['pdfOptions']): Record<string, unknown> {
  const margin: PdfMargin = {
    ...DEFAULT_PDF_MARGIN,
    ...(overrides?.margin || {}),
  };

  const opts: Record<string, unknown> = {
    format: overrides?.format ?? 'A4',
    printBackground: overrides?.printBackground ?? true,
    margin,
    scale: clampScale(overrides?.scale ?? 1.0),
  };

  if (typeof overrides?.landscape === 'boolean') {
    opts.landscape = overrides.landscape;
  }
  if (typeof overrides?.headerTemplate === 'string') {
    opts.headerTemplate = overrides.headerTemplate;
  }
  if (typeof overrides?.footerTemplate === 'string') {
    opts.footerTemplate = overrides.footerTemplate;
  }
  if (typeof overrides?.displayHeaderFooter === 'boolean') {
    opts.displayHeaderFooter = overrides.displayHeaderFooter;
  }

  return opts;
}

function clampScale(scale: number): number {
  if (!Number.isFinite(scale)) return 1.0;
  if (scale < 0.1) return 0.1;
  if (scale > 2.0) return 2.0;
  return scale;
}

// ---------------------------------------------------------------------------
// Test-only hooks. Exported so unit tests can reset the module-level cache
// and shut the shared browser down between suites without leaking handles.
// ---------------------------------------------------------------------------

/** Drop the cached availability probe so the next call re-detects. */
export function __resetAvailabilityCacheForTests(): void {
  cachedAvailability = null;
}

/**
 * Close the shared chromium browser, if any. Safe to call multiple times
 * and when no browser was ever launched. Use in `afterAll` to keep test
 * runners from hanging on stray browser processes.
 */
export async function __shutdownBrowserForTests(): Promise<void> {
  await disposeSharedBrowser();
}

// ---------------------------------------------------------------------------
// X1 — HTML → PNG (parytet eksportu deck+doc)
//
// Współdzieli availability gate + sharedBrowser z renderHtmlToPdf — zero
// duplikacji lazy-load Playwright. Te eksporty są DODATKOWE; istniejące API
// PDF nieruszone (presentationOperationsHealthPdfService nadal działa bez zmian).
// ---------------------------------------------------------------------------

export interface RenderHtmlPngInput {
  html: string;
  pngOptions?: {
    /** Viewport width (px). Default 1920 (deck-friendly). */
    viewportWidth?: number;
    /** Viewport height (px). Default 1080 (deck-friendly). */
    viewportHeight?: number;
    /** Full-page screenshot vs viewport only. Default false (viewport). */
    fullPage?: boolean;
    /** Background color when DOM has transparency. Default '#ffffff'. */
    omitBackground?: boolean;
    /** PNG quality is lossless — but image scaling can be controlled via DPR. */
    deviceScaleFactor?: number;
  };
  navigationTimeoutMs?: number;
}

export interface RenderHtmlPngOk {
  status: 'ok';
  buffer: Buffer;
  bytes: number;
  durationMs: number;
}

export interface RenderHtmlPngErr {
  status: RenderHtmlPdfErrStatus;
  reason: string;
  durationMs: number;
}

export type RenderHtmlPngResult = RenderHtmlPngOk | RenderHtmlPngErr;

/** Structural type — Playwright Page screenshot API. */
interface PngBrowserPage extends PdfBrowserPage {
  screenshot(opts?: Record<string, unknown>): Promise<Buffer | Uint8Array>;
  setViewportSize?(opts: { width: number; height: number }): Promise<void>;
}

function buildScreenshotOptions(
  overrides: RenderHtmlPngInput['pngOptions']
): Record<string, unknown> {
  return {
    type: 'png',
    fullPage: overrides?.fullPage ?? false,
    omitBackground: overrides?.omitBackground ?? false,
  };
}

/**
 * Render HTML → PNG (analog do renderHtmlToPdf). Współdzieli singleton
 * Playwright browser i availability cache. NIGDY nie rzuca — błąd zawsze
 * jako typed `RenderHtmlPngErr`.
 *
 * Domyślny viewport 1920×1080 dopasowany do decka (deliverables graphic
 * parameters: deck canvas 1920×1080). Doc → fullPage=true zalecane.
 */
export async function renderHtmlToPng(input: RenderHtmlPngInput): Promise<RenderHtmlPngResult> {
  const startedAt = Date.now();
  const navigationTimeoutMs =
    typeof input.navigationTimeoutMs === 'number' && input.navigationTimeoutMs > 0
      ? input.navigationTimeoutMs
      : DEFAULT_NAVIGATION_TIMEOUT_MS;

  const viewportWidth = input.pngOptions?.viewportWidth ?? 1920;
  const viewportHeight = input.pngOptions?.viewportHeight ?? 1080;
  const deviceScaleFactor = input.pngOptions?.deviceScaleFactor ?? 1;
  const screenshotOpts = buildScreenshotOptions(input.pngOptions);

  // Availability gate.
  let availability: AvailabilityResult;
  try {
    availability = await isPlaywrightPdfRendererAvailable();
  } catch (err) {
    return {
      status: 'unavailable',
      reason: `availability_probe_threw: ${errorMessage(err)}`,
      durationMs: Date.now() - startedAt,
    };
  }
  if (!availability.available) {
    return {
      status: 'unavailable',
      reason: availability.reason || 'unavailable',
      durationMs: Date.now() - startedAt,
    };
  }

  // Launch shared browser.
  let browser: PdfBrowser;
  try {
    browser = await launchBrowser();
  } catch (err) {
    if (isExecutableMissingError(err)) {
      setFailureCache('chromium_binary_missing');
      return {
        status: 'unavailable',
        reason: 'chromium_binary_missing',
        durationMs: Date.now() - startedAt,
      };
    }
    await disposeSharedBrowser();
    return {
      status: 'launch_failed',
      reason: errorMessage(err),
      durationMs: Date.now() - startedAt,
    };
  }

  // Render with hard timeout.
  let context: PdfBrowserContext | null = null;
  let page: PngBrowserPage | null = null;
  let timer: NodeJS.Timeout | null = null;

  try {
    const work = (async (): Promise<RenderHtmlPngResult> => {
      context = await browser.newContext({
        viewport: { width: viewportWidth, height: viewportHeight },
        deviceScaleFactor,
      });
      page = (await context.newPage()) as PngBrowserPage;
      page.setDefaultNavigationTimeout?.(navigationTimeoutMs);
      page.setDefaultTimeout?.(navigationTimeoutMs);

      await page.setContent(input.html, {
        waitUntil: 'networkidle',
        timeout: navigationTimeoutMs,
      });

      const raw = await page.screenshot(screenshotOpts);
      const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
      return {
        status: 'ok',
        buffer,
        bytes: buffer.length,
        durationMs: Date.now() - startedAt,
      };
    })();

    const timeout = new Promise<RenderHtmlPngResult>((resolve) => {
      timer = setTimeout(() => {
        resolve({
          status: 'timeout',
          reason: `render_timeout_${navigationTimeoutMs}ms`,
          durationMs: Date.now() - startedAt,
        });
      }, navigationTimeoutMs);
    });

    return await Promise.race([work, timeout]);
  } catch (err) {
    if (isExecutableMissingError(err)) {
      setFailureCache('chromium_binary_missing');
      await disposeSharedBrowser();
      return {
        status: 'unavailable',
        reason: 'chromium_binary_missing',
        durationMs: Date.now() - startedAt,
      };
    }
    const msg = errorMessage(err).toLowerCase();
    if (
      msg.includes('target closed') ||
      msg.includes('browser has been closed') ||
      msg.includes('browser closed') ||
      msg.includes('disconnected')
    ) {
      await disposeSharedBrowser();
    }
    return {
      status: 'render_failed',
      reason: errorMessage(err),
      durationMs: Date.now() - startedAt,
    };
  } finally {
    if (timer) clearTimeout(timer);
    const pageRef = page as PngBrowserPage | null;
    const contextRef = context as PdfBrowserContext | null;
    if (pageRef) {
      try {
        await pageRef.close();
      } catch {
        // best-effort
      }
    }
    if (contextRef) {
      try {
        await contextRef.close();
      } catch {
        // best-effort
      }
    }
  }
}
