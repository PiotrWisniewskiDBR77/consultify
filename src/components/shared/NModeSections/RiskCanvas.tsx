/**
 * RiskCanvas
 *
 * Generic N-mode section for risk assessment / risk register.
 * Reusable across all artifact types (Decision, Task, Initiative).
 *
 * Shows:
 * - Risk cards with probability/impact/category selectors
 * - Risk score badge (P×I)
 * - Contingency + mitigation textareas with quick-action buttons
 * - AIFieldEnhancer per risk field
 * - Level legend, sorted by score
 *
 * @see docs/ui-standards/02-components/shared-sections.md
 */

import { AlertTriangle, Loader2, Plus, Sparkles, X } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { AIFieldEnhancer } from '@/components/shared/AIFieldEnhancer';

// ── Types ───────────────────────────────────────────────────────────────────

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type RiskCategory =
  | 'technical'
  | 'business'
  | 'operational'
  | 'financial'
  | 'security'
  | 'legal'
  | 'other';

export interface RiskItem {
  id: string;
  title: string;
  probability: RiskLevel;
  impact: RiskLevel;
  category?: string;
  mitigation: string;
  contingency: string;
}

export interface RiskCanvasProps {
  /** Risk items (unsorted — component sorts by score internally) */
  risks: RiskItem[];
  /** Add new empty risk */
  onAddRisk: () => void;
  /** Update fields on a risk */
  onUpdateRisk: (id: string, updates: Partial<RiskItem>) => void;
  /** Remove a risk by id */
  onRemoveRisk: (id: string) => void;
  /** AI generate risks handler (omit to hide AI button) */
  onAIGenerate?: () => void;
  /** Whether AI generation is in progress */
  isGeneratingAI?: boolean;
  /** Whether inputs are locked/read-only (e.g. decision stage lock) */
  locked?: boolean;
  /** Artifact type for AIFieldEnhancer context */
  artifactType: 'task' | 'decision' | 'initiative' | 'notification';
  /** Artifact context for AIFieldEnhancer */
  artifactContext: { title: string; status: string; priority: string; type: string };
  /** Unique prefix for AI field keys (e.g. 't' for task, 'n' for decision) */
  fieldKeyPrefix: string;
}

// ── Utility functions (pure, no hooks) ──────────────────────────────────────

const RISK_LEVEL_OPTIONS: readonly RiskLevel[] = ['low', 'medium', 'high', 'critical'];

const riskLevelToScore = (level?: string): number => {
  const n = String(level || '').toLowerCase();
  if (n === 'critical') return 4;
  if (n === 'high') return 3;
  if (n === 'medium') return 2;
  return 1;
};

export const getRiskScore = (risk: RiskItem): number =>
  riskLevelToScore(risk.probability) * riskLevelToScore(risk.impact);

const getRiskScoreClass = (score: number): string => {
  if (score >= 12)
    return 'text-danger-600 dark:text-danger-400 bg-danger-500/10 border-danger-500/30';
  if (score >= 8) return 'text-amber-700 dark:text-amber-300 bg-amber-500/10 border-amber-500/30';
  if (score >= 4)
    return 'text-yellow-700 dark:text-yellow-300 bg-yellow-500/10 border-yellow-500/30';
  return 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/30';
};

const getRiskLevelClass = (level?: string): string => {
  const n = String(level || '').toLowerCase();
  if (n === 'critical')
    return 'border-danger-500/60 bg-danger-500/10 text-danger-700 dark:text-danger-300';
  if (n === 'high') return 'border-amber-500/55 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  if (n === 'medium')
    return 'border-amber-500/55 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  return 'border-emerald-500/45 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
};

// ── Component ───────────────────────────────────────────────────────────────

