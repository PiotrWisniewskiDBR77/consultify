/**
 * ImportReportModal
 *
 * Modal for importing external assessment reports (PDF/Excel).
 * Extracts scores and maps them to DRD structure.
 *
 * 2026-08-26 assessment cleanup: `handleImport` below posts to
 * `POST /api/assessment-reports/import`, a path the mounted
 * server/src/routes/assessment-reports.routes.ts never defines (grepped —
 * zero matches for /import anywhere under assessment routes). Its only
 * trigger (ReportsTable.tsx's "Import" button) is disabled with a
 * "Planowane" note rather than the endpoint being invented for this batch —
 * this component stays in the tree ready to wire up once that backend work
 * lands.
 */

import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Edit2,
  File,
  FileText,
  Loader2,
  Save,
  Upload,
  X,
} from 'lucide-react';
import React, { useCallback, useRef, useState } from 'react';

import { DRD_AXIS_KEY_MAP, DRD_STRUCTURE } from '@/services/drdStructure';

// Helper to get auth token from localStorage
const getAuthToken = () => localStorage.getItem('token');

interface ExtractedDimension {
  axis: string;
  actual: number;
  confidence: number;
}

interface ImportResult {
  id: string;
  status: string;
  extractedData: {
    reportType: string;
    dimensionCount: number;
    confidence: number;
  };
  drdMapping: Record<string, ExtractedDimension>;
}

interface ImportReportModalProps {
  projectId?: string;
  onClose: () => void;
  onImported: (reportId: string) => void;
}

// maxLevel per axis, read from the single source of truth
// (src/services/drdStructure.ts). Do NOT hand-copy these numbers again:
// DRD_STRUCTURE[*].levelCount is per-axis (5, 6 or 7 — culture and
// cybersecurity are 6, not 5). This table previously hand-maintained
// maxLevel: 5 for both, which capped the "Adjust Scores" input's `max` at 5
// and made level 6 impossible to enter for culture/cybersecurity. `name`
// stays hand-maintained — it's a shorter presentation label than
// DRD_STRUCTURE's, not part of the source.
const DRD_AXIS_LEVEL_COUNT: Record<string, number> = Object.fromEntries(
  DRD_STRUCTURE.map((axis) => [DRD_AXIS_KEY_MAP[axis.id], axis.levelCount])
);

const DRD_AXES = [
  { id: 'processes', name: 'Digital Processes', maxLevel: DRD_AXIS_LEVEL_COUNT.processes },
  { id: 'digitalProducts', name: 'Digital Products', maxLevel: DRD_AXIS_LEVEL_COUNT.digitalProducts },
  { id: 'businessModels', name: 'Business Models', maxLevel: DRD_AXIS_LEVEL_COUNT.businessModels },
  { id: 'dataManagement', name: 'Data Management', maxLevel: DRD_AXIS_LEVEL_COUNT.dataManagement },
  { id: 'culture', name: 'Culture', maxLevel: DRD_AXIS_LEVEL_COUNT.culture },
  { id: 'cybersecurity', name: 'Cybersecurity', maxLevel: DRD_AXIS_LEVEL_COUNT.cybersecurity },
  { id: 'aiMaturity', name: 'AI Maturity', maxLevel: DRD_AXIS_LEVEL_COUNT.aiMaturity },
];

