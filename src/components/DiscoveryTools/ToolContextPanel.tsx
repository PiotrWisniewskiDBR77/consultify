/**
 * ToolContextPanel
 * Active AI collaboration panel for tool sessions.
 */

import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Lightbulb,
  MessageSquareText,
  Sparkles,
  Target,
} from 'lucide-react';
import React from 'react';

import {
  computeDynamicSwotOverallReadiness,
  computeDynamicSwotPhaseSummaries,
  computeDynamicSwotSessionSignals,
} from '@/components/DiscoveryTools/toolCompletion';
import { PorterData, SWOTData, ToolSession, ToolType } from '@/store/useToolStore';

interface ToolContextPanelProps {
  toolType: ToolType;
  session: ToolSession;
  currentStepId?: string;
  isPolish: boolean;
  orgName?: string | null;
  aiContent?: string;
  onOpenChat: () => void;
  onGenerateFullSession?: () => void;
  onOpenInitiatives?: () => void;
  generatedInitiatives?: { id: string; title: string; status?: string }[];
  recentInitiatives?: { id: string; title: string; status?: string }[];
  chatSnippets?: { role: string; content: string }[];
  embedded?: boolean;
}

const getReadinessTone = (readiness: 'blocked' | 'needs-work' | 'ready') =>
  readiness === 'ready'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300'
    : readiness === 'needs-work'
      ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300'
      : 'border-danger-200 bg-danger-50 text-danger-700 dark:border-danger-900/40 dark:bg-danger-900/20 dark:text-danger-300';

const getDynamicSwotCoach = (currentStepId: string | undefined, isPolish: boolean) => {
  const map = {
    mission: {
      nextQuestion: isPolish
        ? 'Jaka decyzja naprawdę ma zostać podjęta po tej sesji?'
        : 'What concrete decision should this session unlock?',
      whyNow: isPolish
        ? 'Bez ostrego pytania AI będzie generować ogólniki zamiast materiału do decyzji.'
        : 'Without a sharp question, AI will produce generic guidance instead of decision support.',
    },
    input: {
      nextQuestion: isPolish
        ? 'Jakich dowodów jeszcze brakuje, żeby nie budować SWOT-u na opiniach?'
        : 'Which evidence is still missing so the SWOT is not built on opinions?',
      whyNow: isPolish
        ? 'To jest moment na higienę sygnałów: źródło, typ dowodu, pewność i luki.'
        : 'This is the moment for signal hygiene: source, evidence type, confidence, and gaps.',
    },
    swot: {
      nextQuestion: isPolish
        ? 'Które karty są już akceptowalne, a które nadal są tylko propozycją AI?'
        : 'Which cards are accepted, and which ones are still only AI proposals?',
      whyNow: isPolish
        ? 'Macierz ma być warstwą syntezy, nie zrzutem wszystkich notatek.'
        : 'The matrix should be a synthesis layer, not a dump of all notes.',
    },
    insights: {
      nextQuestion: isPolish
        ? 'Jakie napięcie lub trade-off naprawdę wymaga ruchu strategicznego teraz?'
        : 'Which tension or trade-off truly requires a strategic move now?',
      whyNow: isPolish
        ? 'To tutaj narzędzie przestaje być tabelą, a staje się materiałem decyzyjnym.'
        : 'This is where the tool stops being a table and becomes decision material.',
    },
    outputs: {
      nextQuestion: isPolish
        ? 'Co z tej sesji jest gotowe na inicjatywę, a co wymaga jeszcze decku lub dowodów?'
        : 'What is ready for an initiative, and what still needs a deck or more evidence?',
      whyNow: isPolish
        ? 'Końcowa wartość narzędzia zależy od jakości mostu do outputów.'
        : 'The tool’s final value depends on the quality of the bridge to outputs.',
    },
  } as const;

  return (
    map[currentStepId as keyof typeof map] || {
      nextQuestion: isPolish
        ? 'Co jest teraz najważniejszą luką?'
        : 'What is the most important gap right now?',
      whyNow: isPolish
        ? 'Panel AI pokazuje następny najlepszy ruch.'
        : 'The AI panel shows the next best move.',
    }
  );
};

