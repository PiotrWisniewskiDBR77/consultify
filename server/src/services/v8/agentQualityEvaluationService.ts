import { createHash } from 'node:crypto';

import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, transaction as dbTransaction } from '../../utils/DbPromise.js';

export const QUALITY_DIMENSIONS = [
  'correctness',
  'completeness',
  'evidence',
  'policy_compliance',
  'usefulness',
] as const;
export const CRITICAL_INVARIANTS = [
  'tenant_isolation',
  'financial_mechanics',
  'gate_ownership',
  'source_honesty',
  'false_completion',
] as const;
type QualityDimension = (typeof QUALITY_DIMENSIONS)[number];
type CriticalInvariant = (typeof CRITICAL_INVARIANTS)[number];
type Validator =
  | 'equals'
  | 'non_empty'
  | 'min_count'
  | 'numeric_tolerance'
  | 'sha256_match'
  | 'allowed_state'
  | 'forbidden_patterns_absent';

export interface AgentQualityEvalCase {
  caseKey: string;
  capability: string;
  dimension: QualityDimension;
  criticalInvariant?: CriticalInvariant;
  validator: Validator;
  actual: unknown;
  expected: unknown;
  evidenceRefs: string[];
}

function countValue(value: unknown): number {
  if (Array.isArray(value) || typeof value === 'string') return value.length;
  if (value && typeof value === 'object') return Object.keys(value).length;
  return 0;
}

function evaluate(test: AgentQualityEvalCase): { passed: boolean; reason: string | null } {
  let passed = false;
  switch (test.validator) {
    case 'equals':
      passed = JSON.stringify(test.actual) === JSON.stringify(test.expected);
      break;
    case 'non_empty':
      passed = countValue(test.actual) > 0;
      break;
    case 'min_count':
      passed = countValue(test.actual) >= Number(test.expected);
      break;
    case 'numeric_tolerance': {
      const expected = test.expected as { value: number; tolerance: number };
      passed =
        Number.isFinite(Number(test.actual)) &&
        Math.abs(Number(test.actual) - Number(expected.value)) <= Number(expected.tolerance);
      break;
    }
    case 'sha256_match':
      passed =
        createHash('sha256').update(String(test.actual)).digest('hex') === String(test.expected);
      break;
    case 'allowed_state':
      passed = Array.isArray(test.expected) && test.expected.includes(test.actual);
      break;
    case 'forbidden_patterns_absent':
      passed =
        Array.isArray(test.expected) &&
        test.expected.every(
          (pattern) => !String(test.actual).toLowerCase().includes(String(pattern).toLowerCase())
        );
      break;
  }
  if (test.evidenceRefs.length === 0) return { passed: false, reason: 'evidence_refs_required' };
  return { passed, reason: passed ? null : `validator_failed:${test.validator}` };
}

export interface TransformationCaseQualityEvaluation {
  status: 'passed' | 'failed';
  score: number;
  suiteVersion: 'transformation-case-live-v1';
  evaluatedCaseVersion: number;
  evaluatedAt: string;
  cases: Array<{
    caseKey: string;
    capability: string;
    dimension: QualityDimension;
    criticalInvariant: CriticalInvariant;
    passed: boolean;
    evidenceRefs: string[];
    failureReason: string | null;
  }>;
  criticalFailures: string[];
}

interface TransformationCaseQualityReadback {
  transformation_case_id: string;
  organization_id: string;
  lifecycle_stage: string;
  case_version: number;
  execution_run_id: string | null;
  plan_status: string | null;
  plan_version: number | null;
  plan_steps: number;
  approved_stage_proposals: number;
  applied_stage_proposals: number;
  accepted_gates: number;
  artifact_types: number;
  financial_analysis_readbacks: number;
  kpi_readbacks: number;
  final_output_count: number;
  final_output_case_version: number | null;
  facts_digest: string | null;
  docx_sha256: string | null;
  pptx_sha256: string | null;
  foreign_tenant_rows: number;
}

