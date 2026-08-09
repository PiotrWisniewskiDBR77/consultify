import { beforeEach, describe, expect, it, vi } from 'vitest';

import { emitArtifactStudioShellSelected } from '../artifactStudioTelemetry';

const trackFunnelEventMock = vi.fn();
vi.mock('@/services/funnelAnalytics', () => ({
  trackFunnelEvent: (...args: unknown[]) => trackFunnelEventMock(...args),
}));

const storage = (values: Record<string, string> = {}) => ({
  getItem: (key: string) => values[key] ?? null,
});

describe('Artifact Studio rollout telemetry', () => {
  beforeEach(() => trackFunnelEventMock.mockReset());

  it('emits the V2 lane decision without artifact or user data', () => {
    expect(
      emitArtifactStudioShellSelected('document', {
        storage: storage({
          'ff.artifact_studio': '1',
          'ff.document_studio_v2': '1',
        }),
      })
    ).toBe(true);

    expect(trackFunnelEventMock).toHaveBeenCalledWith('artifact_studio_shell_selected', {
      lane: 'document',
      shell: 'v2',
      globalEnabled: true,
      laneEnabled: true,
      globalSource: 'storage',
      laneSource: 'storage',
    });
    const payload = trackFunnelEventMock.mock.calls[0][1] as Record<string, unknown>;
    expect(payload).not.toHaveProperty('artifactId');
    expect(payload).not.toHaveProperty('title');
    expect(payload).not.toHaveProperty('url');
    expect(payload).not.toHaveProperty('userId');
  });

  it('emits the fail-closed legacy decision', () => {
    emitArtifactStudioShellSelected('presentation', {});

    expect(trackFunnelEventMock).toHaveBeenCalledWith(
      'artifact_studio_shell_selected',
      expect.objectContaining({
        lane: 'presentation',
        shell: 'legacy',
        globalSource: 'default',
        laneSource: 'default',
      })
    );
  });

  it('never lets a telemetry sink failure break artifact opening', () => {
    trackFunnelEventMock.mockImplementationOnce(() => {
      throw new Error('analytics unavailable');
    });

    expect(() => emitArtifactStudioShellSelected('spreadsheet', {})).not.toThrow();
    expect(emitArtifactStudioShellSelected('spreadsheet', {})).toBe(true);
  });
});
