/**
 * Unified Import Wizard Component
 *
 * 5-step wizard for importing external assessment reports (DRD, SIRI, ADMA):
 * 1. Upload - Multi-format support (PDF, Excel, Word, JSON, CSV)
 * 2. Detection - AI-powered framework detection
 * 3. Review - Preview and edit extracted scores
 * 4. Target - Choose destination (Assessment or Report)
 * 5. Confirm - Final review and save
 */

import {
  AlertTriangle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Database,
  Edit2,
  File,
  FileSpreadsheet,
  FileText,
  FileType,
  Info,
  Loader2,
  Save,
  Sparkles,
  Target,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';

// ============================================
// TYPES
// ============================================

export type SupportedFramework = 'DRD' | 'SIRI' | 'ADMA';
export type SupportedFormat = 'pdf' | 'xlsx' | 'docx' | 'json' | 'csv';
export type TargetType = 'assessment' | 'report';
export type WizardStep = 'upload' | 'detect' | 'review' | 'target' | 'confirm';

interface ExtractedMetadata {
  sourceFileName: string;
  assessmentDate?: string;
  organizationName?: string;
  assessorName?: string;
}

interface ExtractedScore {
  id: string;
  name: string;
  score: number;
  target?: number;
  confidence: number;
  edited?: boolean;
}

interface ExtractionDetails {
  fieldsFound: string[];
  fieldsMissing: string[];
  warnings: string[];
  completeness: number;
}

interface ImportState {
  importId: string | null;
  file: File | null;
  format: SupportedFormat | null;
  framework: SupportedFramework | null;
  confidence: number;
  metadata: ExtractedMetadata | null;
  scores: ExtractedScore[];
  extractionDetails: ExtractionDetails | null;
  targetType: TargetType;
  isProcessing: boolean;
  error: string | null;
}

interface UnifiedImportWizardProps {
  onClose: () => void;
  onImportComplete: (result: {
    targetType: TargetType;
    targetId: string;
    framework: SupportedFramework;
  }) => void;
  projectId?: string;
}

// ============================================
// CONSTANTS
// ============================================

const SUPPORTED_FORMATS: {
  format: SupportedFormat;
  label: string;
  icon: React.ElementType;
  mimeTypes: string[];
  extensions: string[];
}[] = [
  {
    format: 'pdf',
    label: 'PDF',
    icon: FileText,
    mimeTypes: ['application/pdf'],
    extensions: ['.pdf'],
  },
  {
    format: 'xlsx',
    label: 'Excel',
    icon: FileSpreadsheet,
    mimeTypes: [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ],
    extensions: ['.xlsx', '.xls'],
  },
  {
    format: 'docx',
    label: 'Word',
    icon: FileType,
    mimeTypes: [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ],
    extensions: ['.docx', '.doc'],
  },
  {
    format: 'json',
    label: 'JSON',
    icon: Database,
    mimeTypes: ['application/json'],
    extensions: ['.json'],
  },
  {
    format: 'csv',
    label: 'CSV',
    icon: FileSpreadsheet,
    mimeTypes: ['text/csv'],
    extensions: ['.csv'],
  },
];

const FRAMEWORK_INFO: Record<
  SupportedFramework,
  { name: string; fullName: string; description: string; color: string }
> = {
  DRD: {
    name: 'DRD',
    fullName: 'Digital Readiness Diagnosis',
    description: '7 osi, 34 obszary, skala 1-7 lub 1-5',
    color: 'blue',
  },
  SIRI: {
    name: 'SIRI',
    fullName: 'Smart Industry Readiness Index',
    description: '3 bloki, 8 wymiarów, skala 0-5',
    color: 'green',
  },
  ADMA: {
    name: 'ADMA',
    fullName: 'Advanced Digital Maturity Assessment',
    description: '5 filarów, 12 wymiarów, skala 1-5',
    color: 'purple',
  },
};

// ============================================
// SUB-COMPONENTS
// ============================================

/**
 * Step Indicator
 */
const StepIndicator: React.FC<{
  currentStep: WizardStep;
  steps: { id: WizardStep; label: string; labelPL: string }[];
  isPolish: boolean;
}> = ({ currentStep, steps, isPolish }) => {
  const currentIndex = steps.findIndex((s) => s.id === currentStep);

  return (
    <div className="flex items-center justify-center gap-1 sm:gap-2 mb-6">
      {steps.map((step, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;

        return (
          <React.Fragment key={step.id}>
            <div className="flex items-center gap-1 sm:gap-2">
              <div
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm transition-all ${
                  isCompleted
                    ? 'bg-green-500 text-white'
                    : isCurrent
                      ? 'bg-blue-500 text-white'
                      : 'bg-slate-200 dark:bg-navy-700 text-slate-500 dark:text-slate-400'
                }`}
              >
                {isCompleted ? <CheckCircle size={14} /> : index + 1}
              </div>
              <span
                className={`text-xs sm:text-sm font-medium hidden md:block ${
                  isCurrent ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500'
                }`}
              >
                {isPolish ? step.labelPL : step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`w-4 sm:w-8 h-0.5 ${
                  isCompleted ? 'bg-green-500' : 'bg-slate-200 dark:bg-navy-700'
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

/**
 * Upload Step
 */
const UploadStep: React.FC<{
  file: File | null;
  onFileSelect: (file: File) => void;
  onFileRemove: () => void;
  isDragging: boolean;
  setIsDragging: (v: boolean) => void;
  isPolish: boolean;
}> = ({ file, onFileSelect, onFileRemove, isDragging, setIsDragging, isPolish }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const acceptedMimeTypes = SUPPORTED_FORMATS.flatMap((f) => f.mimeTypes);
  const acceptedExtensions = SUPPORTED_FORMATS.flatMap((f) => f.extensions);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile && acceptedMimeTypes.includes(droppedFile.type)) {
        onFileSelect(droppedFile);
      }
    },
    [onFileSelect, setIsDragging, acceptedMimeTypes]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) {
        onFileSelect(selectedFile);
      }
    },
    [onFileSelect]
  );

  const getFileIcon = (filename: string) => {
    const ext = filename.toLowerCase().split('.').pop();
    const format = SUPPORTED_FORMATS.find((f) => f.extensions.some((e) => e.includes(ext || '')));
    const Icon = format?.icon || File;
    return <Icon className="w-6 h-6 text-blue-500" />;
  };

  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h3 className="text-lg font-bold text-navy-900 dark:text-white">
          {isPolish ? 'Wgraj raport do importu' : 'Upload Report for Import'}
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {isPolish
            ? 'Obsługiwane formaty: PDF, Excel, Word, JSON, CSV'
            : 'Supported formats: PDF, Excel, Word, JSON, CSV'}
        </p>
      </div>

      {/* Supported Formats Grid */}
      <div className="grid grid-cols-5 gap-2 mb-4">
        {SUPPORTED_FORMATS.map(({ format, label, icon: Icon }) => (
          <div
            key={format}
            className="flex flex-col items-center p-2 bg-slate-50 dark:bg-navy-800 rounded-lg"
          >
            <Icon className="w-5 h-5 text-slate-500 dark:text-slate-400 mb-1" />
            <span className="text-xs text-slate-600 dark:text-slate-400">{label}</span>
          </div>
        ))}
      </div>

      {!file ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 sm:p-12 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-slate-300 dark:border-white/20 hover:border-blue-400'
          }`}
        >
          <Upload
            className={`w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-4 ${isDragging ? 'text-blue-500' : 'text-slate-600 dark:text-slate-500'}`}
          />
          <p className="text-slate-600 dark:text-slate-400">
            {isPolish ? (
              <>
                Przeciągnij plik tutaj lub{' '}
                <span className="text-blue-500 font-medium">kliknij aby wybrać</span>
              </>
            ) : (
              <>
                Drag file here or <span className="text-blue-500 font-medium">click to select</span>
              </>
            )}
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-500 mt-2">
            {isPolish ? 'Maksymalny rozmiar: 50MB' : 'Maximum size: 50MB'}
          </p>
          <input
            ref={inputRef}
            type="file"
            accept={acceptedExtensions.join(',')}
            onChange={handleFileInput}
            className="hidden"
          />
        </div>
      ) : (
        <div className="bg-slate-50 dark:bg-navy-800 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              {getFileIcon(file.name)}
            </div>
            <div>
              <p className="font-medium text-navy-900 dark:text-white">{file.name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onFileRemove();
            }}
            className="p-2 text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded-lg"
          >
            <Trash2 size={18} />
          </button>
        </div>
      )}

      {/* Supported Frameworks */}
      <div className="mt-6">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
          {isPolish ? 'Obsługiwane frameworki:' : 'Supported frameworks:'}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Object.entries(FRAMEWORK_INFO).map(([id, info]) => (
            <div
              key={id}
              className="p-3 bg-white dark:bg-navy-950/50 rounded-lg border border-slate-200 dark:border-navy-700"
            >
              <div className="font-bold text-navy-900 dark:text-white">{info.name}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{info.description}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * Detection Step
 */
const DetectionStep: React.FC<{
  framework: SupportedFramework | null;
  confidence: number;
  isProcessing: boolean;
  onFrameworkSelect: (fw: SupportedFramework) => void;
  isPolish: boolean;
}> = ({ framework, confidence, isProcessing, onFrameworkSelect, isPolish }) => {
  if (isProcessing) {
    return (
      <div className="text-center py-12">
        <div className="relative w-16 h-16 mx-auto mb-4">
          <Loader2 className="w-16 h-16 text-blue-500 animate-spin" />
          <Sparkles className="w-6 h-6 text-yellow-500 absolute top-0 right-0 animate-pulse" />
        </div>
        <p className="text-slate-600 dark:text-slate-400">
          {isPolish ? 'AI analizuje dokument...' : 'AI is analyzing document...'}
        </p>
        <p className="text-xs text-slate-600 dark:text-slate-500 mt-2">
          {isPolish
            ? 'Wykrywanie frameworka i ekstrakcja danych'
            : 'Detecting framework and extracting data'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h3 className="text-lg font-bold text-navy-900 dark:text-white">
          {isPolish ? 'Wykryty framework' : 'Detected Framework'}
        </h3>
      </div>

      {framework && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-500/30 rounded-xl p-4 mb-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-green-500" />
            <div>
              <p className="font-bold text-green-700 dark:text-green-400">
                {isPolish ? 'Wykryto' : 'Detected'}: {FRAMEWORK_INFO[framework].fullName}
              </p>
              <p className="text-sm text-green-600 dark:text-green-500">
                {isPolish ? 'Pewność' : 'Confidence'}: {confidence}%
              </p>
            </div>
          </div>
        </div>
      )}

      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        {isPolish ? 'Wybierz lub potwierdź framework:' : 'Select or confirm framework:'}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {(Object.keys(FRAMEWORK_INFO) as SupportedFramework[]).map((fw) => {
          const info = FRAMEWORK_INFO[fw];
          const isSelected = framework === fw;

          return (
            <button
              key={fw}
              onClick={() => onFrameworkSelect(fw)}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                isSelected
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-slate-200 dark:border-navy-700 hover:border-slate-300 dark:hover:border-navy-600'
              }`}
            >
              <div className="font-bold text-navy-900 dark:text-white">{info.name}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{info.fullName}</div>
              <div className="text-xs text-slate-600 dark:text-slate-500 mt-1">
                {info.description}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Review Step
 */
const ReviewStep: React.FC<{
  framework: SupportedFramework;
  scores: ExtractedScore[];
  extractionDetails: ExtractionDetails | null;
  onScoreEdit: (id: string, score: number) => void;
  isPolish: boolean;
}> = ({ framework, scores, extractionDetails, onScoreEdit, isPolish }) => {
  const info = FRAMEWORK_INFO[framework];

  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h3 className="text-lg font-bold text-navy-900 dark:text-white">
          {isPolish ? 'Przegląd wyekstrahowanych danych' : 'Review Extracted Data'}
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {isPolish
            ? 'Zweryfikuj i edytuj wyniki przed zapisaniem'
            : 'Verify and edit results before saving'}
        </p>
      </div>

      {/* Extraction Summary */}
      {extractionDetails && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="bg-slate-50 dark:bg-navy-800 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-navy-900 dark:text-white">{scores.length}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {isPolish ? 'Znalezionych' : 'Found'}
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-navy-800 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-navy-900 dark:text-white">
              {extractionDetails.fieldsMissing.length}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {isPolish ? 'Brakujących' : 'Missing'}
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-navy-800 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-navy-900 dark:text-white">
              {extractionDetails.completeness}%
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {isPolish ? 'Kompletność' : 'Completeness'}
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-navy-800 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-navy-900 dark:text-white">
              {scores.length > 0
                ? (scores.reduce((sum, s) => sum + s.score, 0) / scores.length).toFixed(1)
                : '0'}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {isPolish ? 'Średnia' : 'Average'}
            </div>
          </div>
        </div>
      )}

      {/* Warnings */}
      {extractionDetails?.warnings && extractionDetails.warnings.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-500/30 rounded-lg p-3 mb-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-700 dark:text-amber-400 text-sm">
                {isPolish ? 'Ostrzeżenia:' : 'Warnings:'}
              </p>
              <ul className="text-xs text-amber-600 dark:text-amber-500 mt-1 list-disc list-inside">
                {extractionDetails.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Scores Table */}
      {scores.length > 0 ? (
        <div className="bg-white dark:bg-navy-950/50 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
          <div className="max-h-64 overflow-y-auto">
            <table
              /* §27-exempt: layout specjalizowany/read-only/data-viz, nie kanoniczna lista przegladana */ className="w-full"
            >
              <thead className="sticky top-0 bg-slate-50 dark:bg-navy-800">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                    {isPolish ? 'Element' : 'Element'}
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                    {isPolish ? 'Ocena' : 'Score'}
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                    {isPolish ? 'Pewność' : 'Confidence'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                {scores.map((score) => (
                  <tr
                    key={score.id}
                    className={score.edited ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-navy-900 dark:text-white text-sm">
                        {score.name}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{score.id}</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="number"
                        min={0}
                        max={7}
                        step={0.1}
                        value={score.score}
                        onChange={(e) => onScoreEdit(score.id, Number(e.target.value))}
                        className="w-16 text-center px-2 py-1 border rounded bg-white dark:bg-navy-900 dark:border-navy-700 font-mono font-bold text-sm"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                          score.confidence >= 80
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                            : score.confidence >= 50
                              ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                              : 'bg-danger-100 dark:bg-danger-900/30 text-danger-700 dark:text-danger-400'
                        }`}
                      >
                        {score.confidence >= 80 ? (
                          <CheckCircle size={12} />
                        ) : (
                          <AlertTriangle size={12} />
                        )}
                        {score.confidence}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-slate-500 dark:text-slate-400">
          <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-amber-500" />
          <p>{isPolish ? 'Nie znaleziono danych do wyświetlenia' : 'No data found to display'}</p>
        </div>
      )}
    </div>
  );
};

/**
 * Target Selection Step
 */
const TargetStep: React.FC<{
  targetType: TargetType;
  onTargetSelect: (type: TargetType) => void;
  framework: SupportedFramework;
  isPolish: boolean;
}> = ({ targetType, onTargetSelect, framework, isPolish }) => {
  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h3 className="text-lg font-bold text-navy-900 dark:text-white">
          {isPolish ? 'Wybierz cel importu' : 'Select Import Target'}
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {isPolish
            ? 'Gdzie chcesz zapisać zaimportowane dane?'
            : 'Where do you want to save the imported data?'}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Assessment Option */}
        <button
          onClick={() => onTargetSelect('assessment')}
          className={`p-6 rounded-xl border-2 text-left transition-all ${
            targetType === 'assessment'
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-slate-200 dark:border-navy-700 hover:border-slate-300 dark:hover:border-navy-600'
          }`}
        >
          <div className="flex items-center gap-3 mb-3">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                targetType === 'assessment'
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-slate-400'
              }`}
            >
              <Edit2 size={24} />
            </div>
            <div>
              <div className="font-bold text-navy-900 dark:text-white">Assessment</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {isPolish ? 'Edytowalny' : 'Editable'}
              </div>
            </div>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {isPolish
              ? 'Utwórz nowy assessment, który możesz edytować, uzupełniać i rozwijać. Idealny gdy chcesz kontynuować pracę nad oceną.'
              : 'Create a new assessment that you can edit, complete and develop. Ideal when you want to continue working on the assessment.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs rounded">
              {isPolish ? 'Edycja' : 'Edit'}
            </span>
            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs rounded">
              {isPolish ? 'Workflow' : 'Workflow'}
            </span>
            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs rounded">
              {isPolish ? 'Inicjatywy' : 'Initiatives'}
            </span>
          </div>
        </button>

        {/* Report Option */}
        <button
          onClick={() => onTargetSelect('report')}
          className={`p-6 rounded-xl border-2 text-left transition-all ${
            targetType === 'report'
              ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
              : 'border-slate-200 dark:border-navy-700 hover:border-slate-300 dark:hover:border-navy-600'
          }`}
        >
          <div className="flex items-center gap-3 mb-3">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                targetType === 'report'
                  ? 'bg-green-500 text-white'
                  : 'bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-slate-400'
              }`}
            >
              <FileText size={24} />
            </div>
            <div>
              <div className="font-bold text-navy-900 dark:text-white">Report</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {isPolish ? 'Gotowy' : 'Ready'}
              </div>
            </div>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {isPolish
              ? 'Utwórz gotowy raport do przeglądania i udostępniania. Idealny gdy masz kompletne dane i chcesz je zaprezentować.'
              : 'Create a ready report for viewing and sharing. Ideal when you have complete data and want to present it.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs rounded">
              {isPolish ? 'Podgląd' : 'Preview'}
            </span>
            <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs rounded">
              {isPolish ? 'Eksport PDF' : 'PDF Export'}
            </span>
            <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs rounded">
              {isPolish ? 'Udostępnianie' : 'Sharing'}
            </span>
          </div>
        </button>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-500/30 rounded-lg p-3 flex items-start gap-2 mt-4">
        <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
        <p className="text-sm text-blue-700 dark:text-blue-300">
          {isPolish
            ? 'Niezależnie od wyboru, dane zostaną zapisane i będziesz mógł generować inicjatywy transformacyjne.'
            : 'Regardless of your choice, the data will be saved and you will be able to generate transformation initiatives.'}
        </p>
      </div>
    </div>
  );
};

/**
 * Confirm Step
 */
const ConfirmStep: React.FC<{
  framework: SupportedFramework;
  targetType: TargetType;
  fileName: string;
  scoreCount: number;
  averageScore: number;
  completeness: number;
  isPolish: boolean;
}> = ({ framework, targetType, fileName, scoreCount, averageScore, completeness, isPolish }) => {
  const info = FRAMEWORK_INFO[framework];

  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
        <h3 className="text-lg font-bold text-navy-900 dark:text-white">
          {isPolish ? 'Gotowe do zapisania' : 'Ready to Save'}
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {isPolish
            ? 'Sprawdź podsumowanie i potwierdź import'
            : 'Review summary and confirm import'}
        </p>
      </div>

      {/* Summary Card */}
      <div className="bg-slate-50 dark:bg-navy-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-slate-500 dark:text-slate-400">Framework:</span>
          <span className="font-bold text-navy-900 dark:text-white">{info.fullName}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500 dark:text-slate-400">
            {isPolish ? 'Plik źródłowy:' : 'Source file:'}
          </span>
          <span className="font-medium text-navy-900 dark:text-white truncate max-w-[200px]">
            {fileName}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500 dark:text-slate-400">
            {isPolish ? 'Cel importu:' : 'Import target:'}
          </span>
          <span
            className={`font-bold ${targetType === 'assessment' ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400'}`}
          >
            {targetType === 'assessment' ? 'Assessment' : 'Report'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500 dark:text-slate-400">
            {isPolish ? 'Liczba elementów:' : 'Elements count:'}
          </span>
          <span className="font-bold text-navy-900 dark:text-white">{scoreCount}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500 dark:text-slate-400">
            {isPolish ? 'Średnia ocena:' : 'Average score:'}
          </span>
          <span className="font-bold text-navy-900 dark:text-white">{averageScore.toFixed(1)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500 dark:text-slate-400">
            {isPolish ? 'Kompletność:' : 'Completeness:'}
          </span>
          <span
            className={`font-bold ${completeness >= 80 ? 'text-green-600 dark:text-green-400' : completeness >= 50 ? 'text-yellow-600 dark:text-yellow-400' : 'text-danger-600 dark:text-danger-400'}`}
          >
            {completeness}%
          </span>
        </div>
      </div>

      {/* What happens next */}
      <div className="bg-white dark:bg-navy-950/50 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
        <h4 className="font-medium text-navy-900 dark:text-white mb-2">
          {isPolish ? 'Co się stanie po zapisaniu:' : 'What happens after saving:'}
        </h4>
        <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-2">
          {targetType === 'assessment' ? (
            <>
              <li className="flex items-center gap-2">
                <CheckCircle size={14} className="text-green-500" />
                {isPolish
                  ? 'Nowy assessment zostanie utworzony w statusie DRAFT'
                  : 'New assessment will be created with DRAFT status'}
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle size={14} className="text-green-500" />
                {isPolish
                  ? 'Będziesz mógł edytować i uzupełniać dane'
                  : 'You will be able to edit and complete data'}
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle size={14} className="text-green-500" />
                {isPolish
                  ? 'Po zatwierdzeniu możesz generować inicjatywy'
                  : 'After approval you can generate initiatives'}
              </li>
            </>
          ) : (
            <>
              <li className="flex items-center gap-2">
                <CheckCircle size={14} className="text-green-500" />
                {isPolish
                  ? 'Nowy raport zostanie utworzony w statusie GENERATED'
                  : 'New report will be created with GENERATED status'}
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle size={14} className="text-green-500" />
                {isPolish
                  ? 'Raport będzie dostępny do przeglądania i eksportu'
                  : 'Report will be available for viewing and export'}
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle size={14} className="text-green-500" />
                {isPolish
                  ? 'Możesz udostępnić raport przez publiczny link'
                  : 'You can share report via public link'}
              </li>
            </>
          )}
        </ul>
      </div>
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export const UnifiedImportWizard: React.FC<UnifiedImportWizardProps> = ({
  onClose,
  onImportComplete,
  projectId,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  // State
  const [currentStep, setCurrentStep] = useState<WizardStep>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [state, setState] = useState<ImportState>({
    importId: null,
    file: null,
    format: null,
    framework: null,
    confidence: 0,
    metadata: null,
    scores: [],
    extractionDetails: null,
    targetType: 'assessment',
    isProcessing: false,
    error: null,
  });

  const steps: { id: WizardStep; label: string; labelPL: string }[] = [
    { id: 'upload', label: 'Upload', labelPL: 'Wgraj' },
    { id: 'detect', label: 'Detect', labelPL: 'Wykryj' },
    { id: 'review', label: 'Review', labelPL: 'Przegląd' },
    { id: 'target', label: 'Target', labelPL: 'Cel' },
    { id: 'confirm', label: 'Confirm', labelPL: 'Potwierdź' },
  ];

  // Handlers
  const handleFileSelect = useCallback((file: File) => {
    const ext = file.name.toLowerCase().split('.').pop();
    const format = SUPPORTED_FORMATS.find((f) =>
      f.extensions.some((e) => e.includes(ext || ''))
    )?.format;

    setState((prev) => ({
      ...prev,
      file,
      format: format || 'pdf',
      error: null,
    }));
  }, []);

  const handleFileRemove = useCallback(() => {
    setState((prev) => ({
      ...prev,
      file: null,
      format: null,
      importId: null,
      framework: null,
      confidence: 0,
      scores: [],
      extractionDetails: null,
    }));
  }, []);

  const handleFrameworkSelect = useCallback((framework: SupportedFramework) => {
    setState((prev) => ({ ...prev, framework }));
  }, []);

  const handleScoreEdit = useCallback((id: string, score: number) => {
    setState((prev) => ({
      ...prev,
      scores: prev.scores.map((s) => (s.id === id ? { ...s, score, edited: true } : s)),
    }));
  }, []);

  const handleTargetSelect = useCallback((targetType: TargetType) => {
    setState((prev) => ({ ...prev, targetType }));
  }, []);

  // API Calls
  const uploadAndDetect = useCallback(async () => {
    if (!state.file) return;

    setState((prev) => ({ ...prev, isProcessing: true, error: null }));

    try {
      // Upload file
      const formData = new FormData();
      formData.append('file', state.file);
      if (projectId) {
        formData.append('projectId', projectId);
      }

      const uploadResponse = await fetch('/api/report-import/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!uploadResponse.ok) {
        throw new Error(isPolish ? 'Błąd podczas wgrywania pliku' : 'Error uploading file');
      }

      const uploadResult = await uploadResponse.json();
      const importId = uploadResult.data.id;

      // Detect and extract
      const detectResponse = await fetch(`/api/report-import/detect/${importId}`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!detectResponse.ok) {
        throw new Error(isPolish ? 'Błąd podczas analizy dokumentu' : 'Error analyzing document');
      }

      const detectResult = await detectResponse.json();
      const extractedData = detectResult.data;

      // Convert scores to array format
      const scores: ExtractedScore[] = [];
      if (extractedData.framework === 'DRD') {
        // Add axis scores
        Object.entries(extractedData.scores.axes || {}).forEach(([id, data]: [string, any]) => {
          scores.push({
            id: `Axis ${id}`,
            name: `Oś ${id}`,
            score: data.actual,
            target: data.target,
            confidence: extractedData.confidence,
          });
        });
        // Add area scores
        Object.entries(extractedData.scores.areas || {}).forEach(([id, data]: [string, any]) => {
          scores.push({
            id,
            name: `Obszar ${id}`,
            score: data.actual,
            target: data.target,
            confidence: extractedData.confidence,
          });
        });
      } else if (extractedData.framework === 'SIRI') {
        Object.entries(extractedData.scores.dimensions || {}).forEach(
          ([id, data]: [string, any]) => {
            scores.push({
              id,
              name: id.replace(/_/g, ' '),
              score: data.current,
              target: data.target,
              confidence: extractedData.confidence,
            });
          }
        );
      } else if (extractedData.framework === 'ADMA') {
        Object.entries(extractedData.scores.dimensions || {}).forEach(
          ([id, data]: [string, any]) => {
            scores.push({
              id,
              name: id.replace(/_/g, ' '),
              score: data.current,
              target: data.target,
              confidence: extractedData.confidence,
            });
          }
        );
      }

      setState((prev) => ({
        ...prev,
        importId,
        framework: extractedData.framework,
        confidence: extractedData.confidence,
        metadata: extractedData.metadata,
        scores,
        extractionDetails: {
          fieldsFound: extractedData.extractionDetails?.fieldsFound || [],
          fieldsMissing: extractedData.extractionDetails?.fieldsMissing || [],
          warnings: extractedData.extractionDetails?.warnings || [],
          completeness:
            scores.length > 0
              ? Math.round(
                  (scores.length /
                    (scores.length +
                      (extractedData.extractionDetails?.fieldsMissing?.length || 0))) *
                    100
                )
              : 0,
        },
        isProcessing: false,
      }));
    } catch (error: any) {
      console.error('[UnifiedImportWizard] Error:', error);
      setState((prev) => ({
        ...prev,
        isProcessing: false,
        error: error.message,
      }));
    }
  }, [state.file, projectId, isPolish]);

  const confirmImport = useCallback(async () => {
    if (!state.importId || !state.framework) return;

    setState((prev) => ({ ...prev, isProcessing: true, error: null }));

    try {
      const response = await fetch(`/api/report-import/confirm/${state.importId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          targetType: state.targetType,
          projectId,
        }),
      });

      if (!response.ok) {
        throw new Error(isPolish ? 'Błąd podczas zapisywania' : 'Error saving');
      }

      const result = await response.json();

      onImportComplete({
        targetType: result.data.targetType,
        targetId: result.data.targetId,
        framework: state.framework,
      });
    } catch (error: any) {
      console.error('[UnifiedImportWizard] Confirm error:', error);
      setState((prev) => ({
        ...prev,
        isProcessing: false,
        error: error.message,
      }));
    }
  }, [state.importId, state.framework, state.targetType, projectId, isPolish, onImportComplete]);

  // Navigation
  const goToNext = useCallback(async () => {
    if (currentStep === 'upload' && state.file) {
      setCurrentStep('detect');
      uploadAndDetect();
    } else if (currentStep === 'detect' && state.framework) {
      setCurrentStep('review');
    } else if (currentStep === 'review' && state.scores.length > 0) {
      setCurrentStep('target');
    } else if (currentStep === 'target') {
      setCurrentStep('confirm');
    }
  }, [currentStep, state.file, state.framework, state.scores, uploadAndDetect]);

  const goToPrev = useCallback(() => {
    const stepIndex = steps.findIndex((s) => s.id === currentStep);
    if (stepIndex > 0) {
      setCurrentStep(steps[stepIndex - 1].id);
    }
  }, [currentStep, steps]);

  const canGoNext = useCallback(() => {
    switch (currentStep) {
      case 'upload':
        return !!state.file;
      case 'detect':
        return !!state.framework && !state.isProcessing;
      case 'review':
        return state.scores.length > 0;
      case 'target':
        return true;
      case 'confirm':
        return true;
      default:
        return false;
    }
  }, [currentStep, state]);

  const averageScore =
    state.scores.length > 0
      ? state.scores.reduce((sum, s) => sum + s.score, 0) / state.scores.length
      : 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-navy-900 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-navy-700">
          <h2 className="text-xl font-bold text-navy-900 dark:text-white flex items-center gap-2">
            <Upload className="text-blue-500" />
            {isPolish ? 'Import Raportu' : 'Import Report'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="px-4 sm:px-6 pt-4">
          <StepIndicator currentStep={currentStep} steps={steps} isPolish={isPolish} />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {state.error && (
            <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-500/30 rounded-lg p-3 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-danger-500 shrink-0" />
              <span className="text-danger-700 dark:text-danger-400 text-sm">{state.error}</span>
            </div>
          )}

          {currentStep === 'upload' && (
            <UploadStep
              file={state.file}
              onFileSelect={handleFileSelect}
              onFileRemove={handleFileRemove}
              isDragging={isDragging}
              setIsDragging={setIsDragging}
              isPolish={isPolish}
            />
          )}

          {currentStep === 'detect' && (
            <DetectionStep
              framework={state.framework}
              confidence={state.confidence}
              isProcessing={state.isProcessing}
              onFrameworkSelect={handleFrameworkSelect}
              isPolish={isPolish}
            />
          )}

          {currentStep === 'review' && state.framework && (
            <ReviewStep
              framework={state.framework}
              scores={state.scores}
              extractionDetails={state.extractionDetails}
              onScoreEdit={handleScoreEdit}
              isPolish={isPolish}
            />
          )}

          {currentStep === 'target' && state.framework && (
            <TargetStep
              targetType={state.targetType}
              onTargetSelect={handleTargetSelect}
              framework={state.framework}
              isPolish={isPolish}
            />
          )}

          {currentStep === 'confirm' && state.framework && state.file && (
            <ConfirmStep
              framework={state.framework}
              targetType={state.targetType}
              fileName={state.file.name}
              scoreCount={state.scores.length}
              averageScore={averageScore}
              completeness={state.extractionDetails?.completeness || 0}
              isPolish={isPolish}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-slate-200 dark:border-navy-700">
          <button
            onClick={goToPrev}
            disabled={currentStep === 'upload' || state.isProcessing}
            className="flex items-center gap-2 px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={18} />
            {isPolish ? 'Wstecz' : 'Back'}
          </button>

          {currentStep === 'confirm' ? (
            <button
              onClick={confirmImport}
              disabled={state.isProcessing}
              className="flex items-center gap-2 px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {state.isProcessing ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Save size={18} />
              )}
              {isPolish ? 'Zapisz' : 'Save'}
            </button>
          ) : (
            <button
              onClick={goToNext}
              disabled={!canGoNext() || state.isProcessing}
              className="flex items-center gap-2 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {state.isProcessing ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  {isPolish ? 'Dalej' : 'Next'}
                  <ChevronRight size={18} />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default UnifiedImportWizard;
