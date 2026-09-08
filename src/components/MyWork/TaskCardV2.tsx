import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  Circle,
  FileText,
  Flag,
  Link2,
  Lock,
  Save,
  ShieldCheck,
  User,
} from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { formatListDate } from '@/utils/listDateFormat';

import type { EvidenceItem, TaskDependency } from './shared';

interface ChecklistEntry {
  id: string;
  text: string;
  completed: boolean;
}

interface TaskCardV2Props {
  taskId: string | null;
  title: string;
  description: string;
  status: string;
  priority: string;
  dueDate: string;
  blockedReason: string;
  ownerName: string;
  checklist: ChecklistEntry[];
  evidenceItems: EvidenceItem[];
  dependencies: TaskDependency[];
  saving: boolean;
  onBack: () => void;
  onSave: () => void;
}

/**
 * Statusy i priorytety idą przez SŁOWNIK KLUCZY, nie przez polskie napisy
 * w kodzie (PLAN JEZYK_EN_PL §2.6). Wartość z bazy (`todo`, `in_progress`…)
 * jest identyfikatorem, nie tekstem do pokazania — konto angielskie widziało
 * tu „Do zrobienia” i „Średni”, bo mapa trzymała gotowe polskie zdania.
 */
const STATUS_KEYS: Record<string, string> = {
  todo: 'myWork.taskCardV2.status.todo',
  in_progress: 'myWork.taskCardV2.status.inProgress',
  review: 'myWork.taskCardV2.status.review',
  done: 'myWork.taskCardV2.status.done',
  blocked: 'myWork.taskCardV2.status.blocked',
};

const PRIORITY_KEYS: Record<string, string> = {
  low: 'myWork.taskCardV2.priority.low',
  medium: 'myWork.taskCardV2.priority.medium',
  high: 'myWork.taskCardV2.priority.high',
  critical: 'myWork.taskCardV2.priority.critical',
};

const sectionClass =
  'rounded-2xl border border-c-border bg-c-surface p-5 shadow-sm dark:border-c-border/70';

