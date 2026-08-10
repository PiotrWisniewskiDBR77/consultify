/**
 * @vitest-environment jsdom
 *
 * E14-A11Y-02 (P1) — Idea Table's ShareViewDialog and RefineDialog rendered
 * plain `fixed inset-0` overlays with ZERO `role="dialog"` / `aria-modal` /
 * focus-trap / focus-restore. Fixed via the shared `useDialogA11y` hook.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/api/tablePlatform.api', () => ({
  shareView: vi.fn(),
  unshareView: vi.fn(),
}));

import { RefineDialog } from '../RefineDialog';
import { ShareViewDialog } from '../ShareViewDialog';

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    get() {
      return document.body;
    },
    configurable: true,
  });
});

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

describe('ShareViewDialog — a11y dialog contract', () => {
  it('exposes role=dialog with an accessible name', () => {
    render(
      <ShareViewDialog viewId="v1" viewName="My view" onClose={vi.fn()} onUpdated={vi.fn()} />
    );
    expect(screen.getByRole('dialog', { name: /Share View/i })).toBeInTheDocument();
  });

  it('Escape closes it', () => {
    const onClose = vi.fn();
    render(
      <ShareViewDialog viewId="v1" viewName="My view" onClose={onClose} onUpdated={vi.fn()} />
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('returns focus to the trigger after Escape', async () => {
    render(
      <Trigger>
        {(open, close) =>
          open && (
            <ShareViewDialog viewId="v1" viewName="My view" onClose={close} onUpdated={vi.fn()} />
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

describe('RefineDialog — a11y dialog contract', () => {
  const baseProps = {
    proposalSummary: 'summary',
    proposalIntent: 'add_field',
    currentVersion: 1,
    refinementHistory: [],
    onRefine: vi.fn().mockResolvedValue(undefined),
  };

  it('exposes role=dialog with an accessible name', () => {
    render(<RefineDialog {...baseProps} onClose={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: /Refine Proposal/i })).toBeInTheDocument();
  });

  it('Escape closes it', () => {
    const onClose = vi.fn();
    render(<RefineDialog {...baseProps} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('returns focus to the trigger after Escape', async () => {
    render(
      <Trigger>
        {(open, close) => open && <RefineDialog {...baseProps} onClose={close} />}
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
