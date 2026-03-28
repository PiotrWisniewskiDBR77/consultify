import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';

import type {
  AffectedDimension,
  CheckMaterialChangeParams,
  CreateCrossInitiativeDependencyParams,
  CreateDecisionChainParams,
  RecordDecompositionParams,
} from '../../../types/planningContinuity.js';
import {
  AffectedDimensionValues,
  CheckMaterialChangeParamsSchema,
  CreateCrossInitiativeDependencyParamsSchema,
  CreateDecisionChainParamsSchema,
  CrossDependencyStatusValues,
  CrossDependencyTypeValues,
  CrossInitiativeDependencySchema,
  DecisionChainSchema,
  DecisionChainStatusValues,
  DecisionChainTypeValues,
  DecompositionObjectTypeValues,
  HIGH_IMPACT_DIMENSIONS,
  InitiativeDecompositionSchema,
  MaterialChangeCheckSchema,
  MATERIALITY_MIN_DIMENSIONS,
  RecordDecompositionParamsSchema,
  WBS_DEPTH_MAP,
  WBS_MAX_DEPTH,
  WBSLevelValues,
} from '../../../types/planningContinuity.js';

// ==========================================
// MOCK DB LAYER
// ==========================================

const mockDbRun = vi.fn().mockResolvedValue({ success: true });
const mockDbGet = vi.fn().mockResolvedValue(null);
const mockDbAll = vi.fn().mockResolvedValue([]);

vi.mock('../../../utils/DbPromise.js', () => ({
  run: (...args: unknown[]) => mockDbRun(...args),
  get: (...args: unknown[]) => mockDbGet(...args),
  all: (...args: unknown[]) => mockDbAll(...args),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  checkMaterialChange,
  createCrossInitiativeDependency,
  createDecisionChain,
  getCrossInitiativeDependencies,
  getDecisionChain,
  getDecisionChainsByInitiative,
  getDecomposition,
  getDecompositionTree,
  recordDecomposition,
  updateCrossInitiativeDependencyStatus,
} from '../planningContinuityService.js';

// ==========================================
// FIXTURES
// ==========================================

const ORG_ID = '00000000-0000-4000-8000-000000000001';
const OTHER_ORG_ID = '00000000-0000-4000-8000-000000000099';
const INITIATIVE_ID = '00000000-0000-4000-8000-000000000010';
const INITIATIVE_ID_B = '00000000-0000-4000-8000-000000000011';
const PARENT_DECOMP_ID = '00000000-0000-4000-8000-aaaaaaaaaaaa';

function makeDecompParams(
  overrides?: Partial<RecordDecompositionParams>
): RecordDecompositionParams {
  return {
    organizationId: ORG_ID,
    initiativeId: INITIATIVE_ID,
    parentId: null,
    wbsLevel: 'workstream_phase',
    objectType: 'workstream',
    objectId: 'ws-001',
    approvalInherited: true,
    metadata: { source: 'test' },
    ...overrides,
  };
}

function makeFakeDecompRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    decomposition_id: PARENT_DECOMP_ID,
    organization_id: ORG_ID,
    initiative_id: INITIATIVE_ID,
    parent_id: null,
    wbs_level: 'workstream_phase',
    object_type: 'workstream',
    object_id: 'ws-001',
    approval_inherited: 1,
    created_at: '2026-03-23T10:00:00.000Z',
    updated_at: '2026-03-23T10:00:00.000Z',
    metadata: JSON.stringify({ source: 'test' }),
    ...overrides,
  };
}

function makeCrossDepParams(
  overrides?: Partial<CreateCrossInitiativeDependencyParams>
): CreateCrossInitiativeDependencyParams {
  return {
    organizationId: ORG_ID,
    sourceInitiativeId: INITIATIVE_ID,
    targetInitiativeId: INITIATIVE_ID_B,
    dependencyType: 'blocks',
    description: 'Initiative A blocks Initiative B',
    metadata: {},
    ...overrides,
  };
}

function makeFakeCrossDepRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    dependency_id: '00000000-0000-4000-8000-dddddddddddd',
    organization_id: ORG_ID,
    source_initiative_id: INITIATIVE_ID,
    target_initiative_id: INITIATIVE_ID_B,
    dependency_type: 'blocks',
    status: 'active',
    description: 'Initiative A blocks Initiative B',
    created_at: '2026-03-23T10:00:00.000Z',
    updated_at: '2026-03-23T10:00:00.000Z',
    metadata: '{}',
    ...overrides,
  };
}

