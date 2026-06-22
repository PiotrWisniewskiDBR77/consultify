// @vitest-environment node
/**
 * Unit tests — renderHtmlToPng (X1, W5 / Seria X)
 *
 * Mockujemy 'playwright' — testujemy KONTRAKT renderera (typed result, viewport
 * przekazany do contextu, magic bytes PNG, fail paths). Integration test
 * (rzeczywisty chromium) zostaje w `server/src/services/__tests__/` — wymaga
 * binarki chromium i nie jest deterministyczny w CI.
 *
 * FT-1: ≥3 (status='ok' + buffer + viewport default/custom)
 * FT-4: ≥2 (PNG magic 0x89/0x50/0x4E/0x47; bytes>0)
 * FT-8: ≥2 (unavailable; screenshot throws → render_failed)
 *
 * UWAGA: ten test współdzieli moduł `playwrightPdfRenderer` z testami PDF —
 * resetujemy cache availability i shared browser między testami.
 */

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock 'playwright' — fake chromium.launch / Browser / Context / Page.
const screenshotMock = vi.fn();
const setContentMock = vi.fn(async () => undefined);
const closeMock = vi.fn(async () => undefined);
const newPageMock = vi.fn();
const newContextMock = vi.fn();
const launchMock = vi.fn();

vi.mock('playwright', () => ({
  chromium: {
    launch: (...args: any[]) => launchMock(...args),
  },
}));

// Minimum 8-byte PNG magic header: 89 50 4E 47 0D 0A 1A 0A
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function freshFakePage() {
  const page = {
    setContent: setContentMock,
    setDefaultNavigationTimeout: vi.fn(),
    setDefaultTimeout: vi.fn(),
    screenshot: screenshotMock,
    close: closeMock,
    pdf: vi.fn(),
  };
  newPageMock.mockResolvedValue(page);
  return page;
}

function freshFakeContext() {
  const ctx = {
    newPage: newPageMock,
    close: closeMock,
  };
  newContextMock.mockResolvedValue(ctx);
  return ctx;
}

function freshFakeBrowser() {
  const browser = {
    newContext: newContextMock,
    close: closeMock,
    isConnected: vi.fn(() => true),
  };
  launchMock.mockResolvedValue(browser);
  return browser;
}

describe('renderHtmlToPng (X1)', () => {
  let renderHtmlToPng: typeof import('../../../server/src/services/playwrightPdfRenderer.js').renderHtmlToPng;
  let resetCache: typeof import('../../../server/src/services/playwrightPdfRenderer.js').__resetAvailabilityCacheForTests;
  let shutdown: typeof import('../../../server/src/services/playwrightPdfRenderer.js').__shutdownBrowserForTests;

  beforeEach(async () => {
    vi.resetModules();
    screenshotMock.mockReset();
    setContentMock.mockReset();
    closeMock.mockReset();
    newPageMock.mockReset();
    newContextMock.mockReset();
    launchMock.mockReset();
    setContentMock.mockResolvedValue(undefined);
    closeMock.mockResolvedValue(undefined);
    freshFakePage();
    freshFakeContext();
    freshFakeBrowser();
    screenshotMock.mockResolvedValue(PNG_MAGIC);

    const mod = await import(
      '../../../server/src/services/playwrightPdfRenderer.js'
    );
    renderHtmlToPng = mod.renderHtmlToPng;
    resetCache = mod.__resetAvailabilityCacheForTests;
    shutdown = mod.__shutdownBrowserForTests;
    resetCache();
  });

  afterEach(async () => {
    await shutdown();
  });

  afterAll(() => {
    vi.clearAllMocks();
  });

  // ──────────────────────────────────────────────────────────────
  // FT-1 — typed result + buffer
  // ──────────────────────────────────────────────────────────────

  it('FT-1/1: happy path → status="ok" + buffer + bytes>0 + durationMs', async () => {
    const result = await renderHtmlToPng({
      html: '<!doctype html><html><body><h1>Hello</h1></body></html>',
    });

    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(Buffer.isBuffer(result.buffer)).toBe(true);
      expect(result.bytes).toBeGreaterThan(0);
      expect(typeof result.durationMs).toBe('number');
    }
  });

  it('FT-1/2: viewport default = 1920×1080 (deck-friendly)', async () => {
    await renderHtmlToPng({ html: '<div>x</div>' });

    expect(newContextMock).toHaveBeenCalledOnce();
    const ctxOpts = newContextMock.mock.calls[0][0];
    expect(ctxOpts.viewport).toEqual({ width: 1920, height: 1080 });
    expect(ctxOpts.deviceScaleFactor).toBe(1);
  });

  it('FT-1/3: custom viewport + deviceScaleFactor honored', async () => {
    await renderHtmlToPng({
      html: '<div>x</div>',
      pngOptions: {
        viewportWidth: 1280,
        viewportHeight: 720,
        deviceScaleFactor: 2,
        fullPage: true,
      },
    });

    const ctxOpts = newContextMock.mock.calls[0][0];
    expect(ctxOpts.viewport).toEqual({ width: 1280, height: 720 });
    expect(ctxOpts.deviceScaleFactor).toBe(2);

    const screenshotOpts = screenshotMock.mock.calls[0][0];
    expect(screenshotOpts.type).toBe('png');
    expect(screenshotOpts.fullPage).toBe(true);
  });

  // ──────────────────────────────────────────────────────────────
  // FT-4 — file content (parser-grade evidence)
  // ──────────────────────────────────────────────────────────────

  it('FT-4/4: buffer has PNG magic bytes (89 50 4E 47)', async () => {
    const result = await renderHtmlToPng({ html: '<div>x</div>' });

    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      // First 4 bytes of PNG file format spec.
      expect(result.buffer[0]).toBe(0x89);
      expect(result.buffer[1]).toBe(0x50); // P
      expect(result.buffer[2]).toBe(0x4e); // N
      expect(result.buffer[3]).toBe(0x47); // G
    }
  });

  it('FT-4/5: setContent receives the exact HTML (waitUntil=networkidle)', async () => {
    const html = '<!doctype html><html><body><h1>Quarterly review</h1></body></html>';
    await renderHtmlToPng({ html });

    expect(setContentMock).toHaveBeenCalledOnce();
    const [passedHtml, opts] = setContentMock.mock.calls[0];
    expect(passedHtml).toBe(html);
    expect(opts.waitUntil).toBe('networkidle');
  });

  // ──────────────────────────────────────────────────────────────
  // FT-8 — fail-open (typed errors, never throw)
  // ──────────────────────────────────────────────────────────────

  it('FT-8/6: chromium.launch throws "Executable doesn\'t exist" → unavailable', async () => {
    launchMock.mockRejectedValueOnce(new Error("Executable doesn't exist at /opt/chromium"));

    const result = await renderHtmlToPng({ html: '<div>x</div>' });
    expect(result.status).toBe('unavailable');
    if (result.status !== 'ok') {
      expect(result.reason).toContain('chromium_binary_missing');
    }
  });

  it('FT-8/7: screenshot() throws → status="render_failed" (no throw, finally cleans up)', async () => {
    screenshotMock.mockRejectedValueOnce(new Error('screenshot failed mid-render'));

    const result = await renderHtmlToPng({ html: '<div>x</div>' });
    expect(result.status).toBe('render_failed');

    // Cleanup ran: page.close + context.close (best-effort, in finally).
    expect(closeMock).toHaveBeenCalled();
  });
});
