/**
 * NModeTextField — kanoniczne POLE OPISOWE karty n-Type.
 *
 * Powód istnienia (2026-07-23, ETAP 2.x standaryzacji kart n-Type): centrum kart
 * wyglądało jak statyczny opis, a nie jak pole. Każda karta pisała `<label>` +
 * `<textarea>` po swojemu — raz z przyciskiem AI, raz bez, raz z `resize-y`, raz
 * bez, nigdzie z dopasowaniem wysokości do treści. Standard ma być KODEM, nie
 * opisem (CLAUDE.md §UI pkt 1), więc pole jest komponentem, a karta deklaruje
 * tylko treść.
 *
 * Kontrakt pola (wymagania właściciela 2026-07-23):
 *   1. NAZWA pola (label, L1 uppercase)
 *   2. przycisk AI w PRAWYM GÓRNYM rogu (slot `ai` — zwykle `AIFieldEnhancer`)
 *   3. TRYB EDYCJI (edytowalne wprost; `readOnly` = tryb Podgląd)
 *   4. AUTO-FIT wysokości — pole rośnie do treści, bez wewnętrznego scrolla
 *   5. UCHWYT ZMIANY WYSOKOŚCI — natywny `resize-y`; po ręcznym przeciągnięciu
 *      auto-fit ustępuje (użytkownik ma ostatnie słowo aż do zmiany artefaktu)
 *   6. W trybie Podgląd kontrolki (AI, uchwyt) są UKRYTE, treść tylko do odczytu
 *
 * Crimson-safe: wyłącznie tokeny `c-*`; fokus = `c-focus`. Zero rodziny
 * `primary` (w tym repo to Harvard Crimson — CLAUDE.md pułapka nr 1).
 */

import React, { useCallback, useEffect, useRef } from 'react';

export interface NModeTextFieldProps {
  /** Nazwa pola — renderowana jako etykieta L1 (uppercase, c-text-muted). */
  label: string;
  /** Wartość pola. */
  value: string;
  /** Zmiana wartości. Nie wołane w trybie Podgląd. */
  onChange: (value: string) => void;
  /** Podpowiedź w pustym polu. */
  placeholder?: string;
  /**
   * Tryb Podgląd (do pokazania klientowi): pole tylko do odczytu, slot AI i
   * uchwyt zmiany wysokości ukryte.
   */
  readOnly?: boolean;
  /** Slot kontrolki AI (prawy górny róg). Ukrywany, gdy `readOnly`. */
  ai?: React.ReactNode;
  /** Minimalna wysokość pola w px (auto-fit nigdy nie zejdzie niżej). Domyślnie 44. */
  minHeight?: number;
  /** Id pola (a11y — etykieta wskazuje na nie przez htmlFor). */
  id?: string;
  /** Dodatkowa klasa kontenera. */
  className?: string;
  /** Wołane po opuszczeniu pola (np. autozapis onBlur). */
  onBlur?: () => void;
}

export const NModeTextField: React.FC<NModeTextFieldProps> = ({
  label,
  value,
  onChange,
  placeholder,
  readOnly = false,
  ai,
  minHeight = 44,
  id,
  className,
  onBlur,
}) => {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  // Ręczne przeciągnięcie uchwytu wyłącza auto-fit dla tego pola (do czasu
  // przemontowania). Bez tej flagi auto-fit „walczyłby" z użytkownikiem przy
  // każdym wpisanym znaku, cofając jego wysokość.
  const manualRef = useRef(false);

  const fit = useCallback(() => {
    const el = ref.current;
    if (!el || manualRef.current) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(minHeight, el.scrollHeight)}px`;
  }, [minHeight]);

  useEffect(() => {
    fit();
  }, [fit, value, readOnly]);

  // Uchwyt `resize` jest w prawym dolnym rogu (~16×16 px). Kliknięcie w ten
  // narożnik = zamiar ręcznego ustawienia wysokości.
  const handlePointerDown = useCallback((e: React.MouseEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    if (e.clientX >= r.right - 18 && e.clientY >= r.bottom - 18) {
      manualRef.current = true;
    }
  }, []);

  return (
    <div className={`space-y-1.5${className ? ` ${className}` : ''}`}>
      <div className="flex items-center justify-between gap-2 min-h-[22px]">
        <label htmlFor={id} className="text-[11px] uppercase tracking-wide text-c-text-muted">
          {label}
        </label>
        {/* Slot AI — prawy górny róg pola. W Podglądzie kontrolka znika. */}
        {!readOnly && ai ? <div className="shrink-0">{ai}</div> : null}
      </div>
      <textarea
        id={id}
        ref={ref}
        value={value}
        readOnly={readOnly}
        onChange={(e) => {
          if (readOnly) return;
          onChange(e.target.value);
        }}
        onBlur={readOnly ? undefined : onBlur}
        onMouseDown={readOnly ? undefined : handlePointerDown}
        placeholder={readOnly ? undefined : placeholder}
        style={{ minHeight }}
        className={`w-full px-0 py-2 bg-transparent text-sm leading-relaxed text-c-text-secondary placeholder-c-text-muted overflow-hidden focus:outline-none transition-colors ${
          readOnly
            ? 'resize-none border-b border-transparent cursor-default'
            : 'resize-y border-b border-c-border focus:border-c-focus'
        }`}
      />
    </div>
  );
};

export default NModeTextField;
