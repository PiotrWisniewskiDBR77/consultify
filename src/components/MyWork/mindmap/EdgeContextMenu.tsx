/**
 * REJESTR AKCJI (2026-08-09, Z1/E02 rozszerzenie z Tablicy — patrz
 * `WhiteboardEdgeContextMenu.tsx` dla wzoru pilota): te 7 pozycji NIE są już
 * hardkodowane lokalnie — pochodzą z `IDEA_ACTION_REGISTRY`
 * (`getActionsForSurface('context', { tool: 'mindmap' })`, filtr
 * `scope === 'edge'`) i wykonują się przez `runIdeaAction(id, ctx)`.
 *
 * Inaczej niż Tablica: Mapa myśli NIE przekazuje `ctx.params.run` (prop-
 * callback) — jej hook (`useMindMapQuickActions.ts`) ma bezpośredni dostęp do
 * surowego stanu `edges`/`setEdges`/`nodes`/`setNodes` (przekazywanego z
 * `IdeaRecommendationMap.tsx`), więc klik człowieka i wywołanie Teresy idą TĄ
 * SAMĄ ścieżką: rejestr → `dispatchQuickAction` → szyna
 * `idea-workspace-quick-action` → odbiornik w hooku, adresowany `edgeId`. To
 * DOKŁADNIE wzorzec, którym pozycja „Kierunek strzałki" (`mm_edge_arrow`) już
 * działała od 2026-07-28 — rozszerzony na pozostałych 6, nie zduplikowany.
 * Realna mutacja żyje teraz WYŁĄCZNIE w `useMindMapQuickActions.ts`
 * (`IdeaRecommendationMap.tsx` nie ma już własnej kopii tej logiki —
 * `handleEdgeContextAction` zostało usunięte przy tej migracji).
 *
 * Dwie pozycje („Wstaw węzeł na połączeniu", „Edytuj relację") istnieją TYLKO
 * na Mapie myśli (`tools: ['mindmap']` w rejestrze) — Tablica nie ma pojęcia
 * relacji ani rozcięcia krawędzi węzłem, więc jej menu (osobny plik,
 * `WhiteboardEdgeContextMenu.tsx`) ich nie pokazuje.
 *
 * Zachowanie wizualne (kolejność, separator przed „Usuń połączenie", stan
 * disabled) jest 1:1 ze stanem sprzed migracji.
 */
import { ArrowLeftRight, ArrowRight, Edit3, Paintbrush, Plus, Trash2, Type } from 'lucide-react';
import React from 'react';

import {
  type ActionContext,
  getActionsForSurface,
  type IconName,
  runIdeaAction,
} from '@/actions/ideaActionRegistry';
import { EMPTY_SELECTION } from '@/components/MyWork/ideaSelectionTypes';
import { CanvasContextMenu } from '@/components/shared/CanvasContextMenu';

export interface EdgeContextMenuProps {
  x: number;
  y: number;
  edgeId: string;
  isPl: boolean;
  isLocked: boolean;
  isUserCreated: boolean;
  onClose: () => void;
}

/** Tylko ikony faktycznie użyte tu — pełna lista IconName żyje w rejestrze. */
const ICON_BY_NAME: Partial<Record<IconName, React.ComponentType<{ size?: number }>>> = {
  Type,
  Plus,
  ArrowLeftRight,
  ArrowRight,
  Paintbrush,
  Edit3,
  Trash2,
};

export const EdgeContextMenu: React.FC<EdgeContextMenuProps> = ({
  x,
  y,
  edgeId,
  isPl,
  isLocked,
  isUserCreated,
  onClose,
}) => {
  const lockedReason = isPl ? 'Połączenia nie można zmienić' : 'Connection cannot be changed';

  const items = getActionsForSurface('context', { tool: 'mindmap' })
    .filter(({ def }) => def.scope === 'edge')
    .map(({ def, disabledReason }) => {
      const Icon = ICON_BY_NAME[def.icon];
      // „Usuń połączenie": dodatkowy gate poza `isLocked` — krawędzi
      // niewygenerowanej ręcznie (`!isUserCreated`) nie da się usunąć.
      // Zachowanie 1:1 ze stanem sprzed migracji (hardkodowana tablica
      // `items` miała `disabled: isLocked || !isUserCreated` tylko na tej
      // pozycji).
      const extraDisabled = def.id === 'idea.edge.delete' && !isUserCreated;
      const disabled = isLocked || extraDisabled || Boolean(disabledReason);
      return {
        id: def.id,
        label: isPl ? def.label.pl : def.label.en,
        icon: Icon ? <Icon size={14} /> : undefined,
        disabled,
        disabledReason: disabled ? (isLocked ? lockedReason : (disabledReason ?? lockedReason)) : undefined,
        danger: def.destructive,
        // „Usuń połączenie" było jedyną pozycją z separatorem NAD sobą w
        // oryginalnej tablicy (`dividerBefore: true`) — zachowane po id.
        separatorBefore: def.id === 'idea.edge.delete',
        onSelect: () => {
          const ctx: ActionContext = {
            ideaId: '',
            tool: 'mindmap',
            selection: EMPTY_SELECTION,
            surface: 'context',
            source: 'ui',
            language: isPl ? 'pl' : 'en',
            params: { edgeId },
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
      ariaLabel={isPl ? 'Akcje połączenia mapy myśli' : 'Mind map connection actions'}
      testId="mindmap-edge-context-menu"
      items={items}
    />
  );
};
