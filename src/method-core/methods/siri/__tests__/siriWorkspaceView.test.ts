import { describe, expect, it } from 'vitest';

import { TERESA_FORBIDDEN_EFFECTS } from '@/method-core/contracts';
import { SIRI_PRIORITISATION_AREAS } from '@/services/siriStructure';

import {
  buildSiriGenericQuestion,
  buildSiriMatrixRows,
  buildSiriNavigatorNodes,
  checkSiriLeapfrog,
  confirmSiriBand,
  emptySiriUnitState,
  isSiriFactoryObservation,
  isValidSiriBandConfirmingActor,
  proposeSiriBand,
  SIRI_BAND_SCALE,
  SIRI_EVIDENCE_ITEM_TYPES,
  siriEvidenceMissingCount,
  siriUnitHasHelpContent,
  type SiriUnitAssessmentState,
} from '../siriWorkspaceView';

function statesFrom(overrides: Record<string, Partial<SiriUnitAssessmentState>> = {}): Map<string, SiriUnitAssessmentState> {
  const map = new Map<string, SiriUnitAssessmentState>();
  for (const area of SIRI_PRIORITISATION_AREAS) {
    map.set(area.id, { ...emptySiriUnitState(area.id), ...overrides[area.id] });
  }
  return map;
}

describe('SIRI Workspace View — navigator (test 1)', () => {
  it('builds a strict 3 building blocks -> 8 pillars -> 16 dimensions tree, no orphan node', () => {
    const nodes = buildSiriNavigatorNodes(statesFrom());
    expect(nodes).toHaveLength(3 + 8 + 16);

    const byId = new Map(nodes.map((n) => [n.unitId, n]));
    const roots = nodes.filter((n) => n.parentId === null);
    expect(roots).toHaveLength(3); // exactly the 3 building blocks

    for (const node of nodes) {
      if (node.parentId === null) continue;
      expect(byId.has(node.parentId)).toBe(true); // every non-root resolves to a real parent — no orphan
    }

    // 16 dimensions are leaves, never presented as an assessable "8" level.
    const leafIds = nodes.filter((n) => n.unitId.startsWith('block:') === false && n.unitId.startsWith('pillar:') === false);
    expect(leafIds).toHaveLength(16);
    expect(new Set(leafIds.map((n) => n.unitId))).toEqual(new Set(SIRI_PRIORITISATION_AREAS.map((a) => a.id)));

    // Every pillar node's parent is one of the 3 building block nodes.
    const pillarNodes = nodes.filter((n) => n.unitId.startsWith('pillar:'));
    expect(pillarNodes).toHaveLength(8);
    for (const pillar of pillarNodes) {
      expect(pillar.parentId?.startsWith('block:')).toBe(true);
    }
    // Every 16D leaf's parent is one of the 8 pillar nodes.
    for (const leaf of leafIds) {
      expect(leaf.parentId?.startsWith('pillar:')).toBe(true);
    }
  });
});

describe('SIRI Workspace View — matrix (test 2)', () => {
  it('produces exactly 16 rows, each with Bands 0..5', () => {
    const rows = buildSiriMatrixRows(statesFrom());
    expect(rows).toHaveLength(16);
    expect(new Set(rows.map((r) => r.unitId))).toEqual(new Set(SIRI_PRIORITISATION_AREAS.map((a) => a.id)));
    for (const row of rows) {
      expect(row.levels.map((l) => l.level)).toEqual([...SIRI_BAND_SCALE]);
    }
  });
});

describe('SIRI Workspace View — no-leapfrog (test 3)', () => {
  it('Band 4 without Band 2 is blocked with a visible, explicit message', () => {
    const state: SiriUnitAssessmentState = {
      unitId: 'vertical_integration',
      confirmedLevels: [0, 1], // Band 2 missing
      evidenceByLevel: { 0: 'E2', 1: 'E2' },
      targetLevel: null,
    };
    const check = checkSiriLeapfrog(state, 4);
    expect(check.allowed).toBe(false);
    expect(check.blockedAtLevel).toBe(2);
    expect(check.message).not.toBeNull();
    expect(check.message).toMatch(/Band 4/);
    expect(check.message).toMatch(/Band 2/);

    // The matrix row must reflect the same gate — Band 4 not `achieved`.
    const rows = buildSiriMatrixRows(statesFrom({ vertical_integration: state }));
    const row = rows.find((r) => r.unitId === 'vertical_integration')!;
    const band4 = row.levels.find((l) => l.level === 4)!;
    expect(band4.achieved).toBe(false);
  });
});

