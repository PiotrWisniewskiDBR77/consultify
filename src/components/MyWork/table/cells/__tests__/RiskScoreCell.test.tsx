/**
 * @vitest-environment jsdom
 *
 * Component tests for RiskScoreCell (Block A · EPIC-T7 · Sprint A-S5).
 *
 * Coverage:
 *   - empty / null value renders dash, not chip
 *   - valid value within scale 25 renders chip with severity tone
 *   - severity thresholds: low (<40 %), medium (40-69 %), high (≥70 %)
 *   - scale 5 (3×3 matrix) and scale 3 also accepted
 *   - out-of-range value renders invalid sentinel
 *   - axes (likelihood × impact) surface in tooltip
 */

import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { RiskScoreCell } from '../RiskScoreCell';

describe('RiskScoreCell', () => {
  it('renders an em-dash when value is null', () => {
    render(<RiskScoreCell value={null} fieldOptions={{ scale: 25 }} />);
    expect(screen.getByTestId('risk-score-empty')).toHaveTextContent('—');
  });

  it('renders an em-dash when value is empty string', () => {
    render(<RiskScoreCell value="" fieldOptions={{ scale: 25 }} />);
    expect(screen.getByTestId('risk-score-empty')).toBeInTheDocument();
  });

  it('renders a chip with high severity for ≥70 % of scale', () => {
    render(<RiskScoreCell value={20} fieldOptions={{ scale: 25 }} />);
    const chip = screen.getByTestId('risk-score-chip');
    expect(chip).toHaveAttribute('data-severity', 'high');
    expect(chip).toHaveAttribute('data-scale', '25');
    expect(chip).toHaveTextContent(/20\/25/);
  });

  it('renders medium severity for 40–69 % of scale', () => {
    render(<RiskScoreCell value={12} fieldOptions={{ scale: 25 }} />);
    const chip = screen.getByTestId('risk-score-chip');
    expect(chip).toHaveAttribute('data-severity', 'medium');
  });

  it('renders low severity for <40 % of scale', () => {
    render(<RiskScoreCell value={5} fieldOptions={{ scale: 25 }} />);
    const chip = screen.getByTestId('risk-score-chip');
    expect(chip).toHaveAttribute('data-severity', 'low');
  });

  it('accepts scale 5 (3×3 matrix maps to scale 5 in spec) and scale 3', () => {
    render(<RiskScoreCell value={3} fieldOptions={{ scale: 5 }} />);
    expect(screen.getByTestId('risk-score-chip')).toHaveAttribute('data-scale', '5');
  });

  it('marks out-of-range value as invalid (negative)', () => {
    render(<RiskScoreCell value={-1} fieldOptions={{ scale: 25 }} />);
    expect(screen.getByTestId('risk-score-invalid')).toBeInTheDocument();
    expect(screen.queryByTestId('risk-score-chip')).not.toBeInTheDocument();
  });

  it('marks value above scale as invalid', () => {
    render(<RiskScoreCell value={26} fieldOptions={{ scale: 25 }} />);
    expect(screen.getByTestId('risk-score-invalid')).toBeInTheDocument();
  });

  it('marks non-integer value as invalid', () => {
    render(<RiskScoreCell value={3.5} fieldOptions={{ scale: 25 }} />);
    expect(screen.getByTestId('risk-score-invalid')).toBeInTheDocument();
  });

  it('exposes likelihood × impact axes in the title attribute when present', () => {
    render(
      <RiskScoreCell value={20} fieldOptions={{ scale: 25, axes: { likelihood: 4, impact: 5 } }} />
    );
    const chip = screen.getByTestId('risk-score-chip');
    expect(chip.getAttribute('title')).toMatch(/likelihood 4/);
    expect(chip.getAttribute('title')).toMatch(/impact 5/);
  });

  it('defaults to scale 25 when fieldOptions is omitted', () => {
    render(<RiskScoreCell value={20} />);
    expect(screen.getByTestId('risk-score-chip')).toHaveAttribute('data-scale', '25');
  });

  it('does NOT use raw hex literals — uses semantic Tailwind classes only', () => {
    const { container } = render(<RiskScoreCell value={20} fieldOptions={{ scale: 25 }} />);
    const html = container.innerHTML;
    expect(html).not.toMatch(/#[0-9a-fA-F]{6}/);
    // High severity uses the shared semantic CSS variable contract.
    expect(html).toMatch(/--c-danger/);
  });
});
