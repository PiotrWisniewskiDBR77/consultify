/**
 * Enterprise Compliance API client (F-CC2, blok Harvey-Parity HP-10…13).
 *
 * Typowany klient dla 16 endpointów `/api/admin/enterprise-compliance/*`
 * (mount: `server/src/Gateway.ts:593`, router:
 * `server/src/routes/admin/enterprise-compliance.routes.ts`).
 * Gate backendu: rola `super_admin|administrator|owner`; org brana
 * WYŁĄCZNIE z tokenu (`req.user.organizationId`) — front nigdy nie
 * przekazuje `organizationId` (org-scoping = token, nie frontend).
 *
 * Wszystkie odpowiedzi mają kopertę `{ success: boolean; data?: T }`.
 * Typy `data` odwzorowują 1:1 interfejsy serwisów backendu:
 *   - soc2AuditTrailService  (AuditEntry, cost attribution)
 *   - advancedDlpService     (DlpRule, DlpScanResult)
 *   - dataResidencyService   (DataResidencyPolicy)
 *   - retentionAutomationService (RetentionSchedule, RetentionResult)
 *   - orgAiPolicyService     (OrgAiPolicy)
 */
import { apiDelete, apiGet, apiPost, apiPut } from './api/baseClient';

const BASE = '/admin/enterprise-compliance';

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
}

// ── SOC2 Audit Trail ─────────────────────────────────────────────────────