describe('SIRI Workspace View — rationale required (test 4)', () => {
  it('a Band cannot be proposed without a rationale', () => {
    const state: SiriUnitAssessmentState = emptySiriUnitState('strategy_governance');
    const result = proposeSiriBand({ state, level: 0, rationale: '' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('missing_rationale');
  });

  it('a Band cannot be proposed with a whitespace-only rationale', () => {
    const state: SiriUnitAssessmentState = emptySiriUnitState('strategy_governance');
    const result = proposeSiriBand({ state, level: 0, rationale: '   ' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('missing_rationale');
  });

  it('a Band CAN be proposed with a rationale and an open level', () => {
    const state: SiriUnitAssessmentState = emptySiriUnitState('strategy_governance');
    const result = proposeSiriBand({ state, level: 0, rationale: 'Widoczna dokumentacja procesu.' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe('proposed');
      expect(result.proposedBy).toBe('assessor');
    }
  });

  it('rationale requirement also blocks confirmation', () => {
    const state: SiriUnitAssessmentState = emptySiriUnitState('strategy_governance');
    const result = confirmSiriBand({
      state,
      level: 0,
      rationale: '',
      confirmedByActor: 'participant',
      confirmedByUserId: 'user-1',
    });
    expect(result.ok).toBe(false);
  });
});

describe('SIRI Workspace View — factory observation as a distinct Evidence Item type (test 5)', () => {
  it('lists `factory_observation` among the SIRI evidence item types', () => {
    expect(SIRI_EVIDENCE_ITEM_TYPES).toContain('factory_observation');
  });

  it('isSiriFactoryObservation distinguishes it from every other evidence type', () => {
    expect(isSiriFactoryObservation({ type: 'factory_observation' })).toBe(true);
    for (const type of SIRI_EVIDENCE_ITEM_TYPES) {
      if (type === 'factory_observation') continue;
      expect(isSiriFactoryObservation({ type })).toBe(false);
    }
  });
});

describe('SIRI Workspace View — evidence-missing honesty (test 9)', () => {
  it('every one of the 16 dimensions gets an honestly-empty question (triggers "Help content unavailable")', () => {
    for (const area of SIRI_PRIORITISATION_AREAS) {
      const q = buildSiriGenericQuestion(area.id, 2);
      // Exactly the condition QuestionHelpDisclosure checks to show the
      // honest "Help content unavailable" banner instead of a fabricated one.
      expect(q.plainLanguageExplanation).toBe('');
      expect(q.whyItMatters).toBe('');
      expect(q.positiveAnswerExample).toBe('');
      expect(siriUnitHasHelpContent(area.id)).toBe(false);
    }
  });

  it('reports the measured (not estimated) EVIDENCE_MISSING coverage from the compiled pack', () => {
    const summary = siriEvidenceMissingCount();
    expect(summary.dimensionsTotal).toBe(16);
    expect(summary.levelsTotal).toBe(96); // 16 dimensions x 6 bands
    expect(summary.levelsMarkedEvidenceMissing).toBe(96); // 96/96 — fully honest, not partially faked
    expect(summary.dimensionsWithDedicatedQuestions).toBe(0); // 0/16
  });
});

describe('SIRI Workspace View — Teresa never confirms a Band (test 10)', () => {
  it('the confirming-actor guard accepts only participant/approver, never teresa', () => {
    expect(isValidSiriBandConfirmingActor('participant')).toBe(true);
    expect(isValidSiriBandConfirmingActor('approver')).toBe(true);
    expect(isValidSiriBandConfirmingActor('teresa')).toBe(false);
    expect(isValidSiriBandConfirmingActor('ai')).toBe(false);
  });

  it('the kernel itself forbids Teresa from approving a score (structural corroboration)', () => {
    expect(TERESA_FORBIDDEN_EFFECTS).toContain('approve_score');
  });

  it('confirmSiriBand succeeds for a human participant with rationale and an open level', () => {
    const state = emptySiriUnitState('strategy_governance');
    const result = confirmSiriBand({
      state,
      level: 0,
      rationale: 'Zespół potwierdził na sesji roboczej.',
      confirmedByActor: 'participant',
      confirmedByUserId: 'user-42',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe('confirmed');
      expect(result.nextConfirmedLevels).toEqual([0]);
    }
  });
});
