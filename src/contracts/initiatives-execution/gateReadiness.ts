import { type InitiativeCardKey, isInitiativeCardKey } from './cardRegistry';
import type { GateReadiness } from './foundation';

export type CardApplicability = 'REQUIRED' | 'OPTIONAL' | 'NOT_APPLICABLE';
export type CardCompletion = 'EMPTY' | 'IN_PROGRESS' | 'COMPLETE';
export type CardQuality = 'UNKNOWN' | 'SUFFICIENT' | 'WARNING' | 'BLOCKER';
export type CardFreshness = 'CURRENT' | 'STALE' | 'SOURCE_UNAVAILABLE';
export type CardReview = 'NOT_REQUESTED' | 'REQUESTED' | 'CHANGES_REQUESTED' | 'ACCEPTED';

export interface PublishedCardSnapshot {
  cardKey: InitiativeCardKey;
  version: number;
  applicability: CardApplicability;
  completion: CardCompletion;
  quality: CardQuality;
  freshness: CardFreshness;
  review: CardReview;
  evidenceRefs: readonly string[];
  fields: Readonly<Record<string, unknown>>;
  waiverDecisionId?: string | null;
}

export interface GateCardRequirement {
  cardKey: InitiativeCardKey;
  requiredFields: readonly string[];
  reviewRequired: boolean;
  allowAuthorizedWaiver: boolean;
}

export interface GateReadinessFinding {
  findingId: string;
  severity: 'BLOCKER' | 'WARNING';
  cardKey: InitiativeCardKey;
  rule: string;
  evidenceRefs: readonly string[];
  message: string;
}

export interface GateReadinessEvaluation {
  readiness: GateReadiness;
  evaluatedCardVersions: Readonly<Record<string, number>>;
  findings: readonly GateReadinessFinding[];
}

function hasValue(value: unknown): boolean {
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return value !== null && value !== undefined;
}

function finding(
  gateId: string,
  cardKey: InitiativeCardKey,
  severity: 'BLOCKER' | 'WARNING',
  rule: string,
  evidenceRefs: readonly string[],
  message: string
): GateReadinessFinding {
  return {
    findingId: `${gateId}:${cardKey}:${rule}`,
    severity,
    cardKey,
    rule,
    evidenceRefs,
    message,
  };
}

export function evaluateGateReadiness(
  gateId: string,
  requirements: readonly GateCardRequirement[],
  snapshots: readonly PublishedCardSnapshot[]
): GateReadinessEvaluation {
  if (!gateId.trim()) throw new Error('gateId is required');
  const byKey = new Map(snapshots.map((snapshot) => [snapshot.cardKey, snapshot]));
  const findings: GateReadinessFinding[] = [];
  const evaluatedCardVersions: Record<string, number> = {};

  for (const requirement of requirements) {
    if (!isInitiativeCardKey(requirement.cardKey)) {
      throw new Error(`Unknown Initiative card: ${String(requirement.cardKey)}`);
    }
    const snapshot = byKey.get(requirement.cardKey);
    if (!snapshot) {
      findings.push(
        finding(
          gateId,
          requirement.cardKey,
          'BLOCKER',
          'PUBLISHED_CARD_MISSING',
          [],
          'A required published card version is missing.'
        )
      );
      continue;
    }
    evaluatedCardVersions[snapshot.cardKey] = snapshot.version;
    if (snapshot.applicability === 'NOT_APPLICABLE') {
      if (requirement.allowAuthorizedWaiver && snapshot.waiverDecisionId?.trim()) continue;
      findings.push(
        finding(
          gateId,
          snapshot.cardKey,
          'BLOCKER',
          'REQUIRED_CARD_NOT_APPLICABLE',
          snapshot.evidenceRefs,
          'A required card cannot be omitted without an authorized waiver Decision.'
        )
      );
      continue;
    }
    if (snapshot.freshness === 'SOURCE_UNAVAILABLE') {
      findings.push(
        finding(
          gateId,
          snapshot.cardKey,
          'BLOCKER',
          'SOURCE_UNAVAILABLE',
          snapshot.evidenceRefs,
          'The authoritative source is unavailable.'
        )
      );
    } else if (snapshot.freshness === 'STALE') {
      findings.push(
        finding(
          gateId,
          snapshot.cardKey,
          'BLOCKER',
          'SOURCE_STALE',
          snapshot.evidenceRefs,
          'The published evidence is stale.'
        )
      );
    }
    if (snapshot.quality === 'BLOCKER' || snapshot.quality === 'UNKNOWN') {
      findings.push(
        finding(
          gateId,
          snapshot.cardKey,
          'BLOCKER',
          snapshot.quality === 'UNKNOWN' ? 'QUALITY_UNKNOWN' : 'QUALITY_BLOCKER',
          snapshot.evidenceRefs,
          snapshot.quality === 'UNKNOWN'
            ? 'Card quality is unknown.'
            : 'The card contains an unresolved quality blocker.'
        )
      );
    } else if (snapshot.quality === 'WARNING') {
      findings.push(
        finding(
          gateId,
          snapshot.cardKey,
          'WARNING',
          'QUALITY_WARNING',
          snapshot.evidenceRefs,
          'The card contains a quality warning requiring explicit review.'
        )
      );
    }
    if (snapshot.completion !== 'COMPLETE') {
      findings.push(
        finding(
          gateId,
          snapshot.cardKey,
          'BLOCKER',
          'CARD_INCOMPLETE',
          snapshot.evidenceRefs,
          'The required card is not complete.'
        )
      );
    }
    for (const field of requirement.requiredFields) {
      if (!hasValue(snapshot.fields[field])) {
        findings.push(
          finding(
            gateId,
            snapshot.cardKey,
            'BLOCKER',
            `FIELD_REQUIRED:${field}`,
            snapshot.evidenceRefs,
            `Required field ${field} is missing.`
          )
        );
      }
    }
    if (requirement.reviewRequired && snapshot.review !== 'ACCEPTED') {
      findings.push(
        finding(
          gateId,
          snapshot.cardKey,
          'BLOCKER',
          'REVIEW_NOT_ACCEPTED',
          snapshot.evidenceRefs,
          'The required independent card review is not accepted.'
        )
      );
    }
  }

  const blockers = findings.some((item) => item.severity === 'BLOCKER');
  const warnings = findings.some((item) => item.severity === 'WARNING');
  return {
    readiness: blockers ? 'NOT_READY' : warnings ? 'CONDITIONALLY_READY' : 'READY',
    evaluatedCardVersions,
    findings,
  };
}
