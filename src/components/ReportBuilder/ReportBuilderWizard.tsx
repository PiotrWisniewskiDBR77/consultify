/**
 * ReportBuilderWizard
 *
 * Main wizard component for creating reports from assessments and other sources.
 * Guides users through: Source Selection -> Structure Configuration -> Generation -> Review/Edit
 */

import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  Settings2,
  Sparkles,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

import { Api } from '../../services/api';
import ConfigureStructureStep from './steps/ConfigureStructureStep';
import GenerateStep from './steps/GenerateStep';
import { IntentStep, type ReportIntent } from './steps/IntentStep';
import ReviewEditStep from './steps/ReviewEditStep';
import useReportBuilder from './useReportBuilder';

// ==========================================
// TYPES
// ==========================================

interface WizardStep {
  id: number;
  title: string;
  titlePl: string;
  description: string;
  descriptionPl: string;
  icon: React.ComponentType<{ className?: string }>;
}

const STEPS: WizardStep[] = [
  {
    id: 0,
    title: 'Define Intent',
    titlePl: 'Ustal Parametry',
    description: 'Set the report intent and required parameters before writing',
    descriptionPl: 'Ustal intencję raportu i wymagane parametry przed generowaniem',
    icon: ClipboardCheck,
  },
  {
    id: 1,
    title: 'Outline',
    titlePl: 'Układ / Bloki',
    description: 'Edit blocks, order, and section options',
    descriptionPl: 'Edytuj bloki, kolejność i ustawienia sekcji',
    icon: Settings2,
  },
  {
    id: 2,
    title: 'Generate & Edit',
    titlePl: 'Generuj i Edytuj',
    description: 'Generate content, review, and submit for verification',
    descriptionPl: 'Wygeneruj treść, przejrzyj i wyślij do weryfikacji',
    icon: Sparkles,
  },
];

// ==========================================
// COMPONENT
// ==========================================

interface ReportBuilderWizardProps {
  reportId?: string;
  initialSourceType?: string | null;
  initialSourceId?: string | null;
  initialSourceName?: string | null;
  onComplete?: (reportId: string) => void;
  onCancel?: () => void;
}

