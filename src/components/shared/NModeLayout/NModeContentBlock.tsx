/**
 * NModeContentBlock — wspólna POWŁOKA BLOKU TREŚCI w centrum karty N.
 *
 * Zgłoszenie właściciela (2026-07-23, ETAP 2.2/2.5): bloki w centrum kart są
 * „statycznymi kartami" — nie da się ich dopasować do treści ani schować
 * kontrolek przy pokazywaniu klientowi. Blok ma mieć w trybie EDYCJA cztery
 * afordancje, a w PODGLĄDZIE ma być czysty:
 *
 *   1. ✨ AI            — akcja AI dla tego bloku (opcjonalna, `onAI`)
 *   2. ✎ edycja         — bezpośrednia edycja treści (opcjonalna, `onEdit`)
 *   3. ⤢ auto-dopasuj   — zdejmuje ręczną wysokość, blok wraca do wysokości treści
 *   4. uchwyt wysokości — ręczne przeciąganie dolnej krawędzi
 *
 * ZASADA „standard jest KODEM": karta DEKLARUJE (id bloku, tytuł, akcje),
 * komponent NARZUCA wygląd i zachowanie. Zero bespoke uchwytów per ekran.
 *
 * ── Co jest, a czego NIE ma (uczciwie) ────────────────────────────────────
 * • Wysokość bloku to PREFERENCJA WIDOKU, więc trzymamy ją lokalnie
 *   (localStorage, klucz `consultify:nmode:blockH:<scope>:<blockId>`). Nie
 *   udaje danych — nic nie leci na serwer i nic nie jest współdzielone.
 * • `onAI` / `onEdit` są OPCJONALNE i renderowane tylko wtedy, gdy karta je
 *   poda. Gdy karta nie ma dokąd zapisać treści (np. biblioteka narzędzi jest
 *   read-only po stronie API), NIE podaje handlera i przycisk się nie pojawia —
 *   zamiast martwej kontrolki, której kliknięcie niczego nie zmienia.
 *   Alternatywnie karta może podać `aiDisabledReason` / `editDisabledReason`,
 *   żeby pokazać przycisk WYŁĄCZONY z jawnym powodem w tooltipie.
 *
 * Tokeny: wyłącznie `c-*` (+ teal dla akcentu AI, zgodnie z wzorcem N).
 * Zero tokenów crimsonowych w powłoce bloku (patrz scripts/check-artefakt.sh).
 */

import { Loader2, Maximize2, Pencil, Sparkles } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

export interface NModeContentBlockProps {
  /** Stabilny identyfikator bloku (id sekcji/karty). Część klucza wysokości. */
  blockId: string;
  /** Przestrzeń nazw wysokości — np. `tool:dynamic-swot`, `insight:<id>`. */
  scope: string;
  /** Tytuł nagłówka bloku. Gdy pominięty, pasek nagłówka pokazuje same kontrolki. */
  title?: string;
  /** Tryb PODGLĄD (do pokazania klientowi) — wszystkie kontrolki ukryte. */
  readMode?: boolean;
  isPolish?: boolean;
  /** Minimalna wysokość przy ręcznym przeciąganiu (px). */
  minHeight?: number;
  /** Akcja AI dla bloku. Brak → przycisk nierenderowany. */
  onAI?: () => void;
  aiLoading?: boolean;
  /** Gdy podane — przycisk AI renderowany, ale WYŁĄCZONY, z powodem w tooltipie. */
  aiDisabledReason?: string;
  /** Bezpośrednia edycja treści bloku. Brak → przycisk nierenderowany. */
  onEdit?: () => void;
  /** Gdy podane — przycisk edycji renderowany, ale WYŁĄCZONY, z powodem. */
  editDisabledReason?: string;
  /**
   * `framed` (domyślne) — blok rysuje własną ramkę karty.
   * `plain` — bez ramki i tła; dla powłok, które same rysują kafelek wokół
   * sekcji (np. NModeCBoard w trybie C), żeby nie było ramki w ramce.
   */
  variant?: 'framed' | 'plain';
  children: React.ReactNode;
  className?: string;
}

const MIN_HEIGHT_DEFAULT = 140;

const L = {
  ai: { en: 'AI for this block', pl: 'AI dla tego bloku' },
  edit: { en: 'Edit this block', pl: 'Edytuj ten blok' },
  autofit: { en: 'Auto-fit height', pl: 'Auto-dopasuj wysokość' },
  resize: { en: 'Drag to change height', pl: 'Przeciągnij, aby zmienić wysokość' },
};

function heightKey(scope: string, blockId: string): string {
  return `consultify:nmode:blockH:${scope}:${blockId}`;
}

function readStoredHeight(scope: string, blockId: string): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(heightKey(scope, blockId));
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

function writeStoredHeight(scope: string, blockId: string, height: number | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (height === null) window.localStorage.removeItem(heightKey(scope, blockId));
    else window.localStorage.setItem(heightKey(scope, blockId), String(Math.round(height)));
  } catch {
    /* localStorage niedostępny — wysokość zostaje w pamięci sesji */
  }
}

const CTRL_BTN =
  'inline-flex items-center justify-center h-6 w-6 rounded-md text-c-text-muted ' +
  'hover:bg-c-surface-raised hover:text-c-text transition-colors ' +
  'disabled:opacity-40 disabled:cursor-not-allowed ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]';

