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
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { IdeaWorkspaceSeedIntent } from '../ideaEntryTypes';
import type { CanvasToolType } from '../ideaSelectionTypes';
import { IDEA_STARTING_POINTS } from '../ideaStartingPoints';

interface IdeaStartupTemplatesProps {
  open: boolean;
  onClose: () => void;
  onSelect: (payload: IdeaWorkspaceSeedIntent) => void;
}

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
    bg: 'bg-c-accent-soft',
    text: 'text-c-accent',
    border: 'border-c-accent',
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
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const [heroText, setHeroText] = useState('');
  const [selectedWorkspace, setSelectedWorkspace] = useState<CanvasToolType>('mindmap');
  const [showStructuredBrief, setShowStructuredBrief] = useState(false);
  const [structuredBrief, setStructuredBrief] = useState({
    problem: '',
    goal: '',
    constraints: '',
  });

  const handleSelect = useCallback(
    (startMode: 'describe_with_ai' | 'blank_canvas' | 'use_template') => {
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
      onClose();
    },
    [heroText, selectedWorkspace, showStructuredBrief, structuredBrief, onClose, onSelect]
  );

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
  }: {
    children: React.ReactNode;
    onClick: () => void;
    className: string;
  }) => (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-[520px] max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface shadow-[0_32px_64px_-12px_rgba(0,0,0,0.35)] backdrop-blur-xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
        {/* ── Header ─────────────────────────────────────────── */}
        <div className="relative flex items-center justify-between px-6 py-4 border-b border-c-border-subtle">
          <div className="absolute inset-0 bg-c-surface-raised" />
          <div className="relative flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-c-accent-soft flex items-center justify-center">
              <Sparkles size={16} className="text-c-accent" />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-c-text">
                {isPl ? 'Nowy pomysł' : 'New Idea'}
              </h3>
              <p className="text-[11px] text-c-text-muted mt-0.5">
                {isPl
                  ? 'Spokojny start, szybkie przejście do workspace.'
                  : 'Calm start, fast handoff into workspace.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="relative p-1.5 rounded-lg hover:bg-c-surface-raised transition-colors duration-150"
          >
            <X size={16} className="text-c-text-secondary" />
          </button>
        </div>

        {/* ── Body ───────────────────────────────────────────── */}
        <div className="px-6 py-5 space-y-5">
          {/* Problem description */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-c-accent mb-1.5">
              {isPl ? 'Twój pomysł' : 'Your idea'}
            </div>
            <h4 className="text-lg font-semibold text-c-text tracking-tight">
              {isPl ? 'Opisz problem, pomysł albo wynik' : 'Describe the problem, idea, or outcome'}
            </h4>
            <p className="mt-1 text-[13px] text-c-text-muted leading-relaxed">
              {isPl
                ? 'Lekki start bez ciężkiego formularza. Brief dodasz tylko gdy potrzebujesz.'
                : 'Light start without a heavy form. Add a brief only when you need one.'}
            </p>
            <textarea
              value={heroText}
              onChange={(e) => setHeroText(e.target.value)}
              rows={3}
              placeholder={
                isPl
                  ? 'Np. Chcę uporządkować inicjatywy transformacyjne i znaleźć najlepszą kolejność wdrożeń...'
                  : 'E.g. I want to structure transformation initiatives and find the best rollout order...'
              }
              autoFocus
              className="mt-3 w-full rounded-xl border border-slate-200/60 dark:border-white/[0.03] dark:border-c-border-subtle bg-c-surface px-4 py-3 text-sm text-c-text placeholder:text-c-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none transition-shadow duration-200"
            />
          </div>

          {/* Workspace selector — MUST come before the action cards so the
              user picks a tool before triggering a start action (Z18). */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-c-text-muted mb-2.5">
              {isPl ? '1. Wybierz narzędzie' : '1. Choose your tool'}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {TEMPLATES.map((ws) => {
                const active = selectedWorkspace === ws.id;
                const c = COLOR_MAP[ws.color];
                const Icon = ws.icon;
                return (
                  <button
                    key={ws.id}
                    type="button"
                    onClick={() => setSelectedWorkspace(ws.id)}
                    className={`
                      flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-center transition-all duration-200
                      ${
                        active
                          ? `${c.bg} ${c.border} border-2 ring-2 ${c.ring} shadow-sm`
                          : 'border border-c-border-subtle hover:border-c-border-subtle hover:bg-c-surface-raised'
                      }
                    `}
                  >
                    <Icon
                      size={18}
                      className={active ? c.text : 'text-c-text-secondary'}
                    />
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
              {isPl ? '2. Wybierz start' : '2. Choose a start'}
            </div>
            <div className="grid grid-cols-3 gap-3">
            {/* Start with AI */}
            <PrimaryStartButton
              onClick={() => handleSelect('describe_with_ai')}
              className="group flex flex-col items-center gap-2.5 rounded-xl border border-c-accent bg-c-accent-soft px-3 py-4 text-center transition-all duration-200 hover:border-c-accent hover:shadow-lg hover:-translate-y-0.5"
            >
              <div className="rounded-xl p-2.5 bg-c-accent-soft text-c-accent transition-transform duration-200 group-hover:scale-110">
                <Wand2 size={18} />
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-c-accent">
                  Start with AI
                </div>
                <div className="mt-0.5 text-[10px] text-c-text-muted leading-snug">
                  {isPl
                    ? 'Przenieś seed do workspace i od razu uruchom builder flow.'
                    : 'Transfer seed to workspace and launch builder flow.'}
                </div>
              </div>
              <ArrowRight
                size={12}
                className="text-c-text-secondary transition-transform group-hover:translate-x-0.5"
              />
            </PrimaryStartButton>

            {/* Blank canvas */}
            <PrimaryStartButton
              onClick={() => handleSelect('blank_canvas')}
              className="group flex flex-col items-center gap-2.5 rounded-xl border border-c-border-subtle bg-c-surface-raised px-3 py-4 text-center transition-all duration-200 hover:border-c-border-subtle hover:shadow-lg hover:-translate-y-0.5"
            >
              <div className="rounded-xl p-2.5 bg-c-surface text-c-text-muted transition-transform duration-200 group-hover:scale-110">
                <Brain size={18} />
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-c-text">
                  Blank canvas
                </div>
                <div className="mt-0.5 text-[10px] text-c-text-muted leading-snug">
                  {isPl
                    ? 'Otwórz spokojny workspace z wybranym systemem startowym.'
                    : 'Open a calm workspace with your chosen starting system.'}
                </div>
              </div>
              <ArrowRight
                size={12}
                className="text-c-text-secondary transition-transform group-hover:translate-x-0.5"
              />
            </PrimaryStartButton>

            {/* Use template */}
            <PrimaryStartButton
              onClick={() => handleSelect('use_template')}
              className="group flex flex-col items-center gap-2.5 rounded-xl border border-c-success bg-c-surface-raised px-3 py-4 text-center transition-all duration-200 hover:border-c-success hover:shadow-lg hover:-translate-y-0.5"
            >
              <div className="rounded-xl p-2.5 text-c-success transition-transform duration-200 group-hover:scale-110" style={{ backgroundColor: 'color-mix(in srgb, var(--c-success) 12%, transparent)' }}>
                <LayoutGrid size={18} />
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-emerald-600 dark:text-emerald-300">
                  {isPl ? 'Użyj szablonu' : 'Use template'}
                </div>
                <div className="mt-0.5 text-[10px] text-c-text-muted leading-snug">
                  {isPl
                    ? 'Wejdź przez szablon startowy i ustaw domyślny system pracy.'
                    : 'Enter via a starter template with a default work system.'}
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
                {isPl ? 'Popularne starty' : 'Popular starts'}
              </div>
              <button
                type="button"
                onClick={() => setShowStructuredBrief((next) => !next)}
                className="text-[11px] font-medium text-c-accent hover:underline"
              >
                {showStructuredBrief
                  ? isPl
                    ? 'Ukryj brief'
                    : 'Hide brief'
                  : isPl
                    ? 'Dodaj brief'
                    : 'Add brief'}
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {popularStarts.map((start) => (
                <button
                  key={start.id}
                  type="button"
                  onClick={() => handlePopularStart(start)}
                  className="rounded-full border border-slate-200/60 dark:border-white/[0.03] bg-c-surface-raised px-3 py-1.5 text-[11px] font-medium text-c-text-secondary hover:border-c-accent hover:text-c-accent"
                >
                  {isPl ? start.labelPl : start.labelEn}
                </button>
              ))}
            </div>
            {showStructuredBrief && (
              <div className="mt-3 grid gap-2">
                <input
                  value={structuredBrief.problem}
                  onChange={(e) =>
                    setStructuredBrief((prev) => ({ ...prev, problem: e.target.value }))
                  }
                  placeholder={isPl ? 'Problem' : 'Problem'}
                  className="rounded-lg border border-slate-200/60 dark:border-white/[0.03] dark:border-c-border-subtle bg-c-surface px-3 py-2 text-xs"
                />
                <input
                  value={structuredBrief.goal}
                  onChange={(e) =>
                    setStructuredBrief((prev) => ({ ...prev, goal: e.target.value }))
                  }
                  placeholder={isPl ? 'Cel / wynik' : 'Goal / outcome'}
                  className="rounded-lg border border-slate-200/60 dark:border-white/[0.03] dark:border-c-border-subtle bg-c-surface px-3 py-2 text-xs"
                />
                <textarea
                  value={structuredBrief.constraints}
                  onChange={(e) =>
                    setStructuredBrief((prev) => ({ ...prev, constraints: e.target.value }))
                  }
                  rows={2}
                  placeholder={
                    isPl ? 'Ograniczenia, po jednym w linii' : 'Constraints, one per line'
                  }
                  className="rounded-lg border border-slate-200/60 dark:border-white/[0.03] dark:border-c-border-subtle bg-c-surface px-3 py-2 text-xs resize-none"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default IdeaStartupTemplates;
