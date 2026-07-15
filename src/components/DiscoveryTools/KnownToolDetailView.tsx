import { ArrowRight, CheckCircle2, FileText, HelpCircle, Lightbulb, Target } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { useHelpSidePanel } from '@/contexts/HelpContext';
import { usePresentationMode } from '@/hooks/usePresentationMode';
import { Api } from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';
import { useAppStore } from '@/store/useAppStore';
import { TEXT_L1 } from '@/styles/typography';

import {
  type NModeAction,
  type NModePropertyField,
  type NModeSection,
  NModeShell,
} from '../shared/NModeLayout';
import { DynamicSwotLibraryGraphic } from './DynamicSwotLibraryGraphic';
import { GrowthPathsLibraryGraphic } from './GrowthPathsLibraryGraphic';
import { MarketForcesLibraryGraphic } from './MarketForcesLibraryGraphic';
import { PortfolioPriorityLibraryGraphic } from './PortfolioPriorityLibraryGraphic';
import { RiskUncertaintyLibraryGraphic } from './RiskUncertaintyLibraryGraphic';

type KnownTool = Awaited<ReturnType<typeof Api.getKnownTool>>['tool'];

export function KnownToolDetailView(props: {
  toolType: string;
  onClose: () => void;
  onSessionCreated: (sessionId: string, toolType: string, name: string) => void;
}) {
  const { toolType, onClose, onSessionCreated } = props;
  const { i18n, t } = useTranslation();
  const lang = i18n.language === 'pl' ? 'pl' : 'en';
  const isPolish = lang === 'pl';
  const { currentProjectId } = useAppStore();
  const {
    setOpen: setHelpOpen,
    setActiveTab: setHelpTab,
    setKnowledgeModuleIdOverride,
  } = useHelpSidePanel();

  const { mode, setMode } = usePresentationMode({ entityType: 'tool', syncURL: false });

  const [activeSection, setActiveSection] = useState<string>('goal');
  const [loading, setLoading] = useState(true);
  const [tool, setTool] = useState<KnownTool | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const res = await Api.getKnownTool(toolType, { lang });
        if (!alive) return;
        setTool(res.tool);
        trackFunnelEvent('known_tool_viewed', { toolType });
      } catch (e: any) {
        if (!alive) return;
        toast.error(e?.message || 'Failed to load tool');
        setTool(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [toolType, lang]);

  const openKb = () => {
    setKnowledgeModuleIdOverride(toolType);
    setHelpTab('knowledge');
    setHelpOpen(true);
    trackFunnelEvent('tool_kb_opened', { toolType });
  };

  const startSession = async () => {
    if (!tool) return;
    if (!tool.isActive) {
      toast.error(t('discoveryToolsMain.knownToolDetailView.thisToolIsNotActiveYet'));
      return;
    }
    try {
      setStarting(true);
      trackFunnelEvent('tool_session_started_from_library', { toolType: tool.toolType });
      const created = await Api.createToolSession({
        toolType: tool.toolType,
        name: `${tool.name} — Session`,
        projectId: currentProjectId || null,
      });
      onSessionCreated(created.id, tool.toolType, tool.name);
      toast.success(t('discoveryToolsMain.knownToolDetailView.toolSessionCreated'));
    } catch (e: any) {
      toast.error(e?.message || 'Failed to start tool session');
    } finally {
      setStarting(false);
    }
  };

  const properties: NModePropertyField[] = useMemo(() => {
    const category = tool?.libraryCategory || '-';
    return [
      {
        id: 'toolType',
        label: { en: 'Tool type', pl: 'Typ narzędzia' },
        type: 'text',
        value: tool?.toolType || toolType,
        onChange: () => {},
        readOnly: true,
      },
      {
        id: 'category',
        label: { en: 'Category', pl: 'Kategoria' },
        type: 'text',
        value: category,
        onChange: () => {},
        readOnly: true,
      },
      {
        id: 'stage',
        label: { en: 'Consulting stage', pl: 'Etap konsultingowy' },
        type: 'text',
        value: t('discoveryToolsMain.knownToolDetailView.learnTheTool'),
        onChange: () => {},
        readOnly: true,
      },
    ];
  }, [isPolish, tool, toolType]);

  const actions: NModeAction[] = useMemo(
    () => [
      {
        id: 'start',
        label: { en: 'Start session', pl: 'Startuj sesję' },
        icon: ArrowRight,
        variant: 'success',
        onClick: startSession,
        disabled: starting || !tool || !tool.isActive,
        loading: starting,
        title: {
          en: 'Create a tool session and start working',
          pl: 'Utwórz sesję narzędzia i rozpocznij pracę',
        },
      },
      {
        id: 'help',
        label: { en: 'How to / Knowledge base', pl: 'How to / Baza wiedzy' },
        icon: HelpCircle,
        variant: 'neutral',
        onClick: openKb,
        disabled: !tool,
      },
    ],
    [tool, starting, toolType]
  );

  const sections: NModeSection[] = useMemo(() => {
    const bullets = (items: string[] | undefined) => {
      const safe = Array.isArray(items) ? items : [];
      if (safe.length === 0) {
        return (
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {t('discoveryToolsMain.knownToolDetailView.sectionPendingExpansion')}
          </div>
        );
      }
      return (
        <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
          {safe.map((v, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span className="mt-1 w-1.5 h-1.5 rounded-full bg-primary-400" />
              <span>{v}</span>
            </li>
          ))}
        </ul>
      );
    };

    const chipRow = (items: string[] | undefined) => {
      const safe = Array.isArray(items) ? items : [];
      if (safe.length === 0) return null;
      return (
        <div className="flex flex-wrap gap-2">
          {safe.map((v, idx) => (
            <span
              key={idx}
              className="px-2.5 py-1 rounded-full text-xs font-medium bg-white/60 dark:bg-navy-900/60 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-navy-700"
            >
              {v}
            </span>
          ))}
        </div>
      );
    };

    const caseGrid = (
      cases: Array<{
        title: string;
        context: string;
        question: string;
        evidence: string[];
        aiDraft: string;
        approvedUse: string;
        outcome: string;
      }>
    ) => (
      <div className="grid gap-4 lg:grid-cols-3">
        {cases.map((item) => (
          <div
            key={item.title}
            className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-navy-700/70 dark:bg-navy-950/30"
          >
            <div className={TEXT_L1}>{t('discoveryToolsMain.knownToolDetailView.case')}</div>
            <h3 className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              {item.title}
            </h3>
            <div className="mt-3 space-y-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {t('discoveryToolsMain.knownToolDetailView.context')}
                </span>
                {item.context}
              </div>
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {t('discoveryToolsMain.knownToolDetailView.question')}
                </span>
                {item.question}
              </div>
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {t('discoveryToolsMain.knownToolDetailView.evidence')}
                </span>
                {item.evidence.join(' ')}
              </div>
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {t('discoveryToolsMain.knownToolDetailView.aIDraft')}
                </span>
                {item.aiDraft}
              </div>
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {t('discoveryToolsMain.knownToolDetailView.afterApproval')}
                </span>
                {item.approvedUse}
              </div>
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {t('discoveryToolsMain.knownToolDetailView.outcome')}
                </span>
                {item.outcome}
              </div>
            </div>
          </div>
        ))}
      </div>
    );

    const goalSection = (
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-5 dark:border-navy-700/70 dark:bg-navy-950/30">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-600 dark:text-slate-500">
            {t('discoveryToolsMain.knownToolDetailView.toolPositioning')}
          </div>
          <div className="mt-3 text-lg font-semibold leading-tight text-slate-900 dark:text-slate-100">
            {t('discoveryToolsMain.knownToolDetail.dynamicSwot.goal.positioningHeadline')}
          </div>
          <div className="mt-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {t('discoveryToolsMain.knownToolDetail.dynamicSwot.goal.positioningBody')}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-emerald-200/70 bg-emerald-500/5 p-4 dark:border-emerald-900/40">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
              {t('discoveryToolsMain.knownToolDetailView.whatTheToolActuallyDoes')}
            </div>
            {bullets(
              t('discoveryToolsMain.knownToolDetail.dynamicSwot.goal.whatItDoes', {
                returnObjects: true,
              }) as string[]
            )}
          </div>
          <div className="rounded-2xl border border-danger-200/70 bg-danger-500/5 p-4 dark:border-danger-900/40">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-danger-700 dark:text-danger-300">
              {t('discoveryToolsMain.knownToolDetailView.whatThisToolIsNot')}
            </div>
            {bullets(
              t('discoveryToolsMain.knownToolDetail.dynamicSwot.goal.whatItIsNot', {
                returnObjects: true,
              }) as string[]
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-emerald-200/70 bg-emerald-500/5 p-4 dark:border-emerald-900/40">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
              {t('discoveryToolsMain.knownToolDetailView.whenToUse')}
            </div>
            {bullets(
              t('discoveryToolsMain.knownToolDetail.dynamicSwot.goal.whenToUse', {
                returnObjects: true,
              }) as string[]
            )}
          </div>
          <div className="rounded-2xl border border-danger-200/70 bg-danger-500/5 p-4 dark:border-danger-900/40">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-danger-700 dark:text-danger-300">
              {t('discoveryToolsMain.knownToolDetailView.whenNotToStartWithSWOT')}
            </div>
            {bullets(
              t('discoveryToolsMain.knownToolDetail.dynamicSwot.goal.whenNotToUse', {
                returnObjects: true,
              }) as string[]
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-white/10 dark:bg-white/[0.04]">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t('discoveryToolsMain.knownToolDetailView.whatToPrepareBeforeStarting')}
            </div>
            {bullets(
              t('discoveryToolsMain.knownToolDetail.dynamicSwot.goal.prepare', {
                returnObjects: true,
              }) as string[]
            )}
          </div>
          <div className="rounded-2xl border border-primary-200/70 bg-primary-500/5 p-4 dark:border-primary-900/40">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-primary-700 dark:text-primary-300">
              {t('discoveryToolsMain.knownToolDetail.dynamicSwot.goal.dynamicLabel')}
            </div>
            {chipRow(['Mission brief', 'Evidence-first', 'Tensions', 'Recommended moves', 'Outputs'])}
            <div className="mt-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              {t('discoveryToolsMain.knownToolDetail.dynamicSwot.goal.dynamicBody')}
            </div>
          </div>
        </div>

        <DynamicSwotLibraryGraphic isPolish={isPolish} variant="process" />
      </div>
    );

    const dynamicSwotStepsMeta = [
      { id: 1, accent: 'bg-navy-900', tone: 'from-primary-500/12 to-crimson-700/5' },
      { id: 2, accent: 'bg-sky-500', tone: 'from-sky-500/12 to-blue-500/5' },
      { id: 3, accent: 'bg-emerald-500', tone: 'from-emerald-500/12 to-blue-500/5' },
      { id: 4, accent: 'bg-amber-500', tone: 'from-amber-500/15 to-amber-500/5' },
      { id: 5, accent: 'bg-navy-900', tone: 'from-primary-500/15 to-crimson-500/5' },
    ];
    const dynamicSwotStepsTitles = [
      t('discoveryToolsMain.knownToolDetailView.missionBrief'),
      t('discoveryToolsMain.knownToolDetailView.signalsEvidence'),
      t('discoveryToolsMain.knownToolDetailView.matrixBuild'),
      t('discoveryToolsMain.knownToolDetailView.strategicTensions'),
      t('discoveryToolsMain.knownToolDetailView.movesOutputs'),
    ];
    const dynamicSwotStepsText = t('discoveryToolsMain.knownToolDetail.dynamicSwot.process.steps', {
      returnObjects: true,
    }) as Array<{ oneLiner: string; items: string[]; note: string }>;
    const processSteps = dynamicSwotStepsMeta.map((meta, idx) => ({
      ...meta,
      title: dynamicSwotStepsTitles[idx],
      ...dynamicSwotStepsText[idx],
    }));

    const ProcessStepper = () => {
      const [openStep, setOpenStep] = React.useState<number | null>(null);
      return (
        <div className="space-y-2">
          {processSteps.map((step) => {
            const isOpen = openStep === step.id;
            return (
              <div
                key={step.id}
                className={`rounded-2xl border transition-all duration-200 ${
                  isOpen
                    ? `border-slate-300/70 bg-gradient-to-br ${step.tone} shadow-sm dark:border-white/15`
                    : 'border-slate-200/50 bg-slate-50/50 hover:border-slate-300/70 hover:bg-slate-50/80 dark:border-white/5 dark:bg-white/[0.02] dark:hover:border-white/10'
                }`}
              >
                <button
                  type="button"
                  className="flex w-full items-center gap-3 p-3 text-left"
                  onClick={() => setOpenStep(isOpen ? null : step.id)}
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-[11px] font-bold text-white dark:bg-white dark:text-slate-950">
                    {step.id}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                      {step.title}
                    </div>
                    {!isOpen && (
                      <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        {step.oneLiner}
                      </div>
                    )}
                  </div>
                  <span className={`mr-1 h-2 w-2 shrink-0 rounded-full ${step.accent}`} />
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                    className={`shrink-0 text-slate-600 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                  >
                    <path
                      d="M3 5.5l4 4 4-4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                {isOpen && (
                  <div className="border-t border-slate-200/50 px-3 pb-4 pt-3 dark:border-white/5">
                    <div className="pl-10">
                      {bullets(step.items)}
                      {step.note ? (
                        <div className="mt-3 rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2 text-sm text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
                          {step.note}
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
    };

    const processSection = (
      <div className="space-y-6">
        <div>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              {t('discoveryToolsMain.knownToolDetailView.workLogic')}
            </h2>
            <span className="inline-flex shrink-0 rounded-full border border-slate-300/50 bg-white/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-600 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200">
              Process
            </span>
          </div>
          <div className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {t('discoveryToolsMain.knownToolDetail.dynamicSwot.process.intro')}
          </div>
        </div>

        <ProcessStepper />

        <div className="rounded-2xl border border-emerald-200/70 bg-emerald-500/5 p-4 dark:border-emerald-900/40">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
              {t('discoveryToolsMain.knownToolDetail.dynamicSwot.process.sessionQualityLabel')}
            </div>
            <span className="inline-flex shrink-0 rounded-full border border-emerald-300/50 bg-white/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-emerald-800 dark:border-emerald-800/50 dark:bg-white/[0.05] dark:text-emerald-200">
              Quality
            </span>
          </div>
          <ul className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-300">
            {(
              t('discoveryToolsMain.knownToolDetail.dynamicSwot.process.sessionQualityItems', {
                returnObjects: true,
              }) as string[]
            ).map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-primary-200/70 bg-primary-500/5 p-4 dark:border-primary-900/40">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-700 dark:text-primary-300">
              {t('discoveryToolsMain.knownToolDetailView.4CommonDecisionSituations')}
            </div>
            <span className="inline-flex shrink-0 rounded-full border border-primary-300/50 bg-white/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-primary-800 dark:border-primary-800/50 dark:bg-white/[0.05] dark:text-primary-200">
              Insight
            </span>
          </div>
          <div className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {t('discoveryToolsMain.knownToolDetail.dynamicSwot.process.decisionSituationsIntro')}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {(
              t('discoveryToolsMain.knownToolDetail.dynamicSwot.process.decisionSituationsCards', {
                returnObjects: true,
              }) as Array<{ label: string; desc: string; accent: string }>
            ).map((item) => {
              const accentMap: Record<
                string,
                { border: string; bg: string; title: string; dot: string }
              > = {
                emerald: {
                  border: 'border-emerald-200/70',
                  bg: 'bg-emerald-500/5',
                  title: 'text-emerald-700 dark:text-emerald-300',
                  dot: 'bg-emerald-500',
                },
                sky: {
                  border: 'border-sky-200/70',
                  bg: 'bg-sky-500/5',
                  title: 'text-sky-700 dark:text-sky-300',
                  dot: 'bg-sky-500',
                },
                amber: {
                  border: 'border-amber-200/70',
                  bg: 'bg-amber-500/5',
                  title: 'text-amber-700 dark:text-amber-300',
                  dot: 'bg-amber-500',
                },
                rose: {
                  border: 'border-danger-200/70',
                  bg: 'bg-danger-500/5',
                  title: 'text-danger-700 dark:text-danger-300',
                  dot: 'bg-danger-500',
                },
              };
              const a = accentMap[item.accent] || accentMap.emerald;
              return (
                <div key={item.label} className={`rounded-xl border ${a.border} ${a.bg} p-3`}>
                  <div className={`text-xs font-semibold ${a.title}`}>{item.label}</div>
                  <div className="mt-1.5 text-[13px] leading-relaxed text-slate-700 dark:text-slate-200">
                    {item.desc}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200/70 bg-amber-500/5 p-4 dark:border-amber-900/40">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
              {t('discoveryToolsMain.knownToolDetailView.workingNotes')}
            </div>
            <span className="inline-flex shrink-0 rounded-full border border-amber-300/50 bg-white/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-amber-800 dark:border-amber-800/50 dark:bg-white/[0.05] dark:text-amber-200">
              Tips
            </span>
          </div>
          <ul className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-300">
            {(
              t('discoveryToolsMain.knownToolDetail.dynamicSwot.process.workingNotesItems', {
                returnObjects: true,
              }) as string[]
            ).map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );

    const dynamicSwotOutcomeMeta = [
      { id: 'decision-frame', badge: 'Decision', color: 'violet' as const },
      { id: 'evidence-picture', badge: 'Evidence', color: 'sky' as const },
      { id: 'tensions', badge: 'Tensions', color: 'amber' as const },
      { id: 'moves', badge: 'Moves', color: 'emerald' as const },
      { id: 'execution-bridge', badge: 'Execution', color: 'rose' as const },
    ];
    const dynamicSwotOutcomeText = t(
      'discoveryToolsMain.knownToolDetail.dynamicSwot.outcomes.blocks',
      { returnObjects: true }
    ) as Array<{ title: string; what: string; why: string; next: string }>;
    const outcomeBlocks = dynamicSwotOutcomeMeta.map((meta, idx) => ({
      ...meta,
      ...dynamicSwotOutcomeText[idx],
    }));

    const colorMap = {
      violet: {
        card: 'border-primary-200/70 bg-primary-500/5 dark:border-primary-900/40',
        badge:
          'border-primary-300/50 bg-white/70 text-primary-800 dark:border-primary-800/50 dark:bg-white/[0.05] dark:text-primary-200',
        title: 'text-primary-700 dark:text-primary-300',
        dot: 'bg-navy-900',
      },
      sky: {
        card: 'border-sky-200/70 bg-sky-500/5 dark:border-sky-900/40',
        badge:
          'border-sky-300/50 bg-white/70 text-sky-800 dark:border-sky-800/50 dark:bg-white/[0.05] dark:text-sky-200',
        title: 'text-sky-700 dark:text-sky-300',
        dot: 'bg-sky-500',
      },
      amber: {
        card: 'border-amber-200/70 bg-amber-500/5 dark:border-amber-900/40',
        badge:
          'border-amber-300/50 bg-white/70 text-amber-800 dark:border-amber-800/50 dark:bg-white/[0.05] dark:text-amber-200',
        title: 'text-amber-700 dark:text-amber-300',
        dot: 'bg-amber-500',
      },
      emerald: {
        card: 'border-emerald-200/70 bg-emerald-500/5 dark:border-emerald-900/40',
        badge:
          'border-emerald-300/50 bg-white/70 text-emerald-800 dark:border-emerald-800/50 dark:bg-white/[0.05] dark:text-emerald-200',
        title: 'text-emerald-700 dark:text-emerald-300',
        dot: 'bg-emerald-500',
      },
      rose: {
        card: 'border-danger-200/70 bg-danger-500/5 dark:border-danger-900/40',
        badge:
          'border-danger-300/50 bg-white/70 text-danger-800 dark:border-danger-800/50 dark:bg-white/[0.05] dark:text-danger-200',
        title: 'text-danger-700 dark:text-danger-300',
        dot: 'bg-danger-500',
      },
    };

    const outcomesSection = (
      <div className="space-y-6">
        <div>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              {t('discoveryToolsMain.knownToolDetailView.whatTheSessionProduces')}
            </h2>
            <span className="inline-flex shrink-0 rounded-full border border-slate-300/50 bg-white/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-600 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200">
              Output
            </span>
          </div>
          <div className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {t('discoveryToolsMain.knownToolDetail.dynamicSwot.outcomes.intro')}
          </div>
        </div>

        <div className="space-y-3">
          {outcomeBlocks.map((block) => {
            const c = colorMap[block.color];
            return (
              <div key={block.id} className={`rounded-2xl border p-4 ${c.card}`}>
                <div className="flex items-center justify-between gap-3">
                  <div
                    className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${c.title}`}
                  >
                    {block.title}
                  </div>
                  <span
                    className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] ${c.badge}`}
                  >
                    {block.badge}
                  </span>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <div>
                    <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600 dark:text-slate-500">
                      {t('discoveryToolsMain.knownToolDetailView.contains')}
                    </div>
                    <div className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                      {block.what}
                    </div>
                  </div>
                  <div>
                    <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600 dark:text-slate-500">
                      {t('discoveryToolsMain.knownToolDetailView.whyItMatters')}
                    </div>
                    <div className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                      {block.why}
                    </div>
                  </div>
                  <div>
                    <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600 dark:text-slate-500">
                      {t('discoveryToolsMain.knownToolDetailView.enablesNext')}
                    </div>
                    <div className="text-sm leading-relaxed text-slate-900 dark:text-white">
                      {block.next}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-2xl border border-emerald-200/70 bg-emerald-500/5 p-4 dark:border-emerald-900/40">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
              {t('discoveryToolsMain.knownToolDetailView.whatAStrongOutcomeLooksLike')}
            </div>
            <span className="inline-flex shrink-0 rounded-full border border-emerald-300/50 bg-white/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-emerald-800 dark:border-emerald-800/50 dark:bg-white/[0.05] dark:text-emerald-200">
              Quality
            </span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {t('discoveryToolsMain.knownToolDetail.dynamicSwot.outcomes.qualityBody')}
          </p>
        </div>
      </div>
    );

    const exampleSection = (
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-navy-700/70 dark:bg-navy-950/30">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            {t('discoveryToolsMain.knownToolDetailView.example')}
          </h2>
          <div className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {t('discoveryToolsMain.knownToolDetail.dynamicSwot.example.intro')}
          </div>
        </div>

        {caseGrid(
          t('discoveryToolsMain.knownToolDetail.dynamicSwot.example.cases', {
            returnObjects: true,
          }) as Array<{
            title: string;
            context: string;
            question: string;
            evidence: string[];
            aiDraft: string;
            approvedUse: string;
            outcome: string;
          }>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl bg-slate-50/70 p-4 dark:bg-navy-900/40">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-500">
              {t('discoveryToolsMain.knownToolDetailView.situationAndDecisionQuestion')}
            </div>
            {bullets(
              t('discoveryToolsMain.knownToolDetail.dynamicSwot.example.situationItems', {
                returnObjects: true,
              }) as string[]
            )}
          </div>
          <div className="rounded-2xl bg-slate-50/70 p-4 dark:bg-navy-900/40">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-500">
              {t('discoveryToolsMain.knownToolDetailView.keyInputSignals')}
            </div>
            {bullets(
              t('discoveryToolsMain.knownToolDetail.dynamicSwot.example.signalsItems', {
                returnObjects: true,
              }) as string[]
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-navy-700/70 dark:bg-navy-950/30">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-500">
              {t('discoveryToolsMain.knownToolDetailView.howTheMatrixLooks')}
            </div>
            {bullets(
              t('discoveryToolsMain.knownToolDetail.dynamicSwot.example.matrixItems', {
                returnObjects: true,
              }) as string[]
            )}
          </div>
          <div className="rounded-2xl border border-amber-200/70 bg-amber-500/5 p-4 dark:border-amber-900/40">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
              {t('discoveryToolsMain.knownToolDetailView.tensionAndInterpretation')}
            </div>
            {bullets(
              t('discoveryToolsMain.knownToolDetail.dynamicSwot.example.tensionItems', {
                returnObjects: true,
              }) as string[]
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-navy-700/70 dark:bg-navy-950/30">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-500">
                {t('discoveryToolsMain.knownToolDetailView.recommendedMoves')}
              </div>
              {bullets(
                t('discoveryToolsMain.knownToolDetail.dynamicSwot.example.movesItems', {
                  returnObjects: true,
                }) as string[]
              )}
            </div>
            <div>
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-500">
                {t('discoveryToolsMain.knownToolDetailView.outputsFromTheSession')}
              </div>
              {bullets(
                t('discoveryToolsMain.knownToolDetail.dynamicSwot.example.outputsItems', {
                  returnObjects: true,
                }) as string[]
              )}
            </div>
          </div>
        </div>

        <DynamicSwotLibraryGraphic isPolish={isPolish} variant="example" />

        <div className="rounded-2xl border border-emerald-200/70 bg-emerald-500/5 p-4 text-sm text-slate-700 dark:border-emerald-900/50 dark:text-slate-300">
          {t('discoveryToolsMain.knownToolDetail.dynamicSwot.example.closingNote')}
        </div>
      </div>
    );

    const marketGoalSection = (
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-5 dark:border-navy-700/70 dark:bg-navy-950/30">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-600 dark:text-slate-500">
            {t('discoveryToolsMain.knownToolDetailView.toolPositioning')}
          </div>
          <div className="mt-3 text-lg font-semibold leading-tight text-slate-900 dark:text-slate-100">
            {t('discoveryToolsMain.knownToolDetail.marketForces.goal.positioningHeadline')}
          </div>
          <div className="mt-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {t('discoveryToolsMain.knownToolDetail.marketForces.goal.positioningBody')}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-blue-200/70 bg-blue-500/5 p-4 dark:border-blue-900/40">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
              {t('discoveryToolsMain.knownToolDetailView.whatTheToolActuallyDoes')}
            </div>
            {bullets(
              t('discoveryToolsMain.knownToolDetail.marketForces.goal.whatItDoes', {
                returnObjects: true,
              }) as string[]
            )}
          </div>
          <div className="rounded-2xl border border-danger-200/70 bg-danger-500/5 p-4 dark:border-danger-900/40">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-danger-700 dark:text-danger-300">
              {t('discoveryToolsMain.knownToolDetailView.whatThisToolIsNot')}
            </div>
            {bullets(
              t('discoveryToolsMain.knownToolDetail.marketForces.goal.whatItIsNot', {
                returnObjects: true,
              }) as string[]
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-primary-200/70 bg-primary-500/5 p-4 dark:border-primary-900/40">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-primary-700 dark:text-primary-300">
            {t('discoveryToolsMain.knownToolDetailView.aIPhilosophy')}
          </div>
          {chipRow(['Market brief', 'Evidence', 'AI proposals', 'User approval', 'Initiatives'])}
          <div className="mt-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {t('discoveryToolsMain.knownToolDetail.marketForces.goal.aiPhilosophyBody')}
          </div>
        </div>

        <MarketForcesLibraryGraphic isPolish={isPolish} variant="process" />
      </div>
    );

    const marketProcessSection = (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            {t('discoveryToolsMain.knownToolDetailView.workLogic')}
          </h2>
          <div className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {t('discoveryToolsMain.knownToolDetail.marketForces.process.intro')}
          </div>
        </div>
        <div className="grid gap-3">
          {(
            t('discoveryToolsMain.knownToolDetail.marketForces.process.steps', {
              returnObjects: true,
            }) as Array<{ title: string; text: string }>
          ).map(({ title, text }, index) => (
            <div
              key={title}
              className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-white/10 dark:bg-white/[0.04]"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-[11px] font-bold text-white">
                  {index + 1}
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    {title}
                  </div>
                  <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{text}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );

    const marketOutcomesSection = (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            {t('discoveryToolsMain.knownToolDetailView.whatTheSessionProduces')}
          </h2>
          <div className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {t('discoveryToolsMain.knownToolDetail.marketForces.outcomes.intro')}
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {(
            t('discoveryToolsMain.knownToolDetail.marketForces.outcomes.blocks', {
              returnObjects: true,
            }) as Array<{ title: string; text: string }>
          ).map(({ title, text }) => (
            <div
              key={title}
              className="rounded-2xl border border-blue-200/70 bg-blue-500/5 p-4 dark:border-blue-900/40"
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-700 dark:text-blue-300">
                {title}
              </div>
              <div className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                {text}
              </div>
            </div>
          ))}
        </div>
      </div>
    );

    const marketExampleSection = (
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-navy-700/70 dark:bg-navy-950/30">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            {t('discoveryToolsMain.knownToolDetailView.example')}
          </h2>
          <div className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {t('discoveryToolsMain.knownToolDetail.marketForces.example.intro')}
          </div>
        </div>
        {caseGrid(
          t('discoveryToolsMain.knownToolDetail.marketForces.example.cases', {
            returnObjects: true,
          }) as Array<{
            title: string;
            context: string;
            question: string;
            evidence: string[];
            aiDraft: string;
            approvedUse: string;
            outcome: string;
          }>
        )}
        <MarketForcesLibraryGraphic isPolish={isPolish} variant="example" />
      </div>
    );

    const growthGoalSection = (
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-5 dark:border-navy-700/70 dark:bg-navy-950/30">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-600 dark:text-slate-500">
            {t('discoveryToolsMain.knownToolDetailView.toolPositioning')}
          </div>
          <div className="mt-3 text-lg font-semibold leading-tight text-slate-900 dark:text-slate-100">
            {isPolish
              ? 'Growth Paths nie jest listą pomysłów wzrostowych. To narzędzie do wyboru ścieżki: co skalować, co testować, gdzie wejść i czego nie robić teraz.'
              : 'Growth Paths is not a list of growth ideas. It is a path-selection tool: what to scale, what to test, where to enter, and what not to do now.'}
          </div>
          <div className="mt-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {isPolish
              ? 'AI bierze kontekst organizacji, wywiad i sygnały rynku, proponuje opcje w czterech polach Ansoffa, a użytkownik zatwierdza albo odrzuca karty. Dopiero zaakceptowane opcje przechodzą do porównania, ruchów, outputów i inicjatyw.'
              : 'AI uses organization context, interview notes, and market signals to propose options across the four Ansoff fields. The user accepts or rejects cards, and only approved options feed comparison, moves, outputs, and initiatives.'}
          </div>
        </div>
        <GrowthPathsLibraryGraphic isPolish={isPolish} variant="process" />
      </div>
    );

    const growthProcessSection = (
      <div className="space-y-6">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
          {t('discoveryToolsMain.knownToolDetailView.workLogic')}
        </h2>
        <div className="grid gap-3">
          {(isPolish
            ? [
                ['Mission', 'Ambicja wzrostu, zakres, success signal i ograniczenia'],
                ['Input', 'Sygnały z wywiadu, rynku, klientów i organizacji'],
                ['Options', 'Opcje w macierzy Ansoffa: core, rynek, produkt, dywersyfikacja'],
                ['Insights', 'Porównanie trade-offów i rekomendowana sekwencja ruchów'],
                ['Outputs', 'Final source summary, output candidates i drafty inicjatyw'],
              ]
            : [
                ['Mission', 'Growth ambition, scope, success signal, and constraints'],
                ['Input', 'Signals from interviews, market, customers, and organization context'],
                ['Options', 'Ansoff options: core, market, product, and diversification'],
                ['Insights', 'Trade-off comparison and recommended move sequence'],
                ['Outputs', 'Final source summary, output candidates, and initiative drafts'],
              ]
          ).map(([title, text], index) => (
            <div
              key={title}
              className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-white/10 dark:bg-white/[0.04]"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-navy-900 text-[11px] font-bold text-white">
                  {index + 1}
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    {title}
                  </div>
                  <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{text}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );

    const growthOutcomesSection = (
      <div className="space-y-6">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
          {t('discoveryToolsMain.knownToolDetailView.whatTheSessionProduces')}
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {(isPolish
            ? [
                ['Macierz opcji', 'Opcje wzrostu z impact, effort, risk, evidence i confidence.'],
                [
                  'Porównanie strategiczne',
                  'Trade-offy między skalowaniem core, wejściem w rynek, produktem i dywersyfikacją.',
                ],
                ['Rekomendowane ruchy', 'Sekwencja: co robić teraz, co testować, co odłożyć.'],
                [
                  'Output candidates',
                  'Materiał do inicjatywy, raportu, decka lub dalszej eksploracji.',
                ],
              ]
            : [
                [
                  'Option matrix',
                  'Growth options with impact, effort, risk, evidence, and confidence.',
                ],
                [
                  'Strategic comparison',
                  'Trade-offs between scaling core, entering markets, product development, and diversification.',
                ],
                ['Recommended moves', 'A sequence: what to do now, what to test, what to defer.'],
                [
                  'Output candidates',
                  'Material for an initiative, report, deck, or follow-on exploration.',
                ],
              ]
          ).map(([title, text]) => (
            <div
              key={title}
              className="rounded-2xl border border-primary-200/70 bg-primary-500/5 p-4 dark:border-primary-900/40"
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-700 dark:text-primary-300">
                {title}
              </div>
              <div className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                {text}
              </div>
            </div>
          ))}
        </div>
      </div>
    );

    const growthExampleSection = (
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-navy-700/70 dark:bg-navy-950/30">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            {t('discoveryToolsMain.knownToolDetailView.example')}
          </h2>
          <div className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {isPolish
              ? 'Firma premium chce rosnąć bez erozji marży. Growth Paths porównuje skalowanie obecnego segmentu, wejście do nowej geografii, nowy produkt i dywersyfikację, a potem układa sekwencję działań.'
              : 'A premium company wants to grow without margin erosion. Growth Paths compares scaling the current segment, entering a new geography, building a new product, and diversification, then sequences the moves.'}
          </div>
        </div>
        {caseGrid(
          isPolish
            ? [
                {
                  title: 'Premium firma szuka wzrostu bez erozji marży',
                  context: 'Core segment jest rentowny, ale tempo wzrostu spada.',
                  question:
                    'Czy skalować obecny rynek, wejść do nowej geografii, czy budować nowy produkt?',
                  evidence: [
                    'Sprzedaż pokazuje stabilną marżę w obecnym segmencie, ale malejącą liczbę nowych leadów.',
                    'Wywiady wskazują zapytania z sąsiednich segmentów, lecz bez jasnego dopasowania oferty i kanałów.',
                  ],
                  aiDraft:
                    'AI proponuje opcje w czterech polach: mocniejsza penetracja core, test nowej geografii, lekka wersja produktu i ostrożna dywersyfikacja.',
                  approvedUse:
                    'Użytkownik akceptuje opcje z jasnym pierwszym krokiem i odrzuca pomysły, które są tylko życzeniową ekspansją.',
                  outcome:
                    'Powstaje sekwencja: najpierw zwiększyć udział w core, równolegle przetestować jeden segment, a większy bet uruchomić dopiero po walidacji.',
                },
                {
                  title: 'SaaS po nasyceniu obecnego ICP',
                  context:
                    'Produkt ma dobrą retencję, ale nowy pipeline w obecnym segmencie słabnie.',
                  question: 'Czy rosnąć przez nowy segment, dodatki produktowe, czy pricing?',
                  evidence: [
                    'Retencja i expansion revenue są dobre, ale win-rate na nowych logo spada trzeci kwartał z rzędu.',
                    'Feedback klientów pokazuje popyt na funkcje raportowe, a sprzedaż słyszy zapytania z większych firm.',
                  ],
                  aiDraft:
                    'AI tworzy opcje: pricing packaging w core, wejście w mid-market, moduł analityczny i ryzykowną platformę dla enterprise.',
                  approvedUse:
                    'Zaakceptowane karty trafiają do porównania impact/effort/risk, a AI wskazuje, które opcje wymagają walidacji przed roadmapą.',
                  outcome:
                    'Rekomendacja: przetestować nowy pakiet cenowy i moduł analityczny na obecnych klientach przed kosztownym ruchem enterprise.',
                },
                {
                  title: 'Firma usługowa z silną relacją klienta',
                  context:
                    'Klienci proszą o dodatkowe usługi, ale zespół boi się rozmycia specjalizacji.',
                  question: 'Czy rozwijać produkt/usługę dla obecnych klientów, czy chronić focus?',
                  evidence: [
                    'Najlepsi klienci proszą o usługi komplementarne, ale rentowność projektów spada, gdy zakres jest zbyt szeroki.',
                    'Zespół wskazuje przeciążenie ekspertów i brak powtarzalnych standardów delivery dla nowych usług.',
                  ],
                  aiDraft:
                    'AI proponuje opcje rozwoju produktu dla obecnych klientów, selektywną penetrację key accounts i odrzuca szeroką dywersyfikację bez proofu.',
                  approvedUse:
                    'Akceptowane są tylko opcje z wyraźnym ICP, zakresem delivery i pierwszym eksperymentem komercyjnym.',
                  outcome:
                    'Powstaje plan: stworzyć jedną productized service dla obecnych klientów, przetestować cenę i dopiero potem rozwijać kolejne dodatki.',
                },
              ]
            : [
                {
                  title: 'Premium company seeking growth without margin erosion',
                  context: 'The core segment is profitable, but growth is slowing.',
                  question:
                    'Should it scale the current market, enter a new geography, or build a new product?',
                  evidence: [
                    'Sales data shows stable margin in the current segment but a declining number of new leads.',
                    'Interviews surface demand from adjacent segments, but offer and channel fit are still unclear.',
                  ],
                  aiDraft:
                    'AI proposes options across all four fields: deeper core penetration, a geography test, a lighter product version, and cautious diversification.',
                  approvedUse:
                    'The user approves options with a clear first step and rejects ideas that are just wishful expansion.',
                  outcome:
                    'The sequence becomes: grow share in core, test one adjacent segment in parallel, and only then commit to a bigger bet.',
                },
                {
                  title: 'SaaS after current ICP saturation',
                  context: 'Retention is strong, but pipeline in the current segment is weakening.',
                  question: 'Should growth come from a new segment, product add-ons, or pricing?',
                  evidence: [
                    'Retention and expansion revenue are healthy, but new-logo win rate has declined for three quarters.',
                    'Customer feedback shows demand for reporting features, while sales hears requests from larger companies.',
                  ],
                  aiDraft:
                    'AI creates options around core pricing packaging, mid-market entry, an analytics module, and a riskier enterprise platform move.',
                  approvedUse:
                    'Approved cards move into impact/effort/risk comparison, and AI identifies what must be validated before roadmap commitment.',
                  outcome:
                    'The recommendation is to test a new pricing package and analytics module with current customers before an expensive enterprise move.',
                },
                {
                  title: 'Services firm with strong client relationships',
                  context:
                    'Clients ask for adjacent services, but the team fears diluting specialization.',
                  question: 'Should it develop new offers for current clients or protect focus?',
                  evidence: [
                    'Top clients request complementary services, but project profitability drops when scope becomes too broad.',
                    'The team reports expert overload and no repeatable delivery standard for new service lines.',
                  ],
                  aiDraft:
                    'AI proposes product-development options for current clients, selective key-account penetration, and rejects broad diversification without proof.',
                  approvedUse:
                    'Only options with a clear ICP, delivery scope, and first commercial experiment are accepted.',
                  outcome:
                    'The plan is to create one productized service for current clients, test pricing, and then decide whether to add more offers.',
                },
              ]
        )}
        <GrowthPathsLibraryGraphic isPolish={isPolish} variant="example" />
      </div>
    );

    const portfolioGoalSection = (
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-5 dark:border-navy-700/70 dark:bg-navy-950/30">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-600 dark:text-slate-500">
            {t('discoveryToolsMain.knownToolDetailView.whyUseIt')}
          </div>
          <div className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {isPolish
              ? 'Portfolio Priority pomaga wybrać, które produkty, inicjatywy albo bety finansować, utrzymywać, testować, harvestować lub zatrzymać. AI proponuje pierwszy szkic na podstawie kontekstu i wywiadu, ale decyzje przechodzą przez akceptację użytkownika.'
              : 'Portfolio Priority helps decide which products, initiatives, or bets to fund, maintain, test, harvest, or stop. AI proposes the first draft from context and interview evidence, but decisions flow through user approval.'}
          </div>
        </div>
        <PortfolioPriorityLibraryGraphic isPolish={isPolish} variant="process" />
      </div>
    );

    const portfolioProcessSection = (
      <div className="grid gap-4 md:grid-cols-2">
        {[
          [
            'Mission',
            isPolish
              ? 'Zakres portfolio, ograniczenia i sygnał sukcesu.'
              : 'Portfolio scope, constraints, and success signal.',
          ],
          [
            'Evidence',
            isPolish
              ? 'Sygnały z wywiadu, rynku, finansów i zasobów.'
              : 'Interview, market, financial, and resource signals.',
          ],
          [
            'Items',
            isPolish
              ? 'Karty BCG z oceną growth/share/investment.'
              : 'BCG cards scored on growth/share/investment.',
          ],
          [
            'Outputs',
            isPolish
              ? 'Trade-offy, ruchy, inicjatywy i final summary.'
              : 'Trade-offs, moves, initiatives, and final summary.',
          ],
        ].map(([title, text]) => (
          <div
            key={title}
            className="rounded-2xl border border-slate-200/70 bg-white/80 p-5 dark:border-navy-700/70 dark:bg-navy-950/30"
          >
            <div className="font-semibold text-slate-900 dark:text-white">{title}</div>
            <div className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {text}
            </div>
          </div>
        ))}
      </div>
    );

    const portfolioOutcomesSection = (
      <div className="space-y-3">
        {[
          t('discoveryToolsMain.knownToolDetailView.approvedBCGPortfolioMatrix'),
          isPolish
            ? 'Jawne trade-offy alokacji zasobów'
            : 'Explicit resource allocation trade-offs',
          isPolish
            ? 'Rekomendowane ruchy: invest, maintain, test, harvest, stop'
            : 'Recommended moves: invest, maintain, test, harvest, stop',
          isPolish
            ? 'Kandydaci outputów i inicjatyw downstream'
            : 'Downstream output and initiative candidates',
        ].map((text) => (
          <div
            key={text}
            className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 text-sm text-slate-700 dark:border-navy-700/70 dark:bg-navy-950/30 dark:text-slate-300"
          >
            {text}
          </div>
        ))}
      </div>
    );

    const portfolioExampleSection = (
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-5 text-sm leading-relaxed text-slate-600 dark:border-navy-700/70 dark:bg-navy-950/30 dark:text-slate-300">
          {isPolish
            ? 'Firma ma kilka produktów i inicjatyw, ale budżet pozwala sfinansować tylko część z nich. Portfolio Priority porządkuje karty BCG, pokazuje koszt alternatywny i buduje rekomendowany portfel działań.'
            : 'A company has several products and initiatives, but budget only supports a subset. Portfolio Priority organizes the BCG cards, exposes opportunity cost, and builds the recommended action portfolio.'}
        </div>
        {caseGrid(
          isPolish
            ? [
                {
                  title: 'Budżet inwestycyjny tylko na 3 z 9 inicjatyw',
                  context: 'Lista projektów jest długa, a sponsorzy naciskają na swoje tematy.',
                  question: 'Które inicjatywy finansować, utrzymać, testować albo zatrzymać?',
                  evidence: [
                    'Każda inicjatywa ma innego sponsora, ale tylko część ma dowody wpływu na wzrost lub marżę.',
                    'Dane PMO pokazują przeciążenie zespołów i brak jasnego kryterium stop/continue.',
                  ],
                  aiDraft:
                    'AI proponuje karty portfolio z oceną growth/share/investment, uzasadnieniem oraz rekomendacją invest, maintain, test, harvest albo stop.',
                  approvedUse:
                    'Użytkownik akceptuje scoring tylko tam, gdzie zgadza się z evidence, a potem AI buduje trade-offy zasobów.',
                  outcome:
                    'Powstaje portfel decyzji: trzy inicjatywy do finansowania, dwie do testu z bramkami, reszta do zatrzymania lub odłożenia.',
                },
                {
                  title: 'Portfolio produktów po szybkim wzroście',
                  context:
                    'Część produktów ma wolumen, ale niską marżę; inne są małe, lecz perspektywiczne.',
                  question: 'Gdzie przesunąć zasoby produktowe i sprzedażowe?',
                  evidence: [
                    'Raport sprzedaży pokazuje produkty o wysokim wolumenie i niskiej marży oraz małe produkty z szybkim wzrostem.',
                    'Wywiady z sales wskazują, że zespół sprzedaje to, co łatwe, niekoniecznie to, co strategiczne.',
                  ],
                  aiDraft:
                    'AI klasyfikuje produkty jako stars, cash cows, question marks i dogs oraz proponuje przesunięcia uwagi sprzedaży.',
                  approvedUse:
                    'Po akceptacji kart narzędzie pokazuje koszt alternatywny utrzymywania zbyt szerokiego portfolio.',
                  outcome:
                    'Rekomendacja: utrzymać cash cow, dofinansować jednego question marka, harvestować niskomarżowy wolumen i zatrzymać produkty bez strategicznej roli.',
                },
                {
                  title: 'Transformacja z nadmiarem projektów',
                  context: 'PMO prowadzi wiele równoległych strumieni i traci zdolność dowożenia.',
                  question: 'Które prace są strategiczne, a które tylko zużywają przepustowość?',
                  evidence: [
                    'Statusy projektów są zielone na papierze, ale zależności blokują kluczowe milestone’y.',
                    'Rozmowy z liderami pokazują, że te same osoby są krytyczne dla kilku inicjatyw jednocześnie.',
                  ],
                  aiDraft:
                    'AI ocenia inicjatywy według strategicznego potencjału, pozycji, poziomu inwestycji i realnej przepustowości organizacji.',
                  approvedUse:
                    'Zaakceptowane karty przechodzą do syntezy: co finansować, co utrzymać minimalnie, co zakończyć, a co zamienić w krótki test.',
                  outcome:
                    'Powstaje plan odciążenia PMO: mniej aktywnych strumieni, jasne kryteria restartu i lista tematów do zamknięcia.',
                },
              ]
            : [
                {
                  title: 'Investment budget for only 3 of 9 initiatives',
                  context: 'The project list is long and sponsors push their own priorities.',
                  question: 'Which initiatives should be funded, maintained, tested, or stopped?',
                  evidence: [
                    'Each initiative has a different sponsor, but only some have evidence of growth or margin impact.',
                    'PMO data shows team overload and no clear stop/continue criteria.',
                  ],
                  aiDraft:
                    'AI proposes portfolio cards with growth/share/investment scores, rationale, and an invest/maintain/test/harvest/stop recommendation.',
                  approvedUse:
                    'The user approves scoring only where evidence fits, then AI builds resource trade-offs.',
                  outcome:
                    'The portfolio decision funds three initiatives, tests two with gates, and stops or defers the rest.',
                },
                {
                  title: 'Product portfolio after rapid growth',
                  context:
                    'Some products have volume but low margin; others are small but promising.',
                  question: 'Where should product and sales resources move?',
                  evidence: [
                    'Sales reports show high-volume low-margin products and smaller products with faster growth.',
                    'Sales interviews show the team sells what is easiest, not always what is strategic.',
                  ],
                  aiDraft:
                    'AI classifies products as stars, cash cows, question marks, and dogs, then proposes sales-focus shifts.',
                  approvedUse:
                    'Approved cards expose the opportunity cost of keeping the portfolio too broad.',
                  outcome:
                    'The recommendation maintains the cash cow, funds one question mark, harvests low-margin volume, and stops products without strategic role.',
                },
                {
                  title: 'Transformation overloaded with projects',
                  context: 'PMO runs many parallel streams and loses delivery capacity.',
                  question: 'Which work is strategic and which only consumes throughput?',
                  evidence: [
                    'Project statuses look green on paper, but dependencies block key milestones.',
                    'Leader interviews show the same people are critical to several initiatives at once.',
                  ],
                  aiDraft:
                    'AI scores initiatives by strategic potential, position, investment level, and real organizational capacity.',
                  approvedUse:
                    'Approved cards feed synthesis: what to fund, minimally maintain, stop, or convert into a short test.',
                  outcome:
                    'The result is a PMO relief plan: fewer active streams, restart criteria, and a list of topics to close.',
                },
              ]
        )}
        <PortfolioPriorityLibraryGraphic isPolish={isPolish} variant="example" />
      </div>
    );

    const riskGoalSection = (
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-5 dark:border-navy-700/70 dark:bg-navy-950/30">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-600 dark:text-slate-500">
            {t('discoveryToolsMain.knownToolDetailView.whyUseIt')}
          </div>
          <div className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {isPolish
              ? 'Risk & Uncertainty pomaga sprawdzić, jakie założenia mogą się nie sprawdzić, które ryzyka są krytyczne i jakie ruchy odporności trzeba uruchomić przed decyzją.'
              : 'Risk & Uncertainty helps test which assumptions may fail, which risks are critical, and which resilience moves need to happen before the decision.'}
          </div>
        </div>
        <RiskUncertaintyLibraryGraphic isPolish={isPolish} variant="process" />
      </div>
    );

    const riskProcessSection = (
      <div className="grid gap-4 md:grid-cols-2">
        {[
          [
            'Mission',
            isPolish
              ? 'Decyzja, zakres niepewności i sygnał sukcesu.'
              : 'Decision, uncertainty scope, and success signal.',
          ],
          [
            'Evidence',
            isPolish
              ? 'Sygnały z wywiadu, rynku, danych i operacji.'
              : 'Interview, market, data, and operational signals.',
          ],
          [
            'Risk map',
            isPolish
              ? 'Założenia, ryzyka i scenariusze jako karty AI.'
              : 'Assumptions, risks, and scenarios as AI cards.',
          ],
          [
            'Outputs',
            isPolish
              ? 'Ruchy odporności, output candidates i inicjatywy.'
              : 'Resilience moves, output candidates, and initiatives.',
          ],
        ].map(([title, text]) => (
          <div
            key={title}
            className="rounded-2xl border border-slate-200/70 bg-white/80 p-5 dark:border-navy-700/70 dark:bg-navy-950/30"
          >
            <div className="font-semibold text-slate-900 dark:text-white">{title}</div>
            <div className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {text}
            </div>
          </div>
        ))}
      </div>
    );

    const riskOutcomesSection = (
      <div className="space-y-3">
        {[
          isPolish
            ? 'Zaakceptowana mapa założeń, ryzyk i scenariuszy'
            : 'Approved assumption, risk, and scenario map',
          isPolish
            ? 'Ruchy: validate, mitigate, monitor, hedge, escalate'
            : 'Moves: validate, mitigate, monitor, hedge, escalate',
          isPolish
            ? 'Early warnings i działania odporności'
            : 'Early warnings and resilience actions',
          isPolish
            ? 'Kandydaci outputów i inicjatyw downstream'
            : 'Downstream output and initiative candidates',
        ].map((text) => (
          <div
            key={text}
            className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 text-sm text-slate-700 dark:border-navy-700/70 dark:bg-navy-950/30 dark:text-slate-300"
          >
            {text}
          </div>
        ))}
      </div>
    );

    const riskExampleSection = (
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-5 text-sm leading-relaxed text-slate-600 dark:border-navy-700/70 dark:bg-navy-950/30 dark:text-slate-300">
          {isPolish
            ? 'Firma planuje transformację, ale niepewne są koszty, adopcja i zależności technologiczne. Risk & Uncertainty porządkuje założenia, ryzyka i scenariusze, a potem wskazuje ruchy walidacji i mitygacji.'
            : 'A company plans a transformation, but costs, adoption, and technology dependencies are uncertain. Risk & Uncertainty structures assumptions, risks, and scenarios, then recommends validation and mitigation moves.'}
        </div>
        {caseGrid(
          isPolish
            ? [
                {
                  title: 'Transformacja z niepewną adopcją użytkowników',
                  context:
                    'Plan zakłada szybkie wdrożenie, ale zespoły operacyjne mają różne poziomy gotowości.',
                  question: 'Które założenia trzeba zwalidować przed commitmentem budżetu?',
                  evidence: [
                    'Wywiady pokazują entuzjazm zarządu, ale sceptycyzm kierowników liniowych i brak czasu na szkolenia.',
                    'Poprzednie wdrożenia miały opóźnienia nie przez technologię, tylko przez brak ownershipu po stronie biznesu.',
                  ],
                  aiDraft:
                    'AI proponuje założenia do walidacji, ryzyka adopcji, scenariusz opóźnienia oraz ruchy validate/monitor/mitigate.',
                  approvedUse:
                    'Użytkownik akceptuje karty, które mają realne wskaźniki ostrzegawcze, np. frekwencję szkoleń, aktywność użytkowników i liczbę workaroundów.',
                  outcome:
                    'Powstaje plan odporności: pilot adopcyjny, sponsorzy liniowi, early warnings i progi eskalacji przed pełnym rolloutem.',
                },
                {
                  title: 'Ekspansja przy zmiennym popycie',
                  context:
                    'Popyt rośnie, ale dane rynkowe są rozbieżne i zależne od kilku klientów.',
                  question: 'Jaki scenariusz bazowy, downside i stress powinien sterować decyzją?',
                  evidence: [
                    'Sprzedaż widzi duże zapytania od kilku klientów, ale pipeline jest skoncentrowany i ma niską powtarzalność.',
                    'Dane rynkowe pokazują wzrost kategorii, lecz też sezonowość i zależność od budżetów inwestycyjnych klientów.',
                  ],
                  aiDraft:
                    'AI proponuje scenariusze base/downside/stress, ryzyka koncentracji popytu i sygnały do monitorowania przed decyzją scale.',
                  approvedUse:
                    'Po akceptacji scenariuszy narzędzie buduje ruchy hedge i monitor oraz sugeruje progi, przy których decyzja ma być zatrzymana.',
                  outcome:
                    'Decyzja ekspansyjna dostaje warunki: minimalna liczba niezależnych klientów, próg marży i early warning na spadek konwersji.',
                },
                {
                  title: 'Program kosztowy pod presją czasu',
                  context:
                    'Zarząd oczekuje szybkich oszczędności, ale ryzyko wpływu na jakość jest wysokie.',
                  question: 'Jak ograniczyć ryzyko cięcia zdolności krytycznych?',
                  evidence: [
                    'Finanse widzą szybki potencjał oszczędności, ale operacje wskazują zależności między kosztami a SLA.',
                    'Historia podobnych cięć pokazuje wzrost reklamacji i kosztów naprawczych po kilku miesiącach.',
                  ],
                  aiDraft:
                    'AI proponuje ryzyka jakości, scenariusz odbicia kosztów, założenia do walidacji oraz ruchy mitigate/escalate.',
                  approvedUse:
                    'Akceptowane są tylko te mitygacje, które mają właściciela, trigger i jasny próg eskalacji.',
                  outcome:
                    'Powstaje program oszczędności z guardrailami: czego nie ciąć, co testować krótkim pilotażem i kiedy zatrzymać redukcję.',
                },
              ]
            : [
                {
                  title: 'Transformation with uncertain user adoption',
                  context:
                    'The plan assumes fast rollout, but operating teams have uneven readiness.',
                  question: 'Which assumptions must be validated before budget commitment?',
                  evidence: [
                    'Interviews show executive enthusiasm, but line-manager skepticism and limited training capacity.',
                    'Previous rollouts were delayed not by technology, but by lack of business ownership after go-live.',
                  ],
                  aiDraft:
                    'AI proposes validation assumptions, adoption risks, a delay scenario, and validate/monitor/mitigate moves.',
                  approvedUse:
                    'The user accepts cards with real warning indicators such as training attendance, user activity, and workaround volume.',
                  outcome:
                    'The resilience plan includes an adoption pilot, line sponsors, early warnings, and escalation thresholds before full rollout.',
                },
                {
                  title: 'Expansion under volatile demand',
                  context:
                    'Demand is growing, but market data is mixed and dependent on a few customers.',
                  question: 'Which base, downside, and stress scenarios should steer the decision?',
                  evidence: [
                    'Sales sees large requests from a few customers, but pipeline is concentrated and not yet repeatable.',
                    'Market data shows category growth, but also seasonality and dependence on client investment budgets.',
                  ],
                  aiDraft:
                    'AI proposes base/downside/stress scenarios, demand-concentration risks, and signals to monitor before scale.',
                  approvedUse:
                    'After scenario approval, the tool builds hedge and monitor moves and suggests thresholds that pause the decision.',
                  outcome:
                    'The expansion decision gets conditions: minimum independent customers, margin gate, and early warning for conversion decline.',
                },
                {
                  title: 'Cost program under time pressure',
                  context: 'Leadership expects quick savings, but quality impact risk is high.',
                  question: 'How can the company avoid cutting critical capabilities?',
                  evidence: [
                    'Finance sees fast savings potential, but operations points to dependencies between cost and SLA.',
                    'History of similar cuts shows complaints and rework costs rising several months later.',
                  ],
                  aiDraft:
                    'AI proposes quality risks, a cost rebound scenario, assumptions to validate, and mitigate/escalate moves.',
                  approvedUse:
                    'Only mitigations with an owner, trigger, and clear escalation threshold are accepted.',
                  outcome:
                    'The cost program gets guardrails: what not to cut, what to test through a pilot, and when to stop reductions.',
                },
              ]
        )}
        <RiskUncertaintyLibraryGraphic isPolish={isPolish} variant="example" />
      </div>
    );

    // ── Standard-C group tabs (mirrors InsightViewer/InitiativeDocumentView) ──
    // Every per-tool branch below returns the same 4 sections (goal / process /
    // outcomes / example). A bilingual groupLabels array switched on isPolish +
    // a per-section group assignment makes NModeShell's C-board render top group
    // tabs; wide narrative sections get cSpan: 2 so they breathe in the dense
    // 3-column grid. N-mode uses the same group fields for sidebar headers.
    const groupLabels = isPolish
      ? ['Przegląd', 'Jak to działa', 'Przykład']
      : ['Overview', 'How it works', 'Example'];
    const groupIndexById: Record<string, number> = {
      goal: 0, // Overview / Przegląd
      process: 1, // How it works / Jak to działa
      outcomes: 1,
      example: 2, // Example / Przykład
    };
    const cSpanById: Record<string, 1 | 2 | 3> = {
      goal: 2, // multi-card positioning grids
      process: 2, // stepper + decision-situation grids
      outcomes: 2, // 3-column outcome blocks
      example: 3, // wide 3-col case grids
    };
    const withGroup = (list: NModeSection[]): NModeSection[] =>
      list.map((section) => ({
        ...section,
        group: groupLabels[groupIndexById[section.id] ?? 0],
        cSpan: cSpanById[section.id] ?? section.cSpan,
      }));

    if (tool?.toolType === 'dynamic-swot') {
      return withGroup([
        {
          id: 'goal',
          icon: Target,
          label: { en: 'Goal', pl: 'Cel' },
          component: goalSection,
        },
        {
          id: 'process',
          icon: CheckCircle2,
          label: { en: 'Process', pl: 'Proces' },
          component: processSection,
        },
        {
          id: 'outcomes',
          icon: Lightbulb,
          label: { en: 'Outcomes', pl: 'Rezultat' },
          component: outcomesSection,
        },
        {
          id: 'example',
          icon: FileText,
          label: { en: 'Example', pl: 'Przykład' },
          component: exampleSection,
        },
      ]);
    }

    if (tool?.toolType === 'market-forces' || toolType === 'market-forces') {
      return withGroup([
        {
          id: 'goal',
          icon: Target,
          label: { en: 'Goal', pl: 'Cel' },
          component: marketGoalSection,
        },
        {
          id: 'process',
          icon: CheckCircle2,
          label: { en: 'Process', pl: 'Proces' },
          component: marketProcessSection,
        },
        {
          id: 'outcomes',
          icon: Lightbulb,
          label: { en: 'Outcomes', pl: 'Rezultat' },
          component: marketOutcomesSection,
        },
        {
          id: 'example',
          icon: FileText,
          label: { en: 'Example', pl: 'Przykład' },
          component: marketExampleSection,
        },
      ]);
    }

    if (tool?.toolType === 'growth-paths' || toolType === 'growth-paths') {
      return withGroup([
        {
          id: 'goal',
          icon: Target,
          label: { en: 'Goal', pl: 'Cel' },
          component: growthGoalSection,
        },
        {
          id: 'process',
          icon: CheckCircle2,
          label: { en: 'Process', pl: 'Proces' },
          component: growthProcessSection,
        },
        {
          id: 'outcomes',
          icon: Lightbulb,
          label: { en: 'Outcomes', pl: 'Rezultat' },
          component: growthOutcomesSection,
        },
        {
          id: 'example',
          icon: FileText,
          label: { en: 'Example', pl: 'Przykład' },
          component: growthExampleSection,
        },
      ]);
    }

    if (tool?.toolType === 'portfolio-priority' || toolType === 'portfolio-priority') {
      return withGroup([
        {
          id: 'goal',
          icon: Target,
          label: { en: 'Goal', pl: 'Cel' },
          component: portfolioGoalSection,
        },
        {
          id: 'process',
          icon: CheckCircle2,
          label: { en: 'Process', pl: 'Proces' },
          component: portfolioProcessSection,
        },
        {
          id: 'outcomes',
          icon: Lightbulb,
          label: { en: 'Outcomes', pl: 'Rezultat' },
          component: portfolioOutcomesSection,
        },
        {
          id: 'example',
          icon: FileText,
          label: { en: 'Example', pl: 'Przykład' },
          component: portfolioExampleSection,
        },
      ]);
    }

    if (tool?.toolType === 'risk-uncertainty' || toolType === 'risk-uncertainty') {
      return withGroup([
        {
          id: 'goal',
          icon: Target,
          label: { en: 'Goal', pl: 'Cel' },
          component: riskGoalSection,
        },
        {
          id: 'process',
          icon: CheckCircle2,
          label: { en: 'Process', pl: 'Proces' },
          component: riskProcessSection,
        },
        {
          id: 'outcomes',
          icon: Lightbulb,
          label: { en: 'Outcomes', pl: 'Rezultat' },
          component: riskOutcomesSection,
        },
        {
          id: 'example',
          icon: FileText,
          label: { en: 'Example', pl: 'Przykład' },
          component: riskExampleSection,
        },
      ]);
    }

    return withGroup([
      {
        id: 'goal',
        icon: Target,
        label: { en: 'Goal', pl: 'Cel' },
        component: goalSection,
      },
      {
        id: 'process',
        icon: CheckCircle2,
        label: { en: 'Process', pl: 'Proces' },
        component: processSection,
      },
      {
        id: 'outcomes',
        icon: Lightbulb,
        label: { en: 'Outcomes', pl: 'Rezultat' },
        component: outcomesSection,
      },
      {
        id: 'example',
        icon: FileText,
        label: { en: 'Example', pl: 'Przykład' },
        component: exampleSection,
      },
    ]);
  }, [tool, isPolish, toolType]);

  return (
    <NModeShell
      loading={loading}
      presentationMode={mode}
      onPresentationModeChange={setMode}
      header={{
        title: tool?.name || toolType,
        onTitleChange: () => {},
        titleReadOnly: true,
        artifactId: tool?.toolType || toolType,
        artifactType: 'tool',
        onSave: () => {},
        saving: false,
        isDirty: false,
        onClose,
        statusDotColor: 'bg-primary-400',
      }}
      properties={properties}
      sections={sections}
      actions={actions}
      actionsVisible={true}
      activeSection={activeSection}
      onSectionChange={setActiveSection}
    />
  );
}
