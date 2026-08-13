/**
 * Report rendering — 10_ASSESSMENT_REVIEW.md §15.
 *
 * `buildReportSnapshot` takes an `AssessmentOutput`, never a session/
 * workspace object — that is the type-level enforcement of canon test 10
 * ("Report renderuje się z snapshotu, nie z żywej sesji"). There is no
 * function anywhere in this package that accepts a `MethodSession` and
 * produces a `ReportSnapshot`; a reopened/edited session literally cannot
 * reach this function until it is frozen again into a NEW `AssessmentOutput`.
 *
 * ★ SCREENSHOT BAN: nothing here rasterizes anything. The report is a
 * semantic snapshot (structured fields), consistent with the artifact rule
 * "Raport i prezentacja renderują się z semantycznego snapshotu, nigdy z
 * obrazka."
 */

import { computePortableContentHash, sortByStableKey, sortStrings } from './contentHash';
import { deepFreeze } from './freeze';
import type {
  AssessmentOutput,
  ContentApprovalState,
  Finding,
  ReportGroupResult,
  ReportInitiativeCandidateRef,
  ReportSnapshot,
  ReportUnitResult,
} from './types';

export interface BuildReportSnapshotInput {
  readonly id: string;
  readonly executiveSummary: string;
  readonly participants: readonly string[];
  readonly strengths: readonly string[];
  readonly initiativeCandidates: readonly ReportInitiativeCandidateRef[];
  readonly appendices: readonly string[];
  readonly createdAt: string;
  /**
   * Mapa `unitId -> nazwa czytelna dla człowieka`.
   *
   * ★ Bez tego raport dla klienta pokazywał kody `1A`/`1B`. `finding.unitName`
   * NIE jest wiarygodnym źródłem nazwy — bywa ustawione dosłownie na `unitId`
   * (tak robi runtime demo), więc fallback „nazwa z findingu" po cichu degraduje
   * się do kodu. Nazwy dostarcza wywołujący, który zna strukturę swojej metody;
   * ten moduł pozostaje metodyko-agnostyczny. Brak nazwy => zostaje identyfikator.
   *
   * Ten sam mechanizm ma `buildPresentationBlocksFromOutput` — celowo
   * symetrycznie, żeby raport i prezentacja nie rozjechały się nazewnictwem.
   */
  readonly unitNames?: Readonly<Record<string, string>>;
}

function unitResultsFrom(
  output: AssessmentOutput,
  unitNames?: Readonly<Record<string, string>>
): ReportUnitResult[] {
  const unitIds = Object.keys(output.current);
  return sortStrings(unitIds).map((unitId) => ({
    unitId,
    unitName: unitNames?.[unitId] ?? findingByUnit(output.findings, unitId)?.unitName ?? unitId,
    current: output.current[unitId] ?? null,
    target: output.target[unitId] ?? null,
    gap: output.gap[unitId] ?? null,
  }));
}

function findingByUnit(findings: readonly Finding[], unitId: string): Finding | undefined {
  return findings.find((f) => f.unitId === unitId);
}

function groupResultsFrom(output: AssessmentOutput): ReportGroupResult[] {
  return sortStrings(Object.keys(output.aggregation.byGroup)).map((groupId) => ({
    groupId,
    groupName: groupId,
    aggregatedLevel: output.aggregation.byGroup[groupId] ?? null,
  }));
}

function overallResultFrom(output: AssessmentOutput): number | null {
  const values = Object.values(output.aggregation.byGroup).filter(
    (v): v is number => v !== null
  );
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Findings whose evidence/decision state is not yet `accepted`. Report and
 * presentation views must strip these unless explicitly requested as drafts. */
function approvalStateOf(finding: Finding): ContentApprovalState {
  if (finding.supportingEvidence.some((e) => e.strength === 'E0')) return 'needs_evidence';
  return 'accepted';
}

/** Build a Report strictly from a frozen AssessmentOutput. Deterministic and
 * immutable — same Output in, same ReportSnapshot content out. */
export function buildReportSnapshot(
  output: AssessmentOutput,
  input: BuildReportSnapshotInput
): ReportSnapshot {
  const acceptedFindings = output.findings.filter((f) => approvalStateOf(f) === 'accepted');

  const gapsAndRisks = acceptedFindings
    .filter((f) => f.gap !== null && f.gap > 0)
    .map((f) => f.riskOrOpportunity)
    .filter((s) => s.trim() !== '');

  const recommendations = acceptedFindings
    .map((f) => f.recommendation)
    .filter((s) => s.trim() !== '');

  const content = {
    outputId: output.id,
    outputVersion: output.version,
    executiveSummary: input.executiveSummary,
    scope: output.scope,
    methodology: output.methodology,
    participants: sortStrings(input.participants),
    limitations: sortStrings(output.limitations),
    overallResult: overallResultFrom(output),
    unitResults: unitResultsFrom(output, input.unitNames),
    groupResults: groupResultsFrom(output),
    current: output.current,
    target: output.target,
    gap: output.gap,
    evidenceQuality: output.evidenceCompleteness,
    strengths: sortStrings(input.strengths),
    gapsAndRisks: sortStrings(gapsAndRisks),
    recommendations: sortStrings(recommendations),
    initiativeCandidates: sortByStableKey(input.initiativeCandidates, 'draftId'),
    appendices: sortStrings(input.appendices),
    traceability: sortStrings(acceptedFindings.flatMap((f) => f.sourceLocators)),
  };

  const contentHash = computePortableContentHash(content);

  const report: ReportSnapshot = {
    id: input.id,
    organizationId: output.organizationId,
    ...content,
    createdAt: input.createdAt,
    contentHash,
  };

  return deepFreeze(report);
}

// ---------------------------------------------------------------------------
// Presentation View — strips the working layer.
// TOOL_SESSION_WORKSPACE_STANDARD.md §7A + ASSESSMENT_OUTPUT_AND_PROVENANCE
// ★ Presentation View usuwa warstwę roboczą (propozycje, komentarze, stany
//   robocze) — pokazuje wyłącznie treść zatwierdzoną.
// ---------------------------------------------------------------------------

export interface PresentationView {
  readonly outputId: string;
  readonly outputVersion: number;
  readonly acceptedFindings: readonly Finding[];
  /** Present ONLY when the caller explicitly asked for drafts — see
   * `buildPresentationView`'s `includeDrafts` option. Always tagged. */
  readonly draftFindings: readonly { readonly finding: Finding; readonly isDraft: true }[];
}

/**
 * Presentation-ready view of an Output: accepted findings only by default.
 * `includeDrafts: true` additionally returns proposed/needs-evidence
 * findings, but every one of them is wrapped with an explicit `isDraft: true`
 * tag — there is no way to get draft content into `acceptedFindings`.
 */
export function buildPresentationView(
  output: AssessmentOutput,
  options: { readonly includeDrafts?: boolean } = {}
): PresentationView {
  const accepted = output.findings.filter((f) => approvalStateOf(f) === 'accepted');
  const draft = options.includeDrafts
    ? output.findings
        .filter((f) => approvalStateOf(f) !== 'accepted')
        .map((finding) => ({ finding, isDraft: true as const }))
    : [];

  return deepFreeze({
    outputId: output.id,
    outputVersion: output.version,
    acceptedFindings: accepted,
    draftFindings: draft,
  });
}
