import { Layers, Search } from 'lucide-react';
import React, { useMemo, useState } from 'react';

interface TemplatesPopoverProps {
  isPl: boolean;
  activeTool: string;
  onApplyTemplate: (templateId: string) => void;
  onSaveAsTemplate: () => void;
  onClose: () => void;
}

const MIND_MAP_TEMPLATES = [
  { id: 'problem_tree', labelPl: 'Drzewo problemów', labelEn: 'Problem tree' },
  { id: 'issue_tree', labelPl: 'Drzewo zagadnień', labelEn: 'Issue tree' },
  { id: 'solution_tree', labelPl: 'Drzewo rozwiązań', labelEn: 'Solution tree' },
  { id: 'root_cause', labelPl: 'Root cause map', labelEn: 'Root cause map' },
  { id: 'decision_map', labelPl: 'Mapa decyzyjna', labelEn: 'Decision map' },
  { id: 'swot', labelPl: 'SWOT', labelEn: 'SWOT' },
];

const PROCESS_TEMPLATES = [
  { id: 'classic_flow', labelPl: 'Klasyczny przepływ', labelEn: 'Classic flow' },
  { id: 'automation_flow', labelPl: 'Automatyzacja', labelEn: 'Automation flow' },
  { id: 'vsm_current', labelPl: 'VSM stan obecny', labelEn: 'VSM current state' },
  { id: 'vsm_future', labelPl: 'VSM stan przyszły', labelEn: 'VSM future state' },
];

const WHITEBOARD_TEMPLATES = [
  { id: 'brainstorm', labelPl: 'Burza mózgów', labelEn: 'Brainstorming' },
  { id: 'affinity', labelPl: 'Affinity mapping', labelEn: 'Affinity mapping' },
  { id: 'workshop', labelPl: 'Tablica warsztatowa', labelEn: 'Workshop board' },
  { id: 'retro', labelPl: 'Retrospektywa', labelEn: 'Retrospective' },
];

const TABLE_TEMPLATES = [
  { id: 'decision_matrix', labelPl: 'Macierz decyzyjna', labelEn: 'Decision matrix' },
  { id: 'assumptions_log', labelPl: 'Rejestr założeń', labelEn: 'Assumptions log' },
  { id: 'action_plan', labelPl: 'Plan działania', labelEn: 'Action plan' },
  { id: 'risk_register', labelPl: 'Rejestr ryzyk', labelEn: 'Risk register' },
];

const TEMPLATES_BY_TOOL: Record<string, typeof MIND_MAP_TEMPLATES> = {
  mindmap: MIND_MAP_TEMPLATES,
  process_flow: PROCESS_TEMPLATES,
  whiteboard: WHITEBOARD_TEMPLATES,
  table: TABLE_TEMPLATES,
};

export const TemplatesPopover: React.FC<TemplatesPopoverProps> = ({
  isPl,
  activeTool,
  onApplyTemplate,
  onSaveAsTemplate,
  onClose,
}) => {
  const [search, setSearch] = useState('');

  const templates = useMemo(() => {
    const list = TEMPLATES_BY_TOOL[activeTool] || MIND_MAP_TEMPLATES;
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (t) => t.labelPl.toLowerCase().includes(q) || t.labelEn.toLowerCase().includes(q)
    );
  }, [activeTool, search]);

  return (
    <div className="w-60 max-h-[400px] overflow-y-auto rounded-xl bg-white dark:bg-navy-900 border border-slate-200/60 dark:border-white/[0.06] shadow-xl">
      <div className="p-2">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isPl ? 'Szukaj szablonów…' : 'Search templates…'}
            className="w-full pl-7 pr-2 py-1.5 text-[11px] rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200/40 dark:border-white/[0.04] text-slate-700 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:ring-1 focus:ring-primary-500/30"
            autoFocus
          />
        </div>
      </div>
      <div className="px-1 pb-1">
        <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400">
          {isPl ? 'Szablony' : 'Templates'}
        </div>
        {templates.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              onApplyTemplate(t.id);
              onClose();
            }}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors"
          >
            <Layers size={12} className="text-slate-400 shrink-0" />
            {isPl ? t.labelPl : t.labelEn}
          </button>
        ))}
        {templates.length === 0 && (
          <div className="px-2 py-3 text-[10px] text-slate-400 text-center">
            {isPl ? 'Brak wyników' : 'No results'}
          </div>
        )}
      </div>
      <div className="border-t border-slate-200/30 dark:border-white/[0.04] px-1 py-1">
        <button
          onClick={() => {
            onSaveAsTemplate();
            onClose();
          }}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-500/5 transition-colors"
        >
          + {isPl ? 'Zapisz bieżącą jako szablon' : 'Save current as template'}
        </button>
      </div>
    </div>
  );
};
