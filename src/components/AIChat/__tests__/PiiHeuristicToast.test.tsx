/**
 * Chat V9 / TRUST T-PM2-lite — component tests for the headless
 * post-send PII heuristic toast.
 *
 * We inject all seams (`isEnabled`, `isSessionDismissEnabled`,
 * `isDismissedForSession`, `notify`, `markDismissed`) so the
 * tests stay fully deterministic:
 *   - Feature flags are controlled directly, not through query /
 *     localStorage / env.
 *   - The toast itself is a spy so we can assert the exact
 *     payload without rendering `react-hot-toast`'s surface.
 *   - `markDismissed` and `isDismissedForSession` are spies so
 *     the sessionStorage side-effect is observable without
 *     touching the real storage (which would leak across
 *     tests).
 *
 * Telemetry is asserted through the `trackFunnelEvent` mock so we
 * pin the PII-free payload contract: only `{ categories: [...] }`
 * ever leaves this component.
 */

import { act, render } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { trackFunnelEvent } from '../../../services/funnelAnalytics';
import { CHAT_V9_PII_CHECK_EVENT } from '../../../utils/piiHeuristicToastFlag';
import { PiiHeuristicToast } from '../PiiHeuristicToast';

vi.mock('../../../services/funnelAnalytics', () => ({
  trackFunnelEvent: vi.fn(),
}));

function fireCheck(text: unknown) {
  act(() => {
    window.dispatchEvent(new CustomEvent(CHAT_V9_PII_CHECK_EVENT, { detail: { text } }));
  });
}

