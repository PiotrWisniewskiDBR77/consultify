/**
 * StickyStosKartyN — JEDNO rozwiązanie przyklejonych nagłówków karty N.
 *
 * SSOT: `docs/ssot/STEROWANIE_KART_N_I_AI.md` Zasada 2 (DEC-407): „przy
 * przewijaniu treści karty w dół Menu 4 (tytuł, «wstecz», status, AI, kebab)
 * i Menu 5 (Sekcje, Edycja / Podgląd, przycisk AI) pozostają PRZYKLEJONE u
 * góry (…). Przewija się tylko treść sekcji (i prawy panel niezależnie)."
 *
 * ── CO BYŁO ZEPSUTE (pomiar 2026-09-06 na `NModeShell`) ─────────────────────
 * Powłoka miała DWA niezależne bloki `sticky top-0 z-30`: segment nagłówka
 * (tylko gdy karta poda `header.sticky`, czego pięć z sześciu kart NIE robiło)
 * i pasek Menu 5 (`NMODE_TOOLBAR_SHELL_CLASS`). Dwa rodzeństwa przyklejone do
 * TEJ SAMEJ krawędzi `top-0` nie tworzą stosu — drugie wjeżdża NA pierwsze.
 * Efekt: albo Menu 4 w ogóle się nie kleiło (5 kart), albo kleiło się i było
 * zasłaniane przez Menu 5 (ToolDocumentView). W obu wypadkach użytkownik po
 * przewinięciu nie wiedział, w jakim dokumencie jest — dokładnie ten defekt,
 * który Zasada 2 nazywa.
 *
 * ── DLACZEGO JEDEN WRAPPER, A NIE `top-[Npx]` NA MENU 5 ─────────────────────
 * Wysokość Menu 4 nie jest stała (tytuł zawija się przy 1280 px, dochodzi pas
 * właściwości, pigułka statusu schodzi do drugiego wiersza). Każda wartość
 * `top-[…]` byłaby prawdziwa dla jednej szerokości okna i kłamała w pozostałych,
 * a sześć kart wpisałoby sobie sześć różnych liczb. Jeden przyklejony KONTENER
 * obejmujący oba menu jest odporny na wysokość: stos zawsze klei się w całości.
 *
 * ZAKAZ: żadna karta nie dokłada własnego `sticky` do Menu 4/5. Jedno miejsce.
 */

import React from 'react';

/**
 * Klasa przyklejonego stosu nagłówków karty (Menu 4 + Menu 5 razem).
 *
 * `z-30` — ta sama warstwa, co dawne dwa bloki, więc nic nie przeskakuje nad
 * listy rozwijane (te idą portalem na `z-context-menu`). Tło NIEPRZEZROCZYSTE
 * z rozmyciem: przez półprzezroczysty stos przebijała treść sekcji i tekst
 * nagłówka stawał się nieczytelny w trakcie przewijania.
 */
export const KARTA_STICKY_STOS_CLASS =
  'sticky top-0 z-30 bg-c-bg/95 backdrop-blur-xl';

export interface StickyStosKartyNProps {
  /** Menu 4 (nagłówek karty) + ewentualny pas właściwości. */
  children: React.ReactNode;
  className?: string;
}

export const StickyStosKartyN: React.FC<StickyStosKartyNProps> = ({ children, className = '' }) => (
  <div data-sticky-stos-karty="tak" className={`${KARTA_STICKY_STOS_CLASS} ${className}`}>
    {children}
  </div>
);

export default StickyStosKartyN;
