/**
 * `NamedCollapsibleSection` — OWN-FIN-006: „Sama anonimowa strzałka nie mówi,
 * co zostanie rozwinięte. Każdy trigger rozwijania ma mieć opis, stan/licznik
 * i przypisany panel, np. «Kontrole jakości 5/5», «Mapping: pełny», «Okresy:
 * uwaga», «Sekcja raportu»."
 *
 * Jeden reużywalny trigger dla WSZYSTKICH zwijanych sekcji
 * `StatementPackWorkspaceV2` (kontrole jakości, mapping, okresy/duplikaty/
 * jednostki, lineage, sekcja raportu, rekoncyliacja, powiązane artefakty) —
 * żeby nie było już ani jednej gołej strzałki (`ChevronRight`/`ChevronDown`
 * bez etykiety+stanu obok), dokładnie ten defekt, który zgłosił właściciel na
 * dzisiejszym ekranie (`FinancialStatementPackWorkspace.tsx` — Lineage/Report
 * section toggle mają dziś TYLKO ikonę).
 *
 * `state` jest OBOWIĄZKOWY (nie opcjonalny) — wymusza na każdym wywołaniu
 * podanie tekstu stanu/licznika, żeby regresja "goła strzałka" nie mogła się
 * po cichu wkraść przy kolejnej sekcji. `tone` steruje kolorem odznaki stanu
 * (nigdy samym kolorem — zawsze też tekst, a11y „status nie samym kolorem").
 */

import React from 'react';

export type NamedCollapsibleSectionTone = 'neutral' | 'ok' | 'warning' | 'danger' | 'pending';

export interface NamedCollapsibleSectionProps {
  /** Unikalny id sekcji w obrębie jednego workspace'u — do testu "policz triggery". */
  id: string;
  /** Nazwa opisująca ZAWARTOŚĆ panelu, np. "Kontrole jakości", "Mapping", "Okresy". */
  title: string;
  /** Stan/licznik obok nazwy, np. "5/5", "pełny", "uwaga", "3 ostrzeżenia". NIGDY pusty string. */
  state: string;
  tone?: NamedCollapsibleSectionTone;
  open: boolean;
  onToggle: () => void;
  /** Ikona po lewej stronie tytułu (opcjonalna, dekoracyjna — `aria-hidden`). */
  icon?: React.ReactNode;
  children: React.ReactNode;
}

const TONE_CLASSES: Record<NamedCollapsibleSectionTone, string> = {
  neutral: 'bg-c-surface-raised text-c-text-secondary',
  ok: 'bg-c-success/10 text-c-success',
  warning: 'bg-c-warning/10 text-c-warning',
  danger: 'bg-c-danger/10 text-c-danger',
  pending: 'bg-c-surface-raised text-c-text-muted',
};

export function NamedCollapsibleSection(props: NamedCollapsibleSectionProps): React.ReactElement {
  const { id, title, state, tone = 'neutral', open, onToggle, icon, children } = props;
  const panelId = `named-collapsible-panel-${id}`;
  const triggerId = `named-collapsible-trigger-${id}`;

  return (
    <div className="border-t border-c-border-subtle first:border-t-0" data-testid={`named-collapsible-${id}`}>
      <button
        type="button"
        id={triggerId}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex min-h-[2.75rem] w-full items-center gap-2 px-4 py-2 text-left transition-colors hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:ring-inset"
        data-testid={`named-collapsible-trigger-${id}`}
      >
        {icon && (
          <span aria-hidden="true" className="shrink-0 text-c-text-muted">
            {icon}
          </span>
        )}
        <span className="text-xs font-semibold text-c-text">{title}</span>
        <span
          className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${TONE_CLASSES[tone]}`}
          data-testid={`named-collapsible-state-${id}`}
        >
          {state}
        </span>
        <span className="flex-1" />
        <ChevronIcon open={open} />
      </button>
      {open && (
        <div id={panelId} role="region" aria-labelledby={triggerId} data-testid={`named-collapsible-panel-${id}`}>
          {children}
        </div>
      )}
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }): React.ReactElement {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={`shrink-0 text-c-text-muted transition-transform ${open ? 'rotate-180' : ''}`}
    >
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default NamedCollapsibleSection;
