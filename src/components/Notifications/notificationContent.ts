import type { TFunction } from 'i18next';

export type CanonicalNotificationPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type NotificationPrimaryCta =
  | { kind: 'open_task'; label: string; id: string }
  | { kind: 'open_decision'; label: string; id: string }
  | { kind: 'open_project'; label: string; id: string }
  | { kind: 'open_link'; label: string; href: string }
  | { kind: 'none'; label?: string };

export type NotificationLike = {
  id: string;
  type?: string;
  title?: string;
  message?: string;
  body?: string;
  severity?: 'INFO' | 'WARNING' | 'CRITICAL' | string;
  priority?: string;
  category?: string;
  isRead?: boolean;
  createdAt?: string;
  readAt?: string;
  relatedObjectType?: 'TASK' | 'INITIATIVE' | 'DECISION' | 'PROJECT' | 'GATE' | string;
  relatedObjectId?: string;
  projectId?: string;
  projectName?: string;
  data?: Record<string, unknown>;
};

export type SuggestedChecklistItem = {
  text: string;
  /** Urgency hint: 'critical' items render red, 'optional' items render muted */
  urgency?: 'critical' | 'normal' | 'optional';
};

export type NotificationContentContract = {
  priority: CanonicalNotificationPriority;
  what: string;
  whyImportant: string;
  contextLine: string;
  blocked: string;
  expectedAction: string;
  suggestedChecklist: SuggestedChecklistItem[];
  primaryCta: NotificationPrimaryCta;
  whyYouGotIt?: string;
};

const normalize = (v?: string | null) => String(v || '').trim();

/**
 * Compute priority from BOTH severity AND notification type.
 * Type-based rules take precedence over raw severity to prevent mismatches
 * like an OVERDUE task showing as "LOW" priority.
 */
const computePriority = (n: NotificationLike): CanonicalNotificationPriority => {
  const t = normalize(n.type).toUpperCase();
  const s = normalize(n.severity).toUpperCase();
  const p = normalize(n.priority).toUpperCase();

  // Type-based priority rules (highest specificity)
  if (t.includes('BLOCKED') || t === 'DECISION_OVERDUE') return 'CRITICAL';
  if (t === 'SYSTEM_ALERT' && s === 'CRITICAL') return 'CRITICAL';
  if (t === 'PAYMENT_FAILED') return 'CRITICAL';
  if (t === 'USAGE_ALERT' || t.includes('LIMIT')) return 'HIGH';
  if (t === 'SUBSCRIPTION_CHANGE') return 'MEDIUM';
  if (t === 'TASK_OVERDUE') {
    const daysOverdue = Number(n.data?.days_overdue || n.data?.daysOverdue || 1);
    return daysOverdue > 3 ? 'CRITICAL' : 'HIGH';
  }
  if (t.includes('ESCALAT')) return 'HIGH';
  if (t === 'DECISION_REQUIRED' || t === 'GATE_PENDING_APPROVAL') return 'HIGH';
  if (t === 'AI_RISK_DETECTED' || t === 'AI_OVERLOAD_DETECTED') return 'HIGH';
  if (t === 'AI_DEPENDENCY_CONFLICT') return 'HIGH';
  if (t.startsWith('DBR77_')) return 'MEDIUM';

  // Fall back to explicit severity
  if (s === 'CRITICAL' || s === 'URGENT') return 'CRITICAL';
  if (s === 'WARNING' || s === 'HIGH') return 'HIGH';

  // Fall back to backend priority field
  if (p === 'CRITICAL' || p === 'URGENT') return 'CRITICAL';
  if (p === 'HIGH') return 'HIGH';
  if (p === 'NORMAL' || p === 'MEDIUM') return 'MEDIUM';

  // Type-based defaults
  if (t.includes('ASSIGN')) return 'MEDIUM';
  if (t.includes('AI_RECOMMENDATION')) return 'MEDIUM';
  if (t.includes('BILLING') || t.includes('PAYMENT') || t.includes('SUBSCRIPTION')) return 'MEDIUM';
  if (t.includes('COMPLETED') || t.includes('MILESTONE')) return 'LOW';

  if (s === 'INFO') return 'MEDIUM';

  return 'LOW';
};

/** @deprecated Use computePriority instead */
const priorityFromSeverity = (severity?: string): CanonicalNotificationPriority => {
  const s = normalize(severity).toUpperCase();
  if (s === 'CRITICAL' || s === 'URGENT') return 'CRITICAL';
  if (s === 'WARNING' || s === 'HIGH') return 'HIGH';
  if (s === 'INFO' || s === 'MEDIUM') return 'MEDIUM';
  return 'LOW';
};

