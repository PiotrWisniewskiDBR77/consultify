import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  Circle,
  Clock,
  Rocket,
  XCircle,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Playbook, PlaybookStep, useHelp } from '../../contexts/HelpContext';
import { useAppStore } from '../../store/useAppStore';
import { AppView } from '../../types';

const AUTOSTART_KEY = 'consultify_onboarding_autostart_playbook';

function formatMinutes(total: number): string {
  if (!Number.isFinite(total) || total <= 0) return '';
  if (total < 60) return `${Math.round(total)} min`;
  const h = Math.floor(total / 60);
  const m = Math.round(total % 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

function getStepCtaLabelKey(step: PlaybookStep): string {
  const labelKey = step?.actionPayload?.labelKey;
  if (typeof labelKey === 'string' && labelKey) return labelKey;
  return 'help.onboarding.cta.tryItNow';
}

export const OnboardingPlaybooksPanel: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const { t } = useTranslation();
  const { playbooks, loading, logEvent, getPlaybook, refresh } = useHelp();
  const setCurrentView = useAppStore((s) => s.setCurrentView);

  const [selected, setSelected] = useState<Playbook | null>(null);
  const [stepIndex, setStepIndex] = useState(0);

  const published = useMemo(
    () => (playbooks || []).filter((p) => p.isActive !== false),
    [playbooks]
  );

  const recommended = useMemo(
    () => published.filter((p) => p.isRecommended && p.status !== 'DISMISSED'),
    [published]
  );

  const others = useMemo(
    () =>
      published.filter(
        (p) => !p.isRecommended && p.status !== 'DISMISSED' && p.status !== 'COMPLETED'
      ),
    [published]
  );

  const completed = useMemo(() => published.filter((p) => p.status === 'COMPLETED'), [published]);

  const totalTime = useMemo(() => {
    if (!selected?.steps?.length) return 0;
    return selected.steps.reduce(
      (acc: number, s: any) => acc + Number(s.expectedTimeMinutes || 0),
      0
    );
  }, [selected]);

  const openPlaybook = async (p: Playbook) => {
    await logEvent(p.key, 'VIEWED');
    const full = await getPlaybook(p.key);
    if (!full) return;
    setSelected(full);
    const resume = Number((full as any).resumeStepIndex || 0);
    setStepIndex(Number.isFinite(resume) ? resume : 0);
    await logEvent(p.key, 'STARTED');
    await refresh();
  };

  const handleDismiss = async (p: Playbook) => {
    await logEvent(p.key, 'DISMISSED');
    await refresh();
  };

  const currentStep: PlaybookStep | null =
    selected?.steps && selected.steps[stepIndex] ? selected.steps[stepIndex] : null;

  const handleStepAction = async (step: PlaybookStep) => {
    await logEvent(selected?.key || 'unknown', 'STEP_CTA_CLICKED', {
      stepId: step.id,
      action: step.actionPayload || {},
    });

    const kind = step?.actionPayload?.kind;
    if (kind === 'view' && typeof step.actionPayload?.view === 'string') {
      setCurrentView(step.actionPayload.view as AppView);
      onClose?.();
    }
  };

  const handleNext = async () => {
    if (!selected?.steps?.length || !currentStep) return;

    await logEvent(selected.key, 'STEP_COMPLETED', {
      stepId: currentStep.id,
      stepOrder: currentStep.stepOrder,
    });

    if (stepIndex < selected.steps.length - 1) {
      setStepIndex((v) => v + 1);
      return;
    }

    await logEvent(selected.key, 'COMPLETED');
    await refresh();
    setSelected(null);
    setStepIndex(0);
  };

  const handlePrev = () => setStepIndex((v) => Math.max(0, v - 1));

  // Auto-start from CTA (one-shot)
  useEffect(() => {
    const key = localStorage.getItem(AUTOSTART_KEY);
    if (!key) return;
    const p = published.find((pb) => pb.key === key);
    if (!p) return;
    localStorage.removeItem(AUTOSTART_KEY);
    openPlaybook(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [published.length]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  if (selected && selected.steps?.length && currentStep) {
    const total = selected.steps.length;
    const pct = Math.round(((stepIndex + 1) / total) * 100);

    return (
      <div className="space-y-4">
        <button
          onClick={() => {
            setSelected(null);
            setStepIndex(0);
          }}
          className="text-xs text-slate-500 hover:text-primary-600 dark:text-slate-400 dark:hover:text-primary-400 flex items-center gap-1"
        >
          <ChevronLeft size={14} />
          {t('help.onboarding.back', 'Back to playbooks')}
        </button>

        <div className="space-y-1">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            {t(selected.title, selected.key)}
          </h3>
          {selected.description && (
            <p className="text-sm text-slate-600 dark:text-slate-300">{t(selected.description)}</p>
          )}
          {totalTime > 0 && (
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 pt-1">
              <Clock size={14} className="text-primary-500" />
              <span>
                {t('help.onboarding.totalTime', 'Expected time')}: {formatMinutes(totalTime)}
              </span>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
          {/* Steps map (resume + status) */}
          <div className="space-y-1 mb-4">
            {selected.steps.map((s: any, idx: number) => {
              const st =
                s.status ||
                (idx < stepIndex ? 'DONE' : idx === stepIndex ? 'IN_PROGRESS' : 'NOT_STARTED');
              return (
                <button
                  key={s.id || idx}
                  onClick={() => setStepIndex(idx)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors ${
                    idx === stepIndex
                      ? 'bg-primary-50 dark:bg-primary-900/20'
                      : 'hover:bg-slate-50 dark:hover:bg-white/5'
                  }`}
                >
                  {st === 'DONE' ? (
                    <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" />
                  ) : st === 'IN_PROGRESS' ? (
                    <Circle size={16} className="text-primary-500 fill-current flex-shrink-0" />
                  ) : (
                    <Circle
                      size={16}
                      className="text-slate-300 dark:text-slate-600 flex-shrink-0"
                    />
                  )}
                  <span className="text-xs text-slate-700 dark:text-slate-200 truncate">
                    {String(t(s.title, s.id || String(idx + 1)))}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {t('help.onboarding.stepProgress', 'Step {{current}} of {{total}}', {
                  current: stepIndex + 1,
                  total,
                })}
              </div>
              <div className="h-1.5 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden mt-1">
                <div
                  className="h-full bg-primary-500 rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
            <div className="text-xs font-semibold text-primary-600 dark:text-primary-400">
              {pct}%
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
              {t(currentStep.title, currentStep.id)}
            </h4>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {t(currentStep.contentMd, '')}
            </p>

            <div className="grid grid-cols-1 gap-2 pt-1">
              {currentStep.whatYouGet && (
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-800">
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    {t('help.onboarding.whatYouGet', "What you'll get")}
                  </div>
                  <div className="text-sm text-slate-700 dark:text-slate-200 mt-1">
                    {t(currentStep.whatYouGet)}
                  </div>
                </div>
              )}
              {Number(currentStep.expectedTimeMinutes || 0) > 0 && (
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <Clock size={14} className="text-slate-400" />
                  <span>
                    {t('help.onboarding.expectedTime', 'Expected time')}:{' '}
                    {formatMinutes(Number(currentStep.expectedTimeMinutes))}
                  </span>
                </div>
              )}
            </div>

            {currentStep.actionType === 'CTA' && (
              <button
                onClick={() => handleStepAction(currentStep)}
                className="w-full mt-2 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition-colors"
              >
                {t(getStepCtaLabelKey(currentStep), 'Try it now')}
                <ArrowRight size={16} />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-200 dark:border-navy-700">
            <button
              onClick={handlePrev}
              disabled={stepIndex === 0}
              className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t('help.onboarding.previous', 'Previous')}
            </button>
            <button
              onClick={handleNext}
              className="inline-flex items-center gap-2 text-xs font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
            >
              {stepIndex === total - 1
                ? t('help.onboarding.finish', 'Finish')
                : t('help.onboarding.next', 'Next')}
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const Card: React.FC<{ p: Playbook }> = ({ p }) => {
    const status =
      p.status === 'COMPLETED'
        ? {
            labelKey: 'help.onboarding.status.completed',
            cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
          }
        : p.status === 'IN_PROGRESS'
          ? {
              labelKey: 'help.onboarding.status.inProgress',
              cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
            }
          : {
              labelKey: 'help.onboarding.status.available',
              cls: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300',
            };

    return (
      <div className="group relative bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-4 hover:border-primary-300 dark:hover:border-primary-700 transition-colors">
        <button onClick={() => openPlaybook(p)} className="w-full text-left">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
              <Rocket size={18} className="text-primary-600 dark:text-primary-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  {t(p.title, p.key)}
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${status.cls}`}
                >
                  {t(status.labelKey, p.status)}
                </span>
              </div>
              {p.description && (
                <div className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed line-clamp-2">
                  {t(p.description)}
                </div>
              )}
              {p.recommendationReason && (
                <div className="text-xs text-primary-600 dark:text-primary-400 mt-1 font-medium">
                  {t(p.recommendationReason)}
                </div>
              )}
            </div>
          </div>
        </button>

        {p.status !== 'COMPLETED' && (
          <button
            onClick={() => handleDismiss(p)}
            className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5"
            title={t('help.onboarding.dismiss', 'Dismiss')}
            aria-label={t('help.onboarding.dismiss', 'Dismiss')}
          >
            <XCircle size={16} className="text-slate-400 hover:text-rose-500" />
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
          {t('help.onboarding.title', 'Onboarding playbooks')}
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          {t(
            'help.onboarding.subtitle',
            'Choose a path and move fast — each step is short, concrete, and linked to the right place in the app.'
          )}
        </p>
      </div>

      {recommended.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            <CheckCircle2 size={14} className="text-primary-500" />
            {t('help.onboarding.recommended', 'Recommended')}
          </div>
          <div className="space-y-3">
            {recommended.map((p) => (
              <Card key={p.key} p={p} />
            ))}
          </div>
        </div>
      )}

      {others.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            <Clock size={14} className="text-slate-400" />
            {t('help.onboarding.morePaths', 'More paths')}
          </div>
          <div className="space-y-3">
            {others.map((p) => (
              <Card key={p.key} p={p} />
            ))}
          </div>
        </div>
      )}

      {completed.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            {t('help.onboarding.completed', 'Completed')}
          </div>
          <div className="space-y-3 opacity-80">
            {completed.map((p) => (
              <Card key={p.key} p={p} />
            ))}
          </div>
        </div>
      )}

      {published.length === 0 && (
        <div className="text-center py-8">
          <Rocket size={28} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
          <div className="text-sm text-slate-600 dark:text-slate-300">
            {t('help.onboarding.empty', 'No onboarding playbooks available yet.')}
          </div>
        </div>
      )}
    </div>
  );
};

export default OnboardingPlaybooksPanel;