describe('PiiHeuristicToast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-18T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stays silent when no PII is detected', () => {
    const notify = vi.fn();
    render(
      <PiiHeuristicToast
        isEnabled={() => true}
        isSessionDismissEnabled={() => true}
        isDismissedForSession={() => false}
        notify={notify}
      />
    );

    fireCheck('please summarise the strategy doc');

    expect(notify).not.toHaveBeenCalled();
    expect(trackFunnelEvent).not.toHaveBeenCalled();
  });

  it('fires a toast and telemetry when an email is detected', () => {
    const notify = vi.fn();
    render(
      <PiiHeuristicToast
        isEnabled={() => true}
        isSessionDismissEnabled={() => true}
        isDismissedForSession={() => false}
        notify={notify}
      />
    );

    fireCheck('mail me at piotr@example.com please');

    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify.mock.calls[0][0]).toContain('email');
    expect(trackFunnelEvent).toHaveBeenCalledTimes(1);
    expect(trackFunnelEvent).toHaveBeenCalledWith('pii_heuristic_warning_shown', {
      categories: ['email'],
    });
  });

  it('lists multiple categories in the toast and the telemetry payload', () => {
    const notify = vi.fn();
    render(
      <PiiHeuristicToast
        isEnabled={() => true}
        isSessionDismissEnabled={() => true}
        isDismissedForSession={() => false}
        notify={notify}
      />
    );

    fireCheck('mail a@b.co, call +48 501 234 567, account DE89370400440532013000');

    expect(notify).toHaveBeenCalledTimes(1);
    const msg = notify.mock.calls[0][0];
    expect(msg).toContain('email');
    expect(msg).toContain('phone');
    expect(msg).toContain('IBAN');
    expect(trackFunnelEvent).toHaveBeenCalledWith('pii_heuristic_warning_shown', {
      categories: ['email', 'phone', 'iban'],
    });
  });

  it('never leaks raw text into the telemetry payload', () => {
    const notify = vi.fn();
    render(
      <PiiHeuristicToast
        isEnabled={() => true}
        isSessionDismissEnabled={() => true}
        isDismissedForSession={() => false}
        notify={notify}
      />
    );

    fireCheck('mail SECRET_piotr@example.com please');

    expect(trackFunnelEvent).toHaveBeenCalledTimes(1);
    const payload = (trackFunnelEvent as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(JSON.stringify(payload)).not.toContain('SECRET_piotr');
    expect(payload).toEqual({ categories: ['email'] });
  });

  it('detaches completely when the kill-switch is OFF', () => {
    const notify = vi.fn();
    render(<PiiHeuristicToast isEnabled={() => false} notify={notify} />);

    fireCheck('mail me at a@b.co');

    expect(notify).not.toHaveBeenCalled();
    expect(trackFunnelEvent).not.toHaveBeenCalled();
  });

  it('throttles rapid follow-up sends within the cooldown window', () => {
    const notify = vi.fn();
    render(
      <PiiHeuristicToast
        isEnabled={() => true}
        isSessionDismissEnabled={() => true}
        isDismissedForSession={() => false}
        notify={notify}
      />
    );

    fireCheck('mail me at a@b.co');
    fireCheck('and again c@d.co');

    expect(notify).toHaveBeenCalledTimes(1);
    expect(trackFunnelEvent).toHaveBeenCalledTimes(1);
  });

  it('fires again after the cooldown elapses', () => {
    const notify = vi.fn();
    render(
      <PiiHeuristicToast
        isEnabled={() => true}
        isSessionDismissEnabled={() => true}
        isDismissedForSession={() => false}
        notify={notify}
      />
    );

    fireCheck('mail me at a@b.co');
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    fireCheck('and c@d.co');

    expect(notify).toHaveBeenCalledTimes(2);
    expect(trackFunnelEvent).toHaveBeenCalledTimes(2);
  });

  it('ignores events with non-string detail.text', () => {
    const notify = vi.fn();
    render(
      <PiiHeuristicToast
        isEnabled={() => true}
        isSessionDismissEnabled={() => true}
        isDismissedForSession={() => false}
        notify={notify}
      />
    );

    fireCheck(123);
    fireCheck(null);
    fireCheck(undefined);

    expect(notify).not.toHaveBeenCalled();
    expect(trackFunnelEvent).not.toHaveBeenCalled();
  });

  it('does not crash when the notifier throws', () => {
    const notify = vi.fn(() => {
      throw new Error('toast surface is broken');
    });
    render(
      <PiiHeuristicToast
        isEnabled={() => true}
        isSessionDismissEnabled={() => true}
        isDismissedForSession={() => false}
        notify={notify}
      />
    );

    expect(() => fireCheck('mail me at a@b.co')).not.toThrow();
    expect(trackFunnelEvent).toHaveBeenCalledTimes(1);
  });

  it('removes its listener on unmount', () => {
    const notify = vi.fn();
    const { unmount } = render(
      <PiiHeuristicToast
        isEnabled={() => true}
        isSessionDismissEnabled={() => true}
        isDismissedForSession={() => false}
        notify={notify}
      />
    );

    unmount();
    fireCheck('mail me at a@b.co');

    expect(notify).not.toHaveBeenCalled();
    expect(trackFunnelEvent).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------
  // T-PM2-lite v1.1 — "Don't show again this session"
  // -------------------------------------------------------------
  describe('T-PM2-lite v1.1 · session-level dismiss', () => {
    it('passes showSessionDismissAction=true when the dismiss flag is ON', () => {
      const notify = vi.fn();
      render(
        <PiiHeuristicToast
          isEnabled={() => true}
          isSessionDismissEnabled={() => true}
          isDismissedForSession={() => false}
          notify={notify}
        />
      );

      fireCheck('mail me at a@b.co');

      expect(notify).toHaveBeenCalledTimes(1);
      const opts = notify.mock.calls[0][1];
      expect(opts.showSessionDismissAction).toBe(true);
      expect(typeof opts.onDismissForSession).toBe('function');
    });

    it('passes showSessionDismissAction=false when the dismiss flag is OFF', () => {
      const notify = vi.fn();
      render(
        <PiiHeuristicToast
          isEnabled={() => true}
          isSessionDismissEnabled={() => false}
          isDismissedForSession={() => false}
          notify={notify}
        />
      );

      fireCheck('mail me at a@b.co');

      expect(notify).toHaveBeenCalledTimes(1);
      const opts = notify.mock.calls[0][1];
      expect(opts.showSessionDismissAction).toBe(false);
      // The callback is still present so tests that exercise the
      // v1.1 path via force-injection stay possible; production
      // UI just never wires it up when the flag is OFF.
      expect(typeof opts.onDismissForSession).toBe('function');
    });

    it('bails out of every subsequent event once the tab is session-dismissed', () => {
      const notify = vi.fn();
      let dismissed = false;
      render(
        <PiiHeuristicToast
          isEnabled={() => true}
          isSessionDismissEnabled={() => true}
          isDismissedForSession={() => dismissed}
          notify={notify}
        />
      );

      fireCheck('mail me at a@b.co');
      expect(notify).toHaveBeenCalledTimes(1);

      // User clicks "Don't show again this session" — the toast
      // layer calls onDismissForSession, which flips the
      // markDismissed seam and ratchets lastFiredAtRef. We
      // simulate both: flip the spy and advance past the
      // cooldown so a re-entry can't be blamed on throttling.
      dismissed = true;
      act(() => {
        vi.advanceTimersByTime(10_000);
      });

      fireCheck('mail again c@d.co');

      expect(notify).toHaveBeenCalledTimes(1);
      expect(trackFunnelEvent).toHaveBeenCalledTimes(1);
    });

    it('calling the supplied onDismissForSession invokes markDismissed', () => {
      const notify = vi.fn();
      const markDismissed = vi.fn();
      render(
        <PiiHeuristicToast
          isEnabled={() => true}
          isSessionDismissEnabled={() => true}
          isDismissedForSession={() => false}
          notify={notify}
          markDismissed={markDismissed}
        />
      );

      fireCheck('mail me at a@b.co');
      const opts = notify.mock.calls[0][1];

      act(() => {
        opts.onDismissForSession();
      });

      expect(markDismissed).toHaveBeenCalledTimes(1);
    });

    it('after onDismissForSession is called, even a cooldown-cleared follow-up stays silent', () => {
      const notify = vi.fn();
      const markDismissed = vi.fn();
      render(
        <PiiHeuristicToast
          isEnabled={() => true}
          isSessionDismissEnabled={() => true}
          // `isDismissedForSession` stays false because the test
          // is simulating a storage write that did not complete
          // before the next event; the defensive lastFiredAtRef
          // bump must still block the follow-up.
          isDismissedForSession={() => false}
          notify={notify}
          markDismissed={markDismissed}
        />
      );

      fireCheck('mail me at a@b.co');
      const opts = notify.mock.calls[0][1];

      act(() => {
        opts.onDismissForSession();
        vi.advanceTimersByTime(10_000);
      });

      fireCheck('and again c@d.co');

      expect(notify).toHaveBeenCalledTimes(1);
    });

    it('stays silent from the first event when sessionStorage already has the sentinel', () => {
      const notify = vi.fn();
      render(
        <PiiHeuristicToast
          isEnabled={() => true}
          isSessionDismissEnabled={() => true}
          isDismissedForSession={() => true}
          notify={notify}
        />
      );

      fireCheck('mail me at a@b.co');

      expect(notify).not.toHaveBeenCalled();
      expect(trackFunnelEvent).not.toHaveBeenCalled();
    });

    it('does not crash when markDismissed itself throws (sentinel write fails)', () => {
      const notify = vi.fn();
      const markDismissed = vi.fn(() => {
        throw new Error('sessionStorage quota exceeded');
      });
      render(
        <PiiHeuristicToast
          isEnabled={() => true}
          isSessionDismissEnabled={() => true}
          isDismissedForSession={() => false}
          notify={notify}
          markDismissed={markDismissed}
        />
      );

      fireCheck('mail me at a@b.co');
      const opts = notify.mock.calls[0][1];

      expect(() => {
        act(() => {
          opts.onDismissForSession();
        });
      }).not.toThrow();
    });
  });
});
