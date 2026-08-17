import { createHash } from 'node:crypto';

import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import { hasColumn } from '../../utils/dbSchema.js';
import logger from '../../utils/Logger.js';
import { listFindings as listP10Findings } from '../v8/interviewInsightFindingsService.js';

export const ORGANIZATION_CONTEXT_SCHEMA_VERSION = 1;

// ── ORG-BVP-001 / ORG-OPS-001 (Lane C closure) ──────────────────────────────
// Governed snapshot spine: claim -> human approval -> immutable, versioned,
// hash-bound snapshot. Schema version for the payload `computeContentHash`
// hashes over — bump only if the hashed shape changes.
export const GOVERNED_SNAPSHOT_SCHEMA_VERSION = 1;

export const ORGANIZATION_CONTEXT_CLAIM_PATHS = [
  'profile.companyName',
  'profile.description',
  'profile.industry',
  'profile.industryCode',
  'profile.industrySubsector',
  'profile.companySize',
  'profile.location',
  'profile.employeeCount',
  'profile.annualRevenue',
  'profile.website',
  'profile.defaultLanguage',
  'profile.defaultTimezone',
  'profile.currency',
  'profile.linkedinUrl',
  'profile.twitterUrl',
  'profile.customDomain',
  'profile.brandColor',
  'profile.accentColor',
  'strategic.goals',
  'strategic.priorities',
  'strategic.mission',
  'strategic.vision',
  'strategic.competitivePosition',
  'strategic.growthStage',
  'strategic.riskAppetite',
  'operations.keyMetrics',
  'operations.constraints',
  'operations.gaps',
  'operations.interviewAnswers',
  'systems.stack',
  'systems.cloudAdoption',
  'systems.integrations',
  'stakeholders.people',
  'notes.manualContext',
  'metadata.custom',
  'evidence.interview',
  'evidence.documentExtraction',
  'signals.interviewInsights',
  'signals.interviewFindings',
  'tools.sessionOutput',
  'myWork.idea',
  'chat.explicitContext',
  'integrations.signal',
  'profile.organizationType',
  'profile.revenueModel',
  'profile.foundingYear',
  'operations.deliveryModel',
  'operations.productionArchetype',
  'operations.shiftPattern',
  'operations.automationLevel',
  'systems.coreSystems',
  'profile.communicationStyle',
  'profile.industryJargonLevel',
  'finance.statements',
  'finance.models',
  'finance.laneStatus',
  'finance.versionStatus',
] as const;

export type OrganizationContextClaimPath = (typeof ORGANIZATION_CONTEXT_CLAIM_PATHS)[number];

export interface ContextClaimInput {
  claimPath: OrganizationContextClaimPath;
  value: unknown;
  confidence?: number;
  claimType?: string;
  reviewStatus?: string;
}

export interface ContextSourceRecordInput {
  organizationId: string;
  sourceType: string;
  sourceId?: string | null;
  authorUserId?: string | null;
  channel?: string;
  sourceLabel?: string | null;
  content: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  isExplicit?: boolean;
  visibilityScope?: string;
  claims?: ContextClaimInput[];
  rebuildSnapshot?: boolean;
}

export interface OrganizationContextTimelineItem {
  id: string;
  sourceType: string;
  sourceId: string | null;
  sourceLabel: string | null;
  channel: string;
  isExplicit: boolean;
  createdAt: string;
  authorUserId: string | null;
  summary: string;
}

export interface OrganizationContextConflict {
  claimPath: string;
  values: unknown[];
  sourceTypes: string[];
}

export interface ResolvedOrganizationContext {
  organizationId: string;
  schemaVersion: number;
  snapshotUpdatedAt: string | null;
  counts: {
    items: number;
    claims: number;
    conflicts: number;
  };
  profile: {
    companyName: string | null;
    description: string | null;
    industry: string | null;
    industryCode: string | null;
    industrySubsector: string | null;
    companySize: string | null;
    location: string | null;
    employeeCount: number | null;
    annualRevenue: string | null;
    website: string | null;
    defaultLanguage: string | null;
    defaultTimezone: string | null;
    currency: string | null;
    linkedinUrl: string | null;
    twitterUrl: string | null;
    customDomain: string | null;
    brandColor: string | null;
    accentColor: string | null;
    organizationType: string | null;
    revenueModel: string | null;
    foundingYear: number | null;
    communicationStyle: string | null;
    industryJargonLevel: string | null;
  };
  strategic: {
    goals: string[];
    priorities: string[];
    mission: string | null;
    vision: string | null;
    competitivePosition: string | null;
    growthStage: string | null;
    riskAppetite: string | null;
  };
  operations: {
    keyMetrics: Array<Record<string, unknown>>;
    constraints: string[];
    gaps: Array<Record<string, unknown>>;
    interviewAnswers: Array<Record<string, unknown>>;
    deliveryModel: string | null;
    productionArchetype: string | null;
    shiftPattern: string | null;
    automationLevel: string | null;
  };
  systems: {
    stack: string[];
    cloudAdoption: string | null;
    integrations: string[];
    coreSystems: string[];
  };
  stakeholders: Array<Record<string, unknown>>;
  notes: {
    manualContext: Array<Record<string, unknown>>;
  };
  metadata: {
    custom: Array<Record<string, unknown>>;
  };
  evidence: Array<Record<string, unknown>>;
  signals: {
    interviewInsights: string[];
    interviewFindings: Array<{
      findingStatement: string;
      confidenceLevel: string;
      limits: string;
      nextAction: string;
      evidenceCount: number;
      insightId: string;
    }>;
  };
  trust: {
    mfa: {
      required: boolean;
      gracePeriodDays: number;
      managedBy: 'admin';
    };
    sso: {
      configured: boolean;
      provider: string | null;
      enforced: boolean;
      allowPasswordLogin: boolean;
      active: boolean;
      managedBy: 'admin';
    };
    security: {
      passwordPolicy: string;
      sessionTimeout: number;
      ipWhitelist: boolean;
      managedBy: 'admin';
    };
  };
  conflicts: OrganizationContextConflict[];
  timeline: OrganizationContextTimelineItem[];
  finance: {
    statementCount: number;
    modelCount: number;
    activeLaneRunId: string | null;
    activeLaneStep: string | null;
    latestVersionType: string | null;
    degradedCount: number;
  };
}

type ClaimRow = {
  id: string;
  item_id: string;
  claim_path: string;
  value_json: string;
  confidence: number;
  claim_type: string;
  review_status: string;
  created_at: string;
  source_type: string;
  source_label: string | null;
  item_created_at: string;
  is_explicit: number | boolean;
};

const CLAIM_PATH_SET = new Set<string>(ORGANIZATION_CONTEXT_CLAIM_PATHS);

function safeParseJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value !== 'string') return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function uniqStrings(values: Array<string | null | undefined>): string[] {
  return [
    ...new Set(
      values.map((value) => (typeof value === 'string' ? value.trim() : '')).filter(Boolean)
    ),
  ];
}

function normalizeArrayOfStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return uniqStrings(value.map((entry) => (typeof entry === 'string' ? entry : null)));
}

function valueToJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function readValue(row: ClaimRow): unknown {
  return safeParseJson(row.value_json, row.value_json);
}

function isKnownClaimPath(path: string): path is OrganizationContextClaimPath {
  return CLAIM_PATH_SET.has(path);
}

async function safeGet<T = any>(sql: string, params: unknown[]): Promise<T | null> {
  try {
    return ((await dbGet(sql, params)) as T | null) || null;
  } catch {
    return null;
  }
}

async function safeAll<T = any>(sql: string, params: unknown[]): Promise<T[]> {
  try {
    return ((await dbAll(sql, params)) as T[]) || [];
  } catch {
    return [];
  }
}

async function getClaimQueryShape(): Promise<{
  claimTypeSql: string;
  reviewStatusSql: string;
  sourceLabelSql: string;
  isExplicitSql: string;
  activeWhereSql: string;
}> {
  const [hasClaimType, hasReviewStatus, hasSourceLabel, hasIsExplicit, hasStatus] =
    await Promise.all([
      hasColumn('organization_context_claims', 'claim_type').catch(() => false),
      hasColumn('organization_context_claims', 'review_status').catch(() => false),
      hasColumn('organization_context_items', 'source_label').catch(() => false),
      hasColumn('organization_context_items', 'is_explicit').catch(() => false),
      hasColumn('organization_context_claims', 'status').catch(() => false),
    ]);

  return {
    claimTypeSql: hasClaimType ? 'c.claim_type' : `'fact' as claim_type`,
    reviewStatusSql: hasReviewStatus ? 'c.review_status' : `'accepted' as review_status`,
    sourceLabelSql: hasSourceLabel ? 'i.source_label' : `NULL as source_label`,
    isExplicitSql: hasIsExplicit ? 'i.is_explicit' : '1 as is_explicit',
    activeWhereSql: hasStatus ? ` AND c.status = 'active'` : '',
  };
}

function pickBestClaim(
  claimRows: ClaimRow[],
  path: OrganizationContextClaimPath
): { value: unknown; row: ClaimRow } | null {
  const rows = claimRows
    .filter((row) => row.claim_path === path)
    .sort((left, right) => {
      const explicitDelta = Number(right.is_explicit ? 1 : 0) - Number(left.is_explicit ? 1 : 0);
      if (explicitDelta !== 0) return explicitDelta;
      const confidenceDelta = Number(right.confidence || 0) - Number(left.confidence || 0);
      if (confidenceDelta !== 0) return confidenceDelta;
      return String(right.created_at || '').localeCompare(String(left.created_at || ''));
    });
  if (!rows.length) return null;
  return { value: readValue(rows[0]), row: rows[0] };
}

function collectClaimValues(
  claimRows: ClaimRow[],
  path: OrganizationContextClaimPath
): Array<{ value: unknown; row: ClaimRow }> {
  return claimRows
    .filter((row) => row.claim_path === path)
    .map((row) => ({ value: readValue(row), row }));
}

