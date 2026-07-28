/**
 * ObjectEditBar — PASEK EDYCJI OBIEKTU dokowany w listwie płótna.
 *
 * Doktryna 1:1 z `StandardTable`/`StandardModuleBar`: **narzędzie DEKLARUJE
 * treść, komponent NARZUCA wygląd**. Mapa Myśli / Tablica / Proces budują
 * `ObjectEditBarModel` (grupy kontrolek) i portalują go do slotu w
 * `IdeaCanvasSecondBar`. Zero własnych pasków per narzędzie, zero rozjazdu
 * wyglądu — dokładnie ten sam błąd, który złamał kanon tabel 07-12.
 *
 * Wygląd: ghost-only, tokeny `c-*`, fokus `c-focus`. Zero crimson
 * (`primary-*` = crimson, CLAUDE.md #3) poza jawnie oznaczonymi akcjami
 * destrukcyjnymi (`tone: 'danger'`), gdzie czerwień JEST semantyką krytyczną.
 */
import { ChevronDown } from 'lucide-react';
import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type ObjectEditBarControl =
  | {
      kind: 'button';
      id: string;
      icon: React.ComponentType<{ size?: number; className?: string }>;
      label: string;
      onClick: () => void;
      active?: boolean;
      disabled?: boolean;
      tone?: 'neutral' | 'danger';
      /** Licznik w rogu (np. liczba komentarzy / podpiętych artefaktów). */
      badge?: number;
    }
  | {
      kind: 'popover';
      id: string;
      icon?: React.ComponentType<{ size?: number; className?: string }>;
      label: string;
      /** Kropka koloru zamiast ikony (kolor tekstu / tła / ramki). */
      swatch?: string | null;
      /** Krótki tekst zamiast ikony (np. bieżąca wielkość pisma). */
      text?: string;
      disabled?: boolean;
      align?: 'left' | 'center' | 'right';
      render: (close: () => void) => React.ReactNode;
    };

export interface ObjectEditBarGroup {
  id: string;
  controls: ObjectEditBarControl[];
}

export interface ObjectEditBarModel {
  /** Tożsamość zaznaczenia — np. „Węzeł" albo „3 obiekty". */
  title: string;
  groups: ObjectEditBarGroup[];
  /** Akcja zamykająca pasek (odznacz) — ikona po prawej. */
  onDismiss?: () => void;
  dismissLabel?: string;
}

const BTN_BASE =
  'inline-flex h-8 min-w-[32px] items-center justify-center gap-1 rounded-lg px-1.5 ' +
  'text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus ' +
  'disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0';

const BTN_TONE = {
  idle: 'text-c-text-secondary hover:bg-c-surface-raised',
  active: 'bg-c-surface-raised text-c-text ring-1 ring-c-border-strong',
  danger: 'text-c-danger hover:bg-c-surface-raised',
};

const PopoverControl: React.FC<{ control: Extract<ObjectEditBarControl, { kind: 'popover' }> }> = ({
  control,
}) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const panelId = useId();

  /**
   * Popover leci PORTALEM do `body` z `position: fixed`, a nie `absolute`
   * wewnątrz listwy. Powód (złapany na zrzucie): pasek stoi w listwie o
   * wysokości 44px z przewijaniem poziomym, a `overflow-x: auto` obcina
   * TAKŻE w pionie — rozwijka koloru była niewidoczna, mimo że się renderowała.
   */
  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    const place = () => {
      const anchor = wrapRef.current?.getBoundingClientRect();
      if (!anchor) return;
      const width = panelRef.current?.offsetWidth ?? 190;
      let left =
        control.align === 'right'
          ? anchor.right - width
          : control.align === 'center'
            ? anchor.left + anchor.width / 2 - width / 2
            : anchor.left;
      left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
      setCoords({ top: anchor.bottom + 4, left });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, control.align]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (wrapRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  const close = useCallback(() => setOpen(false), []);
  const Icon = control.icon;

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        disabled={control.disabled}
        onClick={() => setOpen((v) => !v)}
        title={control.label}
        aria-label={control.label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className={`${BTN_BASE} ${open ? BTN_TONE.active : BTN_TONE.idle}`}
        data-testid={`object-edit-bar-${control.id}`}
      >
        {control.swatch !== undefined ? (
          <span
            className="h-3.5 w-3.5 rounded-full border border-c-border-subtle"
            style={
              control.swatch
                ? { backgroundColor: control.swatch }
                : {
                    backgroundImage:
                      'linear-gradient(135deg, transparent 44%, var(--c-border-strong) 44%, var(--c-border-strong) 56%, transparent 56%)',
                  }
            }
            aria-hidden="true"
          />
        ) : null}
        {Icon ? <Icon size={14} aria-hidden="true" /> : null}
        {control.text ? (
          <span className="text-[11px] font-semibold tabular-nums">{control.text}</span>
        ) : null}
        <ChevronDown size={10} aria-hidden="true" className="opacity-60" />
      </button>
      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              id={panelId}
              ref={panelRef}
              role="dialog"
              aria-label={control.label}
              className="fixed z-dropdown"
              style={{
                top: coords?.top ?? -9999,
                left: coords?.left ?? -9999,
                visibility: coords ? 'visible' : 'hidden',
              }}
            >
              {control.render(close)}
            </div>,
            document.body
          )
        : null}
    </div>
  );
};

export const ObjectEditBar: React.FC<{ model: ObjectEditBarModel }> = ({ model }) => {
  const groups = model.groups.filter((g) => g.controls.length > 0);
  return (
    <div
      className="flex min-w-0 flex-1 items-center gap-1"
      role="toolbar"
      aria-label={model.title}
      data-testid="object-edit-bar"
    >
      <span className="flex-shrink-0 px-1 text-[10px] font-bold uppercase tracking-[0.12em] text-c-text-muted whitespace-nowrap">
        {model.title}
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
        {groups.map((group, gi) => (
          <React.Fragment key={group.id}>
            {gi > 0 ? (
              <div
                className="mx-1 h-4 w-px flex-shrink-0 bg-c-border-subtle"
                aria-hidden="true"
                role="separator"
              />
            ) : null}
            {group.controls.map((control) =>
              control.kind === 'popover' ? (
                <PopoverControl key={control.id} control={control} />
              ) : (
                <button
                  key={control.id}
                  type="button"
                  onClick={control.onClick}
                  disabled={control.disabled}
                  title={control.label}
                  aria-label={control.label}
                  aria-pressed={control.active ? true : undefined}
                  className={`${BTN_BASE} relative ${
                    control.active
                      ? BTN_TONE.active
                      : control.tone === 'danger'
                        ? BTN_TONE.danger
                        : BTN_TONE.idle
                  }`}
                  data-testid={`object-edit-bar-${control.id}`}
                >
                  <control.icon size={14} aria-hidden="true" />
                  {control.badge ? (
                    <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-c-info px-0.5 text-[8px] font-bold text-white">
                      {control.badge}
                    </span>
                  ) : null}
                </button>
              )
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default ObjectEditBar;
