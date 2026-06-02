import { beforeEach, describe, expect, it, vi } from 'vitest';

const addFeedbackBreadcrumbMock = vi.hoisted(() => vi.fn());

vi.mock('@/services/feedbackCollector', () => ({
  addFeedbackBreadcrumb: addFeedbackBreadcrumbMock,
}));

describe('handleReactRecoverableError', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('writes recoverable breadcrumb and performance mark', async () => {
    const mark = vi.fn();
    Object.defineProperty(globalThis, 'performance', {
      configurable: true,
      value: { mark },
    });

    const { handleReactRecoverableError } = await import('@/bootstrap/reactRecoverableTelemetry');
    handleReactRecoverableError(new Error('hello'));

    expect(addFeedbackBreadcrumbMock).toHaveBeenCalledTimes(1);
    const breadcrumb = addFeedbackBreadcrumbMock.mock.calls[0]?.[0];
    expect(breadcrumb.label.startsWith('recoverable:')).toBe(true);
    expect(breadcrumb.label.length).toBeLessThanOrEqual(120);
    expect(mark).toHaveBeenCalledTimes(1);
    expect(mark.mock.calls[0]?.[0]).toMatch(/^consultify:react-recoverable:/);
  });

  it('keeps breadcrumb path when performance mark throws', async () => {
    const mark = vi.fn(() => {
      throw new Error('mark unavailable');
    });
    Object.defineProperty(globalThis, 'performance', {
      configurable: true,
      value: { mark },
    });

    const { handleReactRecoverableError } = await import('@/bootstrap/reactRecoverableTelemetry');
    expect(() => handleReactRecoverableError(new Error('recoverable'))).not.toThrow();
    expect(addFeedbackBreadcrumbMock).toHaveBeenCalledTimes(1);
  });

  it('supports non-error reason values', async () => {
    Object.defineProperty(globalThis, 'performance', {
      configurable: true,
      value: { mark: vi.fn() },
    });
    const { handleReactRecoverableError } = await import('@/bootstrap/reactRecoverableTelemetry');
    handleReactRecoverableError('plain-reason');

    const breadcrumb = addFeedbackBreadcrumbMock.mock.calls[0]?.[0];
    expect(breadcrumb.label.startsWith('recoverable:')).toBe(true);
  });
});

