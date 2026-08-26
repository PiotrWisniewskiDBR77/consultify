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
import { ChevronRight, Plus, X } from 'lucide-react';
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

export interface OrgTechDetailItem {
  label: string;
  value: string;
}

export interface OrgSectionCardProps {
  id: string;
  title: string;
  icon?: LucideIcon;
  status?: { tone?: OrgStatusTone; label: string };
  /** Zdanie wyjaśniające pod treścią karty (prototyp: `.hint`). */
  hint?: string;
  /** Krótkie wprowadzenie nad treścią. */
  lead?: string;
  /**
   * „Szczegóły techniczne" (prototyp `.tech`) — identyfikatory rekordu
   * (np. `org_…` UUID), zwinięte pod jednym wierszem na dole karty. NIE
   * dublować w treści pól — to jedyne miejsce, gdzie ID się pokazuje.
   */
  techDetails?: OrgTechDetailItem[];
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
  techDetails,
  children,
  className,
}) => {
  const [techOpen, setTechOpen] = React.useState(false);
  return (
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
      {techDetails && techDetails.length > 0 && (
        <div className="border-t border-c-border-subtle">
          <button
            type="button"
            onClick={() => setTechOpen((open) => !open)}
            aria-expanded={techOpen}
            data-testid={`org-card-${id}-tech-toggle`}
            className="flex w-full items-center gap-1.5 px-4 py-2 text-left text-[11px] font-medium text-c-text-muted transition-colors hover:text-c-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)]"
          >
            <ChevronRight
              aria-hidden="true"
              className={cn('h-3 w-3 shrink-0 transition-transform', techOpen && 'rotate-90')}
            />
            Szczegóły techniczne
          </button>
          {techOpen && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 pb-3 pl-[26px]">
              {techDetails.map((item) => (
                <span
                  key={item.label}
                  className="rounded-md bg-c-surface-raised px-1.5 py-0.5 font-mono text-[11px] text-c-text-muted"
                  title={item.label}
                >
                  {item.value}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
};

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
  /**
   * Pochodzenie faktu (prototyp `.prov`): „Źródło · Osoba · Data". Pokazuje
   * SKĄD wartość pochodzi — nie duplikuje ID (to idzie do „Szczegóły
   * techniczne" na poziomie karty).
   */
  provenance?: string;
  children: React.ReactNode;
}

export const OrgFieldShell: React.FC<OrgFieldShellProps> = ({
  label,
  htmlFor,
  status,
  provenance,
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
    {provenance && (
      <p className="mt-1 truncate text-[11px] text-c-text-muted" title={provenance}>
        {provenance}
      </p>
    )}
  </div>
);

export interface OrgTextFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  status?: { tone?: OrgStatusTone; label: string };
  /** Pochodzenie faktu (prototyp `.prov`) — patrz `OrgFieldShellProps`. */
  provenance?: string;
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
  provenance,
  multiline = false,
  type = 'text',
  placeholder = '—',
}) => (
  <OrgFieldShell label={label} htmlFor={id} status={status} provenance={provenance}>
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
  /** Pochodzenie faktu (prototyp `.prov`) — patrz `OrgFieldShellProps`. */
  provenance?: string;
}> = ({ id, label, value, options, onChange, emptyLabel = '—', status, provenance }) => (
  <OrgFieldShell label={label} htmlFor={id} status={status} provenance={provenance}>
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

/**
 * Lista rekordów edytowalnych wierszami (zastępuje `DynamicList` ze starych
 * ekranów Cele/Wyzwania/Synteza — TA implementacja ma zero `primary-*`,
 * `DynamicList` miało 8). Każdy wiersz = siatka pól zgodnie z `columns`;
 * puste = „—" (placeholder), usuwanie = ikona X, dodawanie = jeden ghost-button
 * pod listą. Pusta lista = jedno zdanie, nie duża ramka-zaproszenie.
 */
export interface OrgRecordListColumn {
  key: string;
  label: string;
  type?: 'text' | 'select' | 'textarea';
  options?: OrgSelectOption[];
  placeholder?: string;
}

export interface OrgRecordListProps {
  columns: OrgRecordListColumn[];
  items: Array<Record<string, string> & { id: string }>;
  onAdd: () => void;
  onUpdate: (id: string, key: string, value: string) => void;
  onRemove: (id: string) => void;
  addLabel?: string;
  emptyLabel?: string;
}

export const OrgRecordList: React.FC<OrgRecordListProps> = ({
  columns,
  items,
  onAdd,
  onUpdate,
  onRemove,
  addLabel = 'Dodaj pozycję',
  emptyLabel = 'Brak pozycji.',
}) => (
  <div className="space-y-2">
    {items.length === 0 && <p className="text-[13px] text-c-text-muted">{emptyLabel}</p>}
    {items.map((item) => (
      <div
        key={item.id}
        className="group relative rounded-lg border border-c-border-subtle bg-c-surface-raised p-3 pr-9"
      >
        <button
          type="button"
          aria-label="Usuń pozycję"
          onClick={() => onRemove(item.id)}
          className="absolute right-2 top-2 rounded-md p-1 text-c-text-muted opacity-0 transition-opacity hover:bg-c-surface hover:text-c-text focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)] group-hover:opacity-100 group-focus-within:opacity-100"
        >
          <X aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
        <div
          className={cn('grid grid-cols-1 gap-x-4 gap-y-2', columns.length > 2 && 'md:grid-cols-2')}
        >
          {columns.map((column) => (
            <div key={column.key}>
              <label className={cn(ORG_L1, 'mb-0.5 block')}>{column.label}</label>
              {column.type === 'select' ? (
                <select
                  value={item[column.key] ?? ''}
                  onChange={(event) => onUpdate(item.id, column.key, event.target.value)}
                  className={cn(
                    CONTROL_BASE,
                    'cursor-pointer',
                    !item[column.key] && 'text-c-text-muted'
                  )}
                >
                  <option value="">—</option>
                  {(column.options ?? []).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : column.type === 'textarea' ? (
                <textarea
                  rows={2}
                  value={item[column.key] ?? ''}
                  placeholder={column.placeholder ?? '—'}
                  onChange={(event) => onUpdate(item.id, column.key, event.target.value)}
                  className={cn(CONTROL_BASE, 'resize-none')}
                />
              ) : (
                <input
                  type="text"
                  value={item[column.key] ?? ''}
                  placeholder={column.placeholder ?? '—'}
                  onChange={(event) => onUpdate(item.id, column.key, event.target.value)}
                  className={CONTROL_BASE}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    ))}
    <button
      type="button"
      onClick={onAdd}
      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-dashed border-c-border px-3 text-[12px] font-medium text-c-text-secondary transition-colors hover:border-c-border-strong hover:text-c-text focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)]"
    >
      <Plus aria-hidden="true" className="h-3.5 w-3.5" />
      {addLabel}
    </button>
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
