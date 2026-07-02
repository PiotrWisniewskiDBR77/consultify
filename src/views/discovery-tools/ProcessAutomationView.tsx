/**
 * ProcessAutomationView - Process Automation by AI (Tool #31)
 *
 * Interactive workshop for process analysis, lean optimization, and automation planning.
 * User builds a table step by step:
 * 1. Map process steps (LP, name, type, time)
 * 2. Lean optimization (eliminate waste)
 * 3. Automation opportunities (RPA, workflow, AI)
 * 4. Economic analysis (ROI calculation)
 * 5. Generate initiatives
 */

import {
  ArrowLeft,
  Calculator,
  ChevronRight,
  Clock,
  Download,
  Lightbulb,
  Play,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Zap,
} from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAppStore } from '@/store/useAppStore';
import { AppView } from '@/types';

interface ProcessStep {
  id: string;
  lp: number;
  name: string;
  type: 'task' | 'decision';
  timeMinutes: number;
  leanOptimization: string;
  leanSavingsMinutes: number;
  automationType: 'none' | 'workflow' | 'rpa' | 'ai' | 'api';
  automationIdea: string;
  timeAfterAutomation: number;
}

const INITIAL_STEPS: ProcessStep[] = [
  {
    id: '1',
    lp: 1,
    name: '',
    type: 'task',
    timeMinutes: 0,
    leanOptimization: '',
    leanSavingsMinutes: 0,
    automationType: 'none',
    automationIdea: '',
    timeAfterAutomation: 0,
  },
];

type Phase = 'mapping' | 'lean' | 'automation' | 'economics';

