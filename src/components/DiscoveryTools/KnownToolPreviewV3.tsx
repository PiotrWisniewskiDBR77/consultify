import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import {
  PreviewMetaCard,
  PreviewDetailsSection,
  PreviewAIHintStrip,
  PreviewRelations,
  PreviewActionBar,
  type MetaPill,
  type RelationItem,
  type ActionRow,
  type ExtraCopyFormat,
} from '@/components/shared/PreviewPane';
import { copyAsMarkdown, copyForSlack } from '@/utils/clipboard';
import { Api } from '@/services/api';

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

  const initialDetailsText = useMemo(() => {
    const desc = String(full?.description || tool.description || '').trim();
    if (!tool.isActive) {
      return desc || (isPolish ? 'Narzędzie w przygotowaniu.' : 'Tool in preparation.');
    }

    if (tool.toolType === 'dynamic-swot') {
      return isPolish
        ? [
            'CEL',
            'Dynamic SWOT zamienia rozproszoną rozmowę strategiczną w decision-grade diagnozę. Porządkuje evidence z wnętrza firmy i z rynku, buduje napięcia strategiczne oraz prowadzi do ruchów, które realnie zawężają pole decyzji.',
            '',
            'KIEDY UŻYĆ',
            '- gdy zarząd lub zespół ma dużo sygnałów, ale nie ma jednej logiki decyzji',
            '- gdy trzeba połączyć realia wewnętrzne z rynkiem i dojść do wniosku, a nie tylko opisu sytuacji',
            '- gdy wynik ma od razu zasilić raport, deck, brief inicjatywy albo dalszą eksplorację',
            '',
            'JAK PRACUJE',
            '- zaczyna od mission briefu: pytania, zakresu, horyzontu, success signal i constraints',
            '- zbiera sygnały z rozmów, materiałów i benchmarków, a następnie porządkuje je w trybie evidence-first',
            '- buduje selektywną macierz SWOT i przechodzi do logiki napięć typu attack / repair / defend / protect',
            '- kończy sesję rekomendowanymi ruchami i materiałem źródłowym do dalszego użycia',
            '',
            'CO POWSTAJE',
            '- rama decyzji i executive diagnoza sytuacji',
            '- obraz czynników wraz z jakością evidence',
            '- napięcia strategiczne, rekomendowane ruchy i ich kolejność',
            '- materiał źródłowy do raportu, prezentacji i inicjatyw',
            '',
            'PRZYKŁAD',
            'Firma myśli o kosztownej automatyzacji, ale Dynamic SWOT pokazuje, że prawdziwym problemem nie jest jeszcze brak technologii. Najpierw trzeba zdiagnozować straty, bottlenecks i brak wspólnej prawdy o sytuacji, a dopiero potem wybierać ruch transformacyjny.',
          ].join('\n')
        : [
            'GOAL',
            'Dynamic SWOT turns a fragmented strategic conversation into a decision-grade diagnosis. It structures evidence from inside the company and the market, builds strategic tensions, and leads to moves that genuinely narrow the choice.',
            '',
            'WHEN TO USE',
            '- when leadership has many signals but no single decision logic',
            '- when internal reality must be confronted with market evidence and turned into a conclusion, not just an analysis',
            '- when the output should immediately feed a report, deck, initiative brief, or follow-on exploration',
            '',
            'HOW IT WORKS',
            '- starts with a mission brief: question, scope, time horizon, success signal, and constraints',
            '- gathers signals from interviews, materials, and benchmarks, then cleans them in an evidence-first way',
            '- builds a selective SWOT matrix and moves into attack / repair / defend / protect tension logic',
            '- closes with recommended moves and a source package for downstream use',
            '',
            'WHAT YOU GET',
            '- a decision frame and an executive diagnosis of the situation',
            '- a factor picture with visible evidence quality',
            '- strategic tensions, recommended moves, and move sequence',
            '- a source package for reports, decks, and initiatives',
            '',
            'EXAMPLE',
            'A company is considering expensive automation, but Dynamic SWOT shows that the real issue is not missing technology yet. The first step is diagnosing losses, bottlenecks, and the missing shared picture of reality, and only then does the transformation move make sense.',
          ].join('\n');
    }

    const lines: string[] = [];
    if (desc) lines.push(desc);
    if (full?.whenToUse) {
      lines.push('');
      lines.push(isPolish ? 'Kiedy użyć:' : 'When to use:');
      lines.push(String(full.whenToUse).trim());
    }
    if ((full?.whatYouGet || tool.whatYouGet || []).length) {
      lines.push('');
      lines.push(isPolish ? 'Co dostajesz:' : 'What you get:');
      for (const item of (full?.whatYouGet || tool.whatYouGet || []).slice(0, 8)) {
        lines.push(`- ${String(item).trim()}`);
      }
    }
    if ((full?.steps || []).length) {
      lines.push('');
      lines.push(isPolish ? 'Kroki:' : 'Steps:');
      for (const s of (full?.steps || []).slice(0, 6)) {
        lines.push(`- ${String(s).trim()}`);
      }
    }
    return lines.join('\n').trim();
  }, [full, isPolish, tool.description, tool.isActive, tool.toolType, tool.whatYouGet]);

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
      label: tool.isActive ? (isPolish ? 'Aktywny' : 'Active') : isPolish ? 'Nieaktywny' : 'Inactive',
      className: tool.isActive
        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'
        : 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300',
    },
    ...(tool.isComingSoon
      ? [{ label: t('common.comingSoon', isPolish ? 'Wkrótce' : 'Coming soon'), className: 'bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300' }]
      : []),
  ];

  return (
    <div className="space-y-4">
      <PreviewMetaCard
        pills={metaPills}
        trailing={
          <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
            {formatDate(tool.createdAt)}
          </span>
        }
      />

      <PreviewDetailsSection
        text={detailsText || (isPolish ? 'Brak szczegółów.' : 'No details.')}
        loading={fullLoading || detailsLoading}
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
      />
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
        ...(overflowCount > 0 ? [{ label: `+${overflowCount}`, tone: 'text-slate-500 dark:text-slate-400' }] : []),
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
      <div className="rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-slate-50/60 dark:bg-white/[0.03] p-3 text-sm text-slate-600 dark:text-slate-300">
        {isPolish
          ? 'To narzędzie jest jeszcze nieaktywne. W preview możesz zobaczyć tylko opis, ale nie otworzysz jeszcze pełnego widoku ani sesji.'
          : 'This tool is not active yet. In preview you can only see the description, but you cannot open the full view or start a session yet.'}
      </div>
    );
  }

  return (
    <div className="space-y-0">
      <div className="rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-slate-50/60 dark:bg-white/[0.03] p-2.5">
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

      <div className="border-t border-slate-200/50 dark:border-white/[0.06] my-3" />

      <PreviewRelations
        items={relationItems}
        emptyLabel={fullLoading ? (isPolish ? 'Ładowanie…' : 'Loading…') : (isPolish ? 'Brak powiązań' : 'No relations')}
      />

      <div className="border-t border-slate-200/50 dark:border-white/[0.06] my-3" />

      <PreviewActionBar rows={actionRows} />
    </div>
  );
};
