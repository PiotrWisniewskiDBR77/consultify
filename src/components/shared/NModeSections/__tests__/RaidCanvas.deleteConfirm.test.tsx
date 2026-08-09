/**
 * @vitest-environment jsdom
 *
 * CB-01 / RB-038 — RAID deletion must be a named, keyboard-reachable action
 * that requires explicit confirmation with Cancel, never a hover-only
 * immediate delete.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

// jsdom never computes layout, so `offsetParent` is always null — the shared
// Modal's Tab-trap filters on it to skip hidden elements. Stub it here so the
// visible-element filter behaves as it would in a real browser (same shim
// used by useDialogA11y.test.tsx).
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    get() {
      return document.body;
    },
    configurable: true,
  });
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, optsOrDefault?: any) => {
      const opts = typeof optsOrDefault === 'object' ? optsOrDefault : undefined;
      if (opts?.returnObjects) return [];
      const fallback =
        typeof optsOrDefault === 'string' ? optsOrDefault : (opts?.defaultValue ?? key);
      if (!opts) return fallback;
      return Object.keys(opts).reduce(
        (str, k) => str.replace(`{{${k}}}`, String(opts[k])),
        fallback
      );
    },
  }),
}));

vi.mock('@/components/shared/AIFieldEnhancer', () => ({
  AIFieldEnhancer: () => null,
}));

import { RaidCanvas, type RaidItem } from '../RaidCanvas';

const ITEM: RaidItem = {
  id: 'raid-1',
  type: 'risk',
  title: 'Vendor delivery slippage',
  impact: 'high',
  status: 'open',
};

const renderCanvas = (onRemoveItem = vi.fn()) => {
  render(
    <RaidCanvas
      items={[ITEM]}
      onAddItem={vi.fn()}
      onUpdateItem={vi.fn()}
      onRemoveItem={onRemoveItem}
      artifactContext={{ title: 'Initiative X', status: 'open', priority: 'high', type: 'risk' }}
      fieldKeyPrefix="test"
    />
  );
  return onRemoveItem;
};

describe('RaidCanvas — RB-038 delete confirmation contract', () => {
  it('names the delete action with the item title instead of an unnamed icon button', () => {
    renderCanvas();
    expect(
      screen.getByRole('button', { name: /Delete Vendor delivery slippage/i })
    ).toBeInTheDocument();
  });

  it('does not remove the item on click — it opens a confirm dialog with Cancel first', () => {
    const onRemoveItem = renderCanvas();
    fireEvent.click(screen.getByRole('button', { name: /Delete Vendor delivery slippage/i }));

    expect(onRemoveItem).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
  });

  it('cancelling the confirm dialog leaves the item intact', async () => {
    const onRemoveItem = renderCanvas();
    fireEvent.click(screen.getByRole('button', { name: /Delete Vendor delivery slippage/i }));
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(onRemoveItem).not.toHaveBeenCalled();
  });

  it('confirming the dialog calls onRemoveItem exactly once with the item id', async () => {
    const onRemoveItem = renderCanvas();
    fireEvent.click(screen.getByRole('button', { name: /Delete Vendor delivery slippage/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Delete$/i }));

    await waitFor(() => expect(onRemoveItem).toHaveBeenCalledTimes(1));
    expect(onRemoveItem).toHaveBeenCalledWith('raid-1');
  });

  it('Escape closes the confirm dialog without deleting', async () => {
    const onRemoveItem = renderCanvas();
    fireEvent.click(screen.getByRole('button', { name: /Delete Vendor delivery slippage/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(onRemoveItem).not.toHaveBeenCalled();
  });

  it('focus enters the dialog on open', async () => {
    renderCanvas();
    const trigger = screen.getByRole('button', { name: /Delete Vendor delivery slippage/i });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = screen.getByRole('dialog');
    await waitFor(() => expect(dialog).toHaveFocus());
  });

  it('returns focus to the delete trigger after Cancel', async () => {
    renderCanvas();
    const trigger = screen.getByRole('button', { name: /Delete Vendor delivery slippage/i });
    trigger.focus();
    fireEvent.click(trigger);

    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('returns focus to the delete trigger after Escape', async () => {
    renderCanvas();
    const trigger = screen.getByRole('button', { name: /Delete Vendor delivery slippage/i });
    trigger.focus();
    fireEvent.click(trigger);

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('traps Tab inside the confirm dialog: Tab on the last control cycles to the first', () => {
    renderCanvas();
    fireEvent.click(screen.getByRole('button', { name: /Delete Vendor delivery slippage/i }));

    // The dialog's focusable order is [header Close X, Cancel, Delete] —
    // assert against the dialog's own first/last focusable, not an assumed
    // control, so this stays correct if the header close button is ever
    // removed for this particular confirm dialog.
    const dialog = screen.getByRole('dialog');
    const focusable = dialog.querySelectorAll('button');
    const firstControl = focusable[0] as HTMLElement;
    const lastControl = focusable[focusable.length - 1] as HTMLElement;
    expect(lastControl).toHaveAccessibleName(/^Delete$/);

    lastControl.focus();
    expect(lastControl).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(firstControl).toHaveFocus();
  });

  it('traps Shift+Tab inside the confirm dialog: Shift+Tab on the first control cycles to the last', () => {
    renderCanvas();
    fireEvent.click(screen.getByRole('button', { name: /Delete Vendor delivery slippage/i }));

    const dialog = screen.getByRole('dialog');
    const focusable = dialog.querySelectorAll('button');
    const firstControl = focusable[0] as HTMLElement;
    const lastControl = focusable[focusable.length - 1] as HTMLElement;

    firstControl.focus();
    expect(firstControl).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(lastControl).toHaveFocus();
  });
});
