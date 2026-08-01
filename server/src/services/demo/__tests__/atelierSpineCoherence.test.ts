/**
 * Atelier Toys demo-dataset spine-coherence smoke test (X2).
 *
 * Seeds the Atelier "Ateliertoy Forward (2015)" dataset against an in-memory
 * capture of every DB write and asserts that the consulting story flows
 * end-to-end with REAL cross-module links (the same IDs flow through each
 * spine stage):
 *
 *   Org context (16) -> Interviews + Insights (03) -> Initiatives (05)
 *     -> Execution / Rollout (06) -> Results / KPIs (07)
 *     -> Financial model / ROI (08b) -> Outputs / Deliverables (09)
 *
 * The DB layer is mocked so the test runs anywhere (no live Postgres). All
 * INSERTs are captured and parsed back into rows so linkage can be verified.
 */

import { beforeAll, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// In-memory capture of every write the seed performs.
// ---------------------------------------------------------------------------
interface CapturedRow {
  table: string;
  columns: string[];
  values: unknown[];
  row: Record<string, unknown>;
}

const captured: CapturedRow[] = [];
const contextClaims: Array<{ organizationId: string; claims: unknown }> = [];

function parseInsert(sql: string, params: unknown[]): CapturedRow | null {
  const match = sql.match(/INSERT\s+INTO\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)/i);
  if (!match) return null;
  const table = match[1];
  const columns = match[2]
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
  const values = params.slice(0, columns.length);
  const row: Record<string, unknown> = {};
  columns.forEach((col, i) => {
    row[col] = values[i];
  });
  return { table, columns, values, row };
}

// Tables/columns the seed probes via information_schema. We answer "exists" for
// everything so all guarded branches run (matches a fully-migrated DB).
function handleSchemaProbe(sql: string): { handled: boolean; result?: unknown } {
  if (/information_schema\.tables/i.test(sql)) {
    return { handled: true, result: { exists: true } };
  }
  if (/information_schema\.columns/i.test(sql) && /EXISTS/i.test(sql)) {
    return { handled: true, result: { exists: true } };
  }
  return { handled: false };
}

// getTableColumns(): SELECT LOWER(column_name) ... FROM information_schema.columns
function columnsForTable(table: string): Array<{ column_name: string }> {
  const map: Record<string, string[]> = {
    interview_sessions: [
      'id',
      'organization_id',
      'project_id',
      'name',
      'owner_id',
      'status',
      'progress_json',
      'total_questions',
      'answered_questions',
      'summary_facts',
      'summary_gaps',
      'summary_constraints',
      'summary_pain_points',
      'started_at',
      'completed_at',
      'last_activity_at',
    ],
    project_kpis: [
      'id',
      'project_id',
      'name',
      'category',
      'description',
      'target_value',
      'current_value',
      'baseline_value',
      'unit',
      'threshold_direction',
      'historical_values',
      'trend',
      'owner_id',
      'status',
    ],
    initiative_dependencies: [
      'id',
      'organization_id',
      'project_id',
      'from_initiative_id',
      'to_initiative_id',
      'type',
      'created_by',
    ],
  };
  return (map[table] || []).map((c) => ({ column_name: c }));
}

vi.mock('../../../utils/DbPromise.js', () => {
  const get = vi.fn(async (sql: string) => {
    const probe = handleSchemaProbe(sql);
    if (probe.handled) return probe.result;
    return null;
  });
  const all = vi.fn(async (sql: string, params: unknown[] = []) => {
    if (/information_schema\.columns/i.test(sql) && /LOWER\(column_name\)/i.test(sql)) {
      const table = String((params as unknown[])[0] ?? '');
      return columnsForTable(table);
    }
    return [];
  });
  const run = vi.fn(async (sql: string, params: unknown[] = []) => {
    const parsed = parseInsert(sql, params as unknown[]);
    if (parsed) captured.push(parsed);
    return { success: true, changes: 1 };
  });
  return {
    get,
    all,
    run,
    transaction: vi.fn(async () => ({ success: true, results: [] })),
    tableExists: vi.fn(async () => true),
    columnExists: vi.fn(async () => true),
    exec: vi.fn(async () => ({ success: true })),
    safeAll: vi.fn(async () => []),
    count: vi.fn(async () => 0),
    DbPromise: {},
    default: {},
  };
});

// Context service is exercised separately; capture its claims for the org-context
// spine assertion, but don't touch a DB.
vi.mock('../../organizationContext/OrganizationContextService.js', () => ({
  organizationContextService: {
    recordContextSource: vi.fn(async (input: { organizationId: string; claims: unknown }) => {
      contextClaims.push({ organizationId: input.organizationId, claims: input.claims });
    }),
    rebuildSnapshot: vi.fn(async () => undefined),
  },
}));

