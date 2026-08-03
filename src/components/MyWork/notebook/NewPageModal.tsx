import { format, getISOWeek } from 'date-fns';
import {
  BarChart,
  Brain,
  Calendar,
  FileText,
  FlaskConical,
  MessageSquare,
  SearchCode,
  ShieldAlert,
  Upload,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';

export interface PageTemplate {
  id: string;
  icon: React.ReactNode;
  label: string;
  labelPl: string;
  description: string;
  descriptionPl: string;
  gradient: string;
  contentJson: any;
  defaultTitle: string;
  defaultTitlePl: string;
  defaultIcon: string;
}

const p = (text: string) => ({ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] });
const h2 = (text: string) => ({
  type: 'heading',
  attrs: { level: 2 },
  content: [{ type: 'text', text }],
});
const todo = (text: string) => ({
  type: 'taskList',
  content: [
    {
      type: 'taskItem',
      attrs: { checked: false },
      content: [p(text)],
    },
  ],
});
const callout = (variant: string, text: string) => ({
  type: 'callout',
  attrs: { variant },
  content: [p(text)],
});

const STATIC_TEMPLATES: PageTemplate[] = [
  {
    id: 'blank',
    icon: <FileText size={20} />,
    label: 'Blank page',
    labelPl: 'Pusta strona',
    description: 'Start from scratch',
    descriptionPl: 'Zacznij od zera',
    gradient: 'from-slate-500 to-slate-600',
    defaultTitle: 'Untitled',
    defaultTitlePl: 'Bez tytułu',
    defaultIcon: '📝',
    contentJson: { type: 'doc', content: [p('')] },
  },
  {
    id: 'strategic',
    icon: <Brain size={20} />,
    label: 'Strategic Observation',
    labelPl: 'Obserwacja strategiczna',
    description: 'Capture market signals, trends and strategic insights',
    descriptionPl: 'Zapisz sygnały rynkowe, trendy i wnioski strategiczne',
    gradient: 'from-slate-500 to-slate-600',
    defaultTitle: 'Strategic Observation',
    defaultTitlePl: 'Obserwacja strategiczna',
    defaultIcon: '🔭',
    contentJson: {
      type: 'doc',
      content: [
        h2('Context'),
        p('What triggered this observation? What is the broader context?'),
        h2('Observation'),
        p('What did you notice? Describe the signal or trend.'),
        h2('Implications'),
        callout('warning', 'What could this mean for our strategy, product or market position?'),
        h2('Next Steps'),
        todo('Validate with data or stakeholders'),
        todo('Connect to existing initiatives'),
      ],
    },
  },
  {
    id: 'risk',
    icon: <ShieldAlert size={20} />,
    label: 'Risk Analysis',
    labelPl: 'Analiza ryzyka',
    description: 'Document and assess risks with mitigation plans',
    descriptionPl: 'Dokumentuj i oceniaj ryzyka z planami mitygacji',
    gradient: 'from-danger-500 to-amber-600',
    defaultTitle: 'Risk Analysis',
    defaultTitlePl: 'Analiza ryzyka',
    defaultIcon: '⚠️',
    contentJson: {
      type: 'doc',
      content: [
        h2('Risk Description'),
        p('What is the risk? Be specific about the threat.'),
        h2('Impact Assessment'),
        callout('critical', 'HIGH / MEDIUM / LOW — describe the potential impact'),
        h2('Probability'),
        callout('warning', 'HIGH / MEDIUM / LOW — likelihood of occurrence'),
        h2('Mitigation Plan'),
        todo('Preventive action 1'),
        todo('Contingency action 1'),
        h2('Owner & Timeline'),
        p('Who is responsible? What are the key dates?'),
      ],
    },
  },
  {
    id: 'meeting',
    icon: <MessageSquare size={20} />,
    label: 'Meeting Notes',
    labelPl: 'Notatki ze spotkania',
    description: 'Structured notes with agenda, decisions and action items',
    descriptionPl: 'Ustrukturyzowane notatki z agendą, decyzjami i zadaniami',
    gradient: 'from-blue-500 to-blue-600',
    defaultTitle: 'Meeting Notes',
    defaultTitlePl: 'Notatki ze spotkania',
    defaultIcon: '💬',
    contentJson: {
      type: 'doc',
      content: [
        h2('Date & Participants'),
        p('Date: [date] | Participants: [names]'),
        h2('Agenda'),
        todo('Topic 1'),
        todo('Topic 2'),
        h2('Discussion & Key Points'),
        p(''),
        h2('Decisions Made'),
        callout('success', 'Decision 1: ...'),
        h2('Action Items'),
        todo('Action 1 — Owner: [name], Due: [date]'),
        todo('Action 2 — Owner: [name], Due: [date]'),
      ],
    },
  },
  {
    id: 'hypothesis',
    icon: <FlaskConical size={20} />,
    label: 'Business Hypothesis',
    labelPl: 'Hipoteza biznesowa',
    description: 'Structure and test business assumptions',
    descriptionPl: 'Strukturyzuj i testuj założenia biznesowe',
    gradient: 'from-emerald-500 to-green-600',
    defaultTitle: 'Business Hypothesis',
    defaultTitlePl: 'Hipoteza biznesowa',
    defaultIcon: '🧪',
    contentJson: {
      type: 'doc',
      content: [
        h2('Hypothesis'),
        callout('info', 'We believe that [action] will result in [outcome] for [target audience].'),
        h2('Evidence For'),
        p('What data, signals or observations support this hypothesis?'),
        h2('Evidence Against'),
        p('What contradicts it? What are the risks?'),
        h2('Test Plan'),
        todo('Define success metrics'),
        todo('Design experiment / MVP'),
        todo('Set timeline and review date'),
        h2('Expected Outcome'),
        p('If validated, what should we do next?'),
      ],
    },
  },
  {
    id: 'research',
    icon: <SearchCode size={20} />,
    label: 'Research Notes',
    labelPl: 'Notatki z researchu',
    description: 'Organize research findings and sources',
    descriptionPl: 'Organizuj wyniki badań i źródła',
    gradient: 'from-amber-500 to-yellow-600',
    defaultTitle: 'Research Notes',
    defaultTitlePl: 'Notatki z researchu',
    defaultIcon: '🔍',
    contentJson: {
      type: 'doc',
      content: [
        h2('Topic'),
        p('What are you researching? Define the scope.'),
        h2('Sources'),
        todo('Source 1: [URL/title]'),
        todo('Source 2: [URL/title]'),
        h2('Key Findings'),
        callout('info', 'Finding 1: ...'),
        p(''),
        h2('Open Questions'),
        todo('Question 1'),
        todo('Question 2'),
        h2('Summary & Conclusions'),
        p(''),
      ],
    },
  },
];

