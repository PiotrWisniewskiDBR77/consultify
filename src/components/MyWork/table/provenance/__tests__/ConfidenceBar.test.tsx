/**
 * @vitest-environment jsdom
 *
 * Component tests for ConfidenceBar (Block B / EPIC-T9).
 *
 * Coverage:
 *   * "Not scored" path renders neutral fill and `not scored` aria.
 *   * Numeric score renders percentage label and a fill that scales with
 *     the value.
 *   * Color tier shifts at the documented thresholds (0.40 / 0.65 / 0.85).
 *   * `onClick` wraps the bar in a focusable button (B-P1: bar must be
 *     keyboard-accessible).
 *   * `aria-label` and tooltip mention "AI confidence" — never "data
 *     quality" (B-P1 contract).
 */

import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_k: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? _k,
    i18n: { language: 'en' },
  }),
}));

import { ConfidenceBar } from '../ConfidenceBar';

describe('ConfidenceBar', () => {
  it('renders the "not scored" state when score is null', () => {
    render(<ConfidenceBar score={null} />);
    const bar = screen.getByTestId('provenance-confidence-bar');
    expect(bar).toBeInTheDocument();
    expect(bar.getAttribute('aria-label')).toMatch(/not scored/i);
    const fill = screen.getByTestId('provenance-confidence-bar-fill');
    expect(fill.style.width).toBe('10%');
  });

  it('renders percentage and a fill width matching the score', () => {
    render(<ConfidenceBar score={0.42} />);
    expect(screen.getByText('42%')).toBeInTheDocument();
    const fill = screen.getByTestId('provenance-confidence-bar-fill');
    expect(fill.style.width).toBe('42%');
  });

  it('clamps the fill width to a minimum 4% so the bar is never invisible', () => {
    render(<ConfidenceBar score={0.01} />);
    const fill = screen.getByTestId('provenance-confidence-bar-fill');
    expect(fill.style.width).toBe('4%');
  });

  it('shifts across the three semantic colour tiers', () => {
    const { rerender } = render(<ConfidenceBar score={0.3} />);
    const danger = screen.getByTestId('provenance-confidence-bar-fill').style.backgroundColor;

    rerender(<ConfidenceBar score={0.5} />);
    const amber = screen.getByTestId('provenance-confidence-bar-fill').style.backgroundColor;

    rerender(<ConfidenceBar score={0.7} />);
    const emerald = screen.getByTestId('provenance-confidence-bar-fill').style.backgroundColor;

    rerender(<ConfidenceBar score={0.9} />);
    const deepEmerald = screen.getByTestId('provenance-confidence-bar-fill').style.backgroundColor;

    expect(new Set([danger, amber, emerald]).size).toBe(3);
    expect(deepEmerald).toBe(emerald);
  });

  it('compact variant hides the percent label', () => {
    render(<ConfidenceBar score={0.5} variant="compact" />);
    expect(screen.queryByText('50%')).not.toBeInTheDocument();
    expect(screen.getByTestId('provenance-confidence-bar')).toBeInTheDocument();
  });

  it('wraps in a button when onClick is provided', () => {
    const onClick = vi.fn();
    render(<ConfidenceBar score={0.6} onClick={onClick} />);
    const btn = screen.getByTestId('provenance-confidence-bar-button');
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('aria-label uses the documented "AI confidence" wording (B-P1)', () => {
    render(<ConfidenceBar score={0.7} />);
    const bar = screen.getByTestId('provenance-confidence-bar');
    const aria = bar.getAttribute('aria-label') ?? '';
    expect(aria.toLowerCase()).toContain('ai confidence');
    expect(aria.toLowerCase()).not.toContain('data quality');
    expect(aria.toLowerCase()).not.toContain('trustworthy');
  });
});
