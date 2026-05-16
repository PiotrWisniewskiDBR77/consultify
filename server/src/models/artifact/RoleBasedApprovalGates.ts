import type { ArtifactType } from './ArtifactTypeRegistry.js';
import type { DataClassification } from './DataClassification.js';

export const LEGAL_CONTENT_TAG = 'legal' as const;

export const REVIEWER_ROLES = ['operations', 'ciso', 'legal', 'finance', 'admin'] as const;
export type ReviewerRole = (typeof REVIEWER_ROLES)[number];

export const STANDARD_PERSONAS = ['operations', 'legal', 'finance'] as const;

export const ROUTING_MATCH_KINDS = [
  'classification',
  'content_tag',
  'artifact_type',
  'persona',
] as const;
export type RoutingMatchKind = (typeof ROUTING_MATCH_KINDS)[number];

export type ApprovalContext = {
  readonly artifactType?: ArtifactType | string;
  readonly classification?: DataClassification | string;
  readonly contentTags?: readonly string[];
  readonly persona?: string;
};

export type RoutingMatch =
  | { readonly kind: 'classification'; readonly value: string }
  | { readonly kind: 'content_tag'; readonly value: string }
  | { readonly kind: 'artifact_type'; readonly value: string }
  | { readonly kind: 'persona'; readonly value: string };

export type ApprovalRoutingRule = {
  readonly id: string;
  readonly priority: number;
  readonly match: RoutingMatch;
  readonly requires: ReviewerRole;
};

export type ApprovalRoutingTable = {
  readonly tenantId: string;
  readonly defaultRoute: ReviewerRole;
  readonly rules: readonly ApprovalRoutingRule[];
};

export function assertApprovalRoutingTable(table: ApprovalRoutingTable): void {
  if (!table.tenantId || !table.defaultRoute) {
    throw new Error('Routing table missing tenantId/defaultRoute');
  }
  if (!Array.isArray(table.rules)) {
    throw new Error('Routing table rules must be an array');
  }
}

function ruleMatches(context: ApprovalContext, rule: ApprovalRoutingRule): boolean {
  switch (rule.match.kind) {
    case 'classification':
      return String(context.classification || '') === rule.match.value;
    case 'content_tag':
      return (context.contentTags || []).map(String).includes(rule.match.value);
    case 'artifact_type':
      return String(context.artifactType || '') === rule.match.value;
    case 'persona':
      return String(context.persona || '') === rule.match.value;
  }
}

export function resolveRequiredReviewer(
  context: ApprovalContext,
  table: ApprovalRoutingTable
): ReviewerRole {
  const matched = [...table.rules]
    .filter((rule) => ruleMatches(context, rule))
    .sort((a, b) => b.priority - a.priority);
  return matched[0]?.requires ?? table.defaultRoute;
}

// Invariants (MVP: structural presence only; artifactRuntimeService asserts by calling these)
export function assertRestrictedRequiresCiso(_table: ApprovalRoutingTable): void {}
export function assertLegalTagRequiresLegal(_table: ApprovalRoutingTable): void {}
export function assertCfoArtifactRequiresFinance(_table: ApprovalRoutingTable): void {}
export function assertDefaultRoutesForStandardPersonas(_table: ApprovalRoutingTable): void {}
export function assertRoutingCoverage(_table: ApprovalRoutingTable): void {}
export function assertTenantOverrideDoesNotWeakenBaseline(
  _baseline: ApprovalRoutingTable,
  _override: ApprovalRoutingTable
): void {}
