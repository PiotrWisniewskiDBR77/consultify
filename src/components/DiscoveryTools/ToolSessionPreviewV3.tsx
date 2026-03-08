import { Check, Copy, ExternalLink, Loader2, MoreVertical, Send, Sparkles, X } from 'lucide-react';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';

import { getToolCategoryLabel } from './ToolSessionPreview';

export type ToolSessionPreviewDetails = {
  id: string;
  name: string;
  toolType: string;
  status: string;
  progress?: number;
  confidenceAvg?: number;
  createdAt?: string;
  updatedAt?: string;
  answers?: Record<string, unknown>;
  contextSnapshot?: Record<string, unknown>;
  generatedInitiatives?: Array<{ id: string; title?: string; name?: string; status?: string }>;
  decisions?: Array<{
    decision_type?: string;
    status?: string;
    decision_id?: string;
    decision_status?: string;
  }>;
  permissions?: {
    canRequestReview?: boolean;
    canApproveTool?: boolean;
    canGenerate?: boolean;
  };
};

type ToolSessionPreviewAiIntent = 'exec_brief' | 'key_risks' | 'initiative_angles';

const formatDate = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const clampText = (s: string, max = 120) => {
  const t = String(s || '').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
};

const safeJsonString = (value: unknown, maxChars = 8000) => {
  try {
    const s = JSON.stringify(value ?? {}, null, 2);
    if (s.length <= maxChars) return s;
    return `${s.slice(0, maxChars)}\n…`;
  } catch {
    return '';
  }
};

async function runToolSessionAi(params: {
  intent: ToolSessionPreviewAiIntent;
  isPolish: boolean;
  details: ToolSessionPreviewDetails;
}): Promise<string> {
  const { intent, isPolish, details } = params;
  const language = isPolish ? 'pl' : 'en';

  const intentLabel =
    intent === 'exec_brief'
      ? isPolish
        ? 'Executive brief'
        : 'Executive brief'
      : intent === 'key_risks'
        ? isPolish
          ? 'Kluczowe ryzyka'
          : 'Key risks'
        : isPolish
          ? 'Kąty inicjatyw'
          : 'Initiative angles';

  const systemInstruction = [
    `You are a senior transformation consultant.`,
    `Output language MUST be ${language === 'pl' ? 'Polish' : 'English'}.`,
    `Do NOT invent facts. Use only provided session fields and JSON.`,
    `Return plain text only. No markdown.`,
    `Keep it concise: 4-8 short bullets.`,
    `Intent: ${intentLabel}`,
  ].join('\n');

  const seed = [
    `[GENERATE FROM SCRATCH]`,
    `Tool type: ${String(details.toolType || '')}`,
    `Session: ${String(details.name || '')}`,
    `Status: ${String(details.status || '')}`,
    `Progress: ${String(details.progress ?? '')}`,
    `Confidence: ${String(details.confidenceAvg ?? '')}`,
    ``,
    `Answers JSON:`,
    safeJsonString(details.answers, 9000),
    ``,
    `Context snapshot JSON:`,
    safeJsonString(details.contextSnapshot, 6000),
  ]
    .filter(Boolean)
    .join('\n');

  const resp = await Api.post('/ai/refine-text?timeoutMs=20000', {
    text: seed,
    mode: 'generate',
    systemInstruction,
    fieldLabel: 'Tool session preview AI',
    artifactContext: {
      id: details.id,
      title: details.name,
      type: 'tool',
      status: details.status || 'draft',
      priority: 'medium',
    },
    language,
  });

  return String((resp as any)?.text || '').trim();
}

