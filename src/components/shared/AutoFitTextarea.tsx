/**
 * AutoFitTextarea — standardowe opisowe pole tekstowe karty N.
 *
 * SSOT: Harvard/wdrozenie-100/_STANDARD_N_TYPE_2026-07-23/00_STANDARD_N_TYPE.md
 * §6.2 (standard pola tekstowego), §6.3 (automatyczna wysokość i ręczna zmiana),
 * §4.4 (tryb Edycja / Podgląd).
 *
 * Zachowanie wymagane przez standard — wszystkie cztery punkty naraz, bo dopiero
 * razem dają obiecane „pole zachowuje się jak dokument, nie jak okienko":
 *
 *  1. AUTO-FIT — wysokość idzie za treścią w obie strony (rośnie i kurczy się),
 *     cała treść widoczna BEZ wewnętrznego scrolla.
 *  2. RĘCZNE PRZECIĄGNIĘCIE UCHWYTU wyłącza automatyczne KURCZENIE i zapamiętuje
 *     ustawioną wysokość (użytkownik świadomie zarezerwował miejsce).
 *  3. Mimo trybu ręcznego pole NADAL ROŚNIE, gdy treść przestaje się mieścić —
 *     zamrożona wysokość nie może chować tekstu.
 *  4. POWRÓT DO AUTO-FIT jest dostępny (przycisk pod polem, widoczny wyłącznie
 *     wtedy, gdy jest z czego wracać).
 *
 * Tryb Podgląd (§4.4): uchwyt ukryty (`resize-none`), pole nieedytowalne, klasy
 * edycyjne (ramki/fokus) nie są nakładane, a wysokość ZAWSZE liczy się z treści —
 * ręczne przycięcie nie może uciąć tekstu pokazywanego klientowi.
 *
 * Wykrywanie „ręcznego przeciągnięcia" bez nasłuchu myszy: `ResizeObserver`
 * porównuje zmierzoną wysokość z tą, którą komponent sam ostatnio ustawił.
 * Różnica przy NIEZMIENIONEJ szerokości = uchwyt (zmiana szerokości to zwykły
 * relayout kolumny i musi przeliczać auto-fit, a nie udawać gestu użytkownika).
 *
 * Zasady wyglądu: wyłącznie klasy podane przez wołającego + tokeny `c-*`;
 * komponent NIE wnosi własnej kolorystyki (zero crimson/primary-*).
 */
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/** Tolerancja porównań wysokości w px (subpiksele/zaokrąglenia przeglądarki). */
const EPSILON_PX = 1;

export interface AutoFitTextareaProps extends Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  'style' | 'rows' | 'value' | 'onChange'
> {
  value: string;
  onValueChange?: (value: string) => void;
  /** Dolna granica auto-fitu w wierszach (pole nie skurczy się poniżej). Default 3. */
  minRows?: number;
  /** Tryb Podgląd (§4.4) — bez uchwytu, bez ramek edycyjnych, tylko odczyt. */
  previewMode?: boolean;
  /** Etykieta pola (lewa strona nagłówka pola). */
  label?: React.ReactNode;
  /** Slot na przycisk AI — PRAWY GÓRNY RÓG pola (§6.2). */
  aiSlot?: React.ReactNode;
  /** Etykieta przycisku powrotu do auto-fitu (§6.3). */
  autoFitLabel?: string;
  /** Klasy samego `textarea` — nakładane ZAWSZE. */
  className?: string;
  /** Klasy `textarea` nakładane WYŁĄCZNIE w trybie Edycja (ramki, fokus). */
  editClassName?: string;
  /** Klasy kontenera pola (etykieta + AI + textarea + powrót do auto-fitu). */
  containerClassName?: string;
  /**
   * Dodatkowy ref na `textarea` — dla wołających, którzy muszą ustawić fokus
   * z zewnątrz (np. „✎ Edytuj" w pasku karty). Komponent NIE oddaje swojego
   * wewnętrznego refa (auto-fit go potrzebuje), tylko synchronizuje ten podany.
   */
  textareaRef?: React.MutableRefObject<HTMLTextAreaElement | null>;
}