const inferWhy = (n: NotificationLike, t: TFunction): string => {
  // First priority: use the full message from backend (enriched data)
  const msg = normalize(n.message || n.body);
  if (msg && msg.length > 20) return msg;

  // Second: use contextLine from enriched data
  const contextLine = normalize(
    (n.data?.contextLine || n.data?.context_line || n.data?.impact) as string | undefined
  );
  if (contextLine) return contextLine;

  // Fallback: infer from type
  const nType = normalize(n.type).toUpperCase();
  const data = n.data || {};
  const daysOverdue = Number(data.days_overdue || data.daysOverdue || 0);
  const taskTitle = normalize(
    (data.task_title || data.taskTitle || data.entityName) as string | undefined
  );
  const riskLevel = normalize((data.riskLevel || data.risk_level) as string | undefined);

  if (nType.includes('OVERDUE') && daysOverdue > 0) {
    return daysOverdue === 1
      ? t(
          'notifications.content.why.overdueDay',
          'Deadline passed {{count}} day ago. Every extra day of delay pushes the next step back by the same amount (no schedule buffer [assumption]).',
          { count: daysOverdue }
        )
      : t(
          'notifications.content.why.overdueDays',
          'Deadline passed {{count}} days ago. Every extra day of delay pushes the next step back by the same amount (no schedule buffer [assumption]).',
          { count: daysOverdue }
        );
  }
  if (nType.includes('OVERDUE')) {
    return t(
      'notifications.content.why.overdue',
      "Deadline passed — the exact number of days overdue isn't in the data. Open the linked item and check the due date before deciding on next steps."
    );
  }
  if (nType.includes('DUE') || nType.includes('DUE_SOON')) {
    return t(
      'notifications.content.why.dueSoon',
      'Deadline is approaching. If it passes without an update, the system automatically raises this to critical priority after 3 days overdue — confirm the plan now to avoid that.'
    );
  }
  if (nType.includes('ESCALAT')) {
    return t(
      'notifications.content.why.escalated',
      'No response within the expected window triggered an automatic escalation — priority raised to high.'
    );
  }
  if (nType.includes('BLOCKED')) {
    return t(
      'notifications.content.why.blocked',
      'Blocked — the system flags this as critical priority. Every dependent step stays frozen until this specific blocker is removed.'
    );
  }
  if (nType.includes('ASSIGN')) {
    return t(
      'notifications.content.why.assigned',
      'New assignment{{taskPart}} — it now counts against your workload; confirm scope today so the deadline stays realistic.',
      { taskPart: taskTitle ? ` "${taskTitle}"` : '' }
    );
  }
  if (nType.includes('AI_RISK')) {
    return t(
      'notifications.content.why.aiRisk',
      'AI detected a risk{{riskPart}} — verify the source data before deciding, the model can be wrong.',
      { riskPart: riskLevel ? ` [${riskLevel}]` : '' }
    );
  }
  if (nType.includes('AI')) {
    return t(
      'notifications.content.why.ai',
      "AI generated a recommendation but didn't state a measured impact in the data — open the details and verify assumptions before applying it."
    );
  }
  if (nType === 'PAYMENT_FAILED') {
    return t(
      'notifications.content.why.paymentFailed',
      'Payment failed — it may affect access to features. Update your payment method.'
    );
  }
  if (nType === 'USAGE_ALERT' || nType.includes('LIMIT')) {
    const usedPct = Number(
      (n.data?.usagePercent || n.data?.usage_percent || n.data?.percent_used) as
        | number
        | string
        | undefined
    );
    const pct = Number.isFinite(usedPct) && usedPct > 0 ? usedPct : undefined;
    const remaining = pct !== undefined ? Math.max(0, 100 - pct) : undefined;
    return pct
      ? t(
          'notifications.content.why.usageAlertPct',
          '{{pct}}% of the limit used — {{remaining}}% left. At 100% the feature stops working until you increase the limit, clean up data, or upgrade.',
          { pct, remaining }
        )
      : t(
          'notifications.content.why.usageAlert',
          "Approaching a limit — the exact usage percentage isn't in the data. Check the usage panel before deciding: upgrade, data cleanup, or raise the limit."
        );
  }
  if (nType === 'SUBSCRIPTION_CHANGE') {
    return t(
      'notifications.content.why.subscriptionChange',
      'Subscription or plan changed — review billing details.'
    );
  }
  if (nType.startsWith('DBR77_')) {
    if (nType.includes('KB')) {
      return t(
        'notifications.content.why.dbr77Kb',
        'New knowledge base content — worth reading and applying.'
      );
    }
    if (nType.includes('INSTRUCTION')) {
      return t(
        'notifications.content.why.dbr77Instruction',
        'New instruction for working in the system — it will help you execute faster.'
      );
    }
    if (nType.includes('UPDATE') || nType.includes('RELEASE')) {
      return t('notifications.content.why.dbr77Update', 'DBR77 updates — review what changed.');
    }
    return t('notifications.content.why.dbr77Generic', 'DBR77 communication — review details.');
  }
  if (nType.includes('GATE')) {
    return t(
      'notifications.content.why.gate',
      'Gate requires your GO/NO-GO decision — downstream steps of the initiative stay paused until you decide.'
    );
  }
  if (nType.includes('COMPLETED') || nType.includes('MILESTONE')) {
    return t('notifications.content.why.milestone', 'Milestone achieved.');
  }
  return t(
    'notifications.content.why.default',
    "No matching template for this notification type — open the linked record to see what's required."
  );
};

