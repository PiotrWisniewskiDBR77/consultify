/**
 * KpisSection - Key Performance Indicators with baseline and target
 */

import { motion } from 'framer-motion';
import { Loader2, Plus, Sparkles, TrendingUp, X } from 'lucide-react';
import React, { useState } from 'react';

import { CollapsibleSection } from './CollapsibleSection';
import { useInitiativeContext } from './InitiativeContext';
import type { InitiativeSectionProps } from './types';

interface KPI {
  id: string;
  name: string;
  unit: string;
  baseline: string;
  target: string;
  current?: string;
}

export const KpisSection: React.FC<InitiativeSectionProps> = ({
  sectionType,
  expanded,
  onToggle,
}) => {
  const { initiative, isPolish, isGeneratingAI, handleGenerateAI } = useInitiativeContext();

  const [kpis, setKpis] = useState<KPI[]>(initiative?.kpis || []);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUnit, setNewUnit] = useState('');
  const [newBaseline, setNewBaseline] = useState('');
  const [newTarget, setNewTarget] = useState('');

  const addKpi = () => {
    if (!newName.trim()) return;
    setKpis([
      ...kpis,
      {
        id: `kpi-${Date.now()}`,
        name: newName,
        unit: newUnit,
        baseline: newBaseline,
        target: newTarget,
      },
    ]);
    setNewName('');
    setNewUnit('');
    setNewBaseline('');
    setNewTarget('');
    setShowAdd(false);
  };

  return (
    <CollapsibleSection
      id="kpis"
      title={isPolish ? 'KPI i korzyści' : 'KPIs & Benefits'}
      icon={<TrendingUp size={18} className="text-cyan-500 dark:text-cyan-400" />}
      iconBg="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 dark:from-cyan-500/20 dark:to-blue-500/20"
      expanded={expanded}
      onToggle={onToggle}
      badge={
        kpis.length > 0 ? <span className="text-xs text-slate-400">{kpis.length}</span> : undefined
      }
      actions={
        <div className="flex items-center gap-2">
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={(e) => {
              e.stopPropagation();
              setShowAdd(true);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/20 text-xs font-medium transition-all"
          >
            <Plus size={14} />
            <span>{isPolish ? 'Nowy' : 'New'}</span>
          </motion.button>
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={async (e) => {
              e.stopPropagation();
              const result = await handleGenerateAI('kpis');
              if (result?.parsedContent && Array.isArray(result.parsedContent)) {
                setKpis((prev) => [
                  ...prev,
                  ...result.parsedContent.map((k: any) => ({
                    name: k.name || '',
                    unit: k.unit || '',
                    baseline: k.baseline || '',
                    target: k.target || '',
                  })),
                ]);
              }
            }}
            disabled={isGeneratingAI === 'kpis'}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-violet-500/10 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 hover:bg-violet-500/20 text-xs font-medium transition-all disabled:opacity-50"
          >
            {isGeneratingAI === 'kpis' ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Sparkles size={14} />
            )}
            <span>AI</span>
          </motion.button>
        </div>
      }
    >
      {showAdd && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-4 rounded-xl border-2 border-cyan-300 dark:border-cyan-500/50 bg-cyan-50/30 dark:bg-cyan-500/5 space-y-3"
        >
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={isPolish ? 'Nazwa KPI...' : 'KPI name...'}
            className="w-full px-3 py-2 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm"
            autoFocus
          />
          <div className="grid grid-cols-3 gap-2">
            <input
              type="text"
              value={newUnit}
              onChange={(e) => setNewUnit(e.target.value)}
              placeholder={isPolish ? 'Jednostka' : 'Unit'}
              className="px-3 py-2 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm"
            />
            <input
              type="text"
              value={newBaseline}
              onChange={(e) => setNewBaseline(e.target.value)}
              placeholder="Baseline"
              className="px-3 py-2 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm"
            />
            <input
              type="text"
              value={newTarget}
              onChange={(e) => setNewTarget(e.target.value)}
              placeholder="Target"
              className="px-3 py-2 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowAdd(false)}
              className="px-3 py-1.5 text-xs text-slate-500"
            >
              {isPolish ? 'Anuluj' : 'Cancel'}
            </button>
            <button
              onClick={addKpi}
              disabled={!newName.trim()}
              className="px-3 py-1.5 text-xs bg-cyan-500 text-white rounded-lg disabled:opacity-50"
            >
              {isPolish ? 'Dodaj' : 'Add'}
            </button>
          </div>
        </motion.div>
      )}

      {kpis.length === 0 && !showAdd ? (
        <div className="text-center py-6 border-2 border-dashed border-slate-200 dark:border-navy-700 rounded-xl">
          <TrendingUp size={24} className="mx-auto mb-2 text-slate-300 dark:text-slate-600" />
          <p className="text-sm text-slate-400">
            {isPolish ? 'Brak zdefiniowanych KPI' : 'No KPIs defined yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {kpis.map((kpi) => (
            <div
              key={kpi.id}
              className="p-3 rounded-xl bg-slate-50/50 dark:bg-navy-800/50 border border-slate-200/50 dark:border-navy-700/50"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {kpi.name}
                </span>
                <button
                  onClick={() => setKpis(kpis.filter((k) => k.id !== kpi.id))}
                  className="text-slate-400 hover:text-red-500"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-2 rounded-lg bg-slate-100/50 dark:bg-navy-900/50">
                  <div className="text-[10px] text-slate-400 uppercase mb-0.5">Baseline</div>
                  <div className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                    {kpi.baseline || '-'} {kpi.unit}
                  </div>
                </div>
                <div className="text-center p-2 rounded-lg bg-cyan-50/50 dark:bg-cyan-500/5 border border-cyan-200/30 dark:border-cyan-500/20">
                  <div className="text-[10px] text-cyan-500 uppercase mb-0.5">
                    {isPolish ? 'Obecny' : 'Current'}
                  </div>
                  <div className="text-sm font-semibold text-cyan-600 dark:text-cyan-400">
                    {kpi.current || '-'} {kpi.unit}
                  </div>
                </div>
                <div className="text-center p-2 rounded-lg bg-emerald-50/50 dark:bg-emerald-500/5 border border-emerald-200/30 dark:border-emerald-500/20">
                  <div className="text-[10px] text-emerald-500 uppercase mb-0.5">Target</div>
                  <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                    {kpi.target || '-'} {kpi.unit}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </CollapsibleSection>
  );
};
