/**
 * @vitest-environment jsdom
 *
 * Component tests for AiClassificationCell (Block A · EPIC-T7 · Sprint A-S5).
 */

import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { AiClassificationCell } from '../AiClassificationCell';

describe('AiClassificationCell', () => {
  const classes = ['quick_win', 'strategic', 'low_priority'];

  it('renders "AI pending…" when value is null', () => {
    render(
      <AiClassificationCell value={null} fieldOptions={{ classes, prompt_template: 'Classify' }} />
    );
    expect(screen.getByTestId('ai-classification-pending')).toHaveTextContent(/AI pending/i);
  });

  it('renders a chip with the class label when value is a configured class', () => {
    render(
      <AiClassificationCell
        value="quick_win"
        fieldOptions={{ classes, prompt_template: 'Classify' }}
      />
    );
    const chip = screen.getByTestId('ai-classification-chip');
    expect(chip).toHaveTextContent('quick_win');
    expect(chip).toHaveAttribute('data-class', 'quick_win');
  });

  it('marks values not in `classes` as invalid', () => {
    render(
      <AiClassificationCell
        value="unknown_class"
        fieldOptions={{ classes, prompt_template: 'Classify' }}
      />
    );
    expect(screen.getByTestId('ai-classification-invalid')).toBeInTheDocument();
    expect(screen.queryByTestId('ai-classification-chip')).not.toBeInTheDocument();
  });

  it('uses deterministic tone — same class always renders the same tone', () => {
    const { container: c1 } = render(
      <AiClassificationCell value="quick_win" fieldOptions={{ classes, prompt_template: '' }} />
    );
    const { container: c2 } = render(
      <AiClassificationCell value="quick_win" fieldOptions={{ classes, prompt_template: '' }} />
    );
    expect(c1.innerHTML).toBe(c2.innerHTML);
  });

  it('different classes use different tone classes', () => {
    const { container: cA } = render(
      <AiClassificationCell value="quick_win" fieldOptions={{ classes, prompt_template: '' }} />
    );
    const { container: cB } = render(
      <AiClassificationCell value="strategic" fieldOptions={{ classes, prompt_template: '' }} />
    );
    expect(cA.innerHTML).not.toBe(cB.innerHTML);
  });

  it('marks manual-override values with audit flag', () => {
    render(
      <AiClassificationCell
        value="quick_win"
        manualOverride={true}
        fieldOptions={{ classes, prompt_template: '' }}
      />
    );
    const chip = screen.getByTestId('ai-classification-chip');
    expect(chip).toHaveAttribute('data-manual-override', 'true');
    expect(chip.getAttribute('title')).toMatch(/manual_override/);
  });

  it('handles empty classes array gracefully — value renders as invalid', () => {
    render(
      <AiClassificationCell value="anything" fieldOptions={{ classes: [], prompt_template: '' }} />
    );
    expect(screen.getByTestId('ai-classification-invalid')).toBeInTheDocument();
  });

  it('does NOT use raw hex literals', () => {
    const { container } = render(
      <AiClassificationCell value="quick_win" fieldOptions={{ classes, prompt_template: '' }} />
    );
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{6}/);
  });
});
