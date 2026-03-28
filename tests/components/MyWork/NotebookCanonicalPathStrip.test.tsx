import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { NotebookCanonicalPathStrip } from '../../../src/components/MyWork/notebook/NotebookCanonicalPathStrip';

describe('NotebookCanonicalPathStrip', () => {
  it('shows the preferred notebook path and disables conversion until the note is ready', () => {
    const onOpenAttachments = vi.fn();
    const onCreateAIProposal = vi.fn();
    const onReviewAIProposal = vi.fn();
    const onConvert = vi.fn();

    render(
      <NotebookCanonicalPathStrip
        isPolish={false}
        hasPendingAIProposals={false}
        canConvertDeliverable={false}
        convertBlockedReason="Refine the note first."
        onOpenAttachments={onOpenAttachments}
        onCreateAIProposal={onCreateAIProposal}
        onReviewAIProposal={onReviewAIProposal}
        onConvert={onConvert}
      />
    );

    expect(screen.getByText('Canonical notebook path')).toBeInTheDocument();
    expect(screen.getByText('1. Add sources')).toBeInTheDocument();
    expect(screen.getByText('2. Draft AI proposal')).toBeInTheDocument();
    expect(screen.getByText('3. Review proposal')).toBeInTheDocument();
    expect(screen.getByText('4. Convert')).toBeInTheDocument();
    expect(screen.getByText('Refine content first')).toBeInTheDocument();
    expect(screen.getByText('Refine the note first.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Attachments/i }));
    expect(onOpenAttachments).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /AI proposal/i }));
    expect(onCreateAIProposal).toHaveBeenCalledTimes(1);

    expect(screen.getByRole('button', { name: /Review/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /To report/i })).toBeDisabled();
  });
});
