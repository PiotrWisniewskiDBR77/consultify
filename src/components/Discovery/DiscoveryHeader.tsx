/**
 * DiscoveryHeader - Header with phase indicator and client info
 */

import { Building2, ChevronRight, Plus, User } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { useDiscoveryStore } from '@/store/useDiscoveryStore';
import { DiscoveryPhase, PHASE_CONFIGS } from '@/types/discovery';

// Phase indicator
const PhaseIndicator: React.FC<{ currentPhase: DiscoveryPhase }> = ({ currentPhase }) => {
  const { t } = useTranslation('discovery');

  const mainPhases: DiscoveryPhase[] = [
    'ice_breaking',
    'pain_discovery',
    'impact_assessment',
    'recommendations',
    'decision',
  ];
  const currentIndex = mainPhases.indexOf(currentPhase);

  return (
    <div className="flex items-center gap-1">
      {mainPhases.map((phase, index) => {
        const config = PHASE_CONFIGS.find((p) => p.id === phase);
        const isActive = phase === currentPhase;
        const isPast = index < currentIndex;
        const isFuture = index > currentIndex;

        return (
          <React.Fragment key={phase}>
            <div
              className={`
                                flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-all
                                ${isActive ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' : ''}
                                ${isPast ? 'text-green-600 dark:text-green-400' : ''}
                                ${isFuture ? 'text-slate-400 dark:text-slate-500' : ''}
                            `}
              title={config?.descriptionPl || config?.description}
            >
              {isPast && <span className="text-green-500">✓</span>}
              {isActive && <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />}
              <span className="hidden md:inline">{config?.titlePl || config?.title}</span>
              <span className="md:hidden">{index + 1}</span>
            </div>
            {index < mainPhases.length - 1 && (
              <ChevronRight size={14} className="text-slate-300 dark:text-slate-600" />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// Client context badge
const ClientBadge: React.FC = () => {
  const { t } = useTranslation('discovery');
  const { clientContext } = useDiscoveryStore();

  if (!clientContext.companyName && !clientContext.industry) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 bg-slate-50 dark:bg-navy-800 rounded-lg border border-slate-200 dark:border-navy-700">
      {clientContext.companyName && (
        <div className="flex items-center gap-1.5">
          <Building2 size={14} className="text-slate-400 dark:text-slate-500" />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {clientContext.companyName}
          </span>
        </div>
      )}
      {clientContext.industry && (
        <span className="text-xs text-slate-500 dark:text-slate-400 px-2 py-0.5 bg-slate-100 dark:bg-navy-700 rounded">
          {clientContext.industry}
        </span>
      )}
      {clientContext.size && (
        <span className="text-xs text-slate-500 dark:text-slate-400">{clientContext.size}</span>
      )}
      {clientContext.role && (
        <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
          <User size={12} />
          {clientContext.role}
        </div>
      )}
    </div>
  );
};

interface DiscoveryHeaderProps {
  onNewSession?: () => void;
}

export const DiscoveryHeader: React.FC<DiscoveryHeaderProps> = ({ onNewSession }) => {
  const { t } = useTranslation('discovery');
  const { currentPhase, activeSessionId } = useDiscoveryStore();

  return (
    <div className="flex items-center justify-between gap-4 p-3 bg-white dark:bg-navy-800 border-b border-slate-200 dark:border-navy-700">
      {/* Left: Title and phase */}
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-lg font-bold text-navy-900 dark:text-white">
            {t('discovery.title', 'Discovery Consultant')}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t('discovery.subtitle', 'AI-powered consultant conversation')}
          </p>
        </div>
        <div className="hidden lg:block">
          <PhaseIndicator currentPhase={currentPhase} />
        </div>
      </div>

      {/* Right: Client info and actions */}
      <div className="flex items-center gap-3">
        <ClientBadge />
        <button
          onClick={onNewSession}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700 rounded-lg transition-colors"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">{t('discovery.header.newSession', 'New')}</span>
        </button>
      </div>
    </div>
  );
};

export default DiscoveryHeader;
