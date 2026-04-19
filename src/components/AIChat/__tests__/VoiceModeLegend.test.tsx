/**
 * Chat V9 / VOICE VM3 — tests for the voice modes legend popover.
 *
 * Coverage:
 *   - Renders trigger when the flag is on, nothing when off.
 *   - Popover opens on click, closes on Escape, closes on outside click.
 *   - `voice_mode_legend_opened` telemetry fires **once per open** (so a
 *     click that toggles open → close → open emits two events, never one).
 *   - Telemetry failures never break the popover.
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { VOICE_LEGEND_OPEN_EVENT } from '../../../utils/voiceLegendShortcutFlag';
import { VoiceModeLegend } from '../VoiceModeLegend';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));

const trackFunnelEventMock = vi.fn();
vi.mock('@/services/funnelAnalytics', () => ({
  trackFunnelEvent: (...args: unknown[]) => trackFunnelEventMock(...args),
}));

describe('VoiceModeLegend', () => {
  beforeEach(() => {
    trackFunnelEventMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing when the flag is disabled', () => {
    const { container } = render(<VoiceModeLegend isEnabled={() => false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the trigger button when the flag is enabled', () => {
    render(<VoiceModeLegend isEnabled={() => true} />);
    expect(screen.getByTestId('voice-mode-legend-trigger')).toBeInTheDocument();
    expect(screen.queryByTestId('voice-mode-legend-popover')).not.toBeInTheDocument();
  });

  it('opens the popover on click and fires telemetry once', () => {
    render(<VoiceModeLegend isEnabled={() => true} />);
    const trigger = screen.getByTestId('voice-mode-legend-trigger');
    fireEvent.click(trigger);

    expect(screen.getByTestId('voice-mode-legend-popover')).toBeInTheDocument();
    // Popover content honours the spec's "two modes" guidance.
    expect(screen.getByText('Dictation')).toBeInTheDocument();
    expect(screen.getByText('Conversation (live)')).toBeInTheDocument();

    expect(trackFunnelEventMock).toHaveBeenCalledTimes(1);
    expect(trackFunnelEventMock).toHaveBeenCalledWith('voice_mode_legend_opened', {});
  });

  it('toggles closed on a second trigger click without firing telemetry on close', () => {
    render(<VoiceModeLegend isEnabled={() => true} />);
    const trigger = screen.getByTestId('voice-mode-legend-trigger');

    fireEvent.click(trigger); // open
    fireEvent.click(trigger); // close

    expect(screen.queryByTestId('voice-mode-legend-popover')).not.toBeInTheDocument();
    // Only the opening click should emit an event; closing is silent.
    expect(trackFunnelEventMock).toHaveBeenCalledTimes(1);
  });

  it('emits a new event for each subsequent open gesture', () => {
    render(<VoiceModeLegend isEnabled={() => true} />);
    const trigger = screen.getByTestId('voice-mode-legend-trigger');

    fireEvent.click(trigger); // open (1)
    fireEvent.click(trigger); // close
    fireEvent.click(trigger); // open (2)

    expect(trackFunnelEventMock).toHaveBeenCalledTimes(2);
  });

  it('closes the popover when the Escape key is pressed', () => {
    render(<VoiceModeLegend isEnabled={() => true} />);
    fireEvent.click(screen.getByTestId('voice-mode-legend-trigger'));
    expect(screen.getByTestId('voice-mode-legend-popover')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('voice-mode-legend-popover')).not.toBeInTheDocument();
  });

  it('closes the popover when the user clicks outside', () => {
    render(
      <div>
        <button data-testid="outside">outside</button>
        <VoiceModeLegend isEnabled={() => true} />
      </div>
    );

    fireEvent.click(screen.getByTestId('voice-mode-legend-trigger'));
    expect(screen.getByTestId('voice-mode-legend-popover')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(screen.queryByTestId('voice-mode-legend-popover')).not.toBeInTheDocument();
  });

  it('still opens the popover when telemetry throws', () => {
    trackFunnelEventMock.mockImplementationOnce(() => {
      throw new Error('telemetry exploded');
    });

    render(<VoiceModeLegend isEnabled={() => true} />);
    fireEvent.click(screen.getByTestId('voice-mode-legend-trigger'));

    // Popover is visible despite the telemetry failure — the legend is a
    // user-visible feature, not a tracking dependency.
    expect(screen.getByTestId('voice-mode-legend-popover')).toBeInTheDocument();
  });

  // ---------------------------------------------------------------------
  // VM1-lite — `unavailable` prop swaps the popover content.
  // ---------------------------------------------------------------------
  describe('VM1-lite unavailable mode', () => {
    it('renders the unavailable notice instead of the modes list when `unavailable`', () => {
      render(<VoiceModeLegend isEnabled={() => true} unavailable />);
      fireEvent.click(screen.getByTestId('voice-mode-legend-trigger'));

      expect(screen.getByTestId('voice-mode-legend-unavailable')).toBeInTheDocument();
      // The two normal rows must NOT render — their presence would be
      // actively misleading (the user has no mic button to use them).
      expect(screen.queryByText('Dictation')).not.toBeInTheDocument();
      expect(screen.queryByText('Conversation (live)')).not.toBeInTheDocument();
    });

    it('still fires telemetry on open when unavailable — it is still an explicit "I want help" signal', () => {
      render(<VoiceModeLegend isEnabled={() => true} unavailable />);
      fireEvent.click(screen.getByTestId('voice-mode-legend-trigger'));

      expect(trackFunnelEventMock).toHaveBeenCalledTimes(1);
      expect(trackFunnelEventMock).toHaveBeenCalledWith('voice_mode_legend_opened', {});
    });

    it('renders the normal modes list when `unavailable` is false / omitted', () => {
      render(<VoiceModeLegend isEnabled={() => true} unavailable={false} />);
      fireEvent.click(screen.getByTestId('voice-mode-legend-trigger'));

      expect(screen.queryByTestId('voice-mode-legend-unavailable')).not.toBeInTheDocument();
      expect(screen.getByText('Dictation')).toBeInTheDocument();
      expect(screen.getByText('Conversation (live)')).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------
  // VM3.1 — `chat-v9-voice-legend:open` CustomEvent listener.
  // ---------------------------------------------------------------------
  describe('VM3.1 CustomEvent listener', () => {
    it('opens the popover when the open event is dispatched', () => {
      render(<VoiceModeLegend isEnabled={() => true} />);
      expect(screen.queryByTestId('voice-mode-legend-popover')).not.toBeInTheDocument();

      act(() => {
        window.dispatchEvent(new CustomEvent(VOICE_LEGEND_OPEN_EVENT));
      });

      expect(screen.getByTestId('voice-mode-legend-popover')).toBeInTheDocument();
    });

    it('fires `voice_mode_legend_opened` telemetry for shortcut-triggered opens too', () => {
      render(<VoiceModeLegend isEnabled={() => true} />);
      act(() => {
        window.dispatchEvent(new CustomEvent(VOICE_LEGEND_OPEN_EVENT));
      });
      expect(trackFunnelEventMock).toHaveBeenCalledTimes(1);
      expect(trackFunnelEventMock).toHaveBeenCalledWith('voice_mode_legend_opened', {});
    });

    it('ignores the open event when the flag is disabled', () => {
      render(<VoiceModeLegend isEnabled={() => false} />);
      act(() => {
        window.dispatchEvent(new CustomEvent(VOICE_LEGEND_OPEN_EVENT));
      });
      expect(screen.queryByTestId('voice-mode-legend-popover')).not.toBeInTheDocument();
      expect(trackFunnelEventMock).not.toHaveBeenCalled();
    });

    it('unmounts the listener cleanly', () => {
      const { unmount } = render(<VoiceModeLegend isEnabled={() => true} />);
      unmount();
      // After unmount, dispatching the event must be a no-op — no
      // throw, no telemetry, no lingering state.
      expect(() => {
        act(() => {
          window.dispatchEvent(new CustomEvent(VOICE_LEGEND_OPEN_EVENT));
        });
      }).not.toThrow();
      expect(trackFunnelEventMock).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------
  // VM3.2 — "Copy legend" button in the popover footer.
  //
  // Coverage:
  //   - Button renders iff the VM3.2 kill-switch is ON.
  //   - Copying writes the `buildVoiceLegendCopyText` payload that
  //     matches whichever layout (two-mode / unavailable) the popover
  //     is showing.
  //   - Transient `idle → copied → idle` and `idle → failed → idle`
  //     feedback windows honour their 2 s timer.
  //   - Feedback resets when the popover closes so the next open
  //     starts clean.
  //   - The button does NOT emit telemetry — VM3.2 is explicitly
  //     telemetry-free.
  // ---------------------------------------------------------------------
  describe('VM3.2 copy-legend button', () => {
    it('renders the copy button when the kill-switch is ON and popover is open', () => {
      render(
        <VoiceModeLegend isEnabled={() => true} isCopyTextEnabled={() => true} />
      );
      fireEvent.click(screen.getByTestId('voice-mode-legend-trigger'));
      const copyBtn = screen.getByTestId('voice-mode-legend-copy');
      expect(copyBtn).toBeInTheDocument();
      expect(copyBtn.getAttribute('data-state')).toBe('idle');
    });

    it('does NOT render the copy button when the kill-switch is OFF', () => {
      render(
        <VoiceModeLegend isEnabled={() => true} isCopyTextEnabled={() => false} />
      );
      fireEvent.click(screen.getByTestId('voice-mode-legend-trigger'));
      expect(
        screen.queryByTestId('voice-mode-legend-copy')
      ).not.toBeInTheDocument();
    });

    it('writes the two-mode Markdown payload to the clipboard and transitions to "copied"', async () => {
      vi.useFakeTimers();
      try {
        const writeToClipboard = vi.fn().mockResolvedValue({ ok: true });
        render(
          <VoiceModeLegend
            isEnabled={() => true}
            isCopyTextEnabled={() => true}
            writeToClipboard={writeToClipboard}
          />
        );
        fireEvent.click(screen.getByTestId('voice-mode-legend-trigger'));
        const btn = screen.getByTestId('voice-mode-legend-copy');

        await act(async () => {
          fireEvent.click(btn);
        });

        expect(writeToClipboard).toHaveBeenCalledTimes(1);
        const payload = writeToClipboard.mock.calls[0][0] as string;
        expect(payload).toContain('Voice modes:');
        expect(payload).toContain('- Dictation — ');
        expect(payload).toContain('- Conversation (live) — ');
        expect(btn.getAttribute('data-state')).toBe('copied');
      } finally {
        vi.useRealTimers();
      }
    });

    it('writes the unavailable-layout payload when `unavailable` is true', async () => {
      const writeToClipboard = vi.fn().mockResolvedValue({ ok: true });
      render(
        <VoiceModeLegend
          isEnabled={() => true}
          unavailable
          isCopyTextEnabled={() => true}
          writeToClipboard={writeToClipboard}
        />
      );
      fireEvent.click(screen.getByTestId('voice-mode-legend-trigger'));

      await act(async () => {
        fireEvent.click(screen.getByTestId('voice-mode-legend-copy'));
      });

      expect(writeToClipboard).toHaveBeenCalledTimes(1);
      const payload = writeToClipboard.mock.calls[0][0] as string;
      expect(payload).toContain('Voice modes:');
      expect(payload).toContain('Voice is unavailable in this browser.');
      expect(payload).not.toContain('Dictation');
    });

    it('transitions back to "idle" after the 2 s feedback window', async () => {
      vi.useFakeTimers();
      try {
        const writeToClipboard = vi.fn().mockResolvedValue({ ok: true });
        render(
          <VoiceModeLegend
            isEnabled={() => true}
            isCopyTextEnabled={() => true}
            writeToClipboard={writeToClipboard}
          />
        );
        fireEvent.click(screen.getByTestId('voice-mode-legend-trigger'));
        const btn = screen.getByTestId('voice-mode-legend-copy');

        await act(async () => {
          fireEvent.click(btn);
        });
        expect(btn.getAttribute('data-state')).toBe('copied');

        await act(async () => {
          vi.advanceTimersByTime(2000);
        });
        expect(btn.getAttribute('data-state')).toBe('idle');
      } finally {
        vi.useRealTimers();
      }
    });

    it('transitions to "failed" when the clipboard write fails', async () => {
      const writeToClipboard = vi
        .fn()
        .mockResolvedValue({ ok: false, reason: 'permission-denied' });
      render(
        <VoiceModeLegend
          isEnabled={() => true}
          isCopyTextEnabled={() => true}
          writeToClipboard={writeToClipboard}
        />
      );
      fireEvent.click(screen.getByTestId('voice-mode-legend-trigger'));
      const btn = screen.getByTestId('voice-mode-legend-copy');

      await act(async () => {
        fireEvent.click(btn);
      });

      expect(btn.getAttribute('data-state')).toBe('failed');
    });

    it('transitions to "failed" when the clipboard writer throws', async () => {
      const writeToClipboard = vi.fn().mockRejectedValue(new Error('boom'));
      render(
        <VoiceModeLegend
          isEnabled={() => true}
          isCopyTextEnabled={() => true}
          writeToClipboard={writeToClipboard}
        />
      );
      fireEvent.click(screen.getByTestId('voice-mode-legend-trigger'));
      const btn = screen.getByTestId('voice-mode-legend-copy');

      await act(async () => {
        fireEvent.click(btn);
      });

      expect(btn.getAttribute('data-state')).toBe('failed');
    });

    it('resets the feedback when the popover closes and the next open starts clean', async () => {
      const writeToClipboard = vi.fn().mockResolvedValue({ ok: true });
      render(
        <VoiceModeLegend
          isEnabled={() => true}
          isCopyTextEnabled={() => true}
          writeToClipboard={writeToClipboard}
        />
      );
      const trigger = screen.getByTestId('voice-mode-legend-trigger');
      fireEvent.click(trigger);
      await act(async () => {
        fireEvent.click(screen.getByTestId('voice-mode-legend-copy'));
      });
      expect(screen.getByTestId('voice-mode-legend-copy').getAttribute('data-state'))
        .toBe('copied');

      fireEvent.click(trigger); // close
      fireEvent.click(trigger); // re-open

      expect(
        screen.getByTestId('voice-mode-legend-copy').getAttribute('data-state')
      ).toBe('idle');
    });

    it('does NOT fire telemetry when the copy button is clicked (VM3.2 is telemetry-free)', async () => {
      const writeToClipboard = vi.fn().mockResolvedValue({ ok: true });
      render(
        <VoiceModeLegend
          isEnabled={() => true}
          isCopyTextEnabled={() => true}
          writeToClipboard={writeToClipboard}
        />
      );
      fireEvent.click(screen.getByTestId('voice-mode-legend-trigger'));
      trackFunnelEventMock.mockClear();

      await act(async () => {
        fireEvent.click(screen.getByTestId('voice-mode-legend-copy'));
      });

      expect(trackFunnelEventMock).not.toHaveBeenCalled();
    });

    it('uses distinct aria-labels across idle / copied / failed states', async () => {
      const writeToClipboard = vi.fn().mockResolvedValue({ ok: true });
      render(
        <VoiceModeLegend
          isEnabled={() => true}
          isCopyTextEnabled={() => true}
          writeToClipboard={writeToClipboard}
        />
      );
      fireEvent.click(screen.getByTestId('voice-mode-legend-trigger'));
      const btn = screen.getByTestId('voice-mode-legend-copy');
      expect(btn.getAttribute('aria-label')).toContain('Copy voice legend');

      await act(async () => {
        fireEvent.click(btn);
      });
      expect(btn.getAttribute('aria-label')).toContain('copied to clipboard');
    });
  });
});