const CTRL_BTN_AI =
  'inline-flex items-center justify-center h-6 w-6 rounded-md text-teal-600 dark:text-teal-400 ' +
  'hover:bg-teal-500/10 transition-colors ' +
  'disabled:opacity-40 disabled:cursor-not-allowed ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]';

export const NModeContentBlock: React.FC<NModeContentBlockProps> = ({
  blockId,
  scope,
  title,
  readMode = false,
  isPolish = false,
  minHeight = MIN_HEIGHT_DEFAULT,
  onAI,
  aiLoading = false,
  aiDisabledReason,
  onEdit,
  editDisabledReason,
  variant = 'framed',
  children,
  className = '',
}) => {
  const [height, setHeight] = useState<number | null>(() => readStoredHeight(scope, blockId));
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);

  // Zmiana bloku/przestrzeni → wczytaj zapamiętaną wysokość tego bloku.
  useEffect(() => {
    setHeight(readStoredHeight(scope, blockId));
  }, [scope, blockId]);

  const lbl = (k: keyof typeof L) => (isPolish ? L[k].pl : L[k].en);

  const autoFit = useCallback(() => {
    setHeight(null);
    writeStoredHeight(scope, blockId, null);
  }, [scope, blockId]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const current = bodyRef.current?.getBoundingClientRect().height ?? minHeight;
      dragRef.current = { startY: e.clientY, startH: current };
      (e.currentTarget as HTMLDivElement).setPointerCapture?.(e.pointerId);
      e.preventDefault();
    },
    [minHeight]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      const next = Math.max(minHeight, drag.startH + (e.clientY - drag.startY));
      setHeight(next);
    },
    [minHeight]
  );

  const endDrag = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragRef.current) return;
      dragRef.current = null;
      (e.currentTarget as HTMLDivElement).releasePointerCapture?.(e.pointerId);
      setHeight((h) => {
        writeStoredHeight(scope, blockId, h);
        return h;
      });
    },
    [scope, blockId]
  );

  // Klawiatura na uchwycie: ↑/↓ zmienia wysokość co 24px, Home = auto-dopasuj.
  const onHandleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const base = height ?? bodyRef.current?.getBoundingClientRect().height ?? minHeight;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const next = Math.max(minHeight, base + (e.key === 'ArrowDown' ? 24 : -24));
        setHeight(next);
        writeStoredHeight(scope, blockId, next);
      } else if (e.key === 'Home') {
        e.preventDefault();
        autoFit();
      }
    },
    [height, minHeight, scope, blockId, autoFit]
  );

  const showControls = !readMode;
  const showAI = showControls && (!!onAI || !!aiDisabledReason);
  const showEdit = showControls && (!!onEdit || !!editDisabledReason);
  const hasHeader = !!title || showControls;
  const framed = variant === 'framed';
  const frameClass = framed ? 'rounded-2xl border border-c-border-subtle bg-c-surface' : '';
  const padX = framed ? 'px-4' : 'px-0';

  return (
    <section className={`relative ${frameClass} ${className}`} data-block-id={blockId}>
      {hasHeader && (
        <div className={`flex items-center gap-2 ${padX} ${framed ? 'pt-3' : 'pt-0'}`}>
          {title ? (
            <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-c-text">{title}</h3>
          ) : (
            <div className="min-w-0 flex-1" />
          )}
          {showControls && (
            <div className="flex shrink-0 items-center gap-0.5">
              {showAI && (
                <button
                  type="button"
                  onClick={onAI}
                  disabled={!onAI || aiLoading}
                  title={aiDisabledReason || lbl('ai')}
                  aria-label={aiDisabledReason || lbl('ai')}
                  className={CTRL_BTN_AI}
                >
                  {aiLoading ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Sparkles size={13} />
                  )}
                </button>
              )}
              {showEdit && (
                <button
                  type="button"
                  onClick={onEdit}
                  disabled={!onEdit}
                  title={editDisabledReason || lbl('edit')}
                  aria-label={editDisabledReason || lbl('edit')}
                  className={CTRL_BTN}
                >
                  <Pencil size={13} />
                </button>
              )}
              <button
                type="button"
                onClick={autoFit}
                disabled={height === null}
                title={lbl('autofit')}
                aria-label={lbl('autofit')}
                className={CTRL_BTN}
              >
                <Maximize2 size={13} />
              </button>
            </div>
          )}
        </div>
      )}

      <div
        ref={bodyRef}
        className={`${padX} ${framed ? 'pb-4' : 'pb-4'} ${
          hasHeader ? 'pt-3' : framed ? 'pt-4' : 'pt-0'
        } ${height === null ? '' : 'overflow-y-auto'}`}
        style={height === null ? undefined : { height }}
      >
        {children}
      </div>

      {showControls && (
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label={lbl('resize')}
          title={lbl('resize')}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={onHandleKeyDown}
          className={`group absolute inset-x-0 bottom-0 flex h-3 cursor-ns-resize items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)] ${
            framed ? 'rounded-b-2xl' : 'rounded-md'
          }`}
        >
          <span className="h-0.5 w-8 rounded-full bg-c-border transition-colors group-hover:bg-c-border-strong" />
        </div>
      )}
    </section>
  );
};

export default NModeContentBlock;
