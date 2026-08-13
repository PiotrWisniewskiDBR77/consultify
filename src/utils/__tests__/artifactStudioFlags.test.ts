import { describe, expect, it } from 'vitest';

import {
  getArtifactStudioRolloutDecision,
  isArtifactStudioLaneEnabled,
} from '../artifactStudioFlags';

const storage = (values: Record<string, string> = {}) => ({
  getItem: (key: string) => values[key] ?? null,
});

describe('Artifact Studio rollout flags', () => {
  it('is fail-closed when no flags are configured', () => {
    expect(isArtifactStudioLaneEnabled('presentation', {})).toBe(false);
  });

  it('requires both the global and lane flag', () => {
    expect(
      isArtifactStudioLaneEnabled('presentation', {
        storage: storage({ 'ff.artifact_studio': '1' }),
      })
    ).toBe(false);

    expect(
      isArtifactStudioLaneEnabled('presentation', {
        storage: storage({
          'ff.artifact_studio': '1',
          'ff.presentation_studio_v2': '1',
        }),
      })
    ).toBe(true);
  });

  it('allows query flags to override stored values for operator rollback', () => {
    expect(
      isArtifactStudioLaneEnabled('presentation', {
        query: new URLSearchParams('ff_artifactStudio=1&ff_presentationStudioV2=0'),
        storage: storage({
          'ff.artifact_studio': '1',
          'ff.presentation_studio_v2': '1',
        }),
      })
    ).toBe(false);
  });

  it('isolates lane enablement', () => {
    const source = {
      query: new URLSearchParams('ff_artifactStudio=1&ff_documentStudioV2=1'),
    };
    expect(isArtifactStudioLaneEnabled('document', source)).toBe(true);
    expect(isArtifactStudioLaneEnabled('presentation', source)).toBe(false);
    expect(isArtifactStudioLaneEnabled('spreadsheet', source)).toBe(false);
  });

  it('reports flag provenance without exposing raw values', () => {
    const decision = getArtifactStudioRolloutDecision('spreadsheet', {
      query: new URLSearchParams('ff_artifactStudio=1'),
      storage: storage({ 'ff.spreadsheet_studio_v2': 'true' }),
    });

    expect(decision).toEqual({
      lane: 'spreadsheet',
      enabled: true,
      globalEnabled: true,
      laneEnabled: true,
      globalSource: 'query',
      laneSource: 'storage',
    });
    expect(decision).not.toHaveProperty('rawValue');
  });

  it('reports a fail-closed default decision', () => {
    expect(getArtifactStudioRolloutDecision('document', {})).toEqual({
      lane: 'document',
      enabled: false,
      globalEnabled: false,
      laneEnabled: false,
      globalSource: 'default',
      laneSource: 'default',
    });
  });

  it('enables every lane from the central demo acceptance profile', () => {
    const source = {
      env: { VITE_DEMO_ACCEPTANCE: 'true' },
      hostname: 'demo.consultify.ai',
    };
    expect(isArtifactStudioLaneEnabled('document', source)).toBe(true);
    expect(isArtifactStudioLaneEnabled('presentation', source)).toBe(true);
    expect(isArtifactStudioLaneEnabled('spreadsheet', source)).toBe(true);
  });

  it('never enables the acceptance profile on public production', () => {
    expect(
      isArtifactStudioLaneEnabled('document', {
        env: { VITE_DEMO_ACCEPTANCE: 'true' },
        hostname: 'consultify.ai',
      })
    ).toBe(false);
  });
});
