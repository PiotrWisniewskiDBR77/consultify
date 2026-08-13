/**
 * PresentationDeck — the fullscreen slideshow shell: keyboard navigation
 * (←/→/Home/End/Esc), a slide counter, and a fullscreen toggle. Renders one
 * of the 9 `slides.tsx` components per index. Pure chrome — all content
 * comes from the `PresentationDeckModel` passed in.
 *
 * Keyboard: ArrowRight/Space → next, ArrowLeft → previous, Home/End → jump,
 * "f"/"F" → toggle fullscreen, Escape → exit fullscreen (browser default;
 * this component does not intercept Escape itself so a host page's own
 * Escape handling — e.g. a wrapping modal — still works).
 *
 * Focus ring: every interactive control uses `focus-visible:ring-c-focus`
 * (blue) — never the browser default outline, never amber (CLAUDE.md UI
 * law #2). No `primary-*`/crimson class anywhere in this file.
 */
import { ChevronLeft, ChevronRight, Maximize2, Minimize2 } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import type { PresentationDeckModel } from './buildPresentationDeck';
import {
  DimensionProfileSlide,
  GapsAndRisksSlide,
  MethodSlide,
  NextStepsSlide,
  OverallResultSlide,
  PRESENTATION_SLIDE_COUNT,
  PurposeSlide,
  StrengthsSlide,
  TitleSlide,
  UnknownsSlide,
} from './slides';

export interface PresentationDeckProps {
  readonly model: PresentationDeckModel;
  /** BCP-47 locale for date formatting on the title slide (default 'pl'). */
  readonly locale?: string;
  /** Slide index to start on, 0-based (default 0). Exposed for tests/deep-links. */
  readonly initialSlide?: number;
}

function currentFullscreenElement(): Element | null {
  if (typeof document === 'undefined') return null;
  const d = document as Document & { webkitFullscreenElement?: Element | null };
  return d.fullscreenElement ?? d.webkitFullscreenElement ?? null;
}

export const PresentationDeck: React.FC<PresentationDeckProps> = ({ model, locale = 'pl', initialSlide = 0 }) => {
  const [slide, setSlide] = useState(() => Math.min(Math.max(initialSlide, 0), PRESENTATION_SLIDE_COUNT - 1));
  const [isFullscreen, setIsFullscreen] = useState(() => currentFullscreenElement() !== null);
  const rootRef = useRef<HTMLDivElement>(null);

  const goNext = useCallback(() => setSlide((s) => Math.min(s + 1, PRESENTATION_SLIDE_COUNT - 1)), []);
  const goPrev = useCallback(() => setSlide((s) => Math.max(s - 1, 0)), []);
  const goFirst = useCallback(() => setSlide(0), []);
  const goLast = useCallback(() => setSlide(PRESENTATION_SLIDE_COUNT - 1), []);

  const toggleFullscreen = useCallback(() => {
    if (currentFullscreenElement()) {
      document.exitFullscreen?.().catch(() => {});
      return;
    }
    rootRef.current?.requestFullscreen?.().catch(() => {});
  }, []);

  useEffect(() => {
    const sync = () => setIsFullscreen(currentFullscreenElement() !== null);
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
    };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      // Don't hijack typing inside a form control that happens to live on
      // the page hosting this deck.
      if (target && /^(input|textarea|select)$/i.test(target.tagName)) return;

      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'Home') {
        e.preventDefault();
        goFirst();
      } else if (e.key === 'End') {
        e.preventDefault();
        goLast();
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goFirst, goLast, goNext, goPrev, toggleFullscreen]);

  useEffect(() => {
    rootRef.current?.focus();
  }, []);

  const renderSlide = (): React.ReactElement => {
    switch (slide) {
      case 0:
        return <TitleSlide model={model} locale={locale} />;
      case 1:
        return <PurposeSlide model={model} />;
      case 2:
        return <MethodSlide model={model} />;
      case 3:
        return <OverallResultSlide model={model} />;
      case 4:
        return <DimensionProfileSlide model={model} />;
      case 5:
        return <StrengthsSlide model={model} />;
      case 6:
        return <GapsAndRisksSlide model={model} />;
      case 7:
        return <UnknownsSlide model={model} />;
      default:
        return <NextStepsSlide model={model} />;
    }
  };

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      role="region"
      aria-roledescription="presentation"
      aria-label="Prezentacja wyniku oceny dojrzałości"
      className="flex h-full min-h-[560px] w-full flex-col bg-c-bg text-c-text outline-none"
      data-testid="presentation-deck"
    >
      <div className="h-1 flex-shrink-0 bg-c-surface-raised">
        <div
          className="h-full bg-c-text-muted transition-all duration-300"
          style={{ width: `${((slide + 1) / PRESENTATION_SLIDE_COUNT) * 100}%` }}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">{renderSlide()}</div>

      <div className="flex flex-shrink-0 items-center justify-between border-t border-c-border-subtle px-6 py-3">
        <button
          type="button"
          onClick={goPrev}
          disabled={slide === 0}
          aria-label="Poprzedni slajd"
          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-c-text-secondary outline-none transition-colors hover:bg-c-surface-raised focus-visible:ring-2 focus-visible:ring-c-focus disabled:opacity-30"
        >
          <ChevronLeft size={14} />
          Poprzedni
        </button>

        <div className="flex items-center gap-4">
          <span className="text-xs font-semibold tabular-nums text-c-text-muted" data-testid="slide-counter">
            {slide + 1} / {PRESENTATION_SLIDE_COUNT}
          </span>
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? 'Wyjdź z pełnego ekranu' : 'Pełny ekran'}
            aria-pressed={isFullscreen}
            title="Pełny ekran (F)"
            className="inline-flex items-center justify-center rounded-lg p-2 text-c-text-secondary outline-none transition-colors hover:bg-c-surface-raised focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>

        <button
          type="button"
          onClick={goNext}
          disabled={slide === PRESENTATION_SLIDE_COUNT - 1}
          aria-label="Następny slajd"
          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-c-text-secondary outline-none transition-colors hover:bg-c-surface-raised focus-visible:ring-2 focus-visible:ring-c-focus disabled:opacity-30"
        >
          Następny
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
};

export default PresentationDeck;
