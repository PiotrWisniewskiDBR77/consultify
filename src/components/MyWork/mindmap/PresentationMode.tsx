/**
 * PresentationMode — Branch-by-branch presentation with zoom animation.
 * Full-screen overlay that steps through branches.
 */
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  ChevronUp,
  Clock,
  GitBranch,
  Lightbulb,
  Play,
  StickyNote,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useDialogA11y } from '@/components/ui/primitives/useDialogA11y';

interface PresentationBranch {
  branchKey: string;
  label: string;
  nodes: Array<{ id: string; label: string; status?: string; notes?: string }>;
}

interface PresentationModeProps {
  open: boolean;
  onClose: () => void;
  ideaTitle: string;
  branches: PresentationBranch[];
  onFocusBranch: (branchKey: string) => void;
}

const BRANCH_COLORS: Record<string, { bg: string; text: string; accent: string }> = {
  problem: {
    bg: 'from-danger-500/20 to-danger-600/10',
    text: 'text-c-danger dark:text-c-danger',
    accent: 'bg-c-danger',
  },
  goal: {
    bg: ' ',
    text: 'text-c-success dark:text-c-success',
    accent: 'bg-c-success',
  },
  options: {
    bg: ' ',
    text: 'text-c-warning dark:text-c-warning',
    accent: 'bg-c-warning',
  },
  evidence: {
    bg: ' ',
    text: 'text-c-info dark:text-c-info',
    accent: 'bg-c-info',
  },
  risks: {
    bg: ' ',
    text: 'text-c-danger dark:text-c-danger',
    accent: 'bg-c-surface',
  },
  experiments: {
    bg: ' ',
    text: 'text-c-info dark:text-c-info',
    accent: 'bg-c-info',
  },
};

const DEFAULT_COLORS = {
  bg: ' ',
  text: 'text-c-text-secondary dark:text-c-text-muted',
  accent: 'bg-c-surface-raised',
};

