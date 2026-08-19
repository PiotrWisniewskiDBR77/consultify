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
 */
import { ArrowLeftRight, ArrowRight, Paintbrush, Trash2, Type } from 'lucide-react';
import React from 'react';

import { CanvasContextMenu } from '@/components/shared/CanvasContextMenu';

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

interface EdgeMenuItem {
  id: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  labelPl: string;
  labelEn: string;
  run: () => void;
  danger?: boolean;
  dividerBefore?: boolean;
}

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
  const items: EdgeMenuItem[] = [
    {
      id: 'edge_add_label',
      icon: Type,
      labelPl: 'Dodaj / edytuj etykietę',
      labelEn: 'Add / edit label',
      run: onEditLabel,
    },
    {
      id: 'edge_reverse',
      icon: ArrowLeftRight,
      labelPl: 'Odwróć kierunek',
      labelEn: 'Reverse direction',
      run: onReverse,
    },
    {
      id: 'edge_arrow_direction',
      icon: ArrowRight,
      labelPl: 'Kierunek strzałki',
      labelEn: 'Arrow direction',
      run: onCycleArrow,
    },
    {
      id: 'edge_change_style',
      icon: Paintbrush,
      labelPl: 'Zmień styl linii',
      labelEn: 'Change line style',
      run: onCycleStyle,
    },
    {
      id: 'edge_delete',
      icon: Trash2,
      labelPl: 'Usuń połączenie',
      labelEn: 'Delete connection',
      run: onDelete,
      danger: true,
      dividerBefore: true,
    },
  ];

  return (
    <CanvasContextMenu
      x={x}
      y={y}
      onClose={onClose}
      ariaLabel={isPl ? 'Akcje połączenia tablicy' : 'Whiteboard connection actions'}
      testId="whiteboard-edge-context-menu"
      items={items.map((item) => {
        const Icon = item.icon;
        return {
          id: item.id,
          label: isPl ? item.labelPl : item.labelEn,
          icon: <Icon size={14} />,
          disabled: isLocked,
          disabledReason: isLocked
            ? isPl
              ? 'Połączenie jest zablokowane'
              : 'Connection is locked'
            : undefined,
          danger: item.danger,
          separatorBefore: item.dividerBefore,
          onSelect: item.run,
        };
      })}
    />
  );
};

export default WhiteboardEdgeContextMenu;
