import { ArrowLeft, Check, Edit2, Loader2, MoreVertical, Save } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';

import { DRDAssessmentEditor } from '@/components/assessment/drd/DRDAssessmentEditor';
import { SIRIForm } from '@/components/assessment/tools/SIRIForm';
import { DRD_STRUCTURE } from '@/services/drdStructure';
import { useAppStore } from '@/store/useAppStore';
import { AppView } from '@/types';
import { Api } from '@/services/api';

type SupportedFramework = 'drd' | 'siri' | 'adma' | 'cmmi' | 'lean';

type AssessmentSession = {
  id: string;
  name: string;
  status: string;
  type?: string;
  completion_percent?: number;
  updated_at?: string;
  answers?: Record<string, any>;
};

type DRDFormData = Record<string, any>;
type SIRIFormData = Record<string, any>;

function calcDrdCompletionPercent(drd: any): number {
  // New DRD editor stores per-area achieved levels in `drd.areas`.
  // We treat an area as "answered" when achievedLevel > 0 (or targetLevel set).
  const areas = drd?.areas || {};
  const items = Object.values(areas) as Array<{ achievedLevel?: number; targetLevel?: number }>;
  if (items.length === 0) return 0;
  const answered = items.filter(
    (x) => Number(x?.achievedLevel || 0) > 0 || Number(x?.targetLevel || 0) > 0
  ).length;
  return Math.round((answered / items.length) * 100);
}

function calcAxisProgress(drd: any, axisId: number): { completed: number; total: number; percent: number } {
  const axis = DRD_STRUCTURE.find((a) => a.id === axisId);
  if (!axis) return { completed: 0, total: 0, percent: 0 };
  const areas = drd?.areas || {};
  const axisAreas = axis.areas.filter((a) => areas[a.id]);
  const completed = axisAreas.filter((a) => {
    const state = areas[a.id];
    return Number(state?.achievedLevel || 0) > 0 || Number(state?.targetLevel || 0) > 0;
  }).length;
  return {
    completed,
    total: axis.areas.length,
    percent: axis.areas.length > 0 ? Math.round((completed / axis.areas.length) * 100) : 0,
  };
}

