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

export type NotificationContentContract = {
  priority: CanonicalNotificationPriority;
  what: string;
  whyImportant: string;
  contextLine: string;
  blocked: string;
  expectedAction: string;
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
  if (t === 'TASK_OVERDUE') {
    const daysOverdue = Number(n.data?.days_overdue || n.data?.daysOverdue || 1);
    return daysOverdue > 3 ? 'CRITICAL' : 'HIGH';
  }
  if (t.includes('ESCALAT')) return 'HIGH';
  if (t === 'DECISION_REQUIRED' || t === 'GATE_PENDING_APPROVAL') return 'HIGH';
  if (t === 'AI_RISK_DETECTED' || t === 'AI_OVERLOAD_DETECTED') return 'HIGH';
  if (t === 'AI_DEPENDENCY_CONFLICT') return 'HIGH';

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

const inferWhy = (n: NotificationLike, isPolish: boolean): string => {
  // First priority: use the full message from backend (enriched data)
  const msg = normalize(n.message || n.body);
  if (msg && msg.length > 20) return msg;

  // Second: use contextLine from enriched data
  const contextLine = normalize(
    (n.data?.contextLine || n.data?.context_line || n.data?.impact) as string | undefined
  );
  if (contextLine) return contextLine;

  // Fallback: infer from type
  const t = normalize(n.type).toUpperCase();
  const daysOverdue = Number(n.data?.days_overdue || n.data?.daysOverdue || 0);

  if (t.includes('OVERDUE') && daysOverdue > 0) {
    return isPolish
      ? `Termin minął ${daysOverdue} ${daysOverdue === 1 ? 'dzień' : 'dni'} temu — rośnie koszt braku reakcji.`
      : `Deadline passed ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} ago — cost of inaction is rising.`;
  }
  if (t.includes('OVERDUE')) {
    return isPolish
      ? 'Termin minął — rośnie koszt braku reakcji.'
      : 'Deadline passed — cost of inaction is rising.';
  }
  if (t.includes('DUE') || t.includes('DUE_SOON')) {
    return isPolish
      ? 'Termin zbliża się — wymaga planu i potwierdzenia.'
      : 'Deadline is approaching — needs a plan and confirmation.';
  }
  if (t.includes('ESCALAT')) {
    return isPolish ? 'Brak reakcji spowodował eskalację.' : 'No response triggered an escalation.';
  }
  if (t.includes('BLOCKED')) {
    return isPolish
      ? 'Zablokowane — wymaga natychmiastowej reakcji.'
      : 'Blocked — requires immediate attention.';
  }
  if (t.includes('ASSIGN')) {
    return isPolish ? 'Nowe przypisanie — potrzebny ruch.' : 'New assignment — action required.';
  }
  if (t.includes('AI_RISK')) {
    return isPolish
      ? 'AI wykryło ryzyko — sprawdź szczegóły.'
      : 'AI detected a risk — review the details.';
  }
  if (t.includes('AI')) {
    return isPolish
      ? 'AI sugeruje działanie — sprawdź rekomendację.'
      : 'AI suggests action — review the recommendation.';
  }
  if (t.includes('GATE')) {
    return isPolish
      ? 'Bramka wymaga Twojej decyzji GO/NO-GO.'
      : 'Gate requires your GO/NO-GO decision.';
  }
  if (t.includes('COMPLETED') || t.includes('MILESTONE')) {
    return isPolish ? 'Kamień milowy osiągnięty.' : 'Milestone achieved.';
  }
  return isPolish ? 'Wymaga reakcji w systemie.' : 'Requires action in the system.';
};

/**
 * Build a short one-line context string for dropdown display
 */
const buildContextLine = (n: NotificationLike, isPolish: boolean): string => {
  // Prefer enriched contextLine from backend
  const contextLine = normalize(
    (n.data?.contextLine || n.data?.context_line) as string | undefined
  );
  if (contextLine) return contextLine;

  const t = normalize(n.type).toUpperCase();
  const data = n.data || {};

  // Build from enriched data fields
  const taskTitle = normalize(
    (data.task_title || data.taskTitle || data.entityName) as string | undefined
  );
  const daysOverdue = Number(data.days_overdue || data.daysOverdue || 0);
  const assignee = normalize((data.assignee || data.entityAssignee) as string | undefined);

  if (t.includes('OVERDUE') && taskTitle) {
    const parts = [];
    if (daysOverdue > 0) {
      parts.push(isPolish ? `${daysOverdue}d po terminie` : `${daysOverdue}d past deadline`);
    }
    if (assignee) parts.push(assignee);
    return parts.length > 0 ? `${taskTitle} — ${parts.join(' · ')}` : taskTitle;
  }

  if (t.includes('DECISION') && data.decision_title) {
    const deadlineDays = Number(data.deadline_days || 0);
    return deadlineDays > 0
      ? isPolish
        ? `${data.decision_title} — ${deadlineDays}d do deadline`
        : `${data.decision_title} — ${deadlineDays}d until deadline`
      : String(data.decision_title);
  }

  if (t.includes('AI') && data.savings_annual) {
    return isPolish
      ? `Potencjalne oszczędności: ${data.savings_annual}/rok`
      : `Potential savings: ${data.savings_annual}/year`;
  }

  // Fallback to truncated whyImportant
  const why = inferWhy(n, isPolish);
  return why.length > 80 ? why.substring(0, 77) + '...' : why;
};

const inferBlocked = (n: NotificationLike, isPolish: boolean): string => {
  const data = n.data || {};
  const blocked = normalize(
    (data.blocked || data.blockedWhat || data.blocked_summary) as string | undefined
  );
  if (blocked) return blocked;

  if (n.relatedObjectType && n.relatedObjectId) {
    const type = String(n.relatedObjectType).toUpperCase();
    if (type === 'DECISION') {
      return isPolish
        ? 'Blokuje: decyzję do podjęcia (może blokować taski).'
        : 'Blocks: a decision to be made (may block tasks).';
    }
    if (type === 'TASK') {
      return isPolish
        ? 'Blokuje: ruch w tasku (sprawdź blokadę/termin).'
        : 'Blocks: task progress (check blockers/deadline).';
    }
  }
  return isPolish
    ? 'Blokuje: nieustalone (sprawdź powiązaną encję).'
    : 'Blocks: unknown (check linked entity).';
};

const inferPrimaryCta = (n: NotificationLike, isPolish: boolean): NotificationPrimaryCta => {
  const link = normalize(
    (n.data?.link || n.data?.url || n.data?.actionUrl || n.data?.action_url || n.data?.href) as
      | string
      | undefined
  );
  const relatedType = normalize(n.relatedObjectType).toUpperCase();
  const relatedId = normalize(n.relatedObjectId);

  if (relatedType === 'TASK' && relatedId) {
    return {
      kind: 'open_task',
      id: relatedId,
      label: isPolish ? 'Otwórz task' : 'Open task',
    };
  }
  if (relatedType === 'DECISION' && relatedId) {
    return {
      kind: 'open_decision',
      id: relatedId,
      label: isPolish ? 'Otwórz decyzję' : 'Open decision',
    };
  }
  if (relatedType === 'PROJECT' && relatedId) {
    return {
      kind: 'open_project',
      id: relatedId,
      label: isPolish ? 'Otwórz projekt' : 'Open project',
    };
  }
  if (link) {
    return { kind: 'open_link', href: link, label: isPolish ? 'Otwórz' : 'Open' };
  }
  return { kind: 'none' };
};

export const buildNotificationContent = (
  n: NotificationLike,
  isPolish: boolean
): NotificationContentContract => {
  const what = normalize(n.title) || (isPolish ? 'Powiadomienie' : 'Notification');
  const whyImportant = inferWhy(n, isPolish);
  const contextLine = buildContextLine(n, isPolish);
  const blocked = inferBlocked(n, isPolish);
  const primaryCta = inferPrimaryCta(n, isPolish);

  const expectedAction =
    primaryCta.kind === 'none'
      ? isPolish
        ? 'Otwórz powiązaną encję i wykonaj akcję.'
        : 'Open the linked entity and take action.'
      : isPolish
        ? `Wykonaj: ${primaryCta.label}`
        : `Do: ${primaryCta.label}`;

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
    primaryCta,
    whyYouGotIt: whyYouGotIt || undefined,
  };
};
