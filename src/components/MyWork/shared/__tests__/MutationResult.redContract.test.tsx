import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotebookAttachmentsSection } from '../../notebook/NotebookAttachmentsSection';
import { AttachmentsSection } from '../AttachmentsSection';
import { CommentsSection } from '../CommentsSection';
import { LinkedItemsSection } from '../LinkedItemsSection';

const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock('react-hot-toast', () => ({
  default: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string | { count?: number }) =>
      typeof fallback === 'string' ? fallback : '',
    i18n: { language: 'en' },
  }),
}));

vi.mock('@/services/api', () => ({
  Api: {
    downloadNotebookAttachment: vi.fn(),
  },
}));

describe('MyWork mutation result contract (red contract)', () => {
  beforeEach(() => {
    toastSuccess.mockReset();
    toastError.mockReset();
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true)
    );
  });

  it('does not announce comment success when the mutation has no positive result', async () => {
    render(
      <CommentsSection
        comments={[]}
        expanded
        onAddComment={async () => ({ ok: false, error: new Error('not persisted') })}
        onDeleteComment={async () => ({ ok: true })}
        onLikeComment={async () => ({ ok: true })}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('Write a comment...'), {
      target: { value: 'not persisted' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it('announces comment success exactly once after a positive mutation result', async () => {
    render(
      <CommentsSection
        comments={[]}
        expanded
        onAddComment={async () => ({ ok: true })}
        onDeleteComment={async () => ({ ok: true })}
        onLikeComment={async () => ({ ok: true })}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('Write a comment...'), {
      target: { value: 'persisted' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledTimes(1));
    expect(toastError).not.toHaveBeenCalled();
  });

  it('preserves notebook upload success through the typed adapter', async () => {
    const onUpload = vi.fn(async () => undefined);
    const { container } = render(
      <NotebookAttachmentsSection
        noteId="note-1"
        attachments={[]}
        onUpload={onUpload}
        onDelete={async () => undefined}
      />
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['content'], 'evidence.txt', { type: 'text/plain' });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(onUpload).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledTimes(1));
    expect(toastError).not.toHaveBeenCalled();
  });

  it('preserves notebook upload failure instead of adapting it to success', async () => {
    const failure = new Error('notebook upload failed');
    const { container } = render(
      <NotebookAttachmentsSection
        noteId="note-1"
        attachments={[]}
        onUpload={async () => Promise.reject(failure)}
        onDelete={async () => undefined}
      />
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['content'], 'evidence.txt', { type: 'text/plain' });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it.each([
    {
      label: 'failure',
      result: { ok: false as const, error: new Error('upload failed') },
      successCount: 0,
      errorCount: 1,
    },
    { label: 'success', result: { ok: true as const }, successCount: 1, errorCount: 0 },
  ])(
    'announces attachment upload $label from its mutation result',
    async ({ result, successCount, errorCount }) => {
      const { container } = render(
        <AttachmentsSection
          attachments={[]}
          expanded
          onUpload={async () => result}
          onDelete={async () => ({ ok: true })}
        />
      );
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;

      fireEvent.change(input, {
        target: { files: [new File(['content'], 'contract.txt', { type: 'text/plain' })] },
      });

      await waitFor(() =>
        expect(toastSuccess.mock.calls.length + toastError.mock.calls.length).toBe(1)
      );
      expect(toastSuccess).toHaveBeenCalledTimes(successCount);
      expect(toastError).toHaveBeenCalledTimes(errorCount);
    }
  );

  it.each([
    {
      label: 'failure',
      result: { ok: false as const, error: new Error('remove failed') },
      successCount: 0,
      errorCount: 1,
    },
    { label: 'success', result: { ok: true as const }, successCount: 1, errorCount: 0 },
  ])(
    'announces linked-item removal $label from its mutation result',
    async ({ result, successCount, errorCount }) => {
      render(
        <LinkedItemsSection
          items={[{ id: 'linked-1', type: 'task', title: 'Linked task' }]}
          expanded
          onRemove={async () => result}
        />
      );

      fireEvent.click(screen.getByTitle('Remove link'));

      await waitFor(() =>
        expect(toastSuccess.mock.calls.length + toastError.mock.calls.length).toBe(1)
      );
      expect(toastSuccess).toHaveBeenCalledTimes(successCount);
      expect(toastError).toHaveBeenCalledTimes(errorCount);
    }
  );
});
