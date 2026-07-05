/**
 * ConclusionReadout — single-conclusion readout detail.
 *
 * Renders the full governance record for one conclusion: verdict headline +
 * rationale, confidence/status, the evidence trail (with excerpts and jump links
 * to the originating tool session / assessment), stated limits, the recommended
 * next action, the captured source-pack context, and any downstream conversions
 * (e.g. a report generated from this conclusion).
 *
 * Tokens: var(--c-*) only. No crimson / primary in the readout chrome.
 */

import { ArrowLeft, ArrowUpRight, Link2, ShieldCheck } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { ConclusionDetail } from '@/services/api/conclusions.api';

import {
  confidenceLabel,
  confidenceTone,
  sourceLabel,
  sourceTone,
  statusLabel,
  statusTone,
} from './conclusionMeta';

const Chip: React.FC<{ tone: string; children: React.ReactNode }> = ({ tone, children }) => (
  <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${tone}`}>
    {children}
  </span>
);

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--c-text-muted)]">
    {children}
  </div>
);

export const ConclusionReadout: React.FC<{
  detail: ConclusionDetail;
  onBack: () => void;
}> = ({ detail, onBack }) => {
  const { t } = useTranslation();
  const { conclusion, sourcePack, conversions } = detail;

  return (
    <div className="mx-auto max-w-3xl">
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--c-text-secondary)] hover:text-[var(--c-text)]"
      >
        <ArrowLeft size={16} aria-hidden />
        {t('conclusions.backToList', 'All conclusions')}
      </button>

      {/* Verdict header */}
      <div className="rounded-xl border border-[var(--c-border-subtle)] bg-[var(--c-surface)] p-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Chip tone={sourceTone(conclusion.sourceModule)}>
            {sourceLabel(t, conclusion.sourceModule)}
          </Chip>
          <Chip tone={confidenceTone(conclusion.confidenceLevel)}>
            {confidenceLabel(t, conclusion.confidenceLevel)}
          </Chip>
          <Chip tone={statusTone(conclusion.status)}>{statusLabel(t, conclusion.status)}</Chip>
        </div>
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--c-accent)]">
          {t('conclusions.verdict', 'Verdict')}
        </div>
        <h1 className="mb-3 text-xl font-bold leading-snug text-[var(--c-text)]">
          {conclusion.title}
        </h1>
        <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--c-text-secondary)]">
          {conclusion.statement}
        </p>
      </div>

      {/* Recommended next action */}
      {conclusion.recommendedNextAction && (
        <div className="mt-4 rounded-xl border border-[var(--c-border-subtle)] bg-[var(--c-surface)] p-6">
          <SectionTitle>{t('conclusions.nextAction', 'Recommended next action')}</SectionTitle>
          <p className="text-sm leading-relaxed text-[var(--c-text-secondary)]">
            {conclusion.recommendedNextAction}
          </p>
        </div>
      )}

      {/* Evidence trail */}
      <div className="mt-4 rounded-xl border border-[var(--c-border-subtle)] bg-[var(--c-surface)] p-6">
        <SectionTitle>{t('conclusions.evidence', 'Evidence')}</SectionTitle>
        {conclusion.evidenceRefs.length === 0 ? (
          <p className="text-sm text-[var(--c-text-muted)]">
            {t('conclusions.noEvidence', 'No evidence attached to this conclusion yet.')}
          </p>
        ) : (
          <ul className="space-y-2">
            {conclusion.evidenceRefs.map((ev, idx) => (
              <li
                key={`${ev.ref}-${idx}`}
                className="rounded-lg border border-[var(--c-border-subtle)] bg-[var(--c-surface-raised)] p-3"
              >
                <div className="mb-0.5 flex items-center gap-1.5 text-xs font-medium text-[var(--c-text-secondary)]">
                  <ShieldCheck size={13} aria-hidden />
                  {ev.type}
                </div>
                {ev.excerpt && (
                  <p className="text-sm leading-relaxed text-[var(--c-text)]">{ev.excerpt}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Limits */}
      <div className="mt-4 rounded-xl border border-[var(--c-border-subtle)] bg-[var(--c-surface)] p-6">
        <SectionTitle>{t('conclusions.limits', 'Limits & caveats')}</SectionTitle>
        <p className="text-sm leading-relaxed text-[var(--c-text-secondary)]">
          {conclusion.limits}
        </p>
      </div>

      {/* Source links */}
      {conclusion.sourceArtifactRefs.length > 0 && (
        <div className="mt-4 rounded-xl border border-[var(--c-border-subtle)] bg-[var(--c-surface)] p-6">
          <SectionTitle>{t('conclusions.sources', 'Sources')}</SectionTitle>
          <ul className="space-y-2">
            {conclusion.sourceArtifactRefs.map((ref, idx) => {
              const label = ref.title || ref.id;
              const inner = (
                <span className="inline-flex items-center gap-1.5">
                  <Link2 size={14} aria-hidden />
                  <span className="truncate">{label}</span>
                  {ref.url && <ArrowUpRight size={13} aria-hidden />}
                </span>
              );
              return (
                <li key={`${ref.id}-${idx}`} className="text-sm">
                  {ref.url ? (
                    <a
                      href={ref.url}
                      className="font-medium text-[var(--c-accent)] hover:underline"
                    >
                      {inner}
                    </a>
                  ) : (
                    <span className="text-[var(--c-text-secondary)]">{inner}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Captured context (source pack) */}
      {sourcePack?.contextSummary && (
        <div className="mt-4 rounded-xl border border-[var(--c-border-subtle)] bg-[var(--c-surface)] p-6">
          <SectionTitle>{t('conclusions.context', 'Captured context')}</SectionTitle>
          <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--c-text-secondary)]">
            {sourcePack.contextSummary}
          </p>
        </div>
      )}

      {/* Downstream conversions */}
      {conversions.length > 0 && (
        <div className="mt-4 rounded-xl border border-[var(--c-border-subtle)] bg-[var(--c-surface)] p-6">
          <SectionTitle>
            {t('conclusions.conversions', 'Generated from this conclusion')}
          </SectionTitle>
          <ul className="space-y-1.5">
            {conversions.map((conv) => (
              <li
                key={conv.id}
                className="flex items-center justify-between gap-2 text-sm text-[var(--c-text-secondary)]"
              >
                <span>{conv.sourceArtifactTitle || conv.conversionIntent}</span>
                <Chip tone={statusTone(conv.conversionStatus)}>{conv.conversionStatus}</Chip>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
