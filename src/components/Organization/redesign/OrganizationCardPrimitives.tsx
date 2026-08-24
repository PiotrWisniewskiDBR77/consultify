/**
 * Prymitywy kart treści ekranu Organizacji (redesign v1).
 *
 * Wzorzec WIĄŻĄCY: `org-prototyp-wzorzec.html` (sekcje `.card`, `.field`, `.seg`,
 * `.tags`) + zrzuty proto-light/proto-dark. Moduł deklaruje treść, prymityw
 * narzuca wygląd — ta sama zasada co StandardTable/StandardPreview.
 *
 * Reguły kanonu, których te prymitywy pilnują:
 *  - etykieta pola = L1 (11px, uppercase, tracking .16em, c-text-muted),
 *    wartość = 13px c-text; PUSTE POLE to „—", nie ramka „No items yet";
 *  - status pola to CICHY chip (kropka + tonowany tekst), nigdy wypełniona plamka;
 *  - zero crimsonu: kolor pojawia się wyłącznie jako sygnał (warning/success/info);
 *  - fokus = pierścień `--c-focus` (niebieski), nie obrys marki.
 */

import type { LucideIcon } from 'lucide-react';
import React from 'react';

import { cn } from '../../../lib/utils';

export type OrgStatusTone = 'ok' | 'warning' | 'info' | 'muted';

export const ORG_L1 = 'text-[11px] font-semibold uppercase tracking-[0.16em] text-c-text-muted';

export const OrgStatusChip: React.FC<{ tone?: OrgStatusTone; children: React.ReactNode }> = ({
  tone = 'muted',
  children,
}) => (
  <span
    className={cn(
      'inline-flex items-center gap-1.5 text-[11px]',
      tone === 'ok' && 'text-c-success',
      tone === 'warning' && 'text-c-warning',
      tone === 'info' && 'text-c-info',
      tone === 'muted' && 'text-c-text-secondary'
    )}
  >
    <span
      aria-hidden="true"
      className={cn(
        'inline-block h-1.5 w-1.5 shrink-0 rounded-full',
        tone === 'ok' && 'bg-c-success',
        tone === 'warning' && 'bg-c-warning',
        tone === 'info' && 'bg-c-info',
        tone === 'muted' && 'bg-c-border-strong'
      )}
    />
    {children}
  </span>
);

export interface OrgSectionCardProps {
  id: string;
  title: string;
  icon?: LucideIcon;
  status?: { tone?: OrgStatusTone; label: string };
  /** Zdanie wyjaśniające pod treścią karty (prototyp: `.hint`). */
  hint?: string;
  /** Krótkie wprowadzenie nad treścią. */
  lead?: string;
  children: React.ReactNode;
  className?: string;
}

export const OrgSectionCard: React.FC<OrgSectionCardProps> = ({
  id,
  title,
  icon: Icon,
  status,
  hint,
  lead,
  children,
  className,
}) => (
  <section
    aria-labelledby={`org-card-${id}`}
    data-testid={`org-card-${id}`}
    className={cn(
      'mb-4 rounded-xl border border-c-border-subtle bg-c-surface shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.35)]',
      className
    )}
  >
    <header className="flex items-center gap-2 border-b border-c-border-subtle px-4 py-3">
      {Icon && <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-c-text-muted" />}
      <h3 id={`org-card-${id}`} className="flex-1 text-[13px] font-semibold text-c-text">
        {title}
      </h3>
      {status && <OrgStatusChip tone={status.tone}>{status.label}</OrgStatusChip>}
    </header>
    <div className="p-4">
      {lead && <p className="mb-3 text-[12px] text-c-text-secondary">{lead}</p>}
      {children}
    </div>
    {hint && (
      <p className="border-t border-c-border-subtle px-4 py-3 text-[11px] text-c-text-muted">
        {hint}
      </p>
    )}
  </section>
);

export const OrgFieldGrid: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => <div className={cn('grid grid-cols-1 gap-x-4 md:grid-cols-2', className)}>{children}</div>;

export const OrgFieldColumn: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-w-0">{children}</div>
);

const CONTROL_BASE =
  '-mx-1 w-full rounded-sm bg-transparent px-1 text-[13px] text-c-text placeholder:text-c-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)]';

export interface OrgFieldShellProps {
  label: string;
  htmlFor?: string;
  status?: { tone?: OrgStatusTone; label: string };
  children: React.ReactNode;
}

export const OrgFieldShell: React.FC<OrgFieldShellProps> = ({
  label,
  htmlFor,
  status,
  children,
}) => (
  <div className="border-b border-c-border-subtle py-2 last:border-b-0">
    <div className="mb-0.5 flex items-center gap-2">
      <label htmlFor={htmlFor} className={ORG_L1}>
        {label}
      </label>
      {status && <OrgStatusChip tone={status.tone}>{status.label}</OrgStatusChip>}
    </div>
    {children}
  </div>
);