export const ToolContextPanel: React.FC<ToolContextPanelProps> = ({
  toolType,
  session,
  currentStepId,
  isPolish,
  orgName,
  aiContent,
  onOpenChat,
  onGenerateFullSession,
  onOpenInitiatives,
  generatedInitiatives = [],
  recentInitiatives = [],
  chatSnippets = [],
  embedded = false,
}) => {
  const [missionComment, setMissionComment] = React.useState('');
  const generationStatus = session.sessionGenerationStatus || 'idle';
  const swotData = toolType === 'dynamic-swot' ? (session.inputData as SWOTData) : null;
  const readiness = swotData ? computeDynamicSwotOverallReadiness(swotData, isPolish) : null;

  const proposalCounts = swotData
    ? {
        signals: swotData.signals.filter((s) => s.proposalStatus === 'ai-proposed').length,
        items: swotData.items.filter((i) => i.proposalStatus === 'ai-proposed').length,
        tensions: swotData.tensions.filter((t) => t.proposalStatus === 'ai-proposed').length,
        moves: swotData.recommendedMoves.filter((m) => m.proposalStatus === 'ai-proposed').length,
        outputs: swotData.outputCandidates.filter((o) => o.proposalStatus === 'ai-proposed').length,
        total: 0,
      }
    : null;
  if (proposalCounts) {
    proposalCounts.total =
      proposalCounts.signals +
      proposalCounts.items +
      proposalCounts.tensions +
      proposalCounts.moves +
      proposalCounts.outputs;
  }

  const acceptedCounts = swotData
    ? {
        signals: swotData.signals.filter((s) => s.proposalStatus === 'accepted').length,
        items: swotData.items.filter((i) => i.proposalStatus === 'accepted').length,
        tensions: swotData.tensions.filter((t) => t.proposalStatus === 'accepted').length,
        moves: swotData.recommendedMoves.filter((m) => m.proposalStatus === 'accepted').length,
        outputs: swotData.outputCandidates.filter((o) => o.proposalStatus === 'accepted').length,
        total: 0,
      }
    : null;
  if (acceptedCounts) {
    acceptedCounts.total =
      acceptedCounts.signals +
      acceptedCounts.items +
      acceptedCounts.tensions +
      acceptedCounts.moves +
      acceptedCounts.outputs;
  }
  const phaseSummaries = swotData ? computeDynamicSwotPhaseSummaries(swotData, isPolish) : [];
  const swotSignals = swotData ? computeDynamicSwotSessionSignals(swotData, isPolish) : null;
  const coach = toolType === 'dynamic-swot' ? getDynamicSwotCoach(currentStepId, isPolish) : null;
  const proposalQueue = swotData
    ? [
        ...swotData.signals
          .filter((signal) => signal.state === 'proposed')
          .slice(0, 3)
          .map((signal) => signal.content),
        ...swotData.items
          .filter((item) => item.status === 'proposed')
          .slice(0, 3)
          .map((item) => item.text),
      ].slice(0, 5)
    : [];
  const porterData = toolType === 'market-forces' ? (session.inputData as PorterData) : null;
  const isDynamicSwotMission = toolType === 'dynamic-swot' && currentStepId === 'mission';

  if (embedded) {
    const insightText =
      aiContent ||
      coach?.whyNow ||
      (readiness
        ? readiness.label
        : isPolish
          ? 'AI analizuje bieżącą fazę narzędzia, kompletność danych i gotowość do przejścia w outputy.'
          : 'AI reviews the current tool phase, data completeness, and readiness to move into outputs.');
    const recommendations = [
      coach?.nextQuestion,
      swotSignals?.missingEvidence?.[0],
      generatedInitiatives.length > 0
        ? isPolish
          ? 'Sprawdź, które wygenerowane inicjatywy powinny przejść do portfela wykonawczego.'
          : 'Review which generated initiatives should move into the execution portfolio.'
        : null,
    ].filter(Boolean) as string[];

    return (
      <div className="space-y-5">
        <div className="rounded-3xl border border-primary-200/70 bg-primary-500/5 p-5 dark:border-primary-900/40 dark:bg-primary-950/10">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-700 dark:text-primary-300">
                AI Collaboration Panel
              </div>
              <h2 className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">
                {isPolish ? 'Centrum pracy AI dla tej sesji' : 'AI workspace for this session'}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {isPolish
                  ? 'Tu trafiają wszystkie podpowiedzi, rekomendacje i uzasadnienia AI. Panel nie zabiera już szerokości canvasowi narzędzia.'
                  : 'All AI hints, recommendations, and rationale live here. The panel no longer takes width away from the tool canvas.'}
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenChat}
              className="inline-flex items-center gap-2 rounded-full border border-primary-300/50 bg-white/70 px-4 py-2 text-sm font-medium text-primary-700 transition-colors hover:bg-white dark:border-primary-800/50 dark:bg-white/[0.04] dark:text-primary-200"
            >
              <MessageSquareText className="h-4 w-4" />
              {isPolish ? 'Otwórz chat' : 'Open chat'}
            </button>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-5 dark:border-navy-700/70 dark:bg-navy-900/50">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
              <Sparkles className="h-4 w-4 text-primary-500" />
              <span>AI insights</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {insightText}
            </p>
            {readiness && (
              <div
                className={`mt-4 rounded-2xl border px-3 py-2 text-xs ${getReadinessTone(readiness.readiness)}`}
              >
                {readiness.label}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-5 dark:border-navy-700/70 dark:bg-navy-900/50">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              <span>AI recommendations</span>
            </div>
            <div className="mt-3 space-y-2">
              {(recommendations.length > 0
                ? recommendations
                : [
                    isPolish
                      ? 'Doprecyzuj brakujące dane wejściowe, zaakceptuj wartościowe karty AI i przejdź do syntezy outputów.'
                      : 'Clarify missing inputs, accept useful AI cards, and move into output synthesis.',
                  ]
              ).map((item, index) => (
                <div
                  key={`${item}-${index}`}
                  className="rounded-2xl bg-slate-50/80 px-3 py-2 text-sm text-slate-600 dark:bg-navy-950/50 dark:text-slate-300"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-5 dark:border-navy-700/70 dark:bg-navy-900/50">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
              <BookOpen className="h-4 w-4 text-slate-500" />
              <span>{isPolish ? 'Organization context' : 'Organization context'}</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {orgName || (isPolish ? 'Brak profilu organizacji' : 'No organization profile')}
            </p>
            <div className="mt-4 rounded-2xl border border-slate-200/70 bg-slate-50/80 px-3 py-2 text-xs leading-relaxed text-slate-500 dark:border-navy-700/70 dark:bg-navy-950/50 dark:text-slate-400">
              {isPolish
                ? 'Uzasadnienie AI: rekomendacje powinny być interpretowane przez pryzmat organizacji, jej aktualnego kontekstu i celu sesji, a nie jako generyczna lista dobrych praktyk.'
                : 'AI rationale: recommendations should be interpreted through the organization, current context, and session goal, not as a generic best-practice list.'}
            </div>
          </div>
        </div>

        {swotData && (
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-5 dark:border-navy-700/70 dark:bg-navy-900/50">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span>{isPolish ? 'Kolejka propozycji AI' : 'AI proposal queue'}</span>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {[
                  [isPolish ? 'Sygnały' : 'Signals', proposalCounts?.signals || 0],
                  [isPolish ? 'Karty' : 'Cards', proposalCounts?.items || 0],
                  [isPolish ? 'Napięcia' : 'Tensions', proposalCounts?.tensions || 0],
                  [isPolish ? 'Outputy' : 'Outputs', proposalCounts?.outputs || 0],
                ].map(([label, value]) => (
                  <div
                    key={String(label)}
                    className="rounded-2xl bg-slate-50/80 px-3 py-2 dark:bg-navy-950/50"
                  >
                    <div className="text-[11px] text-slate-600">{label}</div>
                    <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-5 dark:border-navy-700/70 dark:bg-navy-900/50">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span>{isPolish ? 'Luki jakościowe' : 'Quality gaps'}</span>
              </div>
              <div className="mt-3 space-y-2">
                {(swotSignals?.missingEvidence || []).slice(0, 4).length > 0 ? (
                  (swotSignals?.missingEvidence || []).slice(0, 4).map((gap, index) => (
                    <div
                      key={`${gap}-${index}`}
                      className="rounded-2xl bg-slate-50/80 px-3 py-2 text-sm text-slate-600 dark:bg-navy-950/50 dark:text-slate-300"
                    >
                      {gap}
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    {isPolish ? 'Brak krytycznych luk wejściowych.' : 'No critical input gaps.'}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {porterData && (
          <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-5 dark:border-navy-700/70 dark:bg-navy-900/50">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
              <ArrowRight className="h-4 w-4 text-slate-500" />
              <span>{isPolish ? 'Stan sesji' : 'Session state'}</span>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-50/80 px-3 py-2 text-sm text-slate-600 dark:bg-navy-950/50 dark:text-slate-300">
                {porterData.context.industry || (isPolish ? 'Brak branży' : 'Missing industry')}
              </div>
              <div className="rounded-2xl bg-slate-50/80 px-3 py-2 text-sm text-slate-600 dark:bg-navy-950/50 dark:text-slate-300">
                {porterData.context.geographicScope ||
                  (isPolish ? 'Brak zakresu geograficznego' : 'Missing geographic scope')}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (isDynamicSwotMission) {
    return (
      <div className="space-y-4">
        <div className="border-b border-slate-200 px-5 py-4 dark:border-navy-700">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-medium text-slate-900 dark:text-white">
              {isPolish ? 'Praca z AI' : 'Work with AI'}
            </h3>
            <span className="inline-flex rounded-full border border-primary-300/40 bg-primary-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-primary-700 dark:border-primary-800/50 dark:text-primary-300">
              AI
            </span>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <div className="rounded-[26px] border border-primary-200/70 bg-primary-500/5 p-4 dark:border-primary-900/40">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-700 dark:text-primary-300">
              {isPolish ? 'Tryb pracy' : 'Working mode'}
            </div>
            <div className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
              {isPolish
                ? 'Po lewej stronie widzisz pierwszą wersję framingu przygotowaną przez konsultanta. Tutaj możesz skorygować kierunek, doprecyzować akcent albo przejść dalej do wygenerowania całej sesji.'
                : 'On the left you see the first framing draft prepared by the consultant. Here you can redirect the angle, sharpen the emphasis, or move forward to generate the full session.'}
            </div>
          </div>

          <div className="rounded-[26px] border border-slate-200/70 bg-white/85 p-4 dark:border-white/10 dark:bg-white/[0.04]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
              {isPolish ? 'Komentarz roboczy dla AI' : 'Working note for AI'}
            </div>
            <textarea
              value={missionComment}
              onChange={(e) => setMissionComment(e.target.value)}
              rows={6}
              placeholder={
                isPolish
                  ? 'Np. za mocno akcentujemy marżę; dodaj perspektywę rynku niemieckiego i pokaż to bardziej jak decyzję zarządczą.'
                  : 'E.g. we are over-weighting margin; add the German market perspective and frame this more like a leadership decision.'
              }
              className="mt-3 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed text-slate-900 placeholder-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-navy-700 dark:bg-navy-800 dark:text-white"
            />
            <button
              onClick={onOpenChat}
              className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-slate-200/70 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-navy-700 dark:bg-navy-800 dark:text-slate-200"
            >
              <MessageSquareText className="h-4 w-4 text-primary-500" />
              {isPolish ? 'Przenieś to do czatu AI' : 'Take this to AI chat'}
            </button>
          </div>

          <div className="rounded-[26px] border border-sky-200/70 bg-sky-500/5 p-4 dark:border-sky-900/40">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-700 dark:text-sky-300">
              {isPolish ? 'Szybkie kierunki korekty' : 'Quick refinement angles'}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                isPolish ? 'Zaostrz tezę strategiczną' : 'Sharpen the strategic thesis',
                isPolish ? 'Dodaj kontekst rynku' : 'Add market context',
                isPolish ? 'Pokaż większe ryzyka' : 'Show bigger risks',
                isPolish ? 'Napisz to bardziej zarządczo' : 'Make it more board-ready',
              ].map((label) => (
                <button
                  key={label}
                  onClick={onOpenChat}
                  className="inline-flex rounded-full border border-sky-200/70 bg-white/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-700 shadow-sm transition-colors hover:bg-sky-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[26px] border border-emerald-200/70 bg-emerald-500/5 p-4 dark:border-emerald-900/40">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
                {isPolish ? 'Przejście do pełnej sesji' : 'Move to full session'}
              </div>
              <span className="inline-flex rounded-full border border-emerald-300/50 bg-white/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-emerald-800 dark:border-emerald-800/50 dark:bg-white/[0.05] dark:text-emerald-200">
                Output
              </span>
            </div>
            <div className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
              {isPolish
                ? 'Jeśli framing po lewej stronie jest wystarczająco dobry, AI przygotuje dalsze części sesji: input map, macierz SWOT, napięcia, ruchy i outputy.'
                : 'If the framing on the left is strong enough, AI will prepare the remaining parts of the session: input map, SWOT matrix, tensions, moves, and outputs.'}
            </div>
            <button
              onClick={onGenerateFullSession}
              disabled={!onGenerateFullSession || generationStatus === 'generating'}
              className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-navy-900 dark:bg-[#F4F7FB] px-5 py-3 text-sm font-semibold text-white dark:text-navy-950 transition-colors hover:bg-navy-800 dark:hover:bg-[#DDE5EF] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {generationStatus === 'generating' ? (
                <>
                  <Sparkles className="h-4 w-4 animate-pulse" />
                  {isPolish ? 'AI buduje pełną sesję...' : 'AI is building the full session...'}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  {isPolish
                    ? 'Akceptuj ten framing i generuj dalej'
                    : 'Accept this framing and generate next'}
                </>
              )}
            </button>
          </div>

          {orgName && (
            <div className="rounded-[26px] border border-slate-200/70 bg-white/85 p-4 dark:border-white/10 dark:bg-white/[0.04]">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                {isPolish ? 'Kontekst organizacji' : 'Organization context'}
              </div>
              <div className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                {orgName}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="border-b border-slate-200 p-4 dark:border-navy-700">
        <h3 className="font-medium text-slate-900 dark:text-white">
          {isPolish ? 'AI Collaboration Panel' : 'AI Collaboration Panel'}
        </h3>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {generationStatus === 'generating' && (
          <div className="rounded-2xl border border-primary-200 bg-primary-50/50 p-4 dark:border-primary-800/40 dark:bg-primary-950/20">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary-700 dark:text-primary-300">
              <Sparkles className="h-4 w-4 animate-pulse" />
              <span>
                {isPolish ? 'AI przygotowuje sesję...' : 'AI is preparing your session...'}
              </span>
            </div>
            <p className="mt-2 text-xs text-primary-600 dark:text-primary-400">
              {isPolish
                ? 'Konsultant AI generuje pełną propozycję: sygnały, macierz SWOT, napięcia, ruchy strategiczne i propozycje outputów.'
                : 'AI consultant is generating a full proposal: signals, SWOT matrix, tensions, strategic moves, and output proposals.'}
            </p>
          </div>
        )}

        {generationStatus === 'ready' && proposalCounts && proposalCounts.total > 0 && (
          <div className="rounded-2xl border border-primary-200 bg-white p-4 dark:border-primary-800/40 dark:bg-navy-900/40">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <Sparkles className="h-4 w-4 text-primary-500" />
              <span>{isPolish ? 'Propozycje AI' : 'AI Proposals'}</span>
              <span className="ml-auto rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
                {proposalCounts.total} {isPolish ? 'do przeglądu' : 'to review'}
              </span>
            </div>
            <div className="mt-3 space-y-1.5 text-xs">
              {proposalCounts.signals > 0 && (
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>{isPolish ? 'Sygnały' : 'Signals'}</span>
                  <span className="font-medium">{proposalCounts.signals}</span>
                </div>
              )}
              {proposalCounts.items > 0 && (
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>{isPolish ? 'Karty SWOT' : 'SWOT cards'}</span>
                  <span className="font-medium">{proposalCounts.items}</span>
                </div>
              )}
              {proposalCounts.tensions > 0 && (
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>{isPolish ? 'Napięcia' : 'Tensions'}</span>
                  <span className="font-medium">{proposalCounts.tensions}</span>
                </div>
              )}
              {proposalCounts.moves > 0 && (
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>{isPolish ? 'Ruchy' : 'Moves'}</span>
                  <span className="font-medium">{proposalCounts.moves}</span>
                </div>
              )}
              {proposalCounts.outputs > 0 && (
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>{isPolish ? 'Outputy' : 'Outputs'}</span>
                  <span className="font-medium">{proposalCounts.outputs}</span>
                </div>
              )}
            </div>
            {acceptedCounts && acceptedCounts.total > 0 && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {acceptedCounts.total} {isPolish ? 'zaakceptowanych' : 'accepted'}
              </div>
            )}
          </div>
        )}

        {swotData && readiness && (
          <div className={`rounded-2xl border p-4 ${getReadinessTone(readiness.readiness)}`}>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Target className="h-4 w-4" />
              <span>{isPolish ? 'Readiness' : 'Readiness'}</span>
            </div>
            <div className="mt-2 text-sm">{readiness.label}</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {phaseSummaries.map((phase) => (
                <div
                  key={phase.id}
                  className="rounded-xl border border-white/50 bg-white/60 px-3 py-2 text-xs dark:border-navy-700/50 dark:bg-navy-950/30"
                >
                  <div className="font-medium text-slate-700 dark:text-slate-200">
                    {phase.label}
                  </div>
                  <div className="mt-1 text-slate-500 dark:text-slate-400">
                    {phase.done
                      ? isPolish
                        ? 'gotowe'
                        : 'ready'
                      : phase.primaryGap || (isPolish ? 'wymaga pracy' : 'needs work')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-navy-700 dark:bg-navy-800">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquareText className="h-4 w-4 text-primary-500" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {isPolish ? 'AI coach brief' : 'AI coach brief'}
              </span>
            </div>
            <button
              onClick={onOpenChat}
              className="text-xs text-primary-600 hover:text-primary-700"
            >
              {isPolish ? 'Otwórz chat' : 'Open chat'}
            </button>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {aiContent ||
              coach?.whyNow ||
              (isPolish
                ? 'Panel pokazuje następny najlepszy ruch i luki jakościowe dla bieżącej fazy.'
                : 'This panel shows the next best move and quality gaps for the current phase.')}
          </p>
          {chatSnippets.length > 0 && (
            <div className="mt-2 space-y-1 text-[11px] text-slate-500">
              {chatSnippets.map((snippet, idx) => (
                <div key={idx}>
                  {snippet.role}: {snippet.content.slice(0, 80)}
                  {snippet.content.length > 80 ? '...' : ''}
                </div>
              ))}
            </div>
          )}
        </div>

        {swotData && (
          <>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-navy-700 dark:bg-navy-800">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                <Sparkles className="h-4 w-4 text-primary-500" />
                <span>{isPolish ? 'Next question' : 'Next question'}</span>
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300">{coach?.nextQuestion}</p>
              <div className="mt-3 rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2 text-xs text-slate-500 dark:border-navy-700/70 dark:bg-navy-950/40 dark:text-slate-400">
                {isPolish ? 'Dlaczego teraz:' : 'Why now:'} {coach?.whyNow}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-navy-700 dark:bg-navy-800">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span>{isPolish ? 'Proposal queue' : 'Proposal queue'}</span>
              </div>
              {proposalQueue.length > 0 ? (
                <div className="space-y-2">
                  {proposalQueue.map((proposal, index) => (
                    <div
                      key={`${proposal}-${index}`}
                      className="rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2 text-xs text-slate-600 dark:border-navy-700/70 dark:bg-navy-950/40 dark:text-slate-300"
                    >
                      {proposal}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  {isPolish
                    ? 'Brak niezaakceptowanych propozycji AI.'
                    : 'No unaccepted AI proposals.'}
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-navy-700 dark:bg-navy-800">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span>{isPolish ? 'Missing evidence' : 'Missing evidence'}</span>
              </div>
              {swotSignals && swotSignals.missingEvidence.length > 0 ? (
                <div className="space-y-2">
                  {swotSignals.missingEvidence.slice(0, 4).map((gap, index) => (
                    <div
                      key={`${gap}-${index}`}
                      className="text-xs text-slate-600 dark:text-slate-400"
                    >
                      {gap}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  {isPolish ? 'Brak krytycznych luk wejściowych.' : 'No critical input gaps.'}
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-navy-700 dark:bg-navy-800">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                <BookOpen className="h-4 w-4 text-slate-500" />
                <span>{isPolish ? 'Session counters' : 'Session counters'}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2 dark:border-navy-700/70 dark:bg-navy-950/40">
                  <div className="text-slate-600">
                    {isPolish ? 'Akceptowane karty' : 'Accepted cards'}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {swotSignals?.acceptedItems || 0}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2 dark:border-navy-700/70 dark:bg-navy-950/40">
                  <div className="text-slate-600">{isPolish ? 'Propozycje' : 'Proposals'}</div>
                  <div className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {(swotSignals?.proposedItems || 0) + (swotSignals?.proposedSignals || 0)}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2 dark:border-navy-700/70 dark:bg-navy-950/40">
                  <div className="text-slate-600">{isPolish ? 'Napięcia' : 'Tensions'}</div>
                  <div className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {swotSignals?.tensions || 0}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2 dark:border-navy-700/70 dark:bg-navy-950/40">
                  <div className="text-slate-600">
                    {isPolish ? 'Gotowe outputy' : 'Ready outputs'}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {swotSignals?.readyOutputs || 0}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-navy-700 dark:bg-navy-800">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                  <Lightbulb className="h-4 w-4 text-amber-500" />
                  <span>{isPolish ? 'Output routes' : 'Output routes'}</span>
                </div>
                {onOpenInitiatives && (
                  <button
                    onClick={onOpenInitiatives}
                    className="text-xs text-primary-600 hover:text-primary-700"
                  >
                    {isPolish ? 'Otwórz' : 'Open'}
                  </button>
                )}
              </div>
              {swotData.outputCandidates?.length ? (
                <div className="space-y-2">
                  {swotData.outputCandidates.slice(0, 4).map((candidate) => (
                    <div
                      key={candidate.id}
                      className="rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2 text-xs dark:border-navy-700/70 dark:bg-navy-950/40"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="uppercase text-[10px] text-slate-600">
                          {candidate.outputType}
                        </span>
                        <span
                          className={`rounded-full border px-2 py-0.5 ${getReadinessTone(
                            candidate.readiness === 'blocked'
                              ? 'blocked'
                              : candidate.readiness === 'keep-as-idea'
                                ? 'needs-work'
                                : 'ready'
                          )}`}
                        >
                          {candidate.readiness || 'keep-as-idea'}
                        </span>
                      </div>
                      <div className="mt-1 text-slate-700 dark:text-slate-300">
                        {candidate.title}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  {isPolish ? 'Brak kandydatów do outputów.' : 'No output candidates yet.'}
                </p>
              )}
            </div>
          </>
        )}

        {!swotData && porterData && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-navy-700 dark:bg-navy-800">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <ArrowRight className="h-4 w-4 text-slate-500" />
              <span>{isPolish ? 'Session state' : 'Session state'}</span>
            </div>
            <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
              <div>
                {porterData.context.industry || (isPolish ? 'Brak branży' : 'Missing industry')}
              </div>
              <div>
                {porterData.context.geographicScope ||
                  (isPolish ? 'Brak zakresu geograficznego' : 'Missing geographic scope')}
              </div>
            </div>
          </div>
        )}

        {generatedInitiatives.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-navy-700 dark:bg-navy-800">
            <div className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              {isPolish ? 'Generated from this tool' : 'Generated from this tool'}
            </div>
            <div className="space-y-2">
              {generatedInitiatives.slice(0, 4).map((initiative) => (
                <div key={initiative.id} className="text-xs text-slate-600 dark:text-slate-400">
                  {initiative.title}
                </div>
              ))}
            </div>
          </div>
        )}

        {recentInitiatives.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-navy-700 dark:bg-navy-800">
            <div className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              {isPolish ? 'Recent initiatives' : 'Recent initiatives'}
            </div>
            <div className="space-y-2">
              {recentInitiatives.slice(0, 4).map((initiative) => (
                <div key={initiative.id} className="text-xs text-slate-600 dark:text-slate-400">
                  {initiative.title}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-navy-700 dark:bg-navy-800">
          <div className="mb-2 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {isPolish ? 'Organization context' : 'Organization context'}
            </span>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {orgName || (isPolish ? 'Brak profilu organizacji' : 'No organization profile')}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ToolContextPanel;
