import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — programRollupService's own DB reads (queryHelpers) and the reused
// project-finance-rollup module (getProjectFinanceRollup + the root-initiative
// helpers). Mocking the reused module in isolation lets these tests verify
// programRollupService's OWN merge/hierarchy logic without re-testing Delta B
// (that's projectFinanceRollupService's own test surface) and without needing
// to also mock DbPromise (executionBudgetService's dependency, reached only
// transitively through getProjectFinanceRollup).
// ---------------------------------------------------------------------------
const mockQueryAll = vi.fn();
const mockQueryOne = vi.fn();

vi.mock('../../../utils/queryHelpers.js', () => ({
  queryAll: (...args: unknown[]) => mockQueryAll(...args),
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  buildInPlaceholders: (values: unknown[]) => values.map(() => '?').join(','),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn(), http: vi.fn() },
}));

const mockGetProjectFinanceRollup = vi.fn();
const mockGetValueRollup = vi.fn();
const mockGetBenefitsRollup = vi.fn();
const mockGetRoiRollup = vi.fn();

vi.mock('../../projectFinanceRollupService.js', () => ({
  getProjectFinanceRollup: (...args: unknown[]) => mockGetProjectFinanceRollup(...args),
  getValueRollup: (...args: unknown[]) => mockGetValueRollup(...args),
  getBenefitsRollup: (...args: unknown[]) => mockGetBenefitsRollup(...args),
  getRoiRollup: (...args: unknown[]) => mockGetRoiRollup(...args),
  toNumber: (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  },
}));

import {
  aggregateProjectRollups,
  bucketHealth,
  classifyStatus,
  dedupeIds,
  getProgramRollup,
  mergeProgramTotals,
} from '../programRollupService.js';

function projectRollup(overrides: Partial<any> = {}): any {
  return {
    projectId: 'proj_1',
    currency: 'PLN',
    initiativeCount: 2,
    budget: { containers: [], containerTotal: 1000 },
    initiativesBudget: { totalPlanned: 500, totalActual: 0, initiatives: [] },
    value: { perInitiative: [], total: 200 },
    benefits: { count: 1, targetTotal: 100, currentTotal: 50, byStatus: {} },
    roi: {
      capexTotal: 300,
      opexAnnualTotal: 40,
      avgExpectedRoiPercent: null,
      npvTotal: 90,
      initiativeCount: 2,
    },
    variance: { containerBudget: 1000, initiativesPlanned: 500, delta: 500, overCommitted: false },
    ...overrides,
  };
}

