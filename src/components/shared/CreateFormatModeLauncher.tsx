/**
 * CreateFormatModeLauncher — wspólna DWUSTOPNIOWA tablica „Dodaj" dla Materiałów
 * (Menu 2) i Biblioteki szablonów (Harvard/wdrozenie-100/_MATERIALY_INWENTARYZACJA_2026-07-24.md §8).
 *
 *   KROK 1 — format (Dokument / Prezentacja / Arkusz Excel — lub „typ szablonu"
 *            w wywołaniu z Biblioteki szablonów).
 *   KROK 2 — tryb (Czysto / Z AI / Z szablonu — równorzędne, jak TriModeChooser).
 *
 * Powłoka wizualna 1:1 z `UnifiedCreateLauncher` (overlay + karta + siatka
 * kafli KROK 1); kafle KROK 2 stylowane jak `TriModeChooser`'s ModeCard.
 * Moduł-wywołujący deklaruje TYLKO treść (tiles/copy/handler) — komponent
 * narzuca wygląd, zero własnych tabel/kolorów per caller.
 *
 * KANON: wyłącznie tokeny `c-*`, fokus `c-focus`, dark+light, ZERO crimson
 * (żadnego `primary-*` / czerwieni — to semantyka krytyczna, nie CTA).
 *
 * Ten komponent tylko WYBIERA (format, tryb) i oddaje decyzję wywołującemu
 * przez `onSelect` — routing/nawigacja do realnego edytora żyje w callerze
 * (np. ReportsAndPresentationsHub), żeby ten plik pozostał reużywalny.
 */
import type { LucideIcon } from 'lucide-react';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import {
  getMaterialVisualIdentity,
  type MaterialKind,
} from './materialsVisualIdentity';

function resolveFormatIcon(id: string, fallback: LucideIcon): LucideIcon {
  if (id === 'document' || id === 'presentation' || id === 'spreadsheet') {
    return getMaterialVisualIdentity(id as MaterialKind).icon;
  }
  return fallback;
}

export interface FormatTileConfig<F extends string> {
  id: F;
  icon: LucideIcon;
  title: string;
  hint?: string;
}

export interface ModeTileConfig<M extends string> {
  id: M;
  icon: LucideIcon;
  title: string;
  desc: string;
  testId?: string;
}

export interface CreateFormatModeLauncherProps<F extends string, M extends string> {
  isOpen: boolean;
  onClose: () => void;
  /** KROK 1 title (e.g. "Nowy materiał"). */
  title: string;
  /** KROK 1 subtitle, under the title. */
  stepOneHint?: string;
  /** KROK 2 title — receives the picked format. */
  stepTwoTitle?: (format: F) => string;
  /** KROK 2 subtitle — receives the picked format. */
  stepTwoHint?: (format: F) => string;
  formatTiles: FormatTileConfig<F>[];
  /** Mode tiles for KROK 2 — static array, or a function of the picked format. */
  modeTiles: ModeTileConfig<M>[] | ((format: F) => ModeTileConfig<M>[]);
  /** Fired once a (format, mode) pair is picked. Caller is responsible for navigation + closing. */
  onSelect: (format: F, mode: M) => void;
  /**
   * When set, KROK 1 is skipped on open (host already knows the format from
   * context, e.g. a per-format Menu 2 tab's own "Dodaj"). The back arrow in
   * KROK 2 still returns to KROK 1 so the user can change format.
   */
  defaultFormat?: F | null;
  testId?: string;
}

