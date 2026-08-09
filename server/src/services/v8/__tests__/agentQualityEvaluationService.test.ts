import { createHash } from 'node:crypto';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbTransaction = vi.fn();
const dbGet = vi.fn();
const dbAll = vi.fn();

vi.mock('../../../utils/DbPromise.js', () => ({
  transaction: dbTransaction,
  get: dbGet,
  all: dbAll,
}));

const report = 'verified transformation report';
const cases = [
  {
    caseKey: 'tenant-isolation',
    capability: 'governance',
    dimension: 'policy_compliance' as const,
    criticalInvariant: 'tenant_isolation' as const,
    validator: 'equals' as const,
    actual: 0,
    expected: 0,
    evidenceRefs: ['pg://tenant-probe'],
  },
  {
    caseKey: 'finance-npv',
    capability: 'finance',
    dimension: 'correctness' as const,
    criticalInvariant: 'financial_mechanics' as const,
    validator: 'numeric_tolerance' as const,
    actual: 120.01,
    expected: { value: 120, tolerance: 0.02 },
    evidenceRefs: ['pg://finance/readback'],
  },
  {
    caseKey: 'approval-owner',
    capability: 'approval',
    dimension: 'completeness' as const,
    criticalInvariant: 'gate_ownership' as const,
    validator: 'allowed_state' as const,
    actual: 'approved_by_owner',
    expected: ['approved_by_owner'],
    evidenceRefs: ['pg://approval/audit'],
  },
  {
    caseKey: 'report-digest',
    capability: 'report',
    dimension: 'evidence' as const,
    criticalInvariant: 'source_honesty' as const,
    validator: 'sha256_match' as const,
    actual: report,
    expected: createHash('sha256').update(report).digest('hex'),
    evidenceRefs: ['artifact://report.docx'],
  },
  {
    caseKey: 'truthful-summary',
    capability: 'final_summary',
    dimension: 'usefulness' as const,
    criticalInvariant: 'false_completion' as const,
    validator: 'forbidden_patterns_absent' as const,
    actual: 'Completed 11 of 12 stages; deployment evidence remains pending.',
    expected: ['all accepted', 'fully deployed'],
    evidenceRefs: ['pg://run/status'],
  },
];

