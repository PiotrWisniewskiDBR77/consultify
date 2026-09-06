/**
 * Portfolio Grid View
 *
 * Widok kafelkowy inicjatyw portfolio — renderuje przez JEDEN kanon karty grid
 * `StandardGridCard` (#76a, analogicznie do #75b `StandardKanbanCard`). Moduł
 * DEKLARUJE treść (mapowanie `PortfolioInitiative` → `StandardGridCard`),
 * powłoka NARZUCA wygląd (status-pill, akcent osi przez `--c-tag-*`, cichy
 * chip priorytetu, klik → preview — bez zmiany kontraktu `onInitiativeClick`).
 *
 * Odbiór na żywo 05.09 (`16-kanon/standard-grid-card`, ROZNI_SIE): ekran
 * Inicjatywy → Siatka renderował `InitiativeGridCard` (bespoke JSX osobny od
 * tego pliku) — WŁAŚNIE ten komponent, mimo że napisany dla dokładnie tego
 * ekranu, nie miał ani jednego wołacza (zob. `InitiativesHub.tsx`). Skutek:
 * realna karta nie miała paska akcentu kategorii/pilności, paska postępu ani
 * kebaba — dokładnie te trzy elementy kanonu #76a, które ten plik już budował.
 * Naprawa: `InitiativesHub` renderuje teraz TEN komponent; dodano kebab
 * (`rowMenuSections`, te same 5 bloków co wiersz tabeli — `onArchive`/
 * `onOpenFull` przyjęte jako propsy, tak jak wcześniej przyjmował je
 * `InitiativeGridCard`) — jedyny brakujący kawałek kontraktu.
 */

import { Archive, Calendar, ChevronRight, Clock, DollarSign, Edit2, RotateCcw, TrendingUp, Trash2 } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { getAxisColor } from '../../config/portfolioColors';
import { STATUS_METADATA } from '../../services/initiativeLifecycle';
import { InitiativeStatus, PortfolioInitiative } from '../../types';
import { formatRoiDisplay } from '../../utils/safeFormat';
import type { RowAction, RowActionSection } from '../shared/RowActionsMenu';
import { StandardGridCard, type StandardGridCard as StandardGridCardData } from '../standard';
import type { StatusTone } from '../ui/primitives/chips/StatusChip';

// ============================================
// MAPOWANIE DOMENY → KANON (status/priorytet/oś)
// ============================================

const STATUS_TONE: Record<string, StatusTone> = {
  DRAFT: 'neutral',
  PENDING_REVIEW: 'warning',
  REVIEW: 'warning',
  PROMOTED: 'info',
  PLANNING: 'info',
  APPROVED: 'success',
  SCHEDULED: 'info',
  EXECUTING: 'info',
  BLOCKED: 'danger',
  DONE: 'success',
  TRACKING: 'info',
  CANCELLED: 'neutral',
  ARCHIVED: 'neutral',
};

const PRIORITY_TONE: Record<string, 'danger' | 'warning' | 'accent' | 'neutral'> = {
  CRITICAL: 'danger',
  HIGH: 'warning',
  MEDIUM: 'accent',
  LOW: 'neutral',
};

const formatCurrency = (amount: number) => {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
  return `$${amount}`;
};

/** Oś → zmienna CSS kategoryczna (`--c-tag-1..7`), NIGDY primary/crimson. */
function axisAccentVar(axis: string): string | undefined {
  const cls = getAxisColor(axis || 'processes').text; // np. 'text-c-tag-2'
  const varName = cls.replace('text-', '');
  return varName.startsWith('c-tag-') ? `var(--${varName})` : undefined;
}

function toGridCard(initiative: PortfolioInitiative, t: (key: string) => string): StandardGridCardData {
  const chips: StandardGridCardData['chips'] = [
    {
      id: 'priority',
      label: initiative.priority,
      tone: PRIORITY_TONE[initiative.priority] ?? 'neutral',
    },
  ];
  if (initiative.isCriticalPath) {
    chips.push({ id: 'critical-path', label: 'Critical Path', tone: 'danger' });
  }

  const owner = initiative.ownerBusiness;
  const ownerInitials = owner
    ? `${owner.firstName?.[0] ?? ''}${owner.lastName?.[0] ?? ''}`
    : undefined;

  const metrics: StandardGridCardData['metrics'] = [
    { id: 'budget', icon: DollarSign, label: formatCurrency(initiative.budget || 0) },
  ];
  if (initiative.expectedRoi && initiative.expectedRoi > 0) {
    metrics.push({
      id: 'roi',
      icon: TrendingUp,
      label: `${formatRoiDisplay(initiative.expectedRoi)} ROI`,
      tone: 'success',
    });
  }
  if (initiative.targetQuarter) {
    metrics.push({ id: 'quarter', icon: Calendar, label: initiative.targetQuarter });
  }

  return {
    id: initiative.id,
    title: initiative.name,
    subtitle: initiative.projectName,
    statusLabel: t(
      STATUS_METADATA[initiative.status as InitiativeStatus]?.labelKey ?? 'initiatives.status.unknown'
    ),
    statusTone: STATUS_TONE[initiative.status] ?? 'neutral',
    accentColorVar: axisAccentVar(initiative.axis),
    chips,
    progress: initiative.progress ?? 0,
    metrics,
    ownerInitials,
    ownerAvatarUrl: owner?.avatarUrl,
    ownerName: owner ? `${owner.firstName ?? ''} ${owner.lastName ?? ''}`.trim() : undefined,
  };
}

