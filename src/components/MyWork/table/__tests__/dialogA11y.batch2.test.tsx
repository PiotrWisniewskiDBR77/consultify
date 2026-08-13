/**
 * @vitest-environment jsdom
 *
 * A11Y-BACKLOG (table) batch 2 — AICategorizeTool, IdeaScoringModel,
 * IdeaDecisionLogPanel, VoiceImageInput, IdeaPipeline, CrossTableRelations,
 * AICopilotMode, FinancialCaseDialog, IdeaStartupTemplates converted onto
 * the shared `useDialogA11y` contract.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    get() {
      return document.body;
    },
    configurable: true,
  });
});

vi.mock('react-hot-toast', () => {
  const fn = vi.fn();
  return { default: Object.assign(fn, { success: vi.fn(), error: vi.fn() }) };
});

import { AICategorizeTool } from '../AICategorizeTool';
import { AICopilotMode } from '../AICopilotMode';
import { CrossTableRelations } from '../CrossTableRelations';
import { FinancialCaseDialog } from '../financial/FinancialCaseDialog';
import { IdeaDecisionLogPanel } from '../IdeaDecisionLogPanel';
import { IdeaPipeline } from '../IdeaPipeline';
import { IdeaScoringModel } from '../IdeaScoringModel';
import { IdeaStartupTemplates } from '../IdeaStartupTemplates';
import { VoiceImageInput } from '../VoiceImageInput';

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

describe('AICategorizeTool — dialog a11y contract', () => {
  it('has role=dialog, aria-modal, and an accessible name; Escape closes and restores focus', async () => {
    render(
      <Harness>
        {(open, onClose) => (
          <AICategorizeTool
            open={open}
            onClose={onClose}
            nodes={[]}
            ideaId="idea-1"
            onApplyTags={() => {}}
            onApplyCluster={() => {}}
          />
        )}
      </Harness>
    );
    const { trigger } = await openAndAssertDialog(/Categorize/i);
    await assertEscapeClosesAndRestoresFocus(trigger);
  });
});

describe('IdeaScoringModel — dialog a11y contract', () => {
  it('has role=dialog, aria-modal, and an accessible name; Escape closes and restores focus', async () => {
    render(
      <Harness>
        {(open, onClose) => (
          <IdeaScoringModel
            open={open}
            onClose={onClose}
            nodes={[]}
            columns={[]}
            ideaId="idea-1"
            onApplyScores={() => {}}
          />
        )}
      </Harness>
    );
    const { trigger } = await openAndAssertDialog(/Scoring/i);
    await assertEscapeClosesAndRestoresFocus(trigger);
  });
});

describe('IdeaDecisionLogPanel — dialog a11y contract', () => {
  it('has role=dialog, aria-modal, and an accessible name; Escape closes and restores focus', async () => {
    render(
      <Harness>
        {(open, onClose) => (
          <IdeaDecisionLogPanel
            open={open}
            onClose={onClose}
            nodes={[]}
            ideaId="idea-1"
            onApplyDecisionLog={() => {}}
          />
        )}
      </Harness>
    );
    const { trigger } = await openAndAssertDialog(/Decision log/i);
    await assertEscapeClosesAndRestoresFocus(trigger);
  });
});

describe('VoiceImageInput — dialog a11y contract', () => {
  it('has role=dialog, aria-modal, and an accessible name; Escape closes and restores focus', async () => {
    render(
      <Harness>
        {(open, onClose) => (
          <VoiceImageInput open={open} onClose={onClose} ideaId="idea-1" onAddRows={() => {}} />
        )}
      </Harness>
    );
    const { trigger } = await openAndAssertDialog(/Voice Input/i);
    await assertEscapeClosesAndRestoresFocus(trigger);
  });
});

describe('IdeaPipeline — dialog a11y contract', () => {
  it('has role=dialog, aria-modal, and an accessible name; Escape closes and restores focus', async () => {
    render(
      <Harness>
        {(open, onClose) => (
          <IdeaPipeline
            open={open}
            onClose={onClose}
            nodes={[]}
            ideaId="idea-1"
            onStageChange={() => {}}
          />
        )}
      </Harness>
    );
    const { trigger } = await openAndAssertDialog(/Pipeline/i);
    await assertEscapeClosesAndRestoresFocus(trigger);
  });
});

describe('CrossTableRelations — dialog a11y contract', () => {
  it('has role=dialog, aria-modal, and an accessible name; Escape closes and restores focus', async () => {
    render(
      <Harness>
        {(open, onClose) => (
          <CrossTableRelations
            open={open}
            onClose={onClose}
            ideaId="idea-1"
            currentNodes={[]}
            currentEdges={[]}
            onAddEdge={() => {}}
          />
        )}
      </Harness>
    );
    const { trigger } = await openAndAssertDialog(/crossTableRelations/i);
    await assertEscapeClosesAndRestoresFocus(trigger);
  });
});

describe('AICopilotMode — dialog a11y contract', () => {
  it('has role=dialog, aria-modal, and an accessible name; Escape closes and restores focus', async () => {
    render(
      <Harness>
        {(open, onClose) => (
          <AICopilotMode
            open={open}
            onClose={onClose}
            nodes={[]}
            ideaId="idea-1"
            onAddRows={() => {}}
          />
        )}
      </Harness>
    );
    const { trigger } = await openAndAssertDialog(/AI Copilot/i);
    await assertEscapeClosesAndRestoresFocus(trigger);
  });
});

describe('FinancialCaseDialog — dialog a11y contract', () => {
  it('has role=dialog, aria-modal, and an accessible name; Escape closes and restores focus', async () => {
    render(
      <Harness>{(open, onClose) => <FinancialCaseDialog open={open} onClose={onClose} />}</Harness>
    );
    const { trigger } = await openAndAssertDialog(/Financial case/i);
    await assertEscapeClosesAndRestoresFocus(trigger);
  });
});

describe('IdeaStartupTemplates — dialog a11y contract', () => {
  it('has role=dialog, aria-modal, and an accessible name; Escape closes and restores focus', async () => {
    render(
      <Harness>
        {(open, onClose) => (
          <IdeaStartupTemplates open={open} onClose={onClose} onSelect={() => {}} />
        )}
      </Harness>
    );
    const { trigger } = await openAndAssertDialog(/newIdea/i);
    await assertEscapeClosesAndRestoresFocus(trigger);
  });
});
