import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AttachmentsSection } from '../AttachmentsSection';

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
    t: (key: string, fallback?: string, opts?: Record<string, unknown>) => {
      if (typeof fallback !== 'string') return key;
      // Interpolate {{token}} so the too-large message carries the real file name.
      return fallback.replace(/\{\{(\w+)\}\}/g, (_m, p1) => String(opts?.[p1] ?? ''));
    },
    i18n: { language: 'en' },
  }),
}));

/** A File whose `size` reports `bytes` without allocating the content. */
function fileOfSize(name: string, bytes: number, type = 'application/octet-stream'): File {
  const f = new File(['x'], name, { type });
  Object.defineProperty(f, 'size', { value: bytes });
  return f;
}

function dropFiles(target: Element, files: File[]) {
  fireEvent.drop(target, { dataTransfer: { files } });
}

describe('K-29 — task attachments drag & drop on the whole card', () => {
  beforeEach(() => {
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it('uploads a small file dropped on a COLLAPSED card (K-29 regression: drop used to fall through to the browser)', async () => {
    const onUpload = vi.fn(async () => ({ ok: true as const }));
    const onToggleExpand = vi.fn();
    render(
      <AttachmentsSection
        attachments={[]}
        expanded={false}
        onUpload={onUpload}
        onDelete={async () => ({ ok: true })}
        onToggleExpand={onToggleExpand}
      />
    );

    // The section is collapsed: the inner dashed zone is NOT in the DOM, so the only
    // possible drop target is the outer card. Before the fix the card had no drop
    // handler at all and the browser opened the file instead of uploading.
    expect(screen.queryByText('Drag files here or click to upload')).toBeNull();
    const card = screen.getByTestId('attachments-card');
    const small = fileOfSize('note.txt', 2 * 1024, 'text/plain');

    dropFiles(card, [small]);

    await waitFor(() => expect(onUpload).toHaveBeenCalledTimes(1));
    const passed = onUpload.mock.calls[0][0] as ArrayLike<File>;
    expect(Array.from(passed).map((f) => f.name)).toEqual(['note.txt']);
    // The card auto-expands so the user sees the result instead of nothing.
    expect(onToggleExpand).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledTimes(1));
    expect(toastError).not.toHaveBeenCalled();
  });

  it('rejects an over-limit file with a message and does NOT upload it', async () => {
    const onUpload = vi.fn(async () => ({ ok: true as const }));
    render(
      <AttachmentsSection
        attachments={[]}
        expanded={false}
        maxSizeMB={25}
        onUpload={onUpload}
        onDelete={async () => ({ ok: true })}
        onToggleExpand={vi.fn()}
      />
    );

    const card = screen.getByTestId('attachments-card');
    const huge = fileOfSize('movie.mp4', 26 * 1024 * 1024);

    dropFiles(card, [huge]);

    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
    expect(toastError.mock.calls[0][0]).toContain('movie.mp4');
    expect(onUpload).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it('uploads exactly once when dropped on an EXPANDED card (inner zone must not double-handle)', async () => {
    const onUpload = vi.fn(async () => ({ ok: true as const }));
    render(
      <AttachmentsSection
        attachments={[]}
        expanded
        onUpload={onUpload}
        onDelete={async () => ({ ok: true })}
        onToggleExpand={vi.fn()}
      />
    );

    const card = screen.getByTestId('attachments-card');
    dropFiles(card, [fileOfSize('small.txt', 1024, 'text/plain')]);

    await waitFor(() => expect(onUpload).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledTimes(1));
  });
});
