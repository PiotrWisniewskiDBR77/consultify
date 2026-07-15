/**
 * PorterRadar - Porter's Five Forces radar visualization
 *
 * Displays a 5-axis radar chart showing force intensities.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

import { ForceData, PorterData } from '@/store/useToolStore';

// ==================== TYPES ====================

interface PorterRadarProps {
  data: PorterData;
  isPolish: boolean;
}

// ==================== CONSTANTS ====================

const FORCE_CONFIG = {
  rivalry: {
    label: { en: 'Competitive Rivalry', pl: 'Rywalizacja konkurencyjna' },
    shortLabel: { en: 'Rivalry', pl: 'Rywalizacja' },
    color: '#f43f5e',
  },
  newEntrants: {
    label: { en: 'New Entrants', pl: 'Nowi gracze' },
    shortLabel: { en: 'Entrants', pl: 'Wejście' },
    color: '#f59e0b',
  },
  substitutes: {
    label: { en: 'Substitutes', pl: 'Substytuty' },
    shortLabel: { en: 'Substitutes', pl: 'Substytuty' },
    color: '#6366f1',
  },
  buyerPower: {
    label: { en: 'Buyer Power', pl: 'Siła nabywców' },
    shortLabel: { en: 'Buyers', pl: 'Nabywcy' },
    color: '#3b82f6',
  },
  supplierPower: {
    label: { en: 'Supplier Power', pl: 'Siła dostawców' },
    shortLabel: { en: 'Suppliers', pl: 'Dostawcy' },
    color: '#10b981',
  },
};

// ==================== COMPONENT ====================

export const PorterRadar: React.FC<PorterRadarProps> = ({ data, isPolish }) => {
  const { t } = useTranslation();
  const lang = isPolish ? 'pl' : 'en';
  const forces = data.forces;

  // Calculate overall attractiveness (inverse of average force score)
  const avgScore = Object.values(forces).reduce((sum, f) => sum + f.score, 0) / 5;
  const attractiveness = 6 - avgScore; // Convert to attractiveness (1-5)

  // Render force bar
  const renderForceBar = (forceId: keyof typeof FORCE_CONFIG, force: ForceData) => {
    const config = FORCE_CONFIG[forceId];
    const percentage = (force.score / 5) * 100;

    return (
      <div key={forceId} className="space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-700 dark:text-slate-300">{config.label[lang]}</span>
          <div className="flex items-center gap-2">
            <span
              className={`
              px-1.5 py-0.5 text-xs rounded
              ${
                force.trend === 'increasing'
                  ? 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300'
                  : force.trend === 'decreasing'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                    : 'bg-slate-100 text-slate-600 dark:bg-navy-700 dark:text-slate-400'
              }
            `}
            >
              {force.trend === 'increasing' ? '↑' : force.trend === 'decreasing' ? '↓' : '→'}
            </span>
            <span className="font-medium text-slate-900 dark:text-white">{force.score}/5</span>
          </div>
        </div>
        <div className="h-2 rounded-full bg-slate-200 dark:bg-navy-700 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${percentage}%`,
              backgroundColor: config.color,
            }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Overall attractiveness */}
      <div className="p-4 rounded-lg bg-gradient-to-r from-slate-50 to-slate-100 dark:from-navy-800 dark:to-navy-900 border border-slate-200 dark:border-navy-700">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-slate-900 dark:text-white">
              {t('discoveryToolsSteps.porterRadar.industryAttractiveness')}
            </h4>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('discoveryToolsSteps.porterRadar.inverseHint')}
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-primary-600 dark:text-primary-400">
              {attractiveness.toFixed(1)}
            </div>
            <div className="text-xs text-slate-600">/ 5</div>
          </div>
        </div>

        {/* Attractiveness scale */}
        <div className="mt-4">
          <div className="h-3 rounded-full bg-gradient-to-r from-danger-500 via-amber-500 to-emerald-500 relative">
            <div
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 border-slate-400 shadow"
              style={{ left: `${((attractiveness - 1) / 4) * 100}%`, marginLeft: '-8px' }}
            />
          </div>
          <div className="flex justify-between mt-1 text-xs text-slate-600">
            <span>{t('discoveryToolsSteps.porterRadar.low')}</span>
            <span>{t('discoveryToolsSteps.porterRadar.high')}</span>
          </div>
        </div>
      </div>

      {/* Force bars */}
      <div className="space-y-4">
        {Object.entries(forces).map(([forceId, force]) =>
          renderForceBar(forceId as keyof typeof FORCE_CONFIG, force)
        )}
      </div>

      {/* Legend */}
      <div className="p-3 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700">
        <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          {t('discoveryToolsSteps.porterRadar.scoreInterpretation')}
        </h4>
        <div className="grid grid-cols-3 gap-2 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-emerald-500" />
            <span>1-2: {t('discoveryToolsSteps.porterRadar.lowForce')}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-amber-500" />
            <span>3: {t('discoveryToolsSteps.porterRadar.moderate')}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-danger-500" />
            <span>4-5: {t('discoveryToolsSteps.porterRadar.highForce')}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PorterRadar;