export const ImportReportModal: React.FC<ImportReportModalProps> = ({
  projectId,
  onClose,
  onImported,
}) => {
  const token = getAuthToken();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State
  const [step, setStep] = useState<'upload' | 'mapping' | 'success'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [reportName, setReportName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [editingScores, setEditingScores] = useState<Record<string, number>>({});
  const [editMode, setEditMode] = useState(false);

  // Handle file selection
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setReportName(selectedFile.name.replace(/\.[^/.]+$/, ''));
      setError(null);
    }
  }, []);

  // Handle drag and drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      const ext = droppedFile.name.toLowerCase();
      if (
        ext.endsWith('.pdf') ||
        ext.endsWith('.xlsx') ||
        ext.endsWith('.xls') ||
        ext.endsWith('.txt')
      ) {
        setFile(droppedFile);
        setReportName(droppedFile.name.replace(/\.[^/.]+$/, ''));
        setError(null);
      } else {
        setError('Only PDF, Excel, and TXT files are supported');
      }
    }
  }, []);

  // Upload and import file
  const handleImport = async () => {
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('reportFile', file);
      formData.append('reportName', reportName);
      if (projectId) {
        formData.append('projectId', projectId);
      }

      const response = await fetch('/api/assessment-reports/import', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || data.details || 'Import failed');
      }

      const result = await response.json();
      setImportResult(result);

      // Initialize editing scores from result
      const initialScores: Record<string, number> = {};
      Object.entries(result.drdMapping).forEach(([axis, data]: [string, any]) => {
        initialScores[axis] = data.actual;
      });
      setEditingScores(initialScores);

      setStep('mapping');
    } catch (err: any) {
      console.error('[ImportReportModal] Import error:', err);
      setError(err.message || 'Failed to import report');
    } finally {
      setUploading(false);
    }
  };

  // Save adjusted scores and proceed
  const handleSave = async () => {
    if (!importResult) return;

    // In a real implementation, we would update the report with adjusted scores
    // For now, just proceed to success
    setStep('success');

    setTimeout(() => {
      onImported(importResult.id);
      onClose();
    }, 1500);
  };

  // Render based on step
  const renderContent = () => {
    if (step === 'success') {
      return (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-500/20 flex items-center justify-center mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <h3 className="text-lg font-semibold text-navy-900 dark:text-white mb-2">
            Report Imported Successfully
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            You can now generate initiatives from this report
          </p>
        </div>
      );
    }

    if (step === 'mapping' && importResult) {
      return (
        <div className="space-y-4">
          {/* Extraction summary */}
          <div className="p-4 bg-green-50 dark:bg-green-500/10 rounded-lg border border-green-200 dark:border-green-500/30">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
              <span className="font-medium text-green-700 dark:text-green-400">
                Data Extracted Successfully
              </span>
            </div>
            <div className="text-sm text-green-600 dark:text-green-300 space-y-1">
              <p>Report Type: {importResult.extractedData.reportType}</p>
              <p>Dimensions Found: {importResult.extractedData.dimensionCount}</p>
              <p>Confidence: {Math.round(importResult.extractedData.confidence * 100)}%</p>
            </div>
          </div>

          {/* DRD Mapping */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-navy-900 dark:text-white">DRD Axis Mapping</h4>
              <button
                onClick={() => setEditMode(!editMode)}
                className="flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/30 px-2 py-1 rounded"
              >
                <Edit2 size={12} />
                {editMode ? 'Done' : 'Adjust Scores'}
              </button>
            </div>

            <div className="space-y-2">
              {DRD_AXES.map((axis) => {
                const mapped = importResult.drdMapping[axis.id];
                const score = editingScores[axis.id] ?? mapped?.actual ?? 0;
                const confidence = mapped?.confidence ?? 0;

                return (
                  <div
                    key={axis.id}
                    className="flex items-center justify-between p-3 bg-slate-50 dark:bg-navy-950 rounded-lg border border-slate-200 dark:border-navy-700"
                  >
                    <div className="flex-1">
                      <span className="text-sm font-medium text-navy-900 dark:text-white">
                        {axis.name}
                      </span>
                      {confidence > 0 && (
                        <span className="ml-2 text-xs text-slate-600 dark:text-slate-500">
                          ({Math.round(confidence * 100)}% confidence)
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {editMode ? (
                        <input
                          type="number"
                          min="0"
                          max={axis.maxLevel}
                          step="0.5"
                          value={score || ''}
                          onChange={(e) =>
                            setEditingScores((prev) => ({
                              ...prev,
                              [axis.id]: parseFloat(e.target.value) || 0,
                            }))
                          }
                          className="w-16 px-2 py-1 text-sm text-center rounded border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900"
                        />
                      ) : (
                        <span
                          className={`text-sm font-medium ${
                            score > 0
                              ? 'text-primary-600 dark:text-primary-400'
                              : 'text-slate-600 dark:text-slate-500'
                          }`}
                        >
                          {score > 0 ? score.toFixed(1) : '-'}
                        </span>
                      )}
                      <span className="text-xs text-slate-600 dark:text-slate-500">
                        / {axis.maxLevel}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
            Review and adjust extracted scores before saving. You can generate initiatives from this
            report.
          </p>
        </div>
      );
    }

    // Upload step
    return (
      <div className="space-y-4">
        {/* Drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          className={`
                        border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
                        ${
                          file
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                            : 'border-slate-200 dark:border-navy-700 hover:border-primary-400 hover:bg-slate-50 dark:hover:bg-white/5'
                        }
                    `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.xlsx,.xls,.txt"
            onChange={handleFileChange}
            className="hidden"
          />

          {file ? (
            <div className="flex flex-col items-center">
              <FileText className="w-12 h-12 text-primary-500 mb-3" />
              <p className="font-medium text-navy-900 dark:text-white mb-1">{file.name}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <Upload className="w-12 h-12 text-slate-600 dark:text-slate-500 mb-3" />
              <p className="font-medium text-navy-900 dark:text-white mb-1">
                Drop your report here
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                or click to browse (PDF, Excel, TXT)
              </p>
            </div>
          )}
        </div>

        {/* Report name */}
        {file && (
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Report Name
            </label>
            <input
              type="text"
              value={reportName}
              onChange={(e) => setReportName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-navy-900 dark:text-white"
            />
          </div>
        )}

        {/* Info */}
        <div className="p-3 bg-blue-50 dark:bg-blue-500/10 rounded-lg">
          <p className="text-sm text-blue-700 dark:text-blue-400">
            <strong>How it works:</strong> We'll analyze your report with AI to extract maturity
            scores and map them to the DRD framework. You can review and adjust the mapping before
            saving.
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-overlay p-4">
      <div className="bg-white dark:bg-navy-900 rounded-xl w-full max-w-lg shadow-xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-navy-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                <Upload className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-navy-900 dark:text-white">Import Report</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {step === 'upload' && 'Upload an external assessment report'}
                  {step === 'mapping' && 'Review extracted data'}
                  {step === 'success' && 'Import complete'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-600 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 max-h-[500px] overflow-y-auto">
          {renderContent()}

          {/* Error */}
          {error && (
            <div className="mt-4 flex items-center gap-2 p-3 bg-danger-50 dark:bg-danger-500/10 text-danger-600 dark:text-danger-400 rounded-lg text-sm">
              <AlertCircle size={16} />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        {step !== 'success' && (
          <div className="px-6 py-4 border-t border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950">
            <div className="flex items-center gap-3">
              <button
                onClick={step === 'mapping' ? () => setStep('upload') : onClose}
                className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-400 rounded-lg font-medium hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
              >
                {step === 'mapping' ? 'Back' : 'Cancel'}
              </button>
              <button
                onClick={step === 'upload' ? handleImport : handleSave}
                disabled={step === 'upload' ? !file || uploading : false}
                className={`
                                    flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all
                                    ${
                                      (step === 'upload' && file && !uploading) ||
                                      step === 'mapping'
                                        ? 'bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF]'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-500 cursor-not-allowed'
                                    }
                                `}
              >
                {uploading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Analyzing...
                  </>
                ) : step === 'mapping' ? (
                  <>
                    <Save size={16} />
                    Save Report
                  </>
                ) : (
                  <>
                    <ChevronRight size={16} />
                    Import & Analyze
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImportReportModal;
