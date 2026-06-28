import { ChevronRight, Compass, Layers, Search } from 'lucide-react';
import React, { useMemo, useState } from 'react';

import { IDEA_STARTING_POINTS } from '../../ideaStartingPoints';

export const APPLY_INTENT_EVENT = 'idea-workspace-apply-intent';

interface TemplatesPopoverProps {
  isPl: boolean;
  activeTool: string;
  onApplyTemplate: (templateId: string) => void;
  onOpenGallery: () => void;
  onClose: () => void;
}

const MIND_MAP_TEMPLATES = [
  { id: 'mm-blank', labelPl: 'Pusta mapa myśli', labelEn: 'Blank mind map' },
  { id: 'mm-swot', labelPl: 'Analiza SWOT', labelEn: 'SWOT analysis' },
  { id: 'mm-5whys', labelPl: '5 Dlaczego', labelEn: '5 Whys' },
  { id: 'mm-fishbone', labelPl: 'Diagram Ishikawy', labelEn: 'Fishbone / Ishikawa' },
  { id: 'mm-stakeholder', labelPl: 'Mapa interesariuszy', labelEn: 'Stakeholder map' },
  { id: 'mm-okr', labelPl: 'Kaskada OKR', labelEn: 'OKR cascade' },
];

const PROCESS_TEMPLATES = [
  { id: 'pf-blank', labelPl: 'Pusty proces', labelEn: 'Blank process' },
  {
    id: 'pf-process-improvement',
    labelPl: 'Warsztat usprawnienia procesu',
    labelEn: 'Process improvement workshop',
  },
  { id: 'pf-basic', labelPl: 'Podstawowy proces', labelEn: 'Basic process' },
  { id: 'pf-approval', labelPl: 'Proces akceptacji', labelEn: 'Approval workflow' },
  { id: 'pf-pdca', labelPl: 'Cykl PDCA', labelEn: 'PDCA cycle' },
  { id: 'pf-o2c', labelPl: 'Order to Cash', labelEn: 'Order to Cash' },
];

const WHITEBOARD_TEMPLATES = [
  { id: 'wb-blank', labelPl: 'Pusta tablica', labelEn: 'Blank whiteboard' },
  { id: 'wb-bmc', labelPl: 'Business Model Canvas', labelEn: 'Business Model Canvas' },
  { id: 'wb-impact-effort', labelPl: 'Macierz Wpływ / Wysiłek', labelEn: 'Impact / Effort matrix' },
  { id: 'wb-retro', labelPl: 'Retrospektywa', labelEn: 'Retrospective' },
  { id: 'wb-lean-canvas', labelPl: 'Lean Canvas', labelEn: 'Lean Canvas' },
  { id: 'wb-cjm', labelPl: 'Mapa podróży klienta', labelEn: 'Customer journey map' },
];

const TABLE_TEMPLATES = [
  { id: 'tbl-decision-matrix', labelPl: 'Macierz decyzyjna', labelEn: 'Decision matrix' },
  { id: 'tbl-assumptions-log', labelPl: 'Rejestr założeń', labelEn: 'Assumptions log' },
  { id: 'tbl-action-plan', labelPl: 'Plan działania', labelEn: 'Action plan' },
  { id: 'tbl-risk-register', labelPl: 'Rejestr ryzyk', labelEn: 'Risk register' },
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
  onOpenGallery,
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

  const filteredStarts = useMemo(() => {
    if (!search.trim()) return IDEA_STARTING_POINTS;
    const q = search.toLowerCase();
    return IDEA_STARTING_POINTS.filter(
      (s) => s.labelPl.toLowerCase().includes(q) || s.labelEn.toLowerCase().includes(q)
    );
  }, [search]);

  const handleIntentClick = (intentId: string) => {
    const intent = IDEA_STARTING_POINTS.find((s) => s.id === intentId);
    if (!intent) return;
    window.dispatchEvent(
      new CustomEvent(APPLY_INTENT_EVENT, {
        detail: {
          intentId: intent.id,
          seedText: isPl ? intent.promptPl : intent.promptEn,
          preferredSystem: intent.preferredSystem,
          label: isPl ? intent.labelPl : intent.labelEn,
        },
      })
    );
    onClose();
  };

  return (
    <div className="w-64 max-h-[440px] overflow-y-auto rounded-xl bg-white dark:bg-navy-900 border border-slate-200/60 dark:border-white/[0.06] shadow-xl">
      <div className="p-2">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isPl ? 'Szukaj…' : 'Search…'}
            className="w-full pl-7 pr-2 py-1.5 text-[11px] rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200/40 dark:border-white/[0.04] text-slate-700 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:ring-1 focus:ring-slate-400/30"
            autoFocus
          />
        </div>
      </div>

      {/* Starting points (Popular Starts) */}
      {filteredStarts.length > 0 && (
        <div className="px-1 pb-1">
          <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-[0.15em] text-slate-500/70">
            {isPl ? 'Punkty startowe' : 'Starting points'}
          </div>
          {filteredStarts.map((s) => (
            <button
              key={s.id}
              onClick={() => handleIntentClick(s.id)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
            >
              <Compass size={12} className="text-slate-500 shrink-0" />
              {isPl ? s.labelPl : s.labelEn}
            </button>
          ))}
        </div>
      )}

      {/* Divider between sections */}
      {filteredStarts.length > 0 && templates.length > 0 && (
        <div className="border-t border-slate-200/30 dark:border-white/[0.04]" />
      )}

      {/* Templates */}
      <div className="px-1 pb-1">
        <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-[0.15em] text-slate-600">
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
            <Layers size={12} className="text-slate-600 shrink-0" />
            {isPl ? t.labelPl : t.labelEn}
          </button>
        ))}
        {templates.length === 0 && filteredStarts.length === 0 && (
          <div className="px-2 py-3 text-[10px] text-slate-600 text-center">
            {isPl ? 'Brak wyników' : 'No results'}
          </div>
        )}
      </div>
      <div className="border-t border-slate-200/30 dark:border-white/[0.04] px-1 py-1">
        <button
          onClick={() => {
            onOpenGallery();
            onClose();
          }}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
        >
          <ChevronRight size={12} />
          {isPl ? 'Zobacz więcej' : 'See more'}
        </button>
      </div>
    </div>
  );
};
