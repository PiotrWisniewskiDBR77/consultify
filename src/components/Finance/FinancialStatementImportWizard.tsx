/**
 * T050 — Financial Statement Import Wizard
 *
 * 4-step wizard: Upload → Detect & Extract → Map & Correct → Confirm
 * Pattern based on PDFImportWizard / ExcelImportWizard.
 */

import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Info,
  Loader2,
  Search,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Api from '../../services/api';
import { shouldFallbackToLegacyFinance, V8FinanceApi } from '../../services/api/v8/finance';
import { trackFunnelEvent } from '../../services/funnelAnalytics';
import {
  type FinancialStatementCanonicalLineOption,
  type FinancialStatementMappedValue,
  FinancialStatementMappingEditor,
} from './FinancialStatementMappingEditor';
import { statementReasonSentences } from './statementReadinessCopy';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Detection {
  statementType: string;
  confidence: number;
  periodStart: string | null;
  periodEnd: string | null;
  periodLabel: string | null;
  currency: string;
  scaling: string;
  language: string;
  containedStatementTypes?: string[];
  containsMultipleStatements?: boolean;
  documentClass?: string;
}

interface ExtractedLine {
  originalLabel: string;
  value: number;
  confidence: number;
  sourceRow?: number;
  selectedPeriodLabel?: string;
  comparisonPeriodLabel?: string;
  rowType?: string;
  sectionKey?: string;
  signMode?: string;
  suggestedCanonicalId?: string;
  suggestedCanonicalLabel?: string;
  isNonFinancial?: boolean;
  classificationReason?: string;
  mappingTier?: 'auto' | 'llm_confirmed' | 'review_required' | 'excluded';
}

interface ExtractionDiagnostics {
  sections?: Array<{
    sectionKey: string;
    sectionLabel: string;
    confidence: number;
  }>;
  columnSelection?: {
    selectedPeriodLabel?: string | null;
    comparisonPeriodLabel?: string | null;
    selectionStrategy?: string;
  };
  warnings?: string[];
  rawTableCount?: number;
  extractionStrategy?: string;
  documentClass?: string;
}

type CanonicalLine = FinancialStatementCanonicalLineOption & {
  statement_type: string;
  line_code: string;
};

type MappedValue = FinancialStatementMappedValue;

interface ValidationMessage {
  type: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  details?: string;
}

interface ReadinessState {
  readinessStatus: 'pending' | 'recoverable' | 'ready' | 'rejected';
  summary: string;
  reasonCodes: string[];
}

type WizardStep = 'upload' | 'detect' | 'map' | 'confirm';

interface Props {
  onClose?: () => void;
  onComplete?: (statementId: string) => void;
  /**
   * When true, the wizard renders as an in-layout instrument panel inside the
   * finance shell (sidebar + topbar stay visible) instead of a full-screen
   * overlay. Adds a `‹ Finance / Import` breadcrumb and drops the oversized
   * page title that previously collided with the app logo (H2.9 / H2.10).
   */
  embedded?: boolean;
}

async function detectStatementWithFallback(statementId: string, body: Record<string, unknown>) {
  try {
    return await V8FinanceApi.detectStatement(statementId, body);
  } catch (error) {
    if (!shouldFallbackToLegacyFinance(error)) {
      throw error;
    }
    return await Api.post(`/api/finance-statements/${statementId}/detect`, body);
  }
}

async function extractStatementWithFallback(statementId: string, body: Record<string, unknown>) {
  try {
    return await V8FinanceApi.extractStatement(statementId, body);
  } catch (error) {
    if (!shouldFallbackToLegacyFinance(error)) {
      throw error;
    }
    return await Api.post(`/api/finance-statements/${statementId}/extract`, body);
  }
}

async function mapStatementWithFallback(statementId: string) {
  try {
    return await V8FinanceApi.mapStatement(statementId, {});
  } catch (error) {
    if (!shouldFallbackToLegacyFinance(error)) {
      throw error;
    }
    return await Api.post(`/api/finance-statements/${statementId}/map`, {});
  }
}

async function getCanonicalLinesWithFallback() {
  try {
    const data = await V8FinanceApi.getCanonicalLines();
    return Array.isArray(data?.canonicalLines) ? data.canonicalLines : [];
  } catch (error) {
    if (!shouldFallbackToLegacyFinance(error)) {
      throw error;
    }
    const response = await Api.get('/api/finance-statements/canonical-lines');
    return Array.isArray(response) ? response : [];
  }
}

async function saveStatementValuesWithFallback(
  statementId: string,
  values: Array<Record<string, unknown>>
) {
  try {
    return await V8FinanceApi.putStatementValues(statementId, { values });
  } catch (error) {
    if (!shouldFallbackToLegacyFinance(error)) {
      throw error;
    }
    return await Api.put(`/api/finance-statements/${statementId}/values`, { values });
  }
}