export interface AuditEntry {
  id: string;
  organizationId: string;
  userId?: string;
  conversationId?: string;
  messageId?: string;
  eventType: string;
  requestHash: string;
  responseHash: string;
  modelId?: string;
  tokensInput: number;
  tokensOutput: number;
  costUsd: number;
  latencyMs: number;
  policyDecisions: Array<{ policy: string; decision: string; reason?: string }>;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AuditExportResult {
  entries: AuditEntry[];
  totalCount: number;
  exportedAt: string;
}

export interface AuditExportFilters {
  from?: string;
  to?: string;
  userId?: string;
  eventType?: string;
}

export interface CostAttributionResult {
  totalCost: number;
  byUser: Array<{ userId: string; cost: number; messageCount: number }>;
  byModel: Array<{ modelId: string; cost: number; tokenCount: number }>;
  byDay: Array<{ date: string; cost: number }>;
}

export interface CostAttributionFilters {
  from?: string;
  to?: string;
}

function buildQuery(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export async function getComplianceAuditExport(
  filters: AuditExportFilters = {}
): Promise<AuditExportResult> {
  const qs = buildQuery({
    from: filters.from,
    to: filters.to,
    user_id: filters.userId,
    event_type: filters.eventType,
  });
  const res = await apiGet<ApiEnvelope<AuditExportResult>>(
    `${BASE}/audit-trail/export${qs}`,
    'Failed to export SOC2 audit trail'
  );
  return res.data as AuditExportResult;
}

export async function getComplianceCostAttribution(
  filters: CostAttributionFilters = {}
): Promise<CostAttributionResult> {
  const qs = buildQuery({ from: filters.from, to: filters.to });
  const res = await apiGet<ApiEnvelope<CostAttributionResult>>(
    `${BASE}/audit-trail/cost-attribution${qs}`,
    'Failed to load cost attribution'
  );
  return res.data as CostAttributionResult;
}

// ── DLP Rules ─────────────────────────────────────────────────────────────

export interface DlpRule {
  id: string;
  organizationId: string;
  ruleName: string;
  ruleType: 'regex' | 'keyword' | 'entity';
  pattern: string;
  action: 'block' | 'redact' | 'warn' | 'log';
  appliesTo: 'input' | 'output' | 'both';
  severity: 'low' | 'medium' | 'high' | 'critical';
  isActive: boolean;
}

export interface DlpRuleInput {
  ruleName: string;
  ruleType: DlpRule['ruleType'];
  pattern: string;
  action: DlpRule['action'];
  appliesTo: DlpRule['appliesTo'];
  severity: DlpRule['severity'];
}

export interface DlpScanResult {
  clean: boolean;
  violations: Array<{
    ruleId: string;
    ruleName: string;
    severity: string;
    action: string;
    matchedPattern: string;
    matchedText: string;
  }>;
  sanitizedContent?: string;
  blocked: boolean;
}

export async function getDlpRules(): Promise<DlpRule[]> {
  const res = await apiGet<ApiEnvelope<DlpRule[]>>(`${BASE}/dlp/rules`, 'Failed to load DLP rules');
  return res.data || [];
}

export async function createDlpRule(input: DlpRuleInput): Promise<DlpRule> {
  const res = await apiPost<ApiEnvelope<DlpRule>>(
    `${BASE}/dlp/rules`,
    input,
    'Failed to create DLP rule'
  );
  return res.data as DlpRule;
}

export async function toggleDlpRule(ruleId: string, isActive: boolean): Promise<void> {
  await apiPut<ApiEnvelope<never>>(
    `${BASE}/dlp/rules/${encodeURIComponent(ruleId)}/toggle`,
    { isActive },
    'Failed to toggle DLP rule'
  );
}

export async function deleteDlpRule(ruleId: string): Promise<void> {
  await apiDelete<ApiEnvelope<never>>(
    `${BASE}/dlp/rules/${encodeURIComponent(ruleId)}`,
    'Failed to delete DLP rule'
  );
}

export async function scanDlpContent(
  content: string,
  direction: 'input' | 'output' | 'both' = 'both'
): Promise<DlpScanResult> {
  const res = await apiPost<ApiEnvelope<DlpScanResult>>(
    `${BASE}/dlp/scan`,
    { content, direction },
    'Failed to run DLP scan'
  );
  return res.data as DlpScanResult;
}

// ── Data Residency ────────────────────────────────────────────────────────

export interface DataResidencyPolicy {
  enforceEuOnly: boolean;
  dataResidencyRegion: string | null;
  allowedRegions: string[];
  deniedRegions: string[];
}

export async function getDataResidency(): Promise<DataResidencyPolicy> {
  const res = await apiGet<ApiEnvelope<DataResidencyPolicy>>(
    `${BASE}/data-residency`,
    'Failed to load data residency policy'
  );
  return res.data as DataResidencyPolicy;
}

export async function setDataResidency(
  policy: Partial<DataResidencyPolicy>
): Promise<DataResidencyPolicy> {
  const res = await apiPut<ApiEnvelope<DataResidencyPolicy>>(
    `${BASE}/data-residency`,
    policy,
    'Failed to update data residency policy'
  );
  return res.data as DataResidencyPolicy;
}

// ── Retention ─────────────────────────────────────────────────────────────

export interface RetentionSchedule {
  id: string;
  organizationId: string;
  dataType: string;
  retentionDays: number;
  nextCleanupAt: string | null;
  lastCleanupAt: string | null;
  itemsDeletedTotal: number;
  notificationSent: boolean;
  isActive: boolean;
}

export interface RetentionResult {
  organizationId: string;
  dataType: string;
  itemsDeleted: number;
  preservedCount: number;
  errors: string[];
}

export async function getRetentionSchedules(): Promise<RetentionSchedule[]> {
  const res = await apiGet<ApiEnvelope<RetentionSchedule[]>>(
    `${BASE}/retention/schedules`,
    'Failed to load retention schedules'
  );
  return res.data || [];
}

export async function initializeRetentionSchedules(): Promise<RetentionSchedule[]> {
  const res = await apiPost<ApiEnvelope<RetentionSchedule[]>>(
    `${BASE}/retention/initialize`,
    {},
    'Failed to initialize retention schedules'
  );
  return res.data || [];
}

export async function updateRetentionSchedule(
  scheduleId: string,
  patch: Partial<Pick<RetentionSchedule, 'retentionDays' | 'isActive'>>
): Promise<void> {
  await apiPut<ApiEnvelope<never>>(
    `${BASE}/retention/schedules/${encodeURIComponent(scheduleId)}`,
    patch,
    'Failed to update retention schedule'
  );
}

export async function executeRetention(): Promise<RetentionResult[]> {
  const res = await apiPost<ApiEnvelope<RetentionResult[]>>(
    `${BASE}/retention/execute`,
    {},
    'Failed to execute retention'
  );
  return res.data || [];
}

export async function preserveRetentionConversation(
  conversationId: string,
  reason?: string
): Promise<void> {
  await apiPost<ApiEnvelope<never>>(
    `${BASE}/retention/preserve/${encodeURIComponent(conversationId)}`,
    { reason },
    'Failed to preserve conversation from retention'
  );
}

// ── Org AI Policy ─────────────────────────────────────────────────────────

export interface OrgAiPolicy {
  organizationId: string;
  allowedTopics: string[];
  blockedTopics: string[];
  maxTokensPerConversation: number;
  maxTokensPerMessage: number;
  mandatoryDisclaimers: string[];
  requiredCitationMode: 'none' | 'recommended' | 'required' | 'strict';
  blockedTools: string[];
  allowedModels: string[];
  dataResidencyRegion: string | null;
  enforceEuOnly: boolean;
  customSafetyRules: Array<{ name: string; pattern: string; action: string }>;
}

export async function getAiPolicy(): Promise<OrgAiPolicy> {
  const res = await apiGet<ApiEnvelope<OrgAiPolicy>>(
    `${BASE}/ai-policy`,
    'Failed to load org AI policy'
  );
  return res.data as OrgAiPolicy;
}

export async function setAiPolicy(policy: Partial<OrgAiPolicy>): Promise<OrgAiPolicy> {
  const res = await apiPut<ApiEnvelope<OrgAiPolicy>>(
    `${BASE}/ai-policy`,
    policy,
    'Failed to update org AI policy'
  );
  return res.data as OrgAiPolicy;
}

export const EnterpriseComplianceApi = {
  getComplianceAuditExport,
  getComplianceCostAttribution,
  getDlpRules,
  createDlpRule,
  toggleDlpRule,
  deleteDlpRule,
  scanDlpContent,
  getDataResidency,
  setDataResidency,
  getRetentionSchedules,
  initializeRetentionSchedules,
  updateRetentionSchedule,
  executeRetention,
  preserveRetentionConversation,
  getAiPolicy,
  setAiPolicy,
};

export default EnterpriseComplianceApi;
