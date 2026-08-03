/**
 * ASM-001A — server-derived DRD completion.
 *
 * Mirrors `calcDrdCompletionPercent` in `src/views/AssessmentSessionEditorView.tsx`
 * (lines ~149-172) byte-for-byte in intent: an area counts as "answered" when it
 * has ANY meaningful decision recorded — achievedLevel, targetLevel, explicit
 * levelDecisions, non-empty levelNotes, or non-empty levelLinks. This is the
 * contract the frontend compares against, so keep the two in lockstep.
 *
 * Server is now the source of truth for `completion_percent` on DRD
 * assessments — the client-submitted value is ignored (see assessment.routes.ts
 * GET/PUT handlers). Non-DRD frameworks (SIRI/ADMA/CMMI/Lean) are untouched and
 * keep trusting the client; this module is DRD-only by design.
 */
import { DRD_STRUCTURE } from '../../data/drdStructure.js';

export interface DrdAreaAnswerState {
  achievedLevel?: number | string | null;
  targetLevel?: number | string | null;
  levelNotes?: Record<string, unknown> | null;
  levelLinks?: Record<string, unknown> | null;
  levelDecisions?: Record<string, unknown> | null;
  [key: string]: unknown;
}

export type DrdAreasMap = Record<string, DrdAreaAnswerState | null | undefined>;

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

/**
 * Computes DRD completion percent (0-100, rounded) from the `answers.drd.areas`
 * map. Total denominator is the full DRD_STRUCTURE area count (39 areas across
 * 7 axes) — identical to the client-side denominator, so the two never drift
 * on partial/empty payloads.
 */
export function computeDrdCompletion(areas: DrdAreasMap | null | undefined): number {
  const safeAreas: DrdAreasMap = areas || {};
  const totalAreas = DRD_STRUCTURE.reduce((acc, axis) => acc + axis.areas.length, 0);
  if (totalAreas === 0) return 0;

  const answered = DRD_STRUCTURE.reduce((acc, axis) => {
    for (const area of axis.areas) {
      if (isAreaAnswered(safeAreas[area.id])) acc += 1;
    }
    return acc;
  }, 0);

  return Math.round((answered / totalAreas) * 100);
}

export default computeDrdCompletion;
