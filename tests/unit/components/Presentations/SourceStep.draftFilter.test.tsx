/**
 * S6.3 — M17 junk filter, FE. The presentation generator's "Select Data Sources"
 * step (step 1) must, by default, ask the server for real/final artifacts only,
 * and expose a "Pokaż robocze" toggle that re-requests with ?include=drafts. It
 * must also render the dedup version count returned by the server.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';

import { SourceStep } from '../../../../src/components/Presentations/wizard/SourceStep';

vi.mock('@/services/api', () => ({
  Api: { get: vi.fn() },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    // Return the provided fallback so we can assert on human-readable copy.
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

const apiGet = vi.mocked(Api.get);

function mockArtifactsResponse(rows: any[]) {
  // Route shape: { data: [...] } → SourceStep.unwrap picks res.data.data.
  return Promise.resolve({ data: { data: rows } } as any);
}

describe('SourceStep — M17 junk filter (drafts toggle + dedup label)', () => {
  beforeEach(() => {
    apiGet.mockReset();
  });

  it('requests only real/final artifacts by default (no include=drafts)', async () => {
    apiGet.mockReturnValue(mockArtifactsResponse([]));

    render(<SourceStep selectedSources={[]} onToggleSource={() => {}} onNext={() => {}} />);

    await waitFor(() => expect(apiGet).toHaveBeenCalled());
    expect(apiGet).toHaveBeenCalledWith('/artifacts?limit=80');
    expect(apiGet).not.toHaveBeenCalledWith(expect.stringContaining('include=drafts'));
  });

  it('re-fetches with include=drafts when "Pokaż robocze" is toggled on', async () => {
    apiGet.mockReturnValue(mockArtifactsResponse([]));

    render(<SourceStep selectedSources={[]} onToggleSource={() => {}} onNext={() => {}} />);
    await waitFor(() => expect(apiGet).toHaveBeenCalled());
    // Before toggling, no request ever carried include=drafts.
    expect(apiGet).not.toHaveBeenCalledWith(expect.stringContaining('include=drafts'));

    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() =>
      expect(apiGet).toHaveBeenLastCalledWith('/artifacts?limit=80&include=drafts')
    );
  });

  it('renders the server dedup version count in the artifact label', async () => {
    apiGet.mockReturnValue(
      mockArtifactsResponse([
        {
          artifactId: 'deck-1',
          outputType: 'presentation',
          originRuntime: 'presentation',
          originRecordId: 'rec-1',
          resolvedTitle: 'Board deck',
          duplicateCount: 3,
          isDraft: false,
        },
      ])
    );

    render(<SourceStep selectedSources={[]} onToggleSource={() => {}} onNext={() => {}} />);

    expect(await screen.findByText(/Board deck · 3 wersje/)).toBeInTheDocument();
  });
});