function makeChainParams(
  overrides?: Partial<CreateDecisionChainParams>
): CreateDecisionChainParams {
  return {
    organizationId: ORG_ID,
    initiativeId: INITIATIVE_ID,
    chainType: 'sequential',
    decisions: [
      { decisionId: 'dec-1', order: 0 },
      { decisionId: 'dec-2', order: 1 },
    ],
    metadata: {},
    ...overrides,
  };
}

function makeFakeChainRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    chain_id: '00000000-0000-4000-8000-eeeeeeeeeeee',
    organization_id: ORG_ID,
    initiative_id: INITIATIVE_ID,
    chain_type: 'sequential',
    decisions: JSON.stringify([
      { decisionId: 'dec-1', order: 0, status: 'pending', decidedBy: null, decidedAt: null },
      { decisionId: 'dec-2', order: 1, status: 'pending', decidedBy: null, decidedAt: null },
    ]),
    status: 'open',
    created_at: '2026-03-23T10:00:00.000Z',
    updated_at: '2026-03-23T10:00:00.000Z',
    metadata: '{}',
    ...overrides,
  };
}

// ==========================================
// TESTS
// ==========================================

beforeEach(() => {
  vi.clearAllMocks();
});

// ------------------------------------------
// DECOMPOSITION (Decision W3-4)
// ------------------------------------------

describe('recordDecomposition', () => {
  it('records a workstream_phase decomposition without parent', async () => {
    const result = await recordDecomposition(makeDecompParams());

    expect(result.decompositionId).toBeDefined();
    expect(result.organizationId).toBe(ORG_ID);
    expect(result.initiativeId).toBe(INITIATIVE_ID);
    expect(result.parentId).toBeNull();
    expect(result.wbsLevel).toBe('workstream_phase');
    expect(result.objectType).toBe('workstream');
    expect(result.objectId).toBe('ws-001');
    expect(result.approvalInherited).toBe(true);
    expect(result.metadata).toEqual({ source: 'test' });

    expect(mockDbRun).toHaveBeenCalledOnce();
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO v8_initiative_decompositions');
  });

  it('records a task decomposition with parent validation', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeDecompRow({ wbs_level: 'workstream_phase' }));

    const result = await recordDecomposition(
      makeDecompParams({
        parentId: PARENT_DECOMP_ID,
        wbsLevel: 'task',
        objectType: 'task',
        objectId: 'task-001',
      })
    );

    expect(result.wbsLevel).toBe('task');
    expect(result.parentId).toBe(PARENT_DECOMP_ID);
  });

  it('records a subtask decomposition (max depth)', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeDecompRow({ wbs_level: 'task' }));

    const result = await recordDecomposition(
      makeDecompParams({
        parentId: PARENT_DECOMP_ID,
        wbsLevel: 'subtask',
        objectType: 'subtask',
        objectId: 'sub-001',
      })
    );

    expect(result.wbsLevel).toBe('subtask');
  });

  it('rejects child at same depth as parent', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeDecompRow({ wbs_level: 'task' }));

    await expect(
      recordDecomposition(
        makeDecompParams({
          parentId: PARENT_DECOMP_ID,
          wbsLevel: 'task',
          objectType: 'task',
          objectId: 'task-dup',
        })
      )
    ).rejects.toThrow('WBS hierarchy violation');
  });

  it('rejects child shallower than parent', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeDecompRow({ wbs_level: 'task' }));

    await expect(
      recordDecomposition(
        makeDecompParams({
          parentId: PARENT_DECOMP_ID,
          wbsLevel: 'workstream_phase',
          objectType: 'workstream',
          objectId: 'ws-bad',
        })
      )
    ).rejects.toThrow('WBS hierarchy violation');
  });

  it('rejects when parent not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await expect(
      recordDecomposition(
        makeDecompParams({
          parentId: '00000000-0000-4000-8000-ffffffffffff',
          wbsLevel: 'task',
          objectType: 'task',
          objectId: 'task-orphan',
        })
      )
    ).rejects.toThrow('Parent decomposition');
  });

  it('defaults approvalInherited to true', async () => {
    const result = await recordDecomposition(makeDecompParams({ approvalInherited: undefined }));
    expect(result.approvalInherited).toBe(true);
  });

  it('defaults metadata to empty object', async () => {
    const result = await recordDecomposition(makeDecompParams({ metadata: undefined }));
    expect(result.metadata).toEqual({});
  });

  it('rejects invalid UUID for organizationId', async () => {
    await expect(
      recordDecomposition(makeDecompParams({ organizationId: 'not-a-uuid' }))
    ).rejects.toThrow(ZodError);
  });

  it('rejects invalid wbsLevel', async () => {
    await expect(
      recordDecomposition(makeDecompParams({ wbsLevel: 'epic' as any }))
    ).rejects.toThrow(ZodError);
  });

  it('rejects empty objectId', async () => {
    await expect(recordDecomposition(makeDecompParams({ objectId: '' }))).rejects.toThrow(ZodError);
  });
});