async function confirmStatementWithFallback(statementId: string) {
  try {
    return await V8FinanceApi.confirmStatement(statementId);
  } catch (error) {
    if (!shouldFallbackToLegacyFinance(error)) {
      throw error;
    }
    return await Api.post(`/api/finance-statements/${statementId}/confirm`, {});
  }
}

async function uploadAndAnalyzeWithFallback(formData: FormData) {
  try {
    return await V8FinanceApi.uploadAndAnalyzeStatement(formData);
  } catch (error) {
    if (!shouldFallbackToLegacyFinance(error)) {
      throw error;
    }
    return await Api.postMultipart('/api/finance-statements/upload-and-analyze', formData);
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const FinancialStatementImportWizard: React.FC<Props> = ({
  onClose,
  onComplete,
  embedded = false,
}) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<WizardStep>('upload');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [statementId, setStatementId] = useState<string | null>(null);
  const [detection, setDetection] = useState<Detection | null>(null);

  // Extract state
  const [extractedLines, setExtractedLines] = useState<ExtractedLine[]>([]);
  const [extractionDiagnostics, setExtractionDiagnostics] = useState<ExtractionDiagnostics | null>(
    null
  );

  // Map state
  const [mappedValues, setMappedValues] = useState<MappedValue[]>([]);
  const [canonicalLines, setCanonicalLines] = useState<CanonicalLine[]>([]);

  // Validation state
  const [validation, setValidation] = useState<{
    status: string;
    messages: ValidationMessage[];
  } | null>(null);
  const [readiness, setReadiness] = useState<ReadinessState | null>(null);

  // Override detection
  const [overrideType, setOverrideType] = useState<string>('');
  const [overrideCurrency, setOverrideCurrency] = useState<string>('');
  const [overridePeriod, setOverridePeriod] = useState<string>('');

  const STEPS: WizardStep[] = ['upload', 'detect', 'map', 'confirm'];
  const stepIdx = STEPS.indexOf(step);

  const handleDismiss = useCallback(() => {
    if (statementId) {
      onComplete?.(statementId);
      return;
    }
    onClose?.();
  }, [onClose, onComplete, statementId]);

  // ── Step 1: Upload ──

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
    setError(null);
  };

  const ACCEPTED_TYPES = new Set([
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    // FIN-005: CSV statement import — backend now accepts it (see
    // fileUpload.middleware.ts EXT_TO_MIME_BASES); the picker/dropzone must
    // allow it too or the golden flow is unreachable from the real screen.
    'text/csv',
    'application/csv',
  ]);
  const ACCEPTED_EXTS = ['.pdf', '.xlsx', '.xls', '.csv'];

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const f = e.dataTransfer.files[0];
      if (
        f &&
        (ACCEPTED_TYPES.has(f.type) ||
          ACCEPTED_EXTS.some((ext) => f.name.toLowerCase().endsWith(ext)))
      ) {
        setFile(f);
      } else {
        setError(
          t('finance.importWizard.unsupportedFormat', 'Supported formats: PDF, XLSX, XLS, CSV')
        );
      }
    },
    [t]
  );

  // Smart analysis result state
  const [smartAnalysis, setSmartAnalysis] = useState<{
    mode: string;
    entityName?: string;
    periodLabel?: string;
    currency?: string;
    scaling?: string;
    documentDescription?: string;
    sectionTypes?: string[];
    totalLines?: number;
    statementPackId?: string;
    statements?: Array<{ statementId: string; statementType: string; lineCount: number }>;
  } | null>(null);

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);

      // Try smart upload first (LLM analyzes entire document)
      const data = await uploadAndAnalyzeWithFallback(formData);

      if (data.mode === 'smart' && data.analysis) {
        // LLM successfully analyzed the document — skip detect/extract steps
        setSmartAnalysis({
          mode: 'smart',
          entityName: data.analysis.entityName,
          periodLabel: data.analysis.periodLabel,
          currency: data.analysis.currency,
          scaling: data.analysis.scaling,
          documentDescription: data.analysis.documentDescription,
          sectionTypes: data.analysis.sectionTypes,
          totalLines: data.analysis.totalLines,
          statementPackId: data.statementPackId,
          statements: data.statements,
        });
        setStatementId(data.statementPackId || data.statementIds?.[0]);
        trackFunnelEvent('financial_statement_import_started', {
          packId: data.statementPackId,
          sections: data.analysis.sectionTypes?.length,
          totalLines: data.analysis.totalLines,
        });
        setStep('confirm');
      } else {
        // Fallback: old flow with manual section selection
        setStatementId(data.statementIds?.[0] || data.statementPackId);
        const fallbackDetection: Detection = {
          statementType: 'P&L',
          confidence: 0.5,
          periodStart: null,
          periodEnd: null,
          periodLabel: null,
          currency: 'PLN',
          scaling: 'units',
          language: 'pl',
        };
        setDetection(fallbackDetection);
        setOverrideType(fallbackDetection.statementType);
        setOverrideCurrency(fallbackDetection.currency);
        setOverridePeriod(fallbackDetection.periodLabel || '');
        trackFunnelEvent('financial_statement_import_started', {
          statementId: data.statementIds?.[0],
        });
        setStep('detect');
      }
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Detect & Extract ──

  const handleExtract = async () => {
    if (!statementId) return;
    setLoading(true);
    setError(null);
    try {
      await detectStatementWithFallback(statementId, {
        statementType: overrideType,
        periodLabel: overridePeriod,
        currency: overrideCurrency,
      });
      const extractData = await extractStatementWithFallback(statementId, {
        statementType: overrideType,
        periodLabel: overridePeriod,
        currency: overrideCurrency,
      });
      const { lines } = extractData as { lines: ExtractedLine[] };
      setExtractedLines(lines);
      setExtractionDiagnostics({
        sections: Array.isArray((extractData as any)?.sections)
          ? (extractData as any).sections.map((section: any) => ({
              sectionKey: String(section.sectionKey || ''),
              sectionLabel: String(section.sectionLabel || ''),
              confidence: Number(section.confidence || 0),
            }))
          : [],
        columnSelection: (extractData as any)?.columnSelection,
        warnings: Array.isArray((extractData as any)?.warnings)
          ? (extractData as any).warnings.map((warning: unknown) => String(warning))
          : [],
        rawTableCount: Number((extractData as any)?.rawTableCount || 0),
        extractionStrategy: String((extractData as any)?.extractionStrategy || ''),
        documentClass: String((extractData as any)?.documentClass || ''),
      });

      // Auto-map
      const mapData = await mapStatementWithFallback(statementId);
      const { mappedLines } = mapData as { mappedLines: ExtractedLine[] };

      // Load canonical lines for dropdown
      const canonData = await getCanonicalLinesWithFallback();
      setCanonicalLines(canonData as CanonicalLine[]);

      // Build mapped values
      const mv: MappedValue[] = (mappedLines as ExtractedLine[]).map((l) => ({
        originalLabel: l.originalLabel,
        value: l.value,
        confidence: l.confidence,
        canonicalLineId: l.suggestedCanonicalId || null,
        canonicalLabel: l.suggestedCanonicalLabel || '',
        mappingStatus: l.isNonFinancial ? 'unmapped' : l.suggestedCanonicalId ? 'auto' : 'unmapped',
        sourceRow: l.sourceRow,
        isNonFinancial: !!l.isNonFinancial,
        classificationReason: l.classificationReason,
        mappingTier: l.mappingTier,
      }));
      setMappedValues(mv);
      setStep('map');
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  // ── Step 3: Map & Correct ──

  const handleValueChange = (idx: number, field: string, val: any) => {
    setMappedValues((prev) => prev.map((v, i) => (i === idx ? { ...v, [field]: val } : v)));
  };

  const handleCanonicalChange = (idx: number, canonId: string) => {
    const canon = canonicalLines.find((c) => c.id === canonId);
    setMappedValues((prev) =>
      prev.map((v, i) =>
        i === idx
          ? {
              ...v,
              canonicalLineId: canonId || null,
              canonicalLabel: canon ? (isPl ? canon.line_name_pl : canon.line_name) : '',
              mappingStatus: canonId ? 'manual' : 'unmapped',
              isNonFinancial: false,
              classificationReason: canonId ? undefined : v.classificationReason,
            }
          : v
      )
    );
  };

  const handleSaveMapping = async () => {
    if (!statementId) return;
    setLoading(true);
    setError(null);
    try {
      const values = mappedValues.map((v) => ({
        canonicalLineId: v.canonicalLineId,
        originalLabel: v.originalLabel,
        value: v.value,
        confidence: v.confidence,
        sourceRow: v.sourceRow,
        mappingStatus: v.mappingStatus,
        isNonFinancial: v.isNonFinancial,
        classificationReason: v.classificationReason,
      }));
      const data = await saveStatementValuesWithFallback(statementId, values);
      setValidation((data as any)?.validation || null);
      setReadiness(
        (data as any)?.readiness
          ? {
              readinessStatus: String((data as any).readiness.readinessStatus || 'pending') as
                | 'pending'
                | 'recoverable'
                | 'ready'
                | 'rejected',
              summary: String((data as any).readiness.summary || ''),
              reasonCodes: Array.isArray((data as any).readiness.reasonCodes)
                ? (data as any).readiness.reasonCodes.map((code: unknown) => String(code))
                : [],
            }
          : null
      );
      trackFunnelEvent('financial_statement_import_completed', {
        statementId,
        lineCount: mappedValues.length,
      });
      setStep('confirm');
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };
  // ── Step 4: Confirm ──

  const handleConfirm = async () => {
    if (!statementId) return;
    setLoading(true);
    try {
      await confirmStatementWithFallback(statementId);
      onComplete?.(statementId);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  // ── Rendering ──

  const confidenceBadge = (conf: number) => {
    const pct = Math.round(conf * 100);
    const color =
      pct >= 70
        ? 'text-emerald-600 bg-emerald-50'
        : pct >= 40
          ? 'text-amber-600 bg-amber-50'
          : 'text-danger-600 bg-danger-50';
    return <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${color}`}>{pct}%</span>;
  };

  const validationIcon = (type: string) => {
    if (type === 'error') return <XCircle size={14} className="text-danger-500" />;
    if (type === 'warning') return <AlertTriangle size={14} className="text-amber-500" />;
    return <CheckCircle2 size={14} className="text-emerald-500" />;
  };

  const stepLabels = smartAnalysis
    ? [
        t('finance.importWizard.smartStepUpload', 'Upload'),
        t('finance.importWizard.smartStepAnalysis', 'AI Analysis'),
        t('finance.importWizard.smartStepDone', 'Done'),
      ]
    : [
        t('finance.importWizard.stepUpload', 'Upload'),
        t('finance.importWizard.stepDetect', 'Detect'),
        t('finance.importWizard.stepMap', 'Map & Correct'),
        t('finance.importWizard.stepConfirm', 'Confirm'),
      ];

  const displaySteps = smartAnalysis ? (['upload', 'detect', 'confirm'] as WizardStep[]) : STEPS;
  const detectedStatementTypes = Array.isArray(detection?.containedStatementTypes)
    ? detection!.containedStatementTypes.filter(Boolean)
    : [];
  const containsMultipleStatements = Boolean(
    detection?.containsMultipleStatements || detectedStatementTypes.length > 1
  );
  const selectedStatementSection = overrideType || detection?.statementType || '';
  const displayedDetectionConfidence = detection?.confidence || 0;
  const detectionConfidenceHint = t(
    'finance.importWizard.confidenceAutoDetection',
    'Heuristic confidence from automatic document detection.'
  );
  const isReadyForConfirm = readiness?.readinessStatus === 'ready';

  return (
    <div
      className={
        embedded
          ? 'h-full overflow-y-auto bg-white dark:bg-navy-950 p-6 pb-10'
          : 'min-h-full bg-white dark:bg-navy-950 p-6 pb-10'
      }
    >
      {/* Header — in embedded mode a breadcrumb replaces the oversized page
          title that collided with the app logo (H2.10). */}
      <div className="flex items-center justify-between mb-8">
        <div className="min-w-0">
          {embedded ? (
            <>
              <button
                onClick={handleDismiss}
                className="group inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              >
                <ChevronLeft
                  size={16}
                  className="transition-transform group-hover:-translate-x-0.5"
                />
                <span>{t('finance.importWizard.breadcrumbFinance', 'Finance')}</span>
                <span className="text-slate-300 dark:text-slate-600">/</span>
                <span className="text-slate-800 dark:text-slate-200">
                  {t('finance.importWizard.breadcrumbImport', 'Import')}
                </span>
              </button>
              <h2 className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
                {t('finance.importWizard.title', 'Import Financial Statement')}
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                {t(
                  'finance.importWizard.subtitle',
                  'Upload a PDF to extract and standardize financial data'
                )}
              </p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                {t('finance.importWizard.title', 'Import Financial Statement')}
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                {t(
                  'finance.importWizard.subtitle',
                  'Upload a PDF to extract and standardize financial data'
                )}
              </p>
            </>
          )}
        </div>
        {onClose && (
          <button
            onClick={handleDismiss}
            aria-label={t('finance.importWizard.ariaCloseImport', 'Close import')}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800"
          >
            <X size={20} className="text-slate-500" />
          </button>
        )}
      </div>

      {/* Steps indicator with progress line */}
      <div
        className="flex items-center mb-8"
        role="navigation"
        aria-label={t('finance.importWizard.ariaImportSteps', 'Import steps')}
      >
        {displaySteps.map((s, i) => {
          const displayStepIdx = displaySteps.indexOf(step);
          const isCompleted = i < displayStepIdx;
          const isCurrent = i === displayStepIdx;
          return (
            <React.Fragment key={s}>
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-all duration-300 ${
                    isCompleted
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : isCurrent
                        ? 'bg-blue-600 text-white shadow-sm ring-4 ring-blue-100 dark:ring-blue-500/20'
                        : 'border-2 border-slate-200 text-slate-600 dark:border-white/[0.1] dark:text-slate-500'
                  }`}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  {isCompleted ? <Check size={14} strokeWidth={3} /> : i + 1}
                </div>
                <span
                  className={`text-sm font-medium transition-colors ${
                    isCompleted
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : isCurrent
                        ? 'text-slate-900 dark:text-white'
                        : 'text-slate-600 dark:text-slate-500'
                  } hidden sm:inline`}
                >
                  {stepLabels[i]}
                </span>
              </div>
              {i < displaySteps.length - 1 && (
                <div className="mx-3 h-0.5 flex-1 rounded-full bg-slate-200 dark:bg-white/[0.08]">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                    style={{ width: isCompleted ? '100%' : isCurrent ? '50%' : '0%' }}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {error && (
        <div className="mb-6 p-3 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-xl flex items-start gap-2">
          <AlertTriangle size={16} className="text-danger-500 mt-0.5 shrink-0" />
          <span className="text-sm text-danger-700 dark:text-danger-400">{error}</span>
        </div>
      )}

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div className="max-w-xl mx-auto">
          <div
            className={`group relative border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-200 cursor-pointer ${
              file
                ? 'border-blue-400/60 bg-blue-50/30 dark:border-blue-500/30 dark:bg-blue-500/5'
                : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50/20 dark:border-white/[0.1] dark:hover:border-blue-500/40 dark:hover:bg-blue-500/5'
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => {
              e.preventDefault();
              e.currentTarget.classList.add('border-blue-400', 'bg-blue-50/30');
            }}
            onDragLeave={(e) => {
              e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50/30');
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
            }}
            aria-label={t('finance.importWizard.ariaDropZone', 'Drop file or click to browse')}
          >
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100/80 transition-colors group-hover:bg-blue-100/60 dark:bg-white/[0.05] dark:group-hover:bg-blue-500/10">
              <Upload
                size={28}
                className="text-slate-600 transition-colors group-hover:text-blue-500"
              />
            </div>
            <p className="text-base font-semibold text-slate-700 dark:text-slate-200 mb-1">
              {t('finance.importWizard.dropOrClick', 'Drop file here or click to browse')}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-500">
              {t(
                'finance.importWizard.supportedFormats',
                'Supported: PDF, Excel (XLSX/XLS), CSV financial statements'
              )}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.xlsx,.xls,.csv"
              onChange={handleFileSelect}
              className="hidden"
              aria-hidden="true"
            />
          </div>

          {file && (
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-3 shadow-sm">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                  file.name.endsWith('.pdf')
                    ? 'bg-danger-50 dark:bg-danger-500/10'
                    : 'bg-emerald-50 dark:bg-emerald-500/10'
                }`}
              >
                <FileText
                  size={18}
                  className={file.name.endsWith('.pdf') ? 'text-danger-500' : 'text-emerald-500'}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                  {file.name}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-500">
                  {(file.size / 1024).toFixed(1)} KB
                  {file.type && (
                    <span className="ml-2">{file.type.split('/').pop()?.toUpperCase()}</span>
                  )}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                }}
                className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
                aria-label={t('finance.importWizard.ariaRemoveFile', 'Remove file')}
              >
                <X size={14} className="text-slate-600" />
              </button>
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={!file || loading}
            className="mt-6 w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-xl shadow-sm hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 active:scale-[0.98]"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
            {loading
              ? t('finance.importWizard.analyzing', 'AI is analyzing document...')
              : t('finance.importWizard.uploadAndAnalyze', 'Upload & Analyze')}
          </button>
        </div>
      )}

      {/* Step 2: Detect & Extract */}
      {step === 'detect' && detection && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="bg-slate-50 dark:bg-navy-900 rounded-xl p-6 space-y-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Search size={18} className="text-blue-500" />
              {t('finance.importWizard.detectionResults', 'Detection Results')}
            </h3>
            <div className="text-sm text-slate-600 dark:text-slate-300">
              {containsMultipleStatements
                ? t(
                    'finance.importWizard.multiStatementIntro',
                    'This source file appears to contain more than one financial statement. Choose which section to extract in this import.'
                  )
                : t(
                    'finance.importWizard.singleStatementIntro',
                    'Review the detected metadata before extracting the statement section.'
                  )}
            </div>

            {containsMultipleStatements && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-100">
                <div className="font-medium">
                  {t(
                    'finance.importWizard.multiStatementWarningTitle',
                    'This file contains multiple statement sections'
                  )}
                </div>
                <div className="mt-1">
                  {t(
                    'finance.importWizard.multiStatementWarningBody',
                    'The selector below does not describe the whole source file. It only chooses which section of the report will be extracted now.'
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {detectedStatementTypes.map((type) => (
                    <span
                      key={type}
                      className="rounded-full border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium text-amber-800 dark:border-amber-800 dark:bg-navy-900 dark:text-amber-200"
                    >
                      {type}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-500 uppercase tracking-wider">
                  {containsMultipleStatements
                    ? t(
                        'finance.importWizard.statementSectionToExtract',
                        'Statement section to extract'
                      )
                    : t('finance.importWizard.statementType', 'Statement Type')}
                </label>
                <select
                  value={overrideType || detection.statementType}
                  onChange={(e) => setOverrideType(e.target.value)}
                  className="mt-1 w-full px-3 py-2 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 rounded-lg text-sm"
                >
                  <option value="P&L">P&L (Income Statement)</option>
                  <option value="BS">BS (Balance Sheet)</option>
                  <option value="CF">CF (Cash Flow)</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 uppercase tracking-wider">
                  {containsMultipleStatements
                    ? t('finance.importWizard.selectedSection', 'Selected section')
                    : t('finance.importWizard.confidence', 'Confidence')}
                </label>
                {containsMultipleStatements ? (
                  <>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="inline-flex rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200">
                        {selectedStatementSection || 'P&L'}
                      </span>
                      <span className="text-sm text-slate-600 dark:text-slate-300">
                        {detection.language?.toUpperCase()}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {t(
                        'finance.importWizard.selectedSectionHint',
                        'This import will extract the section you selected manually.'
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mt-1 flex items-center gap-2">
                      {confidenceBadge(displayedDetectionConfidence)}
                      <span className="text-sm text-slate-600 dark:text-slate-300">
                        {detection.language?.toUpperCase()}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {detectionConfidenceHint}
                    </div>
                  </>
                )}
              </div>
              <div>
                <label className="text-xs text-slate-500 uppercase tracking-wider">
                  {t('finance.importWizard.period', 'Period')}
                </label>
                <input
                  type="text"
                  value={overridePeriod || detection.periodLabel || ''}
                  onChange={(e) => setOverridePeriod(e.target.value)}
                  placeholder="e.g. 2024"
                  className="mt-1 w-full px-3 py-2 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 uppercase tracking-wider">
                  {t('finance.importWizard.currency', 'Currency')}
                </label>
                <select
                  value={overrideCurrency || detection.currency}
                  onChange={(e) => setOverrideCurrency(e.target.value)}
                  className="mt-1 w-full px-3 py-2 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 rounded-lg text-sm"
                >
                  {['PLN', 'EUR', 'USD', 'GBP', 'CZK', 'CHF'].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-600">
              <Info size={12} />
              <span>
                {t('finance.importWizard.scaleDetected', 'Scale detected')}:{' '}
                <strong>{detection.scaling}</strong>
              </span>
              {detection.documentClass && (
                <span>
                  • {t('finance.importWizard.documentClass', 'Document class')}:{' '}
                  <strong>{detection.documentClass}</strong>
                </span>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep('upload')}
              className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 dark:border-navy-600 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800"
            >
              <ChevronLeft size={16} /> {t('common.back', 'Back')}
            </button>
            <button
              onClick={handleExtract}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-500 disabled:opacity-50"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
              {containsMultipleStatements
                ? t(
                    'finance.importWizard.extractSelectedSection',
                    'Extract selected statement section'
                  )
                : t('finance.importWizard.extractLines', 'Extract Financial Lines')}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Map & Correct */}
      {step === 'map' && (
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              {t('finance.importWizard.mappingTitle', 'Map Extracted Lines')}
            </h3>
            <span className="text-sm text-slate-500">
              {mappedValues.filter((v) => v.canonicalLineId).length}/{mappedValues.length}{' '}
              {t('finance.importWizard.mapped', 'mapped')}
            </span>
          </div>

          {extractionDiagnostics && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-navy-700 dark:bg-navy-900">
              <div className="flex flex-wrap gap-3 text-slate-600 dark:text-slate-300">
                <span>
                  {t('finance.importWizard.selectedSection', 'Selected section')}:&nbsp;
                  <strong>{overrideType || detection?.statementType || '—'}</strong>
                </span>
                <span>
                  {t('finance.importWizard.period', 'Period')}:&nbsp;
                  <strong>
                    {extractionDiagnostics.columnSelection?.selectedPeriodLabel ||
                      overridePeriod ||
                      detection?.periodLabel ||
                      '—'}
                  </strong>
                </span>
                {extractionDiagnostics.extractionStrategy && (
                  <span>
                    {t('finance.importWizard.extractionStrategy', 'Extraction strategy')}:&nbsp;
                    <strong>{extractionDiagnostics.extractionStrategy}</strong>
                  </span>
                )}
              </div>
              {extractionDiagnostics.warnings && extractionDiagnostics.warnings.length > 0 && (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-100">
                  <div className="font-medium">
                    {t('finance.importWizard.extractionWarnings', 'Extraction warnings')}
                  </div>
                  <div className="mt-1 space-y-1">
                    {extractionDiagnostics.warnings.map((warning) => (
                      <div key={warning}>{warning}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <FinancialStatementMappingEditor
            mappedValues={mappedValues}
            canonicalLines={canonicalLines}
            onValueChange={handleValueChange}
            onCanonicalChange={handleCanonicalChange}
          />

          {mappedValues.length === 0 && (
            <div className="text-center py-12 text-slate-600">
              <AlertTriangle size={32} className="mx-auto mb-3" />
              <p>
                {t(
                  'finance.importWizard.noLinesExtracted',
                  'No financial lines were extracted. The PDF may need OCR or manual entry.'
                )}
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStep('detect')}
              className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 dark:border-navy-600 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800"
            >
              <ChevronLeft size={16} /> {t('common.back', 'Back')}
            </button>
            <button
              onClick={handleSaveMapping}
              disabled={loading || mappedValues.length === 0}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-500 disabled:opacity-50"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {t('finance.importWizard.saveAndValidate', 'Save & Validate')}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Confirm — Smart Analysis Result */}
      {step === 'confirm' && smartAnalysis && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="overflow-hidden rounded-2xl border border-emerald-200 dark:border-emerald-800">
            <div className="h-1.5 bg-emerald-500" />
            <div className="p-6 bg-emerald-50/80 dark:bg-emerald-900/10">
              <div className="flex items-start gap-4 mb-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-500/15">
                  <CheckCircle2 size={24} className="text-emerald-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                    {t('finance.importWizard.aiAnalyzedTitle', 'Document analyzed by AI')}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {smartAnalysis.documentDescription ||
                      t(
                        'finance.importWizard.analysisCompletedDefault',
                        'Analysis completed successfully'
                      )}
                  </p>
                </div>
              </div>

              {/* Sections found */}
              <div className="mb-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t('finance.importWizard.sectionsFound', 'Sections found')}
                </p>
                <div className="flex flex-wrap gap-2">
                  {(smartAnalysis.statements || []).map((stmt) => (
                    <div
                      key={stmt.statementId}
                      className="flex items-center gap-2 rounded-xl bg-white/70 px-3 py-2 text-sm dark:bg-white/[0.06]"
                    >
                      <span className="inline-flex items-center justify-center h-6 w-10 rounded-md bg-blue-100 text-[10px] font-bold text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
                        {stmt.statementType}
                      </span>
                      <span className="text-slate-700 dark:text-slate-300">
                        {stmt.lineCount} {t('finance.importWizard.linesUnit', 'lines')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Summary grid */}
          <div className="bg-slate-50 dark:bg-navy-900 rounded-xl p-5 grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-500">{t('finance.importWizard.entity', 'Entity')}</span>
              <p className="font-medium text-slate-900 dark:text-white">
                {smartAnalysis.entityName || '—'}
              </p>
            </div>
            <div>
              <span className="text-slate-500">{t('finance.importWizard.period', 'Period')}</span>
              <p className="font-medium text-slate-900 dark:text-white">
                {smartAnalysis.periodLabel || '—'}
              </p>
            </div>
            <div>
              <span className="text-slate-500">
                {t('finance.importWizard.currency', 'Currency')}
              </span>
              <p className="font-medium text-slate-900 dark:text-white">
                {smartAnalysis.currency || 'PLN'}
              </p>
            </div>
            <div>
              <span className="text-slate-500">{t('finance.importWizard.scaling', 'Scaling')}</span>
              <p className="font-medium text-slate-900 dark:text-white">
                {smartAnalysis.scaling || 'units'}
              </p>
            </div>
            <div>
              <span className="text-slate-500">
                {t('finance.importWizard.totalLines', 'Total lines')}
              </span>
              <p className="font-medium text-slate-900 dark:text-white">
                {smartAnalysis.totalLines || 0}
              </p>
            </div>
            <div>
              <span className="text-slate-500">
                {t('finance.importWizard.sourceFile', 'Source file')}
              </span>
              <p className="font-medium text-slate-900 dark:text-white truncate">{file?.name}</p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                onComplete?.(smartAnalysis.statementPackId || statementId || '');
              }}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-500"
            >
              <CheckCircle2 size={16} />
              {t('finance.importWizard.doneGoToReview', 'Done — go to review')}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Confirm — Manual flow (old) */}
      {step === 'confirm' && !smartAnalysis && validation && (
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Readiness gauge + validation summary */}
          <div
            className={`overflow-hidden rounded-2xl border ${
              isReadyForConfirm
                ? 'border-emerald-200 dark:border-emerald-800'
                : readiness?.readinessStatus === 'recoverable' || validation.status === 'warnings'
                  ? 'border-amber-200 dark:border-amber-800'
                  : 'border-danger-200 dark:border-danger-800'
            }`}
          >
            {/* Gauge bar at top */}
            <div
              className={`h-1.5 ${
                isReadyForConfirm
                  ? 'bg-emerald-500'
                  : readiness?.readinessStatus === 'recoverable' || validation.status === 'warnings'
                    ? 'bg-amber-500'
                    : 'bg-danger-500'
              }`}
            />

            <div
              className={`p-6 ${
                isReadyForConfirm
                  ? 'bg-emerald-50/80 dark:bg-emerald-900/10'
                  : readiness?.readinessStatus === 'recoverable' || validation.status === 'warnings'
                    ? 'bg-amber-50/80 dark:bg-amber-900/10'
                    : 'bg-danger-50/80 dark:bg-danger-900/10'
              }`}
            >
              <div className="flex items-start gap-4 mb-4">
                <div
                  className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl ${
                    isReadyForConfirm
                      ? 'bg-emerald-100 dark:bg-emerald-500/15'
                      : readiness?.readinessStatus === 'recoverable' ||
                          validation.status === 'warnings'
                        ? 'bg-amber-100 dark:bg-amber-500/15'
                        : 'bg-danger-100 dark:bg-danger-500/15'
                  }`}
                >
                  {isReadyForConfirm ? (
                    <CheckCircle2 size={24} className="text-emerald-500" />
                  ) : readiness?.readinessStatus === 'recoverable' ||
                    validation.status === 'warnings' ? (
                    <AlertTriangle size={24} className="text-amber-500" />
                  ) : (
                    <XCircle size={24} className="text-danger-500" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                    {isReadyForConfirm
                      ? t('finance.importWizard.validationPass', 'All validations passed')
                      : readiness?.readinessStatus === 'recoverable' ||
                          validation.status === 'warnings'
                        ? t('finance.importWizard.validationWarnings', 'Imported with warnings')
                        : t('finance.importWizard.validationErrors', 'Review required')}
                  </h3>
                  <div className="mt-1 flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                    <span>
                      {mappedValues.filter((v) => v.canonicalLineId).length}/{mappedValues.length}{' '}
                      {t('finance.importWizard.linesMapped', 'lines mapped')}
                    </span>
                    <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                    <span>
                      {validation.messages.filter((m) => m.type === 'error').length}{' '}
                      {t('finance.importWizard.errorsLabel', 'errors')}
                      {validation.messages.filter((m) => m.type === 'warning').length > 0 &&
                        `, ${validation.messages.filter((m) => m.type === 'warning').length} ${t('finance.importWizard.warningsLabel', 'warnings')}`}
                    </span>
                  </div>
                </div>
              </div>

              {readiness?.summary && (
                <div className="mb-4 rounded-xl bg-white/70 px-4 py-3 text-sm text-slate-700 dark:bg-navy-950/30 dark:text-slate-300">
                  {readiness.summary}
                </div>
              )}

              {validation.messages.length > 0 && (
                <div className="space-y-2">
                  {validation.messages.map((msg, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2.5 rounded-lg bg-white/50 px-3 py-2 text-sm dark:bg-white/[0.03]"
                    >
                      {validationIcon(msg.type)}
                      <div className="min-w-0 flex-1">
                        <span className="text-slate-700 dark:text-slate-300">{msg.message}</span>
                        {msg.details && (
                          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-500">
                            {msg.details}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* FALA 1 (2026-07-27): chipy z surowymi kodami backendu
                  (`MISSING_PL`) → zdania mówiące, czego brakuje. */}
              {!!readiness?.reasonCodes?.length && (
                <ul className="mt-4 space-y-1">
                  {statementReasonSentences(readiness.reasonCodes, t).map((sentence) => (
                    <li
                      key={sentence}
                      className="flex items-start gap-1.5 text-[11px] text-slate-600 dark:text-slate-300"
                    >
                      <span aria-hidden="true">•</span>
                      <span>{sentence}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Statement summary */}
          <div className="bg-slate-50 dark:bg-navy-900 rounded-xl p-5 grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-500">{t('finance.importWizard.type', 'Type')}</span>
              <p className="font-medium text-slate-900 dark:text-white">
                {overrideType || detection?.statementType}
              </p>
            </div>
            <div>
              <span className="text-slate-500">{t('finance.importWizard.period', 'Period')}</span>
              <p className="font-medium text-slate-900 dark:text-white">
                {overridePeriod || detection?.periodLabel || '—'}
              </p>
            </div>
            <div>
              <span className="text-slate-500">
                {t('finance.importWizard.currency', 'Currency')}
              </span>
              <p className="font-medium text-slate-900 dark:text-white">
                {overrideCurrency || detection?.currency}
              </p>
            </div>
            <div>
              <span className="text-slate-500">{t('finance.importWizard.file', 'Source')}</span>
              <p className="font-medium text-slate-900 dark:text-white truncate">{file?.name}</p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep('map')}
              className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 dark:border-navy-600 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800"
            >
              <ChevronLeft size={16} /> {t('finance.importWizard.backToMapping', 'Back to Mapping')}
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading || !isReadyForConfirm}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-500 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <CheckCircle2 size={16} />
              )}
              {isReadyForConfirm
                ? t('finance.importWizard.confirmAndSave', 'Confirm & Save')
                : t('finance.importWizard.reviewBeforeConfirm', 'Fix mapping to continue')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinancialStatementImportWizard;
