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
  if (t === 'PAYMENT_FAILED') {
    return isPolish
      ? 'Płatność nie powiodła się — może to zatrzymać dostęp do funkcji. Zaktualizuj metodę płatności.'
      : 'Payment failed — it may affect access to features. Update your payment method.';
  }
  if (t === 'USAGE_ALERT' || t.includes('LIMIT')) {
    const usedPct = Number(
      (n.data?.usagePercent || n.data?.usage_percent || n.data?.percent_used) as
        | number
        | string
        | undefined
    );
    const pct = Number.isFinite(usedPct) && usedPct > 0 ? usedPct : undefined;
    return isPolish
      ? `Zbliżasz się do limitu${pct ? ` (${pct}%)` : ''} — zaplanuj działania (upgrade/porządek/limity).`
      : `You are approaching a limit${pct ? ` (${pct}%)` : ''} — plan actions (upgrade/cleanup/limits).`;
  }
  if (t === 'SUBSCRIPTION_CHANGE') {
    return isPolish
      ? 'Zmieniono subskrypcję lub plan — sprawdź szczegóły rozliczeń.'
      : 'Subscription or plan changed — review billing details.';
  }
  if (t.startsWith('DBR77_')) {
    if (t.includes('KB')) {
      return isPolish
        ? 'Nowa wiedza w bazie wiedzy — warto przeczytać i zastosować.'
        : 'New knowledge base content — worth reading and applying.';
    }
    if (t.includes('INSTRUCTION')) {
      return isPolish
        ? 'Nowa instrukcja pracy w systemie — ułatwi Ci wykonywanie zadań.'
        : 'New instruction for working in the system — it will help you execute faster.';
    }
    if (t.includes('UPDATE') || t.includes('RELEASE')) {
      return isPolish
        ? 'Nowości i aktualizacje DBR77 — sprawdź co się zmieniło.'
        : 'DBR77 updates — review what changed.';
    }
    return isPolish
      ? 'Komunikat DBR77 — sprawdź szczegóły.'
      : 'DBR77 communication — review details.';
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
  if (t.startsWith('DBR77_')) {
    const title = normalize(
      (data.articleTitle || data.article_title || data.title || data.kbTitle) as string | undefined
    );
    const version = normalize((data.version || data.release || data.build) as string | undefined);
    if (title && version) return `${title} — ${version}`;
    if (title) return title;
    if (version) return isPolish ? `Aktualizacja — ${version}` : `Update — ${version}`;
  }
  if (t === 'PAYMENT_FAILED') {
    const inv = normalize((data.invoiceId || data.invoice_id) as string | undefined);
    return inv
      ? isPolish
        ? `Faktura ${inv}`
        : `Invoice ${inv}`
      : isPolish
        ? 'Problem z płatnością'
        : 'Payment issue';
  }
  if (t === 'USAGE_ALERT' || t.includes('LIMIT')) {
    const metric = normalize(
      (data.metric || data.limitName || data.limit_name) as string | undefined
    );
    const pct = Number((data.usagePercent || data.usage_percent || data.percent_used) as any);
    const pctStr = Number.isFinite(pct) && pct > 0 ? `${pct}%` : '';
    if (metric && pctStr) return `${metric} — ${pctStr}`;
    if (metric) return metric;
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
      label: isPolish ? 'Otwórz dokument' : 'Open document',
    };
  }
  if (relatedType === 'DECISION' && relatedId) {
    return {
      kind: 'open_decision',
      id: relatedId,
      label: isPolish ? 'Otwórz dokument' : 'Open document',
    };
  }
  if (relatedType === 'PROJECT' && relatedId) {
    return {
      kind: 'open_project',
      id: relatedId,
      label: isPolish ? 'Otwórz dokument' : 'Open document',
    };
  }
  if (link) {
    return { kind: 'open_link', href: link, label: isPolish ? 'Otwórz dokument' : 'Open document' };
  }
  return { kind: 'none' };
};

// ── Contextual Expected Action ────────────────────────────────────────────────

