/**
 * AssessmentReportView — generic, NON-method-specific interpretive wording.
 *
 * Requirement (task brief, §2): "wynik ogólny — poziom dojrzałości z
 * interpretacją słowną (nie sama liczba)". The obvious source for that
 * wording would be the DRD method pack's own per-level `title` /
 * `canonicalDefinition` — but those are the licensed QBank v2 content
 * (`licence.usageRestriction: 'internal_only'`, see `drdLabels.ts`'s header
 * comment) and this report is a client-facing deliverable, exactly the case
 * the licence notice warns about. So the words below are deliberately
 * generic — a plain "where does this number sit in its own scale" reading,
 * not a re-statement of DRD's curated level descriptions, and not specific
 * to any one method pack (works the same for DRD 1-7, SIRI's scale, etc).
 *
 * This is a pure, static, DISPLAY-ONLY banding of a number ALREADY frozen
 * in the Output — it invents no new score, just chooses which of five fixed
 * Polish phrases to print next to a number that already exists. Same class
 * of operation as a progress bar picking a colour from a percentage.
 */

export interface MaturityBand {
  readonly label: string;
  /** 0..1 position used for bar rendering. */
  readonly position: number;
}

const BAND_LABELS_PL = [
  'Dolna część skali',
  'Poniżej środka skali',
  'Środek skali',
  'Powyżej środka skali',
  'Górna część skali',
] as const;

/**
 * `value` and `scaleMin`/`scaleMax` come straight from the frozen Output
 * (`current[unitId]`) and the unit's own pinned `levelScale` (structural
 * metadata, not a scored result). Returns `null` when the value or scale is
 * unusable (e.g. `null` level, degenerate 1-point scale) — callers must
 * show "—", never guess.
 */
export function describeMaturityPosition(
  value: number | null,
  scaleMin: number,
  scaleMax: number
): MaturityBand | null {
  if (value === null || !Number.isFinite(value)) return null;
  if (scaleMax <= scaleMin) return null;
  const clamped = Math.min(scaleMax, Math.max(scaleMin, value));
  const position = (clamped - scaleMin) / (scaleMax - scaleMin);
  const bucket = Math.min(BAND_LABELS_PL.length - 1, Math.floor(position * BAND_LABELS_PL.length));
  return { label: BAND_LABELS_PL[bucket], position };
}