function buildTimelineSummary(
  sourceType: string,
  sourceLabel: string | null,
  content: Record<string, unknown>
): string {
  if (sourceLabel) return sourceLabel;

  if (sourceType === 'organization_profile') {
    const industry = asString(content.industry) || asString(content.industry_code);
    return industry ? `Profile updated: ${industry}` : 'Organization profile updated';
  }
  if (sourceType === 'interview_context') return 'Interview company facts updated';
  if (sourceType === 'interview_answer') {
    return asString(content.questionText) || 'Interview answer recorded';
  }
  if (sourceType === 'interview_evidence') {
    return asString(content.title) || 'Interview evidence added';
  }
  if (sourceType === 'organization_metadata') {
    return asString(content.key) ? `Metadata updated: ${String(content.key)}` : 'Metadata updated';
  }
  if (sourceType === 'ai_context') {
    return asString(content.name) || 'Manual AI context saved';
  }
  if (sourceType === 'tool_session') {
    return asString(content.name) || 'Tool session context updated';
  }
  if (sourceType === 'my_work_idea') {
    return asString(content.title) || 'My Work idea added to context';
  }
  if (sourceType === 'chat_message') return 'Chat message captured as organization context';
  return sourceType.replace(/_/g, ' ');
}

function mergeUniqueObjects(
  current: Array<Record<string, unknown>>,
  next: Array<Record<string, unknown>>
): Array<Record<string, unknown>> {
  const seen = new Set<string>();
  const merged: Array<Record<string, unknown>> = [];
  for (const entry of [...current, ...next]) {
    const key = JSON.stringify(entry || {});
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(entry);
  }
  return merged;
}

function buildConflicts(claimRows: ClaimRow[]): OrganizationContextConflict[] {
  const grouped = new Map<
    string,
    Array<{ valueKey: string; value: unknown; sourceType: string }>
  >();
  for (const row of claimRows) {
    const value = readValue(row);
    const valueKey = JSON.stringify(value ?? null);
    const bucket = grouped.get(row.claim_path) || [];
    bucket.push({ valueKey, value, sourceType: row.source_type });
    grouped.set(row.claim_path, bucket);
  }

  const conflicts: OrganizationContextConflict[] = [];
  for (const [claimPath, entries] of grouped.entries()) {
    const uniqueValues = new Map<string, { value: unknown; sourceTypes: Set<string> }>();
    for (const entry of entries) {
      const existing = uniqueValues.get(entry.valueKey) || {
        value: entry.value,
        sourceTypes: new Set<string>(),
      };
      existing.sourceTypes.add(entry.sourceType);
      uniqueValues.set(entry.valueKey, existing);
    }
    if (uniqueValues.size <= 1) continue;
    conflicts.push({
      claimPath,
      values: [...uniqueValues.values()].map((entry) => entry.value),
      sourceTypes: uniqStrings(
        [...uniqueValues.values()].flatMap((entry) => [...entry.sourceTypes.values()])
      ),
    });
  }
  return conflicts;
}

function buildOrganizationProfileClaims(input: Record<string, unknown>): ContextClaimInput[] {
  const claims: ContextClaimInput[] = [];
  const add = (claimPath: OrganizationContextClaimPath, value: unknown, confidence = 1) => {
    if (
      value === undefined ||
      value === null ||
      value === '' ||
      (Array.isArray(value) && value.length === 0)
    ) {
      return;
    }
    claims.push({ claimPath, value, confidence });
  };

  add('profile.description', asString(input.description));
  add('profile.industry', asString(input.industry));
  add('profile.industryCode', asString(input.industry_code));
  add('profile.industrySubsector', asString(input.industry_subsector));
  add('profile.companySize', asString(input.companySize) || asString(input.company_size));
  add('profile.website', asString(input.website));
  add(
    'profile.defaultLanguage',
    asString(input.defaultLanguage) || asString(input.preferred_language)
  );
  add('profile.defaultTimezone', asString(input.defaultTimezone));
  add('profile.currency', asString(input.currency));
  add('profile.linkedinUrl', asString(input.linkedinUrl));
  add('profile.twitterUrl', asString(input.twitterUrl));
  add('profile.customDomain', asString(input.customDomain));
  add('profile.brandColor', asString(input.brandColor));
  add('profile.accentColor', asString(input.accentColor));
  add('profile.employeeCount', asNumber(input.employee_count));
  add('profile.annualRevenue', asNumber(input.annual_revenue) ?? asString(input.annualRevenue));
  add('profile.location', asString(input.headquarters_country));
  add('strategic.goals', input.strategic_priorities);
  add('strategic.priorities', input.strategic_priorities);
  add('strategic.mission', asString(input.mission_statement));
  add('strategic.vision', asString(input.vision_statement));
  add('strategic.competitivePosition', asString(input.competitive_position));
  add('strategic.growthStage', asString(input.growth_stage));
  add('strategic.riskAppetite', asString(input.risk_appetite));
  add('systems.stack', input.technology_stack);
  add('systems.cloudAdoption', asString(input.cloud_adoption_level));
  add('profile.organizationType', asString(input.organization_type));
  add('profile.revenueModel', asString(input.revenue_model));
  add('profile.foundingYear', asNumber(input.founding_year));
  add('operations.deliveryModel', asString(input.delivery_model));
  add('operations.productionArchetype', asString(input.production_archetype));
  add('operations.shiftPattern', asString(input.shift_pattern));
  add('operations.automationLevel', asString(input.automation_level));
  add('systems.coreSystems', input.core_systems);
  add('profile.communicationStyle', asString(input.communication_style));
  add('profile.industryJargonLevel', asString(input.industry_jargon_level));
  return claims;
}

function buildInterviewContextClaims(input: Record<string, unknown>): ContextClaimInput[] {
  const claims: ContextClaimInput[] = [];
  const add = (claimPath: OrganizationContextClaimPath, value: unknown, confidence = 1) => {
    if (
      value === undefined ||
      value === null ||
      value === '' ||
      (Array.isArray(value) && value.length === 0)
    ) {
      return;
    }
    claims.push({ claimPath, value, confidence });
  };

  add('profile.companyName', asString(input.companyName));
  add('profile.industry', asString(input.industry));
  add('profile.companySize', asString(input.companySize));
  add('profile.location', asString(input.location));
  add('profile.employeeCount', asNumber(input.employeeCount));
  add('profile.annualRevenue', asString(input.annualRevenue));
  add('operations.keyMetrics', input.keyMetrics);
  add('stakeholders.people', input.stakeholders);
  add('operations.gaps', input.openGaps);
  return claims;
}

function buildInterviewAnswerClaims(input: Record<string, unknown>): ContextClaimInput[] {
  const answer = asString(input.answerText);
  const contextNote = asString(input.contextNote);
  const payload = {
    category: asString(input.category),
    questionId: asString(input.questionId),
    sessionId: asString(input.sessionId),
    questionText: asString(input.questionText),
    answer,
    contextNote,
    tags: Array.isArray(input.tags) ? input.tags : [],
  };
  const claims: ContextClaimInput[] = [];
  if (answer)
    claims.push({ claimPath: 'operations.interviewAnswers', value: payload, confidence: 0.85 });
  if (contextNote) {
    claims.push({ claimPath: 'notes.manualContext', value: payload, confidence: 0.8 });
  }
  if (Array.isArray(input.tags) && input.tags.includes('constraint') && answer) {
    claims.push({ claimPath: 'operations.constraints', value: [answer], confidence: 0.75 });
  }
  return claims;
}

function buildInterviewEvidenceClaims(input: Record<string, unknown>): ContextClaimInput[] {
  const title = asString(input.title);
  const snippet =
    asString(input.transcriptText) || asString(input.description) || asString(input.url) || title;
  if (!snippet) return [];
  return [
    {
      claimPath: 'evidence.interview',
      value: {
        evidenceId: asString(input.evidenceId),
        sessionId: asString(input.sessionId),
        questionId: asString(input.questionId),
        title,
        evidenceType: asString(input.evidenceType),
        snippet,
        category: asString(input.category),
      },
      confidence: 0.9,
    },
  ];
}

function buildDocumentExtractionClaims(input: Record<string, unknown>): ContextClaimInput[] {
  const filename = asString(input.filename) || asString(input.title);
  const snippet = asString(input.snippet) || asString(input.extractedText);
  if (!filename && !snippet) return [];
  return [
    {
      claimPath: 'evidence.documentExtraction',
      value: {
        docId: asString(input.docId),
        filename,
        mimeType: asString(input.mimeType),
        snippet,
        totalChunks: asNumber(input.totalChunks),
        embeddedChunks: asNumber(input.embeddedChunks),
      },
      confidence: 0.85,
    },
  ];
}

function buildMetadataClaims(input: Record<string, unknown>): ContextClaimInput[] {
  const key = asString(input.key);
  const value = input.value;
  if (!key || value === undefined || value === null || value === '') return [];
  return [
    {
      claimPath: 'metadata.custom',
      value: {
        key,
        value,
        valueType: asString(input.valueType),
        category: asString(input.category),
        isSensitive: Boolean(input.isSensitive),
      },
      confidence: 1,
    },
  ];
}

function buildManualContextClaims(input: Record<string, unknown>): ContextClaimInput[] {
  const content = asString(input.content);
  if (!content) return [];
  return [
    {
      claimPath: 'notes.manualContext',
      value: {
        name: asString(input.name),
        type: asString(input.type),
        content,
        priority: asNumber(input.priority),
      },
      confidence: 0.9,
    },
  ];
}

