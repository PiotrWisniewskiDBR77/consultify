/**
 * Chat V9 / INPUT C-IN2 — tests for the input character counter pill.
 *
 * Coverage:
 *   - Hidden when the feature flag is disabled.
 *   - Hidden when `value.length < threshold` (default 400).
 *   - Tone escalates at 0 / 80% / 100% of the configured `max`.
 *   - Custom `threshold` and `max` props override defaults.
 *   - Non-string `value` input is handled gracefully.
 *   - Accessibility: `role="status"`, `aria-live="polite"`,
 *     aria-label updates with the count and tone.
 *   - Read-only contract: renders as a `span` (not a button).
 */

import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { InputCharCounter } from '../InputCharCounter';

const longString = (n: number) => 'x'.repeat(n);

describe('InputCharCounter', () => {
  // -------------------------------------------------------------------
  // Flag / threshold gates.
  // -------------------------------------------------------------------
  it('renders nothing when the flag is disabled, even for long messages', () => {
    const { container } = render(
      <InputCharCounter value={longString(5000)} isEnabled={() => false} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when value.length is below the default threshold', () => {
    const { container } = render(
      <InputCharCounter value={longString(399)} isEnabled={() => true} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders once value.length equals the default threshold', () => {
    render(<InputCharCounter value={longString(400)} isEnabled={() => true} />);
    const pill = screen.getByTestId('input-char-counter');
    expect(pill.textContent).toContain('400');
    expect(pill.textContent).toContain('8,000');
  });

  it('honours a custom threshold', () => {
    const { container, rerender } = render(
      <InputCharCounter value={longString(100)} threshold={50} isEnabled={() => true} />
    );
    expect(screen.getByTestId('input-char-counter')).toBeInTheDocument();

    rerender(
      <InputCharCounter value={longString(25)} threshold={50} isEnabled={() => true} />
    );
    expect(container.firstChild).toBeNull();
  });

  // -------------------------------------------------------------------
  // Tone escalation — slate → amber (>=80% of max) → rose (>=max).
  // -------------------------------------------------------------------
  it('uses the slate tone well below the soft max', () => {
    render(<InputCharCounter value={longString(500)} isEnabled={() => true} />);
    expect(screen.getByTestId('input-char-counter').getAttribute('data-tone')).toBe('slate');
  });

  it('escalates to amber at 80% of the soft max', () => {
    render(<InputCharCounter value={longString(6400)} isEnabled={() => true} />);
    expect(screen.getByTestId('input-char-counter').getAttribute('data-tone')).toBe('amber');
  });

  it('escalates to rose at the soft max', () => {
    render(<InputCharCounter value={longString(8000)} isEnabled={() => true} />);
    expect(screen.getByTestId('input-char-counter').getAttribute('data-tone')).toBe('rose');
  });

  it('honours a custom max for tone escalation', () => {
    render(
      <InputCharCounter
        value={longString(800)}
        threshold={400}
        max={1000}
        isEnabled={() => true}
      />
    );
    expect(screen.getByTestId('input-char-counter').getAttribute('data-tone')).toBe('amber');
  });

  // -------------------------------------------------------------------
  // Robustness against odd input types.
  // -------------------------------------------------------------------
  it('treats a non-string value as length zero and stays hidden', () => {
    const { container } = render(
      // @ts-expect-error — deliberately passing the wrong type to test defensive code.
      <InputCharCounter value={undefined} isEnabled={() => true} />
    );
    expect(container.firstChild).toBeNull();
  });

  // -------------------------------------------------------------------
  // Accessibility / surface contract.
  // -------------------------------------------------------------------
  it('exposes role=status with a polite aria-live region', () => {
    render(<InputCharCounter value={longString(500)} isEnabled={() => true} />);
    const pill = screen.getByTestId('input-char-counter');
    expect(pill.getAttribute('role')).toBe('status');
    expect(pill.getAttribute('aria-live')).toBe('polite');
    expect(pill.tagName.toLowerCase()).toBe('span');
  });

  it('aria-label mentions the exact character count and max', () => {
    render(<InputCharCounter value={longString(500)} isEnabled={() => true} />);
    const label = screen.getByTestId('input-char-counter').getAttribute('aria-label') ?? '';
    expect(label).toMatch(/\b500\b/);
    expect(label).toMatch(/\b8000\b/);
  });

  it('aria-label switches phrasing when over the soft max', () => {
    render(<InputCharCounter value={longString(9000)} isEnabled={() => true} />);
    const label = screen.getByTestId('input-char-counter').getAttribute('aria-label') ?? '';
    expect(label).toMatch(/over the /);
    expect(label).toMatch(/\b9000\b/);
  });
});
