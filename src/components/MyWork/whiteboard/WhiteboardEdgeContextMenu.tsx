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
import React, { useCallback, useEffect, useRef } from 'react';

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
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    // Faza przechwytywania — obowiązkowa: d3-zoom pod ReactFlow woła
    // `stopImmediatePropagation()` na `mousedown` w `.react-flow__pane`, więc
    // zwykły listener nigdy się nie odpali (patrz NodeContextMenu).
    window.addEventListener('mousedown', handleMouseDown, true);
    document.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('mousedown', handleMouseDown, true);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const handleClick = useCallback(
    (run: () => void) => {
      run();
      onClose();
    },
    [onClose]
  );

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

  const clampedX = Math.min(x, window.innerWidth - 220);
  const clampedY = Math.min(y, window.innerHeight - items.length * 36 - 20);

  return (
    <div
      ref={ref}
      className="fixed z-toast bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl shadow-xl py-1.5 min-w-[200px] animate-in fade-in zoom-in-95 duration-150"
      style={{ left: clampedX, top: clampedY }}
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <React.Fragment key={item.id}>
            {item.dividerBefore && (
              <div className="my-1 mx-2 h-px bg-slate-200/60 dark:bg-white/[0.06]" />
            )}
            <button
              type="button"
              disabled={isLocked}
              onClick={() => handleClick(item.run)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-[11px] font-medium transition-colors disabled:opacity-40 ${
                item.danger
                  ? 'text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20'
                  : 'text-c-text hover:bg-c-surface-raised'
              }`}
            >
              <Icon size={14} className={item.danger ? 'shrink-0' : 'text-c-text-muted shrink-0'} />
              <span>{isPl ? item.labelPl : item.labelEn}</span>
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default WhiteboardEdgeContextMenu;
