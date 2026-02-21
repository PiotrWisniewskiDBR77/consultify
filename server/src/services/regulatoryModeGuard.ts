/**
 * Regulatory Mode Guard
 *
 * Real implementation backed by `project_ai_settings`.
 */

import { getDatabaseAsync } from '../database/Database.js';

type RegulatoryStatus = { enabled: boolean; prompt: string };

async function getStatus(projectId: string): Promise<RegulatoryStatus> {
  const db = await getDatabaseAsync();
  const result = await (db as any).query(
    `SELECT regulatory_mode_enabled, regulatory_prompt FROM project_ai_settings WHERE project_id = ? LIMIT 1`,
    [projectId]
  );
  const row = (result?.rows || [])[0] as any;
  return {
    enabled: Boolean(row?.regulatory_mode_enabled),
    prompt: typeof row?.regulatory_prompt === 'string' ? row.regulatory_prompt : '',
  };
}

export class RegulatoryModeGuard {
  static async isEnabled(projectId: string): Promise<boolean> {
    if (!projectId) return false;
    return (await getStatus(projectId)).enabled;
  }

  static async getRegulatoryPrompt(projectId?: string): Promise<string> {
    if (!projectId) return '';
    const status = await getStatus(projectId);
    return status.enabled ? status.prompt : '';
  }

  static async getStatus(projectId: string): Promise<RegulatoryStatus> {
    if (!projectId) return { enabled: false, prompt: '' };
    return await getStatus(projectId);
  }

  static async setEnabled(projectId: string, enabled: boolean): Promise<{ success: boolean }> {
    if (!projectId) return { success: false };
    const db = await getDatabaseAsync();
    const existing = await getStatus(projectId);
    const prompt =
      enabled && !existing.prompt
        ? 'Regulatory Mode is enabled. AI must operate in advisory-only mode.'
        : existing.prompt;

    await (db as any).query(
      `
        INSERT INTO project_ai_settings (project_id, regulatory_mode_enabled, regulatory_prompt, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(project_id) DO UPDATE SET
          regulatory_mode_enabled = excluded.regulatory_mode_enabled,
          regulatory_prompt = excluded.regulatory_prompt,
          updated_at = CURRENT_TIMESTAMP
      `,
      [projectId, enabled ? 1 : 0, prompt]
    );
    return { success: true };
  }

  static async enforceRegulatoryMode(
    ctx: { userId: string; organizationId: string; projectId: string },
    actionType: string
  ): Promise<{ blocked: boolean; reason?: string; message?: string }> {
    const enabled = await RegulatoryModeGuard.isEnabled(ctx.projectId);
    if (!enabled) return { blocked: false };

    const type = String(actionType || '').toUpperCase();
    const allow = new Set(['EXPLAIN_CONTEXT', 'ANALYZE_RISKS', 'PREPARE_DECISION_SUMMARY']);
    if (allow.has(type)) return { blocked: false };

    return {
      blocked: true,
      reason: 'REGULATORY_MODE',
      message: 'Action blocked by Regulatory Mode (advisory-only).',
    };
  }

  static checkRegulatoryMode(_orgId: string): boolean {
    // Only project-scoped regulatory mode exists in this codebase.
    return false;
  }
}

export default RegulatoryModeGuard;
