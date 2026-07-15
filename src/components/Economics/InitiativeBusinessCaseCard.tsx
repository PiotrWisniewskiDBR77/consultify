/**
 * InitiativeBusinessCaseCard — thin UI consumer of the previously-orphaned
 * `POST /api/v8/advisory/business-case` endpoint (Oxford O4 wiring).
 *
 * The server runs BusinessCaseService's 5-phase pipeline
 * (PLAN → CONFIRM → MODEL → REVIEW → NARRATIVE) SYNCHRONOUSLY and returns the
 * whole `BusinessCaseGenerationResult` in one response, so this is a ONE-SHOT
 * flow: the user describes the decision, hits Generate, and the card renders
 * the deterministic financial model + the W2 narrative. There is no
 * client-driven PLAN→CONFIRM dialog (a future interactive follow-up).
 *
 * ZERO fabrication: every number shown here comes verbatim from the endpoint
 * result — the component computes nothing. `narrativeCheck.unverifiedNumbers`
 * and `llmReviewIssues` (both from the server's own anti-fabrication pass) are
 * surfaced as-is so a reviewer can see the pipeline's self-assessment.
 *
 * Gated behind `isBusinessCaseAdvisoryEnabled()` (default OFF) — the parent
 * renders nothing when the flag is off (see InitiativeDetailModal economics
 * tab). Per CLAUDE.md rule #7 this ships OFF until owner acceptance on
 * screenshots.
 */

import { AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  type BusinessCaseGenerationResult,
  type BusinessCaseScenarioResult,
  generateBusinessCase,
} from '../../services/api/v8/advisory';
import { Button } from '../ui/primitives/Button';

interface InitiativeSeed {
  id?: string;
  name?: string;
  problem?: string;
  costCapex?: number;
  costOpex?: number;
  annualBenefit?: number;
}

interface Props {
  initiative: InitiativeSeed;
  projectId?: string;
}

function fmtNumber(n: number, currency: string): string {
  const rounded = Math.round(n).toLocaleString('pl-PL');
  return `${rounded} ${currency}`;
}

function fmtPct(n: number | null): string {
  if (n === null || n === undefined) return '—';
  return `${n.toFixed(1)}%`;
}

function fmtYears(n: number | null, suffix: string): string {
  if (n === null || n === undefined) return '—';
  return `${n.toFixed(2)} ${suffix}`;
}

