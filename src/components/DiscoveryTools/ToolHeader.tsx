/**
 * ToolHeader - Header component for strategic tools
 *
 * Displays tool name, progress, step navigation, and actions.
 */

import { ArrowLeft, Check, Download, HelpCircle, Lightbulb } from 'lucide-react';
import React from 'react';

import { StepDefinition, ToolType } from '@/store/useToolStore';

// ==================== TYPES ====================

interface ToolHeaderProps {
  toolType: ToolType;
  toolMeta: {
    name: string;
    namePl: string;
    color: string;
    badge: string;
  };
  sessionName: string;
  toolStatus?: 'DRAFT' | 'REVIEW' | 'APPROVED';
  progress: number;
  currentStep: number;
  totalSteps: number;
  steps: StepDefinition[];
  completedSteps: string[];
  onBack: () => void;
  onStepClick: (step: number) => void;
  onHelp?: () => void;
  onExport?: () => void;
  onCreateInitiative?: () => void;
  onRequestReview?: () => void;
  canRequestReview?: boolean;
  isPolish: boolean;
}

// ==================== COMPONENT ====================

export const ToolHeader: React.FC<ToolHeaderProps> = ({
  toolType,
  toolMeta,
  sessionName,
  toolStatus = 'DRAFT',
  progress,
  currentStep,
  totalSteps,
  steps,
  completedSteps,
  onBack,
  onStepClick,
  onHelp,
  onExport,
  onCreateInitiative,
  onRequestReview,
  canRequestReview,
  isPolish,
}) => {
  const statusLabel =
    toolStatus === 'REVIEW'
      ? isPolish
        ? 'REVIEW'
        : 'REVIEW'
      : toolStatus === 'APPROVED'
        ? isPolish
          ? 'APPROVED'
          : 'APPROVED'
        : isPolish
          ? 'DRAFT'
          : 'DRAFT';

  return (
    <div className="bg-white dark:bg-navy-900 border-b border-slate-200 dark:border-navy-700">
      {/* Top bar */}
      <div className="px-4 py-3 flex items-center justify-between">
        {/* Left: Back and title */}
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-700 dark:text-slate-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <span
              className={`px-2 py-1 rounded text-xs font-mono font-bold border bg-${toolMeta.color}-100 dark:bg-${toolMeta.color}-900/30 text-${toolMeta.color}-700 border-${toolMeta.color}-200 dark:border-${toolMeta.color}-800 dark:text-${toolMeta.color}-400`}
            >
              {toolMeta.badge}
            </span>
            <div>
              <h1 className="font-semibold text-slate-900 dark:text-white">
                {isPolish ? toolMeta.namePl : toolMeta.name}
              </h1>
              <p className="text-xs text-slate-600 dark:text-slate-400">{sessionName}</p>
            </div>
            <span className="px-2 py-1 rounded-full text-xs bg-slate-100 border border-slate-200 dark:bg-navy-800 dark:border-navy-700 text-slate-700 dark:text-slate-300">
              {statusLabel}
            </span>
          </div>
        </div>

        {/* Center: Progress */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-32 h-2 rounded-full bg-slate-200 dark:bg-navy-700 overflow-hidden">
              <div
                className={`h-full bg-${toolMeta.color}-500 transition-all duration-300`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-sm text-slate-600 dark:text-slate-400">{progress}%</span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {onHelp && (
            <button
              onClick={onHelp}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-700 dark:text-slate-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              title={isPolish ? 'Pomoc' : 'Help'}
            >
              <HelpCircle className="w-5 h-5" />
            </button>
          )}
          {onRequestReview && toolStatus === 'DRAFT' && (
            <button
              onClick={onRequestReview}
              disabled={!canRequestReview}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                canRequestReview
                  ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                  : 'bg-slate-100 dark:bg-navy-800 text-slate-400 cursor-not-allowed'
              } text-sm font-medium transition-colors`}
            >
              <Check className="w-4 h-4" />
              {isPolish ? 'Request review' : 'Request review'}
            </button>
          )}
          {onExport && (
            <button
              onClick={onExport}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-700 dark:text-slate-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              title={isPolish ? 'Eksportuj' : 'Export'}
            >
              <Download className="w-5 h-5" />
            </button>
          )}
          {onCreateInitiative && (
            <button
              onClick={onCreateInitiative}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-${toolMeta.color}-500 hover:bg-${toolMeta.color}-600 text-white text-sm font-medium transition-colors`}
            >
              <Lightbulb className="w-4 h-4" />
              {isPolish ? 'Utwórz inicjatywę' : 'Create Initiative'}
            </button>
          )}
        </div>
      </div>

      {/* Step navigation */}
      <div className="px-4 py-2 flex items-center gap-2 overflow-x-auto">
        {steps.map((step, index) => {
          const stepNum = index + 1;
          const isActive = stepNum === currentStep;
          const isCompleted = completedSteps.includes(step.id);
          const canClick = isCompleted || stepNum <= currentStep;

          return (
            <button
              key={step.id}
              onClick={() => canClick && onStepClick(stepNum)}
              disabled={!canClick}
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1
                ${
                  isActive
                    ? `bg-${toolMeta.color}-100 dark:bg-${toolMeta.color}-900/30 text-${toolMeta.color}-800 dark:text-${toolMeta.color}-300 border border-${toolMeta.color}-200 dark:border-${toolMeta.color}-800 font-semibold`
                    : isCompleted
                      ? 'bg-slate-100 dark:bg-navy-800 text-slate-800 dark:text-slate-300 border border-slate-200 dark:border-navy-700'
                      : 'text-slate-600 dark:text-slate-500'
                }
                ${canClick ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed'}
              `}
            >
              {isCompleted ? (
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-500" />
              ) : (
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-semibold ${
                    isActive
                      ? `bg-${toolMeta.color}-600 text-white`
                      : 'bg-slate-200 dark:bg-navy-700 text-slate-700 dark:text-slate-500'
                  }`}
                >
                  {stepNum}
                </span>
              )}
              <span>{isPolish ? step.namePl : step.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ToolHeader;
