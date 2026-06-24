import { describe, it, expect } from 'vitest';
import {
  STAGE_ORDER,
  STAGE_DEFAULT_CONFIDENCE,
  riskAdjustedValue,
  classifyValue,
  stageFromInitiative,
  portfolioValueSplit,
  type ValueStage,
} from '../../../server/src/services/results/valueStageGateService.js';

describe('valueStageGateService — constants', () => {
  it('STAGE_ORDER is L0→L5 in order', () => {
    expect(STAGE_ORDER).toEqual([
      'L0_idea',
      'L1_sized',
      'L2_validated',
      'L3_planned',
      'L4_inflight',
      'L5_realized',
    ]);
  });

  it('STAGE_DEFAULT_CONFIDENCE rises monotonically L0→L5', () => {
    expect(STAGE_DEFAULT_CONFIDENCE).toEqual({
      L0_idea: 0.1,
      L1_sized: 0.3,
      L2_validated: 0.5,
      L3_planned: 0.7,
      L4_inflight: 0.85,
      L5_realized: 1.0,
    });
    for (let i = 1; i < STAGE_ORDER.length; i++) {
      expect(STAGE_DEFAULT_CONFIDENCE[STAGE_ORDER[i]]).toBeGreaterThan(
        STAGE_DEFAULT_CONFIDENCE[STAGE_ORDER[i - 1]],
      );
    }
  });
});

describe('riskAdjustedValue — clamp', () => {
  it('multiplies value by confidence', () => {
    expect(riskAdjustedValue(1000, 0.5)).toBe(500);
  });

  it('clamps confidence above 1 down to 1', () => {
    expect(riskAdjustedValue(1000, 1.5)).toBe(1000);
  });

  it('clamps negative confidence up to 0', () => {
    expect(riskAdjustedValue(1000, -0.3)).toBe(0);
  });

  it('handles confidence exactly at bounds', () => {
    expect(riskAdjustedValue(1000, 0)).toBe(0);
    expect(riskAdjustedValue(1000, 1)).toBe(1000);
  });

  it('degrades non-finite value/confidence to 0', () => {
    expect(riskAdjustedValue(NaN, 0.5)).toBe(0);
    expect(riskAdjustedValue(1000, NaN)).toBe(0);
    expect(riskAdjustedValue(Infinity, 0.5)).toBe(0);
  });
});

describe('classifyValue — L5 banked vs forecast', () => {
  it('L5_realized banks the full value, forecast 0', () => {
    const r = classifyValue({ stage: 'L5_realized', value: 1000 });
    expect(r.banked).toBe(1000);
    expect(r.forecast).toBe(0);
    expect(r.riskAdjusted).toBe(1000); // L5 default confidence 1.0
  });

  it('non-L5 stage produces forecast = riskAdjusted, banked 0', () => {
    const r = classifyValue({ stage: 'L2_validated', value: 1000 });
    expect(r.banked).toBe(0);
    expect(r.forecast).toBe(500); // 1000 * 0.5 default
    expect(r.riskAdjusted).toBe(500);
  });

  it('uses default confidence when none provided', () => {
    const r = classifyValue({ stage: 'L0_idea', value: 1000 });
    expect(r.forecast).toBe(100); // 1000 * 0.1
  });

  it('explicit confidence override beats the stage default', () => {
    const r = classifyValue({ stage: 'L0_idea', value: 1000, confidence: 0.9 });
    expect(r.forecast).toBe(900);
  });

  it('clamps an out-of-range explicit confidence', () => {
    const r = classifyValue({ stage: 'L3_planned', value: 1000, confidence: 2 });
    expect(r.forecast).toBe(1000);
  });

  it('L5 banks full value regardless of explicit confidence', () => {
    const r = classifyValue({ stage: 'L5_realized', value: 1000, confidence: 0.4 });
    expect(r.banked).toBe(1000);
    expect(r.forecast).toBe(0);
    expect(r.riskAdjusted).toBe(400);
  });
});

describe('stageFromInitiative — status mapping', () => {
  it('DRAFT/PLANNING → L0_idea (no baseline)', () => {
    expect(stageFromInitiative({ status: 'DRAFT' })).toBe('L0_idea');
    expect(stageFromInitiative({ status: 'PLANNING' })).toBe('L0_idea');
  });

  it('DRAFT with ROI baseline → L1_sized', () => {
    expect(stageFromInitiative({ status: 'DRAFT', hasRoiBaseline: true })).toBe('L1_sized');
  });

  it('APPROVED/SCHEDULED → L2_validated (no baseline)', () => {
    expect(stageFromInitiative({ status: 'APPROVED' })).toBe('L2_validated');
    expect(stageFromInitiative({ status: 'SCHEDULED' })).toBe('L2_validated');
  });

  it('APPROVED with ROI baseline → L3_planned', () => {
    expect(stageFromInitiative({ status: 'APPROVED', hasRoiBaseline: true })).toBe('L3_planned');
  });

  it('EXECUTING/BLOCKED → L4_inflight', () => {
    expect(stageFromInitiative({ status: 'EXECUTING' })).toBe('L4_inflight');
    expect(stageFromInitiative({ status: 'BLOCKED' })).toBe('L4_inflight');
  });

  it('DONE with realized value → L5_realized', () => {
    expect(stageFromInitiative({ status: 'DONE', hasRealized: true })).toBe('L5_realized');
    expect(stageFromInitiative({ status: 'TRACKING', hasRealized: true })).toBe('L5_realized');
  });

  it('DONE without realized value falls back to L4_inflight', () => {
    expect(stageFromInitiative({ status: 'DONE' })).toBe('L4_inflight');
  });

  it('is case-insensitive and trims', () => {
    expect(stageFromInitiative({ status: '  executing  ' })).toBe('L4_inflight');
  });

  it('unknown status leans on data signals', () => {
    expect(stageFromInitiative({ status: 'WEIRD' })).toBe('L0_idea');
    expect(stageFromInitiative({ status: 'WEIRD', hasRoiBaseline: true })).toBe('L1_sized');
    expect(stageFromInitiative({ status: 'WEIRD', hasRealized: true })).toBe('L5_realized');
    expect(stageFromInitiative({})).toBe('L0_idea');
  });
});

describe('portfolioValueSplit — sums', () => {
  it('sums banked, forecast, total, riskAdjustedTotal', () => {
    const items: Array<{ stage: ValueStage; value: number; confidence?: number }> = [
      { stage: 'L5_realized', value: 1000 }, // banked 1000, ra 1000
      { stage: 'L2_validated', value: 1000 }, // forecast 500, ra 500
      { stage: 'L0_idea', value: 2000 }, // forecast 200, ra 200
    ];
    const r = portfolioValueSplit(items);
    expect(r.banked).toBe(1000);
    expect(r.forecast).toBe(700);
    expect(r.total).toBe(1700);
    expect(r.riskAdjustedTotal).toBe(1700);
  });

  it('empty portfolio → all zeros', () => {
    const r = portfolioValueSplit([]);
    expect(r).toEqual({ banked: 0, forecast: 0, total: 0, riskAdjustedTotal: 0 });
  });

  it('handles a single forecast item', () => {
    const r = portfolioValueSplit([{ stage: 'L4_inflight', value: 1000 }]);
    expect(r.banked).toBe(0);
    expect(r.forecast).toBe(850); // 1000 * 0.85
    expect(r.total).toBe(850);
    expect(r.riskAdjustedTotal).toBe(850);
  });
});
