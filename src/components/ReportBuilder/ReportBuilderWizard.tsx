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
import { OutlineProposalStep, type ProposedSection } from './steps/OutlineProposalStep';
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

const BASE_STEPS: WizardStep[] = [
  {
    id: 0,
    title: 'Report Definition',
    titlePl: 'Definicja raportu',
    description: 'Set report type, intent, and definition layer',
    descriptionPl: 'Ustal typ raportu, intencję i warstwę definicji',
    icon: ClipboardCheck,
  },
  {
    id: 1,
    title: 'AI Outline',
    titlePl: 'Propozycja AI',
    description: 'AI proposes report outline for your approval',
    descriptionPl: 'AI proponuje strukturę raportu do akceptacji',
    icon: Sparkles,
  },
  {
    id: 2,
    title: 'Configure',
    titlePl: 'Konfiguracja',
    description: 'Edit blocks, order, and section options',
    descriptionPl: 'Edytuj bloki, kolejność i ustawienia sekcji',
    icon: Settings2,
  },
  {
    id: 3,
    title: 'Generate & Edit',
    titlePl: 'Generuj i Edytuj',
    description: 'Generate content, review, and submit',
    descriptionPl: 'Wygeneruj treść, przejrzyj i wyślij',
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
    reportTypeV3: 'custom',
    goalV3: 'inform',
    communicationRegister: 'professional',
    density: 'standard',
    form: 'strategic',
    dataLevel: 'balanced',
    confidentiality: 'internal',
  });

  const isCanonicalReport = intent.reportTypeV3 && intent.reportTypeV3 !== 'custom';
  const STEPS = isCanonicalReport ? BASE_STEPS.filter((s) => s.id !== 1) : BASE_STEPS;

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
      reportTypeV3: intent.reportTypeV3 || 'custom',
      goalV3: intent.goalV3,
      communicationRegister: intent.communicationRegister,
      density: intent.density,
      form: intent.form,
      dataLevel: intent.dataLevel,
      confidentiality: intent.confidentiality,
      periodFrom: intent.periodFrom,
      periodTo: intent.periodTo,
    };

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

  const handleOutlineAccepted = useCallback(
    async (proposedSections: ProposedSection[]) => {
      if (!report?.id) return;
      for (const sec of proposedSections) {
        await addCustomSection(report.id, sec.title, sec.type, {
          length: sec.defaultLength,
        });
      }
      nextStep();
    },
    [report?.id, addCustomSection, nextStep]
  );

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

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        // Trigger next step
        const canGo = (() => {
          switch (activeStepId) {
            case 0:
              return sourceType && selectedSource && reportTitle.trim();
            case 1:
              return true;
            case 2:
              return sections.filter((s) => s.enabled).length > 0;
            case 3:
              return sections.filter((s) => s.enabled).length > 0;
            default:
              return false;
          }
        })();
        if (canGo && !isLoading && !isGenerating) {
          switch (activeStepId) {
            case 0:
              handleIntentComplete();
              break;
            case 1:
              nextStep();
              break;
            case 2:
              handleConfigComplete();
              break;
            case 3:
              if (report?.status === 'GENERATED') handleFinalize();
              else handleGenerate();
              break;
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    currentStep,
    sourceType,
    selectedSource,
    reportTitle,
    sections,
    isLoading,
    isGenerating,
    report?.status,
    handleIntentComplete,
    handleConfigComplete,
    handleGenerate,
    handleFinalize,
  ]);

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-8 px-4">
      {STEPS.map((step, index) => {
        const Icon = step.icon;
        const isActive = currentStep === step.id;
        const isCompleted = currentStep > step.id;
        const isClickable = isCompleted || step.id === currentStep;

        return (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center">
              {/* Step Circle */}
              <button
                onClick={() => isClickable && setStep(step.id)}
                disabled={!isClickable}
                className={`
                  relative flex items-center justify-center w-12 h-12 rounded-full
                  transition-all duration-300
                  ${
                    isActive
                      ? 'bg-c-accent text-c-text ring-4 ring-c-focus shadow-lg'
                      : isCompleted
                        ? 'bg-green-500 text-c-text cursor-pointer hover:bg-green-600 shadow-sm'
                        : 'bg-c-border-subtle text-c-text-secondary cursor-not-allowed'
                  }
                `}
              >
                {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
              </button>

              {/* Step Label (below) */}
              <div className="mt-2 text-center">
                <div
                  className={`text-xs font-semibold ${
                    isActive
                      ? 'text-c-accent'
                      : isCompleted
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-c-text-secondary'
                  }`}
                >
                  {isPl ? step.titlePl : step.title}
                </div>
                <div className="hidden md:block text-[10px] text-c-text-secondary mt-0.5 max-w-[120px]">
                  {isPl ? step.descriptionPl : step.description}
                </div>
              </div>
            </div>

            {/* Connector Line */}
            {index < STEPS.length - 1 && (
              <div className="flex-1 flex items-start pt-6 px-2 max-w-[120px]">
                <div
                  className={`
                    w-full h-0.5 rounded-full transition-all duration-300
                    ${
                      currentStep > index
                        ? 'bg-gradient-to-r from-green-400 to-green-500'
                        : currentStep === index
                          ? 'bg-gradient-to-r bg-c-accent '
                          : 'bg-c-border-subtle'
                    }
                  `}
                />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );

  const activeStepId = STEPS[currentStep]?.id ?? 0;

  const renderStepContent = () => {
    switch (activeStepId) {
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
        return report?.id ? (
          <OutlineProposalStep
            reportId={report.id}
            intent={intent}
            onAcceptOutline={handleOutlineAccepted}
            isLoading={isLoading}
          />
        ) : null;

      case 2:
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

      case 3:
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
      switch (activeStepId) {
        case 0:
          return sourceType && selectedSource && reportTitle.trim();
        case 1:
          return true;
        case 2:
          return sections.filter((s) => s.enabled).length > 0;
        case 3:
          return sections.filter((s) => s.enabled).length > 0;
        default:
          return false;
      }
    })();

    const nextLabel = (() => {
      switch (activeStepId) {
        case 0:
          return isPl ? 'Zapisz definicję' : 'Save definition';
        case 1:
          return isPl ? 'Zaakceptuj strukturę' : 'Accept outline';
        case 2:
          return isPl ? 'Przejdź do generowania' : 'Proceed to generation';
        case 3:
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
      switch (activeStepId) {
        case 0:
          handleIntentComplete();
          break;
        case 1:
          nextStep();
          break;
        case 2:
          handleConfigComplete();
          break;
        case 3:
          if (report?.status === 'GENERATED') handleFinalize();
          else handleGenerate();
          break;
      }
    };

    return (
      <div className="flex items-center justify-between pt-6 border-t border-c-border-subtle">
        <div>
          {canGoBack && (
            <button
              onClick={prevStep}
              className="flex items-center gap-2 px-4 py-2.5 text-c-text-secondary hover:opacity-90 rounded-lg transition-colors border border-transparent hover:border-c-border-subtle"
            >
              <ArrowLeft className="w-4 h-4" />
              {isPl ? 'Wstecz' : 'Back'}
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleCancel}
            className="px-4 py-2.5 text-c-text-secondary hover:opacity-90 rounded-lg transition-colors text-sm"
          >
            {isPl ? 'Anuluj' : 'Cancel'}
          </button>

          <button
            onClick={handleNext}
            disabled={!canGoNext || isLoading || isGenerating}
            className={`
              flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold transition-all text-sm
              ${
                canGoNext && !isLoading && !isGenerating
                  ? activeStepId === 3
                    ? 'bg-c-accent text-c-text shadow-md hover:shadow-lg'
                    : 'bg-c-text text-c-bg hover:opacity-90 shadow-sm'
                  : 'bg-c-border-subtle text-c-text-secondary cursor-not-allowed'
              }
            `}
          >
            {isLoading || isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : activeStepId === 3 ? (
              <Sparkles className="w-4 h-4" />
            ) : (
              <ArrowRight className="w-4 h-4" />
            )}
            {nextLabel}
          </button>

          {/* Keyboard shortcut hint */}
          {canGoNext && !isLoading && !isGenerating && (
            <span className="hidden md:inline text-[10px] text-c-text-secondary">
              Ctrl+Enter
            </span>
          )}
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
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-c-text flex items-center gap-3">
            <div className="p-2 rounded-xl bg-c-accent-soft0">
              <Sparkles className="w-6 h-6 text-c-accent" />
            </div>
            {isPl ? 'Kreator Raportów' : 'Report Builder'}
          </h1>
          <p className="mt-1 text-c-text-secondary ml-[52px]">
            {report
              ? report.title
              : isPl
                ? 'Utwórz profesjonalny raport na podstawie danych z oceny'
                : 'Create a professional report based on assessment data'}
          </p>
        </div>
        {report?.id && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-c-text-secondary">ID: {report.id.slice(0, 12)}...</span>
            <span
              className={`px-2 py-1 text-xs font-medium rounded-full ${
                report.status === 'GENERATED'
                  ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                  : report.status === 'IN_REVIEW'
                    ? 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
                    : report.status === 'APPROVED'
                      ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                      : 'bg-c-surface-raised text-c-text-secondary'
              }`}
            >
              {report.status}
            </span>
          </div>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 p-4 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-xl flex items-start gap-3">
          <XCircle className="w-5 h-5 text-danger-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="font-medium text-danger-800 dark:text-danger-200">
              {isPl ? 'Wystąpił błąd' : 'An error occurred'}
            </div>
            <div className="text-sm text-danger-600 dark:text-danger-300 mt-1">{error}</div>
          </div>
          <button onClick={clearError} className="text-danger-500 hover:text-danger-700">
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Step Indicator */}
      <div className="relative mb-8">{renderStepIndicator()}</div>

      {/* Step Content */}
      <div className="bg-c-surface rounded-2xl shadow-lg border border-c-border-subtle p-6 md:p-8">
        {/* Step Title */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-c-text">
              <span className="text-c-accent mr-2">{currentStep + 1}.</span>
              {isPl ? STEPS[currentStep].titlePl : STEPS[currentStep].title}
            </h2>
            <p className="text-sm text-c-text-secondary mt-0.5">
              {isPl ? STEPS[currentStep].descriptionPl : STEPS[currentStep].description}
            </p>
          </div>
          <div className="text-xs text-c-text-secondary">
            {isPl ? 'Krok' : 'Step'} {currentStep + 1}/{STEPS.length}
          </div>
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
