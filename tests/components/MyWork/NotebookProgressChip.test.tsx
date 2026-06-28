import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { NotebookProgressChip } from '@/components/MyWork/notebook/NotebookProgressChip';

const baseProps = {
  isPolish: false,
  hasPendingAIProposals: false,
  canConvertDeliverable: false,
  convertBlockedReason: 'Note not ready',
  onOpenAttachments: vi.fn(),
  onCreateAIProposal: vi.fn(),
  onReviewAIProposal: vi.fn(),
  onConvert: vi.fn(),
};

describe('NotebookProgressChip', () => {
  it('renders the four workflow steps', () => {
    render(<NotebookProgressChip {...baseProps} />);
    expect(screen.getByText('Sources')).toBeInTheDocument();
    expect(screen.getByText('AI')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
    expect(screen.getByText('Convert')).toBeInTheDocument();
  });

  it('fires the sources and AI-proposal callbacks', () => {
    const onOpenAttachments = vi.fn();
    const onCreateAIProposal = vi.fn();
    render(
      <NotebookProgressChip
        {...baseProps}
        onOpenAttachments={onOpenAttachments}
        onCreateAIProposal={onCreateAIProposal}
      />
    );
    fireEvent.click(screen.getByText('Sources'));
    fireEvent.click(screen.getByText('AI'));
    expect(onOpenAttachments).toHaveBeenCalled();
    expect(onCreateAIProposal).toHaveBeenCalled();
  });

  it('disables Review until there are pending proposals', () => {
    const { rerender } = render(<NotebookProgressChip {...baseProps} hasPendingAIProposals={false} />);
    expect(screen.getByText('Review').closest('button')).toBeDisabled();
    rerender(<NotebookProgressChip {...baseProps} hasPendingAIProposals />);
    expect(screen.getByText('Review').closest('button')).not.toBeDisabled();
  });

  it('disables Convert when the deliverable cannot be converted', () => {
    render(<NotebookProgressChip {...baseProps} canConvertDeliverable={false} />);
    expect(screen.getByText('Convert').closest('button')).toBeDisabled();
  });

  it('renders optional handoff buttons only when callbacks are supplied', () => {
    const { rerender } = render(<NotebookProgressChip {...baseProps} />);
    expect(screen.queryByText('Radar')).not.toBeInTheDocument();
    rerender(
      <NotebookProgressChip
        {...baseProps}
        onHandoffRadar={vi.fn()}
        onHandoffInitiatives={vi.fn()}
      />
    );
    expect(screen.getByText('Radar')).toBeInTheDocument();
    expect(screen.getByText('Initiatives')).toBeInTheDocument();
  });

  it('renders Polish labels when isPolish', () => {
    render(<NotebookProgressChip {...baseProps} isPolish />);
    expect(screen.getByText('Źródła')).toBeInTheDocument();
    expect(screen.getByText('Konwertuj')).toBeInTheDocument();
  });
});
