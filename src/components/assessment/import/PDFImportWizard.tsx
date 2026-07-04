/**
 * PDF Import Wizard Component
 *
 * 4-step wizard for importing external assessment reports:
 * 1. Upload PDF
 * 2. Framework Detection
 * 3. Score Extraction (AI-powered)
 * 4. Mapping & Save
 */

import {
  AlertTriangle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Edit2,
  File,
  FileText,
  Info,
  Loader2,
  Sparkles,
  Target,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { FRAMEWORK_CONFIGS, getFrameworkConfig } from '../../../services/frameworkRegistry';
import {
  ADMAAssessmentData,
  AssessmentFrameworkId,
  CMMIAssessmentData,
  PDFImportResult,
  SIRIAssessmentData,
} from '../../../types';

// ============================================
// TYPES
// ============================================

interface PDFImportWizardProps {
  onClose: () => void;
  onImportComplete: (
    framework: AssessmentFrameworkId,
    data: SIRIAssessmentData | ADMAAssessmentData | CMMIAssessmentData,
    fileName: string
  ) => void;
  allowedFrameworks?: AssessmentFrameworkId[];
}

type WizardStep = 'upload' | 'detect' | 'extract' | 'confirm';

interface ExtractedScore {
  dimensionId: string;
  dimensionName: string;
  score: number;
  confidence: number;
  edited?: boolean;
}

// ============================================
// SUB-COMPONENTS
// ============================================

/**
 * Step Indicator
 */
const StepIndicator: React.FC<{
  currentStep: WizardStep;
  steps: { id: WizardStep; label: string }[];
}> = ({ currentStep, steps }) => {
  const currentIndex = steps.findIndex((s) => s.id === currentStep);

  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {steps.map((step, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;

        return (
          <React.Fragment key={step.id}>
            <div className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                  isCompleted
                    ? 'bg-green-500 text-white'
                    : isCurrent
                      ? 'bg-blue-500 text-white'
                      : 'bg-slate-200 dark:bg-navy-700 text-slate-500 dark:text-slate-400'
                }`}
              >
                {isCompleted ? <CheckCircle size={16} /> : index + 1}
              </div>
              <span
                className={`text-sm font-medium hidden sm:block ${
                  isCurrent ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500'
                }`}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`w-8 h-0.5 ${
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

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile?.type === 'application/pdf') {
        onFileSelect(droppedFile);
      }
    },
    [onFileSelect, setIsDragging]
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

  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h3 className="text-lg font-bold text-navy-900 dark:text-white">
          {isPolish ? 'Wgraj raport PDF' : 'Upload PDF Report'}
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {isPolish
            ? 'Obsługiwane formaty: SIRI, ADMA, CMMI'
            : 'Supported formats: SIRI, ADMA, CMMI'}
        </p>
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
          className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-slate-300 dark:border-c-border hover:border-blue-400'
          }`}
        >
          <Upload
            className={`w-12 h-12 mx-auto mb-4 ${isDragging ? 'text-blue-500' : 'text-slate-500 dark:text-slate-400 dark:text-slate-500'}`}
          />
          <p className="text-slate-600 dark:text-slate-400">
            {isPolish ? (
              <>
                Przeciągnij plik PDF tutaj lub{' '}
                <span className="text-blue-500 font-medium">kliknij aby wybrać</span>
              </>
            ) : (
              <>
                Drag PDF file here or{' '}
                <span className="text-blue-500 font-medium">click to select</span>
              </>
            )}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-2">
            Maksymalny rozmiar: 10MB
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileInput}
            className="hidden"
          />
        </div>
      ) : (
        <div className="bg-slate-50 dark:bg-navy-800 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-danger-100 dark:bg-danger-900/30 rounded-lg flex items-center justify-center">
              <FileText className="w-6 h-6 text-danger-500" />
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
    </div>
  );
};

/**
 * Detection Step
 */
const DetectionStep: React.FC<{
  detectedFramework: AssessmentFrameworkId | null;
  confidence: number;
  isAnalyzing: boolean;
  onFrameworkSelect: (fw: AssessmentFrameworkId) => void;
  allowedFrameworks: AssessmentFrameworkId[];
  isPolish: boolean;
}> = ({
  detectedFramework,
  confidence,
  isAnalyzing,
  onFrameworkSelect,
  allowedFrameworks,
  isPolish,
}) => {
  if (isAnalyzing) {
    return (
      <div className="text-center py-12">
        <Loader2 className="w-12 h-12 mx-auto mb-4 text-blue-500 animate-spin" />
        <p className="text-slate-600 dark:text-slate-400">
          {isPolish ? 'Analizuję dokument...' : 'Analyzing document...'}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-2">
          {isPolish ? 'AI identyfikuje typ raportu' : 'AI is identifying report type'}
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

      {detectedFramework && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-500/30 rounded-xl p-4 mb-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-green-500" />
            <div>
              <p className="font-bold text-green-700 dark:text-green-400">
                {isPolish ? 'Wykryto' : 'Detected'}: {FRAMEWORK_CONFIGS[detectedFramework].fullName}
              </p>
              <p className="text-sm text-green-600 dark:text-green-500">
                {isPolish ? 'Pewność' : 'Confidence'}: {(confidence * 100).toFixed(0)}%
              </p>
            </div>
          </div>
        </div>
      )}

      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        {isPolish ? 'Wybierz lub potwierdź framework:' : 'Select or confirm framework:'}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {allowedFrameworks
          .filter((fw) => ['SIRI', 'ADMA', 'CMMI'].includes(fw))
          .map((fw) => {
            const config = FRAMEWORK_CONFIGS[fw];
            const isSelected = detectedFramework === fw;

            return (
              <button
                key={fw}
                onClick={() => onFrameworkSelect(fw)}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  isSelected
                    ? `border-${config.color}-500 bg-${config.color}-50 dark:bg-${config.color}-900/20`
                    : 'border-slate-200 dark:border-navy-700 hover:border-slate-300'
                }`}
              >
                <div className="font-bold text-navy-900 dark:text-white">{config.name}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{config.fullName}</div>
              </button>
            );
          })}
      </div>
    </div>
  );
};

