/**
 * D3 — focus-return-to-trigger fix for TransformativeConfirmDialog.
 *
 * The dialog already moved initial focus INTO the dialog on open and closed
 * on Escape/Cancel/Continue, but did not return focus to whatever triggered
 * it (the "Create proposal" button) on close — a keyboard/screen-reader user
 * would lose their place. This proves the fix: focus is captured on open and
 * restored on close, for all three close paths (Cancel, Escape, Continue).
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React, { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { TransformativeConfirmDialog } from '../../../src/components/DocumentStudio/TransformativeConfirmDialog';

function Harness(): React.ReactElement {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Create proposal
      </button>
      <TransformativeConfirmDialog
        open={open}
        onCancel={() => setOpen(false)}
        onConfirm={() => setOpen(false)}
      />
    </div>
  );
}

describe('TransformativeConfirmDialog — focus return (D3)', () => {
  it('returns focus to the trigger button after Cancel', () => {
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Create proposal' });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });

  it('returns focus to the trigger button after Escape', () => {
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Create proposal' });
    trigger.focus();
    fireEvent.click(trigger);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });

  it('returns focus to the trigger button after Continue', () => {
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Create proposal' });
    trigger.focus();
    fireEvent.click(trigger);

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });
});
