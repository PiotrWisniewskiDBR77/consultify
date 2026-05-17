/**
 * Presentation Studio Source Artifacts Service (Sprint S9)
 *
 * Module: Consultify Presentation Studio.
 * Source of truth:
 *   - .cursor/MODULE_DELIVERY_CONTRACT_STANDARD.md
 *   - consultify/docs/product/CONSULTIFY_PRESENTATION_STUDIO_100_PERCENT_IMPLEMENTATION_CONTRACT_2026-05-08.md
 *
 * Read-only, tenant-scoped enumeration of source artifacts that the user
 * can attach to a Studio deck via the Setup form picker. The Studio
 * `SourceArtifact` universe spans many backing tables (assessments,
 * interview_studies, tool_session, etc.); for S9 we ship the most common
 * type — `assessment` — and document the remaining types as a P2
 * follow-up. The wire shape returned here is intentionally generic so we
 * can grow new sources without changing the public contract.
 *
 * Tenant safety: every query MUST filter by `organization_id`. The route
 * above this service reads `organizationId` from the authenticated session
 * only; any body-supplied id is ignored.
 *
 * Honest readiness chips: each artifact carries a typed readiness label
 * derived from the underlying row state. The UI is responsible for
 * rendering the chip honestly — never silently upgrading missing inputs to
 * "ready".
 */

import { all as dbAll } from '../utils/DbPromise.js';
import type { SourceArtifact } from './presentationGeneratorService.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type PresentationStudioSourceArtifactReadiness = NonNullable<SourceArtifact['readiness']>;

export interface PresentationStudioSourceArtifactItem {
  type: SourceArtifact['type'];
  id: string;
  label: string;
  readiness: PresentationStudioSourceArtifactReadiness;
  confidence: number | null;
  /** ISO timestamp of the last meaningful update on the underlying row. */
  updatedAt: string | null;
  /** Optional hint surfaced to the UI (e.g. "framework=SIRI"). */
  hint: string | null;
}

export interface PresentationStudioSourceArtifactList {
  artifacts: PresentationStudioSourceArtifactItem[];
  /** Total returned. Not a count of all rows; capped by `limit`. */
  total: number;
  /** Per-source-type breakdown. Shown by the UI as a small badge. */
  byType: Record<string, number>;
  /** ISO timestamp the list was assembled. */
  generatedAt: string;
  warnings: string[];
}

