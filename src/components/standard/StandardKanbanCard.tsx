/**
 * StandardKanbanCard — JEDEN kanon karty kanban (Triada standard, kanon A9).
 *
 * Zgłoszenie #75b: dziś każdy board (Execution, Portfolio, Decisions, Tasks,
 * Table Platform…) renderuje WŁASNĄ, rozbieżną kartę. To jest JEDYNY dozwolony
 * renderer pojedynczej karty — powłoka NARZUCA wygląd, moduł DEKLARUJE treść
 * przez `StandardKanbanCard` (dane) + handlery. Reużywany:
 *   - wewnątrz fasady tablicy `StandardKanban` (natywny HTML5 DnD), ORAZ
 *   - w istniejących bespoke boardach z własnym dnd-kit — te trzymają swoje
 *     kolumny/DnD, ale kartę renderują TYM komponentem (spread `dragHandleProps`
 *     na uchwyt, `draggable={false}` bo DnD obsługuje wrapper dnd-kit).
 *
 * SSOT wyglądu: docs/ui-standards/TRIADA_KANON.md (część A9/A10). Wygląd spójny
 * z rodziną `src/components/standard/` (te same tokeny c-*, hairline bordery,
 * cichy chip z kolorem TYLKO w kropce, pill-statusy rounded-full, dark+light).
 *
 * ANATOMIA (kanon A9):
 *   - lewy pasek akcentu ~3px wg PILNOŚCI (bursztyn=pending, czerwony=critical;
 *     critical + delikatny tint tła — jedyny kolor powierzchni karty),
 *   - opcjonalny uchwyt drag (grip), tytuł do 2 linii, opis do 2 linii,
 *   - ciche chipy (priorytet/typ/health — neutralna ramka, kolor tylko w kropce),
 *   - stopka: termin (treść steruje kolorem) + awatar właściciela (prawy dół),
 *   - opcjonalny `footer` slot (np. „następna bramka") pod hairline,
 *   - hairline ramka, hover raised.
 *
 * ZAKAZY (kanon A9): pełne czerwone pigułki priorytetu (crimson na CTA/aktywnym),
 * różne wysokości pasków akcentu, bespoke kolory tła karty. Czerwień = TYLKO
 * semantyka krytyczna (pilność/overdue). Fokus/aktywny stan = neutralny/`c-focus`.
 */

import type { LucideIcon } from 'lucide-react';
import { GripVertical, User } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/utils/cn';

import type { ChipTone } from '../ui/primitives/chips/chipBase';
import { CHIP_TONE_VAR, ChipDot } from '../ui/primitives/chips/chipBase';
import { MetaChip } from '../ui/primitives/chips/MetaChip';

/** Pilność karty → pasek akcentu ~3px (kanon A9: TYLKO bursztyn/czerwony/brak). */
export type StandardKanbanUrgency = 'none' | 'pending' | 'critical';

/** Cichy chip karty (priorytet, typ, health…) — kolor TYLKO w kropce (kanon A9). */
export interface StandardKanbanChip {
  id: string;
  label: string;
  icon?: LucideIcon;
  tone?: ChipTone;
}

/**
 * Model danych JEDNEJ karty. Moduł buduje ten kształt ze swojej domeny
 * (initiative / decision / task / rekord tabeli…) i przekazuje do renderera.
 * (Uwaga: nazwa dzielona z komponentem — interfejs żyje w przestrzeni TYPÓW,
 * komponent w przestrzeni WARTOŚCI; TypeScript pozwala na współistnienie.)
 */
export interface StandardKanbanCard {
  id: string;
  columnId: string;
  title: string;
  description?: string;
  /** Ciche chipy (priorytet, typ, health…) — neutralna ramka, kolor w kropce. */
  chips?: StandardKanbanChip[];
  /** Chip projektu/kontekstu (zawsze neutralny — kanon A9). */
  projectLabel?: string;
  /** Termin — treść steruje kolorem (overdue = czerwonawe, inne = szare). */
  dueLabel?: string;
  dueOverdue?: boolean;
  /** Inicjały/awatar właściciela (prawy dolny róg stopki). */
  ownerInitials?: string;
  ownerAvatarUrl?: string;
  /** Pełne imię właściciela → tooltip awatara (kanon: awatar-only, nazwa na hover). */
  ownerName?: string;
  /** Pilność → pasek akcentu ~3px + (CRITICAL) delikatny tint tła. */
  urgency?: StandardKanbanUrgency;
  /** Dodatkowy slot treści pod stopką (np. „następna bramka") — nad hairline. */
  footer?: React.ReactNode;
}

