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

const formatDate = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
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

async function runKnownToolAi(params: {
  intent: KnownToolPreviewAiIntent;
  isPolish: boolean;
  tool: KnownToolListItem;
  full: KnownToolFull | null;
}): Promise<string> {
  const { intent, isPolish, tool, full } = params;
  const language: 'pl' | 'en' = isPolish ? 'pl' : 'en';

  const intentLabel =
    intent === 'when_to_use'
      ? isPolish
        ? 'Kiedy użyć'
        : 'When to use'
      : intent === 'first_steps'
        ? isPolish
          ? 'Pierwsze kroki'
          : 'First steps'
        : isPolish
          ? 'Typowe błędy'
          : 'Common mistakes';

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

  const previewSnippet = useMemo((): PreviewSnippet => {
    if (tool.toolType === 'dynamic-swot') {
      return isPolish
        ? {
            goal: 'Zamienia rozproszoną rozmowę strategiczną w decision-grade diagnozę opartą na evidence.',
            outcome:
              'Rama decyzji, napięcia strategiczne, rekomendowane ruchy i materiał źródłowy.',
            team: 'C-level / właściciele, lider strategii lub dyrektor operacyjny',
            aiRole: 'Moderator sesji, analityk evidence, generator napięć i rekomendacji',
            duration: '60-90 min',
          }
        : {
            goal: 'Turns a fragmented strategic conversation into a decision-grade diagnosis backed by evidence.',
            outcome: 'Decision frame, strategic tensions, recommended moves, and source material.',
            team: 'C-level / owners, strategy lead or COO',
            aiRole: 'Session moderator, evidence analyst, tension & recommendation generator',
            duration: '60-90 min',
          };
    }

    if (tool.toolType === 'market-forces') {
      return isPolish
        ? {
            goal: 'Zamienia kontekst rynku i wywiadu w ocenę presji konkurencyjnej, defensibility i presji marży.',
            outcome:
              'Scorecard 5 sił, implikacje strategiczne, rekomendowane ruchy i kandydaci na inicjatywy.',
            team: 'Zarząd, strategy lead, commercial lead lub właściciel rynku',
            aiRole: 'Analityk rynku, moderator evidence i generator propozycji do akceptacji',
            duration: '60-90 min',
          }
        : {
            goal: 'Turns market and interview context into a read on competitive pressure, defensibility, and margin pressure.',
            outcome:
              'Five Forces scorecard, strategic implications, recommended moves, and initiative candidates.',
            team: 'Leadership, strategy lead, commercial lead, or market owner',
            aiRole: 'Market analyst, evidence moderator, and proposal generator for approval',
            duration: '60-90 min',
          };
    }

    if (tool.toolType === 'growth-paths') {
      return isPolish
        ? {
            goal: 'Zamienia ambicję wzrostu i sygnały z wywiadu w opcje Ansoffa oraz sekwencję decyzji.',
            outcome:
              'Macierz opcji, porównanie trade-offów, rekomendowane ruchy i kandydaci na inicjatywy.',
            team: 'Zarząd, strategy lead, commercial lead lub właściciel wzrostu',
            aiRole: 'Moderator growth evidence, generator opcji i konsultant sekwencji ruchów',
            duration: '60-90 min',
          }
        : {
            goal: 'Turns growth ambition and interview signals into Ansoff options and a decision sequence.',
            outcome:
              'Option matrix, trade-off comparison, recommended moves, and initiative candidates.',
            team: 'Leadership, strategy lead, commercial lead, or growth owner',
            aiRole: 'Growth evidence moderator, option generator, and move-sequencing consultant',
            duration: '60-90 min',
          };
    }

    if (tool.toolType === 'portfolio-priority') {
      return isPolish
        ? {
            goal: 'Zamienia kontekst organizacji i wywiadu w decyzje, które elementy portfolio finansować, testować, utrzymać lub wygasić.',
            outcome:
              'Macierz BCG, trade-offy alokacji zasobów, rekomendowane ruchy i kandydaci na inicjatywy.',
            team: 'Zarząd, strategy lead, product lead, CFO lub właściciel portfolio',
            aiRole:
              'Analityk portfolio, generator kart do akceptacji i konsultant alokacji zasobów',
            duration: '60-90 min',
          }
        : {
            goal: 'Turns organization and interview context into decisions on which portfolio items to fund, test, maintain, or stop.',
            outcome:
              'BCG matrix, resource allocation trade-offs, recommended moves, and initiative candidates.',
            team: 'Leadership, strategy lead, product lead, CFO, or portfolio owner',
            aiRole:
              'Portfolio analyst, card proposal generator, and resource allocation consultant',
            duration: '60-90 min',
          };
    }

    if (tool.toolType === 'risk-uncertainty') {
      return isPolish
        ? {
            goal: 'Zamienia kontekst decyzji i sygnały z wywiadu w mapę założeń, ryzyk i scenariuszy.',
            outcome:
              'Założenia do walidacji, ryzyka, scenariusze, ruchy odporności i kandydaci na inicjatywy.',
            team: 'Zarząd, strategy lead, transformation lead, PMO lub właściciel ryzyka',
            aiRole: 'Analityk ryzyka, generator kart do akceptacji i konsultant odporności',
            duration: '60-90 min',
          }
        : {
            goal: 'Turns decision context and interview signals into an assumption, risk, and scenario map.',
            outcome:
              'Assumptions to validate, risks, scenarios, resilience moves, and initiative candidates.',
            team: 'Leadership, strategy lead, transformation lead, PMO, or risk owner',
            aiRole: 'Risk analyst, card proposal generator, and resilience consultant',
            duration: '60-90 min',
          };
    }

    const desc = String(full?.description || tool.description || '').trim();
    const fallbackGoal = desc || (isPolish ? 'Narzędzie w przygotowaniu.' : 'Tool in preparation.');
    const fallbackOutcome =
      (full?.whatYouGet || tool.whatYouGet || []).slice(0, 2).join(', ') || (isPolish ? '—' : '—');

    return {
      goal: fallbackGoal,
      outcome: fallbackOutcome,
      team: isPolish ? 'Zależy od narzędzia' : 'Depends on the tool',
      aiRole: isPolish ? 'Asystent i moderator sesji' : 'Session assistant and moderator',
      duration: isPolish ? 'Zależy od zakresu' : 'Depends on scope',
    };
  }, [full, isPolish, tool.description, tool.toolType, tool.whatYouGet]);

  const initialDetailsText = useMemo(() => {
    const s = previewSnippet;
    const goalL = isPolish ? 'Cel' : 'Goal';
    const outcomeL = isPolish ? 'Rezultat' : 'Outcome';
    const teamL = 'Team';
    const aiL = isPolish ? 'Rola AI' : 'AI Role';
    const durL = isPolish ? 'Czas' : 'Duration';
    return `${goalL}: ${s.goal}\n${outcomeL}: ${s.outcome}\n${teamL}: ${s.team}\n${aiL}: ${s.aiRole}\n${durL}: ${s.duration}`;
  }, [previewSnippet, isPolish]);

  useEffect(() => {
    setDetailsText(initialDetailsText);
    setDetailsLoading(false);
  }, [tool.id, initialDetailsText]);

  const handleCopyDetails = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(detailsText || tool.name || '');
      toast.success(isPolish ? 'Skopiowano' : 'Copied');
    } catch {
      toast.error(isPolish ? 'Nie udało się skopiować' : 'Copy failed');
    }
  }, [detailsText, tool.name, isPolish]);

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
        toast.error(isPolish ? 'AI niedostępne' : 'AI unavailable');
      } finally {
        setDetailsLoading(false);
      }
    },
    [detailsText, initialDetailsText, isPolish, tool.description, tool.id, tool.name]
  );

  const categoryLabel =
    tool.libraryCategory === 'strategic'
      ? isPolish
        ? 'Strategia'
        : 'Strategy'
      : tool.libraryCategory === 'operational'
        ? isPolish
          ? 'Operacje'
          : 'Operations'
        : tool.libraryCategory === 'digital'
          ? isPolish
            ? 'Digital'
            : 'Digital'
          : tool.libraryCategory || (isPolish ? 'Narzędzie' : 'Tool');

  const metaPills: MetaPill[] = [
    {
      label: categoryLabel,
      className:
        'border border-slate-200/70 dark:border-white/[0.08] bg-transparent text-slate-700 dark:text-slate-200',
    },
    {
      label: tool.isLicensed
        ? t('tools.hub.license.licensed', isPolish ? 'Licencja' : 'Licensed')
        : t('tools.hub.license.free', isPolish ? 'Darmowe' : 'Free'),
      className: 'bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300',
    },
    {
      label: tool.isActive
        ? isPolish
          ? 'Aktywny'
          : 'Active'
        : isPolish
          ? 'Nieaktywny'
          : 'Inactive',
      className: tool.isActive
        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'
        : 'bg-danger-50 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300',
    },
    ...(tool.isComingSoon
      ? [
          {
            label: t('common.comingSoon', isPolish ? 'Wkrótce' : 'Coming soon'),
            className: 'bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300',
          },
        ]
      : []),
  ];

  const snippetRows: { label: string; value: string; minH: string }[] = [
    { label: isPolish ? 'Cel' : 'Goal', value: previewSnippet.goal, minH: 'min-h-[40px]' },
    {
      label: isPolish ? 'Rezultat' : 'Outcome',
      value: previewSnippet.outcome,
      minH: 'min-h-[40px]',
    },
    { label: 'Team', value: previewSnippet.team, minH: 'min-h-[28px]' },
    { label: isPolish ? 'Rola AI' : 'AI Role', value: previewSnippet.aiRole, minH: 'min-h-[28px]' },
    { label: isPolish ? 'Czas' : 'Duration', value: previewSnippet.duration, minH: 'min-h-[20px]' },
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
            label: isPolish ? 'Kopiuj jako Markdown' : 'Copy as Markdown',
            onClick: () =>
              void copyAsMarkdown(
                { title: tool.name, description: detailsText },
                isPolish ? 'pl' : 'en'
              ),
          },
          {
            label: isPolish ? 'Kopiuj dla Slack' : 'Copy for Slack',
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
        const text = await runKnownToolAi({ intent, isPolish: Boolean(isPolish), tool, full });
        if (!text) throw new Error('empty');
        setAiText(text);
      } catch {
        setAiError(isPolish ? 'AI niedostępne' : 'AI unavailable');
      } finally {
        setAiLoading(false);
      }
    },
    [full, isPolish, tool]
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
    void runAi(lastAiIntentRef.current || 'when_to_use');
  }, [runAi]);

  const tags = (full?.tags || tool.tags || []).filter(Boolean);
  const visibleTags = tags.slice(0, 6);
  const overflowCount = Math.max(0, tags.length - visibleTags.length);

  const aiHints = [
    isPolish ? 'Kiedy użyć' : 'When to use',
    isPolish ? 'Pierwsze kroki' : 'First steps',
    isPolish ? 'Błędy' : 'Mistakes',
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
          label: isPolish ? 'Start sesji' : 'Start session',
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
          label: isPolish ? 'Czat' : 'Chat',
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
        {isPolish
          ? 'To narzędzie jest jeszcze nieaktywne. Możesz zobaczyć opis, ale nie otworzysz pełnego widoku ani sesji.'
          : 'This tool is not active yet. You can see the description, but cannot open the full view or start a session.'}
      </div>
    );
  }

  return (
    <div className="space-y-0">
      <div className="rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-slate-50/60 dark:bg-white/[0.03] p-2">
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
      </div>

      <div className="border-t border-slate-200/50 dark:border-white/[0.06] my-2" />

      <PreviewRelations
        items={relationItems}
        emptyLabel={
          fullLoading
            ? isPolish
              ? 'Ładowanie…'
              : 'Loading…'
            : isPolish
              ? 'Brak powiązań'
              : 'No relations'
        }
      />

      <div className="border-t border-slate-200/50 dark:border-white/[0.06] my-2" />

      <PreviewActionBar rows={actionRows} />
    </div>
  );
};
