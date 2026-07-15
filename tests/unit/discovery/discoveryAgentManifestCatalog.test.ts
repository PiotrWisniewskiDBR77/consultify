/**
 * Discovery Agent Manifest Catalog — server-side mirror parity (M01 wiring).
 *
 * `server/src/services/ai/agentRuntime/discoveryAgentManifestCatalog.ts` is a
 * deliberate summary-only mirror of the frontend SSOT
 * (`src/config/agentManifests/discoveryToolsRegistry.ts`, HP-3) because the
 * server package cannot cross-import frontend `src/` (own `rootDir`/tsconfig).
 *
 * This test is the drift guard: it imports BOTH trees (vitest.config.ts
 * aliases `@/` to `src/` and resolves `server/src/*.js` to the server tree)
 * and asserts the mirror's ids/status/wave/configDir stay in lockstep with
 * the frontend registry it summarizes.
 */
import { describe, expect, it } from 'vitest';

import { DISCOVERY_TOOL_AGENT_MANIFESTS } from '@/config/agentManifests/discoveryToolsRegistry';

import {
  DISCOVERY_AGENT_MANIFEST_CATALOG,
  getDiscoveryAgentManifest,
  listDiscoveryAgentManifests,
} from '../../../server/src/services/ai/agentRuntime/discoveryAgentManifestCatalog.js';

describe('Discovery Agent Manifest Catalog (server mirror, M01)', () => {
  it('has exactly 31 entries, same as the frontend SSOT registry', () => {
    expect(DISCOVERY_TOOL_AGENT_MANIFESTS).toHaveLength(31);
    expect(DISCOVERY_AGENT_MANIFEST_CATALOG).toHaveLength(31);
  });

  it('every id in the frontend registry has exactly one matching mirror entry', () => {
    const frontendIds = DISCOVERY_TOOL_AGENT_MANIFESTS.map((m) => m.id).sort();
    const mirrorIds = DISCOVERY_AGENT_MANIFEST_CATALOG.map((m) => m.id).sort();
    expect(mirrorIds).toEqual(frontendIds);
  });

  it('status/wave/configDir/sourceType match 1:1 per id (no drift)', () => {
    for (const front of DISCOVERY_TOOL_AGENT_MANIFESTS) {
      const mirror = DISCOVERY_AGENT_MANIFEST_CATALOG.find((m) => m.id === front.id);
      expect(mirror, `mirror entry missing for ${front.id}`).toBeTruthy();
      expect(mirror!.status, `${front.id} status drift`).toBe(front.status);
      expect(mirror!.wave, `${front.id} wave drift`).toBe(front.wave);
      expect(mirror!.configDir, `${front.id} configDir drift`).toBe(front.configDir);
      expect(mirror!.sourceType, `${front.id} sourceType drift`).toBe(front.sourceType);
      expect(mirror!.displayName.en, `${front.id} displayName.en drift`).toBe(
        front.displayName.en
      );
      expect(mirror!.displayName.pl, `${front.id} displayName.pl drift`).toBe(
        front.displayName.pl
      );
    }
  });

  it('built entries have a non-null configDir, planned entries have null', () => {
    for (const m of DISCOVERY_AGENT_MANIFEST_CATALOG) {
      if (m.status === 'built') {
        expect(m.configDir, `${m.id} (built) should have a configDir`).toMatch(/^src\/config\//);
      } else {
        expect(m.configDir, `${m.id} (planned) should have null configDir`).toBeNull();
      }
    }
  });

  it('listDiscoveryAgentManifests filters by status', () => {
    const built = listDiscoveryAgentManifests({ status: 'built' });
    const planned = listDiscoveryAgentManifests({ status: 'planned' });
    expect(built).toHaveLength(19);
    expect(planned).toHaveLength(12);
    expect(built.every((m) => m.status === 'built')).toBe(true);
    expect(planned.every((m) => m.status === 'planned')).toBe(true);
  });

  it('listDiscoveryAgentManifests filters by wave', () => {
    const wave1 = listDiscoveryAgentManifests({ wave: 'wave-1' });
    expect(wave1.map((m) => m.id).sort()).toEqual(
      ['growth-paths', 'market-forces', 'portfolio-priority', 'risk-uncertainty'].sort()
    );
  });

  it('listDiscoveryAgentManifests with no filters returns all 31 and does not mutate the source', () => {
    const all = listDiscoveryAgentManifests();
    expect(all).toHaveLength(31);
    all.pop();
    expect(DISCOVERY_AGENT_MANIFEST_CATALOG).toHaveLength(31);
  });

  it('getDiscoveryAgentManifest resolves a known id and returns null for unknown', () => {
    expect(getDiscoveryAgentManifest('market-forces')?.id).toBe('market-forces');
    expect(getDiscoveryAgentManifest('does-not-exist')).toBeNull();
  });
});
