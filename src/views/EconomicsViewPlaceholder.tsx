/**
 * Economics View - Temporary Placeholder
 * This is a simplified version to test routing
 */

import { BarChart3, Calculator, DollarSign, TrendingUp } from 'lucide-react';
import React from 'react';

export const EconomicsViewPlaceholder: React.FC = () => {
  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-navy-950">
      {/* Header */}
      <div className="bg-white dark:bg-navy-900 border-b border-slate-200 dark:border-navy-700 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <Calculator size={24} className="text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-navy-900 dark:text-white">
              Economics & Value Realization
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Ocena dojrzałości cyfrowej i analiza wartości
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-2xl w-full">
          <div className="bg-white dark:bg-navy-900 rounded-xl shadow-xl border border-slate-200 dark:border-navy-700 p-8">
            <div className="text-center mb-8">
              <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                <TrendingUp size={40} className="text-emerald-400" />
              </div>
              <h2 className="text-2xl font-bold text-navy-900 dark:text-white mb-2">
                Moduł Economics
              </h2>
              <p className="text-slate-600 dark:text-slate-400">
                Moduł jest w trakcie konfiguracji
              </p>
            </div>

            {/* Feature Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center mb-3">
                  <Calculator size={20} className="text-blue-400" />
                </div>
                <h3 className="font-semibold text-navy-900 dark:text-white mb-1">
                  Analiza finansowa
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Kompleksowa ocena ROI i wartości biznesowej
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center mb-3">
                  <BarChart3 size={20} className="text-emerald-400" />
                </div>
                <h3 className="font-semibold text-navy-900 dark:text-white mb-1">
                  Ocena dojrzałości
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Narzędzie do oceny poziomu cyfryzacji
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700">
                <div className="w-10 h-10 rounded-lg bg-primary-500/20 flex items-center justify-center mb-3">
                  <DollarSign size={20} className="text-primary-400" />
                </div>
                <h3 className="font-semibold text-navy-900 dark:text-white mb-1">
                  Śledzenie korzyści
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Monitoring realizacji wartości biznesowej
                </p>
              </div>
            </div>

            {/* Info Message */}
            <div className="mt-8 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-500/30">
              <p className="text-sm text-blue-900 dark:text-blue-300">
                <strong>Status:</strong> Moduł Economics został tymczasowo zastąpiony placeholderem.
                Pełna funkcjonalność zostanie przywrócona wkrótce.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EconomicsViewPlaceholder;
