/**
 * Portfolio Grid View
 *
 * Widok kafelkowy inicjatyw portfolio — renderuje przez JEDEN kanon karty grid
 * `StandardGridCard` (#76a, analogicznie do #75b `StandardKanbanCard`). Moduł
 * DEKLARUJE treść (mapowanie `PortfolioInitiative` → `StandardGridCard`),
 * powłoka NARZUCA wygląd (status-pill, akcent osi przez `--c-tag-*`, cichy
 * chip priorytetu, klik → preview — bez zmiany kontraktu `onInitiativeClick`).
 */

import { Calendar, DollarSign, TrendingUp } from 'lucide-react';
import React from 'react';

import { getAxisColor } from '../../config/portfolioColors';
import { PortfolioInitiative } from '../../types';
import { formatRoiDisplay } from '../../utils/safeFormat';
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

function toGridCard(initiative: PortfolioInitiative): StandardGridCardData {
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
    statusLabel: initiative.status,
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
// MAIN GRID VIEW
// ============================================

interface PortfolioGridViewProps {
  initiatives: PortfolioInitiative[];
  onInitiativeClick: (initiative: PortfolioInitiative) => void;
}

export const PortfolioGridView: React.FC<PortfolioGridViewProps> = ({
  initiatives,
  onInitiativeClick,
}) => {
  return (
    <div className="h-full overflow-auto p-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {initiatives.map((initiative) => (
          <StandardGridCard
            key={initiative.id}
            card={toGridCard(initiative)}
            onClick={() => onInitiativeClick(initiative)}
          />
        ))}
      </div>

      {initiatives.length === 0 && (
        <div className="flex items-center justify-center h-64 text-c-text-muted">
          <p>No initiatives found</p>
        </div>
      )}
    </div>
  );
};

export default PortfolioGridView;
