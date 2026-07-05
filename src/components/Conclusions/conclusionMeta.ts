/**
 * Conclusion presentation metadata — source / confidence / status labels and tones.
 *
 * The Conclusions layer aggregates verdicts from heterogeneous origins (discovery
 * tools, SIRI/ADMA assessments, interview findings). This module centralizes the
 * bilingual labels and token-driven tones so the list card and the readout view
 * stay consistent. Colors use the app CSS token layer (var(--c-*)) only — no
 * crimson / primary leakage into conclusion visualizations.
 */

import type { TFunction } from 'i18next';

/** Map the server `sourceModule` string to a stable i18n key + fallback label. */
export function sourceLabel(t: TFunction, sourceModule: string): string {
  const key = String(sourceModule || '').toLowerCase();
  const map: Record<string, [string, string]> = {
    tool: ['conclusions.source.tool', 'Discovery tool'],
    tools: ['conclusions.source.tool', 'Discovery tool'],
    assessment: ['conclusions.source.assessment', 'Assessment'],
    assessment_siri: ['conclusions.source.siri', 'SIRI assessment'],
    assessment_adma: ['conclusions.source.adma', 'ADMA assessment'],
    interview: ['conclusions.source.interview', 'Interview'],
    wnioski: ['conclusions.source.readout', 'Readout'],
  };
  const [i18nKey, fallback] = map[key] || ['conclusions.source.other', sourceModule || 'Other'];
  return t(i18nKey, fallback);
}

/** Tailwind token classes for a source chip (neutral, no crimson). */
export function sourceTone(_sourceModule: string): string {
  return 'bg-[var(--c-surface-raised)] text-[var(--c-text-secondary)] border border-[var(--c-border-subtle)]';
}

export type ConfidenceKey = 'high' | 'medium' | 'low' | 'insufficient' | 'contradicted';

export function normalizeConfidence(raw: string | null | undefined): ConfidenceKey {
  const v = String(raw || 'insufficient').toLowerCase();
  return (['high', 'medium', 'low', 'insufficient', 'contradicted'] as const).includes(
    v as ConfidenceKey
  )
    ? (v as ConfidenceKey)
    : 'insufficient';
}

export function confidenceLabel(t: TFunction, raw: string | null | undefined): string {
  const key = normalizeConfidence(raw);
  const fallback: Record<ConfidenceKey, string> = {
    high: 'High confidence',
    medium: 'Medium confidence',
    low: 'Low confidence',
    insufficient: 'Insufficient evidence',
    contradicted: 'Contradicted',
  };
  return t(`conclusions.confidence.${key}`, fallback[key]);
}

/** Confidence chip tone — success/accent/warning/danger via tokens, no crimson. */
export function confidenceTone(raw: string | null | undefined): string {
  const key = normalizeConfidence(raw);
  const map: Record<ConfidenceKey, string> = {
    high: 'bg-c-success/12 text-[var(--c-success)]',
    medium: 'bg-[var(--c-accent-soft)] text-[var(--c-accent)]',
    low: 'bg-c-warning/12 text-[var(--c-warning)]',
    insufficient: 'bg-[var(--c-surface-raised)] text-[var(--c-text-muted)]',
    contradicted: 'bg-c-danger/12 text-[var(--c-danger)]',
  };
  return map[key];
}

export type StatusKey =
  | 'candidate'
  | 'needs_evidence'
  | 'needs_review'
  | 'ready_for_readout'
  | 'published'
  | 'converted'
  | 'rejected';

export function statusLabel(t: TFunction, raw: string | null | undefined): string {
  const key = String(raw || 'candidate') as StatusKey;
  const fallback: Record<string, string> = {
    candidate: 'Candidate',
    needs_evidence: 'Needs evidence',
    needs_review: 'Needs review',
    ready_for_readout: 'Ready for readout',
    published: 'Published',
    converted: 'Converted',
    rejected: 'Rejected',
  };
  return t(`conclusions.status.${key}`, fallback[key] || key);
}

export function statusTone(raw: string | null | undefined): string {
  const key = String(raw || 'candidate');
  const map: Record<string, string> = {
    published: 'bg-c-success/12 text-[var(--c-success)]',
    ready_for_readout: 'bg-[var(--c-accent-soft)] text-[var(--c-accent)]',
    converted: 'bg-[var(--c-accent-soft)] text-[var(--c-accent)]',
    needs_review: 'bg-c-warning/12 text-[var(--c-warning)]',
    needs_evidence: 'bg-c-warning/12 text-[var(--c-warning)]',
    rejected: 'bg-c-danger/12 text-[var(--c-danger)]',
    candidate: 'bg-[var(--c-surface-raised)] text-[var(--c-text-secondary)]',
  };
  return map[key] || map.candidate;
}
