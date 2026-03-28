import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

// ============================================
// SCHEMAS
// ============================================

export const TriggerTypeEnum = z.enum([
  'task_status_changed',
  'task_assigned',
  'task_created',
  'task_overdue',
  'decision_status_changed',
  'raid_item_created',
  'schedule',
  'manual',
]);

export const ConditionOperatorEnum = z.enum([
  'equals',
  'not_equals',
  'contains',
  'gt',
  'lt',
  'gte',
  'lte',
  'in',
  'not_in',
  'is_empty',
  'is_not_empty',
]);

export const ConditionSchema = z.object({
  field: z.string(),
  operator: ConditionOperatorEnum,
  value: z.unknown(),
});

export const ActionTypeEnum = z.enum([
  'set_status',
  'assign_user',
  'set_priority',
  'add_tag',
  'remove_tag',
  'create_task',
  'send_notification',
  'add_comment',
  'set_field',
  'escalate',
]);

export const ActionSchema = z.object({
  type: ActionTypeEnum,
  config: z.record(z.string(), z.unknown()),
});

export const AutomationRuleSchema = z.object({
  name: z.string().min(1),
  triggerType: TriggerTypeEnum,
  triggerConfig: z.record(z.string(), z.unknown()).optional(),
  conditions: z.array(ConditionSchema).default([]),
  actions: z.array(ActionSchema).min(1),
  isActive: z.boolean().default(true),
});

export type TriggerType = z.infer<typeof TriggerTypeEnum>;
export type Condition = z.infer<typeof ConditionSchema>;
export type Action = z.infer<typeof ActionSchema>;
export type AutomationRuleInput = z.infer<typeof AutomationRuleSchema>;

