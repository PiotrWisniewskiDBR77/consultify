/**
 * Drobne prymitywy wizualne karty N rodziny OKR (kafel statystyki, para
 * klucz-wartość, pasek postępu) — przeniesione 1:1 z ZATWIERDZONEGO prototypu
 * `dev-render/screens/cel-jedna-karta.tsx`, żeby produkcja wyglądała dokładnie
 * jak obraz, który właściciel przyjął (ocena A, decyzja „ok”, pakiet odbioru
 * `08-wyniki`, wpis `cel-jedna-karta`).
 *
 * Wyłącznie tokeny `c-*`. Zero `primary-*`/crimson (kanon UI #3: czerwień to
 * WYŁĄCZNIE semantyka krytyczna — tu `tone="danger"`, nigdy dekoracja).
 *
 * Osobny plik, a nie kopia w dwóch ekranach: używa go i karta celu (poziom 2),
 * i karta Kluczowego Rezultatu (poziom 4).
 */
import React from 'react';

export type OkrCardTone = 'neutral' | 'success' | 'warning' | 'danger';

export const OKR_TONE_TEXT_CLASS: Record<OkrCardTone, string> = {
  neutral: 'text-c-text',
  success: 'text-c-success',
  warning: 'text-c-warning',
  danger: 'text-c-danger',
};

const TONE_FILL_CLASS: Record<OkrCardTone, string> = {
  neutral: 'bg-c-text-muted',
  success: 'bg-c-success',
  warning: 'bg-c-warning',
  danger: 'bg-c-danger',
};

export const OkrStatTile: React.FC<{
  label: string;
  value: React.ReactNode;
  sub?: string;
  tone?: OkrCardTone;
  icon: React.FC<{ size?: number; className?: string }>;
  testId?: string;
}> = ({ label, value, sub, tone = 'neutral', icon: Icon, testId }) => (
  <div className="rounded-xl border border-c-border-subtle bg-c-surface-raised p-4" data-testid={testId}>
    <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-c-text-muted">
      <Icon size={13} className="shrink-0" />
      {label}
    </div>
    <div className={`mt-1.5 text-2xl font-semibold tabular-nums ${OKR_TONE_TEXT_CLASS[tone]}`}>{value}</div>
    {sub ? <div className="mt-0.5 text-[11px] text-c-text-muted">{sub}</div> : null}
  </div>
);

export const OkrKeyValueGrid: React.FC<{ rows: { label: string; value: React.ReactNode }[] }> = ({ rows }) => (
  <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
    {rows.map((row) => (
      <div
        key={row.label}
        className="flex items-baseline justify-between gap-3 border-b border-c-border-subtle/60 pb-1.5"
      >
        <dt className="text-xs text-c-text-muted">{row.label}</dt>
        <dd className="text-right text-xs font-medium text-c-text">{row.value}</dd>
      </div>
    ))}
  </dl>
);

export const OkrBullets: React.FC<{ items: React.ReactNode[] }> = ({ items }) => (
  <ul className="flex flex-col gap-1.5">
    {items.map((item, idx) => (
      <li key={idx} className="flex items-start gap-2 text-xs text-c-text-secondary">
        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-c-text-muted" />
        <span className="min-w-0">{item}</span>
      </li>
    ))}
  </ul>
);

/** Pasek postępu 0–100%. `pct` poza zakresem jest przycinany (nie zawijany). */
export const OkrProgressBar: React.FC<{ pct: number; tone?: OkrCardTone }> = ({ pct, tone = 'neutral' }) => {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-c-surface-raised">
      <div className={`h-full rounded-full ${TONE_FILL_CLASS[tone]}`} style={{ width: `${clamped}%` }} />
    </div>
  );
};

/** Link „piętro niżej / piętro wyżej” — jedna klasa dla całej rodziny OKR. */
export const OKR_CARD_LINK_CLASS =
  'inline-flex items-center gap-1 rounded text-xs font-medium text-c-info underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus';
