/**
 * PulseItemPickerModal — Modal.tsx regression check (RN-G5 platform lane,
 * 2026-08-12).
 *
 * No pre-existing test coverage (confirmed by `find tests -iname
 * "*PulseItemPickerModal*"` returning nothing before this file). Real
 * consumer of `src/components/ui/primitives/Modal.tsx` opened via a plain
 * `open` boolean prop (like most callers), from a persistent trigger
 * (`NotebookLibraryContent`'s "browse all" button). Proves the Esc
 * focus-return fix (P1 nr 2) holds for this consumer too.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React, { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { PulseItemPickerModal } from '../../../src/components/MyWork/notebook/PulseItemPickerModal';

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(async () => []),
  },
}));

vi.mock('@/services/funnelAnalytics', () => ({
  trackFunnelEvent: vi.fn(),
}));

const Harness: React.FC = () => {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" data-testid="browse-trigger" onClick={() => setOpen(true)}>
        Browse all
      </button>
      <PulseItemPickerModal
        open={open}
        onClose={() => setOpen(false)}
        type="task"
        onInsertReference={vi.fn()}
      />
    </div>
  );
};

describe('PulseItemPickerModal · Modal.tsx focus-return regression (real, untested consumer)', () => {
  it('returns focus to the persistent trigger on Escape, not <body>', async () => {
    render(<Harness />);
    const trigger = screen.getByTestId('browse-trigger');
    trigger.focus();
    fireEvent.click(trigger);

    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(document.activeElement).toBe(trigger);
    expect(document.activeElement).not.toBe(document.body);
  });
});
