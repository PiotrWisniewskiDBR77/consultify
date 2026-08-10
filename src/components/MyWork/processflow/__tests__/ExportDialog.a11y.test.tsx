/**
 * @vitest-environment jsdom
 *
 * E14-A11Y-02 (P1) — ExportDialog is Process Flow's only true modal
 * (EdgeStylePopover/AIProposalPanel/ProcessFlowPropertiesPanel/ReadbackPanel
 * are non-modal panels/popovers, out of scope by design). It renders via
 * the shared `@/components/ui/dialog` primitive, which had zero a11y
 * wiring — fixed at the primitive level (see
 * `src/components/ui/__tests__/dialog.a11y.test.tsx`). This test proves the
 * fix actually reaches this real consumer, not just the primitive in
 * isolation.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { ExportDialog } from '../ExportDialog';

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

describe('ExportDialog (processflow) — a11y dialog contract', () => {
  it('exposes role=dialog with an accessible name', () => {
    render(
      <ExportDialog open onClose={vi.fn()} onExport={vi.fn()} isExporting={false} isPl={false} />
    );
    expect(screen.getByRole('dialog', { name: /Export process/i })).toBeInTheDocument();
  });

  it('Escape closes it', () => {
    const onClose = vi.fn();
    render(
      <ExportDialog open onClose={onClose} onExport={vi.fn()} isExporting={false} isPl={false} />
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('returns focus to the trigger after Escape', async () => {
    render(
      <Trigger>
        {(open, close) =>
          open && (
            <ExportDialog
              open
              onClose={close}
              onExport={vi.fn()}
              isExporting={false}
              isPl={false}
            />
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
