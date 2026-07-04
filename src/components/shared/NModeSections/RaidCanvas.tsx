/**
 * RaidCanvas — Enterprise RAID Log (Big4 / McKinsey / PMBOK standard)
 *
 * Full RAID (Risk, Assumption, Issue, Dependency) management canvas.
 * Implements industry-standard RAID methodology used by:
 * - PRINCE2 (mandatory project artifact)
 * - PMI/PMBOK (Risk Register + Issue Log + Assumption Log + Dependency Matrix)
 * - SAFe ROAM (Resolved/Owned/Accepted/Mitigated)
 * - Big4 consulting (Deloitte, PwC, EY, KPMG)
 * - McKinsey / BCG transformation frameworks
 *
 * Features:
 * - Executive Summary Strip (health score, critical counts, overdue, unowned)
 * - Risk Heatmap (Probability × Impact matrix — PMBOK standard)
 * - 4 RAID types with type-specific status workflows
 * - PMBOK response strategies per type
 * - Risk→Issue auto-conversion on materialization
 * - Overdue visual warnings
 * - AI field enhancement per field
 * - Counter cards with trend indicators
 *
 * @see docs/ui-standards/02-components/shared-sections.md §5c
 */

import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Calendar,
  Clock,
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
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AIFieldEnhancer } from '@/components/shared/AIFieldEnhancer';

// ── Types ────────────────────────────────────────────────────────────────────

export type RaidType = 'risk' | 'assumption' | 'issue' | 'dependency';
export type RaidLevel = 'low' | 'medium' | 'high' | 'critical';
export type RaidTypeFilter = 'all' | RaidType;

/**
 * PMBOK-aligned status values per RAID type:
 * Risk:       open → mitigated → accepted → closed | materialized (→ becomes Issue)
 * Assumption: open → validated → invalidated (→ becomes Issue) → closed
 * Issue:      open → in_progress → resolved → closed | escalated
 * Dependency: open → on_track → at_risk → met → not_met
 */
export type RaidStatus =
  | 'open'
  | 'mitigated'
  | 'accepted'
  | 'closed'
  | 'resolved'
  | 'transferred'
  | 'materialized'
  | 'validated'
  | 'invalidated'
  | 'in_progress'
  | 'escalated'
  | 'on_track'
  | 'at_risk'
  | 'met'
  | 'not_met';

/** PMBOK Risk Response Strategy */
export type RiskResponseStrategy = 'avoid' | 'transfer' | 'mitigate' | 'accept' | 'escalate';

export interface RaidItem {
  id: string;
  type: RaidType;
  title: string;
  description?: string;
  /** Risk-specific: probability level */
  probability?: RaidLevel;
  /** Impact level — used by all types */
  impact: RaidLevel;
  /** Category (technical, business, financial, operational, security, legal, regulatory) */
  category?: string;
  /** Risk-specific: mitigation plan */
  mitigation?: string;
  /** Risk-specific: contingency plan */
  contingency?: string;
  /** Proposed action — universal for all RAID types */
  proposedAction?: string;
  /** Current status */
  status: RaidStatus;
  /** PMBOK risk response strategy */
  responseStrategy?: RiskResponseStrategy;
  /** Owner name or ID */
  owner?: string;
  /** Due date (ISO string) */
  dueDate?: string;
  /** Source of this item (e.g. meeting, audit, AI, workshop) */
  source?: string;
  /** Date when item was created */
  createdAt?: string;
  /** Date when item was last reviewed */
  lastReviewedAt?: string;
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
  /** Convert Risk→Issue or Assumption→Issue */
  onConvertToIssue?: (id: string) => void;
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

/** Type-specific allowed statuses (PMBOK workflow) */
const STATUS_BY_TYPE: Record<RaidType, readonly RaidStatus[]> = {
  risk: ['open', 'mitigated', 'accepted', 'materialized', 'transferred', 'closed'],
  assumption: ['open', 'validated', 'invalidated', 'closed'],
  issue: ['open', 'in_progress', 'escalated', 'resolved', 'closed'],
  dependency: ['open', 'on_track', 'at_risk', 'met', 'not_met', 'closed'],
};

/** PMBOK Risk Response Strategies */
const RESPONSE_STRATEGIES: readonly RiskResponseStrategy[] = [
  'avoid',
  'transfer',
  'mitigate',
  'accept',
  'escalate',
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
    color: 'text-danger-500',
    bgLight: 'bg-danger-500/10',
    borderActive: 'border-danger-400/60 ring-danger-400/30',
  },
  assumption: {
    icon: HelpCircle,
    color: 'text-blue-500',
    bgLight: 'bg-blue-500/10',
    borderActive: 'border-blue-400/60 ring-blue-400/30',
  },
  issue: {
    icon: XCircle,
    color: 'text-danger-500',
    bgLight: 'bg-danger-500/10',
    borderActive: 'border-danger-400/60 ring-danger-400/30',
  },
  dependency: {
    icon: GitBranch,
    color: 'text-primary-500',
    bgLight: 'bg-primary-500/10',
    borderActive: 'border-primary-400/60 ring-c-info/30',
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
    if (score >= 12) return 'text-danger-600 dark:text-danger-400 bg-danger-500/10 border-danger-500/30';
    if (score >= 8) return 'text-amber-700 dark:text-amber-300 bg-amber-500/10 border-amber-500/30';
    if (score >= 4)
      return 'text-yellow-700 dark:text-yellow-300 bg-yellow-500/10 border-yellow-500/30';
    return 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/30';
  }
  return getLevelClass(
    String(score <= 1 ? 'low' : score === 2 ? 'medium' : score === 3 ? 'high' : 'critical')
  );
};

