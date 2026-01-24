/**
 * Portfolio Grid View
 *
 * Simple card grid layout - no drag-and-drop, just clickable initiative cards.
 */

import { Calendar, DollarSign, TrendingUp } from 'lucide-react';
import React from 'react';

import { getAxisColor, getPriorityColors, getStatusColors } from '../../config/portfolioColors';
import { PortfolioInitiative } from '../../types';

interface PortfolioGridViewProps {
  initiatives: PortfolioInitiative[];
  onInitiativeClick: (initiative: PortfolioInitiative) => void;
}

// ============================================
// INITIATIVE CARD COMPONENT
// ============================================

interface InitiativeCardProps {
  initiative: PortfolioInitiative;
  onClick: () => void;
}

const InitiativeCard: React.FC<InitiativeCardProps> = ({ initiative, onClick }) => {
  const priorityColors = getPriorityColors(initiative.priority);
  const statusColors = getStatusColors(initiative.status);
  const axisColor = getAxisColor(initiative.axis);

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return `$${amount}`;
  };

  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 
                p-5 cursor-pointer group hover:shadow-lg hover:border-purple-300 dark:hover:border-purple-600 
                transition-all duration-200"
    >
      {/* Priority bar */}
      <div className={`h-1.5 -mx-5 -mt-5 mb-4 rounded-t-xl ${priorityColors.bg}`} />

      {/* Header: Name + Status */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex-1 min-w-0">
          <h4
            className="font-semibold text-navy-900 dark:text-white text-base line-clamp-2 
                        group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors"
          >
            {initiative.name}
          </h4>
          {initiative.projectName && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 truncate">
              {initiative.projectName}
            </p>
          )}
        </div>
        <span
          className={`shrink-0 px-2.5 py-1 text-xs font-medium rounded-lg ${statusColors.bg} ${statusColors.text}`}
        >
          {initiative.status}
        </span>
      </div>

      {/* Axis indicator + Priority */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className={`w-1.5 h-8 rounded-full ${axisColor.bg}`}
          title={`Axis: ${initiative.axis || 'N/A'}`}
        />
        <span
          className={`px-2.5 py-1 text-xs font-medium rounded-full ${priorityColors.bg} ${priorityColors.text}`}
        >
          {initiative.priority}
        </span>
        {initiative.isCriticalPath && (
          <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
            Critical Path
          </span>
        )}
      </div>

      {/* Owner */}
      {initiative.ownerBusiness && (
        <div className="flex items-center gap-2 mb-4">
          <div
            className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center 
                          text-xs font-medium text-purple-700 dark:text-purple-300 overflow-hidden"
          >
            {initiative.ownerBusiness.avatarUrl ? (
              <img
                src={initiative.ownerBusiness.avatarUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              `${initiative.ownerBusiness.firstName?.[0] || ''}${initiative.ownerBusiness.lastName?.[0] || ''}`
            )}
          </div>
          <span className="text-sm text-slate-600 dark:text-slate-400 truncate">
            {initiative.ownerBusiness.firstName} {initiative.ownerBusiness.lastName}
          </span>
        </div>
      )}

      {/* Timeline */}
      {initiative.targetQuarter && (
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-4">
          <Calendar size={14} />
          <span>{initiative.targetQuarter}</span>
        </div>
      )}

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400 mb-2">
          <span>Progress</span>
          <span className="font-medium">{initiative.progress || 0}%</span>
        </div>
        <div className="h-2 bg-slate-200 dark:bg-navy-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-purple-600 rounded-full transition-all"
            style={{ width: `${initiative.progress || 0}%` }}
          />
        </div>
      </div>

      {/* Footer: Budget & ROI */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-navy-700">
        <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400">
          <DollarSign size={14} />
          <span className="font-medium">{formatCurrency(initiative.budget || 0)}</span>
        </div>
        {initiative.expectedRoi && initiative.expectedRoi > 0 && (
          <div className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
            <TrendingUp size={14} />
            <span className="font-medium">{initiative.expectedRoi.toFixed(1)}x ROI</span>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================
// MAIN GRID VIEW
// ============================================

export const PortfolioGridView: React.FC<PortfolioGridViewProps> = ({
  initiatives,
  onInitiativeClick,
}) => {
  return (
    <div className="h-full overflow-auto p-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {initiatives.map((initiative) => (
          <InitiativeCard
            key={initiative.id}
            initiative={initiative}
            onClick={() => onInitiativeClick(initiative)}
          />
        ))}
      </div>

      {initiatives.length === 0 && (
        <div className="flex items-center justify-center h-64 text-slate-400 dark:text-slate-500">
          <p>No initiatives found</p>
        </div>
      )}
    </div>
  );
};

export default PortfolioGridView;
