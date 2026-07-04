/**
 * Table Platform Automation Service
 * Manages automation CRUD, trigger evaluation, action execution, and run accounting.
 */

import { getDatabase } from '../../database/Database.js';
import logger from '../../utils/Logger.js';

export interface Automation {
  id: string;
  baseId: string;
  tableId: string;
  name: string;
  description?: string;
  enabled: boolean;
  triggerType: string;
  triggerConfig: Record<string, unknown>;
  actions: AutomationAction[];
}

export interface AutomationAction {
  id: string;
  actionOrder: number;
  actionType: string;
  actionConfig: Record<string, unknown>;
}

interface AutomationRow {
  id: string;
  table_id: string;
  base_id: string;
  name: string;
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  actions: AutomationAction[];
  enabled: boolean;
  created_at: string;
  created_by?: string;
  [key: string]: unknown;
}

function resolveTemplate(template: string, context: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_, path: string) => {
    const parts = path.split('.');
    let val: unknown = context;
    for (const p of parts) {
      if (val && typeof val === 'object') val = (val as Record<string, unknown>)[p];
      else return '';
    }
    return String(val ?? '');
  });
}

export class AutomationService {
  async createAutomation(
    baseId: string,
    tableId: string,
    data: {
      name: string;
      description?: string;
      triggerType: string;
      triggerConfig: Record<string, unknown>;
      actions: Array<{ actionType: string; actionConfig: Record<string, unknown> }>;
      createdBy?: string;
    }
  ): Promise<Automation> {
    const db = getDatabase();
    try {
      await db.query('BEGIN');

      const triggerConfig = { ...data.triggerConfig };
      const autoResult = await db.query(
        `INSERT INTO tp_automations (base_id, table_id, name, description, trigger_type, trigger_config, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [
          baseId,
          tableId,
          data.name,
          data.description ?? null,
          data.triggerType,
          JSON.stringify(triggerConfig),
          data.createdBy ?? null,
        ]
      );
      const automation = autoResult.rows[0] as AutomationRow;

      if (data.triggerType === 'webhook_received') {
        const webhookUrl = this.getWebhookUrl(automation.id);
        const updatedConfig = { ...triggerConfig, webhookUrl };
        await db.query(`UPDATE tp_automations SET trigger_config = $2 WHERE id = $1`, [
          automation.id,
          JSON.stringify(updatedConfig),
        ]);
        automation.trigger_config = updatedConfig;
      }

      const actions: AutomationAction[] = [];
      for (let i = 0; i < data.actions.length; i++) {
        const a = data.actions[i];
        const actionResult = await db.query(
          `INSERT INTO tp_automation_actions (automation_id, action_order, action_type, action_config)
           VALUES ($1, $2, $3, $4) RETURNING *`,
          [automation.id, i, a.actionType, JSON.stringify(a.actionConfig)]
        );
        actions.push(this.mapAction(actionResult.rows[0]));
      }

      await db.query('COMMIT');
      return { ...this.mapAutomation(automation), actions };
    } catch (err) {
      await db.query('ROLLBACK').catch(() => {});
      throw err;
    }
  }

  async listAutomations(tableId: string): Promise<Automation[]> {
    const db = getDatabase();
    const result = await db.query(
      `SELECT a.*,
        COALESCE(json_agg(
          json_build_object('id', aa.id, 'actionOrder', aa.action_order, 'actionType', aa.action_type, 'actionConfig', aa.action_config)
          ORDER BY aa.action_order
        ) FILTER (WHERE aa.id IS NOT NULL), '[]') as actions
       FROM tp_automations a
       LEFT JOIN tp_automation_actions aa ON aa.automation_id = a.id
       WHERE a.table_id = $1
       GROUP BY a.id
       ORDER BY a.created_at DESC`,
      [tableId]
    );
    return result.rows.map((r: any) => ({ ...this.mapAutomation(r), actions: r.actions }));
  }

  async toggleAutomation(automationId: string, enabled: boolean): Promise<void> {
    const db = getDatabase();
    await db.query('UPDATE tp_automations SET enabled = $2, updated_at = NOW() WHERE id = $1', [
      automationId,
      enabled,
    ]);
  }

  async deleteAutomation(automationId: string): Promise<void> {
    const db = getDatabase();
    await db.query('DELETE FROM tp_automations WHERE id = $1', [automationId]);
  }

  async getAutomation(automationId: string): Promise<Automation | null> {
    const db = getDatabase();
    const result = await db.query(
      `SELECT a.*,
        COALESCE(json_agg(
          json_build_object('id', aa.id, 'actionOrder', aa.action_order, 'actionType', aa.action_type, 'actionConfig', aa.action_config)
          ORDER BY aa.action_order
        ) FILTER (WHERE aa.id IS NOT NULL), '[]') as actions
       FROM tp_automations a
       LEFT JOIN tp_automation_actions aa ON aa.automation_id = a.id
       WHERE a.id = $1
       GROUP BY a.id`,
      [automationId]
    );
    const row = result.rows[0] as AutomationRow | undefined;
    if (!row) return null;
    return { ...this.mapAutomation(row), actions: row.actions };
  }

  getWebhookUrl(automationId: string): string {
    return `/api/table-platform/automations/${automationId}/trigger`;
  }

  async triggerWebhook(
    automationId: string,
    payload: Record<string, unknown>
  ): Promise<{ success: boolean; runId?: string; error?: string }> {
    const automation = await this.getAutomation(automationId);
    if (!automation) {
      return { success: false, error: 'Automation not found' };
    }
    if (!automation.enabled) {
      return { success: false, error: 'Automation is not active' };
    }
    if (automation.triggerType !== 'webhook_received') {
      return { success: false, error: 'Automation is not a webhook trigger type' };
    }

    const triggerRecord = { id: null, data: payload, _webhookPayload: payload };

    try {
      await this.runAutomation(
        { ...automation, table_id: automation.tableId, trigger_config: automation.triggerConfig },
        triggerRecord
      );
      return { success: true };
    } catch (err) {
      logger.error(`[AutomationService] Webhook trigger failed for ${automationId}`, {
        error: (err as Error).message,
      });
      return { success: false, error: (err as Error).message };
    }
  }

  async evaluateTriggers(
    tableId: string,
    event: 'record_created' | 'record_updated',
    record: any
  ): Promise<void> {
    const db = getDatabase();
    const automations = await db.query(
      `SELECT a.*,
        COALESCE(json_agg(
          json_build_object('id', aa.id, 'actionOrder', aa.action_order, 'actionType', aa.action_type, 'actionConfig', aa.action_config)
          ORDER BY aa.action_order
        ) FILTER (WHERE aa.id IS NOT NULL), '[]') as actions
       FROM tp_automations a
       LEFT JOIN tp_automation_actions aa ON aa.automation_id = a.id
       WHERE a.table_id = $1 AND a.enabled = true AND a.trigger_type = $2
       GROUP BY a.id`,
      [tableId, event]
    );

    for (const auto of automations.rows as AutomationRow[]) {
      if (auto.trigger_config?.conditions) {
        if (!this.evaluateConditions(record, auto.trigger_config.conditions as any[])) continue;
      }

      this.runAutomation(auto, record).catch((err) => {
        logger.error(`[AutomationService] Error running automation ${auto.id}`, {
          error: (err as Error).message,
        });
      });
    }
  }

  private async runAutomation(automation: any, triggerRecord: any): Promise<void> {
    const db = getDatabase();
    const runResult = await db.query(
      `INSERT INTO tp_automation_runs (automation_id, trigger_record_id, status)
       VALUES ($1, $2, 'running') RETURNING id`,
      [automation.id, triggerRecord?.id ?? null]
    );
    const runId = (runResult.rows[0] as { id: string }).id;
    const startTime = Date.now();
    const actionResults: any[] = [];

    try {
      const actions: any[] = Array.isArray(automation.actions) ? automation.actions : [];
      for (const action of actions) {
        const result = await this.executeAction(action, triggerRecord, automation);
        actionResults.push({
          actionId: action.id,
          actionType: action.actionType,
          status: 'completed',
          result,
        });
      }

      await db.query(
        `UPDATE tp_automation_runs
         SET status = 'completed', completed_at = NOW(), duration_ms = $2, action_results = $3
         WHERE id = $1`,
        [runId, Date.now() - startTime, JSON.stringify(actionResults)]
      );

      const month = new Date().toISOString().slice(0, 7);
      await db.query(
        `INSERT INTO tp_automation_run_counts (organization_id, month, run_count)
         VALUES (
           (SELECT b.organization_id FROM tp_bases b JOIN tp_automations a ON a.base_id = b.id WHERE a.id = $1),
           $2, 1
         )
         ON CONFLICT (organization_id, month)
         DO UPDATE SET run_count = tp_automation_run_counts.run_count + 1`,
        [automation.id, month]
      );
    } catch (err: any) {
      await db.query(
        `UPDATE tp_automation_runs
         SET status = 'failed', completed_at = NOW(), duration_ms = $2, error = $3, action_results = $4
         WHERE id = $1`,
        [runId, Date.now() - startTime, err.message, JSON.stringify(actionResults)]
      );
    }
  }

  private async executeAction(action: any, triggerRecord: any, automation: any): Promise<any> {
    const db = getDatabase();
    const context: Record<string, unknown> = {
      tableId: automation.table_id,
      recordId: triggerRecord?.id,
      userId: automation.created_by,
      record: triggerRecord?.data ?? triggerRecord ?? {},
      trigger: { record: triggerRecord },
    };

    switch (action.actionType) {
      case 'update_record': {
        const { fieldUpdates } = action.actionConfig ?? {};
        if (fieldUpdates && triggerRecord?.id) {
          const data: Record<string, unknown> = {};
          for (const [fieldId, value] of Object.entries(fieldUpdates)) {
            data[fieldId] =
              typeof value === 'string' && value.startsWith('{{')
                ? resolveTemplate(value, context)
                : value;
          }
          await db.query(
            `UPDATE tp_records SET data = data || $2::jsonb, updated_at = NOW() WHERE id = $1`,
            [triggerRecord.id, JSON.stringify(data)]
          );
          return { updated: true };
        }
        return { updated: false };
      }

      case 'create_record': {
        const { default: recordsService } = await import('./RecordsService.js');
        const tableId = action.actionConfig?.tableId || context.tableId;
        const data = action.actionConfig?.data || {};
        const resolvedData: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(data)) {
          resolvedData[key] =
            typeof val === 'string' && val.startsWith('{{') ? resolveTemplate(val, context) : val;
        }
        const record = await recordsService.createRecord(
          tableId as string,
          resolvedData,
          context.userId as string
        );
        return { success: true, recordId: record.id };
      }

      case 'delete_record': {
        const { default: recordsService } = await import('./RecordsService.js');
        const recordId = action.actionConfig?.recordId || context.recordId;
        await recordsService.deleteRecord(recordId as string, context.userId as string);
        return { success: true };
      }

      case 'find_records': {
        const { default: viewQueryEngine } = await import('./ViewQueryEngine.js');
        const result = await viewQueryEngine.executeQuery({
          tableId: action.actionConfig?.tableId,
          filters: action.actionConfig?.filters,
          sorts: action.actionConfig?.sorts,
          pageSize: action.actionConfig?.limit || 100,
        });
        return { success: true, records: result.records, total: result.total };
      }

      case 'send_webhook': {
        const { url, method, headers, bodyTemplate } = action.actionConfig ?? {};
        const body = JSON.stringify(bodyTemplate || { record: triggerRecord });
        try {
          const resp = await fetch(url, {
            method: method || 'POST',
            headers: { 'Content-Type': 'application/json', ...(headers || {}) },
            body,
          });
          return { status: resp.status, ok: resp.ok };
        } catch (err: any) {
          return { error: err.message };
        }
      }

      case 'send_slack': {
        const webhookUrl = action.actionConfig?.webhookUrl;
        const text = resolveTemplate(action.actionConfig?.message || '', context);
        const resp = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });
        if (!resp.ok) throw new Error(`Slack webhook failed: ${resp.status}`);
        return { success: true };
      }

      case 'send_teams': {
        const webhookUrl = action.actionConfig?.webhookUrl;
        const text = resolveTemplate(action.actionConfig?.message || '', context);
        const resp = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            '@type': 'MessageCard',
            summary: 'Consultify Notification',
            text,
          }),
        });
        if (!resp.ok) throw new Error(`Teams webhook failed: ${resp.status}`);
        return { success: true };
      }

      case 'run_script': {
        // SECURITY: executing user-supplied JavaScript via `new Function(...)`
        // is remote code execution. Any user with table access can create an
        // automation with a `run_script` action; it then runs on every
        // record_created / record_updated trigger with full server privileges.
        //
        // No JS sandbox (isolated-vm / vm2) is present in the dependency tree,
        // so we DISABLE execution behind a flag that is OFF by default and
        // return a structured error instead of evaluating arbitrary code. The
        // action type is preserved (data compatibility); only the dangerous
        // `new Function` execution path is gated. To enable safely, wire in a
        // real sandbox at the SCRIPT_SANDBOX extension point below and flip
        // TP_AUTOMATION_RUN_SCRIPT_ENABLED=true.
        const scriptEnabled = process.env.TP_AUTOMATION_RUN_SCRIPT_ENABLED === 'true';
        if (!scriptEnabled) {
          logger.warn(
            '[AutomationService] run_script action blocked — script execution disabled (fail-closed)',
            { tableId: automation.table_id, automationId: automation.id }
          );
          return {
            success: false,
            error: 'script actions are disabled',
          };
        }
        // SCRIPT_SANDBOX extension point: replace the following with an
        // isolated-vm / vm2 sandboxed evaluation before enabling the flag.
        // Until a real sandbox is added, even with the flag on we refuse to
        // fall back to unsandboxed `new Function`.
        logger.error(
          '[AutomationService] run_script enabled but no sandbox configured — refusing to execute',
          { tableId: automation.table_id, automationId: automation.id }
        );
        return {
          success: false,
          error: 'script sandbox not configured',
        };
      }

      case 'update_linked_records': {
        const { default: relationService } = await import('./RelationService.js');
        const { default: recordsService } = await import('./RecordsService.js');
        const linked = await relationService.getLinkedRecords(
          (action.actionConfig?.recordId || context.recordId) as string,
          action.actionConfig?.fieldId
        );
        for (const lr of linked) {
          await recordsService.updateRecord(
            lr.id,
            action.actionConfig?.updates,
            context.userId as string
          );
        }
        return { success: true, updatedCount: linked.length };
      }

      case 'duplicate_record': {
        const { default: recordsService } = await import('./RecordsService.js');
        const recordId = action.actionConfig?.recordId || context.recordId;
        const original = await recordsService.getRecord(recordId as string);
        if (!original) throw new Error('Record not found');
        const newData = { ...(original as any).data };
        delete newData.__created_by;
        delete newData.__created_by_name;
        const newRecord = await recordsService.createRecord(
          (original as any).table_id,
          newData,
          context.userId as string
        );
        return { success: true, recordId: newRecord.id };
      }

      case 'send_email':
        return { sent: false, reason: 'Email service not configured' };

      default:
        return { error: `Unknown action type: ${action.actionType}` };
    }
  }

  private evaluateConditions(record: any, conditions: any[]): boolean {
    if (!Array.isArray(conditions) || conditions.length === 0) return true;
    return conditions.every((c) => {
      const val = record?.data?.[c.fieldId];
      switch (c.operator) {
        case 'equals':
          return val === c.value;
        case 'not_equals':
          return val !== c.value;
        case 'contains':
          return typeof val === 'string' && val.includes(c.value);
        case 'is_empty':
          return val === null || val === undefined || val === '';
        case 'is_not_empty':
          return val !== null && val !== undefined && val !== '';
        case 'gt':
          return Number(val) > Number(c.value);
        case 'lt':
          return Number(val) < Number(c.value);
        default:
          return true;
      }
    });
  }

  /**
   * Manually execute an automation regardless of its trigger type
   * (used by the "Run now" action in the UI). Runs with a synthetic/empty
   * trigger record since there is no real triggering event.
   */
  async runManually(
    automationId: string
  ): Promise<{ success: boolean; runId?: string; error?: string }> {
    const automation = await this.getAutomation(automationId);
    if (!automation) {
      return { success: false, error: 'Automation not found' };
    }
    if (!automation.enabled) {
      return { success: false, error: 'Automation is not active' };
    }

    const triggerRecord = { id: null, data: {} };

    try {
      await this.runAutomation(
        { ...automation, table_id: automation.tableId, trigger_config: automation.triggerConfig },
        triggerRecord
      );
      return { success: true };
    } catch (err) {
      logger.error(`[AutomationService] Manual run failed for ${automationId}`, {
        error: (err as Error).message,
      });
      return { success: false, error: (err as Error).message };
    }
  }

  async getRunHistory(automationId: string, limit = 20): Promise<any[]> {
    const db = getDatabase();
    const result = await db.query(
      `SELECT * FROM tp_automation_runs WHERE automation_id = $1 ORDER BY started_at DESC LIMIT $2`,
      [automationId, limit]
    );
    return result.rows;
  }

  async getRunCounts(organizationId: string): Promise<{ month: string; count: number }[]> {
    const db = getDatabase();
    const result = await db.query(
      `SELECT month, run_count as count FROM tp_automation_run_counts WHERE organization_id = $1 ORDER BY month DESC LIMIT 12`,
      [organizationId]
    );
    return result.rows as { month: string; count: number }[];
  }

  private mapAutomation(row: any): Omit<Automation, 'actions'> {
    return {
      id: row.id,
      baseId: row.base_id,
      tableId: row.table_id,
      name: row.name,
      description: row.description,
      enabled: row.enabled,
      triggerType: row.trigger_type,
      triggerConfig: row.trigger_config,
    };
  }

  private mapAction(row: any): AutomationAction {
    return {
      id: row.id,
      actionOrder: row.action_order,
      actionType: row.action_type,
      actionConfig: row.action_config,
    };
  }
}

export const automationService = new AutomationService();
export default automationService;