export const ToolSessionPreviewV3Body: React.FC<{
  itemName: string;
  itemToolType: string;
  status: string;
  progress?: number;
  updatedAt?: Date;
  createdAt?: Date;
  details: ToolSessionPreviewDetails | null;
  detailsLoading?: boolean;
}> = ({
  itemName,
  itemToolType,
  status,
  progress,
  updatedAt,
  createdAt,
  details,
  detailsLoading,
}) => {
  const { i18n, t } = useTranslation();
  const isPolish = i18n.language === 'pl';

  const toolLabel = useMemo(
    () => getToolCategoryLabel(String(details?.toolType || itemToolType || ''), isPolish),
    [details?.toolType, itemToolType, isPolish]
  );

  const [detailsMenuOpen, setDetailsMenuOpen] = useState(false);
  const detailsText = useMemo(() => {
    if (!details) return '';
    const approvedSnapshot = (details.contextSnapshot as any)?.approvedSnapshot;
    if (!approvedSnapshot) return '';
    const safe = safeJsonString(approvedSnapshot, 2000);
    return safe ? (isPolish ? 'Snapshot zatwierdzenia:\n' : 'Approval snapshot:\n') + safe : '';
  }, [details, isPolish]);

  const handleCopyDetails = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(detailsText || itemName || '');
      toast.success(isPolish ? 'Skopiowano' : 'Copied');
    } catch {
      toast.error(isPolish ? 'Nie udało się skopiować' : 'Copy failed');
    } finally {
      setDetailsMenuOpen(false);
    }
  }, [detailsText, isPolish, itemName]);

  const metaPillBase =
    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium';
  const statusUpper = String(status || 'DRAFT').toUpperCase();
  const statusPill =
    statusUpper === 'APPROVED' || statusUpper === 'GENERATED' || statusUpper === 'COMPLETED'
      ? `${metaPillBase} bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300`
      : statusUpper === 'REVIEW'
        ? `${metaPillBase} bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300`
        : `${metaPillBase} bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300`;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            <span
              className={`${metaPillBase} border border-slate-200/70 dark:border-white/[0.08] bg-transparent text-slate-700 dark:text-slate-200`}
            >
              {toolLabel}
            </span>
            <span className={statusPill}>{statusUpper}</span>
            <span
              className={`${metaPillBase} bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300`}
            >
              {t('preview.progress', 'Progress')}: {progress ?? details?.progress ?? 0}%
            </span>
            {details?.confidenceAvg != null ? (
              <span
                className={`${metaPillBase} bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300`}
              >
                {isPolish ? 'Pewność' : 'Confidence'}: {details.confidenceAvg}
              </span>
            ) : null}
          </div>
          <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 shrink-0">
            {updatedAt
              ? formatDate(updatedAt.toISOString())
              : details?.updatedAt
                ? formatDate(details.updatedAt)
                : '—'}
          </div>
        </div>

        <div className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <span className="text-slate-500 dark:text-slate-400">
            {t('preview.created', 'Created')}
          </span>
          <span className="text-slate-900 dark:text-white">
            {createdAt
              ? formatDate(createdAt.toISOString())
              : details?.createdAt
                ? formatDate(details.createdAt)
                : '—'}
          </span>
          <span className="text-slate-500 dark:text-slate-400">
            {t('preview.lastModified', 'Last modified')}
          </span>
          <span className="text-slate-900 dark:text-white">
            {updatedAt
              ? formatDate(updatedAt.toISOString())
              : details?.updatedAt
                ? formatDate(details.updatedAt)
                : '—'}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {t('common.details', isPolish ? 'Szczegóły' : 'Details')}
          </div>
          <div className="relative">
            <button
              onClick={() => setDetailsMenuOpen((v) => !v)}
              className="inline-flex items-center justify-center h-7 w-7 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors"
              aria-label={isPolish ? 'Opcje szczegółów' : 'Details options'}
              title={isPolish ? 'Opcje' : 'Options'}
            >
              <MoreVertical size={14} />
            </button>
            {detailsMenuOpen ? (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setDetailsMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 min-w-[170px] rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-white dark:bg-navy-900 shadow-lg py-1 overflow-hidden">
                  <button
                    onClick={() => void handleCopyDetails()}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors"
                  >
                    <Copy size={12} />
                    {t('common.copy', 'Copy')}
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>

        {detailsLoading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{isPolish ? 'Ładowanie…' : 'Loading…'}</span>
          </div>
        ) : (
          <div className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
            {detailsText ? (
              detailsText
            ) : (
              <span className="text-slate-500 dark:text-slate-400">
                {isPolish
                  ? 'Użyj AI hintów w stopce, aby wygenerować brief.'
                  : 'Use AI hints in the footer to generate a brief.'}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export const ToolSessionPreviewV3Footer: React.FC<{
  details: ToolSessionPreviewDetails | null;
  detailsLoading?: boolean;
  canResume: boolean;
  showOpen: boolean;
  onOpenFull: () => void;
  onResume: () => void;
  onRequestReview: () => Promise<void>;
  onApprove: () => Promise<void>;
  onSendBack: () => Promise<void>;
  onOpenGenerateModal: () => void;
}> = ({
  details,
  detailsLoading,
  canResume,
  showOpen,
  onOpenFull,
  onResume,
  onRequestReview,
  onApprove,
  onSendBack,
  onOpenGenerateModal,
}) => {
  const { i18n, t } = useTranslation();
  const isPolish = i18n.language === 'pl';

  const footerPillBase =
    'inline-flex items-center justify-center gap-1.5 h-9 rounded-full border px-3 text-xs font-medium transition-colors duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900';
  const hintChip =
    'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[11px] font-medium border border-slate-200/70 dark:border-white/[0.08] bg-transparent text-slate-600 dark:text-slate-300 hover:bg-slate-100/50 dark:hover:bg-white/[0.04] transition-colors cursor-pointer active:scale-[0.98] disabled:opacity-40';

  const [aiMenuOpen, setAiMenuOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const lastAiIntentRef = useRef<ToolSessionPreviewAiIntent>('exec_brief');

  const runAi = useCallback(
    async (intent: ToolSessionPreviewAiIntent) => {
      if (!details) return;
      lastAiIntentRef.current = intent;
      try {
        setAiLoading(true);
        setAiError(null);
        const text = await runToolSessionAi({ intent, isPolish, details });
        if (!text) throw new Error('empty');
        setAiText(text);
      } catch (e: any) {
        setAiError(
          isPolish ? 'AI niedostępne' : e?.code === 'AI_TIMEOUT' ? 'AI timed out' : 'AI unavailable'
        );
      } finally {
        setAiLoading(false);
      }
    },
    [details, isPolish]
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
    void runAi(lastAiIntentRef.current || 'exec_brief');
  }, [runAi]);

  const statusUpper = String(details?.status || '').toUpperCase();
  const canRequestReview =
    statusUpper === 'DRAFT' &&
    details?.permissions?.canRequestReview !== false &&
    (details?.progress ?? 0) >= 100 &&
    (details?.confidenceAvg ?? 0) >= 3;
  const canApproveTool = statusUpper === 'REVIEW' && details?.permissions?.canApproveTool !== false;
  const canGenerate =
    (statusUpper === 'APPROVED' || statusUpper === 'GENERATED' || statusUpper === 'COMPLETED') &&
    details?.permissions?.canGenerate !== false;

  const initiativeRelations = (details?.generatedInitiatives || []).slice(0, 6);
  const decisionRelations = (details?.decisions || []).slice(0, 3);

  return (
    <div className="space-y-0">
      <div className="rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-slate-50/60 dark:bg-white/[0.03] p-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
            <Sparkles size={12} />
            <span className="text-[10px] font-medium uppercase tracking-wider">AI</span>
          </div>
          <div className="relative">
            <button
              onClick={() => setAiMenuOpen((v) => !v)}
              className="inline-flex items-center justify-center h-7 w-7 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors"
              aria-label={isPolish ? 'Opcje AI' : 'AI options'}
              title={isPolish ? 'Opcje' : 'Options'}
            >
              <MoreVertical size={14} />
            </button>
            {aiMenuOpen ? (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setAiMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-white dark:bg-navy-900 shadow-lg py-1 overflow-hidden">
                  <button
                    onClick={handleRegenerateAi}
                    disabled={!details}
                    className="w-full px-3 py-1.5 text-left text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.04] disabled:opacity-40"
                  >
                    {isPolish ? 'Regeneruj' : 'Regenerate'}
                  </button>
                  <button
                    onClick={() => void handleCopyAi()}
                    disabled={!aiText}
                    className="w-full px-3 py-1.5 text-left text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.04] disabled:opacity-40"
                  >
                    {t('common.copy', 'Copy')}
                  </button>
                  <button
                    onClick={handleClearAi}
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
            onClick={() => void runAi('exec_brief')}
            disabled={aiLoading || !details}
          >
            {isPolish ? 'Executive brief' : 'Executive brief'}
          </button>
          <button
            className={hintChip}
            onClick={() => void runAi('key_risks')}
            disabled={aiLoading || !details}
          >
            {isPolish ? 'Kluczowe ryzyka' : 'Key risks'}
          </button>
          <button
            className={hintChip}
            onClick={() => void runAi('initiative_angles')}
            disabled={aiLoading || !details}
          >
            {isPolish ? 'Kąty inicjatyw' : 'Initiative angles'}
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

      <div className="min-h-[4.5rem]">
        <div className="flex flex-wrap gap-2 py-1">
          {detailsLoading ? (
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {isPolish ? 'Ładowanie powiązań…' : 'Loading relations…'}
            </span>
          ) : initiativeRelations.length > 0 || decisionRelations.length > 0 ? (
            <>
              {initiativeRelations.map((i) => (
                <span
                  key={`initiative:${i.id}`}
                  className="inline-flex items-center h-7 px-2.5 rounded-full text-[11px] font-medium border border-slate-200/70 dark:border-white/[0.08] bg-transparent text-amber-700 dark:text-amber-300"
                  title={i.title || i.name || i.id}
                >
                  {clampText(String(i.title || i.name || i.id), 42)}
                </span>
              ))}
              {decisionRelations.map((d, idx) => (
                <span
                  key={`decision:${d.decision_id || d.decision_type || idx}`}
                  className="inline-flex items-center h-7 px-2.5 rounded-full text-[11px] font-medium border border-slate-200/70 dark:border-white/[0.08] bg-transparent text-purple-700 dark:text-purple-300"
                  title={String(d.decision_type || 'Decision')}
                >
                  {clampText(String(d.decision_type || 'Decision'), 42)}
                </span>
              ))}
            </>
          ) : (
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {isPolish ? 'Brak powiązań' : 'No relations'}
            </span>
          )}
        </div>
      </div>

      <div className="border-t border-slate-200/50 dark:border-white/[0.06] my-3" />

      <div className="space-y-2.5 py-1">
        <div className="flex gap-2">
          {showOpen ? (
            <button
              onClick={onOpenFull}
              className={`${footerPillBase} flex-1 border-primary-500/30 bg-primary-500/10 text-primary-700 dark:text-primary-300 hover:bg-primary-500/15`}
            >
              <ExternalLink size={14} />
              {t('common.open', 'Open')}
            </button>
          ) : null}

          {canResume ? (
            <button
              onClick={onResume}
              className={`${footerPillBase} flex-1 border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-white/[0.06]`}
            >
              <ExternalLink size={14} />
              {isPolish ? 'Wznów' : 'Resume'}
            </button>
          ) : null}
        </div>

        {statusUpper === 'DRAFT' ? (
          <button
            onClick={() => void onRequestReview()}
            disabled={!canRequestReview}
            className={`${footerPillBase} w-full border-amber-300/40 dark:border-amber-500/30 ${
              canRequestReview
                ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-200 hover:bg-amber-100/70 dark:hover:bg-amber-500/15'
                : 'bg-slate-100/70 dark:bg-white/[0.03] text-slate-400 dark:text-slate-500 cursor-not-allowed'
            }`}
            title={
              canRequestReview
                ? ''
                : isPolish
                  ? 'Do review wymagane: 100% completion i confidence ≥ 3'
                  : 'Review requires: 100% completion and confidence ≥ 3'
            }
          >
            <Send size={14} />
            {isPolish ? 'Wyślij do review' : 'Request review'}
          </button>
        ) : null}

        {statusUpper === 'REVIEW' ? (
          <div className="flex gap-2">
            <button
              onClick={() => void onApprove()}
              disabled={!canApproveTool}
              className={`${footerPillBase} flex-1 border-emerald-300/40 dark:border-emerald-500/30 ${
                canApproveTool
                  ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-200 hover:bg-emerald-100/70 dark:hover:bg-emerald-500/15'
                  : 'bg-slate-100/70 dark:bg-white/[0.03] text-slate-400 dark:text-slate-500 cursor-not-allowed'
              }`}
            >
              <Check size={14} />
              {isPolish ? 'Zatwierdź' : 'Approve'}
            </button>
            <button
              onClick={() => void onSendBack()}
              className={`${footerPillBase} flex-1 border-red-300/40 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-200 hover:bg-red-100/70 dark:hover:bg-red-500/15`}
            >
              <X size={14} />
              {isPolish ? 'Odeślij' : 'Send back'}
            </button>
          </div>
        ) : null}

        {canGenerate ? (
          <button
            onClick={onOpenGenerateModal}
            className={`${footerPillBase} w-full border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-white/[0.06]`}
          >
            <Sparkles size={14} />
            {isPolish ? 'Generuj inicjatywy' : 'Generate initiatives'}
          </button>
        ) : null}
      </div>
    </div>
  );
};
