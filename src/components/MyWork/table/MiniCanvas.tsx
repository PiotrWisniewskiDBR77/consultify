/**
 * MiniCanvas — Lightweight SVG drawing canvas embeddable in row detail panels.
 *
 * Supports freehand drawing, basic shapes (rect, circle, arrow), color picker,
 * and undo. Inspired by Apple Freeform's simplicity.
 */
import {
  ArrowRight,
  Circle,
  Eraser,
  Minus,
  Pencil,
  Plus,
  Redo2,
  Square,
  Trash2,
  Undo2,
} from 'lucide-react';
import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ROW_ACCENT_COLORS } from './tableTypes';

interface Point {
  x: number;
  y: number;
}

interface DrawElement {
  id: string;
  type: 'path' | 'rect' | 'circle' | 'arrow';
  points: Point[];
  color: string;
  strokeWidth: number;
}

interface MiniCanvasProps {
  value: DrawElement[];
  onChange: (elements: DrawElement[]) => void;
  locked?: boolean;
  width?: number;
  height?: number;
}

type ToolType = 'pen' | 'rect' | 'circle' | 'arrow' | 'eraser';

// Drawing ink palette — categorical data colors from the token identity palette.
const STROKE_COLORS = [
  'var(--c-text)',
  'var(--c-tag-4)',
  'var(--c-tag-1)',
  'var(--c-tag-12)',
  'var(--c-tag-9)',
  'var(--c-tag-2)',
  'var(--c-tag-11)',
  'var(--c-tag-10)',
];

