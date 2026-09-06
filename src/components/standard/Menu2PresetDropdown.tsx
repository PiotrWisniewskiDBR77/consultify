/**
 * Menu2PresetDropdown
 *
 * DEC-420 (właściciel, 06.09.2026, 3 zrzuty Inicjatyw): „Trzecie menu ma za
 * dużo przycisków — ogranicz je do dwóch lub trzech." Ten sam wzorzec, co
 * `StatusDropdown` w Ocenie (`src/components/shared/ModuleHub/StatusDropdown.tsx`,
 * DEC-414/414b) — pełna lista opcji z licznikami żyje w Menu 2 (ten dropdown),
 * Menu 3 pokazuje wyłącznie ≤3 chipy o największej wartości decyzyjnej.
 *
 * Generyczny (nie wpięty w konkretną domenę statusów) — używany w
 * InitiativesHub dla trzech zakładek: Inicjatywy (cykl życia), Plan (stan
 * planu), Obciążenie (ograniczenie). Wizualnie 1:1 z `<select>` Menu 2 obok
 * (h-9, `border-c-border-subtle`, `bg-c-surface`) — nie z bazowej stylistyki
 * `StatusDropdown` (navy/slate), bo Initiatives.tsx już konsekwentnie używa
 * tokenów `c-*` w tym samym pasku.
 */
import { Check, ChevronDown, Filter } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

export interface Menu2PresetOption {
  id: string;
  label: string;
  count?: number;
}

export interface Menu2PresetDropdownProps {
  /** Prefiks przycisku, np. "Cykl życia". */
  label: string;
  options: Menu2PresetOption[];
  /** id aktualnie wybranej opcji (musi istnieć w `options`). */
  value: string;
  onChange: (id: string) => void;
  className?: string;
  /**
   * Tryb KOMPAKTOWY (opt-in, DEC-423b/c/d — Materiały przy 1440 px).
   * Pomiar 06.09.2026: pięć zakładek + dwa dropdowny w formie „Nazwa: Wartość N"
   * + pstryczek widoku + CTA nie mieszczą się w 1440 — dropdown „Widoczność"
   * nachodził na pstryczek i CTA (zmierzone `--dom`: 1035→1274 px vs pstryczek
   * od 1191 px). W tym trybie przycisk pokazuje SAMĄ nazwę filtra, dopóki nic
   * nie jest wybrane (dokładnie jak kanoniczny `StatusDropdown` w Ocenie), a
   * wybraną, długą wartość ucina zamiast rozpychać pasek. Domyślnie `false` →
   * wygląd bajt w bajt jak w Inicjatywach (DEC-420).
   */
  compact?: boolean;
  'data-testid'?: string;
}

export const Menu2PresetDropdown: React.FC<Menu2PresetDropdownProps> = ({
  label,
  options,
  value,
  onChange,
  className = '',
  compact = false,
  'data-testid': testId,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.id === value) ?? options[0];
  // „Domyślna" = pierwsza pozycja listy (u wszystkich wywołujących to „Wszystkie").
  const naDomyslnej = compact && options.length > 0 && selected?.id === options[0].id;

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEscape);
    };
  }, []);

  return (
    <div ref={containerRef} className={`relative ${className}`} data-testid={testId}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`inline-flex h-9 items-center gap-2 rounded-lg border border-c-border-subtle bg-c-surface px-3 text-xs font-medium whitespace-nowrap text-c-text-secondary transition-colors duration-150 hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus ${
          compact ? 'max-w-[260px]' : ''
        } ${isOpen ? 'bg-c-surface-raised text-c-text' : ''}`}
      >
        <Filter size={14} className="shrink-0 text-c-text-muted" aria-hidden="true" />
        <span className={compact ? 'truncate' : undefined}>
          {naDomyslnej ? label : `${label}: ${selected?.label ?? ''}`}
        </span>
        {!naDomyslnej && selected?.count !== undefined && (
          <span className="shrink-0 rounded-full bg-c-surface-raised px-1.5 py-0.5 text-[11px] text-c-text-muted">
            {selected.count}
          </span>
        )}
        <ChevronDown
          size={14}
          className={`shrink-0 text-c-text-muted transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          className="absolute right-0 top-full z-overlay mt-1 min-w-[220px] overflow-hidden rounded-xl border border-c-border-subtle bg-c-surface py-1 shadow-hig-xl dark:shadow-hig-dark-xl"
        >
          {options.map((option) => {
            const isSelected = option.id === value;
            return (
              <button
                key={option.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(option.id);
                  setIsOpen(false);
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors duration-150 ${
                  isSelected
                    ? 'bg-c-surface-raised text-c-text'
                    : 'text-c-text-secondary hover:bg-c-surface-raised'
                }`}
              >
                <span className="flex-1 truncate">{option.label}</span>
                {option.count !== undefined && (
                  <span className="text-[11px] text-c-text-muted">{option.count}</span>
                )}
                {isSelected && <Check size={14} className="text-c-text" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Menu2PresetDropdown;