export function CreateFormatModeLauncher<F extends string, M extends string>({
  isOpen,
  onClose,
  title,
  stepOneHint,
  stepTwoTitle,
  stepTwoHint,
  formatTiles,
  modeTiles,
  onSelect,
  defaultFormat = null,
  testId = 'create-format-mode-launcher',
}: CreateFormatModeLauncherProps<F, M>): React.ReactElement | null {
  const [format, setFormat] = useState<F | null>(defaultFormat ?? null);

  // Re-sync to defaultFormat every time the launcher opens fresh (mirrors
  // UnifiedCreateLauncher's defaultType re-sync) so a stale KROK 2 selection
  // from a previous open/close cycle never leaks into a new session.
  useEffect(() => {
    if (isOpen) setFormat(defaultFormat ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (format && !defaultFormat) setFormat(null);
      else onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose, format, defaultFormat]);

  const handleFullClose = () => {
    setFormat(defaultFormat ?? null);
    onClose();
  };

  if (!isOpen) return null;

  const resolvedModeTiles: ModeTileConfig<M>[] = format
    ? typeof modeTiles === 'function'
      ? modeTiles(format)
      : modeTiles
    : [];

  return (
    <div
      className="fixed inset-0 z-overlay flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) handleFullClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-format-mode-launcher-title"
        aria-describedby={stepOneHint || stepTwoHint ? `${testId}-description` : undefined}
        data-testid={testId}
        className="mx-4 w-[640px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-c-border bg-c-surface shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-c-border px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            {format ? (
              <button
                type="button"
                onClick={() => setFormat(null)}
                data-testid={`${testId}-back`}
                className="rounded p-1 text-c-text-secondary transition-colors hover:bg-c-surface-raised hover:text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                aria-label="Back"
              >
                <ArrowLeft size={18} />
              </button>
            ) : null}
            <h2
              id="create-format-mode-launcher-title"
              className="truncate text-lg font-semibold text-c-text"
            >
              {format ? (stepTwoTitle?.(format) ?? title) : title}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleFullClose}
            data-testid={`${testId}-close`}
            aria-label="Close"
            className="rounded p-1 text-c-text-secondary transition-colors hover:bg-c-surface-raised hover:text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            <X size={18} />
          </button>
        </div>

        {!format ? (
          <>
            {stepOneHint ? (
              <p id={`${testId}-description`} className="px-4 pt-4 text-sm text-c-text-secondary">
                {stepOneHint}
              </p>
            ) : null}
            <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
              {formatTiles.map(({ id, icon, title: tileTitle, hint }) => {
                const Icon = resolveFormatIcon(id, icon);
                return (
                  <button
                  key={id}
                  type="button"
                  data-testid={`${testId}-format-${id}`}
                  onClick={() => setFormat(id)}
                  aria-label={hint ? `${tileTitle}. ${hint}` : tileTitle}
                  className="group flex min-h-40 flex-col items-start rounded-2xl border border-c-border-subtle bg-c-surface p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-c-border-strong hover:bg-c-surface-raised hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                >
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-c-border-subtle bg-c-surface-raised text-c-text transition-colors group-hover:border-c-border-strong">
                    <Icon size={21} strokeWidth={1.8} aria-hidden />
                  </span>
                  <span className="mt-4 text-sm font-semibold text-c-text">{tileTitle}</span>
                  {hint ? (
                    <span className="mt-1 text-xs leading-relaxed text-c-text-secondary">
                      {hint}
                    </span>
                  ) : null}
                  <span className="mt-auto flex w-full items-center justify-end pt-3 text-c-text-muted transition-colors group-hover:text-c-text">
                    <ArrowRight size={16} aria-hidden />
                  </span>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            {stepTwoHint ? (
              <p id={`${testId}-description`} className="px-4 pt-4 text-sm text-c-text-secondary">
                {stepTwoHint(format)}
              </p>
            ) : null}
            <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
              {resolvedModeTiles.map(
                ({ id, icon: Icon, title: modeTitle, desc, testId: modeTestId }) => (
                  <button
                    key={id}
                    type="button"
                    aria-label={`${modeTitle}. ${desc}`}
                    data-testid={modeTestId ?? `${testId}-mode-${id}`}
                    onClick={() => onSelect(format, id)}
                    className="group flex h-full flex-col items-start gap-3 rounded-2xl border border-c-border-subtle bg-c-surface p-4 text-left transition-all hover:border-c-border hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-c-surface-raised text-c-text-secondary transition-colors group-hover:text-c-text">
                      <Icon size={20} aria-hidden />
                    </span>
                    <span className="flex flex-col gap-1">
                      <span className="text-sm font-semibold text-c-text">{modeTitle}</span>
                      <span className="text-xs leading-relaxed text-c-text-secondary">{desc}</span>
                    </span>
                  </button>
                )
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default CreateFormatModeLauncher;