const getLevelClass = (level?: string): string => {
  const n = String(level || '').toLowerCase();
  if (n === 'critical') return 'border-danger-500/60 bg-danger-500/10 text-danger-700 dark:text-danger-300';
  if (n === 'high') return 'border-amber-500/55 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  if (n === 'medium')
    return 'border-amber-500/55 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  return 'border-emerald-500/45 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
};

const getStatusClass = (status: string): string => {
  const s = status.toLowerCase();
  if (s === 'closed' || s === 'resolved' || s === 'met' || s === 'validated')
    return 'bg-emerald-500/15 text-emerald-500 border-emerald-400/30';
  if (s === 'mitigated' || s === 'on_track')
    return 'bg-green-500/15 text-green-500 border-green-400/30';
  if (s === 'accepted') return 'bg-amber-500/15 text-amber-500 border-amber-400/30';
  if (s === 'transferred') return 'bg-primary-500/15 text-primary-500 border-primary-400/30';
  if (s === 'materialized' || s === 'invalidated' || s === 'not_met')
    return 'bg-danger-500/20 text-danger-500 border-danger-400/40';
  if (s === 'escalated' || s === 'at_risk')
    return 'bg-amber-500/15 text-amber-500 border-amber-400/30';
  if (s === 'in_progress') return 'bg-blue-500/15 text-blue-500 border-blue-400/30';
  return 'bg-blue-500/15 text-blue-500 border-blue-400/30'; // open
};

const isOverdue = (item: RaidItem): boolean => {
  if (!item.dueDate) return false;
  const closedStatuses: RaidStatus[] = ['closed', 'resolved', 'met', 'validated'];
  if (closedStatuses.includes(item.status)) return false;
  return new Date(item.dueDate) < new Date();
};

const isUnowned = (item: RaidItem): boolean => {
  const closedStatuses: RaidStatus[] = ['closed', 'resolved', 'met', 'validated'];
  if (closedStatuses.includes(item.status)) return false;
  return !item.owner || item.owner.trim() === '';
};

/** Can this item be converted to an Issue? (Risk materialized or Assumption invalidated) */
const canConvertToIssue = (item: RaidItem): boolean => {
  if (item.type === 'risk' && item.status === 'materialized') return true;
  if (item.type === 'assumption' && item.status === 'invalidated') return true;
  return false;
};

// ── Component ────────────────────────────────────────────────────────────────

