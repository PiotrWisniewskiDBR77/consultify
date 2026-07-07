/**
 * InitiativeScrollView - Scroll Document Layout
 *
 * Alternative view mode for initiatives that shows all sections expanded
 * in a single scrollable column with a sticky Table of Contents sidebar.
 *
 * Uses the same section components from SECTION_REGISTRY via InitiativeContext.
 * No data fetching — consumes the context already provided by InitiativeDocumentView.
 */

import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Calendar,
  CheckSquare,
  ChevronRight,
  DollarSign,
  List,
  Target,
  Users,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { SECTION_REGISTRY } from './sections';
import { useInitiativeContext } from './sections/InitiativeContext';
import type { SectionTypeInfo } from './sections/types';

/* ─────────────── Section icon / label helpers ─────────────── */

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

const getSectionLabel = (section: SectionTypeInfo, isPolish: boolean): string => {
  if (isPolish && section.namePl) return section.namePl;
  if (section.name && section.name !== section.key) return section.name;
  // Fallback: humanize key
  return section.key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
};

/* ─────────────── Table of Contents ─────────────── */

interface TOCProps {
  sections: SectionTypeInfo[];
  activeSectionKey: string | null;
  isPolish: boolean;
  onNavigate: (key: string) => void;
  isCompact: boolean;
  onToggleCompact: () => void;
}