export interface OrgTextFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  status?: { tone?: OrgStatusTone; label: string };
  multiline?: boolean;
  type?: 'text' | 'number';
  /** Puste pole pokazuje „—" (kanon §5.6), a nie ramkę-zaproszenie. */
  placeholder?: string;
}

export const OrgTextField: React.FC<OrgTextFieldProps> = ({
  id,
  label,
  value,
  onChange,
  status,
  multiline = false,
  type = 'text',
  placeholder = '—',
}) => (
  <OrgFieldShell label={label} htmlFor={id} status={status}>
    {multiline ? (
      <textarea
        id={id}
        rows={3}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={cn(CONTROL_BASE, 'resize-none')}
      />
    ) : (
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={CONTROL_BASE}
      />
    )}
  </OrgFieldShell>
);

/**
 * Lista rozdzielana przecinkami. Trzyma WŁASNY tekst w trakcie edycji (jak
 * `CommaInput` w starym module profilu), żeby wpisanie „Polska, " nie gubiło
 * przecinka po normalizacji.
 */
export const OrgListField: React.FC<{
  id: string;
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  status?: { tone?: OrgStatusTone; label: string };
}> = ({ id, label, value, onChange, placeholder = '—', status }) => {
  const [editing, setEditing] = React.useState(false);
  const [text, setText] = React.useState('');

  return (
    <OrgFieldShell label={label} htmlFor={id} status={status}>
      <input
        id={id}
        type="text"
        value={editing ? text : value.join(', ')}
        placeholder={placeholder}
        onFocus={() => {
          setText(value.join(', '));
          setEditing(true);
        }}
        onChange={(event) => setText(event.target.value)}
        onBlur={() => {
          setEditing(false);
          onChange(
            text
              .split(',')
              .map((item) => item.trim())
              .filter(Boolean)
          );
        }}
        className={CONTROL_BASE}
      />
    </OrgFieldShell>
  );
};

export interface OrgSelectOption {
  value: string;
  label: string;
}

export const OrgSelectField: React.FC<{
  id: string;
  label: string;
  value: string;
  options: OrgSelectOption[];
  onChange: (value: string) => void;
  emptyLabel?: string;
  status?: { tone?: OrgStatusTone; label: string };
}> = ({ id, label, value, options, onChange, emptyLabel = '—', status }) => (
  <OrgFieldShell label={label} htmlFor={id} status={status}>
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={cn(CONTROL_BASE, 'cursor-pointer', !value && 'text-c-text-muted')}
    >
      <option value="">{emptyLabel}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </OrgFieldShell>
);

/**
 * Segment wyboru (prototyp `.seg`) — pigułki h-9 z ramką, aktywna = neutralne
 * wypełnienie. Zastępuje 6 dużych kafli z ikonami, które dziś zjadają pół ekranu.
 */
export const OrgChoiceSegment: React.FC<{
  label: string;
  value: string;
  options: OrgSelectOption[];
  onChange: (value: string) => void;
  className?: string;
}> = ({ label, value, options, onChange, className }) => (
  <div role="radiogroup" aria-label={label} className={cn('flex flex-wrap gap-2', className)}>
    {options.map((option) => {
      const active = option.value === value;
      return (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={active}
          onClick={() => onChange(active ? '' : option.value)}
          className={cn(
            'inline-flex h-9 items-center gap-2 rounded-full border px-3 text-[13px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)]',
            active
              ? 'border-c-border-strong bg-state-selected text-c-text'
              : 'border-c-border text-c-text-secondary hover:border-c-border-strong hover:text-c-text'
          )}
        >
          {option.label}
        </button>
      );
    })}
  </div>
);

/** Tagi wielokrotnego wyboru (prototyp `.tags`) — cichy chip, nigdy status. */
export const OrgTagToggleGroup: React.FC<{
  label: string;
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
}> = ({ label, options, value, onChange }) => (
  <div>
    <p className={cn(ORG_L1, 'mb-2')}>{label}</p>
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = value.includes(option);
        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            onClick={() =>
              onChange(active ? value.filter((item) => item !== option) : [...value, option])
            }
            className={cn(
              'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)]',
              active
                ? 'border-c-border-strong bg-state-selected font-medium text-c-text'
                : 'border-c-border-subtle bg-c-surface-raised text-c-text-secondary hover:border-c-border'
            )}
          >
            {active && (
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-c-text-muted" />
            )}
            {option}
          </button>
        );
      })}
    </div>
  </div>
);
