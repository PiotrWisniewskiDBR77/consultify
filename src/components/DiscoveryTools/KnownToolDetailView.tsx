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
            {chipRow([
              'Mission brief',
              'Evidence-first',
              'Tensions',
              'Recommended moves',
              'Outputs',
            ])}
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
            {t('discoveryToolsMain.knownToolDetail.growthPaths.goal.positioningHeadline')}
          </div>
          <div className="mt-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
            {t('discoveryToolsMain.knownToolDetail.growthPaths.goal.positioningBody')}
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
          {(
            t('discoveryToolsMain.knownToolDetail.growthPaths.process.steps', {
              returnObjects: true,
            }) as Array<{ title: string; text: string }>
          ).map(({ title, text }, index) => (
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
          {(
            t('discoveryToolsMain.knownToolDetail.growthPaths.outcomes.blocks', {
              returnObjects: true,
            }) as Array<{ title: string; text: string }>
          ).map(({ title, text }) => (
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
            {t('discoveryToolsMain.knownToolDetail.growthPaths.example.intro')}
          </div>
        </div>
        {caseGrid(
          t('discoveryToolsMain.knownToolDetail.growthPaths.example.cases', {
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
            {t('discoveryToolsMain.knownToolDetail.portfolioPriority.goal.positioningBody')}
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
            t('discoveryToolsMain.knownToolDetail.portfolioPriority.process.missionText'),
          ],
          [
            'Evidence',
            t('discoveryToolsMain.knownToolDetail.portfolioPriority.process.evidenceText'),
          ],
          ['Items', t('discoveryToolsMain.knownToolDetail.portfolioPriority.process.itemsText')],
          [
            'Outputs',
            t('discoveryToolsMain.knownToolDetail.portfolioPriority.process.outputsText'),
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
          t('discoveryToolsMain.knownToolDetail.portfolioPriority.outcomes.tradeOffs'),
          t('discoveryToolsMain.knownToolDetail.portfolioPriority.outcomes.moves'),
          t('discoveryToolsMain.knownToolDetail.portfolioPriority.outcomes.candidates'),
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
          {t('discoveryToolsMain.knownToolDetail.portfolioPriority.example.intro')}
        </div>
        {caseGrid(
          t('discoveryToolsMain.knownToolDetail.portfolioPriority.example.cases', {
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
            {t('discoveryToolsMain.knownToolDetail.riskUncertainty.goal.positioningBody')}
          </div>
        </div>
        <RiskUncertaintyLibraryGraphic isPolish={isPolish} variant="process" />
      </div>
    );

    const riskProcessSection = (
      <div className="grid gap-4 md:grid-cols-2">
        {[
          ['Mission', t('discoveryToolsMain.knownToolDetail.riskUncertainty.process.missionText')],
          [
            'Evidence',
            t('discoveryToolsMain.knownToolDetail.riskUncertainty.process.evidenceText'),
          ],
          ['Risk map', t('discoveryToolsMain.knownToolDetail.riskUncertainty.process.riskMapText')],
          ['Outputs', t('discoveryToolsMain.knownToolDetail.riskUncertainty.process.outputsText')],
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
          t('discoveryToolsMain.knownToolDetail.riskUncertainty.outcomes.map'),
          t('discoveryToolsMain.knownToolDetail.riskUncertainty.outcomes.moves'),
          t('discoveryToolsMain.knownToolDetail.riskUncertainty.outcomes.earlyWarnings'),
          t('discoveryToolsMain.knownToolDetail.riskUncertainty.outcomes.candidates'),
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
          {t('discoveryToolsMain.knownToolDetail.riskUncertainty.example.intro')}
        </div>
        {caseGrid(
          t('discoveryToolsMain.knownToolDetail.riskUncertainty.example.cases', {
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
        <RiskUncertaintyLibraryGraphic isPolish={isPolish} variant="example" />
      </div>
    );

    // ── Standard-C group tabs (mirrors InsightViewer/InitiativeDocumentView) ──
    // Every per-tool branch below returns the same 4 sections (goal / process /
    // outcomes / example). A localized groupLabels array +
    // a per-section group assignment makes NModeShell's C-board render top group
    // tabs; wide narrative sections get cSpan: 2 so they breathe in the dense
    // 3-column grid. N-mode uses the same group fields for sidebar headers.
    const groupLabels = [
      t('discoveryToolsMain.knownToolDetailView.groupOverview'),
      t('discoveryToolsMain.knownToolDetailView.groupHowItWorks'),
      t('discoveryToolsMain.knownToolDetailView.groupExample'),
    ];
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
