/**
 * NModeMenu2 — STANDARD MENU DRUGIEGO POZIOMU kart N (ETAP 1.2 standardu n-Type)
 *
 * Kontrakt właściciela (2026-07-23, dosłownie):
 *   „Drugie menu = jasny, zaokrąglony komponent systemowy (spójny z prawym
 *    panelem), stała wysokość, symetryczne marginesy, NIE «doklejony pasek
 *    narzędzi». Trzy strefy:
 *      LEWA   — wyłącznie przycisk «Sekcje»,
 *      ŚRODEK — DOKŁADNY środek CAŁEGO paska (geometrycznie, nie środek
 *               wolnego miejsca): przełącznik «Edycja | Podgląd»,
 *      PRAWA  — opcjonalnie «How to / Baza wiedzy», a skrajnie po prawej
 *               «Analizuj z AI» w fioletowym stylu AI."
 *
 * DLACZEGO KOMPONENT, A NIE OPIS: sześć kart N budowało ten pasek sześć razy
 * ręcznie (<div> + własne przyciski) i każda inaczej — Sekcje raz po lewej, raz
 * po prawej; przełącznik trybu raz był, raz go nie było; nazwa aktywnej karty
 * dublowała lewą nawigację. Standard jest KODEM: karta DEKLARUJE treść trzech
 * slotów, komponent NARZUCA układ, wysokość i geometrię.
 *
 * ŚRODEK GEOMETRYCZNY: przełącznik jest pozycjonowany absolutnie
 * (`left-1/2 -translate-x-1/2`) względem CAŁEGO paska, więc jego oś pokrywa się
 * z osią komponentu niezależnie od szerokości strefy lewej i prawej. Wariant
 * flexowy (`ml-auto/mr-auto`) dawałby środek WOLNEGO MIEJSCA — to właśnie było
 * zgłoszone jako defekt.
 *
 * ZAKAZY (CLAUDE.md pułapka nr 1 + skill consultify-artefakty):
 *   • zero rodziny crimson w powłoce (cała skala = czerwień brandowa),
 *   • fokus wyłącznie `c-focus`,
 *   • akcent AI = wyłącznie token `c-ai` (standard n-Type §4.6) — TEN SAM
 *     token, którego używa `AIFieldEnhancer` (przycisk AI przy polu) i
 *     `Callout` (wariant `purple`). ETAP 3 (2026-07-24) naprawił rozjazd: ten
 *     przycisk używał wcześniej surowych klas `violet-*` z tailwind.config.js,
 *     a ta skala jest w tym repo przemapowana na „HBS Purple" — INNY,
 *     bardziej stonowany fiolet niż `c-ai`. Efekt: „Analizuj z AI" w Menu 2 i
 *     przycisk AI przy polu renderowały się dwoma różnymi odcieniami fioletu,
 *     konsekwentnie w całym systemie AI,
 *   • przycisk AI jest OUTLINE (tint), nie solid — solid/filled CTA rezerwuje
 *     SPEC-N §2.3 wyłącznie dla głównego slotu CTA w Menu 1.
 *
 * @see Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md §10.2/§11.2
 */

import { BookOpen, Eye, Loader2, Pencil, Sparkles } from 'lucide-react';
import React from 'react';

// ── Etykiety dwujęzyczne bez wpisów w translation.json ──────────────────────
// Wzorzec 1:1 z NModeCardState/ReadEditToggle: `t(klucz, 'English default')`
// renderowałby po polsku angielski default do czasu dopisania klucza, więc
// powłoka trzyma pary { en, pl } lokalnie.
const L = {
  sections: { en: 'Sections', pl: 'Sekcje' },
  edit: { en: 'Edit', pl: 'Edycja' },
  preview: { en: 'Preview', pl: 'Podgląd' },
  editTip: {
    en: 'Edit mode: all fields and cards editable',
    pl: 'Tryb edycji: wszystkie pola i karty edytowalne',
  },
  previewTip: {
    en: 'Preview: read-only, ready to show the client',
    pl: 'Podgląd: tylko do odczytu, gotowe do pokazania klientowi',
  },
  howTo: { en: 'How to', pl: 'How to' },
  knowledge: { en: 'Knowledge base', pl: 'Baza wiedzy' },
  analyzeAi: { en: 'Analyze with AI', pl: 'Analizuj z AI' },
  modeGroup: { en: 'Edit / preview mode', pl: 'Tryb edycji / podglądu' },
  bar: { en: 'Card menu', pl: 'Menu karty' },
} as const;

