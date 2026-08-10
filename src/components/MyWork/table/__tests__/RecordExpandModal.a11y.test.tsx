/**
 * @vitest-environment jsdom
 *
 * E14-A11Y-02 (P1) — RecordExpandModal (a drawer opened from the table)
 * rendered a plain `fixed inset-0` overlay whose only a11y attempt was a
 * bespoke `document.addEventListener('keydown', ...)` Escape handler with
 * no `role="dialog"`, no focus-trap, and no focus-restore. Replaced with
 * the shared `useDialogA11y` hook (same contract as KPITimeSeriesDrawer).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/api/tablePlatform.api', () => ({
  getRecord: vi.fn().mockResolvedValue({ data: { name: 'Test record' } }),
  getTable: vi.fn().mockResolvedValue({ name: 'Table one', fields: [] }),
  updateRecord: vi.fn(),
}));

import { RecordExpandModal } from '../RecordExpandModal';

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

describe('RecordExpandModal — a11y dialog contract', () => {
  it('exposes role=dialog', async () => {
    render(
      <RecordExpandModal open onClose={vi.fn()} recordId="rec-1" tableId="tbl-1" />
    );
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('Escape closes it', async () => {
    const onClose = vi.fn();
    render(
      <RecordExpandModal open onClose={onClose} recordId="rec-1" tableId="tbl-1" />
    );
    await screen.findByRole('dialog');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('returns focus to the trigger after Escape', async () => {
    render(
      <Trigger>
        {(open, close) =>
          open && (
            <RecordExpandModal open onClose={close} recordId="rec-1" tableId="tbl-1" />
          )
        }
      </Trigger>
    );
    const trigger = screen.getByRole('button', { name: 'Open trigger' });
    trigger.focus();
    fireEvent.click(trigger);
    await screen.findByRole('dialog');

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
