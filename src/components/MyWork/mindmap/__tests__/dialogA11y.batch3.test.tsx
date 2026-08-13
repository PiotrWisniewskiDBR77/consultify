/**
 * @vitest-environment jsdom
 *
 * A11Y-BACKLOG batch 3 — remaining mindmap centered modals (VoiceToNode,
 * ImportExternalMap, ExportPowerPoint, BatchConvertModal, SnapshotHistory,
 * ExportDiagramCode, DocumentToMap, InterviewToMap, EmbedInReports)
 * converted onto the shared `useDialogA11y` contract.
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

import { BatchConvertModal } from '../BatchConvertModal';
import { DocumentToMap } from '../DocumentToMap';
import { EmbedInReports } from '../EmbedInReports';
import { ExportDiagramCode } from '../ExportDiagramCode';
import { ExportPowerPoint } from '../ExportPowerPoint';
import { ImportExternalMap } from '../ImportExternalMap';
import { InterviewToMap } from '../InterviewToMap';
import { SnapshotHistory } from '../SnapshotHistory';
import { VoiceToNode } from '../VoiceToNode';

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

describe('VoiceToNode — dialog a11y contract', () => {
  it('has role=dialog, aria-modal, and an accessible name; Escape closes and restores focus', async () => {
    render(
      <Harness>
        {(open, onClose) => (
          <VoiceToNode open={open} onClose={onClose} locked={false} onAddNodes={() => {}} />
        )}
      </Harness>
    );
    const { trigger } = await openAndAssertDialog(/Voice to Node/i);
    await assertEscapeClosesAndRestoresFocus(trigger);
  });
});

describe('ImportExternalMap — dialog a11y contract', () => {
  it('has role=dialog, aria-modal, and an accessible name; Escape closes and restores focus', async () => {
    render(
      <Harness>
        {(open, onClose) => (
          <ImportExternalMap open={open} onClose={onClose} locked={false} onImport={() => {}} />
        )}
      </Harness>
    );
    const { trigger } = await openAndAssertDialog(/Import Mind Map/i);
    await assertEscapeClosesAndRestoresFocus(trigger);
  });
});

describe('ExportPowerPoint — dialog a11y contract', () => {
  it('has role=dialog, aria-modal, and an accessible name; Escape closes and restores focus', async () => {
    render(
      <Harness>
        {(open, onClose) => (
          <ExportPowerPoint
            open={open}
            onClose={onClose}
            ideaId="idea-1"
            ideaTitle="Idea"
            branches={[]}
          />
        )}
      </Harness>
    );
    const { trigger } = await openAndAssertDialog(/Export Presentation/i);
    await assertEscapeClosesAndRestoresFocus(trigger);
  });
});

describe('BatchConvertModal — dialog a11y contract', () => {
  it('has role=dialog, aria-modal, and an accessible name; Escape closes and restores focus', async () => {
    render(
      <Harness>
        {(open, onClose) => (
          <BatchConvertModal
            open={open}
            onClose={onClose}
            nodes={[]}
            locked={false}
            onConvert={() => {}}
          />
        )}
      </Harness>
    );
    const { trigger } = await openAndAssertDialog(/Batch Convert/i);
    await assertEscapeClosesAndRestoresFocus(trigger);
  });
});

describe('SnapshotHistory — dialog a11y contract', () => {
  it('has role=dialog, aria-modal, and an accessible name; Escape closes and restores focus', async () => {
    render(
      <Harness>
        {(open, onClose) => (
          <SnapshotHistory
            open={open}
            onClose={onClose}
            ideaId="idea-1"
            currentNodes={[]}
            currentEdges={[]}
            onRestore={() => {}}
          />
        )}
      </Harness>
    );
    const { trigger } = await openAndAssertDialog(/Version History/i);
    await assertEscapeClosesAndRestoresFocus(trigger);
  });
});

describe('ExportDiagramCode — dialog a11y contract', () => {
  it('has role=dialog, aria-modal, and an accessible name; Escape closes and restores focus', async () => {
    render(
      <Harness>
        {(open, onClose) => (
          <ExportDiagramCode open={open} onClose={onClose} ideaTitle="Idea" nodes={[]} edges={[]} />
        )}
      </Harness>
    );
    const { trigger } = await openAndAssertDialog(/Export Diagram Code/i);
    await assertEscapeClosesAndRestoresFocus(trigger);
  });
});

describe('DocumentToMap — dialog a11y contract', () => {
  it('has role=dialog, aria-modal, and an accessible name; Escape closes and restores focus', async () => {
    render(
      <Harness>
        {(open, onClose) => (
          <DocumentToMap
            open={open}
            onClose={onClose}
            ideaId="idea-1"
            ideaTitle="Idea"
            locked={false}
            onAddNodes={() => {}}
          />
        )}
      </Harness>
    );
    const { trigger } = await openAndAssertDialog(/Document.*Map/i);
    await assertEscapeClosesAndRestoresFocus(trigger);
  });
});

describe('InterviewToMap — dialog a11y contract', () => {
  it('has role=dialog, aria-modal, and an accessible name; Escape closes and restores focus', async () => {
    render(
      <Harness>
        {(open, onClose) => (
          <InterviewToMap
            open={open}
            onClose={onClose}
            ideaId="idea-1"
            ideaTitle="Idea"
            locked={false}
            onAddNodes={() => {}}
          />
        )}
      </Harness>
    );
    const { trigger } = await openAndAssertDialog(/Interviews.*Map/i);
    await assertEscapeClosesAndRestoresFocus(trigger);
  });
});

describe('EmbedInReports — dialog a11y contract', () => {
  it('has role=dialog, aria-modal, and an accessible name; Escape closes and restores focus', async () => {
    render(
      <Harness>
        {(open, onClose) => (
          <EmbedInReports
            open={open}
            onClose={onClose}
            ideaId="idea-1"
            ideaTitle="Idea"
            nodes={[]}
            edges={[]}
          />
        )}
      </Harness>
    );
    const { trigger } = await openAndAssertDialog(/Embed in Report/i);
    await assertEscapeClosesAndRestoresFocus(trigger);
  });
});
