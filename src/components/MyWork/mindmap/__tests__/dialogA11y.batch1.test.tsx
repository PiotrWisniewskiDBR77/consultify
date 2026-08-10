/**
 * @vitest-environment jsdom
 *
 * A11Y-BACKLOG batch 1 — small "replace window.prompt" mindmap modals
 * (AddEvidenceModal, ImageUrlModal, AttachArtifactModal, AssignPersonModal)
 * converted onto the shared `useDialogA11y` contract: named `role="dialog"`,
 * `aria-modal`, Escape-to-close, focus enters the dialog on open, and focus
 * returns to the trigger that opened it on close.
 *
 * Each component previously used native `autoFocus` on its first input,
 * which fires during React's synchronous commit — before useDialogA11y's
 * mount-time effect captures the previously-focused element — and so raced
 * ahead of the hook's focus-restore bookkeeping. All four now use
 * `initialFocusRef` instead.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeAll, describe, expect, it } from 'vitest';

// jsdom never computes layout, so `offsetParent` is always null — the
// hook's Tab-trap / focusable-element scan filters on it. Stub it so
// filtering behaves as it would in a real browser.
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    get() {
      return document.body;
    },
    configurable: true,
  });
});

import { AddEvidenceModal } from '../AddEvidenceModal';
import { AssignPersonModal } from '../AssignPersonModal';
import { AttachArtifactModal } from '../AttachArtifactModal';
import { ImageUrlModal } from '../ImageUrlModal';

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

describe('AddEvidenceModal — dialog a11y contract', () => {
  it('has role=dialog, aria-modal, and an accessible name', async () => {
    render(
      <Harness>{(open, onClose) => <AddEvidenceModal open={open} onClose={onClose} onAdd={() => {}} />}</Harness>
    );
    fireEvent.click(screen.getByTestId('trigger'));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName(/Add evidence/i);
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    render(
      <Harness>{(open, onClose) => <AddEvidenceModal open={open} onClose={onClose} onAdd={() => {}} />}</Harness>
    );
    const trigger = screen.getByTestId('trigger');
    trigger.focus();
    fireEvent.click(trigger);
    await screen.findByRole('dialog');

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it('focuses the title input on open (not via native autoFocus)', async () => {
    render(
      <Harness>{(open, onClose) => <AddEvidenceModal open={open} onClose={onClose} onAdd={() => {}} />}</Harness>
    );
    fireEvent.click(screen.getByTestId('trigger'));
    await screen.findByRole('dialog');
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByPlaceholderText('Evidence title...'));
    });
  });
});

describe('ImageUrlModal — dialog a11y contract', () => {
  it('has role=dialog, aria-modal, and an accessible name', async () => {
    render(
      <Harness>{(open, onClose) => <ImageUrlModal open={open} onClose={onClose} onSubmit={() => {}} />}</Harness>
    );
    fireEvent.click(screen.getByTestId('trigger'));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName(/Add image/i);
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    render(
      <Harness>{(open, onClose) => <ImageUrlModal open={open} onClose={onClose} onSubmit={() => {}} />}</Harness>
    );
    const trigger = screen.getByTestId('trigger');
    trigger.focus();
    fireEvent.click(trigger);
    await screen.findByRole('dialog');

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});

describe('AttachArtifactModal — dialog a11y contract', () => {
  it('has role=dialog, aria-modal, and an accessible name', async () => {
    render(
      <Harness>
        {(open, onClose) => <AttachArtifactModal open={open} onClose={onClose} onAttach={() => {}} />}
      </Harness>
    );
    fireEvent.click(screen.getByTestId('trigger'));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName(/Attach artifact/i);
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    render(
      <Harness>
        {(open, onClose) => <AttachArtifactModal open={open} onClose={onClose} onAttach={() => {}} />}
      </Harness>
    );
    const trigger = screen.getByTestId('trigger');
    trigger.focus();
    fireEvent.click(trigger);
    await screen.findByRole('dialog');

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});

describe('AssignPersonModal — dialog a11y contract', () => {
  it('has role=dialog, aria-modal, and an accessible name', async () => {
    render(
      <Harness>{(open, onClose) => <AssignPersonModal open={open} onClose={onClose} onAssign={() => {}} />}</Harness>
    );
    fireEvent.click(screen.getByTestId('trigger'));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName(/Assign person/i);
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    render(
      <Harness>{(open, onClose) => <AssignPersonModal open={open} onClose={onClose} onAssign={() => {}} />}</Harness>
    );
    const trigger = screen.getByTestId('trigger');
    trigger.focus();
    fireEvent.click(trigger);
    await screen.findByRole('dialog');

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it('focuses the name input on open (not via native autoFocus)', async () => {
    render(
      <Harness>{(open, onClose) => <AssignPersonModal open={open} onClose={onClose} onAssign={() => {}} />}</Harness>
    );
    fireEvent.click(screen.getByTestId('trigger'));
    await screen.findByRole('dialog');
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByPlaceholderText('Name...'));
    });
  });
});
