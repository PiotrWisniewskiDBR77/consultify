import {
  BarChart3,
  Camera,
  ChevronsDownUp,
  ChevronsUpDown,
  Eye,
  Globe,
  History,
  Layout,
  LayoutGrid,
  Maximize,
  Search,
  Share2,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';

interface MoreToolsPanelProps {
  isPl: boolean;
  onAction: (action: string) => void;
  onClose: () => void;
}

interface ToolItem {
  action: string;
  iconEl: React.ComponentType<{ size?: number; className?: string }>;
  labelPl: string;
  labelEn: string;
  category: 'visual' | 'workflow' | 'collab' | 'analytics' | 'formatting';
}

const ALL_TOOLS: ToolItem[] = [
  // Visual Modes
  {
    action: 'mm_change_layout',
    iconEl: Layout,
    labelPl: 'Zmień układ',
    labelEn: 'Change layout',
    category: 'visual',
  },
  {
    action: 'mm_structure_picker',
    iconEl: LayoutGrid,
    labelPl: 'Typ struktury',
    labelEn: 'Structure type',
    category: 'visual',
  },
  {
    action: 'mm_toggle_minimap',
    iconEl: LayoutGrid,
    labelPl: 'Minimap',
    labelEn: 'Minimap',
    category: 'visual',
  },
  {
    action: 'mm_fit_view',
    iconEl: Maximize,
    labelPl: 'Dopasuj widok',
    labelEn: 'Fit view',
    category: 'visual',
  },
  {
    action: 'mm_presentation',
    iconEl: Eye,
    labelPl: 'Tryb prezentacji',
    labelEn: 'Presentation mode',
    category: 'visual',
  },
  {
    action: 'mm_fold_0',
    iconEl: ChevronsDownUp,
    labelPl: 'Zwiń do korzenia (Alt+0)',
    labelEn: 'Collapse to root (Alt+0)',
    category: 'visual',
  },
  {
    action: 'mm_fold_1',
    iconEl: ChevronsDownUp,
    labelPl: 'Pokaż poziom 1 (Alt+1)',
    labelEn: 'Show level 1 (Alt+1)',
    category: 'visual',
  },
  {
    action: 'mm_fold_2',
    iconEl: ChevronsDownUp,
    labelPl: 'Pokaż poziom 2 (Alt+2)',
    labelEn: 'Show level 2 (Alt+2)',
    category: 'visual',
  },
  {
    action: 'mm_fold_3',
    iconEl: ChevronsDownUp,
    labelPl: 'Pokaż poziom 3 (Alt+3)',
    labelEn: 'Show level 3 (Alt+3)',
    category: 'visual',
  },
  {
    action: 'mm_expand_all',
    iconEl: ChevronsUpDown,
    labelPl: 'Rozwiń wszystko (Alt+9)',
    labelEn: 'Expand all (Alt+9)',
    category: 'visual',
  },

  // Workflow
  {
    action: 'mm_snapshots',
    iconEl: Camera,
    labelPl: 'Wersje / Snapshoty',
    labelEn: 'Snapshots / Versions',
    category: 'workflow',
  },
  {
    action: 'mm_activity',
    iconEl: History,
    labelPl: 'Historia aktywności',
    labelEn: 'Activity history',
    category: 'workflow',
  },

  // Collaboration
  {
    action: 'mm_share',
    iconEl: Share2,
    labelPl: 'Udostępnij',
    labelEn: 'Share',
    category: 'collab',
  },
  {
    action: 'mm_embed',
    iconEl: Globe,
    labelPl: 'Osadź zewnętrznie',
    labelEn: 'Embed externally',
    category: 'collab',
  },

  // Analytics
  {
    action: 'mm_branch_analysis',
    iconEl: BarChart3,
    labelPl: 'Analiza gałęzi',
    labelEn: 'Branch analysis',
    category: 'analytics',
  },
];

const CATEGORY_LABELS: Record<string, { pl: string; en: string }> = {
  visual: { pl: 'Tryby widoku', en: 'Visual Modes' },
  workflow: { pl: 'Workflow', en: 'Workflow' },
  collab: { pl: 'Współpraca', en: 'Collaboration' },
  analytics: { pl: 'Analityka', en: 'Analytics' },
  formatting: { pl: 'Formatowanie', en: 'Formatting' },
};

export const MoreToolsPanel: React.FC<MoreToolsPanelProps> = ({ isPl, onAction, onClose }) => {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return ALL_TOOLS;
    const q = search.toLowerCase();
    return ALL_TOOLS.filter(
      (t) => t.labelPl.toLowerCase().includes(q) || t.labelEn.toLowerCase().includes(q)
    );
  }, [search]);

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
            placeholder={isPl ? 'Szukaj narzędzi…' : 'Search tools…'}
            className="w-full pl-7 pr-2 py-1.5 text-[11px] rounded-lg bg-c-surface-raised dark:bg-c-surface border border-c-border-subtle dark:border-c-border-subtle text-c-text-secondary dark:text-c-text placeholder:text-c-text-muted outline-none focus:ring-1 focus:ring-c-border"
            autoFocus
          />
        </div>
      </div>
      <div className="px-1 pb-1.5">
        {Object.entries(grouped).map(([cat, items]) => (
          <div key={cat}>
            <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-[0.15em] text-c-text-secondary">
              {isPl ? CATEGORY_LABELS[cat]?.pl : CATEGORY_LABELS[cat]?.en}
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
                  {isPl ? tool.labelPl : tool.labelEn}
                </button>
              );
            })}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="px-2 py-4 text-[10px] text-c-text-secondary text-center">
            {isPl ? 'Brak wyników' : 'No results'}
          </div>
        )}
      </div>
    </div>
  );
};
