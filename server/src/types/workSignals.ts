import type { SignalSeverity, SourceObjectType } from './executionVisibility.js';

export type { SignalSeverity, SourceObjectType } from './executionVisibility.js';

export const SignalDomainValues = [
  'EXECUTION',
  'DECISION',
  'RESULTS',
  'FINANCE',
  'ASSESSMENT',
  'MEETINGS',
  'MATERIALS',
  'GOVERNANCE',
] as const;
export type SignalDomain = (typeof SignalDomainValues)[number];

export const SignalOriginValues = ['DETERMINISTIC', 'AGGREGATED', 'INTERPRETED'] as const;
export type SignalOrigin = (typeof SignalOriginValues)[number];
export const SignalStatusValues = ['OPEN', 'RESOLVED', 'SUPERSEDED'] as const;
export type SignalStatus = (typeof SignalStatusValues)[number];
export const SignalResolvedReasonValues = [
  'CONDITION_CLEARED',
  'SUBJECT_DELETED',
  'SUPERSEDED',
  'EXPIRED',
  'USER_RESOLVED',
] as const;
export type SignalResolvedReason = (typeof SignalResolvedReasonValues)[number];

export interface SignalEvidence {
  ref: string;
  refType: SourceObjectType;
  version: string | number | null;
  observedValue: unknown;
  observedAt: string;
}

export interface SignalAction {
  kind: string;
  route: string;
  params: Record<string, unknown>;
  permission: string;
}

export interface SignalAudience {
  userId: string | null;
  role: string | null;
}

export interface SignalQuery {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
}

export interface RuleContext {
  organizationId: string;
  db: SignalQuery;
  now: Date;
}

export interface RuleHit {
  subjectId: string;
  projectId?: string | null;
  observedValue: unknown;
  observedAt: string;
  titleParams?: Record<string, unknown>;
  bodyParams?: Record<string, unknown>;
  data: Record<string, unknown>;
}

export interface SignalRule {
  ruleId: string;
  ruleVersion: number;
  domain: SignalDomain;
  signalType: string;
  severity: SignalSeverity | ((hit: RuleHit) => SignalSeverity);
  subjectType: SourceObjectType;
  titleKey: string;
  bodyKey?: string;
  evaluate(ctx: RuleContext): Promise<RuleHit[]>;
  dedupeKey(hit: RuleHit): string;
  evidence(hit: RuleHit): SignalEvidence[];
  action(hit: RuleHit): SignalAction;
  audience(hit: RuleHit): SignalAudience;
  maxPerRunPerOrg: number;
  minSeverityToSurface: SignalSeverity;
  ttlHours?: number;
}

export interface WorkSignalRow {
  signal_id: string;
  organization_id: string;
  dedupe_key: string;
  domain: SignalDomain;
  signal_type: string;
  origin: SignalOrigin;
  severity: SignalSeverity;
  subject_type: SourceObjectType;
  subject_id: string;
  project_id: string | null;
  audience_user_id: string | null;
  audience_role: string | null;
  title_key: string;
  title_params: Record<string, unknown>;
  body_key: string | null;
  body_params: Record<string, unknown>;
  evidence: SignalEvidence[];
  action: SignalAction;
  rule_id: string;
  rule_version: number;
  provenance: Record<string, unknown> | null;
  source_signal_ids: string[];
  status: SignalStatus;
  first_observed_at: string;
  last_observed_at: string;
  resolved_at: string | null;
  resolved_reason: SignalResolvedReason | null;
  expires_at: string | null;
  run_id: string;
  created_at: string;
  updated_at: string;
}

export interface SignalDTO {
  key: string;
  type: string;
  title: string;
  body: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  createdAt: string;
  projectId: string | null;
  projectName: string | null;
  entityType: string;
  entityId: string;
  domain: SignalDomain;
  origin: SignalOrigin;
  severityRaw: SignalSeverity;
  source: { evidence: SignalEvidence[]; ruleId: string; ruleVersion: number };
  freshness: { lastObservedAt: string; runAt: string; nextRunAt: string | null };
  destination: SignalAction & { allowed: boolean | null };
  provenance?: Record<string, unknown>;
  isMine: boolean;
  titleKey: string;
  titleParams: Record<string, unknown>;
  bodyKey: string | null;
  bodyParams: Record<string, unknown>;
  firstObservedAt: string;
  status: SignalStatus;
}
