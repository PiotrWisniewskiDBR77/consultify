import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('webVitals sendMetrics fallback behavior', () => {
  const originalFetch = global.fetch;
  const originalSendBeacon = navigator.sendBeacon;
  const originalAddEventListener = window.addEventListener;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    window.addEventListener = vi.fn();
    global.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 })) as typeof fetch;
  });

  afterEach(() => {
    window.addEventListener = originalAddEventListener;
    global.fetch = originalFetch;
    navigator.sendBeacon = originalSendBeacon;
  });

  it('does not call fetch when sendBeacon queues payload successfully', async () => {
    navigator.sendBeacon = vi.fn().mockReturnValue(true);

    const module = await import('@/utils/webVitals');
    await module.sendMetrics('/api/analytics/web-vitals');

    expect(navigator.sendBeacon).toHaveBeenCalledTimes(1);
    expect(navigator.sendBeacon).toHaveBeenCalledWith(
      '/api/analytics/web-vitals',
      expect.any(String)
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('falls back to fetch when sendBeacon is unavailable', async () => {
    delete (navigator as Navigator & { sendBeacon?: typeof navigator.sendBeacon }).sendBeacon;

    const module = await import('@/utils/webVitals');
    await module.sendMetrics('/api/analytics/web-vitals');

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/analytics/web-vitals',
      expect.objectContaining({
        method: 'POST',
        keepalive: true,
      })
    );
  });

  it('falls back to fetch when sendBeacon returns false', async () => {
    navigator.sendBeacon = vi.fn().mockReturnValue(false);

    const module = await import('@/utils/webVitals');

    await expect(module.sendMetrics('/api/analytics/web-vitals')).resolves.toBeUndefined();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
