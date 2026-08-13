/**
 * @vitest-environment jsdom
 *
 * E14-A11Y-02 (P1) — AIProposalDiffModal is an always-modal overlay
 * (mounted only while `proposal` review is in progress — see
 * IdeaRecommendationMap.tsx) that had ZERO dialog semantics. Fixed via the
 * shared `useDialogA11y` hook (open: true, onClose: onReject).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { AIProposalDiffModal } from '../AIProposalDiffModal';

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    get() {
      return document.body;
    },
    configurable: true,
  });
});

const PROPOSAL = {
  add: {
    nodes: [{ id: 'n1', data: { label: 'New idea' } } as any],
    edges: [],
  },
  remove: { nodeIds: [], edgeIds: [] },
  rationale: 'Because reasons',
};

function Trigger({
  children,
}: {
  children: (open: boolean, close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Open trigger
      </button>
      {children(open, () => setOpen(false))}
    </div>
  );
}

describe('AIProposalDiffModal — a11y dialog contract', () => {
  it('exposes role=dialog with an accessible name', () => {
    render(
      <AIProposalDiffModal
        proposal={PROPOSAL}
        isPl={false}
        existingNodes={[]}
        onApply={vi.fn()}
        onReject={vi.fn()}
      />
    );
    expect(
      screen.getByRole('dialog', { name: /AI Proposal — Change Preview/i })
    ).toBeInTheDocument();
  });

  it('Escape calls onReject', () => {
    const onReject = vi.fn();
    render(
      <AIProposalDiffModal
        proposal={PROPOSAL}
        isPl={false}
        existingNodes={[]}
        onApply={vi.fn()}
        onReject={onReject}
      />
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onReject).toHaveBeenCalledTimes(1);
  });

  it('returns focus to the trigger after Escape', async () => {
    render(
      <Trigger>
        {(open, close) =>
          open && (
            <AIProposalDiffModal
              proposal={PROPOSAL}
              isPl={false}
              existingNodes={[]}
              onApply={vi.fn()}
              onReject={close}
            />
          )
        }
      </Trigger>
    );
    const trigger = screen.getByRole('button', { name: 'Open trigger' });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
