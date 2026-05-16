import { describe, expect, it } from 'vitest';

import {
  artifactLinkToOpenPayload,
  buildArtifactLink,
  buildMyWorkSheetTableOpenPath,
  getPrimaryArtifactLink,
  legacyRefToArtifactLinks,
  type ArtifactLink,
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
  });

  describe('buildMyWorkSheetTableOpenPath', () => {
    it('returns Option A deep-link path for sheets builder', () => {
      expect(buildMyWorkSheetTableOpenPath('ws-123', 'tbl-456')).toBe(
        '/my-work/sheets/ws-123/tables/tbl-456'
      );
    });
  });
});
