/**
 * drdAnswersAdapter — bridges Piotr's original DRDForm data shape to the session's
 * canonical DRD answers shape so all DRD surfaces (Form / Table / Matrix) share ONE
 * source of truth and round-trip losslessly.
 *
 * Canonical (SSOT, written by DRDAssessmentEditor + read by calcDrdCompletionPercent):
 *   answers.drd.areas[areaId] = { achievedLevel, targetLevel?, levelNotes?, levelLinks?, levelDecisions? }
 *
 * DRDForm's native shape (Piotr's original "Digital Readiness Diagnosis Form"):
 *   data.{axisKey}.areaScores[areaId] = [actual, target]   // per-axis grouping
 *   data.{axisKey}.actual / .target                          // axis averages (recomputed by the form)
 *
 * Mapping:
 *   DRDForm actual  <-> canonical achievedLevel
 *   DRDForm target  <-> canonical targetLevel
 *
 * Notes preserved: converting Form -> canonical keeps any existing levelNotes /
 * levelLinks / levelDecisions untouched (Form does not edit them), so switching
 * Form <-> Table never drops the richer evidence captured in the Table view.
 */
import type { DRDEditorAnswers } from '@/components/assessment/drd/DRDAssessmentEditor';
import { DRD_AXIS_KEY_MAP, DRD_STRUCTURE } from '@/services/drdStructure';

// Local mirror of DRDForm's data shape (DRDForm does not export these types).
type AxisScore = {
  actual: number;
  target: number;
  areaScores?: Record<string, [number, number]>;
};
export type DRDFormData = {
  processes?: AxisScore;
  digitalProducts?: AxisScore;
  businessModels?: AxisScore;
  dataManagement?: AxisScore;
  culture?: AxisScore;
  cybersecurity?: AxisScore;
  aiMaturity?: AxisScore;
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Which axis a given areaId belongs to (via DRD_STRUCTURE). */
function axisKeyForArea(areaId: string): string | null {
  for (const axis of DRD_STRUCTURE) {
    if (axis.areas.some((a) => a.id === areaId)) {
      return DRD_AXIS_KEY_MAP[axis.id] || null;
    }
  }
  return null;
}

/**
 * canonical answers.drd (areas shape) -> DRDForm data (per-axis areaScores).
 * Recomputes each axis's actual/target averages from its area scores, matching
 * DRDForm's own internal averaging so summaries render identically.
 */
export function areasToFormData(answers: DRDEditorAnswers | undefined): DRDFormData {
  const areas = answers?.areas || {};
  const out: DRDFormData = {};

  for (const axis of DRD_STRUCTURE) {
    const axisKey = DRD_AXIS_KEY_MAP[axis.id] as keyof DRDFormData;
    if (!axisKey) continue;

    const areaScores: Record<string, [number, number]> = {};
    let sumActual = 0;
    let sumTarget = 0;
    let count = 0;

    for (const area of axis.areas) {
      const s = areas[area.id];
      const actual = Number(s?.achievedLevel || 0);
      const target = Number(s?.targetLevel || 0);
      if (actual > 0 || target > 0) {
        areaScores[area.id] = [actual, target];
        sumActual += actual;
        sumTarget += target;
        count += 1;
      }
    }

    if (count > 0) {
      out[axisKey] = {
        actual: round1(sumActual / count),
        target: round1(sumTarget / count),
        areaScores,
      };
    }
  }

  return out;
}

/**
 * DRDForm data (per-axis areaScores) -> canonical answers.drd (areas shape),
 * MERGED onto the existing answers so richer per-area fields (notes/links/
 * decisions authored in the Table view) are preserved.
 */
export function formDataToAreas(
  formData: DRDFormData,
  prev: DRDEditorAnswers | undefined
): DRDEditorAnswers {
  const nextAreas: DRDEditorAnswers['areas'] = { ...(prev?.areas || {}) };

  for (const axisKey of Object.keys(formData) as Array<keyof DRDFormData>) {
    const axisScore = formData[axisKey];
    const areaScores = axisScore?.areaScores || {};
    for (const areaId of Object.keys(areaScores)) {
      const [actual, target] = areaScores[areaId] || [0, 0];
      const existing = nextAreas[areaId] || { achievedLevel: 0 };
      nextAreas[areaId] = {
        ...existing,
        achievedLevel: Number(actual || 0),
        targetLevel: target > 0 ? Number(target) : existing.targetLevel,
      };
    }
  }

  return { ...(prev || {}), areas: nextAreas };
}

export { axisKeyForArea };