/**
 * Build a short one-line context string for dropdown display
 */
const buildContextLine = (n: NotificationLike, t: TFunction): string => {
  // Prefer enriched contextLine from backend
  const contextLine = normalize(
    (n.data?.contextLine || n.data?.context_line) as string | undefined
  );
  if (contextLine) return contextLine;

  const nType = normalize(n.type).toUpperCase();
  const data = n.data || {};

  // Build from enriched data fields
  const taskTitle = normalize(
    (data.task_title || data.taskTitle || data.entityName) as string | undefined
  );
  const daysOverdue = Number(data.days_overdue || data.daysOverdue || 0);
  const assignee = normalize((data.assignee || data.entityAssignee) as string | undefined);

  if (nType.includes('OVERDUE') && taskTitle) {
    const parts = [];
    if (daysOverdue > 0) {
      parts.push(
        t('notifications.content.context.daysPastDeadline', '{{count}}d past deadline', {
          count: daysOverdue,
        })
      );
    }
    if (assignee) parts.push(assignee);
    return parts.length > 0 ? `${taskTitle} — ${parts.join(' · ')}` : taskTitle;
  }

  if (nType.includes('DECISION') && data.decision_title) {
    const deadlineDays = Number(data.deadline_days || 0);
    return deadlineDays > 0
      ? t(
          'notifications.content.context.decisionDeadline',
          '{{title}} — {{count}}d until deadline',
          { title: data.decision_title, count: deadlineDays }
        )
      : String(data.decision_title);
  }

  if (nType.includes('AI') && data.savings_annual) {
    return t(
      'notifications.content.context.potentialSavings',
      'Potential savings: {{amount}}/year',
      { amount: data.savings_annual }
    );
  }
  if (nType.startsWith('DBR77_')) {
    const title = normalize(
      (data.articleTitle || data.article_title || data.title || data.kbTitle) as string | undefined
    );
    const version = normalize((data.version || data.release || data.build) as string | undefined);
    if (title && version) return `${title} — ${version}`;
    if (title) return title;
    if (version) {
      return t('notifications.content.context.updateVersion', 'Update — {{version}}', {
        version,
      });
    }
  }
  if (nType === 'PAYMENT_FAILED') {
    const inv = normalize((data.invoiceId || data.invoice_id) as string | undefined);
    return inv
      ? t('notifications.content.context.invoice', 'Invoice {{id}}', { id: inv })
      : t('notifications.content.context.paymentIssue', 'Payment issue');
  }
  if (nType === 'USAGE_ALERT' || nType.includes('LIMIT')) {
    const metric = normalize(
      (data.metric || data.limitName || data.limit_name) as string | undefined
    );
    const pct = Number((data.usagePercent || data.usage_percent || data.percent_used) as any);
    const pctStr = Number.isFinite(pct) && pct > 0 ? `${pct}%` : '';
    if (metric && pctStr) return `${metric} — ${pctStr}`;
    if (metric) return metric;
  }

  // Fallback to truncated whyImportant
  const why = inferWhy(n, t);
  return why.length > 80 ? why.substring(0, 77) + '...' : why;
};

const inferBlocked = (n: NotificationLike, t: TFunction): string => {
  const data = n.data || {};
  const blocked = normalize(
    (data.blocked || data.blockedWhat || data.blocked_summary) as string | undefined
  );
  if (blocked) return blocked;

  if (n.relatedObjectType && n.relatedObjectId) {
    const type = String(n.relatedObjectType).toUpperCase();
    if (type === 'DECISION') {
      return t(
        'notifications.content.blocked.decision',
        'Blocks: a decision to be made (may block tasks).'
      );
    }
    if (type === 'TASK') {
      return t(
        'notifications.content.blocked.task',
        'Blocks: task progress (check blockers/deadline).'
      );
    }
  }
  return t('notifications.content.blocked.unknown', 'Blocks: unknown (check linked entity).');
};

