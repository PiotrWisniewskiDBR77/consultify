import { Copy, Loader2, MoreVertical, Sparkles } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

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
    artifactContext: { id: tool.id, title: tool.name, type: 'tool', status: 'library', priority: 'medium' },
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

  const [detailsMenuOpen, setDetailsMenuOpen] = useState(false);
  const [detailsText, setDetailsText] = useState<string>('');
  const [detailsLoading, setDetailsLoading] = useState(false);

  const initialDetailsText = useMemo(() => {
    const lines: string[] = [];
    const desc = String(full?.description || tool.description || '').trim();
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
  }, [full, tool.description, tool.whatYouGet, isPolish]);

  useEffect(() => {
    setDetailsText(initialDetailsText);
    setDetailsMenuOpen(false);
    setDetailsLoading(false);
  }, [tool.id, initialDetailsText]);

  const handleCopyDetails = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(detailsText || tool.name || '');
      toast.success(isPolish ? 'Skopiowano' : 'Copied');
    } catch {
      toast.error(isPolish ? 'Nie udało się skopiować' : 'Copy failed');
    } finally {
      setDetailsMenuOpen(false);
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
        mode === 'expand' ? `Expand with actionable detail; keep structure.` : `Shorten; keep meaning; keep it crisp.`,
      ].join('\n');

      try {
        setDetailsLoading(true);
        const refined = await refineText({
          text: detailsText || initialDetailsText || tool.description || tool.name,
          mode,
          systemInstruction,
          fieldLabel: mode === 'expand' ? 'Known tool details (expand)' : 'Known tool details (shorten)',
          artifactContext: { id: tool.id, title: tool.name, type: 'tool', status: 'library', priority: 'medium' },
          language,
        });
        if (!refined) throw new Error('empty');
        setDetailsText(refined);
      } catch {
        toast.error(isPolish ? 'AI niedostępne' : 'AI unavailable');
      } finally {
        setDetailsLoading(false);
        setDetailsMenuOpen(false);
      }
    },
    [detailsText, initialDetailsText, isPolish, tool.description, tool.id, tool.name]
  );

  const metaPillBase = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium';
  const neutralMetaPill = `${metaPillBase} bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300`;

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

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            <span className={`${metaPillBase} border border-slate-200/70 dark:border-white/[0.08] bg-transparent text-slate-700 dark:text-slate-200`}>
              {categoryLabel}
            </span>
            <span className={neutralMetaPill}>
              {tool.isLicensed
                ? t('tools.hub.license.licensed', isPolish ? 'Licencja' : 'Licensed')
                : t('tools.hub.license.free', isPolish ? 'Darmowe' : 'Free')}
            </span>
            {tool.isComingSoon ? (
              <span className={neutralMetaPill}>{t('common.comingSoon', isPolish ? 'Wkrótce' : 'Coming soon')}</span>
            ) : null}
          </div>
          <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 shrink-0">
            {formatDate(tool.createdAt)}
          </div>
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
                <div className="absolute right-0 top-full mt-1 z-50 min-w-[190px] rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-white dark:bg-navy-900 shadow-lg py-1 overflow-hidden">
                  <button
                    onClick={() => void handleRefineDetails('expand')}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors"
                  >
                    <Sparkles size={12} />
                    {isPolish ? 'Rozwiń' : 'Expand'}
                  </button>
                  <button
                    onClick={() => void handleRefineDetails('shorten')}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors"
                  >
                    <Sparkles size={12} />
                    {isPolish ? 'Podsumuj' : 'Summarize'}
                  </button>
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

        {fullLoading || detailsLoading ? (
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
                {isPolish ? 'Brak szczegółów.' : 'No details.'}
              </span>
            )}
          </div>
        )}
      </div>
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

  const footerPillBase =
    'inline-flex items-center justify-center gap-1.5 h-9 rounded-full border px-3 text-xs font-medium transition-colors duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900';
  const hintChip =
    'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[11px] font-medium border border-slate-200/70 dark:border-white/[0.08] bg-transparent text-slate-600 dark:text-slate-300 hover:bg-slate-100/50 dark:hover:bg-white/[0.04] transition-colors cursor-pointer active:scale-[0.98] disabled:opacity-40';

  const [aiMenuOpen, setAiMenuOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const lastAiIntentRef = useRef<KnownToolPreviewAiIntent>('when_to_use');

  useEffect(() => {
    setAiMenuOpen(false);
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
    void runAi(lastAiIntentRef.current || 'when_to_use');
  }, [runAi]);

  const tags = (full?.tags || tool.tags || []).filter(Boolean);
  const visibleTags = tags.slice(0, 6);
  const overflowCount = Math.max(0, tags.length - visibleTags.length);

  return (
    <div className="space-y-0">
      <div className="py-1">
        <div className="flex items-center justify-between gap-2 mb-1.5">
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

        <div className="flex flex-wrap gap-1.5">
          <button
            className={hintChip}
            onClick={() => {
              void runAi('when_to_use');
            }}
            disabled={aiLoading || fullLoading}
          >
            {isPolish ? 'Kiedy użyć' : 'When to use'}
          </button>
          <button
            className={hintChip}
            onClick={() => {
              void runAi('first_steps');
            }}
            disabled={aiLoading || fullLoading}
          >
            {isPolish ? 'Pierwsze kroki' : 'First steps'}
          </button>
          <button
            className={hintChip}
            onClick={() => {
              void runAi('common_mistakes');
            }}
            disabled={aiLoading || fullLoading}
          >
            {isPolish ? 'Błędy' : 'Mistakes'}
          </button>
        </div>

        {aiLoading ? (
          <div className="mt-2 text-xs text-slate-400 dark:text-slate-500">
            {isPolish ? 'Analiza…' : 'Thinking…'}
          </div>
        ) : aiError ? (
          <div className="mt-2 text-xs text-red-600 dark:text-red-400">{aiError}</div>
        ) : aiText ? (
          <div className="mt-2 text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{aiText}</div>
        ) : null}
      </div>

      <div className="border-t border-slate-200/50 dark:border-white/[0.06] my-3" />

      <div className="min-h-[4.5rem]">
        <div className="flex flex-wrap gap-2 py-1">
          {fullLoading ? (
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {isPolish ? 'Ładowanie…' : 'Loading…'}
            </span>
          ) : visibleTags.length > 0 ? (
            <>
              {visibleTags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center h-7 px-2.5 rounded-full text-[11px] font-medium border border-slate-200/70 dark:border-white/[0.08] bg-transparent text-slate-700 dark:text-slate-200"
                  title={tag}
                >
                  {clampText(tag, 40)}
                </span>
              ))}
              {overflowCount > 0 ? (
                <span className="text-[11px] text-slate-500 dark:text-slate-400">+{overflowCount}</span>
              ) : null}
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
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onStartSession}
            disabled={tool.isComingSoon}
            className={`${footerPillBase} border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-white/[0.06] ${
              tool.isComingSoon ? 'opacity-60 cursor-not-allowed' : ''
            }`}
          >
            {isPolish ? 'Start sesji' : 'Start session'}
          </button>
          <button
            onClick={onOpenFull}
            className={`${footerPillBase} border-primary-500/30 bg-primary-500/10 text-primary-700 dark:text-primary-300 hover:bg-primary-500/15`}
          >
            {t('common.open', 'Open')}
          </button>
        </div>
        <button
          onClick={onChat}
          className={`${footerPillBase} w-full border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-white/[0.06]`}
        >
          {isPolish ? 'Czat' : 'Chat'}
        </button>
      </div>
    </div>
  );
};

