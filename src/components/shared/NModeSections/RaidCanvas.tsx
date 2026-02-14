/**
 * RaidCanvas
 *
 * Full RAID (Risk, Assumption, Issue, Dependency) management canvas.
 * Based on the proven RiskCanvas pattern from Decision/Task, extended with:
 * - 4 RAID types with conditional rendering per type
 * - RAID counter cards + filter tabs
 * - Status, owner, due date per item
 * - "Proposed Action" textarea for all types
 * - Risk-specific: full P×I scoring + contingency + mitigation
 * - A/I/D: impact-only + type-specific action textarea
 * - AI field enhancement per field
 *
 * Reusable across Initiative and potentially other artifact types.
 *
 * @see docs/ui-standards/02-components/shared-sections.md
 * @see docs/ui-standards/02-components/initiative-sections.md §7
 */

import {
  AlertTriangle,
  Calendar,
  GitBranch,
  HelpCircle,
  Loader2,
  Plus,
  Shield,
  Sparkles,
  User,
  X,
  XCircle,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AIFieldEnhancer } from '@/components/shared/AIFieldEnhancer';

// ── Types ────────────────────────────────────────────────────────────────────

export type RaidType = 'risk' | 'assumption' | 'issue' | 'dependency';
export type RaidLevel = 'low' | 'medium' | 'high' | 'critical';
export type RaidStatus = 'open' | 'mitigated' | 'accepted' | 'closed' | 'resolved' | 'transferred';
export type RaidTypeFilter = 'all' | RaidType;

export interface RaidItem {
  id: string;
  type: RaidType;
  title: string;
  /** Risk-specific: probability level */
  probability?: RaidLevel;
  /** Impact level — used by all types */
  impact: RaidLevel;
  /** Category (technical, business, financial, operational, security) */
  category?: string;
  /** Risk-specific: mitigation plan */
  mitigation?: string;
  /** Risk-specific: contingency plan */
  contingency?: string;
  /** Proposed action — universal for all RAID types */
  proposedAction?: string;
  /** Current status */
  status: RaidStatus;
  /** Owner name or ID */
  owner?: string;
  /** Due date (ISO string) */
  dueDate?: string;
  /** Source of this item (e.g. meeting, audit, AI) */
  source?: string;
}

export interface RaidCanvasProps {
  /** RAID items (unsorted — component sorts internally) */
  items: RaidItem[];
  /** Add new item with given type */
  onAddItem: (type: RaidType) => void;
  /** Update fields on an item */
  onUpdateItem: (id: string, updates: Partial<RaidItem>) => void;
  /** Remove an item by id */
  onRemoveItem: (id: string) => void;
  /** AI generate items handler (omit to hide AI button) */
  onAIGenerate?: () => void;
  /** Whether AI generation is in progress */
  isGeneratingAI?: boolean;
  /** Whether inputs are locked/read-only */
  locked?: boolean;
  /** Artifact context for AIFieldEnhancer */
  artifactContext: { title: string; status: string; priority: string; type: string };
  /** Unique prefix for AI field keys */
  fieldKeyPrefix: string;
  /** Available users for owner dropdown */
  users?: Array<{ id: string; name: string }>;
}

// ── Constants ────────────────────────────────────────────────────────────────

const RAID_LEVEL_OPTIONS: readonly RaidLevel[] = ['low', 'medium', 'high', 'critical'];

const RAID_STATUS_OPTIONS: readonly RaidStatus[] = [
  'open',
  'mitigated',
  'accepted',
  'closed',
  'resolved',
  'transferred',
];

const RAID_TYPE_META: Record<
  RaidType,
  {
    icon: React.FC<{ size?: number; className?: string }>;
    color: string;
    bgLight: string;
    borderActive: string;
  }
> = {
  risk: {
    icon: AlertTriangle,
    color: 'text-rose-500',
    bgLight: 'bg-rose-500/10',
    borderActive: 'border-rose-400/60 ring-rose-400/30',
  },
  assumption: {
    icon: HelpCircle,
    color: 'text-blue-500',
    bgLight: 'bg-blue-500/10',
    borderActive: 'border-blue-400/60 ring-blue-400/30',
  },
  issue: {
    icon: XCircle,
    color: 'text-red-500',
    bgLight: 'bg-red-500/10',
    borderActive: 'border-red-400/60 ring-red-400/30',
  },
  dependency: {
    icon: GitBranch,
    color: 'text-purple-500',
    bgLight: 'bg-purple-500/10',
    borderActive: 'border-purple-400/60 ring-purple-400/30',
  },
};