export const RaidCanvas: React.FC<RaidCanvasProps> = ({
  items,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  onConvertToIssue,
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
  const [showHeatmap, setShowHeatmap] = useState(false);

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
      materialized: { en: 'Materialized', pl: 'Zmaterializowany' },
      validated: { en: 'Validated', pl: 'Zwalidowany' },
      invalidated: { en: 'Invalidated', pl: 'Obalony' },
      in_progress: { en: 'In Progress', pl: 'W toku' },
      escalated: { en: 'Escalated', pl: 'Eskalowany' },
      on_track: { en: 'On Track', pl: 'Na dobrej drodze' },
      at_risk: { en: 'At Risk', pl: 'Zagrożony' },
      met: { en: 'Met', pl: 'Spełniony' },
      not_met: { en: 'Not Met', pl: 'Niespełniony' },
    };
    return isPolish ? map[status]?.pl || status : map[status]?.en || status;
  };

  const getResponseStrategyLabel = (strategy: RiskResponseStrategy): string => {
    const map: Record<RiskResponseStrategy, { en: string; pl: string }> = {
      avoid: { en: 'Avoid', pl: 'Unikaj' },
      transfer: { en: 'Transfer', pl: 'Transferuj' },
      mitigate: { en: 'Mitigate', pl: 'Mitiguj' },
      accept: { en: 'Accept', pl: 'Akceptuj' },
      escalate: { en: 'Escalate', pl: 'Eskaluj' },
    };
    return isPolish ? map[strategy].pl : map[strategy].en;
  };

  const getActionLabel = (type: RaidType): string => {
    const map: Record<RaidType, { en: string; pl: string }> = {
      risk: { en: 'Proposed Action', pl: 'Proponowana akcja' },
      assumption: { en: 'Validation Plan', pl: 'Plan walidacji' },
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
        en: 'How will we validate this assumption? What evidence do we need?',
        pl: 'Jak zwalidujemy to założenie? Jakich dowodów potrzebujemy?',
      },
      issue: {
        en: 'What is the resolution plan? Who needs to be involved?',
        pl: 'Jaki jest plan rozwiązania? Kto musi być zaangażowany?',
      },
      dependency: {
        en: 'How will we manage this dependency? What is the fallback?',
        pl: 'Jak zarządzamy tą zależnością? Jaki jest plan awaryjny?',
      },
    };
    return isPolish ? map[type].pl : map[type].en;
  };

  // ── Category options ─────────────────────────────────────────────────────

  const categoryOptions = useMemo(
    () =>
      ['technical', 'business', 'financial', 'operational', 'security', 'legal', 'regulatory'].map(
        (c) => ({
          value: c,
          label:
            (
              {
                technical: isPolish ? 'Techniczne' : 'Technical',
                business: isPolish ? 'Biznesowe' : 'Business',
                financial: isPolish ? 'Finansowe' : 'Financial',
                operational: isPolish ? 'Operacyjne' : 'Operational',
                security: isPolish ? 'Bezpieczeństwo' : 'Security',
                legal: isPolish ? 'Prawne' : 'Legal',
                regulatory: isPolish ? 'Regulacyjne' : 'Regulatory',
              } as Record<string, string>
            )[c] || c,
        })
      ),
    [isPolish]
  );

  // ── Quick action buttons per type ────────────────────────────────────────

  const getQuickActions = (type: RaidType): string[] => {
    if (type === 'risk') {
      return isPolish
        ? [
            'Przegląd tygodniowy',
            'Eskalacja do PMO',
            'POC przed wdrożeniem',
            'Transfer na dostawcę',
          ]
        : ['Weekly review', 'Escalate to PMO', 'POC before rollout', 'Transfer to vendor'];
    }
    if (type === 'assumption') {
      return isPolish
        ? ['Walidacja z interesariuszem', 'Analiza danych', 'Prototyp / POC', 'Wywiad z ekspertem']
        : ['Validate with stakeholder', 'Data analysis', 'Prototype / POC', 'Expert interview'];
    }
    if (type === 'issue') {
      return isPolish
        ? ['Hotfix natychmiast', 'Eskalacja do sponsora', 'Rollback', 'War room']
        : ['Hotfix immediately', 'Escalate to sponsor', 'Rollback', 'War room'];
    }
    return isPolish
      ? [
          'Spotkanie synchronizacyjne',
          'Mock API / stub',
          'Eskalacja do managera',
          'Plan alternatywny',
        ]
      : ['Sync meeting', 'Mock API / stub', 'Escalate to manager', 'Alternative plan'];
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

  // ── Computed metrics ─────────────────────────────────────────────────────

  const typeCounts = useMemo(() => {
    const counts: Record<RaidType, number> = { risk: 0, assumption: 0, issue: 0, dependency: 0 };
    items.forEach((item) => {
      if (counts[item.type] !== undefined) counts[item.type]++;
    });
    return counts;
  }, [items]);

  const openItems = useMemo(
    () => items.filter((i) => !['closed', 'resolved', 'met', 'validated'].includes(i.status)),
    [items]
  );

  const overdueItems = useMemo(() => items.filter(isOverdue), [items]);
  const unownedItems = useMemo(() => openItems.filter(isUnowned), [openItems]);
  const criticalItems = useMemo(
    () => openItems.filter((i) => i.impact === 'critical' || i.impact === 'high'),
    [openItems]
  );

  /** RAID Health Score (0-100) — PMBOK-inspired */
  const healthScore = useMemo(() => {
    if (items.length === 0) return 100;
    let score = 100;
    // Penalty for critical/high open items
    score -= criticalItems.length * 8;
    // Penalty for overdue items
    score -= overdueItems.length * 12;
    // Penalty for unowned items
    score -= unownedItems.length * 5;
    // Penalty for materialized risks / invalidated assumptions
    const materializedCount = items.filter(
      (i) => i.status === 'materialized' || i.status === 'invalidated' || i.status === 'not_met'
    ).length;
    score -= materializedCount * 10;
    // Bonus for closed items
    const closedCount = items.filter((i) =>
      ['closed', 'resolved', 'met', 'validated', 'mitigated'].includes(i.status)
    ).length;
    score += closedCount * 2;
    return Math.max(0, Math.min(100, score));
  }, [items, criticalItems, overdueItems, unownedItems]);

  const healthColor =
    healthScore >= 70 ? 'text-emerald-500' : healthScore >= 40 ? 'text-amber-500' : 'text-danger-500';
  const healthBg =
    healthScore >= 70
      ? 'bg-emerald-500/10 border-emerald-500/30'
      : healthScore >= 40
        ? 'bg-amber-500/10 border-amber-500/30'
        : 'bg-danger-500/10 border-danger-500/30';

  const filteredItems = useMemo(() => {
    const filtered = typeFilter === 'all' ? items : items.filter((i) => i.type === typeFilter);
    return [...filtered].sort((a, b) => getRaidScore(b) - getRaidScore(a));
  }, [items, typeFilter]);

  // ── Risk Heatmap data ────────────────────────────────────────────────────

  const heatmapData = useMemo(() => {
    const risks = items.filter((i) => i.type === 'risk');
    const levels: RaidLevel[] = ['critical', 'high', 'medium', 'low'];
    const matrix: Record<string, RaidItem[]> = {};
    levels.forEach((p) =>
      levels.forEach((i) => {
        matrix[`${p}-${i}`] = [];
      })
    );
    risks.forEach((r) => {
      const key = `${r.probability || 'medium'}-${r.impact}`;
      if (matrix[key]) matrix[key].push(r);
    });
    return { levels, matrix, riskCount: risks.length };
  }, [items]);

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

  // ── Convert to Issue handler ─────────────────────────────────────────────

  const handleConvertToIssue = useCallback(
    (item: RaidItem) => {
      if (onConvertToIssue) {
        onConvertToIssue(item.id);
      } else {
        // Default: update type to issue, reset status
        onUpdateItem(item.id, {
          type: 'issue',
          status: 'open',
          source: `${isPolish ? 'Konwersja z' : 'Converted from'} ${getTypeLabel(item.type)}: ${item.title}`,
        });
      }
    },
    [onConvertToIssue, onUpdateItem, isPolish]
  );

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
          {isPolish ? 'RAID Log' : 'RAID Log'}
          <span className="ml-2 text-xs font-normal text-slate-600 dark:text-slate-500">
            PMBOK / PRINCE2
          </span>
        </h2>
        {onAIGenerate && (
          <button
            onClick={onAIGenerate}
            disabled={locked || isGeneratingAI}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-primary-500/15 to-primary-500/15 border border-primary-400/40 dark:border-primary-500/30 text-primary-600 dark:text-primary-400 hover:from-primary-500/25 hover:to-primary-500/25 hover:border-primary-400/60 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
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

      {/* ── Executive Summary Strip ─────────────────────────────────────── */}
      <div className="grid grid-cols-5 gap-2">
        {/* Health Score */}
        <div className={`p-2.5 rounded-xl text-center border ${healthBg}`}>
          <div className={`text-xl font-bold ${healthColor}`}>{healthScore}</div>
          <div className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {isPolish ? 'Zdrowie' : 'Health'}
          </div>
        </div>
        {/* Open */}
        <div className="p-2.5 rounded-xl text-center border border-slate-200/50 dark:border-navy-700/50 bg-slate-50/30 dark:bg-navy-900/30">
          <div className="text-xl font-bold text-slate-700 dark:text-slate-200">
            {openItems.length}
          </div>
          <div className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {isPolish ? 'Otwarte' : 'Open'}
          </div>
        </div>
        {/* Critical/High */}
        <div
          className={`p-2.5 rounded-xl text-center border ${criticalItems.length > 0 ? 'border-danger-400/40 bg-danger-500/10' : 'border-slate-200/50 dark:border-navy-700/50 bg-slate-50/30 dark:bg-navy-900/30'}`}
        >
          <div
            className={`text-xl font-bold ${criticalItems.length > 0 ? 'text-danger-500' : 'text-slate-700 dark:text-slate-200'}`}
          >
            {criticalItems.length}
          </div>
          <div className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {isPolish ? 'Krytyczne' : 'Critical'}
          </div>
        </div>
        {/* Overdue */}
        <div
          className={`p-2.5 rounded-xl text-center border ${overdueItems.length > 0 ? 'border-amber-400/40 bg-amber-500/10' : 'border-slate-200/50 dark:border-navy-700/50 bg-slate-50/30 dark:bg-navy-900/30'}`}
        >
          <div
            className={`text-xl font-bold ${overdueItems.length > 0 ? 'text-amber-500' : 'text-slate-700 dark:text-slate-200'}`}
          >
            {overdueItems.length}
          </div>
          <div className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {isPolish ? 'Po terminie' : 'Overdue'}
          </div>
        </div>
        {/* Unowned */}
        <div
          className={`p-2.5 rounded-xl text-center border ${unownedItems.length > 0 ? 'border-amber-400/40 bg-amber-500/10' : 'border-slate-200/50 dark:border-navy-700/50 bg-slate-50/30 dark:bg-navy-900/30'}`}
        >
          <div
            className={`text-xl font-bold ${unownedItems.length > 0 ? 'text-amber-500' : 'text-slate-700 dark:text-slate-200'}`}
          >
            {unownedItems.length}
          </div>
          <div className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {isPolish ? 'Bez właściciela' : 'Unowned'}
          </div>
        </div>
      </div>

      {/* ── RAID Counter Cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-2">
        {(['risk', 'assumption', 'issue', 'dependency'] as const).map((type) => {
          const meta = RAID_TYPE_META[type];
          const TypeIcon = meta.icon;
          const isActive = typeFilter === type;
          const typeOverdue = overdueItems.filter((i) => i.type === type).length;
          return (
            <button
              key={type}
              onClick={() => setTypeFilter((prev) => (prev === type ? 'all' : type))}
              className={`p-3 rounded-xl text-center transition-all border relative ${
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
              {/* Overdue badge */}
              {typeOverdue > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-white text-[8px] font-bold flex items-center justify-center">
                  {typeOverdue}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Risk Heatmap (PMBOK P×I Matrix) ─────────────────────────────── */}
      {heatmapData.riskCount > 0 && (
        <div>
          <button
            onClick={() => setShowHeatmap((p) => !p)}
            className="text-[11px] font-medium text-slate-600 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors mb-2"
          >
            {showHeatmap
              ? isPolish
                ? '▾ Ukryj macierz ryzyk'
                : '▾ Hide risk matrix'
              : isPolish
                ? '▸ Pokaż macierz P×I (PMBOK)'
                : '▸ Show P×I matrix (PMBOK)'}
          </button>
          {showHeatmap && (
            <div className="rounded-xl border border-slate-200/50 dark:border-navy-700/50 p-3 bg-slate-50/20 dark:bg-navy-900/15">
              <div className="text-[10px] uppercase tracking-wide text-slate-600 dark:text-slate-500 mb-2 text-center">
                {isPolish ? 'Macierz Prawdopodobieństwo × Wpływ' : 'Probability × Impact Matrix'}
              </div>
              <div className="grid grid-cols-[auto_1fr_1fr_1fr_1fr] gap-px">
                {/* Header row */}
                <div className="text-[9px] text-slate-600 p-1" />
                {(['low', 'medium', 'high', 'critical'] as const).map((i) => (
                  <div
                    key={`h-${i}`}
                    className="text-[9px] text-center font-semibold text-slate-600 dark:text-slate-500 p-1 uppercase"
                  >
                    {getLevelLabel(i)}
                  </div>
                ))}
                {/* Rows (probability: critical→low) */}
                {(['critical', 'high', 'medium', 'low'] as const).map((p) => (
                  <React.Fragment key={`row-${p}`}>
                    <div className="text-[9px] font-semibold text-slate-600 dark:text-slate-500 p-1 uppercase flex items-center">
                      {getLevelLabel(p)}
                    </div>
                    {(['low', 'medium', 'high', 'critical'] as const).map((i) => {
                      const cellItems = heatmapData.matrix[`${p}-${i}`] || [];
                      const score = raidLevelToScore(p) * raidLevelToScore(i);
                      const bgClass =
                        score >= 12
                          ? 'bg-danger-500/25'
                          : score >= 8
                            ? 'bg-amber-500/20'
                            : score >= 4
                              ? 'bg-amber-500/15'
                              : 'bg-emerald-500/10';
                      return (
                        <div
                          key={`${p}-${i}`}
                          className={`${bgClass} rounded-md p-1.5 min-h-[28px] flex items-center justify-center`}
                          title={cellItems.map((r) => r.title).join(', ') || `P:${p} I:${i}`}
                        >
                          {cellItems.length > 0 && (
                            <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200">
                              {cellItems.length}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
              <div className="flex items-center justify-between mt-2 text-[9px] text-slate-600 dark:text-slate-500">
                <span>← {isPolish ? 'Wpływ' : 'Impact'} →</span>
                <span>↑ {isPolish ? 'Prawdopodobieństwo' : 'Probability'}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Filter Tabs ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 border-b border-slate-200/50 dark:border-navy-700/50 pb-0.5">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setTypeFilter(tab.key)}
            className={`px-2.5 py-1.5 text-[11px] font-medium rounded-t-lg transition-colors ${
              typeFilter === tab.key
                ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-500'
                : 'text-slate-600 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            {tab.label}
            {tab.count > 0 && <span className="ml-1 text-[10px] opacity-60">({tab.count})</span>}
          </button>
        ))}
      </div>

      {/* ── Sort info ───────────────────────────────────────────────────── */}
      {filteredItems.length > 0 && (
        <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-500">
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

      {/* ── Level legend + Add item ─────────────────────────────────────── */}
      <div className="py-2 flex items-center justify-between">
        <div className="text-[10px] flex flex-wrap items-center gap-1.5 text-slate-600 dark:text-slate-500">
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

      {/* ── Empty state ─────────────────────────────────────────────────── */}
      {items.length === 0 && (
        <div className="py-6 text-center rounded-xl border border-dashed border-slate-300/50 dark:border-navy-600/50 bg-slate-50/10 dark:bg-navy-900/10">
          <AlertTriangle size={20} className="mx-auto mb-2 text-slate-600 dark:text-slate-400" />
          <p className="text-sm text-slate-600 dark:text-slate-500 mb-1">
            {isPolish ? 'Brak elementów RAID.' : 'No RAID items yet.'}
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {isPolish
              ? 'Kliknij „Analizuj RAID" aby AI wygenerował pełną analizę RAID (Ryzyka, Założenia, Problemy, Zależności).'
              : 'Click "Analyze RAID" to let AI generate a full RAID analysis (Risks, Assumptions, Issues, Dependencies).'}
          </p>
        </div>
      )}

      {/* ── RAID Item Cards ─────────────────────────────────────────────── */}
      {filteredItems.length > 0 && (
        <div className="space-y-0 divide-y divide-slate-300/55 dark:divide-navy-600/65">
          {filteredItems.map((item) => {
            const isRisk = item.type === 'risk';
            const meta = RAID_TYPE_META[item.type];
            const TypeIcon = meta.icon;
            const score = getRaidScore(item);
            const itemOverdue = isOverdue(item);
            const itemUnowned = isUnowned(item);
            const showConvert = canConvertToIssue(item);
            const allowedStatuses = STATUS_BY_TYPE[item.type] || STATUS_BY_TYPE.risk;

            return (
              <div key={item.id} className="py-5 first:pt-2 group">
                <div
                  className={`p-5 rounded-xl space-y-5 ${
                    itemOverdue
                      ? 'bg-amber-500/5 dark:bg-amber-500/5 ring-1 ring-amber-400/30'
                      : showConvert
                        ? 'bg-danger-500/5 dark:bg-danger-500/5 ring-1 ring-danger-400/20'
                        : 'bg-slate-50/20 dark:bg-navy-900/25'
                  }`}
                >
                  {/* ── Overdue / Materialized banner ──────────────────── */}
                  {(itemOverdue || showConvert) && (
                    <div
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-medium ${
                        showConvert
                          ? 'bg-danger-500/15 text-danger-500 dark:text-danger-400'
                          : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {showConvert ? (
                        <>
                          <AlertCircle size={12} />
                          {item.type === 'risk'
                            ? isPolish
                              ? 'Ryzyko zmaterializowane — przekonwertuj na Issue'
                              : 'Risk materialized — convert to Issue'
                            : isPolish
                              ? 'Założenie obalone — przekonwertuj na Issue'
                              : 'Assumption invalidated — convert to Issue'}
                          <button
                            onClick={() => handleConvertToIssue(item)}
                            disabled={locked}
                            className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-danger-500/20 hover:bg-danger-500/30 text-danger-600 dark:text-danger-400 text-[10px] font-semibold transition-colors disabled:opacity-40"
                          >
                            <ArrowRight size={10} />
                            {isPolish ? 'Konwertuj na Issue' : 'Convert to Issue'}
                          </button>
                        </>
                      ) : (
                        <>
                          <Clock size={12} />
                          {isPolish ? `Po terminie: ${item.dueDate}` : `Overdue: ${item.dueDate}`}
                        </>
                      )}
                    </div>
                  )}

                  {/* ── Row 1: Type badge + Title + Score + Status + Delete */}
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
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
                        {/* Score / Impact badge */}
                        <span
                          className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold ${isRisk ? getScoreClass(score, true) : getLevelClass(item.impact)}`}
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
                        {/* Overdue indicator */}
                        {itemOverdue && <Clock size={12} className="text-amber-500" />}
                        {/* Unowned indicator */}
                        {itemUnowned && <User size={12} className="text-amber-400 opacity-60" />}
                        <button
                          onClick={() => onRemoveItem(item.id)}
                          disabled={locked}
                          className="p-1 text-slate-600 hover:text-danger-500 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-0"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>

                    {/* ── Row 2: Selectors grid ─────────────────────────── */}
                    <div
                      className={`grid gap-2 ${isRisk ? 'grid-cols-2 md:grid-cols-6' : 'grid-cols-2 md:grid-cols-4'}`}
                    >
                      {/* Type */}
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase tracking-wide text-slate-600 dark:text-slate-500">
                          {isPolish ? 'Typ' : 'Type'}
                        </span>
                        <select
                          value={item.type}
                          onChange={(e) =>
                            onUpdateItem(item.id, {
                              type: e.target.value as RaidType,
                              status: 'open',
                            })
                          }
                          disabled={locked}
                          className={`w-full text-[11px] px-2 py-1 rounded-md border ${meta.bgLight} ${meta.color} border-current/20 focus:outline-none focus:border-c-focus-solid disabled:opacity-60`}
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
                          <span className="text-[10px] uppercase tracking-wide text-slate-600 dark:text-slate-500">
                            {isPolish ? 'Prawdopodobieństwo' : 'Probability'}
                          </span>
                          <select
                            value={item.probability || 'medium'}
                            onChange={(e) =>
                              onUpdateItem(item.id, { probability: e.target.value as RaidLevel })
                            }
                            disabled={locked}
                            className={`w-full text-[11px] px-2 py-1 rounded-md border focus:outline-none focus:border-c-focus-solid ${getLevelClass(item.probability)} disabled:opacity-60`}
                          >
                            {RAID_LEVEL_OPTIONS.map((level) => (
                              <option key={`p-${item.id}-${level}`} value={level}>
                                {getLevelLabel(level)}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Impact */}
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase tracking-wide text-slate-600 dark:text-slate-500">
                          {isPolish ? 'Wpływ' : 'Impact'}
                        </span>
                        <select
                          value={item.impact}
                          onChange={(e) =>
                            onUpdateItem(item.id, { impact: e.target.value as RaidLevel })
                          }
                          disabled={locked}
                          className={`w-full text-[11px] px-2 py-1 rounded-md border focus:outline-none focus:border-c-focus-solid ${getLevelClass(item.impact)} disabled:opacity-60`}
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
                        <span className="text-[10px] uppercase tracking-wide text-slate-600 dark:text-slate-500">
                          {isPolish ? 'Kategoria' : 'Category'}
                        </span>
                        <select
                          value={item.category || 'business'}
                          onChange={(e) => onUpdateItem(item.id, { category: e.target.value })}
                          disabled={locked}
                          className="w-full text-[11px] px-2 py-1 rounded-md bg-slate-50/70 dark:bg-navy-800/70 border border-slate-200/60 dark:border-navy-600/60 text-slate-600 dark:text-slate-300 focus:outline-none focus:border-c-focus-solid disabled:opacity-60"
                        >
                          {categoryOptions.map((cat) => (
                            <option key={`c-${item.id}-${cat.value}`} value={cat.value}>
                              {cat.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Status — type-specific options */}
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase tracking-wide text-slate-600 dark:text-slate-500">
                          Status
                        </span>
                        <select
                          value={item.status}
                          onChange={(e) =>
                            onUpdateItem(item.id, { status: e.target.value as RaidStatus })
                          }
                          disabled={locked}
                          className={`w-full text-[11px] px-2 py-1 rounded-md border focus:outline-none focus:border-c-focus-solid ${getStatusClass(item.status)} disabled:opacity-60`}
                        >
                          {allowedStatuses.map((s) => (
                            <option key={`s-${item.id}-${s}`} value={s}>
                              {getStatusLabel(s)}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Response Strategy — Risk only (PMBOK) */}
                      {isRisk && (
                        <div className="space-y-1">
                          <span className="text-[10px] uppercase tracking-wide text-slate-600 dark:text-slate-500">
                            {isPolish ? 'Strategia (PMBOK)' : 'Response (PMBOK)'}
                          </span>
                          <select
                            value={item.responseStrategy || 'mitigate'}
                            onChange={(e) =>
                              onUpdateItem(item.id, {
                                responseStrategy: e.target.value as RiskResponseStrategy,
                              })
                            }
                            disabled={locked}
                            className="w-full text-[11px] px-2 py-1 rounded-md bg-slate-50/70 dark:bg-navy-800/70 border border-slate-200/60 dark:border-navy-600/60 text-slate-600 dark:text-slate-300 focus:outline-none focus:border-c-focus-solid disabled:opacity-60"
                          >
                            {RESPONSE_STRATEGIES.map((s) => (
                              <option key={`rs-${item.id}-${s}`} value={s}>
                                {getResponseStrategyLabel(s)}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {/* ── Row 3: Owner + Due Date + Source ───────────────── */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      {/* Owner */}
                      <div className="space-y-1">
                        <span
                          className={`text-[10px] uppercase tracking-wide flex items-center gap-1 ${itemUnowned ? 'text-amber-500' : 'text-slate-600 dark:text-slate-500'}`}
                        >
                          <User size={9} />
                          {isPolish ? 'Właściciel' : 'Owner'}
                          {itemUnowned && (
                            <span className="text-[8px] normal-case">
                              ({isPolish ? 'wymagany' : 'required'})
                            </span>
                          )}
                        </span>
                        {users && users.length > 0 ? (
                          <select
                            value={item.owner || ''}
                            onChange={(e) => onUpdateItem(item.id, { owner: e.target.value })}
                            disabled={locked}
                            className={`w-full text-[11px] px-2 py-1 rounded-md bg-slate-50/70 dark:bg-navy-800/70 border text-slate-600 dark:text-slate-300 focus:outline-none focus:border-c-focus-solid disabled:opacity-60 ${itemUnowned ? 'border-amber-400/50' : 'border-slate-200/60 dark:border-navy-600/60'}`}
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
                            className={`w-full text-[11px] px-2 py-1 rounded-md bg-slate-50/70 dark:bg-navy-800/70 border text-slate-600 dark:text-slate-300 focus:outline-none focus:border-c-focus-solid ${itemUnowned ? 'border-amber-400/50' : 'border-slate-200/60 dark:border-navy-600/60'}`}
                            placeholder={isPolish ? 'Imię i nazwisko...' : 'Name...'}
                          />
                        )}
                      </div>

                      {/* Due Date */}
                      <div className="space-y-1">
                        <span
                          className={`text-[10px] uppercase tracking-wide flex items-center gap-1 ${itemOverdue ? 'text-amber-500' : 'text-slate-600 dark:text-slate-500'}`}
                        >
                          <Calendar size={9} />
                          {isPolish ? 'Termin' : 'Due Date'}
                          {itemOverdue && (
                            <span className="text-[8px] normal-case">
                              ({isPolish ? 'po terminie!' : 'overdue!'})
                            </span>
                          )}
                        </span>
                        <input
                          type="date"
                          value={item.dueDate || ''}
                          onChange={(e) => onUpdateItem(item.id, { dueDate: e.target.value })}
                          readOnly={locked}
                          className={`w-full text-[11px] px-2 py-1 rounded-md bg-slate-50/70 dark:bg-navy-800/70 border text-slate-600 dark:text-slate-300 focus:outline-none focus:border-c-focus-solid ${
                            itemOverdue
                              ? 'border-amber-400/60 text-amber-500 dark:text-amber-400'
                              : 'border-slate-200/60 dark:border-navy-600/60'
                          }`}
                        />
                      </div>

                      {/* Source */}
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase tracking-wide text-slate-600 dark:text-slate-500 flex items-center gap-1">
                          <Shield size={9} />
                          {isPolish ? 'Źródło' : 'Source'}
                        </span>
                        <input
                          value={item.source || ''}
                          onChange={(e) => onUpdateItem(item.id, { source: e.target.value })}
                          readOnly={locked}
                          className="w-full text-[11px] px-2 py-1 rounded-md bg-slate-50/70 dark:bg-navy-800/70 border border-slate-200/60 dark:border-navy-600/60 text-slate-600 dark:text-slate-300 focus:outline-none focus:border-c-focus-solid"
                          placeholder={
                            isPolish
                              ? 'np. spotkanie, audyt, AI, warsztat'
                              : 'e.g. meeting, audit, AI, workshop'
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
                          <span className="text-[10px] uppercase tracking-wide text-slate-600 dark:text-slate-500">
                            {isPolish ? 'Plan awaryjny (contingency)' : 'Contingency Plan'}
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
                          rows={3}
                          readOnly={locked}
                          className="w-full min-h-[72px] text-xs bg-transparent border-b border-slate-200/60 dark:border-navy-700/60 text-slate-500 dark:text-slate-400 focus:outline-none focus:border-c-focus-solid resize-y"
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
                              className="px-1.5 py-0.5 rounded border border-danger-400/30 text-danger-500 dark:text-danger-400 text-[10px] hover:bg-danger-500/10 transition-colors disabled:opacity-40"
                            >
                              +{arg}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Mitigation */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase tracking-wide text-slate-600 dark:text-slate-500">
                            {isPolish ? 'Plan mitigacji' : 'Mitigation Plan'}
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
                          rows={3}
                          readOnly={locked}
                          className="w-full min-h-[72px] text-xs bg-transparent border-b border-slate-200/60 dark:border-navy-700/60 text-slate-500 dark:text-slate-400 focus:outline-none focus:border-c-focus-solid resize-y"
                          placeholder={
                            isPolish
                              ? 'Jak ograniczamy prawdopodobieństwo tego ryzyka?'
                              : 'How do we reduce the probability of this risk?'
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
                      <span className="text-[10px] uppercase tracking-wide text-slate-600 dark:text-slate-500">
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
                      className="w-full min-h-[72px] text-xs bg-transparent border-b border-slate-200/60 dark:border-navy-700/60 text-slate-500 dark:text-slate-400 focus:outline-none focus:border-c-focus-solid resize-y"
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
                          className={`px-1.5 py-0.5 rounded border text-[10px] transition-colors disabled:opacity-40 ${
                            item.type === 'risk'
                              ? 'border-amber-400/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10'
                              : item.type === 'assumption'
                                ? 'border-blue-400/30 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10'
                                : item.type === 'issue'
                                  ? 'border-danger-400/30 text-danger-600 dark:text-danger-400 hover:bg-danger-500/10'
                                  : 'border-primary-400/30 text-primary-600 dark:text-primary-400 hover:bg-primary-500/10'
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
