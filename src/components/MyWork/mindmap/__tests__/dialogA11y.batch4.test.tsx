/**
 * @vitest-environment jsdom
 *
 * A11Y-BACKLOG batch 4 — mindmap full-screen "view" overlays (MindMap3DView,
 * BranchComparison, TimeHeatmap, TimelineView, IdeaFunnelAnalytics,
 * PresentationMode) plus MindmapCommandPalette (the one twin-div
 * backdrop+positioned-content overlay in this directory), all converted onto
 * the shared `useDialogA11y` contract.
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

import { BranchComparison } from '../BranchComparison';
import { IdeaFunnelAnalytics } from '../IdeaFunnelAnalytics';
import { MindMap3DView } from '../MindMap3DView';
import { MindmapCommandPalette } from '../MindmapCommandPalette';
import { PresentationMode } from '../PresentationMode';
import { TimeHeatmap } from '../TimeHeatmap';
import { TimelineView } from '../TimelineView';

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

describe('MindMap3DView — dialog a11y contract', () => {
  it('has role=dialog, aria-modal, and an accessible name; Escape closes and restores focus', async () => {
    render(
      <Harness>
        {(open, onClose) => (
          <MindMap3DView open={open} onClose={onClose} ideaTitle="Idea" nodes={[]} edges={[]} />
        )}
      </Harness>
    );
    const { trigger } = await openAndAssertDialog(/3D View/i);
    await assertEscapeClosesAndRestoresFocus(trigger);
  });
});

describe('BranchComparison — dialog a11y contract', () => {
  it('has role=dialog, aria-modal, and an accessible name; Escape closes and restores focus', async () => {
    render(
      <Harness>
        {(open, onClose) => <BranchComparison open={open} onClose={onClose} nodes={[]} edges={[]} />}
      </Harness>
    );
    const { trigger } = await openAndAssertDialog(/Branch Comparison/i);
    await assertEscapeClosesAndRestoresFocus(trigger);
  });
});

describe('TimeHeatmap — dialog a11y contract', () => {
  it('has role=dialog, aria-modal, and an accessible name; Escape closes and restores focus', async () => {
    render(
      <Harness>{(open, onClose) => <TimeHeatmap open={open} onClose={onClose} ideaId="idea-1" />}</Harness>
    );
    const { trigger } = await openAndAssertDialog(/Activity/i);
    await assertEscapeClosesAndRestoresFocus(trigger);
  });
});

describe('TimelineView — dialog a11y contract', () => {
  it('has role=dialog, aria-modal, and an accessible name; Escape closes and restores focus', async () => {
    render(
      <Harness>
        {(open, onClose) => (
          <TimelineView open={open} onClose={onClose} nodes={[]} onSelectNode={() => {}} />
        )}
      </Harness>
    );
    const { trigger } = await openAndAssertDialog(/Timeline View/i);
    await assertEscapeClosesAndRestoresFocus(trigger);
  });
});

describe('IdeaFunnelAnalytics — dialog a11y contract', () => {
  it('has role=dialog, aria-modal, and an accessible name; Escape closes and restores focus', async () => {
    render(
      <Harness>{(open, onClose) => <IdeaFunnelAnalytics open={open} onClose={onClose} nodes={[]} />}</Harness>
    );
    const { trigger } = await openAndAssertDialog(/Idea Funnel/i);
    await assertEscapeClosesAndRestoresFocus(trigger);
  });
});

describe('PresentationMode — dialog a11y contract', () => {
  it('empty-map branch: has role=dialog, aria-modal, and an accessible name; Escape closes and restores focus', async () => {
    render(
      <Harness>
        {(open, onClose) => (
          <PresentationMode
            open={open}
            onClose={onClose}
            ideaTitle="Idea"
            branches={[]}
            onFocusBranch={() => {}}
          />
        )}
      </Harness>
    );
    const { trigger } = await openAndAssertDialog(/Presentation Mode/i);
    await assertEscapeClosesAndRestoresFocus(trigger);
  });

  it('slide-deck branch: has role=dialog, aria-modal, and an accessible name; Escape closes and restores focus', async () => {
    render(
      <Harness>
        {(open, onClose) => (
          <PresentationMode
            open={open}
            onClose={onClose}
            ideaTitle="Idea"
            branches={[
              { branchKey: 'problem', label: 'Problem', nodes: [{ id: 'n1', label: 'Node 1' }] },
            ]}
            onFocusBranch={() => {}}
          />
        )}
      </Harness>
    );
    const { trigger } = await openAndAssertDialog(/Presentation Mode/i);
    await assertEscapeClosesAndRestoresFocus(trigger);
  });
});

describe('MindmapCommandPalette — dialog a11y contract', () => {
  it('has role=dialog, aria-modal, and an accessible name', async () => {
    render(
      <Harness>
        {(open, onClose) => (
          <MindmapCommandPalette open={open} onClose={onClose} onAction={() => {}} />
        )}
      </Harness>
    );
    const { trigger } = await openAndAssertDialog(/Command palette/i);
    await assertEscapeClosesAndRestoresFocus(trigger);
  });

  it('focuses the search input on open', async () => {
    render(
      <Harness>
        {(open, onClose) => (
          <MindmapCommandPalette open={open} onClose={onClose} onAction={() => {}} />
        )}
      </Harness>
    );
    fireEvent.click(screen.getByTestId('trigger'));
    await screen.findByRole('dialog');
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByPlaceholderText('Search actions…'));
    });
  });
});