describe('getDecompositionTree', () => {
  it('returns decomposition tree ordered by WBS depth', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakeDecompRow({ wbs_level: 'workstream_phase' }),
      makeFakeDecompRow({
        decomposition_id: 'dec-2',
        wbs_level: 'task',
        object_type: 'task',
        object_id: 'task-001',
        parent_id: PARENT_DECOMP_ID,
      }),
    ]);

    const results = await getDecompositionTree(INITIATIVE_ID, ORG_ID);

    expect(results).toHaveLength(2);
    expect(results[0].wbsLevel).toBe('workstream_phase');
    expect(results[1].wbsLevel).toBe('task');

    const sql = mockDbAll.mock.calls[0][0] as string;
    expect(sql).toContain('organization_id');
  });

  it('returns empty array when no decompositions exist', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getDecompositionTree(INITIATIVE_ID, ORG_ID);
    expect(results).toEqual([]);
  });

  it('enforces org isolation in query', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    await getDecompositionTree(INITIATIVE_ID, OTHER_ORG_ID);

    const params = mockDbAll.mock.calls[0][1] as unknown[];
    expect(params).toContain(OTHER_ORG_ID);
  });
});

describe('getDecomposition', () => {
  it('returns a single decomposition by ID', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeDecompRow());

    const result = await getDecomposition(PARENT_DECOMP_ID, ORG_ID);

    expect(result).not.toBeNull();
    expect(result!.decompositionId).toBe(PARENT_DECOMP_ID);
  });

  it('returns null when not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    const result = await getDecomposition('nonexistent', ORG_ID);
    expect(result).toBeNull();
  });

  it('enforces org isolation', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    await getDecomposition(PARENT_DECOMP_ID, OTHER_ORG_ID);

    const params = mockDbGet.mock.calls[0][1] as unknown[];
    expect(params).toContain(OTHER_ORG_ID);
  });
});

// ------------------------------------------
// MATERIAL CHANGE DETECTION (Decision W3-5)
// ------------------------------------------

describe('checkMaterialChange', () => {
  it('detects material change for high-impact dimension (scope)', () => {
    const result = checkMaterialChange({ affectedDimensions: ['scope'] });

    expect(result.isMaterial).toBe(true);
    expect(result.requiresChangeManagement).toBe(true);
    expect(result.affectedDimensions).toEqual(['scope']);
  });

  it('detects material change for high-impact dimension (timeline)', () => {
    const result = checkMaterialChange({ affectedDimensions: ['timeline'] });
    expect(result.isMaterial).toBe(true);
  });

  it('detects material change for high-impact dimension (critical_path)', () => {
    const result = checkMaterialChange({ affectedDimensions: ['critical_path'] });
    expect(result.isMaterial).toBe(true);
  });

  it('detects material change for high-impact dimension (cost)', () => {
    const result = checkMaterialChange({ affectedDimensions: ['cost'] });
    expect(result.isMaterial).toBe(true);
  });

  it('detects material change for non-high-impact dimension (capacity)', () => {
    const result = checkMaterialChange({ affectedDimensions: ['capacity'] });
    expect(result.isMaterial).toBe(true);
    expect(result.requiresChangeManagement).toBe(true);
  });

  it('detects non-material change for empty dimensions', () => {
    const result = checkMaterialChange({ affectedDimensions: [] });
    expect(result.isMaterial).toBe(false);
    expect(result.requiresChangeManagement).toBe(false);
  });

  it('includes summary when provided', () => {
    const result = checkMaterialChange({
      affectedDimensions: ['scope'],
      summary: 'Scope expanded by 30%',
    });
    expect(result.summary).toBe('Scope expanded by 30%');
  });

  it('defaults summary to null', () => {
    const result = checkMaterialChange({ affectedDimensions: ['scope'] });
    expect(result.summary).toBeNull();
  });

  it('handles multiple dimensions', () => {
    const result = checkMaterialChange({
      affectedDimensions: ['scope', 'timeline', 'capacity'],
    });
    expect(result.isMaterial).toBe(true);
    expect(result.affectedDimensions).toHaveLength(3);
  });

  it('validates against schema', () => {
    const result = checkMaterialChange({ affectedDimensions: ['quality', 'benefit_kpi'] });
    expect(() => MaterialChangeCheckSchema.parse(result)).not.toThrow();
  });

  it('rejects invalid dimension via Zod', () => {
    expect(() =>
      CheckMaterialChangeParamsSchema.parse({
        affectedDimensions: ['invalid_dimension'],
      })
    ).toThrow(ZodError);
  });
});