import { seedAtelierToysDemoDataset } from '../demoSeedService.js';

const ORG_ID = 'demo-atelier-spine-test';

function rowsFor(table: string): Array<Record<string, unknown>> {
  return captured.filter((c) => c.table === table).map((c) => c.row);
}

describe('Atelier Toys demo spine coherence', () => {
  beforeAll(async () => {
    captured.length = 0;
    contextClaims.length = 0;
    await seedAtelierToysDemoDataset({ organizationId: ORG_ID, locale: 'en' });
  });

  it('stage 16 — seeds rich organization context claims', () => {
    expect(contextClaims.length).toBeGreaterThan(0);
    const claims = contextClaims[0].claims as Array<{ claimPath: string; value: unknown }>;
    const paths = claims.map((c) => c.claimPath);
    expect(paths).toContain('profile.companyName');
    const companyName = claims.find((c) => c.claimPath === 'profile.companyName')?.value;
    expect(companyName).toBe('Atelier Toys');
    // Transformation narrative is present.
    const custom = claims.find((c) => c.claimPath === 'metadata.custom')?.value as Array<{
      key: string;
      value: string;
    }>;
    const story = custom.find((c) => c.key === 'transformationStory')?.value || '';
    expect(story).toMatch(/Ateliertoy Forward/i);
    expect(story).toMatch(/2015/);
  });

  it('stage 05 — seeds the initiative portfolio', () => {
    const initiatives = rowsFor('initiatives');
    expect(initiatives.length).toBeGreaterThanOrEqual(8);
    const ids = initiatives.map((i) => i.id);
    // Flagship spine initiatives are present.
    expect(ids).toContain(`${ORG_ID}--initiative--line-3-digital-twin`);
    expect(ids).toContain(`${ORG_ID}--initiative--procurement-control-tower`);
    expect(ids).toContain(`${ORG_ID}--initiative--atelier-digital-growth`);
  });

  it('FIN-006/A — every seeded initiative is EUR, matching Finance (never the schema default PLN)', () => {
    // migrations/564_execution_delay_budget_t041_t042.sql:139 defaults
    // `initiatives.budget_currency` to 'PLN'. Before FIN-006/A this column was
    // never set by the seed, so it silently inherited that default while
    // Finance (FIN-005) reports the same Atelier program in EUR. This test
    // fails red the moment the seed stops setting it explicitly, since
    // `columnExists` is mocked `true` here — the omission itself, not a
    // missing column, was the whole bug.
    const initiatives = rowsFor('initiatives');
    expect(initiatives.length).toBeGreaterThan(0);
    for (const initiative of initiatives) {
      expect(initiative.budget_currency, String(initiative.id)).toBe('EUR');
      expect(initiative.budget_currency, String(initiative.id)).not.toBe('PLN');
    }
  });

  it('stage 03 — seeds >=5 interviews with completed status', () => {
    const interviews = rowsFor('interview_sessions');
    expect(interviews.length).toBeGreaterThanOrEqual(5);
    for (const interview of interviews) {
      expect(interview.organization_id).toBe(ORG_ID);
      expect(interview.status).toBe('completed');
      expect(interview.owner_id).toBeTruthy();
    }
  });

  it('stage 03 — insight is sourced from the seeded interviews', () => {
    const insights = rowsFor('interview_insights');
    expect(insights.length).toBeGreaterThanOrEqual(1);
    const insight = insights[0];
    const interviewIds = new Set(rowsFor('interview_sessions').map((r) => r.id));
    const sourceIds = JSON.parse(String(insight.source_session_ids)) as string[];
    expect(sourceIds.length).toBeGreaterThanOrEqual(5);
    // Every source session id is a real seeded interview.
    for (const id of sourceIds) {
      expect(interviewIds.has(id)).toBe(true);
    }
  });

  it('stage 04 — seeds an APPROVED DRD baseline assessment with realistic scores', () => {
    const assessments = rowsFor('assessments');
    expect(assessments.length).toBeGreaterThanOrEqual(1);

    const drd = assessments.find((a) => String(a.assessment_type) === 'DRD');
    expect(drd).toBeTruthy();
    expect(drd?.id).toBe(`${ORG_ID}--assessment--drd-atelier-forward-baseline`);
    expect(drd?.organization_id).toBe(ORG_ID);
    expect(String(drd?.status)).toBe('APPROVED');
    // Baseline maturity is realistic: not perfect, with a visible gap to target.
    expect(Number(drd?.overall_score)).toBeGreaterThan(0);
    expect(Number(drd?.overall_score)).toBeLessThan(5);

    // Score summary reconciles with the transformation thesis (3.3 -> 5.0, gap 1.7).
    const summary = JSON.parse(String(drd?.score_summary)) as {
      overall: { actual: number; target: number; gap: number };
      topGaps: string[];
    };
    expect(summary.overall.actual).toBeCloseTo(3.3, 5);
    expect(summary.overall.target).toBeCloseTo(5.0, 5);
    expect(summary.overall.gap).toBeCloseTo(1.7, 5);
    expect(summary.topGaps.length).toBeGreaterThanOrEqual(3);

    // Answers carry the full DRD axis structure (7 axes seeded with achieved/target).
    const answers = JSON.parse(String(drd?.answers_json)) as {
      drd: { areas: Record<string, { achievedLevel: number; targetLevel: number }> };
    };
    const areas = answers.drd.areas;
    expect(Object.keys(areas).length).toBeGreaterThanOrEqual(7);
    for (const area of Object.values(areas)) {
      expect(area.achievedLevel).toBeGreaterThanOrEqual(1);
      expect(area.targetLevel).toBeGreaterThanOrEqual(area.achievedLevel);
    }
  });

  it('stage 04 — DRD report + sections are APPROVED and linked to the assessment', () => {
    const drd = rowsFor('assessments').find((a) => String(a.assessment_type) === 'DRD');
    const reports = rowsFor('assessment_reports');
    const report = reports.find(
      (r) => r.assessment_id === `${ORG_ID}--assessment--drd-atelier-forward-baseline`
    );
    expect(report).toBeTruthy();
    expect(report?.organization_id).toBe(ORG_ID);
    expect(String(report?.status)).toBe('APPROVED');
    // Report belongs to the assessment we seeded (real cross-link, not orphaned).
    expect(report?.assessment_id).toBe(drd?.id);

    const sections = rowsFor('assessment_report_sections').filter(
      (s) => s.report_id === report?.id
    );
    expect(sections.length).toBeGreaterThanOrEqual(3);
    const types = sections.map((s) => String(s.section_type));
    expect(types).toContain('executive_summary');
    expect(types).toContain('recommendations');
    for (const section of sections) {
      expect(String(section.content).length).toBeGreaterThan(0);
    }
  });

  it('stage 04 — DRD assessment shares the project spine with initiatives + results', () => {
    const drd = rowsFor('assessments').find((a) => String(a.assessment_type) === 'DRD');
    const projectIds = new Set(rowsFor('projects').map((r) => r.id));
    // The assessment hangs off a real seeded project (forward-pmo), so the
    // diagnosis, portfolio, and results all live under the same tenant spine.
    expect(projectIds.has(String(drd?.project_id))).toBe(true);
    expect(drd?.project_id).toBe(`${ORG_ID}--project--forward-pmo`);
  });

  it('stage 03 -> 05 — insight findings hand off to REAL initiatives', () => {
    const findings = rowsFor('interview_insight_findings');
    const handoffs = rowsFor('interview_insight_handoffs');
    const insightIds = new Set(rowsFor('interview_insights').map((r) => r.id));
    const initiativeIds = new Set(rowsFor('initiatives').map((r) => r.id));
    const findingIds = new Set(findings.map((f) => f.id));

    expect(findings.length).toBeGreaterThanOrEqual(3);
    expect(handoffs.length).toBeGreaterThanOrEqual(3);

    for (const finding of findings) {
      expect(insightIds.has(finding.insight_id)).toBe(true);
    }

    const linkedInitiativeIds = new Set<string>();
    for (const handoff of handoffs) {
      expect(handoff.target_kind).toBe('initiative');
      expect(insightIds.has(handoff.insight_id)).toBe(true);
      expect(findingIds.has(handoff.finding_id)).toBe(true);
      // The crucial link: handoff target is a real seeded initiative.
      expect(initiativeIds.has(handoff.target_id)).toBe(true);
      linkedInitiativeIds.add(String(handoff.target_id));
    }

    // The three flagship initiatives are all reached from discovery insight.
    expect(linkedInitiativeIds.has(`${ORG_ID}--initiative--line-3-digital-twin`)).toBe(true);
    expect(linkedInitiativeIds.has(`${ORG_ID}--initiative--procurement-control-tower`)).toBe(true);
    expect(linkedInitiativeIds.has(`${ORG_ID}--initiative--atelier-digital-growth`)).toBe(true);
  });

  it('stage 08b — financial model + ROI analysis link to the flagship initiative', () => {
    const models = rowsFor('financial_models');
    expect(models.length).toBeGreaterThanOrEqual(1);
    expect(
      models.some((m) => m.initiative_id === `${ORG_ID}--initiative--line-3-digital-twin`)
    ).toBe(true);

    const analysisFinancials = rowsFor('analysis_financials');
    expect(analysisFinancials.length).toBeGreaterThanOrEqual(1);
    const fin = analysisFinancials[0];
    expect(fin.initiative_id).toBe(`${ORG_ID}--initiative--line-3-digital-twin`);
    // ROI / NPV / payback are real numbers the deck + results can quote.
    expect(Number(fin.npv)).toBeGreaterThan(0);
    expect(Number(fin.roi_percent)).toBeGreaterThan(0);
    expect(Number(fin.payback_months)).toBeGreaterThan(0);
  });

  it('stage 07 — results KPIs are tracked under real projects', () => {
    const kpis = rowsFor('project_kpis');
    expect(kpis.length).toBeGreaterThanOrEqual(3);
    const projectIds = new Set(rowsFor('projects').map((r) => r.id));
    for (const kpi of kpis) {
      expect(projectIds.has(kpi.project_id)).toBe(true);
      expect(kpi.baseline_value).not.toBeUndefined();
      expect(kpi.current_value).not.toBeUndefined();
      expect(kpi.target_value).not.toBeUndefined();
    }
    // Results reconcile with the org-context numbers (OEE 74 -> 80, target 82).
    const oee = kpis.find((k) => String(k.name).includes('OEE'));
    expect(oee).toBeTruthy();
    expect(Number(oee?.baseline_value)).toBe(74);
    expect(Number(oee?.target_value)).toBe(82);
  });

  it('stage 06 — rollout artifacts exist for the flagship project', () => {
    const rolloutKpis = rowsFor('rollout_kpis');
    const rolloutRisks = rowsFor('rollout_risks');
    const rolloutChanges = rowsFor('rollout_changes');
    const rolloutClosures = rowsFor('rollout_closures');
    const projectIds = new Set(rowsFor('projects').map((r) => r.id));

    expect(rolloutKpis.length).toBeGreaterThanOrEqual(1);
    expect(rolloutRisks.length).toBeGreaterThanOrEqual(1);
    expect(rolloutChanges.length).toBeGreaterThanOrEqual(1);
    expect(rolloutClosures.length).toBeGreaterThanOrEqual(1);

    for (const artifact of [
      ...rolloutKpis,
      ...rolloutRisks,
      ...rolloutChanges,
      ...rolloutClosures,
    ]) {
      expect(artifact.organization_id).toBe(ORG_ID);
      expect(projectIds.has(artifact.project_id)).toBe(true);
    }
  });

  it('stage 09 — deliverables close the loop back to the flagship initiative', () => {
    const artifacts = rowsFor('v8_output_artifacts');
    const initiativeIds = new Set(rowsFor('initiatives').map((r) => r.id));
    expect(artifacts.length).toBeGreaterThanOrEqual(1);

    const linked = artifacts.filter((a) => initiativeIds.has(String(a.source_initiative_id)));
    expect(linked.length).toBeGreaterThanOrEqual(1);
    expect(
      linked.some((a) => a.source_initiative_id === `${ORG_ID}--initiative--line-3-digital-twin`)
    ).toBe(true);

    // At least one deliverable is "ready"/"shared" so the demo has a finished output.
    expect(artifacts.some((a) => ['ready', 'shared'].includes(String(a.delivery_state)))).toBe(
      true
    );
  });

  it('end-to-end — the same flagship initiative id flows through every spine stage', () => {
    const flagship = `${ORG_ID}--initiative--line-3-digital-twin`;

    const reachedFromInsight = rowsFor('interview_insight_handoffs').some(
      (h) => h.target_id === flagship
    );
    const inFinancialModel = rowsFor('financial_models').some((m) => m.initiative_id === flagship);
    const inAnalysis = rowsFor('analysis_financials').some((a) => a.initiative_id === flagship);
    const inDeliverable = rowsFor('v8_output_artifacts').some(
      (a) => a.source_initiative_id === flagship
    );
    // Results KPI for the flagship is tracked under its project (factory-excellence).
    const flagshipProject = `${ORG_ID}--project--factory-excellence`;
    const hasResult = rowsFor('project_kpis').some(
      (k) => k.project_id === flagshipProject && String(k.name).includes('OEE')
    );
    const hasRollout = rowsFor('rollout_kpis').some((k) => k.project_id === flagshipProject);

    expect(reachedFromInsight).toBe(true);
    expect(inFinancialModel).toBe(true);
    expect(inAnalysis).toBe(true);
    expect(hasResult).toBe(true);
    expect(hasRollout).toBe(true);
    expect(inDeliverable).toBe(true);
  });
});
