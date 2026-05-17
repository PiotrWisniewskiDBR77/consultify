import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('client web vitals bootstrap visibility flush contract', () => {
  const originalSendBeacon = navigator.sendBeacon;
  const originalFetch = global.fetch;
  const originalVisibilityState = Object.getOwnPropertyDescriptor(document, 'visibilityState');

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 })) as typeof fetch;
  });

  afterEach(() => {
    navigator.sendBeacon = originalSendBeacon;
    global.fetch = originalFetch;

    if (originalVisibilityState) {
      Object.defineProperty(document, 'visibilityState', originalVisibilityState);
    }
  });

  it('sends beacon on visibility hidden after direct webVitals import', async () => {
    navigator.sendBeacon = vi.fn().mockReturnValue(true);

    await import('@/utils/webVitals');

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });

    document.dispatchEvent(new Event('visibilitychange'));

    expect(navigator.sendBeacon).toHaveBeenCalled();
    const [endpoint, payload] = (navigator.sendBeacon as any).mock.calls.at(-1) as [string, string];
    expect(endpoint).toBe('/api/analytics/web-vitals');
    const parsed = JSON.parse(payload);
    expect(typeof parsed.timestamp).toBe('number');
    expect(typeof parsed.url).toBe('string');
    expect(parsed.url.length).toBeGreaterThan(0);
    expect(parsed.metrics).toBeTruthy();
    expect(typeof parsed.metrics).toBe('object');
    expect(parsed.deviceInfo).toBeTruthy();
    expect(typeof parsed.deviceInfo.userAgent).toBe('string');
  });

  it('bootstraps web vitals through client bootstrap module', async () => {
    navigator.sendBeacon = vi.fn().mockReturnValue(true);

    const { bootstrapClientWebVitals } = await import('@/bootstrap/clientWebVitals');
    bootstrapClientWebVitals();

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });

    document.dispatchEvent(new Event('visibilitychange'));

    expect(navigator.sendBeacon).toHaveBeenCalled();
    const [endpoint] = (navigator.sendBeacon as any).mock.calls.at(-1) as [string, string];
    expect(endpoint).toBe('/api/analytics/web-vitals');
  });
});