export const AutoFitTextarea: React.FC<AutoFitTextareaProps> = ({
  value,
  onValueChange,
  minRows = 3,
  previewMode = false,
  label,
  aiSlot,
  autoFitLabel,
  className = '',
  editClassName = '',
  containerClassName = '',
  readOnly,
  textareaRef,
  ...rest
}) => {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const attachRef = useCallback(
    (node: HTMLTextAreaElement | null) => {
      ref.current = node;
      if (textareaRef) textareaRef.current = node;
    },
    [textareaRef]
  );
  /** Wysokość, którą komponent sam ostatnio nadał (odróżnia własne od cudzych zmian). */
  const appliedHeightRef = useRef<number | null>(null);
  /** Wysokość zamrożona uchwytem; `null` = tryb auto-fit. */
  const manualHeightRef = useRef<number | null>(null);
  const lastWidthRef = useRef(0);
  /** Tylko po to, by pokazać/ukryć powrót do auto-fitu i przeliczyć po reset-cie. */
  const [manual, setManual] = useState(false);

  /** Wysokość treści (bez wewnętrznego scrolla), nie mniejsza niż `minRows`. */
  const measureContentHeight = useCallback((): number => {
    const el = ref.current;
    if (!el) return 0;
    const cs = window.getComputedStyle(el);
    const border = (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0);
    const padding = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    let lineHeight = parseFloat(cs.lineHeight);
    if (!Number.isFinite(lineHeight)) {
      lineHeight = (parseFloat(cs.fontSize) || 16) * 1.5;
    }
    const floor = lineHeight * minRows + padding + border;

    const previous = el.style.height;
    el.style.height = 'auto';
    const needed = el.scrollHeight + border;
    el.style.height = previous;
    return Math.max(needed, floor);
  }, [minRows]);

  const applyHeight = useCallback((height: number) => {
    const el = ref.current;
    if (!el) return;
    appliedHeightRef.current = height;
    el.style.height = `${height}px`;
  }, []);

  // Auto-fit / wzrost w trybie ręcznym. `manual` w zależnościach po to, by
  // powrót do auto-fitu przeliczył wysokość natychmiast.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const needed = measureContentHeight();
    // Podgląd IGNORUJE zamrożoną wysokość — treść nie może być ucięta (§4.4).
    const pinned = previewMode ? null : manualHeightRef.current;
    if (pinned === null) {
      applyHeight(needed);
      return;
    }
    if (needed > pinned) {
      // §6.3 punkt 3: tryb ręczny blokuje KURCZENIE, nie wzrost.
      manualHeightRef.current = needed;
      applyHeight(needed);
      return;
    }
    applyHeight(pinned);
  }, [value, previewMode, manual, measureContentHeight, applyHeight]);

  // Wykrycie przeciągnięcia uchwytu (i przeliczenie po zmianie szerokości).
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    lastWidthRef.current = el.offsetWidth;

    const observer = new ResizeObserver(() => {
      const node = ref.current;
      if (!node) return;
      const width = node.offsetWidth;
      const height = node.offsetHeight;

      if (Math.abs(width - lastWidthRef.current) > EPSILON_PX) {
        lastWidthRef.current = width;
        // Relayout kolumny, nie gest — w auto-ficie przelicz, w trybie ręcznym
        // tylko zsynchronizuj punkt odniesienia.
        if (manualHeightRef.current === null) applyHeight(measureContentHeight());
        else appliedHeightRef.current = height;
        return;
      }

      // Wysokość, którą sami nadaliśmy — nic się nie stało.
      if (
        appliedHeightRef.current !== null &&
        Math.abs(height - appliedHeightRef.current) <= EPSILON_PX
      ) {
        return;
      }

      // Zmiana wysokości spoza komponentu przy tej samej szerokości = uchwyt.
      manualHeightRef.current = height;
      appliedHeightRef.current = height;
      setManual(true);
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [applyHeight, measureContentHeight]);

  const resetAutoFit = useCallback(() => {
    manualHeightRef.current = null;
    setManual(false);
  }, []);

  const resizeClass = previewMode ? 'resize-none' : 'resize-y';
  const showAutoFitReset = manual && !previewMode;
  // Podgląd: uchwyt ukryty, AI wyłączone/ukryte, brak ramek edycyjnych (§4.4).
  const showAi = Boolean(aiSlot) && !previewMode;

  return (
    <div className={`relative ${containerClassName}`}>
      {label || showAi ? (
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="min-w-0">{label}</div>
          {showAi ? <div className="shrink-0 -mt-1">{aiSlot}</div> : null}
        </div>
      ) : null}

      <textarea
        {...rest}
        ref={attachRef}
        value={value}
        readOnly={previewMode || readOnly}
        onChange={(e) => {
          if (previewMode || readOnly) return;
          onValueChange?.(e.target.value);
        }}
        className={`${className} ${previewMode ? '' : editClassName} ${resizeClass} overflow-hidden`}
      />

      {showAutoFitReset ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={resetAutoFit}
            className="inline-flex items-center gap-1 text-[11px] text-c-text-muted hover:text-c-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)] rounded"
          >
            {autoFitLabel || 'Auto-fit'}
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default AutoFitTextarea;
