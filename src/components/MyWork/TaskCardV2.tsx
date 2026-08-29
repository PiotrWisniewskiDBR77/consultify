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

const STATUS_LABELS: Record<string, string> = {
  todo: 'Do zrobienia',
  in_progress: 'W realizacji',
  review: 'Do przeglądu',
  done: 'Ukończone',
  blocked: 'Zablokowane',
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Niski',
  medium: 'Średni',
  high: 'Wysoki',
  critical: 'Krytyczny',
};

const formatPolishDate = (value: string): string => {
  if (!value) return 'Nie ustalono terminu';
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
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
  const completed = checklist.filter((item) => item.completed).length;
  const blockingDependencies = dependencies.filter(
    (dependency) => dependency.direction === 'predecessor' && dependency.taskStatus !== 'done'
  );
  const isBlocked =
    status === 'blocked' || Boolean(blockedReason) || blockingDependencies.length > 0;
  const missingEvidence = Math.max(checklist.length - evidenceItems.length, 0);

  return (
    <div data-testid="task-card-v2" className="min-h-full bg-c-bg text-c-text">
      <header className="sticky top-0 z-20 border-b border-c-border bg-c-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] items-center gap-3 px-5 py-3">
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg p-2 hover:bg-c-surface-raised"
            aria-label="Wróć do listy zadań"
          >
            <ArrowLeft size={18} />
          </button>
          <span className="font-mono text-xs text-c-text-muted">{taskId || 'NOWE ZADANIE'}</span>
          <h1 className="min-w-0 flex-1 truncate text-base font-semibold">
            {title || 'Zadanie bez tytułu'}
          </h1>
          <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
            {STATUS_LABELS[status] || 'Stan nieznany'}
          </span>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg border border-c-border bg-c-text px-3 py-2 text-xs font-semibold text-c-bg disabled:opacity-50"
          >
            <Save size={14} /> {saving ? 'Zapisywanie…' : 'Zapisz zadanie'}
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
                  Zadanie — tu doprowadzasz pracę do zamknięcia
                </h2>
                <p className="mt-2 text-sm leading-6 text-c-text-secondary">
                  {description ||
                    'Nie wpisano jeszcze opisu zadania. Uzupełnij cel, zakres i oczekiwany rezultat.'}
                </p>
              </div>
            </div>
          </section>

          <section className={sectionClass} aria-labelledby="closure-title">
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-c-text-muted">
                  Warunki zamknięcia
                </p>
                <h2 id="closure-title" className="mt-1 text-2xl font-semibold">
                  {completed} z {checklist.length} spełnionych
                </h2>
                <p className="mt-1 text-xs text-c-text-muted">
                  Model zadania przechowuje płaską listę warunków — nie przypisuje ich do etapów.
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-c-text-muted">
                  Termin
                </p>
                <p className="mt-1 text-xl font-semibold">{formatPolishDate(dueDate)}</p>
              </div>
            </div>
            <div
              className="mt-5 h-2 overflow-hidden rounded-full bg-c-surface-raised"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={checklist.length}
              aria-valuenow={completed}
              aria-label={`${completed} z ${checklist.length} warunków spełnionych`}
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
                    {item.completed ? 'Spełniony' : 'Czeka'}
                  </span>
                </div>
              ))}
              {checklist.length === 0 && (
                <p className="py-4 text-sm text-c-text-secondary">
                  Nie zdefiniowano warunków zamknięcia. Zadania nie można rzetelnie ocenić bez listy
                  warunków.
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
                  Zablokowane
                </h2>
              </div>
              <p className="mt-3 text-sm leading-6">
                {blockedReason ||
                  `Zadanie czeka na ${blockingDependencies.length} z ${dependencies.length} zależności poprzedzających.`}
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
                Dowody wykonania
              </h2>
              <span className="text-xs text-c-text-muted">
                {evidenceItems.length} z{' '}
                {Math.max(evidenceItems.length + missingEvidence, checklist.length)} wymaganych
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
                  <span className="ml-auto text-xs text-c-text-muted">Załączony</span>
                </div>
              ))}
              {evidenceItems.length === 0 && (
                <p className="text-sm text-c-text-secondary">
                  Nie załączono jeszcze żadnego dowodu wykonania.
                </p>
              )}
            </div>
            {missingEvidence > 0 && (
              <div className="mt-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-c-text-muted">
                  Brakujące — nazwane, nie „brak danych”
                </p>
                <p className="mt-2 text-sm text-c-text-secondary">
                  Brakuje {missingEvidence} z {checklist.length} dowodów powiązanych z warunkami.
                  Model nie przechowuje nazw brakujących dowodów, więc karta nie zastępuje ich zerem
                  ani wymyśloną nazwą.
                </p>
              </div>
            )}
          </section>
        </main>

        <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start" aria-label="Panel zadania">
          <section className={sectionClass}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-c-text-muted">
              Rola i uprawnienia
            </p>
            <p className="mt-3 text-sm font-medium">
              {ownerName
                ? `Właściciel zadania: ${ownerName}`
                : 'Właściciel zadania nie został wskazany.'}
            </p>
            <ul className="mt-4 space-y-3 text-xs leading-5 text-c-text-secondary">
              <li className="flex gap-2">
                <Check size={15} className="mt-0.5 text-emerald-600" /> Możesz edytować treść i
                warunki zadania.
              </li>
              <li className="flex gap-2">
                <Check size={15} className="mt-0.5 text-emerald-600" /> Możesz zapisać zmiany i
                dowody wykonania.
              </li>
              <li className="flex gap-2">
                <Lock size={15} className="mt-0.5 text-c-text-muted" /> Karta nie potwierdza
                uprawnienia do niezależnej akceptacji własnego działania.
              </li>
              <li className="flex gap-2">
                <Lock size={15} className="mt-0.5 text-c-text-muted" /> Nie można uznać zadania za
                gotowe przed spełnieniem {checklist.length} z {checklist.length} warunków.
              </li>
            </ul>
          </section>
          <section className={sectionClass}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-c-text-muted">
              Właściwości
            </p>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex gap-3">
                <ShieldCheck size={16} className="text-c-text-muted" />
                <dt className="text-c-text-muted">Status</dt>
                <dd className="ml-auto font-medium">{STATUS_LABELS[status] || 'Stan nieznany'}</dd>
              </div>
              <div className="flex gap-3">
                <Flag size={16} className="text-c-text-muted" />
                <dt className="text-c-text-muted">Priorytet</dt>
                <dd className="ml-auto font-medium">
                  {PRIORITY_LABELS[priority] || 'Nie ustalono'}
                </dd>
              </div>
              <div className="flex gap-3">
                <Calendar size={16} className="text-c-text-muted" />
                <dt className="text-c-text-muted">Termin</dt>
                <dd className="ml-auto font-medium">{formatPolishDate(dueDate)}</dd>
              </div>
              <div className="flex gap-3">
                <User size={16} className="text-c-text-muted" />
                <dt className="text-c-text-muted">Właściciel</dt>
                <dd className="ml-auto text-right font-medium">{ownerName || 'Nie wskazano'}</dd>
              </div>
              <div className="flex gap-3">
                <Link2 size={16} className="text-c-text-muted" />
                <dt className="text-c-text-muted">Zależności</dt>
                <dd className="ml-auto font-medium">
                  {dependencies.length} z {dependencies.length} rozpoznanych
                </dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
};
