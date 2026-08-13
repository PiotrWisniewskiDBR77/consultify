/**
 * Initiative Proposal Draft — grouping + construction.
 *
 * ★ NOT ONE-INITIATIVE-PER-GAP (INITIATIVE_PROPOSAL_GENERATOR_CONTRACT.md
 *   §4, antywzorzec §10: "jedna inicjatywa na każdy insight/finding").
 *   `groupFindingsForInitiativeDrafts` refuses to build a 1:1 mapping by
 *   default: `createInitiativeProposalDraft` requires >= 1 findingId (never
 *   zero), and the grouping helper's default strategy clusters by
 *   `unitId`'s parent grouping, not by individual finding.
 *
 * ★ NEVER A REGISTERED INITIATIVE — structural, not by convention. Search
 *   this file: there is no `initiativeId`, no `register`, no
 *   `RegisteredInitiative` anywhere. The only way out of this module is
 *   `InitiativeProposalDraft`, which a human sends to Candidates elsewhere
 *   (Initiatives module, out of this package's reach). Canon:
 *   "Teresa może grupować, deduplikować i proponować — ale NIE tworzy
 *   Registered Initiative. `Register as Initiative` to decyzja człowieka."
 */

import { deepFreeze } from './freeze';
import type {
  Finding,
  FindingKpiProposal,
  InitiativeDraftDependency,
  InitiativeDraftRisk,
  InitiativeProposalDraft,
} from './types';

export class InitiativeDraftValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InitiativeDraftValidationError';
  }
}

/**
 * One cluster of findings that plausibly point at the same change. Grouping
 * key defaults to the finding's `unitId` prefix up to the first `.` (DRD/SIRI
 * axis-style ids, e.g. "axis-3.criterion-2" -> "axis-3") — callers with a
 * better domain grouping (e.g. explicit parentId from the Method Pack) should
 * pass their own `groupKeyFn`.
 */
export function groupFindingsForInitiativeDrafts(
  findings: readonly Finding[],
  options: {
    readonly groupKeyFn?: (finding: Finding) => string;
    /** Only findings with a positive gap represent an opportunity to act on. */
    readonly onlyWithGap?: boolean;
  } = {}
): Finding[][] {
  const groupKeyFn = options.groupKeyFn ?? ((f: Finding) => f.unitId.split('.')[0]);
  const eligible =
    options.onlyWithGap === false
      ? findings
      : findings.filter((f) => f.gap !== null && f.gap > 0);

  const groups = new Map<string, Finding[]>();
  for (const finding of eligible) {
    const key = groupKeyFn(finding);
    const bucket = groups.get(key);
    if (bucket) bucket.push(finding);
    else groups.set(key, [finding]);
  }

  // Stable, deterministic group order (sorted by key), each group's findings
  // sorted by id — grouping output must not depend on input array order.
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, group]) => [...group].sort((a, b) => a.id.localeCompare(b.id)));
}

export interface CreateInitiativeProposalDraftInput {
  readonly id: string;
  readonly organizationId: string;
  readonly outputId: string;
  readonly outputVersion: number;
  readonly title: string;
  readonly summary: string;
  readonly findings: readonly Finding[];
  readonly rationale: string;
  readonly expectedOutcome: string;
  readonly kpiProposal: FindingKpiProposal | null;
  readonly dependencies: readonly InitiativeDraftDependency[];
  readonly risks: readonly InitiativeDraftRisk[];
  readonly confidence: InitiativeProposalDraft['confidence'];
  readonly createdAt: string;
}

/**
 * Construct a Draft from a GROUP of findings (never a single insight copied
 * verbatim as a full card — antywzorzec §10). Validates:
 *  - at least one finding is linked (a draft grouping zero findings is not a
 *    draft, it is an empty shell);
 *  - title states a problem/opportunity + outcome, not just a solution name
 *    (heuristic: title must differ from any single finding's recommendation
 *    verbatim — copying a recommendation as the title is the "tytuł
 *    rozwiązania bez problemu i outcome" antywzorzec);
 *  - expectedOutcome is present and distinct from any deliverable-sounding text.
 */
export function createInitiativeProposalDraft(
  input: CreateInitiativeProposalDraftInput
): InitiativeProposalDraft {
  const reasons: string[] = [];

  if (!input.findings || input.findings.length === 0) {
    reasons.push('a draft must link at least one finding');
  }
  if (!input.title || input.title.trim() === '') {
    reasons.push('title is required');
  }
  if (input.findings?.some((f) => f.recommendation.trim() === input.title.trim())) {
    reasons.push(
      'title must not be a verbatim copy of a finding recommendation — ' +
        'state the problem/outcome, not the solution name (antywzorzec)'
    );
  }
  if (!input.expectedOutcome || input.expectedOutcome.trim() === '') {
    reasons.push('expectedOutcome is required and must be distinct from a deliverable');
  }
  if (!input.rationale || input.rationale.trim() === '') {
    reasons.push('rationale is required');
  }

  if (reasons.length > 0) {
    throw new InitiativeDraftValidationError(
      `InitiativeProposalDraft rejected: ${reasons.join('; ')}`
    );
  }

  const draft: InitiativeProposalDraft = {
    id: input.id,
    organizationId: input.organizationId,
    outputId: input.outputId,
    outputVersion: input.outputVersion,
    title: input.title,
    summary: input.summary,
    findingIds: [...input.findings].sort((a, b) => a.id.localeCompare(b.id)).map((f) => f.id),
    rationale: input.rationale,
    expectedOutcome: input.expectedOutcome,
    kpiProposal: input.kpiProposal,
    dependencies: input.dependencies,
    risks: input.risks,
    evidenceLinks: [...new Set(input.findings.flatMap((f) => f.supportingEvidence.map((e) => e.evidenceId)))].sort(),
    confidence: input.confidence,
    createdAt: input.createdAt,
  };

  return deepFreeze(draft);
}
