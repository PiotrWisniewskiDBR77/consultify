/**
 * @vitest-environment jsdom
 *
 * A11Y-BACKLOG (table) batch 1 — ShareViewDialog, KeyboardShortcutsPanel,
 * DistributionBuilder, TemplateGallery converted onto the shared
 * `useDialogA11y` contract: named `role="dialog"`, `aria-modal`,
 * Escape-to-close, focus enters on open, focus restored to the trigger on
 * close.
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
  listDistributions: vi.fn(async () => []),
  createDistribution: vi.fn(async () => ({})),
  deleteDistribution: vi.fn(async () => ({})),
  toggleDistribution: vi.fn(async () => ({})),
  executeDistribution: vi.fn(async () => ({})),
  unshareView: vi.fn(async () => ({})),
  shareView: vi.fn(async () => ({ token: 'tok' })),
}));

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(async () => ({ templates: [] })),
    post: vi.fn(async () => ({})),
  },
}));

import { DistributionBuilder } from '../DistributionBuilder';
import { KeyboardShortcutsPanel } from '../KeyboardShortcutsPanel';
import { ShareViewDialog } from '../ShareViewDialog';
import { TemplateGallery } from '../TemplateGallery';

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

describe('ShareViewDialog — dialog a11y contract', () => {
  it('has role=dialog, aria-modal, and an accessible name; Escape closes and restores focus', async () => {
    render(
      <Harness>
        {(open, onClose) =>
          open ? (
            <ShareViewDialog
              viewId="view-1"
              viewName="My View"
              onClose={onClose}
              onUpdated={() => {}}
            />
          ) : null
        }
      </Harness>
    );
    const { trigger } = await openAndAssertDialog(/Share View/i);
    await assertEscapeClosesAndRestoresFocus(trigger);
  });
});

describe('KeyboardShortcutsPanel — dialog a11y contract', () => {
  it('has role=dialog, aria-modal, and an accessible name; Escape closes and restores focus', async () => {
    render(
      <Harness>{(open, onClose) => <KeyboardShortcutsPanel open={open} onClose={onClose} />}</Harness>
    );
    const { trigger } = await openAndAssertDialog(/Keyboard Shortcuts/i);
    await assertEscapeClosesAndRestoresFocus(trigger);
  });
});

describe('DistributionBuilder — dialog a11y contract', () => {
  it('has role=dialog, aria-modal, and an accessible name; Escape closes and restores focus', async () => {
    render(
      <Harness>
        {(open, onClose) =>
          open ? <DistributionBuilder baseId="base-1" onClose={onClose} /> : null
        }
      </Harness>
    );
    const { trigger } = await openAndAssertDialog(/Distributions/i);
    await assertEscapeClosesAndRestoresFocus(trigger);
  });
});

describe('TemplateGallery — dialog a11y contract', () => {
  it('has role=dialog, aria-modal, and an accessible name; Escape closes and restores focus', async () => {
    render(
      <Harness>
        {(open, onClose) =>
          open ? <TemplateGallery workspaceId="ws-1" onClose={onClose} /> : null
        }
      </Harness>
    );
    const { trigger } = await openAndAssertDialog(/Template Gallery/i);
    await assertEscapeClosesAndRestoresFocus(trigger);
  });
});
