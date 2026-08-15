/**
 * @vitest-environment jsdom
 *
 * Component tests for AddSourceDialog (Block B / EPIC-T8).
 *
 * Coverage:
 *   * `open=false` renders nothing.
 *   * Submitting with default values builds the documented payload.
 *   * Confidence contribution out of [0, 1] is rejected before submit.
 *   * URI > 2048 chars is rejected before submit.
 *   * `onSubmit` rejection surfaces an error and keeps the dialog open.
 *   * Successful submit closes the dialog.
 *
 * E14-A11Y-02 (P1) follow-up (2026-08-10): this was one of only two files
 * in the Table tool with `role="dialog"`/`aria-modal` at all — but it still
 * had no Escape-to-close, no Tab-trap, and no focus-restore. Extended below
 * with the shared `useDialogA11y` hook wired in and the tests that prove it.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => {
      const messages: Record<string, string> = {
        'myWorkTable.addSourceDialog.confidenceMustBeNumber':
          'Confidence contribution must be a number between 0 and 1.',
        'myWorkTable.addSourceDialog.uriTooLong': 'URI must be ≤ 2048 characters.',
      };
      return messages[key] ?? options?.defaultValue ?? key;
    },
    i18n: { language: 'en' },
  }),
}));

import { AddSourceDialog } from '../AddSourceDialog';

// jsdom never computes layout, so `offsetParent` is always null — the
// shared hook's Tab-trap filters on it to skip hidden elements. Stub it so
// the visible-element filter behaves as it would in a real browser (same
// shim used by useDialogA11y.test.tsx).
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

describe('AddSourceDialog', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <AddSourceDialog open={false} onClose={vi.fn()} onSubmit={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('submits with the documented payload', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(<AddSourceDialog open onClose={onClose} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByTestId('provenance-add-source-dialog-uri'), {
      target: { value: 'https://example.com/data.csv' },
    });
    fireEvent.change(screen.getByTestId('provenance-add-source-dialog-contribution'), {
      target: { value: '0.6' },
    });
    fireEvent.change(screen.getByTestId('provenance-add-source-dialog-note'), {
      target: { value: 'CSV import from finance team' },
    });
    fireEvent.submit(
      screen.getByTestId('provenance-add-source-dialog-submit').closest('form') as HTMLFormElement
    );
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit).toHaveBeenCalledWith({
      source_type: 'manual',
      source_uri: 'https://example.com/data.csv',
      confidence_contribution: 0.6,
      source_metadata: { note: 'CSV import from finance team' },
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('rejects out-of-range confidence contribution', async () => {
    const onSubmit = vi.fn();
    render(<AddSourceDialog open onClose={vi.fn()} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByTestId('provenance-add-source-dialog-contribution'), {
      target: { value: '1.5' },
    });
    fireEvent.submit(
      screen.getByTestId('provenance-add-source-dialog-submit').closest('form') as HTMLFormElement
    );
    expect(await screen.findByTestId('provenance-add-source-dialog-error')).toHaveTextContent(
      /0 and 1/i
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rejects URI > 2048 chars', async () => {
    const onSubmit = vi.fn();
    render(<AddSourceDialog open onClose={vi.fn()} onSubmit={onSubmit} />);
    const longUri = 'https://example.com/' + 'x'.repeat(2050);
    fireEvent.change(screen.getByTestId('provenance-add-source-dialog-uri'), {
      target: { value: longUri },
    });
    fireEvent.submit(
      screen.getByTestId('provenance-add-source-dialog-submit').closest('form') as HTMLFormElement
    );
    expect(await screen.findByTestId('provenance-add-source-dialog-error')).toHaveTextContent(
      /2048/
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('surfaces onSubmit rejection without closing the dialog', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Network down'));
    const onClose = vi.fn();
    render(<AddSourceDialog open onClose={onClose} onSubmit={onSubmit} />);
    fireEvent.submit(
      screen.getByTestId('provenance-add-source-dialog-submit').closest('form') as HTMLFormElement
    );
    expect(await screen.findByTestId('provenance-add-source-dialog-error')).toHaveTextContent(
      'Network down'
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Escape closes it (was previously wired to nothing — role="dialog" existed with no keyboard dismissal)', () => {
    const onClose = vi.fn();
    render(<AddSourceDialog open onClose={onClose} onSubmit={vi.fn()} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('returns focus to the trigger after Escape', async () => {
    render(
      <Trigger>
        {(open, close) => open && <AddSourceDialog open onClose={close} onSubmit={vi.fn()} />}
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

  it('traps Tab inside the dialog: Tab on the last control cycles to the first', () => {
    render(<AddSourceDialog open onClose={vi.fn()} onSubmit={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    const focusable = dialog.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    last.focus();
    expect(last).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(first).toHaveFocus();
  });
});
