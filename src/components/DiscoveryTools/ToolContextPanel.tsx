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
  onOpenInitiatives?: () => void;
  generatedInitiatives?: { id: string; title: string; status?: string }[];
  recentInitiatives?: { id: string; title: string; status?: string }[];
  chatSnippets?: { role: string; content: string }[];
}

const getReadinessTone = (readiness: 'blocked' | 'needs-work' | 'ready') =>
  readiness === 'ready'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300'
    : readiness === 'needs-work'
      ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300'
      : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300';

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
  onOpenInitiatives,
  generatedInitiatives = [],
  recentInitiatives = [],
  chatSnippets = [],
}) => {
  const swotData = toolType === 'dynamic-swot' ? (session.inputData as SWOTData) : null;
  const readiness = swotData ? computeDynamicSwotOverallReadiness(swotData, isPolish) : null;
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

  return (
    <div className="flex w-96 flex-col border-l border-slate-200 bg-white dark:border-navy-700 dark:bg-navy-900">
      <div className="border-b border-slate-200 p-4 dark:border-navy-700">
        <h3 className="font-medium text-slate-900 dark:text-white">
          {isPolish ? 'AI Collaboration Panel' : 'AI Collaboration Panel'}
        </h3>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
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
                <Sparkles className="h-4 w-4 text-violet-500" />
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
                  <div className="text-slate-400">
                    {isPolish ? 'Akceptowane karty' : 'Accepted cards'}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {swotSignals?.acceptedItems || 0}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2 dark:border-navy-700/70 dark:bg-navy-950/40">
                  <div className="text-slate-400">{isPolish ? 'Propozycje' : 'Proposals'}</div>
                  <div className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {(swotSignals?.proposedItems || 0) + (swotSignals?.proposedSignals || 0)}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2 dark:border-navy-700/70 dark:bg-navy-950/40">
                  <div className="text-slate-400">{isPolish ? 'Napięcia' : 'Tensions'}</div>
                  <div className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {swotSignals?.tensions || 0}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2 dark:border-navy-700/70 dark:bg-navy-950/40">
                  <div className="text-slate-400">
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
                        <span className="uppercase text-[10px] text-slate-400">
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
