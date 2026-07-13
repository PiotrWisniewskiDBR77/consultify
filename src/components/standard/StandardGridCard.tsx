/**
 * StandardGridCard — JEDEN kanon karty widoku GRID/kafelkowego (Triada, kanon #76a).
 *
 * Zgłoszenie #76a (analogiczne do #75b `StandardKanbanCard`): dziś każdy widok
 * kafelkowy (Portfolio initiatives, Reports/Templates hub, Assessment/Economics/
 * Benefits/Presentations/Discovery hub, Idea Table grid…) renderuje WŁASNĄ,
 * rozbieżną kartę — inne pola, inne promienie/odstępy, a w
 * `shared/ModuleHub/GridView.tsx` wprost crimson-leak (tło/obramowanie/tekst
 * z palety `primary` użyte jako DEKORACYJNY akcent typu/statusu — złamanie
 * kanonu "primary=crimson TYLKO semantyka krytyczna"). To jest JEDYNY
 * dozwolony renderer pojedynczej karty kafelkowej —
 * powłoka NARZUCA wygląd, moduł DEKLARUJE treść przez `StandardGridCard` (dane)
 * + handlery.
 *
 * SSOT wyglądu: docs/ui-standards/TRIADA_KANON.md. Wygląd spójny z rodziną
 * `src/components/standard/` (te same tokeny c-*, hairline bordery, cichy chip
 * z kolorem TYLKO w kropce, pill-status przez `StatusChip`, kebab przez
 * `RowActionsMenu` — bajt-identyczny dropdown z `StandardTable`).
 *
 * ANATOMIA:
 *   - lewy pasek akcentu ~3px: PILNOŚĆ (bursztyn/czerwony, kanon A9) MA
 *     pierwszeństwo; inaczej opcjonalna TOŻSAMOŚĆ kategorii/osi przez
 *     `accentColorVar` — WYŁĄCZNIE zmienna CSS z palety kategorycznej
 *     `--c-tag-1…10` (nigdy `--c-primary`/crimson jako dekoracja),
 *   - nagłówek: status-pill (`StatusChip`, kropka + tint) + kebab (⋮, prawy
 *     górny róg, widoczny na hover — `RowActionsMenu`, ten sam dropdown co
 *     w tabeli),
 *   - tytuł do 2 linii, opcjonalny podtytuł (1 linia), opis do 2 linii,
 *   - ciche chipy (typ/priorytet/health — neutralna ramka, kolor w kropce),
 *   - opcjonalny pasek postępu (0-100%, neutralny fill),
 *   - stopka: metryki po lewej (budżet/ROI/termin…) + `footerRight` po prawej
 *     (np. "3 dni temu") + awatar właściciela, nad hairline.
 *
 * ZAKAZY: `primary-*`/crimson jako dekoracja (typ/kategoria/CTA/aktywny stan),
 * pełne czerwone pigułki priorytetu, zebra/pełne kolorowe belki na całą
 * szerokość karty, chowanie kebaba poza hover/focus, własny dropdown zamiast
 * `RowActionsMenu`. Fokus = `c-focus` (dziedziczone z przycisków wewnątrz).
 */

import type { LucideIcon } from 'lucide-react';
import { MoreVertical, User } from 'lucide-react';
import React from 'react';

import { cn } from '@/utils/cn';

import type { RowAction, RowActionSection } from '../shared/RowActionsMenu';
import { RowActionsMenu } from '../shared/RowActionsMenu';
import type { ChipTone } from '../ui/primitives/chips/chipBase';
import { CHIP_TONE_VAR, ChipDot } from '../ui/primitives/chips/chipBase';
import { MetaChip } from '../ui/primitives/chips/MetaChip';
import { StatusChip, type StatusTone } from '../ui/primitives/chips/StatusChip';

/** Pilność karty → pasek akcentu ~3px (kanon A9: TYLKO bursztyn/czerwony/brak). */
export type StandardGridCardUrgency = 'none' | 'pending' | 'critical';

