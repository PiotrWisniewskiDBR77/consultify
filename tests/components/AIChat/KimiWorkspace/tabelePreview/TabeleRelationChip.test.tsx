/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import TabeleRelationChip from '../../../../../src/components/AIChat/KimiWorkspace/tabelePreview/TabeleRelationChip';

const relation = {
  fieldId: 'field-contract',
  fieldName: 'contract',
  targetTableId: 'contracts',
  targetTableName: 'Contracts',
  targetCount: 4,
};

describe('TabeleRelationChip', () => {
  it('renders as a keyboard-focusable button and opens tooltip on focus', () => {
    render(<TabeleRelationChip relation={relation} rationale="Matched by contract identifier." />);

    const chip = screen.getByRole('button', { name: /contract/i });
    expect(chip).toBeInTheDocument();

    fireEvent.focus(chip);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Matched by contract identifier.');
  });

  it('requests rationale on first focus when rationale is missing', () => {
    const onLoadRationale = vi.fn();
    render(<TabeleRelationChip relation={relation} onLoadRationale={onLoadRationale} />);

    const chip = screen.getByRole('button', { name: /contract/i });
    fireEvent.focus(chip);
    fireEvent.mouseEnter(chip);

    expect(onLoadRationale).toHaveBeenCalledTimes(1);
    expect(onLoadRationale).toHaveBeenCalledWith(relation);
  });

  it('shows a loading tooltip state', () => {
    render(<TabeleRelationChip relation={relation} loading />);

    fireEvent.focus(screen.getByRole('button', { name: /contract/i }));
    expect(screen.getByRole('tooltip')).toHaveTextContent(/Loading relation rationale/i);
  });
});