const inferExpectedAction = (
  n: NotificationLike,
  primaryCta: NotificationPrimaryCta,
  isPolish: boolean
): string => {
  const t = normalize(n.type).toUpperCase();
  const data = n.data || {};
  const severity = normalize(n.severity).toUpperCase();
  const daysOverdue = Number(data.days_overdue || data.daysOverdue || 0);
  const assignee = normalize((data.assignee || data.entityAssignee) as string | undefined);
  const taskTitle = normalize(
    (data.task_title || data.taskTitle || data.entityName) as string | undefined
  );

  // TASK_OVERDUE — contextual based on severity and days
  if (t === 'TASK_OVERDUE') {
    if (severity === 'CRITICAL' || daysOverdue > 3) {
      return isPolish
        ? `Natychmiast skontaktuj się${assignee ? ` z ${assignee}` : ''} i eskaluj do kierownika projektu. ${taskTitle ? `Zadanie "${taskTitle}" jest` : 'Zadanie jest'} ${daysOverdue}d po terminie.`
        : `Immediately contact${assignee ? ` ${assignee}` : ' the assignee'} and escalate to the project manager. ${taskTitle ? `Task "${taskTitle}" is` : 'Task is'} ${daysOverdue}d overdue.`;
    }
    return isPolish
      ? `Sprawdź postęp${taskTitle ? ` zadania "${taskTitle}"` : ''} i zaktualizuj deadline${assignee ? `. Odpowiedzialny: ${assignee}` : ''}.`
      : `Check progress${taskTitle ? ` on "${taskTitle}"` : ''} and update the deadline${assignee ? `. Owner: ${assignee}` : ''}.`;
  }

  // TASK_BLOCKED
  if (t === 'TASK_BLOCKED' || t.includes('BLOCKED')) {
    const blocker = normalize(
      (data.blocker || data.blockerName || data.blocker_name) as string | undefined
    );
    return isPolish
      ? `Usuń blokadę${blocker ? ` ("${blocker}")` : ''} i odblokuj postęp${taskTitle ? ` zadania "${taskTitle}"` : ''}.`
      : `Remove the blocker${blocker ? ` ("${blocker}")` : ''} and unblock progress${taskTitle ? ` on "${taskTitle}"` : ''}.`;
  }

  // TASK_ASSIGNED
  if (t === 'TASK_ASSIGNED' || t.includes('ASSIGN')) {
    return isPolish
      ? `Przejrzyj przypisane zadanie${taskTitle ? ` "${taskTitle}"` : ''}, potwierdź scope i rozpocznij pracę.`
      : `Review the assigned task${taskTitle ? ` "${taskTitle}"` : ''}, confirm scope, and start work.`;
  }

  // DECISION_REQUIRED / DECISION_OVERDUE
  if (t.includes('DECISION')) {
    const decisionTitle = normalize(
      (data.decision_title || data.decisionTitle) as string | undefined
    );
    if (t === 'DECISION_OVERDUE') {
      return isPolish
        ? `Natychmiast podejmij decyzję${decisionTitle ? ` w sprawie "${decisionTitle}"` : ''} — opóźnienie blokuje dalsze prace.`
        : `Immediately make a decision${decisionTitle ? ` on "${decisionTitle}"` : ''} — delay is blocking downstream work.`;
    }
    return isPolish
      ? `Przeanalizuj kontekst i podejmij decyzję${decisionTitle ? ` w sprawie "${decisionTitle}"` : ''}. Skonsultuj z zespołem jeśli potrzeba.`
      : `Analyze context and make a decision${decisionTitle ? ` on "${decisionTitle}"` : ''}. Consult the team if needed.`;
  }

  // AI notifications
  if (t === 'AI_RISK_DETECTED') {
    const riskLevel = normalize((data.riskLevel || data.risk_level) as string | undefined);
    return isPolish
      ? `Przejrzyj ryzyko${riskLevel ? ` (poziom: ${riskLevel})` : ''} wykryte przez AI. Zweryfikuj dane i zdecyduj o działaniu.`
      : `Review the risk${riskLevel ? ` (level: ${riskLevel})` : ''} detected by AI. Verify the data and decide on action.`;
  }
  if (t === 'AI_RECOMMENDATION') {
    return isPolish
      ? 'Przejrzyj rekomendację AI, zweryfikuj założenia i zastosuj lub odrzuć z uzasadnieniem.'
      : 'Review the AI recommendation, verify assumptions, and apply or dismiss with justification.';
  }
  if (t === 'AI_OVERLOAD_DETECTED') {
    return isPolish
      ? 'AI wykryło przeciążenie zasobów. Przejrzyj obciążenie zespołu i przedystrybuuj zadania.'
      : 'AI detected resource overload. Review team workload and redistribute tasks.';
  }
  if (t === 'AI_DEPENDENCY_CONFLICT') {
    return isPolish
      ? 'AI wykryło konflikt zależności. Przejrzyj timeline i rozwiąż konflikty w harmonogramie.'
      : 'AI detected a dependency conflict. Review the timeline and resolve scheduling conflicts.';
  }

  // GATE
  if (t.includes('GATE')) {
    return isPolish
      ? 'Przejrzyj kryteria bramki i podejmij decyzję GO/NO-GO.'
      : 'Review gate criteria and make a GO/NO-GO decision.';
  }

  // Billing / payments
  if (t === 'PAYMENT_FAILED') {
    return isPolish
      ? 'Otwórz rozliczenia, zaktualizuj metodę płatności i ponów transakcję.'
      : 'Open billing, update your payment method, and retry the transaction.';
  }
  if (t === 'USAGE_ALERT' || t.includes('LIMIT')) {
    const metric = normalize(
      (data.metric || data.limitName || data.limit_name) as string | undefined
    );
    const pct = Number((data.usagePercent || data.usage_percent || data.percent_used) as any);
    const pctStr = Number.isFinite(pct) && pct > 0 ? `${pct}%` : '';
    return isPolish
      ? `Zbliżasz się do limitu${metric ? ` "${metric}"` : ''}${pctStr ? ` (${pctStr})` : ''}. Zdecyduj: upgrade planu, porządek danych lub zwiększ limit.`
      : `Approaching limit${metric ? ` "${metric}"` : ''}${pctStr ? ` (${pctStr})` : ''}. Decide: upgrade plan, clean up data, or increase limit.`;
  }
  if (t === 'SUBSCRIPTION_CHANGE') {
    return isPolish
      ? 'Sprawdź szczegóły zmiany subskrypcji i potwierdź nowe warunki.'
      : 'Review subscription change details and confirm new terms.';
  }
  if (t === 'INVOICE_READY') {
    return isPolish
      ? 'Nowa faktura do pobrania. Sprawdź i przekaż do księgowości.'
      : 'New invoice available. Review and forward to accounting.';
  }

  // DBR77
  if (t === 'DBR77_KB_NEW') {
    return isPolish
      ? 'Przeczytaj nowy artykuł w bazie wiedzy i zastosuj w swojej pracy.'
      : 'Read the new knowledge base article and apply it to your work.';
  }
  if (t === 'DBR77_INSTRUCTION') {
    return isPolish
      ? 'Przeczytaj nową instrukcję i dostosuj swój workflow.'
      : 'Read the new instruction and adjust your workflow.';
  }
  if (t === 'DBR77_UPDATE' || t === 'DBR77_RELEASE_NOTES') {
    return isPolish
      ? 'Zapoznaj się z nowościami w systemie. Sprawdź czy zmiany wpływają na Twoje zadania.'
      : 'Review system updates. Check if changes affect your tasks.';
  }

  // SYSTEM_ALERT
  if (t === 'SYSTEM_ALERT') {
    return isPolish
      ? 'Przeczytaj alert systemowy i podejmij wymagane działanie.'
      : 'Read the system alert and take the required action.';
  }

  // Completed / milestone — informational
  if (t.includes('COMPLETED') || t.includes('MILESTONE')) {
    return isPolish
      ? 'Informacja — nie wymaga bezpośredniego działania. Możesz zamknąć.'
      : 'Informational — no direct action required. You may dismiss.';
  }

  // Fallback with CTA
  if (primaryCta.kind !== 'none') {
    return isPolish ? `Wykonaj: ${primaryCta.label}` : `Do: ${primaryCta.label}`;
  }

  return isPolish
    ? 'Otwórz powiązaną encję i wykonaj akcję.'
    : 'Open the linked entity and take action.';
};

