/**
 * @vitest-environment jsdom
 *
 * E14-A11Y-02 (P1) — FinancialCaseDialog rendered a plain `fixed inset-0`
 * overlay with ZERO `role="dialog"` / `aria-modal` / focus-trap /
 * focus-restore. Fixed via the shared `useDialogA11y` hook.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { FinancialCaseDialog } from '../FinancialCaseDialog';

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

describe('FinancialCaseDialog — a11y dialog contract', () => {
  it('exposes role=dialog with an accessible name', () => {
    render(<FinancialCaseDialog open onClose={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: /Financial case/i })).toBeInTheDocument();
  });

  it('Escape closes it', () => {
    const onClose = vi.fn();
    render(<FinancialCaseDialog open onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('returns focus to the trigger after Escape', async () => {
    render(
      <Trigger>{(open, close) => open && <FinancialCaseDialog open onClose={close} />}</Trigger>
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
