/**
 * ImportedReportDetailView
 *
 * Dynamic tab content for viewing an imported PDF report.
 * Shows: auto-summary, coverage %, PDF actions, and buttons to
 * create Assessment (DRD) and create Initiatives.
 */

import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Lightbulb,
  Loader2,
  RefreshCw,
  Upload,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

import { LoadingState } from '@/components/ui/primitives';
import { Api } from '@/services/api';

// ============================================
// TYPES
// ============================================

interface ImportedReportDetailViewProps {
  importId: string;
  onBack: () => void;
  onAssessmentCreated?: () => void;
  onInitiativesCreated?: () => void;
}

interface ImportData {
  id: string;
  sourceFileName: string;
  sourceFormat: string;
  sourceFileSize: number;
  detectedFramework: string;
  detectionConfidence: number;
  coveragePercent: number;
  autoSummary: string;
  status: string;
  targetId: string | null;
  targetType: string | null;
  initiativesCreated: number;
  initiativesTargetIds: string[];
  extractedData: {
    framework: string;
    confidence: number;
    scores: any;
    initiatives: Array<{
      title: string;
      description?: string;
      priority?: string;
      effort?: string;
      impact?: string;
      timeline?: string;
      category?: string;
    }>;
    extractionDetails: {
      fieldsFound: string[];
      fieldsMissing: string[];
      warnings: string[];
    };
  } | null;
  createdBy: string;
  createdAt: string;
  processingError: string | null;
}

// ============================================
// STATUS CONFIG
// ============================================

const IMPORT_STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: 'clock' | 'check' | 'spinner' | 'alert' }
> = {
  pending: {
    label: 'Uploaded',
    color: 'text-slate-600 bg-slate-500/15 border-slate-500/20',
    icon: 'clock',
  },
  detecting: {
    label: 'Detecting framework...',
    color: 'text-amber-400 bg-amber-500/15 border-amber-500/20',
    icon: 'spinner',
  },
  extracting: {
    label: 'Extracting data...',
    color: 'text-amber-400 bg-amber-500/15 border-amber-500/20',
    icon: 'spinner',
  },
  ready_for_review: {
    label: 'Ready for review',
    color: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/20',
    icon: 'check',
  },
  assessment_created: {
    label: 'Assessment created',
    color: 'text-blue-400 bg-blue-500/15 border-blue-500/20',
    icon: 'check',
  },
  initiatives_created: {
    label: 'Initiatives created',
    color: 'text-blue-400 bg-blue-500/15 border-blue-500/20',
    icon: 'check',
  },
  completed: {
    label: 'Completed',
    color: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/20',
    icon: 'check',
  },
  failed: {
    label: 'Failed',
    color: 'text-danger-400 bg-danger-500/15 border-danger-500/20',
    icon: 'alert',
  },
};

// ============================================
// COMPONENT
// ============================================

