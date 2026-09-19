import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import PublicArtifactView from '../PublicArtifactView';

describe('PublicArtifactView', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        title: 'Pipeline Report',
        kind: 'report',
        contentMd: '# Pipeline Report\n\nReady for review.',
        updatedAt: '2026-09-18T20:00:00.000Z',
        version: { current: 3, total: 3, label: 'v3' },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('renders report markdown with version N/N in the routed public viewer', async () => {
    render(
      <MemoryRouter initialEntries={['/public/artifacts/a1b2c3d4e5f600112233445566778899']}>
        <Routes>
          <Route path="/public/artifacts/:token" element={<PublicArtifactView />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/Version 3\/3/)).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: 'Pipeline Report' })).toHaveLength(2);
    expect(screen.getByText('Ready for review.')).toBeInTheDocument();
  });
});
