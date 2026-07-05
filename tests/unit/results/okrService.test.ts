import { describe, expect, it } from 'vitest';

import {
  cascadeRollup,
  okrSummary,
  scoreKeyResult,
  scoreObjective,
  type Objective,
} from '../../../server/src/services/results/okrService.js';

const kr = (over: Partial<Parameters<typeof scoreKeyResult>[0]> = {}) => ({
  id: over.id ?? 'kr',
  label: over.label ?? 'KR',
  ...over,
});

describe('scoreKeyResult', () => {
  it('computes linear progress (current-baseline)/(target-baseline)', () => {
    expect(scoreKeyResult(kr({ baseline: 0, target: 100, current: 50 }))).toBe(0.5);
    expect(scoreKeyResult(kr({ baseline: 20, target: 70, current: 45 }))).toBe(0.5);
  });

  it('clamps to [0, 1]', () => {
    expect(scoreKeyResult(kr({ baseline: 0, target: 100, current: 150 }))).toBe(1);
    expect(scoreKeyResult(kr({ baseline: 0, target: 100, current: -30 }))).toBe(0);
  });

  it('defaults baseline to 0 when omitted', () => {
    expect(scoreKeyResult(kr({ target: 200, current: 100 }))).toBe(0.5);
  });

  it('returns 0 when data is missing', () => {
    expect(scoreKeyResult(kr({ target: 100 }))).toBe(0); // no current
    expect(scoreKeyResult(kr({ current: 50 }))).toBe(0); // no target
    expect(scoreKeyResult(kr({}))).toBe(0);
  });

  it('returns 0 for a degenerate range (target === baseline)', () => {
    expect(scoreKeyResult(kr({ baseline: 50, target: 50, current: 50 }))).toBe(0);
  });
});

describe('scoreObjective', () => {
  it('weighted-averages key results', () => {
    const o: Objective = {
      id: 'o1',
      label: 'O1',
      keyResults: [
        kr({ id: 'a', baseline: 0, target: 100, current: 100, weight: 3 }), // 1.0 w3
        kr({ id: 'b', baseline: 0, target: 100, current: 0, weight: 1 }), // 0.0 w1
      ],
    };
    // (1*3 + 0*1) / 4 = 0.75
    expect(scoreObjective(o).score).toBeCloseTo(0.75, 6);
    expect(scoreObjective(o).status).toBe('on-track');
  });

  it('defaults missing weight to 1 (plain average)', () => {
    const o: Objective = {
      id: 'o',
      label: 'O',
      keyResults: [
        kr({ id: 'a', baseline: 0, target: 100, current: 100 }), // 1.0
        kr({ id: 'b', baseline: 0, target: 100, current: 0 }), // 0.0
      ],
    };
    expect(scoreObjective(o).score).toBeCloseTo(0.5, 6);
  });

  it('applies status thresholds (>=0.7 on, >=0.4 at-risk, else off)', () => {
    const mk = (current: number): Objective => ({
      id: 'o',
      label: 'O',
      keyResults: [kr({ baseline: 0, target: 100, current })],
    });
    expect(scoreObjective(mk(70)).status).toBe('on-track');
    expect(scoreObjective(mk(69)).status).toBe('at-risk');
    expect(scoreObjective(mk(40)).status).toBe('at-risk');
    expect(scoreObjective(mk(39)).status).toBe('off-track');
    expect(scoreObjective(mk(0)).status).toBe('off-track');
  });

  it('scores empty objective as 0 / off-track', () => {
    expect(scoreObjective({ id: 'o', label: 'O', keyResults: [] })).toEqual({
      score: 0,
      status: 'off-track',
    });
  });
});

describe('cascadeRollup', () => {
  it('leaf objectives roll up to their own score', () => {
    const objs: Objective[] = [
      { id: 'o', label: 'O', keyResults: [kr({ baseline: 0, target: 100, current: 80 })] },
    ];
    const [r] = cascadeRollup(objs);
    expect(r.score).toBeCloseTo(0.8, 6);
    expect(r.rollupScore).toBeCloseTo(0.8, 6);
  });

  it('parent blends own score with child rollups (mean)', () => {
    const objs: Objective[] = [
      // parent own = 1.0
      { id: 'p', label: 'P', keyResults: [kr({ baseline: 0, target: 100, current: 100 })] },
      // child own = 0.0
      {
        id: 'c',
        label: 'C',
        parentId: 'p',
        keyResults: [kr({ baseline: 0, target: 100, current: 0 })],
      },
    ];
    const byId = Object.fromEntries(cascadeRollup(objs).map((o) => [o.id, o]));
    expect(byId.p.score).toBeCloseTo(1, 6);
    // mean of [own 1.0, child 0.0] = 0.5
    expect(byId.p.rollupScore).toBeCloseTo(0.5, 6);
    expect(byId.c.rollupScore).toBeCloseTo(0, 6);
  });

  it('handles multi-level cascade', () => {
    const objs: Objective[] = [
      { id: 'p', label: 'P', keyResults: [] }, // own 0
      {
        id: 'c',
        label: 'C',
        parentId: 'p',
        keyResults: [kr({ baseline: 0, target: 100, current: 100 })], // own 1
      },
      {
        id: 'g',
        label: 'G',
        parentId: 'c',
        keyResults: [kr({ baseline: 0, target: 100, current: 100 })], // own 1
      },
    ];
    const byId = Object.fromEntries(cascadeRollup(objs).map((o) => [o.id, o]));
    expect(byId.g.rollupScore).toBeCloseTo(1, 6); // leaf
    // c: mean(own 1, g 1) = 1
    expect(byId.c.rollupScore).toBeCloseTo(1, 6);
    // p: mean(own 0, c 1) = 0.5
    expect(byId.p.rollupScore).toBeCloseTo(0.5, 6);
  });

  it('returns [] for empty input', () => {
    expect(cascadeRollup([])).toEqual([]);
  });
});

describe('okrSummary', () => {
  it('counts by status band and averages scores', () => {
    const objs: Objective[] = [
      { id: 'a', label: 'A', keyResults: [kr({ baseline: 0, target: 100, current: 80 })] }, // 0.8 on
      { id: 'b', label: 'B', keyResults: [kr({ baseline: 0, target: 100, current: 50 })] }, // 0.5 at-risk
      { id: 'c', label: 'C', keyResults: [kr({ baseline: 0, target: 100, current: 10 })] }, // 0.1 off
    ];
    const s = okrSummary(objs);
    expect(s.total).toBe(3);
    expect(s.onTrack).toBe(1);
    expect(s.atRisk).toBe(1);
    expect(s.offTrack).toBe(1);
    expect(s.avgScore).toBeCloseTo((0.8 + 0.5 + 0.1) / 3, 6);
  });

  it('returns zeros for empty input', () => {
    expect(okrSummary([])).toEqual({
      total: 0,
      onTrack: 0,
      atRisk: 0,
      offTrack: 0,
      avgScore: 0,
    });
  });
});
