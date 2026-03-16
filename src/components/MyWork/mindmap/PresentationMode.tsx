/**
 * PresentationMode — Branch-by-branch presentation with zoom animation.
 * Full-screen overlay that steps through branches.
 */
import { ArrowLeft, ArrowRight, ChevronRight, ChevronUp, Clock, GitBranch, Lightbulb, Play, StickyNote, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

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
    bg: 'from-rose-500/20 to-rose-600/10',
    text: 'text-rose-700 dark:text-rose-300',
    accent: 'bg-rose-500',
  },
  goal: {
    bg: 'from-emerald-500/20 to-emerald-600/10',
    text: 'text-emerald-700 dark:text-emerald-300',
    accent: 'bg-emerald-500',
  },
  options: {
    bg: 'from-amber-500/20 to-amber-600/10',
    text: 'text-amber-700 dark:text-amber-300',
    accent: 'bg-amber-500',
  },
  evidence: {
    bg: 'from-sky-500/20 to-sky-600/10',
    text: 'text-sky-700 dark:text-sky-300',
    accent: 'bg-sky-500',
  },
  risks: {
    bg: 'from-purple-500/20 to-purple-600/10',
    text: 'text-purple-700 dark:text-purple-300',
    accent: 'bg-purple-500',
  },
  experiments: {
    bg: 'from-cyan-500/20 to-cyan-600/10',
    text: 'text-cyan-700 dark:text-cyan-300',
    accent: 'bg-cyan-500',
  },
};

const DEFAULT_COLORS = {
  bg: 'from-slate-500/20 to-slate-600/10',
  text: 'text-slate-700 dark:text-slate-300',
  accent: 'bg-slate-500',
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
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

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

  // Keyboard navigation
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
      if (e.key === 'Escape') onClose();
      if (e.key === 'f' || e.key === 'F') toggleFullscreen();
      if (e.key === 'n' || e.key === 'N') setShowNotes((p) => !p);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev, onClose, open, toggleFullscreen]);

  if (!open) return null;

  const slide = slides[currentSlide];
  const progress = ((currentSlide + 1) / slides.length) * 100;

  return (
    <div className="fixed inset-0 z-[98] bg-white dark:bg-navy-950 flex flex-col">
      {/* Progress bar */}
      <div className="h-1 bg-slate-200 dark:bg-navy-800">
        <div
          className="h-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200/40 dark:border-navy-700/40">
        <div className="flex items-center gap-2">
          <Play size={14} className="text-amber-500" />
          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
            {isPl ? 'Tryb prezentacji' : 'Presentation Mode'}
          </span>
          <span className="text-[10px] text-slate-400">
            {currentSlide + 1} / {slides.length}
          </span>
          <span className="text-[10px] text-slate-400 flex items-center gap-1 ml-2">
            <Clock size={10} />
            {formatElapsed(elapsedSeconds)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowNotes((p) => !p)}
            title={isPl ? 'Notatki prezentera (N)' : 'Presenter notes (N)'}
            className={`p-2 rounded-lg transition-colors ${
              showNotes
                ? 'text-amber-500 bg-amber-500/10'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800'
            }`}
          >
            <StickyNote size={14} />
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Slide content */}
      <div className="flex-1 flex items-center justify-center px-8 py-12">
        {slide.type === 'title' && (
          <div className="text-center max-w-2xl animate-fade-in">
            <Lightbulb size={48} className="text-amber-500 mx-auto mb-6" />
            <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-4">{ideaTitle}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {isPl
                ? `${branches.length} gałęzi · ${branches.reduce((s, b) => s + b.nodes.length, 0)} pomysłów`
                : `${branches.length} branches · ${branches.reduce((s, b) => s + b.nodes.length, 0)} ideas`}
            </p>
            <div className="flex items-center justify-center gap-3 mt-8">
              {branches.map((b) => {
                const colors = BRANCH_COLORS[b.branchKey] || DEFAULT_COLORS;
                return (
                  <div
                    key={b.branchKey}
                    className={`px-3 py-1.5 rounded-full ${colors.text} text-[10px] font-bold bg-gradient-to-r ${colors.bg}`}
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
                  <span className="text-sm text-slate-400 ml-2">({b.nodes.length})</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {b.nodes.map((node, idx) => (
                    <div
                      key={node.id}
                      className={`p-4 rounded-2xl bg-gradient-to-br ${colors.bg} border border-slate-200/30 dark:border-navy-700/30 animate-slide-up`}
                      style={{ animationDelay: `${idx * 100}ms` }}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-[10px] font-bold text-slate-400 mt-0.5">
                          {idx + 1}.
                        </span>
                        <div>
                          <div className={`text-sm font-semibold ${colors.text}`}>{node.label}</div>
                          {node.status && node.status !== 'idea' && (
                            <div className="text-[9px] text-slate-400 mt-1 capitalize">
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
                  className={`mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-bold ${colors.text} bg-gradient-to-r ${colors.bg} hover:opacity-80 transition-opacity`}
                >
                  <ChevronRight size={14} />
                  {isPl ? 'Przejdź do gałęzi na mapie' : 'Go to branch on map'}
                </button>

                {/* Presenter Notes */}
                {showNotes && b.nodes.some((n) => n.notes) && (
                  <div className="mt-6 rounded-2xl bg-slate-50 dark:bg-navy-900/60 border border-slate-200/40 dark:border-navy-700/40 overflow-hidden">
                    <button
                      onClick={() => setShowNotes((p) => !p)}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800/40 transition-colors"
                    >
                      <StickyNote size={12} />
                      {isPl ? 'Notatki prezentera' : 'Presenter Notes'}
                      <ChevronUp size={12} className="ml-auto" />
                    </button>
                    <div className="px-4 pb-3 space-y-2">
                      {b.nodes.filter((n) => n.notes).map((n) => (
                        <div key={n.id} className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                          <span className="font-semibold text-slate-600 dark:text-slate-300">{n.label}:</span>{' '}
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
      <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200/40 dark:border-navy-700/40">
        <button
          onClick={goPrev}
          disabled={currentSlide === 0}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors disabled:opacity-30"
        >
          <ArrowLeft size={14} />
          {isPl ? 'Wstecz' : 'Previous'}
        </button>

        {/* Slide dots */}
        <div className="flex items-center gap-1.5">
          {slides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentSlide(idx)}
              className={`w-2 h-2 rounded-full transition-all ${
                idx === currentSlide
                  ? 'bg-amber-500 w-4'
                  : 'bg-slate-300 dark:bg-navy-600 hover:bg-slate-400'
              }`}
            />
          ))}
        </div>

        <button
          onClick={goNext}
          disabled={currentSlide === slides.length - 1}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 transition-colors disabled:opacity-30"
        >
          {isPl ? 'Dalej' : 'Next'}
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
};

export default PresentationMode;
