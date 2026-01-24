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
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div
      onMouseDown={handleMouseDown}
      className={`
        absolute right-0 top-0 h-full w-4 cursor-col-resize
        flex items-center justify-center
        group/resizer
        ${isDragging ? 'z-50' : 'z-10'}
      `}
    >
      {/* Visual handle - two vertical lines */}
      <div
        className={`
          h-4 w-0.5 rounded-full transition-all duration-150
          ${
            isDragging
              ? 'bg-primary-500 h-full w-1'
              : 'bg-slate-300 dark:bg-navy-500 group-hover/resizer:bg-primary-400 group-hover/resizer:h-6'
          }
        `}
      />
      <div
        className={`
          h-4 w-0.5 rounded-full ml-0.5 transition-all duration-150
          ${
            isDragging
              ? 'bg-primary-500 h-full w-1 opacity-0'
              : 'bg-slate-300 dark:bg-navy-500 group-hover/resizer:bg-primary-400 group-hover/resizer:h-6'
          }
        `}
      />
    </div>
  );
};

export default ColumnResizer;
