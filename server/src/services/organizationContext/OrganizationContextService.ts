import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'node:crypto';

import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import { hasColumn } from '../../utils/dbSchema.js';
import logger from '../../utils/Logger.js';
import { listFindings as listP10Findings } from '../v8/interviewInsightFindingsService.js';

export const ORGANIZATION_CONTEXT_SCHEMA_VERSION = 1;

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

export interface OrganizationContextSourceRef {
  claimId: string;
  itemId: string;
  sourceType: string;
  sourceId: string | null;
  claimPath: string;
  confidence: number;
}

export interface PublishedOrganizationContextSnapshot {
  snapshotId: string;
  organizationId: string;
  schemaVersion: number;
  contentHash: string;
  sourceRefs: OrganizationContextSourceRef[];
  context: ResolvedOrganizationContext;
  createdBy: string;
  createdAt: string;
}

export class OrganizationContextPublicationError extends Error {
  constructor(
    public readonly code:
      | 'CLAIM_NOT_FOUND'
      | 'CLAIM_CONFLICT'
      | 'SOURCE_UNAVAILABLE'
      | 'CONFIDENTIAL_SOURCE'
      | 'STALE_REVIEW_STATUS',
    message: string
  ) {
    super(message);
    this.name = 'OrganizationContextPublicationError';
  }
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

function normalizeObjectRecords(value: unknown): Array<Record<string, unknown>> {
  const entries = Array.isArray(value) ? value : value && typeof value === 'object' ? [value] : [];
  return entries.filter(
    (entry): entry is Record<string, unknown> =>
      Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry)
  );
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
  approvedWhereSql: string;
}> {
  const [hasClaimType, hasReviewStatus, hasSourceLabel, hasIsExplicit, hasStatus] =
    await Promise.all([
      hasColumn('organization_context_claims', 'claim_type').catch(() => false),
      hasColumn('organization_context_claims', 'review_status').catch(() => false),
      hasColumn('organization_context_items', 'source_label').catch(() => false),
      hasColumn('organization_context_items', 'is_explicit').catch(() => false),
      hasColumn('organization_context_claims', 'status').catch(() => false),
    ]);

  const activeWhereSql = hasStatus ? ` AND c.status = 'active'` : '';
  const approvedWhereSql = hasReviewStatus
    ? ` AND c.review_status IN ('accepted', 'approved')`
    : '';
  return {
    claimTypeSql: hasClaimType ? 'c.claim_type' : `'fact' as claim_type`,
    reviewStatusSql: hasReviewStatus ? 'c.review_status' : `'accepted' as review_status`,
    sourceLabelSql: hasSourceLabel ? 'i.source_label' : `NULL as source_label`,
    isExplicitSql: hasIsExplicit ? 'i.is_explicit' : '1 as is_explicit',
    activeWhereSql,
    approvedWhereSql: `${activeWhereSql}${approvedWhereSql}`,
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

function mergeUniqueObjects(current: unknown, next: unknown): Array<Record<string, unknown>> {
  const seen = new Set<string>();
  const merged: Array<Record<string, unknown>> = [];
  for (const entry of [...normalizeObjectRecords(current), ...normalizeObjectRecords(next)]) {
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
          claim.reviewStatus || 'accepted',
          now,
        ]
      );
    }

    if (input.rebuildSnapshot !== false) {
      await this.rebuildSnapshot(input.organizationId);
    }
    return { itemId: id };
  }

  async approveClaim(params: {
    organizationId: string;
    claimId: string;
    reviewerId: string;
    expectedReviewStatus?: string;
  }): Promise<{ claimId: string; reviewStatus: 'approved' }> {
    const row = await dbGet<{
      id: string;
      item_id: string;
      claim_path: string;
      value_json: string;
      review_status: string;
      visibility_scope: string | null;
    }>(
      `SELECT c.id, c.item_id, c.claim_path, c.value_json, c.review_status, i.visibility_scope
       FROM organization_context_claims c
       JOIN organization_context_items i
         ON i.id = c.item_id AND i.organization_id = c.organization_id
       WHERE c.id = ? AND c.organization_id = ? AND c.status = 'active'`,
      [params.claimId, params.organizationId]
    );
    if (!row) {
      throw new OrganizationContextPublicationError(
        'CLAIM_NOT_FOUND',
        'Claim or its source is unavailable in this organization'
      );
    }
    if (!['organization', 'public'].includes(String(row.visibility_scope || 'organization'))) {
      throw new OrganizationContextPublicationError(
        'CONFIDENTIAL_SOURCE',
        'Confidential or private sources cannot be published as organization context'
      );
    }
    if (row.review_status === 'approved') {
      return { claimId: row.id, reviewStatus: 'approved' };
    }
    const expected = params.expectedReviewStatus || 'proposed';
    if (row.review_status !== expected) {
      throw new OrganizationContextPublicationError(
        'STALE_REVIEW_STATUS',
        `Claim review status changed from ${expected} to ${row.review_status}`
      );
    }
    const conflict = await dbGet<{ id: string }>(
      `SELECT c.id
       FROM organization_context_claims c
       JOIN organization_context_items i
         ON i.id = c.item_id AND i.organization_id = c.organization_id
       WHERE c.organization_id = ?
         AND c.id <> ?
         AND c.claim_path = ?
         AND c.value_json <> ?
         AND c.status = 'active'
         AND c.review_status IN ('accepted', 'approved')
         AND COALESCE(i.visibility_scope, 'organization') IN ('organization', 'public')
       LIMIT 1`,
      [params.organizationId, params.claimId, row.claim_path, row.value_json]
    );
    if (conflict) {
      throw new OrganizationContextPublicationError(
        'CLAIM_CONFLICT',
        `An approved value already exists for ${row.claim_path}`
      );
    }

    await dbRun(
      `UPDATE organization_context_claims
       SET review_status = 'approved', reviewed_by = ?, reviewed_at = ?, updated_at = ?
       WHERE id = ? AND organization_id = ? AND review_status = ? AND status = 'active'`,
      [
        params.reviewerId,
        new Date().toISOString(),
        new Date().toISOString(),
        params.claimId,
        params.organizationId,
        expected,
      ]
    );
    return { claimId: params.claimId, reviewStatus: 'approved' };
  }

  async publishSnapshot(params: {
    organizationId: string;
    createdBy: string;
  }): Promise<PublishedOrganizationContextSnapshot> {
    const claimRows = await dbAll<{
      claim_id: string;
      item_id: string;
      claim_path: string;
      confidence: number;
      source_type: string | null;
      source_id: string | null;
      visibility_scope: string | null;
    }>(
      `SELECT c.id AS claim_id, c.item_id, c.claim_path, c.confidence,
              i.source_type, i.source_id, i.visibility_scope
       FROM organization_context_claims c
       LEFT JOIN organization_context_items i
         ON i.id = c.item_id AND i.organization_id = c.organization_id
       WHERE c.organization_id = ?
         AND c.status = 'active'
         AND c.review_status IN ('accepted', 'approved')
       ORDER BY c.created_at, c.id`,
      [params.organizationId]
    );
    const missingSource = claimRows.find((row) => !row.source_type);
    if (missingSource) {
      throw new OrganizationContextPublicationError(
        'SOURCE_UNAVAILABLE',
        `Approved claim ${missingSource.claim_id} no longer has a source`
      );
    }
    const confidentialSource = claimRows.find(
      (row) => !['organization', 'public'].includes(String(row.visibility_scope || 'organization'))
    );
    if (confidentialSource) {
      throw new OrganizationContextPublicationError(
        'CONFIDENTIAL_SOURCE',
        `Approved claim ${confidentialSource.claim_id} references a non-publishable source`
      );
    }

    const context = await this.buildResolvedContext(params.organizationId);
    if (context.conflicts.length > 0) {
      throw new OrganizationContextPublicationError(
        'CLAIM_CONFLICT',
        'Organization context contains unresolved approved claim conflicts'
      );
    }
    const snapshotId = uuidv4();
    const createdAt = new Date().toISOString();
    const sourceRefs: OrganizationContextSourceRef[] = claimRows.map((row) => ({
      claimId: row.claim_id,
      itemId: row.item_id,
      sourceType: String(row.source_type),
      sourceId: row.source_id || null,
      claimPath: row.claim_path,
      confidence: Number(row.confidence || 0),
    }));
    const immutablePayload = {
      snapshotId,
      organizationId: params.organizationId,
      schemaVersion: ORGANIZATION_CONTEXT_SCHEMA_VERSION,
      sourceRefs,
      context,
      createdBy: params.createdBy,
      createdAt,
    };
    const contentHash = createHash('sha256').update(JSON.stringify(immutablePayload)).digest('hex');
    await dbRun(
      `INSERT INTO organization_context_publications
       (id, organization_id, schema_version, snapshot_json, source_refs_json, content_hash, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        snapshotId,
        params.organizationId,
        ORGANIZATION_CONTEXT_SCHEMA_VERSION,
        JSON.stringify(immutablePayload),
        JSON.stringify(sourceRefs),
        contentHash,
        params.createdBy,
        createdAt,
      ]
    );
    return { ...immutablePayload, contentHash };
  }

  async getPublishedSnapshot(
    organizationId: string,
    snapshotId?: string
  ): Promise<PublishedOrganizationContextSnapshot | null> {
    const row = await dbGet<{
      id: string;
      organization_id: string;
      schema_version: number;
      snapshot_json: string;
      source_refs_json: string;
      content_hash: string;
      created_by: string;
      created_at: string;
    }>(
      `SELECT id, organization_id, schema_version, snapshot_json, source_refs_json,
              content_hash, created_by, created_at
       FROM organization_context_publications
       WHERE organization_id = ?${snapshotId ? ' AND id = ?' : ''}
       ORDER BY created_at DESC
       LIMIT 1`,
      snapshotId ? [organizationId, snapshotId] : [organizationId]
    );
    if (!row) return null;
    const payload = safeParseJson<Record<string, unknown>>(row.snapshot_json, {});
    return {
      snapshotId: row.id,
      organizationId: row.organization_id,
      schemaVersion: Number(row.schema_version),
      contentHash: row.content_hash,
      sourceRefs: safeParseJson<OrganizationContextSourceRef[]>(row.source_refs_json, []),
      context: payload.context as ResolvedOrganizationContext,
      createdBy: row.created_by,
      createdAt: row.created_at,
    };
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
        `SELECT COUNT(*) as count FROM organization_context_claims c WHERE c.organization_id = ?${claimShape.approvedWhereSql}`,
        [organizationId]
      ),
      safeAll<ClaimRow>(
        `SELECT c.id, c.item_id, c.claim_path, c.value_json, c.confidence, ${claimShape.claimTypeSql}, ${claimShape.reviewStatusSql}, c.created_at,
                i.source_type, ${claimShape.sourceLabelSql}, i.created_at as item_created_at, ${claimShape.isExplicitSql}
         FROM organization_context_claims c
         JOIN organization_context_items i ON i.id = c.item_id
         WHERE c.organization_id = ?${claimShape.approvedWhereSql}
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

    const legacyKeyMetrics = safeParseJson<unknown>(interviewContext?.key_metrics, []);
    const legacyStakeholders = safeParseJson<unknown>(interviewContext?.stakeholders, []);
    const legacyGaps = safeParseJson<unknown>(interviewContext?.open_gaps, []);
    const legacyStrategicPriorities = normalizeArrayOfStrings(
      safeParseJson<unknown>(organizationProfile?.strategic_priorities, [])
    );
    const legacyTechStack = normalizeArrayOfStrings(
      safeParseJson<unknown>(organizationProfile?.technology_stack, [])
    );

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
      }).map((claim) => ({ ...claim, reviewStatus: 'proposed' })),
      rebuildSnapshot: false,
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
