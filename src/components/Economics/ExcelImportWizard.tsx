/**
 * Excel Import Wizard
 *
 * 4-step wizard for importing digitization assessments from Excel files
 * Based on PDFImportWizard pattern
 */

import {
  AlertTriangle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  Loader2,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import React, { useCallback, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../services/api';
import { DigitizationAnalysis } from './types';

interface ExcelImportWizardProps {
  onClose: () => void;
  onImportComplete: (analysis: DigitizationAnalysis) => void;
}

type WizardStep = 'upload' | 'preview' | 'name' | 'confirm';

export const ExcelImportWizard: React.FC<ExcelImportWizardProps> = ({
  onClose,
  onImportComplete,
}) => {
  const [currentStep, setCurrentStep] = useState<WizardStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [analysisName, setAnalysisName] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const steps: { id: WizardStep; label: string }[] = [
    { id: 'upload', label: 'Wgraj file' },
    { id: 'preview', label: 'Preview' },
    { id: 'name', label: 'Nazwa' },
    { id: 'confirm', label: 'Confirm' },
  ];

  const handleFileSelect = useCallback((selectedFile: File) => {
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];

    if (
      !validTypes.includes(selectedFile.type) &&
      !selectedFile.name.endsWith('.xlsx') &&
      !selectedFile.name.endsWith('.xls')
    ) {
      toast.error('Supported are only filei Excel (.xlsx, .xls)');
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error('File jest too large. Maximum size to 10MB.');
      return;
    }

    setFile(selectedFile);
    setError(null);
    setAnalysisName(selectedFile.name.replace(/\.(xlsx|xls)$/i, ''));
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) handleFileSelect(droppedFile);
    },
    [handleFileSelect]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) handleFileSelect(selectedFile);
    },
    [handleFileSelect]
  );

  const handleImport = useCallback(async () => {
    if (!file) return;

    setIsImporting(true);
    setError(null);

    try {
      const result = await Api.importDigitizationExcel(file, analysisName || undefined);
      setImportResult(result);

      if (result.success && result.analysisId) {
        // Fetch the created analysis
        const analysis = await Api.getDigitizationAnalysis(result.analysisId);
        toast.success('Import completed successfully!');
        onImportComplete(analysis);
      } else {
        setError(result.message || 'Import failed');
      }
    } catch (err: any) {
      setError(err.message || 'Error occurred during import');
    } finally {
      setIsImporting(false);
    }
  }, [file, analysisName, onImportComplete]);

  const goToNext = useCallback(() => {
    const stepIndex = steps.findIndex((s) => s.id === currentStep);
    if (stepIndex < steps.length - 1) {
      setCurrentStep(steps[stepIndex + 1].id);
    }
  }, [currentStep, steps]);

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
      case 'preview':
        return true;
      case 'name':
        return analysisName.trim().length > 0;
      case 'confirm':
        return true;
      default:
        return false;
    }
  }, [currentStep, file, analysisName]);

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-navy-900 rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-navy-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
              <Upload className="text-emerald-500" size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-navy-900 dark:text-white">Import z Excel</h2>
              <p className="text-xs text-slate-600 dark:text-slate-500">
                Zaimportuj analysis z file Excel
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors"
          >
            <X size={20} className="text-slate-600 dark:text-slate-500" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="px-6 pt-5">
          <div className="flex items-center justify-center gap-2">
            {steps.map((step, index) => {
              const isCompleted = index < currentStepIndex;
              const isCurrent = index === currentStepIndex;

              return (
                <React.Fragment key={step.id}>
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                        isCompleted
                          ? 'bg-emerald-500 text-white'
                          : isCurrent
                            ? 'bg-emerald-500 text-white'
                            : 'bg-slate-200 dark:bg-navy-700 text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {isCompleted ? <CheckCircle size={16} /> : index + 1}
                    </div>
                    <span
                      className={`text-sm font-medium hidden sm:block ${
                        isCurrent ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`w-8 h-0.5 ${
                        isCompleted ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-navy-700'
                      }`}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="bg-danger-50 dark:bg-danger-500/10 border border-danger-200 dark:border-danger-500/30 rounded-xl p-4 mb-4 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-danger-500 shrink-0" />
              <span className="text-danger-700 dark:text-danger-400 text-sm">{error}</span>
            </div>
          )}

          {/* Upload Step */}
          {currentStep === 'upload' && (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <h3 className="text-lg font-bold text-navy-900 dark:text-white">
                  Wgraj file Excel
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Supported formaty: .xlsx, .xls (max. 10MB)
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
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                      : 'border-slate-300 dark:border-c-border hover:border-emerald-400 hover:bg-slate-50 dark:hover:bg-white/5'
                  }`}
                >
                  <FileSpreadsheet
                    className={`w-16 h-16 mx-auto mb-4 ${isDragging ? 'text-emerald-500' : 'text-slate-600 dark:text-slate-500'}`}
                  />
                  <p className="text-slate-600 dark:text-slate-400">
                    Drag Excel file here or{' '}
                    <span className="text-emerald-500 font-medium">click to select</span>
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-500 mt-2">
                    Format: Basic Digitization Project Evaluation Form
                  </p>
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileInput}
                    className="hidden"
                  />
                </div>
              ) : (
                <div className="bg-slate-50 dark:bg-navy-800 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center">
                      <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
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
                      setFile(null);
                    }}
                    className="p-2 text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded-lg"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Preview Step */}
          {currentStep === 'preview' && file && (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <h3 className="text-lg font-bold text-navy-900 dark:text-white">File Previewu</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Check if file was correctly recognized
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-navy-800 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-4">
                  <FileSpreadsheet className="w-8 h-8 text-emerald-500" />
                  <div>
                    <p className="font-medium text-navy-900 dark:text-white">{file.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-2 border-b border-slate-200 dark:border-navy-700">
                    <span className="text-slate-500 dark:text-slate-400">Typ file</span>
                    <span className="text-navy-900 dark:text-white font-medium">Excel (.xlsx)</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-200 dark:border-navy-700">
                    <span className="text-slate-500 dark:text-slate-400">Format</span>
                    <span className="text-navy-900 dark:text-white font-medium">
                      Digitization Evaluation Form
                    </span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-500 dark:text-slate-400">Status</span>
                    <span className="text-emerald-500 font-medium flex items-center gap-1">
                      <CheckCircle size={14} /> Gotowy do importu
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Name Step */}
          {currentStep === 'name' && (
            <div className="space-y-4">
              <div className="text-center mb-4">
                <h3 className="text-lg font-bold text-navy-900 dark:text-white">Nazwa analysis</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Nadaj name importowanej analysesie
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-navy-900 dark:text-white mb-2">
                  Nazwa analysis
                </label>
                <input
                  type="text"
                  value={analysisName}
                  onChange={(e) => setAnalysisName(e.target.value)}
                  placeholder="np. Analiza Q1 2025"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700
                                        dark:border-navy-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>
          )}

          {/* Confirm Step */}
          {currentStep === 'confirm' && (
            <div className="space-y-4">
              {isImporting ? (
                <div className="text-center py-12">
                  <Loader2 className="w-12 h-12 mx-auto mb-4 text-emerald-500 animate-spin" />
                  <p className="text-slate-600 dark:text-slate-400">Importing data...</p>
                  <p className="text-xs text-slate-600 dark:text-slate-500 mt-2">
                    This may take a few seconds
                  </p>
                </div>
              ) : (
                <>
                  <div className="text-center mb-4">
                    <CheckCircle className="w-16 h-16 mx-auto mb-4 text-emerald-500" />
                    <h3 className="text-lg font-bold text-navy-900 dark:text-white">
                      Gotowe do importu
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      Check summary and confirm import
                    </p>
                  </div>

                  <div className="bg-slate-50 dark:bg-navy-800 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Source file:</span>
                      <span className="font-medium text-navy-900 dark:text-white">
                        {file?.name}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Nazwa analysis:</span>
                      <span className="font-medium text-navy-900 dark:text-white">
                        {analysisName}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-slate-200 dark:border-navy-700">
          <button
            onClick={goToPrev}
            disabled={currentStep === 'upload' || isImporting}
            className="flex items-center gap-2 px-4 py-2.5 text-slate-600 dark:text-slate-400
                            hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl disabled:opacity-50
                            disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={18} />
            Wstecz
          </button>

          {currentStep === 'confirm' ? (
            <button
              onClick={handleImport}
              disabled={isImporting}
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-xl
                                hover:bg-emerald-500 font-medium disabled:opacity-50 transition-colors
                                shadow-lg shadow-emerald-600/20"
            >
              {isImporting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <CheckCircle size={18} />
                  Importuj analysis
                </>
              )}
            </button>
          ) : (
            <button
              onClick={goToNext}
              disabled={!canGoNext()}
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-xl
                                hover:bg-emerald-500 font-medium disabled:opacity-50 disabled:cursor-not-allowed
                                transition-colors shadow-lg shadow-emerald-600/20"
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

export default ExcelImportWizard;
