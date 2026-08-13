/**
 * PresentationSlideShell — shared layout for every slide in the assessment
 * presentation deck. One consistent frame (kicker + big title + optional
 * lede + content area) so each slide differs only in CONTENT, never in
 * chrome — "jeden przekaz na slajd, bez ścian tekstu, duża typografia
 * czytelna z odległości" (worker brief). Tokens only (`c-*`); no
 * `primary-*`/crimson anywhere in this file — crimson is reserved for
 * critical-risk semantics, applied selectively on the risk slide only.
 */
import React from 'react';

export interface PresentationSlideShellProps {
  readonly kicker: string;
  readonly title: string;
  readonly lede?: string;
  readonly children?: React.ReactNode;
  readonly footnote?: React.ReactNode;
}

export const PresentationSlideShell: React.FC<PresentationSlideShellProps> = ({
  kicker,
  title,
  lede,
  children,
  footnote,
}) => {
  return (
    <div className="flex h-full w-full flex-col px-10 py-10 sm:px-16 sm:py-14">
      <div className="flex-shrink-0">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-c-text-muted">{kicker}</p>
        <h1 className="mt-3 text-3xl font-bold leading-tight text-c-text sm:text-4xl">{title}</h1>
        {lede ? <p className="mt-3 max-w-3xl text-base text-c-text-secondary sm:text-lg">{lede}</p> : null}
      </div>
      <div className="mt-8 flex min-h-0 flex-1 flex-col justify-center">{children}</div>
      {footnote ? (
        <div className="mt-6 flex-shrink-0 border-t border-c-border-subtle pt-4 text-xs text-c-text-muted">
          {footnote}
        </div>
      ) : null}
    </div>
  );
};

/** Small honest "not provided" note — used for narrative fields the frozen
 * Output has no slot for (business question, participants). Never invents a
 * value; always says plainly that the field is not part of the Output. */
export const MissingNarrativeNote: React.FC<{ label: string }> = ({ label }) => (
  <p className="rounded-lg border border-dashed border-c-border bg-c-surface-raised px-4 py-3 text-sm text-c-text-muted">
    {label}
  </p>
);

export const StatChip: React.FC<{ label: string; value: string; tone?: 'neutral' | 'danger' | 'success' }> = ({
  label,
  value,
  tone = 'neutral',
}) => {
  const toneClass =
    tone === 'danger'
      ? 'text-c-danger'
      : tone === 'success'
        ? 'text-c-success'
        : 'text-c-text';
  return (
    <div className="rounded-xl border border-c-border-subtle bg-c-surface px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-c-text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${toneClass}`}>{value}</p>
    </div>
  );
};

export default PresentationSlideShell;
