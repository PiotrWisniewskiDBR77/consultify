/**
 * Chat V9 / VOICE VM4 — unit tests for `notifyBargeIn`.
 *
 * Contract verified:
 *   - Fires a toast + telemetry when the flag is on.
 *   - Returns `false` and emits nothing when the flag is off.
 *   - Debounces within the 1.5 s window (second call within window is a
 *     silent drop — no toast, no telemetry).
 *   - Re-fires once past the window.
 *   - Telemetry `source` defaults to `unknown` and accepts enum values.
 *   - A failing `toast` call does not throw (defensive try/catch).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const toastMock = vi.fn();
vi.mock('react-hot-toast', () => ({
  default: (...args: unknown[]) => toastMock(...args),
}));

const trackFunnelEventMock = vi.fn();
vi.mock('@/services/funnelAnalytics', () => ({
  trackFunnelEvent: (...args: unknown[]) => trackFunnelEventMock(...args),
}));

const flagMock = vi.fn(() => true);
vi.mock('../bargeInToastFlag', () => ({
  isBargeInToastEnabled: () => flagMock(),
}));

import { BARGE_IN_TOAST_DEBOUNCE_MS, notifyBargeIn, resetBargeInToastState } from '../bargeInToast';

beforeEach(() => {
  toastMock.mockReset();
  trackFunnelEventMock.mockReset();
  flagMock.mockReturnValue(true);
  resetBargeInToastState();
});

afterEach(() => {
  resetBargeInToastState();
});

describe('notifyBargeIn', () => {
  it('shows a toast and emits telemetry when the flag is on', () => {
    const result = notifyBargeIn({
      message: 'Reading interrupted.',
      source: 'mute_button',
      now: 10_000,
    });

    expect(result).toBe(true);
    expect(toastMock).toHaveBeenCalledTimes(1);
    expect(toastMock).toHaveBeenCalledWith(
      'Reading interrupted.',
      expect.objectContaining({
        id: 'voice-barge-in',
      })
    );
    expect(trackFunnelEventMock).toHaveBeenCalledWith('voice_barge_in_notified', {
      source: 'mute_button',
    });
  });

  it('is a no-op when the flag is off', () => {
    flagMock.mockReturnValue(false);
    const result = notifyBargeIn({
      message: 'Reading interrupted.',
      source: 'mute_button',
      now: 10_000,
    });

    expect(result).toBe(false);
    expect(toastMock).not.toHaveBeenCalled();
    expect(trackFunnelEventMock).not.toHaveBeenCalled();
  });

  it('drops subsequent calls inside the debounce window', () => {
    notifyBargeIn({ message: 'first', now: 1_000 });
    const second = notifyBargeIn({ message: 'second', now: 1_500 });
    const third = notifyBargeIn({
      message: 'third',
      now: 1_000 + BARGE_IN_TOAST_DEBOUNCE_MS - 1,
    });

    expect(second).toBe(false);
    expect(third).toBe(false);
    expect(toastMock).toHaveBeenCalledTimes(1);
    expect(trackFunnelEventMock).toHaveBeenCalledTimes(1);
  });

  it('re-fires once the debounce window has passed', () => {
    notifyBargeIn({ message: 'first', now: 1_000 });
    const second = notifyBargeIn({
      message: 'second',
      now: 1_000 + BARGE_IN_TOAST_DEBOUNCE_MS,
    });

    expect(second).toBe(true);
    expect(toastMock).toHaveBeenCalledTimes(2);
    expect(trackFunnelEventMock).toHaveBeenCalledTimes(2);
  });

  it('defaults source to `unknown` when omitted', () => {
    notifyBargeIn({ message: 'hey', now: 10_000 });
    expect(trackFunnelEventMock).toHaveBeenCalledWith('voice_barge_in_notified', {
      source: 'unknown',
    });
  });

  it('swallows toast failures without throwing', () => {
    toastMock.mockImplementationOnce(() => {
      throw new Error('host not mounted');
    });

    expect(() =>
      notifyBargeIn({ message: 'boom', source: 'mute_button', now: 10_000 })
    ).not.toThrow();
    expect(trackFunnelEventMock).toHaveBeenCalledTimes(1);
  });

  it('still marks the slot as used when toast throws (prevents spam)', () => {
    toastMock.mockImplementationOnce(() => {
      throw new Error('host not mounted');
    });

    notifyBargeIn({ message: 'boom', now: 10_000 });
    const second = notifyBargeIn({ message: 'retry', now: 10_100 });

    // Debounce slot was claimed before the throw — second call is a drop.
    expect(second).toBe(false);
  });
});
