import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  apiMock: {
    approveWave5ArtifactMutation: vi.fn(),
    commitWave5ArtifactMutation: vi.fn(),
    createWave5Artifact: vi.fn(),
    fillWave5DocumentTemplate: vi.fn(),
    generateWave5StructuredArtifact: vi.fn(),
    getWave5Artifact: vi.fn(),
    getWave5ArtifactExportManifest: vi.fn(),
    getWave5ArtifactSchema: vi.fn(),
    listWave5Artifacts: vi.fn(),
    proposeWave5ArtifactMutation: vi.fn(),
    rejectWave5ArtifactMutation: vi.fn(),
  },
}));

vi.mock('../../../src/services/api', () => ({
  Api: h.apiMock,
  default: h.apiMock,
}));

import { Wave5ArtifactRuntimePanel } from '../../../src/components/AIChat/Wave5ArtifactRuntimePanel';

const baseArtifact = {
  artifactId: 'research-artifact-ee50d8e0-b9d3-4c86-97e2-8e7a8fbe1345',
  artifactType: 'research_report',
  status: 'draft',
  title: 'Wave 5 Research Artifact',
  content: '# Initial artifact\nOriginal content',
  version: 1,
  provenance: { source: 'research_session' },
  versions: [{ version: 1, createdAt: '2026-04-27T15:00:00Z' }],
  mutations: [],
};

const mutation = {
  mutationId: 'mutation-wave5-1',
  status: 'proposed',
  summary: 'Manual artifact update proposal',
  diff: [
    {
      line: 2,
      type: 'changed',
      before: 'Original content',
      after: 'Updated content',
    },
  ],
};

describe('Wave5ArtifactRuntimePanel mutation proposals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.apiMock.getWave5ArtifactSchema.mockResolvedValue({
      artifactTypes: ['report', 'research_report'],
    });
  });

  it('keeps a created mutation proposal visible in Needs review instead of losing it after refresh', async () => {
    h.apiMock.listWave5Artifacts.mockResolvedValue({
      artifacts: [baseArtifact],
    });
    h.apiMock.getWave5Artifact
      .mockResolvedValueOnce({ artifact: baseArtifact })
      .mockResolvedValueOnce({
        artifact: {
          ...baseArtifact,
          status: 'proposed',
          mutations: [mutation],
        },
      });
    h.apiMock.proposeWave5ArtifactMutation.mockResolvedValue({
      success: true,
      mutation,
    });

    render(<Wave5ArtifactRuntimePanel />);

    expect((await screen.findAllByText('Wave 5 Research Artifact')).length).toBeGreaterThan(0);
    expect(screen.getByText('No mutations yet.')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/New artifact content/i), {
      target: { value: '# Initial artifact\nUpdated content' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create mutation proposal' }));

    await waitFor(() => {
      expect(screen.getByText('Manual artifact update proposal')).toBeInTheDocument();
    });

    const proposalRegion = screen.getByText('Manual artifact update proposal').closest('div');
    expect(proposalRegion).not.toBeNull();
    expect(screen.queryByText('No mutations yet.')).not.toBeInTheDocument();
    expect(screen.getByText('proposed')).toBeInTheDocument();
    expect(screen.getByText('- Original content')).toBeInTheDocument();
    expect(screen.getByText('+ Updated content')).toBeInTheDocument();

    expect(h.apiMock.proposeWave5ArtifactMutation).toHaveBeenCalledWith(
      baseArtifact.artifactId,
      expect.objectContaining({
        mutationType: 'content_update',
        proposedContent: '# Initial artifact\nUpdated content',
      })
    );
  });

  it('loads selected artifact details so a flat artifact list cannot erase existing mutations', async () => {
    h.apiMock.listWave5Artifacts.mockResolvedValue({
      artifacts: [{ ...baseArtifact, mutations: [] }],
    });
    h.apiMock.getWave5Artifact.mockResolvedValue({
      artifact: {
        ...baseArtifact,
        status: 'proposed',
        mutations: [mutation],
      },
    });

    render(<Wave5ArtifactRuntimePanel />);

    expect(await screen.findByText('Manual artifact update proposal')).toBeInTheDocument();
    const mutationSection = screen.getByText('Mutation Proposals').closest('div')?.parentElement;
    expect(mutationSection).toBeTruthy();
    expect(
      within(mutationSection as HTMLElement).queryByText('No mutations yet.')
    ).not.toBeInTheDocument();
  });
});