export const ReportBuilderWizard: React.FC<ReportBuilderWizardProps> = ({
  reportId: initialReportId,
  initialSourceType,
  initialSourceId,
  initialSourceName,
  onComplete,
  onCancel,
}) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const params = useParams<{ reportId?: string }>();

  const reportId = initialReportId || params.reportId;
  const isPl = i18n.language?.startsWith('pl');

  const {
    currentStep,
    sourceType,
    selectedSource,
    report,
    sections,
    isLoading,
    isGenerating,
    generationProgress,
    error,
    setStep,
    nextStep,
    prevStep,
    setSourceType,
    setSelectedSource,
    clearError,
    reset,
    fetchSources,
    createReport,
    loadReport,
    updateSectionConfig,
    addCustomSection,
    removeSection,
    generateReport,
    generateSection,
    updateSectionContent,
    finalizeReport,
    approveReport,
    sendBackReport,
    markSentInternal,
    markSentExternal,
    updateLocalSection,
    reorderSections,
    exportPdf,
    createShareLink,
    getShareLinks,
    revokeShareLink,
  } = useReportBuilder();

  const [reportTitle, setReportTitle] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [initialSourceLoaded, setInitialSourceLoaded] = useState(false);
  const [intent, setIntent] = useState<ReportIntent>({
    audience: 'executive',
    goal: 'diagnosis',
    language: i18n.language?.startsWith('pl') ? 'pl' : 'en',
    tone: 'consulting',
    scope: 'full',
    focusedAxes: [],
    visuals: { assessmentMatrix: true },
  });

  // If we loaded an existing report with config.intent, hydrate local intent
  useEffect(() => {
    const cfg: any = report?.config;
    if (cfg?.intent && typeof cfg.intent === 'object') {
      setIntent((prev) => ({ ...prev, ...(cfg.intent as any) }));
    }
  }, [report?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initialize from URL params (when coming from Assessment)
  useEffect(() => {
    if (!initialSourceLoaded && initialSourceType && initialSourceId && !reportId) {
      setSourceType(initialSourceType as any);
      // Pre-select the source
      setSelectedSource({
        id: initialSourceId,
        name: initialSourceName || 'Assessment',
        type: initialSourceType,
        status: 'APPROVED',
        framework: 'DRD',
        approvedAt: new Date().toISOString(),
      });
      // Pre-fill title
      setReportTitle(`${initialSourceName || 'Assessment'} - Report`);
      setInitialSourceLoaded(true);
    }
  }, [
    initialSourceType,
    initialSourceId,
    initialSourceName,
    reportId,
    initialSourceLoaded,
    setSourceType,
    setSelectedSource,
  ]);

  // Load existing report if ID provided
  useEffect(() => {
    if (reportId) {
      loadReport(reportId);
    }
  }, [reportId, loadReport]);

  // ==========================================
  // HANDLERS
  // ==========================================

  const handleIntentComplete = useCallback(async () => {
    if (!sourceType || !selectedSource) return;

    const title = reportTitle || `${selectedSource.name} Report`;
    const config = {
      invocationProfileId: intent.profileId || 'default',
      intent,
    };
    // If we already have a report (e.g. returning to CONFIGURING), update intent instead of creating a new one.
    if (report?.id) {
      await Api.put(`/report-builder/${report.id}/intent`, { config });
      nextStep();
      return;
    }

    const result = await createReport(
      sourceType,
      selectedSource.id,
      title,
      reportDescription,
      config
    );
    if (result) nextStep();
  }, [
    sourceType,
    selectedSource,
    reportTitle,
    reportDescription,
    intent,
    report?.id,
    createReport,
    nextStep,
  ]);

  const handleConfigComplete = useCallback(async () => {
    if (!report) return;

    // Save any pending config changes
    const enabledSections = sections.filter((s) => s.enabled);
    if (enabledSections.length === 0) {
      return; // Need at least one section
    }

    nextStep();
  }, [report, sections, nextStep]);

  const handleGenerate = useCallback(async () => {
    if (!report) return;

    await generateReport(report.id, false);
  }, [report, generateReport]);

  const handleFinalize = useCallback(async () => {
    if (!report) return;

    const success = await finalizeReport(report.id);
    if (success && onComplete) {
      onComplete(report.id);
    }
  }, [report, finalizeReport, onComplete]);

  const handleApprove = useCallback(async () => {
    if (!report) return;
    const success = await approveReport(report.id);
    if (success && onComplete) onComplete(report.id);
  }, [report, approveReport, onComplete]);

  const handleSendBack = useCallback(async () => {
    if (!report) return;
    await sendBackReport(report.id);
  }, [report, sendBackReport]);

  const handleMarkSentInternal = useCallback(async () => {
    if (!report) return;
    await markSentInternal(report.id);
  }, [report, markSentInternal]);

  const handleMarkSentExternal = useCallback(async () => {
    if (!report) return;
    await markSentExternal(report.id);
  }, [report, markSentExternal]);

  const handleCancel = useCallback(() => {
    reset();
    onCancel?.();
  }, [reset, onCancel]);

  // ==========================================
  // RENDER HELPERS
  // ==========================================

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      {STEPS.map((step, index) => {
        const Icon = step.icon;
        const isActive = currentStep === step.id;
        const isCompleted = currentStep > step.id;
        const isClickable = isCompleted || step.id === currentStep;

        return (
          <React.Fragment key={step.id}>
            {/* Step Circle */}
            <button
              onClick={() => isClickable && setStep(step.id)}
              disabled={!isClickable}
              className={`
                relative flex items-center justify-center w-12 h-12 rounded-full
                transition-all duration-200
                ${
                  isActive
                    ? 'bg-blue-600 text-white ring-4 ring-blue-100 dark:ring-blue-900/30'
                    : isCompleted
                      ? 'bg-green-500 text-white cursor-pointer hover:bg-green-600'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-500 cursor-not-allowed'
                }
              `}
            >
              {isCompleted ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
            </button>

            {/* Step Label */}
            <div
              className={`
              hidden md:block absolute mt-16 text-center w-32 -ml-10
              ${isActive ? 'text-blue-600 font-medium' : 'text-slate-500'}
            `}
            >
              <div className="text-sm">{isPl ? step.titlePl : step.title}</div>
            </div>

            {/* Connector Line */}
            {index < STEPS.length - 1 && (
              <div
                className={`
                w-16 md:w-24 h-1 mx-2
                ${currentStep > index ? 'bg-green-500' : 'bg-slate-200 dark:bg-slate-700'}
              `}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <IntentStep
            sourceType={sourceType}
            selectedSource={selectedSource}
            reportTitle={reportTitle}
            reportDescription={reportDescription}
            intent={intent}
            onSourceTypeChange={setSourceType}
            onSourceSelect={setSelectedSource}
            onTitleChange={setReportTitle}
            onDescriptionChange={setReportDescription}
            onIntentChange={(patch) => setIntent((prev) => ({ ...prev, ...patch }))}
            fetchSources={fetchSources}
            isLoading={isLoading}
          />
        );

      case 1:
        return (
          <ConfigureStructureStep
            report={report}
            sections={sections}
            onUpdateSection={updateLocalSection}
            onReorderSections={reorderSections}
            onAddSection={async (args) =>
              report
                ? addCustomSection(report.id, args.title, undefined, {
                    length: args.length,
                    language: args.language,
                    blockTypeId: args.blockTypeId,
                    renderKind: args.renderKind,
                  })
                : null
            }
            onRemoveSection={async (key) => (report ? removeSection(report.id, key) : false)}
            onSaveConfig={async (updates) => {
              if (!report) return;
              await updateSectionConfig(report.id, updates);
            }}
            isLoading={isLoading}
          />
        );

      case 2:
        return report?.status === 'GENERATED' ||
          report?.status === 'IN_REVIEW' ||
          report?.status === 'APPROVED' ||
          report?.status === 'SENT_INTERNAL' ||
          report?.status === 'SENT_EXTERNAL' ||
          report?.status === 'UTILIZED' ? (
          <ReviewEditStep
            report={report}
            sections={sections}
            onUpdateContent={async (key, content) => {
              if (!report) return;
              await updateSectionContent(report.id, key, content);
            }}
            onRegenerateSection={async (key, prompt) => {
              if (!report) return;
              await generateSection(report.id, key, prompt);
            }}
            onFinalize={handleFinalize}
            onApprove={handleApprove}
            onSendBack={handleSendBack}
            onMarkSentInternal={handleMarkSentInternal}
            onMarkSentExternal={handleMarkSentExternal}
            onExportPdf={async () => {
              if (!report) return;
              await exportPdf(report.id);
            }}
            onCreateShareLink={async (options) => {
              if (!report) return null;
              return createShareLink(report.id, options);
            }}
            onGetShareLinks={async () => {
              if (!report) return null;
              return getShareLinks(report.id);
            }}
            onRevokeShareLink={async (linkId) => {
              if (!report) return false;
              return revokeShareLink(report.id, linkId);
            }}
            isLoading={isLoading}
          />
        ) : (
          <GenerateStep
            report={report}
            sections={sections}
            isGenerating={isGenerating}
            progress={generationProgress}
            onGenerate={handleGenerate}
            onRegenerateSection={async (key, prompt) => {
              if (!report) return;
              await generateSection(report.id, key, prompt);
            }}
          />
        );

      default:
        return null;
    }
  };

  const renderNavigation = () => {
    const canGoBack = currentStep > 0 && !isGenerating;
    const canGoNext = (() => {
      switch (currentStep) {
        case 0:
          return sourceType && selectedSource && reportTitle.trim();
        case 1:
          return sections.filter((s) => s.enabled).length > 0;
        case 2:
          // Either ready to generate (enabled sections exist) or ready to submit for review
          return sections.filter((s) => s.enabled).length > 0;
        default:
          return false;
      }
    })();

    const nextLabel = (() => {
      switch (currentStep) {
        case 0:
          return isPl ? 'Zapisz parametry' : 'Save intent';
        case 1:
          return isPl ? 'Przejdź do generowania' : 'Proceed to generation';
        case 2:
          return report?.status === 'GENERATED'
            ? isPl
              ? 'Wyślij do weryfikacji'
              : 'Submit for review'
            : isPl
              ? 'Generuj'
              : 'Generate';
        default:
          return isPl ? 'Dalej' : 'Next';
      }
    })();

    const handleNext = () => {
      switch (currentStep) {
        case 0:
          handleIntentComplete();
          break;
        case 1:
          handleConfigComplete();
          break;
        case 2:
          if (report?.status === 'GENERATED') handleFinalize();
          else handleGenerate();
          break;
      }
    };

    return (
      <div className="flex items-center justify-between pt-6 border-t border-slate-200 dark:border-slate-700">
        <div>
          {canGoBack && (
            <button
              onClick={prevStep}
              className="flex items-center gap-2 px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              {isPl ? 'Wstecz' : 'Back'}
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            {isPl ? 'Anuluj' : 'Cancel'}
          </button>

          <button
            onClick={handleNext}
            disabled={!canGoNext || isLoading || isGenerating}
            className={`
              flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-all
              ${
                canGoNext && !isLoading && !isGenerating
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
              }
            `}
          >
            {isLoading || isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowRight className="w-4 h-4" />
            )}
            {nextLabel}
          </button>
        </div>
      </div>
    );
  };

  // ==========================================
  // MAIN RENDER
  // ==========================================

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          {isPl ? 'Kreator Raportów' : 'Report Builder'}
        </h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400">
          {report
            ? report.title
            : isPl
              ? 'Utwórz profesjonalny raport na podstawie danych z oceny'
              : 'Create a professional report based on assessment data'}
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
          <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-medium text-red-800 dark:text-red-200">
              {isPl ? 'Wystąpił błąd' : 'An error occurred'}
            </div>
            <div className="text-sm text-red-600 dark:text-red-300 mt-1">{error}</div>
          </div>
          <button onClick={clearError} className="text-red-500 hover:text-red-700">
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Step Indicator */}
      <div className="relative mb-12">{renderStepIndicator()}</div>

      {/* Step Content */}
      <div className="bg-white dark:bg-navy-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 p-6">
        {/* Step Title */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {isPl ? STEPS[currentStep].titlePl : STEPS[currentStep].title}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {isPl ? STEPS[currentStep].descriptionPl : STEPS[currentStep].description}
          </p>
        </div>

        {/* Step Content */}
        <div className="min-h-[400px]">{renderStepContent()}</div>

        {/* Navigation */}
        {renderNavigation()}
      </div>
    </div>
  );
};

export default ReportBuilderWizard;
