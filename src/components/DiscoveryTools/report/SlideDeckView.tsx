/**
 * SlideDeckView — realny Slide Mode dla Report/Presentation (STREAM H2,
 * 2026-08-13).
 *
 * PROBLEM ZMIERZONY przez niezależny przebieg MPQ: `ToolReportView` przyjmował
 * `presentationMode`, ale renderował jedną skróconą, przewijaną kolumnę —
 * nie było realnego trybu slajdów (Presentation: 24/30).
 *
 * KONTRAKT — ZERO OSOBNEGO STANU TREŚCI:
 *  - jedyne wejście to GOTOWY, niezmienny `ToolReportDocument` (ten sam,
 *    który konsumuje `ToolReportView`, produkt `renderToolReport`);
 *  - slajdy powstają WYŁĄCZNIE z czystej funkcji `deriveSlides` (patrz
 *    `src/toolOutputs/slides.ts`) — bez ponownego fetchu sesji, bez nowego
 *    store'u, bez kopiowania/redagowania treści;
 *  - render pojedynczego bloku to DOKŁADNIE `BlockView` z `ToolReportView` —
 *    jedna definicja "jak wygląda blok", żeby tryb slajdów i tryb dokumentu
 *    nigdy się nie rozjechały;
 *  - lokalny stan komponentu to WYŁĄCZNIE nawigacja UI (który slajd widać,
 *    czy jest fullscreen) — nigdy treść.
 *
 * DRUK: wszystkie slajdy zostają w DOM-ie (widoczność steruje `hidden` na
 * ekranie), a `print:` warianty Tailwind (skompilowane do `@media print`)
 * pokazują je WSZYSTKIE, jeden na stronę (`break-after-page`) — inaczej
 * podgląd wydruku pokazałby tylko bieżący slajd.
 *
 * KANON: wyłącznie tokeny `c-*`; fokus = `c-focus`; crimson nigdy jako
 * akcent/dane (patrz CLAUDE.md „Pułapka nr 1").
 */
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { deriveSlides } from '@/toolOutputs/slides';
import type { ToolReportDocument } from '@/toolOutputs/types';

import { BlockView } from './ToolReportView';

export interface SlideDeckViewProps {
  doc: ToolReportDocument;
  /** Jak w `ToolReportView` — ukrywa chrome (pasek tytułu/nawigacji), NIGDY nie zmienia treści. */
  presentationMode?: boolean;
  /** Wywoływane przez Esc (poza fullscreenem) i przycisk zamknięcia. */
  onExit?: () => void;
}

function supportsFullscreenApi(): boolean {
  return (
    typeof document !== 'undefined' &&
    typeof document.documentElement.requestFullscreen === 'function'
  );
}

