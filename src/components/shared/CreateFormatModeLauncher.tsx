/**
 * CreateFormatModeLauncher — wspólna DWUSTOPNIOWA tablica „Dodaj" dla Materiałów
 * (Menu 2) i Biblioteki szablonów (Harvard/wdrozenie-100/_MATERIALY_INWENTARYZACJA_2026-07-24.md §8).
 *
 *   KROK 1 — format (Dokument / Prezentacja / Arkusz Excel — lub „typ szablonu"
 *            w wywołaniu z Biblioteki szablonów).
 *   KROK 2 — tryb (Czysto / Z AI / Z szablonu — równorzędne, jak TriModeChooser).
 *
 * Powłoka wizualna 1:1 z dawnego globalnego launchera (`UnifiedCreateLauncher`,
 * USUNIĘTY jako martwy kod, D-01, 05.09.2026) — overlay + karta + siatka
 * kafli KROK 1; kafle KROK 2 stylowane jak `TriModeChooser`'s ModeCard.
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

  // Re-sync to defaultFormat every time the launcher opens fresh (mirrors the
  // retired global launcher's defaultType re-sync, see file header) so a
  // stale KROK 2 selection from a previous open/close cycle never leaks into
  // a new session.
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

  // Podtytuł nagłówka — ten sam slot w obu krokach (patrz komentarz przy nagłówku).
  const headerHint = format ? stepTwoHint?.(format) : stepOneHint;

  // Wspólna powłoka kafla: KROK 1 i KROK 2 wyglądały inaczej (krok 1 miał cień,
  // podskok `-translate-y-0.5` i `min-h-40`, krok 2 nie miał nic), więc przejście
  // między krokami zmieniało język wizualny okna w połowie zadania. Teraz jeden
  // zestaw klas: kafel na `c-surface-raised` (czytelny stopień względem `c-surface`
  // ramki W OBU MOTYWACH — przedtem kafel i ramka miały ten sam kolor i kafel
  // trzymał się wyłącznie włoskowatą kreską), hover = mocniejsza ramka + tło,
  // bez ruchu i bez skoków cienia. Fokus niebieski `c-focus`, zero crimsonu.
  const TILE_BASE =
    'group flex flex-col items-start rounded-2xl border border-c-border-subtle bg-c-surface-raised p-4 text-left transition-colors hover:border-c-border-strong hover:bg-c-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus';

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
        {/*
          RYTM (odbiór właściciela 2026-08-30: „mogłoby być trochę bardziej
          seksowne"). PRZED: nagłówek `px-4 py-3`, treść `p-4`, gap-3 — jedna
          wartość odstępu wszędzie, więc nic nie prowadziło wzroku. PO: ramka
          dostaje `px-6 py-5`, treść `px-6 pb-6`, siatka `gap-4` — okno oddycha,
          a kafle (czyli właściwa treść) mają większy udział w kompozycji.

          PODTYTUŁ WEWNĄTRZ NAGŁÓWKA. PRZED: pytanie („Co chcesz utworzyć?")
          siedziało POD kreską nagłówka jako osobny akapit, więc akcent brał
          rzeczownik („Nowy materiał"), a właściwe pytanie było zdegradowane —
          w dodatku KROK 2 nie miał podtytułu w ogóle i oba kroki wyglądały
          strukturalnie inaczej. PO: tytuł + pytanie tworzą JEDEN blok, tak
          samo w obu krokach. `id` opisu bez zmian (aria-describedby).
        */}
        <div className="flex items-start justify-between gap-3 border-b border-c-border px-6 py-5">
          <div className="flex min-w-0 items-start gap-2">
            {format ? (
              <button
                type="button"
                onClick={() => setFormat(null)}
                data-testid={`${testId}-back`}
                className="-ml-1 mt-0.5 rounded-lg p-1 text-c-text-secondary transition-colors hover:bg-c-surface-raised hover:text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                aria-label="Back"
              >
                <ArrowLeft size={18} />
              </button>
            ) : null}
            <div className="min-w-0">
              <h2
                id="create-format-mode-launcher-title"
                className="truncate text-lg font-semibold text-c-text"
              >
                {format ? (stepTwoTitle?.(format) ?? title) : title}
              </h2>
              {headerHint ? (
                <p
                  id={`${testId}-description`}
                  className="mt-1 text-sm text-c-text-secondary"
                >
                  {headerHint}
                </p>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={handleFullClose}
            data-testid={`${testId}-close`}
            aria-label="Close"
            className="-mr-1 shrink-0 rounded-lg p-1 text-c-text-secondary transition-colors hover:bg-c-surface-raised hover:text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            <X size={18} />
          </button>
        </div>

        {!format ? (
          <div className="grid grid-cols-1 gap-4 px-6 pb-6 pt-5 sm:grid-cols-3">
            {formatTiles.map(({ id, icon, title: tileTitle, hint }) => {
              const Icon = resolveFormatIcon(id, icon);
              return (
                <button
                  key={id}
                  type="button"
                  data-testid={`${testId}-format-${id}`}
                  onClick={() => setFormat(id)}
                  aria-label={hint ? `${tileTitle}. ${hint}` : tileTitle}
                  className={TILE_BASE}
                >
                  {/*
                    PRZED: kafel miał sztywne `min-h-40` (160 px), a strzałkę
                    dociskał `mt-auto` do dołu. Przy kaflu bez `hint` — czyli w
                    KAŻDYM realnym wywołaniu (Materiały i Biblioteka wzorców
                    podają sam tytuł) — między tytułem a strzałką zostawała
                    pusta dziura na ~60 px i to ONA była pierwszą rzeczą, którą
                    widać. PO: kafel ma wysokość swojej treści, a strzałka stoi
                    w jednym rzędzie z tytułem, więc „Dokument →" czyta się jako
                    jeden gest, nie jako dwa osierocone elementy.
                  */}
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-c-border-subtle bg-c-surface text-c-text transition-colors group-hover:border-c-border-strong">
                    <Icon size={21} strokeWidth={1.8} aria-hidden />
                  </span>
                  <span className="mt-4 flex w-full items-center justify-between gap-2">
                    {/* Kafle są treścią tego okna, więc to ONE mają nieść wagę
                        (text-base), a tytuł okna zostaje ramką. Przedtem oba
                        były `font-semibold` w podobnym stopniu i nic nie wiodło. */}
                    <span className="min-w-0 truncate text-base font-semibold text-c-text">
                      {tileTitle}
                    </span>
                    <ArrowRight
                      size={16}
                      aria-hidden
                      className="shrink-0 text-c-text-muted transition-colors group-hover:text-c-text"
                    />
                  </span>
                  {hint ? (
                    <span className="mt-1.5 text-xs leading-relaxed text-c-text-secondary">
                      {hint}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 px-6 pb-6 pt-5 sm:grid-cols-3">
            {resolvedModeTiles.map(
              ({ id, icon: Icon, title: modeTitle, desc, testId: modeTestId }) => (
                <button
                  key={id}
                  type="button"
                  aria-label={`${modeTitle}. ${desc}`}
                  data-testid={modeTestId ?? `${testId}-mode-${id}`}
                  onClick={() => onSelect(format, id)}
                  className={`${TILE_BASE} h-full`}
                >
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-c-border-subtle bg-c-surface text-c-text transition-colors group-hover:border-c-border-strong">
                    <Icon size={21} strokeWidth={1.8} aria-hidden />
                  </span>
                  <span className="mt-4 text-base font-semibold text-c-text">{modeTitle}</span>
                  <span className="mt-1.5 text-xs leading-relaxed text-c-text-secondary">
                    {desc}
                  </span>
                </button>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default CreateFormatModeLauncher;