export interface ListPresentationStudioSourceArtifactsInput {
  organizationId: string;
  /** Soft cap on the number of artifacts returned. Defaults to 50. */
  limit?: number;
  /** Optional clock injection for deterministic tests. */
  now?: Date;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface AssessmentRow {
  id: string;
  organization_id: string;
  status: string | null;
  framework: string | null;
  assessment_type: string | null;
  overall_score: number | null;
  updated_at: string | null;
  created_at: string | null;
  title: string | null;
  project_id: string | null;
  score_summary: string | null;
  answers_json: string | null;
}

const DEFAULT_LIMIT = 50;
const STATUS_COMPLETED = new Set(['COMPLETED', 'completed', 'DONE', 'done', 'FINAL', 'final']);

/**
 * Map an `assessments` row into a Studio source artifact item. Honest
 * readiness rules:
 *   - `ready`               — status indicates completion OR a non-null
 *                              `overall_score` exists.
 *   - `partial_ready`       — answers exist but neither completion nor a
 *                              score is recorded.
 *   - `insufficient_evidence` — no answers recorded at all.
 *
 * The `confidence` field is mapped to a `[0..1]` range from the assessment's
 * overall score (which is typically `[0..100]`); when no score exists we
 * surface `null` rather than silently defaulting to a number.
 */
function mapAssessmentRow(row: AssessmentRow): PresentationStudioSourceArtifactItem {
  const status = String(row.status || '').trim();
  const hasScore = typeof row.overall_score === 'number' && Number.isFinite(row.overall_score);
  const hasAnswers = !!(row.answers_json && row.answers_json !== '{}' && row.answers_json !== '[]');

  let readiness: PresentationStudioSourceArtifactReadiness;
  if (STATUS_COMPLETED.has(status) || hasScore) {
    readiness = 'ready';
  } else if (hasAnswers) {
    readiness = 'partial_ready';
  } else {
    readiness = 'insufficient_evidence';
  }

  let confidence: number | null = null;
  if (hasScore) {
    const raw = Number(row.overall_score);
    confidence = Math.max(0, Math.min(1, raw > 1 ? raw / 100 : raw));
  }

  const labelParts: string[] = [];
  if (row.title) labelParts.push(String(row.title).trim());
  else if (row.framework) labelParts.push(`${row.framework} assessment`);
  else labelParts.push('Assessment');
  if (
    row.assessment_type &&
    !labelParts[0].toLowerCase().includes(String(row.assessment_type).toLowerCase())
  ) {
    labelParts.push(`(${row.assessment_type})`);
  }

  const hintParts: string[] = [];
  if (row.framework) hintParts.push(`framework=${row.framework}`);
  if (row.project_id) hintParts.push(`project=${row.project_id}`);

  return {
    type: 'assessment',
    id: String(row.id),
    label: labelParts.join(' '),
    readiness,
    confidence,
    updatedAt: row.updated_at || row.created_at || null,
    hint: hintParts.length > 0 ? hintParts.join(' · ') : null,
  };
}

// ---------------------------------------------------------------------------
// Dependency injection seam (tests swap out the assessment query without
// hitting the database).
// ---------------------------------------------------------------------------

export type PresentationStudioAssessmentQueryFn = (
  organizationId: string,
  limit: number
) => Promise<AssessmentRow[]>;

interface SourceArtifactsDependencies {
  queryAssessments: PresentationStudioAssessmentQueryFn;
}

let _deps: SourceArtifactsDependencies | null = null;

const defaultQueryAssessments: PresentationStudioAssessmentQueryFn = async (
  organizationId,
  limit
) => {
  const rows = (await dbAll(
    `SELECT id, organization_id, status, framework, assessment_type, overall_score,
            updated_at, created_at, title, project_id, score_summary, answers_json
       FROM assessments
      WHERE organization_id = ?
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
      LIMIT ?`,
    [organizationId, limit]
  )) as AssessmentRow[];
  return rows;
};

function getDeps(): SourceArtifactsDependencies {
  return _deps ?? { queryAssessments: defaultQueryAssessments };
}

/**
 * Test-only helper. Pass `null` to reset to the real database-backed
 * implementation. Production code MUST NOT call this.
 */
export function _setSourceArtifactsDependenciesForTests(
  deps: SourceArtifactsDependencies | null
): void {
  _deps = deps;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Enumerate the tenant's available source artifacts for the Studio Setup
 * form's source picker. Read-only, tenant-scoped. Never writes.
 */
export async function listPresentationStudioSourceArtifacts(
  input: ListPresentationStudioSourceArtifactsInput
): Promise<PresentationStudioSourceArtifactList> {
  const limit = Math.max(1, Math.min(200, input.limit ?? DEFAULT_LIMIT));
  const now = input.now || new Date();
  const warnings: string[] = [];

  let assessmentRows: AssessmentRow[] = [];
  try {
    assessmentRows = await getDeps().queryAssessments(input.organizationId, limit);
  } catch (error) {
    // Honest UI: surface the error class to the route via warnings, never
    // silently fall back to an empty list. The route still returns 200 with
    // an empty `artifacts` array AND the warning attached, so the picker
    // shows a clearly-degraded state instead of a fake-empty success.
    const message = error instanceof Error ? error.message : 'unknown_error';
    warnings.push(`assessments_query_failed: ${message}`);
  }

  const artifacts = assessmentRows.map(mapAssessmentRow);
  const byType: Record<string, number> = {};
  for (const a of artifacts) {
    byType[a.type] = (byType[a.type] ?? 0) + 1;
  }

  return {
    artifacts,
    total: artifacts.length,
    byType,
    generatedAt: now.toISOString(),
    warnings,
  };
}
