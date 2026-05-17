/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import TabeleRationaleSection from '../../../../../src/components/AIChat/KimiWorkspace/tabelePreview/TabeleRationaleSection';

describe('TabeleRationaleSection', () => {
  it('renders summary, cited sources, and proposal status', () => {
    render(
      <TabeleRationaleSection
        rationale={{
          summary: 'AI selected a vendor register because records repeat vendor ownership.',
          bullets: ['Vendor owner is explicit'],
          citedSourceIds: ['record-1'],
          proposalStatus: 'approved',
        }}
        isPolish={false}
      />
    );

    expect(screen.getByText(/AI selected a vendor register/i)).toBeInTheDocument();
    expect(screen.getByText('record-1')).toBeInTheDocument();
    expect(screen.getByText(/Proposal status:.*Approved/i)).toBeInTheDocument();
  });

  it('limits long bullet lists and exposes show more disclosure', () => {
    render(
      <TabeleRationaleSection
        rationale={{
          summary: 'Long rationale.',
          bullets: ['one', 'two', 'three', 'four', 'five', 'six', 'seven'],
          citedSourceIds: [],
          proposalStatus: 'pending',
        }}
        isPolish={false}
      />
    );

    expect(screen.queryByText('seven')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Show .* more/i }));
    expect(screen.getByText('seven')).toBeInTheDocument();
  });

  it('renders proposal queue affordance only when a callback is provided', () => {
    const onOpenProposalQueue = vi.fn();
    render(
      <TabeleRationaleSection
        rationale={{
          summary: 'Proposal rationale.',
          bullets: [],
          citedSourceIds: [],
          proposalStatus: 'pending',
        }}
        isPolish={false}
        onOpenProposalQueue={onOpenProposalQueue}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Review proposals/i }));
    expect(onOpenProposalQueue).toHaveBeenCalledTimes(1);
  });
});