/** Cichy chip karty (typ, priorytet, health…) — kolor TYLKO w kropce. */
export interface StandardGridCardChip {
  id: string;
  label: string;
  icon?: LucideIcon;
  tone?: ChipTone;
}

/** Metryka stopki (budżet, ROI, termin…) — cichy tekst, kolor tylko gdy sygnał. */
export interface StandardGridCardMetric {
  id: string;
  icon?: LucideIcon;
  label: string;
  tone?: StatusTone;
}

/**
 * Model danych JEDNEJ karty. Moduł buduje ten kształt ze swojej domeny
 * (initiative / assessment / report / deck / rekord tabeli…) i przekazuje do
 * renderera.
 */
export interface StandardGridCard {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  statusLabel?: string;
  statusTone?: StatusTone;
  /**
   * Tożsamość kategorii/osi (opcjonalna) — WYŁĄCZNIE zmienna CSS kategoryczna,
   * np. `var(--c-tag-2)`. Ignorowana gdy `urgency !== 'none'` (pilność wygrywa).
   */
  accentColorVar?: string;
  /** Pilność → pasek akcentu ~3px + (CRITICAL) delikatny tint tła (kanon A9). */
  urgency?: StandardGridCardUrgency;
  /** Ciche chipy (typ/priorytet/health…) — neutralna ramka, kolor w kropce. */
  chips?: StandardGridCardChip[];
  /** Pasek postępu 0-100 (neutralny fill — kolor NIE koduje statusu). */
  progress?: number;
  /** Metryki stopki (lewa strona) — np. budżet, ROI. */
  metrics?: StandardGridCardMetric[];
  /** Treść prawej strony stopki — np. "3 dni temu". */
  footerRight?: React.ReactNode;
  /** Inicjały/awatar właściciela (prawy dolny róg stopki, obok footerRight). */
  ownerInitials?: string;
  ownerAvatarUrl?: string;
  ownerName?: string;
  /**
   * Slot dodatkowych, drobnych akcji ikonowych w lewej strefie stopki (np.
   * Export/Otwórz źródło) — dla modułów, które trzymają je OBOK kebaba, nie
   * WEWNĄTRZ niego. Renderujący moduł odpowiada za `stopPropagation`.
   */
  customFooterActions?: React.ReactNode;
  /** Kebab (⋮) — ten sam dropdown co StandardTable. Pomiń gdy brak akcji. */
  rowMenuActions?: RowAction[];
  rowMenuSections?: RowActionSection[];
}

export interface StandardGridCardProps {
  card: StandardGridCard;
  onClick?: () => void;
  isSelected?: boolean;
  className?: string;
}

const URGENCY_ACCENT: Record<StandardGridCardUrgency, string> = {
  none: 'border-l-transparent',
  pending: 'border-l-amber-500',
  critical: 'border-l-danger-500',
};

/**
 * JEDYNY renderer pojedynczej karty grid/kafelkowej. Zob. nagłówek pliku.
 */