// ── Contextual Checklist Generation ───────────────────────────────────────────

type CL = SuggestedChecklistItem;
const cl = (text: string, urgency: CL['urgency'] = 'normal'): CL => ({ text, urgency });

const inferChecklist = (n: NotificationLike, isPolish: boolean): SuggestedChecklistItem[] => {
  const t = normalize(n.type).toUpperCase();
  const data = n.data || {};
  const severity = normalize(n.severity).toUpperCase();
  const daysOverdue = Number(data.days_overdue || data.daysOverdue || 0);
  const assignee = normalize((data.assignee || data.entityAssignee) as string | undefined);

  // ── TASK types ──
  if (t === 'TASK_OVERDUE') {
    const isCritical = severity === 'CRITICAL' || daysOverdue > 3;
    if (isCritical) {
      return [
        cl(
          isPolish
            ? 'Sprawdź blokery i przyczynę opóźnienia'
            : 'Check blockers and reason for delay',
          'critical'
        ),
        cl(
          isPolish
            ? `Skontaktuj się z ${assignee || 'odpowiedzialnym'}`
            : `Contact ${assignee || 'the assignee'}`,
          'critical'
        ),
        cl(isPolish ? 'Ustal nowy realny termin' : 'Set a new realistic deadline', 'critical'),
        cl(
          isPolish
            ? 'Eskaluj do kierownika jeśli brak odpowiedzi w 2h'
            : 'Escalate to manager if no response within 2h',
          'normal'
        ),
        cl(isPolish ? 'Zaktualizuj status zadania' : 'Update task status', 'normal'),
        cl(
          isPolish
            ? 'Powiadom interesariuszy o nowym planie'
            : 'Notify stakeholders about the new plan',
          'optional'
        ),
      ];
    }
    return [
      cl(
        isPolish ? 'Otwórz zadanie i przejrzyj szczegóły' : 'Open the task and review details',
        'normal'
      ),
      cl(isPolish ? 'Sprawdź czy są blokery' : 'Check for blockers', 'normal'),
      cl(isPolish ? 'Zaktualizuj deadline lub status' : 'Update deadline or status', 'normal'),
      cl(isPolish ? 'Powiadom zespół o zmianie' : 'Notify the team about the change', 'optional'),
    ];
  }

  if (t === 'TASK_BLOCKED' || t.includes('BLOCKED')) {
    return [
      cl(isPolish ? 'Zidentyfikuj blokadę' : 'Identify the blocker', 'critical'),
      cl(isPolish ? 'Skontaktuj się z osobą blokującą' : 'Contact the blocking party', 'critical'),
      cl(
        isPolish ? 'Ustal plan usunięcia blokady' : 'Establish a plan to remove the blocker',
        'normal'
      ),
      cl(isPolish ? 'Zaktualizuj status zadania' : 'Update task status', 'normal'),
      cl(
        isPolish ? 'Eskaluj jeśli blokada trwa > 24h' : 'Escalate if blocker persists > 24h',
        'optional'
      ),
    ];
  }

  if (t === 'TASK_ASSIGNED' || t.includes('ASSIGN')) {
    return [
      cl(
        isPolish ? 'Przejrzyj opis i zakres zadania' : 'Review task description and scope',
        'normal'
      ),
      cl(isPolish ? 'Potwierdź termin wykonania' : 'Confirm the deadline', 'normal'),
      cl(isPolish ? 'Sprawdź zależności i blokery' : 'Check dependencies and blockers', 'normal'),
      cl(
        isPolish ? 'Rozpocznij pracę lub zgłoś wątpliwości' : 'Start work or raise concerns',
        'normal'
      ),
    ];
  }

  // ── DECISION types ──
  if (t === 'DECISION_OVERDUE') {
    return [
      cl(isPolish ? 'Przeanalizuj kontekst decyzji' : 'Analyze decision context', 'critical'),
      cl(
        isPolish ? 'Skonsultuj z kluczowymi interesariuszami' : 'Consult key stakeholders',
        'critical'
      ),
      cl(isPolish ? 'Podejmij decyzję lub eskaluj' : 'Make the decision or escalate', 'critical'),
      cl(isPolish ? 'Udokumentuj uzasadnienie' : 'Document the rationale', 'normal'),
      cl(isPolish ? 'Powiadom zależne zespoły' : 'Notify dependent teams', 'normal'),
    ];
  }

  if (t === 'DECISION_REQUIRED') {
    return [
      cl(
        isPolish ? 'Przejrzyj dane i kontekst decyzji' : 'Review data and decision context',
        'normal'
      ),
      cl(
        isPolish ? 'Skonsultuj z zespołem jeśli potrzeba' : 'Consult the team if needed',
        'normal'
      ),
      cl(isPolish ? 'Podejmij decyzję lub deleguj' : 'Make the decision or delegate', 'normal'),
      cl(
        isPolish ? 'Udokumentuj wybór i uzasadnienie' : 'Document the choice and rationale',
        'optional'
      ),
    ];
  }

  // ── AI types ──
  if (t === 'AI_RISK_DETECTED') {
    return [
      cl(
        isPolish ? 'Przejrzyj szczegóły wykrytego ryzyka' : 'Review detected risk details',
        'critical'
      ),
      cl(isPolish ? 'Zweryfikuj dane wejściowe AI' : 'Verify AI input data', 'normal'),
      cl(isPolish ? 'Oceń realny wpływ na projekt' : 'Assess real impact on the project', 'normal'),
      cl(
        isPolish ? 'Podejmij działanie mitygujące lub odrzuć' : 'Take mitigating action or dismiss',
        'normal'
      ),
      cl(isPolish ? 'Zaktualizuj rejestr ryzyk' : 'Update the risk register', 'optional'),
    ];
  }

  if (t === 'AI_RECOMMENDATION') {
    return [
      cl(isPolish ? 'Przejrzyj rekomendację AI' : 'Review the AI recommendation', 'normal'),
      cl(isPolish ? 'Zweryfikuj założenia i dane' : 'Verify assumptions and data', 'normal'),
      cl(
        isPolish ? 'Zastosuj lub odrzuć z uzasadnieniem' : 'Apply or dismiss with justification',
        'normal'
      ),
    ];
  }

  if (t === 'AI_OVERLOAD_DETECTED') {
    return [
      cl(isPolish ? 'Przejrzyj obciążenie zespołu' : 'Review team workload', 'critical'),
      cl(
        isPolish ? 'Zidentyfikuj najbardziej obciążone osoby' : 'Identify most overloaded people',
        'normal'
      ),
      cl(
        isPolish ? 'Przedystrybuuj lub odłóż zadania' : 'Redistribute or postpone tasks',
        'normal'
      ),
      cl(isPolish ? 'Powiadom zespół o zmianach' : 'Notify team about changes', 'optional'),
    ];
  }

  if (t === 'AI_DEPENDENCY_CONFLICT') {
    return [
      cl(
        isPolish ? 'Przejrzyj konfliktujące zależności' : 'Review conflicting dependencies',
        'critical'
      ),
      cl(isPolish ? "Porównaj timeline'y zadań" : 'Compare task timelines', 'normal'),
      cl(isPolish ? 'Zmień kolejność lub przesuń terminy' : 'Reorder or shift deadlines', 'normal'),
      cl(
        isPolish ? 'Potwierdź nowy harmonogram z zespołem' : 'Confirm new schedule with team',
        'optional'
      ),
    ];
  }

  // ── GATE types ──
  if (t.includes('GATE')) {
    return [
      cl(isPolish ? 'Przejrzyj kryteria bramki' : 'Review gate criteria', 'normal'),
      cl(isPolish ? 'Sprawdź stan deliverables' : 'Check deliverables status', 'normal'),
      cl(isPolish ? 'Podejmij decyzję GO/NO-GO' : 'Make GO/NO-GO decision', 'critical'),
      cl(isPolish ? 'Udokumentuj decyzję' : 'Document the decision', 'normal'),
    ];
  }

  // ── Billing / Payment types ──
  if (t === 'PAYMENT_FAILED') {
    return [
      cl(isPolish ? 'Otwórz sekcję rozliczeń' : 'Open billing section', 'critical'),
      cl(isPolish ? 'Sprawdź metodę płatności' : 'Check payment method', 'critical'),
      cl(isPolish ? 'Zaktualizuj dane karty/konta' : 'Update card/account details', 'normal'),
      cl(isPolish ? 'Ponów transakcję' : 'Retry the transaction', 'normal'),
      cl(isPolish ? 'Potwierdź sukces płatności' : 'Confirm payment success', 'optional'),
    ];
  }

  if (t === 'USAGE_ALERT' || t.includes('LIMIT')) {
    return [
      cl(isPolish ? 'Sprawdź aktualne zużycie' : 'Check current usage', 'normal'),
      cl(
        isPolish ? 'Zidentyfikuj co zajmuje zasoby' : 'Identify what consumes resources',
        'normal'
      ),
      cl(
        isPolish ? 'Zdecyduj: upgrade, porządek lub limit' : 'Decide: upgrade, cleanup, or limit',
        'normal'
      ),
      cl(isPolish ? 'Wdróż wybraną strategię' : 'Implement chosen strategy', 'optional'),
    ];
  }

  if (t === 'SUBSCRIPTION_CHANGE') {
    return [
      cl(isPolish ? 'Przejrzyj nowe warunki' : 'Review new terms', 'normal'),
      cl(isPolish ? 'Potwierdź dostępność funkcji' : 'Confirm feature availability', 'normal'),
      cl(isPolish ? 'Zaktualizuj budżet jeśli potrzeba' : 'Update budget if needed', 'optional'),
    ];
  }

  if (t === 'INVOICE_READY') {
    return [
      cl(isPolish ? 'Pobierz fakturę' : 'Download the invoice', 'normal'),
      cl(isPolish ? 'Zweryfikuj kwotę i okres' : 'Verify amount and period', 'normal'),
      cl(isPolish ? 'Przekaż do księgowości' : 'Forward to accounting', 'optional'),
    ];
  }

  // ── DBR77 types ──
  if (t === 'DBR77_KB_NEW') {
    return [
      cl(isPolish ? 'Przeczytaj nowy artykuł' : 'Read the new article', 'normal'),
      cl(
        isPolish ? 'Sprawdź czy dotyczy Twoich zadań' : 'Check if it applies to your tasks',
        'normal'
      ),
      cl(isPolish ? 'Zastosuj wiedzę w praktyce' : 'Apply the knowledge in practice', 'optional'),
    ];
  }

  if (t === 'DBR77_INSTRUCTION') {
    return [
      cl(isPolish ? 'Przeczytaj nową instrukcję' : 'Read the new instruction', 'normal'),
      cl(isPolish ? 'Dostosuj swój workflow' : 'Adjust your workflow', 'normal'),
      cl(isPolish ? 'Potwierdź wdrożenie zmian' : 'Confirm changes implemented', 'optional'),
    ];
  }

  if (t === 'DBR77_UPDATE' || t === 'DBR77_RELEASE_NOTES') {
    return [
      cl(isPolish ? 'Przejrzyj listę zmian' : 'Review the changelog', 'normal'),
      cl(isPolish ? 'Sprawdź wpływ na swoje zadania' : 'Check impact on your tasks', 'normal'),
      cl(isPolish ? 'Przetestuj nowe funkcje' : 'Test new features', 'optional'),
    ];
  }

  // ── SYSTEM_ALERT ──
  if (t === 'SYSTEM_ALERT') {
    return [
      cl(isPolish ? 'Przeczytaj szczegóły alertu' : 'Read alert details', 'normal'),
      cl(isPolish ? 'Oceń wpływ na Twoją pracę' : 'Assess impact on your work', 'normal'),
      cl(isPolish ? 'Podejmij wymagane działanie' : 'Take the required action', 'normal'),
    ];
  }

  // ── Completed / Milestone — minimal ──
  if (t.includes('COMPLETED') || t.includes('MILESTONE')) {
    return [
      cl(isPolish ? 'Przejrzyj podsumowanie' : 'Review the summary', 'optional'),
      cl(isPolish ? 'Zamknij powiadomienie' : 'Dismiss the notification', 'optional'),
    ];
  }

  // ── Generic fallback ──
  return [
    cl(isPolish ? 'Przejrzyj szczegóły powiadomienia' : 'Review notification details', 'normal'),
    cl(isPolish ? 'Podejmij odpowiednią akcję' : 'Take appropriate action', 'normal'),
  ];
};

// ── Main builder ──────────────────────────────────────────────────────────────

export const buildNotificationContent = (
  n: NotificationLike,
  isPolish: boolean
): NotificationContentContract => {
  const what = normalize(n.title) || (isPolish ? 'Powiadomienie' : 'Notification');
  const whyImportant = inferWhy(n, isPolish);
  const contextLine = buildContextLine(n, isPolish);
  const blocked = inferBlocked(n, isPolish);
  const primaryCta = inferPrimaryCta(n, isPolish);
  const expectedAction = inferExpectedAction(n, primaryCta, isPolish);
  const suggestedChecklist = inferChecklist(n, isPolish);

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