// ── Utility functions ────────────────────────────────────────────────────────

const raidLevelToScore = (level?: string): number => {
  const n = String(level || '').toLowerCase();
  if (n === 'critical') return 4;
  if (n === 'high') return 3;
  if (n === 'medium') return 2;
  return 1;
};

export const getRaidScore = (item: RaidItem): number =>
  item.type === 'risk' && item.probability
    ? raidLevelToScore(item.probability) * raidLevelToScore(item.impact)
    : raidLevelToScore(item.impact);

const getScoreClass = (score: number, isRisk: boolean): string => {
  if (isRisk) {
    if (score >= 12) return 'text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/30';
    if (score >= 8) return 'text-amber-700 dark:text-amber-300 bg-amber-500/10 border-amber-500/30';
    if (score >= 4)
      return 'text-yellow-700 dark:text-yellow-300 bg-yellow-500/10 border-yellow-500/30';
    return 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/30';
  }
  // For non-risk: just use impact level coloring
  return getLevelClass(
    String(score <= 1 ? 'low' : score === 2 ? 'medium' : score === 3 ? 'high' : 'critical')
  );
};

const getLevelClass = (level?: string): string => {
  const n = String(level || '').toLowerCase();
  if (n === 'critical') return 'border-red-500/60 bg-red-500/10 text-red-700 dark:text-red-300';
  if (n === 'high')
    return 'border-orange-500/55 bg-orange-500/10 text-orange-700 dark:text-orange-300';
  if (n === 'medium')
    return 'border-amber-500/55 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  return 'border-emerald-500/45 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
};

const getStatusClass = (status: string): string => {
  const s = status.toLowerCase();
  if (s === 'closed' || s === 'resolved')
    return 'bg-slate-500/15 text-slate-400 border-slate-400/30';
  if (s === 'mitigated') return 'bg-emerald-500/15 text-emerald-500 border-emerald-400/30';
  if (s === 'accepted') return 'bg-amber-500/15 text-amber-500 border-amber-400/30';
  if (s === 'transferred') return 'bg-purple-500/15 text-purple-500 border-purple-400/30';
  return 'bg-blue-500/15 text-blue-500 border-blue-400/30'; // open
};

// ── Component ────────────────────────────────────────────────────────────────