export const StandardGridCard: React.FC<StandardGridCardProps> = ({
  card,
  onClick,
  isSelected,
  className,
}) => {
  const urgency = card.urgency ?? 'none';
  const hasMenu = !!(card.rowMenuActions?.length || card.rowMenuSections?.length);
  const accentStyle =
    urgency === 'none' && card.accentColorVar ? { borderLeftColor: card.accentColorVar } : undefined;

  return (
    <div
      onClick={onClick}
      data-testid={`standard-grid-card-${card.id}`}
      style={accentStyle}
      className={cn(
        'group relative flex flex-col rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-3 cursor-pointer select-none',
        'border-l-[3px] shadow-token-card hover:shadow-token-card-hover transition-shadow duration-150',
        !accentStyle && URGENCY_ACCENT[urgency],
        urgency === 'critical' && 'bg-danger-500/[0.04] dark:bg-danger-500/[0.06]',
        isSelected && 'ring-2 ring-c-focus',
        className
      )}
    >
      {/* Nagłówek — status pill + kebab */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {card.statusLabel ? (
            <StatusChip label={card.statusLabel} tone={card.statusTone ?? 'neutral'} />
          ) : null}
        </div>
        {hasMenu ? (
          <div
            className="shrink-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 data-[open=true]:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <RowActionsMenu actions={card.rowMenuActions} sections={card.rowMenuSections} size="sm" />
          </div>
        ) : null}
      </div>

      {/* Tytuł + podtytuł + opis */}
      <div className="mt-2">
        <h4 className="min-w-0 text-sm font-semibold text-c-text leading-snug line-clamp-2">
          {card.title}
        </h4>
        {card.subtitle ? (
          <p className="mt-0.5 text-xs text-c-text-muted truncate">{card.subtitle}</p>
        ) : null}
        {card.description ? (
          <p className="mt-1 text-xs text-c-text-muted leading-relaxed line-clamp-2">
            {card.description}
          </p>
        ) : null}
      </div>

      {/* Ciche chipy */}
      {card.chips?.length ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {card.chips.map((chip) => {
            const Icon = chip.icon;
            const toneVar =
              chip.tone && chip.tone !== 'neutral'
                ? CHIP_TONE_VAR[chip.tone as Exclude<ChipTone, 'neutral'>]
                : undefined;
            return (
              <MetaChip
                key={chip.id}
                label={
                  <span className="inline-flex items-center gap-1">
                    {toneVar ? <ChipDot colorVar={toneVar} /> : null}
                    {chip.label}
                  </span>
                }
                icon={Icon}
                title={chip.label}
              />
            );
          })}
        </div>
      ) : null}

      {/* Pasek postępu — neutralny fill, TEKST obok podaje % (kolor nie koduje statusu) */}
      {typeof card.progress === 'number' ? (
        <div className="mt-2.5 flex items-center gap-2">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-c-border-subtle">
            <div
              className="h-full rounded-full bg-c-text-muted/60"
              style={{ width: `${Math.max(0, Math.min(100, card.progress))}%` }}
            />
          </div>
          <span className="text-[11px] text-c-text-muted">{Math.round(card.progress)}%</span>
        </div>
      ) : null}

      {/* Stopka: metryki/akcje (lewo) — footerRight + awatar (prawo) */}
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-c-border-subtle pt-2 mt-2">
        <div className="flex min-w-0 items-center gap-3">
          {card.metrics?.map((metric) => {
            const Icon = metric.icon;
            const toneClass =
              metric.tone && metric.tone !== 'neutral'
                ? {
                    success: 'text-c-success',
                    warning: 'text-c-warning',
                    danger: 'text-c-danger',
                    info: 'text-c-info',
                  }[metric.tone]
                : 'text-c-text-muted';
            return (
              <span
                key={metric.id}
                className={cn('inline-flex shrink-0 items-center gap-1 text-[11px] font-medium', toneClass)}
              >
                {Icon ? <Icon size={12} className="shrink-0" aria-hidden="true" /> : null}
                {metric.label}
              </span>
            );
          })}
          {card.customFooterActions ? (
            <span
              className="inline-flex shrink-0 items-center opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              {card.customFooterActions}
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {card.footerRight ? (
            <span className="truncate text-[11px] text-c-text-muted">{card.footerRight}</span>
          ) : null}
          {card.ownerInitials || card.ownerAvatarUrl ? (
            <div
              className="h-5 w-5 shrink-0 overflow-hidden rounded-full bg-c-surface-raised text-[10px] font-bold text-c-text-secondary ring-1 ring-c-border-subtle flex items-center justify-center"
              title={card.ownerName ?? card.ownerInitials}
            >
              {card.ownerAvatarUrl ? (
                <img src={card.ownerAvatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                card.ownerInitials
              )}
            </div>
          ) : hasMenu || card.metrics?.length || card.footerRight ? null : (
            <div className="h-5 w-5 shrink-0 rounded-full bg-c-surface-raised flex items-center justify-center">
              <User size={10} className="text-c-text-muted" aria-hidden="true" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Re-export ikony kebaba dla wygody konsumentów budujących rowMenuActions.
export { MoreVertical as StandardGridCardKebabIcon };

export default StandardGridCard;
