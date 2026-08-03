/**
 * DOKOWANIE paska edycji w listwie płótna + WSPÓLNY BUDOWNICZY grup stylu.
 *
 * Dwie rzeczy, które inaczej powtórzyłyby się trzy razy (Mapa · Tablica ·
 * Proces) i rozjechały się jak bespoke-tabele z krachu 07-12:
 *
 * 1. `useObjectEditBarSlot()` — znajduje slot DOM wystawiony przez
 *    `IdeaCanvasSecondBar` i reaguje na jego pojawianie się/znikanie
 *    (`MutationObserver`, wzorzec `whiteboard/usePortalSlot`). Zwraca `null`,
 *    gdy slotu nie ma → narzędzie zostaje przy swoim pływającym pasku
 *    (bezpiecznik: kontrolki nigdy nie znikają przez brak celu portalu).
 *
 * 2. `buildStyleGroups()` — jedna definicja grup „typografia / kolory /
 *    kształt", żeby trzy narzędzia miały DOKŁADNIE te same kontrolki w tej
 *    samej kolejności. Narzędzie podaje tylko bieżący styl, callback zapisu i
 *    to, które grupy mają dla niego sens (`shape`, `border` itd.).
 */
import type { TFunction } from 'i18next';
import { Bold, PaintBucket, Palette, Shapes, Square, Type, Underline } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { CANVAS_OBJECT_EDIT_BAR_SLOT_ID } from '@/utils/canvasObjectEditBarFlag';

import type { CanvasFontFamilyKey, CanvasObjectStyle, CanvasShapeKey } from './canvasObjectStyle';
import type { ObjectEditBarGroup } from './ObjectEditBar';
import {
  ColorPalettePopover,
  FontFamilyPopover,
  FontSizePopover,
  ShapePalettePopover,
} from './ObjectEditBarPopovers';

/**
 * Czy slot paska edycji MA treść (czyli narzędzie coś do niego wportalowało).
 * `MutationObserver` na SAMYM slocie — montaż/odmontowanie przez `createPortal`
 * nie jest zgłaszane rodzicowi przez Reacta w żaden inny sposób.
 *
 * Dwóch gospodarzy slotu potrzebuje tej samej odpowiedzi, więc mieszka tu, a
 * nie w jednym z nich:
 *   • `IdeaCanvasSecondBar` (Menu 3) — chowa własne klastry na czas edycji,
 *   • `MyWorkHub` (scalona jedna linia, `ff_ideaTopBarOneLine`) — kurczy rząd
 *     pilli do samego tytułu, żeby zrobić miejsce na środku belki.
 */
export function useObjectEditBarSlotHasContent(
  ref: React.RefObject<HTMLElement | null>,
  enabled: boolean
): boolean {
  const [hasContent, setHasContent] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setHasContent(false);
      return;
    }
    const el = ref.current;
    if (!el || typeof MutationObserver === 'undefined') return;
    const check = () => setHasContent(el.childElementCount > 0);
    check();
    const observer = new MutationObserver(check);
    observer.observe(el, { childList: true });
    return () => observer.disconnect();
  }, [ref, enabled]);

  return hasContent;
}

