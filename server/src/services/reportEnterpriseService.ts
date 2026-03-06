/**
 * Report Enterprise Service (V4-RPT-01 through V4-RPT-06)
 *
 * V4-RPT-01: Source Pack Builder (artifact picker, upload bundle, citations)
 * V4-RPT-02: Data bindings (KPI/finance dataset refs, refresh, diff, approval)
 * V4-RPT-03: Template system (variables, versioning, governance)
 * V4-RPT-04: Brand voice (policy, forbidden phrases, source requirement)
 * V4-RPT-05: Per-block AI propose → accept (diff, citations, audit)
 * V4-RPT-06: Scheduled distribution (approval gates, recipient policies, delivery proof)
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import * as queryHelpers from '../utils/queryHelpers.js';

// ============================================================
// Types
// ============================================================

export interface SourcePack {
  id: string;
  reportId: string;
  name: string;
  description: string | null;
  artifacts: unknown[];
  citationPolicy: string;
  status: string;
}

export interface DataBinding {
  id: string;
  reportId: string;
  sectionId: string;
  bindingType: string;
  datasetRef: string;
  lastRefreshAt: string | null;
  lastValue: string | null;
  previousValue: string | null;
  diffData: Record<string, unknown>;
  approvalStatus: string;
}

export interface ReportTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string;
  variables: unknown[];
  version: number;
  status: string;
  governanceLevel: string;
}

export interface BrandVoicePolicy {
  id: string;
  policyName: string;
  tone: string;
  forbiddenPhrases: string[];
  requiredSourceCitation: boolean;
  noMarketingLanguage: boolean;
  customRules: unknown[];
  isActive: boolean;
}

export interface AIProposal {
  id: string;
  reportId: string;
  sectionId: string | null;
  blockId: string | null;
  proposedContent: string;
  originalContent: string | null;
  diffPreview: Record<string, unknown>;
  citations: unknown[];
  status: string;
}

export interface DistributionSchedule {
  id: string;
  reportId: string;
  scheduleCron: string | null;
  sendAt: string | null;
  recipientPolicy: Record<string, unknown>;
  approvalRequired: boolean;
  approvalStatus: string;
  status: string;
}

// ============================================================
// Service
// ============================================================

class ReportEnterpriseService {
  private db: IDatabase | null = null;

  private async getDb(): Promise<IDatabase> {
    if (!this.db) this.db = await getDatabase();
    return this.db;
  }

  // ──────────────────────────────────────────────
  // V4-RPT-01: Source Packs
  // ──────────────────────────────────────────────

  async createSourcePack(orgId: string, userId: string, data: {
    reportId: string; name: string; description?: string; citationPolicy?: string;
  }): Promise<SourcePack> {
    const id = uuidv4();
    const now = new Date().toISOString();
    await queryHelpers.queryRun(
      `INSERT INTO report_source_packs (id, organization_id, report_id, name, description, citation_policy, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, orgId, data.reportId, data.name, data.description || null, data.citationPolicy || 'recommended', userId, now, now]
    );
    return { id, reportId: data.reportId, name: data.name, description: data.description || null, artifacts: [], citationPolicy: data.citationPolicy || 'recommended', status: 'draft' };
  }

  async addSourcePackItem(orgId: string, sourcePackId: string, data: {
    artifactType: string; artifactId: string; artifactTitle?: string; citationLabel?: string; sortOrder?: number;
  }): Promise<{ id: string }> {
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO report_source_pack_items (id, source_pack_id, artifact_type, artifact_id, artifact_title, citation_label, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, sourcePackId, data.artifactType, data.artifactId, data.artifactTitle || null, data.citationLabel || null, data.sortOrder || 0]
    );
    return { id };
  }

  async getSourcePacks(orgId: string, reportId: string): Promise<SourcePack[]> {
    const rows = (await queryHelpers.queryAll<any>(
      `SELECT * FROM report_source_packs WHERE organization_id = ? AND report_id = ? ORDER BY created_at`,
      [orgId, reportId]
    )) || [];
    return rows.map((r: any) => ({
      id: r.id, reportId: r.report_id, name: r.name, description: r.description,
      artifacts: safeJsonArray(r.artifacts), citationPolicy: r.citation_policy, status: r.status,
    }));
  }

  async getSourcePackItems(sourcePackId: string) {
    const rows = (await queryHelpers.queryAll<any>(
      `SELECT * FROM report_source_pack_items WHERE source_pack_id = ? ORDER BY sort_order`,
      [sourcePackId]
    )) || [];
    return rows.map((r: any) => ({
      id: r.id, artifactType: r.artifact_type, artifactId: r.artifact_id,
      artifactTitle: r.artifact_title, citationLabel: r.citation_label, sortOrder: r.sort_order,
    }));
  }

  // ──────────────────────────────────────────────
  // V4-RPT-02: Data bindings
  // ──────────────────────────────────────────────

  async createDataBinding(orgId: string, data: {
    reportId: string; sectionId: string; bindingType?: string; datasetRef: string;
  }): Promise<DataBinding> {
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO report_data_bindings (id, organization_id, report_id, section_id, binding_type, dataset_ref)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, orgId, data.reportId, data.sectionId, data.bindingType || 'kpi', data.datasetRef]
    );
    return { id, reportId: data.reportId, sectionId: data.sectionId, bindingType: data.bindingType || 'kpi', datasetRef: data.datasetRef, lastRefreshAt: null, lastValue: null, previousValue: null, diffData: {}, approvalStatus: 'auto' };
  }

  async refreshDataBinding(orgId: string, bindingId: string, newValue: string): Promise<boolean> {
    const current = await queryHelpers.queryOne<any>(
      `SELECT last_value FROM report_data_bindings WHERE id = ? AND organization_id = ?`,
      [bindingId, orgId]
    );
    if (!current) return false;

    const diff = current.last_value ? { previous: current.last_value, current: newValue, changed: current.last_value !== newValue } : {};
    const now = new Date().toISOString();
    await queryHelpers.queryRun(
      `UPDATE report_data_bindings SET previous_value = last_value, last_value = ?, diff_data = ?, last_refresh_at = ?, approval_status = CASE WHEN last_value != ? THEN 'pending' ELSE approval_status END WHERE id = ? AND organization_id = ?`,
      [newValue, JSON.stringify(diff), now, newValue, bindingId, orgId]
    );
    return true;
  }

  async approveDataBinding(orgId: string, bindingId: string, userId: string): Promise<boolean> {
    const result = await queryHelpers.queryRun(
      `UPDATE report_data_bindings SET approval_status = 'approved', approved_by = ?, approved_at = ? WHERE id = ? AND organization_id = ?`,
      [userId, new Date().toISOString(), bindingId, orgId]
    );
    return (result?.changes || 0) > 0;
  }

  async getDataBindings(orgId: string, reportId: string): Promise<DataBinding[]> {
    const rows = (await queryHelpers.queryAll<any>(
      `SELECT * FROM report_data_bindings WHERE organization_id = ? AND report_id = ? ORDER BY created_at`,
      [orgId, reportId]
    )) || [];
    return rows.map((r: any) => ({
      id: r.id, reportId: r.report_id, sectionId: r.section_id, bindingType: r.binding_type,
      datasetRef: r.dataset_ref, lastRefreshAt: r.last_refresh_at, lastValue: r.last_value,
      previousValue: r.previous_value, diffData: safeJson(r.diff_data), approvalStatus: r.approval_status,
    }));
  }

  // ──────────────────────────────────────────────
  // V4-RPT-03: Templates
  // ──────────────────────────────────────────────

  async createTemplate(orgId: string, userId: string, data: {
    name: string; description?: string; category?: string; templateData: Record<string, unknown>;
    variables?: unknown[]; governanceLevel?: string;
  }): Promise<ReportTemplate> {
    const id = uuidv4();
    const now = new Date().toISOString();
    await queryHelpers.queryRun(
      `INSERT INTO report_templates (id, organization_id, name, description, category, template_data, variables, governance_level, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, orgId, data.name, data.description || null, data.category || 'general', JSON.stringify(data.templateData), JSON.stringify(data.variables || []), data.governanceLevel || 'org', userId, now, now]
    );
    return { id, name: data.name, description: data.description || null, category: data.category || 'general', variables: data.variables || [], version: 1, status: 'draft', governanceLevel: data.governanceLevel || 'org' };
  }

  async publishTemplate(orgId: string, templateId: string, userId: string): Promise<boolean> {
    const tpl = await queryHelpers.queryOne<any>(
      `SELECT * FROM report_templates WHERE id = ? AND organization_id = ?`,
      [templateId, orgId]
    );
    if (!tpl) return false;

    const newVersion = (tpl.version || 1) + 1;
    await queryHelpers.queryRun(
      `INSERT INTO report_template_versions (id, template_id, version, template_data, variables, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [uuidv4(), templateId, tpl.version, tpl.template_data, tpl.variables, userId]
    );

    await queryHelpers.queryRun(
      `UPDATE report_templates SET status = 'published', version = ?, updated_at = ? WHERE id = ? AND organization_id = ?`,
      [newVersion, new Date().toISOString(), templateId, orgId]
    );
    return true;
  }

  async getTemplates(orgId: string): Promise<ReportTemplate[]> {
    const rows = (await queryHelpers.queryAll<any>(
      `SELECT * FROM report_templates WHERE (organization_id = ? OR organization_id IS NULL) ORDER BY created_at DESC`,
      [orgId]
    )) || [];
    return rows.map((r: any) => ({
      id: r.id, name: r.name, description: r.description, category: r.category,
      variables: safeJsonArray(r.variables), version: r.version, status: r.status,
      governanceLevel: r.governance_level,
    }));
  }

  async getTemplateVersions(templateId: string) {
    const rows = (await queryHelpers.queryAll<any>(
      `SELECT * FROM report_template_versions WHERE template_id = ? ORDER BY version DESC`,
      [templateId]
    )) || [];
    return rows.map((r: any) => ({
      id: r.id, version: r.version, changelog: r.changelog,
      createdBy: r.created_by, createdAt: r.created_at,
    }));
  }

  // ──────────────────────────────────────────────
  // V4-RPT-04: Brand voice
  // ──────────────────────────────────────────────

  async createBrandVoicePolicy(orgId: string, userId: string, data: {
    policyName: string; tone?: string; forbiddenPhrases?: string[];
    requiredSourceCitation?: boolean; noMarketingLanguage?: boolean; customRules?: unknown[];
  }): Promise<BrandVoicePolicy> {
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO report_brand_voice_policies (id, organization_id, policy_name, tone, forbidden_phrases, required_source_citation, no_marketing_language, custom_rules, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, orgId, data.policyName, data.tone || 'professional', JSON.stringify(data.forbiddenPhrases || []), data.requiredSourceCitation ? 1 : 0, data.noMarketingLanguage ? 1 : 0, JSON.stringify(data.customRules || []), userId]
    );
    return {
      id, policyName: data.policyName, tone: data.tone || 'professional',
      forbiddenPhrases: data.forbiddenPhrases || [],
      requiredSourceCitation: data.requiredSourceCitation || false,
      noMarketingLanguage: data.noMarketingLanguage || false,
      customRules: data.customRules || [], isActive: true,
    };
  }

  async getBrandVoicePolicies(orgId: string): Promise<BrandVoicePolicy[]> {
    const rows = (await queryHelpers.queryAll<any>(
      `SELECT * FROM report_brand_voice_policies WHERE organization_id = ? ORDER BY created_at DESC`,
      [orgId]
    )) || [];
    return rows.map((r: any) => ({
      id: r.id, policyName: r.policy_name, tone: r.tone,
      forbiddenPhrases: safeJsonArray(r.forbidden_phrases) as string[],
      requiredSourceCitation: !!r.required_source_citation,
      noMarketingLanguage: !!r.no_marketing_language,
      customRules: safeJsonArray(r.custom_rules), isActive: !!r.is_active,
    }));
  }

  async validateAgainstBrandVoice(orgId: string, text: string): Promise<{
    violations: Array<{ rule: string; snippet: string }>;
    passed: boolean;
  }> {
    const policies = await this.getBrandVoicePolicies(orgId);
    const activePolicy = policies.find(p => p.isActive);
    if (!activePolicy) return { violations: [], passed: true };

    const violations: Array<{ rule: string; snippet: string }> = [];
    const lowerText = text.toLowerCase();

    for (const phrase of activePolicy.forbiddenPhrases) {
      if (lowerText.includes(phrase.toLowerCase())) {
        violations.push({ rule: `Forbidden phrase: "${phrase}"`, snippet: phrase });
      }
    }

    if (activePolicy.noMarketingLanguage) {
      const marketingTerms = ['revolutionary', 'game-changing', 'world-class', 'best-in-class', 'cutting-edge', 'synergy', 'paradigm shift'];
      for (const term of marketingTerms) {
        if (lowerText.includes(term)) {
          violations.push({ rule: 'No marketing language', snippet: term });
        }
      }
    }

    return { violations, passed: violations.length === 0 };
  }

  // ──────────────────────────────────────────────
  // V4-RPT-05: AI proposals
  // ──────────────────────────────────────────────

  async createAIProposal(orgId: string, data: {
    reportId: string; sectionId?: string; blockId?: string;
    proposedContent: string; originalContent?: string; citations?: unknown[]; aiModelUsed?: string;
  }): Promise<AIProposal> {
    const id = uuidv4();
    const diff = data.originalContent
      ? { hasChanges: true, originalLength: data.originalContent.length, proposedLength: data.proposedContent.length }
      : {};

    await queryHelpers.queryRun(
      `INSERT INTO report_ai_proposals (id, organization_id, report_id, section_id, block_id, proposed_content, original_content, diff_preview, citations, ai_model_used)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, orgId, data.reportId, data.sectionId || null, data.blockId || null, data.proposedContent, data.originalContent || null, JSON.stringify(diff), JSON.stringify(data.citations || []), data.aiModelUsed || null]
    );
    return {
      id, reportId: data.reportId, sectionId: data.sectionId || null,
      blockId: data.blockId || null, proposedContent: data.proposedContent,
      originalContent: data.originalContent || null, diffPreview: diff as Record<string, unknown>,
      citations: data.citations || [], status: 'proposed',
    };
  }

  async resolveAIProposal(orgId: string, proposalId: string, userId: string, action: 'accept' | 'reject'): Promise<boolean> {
    const result = await queryHelpers.queryRun(
      `UPDATE report_ai_proposals SET status = ?, resolved_by = ?, resolved_at = ? WHERE id = ? AND organization_id = ?`,
      [action === 'accept' ? 'accepted' : 'rejected', userId, new Date().toISOString(), proposalId, orgId]
    );
    return (result?.changes || 0) > 0;
  }

  async getAIProposals(orgId: string, reportId: string, status?: string): Promise<AIProposal[]> {
    const conditions = ['organization_id = ?', 'report_id = ?'];
    const params: unknown[] = [orgId, reportId];
    if (status) { conditions.push('status = ?'); params.push(status); }
    const rows = (await queryHelpers.queryAll<any>(
      `SELECT * FROM report_ai_proposals WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`,
      params
    )) || [];
    return rows.map((r: any) => ({
      id: r.id, reportId: r.report_id, sectionId: r.section_id, blockId: r.block_id,
      proposedContent: r.proposed_content, originalContent: r.original_content,
      diffPreview: safeJson(r.diff_preview), citations: safeJsonArray(r.citations), status: r.status,
    }));
  }

  // ──────────────────────────────────────────────
  // V4-RPT-06: Distribution
  // ──────────────────────────────────────────────

  async createDistributionSchedule(orgId: string, userId: string, data: {
    reportId: string; scheduleCron?: string; sendAt?: string;
    recipientPolicy: Record<string, unknown>; approvalRequired?: boolean;
  }): Promise<DistributionSchedule> {
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO report_distribution_schedules (id, organization_id, report_id, schedule_cron, send_at, recipient_policy, approval_required, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, orgId, data.reportId, data.scheduleCron || null, data.sendAt || null, JSON.stringify(data.recipientPolicy), data.approvalRequired ? 1 : 0, userId]
    );
    return {
      id, reportId: data.reportId, scheduleCron: data.scheduleCron || null,
      sendAt: data.sendAt || null, recipientPolicy: data.recipientPolicy,
      approvalRequired: data.approvalRequired || false, approvalStatus: 'pending', status: 'active',
    };
  }

  async approveDistribution(orgId: string, scheduleId: string, userId: string): Promise<boolean> {
    const result = await queryHelpers.queryRun(
      `UPDATE report_distribution_schedules SET approval_status = 'approved', approved_by = ?, approved_at = ? WHERE id = ? AND organization_id = ?`,
      [userId, new Date().toISOString(), scheduleId, orgId]
    );
    return (result?.changes || 0) > 0;
  }

  async getDistributionSchedules(orgId: string, reportId: string): Promise<DistributionSchedule[]> {
    const rows = (await queryHelpers.queryAll<any>(
      `SELECT * FROM report_distribution_schedules WHERE organization_id = ? AND report_id = ? ORDER BY created_at DESC`,
      [orgId, reportId]
    )) || [];
    return rows.map((r: any) => ({
      id: r.id, reportId: r.report_id, scheduleCron: r.schedule_cron,
      sendAt: r.send_at, recipientPolicy: safeJson(r.recipient_policy),
      approvalRequired: !!r.approval_required, approvalStatus: r.approval_status, status: r.status,
    }));
  }

  async logDistribution(orgId: string, data: {
    scheduleId: string; reportId: string; recipientEmail: string; channel?: string;
  }): Promise<{ id: string }> {
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO report_distribution_log (id, organization_id, schedule_id, report_id, recipient_email, channel)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, orgId, data.scheduleId, data.reportId, data.recipientEmail, data.channel || 'email']
    );
    return { id };
  }

  async getDistributionLog(orgId: string, scheduleId: string) {
    const rows = (await queryHelpers.queryAll<any>(
      `SELECT * FROM report_distribution_log WHERE organization_id = ? AND schedule_id = ? ORDER BY created_at DESC`,
      [orgId, scheduleId]
    )) || [];
    return rows.map((r: any) => ({
      id: r.id, recipientEmail: r.recipient_email, channel: r.channel,
      status: r.status, deliveredAt: r.delivered_at, openedAt: r.opened_at,
      errorMessage: r.error_message, createdAt: r.created_at,
    }));
  }
}

// ============================================================
// Helpers
// ============================================================

function safeJson(val: unknown): Record<string, unknown> {
  if (!val) return {};
  try { return typeof val === 'string' ? JSON.parse(val) : (val as Record<string, unknown>); }
  catch { return {}; }
}

function safeJsonArray(val: unknown): unknown[] {
  if (!val) return [];
  try { return typeof val === 'string' ? JSON.parse(val) : (val as unknown[]); }
  catch { return []; }
}

const reportEnterpriseService = new ReportEnterpriseService();
export default reportEnterpriseService;
export { ReportEnterpriseService, reportEnterpriseService };
