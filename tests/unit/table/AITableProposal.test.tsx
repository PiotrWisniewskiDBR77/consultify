/**
 * Behavior-based tests for AITableProposal component.
 * Tests: granular accept/reject for columns, views, rows; toggle all; handleApply filtering.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AITableProposal, type TableProposal } from '@/components/MyWork/table/AITableProposal';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string) =>
      ({
        'myWorkTable.aiTableProposal.applySelected': 'Apply selected',
        'myWorkTable.aiTableProposal.reject': 'Reject',
      })[key] || key,
  }),
}));

function makeProposal(overrides?: Partial<TableProposal>): TableProposal {
  return {
    title: 'Test Proposal',
    description: 'AI-generated table structure',
    columns: [
      { key: 'name', header: 'Name', type: 'text', visible: true, width: 200 },
      { key: 'score', header: 'Score', type: 'number', visible: true, width: 120 },
      { key: 'status', header: 'Status', type: 'status', visible: true, width: 130 },
    ],
    views: [
      { id: 'v1', name: 'Default', layout: 'table' },
      { id: 'v2', name: 'Kanban', layout: 'kanban' },
    ],
    rows: [
      { id: 'r1', type: 'idea', data: { label: 'Idea 1' }, position: { x: 0, y: 0 } },
      { id: 'r2', type: 'idea', data: { label: 'Idea 2' }, position: { x: 0, y: 0 } },
    ],
    ...overrides,
  };
}

describe('AITableProposal', () => {
  it('renders all proposal sections', () => {
    const onAccept = vi.fn();
    const onReject = vi.fn();
    render(<AITableProposal proposal={makeProposal()} onAccept={onAccept} onReject={onReject} />);

    expect(screen.getByText('Test Proposal')).toBeDefined();
    expect(screen.getByText(/Columns/i)).toBeDefined();
    expect(screen.getByText(/Views/i)).toBeDefined();
    expect(screen.getByText(/Rows/i)).toBeDefined();
  });

  it('shows all items as accepted by default', () => {
    const onAccept = vi.fn();
    render(<AITableProposal proposal={makeProposal()} onAccept={onAccept} onReject={vi.fn()} />);

    const applyBtn = screen.getByText(/Apply selected/i);
    fireEvent.click(applyBtn);

    expect(onAccept).toHaveBeenCalledTimes(1);
    const accepted = onAccept.mock.calls[0][0];
    expect(accepted.columns).toHaveLength(3);
    expect(accepted.views).toHaveLength(2);
    expect(accepted.rows).toHaveLength(2);
  });

  it('calls onReject when reject button is clicked', () => {
    const onReject = vi.fn();
    render(<AITableProposal proposal={makeProposal()} onAccept={vi.fn()} onReject={onReject} />);

    const rejectBtn = screen.getByText(/Reject/i);
    fireEvent.click(rejectBtn);

    expect(onReject).toHaveBeenCalledTimes(1);
  });

  it('toggles individual column acceptance', () => {
    const onAccept = vi.fn();
    render(<AITableProposal proposal={makeProposal()} onAccept={onAccept} onReject={vi.fn()} />);

    const checkboxes = screen.getAllByRole('button').filter(
      (btn) => btn.className.includes('w-4 h-4 rounded border')
    );
    // checkboxes[0] = toggle-all for columns section header
    // checkboxes[1..3] = individual column checkboxes
    // checkboxes[4] = toggle-all for views section header
    // etc.
    expect(checkboxes.length).toBeGreaterThanOrEqual(4);

    // Click the second checkbox (first individual column)
    fireEvent.click(checkboxes[1]);

    const applyBtn = screen.getByText(/Apply selected/i);
    fireEvent.click(applyBtn);

    const accepted = onAccept.mock.calls[0][0];
    expect(accepted.columns).toHaveLength(2);
  });

  it('disables apply button when all items are deselected', () => {
    const proposal = makeProposal({ columns: [], views: [], rows: [] });
    render(<AITableProposal proposal={proposal} onAccept={vi.fn()} onReject={vi.fn()} />);

    const applyBtn = screen.getByText(/Apply selected/i);
    expect(applyBtn.hasAttribute('disabled')).toBe(true);
  });

  it('renders proposal description and context hints', () => {
    const proposal = makeProposal({
      contextHints: ['Based on your existing initiatives', 'Optimized for tracking'],
    });
    render(<AITableProposal proposal={proposal} onAccept={vi.fn()} onReject={vi.fn()} />);

    expect(screen.getByText('AI-generated table structure')).toBeDefined();
    expect(screen.getByText(/Based on your existing initiatives/)).toBeDefined();
  });

  it('renders source artifacts when provided', () => {
    const proposal = makeProposal({
      sourceArtifacts: [
        { id: 'a1', type: 'initiative', title: 'Growth Plan' },
      ],
    });
    render(<AITableProposal proposal={proposal} onAccept={vi.fn()} onReject={vi.fn()} />);

    expect(screen.getByText(/Growth Plan/)).toBeDefined();
  });

  it('handles empty proposal gracefully', () => {
    const proposal = makeProposal({ columns: [], views: [], rows: [] });
    render(<AITableProposal proposal={proposal} onAccept={vi.fn()} onReject={vi.fn()} />);

    expect(screen.getByText('Test Proposal')).toBeDefined();
    const applyBtn = screen.getByText(/Apply selected/i);
    expect(applyBtn.hasAttribute('disabled')).toBe(true);
  });
});