export interface AutomationRule extends AutomationRuleInput {
  id: string;
  organizationId: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ActionResult {
  action: string;
  success: boolean;
  result?: unknown;
  error?: string;
}

// ============================================
// CONDITION EVALUATION
// ============================================

export function evaluateConditions(
  conditions: Condition[],
  context: Record<string, unknown>
): boolean {
  if (conditions.length === 0) return true;

  return conditions.every((cond) => {
    const fieldValue = context[cond.field];
    switch (cond.operator) {
      case 'equals':
        return fieldValue === cond.value;
      case 'not_equals':
        return fieldValue !== cond.value;
      case 'contains':
        return (
          typeof fieldValue === 'string' &&
          typeof cond.value === 'string' &&
          fieldValue.includes(cond.value)
        );
      case 'gt':
        return (
          typeof fieldValue === 'number' &&
          typeof cond.value === 'number' &&
          fieldValue > cond.value
        );
      case 'lt':
        return (
          typeof fieldValue === 'number' &&
          typeof cond.value === 'number' &&
          fieldValue < cond.value
        );
      case 'gte':
        return (
          typeof fieldValue === 'number' &&
          typeof cond.value === 'number' &&
          fieldValue >= cond.value
        );
      case 'lte':
        return (
          typeof fieldValue === 'number' &&
          typeof cond.value === 'number' &&
          fieldValue <= cond.value
        );
      case 'in':
        return Array.isArray(cond.value) && (cond.value as unknown[]).includes(fieldValue);
      case 'not_in':
        return Array.isArray(cond.value) && !(cond.value as unknown[]).includes(fieldValue);
      case 'is_empty':
        return fieldValue === undefined || fieldValue === null || fieldValue === '';
      case 'is_not_empty':
        return fieldValue !== undefined && fieldValue !== null && fieldValue !== '';
      default:
        return false;
    }
  });
}

// ============================================
// ACTION EXECUTION
// ============================================

export async function executeActions(
  actions: Action[],
  context: Record<string, unknown>,
  orgId: string
): Promise<ActionResult[]> {
  const results: ActionResult[] = [];

  for (const action of actions) {
    try {
      switch (action.type) {
        case 'set_status': {
          const taskId = context.taskId as string;
          const newStatus = action.config.status as string;
          if (taskId && newStatus) {
            await dbRun(
              'UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?',
              [newStatus, taskId, orgId]
            );
            results.push({ action: 'set_status', success: true, result: { taskId, newStatus } });
          } else {
            results.push({
              action: 'set_status',
              success: false,
              error: 'Missing taskId or status',
            });
          }
          break;
        }
        case 'assign_user': {
          const taskId = context.taskId as string;
          const userId = action.config.userId as string;
          if (taskId && userId) {
            await dbRun(
              'UPDATE tasks SET assignee_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?',
              [userId, taskId, orgId]
            );
            results.push({ action: 'assign_user', success: true, result: { taskId, userId } });
          } else {
            results.push({
              action: 'assign_user',
              success: false,
              error: 'Missing taskId or userId',
            });
          }
          break;
        }
        case 'set_priority': {
          const taskId = context.taskId as string;
          const priority = action.config.priority as string;
          if (taskId && priority) {
            await dbRun(
              'UPDATE tasks SET priority = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?',
              [priority, taskId, orgId]
            );
            results.push({ action: 'set_priority', success: true, result: { taskId, priority } });
          } else {
            results.push({
              action: 'set_priority',
              success: false,
              error: 'Missing taskId or priority',
            });
          }
          break;
        }
        case 'set_field': {
          const taskId = context.taskId as string;
          const fieldName = action.config.field as string;
          const fieldValue = action.config.value;
          if (taskId && fieldName) {
            const task = (await dbGet(
              'SELECT custom_fields_json FROM tasks WHERE id = ? AND organization_id = ?',
              [taskId, orgId]
            )) as { custom_fields_json?: string } | undefined;
            const fields = task?.custom_fields_json ? JSON.parse(task.custom_fields_json) : {};
            fields[fieldName] = fieldValue;
            await dbRun(
              'UPDATE tasks SET custom_fields_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?',
              [JSON.stringify(fields), taskId, orgId]
            );
            results.push({
              action: 'set_field',
              success: true,
              result: { taskId, fieldName, fieldValue },
            });
          } else {
            results.push({ action: 'set_field', success: false, error: 'Missing taskId or field' });
          }
          break;
        }
        case 'send_notification':
          results.push({
            action: 'send_notification',
            success: true,
            result: { message: action.config.message, queued: true },
          });
          break;
        case 'add_comment':
          results.push({
            action: 'add_comment',
            success: true,
            result: { comment: action.config.text, queued: true },
          });
          break;
        default:
          results.push({
            action: action.type,
            success: false,
            error: 'Action type not yet implemented',
          });
      }
    } catch (err: any) {
      results.push({ action: action.type, success: false, error: err?.message || 'Unknown error' });
    }
  }
  return results;
}

// ============================================
// CRUD
// ============================================

interface RuleRow {
  id: string;
  organization_id: string;
  name: string;
  trigger_type: string;
  trigger_config_json: string | null;
  conditions_json: string | null;
  actions_json: string;
  is_active: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

function mapRowToRule(row: RuleRow): AutomationRule {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    triggerType: row.trigger_type as TriggerType,
    triggerConfig: row.trigger_config_json ? JSON.parse(row.trigger_config_json) : {},
    conditions: row.conditions_json ? JSON.parse(row.conditions_json) : [],
    actions: JSON.parse(row.actions_json || '[]'),
    isActive: Boolean(row.is_active),
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getActiveRulesForOrg(
  orgId: string,
  triggerType?: string
): Promise<AutomationRule[]> {
  const sql = triggerType
    ? `SELECT * FROM task_automation_rules WHERE organization_id = ? AND is_active = 1 AND trigger_type = ? ORDER BY created_at ASC`
    : `SELECT * FROM task_automation_rules WHERE organization_id = ? AND is_active = 1 ORDER BY created_at ASC`;
  const params = triggerType ? [orgId, triggerType] : [orgId];

  try {
    const rows = (await dbAll(sql, params)) as RuleRow[];
    return rows.map(mapRowToRule);
  } catch (err) {
    logger.warn('[AutomationRules] Failed to load rules:', err);
    return [];
  }
}

export async function getRuleById(ruleId: string, orgId: string): Promise<AutomationRule | null> {
  try {
    const row = (await dbGet(
      `SELECT * FROM task_automation_rules WHERE id = ? AND organization_id = ?`,
      [ruleId, orgId]
    )) as RuleRow | undefined;
    return row ? mapRowToRule(row) : null;
  } catch {
    return null;
  }
}

export async function updateRule(
  ruleId: string,
  orgId: string,
  updates: Partial<AutomationRuleInput>
): Promise<AutomationRule | null> {
  const existing = await getRuleById(ruleId, orgId);
  if (!existing) return null;

  const name = updates.name ?? existing.name;
  const triggerType = updates.triggerType ?? existing.triggerType;
  const triggerConfig = updates.triggerConfig ?? existing.triggerConfig;
  const conditions = updates.conditions ?? existing.conditions;
  const actions = updates.actions ?? existing.actions;
  const isActive = updates.isActive ?? existing.isActive;

  await dbRun(
    `UPDATE task_automation_rules
     SET name = ?, trigger_type = ?, trigger_config_json = ?, conditions_json = ?, actions_json = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND organization_id = ?`,
    [
      name,
      triggerType,
      JSON.stringify(triggerConfig ?? {}),
      JSON.stringify(conditions),
      JSON.stringify(actions),
      isActive ? 1 : 0,
      ruleId,
      orgId,
    ]
  );

  return {
    ...existing,
    name,
    triggerType,
    triggerConfig,
    conditions,
    actions,
    isActive,
    updatedAt: new Date().toISOString(),
  };
}

export async function deleteRule(ruleId: string, orgId: string): Promise<boolean> {
  try {
    const result = await dbRun(
      `DELETE FROM task_automation_rules WHERE id = ? AND organization_id = ?`,
      [ruleId, orgId]
    );
    return (result as any).changes > 0;
  } catch {
    return false;
  }
}

export function dryRunRule(
  rule: AutomationRule,
  context: Record<string, unknown>
): {
  wouldMatch: boolean;
  conditionResults: Array<{
    field: string;
    operator: string;
    expected: unknown;
    actual: unknown;
    passed: boolean;
  }>;
  actions: Action[];
} {
  const conditionResults = rule.conditions.map((cond) => {
    const fieldValue = context[cond.field];
    const passed = evaluateConditions([cond], context);
    return {
      field: cond.field,
      operator: cond.operator,
      expected: cond.value,
      actual: fieldValue,
      passed,
    };
  });

  const wouldMatch = conditionResults.length === 0 || conditionResults.every((c) => c.passed);

  return {
    wouldMatch,
    conditionResults,
    actions: wouldMatch ? rule.actions : [],
  };
}
