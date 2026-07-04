/**
 * Smoke tests for AssessmentItemPreview — the Licensed/Assessment preview editor.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { type AssessmentItem, AssessmentItemPreview } from '../AssessmentItemPreview';

function makeItem(overrides: Partial<AssessmentItem> = {}): AssessmentItem {
  return {
    id: 'a-1',
    name: 'Data governance maturity',
    framework: 'DRD',
    area: 'Process',
    currentScore: 2,
    targetScore: 9,
    evidenceCount: 3,
    recommendationsCount: 1,
    ...overrides,
  };
}

describe('AssessmentItemPreview', () => {
  it('renders the item title and computed gap', () => {
    render(<AssessmentItemPreview item={makeItem()} onOpen={() => {}} />);

    expect(screen.getByText('Data governance maturity')).toBeInTheDocument();
    // gap = target(9) - current(2) = 7
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('fires onOpen when the detail button is clicked', () => {
    const onOpen = vi.fn();
    render(<AssessmentItemPreview item={makeItem()} onOpen={onOpen} />);

    // "Open detail" appears in both the header action and the footer button.
    fireEvent.click(screen.getAllByText('Open detail')[0]);
    expect(onOpen).toHaveBeenCalled();
  });

  it('shows the Add evidence action only when the handler is provided', () => {
    const { rerender } = render(<AssessmentItemPreview item={makeItem()} onOpen={() => {}} />);
    expect(screen.queryByText('Add evidence')).not.toBeInTheDocument();

    rerender(
      <AssessmentItemPreview item={makeItem()} onOpen={() => {}} onAddEvidence={() => {}} />
    );
    expect(screen.getByText('Add evidence')).toBeInTheDocument();
  });
});
