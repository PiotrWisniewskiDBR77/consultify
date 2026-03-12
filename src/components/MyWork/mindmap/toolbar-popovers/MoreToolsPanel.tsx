import {
  BarChart3,
  Camera,
  Clock,
  Eye,
  FolderKanban,
  GitCompare,
  Globe,
  History,
  Layout,
  LayoutGrid,
  Maximize,
  Palette,
  Search,
  Share2,
  Shield,
  Users,
  Webhook,
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
  { action: 'mm_change_layout', iconEl: Layout, labelPl: 'Zmień układ', labelEn: 'Change layout', category: 'visual' },
  { action: 'mm_toggle_minimap', iconEl: LayoutGrid, labelPl: 'Minimap', labelEn: 'Minimap', category: 'visual' },
  { action: 'mm_fit_view', iconEl: Maximize, labelPl: 'Dopasuj widok', labelEn: 'Fit view', category: 'visual' },
  { action: 'mm_presentation', iconEl: Eye, labelPl: 'Tryb prezentacji', labelEn: 'Presentation mode', category: 'visual' },
  { action: 'mm_background', iconEl: Palette, labelPl: 'Tło kanwy', labelEn: 'Canvas background', category: 'visual' },

  // Workflow
  { action: 'mm_snapshots', iconEl: Camera, labelPl: 'Wersje / Snapshoty', labelEn: 'Snapshots / Versions', category: 'workflow' },
  { action: 'mm_activity', iconEl: History, labelPl: 'Historia aktywności', labelEn: 'Activity history', category: 'workflow' },
  { action: 'mm_governance', iconEl: Shield, labelPl: 'Governance status', labelEn: 'Governance status', category: 'workflow' },
  { action: 'mm_timers', iconEl: Clock, labelPl: 'Timer / Timeboxing', labelEn: 'Timer / Timeboxing', category: 'workflow' },
  { action: 'mm_cross_tool', iconEl: GitCompare, labelPl: 'Konwersja narzędzi', labelEn: 'Cross-tool convert', category: 'workflow' },

  // Collaboration
  { action: 'mm_share', iconEl: Share2, labelPl: 'Udostępnij', labelEn: 'Share', category: 'collab' },
  { action: 'mm_collaboration', iconEl: Users, labelPl: 'Nakładka współpracy', labelEn: 'Collaboration overlay', category: 'collab' },
  { action: 'mm_webhooks', iconEl: Webhook, labelPl: 'Webhook/integracje', labelEn: 'Webhooks/Integrations', category: 'collab' },
  { action: 'mm_embed', iconEl: Globe, labelPl: 'Osadź zewnętrznie', labelEn: 'Embed externally', category: 'collab' },

  // Analytics
  { action: 'mm_branch_analysis', iconEl: BarChart3, labelPl: 'Analiza gałęzi', labelEn: 'Branch analysis', category: 'analytics' },
  { action: 'mm_kanban_view', iconEl: FolderKanban, labelPl: 'Kanban z węzłów', labelEn: 'Node Kanban view', category: 'analytics' },
];

const CATEGORY_LABELS: Record<string, { pl: string; en: string }> = {
  visual: { pl: 'Tryby widoku', en: 'Visual Modes' },
  workflow: { pl: 'Workflow', en: 'Workflow' },
  collab: { pl: 'Współpraca', en: 'Collaboration' },
  analytics: { pl: 'Analityka', en: 'Analytics' },
  formatting: { pl: 'Formatowanie', en: 'Formatting' },
};

export const MoreToolsPanel: React.FC<MoreToolsPanelProps> = ({
  isPl,
  onAction,
  onClose,
}) => {
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
    <div className="w-[280px] max-h-[440px] overflow-y-auto rounded-xl bg-white dark:bg-navy-900 border border-slate-200/60 dark:border-white/[0.06] shadow-xl">
      <div className="p-2 sticky top-0 bg-white dark:bg-navy-900 z-10">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isPl ? 'Szukaj narzędzi…' : 'Search tools…'}
            className="w-full pl-7 pr-2 py-1.5 text-[11px] rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200/40 dark:border-white/[0.04] text-slate-700 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:ring-1 focus:ring-primary-500/30"
            autoFocus
          />
        </div>
      </div>
      <div className="px-1 pb-1.5">
        {Object.entries(grouped).map(([cat, items]) => (
          <div key={cat}>
            <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400">
              {isPl ? CATEGORY_LABELS[cat]?.pl : CATEGORY_LABELS[cat]?.en}
            </div>
            {items.map((tool) => {
              const Icon = tool.iconEl;
              return (
                <button
                  key={tool.action}
                  onClick={() => dispatch(tool.action)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors"
                >
                  <Icon size={12} className="text-slate-400 shrink-0" />
                  {isPl ? tool.labelPl : tool.labelEn}
                </button>
              );
            })}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="px-2 py-4 text-[10px] text-slate-400 text-center">
            {isPl ? 'Brak wyników' : 'No results'}
          </div>
        )}
      </div>
    </div>
  );
};
