import { Copy, ExternalLink, Loader2, MoreVertical, Sparkles } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';

export type AssessmentSessionPreviewDetails = {
  id: string;
  name: string;
  status?: string;
  assessmentType?: string;
  completionPercent?: number;
  confidenceAvg?: number;
  createdAt?: string;
  updatedAt?: string;
  scoreSummary?: Record<string, unknown>;
  contextSnapshot?: Record<string, unknown>;
  permissions?: {
    canRequestReview?: boolean;
    canApprove?: boolean;
    canGenerateReport?: boolean;
    canGenerateInitiatives?: boolean;
  };
};

type AssessmentPreviewAiIntent = 'exec_brief' | 'top_gaps' | 'initiative_angles';

const safeJsonString = (value: unknown, maxChars = 8000) => {
  try {
    const s = JSON.stringify(value ?? {}, null, 2);
    if (s.length <= maxChars) return s;
    return `${s.slice(0, maxChars)}\n…`;
  } catch {
    return '';
  }
};

async function refineText(params: {
  text: string;
  mode: 'generate' | 'improve' | 'shorten' | 'expand' | 'formal';
  systemInstruction: string;
  fieldLabel: string;
  artifactContext: { id: string; title: string; type: string; status?: string; priority?: string };
  language: 'pl' | 'en';
}): Promise<string> {
  const resp = await Api.post('/ai/refine-text?timeoutMs=20000', {
    text: params.text,
    mode: params.mode,
    systemInstruction: params.systemInstruction,
    fieldLabel: params.fieldLabel,
    artifactContext: params.artifactContext,
    language: params.language,
  });
  return String((resp as any)?.text || '').trim();
}

