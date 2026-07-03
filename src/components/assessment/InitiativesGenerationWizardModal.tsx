import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';

import { Api } from '@/services/api';
import { cn } from '@/utils/cn';

type GenerationMode = 'ASSESSMENT_REPORT' | 'REPORT_ONLY' | 'ASSESSMENT_ONLY';
type RunStatus = 'RUNNING' | 'SUCCEEDED' | 'PARTIAL' | 'FAILED' | 'CANCELLED';

type AssessmentOption = {
  id: string;
  name: string;
  type?: string;
  status?: string;
};

type ReportOption = {
  id: string;
  name: string;
  status?: string;
  builderReportId?: string | null;
};

type InitiativeTemplateOption = {
  id: string;
  name: string;
  category?: string;
  description?: string | null;
  level?: string;
  sourceTypes?: string[];
  isPublic?: boolean;
};

type RunProgress = {
  runId: string;
  assessmentId: string;
  status: RunStatus;
  mode: GenerationMode;
  methodologyId: string;
  requestedCount: number;
  batchSize: number;
  generatedCount: number;
  batchesPlanned: number;
  batchesCreated: number;
  batchesSucceeded: number;
  batchesFailed: number;
  updatedAt?: string | null;
  error?: string | null;
};

export function InitiativesGenerationWizardModal(props: {
  isOpen: boolean;
  onClose: () => void;
  initialAssessmentId?: string | null;
  assessments?: AssessmentOption[];
  onCompleted?: () => void;
}) {
  const { isOpen, onClose, initialAssessmentId, assessments: assessmentsProp, onCompleted } = props;

  const [phase, setPhase] = useState<'config' | 'running' | 'done'>('config');
  const [assessments, setAssessments] = useState<AssessmentOption[]>(assessmentsProp || []);
  const [assessmentId, setAssessmentId] = useState<string>(initialAssessmentId || '');
  const [mode, setMode] = useState<GenerationMode>('ASSESSMENT_REPORT');
  const [reportId, setReportId] = useState<string>('');
  const [reports, setReports] = useState<ReportOption[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [templateId, setTemplateId] = useState<string>('');
  const [templates, setTemplates] = useState<InitiativeTemplateOption[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [methodologyId, setMethodologyId] = useState<string>('impact-feasibility');
  const [requestedCount, setRequestedCount] = useState<number>(20);
  const [includeChatContext, setIncludeChatContext] = useState<boolean>(true);
  const [consultantBrief, setConsultantBrief] = useState<string>('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [loadingAssessments, setLoadingAssessments] = useState(false);
  const [starting, setStarting] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [progress, setProgress] = useState<RunProgress | null>(null);
  const [runInitiatives, setRunInitiatives] = useState<
    Array<{ id: string; title: string; status: string }>
  >([]);
  const [submitting, setSubmitting] = useState(false);

  const pollTimer = useRef<number | null>(null);
  const terminalNotifiedRunIds = useRef<Set<string>>(new Set());

  const canStart = useMemo(() => {
    if (!assessmentId) return false;
    if (!templateId) return false;
    if (mode !== 'ASSESSMENT_ONLY' && !reportId) return false;
    if (!Number.isFinite(requestedCount) || requestedCount < 1) return false;
    return true;
  }, [assessmentId, templateId, mode, reportId, requestedCount]);

  // Load assessments list
  useEffect(() => {
    if (!isOpen) return;
    if (assessmentsProp && assessmentsProp.length) {
      setAssessments(assessmentsProp);
      setLoadingAssessments(false);
      return;
    }
    let cancelled = false;
    setLoadingAssessments(true);
    Api.listAssessments({ limit: 200, offset: 0 })
      .then((resp: any) => {
        if (cancelled) return;
        const list = Array.isArray(resp?.items)
          ? resp.items
          : Array.isArray(resp?.assessments)
            ? resp.assessments
            : [];
        setAssessments(
          list.map((a: any) => ({
            id: String(a?.id || ''),
            name: String(a?.name || a?.title || ''),
            type: a?.assessmentType || a?.assessment_type || a?.type,
            status: a?.status || a?.backendStatus,
          }))
        );
      })
      .catch(() => {})
      .finally(() => {
        if (cancelled) return;
        setLoadingAssessments(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, assessmentsProp]);

  // Reset state when opening
  useEffect(() => {
    if (!isOpen) return;
    setPhase('config');
    setAssessmentId(initialAssessmentId || '');
    setReportId('');
    setReports([]);
    setTemplateId('');
    setRunId(null);
    setProgress(null);
    setStarting(false);
    setShowAdvanced(false);
  }, [isOpen, initialAssessmentId]);

  // Load initiative templates
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoadingTemplates(true);
    Api.get('/initiatives/templates')
      .then((resp: any) => {
        if (cancelled) return;
        const list = Array.isArray(resp?.templates) ? resp.templates : [];
        setTemplates(
          list.map((t: any) => ({
            id: String(t.id),
            name: String(t.name || 'Template'),
            category: t.category ? String(t.category) : undefined,
            description: t.description ? String(t.description) : null,
            level: t.level ? String(t.level) : undefined,
            sourceTypes: Array.isArray(t.sourceTypes) ? t.sourceTypes : t.source_types,
            isPublic: Boolean(t.isPublic ?? t.is_public),
          }))
        );
      })
      .catch(() => setTemplates([]))
      .finally(() => {
        if (cancelled) return;
        setLoadingTemplates(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // Load reports for selected assessment (needed for REPORT_ONLY / ASSESSMENT_REPORT)
  useEffect(() => {
    if (!isOpen) return;
    if (!assessmentId) {
      setReports([]);
      setReportId('');
      return;
    }
    if (mode === 'ASSESSMENT_ONLY') {
      setReports([]);
      setReportId('');
      return;
    }
    let cancelled = false;
    setLoadingReports(true);
    Api.get(`/assessment-reports?assessmentId=${encodeURIComponent(assessmentId)}`)
      .then((resp: any) => {
        if (cancelled) return;
        const list = Array.isArray(resp?.reports) ? resp.reports : [];
        const mapped: ReportOption[] = list.map((r: any) => ({
          id: String(r.id),
          name: String(r.name || r.title || 'Report'),
          status: r.status ? String(r.status) : undefined,
          builderReportId: r.builderReportId || null,
        }));
        setReports(mapped);
        // Reset report selection if it no longer exists
        if (reportId && !mapped.find((x) => x.id === reportId)) {
          setReportId('');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setReports([]);
          setReportId('');
        }
      })
      .finally(() => {
        if (cancelled) return;
        setLoadingReports(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, assessmentId, mode, reportId]);

  // Poll run progress
  useEffect(() => {
    if (!isOpen) return;
    if (!runId || !assessmentId) return;

    const stop = () => {
      if (pollTimer.current) window.clearInterval(pollTimer.current);
      pollTimer.current = null;
    };

    const tick = async () => {
      try {
        const resp = await Api.get(
          `/assessment-workflow-v2/${encodeURIComponent(assessmentId)}/initiative-generation-runs/${encodeURIComponent(runId)}`
        );
        const run = (resp as any)?.run as RunProgress | undefined;
        if (run) {
          setProgress(run);
          if (run.status !== 'RUNNING') {
            stop();
            setPhase('done');
            // Guard against duplicate terminal notifications (e.g. overlapping polls / StrictMode)
            if (!terminalNotifiedRunIds.current.has(runId)) {
              terminalNotifiedRunIds.current.add(runId);
              if (run.status === 'SUCCEEDED')
                toast.success('Initiatives generated', { id: `init-gen-${runId}-ok` });
              if (run.status === 'PARTIAL')
                toast.success('Initiatives generated (partial)', {
                  id: `init-gen-${runId}-partial`,
                });
              if (run.status === 'FAILED')
                toast.error(run.error || 'Initiatives generation failed', {
                  id: `init-gen-${runId}-fail`,
                });
              onCompleted?.();
            }
          }
        }
      } catch {
        // ignore
      }
    };

    tick();
    pollTimer.current = window.setInterval(tick, 1500);
    return () => stop();
  }, [isOpen, runId, assessmentId, onCompleted]);

  // Load run initiatives (done phase)
  useEffect(() => {
    if (!isOpen || phase !== 'done' || !runId || !assessmentId) return;
    let cancelled = false;
    Api.get(
      `/assessment-workflow-v2/${encodeURIComponent(assessmentId)}/initiative-generation-runs/${encodeURIComponent(runId)}/initiatives`
    )
      .then((resp: any) => {
        if (cancelled) return;
        setRunInitiatives(Array.isArray(resp?.initiatives) ? resp.initiatives : []);
      })
      .catch(() => setRunInitiatives([]));
    return () => {
      cancelled = true;
    };
  }, [isOpen, phase, runId, assessmentId]);

  const startRun = async () => {
    if (!canStart) return;
    setStarting(true);
    try {
      const body: any = {
        mode,
        methodologyId,
        requestedCount: Math.max(1, Math.min(200, Number(requestedCount) || 1)),
        batchSize: 7,
        includeChatContext,
        templateId,
      };
      if (mode !== 'ASSESSMENT_ONLY' && reportId) body.reportId = reportId;
      if (consultantBrief.trim()) body.consultantBrief = consultantBrief.trim();

      const resp = await Api.post(
        `/assessment-workflow-v2/${encodeURIComponent(assessmentId)}/initiative-generation-runs`,
        body
      );
      const id = String((resp as any)?.runId || '');
      if (!id) throw new Error('Missing runId');
      setRunId(id);
      setPhase('running');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to start generation');
    } finally {
      setStarting(false);
    }
  };

  if (!isOpen) return null;

  const disableClose = starting || phase === 'running' || submitting;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => !disableClose && onClose()}
        aria-label="Close"
      />

      <div
        className={cn(
          'relative w-full max-w-3xl h-[600px] overflow-hidden rounded-2xl',
          'bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700',
          'shadow-2xl flex flex-col'
        )}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-navy-700 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-200">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Generuj inicjatywy
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {phase === 'config'
                  ? 'Wybierz ocenę i uruchom generator'
                  : phase === 'running'
                    ? 'Trwa generowanie…'
                    : 'Gotowe'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={disableClose}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-500 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-auto p-5">
          {phase === 'config' ? (
            <div className="space-y-5">
              {/* Step 1: Source selection (prominent) */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-slate-900 dark:text-white">
                  1. Źródło danych
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(
                    [
                      {
                        value: 'ASSESSMENT_REPORT',
                        label: 'Assessment + Report',
                        desc: 'Pełna analiza z obu źródeł',
                      },
                      {
                        value: 'ASSESSMENT_ONLY',
                        label: 'Tylko Assessment',
                        desc: 'Na podstawie samej oceny',
                      },
                      { value: 'REPORT_ONLY', label: 'Tylko Report', desc: 'Na podstawie raportu' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setMode(opt.value)}
                      className={cn(
                        'p-3 rounded-xl border text-left transition-all',
                        mode === opt.value
                          ? 'border-slate-400 bg-slate-100 ring-1 ring-slate-300/60 dark:border-white/[0.25] dark:bg-white/[0.08] dark:ring-white/[0.10]'
                          : 'border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 hover:border-slate-300 dark:hover:border-navy-600'
                      )}
                    >
                      <div
                        className={cn(
                          'text-sm font-medium',
                          mode === opt.value
                            ? 'text-slate-900 dark:text-white'
                            : 'text-slate-900 dark:text-white'
                        )}
                      >
                        {opt.label}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {opt.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 2: Assessment selection */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-900 dark:text-white">
                  2. Wybierz ocenę
                </label>
                {loadingAssessments ? (
                  <div className="flex items-center gap-2 h-11 px-4 text-sm text-slate-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Ładowanie…
                  </div>
                ) : (
                  <select
                    value={assessmentId}
                    onChange={(e) => setAssessmentId(e.target.value)}
                    className={cn(
                      'w-full h-11 px-4 rounded-xl border text-sm',
                      'border-slate-200 bg-white text-slate-900',
                      'dark:border-navy-700 dark:bg-navy-900 dark:text-white',
                      'focus:outline-none focus:ring-2 focus:ring-c-focus focus:border-c-focus-solid'
                    )}
                  >
                    <option value="">— wybierz ocenę —</option>
                    {assessments.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.type?.toUpperCase() || 'ASSESSMENT'})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Step 3: Report selection (required for Report modes) */}
              {mode !== 'ASSESSMENT_ONLY' && (
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-900 dark:text-white">
                    3. Wybierz raport
                  </label>
                  {!assessmentId ? (
                    <div className="h-11 px-4 flex items-center text-sm text-slate-500">
                      Najpierw wybierz ocenę.
                    </div>
                  ) : loadingReports ? (
                    <div className="flex items-center gap-2 h-11 px-4 text-sm text-slate-500">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Ładowanie raportów…
                    </div>
                  ) : (
                    <select
                      value={reportId}
                      onChange={(e) => setReportId(e.target.value)}
                      className={cn(
                        'w-full h-11 px-4 rounded-xl border text-sm',
                        'border-slate-200 bg-white text-slate-900',
                        'dark:border-navy-700 dark:bg-navy-900 dark:text-white',
                        'focus:outline-none focus:ring-2 focus:ring-c-focus focus:border-c-focus-solid'
                      )}
                    >
                      <option value="">— wybierz raport —</option>
                      {reports.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} {r.status ? `(${String(r.status).toUpperCase()})` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {mode === 'REPORT_ONLY'
                      ? 'Tryb REPORT_ONLY wymaga raportu.'
                      : 'Tryb Assessment + Report użyje obu źródeł.'}
                  </p>
                </div>
              )}

              {/* Step 4: Template selection (required) */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-900 dark:text-white">
                  {mode === 'ASSESSMENT_ONLY' ? '3.' : '4.'} Wybierz template inicjatywy
                </label>
                {loadingTemplates ? (
                  <div className="flex items-center gap-2 h-11 px-4 text-sm text-slate-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Ładowanie template’ów…
                  </div>
                ) : (
                  <select
                    value={templateId}
                    onChange={(e) => setTemplateId(e.target.value)}
                    className={cn(
                      'w-full h-11 px-4 rounded-xl border text-sm',
                      'border-slate-200 bg-white text-slate-900',
                      'dark:border-navy-700 dark:bg-navy-900 dark:text-white',
                      'focus:outline-none focus:ring-2 focus:ring-c-focus focus:border-c-focus-solid'
                    )}
                  >
                    <option value="">— wybierz template —</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                        {t.category ? ` • ${t.category}` : ''}
                        {t.level ? ` • ${t.level}` : ''}
                      </option>
                    ))}
                  </select>
                )}
                {templateId ? (
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {templates.find((t) => t.id === templateId)?.description || ''}
                  </div>
                ) : null}
              </div>

              {/* Step 5: Configuration row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-900 dark:text-white">
                    {mode === 'ASSESSMENT_ONLY' ? '4.' : '5.'} Metodologia
                  </label>
                  <select
                    value={methodologyId}
                    onChange={(e) => setMethodologyId(e.target.value)}
                    className={cn(
                      'w-full h-11 px-4 rounded-xl border text-sm',
                      'border-slate-200 bg-white text-slate-900',
                      'dark:border-navy-700 dark:bg-navy-900 dark:text-white',
                      'focus:outline-none focus:ring-2 focus:ring-c-focus focus:border-c-focus-solid'
                    )}
                  >
                    <option value="impact-feasibility">Impact × Feasibility</option>
                    <option value="moscow">MoSCoW</option>
                    <option value="rice">RICE</option>
                    <option value="value-effort">Value × Effort</option>
                    <option value="strategic-fit">Strategic Fit</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-900 dark:text-white">
                    Liczba inicjatyw
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setRequestedCount((p) => Math.max(1, p - 5))}
                      className="h-11 w-11 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={200}
                      value={requestedCount}
                      onChange={(e) => setRequestedCount(Number(e.target.value))}
                      className={cn(
                        'flex-1 h-11 px-3 text-center rounded-xl border text-sm',
                        'border-slate-200 bg-white text-slate-900',
                        'dark:border-navy-700 dark:bg-navy-900 dark:text-white',
                        'focus:outline-none focus:ring-2 focus:ring-c-focus'
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => setRequestedCount((p) => Math.min(200, p + 5))}
                      className="h-11 w-11 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Advanced options toggle */}
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                {showAdvanced ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
                Opcje zaawansowane
              </button>

              {showAdvanced && (
                <div className="space-y-4 p-4 rounded-xl border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900/50">
                  <div className="grid grid-cols-2 gap-4">
                    <label className="flex items-center gap-3 cursor-pointer col-span-2">
                      <input
                        type="checkbox"
                        checked={includeChatContext}
                        onChange={(e) => setIncludeChatContext(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-navy-900 focus:ring-c-focus"
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-200">
                        Uwzględnij kontekst czatu
                      </span>
                    </label>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-900 dark:text-white">
                      Notatka konsultanta (opcjonalnie)
                    </label>
                    <textarea
                      value={consultantBrief}
                      onChange={(e) => setConsultantBrief(e.target.value)}
                      rows={3}
                      placeholder="Ograniczenia, priorytety klienta, oczekiwane rezultaty…"
                      className={cn(
                        'w-full px-3 py-2 rounded-lg border text-sm',
                        'border-slate-200 bg-white text-slate-900 placeholder:text-slate-400',
                        'dark:border-navy-700 dark:bg-navy-950 dark:text-white dark:placeholder:text-slate-500'
                      )}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : phase === 'running' ? (
            <div className="py-10 flex flex-col items-center justify-center text-center">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-slate-200 dark:border-white/[0.12]" />
                <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-navy-900 dark:border-slate-100 border-t-transparent animate-spin" />
                <Sparkles size={24} className="absolute inset-0 m-auto text-slate-500 dark:text-slate-300" />
              </div>
              <div className="mt-4 text-base font-semibold text-slate-900 dark:text-white">
                Generowanie inicjatyw…
              </div>
              <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Możesz zamknąć okno — proces kontynuuje w tle.
              </div>

              {progress && (
                <div className="mt-6 w-full max-w-xs text-left space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-300">Wygenerowano</span>
                    <span className="font-medium text-slate-900 dark:text-white">
                      {progress.generatedCount}/{progress.requestedCount}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-300">Partie</span>
                    <span className="font-medium text-slate-900 dark:text-white">
                      {progress.batchesSucceeded + progress.batchesFailed}/{progress.batchesPlanned}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    Generowanie zakończone
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-300">
                    Drafty inicjatyw są zapisane i powiązane z oceną.
                  </div>
                </div>
              </div>

              {progress?.error && (
                <div className="text-sm text-danger-600 dark:text-danger-300">{progress.error}</div>
              )}

              {runInitiatives.length > 0 && (
                <div className="rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900 text-sm font-medium text-slate-900 dark:text-white">
                    Podgląd ({runInitiatives.length})
                  </div>
                  <div className="max-h-48 overflow-auto divide-y divide-slate-200 dark:divide-navy-800">
                    {runInitiatives.slice(0, 10).map((it) => (
                      <div
                        key={it.id}
                        className="px-4 py-2.5 flex items-center justify-between gap-3"
                      >
                        <span className="text-sm text-slate-700 dark:text-slate-200 truncate">
                          {it.title}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">
                          {it.status}
                        </span>
                      </div>
                    ))}
                    {runInitiatives.length > 10 && (
                      <div className="px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400">
                        …i {runInitiatives.length - 10} więcej
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-navy-700 flex items-center justify-end gap-2">
          {phase === 'config' ? (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={disableClose}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-800 text-sm font-medium transition-colors disabled:opacity-50"
              >
                Anuluj
              </button>
              <button
                type="button"
                disabled={!canStart || starting}
                onClick={startRun}
                className="px-4 py-2 rounded-lg bg-navy-900 hover:bg-navy-800 dark:bg-[#F4F7FB] dark:hover:bg-[#DDE5EF] disabled:opacity-50 disabled:cursor-not-allowed text-white dark:text-navy-950 text-sm font-medium transition-colors inline-flex items-center gap-2"
              >
                {starting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uruchamiam…
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generuj inicjatywy
                  </>
                )}
              </button>
            </>
          ) : phase === 'running' ? (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-800 text-sm font-medium transition-colors"
            >
              Zamknij
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={async () => {
                  if (!runId || !assessmentId) return;
                  setSubmitting(true);
                  try {
                    const resp = await Api.post(
                      `/assessment-workflow-v2/${encodeURIComponent(assessmentId)}/initiative-generation-runs/${encodeURIComponent(runId)}/submit-for-review`,
                      {}
                    );
                    const updated = Number((resp as any)?.updated || 0);
                    toast.success(`Przesłano ${updated} inicjatyw do przeglądu`);
                    onCompleted?.();
                  } catch (e: any) {
                    toast.error(e?.message || 'Nie udało się przesłać');
                  } finally {
                    setSubmitting(false);
                  }
                }}
                disabled={submitting || !runId}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-800 text-sm font-medium transition-colors disabled:opacity-50 inline-flex items-center gap-2"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )}
                Prześlij do przeglądu
              </button>
              <button
                type="button"
                onClick={() => {
                  onCompleted?.();
                  onClose();
                }}
                className="px-4 py-2 rounded-lg bg-navy-900 hover:bg-navy-800 dark:bg-[#F4F7FB] dark:hover:bg-[#DDE5EF] text-white dark:text-navy-950 text-sm font-medium transition-colors"
              >
                Zamknij
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default InitiativesGenerationWizardModal;
