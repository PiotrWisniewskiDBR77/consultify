import { describe, expect, it } from 'vitest';

import {
  analyzePlanDependenciesWithLlm,
  PlanDependencyAnalysisError,
  validatePlanDependencyAnalysis,
  type PlanDependencyAnalysisInput,
} from '../planDependencyAnalysisService.js';

const NO_RETRY = { retry: 0 } as const;

const input: PlanDependencyAnalysisInput = {
  scenarioId: 'plan-1',
  scenarioVersion: 7,
  timezone: 'Europe/Warsaw',
  horizon: { start: '2026-09-01T00:00:00.000Z', end: '2027-09-01T00:00:00.000Z' },
  initiatives: ['foundation', 'migration', 'training'].map((id) => ({
    id,
    title: id,
    status: 'APPROVED',
    summary: `${id} summary`,
    problemStatement: null,
    hypothesis: null,
    businessValue: null,
    scopeIn: [],
    scopeOut: [],
    deliverables: [],
    plannedStartDate: null,
    plannedEndDate: null,
    existingDependencies: [],
  })),
};

const valid = {
  observations: [
    {
      observationId: 'obs-absolute',
      predecessorId: 'foundation',
      successorId: 'migration',
      kind: 'ABSOLUTE',
      condition: null,
      rationale: 'The migration consumes the foundation deliverable.',
      evidenceRefs: ['deliverables', 'scopeIn'],
      confidence: 'HIGH',
    },
    {
      observationId: 'obs-conditional',
      predecessorId: 'migration',
      successorId: 'training',
      kind: 'CONDITIONAL',
      condition: 'Only when training uses the migrated production process.',
      rationale: 'Training otherwise may use the current process.',
      evidenceRefs: ['summary'],
      confidence: 'MEDIUM',
    },
  ],
  criticalPaths: [
    {
      pathId: 'path-absolute',
      kind: 'ABSOLUTE',
      initiativeIds: ['foundation', 'migration'],
      condition: null,
      rationale: 'Foundation gates migration.',
    },
    {
      pathId: 'path-conditional',
      kind: 'CONDITIONAL',
      initiativeIds: ['foundation', 'migration', 'training'],
      condition: 'Only when training uses the migrated production process.',
      rationale: 'The final edge is conditional.',
    },
  ],
};

describe('DEC-497 P2 E1 — grounded dependency analysis contract', NO_RETRY, () => {
  it('keeps absolute and conditional paths distinct', () => {
    const result = validatePlanDependencyAnalysis(valid, input);
    expect(result.observations.map((item) => [item.kind, item.condition])).toEqual([
      ['ABSOLUTE', null],
      ['CONDITIONAL', 'Only when training uses the migrated production process.'],
    ]);
    expect(result.criticalPaths.map((path) => path.kind)).toEqual(['ABSOLUTE', 'CONDITIONAL']);
  });

  it('calls the LLM with the real snapshot and validates its JSON before returning', async () => {
    let request: Record<string, any> | null = null;
    const result = await analyzePlanDependenciesWithLlm(input, {
      call: async (params) => {
        request = params;
        return { content: JSON.stringify(valid), model: 'test-reasoning-model' };
      },
    });
    expect(request?.modelConfig).toEqual({ id: 'premium' });
    expect(String(request?.messages?.[0]?.content)).toContain('"scenarioVersion":7');
    expect(String(request?.messages?.[0]?.content)).toContain('"id":"foundation"');
    expect(result.model).toBe('test-reasoning-model');
    expect(result.observations).toHaveLength(2);
  });

  it('fails closed when the configured provider cannot execute the analysis', async () => {
    await expect(
      analyzePlanDependenciesWithLlm(input, {
        call: async () => {
          throw new Error('provider unavailable');
        },
      })
    ).rejects.toMatchObject({ code: 'AI_UNAVAILABLE' });
  });

  it.each([
    [
      'invented initiative',
      {
        ...valid,
        observations: [{ ...valid.observations[0], predecessorId: 'invented' }],
      },
    ],
    [
      'conditional edge without condition',
      {
        ...valid,
        observations: [{ ...valid.observations[1], condition: null }],
        criticalPaths: [],
      },
    ],
    [
      'cycle',
      {
        ...valid,
        observations: [
          valid.observations[0],
          {
            ...valid.observations[1],
            predecessorId: 'migration',
            successorId: 'foundation',
          },
        ],
        criticalPaths: [],
      },
    ],
    [
      'critical path without supporting edge',
      {
        ...valid,
        criticalPaths: [
          {
            ...valid.criticalPaths[0],
            initiativeIds: ['foundation', 'training'],
          },
        ],
      },
    ],
  ])('fails closed on %s', (_label, response) => {
    expect(() => validatePlanDependencyAnalysis(response, input)).toThrow(
      PlanDependencyAnalysisError
    );
  });
});
