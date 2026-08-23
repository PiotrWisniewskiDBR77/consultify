import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { IdeaDocumentTabRename } from '../IdeaDocumentTabRename';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));

function renderRename(name: string, persist: (ideaId: string, nextName: string) => Promise<void>) {
  return render(
    <IdeaDocumentTabRename
      ideaId="idea-1"
      name={name}
      onPersist={persist}
      renderActivator={({ ref, onDoubleClick, onKeyDown }) => (
        <button ref={ref} type="button" onDoubleClick={onDoubleClick} onKeyDown={onKeyDown}>
          {name}
        </button>
      )}
    />
  );
}

describe('IdeaDocumentTabRename', () => {
  it('selects on double-click and commits a trimmed name with Enter', async () => {
    const persist = vi.fn().mockResolvedValue(undefined);
    renderRename('Old', persist);

    fireEvent.doubleClick(screen.getByText('Old'));
    const input = screen.getByRole('textbox', { name: 'Rename idea tab' });
    expect(input).toHaveFocus();
    fireEvent.change(input, { target: { value: '  New name  ' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(persist).toHaveBeenCalledWith('idea-1', 'New name'));
    await waitFor(() => expect(screen.queryByRole('textbox')).not.toBeInTheDocument());
  });

  it('cancels with Escape without persisting', () => {
    const persist = vi.fn();
    renderRename('Original', persist);
    fireEvent.doubleClick(screen.getByText('Original'));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Discard me' } });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });

    expect(persist).not.toHaveBeenCalled();
    expect(screen.getByText('Original')).toBeInTheDocument();
  });

  it('commits on blur and prevents duplicate blur/Enter submissions', async () => {
    let resolve!: () => void;
    const persist = vi.fn(() => new Promise<void>((done) => (resolve = done)));
    renderRename('Old', persist);
    fireEvent.doubleClick(screen.getByText('Old'));
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Blurred' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.blur(input);
    expect(persist).toHaveBeenCalledOnce();
    resolve();
    await waitFor(() => expect(screen.queryByRole('textbox')).not.toBeInTheDocument());
  });

  it('keeps the draft and exposes Retry after a failed save', async () => {
    const persist = vi
      .fn()
      .mockRejectedValueOnce(new Error('conflict'))
      .mockResolvedValueOnce(undefined);
    renderRename('Old', persist);
    fireEvent.doubleClick(screen.getByText('Old'));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Preserved' } });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });

    await waitFor(() => expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument());
    expect(screen.getByRole('textbox')).toHaveValue('Preserved');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(persist).toHaveBeenCalledTimes(2));
  });

  it('starts with F2, reports a conflict and restores focus after Escape', async () => {
    const conflict = Object.assign(new Error('stale'), { status: 409 });
    const persist = vi.fn().mockRejectedValue(conflict);
    renderRename('Old', persist);
    const activator = screen.getByRole('button', { name: 'Old' });
    activator.focus();
    fireEvent.keyDown(activator, { key: 'F2' });
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Local draft' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Name changed elsewhere. Draft retained.')
    );
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Old' })).toHaveFocus());
  });

  it('never nests the editor or Retry inside the tab activator', async () => {
    const persist = vi.fn().mockRejectedValue(new Error('offline'));
    renderRename('Old', persist);
    fireEvent.doubleClick(screen.getByRole('button', { name: 'Old' }));
    expect(screen.queryByRole('button', { name: 'Old' })).not.toBeInTheDocument();
    const input = screen.getByRole('textbox');
    expect(input.closest('button')).toBeNull();
    fireEvent.change(input, { target: { value: 'Draft' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Retry' }).closest('button')?.parentElement).not.toBe(
      screen.queryByRole('button', { name: 'Old' })
    );
  });
});