export const ImportedReportDetailView: React.FC<ImportedReportDetailViewProps> = ({
  importId,
  onBack,
  onAssessmentCreated,
  onInitiativesCreated,
}) => {
  const navigate = useNavigate();
  const [data, setData] = useState<ImportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreatingAssessment, setIsCreatingAssessment] = useState(false);
  const [isCreatingInitiatives, setIsCreatingInitiatives] = useState(false);

  // Load import data
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await Api.getReportImport(importId);
      setData(response.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load import data');
    } finally {
      setIsLoading(false);
    }
  }, [importId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Create Assessment
  const handleCreateAssessment = useCallback(async () => {
    if (!data) return;
    setIsCreatingAssessment(true);
    const toastId = toast.loading('Creating assessment from report...');
    try {
      const result = await Api.createAssessmentFromImport(data.id);
      toast.success('Assessment created!', { id: toastId });
      await loadData();
      onAssessmentCreated?.();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create assessment', { id: toastId });
    } finally {
      setIsCreatingAssessment(false);
    }
  }, [data, loadData, onAssessmentCreated]);

  // Create Initiatives
  const handleCreateInitiatives = useCallback(async () => {
    if (!data) return;
    setIsCreatingInitiatives(true);
    const toastId = toast.loading('Creating initiatives from report...');
    try {
      const result = await Api.createInitiativesFromImport(data.id);
      const count = result?.data?.count || 0;
      toast.success(`${count} initiatives created!`, { id: toastId });
      await loadData();
      onInitiativesCreated?.();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create initiatives', { id: toastId });
    } finally {
      setIsCreatingInitiatives(false);
    }
  }, [data, loadData, onInitiativesCreated]);

  // Download PDF
  const handleDownloadPDF = useCallback(async () => {
    if (!data) return;
    const toastId = toast.loading('Downloading...');
    try {
      const blob = await Api.downloadReportImportFile(data.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.sourceFileName;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Download complete', { id: toastId });
    } catch (err: any) {
      toast.error('Failed to download', { id: toastId });
    }
  }, [data]);

  // Open linked assessment
  const handleOpenAssessment = useCallback(() => {
    if (!data?.targetId || !data?.extractedData?.framework) return;
    const fw = data.extractedData.framework.toLowerCase();
    navigate(`/assessment/${fw}/${data.targetId}`);
  }, [data, navigate]);

  // Loading state
  if (isLoading) {
    return <LoadingState variant="spinner" className="h-full" label="Loading imported report..." />;
  }

  // Error state
  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 text-danger-400 mx-auto mb-3" />
          <p className="text-sm text-danger-400 mb-4">{error || 'Report not found'}</p>
          <button
            onClick={onBack}
            className="px-4 py-2 text-sm bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            Back to List
          </button>
        </div>
      </div>
    );
  }

  const statusCfg = IMPORT_STATUS_CONFIG[data.status] || IMPORT_STATUS_CONFIG.pending;
  const extractedData = data.extractedData;
  const initiatives = extractedData?.initiatives || [];
  const fieldsFound = extractedData?.extractionDetails?.fieldsFound || [];
  const fieldsMissing = extractedData?.extractionDetails?.fieldsMissing || [];
  const hasAssessment = !!data.targetId;
  const hasInitiatives = (data.initiativesCreated || 0) > 0;
  const canCreateAssessment =
    !hasAssessment && data.status !== 'pending' && data.status !== 'failed';
  const canCreateInitiatives =
    !hasInitiatives &&
    initiatives.length > 0 &&
    data.status !== 'pending' &&
    data.status !== 'failed';

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-navy-950">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-navy-900 dark:text-white">
                {data.sourceFileName}
              </h2>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">
                <Upload size={10} />
                PDF import
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {data.detectedFramework} · Uploaded{' '}
              {data.createdAt ? new Date(data.createdAt).toLocaleDateString() : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Status badge */}
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${statusCfg.color}`}
          >
            {statusCfg.icon === 'spinner' && <Loader2 size={12} className="animate-spin" />}
            {statusCfg.icon === 'check' && <CheckCircle2 size={12} />}
            {statusCfg.icon === 'clock' && <Clock size={12} />}
            {statusCfg.icon === 'alert' && <AlertCircle size={12} />}
            {statusCfg.label}
          </span>

          {/* Refresh */}
          <button
            onClick={loadData}
            className="p-2 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw size={16} className="text-slate-600 dark:text-slate-400" />
          </button>

          {/* Download PDF */}
          <button
            onClick={handleDownloadPDF}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium
              bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300
              hover:bg-slate-200 dark:hover:bg-navy-700 rounded-lg transition-colors"
          >
            <Download size={14} />
            PDF
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Coverage & Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Coverage */}
            <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Coverage</p>
              <div className="flex items-end gap-2">
                <span className="text-2xl font-bold text-white">
                  {Math.round(data.coveragePercent || 0)}%
                </span>
              </div>
              <div className="mt-2 h-1.5 bg-slate-200 dark:bg-navy-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-emerald-500 to-emerald-400"
                  style={{ width: `${Math.min(100, data.coveragePercent || 0)}%` }}
                />
              </div>
            </div>

            {/* Framework */}
            <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Framework</p>
              <span className="text-lg font-bold text-c-text">{data.detectedFramework}</span>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Confidence: {Math.round(data.detectionConfidence || 0)}%
              </p>
            </div>

            {/* Fields */}
            <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Fields Recognized</p>
              <div className="flex items-end gap-2">
                <span className="text-lg font-bold text-emerald-400">{fieldsFound.length}</span>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  / {fieldsFound.length + fieldsMissing.length}
                </span>
              </div>
              {fieldsMissing.length > 0 && (
                <p className="text-xs text-amber-400 mt-1">{fieldsMissing.length} missing</p>
              )}
            </div>

            {/* Initiatives */}
            <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Initiatives Found</p>
              <span className="text-lg font-bold text-blue-400">{initiatives.length}</span>
              {hasInitiatives && (
                <p className="text-xs text-emerald-400 mt-1">{data.initiativesCreated} created</p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-5">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Actions</h3>
            <div className="flex flex-wrap gap-3">
              {/* Create Assessment */}
              {canCreateAssessment ? (
                <button
                  onClick={handleCreateAssessment}
                  disabled={isCreatingAssessment}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium
                    bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-xl transition-colors
                    disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreatingAssessment ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <FileText size={16} />
                  )}
                  Create Assessment ({data.detectedFramework})
                </button>
              ) : hasAssessment ? (
                <button
                  onClick={handleOpenAssessment}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium
                    bg-c-surface-raised text-c-text border border-c-border
                    hover:bg-c-surface rounded-xl transition-colors"
                >
                  <ExternalLink size={16} />
                  Open Assessment
                </button>
              ) : null}

              {/* Create Initiatives */}
              {canCreateInitiatives ? (
                <button
                  onClick={handleCreateInitiatives}
                  disabled={isCreatingInitiatives}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium
                    bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors
                    disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreatingInitiatives ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Lightbulb size={16} />
                  )}
                  Create Initiatives ({initiatives.length})
                </button>
              ) : hasInitiatives ? (
                <span
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium
                  bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 rounded-xl"
                >
                  <CheckCircle2 size={16} />
                  {data.initiativesCreated} Initiatives Created
                </span>
              ) : initiatives.length === 0 && data.status !== 'pending' ? (
                <span className="inline-flex items-center gap-2 px-4 py-2.5 text-sm text-slate-500 dark:text-slate-400">
                  No initiatives found in report
                </span>
              ) : null}
            </div>

            {/* Processing error */}
            {data.processingError && (
              <div className="mt-4 p-3 bg-danger-500/10 border border-danger-500/20 rounded-lg">
                <p className="text-xs text-danger-400">{data.processingError}</p>
              </div>
            )}
          </div>

          {/* Auto-Summary */}
          {data.autoSummary && (
            <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-5">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
                Report Summary
              </h3>
              <div className="prose prose-sm prose-invert max-w-none text-slate-600 dark:text-slate-400">
                {data.autoSummary.split('\n').map((line, i) => {
                  if (line.startsWith('## ')) {
                    return (
                      <h2 key={i} className="text-base font-bold text-white mt-4 mb-2">
                        {line.replace('## ', '')}
                      </h2>
                    );
                  }
                  if (line.startsWith('### ')) {
                    return (
                      <h3 key={i} className="text-sm font-semibold text-slate-200 mt-3 mb-1">
                        {line.replace('### ', '')}
                      </h3>
                    );
                  }
                  if (line.startsWith('**') && line.endsWith('**')) {
                    return (
                      <p key={i} className="font-medium text-white text-sm">
                        {line.replace(/\*\*/g, '')}
                      </p>
                    );
                  }
                  if (line.startsWith('- ')) {
                    return (
                      <li key={i} className="text-sm text-slate-600 dark:text-slate-400 ml-4">
                        {line.replace('- ', '')}
                      </li>
                    );
                  }
                  if (line.startsWith('**')) {
                    const parts = line.split('**');
                    return (
                      <p key={i} className="text-sm text-slate-600 dark:text-slate-400">
                        <span className="font-medium text-slate-600 dark:text-slate-400">
                          {parts[1]}
                        </span>
                        {parts[2]}
                      </p>
                    );
                  }
                  if (line.trim() === '') return <br key={i} />;
                  return (
                    <p key={i} className="text-sm text-slate-600 dark:text-slate-400">
                      {line}
                    </p>
                  );
                })}
              </div>
            </div>
          )}

          {/* Extracted Initiatives Preview */}
          {initiatives.length > 0 && (
            <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-5">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
                Extracted Initiatives ({initiatives.length})
              </h3>
              <div className="space-y-2 max-h-[400px] overflow-auto">
                {initiatives.map((init, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-navy-800/50 rounded-lg border border-slate-200 dark:border-navy-700"
                  >
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/15 text-blue-400 flex items-center justify-center text-xs font-bold">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                        {init.title}
                      </p>
                      {init.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                          {init.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1.5">
                        {init.priority && (
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                              init.priority === 'critical'
                                ? 'bg-danger-500/15 text-danger-400'
                                : init.priority === 'high'
                                  ? 'bg-amber-500/15 text-amber-400'
                                  : init.priority === 'medium'
                                    ? 'bg-blue-500/15 text-blue-400'
                                    : 'bg-slate-500/15 text-slate-600'
                            }`}
                          >
                            {init.priority}
                          </span>
                        )}
                        {init.effort && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-500/10 text-slate-600">
                            effort: {init.effort}
                          </span>
                        )}
                        {init.impact && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-500/10 text-slate-600">
                            impact: {init.impact}
                          </span>
                        )}
                        {init.category && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400">
                            {init.category}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Coverage Details */}
          {(fieldsFound.length > 0 || fieldsMissing.length > 0) && (
            <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-5">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
                Coverage Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Recognized */}
                {fieldsFound.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-emerald-400 mb-2">
                      Recognized ({fieldsFound.length})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {fieldsFound.map((field, i) => (
                        <span
                          key={i}
                          className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/15"
                        >
                          {field}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Missing */}
                {fieldsMissing.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-amber-400 mb-2">
                      Missing ({fieldsMissing.length})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {fieldsMissing.map((field, i) => (
                        <span
                          key={i}
                          className="text-[11px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/15"
                        >
                          {field}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportedReportDetailView;
