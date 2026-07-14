/**
 * HP-3 (Harvey-Parity Blok A) — Discovery Tools -> Agent Manifest registry.
 *
 * Proves: all 31 doctrine tool types (`CONSULTING_TOOL_ROLLOUT_PRIORITY` waves
 * 1-3 + the reference `dynamic-swot`) have exactly one manifest each; the 19
 * with a real `src/config/<dir>` are 'built' with non-empty steps introspected
 * from their own ladder/question-bank Record; the 12 wave-3 tool types with no
 * config dir yet are honestly 'planned' (empty steps, not guessed).
 */
import { describe, expect, it } from 'vitest';

import {
  CONSULTING_TOOL_CONTEXT_SOURCES,
  CONSULTING_TOOL_ROLLOUT_PRIORITY,
  CONSULTING_TOOL_STANDARD_OUTPUTS,
} from '@/config/consultingToolsStandard';
import {
  BUILT_TOOL_IDS,
  DISCOVERY_TOOL_AGENT_MANIFESTS,
  getDiscoveryToolAgentManifest,
  PLANNED_TOOL_IDS,
} from '@/config/agentManifests/discoveryToolsRegistry';

const DOCTRINE_TOOL_TYPES = CONSULTING_TOOL_ROLLOUT_PRIORITY.flatMap((w) => w.toolTypes);

describe('Discovery Tool Agent Manifest registry (HP-3)', () => {
  it('has exactly 31 manifests: 30 doctrine tool types + dynamic-swot reference', () => {
    // CONSULTING_TOOL_ROLLOUT_PRIORITY covers wave-1..3 (30 tool types); dynamic-swot
    // is the already-shipped reference tool, tracked outside the rollout waves.
    expect(DOCTRINE_TOOL_TYPES).toHaveLength(30);
    expect(DISCOVERY_TOOL_AGENT_MANIFESTS).toHaveLength(31);
  });

  it('every manifest id is unique', () => {
    const ids = DISCOVERY_TOOL_AGENT_MANIFESTS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every doctrine tool type + dynamic-swot has exactly one manifest', () => {
    const expectedIds = new Set([...DOCTRINE_TOOL_TYPES, 'dynamic-swot']);
    const actualIds = new Set(DISCOVERY_TOOL_AGENT_MANIFESTS.map((m) => m.id));
    expect(actualIds).toEqual(expectedIds);
  });

  it('19/31 are built, 12/31 are planned — matches the audited src/config/ inventory', () => {
    expect(BUILT_TOOL_IDS).toHaveLength(19);
    expect(PLANNED_TOOL_IDS).toHaveLength(12);
    const built = DISCOVERY_TOOL_AGENT_MANIFESTS.filter((m) => m.status === 'built');
    const planned = DISCOVERY_TOOL_AGENT_MANIFESTS.filter((m) => m.status === 'planned');
    expect(built).toHaveLength(19);
    expect(planned).toHaveLength(12);
  });

  it('every built manifest has non-empty steps + full doctrine sources/outputs (N/N)', () => {
    const built = DISCOVERY_TOOL_AGENT_MANIFESTS.filter((m) => m.status === 'built');
    for (const m of built) {
      expect(m.configDir, `${m.id} should have a configDir`).toMatch(/^src\/config\//);
      expect(m.steps.length, `${m.id} should have >=1 step`).toBeGreaterThan(0);
      // Steps must be unique (they are section/track ids, not free text).
      expect(new Set(m.steps).size, `${m.id} steps should be unique`).toBe(m.steps.length);
      for (const s of CONSULTING_TOOL_CONTEXT_SOURCES) {
        expect(m.sources, `${m.id} missing doctrine source ${s}`).toContain(s);
      }
      for (const o of CONSULTING_TOOL_STANDARD_OUTPUTS) {
        expect(m.outputs, `${m.id} missing doctrine output ${o}`).toContain(o);
      }
    }
  });

  it('every planned manifest is honestly empty (no fabricated steps/sources/outputs)', () => {
    const planned = DISCOVERY_TOOL_AGENT_MANIFESTS.filter((m) => m.status === 'planned');
    for (const m of planned) {
      expect(m.configDir).toBeNull();
      expect(m.steps).toEqual([]);
      expect(m.sources).toEqual([]);
      expect(m.outputs).toEqual([]);
    }
  });

  it('spot-check: a3-problem-solving steps mirror its A3_SECTIONS (problem -> root-cause -> countermeasures)', () => {
    const m = getDiscoveryToolAgentManifest('a3-problem-solving');
    expect(m?.steps).toEqual(['problem', 'root-cause', 'countermeasures']);
  });

  it('spot-check: dynamic-swot steps mirror its 4 quadrants', () => {
    const m = getDiscoveryToolAgentManifest('dynamic-swot');
    expect(m?.steps.sort()).toEqual(
      ['strengths', 'weaknesses', 'opportunities', 'threats'].sort()
    );
  });

  it('spot-check: risk-uncertainty output includes raid-log handoff (raidHandoff.ts)', () => {
    const m = getDiscoveryToolAgentManifest('risk-uncertainty');
    expect(m?.outputs).toContain('raid-log');
  });

  it('spot-check: portfolio-priority source includes org-initiatives import (portfolioOrgImport.ts)', () => {
    const m = getDiscoveryToolAgentManifest('portfolio-priority');
    expect(m?.sources).toContain('org-initiatives');
  });

  it('getDiscoveryToolAgentManifest returns null for an unknown id', () => {
    expect(getDiscoveryToolAgentManifest('does-not-exist')).toBeNull();
  });
});
