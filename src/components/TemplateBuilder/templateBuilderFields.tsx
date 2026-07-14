/**
 * templateBuilderFields — drobne, reużywalne pola formularza builderów.
 * Spójne tokeny c-*; fokus = c-focus (kanon, NIGDY crimson na CTA/stanach).
 */

import React from 'react';

const FIELD =
  'w-full rounded-lg border border-c-border bg-c-surface px-3 py-2 text-sm text-c-text placeholder:text-c-text-muted focus:outline-none focus:ring-2 focus:ring-c-focus focus:border-c-focus transition-colors';

const LABEL = 'block text-xs font-semibold uppercase tracking-wide text-c-text-muted mb-1.5';

export const Field: React.FC<{ label: string; children: React.ReactNode; hint?: string }> = ({
  label,
  children,
  hint,
}) => (
  <div>
    <label className={LABEL}>{label}</label>
    {children}
    {hint && <p className="mt-1 text-[11px] text-c-text-muted">{hint}</p>}
  </div>
);

export const TextInput: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  testId?: string;
}> = ({ value, onChange, placeholder, testId }) => (
  <input
    type="text"
    className={FIELD}
    value={value}
    placeholder={placeholder}
    onChange={(e) => onChange(e.target.value)}
    data-testid={testId}
  />
);

export const TextArea: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  testId?: string;
}> = ({ value, onChange, placeholder, rows = 3, testId }) => (
  <textarea
    className={`${FIELD} resize-none`}
    rows={rows}
    value={value}
    placeholder={placeholder}
    onChange={(e) => onChange(e.target.value)}
    data-testid={testId}
  />
);

export function Select<T extends string>({
  value,
  options,
  onChange,
  testId,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  testId?: string;
}): React.ReactElement {
  return (
    <select
      className={FIELD}
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      data-testid={testId}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Segmentowany przełącznik (max jeden per strefa — kanon §2 GÓRNA). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  testId,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  testId?: string;
}): React.ReactElement {
  return (
    <div
      className="inline-flex rounded-lg border border-c-border bg-c-bg p-0.5"
      role="radiogroup"
      data-testid={testId}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={[
              'px-3 py-1.5 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus',
              active ? 'bg-c-surface text-c-text shadow-sm' : 'text-c-text-muted hover:text-c-text',
            ].join(' ')}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Przełącznik boolean (pstryczek) z etykietą. */
export const Toggle: React.FC<{
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}> = ({ checked, onChange, label, description }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className="flex items-center gap-3 w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus rounded-lg p-1 -m-1"
  >
    <span
      className={[
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
        checked ? 'bg-c-focus' : 'bg-c-border-strong',
      ].join(' ')}
    >
      <span
        className={[
          'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-4' : 'translate-x-0.5',
        ].join(' ')}
      />
    </span>
    <span className="min-w-0">
      <span className="block text-sm font-medium text-c-text">{label}</span>
      {description && <span className="block text-[11px] text-c-text-muted">{description}</span>}
    </span>
  </button>
);
