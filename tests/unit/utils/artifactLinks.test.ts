import { describe, expect, it, vi } from 'vitest';

import {
  CORE_RUNTIME_HANDOFF_TRACE_STORAGE_KEY,
  appendCoreRuntimeHandoffTrace,
  artifactLinkToOpenPayload,
  buildArtifactLink,
  buildArtifactPermalink,
  getArtifactPath,
  getArtifactLabel,
  getNodeArtifactLinks,
  getPrimaryArtifactLink,
  legacyRefToArtifactLinks,
  type ArtifactLink,
  type CoreRuntimeHandoffTrace,
} from '../../../src/utils/artifactLinks';

describe('artifactLinks helpers', () => {
  const linkA: ArtifactLink = buildArtifactLink('initiative', 'init-1', 'related', 'Initiative 1');
  const linkB: ArtifactLink = { ...buildArtifactLink('decision', 'dec-2', 'output', 'Decision 2'), pinned: true };

  describe('getPrimaryArtifactLink', () => {
    it('returns null for empty array', () => {
      expect(getPrimaryArtifactLink([])).toBeNull();
    });

    it('returns the first link when none is pinned', () => {
      expect(getPrimaryArtifactLink([linkA])).toBe(linkA);
    });

    it('returns the pinned link over the first', () => {
      expect(getPrimaryArtifactLink([linkA, linkB])?.artifactRef.type).toBe('decision');
    });

    it('returns null when input is not an array', () => {
      expect(getPrimaryArtifactLink(null as unknown as ArtifactLink[])).toBeNull();
      expect(getPrimaryArtifactLink({} as unknown as ArtifactLink[])).toBeNull();
    });
  });

  describe('artifactLinkToOpenPayload', () => {
    it('builds a valid open payload', () => {
      const payload = artifactLinkToOpenPayload(linkA);
      expect(payload).toEqual({
        type: 'initiative',
        id: 'init-1',
        name: 'Initiative 1',
      });
    });

    it('falls back to type:id when label is missing', () => {
      const noLabel: ArtifactLink = { artifactRef: { type: 'task', id: 'task-99' } };
      const payload = artifactLinkToOpenPayload(noLabel);
      expect(payload.name).toBe('task:task-99');
    });

    it('returns safe fallback payload for malformed link input', () => {
      const payload = artifactLinkToOpenPayload({} as ArtifactLink);
      expect(payload).toEqual({
        type: 'unknown',
        id: '',
        name: 'unknown:',
      });
    });
  });

  describe('legacyRefToArtifactLinks', () => {
    it('converts a legacy ref string to ArtifactLink[]', () => {
      const links = legacyRefToArtifactLinks('initiative:abc123');
      expect(links).toHaveLength(1);
      expect(links[0].artifactRef).toEqual({ type: 'initiative', id: 'abc123' });
    });

    it('returns empty array for null/undefined/empty', () => {
      expect(legacyRefToArtifactLinks(null)).toEqual([]);
      expect(legacyRefToArtifactLinks(undefined)).toEqual([]);
      expect(legacyRefToArtifactLinks('')).toEqual([]);
    });

    it('returns empty array for malformed ref', () => {
      expect(legacyRefToArtifactLinks('no-colon')).toEqual([]);
    });

    it('returns empty array for unknown artifact type', () => {
      expect(legacyRefToArtifactLinks('unsupported:abc123')).toEqual([]);
    });
  });

  describe('getNodeArtifactLinks', () => {
    it('falls back to root artifactLinks when data.artifactLinks is empty', () => {
      const rootLink = buildArtifactLink('task', 'task-1', 'related', 'Task');
      const links = getNodeArtifactLinks({
        data: { artifactLinks: [] },
        artifactLinks: [rootLink],
      });
      expect(links).toEqual([rootLink]);
    });
  });

  describe('getArtifactLabel', () => {
    it('treats Polish language code case-insensitively', () => {
      expect(getArtifactLabel('idea', 'pl')).toBe('Pomysł');
      expect(getArtifactLabel('idea', 'PL')).toBe('Pomysł');
      expect(getArtifactLabel('idea', 'pl-PL')).toBe('Pomysł');
    });

    it('falls back safely when language input is missing', () => {
      expect(getArtifactLabel('idea', undefined as unknown as string)).toBe('Idea');
      expect(getArtifactLabel('idea', null as unknown as string)).toBe('Idea');
    });
  });

  describe('getArtifactPath', () => {
    it('encodes economics open param ids to avoid query corruption', () => {
      const path = getArtifactPath('budget', 'bdg-1&tab=hijack');
      expect(path).toContain('open=bdg-1%26tab%3Dhijack');
      expect(path).not.toContain('open=bdg-1&tab=hijack');
    });

    it('encodes project ids in path segments', () => {
      const path = getArtifactPath('project', 'ac/me');
      expect(path).toContain('/projects/ac%2Fme');
    });
  });

  describe('buildArtifactPermalink', () => {
    it('returns relative permalink when window is unavailable', () => {
      vi.stubGlobal('window', undefined);
      try {
        const permalink = buildArtifactPermalink('idea', 'idea-1');
        expect(permalink.startsWith('/my-work?')).toBe(true);
      } finally {
        vi.unstubAllGlobals();
      }
    });
  });

  describe('appendCoreRuntimeHandoffTrace', () => {
    it('returns merged traces even when sessionStorage setItem throws', () => {
      const prior: CoreRuntimeHandoffTrace = {
        target: 'my_work',
        source: 'teresa',
        tab: null,
        pathname: '/my-work',
        kickoffMessage: null,
        capturedAt: '2026-01-01T00:00:00.000Z',
      };
      const incoming: CoreRuntimeHandoffTrace = {
        target: 'interview',
        source: 'teresa',
        tab: 'insights',
        pathname: '/interview',
        kickoffMessage: 'Kickoff',
        capturedAt: '2026-01-02T00:00:00.000Z',
      };
      const storage = {
        getItem: vi.fn(() => JSON.stringify([prior])),
        setItem: vi.fn(() => {
          throw new Error('QuotaExceeded');
        }),
      };

      expect(() => appendCoreRuntimeHandoffTrace(storage, incoming)).not.toThrow();

      const result = appendCoreRuntimeHandoffTrace(storage, incoming);
      expect(result).toEqual([prior, incoming]);
      expect(storage.getItem).toHaveBeenCalledWith(CORE_RUNTIME_HANDOFF_TRACE_STORAGE_KEY);
      expect(storage.setItem).toHaveBeenCalled();
    });
  });
});
