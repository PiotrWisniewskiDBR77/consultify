import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle,
  Info
} from 'lucide-react';

// DRD Axis Configuration
const DRD_AXES: Record<string, { name: string; namePl: string; maxLevel: number }> = {
  processes: { name: 'Digital Processes', namePl: 'Procesy Cyfrowe', maxLevel: 7 },
  digitalProducts: { name: 'Digital Products', namePl: 'Produkty Cyfrowe', maxLevel: 5 },
  businessModels: { name: 'Digital Business Models', namePl: 'Cyfrowe Modele Biznesowe', maxLevel: 5 },
  dataManagement: { name: 'Data Management', namePl: 'Zarządzanie Danymi', maxLevel: 7 },
  culture: { name: 'Culture of Transformation', namePl: 'Kultura Transformacji', maxLevel: 5 },
  cybersecurity: { name: 'Cybersecurity', namePl: 'Cyberbezpieczeństwo', maxLevel: 5 },
  aiMaturity: { name: 'AI Maturity', namePl: 'Dojrzałość AI', maxLevel: 5 }
};

interface AxisData {
  actual?: number;
  target?: number;
  justification?: string;
  areaScores?: Record<string, { actual?: number; target?: number } | number[]>;
}

interface EmbeddedMatrixProps {
  sectionType: string;
  axisId?: string;
  dataSnapshot: Record<string, unknown>;
  axisData: Record<string, AxisData>;
}

// Priority badge component
const PriorityBadge: React.FC<{ gap: number }> = ({ gap }) => {
  const { t } = useTranslation();
  
  if (gap >= 3) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 rounded-full">
        <AlertTriangle className="w-3 h-3" />
        {t('reports.highPriority', 'High')}
      </span>
    );
  }
  if (gap >= 2) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 rounded-full">
        <Info className="w-3 h-3" />
        {t('reports.mediumPriority', 'Medium')}
      </span>
    );
  }
  if (gap > 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 rounded-full">
        <CheckCircle className="w-3 h-3" />
        {t('reports.lowPriority', 'Low')}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-slate-100 dark:bg-slate-500/20 text-slate-600 dark:text-slate-400 rounded-full">
      <CheckCircle className="w-3 h-3" />
      {t('reports.achieved', 'Achieved')}
    </span>
  );
};

// Gap indicator component
const GapIndicator: React.FC<{ gap: number }> = ({ gap }) => {
  if (gap > 0) {
    return <TrendingUp className="w-4 h-4 text-red-500" />;
  }
  if (gap < 0) {
    return <TrendingDown className="w-4 h-4 text-green-500" />;
  }
  return <Minus className="w-4 h-4 text-slate-400" />;
};

// Progress bar component
const ProgressBar: React.FC<{ actual: number; target: number; maxLevel: number }> = ({ actual, target, maxLevel }) => {
  const actualPercent = (actual / maxLevel) * 100;
  const targetPercent = (target / maxLevel) * 100;

  return (
    <div className="relative h-2 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
      {/* Target indicator */}
      <div 
        className="absolute top-0 bottom-0 w-0.5 bg-slate-400 dark:bg-slate-500 z-10"
        style={{ left: `${targetPercent}%` }}
        title={`Target: ${target}`}
      />
      {/* Actual bar */}
      <div 
        className={`h-full rounded-full transition-all ${
          actual >= target 
            ? 'bg-green-500' 
            : actual >= target * 0.7 
              ? 'bg-yellow-500' 
              : 'bg-red-500'
        }`}
        style={{ width: `${actualPercent}%` }}
      />
    </div>
  );
};

