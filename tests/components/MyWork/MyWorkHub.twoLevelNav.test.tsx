/**
 * @vitest-environment jsdom
 *
 * My Work cold-deep-link regression. The canonical hub renders its approved
 * flat navigation and no longer consumes the retired two-level-nav flag.
 * This file keeps the server-truth Notebook title assertion introduced with
 * the deep-link repair; it intentionally makes no assertion about the retired
 * visual experiment.
 */
import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { installFetchStub, renderHub } from '../smoke/hubSmokeHarness';
import { Api } from '@/services/api';

beforeEach(() => {
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
});