function buildToolSessionClaims(input: Record<string, unknown>): ContextClaimInput[] {
  const name = asString(input.name);
  const answers = input.answers;
  const contextSnapshot = input.contextSnapshot;
  const claims: ContextClaimInput[] = [];
  if (
    answers &&
    typeof answers === 'object' &&
    Object.keys(answers as Record<string, unknown>).length > 0
  ) {
    claims.push({
      claimPath: 'tools.sessionOutput',
      value: {
        toolId: asString(input.toolId),
        toolType: asString(input.toolType),
        name,
        answers,
      },
      confidence: 0.7,
    });
  }
  if (contextSnapshot && typeof contextSnapshot === 'object') {
    claims.push({
      claimPath: 'tools.sessionOutput',
      value: {
        toolId: asString(input.toolId),
        toolType: asString(input.toolType),
        name,
        contextSnapshot,
      },
      confidence: 0.65,
    });
  }
  return claims;
}

function buildIdeaClaims(input: Record<string, unknown>): ContextClaimInput[] {
  const title = asString(input.title);
  const body = asString(input.body);
  if (!title && !body) return [];
  return [
    {
      claimPath: 'myWork.idea',
      value: {
        ideaId: asString(input.ideaId),
        title,
        body,
        tags: Array.isArray(input.tags) ? input.tags : [],
      },
      confidence: 0.6,
    },
  ];
}

