/**
 * TableBarOverflowMenu — kebab „⋯" paska Tabeli Idei (rozładowanie tłoku).
 *
 * Zgłoszenie właściciela (2026-07-28): „to menu tylko trochę jest tu za tłoczno
 * (…) może trochę do trzykropka czyli import eksport a resztę trzeba jakoś
 * ładnie ułożyć. — funkcje są super." Kluczowe: NIC nie usuwamy, tylko
 * przegrupowujemy — każda pozycja, która znika z paska, MUSI się tu znaleźć.
 *
 * Dlaczego osobny komponent, a nie inline w `IdeaTableTool`: pasek platformowy
 * (`TableToolbar.tsx`) ma dokładnie ten sam wzorzec zwinięcia pod jedno „⋯", ale
 * zaszyty inline i bez sekcji. Ten plik jest wersją z SEKCJAMI (Dane · Widok ·
 * AI · Więcej) — 20+ pozycji bez nagłówków to druga ściana elementów, tyle że
 * pionowa (doktryna gęstości: kebab też ma mieć porządek).
 *
 * Tokeny wyłącznie `c-*`; zero crimson poza `danger` (semantyka krytyczna).
 */
import { type LucideIcon, MoreHorizontal } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

export interface TableBarOverflowItem {
  id: string;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  /** Pozycja odpowiadająca WŁĄCZONEMU stanowi (np. otwarty panel historii). */
  active?: boolean;
  disabled?: boolean;
  danger?: boolean;
  /** `false` = pozycja nie dotyczy tego kontekstu (np. tylko platforma). */
  show?: boolean;
  testId?: string;
}

export interface TableBarOverflowSection {
  id: string;
  heading: string;
  items: TableBarOverflowItem[];
}

export interface TableBarOverflowMenuProps {
  sections: TableBarOverflowSection[];
  title: string;
  testId?: string;
}

export const TableBarOverflowMenu: React.FC<TableBarOverflowMenuProps> = ({
  sections,
  title,
  testId = 'idea-table-bar-overflow',
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const visibleSections = sections
    .map((s) => ({ ...s, items: s.items.filter((i) => i.show !== false) }))
    .filter((s) => s.items.length > 0);

  if (visibleSections.length === 0) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={title}
        title={title}
        data-testid={testId}
        className={`inline-flex items-center rounded-lg px-2 py-1.5 transition-colors ${
          open
            ? 'bg-c-surface-raised text-c-text'
            : 'text-c-text-muted hover:bg-c-surface-raised hover:text-c-text-secondary'
        }`}
      >
        <MoreHorizontal size={14} />
      </button>
      {open && (
        <div
          role="menu"
          data-testid={`${testId}-menu`}
          className="absolute right-0 top-full z-50 mt-1 max-h-[70vh] w-64 overflow-y-auto rounded-xl border border-c-border-subtle bg-c-surface py-1 shadow-xl"
        >
          {visibleSections.map((section, si) => (
            <div key={section.id}>
              {si > 0 && <div className="my-1 border-t border-c-border-subtle" />}
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-c-text-muted">
                {section.heading}
              </div>
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="menuitem"
                    disabled={item.disabled}
                    data-testid={item.testId}
                    onClick={() => {
                      item.onClick();
                      setOpen(false);
                    }}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors disabled:opacity-40 ${
                      item.danger
                        ? 'text-c-danger hover:bg-[color-mix(in_srgb,var(--c-danger)_10%,transparent)]'
                        : item.active
                          ? 'bg-c-surface-raised text-c-text'
                          : 'text-c-text-secondary hover:bg-c-surface-raised'
                    }`}
                  >
                    <Icon size={14} className="shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TableBarOverflowMenu;
