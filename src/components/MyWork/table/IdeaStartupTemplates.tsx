/**
 * IdeaStartupTemplates — Clean seed surface for Ideas.
 *
 * Textarea for problem description + 3 action cards + workspace selector.
 * No tables, no template galleries, no "Popular Starts" — just the essentials.
 */
import {
  ArrowRight,
  Brain,
  GitFork,
  LayoutGrid,
  Network,
  PenTool,
  Sparkles,
  Table2,
  Wand2,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useDialogA11y } from '@/components/ui/primitives/useDialogA11y';

import type { IdeaWorkspaceSeedIntent } from '../ideaEntryTypes';
import type { CanvasToolType } from '../ideaSelectionTypes';
import { IDEA_STARTING_POINTS } from '../ideaStartingPoints';

interface IdeaStartupTemplatesProps {
  open: boolean;
  onClose: () => void;
  onSelect: (payload: IdeaWorkspaceSeedIntent) => void;
}

type StartAction = 'describe_with_ai' | 'blank_canvas' | 'use_template';

const WORKSPACE_OPTIONS: {
  id: CanvasToolType;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  labelPl: string;
  labelEn: string;
  color: string;
}[] = [
  { id: 'mindmap', icon: Network, labelPl: 'Mapa myśli', labelEn: 'Mind Map', color: 'violet' },
  {
    id: 'process_flow',
    icon: GitFork,
    labelPl: 'Schemat procesu',
    labelEn: 'Process Flow',
    color: 'blue',
  },
  { id: 'table', icon: Table2, labelPl: 'Tabela', labelEn: 'Table', color: 'emerald' },
  { id: 'whiteboard', icon: PenTool, labelPl: 'Whiteboard', labelEn: 'Whiteboard', color: 'amber' },
];

const TEMPLATES = WORKSPACE_OPTIONS;
const popularStarts = IDEA_STARTING_POINTS.slice(0, 4);

const COLOR_MAP: Record<string, { bg: string; text: string; border: string; ring: string }> = {
  violet: {
    bg: 'bg-violet-500/10',
    text: 'text-violet-500',
    border: 'border-violet-500/30',
    ring: 'ring-c-focus',
  },
  blue: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-500',
    border: 'border-blue-500/30',
    ring: 'ring-blue-500/40',
  },
  emerald: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-500',
    border: 'border-emerald-500/30',
    ring: 'ring-emerald-500/40',
  },
  amber: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-500',
    border: 'border-amber-500/30',
    ring: 'ring-amber-500/40',
  },
};

