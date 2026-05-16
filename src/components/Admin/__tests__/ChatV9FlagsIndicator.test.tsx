/**
 * Chat V9 / ADMIN AG1 v1.1 — tests for the override indicator chip.
 *
 * Coverage:
 *   - Role gate: non-admin + overrides → null.
 *   - Empty-state: admin + 0 overrides → null.
 *   - Render: admin + N overrides → visible pill with correct count.
 *   - Pluralisation: "1 V9 override" vs "N V9 overrides".
 *   - Click dispatches `chat-v9-flags:open` CustomEvent.
 *   - Prop-driven overrideCount wins over live registry read (test
 *     isolation contract).
 *   - Poll interval of 0 disables the timer entirely.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatV9FlagsIndicator } from '../ChatV9FlagsIndicator';

describe('ChatV9FlagsIndicator', () => {
  let openListener: EventListener;

  beforeEach(() => {
    openListener = vi.fn() as EventListener;
    window.addEventListener('chat-v9-flags:open', openListener);
  });

  afterEach(() => {
    window.removeEventListener('chat-v9-flags:open', openListener);
  });

  it('returns null when unauthorised (even with overrides)', () => {
    const { container } = render(
      <ChatV9FlagsIndicator isAuthorized={false} overrideCount={3} pollIntervalMs={0} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('returns null when authorised but zero overrides', () => {
    const { container } = render(
      <ChatV9FlagsIndicator isAuthorized overrideCount={0} pollIntervalMs={0} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('returns null when overrideCount is negative (defensive)', () => {
    const { container } = render(
      <ChatV9FlagsIndicator isAuthorized overrideCount={-1} pollIntervalMs={0} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders a pill when authorised and at least one override is active', () => {
    render(<ChatV9FlagsIndicator isAuthorized overrideCount={2} pollIntervalMs={0} />);
    const pill = screen.getByTestId('chat-v9-flags-indicator');
    expect(pill).toBeInTheDocument();
    expect(pill).toHaveTextContent('2 V9 overrides');
  });

  it('uses singular "override" when exactly one is active', () => {
    render(<ChatV9FlagsIndicator isAuthorized overrideCount={1} pollIntervalMs={0} />);
    const pill = screen.getByTestId('chat-v9-flags-indicator');
    expect(pill).toHaveTextContent('1 V9 override');
    expect(pill).not.toHaveTextContent('overrides');
    expect(pill).toHaveAttribute('aria-label', expect.stringContaining('1 flag override active'));
  });

  it('dispatches `chat-v9-flags:open` on click', () => {
    render(<ChatV9FlagsIndicator isAuthorized overrideCount={1} pollIntervalMs={0} />);
    fireEvent.click(screen.getByTestId('chat-v9-flags-indicator'));
    expect(openListener).toHaveBeenCalledTimes(1);
  });

  it('re-renders when overrideCount prop changes', () => {
    const { rerender, container } = render(
      <ChatV9FlagsIndicator isAuthorized overrideCount={0} pollIntervalMs={0} />
    );
    expect(container.firstChild).toBeNull();

    rerender(<ChatV9FlagsIndicator isAuthorized overrideCount={4} pollIntervalMs={0} />);
    expect(screen.getByTestId('chat-v9-flags-indicator')).toHaveTextContent('4 V9 overrides');

    rerender(<ChatV9FlagsIndicator isAuthorized overrideCount={0} pollIntervalMs={0} />);
    expect(screen.queryByTestId('chat-v9-flags-indicator')).not.toBeInTheDocument();
  });

  it('does not start an interval when pollIntervalMs is 0', () => {
    const setIntervalSpy = vi.spyOn(window, 'setInterval');
    render(<ChatV9FlagsIndicator isAuthorized overrideCount={1} pollIntervalMs={0} />);
    expect(setIntervalSpy).not.toHaveBeenCalled();
    setIntervalSpy.mockRestore();
  });

  it('starts a polling interval when overrideCount prop is absent and authorised', () => {
    // No `overrideCount` prop → component reads live registry on mount
    // AND schedules a poll. The fresh test-registry has zero overrides
    // so the pill itself is not rendered — we only assert the
    // scheduling contract.
    const setIntervalSpy = vi.spyOn(window, 'setInterval');
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
    const { unmount } = render(<ChatV9FlagsIndicator isAuthorized pollIntervalMs={500} />);
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 500);
    unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();
    setIntervalSpy.mockRestore();
    clearIntervalSpy.mockRestore();
  });

  it('does NOT start an interval for unauthorised users (no work done if invisible)', () => {
    const setIntervalSpy = vi.spyOn(window, 'setInterval');
    render(<ChatV9FlagsIndicator isAuthorized={false} pollIntervalMs={500} />);
    expect(setIntervalSpy).not.toHaveBeenCalled();
    setIntervalSpy.mockRestore();
  });
});