// ------------------------------------------
// CROSS-INITIATIVE DEPENDENCIES (Decision W3-6)
// ------------------------------------------

describe('createCrossInitiativeDependency', () => {
  it('creates a cross-initiative dependency in active status', async () => {
    const result = await createCrossInitiativeDependency(makeCrossDepParams());

    expect(result.dependencyId).toBeDefined();
    expect(result.organizationId).toBe(ORG_ID);
    expect(result.sourceInitiativeId).toBe(INITIATIVE_ID);
    expect(result.targetInitiativeId).toBe(INITIATIVE_ID_B);
    expect(result.dependencyType).toBe('blocks');
    expect(result.status).toBe('active');
    expect(result.description).toBe('Initiative A blocks Initiative B');

    expect(mockDbRun).toHaveBeenCalledOnce();
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO v8_cross_initiative_dependencies');
  });

  it('rejects self-referencing dependency', async () => {
    await expect(
      createCrossInitiativeDependency(
        makeCrossDepParams({
          targetInitiativeId: INITIATIVE_ID,
        })
      )
    ).rejects.toThrow('different source and target');
  });

  it('supports all dependency types', async () => {
    const types = [
      'blocks',
      'blocked_by',
      'depends_on',
      'enables',
      'shares_resource',
      'shares_milestone',
    ] as const;

    for (const dependencyType of types) {
      vi.clearAllMocks();
      const result = await createCrossInitiativeDependency(makeCrossDepParams({ dependencyType }));
      expect(result.dependencyType).toBe(dependencyType);
    }
  });

  it('rejects invalid dependency type via Zod', async () => {
    await expect(
      createCrossInitiativeDependency(makeCrossDepParams({ dependencyType: 'invalid' as any }))
    ).rejects.toThrow(ZodError);
  });

  it('defaults description to null', async () => {
    const result = await createCrossInitiativeDependency(
      makeCrossDepParams({ description: undefined })
    );
    expect(result.description).toBeNull();
  });
});

describe('getCrossInitiativeDependencies', () => {
  it('returns dependencies where initiative is source or target', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakeCrossDepRow(),
      makeFakeCrossDepRow({
        dependency_id: 'dep-2',
        dependency_type: 'depends_on',
        source_initiative_id: INITIATIVE_ID_B,
        target_initiative_id: INITIATIVE_ID,
      }),
    ]);

    const results = await getCrossInitiativeDependencies(INITIATIVE_ID, ORG_ID);

    expect(results).toHaveLength(2);
    const sql = mockDbAll.mock.calls[0][0] as string;
    expect(sql).toContain('source_initiative_id');
    expect(sql).toContain('target_initiative_id');
  });

  it('returns empty array when no dependencies exist', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getCrossInitiativeDependencies(INITIATIVE_ID, ORG_ID);
    expect(results).toEqual([]);
  });

  it('enforces org isolation', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    await getCrossInitiativeDependencies(INITIATIVE_ID, OTHER_ORG_ID);

    const params = mockDbAll.mock.calls[0][1] as unknown[];
    expect(params[0]).toBe(OTHER_ORG_ID);
  });
});

describe('updateCrossInitiativeDependencyStatus', () => {
  it('updates dependency status to resolved', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeCrossDepRow());

    const result = await updateCrossInitiativeDependencyStatus(
      '00000000-0000-4000-8000-dddddddddddd',
      ORG_ID,
      'resolved'
    );

    expect(result.status).toBe('resolved');
    expect(mockDbRun).toHaveBeenCalledOnce();
  });

  it('throws when dependency not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);

    await expect(
      updateCrossInitiativeDependencyStatus('nonexistent', ORG_ID, 'resolved')
    ).rejects.toThrow('not found');
  });
});

