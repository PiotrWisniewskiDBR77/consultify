/**
 * ASM-005/007 — DRD axis evidence + server-derived quality/scoring output.
 *
 * Evidence rows (`assessment_axis_evidence`) are free-form notes/links/documents
 * attached to a specific DRD axis+area. `computeDrdScoring` is a PURE function
 * that rolls up the raw `answers.drd.areas` map (see drdCompletion.ts) together
 * with evidence rows into a per-axis + overall scoring summary the client can
 * render without doing its own math.
 *
 * The "answered" heuristic in `isAreaAnswered` below is intentionally kept in
 * lockstep with `isAreaAnswered` in `drdCompletion.ts` (which is not exported)
 * — do not let the two drift.
 */
import { DRD_STRUCTURE } from '../../data/drdStructure.js';
import * as queryHelpers from '../../utils/queryHelpers.js';
import type { PinnedTransactionClient } from '../../database/PostgresDatabase.js';
import { v4 as uuidv4 } from 'uuid';
import { computeDrdCompletion } from './drdCompletion.js';
import type { DrdAreaAnswerState, DrdAreasMap } from './drdCompletion.js';

export type { DrdAreasMap };

export type EvidenceType = 'note' | 'link' | 'document' | 'reference';

const EVIDENCE_TYPES: EvidenceType[] = ['note', 'link', 'document', 'reference'];

export interface EvidenceRecord {
  id: string;
  organizationId: string;
  assessmentId: string;
  axisId: string;
  areaId: string;
  evidenceType: EvidenceType;
  title: string;
  description: string | null;
  url: string | null;
  createdBy: string;
  createdAt: string;
}

interface AssessmentAxisEvidenceRow {
  id: string;
  organization_id: string;
  assessment_id: string;
  axis_id: string;
  area_id: string;
  evidence_type: string;
  title: string;
  description: string | null;
  url: string | null;
  created_by: string;
  created_at: string | Date;
}

function mapRow(row: AssessmentAxisEvidenceRow): EvidenceRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    assessmentId: row.assessment_id,
    axisId: row.axis_id,
    areaId: row.area_id,
    evidenceType: row.evidence_type as EvidenceType,
    title: row.title,
    description: row.description ?? null,
    url: row.url ?? null,
    createdBy: row.created_by,
    createdAt:
      row.created_at instanceof Date
        ? (row.created_at as Date).toISOString()
        : String(row.created_at),
  };
}

/**
 * Validates that `axisId`+`areaId` refer to a real DRD area belonging to that
 * axis. Returns nothing on success; throws a coded Error otherwise.
 */
function assertValidAxisArea(axisId: string, areaId: string): void {
  const axis = DRD_STRUCTURE.find((a) => String(a.id) === axisId);
  const area = axis?.areas.find((ar) => ar.id === areaId);
  if (!axis || !area) {
    const err = new Error(
      `Invalid DRD axis/area combination: axisId=${axisId}, areaId=${areaId}`
    ) as Error & { code?: string };
    err.code = 'DRD_AXIS_AREA_INVALID';
    throw err;
  }
}