export const ProcessAutomationView: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { setCurrentView } = useAppStore();
  const isPolish = i18n.language === 'pl';

  const [steps, setSteps] = useState<ProcessStep[]>(INITIAL_STEPS);
  const [processName, setProcessName] = useState('');
  const [currentPhase, setCurrentPhase] = useState<Phase>('mapping');
  const [volumePerDay, setVolumePerDay] = useState(100);
  const [fteCost, setFteCost] = useState(8000);

  const handleBack = () => {
    setCurrentView(AppView.DISCOVERY_TOOLS);
  };

  const addStep = () => {
    const newStep: ProcessStep = {
      id: String(Date.now()),
      lp: steps.length + 1,
      name: '',
      type: 'task',
      timeMinutes: 0,
      leanOptimization: '',
      leanSavingsMinutes: 0,
      automationType: 'none',
      automationIdea: '',
      timeAfterAutomation: 0,
    };
    setSteps([...steps, newStep]);
  };

  const updateStep = (id: string, updates: Partial<ProcessStep>) => {
    setSteps(steps.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  const removeStep = (id: string) => {
    const filtered = steps.filter((s) => s.id !== id);
    setSteps(filtered.map((s, i) => ({ ...s, lp: i + 1 })));
  };

  // Calculations
  const totalTimeOriginal = steps.reduce((sum, s) => sum + s.timeMinutes, 0);
  const totalLeanSavings = steps.reduce((sum, s) => sum + s.leanSavingsMinutes, 0);
  const totalTimeAfterLean = totalTimeOriginal - totalLeanSavings;
  const totalTimeAfterAutomation = steps.reduce((sum, s) => sum + s.timeAfterAutomation, 0);

  const hoursPerDayOriginal = (totalTimeOriginal * volumePerDay) / 60;
  const hoursPerDayAfterLean = (totalTimeAfterLean * volumePerDay) / 60;
  const hoursPerDayAfterAutomation = (totalTimeAfterAutomation * volumePerDay) / 60;

  const fteOriginal = hoursPerDayOriginal / 8;
  const fteAfterLean = hoursPerDayAfterLean / 8;
  const fteAfterAutomation = hoursPerDayAfterAutomation / 8;

  const fteSavedLean = fteOriginal - fteAfterLean;
  const fteSavedAutomation = fteAfterLean - fteAfterAutomation;
  const fteSavedTotal = fteOriginal - fteAfterAutomation;

  const annualSavings = fteSavedTotal * fteCost * 12;

  const phases: { id: Phase; label: string; labelPl: string; icon: React.ElementType }[] = [
    { id: 'mapping', label: 'Process Mapping', labelPl: 'Mapowanie Procesu', icon: Play },
    { id: 'lean', label: 'Lean Optimization', labelPl: 'Optymalizacja Lean', icon: Sparkles },
    { id: 'automation', label: 'Automation Ideas', labelPl: 'Pomysły Automatyzacji', icon: Zap },
    {
      id: 'economics',
      label: 'Economic Analysis',
      labelPl: 'Analiza Ekonomiczna',
      icon: Calculator,
    },
  ];

  return (
    <div className="min-h-full bg-c-bg">
      {/* Header */}
      <div className="bg-c-surface border-b border-c-border-subtle">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('common.back', 'Back to Discovery Tools')}
          </button>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl">
                <Zap className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-c-text">
                  {t('discoveryTools.processAutomation.title', 'Process Automation by AI')}
                </h1>
                <p className="text-slate-600 dark:text-slate-400">
                  {t(
                    'discoveryTools.processAutomation.subtitle',
                    'Interactive workshop for process optimization and automation'
                  )}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-navy-800 border border-c-border-subtle rounded-lg hover:bg-slate-50 dark:hover:bg-navy-700 flex items-center gap-2">
                <Save className="w-4 h-4" />
                {t('common.save', 'Save')}
              </button>
              <button className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-navy-800 border border-c-border-subtle rounded-lg hover:bg-slate-50 dark:hover:bg-navy-700 flex items-center gap-2">
                <Download className="w-4 h-4" />
                {t('common.export', 'Export')}
              </button>
            </div>
          </div>

          {/* Process Name */}
          <div className="mt-4">
            <input
              type="text"
              value={processName}
              onChange={(e) => setProcessName(e.target.value)}
              placeholder={
                isPolish
                  ? 'Nazwa procesu (np. Order-to-Cash)'
                  : 'Process name (e.g., Order-to-Cash)'
              }
              className="w-full max-w-md px-4 py-2 border border-c-border-subtle rounded-lg bg-white dark:bg-navy-800 text-c-text placeholder-slate-400"
            />
          </div>

          {/* Phase Tabs */}
          <div className="flex gap-2 mt-6">
            {phases.map((phase) => {
              const Icon = phase.icon;
              const isActive = currentPhase === phase.id;
              return (
                <button
                  key={phase.id}
                  onClick={() => setCurrentPhase(phase.id)}
                  className={`
                    px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors
                    ${
                      isActive
                        ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  {isPolish ? phase.labelPl : phase.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-c-surface rounded-xl border border-c-border-subtle">
            <div className="text-sm text-c-text-muted mb-1">
              {isPolish ? 'Czas oryginalny' : 'Original Time'}
            </div>
            <div className="text-2xl font-bold text-c-text">
              {totalTimeOriginal} <span className="text-sm font-normal">min</span>
            </div>
            <div className="text-xs text-slate-600">{fteOriginal.toFixed(1)} FTE</div>
          </div>
          <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
            <div className="text-sm text-emerald-600 dark:text-emerald-400 mb-1">
              {isPolish ? 'Po Lean' : 'After Lean'}
            </div>
            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
              {totalTimeAfterLean} <span className="text-sm font-normal">min</span>
            </div>
            <div className="text-xs text-emerald-600 dark:text-emerald-400">
              -{fteSavedLean.toFixed(1)} FTE
            </div>
          </div>
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
            <div className="text-sm text-blue-600 dark:text-blue-400 mb-1">
              {isPolish ? 'Po automatyzacji' : 'After Automation'}
            </div>
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
              {totalTimeAfterAutomation} <span className="text-sm font-normal">min</span>
            </div>
            <div className="text-xs text-blue-600 dark:text-blue-400">
              -{fteSavedTotal.toFixed(1)} FTE total
            </div>
          </div>
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
            <div className="text-sm text-amber-600 dark:text-amber-400 mb-1">
              {isPolish ? 'Oszczędność roczna' : 'Annual Savings'}
            </div>
            <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">
              {(annualSavings / 1000).toFixed(0)}k <span className="text-sm font-normal">PLN</span>
            </div>
            <div className="text-xs text-amber-600 dark:text-amber-400">
              {volumePerDay}/day × {fteCost} PLN/FTE
            </div>
          </div>
        </div>

        {/* Process Table */}
        <div className="bg-c-surface rounded-xl border border-c-border-subtle overflow-hidden">
          <div className="overflow-x-auto">
            <table /* §27-exempt: layout specjalizowany/read-only/data-viz, nie kanoniczna lista przegladana */  className="w-full">
              <thead className="bg-slate-50 dark:bg-navy-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-c-text-muted uppercase">
                    LP
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-c-text-muted uppercase">
                    {isPolish ? 'Krok procesu' : 'Process Step'}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-c-text-muted uppercase">
                    {isPolish ? 'Typ' : 'Type'}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-c-text-muted uppercase">
                    {isPolish ? 'Czas (min)' : 'Time (min)'}
                  </th>
                  {(currentPhase === 'lean' ||
                    currentPhase === 'automation' ||
                    currentPhase === 'economics') && (
                    <>
                      <th className="px-4 py-3 text-left text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase">
                        {isPolish ? 'Optymalizacja Lean' : 'Lean Optimization'}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase">
                        {isPolish ? 'Oszcz.' : 'Savings'}
                      </th>
                    </>
                  )}
                  {(currentPhase === 'automation' || currentPhase === 'economics') && (
                    <>
                      <th className="px-4 py-3 text-left text-xs font-medium text-blue-600 dark:text-blue-400 uppercase">
                        {isPolish ? 'Automatyzacja' : 'Automation'}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-blue-600 dark:text-blue-400 uppercase">
                        {isPolish ? 'Po autom.' : 'After Auto'}
                      </th>
                    </>
                  )}
                  <th className="px-4 py-3 text-right text-xs font-medium text-c-text-muted uppercase"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-navy-700">
                {steps.map((step) => (
                  <tr key={step.id} className="hover:bg-slate-50 dark:hover:bg-navy-800">
                    <td className="px-4 py-3 text-sm text-c-text-muted">
                      {step.lp}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={step.name}
                        onChange={(e) => updateStep(step.id, { name: e.target.value })}
                        placeholder={isPolish ? 'Nazwa kroku...' : 'Step name...'}
                        className="w-full px-2 py-1 text-sm border border-transparent hover:border-slate-200 dark:hover:border-navy-600 rounded bg-transparent text-c-text focus:border-c-focus-solid focus:outline-none"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={step.type}
                        onChange={(e) =>
                          updateStep(step.id, { type: e.target.value as 'task' | 'decision' })
                        }
                        className="px-2 py-1 text-sm border border-slate-200 dark:border-navy-600 rounded bg-white dark:bg-navy-800 text-c-text"
                      >
                        <option value="task">{isPolish ? 'Zadanie' : 'Task'}</option>
                        <option value="decision">{isPolish ? 'Decyzja' : 'Decision'}</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        value={step.timeMinutes || ''}
                        onChange={(e) =>
                          updateStep(step.id, { timeMinutes: Number(e.target.value) })
                        }
                        className="w-20 px-2 py-1 text-sm border border-slate-200 dark:border-navy-600 rounded bg-white dark:bg-navy-800 text-c-text"
                      />
                    </td>
                    {(currentPhase === 'lean' ||
                      currentPhase === 'automation' ||
                      currentPhase === 'economics') && (
                      <>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={step.leanOptimization}
                            onChange={(e) =>
                              updateStep(step.id, { leanOptimization: e.target.value })
                            }
                            placeholder={
                              isPolish ? 'Pomysł optymalizacji...' : 'Optimization idea...'
                            }
                            className="w-full px-2 py-1 text-sm border border-emerald-200 dark:border-emerald-800 rounded bg-emerald-50 dark:bg-emerald-900/20 text-c-text"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            value={step.leanSavingsMinutes || ''}
                            onChange={(e) =>
                              updateStep(step.id, { leanSavingsMinutes: Number(e.target.value) })
                            }
                            className="w-16 px-2 py-1 text-sm border border-emerald-200 dark:border-emerald-800 rounded bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300"
                          />
                        </td>
                      </>
                    )}
                    {(currentPhase === 'automation' || currentPhase === 'economics') && (
                      <>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <select
                              value={step.automationType}
                              onChange={(e) =>
                                updateStep(step.id, {
                                  automationType: e.target.value as ProcessStep['automationType'],
                                })
                              }
                              className="px-2 py-1 text-sm border border-blue-200 dark:border-blue-800 rounded bg-blue-50 dark:bg-blue-900/20 text-c-text"
                            >
                              <option value="none">-</option>
                              <option value="workflow">Workflow</option>
                              <option value="rpa">RPA</option>
                              <option value="ai">AI</option>
                              <option value="api">API</option>
                            </select>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            value={step.timeAfterAutomation || ''}
                            onChange={(e) =>
                              updateStep(step.id, { timeAfterAutomation: Number(e.target.value) })
                            }
                            className="w-16 px-2 py-1 text-sm border border-blue-200 dark:border-blue-800 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                          />
                        </td>
                      </>
                    )}
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => removeStep(step.id)}
                        className="p-1 text-slate-600 hover:text-danger-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Add Step Button */}
          <div className="px-4 py-3 border-t border-c-border-subtle">
            <button
              onClick={addStep}
              className="flex items-center gap-2 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
            >
              <Plus className="w-4 h-4" />
              {isPolish ? 'Dodaj krok' : 'Add step'}
            </button>
          </div>
        </div>

        {/* Economic Parameters (only in economics phase) */}
        {currentPhase === 'economics' && (
          <div className="mt-6 p-6 bg-c-surface rounded-xl border border-c-border-subtle">
            <h3 className="text-lg font-semibold text-c-text mb-4">
              {isPolish ? 'Parametry ekonomiczne' : 'Economic Parameters'}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">
                  {isPolish ? 'Wolumen dzienny' : 'Daily Volume'}
                </label>
                <input
                  type="number"
                  value={volumePerDay}
                  onChange={(e) => setVolumePerDay(Number(e.target.value))}
                  className="w-full px-4 py-2 border border-c-border-subtle rounded-lg bg-white dark:bg-navy-800 text-c-text"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">
                  {isPolish ? 'Koszt FTE (PLN/mies.)' : 'FTE Cost (PLN/month)'}
                </label>
                <input
                  type="number"
                  value={fteCost}
                  onChange={(e) => setFteCost(Number(e.target.value))}
                  className="w-full px-4 py-2 border border-c-border-subtle rounded-lg bg-white dark:bg-navy-800 text-c-text"
                />
              </div>
            </div>
          </div>
        )}

        {/* Generate Initiative Button */}
        <div className="mt-6 flex justify-end">
          <button className="px-6 py-3 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] font-medium rounded-lg flex items-center gap-2 transition-colors">
            <Lightbulb className="w-5 h-5" />
            {isPolish ? 'Generuj Inicjatywę' : 'Generate Initiative'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProcessAutomationView;
