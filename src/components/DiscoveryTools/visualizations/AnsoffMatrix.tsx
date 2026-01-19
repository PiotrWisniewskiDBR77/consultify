/**
 * AnsoffMatrix - Growth Paths visualization (Ansoff Matrix)
 *
 * Displays a 2x2 matrix showing growth opportunities:
 * - Market Penetration (Existing Products + Existing Markets)
 * - Market Development (Existing Products + New Markets)
 * - Product Development (New Products + Existing Markets)
 * - Diversification (New Products + New Markets)
 */

import React from 'react';
import { TrendingUp, Globe, Boxes, Sparkles, AlertTriangle, CheckCircle } from 'lucide-react';

// ==================== TYPES ====================

export interface GrowthPath {
  id: string;
  quadrant: 'penetration' | 'market_dev' | 'product_dev' | 'diversification';
  opportunity: string;
  roiPotential: 'high' | 'medium' | 'low';
  risk: 'high' | 'medium' | 'low';
  capabilitiesNeeded: string[];
  initiative?: string;
  selected?: boolean;
}

export interface AnsoffData {
  context: {
    currentProducts: string;
    currentMarkets: string;
    growthObjective: string;
    timeframe: 'short' | 'medium' | 'long';
  };
  paths: GrowthPath[];
}

interface AnsoffMatrixProps {
  data: AnsoffData;
  isPolish: boolean;
  onPathClick?: (path: GrowthPath) => void;
}

// ==================== CONSTANTS ====================

const QUADRANT_CONFIG = {
  penetration: {
    label: { en: 'Market Penetration', pl: 'Penetracja Rynku' },
    description: { 
      en: 'Existing Products + Existing Markets', 
      pl: 'Obecne Produkty + Obecne Rynki' 
    },
    color: 'emerald',
    icon: TrendingUp,
    riskLevel: { en: 'Low Risk', pl: 'Niskie Ryzyko' },
    position: 'top-left',
  },
  market_dev: {
    label: { en: 'Market Development', pl: 'Rozwój Rynku' },
    description: { 
      en: 'Existing Products + New Markets', 
      pl: 'Obecne Produkty + Nowe Rynki' 
    },
    color: 'blue',
    icon: Globe,
    riskLevel: { en: 'Medium Risk', pl: 'Średnie Ryzyko' },
    position: 'top-right',
  },
  product_dev: {
    label: { en: 'Product Development', pl: 'Rozwój Produktu' },
    description: { 
      en: 'New Products + Existing Markets', 
      pl: 'Nowe Produkty + Obecne Rynki' 
    },
    color: 'purple',
    icon: Boxes,
    riskLevel: { en: 'Medium-High Risk', pl: 'Średnio-Wysokie Ryzyko' },
    position: 'bottom-left',
  },
  diversification: {
    label: { en: 'Diversification', pl: 'Dywersyfikacja' },
    description: { 
      en: 'New Products + New Markets', 
      pl: 'Nowe Produkty + Nowe Rynki' 
    },
    color: 'amber',
    icon: Sparkles,
    riskLevel: { en: 'High Risk', pl: 'Wysokie Ryzyko' },
    position: 'bottom-right',
  },
};

const ROI_COLORS = {
  high: 'text-emerald-600 dark:text-emerald-400',
  medium: 'text-amber-600 dark:text-amber-400',
  low: 'text-slate-500 dark:text-slate-400',
};

const RISK_COLORS = {
  high: 'text-red-600 dark:text-red-400',
  medium: 'text-amber-600 dark:text-amber-400',
  low: 'text-emerald-600 dark:text-emerald-400',
};

// ==================== COMPONENT ====================

