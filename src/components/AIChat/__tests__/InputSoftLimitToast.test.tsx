/**
 * Chat V9 / INPUT C-IN6-lite — component tests for the headless
 * one-shot soft-limit inline toast.
 *
 * We inject all seams (`isEnabled`, `hasFiredForSession`,
 * `markFiredForSession`, `isDismissedForSession`,
 * `markDismissedForSession`, `notify`) so the tests stay fully
 * deterministic without touching real sessionStorage. Each test
 * controls the flag + sentinel state explicitly; the notifier is
 * always a spy so the payload can be asserted without rendering
 * `react-hot-toast`'s surface.
 */

import { render } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { buildInputSoftLimitToastMessage, InputSoftLimitToast } from '../InputSoftLimitToast';

function renderWithValue(
  value: string,
  overrides: Partial<Parameters<typeof InputSoftLimitToast>[0]> = {}
) {
  return render(
    <InputSoftLimitToast
      value={value}
      isEnabled={() => true}
      hasFiredForSession={() => false}
      markFiredForSession={vi.fn()}
      isDismissedForSession={() => false}
      markDismissedForSession={vi.fn()}
      notify={vi.fn()}
      {...overrides}
    />
  );
}

describe('buildInputSoftLimitToastMessage', () => {
  it('embeds both counts with locale-aware formatting', () => {
    const msg = buildInputSoftLimitToastMessage(8200, 8000);
    expect(msg).toContain('8,200');
    expect(msg).toContain('8,000');
  });

  it('mentions Teresa so the nudge reads as platform-consistent', () => {
    const msg = buildInputSoftLimitToastMessage(10000, 8000);
    expect(msg.toLowerCase()).toContain('teresa');
  });
});

