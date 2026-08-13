/**
 * buildPresentationDeck — derives the 9-slide presentation view model from a
 * frozen `AssessmentOutput`, and ONLY from it (plus optional narrative
 * framing the presenter supplies explicitly — never invented here, see
 * `PresentationNarrativeInput` below).
 *
 * ★ "Zero przeliczania w komponencie" (no recomputation in the presentation
 * component — worker brief, hard rule): every number on every slide is
 * either (a) copied verbatim from `output.*`, or (b) produced by the
 * SHARED, already-canon Method Kernel derivation functions
 * (`buildReportSnapshot`, `buildPresentationView` — `@/method-core/outputs`)
 * that the rest of the kernel (DRD session runtime's Report generation)
 * already uses for the exact same Output → Report/Presentation step. This
 * module adds only FILTERING/SORTING/GROUPING of values that already exist
 * on the Output — never a new average, ratio, or score.
 *
 * ★ "Dane WYŁĄCZNIE z zamrożonego Outputu": fields the task brief asks for
 * that the frozen `AssessmentOutput` schema has NO slot for at all —
 * "kto uczestniczył" (no participant list on Output; it only exists as an
 * AUTHORED field on a `ReportSnapshot`, which may not exist yet for a bare
 * Output) and "pytanie biznesowe" (no such field anywhere in the kernel
 * contracts) — are modeled as explicit OPTIONAL presenter-supplied inputs
 * (`PresentationNarrativeInput`), never fabricated in here. Omitting them
 * renders an honest "not captured" state on the relevant slide — see
 * `slides.tsx`'s `MissingNarrativeNote`.
 */
import {
  buildPresentationView,
  buildReportSnapshot,
  type AssessmentOutput,
  type Finding,
  type ReportGroupResult,
} from '@/method-core/outputs';

// ---------------------------------------------------------------------------
// Presenter-supplied narrative framing — OPTIONAL, NEVER invented in here.
// ---------------------------------------------------------------------------

export interface PresentationNarrativeInput {
  /** Display name for the client/organization on the title slide. Falls back
   * to `output.scope` (which IS frozen Output data) when omitted. */
  readonly clientName?: string;
  /** The business question that motivated the assessment — no field on
   * `AssessmentOutput` carries this; must come from the presenter. */
  readonly businessQuestion?: string;
  /** Who took part — see module doc comment: not part of a bare Output. */
  readonly participants?: readonly string[];
}

// ---------------------------------------------------------------------------
// Slide 5 — per-dimension profile
// ---------------------------------------------------------------------------

export interface DimensionProfileEntry {
  readonly groupId: string;
  readonly groupName: string;
  readonly currentLevel: number | null;
}

// ---------------------------------------------------------------------------
// Slides 6/7 — findings-derived highlights
// ---------------------------------------------------------------------------

export interface FindingHighlight {
  readonly findingId: string;
  readonly unitId: string;
  readonly unitName: string;
  readonly currentLevel: number | null;
  readonly targetLevel: number | null;
  readonly gap: number | null;
  readonly text: string;
  readonly confidence: Finding['confidence'];
}

// ---------------------------------------------------------------------------
// Slide 8 — what the organization does not know about itself
// ---------------------------------------------------------------------------

export interface UnknownUnitEntry {
  readonly unitId: string;
  readonly unitName: string | null;
}

/** Optional per-reason split of `unitsMissingEvidence` — see
 * `rawOutputTypes.ts`'s `RawUnknownReasonBreakdown` doc comment for why this
 * is undefined today (the frozen Output does not distinguish `dont_know`
 * from `no_evidence`) and how it is wired through once it exists. */
export interface UnknownReasonBreakdown {
  readonly dontKnow: number;
  readonly noEvidence: number;
  readonly other?: number;
}

export interface UnknownsModel {
  readonly totalUnits: number;
  readonly unitsWithAcceptedEvidence: number;
  readonly unitsMissingEvidence: number;
  readonly completenessRatio: number;
  readonly unknownUnits: readonly UnknownUnitEntry[];
  /** Present only when the caller supplied it (see `buildPresentationDeck`'s
   * `reasonBreakdown` parameter) — absent means the frozen Output only
   * carries the aggregated count, and the slide must say so honestly. */
  readonly reasonBreakdown?: UnknownReasonBreakdown;
}

// ---------------------------------------------------------------------------
// Full deck model
// ---------------------------------------------------------------------------

export interface PresentationDeckModel {
  readonly outputId: string;
  readonly outputVersion: number;
  readonly module: AssessmentOutput['module'];
  readonly methodPackId: string;
  readonly methodPackVersion: string;
  readonly scope: string;
  readonly frozenAt: string;
  readonly narrative: PresentationNarrativeInput;

  readonly overallResult: number | null;
  readonly aggregationRule: string;
  readonly aggregationMappingVersion: string;

  readonly dimensionProfile: readonly DimensionProfileEntry[];