function getNotebookTemplates(): PageTemplate[] {
  const today = format(new Date(), 'yyyy-MM-dd');
  const weekNum = getISOWeek(new Date());
  return [
    ...STATIC_TEMPLATES,
    {
      id: 'daily-log',
      icon: <Calendar size={20} />,
      label: 'Daily Log',
      labelPl: 'Dziennik',
      description: 'Track focus, notes, decisions and end-of-day review',
      descriptionPl: 'Śledź fokus, notatki, decyzje i podsumowanie dnia',
      gradient: 'from-blue-500 to-blue-600',
      defaultTitle: `Daily Log — ${today}`,
      defaultTitlePl: `Dziennik — ${today}`,
      defaultIcon: '📅',
      contentJson: {
        type: 'doc',
        content: [
          h2("Today's Focus"),
          p(''),
          h2('Notes'),
          p(''),
          h2('Decisions Made'),
          p(''),
          h2('End-of-day Review'),
          p(''),
        ],
      },
    },
    {
      id: 'weekly-review',
      icon: <BarChart size={20} />,
      label: 'Weekly Review',
      labelPl: 'Przegląd tygodnia',
      description: 'Reflect on wins, blockers, lessons and next week priorities',
      descriptionPl:
        'Refleksja nad sukcesami, blokerami, wnioskami i priorytetami na przyszły tydzień',
      gradient: 'from-indigo-500 to-blue-600',
      defaultTitle: `Weekly Review — Week ${weekNum}`,
      defaultTitlePl: `Przegląd tygodnia — Tydzień ${weekNum}`,
      defaultIcon: '📊',
      contentJson: {
        type: 'doc',
        content: [
          h2('Wins'),
          p(''),
          h2('Blockers'),
          p(''),
          h2('Lessons Learned'),
          p(''),
          h2('Next Week Priorities'),
          p(''),
        ],
      },
    },
  ];
}