const ACCEPTED_GATE_EVENTS = [
  'transformation_plan.approved',
  'transformation_interviews.results_accepted',
  'transformation_drd.results_accepted',
  'transformation_initiative.results_accepted',
  'transformation_finance_kpi.results_accepted',
  'transformation_portfolio.results_accepted',
  'transformation_mobilization.results_accepted',
  'transformation_execution.results_accepted',
  'transformation_delivery.benefits_handoff_accepted',
  'transformation_benefits.results_verified',
  'transformation_sustainability.reviewed',
] as const;

/**
 * Builds the trust projection from current owning records. It intentionally does
 * not reuse proof fixtures or a previously persisted evaluation result.
 */
export async function evaluateTransformationCaseLive(input: {
  transformationCaseId: string;
  organizationId: string;
  now?: string;
}): Promise<TransformationCaseQualityEvaluation | null> {
  const row = await dbGet<TransformationCaseQualityReadback>(
    `SELECT c.transformation_case_id,
            c.organization_id,
            c.lifecycle_stage,
            c.version::int AS case_version,
            c.execution_run_id,
            p.status AS plan_status,
            p.version::int AS plan_version,
            (SELECT COUNT(*)::int FROM transformation_plan_steps ps
              WHERE ps.plan_id=c.active_plan_id AND ps.organization_id=c.organization_id) AS plan_steps,
            (SELECT COUNT(*)::int FROM transformation_stage_proposals sp
              WHERE sp.transformation_case_id=c.transformation_case_id
                AND sp.organization_id=c.organization_id AND sp.status='approved') AS approved_stage_proposals,
            (SELECT COUNT(*)::int FROM transformation_stage_proposals sp
              WHERE sp.transformation_case_id=c.transformation_case_id
                AND sp.organization_id=c.organization_id AND sp.status='applied') AS applied_stage_proposals,
            (SELECT COUNT(DISTINCT ae.event_type)::int FROM transformation_case_audit_events ae
              WHERE ae.transformation_case_id=c.transformation_case_id
                AND ae.organization_id=c.organization_id AND ae.event_type = ANY(?::text[])) AS accepted_gates,
            (SELECT COUNT(DISTINCT l.artifact_type)::int FROM transformation_case_artifact_links l
              WHERE l.transformation_case_id=c.transformation_case_id
                AND l.organization_id=c.organization_id) AS artifact_types,
            (SELECT COUNT(*)::int FROM transformation_case_artifact_links l
               JOIN financial_analyses fa ON fa.id=l.artifact_id AND fa.organization_id=l.organization_id
              WHERE l.transformation_case_id=c.transformation_case_id
                AND l.organization_id=c.organization_id AND l.artifact_type='financial_analysis'
                AND LOWER(fa.status)='approved') AS financial_analysis_readbacks,
            (SELECT COUNT(*)::int FROM transformation_case_artifact_links l
               JOIN initiative_kpis k ON k.id=l.artifact_id AND k.organization_id=l.organization_id
              WHERE l.transformation_case_id=c.transformation_case_id
                AND l.organization_id=c.organization_id AND l.artifact_type='initiative_kpi'
                AND k.target_value IS NOT NULL AND k.current_value IS NOT NULL) AS kpi_readbacks,
            (SELECT COUNT(*)::int FROM transformation_final_output_runs fo
              WHERE fo.transformation_case_id=c.transformation_case_id
                AND fo.organization_id=c.organization_id AND fo.status='completed') AS final_output_count,
            fo.case_version::int AS final_output_case_version,
            fo.facts_digest,
            fo.docx_sha256,
            fo.pptx_sha256,
            (SELECT COUNT(*)::int FROM transformation_cases foreign_case
              WHERE foreign_case.transformation_case_id=c.transformation_case_id
                AND foreign_case.organization_id<>c.organization_id) AS foreign_tenant_rows
       FROM transformation_cases c
       LEFT JOIN transformation_plans p
         ON p.plan_id=c.active_plan_id AND p.organization_id=c.organization_id
       LEFT JOIN LATERAL (
         SELECT latest.case_version,latest.facts_digest,latest.docx_sha256,latest.pptx_sha256
           FROM transformation_final_output_runs latest
          WHERE latest.transformation_case_id=c.transformation_case_id
            AND latest.organization_id=c.organization_id AND latest.status='completed'
          ORDER BY latest.generated_at DESC LIMIT 1
       ) fo ON TRUE
      WHERE c.transformation_case_id=? AND c.organization_id=?`,
    [Array.from(ACCEPTED_GATE_EVENTS), input.transformationCaseId, input.organizationId]
  );
  if (!row) return null;

  const isSha256 = (value: string | null) => /^[a-f0-9]{64}$/i.test(String(value ?? ''));
  const cases: AgentQualityEvalCase[] = [
    {
      caseKey: 'tenant-scoped-canonical-case',
      capability: 'governance',
      dimension: 'policy_compliance',
      criticalInvariant: 'tenant_isolation',
      validator: 'equals',
      actual: Number(row.foreign_tenant_rows),
      expected: 0,
      evidenceRefs: [
        `pg://transformation_cases/${row.transformation_case_id}?organization=${row.organization_id}`,
      ],
    },
    {
      caseKey: 'approved-plan-and-stage-gates',
      capability: 'transformation_governance',
      dimension: 'completeness',
      criticalInvariant: 'gate_ownership',
      validator: 'equals',
      actual:
        row.plan_status === 'approved' &&
        Number(row.plan_steps) >= 14 &&
        Number(row.applied_stage_proposals) >= 6 &&
        Number(row.accepted_gates) === ACCEPTED_GATE_EVENTS.length,
      expected: true,
      evidenceRefs: [
        `pg://transformation_plans/${row.transformation_case_id}/v${row.plan_version ?? 'missing'}`,
        `pg://transformation_case_audit_events/${row.transformation_case_id}`,
      ],
    },
    {
      caseKey: 'finance-and-kpi-owning-readback',
      capability: 'finance_kpi',
      dimension: 'correctness',
      criticalInvariant: 'financial_mechanics',
      validator: 'equals',
      actual: Number(row.financial_analysis_readbacks) >= 1 && Number(row.kpi_readbacks) >= 1,
      expected: true,
      evidenceRefs: [
        `pg://financial_analyses/${row.transformation_case_id}`,
        `pg://initiative_kpis/${row.transformation_case_id}`,
      ],
    },
    {
      caseKey: 'final-output-integrity-readback',
      capability: 'final_outputs',
      dimension: 'evidence',
      criticalInvariant: 'source_honesty',
      validator: 'equals',
      actual:
        Number(row.final_output_count) >= 1 &&
        Number(row.final_output_case_version) === Number(row.case_version) &&
        isSha256(row.facts_digest) &&
        isSha256(row.docx_sha256) &&
        isSha256(row.pptx_sha256),
      expected: true,
      evidenceRefs: [`pg://transformation_final_output_runs/${row.transformation_case_id}`],
    },
    {
      caseKey: 'truthful-case-completion',
      capability: 'transformation_case',
      dimension: 'usefulness',
      criticalInvariant: 'false_completion',
      validator: 'equals',
      actual:
        row.lifecycle_stage === 'final_outputs' &&
        Number(row.artifact_types) >= 12 &&
        Number(row.final_output_count) >= 1 &&
        Boolean(row.execution_run_id),
      expected: true,
      evidenceRefs: [
        `pg://transformation_cases/${row.transformation_case_id}/v${row.case_version}`,
        `pg://transformation_case_artifact_links/${row.transformation_case_id}`,
      ],
    },
  ];
  const results = cases.map((test) => ({ test, ...evaluate(test) }));
  const passedCases = results.filter((result) => result.passed).length;
  const criticalFailures = results
    .filter((result) => !result.passed && result.test.criticalInvariant)
    .map((result) => `${result.test.criticalInvariant}:${result.test.caseKey}`);
  return {
    status: passedCases === results.length && criticalFailures.length === 0 ? 'passed' : 'failed',
    score: passedCases / results.length,
    suiteVersion: 'transformation-case-live-v1',
    evaluatedCaseVersion: Number(row.case_version),
    evaluatedAt: input.now ?? new Date().toISOString(),
    cases: results.map((result) => ({
      caseKey: result.test.caseKey,
      capability: result.test.capability,
      dimension: result.test.dimension,
      criticalInvariant: result.test.criticalInvariant!,
      passed: result.passed,
      evidenceRefs: result.test.evidenceRefs,
      failureReason: result.reason,
    })),
    criticalFailures,
  };
}

