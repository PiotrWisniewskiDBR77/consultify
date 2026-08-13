import type { InitiativeCardVersionReadModel } from './postgresInitiativeReader.js';

export interface DefinitionReadinessFinding {
  findingId: string;
  cardKey: string;
  severity: 'BLOCKER' | 'WARNING';
  rule: string;
  evidenceRefs: string[];
  message: string;
}

export interface DefinitionReadinessResult {
  readiness: 'NOT_READY' | 'CONDITIONALLY_READY' | 'READY' | 'BLOCKED';
  cardVersions: Record<string, number>;
  findings: DefinitionReadinessFinding[];
}

const REQUIREMENTS = {
  'summary-scope': ['problem', 'outcome', 'inScope', 'outOfScope'],
  'strategic-fit': ['objectives', 'rationale'],
  'success-criteria': ['successCriteria', 'measurementPlan'],
  'outcomes-benefits': ['outcomes', 'benefits'],
  options: ['doNothing', 'alternatives'],
  'people-team': ['team', 'capacityAssumptions'],
  'roles-raci': ['accountableOwnerId', 'roles'],
  stakeholders: ['ownerId', 'sponsorId'],
} as const;

function hasValue(value: unknown): boolean {
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return value !== null && value !== undefined;
}

export function evaluateDefinitionReadiness(
  cards: readonly InitiativeCardVersionReadModel[],
  sourceLineageValid: boolean,
  sourceFreshness: 'CURRENT' | 'STALE' | 'SOURCE_UNAVAILABLE' = 'CURRENT'
): DefinitionReadinessResult {
  const byKey = new Map(cards.map((card) => [card.cardKey, card]));
  const findings: DefinitionReadinessFinding[] = [];
  const cardVersions: Record<string, number> = {};
  const add = (
    cardKey: string,
    severity: 'BLOCKER' | 'WARNING',
    rule: string,
    evidenceRefs: string[],
    message: string
  ) =>
    findings.push({
      findingId: `definition:${cardKey}:${rule}`,
      cardKey,
      severity,
      rule,
      evidenceRefs,
      message,
    });

  if (!sourceLineageValid) {
    add('summary-scope', 'BLOCKER', 'SOURCE_LINEAGE_INVALID', [], 'Source lineage is missing.');
  } else if (sourceFreshness === 'STALE') {
    add(
      'summary-scope',
      'BLOCKER',
      'SOURCE_SNAPSHOT_STALE',
      [],
      'The source object changed after the Initiative snapshot. Refresh and review affected cards.'
    );
  } else if (sourceFreshness === 'SOURCE_UNAVAILABLE') {
    add('summary-scope', 'BLOCKER', 'SOURCE_UNAVAILABLE', [], 'The source object is unavailable.');
  }
  for (const [cardKey, requiredFields] of Object.entries(REQUIREMENTS)) {
    const card = byKey.get(cardKey);
    if (!card) {
      add(cardKey, 'BLOCKER', 'PUBLISHED_CARD_MISSING', [], 'Published card version is missing.');
      continue;
    }
    cardVersions[cardKey] = card.cardVersion;
    if (card.freshness === 'SOURCE_UNAVAILABLE') {
      add(cardKey, 'BLOCKER', 'SOURCE_UNAVAILABLE', card.evidenceRefs, 'Source is unavailable.');
    } else if (card.freshness === 'STALE') {
      add(cardKey, 'BLOCKER', 'SOURCE_STALE', card.evidenceRefs, 'Evidence is stale.');
    }
    if (card.quality === 'BLOCKER' || card.quality === 'UNKNOWN') {
      add(
        cardKey,
        'BLOCKER',
        card.quality === 'UNKNOWN' ? 'QUALITY_UNKNOWN' : 'QUALITY_BLOCKER',
        card.evidenceRefs,
        card.quality === 'UNKNOWN' ? 'Quality is unknown.' : 'Quality blocker is unresolved.'
      );
    } else if (card.quality === 'WARNING') {
      add(cardKey, 'WARNING', 'QUALITY_WARNING', card.evidenceRefs, 'Quality warning is open.');
    }
    if (card.completion !== 'COMPLETE') {
      add(cardKey, 'BLOCKER', 'CARD_INCOMPLETE', card.evidenceRefs, 'Card is incomplete.');
    }
    for (const field of requiredFields) {
      if (!hasValue(card.content[field])) {
        add(
          cardKey,
          'BLOCKER',
          `FIELD_REQUIRED:${field}`,
          card.evidenceRefs,
          `Required field ${field} is missing.`
        );
      }
    }
    if (card.reviewState !== 'ACCEPTED') {
      add(
        cardKey,
        'BLOCKER',
        'REVIEW_NOT_ACCEPTED',
        card.evidenceRefs,
        'Independent card review is not accepted.'
      );
    }
    if (card.evidenceRefs.length === 0) {
      add(
        cardKey,
        'BLOCKER',
        'EVIDENCE_REQUIRED',
        [],
        'At least one governed evidence reference is required.'
      );
    }
  }
  const hardBlocked = findings.some((finding) =>
    [
      'SOURCE_LINEAGE_INVALID',
      'SOURCE_SNAPSHOT_STALE',
      'SOURCE_UNAVAILABLE',
      'QUALITY_BLOCKER',
    ].includes(finding.rule)
  );
  const blockers = findings.some((finding) => finding.severity === 'BLOCKER');
  const warnings = findings.some((finding) => finding.severity === 'WARNING');
  return {
    readiness: hardBlocked
      ? 'BLOCKED'
      : blockers
        ? 'NOT_READY'
        : warnings
          ? 'CONDITIONALLY_READY'
          : 'READY',
    cardVersions,
    findings,
  };
}
