/**
 * IdeaStartupTemplates — Context-aware template picker for new ideas.
 * Offers pre-built workspace configurations based on idea type.
 */
import {
  BarChart3,
  Brain,
  Cog,
  Lightbulb,
  Rocket,
  Search,
  Sparkles,
  Target,
  X,
} from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface TemplateOption {
  id: string;
  nameEn: string;
  namePl: string;
  descEn: string;
  descPl: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  defaultTool: 'mindmap' | 'table' | 'process_flow' | 'whiteboard';
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
  onSelect: (templateId: string, defaultTool: string) => void;
}

export const IdeaStartupTemplates: React.FC<IdeaStartupTemplatesProps> = ({
  open,
  onClose,
  onSelect,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const handleSelect = useCallback(
    (template: TemplateOption) => {
      onSelect(template.id, template.defaultTool);
      onClose();
    },
    [onClose, onSelect]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="w-[520px] max-h-[80vh] overflow-auto rounded-2xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200/60 dark:border-navy-700/60">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-violet-500" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {isPl ? 'Wybierz szablon' : 'Choose a template'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800">
            <X size={16} className="text-slate-400" />
          </button>
        </div>

        <div className="px-5 py-4">
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-4">
            {isPl
              ? 'Wybierz typ wyzwania. AI dostosuje workspace do Twojego kontekstu.'
              : 'Choose a challenge type. AI will adapt the workspace to your context.'}
          </p>

          <div className="grid grid-cols-2 gap-2">
            {TEMPLATES.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => handleSelect(t)}
                  onMouseEnter={() => setHoveredId(t.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all ${
                    hoveredId === t.id
                      ? 'border-violet-500/40 bg-violet-500/5 shadow-md'
                      : 'border-slate-200/60 dark:border-navy-700/60 hover:bg-slate-50 dark:hover:bg-navy-800'
                  }`}
                >
                  <Icon size={22} className={`${t.color} flex-shrink-0 mt-0.5`} />
                  <div>
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {isPl ? t.namePl : t.nameEn}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                      {isPl ? t.descPl : t.descEn}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default IdeaStartupTemplates;