  readonly strengths: readonly FindingHighlight[];
  readonly gapsAndRisks: readonly FindingHighlight[];
  readonly recommendations: readonly string[];

  readonly limitations: readonly string[];
  readonly unknowns: UnknownsModel;

  readonly draftFindingCount: number;
}

function unitNameLookup(output: AssessmentOutput): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  for (const f of output.findings) {
    if (!map.has(f.unitId)) map.set(f.unitId, f.unitName);
  }
  return map;
}

function dimensionProfileFrom(groupResults: readonly ReportGroupResult[]): DimensionProfileEntry[] {
  // Sort by level descending (a display ordering — the values themselves
  // are untouched, copied straight from `groupResults`, which is itself
  // `output.aggregation.byGroup` reshaped by the shared kernel function).
  return [...groupResults]
    .map((g) => ({ groupId: g.groupId, groupName: g.groupName, currentLevel: g.aggregatedLevel }))
    .sort((a, b) => {
      if (a.currentLevel === null && b.currentLevel === null) return a.groupId.localeCompare(b.groupId);
      if (a.currentLevel === null) return 1;
      if (b.currentLevel === null) return -1;
      return b.currentLevel - a.currentLevel;
    });
}

function highlightFrom(f: Finding, text: string): FindingHighlight {
  return {
    findingId: f.id,
    unitId: f.unitId,
    unitName: f.unitName,
    currentLevel: f.currentLevel,
    targetLevel: f.targetLevel,
    gap: f.gap,
    text,
    confidence: f.confidence,
  };
}

/**
 * Builds the complete 9-slide model. `narrative` is passed through
 * untouched — see `PresentationNarrativeInput`'s doc comment for why it is
 * never derived from the Output.
 */
export function buildPresentationDeck(
  output: AssessmentOutput,
  narrative: PresentationNarrativeInput = {},
  reasonBreakdown?: UnknownReasonBreakdown
): PresentationDeckModel {
  // `includeDrafts: true` only affects `view.draftFindings` (used below
  // purely as a COUNT, on slide 8's disclaimer) — `view.acceptedFindings`,
  // the source for strengths/gapsAndRisks/recommendations, is the same
  // accepted-only set either way. Without this flag `draftFindings` is
  // always `[]` regardless of the Output's actual content (see
  // `buildPresentationView`'s doc comment), which would silently under-
  // report the disclaimer below.
  const view = buildPresentationView(output, { includeDrafts: true });

  const report = buildReportSnapshot(output, {
    id: `presentation-view-${output.id}`,
    executiveSummary: '',
    participants: narrative.participants ?? [],
    strengths: [],
    initiativeCandidates: [],
    appendices: [],
    createdAt: output.frozenAt,
  });

  // Strengths: accepted findings that already met/exceeded target
  // (`gap <= 0`) — a filter on the already-frozen `gap` field, the same
  // sign convention `buildReportSnapshot` itself uses for the mirror-image
  // "gapsAndRisks" filter (`gap > 0`). No new number is computed.
  const strengths = view.acceptedFindings
    .filter((f) => f.gap !== null && f.gap <= 0)
    .map((f) => highlightFrom(f, f.businessMeaning || f.recommendation))
    .sort((a, b) => (b.currentLevel ?? 0) - (a.currentLevel ?? 0));

  const gapsAndRisks = view.acceptedFindings
    .filter((f) => f.gap !== null && f.gap > 0)
    .map((f) => highlightFrom(f, f.riskOrOpportunity || f.businessMeaning))
    .sort((a, b) => (b.gap ?? 0) - (a.gap ?? 0));

  const names = unitNameLookup(output);
  const unknownUnitIds = Object.keys(output.current).filter((unitId) => output.current[unitId] === null);
  const unknownUnits: UnknownUnitEntry[] = [...unknownUnitIds]
    .sort((a, b) => a.localeCompare(b))
    .map((unitId) => ({ unitId, unitName: names.get(unitId) ?? null }));

  return {
    outputId: output.id,
    outputVersion: output.version,
    module: output.module,
    methodPackId: output.methodology.methodPackId,
    methodPackVersion: output.methodology.version,
    scope: output.scope,
    frozenAt: output.frozenAt,
    narrative,

    overallResult: report.overallResult,
    aggregationRule: output.aggregation.rule,
    aggregationMappingVersion: output.aggregation.mappingVersion,

    dimensionProfile: dimensionProfileFrom(report.groupResults),

    strengths,
    gapsAndRisks,
    recommendations: report.recommendations,

    limitations: output.limitations,
    unknowns: {
      totalUnits: output.evidenceCompleteness.totalUnits,
      unitsWithAcceptedEvidence: output.evidenceCompleteness.unitsWithAcceptedEvidence,
      unitsMissingEvidence: output.evidenceCompleteness.unitsMissingEvidence,
      completenessRatio: output.evidenceCompleteness.completenessRatio,
      unknownUnits,
      ...(reasonBreakdown ? { reasonBreakdown } : {}),
    },

    draftFindingCount: view.draftFindings.length,
  };
}
