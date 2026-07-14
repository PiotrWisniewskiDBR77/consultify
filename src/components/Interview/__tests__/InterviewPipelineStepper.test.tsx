/**
 * @vitest-environment jsdom
 *
 * M10 D-03 — InterviewPipelineStepper presentational contract:
 *  - renders one pill per stage with its numeral + clean label,
 *  - marks the active stage (aria-current="step"),
 *  - marks stages before the active one complete (check icon, numeral hidden),
 *  - shows a count badge only when count > 0,
 *  - calls onStepChange(id) on click,
 *  - renders nothing for an empty step list.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { type InterviewPipelineStep, InterviewPipelineStepper } from '../InterviewPipelineStepper';

const STEPS: InterviewPipelineStep[] = [
  { id: 'templates' as any, numeral: '①', label: 'Szablony', count: 0 },
  { id: 'managed' as any, numeral: '②', label: 'Przydzielone', count: 4 },
  { id: 'my_assignments' as any, numeral: '③', label: 'Inbox', count: 2 },
  { id: 'insights' as any, numeral: '⑤', label: 'Wnioski' },
];

function renderStepper(activeTab = 'my_assignments', onStepChange = vi.fn()) {
  render(
    <InterviewPipelineStepper
      steps={STEPS}
      activeTab={activeTab as any}
      onStepChange={onStepChange}
    />
  );
  return onStepChange;
}

describe('InterviewPipelineStepper (D-03)', () => {
  it('renders one labelled pill per stage', () => {
    renderStepper();
    expect(screen.getByText('Szablony')).toBeInTheDocument();
    expect(screen.getByText('Przydzielone')).toBeInTheDocument();
    expect(screen.getByText('Inbox')).toBeInTheDocument();
    expect(screen.getByText('Wnioski')).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(4);
  });

  it('marks the active stage with aria-current="step"', () => {
    renderStepper('my_assignments');
    const active = screen.getByText('Inbox').closest('button')!;
    expect(active).toHaveAttribute('aria-current', 'step');
    const other = screen.getByText('Wnioski').closest('button')!;
    expect(other).not.toHaveAttribute('aria-current');
  });

  it('shows count badge only when count > 0', () => {
    renderStepper('templates');
    // managed=4, my_assignments=2 → badges; templates=0 and insights(undefined) → none
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    // numeral ① still rendered for the (active) templates stage; no "0" badge
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('hides the numeral and shows a check for completed stages', () => {
    // active = insights (last) → templates/managed/my_assignments are complete
    renderStepper('insights');
    // completed stages no longer show their numeral glyph
    expect(screen.queryByText('①')).not.toBeInTheDocument();
    expect(screen.queryByText('②')).not.toBeInTheDocument();
    // active stage shows its numeral
    expect(screen.getByText('⑤')).toBeInTheDocument();
  });

  it('calls onStepChange with the stage id on click', () => {
    const onStepChange = renderStepper('templates');
    fireEvent.click(screen.getByText('Wnioski').closest('button')!);
    expect(onStepChange).toHaveBeenCalledWith('insights');
  });

  it('renders nothing for an empty step list', () => {
    const { container } = render(
      <InterviewPipelineStepper
        steps={[]}
        activeTab={'my_assignments' as any}
        onStepChange={vi.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
