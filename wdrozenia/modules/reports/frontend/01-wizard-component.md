# Reports Module – Wizard Component

## Status: 🔨 W PLANOWANIU

---

## 🎯 Cel

Implementacja 4-krokowego wizarda do tworzenia raportów:

1. **Source Select** – Wybór źródła (zatwierdzona ocena)
2. **Config Structure** – Konfiguracja struktury raportu
3. **Generate** – Generowanie treści przez AI
4. **Edit & Refine** – Edycja i dopracowanie

---

## 📁 Struktura plików

```
src/components/Reports/Builder/
├── ReportBuilderWizard.tsx       # Main wizard container
├── WizardStepIndicator.tsx       # Step progress indicator
├── WizardNavigation.tsx          # Prev/Next buttons
├── steps/
│   ├── SourceSelectStep.tsx      # Step 1
│   ├── ConfigStructureStep.tsx   # Step 2
│   ├── GenerateStep.tsx          # Step 3
│   └── EditRefineStep.tsx        # Step 4
├── sections/
│   ├── SectionCard.tsx           # Draggable section config
│   ├── SectionOptionsModal.tsx   # Section options popup
│   ├── SectionEditor.tsx         # WYSIWYG editor
│   └── SectionPreview.tsx        # Preview mode
├── hooks/
│   ├── useReportBuilder.ts       # Main state hook
│   ├── useSourceData.ts          # Source data fetching
│   └── useGeneration.ts          # Generation state
└── index.ts
```

---

## 🧩 Komponenty

### 1. ReportBuilderWizard

Główny kontener wizarda.

