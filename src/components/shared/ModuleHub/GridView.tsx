/**
 * GridView — kafelkowy widok alternatywny wobec tabeli.
 *
 * Reużywany w: Assessment, Economics, Benefits, Presentations, Discovery,
 * Reports&Presentations (Templates/Reports tab). Renderuje przez JEDEN kanon
 * karty grid `StandardGridCard` (#76a, analogicznie do #75b
 * `StandardKanbanCard`) — moduł DEKLARUJE treść (mapowanie `GridItem` →
 * `StandardGridCard`), powłoka NARZUCA wygląd.
 *
 * Poprzednia wersja miała crimson-leak: status SCHEDULED i typy DRD/digital
 * używały tła/obramowania/tekstu z palety `primary` jako DEKORACYJNY akcent —
 * złamanie kanonu "primary=crimson TYLKO semantyka krytyczna". Naprawione:
 * status → `StatusChip` (success/warning/danger/info/neutral), tożsamość
 * typu → akcent 3px z palety kategorycznej `--c-tag-1..10` (nigdy primary).
 *
 * SSOT: docs/ui-standards/TRIADA_KANON.md.
 */

import type { TFunction } from 'i18next';
import { Copy, Trash2 } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { RowAction } from '@/components/shared/RowActionsMenu';
import {
  StandardGridCard,
  type StandardGridCard as StandardGridCardData,
} from '@/components/standard';
import type { StatusTone } from '@/components/ui/primitives/chips/StatusChip';

export interface GridItem {
  id: string;
  name: string;
  type: string;
  typeColor: string;
  status: string;
  progress: number;
  updatedAt: Date | string;
  [key: string]: any;
}

interface GridViewProps {
  items: GridItem[];
  /** Optional: highlight a selected card (for Cards+Preview layouts). */
  selectedItemId?: string | null;
  onItemClick?: (item: GridItem) => void;
  onItemAction?: (action: string, item: GridItem) => void;
  onNewItem?: () => void;
  newItemLabel?: string;
  emptyMessage?: string;
  /** Optional extra action buttons rendered per card (e.g. Export, Open Source) */
  extraCardActions?: (item: GridItem) => React.ReactNode;
}

// Status → StatusTone (kanon: neutral/success/warning/danger/info — NIGDY crimson jako dekoracja)
const STATUS_TONE: Record<string, StatusTone> = {
  DRAFT: 'neutral',
  PENDING_REVIEW: 'warning',
  REVIEW: 'warning',
  PROMOTED: 'info',
  PLANNING: 'info',
  APPROVED: 'success',
  SCHEDULED: 'info', // było primary-*/crimson — naprawione
  EXECUTING: 'info',
  BLOCKED: 'danger',
  DONE: 'success',
  TRACKING: 'info',
  CANCELLED: 'neutral',
  ARCHIVED: 'neutral',
  IN_REVIEW: 'warning',
  AWAITING_APPROVAL: 'warning',
  REJECTED: 'danger',
  GENERATING: 'info',
  FINAL: 'info',
  PENDING_APPROVAL: 'warning',
  UTILIZED: 'info',
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  PENDING_REVIEW: 'Pending Review',
  REVIEW: 'In Review',
  PROMOTED: 'Promoted',
  PLANNING: 'Planning',
  APPROVED: 'Approved',
  SCHEDULED: 'Scheduled',
  EXECUTING: 'Executing',
  BLOCKED: 'Blocked',
  DONE: 'Done',
  TRACKING: 'Tracking',
  CANCELLED: 'Cancelled',
  ARCHIVED: 'Archived',
  IN_REVIEW: 'In Review',
  AWAITING_APPROVAL: 'Awaiting Approval',
  REJECTED: 'Rejected',
  GENERATING: 'Generating',
  FINAL: 'Final',
  PENDING_APPROVAL: 'Pending Approval',
  UTILIZED: 'Utilized',
};

// Typ/kategoria → akcent 3px, WYŁĄCZNIE paleta kategoryczna --c-tag-1..10 (nigdy primary/crimson).
const TYPE_ACCENT_VAR: Record<string, string> = {
  DRD: 'var(--c-tag-2)', // było crimson (primary-500) — naprawione
  SIRI: 'var(--c-tag-1)',
  ADMA: 'var(--c-tag-1)',
  CMMI: 'var(--c-tag-9)',
  LEAN: 'var(--c-tag-6)',
  strategic: 'var(--c-tag-6)',
  operational: 'var(--c-tag-1)',
  digital: 'var(--c-tag-2)', // było crimson (primary-500) — naprawione
  automation: 'var(--c-tag-9)',
};
const FALLBACK_ACCENT_VAR = 'var(--c-tag-8)'; // slate — nieznany typ