export async function runAgentQualityEvaluation(input: {
  organizationId: string;
  executionRunId: string;
  candidateSha: string;
  createdBy: string;
  suiteVersion: string;
  threshold?: number;
  cases: AgentQualityEvalCase[];
}): Promise<{
  evalRunId: string;
  status: 'passed' | 'failed';
  score: number;
  passedCases: number;
  totalCases: number;
  criticalFailures: string[];
}> {
  if (!/^[a-f0-9]{7,64}$/i.test(input.candidateSha)) throw new Error('invalid_candidate_sha');
  if (input.cases.length === 0) throw new Error('quality_eval_cases_required');
  const keys = new Set(input.cases.map((test) => test.caseKey));
  if (keys.size !== input.cases.length) throw new Error('duplicate_quality_eval_case_key');
  for (const dimension of QUALITY_DIMENSIONS) {
    if (!input.cases.some((test) => test.dimension === dimension)) {
      throw new Error(`quality_dimension_missing:${dimension}`);
    }
  }
  for (const invariant of CRITICAL_INVARIANTS) {
    if (!input.cases.some((test) => test.criticalInvariant === invariant)) {
      throw new Error(`critical_invariant_missing:${invariant}`);
    }
  }
  const threshold = Math.min(1, Math.max(0.5, input.threshold ?? 0.85));
  const results = input.cases.map((test) => ({ test, ...evaluate(test) }));
  const passedCases = results.filter((result) => result.passed).length;
  const score = passedCases / results.length;
  const criticalFailures = results
    .filter((result) => !result.passed && result.test.criticalInvariant)
    .map((result) => `${result.test.criticalInvariant}:${result.test.caseKey}`);
  const status = score >= threshold && criticalFailures.length === 0 ? 'passed' : 'failed';
  const evalRunId = `agent-eval-${uuidv4()}`;
  const statements = [
    {
      sql: `INSERT INTO v8_agent_quality_eval_runs
        (eval_run_id, organization_id, execution_run_id, candidate_sha, suite_version, status,
         score, threshold, total_cases, passed_cases, critical_failures_json, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        evalRunId,
        input.organizationId,
        input.executionRunId,
        input.candidateSha,
        input.suiteVersion,
        status,
        score,
        threshold,
        results.length,
        passedCases,
        JSON.stringify(criticalFailures),
        input.createdBy,
      ],
    },
    ...results.map((result) => ({
      sql: `INSERT INTO v8_agent_quality_eval_cases
        (result_id, eval_run_id, organization_id, case_key, capability, dimension,
         critical_invariant, validator, passed, actual_json, expected_json,
         evidence_refs_json, failure_reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        `agent-eval-result-${uuidv4()}`,
        evalRunId,
        input.organizationId,
        result.test.caseKey,
        result.test.capability,
        result.test.dimension,
        result.test.criticalInvariant || null,
        result.test.validator,
        result.passed ? 1 : 0,
        JSON.stringify(result.test.actual),
        JSON.stringify(result.test.expected),
        JSON.stringify(result.test.evidenceRefs),
        result.reason,
      ],
    })),
  ];
  const persisted = await dbTransaction(statements);
  if (!persisted.success) throw new Error('quality_evaluation_transaction_failed');
  return { evalRunId, status, score, passedCases, totalCases: results.length, criticalFailures };
}

export async function getAgentQualityEvaluation(
  evalRunId: string,
  organizationId: string
): Promise<{ run: any; cases: any[] } | null> {
  const run = await dbGet(
    `SELECT * FROM v8_agent_quality_eval_runs WHERE eval_run_id = ? AND organization_id = ?`,
    [evalRunId, organizationId]
  );
  if (!run) return null;
  const cases = await dbAll(
    `SELECT * FROM v8_agent_quality_eval_cases WHERE eval_run_id = ? AND organization_id = ? ORDER BY case_key`,
    [evalRunId, organizationId]
  );
  return { run, cases };
}
