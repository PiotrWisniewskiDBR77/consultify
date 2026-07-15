/**
 * ToolWizardShell — V3-E03 Tool Wizard Standard
 *
 * Canonical reusable wizard shell for all non-licensed consulting tools.
 * Steps: Define → Inputs & Assumptions → Work → Review → Finalize → Outputs
 *
 * Features:
 * - Step navigation sidebar (242px, NModeLeftNav pattern)
 * - Missing items checklist with re-process loop
 * - Work surface types: Table / Workspace / Hybrid
 * - Output creation with traceability (source_type, source_id)
 * - AI propose→accept model
 *
 * SSOT: docs/product/V3_IMPLEMENTATION_PROGRAM.md (V3-E03)
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  Check,
  CheckSquare,
  ChevronRight,
  FileOutput,
  FileText,
  Lightbulb,
  Loader2,
  Lock,
  Presentation,
  RotateCcw,
  Sparkles,
  Square,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ToolsV8CanonPanel } from '../../Discovery/ToolsV8CanonPanel';
import { Callout } from '../NModeBlocks/Callout';
import { ChecklistBlock } from '../NModeBlocks/ChecklistBlock';
import { EmptyStateInline } from '../NModeBlocks/EmptyStateInline';
import { ToolWizardHeader } from './ToolWizardHeader';
import { ToolWizardStepNav } from './ToolWizardStepNav';
import type {
  AISuggestion,
  MissingItem,
  OutputType,
  ToolWizardShellProps,
  WizardInputField,
  WizardSessionData,
  WizardStepId,
} from './types';

const STEP_ORDER: WizardStepId[] = ['define', 'inputs', 'work', 'review', 'finalize', 'outputs'];
const STANDARD_OUTPUTS: OutputType[] = ['initiative', 'report', 'presentation', 'idea'];

export const ToolWizardShell: React.FC<ToolWizardShellProps> = ({
  config,
  sessionData,
  onSessionUpdate,
  onStepChange,
  onFinalize,
  onCreateOutput,
  onBack,
  renderWorkSurface,
  renderStepContent,
  locked = false,
}) => {
  const { i18n, t } = useTranslation();
  const lang = i18n.language === 'pl' ? 'pl' : 'en';
  const [saving, setSaving] = useState(false);

  const currentStep = sessionData.currentStep;
  const stepIdx = STEP_ORDER.indexOf(currentStep);

  const allMissingItems = useMemo(() => {
    const items: MissingItem[] = [];
    for (const step of config.steps) {
      if (step.validate) {
        items.push(...step.validate(sessionData));
      }
    }
    items.push(...(sessionData.review?.missingItems || []));
    return items;
  }, [config.steps, sessionData]);

  const unresolvedRequired = allMissingItems.filter(
    (m) => m.severity === 'required' && !m.resolved
  );

  const canAdvance = useCallback(
    (fromStep: WizardStepId): boolean => {
      const stepMissing = unresolvedRequired.filter((m) => m.stepId === fromStep);
      return stepMissing.length === 0;
    },
    [unresolvedRequired]
  );

  const handleNext = useCallback(() => {
    if (stepIdx < STEP_ORDER.length - 1) {
      const nextStep = STEP_ORDER[stepIdx + 1];
      onStepChange(nextStep);
      onSessionUpdate({ currentStep: nextStep });
    }
  }, [stepIdx, onStepChange, onSessionUpdate]);

  const handlePrev = useCallback(() => {
    if (stepIdx > 0) {
      const prevStep = STEP_ORDER[stepIdx - 1];
      onStepChange(prevStep);
      onSessionUpdate({ currentStep: prevStep });
    }
  }, [stepIdx, onStepChange, onSessionUpdate]);

  const handleReprocess = useCallback(() => {
    const firstMissingStep = unresolvedRequired[0]?.stepId;
    if (firstMissingStep) {
      onStepChange(firstMissingStep);
      onSessionUpdate({ currentStep: firstMissingStep });
    }
  }, [unresolvedRequired, onStepChange, onSessionUpdate]);

  // ----- Default step renderers -----

  const renderDefineStep = () => {
    const customContent = renderStepContent?.('define', sessionData);
    if (customContent) return customContent;

    return (
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            {t('tools.wizard.define.intent', 'Intent / Goal')}
          </label>
          <textarea
            value={sessionData.define?.intent || ''}
            onChange={(e) =>
              onSessionUpdate({ define: { ...sessionData.define, intent: e.target.value } })
            }
            placeholder={t(
              'tools.wizard.define.intentPlaceholder',
              'What do you want to achieve with this analysis?'
            )}
            className="w-full h-24 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-colors resize-none"
            disabled={locked}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            {t('tools.wizard.define.scope', 'Scope')}
          </label>
          <textarea
            value={sessionData.define?.scope || ''}
            onChange={(e) =>
              onSessionUpdate({ define: { ...sessionData.define, scope: e.target.value } })
            }
            placeholder={t(
              'tools.wizard.define.scopePlaceholder',
              'What is the scope of this analysis?'
            )}
            className="w-full h-20 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-colors resize-none"
            disabled={locked}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            {t('tools.wizard.define.audience', 'Target Audience')}
          </label>
          <input
            type="text"
            value={sessionData.define?.audience || ''}
            onChange={(e) =>
              onSessionUpdate({ define: { ...sessionData.define, audience: e.target.value } })
            }
            placeholder={t(
              'tools.wizard.define.audiencePlaceholder',
              'Who is the target audience for the results?'
            )}
            className="w-full h-9 px-3 text-sm rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-colors"
            disabled={locked}
          />
        </div>
      </div>
    );
  };

  const renderInputsStep = () => {
    const customContent = renderStepContent?.('inputs', sessionData);
    if (customContent) return customContent;

    const fields = config.inputFields || [];

    return (
      <div className="space-y-6">
        {fields.length === 0 && (
          <EmptyStateInline
            message={t('tools.wizard.inputs.noFieldsTitle', 'No input fields defined')}
            hint={t(
              'tools.wizard.inputs.noFieldsHint',
              'This tool does not require additional input data'
            )}
          />
        )}

        {fields.map((field) => (
          <div key={field.id}>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              {field.label[lang]}
              {field.required && <span className="text-danger-400 ml-0.5">*</span>}
            </label>
            {field.type === 'textarea' ? (
              <textarea
                value={(sessionData.inputs[field.id] as string) || ''}
                onChange={(e) =>
                  onSessionUpdate({ inputs: { ...sessionData.inputs, [field.id]: e.target.value } })
                }
                placeholder={field.placeholder?.[lang]}
                className="w-full h-24 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-colors resize-none"
                disabled={locked}
              />
            ) : (
              <input
                type={field.type === 'number' ? 'number' : 'text'}
                value={(sessionData.inputs[field.id] as string) || ''}
                onChange={(e) =>
                  onSessionUpdate({ inputs: { ...sessionData.inputs, [field.id]: e.target.value } })
                }
                placeholder={field.placeholder?.[lang]}
                className="w-full h-9 px-3 text-sm rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-colors"
                disabled={locked}
              />
            )}
            {field.helpText && (
              <p className="text-[11px] text-slate-500 mt-1">{field.helpText[lang]}</p>
            )}
          </div>
        ))}

        {/* Assumptions section */}
        <div className="pt-4 border-t border-slate-200 dark:border-navy-700">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
            {t('tools.wizard.assumptions', 'Assumptions')}
          </h3>
          {sessionData.assumptions.length === 0 ? (
            <EmptyStateInline
              message={t('tools.wizard.assumptionsEmptyTitle', 'No assumptions yet')}
              hint={t(
                'tools.wizard.assumptionsEmptyHint',
                'AI will propose assumptions during work'
              )}
            />
          ) : (
            <div className="space-y-2">
              {sessionData.assumptions.map((a) => (
                <div
                  key={a.id}
                  className={`flex items-start gap-2 p-2.5 rounded-lg border ${
                    a.accepted
                      ? 'border-emerald-500/30 bg-emerald-500/5'
                      : 'border-slate-300 dark:border-navy-600 bg-slate-50 dark:bg-navy-800'
                  }`}
                >
                  <button
                    onClick={() => {
                      const updated = sessionData.assumptions.map((item) =>
                        item.id === a.id ? { ...item, accepted: !item.accepted } : item
                      );
                      onSessionUpdate({ assumptions: updated });
                    }}
                    disabled={locked}
                    className="mt-0.5 shrink-0"
                  >
                    {a.accepted ? (
                      <CheckSquare size={16} className="text-emerald-500" />
                    ) : (
                      <Square size={16} className="text-slate-600" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700 dark:text-slate-300">{a.text}</p>
                    <span className="text-[10px] text-slate-600 uppercase">{a.source}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderWorkStep = () => {
    const customContent = renderStepContent?.('work', sessionData);
    if (customContent) return customContent;

    if (renderWorkSurface) {
      return renderWorkSurface(sessionData, (workData) => onSessionUpdate({ workData }));
    }

    return (
      <EmptyStateInline
        message={t('tools.wizard.work.placeholderTitle', 'Work surface')}
        hint={t(
          'tools.wizard.work.placeholderHint',
          'Work surface configuration depends on the tool type'
        )}
      />
    );
  };

  const renderReviewStep = () => {
    const customContent = renderStepContent?.('review', sessionData);
    if (customContent) return customContent;

    return (
      <div className="space-y-6">
        {/* Missing items checklist */}
        {unresolvedRequired.length > 0 && (
          <Callout
            variant="warning"
            title={t('tools.wizard.review.missingRequired', 'Missing required items')}
          >
            <div className="space-y-1.5 mt-2">
              {unresolvedRequired.map((item) => (
                <div key={item.id} className="flex items-center gap-2 text-sm">
                  <AlertCircle size={14} className="text-amber-500 shrink-0" />
                  <span>{item.label[lang]}</span>
                  <button
                    onClick={() => {
                      onStepChange(item.stepId);
                      onSessionUpdate({ currentStep: item.stepId });
                    }}
                    className="text-xs text-primary-500 hover:text-primary-400 underline ml-auto"
                  >
                    {t('tools.wizard.review.goToStep', 'Go to step')}
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={handleReprocess}
              className="mt-3 flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 hover:text-amber-500"
            >
              <RotateCcw size={12} />
              {t('tools.wizard.review.reprocess', 'Re-process missing items')}
            </button>
          </Callout>
        )}

        {unresolvedRequired.length === 0 && (
          <Callout
            variant="success"
            title={t('tools.wizard.review.allComplete', 'All required items are complete')}
          >
            <p className="text-sm mt-1">
              {t('tools.wizard.review.allCompleteHint', 'You can proceed to finalize the session.')}
            </p>
          </Callout>
        )}

        {/* AI Suggestions */}
        {sessionData.review?.aiSuggestions?.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
              <Lightbulb size={16} className="text-primary-500" />
              {t('tools.wizard.review.aiSuggestions', 'AI Suggestions')}
            </h3>
            <div className="space-y-2">
              {sessionData.review.aiSuggestions.map((suggestion) => (
                <AISuggestionCard
                  key={suggestion.id}
                  suggestion={suggestion}
                  onAccept={() => {
                    const updated = sessionData.review.aiSuggestions.map((s) =>
                      s.id === suggestion.id ? { ...s, status: 'accepted' as const } : s
                    );
                    onSessionUpdate({
                      review: { ...sessionData.review, aiSuggestions: updated },
                    });
                  }}
                  onReject={() => {
                    const updated = sessionData.review.aiSuggestions.map((s) =>
                      s.id === suggestion.id ? { ...s, status: 'rejected' as const } : s
                    );
                    onSessionUpdate({
                      review: { ...sessionData.review, aiSuggestions: updated },
                    });
                  }}
                  locked={locked}
                />
              ))}
            </div>
          </div>
        )}

        {/* Summaries */}
        {sessionData.review?.summaries?.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
              {t('tools.wizard.review.summaries', 'Key Findings')}
            </h3>
            <div className="space-y-2">
              {sessionData.review.summaries.map((summary, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-sm text-slate-700 dark:text-slate-300"
                >
                  {summary}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderFinalizeStep = () => {
    const customContent = renderStepContent?.('finalize', sessionData);
    if (customContent) return customContent;

    const isFinalized = sessionData.status === 'FINALIZED';

    return (
      <div className="space-y-6">
        {isFinalized ? (
          <Callout variant="success" title={t('tools.wizard.finalize.done', 'Session finalized')}>
            <p className="text-sm mt-1">
              {t(
                'tools.wizard.finalize.doneHint',
                'Session is locked. Go to the Outputs step to create reports, presentations, initiatives, and ideas.'
              )}
            </p>
          </Callout>
        ) : (
          <>
            {unresolvedRequired.length > 0 ? (
              <Callout
                variant="warning"
                title={t('tools.wizard.finalize.cannotFinalize', 'Cannot finalize yet')}
              >
                <p className="text-sm mt-1">
                  {t('tools.wizard.finalize.cannotFinalizeHint', {
                    count: unresolvedRequired.length,
                    defaultValue: `${unresolvedRequired.length} required items are missing. Go back to Review.`,
                  })}
                </p>
              </Callout>
            ) : (
              <Callout variant="info" title={t('tools.wizard.finalize.ready', 'Ready to finalize')}>
                <p className="text-sm mt-1">
                  {t(
                    'tools.wizard.finalize.readyHint',
                    'Finalizing will lock the session for editing. You will be able to create outputs (reports, initiatives, presentations, and ideas).'
                  )}
                </p>
              </Callout>
            )}

            <button
              onClick={onFinalize}
              disabled={unresolvedRequired.length > 0 || locked}
              className="w-full h-11 flex items-center justify-center gap-2 rounded-lg text-sm font-semibold bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Lock size={16} />
              {t('tools.wizard.finalize.button', 'Finalize Session')}
            </button>
          </>
        )}
      </div>
    );
  };

  const renderOutputsStep = () => {
    const customContent = renderStepContent?.('outputs', sessionData);
    if (customContent) return customContent;

    const isFinalized = sessionData.status === 'FINALIZED';

    if (!isFinalized) {
      return (
        <Callout variant="info" title={t('tools.wizard.outputs.notFinalized', 'Finalize first')}>
          <p className="text-sm mt-1">
            {t('tools.wizard.outputs.notFinalizedHint', 'Finalize the session to create outputs.')}
          </p>
        </Callout>
      );
    }

    const outputButtons: Array<{ type: OutputType; icon: React.ReactNode; label: string }> = [];
    const availableOutputs = STANDARD_OUTPUTS.filter(
      (outputType) => outputType === 'idea' || config.outputCapabilities.includes(outputType)
    );

    if (availableOutputs.includes('initiative')) {
      outputButtons.push({
        type: 'initiative',
        icon: <Lightbulb size={18} />,
        label: t('tools.wizard.outputs.createInitiative', 'Create Initiative'),
      });
    }
    if (availableOutputs.includes('report')) {
      outputButtons.push({
        type: 'report',
        icon: <FileText size={18} />,
        label: t('tools.wizard.outputs.createReport', 'Create Report'),
      });
    }
    if (availableOutputs.includes('presentation')) {
      outputButtons.push({
        type: 'presentation',
        icon: <Presentation size={18} />,
        label: t('tools.wizard.outputs.createPresentation', 'Create Presentation'),
      });
    }
    if (availableOutputs.includes('idea')) {
      outputButtons.push({
        type: 'idea',
        icon: <Sparkles size={18} />,
        label: t('tools.wizard.outputs.createIdea', 'Create Idea'),
      });
    }

    return (
      <div className="space-y-6">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {t(
            'tools.wizard.outputs.hint',
            'Create artifacts based on session results. Each output will be linked to this session. The standard output layer includes initiative, report, presentation, and idea.'
          )}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {outputButtons.map((btn) => (
            <button
              key={btn.type}
              onClick={() => onCreateOutput(btn.type)}
              className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 hover:border-primary-500/50 hover:bg-primary-500/5 transition-all text-left group"
            >
              <span className="p-2.5 rounded-lg bg-primary-500/10 text-primary-500 group-hover:bg-primary-500/20 transition-colors">
                {btn.icon}
              </span>
              <span className="text-sm font-medium text-slate-900 dark:text-white">
                {btn.label}
              </span>
            </button>
          ))}
        </div>

        {/* Existing outputs */}
        {sessionData.outputs.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
              {t('tools.wizard.outputs.created', 'Created Outputs')}
            </h3>
            <div className="space-y-2">
              {sessionData.outputs.map((output) => (
                <div
                  key={output.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700"
                >
                  <FileOutput size={16} className="text-primary-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-slate-900 dark:text-white truncate block">
                      {output.title}
                    </span>
                    <span className="text-[11px] text-slate-500 uppercase">{output.type}</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 text-[10px] font-medium rounded ${
                      output.status === 'created'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-slate-500/20 text-slate-600'
                    }`}
                  >
                    {output.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ----- Main render -----

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'define':
        return renderDefineStep();
      case 'inputs':
        return renderInputsStep();
      case 'work':
        return renderWorkStep();
      case 'review':
        return renderReviewStep();
      case 'finalize':
        return renderFinalizeStep();
      case 'outputs':
        return renderOutputsStep();
      default:
        return null;
    }
  };

  const currentStepConfig = config.steps.find((s) => s.id === currentStep);

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-navy-950">
      <ToolWizardHeader
        config={config}
        sessionData={sessionData}
        currentStep={currentStep}
        onBack={onBack}
        locked={locked}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Step Navigation */}
        <ToolWizardStepNav
          steps={config.steps}
          currentStep={currentStep}
          sessionData={sessionData}
          onStepChange={(step) => {
            onStepChange(step);
            onSessionUpdate({ currentStep: step });
          }}
          missingItems={allMissingItems}
          locked={locked}
        />

        {/* Content area */}
        <div className="flex-1 overflow-auto">
          <div
            className={`mx-auto px-6 py-6 ${
              currentStep === 'work' && config.surfaceType === 'hybrid' ? 'max-w-6xl' : 'max-w-3xl'
            }`}
          >
            {/* Step title */}
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {currentStepConfig?.label[lang] || currentStep}
              </h2>
              {currentStepConfig?.description && (
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {currentStepConfig.description[lang]}
                </p>
              )}
            </div>

            <ToolsV8CanonPanel mode="session" compact className="mb-6" />

            {/* Step content with animation */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
              >
                {renderCurrentStep()}
              </motion.div>
            </AnimatePresence>

            {/* Navigation buttons */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-200 dark:border-navy-700">
              <button
                onClick={handlePrev}
                disabled={stepIdx === 0}
                className="h-9 px-4 flex items-center gap-1.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t('tools.wizard.prev', 'Previous')}
              </button>

              {stepIdx < STEP_ORDER.length - 1 && (
                <button
                  onClick={handleNext}
                  disabled={!canAdvance(currentStep) && currentStep !== 'work'}
                  className="h-9 px-4 flex items-center gap-1.5 rounded-lg text-sm font-medium bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('tools.wizard.next', 'Next')}
                  <ChevronRight size={16} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ----- AI Suggestion Card -----

interface AISuggestionCardProps {
  suggestion: AISuggestion;
  onAccept: () => void;
  onReject: () => void;
  locked: boolean;
  /** @deprecated no longer used — labels are resolved via useTranslation() internally. */
  lang?: string;
}

const AISuggestionCard: React.FC<AISuggestionCardProps> = ({
  suggestion,
  onAccept,
  onReject,
  locked,
}) => {
  const { t } = useTranslation();
  const statusColors = {
    pending: 'border-slate-200 dark:border-navy-700',
    accepted: 'border-emerald-500/30 bg-emerald-500/5',
    rejected: 'border-danger-500/30 bg-danger-500/5 opacity-60',
  };

  return (
    <div className={`p-3 rounded-lg border ${statusColors[suggestion.status]}`}>
      <p className="text-sm text-slate-700 dark:text-slate-300 mb-2">{suggestion.content}</p>
      {suggestion.status === 'pending' && !locked && (
        <div className="flex items-center gap-2">
          <button
            onClick={onAccept}
            className="px-2.5 py-1 text-xs font-medium rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
          >
            {t('tools.wizard.aiSuggestion.accept', 'Accept')}
          </button>
          <button
            onClick={onReject}
            className="px-2.5 py-1 text-xs font-medium rounded bg-slate-500/10 text-slate-600 dark:text-slate-400 hover:bg-slate-500/20 transition-colors"
          >
            {t('tools.wizard.aiSuggestion.reject', 'Reject')}
          </button>
        </div>
      )}
      {suggestion.status !== 'pending' && (
        <span
          className={`text-[10px] uppercase font-medium ${
            suggestion.status === 'accepted' ? 'text-emerald-500' : 'text-danger-400'
          }`}
        >
          {suggestion.status}
        </span>
      )}
    </div>
  );
};