const TableOfContents: React.FC<TOCProps> = ({
  sections,
  activeSectionKey,
  isPolish,
  onNavigate,
  isCompact,
  onToggleCompact,
}) => {
  const { t } = useTranslation();
  return (
    <nav className={`sticky top-6 transition-all duration-300 ${isCompact ? 'w-10' : 'w-56'}`}>
      <div className="bg-white/70 dark:bg-navy-900/70 backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-navy-700/60 shadow-lg shadow-slate-200/50 dark:shadow-navy-900/50 overflow-hidden">
        {/* TOC Header */}
        <div className="flex items-center justify-between px-3 py-3 border-b border-slate-200 dark:border-navy-700/60">
          {!isCompact && (
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {t('initiatives.initiativeScrollView.contents')}
            </span>
          )}
          <button
            onClick={onToggleCompact}
            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-500 dark:text-slate-400 transition-colors"
            title={isCompact ? 'Expand TOC' : 'Collapse TOC'}
          >
            {isCompact ? <List size={16} /> : <X size={14} />}
          </button>
        </div>

        {/* TOC Items */}
        <div className="py-1.5 max-h-[70vh] overflow-y-auto scrollbar-thin">
          {sections.map((section) => {
            const isActive = activeSectionKey === section.key;
            const emoji = SECTION_ICON_MAP[section.key] || '📋';

            return (
              <button
                key={section.key}
                onClick={() => onNavigate(section.key)}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition-all duration-150 ${
                  isActive
                    ? 'bg-slate-100 dark:bg-white/[0.08] text-slate-900 dark:text-white font-medium border-l-2 border-[var(--c-info)]'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800/50 hover:text-slate-700 dark:hover:text-slate-300 border-l-2 border-transparent'
                }`}
                title={getSectionLabel(section, isPolish)}
              >
                <span className="text-sm flex-shrink-0">{emoji}</span>
                {!isCompact && (
                  <span className="text-xs truncate">{getSectionLabel(section, isPolish)}</span>
                )}
                {!isCompact && isActive && (
                  <ChevronRight size={12} className="ml-auto flex-shrink-0 text-[var(--c-info)]" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

/* ─────────────── Main Scroll View ─────────────── */

interface InitiativeScrollViewProps {
  leftSections: SectionTypeInfo[];
  rightSections: SectionTypeInfo[];
  readonly?: boolean;
}

export const InitiativeScrollView: React.FC<InitiativeScrollViewProps> = ({
  leftSections,
  rightSections,
  readonly = false,
}) => {
  const { t } = useTranslation();
  const ctx = useInitiativeContext();
  const { isPolish, pendingGates } = ctx;

  const [activeSectionKey, setActiveSectionKey] = useState<string | null>(null);
  const [isTocCompact, setIsTocCompact] = useState(false);
  const sectionRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Interleave left & right sections in a logical order:
  // Control meta sections first (summary info), then content sections
  const allSections = useMemo(() => {
    // Group: control/meta sections from right column come after each related left section
    // Simple approach: left sections first, then right sections
    // But a better UX: interleave them logically
    const ordered: SectionTypeInfo[] = [];

    // Start with control (status, priority) at the top
    const controlSection = rightSections.find((s) => s.key === 'control');
    if (controlSection) ordered.push(controlSection);

    // Then team
    const teamSection = rightSections.find((s) => s.key === 'team');
    if (teamSection) ordered.push(teamSection);

    // Then all left (content) sections
    for (const section of leftSections) {
      ordered.push(section);
    }

    // Then remaining right sections (timeline, resources, etc.)
    for (const section of rightSections) {
      if (section.key !== 'control' && section.key !== 'team') {
        ordered.push(section);
      }
    }

    return ordered;
  }, [leftSections, rightSections]);

  // Scroll-spy using IntersectionObserver
  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    const observerCallback: IntersectionObserverCallback = (entries) => {
      // Find the topmost visible section
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

      if (visible.length > 0) {
        const key = visible[0].target.getAttribute('data-section-key');
        if (key) setActiveSectionKey(key);
      }
    };

    const observer = new IntersectionObserver(observerCallback, {
      rootMargin: '-80px 0px -60% 0px',
      threshold: 0.1,
    });

    sectionRefs.current.forEach((el) => {
      observer.observe(el);
    });
    observers.push(observer);

    return () => {
      observers.forEach((obs) => obs.disconnect());
    };
  }, [allSections]);

  const handleNavigate = useCallback((key: string) => {
    const el = sectionRefs.current.get(key);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const registerRef = useCallback((key: string, el: HTMLDivElement | null) => {
    if (el) {
      sectionRefs.current.set(key, el);
    } else {
      sectionRefs.current.delete(key);
    }
  }, []);

  return (
    <div className="flex gap-6" ref={scrollContainerRef}>
      {/* Sticky Table of Contents */}
      <div className="hidden lg:block flex-shrink-0">
        <TableOfContents
          sections={allSections}
          activeSectionKey={activeSectionKey}
          isPolish={isPolish}
          onNavigate={handleNavigate}
          isCompact={isTocCompact}
          onToggleCompact={() => setIsTocCompact((p) => !p)}
        />
      </div>

      {/* Main Content - Single Column, All Expanded */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* B7.2: Key Info Strip — 5 sections always visible */}
        <div className="grid grid-cols-5 gap-2">
          <div className="p-2.5 rounded-xl bg-white/60 dark:bg-navy-900/40 border border-slate-200 dark:border-navy-700/60">
            <div className="flex items-center gap-1.5 mb-1">
              <Target size={12} className="text-blue-500" />
              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">
                {t('initiatives.initiativeScrollView.goal')}
              </span>
            </div>
            <p className="text-xs text-slate-700 dark:text-slate-300 line-clamp-2">
              {ctx.summary || '—'}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-white/60 dark:bg-navy-900/40 border border-slate-200 dark:border-navy-700/60">
            <div className="flex items-center gap-1.5 mb-1">
              <CheckSquare size={12} className="text-emerald-500" />
              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">
                {t('initiatives.initiativeScrollView.tasks')}
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {ctx.tasksDone}/{ctx.tasks?.length || 0}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-white/60 dark:bg-navy-900/40 border border-slate-200 dark:border-navy-700/60">
            <div className="flex items-center gap-1.5 mb-1">
              <Users size={12} className="text-c-info" />
              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">
                {t('initiatives.initiativeScrollView.team')}
              </span>
            </div>
            <p className="text-xs text-slate-700 dark:text-slate-300 truncate">
              {ctx.ownerName || '—'}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-white/60 dark:bg-navy-900/40 border border-slate-200 dark:border-navy-700/60">
            <div className="flex items-center gap-1.5 mb-1">
              <Calendar size={12} className="text-blue-500" />
              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">
                {t('initiatives.initiativeScrollView.resources')}
              </span>
            </div>
            <p className="text-xs text-slate-700 dark:text-slate-300">
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
          <div className="p-2.5 rounded-xl bg-white/60 dark:bg-navy-900/40 border border-slate-200 dark:border-navy-700/60">
            <div className="flex items-center gap-1.5 mb-1">
              <DollarSign size={12} className="text-amber-500" />
              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">
                {t('initiatives.initiativeScrollView.financeRisk')}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {ctx.riskCount > 0 && (
                <span
                  className={`text-[9px] font-medium px-1 py-0.5 rounded ${ctx.criticalRaids > 0 ? 'bg-danger-500/10 text-danger-500' : 'bg-amber-500/10 text-amber-500'}`}
                >
                  {ctx.riskCount}R/{ctx.issueCount}I
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Gate Alert Banner */}
        {pendingGates.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 to-amber-500/10 dark:from-amber-500/20 dark:to-amber-500/20 border border-amber-300/50 dark:border-amber-500/30"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500/20">
                <AlertTriangle size={18} className="text-amber-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                  {t('initiatives.initiativeScrollView.gateDecisionRequired')}
                </p>
                <p className="text-xs text-amber-600/80 dark:text-amber-400/80">
                  {pendingGates.map((g) => g.label).join(', ')}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Render all sections - always expanded */}
        {allSections.map((sectionType, index) => {
          const Component = SECTION_REGISTRY[sectionType.componentKey];
          if (!Component) return null;

          return (
            <div
              key={sectionType.key}
              ref={(el) => registerRef(sectionType.key, el)}
              data-section-key={sectionType.key}
              id={`scroll-section-${sectionType.key}`}
              className="scroll-mt-24"
            >
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.03, 0.3) }}
              >
                <Component
                  sectionType={sectionType}
                  expanded={true}
                  onToggle={() => {
                    /* No-op in scroll view — sections are always expanded */
                  }}
                  readonly={readonly}
                />
              </motion.div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
