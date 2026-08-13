/**
 * WhiteboardEdgeContextMenu — right-click menu for a whiteboard connection.
 *
 * Standard rozdz. 08 §4: każda reprezentacja z krawędziami (MM/WB/Process) musi
 * mieć pełne menu krawędzi z prawego kliku. Whiteboard ma prawdziwe krawędzie
 * (ReactFlow `labeled`, patrz whiteboard/nodes/LabeledEdge.tsx), ale do tej pory
 * prawy klik na krawędzi był martwy (brak `onEdgeContextMenu`, `deleteKeyCode`
 * ustawione na `null` → krawędzi w ogóle nie dało się usunąć — luka D7 + brak
 * odpowiednika Delete jak w Process Flow D3).
 *
 * Z3 (rejestr akcji): pokazujemy WYŁĄCZNIE pozycje z realnym handlerem. Whiteboard
 * NIE wspiera "Wstaw węzeł na połączeniu" (brak logiki rozcięcia krawędzi), więc
 * ta pozycja świadomie NIE występuje — zamiast atrapy.
 *
 * PILOT REJESTRU AKCJI (2026-08-09, Z1/E02): te 5 pozycji NIE są już
 * hardkodowane lokalnie — pochodzą z `IDEA_ACTION_REGISTRY`
 * (`getActionsForSurface('context', { tool: 'whiteboard' })`, filtr
 * `scope === 'edge'`) i wykonują się przez `runIdeaAction(id, ctx)`, dokładnie
 * jak Menu 3 (`ideaCanvasMelsChips.ts` — pierwsza powierzchnia przepięta na
 * rejestr). Rejestrowe handlery tych 5 akcji (`idea.edge.*` w
 * `ideaActionRegistry.ts`) są CIENKIM PRZEKAŹNIKIEM: wykonują ten sam prop-
 * callback (`onEditLabel`/`onCycleStyle`/…) co przed migracją, przekazany jako
 * `ctx.params.run` — Tablica NIE MA odbiornika akcji krawędzi na szynie
 * `idea-workspace-quick-action` (patrz komentarz przy `runEdgeParamCallback`
 * w rejestrze), więc realna mutacja nadal żyje WYŁĄCZNIE w
 * `IdeaWhiteboardTool.tsx` (nietknięty w tym pilocie). Zachowanie wizualne i
 * kolejność pozycji są 1:1 ze stanem sprzed migracji.
 */
import { ArrowLeftRight, ArrowRight, Paintbrush, Trash2, Type } from 'lucide-react';
import React from 'react';

import {
  type ActionContext,
  getActionsForSurface,
  type IconName,
  runIdeaAction,
} from '@/actions/ideaActionRegistry';
import { CanvasContextMenu } from '@/components/shared/CanvasContextMenu';
import { EMPTY_SELECTION } from '@/components/MyWork/ideaSelectionTypes';

interface WhiteboardEdgeContextMenuProps {
  x: number;
  y: number;
  isPl: boolean;
  isLocked: boolean;
  onClose: () => void;
  onEditLabel: () => void;
  onCycleStyle: () => void;
  /**
   * Strzałka kierunku przepływu (2026-07-28) — cykl none → end → both → start
   * na TEJ krawędzi, dokładnie jak `onCycleStyle` obok. Wspólne pole
   * `edge.data.arrowDirection` z Mapą myśli i Przepływem procesu.
   */
  onCycleArrow: () => void;
  onReverse: () => void;
  onDelete: () => void;
}

/** Tylko ikony faktycznie użyte tu — pełna lista IconName żyje w rejestrze. */
const ICON_BY_NAME: Partial<Record<IconName, React.ComponentType<{ size?: number }>>> = {
  Type,
  ArrowLeftRight,
  ArrowRight,
  Paintbrush,
  Trash2,
};

export const WhiteboardEdgeContextMenu: React.FC<WhiteboardEdgeContextMenuProps> = ({
  x,
  y,
  isPl,
  isLocked,
  onClose,
  onEditLabel,
  onCycleStyle,
  onCycleArrow,
  onReverse,
  onDelete,
}) => {
  // Łączy `def.id` z rejestru z ORYGINALNYM prop-callbackiem tego komponentu —
  // ten sam callback, który przed migracją wołał `run()` bezpośrednio z
  // hardkodowanej tablicy `items`.
  const RUN_BY_ACTION_ID: Record<string, () => void> = {
    'idea.edge.edit_label': onEditLabel,
    'idea.edge.reverse': onReverse,
    'idea.edge.cycle_arrow': onCycleArrow,
    'idea.edge.cycle_style': onCycleStyle,
    'idea.edge.delete': onDelete,
  };

  const lockedReason = isPl ? 'Połączenie jest zablokowane' : 'Connection is locked';

  const items = getActionsForSurface('context', { tool: 'whiteboard' })
    .filter(({ def }) => def.scope === 'edge')
    .map(({ def, disabledReason }) => {
      const Icon = ICON_BY_NAME[def.icon];
      const run = RUN_BY_ACTION_ID[def.id];
      const disabled = isLocked || Boolean(disabledReason);
      return {
        id: def.id,
        label: isPl ? def.label.pl : def.label.en,
        icon: Icon ? <Icon size={14} /> : undefined,
        disabled,
        disabledReason: disabled ? (isLocked ? lockedReason : (disabledReason ?? undefined)) : undefined,
        // `destructive` w rejestrze = jedyna dziś krawędziowa akcja
        // nieodwracalna w sensie danych ("Usuń połączenie") — 1:1 z dawnym
        // hardkodowanym `danger: true`.
        danger: def.destructive,
        // "Usuń połączenie" było jedyną pozycją z separatorem nad sobą w
        // oryginalnej tablicy (`dividerBefore: true`) — zachowane po id, bo
        // rejestr nie modeluje jeszcze wizualnego grupowania per-scope.
        separatorBefore: def.id === 'idea.edge.delete',
        onSelect: () => {
          const ctx: ActionContext = {
            ideaId: '',
            tool: 'whiteboard',
            selection: EMPTY_SELECTION,
            surface: 'context',
            source: 'ui',
            language: isPl ? 'pl' : 'en',
            params: { run },
          };
          void runIdeaAction(def.id, ctx);
        },
      };
    });

  return (
    <CanvasContextMenu
      x={x}
      y={y}
      onClose={onClose}
      ariaLabel={isPl ? 'Akcje połączenia tablicy' : 'Whiteboard connection actions'}
      testId="whiteboard-edge-context-menu"
      items={items}
    />
  );
};

export default WhiteboardEdgeContextMenu;
