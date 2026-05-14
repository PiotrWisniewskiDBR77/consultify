import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('recordSpaNavigationWebPerf', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('writes a namespaced performance mark for a route key', async () => {
    const mark = vi.fn();
    const measure = vi.fn();
    Object.defineProperty(globalThis, 'performance', {
      configurable: true,
      value: { mark, measure },
    });

    const { recordSpaNavigationWebPerf } = await import('@/lib/spaNavigationWebPerf');
    recordSpaNavigationWebPerf('/foo?bar=1');

    expect(mark).toHaveBeenCalledTimes(1);
    const firstMark = mark.mock.calls[0]?.[0] as string;
    expect(firstMark.startsWith('consultify:spa-nav:')).toBe(true);
    expect(firstMark).toContain('/foo?bar=1');
    expect(measure).not.toHaveBeenCalled();
  });

  it('adds deterministic sequence and interval measure for repeated route marks', async () => {
    const mark = vi.fn();
    const measure = vi.fn();
    Object.defineProperty(globalThis, 'performance', {
      configurable: true,
      value: { mark, measure },
    });

    const { recordSpaNavigationWebPerf } = await import('@/lib/spaNavigationWebPerf');
    recordSpaNavigationWebPerf('/same');
    recordSpaNavigationWebPerf('/same');

    expect(mark).toHaveBeenCalledTimes(2);
    const firstMark = mark.mock.calls[0]?.[0] as string;
    const secondMark = mark.mock.calls[1]?.[0] as string;
    expect(firstMark).toMatch(/:1$/);
    expect(secondMark).toMatch(/:2$/);
    expect(secondMark).not.toBe(firstMark);
    expect(measure).toHaveBeenCalledTimes(1);
    expect(measure).toHaveBeenCalledWith('consultify:spa-nav-interval:2', firstMark, secondMark);
  });

  it('does not throw when performance.measure throws', async () => {
    const mark = vi.fn();
    const measure = vi.fn(() => {
      throw new Error('measure collision');
    });
    Object.defineProperty(globalThis, 'performance', {
      configurable: true,
      value: { mark, measure },
    });

    const { recordSpaNavigationWebPerf } = await import('@/lib/spaNavigationWebPerf');
    expect(() => {
      recordSpaNavigationWebPerf('/same');
      recordSpaNavigationWebPerf('/same');
      recordSpaNavigationWebPerf('/same');
    }).not.toThrow();
  });

  it('does not throw when performance api is unavailable', async () => {
    Object.defineProperty(globalThis, 'performance', {
      configurable: true,
      value: undefined,
    });

    const { recordSpaNavigationWebPerf } = await import('@/lib/spaNavigationWebPerf');
    expect(() => recordSpaNavigationWebPerf('x')).not.toThrow();
  });
});

