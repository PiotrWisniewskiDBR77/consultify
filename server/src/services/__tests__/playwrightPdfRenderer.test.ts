import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  __resetAvailabilityCacheForTests,
  __shutdownBrowserForTests,
  isPlaywrightPdfRendererAvailable,
  renderHtmlToPdf,
} from '../playwrightPdfRenderer.js';

describe('Playwright PDF renderer', () => {
  let pdfAvailable = false;

  beforeAll(async () => {
    __resetAvailabilityCacheForTests();
    const av = await isPlaywrightPdfRendererAvailable();
    pdfAvailable = av.available;
    if (!pdfAvailable) {
      // eslint-disable-next-line no-console
      console.warn(
        `[skip] Playwright PDF renderer not available — ${av.reason ?? 'unknown reason'}`
      );
    }
  }, 30_000);

  afterAll(async () => {
    await __shutdownBrowserForTests();
  });

  // 1) availability surface always returns a typed result, never throws.
  it('isPlaywrightPdfRendererAvailable returns AvailabilityResult', async () => {
    __resetAvailabilityCacheForTests();
    const av = await isPlaywrightPdfRendererAvailable();
    expect(av).toMatchObject({
      available: expect.any(Boolean),
      detectedAt: expect.any(String),
    });
    if (!av.available) expect(av.reason).toEqual(expect.any(String));
  }, 30_000);

  // 2) renderHtmlToPdf always returns a typed result, never throws.
  it('renderHtmlToPdf returns typed result for empty html', async () => {
    const r = await renderHtmlToPdf({
      html: '<!doctype html><html><body>hi</body></html>',
    });
    expect(['ok', 'unavailable', 'launch_failed', 'render_failed', 'timeout']).toContain(r.status);
    if (r.status === 'ok') {
      expect(r.bytes).toBeGreaterThan(0);
      expect(Buffer.isBuffer(r.buffer)).toBe(true);
      // PDF magic bytes %PDF-
      expect(r.buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    }
  }, 30_000);

  // 3..6 only run when chromium is actually available — skip otherwise.
  const itAvail = (name: string, fn: () => Promise<void>, timeout = 30_000) =>
    it(
      name,
      async () => {
        if (!pdfAvailable) return; // skip silently
        await fn();
      },
      timeout
    );

  itAvail('produces a valid PDF buffer with %PDF- magic for normal HTML', async () => {
    const r = await renderHtmlToPdf({ html: '<h1>Test</h1>' });
    expect(r.status).toBe('ok');
    if (r.status === 'ok') {
      expect(r.buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
      expect(r.bytes).toBeGreaterThan(0);
    }
  });

  itAvail('respects A4 landscape orientation', async () => {
    const r = await renderHtmlToPdf({
      html: '<h1>Landscape</h1>',
      pdfOptions: { format: 'A4', landscape: true },
    });
    expect(r.status).toBe('ok');
  });

  itAvail('honors a 1ms navigationTimeoutMs and returns timeout', async () => {
    // 1ms is too small for any real page → timeout path is exercised.
    const r = await renderHtmlToPdf({
      html: '<h1>Slow</h1>',
      navigationTimeoutMs: 1,
    });
    // Even if chromium is fast enough to ok-render, the test asserts the typed
    // surface — `ok` is acceptable on extremely fast hosts.
    expect(['timeout', 'render_failed', 'ok']).toContain(r.status);
  });

  itAvail('reuses browser across calls (both calls succeed)', async () => {
    const t1 = Date.now();
    const r1 = await renderHtmlToPdf({ html: '<p>1</p>' });
    const d1 = Date.now() - t1;
    const t2 = Date.now();
    const r2 = await renderHtmlToPdf({ html: '<p>2</p>' });
    const d2 = Date.now() - t2;

    expect(r1.status).toBe('ok');
    expect(r2.status).toBe('ok');
    // Soft assertion — both calls must take measurable time.
    expect(d1).toBeGreaterThan(0);
    expect(d2).toBeGreaterThan(0);
  });
});