const pick = (pair: { en: string; pl: string }, isPolish: boolean) =>
  isPolish ? pair.pl : pair.en;

/** Wspólna baza przycisków paska — jedna wysokość, jeden promień, jeden fokus. */
const BTN_BASE =
  'inline-flex shrink-0 items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium transition-colors ' +
  'disabled:opacity-40 disabled:cursor-not-allowed ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus';

// ── Przycisk AI (FIOLET) ─────────────────────────────────────────────────────

export interface Menu2AIButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** true → spinner zamiast ikony iskierek */
  busy?: boolean;
  /** Nadpisanie etykiety (domyślnie „Analizuj z AI"/„Analyze with AI") */
  label?: string;
  isPolish?: boolean;
}

/**
 * „Analizuj z AI" — JEDYNY dozwolony kolor AI w powłoce: token `c-ai`.
 * Outline/tint, nie solid (SPEC-N §2.3 + reguła R1 `check-artefakt.sh`).
 * Token, nie surowa skala `violet-*` (patrz komentarz pliku) — tak samo jak
 * `AIFieldEnhancer` (przycisk AI przy polu) i `Callout` (wariant `purple`).
 */
export const Menu2AIButton: React.FC<Menu2AIButtonProps> = ({
  busy = false,
  label,
  isPolish = false,
  className = '',
  'aria-label': ariaLabel,
  title,
  ...rest
}) => {
  const resolvedLabel = label ?? pick(L.analyzeAi, isPolish);
  return (
    <button
      type="button"
      data-menu2-slot="ai"
      aria-label={ariaLabel ?? resolvedLabel}
      title={title ?? resolvedLabel}
      className={`${BTN_BASE} border border-c-ai/40 bg-c-ai/10 text-c-ai hover:bg-c-ai/15 ${className}`}
      {...rest}
    >
      {busy ? (
        <Loader2 size={13} className="animate-spin shrink-0" />
      ) : (
        <Sparkles size={13} className="shrink-0" />
      )}
      <span className="hidden truncate lg:inline">{resolvedLabel}</span>
    </button>
  );
};

// ── Przycisk How to / Baza wiedzy ───────────────────────────────────────────

export interface Menu2HowToButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** 'howTo' → „How to", 'knowledge' → „Baza wiedzy" */
  variant?: 'howTo' | 'knowledge';
  label?: string;
  isPolish?: boolean;
}

export const Menu2HowToButton: React.FC<Menu2HowToButtonProps> = ({
  variant = 'howTo',
  label,
  isPolish = false,
  className = '',
  'aria-label': ariaLabel,
  title,
  ...rest
}) => {
  const resolvedLabel = label ?? pick(variant === 'knowledge' ? L.knowledge : L.howTo, isPolish);
  return (
    <button
      type="button"
      data-menu2-slot="howto"
      aria-label={ariaLabel ?? resolvedLabel}
      title={title ?? resolvedLabel}
      className={`${BTN_BASE} border border-c-border-subtle text-c-text-secondary hover:bg-state-hover ${className}`}
      {...rest}
    >
      <BookOpen size={13} className="shrink-0" />
      <span className="hidden truncate lg:inline">{resolvedLabel}</span>
    </button>
  );
};

// ── Przełącznik Edycja | Podgląd ────────────────────────────────────────────

export interface Menu2ModeToggleProps {
  /** true = Podgląd (read-only, „do pokazania klientowi") */
  readMode: boolean;
  onChange: (readMode: boolean) => void;
  disabled?: boolean;
  isPolish?: boolean;
}

/**
 * Segmentowy przełącznik trybu. Stan aktywny NEUTRALNY (`c-surface-raised`),
 * nigdy czerwień; obwódka fokusu `c-focus`. a11y: radiogroup + Enter/Space.
 */
