import { ArrowLeft, Loader2 } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { DRDAssessmentEditor } from '@/components/assessment/drd/DRDAssessmentEditor';
import { SIRIForm } from '@/components/assessment/tools/SIRIForm';
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

export const AssessmentSessionEditorView: React.FC = () => {
  const navigate = useNavigate();
  const { framework: frameworkParam, assessmentId } = useParams();

  const framework = (frameworkParam?.toLowerCase() as SupportedFramework | undefined) || undefined;

  const [assessment, setAssessment] = useState<AssessmentSession | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

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
        } catch (e) {
          // keep UI responsive; we show error only on next reload
        } finally {
          if (!isMountedRef.current) return;
          setIsSaving(false);
        }
      }, 600);
    },
    [assessmentId, assessment?.completion_percent]
  );

  const title = assessment?.name || 'Assessment';
  const status = assessment?.status || 'DRAFT';

  const headerMeta = useMemo(() => {
    const parts: string[] = [];
    if (framework) parts.push(framework.toUpperCase());
    parts.push(status);
    return parts.join(' · ');
  }, [framework, status]);

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
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate('/assessment/overview')}
            className="p-2 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg transition-colors"
            aria-label="Back to Assessment"
          >
            <ArrowLeft className="w-5 h-5 text-slate-500" />
          </button>
          <div className="min-w-0">
            <div className="truncate text-lg font-semibold text-navy-900 dark:text-white">
              {title}
            </div>
            <div className="text-sm text-slate-500 dark:text-slate-400">{headerMeta}</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {isSaving ? 'Saving…' : lastSavedAt ? `Saved ${lastSavedAt.toLocaleTimeString()}` : ' '}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">{renderEditor()}</div>
    </div>
  );
};

export default AssessmentSessionEditorView;
