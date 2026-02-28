import {
  AlarmClockOff,
  Bell,
  Calendar,
  Check,
  ChevronDown,
  Clock,
  Copy,
  ExternalLink,
  Loader2,
  MessageSquare,
  MoreVertical,
  Sparkles,
  TrendingUp,
  UserPlus,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { PreviewPaneShell } from '@/components/ui/ResizableTable';
import { Api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';

import { DelegationModal } from './shared/DelegationModal';

export type DecisionPreviewMode = 'my' | 'requests_pending' | 'all';

export type DecisionSnoozePreset = '1h' | '4h' | 'tomorrow' | 'week';

export interface DecisionPreviewData {
  id: string;
  title: string;
  description?: string | null;
  status?: string | null;
  priority?: string | null;
  dueDate?: string | null;
  createdAt?: string | null;
  deciderId?: string | null;
  decisionOwnerId?: string | null;
  ownerName?: string | null;
  requestedById?: string | null;
  requestedByName?: string | null;
  projectName?: string | null;
  decisionType?: string | null;
  type?: string | null;
  linkedItems?: Array<{ id: string; type: string; title?: string; linkRelation?: string }>;
}

export interface DecisionBrief {
  decisionId: string;
  summary: string;
  recommendation: string;
  urgency: 'urgent' | 'normal';
  category?: string | null;
  createdAt?: string | null;
  dueDate?: string | null;
}

export interface DecisionPreviewPanelProps {
  decisionId: string | null;
  mode: DecisionPreviewMode;
  onClose: () => void;
  onOpenFullDetail: (decisionId: string, decisionData?: any) => void;
  onDidMutate?: () => void;
}

const formatShortDate = (iso?: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const defaultRationaleFor = (status: 'approved' | 'rejected') =>
  status === 'approved' ? 'Approved' : 'Rejected';

function clampText(s: string, max = 220): string {
  const t = String(s || '').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function labelForSnoozePreset(p: DecisionSnoozePreset, isPolish: boolean) {
  const map: Record<DecisionSnoozePreset, { pl: string; en: string }> = {
    '1h': { pl: 'Za 1h', en: '1 hour' },
    '4h': { pl: 'Za 4h', en: '4 hours' },
    tomorrow: { pl: 'Jutro (9:00)', en: 'Tomorrow (9:00)' },
    week: { pl: 'Za tydzień', en: 'Next week' },
  };
  return isPolish ? map[p].pl : map[p].en;
}

function relationTone(type: string) {
  const t = String(type || '').toLowerCase();
  if (t === 'task') return 'text-blue-600 dark:text-blue-300';
  if (t === 'initiative') return 'text-amber-700 dark:text-amber-300';
  if (t === 'decision') return 'text-purple-700 dark:text-purple-300';
  return 'text-slate-700 dark:text-slate-200';
}

type DecisionAiIntent = 'summarize_context' | 'propose_options' | 'assess_risk';

async function runDecisionAi({
  intent,
  isPolish,
  decision,
}: {
  intent: DecisionAiIntent;
  isPolish: boolean;
  decision: DecisionPreviewData;
}): Promise<string> {
  const language = isPolish ? 'pl' : 'en';
  const intentLabel =
    intent === 'summarize_context'
      ? isPolish
        ? 'Podsumuj kontekst'
        : 'Summarize context'
      : intent === 'propose_options'
        ? isPolish
          ? 'Zaproponuj opcje'
          : 'Propose options'
        : isPolish
          ? 'Oceń ryzyko'
          : 'Assess risk';

  const systemInstruction = [
    `You are a senior PMO decision advisor.`,
    `Output language MUST be ${language === 'pl' ? 'Polish' : 'English'}.`,
    `Do NOT invent facts. Use only provided decision fields.`,
    `Return plain text. No markdown. Keep it concise (3-6 short sentences or bullets).`,
    `Intent: ${intentLabel}`,
  ].join('\n');

  const seed = [
    `[GENERATE FROM SCRATCH]`,
    `Decision: ${decision.title || 'Decision'}`,
    `Type: ${decision.decisionType || decision.type || ''}`,
    `Project: ${decision.projectName || ''}`,
    `Status: ${decision.status || ''}`,
    `Priority: ${decision.priority || ''}`,
    `Due date: ${decision.dueDate || ''}`,
    `Description: ${String(decision.description || '').trim()}`,
  ]
    .filter(Boolean)
    .join('\n');

  const resp = await Api.post('/ai/refine-text?timeoutMs=20000', {
    text: seed,
    mode: 'generate',
    systemInstruction,
    fieldLabel: 'Decision preview AI',
    artifactContext: {
      id: decision.id,
      title: decision.title,
      type: 'decision',
      status: decision.status || 'pending',
      priority: decision.priority || 'medium',
    },
    language,
  });

  return String((resp as any)?.text || '').trim();
}

export const DecisionPreviewBody: React.FC<{
  decision: DecisionPreviewData | null;
  brief: DecisionBrief | null;
  isPolish: boolean;
  detailsOverride: string | null;
  detailsLoading: boolean;
  detailsMenuOpen: boolean;
  onToggleDetailsMenu: () => void;
  onCloseDetailsMenu: () => void;
  onDetailsAction: (action: 'expand' | 'summarize' | 'copy') => void;
}> = ({
  decision,
  brief,
  isPolish,
  detailsOverride,
  detailsLoading,
  detailsMenuOpen,
  onToggleDetailsMenu,
  onCloseDetailsMenu,
  onDetailsAction,
}) => {
  const metaPillBase =
    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium';

  const urgencyPill =
    brief?.urgency === 'urgent'
      ? `${metaPillBase} bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300`
      : `${metaPillBase} bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300`;

  const status = String(decision?.status || 'PENDING').toUpperCase();
  const statusPill =
    status === 'APPROVED'
      ? `${metaPillBase} bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300`
      : status === 'REJECTED'
        ? `${metaPillBase} bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300`
        : status === 'DEFERRED'
          ? `${metaPillBase} bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300`
          : status === 'ESCALATED'
            ? `${metaPillBase} bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300`
            : `${metaPillBase} bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300`;

  const pri = String(decision?.priority || 'MEDIUM').toUpperCase();
  const priPill =
    pri === 'CRITICAL'
      ? `${metaPillBase} bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300`
      : pri === 'HIGH'
        ? `${metaPillBase} bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300`
        : `${metaPillBase} bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300`;

  const detailsText = detailsOverride ?? String(decision?.description || '').trim();

  return (
    <div className="space-y-4">
      {/* Brief/meta */}
      <div className="rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={statusPill}>{isPolish ? status : status[0] + status.slice(1).toLowerCase()}</span>
            <span className={priPill}>
              {isPolish
                ? pri === 'CRITICAL'
                  ? 'Krytyczne'
                  : pri === 'HIGH'
                    ? 'Wysoki'
                    : pri === 'MEDIUM'
                      ? 'Średni'
                      : 'Niski'
                : pri[0] + pri.slice(1).toLowerCase()}
            </span>
            {brief?.summary ? (
              <>
                <span className="text-slate-300 dark:text-navy-600">·</span>
                <span className={urgencyPill}>
                  {brief.urgency === 'urgent'
                    ? isPolish
                      ? 'Pilne'
                      : 'Urgent'
                    : isPolish
                      ? 'Normalne'
                      : 'Normal'}
                </span>
              </>
            ) : null}
            {decision?.projectName ? (
              <>
                <span className="text-slate-300 dark:text-navy-600">·</span>
                <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300 truncate">
                  {decision.projectName}
                </span>
              </>
            ) : null}
          </div>
          {decision?.dueDate ? (
            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              {formatShortDate(decision.dueDate) || ''}
            </span>
          ) : (
            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 italic">
              {isPolish ? 'Bez terminu' : 'No due date'}
            </span>
          )}
        </div>
        {brief?.recommendation ? (
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {clampText(brief.recommendation, 140)}
          </div>
        ) : null}
      </div>

      {/* Details */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {isPolish ? 'Szczegóły' : 'Details'}
          </div>
          <div className="relative">
            <button
              onClick={onToggleDetailsMenu}
              className="inline-flex items-center justify-center h-7 w-7 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors"
              aria-label={isPolish ? 'Opcje szczegółów' : 'Details options'}
              title={isPolish ? 'Opcje' : 'Options'}
            >
              <MoreVertical size={14} />
            </button>
            {detailsMenuOpen ? (
              <>
                <div className="fixed inset-0 z-40" onClick={onCloseDetailsMenu} />
                <div className="absolute right-0 top-full mt-1 z-50 min-w-[170px] rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-white dark:bg-navy-900 shadow-lg py-1 overflow-hidden">
                  <button
                    onClick={() => onDetailsAction('expand')}
                    disabled={detailsLoading}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.04] disabled:opacity-40 transition-colors"
                  >
                    <ChevronDown size={12} className="text-purple-500" />
                    {isPolish ? 'Rozwiń' : 'Expand'}
                  </button>
                  <button
                    onClick={() => onDetailsAction('summarize')}
                    disabled={detailsLoading}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.04] disabled:opacity-40 transition-colors"
                  >
                    <Sparkles size={12} className="text-purple-500" />
                    {isPolish ? 'Podsumuj' : 'Summarize'}
                  </button>
                  <div className="border-t border-slate-200/70 dark:border-white/[0.08]" />
                  <button
                    onClick={() => onDetailsAction('copy')}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors"
                  >
                    <Copy size={12} />
                    {isPolish ? 'Kopiuj' : 'Copy'}
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>

        <div className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
          {detailsLoading ? (
            <span className="text-slate-400 dark:text-slate-500">
              {isPolish ? 'Generowanie…' : 'Generating…'}
            </span>
          ) : detailsText ? (
            detailsText
          ) : (
            <span className="text-slate-500 dark:text-slate-400">
              {isPolish ? 'Brak opisu.' : 'No description.'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export const DecisionPreviewFooter: React.FC<{
  decision: DecisionPreviewData | null;
  mode: DecisionPreviewMode;
  canAct: boolean;
  isPolish: boolean;
  aiText: string | null;
  aiError: string | null;
  aiLoading: boolean;
  aiMenuOpen: boolean;
  onToggleAiMenu: () => void;
  onCloseAiMenu: () => void;
  onRunAi: (intent: DecisionAiIntent) => void;
  onCopyAi: () => void;
  onClearAi: () => void;
  onRegenerateAi: () => void;
  onApprove: () => void;
  onReject: () => void;
  onDelegate: () => void;
  onMoreInfo: () => void;
  onRemind: () => void;
  onEscalate: () => void;
  snoozeOpen: boolean;
  onToggleSnooze: () => void;
  onCloseSnooze: () => void;
  onSnooze: (preset: DecisionSnoozePreset) => void;
}> = ({
  decision,
  mode,
  canAct,
  isPolish,
  aiText,
  aiError,
  aiLoading,
  aiMenuOpen,
  onToggleAiMenu,
  onCloseAiMenu,
  onRunAi,
  onCopyAi,
  onClearAi,
  onRegenerateAi,
  onApprove,
  onReject,
  onDelegate,
  onMoreInfo,
  onRemind,
  onEscalate,
  snoozeOpen,
  onToggleSnooze,
  onCloseSnooze,
  onSnooze,
}) => {
  const footerPillBase =
    'inline-flex items-center justify-center gap-1.5 h-9 rounded-full border px-3 text-xs font-medium transition-colors duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900';
  const hintChip =
    'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[11px] font-medium border border-slate-200/70 dark:border-white/[0.08] bg-transparent text-slate-600 dark:text-slate-300 hover:bg-slate-100/50 dark:hover:bg-white/[0.04] transition-colors cursor-pointer active:scale-[0.98] disabled:opacity-40';

  const relations = (decision?.linkedItems || []).slice(0, 6);

  return (
    <div className="space-y-0">
      {/* AI hints */}
      <div className="rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-slate-50/60 dark:bg-white/[0.03] p-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
            <Sparkles size={12} />
            <span className="text-[10px] font-medium uppercase tracking-wider">AI</span>
          </div>
          <div className="relative">
            <button
              onClick={onToggleAiMenu}
              className="inline-flex items-center justify-center h-7 w-7 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors"
              aria-label={isPolish ? 'Opcje AI' : 'AI options'}
              title={isPolish ? 'Opcje' : 'Options'}
            >
              <MoreVertical size={14} />
            </button>
            {aiMenuOpen ? (
              <>
                <div className="fixed inset-0 z-40" onClick={onCloseAiMenu} />
                <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-white dark:bg-navy-900 shadow-lg py-1 overflow-hidden">
                  <button
                    onClick={onRegenerateAi}
                    className="w-full px-3 py-1.5 text-left text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.04]"
                  >
                    {isPolish ? 'Regeneruj' : 'Regenerate'}
                  </button>
                  <button
                    onClick={onCopyAi}
                    disabled={!aiText}
                    className="w-full px-3 py-1.5 text-left text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.04] disabled:opacity-40"
                  >
                    {isPolish ? 'Kopiuj' : 'Copy'}
                  </button>
                  <button
                    onClick={onClearAi}
                    disabled={!aiText && !aiError}
                    className="w-full px-3 py-1.5 text-left text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.04] disabled:opacity-40"
                  >
                    {isPolish ? 'Wyczyść' : 'Clear'}
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          <button
            className={hintChip}
            onClick={() => onRunAi('summarize_context')}
            disabled={aiLoading || !decision?.id}
          >
            {isPolish ? 'Podsumuj kontekst' : 'Summarize context'}
          </button>
          <button
            className={hintChip}
            onClick={() => onRunAi('propose_options')}
            disabled={aiLoading || !decision?.id}
          >
            {isPolish ? 'Zaproponuj opcje' : 'Propose options'}
          </button>
          <button
            className={hintChip}
            onClick={() => onRunAi('assess_risk')}
            disabled={aiLoading || !decision?.id}
          >
            {isPolish ? 'Oceń ryzyko' : 'Assess risk'}
          </button>
        </div>

        {aiLoading ? (
          <div className="mt-2 text-xs text-slate-400 dark:text-slate-500">
            {isPolish ? 'Analiza…' : 'Thinking…'}
          </div>
        ) : aiError ? (
          <div className="mt-2 text-xs text-red-600 dark:text-red-400">{aiError}</div>
        ) : aiText ? (
          <div className="mt-2 text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
            {aiText}
          </div>
        ) : null}
      </div>

      <div className="border-t border-slate-200/50 dark:border-white/[0.06] my-3" />

      {/* Relations (2 rows) */}
      <div className="min-h-[4.5rem]">
        <div className="flex flex-wrap gap-2 py-1">
          {relations.length > 0 ? (
            relations.map((r) => (
              <span
                key={`${r.type}:${r.id}`}
                className={`inline-flex items-center h-7 px-2.5 rounded-full text-[11px] font-medium border border-slate-200/70 dark:border-white/[0.08] bg-transparent ${relationTone(
                  r.type
                )}`}
                title={r.title || r.id}
              >
                {clampText(String(r.title || r.id), 42)}
              </span>
            ))
          ) : (
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {isPolish ? 'Brak powiązań' : 'No relations'}
            </span>
          )}
        </div>
      </div>

      <div className="border-t border-slate-200/50 dark:border-white/[0.06] my-3" />

      {/* Actions */}
      <div className="space-y-2.5 py-1">
        {canAct ? (
          <div className="flex gap-2">
            <button
              onClick={onApprove}
              className={`${footerPillBase} flex-1 border-emerald-300/40 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-200 hover:bg-emerald-100/70 dark:hover:bg-emerald-500/15`}
            >
              <Check size={14} />
              {isPolish ? 'Przyjęta' : 'Approve'}
            </button>
            <button
              onClick={onReject}
              className={`${footerPillBase} flex-1 border-red-300/40 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-200 hover:bg-red-100/70 dark:hover:bg-red-500/15`}
            >
              <X size={14} />
              {isPolish ? 'Odrzucona' : 'Reject'}
            </button>
          </div>
        ) : null}

        <div className="flex gap-2">
          <button
            onClick={onMoreInfo}
            className={`${footerPillBase} flex-1 border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-white/[0.06]`}
          >
            <MessageSquare size={14} />
            {isPolish ? 'Więcej info' : 'More info'}
          </button>
          {canAct ? (
            <button
              onClick={onDelegate}
              className={`${footerPillBase} flex-1 border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-white/[0.06]`}
            >
              <UserPlus size={14} />
              {isPolish ? 'Deleguj' : 'Delegate'}
            </button>
          ) : (
            <button
              onClick={onRemind}
              className={`${footerPillBase} flex-1 border-blue-300/40 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-200 hover:bg-blue-100/70 dark:hover:bg-blue-500/15`}
            >
              <Bell size={14} />
              {isPolish ? 'Przypomnij' : 'Remind'}
            </button>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={onRemind}
            className={`${footerPillBase} flex-1 border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-white/[0.06]`}
          >
            <Bell size={14} />
            {isPolish ? 'Przypomnij' : 'Remind'}
          </button>
          <button
            onClick={onEscalate}
            className={`${footerPillBase} border-amber-300/40 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-200 hover:bg-amber-100/70 dark:hover:bg-amber-500/15`}
          >
            <TrendingUp size={14} />
            {isPolish ? 'Eskaluj' : 'Escalate'}
          </button>
          <div className="relative flex-1">
            <button
              onClick={onToggleSnooze}
              className={`${footerPillBase} w-full border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-white/[0.06]`}
            >
              <AlarmClockOff size={14} />
              {isPolish ? 'Odłóż' : 'Snooze'}
              <ChevronDown size={12} className={`transition-transform ${snoozeOpen ? 'rotate-180' : ''}`} />
            </button>
            {snoozeOpen ? (
              <>
                <div className="fixed inset-0 z-40" onClick={onCloseSnooze} />
                <div className="absolute right-0 top-full mt-2 z-50 w-56 rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-white dark:bg-navy-900 shadow-xl overflow-hidden">
                  {(['1h', '4h', 'tomorrow', 'week'] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => onSnooze(p)}
                      className="w-full px-3 py-2 text-left text-xs hover:bg-slate-50 dark:hover:bg-navy-800 text-slate-700 dark:text-slate-200"
                    >
                      {labelForSnoozePreset(p, isPolish)}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export const DecisionPreviewPanel: React.FC<DecisionPreviewPanelProps> = ({
  decisionId,
  mode,
  onClose,
  onOpenFullDetail,
  onDidMutate,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const { currentUser } = useAppStore();

  const [loading, setLoading] = useState(false);
  const [decision, setDecision] = useState<DecisionPreviewData | null>(null);
  const [brief, setBrief] = useState<DecisionBrief | null>(null);
  const [delegationOpen, setDelegationOpen] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<
    Array<{ id: string; name: string; email?: string; avatar?: string }>
  >([]);

  const canAct = useMemo(() => {
    if (!decisionId) return false;
    if (mode === 'requests_pending') return false;
    // In "all" mode we still only allow acting when I'm the decider.
    const meId = currentUser?.id ? String(currentUser.id) : null;
    const ownerId = decision?.decisionOwnerId ? String(decision.decisionOwnerId) : null;
    return Boolean(meId && ownerId && meId === ownerId);
  }, [decisionId, mode, currentUser?.id, decision?.decisionOwnerId]);

  const canDelegate = canAct;

  // Details kebab state (MUST: kebab in Details)
  const [detailsMenuOpen, setDetailsMenuOpen] = useState(false);
  const [detailsOverride, setDetailsOverride] = useState<string | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // AI hints state (MUST: kebab in AI strip)
  const [aiMenuOpen, setAiMenuOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const lastAiIntentRef = useRef<DecisionAiIntent>('summarize_context');

  // Snooze dropdown (pill dropdown)
  const [snoozeOpen, setSnoozeOpen] = useState(false);

  const fetchDetails = useCallback(async () => {
    if (!decisionId) return;
    try {
      setLoading(true);
      const d = (await Api.getDecision(decisionId)) as DecisionPreviewData;
      setDecision({ ...d, id: String((d as any)?.id || decisionId), title: String((d as any)?.title || 'Decision') });
      try {
        const b = (await Api.get(`/my-work/decisions/${decisionId}/brief`)) as DecisionBrief;
        setBrief(b && typeof (b as any)?.summary === 'string' ? b : null);
      } catch {
        setBrief(null);
      }
    } catch (e) {
      setDecision(null);
      setBrief(null);
    } finally {
      setLoading(false);
    }
  }, [decisionId]);

  const fetchUsers = useCallback(async () => {
    try {
      const users = await Api.getUsers();
      const mapped = (Array.isArray(users) ? users : []).map((u: any) => ({
        id: String(u.id),
        name: String(
          u.name ||
            `${u.first_name || u.firstName || ''} ${u.last_name || u.lastName || ''}`.trim() ||
            u.email ||
            u.id
        ),
        email: u.email ? String(u.email) : undefined,
        avatar: u.avatar_url || u.avatarUrl || undefined,
      }));
      setAvailableUsers(mapped);
    } catch {
      setAvailableUsers([]);
    }
  }, []);

  useEffect(() => {
    setDecision(null);
    setBrief(null);
    setDetailsMenuOpen(false);
    setDetailsOverride(null);
    setDetailsLoading(false);
    setAiMenuOpen(false);
    setAiLoading(false);
    setAiText(null);
    setAiError(null);
    setSnoozeOpen(false);
    if (decisionId) fetchDetails();
  }, [decisionId, fetchDetails]);

  const handleDetailsAction = useCallback(
    async (action: 'expand' | 'summarize' | 'copy') => {
      if (!decision) return;
      const base = String(detailsOverride ?? decision.description ?? '').trim();
      if (action === 'copy') {
        try {
          await navigator.clipboard.writeText(base || decision.title || '');
          toast.success(isPolish ? 'Skopiowano' : 'Copied');
        } catch {
          toast.error(isPolish ? 'Nie udało się skopiować' : 'Copy failed');
        }
        setDetailsMenuOpen(false);
        return;
      }

      try {
        setDetailsLoading(true);
        setDetailsMenuOpen(false);
        const language = isPolish ? 'pl' : 'en';
        const systemInstruction = [
          `You are a senior PMO decision advisor.`,
          `Output language MUST be ${language === 'pl' ? 'Polish' : 'English'}.`,
          `Do NOT invent facts. Use only the provided decision text/context.`,
          `Return plain text only (no markdown).`,
        ].join('\n');

        const mode = action === 'expand' ? 'expand' : 'shorten';
        const resp = await Api.post('/ai/refine-text?timeoutMs=20000', {
          text: base || decision.title,
          mode,
          systemInstruction,
          fieldLabel: 'Decision details',
          artifactContext: {
            id: decision.id,
            title: decision.title,
            type: 'decision',
            status: decision.status || 'pending',
            priority: decision.priority || 'medium',
          },
          language,
        });
        const text = String((resp as any)?.text || '').trim();
        if (text) setDetailsOverride(text);
      } catch {
        toast.error(isPolish ? 'AI niedostępne' : 'AI unavailable');
      } finally {
        setDetailsLoading(false);
      }
    },
    [decision, detailsOverride, isPolish]
  );

  const handleRunAi = useCallback(
    async (intent: DecisionAiIntent) => {
      if (!decision) return;
      lastAiIntentRef.current = intent;
      try {
        setAiLoading(true);
        setAiError(null);
        const text = await runDecisionAi({ intent, isPolish, decision });
        if (!text) throw new Error('empty');
        setAiText(text);
      } catch {
        setAiError(isPolish ? 'AI niedostępne' : 'AI unavailable');
      } finally {
        setAiLoading(false);
      }
    },
    [decision, isPolish]
  );

  const handleCopyAi = useCallback(async () => {
    if (!aiText) return;
    try {
      await navigator.clipboard.writeText(aiText);
      toast.success(isPolish ? 'Skopiowano' : 'Copied');
    } catch {
      toast.error(isPolish ? 'Nie udało się skopiować' : 'Copy failed');
    } finally {
      setAiMenuOpen(false);
    }
  }, [aiText, isPolish]);

  const handleClearAi = useCallback(() => {
    setAiText(null);
    setAiError(null);
    setAiMenuOpen(false);
  }, []);

  const handleRegenerateAi = useCallback(() => {
    setAiMenuOpen(false);
    void handleRunAi(lastAiIntentRef.current || 'summarize_context');
  }, [handleRunAi]);

  const handleApproveReject = async (next: 'approved' | 'rejected') => {
    if (!decisionId) return;
    try {
      await Api.decideDecision(decisionId, next, defaultRationaleFor(next));
      toast.success(
        next === 'approved'
          ? isPolish
            ? 'Zatwierdzono'
            : 'Approved'
          : isPolish
            ? 'Odrzucono'
            : 'Rejected'
      );
      onDidMutate?.();
      await fetchDetails();
    } catch (e) {
      toast.error(isPolish ? 'Nie udało się wykonać akcji' : 'Action failed');
    }
  };

  const handleDefer = async () => {
    if (!decisionId) return;
    try {
      await Api.decideDecision(decisionId, 'deferred', isPolish ? 'Odroczone' : 'Deferred');
      toast.success(isPolish ? 'Odroczono' : 'Deferred');
      onDidMutate?.();
      await fetchDetails();
    } catch {
      toast.error(isPolish ? 'Nie udało się odroczyć' : 'Failed to defer');
    }
  };

  const handleRemind = async () => {
    if (!decisionId) return;
    try {
      await Api.remindDecision(decisionId);
      toast.success(isPolish ? 'Wysłano przypomnienie' : 'Reminder sent');
    } catch (e: any) {
      const msg = String(e?.message || '');
      toast.error(
        msg.includes('recent')
          ? isPolish
            ? 'Przypomnienie było niedawno wysłane'
            : 'Reminder recently sent'
          : isPolish
            ? 'Nie udało się wysłać przypomnienia'
            : 'Failed to send reminder'
      );
    }
  };

  const handleEscalate = async () => {
    if (!decisionId) return;
    try {
      await Api.escalateDecision(
        decisionId,
        isPolish ? 'Eskalacja z preview — wymaga reakcji' : 'Escalated from preview — needs attention'
      );
      toast.success(isPolish ? 'Eskaluowano' : 'Escalated');
      onDidMutate?.();
      await fetchDetails();
    } catch {
      toast.error(isPolish ? 'Nie udało się eskalować' : 'Failed to escalate');
    }
  };

  const handleSnooze = async (preset: DecisionSnoozePreset) => {
    if (!decisionId) return;
    try {
      await Api.snoozeDecision(decisionId, { preset });
      toast.success(isPolish ? 'Odłożono' : 'Snoozed');
      onDidMutate?.();
      onClose();
    } catch (e) {
      toast.error(isPolish ? 'Nie udało się odłożyć' : 'Failed to snooze');
    }
  };

  if (!decisionId) {
    return (
      <aside className="w-[420px] flex-shrink-0 bg-slate-50 dark:bg-navy-950 h-full p-3">
        <PreviewPaneShell
          kicker={isPolish ? 'Podgląd' : 'Preview'}
          title={isPolish ? 'Decyzja' : 'Decision'}
          onClose={onClose}
        >
          <div className="h-full flex items-center justify-center p-6 text-center">
            <div className="text-sm text-slate-500 dark:text-slate-400">
              {isPolish
                ? 'Wybierz decyzję z listy, aby zobaczyć podgląd.'
                : 'Select a decision to preview.'}
            </div>
          </div>
        </PreviewPaneShell>
      </aside>
    );
  }

  return (
    <aside className="w-[420px] flex-shrink-0 bg-slate-50 dark:bg-navy-950 h-full p-3 overflow-hidden">
      <PreviewPaneShell
        kicker={
          mode === 'requests_pending'
            ? isPolish
              ? 'Moja prośba'
              : 'My request'
            : isPolish
              ? 'Podgląd'
              : 'Preview'
        }
        title={decision?.title || (isPolish ? 'Decyzja' : 'Decision')}
        onClose={onClose}
        actions={
          <button
            onClick={() => onOpenFullDetail(decisionId, decision)}
            className="inline-flex items-center gap-2 h-8 px-3 rounded-full border border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900"
            title={isPolish ? 'Otwórz pełny widok' : 'Open full detail'}
          >
            <ExternalLink size={13} />
            {isPolish ? 'Otwórz' : 'Open'}
          </button>
        }
        footer={
          <DecisionPreviewFooter
            decision={decision}
            mode={mode}
            canAct={canAct}
            isPolish={isPolish}
            aiText={aiText}
            aiError={aiError}
            aiLoading={aiLoading}
            aiMenuOpen={aiMenuOpen}
            onToggleAiMenu={() => setAiMenuOpen((v) => !v)}
            onCloseAiMenu={() => setAiMenuOpen(false)}
            onRunAi={handleRunAi}
            onCopyAi={handleCopyAi}
            onClearAi={handleClearAi}
            onRegenerateAi={handleRegenerateAi}
            onApprove={() => handleApproveReject('approved')}
            onReject={() => handleApproveReject('rejected')}
            onDelegate={async () => {
              await fetchUsers();
              setDelegationOpen(true);
            }}
            onMoreInfo={() => onOpenFullDetail(decisionId, decision)}
            onRemind={handleRemind}
            onEscalate={handleEscalate}
            snoozeOpen={snoozeOpen}
            onToggleSnooze={() => setSnoozeOpen((v) => !v)}
            onCloseSnooze={() => setSnoozeOpen(false)}
            onSnooze={(preset) => {
              setSnoozeOpen(false);
              void handleSnooze(preset);
            }}
          />
        }
      >
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{isPolish ? 'Ładowanie…' : 'Loading…'}</span>
          </div>
        ) : (
          <DecisionPreviewBody
            decision={decision}
            brief={brief}
            isPolish={isPolish}
            detailsOverride={detailsOverride}
            detailsLoading={detailsLoading}
            detailsMenuOpen={detailsMenuOpen}
            onToggleDetailsMenu={() => setDetailsMenuOpen((v) => !v)}
            onCloseDetailsMenu={() => setDetailsMenuOpen(false)}
            onDetailsAction={(a) => void handleDetailsAction(a)}
          />
        )}
      </PreviewPaneShell>

      {decisionId && decision && (
        <DelegationModal
          isOpen={delegationOpen}
          onClose={() => setDelegationOpen(false)}
          decisionId={decisionId}
          decisionTitle={String(decision?.title || '')}
          availableUsers={availableUsers}
          currentDeciderId={String(
            (decision as any)?.deciderId ||
              (decision as any)?.decider_id ||
              (decision as any)?.decisionOwnerId ||
              (decision as any)?.decision_maker_id ||
              ''
          )}
          onDelegated={() => {
            onDidMutate?.();
            fetchDetails();
          }}
        />
      )}
    </aside>
  );
};

export default DecisionPreviewPanel;