export const MiniCanvas: React.FC<MiniCanvasProps> = ({
  value = [],
  onChange,
  locked = false,
  width = 400,
  height = 250,
}) => {
  const { t } = useTranslation();

  const svgRef = useRef<SVGSVGElement>(null);
  const [tool, setTool] = useState<ToolType>('pen');
  const [color, setColor] = useState(STROKE_COLORS[0]);
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [drawing, setDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const [undoStack, setUndoStack] = useState<DrawElement[][]>([]);
  const [redoStack, setRedoStack] = useState<DrawElement[][]>([]);

  const getPoint = useCallback((e: React.MouseEvent<SVGSVGElement>): Point => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const handlePointerDown = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (locked) return;
      const pt = getPoint(e);

      if (tool === 'eraser') {
        const hitIdx = value.findIndex((el) => {
          return el.points.some((p) => Math.abs(p.x - pt.x) < 10 && Math.abs(p.y - pt.y) < 10);
        });
        if (hitIdx >= 0) {
          setUndoStack([...undoStack, value]);
          setRedoStack([]);
          const next = [...value];
          next.splice(hitIdx, 1);
          onChange(next);
        }
        return;
      }

      setDrawing(true);
      setCurrentPoints([pt]);
    },
    [getPoint, locked, onChange, tool, undoStack, value]
  );

  const handlePointerMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!drawing || locked) return;
      const pt = getPoint(e);
      setCurrentPoints((prev) => [...prev, pt]);
    },
    [drawing, getPoint, locked]
  );

  const handlePointerUp = useCallback(() => {
    if (!drawing || locked || currentPoints.length === 0) return;
    setDrawing(false);

    const drawType = tool === 'pen' ? 'path' : tool === 'eraser' ? 'path' : tool;
    const element: DrawElement = {
      id: `draw-${Date.now()}`,
      type: drawType as DrawElement['type'],
      points:
        tool === 'pen'
          ? currentPoints
          : [currentPoints[0], currentPoints[currentPoints.length - 1]],
      color,
      strokeWidth,
    };

    setUndoStack([...undoStack, value]);
    setRedoStack([]);
    onChange([...value, element]);
    setCurrentPoints([]);
  }, [color, currentPoints, drawing, locked, onChange, strokeWidth, tool, undoStack, value]);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack([...redoStack, value]);
    setUndoStack(undoStack.slice(0, -1));
    onChange(prev);
  }, [onChange, redoStack, undoStack, value]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack([...undoStack, value]);
    setRedoStack(redoStack.slice(0, -1));
    onChange(next);
  }, [onChange, redoStack, undoStack, value]);

  const handleClear = useCallback(() => {
    if (value.length === 0) return;
    setUndoStack([...undoStack, value]);
    setRedoStack([]);
    onChange([]);
  }, [onChange, undoStack, value]);

  const renderElement = (el: DrawElement) => {
    if (el.type === 'path' && el.points.length > 1) {
      const d = el.points.reduce(
        (acc, pt, i) => acc + (i === 0 ? `M ${pt.x} ${pt.y}` : ` L ${pt.x} ${pt.y}`),
        ''
      );
      return (
        <path
          key={el.id}
          d={d}
          fill="none"
          stroke={el.color}
          strokeWidth={el.strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    }
    if (el.type === 'rect' && el.points.length >= 2) {
      const [p1, p2] = el.points;
      return (
        <rect
          key={el.id}
          x={Math.min(p1.x, p2.x)}
          y={Math.min(p1.y, p2.y)}
          width={Math.abs(p2.x - p1.x)}
          height={Math.abs(p2.y - p1.y)}
          fill="none"
          stroke={el.color}
          strokeWidth={el.strokeWidth}
          rx={4}
        />
      );
    }
    if (el.type === 'circle' && el.points.length >= 2) {
      const [p1, p2] = el.points;
      const r = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
      return (
        <circle
          key={el.id}
          cx={p1.x}
          cy={p1.y}
          r={r}
          fill="none"
          stroke={el.color}
          strokeWidth={el.strokeWidth}
        />
      );
    }
    if (el.type === 'arrow' && el.points.length >= 2) {
      const [p1, p2] = el.points;
      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      const headLen = 10;
      return (
        <g key={el.id}>
          <line
            x1={p1.x}
            y1={p1.y}
            x2={p2.x}
            y2={p2.y}
            stroke={el.color}
            strokeWidth={el.strokeWidth}
          />
          <line
            x1={p2.x}
            y1={p2.y}
            x2={p2.x - headLen * Math.cos(angle - Math.PI / 6)}
            y2={p2.y - headLen * Math.sin(angle - Math.PI / 6)}
            stroke={el.color}
            strokeWidth={el.strokeWidth}
          />
          <line
            x1={p2.x}
            y1={p2.y}
            x2={p2.x - headLen * Math.cos(angle + Math.PI / 6)}
            y2={p2.y - headLen * Math.sin(angle + Math.PI / 6)}
            stroke={el.color}
            strokeWidth={el.strokeWidth}
          />
        </g>
      );
    }
    return null;
  };

  const renderCurrentStroke = () => {
    if (!drawing || currentPoints.length < 2) return null;
    if (tool === 'pen') {
      const d = currentPoints.reduce(
        (acc, pt, i) => acc + (i === 0 ? `M ${pt.x} ${pt.y}` : ` L ${pt.x} ${pt.y}`),
        ''
      );
      return (
        <path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.6}
        />
      );
    }
    const [p1] = currentPoints;
    const p2 = currentPoints[currentPoints.length - 1];
    if (tool === 'rect')
      return (
        <rect
          x={Math.min(p1.x, p2.x)}
          y={Math.min(p1.y, p2.y)}
          width={Math.abs(p2.x - p1.x)}
          height={Math.abs(p2.y - p1.y)}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          rx={4}
          opacity={0.6}
        />
      );
    if (tool === 'circle') {
      const r = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
      return (
        <circle
          cx={p1.x}
          cy={p1.y}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          opacity={0.6}
        />
      );
    }
    if (tool === 'arrow')
      return (
        <line
          x1={p1.x}
          y1={p1.y}
          x2={p2.x}
          y2={p2.y}
          stroke={color}
          strokeWidth={strokeWidth}
          opacity={0.6}
        />
      );
    return null;
  };

  const TOOLS: {
    id: ToolType;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    label: string;
  }[] = [
    { id: 'pen', icon: Pencil, label: t('ideas.table.canvasTool.pen', 'Pen') },
    { id: 'rect', icon: Square, label: t('ideas.table.canvasTool.rect', 'Rectangle') },
    { id: 'circle', icon: Circle, label: t('ideas.table.canvasTool.circle', 'Circle') },
    { id: 'arrow', icon: ArrowRight, label: t('ideas.table.canvasTool.arrow', 'Arrow') },
    { id: 'eraser', icon: Eraser, label: t('ideas.table.canvasTool.eraser', 'Eraser') },
  ];

  return (
    <div className="rounded-2xl border border-slate-200/60 dark:border-white/[0.03] overflow-hidden bg-c-surface">
      {/* Toolbar */}
      {!locked && (
        <div className="flex items-center gap-1 px-3 py-2 border-b border-c-border-subtle bg-c-surface-raised">
          {TOOLS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTool(t.id)}
                className={`p-1.5 rounded-lg transition-colors ${tool === t.id ? 'bg-c-accent-soft text-c-accent' : 'text-c-text-muted hover:text-c-text-secondary'}`}
                title={t.label}
              >
                <Icon size={13} />
              </button>
            );
          })}

          <div className="w-px h-4 bg-c-border-subtle mx-1" />

          {/* Colors */}
          <div className="flex items-center gap-0.5">
            {STROKE_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-4 h-4 rounded-full border-2 transition-transform hover:scale-110 ${color === c ? 'border-c-border-strong scale-110' : 'border-transparent'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          <div className="w-px h-4 bg-c-border-subtle mx-1" />

          {/* Stroke width */}
          <button
            onClick={() => setStrokeWidth(Math.max(1, strokeWidth - 1))}
            className="p-1 rounded text-c-text-muted hover:text-c-text-secondary"
          >
            <Minus size={11} />
          </button>
          <span className="text-[9px] text-c-text-muted w-4 text-center">{strokeWidth}</span>
          <button
            onClick={() => setStrokeWidth(Math.min(8, strokeWidth + 1))}
            className="p-1 rounded text-c-text-muted hover:text-c-text-secondary"
          >
            <Plus size={11} />
          </button>

          <div className="flex-1" />

          <button
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            className="p-1 rounded text-c-text-muted hover:text-c-text-secondary disabled:opacity-30"
          >
            <Undo2 size={12} />
          </button>
          <button
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            className="p-1 rounded text-c-text-muted hover:text-c-text-secondary disabled:opacity-30"
          >
            <Redo2 size={12} />
          </button>
          <button
            onClick={handleClear}
            disabled={value.length === 0}
            className="p-1 rounded text-c-text-muted hover:text-c-danger disabled:opacity-30"
          >
            <Trash2 size={12} />
          </button>
        </div>
      )}

      {/* Canvas */}
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="cursor-crosshair bg-c-surface"
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
      >
        {/* Grid dots */}
        <defs>
          <pattern id="mini-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.5" fill="var(--c-border-subtle)" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#mini-grid)" />

        {value.map(renderElement)}
        {renderCurrentStroke()}
      </svg>
    </div>
  );
};

export default MiniCanvas;
