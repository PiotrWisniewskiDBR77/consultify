/**
 * ProcessMapWorkSurface — V3-E05 Process Automation
 *
 * Hybrid table+workspace for process mapping:
 * - Left 60%: editable process steps table
 * - Right 40%: simple vertical flow visualization (read-only, auto-generated)
 *
 * DBR77 styling: navy-900 bg, rounded-xl, subtle borders
 */

import {
  ArrowDown,
  ChevronDown,
  ChevronUp,
  Clock,
  Cpu,
  DollarSign,
  GripVertical,
  Plus,
  Trash2,
} from 'lucide-react';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

export type AutomationPotential = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';

export interface ProcessStep {
  id: string;
  order: number;
  name: string;
  actor: string;
  system: string;
  durationMinutes: number;
  costEstimate: number;
  automationPotential: AutomationPotential;
  notes: string;
}

export interface ProcessMapWorkSurfaceProps {
  steps: ProcessStep[];
  onStepsChange: (steps: ProcessStep[]) => void;
  locked?: boolean;
}

const AUTOMATION_OPTIONS: AutomationPotential[] = ['HIGH', 'MEDIUM', 'LOW', 'NONE'];

function generateId(): string {
  return `step-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export const ProcessMapWorkSurface: React.FC<ProcessMapWorkSurfaceProps> = ({
  steps,
  onStepsChange,
  locked = false,
}) => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'pl' ? 'pl' : 'en';

  const sortedSteps = useMemo(() => [...steps].sort((a, b) => a.order - b.order), [steps]);

  const handleAddStep = useCallback(() => {
    if (locked) return;
    const maxOrder = steps.length > 0 ? Math.max(...steps.map((s) => s.order)) : 0;
    const newStep: ProcessStep = {
      id: generateId(),
      order: maxOrder + 1,
      name: '',
      actor: '',
      system: '',
      durationMinutes: 0,
      costEstimate: 0,
      automationPotential: 'NONE',
      notes: '',
    };
    onStepsChange([...steps, newStep]);
  }, [steps, onStepsChange, locked]);

  const handleRemoveStep = useCallback(
    (id: string) => {
      if (locked) return;
      const filtered = steps.filter((s) => s.id !== id);
      // Re-order
      const reordered = filtered
        .sort((a, b) => a.order - b.order)
        .map((s, idx) => ({ ...s, order: idx + 1 }));
      onStepsChange(reordered);
    },
    [steps, onStepsChange, locked]
  );

  const handleUpdateStep = useCallback(
    (id: string, updates: Partial<ProcessStep>) => {
      if (locked) return;
      const updated = steps.map((s) => (s.id === id ? { ...s, ...updates } : s));
      onStepsChange(updated);
    },
    [steps, onStepsChange, locked]
  );

  const handleMoveUp = useCallback(
    (id: string) => {
      if (locked) return;
      const idx = sortedSteps.findIndex((s) => s.id === id);
      if (idx <= 0) return;
      const prev = sortedSteps[idx - 1];
      const reordered = steps.map((s) => {
        if (s.id === id) return { ...s, order: prev.order };
        if (s.id === prev.id) return { ...s, order: sortedSteps[idx].order };
        return s;
      });
      onStepsChange(reordered);
    },
    [steps, sortedSteps, onStepsChange, locked]
  );

  const handleMoveDown = useCallback(
    (id: string) => {
      if (locked) return;
      const idx = sortedSteps.findIndex((s) => s.id === id);
      if (idx < 0 || idx >= sortedSteps.length - 1) return;
      const next = sortedSteps[idx + 1];
      const reordered = steps.map((s) => {
        if (s.id === id) return { ...s, order: next.order };
        if (s.id === next.id) return { ...s, order: sortedSteps[idx].order };
        return s;
      });
      onStepsChange(reordered);
    },
    [steps, sortedSteps, onStepsChange, locked]
  );

  const automationPotentialLabels: Record<AutomationPotential, { en: string; pl: string }> = {
    HIGH: { en: 'High', pl: 'Wysoki' },
    MEDIUM: { en: 'Medium', pl: 'Średni' },
    LOW: { en: 'Low', pl: 'Niski' },
    NONE: { en: 'None', pl: 'Brak' },
  };

  const potentialColors: Record<AutomationPotential, string> = {
    HIGH: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    MEDIUM: 'bg-primary-500/20 text-primary-400 border-primary-500/30',
    LOW: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    NONE: 'bg-slate-500/20 text-slate-600 border-slate-500/30',
  };

  return (
    <div className="flex gap-4 h-full min-h-[400px]">
      {/* Left panel — editable table (60%) */}
      <div className="flex-[6] min-w-0 flex flex-col rounded-xl border border-slate-700 dark:border-navy-700 bg-slate-50 dark:bg-navy-900 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-navy-700">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            {t('processFlow.workSurface.processSteps', 'Process Steps')}
          </h3>
          {!locked && (
            <button
              onClick={handleAddStep}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] transition-colors"
            >
              <Plus size={14} />
              {t('processFlow.workSurface.addStep', 'Add step')}
            </button>
          )}
        </div>
        <div className="flex-1 overflow-auto">
          <table
            /* §27-exempt: layout specjalizowany/read-only/data-viz, nie kanoniczna lista przegladana */ className="w-full text-sm border-collapse"
          >
            <thead>
              <tr className="bg-slate-100 dark:bg-navy-800/80 sticky top-0">
                <th className="w-8 px-2 py-2 text-left text-slate-500 dark:text-slate-400 font-medium border-b border-slate-200 dark:border-navy-700" />
                <th className="w-10 px-2 py-2 text-left text-slate-500 dark:text-slate-400 font-medium border-b border-slate-200 dark:border-navy-700">
                  #
                </th>
                <th className="min-w-[120px] px-2 py-2 text-left text-slate-500 dark:text-slate-400 font-medium border-b border-slate-200 dark:border-navy-700">
                  {t('processFlow.workSurface.stepName', 'Step Name')}
                </th>
                <th className="min-w-[90px] px-2 py-2 text-left text-slate-500 dark:text-slate-400 font-medium border-b border-slate-200 dark:border-navy-700">
                  {t('processFlow.workSurface.actor', 'Actor/Role')}
                </th>
                <th className="min-w-[90px] px-2 py-2 text-left text-slate-500 dark:text-slate-400 font-medium border-b border-slate-200 dark:border-navy-700">
                  {t('processFlow.workSurface.system', 'System/Tool')}
                </th>
                <th className="w-20 px-2 py-2 text-left text-slate-500 dark:text-slate-400 font-medium border-b border-slate-200 dark:border-navy-700">
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {t('processFlow.workSurface.minutes', 'Min')}
                  </span>
                </th>
                <th className="w-20 px-2 py-2 text-left text-slate-500 dark:text-slate-400 font-medium border-b border-slate-200 dark:border-navy-700">
                  <span className="flex items-center gap-1">
                    <DollarSign size={12} />
                    {t('processFlow.workSurface.cost', 'Cost')}
                  </span>
                </th>
                <th className="min-w-[100px] px-2 py-2 text-left text-slate-500 dark:text-slate-400 font-medium border-b border-slate-200 dark:border-navy-700">
                  <span className="flex items-center gap-1">
                    <Cpu size={12} />
                    {t('processFlow.workSurface.automation', 'Automation')}
                  </span>
                </th>
                <th className="min-w-[80px] px-2 py-2 text-left text-slate-500 dark:text-slate-400 font-medium border-b border-slate-200 dark:border-navy-700">
                  {t('processFlow.workSurface.notes', 'Notes')}
                </th>
                {!locked && (
                  <th className="w-16 px-2 py-2 text-left text-slate-500 dark:text-slate-400 font-medium border-b border-slate-200 dark:border-navy-700" />
                )}
              </tr>
            </thead>
            <tbody>
              {sortedSteps.length === 0 ? (
                <tr>
                  <td
                    colSpan={locked ? 9 : 10}
                    className="px-4 py-8 text-center text-slate-500 dark:text-slate-400"
                  >
                    {t('processFlow.workSurface.emptyTable', 'No steps yet. Click "Add step" to start.')}
                  </td>
                </tr>
              ) : (
                sortedSteps.map((step, idx) => (
                  <tr
                    key={step.id}
                    className="border-b border-slate-200 dark:border-navy-700/50 hover:bg-slate-50 dark:hover:bg-navy-800/30 transition-colors"
                  >
                    {!locked && (
                      <td className="px-2 py-1.5">
                        <div className="flex items-center gap-0.5">
                          <GripVertical size={14} className="text-slate-600 shrink-0" />
                          <button
                            onClick={() => handleMoveUp(step.id)}
                            disabled={idx === 0}
                            className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-navy-600 disabled:opacity-30 disabled:cursor-not-allowed"
                            title={t('processFlow.workSurface.moveUp', 'Move up')}
                          >
                            <ChevronUp size={14} className="text-slate-600" />
                          </button>
                          <button
                            onClick={() => handleMoveDown(step.id)}
                            disabled={idx === sortedSteps.length - 1}
                            className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-navy-600 disabled:opacity-30 disabled:cursor-not-allowed"
                            title={t('processFlow.workSurface.moveDown', 'Move down')}
                          >
                            <ChevronDown size={14} className="text-slate-600" />
                          </button>
                        </div>
                      </td>
                    )}
                    <td className="px-2 py-1.5 text-slate-500 dark:text-slate-400">{idx + 1}</td>
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        value={step.name}
                        onChange={(e) => handleUpdateStep(step.id, { name: e.target.value })}
                        placeholder={t('processFlow.workSurface.namePlaceholder', 'Name')}
                        className="w-full min-w-[100px] px-2 py-1 text-sm rounded border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-1 focus:ring-primary-500/50 focus:border-primary-500 disabled:opacity-60 disabled:cursor-not-allowed"
                        disabled={locked}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        value={step.actor}
                        onChange={(e) => handleUpdateStep(step.id, { actor: e.target.value })}
                        placeholder={t('processFlow.workSurface.rolePlaceholder', 'Role')}
                        className="w-full min-w-[80px] px-2 py-1 text-sm rounded border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-1 focus:ring-primary-500/50 focus:border-primary-500 disabled:opacity-60 disabled:cursor-not-allowed"
                        disabled={locked}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        value={step.system}
                        onChange={(e) => handleUpdateStep(step.id, { system: e.target.value })}
                        placeholder={t('processFlow.workSurface.systemPlaceholder', 'System')}
                        className="w-full min-w-[80px] px-2 py-1 text-sm rounded border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-1 focus:ring-primary-500/50 focus:border-primary-500 disabled:opacity-60 disabled:cursor-not-allowed"
                        disabled={locked}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        min={0}
                        value={step.durationMinutes || ''}
                        onChange={(e) =>
                          handleUpdateStep(step.id, {
                            durationMinutes: parseInt(e.target.value, 10) || 0,
                          })
                        }
                        placeholder="0"
                        className="w-16 px-2 py-1 text-sm rounded border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-1 focus:ring-primary-500/50 focus:border-primary-500 disabled:opacity-60 disabled:cursor-not-allowed"
                        disabled={locked}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={step.costEstimate || ''}
                        onChange={(e) =>
                          handleUpdateStep(step.id, {
                            costEstimate: parseFloat(e.target.value) || 0,
                          })
                        }
                        placeholder="0"
                        className="w-16 px-2 py-1 text-sm rounded border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-1 focus:ring-primary-500/50 focus:border-primary-500 disabled:opacity-60 disabled:cursor-not-allowed"
                        disabled={locked}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        value={step.automationPotential}
                        onChange={(e) =>
                          handleUpdateStep(step.id, {
                            automationPotential: e.target.value as AutomationPotential,
                          })
                        }
                        className="px-2 py-1 text-sm rounded border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-primary-500/50 focus:border-primary-500 disabled:opacity-60 disabled:cursor-not-allowed"
                        disabled={locked}
                      >
                        {AUTOMATION_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {automationPotentialLabels[opt][lang]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="text"
                        value={step.notes}
                        onChange={(e) => handleUpdateStep(step.id, { notes: e.target.value })}
                        placeholder={t('processFlow.workSurface.notesPlaceholder', 'Notes')}
                        className="w-full min-w-[80px] px-2 py-1 text-sm rounded border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-1 focus:ring-primary-500/50 focus:border-primary-500 disabled:opacity-60 disabled:cursor-not-allowed"
                        disabled={locked}
                      />
                    </td>
                    {!locked && (
                      <td className="px-2 py-1.5">
                        <button
                          onClick={() => handleRemoveStep(step.id)}
                          className="p-1.5 rounded text-slate-600 hover:text-danger-500 hover:bg-danger-500/10 transition-colors"
                          title={t('processFlow.workSurface.remove', 'Remove')}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right panel — flow visualization (40%) */}
      <div className="flex-[4] min-w-0 flex flex-col rounded-xl border border-slate-700 dark:border-navy-700 bg-slate-50 dark:bg-navy-900 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-navy-700">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            {t('processFlow.workSurface.flowTitle', 'Process Flow')}
          </h3>
        </div>
        <div className="flex-1 overflow-auto p-4 flex flex-col items-center">
          {sortedSteps.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 text-slate-500 dark:text-slate-400 text-sm">
              <Cpu size={32} className="mb-2 opacity-50" />
              {t('processFlow.workSurface.emptyFlow', 'Add steps in the table to see the flow')}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-0 w-full max-w-[200px]">
              {/* Start */}
              <div className="w-full px-3 py-2 rounded-lg border-2 border-dashed border-slate-400 dark:border-navy-500 bg-slate-100 dark:bg-navy-800/50 text-xs font-medium text-slate-600 dark:text-slate-400 text-center">
                {t('processFlow.workSurface.start', 'Start')}
              </div>
              <div className="flex flex-col items-center py-1">
                <ArrowDown size={16} className="text-slate-600" />
              </div>
              {sortedSteps.map((step, idx) => (
                <React.Fragment key={step.id}>
                  <div
                    className={`w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 text-sm text-slate-800 dark:text-slate-200 ${
                      step.name ? '' : 'italic text-slate-600'
                    }`}
                  >
                    <div className="font-medium truncate">
                      {step.name || t('processFlow.workSurface.unnamed', '(Unnamed)')}
                    </div>
                    {step.actor && (
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {step.actor}
                      </div>
                    )}
                    <span
                      className={`inline-block mt-1 px-1.5 py-0.5 text-[10px] font-medium rounded border ${potentialColors[step.automationPotential]}`}
                    >
                      {automationPotentialLabels[step.automationPotential][lang]}
                    </span>
                  </div>
                  {idx < sortedSteps.length - 1 && (
                    <div className="flex flex-col items-center py-1">
                      <ArrowDown size={16} className="text-slate-600" />
                    </div>
                  )}
                </React.Fragment>
              ))}
              <div className="flex flex-col items-center py-1">
                <ArrowDown size={16} className="text-slate-600" />
              </div>
              {/* End */}
              <div className="w-full px-3 py-2 rounded-lg border-2 border-dashed border-slate-400 dark:border-navy-500 bg-slate-100 dark:bg-navy-800/50 text-xs font-medium text-slate-600 dark:text-slate-400 text-center">
                {t('processFlow.workSurface.end', 'End')}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