// Maturity Overview Matrix
const MaturityOverviewMatrix: React.FC<{ axisData: Record<string, AxisData> }> = ({ axisData }) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  const sortedAxes = useMemo(() => {
    return Object.entries(DRD_AXES)
      .map(([id, config]) => {
        const data = axisData[id] || {};
        return {
          id,
          name: isPolish ? config.namePl : config.name,
          actual: data.actual || 0,
          target: data.target || 0,
          gap: (data.target || 0) - (data.actual || 0),
          maxLevel: config.maxLevel
        };
      })
      .sort((a, b) => b.gap - a.gap); // Sort by gap descending
  }, [axisData, isPolish]);

  // Calculate averages
  const totals = sortedAxes.reduce(
    (acc, axis) => {
      if (axis.actual > 0) {
        acc.actualSum += axis.actual;
        acc.targetSum += axis.target;
        acc.count++;
      }
      return acc;
    },
    { actualSum: 0, targetSum: 0, count: 0 }
  );

  const avgActual = totals.count > 0 ? (totals.actualSum / totals.count).toFixed(1) : '-';
  const avgTarget = totals.count > 0 ? (totals.targetSum / totals.count).toFixed(1) : '-';
  const avgGap = totals.count > 0 ? ((totals.targetSum - totals.actualSum) / totals.count).toFixed(1) : '-';

  return (
    <div className="bg-slate-50 dark:bg-navy-800/50 rounded-xl p-4">
      <h4 className="text-sm font-semibold text-navy-900 dark:text-white mb-4">
        {t('reports.maturityMatrix', 'Maturity Matrix - 7 Axes')}
      </h4>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-white/10">
              <th className="pb-2 font-medium">{t('reports.axis', 'Axis')}</th>
              <th className="pb-2 font-medium text-center">{t('reports.current', 'Current')}</th>
              <th className="pb-2 font-medium text-center">{t('reports.target', 'Target')}</th>
              <th className="pb-2 font-medium text-center">{t('reports.gap', 'Gap')}</th>
              <th className="pb-2 font-medium">{t('reports.progress', 'Progress')}</th>
              <th className="pb-2 font-medium text-center">{t('reports.priority', 'Priority')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {sortedAxes.map((axis) => (
              <tr key={axis.id} className="group">
                <td className="py-3">
                  <span className="font-medium text-navy-900 dark:text-white">{axis.name}</span>
                </td>
                <td className="py-3 text-center">
                  <span className={`font-mono font-medium ${
                    axis.actual >= axis.maxLevel * 0.7 
                      ? 'text-green-600 dark:text-green-400' 
                      : axis.actual >= axis.maxLevel * 0.4 
                        ? 'text-yellow-600 dark:text-yellow-400'
                        : 'text-red-600 dark:text-red-400'
                  }`}>
                    {axis.actual || '-'}
                  </span>
                </td>
                <td className="py-3 text-center">
                  <span className="font-mono text-slate-600 dark:text-slate-400">
                    {axis.target || '-'}
                  </span>
                </td>
                <td className="py-3 text-center">
                  <div className="inline-flex items-center gap-1">
                    <GapIndicator gap={axis.gap} />
                    <span className={`font-mono font-medium ${
                      axis.gap > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                    }`}>
                      {axis.gap > 0 ? `+${axis.gap}` : axis.gap}
                    </span>
                  </div>
                </td>
                <td className="py-3 w-32">
                  <ProgressBar actual={axis.actual} target={axis.target} maxLevel={axis.maxLevel} />
                </td>
                <td className="py-3 text-center">
                  <PriorityBadge gap={axis.gap} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-200 dark:border-white/10 font-medium">
              <td className="pt-3 text-navy-900 dark:text-white">{t('reports.average', 'Average')}</td>
              <td className="pt-3 text-center text-navy-900 dark:text-white">{avgActual}</td>
              <td className="pt-3 text-center text-navy-900 dark:text-white">{avgTarget}</td>
              <td className="pt-3 text-center text-navy-900 dark:text-white">{avgGap}</td>
              <td></td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

// Axis Detail Matrix
const AxisDetailMatrix: React.FC<{ axisId: string; data: AxisData }> = ({ axisId, data }) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  const axisConfig = DRD_AXES[axisId];
  if (!axisConfig) return null;

  const gap = (data.target || 0) - (data.actual || 0);

  // Parse area scores if available
  const areaScores = useMemo(() => {
    if (!data.areaScores) return [];
    
    return Object.entries(data.areaScores).map(([areaId, scores]) => {
      const actual = Array.isArray(scores) ? scores[0] : (scores as { actual?: number })?.actual || 0;
      const target = Array.isArray(scores) ? scores[1] : (scores as { target?: number })?.target || 0;
      return {
        id: areaId,
        actual,
        target,
        gap: target - actual
      };
    }).sort((a, b) => b.gap - a.gap);
  }, [data.areaScores]);

  return (
    <div className="bg-slate-50 dark:bg-navy-800/50 rounded-xl p-4">
      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        <div className="bg-white dark:bg-navy-900 rounded-lg p-3 text-center">
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
            {t('reports.currentLevel', 'Current Level')}
          </div>
          <div className="text-2xl font-bold text-navy-900 dark:text-white">
            {data.actual || '-'}
          </div>
          <div className="text-xs text-slate-400">/ {axisConfig.maxLevel}</div>
        </div>
        <div className="bg-white dark:bg-navy-900 rounded-lg p-3 text-center">
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
            {t('reports.targetLevel', 'Target Level')}
          </div>
          <div className="text-2xl font-bold text-navy-900 dark:text-white">
            {data.target || '-'}
          </div>
          <div className="text-xs text-slate-400">/ {axisConfig.maxLevel}</div>
        </div>
        <div className="bg-white dark:bg-navy-900 rounded-lg p-3 text-center">
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
            {t('reports.gap', 'Gap')}
          </div>
          <div className={`text-2xl font-bold ${
            gap > 0 ? 'text-red-600 dark:text-red-400' : gap < 0 ? 'text-green-600 dark:text-green-400' : 'text-slate-600 dark:text-slate-400'
          }`}>
            {gap > 0 ? `+${gap}` : gap}
          </div>
          <div className="text-xs text-slate-400">{t('reports.levels', 'levels')}</div>
        </div>
        <div className="bg-white dark:bg-navy-900 rounded-lg p-3 text-center">
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
            {t('reports.priority', 'Priority')}
          </div>
          <div className="mt-1">
            <PriorityBadge gap={gap} />
          </div>
        </div>
      </div>

      {/* Progress visualization */}
      <div className="mb-4">
        <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">
          {t('reports.progressToTarget', 'Progress to Target')}
        </div>
        <div className="relative h-4 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
          {/* Target marker */}
          <div 
            className="absolute top-0 bottom-0 w-1 bg-slate-500 dark:bg-slate-400 z-10"
            style={{ left: `${((data.target || 0) / axisConfig.maxLevel) * 100}%` }}
          />
          {/* Current level */}
          <div 
            className={`h-full rounded-full transition-all ${
              (data.actual || 0) >= (data.target || 0) 
                ? 'bg-gradient-to-r from-green-400 to-green-500' 
                : 'bg-gradient-to-r from-blue-400 to-blue-500'
            }`}
            style={{ width: `${((data.actual || 0) / axisConfig.maxLevel) * 100}%` }}
          />
          {/* Level markers */}
          {Array.from({ length: axisConfig.maxLevel - 1 }, (_, i) => (
            <div
              key={i}
              className="absolute top-0 bottom-0 w-px bg-slate-300 dark:bg-slate-600"
              style={{ left: `${((i + 1) / axisConfig.maxLevel) * 100}%` }}
            />
          ))}
        </div>
        <div className="flex justify-between mt-1 text-xs text-slate-400">
          <span>1</span>
          <span>{axisConfig.maxLevel}</span>
        </div>
      </div>

      {/* Area scores table */}
      {areaScores.length > 0 && (
        <>
          <h5 className="text-sm font-semibold text-navy-900 dark:text-white mb-3">
            {t('reports.areaBreakdown', 'Area Breakdown')}
          </h5>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-white/10">
                  <th className="pb-2 font-medium">{t('reports.area', 'Area')}</th>
                  <th className="pb-2 font-medium text-center">{t('reports.current', 'Current')}</th>
                  <th className="pb-2 font-medium text-center">{t('reports.target', 'Target')}</th>
                  <th className="pb-2 font-medium text-center">{t('reports.gap', 'Gap')}</th>
                  <th className="pb-2 font-medium w-24">{t('reports.progress', 'Progress')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {areaScores.map((area) => (
                  <tr key={area.id}>
                    <td className="py-2 font-medium text-navy-900 dark:text-white">{area.id}</td>
                    <td className="py-2 text-center font-mono">{area.actual || '-'}</td>
                    <td className="py-2 text-center font-mono text-slate-500">{area.target || '-'}</td>
                    <td className="py-2 text-center">
                      <span className={`font-mono ${
                        area.gap > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                      }`}>
                        {area.gap > 0 ? `+${area.gap}` : area.gap}
                      </span>
                    </td>
                    <td className="py-2">
                      <ProgressBar actual={area.actual} target={area.target} maxLevel={axisConfig.maxLevel} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

// Gap Analysis Matrix
const GapAnalysisMatrix: React.FC<{ axisData: Record<string, AxisData> }> = ({ axisData }) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  const analysisData = useMemo(() => {
    return Object.entries(DRD_AXES)
      .map(([id, config]) => {
        const data = axisData[id] || {};
        const gap = (data.target || 0) - (data.actual || 0);
        return {
          id,
          name: isPolish ? config.namePl : config.name,
          actual: data.actual || 0,
          target: data.target || 0,
          gap,
          maxLevel: config.maxLevel,
          priority: gap >= 3 ? 'critical' : gap >= 2 ? 'high' : gap > 0 ? 'medium' : 'low',
          effort: gap > 0 ? `${gap * 3}-${gap * 4}` : '-',
          complexity: gap >= 3 ? 'High' : gap >= 2 ? 'Medium' : 'Low'
        };
      })
      .sort((a, b) => b.gap - a.gap);
  }, [axisData, isPolish]);

  const critical = analysisData.filter(a => a.priority === 'critical').length;
  const high = analysisData.filter(a => a.priority === 'high').length;
  const totalGap = analysisData.reduce((sum, a) => sum + Math.max(0, a.gap), 0);

  return (
    <div className="bg-slate-50 dark:bg-navy-800/50 rounded-xl p-4">
      <h4 className="text-sm font-semibold text-navy-900 dark:text-white mb-4">
        {t('reports.gapAnalysis', 'Gap Analysis Summary')}
      </h4>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-red-50 dark:bg-red-500/10 rounded-lg p-3 text-center">
          <div className="text-xs text-red-600 dark:text-red-400 mb-1">{t('reports.criticalGaps', 'Critical Gaps')}</div>
          <div className="text-2xl font-bold text-red-700 dark:text-red-400">{critical}</div>
        </div>
        <div className="bg-yellow-50 dark:bg-yellow-500/10 rounded-lg p-3 text-center">
          <div className="text-xs text-yellow-600 dark:text-yellow-400 mb-1">{t('reports.highGaps', 'High Priority')}</div>
          <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">{high}</div>
        </div>
        <div className="bg-blue-50 dark:bg-blue-500/10 rounded-lg p-3 text-center">
          <div className="text-xs text-blue-600 dark:text-blue-400 mb-1">{t('reports.totalLevels', 'Total Levels to Gain')}</div>
          <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">{totalGap}</div>
        </div>
      </div>

      {/* Gap table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-white/10">
              <th className="pb-2 font-medium">{t('reports.axis', 'Axis')}</th>
              <th className="pb-2 font-medium text-center">{t('reports.currentVsTarget', 'Current → Target')}</th>
              <th className="pb-2 font-medium text-center">{t('reports.gap', 'Gap')}</th>
              <th className="pb-2 font-medium text-center">{t('reports.estTime', 'Est. Time')}</th>
              <th className="pb-2 font-medium text-center">{t('reports.complexity', 'Complexity')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {analysisData.map((axis) => (
              <tr key={axis.id} className={axis.gap > 0 ? '' : 'opacity-50'}>
                <td className="py-3">
                  <span className="font-medium text-navy-900 dark:text-white">{axis.name}</span>
                </td>
                <td className="py-3 text-center font-mono">
                  <span className="text-slate-600 dark:text-slate-400">{axis.actual}</span>
                  <span className="mx-2 text-slate-400">→</span>
                  <span className="text-navy-900 dark:text-white font-medium">{axis.target}</span>
                </td>
                <td className="py-3 text-center">
                  <PriorityBadge gap={axis.gap} />
                </td>
                <td className="py-3 text-center text-slate-600 dark:text-slate-400">
                  {axis.effort} {axis.effort !== '-' && (isPolish ? 'mies.' : 'mo.')}
                </td>
                <td className="py-3 text-center">
                  <span className={`inline-block px-2 py-0.5 text-xs rounded ${
                    axis.complexity === 'High' 
                      ? 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400'
                      : axis.complexity === 'Medium'
                        ? 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400'
                        : 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400'
                  }`}>
                    {axis.complexity}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Main EmbeddedMatrix component
export const EmbeddedMatrix: React.FC<EmbeddedMatrixProps> = ({
  sectionType,
  axisId,
  dataSnapshot,
  axisData
}) => {
  switch (sectionType) {
    case 'maturity_overview':
      return <MaturityOverviewMatrix axisData={axisData} />;
    
    case 'axis_detail':
      if (!axisId || !axisData[axisId]) return null;
      return <AxisDetailMatrix axisId={axisId} data={axisData[axisId]} />;
    
    case 'gap_analysis':
      return <GapAnalysisMatrix axisData={axisData} />;
    
    default:
      return null;
  }
};

