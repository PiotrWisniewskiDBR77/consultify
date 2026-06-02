/**
 * Advanced DLP Service
 *
 * Extends the existing DLP framework with:
 * - Output scanning (AI responses, not just input)
 * - Custom regex patterns per organization
 * - Real-time blocking before response delivery
 * - Built-in patterns for common sensitive data types
 */
import { randomUUID } from 'node:crypto';

import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

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

const BUILTIN_PATTERNS: Array<{
  name: string;
  pattern: RegExp;
  severity: 'high' | 'critical';
}> = [
  {
    name: 'credit_card',
    pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/,
    severity: 'critical',
  },
  { name: 'ssn', pattern: /\b\d{3}-\d{2}-\d{4}\b/, severity: 'critical' },
  {
    name: 'email_address',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
    severity: 'high',
  },
  {
    name: 'phone_number',
    pattern: /\b(?:\+\d{1,3}[\s-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/,
    severity: 'high',
  },
  { name: 'pesel', pattern: /\b\d{11}\b/, severity: 'critical' },
  { name: 'nip', pattern: /\b\d{3}-?\d{3}-?\d{2}-?\d{2}\b/, severity: 'high' },
  {
    name: 'iban',
    pattern: /\b[A-Z]{2}\d{2}[\s]?\d{4}[\s]?\d{4}[\s]?\d{4}[\s]?\d{4}[\s]?\d{4}[\s]?\d{4}\b/,
    severity: 'critical',
  },
  { name: 'ip_address', pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/, severity: 'high' },
  {
    name: 'api_key_pattern',
    pattern: /\b(sk|pk|api|key|secret|token|Bearer)[-_]?[A-Za-z0-9]{16,}\b/i,
    severity: 'critical',
  },
];

class AdvancedDlpService {
  async scanInput(content: string, organizationId: string): Promise<DlpScanResult> {
    return this.scan(content, organizationId, 'input');
  }

  async scanOutput(content: string, organizationId: string): Promise<DlpScanResult> {
    return this.scan(content, organizationId, 'output');
  }

  async scan(
    content: string,
    organizationId: string,
    direction: 'input' | 'output'
  ): Promise<DlpScanResult> {
    const violations: DlpScanResult['violations'] = [];
    let sanitized = content;
    let blocked = false;

    for (const builtin of BUILTIN_PATTERNS) {
      const match = content.match(builtin.pattern);
      if (match) {
        violations.push({
          ruleId: `builtin_${builtin.name}`,
          ruleName: builtin.name,
          severity: builtin.severity,
          action: builtin.severity === 'critical' ? 'redact' : 'warn',
          matchedPattern: builtin.pattern.source,
          matchedText: match[0].slice(0, 4) + '***',
        });

        if (builtin.severity === 'critical') {
          sanitized = sanitized.replace(builtin.pattern, '[REDACTED]');
        }
      }
    }

    const orgRules = await this.loadOrgRules(organizationId);
    for (const rule of orgRules) {
      if (rule.appliesTo !== 'both' && rule.appliesTo !== direction) continue;

      try {
        const regex = new RegExp(rule.pattern, 'gi');
        const match = content.match(regex);
        if (match) {
          violations.push({
            ruleId: rule.id,
            ruleName: rule.ruleName,
            severity: rule.severity,
            action: rule.action,
            matchedPattern: rule.pattern,
            matchedText: match[0].slice(0, 20) + '...',
          });

          if (rule.action === 'block') {
            blocked = true;
          } else if (rule.action === 'redact') {
            sanitized = sanitized.replace(regex, '[REDACTED]');
          }
        }
      } catch (err: any) {
        logger.debug(`[AdvancedDLP] Invalid regex in rule ${rule.id}: ${err?.message}`);
      }
    }

    return {
      clean: violations.length === 0,
      violations,
      sanitizedContent: sanitized !== content ? sanitized : undefined,
      blocked,
    };
  }

  async createRule(input: {
    organizationId: string;
    ruleName: string;
    ruleType?: string;
    pattern: string;
    action?: string;
    appliesTo?: string;
    severity?: string;
    createdBy: string;
  }): Promise<DlpRule> {
    const id = randomUUID();

    try {
      new RegExp(input.pattern);
    } catch {
      throw new Error(`Invalid regex pattern: ${input.pattern}`);
    }

    await dbRun(
      `INSERT INTO ai_dlp_rules
        (id, organization_id, rule_name, rule_type, pattern, action, applies_to, severity, is_active, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, datetime('now'), datetime('now'))`,
      [
        id,
        input.organizationId,
        input.ruleName,
        input.ruleType || 'regex',
        input.pattern,
        input.action || 'block',
        input.appliesTo || 'both',
        input.severity || 'high',
        input.createdBy,
      ]
    );

    return {
      id,
      organizationId: input.organizationId,
      ruleName: input.ruleName,
      ruleType: (input.ruleType || 'regex') as any,
      pattern: input.pattern,
      action: (input.action || 'block') as any,
      appliesTo: (input.appliesTo || 'both') as any,
      severity: (input.severity || 'high') as any,
      isActive: true,
    };
  }

  async listRules(organizationId: string): Promise<DlpRule[]> {
    const rows = (await dbAll(
      `SELECT * FROM ai_dlp_rules WHERE organization_id = ? ORDER BY created_at DESC`,
      [organizationId]
    ).catch(() => [])) as any[];

    return (rows || []).map((r: any) => ({
      id: r.id,
      organizationId: r.organization_id,
      ruleName: r.rule_name,
      ruleType: r.rule_type,
      pattern: r.pattern,
      action: r.action,
      appliesTo: r.applies_to,
      severity: r.severity,
      isActive: Boolean(r.is_active),
    }));
  }

  async toggleRule(ruleId: string, organizationId: string, isActive: boolean): Promise<void> {
    await dbRun(
      `UPDATE ai_dlp_rules SET is_active = ?, updated_at = datetime('now')
       WHERE id = ? AND organization_id = ?`,
      [isActive ? 1 : 0, ruleId, organizationId]
    );
  }

  async deleteRule(ruleId: string, organizationId: string): Promise<void> {
    await dbRun(`DELETE FROM ai_dlp_rules WHERE id = ? AND organization_id = ?`, [
      ruleId,
      organizationId,
    ]);
  }

  private async loadOrgRules(organizationId: string): Promise<DlpRule[]> {
    const rows = (await dbAll(
      `SELECT * FROM ai_dlp_rules WHERE organization_id = ? AND is_active = 1`,
      [organizationId]
    ).catch(() => [])) as any[];

    return (rows || []).map((r: any) => ({
      id: r.id,
      organizationId: r.organization_id,
      ruleName: r.rule_name,
      ruleType: r.rule_type,
      pattern: r.pattern,
      action: r.action,
      appliesTo: r.applies_to,
      severity: r.severity,
      isActive: true,
    }));
  }
}

export const advancedDlpService = new AdvancedDlpService();
export default advancedDlpService;
