/**
 * PresentMode — Fullscreen presentation view with card-by-card navigation,
 * animations, and presenter mode support.
 */

import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import type { CuratedColorSet, DeckCard } from '../wizard/types';
import { CURATED_COLOR_SETS } from '../wizard/types';
import { CardRenderer } from './CardRenderer';

interface PresentModeProps {
  cards: DeckCard[];
  colorSetId?: string;
  title: string;
  onExit: () => void;
  presenterView?: boolean;
  initialIndex?: number;
}

export const PresentMode: React.FC<PresentModeProps> = ({
  cards,
  colorSetId,
  title,
  onExit,
  presenterView = false,
  initialIndex = 0,
}) => {
  const [currentIndex, setCurrentIndex] = useState(() =>
    Math.min(Math.max(0, initialIndex), Math.max(0, cards.length - 1))
  );
  const [isAnimating, setIsAnimating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const theme = CURATED_COLOR_SETS.find((c) => c.id === colorSetId) || CURATED_COLOR_SETS[1];

  const goNext = useCallback(() => {
    if (currentIndex < cards.length - 1 && !isAnimating) {
      setIsAnimating(true);
      setCurrentIndex((prev) => prev + 1);
      setTimeout(() => setIsAnimating(false), 400);
    }
  }, [currentIndex, cards.length, isAnimating]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0 && !isAnimating) {
      setIsAnimating(true);
      setCurrentIndex((prev) => prev - 1);
      setTimeout(() => setIsAnimating(false), 400);
    }
  }, [currentIndex, isAnimating]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case ' ':
          e.preventDefault();
          goNext();
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          goPrev();
          break;
        case 'Escape':
          onExit();
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goNext, goPrev, onExit]);

  const currentCard = cards[currentIndex];
  const nextCard = cards[currentIndex + 1];

  if (presenterView) {
    return (
      <div className="fixed inset-0 z-modal bg-c-bg flex" data-testid="presenter-view">
        {/* Main slide */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-4xl">
            <CardRenderer card={currentCard} colorSetId={colorSetId} />
          </div>
        </div>

        {/* Side panel: notes + next slide + timer */}
        <div className="w-80 bg-c-surface flex flex-col border-l border-c-border-subtle">
          {/* Timer */}
          <div className="px-4 py-3 border-b border-c-border-subtle">
            <div className="flex items-center justify-between text-c-text">
              <span className="text-xs opacity-60">
                {currentIndex + 1} / {cards.length}
              </span>
              <PresenterTimer />
            </div>
          </div>

          {/* Next slide preview */}
          {nextCard && (
            <div className="p-4 border-b border-c-border-subtle">
              <p className="text-[10px] text-c-text-secondary uppercase mb-2">Next slide</p>
              <div className="pointer-events-none opacity-80">
                <CardRenderer card={nextCard} colorSetId={colorSetId} scale={0.3} />
              </div>
            </div>
          )}

          {/* Speaker notes */}
          <div className="flex-1 p-4 overflow-y-auto">
            <p className="text-[10px] text-c-text-secondary uppercase mb-2">Speaker Notes</p>
            <p className="text-sm text-c-text-secondary whitespace-pre-wrap">
              {currentCard.speaker_notes || 'No notes for this slide.'}
            </p>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between p-3 border-t border-c-border-subtle">
            <button
              onClick={goPrev}
              disabled={currentIndex === 0}
              className="p-2 rounded-lg text-c-text hover:bg-c-surface-raised disabled:opacity-30"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={onExit}
              className="p-2 rounded-lg text-c-text-secondary hover:bg-c-surface-raised hover:text-c-text"
            >
              <X size={20} />
            </button>
            <button
              onClick={goNext}
              disabled={currentIndex === cards.length - 1}
              className="p-2 rounded-lg text-c-text hover:bg-c-surface-raised disabled:opacity-30"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-modal bg-black flex flex-col items-center justify-center"
      onClick={goNext}
      data-testid="audience-present-view"
    >
      {/* Progress bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-c-surface">
        <div
          className="h-full bg-c-surface transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / cards.length) * 100}%` }}
        />
      </div>

      {/* Card with animation */}
      <div
        className="w-full max-w-5xl px-8 transition-all duration-400 ease-out"
        style={{
          opacity: isAnimating ? 0.7 : 1,
          transform: isAnimating ? 'translateY(10px)' : 'translateY(0)',
        }}
      >
        <CardRenderer card={currentCard} colorSetId={colorSetId} />
      </div>

      {/* Navigation controls (subtle) */}
      <div className="absolute bottom-6 flex items-center gap-4">
        <button
          onClick={(e) => {
            e.stopPropagation();
            goPrev();
          }}
          disabled={currentIndex === 0}
          className="p-2 rounded-full bg-c-surface text-c-text hover:bg-c-surface disabled:opacity-30 backdrop-blur-sm"
        >
          <ChevronLeft size={20} />
        </button>
        <span className="text-sm text-c-text font-mono">
          {currentIndex + 1} / {cards.length}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
          disabled={currentIndex === cards.length - 1}
          className="p-2 rounded-full bg-c-surface text-c-text hover:bg-c-surface disabled:opacity-30 backdrop-blur-sm"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Exit button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onExit();
        }}
        className="absolute top-4 right-4 p-2 rounded-full bg-c-surface text-c-text hover:bg-c-surface backdrop-blur-sm"
      >
        <X size={20} />
      </button>
    </div>
  );
};

const PresenterTimer: React.FC = () => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setElapsed((p) => p + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  return (
    <span className="text-lg font-mono text-c-text">
      {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
    </span>
  );
};
