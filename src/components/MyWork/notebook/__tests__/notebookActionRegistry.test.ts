import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { getNotebookActionContract } from '../notebookActionRegistry';
import { buildNotebookMenuActions, NotebookHamburgerMenu } from '../NotebookHamburgerMenu';

describe('MYW-NBK-006 Notebook action registry', () => {
  it('covers every fully populated canonical note-menu action', () => {
    const actions = buildNotebookMenuActions({
      x: 0,
      y: 0,
      isPolish: false,
      onClose: vi.fn(),
      onExport: vi.fn(),
      onSources: vi.fn(),
      onVerification: vi.fn(),
      onShare: vi.fn(),
      onExpandDocument: vi.fn(),
      onGraph: vi.fn(),
      onConvert: vi.fn(),
      onAskAI: vi.fn(),
      onDelete: vi.fn(),
    });

    expect(actions.length).toBeGreaterThan(10);
    expect(actions.every((action) => action.contract.id === action.id)).toBe(true);
    expect(new Set(actions.map((action) => action.id)).size).toBe(actions.length);
  });

  it('fails closed for an unregistered action and types dynamic conversions', () => {
    expect(getNotebookActionContract('invented-action')).toBeNull();
    expect(getNotebookActionContract('convert-initiative')).toMatchObject({
      execution: 'governed-api',
      permission: 'server-authoritative',
      outcome: 'server-receipt-required',
      duplicatePolicy: 'idempotency-required',
    });
  });

  it('does not misrepresent the email-client Share handoff as a durable server write', () => {
    expect(getNotebookActionContract('share')).toMatchObject({
      execution: 'local-navigation',
      permission: 'page-read',
      outcome: 'visible-panel',
      duplicatePolicy: 'n/a',
    });
  });

  it('renders contract metadata and invokes exactly one registered handler', async () => {
    const onVerification = vi.fn();
    const onClose = vi.fn();
    render(
      React.createElement(NotebookHamburgerMenu, {
        x: 0,
        y: 0,
        isPolish: false,
        onClose,
        onVerification,
      })
    );

    const item = screen.getByRole('menuitem', { name: 'Verification & review' });
    expect(item).toHaveAttribute('data-notebook-action-id', 'verification');
    expect(item).toHaveAttribute('data-notebook-action-permission', 'page-read');
    expect(item).toHaveAttribute('data-notebook-action-outcome', 'visible-panel');
    await userEvent.click(item);
    expect(onVerification).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('locks durable actions synchronously and requires a typed receipt', async () => {
    let resolveDelete: ((value: { receiptId: string }) => void) | undefined;
    const onDelete = vi.fn(
      () =>
        new Promise<{ receiptId: string }>((resolve) => {
          resolveDelete = resolve;
        })
    );
    const onClose = vi.fn();
    render(
      React.createElement(NotebookHamburgerMenu, {
        x: 0,
        y: 0,
        isPolish: false,
        onClose,
        onDelete,
        receiptCapableActionIds: ['delete'],
      })
    );

    const item = screen.getByRole('menuitem', { name: 'Delete note' });
    fireEvent.click(item);
    fireEvent.click(item);
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(item).toHaveAttribute('aria-busy', 'true');

    resolveDelete?.({ receiptId: 'delete-receipt-1' });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('keeps the menu open on failure and retries through the same executor', async () => {
    const onDelete = vi
      .fn()
      .mockRejectedValueOnce(new Error('Delete was not confirmed'))
      .mockResolvedValueOnce({ receiptId: 'delete-receipt-2' });
    const onClose = vi.fn();
    render(
      React.createElement(NotebookHamburgerMenu, {
        x: 0,
        y: 0,
        isPolish: false,
        onClose,
        onDelete,
        receiptCapableActionIds: ['delete'],
      })
    );

    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete note' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Delete was not confirmed');
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onDelete).toHaveBeenCalledTimes(2);
  });

  it('disables durable actions before mutation when no backend receipt is qualified', () => {
    const onDelete = vi.fn();
    render(
      React.createElement(NotebookHamburgerMenu, {
        x: 0,
        y: 0,
        isPolish: false,
        onClose: vi.fn(),
        onDelete,
      })
    );

    const item = screen.getByRole('menuitem', { name: 'Delete note' });
    expect(item).not.toBeDisabled();
    expect(item).toHaveAttribute('aria-disabled', 'true');
    expect(item).toHaveAttribute('data-notebook-action-receipt-ready', 'false');
    expect(item).toHaveAccessibleDescription(expect.stringContaining('durable action receipt'));
    expect(screen.getByText(/Unavailable until the server can return/i)).toBeVisible();
    fireEvent.click(item);
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('supports menu keyboard navigation and restores focus to the trigger', async () => {
    const user = userEvent.setup();
    const trigger = document.createElement('button');
    trigger.textContent = 'Open note actions';
    document.body.appendChild(trigger);
    trigger.focus();
    const onClose = vi.fn();
    const view = render(
      React.createElement(NotebookHamburgerMenu, {
        x: 9999,
        y: 9999,
        isPolish: false,
        onClose,
        onExport: vi.fn(),
        onVerification: vi.fn(),
        onDelete: vi.fn(),
      })
    );

    const menu = screen.getByRole('menu', { name: 'Note actions' });
    expect(menu).toHaveStyle({ maxHeight: 'calc(100vh - 16px)' });
    await waitFor(() => expect(screen.getByRole('menuitem', { name: 'Export' })).toHaveFocus());
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Verification & review' })).toHaveFocus();
    await user.keyboard('{End}');
    expect(screen.getByRole('menuitem', { name: 'Delete note' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(trigger).toHaveFocus();
    trigger.remove();
  });
});