export const SlideDeckView: React.FC<SlideDeckViewProps> = ({
  doc,
  presentationMode = false,
  onExit,
}) => {
  const { t } = useTranslation();

  // Jedyna zależność treści: `doc`. Ta sama treść (ten sam contentHash) →
  // ta sama tablica slajdów, deterministycznie (deriveSlides jest czystą funkcją).
  const slides = useMemo(() => deriveSlides(doc), [doc]);

  const [index, setIndex] = useState(0);
  // Fallback, gdy Fullscreen API jest niedostępne (np. iframe bez allow=fullscreen,
  // przeglądarka bez wsparcia) — nadal dajemy tryb "na cały ekran" przez CSS,
  // zamiast po prostu wyłączać przycisk.
  const [pseudoFullscreen, setPseudoFullscreen] = useState(false);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const fullscreenApiAvailable = useMemo(() => supportsFullscreenApi(), []);

  // Nowy dokument (inna sesja/Output) → wracamy na okładkę. Ten sam dokument
  // przerenderowany (np. zmiana motywu w rodzicu) NIE resetuje pozycji.
  useEffect(() => {
    setIndex(0);
  }, [doc.id, doc.contentHash]);

  const clampedIndex = slides.length === 0 ? 0 : Math.min(index, slides.length - 1);
  const isFullscreen = nativeFullscreen || pseudoFullscreen;

  const goTo = useCallback(
    (next: number) => {
      if (slides.length === 0) return;
      setIndex(Math.max(0, Math.min(slides.length - 1, next)));
    },
    [slides.length]
  );
  const goNext = useCallback(() => goTo(clampedIndex + 1), [goTo, clampedIndex]);
  const goPrev = useCallback(() => goTo(clampedIndex - 1), [goTo, clampedIndex]);
  const goFirst = useCallback(() => goTo(0), [goTo]);
  const goLast = useCallback(() => goTo(slides.length - 1), [goTo, slides.length]);

  const toggleFullscreen = useCallback(() => {
    if (fullscreenApiAvailable) {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      } else {
        stageRef.current?.requestFullscreen().catch(() => setPseudoFullscreen(true));
      }
      return;
    }
    // Graceful fallback: bez Fullscreen API po prostu przełączamy nakładkę CSS.
    setPseudoFullscreen((p) => !p);
  }, [fullscreenApiAvailable]);

  useEffect(() => {
    const handler = () => setNativeFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case 'PageDown':
        case ' ':
          e.preventDefault();
          goNext();
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
          e.preventDefault();
          goPrev();
          break;
        case 'Home':
          e.preventDefault();
          goFirst();
          break;
        case 'End':
          e.preventDefault();
          goLast();
          break;
        case 'Escape':
          e.preventDefault();
          if (pseudoFullscreen) {
            setPseudoFullscreen(false);
          } else if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
          } else {
            onExit?.();
          }
          break;
        case 'f':
        case 'F':
          toggleFullscreen();
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev, goFirst, goLast, onExit, pseudoFullscreen, toggleFullscreen]);

  if (slides.length === 0) return null;

  return (
    <div
      ref={stageRef}
      data-testid="slide-deck-view"
      data-slide-count={slides.length}
      data-current-slide={clampedIndex}
      data-fullscreen={isFullscreen}
      className={`flex h-full min-h-[480px] w-full flex-col bg-c-bg text-c-text print:h-auto print:min-h-0 print:[color-adjust:exact] print:[-webkit-print-color-adjust:exact] ${
        pseudoFullscreen ? 'fixed inset-0 z-[100]' : ''
      }`}
    >
      {!presentationMode && (
        <div className="flex items-center justify-between border-b border-c-border-subtle px-4 py-2 print:hidden">
          <div className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-c-text-muted">
            {doc.title}
          </div>
          <div className="flex items-center gap-2">
            <span data-testid="slide-counter" className="text-xs tabular-nums text-c-text-muted">
              {clampedIndex + 1} / {slides.length}
            </span>
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={t('toolOutputs.slides.fullscreen', 'Fullscreen (F)')}
              title={t('toolOutputs.slides.fullscreen', 'Fullscreen (F)')}
              className="rounded-lg p-1.5 text-c-text-secondary hover:bg-c-surface-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-c-focus"
            >
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
            {onExit && (
              <button
                type="button"
                onClick={onExit}
                aria-label={t('toolOutputs.slides.exit', 'Exit slide mode (Esc)')}
                title={t('toolOutputs.slides.exit', 'Exit slide mode (Esc)')}
                className="rounded-lg p-1.5 text-c-text-secondary hover:bg-c-surface-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-c-focus"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-1 items-center justify-center overflow-hidden p-6 print:block print:p-0">
        {slides.map((slide, i) => {
          const active = i === clampedIndex;
          return (
            <section
              key={slide.id}
              data-testid="slide-page"
              data-slide-id={slide.id}
              data-slide-index={i}
              aria-hidden={!active}
              className={`${active ? 'flex' : 'hidden'} aspect-video w-full max-w-[min(100%,calc((100vh-8rem)*16/9))] flex-col gap-6 overflow-hidden rounded-2xl border border-c-border-subtle bg-c-surface p-10 shadow-sm print:!flex print:aspect-auto print:h-screen print:w-full print:max-w-none print:break-after-page print:rounded-none print:border-0 print:p-12 print:shadow-none last:print:break-after-auto`}
            >
              {slide.isCover ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-c-text-muted">
                    {doc.kind === 'presentation'
                      ? t('toolOutputs.slides.deckEyebrow', 'Executive presentation')
                      : t('toolOutputs.slides.reportEyebrow', 'Report')}
                  </div>
                  <h1 className="text-3xl font-semibold leading-tight text-c-text">{slide.title}</h1>
                </div>
              ) : (
                <div className="flex h-full flex-col gap-5 overflow-auto">
                  <h2 className="text-xl font-semibold leading-snug text-c-text">{slide.title}</h2>
                  <div className="flex-1 space-y-5">
                    {slide.blocks.map((block, bi) => (
                      <BlockView key={bi} block={block} />
                    ))}
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </div>

      {!presentationMode && (
        <div className="flex items-center justify-center gap-3 border-t border-c-border-subtle px-4 py-3 print:hidden">
          <button
            type="button"
            onClick={goPrev}
            disabled={clampedIndex === 0}
            aria-label={t('toolOutputs.slides.previous', 'Previous slide')}
            className="rounded-lg p-2 text-c-text-secondary hover:bg-c-surface-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-c-focus disabled:opacity-30"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="flex items-center gap-1.5">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => goTo(i)}
                aria-label={t('toolOutputs.slides.goToSlide', 'Go to slide {{n}}', { n: i + 1 })}
                aria-current={i === clampedIndex}
                className={`h-1.5 rounded-full transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-c-focus ${
                  i === clampedIndex
                    ? 'w-5 bg-c-text-secondary'
                    : 'w-1.5 bg-c-border-strong hover:bg-c-text-muted'
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={goNext}
            disabled={clampedIndex === slides.length - 1}
            aria-label={t('toolOutputs.slides.next', 'Next slide')}
            className="rounded-lg p-2 text-c-text-secondary hover:bg-c-surface-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-c-focus disabled:opacity-30"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
};

export default SlideDeckView;
