import {
  BarChart3,
  Camera,
  ChevronsDownUp,
  ChevronsUpDown,
  Globe,
  History,
  Layout,
  LayoutGrid,
  Maximize,
  Search,
  Share2,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface MoreToolsPanelProps {
  isPl: boolean;
  onAction: (action: string) => void;
  onClose: () => void;
}

interface ToolItem {
  action: string;
  iconEl: React.ComponentType<{ size?: number; className?: string }>;
  tkey: string;
  labelEn: string;
  category: 'visual' | 'workflow' | 'collab' | 'analytics' | 'formatting';
}

const ALL_TOOLS: ToolItem[] = [
  // Visual Modes
  {
    action: 'mm_change_layout',
    tkey: 'myWorkMindmap.moreTools.changeLayout',
    iconEl: Layout,
    labelEn: 'Change layout',
    category: 'visual',
  },
  {
    action: 'mm_structure_picker',
    tkey: 'myWorkMindmap.moreTools.structureType',
    iconEl: LayoutGrid,
    labelEn: 'Structure type',
    category: 'visual',
  },
  {
    action: 'mm_toggle_minimap',
    tkey: 'myWorkMindmap.moreTools.minimap',
    iconEl: LayoutGrid,
    labelEn: 'Minimap',
    category: 'visual',
  },
  {
    action: 'mm_fit_view',
    tkey: 'myWorkMindmap.moreTools.fitView',
    iconEl: Maximize,
    labelEn: 'Fit view',
    category: 'visual',
  },
  // MM-P2-01 (2026-08-10, `08_P1_P3_EXECUTION_PLAN_FOR_CLAUDE.md` §6 Wave 2):
  // "Presentation mode" used to be listed HERE too, dispatching the exact
  // same `mm_presentation` action as the rail's dedicated Play-icon "Present"
  // button (`CanvasLeftToolbar.tsx`'s `MM_CONTEXT_SLOTS`) — an unlabeled,
  // undiscoverable duplicate of the same command. Removed rather than
  // re-labeled: the rail button is a single click, always visible while the
  // Mind Map tool is active, so this entry added a second, more-buried path
  // to identical behavior with no distinct purpose of its own.
  {
    action: 'mm_fold_0',
    tkey: 'myWorkMindmap.moreTools.collapseToRoot',
    iconEl: ChevronsDownUp,
    labelEn: 'Collapse to root (Alt+0)',
    category: 'visual',
  },
  {
    action: 'mm_fold_1',
    tkey: 'myWorkMindmap.moreTools.showLevel1',
    iconEl: ChevronsDownUp,
    labelEn: 'Show level 1 (Alt+1)',
    category: 'visual',
  },
  {
    action: 'mm_fold_2',
    tkey: 'myWorkMindmap.moreTools.showLevel2',
    iconEl: ChevronsDownUp,
    labelEn: 'Show level 2 (Alt+2)',
    category: 'visual',
  },
  {
    action: 'mm_fold_3',
    tkey: 'myWorkMindmap.moreTools.showLevel3',
    iconEl: ChevronsDownUp,
    labelEn: 'Show level 3 (Alt+3)',
    category: 'visual',
  },
  {
    action: 'mm_expand_all',
    tkey: 'myWorkMindmap.moreTools.expandAll',
    iconEl: ChevronsUpDown,
    labelEn: 'Expand all (Alt+9)',
    category: 'visual',
  },

  // Workflow
  {
    action: 'mm_snapshots',
    tkey: 'myWorkMindmap.moreTools.snapshotsVersions',
    iconEl: Camera,
    labelEn: 'Snapshots / Versions',
    category: 'workflow',
  },
  {
    action: 'mm_activity',
    tkey: 'myWorkMindmap.moreTools.activityHistory',
    iconEl: History,
    labelEn: 'Activity history',
    category: 'workflow',
  },

  // Collaboration
  {
    action: 'mm_share',
    tkey: 'myWorkMindmap.moreTools.share',
    iconEl: Share2,
    labelEn: 'Share',
    category: 'collab',
  },
  {
    action: 'mm_embed',
    tkey: 'myWorkMindmap.moreTools.embedExternally',
    iconEl: Globe,
    labelEn: 'Embed externally',
    category: 'collab',
  },

  // Analytics
  {
    action: 'mm_branch_analysis',
    tkey: 'myWorkMindmap.moreTools.branchAnalysis',
    iconEl: BarChart3,
    labelEn: 'Branch analysis',
    category: 'analytics',
  },
];

const CATEGORY_LABELS: Record<string, string> = {
  visual: 'Visual Modes',
  workflow: 'Workflow',
  collab: 'Collaboration',
  analytics: 'Analytics',
  formatting: 'Formatting',
};

export const MoreToolsPanel: React.FC<MoreToolsPanelProps> = ({
  isPl: _isPl,
  onAction,
  onClose,
}) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return ALL_TOOLS;
    const q = search.toLowerCase();
    return ALL_TOOLS.filter((tool) => t(tool.tkey, tool.labelEn).toLowerCase().includes(q));
  }, [search, t]);

  const grouped = useMemo(() => {
    const groups: Record<string, ToolItem[]> = {};
    for (const t of filtered) {
      if (!groups[t.category]) groups[t.category] = [];
      groups[t.category].push(t);
    }
    return groups;
  }, [filtered]);

  const dispatch = (action: string) => {
    onAction(action);
    onClose();
  };

  return (
    <div className="w-[280px] max-h-[440px] overflow-y-auto rounded-xl bg-c-surface-raised dark:bg-c-surface border border-c-border-subtle dark:border-c-border-subtle shadow-xl">
      <div className="p-2 sticky top-0 bg-c-surface-raised dark:bg-c-surface z-10">
        <div className="relative">
          <Search
            size={12}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-c-text-secondary"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('ideas.mindmap.searchTools', 'Search tools…')}
            className="w-full pl-7 pr-2 py-1.5 text-[11px] rounded-lg bg-c-surface-raised dark:bg-c-surface border border-c-border-subtle dark:border-c-border-subtle text-c-text-secondary dark:text-c-text placeholder:text-c-text-muted outline-none focus:ring-1 focus:ring-c-border"
            autoFocus
          />
        </div>
      </div>
      <div className="px-1 pb-1.5">
        {Object.entries(grouped).map(([cat, items]) => (
          <div key={cat}>
            <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-[0.15em] text-c-text-secondary">
              {t(`myWorkMindmap.category.${cat}`, CATEGORY_LABELS[cat])}
            </div>
            {items.map((tool) => {
              const Icon = tool.iconEl;
              return (
                <button
                  key={tool.action}
                  onClick={() => dispatch(tool.action)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] text-c-text-secondary dark:text-c-text hover:bg-c-surface-raised dark:hover:bg-c-surface-raised transition-colors"
                >
                  <Icon size={12} className="text-c-text-secondary shrink-0" />
                  {t(tool.tkey, tool.labelEn)}
                </button>
              );
            })}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="px-2 py-4 text-[10px] text-c-text-secondary text-center">
            {t('ideas.mindmap.noResults', 'No results')}
          </div>
        )}
      </div>
    </div>
  );
};
