/**
 * InitiativeNotionView
 *
 * Notion-style initiative layout:
 * - Left sidebar with section navigation
 * - Main panel renders only the selected section
 *
 * Uses existing section components from SECTION_REGISTRY and InitiativeContext.
 */

import { Search } from 'lucide-react';
import React, { useMemo, useState } from 'react';

import { SECTION_REGISTRY } from './sections';
import type { SectionTypeInfo } from './sections/types';

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
  const [query, setQuery] = useState('');

  const sectionsForNav = useMemo(() => {
    const all = [...rightSections, ...leftSections];
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((s) => getSectionLabel(s, isPolish).toLowerCase().includes(q));
  }, [leftSections, rightSections, query, isPolish]);

  const selectedSection = useMemo(() => {
    const all = [...rightSections, ...leftSections];
    return all.find((s) => s.key === selectedSectionKey) || all[0] || null;
  }, [leftSections, rightSections, selectedSectionKey]);

  const SelectedComponent = selectedSection ? SECTION_REGISTRY[selectedSection.componentKey] : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
      {/* Sidebar */}
      <aside className="lg:sticky lg:top-6 h-fit">
        <div className="bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl border border-slate-200/60 dark:border-navy-700/60 shadow-lg shadow-slate-200/50 dark:shadow-navy-900/50 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200/60 dark:border-navy-700/60">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {isPolish ? 'Spis treści' : 'Contents'}
            </div>
            <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50/80 dark:bg-navy-800/70 border border-slate-200/70 dark:border-navy-700/60">
              <Search size={14} className="text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={isPolish ? 'Szukaj sekcji…' : 'Search sections…'}
                className="w-full bg-transparent outline-none text-sm text-slate-700 dark:text-slate-300 placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="py-2 max-h-[70vh] overflow-y-auto">
            {sectionsForNav.map((section) => {
              const isActive = section.key === selectedSectionKey;
              const emoji = SECTION_ICON_MAP[section.key] || '📋';
              return (
                <button
                  key={section.key}
                  onClick={() => onSelectSection(section.key)}
                  className={`w-full flex items-center gap-2 px-4 py-2 text-left text-sm transition-colors ${
                    isActive
                      ? 'bg-purple-500/10 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300 border-l-2 border-purple-500'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800/60 border-l-2 border-transparent'
                  }`}
                  title={getSectionLabel(section, isPolish)}
                >
                  <span className="w-5 text-base leading-none">{emoji}</span>
                  <span className="truncate">{getSectionLabel(section, isPolish)}</span>
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      {/* Main Panel */}
      <main className="min-w-0">
        {selectedSection && SelectedComponent ? (
          <SelectedComponent
            sectionType={selectedSection}
            expanded={true}
            onToggle={() => {
              // In Notion view we keep the content always visible.
              // (Section components still render inside CollapsibleSection for now.)
            }}
          />
        ) : (
          <div className="p-6 rounded-2xl bg-white/70 dark:bg-navy-900/70 border border-slate-200/60 dark:border-navy-700/60 text-slate-500 dark:text-slate-400">
            {isPolish ? 'Brak sekcji do wyświetlenia.' : 'No sections to display.'}
          </div>
        )}
      </main>
    </div>
  );
};
