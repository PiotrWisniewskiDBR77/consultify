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

      const autoResult = await db.query(
        `INSERT INTO tp_automations (base_id, table_id, name, description, trigger_type, trigger_config, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [baseId, tableId, data.name, data.description ?? null, data.triggerType, JSON.stringify(data.triggerConfig), data.createdBy ?? null]
      );
      const automation = autoResult.rows[0];

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
    await db.query(
      'UPDATE tp_automations SET enabled = $2, updated_at = NOW() WHERE id = $1',
      [automationId, enabled]
    );
  }

  async deleteAutomation(automationId: string): Promise<void> {
    const db = getDatabase();
    await db.query('DELETE FROM tp_automations WHERE id = $1', [automationId]);
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

    for (const auto of automations.rows) {
      if (auto.trigger_config?.conditions) {
        if (!this.evaluateConditions(record, auto.trigger_config.conditions)) continue;
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
    const runId = runResult.rows[0].id;
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

    switch (action.actionType) {
      case 'update_record': {
        const { fieldUpdates } = action.actionConfig ?? {};
        if (fieldUpdates && triggerRecord?.id) {
          const data: Record<string, unknown> = {};
          for (const [fieldId, value] of Object.entries(fieldUpdates)) {
            data[fieldId] = value === '{{trigger.record.id}}' ? triggerRecord.id : value;
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
        const { tableId, data } = action.actionConfig ?? {};
        const result = await db.query(
          `INSERT INTO tp_records (table_id, data) VALUES ($1, $2) RETURNING id`,
          [tableId || automation.table_id, JSON.stringify(data || {})]
        );
        return { recordId: result.rows[0].id };
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
    return result.rows;
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