export const IdeaStartupTemplates: React.FC<IdeaStartupTemplatesProps> = ({
  open,
  onClose,
  onSelect,
}) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const [heroText, setHeroText] = useState('');
  const [selectedWorkspace, setSelectedWorkspace] = useState<CanvasToolType>('mindmap');
  const [showStructuredBrief, setShowStructuredBrief] = useState(false);
  const [structuredBrief, setStructuredBrief] = useState({
    problem: '',
    goal: '',
    constraints: '',
  });
  // #10-Start (bug#1): click selects only. Creation requires the explicit
  // Start button, or Enter while the already-selected action card has focus.
  const [selectedAction, setSelectedAction] = useState<StartAction | null>(null);

  const handleSelect = useCallback(
    (startMode: StartAction) => {
      onSelect({
        startMode,
        seedText: heroText.trim(),
        preferredSystem: selectedWorkspace,
        templateId: null,
        popularStartId: null,
        popularStartLabel: null,
        structuredBrief: showStructuredBrief
          ? {
              problem: structuredBrief.problem.trim(),
              desiredOutcome: structuredBrief.goal.trim(),
              constraints: structuredBrief.constraints
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean)
                .join('\n'),
            }
          : null,
        source: 'seed_surface',
      });
      setHeroText('');
      setSelectedWorkspace('mindmap');
      setShowStructuredBrief(false);
      setStructuredBrief({ problem: '', goal: '', constraints: '' });
      setSelectedAction(null);
      onClose();
    },
    [heroText, selectedWorkspace, showStructuredBrief, structuredBrief, onClose, onSelect]
  );

  const handleCardClick = useCallback((action: StartAction) => {
    setSelectedAction(action);
  }, []);

  const handleStart = useCallback(() => {
    if (!selectedAction) return;
    handleSelect(selectedAction);
  }, [selectedAction, handleSelect]);

  // Reset selection whenever the modal re-opens.
  useEffect(() => {
    if (open) setSelectedAction(null);
  }, [open]);

  const handlePopularStart = useCallback(
    (start: (typeof popularStarts)[number]) => {
      const prompt = isPl ? start.promptPl : start.promptEn;
      setHeroText(prompt);
      setSelectedWorkspace(start.preferredSystem);
      onSelect({
        startMode: 'describe_with_ai',
        seedText: prompt,
        preferredSystem: start.preferredSystem,
        templateId: null,
        popularStartId: start.id,
        popularStartLabel: isPl ? start.labelPl : start.labelEn,
        structuredBrief: null,
        source: 'seed_surface',
      });
      onClose();
    },
    [isPl, onClose, onSelect]
  );

  const PrimaryStartButton = ({
    children,
    onClick,
    className,
    selected,
  }: {
    children: React.ReactNode;
    onClick: () => void;
    className: string;
    selected: boolean;
  }) => (
    <button
      type="button"
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && selected) {
          event.preventDefault();
          handleStart();
        }
      }}
      aria-pressed={selected}
      className={`${className} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:ring-offset-2 ${
        selected
          ? 'ring-2 ring-c-focus ring-offset-1 ring-offset-c-surface shadow-lg -translate-y-0.5'
          : ''
      }`}
    >
      {children}
    </button>
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const heroTextareaRef = useRef<HTMLTextAreaElement>(null);
  const briefProblemRef = useRef<HTMLInputElement>(null);
  useDialogA11y({ open, onClose, containerRef, initialFocusRef: heroTextareaRef });

  useEffect(() => {
    if (showStructuredBrief) briefProblemRef.current?.focus();
  }, [showStructuredBrief]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="idea-startup-templates-heading"
        tabIndex={-1}
        className="w-[520px] max-w-full max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface shadow-[0_32px_64px_-12px_rgba(0,0,0,0.35)] backdrop-blur-xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 outline-none"
      >
        {/* ── Header ─────────────────────────────────────────── */}
        <div className="relative flex items-center justify-between px-6 py-4 border-b border-c-border-subtle">
          <div className="absolute inset-0 bg-c-surface-raised" />
          <div className="relative flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-c-surface-raised flex items-center justify-center">
              <Sparkles size={16} className="text-c-text-secondary" />
            </div>
            <div>
              <h3 id="idea-startup-templates-heading" className="text-[15px] font-semibold text-c-text">
                {t('myWorkTable.ideaStartupTemplates.newIdea')}
              </h3>
              <p className="text-[11px] text-c-text-muted mt-0.5">
                {t('myWorkTable.ideaStartupTemplates.calmStartFastHandoffInto')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close', 'Close')}
            className="relative p-1.5 rounded-lg hover:bg-c-surface-raised transition-colors duration-150"
          >
            <X size={16} className="text-c-text-secondary" />
          </button>
        </div>

        {/* ── Body ───────────────────────────────────────────── */}
        <div className="px-6 py-5 space-y-5">
          {/* Problem description */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-c-text-muted mb-1.5">
              {t('myWorkTable.ideaStartupTemplates.yourIdea')}
            </div>
            <h4
              id="idea-seed-description-label"
              className="text-lg font-semibold text-c-text tracking-tight"
            >
              {t('myWorkTable.ideaStartupTemplates.describeTheProblemIdeaOr')}
            </h4>
            <p className="mt-1 text-[13px] text-c-text-muted leading-relaxed">
              {t('myWorkTable.ideaStartupTemplates.lightStartWithoutAHeavy')}
            </p>
            <textarea
              ref={heroTextareaRef}
              id="idea-seed-description"
              aria-labelledby="idea-seed-description-label"
              value={heroText}
              onChange={(e) => setHeroText(e.target.value)}
              rows={3}
              placeholder={t('myWorkTable.ideaStartupTemplates.eGIWantTo')}
              className="mt-3 w-full rounded-xl border border-slate-200/60 dark:border-white/[0.03] dark:border-c-border-subtle bg-c-surface px-4 py-3 text-sm text-c-text placeholder:text-c-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none transition-shadow duration-200"
            />
          </div>

          {/* Workspace selector — MUST come before the action cards so the
              user picks a tool before triggering a start action (Z18). */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-c-text-muted mb-2.5">
              {t('myWorkTable.ideaStartupTemplates.n1ChooseYourTool')}
            </div>
            <div
              className="grid grid-cols-2 gap-2 sm:grid-cols-4"
              role="group"
              aria-label={t('myWorkTable.ideaStartupTemplates.n1ChooseYourTool')}
            >
              {TEMPLATES.map((ws) => {
                const active = selectedWorkspace === ws.id;
                const c = COLOR_MAP[ws.color];
                const Icon = ws.icon;
                return (
                  <button
                    key={ws.id}
                    type="button"
                    onClick={() => setSelectedWorkspace(ws.id)}
                    aria-pressed={active}
                    className={`
                      flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-center transition-all duration-200
                      ${
                        active
                          ? `${c.bg} ${c.border} border-2 ring-2 ${c.ring} shadow-sm`
                          : 'border border-c-border-subtle hover:border-c-border-subtle hover:bg-c-surface-raised'
                      }
                    `}
                  >
                    <Icon size={18} className={active ? c.text : 'text-c-text-secondary'} />
                    <span
                      className={`text-[11px] font-medium ${active ? c.text : 'text-c-text-muted'}`}
                    >
                      {isPl ? ws.labelPl : ws.labelEn}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3 Action Cards */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-c-text-muted mb-2.5">
              {t('myWorkTable.ideaStartupTemplates.n2ChooseAStart')}
            </div>
            <div
              className="grid grid-cols-1 gap-3 sm:grid-cols-3"
              role="group"
              aria-label={t('myWorkTable.ideaStartupTemplates.n2ChooseAStart')}
            >
              {/* Start with AI */}
              <PrimaryStartButton
                onClick={() => handleCardClick('describe_with_ai')}
                selected={selectedAction === 'describe_with_ai'}
                className="group flex flex-col items-center gap-2.5 rounded-xl border border-c-border-subtle bg-c-surface-raised px-3 py-4 text-center transition-all duration-200 hover:border-c-border-subtle hover:shadow-lg hover:-translate-y-0.5"
              >
                <div className="rounded-xl p-2.5 bg-c-surface text-c-text-muted transition-transform duration-200 group-hover:scale-110">
                  <Wand2 size={18} />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-c-text">
                    {t('ideas.table.ideaStartupTemplates.startWithAi', 'Start with AI')}
                  </div>
                  <div className="mt-0.5 text-[10px] text-c-text-muted leading-snug">
                    {t('myWorkTable.ideaStartupTemplates.transferSeedToWorkspaceAnd')}
                  </div>
                </div>
                <ArrowRight
                  size={12}
                  className="text-c-text-secondary transition-transform group-hover:translate-x-0.5"
                />
              </PrimaryStartButton>

              {/* Blank canvas */}
              <PrimaryStartButton
                onClick={() => handleCardClick('blank_canvas')}
                selected={selectedAction === 'blank_canvas'}
                className="group flex flex-col items-center gap-2.5 rounded-xl border border-c-border-subtle bg-c-surface-raised px-3 py-4 text-center transition-all duration-200 hover:border-c-border-subtle hover:shadow-lg hover:-translate-y-0.5"
              >
                <div className="rounded-xl p-2.5 bg-c-surface text-c-text-muted transition-transform duration-200 group-hover:scale-110">
                  <Brain size={18} />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-c-text">
                    {t('ideas.table.ideaStartupTemplates.blankCanvas', 'Blank canvas')}
                  </div>
                  <div className="mt-0.5 text-[10px] text-c-text-muted leading-snug">
                    {t('myWorkTable.ideaStartupTemplates.openACalmWorkspaceWith')}
                  </div>
                </div>
                <ArrowRight
                  size={12}
                  className="text-c-text-secondary transition-transform group-hover:translate-x-0.5"
                />
              </PrimaryStartButton>

              {/* Use template */}
              <PrimaryStartButton
                onClick={() => handleCardClick('use_template')}
                selected={selectedAction === 'use_template'}
                className="group flex flex-col items-center gap-2.5 rounded-xl border border-c-border-subtle bg-c-surface-raised px-3 py-4 text-center transition-all duration-200 hover:border-c-border hover:shadow-lg hover:-translate-y-0.5"
              >
                <div className="rounded-xl p-2.5 bg-c-surface text-c-text-muted transition-transform duration-200 group-hover:scale-110">
                  <LayoutGrid size={18} />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-c-text">
                    {t('myWorkTable.ideaStartupTemplates.useTemplate')}
                  </div>
                  <div className="mt-0.5 text-[10px] text-c-text-muted leading-snug">
                    {t('myWorkTable.ideaStartupTemplates.enterViaAStarterTemplate')}
                  </div>
                </div>
                <ArrowRight
                  size={12}
                  className="text-c-text-secondary transition-transform group-hover:translate-x-0.5"
                />
              </PrimaryStartButton>
            </div>
          </div>

          <div className="rounded-xl border border-c-border-subtle dark:border-c-border-subtle bg-c-surface-raised p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-c-text-muted">
                {t('myWorkTable.ideaStartupTemplates.popularStarts')}
              </div>
              <button
                type="button"
                onClick={() => setShowStructuredBrief((next) => !next)}
                aria-expanded={showStructuredBrief}
                aria-controls="idea-structured-brief"
                className="text-[11px] font-medium text-c-text hover:underline"
              >
                {showStructuredBrief
                  ? t('myWorkTable.ideaStartupTemplates.hideBrief')
                  : t('myWorkTable.ideaStartupTemplates.addBrief')}
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {popularStarts.map((start) => (
                <button
                  key={start.id}
                  type="button"
                  onClick={() => handlePopularStart(start)}
                  className="rounded-full border border-slate-200/60 dark:border-white/[0.03] bg-c-surface-raised px-3 py-1.5 text-[11px] font-medium text-c-text-secondary hover:border-c-border hover:text-c-text"
                >
                  {isPl ? start.labelPl : start.labelEn}
                </button>
              ))}
            </div>
            {showStructuredBrief && (
              <div id="idea-structured-brief" className="mt-3 grid gap-2">
                <label htmlFor="idea-brief-problem" className="sr-only">
                  {t('myWorkTable.ideaStartupTemplates.problem')}
                </label>
                <input
                  ref={briefProblemRef}
                  id="idea-brief-problem"
                  value={structuredBrief.problem}
                  onChange={(e) =>
                    setStructuredBrief((prev) => ({ ...prev, problem: e.target.value }))
                  }
                  placeholder={t('myWorkTable.ideaStartupTemplates.problem')}
                  className="rounded-lg border border-slate-200/60 dark:border-white/[0.03] dark:border-c-border-subtle bg-c-surface px-3 py-2 text-xs"
                />
                <label htmlFor="idea-brief-goal" className="sr-only">
                  {t('myWorkTable.ideaStartupTemplates.goalOutcome')}
                </label>
                <input
                  id="idea-brief-goal"
                  value={structuredBrief.goal}
                  onChange={(e) =>
                    setStructuredBrief((prev) => ({ ...prev, goal: e.target.value }))
                  }
                  placeholder={t('myWorkTable.ideaStartupTemplates.goalOutcome')}
                  className="rounded-lg border border-slate-200/60 dark:border-white/[0.03] dark:border-c-border-subtle bg-c-surface px-3 py-2 text-xs"
                />
                <label htmlFor="idea-brief-constraints" className="sr-only">
                  {t('myWorkTable.ideaStartupTemplates.constraintsOnePerLine')}
                </label>
                <textarea
                  id="idea-brief-constraints"
                  value={structuredBrief.constraints}
                  onChange={(e) =>
                    setStructuredBrief((prev) => ({ ...prev, constraints: e.target.value }))
                  }
                  rows={2}
                  placeholder={t('myWorkTable.ideaStartupTemplates.constraintsOnePerLine')}
                  className="rounded-lg border border-slate-200/60 dark:border-white/[0.03] dark:border-c-border-subtle bg-c-surface px-3 py-2 text-xs resize-none"
                />
              </div>
            )}
          </div>
        </div>

        {/* ── Footer — Start action, disabled until a card is selected ── */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-c-border-subtle">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-[13px] font-medium text-c-text-secondary transition-colors hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            type="button"
            onClick={handleStart}
            disabled={!selectedAction}
            className="rounded-lg bg-c-surface-raised border border-c-border-subtle px-4 py-2 text-[13px] font-semibold text-c-text transition-colors duration-150 hover:bg-c-surface enabled:hover:border-c-focus disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t('myWorkTable.ideaStartupTemplates.start')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default IdeaStartupTemplates;