export const InitiativeBusinessCaseCard: React.FC<Props> = ({ initiative, projectId }) => {
  const { t, i18n } = useTranslation();
  const language = i18n.language === 'pl' ? 'pl' : 'en';

  const defaultPrompt = useMemo(() => {
    const parts: string[] = [];
    if (initiative.name) parts.push(initiative.name);
    if (initiative.problem) parts.push(initiative.problem);
    return parts.join(' — ');
  }, [initiative.name, initiative.problem]);

  const [prompt, setPrompt] = useState(defaultPrompt);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BusinessCaseGenerationResult | null>(null);

  const handleGenerate = async () => {
    const trimmed = prompt.trim();
    if (!trimmed) {
      setError(t('businessCase.errorPromptRequired'));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await generateBusinessCase({
        prompt: trimmed,
        language,
        projectId,
      });
      setResult(res);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message || t('businessCase.errorGeneric'));
    } finally {
      setLoading(false);
    }
  };

  const model = result?.model;
  const wacc = result?.waccResolution;
  const scenarios: BusinessCaseScenarioResult[] = model?.scenarios ?? [];
  const criticalIssues = (result?.llmReviewIssues ?? []).filter((i) => i.severity === 'critical');
  const unverified = result?.narrativeCheck?.unverifiedNumbers ?? [];

  return (
    <div className="bg-c-surface-raised dark:bg-c-bg rounded-xl p-6 border border-c-border-subtle">
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div>
          <h3 className="text-lg font-bold text-c-text flex items-center gap-2">
            <Sparkles size={18} className="text-c-accent" />
            {t('businessCase.title')}
          </h3>
          <p className="text-xs text-c-text-muted mt-1">{t('businessCase.subtitle')}</p>
        </div>
      </div>

      {/* Prompt */}
      <label className="block text-xs font-medium text-c-text-muted mb-1.5">
        {t('businessCase.promptLabel')}
      </label>
      <textarea
        className="w-full bg-c-surface dark:bg-c-bg border border-c-border-subtle rounded-lg p-3 text-c-text text-sm focus:border-c-focus outline-none resize-y min-h-[80px]"
        placeholder={t('businessCase.promptPlaceholder')}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        disabled={loading}
      />

      <div className="flex items-center gap-3 mt-3">
        <Button
          variant="primary"
          size="md"
          onClick={handleGenerate}
          loading={loading}
          icon={<Sparkles />}
        >
          {loading ? t('businessCase.generating') : t('businessCase.generate')}
        </Button>
        {loading && (
          <span className="text-xs text-c-text-muted" role="status" aria-live="polite">
            {t('businessCase.pipelineHint')}
          </span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 flex items-start gap-2 text-c-danger text-sm bg-[color-mix(in_srgb,var(--c-danger)_12%,transparent)] p-3 rounded-lg border border-c-danger/30">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Result */}
      {result && model && (
        <div className="mt-6 space-y-6">
          {/* KPI row — deterministic model output (base case) */}
          <div>
            <div className="text-xs uppercase tracking-wide text-c-text-muted mb-2">
              {t('businessCase.baseCase')}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-c-surface dark:bg-c-surface-raised rounded-lg p-3 border border-c-border-subtle">
                <div className="text-[11px] uppercase text-c-text-muted">
                  {t('businessCase.npv')}
                </div>
                <div className="text-c-text font-mono text-sm font-bold mt-1">
                  {fmtNumber(model.base.npv, model.currency)}
                </div>
              </div>
              <div className="bg-c-surface dark:bg-c-surface-raised rounded-lg p-3 border border-c-border-subtle">
                <div className="text-[11px] uppercase text-c-text-muted">
                  {t('businessCase.irr')}
                </div>
                <div className="text-c-text font-mono text-sm font-bold mt-1">
                  {fmtPct(model.base.irrPct)}
                </div>
              </div>
              <div className="bg-c-surface dark:bg-c-surface-raised rounded-lg p-3 border border-c-border-subtle">
                <div className="text-[11px] uppercase text-c-text-muted">
                  {t('businessCase.payback')}
                </div>
                <div className="text-c-text font-mono text-sm font-bold mt-1">
                  {fmtYears(model.base.paybackYears, t('businessCase.yearsSuffix'))}
                </div>
              </div>
              <div className="bg-c-surface dark:bg-c-surface-raised rounded-lg p-3 border border-c-border-subtle">
                <div className="text-[11px] uppercase text-c-text-muted">
                  {t('businessCase.roi')}
                </div>
                <div className="text-c-text font-mono text-sm font-bold mt-1">
                  {fmtPct(model.base.roiPct)}
                </div>
              </div>
            </div>
            <div className="text-[11px] text-c-text-muted mt-2">
              {t('businessCase.modelParams', {
                wacc: model.waccPct,
                horizon: model.horizonYears,
                currency: model.currency,
              })}
            </div>
          </div>

          {/* WACC provenance — never an LLM guess */}
          {wacc && (
            <div className="text-xs text-c-text-muted bg-c-surface dark:bg-c-surface-raised rounded-lg p-3 border border-c-border-subtle">
              <span className="font-medium text-c-text">{t('businessCase.waccSourceLabel')}: </span>
              {wacc.source === 'client'
                ? t('businessCase.waccSourceClient')
                : t('businessCase.waccSourceIndustry', { label: wacc.guidance.label[language] })}
              {'. '}
              {wacc.grade.note[language]}
            </div>
          )}

          {/* Scenarios */}
          {scenarios.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wide text-c-text-muted mb-2">
                {t('businessCase.scenarios')}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-left text-[11px] uppercase text-c-text-muted border-b border-c-border-subtle">
                      <th className="py-2 pr-3 font-medium">{t('businessCase.scenario')}</th>
                      <th className="py-2 px-3 font-medium text-right">{t('businessCase.npv')}</th>
                      <th className="py-2 px-3 font-medium text-right">{t('businessCase.irr')}</th>
                      <th className="py-2 px-3 font-medium text-right">
                        {t('businessCase.payback')}
                      </th>
                      <th className="py-2 pl-3 font-medium text-right">{t('businessCase.roi')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scenarios.map((s) => (
                      <tr key={s.key} className="border-b border-c-border-subtle/60">
                        <td className="py-2 pr-3 text-c-text">{s.name}</td>
                        <td className="py-2 px-3 text-right font-mono text-c-text">
                          {fmtNumber(s.npv, model.currency)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-c-text">
                          {fmtPct(s.irrPct)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-c-text">
                          {fmtYears(s.paybackYears, t('businessCase.yearsSuffix'))}
                        </td>
                        <td className="py-2 pl-3 text-right font-mono text-c-text">
                          {fmtPct(s.roiPct)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Narrative (W2 recommendation) */}
          {result.narrative && (
            <div>
              <div className="text-xs uppercase tracking-wide text-c-text-muted mb-2">
                {t('businessCase.recommendation')}
              </div>
              <div className="text-sm text-c-text whitespace-pre-wrap leading-relaxed bg-c-surface dark:bg-c-surface-raised rounded-lg p-4 border border-c-border-subtle">
                {result.narrative}
              </div>
            </div>
          )}

          {/* Anti-fabrication self-assessment from the pipeline */}
          {(criticalIssues.length > 0 || unverified.length > 0) && (
            <div className="flex items-start gap-2 text-c-warning text-xs bg-[color-mix(in_srgb,var(--c-warning)_14%,transparent)] p-3 rounded-lg border border-c-warning/30">
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                {unverified.length > 0 && (
                  <div>{t('businessCase.unverifiedNumbers', { list: unverified.join(', ') })}</div>
                )}
                {criticalIssues.map((issue, idx) => (
                  <div key={idx}>{issue.description}</div>
                ))}
              </div>
            </div>
          )}
          {criticalIssues.length === 0 && unverified.length === 0 && result.narrativeCheck && (
            <div className="flex items-center gap-2 text-c-success text-xs">
              <CheckCircle2 size={14} />
              {t('businessCase.numbersConsistent')}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default InitiativeBusinessCaseCard;
