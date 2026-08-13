/**
 * @vitest-environment jsdom
 *
 * A11Y-BACKLOG (table) batch 3 — RefineDialog, IntakeJwtPanel,
 * RecordExpandModal converted onto the shared `useDialogA11y` contract.
 *
 * RefineDialog and RecordExpandModal each had a bespoke
 * `useEffect(() => someRef.current?.focus(), [])`-style focus-on-open
 * effect that ran BEFORE (or independent of) useDialogA11y's own
 * pre-open-element capture — the same class of race as native `autoFocus`.
 * Both now use `initialFocusRef` instead.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    get() {
      return document.body;
    },
    configurable: true,
  });
});

vi.mock('react-hot-toast', () => {
  const fn = vi.fn();
  return { default: Object.assign(fn, { success: vi.fn(), error: vi.fn() }) };
});

vi.mock('@/services/api/tablePlatform.api', () => ({
  getRecord: vi.fn(async () => ({ data: { name: 'Record 1' } })),
  getTable: vi.fn(async () => ({ name: 'Table 1', fields: [] })),
  updateRecord: vi.fn(async () => ({})),
  getFormIntakeContext: vi.fn(async () => null),
  issueFormIntakeJwt: vi.fn(async () => ({})),
  setFormIntakeAllowList: vi.fn(async () => ({})),
}));

import { IntakeJwtPanel } from '../forms/IntakeJwtPanel';
import { RecordExpandModal } from '../RecordExpandModal';
import { RefineDialog } from '../RefineDialog';

function Harness({
  children,
}: {
  children: (open: boolean, onClose: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <div>
      <button data-testid="trigger" onClick={() => setOpen(true)}>
        Open
      </button>
      {children(open, () => setOpen(false))}
    </div>
  );
}

async function openAndAssertDialog(name: RegExp) {
  const trigger = screen.getByTestId('trigger');
  trigger.focus();
  fireEvent.click(trigger);
  const dialog = await screen.findByRole('dialog');
  expect(dialog).toHaveAttribute('aria-modal', 'true');
  expect(dialog).toHaveAccessibleName(name);
  return { trigger, dialog };
}

async function assertEscapeClosesAndRestoresFocus(trigger: HTMLElement) {
  fireEvent.keyDown(document, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await waitFor(() => expect(document.activeElement).toBe(trigger));
}

describe('RefineDialog — dialog a11y contract', () => {
  const renderIt = (onClose: () => void) =>
    render(
      <RefineDialog
        proposalSummary="Summary"
        proposalIntent="add_field"
        currentVersion={1}
        refinementHistory={[]}
        onRefine={async () => {}}
        onClose={onClose}
      />
    );

  it('has role=dialog, aria-modal, and an accessible name', () => {
    const onClose = vi.fn();
    renderIt(onClose);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName(/Refine Proposal/i);
  });

  it('focuses the refinement textarea on open (not via a bespoke focus effect)', async () => {
    const onClose = vi.fn();
    renderIt(onClose);
    await waitFor(() => {
      expect(document.activeElement?.tagName).toBe('TEXTAREA');
    });
  });

  it('Escape calls onClose', () => {
    const onClose = vi.fn();
    renderIt(onClose);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});

describe('IntakeJwtPanel — dialog a11y contract', () => {
  it('has role=dialog and aria-modal (accessible name via existing aria-label)', () => {
    const onClose = vi.fn();
    render(
      <IntakeJwtPanel
        formId="form-1"
        configuredFields={[]}
        baseUrl="https://app.consultify.io"
        onClose={onClose}
        testInitialContext={null}
      />
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('Form intake settings');
  });

  it('Escape calls onClose', () => {
    const onClose = vi.fn();
    render(
      <IntakeJwtPanel
        formId="form-1"
        configuredFields={[]}
        baseUrl="https://app.consultify.io"
        onClose={onClose}
        testInitialContext={null}
      />
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});

describe('RecordExpandModal — dialog a11y contract', () => {
  it('has role=dialog, aria-modal, and an accessible name; Escape closes and restores focus', async () => {
    render(
      <Harness>
        {(open, onClose) => (
          <RecordExpandModal open={open} onClose={onClose} recordId="rec-1" tableId="tbl-1" />
        )}
      </Harness>
    );
    const { trigger } = await openAndAssertDialog(/Record 1|rec-1/i);
    await assertEscapeClosesAndRestoresFocus(trigger);
  });
});
