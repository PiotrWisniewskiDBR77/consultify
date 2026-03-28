/**
 * Automation Rules Engine (V4-TASK-05)
 *
 * Subscribes to EventBus events and evaluates automation rules.
 * Flow: event → load matching rules → evaluate conditions → execute actions → audit log.
 */

import { v4 as uuidv4 } from 'uuid';

import logger from '../utils/Logger.js';
import auditEventsService from './AuditEventsService.js';
import {
  type ActionResult,
  type AutomationRule,
  evaluateConditions,
  executeActions,
  getActiveRulesForOrg,
} from './automationRulesService.js';
import { EventBus, type IEvent } from './event/EventBus.js';

// ============================================
// EVENT → TRIGGER TYPE MAPPING
// ============================================

const EVENT_TO_TRIGGER: Record<string, string> = {
  'task.updated': 'task_status_changed',
  'task.created': 'task_created',
  'task.assigned': 'task_assigned',
  'task.overdue': 'task_overdue',
  'decision.updated': 'decision_status_changed',
  'raid.created': 'raid_item_created',
};

// ============================================
// CORE ENGINE
// ============================================

async function handleAutomationEvent(event: IEvent): Promise<void> {
  const payload = event.payload as Record<string, unknown>;
  const orgId = payload.organizationId as string;
  if (!orgId) return;

  const triggerType = EVENT_TO_TRIGGER[event.eventName];
  if (!triggerType) return;

  let rules: AutomationRule[];
  try {
    rules = await getActiveRulesForOrg(orgId, triggerType);
  } catch (err) {
    logger.warn('[AutomationEngine] Failed to load rules:', err);
    return;
  }

  if (rules.length === 0) return;

  const context = buildContext(event.eventName, payload);

  for (const rule of rules) {
    try {
      const matched = evaluateConditions(rule.conditions, context);
      if (!matched) continue;

      logger.debug(`[AutomationEngine] Rule "${rule.name}" matched for event ${event.eventName}`);

      const results = await executeActions(rule.actions, context, orgId);
      await logRuleExecution(rule, event.eventName, context, results, orgId);
    } catch (err: any) {
      logger.error(`[AutomationEngine] Rule "${rule.name}" execution failed:`, err?.message || err);
    }
  }
}

function buildContext(
  eventName: string,
  payload: Record<string, unknown>
): Record<string, unknown> {
  const ctx: Record<string, unknown> = { ...payload, _eventName: eventName };

  if (eventName === 'task.updated') {
    ctx.statusChanged = payload.oldStatus !== payload.newStatus;
    ctx.status = payload.newStatus ?? payload.oldStatus;
    ctx.oldStatus = payload.oldStatus;
    ctx.newStatus = payload.newStatus;
  }

  return ctx;
}

async function logRuleExecution(
  rule: AutomationRule,
  eventName: string,
  context: Record<string, unknown>,
  results: ActionResult[],
  orgId: string
): Promise<void> {
  try {
    await auditEventsService.log({
      actorId: 'system',
      actorType: 'SYSTEM',
      action: 'AUTOMATION_RULE_FIRED',
      resourceType: 'automation_rule',
      resourceId: rule.id,
      before: { eventName, context: { taskId: context.taskId, status: context.status } },
      after: { results },
      metadata: {
        ruleName: rule.name,
        triggerType: rule.triggerType,
        actionsCount: results.length,
      },
      organizationId: orgId,
    });
  } catch (err: any) {
    logger.warn('[AutomationEngine] Audit log failed:', err?.message);
  }
}

// ============================================
// BOOTSTRAP — call once at server startup
// ============================================

let initialized = false;

export function initAutomationRulesEngine(): void {
  if (initialized) return;
  initialized = true;

  const bus = EventBus.getInstance();

  const events = Object.keys(EVENT_TO_TRIGGER);
  for (const eventName of events) {
    bus.subscribe(eventName, handleAutomationEvent);
  }

  logger.info(`[AutomationEngine] Subscribed to ${events.length} events: ${events.join(', ')}`);
}

export default { initAutomationRulesEngine };