const inferPrimaryCta = (n: NotificationLike, t: TFunction): NotificationPrimaryCta => {
  const link = normalize(
    (n.data?.link || n.data?.url || n.data?.actionUrl || n.data?.action_url || n.data?.href) as
      | string
      | undefined
  );
  const relatedType = normalize(n.relatedObjectType).toUpperCase();
  const relatedId = normalize(n.relatedObjectId);
  const openDocumentLabel = t('notifications.content.cta.openDocument', 'Open document');

  if (relatedType === 'TASK' && relatedId) {
    return {
      kind: 'open_task',
      id: relatedId,
      label: openDocumentLabel,
    };
  }
  if (relatedType === 'DECISION' && relatedId) {
    return {
      kind: 'open_decision',
      id: relatedId,
      label: openDocumentLabel,
    };
  }
  if (relatedType === 'PROJECT' && relatedId) {
    return {
      kind: 'open_project',
      id: relatedId,
      label: openDocumentLabel,
    };
  }
  if (link) {
    return { kind: 'open_link', href: link, label: openDocumentLabel };
  }
  return { kind: 'none' };
};

// ── Contextual Expected Action ────────────────────────────────────────────────

const inferExpectedAction = (
  n: NotificationLike,
  primaryCta: NotificationPrimaryCta,
  t: TFunction
): string => {
  const nType = normalize(n.type).toUpperCase();
  const data = n.data || {};
  const severity = normalize(n.severity).toUpperCase();
  const daysOverdue = Number(data.days_overdue || data.daysOverdue || 0);
  const assignee = normalize((data.assignee || data.entityAssignee) as string | undefined);
  const taskTitle = normalize(
    (data.task_title || data.taskTitle || data.entityName) as string | undefined
  );

  // TASK_OVERDUE — contextual based on severity and days
  if (nType === 'TASK_OVERDUE') {
    if (severity === 'CRITICAL' || daysOverdue > 3) {
      return t(
        'notifications.content.action.taskOverdueCritical',
        'Immediately contact{{assigneePart}} and escalate to the project manager. {{taskPart}} {{count}}d overdue.',
        {
          assigneePart: assignee ? ` ${assignee}` : ' the assignee',
          taskPart: taskTitle ? `Task "${taskTitle}" is` : 'Task is',
          count: daysOverdue,
        }
      );
    }
    return t(
      'notifications.content.action.taskOverdue',
      'Check progress{{taskPart}} and update the deadline{{ownerPart}}.',
      {
        taskPart: taskTitle ? ` on "${taskTitle}"` : '',
        ownerPart: assignee ? `. Owner: ${assignee}` : '',
      }
    );
  }

  // TASK_BLOCKED
  if (nType === 'TASK_BLOCKED' || nType.includes('BLOCKED')) {
    const blocker = normalize(
      (data.blocker || data.blockerName || data.blocker_name) as string | undefined
    );
    return t(
      'notifications.content.action.taskBlocked',
      'Remove the blocker{{blockerPart}} and unblock progress{{taskPart}}.',
      {
        blockerPart: blocker ? ` ("${blocker}")` : '',
        taskPart: taskTitle ? ` on "${taskTitle}"` : '',
      }
    );
  }

  // TASK_ASSIGNED
  if (nType === 'TASK_ASSIGNED' || nType.includes('ASSIGN')) {
    return t(
      'notifications.content.action.taskAssigned',
      'Review the assigned task{{taskPart}}, confirm scope, and start work.',
      { taskPart: taskTitle ? ` "${taskTitle}"` : '' }
    );
  }

  // DECISION_REQUIRED / DECISION_OVERDUE
  if (nType.includes('DECISION')) {
    const decisionTitle = normalize(
      (data.decision_title || data.decisionTitle) as string | undefined
    );
    if (nType === 'DECISION_OVERDUE') {
      return t(
        'notifications.content.action.decisionOverdue',
        'Immediately make a decision{{decisionPart}} — delay is blocking downstream work.',
        { decisionPart: decisionTitle ? ` on "${decisionTitle}"` : '' }
      );
    }
    return t(
      'notifications.content.action.decisionRequired',
      'Analyze context and make a decision{{decisionPart}}. Consult the team if needed.',
      { decisionPart: decisionTitle ? ` on "${decisionTitle}"` : '' }
    );
  }

  // AI notifications
  if (nType === 'AI_RISK_DETECTED') {
    const riskLevel = normalize((data.riskLevel || data.risk_level) as string | undefined);
    return t(
      'notifications.content.action.aiRiskDetected',
      'Review the risk{{riskPart}} detected by AI. Verify the data and decide on action.',
      { riskPart: riskLevel ? ` (level: ${riskLevel})` : '' }
    );
  }
  if (nType === 'AI_RECOMMENDATION') {
    return t(
      'notifications.content.action.aiRecommendation',
      'Review the AI recommendation, verify assumptions, and apply or dismiss with justification.'
    );
  }
  if (nType === 'AI_OVERLOAD_DETECTED') {
    return t(
      'notifications.content.action.aiOverload',
      'AI detected resource overload. Review team workload and redistribute tasks.'
    );
  }
  if (nType === 'AI_DEPENDENCY_CONFLICT') {
    return t(
      'notifications.content.action.aiDependencyConflict',
      'AI detected a dependency conflict. Review the timeline and resolve scheduling conflicts.'
    );
  }

  // GATE
  if (nType.includes('GATE')) {
    return t(
      'notifications.content.action.gate',
      'Review gate criteria and make a GO/NO-GO decision.'
    );
  }

  // Billing / payments
  if (nType === 'PAYMENT_FAILED') {
    return t(
      'notifications.content.action.paymentFailed',
      'Open billing, update your payment method, and retry the transaction.'
    );
  }
  if (nType === 'USAGE_ALERT' || nType.includes('LIMIT')) {
    const metric = normalize(
      (data.metric || data.limitName || data.limit_name) as string | undefined
    );
    const pct = Number((data.usagePercent || data.usage_percent || data.percent_used) as any);
    const pctStr = Number.isFinite(pct) && pct > 0 ? `${pct}%` : '';
    return t(
      'notifications.content.action.usageAlert',
      'Approaching limit{{metricPart}}{{pctPart}}. Decide: upgrade plan, clean up data, or increase limit.',
      {
        metricPart: metric ? ` "${metric}"` : '',
        pctPart: pctStr ? ` (${pctStr})` : '',
      }
    );
  }
  if (nType === 'SUBSCRIPTION_CHANGE') {
    return t(
      'notifications.content.action.subscriptionChange',
      'Review subscription change details and confirm new terms.'
    );
  }
  if (nType === 'INVOICE_READY') {
    return t(
      'notifications.content.action.invoiceReady',
      'New invoice available. Review and forward to accounting.'
    );
  }

  // DBR77
  if (nType === 'DBR77_KB_NEW') {
    return t(
      'notifications.content.action.dbr77KbNew',
      'Read the new knowledge base article and apply it to your work.'
    );
  }
  if (nType === 'DBR77_INSTRUCTION') {
    return t(
      'notifications.content.action.dbr77Instruction',
      'Read the new instruction and adjust your workflow.'
    );
  }
  if (nType === 'DBR77_UPDATE' || nType === 'DBR77_RELEASE_NOTES') {
    return t(
      'notifications.content.action.dbr77Update',
      'Review system updates. Check if changes affect your tasks.'
    );
  }

  // SYSTEM_ALERT
  if (nType === 'SYSTEM_ALERT') {
    return t(
      'notifications.content.action.systemAlert',
      'Read the system alert and take the required action.'
    );
  }

  // Completed / milestone — informational
  if (nType.includes('COMPLETED') || nType.includes('MILESTONE')) {
    return t(
      'notifications.content.action.milestone',
      'Informational — no direct action required. You may dismiss.'
    );
  }

  // Fallback with CTA
  if (primaryCta.kind !== 'none') {
    return t('notifications.content.action.doCta', 'Do: {{label}}', { label: primaryCta.label });
  }

  return t('notifications.content.action.default', 'Open the linked entity and take action.');
};