describe('InputSoftLimitToast', () => {
  it('stays silent on first render below the threshold', () => {
    const notify = vi.fn();
    renderWithValue('a'.repeat(500), { notify, max: 8000 });
    expect(notify).not.toHaveBeenCalled();
  });

  it('stays silent on first render at the threshold (no rising edge)', () => {
    // First render sets `prevLengthRef` to the current length; the
    // detector only fires on a strict `prev < max && curr >= max`
    // transition, so a component mounted with the textarea already
    // past the cap must not nag the user.
    const notify = vi.fn();
    renderWithValue('a'.repeat(8500), { notify, max: 8000 });
    expect(notify).not.toHaveBeenCalled();
  });

  it('fires exactly once when the user crosses the threshold', () => {
    const notify = vi.fn();
    const markFired = vi.fn();
    const { rerender } = render(
      <InputSoftLimitToast
        value={'a'.repeat(7999)}
        max={8000}
        isEnabled={() => true}
        hasFiredForSession={() => false}
        markFiredForSession={markFired}
        isDismissedForSession={() => false}
        markDismissedForSession={vi.fn()}
        notify={notify}
      />
    );
    expect(notify).not.toHaveBeenCalled();

    rerender(
      <InputSoftLimitToast
        value={'a'.repeat(8000)}
        max={8000}
        isEnabled={() => true}
        hasFiredForSession={() => false}
        markFiredForSession={markFired}
        isDismissedForSession={() => false}
        markDismissedForSession={vi.fn()}
        notify={notify}
      />
    );
    expect(notify).toHaveBeenCalledTimes(1);
    expect(markFired).toHaveBeenCalledTimes(1);

    // Further edits past the limit must NOT re-fire.
    rerender(
      <InputSoftLimitToast
        value={'a'.repeat(8500)}
        max={8000}
        isEnabled={() => true}
        hasFiredForSession={() => false}
        markFiredForSession={markFired}
        isDismissedForSession={() => false}
        markDismissedForSession={vi.fn()}
        notify={notify}
      />
    );
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('passes length + max + onDismissForSession into the notifier', () => {
    const notify = vi.fn();
    const markDismiss = vi.fn();
    const { rerender } = render(
      <InputSoftLimitToast
        value={'a'.repeat(100)}
        max={8000}
        isEnabled={() => true}
        hasFiredForSession={() => false}
        markFiredForSession={vi.fn()}
        isDismissedForSession={() => false}
        markDismissedForSession={markDismiss}
        notify={notify}
      />
    );
    rerender(
      <InputSoftLimitToast
        value={'a'.repeat(8200)}
        max={8000}
        isEnabled={() => true}
        hasFiredForSession={() => false}
        markFiredForSession={vi.fn()}
        isDismissedForSession={() => false}
        markDismissedForSession={markDismiss}
        notify={notify}
      />
    );

    expect(notify).toHaveBeenCalledTimes(1);
    const [message, options] = notify.mock.calls[0];
    expect(message).toContain('8,200');
    expect(options.length).toBe(8200);
    expect(options.max).toBe(8000);
    expect(typeof options.onDismissForSession).toBe('function');

    options.onDismissForSession();
    expect(markDismiss).toHaveBeenCalledTimes(1);
  });

  it('stays silent when the kill-switch is OFF even on a rising edge', () => {
    const notify = vi.fn();
    const { rerender } = render(
      <InputSoftLimitToast
        value={'a'.repeat(100)}
        max={8000}
        isEnabled={() => false}
        hasFiredForSession={() => false}
        markFiredForSession={vi.fn()}
        isDismissedForSession={() => false}
        markDismissedForSession={vi.fn()}
        notify={notify}
      />
    );
    rerender(
      <InputSoftLimitToast
        value={'a'.repeat(9000)}
        max={8000}
        isEnabled={() => false}
        hasFiredForSession={() => false}
        markFiredForSession={vi.fn()}
        isDismissedForSession={() => false}
        markDismissedForSession={vi.fn()}
        notify={notify}
      />
    );
    expect(notify).not.toHaveBeenCalled();
  });

  it('stays silent when the session has already dismissed', () => {
    const notify = vi.fn();
    const { rerender } = render(
      <InputSoftLimitToast
        value={'a'.repeat(100)}
        max={8000}
        isEnabled={() => true}
        hasFiredForSession={() => false}
        markFiredForSession={vi.fn()}
        isDismissedForSession={() => true}
        markDismissedForSession={vi.fn()}
        notify={notify}
      />
    );
    rerender(
      <InputSoftLimitToast
        value={'a'.repeat(9000)}
        max={8000}
        isEnabled={() => true}
        hasFiredForSession={() => false}
        markFiredForSession={vi.fn()}
        isDismissedForSession={() => true}
        markDismissedForSession={vi.fn()}
        notify={notify}
      />
    );
    expect(notify).not.toHaveBeenCalled();
  });

  it('stays silent when the tab sentinel says it already fired', () => {
    const notify = vi.fn();
    const { rerender } = render(
      <InputSoftLimitToast
        value={'a'.repeat(100)}
        max={8000}
        isEnabled={() => true}
        hasFiredForSession={() => true}
        markFiredForSession={vi.fn()}
        isDismissedForSession={() => false}
        markDismissedForSession={vi.fn()}
        notify={notify}
      />
    );
    rerender(
      <InputSoftLimitToast
        value={'a'.repeat(9000)}
        max={8000}
        isEnabled={() => true}
        hasFiredForSession={() => true}
        markFiredForSession={vi.fn()}
        isDismissedForSession={() => false}
        markDismissedForSession={vi.fn()}
        notify={notify}
      />
    );
    expect(notify).not.toHaveBeenCalled();
  });

  it('does not re-fire after the user drops below and crosses again in the same mount', () => {
    // The sentinel gate + in-memory ref together make this a
    // per-tab, per-mount nudge. Crossing → dropping below →
    // crossing again in the same mount must stay silent even
    // if the sentinel write failed and `hasFiredForSession`
    // keeps returning false.
    const notify = vi.fn();
    const hasFired = vi.fn().mockReturnValue(false);
    const { rerender } = render(
      <InputSoftLimitToast
        value={'a'.repeat(100)}
        max={8000}
        isEnabled={() => true}
        hasFiredForSession={hasFired}
        markFiredForSession={vi.fn()}
        isDismissedForSession={() => false}
        markDismissedForSession={vi.fn()}
        notify={notify}
      />
    );
    rerender(
      <InputSoftLimitToast
        value={'a'.repeat(9000)}
        max={8000}
        isEnabled={() => true}
        hasFiredForSession={hasFired}
        markFiredForSession={vi.fn()}
        isDismissedForSession={() => false}
        markDismissedForSession={vi.fn()}
        notify={notify}
      />
    );
    rerender(
      <InputSoftLimitToast
        value={'a'.repeat(100)}
        max={8000}
        isEnabled={() => true}
        hasFiredForSession={hasFired}
        markFiredForSession={vi.fn()}
        isDismissedForSession={() => false}
        markDismissedForSession={vi.fn()}
        notify={notify}
      />
    );
    rerender(
      <InputSoftLimitToast
        value={'a'.repeat(9200)}
        max={8000}
        isEnabled={() => true}
        hasFiredForSession={hasFired}
        markFiredForSession={vi.fn()}
        isDismissedForSession={() => false}
        markDismissedForSession={vi.fn()}
        notify={notify}
      />
    );
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('treats non-string value as length 0 without crashing', () => {
    const notify = vi.fn();
    const { rerender } = render(
      <InputSoftLimitToast
        // @ts-expect-error intentionally invalid to exercise defensive guard
        value={undefined}
        max={8000}
        isEnabled={() => true}
        hasFiredForSession={() => false}
        markFiredForSession={vi.fn()}
        isDismissedForSession={() => false}
        markDismissedForSession={vi.fn()}
        notify={notify}
      />
    );
    rerender(
      <InputSoftLimitToast
        value={'a'.repeat(9000)}
        max={8000}
        isEnabled={() => true}
        hasFiredForSession={() => false}
        markFiredForSession={vi.fn()}
        isDismissedForSession={() => false}
        markDismissedForSession={vi.fn()}
        notify={notify}
      />
    );
    // Going from undefined → 9000 is a valid rising edge because
    // the defensive coercion gives the previous length as 0.
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('does not crash when the notifier itself throws', () => {
    const throwingNotify = vi.fn(() => {
      throw new Error('notifier kaboom');
    });
    const markFired = vi.fn();
    const { rerender } = render(
      <InputSoftLimitToast
        value={'a'.repeat(100)}
        max={8000}
        isEnabled={() => true}
        hasFiredForSession={() => false}
        markFiredForSession={markFired}
        isDismissedForSession={() => false}
        markDismissedForSession={vi.fn()}
        notify={throwingNotify}
      />
    );
    expect(() =>
      rerender(
        <InputSoftLimitToast
          value={'a'.repeat(9000)}
          max={8000}
          isEnabled={() => true}
          hasFiredForSession={() => false}
          markFiredForSession={markFired}
          isDismissedForSession={() => false}
          markDismissedForSession={vi.fn()}
          notify={throwingNotify}
        />
      )
    ).not.toThrow();
    // Fire sentinel is still written so a future crash-retry doesn't
    // pile on toasts.
    expect(markFired).toHaveBeenCalledTimes(1);
  });

  it('does not crash when markFiredForSession throws', () => {
    const notify = vi.fn();
    const markFired = vi.fn(() => {
      throw new Error('sessionStorage quota');
    });
    const { rerender } = render(
      <InputSoftLimitToast
        value={'a'.repeat(100)}
        max={8000}
        isEnabled={() => true}
        hasFiredForSession={() => false}
        markFiredForSession={markFired}
        isDismissedForSession={() => false}
        markDismissedForSession={vi.fn()}
        notify={notify}
      />
    );
    expect(() =>
      rerender(
        <InputSoftLimitToast
          value={'a'.repeat(9000)}
          max={8000}
          isEnabled={() => true}
          hasFiredForSession={() => false}
          markFiredForSession={markFired}
          isDismissedForSession={() => false}
          markDismissedForSession={vi.fn()}
          notify={notify}
        />
      )
    ).not.toThrow();
    // The in-memory ref still fires the nudge once.
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('does not crash when onDismissForSession`s markDismissedForSession throws', () => {
    const notify = vi.fn();
    const markDismiss = vi.fn(() => {
      throw new Error('quota again');
    });
    const { rerender } = render(
      <InputSoftLimitToast
        value={'a'.repeat(100)}
        max={8000}
        isEnabled={() => true}
        hasFiredForSession={() => false}
        markFiredForSession={vi.fn()}
        isDismissedForSession={() => false}
        markDismissedForSession={markDismiss}
        notify={notify}
      />
    );
    rerender(
      <InputSoftLimitToast
        value={'a'.repeat(9000)}
        max={8000}
        isEnabled={() => true}
        hasFiredForSession={() => false}
        markFiredForSession={vi.fn()}
        isDismissedForSession={() => false}
        markDismissedForSession={markDismiss}
        notify={notify}
      />
    );
    const [, options] = notify.mock.calls[0];
    expect(() => options.onDismissForSession()).not.toThrow();
    expect(markDismiss).toHaveBeenCalledTimes(1);
  });
});
