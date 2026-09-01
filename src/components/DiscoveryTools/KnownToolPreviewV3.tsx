import type { TFunction } from 'i18next';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { formatListDate } from '@/utils/listDateFormat';

type KnownToolListItem = {
  id: string;
  toolType: string;
  name: string;
  libraryCategory: string | null;
  description: string;
  whatYouGet: string[];
  tags: string[];
  icon: string | null;
  isLicensed: boolean;
  isActive: boolean;
  isComingSoon: boolean;
  sortOrder: number;
  createdAt: string | null;
};

export type KnownToolFull = {
  id: string;
  toolType: string;
  name: string;
  libraryCategory: string | null;
  description: string;
  whatYouGet: string[];
  tags: string[];
  icon: string | null;
  isLicensed: boolean;
  isActive: boolean;
  isComingSoon: boolean;
  sortOrder: number;
  createdAt: string | null;
  whenToUse: string;
  inputs: string[];
  steps: string[];
  outputs: string[];
  commonMistakes: string[];
  example: string;
  nextSteps: string[];
  kbArticleSlug: string;
};

type KnownToolPreviewAiIntent = 'when_to_use' | 'first_steps' | 'common_mistakes';

const clampText = (s: string, max = 120) => {
  const t = String(s || '').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
};

/**
 * Odbiór 2026-08-30 (przegląd modułów 04/11/16): `toLocaleDateString(undefined, …)`
 * bierze locale z przeglądarki, nie z konta — patrz `src/utils/listDateFormat.ts`
 * (SSOT, 270 takich wywołań znalezionych 2026-07-27).
 */
const formatDate = (iso?: string | null) => formatListDate(iso);

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