export async function addEvidence(params: {
  organizationId: string;
  assessmentId: string;
  axisId: string;
  areaId: string;
  evidenceType: string;
  title: string;
  description?: string | null;
  url?: string | null;
  createdBy: string;
}): Promise<EvidenceRecord> {
  const { organizationId, assessmentId, axisId, areaId, evidenceType, createdBy } = params;
  const title = params.title?.trim();
  const description = params.description ?? null;
  const url = params.url ?? null;

  assertValidAxisArea(axisId, areaId);

  if (!EVIDENCE_TYPES.includes(evidenceType as EvidenceType)) {
    const err = new Error(
      `Invalid evidence type: ${evidenceType}. Must be one of ${EVIDENCE_TYPES.join(', ')}`
    ) as Error & { code?: string };
    err.code = 'EVIDENCE_TYPE_INVALID';
    throw err;
  }

  if (!title) {
    const err = new Error('Evidence title is required') as Error & { code?: string };
    err.code = 'EVIDENCE_TITLE_REQUIRED';
    throw err;
  }

  const id = uuidv4();
  const now = new Date().toISOString();

  await queryHelpers.queryRun(
    `INSERT INTO assessment_axis_evidence (
      id, organization_id, assessment_id, axis_id, area_id, evidence_type,
      title, description, url, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      organizationId,
      assessmentId,
      axisId,
      areaId,
      evidenceType,
      title,
      description,
      url,
      createdBy,
      now,
    ]
  );

  return {
    id,
    organizationId,
    assessmentId,
    axisId,
    areaId,
    evidenceType: evidenceType as EvidenceType,
    title,
    description,
    url,
    createdBy,
    createdAt: now,
  };
}

export async function listEvidence(
  params: {
    organizationId: string;
    assessmentId: string;
  },
  tx?: PinnedTransactionClient
): Promise<EvidenceRecord[]> {
  const rows = await (tx ?? queryHelpers).queryAll<AssessmentAxisEvidenceRow>(
    `SELECT id, organization_id, assessment_id, axis_id, area_id, evidence_type,
            title, description, url, created_by, created_at
     FROM assessment_axis_evidence
     WHERE organization_id = ? AND assessment_id = ?
     ORDER BY created_at ASC`,
    [params.organizationId, params.assessmentId]
  );

  return rows.map(mapRow);
}

export interface DrdAxisScoring {
  axisId: string;
  axisName: string;
  areaCount: number;
  answeredAreas: number;
  avgAchievedLevel: number;
  avgTargetLevel: number;
  gap: number;
  evidenceCount: number;
  hasEvidence: boolean;
}

export interface DrdDerivedScoring {
  completionPercent: number;
  overallAvgAchievedLevel: number;
  evidenceCoverage: number;
  axesMissingEvidence: string[];
  axes: DrdAxisScoring[];
}

/**
 * Local, unexported reimplementation of `isAreaAnswered` from drdCompletion.ts
 * (kept byte-for-byte identical in intent) — that helper isn't exported, and
 * drdCompletion.ts is not to be modified for this task.
 */
function isAreaAnswered(state: DrdAreaAnswerState | null | undefined): boolean {
  if (!state) return false;

  const hasAchieved = Number(state.achievedLevel || 0) > 0;
  const hasTarget = Number(state.targetLevel || 0) > 0;

  const hasDecisions = Boolean(
    state.levelDecisions && Object.keys(state.levelDecisions || {}).length > 0
  );

  const hasNotes = Boolean(
    state.levelNotes && Object.values(state.levelNotes || {}).some((v) => String(v || '').trim())
  );

  const hasLinks = Boolean(
    state.levelLinks &&
    Object.values(state.levelLinks || {}).some((arr) => Array.isArray(arr) && arr.length > 0)
  );

  return hasAchieved || hasTarget || hasDecisions || hasNotes || hasLinks;
}

export function computeDrdScoring(
  areas: DrdAreasMap | null | undefined,
  evidenceRows: EvidenceRecord[]
): DrdDerivedScoring {
  const safeAreas: DrdAreasMap = areas || {};

  const axes: DrdAxisScoring[] = DRD_STRUCTURE.map((axis) => {
    const axisId = String(axis.id);
    const areaCount = axis.areas.length;

    let answeredAreas = 0;
    let achievedSum = 0;
    let achievedCount = 0;
    let targetSum = 0;
    let targetCount = 0;

    for (const area of axis.areas) {
      const state = safeAreas[area.id];
      if (isAreaAnswered(state)) answeredAreas += 1;

      const achieved = Number(state?.achievedLevel || 0);
      if (achieved > 0) {
        achievedSum += achieved;
        achievedCount += 1;
      }

      const target = Number(state?.targetLevel || 0);
      if (target > 0) {
        targetSum += target;
        targetCount += 1;
      }
    }

    const avgAchievedLevel = achievedCount > 0 ? achievedSum / achievedCount : 0;
    const avgTargetLevel = targetCount > 0 ? targetSum / targetCount : 0;
    const evidenceCount = evidenceRows.filter((row) => row.axisId === axisId).length;

    return {
      axisId,
      axisName: axis.namePL || axis.name,
      areaCount,
      answeredAreas,
      avgAchievedLevel,
      avgTargetLevel,
      gap: avgTargetLevel - avgAchievedLevel,
      evidenceCount,
      hasEvidence: evidenceCount > 0,
    };
  });

  const completionPercent = computeDrdCompletion(areas);

  const axesWithAchieved = axes.filter((axis) => axis.avgAchievedLevel > 0);
  const overallAvgAchievedLevel =
    axesWithAchieved.length > 0
      ? axesWithAchieved.reduce((acc, axis) => acc + axis.avgAchievedLevel, 0) /
        axesWithAchieved.length
      : 0;

  const axesWithEvidence = axes.filter((axis) => axis.hasEvidence).length;
  const evidenceCoverage = axes.length > 0 ? Math.round((axesWithEvidence / axes.length) * 100) : 0;

  const axesMissingEvidence = axes.filter((axis) => !axis.hasEvidence).map((axis) => axis.axisId);

  return {
    completionPercent,
    overallAvgAchievedLevel,
    evidenceCoverage,
    axesMissingEvidence,
    axes,
  };
}

export async function getAxesMissingEvidence(params: {
  organizationId: string;
  assessmentId: string;
  areas: DrdAreasMap | null | undefined;
}): Promise<string[]> {
  const evidenceRows = await listEvidence({
    organizationId: params.organizationId,
    assessmentId: params.assessmentId,
  });

  return computeDrdScoring(params.areas, evidenceRows).axesMissingEvidence;
}