describe('programRollupService — pure functions', () => {
  describe('classifyStatus', () => {
    it('buckets executing/done/tracking as green', () => {
      expect(classifyStatus('EXECUTING')).toBe('green');
      expect(classifyStatus('done')).toBe('green');
      expect(classifyStatus('Tracking')).toBe('green');
    });

    it('buckets approved/review/promoted/scheduled/planning as amber', () => {
      expect(classifyStatus('APPROVED')).toBe('amber');
      expect(classifyStatus('planning')).toBe('amber');
    });

    it('buckets everything else (including null/unknown) as red', () => {
      expect(classifyStatus('CANCELLED')).toBe('red');
      expect(classifyStatus(null)).toBe('red');
      expect(classifyStatus(undefined)).toBe('red');
      expect(classifyStatus('')).toBe('red');
    });
  });

  describe('bucketHealth', () => {
    it('counts each row into exactly one bucket', () => {
      const buckets = bucketHealth([
        { status: 'EXECUTING' },
        { status: 'DONE' },
        { status: 'PLANNING' },
        { status: 'DRAFT' },
        { status: null },
      ]);
      expect(buckets).toEqual({ green: 2, amber: 1, red: 2 });
    });

    it('empty input → all-zero buckets', () => {
      expect(bucketHealth([])).toEqual({ green: 0, amber: 0, red: 0 });
    });
  });

  describe('dedupeIds', () => {
    it('unions multiple groups and drops duplicates/falsy', () => {
      expect(dedupeIds(['a', 'b'], ['b', 'c'], ['', undefined as unknown as string, 'a'])).toEqual([
        'a',
        'b',
        'c',
      ]);
    });

    it('empty groups → empty array', () => {
      expect(dedupeIds([], [])).toEqual([]);
    });
  });

  describe('aggregateProjectRollups', () => {
    it('sums budget/value/benefits/roi across multiple project rollups', () => {
      const rollups = [
        projectRollup({ projectId: 'p1' }),
        projectRollup({
          projectId: 'p2',
          budget: { containers: [], containerTotal: 2000 },
          initiativesBudget: { totalPlanned: 1500, totalActual: 0, initiatives: [] },
          value: { perInitiative: [], total: 800 },
          benefits: { count: 3, targetTotal: 900, currentTotal: 450, byStatus: {} },
          roi: {
            capexTotal: 700,
            opexAnnualTotal: 60,
            avgExpectedRoiPercent: null,
            npvTotal: 210,
            initiativeCount: 3,
          },
        }),
      ];

      const totals = aggregateProjectRollups(rollups);

      expect(totals.currency).toBe('PLN');
      expect(totals.containerTotal).toBe(3000); // 1000 + 2000
      expect(totals.initiativesPlanned).toBe(2000); // 500 + 1500
      expect(totals.value).toBe(1000); // 200 + 800
      expect(totals.benefits).toEqual({ count: 4, targetTotal: 1000, currentTotal: 500 });
      expect(totals.roi).toEqual({ capexTotal: 1000, opexAnnualTotal: 100, npvTotal: 300 });
    });

    it('empty project list → deterministic all-zero totals, default currency PLN', () => {
      const totals = aggregateProjectRollups([]);
      expect(totals).toEqual({
        currency: 'PLN',
        containerTotal: 0,
        initiativesPlanned: 0,
        value: 0,
        benefits: { count: 0, targetTotal: 0, currentTotal: 0 },
        roi: { capexTotal: 0, opexAnnualTotal: 0, npvTotal: 0 },
      });
    });
  });

  describe('mergeProgramTotals', () => {
    it('adds the root-initiative layer on top of the project layer', () => {
      const projectLayer = aggregateProjectRollups([projectRollup()]);
      const merged = mergeProgramTotals(projectLayer, {
        value: 50,
        benefits: { count: 1, targetTotal: 20, currentTotal: 10 },
        roi: { capexTotal: 30, opexAnnualTotal: 5, npvTotal: 15 },
        initiativesPlanned: 100,
      });

      expect(merged.budget.containerTotal).toBe(1000); // project-only (root has no container)
      expect(merged.budget.initiativesPlanned).toBe(600); // 500 + 100
      expect(merged.value.total).toBe(250); // 200 + 50
      expect(merged.benefits).toEqual({ count: 2, targetTotal: 120, currentTotal: 60 });
      expect(merged.roi).toEqual({ capexTotal: 330, opexAnnualTotal: 45, npvTotal: 105 });
    });

    it('root layer with all zeros leaves project layer totals unchanged', () => {
      const projectLayer = aggregateProjectRollups([projectRollup()]);
      const merged = mergeProgramTotals(projectLayer, {
        value: 0,
        benefits: { count: 0, targetTotal: 0, currentTotal: 0 },
        roi: { capexTotal: 0, opexAnnualTotal: 0, npvTotal: 0 },
        initiativesPlanned: 0,
      });
      expect(merged.value.total).toBe(projectLayer.value);
      expect(merged.budget.initiativesPlanned).toBe(projectLayer.initiativesPlanned);
    });
  });
});

