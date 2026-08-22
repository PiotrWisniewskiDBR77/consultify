/**
 * @vitest-environment jsdom
 *
 * Component tests for PriorityCell (Block A · EPIC-T7 · Sprint A-S5).
 */

import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { PriorityCell } from '../PriorityCell';

describe('PriorityCell', () => {
  it('renders an em-dash when value is null', () => {
    render(<PriorityCell value={null} fieldOptions={{ levels: 'P0_P1_P2_P3' }} />);
    expect(screen.getByTestId('priority-empty')).toHaveTextContent('—');
  });

  it('renders a chip with the priority value uppercased', () => {
    render(<PriorityCell value="P0" fieldOptions={{ levels: 'P0_P1_P2_P3' }} />);
    const chip = screen.getByTestId('priority-chip');
    expect(chip).toHaveTextContent('P0');
    expect(chip).toHaveAttribute('data-level', 'P0');
    expect(chip).toHaveAttribute('data-preset', 'P0_P1_P2_P3');
  });

  it('accepts CRITICAL_HIGH_MEDIUM_LOW preset', () => {
    render(<PriorityCell value="critical" fieldOptions={{ levels: 'CRITICAL_HIGH_MEDIUM_LOW' }} />);
    const chip = screen.getByTestId('priority-chip');
    expect(chip).toHaveAttribute('data-preset', 'CRITICAL_HIGH_MEDIUM_LOW');
    expect(chip).toHaveAttribute('data-level', 'critical');
  });

  it('marks value not in preset as invalid', () => {
    render(<PriorityCell value="P9" fieldOptions={{ levels: 'P0_P1_P2_P3' }} />);
    expect(screen.getByTestId('priority-invalid')).toBeInTheDocument();
    expect(screen.queryByTestId('priority-chip')).not.toBeInTheDocument();
  });

  it('mismatched preset (e.g. critical with P0..P3 preset) renders invalid', () => {
    render(<PriorityCell value="critical" fieldOptions={{ levels: 'P0_P1_P2_P3' }} />);
    expect(screen.getByTestId('priority-invalid')).toBeInTheDocument();
  });

  it('defaults to P0_P1_P2_P3 preset when fieldOptions is omitted', () => {
    render(<PriorityCell value="P1" />);
    expect(screen.getByTestId('priority-chip')).toHaveAttribute('data-preset', 'P0_P1_P2_P3');
  });

  it('renders different DOM tone classes for first vs last preset entry', () => {
    const { container: cFirst } = render(
      <PriorityCell value="P0" fieldOptions={{ levels: 'P0_P1_P2_P3' }} />
    );
    const { container: cLast } = render(
      <PriorityCell value="P3" fieldOptions={{ levels: 'P0_P1_P2_P3' }} />
    );
    // Highest priority uses the semantic danger token; lowest uses the neutral
    // surface/text tokens. Do not couple this contract to a palette name.
    expect(cFirst.innerHTML).toMatch(/--c-danger/);
    expect(cLast.innerHTML).toMatch(/--c-text-muted/);
    expect(cLast.innerHTML).toMatch(/--c-surface-raised/);
  });

  it('does NOT use raw hex literals', () => {
    const { container } = render(
      <PriorityCell value="P0" fieldOptions={{ levels: 'P0_P1_P2_P3' }} />
    );
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{6}/);
  });
});
