/**
 * previewLabels — localized label maps for Report/Presentation preview panels.
 *
 * TABLE_AND_PREVIEW_CANON §7.3 / §27: preview MUST NOT surface raw enum keys
 * (`R1`, `draft`, `tool`) or bare English. This helper turns the raw status /
 * type / source enums into localized human labels, with an honest humanized
 * fallback (never the raw key) when a mapping is missing.
 *
 * Status tones stay owned by `EntityStatusChip` (statusChipTone); this module
 * only supplies the TEXT so tone + label stay consistent with the list table.
 */
import type { TFunction } from 'i18next';

/** Humanize an unknown enum key: underscores/hyphens → spaces, capitalize. */
function humanizeKey(value: string | null | undefined): string {
  const spaced = String(value ?? '')
    .trim()
    .replace(/[_-]+/g, ' ')
    .trim();
  if (!spaced) return '';
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Localized report/presentation status label (shared with list table). */
export function statusLabel(t: TFunction, raw: string | null | undefined): string {
  const key = String(raw ?? '')
    .trim()
    .toLowerCase();
  const map: Record<string, string> = {
    draft: t('reports.draft', 'Draft'),
    ready: t('reports.ready', 'Ready'),
    exported: t('reports.exported', 'Exported'),
    archived: t('reports.archived', 'Archived'),
    generated: t('reports.generated', 'Generated'),
    editing: t('reports.editing', 'Editing'),
    shared: t('reports.shared', 'Shared'),
  };
  return map[key] ?? humanizeKey(raw);
}

/** Localized report-type label (R1–R4 / custom). */
export function reportTypeLabel(t: TFunction, raw: string | null | undefined): string {
  const key = String(raw ?? '').trim();
  const map: Record<string, string> = {
    R1: t('reports.weeklyExecution', 'Weekly Execution'),
    R2: t('reports.steeringCommittee', 'Steering Committee'),
    R3: t('reports.benefitsTracking', 'Benefits Tracking'),
    R4: t('reports.portfolioOverview', 'Portfolio Overview'),
    custom: t('reports.preview.customType', 'Custom'),
  };
  return map[key] ?? humanizeKey(raw);
}

/** Localized presentation source-type label. */
export function sourceTypeLabel(t: TFunction, raw: string | null | undefined): string {
  const key = String(raw ?? '')
    .trim()
    .toLowerCase();
  const map: Record<string, string> = {
    tool: t('reports.tool', 'Tool'),
    assessment: t('reports.assessment', 'Assessment'),
    finance: t('reports.finance', 'Finance'),
    upload: t('reports.upload', 'Upload'),
  };
  return map[key] ?? humanizeKey(raw);
}
