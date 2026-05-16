import { beforeEach, describe, expect, it, vi } from 'vitest';

import { installDocumentLifecycleWebPerf } from '@/bootstrap/documentLifecycleWebPerf';

describe('document lifecycle web perf contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marks visibility hidden and visible states and unsubscribes cleanly', () => {
    const mark = vi.fn();
    Object.defineProperty(globalThis, 'performance', {
      configurable: true,
      value: { mark },
    });

    let visibility = 'visible';
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibility,
    });

    const unsubscribe = installDocumentLifecycleWebPerf();

    visibility = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
    expect(mark.mock.calls.at(-1)?.[0]).toBe('consultify:doc-visibility:hidden');

    visibility = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    expect(mark.mock.calls.at(-1)?.[0]).toBe('consultify:doc-visibility:visible');

    const callCountBeforeUnsubscribe = mark.mock.calls.length;
    unsubscribe();
    visibility = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
    expect(mark.mock.calls.length).toBe(callCountBeforeUnsubscribe);
  });
});

