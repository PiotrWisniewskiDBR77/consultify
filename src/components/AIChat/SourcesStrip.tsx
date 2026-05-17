import React from 'react';

export interface SourcesStripProps {
  bundle?: unknown;
  messageId?: string | null;
  isCompact?: boolean;
  [key: string]: unknown;
}

function asRecord(value: unknown): Record<string, any> | null {
  return value && typeof value === 'object' ? (value as Record<string, any>) : null;
}

function label(value: unknown): string {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

export const SourcesStrip: React.FC<SourcesStripProps> = ({ bundle, isCompact = false }) => {
  const data = asRecord(bundle);
  if (!data) return null;

  const sourceClasses = Array.isArray(data.sourceClasses) ? data.sourceClasses : [];
  const classes = sourceClasses.length > 0 ? sourceClasses : ['general'];
  const citationsCount =
    typeof data.citationsCount === 'number'
      ? data.citationsCount
      : Array.isArray(data.citations)
        ? data.citations.length
        : 0;

  // Avoid noisy/confusing "No cited sources" rows in normal chat.
  // When there are no sources, the trust badge/policy blocks already communicate it (when relevant).
  if (citationsCount <= 0) return null;

  return (
    <div
      className={`flex flex-wrap items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 ${
        isCompact ? 'leading-5' : ''
      }`}
      data-testid="sources-strip"
    >
      <span>{`${citationsCount} cited sources`}</span>
      <span aria-hidden="true">-</span>
      {classes.map((sourceClass: unknown) => (
        <span
          key={String(sourceClass)}
          className="rounded-full border border-slate-200 px-1.5 py-0.5 dark:border-slate-700"
        >
          {label(sourceClass)}
        </span>
      ))}
    </div>
  );
};

export default SourcesStrip;