describe('agentQualityEvaluationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbTransaction.mockResolvedValue({ success: true, results: [] });
  });

  it('passes only a fully covered suite with computed deterministic validators', async () => {
    const { runAgentQualityEvaluation } = await import('../agentQualityEvaluationService.js');
    const result = await runAgentQualityEvaluation({
      organizationId: 'org-a',
      executionRunId: 'run-a',
      candidateSha: 'abcdef1234567890',
      createdBy: 'owner-a',
      suiteVersion: '1.0.0',
      cases,
    });
    expect(result).toEqual(
      expect.objectContaining({ status: 'passed', score: 1, passedCases: 5, totalCases: 5 })
    );
    expect(dbTransaction).toHaveBeenCalledWith(expect.arrayContaining([expect.any(Object)]));
  });

  it('fails on one critical invariant even when an aggregate threshold would otherwise pass', async () => {
    const { runAgentQualityEvaluation } = await import('../agentQualityEvaluationService.js');
    const result = await runAgentQualityEvaluation({
      organizationId: 'org-a',
      executionRunId: 'run-a',
      candidateSha: 'abcdef1234567890',
      createdBy: 'owner-a',
      suiteVersion: '1.0.0',
      threshold: 0.5,
      cases: cases.map((test) =>
        test.caseKey === 'tenant-isolation' ? { ...test, actual: 1 } : test
      ),
    });
    expect(result.status).toBe('failed');
    expect(result.score).toBe(0.8);
    expect(result.criticalFailures).toEqual(['tenant_isolation:tenant-isolation']);
  });

  it('rejects suites that omit a mandatory quality dimension', async () => {
    const { runAgentQualityEvaluation } = await import('../agentQualityEvaluationService.js');
    await expect(
      runAgentQualityEvaluation({
        organizationId: 'org-a',
        executionRunId: 'run-a',
        candidateSha: 'abcdef1234567890',
        createdBy: 'owner-a',
        suiteVersion: '1.0.0',
        cases: cases.filter((test) => test.dimension !== 'usefulness'),
      })
    ).rejects.toThrow('quality_dimension_missing:usefulness');
  });

  it('turns a case without evidence into a computed failure', async () => {
    const { runAgentQualityEvaluation } = await import('../agentQualityEvaluationService.js');
    const result = await runAgentQualityEvaluation({
      organizationId: 'org-a',
      executionRunId: 'run-a',
      candidateSha: 'abcdef1234567890',
      createdBy: 'owner-a',
      suiteVersion: '1.0.0',
      cases: cases.map((test) =>
        test.caseKey === 'report-digest' ? { ...test, evidenceRefs: [] } : test
      ),
    });
    expect(result.status).toBe('failed');
    expect(result.criticalFailures).toContain('source_honesty:report-digest');
  });

  it('builds a passing transformation evaluation only from canonical live readbacks', async () => {
    dbGet.mockResolvedValue({
      transformation_case_id: 'case-live',
      organization_id: 'org-a',
      lifecycle_stage: 'final_outputs',
      case_version: 24,
      execution_run_id: 'run-live',
      plan_status: 'approved',
      plan_version: 1,
      plan_steps: 14,
      approved_stage_proposals: 0,
      applied_stage_proposals: 7,
      accepted_gates: 11,
      artifact_types: 15,
      financial_analysis_readbacks: 1,
      kpi_readbacks: 1,
      final_output_count: 1,
      final_output_case_version: 24,
      facts_digest: 'a'.repeat(64),
      docx_sha256: 'b'.repeat(64),
      pptx_sha256: 'c'.repeat(64),
      foreign_tenant_rows: 0,
    });
    const { evaluateTransformationCaseLive } = await import('../agentQualityEvaluationService.js');
    const result = await evaluateTransformationCaseLive({
      transformationCaseId: 'case-live',
      organizationId: 'org-a',
      now: '2026-08-07T10:00:00.000Z',
    });
    expect(result).toEqual(
      expect.objectContaining({
        status: 'passed',
        score: 1,
        suiteVersion: 'transformation-case-live-v1',
        evaluatedCaseVersion: 24,
        evaluatedAt: '2026-08-07T10:00:00.000Z',
        criticalFailures: [],
      })
    );
    expect(result?.cases).toHaveLength(5);
    expect(dbGet).toHaveBeenCalledWith(expect.stringContaining('JOIN financial_analyses'), [
      expect.any(Array),
      'case-live',
      'org-a',
    ]);
    expect(dbTransaction).not.toHaveBeenCalled();
  });

  it('fails closed when owning Finance/KPI and final-output readbacks are incomplete', async () => {
    dbGet.mockResolvedValue({
      transformation_case_id: 'case-live',
      organization_id: 'org-a',
      lifecycle_stage: 'final_outputs',
      case_version: 24,
      execution_run_id: 'run-live',
      plan_status: 'approved',
      plan_version: 1,
      plan_steps: 14,
      approved_stage_proposals: 0,
      applied_stage_proposals: 7,
      accepted_gates: 11,
      artifact_types: 15,
      financial_analysis_readbacks: 0,
      kpi_readbacks: 0,
      final_output_count: 1,
      final_output_case_version: 23,
      facts_digest: 'not-a-digest',
      docx_sha256: 'b'.repeat(64),
      pptx_sha256: 'c'.repeat(64),
      foreign_tenant_rows: 0,
    });
    const { evaluateTransformationCaseLive } = await import('../agentQualityEvaluationService.js');
    const result = await evaluateTransformationCaseLive({
      transformationCaseId: 'case-live',
      organizationId: 'org-a',
    });
    expect(result?.status).toBe('failed');
    expect(result?.score).toBe(0.6);
    expect(result?.criticalFailures).toEqual([
      'financial_mechanics:finance-and-kpi-owning-readback',
      'source_honesty:final-output-integrity-readback',
    ]);
  });

  it('returns null for a case outside the authenticated tenant', async () => {
    dbGet.mockResolvedValue(null);
    const { evaluateTransformationCaseLive } = await import('../agentQualityEvaluationService.js');
    await expect(
      evaluateTransformationCaseLive({
        transformationCaseId: 'case-foreign',
        organizationId: 'org-a',
      })
    ).resolves.toBeNull();
  });
});
