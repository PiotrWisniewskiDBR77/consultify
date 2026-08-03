/**
 * TriModeChooser — jawny, równorzędny wybór 3 trybów wejścia dla narzędzi-
 * dokumentów (roboty D1/D2/D3, doktryna 3 trybów, 2026-07-22).
 *
 *   ① CZYSTO      — pusty artefakt otwarty do ręcznej pracy, BEZ pipeline'u AI.
 *   ② Z AI        — dotychczasowa generacja (intake / czat → pipeline).
 *   ③ Z SZABLONU  — dotychczasowa ścieżka szablonów.
 *
 * Jeden komponent użyty w trzech widokach (DocumentStudioView · PrezentacjeView
 * · ExceleView) — moduł deklaruje tylko copy/handlery, komponent narzuca wygląd.
 *
 * KANON: wyłącznie tokeny `c-*`, fokus `c-focus`, dark+light, ZERO crimson
 * (żadnego `primary-*` / czerwieni — to semantyka krytyczna, nie CTA).
 * Gate: renderowany tylko za flagą `isTriModeEnabled()` (utils/triModeFlag).
 */

import { LayoutTemplate, PenLine, Sparkles } from 'lucide-react';
import React from 'react';

export interface TriModeChooserCopy {
  title: string;
  desc: string;
}

export interface TriModeChooserProps {
  onClean: () => void;
  onAi: () => void;
  onTemplate: () => void;
  /** Blokuje karty w trakcie tworzenia (np. gdy „czysto" właśnie się materializuje). */
  busy?: boolean;
  /** Ukryj kartę „Z szablonu" gdy dla danego narzędzia szablony są niedostępne. */
  showTemplate?: boolean;
  heading?: string;
  subheading?: string;
  clean?: Partial<TriModeChooserCopy>;
  ai?: Partial<TriModeChooserCopy>;
  template?: Partial<TriModeChooserCopy>;
  className?: string;
}

interface CardProps {
  icon: React.ElementType;
  title: string;
  desc: string;
  onClick: () => void;
  disabled?: boolean;
  testId?: string;
}

const ModeCard: React.FC<CardProps> = ({ icon: Icon, title, desc, onClick, disabled, testId }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    data-testid={testId}
    className="group flex h-full flex-col items-start gap-3 rounded-2xl border border-c-border-subtle bg-c-surface p-5 text-left transition-all hover:border-c-border hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus disabled:cursor-not-allowed disabled:opacity-50"
  >
    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-c-surface-raised text-c-text-secondary transition-colors group-hover:text-c-text">
      <Icon size={20} aria-hidden />
    </span>
    <span className="flex flex-col gap-1">
      <span className="text-sm font-semibold text-c-text">{title}</span>
      <span className="text-xs leading-relaxed text-c-text-secondary">{desc}</span>
    </span>
  </button>
);

export const TriModeChooser: React.FC<TriModeChooserProps> = ({
  onClean,
  onAi,
  onTemplate,
  busy = false,
  showTemplate = true,
  heading,
  subheading,
  clean,
  ai,
  template,
  className,
}) => {
  return (
    <div
      data-testid="tri-mode-chooser"
      className={`flex h-full min-h-0 flex-col overflow-y-auto bg-c-surface-raised px-6 py-8 ${className ?? ''}`}
    >
      <div className="mx-auto w-full max-w-3xl">
        <h2 className="text-lg font-semibold text-c-text">{heading ?? 'Jak chcesz zacząć?'}</h2>
        <p className="mt-1 text-sm text-c-text-secondary">
          {subheading ?? 'Wybierz tryb pracy — wszystkie trzy są równorzędne.'}
        </p>

        <div
          className={`mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 ${showTemplate ? 'lg:grid-cols-3' : ''}`}
        >
          <ModeCard
            icon={PenLine}
            testId="tri-mode-clean"
            title={clean?.title ?? 'Czysto'}
            desc={clean?.desc ?? 'Pusty artefakt do ręcznej pracy. Bez AI — od zera.'}
            onClick={onClean}
            disabled={busy}
          />
          <ModeCard
            icon={Sparkles}
            testId="tri-mode-ai"
            title={ai?.title ?? 'Z AI'}
            desc={ai?.desc ?? 'Opisz, czego potrzebujesz — AI zbuduje pierwszą wersję.'}
            onClick={onAi}
            disabled={busy}
          />
          {showTemplate ? (
            <ModeCard
              icon={LayoutTemplate}
              testId="tri-mode-template"
              title={template?.title ?? 'Z szablonu'}
              desc={template?.desc ?? 'Zacznij od gotowego szablonu i dostosuj treść.'}
              onClick={onTemplate}
              disabled={busy}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default TriModeChooser;
