/**
 * Unit tests for `presentationStudioSourceArtifactsService` (Sprint S9).
 *
 * The DB layer is swapped out via `_setSourceArtifactsDependenciesForTests`
 * so we can assert readiness mapping, label/hint formatting, and the
 * honest-degraded contract on query failures without a real database.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  _setSourceArtifactsDependenciesForTests,
  listPresentationStudioSourceArtifacts,
} from '../presentationStudioSourceArtifactsService.js';

describe('presentationStudioSourceArtifactsService', () => {
  beforeEach(() => {
    _setSourceArtifactsDependenciesForTests(null);
  });

  afterEach(() => {
    _setSourceArtifactsDependenciesForTests(null);
    vi.restoreAllMocks();
  });

  it('maps a completed assessment row to a `ready` artifact with confidence', async () => {
    _setSourceArtifactsDependenciesForTests({
      queryAssessments: vi.fn().mockResolvedValue([
        {
          id: 'a-1',
          organization_id: 'org-A',
          status: 'COMPLETED',
          framework: 'SIRI',
          assessment_type: 'maturity',
          overall_score: 87,
          updated_at: '2026-05-01T10:00:00Z',
          created_at: '2026-04-01T10:00:00Z',
          title: 'Q3 readiness review',
          project_id: 'proj-1',
          score_summary: null,
          answers_json: '{"q1":"a"}',
        },
      ]),
    });

    const result = await listPresentationStudioSourceArtifacts({ organizationId: 'org-A' });
    expect(result.artifacts).toHaveLength(1);
    expect(result.artifacts[0]).toMatchObject({
      type: 'assessment',
      id: 'a-1',
      readiness: 'ready',
      confidence: 0.87,
      updatedAt: '2026-05-01T10:00:00Z',
    });
    expect(result.artifacts[0].label).toContain('Q3 readiness review');
    expect(result.artifacts[0].hint).toContain('framework=SIRI');
    expect(result.byType.assessment).toBe(1);
    expect(result.warnings).toEqual([]);
  });

  it('marks rows with answers but no score/completion as `partial_ready`', async () => {
    _setSourceArtifactsDependenciesForTests({
      queryAssessments: vi.fn().mockResolvedValue([
        {
          id: 'a-2',
          organization_id: 'org-A',
          status: 'IN_PROGRESS',
          framework: 'ADMA',
          assessment_type: null,
          overall_score: null,
          updated_at: '2026-05-02T10:00:00Z',
          created_at: null,
          title: null,
          project_id: null,
          score_summary: null,
          answers_json: '{"q1":"a","q2":"b"}',
        },
      ]),
    });

    const result = await listPresentationStudioSourceArtifacts({ organizationId: 'org-A' });
    expect(result.artifacts[0].readiness).toBe('partial_ready');
    expect(result.artifacts[0].confidence).toBeNull();
    expect(result.artifacts[0].label).toContain('ADMA assessment');
  });

  it('marks empty rows as `insufficient_evidence`', async () => {
    _setSourceArtifactsDependenciesForTests({
      queryAssessments: vi.fn().mockResolvedValue([
        {
          id: 'a-3',
          organization_id: 'org-A',
          status: 'DRAFT',
          framework: null,
          assessment_type: null,
          overall_score: null,
          updated_at: null,
          created_at: '2026-05-03T10:00:00Z',
          title: null,
          project_id: null,
          score_summary: null,
          answers_json: '{}',
        },
      ]),
    });

    const result = await listPresentationStudioSourceArtifacts({ organizationId: 'org-A' });
    expect(result.artifacts[0].readiness).toBe('insufficient_evidence');
    expect(result.artifacts[0].confidence).toBeNull();
  });

  it('caps the limit between 1 and 200 and forwards it to the query', async () => {
    const queryAssessments = vi.fn().mockResolvedValue([]);
    _setSourceArtifactsDependenciesForTests({ queryAssessments });

    await listPresentationStudioSourceArtifacts({ organizationId: 'org-A', limit: 9999 });
    expect(queryAssessments).toHaveBeenCalledWith('org-A', 200);

    await listPresentationStudioSourceArtifacts({ organizationId: 'org-A', limit: 0 });
    expect(queryAssessments).toHaveBeenLastCalledWith('org-A', 1);
  });

  it('surfaces honest degraded state with a typed warning when the query fails', async () => {
    _setSourceArtifactsDependenciesForTests({
      queryAssessments: vi.fn().mockRejectedValue(new Error('connection lost')),
    });

    const result = await listPresentationStudioSourceArtifacts({ organizationId: 'org-A' });
    expect(result.artifacts).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('assessments_query_failed');
    expect(result.warnings[0]).toContain('connection lost');
  });

  it('passes the tenant id straight through to the underlying query', async () => {
    const queryAssessments = vi.fn().mockResolvedValue([]);
    _setSourceArtifactsDependenciesForTests({ queryAssessments });

    await listPresentationStudioSourceArtifacts({ organizationId: 'org-Z' });
    expect(queryAssessments).toHaveBeenCalledWith('org-Z', 50);
  });
});
