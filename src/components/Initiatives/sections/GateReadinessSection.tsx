/**
 * GateReadinessSection
 *
 * Gate approval workflow with readiness checks.
 * Extracted from InitiativeDocumentView.
 */

import { motion } from 'framer-motion';
import { Check, CheckCircle2, Clock, Flag, Loader2, Send, Sparkles, User, X } from 'lucide-react';
import React, { useCallback, useMemo } from 'react';

import { getStatusMeta } from '@/services/initiativeLifecycle';

import { CollapsibleSection } from './CollapsibleSection';
import { useInitiativeContext } from './InitiativeContext';
import { InitiativeGatesWorkflowTable } from './InitiativeGatesWorkflowTable';
import type { InitiativeSectionProps } from './types';
import { GATE_CONFIG, GATE_DEFINITIONS, getNextGateForStatus, getRoleLabel } from './types';

export const GateReadinessSection: React.FC<InitiativeSectionProps> = ({
  sectionType,
  expanded,
  onToggle,
}) => {
  const {
    initiative,
    decisions,
    raidItems,
    tasks,
    stakeholders,
    summary,
    description,
    ownerId,
    sponsorId,
    targetDate,
    users,
    pendingApprovals,
    isPolish,
    isGeneratingAI,
    handleGenerateAI,
    handleRequestApproval,
    isMutating,
  } = useInitiativeContext();

  const status = (initiative?.status || 'DRAFT') as string;
  const nextGate = getNextGateForStatus(status);
  const nextGateConfig = nextGate ? GATE_CONFIG[nextGate] : null;
  const canRequestApproval =
    nextGateConfig && !pendingApprovals.some((a) => a.gateType === nextGate);

  const requiredGates = useMemo(
    () => GATE_DEFINITIONS.filter((g) => g.forStatus === status),
    [status]
  );

  const getGateStatus = useCallback(
    (pmoDomain: string) => {
      const match = decisions.find((d) => d.type === pmoDomain);
      if (!match) return 'MISSING';
      return match.status;
    },
    [decisions]
  );

  const getUserDisplayName = useCallback(
    (userId: string) => {
      const u = users.find((x) => x.id === userId);
      if (!u) return userId;
      const full = `${u.firstName} ${u.lastName}`.trim();
      return full || u.email || userId;
    },
    [users]
  );

  const checkRequirement = useCallback(
    (req: string) => {
      switch (req) {
        case 'title':
          return !!initiative?.name;
        case 'problem':
          return !!summary;
        case 'owner':
          return !!ownerId;
        case 'sponsor':
          return !!sponsorId;
        case 'timeline':
          return !!targetDate;
        case 'team':
          return stakeholders.length > 0;
        case 'risks':
          return raidItems.some((r) => r.type === 'risk');
        case 'objective':
          return !!summary;
        case 'scope':
          return !!description;
        case 'capacity':
          return true;
        case 'dependencies':
          return true;
        case 'all_tasks_done':
          return tasks.every((t) => t.status === 'DONE');
        default:
          return false;
      }
    },
    [
      initiative,
      summary,
      ownerId,
      sponsorId,
      targetDate,
      stakeholders,
      raidItems,
      description,
      tasks,
    ]
  );

  const readinessPercent = useMemo(() => {
    if (!nextGateConfig) return 0;
    const metCount = nextGateConfig.requirements.filter(checkRequirement).length;
    return Math.round((metCount / nextGateConfig.requirements.length) * 100);
  }, [nextGateConfig, checkRequirement]);

  const reqLabels: Record<string, { en: string; pl: string }> = {
    title: { en: 'Title defined', pl: 'Tytuł zdefiniowany' },
    problem: { en: 'Problem statement', pl: 'Opis problemu' },
    owner: { en: 'Owner assigned', pl: 'Właściciel przypisany' },
    sponsor: { en: 'Sponsor assigned', pl: 'Sponsor przypisany' },
    timeline: { en: 'Timeline set', pl: 'Harmonogram ustalony' },
    team: { en: 'Team assigned', pl: 'Zespół przypisany' },
    risks: { en: 'Risks identified', pl: 'Ryzyka zidentyfikowane' },
    objective: { en: 'Objective defined', pl: 'Cel zdefiniowany' },
    scope: { en: 'Scope defined', pl: 'Zakres zdefiniowany' },
    capacity: { en: 'Capacity confirmed', pl: 'Zasoby potwierdzone' },
    dependencies: { en: 'Dependencies mapped', pl: 'Zależności zmapowane' },
    all_tasks_done: { en: 'All tasks done', pl: 'Wszystkie zadania ukończone' },
    delivery_confirmed: { en: 'Delivery confirmed', pl: 'Dostawa potwierdzona' },
    baseline_kpis: { en: 'Baseline KPIs', pl: 'Bazowe KPI' },
    tracking_period: { en: 'Tracking period', pl: 'Okres śledzenia' },
    blocked_reason: { en: 'Block reason', pl: 'Powód blokady' },
    impact_assessment: { en: 'Impact assessment', pl: 'Ocena wpływu' },
    resolution_decision: { en: 'Resolution decision', pl: 'Decyzja o rozwiązaniu' },
    updated_timeline: { en: 'Updated timeline', pl: 'Zaktualizowany harmonogram' },
  };

  return (
    <CollapsibleSection
      id="gateReadiness"
      title={isPolish ? 'Gotowość bramki i harmonogram' : 'Gate Readiness & Timeline'}
      icon={<Flag size={18} className="text-indigo-500 dark:text-indigo-400" />}
      iconBg="bg-gradient-to-br from-indigo-500/10 to-violet-500/10 dark:from-indigo-500/20 dark:to-violet-500/20"
      expanded={expanded}
      onToggle={onToggle}
      badge={
        <div className="flex items-center gap-2">
          {nextGate && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
              {isPolish ? 'Następna' : 'Next'}: {nextGate}
            </span>
          )}
          {requiredGates.length > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400">
              {requiredGates.filter((g) => getGateStatus(g.pmoDomain) === 'APPROVED').length}/
              {requiredGates.length}
            </span>
          )}
        </div>
      }
      actions={
        <div className="flex items-center gap-2">
          {nextGateConfig && canRequestApproval && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={(e) => {
                e.stopPropagation();
                handleRequestApproval(
                  nextGateConfig.requiredRole === 'owner' ? 'owner' : 'sponsor',
                  nextGate!
                );
              }}
              disabled={isMutating}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-300/60 dark:border-navy-600 text-slate-500 hover:text-primary-500 hover:border-primary-400/50 text-xs font-medium transition-colors disabled:opacity-50"
            >
              <Send size={14} />
              <span>{isPolish ? 'Wyślij' : 'Request'}</span>
            </motion.button>
          )}
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={(e) => {
              e.stopPropagation();
              handleGenerateAI('gates');
            }}
            disabled={isGeneratingAI === 'gates'}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-violet-400/50 text-violet-600 dark:text-violet-400 hover:bg-violet-500/10 text-xs font-medium transition-colors disabled:opacity-50"
          >
            {isGeneratingAI === 'gates' ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Sparkles size={14} />
            )}
            <span>AI</span>
          </motion.button>
        </div>
      }
    >
      {/* Full lifecycle gate workflow table (13 stages) */}
      <div className="mb-6">
        <InitiativeGatesWorkflowTable />
      </div>

      {/* Gate Timeline Visual */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
            {isPolish ? 'Przebieg bramek' : 'Gate Timeline'}
          </span>
        </div>
        <div className="relative">
          <div className="absolute top-4 left-0 right-0 h-1 bg-slate-200 dark:bg-navy-700 rounded-full" />
          <div
            className="absolute top-4 left-0 h-1 bg-gradient-to-r from-emerald-500 to-purple-500 rounded-full transition-all duration-500"
            style={{
              width: `${(() => {
                const gateOrder = ['PROMOTE', 'APPROVE', 'SCHEDULE', 'COMPLETE', 'START_TRACKING'];
                const currentIdx = nextGate ? gateOrder.indexOf(nextGate) : gateOrder.length;
                return Math.max(0, (currentIdx / gateOrder.length) * 100);
              })()}%`,
            }}
          />
          <div className="relative flex justify-between">
            {Object.entries(GATE_CONFIG)
              .filter(([key]) => !['BLOCK', 'UNBLOCK'].includes(key))
              .map(([key, config], idx, arr) => {
                const gateOrder = ['PROMOTE', 'APPROVE', 'SCHEDULE', 'COMPLETE', 'START_TRACKING'];
                const currentIdx = nextGate ? gateOrder.indexOf(nextGate) : gateOrder.length;
                const isPast = gateOrder.indexOf(key) < currentIdx;
                const isCurrent = key === nextGate;

                return (
                  <div
                    key={key}
                    className="flex flex-col items-center"
                    style={{ width: `${100 / arr.length}%` }}
                  >
                    <motion.div
                      initial={{ scale: 0.8 }}
                      animate={{ scale: isCurrent ? 1.2 : 1 }}
                      className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                        isPast
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : isCurrent
                            ? 'bg-purple-500 border-purple-500 text-white shadow-lg shadow-purple-500/40'
                            : 'bg-white dark:bg-navy-800 border-slate-300 dark:border-navy-600 text-slate-400'
                      }`}
                    >
                      {isPast ? (
                        <Check size={14} />
                      ) : isCurrent ? (
                        <Flag size={14} />
                      ) : (
                        <span className="text-xs font-bold">{idx + 1}</span>
                      )}
                    </motion.div>
                    <div className={`mt-2 text-center ${isCurrent ? 'font-semibold' : ''}`}>
                      <p
                        className={`text-[10px] ${isPast ? 'text-emerald-500' : isCurrent ? 'text-purple-500' : 'text-slate-400'}`}
                      >
                        {isPolish ? config.namePl.split(' ')[0] : config.name.split(' ')[0]}
                      </p>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Current Gate Details */}
      {nextGateConfig && (
        <div className="mb-4 p-4 rounded-xl bg-slate-50/60 dark:bg-navy-800/40 border border-slate-200/60 dark:border-navy-700/60">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <Flag size={16} className="text-purple-500" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  {isPolish ? 'Aktualna bramka' : 'Current Gate'}:{' '}
                  {isPolish ? nextGateConfig.namePl : nextGateConfig.name}
                </h4>
                <p className="text-xs text-slate-500">
                  {isPolish ? nextGateConfig.descriptionPl : nextGateConfig.description}
                </p>
              </div>
            </div>
          </div>

          {/* Requirements Checklist */}
          <div className="space-y-2 mb-4">
            <span className="text-[10px] font-semibold text-slate-500 uppercase">
              {isPolish ? 'Lista kontrolna wymagań' : 'Requirements Checklist'}
            </span>
            <div className="grid grid-cols-2 gap-2">
              {nextGateConfig.requirements.map((req) => {
                const hasReq = checkRequirement(req);
                return (
                  <div
                    key={req}
                    className={`flex items-center gap-2 p-2 rounded-lg ${
                      hasReq
                        ? 'bg-emerald-500/10 border border-emerald-500/20'
                        : 'bg-slate-100 dark:bg-navy-800 border border-slate-200 dark:border-navy-700'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center ${hasReq ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-navy-600'}`}
                    >
                      {hasReq ? (
                        <Check size={12} className="text-white" />
                      ) : (
                        <X size={12} className="text-white" />
                      )}
                    </div>
                    <span
                      className={`text-xs ${hasReq ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}
                    >
                      {isPolish ? reqLabels[req]?.pl : reqLabels[req]?.en || req}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Readiness Score */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-500">{isPolish ? 'Gotowość' : 'Readiness'}</span>
              <span className="text-xs font-semibold text-purple-500">{readinessPercent}%</span>
            </div>
            <div className="h-2 bg-slate-200 dark:bg-navy-700 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${readinessPercent}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full"
              />
            </div>
          </div>

          {/* Approver Info */}
          <div className="flex items-center justify-between p-2 rounded-lg bg-white/50 dark:bg-navy-900/50 border border-slate-200/50 dark:border-navy-700/50">
            <div className="flex items-center gap-2">
              <User size={14} className="text-slate-400" />
              <span className="text-xs text-slate-500">
                {isPolish ? 'Wymagana aprobata' : 'Required approval'}:
              </span>
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                {getRoleLabel(nextGateConfig.requiredRole, isPolish)}
              </span>
            </div>
            {nextGateConfig.requiredRole === 'sponsor' && sponsorId && (
              <span className="text-xs text-purple-500">{getUserDisplayName(sponsorId)}</span>
            )}
            {nextGateConfig.requiredRole === 'owner' && ownerId && (
              <span className="text-xs text-purple-500">{getUserDisplayName(ownerId)}</span>
            )}
          </div>
        </div>
      )}

      {/* All Gates Status */}
      {requiredGates.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase block mb-2">
            {isPolish ? 'Wymagane zatwierdzenia dla statusu' : 'Required approvals for status'}
          </span>
          {requiredGates.map((g) => {
            const gs = getGateStatus(g.pmoDomain);
            const ok = gs === 'APPROVED';
            return (
              <div
                key={g.id}
                className="flex items-center justify-between p-3 rounded-lg bg-slate-50/50 dark:bg-navy-800/50 border border-slate-200/50 dark:border-navy-700/50"
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center ${ok ? 'bg-emerald-500' : gs === 'PENDING' ? 'bg-amber-500' : 'bg-slate-300 dark:bg-navy-600'}`}
                  >
                    {ok ? (
                      <Check size={12} className="text-white" />
                    ) : gs === 'PENDING' ? (
                      <Clock size={12} className="text-white" />
                    ) : (
                      <X size={12} className="text-white" />
                    )}
                  </div>
                  <span className="text-sm text-slate-700 dark:text-slate-300">{g.label}</span>
                </div>
                <span
                  className={`px-2 py-0.5 text-[10px] font-medium rounded ${ok ? 'bg-emerald-500/20 text-emerald-400' : gs === 'PENDING' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-500/20 text-slate-400'}`}
                >
                  {gs === 'MISSING' ? (isPolish ? 'Nie zgłoszono' : 'Not requested') : gs}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {!nextGateConfig && requiredGates.length === 0 && (
        <div className="text-center py-6 border-2 border-dashed border-slate-200 dark:border-navy-700 rounded-xl">
          <CheckCircle2 size={24} className="mx-auto mb-2 text-emerald-500" />
          <p className="text-sm text-slate-500">
            {isPolish ? 'Wszystkie bramki przejdzone!' : 'All gates passed!'}
          </p>
        </div>
      )}
    </CollapsibleSection>
  );
};