export const RaidCanvas: React.FC<RaidCanvasProps> = ({
  items,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  onAIGenerate,
  isGeneratingAI = false,
  locked = false,
  artifactContext,
  fieldKeyPrefix,
  users,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  const [typeFilter, setTypeFilter] = useState<RaidTypeFilter>('all');

  // ── i18n helpers ─────────────────────────────────────────────────────────

  const getLevelLabel = (level: string): string => {
    if (isPolish) {
      if (level === 'critical') return 'Krytyczny';
      if (level === 'high') return 'Wysoki';
      if (level === 'medium') return 'Średni';
      return 'Niski';
    }
    if (level === 'critical') return 'Critical';
    if (level === 'high') return 'High';
    if (level === 'medium') return 'Medium';
    return 'Low';
  };

  const getTypeLabel = (type: RaidType): string => {
    const map: Record<RaidType, { en: string; pl: string }> = {
      risk: { en: 'Risk', pl: 'Ryzyko' },
      assumption: { en: 'Assumption', pl: 'Założenie' },
      issue: { en: 'Issue', pl: 'Problem' },
      dependency: { en: 'Dependency', pl: 'Zależność' },
    };
    return isPolish ? map[type].pl : map[type].en;
  };

  const getStatusLabel = (status: RaidStatus): string => {
    const map: Record<RaidStatus, { en: string; pl: string }> = {
      open: { en: 'Open', pl: 'Otwarty' },
      mitigated: { en: 'Mitigated', pl: 'Zmitigowany' },
      accepted: { en: 'Accepted', pl: 'Zaakceptowany' },
      closed: { en: 'Closed', pl: 'Zamknięty' },
      resolved: { en: 'Resolved', pl: 'Rozwiązany' },
      transferred: { en: 'Transferred', pl: 'Przekazany' },
    };
    return isPolish ? map[status].pl : map[status].en;
  };

  /** Label for the "proposed action" field, varies by RAID type */
  const getActionLabel = (type: RaidType): string => {
    const map: Record<RaidType, { en: string; pl: string }> = {
      risk: { en: 'Proposed Action', pl: 'Proponowana akcja' },
      assumption: { en: 'Action to Validate', pl: 'Akcja walidacyjna' },
      issue: { en: 'Resolution Plan', pl: 'Plan rozwiązania' },
      dependency: { en: 'Management Plan', pl: 'Plan zarządzania' },
    };
    return isPolish ? map[type].pl : map[type].en;
  };

  const getActionPlaceholder = (type: RaidType): string => {
    const map: Record<RaidType, { en: string; pl: string }> = {
      risk: {
        en: 'What action do we propose to address this risk?',
        pl: 'Jaką akcję proponujemy w odpowiedzi na to ryzyko?',
      },
      assumption: {
        en: 'How will we validate this assumption?',
        pl: 'Jak zwalidujemy to założenie?',
      },
      issue: {
        en: 'What is the resolution plan for this issue?',
        pl: 'Jaki jest plan rozwiązania tego problemu?',
      },
      dependency: {
        en: 'How will we manage this dependency?',
        pl: 'Jak będziemy zarządzać tą zależnością?',
      },
    };
    return isPolish ? map[type].pl : map[type].en;
  };

  // ── Category options ─────────────────────────────────────────────────────

  const categoryOptions = useMemo(
    () =>
      ['technical', 'business', 'financial', 'operational', 'security'].map((c) => ({
        value: c,
        label:
          c === 'technical'
            ? isPolish
              ? 'Techniczne'
              : 'Technical'
            : c === 'business'
              ? isPolish
                ? 'Biznesowe'
                : 'Business'
              : c === 'financial'
                ? isPolish
                  ? 'Finansowe'
                  : 'Financial'
                : c === 'operational'
                  ? isPolish
                    ? 'Operacyjne'
                    : 'Operational'
                  : isPolish
                    ? 'Bezpieczeństwo'
                    : 'Security',
      })),
    [isPolish]
  );

  // ── Quick action buttons per type ────────────────────────────────────────

  const getQuickActions = (type: RaidType): string[] => {
    if (type === 'risk') {
      return isPolish
        ? ['Przegląd tygodniowy', 'Eskalacja do PMO', 'POC przed wdrożeniem']
        : ['Weekly review', 'Escalate to PMO', 'POC before rollout'];
    }
    if (type === 'assumption') {
      return isPolish
        ? ['Walidacja z interesariuszem', 'Analiza danych', 'Prototyp / POC']
        : ['Validate with stakeholder', 'Data analysis', 'Prototype / POC'];
    }
    if (type === 'issue') {
      return isPolish
        ? ['Hotfix natychmiast', 'Eskalacja', 'Rollback']
        : ['Hotfix immediately', 'Escalate', 'Rollback'];
    }
    // dependency
    return isPolish
      ? ['Spotkanie synchronizacyjne', 'Mock API / stub', 'Eskalacja do managera']
      : ['Sync meeting', 'Mock API / stub', 'Escalate to manager'];
  };

  const quickContingencyArgs = useMemo(
    () =>
      isPolish
        ? ['Tryb ręczny fallback', 'Eskalacja do PMO', 'Przesunięcie terminu + komunikat']
        : ['Manual fallback mode', 'Escalate to PMO', 'Timeline shift with stakeholder notice'],
    [isPolish]
  );

  const quickMitigationArgs = useMemo(
    () =>
      isPolish
        ? ['POC przed wdrożeniem', 'Przegląd tygodniowy', 'Plan kontroli jakości']
        : ['POC before rollout', 'Weekly review checkpoint', 'Quality control plan'],
    [isPolish]
  );

  // ── Computed ─────────────────────────────────────────────────────────────

  const typeCounts = useMemo(() => {
    const counts: Record<RaidType, number> = { risk: 0, assumption: 0, issue: 0, dependency: 0 };
    items.forEach((item) => {
      if (counts[item.type] !== undefined) counts[item.type]++;
    });
    return counts;
  }, [items]);

  const filteredItems = useMemo(() => {
    const filtered = typeFilter === 'all' ? items : items.filter((i) => i.type === typeFilter);
    return [...filtered].sort((a, b) => getRaidScore(b) - getRaidScore(a));
  }, [items, typeFilter]);

  const criticalCount = useMemo(
    () =>
      items.filter((i) => {
        const imp = (i.impact || 'low').toLowerCase();
        return imp === 'critical' || imp === 'high';
      }).length,
    [items]
  );

  // ── Filter tabs ──────────────────────────────────────────────────────────

  const filterTabs: { key: RaidTypeFilter; label: string; count: number }[] = useMemo(
    () => [
      { key: 'all', label: isPolish ? 'Wszystkie' : 'All', count: items.length },
      { key: 'risk', label: isPolish ? 'Ryzyka' : 'Risks', count: typeCounts.risk },
      {
        key: 'assumption',
        label: isPolish ? 'Założenia' : 'Assumptions',
        count: typeCounts.assumption,
      },
      { key: 'issue', label: isPolish ? 'Problemy' : 'Issues', count: typeCounts.issue },
      {
        key: 'dependency',
        label: isPolish ? 'Zależności' : 'Dependencies',
        count: typeCounts.dependency,
      },
    ],
    [isPolish, items.length, typeCounts]
  );

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
          {isPolish ? 'Ryzyko i RAID' : 'Risk & RAID'}
        </h2>
        {onAIGenerate && (
          <button
            onClick={onAIGenerate}
            disabled={locked || isGeneratingAI}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-purple-500/15 to-violet-500/15 border border-purple-400/40 dark:border-purple-500/30 text-purple-600 dark:text-purple-400 hover:from-purple-500/25 hover:to-violet-500/25 hover:border-purple-400/60 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isGeneratingAI ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Sparkles size={13} />
            )}
            {isPolish ? 'Analizuj RAID' : 'Analyze RAID'}
          </button>
        )}
      </div>

      {/* ── RAID Counter Cards ──────────────────────────────────────────── */}
      {items.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {(['risk', 'assumption', 'issue', 'dependency'] as const).map((type) => {
            const meta = RAID_TYPE_META[type];
            const TypeIcon = meta.icon;
            const isActive = typeFilter === type;
            return (
              <button
                key={type}
                onClick={() => setTypeFilter((prev) => (prev === type ? 'all' : type))}
                className={`p-3 rounded-xl text-center transition-all border ${
                  isActive
                    ? `${meta.borderActive} ${meta.bgLight} ring-1`
                    : 'border-slate-200/50 dark:border-navy-700/50 bg-slate-50/30 dark:bg-navy-900/30 hover:border-slate-300/60 dark:hover:border-navy-600/60'
                }`}
              >
                <TypeIcon size={16} className={`mx-auto mb-1 ${meta.color}`} />
                <div className="text-lg font-bold text-slate-700 dark:text-slate-200">
                  {typeCounts[type]}
                </div>
                <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {getTypeLabel(type)}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Filter Tabs ─────────────────────────────────────────────────── */}
      {items.length > 0 && (
        <div className="flex items-center gap-1 border-b border-slate-200/50 dark:border-navy-700/50 pb-0.5">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setTypeFilter(tab.key)}
              className={`px-2.5 py-1.5 text-[11px] font-medium rounded-t-lg transition-colors ${
                typeFilter === tab.key
                  ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-500'
                  : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
            >
              {tab.label}
              {tab.count > 0 && <span className="ml-1 text-[10px] opacity-60">({tab.count})</span>}
            </button>
          ))}
        </div>
      )}

      {/* ── Sort info ───────────────────────────────────────────────────── */}
      {filteredItems.length > 0 && (
        <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
          <span>
            {isPolish
              ? 'Posortowane wg najwyższego wpływu / score'
              : 'Sorted by highest impact / score'}
          </span>
          <span>
            {filteredItems.length} / {items.length} {isPolish ? 'elementów' : 'items'}
          </span>
        </div>
      )}

      {/* ── Empty state ─────────────────────────────────────────────────── */}
      {items.length === 0 && (
        <div className="py-8 text-center">
          <AlertTriangle size={24} className="mx-auto mb-2 text-slate-300 dark:text-slate-600" />
          <p className="text-sm text-slate-400 dark:text-slate-500 mb-1">
            {isPolish ? 'Brak elementów RAID.' : 'No RAID items yet.'}
          </p>
          <p className="text-xs text-slate-300 dark:text-slate-600 mb-4">
            {isPolish
              ? 'Dodaj ryzyka, założenia, problemy lub zależności.'
              : 'Add risks, assumptions, issues, or dependencies.'}
          </p>
          <div className="inline-flex items-center gap-2">
            {(['risk', 'assumption', 'issue', 'dependency'] as const).map((type) => (
              <button
                key={type}
                onClick={() => onAddItem(type)}
                disabled={locked}
                className="text-xs font-medium text-primary-500 hover:text-primary-600 transition-colors disabled:opacity-40"
              >
                + {getTypeLabel(type)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Level legend + Add item ─────────────────────────────────────── */}
      <div className="py-2 flex items-center justify-between">
        <div className="text-[10px] flex flex-wrap items-center gap-1.5 text-slate-400 dark:text-slate-500">
          <span>{isPolish ? 'Legenda poziomów:' : 'Level legend:'}</span>
          {RAID_LEVEL_OPTIONS.map((level) => (
            <span
              key={`legend-${level}`}
              className={`px-1.5 py-0.5 rounded border font-medium ${getLevelClass(level)}`}
            >
              {getLevelLabel(level)}
            </span>
          ))}
        </div>
        {!locked && (
          <button
            onClick={() => onAddItem(typeFilter === 'all' ? 'risk' : typeFilter)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200/60 dark:border-navy-600/50 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-navy-500 hover:bg-slate-50 dark:hover:bg-navy-800/50 transition-colors"
          >
            <Plus size={13} />
            {isPolish ? 'Dodaj element' : 'Add item'}
          </button>
        )}
      </div>

      {/* ── RAID Item Cards ─────────────────────────────────────────────── */}
      {filteredItems.length > 0 && (
        <div className="space-y-0 divide-y divide-slate-300/55 dark:divide-navy-600/65">
          {filteredItems.map((item) => {
            const isRisk = item.type === 'risk';
            const meta = RAID_TYPE_META[item.type];
            const TypeIcon = meta.icon;
            const score = getRaidScore(item);

            return (
              <div key={item.id} className="py-5 first:pt-2 group">
                <div className="p-5 rounded-xl bg-slate-50/20 dark:bg-navy-900/25 space-y-5">
                  {/* ── Row 1: Type badge + Title + Score/Impact + Delete ── */}
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {/* Type badge */}
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] uppercase font-semibold flex-shrink-0 ${meta.bgLight} ${meta.color}`}
                        >
                          <TypeIcon size={10} />
                          {getTypeLabel(item.type)}
                        </span>
                        <input
                          value={item.title}
                          onChange={(e) => onUpdateItem(item.id, { title: e.target.value })}
                          readOnly={locked}
                          className="flex-1 text-sm font-medium bg-transparent text-slate-800 dark:text-white focus:outline-none placeholder-slate-400"
                          placeholder={
                            isPolish
                              ? `Nazwa ${getTypeLabel(item.type).toLowerCase()}...`
                              : `${getTypeLabel(item.type)} name...`
                          }
                        />
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Score badge */}
                        <span
                          className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold ${
                            isRisk ? getScoreClass(score, true) : getLevelClass(item.impact)
                          }`}
                        >
                          {isRisk
                            ? `Score ${score}`
                            : `${isPolish ? 'Wpływ' : 'Impact'}: ${getLevelLabel(item.impact)}`}
                        </span>
                        {/* Status badge */}
                        <span
                          className={`px-1.5 py-0.5 rounded border text-[10px] font-medium ${getStatusClass(item.status)}`}
                        >
                          {getStatusLabel(item.status)}
                        </span>
                        <button
                          onClick={() => onRemoveItem(item.id)}
                          disabled={locked}
                          className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-0"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>

                    {/* ── Row 2: Selectors grid ─────────────────────────── */}
                    <div
                      className={`grid gap-2 ${isRisk ? 'grid-cols-2 md:grid-cols-5' : 'grid-cols-2 md:grid-cols-4'}`}
                    >
                      {/* Type selector */}
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                          {isPolish ? 'Typ' : 'Type'}
                        </span>
                        <select
                          value={item.type}
                          onChange={(e) =>
                            onUpdateItem(item.id, { type: e.target.value as RaidType })
                          }
                          disabled={locked}
                          className={`w-full text-[11px] px-2 py-1 rounded-md border ${meta.bgLight} ${meta.color} border-current/20 focus:outline-none focus:border-primary-400 disabled:opacity-60`}
                        >
                          {(['risk', 'assumption', 'issue', 'dependency'] as const).map((t) => (
                            <option key={t} value={t}>
                              {getTypeLabel(t)}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Probability — Risk only */}
                      {isRisk && (
                        <div className="space-y-1">
                          <span className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                            {isPolish ? 'Prawdopodobieństwo' : 'Probability'}
                          </span>
                          <select
                            value={item.probability || 'medium'}
                            onChange={(e) =>
                              onUpdateItem(item.id, { probability: e.target.value as RaidLevel })
                            }
                            disabled={locked}
                            className={`w-full text-[11px] px-2 py-1 rounded-md border focus:outline-none focus:border-primary-400 ${getLevelClass(item.probability)} disabled:opacity-60`}
                          >
                            {RAID_LEVEL_OPTIONS.map((level) => (
                              <option key={`p-${item.id}-${level}`} value={level}>
                                {getLevelLabel(level)}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Impact — all types */}
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                          {isPolish ? 'Wpływ' : 'Impact'}
                        </span>
                        <select
                          value={item.impact}
                          onChange={(e) =>
                            onUpdateItem(item.id, { impact: e.target.value as RaidLevel })
                          }
                          disabled={locked}
                          className={`w-full text-[11px] px-2 py-1 rounded-md border focus:outline-none focus:border-primary-400 ${getLevelClass(item.impact)} disabled:opacity-60`}
                        >
                          {RAID_LEVEL_OPTIONS.map((level) => (
                            <option key={`i-${item.id}-${level}`} value={level}>
                              {getLevelLabel(level)}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Category */}
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                          {isPolish ? 'Kategoria' : 'Category'}
                        </span>
                        <select
                          value={item.category || 'business'}
                          onChange={(e) => onUpdateItem(item.id, { category: e.target.value })}
                          disabled={locked}
                          className="w-full text-[11px] px-2 py-1 rounded-md bg-slate-50/70 dark:bg-navy-800/70 border border-slate-200/60 dark:border-navy-600/60 text-slate-600 dark:text-slate-300 focus:outline-none focus:border-primary-400 disabled:opacity-60"
                        >
                          {categoryOptions.map((cat) => (
                            <option key={`c-${item.id}-${cat.value}`} value={cat.value}>
                              {cat.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Status */}
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                          Status
                        </span>
                        <select
                          value={item.status}
                          onChange={(e) =>
                            onUpdateItem(item.id, { status: e.target.value as RaidStatus })
                          }
                          disabled={locked}
                          className={`w-full text-[11px] px-2 py-1 rounded-md border focus:outline-none focus:border-primary-400 ${getStatusClass(item.status)} disabled:opacity-60`}
                        >
                          {RAID_STATUS_OPTIONS.map((s) => (
                            <option key={`s-${item.id}-${s}`} value={s}>
                              {getStatusLabel(s)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* ── Row 3: Owner + Due Date + Source ───────────────── */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      {/* Owner */}
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500 flex items-center gap-1">
                          <User size={9} />
                          {isPolish ? 'Właściciel' : 'Owner'}
                        </span>
                        {users && users.length > 0 ? (
                          <select
                            value={item.owner || ''}
                            onChange={(e) => onUpdateItem(item.id, { owner: e.target.value })}
                            disabled={locked}
                            className="w-full text-[11px] px-2 py-1 rounded-md bg-slate-50/70 dark:bg-navy-800/70 border border-slate-200/60 dark:border-navy-600/60 text-slate-600 dark:text-slate-300 focus:outline-none focus:border-primary-400 disabled:opacity-60"
                          >
                            <option value="">{isPolish ? '— Wybierz —' : '— Select —'}</option>
                            {users.map((u) => (
                              <option key={u.id} value={u.name}>
                                {u.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            value={item.owner || ''}
                            onChange={(e) => onUpdateItem(item.id, { owner: e.target.value })}
                            readOnly={locked}
                            className="w-full text-[11px] px-2 py-1 rounded-md bg-slate-50/70 dark:bg-navy-800/70 border border-slate-200/60 dark:border-navy-600/60 text-slate-600 dark:text-slate-300 focus:outline-none focus:border-primary-400"
                            placeholder={isPolish ? 'Imię i nazwisko...' : 'Name...'}
                          />
                        )}
                      </div>

                      {/* Due Date */}
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500 flex items-center gap-1">
                          <Calendar size={9} />
                          {isPolish ? 'Termin' : 'Due Date'}
                        </span>
                        <input
                          type="date"
                          value={item.dueDate || ''}
                          onChange={(e) => onUpdateItem(item.id, { dueDate: e.target.value })}
                          readOnly={locked}
                          className={`w-full text-[11px] px-2 py-1 rounded-md bg-slate-50/70 dark:bg-navy-800/70 border border-slate-200/60 dark:border-navy-600/60 text-slate-600 dark:text-slate-300 focus:outline-none focus:border-primary-400 ${
                            item.dueDate && new Date(item.dueDate) < new Date()
                              ? 'text-red-500 dark:text-red-400 border-red-400/40'
                              : ''
                          }`}
                        />
                      </div>

                      {/* Source */}
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500 flex items-center gap-1">
                          <Shield size={9} />
                          {isPolish ? 'Źródło' : 'Source'}
                        </span>
                        <input
                          value={item.source || ''}
                          onChange={(e) => onUpdateItem(item.id, { source: e.target.value })}
                          readOnly={locked}
                          className="w-full text-[11px] px-2 py-1 rounded-md bg-slate-50/70 dark:bg-navy-800/70 border border-slate-200/60 dark:border-navy-600/60 text-slate-600 dark:text-slate-300 focus:outline-none focus:border-primary-400"
                          placeholder={
                            isPolish ? 'np. spotkanie, audyt, AI' : 'e.g. meeting, audit, AI'
                          }
                        />
                      </div>
                    </div>
                  </div>

                  {/* ── Risk-specific: Contingency + Mitigation ──────────── */}
                  {isRisk && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                      {/* Contingency */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                            {isPolish ? 'Ryzyko (materializacja)' : 'Risk (materialized)'}
                          </span>
                          <AIFieldEnhancer
                            fieldKey={`${fieldKeyPrefix}-raid-con-${item.id}`}
                            sectionLabel={`Risk contingency: ${item.title || 'Risk'}`}
                            currentValue={item.contingency || ''}
                            onApply={(value) => onUpdateItem(item.id, { contingency: value })}
                            artifactContext={artifactContext}
                            disabled={locked}
                          />
                        </div>
                        <textarea
                          value={item.contingency || ''}
                          onChange={(e) => onUpdateItem(item.id, { contingency: e.target.value })}
                          rows={4}
                          readOnly={locked}
                          className="w-full min-h-[92px] text-xs bg-transparent border-b border-slate-200/60 dark:border-navy-700/60 text-slate-500 dark:text-slate-400 focus:outline-none focus:border-primary-400 resize-y"
                          placeholder={
                            isPolish
                              ? 'Co robimy, gdy ryzyko się zmaterializuje?'
                              : 'What is the fallback if risk materializes?'
                          }
                        />
                        <div className="flex flex-wrap gap-1">
                          {quickContingencyArgs.map((arg) => (
                            <button
                              key={`${item.id}-con-${arg}`}
                              onClick={() =>
                                onUpdateItem(item.id, {
                                  contingency: item.contingency
                                    ? `${item.contingency}\n- ${arg}`
                                    : `- ${arg}`,
                                })
                              }
                              disabled={locked}
                              className="px-1.5 py-0.5 rounded border border-red-400/30 text-red-500 dark:text-red-400 text-[10px] hover:bg-red-500/10 transition-colors disabled:opacity-40"
                            >
                              +{arg}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Mitigation */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                            {isPolish ? 'Mitigacja' : 'Mitigation'}
                          </span>
                          <AIFieldEnhancer
                            fieldKey={`${fieldKeyPrefix}-raid-mit-${item.id}`}
                            sectionLabel={`Risk mitigation: ${item.title || 'Risk'}`}
                            currentValue={item.mitigation || ''}
                            onApply={(value) => onUpdateItem(item.id, { mitigation: value })}
                            artifactContext={artifactContext}
                            disabled={locked}
                          />
                        </div>
                        <textarea
                          value={item.mitigation || ''}
                          onChange={(e) => onUpdateItem(item.id, { mitigation: e.target.value })}
                          rows={4}
                          readOnly={locked}
                          className="w-full min-h-[92px] text-xs bg-transparent border-b border-slate-200/60 dark:border-navy-700/60 text-slate-500 dark:text-slate-400 focus:outline-none focus:border-primary-400 resize-y"
                          placeholder={
                            isPolish
                              ? 'Jak ograniczamy to ryzyko?'
                              : 'How do we mitigate this risk?'
                          }
                        />
                        <div className="flex flex-wrap gap-1">
                          {quickMitigationArgs.map((arg) => (
                            <button
                              key={`${item.id}-mit-${arg}`}
                              onClick={() =>
                                onUpdateItem(item.id, {
                                  mitigation: item.mitigation
                                    ? `${item.mitigation}\n- ${arg}`
                                    : `- ${arg}`,
                                })
                              }
                              disabled={locked}
                              className="px-1.5 py-0.5 rounded border border-emerald-400/30 text-emerald-600 dark:text-emerald-400 text-[10px] hover:bg-emerald-500/10 transition-colors disabled:opacity-40"
                            >
                              +{arg}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Proposed Action — ALL types ──────────────────────── */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                        {getActionLabel(item.type)}
                      </span>
                      <AIFieldEnhancer
                        fieldKey={`${fieldKeyPrefix}-raid-act-${item.id}`}
                        sectionLabel={`${getActionLabel(item.type)}: ${item.title || 'Item'}`}
                        currentValue={item.proposedAction || ''}
                        onApply={(value) => onUpdateItem(item.id, { proposedAction: value })}
                        artifactContext={artifactContext}
                        disabled={locked}
                      />
                    </div>
                    <textarea
                      value={item.proposedAction || ''}
                      onChange={(e) => onUpdateItem(item.id, { proposedAction: e.target.value })}
                      rows={3}
                      readOnly={locked}
                      className="w-full min-h-[72px] text-xs bg-transparent border-b border-slate-200/60 dark:border-navy-700/60 text-slate-500 dark:text-slate-400 focus:outline-none focus:border-primary-400 resize-y"
                      placeholder={getActionPlaceholder(item.type)}
                    />
                    <div className="flex flex-wrap gap-1">
                      {getQuickActions(item.type).map((arg) => (
                        <button
                          key={`${item.id}-act-${arg}`}
                          onClick={() =>
                            onUpdateItem(item.id, {
                              proposedAction: item.proposedAction
                                ? `${item.proposedAction}\n- ${arg}`
                                : `- ${arg}`,
                            })
                          }
                          disabled={locked}
                          className={`px-1.5 py-0.5 rounded border text-[10px] hover:bg-opacity-10 transition-colors disabled:opacity-40 ${
                            item.type === 'risk'
                              ? 'border-amber-400/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10'
                              : item.type === 'assumption'
                                ? 'border-blue-400/30 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10'
                                : item.type === 'issue'
                                  ? 'border-red-400/30 text-red-600 dark:text-red-400 hover:bg-red-500/10'
                                  : 'border-purple-400/30 text-purple-600 dark:text-purple-400 hover:bg-purple-500/10'
                          }`}
                        >
                          +{arg}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Bottom spacer ──────────────────────────────────────────────── */}
      {items.length > 0 && <div className="h-2" />}
    </div>
  );
};

export default RaidCanvas;