// Format relative time
const formatRelativeTime = (date: Date | string, t: TFunction) => {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (hours < 1) return t('sharedComponents.gridView.justNow');
  if (hours < 24) return t('sharedComponents.gridView.hoursAgo', { count: hours });
  if (days < 7) return t('sharedComponents.gridView.daysAgo', { count: days });
  return d.toLocaleDateString();
};

export const GridView: React.FC<GridViewProps> = ({
  items,
  selectedItemId,
  onItemClick,
  onItemAction,
  onNewItem,
  newItemLabel = 'New Item',
  emptyMessage = 'No items found',
  extraCardActions,
}) => {
  const { t } = useTranslation();

  const labels = useMemo(
    () => ({
      open: t('sharedComponents.gridView.open'),
      duplicate: t('sharedComponents.gridView.duplicate'),
      edit: t('sharedComponents.gridView.edit'),
      delete: t('sharedComponents.gridView.delete'),
      newItem: newItemLabel || t('sharedComponents.gridView.newItemDefault'),
      empty: emptyMessage || t('sharedComponents.gridView.emptyDefault'),
    }),
    [t, newItemLabel, emptyMessage]
  );

  const toGridCard = (item: GridItem): StandardGridCardData => {
    const title = String(item.name ?? '');
    const rawBrief = String(item.brief ?? item.summary ?? item.description ?? '').trim();
    const description =
      rawBrief
        .split('\n')
        .find((l) => l.trim().length > 0)
        ?.trim() || '';

    const rowMenuActions: RowAction[] = [];
    if (onItemAction) {
      rowMenuActions.push(
        { id: 'open', label: labels.open, onClick: () => onItemAction('open', item) },
        {
          id: 'duplicate',
          label: labels.duplicate,
          icon: Copy,
          onClick: () => onItemAction('duplicate', item),
        },
        {
          id: 'rename',
          label: labels.edit,
          onClick: () => onItemAction('rename', item),
          divider: true,
        },
        {
          id: 'delete',
          label: labels.delete,
          icon: Trash2,
          onClick: () => onItemAction('delete', item),
          variant: 'danger',
        }
      );
    }

    const extra = extraCardActions?.(item);

    return {
      id: item.id,
      title,
      description,
      statusLabel: STATUS_LABEL[item.status] ?? item.status,
      statusTone: STATUS_TONE[item.status] ?? 'neutral',
      accentColorVar:
        TYPE_ACCENT_VAR[item.type] ?? TYPE_ACCENT_VAR[item.typeColor] ?? FALLBACK_ACCENT_VAR,
      chips: item.type ? [{ id: 'type', label: String(item.type) }] : undefined,
      progress: typeof item.progress === 'number' ? item.progress : undefined,
      footerRight: formatRelativeTime(item.updatedAt, t),
      customFooterActions: extra ?? undefined,
      rowMenuActions: rowMenuActions.length ? rowMenuActions : undefined,
    };
  };

  if (items.length === 0 && !onNewItem) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-500">{emptyMessage}</div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
      {items.map((item) => (
        <StandardGridCard
          key={item.id}
          card={toGridCard(item)}
          onClick={() => onItemClick?.(item)}
          isSelected={Boolean(selectedItemId && item.id === selectedItemId)}
        />
      ))}

      {/* Add New Card */}
      {onNewItem && (
        <button
          onClick={onNewItem}
          className="
            flex flex-col items-center justify-center gap-2
            min-h-[180px] rounded-xl border-2 border-dashed border-slate-300 dark:border-navy-600
            text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-400 dark:hover:border-white/[0.18]
            transition-all
          "
        >
          <PlusIcon />
          <span className="text-sm font-medium">{labels.newItem}</span>
        </button>
      )}
    </div>
  );
};

const PlusIcon: React.FC = () => (
  // Lokalny inline SVG zamiast dodatkowego importu — identyczny wygląd co lucide Plus 24px.
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M5 12h14" />
    <path d="M12 5v14" />
  </svg>
);

export default GridView;