// ── Contextual Checklist Generation ───────────────────────────────────────────

type CL = SuggestedChecklistItem;
const cl = (text: string, urgency: CL['urgency'] = 'normal'): CL => ({ text, urgency });

const inferChecklist = (n: NotificationLike, t: TFunction): SuggestedChecklistItem[] => {
  const nType = normalize(n.type).toUpperCase();
  const data = n.data || {};
  const severity = normalize(n.severity).toUpperCase();
  const daysOverdue = Number(data.days_overdue || data.daysOverdue || 0);
  const assignee = normalize((data.assignee || data.entityAssignee) as string | undefined);

  // ── TASK types ──
  if (nType === 'TASK_OVERDUE') {
    const isCritical = severity === 'CRITICAL' || daysOverdue > 3;
    if (isCritical) {
      return [
        cl(
          t(
            'notifications.content.checklist.taskOverdueCritical.blockers',
            'Check blockers and reason for delay'
          ),
          'critical'
        ),
        cl(
          assignee
            ? t(
                'notifications.content.checklist.taskOverdueCritical.contactNamed',
                'Contact {{assignee}}',
                {
                  assignee,
                }
              )
            : t(
                'notifications.content.checklist.taskOverdueCritical.contact',
                'Contact the assignee'
              ),
          'critical'
        ),
        cl(
          t(
            'notifications.content.checklist.taskOverdueCritical.deadline',
            'Set a new realistic deadline'
          ),
          'critical'
        ),
        cl(
          t(
            'notifications.content.checklist.taskOverdueCritical.escalate',
            'Escalate to manager if no response within 2h'
          ),
          'normal'
        ),
        cl(
          t('notifications.content.checklist.taskOverdueCritical.status', 'Update task status'),
          'normal'
        ),
        cl(
          t(
            'notifications.content.checklist.taskOverdueCritical.notify',
            'Notify stakeholders about the new plan'
          ),
          'optional'
        ),
      ];
    }
    return [
      cl(
        t('notifications.content.checklist.taskOverdue.open', 'Open the task and review details'),
        'normal'
      ),
      cl(t('notifications.content.checklist.taskOverdue.blockers', 'Check for blockers'), 'normal'),
      cl(
        t('notifications.content.checklist.taskOverdue.update', 'Update deadline or status'),
        'normal'
      ),
      cl(
        t('notifications.content.checklist.taskOverdue.notify', 'Notify the team about the change'),
        'optional'
      ),
    ];
  }

  if (nType === 'TASK_BLOCKED' || nType.includes('BLOCKED')) {
    return [
      cl(
        t('notifications.content.checklist.taskBlocked.identify', 'Identify the blocker'),
        'critical'
      ),
      cl(
        t('notifications.content.checklist.taskBlocked.contact', 'Contact the blocking party'),
        'critical'
      ),
      cl(
        t(
          'notifications.content.checklist.taskBlocked.plan',
          'Establish a plan to remove the blocker'
        ),
        'normal'
      ),
      cl(t('notifications.content.checklist.taskBlocked.status', 'Update task status'), 'normal'),
      cl(
        t(
          'notifications.content.checklist.taskBlocked.escalate',
          'Escalate if blocker persists > 24h'
        ),
        'optional'
      ),
    ];
  }

  if (nType === 'TASK_ASSIGNED' || nType.includes('ASSIGN')) {
    return [
      cl(
        t(
          'notifications.content.checklist.taskAssigned.review',
          'Review task description and scope'
        ),
        'normal'
      ),
      cl(
        t('notifications.content.checklist.taskAssigned.confirm', 'Confirm the deadline'),
        'normal'
      ),
      cl(
        t(
          'notifications.content.checklist.taskAssigned.dependencies',
          'Check dependencies and blockers'
        ),
        'normal'
      ),
      cl(
        t('notifications.content.checklist.taskAssigned.start', 'Start work or raise concerns'),
        'normal'
      ),
    ];
  }

  // ── DECISION types ──
  if (nType === 'DECISION_OVERDUE') {
    return [
      cl(
        t('notifications.content.checklist.decisionOverdue.analyze', 'Analyze decision context'),
        'critical'
      ),
      cl(
        t('notifications.content.checklist.decisionOverdue.consult', 'Consult key stakeholders'),
        'critical'
      ),
      cl(
        t(
          'notifications.content.checklist.decisionOverdue.decide',
          'Make the decision or escalate'
        ),
        'critical'
      ),
      cl(
        t('notifications.content.checklist.decisionOverdue.document', 'Document the rationale'),
        'normal'
      ),
      cl(
        t('notifications.content.checklist.decisionOverdue.notify', 'Notify dependent teams'),
        'normal'
      ),
    ];
  }

  if (nType === 'DECISION_REQUIRED') {
    return [
      cl(
        t(
          'notifications.content.checklist.decisionRequired.review',
          'Review data and decision context'
        ),
        'normal'
      ),
      cl(
        t('notifications.content.checklist.decisionRequired.consult', 'Consult the team if needed'),
        'normal'
      ),
      cl(
        t(
          'notifications.content.checklist.decisionRequired.decide',
          'Make the decision or delegate'
        ),
        'normal'
      ),
      cl(
        t(
          'notifications.content.checklist.decisionRequired.document',
          'Document the choice and rationale'
        ),
        'optional'
      ),
    ];
  }

  // ── AI types ──
  if (nType === 'AI_RISK_DETECTED') {
    return [
      cl(
        t('notifications.content.checklist.aiRiskDetected.review', 'Review detected risk details'),
        'critical'
      ),
      cl(
        t('notifications.content.checklist.aiRiskDetected.verify', 'Verify AI input data'),
        'normal'
      ),
      cl(
        t(
          'notifications.content.checklist.aiRiskDetected.assess',
          'Assess real impact on the project'
        ),
        'normal'
      ),
      cl(
        t(
          'notifications.content.checklist.aiRiskDetected.act',
          'Take mitigating action or dismiss'
        ),
        'normal'
      ),
      cl(
        t('notifications.content.checklist.aiRiskDetected.update', 'Update the risk register'),
        'optional'
      ),
    ];
  }

  if (nType === 'AI_RECOMMENDATION') {
    return [
      cl(
        t(
          'notifications.content.checklist.aiRecommendation.review',
          'Review the AI recommendation'
        ),
        'normal'
      ),
      cl(
        t('notifications.content.checklist.aiRecommendation.verify', 'Verify assumptions and data'),
        'normal'
      ),
      cl(
        t(
          'notifications.content.checklist.aiRecommendation.apply',
          'Apply or dismiss with justification'
        ),
        'normal'
      ),
    ];
  }

  if (nType === 'AI_OVERLOAD_DETECTED') {
    return [
      cl(
        t('notifications.content.checklist.aiOverload.review', 'Review team workload'),
        'critical'
      ),
      cl(
        t('notifications.content.checklist.aiOverload.identify', 'Identify most overloaded people'),
        'normal'
      ),
      cl(
        t(
          'notifications.content.checklist.aiOverload.redistribute',
          'Redistribute or postpone tasks'
        ),
        'normal'
      ),
      cl(
        t('notifications.content.checklist.aiOverload.notify', 'Notify team about changes'),
        'optional'
      ),
    ];
  }

  if (nType === 'AI_DEPENDENCY_CONFLICT') {
    return [
      cl(
        t(
          'notifications.content.checklist.aiDependencyConflict.review',
          'Review conflicting dependencies'
        ),
        'critical'
      ),
      cl(
        t('notifications.content.checklist.aiDependencyConflict.compare', 'Compare task timelines'),
        'normal'
      ),
      cl(
        t(
          'notifications.content.checklist.aiDependencyConflict.reorder',
          'Reorder or shift deadlines'
        ),
        'normal'
      ),
      cl(
        t(
          'notifications.content.checklist.aiDependencyConflict.confirm',
          'Confirm new schedule with team'
        ),
        'optional'
      ),
    ];
  }

  // ── GATE types ──
  if (nType.includes('GATE')) {
    return [
      cl(t('notifications.content.checklist.gate.review', 'Review gate criteria'), 'normal'),
      cl(t('notifications.content.checklist.gate.check', 'Check deliverables status'), 'normal'),
      cl(t('notifications.content.checklist.gate.decide', 'Make GO/NO-GO decision'), 'critical'),
      cl(t('notifications.content.checklist.gate.document', 'Document the decision'), 'normal'),
    ];
  }

  // ── Billing / Payment types ──
  if (nType === 'PAYMENT_FAILED') {
    return [
      cl(
        t('notifications.content.checklist.paymentFailed.open', 'Open billing section'),
        'critical'
      ),
      cl(
        t('notifications.content.checklist.paymentFailed.check', 'Check payment method'),
        'critical'
      ),
      cl(
        t('notifications.content.checklist.paymentFailed.update', 'Update card/account details'),
        'normal'
      ),
      cl(
        t('notifications.content.checklist.paymentFailed.retry', 'Retry the transaction'),
        'normal'
      ),
      cl(
        t('notifications.content.checklist.paymentFailed.confirm', 'Confirm payment success'),
        'optional'
      ),
    ];
  }

  if (nType === 'USAGE_ALERT' || nType.includes('LIMIT')) {
    return [
      cl(t('notifications.content.checklist.usageAlert.check', 'Check current usage'), 'normal'),
      cl(
        t(
          'notifications.content.checklist.usageAlert.identify',
          'Identify what consumes resources'
        ),
        'normal'
      ),
      cl(
        t(
          'notifications.content.checklist.usageAlert.decide',
          'Decide: upgrade, cleanup, or limit'
        ),
        'normal'
      ),
      cl(
        t('notifications.content.checklist.usageAlert.implement', 'Implement chosen strategy'),
        'optional'
      ),
    ];
  }

  if (nType === 'SUBSCRIPTION_CHANGE') {
    return [
      cl(
        t('notifications.content.checklist.subscriptionChange.review', 'Review new terms'),
        'normal'
      ),
      cl(
        t(
          'notifications.content.checklist.subscriptionChange.confirm',
          'Confirm feature availability'
        ),
        'normal'
      ),
      cl(
        t('notifications.content.checklist.subscriptionChange.update', 'Update budget if needed'),
        'optional'
      ),
    ];
  }

  if (nType === 'INVOICE_READY') {
    return [
      cl(
        t('notifications.content.checklist.invoiceReady.download', 'Download the invoice'),
        'normal'
      ),
      cl(
        t('notifications.content.checklist.invoiceReady.verify', 'Verify amount and period'),
        'normal'
      ),
      cl(
        t('notifications.content.checklist.invoiceReady.forward', 'Forward to accounting'),
        'optional'
      ),
    ];
  }

  // ── DBR77 types ──
  if (nType === 'DBR77_KB_NEW') {
    return [
      cl(t('notifications.content.checklist.dbr77KbNew.read', 'Read the new article'), 'normal'),
      cl(
        t('notifications.content.checklist.dbr77KbNew.check', 'Check if it applies to your tasks'),
        'normal'
      ),
      cl(
        t('notifications.content.checklist.dbr77KbNew.apply', 'Apply the knowledge in practice'),
        'optional'
      ),
    ];
  }

  if (nType === 'DBR77_INSTRUCTION') {
    return [
      cl(
        t('notifications.content.checklist.dbr77Instruction.read', 'Read the new instruction'),
        'normal'
      ),
      cl(
        t('notifications.content.checklist.dbr77Instruction.adjust', 'Adjust your workflow'),
        'normal'
      ),
      cl(
        t(
          'notifications.content.checklist.dbr77Instruction.confirm',
          'Confirm changes implemented'
        ),
        'optional'
      ),
    ];
  }

  if (nType === 'DBR77_UPDATE' || nType === 'DBR77_RELEASE_NOTES') {
    return [
      cl(t('notifications.content.checklist.dbr77Update.review', 'Review the changelog'), 'normal'),
      cl(
        t('notifications.content.checklist.dbr77Update.check', 'Check impact on your tasks'),
        'normal'
      ),
      cl(t('notifications.content.checklist.dbr77Update.test', 'Test new features'), 'optional'),
    ];
  }

  // ── SYSTEM_ALERT ──
  if (nType === 'SYSTEM_ALERT') {
    return [
      cl(t('notifications.content.checklist.systemAlert.read', 'Read alert details'), 'normal'),
      cl(
        t('notifications.content.checklist.systemAlert.assess', 'Assess impact on your work'),
        'normal'
      ),
      cl(
        t('notifications.content.checklist.systemAlert.act', 'Take the required action'),
        'normal'
      ),
    ];
  }

  // ── Completed / Milestone — minimal ──
  if (nType.includes('COMPLETED') || nType.includes('MILESTONE')) {
    return [
      cl(t('notifications.content.checklist.milestone.review', 'Review the summary'), 'optional'),
      cl(
        t('notifications.content.checklist.milestone.dismiss', 'Dismiss the notification'),
        'optional'
      ),
    ];
  }

  // ── Generic fallback ──
  return [
    cl(
      t('notifications.content.checklist.default.review', 'Review notification details'),
      'normal'
    ),
    cl(t('notifications.content.checklist.default.act', 'Take appropriate action'), 'normal'),
  ];
};

// ── Main builder ──────────────────────────────────────────────────────────────

export const buildNotificationContent = (
  n: NotificationLike,
  t: TFunction
): NotificationContentContract => {
  const what = normalize(n.title) || t('notifications.content.defaultTitle', 'Notification');
  const whyImportant = inferWhy(n, t);
  const contextLine = buildContextLine(n, t);
  const blocked = inferBlocked(n, t);
  const primaryCta = inferPrimaryCta(n, t);
  const expectedAction = inferExpectedAction(n, primaryCta, t);
  const suggestedChecklist = inferChecklist(n, t);

  const whyYouGotIt = normalize(
    (n.data?.whyYouGotIt || n.data?.why_you_got_it || n.data?.roleReason) as string | undefined
  );

  return {
    priority: computePriority(n),
    what,
    whyImportant,
    contextLine,
    blocked,
    expectedAction,
    suggestedChecklist,
    primaryCta,
    whyYouGotIt: whyYouGotIt || undefined,
  };
};
