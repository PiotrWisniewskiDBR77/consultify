/**
 * @vitest-environment jsdom
 *
 * My Work cold-deep-link regression. The canonical hub renders its approved
 * flat navigation and no longer consumes the retired two-level-nav flag.
 * This file keeps the server-truth Notebook title assertion introduced with
 * the deep-link repair; it intentionally makes no assertion about the retired
 * visual experiment.
 */
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  installFetchStub,
  renderHub,
  resetHubSmokeIdentity,
  setHubSmokeIdentity,
} from '../smoke/hubSmokeHarness';
import { Api } from '@/services/api';

beforeEach(() => {
  resetHubSmokeIdentity();
  installFetchStub();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('MyWorkHub — Notebook cold deep link', () => {
  it('loads the server-truth notebook title once on a cold deep link', async () => {
    const getNotebook = vi.spyOn(Api, 'getNotebook').mockResolvedValue({
      id: 'notebook-1',
      title: 'Server Truth Notebook',
    });
    const { MyWorkHub } = await import('@/components/MyWork/MyWorkHub');

    renderHub(<MyWorkHub />, '/my-work/notebook?notebook=notebook-1');

    await waitFor(() => {
      expect(screen.getByTestId('stub-notebook-content')).toHaveTextContent(
        'Server Truth Notebook'
      );
    });
    expect(getNotebook).toHaveBeenCalledTimes(1);
    expect(getNotebook).toHaveBeenCalledWith('notebook-1');
  });

  it('resolves a contained page-only alias to its parent notebook workspace', async () => {
    vi.spyOn(Api, 'getNotebookPage').mockResolvedValue({
      id: 'page-b',
      notebookId: 'notebook-b',
      title: 'Same title',
    });
    vi.spyOn(Api, 'getNotebook').mockResolvedValue({
      id: 'notebook-b',
      title: 'Parent B',
    });
    const { MyWorkHub } = await import('@/components/MyWork/MyWorkHub');

    renderHub(<MyWorkHub />, '/my-work/notebook/page-b');

    await waitFor(() => {
      expect(screen.getByTestId('stub-notebook-content')).toHaveAttribute(
        'data-notebook-id',
        'notebook-b'
      );
    });
    expect(screen.getByTestId('stub-notebook-content')).toHaveAttribute(
      'data-open-page-id',
      'page-b'
    );
  });

  it('keeps a truly container-less page-only alias reachable', async () => {
    vi.spyOn(Api, 'getNotebookPage').mockResolvedValue({
      id: 'orphan-page',
      notebookId: null,
      title: 'Imported note',
    });
    const { MyWorkHub } = await import('@/components/MyWork/MyWorkHub');

    renderHub(<MyWorkHub />, '/my-work/notebook/orphan-page');

    await waitFor(() => {
      expect(Api.getNotebookPage).toHaveBeenCalledWith('orphan-page');
    });
    expect(screen.getByTestId('stub-notebook-content')).toHaveAttribute(
      'data-notebook-id',
      ''
    );
    expect(screen.getByTestId('stub-notebook-content')).toHaveAttribute(
      'data-open-page-id',
      'orphan-page'
    );
  });

  it('verifies and opens the canonical notebook and page path', async () => {
    const getNotebookPage = vi.spyOn(Api, 'getNotebookPage').mockResolvedValue({
      id: 'page-b',
      notebookId: 'notebook-b',
      title: 'Same title',
    });
    vi.spyOn(Api, 'getNotebook').mockResolvedValue({
      id: 'notebook-b',
      title: 'Parent B',
    });
    const { MyWorkHub } = await import('@/components/MyWork/MyWorkHub');

    renderHub(<MyWorkHub />, '/my-work/notebook/notebook-b/page-b');

    await waitFor(() => {
      expect(screen.getByTestId('stub-notebook-content')).toHaveAttribute(
        'data-notebook-id',
        'notebook-b'
      );
    });
    expect(screen.getByTestId('stub-notebook-content')).toHaveAttribute(
      'data-open-page-id',
      'page-b'
    );
    expect(getNotebookPage).toHaveBeenCalledWith('page-b');
  });

  it('uses the persisted parent over a stale query and a mismatched path parent', async () => {
    vi.spyOn(Api, 'getNotebookPage').mockResolvedValue({
      id: 'page-b',
      notebookId: 'notebook-b',
      title: 'Same title',
    });
    vi.spyOn(Api, 'getNotebook').mockResolvedValue({ id: 'notebook-b', title: 'Parent B' });
    const { MyWorkHub } = await import('@/components/MyWork/MyWorkHub');

    renderHub(
      <MyWorkHub />,
      '/my-work/notebook/notebook-a/page-b?notebook=notebook-a&keep=context#section'
    );

    await waitFor(() => {
      expect(screen.getByTestId('stub-notebook-content')).toHaveAttribute(
        'data-notebook-id',
        'notebook-b'
      );
    });
    expect(screen.getByTestId('hub-router-location')).toHaveTextContent(
      '/my-work/notebook/notebook-b/page-b?keep=context#section'
    );
  });

  it('does not mount the unscoped page list when the page read is denied', async () => {
    vi.spyOn(Api, 'getNotebookPage').mockRejectedValue(
      Object.assign(new Error('Forbidden'), { status: 403 })
    );
    const { MyWorkHub } = await import('@/components/MyWork/MyWorkHub');

    renderHub(<MyWorkHub />, '/my-work/notebook/denied-page');

    await waitFor(() => {
      expect(screen.getByTestId('notebook-page-parent-resolution-error')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('stub-notebook-content')).not.toBeInTheDocument();
  });

  it('does not publish a late notebook title from the previous actor scope', async () => {
    let resolveOldTitle!: (value: unknown) => void;
    const oldTitle = new Promise((resolve) => {
      resolveOldTitle = resolve;
    });
    vi.spyOn(Api, 'getNotebookPage').mockResolvedValue({
      id: 'page-b',
      notebookId: 'notebook-b',
      title: 'Same title',
    });
    const getNotebook = vi
      .spyOn(Api, 'getNotebook')
      .mockReturnValueOnce(oldTitle)
      .mockResolvedValue({ id: 'notebook-b', title: 'New scope title' });
    const { MyWorkHub } = await import('@/components/MyWork/MyWorkHub');

    renderHub(<MyWorkHub />, '/my-work/notebook/notebook-b/page-b');
    await waitFor(() => expect(getNotebook).toHaveBeenCalledTimes(1));

    setHubSmokeIdentity('smoke-user-2', 'smoke-org-2');
    fireEvent.click(screen.getByTitle('Search'));

    await waitFor(() => expect(getNotebook).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.getByTestId('stub-notebook-content')).toHaveTextContent('New scope title')
    );

    await act(async () => {
      resolveOldTitle({ id: 'notebook-b', title: 'Old scope title' });
    });
    expect(screen.getByTestId('stub-notebook-content')).toHaveTextContent('New scope title');
    expect(screen.getByTestId('stub-notebook-content')).not.toHaveTextContent('Old scope title');
  });
});