```tsx
/**
 * ReportBuilderWizard
 * 4-step wizard for creating reports from various sources
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { ArrowLeft, X } from 'lucide-react';

import { WizardStepIndicator } from './WizardStepIndicator';
import { WizardNavigation } from './WizardNavigation';
import { SourceSelectStep } from './steps/SourceSelectStep';
import { ConfigStructureStep } from './steps/ConfigStructureStep';
import { GenerateStep } from './steps/GenerateStep';
import { EditRefineStep } from './steps/EditRefineStep';
import { useReportBuilder } from './hooks/useReportBuilder';
import { Api } from '@/services/api';

type WizardStep = 'source' | 'config' | 'generate' | 'edit';

const STEPS: WizardStep[] = ['source', 'config', 'generate', 'edit'];

const STEP_LABELS: Record<WizardStep, string> = {
  source: 'Select Source',
  config: 'Configure Structure',
  generate: 'Generate Report',
  edit: 'Edit & Refine',
};

interface ReportBuilderWizardProps {
  reportId?: string; // For editing existing report
  sourceType?: string; // Pre-selected source type
  sourceId?: string; // Pre-selected source
  onClose?: () => void;
  onComplete?: (reportId: string) => void;
}

export const ReportBuilderWizard: React.FC<ReportBuilderWizardProps> = ({
  reportId: initialReportId,
  sourceType: preSelectedSourceType,
  sourceId: preSelectedSourceId,
  onClose,
  onComplete,
}) => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<WizardStep>('source');

  const {
    report,
    sourceData,
    sections,
    loading,
    generating,
    error,

    // Actions
    createReport,
    updateReport,
    updateSectionConfig,
    generateReport,
    regenerateSection,
    updateSectionContent,
    finalizeReport,
  } = useReportBuilder(initialReportId);

  // Pre-select source if provided
  useEffect(() => {
    if (preSelectedSourceType && preSelectedSourceId && !report) {
      // Auto-create report and move to config step
      handleSourceSelected(preSelectedSourceType, preSelectedSourceId);
    }
  }, [preSelectedSourceType, preSelectedSourceId]);

  // Navigate to appropriate step based on report status
  useEffect(() => {
    if (report) {
      if (report.status === 'DRAFT' && !sections.some((s) => s.generatedContent)) {
        setCurrentStep('config');
      } else if (report.status === 'GENERATED' || report.status === 'IN_REVIEW') {
        setCurrentStep('edit');
      } else {
        setCurrentStep('config');
      }
    }
  }, [report?.id]);

  const handleSourceSelected = async (sourceType: string, sourceId: string) => {
    try {
      await createReport(sourceType, sourceId);
      setCurrentStep('config');
    } catch (err) {
      toast.error('Failed to create report');
    }
  };

  const handleConfigComplete = () => {
    setCurrentStep('generate');
  };

  const handleGenerationComplete = () => {
    setCurrentStep('edit');
  };

  const handleFinalize = async () => {
    try {
      await finalizeReport();
      toast.success('Report finalized successfully');
      onComplete?.(report!.id);
    } catch (err) {
      toast.error('Failed to finalize report');
    }
  };

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      navigate('/reports');
    }
  };

  const canGoNext = (): boolean => {
    switch (currentStep) {
      case 'source':
        return !!report;
      case 'config':
        return sections.filter((s) => s.required).every((s) => s.enabled);
      case 'generate':
        return sections.filter((s) => s.enabled).every((s) => s.generatedContent);
      case 'edit':
        return true;
    }
  };

  const canGoPrev = (): boolean => {
    return currentStep !== 'source';
  };

  const goToStep = (step: WizardStep) => {
    const currentIndex = STEPS.indexOf(currentStep);
    const targetIndex = STEPS.indexOf(step);

    // Can only go back or to next step
    if (targetIndex <= currentIndex || (targetIndex === currentIndex + 1 && canGoNext())) {
      setCurrentStep(step);
    }
  };

  const goNext = () => {
    const currentIndex = STEPS.indexOf(currentStep);
    if (currentIndex < STEPS.length - 1 && canGoNext()) {
      setCurrentStep(STEPS[currentIndex + 1]);
    }
  };

  const goPrev = () => {
    const currentIndex = STEPS.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(STEPS[currentIndex - 1]);
    }
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-navy-900">
      {/* Header */}
      <div className="shrink-0 px-6 py-4 border-b border-slate-200 dark:border-navy-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handleClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-navy-900 dark:text-white">
                {report ? `Edit: ${report.title}` : 'Create Report'}
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Step {STEPS.indexOf(currentStep) + 1} of {STEPS.length}: {STEP_LABELS[currentStep]}
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="mt-4">
          <WizardStepIndicator
            steps={STEPS}
            currentStep={currentStep}
            completedSteps={STEPS.slice(0, STEPS.indexOf(currentStep))}
            onStepClick={goToStep}
            labels={STEP_LABELS}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {currentStep === 'source' && (
          <SourceSelectStep
            preSelectedType={preSelectedSourceType}
            onSourceSelected={handleSourceSelected}
          />
        )}

        {currentStep === 'config' && report && (
          <ConfigStructureStep
            report={report}
            sections={sections}
            sourceData={sourceData}
            onSectionConfigUpdate={updateSectionConfig}
            onComplete={handleConfigComplete}
          />
        )}

        {currentStep === 'generate' && report && (
          <GenerateStep
            report={report}
            sections={sections}
            generating={generating}
            onGenerate={generateReport}
            onRegenerateSection={regenerateSection}
            onComplete={handleGenerationComplete}
          />
        )}

        {currentStep === 'edit' && report && (
          <EditRefineStep
            report={report}
            sections={sections}
            sourceData={sourceData}
            onSectionContentUpdate={updateSectionContent}
            onFinalize={handleFinalize}
          />
        )}
      </div>

      {/* Navigation */}
      <div className="shrink-0 px-6 py-4 border-t border-slate-200 dark:border-navy-700">
        <WizardNavigation
          currentStep={currentStep}
          totalSteps={STEPS.length}
          canGoNext={canGoNext()}
          canGoPrev={canGoPrev()}
          onNext={goNext}
          onPrev={goPrev}
          isLastStep={currentStep === 'edit'}
          onFinish={handleFinalize}
          loading={loading || generating}
        />
      </div>
    </div>
  );
};

export default ReportBuilderWizard;
```

---

### 2. SourceSelectStep