async function runKnownToolAi(params: {
  intent: KnownToolPreviewAiIntent;
  isPolish: boolean;
  t: TFunction;
  tool: KnownToolListItem;
  full: KnownToolFull | null;
}): Promise<string> {
  const { intent, isPolish, t, tool, full } = params;
  const language: 'pl' | 'en' = isPolish ? 'pl' : 'en';
  const ns = 'discoveryToolsMain.knownToolPreviewV3';

  const intentLabel =
    intent === 'when_to_use'
      ? t(`${ns}.intentWhenToUse`, 'When to use')
      : intent === 'first_steps'
        ? t(`${ns}.intentFirstSteps`, 'First steps')
        : t(`${ns}.intentCommonMistakes`, 'Common mistakes');

  const systemInstruction = [
    `You are a senior transformation consultant.`,
    `Output language MUST be ${language === 'pl' ? 'Polish' : 'English'}.`,
    `Do NOT invent facts. Use only provided tool fields.`,
    `Return plain text only. No markdown.`,
    `Keep it concise: 5-8 short bullets.`,
    `Intent: ${intentLabel}`,
  ].join('\n');

  const seed = [
    `[GENERATE FROM SCRATCH]`,
    `Tool: ${String(tool.name || '')}`,
    `Tool type: ${String(tool.toolType || '')}`,
    `Category: ${String(tool.libraryCategory || '')}`,
    `Licensed: ${tool.isLicensed ? 'yes' : 'no'}`,
    `Description: ${String(full?.description || tool.description || '')}`,
    full?.whenToUse ? `When to use: ${String(full.whenToUse || '')}` : '',
    full?.steps?.length ? `Steps: ${full.steps.join(' | ')}` : '',
    full?.commonMistakes?.length ? `Common mistakes: ${full.commonMistakes.join(' | ')}` : '',
    tool.tags?.length ? `Tags: ${tool.tags.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return refineText({
    text: seed,
    mode: 'generate',
    systemInstruction,
    fieldLabel: `Known tool preview AI (${intentLabel})`,
    artifactContext: {
      id: tool.id,
      title: tool.name,
      type: 'tool',
      status: 'library',
      priority: 'medium',
    },
    language,
  });
}

export const KnownToolPreviewV3Body: React.FC<{
  tool: KnownToolListItem;
  full: KnownToolFull | null;
  fullLoading?: boolean;
}> = ({ tool, full, fullLoading }) => {
  const { i18n, t } = useTranslation();
  const isPolish = i18n.language?.startsWith('pl');

  const [detailsText, setDetailsText] = useState<string>('');
  const [detailsLoading, setDetailsLoading] = useState(false);

  type PreviewSnippet = {
    goal: string;
    outcome: string;
    team: string;
    aiRole: string;
    duration: string;
  };

  const snippetNs = 'discoveryToolsMain.knownToolPreviewV3.snippets';
  const previewSnippet = useMemo((): PreviewSnippet => {
    const knownTypes = [
      'dynamic-swot',
      'market-forces',
      'growth-paths',
      'portfolio-priority',
      'risk-uncertainty',
    ];
    if (knownTypes.includes(tool.toolType)) {
      return t(`${snippetNs}.${tool.toolType}`, { returnObjects: true }) as PreviewSnippet;
    }

    const desc = String(full?.description || tool.description || '').trim();
    const fallbackGoal =
      desc || t('discoveryToolsMain.knownToolPreviewV3.toolInPreparation', 'Tool in preparation.');
    const fallbackOutcome =
      (full?.whatYouGet || tool.whatYouGet || []).slice(0, 2).join(', ') || '—';

    return {
      goal: fallbackGoal,
      outcome: fallbackOutcome,
      team: t('discoveryToolsMain.knownToolPreviewV3.dependsOnTool', 'Depends on the tool'),
      aiRole: t(
        'discoveryToolsMain.knownToolPreviewV3.sessionAssistantModerator',
        'Session assistant and moderator'
      ),
      duration: t('discoveryToolsMain.knownToolPreviewV3.dependsOnScope', 'Depends on scope'),
    };
  }, [full, isPolish, t, tool.description, tool.toolType, tool.whatYouGet]);

  const initialDetailsText = useMemo(() => {
    const s = previewSnippet;
    const goalL = t('discoveryToolsMain.knownToolPreviewV3.goal', 'Goal');
    const outcomeL = t('discoveryToolsMain.knownToolPreviewV3.outcome', 'Outcome');
    const teamL = 'Team';
    const aiL = t('discoveryToolsMain.knownToolPreviewV3.aiRole', 'AI Role');
    const durL = t('discoveryToolsMain.knownToolPreviewV3.duration', 'Duration');
    return `${goalL}: ${s.goal}\n${outcomeL}: ${s.outcome}\n${teamL}: ${s.team}\n${aiL}: ${s.aiRole}\n${durL}: ${s.duration}`;
  }, [previewSnippet, t]);

  useEffect(() => {
    setDetailsText(initialDetailsText);
    setDetailsLoading(false);
  }, [tool.id, initialDetailsText]);

  const handleCopyDetails = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(detailsText || tool.name || '');
      toast.success(t('common.copied', 'Copied'));
    } catch {
      toast.error(t('common.copyFailed', 'Copy failed'));
    }
  }, [detailsText, tool.name, t]);

  const handleRefineDetails = useCallback(
    async (mode: 'expand' | 'shorten') => {
      const language: 'pl' | 'en' = isPolish ? 'pl' : 'en';
      const systemInstruction = [
        `You are a senior transformation consultant.`,
        `Output language MUST be ${language === 'pl' ? 'Polish' : 'English'}.`,
        `Do NOT invent facts. Use only the provided text.`,
        `Return plain text only. No markdown.`,
        mode === 'expand'
          ? `Expand with actionable detail; keep structure.`
          : `Shorten; keep meaning; keep it crisp.`,
      ].join('\n');

      try {
        setDetailsLoading(true);
        const refined = await refineText({
          text: detailsText || initialDetailsText || tool.description || tool.name,
          mode,
          systemInstruction,
          fieldLabel:
            mode === 'expand' ? 'Known tool details (expand)' : 'Known tool details (shorten)',
          artifactContext: {
            id: tool.id,
            title: tool.name,
            type: 'tool',
            status: 'library',
            priority: 'medium',
          },
          language,
        });
        if (!refined) throw new Error('empty');
        setDetailsText(refined);
      } catch {
        toast.error(t('discoveryToolsMain.knownToolPreviewV3.aiUnavailable', 'AI unavailable'));
      } finally {
        setDetailsLoading(false);
      }
    },
    [detailsText, initialDetailsText, isPolish, t, tool.description, tool.id, tool.name]
  );

  const categoryLabel =
    tool.libraryCategory === 'strategic'
      ? t('discoveryToolsMain.knownToolPreviewV3.categoryStrategy', 'Strategy')
      : tool.libraryCategory === 'operational'
        ? t('discoveryToolsMain.knownToolPreviewV3.categoryOperations', 'Operations')
        : tool.libraryCategory === 'digital'
          ? t('discoveryToolsMain.knownToolPreviewV3.categoryDigital', 'Digital')
          : tool.libraryCategory || t('discoveryToolsMain.knownToolPreviewV3.categoryTool', 'Tool');

  const metaPills: MetaPill[] = [
    {
      label: categoryLabel,
      className:
        'border border-slate-200/70 dark:border-white/[0.08] bg-transparent text-slate-700 dark:text-slate-200',
    },
    {
      label: tool.isLicensed ? t('tools.hub.license.licensed') : t('tools.hub.license.free'),
      className: 'bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300',
    },
    {
      label: tool.isActive
        ? t('discoveryToolsMain.knownToolPreviewV3.statusActive', 'Active')
        : t('discoveryToolsMain.knownToolPreviewV3.statusInactive', 'Inactive'),
      className: tool.isActive
        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'
        : 'bg-danger-50 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300',
    },
    ...(tool.isComingSoon
      ? [
          {
            label: t('common.comingSoon'),
            className: 'bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300',
          },
        ]
      : []),
  ];

  const snippetRows: { label: string; value: string; minH: string }[] = [
    {
      label: t('discoveryToolsMain.knownToolPreviewV3.goal', 'Goal'),
      value: previewSnippet.goal,
      minH: 'min-h-[40px]',
    },
    {
      label: t('discoveryToolsMain.knownToolPreviewV3.outcome', 'Outcome'),
      value: previewSnippet.outcome,
      minH: 'min-h-[40px]',
    },
    { label: 'Team', value: previewSnippet.team, minH: 'min-h-[28px]' },
    {
      label: t('discoveryToolsMain.knownToolPreviewV3.aiRole', 'AI Role'),
      value: previewSnippet.aiRole,
      minH: 'min-h-[28px]',
    },
    {
      label: t('discoveryToolsMain.knownToolPreviewV3.duration', 'Duration'),
      value: previewSnippet.duration,
      minH: 'min-h-[20px]',
    },
  ];

  return (
    <div className="space-y-3">
      <PreviewMetaCard
        pills={metaPills}
        trailing={
          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
            {formatDate(tool.createdAt)}
          </span>
        }
      />

      <PreviewDetailsSection
        text=""
        loading={fullLoading || detailsLoading}
        compact
        onExpand={() => void handleRefineDetails('expand')}
        onSummarize={() => void handleRefineDetails('shorten')}
        onCopy={() => void handleCopyDetails()}
        extraCopyFormats={[
          {
            label: t('preview.copyAsMarkdown', 'Copy as Markdown'),
            onClick: () =>
              void copyAsMarkdown(
                { title: tool.name, description: detailsText },
                isPolish ? 'pl' : 'en'
              ),
          },
          {
            label: t('preview.copyForSlack', 'Copy for Slack'),
            onClick: () =>
              void copyForSlack(
                { title: tool.name, description: detailsText },
                isPolish ? 'pl' : 'en'
              ),
          },
        ]}
      >
        <div className="space-y-3">
          {snippetRows.map((row) => (
            <div key={row.label} className={`flex items-start gap-2 ${row.minH}`}>
              <span className="shrink-0 w-[56px] text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-500 pt-0.5">
                {row.label}
              </span>
              <span className="text-xs leading-snug text-slate-700 dark:text-slate-200">
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </PreviewDetailsSection>
    </div>
  );
};

export const KnownToolPreviewV3Footer: React.FC<{
  tool: KnownToolListItem;
  full: KnownToolFull | null;
  fullLoading?: boolean;
  onOpenFull: () => void;
  onStartSession: () => void;
  onChat: () => void;
}> = ({ tool, full, fullLoading, onOpenFull, onStartSession, onChat }) => {
  const { i18n, t } = useTranslation();
  const isPolish = i18n.language?.startsWith('pl');

  const [aiLoading, setAiLoading] = useState(false);
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const lastAiIntentRef = useRef<KnownToolPreviewAiIntent>('when_to_use');

  useEffect(() => {
    setAiLoading(false);
    setAiText(null);
    setAiError(null);
    lastAiIntentRef.current = 'when_to_use';
  }, [tool.id]);

  const runAi = useCallback(
    async (intent: KnownToolPreviewAiIntent) => {
      lastAiIntentRef.current = intent;
      try {
        setAiLoading(true);
        setAiError(null);
        const text = await runKnownToolAi({ intent, isPolish: Boolean(isPolish), t, tool, full });
        if (!text) throw new Error('empty');
        setAiText(text);
      } catch {
        setAiError(t('discoveryToolsMain.knownToolPreviewV3.aiUnavailable', 'AI unavailable'));
      } finally {
        setAiLoading(false);
      }
    },
    [full, isPolish, t, tool]
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
    void runAi(lastAiIntentRef.current || 'when_to_use');
  }, [runAi]);

  const tags = (full?.tags || tool.tags || []).filter(Boolean);
  const visibleTags = tags.slice(0, 6);
  const overflowCount = Math.max(0, tags.length - visibleTags.length);

  const aiHints = [
    t('discoveryToolsMain.knownToolPreviewV3.intentWhenToUse', 'When to use'),
    t('discoveryToolsMain.knownToolPreviewV3.intentFirstSteps', 'First steps'),
    t('discoveryToolsMain.knownToolPreviewV3.hintMistakes', 'Mistakes'),
  ];
  const hintToIntent: Record<string, KnownToolPreviewAiIntent> = {
    [aiHints[0]]: 'when_to_use',
    [aiHints[1]]: 'first_steps',
    [aiHints[2]]: 'common_mistakes',
  };

  const relationItems: RelationItem[] = fullLoading
    ? []
    : [
        ...visibleTags.map((tag) => ({
          label: clampText(tag, 40),
          tone: 'text-slate-700 dark:text-slate-200',
        })),
        ...(overflowCount > 0
          ? [{ label: `+${overflowCount}`, tone: 'text-slate-500 dark:text-slate-400' }]
          : []),
      ];

  const actionRows: ActionRow[] = [
    {
      buttons: [
        {
          label: t('discoveryToolsMain.knownToolPreviewV3.startSession', 'Start session'),
          onClick: onStartSession,
          colorScheme: 'primary',
          disabled: tool.isComingSoon || !tool.isActive,
          shortcut: 'S',
        },
        {
          label: t('common.open', 'Open'),
          onClick: onOpenFull,
          colorScheme: 'primary',
          disabled: !tool.isActive,
          shortcut: 'O',
        },
      ],
      columns: 2,
    },
    {
      buttons: [
        {
          label: t('discoveryToolsMain.knownToolPreviewV3.chat', 'Chat'),
          onClick: onChat,
          colorScheme: 'neutral',
          disabled: !tool.isActive,
          shortcut: 'C',
        },
      ],
    },
  ];

  if (!tool.isActive) {
    return (
      <div className="rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-slate-50/60 dark:bg-white/[0.03] p-2.5 text-xs text-slate-600 dark:text-slate-300">
        {t('discoveryToolsMain.knownToolPreviewV3.toolNotActiveYet')}
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {/* Ramkę bloku 4 rysuje sam `PreviewAIHintStrip` — bez opakowania. */}
      <PreviewAIHintStrip
        hints={aiHints}
        loading={aiLoading || fullLoading}
        result={aiText}
        error={aiError}
        onRunHint={(hint) => void runAi(hintToIntent[hint] ?? 'when_to_use')}
        onRegenerate={handleRegenerateAi}
        onCopy={handleCopyAi}
        onClear={handleClearAi}
      />

      <div className="border-t border-slate-200/50 dark:border-white/[0.06] my-2" />

      <PreviewRelations
        items={relationItems}
        emptyLabel={
          fullLoading
            ? t('discoveryToolsMain.knownToolPreviewV3.loadingEllipsis', 'Loading…')
            : t('preview.noRelations', 'No relations')
        }
      />

      <div className="border-t border-slate-200/50 dark:border-white/[0.06] my-2" />

      <PreviewActionBar rows={actionRows} />
    </div>
  );
};
