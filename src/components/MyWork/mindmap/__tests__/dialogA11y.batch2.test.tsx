/**
 * @vitest-environment jsdom
 *
 * A11Y-BACKLOG batch 2 — mindmap "AI tool" centered modals (no backdrop
 * click-to-close; explicit X button only) converted onto the shared
 * `useDialogA11y` contract: named `role="dialog"`, `aria-modal`,
 * Escape-to-close, focus enters on open, focus restored to the trigger on
 * close.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeAll, describe, expect, it } from 'vitest';

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    get() {
      return document.body;
    },
    configurable: true,
  });
});

import { AIAutoClustering } from '../AIAutoClustering';
import { AICompetitiveLandscape } from '../AICompetitiveLandscape';
import { AIDependencyDetector } from '../AIDependencyDetector';
import { AIPriorityRecommender } from '../AIPriorityRecommender';
import { AIProposalDiffModal } from '../AIProposalDiffModal';
import { AISentimentOverlay } from '../AISentimentOverlay';
import { AIWhatIfScenarios } from '../AIWhatIfScenarios';

function Harness({
  children,
}: {
  children: (open: boolean, onClose: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <div>
      <button data-testid="trigger" onClick={() => setOpen(true)}>
        Open
      </button>
      {children(open, () => setOpen(false))}
    </div>
  );
}

async function openAndAssertDialog(name: RegExp) {
  const trigger = screen.getByTestId('trigger');
  trigger.focus();
  fireEvent.click(trigger);
  const dialog = await screen.findByRole('dialog');
  expect(dialog).toHaveAttribute('aria-modal', 'true');
  expect(dialog).toHaveAccessibleName(name);
  return { trigger, dialog };
}

async function assertEscapeClosesAndRestoresFocus(trigger: HTMLElement) {
  fireEvent.keyDown(document, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await waitFor(() => expect(document.activeElement).toBe(trigger));
}

describe('AISentimentOverlay — dialog a11y contract', () => {
  const renderIt = () =>
    render(
      <Harness>
        {(open, onClose) => (
          <AISentimentOverlay
            open={open}
            onClose={onClose}
            ideaId="idea-1"
            ideaTitle="Idea"
            nodes={[]}
            locked={false}
            onApplySentiment={() => {}}
          />
        )}
      </Harness>
    );

  it('has role=dialog, aria-modal, and an accessible name; Escape closes and restores focus', async () => {
    renderIt();
    const { trigger } = await openAndAssertDialog(/AI: Sentiment Analysis/i);
    await assertEscapeClosesAndRestoresFocus(trigger);
  });
});

describe('AIPriorityRecommender — dialog a11y contract', () => {
  const renderIt = () =>
    render(
      <Harness>
        {(open, onClose) => (
          <AIPriorityRecommender
            open={open}
            onClose={onClose}
            ideaId="idea-1"
            ideaTitle="Idea"
            nodes={[]}
            locked={false}
            onApplyPriorities={() => {}}
          />
        )}
      </Harness>
    );

  it('has role=dialog, aria-modal, and an accessible name; Escape closes and restores focus', async () => {
    renderIt();
    const { trigger } = await openAndAssertDialog(/AI: Priority Recommender/i);
    await assertEscapeClosesAndRestoresFocus(trigger);
  });
});

describe('AIAutoClustering — dialog a11y contract', () => {
  const renderIt = () =>
    render(
      <Harness>
        {(open, onClose) => (
          <AIAutoClustering
            open={open}
            onClose={onClose}
            ideaId="idea-1"
            ideaTitle="Idea"
            nodes={[]}
            locked={false}
            onApplyClusters={() => {}}
          />
        )}
      </Harness>
    );

  it('has role=dialog, aria-modal, and an accessible name; Escape closes and restores focus', async () => {
    renderIt();
    const { trigger } = await openAndAssertDialog(/AI: Auto-Clustering/i);
    await assertEscapeClosesAndRestoresFocus(trigger);
  });
});

describe('AIDependencyDetector — dialog a11y contract', () => {
  const renderIt = () =>
    render(
      <Harness>
        {(open, onClose) => (
          <AIDependencyDetector
            open={open}
            onClose={onClose}
            ideaId="idea-1"
            ideaTitle="Idea"
            nodes={[]}
            edges={[]}
            locked={false}
            onAddDependency={() => {}}
            onAddAll={() => {}}
          />
        )}
      </Harness>
    );

  it('has role=dialog, aria-modal, and an accessible name; Escape closes and restores focus', async () => {
    renderIt();
    const { trigger } = await openAndAssertDialog(/AI: Dependency Detection/i);
    await assertEscapeClosesAndRestoresFocus(trigger);
  });
});

describe('AICompetitiveLandscape — dialog a11y contract', () => {
  const renderIt = () =>
    render(
      <Harness>
        {(open, onClose) => (
          <AICompetitiveLandscape
            open={open}
            onClose={onClose}
            ideaId="idea-1"
            ideaTitle="Idea"
            nodes={[]}
            locked={false}
            onAddToMap={() => {}}
          />
        )}
      </Harness>
    );

  it('has role=dialog, aria-modal, and an accessible name; Escape closes and restores focus', async () => {
    renderIt();
    const { trigger } = await openAndAssertDialog(/AI: Competitive Landscape/i);
    await assertEscapeClosesAndRestoresFocus(trigger);
  });
});

describe('AIWhatIfScenarios — dialog a11y contract', () => {
  const renderIt = () =>
    render(
      <Harness>
        {(open, onClose) => (
          <AIWhatIfScenarios
            open={open}
            onClose={onClose}
            ideaId="idea-1"
            ideaTitle="Idea"
            selectedNodeLabel="Node"
            selectedNodeId="node-1"
            branchKey="branch-1"
            allNodes={[]}
            locked={false}
            onApplyScenario={() => {}}
          />
        )}
      </Harness>
    );

  it('has role=dialog, aria-modal, and an accessible name; Escape closes and restores focus', async () => {
    renderIt();
    const { trigger } = await openAndAssertDialog(/What if/i);
    await assertEscapeClosesAndRestoresFocus(trigger);
  });
});

describe('AIProposalDiffModal — dialog a11y contract', () => {
  // No `open` prop — parent mounts it only while a proposal is pending, so
  // useDialogA11y is wired with a constant `open: true` and `onClose:
  // onReject` (mirrors KPITimeSeriesDrawer's always-open drawer pattern).
  function ProposalHarness() {
    const [mounted, setMounted] = React.useState(false);
    return (
      <div>
        <button data-testid="trigger" onClick={() => setMounted(true)}>
          Open
        </button>
        {mounted && (
          <AIProposalDiffModal
            proposal={{ add: { nodes: [], edges: [] }, remove: { nodeIds: [], edgeIds: [] } }}
            isPl={false}
            existingNodes={[]}
            onApply={() => {}}
            onReject={() => setMounted(false)}
          />
        )}
      </div>
    );
  }

  it('has role=dialog, aria-modal, and an accessible name; Escape closes and restores focus', async () => {
    render(<ProposalHarness />);
    const { trigger } = await openAndAssertDialog(/AI Proposal/i);
    await assertEscapeClosesAndRestoresFocus(trigger);
  });
});
