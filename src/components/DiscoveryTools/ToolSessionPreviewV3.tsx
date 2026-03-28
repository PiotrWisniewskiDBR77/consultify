import { Check, ExternalLink, Send, Sparkles, X } from 'lucide-react';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import {
  type ActionRow,
  type ExtraCopyFormat,
  type MetaPill,
  PreviewActionBar,
  PreviewAIHintStrip,
  PreviewDetailsSection,
  PreviewMetaCard,
  PreviewRelations,
  type RelationItem,
} from '@/components/shared/PreviewPane';
import { Api } from '@/services/api';
import { copyAsMarkdown, copyForSlack } from '@/utils/clipboard';

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
    }
  }, [detailsText, isPolish, itemName]);

  const statusUpper = String(status || 'DRAFT').toUpperCase();
  const statusPillClass =
    statusUpper === 'APPROVED' || statusUpper === 'GENERATED' || statusUpper === 'COMPLETED'
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
      : statusUpper === 'REVIEW'
        ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
        : 'bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300';

  const metaPills: MetaPill[] = [
    {
      label: toolLabel,
      className:
        'border border-slate-200/70 dark:border-white/[0.08] bg-transparent text-slate-700 dark:text-slate-200',
    },
    { label: statusUpper, className: statusPillClass },
    {
      label: `${t('preview.progress', 'Progress')}: ${progress ?? details?.progress ?? 0}%`,
      className: 'bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300',
    },
    ...(details?.confidenceAvg != null
      ? [
          {
            label: `${isPolish ? 'Pewność' : 'Confidence'}: ${details.confidenceAvg}`,
            className: 'bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300',
          },
        ]
      : []),
  ];

  const detailsDisplayText =
    detailsText ||
    (isPolish
      ? 'Użyj AI hintów w stopce, aby wygenerować brief.'
      : 'Use AI hints in the footer to generate a brief.');

  return (
    <div className="space-y-4">
      <PreviewMetaCard
        pills={metaPills}
        trailing={
          <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
            {updatedAt
              ? formatDate(updatedAt.toISOString())
              : details?.updatedAt
                ? formatDate(details.updatedAt)
                : '—'}
          </span>
        }
      >
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
      </PreviewMetaCard>

      <PreviewDetailsSection
        text={detailsDisplayText}
        loading={detailsLoading}
        onCopy={() => void handleCopyDetails()}
        extraCopyFormats={[
          {
            label: isPolish ? 'Kopiuj jako Markdown' : 'Copy as Markdown',
            onClick: () =>
              void copyAsMarkdown(
                { title: itemName, status, description: detailsDisplayText },
                isPolish ? 'pl' : 'en'
              ),
          },
          {
            label: isPolish ? 'Kopiuj dla Slack' : 'Copy for Slack',
            onClick: () =>
              void copyForSlack(
                { title: itemName, status, description: detailsDisplayText },
                isPolish ? 'pl' : 'en'
              ),
          },
        ]}
      />
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
    }
  }, [aiText, isPolish]);

  const handleClearAi = useCallback(() => {
    setAiText(null);
    setAiError(null);
  }, []);

  const handleRegenerateAi = useCallback(() => {
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

  const aiHints = [
    isPolish ? 'Executive brief' : 'Executive brief',
    isPolish ? 'Kluczowe ryzyka' : 'Key risks',
    isPolish ? 'Kąty inicjatyw' : 'Initiative angles',
  ];
  const hintToIntent: Record<string, ToolSessionPreviewAiIntent> = {
    [aiHints[0]]: 'exec_brief',
    [aiHints[1]]: 'key_risks',
    [aiHints[2]]: 'initiative_angles',
  };

  const relationItems: RelationItem[] = detailsLoading
    ? []
    : [
        ...initiativeRelations.map((i) => ({
          label: clampText(String(i.title || i.name || i.id), 42),
          tone: 'text-amber-700 dark:text-amber-300',
        })),
        ...decisionRelations.map((d, idx) => ({
          label: clampText(String(d.decision_type || 'Decision'), 42),
          tone: 'text-purple-700 dark:text-purple-300',
        })),
      ];

  const actionRows: ActionRow[] = [
    ...(showOpen || canResume
      ? [
          {
            buttons: [
              ...(showOpen
                ? [
                    {
                      label: t('common.open', 'Open'),
                      onClick: onOpenFull,
                      colorScheme: 'primary' as const,
                      icon: ExternalLink,
                      flex: true,
                      shortcut: 'O',
                    },
                  ]
                : []),
              ...(canResume
                ? [
                    {
                      label: isPolish ? 'Wznów' : 'Resume',
                      onClick: onResume,
                      colorScheme: 'primary' as const,
                      icon: ExternalLink,
                      flex: true,
                      shortcut: 'R',
                    },
                  ]
                : []),
            ].filter(Boolean),
          },
        ]
      : []),
    ...(statusUpper === 'DRAFT'
      ? [
          {
            buttons: [
              {
                label: isPolish ? 'Wyślij do review' : 'Request review',
                onClick: () => void onRequestReview(),
                colorScheme: canRequestReview ? ('amber' as const) : ('neutral' as const),
                icon: Send,
                disabled: !canRequestReview,
              },
            ],
          },
        ]
      : []),
    ...(statusUpper === 'REVIEW'
      ? [
          {
            buttons: [
              {
                label: isPolish ? 'Zatwierdź' : 'Approve',
                onClick: () => void onApprove(),
                colorScheme: canApproveTool ? ('emerald' as const) : ('neutral' as const),
                icon: Check,
                disabled: !canApproveTool,
                flex: true,
              },
              {
                label: isPolish ? 'Odeślij' : 'Send back',
                onClick: () => void onSendBack(),
                colorScheme: 'red' as const,
                icon: X,
                flex: true,
              },
            ],
          },
        ]
      : []),
    ...(canGenerate
      ? [
          {
            buttons: [
              {
                label: isPolish ? 'Generuj inicjatywy' : 'Generate initiatives',
                onClick: onOpenGenerateModal,
                colorScheme: 'neutral' as const,
                icon: Sparkles,
              },
            ],
          },
        ]
      : []),
  ].filter((row) => row.buttons.length > 0);

  return (
    <div className="space-y-0">
      <div className="rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-slate-50/60 dark:bg-white/[0.03] p-2.5">
        <PreviewAIHintStrip
          hints={aiHints}
          loading={aiLoading || detailsLoading}
          result={aiText}
          error={aiError}
          onRunHint={(hint) => void runAi(hintToIntent[hint] ?? 'exec_brief')}
          onRegenerate={handleRegenerateAi}
          onCopy={handleCopyAi}
          onClear={handleClearAi}
        />
      </div>

      <div className="border-t border-slate-200/50 dark:border-white/[0.06] my-3" />

      <PreviewRelations
        items={relationItems}
        emptyLabel={
          detailsLoading
            ? isPolish
              ? 'Ładowanie powiązań…'
              : 'Loading relations…'
            : isPolish
              ? 'Brak powiązań'
              : 'No relations'
        }
      />

      <div className="border-t border-slate-200/50 dark:border-white/[0.06] my-3" />

      <PreviewActionBar rows={actionRows} />
    </div>
  );
};