export const AssessmentSessionEditorView: React.FC = () => {
  const navigate = useNavigate();
  const { framework: frameworkParam, assessmentId } = useParams();
  const { setCurrentViewState } = useAppStore();

  const framework = (frameworkParam?.toLowerCase() as SupportedFramework | undefined) || undefined;

  // Set currentView for breadcrumbs
  useEffect(() => {
    if (framework === 'drd') {
      setCurrentViewState(AppView.ASSESSMENT_DRD);
    } else if (framework === 'siri') {
      setCurrentViewState(AppView.ASSESSMENT_SIRI);
    } else if (framework === 'adma') {
      setCurrentViewState(AppView.ASSESSMENT_ADMA);
    } else if (framework === 'cmmi') {
      setCurrentViewState(AppView.ASSESSMENT_CMMI);
    } else if (framework === 'lean') {
      setCurrentViewState(AppView.ASSESSMENT_LEAN);
    }
  }, [framework, setCurrentViewState]);

  const [assessment, setAssessment] = useState<AssessmentSession | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [currentAxisId, setCurrentAxisId] = useState<number>(1);

  const saveTimerRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, []);

  const load = useCallback(async () => {
    if (!assessmentId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = (await Api.get(`/assessment-workflow-v2/${assessmentId}`)) as AssessmentSession;
      setAssessment(data);
      setAnswers(data?.answers || {});
    } catch (e: any) {
      setError(e?.message || 'Failed to load assessment');
    } finally {
      setIsLoading(false);
    }
  }, [assessmentId]);

  useEffect(() => {
    load();
  }, [load]);

  const scheduleSave = useCallback(
    (nextAnswers: Record<string, any>, completionPercent?: number) => {
      if (!assessmentId) return;
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);

      saveTimerRef.current = window.setTimeout(async () => {
        setIsSaving(true);
        try {
          await Api.put(`/assessment-workflow-v2/${assessmentId}`, {
            answers: nextAnswers,
            completionPercent: completionPercent ?? assessment?.completion_percent ?? 0,
          });
          if (!isMountedRef.current) return;
          setLastSavedAt(new Date());
        } catch (e: any) {
          console.error('[AssessmentSessionEditorView] Auto-save failed:', e);
          // Silent fail for auto-save; user can manually save if needed
        } finally {
          if (!isMountedRef.current) return;
          setIsSaving(false);
        }
      }, 600);
    },
    [assessmentId, assessment?.completion_percent]
  );

  const handleManualSave = useCallback(async () => {
    if (!assessmentId || isSaving) return;
    setIsSaving(true);
    try {
      const completionPercent =
        framework === 'drd' ? calcDrdCompletionPercent(answers?.drd || {}) : assessment?.completion_percent ?? 0;
      await Api.put(`/assessment-workflow-v2/${assessmentId}`, {
        answers,
        completionPercent,
      });
      setLastSavedAt(new Date());
      toast.success('Assessment saved successfully');
    } catch (e: any) {
      const errorMsg = e?.message || 'Failed to save assessment';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsSaving(false);
    }
  }, [assessmentId, answers, framework, assessment?.completion_percent, isSaving]);

  // Keyboard shortcuts: Ctrl+S / Cmd+S to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleManualSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleManualSave]);

  const title = assessment?.name || 'Assessment';
  const status = assessment?.status || 'DRAFT';

  const headerMeta = useMemo(() => {
    const parts: string[] = [];
    if (framework) parts.push(framework.toUpperCase());
    parts.push(status);
    const completionPercent =
      framework === 'drd' ? calcDrdCompletionPercent(answers?.drd || {}) : assessment?.completion_percent ?? 0;
    if (completionPercent > 0) parts.push(`${completionPercent}% complete`);
    return parts.join(' · ');
  }, [framework, status, answers, assessment?.completion_percent]);

  const overallProgress = useMemo(() => {
    if (framework === 'drd') {
      return calcDrdCompletionPercent(answers?.drd || {});
    }
    return assessment?.completion_percent ?? 0;
  }, [framework, answers, assessment?.completion_percent]);

  if (!assessmentId || !framework) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-navy-950">
        <div className="text-center text-slate-500 dark:text-slate-400">
          Invalid assessment URL.
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-navy-950">
        <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading assessment…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-navy-950">
        <div className="max-w-md text-center">
          <div className="text-rose-500 font-medium mb-2">{error}</div>
          <button
            onClick={() => navigate('/assessment/overview')}
            className="px-4 py-2 rounded-lg bg-navy-900 text-white hover:bg-navy-800 transition-colors"
          >
            Back to Assessment
          </button>
        </div>
      </div>
    );
  }

  const renderEditor = () => {
    if (framework === 'drd') {
      const drdData: DRDFormData = answers?.drd || {};
      return (
        <DRDAssessmentEditor
          assessmentId={assessmentId}
          value={drdData}
          onChange={(next) => {
            const nextAnswers = { ...answers, drd: next };
            setAnswers(nextAnswers);
            scheduleSave(nextAnswers, calcDrdCompletionPercent(next));
          }}
          currentAxisId={currentAxisId}
          onAxisChange={setCurrentAxisId}
        />
      );
    }

    if (framework === 'siri') {
      const siriData: SIRIFormData = answers?.siri || {};
      return (
        <SIRIForm
          data={siriData}
          onChange={(next) => {
            const nextAnswers = { ...answers, siri: next };
            setAnswers(nextAnswers);
            // TODO: add a real completion% heuristic for SIRI
            scheduleSave(nextAnswers, assessment?.completion_percent ?? 0);
          }}
          showProgress={true}
        />
      );
    }

    return (
      <div className="p-6">
        <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-6">
          <div className="text-slate-600 dark:text-slate-300 font-medium mb-1">
            Editor not available yet
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            Framework: {framework.toUpperCase()}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-navy-950">
      {/* Top Header */}
      <div className="flex flex-col border-b border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900">
        {/* Title Bar */}
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate('/assessment/overview')}
              className="p-2 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg transition-colors"
              aria-label="Back to Assessment"
            >
              <ArrowLeft className="w-5 h-5 text-slate-500" />
            </button>
            <div className="min-w-0 flex-1">
              <div className="truncate text-lg font-semibold text-navy-900 dark:text-white">
                {title}
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400">{headerMeta}</div>
              {overallProgress > 0 && (
                <div className="mt-2 w-full max-w-xs">
                  <div className="h-1.5 bg-slate-200 dark:bg-navy-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500 transition-all duration-300"
                      style={{ width: `${overallProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              {isSaving ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Saving…</span>
                </>
              ) : lastSavedAt ? (
                <>
                  <Check className="w-3 h-3 text-green-500" />
                  <span>Saved {lastSavedAt.toLocaleTimeString()}</span>
                </>
              ) : null}
            </div>
            <button
              onClick={handleManualSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-purple-300 text-white text-sm font-medium rounded-lg transition-colors"
              title="Save (Ctrl+S / Cmd+S)"
            >
              <Save className="w-4 h-4" />
              <span className="hidden sm:inline">Save</span>
            </button>
          </div>
        </div>

        {/* Axis Navigation (DRD only) */}
        {framework === 'drd' && (
          <div className="px-6 pb-2 border-t border-slate-200 dark:border-navy-800">
            <div className="flex items-center gap-1 overflow-x-auto py-2 scrollbar-hide">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider shrink-0 mr-2">
                Axes:
              </span>
              {DRD_STRUCTURE.map((axis) => {
                const progress = calcAxisProgress(answers?.drd || {}, axis.id);
                const isActive = currentAxisId === axis.id;
                return (
                  <button
                    key={axis.id}
                    onClick={() => setCurrentAxisId(axis.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors border shrink-0 flex items-center gap-2 ${
                      isActive
                        ? 'bg-purple-500 border-purple-500 text-white shadow-sm'
                        : 'bg-white dark:bg-navy-900 border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800'
                    }`}
                    title={`${axis.name} - ${progress.completed}/${progress.total} areas completed`}
                  >
                    <span>
                      {axis.id}. {axis.name}
                    </span>
                    {progress.total > 0 && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          isActive
                            ? 'bg-white/20 text-white'
                            : 'bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {progress.completed}/{progress.total}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto">{renderEditor()}</div>
    </div>
  );
};

export default AssessmentSessionEditorView;
