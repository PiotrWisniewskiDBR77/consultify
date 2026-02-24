import {
  Brain,
  FileText,
  FlaskConical,
  MessageSquare,
  SearchCode,
  ShieldAlert,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

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

export const NOTEBOOK_TEMPLATES: PageTemplate[] = [
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
    gradient: 'from-violet-500 to-purple-600',
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
    gradient: 'from-red-500 to-orange-600',
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
    gradient: 'from-blue-500 to-cyan-600',
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

interface NewPageModalProps {
  open: boolean;
  onClose: () => void;
  onSelectTemplate: (template: PageTemplate) => void;
}

export const NewPageModal: React.FC<NewPageModalProps> = ({ open, onClose, onSelectTemplate }) => {
  const { i18n } = useTranslation();
  const pl = i18n.language === 'pl';
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleSelect = useCallback(
    (tmpl: PageTemplate) => {
      onSelectTemplate(tmpl);
      onClose();
    },
    [onSelectTemplate, onClose],
  );

  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
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
      <div className="w-full max-w-2xl mx-4 rounded-2xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-navy-800">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            {pl ? 'Nowa notatka' : 'New Note'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            {pl
              ? 'Wybierz szablon, aby szybciej zacząć pisać'
              : 'Pick a template to get started faster'}
          </p>

          <div className="grid grid-cols-2 gap-3">
            {NOTEBOOK_TEMPLATES.map((tmpl) => (
              <button
                key={tmpl.id}
                onClick={() => handleSelect(tmpl)}
                className="group flex items-start gap-3.5 w-full p-4 rounded-xl text-left border border-slate-200 dark:border-navy-700 hover:border-slate-300 dark:hover:border-navy-600 hover:shadow-md bg-white dark:bg-navy-950 transition-all duration-150 hover:-translate-y-0.5"
              >
                <div
                  className={`shrink-0 p-2.5 rounded-lg bg-gradient-to-br ${tmpl.gradient} text-white`}
                >
                  {tmpl.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm text-slate-900 dark:text-white">
                    {pl ? tmpl.labelPl : tmpl.label}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                    {pl ? tmpl.descriptionPl : tmpl.description}
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