export const RiskCanvas: React.FC<RiskCanvasProps> = ({
  risks,
  onAddRisk,
  onUpdateRisk,
  onRemoveRisk,
  onAIGenerate,
  isGeneratingAI = false,
  locked = false,
  artifactContext,
  fieldKeyPrefix,
}) => {
  const { t } = useTranslation();

  // i18n labels for levels
  const getRiskLevelLabel = (level: string): string => {
    const known = ['critical', 'high', 'medium', 'low'];
    const key = known.includes(level) ? level : 'low';
    return t(`sharedComponents.riskCanvas.levelLabel.${key}`);
  };

  // i18n labels for categories
  const riskCategoryOptions = useMemo(
    () =>
      ['technical', 'business', 'financial', 'operational', 'security'].map((c) => ({
        value: c,
        label: t(`sharedComponents.riskCanvas.categoryLabel.${c}`),
      })),
    [t]
  );

  const quickContingencyArguments = useMemo(
    () =>
      t('sharedComponents.riskCanvas.quickContingencyArgs', { returnObjects: true }) as string[],
    [t]
  );

  const quickMitigationArguments = useMemo(
    () => t('sharedComponents.riskCanvas.quickMitigationArgs', { returnObjects: true }) as string[],
    [t]
  );

  const sortedRisks = useMemo(
    () =>
      [...risks].sort((a, b) => {
        const byScore = getRiskScore(b) - getRiskScore(a);
        if (byScore !== 0) return byScore;
        return String(a.title || '').localeCompare(String(b.title || ''));
      }),
    [risks]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-c-text dark:text-white">
          {t('sharedComponents.riskCanvas.riskImpact')}
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={onAddRisk}
            disabled={locked}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-c-border/60 dark:border-c-border-strong/50 text-c-text-secondary dark:text-c-text-secondary hover:text-c-text dark:hover:text-c-text-muted hover:border-c-border-strong dark:hover:border-c-border-strong hover:bg-c-surface dark:hover:bg-c-surface-raised/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={13} />
            {t('sharedComponents.riskCanvas.addRisk')}
          </button>
          {onAIGenerate && (
            <button
              onClick={onAIGenerate}
              disabled={locked || isGeneratingAI}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-c-info hover:bg-c-surface-raised transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isGeneratingAI ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Sparkles size={13} />
              )}
              {t('sharedComponents.riskCanvas.analyzeRisks')}
            </button>
          )}
        </div>
      </div>

      {/* Empty state */}
      {risks.length === 0 ? (
        <div className="py-8 text-center">
          <AlertTriangle
            size={24}
            className="mx-auto mb-2 text-c-text-secondary dark:text-c-text-secondary"
          />
          <p className="text-sm text-c-text-secondary dark:text-c-text-muted mb-3">
            {t('sharedComponents.riskCanvas.noRisksIdentified')}
          </p>
          <button
            onClick={onAddRisk}
            disabled={locked}
            className="text-xs font-medium text-c-text-muted hover:text-c-text transition-colors disabled:opacity-40"
          >
            + {t('sharedComponents.riskCanvas.addRisk')}
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between text-[11px] text-c-text-secondary dark:text-c-text-muted">
          <span>{t('sharedComponents.riskCanvas.sortedByHighestRiskScorePI')}</span>
          <span>{t('sharedComponents.riskCanvas.riskCount', { count: risks.length })}</span>
        </div>
      )}

      {/* Risk cards */}
      {risks.length > 0 && (
        <div className="space-y-0 divide-y divide-c-border-strong/55 dark:divide-c-border-strong/65">
          {/* Level legend */}
          <div className="py-2 text-[10px] flex flex-wrap items-center gap-1.5 text-c-text-secondary dark:text-c-text-muted">
            <span>{t('sharedComponents.riskCanvas.levelLegend')}</span>
            {RISK_LEVEL_OPTIONS.map((level) => (
              <span
                key={`legend-${level}`}
                className={`px-1.5 py-0.5 rounded border font-medium ${getRiskLevelClass(level)}`}
              >
                {getRiskLevelLabel(level)}
              </span>
            ))}
          </div>

          {/* Risk items */}
          {sortedRisks.map((risk) => (
            <div key={risk.id} className="py-5 first:pt-2 group">
              <div className="p-5 rounded-xl bg-c-surface/20 dark:bg-c-surface/25 space-y-5">
                {/* Title + Score + Selectors */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <input
                      value={risk.title}
                      onChange={(e) => onUpdateRisk(risk.id, { title: e.target.value })}
                      readOnly={locked}
                      className="flex-1 text-sm font-medium bg-transparent text-c-text dark:text-white focus:outline-none placeholder-c-text-muted"
                      placeholder={t('sharedComponents.riskCanvas.riskName')}
                    />
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold ${getRiskScoreClass(getRiskScore(risk))}`}
                      >
                        Score {getRiskScore(risk)}
                      </span>
                      <button
                        onClick={() => onRemoveRisk(risk.id)}
                        disabled={locked}
                        className="p-1 text-c-text-secondary hover:text-danger-500 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-0"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {/* Probability */}
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase tracking-wide text-c-text-secondary dark:text-c-text-muted">
                        {t('sharedComponents.riskCanvas.probability')}
                      </span>
                      <select
                        value={risk.probability}
                        onChange={(e) =>
                          onUpdateRisk(risk.id, { probability: e.target.value as RiskLevel })
                        }
                        disabled={locked}
                        className={`w-full text-[11px] px-2 py-1 rounded-md border focus:outline-none focus:border-c-focus-solid ${getRiskLevelClass(risk.probability)} disabled:opacity-60`}
                      >
                        {RISK_LEVEL_OPTIONS.map((level) => (
                          <option key={`p-${risk.id}-${level}`} value={level}>
                            {getRiskLevelLabel(level)}
                          </option>
                        ))}
                      </select>
                    </div>
                    {/* Impact */}
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase tracking-wide text-c-text-secondary dark:text-c-text-muted">
                        {t('sharedComponents.riskCanvas.impact')}
                      </span>
                      <select
                        value={risk.impact}
                        onChange={(e) =>
                          onUpdateRisk(risk.id, { impact: e.target.value as RiskLevel })
                        }
                        disabled={locked}
                        className={`w-full text-[11px] px-2 py-1 rounded-md border focus:outline-none focus:border-c-focus-solid ${getRiskLevelClass(risk.impact)} disabled:opacity-60`}
                      >
                        {RISK_LEVEL_OPTIONS.map((level) => (
                          <option key={`i-${risk.id}-${level}`} value={level}>
                            {getRiskLevelLabel(level)}
                          </option>
                        ))}
                      </select>
                    </div>
                    {/* Category */}
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase tracking-wide text-c-text-secondary dark:text-c-text-muted">
                        {t('sharedComponents.riskCanvas.category')}
                      </span>
                      <select
                        value={risk.category || 'business'}
                        onChange={(e) => onUpdateRisk(risk.id, { category: e.target.value })}
                        disabled={locked}
                        className="w-full text-[11px] px-2 py-1 rounded-md bg-c-surface/70 dark:bg-c-surface-raised/70 border border-c-border/60 dark:border-c-border-strong/60 text-c-text-secondary dark:text-c-text-secondary focus:outline-none focus:border-c-focus-solid disabled:opacity-60"
                      >
                        {riskCategoryOptions.map((cat) => (
                          <option key={`c-${risk.id}-${cat.value}`} value={cat.value}>
                            {cat.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Two columns: Contingency + Mitigation */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                  {/* Risk (materialized) / Contingency */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-wide text-c-text-secondary dark:text-c-text-muted">
                        {t('sharedComponents.riskCanvas.riskMaterialized')}
                      </span>
                      <AIFieldEnhancer
                        fieldKey={`${fieldKeyPrefix}-risk-con-${risk.id}`}
                        sectionLabel={`Risk contingency: ${risk.title || 'Risk'}`}
                        currentValue={risk.contingency || ''}
                        onApply={(value) => onUpdateRisk(risk.id, { contingency: value })}
                        artifactContext={artifactContext}
                        disabled={locked}
                      />
                    </div>
                    <textarea
                      value={risk.contingency || ''}
                      onChange={(e) => onUpdateRisk(risk.id, { contingency: e.target.value })}
                      rows={4}
                      readOnly={locked}
                      className="w-full min-h-[92px] text-xs bg-transparent border-b border-c-border/60 dark:border-c-border/60 text-c-text-secondary dark:text-c-text-secondary focus:outline-none focus:border-c-focus-solid resize-y"
                      placeholder={t(
                        'sharedComponents.riskCanvas.whatIsTheFallbackIfRiskMaterializes'
                      )}
                    />
                    <div className="flex flex-wrap gap-1">
                      {quickContingencyArguments.map((arg) => (
                        <button
                          key={`${risk.id}-con-${arg}`}
                          onClick={() =>
                            onUpdateRisk(risk.id, {
                              contingency: risk.contingency
                                ? `${risk.contingency}\n- ${arg}`
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
                      <span className="text-[10px] uppercase tracking-wide text-c-text-secondary dark:text-c-text-muted">
                        {t('sharedComponents.riskCanvas.mitigation')}
                      </span>
                      <AIFieldEnhancer
                        fieldKey={`${fieldKeyPrefix}-risk-mit-${risk.id}`}
                        sectionLabel={`Risk mitigation: ${risk.title || 'Risk'}`}
                        currentValue={risk.mitigation || ''}
                        onApply={(value) => onUpdateRisk(risk.id, { mitigation: value })}
                        artifactContext={artifactContext}
                        disabled={locked}
                      />
                    </div>
                    <textarea
                      value={risk.mitigation || ''}
                      onChange={(e) => onUpdateRisk(risk.id, { mitigation: e.target.value })}
                      rows={4}
                      readOnly={locked}
                      className="w-full min-h-[92px] text-xs bg-transparent border-b border-c-border/60 dark:border-c-border/60 text-c-text-secondary dark:text-c-text-secondary focus:outline-none focus:border-c-focus-solid resize-y"
                      placeholder={t('sharedComponents.riskCanvas.howDoWeMitigateThisRisk')}
                    />
                    <div className="flex flex-wrap gap-1">
                      {quickMitigationArguments.map((arg) => (
                        <button
                          key={`${risk.id}-mit-${arg}`}
                          onClick={() =>
                            onUpdateRisk(risk.id, {
                              mitigation: risk.mitigation
                                ? `${risk.mitigation}\n- ${arg}`
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
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bottom add button */}
      <button
        onClick={onAddRisk}
        disabled={locked}
        className="text-xs font-medium text-c-text-secondary dark:text-c-text-muted hover:text-c-text transition-colors disabled:opacity-40"
      >
        + {t('sharedComponents.riskCanvas.addRisk')}
      </button>
    </div>
  );
};

export default RiskCanvas;