// ------------------------------------------
// DECISION CHAINS (Decision W3-7)
// ------------------------------------------

describe('createDecisionChain', () => {
  it('creates a sequential decision chain with pending decisions', async () => {
    const result = await createDecisionChain(makeChainParams());

    expect(result.chainId).toBeDefined();
    expect(result.organizationId).toBe(ORG_ID);
    expect(result.initiativeId).toBe(INITIATIVE_ID);
    expect(result.chainType).toBe('sequential');
    expect(result.status).toBe('open');
    expect(result.decisions).toHaveLength(2);
    expect(result.decisions[0].status).toBe('pending');
    expect(result.decisions[0].decidedBy).toBeNull();
    expect(result.decisions[1].status).toBe('pending');

    expect(mockDbRun).toHaveBeenCalledOnce();
    const sql = mockDbRun.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO v8_decision_chains');
  });

  it('creates a parallel decision chain', async () => {
    const result = await createDecisionChain(makeChainParams({ chainType: 'parallel' }));
    expect(result.chainType).toBe('parallel');
  });

  it('creates a delegated decision chain', async () => {
    const result = await createDecisionChain(makeChainParams({ chainType: 'delegated' }));
    expect(result.chainType).toBe('delegated');
  });

  it('rejects empty decisions array', async () => {
    await expect(createDecisionChain(makeChainParams({ decisions: [] }))).rejects.toThrow(ZodError);
  });

  it('rejects invalid chain type via Zod', async () => {
    await expect(
      createDecisionChain(makeChainParams({ chainType: 'workflow' as any }))
    ).rejects.toThrow(ZodError);
  });

  it('rejects invalid UUID for initiativeId', async () => {
    await expect(
      createDecisionChain(makeChainParams({ initiativeId: 'not-a-uuid' }))
    ).rejects.toThrow(ZodError);
  });
});

describe('getDecisionChain', () => {
  it('returns a chain by ID with org isolation', async () => {
    mockDbGet.mockResolvedValueOnce(makeFakeChainRow());

    const result = await getDecisionChain('00000000-0000-4000-8000-eeeeeeeeeeee', ORG_ID);

    expect(result).not.toBeNull();
    expect(result!.chainId).toBe('00000000-0000-4000-8000-eeeeeeeeeeee');
    expect(result!.chainType).toBe('sequential');
    expect(result!.decisions).toHaveLength(2);
  });

  it('returns null when chain not found', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    const result = await getDecisionChain('nonexistent', ORG_ID);
    expect(result).toBeNull();
  });

  it('enforces org isolation', async () => {
    mockDbGet.mockResolvedValueOnce(null);
    await getDecisionChain('00000000-0000-4000-8000-eeeeeeeeeeee', OTHER_ORG_ID);

    const params = mockDbGet.mock.calls[0][1] as unknown[];
    expect(params).toContain(OTHER_ORG_ID);
  });
});

describe('getDecisionChainsByInitiative', () => {
  it('returns chains for an initiative', async () => {
    mockDbAll.mockResolvedValueOnce([
      makeFakeChainRow(),
      makeFakeChainRow({ chain_id: 'chain-2', chain_type: 'parallel' }),
    ]);

    const results = await getDecisionChainsByInitiative(INITIATIVE_ID, ORG_ID);

    expect(results).toHaveLength(2);
    expect(results[0].chainType).toBe('sequential');
    expect(results[1].chainType).toBe('parallel');
  });

  it('returns empty array when no chains exist', async () => {
    mockDbAll.mockResolvedValueOnce([]);
    const results = await getDecisionChainsByInitiative(INITIATIVE_ID, ORG_ID);
    expect(results).toEqual([]);
  });
});

// ------------------------------------------
// ZOD SCHEMA VALIDATION
// ------------------------------------------

