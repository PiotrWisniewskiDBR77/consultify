/**
 * @vitest-environment jsdom
 *
 * E14-A11Y-02 (P1) — Mind Map's window.prompt-replacement modals
 * (AddEvidenceModal, AssignPersonModal, AttachArtifactModal, ImageUrlModal,
 * BatchConvertModal) rendered plain `fixed inset-0` overlays with ZERO
 * `role="dialog"` / `aria-modal` / focus-trap / Escape / focus-restore.
 * Fixed by wiring the repo's existing `useDialogA11y` hook (the same
 * contract Modal.tsx and KPITimeSeriesDrawer already use) — see file
 * headers for details. This test proves each of the five now exposes the
 * canonical dialog contract.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { AddEvidenceModal } from '../AddEvidenceModal';
import { AssignPersonModal } from '../AssignPersonModal';
import { AttachArtifactModal } from '../AttachArtifactModal';
import { BatchConvertModal } from '../BatchConvertModal';
import { ImageUrlModal } from '../ImageUrlModal';

// jsdom never computes layout, so `offsetParent` is always null — the
// shared hook's Tab-trap filters on it to skip hidden elements. Stub it so
// the visible-element filter behaves as it would in a real browser (same
// shim used by useDialogA11y.test.tsx / RaidCanvas.deleteConfirm.test.tsx).
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    get() {
      return document.body;
    },
    configurable: true,
  });
});

function Trigger({ children }: { children: (open: boolean, close: () => void) => React.ReactNode }) {
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

describe('AddEvidenceModal — a11y dialog contract', () => {
  it('exposes role=dialog with an accessible name', () => {
    render(<AddEvidenceModal open onClose={vi.fn()} onAdd={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: /Add evidence \/ source/i })).toBeInTheDocument();
  });

  it('Escape closes it', () => {
    const onClose = vi.fn();
    render(<AddEvidenceModal open onClose={onClose} onAdd={vi.fn()} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('returns focus to the trigger after Escape', async () => {
    render(
      <Trigger>
        {(open, close) => open && <AddEvidenceModal open onClose={close} onAdd={vi.fn()} />}
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

  it('focus enters the dialog on open', async () => {
    render(<AddEvidenceModal open onClose={vi.fn()} onAdd={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  });
});

describe('AssignPersonModal — a11y dialog contract', () => {
  it('exposes role=dialog with an accessible name', () => {
    render(<AssignPersonModal open onClose={vi.fn()} onAssign={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: /Assign person/i })).toBeInTheDocument();
  });

  it('Escape closes it', () => {
    const onClose = vi.fn();
    render(<AssignPersonModal open onClose={onClose} onAssign={vi.fn()} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('returns focus to the trigger after Escape', async () => {
    render(
      <Trigger>
        {(open, close) =>
          open && <AssignPersonModal open onClose={close} onAssign={vi.fn()} />
        }
      </Trigger>
    );
    const trigger = screen.getByRole('button', { name: 'Open trigger' });
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});

describe('AttachArtifactModal — a11y dialog contract', () => {
  it('exposes role=dialog with an accessible name', () => {
    render(<AttachArtifactModal open onClose={vi.fn()} onAttach={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: /Attach artifact/i })).toBeInTheDocument();
  });

  it('Escape closes it', () => {
    const onClose = vi.fn();
    render(<AttachArtifactModal open onClose={onClose} onAttach={vi.fn()} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('returns focus to the trigger after Escape', async () => {
    render(
      <Trigger>
        {(open, close) =>
          open && <AttachArtifactModal open onClose={close} onAttach={vi.fn()} />
        }
      </Trigger>
    );
    const trigger = screen.getByRole('button', { name: 'Open trigger' });
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});

describe('ImageUrlModal — a11y dialog contract', () => {
  it('exposes role=dialog with an accessible name', () => {
    render(<ImageUrlModal open onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: /Add image/i })).toBeInTheDocument();
  });

  it('Escape closes it', () => {
    const onClose = vi.fn();
    render(<ImageUrlModal open onClose={onClose} onSubmit={vi.fn()} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('returns focus to the trigger after Escape', async () => {
    render(
      <Trigger>{(open, close) => open && <ImageUrlModal open onClose={close} onSubmit={vi.fn()} />}</Trigger>
    );
    const trigger = screen.getByRole('button', { name: 'Open trigger' });
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});

describe('BatchConvertModal — a11y dialog contract', () => {
  const NODES = [{ id: 'n1', label: 'Node one', branchKey: 'b1' }];

  it('exposes role=dialog with an accessible name', () => {
    render(
      <BatchConvertModal open onClose={vi.fn()} nodes={NODES} locked={false} onConvert={vi.fn()} />
    );
    expect(screen.getByRole('dialog', { name: /Batch Convert/i })).toBeInTheDocument();
  });

  it('Escape closes it', () => {
    const onClose = vi.fn();
    render(
      <BatchConvertModal
        open
        onClose={onClose}
        nodes={NODES}
        locked={false}
        onConvert={vi.fn()}
      />
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('returns focus to the trigger after Escape', async () => {
    render(
      <Trigger>
        {(open, close) =>
          open && (
            <BatchConvertModal
              open
              onClose={close}
              nodes={NODES}
              locked={false}
              onConvert={vi.fn()}
            />
          )
        }
      </Trigger>
    );
    const trigger = screen.getByRole('button', { name: 'Open trigger' });
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