describe('programRollupService — getProgramRollup (DB-mocked)', () => {
  beforeEach(() => {
    mockQueryAll.mockReset();
    mockQueryOne.mockReset();
    mockGetProjectFinanceRollup.mockReset();
    mockGetValueRollup.mockReset();
    mockGetBenefitsRollup.mockReset();
    mockGetRoiRollup.mockReset();
  });

  it('returns null when the program does not exist for the org', async () => {
    mockQueryOne.mockResolvedValueOnce(null); // program lookup

    const result = await getProgramRollup('org_1', 'prog_missing');

    expect(result).toBeNull();
  });

  it('sums projects → program and adds root (project-less) initiatives without double counting', async () => {
    // 1) program row
    mockQueryOne.mockResolvedValueOnce({
      id: 'prog_1',
      organization_id: 'org_1',
      name: 'Digital Transformation',
      description: null,
      parent_program_id: null,
      status: 'active',
      owner_user_id: null,
      start_date: null,
      end_date: null,
    });

    // 2) projects.program_id lookup → two projects under this program
    mockQueryAll.mockResolvedValueOnce([{ id: 'proj_a' }, { id: 'proj_b' }]);
    // 3) project names
    mockQueryAll.mockResolvedValueOnce([
      { id: 'proj_a', name: 'Project A' },
      { id: 'proj_b', name: 'Project B' },
    ]);
    // 4) child programs (none)
    mockQueryAll.mockResolvedValueOnce([]);
    // 5) initiative rows under program ∪ projects — 2 project-linked + 1 root
    mockQueryAll.mockResolvedValueOnce([
      { id: 'init_1', status: 'EXECUTING', project_id: 'proj_a' },
      { id: 'init_2', status: 'DONE', project_id: 'proj_b' },
      { id: 'init_3', status: 'PLANNING', project_id: null },
    ]);
    // 6) root-initiative budget planned query (initiative_budget_items)
    mockQueryOne.mockResolvedValueOnce({ total: 150 });

    mockGetProjectFinanceRollup.mockImplementation(async (_org: string, projectId: string) => {
      if (projectId === 'proj_a') {
        return projectRollup({
          projectId: 'proj_a',
          budget: { containers: [], containerTotal: 1000 },
          initiativesBudget: { totalPlanned: 500, totalActual: 0, initiatives: [] },
          value: { perInitiative: [], total: 200 },
        });
      }
      return projectRollup({
        projectId: 'proj_b',
        budget: { containers: [], containerTotal: 2000 },
        initiativesBudget: { totalPlanned: 1500, totalActual: 0, initiatives: [] },
        value: { perInitiative: [], total: 800 },
        benefits: { count: 2, targetTotal: 400, currentTotal: 200, byStatus: {} },
      });
    });
    mockGetValueRollup.mockResolvedValueOnce({ perInitiative: [], total: 75 });
    mockGetBenefitsRollup.mockResolvedValueOnce({
      count: 1,
      targetTotal: 50,
      currentTotal: 25,
      byStatus: {},
    });
    mockGetRoiRollup.mockResolvedValueOnce({
      capexTotal: 100,
      opexAnnualTotal: 10,
      avgExpectedRoiPercent: null,
      npvTotal: 40,
      initiativeCount: 1,
    });

    const result = await getProgramRollup('org_1', 'prog_1');

    expect(result).not.toBeNull();
    expect(result!.program.id).toBe('prog_1');
    expect(result!.projectCount).toBe(2);
    expect(result!.initiativeCount).toBe(3);

    // project layer: 1000+2000 container, 500+1500 planned, 200+800 value
    // root layer added on top: +150 planned, +75 value
    expect(result!.budget.containerTotal).toBe(3000);
    expect(result!.budget.initiativesPlanned).toBe(2150);
    expect(result!.value.total).toBe(1075);

    // health: EXECUTING=green, DONE=green, PLANNING=amber
    expect(result!.health).toEqual({ green: 2, amber: 1, red: 0 });

    // root-initiative rollup was called with ONLY the project-less initiative id
    expect(mockGetValueRollup).toHaveBeenCalledWith('org_1', ['init_3']);
    expect(mockGetBenefitsRollup).toHaveBeenCalledWith('org_1', ['init_3']);
    expect(mockGetRoiRollup).toHaveBeenCalledWith('org_1', ['init_3']);

    expect(result!.projects).toHaveLength(2);
    expect(result!.projects.map((p) => p.projectId).sort()).toEqual(['proj_a', 'proj_b']);
  });

  it('degrades to zero projects when projects.program_id is not queryable (migration 916 not applied)', async () => {
    mockQueryOne.mockResolvedValueOnce({
      id: 'prog_2',
      organization_id: 'org_1',
      name: 'Program Without Project Column Yet',
      description: null,
      parent_program_id: null,
      status: 'active',
      owner_user_id: null,
      start_date: null,
      end_date: null,
    });

    // projects.program_id query throws (column doesn't exist yet)
    mockQueryAll.mockRejectedValueOnce(new Error('column "program_id" does not exist'));
    // getProjectNames short-circuits (no DB call) when projectIds is empty — NOT queued here.
    // child programs
    mockQueryAll.mockResolvedValueOnce([]);
    // initiative rows — only direct program_id match (no project filter branch)
    mockQueryAll.mockResolvedValueOnce([{ id: 'init_root', status: 'TRACKING', project_id: null }]);
    // root budget planned
    mockQueryOne.mockResolvedValueOnce({ total: 0 });

    mockGetValueRollup.mockResolvedValueOnce({ perInitiative: [], total: 0 });
    mockGetBenefitsRollup.mockResolvedValueOnce({
      count: 0,
      targetTotal: 0,
      currentTotal: 0,
      byStatus: {},
    });
    mockGetRoiRollup.mockResolvedValueOnce({
      capexTotal: 0,
      opexAnnualTotal: 0,
      avgExpectedRoiPercent: null,
      npvTotal: 0,
      initiativeCount: 0,
    });

    const result = await getProgramRollup('org_1', 'prog_2');

    expect(result).not.toBeNull();
    expect(result!.projectCount).toBe(0);
    expect(result!.projects).toEqual([]);
    expect(result!.initiativeCount).toBe(1);
    expect(mockGetProjectFinanceRollup).not.toHaveBeenCalled();
  });
});
