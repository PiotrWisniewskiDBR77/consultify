/**
 * Chat V9 / TRUST T-PM1 — tests for the Private mode details popover.
 *
 * Coverage:
 *   - Flag gate: ON → button + popover; OFF → legacy static chip.
 *   - Popover open/close, Escape key, outside click.
 *   - Telemetry emits **once per open** (re-open after close emits again).
 *   - Telemetry failures never break the popover.
 *   - Kill-switch path renders identical badge markup so ops can flip
 *     the flag off without a visual regression.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PrivateModeDetails } from '../PrivateModeDetails';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));

const trackFunnelEventMock = vi.fn();
vi.mock('@/services/funnelAnalytics', () => ({
  trackFunnelEvent: (...args: unknown[]) => trackFunnelEventMock(...args),
}));

describe('PrivateModeDetails', () => {
  beforeEach(() => {
    trackFunnelEventMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------
  // Flag gate — off path returns the legacy static chip, on path the
  // interactive button. Both carry the same user-visible label so the
  // ops kill-switch is visually invisible.
  // -------------------------------------------------------------------
  it('renders the legacy static chip when the flag is disabled', () => {
    render(<PrivateModeDetails isEnabled={() => false} />);
    expect(screen.getByTestId('private-mode-badge-static')).toBeInTheDocument();
    expect(screen.queryByTestId('private-mode-badge-trigger')).not.toBeInTheDocument();
    // No telemetry attempt when the feature itself is off.
    expect(trackFunnelEventMock).not.toHaveBeenCalled();
  });

  it('renders the interactive trigger when the flag is enabled', () => {
    render(<PrivateModeDetails isEnabled={() => true} />);
    expect(screen.getByTestId('private-mode-badge-trigger')).toBeInTheDocument();
    expect(screen.queryByTestId('private-mode-badge-static')).not.toBeInTheDocument();
    // Badge is visible but popover is not until the user clicks.
    expect(screen.queryByTestId('private-mode-details-popover')).not.toBeInTheDocument();
  });

  it('keeps the same user-facing label in both flag states', () => {
    const { rerender } = render(<PrivateModeDetails isEnabled={() => false} />);
    const staticLabel = screen.getByTestId('private-mode-badge-static').textContent;

    rerender(<PrivateModeDetails isEnabled={() => true} />);
    const triggerLabel = screen.getByTestId('private-mode-badge-trigger').textContent;

    expect(triggerLabel).toBe(staticLabel);
  });

  // -------------------------------------------------------------------
  // Popover interaction.
  // -------------------------------------------------------------------
  it('opens the popover on click and closes it on a second click', () => {
    render(<PrivateModeDetails isEnabled={() => true} />);
    const trigger = screen.getByTestId('private-mode-badge-trigger');

    fireEvent.click(trigger);
    expect(screen.getByTestId('private-mode-details-popover')).toBeInTheDocument();

    fireEvent.click(trigger);
    expect(screen.queryByTestId('private-mode-details-popover')).not.toBeInTheDocument();
  });

  it('closes the popover when Escape is pressed', () => {
    render(<PrivateModeDetails isEnabled={() => true} />);
    fireEvent.click(screen.getByTestId('private-mode-badge-trigger'));
    expect(screen.getByTestId('private-mode-details-popover')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('private-mode-details-popover')).not.toBeInTheDocument();
  });

  it('closes the popover on an outside click', () => {
    render(
      <div>
        <PrivateModeDetails isEnabled={() => true} />
        <div data-testid="outside">outside</div>
      </div>
    );
    fireEvent.click(screen.getByTestId('private-mode-badge-trigger'));
    expect(screen.getByTestId('private-mode-details-popover')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(screen.queryByTestId('private-mode-details-popover')).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------
  // Telemetry.
  // -------------------------------------------------------------------
  it('emits `private_mode_details_opened` exactly once per open gesture', () => {
    render(<PrivateModeDetails isEnabled={() => true} />);
    const trigger = screen.getByTestId('private-mode-badge-trigger');

    fireEvent.click(trigger);
    expect(trackFunnelEventMock).toHaveBeenCalledTimes(1);
    expect(trackFunnelEventMock).toHaveBeenCalledWith('private_mode_details_opened', {});

    // Closing the popover must NOT emit a second event.
    fireEvent.click(trigger);
    expect(trackFunnelEventMock).toHaveBeenCalledTimes(1);
  });

  it('emits another event each time the popover is re-opened', () => {
    render(<PrivateModeDetails isEnabled={() => true} />);
    const trigger = screen.getByTestId('private-mode-badge-trigger');

    fireEvent.click(trigger); // open
    fireEvent.click(trigger); // close
    fireEvent.click(trigger); // open again

    expect(trackFunnelEventMock).toHaveBeenCalledTimes(2);
    expect(trackFunnelEventMock).toHaveBeenNthCalledWith(1, 'private_mode_details_opened', {});
    expect(trackFunnelEventMock).toHaveBeenNthCalledWith(2, 'private_mode_details_opened', {});
  });

  it('still opens the popover when telemetry throws', () => {
    trackFunnelEventMock.mockImplementationOnce(() => {
      throw new Error('telemetry exploded');
    });

    render(<PrivateModeDetails isEnabled={() => true} />);
    fireEvent.click(screen.getByTestId('private-mode-badge-trigger'));

    // Popover is visible despite the telemetry failure. The explainer
    // is the higher-value side effect; analytics is advisory.
    expect(screen.getByTestId('private-mode-details-popover')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------
  // Content — the whole point of the ticket is the popover copy.
  // -------------------------------------------------------------------
  it('renders both the "turned off" and "still happens" rows to keep the privacy copy honest', () => {
    render(<PrivateModeDetails isEnabled={() => true} />);
    fireEvent.click(screen.getByTestId('private-mode-badge-trigger'));

    // The two contrasting sections are the core of the ticket. If a
    // refactor accidentally drops one of them we want the test to fail.
    expect(screen.getByText('Turned off for this chat')).toBeInTheDocument();
    expect(screen.getByText('Still happens')).toBeInTheDocument();
  });
});
