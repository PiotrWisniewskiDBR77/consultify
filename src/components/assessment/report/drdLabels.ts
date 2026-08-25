/**
 * AssessmentReportView — DRD structural labels (dimension/axis names only).
 *
 * ★ LICENCE BOUNDARY (deliberate, read before extending this file):
 * `compileDrdPack()`'s manifest states
 * `licence.usageRestriction: 'internal_only'` with an explicit notice:
 * "DRD/Digital Pathfinder jest metodyką licencjonowaną. Treści QBank v2 i
 * opisy poziomów pochodzą z materiałów DBR77 — zakaz kopiowania do
 * publicznych deliverables bez zgody właściciela metodyki."
 * (src/method-core/methods/drd/compileDrdPack.ts).
 *
 * This report is exactly the scenario that notice is about — "dokument,
 * który konsultant pokazuje zarządowi klienta" is a deliverable that leaves
 * the internal team. So this file deliberately exposes ONLY the
 * structural/topic labels (area name, axis name — e.g. "Procesy Sprzedaży",
 * "Zarządzanie Danymi") needed to say WHICH dimension a frozen number
 * belongs to. It does NOT expose `MethodLevel.title` /
 * `canonicalDefinition` / `description` / `examples` /
 * `technologyExamples` / `misScoringTraps` — the actually-curated QBank v2
 * level content the licence notice names specifically. A report needing
 * that content requires an explicit go-ahead from the methodology owner
 * first (flagged to the coordinator, not decided unilaterally here).
 *
 * Everything below is a pure, static DICTIONARY LOOKUP keyed by the
 * Output's OWN PINNED `methodPackVersion` — never a re-score, never a
 * "what would this be under the latest pack" guess. If the compiled pack's
 * version does not match the pinned version, lookups return `null` and the
 * caller falls back to the raw id — an honest degrade, not a mislabel.
 */
import { compileDrdPack, DRD_METHOD_PACK_ID } from '@/method-core/methods/drd/compileDrdPack';
import { DRD_STRUCTURE } from '@/services/drdStructure';

export interface DrdUnitLabel {
  readonly unitId: string;
  readonly unitName: string;
  readonly axisId: string;
  readonly axisName: string;
  readonly order: number;
  readonly levelScale: readonly number[];
}

let cachedPack: ReturnType<typeof compileDrdPack>['pack'] | null = null;
let cachedPackFailed = false;

function getCompiledDrdPack(): ReturnType<typeof compileDrdPack>['pack'] | null {
  if (cachedPackFailed) return null;
  if (!cachedPack) {
    try {
      cachedPack = compileDrdPack().pack;
    } catch {
      cachedPackFailed = true;
      return null;
    }
  }
  return cachedPack;
}

/** Axis id (`axis-${n}`) -> Polish axis name, from the same source the
 * compiler reads (`DRD_STRUCTURE`) — structural topic labels only. */
const AXIS_NAME_BY_ID: Record<string, string> = Object.fromEntries(
  DRD_STRUCTURE.map((axis) => [`axis-${axis.id}`, axis.namePL || axis.name])
);

/**
 * Resolves a unit id to its structural label, GATED on the Output's own
 * pinned `methodPackId`/`methodPackVersion` matching what's actually
 * compiled here. Returns `null` for a non-DRD pack, a version mismatch, or
 * an unknown unit id — every caller must have a raw-id fallback.
 */
export function resolveDrdUnitLabel(
  methodPackId: string,
  methodPackVersion: string,
  unitId: string
): DrdUnitLabel | null {
  if (methodPackId !== DRD_METHOD_PACK_ID) return null;
  const pack = getCompiledDrdPack();
  if (!pack) return null;
  if (pack.manifest.version !== methodPackVersion) return null;
  const unit = pack.units.find((u) => u.unitId === unitId);
  if (!unit || !unit.parentId) return null;
  return {
    unitId: unit.unitId,
    unitName: unit.name,
    axisId: unit.parentId,
    axisName: AXIS_NAME_BY_ID[unit.parentId] ?? unit.parentId,
    order: unit.order,
    levelScale: unit.levelScale,
  };
}

/**
 * Resolves an axis GROUP id (`aggregation.byGroup`'s own keys — e.g.
 * `axis-1`, NOT a unit id) to its Polish axis name, same
 * pinned-version-gated honesty contract as `resolveDrdUnitLabel` above.
 *
 * ★ 2026-08-26 night-fixes-a (NIGHT_SWEEP_A_REPORT_20260826.md — Assessment
 * FIX-ATOM #8): `AssessmentReportDocument.tsx`'s "Wynik per wymiar (oś)"
 * section rendered these raw `axis-N` keys straight into the document —
 * the exact same axes the "Jednostka oceny" table two sections below
 * already resolves to full Polish names via `resolveDrdUnitLabel`'s own
 * `axisName`. This closes that gap using the SAME dictionary
 * (`AXIS_NAME_BY_ID`), not a second one.
 */
export function resolveDrdAxisName(
  methodPackId: string,
  methodPackVersion: string,
  axisGroupId: string
): string | null {
  if (methodPackId !== DRD_METHOD_PACK_ID) return null;
  const pack = getCompiledDrdPack();
  if (!pack) return null;
  if (pack.manifest.version !== methodPackVersion) return null;
  return AXIS_NAME_BY_ID[axisGroupId] ?? null;
}

export function isDrdPack(methodPackId: string): boolean {
  return methodPackId === DRD_METHOD_PACK_ID;
}