export const TaskCardV2: React.FC<TaskCardV2Props> = ({
  taskId,
  title,
  description,
  status,
  priority,
  dueDate,
  blockedReason,
  ownerName,
  checklist,
  evidenceItems,
  dependencies,
  saving,
  onBack,
  onSave,
}) => {
  const { t } = useTranslation();
  const completed = checklist.filter((item) => item.completed).length;
  const blockingDependencies = dependencies.filter(
    (dependency) => dependency.direction === 'predecessor' && dependency.taskStatus !== 'done'
  );
  const isBlocked =
    status === 'blocked' || Boolean(blockedReason) || blockingDependencies.length > 0;
  const missingEvidence = Math.max(checklist.length - evidenceItems.length, 0);

  const statusLabel = STATUS_KEYS[status]
    ? t(STATUS_KEYS[status])
    : t('myWork.taskCardV2.status.unknown', 'Status unknown');
  const priorityLabel = PRIORITY_KEYS[priority]
    ? t(PRIORITY_KEYS[priority])
    : t('myWork.taskCardV2.priority.unset', 'Not set');
  // Termin przez SSOT list (`formatListDate`) — jeden zapis daty w całym
  // produkcie i locale z KONTA, nie z przeglądarki. Poprzednia wersja miała
  // polskie locale przybite w `Intl.DateTimeFormat`, więc konto angielskie
  // dostawało polski zapis daty w dwóch miejscach tej karty.
  const dueLabel = dueDate
    ? formatListDate(dueDate, dueDate)
    : t('myWork.taskCardV2.noDueDate', 'No due date set');

  return (
    <div data-testid="task-card-v2" className="min-h-full bg-c-bg text-c-text">
      <header className="sticky top-0 z-20 border-b border-c-border bg-c-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] items-center gap-3 px-5 py-3">
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg p-2 hover:bg-c-surface-raised"
            aria-label={t('myWork.taskCardV2.backToList', 'Back to the task list')}
          >
            <ArrowLeft size={18} />
          </button>
          <span className="font-mono text-xs text-c-text-muted">
            {taskId || t('myWork.taskCardV2.newTask', 'NEW TASK')}
          </span>
          <h1 className="min-w-0 flex-1 truncate text-base font-semibold">
            {title || t('myWork.taskCardV2.untitled', 'Task without a title')}
          </h1>
          <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
            {statusLabel}
          </span>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg border border-c-border bg-c-text px-3 py-2 text-xs font-semibold text-c-bg disabled:opacity-50"
          >
            <Save size={14} />{' '}
            {saving
              ? t('myWork.taskCardV2.saving', 'Saving…')
              : t('myWork.taskCardV2.save', 'Save task')}
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-4 p-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <main className="space-y-4">
          <section className={sectionClass} aria-labelledby="task-purpose-title">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 text-c-info" size={20} />
              <div>
                <h2 id="task-purpose-title" className="font-semibold">
                  {t('myWork.taskCardV2.purposeTitle', 'Task — this is where you close the work')}
                </h2>
                <p className="mt-2 text-sm leading-6 text-c-text-secondary">
                  {description ||
                    t(
                      'myWork.taskCardV2.noDescription',
                      'No task description yet. Fill in the goal, the scope and the expected result.'
                    )}
                </p>
              </div>
            </div>
          </section>

          <section className={sectionClass} aria-labelledby="closure-title">
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-c-text-muted">
                  {t('myWork.taskCardV2.closureConditions', 'Closure conditions')}
                </p>
                <h2 id="closure-title" className="mt-1 text-2xl font-semibold">
                  {t('myWork.taskCardV2.closureCount', '{{completed}} of {{total}} met', {
                    completed,
                    total: checklist.length,
                  })}
                </h2>
                <p className="mt-1 text-xs text-c-text-muted">
                  {t(
                    'myWork.taskCardV2.closureModelNote',
                    'The task model keeps a flat list of conditions — it does not map them to stages.'
                  )}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-c-text-muted">
                  {t('myWork.taskCardV2.dueDate', 'Due date')}
                </p>
                <p className="mt-1 text-xl font-semibold">{dueLabel}</p>
              </div>
            </div>
            <div
              className="mt-5 h-2 overflow-hidden rounded-full bg-c-surface-raised"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={checklist.length}
              aria-valuenow={completed}
              aria-label={t(
                'myWork.taskCardV2.progressAria',
                '{{completed}} of {{total}} conditions met',
                { completed, total: checklist.length }
              )}
            >
              <div
                className="h-full bg-emerald-500"
                style={{
                  width: checklist.length ? `${(completed / checklist.length) * 100}%` : '0%',
                }}
              />
            </div>
            <div className="mt-5 divide-y divide-c-border-subtle border-y border-c-border-subtle">
              {checklist.map((item, index) => (
                <div key={item.id} className="flex items-start gap-3 py-3 text-sm">
                  {item.completed ? (
                    <CheckCircle2 size={17} className="mt-0.5 text-emerald-600" />
                  ) : (
                    <Circle size={17} className="mt-0.5 text-c-text-muted" />
                  )}
                  <span className="font-medium">
                    {index + 1}. {item.text}
                  </span>
                  <span className="ml-auto rounded-full bg-c-surface-raised px-2 py-1 text-[11px] text-c-text-secondary">
                    {item.completed
                      ? t('myWork.taskCardV2.conditionMet', 'Met')
                      : t('myWork.taskCardV2.conditionPending', 'Pending')}
                  </span>
                </div>
              ))}
              {checklist.length === 0 && (
                <p className="py-4 text-sm text-c-text-secondary">
                  {t(
                    'myWork.taskCardV2.noConditions',
                    'No closure conditions defined. A task cannot be judged honestly without a list of conditions.'
                  )}
                </p>
              )}
            </div>
          </section>

          {isBlocked && (
            <section
              className="rounded-2xl border border-danger-400 bg-danger-500/5 p-5"
              aria-labelledby="block-title"
            >
              <div className="flex items-center gap-2 text-danger-600 dark:text-danger-400">
                <AlertCircle size={18} />
                <h2 id="block-title" className="text-sm font-bold uppercase tracking-wide">
                  {t('myWork.taskCardV2.blocked', 'Blocked')}
                </h2>
              </div>
              <p className="mt-3 text-sm leading-6">
                {blockedReason ||
                  t(
                    'myWork.taskCardV2.blockedByDependencies',
                    'The task is waiting on {{blocking}} of {{total}} predecessor dependencies.',
                    { blocking: blockingDependencies.length, total: dependencies.length }
                  )}
              </p>
              {blockingDependencies.map((dependency) => (
                <p key={dependency.id} className="mt-2 text-sm font-medium">
                  {dependency.taskIndexCode || dependency.taskId}: {dependency.taskTitle}
                </p>
              ))}
            </section>
          )}

          <section className={sectionClass} aria-labelledby="evidence-title">
            <div className="flex items-center justify-between gap-3">
              <h2 id="evidence-title" className="font-semibold">
                {t('myWork.taskCardV2.evidenceTitle', 'Evidence of completion')}
              </h2>
              <span className="text-xs text-c-text-muted">
                {t('myWork.taskCardV2.evidenceCount', '{{attached}} of {{required}} required', {
                  attached: evidenceItems.length,
                  required: Math.max(evidenceItems.length + missingEvidence, checklist.length),
                })}
              </span>
            </div>
            <div className="mt-4 space-y-2">
              {evidenceItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-xl border border-c-border-subtle p-3 text-sm"
                >
                  <FileText size={16} className="text-c-text-muted" />
                  <span className="font-medium">{item.title}</span>
                  <span className="ml-auto text-xs text-c-text-muted">
                    {t('myWork.taskCardV2.attached', 'Attached')}
                  </span>
                </div>
              ))}
              {evidenceItems.length === 0 && (
                <p className="text-sm text-c-text-secondary">
                  {t('myWork.taskCardV2.noEvidence', 'No evidence of completion attached yet.')}
                </p>
              )}
            </div>
            {missingEvidence > 0 && (
              <div className="mt-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-c-text-muted">
                  {t('myWork.taskCardV2.missingTitle', 'Missing — named, not “no data”')}
                </p>
                <p className="mt-2 text-sm text-c-text-secondary">
                  {t(
                    'myWork.taskCardV2.missingBody',
                    '{{missing}} of {{total}} pieces of evidence tied to conditions are missing. The model does not store the names of the missing items, so this card does not replace them with a zero or an invented name.',
                    { missing: missingEvidence, total: checklist.length }
                  )}
                </p>
              </div>
            )}
          </section>
        </main>

        <aside
          className="space-y-4 xl:sticky xl:top-20 xl:self-start"
          aria-label={t('myWork.taskCardV2.panelAria', 'Task panel')}
        >
          <section className={sectionClass}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-c-text-muted">
              {t('myWork.taskCardV2.roleAndRights', 'Role and permissions')}
            </p>
            <p className="mt-3 text-sm font-medium">
              {ownerName
                ? t('myWork.taskCardV2.ownerIs', 'Task owner: {{name}}', { name: ownerName })
                : t('myWork.taskCardV2.ownerMissing', 'No task owner has been named.')}
            </p>
            <ul className="mt-4 space-y-3 text-xs leading-5 text-c-text-secondary">
              <li className="flex gap-2">
                <Check size={15} className="mt-0.5 text-emerald-600" />{' '}
                {t('myWork.taskCardV2.rightEdit', 'You can edit the content and the conditions.')}
              </li>
              <li className="flex gap-2">
                <Check size={15} className="mt-0.5 text-emerald-600" />{' '}
                {t(
                  'myWork.taskCardV2.rightSave',
                  'You can save changes and evidence of completion.'
                )}
              </li>
              <li className="flex gap-2">
                <Lock size={15} className="mt-0.5 text-c-text-muted" />{' '}
                {t(
                  'myWork.taskCardV2.rightNoSelfApproval',
                  'This card does not confirm the right to independently accept your own work.'
                )}
              </li>
              <li className="flex gap-2">
                <Lock size={15} className="mt-0.5 text-c-text-muted" />{' '}
                {t(
                  'myWork.taskCardV2.rightNotDoneBefore',
                  'The task cannot be called done before {{total}} of {{total}} conditions are met.',
                  { total: checklist.length }
                )}
              </li>
            </ul>
          </section>
          <section className={sectionClass}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-c-text-muted">
              {t('myWork.taskCardV2.properties', 'Properties')}
            </p>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex gap-3">
                <ShieldCheck size={16} className="text-c-text-muted" />
                <dt className="text-c-text-muted">{t('myWork.taskCardV2.fieldStatus', 'Status')}</dt>
                <dd className="ml-auto font-medium">{statusLabel}</dd>
              </div>
              <div className="flex gap-3">
                <Flag size={16} className="text-c-text-muted" />
                <dt className="text-c-text-muted">
                  {t('myWork.taskCardV2.fieldPriority', 'Priority')}
                </dt>
                <dd className="ml-auto font-medium">{priorityLabel}</dd>
              </div>
              <div className="flex gap-3">
                <Calendar size={16} className="text-c-text-muted" />
                <dt className="text-c-text-muted">{t('myWork.taskCardV2.dueDate', 'Due date')}</dt>
                <dd className="ml-auto font-medium">{dueLabel}</dd>
              </div>
              <div className="flex gap-3">
                <User size={16} className="text-c-text-muted" />
                <dt className="text-c-text-muted">{t('myWork.taskCardV2.fieldOwner', 'Owner')}</dt>
                <dd className="ml-auto text-right font-medium">
                  {ownerName || t('myWork.taskCardV2.ownerUnset', 'Not named')}
                </dd>
              </div>
              <div className="flex gap-3">
                <Link2 size={16} className="text-c-text-muted" />
                <dt className="text-c-text-muted">
                  {t('myWork.taskCardV2.fieldDependencies', 'Dependencies')}
                </dt>
                <dd className="ml-auto font-medium">
                  {t('myWork.taskCardV2.dependencyCount', '{{known}} of {{total}} identified', {
                    known: dependencies.length,
                    total: dependencies.length,
                  })}
                </dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
};