/**
 * Extraction Step
 */
const ExtractionStep: React.FC<{
  framework: AssessmentFrameworkId;
  extractedScores: ExtractedScore[];
  isExtracting: boolean;
  onScoreEdit: (dimensionId: string, newScore: number) => void;
  isPolish: boolean;
}> = ({ framework, extractedScores, isExtracting, onScoreEdit, isPolish }) => {
  const config = FRAMEWORK_CONFIGS[framework];

  if (isExtracting) {
    return (
      <div className="text-center py-12">
        <div className="relative w-16 h-16 mx-auto mb-4">
          <Loader2 className="w-16 h-16 text-blue-500 animate-spin" />
          <Sparkles className="w-6 h-6 text-yellow-500 absolute top-0 right-0 animate-pulse" />
        </div>
        <p className="text-slate-600 dark:text-slate-400">
          {isPolish ? 'AI analizuje raport...' : 'AI is analyzing report...'}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-2">
          {isPolish ? 'Ekstraktuję oceny z dokumentu' : 'Extracting scores from document'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h3 className="text-lg font-bold text-navy-900 dark:text-white">Wyekstrahowane oceny</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Zweryfikuj i edytuj wyniki przed zapisaniem
        </p>
      </div>

      {/* AI Notice */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-500/30 rounded-lg p-3 flex items-start gap-2">
        <Sparkles className="w-5 h-5 text-blue-500 shrink-0" />
        <p className="text-sm text-blue-700 dark:text-blue-300">
          {isPolish
            ? 'Oceny zostały automatycznie wyekstrahowane przez AI. Wartości z niskim poziomem pewności są oznaczone.'
            : 'Scores were automatically extracted by AI. Values with low confidence are marked.'}
        </p>
      </div>

      {/* Scores Table */}
      <div className="bg-white dark:bg-navy-950/50 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
        <table /* §27-exempt: layout specjalizowany/read-only/data-viz, nie kanoniczna lista przegladana */  className="w-full">
          <thead>
            <tr className="bg-slate-50 dark:bg-navy-800">
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                {isPolish ? 'Wymiar' : 'Dimension'}
              </th>
              <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                {isPolish ? 'Ocena' : 'Score'}
              </th>
              <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                {isPolish ? 'Pewność' : 'Confidence'}
              </th>
              <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                {isPolish ? 'Akcja' : 'Action'}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-white/5">
            {extractedScores.map((score) => (
              <tr
                key={score.dimensionId}
                className={score.edited ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''}
              >
                <td className="px-4 py-3">
                  <div className="font-medium text-navy-900 dark:text-white text-sm">
                    {score.dimensionName}
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <input
                    type="number"
                    min={config.scaleMin}
                    max={config.scaleMax}
                    value={score.score}
                    onChange={(e) => onScoreEdit(score.dimensionId, Number(e.target.value))}
                    className="w-16 text-center px-2 py-1 border rounded bg-white dark:bg-navy-900 font-mono font-bold"
                  />
                </td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                      score.confidence >= 0.8
                        ? 'bg-green-100 text-green-700'
                        : score.confidence >= 0.5
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-danger-100 text-danger-700'
                    }`}
                  >
                    {score.confidence >= 0.8 ? (
                      <CheckCircle size={12} />
                    ) : (
                      <AlertTriangle size={12} />
                    )}
                    {(score.confidence * 100).toFixed(0)}%
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  {score.edited && <span className="text-xs text-yellow-600">Edytowane</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-50 dark:bg-navy-800 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-navy-900 dark:text-white">
            {extractedScores.length}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {isPolish ? 'Wymiarów' : 'Dimensions'}
          </div>
        </div>
        <div className="bg-slate-50 dark:bg-navy-800 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-navy-900 dark:text-white">
            {(
              extractedScores.reduce((sum, s) => sum + s.score, 0) / extractedScores.length
            ).toFixed(1)}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {isPolish ? 'Średnia' : 'Average'}
          </div>
        </div>
        <div className="bg-slate-50 dark:bg-navy-800 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-navy-900 dark:text-white">
            {(
              (extractedScores.reduce((sum, s) => sum + s.confidence, 0) / extractedScores.length) *
              100
            ).toFixed(0)}
            %
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {isPolish ? 'Śr. Pewność' : 'Avg. Confidence'}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Confirm Step
 */
const ConfirmStep: React.FC<{
  framework: AssessmentFrameworkId;
  fileName: string;
  scoreCount: number;
  averageScore: number;
  mapToDRD: boolean;
  onMapToDRDChange: (v: boolean) => void;
  isPolish: boolean;
}> = ({ framework, fileName, scoreCount, averageScore, mapToDRD, onMapToDRDChange, isPolish }) => {
  const config = FRAMEWORK_CONFIGS[framework];

  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
        <h3 className="text-lg font-bold text-navy-900 dark:text-white">
          {isPolish ? 'Gotowe do zapisania' : 'Ready to save'}
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
          <span className="font-bold text-navy-900 dark:text-white">{config.fullName}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500 dark:text-slate-400">
            {isPolish ? 'Plik źródłowy:' : 'Source file:'}
          </span>
          <span className="font-medium text-navy-900 dark:text-white">{fileName}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500 dark:text-slate-400">
            {isPolish ? 'Wymiarów:' : 'Dimensions:'}
          </span>
          <span className="font-bold text-navy-900 dark:text-white">{scoreCount}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500 dark:text-slate-400">
            {isPolish ? 'Średnia ocena:' : 'Average score:'}
          </span>
          <span className={`font-bold text-${config.color}-600 dark:text-${config.color}-400`}>
            {averageScore.toFixed(1)} / {config.scaleMax}
          </span>
        </div>
      </div>

      {/* Map to DRD Option */}
      <div className="bg-white dark:bg-navy-950/50 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={mapToDRD}
            onChange={(e) => onMapToDRDChange(e.target.checked)}
            className="mt-1 w-5 h-5 rounded border-slate-300 dark:border-navy-700"
          />
          <div>
            <div className="font-medium text-navy-900 dark:text-white">
              {isPolish ? 'Mapuj do osi DRD' : 'Map to DRD axes'}
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {isPolish
                ? 'Automatycznie przelicz oceny na skalę DRD (1-7) w celu generowania inicjatyw transformacyjnych.'
                : 'Automatically convert scores to DRD scale (1-7) for generating transformation initiatives.'}
            </p>
          </div>
        </label>
      </div>

      {/* Legal Notice */}
      {config.legalNotice && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-500/30 rounded-lg p-3 flex items-start gap-2">
          <Info className="w-5 h-5 text-amber-500 shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-300">{config.legalNotice}</p>
        </div>
      )}
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export const PDFImportWizard: React.FC<PDFImportWizardProps> = ({
  onClose,
  onImportComplete,
  allowedFrameworks = ['SIRI', 'ADMA', 'CMMI', 'DRD', 'LEAN'],
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  // State
  const [currentStep, setCurrentStep] = useState<WizardStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [detectedFramework, setDetectedFramework] = useState<AssessmentFrameworkId | null>(null);
  const [confidence, setConfidence] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedScores, setExtractedScores] = useState<ExtractedScore[]>([]);
  const [mapToDRD, setMapToDRD] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const steps: { id: WizardStep; label: string }[] = [
    { id: 'upload', label: isPolish ? 'Wgraj' : 'Upload' },
    { id: 'detect', label: isPolish ? 'Wykryj' : 'Detect' },
    { id: 'extract', label: isPolish ? 'Ekstrahuj' : 'Extract' },
    { id: 'confirm', label: isPolish ? 'Potwierdź' : 'Confirm' },
  ];

  // Handlers
  const handleFileSelect = useCallback((selectedFile: File) => {
    setFile(selectedFile);
    setError(null);
  }, []);

  const handleFileRemove = useCallback(() => {
    setFile(null);
    setDetectedFramework(null);
    setExtractedScores([]);
  }, []);

  const handleFrameworkSelect = useCallback((fw: AssessmentFrameworkId) => {
    setDetectedFramework(fw);
  }, []);

  const handleScoreEdit = useCallback((dimensionId: string, newScore: number) => {
    setExtractedScores((prev) =>
      prev.map((score) =>
        score.dimensionId === dimensionId ? { ...score, score: newScore, edited: true } : score
      )
    );
  }, []);

  const analyzeDocument = useCallback(async () => {
    if (!file) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/pdf-import/detect-framework', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(isPolish ? 'Błąd podczas analizy dokumentu' : 'Error analyzing document');
      }

      const result = await response.json();
      setDetectedFramework(result.framework);
      setConfidence(result.confidence);
    } catch (err) {
      console.error('[PDFImportWizard] Detect framework error:', err);
      setDetectedFramework(null);
      setConfidence(0);
      setError(
        isPolish
          ? 'Nie udało się wykryć frameworka. Sprawdź czy backend /api/pdf-import działa.'
          : 'Failed to detect framework. Check if backend /api/pdf-import is running.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  }, [file]);

  const extractScores = useCallback(async () => {
    if (!file || !detectedFramework) return;

    setIsExtracting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('framework', detectedFramework);

      const response = await fetch('/api/pdf-import/extract-scores', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(isPolish ? 'Błąd podczas ekstrakcji ocen' : 'Error extracting scores');
      }

      const result = await response.json();
      setExtractedScores(result.scores);
    } catch (err) {
      console.error('[PDFImportWizard] Extract scores error:', err);
      setExtractedScores([]);
      setError(
        isPolish
          ? 'Nie udało się wyekstrahować ocen. Sprawdź czy backend /api/pdf-import działa.'
          : 'Failed to extract scores. Check if backend /api/pdf-import is running.'
      );
    } finally {
      setIsExtracting(false);
    }
  }, [file, detectedFramework]);

  const handleConfirm = useCallback(async () => {
    if (!detectedFramework || !file || extractedScores.length === 0) return;

    // Build assessment data based on framework
    let assessmentData: SIRIAssessmentData | ADMAAssessmentData | CMMIAssessmentData;

    if (detectedFramework === 'SIRI') {
      const data: SIRIAssessmentData = {
        buildingBlocks: {
          PROCESS: { score: 0, dimensionScores: {} },
          TECHNOLOGY: { score: 0, dimensionScores: {} },
          ORGANIZATION: { score: 0, dimensionScores: {} },
        },
        dimensions: {},
        prioritisationMatrix: {},
        overallScore: 0,
        metadata: {
          assessmentDate: new Date().toISOString(),
          version: '2.0',
          source: 'imported',
        },
      };

      extractedScores.forEach((score) => {
        data.dimensions[score.dimensionId] = {
          current: score.score,
          target: Math.min(score.score + 1, 5),
          gap: Math.max(0, Math.min(score.score + 1, 5) - score.score),
        };
      });

      data.overallScore =
        extractedScores.reduce((sum, s) => sum + s.score, 0) / extractedScores.length;
      assessmentData = data;
    } else if (detectedFramework === 'ADMA') {
      const data: ADMAAssessmentData = {
        pillars: {
          strategy: { current: 0, target: 0, gap: 0, dimensionScores: {} },
          smart_products: { current: 0, target: 0, gap: 0, dimensionScores: {} },
          smart_operations: { current: 0, target: 0, gap: 0, dimensionScores: {} },
          smart_supply: { current: 0, target: 0, gap: 0, dimensionScores: {} },
          data_driven: { current: 0, target: 0, gap: 0, dimensionScores: {} },
        },
        dimensions: {},
        overallMaturity: 0,
        metadata: {
          assessmentDate: new Date().toISOString(),
          version: '2.0',
          source: 'imported',
        },
      };

      extractedScores.forEach((score) => {
        data.dimensions[score.dimensionId] = {
          current: score.score,
          target: Math.min(score.score + 1, 5),
          gap: Math.max(0, Math.min(score.score + 1, 5) - score.score),
        };
      });

      data.overallMaturity =
        extractedScores.reduce((sum, s) => sum + s.score, 0) / extractedScores.length;
      assessmentData = data;
    } else {
      // CMMI
      const data: CMMIAssessmentData = {
        maturityLevel: 1,
        practiceAreas: {},
        categories: {
          DOING: { averageLevel: 0, practiceAreaScores: {} },
          MANAGING: { averageLevel: 0, practiceAreaScores: {} },
          ENABLING: { averageLevel: 0, practiceAreaScores: {} },
        },
        overallScore: 0,
        metadata: {
          assessmentDate: new Date().toISOString(),
          version: '2.0',
          source: 'imported',
          model: 'DEV',
        },
      };

      extractedScores.forEach((score) => {
        data.practiceAreas[score.dimensionId] = {
          level: score.score,
        };
      });

      data.overallScore =
        extractedScores.reduce((sum, s) => sum + s.score, 0) / extractedScores.length;
      data.maturityLevel = Math.min(...extractedScores.map((s) => s.score));
      assessmentData = data;
    }

    onImportComplete(detectedFramework, assessmentData, file.name);
  }, [detectedFramework, file, extractedScores, onImportComplete]);

  // Navigation
  const goToNext = useCallback(async () => {
    if (currentStep === 'upload' && file) {
      setCurrentStep('detect');
      analyzeDocument();
    } else if (currentStep === 'detect' && detectedFramework) {
      setCurrentStep('extract');
      extractScores();
    } else if (currentStep === 'extract' && extractedScores.length > 0) {
      setCurrentStep('confirm');
    }
  }, [currentStep, file, detectedFramework, extractedScores, analyzeDocument, extractScores]);

  const goToPrev = useCallback(() => {
    const stepIndex = steps.findIndex((s) => s.id === currentStep);
    if (stepIndex > 0) {
      setCurrentStep(steps[stepIndex - 1].id);
    }
  }, [currentStep, steps]);

  const canGoNext = useCallback(() => {
    switch (currentStep) {
      case 'upload':
        return !!file;
      case 'detect':
        return !!detectedFramework && !isAnalyzing;
      case 'extract':
        return extractedScores.length > 0 && !isExtracting;
      case 'confirm':
        return true;
      default:
        return false;
    }
  }, [currentStep, file, detectedFramework, isAnalyzing, extractedScores, isExtracting]);

  const averageScore =
    extractedScores.length > 0
      ? extractedScores.reduce((sum, s) => sum + s.score, 0) / extractedScores.length
      : 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-navy-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-navy-700">
          <h2 className="text-xl font-bold text-navy-900 dark:text-white flex items-center gap-2">
            <Upload className="text-blue-500" />
            Import PDF Assessment
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="px-6 pt-4">
          <StepIndicator currentStep={currentStep} steps={steps} />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-500/30 rounded-lg p-3 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-danger-500" />
              <span className="text-danger-700 dark:text-danger-400">{error}</span>
            </div>
          )}

          {currentStep === 'upload' && (
            <UploadStep
              file={file}
              onFileSelect={handleFileSelect}
              onFileRemove={handleFileRemove}
              isDragging={isDragging}
              setIsDragging={setIsDragging}
              isPolish={isPolish}
            />
          )}

          {currentStep === 'detect' && (
            <DetectionStep
              detectedFramework={detectedFramework}
              confidence={confidence}
              isAnalyzing={isAnalyzing}
              onFrameworkSelect={handleFrameworkSelect}
              allowedFrameworks={allowedFrameworks}
              isPolish={isPolish}
            />
          )}

          {currentStep === 'extract' && detectedFramework && (
            <ExtractionStep
              framework={detectedFramework}
              extractedScores={extractedScores}
              isExtracting={isExtracting}
              onScoreEdit={handleScoreEdit}
              isPolish={isPolish}
            />
          )}

          {currentStep === 'confirm' && detectedFramework && file && (
            <ConfirmStep
              framework={detectedFramework}
              fileName={file.name}
              scoreCount={extractedScores.length}
              averageScore={averageScore}
              mapToDRD={mapToDRD}
              onMapToDRDChange={setMapToDRD}
              isPolish={isPolish}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-slate-200 dark:border-navy-700">
          <button
            onClick={goToPrev}
            disabled={currentStep === 'upload'}
            className="flex items-center gap-2 px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={18} />
            Wstecz
          </button>

          {currentStep === 'confirm' ? (
            <button
              onClick={handleConfirm}
              className="flex items-center gap-2 px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium"
            >
              <CheckCircle size={18} />
              Zapisz Assessment
            </button>
          ) : (
            <button
              onClick={goToNext}
              disabled={!canGoNext()}
              className="flex items-center gap-2 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Dalej
              <ChevronRight size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PDFImportWizard;
