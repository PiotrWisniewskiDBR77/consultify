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
    audit: ['conclusions.source.audit', 'Audit'],
    audits: ['conclusions.source.audit', 'Audit'],
    wnioski: ['conclusions.source.readout', 'Readout'],
  };
  const [i18nKey, fallback] = map[key] || ['conclusions.source.other', sourceModule || 'Other'];
  return t(i18nKey, fallback);
}

/** Tailwind token classes for a source chip (neutral, no crimson). */
export function sourceTone(_sourceModule: string): string {
  return 'bg-[var(--c-surface-raised)] text-[var(--c-text-secondary)] border border-[var(--c-border-subtle)]';
}

/**
 * Evidence-ref type labels. The server bridges write machine keys
 * (`audit_evidence` — auditReportConclusionBridge.ts:135, `audit_report` :52,
 * `interview_finding`/`interview_insight`/`assessment_report`/`tool_session` —
 * ConclusionService, `report`/`conclusion_readout` — ConclusionReadoutService);
 * the readout must show a human name, never the raw key (owner note U-29:
 * "6+ rows with the raw key 'audit_evidence'"). Unknown keys are humanized
 * (snake/kebab → words) so no raw key can ever leak into the UI.
 */
export function evidenceTypeLabel(t: TFunction, raw: string | null | undefined): string {
  const key = String(raw || '').trim().toLowerCase();
  if (!key) return t('conclusions.evidenceType.unknown', 'Evidence');
  const map: Record<string, [string, string]> = {
    audit_evidence: ['conclusions.evidenceType.audit_evidence', 'Audit evidence'],
    audit_report: ['conclusions.evidenceType.audit_report', 'Audit report'],
    assessment_report: ['conclusions.evidenceType.assessment_report', 'Assessment report'],
    tool_session: ['conclusions.evidenceType.tool_session', 'Tool session'],
    interview_finding: ['conclusions.evidenceType.interview_finding', 'Interview finding'],
    interview_insight: ['conclusions.evidenceType.interview_insight', 'Interview insight'],
    report: ['conclusions.evidenceType.report', 'Report'],
    conclusion_readout: ['conclusions.evidenceType.conclusion_readout', 'Conclusion readout'],
  };
  const hit = map[key];
  if (hit) return t(hit[0], hit[1]);
  const humanized = key
    .replace(/[_\-.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
  return t(`conclusions.evidenceType.${key}`, humanized || 'Evidence');
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

/**
 * Goły przymiotnik (bez słowa „confidence"/„pewność") — do wierszy
 * label:wartość, gdzie etykieta ("Pewność"/"Confidence") już stoi obok
 * (np. InsightViewer property strip). `confidenceLabel` powyżej dublowałby
 * słowo w takim layoucie ("Pewność: Średnia pewność").
 */
export function confidenceShortLabel(t: TFunction, raw: string | null | undefined): string {
  const key = normalizeConfidence(raw);
  const fallback: Record<ConfidenceKey, string> = {
    high: 'High',
    medium: 'Medium',
    low: 'Low',
    insufficient: 'Insufficient',
    contradicted: 'Contradicted',
  };
  return t(`conclusions.confidenceShort.${key}`, fallback[key]);
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
