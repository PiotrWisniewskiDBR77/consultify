/**
 * Organization AI Policy Service
 *
 * Admin-configurable AI policies per organization:
 * - Allowed/blocked topics
 * - Max tokens per conversation/message
 * - Mandatory disclaimers
 * - Required citation mode
 * - Blocked tools
 * - Allowed models
 */
import { randomUUID } from 'node:crypto';

import { get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

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

const DEFAULT_POLICY: OrgAiPolicy = {
  organizationId: '',
  allowedTopics: [],
  blockedTopics: [],
  maxTokensPerConversation: 50000,
  maxTokensPerMessage: 8000,
  mandatoryDisclaimers: [],
  requiredCitationMode: 'recommended',
  blockedTools: [],
  allowedModels: [],
  dataResidencyRegion: null,
  enforceEuOnly: false,
  customSafetyRules: [],
};

class OrgAiPolicyService {
  async getPolicy(organizationId: string): Promise<OrgAiPolicy> {
    const row = await dbGet(
      `SELECT * FROM organization_ai_config WHERE organization_id = ?`,
      [organizationId]
    ).catch(() => null) as any;

    if (!row) return { ...DEFAULT_POLICY, organizationId };

    return {
      organizationId,
      allowedTopics: safeParseArr(row.allowed_topics),
      blockedTopics: safeParseArr(row.blocked_topics),
      maxTokensPerConversation: Number(row.max_tokens_per_conversation) || 50000,
      maxTokensPerMessage: Number(row.max_tokens_per_message) || 8000,
      mandatoryDisclaimers: safeParseArr(row.mandatory_disclaimers),
      requiredCitationMode: row.required_citation_mode || 'recommended',
      blockedTools: safeParseArr(row.blocked_tools),
      allowedModels: safeParseArr(row.allowed_models),
      dataResidencyRegion: row.data_residency_region || null,
      enforceEuOnly: Boolean(row.enforce_eu_only),
      customSafetyRules: safeParseArr(row.custom_safety_rules),
    };
  }

  async updatePolicy(
    organizationId: string,
    updates: Partial<OrgAiPolicy>,
    updatedBy: string
  ): Promise<OrgAiPolicy> {
    const existing = await this.getPolicy(organizationId);

    const merged: OrgAiPolicy = {
      ...existing,
      ...updates,
      organizationId,
    };

    const existingRow = await dbGet(
      `SELECT id FROM organization_ai_config WHERE organization_id = ?`,
      [organizationId]
    );

    if (existingRow) {
      await dbRun(
        `UPDATE organization_ai_config SET
           allowed_topics = ?,
           blocked_topics = ?,
           max_tokens_per_conversation = ?,
           max_tokens_per_message = ?,
           mandatory_disclaimers = ?,
           required_citation_mode = ?,
           blocked_tools = ?,
           allowed_models = ?,
           data_residency_region = ?,
           enforce_eu_only = ?,
           custom_safety_rules = ?,
           updated_by = ?,
           updated_at = datetime('now')
         WHERE organization_id = ?`,
        [
          JSON.stringify(merged.allowedTopics),
          JSON.stringify(merged.blockedTopics),
          merged.maxTokensPerConversation,
          merged.maxTokensPerMessage,
          JSON.stringify(merged.mandatoryDisclaimers),
          merged.requiredCitationMode,
          JSON.stringify(merged.blockedTools),
          JSON.stringify(merged.allowedModels),
          merged.dataResidencyRegion,
          merged.enforceEuOnly ? 1 : 0,
          JSON.stringify(merged.customSafetyRules),
          updatedBy,
          organizationId,
        ]
      );
    } else {
      await dbRun(
        `INSERT INTO organization_ai_config
          (id, organization_id, allowed_topics, blocked_topics,
           max_tokens_per_conversation, max_tokens_per_message,
           mandatory_disclaimers, required_citation_mode,
           blocked_tools, allowed_models, data_residency_region,
           enforce_eu_only, custom_safety_rules, updated_by,
           created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [
          randomUUID(),
          organizationId,
          JSON.stringify(merged.allowedTopics),
          JSON.stringify(merged.blockedTopics),
          merged.maxTokensPerConversation,
          merged.maxTokensPerMessage,
          JSON.stringify(merged.mandatoryDisclaimers),
          merged.requiredCitationMode,
          JSON.stringify(merged.blockedTools),
          JSON.stringify(merged.allowedModels),
          merged.dataResidencyRegion,
          merged.enforceEuOnly ? 1 : 0,
          JSON.stringify(merged.customSafetyRules),
          updatedBy,
        ]
      );
    }

    return merged;
  }

  async enforcePolicy(
    organizationId: string,
    input: {
      message: string;
      toolName?: string;
      tokenCount?: number;
      conversationTokenCount?: number;
    }
  ): Promise<{
    allowed: boolean;
    violations: string[];
    disclaimers: string[];
  }> {
    const policy = await this.getPolicy(organizationId);
    const violations: string[] = [];

    if (policy.blockedTopics.length > 0) {
      const msgLower = input.message.toLowerCase();
      for (const topic of policy.blockedTopics) {
        if (msgLower.includes(topic.toLowerCase())) {
          violations.push(`Blocked topic: "${topic}"`);
        }
      }
    }

    if (policy.allowedTopics.length > 0) {
      const msgLower = input.message.toLowerCase();
      const matchesAllowed = policy.allowedTopics.some((t) =>
        msgLower.includes(t.toLowerCase())
      );
      if (!matchesAllowed && input.message.length > 50) {
        violations.push('Message does not match allowed topics');
      }
    }

    if (input.toolName && policy.blockedTools.includes(input.toolName)) {
      violations.push(`Tool "${input.toolName}" is blocked by organization policy`);
    }

    if (input.tokenCount && input.tokenCount > policy.maxTokensPerMessage) {
      violations.push(
        `Message exceeds max tokens (${input.tokenCount} > ${policy.maxTokensPerMessage})`
      );
    }

    if (
      input.conversationTokenCount &&
      input.conversationTokenCount > policy.maxTokensPerConversation
    ) {
      violations.push(
        `Conversation exceeds max tokens (${input.conversationTokenCount} > ${policy.maxTokensPerConversation})`
      );
    }

    for (const rule of policy.customSafetyRules) {
      try {
        if (new RegExp(rule.pattern, 'i').test(input.message)) {
          violations.push(`Custom safety rule "${rule.name}" triggered`);
        }
      } catch {}
    }

    return {
      allowed: violations.length === 0,
      violations,
      disclaimers: policy.mandatoryDisclaimers,
    };
  }

  async isToolAllowed(organizationId: string, toolName: string): Promise<boolean> {
    const policy = await this.getPolicy(organizationId);
    return !policy.blockedTools.includes(toolName);
  }
}

function safeParseArr(value: any): any[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export const orgAiPolicyService = new OrgAiPolicyService();
export default orgAiPolicyService;