async function runAssessmentAi(params: {
  intent: AssessmentPreviewAiIntent;
  isPolish: boolean;
  details: AssessmentSessionPreviewDetails;
}): Promise<string> {
  const { intent, isPolish, details } = params;
  const language: 'pl' | 'en' = isPolish ? 'pl' : 'en';

  const intentLabel =
    intent === 'exec_brief'
      ? isPolish
        ? 'Executive brief'
        : 'Executive brief'
      : intent === 'top_gaps'
        ? isPolish
          ? 'Top luki'
          : 'Top gaps'
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
    `Assessment: ${String(details.name || '')}`,
    `Framework: ${String(details.assessmentType || '')}`,
    `Status: ${String(details.status || '')}`,
    `Completion: ${String(details.completionPercent ?? '')}`,
    details.scoreSummary ? `Score summary JSON:\n${safeJsonString(details.scoreSummary)}` : '',
    details.contextSnapshot
      ? `Context snapshot JSON:\n${safeJsonString(details.contextSnapshot)}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  return refineText({
    text: seed,
    mode: 'generate',
    systemInstruction,
    fieldLabel: `Assessment preview AI (${intentLabel})`,
    artifactContext: {
      id: details.id,
      title: details.name,
      type: 'assessment',
      status: String(details.status || ''),
      priority: 'medium',
    },
    language,
  });
}

export const AssessmentSessionPreviewV3Body: React.FC<{
  itemName: string;
  framework: string;
  status: string;
  progress: number;
  createdAt?: Date;
  updatedAt: Date;
  details: AssessmentSessionPreviewDetails | null;
  detailsLoading?: boolean;
}> = ({ itemName, framework, status, progress, createdAt, updatedAt, details, detailsLoading }) => {
  const { i18n, t } = useTranslation();
  const isPolish = i18n.language?.startsWith('pl');

  const [detailsMenuOpen, setDetailsMenuOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiText, setAiText] = useState('');

  const bestDetails = details || null;

  const metaRows = useMemo(
    () => [
      { label: t('assessment.preview.framework', 'Framework'), value: framework || '—' },
      { label: t('assessment.preview.status', 'Status'), value: status || '—' },
      {
        label: t('assessment.preview.progress', 'Progress'),
        value: `${Math.round(progress || 0)}%`,
      },
      {
        label: t('assessment.preview.created', 'Created'),
        value: createdAt ? createdAt.toLocaleDateString() : '—',
      },
      {
        label: t('assessment.preview.updated', 'Updated'),
        value: updatedAt ? updatedAt.toLocaleDateString() : '—',
      },
    ],
    [createdAt, framework, t, progress, status, updatedAt]
  );

  const handleCopyJson = useCallback(async () => {
    const payload = safeJsonString(bestDetails?.scoreSummary || bestDetails?.contextSnapshot || {});
    try {
      await navigator.clipboard.writeText(payload || itemName || '');
      toast.success(t('assessment.preview.copied', 'Copied'));
    } catch {
      toast.error(t('assessment.preview.copyFailed', 'Copy failed'));
    } finally {
      setDetailsMenuOpen(false);
    }
  }, [bestDetails?.contextSnapshot, bestDetails?.scoreSummary, isPolish, itemName]);

  const runAi = useCallback(
    async (intent: AssessmentPreviewAiIntent) => {
      if (!bestDetails) return;
      try {
        setAiLoading(true);
        const txt = await runAssessmentAi({ intent, isPolish, details: bestDetails });
        setAiText(txt);
      } catch {
        toast.error(t('assessment.preview.aiUnavailable', 'AI unavailable'));
      } finally {
        setAiLoading(false);
      }
    },
    [bestDetails, isPolish]
  );

  return (
    <div className="h-full">
      <div className="px-5 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wide text-danger-400">
              {'Assessment session'}
            </div>
            <div
              className="mt-1 text-lg font-semibold text-slate-900 dark:text-white truncate"
              title={itemName}
            >
              {itemName}
            </div>
          </div>

          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setDetailsMenuOpen((v) => !v)}
              className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-navy-800/60 transition-colors"
              title={t('common.more', 'More')}
            >
              <MoreVertical size={16} />
            </button>
            {detailsMenuOpen ? (
              <div className="absolute right-0 mt-2 w-44 rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-white dark:bg-navy-900 shadow-lg overflow-hidden z-20">
                <button
                  type="button"
                  onClick={() => void handleCopyJson()}
                  className="w-full px-3 py-2.5 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.05] inline-flex items-center gap-2"
                >
                  <Copy size={14} />
                  {t('assessment.preview.copyJson', 'Copy JSON')}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="px-5 pt-4 space-y-4">
        <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          {metaRows.map((r) => (
            <React.Fragment key={r.label}>
              <div className="text-slate-500 dark:text-slate-400">{r.label}</div>
              <div className="text-slate-800 dark:text-slate-200">{r.value}</div>
            </React.Fragment>
          ))}
        </div>

        <div className="rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.04] p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {'AI hints'}
            </div>
            {aiLoading ? <Loader2 className="w-4 h-4 animate-spin text-slate-600" /> : null}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!bestDetails || aiLoading}
              onClick={() => void runAi('exec_brief')}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border border-slate-200/70 dark:border-white/[0.08] bg-white/80 dark:bg-white/[0.03] text-slate-700 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-white/[0.06] disabled:opacity-50"
            >
              <Sparkles size={14} />
              {'Executive brief'}
            </button>
            <button
              type="button"
              disabled={!bestDetails || aiLoading}
              onClick={() => void runAi('top_gaps')}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border border-slate-200/70 dark:border-white/[0.08] bg-white/80 dark:bg-white/[0.03] text-slate-700 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-white/[0.06] disabled:opacity-50"
            >
              <Sparkles size={14} />
              {t('assessment.preview.topGaps', 'Top gaps')}
            </button>
            <button
              type="button"
              disabled={!bestDetails || aiLoading}
              onClick={() => void runAi('initiative_angles')}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border border-slate-200/70 dark:border-white/[0.08] bg-white/80 dark:bg-white/[0.03] text-slate-700 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-white/[0.06] disabled:opacity-50"
            >
              <Sparkles size={14} />
              {t('assessment.preview.initiativeAngles', 'Initiative angles')}
            </button>
          </div>

          {detailsLoading ? (
            <div className="mt-4 text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('common.loading', 'Loading…')}
            </div>
          ) : aiText ? (
            <pre className="mt-4 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">
              {aiText}
            </pre>
          ) : (
            <div className="mt-4 text-sm text-slate-500 dark:text-slate-400">
              {bestDetails
                ? t('assessment.preview.runAiPrompt', 'Run one of the AI prompts to get insights.')
                : t('assessment.preview.selectSession', 'Select a session to see details.')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const AssessmentSessionPreviewV3Footer: React.FC<{
  onOpenFull: () => void;
}> = ({ onOpenFull }) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language?.startsWith('pl');
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="text-xs text-slate-500 dark:text-slate-400">
        {t('assessment.preview.openSessionHint', 'Open assessment session to continue.')}
      </div>
      <button
        type="button"
        onClick={onOpenFull}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-primary-500/15 text-primary-600 dark:text-primary-400 hover:bg-primary-500/25 transition-colors"
      >
        <ExternalLink size={14} />
        {t('common.open', 'Open')}
      </button>
    </div>
  );
};
