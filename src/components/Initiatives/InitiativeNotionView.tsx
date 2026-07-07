/**
 * InitiativeNotionView
 *
 * Notion-style initiative layout:
 * - Left sidebar with section navigation
 * - Main panel renders only the selected section
 *
 * Uses existing section components from SECTION_REGISTRY and InitiativeContext.
 */

import {
  AlertTriangle,
  Calendar,
  CheckSquare,
  DollarSign,
  Search,
  Target,
  Users,
} from 'lucide-react';
import React, { useContext, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { SECTION_REGISTRY } from './sections';
import { InitiativeContext } from './sections/InitiativeContext';
import type { SectionTypeInfo } from './sections/types';

type NavGroup = {
  id: string;
  label: { en: string; pl: string };
  keys: string[];
};

// Notion navigation: grouped + ordered (most important at top)
const NAV_GROUPS: NavGroup[] = [
  {
    id: 'core',
    label: { en: 'Core', pl: 'Podstawy' },
    keys: ['overview', 'control', 'team'],
  },
  {
    id: 'definition',
    label: { en: 'Definition', pl: 'Definicja' },
    keys: ['problemDefinition', 'targetState', 'scope'],
  },
  {
    id: 'execution',
    label: { en: 'Execution', pl: 'Realizacja' },
    keys: ['tasks', 'timeline', 'resources', 'dependencies', 'stakeholders'],
  },
  {
    id: 'governance',
    label: { en: 'Governance', pl: 'Nadzór' },
    keys: ['decisions', 'gates'],
  },
  {
    id: 'risks',
    label: { en: 'Risks', pl: 'Ryzyka' },
    keys: ['raid'],
  },
  {
    id: 'value',
    label: { en: 'Value', pl: 'Wartość' },
    keys: ['financialAnalysis', 'financialImpact', 'kpis'],
  },
  {
    id: 'pilot',
    label: { en: 'Pilot', pl: 'Pilotaż' },
    keys: ['pilot'],
  },
  {
    id: 'collaboration',
    label: { en: 'Collaboration', pl: 'Współpraca' },
    keys: ['comments'],
  },
  {
    id: 'meta',
    label: { en: 'Meta', pl: 'Meta' },
    keys: ['attachments', 'linkedItems', 'tags', 'reminders', 'watchers', 'history'],
  },
];

export const NOTION_NAV_GROUP_IDS = NAV_GROUPS.map((g) => g.id);

export const NOTION_GROUP_BY_SECTION_KEY: Record<string, string> = NAV_GROUPS.reduce(
  (acc, g) => {
    g.keys.forEach((k) => {
      acc[k] = g.id;
    });
    return acc;
  },
  {} as Record<string, string>
);

const SECTION_ICON_MAP: Record<string, string> = {
  overview: '📄',
  problemDefinition: '🔍',
  targetState: '🎯',
  scope: '📐',
  tasks: '✅',
  decisions: '⚖️',
  raid: '🚨',
  gates: '🚧',
  financialAnalysis: '📊',
  financialImpact: '💰',
  kpis: '📈',
  pilot: '🧪',
  comments: '💬',
  history: '📜',
  control: '🎛️',
  team: '👥',
  timeline: '📅',
  resources: '🏗️',
  stakeholders: '👤',
  dependencies: '🔗',
  attachments: '📎',
  linkedItems: '🔗',
  tags: '🏷️',
  reminders: '🔔',
  watchers: '👁️',
};

function humanizeKey(key: string) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

function getSectionLabel(section: SectionTypeInfo, isPolish: boolean): string {
  if (isPolish && section.namePl) return section.namePl;
  if (section.name && section.name !== section.key) return section.name;
  return humanizeKey(section.key);
}

function getNavLabel(group: NavGroup, isPolish: boolean) {
  return isPolish ? group.label.pl : group.label.en;
}

function getGroupIcon(id: string) {
  // Keep it simple and recognizable
  const map: Record<string, string> = {
    core: '⭐',
    definition: '🧩',
    execution: '🚀',
    governance: '🏛️',
    risks: '⚠️',
    value: '💎',
    pilot: '🧪',
    collaboration: '💬',
    meta: '🧰',
    other: '📚',
  };
  return map[id] || '📁';
}

export interface InitiativeNotionViewProps {
  leftSections: SectionTypeInfo[];
  rightSections: SectionTypeInfo[];
  selectedSectionKey: string;
  onSelectSection: (key: string) => void;
  isPolish: boolean;
}

export const InitiativeNotionView: React.FC<InitiativeNotionViewProps> = ({
  leftSections,
  rightSections,
  selectedSectionKey,
  onSelectSection,
  isPolish,
}) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');

  // B7.2: Access initiative context for key info bar (null when outside provider)
  const ctx = useContext(InitiativeContext);

  const allSorted = useMemo(() => {
    const all = [...rightSections, ...leftSections];

    // Create rank map: key -> numeric rank (group order + within-group order)
    const rank = new Map<string, number>();
    NAV_GROUPS.forEach((g, gi) => {
      g.keys.forEach((key, ki) => {
        rank.set(key, gi * 100 + ki);
      });
    });

    return [...all].sort((a, b) => {
      const ra = rank.get(a.key);
      const rb = rank.get(b.key);
      if (ra != null && rb != null) return ra - rb;
      if (ra != null) return -1;
      if (rb != null) return 1;
      // Unknown sections: keep them after groups, but stable by defaultOrder then name
      const da = (a.defaultOrder ?? 9999) as number;
      const db = (b.defaultOrder ?? 9999) as number;
      if (da !== db) return da - db;
      return (a.name || a.key).localeCompare(b.name || b.key);
    });
  }, [leftSections, rightSections]);

  const queryFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allSorted;
    return allSorted.filter((s) => getSectionLabel(s, isPolish).toLowerCase().includes(q));
  }, [allSorted, query, isPolish]);

  const navGroups = useMemo(() => {
    const byKey = new Map(queryFiltered.map((s) => [s.key, s] as const));
    const used = new Set<string>();

    const groups: Array<{ id: string; label: string; sections: SectionTypeInfo[] }> = [];

    for (const g of NAV_GROUPS) {
      const list: SectionTypeInfo[] = [];
      for (const key of g.keys) {
        const s = byKey.get(key);
        if (!s) continue;
        list.push(s);
        used.add(key);
      }
      if (list.length) {
        groups.push({ id: g.id, label: getNavLabel(g, isPolish), sections: list });
      }
    }

    // Any remaining sections not covered by NAV_GROUPS
    const rest = queryFiltered.filter((s) => !used.has(s.key));
    if (rest.length) {
      groups.push({
        id: 'other',
        label: t('initiatives.initiativeNotionView.other'),
        sections: rest,
      });
    }
    return groups;
  }, [queryFiltered, isPolish, t]);

  const selectedSection = useMemo(() => {
    return allSorted.find((s) => s.key === selectedSectionKey) || allSorted[0] || null;
  }, [allSorted, selectedSectionKey]);

  const SelectedComponent = selectedSection ? SECTION_REGISTRY[selectedSection.componentKey] : null;
  const selectedGroup = useMemo(() => {
    // Prefer explicit group selection
    const direct = navGroups.find((g) => g.id === selectedSectionKey);
    if (direct) return direct;
    // If a single section key is selected (legacy), map it to its group for consistent UX
    const groupId = NOTION_GROUP_BY_SECTION_KEY[selectedSectionKey];
    if (!groupId) return null;
    return navGroups.find((g) => g.id === groupId) || null;
  }, [navGroups, selectedSectionKey]);

  const isGroupSelected = !!selectedGroup;
  const activeGroupId = useMemo(() => {
    if (navGroups.some((g) => g.id === selectedSectionKey)) return selectedSectionKey;
    return NOTION_GROUP_BY_SECTION_KEY[selectedSectionKey] || selectedSectionKey;
  }, [navGroups, selectedSectionKey]);

  const renderSection = (section: SectionTypeInfo) => {
    const Component = SECTION_REGISTRY[section.componentKey];
    if (!Component) return null;
    return (
      <Component
        key={section.key}
        sectionType={section}
        expanded={true}
        onToggle={() => {
          // In Notion view we keep the content always visible.
        }}
      />
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
      {/* Sidebar */}
      <aside className="lg:sticky lg:top-6 h-fit">
        <div className="bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl border border-slate-200/60 dark:border-navy-700/60 shadow-lg shadow-slate-200/50 dark:shadow-navy-900/50 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200/60 dark:border-navy-700/60">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t('initiatives.initiativeNotionView.contents')}
            </div>
            <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50/80 dark:bg-navy-800/70 border border-slate-200/70 dark:border-navy-700/60">
              <Search size={14} className="text-slate-600" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('initiatives.initiativeNotionView.searchSections')}
                className="w-full bg-transparent outline-none text-sm text-slate-700 dark:text-slate-300 placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="py-2 max-h-[70vh] overflow-y-auto">
            {/* Top-level, compressed nav (10–12 items max): show groups only */}
            {navGroups.map((group) => {
              const isActive = group.id === activeGroupId;
              return (
                <button
                  key={group.id}
                  onClick={() => onSelectSection(group.id)}
                  className={`w-full flex items-center gap-2 px-4 py-2 text-left text-sm transition-colors ${
                    isActive
                      ? 'bg-slate-100 dark:bg-white/[0.08] text-slate-900 dark:text-white border-l-2 border-[var(--c-info)]'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800/60 border-l-2 border-transparent'
                  }`}
                  title={group.label}
                >
                  <span className="w-5 text-base leading-none">{getGroupIcon(group.id)}</span>
                  <span className="truncate">{group.label}</span>
                  <span className="ml-auto text-xs text-slate-600 dark:text-slate-500">
                    {group.sections.length}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      {/* Main Panel */}
      <main className="min-w-0">
        {/* B7.2: Key Info Strip — 5 sections always visible */}
        {ctx && (
          <div className="grid grid-cols-5 gap-2 mb-4">
            <div className="p-2 rounded-lg bg-white/60 dark:bg-navy-900/40 border border-slate-200/60 dark:border-navy-700/60">
              <div className="flex items-center gap-1.5 mb-1">
                <Target size={11} className="text-blue-500" />
                <span className="text-[9px] font-semibold text-slate-600 uppercase">
                  {t('initiatives.initiativeNotionView.goal')}
                </span>
              </div>
              <p className="text-[11px] text-slate-700 dark:text-slate-300 line-clamp-1">
                {ctx.summary || '—'}
              </p>
            </div>
            <div className="p-2 rounded-lg bg-white/60 dark:bg-navy-900/40 border border-slate-200/60 dark:border-navy-700/60">
              <div className="flex items-center gap-1.5 mb-1">
                <CheckSquare size={11} className="text-emerald-500" />
                <span className="text-[9px] font-semibold text-slate-600 uppercase">
                  {t('initiatives.initiativeNotionView.tasks')}
                </span>
              </div>
              <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                {ctx.tasksDone}/{ctx.tasks?.length || 0}
              </p>
            </div>
            <div className="p-2 rounded-lg bg-white/60 dark:bg-navy-900/40 border border-slate-200/60 dark:border-navy-700/60">
              <div className="flex items-center gap-1.5 mb-1">
                <Users size={11} className="text-c-info" />
                <span className="text-[9px] font-semibold text-slate-600 uppercase">
                  {t('initiatives.initiativeNotionView.team')}
                </span>
              </div>
              <p className="text-[11px] text-slate-700 dark:text-slate-300 truncate">
                {ctx.ownerName || '—'}
              </p>
            </div>
            <div className="p-2 rounded-lg bg-white/60 dark:bg-navy-900/40 border border-slate-200/60 dark:border-navy-700/60">
              <div className="flex items-center gap-1.5 mb-1">
                <Calendar size={11} className="text-blue-500" />
                <span className="text-[9px] font-semibold text-slate-600 uppercase">
                  {t('initiatives.initiativeNotionView.resources')}
                </span>
              </div>
              <p className="text-[11px] text-slate-700 dark:text-slate-300">
                {ctx.startDate
                  ? new Date(ctx.startDate).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                    })
                  : '?'}
                {' → '}
                {ctx.endDate
                  ? new Date(ctx.endDate).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                    })
                  : '?'}
              </p>
            </div>
            <div className="p-2 rounded-lg bg-white/60 dark:bg-navy-900/40 border border-slate-200/60 dark:border-navy-700/60">
              <div className="flex items-center gap-1.5 mb-1">
                <DollarSign size={11} className="text-amber-500" />
                <span className="text-[9px] font-semibold text-slate-600 uppercase">
                  {t('initiatives.initiativeNotionView.finance')}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {ctx.riskCount > 0 && (
                  <span
                    className={`text-[9px] font-medium px-1 py-0.5 rounded ${ctx.criticalRaids > 0 ? 'bg-danger-500/10 text-danger-500' : 'bg-amber-500/10 text-amber-500'}`}
                  >
                    {ctx.riskCount}R
                  </span>
                )}
                {ctx.initiative?.costCapex ? (
                  <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    {ctx.initiative.costCapex >= 1_000_000
                      ? `$${(ctx.initiative.costCapex / 1_000_000).toFixed(1)}M`
                      : ctx.initiative.costCapex >= 1_000
                        ? `$${(ctx.initiative.costCapex / 1_000).toFixed(0)}K`
                        : `$${ctx.initiative.costCapex}`}
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-600">—</span>
                )}
              </div>
            </div>
          </div>
        )}

        {isGroupSelected && selectedGroup ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {selectedGroup.label}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-500">
                {selectedGroup.sections.length} {t('initiatives.initiativeNotionView.sections')}
              </div>
              {/* Quick chips to jump to a single section */}
              <div className="flex flex-wrap gap-1.5 ml-auto">
                {selectedGroup.sections.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => {
                      const el = document.getElementById(`notion-section-${s.key}`);
                      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    className="px-2 py-1 rounded-lg text-xs bg-white/60 dark:bg-navy-900/40 border border-slate-200/60 dark:border-navy-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800/60 transition-colors"
                    title={getSectionLabel(s, isPolish)}
                  >
                    <span className="mr-1">{SECTION_ICON_MAP[s.key] || '📋'}</span>
                    {getSectionLabel(s, isPolish)}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {selectedGroup.sections.map((s) => (
                <div key={s.key} id={`notion-section-${s.key}`} className="scroll-mt-24">
                  {renderSection(s)}
                </div>
              ))}
            </div>
          </div>
        ) : selectedSection && SelectedComponent ? (
          renderSection(selectedSection)
        ) : (
          <div className="p-6 rounded-2xl bg-white/70 dark:bg-navy-900/70 border border-slate-200/60 dark:border-navy-700/60 text-slate-500 dark:text-slate-400">
            {t('initiatives.initiativeNotionView.noSectionsToDisplay')}
          </div>
        )}
      </main>
    </div>
  );
};