/** Reaktywne wyszukiwanie slotu paska edycji w DOM. */
export function useObjectEditBarSlot(): HTMLElement | null {
  const [node, setNode] = useState<HTMLElement | null>(() =>
    typeof document === 'undefined' ? null : document.getElementById(CANVAS_OBJECT_EDIT_BAR_SLOT_ID)
  );

  useEffect(() => {
    if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;
    const check = () => {
      const found = document.getElementById(CANVAS_OBJECT_EDIT_BAR_SLOT_ID);
      setNode((prev) => (prev === found ? prev : found));
    };
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return node;
}

/** Portal do slotu; `null` gdy slotu nie ma (wywołujący robi wtedy fallback). */
export const ObjectEditBarDock: React.FC<{
  slot: HTMLElement | null;
  children: React.ReactNode;
}> = ({ slot, children }) => (slot ? createPortal(children, slot) : null);

export interface StyleGroupsOptions {
  style: CanvasObjectStyle;
  onPatch: (patch: Record<string, unknown>) => void;
  t: TFunction;
  disabled?: boolean;
  /** Które grupy mają sens dla tego obiektu. Domyślnie wszystkie oprócz kształtu. */
  show?: {
    typography?: boolean;
    textColor?: boolean;
    background?: boolean;
    border?: boolean;
    shape?: boolean;
  };
}

/**
 * Buduje grupy „Typografia" i „Kolory + kształt". Kolejność jest kanonem —
 * właściciel ma znajdować tę samą kontrolkę w tym samym miejscu we wszystkich
 * trzech narzędziach.
 */
export function buildStyleGroups({
  style,
  onPatch,
  t,
  disabled,
  show,
}: StyleGroupsOptions): ObjectEditBarGroup[] {
  const cfg = {
    typography: true,
    textColor: true,
    background: true,
    border: true,
    shape: false,
    ...(show || {}),
  };

  const typography: ObjectEditBarGroup = { id: 'typography', controls: [] };
  if (cfg.typography) {
    typography.controls.push(
      {
        kind: 'popover',
        id: 'font-family',
        icon: Type,
        label: t('canvasEditBar.fontFamily', 'Czcionka'),
        disabled,
        render: (close) => (
          <FontFamilyPopover
            value={style.fontFamily}
            onPick={(key: CanvasFontFamilyKey) => onPatch({ fontFamily: key })}
            close={close}
          />
        ),
      },
      {
        kind: 'popover',
        id: 'font-size',
        label: t('canvasEditBar.fontSize', 'Wielkość'),
        text: String(style.fontSize ?? 11),
        disabled,
        render: (close) => (
          <FontSizePopover
            value={style.fontSize}
            onPick={(size) => onPatch({ fontSize: size })}
            close={close}
          />
        ),
      },
      {
        kind: 'button',
        id: 'bold',
        icon: Bold,
        label: t('canvasEditBar.bold', 'Pogrubienie'),
        active: !!style.bold,
        disabled,
        // Piszemy OBA klucze: `bold` (Mapa Myśli) i `fontWeight` (Tablica) —
        // renderery obu narzędzi zostają nietknięte, a pasek jest jeden.
        onClick: () => onPatch({ bold: !style.bold, fontWeight: style.bold ? 'normal' : 'bold' }),
      },
      {
        kind: 'button',
        id: 'underline',
        icon: Underline,
        label: t('canvasEditBar.underline', 'Podkreślenie'),
        active: !!style.underline,
        disabled,
        onClick: () =>
          onPatch({
            underline: !style.underline,
            textDecoration: style.underline ? 'none' : 'underline',
          }),
      }
    );
  }
  if (cfg.textColor) {
    typography.controls.push({
      kind: 'popover',
      id: 'text-color',
      icon: Palette,
      label: t('canvasEditBar.textColor', 'Kolor tekstu'),
      swatch: style.textColor ?? null,
      disabled,
      render: (close) => (
        <ColorPalettePopover
          title={t('canvasEditBar.textColor', 'Kolor tekstu')}
          resetLabel={t('canvasEditBar.resetDefault', 'Domyślny')}
          value={style.textColor}
          onPick={(c) => onPatch({ textColor: c })}
          close={close}
        />
      ),
    });
  }

  const surface: ObjectEditBarGroup = { id: 'surface', controls: [] };
  if (cfg.background) {
    surface.controls.push({
      kind: 'popover',
      id: 'bg-color',
      icon: PaintBucket,
      label: t('canvasEditBar.bgColor', 'Kolor tła'),
      swatch: style.bgColor ?? null,
      disabled,
      render: (close) => (
        <ColorPalettePopover
          title={t('canvasEditBar.bgColor', 'Kolor tła')}
          resetLabel={t('canvasEditBar.resetBg', 'Bez własnego tła')}
          value={style.bgColor}
          onPick={(c) => onPatch({ bgColor: c })}
          close={close}
        />
      ),
    });
  }
  if (cfg.border) {
    surface.controls.push({
      kind: 'popover',
      id: 'border-color',
      icon: Square,
      label: t('canvasEditBar.borderColor', 'Kolor ramki'),
      swatch: style.borderColor ?? null,
      disabled,
      render: (close) => (
        <ColorPalettePopover
          title={t('canvasEditBar.borderColor', 'Kolor ramki')}
          resetLabel={t('canvasEditBar.resetBorder', 'Bez własnej ramki')}
          value={style.borderColor}
          onPick={(c) => onPatch({ borderColor: c })}
          close={close}
        />
      ),
    });
  }
  if (cfg.shape) {
    surface.controls.push({
      kind: 'popover',
      id: 'shape',
      icon: Shapes,
      label: t('canvasEditBar.shapeTitle', 'Kształt obiektu'),
      disabled,
      render: (close) => (
        <ShapePalettePopover
          value={style.shape}
          onPick={(shape: CanvasShapeKey) => onPatch({ shape })}
          close={close}
        />
      ),
    });
  }

  return [typography, surface].filter((g) => g.controls.length > 0);
}