export interface StandardKanbanCardProps {
  card: StandardKanbanCard;
  onClick?: () => void;
  /**
   * Natywny HTML5 DnD (używa fasada `StandardKanban`). Gdy `true` — karta jest
   * `draggable` i pokazuje grip. Dla boardów dnd-kit zostaw `false` i steruj
   * DnD na wrapperze; uchwyt pokaż przez `dragHandleProps`.
   */
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  isDragging?: boolean;
  /**
   * Propsy uchwytu drag dla boardów zewnętrznych (dnd-kit listeners/attributes).
   * Gdy podane — renderuje widoczny grip i spread-uje na niego te propsy.
   */
  dragHandleProps?: Record<string, unknown>;
  className?: string;
}

const URGENCY_ACCENT: Record<StandardKanbanUrgency, string> = {
  none: 'border-l-transparent',
  pending: 'border-l-amber-500',
  critical: 'border-l-danger-500',
};

/**
 * JEDYNY renderer pojedynczej karty kanban. Zob. nagłówek pliku.
 */
export const StandardKanbanCard: React.FC<StandardKanbanCardProps> = ({
  card,
  onClick,
  draggable = false,
  onDragStart,
  isDragging,
  dragHandleProps,
  className,
}) => {
  const { t } = useTranslation();
  const urgency = card.urgency ?? 'none';
  // Grip widoczny gdy: natywny DnD (draggable) LUB podano uchwyt dnd-kit.
  const showGrip = draggable || !!dragHandleProps;
  // Wcięcie treści pod grip, żeby tekst nie „wjeżdżał" pod uchwyt.
  const indent = showGrip;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!onClick) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={onClick}
      onKeyDown={onClick ? handleKeyDown : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      data-testid={`standard-kanban-card-${card.id}`}
      className={cn(
        'group rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-3 cursor-pointer select-none',
        'border-l-[3px] shadow-token-card hover:shadow-token-card-hover transition-shadow duration-fast ease-standard',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]',
        URGENCY_ACCENT[urgency],
        urgency === 'critical' && 'bg-danger-500/[0.04] dark:bg-danger-500/[0.06]',
        isDragging && 'opacity-40',
        className
      )}
    >
      <div className="flex items-start gap-1.5">
        {showGrip ? (
          <span
            {...(dragHandleProps ?? {})}
            className="mt-0.5 shrink-0 cursor-grab text-c-text-muted opacity-0 group-hover:opacity-100 transition-opacity active:cursor-grabbing"
            aria-hidden="true"
          >
            <GripVertical size={14} />
          </span>
        ) : null}
        <h4 className="min-w-0 flex-1 text-sm font-semibold text-c-text leading-snug line-clamp-2">
          {card.title}
        </h4>
      </div>

      {card.description ? (
        <p
          className={cn(
            'mt-1 text-xs text-c-text-muted leading-relaxed line-clamp-2',
            indent && 'pl-5'
          )}
        >
          {card.description}
        </p>
      ) : null}

      {card.chips?.length || card.projectLabel ? (
        <div className={cn('mt-2 flex flex-wrap items-center gap-1.5', indent && 'pl-5')}>
          {card.chips?.map((chip) => {
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
          {card.projectLabel ? (
            <MetaChip label={card.projectLabel} className="max-w-[120px] truncate" />
          ) : null}
        </div>
      ) : null}

      <div className={cn('mt-2 flex items-center justify-between', indent && 'pl-5')}>
        {card.dueLabel ? (
          <span
            className={cn(
              'text-[11px] font-medium',
              card.dueOverdue ? 'text-danger-500' : 'text-c-text-muted'
            )}
          >
            {card.dueLabel}
          </span>
        ) : (
          <span />
        )}
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
        ) : (
          <div className="h-5 w-5 shrink-0 rounded-full bg-c-surface-raised flex items-center justify-center">
            <User size={10} className="text-c-text-muted" aria-hidden="true" />
          </div>
        )}
      </div>

      {card.footer ? (
        <div className={cn('mt-2 border-t border-c-border-subtle pt-2', indent && 'pl-5')}>
          {card.footer}
        </div>
      ) : null}

      {draggable ? (
        <span className="sr-only">{t('common.dragToMove', 'Drag to move to another column')}</span>
      ) : null}
    </div>
  );
};

export default StandardKanbanCard;
