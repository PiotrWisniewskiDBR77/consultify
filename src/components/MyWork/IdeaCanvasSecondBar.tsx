/**
 * IdeaCanvasSecondBar — Menu 3 (druga listwa POD Menu 1) for the Ideas
 * EditorShell (Z7). Carries the per-tool VIEW actions moved off Menu 1:
 * left cluster (Dodaj · Auto-układ · AI rozwiń · Szablony) + right cluster
 * (Eksport). Rendered by `IdeaMapWorkspace` into the shell's `secondBar` slot.
 *
 * PRESENTATIONAL — driven entirely by `IdeaMenu3Action` descriptors built by
 * `buildIdeaMenu3Actions`, które od 2026-07 pochodzą Z REJESTRU AKCJI
 * (`getActionsForSurface('menu3', …)`) — nie z ręcznej listy hosta. Ghost
 * buttons only; no primary CTA lives here (the sole primary is Menu 1's
 * "Konwertuj ▾"). „Utwórz z mapy" świadomie zniknęło z Menu 3 (D6, rozdz. 05 §4.1).
 *
 * CRIMSON-SAFE: neutral ghost tokens + `c-focus` focus ring; no crimson.
 */

import React, { useRef } from 'react';

import {
  CANVAS_OBJECT_EDIT_BAR_SLOT_ID,
  isCanvasObjectEditBarEnabled,
} from '@/utils/canvasObjectEditBarFlag';

import { useObjectEditBarSlotHasContent } from './canvas/objectEditBarDock';
import type { IdeaMenu3Action } from './ideaCanvasMelsChips';

const Btn: React.FC<{ action: IdeaMenu3Action }> = ({ action }) => {
  const { icon: Icon, label, onClick, disabled, tooltip, testId, id } = action;
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={tooltip ?? label}
      aria-label={label}
      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm text-c-text-secondary hover:bg-c-surface-raised focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
      data-testid={testId ?? `idea-menu3-${id}`}
    >
      <Icon size={14} aria-hidden="true" />
      <span className="hidden md:inline">{label}</span>
    </button>
  );
};

export interface IdeaCanvasSecondBarProps {
  left: IdeaMenu3Action[];
  right: IdeaMenu3Action[];
  ariaLabel?: string;
}

export const IdeaCanvasSecondBar: React.FC<IdeaCanvasSecondBarProps> = ({
  left,
  right,
  ariaLabel = 'Idea view actions',
}) => {
  // PASEK EDYCJI OBIEKTU (ff_canvasObjectEditBar): ta listwa jest miejscem, w
  // które wskazał właściciel — „tam gdzie jest AddNode, Auto Layout, AI Expand,
  // Templates — dokładnie tutaj na środku tego menu". Przy zaznaczeniu obiektu
  // narzędzie portaluje `<ObjectEditBar>` do slotu poniżej, a listwa CHOWA
  // własne klastry: pasek edycji PODMIENIA zawartość linii, nie dokłada rzędu.
  const editBarEnabled = isCanvasObjectEditBarEnabled();
  const slotRef = useRef<HTMLDivElement>(null);
  const editing = useObjectEditBarSlotHasContent(slotRef, editBarEnabled);

  // Przy fladze ON listwa musi istnieć nawet z pustymi klastrami — inaczej nie
  // byłoby slotu, do którego narzędzie miałoby wportalować pasek.
  if (left.length === 0 && right.length === 0 && !editBarEnabled) return null;

  return (
    <div
      className="flex items-center gap-1 border-b border-c-border-subtle bg-c-surface px-4 h-11 flex-shrink-0"
      role="toolbar"
      aria-label={ariaLabel}
      data-testid="idea-canvas-second-bar"
      data-edit-bar-active={editing ? 'true' : undefined}
    >
      {!editing && left.map((action) => <Btn key={action.id} action={action} />)}

      {editBarEnabled ? (
        <div
          id={CANVAS_OBJECT_EDIT_BAR_SLOT_ID}
          ref={slotRef}
          className={editing ? 'flex min-w-0 flex-1 items-center' : 'contents'}
          data-testid="canvas-object-edit-bar-slot"
        />
      ) : null}

      {!editing && right.length > 0 ? (
        <div className="ml-auto flex items-center gap-1">
          {right.map((action) => (
            <Btn key={action.id} action={action} />
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default IdeaCanvasSecondBar;