export const AnsoffMatrix: React.FC<AnsoffMatrixProps> = ({
  data,
  isPolish,
  onPathClick,
}) => {
  const lang = isPolish ? 'pl' : 'en';

  const getQuadrantPaths = (quadrant: keyof typeof QUADRANT_CONFIG) => {
    return data.paths.filter((path) => path.quadrant === quadrant);
  };

  const renderQuadrant = (quadrant: keyof typeof QUADRANT_CONFIG) => {
    const config = QUADRANT_CONFIG[quadrant];
    const paths = getQuadrantPaths(quadrant);
    const Icon = config.icon;

    return (
      <div
        className={`
          p-4 rounded-lg border-2 transition-all
          bg-${config.color}-50 dark:bg-${config.color}-900/20
          border-${config.color}-200 dark:border-${config.color}-800
          hover:border-${config.color}-400 dark:hover:border-${config.color}-600
        `}
      >
        {/* Quadrant header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg bg-${config.color}-100 dark:bg-${config.color}-900/40`}>
              <Icon className={`w-4 h-4 text-${config.color}-600 dark:text-${config.color}-400`} />
            </div>
            <div>
              <h4 className={`font-semibold text-${config.color}-700 dark:text-${config.color}-300`}>
                {config.label[lang]}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {config.description[lang]}
              </p>
            </div>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400">
            {config.riskLevel[lang]}
          </span>
        </div>

        {/* Paths list */}
        <div className="space-y-2">
          {paths.length > 0 ? (
            paths.map((path) => (
              <div
                key={path.id}
                onClick={() => onPathClick?.(path)}
                className={`
                  p-2.5 rounded-lg bg-white dark:bg-navy-800 
                  border border-slate-200 dark:border-navy-700
                  ${onPathClick ? 'cursor-pointer hover:border-slate-300 dark:hover:border-navy-600' : ''}
                  ${path.selected ? `ring-2 ring-${config.color}-500` : ''}
                `}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm text-slate-700 dark:text-slate-300 flex-1">
                    {path.opportunity}
                  </span>
                  {path.selected && (
                    <CheckCircle className={`w-4 h-4 text-${config.color}-500 flex-shrink-0`} />
                  )}
                </div>

                <div className="flex items-center gap-3 mt-2 text-xs">
                  <span className={ROI_COLORS[path.roiPotential]}>
                    ROI: {path.roiPotential}
                  </span>
                  <span className={RISK_COLORS[path.risk]}>
                    {isPolish ? 'Ryzyko' : 'Risk'}: {path.risk}
                  </span>
                </div>

                {path.capabilitiesNeeded.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {path.capabilitiesNeeded.slice(0, 3).map((cap, i) => (
                      <span
                        key={i}
                        className="px-1.5 py-0.5 text-xs rounded bg-slate-100 dark:bg-navy-700 text-slate-600 dark:text-slate-400"
                      >
                        {cap}
                      </span>
                    ))}
                    {path.capabilitiesNeeded.length > 3 && (
                      <span className="px-1.5 py-0.5 text-xs text-slate-400">
                        +{path.capabilitiesNeeded.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-sm text-slate-400 italic p-2">
              {isPolish ? 'Brak ścieżek wzrostu' : 'No growth paths'}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Calculate summary stats
  const totalPaths = data.paths.length;
  const selectedPaths = data.paths.filter((p) => p.selected).length;
  const highRoiPaths = data.paths.filter((p) => p.roiPotential === 'high').length;

  return (
    <div className="space-y-4">
      {/* Matrix axes labels */}
      <div className="relative">
        {/* Y-axis label */}
        <div className="absolute -left-8 top-1/2 -translate-y-1/2 -rotate-90 whitespace-nowrap">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            {isPolish ? 'Produkty' : 'Products'} →
          </span>
        </div>

        {/* X-axis label */}
        <div className="text-center mb-2">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            {isPolish ? 'Rynki' : 'Markets'} →
          </span>
        </div>

        {/* Matrix grid */}
        <div className="grid grid-cols-2 gap-3 ml-4">
          {/* Row labels */}
          <div className="col-span-2 grid grid-cols-2 gap-3 text-center text-xs text-slate-500 dark:text-slate-400">
            <span>{isPolish ? 'Obecne' : 'Existing'}</span>
            <span>{isPolish ? 'Nowe' : 'New'}</span>
          </div>

          {/* Top row: Market Penetration & Market Development */}
          <div className="relative">
            <span className="absolute -left-6 top-1/2 -translate-y-1/2 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
              {isPolish ? 'Obecne' : 'Existing'}
            </span>
            {renderQuadrant('penetration')}
          </div>
          {renderQuadrant('market_dev')}

          {/* Bottom row: Product Development & Diversification */}
          <div className="relative">
            <span className="absolute -left-6 top-1/2 -translate-y-1/2 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
              {isPolish ? 'Nowe' : 'New'}
            </span>
            {renderQuadrant('product_dev')}
          </div>
          {renderQuadrant('diversification')}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4 p-4 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700">
        <div className="text-center">
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{totalPaths}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {isPolish ? 'Zidentyfikowanych ścieżek' : 'Paths Identified'}
          </div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{highRoiPaths}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {isPolish ? 'Wysoki potencjał ROI' : 'High ROI Potential'}
          </div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">{selectedPaths}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {isPolish ? 'Wybrane ścieżki' : 'Selected Paths'}
          </div>
        </div>
      </div>

      {/* Risk warning */}
      {data.paths.some((p) => p.quadrant === 'diversification' && p.selected) && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-700 dark:text-amber-300">
            {isPolish
              ? 'Wybrano ścieżkę dywersyfikacji. Ta strategia niesie najwyższe ryzyko i wymaga szczególnej uwagi przy planowaniu.'
              : 'Diversification path selected. This strategy carries the highest risk and requires careful planning.'}
          </div>
        </div>
      )}
    </div>
  );
};

export default AnsoffMatrix;
