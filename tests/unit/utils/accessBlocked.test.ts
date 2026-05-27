import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  dispatchAccessBlocked,
  getAccessBlockedCode,
  isAccessBlockedCode,
} from '../../../src/utils/accessBlocked';

describe('accessBlocked utility', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('recognizes high-risk Sprint C access blocked codes', () => {
    expect(isAccessBlockedCode('TRIAL_UPLOAD_DISABLED')).toBe(true);
    expect(isAccessBlockedCode('PUBLIC_SHARE_DISABLED')).toBe(true);
    expect(isAccessBlockedCode('AI_AUTOPILOT_DISABLED')).toBe(true);
    expect(isAccessBlockedCode('UNKNOWN_CODE')).toBe(false);
  });

  it('normalizes FEATURE_ACCESS_DENIED from error field', () => {
    expect(getAccessBlockedCode({ error: 'FEATURE_ACCESS_DENIED' })).toBe('FEATURE_ACCESS_DENIED');
  });

  it('dispatches access:blocked event with CTA path normalized to href', () => {
    const listener = vi.fn();
    window.addEventListener('access:blocked', listener);

    dispatchAccessBlocked(
      {
        code: 'TRIAL_UPLOAD_DISABLED',
        message: 'Ta funkcja jest czasowo wyłączona dla triala.',
        cta: { label: 'Skontaktuj się z zespołem', path: '/contact' },
      },
      'Fallback'
    );

    expect(listener).toHaveBeenCalledTimes(1);
    const event = listener.mock.calls[0][0] as CustomEvent;
    expect(event.detail).toEqual({
      code: 'TRIAL_UPLOAD_DISABLED',
      message: 'Ta funkcja jest czasowo wyłączona dla triala.',
      cta: {
        label: 'Skontaktuj się z zespołem',
        labelKey: undefined,
        href: '/contact',
      },
    });

    window.removeEventListener('access:blocked', listener);
  });
});
