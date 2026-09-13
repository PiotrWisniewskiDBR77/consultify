/** @vitest-environment jsdom */
import { act, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { installFetchStub, renderHub } from '../smoke/hubSmokeHarness';

beforeEach(() => {
  installFetchStub();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Notebook parent resolution independent routing gate review', () => {
  it('does not mount an unscoped workspace while the parent read is pending', async () => {
    let resolvePage!: (page: unknown) => void;
    const pending = new Promise((resolve) => {
      resolvePage = resolve;
    });
    const readPage = vi.spyOn(Api, 'getNotebookPage').mockReturnValue(pending);
    vi.spyOn(Api, 'getNotebook').mockResolvedValue({ id: 'parent-b', title: 'Parent B' });
    const { MyWorkHub } = await import('@/components/MyWork/MyWorkHub');
    renderHub(<MyWorkHub />, '/my-work/notebook/page-b');
    await waitFor(() => expect(readPage).toHaveBeenCalledWith('page-b'));
    expect(screen.queryByTestId('stub-notebook-content')).not.toBeInTheDocument();
    await act(async () => {
      resolvePage({ id: 'page-b', notebookId: 'parent-b' });
    });
    await waitFor(() =>
      expect(screen.getByTestId('stub-notebook-content')).toHaveAttribute(
        'data-notebook-id',
        'parent-b'
      )
    );
    await waitFor(() => {
      expect(screen.getByTestId('stub-notebook-content')).toHaveAttribute(
        'data-notebook-id',
        'parent-b'
      );
      expect(screen.getByTestId('stub-notebook-content')).toHaveAttribute(
        'data-open-page-id',
        'page-b'
      );
    });
  });

  it('does not fall back to an all-pages workspace after a denied page read', async () => {
    vi.spyOn(Api, 'getNotebookPage').mockRejectedValue(
      Object.assign(new Error('Forbidden'), { status: 403 })
    );
    const { MyWorkHub } = await import('@/components/MyWork/MyWorkHub');
    renderHub(<MyWorkHub />, '/my-work/notebook/denied-page');
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByTestId('stub-notebook-content')).not.toBeInTheDocument();
  });
});
