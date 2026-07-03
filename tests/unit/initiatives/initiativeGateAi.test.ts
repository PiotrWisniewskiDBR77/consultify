import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AI_GATES,
  DEFAULT_GATE_AI_THRESHOLD,
  GATE_AI_TIMELINE_GATES,
  GATE_REQUIRED_SECTIONS,
  gateHasTimelineCheck,
  isAiGate,
} from '../../../server/src/constants/initiativeGateAi.js';
import { GateType } from '../../../server/src/constants/initiativeStatuses.js';

// Registry section keys (src/components/Initiatives/sections/registry.ts) —
// the GATE_REQUIRED_SECTIONS map must only reference real keys.
const VALID_SECTION_KEYS = new Set([
  'overview',
  'problemDefinition',
  'targetState',
  'scope',
  'tasks',
  'decisions',
  'raid',
  'gates',
  'financialAnalysis',
  'financialImpact',
  'kpis',
  'competencyRequirements',
  'skillsGap',
  'pilot',
  'comments',
  'history',
  'control',
  'team',
  'initiativeTeam',
  'raciEscalation',
  'timeline',
  'resources',
  'stakeholders',
  'dependencies',
  'attachments',
  'linkedItems',
  'tags',
  'reminders',
  'watchers',
]);

describe('initiativeGateAi constants (G1)', () => {
  it('declares exactly the 9 forward-progress gates as AI gates', () => {
    expect(AI_GATES).toHaveLength(9);
    expect(new Set(AI_GATES).size).toBe(9); // no duplicates
    // Regressive/lateral gates are NOT AI gates
    for (const g of [
      GateType.SEND_BACK,
      GateType.REJECT,
      GateType.BLOCK,
      GateType.UNBLOCK,
      GateType.CANCEL,
    ]) {
      expect(isAiGate(g)).toBe(false);
    }
  });

  it('every AI gate has a non-empty required-sections list of valid registry keys', () => {
    for (const gate of AI_GATES) {
      const sections = GATE_REQUIRED_SECTIONS[gate];
      expect(Array.isArray(sections)).toBe(true);
      expect(sections.length).toBeGreaterThan(0);
      for (const key of sections) {
        expect(VALID_SECTION_KEYS.has(key), `${gate} → unknown section "${key}"`).toBe(true);
      }
    }
  });

  it('regressive/lateral gates have empty required sections', () => {
    for (const g of [GateType.SEND_BACK, GateType.REJECT, GateType.BLOCK, GateType.UNBLOCK, GateType.CANCEL]) {
      expect(GATE_REQUIRED_SECTIONS[g]).toEqual([]);
    }
  });

  it('runs the timeline analyzer only on planning gates (SCHEDULE, START)', () => {
    expect([...GATE_AI_TIMELINE_GATES].sort()).toEqual([GateType.SCHEDULE, GateType.START].sort());
    expect(gateHasTimelineCheck(GateType.SCHEDULE)).toBe(true);
    expect(gateHasTimelineCheck(GateType.START)).toBe(true);
    expect(gateHasTimelineCheck(GateType.APPROVE)).toBe(false);
    expect(gateHasTimelineCheck(GateType.SUBMIT_FOR_REVIEW)).toBe(false);
  });

  it('default threshold is 75', () => {
    expect(DEFAULT_GATE_AI_THRESHOLD).toBe(75);
  });
});

// ---------------------------------------------------------------------------
// Config service (per-org flag) — fail-safe OFF
// ---------------------------------------------------------------------------

const mockAll = vi.fn();
const mockRun = vi.fn();
const mockTableExists = vi.fn();

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: (...a: unknown[]) => mockAll(...a),
  get: vi.fn(),
  run: (...a: unknown[]) => mockRun(...a),
  tableExists: (...a: unknown[]) => mockTableExists(...a),
}));

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import {
  clearGateAiConfigCache,
  getGateAiConfig,
  getGateAiThreshold,
  isInitiativeGateAiEnabled,
  setInitiativeGateAiFlag,
} from '../../../server/src/services/initiative/initiativeGateAiConfig.js';

describe('initiativeGateAiConfig (G1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearGateAiConfigCache();
  });

  it('OFF when the flag table does not exist (migration not applied)', async () => {
    mockTableExists.mockResolvedValueOnce(false);
    expect(await isInitiativeGateAiEnabled('org-a')).toBe(false);
    expect(mockAll).not.toHaveBeenCalled();
  });

  it('OFF when the table exists but the org has no row', async () => {
    mockTableExists.mockResolvedValueOnce(true);
    mockAll.mockResolvedValueOnce([]);
    const cfg = await getGateAiConfig('org-b');
    expect(cfg).toEqual({ enabled: false, threshold: 75 });
  });

  it('ON with default threshold when an enabled row exists', async () => {
    mockTableExists.mockResolvedValueOnce(true);
    mockAll.mockResolvedValueOnce([{ enabled: 1, threshold: 75 }]);
    expect(await isInitiativeGateAiEnabled('org-c')).toBe(true);
  });

  it('coerces bigint-string enabled and reads per-org threshold override', async () => {
    mockTableExists.mockResolvedValueOnce(true);
    mockAll.mockResolvedValueOnce([{ enabled: '1', threshold: '90' }]);
    expect(await getGateAiThreshold('org-d')).toBe(90);
    // cache: a second call must not hit the DB again
    expect(await isInitiativeGateAiEnabled('org-d')).toBe(true);
    expect(mockTableExists).toHaveBeenCalledTimes(1);
  });

  it('invalid/zero threshold falls back to default', async () => {
    mockTableExists.mockResolvedValueOnce(true);
    mockAll.mockResolvedValueOnce([{ enabled: 1, threshold: 0 }]);
    expect(await getGateAiThreshold('org-e')).toBe(75);
  });

  it('fail-safe OFF on a read error (never blocks a transition)', async () => {
    mockTableExists.mockResolvedValueOnce(true);
    mockAll.mockRejectedValueOnce(new Error('db down'));
    expect(await isInitiativeGateAiEnabled('org-f')).toBe(false);
  });

  it('setInitiativeGateAiFlag upserts and throws if table missing', async () => {
    mockTableExists.mockResolvedValueOnce(false);
    await expect(setInitiativeGateAiFlag('org-g', true)).rejects.toThrow(/table missing/);

    mockTableExists.mockResolvedValueOnce(true);
    mockRun.mockResolvedValueOnce({});
    await setInitiativeGateAiFlag('org-h', true, { threshold: 80, updatedBy: 'admin' });
    const sql = String(mockRun.mock.calls[0][0]);
    expect(sql).toMatch(/INSERT INTO initiative_feature_flags/);
    expect(mockRun.mock.calls[0][1]).toEqual(['org-h', 'gate_ai', 1, 80, 'admin']);
  });
});