describe('Zod schema validation', () => {
  it('validates a correct InitiativeDecomposition', () => {
    const valid = {
      decompositionId: PARENT_DECOMP_ID,
      organizationId: ORG_ID,
      initiativeId: INITIATIVE_ID,
      parentId: null,
      wbsLevel: 'workstream_phase' as const,
      objectType: 'workstream' as const,
      objectId: 'ws-001',
      approvalInherited: true,
      createdAt: '2026-03-23T10:00:00.000Z',
      updatedAt: '2026-03-23T10:00:00.000Z',
      metadata: {},
    };
    expect(() => InitiativeDecompositionSchema.parse(valid)).not.toThrow();
  });

  it('rejects decomposition with invalid wbsLevel', () => {
    expect(() =>
      InitiativeDecompositionSchema.parse({
        decompositionId: PARENT_DECOMP_ID,
        organizationId: ORG_ID,
        initiativeId: INITIATIVE_ID,
        parentId: null,
        wbsLevel: 'epic',
        objectType: 'workstream',
        objectId: 'ws-001',
        approvalInherited: true,
        createdAt: '2026-03-23T10:00:00.000Z',
        updatedAt: '2026-03-23T10:00:00.000Z',
        metadata: {},
      })
    ).toThrow(ZodError);
  });

  it('validates a correct CrossInitiativeDependency', () => {
    const valid = {
      dependencyId: '00000000-0000-4000-8000-dddddddddddd',
      organizationId: ORG_ID,
      sourceInitiativeId: INITIATIVE_ID,
      targetInitiativeId: INITIATIVE_ID_B,
      dependencyType: 'blocks' as const,
      status: 'active' as const,
      description: null,
      createdAt: '2026-03-23T10:00:00.000Z',
      updatedAt: '2026-03-23T10:00:00.000Z',
      metadata: {},
    };
    expect(() => CrossInitiativeDependencySchema.parse(valid)).not.toThrow();
  });

  it('validates a correct DecisionChain', () => {
    const valid = {
      chainId: '00000000-0000-4000-8000-eeeeeeeeeeee',
      organizationId: ORG_ID,
      initiativeId: INITIATIVE_ID,
      chainType: 'sequential' as const,
      decisions: [
        {
          decisionId: 'dec-1',
          order: 0,
          status: 'pending' as const,
          decidedBy: null,
          decidedAt: null,
        },
      ],
      status: 'open' as const,
      createdAt: '2026-03-23T10:00:00.000Z',
      updatedAt: '2026-03-23T10:00:00.000Z',
      metadata: {},
    };
    expect(() => DecisionChainSchema.parse(valid)).not.toThrow();
  });

  it('validates RecordDecompositionParams', () => {
    expect(() => RecordDecompositionParamsSchema.parse(makeDecompParams())).not.toThrow();
  });

  it('validates CreateCrossInitiativeDependencyParams', () => {
    expect(() =>
      CreateCrossInitiativeDependencyParamsSchema.parse(makeCrossDepParams())
    ).not.toThrow();
  });

  it('validates CreateDecisionChainParams', () => {
    expect(() => CreateDecisionChainParamsSchema.parse(makeChainParams())).not.toThrow();
  });
});

// ------------------------------------------
// TYPE CONSTANTS COMPLETENESS
// ------------------------------------------

describe('type constants completeness', () => {
  it('WBS_DEPTH_MAP covers all WBSLevel values', () => {
    for (const level of WBSLevelValues) {
      expect(WBS_DEPTH_MAP).toHaveProperty(level);
      expect(typeof WBS_DEPTH_MAP[level]).toBe('number');
    }
  });

  it('WBS_MAX_DEPTH equals 4 (Decision W3-4)', () => {
    expect(WBS_MAX_DEPTH).toBe(4);
  });

  it('HIGH_IMPACT_DIMENSIONS contains scope, timeline, critical_path, cost', () => {
    expect(HIGH_IMPACT_DIMENSIONS.has('scope')).toBe(true);
    expect(HIGH_IMPACT_DIMENSIONS.has('timeline')).toBe(true);
    expect(HIGH_IMPACT_DIMENSIONS.has('critical_path')).toBe(true);
    expect(HIGH_IMPACT_DIMENSIONS.has('cost')).toBe(true);
    expect(HIGH_IMPACT_DIMENSIONS.has('capacity')).toBe(false);
  });

  it('MATERIALITY_MIN_DIMENSIONS is 1', () => {
    expect(MATERIALITY_MIN_DIMENSIONS).toBe(1);
  });

  it('all enum arrays have expected lengths', () => {
    expect(WBSLevelValues).toHaveLength(4);
    expect(DecompositionObjectTypeValues).toHaveLength(4);
    expect(AffectedDimensionValues).toHaveLength(8);
    expect(CrossDependencyTypeValues).toHaveLength(6);
    expect(CrossDependencyStatusValues).toHaveLength(4);
    expect(DecisionChainTypeValues).toHaveLength(3);
    expect(DecisionChainStatusValues).toHaveLength(4);
  });
});
