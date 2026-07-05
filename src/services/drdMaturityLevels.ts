/**
 * drdMaturityLevels — level-descriptor lookup for the DRD maturity radar.
 *
 * The radar tooltip needs a short, human-readable descriptor for the level a
 * given axis currently sits at (and its target level): a level title + a
 * one-sentence description. `drdStructure` stores that per AREA; each axis'
 * areas share the same 1..levelCount ladder, so the FIRST area of the axis is a
 * faithful representative of the axis' maturity ladder.
 *
 * Everything here is deterministic and fail-soft: an unknown axis id or a level
 * outside the axis' range returns `null` rather than throwing.
 */

import DRD_STRUCTURE, { getAxisById } from './drdStructure';

export interface DrdLevelDescriptor {
  /** the (rounded) level looked up, clamped to the axis range */
  level: number;
  /** short level name, e.g. "Automation" / "ERP" */
  title: string;
  /** one-sentence description of what this level means */
  description: string;
}

/** Trim a (possibly multi-sentence) description down to its first sentence. */
function firstSentence(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^[^.!?]*[.!?]/);
  return (match ? match[0] : trimmed).trim();
}

/**
 * Resolve the level descriptor for `axisId` at (rounded) `level`.
 *
 * @param axisId  DRD axis id (1..7). Accepts the string form ("1") too.
 * @param level   the score to describe (may be fractional; rounded + clamped).
 * @returns a descriptor, or `null` when the axis is unknown or has no levels.
 */
export function getDrdLevelDescriptor(
  axisId: number | string,
  level: number
): DrdLevelDescriptor | null {
  const id = typeof axisId === 'string' ? Number(axisId) : axisId;
  if (!Number.isFinite(id)) return null;

  const axis = getAxisById(id);
  const representative = axis?.areas?.[0];
  if (!axis || !representative || representative.levels.length === 0) return null;

  const maxLevel = axis.levelCount || representative.levels.length;
  // Round to the nearest whole level, clamp into [1, maxLevel]. A 0 score
  // (never assessed) still maps to level 1 so we can show *something* useful.
  const rounded = Math.round(level);
  const clamped = Math.min(Math.max(rounded || 1, 1), maxLevel);

  const entry = representative.levels.find((l) => l.level === clamped);
  if (!entry) return null;

  return {
    level: clamped,
    title: entry.title,
    description: firstSentence(entry.description),
  };
}

/**
 * Localized axis name. `drdStructure` carries EN `name` + optional PL `namePL`;
 * this returns the right one for the language (falling back to EN).
 */
export function getDrdAxisName(axisId: number | string, isPolish: boolean): string {
  const id = typeof axisId === 'string' ? Number(axisId) : axisId;
  const axis = getAxisById(id);
  if (!axis) return String(axisId);
  return isPolish && axis.namePL ? axis.namePL : axis.name;
}

/** All DRD axis ids in canonical order (1..7). */
export const DRD_AXIS_IDS: number[] = DRD_STRUCTURE.map((a) => a.id);
