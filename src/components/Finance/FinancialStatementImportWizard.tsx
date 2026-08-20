/**
 * T050 — Financial Statement Import Wizard
 *
 * 4-step wizard: Upload → Detect & Extract → Map & Correct → Confirm
 * Pattern based on PDFImportWizard / ExcelImportWizard.
 */

import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Info,
  Loader2,
  MessageCircle,
  Search,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Api from '../../services/api';
import { shouldFallbackToLegacyFinance, V8FinanceApi } from '../../services/api/v8/finance';
import { trackFunnelEvent } from '../../services/funnelAnalytics';
import {
  type FinancialStatementCanonicalLineOption,
  type FinancialStatementMappedValue,
  FinancialStatementMappingEditor,
  isFinancialStatementValueVerified,
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
  entityName?: string | null;
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
type ReviewStatement = {
  statementId: string;
  statementType: string;
  periodLabel?: string | null;
  comparisonOfStatementId?: string | null;
  sourceReceiptId?: string;
  sourceReceipt?: Record<string, any>;
  currency?: string;
  scaling?: string;
  entityName?: string;
  sourceFileName?: string;
  sourceSha256?: string;
  mappedValues: MappedValue[];
  savedReady?: boolean;
  valuesVersion?: number;
};

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
  onOpenKnowledgeBase?: () => void;
  onOpenAi?: () => void;
  /**
   * When true, the wizard renders as an in-layout instrument panel inside the
   * finance shell (sidebar + topbar stay visible) instead of a full-screen
   * overlay. Adds a `‹ Finance / Import` breadcrumb and drops the oversized
   * page title that previously collided with the app logo (H2.9 / H2.10).
   */
  embedded?: boolean;
  /** Durable Statement id supplied by the Finance deep-link recovery route. */
  initialStatementId?: string;
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

async function getStatementSourceReceiptWithFallback(statementId: string) {
  try {
    const result = await V8FinanceApi.getStatementSourceReceipt(statementId);
    return result.receipt as Record<string, any>;
  } catch (error) {
    if (!shouldFallbackToLegacyFinance(error)) throw error;
    const legacy = await Api.get(`/api/finance-statements/${statementId}/source-receipt`);
    return (((legacy as any)?.receipt || legacy) ?? {}) as Record<string, any>;
  }
}

async function getStatementWithFallback(statementId: string) {
  try {
    const result = await V8FinanceApi.getStatement(statementId);
    return result.statement as Record<string, any>;
  } catch (error) {
    if (!shouldFallbackToLegacyFinance(error)) throw error;
    const legacy = await Api.get(`/api/finance-statements/${statementId}`);
    return (((legacy as any)?.statement || legacy) ?? {}) as Record<string, any>;
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

async function confirmStatementWithFallback(
  statementId: string,
  sourceReceiptId: string,
  expectedValuesVersion: number,
  idempotencyKey: string
) {
  try {
    return await V8FinanceApi.confirmStatement(
      statementId,
      { sourceReceiptId, expectedValuesVersion },
      idempotencyKey
    );
  } catch (error) {
    if (!shouldFallbackToLegacyFinance(error)) {
      throw error;
    }
    return await Api.post(
      `/api/finance-statements/${statementId}/confirm`,
      { sourceReceiptId, expectedValuesVersion },
      { extraHeaders: { 'Idempotency-Key': idempotencyKey } }
    );
  }
}

/** crypto.randomUUID() with a defensive fallback for environments where it's
 * unavailable (older browsers, some test/SSR contexts). Only needs to be
 * unique per file-selection, not cryptographically strong. */
function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `fin005-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// FIN-005 Fix 2: `idempotencyKey` is threaded through to BOTH the v8 call and
// the legacy fallback call — a client retry (automatic on the v8→legacy
// fallback path, or manual after a timeout/network error) must reuse the
// SAME key so the server's reservation/finalize/fail state machine can
// dedupe it instead of creating a second real Statement/Pack. See
// FinancialStatementImportWizard's `uploadIdempotencyKey` state for where
// this key is generated/held.
async function uploadAndAnalyzeWithFallback(formData: FormData, idempotencyKey?: string) {
  const extraHeaders = idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined;
  try {
    return await V8FinanceApi.uploadAndAnalyzeStatement(formData, extraHeaders);
  } catch (error) {
    if (!shouldFallbackToLegacyFinance(error)) {
      throw error;
    }
    return await Api.postMultipart(
      '/api/finance-statements/upload-and-analyze',
      formData,
      extraHeaders
    );
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const FinancialStatementImportWizard: React.FC<Props> = ({
  onClose,
  onComplete,
  onOpenKnowledgeBase,
  onOpenAi,
  embedded = false,
  initialStatementId,
}) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<WizardStep>('upload');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  // FIN-005 Fix 2: one stable key per SELECTED file, reused across every
  // automatic (v8→legacy) or manual retry of THAT file's upload — an upload
  // whose LLM analysis legitimately exceeds the client's request timeout,
  // retried with a fresh key every time, used to create a genuine duplicate
  // Statement/Pack on the server. Regenerated only when the user picks a
  // genuinely different file (handleFileSelect / handleDrop below).
  const [uploadIdempotencyKey, setUploadIdempotencyKey] = useState<string | null>(null);
  const [statementId, setStatementId] = useState<string | null>(null);
  const [detection, setDetection] = useState<Detection | null>(null);

  // Extract state
  const [extractedLines, setExtractedLines] = useState<ExtractedLine[]>([]);
  const [extractionDiagnostics, setExtractionDiagnostics] = useState<ExtractionDiagnostics | null>(
    null
  );

  // Map state
  const [mappedValues, setMappedValues] = useState<MappedValue[]>([]);
  const [reviewStatements, setReviewStatements] = useState<ReviewStatement[]>([]);
  const [activeReviewStatementId, setActiveReviewStatementId] = useState<string>('');
  const [canonicalLines, setCanonicalLines] = useState<CanonicalLine[]>([]);

  // Validation state
  const [validation, setValidation] = useState<{
    status: string;
    messages: ValidationMessage[];
  } | null>(null);
  const [readiness, setReadiness] = useState<ReadinessState | null>(null);
  const [sourceReceipt, setSourceReceipt] = useState<Record<string, any> | null>(null);

  // Override detection
  const [overrideType, setOverrideType] = useState<string>('');
  const [overrideCurrency, setOverrideCurrency] = useState<string>('');
  const [overridePeriod, setOverridePeriod] = useState<string>('');
  const [overrideScaling, setOverrideScaling] = useState<string>('');
  const [overrideEntity, setOverrideEntity] = useState<string>('');
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [stepsExpanded, setStepsExpanded] = useState(false);

  const STEPS: WizardStep[] = ['upload', 'detect', 'map', 'confirm'];
  const stepIdx = STEPS.indexOf(step);

  useEffect(() => {
    const durableId = String(initialStatementId || '').trim();
    if (!durableId) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const initialDetail = await getStatementWithFallback(durableId);
        const siblingIds = Array.from(
          new Set([
            durableId,
            ...(Array.isArray(initialDetail.sourceSiblings)
              ? initialDetail.sourceSiblings.map((sibling: any) => String(sibling.id || ''))
              : []),
          ].filter(Boolean))
        );
        const canonical = await getCanonicalLinesWithFallback();
        const hydrated = await Promise.all(
          siblingIds.map(async (id) => {
            const detail = id === durableId ? initialDetail : await getStatementWithFallback(id);
            const receipt = await getStatementSourceReceiptWithFallback(id);
            const values = Array.isArray(detail.values) ? detail.values : [];
            return {
              statementId: id,
              statementType: String(detail.statement_type || ''),
              periodLabel: detail.period_label || null,
              comparisonOfStatementId: null,
              sourceReceiptId: String(receipt.receipt_id || ''),
              sourceReceipt: receipt,
              currency: String(detail.currency || receipt?.periods_json?.[0]?.currency || ''),
              scaling: String(detail.scaling || receipt?.periods_json?.[0]?.scaling || ''),
              entityName: String(detail.entity_name || receipt.entity_name || ''),
              sourceFileName: String(
                receipt.original_file_name || detail.source_file_name || ''
              ),
              sourceSha256: String(receipt.content_sha256 || ''),
              valuesVersion: Number(detail.values_version ?? detail.latestVersionNo ?? 0),
              savedReady: String(detail.readinessStatus || detail.readiness_status || '') === 'ready',
              mappedValues: values.map((value: any) => {
                let evidence: Record<string, any> = {};
                try {
                  evidence =
                    typeof value.evidence_json === 'string'
                      ? JSON.parse(value.evidence_json)
                      : value.evidence_json || {};
                } catch {
                  evidence = {};
                }
                return {
                  originalLabel: String(value.original_label || value.originalLabel || ''),
                  value: Number(value.value),
                  confidence: Number(value.confidence || 0),
                  sourceRow: value.source_row ?? value.sourceRow,
                  canonicalLineId:
                    value.canonical_line_id || value.canonicalLineId || null,
                  canonicalLabel:
                    value.line_name_pl || value.line_name || value.canonicalLabel || undefined,
                  mappingStatus: String(value.mapping_status || value.mappingStatus || 'unmapped'),
                  mappingTier: value.mapping_tier || value.mappingTier || evidence.mappingTier,
                  userVerified: Boolean(
                    value.user_verified ?? value.userVerified ?? evidence.verified
                  ),
                  isNonFinancial: Boolean(value.is_non_financial ?? value.isNonFinancial),
                  classificationReason:
                    value.classification_reason || value.classificationReason || undefined,
                };
              }),
            } satisfies ReviewStatement;
          })
        );
        if (cancelled) return;
        const active = hydrated.find((item) => item.statementId === durableId) || hydrated[0];
        setStatementId(durableId);
        setReviewStatements(hydrated);
        setActiveReviewStatementId(active?.statementId || durableId);
        setMappedValues(active?.mappedValues || []);
        setSourceReceipt(active?.sourceReceipt || null);
        setCanonicalLines(canonical as CanonicalLine[]);
        setReadiness({
          readinessStatus:
            (initialDetail.readinessStatus || initialDetail.readiness_status || 'pending') as ReadinessState['readinessStatus'],
          summary: String(initialDetail.readinessSummary || initialDetail.quality_summary || ''),
          reasonCodes: Array.isArray(initialDetail.readinessReasonCodes)
            ? initialDetail.readinessReasonCodes
            : [],
        });
        setStep('map');
      } catch (cause: any) {
        if (!cancelled) {
          setError(
            cause?.response?.data?.error ||
              cause?.data?.error ||
              cause?.message ||
              t('finance.importWizard.recoveryFailed', 'Could not reopen this statement safely.')
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialStatementId]);

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
    if (f) {
      setFile(f);
      setUploadIdempotencyKey(generateIdempotencyKey());
    }
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
        setUploadIdempotencyKey(generateIdempotencyKey());
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

      // FIN-005 Fix 2: fall back to generating a key here too, defensively —
      // handleFileSelect/handleDrop always set one when `file` is set, but a
      // missing key must never silently disable idempotency protection.
      const idempotencyKey = uploadIdempotencyKey || generateIdempotencyKey();
      if (!uploadIdempotencyKey) setUploadIdempotencyKey(idempotencyKey);

      // Try smart upload first (LLM analyzes entire document)
      const data = await uploadAndAnalyzeWithFallback(formData, idempotencyKey);

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
        setStatementId(
          data.statementIds?.[0] || data.statements?.[0]?.statementId || data.statementPackId
        );
        trackFunnelEvent('financial_statement_import_started', {
          packId: data.statementPackId,
          sections: data.analysis.sectionTypes?.length,
          totalLines: data.analysis.totalLines,
        });
        const smartTypes = (data.analysis.sectionTypes || []).filter(Boolean);
        setDetection({
          statementType: smartTypes.length === 1 ? smartTypes[0] : '',
          confidence: 1,
          periodStart: null,
          periodEnd: null,
          periodLabel: data.analysis.periodLabel || null,
          currency: data.analysis.currency || 'PLN',
          scaling: data.analysis.scaling || 'units',
          language: 'pl',
          containedStatementTypes: smartTypes,
          containsMultipleStatements: smartTypes.length > 1,
          documentClass: 'financial_statement',
        });
        setOverrideType(smartTypes.length === 1 ? smartTypes[0] : '');
        setOverrideCurrency(data.analysis.currency || 'PLN');
        setOverridePeriod(data.analysis.periodLabel || '');
        setOverrideScaling(data.analysis.scaling || 'units');
        setOverrideEntity(data.analysis.entityName || '');
        setSelectedSections(smartTypes);
        // Smart detection is evidence, not confirmation. Every returned
        // section still passes through the same mapping/verification review.
        setStep('detect');
      } else {
        // Fallback: old flow with manual section selection
        setStatementId(data.statementIds?.[0] || data.statementPackId);
        const detected = data.detection as Partial<Detection> | undefined;
        const fallbackDetection: Detection = {
          statementType: '',
          confidence: 0,
          periodStart: null,
          periodEnd: null,
          periodLabel: null,
          currency: 'PLN',
          scaling: 'units',
          language: 'pl',
          ...detected,
        };
        setDetection(fallbackDetection);
        setOverrideType(fallbackDetection.statementType);
        setOverrideCurrency(fallbackDetection.currency);
        setOverridePeriod(fallbackDetection.periodLabel || '');
        setOverrideScaling(fallbackDetection.scaling);
        setOverrideEntity(String(fallbackDetection.entityName || ''));
        setSelectedSections(
          fallbackDetection.containsMultipleStatements
            ? fallbackDetection.containedStatementTypes || []
            : []
        );
        trackFunnelEvent('financial_statement_import_started', {
          statementId: data.statementIds?.[0],
        });
        setStep('detect');
      }
    } catch (e: any) {
      // FIN-005 Fix 2: the two new idempotency failure codes get an honest,
      // distinct message instead of falling into the generic error path —
      // UPLOAD_IN_PROGRESS is a transient "retry shortly" state (the SAME
      // key stays valid, a retry can reclaim it once the in-flight/stale
      // attempt clears), IDEMPOTENCY_KEY_REUSED means this key is no longer
      // trustworthy for a retry (its recorded content hash no longer
      // matches), so a fresh key is generated before the user can try again.
      const code = e?.data?.code || e?.response?.data?.code;
      if (code === 'UPLOAD_IN_PROGRESS') {
        setError(
          t(
            'finance.importWizard.uploadInProgress',
            'Upload already processing — try again shortly'
          )
        );
      } else if (code === 'IDEMPOTENCY_KEY_REUSED') {
        setUploadIdempotencyKey(generateIdempotencyKey());
        setError(
          t(
            'finance.importWizard.idempotencyKeyReused',
            'This upload could not be safely retried — please try again'
          )
        );
      } else {
        setError(e?.response?.data?.error || e?.data?.error || e?.message || String(e));
      }
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
        ...(selectedSections.length ? { statementTypes: selectedSections } : {}),
        periodLabel: overridePeriod,
        currency: overrideCurrency,
        ...(overrideEntity.trim() ? { entityName: overrideEntity.trim() } : {}),
      });
      const extractData = await extractStatementWithFallback(statementId, {
        statementType: overrideType,
        ...(selectedSections.length ? { statementTypes: selectedSections } : {}),
        periodLabel: overridePeriod,
        currency: overrideCurrency,
        ...(overrideEntity.trim() ? { entityName: overrideEntity.trim() } : {}),
        ...(overrideScaling && overrideScaling !== detection?.scaling
          ? { scaling: overrideScaling }
          : {}),
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
      const staged = Array.isArray((extractData as any)?.statements)
        ? (extractData as any).statements
        : [{ statementId, statementType: overrideType, periodLabel: overridePeriod, lines }];

      // Load canonical lines for dropdown
      const canonData = await getCanonicalLinesWithFallback();
      setCanonicalLines(canonData as CanonicalLine[]);

      const reviews: ReviewStatement[] = [];
      for (const item of staged) {
        const mapData = await mapStatementWithFallback(String(item.statementId));
        const receipt = await getStatementSourceReceiptWithFallback(String(item.statementId));
        const mappedLines = Array.isArray((mapData as any)?.mappedLines)
          ? (mapData as any).mappedLines
          : item.lines || [];
        reviews.push({
          statementId: String(item.statementId),
          statementType: String(item.statementType || overrideType),
          periodLabel: item.periodLabel || null,
          comparisonOfStatementId: item.comparisonOfStatementId || null,
          sourceReceiptId: item.sourceReceiptId ? String(item.sourceReceiptId) : undefined,
          sourceReceipt: receipt,
          currency: String(item.currency || receipt?.periods_json?.[0]?.currency || ''),
          scaling: String(item.scaling || receipt?.periods_json?.[0]?.scaling || ''),
          entityName: String(item.entityName || receipt?.entity_name || ''),
          sourceFileName: String(item.sourceFileName || receipt?.original_file_name || ''),
          sourceSha256: String(item.sourceSha256 || receipt?.content_sha256 || ''),
          mappedValues: (mappedLines as ExtractedLine[]).map((l) => ({
            originalLabel: l.originalLabel,
            value: l.value,
            confidence: l.confidence,
            canonicalLineId: l.suggestedCanonicalId || null,
            canonicalLabel: l.suggestedCanonicalLabel || '',
            mappingStatus: l.isNonFinancial
              ? 'unmapped'
              : l.suggestedCanonicalId
                ? 'auto'
                : 'unmapped',
            sourceRow: l.sourceRow,
            isNonFinancial: !!l.isNonFinancial,
            classificationReason: l.classificationReason,
            mappingTier: l.mappingTier,
          })),
        });
      }
      setReviewStatements(reviews);
      setActiveReviewStatementId(reviews[0]?.statementId || statementId);
      setMappedValues(reviews[0]?.mappedValues || []);
      setSourceReceipt(reviews[0]?.sourceReceipt || null);
      setStep('map');
    } catch (e: any) {
      const detail = e?.response?.data?.error || e?.data?.error || e?.message;
      setError(
        `${t(
          'finance.importWizard.detectionFailedHonest',
          'We could not reliably detect or extract a financial statement. Nothing has been confirmed. Review the document type and try again, or replace the source file.'
        )}${detail ? ` (${String(detail)})` : ''}`
      );
    } finally {
      setLoading(false);
    }
  };

  // ── Step 3: Map & Correct ──

  const handleValueChange = (idx: number, field: string, val: any) => {
    setMappedValues((prev) => prev.map((v, i) => (i === idx ? { ...v, [field]: val } : v)));
    setReviewStatements((current) =>
      current.map((item) =>
        item.statementId === activeReviewStatementId
          ? {
              ...item,
              mappedValues: item.mappedValues.map((value, index) =>
                index === idx ? { ...value, [field]: val } : value
              ),
            }
          : item
      )
    );
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
              userVerified: false,
              isNonFinancial: false,
              classificationReason: canonId ? undefined : v.classificationReason,
            }
          : v
      )
    );
    setReviewStatements((current) =>
      current.map((item) =>
        item.statementId === activeReviewStatementId
          ? {
              ...item,
              mappedValues: item.mappedValues.map((value, index) =>
                index === idx
                  ? {
                      ...value,
                      canonicalLineId: canonId || null,
                      canonicalLabel: canon ? (isPl ? canon.line_name_pl : canon.line_name) : '',
                      mappingStatus: canonId ? 'manual' : 'unmapped',
                      userVerified: false,
                      isNonFinancial: false,
                    }
                  : value
              ),
            }
          : item
      )
    );
  };

  const handleSaveMapping = async () => {
    if (!statementId) return;
    setLoading(true);
    setError(null);
    try {
      const stagedReviews = reviewStatements.length
        ? reviewStatements
        : [{ statementId, statementType: overrideType, mappedValues }];
      let lastData: any = null;
      const saved: ReviewStatement[] = [];
      for (const review of stagedReviews) {
        const values = review.mappedValues.map((v) => ({
          canonicalLineId: v.canonicalLineId,
          originalLabel: v.originalLabel,
          value: v.value,
          confidence: v.confidence,
          sourceRow: v.sourceRow,
          mappingStatus: v.mappingStatus,
          isNonFinancial: v.isNonFinancial,
          classificationReason: v.classificationReason,
          userVerified: Boolean(v.userVerified),
        }));
        const data = await saveStatementValuesWithFallback(review.statementId, values);
        const valuesVersion = Number((data as any)?.valuesVersion || 0);
        let decisionReadiness: ReadinessState | null = null;
        for (const value of review.mappedValues) {
          const requiresHumanDecision =
            value.mappingStatus === 'manual' || value.mappingTier === 'review_required';
          if (!requiresHumanDecision || !value.userVerified) continue;
          if (!review.sourceReceiptId)
            throw new Error(`${review.statementType}: source receipt is required`);
          const body = {
            sourceRow: value.sourceRow,
            canonicalLineId: value.canonicalLineId,
            reason: 'Zweryfikowane przez użytkownika podczas przeglądu importu',
            sourceReceiptId: review.sourceReceiptId,
            expectedValuesVersion: valuesVersion,
          };
          const key = `statement-map-${review.statementId}-${value.sourceRow}-${valuesVersion}`;
          try {
            const result = await V8FinanceApi.recordStatementManualMappingDecision(
              review.statementId,
              body,
              key
            );
            const decision = (result as any)?.decision;
            if (decision?.readinessStatus) {
              decisionReadiness = {
                readinessStatus: decision.readinessStatus,
                summary: String(decision.summary || ''),
                reasonCodes: Array.isArray(decision.reasonCodes) ? decision.reasonCodes : [],
              };
            }
          } catch (decisionError) {
            if (!shouldFallbackToLegacyFinance(decisionError)) throw decisionError;
            const result = await Api.post(
              `/api/finance-statements/${review.statementId}/manual-mapping-decisions`,
              body,
              { extraHeaders: { 'Idempotency-Key': key } }
            );
            const decision = (result as any)?.decision;
            if (decision?.readinessStatus) {
              decisionReadiness = {
                readinessStatus: decision.readinessStatus,
                summary: String(decision.summary || ''),
                reasonCodes: Array.isArray(decision.reasonCodes) ? decision.reasonCodes : [],
              };
            }
          }
        }
        const effectiveReadiness = decisionReadiness || (data as any)?.readiness || null;
        const ready = effectiveReadiness?.readinessStatus === 'ready';
        saved.push({ ...review, savedReady: ready, valuesVersion });
        const receiptStatementId = activeReviewStatementId || stagedReviews[0]?.statementId;
        if (
          review.statementId === receiptStatementId &&
          typeof V8FinanceApi.getStatementSourceReceipt === 'function'
        ) {
          try {
            const receiptResult = await V8FinanceApi.getStatementSourceReceipt(review.statementId);
            setSourceReceipt(receiptResult.receipt as Record<string, any>);
          } catch (receiptError) {
            if (!shouldFallbackToLegacyFinance(receiptError)) throw receiptError;
            const legacy = await Api.get(
              `/api/finance-statements/${review.statementId}/source-receipt`
            );
            setSourceReceipt(((legacy as any)?.receipt || legacy) as Record<string, any>);
          }
        }
        lastData = decisionReadiness ? { ...data, readiness: decisionReadiness } : data;
      }
      setReviewStatements(saved);
      setValidation(lastData?.validation || null);
      setReadiness(
        lastData?.readiness
          ? {
              readinessStatus: String(lastData.readiness.readinessStatus || 'pending') as
                | 'pending'
                | 'recoverable'
                | 'ready'
                | 'rejected',
              summary: String(lastData.readiness.summary || ''),
              reasonCodes: Array.isArray(lastData.readiness.reasonCodes)
                ? lastData.readiness.reasonCodes.map((code: unknown) => String(code))
                : [],
            }
          : null
      );
      trackFunnelEvent('financial_statement_import_completed', {
        statementId,
        lineCount: mappedValues.length,
      });
      // The confirmation step is also the governed closure workbench. A
      // recoverable statement must reach it so the user can see the exact
      // balancing/mapping blockers and return to the affected rows. Readiness
      // still controls the final close action on both UI and server.
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
      const stagedIds = reviewStatements.length
        ? reviewStatements.map((item) => item.statementId)
        : [statementId];
      if (reviewStatements.some((item) => !item.savedReady))
        throw new Error('Every statement section must be saved and ready before confirmation');
      for (const id of stagedIds) {
        const review = reviewStatements.find((item) => item.statementId === id);
        if (!review?.sourceReceiptId || review.valuesVersion == null)
          throw new Error('Source receipt and saved values version are required');
        await confirmStatementWithFallback(
          id,
          review.sourceReceiptId,
          review.valuesVersion,
          `statement-confirm-${id}-${review.valuesVersion}`
        );
      }
      onComplete?.(statementId);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleReturnToBlockingItems = () => {
    const blockingReview = reviewStatements.find((item) => !item.savedReady);
    if (blockingReview) {
      setActiveReviewStatementId(blockingReview.statementId);
      setMappedValues(blockingReview.mappedValues);
    }
    setStep('map');
  };

  // ── Rendering ──

  const confidenceBadge = (conf: number) => {
    const pct = Math.round(conf * 100);
    if (conf < 0.55) {
      return (
        <span className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 dark:bg-white/[0.06] dark:text-slate-300">
          {t(
            'finance.importWizard.detectionNotReliable',
            'Could not detect reliably — review the fields below'
          )}
        </span>
      );
    }
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

  const stepLabels = [
    t('finance.importWizard.stepUpload', 'Upload'),
    t('finance.importWizard.stepDetect', 'Detect'),
    t('finance.importWizard.stepMap', 'Map & Correct'),
    t('finance.importWizard.stepConfirm', 'Confirm'),
  ];

  const displaySteps = STEPS;
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
  const isReadyForConfirm =
    readiness?.readinessStatus === 'ready' &&
    reviewStatements.length > 0 &&
    reviewStatements.every(
      (item) => item.savedReady && item.sourceReceiptId && item.valuesVersion != null
    );
  const activeReview = reviewStatements.find(
    (item) => item.statementId === activeReviewStatementId
  );
  const activeTypeComparisons = activeReview
    ? reviewStatements
        .filter((item) => item.statementType === activeReview.statementType)
        .sort((left, right) => String(right.periodLabel || '').localeCompare(String(left.periodLabel || '')))
    : [];
  const financeNumber = new Intl.NumberFormat(isPl ? 'pl-PL' : 'en-US', {
    maximumFractionDigits: 4,
  });
  const receiptPeriods = Array.isArray(sourceReceipt?.periods_json)
    ? sourceReceipt.periods_json
    : [];
  const durableScaling =
    receiptPeriods.find((period: any) => period?.scaling)?.scaling ||
    activeReview?.scaling ||
    (!sourceReceipt && !activeReview ? overrideScaling || detection?.scaling : '') ||
    '—';
  const durableCurrency =
    receiptPeriods.find((period: any) => period?.currency)?.currency ||
    activeReview?.currency ||
    (!sourceReceipt && !activeReview ? overrideCurrency || detection?.currency : '') ||
    '—';
  const durableSections = Array.from(
    new Set(reviewStatements.map((item) => item.statementType).filter(Boolean))
  );
  const durablePeriods = Array.from(
    new Set(
      reviewStatements
        .flatMap((item) => [
          item.periodLabel,
          ...(Array.isArray(item.sourceReceipt?.periods_json)
            ? item.sourceReceipt.periods_json.map((period: any) => period?.label)
            : []),
        ])
        .filter(Boolean)
    )
  );
  const durablePageRanges = Array.isArray(sourceReceipt?.page_ranges_json)
    ? sourceReceipt.page_ranges_json
        .map((range: any) => [Number(range?.pageStart), Number(range?.pageEnd)])
        .filter(([start, end]: number[]) => Number.isInteger(start) || Number.isInteger(end))
        .map(([start, end]: number[]) =>
          Number.isInteger(start) && Number.isInteger(end) && start !== end
            ? `${start}–${end}`
            : String(Number.isInteger(start) ? start : end)
        )
    : [];
  const durableImportedAt = sourceReceipt?.imported_at
    ? new Intl.DateTimeFormat(isPl ? 'pl-PL' : 'en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(sourceReceipt.imported_at))
    : '—';
  const allReviewValues = reviewStatements.flatMap((item) => item.mappedValues);
  const mappedCount = allReviewValues.filter((value) => value.canonicalLineId).length;
  const verifiedCount = allReviewValues.filter(isFinancialStatementValueVerified).length;

  return (
    <div
      className={
        embedded
          ? `h-full overflow-y-auto bg-white dark:bg-navy-950 ${step === 'map' ? 'p-2' : 'p-6 pb-10'}`
          : 'min-h-full bg-white dark:bg-navy-950 p-6 pb-10'
      }
    >
      {/* Persistent source identity: stays visible throughout recovery and review. */}
      <div
        className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-white/[0.08] dark:bg-navy-900"
        data-testid="import-current-document"
      >
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            {t('finance.importWizard.currentDocument', 'Current document')}
          </div>
          <div className="break-all font-medium text-slate-900 dark:text-white">
            {sourceReceipt?.original_file_name ||
              file?.name ||
              t('finance.importWizard.noDocumentSelected', 'No document selected')}
          </div>
          {(sourceReceipt?.entity_name || activeReview?.entityName || (!sourceReceipt && overrideEntity)) && (
            <div className="text-xs text-slate-600 dark:text-slate-300">
              {t('finance.importWizard.entity', 'Entity')}: {sourceReceipt?.entity_name || activeReview?.entityName || overrideEntity}
              {' · '}
              {t('finance.importWizard.scaling', 'Scaling')}: {durableScaling}
            </div>
          )}
          {sourceReceipt?.content_sha256 && (
            <div className="break-all font-mono text-[10px] text-slate-500">
              SHA-256: {sourceReceipt.content_sha256}
            </div>
          )}
          {sourceReceipt && (
            <div
              className="mt-1 grid gap-x-3 gap-y-0.5 text-[10px] text-slate-500 sm:grid-cols-2 xl:grid-cols-4"
              data-testid="durable-source-summary"
            >
              <span>{durableSections.join(' + ') || '—'} · {durablePeriods.join(' / ') || '—'}</span>
              <span>{durableCurrency} · {durableScaling}</span>
              <span>
                {sourceReceipt.importer_name || '—'} {sourceReceipt.importer_version || ''} ·{' '}
                {t('finance.importWizard.importedBy', 'Imported by')}: {sourceReceipt.imported_by || '—'} ·{' '}
                {t('finance.importWizard.uploadedAt', 'Uploaded at')}: {durableImportedAt}
              </span>
              <span>
                {t('finance.importWizard.readiness', 'Readiness')}: {readiness?.readinessStatus || 'pending'} ·{' '}
                {mappedCount}/{allReviewValues.length} {t('finance.importWizard.mapped', 'mapped')} ·{' '}
                {allReviewValues.length - mappedCount} {t('finance.importWizard.unmapped', 'unmapped')} ·{' '}
                {verifiedCount} {t('finance.mappingEditor.verified', 'verified')}
              </span>
              <span>
                {t('finance.importWizard.pages', 'Pages')}: {durablePageRanges.join(', ') || '—'}
              </span>
            </div>
          )}
          {sourceReceipt && (activeReviewStatementId || statementId) && (
            <div className="mt-1 flex flex-wrap gap-3 text-[11px] font-medium">
              <a
                href={`/api/finance-statements/${activeReviewStatementId || statementId}/source-document`}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:underline"
              >
                {t('finance.importWizard.openSource', 'Open / download source')}
              </a>
              <a
                href={`${globalThis.location?.pathname || '/finance'}?tab=statements&statementId=${encodeURIComponent(activeReviewStatementId || statementId || '')}`}
                className="text-blue-600 hover:underline"
                data-testid="statement-recovery-link"
              >
                {t('finance.importWizard.reopenReview', 'Reopen this review')}
              </a>
            </div>
          )}
          {(reviewStatements.find((item) => item.statementId === activeReviewStatementId)
            ?.sourceReceiptId ||
            statementId) && (
            <div className="font-mono text-[10px] text-slate-500">
              {t('finance.importWizard.receipt', 'Receipt')}:{' '}
              {reviewStatements.find((item) => item.statementId === activeReviewStatementId)
                ?.sourceReceiptId || t('finance.importWizard.pendingReceipt', 'pending')}
            </div>
          )}
        </div>
        <div className="ml-auto text-right" data-testid="import-progress">
          <div className="font-medium text-slate-800 dark:text-slate-200">
            {stepLabels[displaySteps.indexOf(step)]}
          </div>
          <div className="text-xs text-slate-500">
            {displaySteps.indexOf(step) + 1}/{displaySteps.length}
          </div>
        </div>
        {step === 'map' && (
          <div className="flex items-center gap-1">
            {onOpenKnowledgeBase && (
              <button
                type="button"
                onClick={onOpenKnowledgeBase}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-white/[0.06]"
              >
                <BookOpen size={14} />
                {t('finance.importWizard.knowledgeBase', 'Knowledge base')}
              </button>
            )}
            {onOpenAi && (
              <button
                type="button"
                onClick={onOpenAi}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-white/[0.06]"
              >
                <MessageCircle size={14} /> AI
              </button>
            )}
          </div>
        )}
        {onClose && (
          <button
            onClick={handleDismiss}
            aria-label={t('finance.importWizard.ariaCloseImport', 'Close import')}
            className="rounded-lg p-1.5 hover:bg-slate-200 dark:hover:bg-navy-800"
          >
            <X size={18} className="text-slate-500" />
          </button>
        )}
      </div>

      {step !== 'map' && (
        <>
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
          <button
            type="button"
            className="mb-2 text-xs font-medium text-blue-600"
            onClick={() => setStepsExpanded((value) => !value)}
            aria-expanded={stepsExpanded}
          >
            {stepsExpanded
              ? t('finance.importWizard.hideSteps', 'Hide steps')
              : t('finance.importWizard.showSteps', 'Show steps')}
          </button>
          <div
            className={`${stepsExpanded ? 'flex' : 'hidden'} items-center mb-5 rounded-xl border border-slate-200 p-3 dark:border-white/[0.08]`}
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
        </>
      )}

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
                    'Choose every section that belongs to this import. Each selected section and comparative period will be staged for separate review.'
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {detectedStatementTypes.map((type) => (
                    <label
                      key={type}
                      className="rounded-full border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium text-amber-800 dark:border-amber-800 dark:bg-navy-900 dark:text-amber-200"
                    >
                      <input
                        type="checkbox"
                        className="mr-1.5"
                        checked={selectedSections.includes(type)}
                        onChange={(event) =>
                          setSelectedSections((current) =>
                            event.target.checked
                              ? [...new Set([...current, type])]
                              : current.filter((item) => item !== type)
                          )
                        }
                      />
                      {type}
                    </label>
                  ))}
                </div>
                <div className="mt-2 text-xs">
                  {t(
                    'finance.importWizard.wholeStatementHint',
                    'Select all sections to import the whole financial statement.'
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs text-slate-500 uppercase tracking-wider">
                  {t('finance.importWizard.entity', 'Entity')}
                </label>
                <input
                  value={overrideEntity}
                  onChange={(event) => setOverrideEntity(event.target.value)}
                  placeholder={t(
                    'finance.importWizard.entityRequired',
                    'Confirm the reporting entity'
                  )}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-navy-600 dark:bg-navy-800"
                />
              </div>
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
                  <option value="">
                    {t('finance.importWizard.chooseStatementType', 'Choose statement type')}
                  </option>
                  <option value="P&L">P&L (Income Statement)</option>
                  <option value="BS">BS (Balance Sheet)</option>
                  <option value="CF">CF (Cash Flow)</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 uppercase tracking-wider">
                  {t('finance.importWizard.scaling', 'Scaling')}
                </label>
                <select
                  value={overrideScaling || detection.scaling}
                  onChange={(event) => setOverrideScaling(event.target.value)}
                  className="mt-1 w-full px-3 py-2 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 rounded-lg text-sm"
                >
                  <option value="units">{t('finance.importWizard.units', 'Units')}</option>
                  <option value="thousands">
                    {t('finance.importWizard.thousands', 'Thousands')}
                  </option>
                  <option value="millions">{t('finance.importWizard.millions', 'Millions')}</option>
                </select>
                <div className="mt-1 text-xs text-slate-500">
                  {t(
                    'finance.importWizard.scaleProvenance',
                    'Detected automatically; your override is recorded with this import.'
                  )}
                </div>
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
              disabled={loading || (!overrideType && selectedSections.length === 0)}
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
        <div className="grid min-w-0 gap-3 xl:grid-cols-[10rem_minmax(0,1fr)_17rem]">
          <aside className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-white/[0.08] dark:bg-navy-900">
            <div className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {t('finance.importWizard.reviewStatements', 'Sections and periods')}
            </div>
            <div
              className="flex gap-1.5 overflow-x-auto xl:flex-col"
              role="tablist"
              aria-label={t(
                'finance.importWizard.reviewStatements',
                'Statement sections and periods'
              )}
            >
              {(reviewStatements.length > 0 ? reviewStatements : []).map((item) => (
                <button
                  key={item.statementId}
                  type="button"
                  role="tab"
                  aria-label={`${item.statementType} · ${item.periodLabel || '—'}${item.comparisonOfStatementId ? ` · ${t('finance.importWizard.comparison', 'comparison')}` : ''}`}
                  aria-selected={item.statementId === activeReviewStatementId}
                  className={`shrink-0 rounded-lg border px-2.5 py-2 text-left text-xs xl:w-full ${item.statementId === activeReviewStatementId ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-700 dark:border-white/[0.08] dark:bg-navy-950 dark:text-slate-200'}`}
                  onClick={() => {
                    setActiveReviewStatementId(item.statementId);
                    setMappedValues(item.mappedValues);
                    setSourceReceipt(item.sourceReceipt || null);
                  }}
                >
                  <span className="block font-semibold">{item.statementType}</span>
                  <span className="block opacity-80">
                    {item.periodLabel || '—'}
                    {item.comparisonOfStatementId
                      ? ` · ${t('finance.importWizard.comparison', 'comparison')}`
                      : ''}
                  </span>
                </button>
              ))}
            </div>
          </aside>

          <main className="min-w-0 space-y-3">
            {activeTypeComparisons.length > 1 && (
              <section
                className="rounded-xl border border-slate-200 bg-white p-3 dark:border-white/[0.08] dark:bg-navy-900"
                data-testid="statement-comparison-side-by-side"
                aria-label={t('finance.importWizard.comparisonTable', 'Period comparison')}
              >
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {activeReview?.statementType} · {t('finance.importWizard.comparisonTable', 'Period comparison')}
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {activeTypeComparisons.slice(0, 2).map((periodStatement) => (
                    <button
                      key={periodStatement.statementId}
                      type="button"
                      onClick={() => {
                        setActiveReviewStatementId(periodStatement.statementId);
                        setMappedValues(periodStatement.mappedValues);
                        setSourceReceipt(periodStatement.sourceReceipt || null);
                      }}
                      className={`min-w-0 rounded-lg border p-2 text-left ${
                        periodStatement.statementId === activeReviewStatementId
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10'
                          : 'border-slate-200 dark:border-white/[0.08]'
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {periodStatement.periodLabel || '—'}
                        </span>
                        <span className="max-w-48 truncate text-[10px] text-slate-500">
                          {periodStatement.sourceReceipt?.original_file_name ||
                            sourceReceipt?.original_file_name ||
                            file?.name ||
                            '—'}
                        </span>
                      </div>
                      <div className="max-h-40 overflow-y-auto">
                        {periodStatement.mappedValues.map((value, index) => (
                          <div
                            key={`${periodStatement.statementId}-${value.sourceRow ?? index}`}
                            className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 border-t border-slate-100 py-1 text-[11px] dark:border-white/[0.05]"
                          >
                            <span className="truncate text-slate-600 dark:text-slate-300">
                              {value.canonicalLabel || value.originalLabel}
                            </span>
                            <span className="tabular-nums text-slate-900 dark:text-white">
                              {financeNumber.format(Number(value.value))}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-1 truncate font-mono text-[9px] text-slate-500" title={periodStatement.sourceReceiptId}>
                        {t('finance.importWizard.receipt', 'Receipt')}: {periodStatement.sourceReceiptId}
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}
            <div className="flex items-center justify-between px-1">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                {t('finance.importWizard.mappingTitle', 'Map Extracted Lines')}
              </h3>
              <span className="text-sm text-slate-500">
                {mappedValues.filter((v) => v.canonicalLineId).length}/{mappedValues.length}{' '}
                {t('finance.importWizard.mapped', 'mapped')}
              </span>
            </div>

            <FinancialStatementMappingEditor
              mappedValues={mappedValues}
              canonicalLines={canonicalLines}
              onValueChange={handleValueChange}
              onCanonicalChange={handleCanonicalChange}
              onVerifiedChange={(idx, verified) => {
                setMappedValues((current) =>
                  current.map((value, index) =>
                    index === idx ? { ...value, userVerified: verified } : value
                  )
                );
                setReviewStatements((current) =>
                  current.map((item) =>
                    item.statementId === activeReviewStatementId
                      ? {
                          ...item,
                          mappedValues: item.mappedValues.map((value, index) =>
                            index === idx ? { ...value, userVerified: verified } : value
                          ),
                        }
                      : item
                  )
                );
              }}
              onVerifyAllReady={() => {
                const verifyEligible = (value: MappedValue) =>
                  value.confidence < 0.85 || value.mappingTier === 'review_required';
                setMappedValues((current) =>
                  current.map((value) =>
                    verifyEligible(value) ? { ...value, userVerified: true } : value
                  )
                );
                setReviewStatements((current) =>
                  current.map((item) =>
                    item.statementId === activeReviewStatementId
                      ? {
                          ...item,
                          mappedValues: item.mappedValues.map((value) =>
                            verifyEligible(value) ? { ...value, userVerified: true } : value
                          ),
                        }
                      : item
                  )
                );
              }}
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
          </main>

          <aside
            className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 text-xs dark:border-white/[0.08] dark:bg-navy-900"
            aria-label={t('finance.importWizard.statementMetrics', 'Statement metrics')}
          >
            <div className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {t('finance.importWizard.statementMetrics', 'Statement metrics')}
            </div>
            <dl className="space-y-2.5">
              <div>
                <dt className="text-slate-500">{t('finance.importWizard.source', 'Source')}</dt>
                <dd
                  className="truncate font-medium text-slate-800 dark:text-slate-200"
                  title={file?.name}
                >
                  {file?.name || '—'}
                </dd>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <dt className="text-slate-500">
                    {t('finance.importWizard.selectedSection', 'Section')}
                  </dt>
                  <dd className="font-semibold text-slate-800 dark:text-slate-200">
                    {reviewStatements.find((item) => item.statementId === activeReviewStatementId)
                      ?.statementType ||
                      overrideType ||
                      detection?.statementType ||
                      '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">{t('finance.importWizard.period', 'Period')}</dt>
                  <dd className="font-semibold text-slate-800 dark:text-slate-200">
                    {reviewStatements.find((item) => item.statementId === activeReviewStatementId)
                      ?.periodLabel ||
                      extractionDiagnostics?.columnSelection?.selectedPeriodLabel ||
                      '—'}
                  </dd>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <dt className="text-slate-500">
                    {t('finance.importWizard.currency', 'Currency')}
                  </dt>
                  <dd className="font-medium text-slate-800 dark:text-slate-200">
                    {overrideCurrency || detection?.currency || '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">{t('finance.importWizard.scaling', 'Scale')}</dt>
                  <dd className="font-medium text-slate-800 dark:text-slate-200">
                    {overrideScaling || detection?.scaling || '—'}
                  </dd>
                </div>
              </div>
              <div>
                <dt className="text-slate-500">{t('finance.importWizard.mapping', 'Mapping')}</dt>
                <dd className="font-medium text-slate-800 dark:text-slate-200">
                  {mappedValues.filter((value) => value.canonicalLineId).length} /{' '}
                  {mappedValues.length} {t('finance.importWizard.mapped', 'mapped')}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">
                  {t('finance.importWizard.readiness', 'Readiness')}
                </dt>
                <dd className="font-medium text-slate-800 dark:text-slate-200">
                  {readiness?.readinessStatus ||
                    t('finance.importWizard.reviewInProgress', 'Review in progress')}
                </dd>
              </div>
              {extractionDiagnostics?.warnings?.length ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-100">
                  <dt className="font-semibold">
                    {t('finance.importWizard.extractionWarnings', 'Warnings')}
                  </dt>
                  <dd className="mt-1">{extractionDiagnostics.warnings[0]}</dd>
                </div>
              ) : null}
            </dl>
          </aside>
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
            <div className="col-span-2 border-t border-slate-200 pt-3 dark:border-navy-700">
              <span className="text-slate-500">
                {t('finance.importWizard.sourceIdentity', 'Source document identity')}
              </span>
              <p className="break-all font-medium text-slate-900 dark:text-white">
                {sourceReceipt?.original_file_name || file?.name || '—'}
              </p>
              <div className="mt-1 grid gap-1 text-xs text-slate-600 dark:text-slate-300 md:grid-cols-2">
                <span>{overrideEntity || sourceReceipt?.entity_name || '—'}</span>
                <span>
                  {(sourceReceipt?.periods_json || reviewStatements.map((item) => item.periodLabel))
                    .map((period: any) => period?.label || period)
                    .filter(Boolean)
                    .join(', ') || '—'}
                </span>
                <span>
                  {t('finance.importWizard.uploadedAt', 'Uploaded')}:{' '}
                  {sourceReceipt?.imported_at || '—'}
                </span>
                <span>
                  {t('finance.importWizard.importer', 'Importer')}:{' '}
                  {[sourceReceipt?.importer_name, sourceReceipt?.importer_version]
                    .filter(Boolean)
                    .join(' ') || '—'}
                </span>
                <span>
                  {t('finance.importWizard.importedBy', 'Imported by')}:{' '}
                  {sourceReceipt?.imported_by || '—'}
                </span>
                <span>
                  {t('finance.importWizard.sourceKind', 'Source channel')}:{' '}
                  {sourceReceipt?.source_kind || '—'}
                </span>
                <span>
                  {t('finance.importWizard.pages', 'Pages')}:{' '}
                  {(sourceReceipt?.page_ranges_json || [])
                    .map((range: any) =>
                      range?.pageStart === range?.pageEnd
                        ? range?.pageStart
                        : `${range?.pageStart || '—'}–${range?.pageEnd || '—'}`
                    )
                    .filter(Boolean)
                    .join(', ') || '—'}
                </span>
                <span>
                  {sourceReceipt?.mime_type || '—'} · {sourceReceipt?.size_bytes || '—'} B
                </span>
                <span className="md:col-span-2 font-mono break-all">
                  SHA-256: {sourceReceipt?.content_sha256 || '—'}
                </span>
              </div>
              {(activeReviewStatementId || statementId) && (
                <a
                  href={`/api/finance-statements/${activeReviewStatementId || statementId}/source-document`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex text-sm font-medium text-blue-600 hover:underline"
                >
                  {t('finance.importWizard.openSource', 'Open / download source')}
                </a>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleConfirm}
              disabled={loading || reviewStatements.some((item) => !item.savedReady)}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-500"
            >
              <CheckCircle2 size={16} />
              {t('finance.importWizard.confirmAndSave', 'Confirm & Save')}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Confirm — Manual flow (old) */}
      {step === 'confirm' && !smartAnalysis && validation && (
        <div className="max-w-2xl mx-auto space-y-6">
          <section
            className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/[0.08] dark:bg-navy-900"
            aria-label={t('finance.importWizard.closureChecklist', 'Statement closure checklist')}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">
                  {t('finance.importWizard.closureChecklist', 'Statement closure checklist')}
                </h3>
                <p className="text-xs text-slate-500">
                  {t(
                    'finance.importWizard.closureChecklistHint',
                    'Every section and period must pass mapping, human review when required, and consistency checks.'
                  )}
                </p>
              </div>
              <span className="text-xs font-medium text-slate-500">
                {reviewStatements.filter((item) => item.savedReady).length}/
                {reviewStatements.length}
              </span>
            </div>
            <div className="space-y-2">
              {reviewStatements.map((item) => (
                <button
                  key={item.statementId}
                  type="button"
                  onClick={() => {
                    setActiveReviewStatementId(item.statementId);
                    setMappedValues(item.mappedValues);
                    if (!item.savedReady) setStep('map');
                  }}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2 text-left hover:bg-slate-50 dark:border-white/[0.08] dark:hover:bg-white/[0.03]"
                >
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    {item.statementType} · {item.periodLabel}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-semibold ${
                      item.savedReady ? 'text-emerald-600' : 'text-amber-600'
                    }`}
                  >
                    {item.savedReady ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                    {item.savedReady
                      ? t('finance.importWizard.readyToClose', 'Ready to close')
                      : t('finance.importWizard.requiresCompletion', 'Requires completion')}
                  </span>
                </button>
              ))}
            </div>
          </section>
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
                      ? t(
                          'finance.importWizard.validationPass',
                          'Statement is balanced and ready to close'
                        )
                      : readiness?.readinessStatus === 'recoverable' ||
                          validation.status === 'warnings'
                        ? t(
                            'finance.importWizard.validationWarnings',
                            'Statement still requires completion'
                          )
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
            <div className="col-span-2 border-t border-slate-200 pt-3 dark:border-navy-700">
              <span className="text-slate-500">
                {t('finance.importWizard.sourceIdentity', 'Source document identity')}
              </span>
              <p className="break-all font-medium text-slate-900 dark:text-white">
                {sourceReceipt?.original_file_name || file?.name || '—'}
              </p>
              <div className="mt-1 grid gap-1 text-xs text-slate-600 dark:text-slate-300 md:grid-cols-2">
                <span>{overrideEntity || sourceReceipt?.entity_name || '—'}</span>
                <span>
                  {(sourceReceipt?.periods_json || reviewStatements.map((item) => item.periodLabel))
                    .map((period: any) => period?.label || period)
                    .filter(Boolean)
                    .join(', ') || '—'}
                </span>
                <span>
                  {t('finance.importWizard.uploadedAt', 'Uploaded')}:{' '}
                  {sourceReceipt?.imported_at || '—'}
                </span>
                <span>
                  {t('finance.importWizard.importer', 'Importer')}:{' '}
                  {[sourceReceipt?.importer_name, sourceReceipt?.importer_version]
                    .filter(Boolean)
                    .join(' ') || '—'}
                </span>
                <span>
                  {t('finance.importWizard.importedBy', 'Imported by')}:{' '}
                  {sourceReceipt?.imported_by || '—'}
                </span>
                <span>
                  {t('finance.importWizard.sourceKind', 'Source channel')}:{' '}
                  {sourceReceipt?.source_kind || '—'}
                </span>
                <span>
                  {t('finance.importWizard.pages', 'Pages')}:{' '}
                  {(sourceReceipt?.page_ranges_json || [])
                    .map((range: any) =>
                      range?.pageStart === range?.pageEnd
                        ? range?.pageStart
                        : `${range?.pageStart || '—'}–${range?.pageEnd || '—'}`
                    )
                    .filter(Boolean)
                    .join(', ') || '—'}
                </span>
                <span>
                  {sourceReceipt?.mime_type || '—'} · {sourceReceipt?.size_bytes || '—'} B
                </span>
                <span className="md:col-span-2 break-all font-mono">
                  SHA-256: {sourceReceipt?.content_sha256 || '—'}
                </span>
              </div>
              {(activeReviewStatementId || statementId) && (
                <a
                  href={`/api/finance-statements/${activeReviewStatementId || statementId}/source-document`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex text-sm font-medium text-blue-600 hover:underline"
                >
                  {t('finance.importWizard.openSource', 'Open / download source')}
                </a>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleReturnToBlockingItems}
              className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 dark:border-navy-600 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800"
            >
              <ChevronLeft size={16} /> {t('finance.importWizard.backToMapping', 'Back to Mapping')}
            </button>
            <button
              onClick={isReadyForConfirm ? handleConfirm : handleReturnToBlockingItems}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-500 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <CheckCircle2 size={16} />
              )}
              {isReadyForConfirm
                ? t('finance.importWizard.confirmAndSave', 'Confirm & Save')
                : t('finance.importWizard.backToBlockingItems', 'Return to blocking items')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinancialStatementImportWizard;