interface NewPageModalProps {
  open: boolean;
  onClose: () => void;
  onSelectTemplate: (template: PageTemplate) => void;
  /** V4-NOTE-01: When upload completes, receives the created page */
  onUploadComplete?: (page: any) => void;
}

export const NewPageModal: React.FC<NewPageModalProps> = ({
  open,
  onClose,
  onSelectTemplate,
  onUploadComplete,
}) => {
  const { t } = useTranslation();
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const titleId = 'new-page-modal-title';

  const handleSelect = useCallback(
    async (tmpl: PageTemplate) => {
      if (tmpl.id === 'weekly-review') {
        try {
          const token = localStorage.getItem('token');
          const res = await fetch('/api/my-work/weekly-review/generate', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          });
          if (res.ok) {
            const data = await res.json();
            const completedCount = data.completedCount || 0;
            const decisionsCount = data.decisionsCount || 0;
            const overdueCount = data.overdueCount || 0;
            const stuckCount = data.stuckItems?.length || 0;

            const completedItems = (data.completedTasks || []).slice(0, 5);
            const overdueItems = (data.overdueItems || []).slice(0, 5);
            const stuckItems = (data.stuckItems || []).slice(0, 5);

            const winsContent: any[] = [];
            winsContent.push(p(`Completed ${completedCount} tasks this week.`));
            for (const item of completedItems) {
              winsContent.push(todo(`${item.title}`));
            }
            winsContent.push(p(`Made ${decisionsCount} decisions.`));

            const blockersContent: any[] = [];
            if (overdueCount > 0) {
              blockersContent.push(
                callout('critical', `${overdueCount} overdue items need attention`)
              );
              for (const item of overdueItems) {
                blockersContent.push(todo(`${item.title} (due: ${item.due_date || 'N/A'})`));
              }
            }
            if (stuckCount > 0) {
              blockersContent.push(
                callout('warning', `${stuckCount} tasks stuck (no update 5+ days)`)
              );
              for (const item of stuckItems) {
                blockersContent.push(todo(`${item.title}`));
              }
            }
            if (blockersContent.length === 0) {
              blockersContent.push(callout('success', 'No blockers this week!'));
            }

            const enrichedTemplate: PageTemplate = {
              ...tmpl,
              defaultTitle: `Weekly Review — ${format(new Date(), 'yyyy-MM-dd')}`,
              defaultTitlePl: `Przegląd tygodnia — ${format(new Date(), 'yyyy-MM-dd')}`,
              contentJson: {
                type: 'doc',
                content: [
                  h2('Wins'),
                  ...winsContent,
                  h2('Blockers'),
                  ...blockersContent,
                  h2('Lessons Learned'),
                  p(''),
                  h2('Next Week Priorities'),
                  todo('Review overdue items and reschedule or delegate'),
                  todo('Address stuck tasks'),
                  todo('Plan Monday focus items'),
                ],
              },
            };
            onSelectTemplate(enrichedTemplate);
            onClose();
            return;
          }
        } catch {
          // Fall through to static template
        }
      }
      onSelectTemplate(tmpl);
      onClose();
    },
    [onSelectTemplate, onClose]
  );

  const handleUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !onUploadComplete) return;
      setUploading(true);
      try {
        const page = await Api.uploadNotebookFile(file);
        onUploadComplete(page);
        onClose();
      } catch {
        // toast handled by caller or Api
      } finally {
        setUploading(false);
        e.target.value = '';
      }
    },
    [onUploadComplete, onClose]
  );

  // A11y: initial focus, focus trap (Tab cannot escape into the page behind
  // the overlay) and focus-restore-on-close, using the same technique as
  // src/components/ui/primitives/Modal.tsx (save previousActiveElement,
  // focus the dialog container on open, restore focus on close).
  useEffect(() => {
    if (!open) return;
    previousActiveElementRef.current = document.activeElement as HTMLElement;

    const focusTimer = setTimeout(() => {
      dialogRef.current?.focus();
    }, 0);

    const getFocusable = (): HTMLElement[] => {
      const container = dialogRef.current;
      if (!container) return [];
      return Array.from(
        container.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input:not([disabled]), select, [tabindex]:not([tabindex="-1"])'
        )
      );
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'Tab') {
        const focusable = getFocusable();
        if (focusable.length === 0) {
          e.preventDefault();
          dialogRef.current?.focus();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;
        if (e.shiftKey) {
          if (active === first || active === dialogRef.current) {
            e.preventDefault();
            last.focus();
          }
        } else if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      previousActiveElementRef.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="w-full max-w-2xl mx-4 rounded-2xl bg-c-surface border border-slate-200/60 dark:border-white/[0.03] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-c-border-subtle">
          <h2 id={titleId} className="text-base font-semibold text-c-text">
            {t('myWorkNotebook.newPageModal.title')}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-c-text-secondary hover:text-c-text hover:bg-c-surface-raised"
            aria-label={t('myWorkNotebook.newPageModal.close')}
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4">
          {onUploadComplete && (
            <div className="mb-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.xlsx,.xls,.txt,.md"
                className="hidden"
                onChange={handleUpload}
                disabled={uploading}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-c-border-subtle hover:border-c-border-strong hover:bg-c-surface-raised transition-colors"
              >
                <div className="shrink-0 p-2.5 rounded-lg bg-c-surface-raised text-c-text-secondary">
                  <Upload size={20} />
                </div>
                <div className="text-left">
                  <div className="font-medium text-sm text-c-text">
                    {t('myWorkNotebook.newPageModal.uploadFile')}
                  </div>
                  <div className="text-[11px] text-c-text-muted">
                    {uploading
                      ? t('myWorkNotebook.newPageModal.processing')
                      : t('myWorkNotebook.newPageModal.uploadHint')}
                  </div>
                </div>
              </button>
            </div>
          )}

          <p className="text-sm text-c-text-muted mb-4">
            {t('myWorkNotebook.newPageModal.pickTemplate')}
          </p>

          <div className="grid grid-cols-2 gap-3">
            {getNotebookTemplates().map((tmpl) => (
              <button
                key={tmpl.id}
                onClick={() => handleSelect(tmpl)}
                className="group flex items-start gap-3.5 w-full p-4 rounded-xl text-left border border-slate-200/60 dark:border-white/[0.03] hover:border-c-border-strong hover:shadow-md bg-c-surface transition-all duration-150 hover:-translate-y-0.5"
              >
                <div
                  className={`shrink-0 p-2.5 rounded-lg bg-gradient-to-br ${tmpl.gradient} text-white`}
                >
                  {tmpl.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm text-c-text">
                    {t(`myWorkNotebook.newPageModal.tmpl_${tmpl.id}_label`, tmpl.label)}
                  </div>
                  <div className="text-[11px] text-c-text-muted mt-0.5 line-clamp-2">
                    {t(`myWorkNotebook.newPageModal.tmpl_${tmpl.id}_desc`, tmpl.description)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
