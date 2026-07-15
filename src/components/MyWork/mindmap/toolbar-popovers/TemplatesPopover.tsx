import { ChevronRight, Compass, Layers, Search } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

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
  { id: 'mm-blank', labelEn: 'Blank mind map' },
  { id: 'mm-swot', labelEn: 'SWOT analysis' },
  { id: 'mm-5whys', labelEn: '5 Whys' },
  { id: 'mm-fishbone', labelEn: 'Fishbone / Ishikawa' },
  { id: 'mm-stakeholder', labelEn: 'Stakeholder map' },
  { id: 'mm-okr', labelEn: 'OKR cascade' },
];

const PROCESS_TEMPLATES = [
  { id: 'pf-blank', labelEn: 'Blank process' },
  {
    id: 'pf-process-improvement',
    labelEn: 'Process improvement workshop',
  },
  { id: 'pf-basic', labelEn: 'Basic process' },
  { id: 'pf-approval', labelEn: 'Approval workflow' },
  { id: 'pf-pdca', labelEn: 'PDCA cycle' },
  { id: 'pf-o2c', labelEn: 'Order to Cash' },
];

const WHITEBOARD_TEMPLATES = [
  { id: 'wb-blank', labelEn: 'Blank whiteboard' },
  { id: 'wb-bmc', labelEn: 'Business Model Canvas' },
  { id: 'wb-impact-effort', labelEn: 'Impact / Effort matrix' },
  { id: 'wb-retro', labelEn: 'Retrospective' },
  { id: 'wb-lean-canvas', labelEn: 'Lean Canvas' },
  { id: 'wb-cjm', labelEn: 'Customer journey map' },
];

const TABLE_TEMPLATES = [
  { id: 'tbl-decision-matrix', labelEn: 'Decision matrix' },
  { id: 'tbl-assumptions-log', labelEn: 'Assumptions log' },
  { id: 'tbl-action-plan', labelEn: 'Action plan' },
  { id: 'tbl-risk-register', labelEn: 'Risk register' },
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
  const { t } = useTranslation();
  const [search, setSearch] = useState('');

  const templates = useMemo(() => {
    const list = TEMPLATES_BY_TOOL[activeTool] || MIND_MAP_TEMPLATES;
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((tpl) =>
      t(`myWorkMindmap.template.${tpl.id}`, tpl.labelEn).toLowerCase().includes(q)
    );
  }, [activeTool, search, t]);

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
    <div className="w-64 max-h-[440px] overflow-y-auto rounded-xl bg-c-surface-raised dark:bg-c-surface border border-c-border-subtle dark:border-c-border-subtle shadow-xl">
      <div className="p-2">
        <div className="relative">
          <Search
            size={12}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-c-text-secondary"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('ideas.mindmap.search', 'Search…')}
            className="w-full pl-7 pr-2 py-1.5 text-[11px] rounded-lg bg-c-surface-raised dark:bg-c-surface border border-c-border-subtle dark:border-c-border-subtle text-c-text-secondary dark:text-c-text placeholder:text-c-text-muted outline-none focus:ring-1 focus:ring-c-border"
            autoFocus
          />
        </div>
      </div>

      {/* Starting points (Popular Starts) */}
      {filteredStarts.length > 0 && (
        <div className="px-1 pb-1">
          <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-[0.15em] text-c-text-secondary">
            {t('ideas.mindmap.startingPoints', 'Starting points')}
          </div>
          {filteredStarts.map((s) => (
            <button
              key={s.id}
              onClick={() => handleIntentClick(s.id)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] text-c-text-secondary dark:text-c-text hover:bg-c-surface-raised dark:hover:bg-c-surface transition-colors"
            >
              <Compass size={12} className="text-c-text-secondary shrink-0" />
              {isPl ? s.labelPl : s.labelEn}
            </button>
          ))}
        </div>
      )}

      {/* Divider between sections */}
      {filteredStarts.length > 0 && templates.length > 0 && (
        <div className="border-t border-c-border-subtle dark:border-c-border-subtle" />
      )}

      {/* Templates */}
      <div className="px-1 pb-1">
        <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-[0.15em] text-c-text-secondary">
          {t('ideas.mindmap.templates', 'Templates')}
        </div>
        {templates.map((tpl) => (
          <button
            key={tpl.id}
            onClick={() => {
              onApplyTemplate(tpl.id);
              onClose();
            }}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] text-c-text-secondary dark:text-c-text hover:bg-c-surface-raised dark:hover:bg-c-surface-raised transition-colors"
          >
            <Layers size={12} className="text-c-text-secondary shrink-0" />
            {t(`myWorkMindmap.template.${tpl.id}`, tpl.labelEn)}
          </button>
        ))}
        {templates.length === 0 && filteredStarts.length === 0 && (
          <div className="px-2 py-3 text-[10px] text-c-text-secondary text-center">
            {t('ideas.mindmap.noResults', 'No results')}
          </div>
        )}
      </div>
      <div className="border-t border-c-border-subtle dark:border-c-border-subtle px-1 py-1">
        <button
          onClick={() => {
            onOpenGallery();
            onClose();
          }}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] font-medium text-c-text-secondary dark:text-c-text-muted hover:bg-c-surface-raised dark:hover:bg-c-surface transition-colors"
        >
          <ChevronRight size={12} />
          {t('ideas.mindmap.seeMore', 'See more')}
        </button>
      </div>
    </div>
  );
};
