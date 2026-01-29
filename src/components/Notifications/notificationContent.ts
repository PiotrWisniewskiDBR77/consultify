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
  severity?: 'INFO' | 'WARNING' | 'CRITICAL' | string;
  isRead?: boolean;
  createdAt?: string;
  readAt?: string;
  relatedObjectType?: 'TASK' | 'INITIATIVE' | 'DECISION' | 'PROJECT' | 'GATE' | string;
  relatedObjectId?: string;
  data?: Record<string, unknown>;
};

export type NotificationContentContract = {
  priority: CanonicalNotificationPriority;
  what: string;
  whyImportant: string;
  blocked: string;
  expectedAction: string;
  primaryCta: NotificationPrimaryCta;
  whyYouGotIt?: string;
};

const normalize = (v?: string | null) => String(v || '').trim();

const priorityFromSeverity = (severity?: string): CanonicalNotificationPriority => {
  const s = normalize(severity).toUpperCase();
  if (s === 'CRITICAL' || s === 'URGENT') return 'CRITICAL';
  if (s === 'WARNING' || s === 'HIGH') return 'HIGH';
  if (s === 'INFO' || s === 'MEDIUM') return 'MEDIUM';
  return 'LOW';
};

const inferWhy = (n: NotificationLike, isPolish: boolean): string => {
  const msg = normalize(n.message);
  if (msg) return msg;

  const t = normalize(n.type).toUpperCase();
  if (t.includes('OVERDUE')) {
    return isPolish
      ? 'Termin minął – rośnie koszt braku reakcji.'
      : 'Deadline passed — cost of inaction is rising.';
  }
  if (t.includes('DUE') || t.includes('DUE_SOON')) {
    return isPolish
      ? 'Termin zbliża się – wymaga planu i potwierdzenia.'
      : 'Deadline is approaching — needs a plan and confirmation.';
  }
  if (t.includes('ESCALAT')) {
    return isPolish ? 'Brak reakcji spowodował eskalację.' : 'No response triggered an escalation.';
  }
  if (t.includes('ASSIGN')) {
    return isPolish ? 'Nowe przypisanie – potrzebny ruch.' : 'New assignment — action required.';
  }
  if (t.includes('AI')) {
    return isPolish
      ? 'AI sugeruje działanie – sprawdź rekomendację.'
      : 'AI suggests action — review the recommendation.';
  }
  return isPolish ? 'Wymaga reakcji w systemie.' : 'Requires action in the system.';
};

const inferBlocked = (n: NotificationLike, isPolish: boolean): string => {
  const data = n.data || {};
  const blocked = normalize(data.blocked || data.blockedWhat || data.blocked_summary);
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
    n.data?.link || n.data?.url || n.data?.actionUrl || n.data?.action_url || n.data?.href
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
    n.data?.whyYouGotIt || n.data?.why_you_got_it || n.data?.roleReason
  );

  return {
    priority: priorityFromSeverity(n.severity),
    what,
    whyImportant,
    blocked,
    expectedAction,
    primaryCta,
    whyYouGotIt: whyYouGotIt || undefined,
  };
};
