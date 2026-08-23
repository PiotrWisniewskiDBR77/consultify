import type { TFunction } from 'i18next';
import { Check, ExternalLink, Send, X } from 'lucide-react';
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
import { statusChipTone } from '@/components/ui/primitives/chips/EntityStatusChip';
import { Api } from '@/services/api';
import { copyAsMarkdown, copyForSlack } from '@/utils/clipboard';

import { buildToolSessionDetails } from './toolSessionDetailsBuilder';
import { getToolCategoryLabel } from './ToolSessionPreview';

/**
 * Localized tool-session status label — canon §7.3: no raw enum keys in preview.
 * Falls back to a humanized key (never the raw uppercase enum) when unmapped.
 */
function toolStatusLabel(t: TFunction, raw: string | null | undefined): string {
  const key = String(raw ?? '')
    .trim()
    .toLowerCase();
  const map: Record<string, string> = {
    draft: t('preview.statuses.draft', 'Draft'),
    review: t('preview.statuses.review', 'In review'),
    approved: t('preview.statuses.approved', 'Approved'),
    generated: t('preview.statuses.generated', 'Generated'),
    completed: t('preview.statuses.completed', 'Completed'),
  };
  if (map[key]) return map[key];
  const spaced = key.replace(/[_-]+/g, ' ').trim();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : '';
}

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
  t: TFunction;
  details: ToolSessionPreviewDetails;
}): Promise<string> {
  const { intent, isPolish, t, details } = params;
  const language = isPolish ? 'pl' : 'en';

  const intentLabel =
    intent === 'exec_brief'
      ? t('discoveryToolsMain.toolSessionPreviewV3.intentExecBrief', 'Executive brief')
      : intent === 'key_risks'
        ? t('discoveryToolsMain.toolSessionPreviewV3.intentKeyRisks', 'Key risks')
        : t('discoveryToolsMain.toolSessionPreviewV3.intentInitiativeAngles', 'Initiative angles');

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
    return buildToolSessionDetails(details, isPolish ? 'pl' : 'en');
  }, [details, isPolish]);

  const handleCopyDetails = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(detailsText || itemName || '');
      toast.success(t('common.copied', 'Copied'));
    } catch {
      toast.error(t('common.copyFailed', 'Copy failed'));
    }
  }, [detailsText, t, itemName]);

  // Canon §4.1/§7.3: status is a SIGNAL carried by tone (statusChipTone),
  // label is localized — never a raw uppercased enum with ad-hoc color classes.
  const statusRaw = String(status || 'draft');
  const statusTone = statusChipTone(statusRaw) as MetaPill['tone'];
  const statusText = toolStatusLabel(t, statusRaw);

  const metaPills: MetaPill[] = [
    {
      label: toolLabel,
      className:
        'border border-slate-200/70 dark:border-white/[0.08] bg-transparent text-slate-700 dark:text-slate-200',
    },
    { label: statusText, tone: statusTone },
    {
      label: t('preview.progress', 'Progress'),
      value: `${progress ?? details?.progress ?? 0}%`,
      tone: 'neutral',
    },
    ...(details?.confidenceAvg != null
      ? [
          {
            label: t('preview.confidence', 'Confidence'),
            value: details.confidenceAvg,
            tone: 'neutral' as const,
          },
        ]
      : []),
  ];

  const detailsDisplayText = detailsText;

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
            label: t('preview.copyAsMarkdown', 'Copy as Markdown'),
            onClick: () =>
              void copyAsMarkdown(
                { title: itemName, status, description: detailsDisplayText },
                isPolish ? 'pl' : 'en'
              ),
          },
          {
            label: t('preview.copyForSlack', 'Copy for Slack'),
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
  /** @deprecated TOOL-08: downstream creation belongs in the Initiatives creator. */
  onOpenGenerateModal?: () => void;
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
        const text = await runToolSessionAi({ intent, isPolish, t, details });
        if (!text) throw new Error('empty');
        setAiText(text);
      } catch (e: any) {
        setAiError(
          e?.code === 'AI_TIMEOUT'
            ? t('preview.aiTimedOut', 'AI timed out')
            : t('preview.aiUnavailable', 'AI unavailable')
        );
      } finally {
        setAiLoading(false);
      }
    },
    [details, isPolish, t]
  );

  const handleCopyAi = useCallback(async () => {
    if (!aiText) return;
    try {
      await navigator.clipboard.writeText(aiText);
      toast.success(t('common.copied', 'Copied'));
    } catch {
      toast.error(t('common.copyFailed', 'Copy failed'));
    }
  }, [aiText, t]);

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
  const initiativeRelations = (details?.generatedInitiatives || []).slice(0, 6);
  const decisionRelations = (details?.decisions || []).slice(0, 3);

  const aiHints = [
    t('preview.aiHints.execBrief', 'Executive brief'),
    t('preview.aiHints.keyRisks', 'Key risks'),
    t('preview.aiHints.initiativeAngles', 'Initiative angles'),
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
        ...decisionRelations.map((d) => ({
          label: clampText(String(d.decision_type || t('common.decision', 'Decision')), 42),
          tone: 'text-primary-700 dark:text-primary-300',
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
                      label: t('preview.resume', 'Resume'),
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
                label: t('preview.requestReview', 'Request review'),
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
                label: t('preview.approve', 'Approve'),
                onClick: () => void onApprove(),
                colorScheme: canApproveTool ? ('emerald' as const) : ('neutral' as const),
                icon: Check,
                disabled: !canApproveTool,
                flex: true,
              },
              {
                label: t('preview.sendBack', 'Send back'),
                onClick: () => void onSendBack(),
                colorScheme: 'red' as const,
                icon: X,
                flex: true,
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
            ? t('preview.loadingRelations', 'Loading relations…')
            : t('preview.noRelations', 'No relations')
        }
      />

      <div className="border-t border-slate-200/50 dark:border-white/[0.06] my-3" />

      <PreviewActionBar rows={actionRows} />
    </div>
  );
};
