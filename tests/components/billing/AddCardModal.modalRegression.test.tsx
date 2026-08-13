/**
 * AddCardModal — Modal.tsx regression check (RN-G5 platform lane, 2026-08-12).
 *
 * No pre-existing test coverage (confirmed by `find tests -iname
 * "*AddCardModal*"` returning nothing before this file). Real consumer of
 * `src/components/ui/primitives/Modal.tsx` using the "conditional mount"
 * pattern (`<Modal open onClose={onClose}>` unconditional inside — parent
 * mounts/unmounts `<AddCardModal>` itself), matching the
 * `RoiTransitionDialog` pattern already covered generically in
 * `Modal.focusReturn.test.tsx`. Proves the Esc focus-return fix (P1 nr 2)
 * holds for this real consumer too.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React, { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { AddCardModal } from '../../../src/components/billing/AddCardModal';

vi.mock('../../../src/services/api', () => ({
  Api: {
    createSetupIntent: vi.fn(async () => ({ clientSecret: 'x', id: 'y' })),
  },
}));

vi.mock('../../../src/utils/billingSelfServeFlag', () => ({
  isBillingSelfServeEnabled: () => false,
}));

const Harness: React.FC = () => {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" data-testid="add-card-trigger" onClick={() => setOpen(true)}>
        Add card
      </button>
      {open ? <AddCardModal onClose={() => setOpen(false)} onSuccess={vi.fn()} /> : null}
    </div>
  );
};

describe('AddCardModal · Modal.tsx focus-return regression (real, untested consumer)', () => {
  it('returns focus to the trigger on Escape, not <body>', () => {
    render(<Harness />);
    const trigger = screen.getByTestId('add-card-trigger');
    trigger.focus();
    fireEvent.click(trigger);

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
    expect(document.activeElement).not.toBe(document.body);
  });
});
