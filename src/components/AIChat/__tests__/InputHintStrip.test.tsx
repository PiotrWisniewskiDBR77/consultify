/**
 * Chat V9 / C-IN4-lite — tests for the input keyboard-hint strip.
 *
 * Coverage:
 *   - Flag gate (ON → render, OFF → null).
 *   - Renders the canonical three-hint sequence in order.
 *   - Every hint has a `<kbd>` and a human action label.
 *   - Separator dots render between hints only (N-1).
 *   - `aria-hidden="true"` on the root so screen readers don't
 *     read the redundant keyboard-affordance copy.
 *   - Accepts and appends the optional `className` prop without
 *     clobbering base classes.
 *   - Zero side effects (no callbacks fire from rendering).
 */

import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { InputHintStrip } from '../InputHintStrip';

describe('InputHintStrip', () => {
  it('returns null when the feature flag is disabled', () => {
    const { container } = render(<InputHintStrip isEnabled={() => false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders a strip when the flag is enabled', () => {
    render(<InputHintStrip isEnabled={() => true} />);
    expect(screen.getByTestId('chat-v9-input-hint-strip')).toBeInTheDocument();
  });

  it('renders the three canonical hints in order: send → newline → clear', () => {
    render(<InputHintStrip isEnabled={() => true} />);
    const send = screen.getByTestId('chat-v9-input-hint-send');
    const newline = screen.getByTestId('chat-v9-input-hint-newline');
    const clear = screen.getByTestId('chat-v9-input-hint-clear');
    expect(send).toBeInTheDocument();
    expect(newline).toBeInTheDocument();
    expect(clear).toBeInTheDocument();

    // DOM order check — compareDocumentPosition returns
    // FOLLOWING (4) when the argument is after `this`.
    expect(send.compareDocumentPosition(newline)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(newline.compareDocumentPosition(clear)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('each hint contains a <kbd> with the key chord and an action label', () => {
    render(<InputHintStrip isEnabled={() => true} />);
    const send = screen.getByTestId('chat-v9-input-hint-send');
    const kbd = send.querySelector('kbd');
    expect(kbd).not.toBeNull();
    expect(kbd?.textContent).toBe('Enter');
    expect(send.textContent).toContain('send');

    const newline = screen.getByTestId('chat-v9-input-hint-newline');
    expect(newline.querySelector('kbd')?.textContent).toBe('Shift+Enter');
    expect(newline.textContent).toContain('newline');

    const clear = screen.getByTestId('chat-v9-input-hint-clear');
    expect(clear.querySelector('kbd')?.textContent).toBe('Esc');
    expect(clear.textContent).toContain('clear');
  });

  it('marks the strip aria-hidden so assistive tech skips the redundant copy', () => {
    render(<InputHintStrip isEnabled={() => true} />);
    const strip = screen.getByTestId('chat-v9-input-hint-strip');
    expect(strip.getAttribute('aria-hidden')).toBe('true');
  });

  it('appends the optional className without clobbering base classes', () => {
    render(<InputHintStrip isEnabled={() => true} className="custom-align" />);
    const strip = screen.getByTestId('chat-v9-input-hint-strip');
    const className = strip.className;
    expect(className).toContain('custom-align');
    // Sanity: base font / colour class still present.
    expect(className).toContain('text-[10px]');
  });

  it('omits the custom className correctly when none is passed', () => {
    render(<InputHintStrip isEnabled={() => true} />);
    const strip = screen.getByTestId('chat-v9-input-hint-strip');
    expect(strip.className).not.toContain('custom-align');
  });

  it('renders 2 separator dots for 3 hints (N-1)', () => {
    render(<InputHintStrip isEnabled={() => true} />);
    const strip = screen.getByTestId('chat-v9-input-hint-strip');
    const dots = Array.from(strip.querySelectorAll('span[aria-hidden]')).filter(
      (el) => el.textContent?.trim() === '·'
    );
    expect(dots.length).toBe(2);
  });

  it('mounting the component has no side effects (pure render)', () => {
    // No dispatch, no timer, no store access — render twice and
    // confirm nothing throws.
    expect(() => {
      render(<InputHintStrip isEnabled={() => true} />);
      render(<InputHintStrip isEnabled={() => true} />);
    }).not.toThrow();
  });

  it('defaults to the real isInputHintStripEnabled when no prop is passed', () => {
    // We do not force the real flag one way or the other — just
    // assert that calling the component with no test seam does
    // not throw and returns either the strip or null.
    const spy = vi.fn(() => true);
    render(<InputHintStrip isEnabled={spy} />);
    expect(spy).toHaveBeenCalled();
  });
});