function buildChatClaims(input: Record<string, unknown>): ContextClaimInput[] {
  const content = asString(input.content);
  if (!content) return [];
  return [
    {
      claimPath: 'chat.explicitContext',
      value: {
        conversationId: asString(input.conversationId),
        messageId: asString(input.messageId),
        role: asString(input.role),
        content,
      },
      confidence: 0.85,
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────
// ORG-BVP-001 / ORG-OPS-001 — governed snapshot spine types + pure helpers
// ─────────────────────────────────────────────────────────────────────────

export type ClaimReviewState = 'pending' | 'approved' | 'rejected';
/**
 * How a claim came to be considered "approved":
 *  - 'explicit_review'   an actual row exists in
 *                        `organization_context_claim_reviews` recording a
 *                        human decision.
 *  - 'legacy_auto_accept' no review row exists; the claim's own (pre-
 *                        governance) `review_status` column reads
 *                        'accepted'. This is the backward-compatibility path
 *                        for rows written before this governance layer
 *                        existed — see the comment on the `review_status`
 *                        parameter in `recordContextSource` above.
 */
export type ClaimApprovalSource = 'explicit_review' | 'legacy_auto_accept';

export interface GovernedClaimView {
  claimId: string;
  itemId: string;
  claimPath: string;
  value: unknown;
  confidence: number;
  sourceType: string;
  visibilityScope: string;
  legacyReviewStatus: string;
  reviewState: ClaimReviewState;
  approved: boolean;
  approvalSource: ClaimApprovalSource;
  decidedBy: string | null;
  decidedAt: string | null;
  createdAt: string;
}

export interface ClaimApprovalResult {
  claimId: string;
  reviewState: ClaimReviewState;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  /**
   * True when THIS call was the one that actually transitioned the row
   * (won the race under concurrency). False means a decision already
   * existed (possibly from a concurrent caller that arrived first) and this
   * call's guarded write affected 0 rows — `reviewState`/`decidedBy` still
   * reflect the real, single, persisted decision.
   */
  wonDecision: boolean;
}

export interface GovernedSourceRef {
  claimId: string;
  itemId: string;
  sourceType: string;
  sourceDocId: string | null;
  /** `knowledge_docs.file_hash` as it was AT PUBLISH TIME (frozen copy). */
  fileHash: string | null;
  /** `knowledge_docs.version` as it was AT PUBLISH TIME (frozen copy). */
  docVersion: number | null;
}

export interface GovernedSnapshotClaimEntry {
  claimId: string;
  claimPath: string;
  value: unknown;
  confidence: number;
  sourceType: string;
  itemId: string;
  visibilityScope: string;
  approvalSource: ClaimApprovalSource;
  decidedBy: string | null;
  decidedAt: string | null;
}

/** The exact structure `content_hash` is computed over — see `computeContentHash`. */
export interface GovernedSnapshotPayload {
  organizationId: string;
  schemaVersion: number;
  claims: GovernedSnapshotClaimEntry[];
}

export interface GovernedSnapshotVersion {
  snapshotId: string;
  organizationId: string;
  version: number;
  schemaVersion: number;
  contentHash: string;
  claimCount: number;
  createdAt: string;
  createdBy: string;
}

export interface DanglingSourceRef extends GovernedSourceRef {
  dangling: boolean;
  danglingReason: 'deleted' | 'soft_deleted' | 'hash_mismatch' | null;
}

export interface PinnedSnapshotRead extends GovernedSnapshotVersion {
  claims: GovernedSnapshotClaimEntry[];
  sourceRefs: DanglingSourceRef[];
}

/**
 * Deterministic canonicalization for hashing: recursively sorts object keys
 * so the same logical content always serializes identically regardless of
 * SQL result ordering, V8 object-key insertion order, etc. Array ORDER is
 * caller-controlled (callers sort arrays by a stable key, e.g. claimId,
 * before hashing) — this function does not reorder arrays.
 */
export function canonicalizeForHash(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((entry) => canonicalizeForHash(entry));
  if (value && typeof value === 'object') {
    // Apply `toJSON()` BEFORE key enumeration, mirroring what
    // `JSON.stringify` does. Without this the hash and the stored bytes
    // disagree for any value carrying a `toJSON` — most importantly `Date`,
    // which node-pg returns for every `timestamptz` column (`decided_at`,
    // `created_at`). A `Date` has NO own enumerable keys, so the loop below
    // would canonicalize it to `{}` and hash that, while `JSON.stringify`
    // writes an ISO string into `snapshot_json`. Re-hashing the stored
    // snapshot then produced a DIFFERENT digest than the one recorded
    // alongside it — i.e. a snapshot advertised as hash-bound whose hash did
    // not actually verify, which defeats the whole point of publishing an
    // immutable, tamper-evident version.
    const maybeToJson = value as { toJSON?: () => unknown };
    if (typeof maybeToJson.toJSON === 'function') {
      return canonicalizeForHash(maybeToJson.toJSON());
    }
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = canonicalizeForHash((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

/**
 * The EXACT bytes that are both hashed and persisted as `snapshot_json`.
 *
 * Storing this rather than a separate `JSON.stringify(payload)` is what makes
 * `computeContentHash(JSON.parse(stored)) === stored content_hash` true by
 * construction instead of by coincidence: the stored text is already
 * canonical, so a round-trip through `JSON.parse` + `canonicalizeForHash` is
 * a fixed point.
 */
export function canonicalJsonForHash(payload: unknown): string {
  return JSON.stringify(canonicalizeForHash(payload));
}

/** sha256 hex digest of the canonicalized payload — the snapshot's `content_hash`. */
export function computeContentHash(payload: GovernedSnapshotPayload): string {
  return createHash('sha256').update(canonicalJsonForHash(payload)).digest('hex');
}

/**
 * Resolves whether a claim counts as "approved" for governed-snapshot
 * purposes, and why. See the `review_status` comment in `recordContextSource`
 * for the backward-compatibility rule this implements.
 */
export function resolveClaimApproval(row: {
  review_state: string | null;
  decided_by: string | null;
  decided_at: string | null;
  legacy_review_status: string | null;
}): {
  reviewState: ClaimReviewState;
  approved: boolean;
  source: ClaimApprovalSource;
  decidedBy: string | null;
  decidedAt: string | null;
} {
  if (row.review_state === 'approved') {
    return {
      reviewState: 'approved',
      approved: true,
      source: 'explicit_review',
      decidedBy: row.decided_by,
      decidedAt: row.decided_at,
    };
  }
  if (row.review_state === 'rejected') {
    return {
      reviewState: 'rejected',
      approved: false,
      source: 'explicit_review',
      decidedBy: row.decided_by,
      decidedAt: row.decided_at,
    };
  }
  if (row.review_state === 'pending') {
    return {
      reviewState: 'pending',
      approved: false,
      source: 'explicit_review',
      decidedBy: null,
      decidedAt: null,
    };
  }
  // No row in organization_context_claim_reviews at all — legacy fallback.
  if (row.legacy_review_status === 'accepted') {
    return {
      reviewState: 'approved',
      approved: true,
      source: 'legacy_auto_accept',
      decidedBy: null,
      decidedAt: null,
    };
  }
  return {
    reviewState: 'pending',
    approved: false,
    source: 'legacy_auto_accept',
    decidedBy: null,
    decidedAt: null,
  };
}

/** Extracts the source `knowledge_docs.id` a claim cites, if any. */
function extractDocRefFromClaimValue(claimPath: string, value: unknown): string | null {
  if (claimPath !== 'evidence.documentExtraction') return null;
  if (!value || typeof value !== 'object') return null;
  const docId = (value as Record<string, unknown>).docId;
  return typeof docId === 'string' && docId ? docId : null;
}

export class OrganizationContextService {
  async recordContextSource(input: ContextSourceRecordInput): Promise<{ itemId: string }> {
    const id = uuidv4();
    const now = new Date().toISOString();
    await dbRun(
      `INSERT INTO organization_context_items
       (id, organization_id, source_type, source_id, author_user_id, channel, source_label, content_json, metadata_json, is_explicit, visibility_scope, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.organizationId,
        input.sourceType,
        input.sourceId || null,
        input.authorUserId || null,
        input.channel || 'system',
        input.sourceLabel || null,
        JSON.stringify(input.content || {}),
        JSON.stringify(input.metadata || {}),
        input.isExplicit === false ? 0 : 1,
        input.visibilityScope || 'organization',
        now,
        now,
      ]
    );

    for (const claim of input.claims || []) {
      if (!isKnownClaimPath(claim.claimPath)) continue;
      await dbRun(
        `INSERT INTO organization_context_claims
         (id, organization_id, item_id, claim_path, value_json, confidence, claim_type, status, review_status, supersedes_claim_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, NULL, ?)`,
        [
          uuidv4(),
          input.organizationId,
          id,
          claim.claimPath,
          valueToJson(claim.value),
          claim.confidence ?? 1,
          claim.claimType || 'fact',
          // ORG-BVP-001: claims created from this point on default to
          // 'pending', not 'accepted' — a claim must go through the new
          // approve/reject governance endpoints
          // (`OrganizationContextService.approveClaim`/`rejectClaim`) before
          // it is eligible for a published governed snapshot version (see
          // `resolveClaimApproval` below). Rows written BEFORE this change
          // keep whatever `review_status` they already have in the database
          // (this statement only affects NEW inserts, never rewrites
          // history) and are honored as approved via the
          // 'legacy_auto_accept' fallback — see `resolveClaimApproval`.
          // This does not change the LIVE/legacy resolved-context path
          // (`buildResolvedContext` / `rebuildSnapshot`): that path has
          // never filtered on `review_status`, only on `status='active'`
          // (see `getClaimQueryShape`), so every existing caller of
          // `recordContextSource` keeps working identically.
          claim.reviewStatus || 'pending',
          now,
        ]
      );
    }

    if (input.rebuildSnapshot !== false) {
      await this.rebuildSnapshot(input.organizationId);
    }
    return { itemId: id };
  }

  async rebuildSnapshot(organizationId: string): Promise<void> {
    const resolved = await this.buildResolvedContext(organizationId);
    const snapshot = {
      organizationId: resolved.organizationId,
      schemaVersion: resolved.schemaVersion,
      profile: resolved.profile,
      strategic: resolved.strategic,
      operations: resolved.operations,
      systems: resolved.systems,
      stakeholders: resolved.stakeholders,
      notes: resolved.notes,
      metadata: resolved.metadata,
      evidence: resolved.evidence,
      signals: resolved.signals,
      trust: resolved.trust,
      conflicts: resolved.conflicts,
      counts: resolved.counts,
    };
    const existing = await safeGet<{ organization_id: string }>(
      `SELECT organization_id FROM organization_context_snapshots WHERE organization_id = ?`,
      [organizationId]
    );
    const now = new Date().toISOString();
    if (existing) {
      await dbRun(
        `UPDATE organization_context_snapshots
         SET schema_version = ?, snapshot_json = ?, rebuilt_at = ?
         WHERE organization_id = ?`,
        [ORGANIZATION_CONTEXT_SCHEMA_VERSION, JSON.stringify(snapshot), now, organizationId]
      );
    } else {
      await dbRun(
        `INSERT INTO organization_context_snapshots
         (organization_id, schema_version, snapshot_json, rebuilt_at)
         VALUES (?, ?, ?, ?)`,
        [organizationId, ORGANIZATION_CONTEXT_SCHEMA_VERSION, JSON.stringify(snapshot), now]
      );
    }
  }

  async listTimeline(
    organizationId: string,
    limit = 25
  ): Promise<OrganizationContextTimelineItem[]> {
    const rows = await safeAll<{
      id: string;
      source_type: string;
      source_id: string | null;
      source_label: string | null;
      channel: string;
      is_explicit: number;
      created_at: string;
      author_user_id: string | null;
      content_json: string;
    }>(
      `SELECT id, source_type, source_id, source_label, channel, is_explicit, created_at, author_user_id, content_json
       FROM organization_context_items
       WHERE organization_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [organizationId, limit]
    );

    return rows.map((row) => {
      const content = safeParseJson<Record<string, unknown>>(row.content_json, {});
      return {
        id: row.id,
        sourceType: row.source_type,
        sourceId: row.source_id || null,
        sourceLabel: row.source_label || null,
        channel: row.channel || 'system',
        isExplicit: Boolean(row.is_explicit),
        createdAt: row.created_at,
        authorUserId: row.author_user_id || null,
        summary: buildTimelineSummary(row.source_type, row.source_label || null, content),
      };
    });
  }

  async listClaims(
    organizationId: string,
    limit = 100
  ): Promise<
    Array<{
      id: string;
      claimPath: string;
      value: unknown;
      confidence: number;
      sourceType: string;
      sourceLabel: string | null;
      reviewStatus: string;
      isExplicit: boolean;
      createdAt: string;
    }>
  > {
    const claimShape = await getClaimQueryShape();
    const rows = await safeAll<ClaimRow>(
      `SELECT c.id, c.item_id, c.claim_path, c.value_json, c.confidence, ${claimShape.claimTypeSql}, ${claimShape.reviewStatusSql}, c.created_at,
              i.source_type, ${claimShape.sourceLabelSql}, i.created_at as item_created_at, ${claimShape.isExplicitSql}
       FROM organization_context_claims c
       JOIN organization_context_items i ON i.id = c.item_id
       WHERE c.organization_id = ?${claimShape.activeWhereSql}
       ORDER BY c.created_at DESC
       LIMIT ?`,
      [organizationId, limit]
    );
    return rows.map((row) => ({
      id: row.id,
      claimPath: row.claim_path,
      value: readValue(row),
      confidence: Number(row.confidence || 0),
      sourceType: row.source_type,
      sourceLabel: row.source_label || null,
      reviewStatus: row.review_status || 'accepted',
      isExplicit: Boolean(row.is_explicit),
      createdAt: row.created_at,
    }));
  }

  async buildResolvedContext(organizationId: string): Promise<ResolvedOrganizationContext> {
    const claimShape = await getClaimQueryShape();
    const [
      organization,
      organizationProfile,
      brandingSettingsRow,
      securitySettingsRow,
      ssoConfigurationRow,
      interviewContext,
      metadataRows,
      aiContexts,
      interviewInsights,
      interviewEvidence,
      timeline,
      itemCountRow,
      claimCountRow,
      claimRows,
      snapshotRow,
    ] = await Promise.all([
      safeGet<Record<string, unknown>>(
        `SELECT id, name, default_language, default_timezone, mfa_required, mfa_grace_period_days
         FROM organizations WHERE id = ?`,
        [organizationId]
      ),
      safeGet<Record<string, unknown>>(
        `SELECT * FROM organization_profiles WHERE organization_id = ?`,
        [organizationId]
      ),
      safeGet<{ setting_value?: string }>(
        `SELECT setting_value FROM organization_settings WHERE organization_id = ? AND setting_key = 'branding'`,
        [organizationId]
      ),
      safeGet<{ setting_value?: string }>(
        `SELECT setting_value FROM organization_settings WHERE organization_id = ? AND setting_key = 'security'`,
        [organizationId]
      ),
      safeGet<Record<string, unknown>>(
        `SELECT * FROM sso_configurations WHERE organization_id = ? LIMIT 1`,
        [organizationId]
      ),
      safeGet<Record<string, unknown>>(
        `SELECT * FROM organization_context WHERE organization_id = ?`,
        [organizationId]
      ),
      safeAll<Record<string, unknown>>(
        `SELECT key, value, value_type, category, is_sensitive FROM organization_metadata WHERE organization_id = ? ORDER BY category, key`,
        [organizationId]
      ),
      safeAll<Record<string, unknown>>(
        `SELECT id, name, type, content, priority, created_at FROM ai_contexts WHERE organization_id = ? AND is_active = 1 ORDER BY priority DESC, created_at DESC LIMIT 20`,
        [organizationId]
      ),
      safeAll<Record<string, unknown>>(
        `SELECT * FROM interview_insights WHERE organization_id = ? ORDER BY created_at DESC LIMIT 10`,
        [organizationId]
      ),
      safeAll<Record<string, unknown>>(
        `SELECT * FROM interview_evidence WHERE organization_id = ? ORDER BY created_at DESC LIMIT 10`,
        [organizationId]
      ),
      this.listTimeline(organizationId, 25),
      safeGet<{ count?: number }>(
        `SELECT COUNT(*) as count FROM organization_context_items WHERE organization_id = ?`,
        [organizationId]
      ),
      safeGet<{ count?: number }>(
        `SELECT COUNT(*) as count FROM organization_context_claims c WHERE c.organization_id = ?${claimShape.activeWhereSql}`,
        [organizationId]
      ),
      safeAll<ClaimRow>(
        `SELECT c.id, c.item_id, c.claim_path, c.value_json, c.confidence, ${claimShape.claimTypeSql}, ${claimShape.reviewStatusSql}, c.created_at,
                i.source_type, ${claimShape.sourceLabelSql}, i.created_at as item_created_at, ${claimShape.isExplicitSql}
         FROM organization_context_claims c
         JOIN organization_context_items i ON i.id = c.item_id
         WHERE c.organization_id = ?${claimShape.activeWhereSql}
         ORDER BY c.created_at DESC`,
        [organizationId]
      ),
      safeGet<{ rebuilt_at?: string }>(
        `SELECT rebuilt_at FROM organization_context_snapshots WHERE organization_id = ?`,
        [organizationId]
      ),
    ]);

    const brandingSettings = safeParseJson<Record<string, unknown>>(
      brandingSettingsRow?.setting_value,
      {}
    );
    const securitySettings = safeParseJson<Record<string, unknown>>(
      securitySettingsRow?.setting_value,
      {}
    );
    const conflicts = buildConflicts(claimRows);

    const companyNameClaim = pickBestClaim(claimRows, 'profile.companyName');
    const descriptionClaim = pickBestClaim(claimRows, 'profile.description');
    const industryClaim = pickBestClaim(claimRows, 'profile.industry');
    const industryCodeClaim = pickBestClaim(claimRows, 'profile.industryCode');
    const industrySubsectorClaim = pickBestClaim(claimRows, 'profile.industrySubsector');
    const companySizeClaim = pickBestClaim(claimRows, 'profile.companySize');
    const locationClaim = pickBestClaim(claimRows, 'profile.location');
    const employeeCountClaim = pickBestClaim(claimRows, 'profile.employeeCount');
    const annualRevenueClaim = pickBestClaim(claimRows, 'profile.annualRevenue');
    const websiteClaim = pickBestClaim(claimRows, 'profile.website');
    const defaultLanguageClaim = pickBestClaim(claimRows, 'profile.defaultLanguage');
    const defaultTimezoneClaim = pickBestClaim(claimRows, 'profile.defaultTimezone');
    const currencyClaim = pickBestClaim(claimRows, 'profile.currency');
    const linkedinClaim = pickBestClaim(claimRows, 'profile.linkedinUrl');
    const twitterClaim = pickBestClaim(claimRows, 'profile.twitterUrl');
    const customDomainClaim = pickBestClaim(claimRows, 'profile.customDomain');
    const brandColorClaim = pickBestClaim(claimRows, 'profile.brandColor');
    const accentColorClaim = pickBestClaim(claimRows, 'profile.accentColor');
    const missionClaim = pickBestClaim(claimRows, 'strategic.mission');
    const visionClaim = pickBestClaim(claimRows, 'strategic.vision');
    const competitivePositionClaim = pickBestClaim(claimRows, 'strategic.competitivePosition');
    const growthStageClaim = pickBestClaim(claimRows, 'strategic.growthStage');
    const riskAppetiteClaim = pickBestClaim(claimRows, 'strategic.riskAppetite');
    const cloudAdoptionClaim = pickBestClaim(claimRows, 'systems.cloudAdoption');

    const strategicGoalValues = collectClaimValues(claimRows, 'strategic.goals')
      .map((entry) => entry.value)
      .flatMap((entry) => (Array.isArray(entry) ? entry : [entry]))
      .map((entry) => (typeof entry === 'string' ? entry : null));
    const strategicPriorityValues = collectClaimValues(claimRows, 'strategic.priorities')
      .map((entry) => entry.value)
      .flatMap((entry) => (Array.isArray(entry) ? entry : [entry]))
      .map((entry) => (typeof entry === 'string' ? entry : null));
    const metricValues = collectClaimValues(claimRows, 'operations.keyMetrics')
      .map((entry) => entry.value)
      .flatMap((entry) => (Array.isArray(entry) ? entry : [entry]))
      .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object');
    const gapValues = collectClaimValues(claimRows, 'operations.gaps')
      .map((entry) => entry.value)
      .flatMap((entry) => (Array.isArray(entry) ? entry : [entry]))
      .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object');
    const stakeholderValues = collectClaimValues(claimRows, 'stakeholders.people')
      .map((entry) => entry.value)
      .flatMap((entry) => (Array.isArray(entry) ? entry : [entry]))
      .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object');
    const systemStackValues = collectClaimValues(claimRows, 'systems.stack')
      .map((entry) => entry.value)
      .flatMap((entry) => (Array.isArray(entry) ? entry : [entry]))
      .map((entry) => (typeof entry === 'string' ? entry : null));
    const integrationValues = collectClaimValues(claimRows, 'systems.integrations')
      .map((entry) => entry.value)
      .flatMap((entry) => (Array.isArray(entry) ? entry : [entry]))
      .map((entry) => (typeof entry === 'string' ? entry : null));
    const noteValues = collectClaimValues(claimRows, 'notes.manualContext')
      .map((entry) => entry.value)
      .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object');
    const evidenceValues = collectClaimValues(claimRows, 'evidence.interview')
      .map((entry) => entry.value)
      .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object');
    const documentExtractionValues = collectClaimValues(claimRows, 'evidence.documentExtraction')
      .map((entry) => entry.value)
      .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object');
    const insightValues = collectClaimValues(claimRows, 'signals.interviewInsights')
      .map((entry) => entry.value)
      .flatMap((entry) => (Array.isArray(entry) ? entry : [entry]))
      .map((entry) => (typeof entry === 'string' ? entry : null));
    const metadataValues = collectClaimValues(claimRows, 'metadata.custom')
      .map((entry) => entry.value)
      .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object');
    const interviewAnswerValues = collectClaimValues(claimRows, 'operations.interviewAnswers')
      .map((entry) => entry.value)
      .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object');
    const constraintValues = collectClaimValues(claimRows, 'operations.constraints')
      .map((entry) => entry.value)
      .flatMap((entry) => (Array.isArray(entry) ? entry : [entry]))
      .map((entry) => (typeof entry === 'string' ? entry : null));

    const legacyKeyMetrics = safeParseJson<Array<Record<string, unknown>>>(
      interviewContext?.key_metrics,
      []
    );
    const legacyStakeholders = safeParseJson<Array<Record<string, unknown>>>(
      interviewContext?.stakeholders,
      []
    );
    const legacyGaps = safeParseJson<Array<Record<string, unknown>>>(
      interviewContext?.open_gaps,
      []
    );
    const legacyStrategicPriorities = safeParseJson<string[]>(
      organizationProfile?.strategic_priorities,
      []
    );
    const legacyTechStack = safeParseJson<string[]>(organizationProfile?.technology_stack, []);

    const evidenceFromRows = interviewEvidence.map((row) => ({
      evidenceId: asString(row.id),
      title: asString(row.title),
      evidenceType: asString(row.evidence_type),
      snippet:
        asString(row.transcript_text) ||
        asString(row.description) ||
        asString(row.url) ||
        asString(row.title),
      createdAt: asString(row.created_at),
    }));

    const signalsFromRows = interviewInsights
      .map((row) => asString(row.title) || asString(row.content) || asString(row.description))
      .filter((value): value is string => Boolean(value));

    const publishedInsightIds = interviewInsights
      .filter((row) => asString(row.status) === 'published')
      .map((row) => asString(row.id))
      .filter((id): id is string => Boolean(id));

    const p10Findings: Array<{
      findingStatement: string;
      confidenceLevel: string;
      limits: string;
      nextAction: string;
      evidenceCount: number;
      insightId: string;
    }> = [];
    for (const insightId of publishedInsightIds) {
      try {
        const findings = await listP10Findings(insightId);
        for (const f of findings) {
          const activePointers = f.evidence_pointers.filter((p) => !p.isTombstone);
          p10Findings.push({
            findingStatement: f.finding_statement,
            confidenceLevel: f.confidence_level,
            limits: f.limits,
            nextAction: f.next_action,
            evidenceCount: activePointers.length,
            insightId: f.insightId,
          });
        }
      } catch {
        // findings service may not have data for this insight
      }
    }

    const customMetadataRows = metadataRows.map((row) => ({
      key: asString(row.key),
      value: row.value,
      valueType: asString(row.value_type),
      category: asString(row.category),
      isSensitive: Boolean(row.is_sensitive),
    }));

    const manualContexts = aiContexts.map((row) => ({
      id: asString(row.id),
      name: asString(row.name),
      type: asString(row.type),
      content: asString(row.content),
      priority: asNumber(row.priority),
      createdAt: asString(row.created_at),
    }));

    return {
      organizationId,
      schemaVersion: ORGANIZATION_CONTEXT_SCHEMA_VERSION,
      snapshotUpdatedAt: snapshotRow?.rebuilt_at || null,
      counts: {
        items: Number(itemCountRow?.count || 0),
        claims: Number(claimCountRow?.count || 0),
        conflicts: conflicts.length,
      },
      profile: {
        companyName:
          asString(companyNameClaim?.value) ||
          asString(interviewContext?.company_name) ||
          asString(organization?.name),
        description:
          asString(descriptionClaim?.value) || asString(brandingSettings.description) || null,
        industry:
          asString(industryClaim?.value) ||
          asString(interviewContext?.industry) ||
          asString(organizationProfile?.industry) ||
          asString(brandingSettings.industry),
        industryCode:
          asString(industryCodeClaim?.value) || asString(organizationProfile?.industry_code),
        industrySubsector:
          asString(industrySubsectorClaim?.value) ||
          asString(organizationProfile?.industry_subsector),
        companySize:
          asString(companySizeClaim?.value) ||
          asString(interviewContext?.company_size) ||
          asString(organizationProfile?.company_size) ||
          asString(brandingSettings.companySize),
        location:
          asString(locationClaim?.value) ||
          asString(interviewContext?.location) ||
          asString(organizationProfile?.headquarters_country),
        employeeCount:
          asNumber(employeeCountClaim?.value) ||
          asNumber(interviewContext?.employee_count) ||
          asNumber(organizationProfile?.employee_count),
        annualRevenue:
          asString(annualRevenueClaim?.value) ||
          asString(interviewContext?.annual_revenue) ||
          String(organizationProfile?.annual_revenue || '').trim() ||
          null,
        website: asString(websiteClaim?.value) || asString(brandingSettings.website),
        defaultLanguage:
          asString(defaultLanguageClaim?.value) ||
          asString(organization?.default_language) ||
          asString(organizationProfile?.preferred_language),
        defaultTimezone:
          asString(defaultTimezoneClaim?.value) ||
          asString(organization?.default_timezone) ||
          asString(brandingSettings.defaultTimezone),
        currency: asString(currencyClaim?.value) || asString(brandingSettings.currency),
        linkedinUrl: asString(linkedinClaim?.value) || asString(brandingSettings.linkedinUrl),
        twitterUrl: asString(twitterClaim?.value) || asString(brandingSettings.twitterUrl),
        customDomain: asString(customDomainClaim?.value) || asString(brandingSettings.customDomain),
        brandColor: asString(brandColorClaim?.value) || asString(brandingSettings.brandColor),
        accentColor: asString(accentColorClaim?.value) || asString(brandingSettings.accentColor),
        organizationType:
          asString(pickBestClaim(claimRows, 'profile.organizationType')?.value) ||
          asString(organizationProfile?.organization_type),
        revenueModel:
          asString(pickBestClaim(claimRows, 'profile.revenueModel')?.value) ||
          asString(organizationProfile?.revenue_model),
        foundingYear:
          asNumber(pickBestClaim(claimRows, 'profile.foundingYear')?.value) ||
          asNumber(organizationProfile?.founding_year),
        communicationStyle:
          asString(pickBestClaim(claimRows, 'profile.communicationStyle')?.value) ||
          asString(organizationProfile?.communication_style),
        industryJargonLevel:
          asString(pickBestClaim(claimRows, 'profile.industryJargonLevel')?.value) ||
          asString(organizationProfile?.industry_jargon_level),
      },
      strategic: {
        goals: uniqStrings([...strategicGoalValues, ...legacyStrategicPriorities]),
        priorities: uniqStrings([...strategicPriorityValues, ...legacyStrategicPriorities]),
        mission: asString(missionClaim?.value) || asString(organizationProfile?.mission_statement),
        vision: asString(visionClaim?.value) || asString(organizationProfile?.vision_statement),
        competitivePosition:
          asString(competitivePositionClaim?.value) ||
          asString(organizationProfile?.competitive_position),
        growthStage:
          asString(growthStageClaim?.value) || asString(organizationProfile?.growth_stage),
        riskAppetite:
          asString(riskAppetiteClaim?.value) || asString(organizationProfile?.risk_appetite),
      },
      operations: {
        keyMetrics: await this.enrichKeyMetricsWithKpiHealth(
          organizationId,
          mergeUniqueObjects(metricValues, legacyKeyMetrics)
        ),
        constraints: uniqStrings([
          ...constraintValues,
          asString(organizationProfile?.budget_constraints),
          asString(organizationProfile?.timeline_constraints),
        ]),
        gaps: mergeUniqueObjects(gapValues, legacyGaps),
        interviewAnswers: interviewAnswerValues,
        deliveryModel:
          asString(pickBestClaim(claimRows, 'operations.deliveryModel')?.value) ||
          asString(organizationProfile?.delivery_model),
        productionArchetype:
          asString(pickBestClaim(claimRows, 'operations.productionArchetype')?.value) ||
          asString(organizationProfile?.production_archetype),
        shiftPattern:
          asString(pickBestClaim(claimRows, 'operations.shiftPattern')?.value) ||
          asString(organizationProfile?.shift_pattern),
        automationLevel:
          asString(pickBestClaim(claimRows, 'operations.automationLevel')?.value) ||
          asString(organizationProfile?.automation_level),
      },
      systems: {
        stack: uniqStrings([...systemStackValues, ...legacyTechStack]),
        cloudAdoption:
          asString(cloudAdoptionClaim?.value) ||
          asString(organizationProfile?.cloud_adoption_level),
        integrations: uniqStrings(integrationValues),
        coreSystems: normalizeArrayOfStrings(
          pickBestClaim(claimRows, 'systems.coreSystems')?.value ??
            safeParseJson(organizationProfile?.core_systems, [])
        ),
      },
      stakeholders: mergeUniqueObjects(stakeholderValues, legacyStakeholders),
      notes: {
        manualContext: mergeUniqueObjects(
          noteValues,
          manualContexts.filter((row) => !!row.content) as Array<Record<string, unknown>>
        ),
      },
      metadata: {
        custom: mergeUniqueObjects(metadataValues, customMetadataRows),
      },
      evidence: mergeUniqueObjects(
        mergeUniqueObjects(evidenceValues, documentExtractionValues),
        evidenceFromRows
      ),
      signals: {
        interviewInsights: uniqStrings([...insightValues, ...signalsFromRows]),
        interviewFindings: p10Findings,
      },
      trust: {
        mfa: {
          required: Boolean(organization?.mfa_required),
          gracePeriodDays: asNumber(organization?.mfa_grace_period_days) ?? 7,
          managedBy: 'admin',
        },
        sso: {
          configured: Boolean(ssoConfigurationRow),
          provider:
            asString(ssoConfigurationRow?.provider) ||
            asString(ssoConfigurationRow?.provider_name) ||
            asString(ssoConfigurationRow?.provider_type) ||
            asString(securitySettings.ssoProvider),
          enforced: Boolean(
            ssoConfigurationRow?.enforce_sso ??
            ssoConfigurationRow?.sso_enforced ??
            securitySettings.ssoEnforced ??
            false
          ),
          allowPasswordLogin: Boolean(
            ssoConfigurationRow?.allow_password_login ?? securitySettings.allowPasswordLogin ?? true
          ),
          active: Boolean(
            ssoConfigurationRow?.enabled ??
            ssoConfigurationRow?.is_active ??
            ssoConfigurationRow?.is_enabled ??
            securitySettings.ssoEnabled ??
            false
          ),
          managedBy: 'admin',
        },
        security: {
          passwordPolicy: asString(securitySettings.passwordPolicy) || 'standard',
          sessionTimeout: asNumber(securitySettings.sessionTimeout) ?? 3600,
          ipWhitelist: Array.isArray(securitySettings.ipWhitelist)
            ? securitySettings.ipWhitelist.length > 0
            : Boolean(securitySettings.ipWhitelist),
          managedBy: 'admin',
        },
      },
      conflicts,
      timeline,
      finance: await this._collectFinanceContext(organizationId),
    };
  }

  private async _collectFinanceContext(organizationId: string): Promise<{
    statementCount: number;
    modelCount: number;
    activeLaneRunId: string | null;
    activeLaneStep: string | null;
    latestVersionType: string | null;
    degradedCount: number;
  }> {
    try {
      const counts = await dbGet<{ stmt_count?: number; model_count?: number }>(
        `SELECT
          (SELECT COUNT(*) FROM financial_statement_packs WHERE organization_id = ?) as stmt_count,
          (SELECT COUNT(*) FROM financial_model_versions WHERE organization_id = ?) as model_count`,
        [organizationId, organizationId]
      ).catch(() => null);

      const activeRun = await dbGet<{
        run_id?: string;
        current_step?: string;
        degraded_json?: string;
      }>(
        `SELECT run_id, current_step, degraded_json FROM v8_finance_lane_runs
         WHERE organization_id = ? AND (current_step != 'readback' OR readback_confirmed = 0)
         ORDER BY created_at DESC LIMIT 1`,
        [organizationId]
      ).catch(() => null);

      const latestVersion = await dbGet<{ version_type?: string }>(
        `SELECT version_type FROM v8_finance_version_snapshots
         WHERE organization_id = ? AND is_finalized = 1
         ORDER BY created_at DESC LIMIT 1`,
        [organizationId]
      ).catch(() => null);

      let degradedCount = 0;
      if (activeRun?.degraded_json) {
        try {
          const arr = JSON.parse(String(activeRun.degraded_json));
          degradedCount = Array.isArray(arr) ? arr.length : 0;
        } catch {
          /* ignore */
        }
      }

      return {
        statementCount: Number(counts?.stmt_count ?? 0),
        modelCount: Number(counts?.model_count ?? 0),
        activeLaneRunId: activeRun?.run_id ? String(activeRun.run_id) : null,
        activeLaneStep: activeRun?.current_step ? String(activeRun.current_step) : null,
        latestVersionType: latestVersion?.version_type ? String(latestVersion.version_type) : null,
        degradedCount,
      };
    } catch (err) {
      logger.warn('[OrgContext] Finance context collection failed (non-blocking)', err);
      return {
        statementCount: 0,
        modelCount: 0,
        activeLaneRunId: null,
        activeLaneStep: null,
        latestVersionType: null,
        degradedCount: 0,
      };
    }
  }

  async recordOrganizationProfile(params: {
    organizationId: string;
    userId?: string | null;
    payload: Record<string, unknown>;
  }): Promise<void> {
    await this.recordContextSource({
      organizationId: params.organizationId,
      sourceType: 'organization_profile',
      sourceId: params.organizationId,
      authorUserId: params.userId || null,
      channel: 'admin',
      sourceLabel: 'Organization profile updated',
      content: params.payload,
      isExplicit: true,
      claims: buildOrganizationProfileClaims(params.payload),
    });
  }

  async recordInterviewContext(params: {
    organizationId: string;
    userId?: string | null;
    payload: Record<string, unknown>;
  }): Promise<void> {
    await this.recordContextSource({
      organizationId: params.organizationId,
      sourceType: 'interview_context',
      sourceId: asString(params.payload.lastInterviewId),
      authorUserId: params.userId || null,
      channel: 'interview',
      sourceLabel: 'Interview organization context updated',
      content: params.payload,
      isExplicit: true,
      claims: buildInterviewContextClaims(params.payload),
    });
  }

  async recordInterviewAnswer(params: {
    organizationId: string;
    userId?: string | null;
    payload: Record<string, unknown>;
  }): Promise<void> {
    await this.recordContextSource({
      organizationId: params.organizationId,
      sourceType: 'interview_answer',
      sourceId: asString(params.payload.questionId),
      authorUserId: params.userId || null,
      channel: 'interview',
      sourceLabel: asString(params.payload.questionText) || 'Interview answer recorded',
      content: params.payload,
      isExplicit: true,
      claims: buildInterviewAnswerClaims(params.payload),
    });
  }

  async recordInterviewEvidence(params: {
    organizationId: string;
    userId?: string | null;
    payload: Record<string, unknown>;
  }): Promise<void> {
    await this.recordContextSource({
      organizationId: params.organizationId,
      sourceType: 'interview_evidence',
      sourceId: asString(params.payload.evidenceId),
      authorUserId: params.userId || null,
      channel: 'upload',
      sourceLabel: asString(params.payload.title) || 'Interview evidence added',
      content: params.payload,
      isExplicit: true,
      claims: buildInterviewEvidenceClaims(params.payload),
    });
  }

  async recordOrganizationMetadata(params: {
    organizationId: string;
    userId?: string | null;
    payload: Record<string, unknown>;
  }): Promise<void> {
    await this.recordContextSource({
      organizationId: params.organizationId,
      sourceType: 'organization_metadata',
      sourceId: asString(params.payload.key),
      authorUserId: params.userId || null,
      channel: 'admin',
      sourceLabel: asString(params.payload.key) || 'Organization metadata updated',
      content: params.payload,
      isExplicit: true,
      claims: buildMetadataClaims(params.payload),
    });
  }

  async recordManualAIContext(params: {
    organizationId: string;
    userId?: string | null;
    contextId?: string | null;
    payload: Record<string, unknown>;
  }): Promise<void> {
    await this.recordContextSource({
      organizationId: params.organizationId,
      sourceType: 'ai_context',
      sourceId: params.contextId || null,
      authorUserId: params.userId || null,
      channel: 'manual',
      sourceLabel: asString(params.payload.name) || 'Manual AI context',
      content: params.payload,
      isExplicit: true,
      claims: buildManualContextClaims(params.payload),
    });
  }

  async recordToolSession(params: {
    organizationId: string;
    userId?: string | null;
    payload: Record<string, unknown>;
  }): Promise<void> {
    await this.recordContextSource({
      organizationId: params.organizationId,
      sourceType: 'tool_session',
      sourceId: asString(params.payload.toolId),
      authorUserId: params.userId || null,
      channel: 'tools',
      sourceLabel: asString(params.payload.name) || 'Tool session updated',
      content: params.payload,
      isExplicit: true,
      claims: buildToolSessionClaims(params.payload),
    });
  }

  async recordMyWorkIdea(params: {
    organizationId: string;
    userId?: string | null;
    payload: Record<string, unknown>;
  }): Promise<void> {
    await this.recordContextSource({
      organizationId: params.organizationId,
      sourceType: 'my_work_idea',
      sourceId: asString(params.payload.ideaId),
      authorUserId: params.userId || null,
      channel: 'my_work',
      sourceLabel: asString(params.payload.title) || 'My Work idea updated',
      content: params.payload,
      isExplicit: true,
      claims: buildIdeaClaims(params.payload),
    });
  }

  async recordChatMessage(params: {
    organizationId: string;
    userId?: string | null;
    payload: Record<string, unknown>;
  }): Promise<{ itemId: string }> {
    const messageRole = asString(params.payload.role);
    return this.recordContextSource({
      organizationId: params.organizationId,
      sourceType: 'chat_message',
      sourceId: asString(params.payload.messageId),
      authorUserId: params.userId || null,
      channel: 'chat',
      sourceLabel:
        messageRole === 'ai'
          ? 'AI message saved as org context'
          : 'Chat message captured as org context',
      content: params.payload,
      isExplicit: true,
      claims: buildChatClaims(params.payload),
    });
  }

  async recordAttachmentExtraction(params: {
    organizationId: string;
    userId?: string | null;
    payload: Record<string, unknown>;
  }): Promise<{ itemId: string }> {
    const extractedText = asString(params.payload.extractedText) || '';
    return this.recordContextSource({
      organizationId: params.organizationId,
      sourceType: 'document_extraction',
      sourceId: asString(params.payload.docId),
      authorUserId: params.userId || null,
      channel: 'upload',
      sourceLabel: asString(params.payload.filename) || 'Document extracted into org context',
      content: {
        ...params.payload,
        extractedText: extractedText.slice(0, 12000),
        truncated: extractedText.length > 12000,
      },
      isExplicit: true,
      claims: buildDocumentExtractionClaims({
        ...params.payload,
        snippet: extractedText.slice(0, 2000),
      }),
    });
  }

  private async enrichKeyMetricsWithKpiHealth(
    organizationId: string,
    existingMetrics: Array<Record<string, unknown>>
  ): Promise<Array<Record<string, unknown>>> {
    try {
      const [totalRow, onTargetRow, openDeviationsRow, openReconciliationsRow] = await Promise.all([
        safeGet<{ cnt: number }>(
          `SELECT COUNT(*) as cnt FROM initiative_kpis WHERE organization_id = ?`,
          [organizationId]
        ),
        safeGet<{ cnt: number }>(
          `SELECT COUNT(*) as cnt FROM initiative_kpis WHERE organization_id = ? AND is_on_target = 1`,
          [organizationId]
        ),
        safeGet<{ cnt: number }>(
          `SELECT COUNT(*) as cnt FROM kpi_deviation_cases dc
           JOIN initiative_kpis ik ON ik.id = dc.kpi_id
           WHERE ik.organization_id = ? AND dc.status NOT IN ('CLOSED', 'RESOLVED')`,
          [organizationId]
        ),
        safeGet<{ cnt: number }>(
          `SELECT COUNT(*) as cnt FROM v8_kpi_finance_reconciliations
           WHERE organization_id = ? AND reconciliation_status = 'pending'`,
          [organizationId]
        ),
      ]);

      const total = totalRow?.cnt ?? 0;
      if (total === 0) return existingMetrics;

      const onTarget = onTargetRow?.cnt ?? 0;
      const pctOnTarget = total > 0 ? Math.round((onTarget / total) * 100) : 0;

      return [
        ...existingMetrics,
        {
          name: 'KPI Health',
          source: 'kpi_module',
          totalKpis: total,
          onTarget,
          pctOnTarget,
          openDeviations: openDeviationsRow?.cnt ?? 0,
          pendingReconciliations: openReconciliationsRow?.cnt ?? 0,
        },
      ];
    } catch (err) {
      logger.debug(
        '[OrganizationContextService] KPI health enrichment skipped:',
        (err as Error)?.message
      );
      return existingMetrics;
    }
  }

  // ───────────────────────────────────────────────────────────────────────
  // ORG-BVP-001 / ORG-OPS-001 — governed snapshot spine
  // ───────────────────────────────────────────────────────────────────────

  /**
   * Lists claims for an organization together with their governance
   * decision (explicit review, or the legacy auto-accept fallback — see
   * `resolveClaimApproval`). By default excludes claims whose
   * `organization_context_items.visibility_scope = 'restricted'` — pass
   * `includeRestricted: true` for internal/privileged callers (e.g.
   * building the snapshot payload itself, which must still capture
   * restricted claims; visibility filtering is enforced at READ time, see
   * `getSnapshotVersion`).
   */
  async listGovernedClaims(
    organizationId: string,
    opts?: { includeRestricted?: boolean; limit?: number }
  ): Promise<GovernedClaimView[]> {
    const limit = Math.max(1, Math.min(opts?.limit ?? 200, 500));
    const rows = await safeAll<{
      id: string;
      claim_id: string;
      item_id: string;
      claim_path: string;
      value_json: string;
      confidence: number;
      legacy_review_status: string | null;
      created_at: string;
      source_type: string;
      visibility_scope: string | null;
      review_state: string | null;
      decided_by: string | null;
      decided_at: string | null;
    }>(
      `SELECT c.id as claim_id, c.item_id, c.claim_path, c.value_json, c.confidence,
              c.review_status as legacy_review_status, c.created_at,
              i.source_type, i.visibility_scope,
              r.review_state, r.decided_by, r.decided_at
       FROM organization_context_claims c
       JOIN organization_context_items i ON i.id = c.item_id
       LEFT JOIN organization_context_claim_reviews r ON r.claim_id = c.id
       WHERE c.organization_id = ? AND c.status = 'active'
       ORDER BY c.created_at DESC
       LIMIT ?`,
      [organizationId, limit]
    );

    return rows
      .filter((row) => opts?.includeRestricted || row.visibility_scope !== 'restricted')
      .map((row) => {
        const decision = resolveClaimApproval(row);
        return {
          claimId: row.claim_id,
          itemId: row.item_id,
          claimPath: row.claim_path,
          value: safeParseJson(row.value_json, null),
          confidence: Number(row.confidence || 0),
          sourceType: row.source_type,
          visibilityScope: row.visibility_scope || 'organization',
          legacyReviewStatus: row.legacy_review_status || 'accepted',
          reviewState: decision.reviewState,
          approved: decision.approved,
          approvalSource: decision.source,
          decidedBy: decision.decidedBy,
          decidedAt: decision.decidedAt,
          createdAt: row.created_at,
        };
      });
  }

  /**
   * Approves or rejects a claim. Tenant-scoped (returns null if the claim
   * does not belong to `organizationId`, treated by callers as 404).
   *
   * Concurrency: implemented as a single atomic
   * `INSERT ... ON CONFLICT (claim_id) DO UPDATE ... WHERE review_state =
   * 'pending'` statement. Postgres serializes concurrent writers on the
   * `claim_id` unique index, so exactly one caller's write can observe the
   * row as absent/'pending' and transition it; every other concurrent
   * caller's guarded UPDATE matches 0 rows. The method always re-reads the
   * row afterward and returns the ACTUAL persisted decision (not
   * necessarily the one this call attempted) plus `wonDecision` so the
   * caller can tell the two cases apart.
   */
  private async decideClaim(
    organizationId: string,
    claimId: string,
    actorId: string,
    targetState: 'approved' | 'rejected',
    note?: string | null
  ): Promise<ClaimApprovalResult | null> {
    const claim = await safeGet<{ id: string }>(
      `SELECT c.id FROM organization_context_claims c WHERE c.id = ? AND c.organization_id = ?`,
      [claimId, organizationId]
    );
    if (!claim) return null;

    const now = new Date().toISOString();
    const result = await dbRun(
      `INSERT INTO organization_context_claim_reviews
         (id, organization_id, claim_id, review_state, decided_by, decided_at, decision_note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (claim_id) DO UPDATE SET
         review_state = EXCLUDED.review_state,
         decided_by = EXCLUDED.decided_by,
         decided_at = EXCLUDED.decided_at,
         decision_note = EXCLUDED.decision_note,
         updated_at = EXCLUDED.updated_at
       WHERE organization_context_claim_reviews.review_state = 'pending'`,
      [uuidv4(), organizationId, claimId, targetState, actorId, now, note || null, now, now]
    );
    const wonDecision = Number(result?.changes || 0) > 0;

    const row = await safeGet<{
      review_state: string;
      decided_by: string | null;
      decided_at: string | null;
      decision_note: string | null;
    }>(
      `SELECT review_state, decided_by, decided_at, decision_note
       FROM organization_context_claim_reviews WHERE claim_id = ? AND organization_id = ?`,
      [claimId, organizationId]
    );
    if (!row) return null;

    return {
      claimId,
      reviewState: row.review_state as ClaimReviewState,
      decidedBy: row.decided_by,
      decidedAt: row.decided_at,
      decisionNote: row.decision_note,
      wonDecision,
    };
  }

  async approveClaim(
    organizationId: string,
    claimId: string,
    actorId: string,
    note?: string | null
  ): Promise<ClaimApprovalResult | null> {
    return this.decideClaim(organizationId, claimId, actorId, 'approved', note);
  }

  async rejectClaim(
    organizationId: string,
    claimId: string,
    actorId: string,
    note?: string | null
  ): Promise<ClaimApprovalResult | null> {
    return this.decideClaim(organizationId, claimId, actorId, 'rejected', note);
  }

  /**
   * Publishes a new, immutable, hash-bound snapshot version from the
   * CURRENTLY approved claims (explicit approvals, plus legacy
   * auto-accepted rows — see `resolveClaimApproval`). Unapproved
   * (pending/rejected) claims are excluded — this is the DB-level point of
   * ORG-BVP-001. Version numbers are assigned atomically per organization
   * (`MAX(version)+1` inside the same INSERT, guarded by the
   * `UNIQUE(organization_id, version)` index) with a bounded retry loop so
   * two racing publishes for the same org cannot collide on a version
   * number.
   */
  async publishSnapshotVersion(
    organizationId: string,
    actorId: string
  ): Promise<GovernedSnapshotVersion> {
    const approvedClaims = (
      await this.listGovernedClaims(organizationId, { includeRestricted: true, limit: 500 })
    ).filter((c) => c.approved);

    // Deterministic order so the same approved-claim set always produces
    // the same content_hash, independent of SQL scan order.
    approvedClaims.sort((a, b) => a.claimId.localeCompare(b.claimId));

    const docIds = uniqStrings(
      approvedClaims.map((c) => extractDocRefFromClaimValue(c.claimPath, c.value))
    );
    const docRows = docIds.length
      ? await safeAll<{ id: string; file_hash: string | null; version: number | null }>(
          `SELECT id, file_hash, version FROM knowledge_docs WHERE id = ANY(?)`,
          [docIds]
        )
      : [];
    const docById = new Map(docRows.map((d) => [d.id, d]));

    const claimEntries: GovernedSnapshotClaimEntry[] = approvedClaims.map((c) => ({
      claimId: c.claimId,
      claimPath: c.claimPath,
      value: c.value,
      confidence: c.confidence,
      sourceType: c.sourceType,
      itemId: c.itemId,
      visibilityScope: c.visibilityScope,
      approvalSource: c.approvalSource,
      decidedBy: c.decidedBy,
      decidedAt: c.decidedAt,
    }));

    const sourceRefs: GovernedSourceRef[] = approvedClaims.map((c) => {
      const docId = extractDocRefFromClaimValue(c.claimPath, c.value);
      const doc = docId ? docById.get(docId) : undefined;
      return {
        claimId: c.claimId,
        itemId: c.itemId,
        sourceType: c.sourceType,
        sourceDocId: docId,
        fileHash: doc?.file_hash ?? null,
        docVersion: doc?.version ?? null,
      };
    });

    const payload: GovernedSnapshotPayload = {
      organizationId,
      schemaVersion: GOVERNED_SNAPSHOT_SCHEMA_VERSION,
      claims: claimEntries,
    };
    const contentHash = computeContentHash(payload);
    const now = new Date().toISOString();

    const MAX_ATTEMPTS = 8;
    let publishedId: string | null = null;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const id = uuidv4();
      const result = await dbRun(
        `INSERT INTO organization_context_snapshot_versions
           (id, organization_id, version, schema_version, content_hash, claim_count, snapshot_json, source_refs_json, created_at, created_by)
         SELECT ?, ?, COALESCE(MAX(version), 0) + 1, ?, ?, ?, ?, ?, ?, ?
         FROM organization_context_snapshot_versions WHERE organization_id = ?
         ON CONFLICT (organization_id, version) DO NOTHING`,
        [
          id,
          organizationId,
          GOVERNED_SNAPSHOT_SCHEMA_VERSION,
          contentHash,
          claimEntries.length,
          // Persist the SAME canonical bytes that `contentHash` was computed
          // over — see `canonicalJsonForHash`. Using a plain
          // `JSON.stringify(payload)` here stored a different serialization
          // than the one hashed, so an integrity re-check of a published
          // snapshot failed against its own recorded hash.
          canonicalJsonForHash(payload),
          canonicalJsonForHash(sourceRefs),
          now,
          actorId,
          organizationId,
        ]
      );
      if (Number(result?.changes || 0) > 0) {
        publishedId = id;
        break;
      }
    }
    if (!publishedId) {
      throw new Error(
        `[OrgContext] Failed to publish snapshot version for org ${organizationId} after ${MAX_ATTEMPTS} attempts (version contention).`
      );
    }

    const row = await safeGet<{ version: number; created_at: string }>(
      `SELECT version, created_at FROM organization_context_snapshot_versions WHERE id = ?`,
      [publishedId]
    );

    return {
      snapshotId: publishedId,
      organizationId,
      version: Number(row?.version || 0),
      schemaVersion: GOVERNED_SNAPSHOT_SCHEMA_VERSION,
      contentHash,
      claimCount: claimEntries.length,
      createdAt: row?.created_at || now,
      createdBy: actorId,
    };
  }

  /** Metadata-only listing of published versions (no full payload). */
  async listSnapshotVersions(
    organizationId: string,
    limit = 20
  ): Promise<GovernedSnapshotVersion[]> {
    const rows = await safeAll<{
      id: string;
      version: number;
      schema_version: number;
      content_hash: string;
      claim_count: number;
      created_at: string;
      created_by: string;
    }>(
      `SELECT id, version, schema_version, content_hash, claim_count, created_at, created_by
       FROM organization_context_snapshot_versions
       WHERE organization_id = ?
       ORDER BY version DESC
       LIMIT ?`,
      [organizationId, Math.max(1, Math.min(limit, 100))]
    );
    return rows.map((r) => ({
      snapshotId: r.id,
      organizationId,
      version: Number(r.version),
      schemaVersion: Number(r.schema_version),
      contentHash: r.content_hash,
      claimCount: Number(r.claim_count),
      createdAt: r.created_at,
      createdBy: r.created_by,
    }));
  }

  /**
   * Pinned, reproducible read of exactly ONE snapshot version. Reopening
   * the same version later always returns the same `contentHash` (the row
   * is immutable — see the migration's BEFORE UPDATE trigger).
   *
   * Detects dangling source refs (ORG-OPS-001 (e)): for every claim citing
   * a `knowledge_docs` row, re-checks that row live and marks the ref
   * `dangling: true` if the document was hard-deleted (`deleted: true`
   * reason), soft-deleted (`deleted_at` set), or its `file_hash` no longer
   * matches what was frozen at publish time (content changed since). The
   * stored snapshot content itself is NEVER modified by this check — this
   * is detection, not silent correction or corruption.
   */
  async getSnapshotVersion(
    organizationId: string,
    version: number,
    opts?: { includeRestricted?: boolean }
  ): Promise<PinnedSnapshotRead | null> {
    const row = await safeGet<{
      id: string;
      version: number;
      schema_version: number;
      content_hash: string;
      claim_count: number;
      snapshot_json: string;
      source_refs_json: string;
      created_at: string;
      created_by: string;
    }>(
      `SELECT id, version, schema_version, content_hash, claim_count, snapshot_json, source_refs_json, created_at, created_by
       FROM organization_context_snapshot_versions
       WHERE organization_id = ? AND version = ?`,
      [organizationId, version]
    );
    if (!row) return null;

    const payload = safeParseJson<GovernedSnapshotPayload>(row.snapshot_json, {
      organizationId,
      schemaVersion: row.schema_version,
      claims: [],
    });
    const refs = safeParseJson<GovernedSourceRef[]>(row.source_refs_json, []);

    const visibleClaims = opts?.includeRestricted
      ? payload.claims
      : payload.claims.filter((c) => c.visibilityScope !== 'restricted');
    const visibleClaimIds = new Set(visibleClaims.map((c) => c.claimId));

    const docIds = uniqStrings(refs.map((r) => r.sourceDocId));
    const liveDocs = docIds.length
      ? await safeAll<{ id: string; file_hash: string | null; deleted_at: string | null }>(
          `SELECT id, file_hash, deleted_at FROM knowledge_docs WHERE id = ANY(?)`,
          [docIds]
        )
      : [];
    const liveDocById = new Map(liveDocs.map((d) => [d.id, d]));

    const sourceRefs: DanglingSourceRef[] = refs
      .filter((r) => visibleClaimIds.has(r.claimId))
      .map((r) => {
        if (!r.sourceDocId) {
          return { ...r, dangling: false, danglingReason: null };
        }
        const live = liveDocById.get(r.sourceDocId);
        if (!live) return { ...r, dangling: true, danglingReason: 'deleted' as const };
        if (live.deleted_at) return { ...r, dangling: true, danglingReason: 'soft_deleted' as const };
        if (r.fileHash && live.file_hash && live.file_hash !== r.fileHash) {
          return { ...r, dangling: true, danglingReason: 'hash_mismatch' as const };
        }
        return { ...r, dangling: false, danglingReason: null };
      });

    return {
      snapshotId: row.id,
      organizationId,
      version: Number(row.version),
      schemaVersion: Number(row.schema_version),
      contentHash: row.content_hash,
      claimCount: Number(row.claim_count),
      createdAt: row.created_at,
      createdBy: row.created_by,
      claims: visibleClaims,
      sourceRefs,
    };
  }
}

export const organizationContextService = new OrganizationContextService();

export async function rebuildOrganizationContextSnapshot(organizationId: string): Promise<void> {
  try {
    await organizationContextService.rebuildSnapshot(organizationId);
  } catch (error) {
    logger.warn('[OrganizationContextService] Failed to rebuild snapshot', {
      organizationId,
      error: (error as Error)?.message,
    });
  }
}

export default organizationContextService;
