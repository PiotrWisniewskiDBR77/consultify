import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ConfirmDialog } from '../ConfirmDialog';

describe('ConfirmDialog confirmDisabled', () => {
  it('renders the confirm button enabled by default', () => {
    render(
      <ConfirmDialog
        isOpen
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        title="Delete item"
        confirmLabel="Delete"
      />
    );
    const confirmBtn = screen.getByRole('button', { name: 'Delete' });
    expect(confirmBtn).not.toBeDisabled();
  });

  it('visibly disables the confirm button — opacity + not-allowed cursor — when confirmDisabled is true', () => {
    render(
      <ConfirmDialog
        isOpen
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        title="Confirm critical organization status change"
        confirmLabel="Confirm status change"
        confirmDisabled
      />
    );
    const confirmBtn = screen.getByRole('button', { name: 'Confirm status change' });
    // Disabled is not enough on its own — a disabled button that LOOKS
    // identical to an active one gives no visual signal that the reason
    // field still needs 3+ characters before it can be pressed.
    expect(confirmBtn).toBeDisabled();
    expect(confirmBtn.className).toMatch(/disabled:opacity-50/);
    expect(confirmBtn.className).toMatch(/disabled:cursor-not-allowed/);
  });

  it('does not call onConfirm when the disabled confirm button is clicked', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        isOpen
        onConfirm={onConfirm}
        onCancel={vi.fn()}
        title="Confirm critical organization status change"
        confirmLabel="Confirm status change"
        confirmDisabled
      />
    );
    const confirmBtn = screen.getByRole('button', { name: 'Confirm status change' });
    confirmBtn.click();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