// ============================================
// KEBAB — identyczne 5 bloków co wiersz tabeli (kanon A6, wzorem
// `InitiativeGridCard`, jedynego wcześniejszego miejsca z tą logiką).
// ============================================

function buildKebabSections(
  initiative: PortfolioInitiative,
  opts: {
    isPolish: boolean;
    onClick: () => void;
    onArchive?: (initiative: PortfolioInitiative) => void;
    onOpenFull?: (initiative: PortfolioInitiative) => void;
  }
): RowActionSection[] {
  const { isPolish, onClick, onArchive, onOpenFull } = opts;
  const comingSoonBackend = isPolish ? 'Wkrótce (backend)' : 'Soon (backend)';
  const archiveable = ([InitiativeStatus.CLOSED, InitiativeStatus.REJECTED] as string[]).includes(
    initiative.status
  );

  const fixedActions: RowAction[] = [
    {
      id: 'open-preview',
      label: isPolish ? 'Otwórz podgląd' : 'Open preview',
      icon: ChevronRight,
      onClick,
    },
    ...(onOpenFull
      ? [
          {
            id: 'open-full',
            label: isPolish ? 'Otwórz pełny widok' : 'Open full view',
            icon: ChevronRight,
            onClick: () => onOpenFull(initiative),
          },
        ]
      : []),
    {
      id: 'edit',
      label: isPolish ? 'Edytuj' : 'Edit',
      icon: Edit2,
      onClick,
    },
    initiative.status === InitiativeStatus.CLOSED
      ? {
          id: 'restore',
          label: isPolish ? 'Przywróć' : 'Restore',
          icon: RotateCcw,
          disabled: true,
          description: comingSoonBackend,
          onClick: () => {},
        }
      : {
          id: 'archive',
          label: isPolish ? 'Archiwizuj' : 'Archive',
          icon: Archive,
          disabled: !onArchive || !archiveable,
          description:
            !onArchive || !archiveable
              ? isPolish
                ? 'Zakończ lub anuluj najpierw'
                : 'Finish or cancel first'
              : undefined,
          onClick: () => onArchive?.(initiative),
        },
    ...(initiative.plannedEndDate
      ? [
          {
            id: 'delay',
            label: isPolish ? 'Przesuń termin' : 'Delay',
            icon: Clock,
            disabled: true,
            description: comingSoonBackend,
            onClick: () => {},
          },
        ]
      : []),
  ];

  return [
    { id: 'context', kind: 'context', actions: [] },
    { id: 'fixed', kind: 'manage', actions: fixedActions },
    {
      id: 'danger',
      kind: 'danger',
      actions: [
        {
          id: 'delete',
          label: isPolish ? 'Usuń' : 'Delete',
          icon: Trash2,
          variant: 'danger' as const,
          disabled: true,
          description: comingSoonBackend,
          onClick: () => {},
        },
      ],
    },
  ];
}

// ============================================
// MAIN GRID VIEW
// ============================================

interface PortfolioGridViewProps {
  initiatives: PortfolioInitiative[];
  onInitiativeClick: (initiative: PortfolioInitiative) => void;
  onArchive?: (initiative: PortfolioInitiative) => void;
  onOpenFull?: (initiative: PortfolioInitiative) => void;
}

export const PortfolioGridView: React.FC<PortfolioGridViewProps> = ({
  initiatives,
  onInitiativeClick,
  onArchive,
  onOpenFull,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language?.startsWith('pl');

  return (
    <div className="h-full overflow-auto p-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {initiatives.map((initiative) => {
          const onClick = () => onInitiativeClick(initiative);
          const card: StandardGridCardData = {
            ...toGridCard(initiative, t),
            rowMenuSections: buildKebabSections(initiative, { isPolish, onClick, onArchive, onOpenFull }),
          };
          return <StandardGridCard key={initiative.id} card={card} onClick={onClick} />;
        })}
      </div>

      {initiatives.length === 0 && (
        <div className="flex items-center justify-center h-64 text-c-text-muted">
          <p>{t('initiatives.hub.noInitiativesFound', 'No initiatives found')}</p>
        </div>
      )}
    </div>
  );
};

export default PortfolioGridView;
