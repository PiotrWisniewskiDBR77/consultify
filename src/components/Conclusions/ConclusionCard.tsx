/**
 * ConclusionCard — one governed conclusion rendered per CARD_CONTENT_FORMULA.
 *
 * Answer-first: the verdict headline (title) leads, the rationale (statement) is
 * the body, evidence count + source origin are the proof, and a link to the
 * source artifact (tool session / assessment) closes the loop. Confidence and
 * status chips make the governance state legible at a glance.
 *
 * Tokens: var(--c-*) only. ZERO crimson / primary in the card chrome.
 */

import { ArrowUpRight, FileSearch } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { Conclusion } from '@/services/api/conclusions.api';

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

export const ConclusionCard: React.FC<{
  conclusion: Conclusion;
  onOpen: (id: string) => void;
}> = ({ conclusion, onOpen }) => {
  const { t } = useTranslation();
  const primarySource = conclusion.sourceArtifactRefs?.[0];
  const evidenceCount = conclusion.evidenceRefs?.length || 0;

  return (
    <button
      type="button"
      onClick={() => onOpen(conclusion.id)}
      className="group w-full rounded-xl border border-[var(--c-border-subtle)] bg-[var(--c-surface)] p-5 text-left transition-colors hover:border-[var(--c-border)] hover:bg-[var(--c-surface-raised)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)]"
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Chip tone={sourceTone(conclusion.sourceModule)}>
          {sourceLabel(t, conclusion.sourceModule)}
        </Chip>
        <Chip tone={confidenceTone(conclusion.confidenceLevel)}>
          {confidenceLabel(t, conclusion.confidenceLevel)}
        </Chip>
        <Chip tone={statusTone(conclusion.status)}>{statusLabel(t, conclusion.status)}</Chip>
      </div>

      {/* Verdict headline */}
      <h3 className="mb-1.5 text-base font-bold leading-snug text-[var(--c-text)]">
        {conclusion.title}
      </h3>

      {/* Rationale */}
      <p className="mb-3 line-clamp-3 text-sm leading-relaxed text-[var(--c-text-secondary)]">
        {conclusion.statement}
      </p>

      <div className="flex items-center justify-between gap-3 text-xs text-[var(--c-text-muted)]">
        <span className="inline-flex items-center gap-1.5">
          <FileSearch size={14} aria-hidden />
          {t('conclusions.evidenceCount', '{{count}} evidence', { count: evidenceCount })}
        </span>
        {primarySource && (
          <span className="inline-flex items-center gap-1 font-medium text-[var(--c-accent)] group-hover:underline">
            {t('conclusions.viewSource', 'Source')}
            <ArrowUpRight size={13} aria-hidden />
          </span>
        )}
      </div>
    </button>
  );
};