function formatElapsed(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const PresentationMode: React.FC<PresentationModeProps> = ({
  open,
  onClose,
  ideaTitle,
  branches,
  onFocusBranch,
}) => {
  const { t } = useTranslation();

  const [currentSlide, setCurrentSlide] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showNotes, setShowNotes] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Timer: tick every second while open
  useEffect(() => {
    if (!open) {
      setElapsedSeconds(0);
      return;
    }
    timerRef.current = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [open]);

  // Slides: title + each branch
  const slides = useMemo(() => {
    const result: Array<{ type: 'title' | 'branch'; branch?: PresentationBranch }> = [
      { type: 'title' },
    ];
    for (const b of branches) {
      if (b.nodes.length > 0) {
        result.push({ type: 'branch', branch: b });
      }
    }
    return result;
  }, [branches]);

  const goNext = useCallback(() => {
    setCurrentSlide((prev) => Math.min(prev + 1, slides.length - 1));
  }, [slides.length]);

  const goPrev = useCallback(() => {
    setCurrentSlide((prev) => Math.max(prev - 1, 0));
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }, []);

  // Keyboard navigation. Escape-to-close, focus trap, and focus restore are
  // handled by useDialogA11y (below) instead of here — this handler only
  // owns the presentation-specific shortcuts.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        goNext();
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      }
      if (e.key === 'f' || e.key === 'F') toggleFullscreen();
      if (e.key === 'n' || e.key === 'N') setShowNotes((p) => !p);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev, open, toggleFullscreen]);

  const containerRef = useRef<HTMLDivElement>(null);
  useDialogA11y({ open, onClose, containerRef });

  if (!open) return null;

  // #6i: empty-state — on a map with zero nodes, Present had nothing to show
  // but a title slide with "0 branches · 0 ideas" (confusing, no honest
  // explanation). Short-circuit with a clear message + a way out instead.
  const totalNodeCount = branches.reduce((s, b) => s + b.nodes.length, 0);
  if (totalNodeCount === 0) {
    return (
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('ideas.mindmap.presentationMode', 'Presentation Mode')}
        tabIndex={-1}
        className="fixed inset-0 z-modal bg-c-surface-raised dark:bg-c-surface flex flex-col items-center justify-center gap-4 px-8 text-center outline-none"
      >
        <Lightbulb size={40} className="text-c-warning" />
        <p className="max-w-sm text-sm text-c-text-secondary dark:text-c-text-muted">
          {t(
            'ideas.mindmap.thisMapEmptyAddNodesStart',
            'This map is empty — add nodes to start a presentation.'
          )}
        </p>
        <button
          onClick={onClose}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-bold text-c-text-secondary dark:text-c-text-muted hover:bg-c-surface-raised dark:hover:bg-c-surface transition-colors"
        >
          <X size={14} />
          {t('ideas.mindmap.close', 'Close')}
        </button>
      </div>
    );
  }

  const slide = slides[currentSlide];
  const progress = ((currentSlide + 1) / slides.length) * 100;

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label={t('ideas.mindmap.presentationMode', 'Presentation Mode')}
      tabIndex={-1}
      className="fixed inset-0 z-modal bg-c-surface-raised dark:bg-c-surface flex flex-col outline-none"
    >
      {/* Progress bar */}
      <div className="h-1 bg-c-surface-raised dark:bg-c-surface">
        <div
          className="h-full bg-c-surface-raised transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-c-border-subtle dark:border-c-border-subtle">
        <div className="flex items-center gap-2">
          <Play size={14} className="text-c-warning" />
          <span className="text-[11px] font-bold text-c-text-secondary dark:text-c-text-muted">
            {t('ideas.mindmap.presentationMode', 'Presentation Mode')}
          </span>
          <span className="text-[10px] text-c-text-secondary">
            {currentSlide + 1} / {slides.length}
          </span>
          <span className="text-[10px] text-c-text-secondary flex items-center gap-1 ml-2">
            <Clock size={10} />
            {formatElapsed(elapsedSeconds)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowNotes((p) => !p)}
            title={t('ideas.mindmap.presenterNotesN', 'Presenter notes (N)')}
            className={`p-2 rounded-lg transition-colors ${
              showNotes
                ? 'text-c-warning bg-c-surface-raised'
                : 'text-c-text-secondary hover:text-c-text-secondary dark:hover:text-c-text hover:bg-c-surface-raised dark:hover:bg-c-surface'
            }`}
          >
            <StickyNote size={14} />
          </button>
          <button
            onClick={onClose}
            title={t('ideas.mindmap.exitPresentationEsc', 'Exit presentation (Esc)')}
            aria-label={t('ideas.mindmap.exitPresentationEsc', 'Exit presentation (Esc)')}
            className="p-2 rounded-lg text-c-text-secondary hover:text-c-text-secondary dark:hover:text-c-text hover:bg-c-surface-raised dark:hover:bg-c-surface transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Slide content */}
      <div className="flex-1 flex items-center justify-center px-8 py-12">
        {slide.type === 'title' && (
          <div className="text-center max-w-2xl animate-fade-in">
            <Lightbulb size={48} className="text-c-warning mx-auto mb-6" />
            <h1 className="text-3xl font-bold text-c-text dark:text-c-text mb-4">{ideaTitle}</h1>
            <p className="text-sm text-c-text-secondary dark:text-c-text-muted">
              {t(
                'myWorkMindmap.presentation.branchesIdeas',
                '{{branches}} branches · {{ideas}} ideas',
                {
                  branches: branches.length,
                  ideas: branches.reduce((s, b) => s + b.nodes.length, 0),
                }
              )}
            </p>
            <div className="flex items-center justify-center gap-3 mt-8">
              {branches.map((b) => {
                const colors = BRANCH_COLORS[b.branchKey] || DEFAULT_COLORS;
                return (
                  <div
                    key={b.branchKey}
                    className={`px-3 py-1.5 rounded-full ${colors.text} text-[10px] font-bold bg-c-surface-raised ${colors.bg}`}
                  >
                    {b.label} ({b.nodes.length})
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {slide.type === 'branch' &&
          slide.branch &&
          (() => {
            const b = slide.branch;
            const colors = BRANCH_COLORS[b.branchKey] || DEFAULT_COLORS;
            return (
              <div className="w-full max-w-3xl animate-fade-in">
                <div className="flex items-center gap-3 mb-8">
                  <div className={`w-3 h-3 rounded-full ${colors.accent}`} />
                  <GitBranch size={20} className={colors.text} />
                  <h2 className={`text-2xl font-bold ${colors.text}`}>{b.label}</h2>
                  <span className="text-sm text-c-text-secondary ml-2">({b.nodes.length})</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {b.nodes.map((node, idx) => (
                    <div
                      key={node.id}
                      className={`p-4 rounded-2xl bg-c-surface-raised ${colors.bg} border border-c-border-subtle dark:border-c-border-subtle animate-slide-up`}
                      style={{ animationDelay: `${idx * 100}ms` }}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-[10px] font-bold text-c-text-secondary mt-0.5">
                          {idx + 1}.
                        </span>
                        <div>
                          <div className={`text-sm font-semibold ${colors.text}`}>{node.label}</div>
                          {node.status && node.status !== 'idea' && (
                            <div className="text-[9px] text-c-text-secondary mt-1 capitalize">
                              {node.status.replace(/_/g, ' ')}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => onFocusBranch(b.branchKey)}
                  className={`mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-bold ${colors.text} bg-c-surface-raised ${colors.bg} hover:opacity-80 transition-opacity`}
                >
                  <ChevronRight size={14} />
                  {t('ideas.mindmap.goBranchMap', 'Go to branch on map')}
                </button>

                {/* Presenter Notes */}
                {showNotes && b.nodes.some((n) => n.notes) && (
                  <div className="mt-6 rounded-2xl bg-c-surface-raised dark:bg-c-surface border border-c-border-subtle dark:border-c-border-subtle overflow-hidden">
                    <button
                      onClick={() => setShowNotes((p) => !p)}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-[11px] font-bold text-c-text-secondary dark:text-c-text-muted hover:bg-c-surface-raised dark:hover:bg-c-surface transition-colors"
                    >
                      <StickyNote size={12} />
                      {t('ideas.mindmap.presenterNotes', 'Presenter Notes')}
                      <ChevronUp size={12} className="ml-auto" />
                    </button>
                    <div className="px-4 pb-3 space-y-2">
                      {b.nodes
                        .filter((n) => n.notes)
                        .map((n) => (
                          <div
                            key={n.id}
                            className="text-[11px] text-c-text-secondary dark:text-c-text-muted leading-relaxed"
                          >
                            <span className="font-semibold text-c-text-secondary dark:text-c-text-muted">
                              {n.label}:
                            </span>{' '}
                            {n.notes}
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-c-border-subtle dark:border-c-border-subtle">
        <button
          onClick={goPrev}
          disabled={currentSlide === 0}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-bold text-c-text-secondary dark:text-c-text-muted hover:bg-c-surface-raised dark:hover:bg-c-surface transition-colors disabled:opacity-30"
        >
          <ArrowLeft size={14} />
          {t('ideas.mindmap.previous', 'Previous')}
        </button>

        {/* Slide dots */}
        <div className="flex items-center gap-1.5">
          {slides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentSlide(idx)}
              className={`w-2 h-2 rounded-full transition-all ${
                idx === currentSlide
                  ? 'bg-c-warning w-4'
                  : 'bg-c-surface-raised dark:bg-c-surface-raised hover:bg-c-surface-raised'
              }`}
            />
          ))}
        </div>

        <button
          onClick={goNext}
          disabled={currentSlide === slides.length - 1}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-bold text-c-warning dark:text-c-warning bg-c-surface-raised hover:bg-c-surface-raised transition-colors disabled:opacity-30"
        >
          {t('ideas.mindmap.next', 'Next')}
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
};

export default PresentationMode;
