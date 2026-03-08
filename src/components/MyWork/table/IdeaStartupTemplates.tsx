/**
 * IdeaStartupTemplates — V5 Seed Surface for Ideas.
 *
 * This keeps the entry calm and lightweight while still letting the user
 * choose a preferred starting path, template, and optional structured brief.
 */
import {
  ArrowRight,
  BarChart3,
  Brain,
  Cog,
  Lightbulb,
  Rocket,
  Search,
  Sparkles,
  Target,
  Wand2,
  X,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { IdeaStructuredBrief, IdeaWorkspaceSeedIntent } from '../ideaEntryTypes';
import type { CanvasToolType } from '../ideaSelectionTypes';

interface TemplateOption {
  id: string;
  nameEn: string;
  namePl: string;
  descEn: string;
  descPl: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  defaultTool: CanvasToolType;
  tags: string[];
}

const TEMPLATES: TemplateOption[] = [
  {
    id: 'strategic_initiative',
    nameEn: 'Strategic Initiative',
    namePl: 'Inicjatywa strategiczna',
    descEn: 'SWOT table + stakeholder map + risk register',
    descPl: 'Tabela SWOT + mapa interesariuszy + rejestr ryzyk',
    icon: Target,
    color: 'text-blue-600',
    defaultTool: 'table',
    tags: ['strategy', 'initiative', 'project'],
  },
  {
    id: 'process_improvement',
    nameEn: 'Process Improvement',
    namePl: 'Usprawnienie procesu',
    descEn: 'Process flow + metrics table + action plan',
    descPl: 'Schemat procesu + tabela metryk + plan działań',
    icon: Cog,
    color: 'text-emerald-600',
    defaultTool: 'process_flow',
    tags: ['process', 'improvement', 'optimization'],
  },
  {
    id: 'digital_transformation',
    nameEn: 'Digital Transformation',
    namePl: 'Transformacja cyfrowa',
    descEn: 'Maturity table + roadmap branches + KPI table',
    descPl: 'Tabela dojrzałości + gałęzie roadmapy + tabela KPI',
    icon: Rocket,
    color: 'text-violet-600',
    defaultTool: 'mindmap',
    tags: ['digital', 'transformation', 'technology'],
  },
  {
    id: 'innovation_idea',
    nameEn: 'Innovation Idea',
    namePl: 'Pomysł innowacyjny',
    descEn: 'Mind map + feasibility table + business case',
    descPl: 'Mapa myśli + tabela wykonalności + business case',
    icon: Lightbulb,
    color: 'text-amber-600',
    defaultTool: 'mindmap',
    tags: ['innovation', 'idea', 'creative'],
  },
  {
    id: 'problem_solving',
    nameEn: 'Problem Solving',
    namePl: 'Rozwiązywanie problemu',
    descEn: 'Root cause table + 5 Why branches + action plan',
    descPl: 'Tabela przyczyn + gałęzie 5 Why + plan działań',
    icon: Search,
    color: 'text-red-600',
    defaultTool: 'mindmap',
    tags: ['problem', 'analysis', 'root cause'],
  },
  {
    id: 'data_analysis',
    nameEn: 'Data Analysis',
    namePl: 'Analiza danych',
    descEn: 'Benchmarking table + KPI tracking + insights map',
    descPl: 'Tabela benchmarkingowa + śledzenie KPI + mapa wniosków',
    icon: BarChart3,
    color: 'text-indigo-600',
    defaultTool: 'table',
    tags: ['data', 'analysis', 'metrics', 'kpi'],
  },
  {
    id: 'custom',
    nameEn: 'Custom',
    namePl: 'Własny',
    descEn: 'Empty workspace — build from scratch',
    descPl: 'Pusty workspace — buduj od zera',
    icon: Brain,
    color: 'text-slate-600',
    defaultTool: 'mindmap',
    tags: [],
  },
];

interface IdeaStartupTemplatesProps {
  open: boolean;
  onClose: () => void;
  onSelect: (payload: IdeaWorkspaceSeedIntent) => void;
}

export const IdeaStartupTemplates: React.FC<IdeaStartupTemplatesProps> = ({
  open,
  onClose,
  onSelect,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [heroText, setHeroText] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('custom');
  const [selectedPopularStartId, setSelectedPopularStartId] = useState<string | null>(null);
  const [showStructuredBrief, setShowStructuredBrief] = useState(false);
  const [structuredBrief, setStructuredBrief] = useState<IdeaStructuredBrief>({
    problem: '',
    currentState: '',
    desiredOutcome: '',
    constraints: '',
    evidenceNotes: '',
  });

  const popularStarts = useMemo(
    () => [
      {
        id: 'break_down_problem',
        labelEn: 'Break down a problem',
        labelPl: 'Rozbij problem',
        promptEn: 'Break down this problem into the main dimensions, hypotheses, and next actions.',
        promptPl: 'Rozbij ten problem na główne wymiary, hipotezy i kolejne działania.',
        preferredSystem: 'mindmap' as CanvasToolType,
      },
      {
        id: 'root_causes',
        labelEn: 'Find root causes',
        labelPl: 'Znajdź przyczyny źródłowe',
        promptEn: 'Help me find the root causes behind this issue and structure them clearly.',
        promptPl: 'Pomóż mi znaleźć przyczyny źródłowe tego problemu i uporządkować je jasno.',
        preferredSystem: 'mindmap' as CanvasToolType,
      },
      {
        id: 'compare_options',
        labelEn: 'Compare options',
        labelPl: 'Porównaj opcje',
        promptEn: 'Create a comparison of the main options, tradeoffs, and recommended criteria.',
        promptPl: 'Przygotuj porównanie głównych opcji, trade-offów i rekomendowanych kryteriów.',
        preferredSystem: 'table' as CanvasToolType,
      },
      {
        id: 'map_process',
        labelEn: 'Map a process',
        labelPl: 'Zmapuj proces',
        promptEn:
          'Map the current process, key handoffs, bottlenecks, and improvement opportunities.',
        promptPl: 'Zmapuj obecny proces, główne handoffy, wąskie gardła i szanse usprawnień.',
        preferredSystem: 'process_flow' as CanvasToolType,
      },
      {
        id: 'turn_notes_into_structure',
        labelEn: 'Turn notes into structure',
        labelPl: 'Zamień notatki w strukturę',
        promptEn:
          'Turn these notes into a clear structure with themes, clusters, and recommended next steps.',
        promptPl:
          'Zamień te notatki w klarowną strukturę z tematami, klastrami i rekomendowanymi następnymi krokami.',
        preferredSystem: 'whiteboard' as CanvasToolType,
      },
      {
        id: 'simplify_financial_statement',
        labelEn: 'Simplify a financial statement',
        labelPl: 'Uprość sprawozdanie finansowe',
        promptEn:
          'Simplify this financial statement into a working analysis table with the most useful fields.',
        promptPl:
          'Uprość to sprawozdanie finansowe do roboczej tabeli analitycznej z najważniejszymi polami.',
        preferredSystem: 'table' as CanvasToolType,
      },
    ],
    []
  );

  const selectedTemplate = useMemo(
    () =>
      TEMPLATES.find((template) => template.id === selectedTemplateId) ||
      TEMPLATES[TEMPLATES.length - 1],
    [selectedTemplateId]
  );

  const selectedPopularStart = useMemo(
    () => popularStarts.find((intent) => intent.id === selectedPopularStartId) || null,
    [popularStarts, selectedPopularStartId]
  );

  const buildPayload = useCallback(
    (startMode: IdeaWorkspaceSeedIntent['startMode']): IdeaWorkspaceSeedIntent => {
      const seedText = String(heroText || selectedPopularStart?.promptEn || '').trim();
      return {
        startMode,
        seedText,
        preferredSystem:
          selectedPopularStart?.preferredSystem ||
          (startMode === 'use_template' ? selectedTemplate.defaultTool : 'mindmap'),
        templateId: startMode === 'use_template' ? selectedTemplate.id : null,
        popularStartId: selectedPopularStart?.id || null,
        popularStartLabel: selectedPopularStart
          ? isPl
            ? selectedPopularStart.labelPl
            : selectedPopularStart.labelEn
          : null,
        structuredBrief: showStructuredBrief ? structuredBrief : null,
        source: 'seed_surface',
      };
    },
    [heroText, isPl, selectedPopularStart, selectedTemplate, showStructuredBrief, structuredBrief]
  );

  const handleSelect = useCallback(
    (startMode: IdeaWorkspaceSeedIntent['startMode']) => {
      onSelect(buildPayload(startMode));
      setHeroText('');
      setSelectedPopularStartId(null);
      setSelectedTemplateId('custom');
      setShowStructuredBrief(false);
      setStructuredBrief({
        problem: '',
        currentState: '',
        desiredOutcome: '',
        constraints: '',
        evidenceNotes: '',
      });
      onClose();
    },
    [buildPayload, onClose, onSelect]
  );

  if (!open) return null;

  return (
    // V5-IDEA-41: Premium visual language for Seed Surface
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-[920px] max-h-[88vh] overflow-auto rounded-2xl border border-slate-200/40 dark:border-white/[0.04] bg-white/95 dark:bg-navy-900/95 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.25)] backdrop-blur-xl">
        <div className="relative flex items-center justify-between px-6 py-5 border-b border-slate-200/40 dark:border-white/[0.04] overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-violet-500/[0.03] via-transparent to-blue-500/[0.03] dark:from-violet-500/[0.06] dark:to-blue-500/[0.06]" />
          <div className="relative flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500/20 to-blue-500/20 flex items-center justify-center">
              <Sparkles size={16} className="text-violet-500" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {isPl ? 'Nowy pomysł' : 'New Idea'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {isPl
                  ? 'Spokojny start, szybkie przejście do workspace.'
                  : 'Calm start, fast handoff into workspace.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="relative p-1.5 rounded-lg hover:bg-slate-100/80 dark:hover:bg-white/[0.06] transition-colors duration-150"
          >
            <X size={16} className="text-slate-400" />
          </button>
        </div>

        <div className="px-6 py-6">
          <div className="rounded-2xl bg-gradient-to-br from-slate-50/90 to-slate-100/50 dark:from-white/[0.02] dark:to-white/[0.01] p-5 ring-1 ring-slate-200/30 dark:ring-white/[0.03]">
            <div className="max-w-3xl">
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-500/80 dark:text-violet-400/70">
                {isPl ? 'Twój pomysł' : 'Your idea'}
              </div>
              <h4 className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
                {isPl
                  ? 'Opisz problem, pomysł albo wynik'
                  : 'Describe the problem, idea, or outcome'}
              </h4>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                {isPl
                  ? 'Lekki start bez ciężkiego formularza. Brief dodasz tylko gdy potrzebujesz.'
                  : 'Start lightly without a heavy form. Add a brief only when you need it.'}
              </p>
            </div>
            <textarea
              value={heroText}
              onChange={(e) => setHeroText(e.target.value)}
              rows={5}
              placeholder={
                isPl
                  ? 'Np. Chcę uporządkować inicjatywy transformacyjne i znaleźć najlepszą kolejność wdrożeń...'
                  : 'For example: I want to structure the transformation initiatives and find the best rollout order...'
              }
              className="mt-4 w-full rounded-2xl border border-slate-200/70 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] px-4 py-3 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400/80 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
            />

            <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-3">
              <PrimaryStartButton
                icon={Wand2}
                title={isPl ? 'Start with AI' : 'Start with AI'}
                description={
                  isPl
                    ? 'Przenieś seed do workspace i od razu uruchom builder flow.'
                    : 'Move the seed into the workspace and trigger the builder flow immediately.'
                }
                onClick={() => handleSelect('describe_with_ai')}
                accent="violet"
              />
              <PrimaryStartButton
                icon={Brain}
                title={isPl ? 'Blank canvas' : 'Blank canvas'}
                description={
                  isPl
                    ? 'Otwórz spokojny workspace z wybranym systemem startowym.'
                    : 'Open a calm workspace with a preferred starting system.'
                }
                onClick={() => handleSelect('blank_canvas')}
                accent="slate"
              />
              <PrimaryStartButton
                icon={Target}
                title={isPl ? 'Use template' : 'Use template'}
                description={
                  isPl
                    ? 'Wejdź przez szablon startowy i ustaw domyślny system pracy.'
                    : 'Start from a template and set the default work system.'
                }
                onClick={() => handleSelect('use_template')}
                accent="emerald"
              />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <SectionTitle
                eyebrow={isPl ? 'Popular starts' : 'Popular starts'}
                title={isPl ? 'Intencje startowe' : 'Intent-led starting points'}
                description={
                  isPl
                    ? 'To są delikatne podpowiedzi intencji, nie wybór narzędzia.'
                    : 'These are gentle intent prompts, not tool choices.'
                }
              />

              <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                {popularStarts.map((intent) => (
                  <button
                    key={intent.id}
                    type="button"
                    onClick={() => {
                      setSelectedPopularStartId(intent.id);
                      if (!heroText.trim()) {
                        setHeroText(isPl ? intent.promptPl : intent.promptEn);
                      }
                    }}
                    className={`rounded-xl border px-3 py-3 text-left transition-all ${
                      selectedPopularStartId === intent.id
                        ? 'border-violet-500/40 bg-violet-500/5'
                        : 'border-slate-200/70 dark:border-white/[0.06] hover:bg-slate-50 dark:hover:bg-white/[0.03]'
                    }`}
                  >
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                      {isPl ? intent.labelPl : intent.labelEn}
                    </div>
                    <div className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                      {isPl ? intent.promptPl : intent.promptEn}
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-6">
                <button
                  type="button"
                  onClick={() => setShowStructuredBrief((value) => !value)}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.04]"
                >
                  <Sparkles size={14} />
                  {isPl ? 'Add structured brief' : 'Add structured brief'}
                </button>

                {showStructuredBrief && (
                  <div className="mt-3 grid grid-cols-1 gap-3 rounded-2xl border border-slate-200/70 dark:border-white/[0.06] bg-slate-50/70 dark:bg-white/[0.03] p-4">
                    <BriefField
                      label={isPl ? 'Problem' : 'Problem'}
                      value={structuredBrief.problem || ''}
                      onChange={(value) =>
                        setStructuredBrief((prev) => ({ ...prev, problem: value }))
                      }
                    />
                    <BriefField
                      label={isPl ? 'Current state' : 'Current state'}
                      value={structuredBrief.currentState || ''}
                      onChange={(value) =>
                        setStructuredBrief((prev) => ({ ...prev, currentState: value }))
                      }
                    />
                    <BriefField
                      label={isPl ? 'Desired outcome' : 'Desired outcome'}
                      value={structuredBrief.desiredOutcome || ''}
                      onChange={(value) =>
                        setStructuredBrief((prev) => ({ ...prev, desiredOutcome: value }))
                      }
                    />
                    <BriefField
                      label={isPl ? 'Constraints' : 'Constraints'}
                      value={structuredBrief.constraints || ''}
                      onChange={(value) =>
                        setStructuredBrief((prev) => ({ ...prev, constraints: value }))
                      }
                    />
                    <BriefField
                      label={isPl ? 'Evidence / notes' : 'Evidence / notes'}
                      value={structuredBrief.evidenceNotes || ''}
                      onChange={(value) =>
                        setStructuredBrief((prev) => ({ ...prev, evidenceNotes: value }))
                      }
                    />
                  </div>
                )}
              </div>
            </div>

            <div>
              <SectionTitle
                eyebrow={isPl ? 'Templates' : 'Templates'}
                title={isPl ? 'Szablon startowy' : 'Starting template'}
                description={
                  isPl
                    ? 'To przyspiesza wejście i ustawia preferowany system pracy.'
                    : 'This speeds up the entry and sets the preferred work system.'
                }
              />

              <div className="mt-3 grid grid-cols-1 gap-2">
                {TEMPLATES.map((template) => {
                  const Icon = template.icon;
                  const selected = selectedTemplateId === template.id;
                  return (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => setSelectedTemplateId(template.id)}
                      onMouseEnter={() => setHoveredId(template.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      className={`flex items-start gap-3 rounded-xl border px-3 py-3 text-left transition-all duration-150 ${
                        selected
                          ? 'border-violet-500/30 bg-violet-500/[0.04] ring-1 ring-violet-500/20 shadow-sm'
                          : hoveredId === template.id
                            ? 'border-slate-300/60 dark:border-white/[0.08] bg-slate-50/80 dark:bg-white/[0.03]'
                            : 'border-slate-200/50 dark:border-white/[0.04] hover:bg-slate-50/60 dark:hover:bg-white/[0.02]'
                      }`}
                    >
                      <Icon size={18} className={`${template.color} mt-0.5 shrink-0`} />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                          {isPl ? template.namePl : template.nameEn}
                        </div>
                        <div className="mt-0.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                          {isPl ? template.descPl : template.descEn}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200/70 dark:border-white/[0.06] bg-slate-50/70 dark:bg-white/[0.03] p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                  {isPl ? 'Current handoff' : 'Current handoff'}
                </div>
                <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {selectedPopularStart
                    ? isPl
                      ? selectedPopularStart.labelPl
                      : selectedPopularStart.labelEn
                    : isPl
                      ? selectedTemplate.namePl
                      : selectedTemplate.nameEn}
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {isPl ? 'Preferowany system' : 'Preferred system'}:{' '}
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {selectedPopularStart?.preferredSystem || selectedTemplate.defaultTool}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <InlineStartChip
                    label={isPl ? 'Start with AI' : 'Start with AI'}
                    onClick={() => handleSelect('describe_with_ai')}
                  />
                  <InlineStartChip
                    label={isPl ? 'Blank canvas' : 'Blank canvas'}
                    onClick={() => handleSelect('blank_canvas')}
                  />
                  <InlineStartChip
                    label={isPl ? 'Use template' : 'Use template'}
                    onClick={() => handleSelect('use_template')}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const SectionTitle: React.FC<{
  eyebrow: string;
  title: string;
  description: string;
}> = ({ eyebrow, title, description }) => (
  <div>
    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
      {eyebrow}
    </div>
    <h4 className="mt-2 text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h4>
    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
  </div>
);

const BriefField: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
}> = ({ label, value, onChange }) => (
  <label className="block">
    <div className="mb-1 text-[11px] font-medium text-slate-600 dark:text-slate-300">{label}</div>
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={2}
      className="w-full rounded-xl border border-slate-200/70 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] px-3 py-2 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400/70 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
    />
  </label>
);

const PrimaryStartButton: React.FC<{
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  description: string;
  onClick: () => void;
  accent: 'violet' | 'slate' | 'emerald';
}> = ({ icon: Icon, title, description, onClick, accent }) => {
  // V5-IDEA-41: Premium visual language
  const accentClass =
    accent === 'violet'
      ? 'from-violet-500/10 via-indigo-500/5 to-transparent text-violet-700 dark:text-violet-300 border-violet-500/20 hover:border-violet-500/35 hover:shadow-violet-500/10'
      : accent === 'emerald'
        ? 'from-emerald-500/10 via-teal-500/5 to-transparent text-emerald-700 dark:text-emerald-300 border-emerald-500/20 hover:border-emerald-500/35 hover:shadow-emerald-500/10'
        : 'from-slate-500/8 via-slate-400/3 to-transparent text-slate-700 dark:text-slate-200 border-slate-200/60 dark:border-white/[0.06] hover:border-slate-300/80 hover:shadow-slate-500/5';

  const iconBg =
    accent === 'violet'
      ? 'bg-violet-500/10 text-violet-500'
      : accent === 'emerald'
        ? 'bg-emerald-500/10 text-emerald-500'
        : 'bg-slate-500/10 text-slate-500';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex items-start gap-3 rounded-2xl border bg-gradient-to-br px-4 py-3.5 text-left transition-all duration-200 hover:shadow-lg ${accentClass}`}
    >
      <div
        className={`mt-0.5 rounded-xl p-2 ${iconBg} transition-transform duration-200 group-hover:scale-110`}
      >
        <Icon size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold tracking-tight">{title}</div>
        <div className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
          {description}
        </div>
      </div>
      <ArrowRight
        size={14}
        className="mt-1.5 shrink-0 text-slate-400 transition-transform duration-200 group-hover:translate-x-0.5"
      />
    </button>
  );
};

const InlineStartChip: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="rounded-full border border-slate-200/70 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.04]"
  >
    {label}
  </button>
);

export default IdeaStartupTemplates;
