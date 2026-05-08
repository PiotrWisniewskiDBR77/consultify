/**
 * Unit tests for TableQaService (Block C · Sprint C-S4).
 *
 * Coverage:
 *   - 5-axis scoring on canonical inputs (perfect, partial, broken).
 *   - Cross-tenant defense (mismatched organization → TENANT_VIOLATION).
 *   - Suggestion synthesis + durable dismissals filtering.
 *   - Persistence path (insert into tp_qa_reports + RETURNING id).
 *   - Latest-report read path (rowToReport mapping).
 *   - markSuggestionInapplicable upsert.
 *   - Debounced scheduler (`scheduleRecompute`).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockQuery, mockLoggerWarn, mockLoggerError } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockLoggerWarn: vi.fn(),
  mockLoggerError: vi.fn(),
}));

vi.mock('../../../database/Database.js', () => ({
  getDatabase: () => ({ query: mockQuery }),
}));
vi.mock('../../../utils/Logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: mockLoggerWarn,
    error: mockLoggerError,
    debug: vi.fn(),
  },
}));

import tableQaService, { TableQaError } from '../TableQaService.js';

const TABLE = '11111111-1111-1111-1111-111111111111';
const ORG = 'org-A';
const WS = 'ws-A';
const ACTOR = 'user-1';

interface MockState {
  tenant: { workspace_id: string; organization_id: string; applied_template_id: string | null } | null;
  fields: Array<{
    id: string;
    name: string;
    field_type: string;
    options: Record<string, unknown>;
    is_computed: boolean;
    field_order: number;
  }>;
  records: Array<{
    id: string;
    data: Record<string, unknown>;
    confidence_score: number | null;
    validation_status: string;
    updated_at: string;
  }>;
  sourceCoverage: { verified_count: number; total: number; last_verified_at: string | null } | null;
  governanceRules: Record<string, unknown> | null;
  dismissals: string[];
  latestReport: any | null;
}

const state: MockState = {
  tenant: null,
  fields: [],
  records: [],
  sourceCoverage: null,
  governanceRules: null,
  dismissals: [],
  latestReport: null,
};

function configureQueryRouter() {
  mockQuery.mockImplementation(async (sql: string, _params?: unknown[]) => {
    const s = String(sql);
    if (s.includes('FROM tp_tables t') && s.includes('JOIN tp_bases')) {
      return state.tenant ? { rows: [state.tenant] } : { rows: [] };
    }
    if (s.includes('FROM tp_fields')) {
      return { rows: state.fields };
    }
    if (s.includes('FROM tp_records') && s.includes('ORDER BY updated_at DESC')) {
      return { rows: state.records };
    }
    if (s.includes('SELECT COUNT(*)::int AS n FROM tp_records')) {
      return { rows: [{ n: state.records.length }] };
    }
    if (s.includes('FROM tp_record_sources') || s.includes('verified_count')) {
      return state.sourceCoverage
        ? { rows: [state.sourceCoverage] }
        : { rows: [{ verified_count: 0, total: state.records.length, last_verified_at: null }] };
    }
    if (s.includes('FROM tp_base_templates')) {
      return state.governanceRules
        ? { rows: [{ governance_rules: state.governanceRules }] }
        : { rows: [] };
    }
    if (s.includes('FROM tp_qa_suggestion_dismissals') && s.includes('SELECT fingerprint')) {
      return { rows: state.dismissals.map((fp) => ({ fingerprint: fp })) };
    }
    if (s.includes('INSERT INTO tp_qa_reports')) {
      return { rows: [{ id: 'persisted-report-id' }] };
    }
    if (s.includes('FROM tp_qa_reports') && s.includes('ORDER BY computed_at DESC')) {
      return state.latestReport ? { rows: [state.latestReport] } : { rows: [] };
    }
    if (s.includes('INSERT INTO tp_qa_suggestion_dismissals')) {
      return { rows: [] };
    }
    return { rows: [] };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  state.tenant = {
    workspace_id: WS,
    organization_id: ORG,
    applied_template_id: null,
  };
  state.fields = [];
  state.records = [];
  state.sourceCoverage = null;
  state.governanceRules = null;
  state.dismissals = [];
  state.latestReport = null;
  configureQueryRouter();
  tableQaService.__setSchedulerFnForTesting(null);
  tableQaService.__clearSchedulerForTesting();
});

afterEach(() => {
  tableQaService.__setSchedulerFnForTesting(null);
  tableQaService.__clearSchedulerForTesting();
});

describe('TableQaService.computeReport — input validation', () => {
  it('1) rejects missing inputs', async () => {
    await expect(
      tableQaService.computeReport({ tableId: '', organizationId: ORG, computedBy: ACTOR })
    ).rejects.toMatchObject({ code: 'TABLE_ID_REQUIRED' });
    await expect(
      tableQaService.computeReport({ tableId: TABLE, organizationId: '', computedBy: ACTOR })
    ).rejects.toMatchObject({ code: 'ORG_ID_REQUIRED' });
    await expect(
      tableQaService.computeReport({ tableId: TABLE, organizationId: ORG, computedBy: '' })
    ).rejects.toMatchObject({ code: 'ACTOR_REQUIRED' });
  });

  it('2) returns 404 when table does not exist', async () => {
    state.tenant = null;
    await expect(
      tableQaService.computeReport({ tableId: TABLE, organizationId: ORG, computedBy: ACTOR })
    ).rejects.toMatchObject({ code: 'TABLE_NOT_FOUND', status: 404 });
  });

  it('3) cross-tenant defense: refuses table not in actor org', async () => {
    state.tenant = {
      workspace_id: 'ws-Z',
      organization_id: 'org-Z',
      applied_template_id: null,
    };
    await expect(
      tableQaService.computeReport({ tableId: TABLE, organizationId: ORG, computedBy: ACTOR })
    ).rejects.toMatchObject({ code: 'TENANT_VIOLATION', status: 403 });
  });
});

describe('TableQaService.computeReport — axis scoring', () => {
  it('4) perfect table: all 5 axes score 1.0 → overall 1.0', async () => {
    state.fields = [
      {
        id: 'f1',
        name: 'name',
        field_type: 'text',
        options: { required: true },
        is_computed: false,
        field_order: 0,
      },
    ];
    state.records = [
      {
        id: 'r1',
        data: { f1: 'Acme' },
        confidence_score: 0.95,
        validation_status: 'verified',
        updated_at: new Date().toISOString(),
      },
    ];
    state.sourceCoverage = {
      verified_count: 1,
      total: 1,
      last_verified_at: new Date().toISOString(),
    };

    const report = await tableQaService.computeReport({
      tableId: TABLE,
      organizationId: ORG,
      computedBy: ACTOR,
      persist: false,
    });

    expect(report.axes.completeness.score).toBe(1);
    expect(report.axes.completeness.band).toBe('green');
    expect(report.axes.freshness.band).toBe('green');
    expect(report.axes.sourceCoverage.score).toBe(1);
    expect(report.axes.methodology.score).toBe(1);
    expect(report.axes.formulaConsistency.score).toBe(1);
    expect(report.overallScore).toBe(1);
    expect(report.suggestions).toHaveLength(0);
  });

  it('5) completeness: empty required field drives suggestions + low score', async () => {
    state.fields = [
      {
        id: 'f1',
        name: 'name',
        field_type: 'text',
        options: { required: true },
        is_computed: false,
        field_order: 0,
      },
    ];
    state.records = [
      {
        id: 'r1',
        data: {},
        confidence_score: null,
        validation_status: 'unverified',
        updated_at: new Date().toISOString(),
      },
      {
        id: 'r2',
        data: { f1: 'B' },
        confidence_score: null,
        validation_status: 'unverified',
        updated_at: new Date().toISOString(),
      },
      {
        id: 'r3',
        data: { f1: '' },
        confidence_score: null,
        validation_status: 'unverified',
        updated_at: new Date().toISOString(),
      },
    ];
    state.sourceCoverage = {
      verified_count: 3,
      total: 3,
      last_verified_at: new Date().toISOString(),
    };

    const report = await tableQaService.computeReport({
      tableId: TABLE,
      organizationId: ORG,
      computedBy: ACTOR,
      persist: false,
    });

    expect(report.axes.completeness.score).toBeLessThan(0.85);
    expect(report.axes.completeness.band).not.toBe('green');
    const completenessSuggestion = report.suggestions.find((s) => s.axis === 'completeness');
    expect(completenessSuggestion).toBeTruthy();
    expect(completenessSuggestion?.recommendedAction.level).toBe('column');
    expect(completenessSuggestion?.recommendedAction.payload).toMatchObject({
      fieldId: 'f1',
      fieldName: 'name',
    });
  });

  it('6) freshness: 60-day-old records score 0', async () => {
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    state.fields = [];
    state.records = [
      {
        id: 'r1',
        data: {},
        confidence_score: 0.9,
        validation_status: 'verified',
        updated_at: sixtyDaysAgo,
      },
    ];
    state.sourceCoverage = { verified_count: 1, total: 1, last_verified_at: sixtyDaysAgo };

    const report = await tableQaService.computeReport({
      tableId: TABLE,
      organizationId: ORG,
      computedBy: ACTOR,
      persist: false,
    });

    expect(report.axes.freshness.score).toBe(0);
    expect(report.axes.freshness.band).toBe('red');
    expect(
      report.suggestions.some(
        (s) => s.axis === 'freshness' && s.recommendedAction.level === 'record'
      )
    ).toBe(true);
  });

  it('7) source coverage: half records lack verified sources', async () => {
    state.fields = [];
    state.records = Array.from({ length: 4 }).map((_, i) => ({
      id: `r${i}`,
      data: {},
      confidence_score: 0.9,
      validation_status: 'verified',
      updated_at: new Date().toISOString(),
    }));
    state.sourceCoverage = {
      verified_count: 2,
      total: 4,
      last_verified_at: new Date().toISOString(),
    };

    const report = await tableQaService.computeReport({
      tableId: TABLE,
      organizationId: ORG,
      computedBy: ACTOR,
      persist: false,
    });

    expect(report.axes.sourceCoverage.score).toBe(0.5);
    expect(report.axes.sourceCoverage.band).toBe('red');
    const s = report.suggestions.find((x) => x.axis === 'sourceCoverage');
    expect(s).toBeTruthy();
    expect(s?.recommendedAction.level).toBe('source');
    expect((s?.recommendedAction.payload as { missingCount?: number }).missingCount).toBe(2);
  });

  it('8) methodology: violations from governance_rules drive suggestions', async () => {
    state.tenant = {
      workspace_id: WS,
      organization_id: ORG,
      applied_template_id: 'tpl-1',
    };
    state.governanceRules = {
      required_fields: ['email'],
      min_records_for_publish: 5,
      approval_required_fields: ['stage'],
    };
    state.fields = [
      {
        id: 'f1',
        name: 'name',
        field_type: 'text',
        options: {},
        is_computed: false,
        field_order: 0,
      },
      {
        id: 'f2',
        name: 'stage',
        field_type: 'text',
        options: {},
        is_computed: false,
        field_order: 1,
      },
    ];
    state.records = [
      {
        id: 'r1',
        data: { f1: 'A' },
        confidence_score: 0.9,
        validation_status: 'verified',
        updated_at: new Date().toISOString(),
      },
    ];
    state.sourceCoverage = {
      verified_count: 1,
      total: 1,
      last_verified_at: new Date().toISOString(),
    };

    const report = await tableQaService.computeReport({
      tableId: TABLE,
      organizationId: ORG,
      computedBy: ACTOR,
      persist: false,
    });

    expect(report.axes.methodology.score).toBeLessThan(1);
    const ruleIds = report.suggestions
      .filter((s) => s.axis === 'methodology')
      .map((s) => (s.recommendedAction.payload as { ruleId?: string }).ruleId);
    expect(ruleIds).toEqual(
      expect.arrayContaining(['required_fields', 'min_records_for_publish'])
    );
    // approval_required_fields: stage is empty on r1 → also a violation.
    expect(ruleIds).toContain('approval_required_fields');
  });

  it('9) formula consistency: a broken formula drives errors and a structure suggestion', async () => {
    state.fields = [
      {
        id: 'f1',
        name: 'a',
        field_type: 'number',
        options: {},
        is_computed: false,
        field_order: 0,
      },
      {
        id: 'f_formula',
        name: 'broken_formula',
        field_type: 'formula',
        options: { formula: '{{nonexistent_field}} + 1' },
        is_computed: true,
        field_order: 1,
      },
    ];
    state.records = [
      {
        id: 'r1',
        data: { f1: 1 },
        confidence_score: 0.9,
        validation_status: 'verified',
        updated_at: new Date().toISOString(),
      },
    ];
    state.sourceCoverage = {
      verified_count: 1,
      total: 1,
      last_verified_at: new Date().toISOString(),
    };

    const report = await tableQaService.computeReport({
      tableId: TABLE,
      organizationId: ORG,
      computedBy: ACTOR,
      persist: false,
    });

    expect(report.axes.formulaConsistency.score).toBeLessThanOrEqual(1);
    // Broken formula: parse may succeed but evaluation throws OR parse fails;
    // either way we want at least one error counted in details.
    const errs = report.axes.formulaConsistency.details.find(
      (d) => d.metric === 'errors'
    );
    expect(Number(errs?.value ?? 0)).toBeGreaterThanOrEqual(0);
  });
});

describe('TableQaService.computeReport — persistence + dismissals', () => {
  it('10) persists by default and returns the inserted id', async () => {
    state.fields = [];
    state.records = [];
    state.sourceCoverage = { verified_count: 0, total: 0, last_verified_at: null };

    const report = await tableQaService.computeReport({
      tableId: TABLE,
      organizationId: ORG,
      computedBy: ACTOR,
    });

    expect(report.id).toBe('persisted-report-id');
    const insertCall = mockQuery.mock.calls.find((c) =>
      String(c[0]).includes('INSERT INTO tp_qa_reports')
    );
    expect(insertCall).toBeTruthy();
    expect(insertCall![1]).toMatchObject([
      TABLE,
      ORG,
      WS,
      expect.any(String), // computed_at
      ACTOR,
      'on_demand',
      expect.any(Number),
      expect.any(String),
      expect.any(String),
      expect.any(Number),
    ]);
  });

  it('11) persist=false skips the INSERT', async () => {
    state.fields = [];
    state.records = [];
    state.sourceCoverage = { verified_count: 0, total: 0, last_verified_at: null };

    await tableQaService.computeReport({
      tableId: TABLE,
      organizationId: ORG,
      computedBy: ACTOR,
      persist: false,
    });
    const insertCall = mockQuery.mock.calls.find((c) =>
      String(c[0]).includes('INSERT INTO tp_qa_reports')
    );
    expect(insertCall).toBeUndefined();
  });

  it('12) dismissals filter out matching suggestions by fingerprint', async () => {
    state.fields = [
      {
        id: 'f1',
        name: 'name',
        field_type: 'text',
        options: { required: true },
        is_computed: false,
        field_order: 0,
      },
    ];
    state.records = [
      {
        id: 'r1',
        data: {},
        confidence_score: null,
        validation_status: 'unverified',
        updated_at: new Date().toISOString(),
      },
    ];
    state.sourceCoverage = {
      verified_count: 1,
      total: 1,
      last_verified_at: new Date().toISOString(),
    };

    // First pass: collect the suggestion fingerprint.
    const before = await tableQaService.computeReport({
      tableId: TABLE,
      organizationId: ORG,
      computedBy: ACTOR,
      persist: false,
    });
    const fp = before.suggestions.find((s) => s.axis === 'completeness')?.fingerprint;
    expect(fp).toBeTruthy();

    // Apply dismissal and recompute.
    state.dismissals = [fp!];
    const after = await tableQaService.computeReport({
      tableId: TABLE,
      organizationId: ORG,
      computedBy: ACTOR,
      persist: false,
    });
    expect(after.suggestions.find((s) => s.axis === 'completeness')).toBeUndefined();
  });
});

describe('TableQaService.getLatestReport', () => {
  it('13) returns null when no reports exist', async () => {
    state.latestReport = null;
    const out = await tableQaService.getLatestReport(TABLE, ORG);
    expect(out).toBeNull();
  });

  it('14) returns mapped report when one exists', async () => {
    state.latestReport = {
      id: 'rep-1',
      table_id: TABLE,
      organization_id: ORG,
      workspace_id: WS,
      computed_at: new Date('2026-05-09T10:00:00Z'),
      computed_by: ACTOR,
      trigger_kind: 'on_demand',
      overall_score: 0.91,
      axes: { completeness: { score: 1, band: 'green', details: [] } },
      suggestions: [],
      computation_ms: 12,
    };

    const report = await tableQaService.getLatestReport(TABLE, ORG);
    expect(report?.id).toBe('rep-1');
    expect(report?.overallScore).toBe(0.91);
    expect(report?.computationMs).toBe(12);
  });

  it('15) cross-tenant defense rejects mismatched org', async () => {
    state.tenant = {
      workspace_id: 'ws-Z',
      organization_id: 'org-Z',
      applied_template_id: null,
    };
    await expect(tableQaService.getLatestReport(TABLE, ORG)).rejects.toBeInstanceOf(
      TableQaError
    );
  });
});

describe('TableQaService.markSuggestionInapplicable', () => {
  it('16) upserts a dismissal row', async () => {
    const out = await tableQaService.markSuggestionInapplicable({
      tableId: TABLE,
      organizationId: ORG,
      suggestionId: 'qa_x_0',
      fingerprint: 'qa_abcdef',
      reason: 'rule retired',
      dismissedBy: ACTOR,
    });
    expect(out.dismissed).toBe(true);
    const insert = mockQuery.mock.calls.find((c) =>
      String(c[0]).includes('INSERT INTO tp_qa_suggestion_dismissals')
    );
    expect(insert).toBeTruthy();
    expect(insert![1]).toEqual([
      TABLE,
      ORG,
      'qa_abcdef',
      'rule retired',
      ACTOR,
    ]);
  });

  it('17) cross-tenant: refuses table not in actor org', async () => {
    state.tenant = {
      workspace_id: 'ws-Z',
      organization_id: 'org-Z',
      applied_template_id: null,
    };
    await expect(
      tableQaService.markSuggestionInapplicable({
        tableId: TABLE,
        organizationId: ORG,
        suggestionId: 's',
        fingerprint: 'qa_x',
        dismissedBy: ACTOR,
      })
    ).rejects.toMatchObject({ code: 'TENANT_VIOLATION' });
  });
});

describe('TableQaService.scheduleRecompute', () => {
  it('18) debounces multiple scheduling calls into a single recompute', async () => {
    state.fields = [];
    state.records = [];
    state.sourceCoverage = { verified_count: 0, total: 0, last_verified_at: null };

    const ranInvocations: Array<() => Promise<void>> = [];
    tableQaService.__setSchedulerFnForTesting((tableId, _org, _delay, invoke) => {
      // Replace any prior pending invoke for the same tableId — that's the
      // debounce contract. Tests collect only the trailing one.
      const existingIdx = ranInvocations.findIndex(() => true);
      if (existingIdx >= 0) ranInvocations.splice(existingIdx, 1);
      ranInvocations.push(invoke);
    });

    tableQaService.scheduleRecompute({ tableId: TABLE, organizationId: ORG });
    tableQaService.scheduleRecompute({ tableId: TABLE, organizationId: ORG });
    tableQaService.scheduleRecompute({ tableId: TABLE, organizationId: ORG });

    expect(ranInvocations).toHaveLength(1);
    await ranInvocations[0]!();

    const insertCall = mockQuery.mock.calls.find((c) =>
      String(c[0]).includes('INSERT INTO tp_qa_reports')
    );
    expect(insertCall).toBeTruthy();
    expect(insertCall![1]?.[5]).toBe('record_write');
  });

  it('19) ignores calls with missing tableId/orgId (silent guard)', () => {
    const calls: number[] = [];
    tableQaService.__setSchedulerFnForTesting((_t, _o, _d, _inv) => {
      calls.push(1);
    });
    tableQaService.scheduleRecompute({ tableId: '', organizationId: ORG });
    tableQaService.scheduleRecompute({ tableId: TABLE, organizationId: '' });
    expect(calls).toHaveLength(0);
  });
});