export const Menu2ModeToggle: React.FC<Menu2ModeToggleProps> = ({
  readMode,
  onChange,
  disabled = false,
  isPolish = false,
}) => {
  const items: Array<{
    mode: 'edit' | 'read';
    icon: React.FC<{ size?: number; className?: string }>;
    label: string;
    tip: string;
    active: boolean;
  }> = [
    {
      mode: 'edit',
      icon: Pencil,
      label: pick(L.edit, isPolish),
      tip: pick(L.editTip, isPolish),
      active: !readMode,
    },
    {
      mode: 'read',
      icon: Eye,
      label: pick(L.preview, isPolish),
      tip: pick(L.previewTip, isPolish),
      active: readMode,
    },
  ];

  return (
    <div
      role="radiogroup"
      aria-label={pick(L.modeGroup, isPolish)}
      data-menu2-slot="mode"
      className="inline-flex items-center gap-0.5 h-8 p-0.5 rounded-lg border border-c-border-subtle bg-c-surface"
    >
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <button
            key={it.mode}
            type="button"
            role="radio"
            aria-checked={it.active}
            aria-label={it.label}
            title={it.tip}
            tabIndex={it.active ? 0 : -1}
            disabled={disabled}
            onClick={() => !disabled && onChange(it.mode === 'read')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (!disabled) onChange(it.mode === 'read');
              }
            }}
            className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium transition-colors
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus
              disabled:opacity-40 disabled:cursor-not-allowed ${
                it.active
                  ? 'bg-c-surface-raised text-c-text shadow-sm'
                  : 'text-c-text-muted hover:text-c-text-secondary hover:bg-state-hover'
              }`}
          >
            <Icon size={13} className="shrink-0" />
            <span>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
};

// ── Pasek ────────────────────────────────────────────────────────────────────

export interface NModeMenu2Props {
  /**
   * LEWA STREFA — WYŁĄCZNIE przycisk „Sekcje" (picker widoczności kart).
   * Karty są predefiniowane; „+ Nowa karta" NIE należy do tego paska
   * (decyzja właściciela 2026-07-23) — widocznością steruje właśnie Sekcje.
   */
  sectionsMenu?: React.ReactNode;
  /** ŚRODEK — przełącznik Edycja | Podgląd. Pomiń `onReadModeChange`, by ukryć. */
  readMode?: boolean;
  onReadModeChange?: (readMode: boolean) => void;
  modeToggleDisabled?: boolean;
  /** PRAWA (opcjonalnie) — „How to" / „Baza wiedzy". */
  howToButton?: React.ReactNode;
  /** PRAWA, SKRAJNIE — „Analizuj z AI" (fiolet). Użyj `Menu2AIButton`. */
  aiButton?: React.ReactNode;
  /** Primary task CTA. It is the only filled/white action in this compact row. */
  primaryButton?: React.ReactNode;
  /**
   * PRAWA — wyjątek na kebab akcji drugorzędnych karty (Eksport/Archiwizuj/Usuń).
   * NIE jest częścią kontraktu trzech stref; istnieje tylko po to, żeby
   * ujednolicenie paska nie skasowało zdolności, które nie mają jeszcze
   * przydzielonego nowego domu. Renderowany PRZED przyciskiem AI, więc „AI
   * skrajnie po prawej" pozostaje spełnione.
   */
  overflowKebab?: React.ReactNode;
  isPolish?: boolean;
  className?: string;
}

/**
 * Standardowe menu 2 karty N. Jasny, zaokrąglony komponent systemowy
 * (spójny z `ArtifactRightPanel`), stała wysokość `h-12`, symetryczne `px-3`.
 */
export const NModeMenu2: React.FC<NModeMenu2Props> = ({
  sectionsMenu,
  readMode,
  onReadModeChange,
  modeToggleDisabled,
  howToButton,
  aiButton,
  primaryButton,
  overflowKebab,
  isPolish = false,
  className = '',
}) => {
  const showToggle = typeof onReadModeChange === 'function';

  return (
    <div
      data-testid="nmode-menu2"
      aria-label={pick(L.bar, isPolish)}
      className={`relative flex h-12 w-full items-center justify-between gap-2 rounded-xl border border-c-border-subtle bg-c-surface-raised px-3 ${className}`}
    >
      {/* ── LEWA: wyłącznie „Sekcje" ─────────────────────────────────────── */}
      <div data-menu2-zone="left" className="flex min-w-0 items-center">
        {sectionsMenu}
      </div>

      {/* ── ŚRODEK: geometryczna oś CAŁEGO paska, nie środek wolnego miejsca ─ */}
      {showToggle && (
        <div
          data-menu2-zone="center"
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        >
          <div className="pointer-events-auto">
            <Menu2ModeToggle
              readMode={!!readMode}
              onChange={onReadModeChange!}
              disabled={modeToggleDisabled}
              isPolish={isPolish}
            />
          </div>
        </div>
      )}

      {/* ── PRAWA: [How to] [kebab] … [Analizuj z AI] skrajnie ───────────── */}
      <div data-menu2-zone="right" className="flex min-w-0 items-center gap-1.5">
        {howToButton}
        {aiButton}
        {primaryButton}
        {overflowKebab}
      </div>
    </div>
  );
};

export default NModeMenu2;
