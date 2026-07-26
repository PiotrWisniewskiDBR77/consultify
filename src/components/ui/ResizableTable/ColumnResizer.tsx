/**
 * ColumnResizer - Drag handle for column resizing
 * ClickUp-style resizable columns
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

interface ColumnResizerProps {
  columnId: string;
  currentWidth: number;
  minWidth: number;
  maxWidth?: number;
  onResize: (columnId: string, newWidth: number) => void;
}

export const ColumnResizer: React.FC<ColumnResizerProps> = ({
  columnId,
  currentWidth,
  minWidth,
  maxWidth = 500,
  onResize,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
      startXRef.current = e.clientX;
      startWidthRef.current = currentWidth;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [currentWidth]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;

      const delta = e.clientX - startXRef.current;
      let newWidth = startWidthRef.current + delta;

      // Clamp to min/max
      newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));

      onResize(columnId, newWidth);
    },
    [isDragging, columnId, minWidth, maxWidth, onResize]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
    return undefined;
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div
      onMouseDown={handleMouseDown}
      className={`
        absolute -right-1.5 top-0 h-full w-3 cursor-col-resize
        touch-none select-none
        group/resizer
        ${isDragging ? 'z-50' : 'z-10'}
      `}
      title="Resize column"
      aria-label="Resize column"
    >
      {/* Excel-like: grip sits exactly on the column boundary. */}
      <div
        className={[
          'absolute left-1/2 top-2 bottom-2 w-[2px] -translate-x-1/2 rounded-full transition-colors duration-150',
          // TRIADA_KANON B.38 — uchwyt resize to STAN UI, nie semantyka krytyczna,
          // więc nie może być crimsonem (`primary-*` = #85182F). Hover/drag na
          // niebieskim `--c-focus-solid` (ten sam sygnał co fokus klawiaturowy).
          isDragging
            ? 'bg-[color:var(--c-focus-solid)]'
            : 'bg-slate-300/80 dark:bg-white/[0.10] group-hover/resizer:bg-[color:var(--c-focus-solid)] dark:group-hover/resizer:bg-[color:var(--c-focus-solid)]',
        ].join(' ')}
      />
    </div>
  );
};

export default ColumnResizer;
