/**
 * Risk & Uncertainty → Initiative RAID handoff.
 *
 * The Risk tool is NOT a silo. Its identified risks and assumptions are the
 * same objects a delivery team tracks in an initiative's RAID log. This module
 * converts accepted tool output into initiative RAID items (the RaidCanvas
 * shape used by Initiatives/sections/RaidSection.tsx) WITH a source
 * back-reference to the tool session — mirroring the canonical Tool→Initiative
 * provenance contract (src/types/domain/traceability.ts, SourceType).
 *
 * Provenance model (aligned with TraceabilityMetadata):
 *   - sourceType : 'tool_session'  (canonical repo SourceType for a tool)
 *   - sourceId   : the risk-uncertainty session id
 *   - each RAID item also carries a human-readable `source` string so the
 *     back-reference survives even in the flat RaidCanvas RaidItem.
 *
 * Mapping:
 *   RiskItem       → RaidItem { type: 'risk',       probability, impact, mitigation, ... }
 *   RiskAssumption → RaidItem { type: 'assumption', impact (from fragility), proposedAction, ... }
 *
 * Numeric 1..5 tool scales are collapsed to the RaidCanvas 4-band RaidLevel
 * (low/medium/high/critical) so the initiative UI renders them natively.
 */

import type {
  RaidItem,
  RaidLevel,
  RiskResponseStrategy,
} from '@/components/shared/NModeSections/RaidCanvas';
import type { RiskAssumption, RiskItem, RiskUncertaintyData } from '@/store/useToolStore';
import type { SourceType, TraceabilityMetadata } from '@/types/domain/traceability';

import { rankRisks } from './moveValidator';

/** Canonical source type for a tool session (see traceability.ts). */
export const RISK_RAID_SOURCE_TYPE: SourceType = 'tool_session';

/** Collapse a 1..5 tool score into the RaidCanvas 4-band level. */
export const scoreToRaidLevel = (score: number): RaidLevel => {
  if (score >= 5) return 'critical';
  if (score >= 4) return 'high';
  if (score >= 2) return 'medium';
  return 'low';
};

const isAccepted = (item: { proposalStatus?: string }): boolean =>
  item.proposalStatus !== 'rejected' && item.proposalStatus !== 'rethinking';

/** A RAID item enriched with the provenance metadata that ties it to its origin. */
export interface RaidItemWithProvenance {
  item: RaidItem;
  provenance: TraceabilityMetadata;
}

export interface RaidHandoffOptions {
  /** The risk-uncertainty session id (becomes sourceId). */
  sessionId: string;
  /** Human-readable session title (e.g. the mission goal). */
  sessionTitle?: string;
  /** User id creating the handoff (for TraceabilityMetadata.createdBy). */
  createdBy?: string;
  /** ISO timestamp; defaults to now. */
  createdAt?: string;
  /** Only include accepted (non-rejected / non-rethinking) items. Default true. */
  acceptedOnly?: boolean;
}

/** Build the human-readable back-reference string carried on each RaidItem.source. */
export const buildRaidSourceRef = (sessionId: string, sessionTitle?: string): string =>
  `${RISK_RAID_SOURCE_TYPE}:${sessionId}${sessionTitle ? ` (${sessionTitle})` : ''}`;

const makeProvenance = (opts: RaidHandoffOptions): TraceabilityMetadata => ({
  sourceType: RISK_RAID_SOURCE_TYPE,
  sourceId: opts.sessionId,
  sourceTitle: opts.sessionTitle,
  createdBy: opts.createdBy || 'risk-uncertainty-tool',
  createdAt: opts.createdAt || new Date().toISOString(),
});

const riskToRaidItem = (risk: RiskItem, sourceRef: string): RaidItem => {
  const probability = scoreToRaidLevel(risk.probability ?? 3);
  const impact = scoreToRaidLevel(risk.impact ?? 3);
  // A risk with a stated response strategy defaults to 'mitigate' when a plan exists.
  const responseStrategy: RiskResponseStrategy | undefined = risk.mitigation?.trim()
    ? 'mitigate'
    : undefined;
  return {
    id: `raid-risk-${risk.id}`,
    type: 'risk',
    title: risk.title || risk.description || 'Risk',
    description: risk.description || '',
    probability,
    impact,
    mitigation: risk.mitigation || '',
    proposedAction: risk.trigger ? `Watch trigger: ${risk.trigger}` : '',
    status: 'open',
    responseStrategy,
    owner: risk.owner || '',
    source: sourceRef,
    createdAt: new Date().toISOString(),
  };
};

const assumptionToRaidItem = (
  assumption: RiskAssumption,
  fragility: number,
  sourceRef: string
): RaidItem => ({
  id: `raid-assumption-${assumption.id}`,
  type: 'assumption',
  title: assumption.text || 'Assumption',
  description: assumption.consequenceIfWrong ? `If wrong: ${assumption.consequenceIfWrong}` : '',
  // Fragility (1..5) drives the impact band — a shaky, high-consequence
  // assumption reads as a high-impact RAID line.
  impact: scoreToRaidLevel(fragility),
  proposedAction: assumption.validationMethod ? `Validate: ${assumption.validationMethod}` : '',
  status: 'open',
  source: sourceRef,
  createdAt: new Date().toISOString(),
});

/**
 * Convert a Risk & Uncertainty session into initiative RAID items with source
 * provenance. Risks → RAID risks; assumptions → RAID assumptions. Scenarios are
 * intentionally NOT mapped (they are analysis context, not trackable log lines).
 *
 * Pure and deterministic — the caller persists the items against an initiative
 * via the RAID API using `provenance.sourceType` + `provenance.sourceId`.
 */
export function toInitiativeRaidItems(
  data: RiskUncertaintyData,
  opts: RaidHandoffOptions
): RaidItemWithProvenance[] {
  const acceptedOnly = opts.acceptedOnly !== false;
  const sourceRef = buildRaidSourceRef(opts.sessionId, opts.sessionTitle);
  const provenance = makeProvenance(opts);

  // Reuse the engine's fragility scoring so assumption severity is consistent
  // with the tool's own ranking rather than recomputed differently here.
  const ranking = rankRisks(data);
  const fragilityById = new Map(ranking.assumptions.map((a) => [a.id, a.fragility]));

  const risks = (data.risks || [])
    .filter((r) => (acceptedOnly ? isAccepted(r) : true))
    .map((r) => ({ item: riskToRaidItem(r, sourceRef), provenance }));

  const assumptions = (data.assumptions || [])
    .filter((a) => (acceptedOnly ? isAccepted(a) : true))
    .map((a) => ({
      item: assumptionToRaidItem(a, fragilityById.get(a.id) ?? 6 - (a.confidence ?? 3), sourceRef),
      provenance,
    }));

  return [...risks, ...assumptions];
}
