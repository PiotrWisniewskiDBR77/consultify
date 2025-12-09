
import React, { useState } from 'react';
import { FullSession, FullInitiative, Language, EconomicsSummary, CostRange, BenefitRange } from '../types';
import { translations } from '../translations';
import { ArrowRight, DollarSign, TrendingUp, Clock, Activity, Sliders, Hash } from 'lucide-react';
import { ROIPaybackChart } from './ROIPaybackChart';

interface FullStep4WorkspaceProps {
  fullSession: FullSession;
  onUpdateInitiative: (initiative: FullInitiative) => void;
  onNextStep: () => void;
  language: Language;
}

export const FullStep4Workspace: React.FC<FullStep4WorkspaceProps> = ({
  fullSession,
  onUpdateInitiative,
  onNextStep,
  language
}) => {
  const t = translations.fullROI;
  const ti = translations.fullInitiatives;
  const initiatives = fullSession.initiatives || [];
  const economics = fullSession.economics || { totalCost: 0, totalAnnualBenefit: 0, overallROI: 0, paybackPeriodYears: 0 };

  const [inputMode, setInputMode] = useState<'precise' | 'range'>('range');

  const costRanges: { label: CostRange, value: number }[] = [
    { label: 'Low (<$10k)', value: 5000 },
    { label: 'Medium ($10k-$50k)', value: 25000 },
    { label: 'High (>$50k)', value: 75000 }
  ];

  const benefitRanges: { label: BenefitRange, value: number }[] = [
    { label: 'Low (<$20k/yr)', value: 10000 },
    { label: 'Medium ($20k-$100k/yr)', value: 60000 },
    { label: 'High (>$100k/yr)', value: 150000 }
  ];

  const handleRangeChange = (init: FullInitiative, type: 'cost' | 'benefit', rangeLabel: string) => {
    if (type === 'cost') {
      const val = costRanges.find(r => r.label === rangeLabel)?.value || 0;
      onUpdateInitiative({ ...init, estimatedCost: val, costRange: rangeLabel as CostRange });
    } else {
      const val = benefitRanges.find(r => r.label === rangeLabel)?.value || 0;
      onUpdateInitiative({ ...init, estimatedAnnualBenefit: val, benefitRange: rangeLabel as BenefitRange });
    }
  };

  return (
    <div className="flex flex-col h-full bg-navy-900">
      {/* Header */}
      <div className="h-20 border-b border-white/5 flex flex-col justify-center px-8 bg-navy-900 shrink-0">
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm font-semibold text-white tracking-wide">{t.intro[language].substring(0, 30)}...</span>
          <span className="text-xs text-slate-500">STEP 4</span>
        </div>
        <div className="w-full h-1 bg-navy-800 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 w-4/6 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8 space-y-6">

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Cost */}
          <div className="bg-navy-950/50 border border-white/5 p-4 rounded-xl">
            <div className="flex items-center gap-2 text-slate-400 mb-2">
              <DollarSign size={16} />
              <span className="text-xs font-bold uppercase tracking-wider">{t.summary.totalCost[language]}</span>
            </div>
            <div className="text-2xl font-bold text-white">
              ${economics.totalCost.toLocaleString()}k
            </div>
          </div>

          {/* Benefit */}
          <div className="bg-navy-950/50 border border-white/5 p-4 rounded-xl">
            <div className="flex items-center gap-2 text-slate-400 mb-2">
              <TrendingUp size={16} />
              <span className="text-xs font-bold uppercase tracking-wider">{t.summary.totalBenefit[language]}</span>
            </div>
            <div className="text-2xl font-bold text-green-400">
              ${economics.totalAnnualBenefit.toLocaleString()}k
            </div>
          </div>

          {/* ROI */}
          <div className="bg-navy-950/50 border border-white/5 p-4 rounded-xl">
            <div className="flex items-center gap-2 text-slate-400 mb-2">
              <Activity size={16} />
              <span className="text-xs font-bold uppercase tracking-wider">{t.summary.roi[language]}</span>
            </div>
            <div className={`text-2xl font-bold ${economics.overallROI > 100 ? 'text-purple-400' : 'text-white'}`}>
              {economics.overallROI.toFixed(0)}%
            </div>
          </div>

          {/* Payback */}
          <div className="bg-navy-950/50 border border-white/5 p-4 rounded-xl">
            <div className="flex items-center gap-2 text-slate-400 mb-2">
              <Clock size={16} />
              <span className="text-xs font-bold uppercase tracking-wider">{t.summary.payback[language]}</span>
            </div>
            <div className="text-2xl font-bold text-blue-400">
              {economics.paybackPeriodYears.toFixed(1)} <span className="text-sm text-slate-500">{t.summary.years[language]}</span>
            </div>
          </div>
        </div>

        {/* ROI Chart */}
        <div className="bg-navy-950/50 border border-white/5 rounded-xl p-4 h-[350px]">
          <ROIPaybackChart economics={economics} language={language} />
        </div>

        {/* Input Mode Toggle */}
        <div className="flex justify-end">
          <div className="bg-navy-950 p-1 rounded-lg border border-white/10 flex gap-1">
            <button
              onClick={() => setInputMode('range')}
              className={`px-3 py-1.5 rounded text-xs font-medium flex items-center gap-2 transition-colors ${inputMode === 'range' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <Sliders size={14} /> Estimate Ranges
            </button>
            <button
              onClick={() => setInputMode('precise')}
              className={`px-3 py-1.5 rounded text-xs font-medium flex items-center gap-2 transition-colors ${inputMode === 'precise' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <Hash size={14} /> Precise Numbers
            </button>
          </div>
        </div>

        {/* Economics Table */}
        <div className="border border-white/10 rounded-xl overflow-hidden bg-navy-950/50 shadow-xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-navy-900 border-b border-white/10 text-xs uppercase tracking-wider text-slate-500">
                <th className="p-4">{ti.tableHeader.initiative[language]}</th>
                <th className="p-4 w-40">{t.tableHeader.cost[language]}</th>
                <th className="p-4 w-40">{t.tableHeader.benefit[language]}</th>
              </tr>
            </thead>
            <tbody>
              {initiatives.map((init) => (
                <tr key={init.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="p-4">
                    <div className="font-medium text-white text-sm">{init.name}</div>
                    <div className="text-xs text-slate-500 mt-1">{init.quarter} • {init.priority} Priority</div>
                  </td>

                  {/* Cost Input */}
                  <td className="p-4">
                    {inputMode === 'range' ? (
                      <select
                        value={init.costRange || costRanges[0].label}
                        onChange={(e) => handleRangeChange(init, 'cost', e.target.value)}
                        className="w-full bg-navy-900 border border-white/10 text-xs rounded px-2 py-2 outline-none focus:border-blue-500 text-slate-300"
                      >
                        {costRanges.map(r => <option key={r.label} value={r.label}>{r.label}</option>)}
                      </select>
                    ) : (
                      <div className="relative">
                        <span className="absolute left-2 top-1.5 text-slate-500 text-xs">$</span>
                        <input
                          type="number"
                          min="0"
                          value={init.estimatedCost || ''}
                          onChange={(e) => onUpdateInitiative({ ...init, estimatedCost: parseFloat(e.target.value) || 0 })}
                          className="bg-navy-900 border border-white/10 text-sm rounded px-2 py-1 pl-5 outline-none focus:border-blue-500 text-white w-28"
                          placeholder="0"
                        />
                      </div>
                    )}
                  </td>

                  {/* Benefit Input */}
                  <td className="p-4">
                    {inputMode === 'range' ? (
                      <select
                        value={init.benefitRange || benefitRanges[0].label}
                        onChange={(e) => handleRangeChange(init, 'benefit', e.target.value)}
                        className="w-full bg-navy-900 border border-white/10 text-xs rounded px-2 py-2 outline-none focus:border-green-500 text-slate-300"
                      >
                        {benefitRanges.map(r => <option key={r.label} value={r.label}>{r.label}</option>)}
                      </select>
                    ) : (
                      <div className="relative">
                        <span className="absolute left-2 top-1.5 text-slate-500 text-xs">$</span>
                        <input
                          type="number"
                          min="0"
                          value={init.estimatedAnnualBenefit || ''}
                          onChange={(e) => onUpdateInitiative({ ...init, estimatedAnnualBenefit: parseFloat(e.target.value) || 0 })}
                          className="bg-navy-900 border border-white/10 text-sm rounded px-2 py-1 pl-5 outline-none focus:border-green-500 text-green-300 w-28"
                          placeholder="0"
                        />
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <div className="p-6 border-t border-white/5 bg-navy-900 flex justify-end">
        <button
          onClick={onNextStep}
          className="flex items-center gap-2 px-8 py-4 rounded-lg font-semibold text-sm transition-all shadow-lg bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/30"
        >
          {t.nextStep[language]}
          <ArrowRight size={18} className={language === 'AR' ? 'rotate-180' : ''} />
        </button>
      </div>
    </div>
  );
};
