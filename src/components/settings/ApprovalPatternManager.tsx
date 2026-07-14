/**
 * ApprovalPatternManager Component
 *
 * Settings panel for managing learned AI approval patterns.
 * Allows users to:
 * - View all learned patterns
 * - Toggle auto-apply per pattern
 * - Delete patterns to "forget" them
 * - View pattern statistics
 *
 * @version 1.0.0
 */

import {
  Brain,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Info,
  RefreshCw,
  Shield,
  ToggleLeft,
  ToggleRight,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/ui/composed';
import { LoadingState } from '@/components/ui/primitives';

import api from '../../services/api';

// ============================================================================
// Types
// ============================================================================

interface ApprovalPattern {
  id: string;
  action_type: string;
  decision: 'APPROVED' | 'REJECTED';
  decision_count: number;
  auto_apply: boolean;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  last_decision_at: string;
  created_at: string;
  payload_template?: any;
}

interface PatternStats {
  totalPatterns: number;
  autoEnabled: number;
  totalApprovals: number;
  totalRejections: number;
  avgDecisionsPerPattern: number;
}

// ============================================================================
// Component
// ============================================================================

export const ApprovalPatternManager: React.FC = () => {
  const { t, i18n } = useTranslation();
  const language = i18n.language?.startsWith('pl') ? 'pl' : 'en';

  const [patterns, setPatterns] = useState<ApprovalPattern[]>([]);
  const [stats, setStats] = useState<PatternStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedPatterns, setExpandedPatterns] = useState<Set<string>>(new Set());
  const [updatingPatterns, setUpdatingPatterns] = useState<Set<string>>(new Set());
  const [deletingPatterns, setDeletingPatterns] = useState<Set<string>>(new Set());

  // Fetch patterns and stats
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [patternsRes, statsRes] = await Promise.all([
        api.get('/ai/patterns'),
        api.get('/ai/patterns/stats'),
      ]);

      setPatterns(patternsRes.data?.patterns || []);
      setStats(statsRes.data || null);
    } catch (error) {
      console.error('[ApprovalPatternManager] Failed to fetch data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Toggle auto-apply
  const handleToggleAutoApply = async (patternId: string, currentValue: boolean) => {
    setUpdatingPatterns((prev) => new Set(prev).add(patternId));

    try {
      await api.patch(`/ai/patterns/${patternId}/auto-apply`, {
        enabled: !currentValue,
      });

      // Update local state
      setPatterns((prev) =>
        prev.map((p) => (p.id === patternId ? { ...p, auto_apply: !currentValue } : p))
      );

      // Update stats
      setStats((prev) =>
        prev
          ? {
              ...prev,
              autoEnabled: prev.autoEnabled + (currentValue ? -1 : 1),
            }
          : null
      );
    } catch (error) {
      console.error('[ApprovalPatternManager] Failed to toggle auto-apply:', error);
    } finally {
      setUpdatingPatterns((prev) => {
        const next = new Set(prev);
        next.delete(patternId);
        return next;
      });
    }
  };

  // Delete pattern
  const handleDeletePattern = async (patternId: string) => {
    if (
      !confirm(
        language === 'pl'
          ? 'Czy na pewno chcesz usunąć ten wzorzec? AI nie będzie już pamiętać tej decyzji.'
          : 'Are you sure you want to delete this pattern? AI will no longer remember this decision.'
      )
    ) {
      return;
    }

    setDeletingPatterns((prev) => new Set(prev).add(patternId));

    try {
      await api.delete(`/ai/patterns/${patternId}`);

      // Remove from local state
      setPatterns((prev) => prev.filter((p) => p.id !== patternId));

      // Update stats
      setStats((prev) =>
        prev
          ? {
              ...prev,
              totalPatterns: prev.totalPatterns - 1,
            }
          : null
      );
    } catch (error) {
      console.error('[ApprovalPatternManager] Failed to delete pattern:', error);
    } finally {
      setDeletingPatterns((prev) => {
        const next = new Set(prev);
        next.delete(patternId);
        return next;
      });
    }
  };

  // Toggle expanded
  const toggleExpanded = (patternId: string) => {
    setExpandedPatterns((prev) => {
      const next = new Set(prev);
      if (next.has(patternId)) {
        next.delete(patternId);
      } else {
        next.add(patternId);
      }
      return next;
    });
  };

  // Format action type for display
  const formatActionType = (type: string) => {
    return type.replace(/_/g, ' ').toLowerCase();
  };

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(language === 'pl' ? 'pl-PL' : 'en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Risk level badge
  const RiskBadge: React.FC<{ level: string }> = ({ level }) => {
    const colors = {
      LOW: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      MEDIUM: 'bg-amber-100 text-amber-700 border-amber-200',
      HIGH: 'bg-rose-100 text-rose-700 border-rose-200',
    };
    return (
      <span
        className={`px-2 py-0.5 text-[10px] font-bold rounded border ${colors[level as keyof typeof colors] || colors.LOW}`}
      >
        {level}
      </span>
    );
  };

  // Decision badge
  const DecisionBadge: React.FC<{ decision: string }> = ({ decision }) => {
    const isApproved = decision === 'APPROVED';
    return (
      <span
        className={`flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded ${
          isApproved ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
        }`}
      >
        {isApproved ? <Check size={12} /> : <X size={12} />}
        {isApproved
          ? language === 'pl'
            ? 'Akceptuj'
            : 'Approve'
          : language === 'pl'
            ? 'Odrzuć'
            : 'Reject'}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center">
            <Brain className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-c-text">
              {language === 'pl' ? 'Wzorce Zatwierdzania AI' : 'AI Approval Patterns'}
            </h2>
            <p className="text-sm text-c-text-muted">
              {language === 'pl'
                ? 'Zarządzaj nauczonymi wzorcami decyzji'
                : 'Manage learned decision patterns'}
            </p>
          </div>
        </div>

        <button
          onClick={fetchData}
          disabled={isLoading}
          className="p-2 text-c-text-muted hover:text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-c-surface-raised rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-c-surface-raised rounded-xl border border-c-border-subtle dark:border-navy-700">
            <div className="text-2xl font-bold text-c-text">{stats.totalPatterns}</div>
            <div className="text-xs text-c-text-muted flex items-center gap-1 mt-1">
              <Brain size={12} />
              {language === 'pl' ? 'Wzorców' : 'Patterns'}
            </div>
          </div>

          <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-500/20">
            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
              {stats.autoEnabled}
            </div>
            <div className="text-xs text-emerald-600 dark:text-emerald-500 flex items-center gap-1 mt-1">
              <TrendingUp size={12} />
              {language === 'pl' ? 'Automatycznych' : 'Auto-enabled'}
            </div>
          </div>

          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-500/20">
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
              {stats.totalApprovals}
            </div>
            <div className="text-xs text-blue-600 dark:text-blue-500 flex items-center gap-1 mt-1">
              <Check size={12} />
              {language === 'pl' ? 'Akceptacji' : 'Approvals'}
            </div>
          </div>

          <div className="p-4 bg-rose-50 dark:bg-rose-900/20 rounded-xl border border-rose-200 dark:border-rose-500/20">
            <div className="text-2xl font-bold text-rose-700 dark:text-rose-400">
              {stats.totalRejections}
            </div>
            <div className="text-xs text-rose-600 dark:text-rose-500 flex items-center gap-1 mt-1">
              <X size={12} />
              {language === 'pl' ? 'Odrzuceń' : 'Rejections'}
            </div>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-500/20">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-indigo-700 dark:text-indigo-300">
            <p className="font-medium mb-1">
              {language === 'pl' ? 'Jak działają wzorce?' : 'How do patterns work?'}
            </p>
            <p className="text-indigo-600 dark:text-indigo-400">
              {language === 'pl'
                ? 'System uczy się Twoich decyzji. Po 3 podobnych akceptacjach/odrzuceniach, może automatycznie podejmować takie same decyzje (jeśli włączysz auto-zatwierdzanie).'
                : 'The system learns from your decisions. After 3 similar approvals/rejections, it can automatically make the same decisions (if you enable auto-approve).'}
            </p>
          </div>
        </div>
      </div>

      {/* Patterns List */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-c-text-secondary uppercase tracking-wider">
          {language === 'pl' ? 'Nauczone Wzorce' : 'Learned Patterns'}
        </h3>

        {isLoading ? (
          <LoadingState variant="spinner" />
        ) : patterns.length === 0 ? (
          <EmptyState
            icon={<Brain />}
            title={
              language === 'pl'
                ? 'Brak nauczonych wzorców. Zatwierdzaj lub odrzucaj propozycje AI, aby system się uczył.'
                : 'No learned patterns yet. Approve or reject AI proposals to teach the system.'
            }
          />
        ) : (
          <div className="space-y-2">
            {patterns.map((pattern) => (
              <div
                key={pattern.id}
                className="bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 overflow-hidden"
              >
                {/* Pattern Header */}
                <div
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-c-surface-raised dark:hover:bg-c-surface-raised transition-colors"
                  onClick={() => toggleExpanded(pattern.id)}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <DecisionBadge decision={pattern.decision} />
                    <span className="font-medium text-c-text-secondary truncate">
                      {formatActionType(pattern.action_type)}
                    </span>
                    <RiskBadge level={pattern.risk_level} />
                    <span className="text-xs text-c-text-muted flex items-center gap-1">
                      <Clock size={12} />
                      {pattern.decision_count}x
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Auto-apply toggle */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleAutoApply(pattern.id, pattern.auto_apply);
                      }}
                      disabled={updatingPatterns.has(pattern.id)}
                      className={`flex items-center gap-2 px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                        pattern.auto_apply
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : 'bg-c-surface-raised text-c-text-muted'
                      } disabled:opacity-50`}
                    >
                      {updatingPatterns.has(pattern.id) ? (
                        <RefreshCw size={14} className="animate-spin" />
                      ) : pattern.auto_apply ? (
                        <ToggleRight size={14} />
                      ) : (
                        <ToggleLeft size={14} />
                      )}
                      {pattern.auto_apply
                        ? language === 'pl'
                          ? 'Auto'
                          : 'Auto'
                        : language === 'pl'
                          ? 'Ręcznie'
                          : 'Manual'}
                    </button>

                    {/* Delete button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePattern(pattern.id);
                      }}
                      disabled={deletingPatterns.has(pattern.id)}
                      className="p-2 text-c-text-secondary hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {deletingPatterns.has(pattern.id) ? (
                        <RefreshCw size={16} className="animate-spin" />
                      ) : (
                        <Trash2 size={16} />
                      )}
                    </button>

                    {/* Expand/collapse */}
                    {expandedPatterns.has(pattern.id) ? (
                      <ChevronUp size={18} className="text-c-text-secondary" />
                    ) : (
                      <ChevronDown size={18} className="text-c-text-secondary" />
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedPatterns.has(pattern.id) && (
                  <div className="px-4 pb-4 border-t border-c-border-subtle dark:border-navy-700 pt-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-c-text-muted text-xs">
                          {language === 'pl' ? 'Liczba decyzji' : 'Decision count'}
                        </span>
                        <p className="font-semibold text-c-text-secondary">
                          {pattern.decision_count}
                        </p>
                      </div>
                      <div>
                        <span className="text-c-text-muted text-xs">
                          {language === 'pl' ? 'Ostatnia decyzja' : 'Last decision'}
                        </span>
                        <p className="font-semibold text-c-text-secondary">
                          {formatDate(pattern.last_decision_at)}
                        </p>
                      </div>
                      <div>
                        <span className="text-c-text-muted text-xs">
                          {language === 'pl' ? 'Utworzono' : 'Created'}
                        </span>
                        <p className="font-semibold text-c-text-secondary">
                          {formatDate(pattern.created_at)}
                        </p>
                      </div>
                      <div>
                        <span className="text-c-text-muted text-xs">
                          {language === 'pl' ? 'Poziom ryzyka' : 'Risk level'}
                        </span>
                        <p className="font-semibold text-c-text-secondary">{pattern.risk_level}</p>
                      </div>
                    </div>

                    {pattern.auto_apply && (
                      <div className="mt-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                        <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
                          <Shield size={14} />
                          <span className="font-medium">
                            {language === 'pl'
                              ? 'Auto-zatwierdzanie włączone'
                              : 'Auto-approve enabled'}
                          </span>
                        </div>
                        <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-1">
                          {language === 'pl'
                            ? `Podobne akcje będą automatycznie ${pattern.decision === 'APPROVED' ? 'akceptowane' : 'odrzucane'}.`
                            : `Similar actions will be automatically ${pattern.decision.toLowerCase()}.`}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ApprovalPatternManager;