```tsx
/**
 * SourceSelectStep
 * Step 1: Select source for report (approved assessment, interview, etc.)
 */

import React, { useEffect, useState } from 'react';
import { FileBarChart2, MessageSquare, Wrench, Lightbulb, Search, Loader2 } from 'lucide-react';
import { Api } from '@/services/api';

interface SourceType {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
}

const SOURCE_TYPES: SourceType[] = [
  {
    id: 'ASSESSMENT',
    name: 'Assessment',
    description: 'Create report from approved DRD, SIRI, or other assessment',
    icon: <FileBarChart2 size={24} />,
  },
  {
    id: 'INTERVIEW',
    name: 'Interview',
    description: 'Create report from completed interview sessions',
    icon: <MessageSquare size={24} />,
  },
  {
    id: 'TOOL',
    name: 'Tool Analysis',
    description: 'Create report from tool session results',
    icon: <Wrench size={24} />,
  },
  {
    id: 'INITIATIVE',
    name: 'Initiative',
    description: 'Create report from initiative progress',
    icon: <Lightbulb size={24} />,
  },
];

interface SourceItem {
  id: string;
  name: string;
  type: string;
  status: string;
  date: string;
  metadata?: Record<string, unknown>;
}

interface SourceSelectStepProps {
  preSelectedType?: string;
  onSourceSelected: (sourceType: string, sourceId: string) => void;
}

export const SourceSelectStep: React.FC<SourceSelectStepProps> = ({
  preSelectedType,
  onSourceSelected,
}) => {
  const [selectedType, setSelectedType] = useState<string | null>(preSelectedType || null);
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSource, setSelectedSource] = useState<string | null>(null);

  // Load sources when type selected
  useEffect(() => {
    if (selectedType) {
      loadSources(selectedType);
    }
  }, [selectedType]);

  const loadSources = async (type: string) => {
    setLoading(true);
    try {
      const response = await Api.get(`/api/report-builder/sources/${type.toLowerCase()}`);
      setSources(response.sources || []);
    } catch (err) {
      console.error('Failed to load sources:', err);
      setSources([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredSources = sources.filter((source) =>
    source.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSourceClick = (sourceId: string) => {
    setSelectedSource(sourceId);
  };

  const handleContinue = () => {
    if (selectedType && selectedSource) {
      onSourceSelected(selectedType, selectedSource);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Step 1: Select Source Type */}
        <div>
          <h2 className="text-lg font-semibold text-navy-900 dark:text-white mb-4">
            1. Select Source Type
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {SOURCE_TYPES.map((type) => (
              <button
                key={type.id}
                onClick={() => setSelectedType(type.id)}
                className={`p-4 rounded-xl border transition-all text-left ${
                  selectedType === type.id
                    ? 'bg-primary-500/10 border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700 hover:border-primary-500/50'
                }`}
              >
                <div
                  className={`mb-3 ${
                    selectedType === type.id ? 'text-primary-500' : 'text-slate-400'
                  }`}
                >
                  {type.icon}
                </div>
                <h3 className="font-semibold text-navy-900 dark:text-white">{type.name}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {type.description}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Step 2: Select Specific Source */}
        {selectedType && (
          <div>
            <h2 className="text-lg font-semibold text-navy-900 dark:text-white mb-4">
              2. Select {SOURCE_TYPES.find((t) => t.id === selectedType)?.name}
            </h2>

            {/* Search */}
            <div className="relative mb-4">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-navy-900 dark:text-white"
              />
            </div>

            {/* Sources List */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
              </div>
            ) : filteredSources.length === 0 ? (
              <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                No approved sources found. Complete and approve an assessment first.
              </div>
            ) : (
              <div className="space-y-2">
                {filteredSources.map((source) => (
                  <button
                    key={source.id}
                    onClick={() => handleSourceClick(source.id)}
                    className={`w-full p-4 rounded-lg border text-left transition-all ${
                      selectedSource === source.id
                        ? 'bg-primary-500/10 border-primary-500'
                        : 'bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700 hover:border-primary-500/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-navy-900 dark:text-white">{source.name}</h4>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {source.type} • {source.status} •{' '}
                          {new Date(source.date).toLocaleDateString()}
                        </p>
                      </div>
                      {selectedSource === source.id && (
                        <div className="w-6 h-6 rounded-full bg-primary-500 flex items-center justify-center">
                          <svg
                            className="w-4 h-4 text-white"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Continue Button */}
        {selectedSource && (
          <div className="flex justify-end">
            <button
              onClick={handleContinue}
              className="px-6 py-2 bg-primary-500 hover:bg-primary-400 text-white rounded-lg font-medium transition-colors"
            >
              Continue to Configuration →
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
```

---

### 3. ConfigStructureStep

```tsx
/**
 * ConfigStructureStep
 * Step 2: Configure report structure (sections, options)
 */

import React, { useState } from 'react';
import {
  GripVertical,
  ChevronDown,
  ChevronUp,
  Settings,
  Plus,
  Trash2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { SectionOptionsModal } from '../sections/SectionOptionsModal';

interface ConfigStructureStepProps {
  report: Report;
  sections: ReportSection[];
  sourceData: any;
  onSectionConfigUpdate: (updates: SectionConfigUpdate[]) => void;
  onComplete: () => void;
}

export const ConfigStructureStep: React.FC<ConfigStructureStepProps> = ({
  report,
  sections,
  sourceData,
  onSectionConfigUpdate,
  onComplete,
}) => {
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [showOptionsModal, setShowOptionsModal] = useState(false);

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const items = Array.from(sections);
    const [reordered] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reordered);

    const updates = items.map((section, index) => ({
      sectionKey: section.sectionKey,
      orderIndex: index,
    }));

    onSectionConfigUpdate(updates);
  };

  const toggleSection = (sectionKey: string) => {
    const section = sections.find((s) => s.sectionKey === sectionKey);
    if (section && !section.required) {
      onSectionConfigUpdate([
        {
          sectionKey,
          enabled: !section.enabled,
        },
      ]);
    }
  };

  const openSectionOptions = (sectionKey: string) => {
    setSelectedSection(sectionKey);
    setShowOptionsModal(true);
  };

  const handleOptionsUpdate = (options: SectionOptions) => {
    if (selectedSection) {
      onSectionConfigUpdate([
        {
          sectionKey: selectedSection,
          ...options,
        },
      ]);
    }
    setShowOptionsModal(false);
  };

  const sortedSections = [...sections].sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-navy-900 dark:text-white">
            Configure Report Structure
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Enable/disable sections, reorder them, and configure generation options.
          </p>
        </div>

        {/* Section List */}
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="sections">
            {(provided) => (
              <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3">
                {sortedSections.map((section, index) => (
                  <Draggable
                    key={section.sectionKey}
                    draggableId={section.sectionKey}
                    index={index}
                    isDragDisabled={section.required}
                  >
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`rounded-xl border transition-all ${
                          section.enabled
                            ? 'bg-white dark:bg-navy-800 border-slate-200 dark:border-navy-700'
                            : 'bg-slate-50 dark:bg-navy-900 border-slate-200/50 dark:border-navy-700/50 opacity-60'
                        } ${snapshot.isDragging ? 'shadow-lg ring-2 ring-primary-500' : ''}`}
                      >
                        <div className="p-4">
                          <div className="flex items-center gap-3">
                            {/* Drag Handle */}
                            <div
                              {...provided.dragHandleProps}
                              className={`p-1 rounded ${
                                section.required
                                  ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-grab'
                              }`}
                            >
                              <GripVertical size={18} />
                            </div>

                            {/* Toggle */}
                            <button
                              onClick={() => toggleSection(section.sectionKey)}
                              disabled={section.required}
                              className={`p-1 rounded transition-colors ${
                                section.required
                                  ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                                  : section.enabled
                                    ? 'text-green-500 hover:text-green-600'
                                    : 'text-slate-400 hover:text-slate-600'
                              }`}
                            >
                              {section.enabled ? <Eye size={18} /> : <EyeOff size={18} />}
                            </button>

                            {/* Section Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium text-navy-900 dark:text-white truncate">
                                  {section.title}
                                </h4>
                                {section.required && (
                                  <span className="px-2 py-0.5 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full">
                                    Required
                                  </span>
                                )}
                                {section.repeatFor && (
                                  <span className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full">
                                    Per {section.repeatFor}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                {section.sectionType} • {section.length} • {section.language}
                              </p>
                            </div>

                            {/* Options Button */}
                            <button
                              onClick={() => openSectionOptions(section.sectionKey)}
                              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                            >
                              <Settings size={18} />
                            </button>
                          </div>

                          {/* Options Preview */}
                          {section.enabled && (
                            <div className="mt-3 flex items-center gap-4 pl-12">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                  Length:
                                </span>
                                <span
                                  className={`px-2 py-0.5 text-xs rounded-full ${
                                    section.length === 'short'
                                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                      : section.length === 'medium'
                                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                        : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                                  }`}
                                >
                                  {section.length}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                  Language:
                                </span>
                                <span className="px-2 py-0.5 text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-full">
                                  {section.language}
                                </span>
                              </div>
                              {section.customPrompt && (
                                <span className="text-xs text-primary-500">+ Custom prompt</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        {/* Add Custom Section */}
        <button className="w-full mt-4 p-4 rounded-xl border-2 border-dashed border-slate-200 dark:border-navy-700 text-slate-500 dark:text-slate-400 hover:border-primary-500 hover:text-primary-500 transition-colors flex items-center justify-center gap-2">
          <Plus size={18} />
          Add Custom Section
        </button>

        {/* Continue Button */}
        <div className="mt-8 flex justify-end">
          <button
            onClick={onComplete}
            className="px-6 py-2 bg-primary-500 hover:bg-primary-400 text-white rounded-lg font-medium transition-colors"
          >
            Continue to Generate →
          </button>
        </div>
      </div>

      {/* Options Modal */}
      {showOptionsModal && selectedSection && (
        <SectionOptionsModal
          section={sections.find((s) => s.sectionKey === selectedSection)!}
          onSave={handleOptionsUpdate}
          onClose={() => setShowOptionsModal(false)}
        />
      )}
    </div>
  );
};
```

---

### 4. SectionOptionsModal

```tsx
/**
 * SectionOptionsModal
 * Configure section generation options
 */

import React, { useState } from 'react';
import { X, Wand2 } from 'lucide-react';

interface SectionOptionsModalProps {
  section: ReportSection;
  onSave: (options: SectionOptions) => void;
  onClose: () => void;
}

export const SectionOptionsModal: React.FC<SectionOptionsModalProps> = ({
  section,
  onSave,
  onClose,
}) => {
  const [length, setLength] = useState<'short' | 'medium' | 'long'>(section.length);
  const [language, setLanguage] = useState<'technical' | 'business' | 'general'>(section.language);
  const [customPrompt, setCustomPrompt] = useState(section.customPrompt || '');

  const handleSave = () => {
    onSave({
      length,
      language,
      customPrompt: customPrompt.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-navy-800 rounded-2xl shadow-xl w-full max-w-lg m-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-navy-700">
          <div>
            <h3 className="text-lg font-semibold text-navy-900 dark:text-white">Section Options</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">{section.title}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/10"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Length */}
          <div>
            <label className="block text-sm font-medium text-navy-900 dark:text-white mb-2">
              Content Length
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['short', 'medium', 'long'] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => setLength(opt)}
                  className={`py-2 px-4 rounded-lg border text-sm font-medium transition-all ${
                    length === opt
                      ? 'bg-primary-500 border-primary-500 text-white'
                      : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-300 hover:border-primary-500'
                  }`}
                >
                  {opt.charAt(0).toUpperCase() + opt.slice(1)}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              {length === 'short' && '~200-300 words, key points only'}
              {length === 'medium' && '~500-800 words, balanced detail'}
              {length === 'long' && '~1000-1500 words, comprehensive'}
            </p>
          </div>

          {/* Language Style */}
          <div>
            <label className="block text-sm font-medium text-navy-900 dark:text-white mb-2">
              Language Style
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['technical', 'business', 'general'] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => setLanguage(opt)}
                  className={`py-2 px-4 rounded-lg border text-sm font-medium transition-all ${
                    language === opt
                      ? 'bg-primary-500 border-primary-500 text-white'
                      : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-300 hover:border-primary-500'
                  }`}
                >
                  {opt.charAt(0).toUpperCase() + opt.slice(1)}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              {language === 'technical' &&
                'Detailed technical terminology, for IT/engineering audience'}
              {language === 'business' && 'Executive-friendly, strategic focus, clear ROI language'}
              {language === 'general' && 'Plain language, accessible to all stakeholders'}
            </p>
          </div>

          {/* Custom Prompt */}
          <div>
            <label className="block text-sm font-medium text-navy-900 dark:text-white mb-2">
              <Wand2 size={14} className="inline mr-1" />
              Custom AI Guidance (optional)
            </label>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="E.g., Focus on automation gaps, emphasize quick wins, highlight cybersecurity concerns..."
              rows={3}
              className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-navy-900 dark:text-white placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              Add specific guidance for AI generation. This will be appended to the default prompt.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-navy-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-primary-500 hover:bg-primary-400 text-white rounded-lg font-medium transition-colors"
          >
            Save Options
          </button>
        </div>
      </div>
    </div>
  );
};
```

---

## 🔄 Hooks

### useReportBuilder

```typescript
/**
 * useReportBuilder
 * Main state management hook for report builder
 */

import { useCallback, useEffect, useState } from 'react';
import { Api } from '@/services/api';

export function useReportBuilder(reportId?: string) {
  const [report, setReport] = useState<Report | null>(null);
  const [sections, setSections] = useState<ReportSection[]>([]);
  const [sourceData, setSourceData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load existing report
  useEffect(() => {
    if (reportId) {
      loadReport(reportId);
    }
  }, [reportId]);

  const loadReport = async (id: string) => {
    setLoading(true);
    try {
      const data = await Api.get(`/api/report-builder/${id}`);
      setReport(data.report);
      setSections(data.sections || []);
      setSourceData(data.sourceData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createReport = async (sourceType: string, sourceId: string) => {
    setLoading(true);
    try {
      // Get source data
      const sourceResponse = await Api.get(
        `/api/report-builder/sources/${sourceType.toLowerCase()}/${sourceId}`
      );

      // Get default template
      const templateResponse = await Api.get(
        `/api/report-builder/templates/${sourceType.toLowerCase()}`
      );

      // Create report
      const createResponse = await Api.post('/api/report-builder', {
        sourceType,
        sourceId,
        title: `${sourceResponse.name} Report`,
        templateId: templateResponse.template?.id,
      });

      setReport(createResponse.report);
      setSections(createResponse.sections || []);
      setSourceData(sourceResponse);

      return createResponse.report;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateSectionConfig = async (updates: SectionConfigUpdate[]) => {
    if (!report) return;

    try {
      await Api.put(`/api/report-builder/${report.id}/config`, { sections: updates });

      // Update local state
      setSections((prev) =>
        prev.map((section) => {
          const update = updates.find((u) => u.sectionKey === section.sectionKey);
          if (update) {
            return { ...section, ...update };
          }
          return section;
        })
      );
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const generateReport = async () => {
    if (!report) return;

    setGenerating(true);
    try {
      const response = await Api.post(`/api/report-builder/${report.id}/generate`);

      // Poll for completion
      await pollGeneration(report.id);

      // Reload report
      await loadReport(report.id);
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setGenerating(false);
    }
  };

  const regenerateSection = async (sectionKey: string) => {
    if (!report) return;

    try {
      await Api.post(`/api/report-builder/${report.id}/generate-section/${sectionKey}`);
      await loadReport(report.id);
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const updateSectionContent = async (sectionKey: string, content: string) => {
    if (!report) return;

    const section = sections.find((s) => s.sectionKey === sectionKey);
    if (!section) return;

    try {
      await Api.put(`/api/report-builder/${report.id}/sections/${section.id}/content`, {
        content,
      });

      setSections((prev) =>
        prev.map((s) =>
          s.sectionKey === sectionKey
            ? { ...s, editedContent: content, editedAt: new Date().toISOString() }
            : s
        )
      );
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const finalizeReport = async () => {
    if (!report) return;

    try {
      await Api.post(`/api/report-builder/${report.id}/finalize`);
      await loadReport(report.id);
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  return {
    report,
    sections,
    sourceData,
    loading,
    generating,
    error,

    createReport,
    updateReport: loadReport,
    updateSectionConfig,
    generateReport,
    regenerateSection,
    updateSectionContent,
    finalizeReport,
  };
}
```

---

## 📚 Referencje

- `00-OVERVIEW.md` - Przegląd modułu
- `01-ARCHITECTURE.md` - Architektura
- `02-section-editor.md` - Edytor sekcji
- `03-hub-component.md` - Hub raportów
