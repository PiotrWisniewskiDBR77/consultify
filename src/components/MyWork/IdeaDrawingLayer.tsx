/**
 * IdeaDrawingLayer — SVG drawing overlay for the whiteboard canvas.
 *
 * Supports: pen tool, highlighter, eraser, color picker, stroke width.
 * Drawings are stored as SVG path data in the graph extensions.
 */
import {
  Circle,
  Eraser,
  Highlighter,
  Keyboard,
  Minus,
  Pen,
  Plus,
  Redo2,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface DrawingPath {
  id: string;
  d: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  tool: 'pen' | 'highlighter';
}

export interface IdeaDrawingLayerProps {
  active: boolean;
  onClose: () => void;
  paths: DrawingPath[];
  onPathsChange: (paths: DrawingPath[]) => void;
  viewportTransform?: { x: number; y: number; zoom: number };
}

const COLORS = [
  '#1e293b',
  '#f43f5e',
  '#f59e0b',
  '#eab308',
  '#22c55e',
  '#3b82f6',
  '#6366f1',
  '#ec4899',
  '#3b82f6',
  '#ffffff',
];

const MIN_STROKE = 1;
const MAX_STROKE = 12;

// P1.5 (WB-P1-04) — keyboard drawing mode step size, in canvas units.
// Plain arrow key = fine movement; Shift+arrow = coarse movement, so a
// keyboard-only user can both sketch detail and cover distance quickly.
const KB_STEP = 10;
const KB_STEP_LARGE = 36;

type DrawTool = 'pen' | 'highlighter' | 'eraser';

export const IdeaDrawingLayer: React.FC<IdeaDrawingLayerProps> = ({
  active,
  onClose,
  paths,
  onPathsChange,
  viewportTransform,
}) => {
  const { t } = useTranslation();
  const svgRef = useRef<SVGSVGElement>(null);

  const [tool, setTool] = useState<DrawTool>('pen');
  const [color, setColor] = useState('#1e293b');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [drawing, setDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState('');
  const [undoStack, setUndoStack] = useState<DrawingPath[][]>([]);
  const [redoStack, setRedoStack] = useState<DrawingPath[][]>([]);

  // P1.5 (WB-P1-04) — keyboard drawing mode state. Freehand drawing was
  // pointer-drag-only, which fails "core work possible without raw-coordinate
  // drag" (doc 09 §11.7 / doc 11 DoD §3.8). This lets a keyboard-only user
  // move a cursor with the arrow keys, toggle the pen with Space/Enter, and
  // finish the stroke with Escape — no mouse or scripted coordinates needed.
  const [kbKeyboardActive, setKbKeyboardActive] = useState(false);
  const [kbCursor, setKbCursor] = useState({ x: 0, y: 0 });
  const [kbPenDown, setKbPenDown] = useState(false);
  const [kbAnnouncement, setKbAnnouncement] = useState('');

  const screenToCanvas = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };
      const rect = svg.getBoundingClientRect();
      const sx = clientX - rect.left;
      const sy = clientY - rect.top;
      if (!viewportTransform) return { x: sx, y: sy };
      const { x: vx, y: vy, zoom } = viewportTransform;
      return { x: (sx - vx) / zoom, y: (sy - vy) / zoom };
    },
    [viewportTransform]
  );

  const startDrawing = useCallback(
    (e: React.PointerEvent) => {
      if (!active) return;
      const svg = svgRef.current;
      if (!svg) return;
      const { x, y } = screenToCanvas(e.clientX, e.clientY);

      if (tool === 'eraser') {
        const target = e.target as SVGElement;
        const pathId = target.getAttribute('data-path-id');
        if (pathId) {
          setUndoStack((prev) => [...prev, paths]);
          setRedoStack([]);
          onPathsChange(paths.filter((p) => p.id !== pathId));
        }
        return;
      }

      setDrawing(true);
      setCurrentPath(`M ${x} ${y}`);
      svg.setPointerCapture(e.pointerId);
    },
    [active, onPathsChange, paths, screenToCanvas, tool]
  );

  const continueDrawing = useCallback(
    (e: React.PointerEvent) => {
      if (!drawing || !active) return;
      const { x, y } = screenToCanvas(e.clientX, e.clientY);
      setCurrentPath((prev) => `${prev} L ${x} ${y}`);
    },
    [active, drawing, screenToCanvas]
  );

  // Shared commit path for both pointer-drawn and keyboard-drawn strokes —
  // one place that builds the DrawingPath and pushes undo history, so the
  // two input methods stay behaviourally identical (same undo/redo, same
  // persistence). Returns whether a stroke was actually committed (a stroke
  // shorter than the minimum is discarded, same threshold as before).
  const commitPath = useCallback(
    (pathD: string) => {
      if (pathD.length < 10) return false;
      const newPath: DrawingPath = {
        id: `draw-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        d: pathD,
        stroke: color,
        strokeWidth,
        opacity: tool === 'highlighter' ? 0.35 : 1,
        tool: tool as 'pen' | 'highlighter',
      };

      setUndoStack((prev) => [...prev, paths]);
      setRedoStack([]);
      onPathsChange([...paths, newPath]);
      return true;
    },
    [color, onPathsChange, paths, strokeWidth, tool]
  );

  const endDrawing = useCallback(
    (e: React.PointerEvent) => {
      if (!drawing || !active) return;
      setDrawing(false);
      commitPath(currentPath);
      setCurrentPath('');
    },
    [active, commitPath, currentPath, drawing]
  );

  // ── Keyboard drawing mode (P1.5 / WB-P1-04) ────────────────────────────
  const screenCenterToCanvas = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return screenToCanvas(rect.left + rect.width / 2, rect.top + rect.height / 2);
  }, [screenToCanvas]);

  // Idempotent: repeated arrow-key presses call this every time, but the
  // cursor should only re-centre and the mode-entered announcement should
  // only fire on the FIRST activation. Returns the cursor position to use
  // RIGHT NOW — callers that need the position synchronously (e.g. starting
  // a stroke on the very first keypress, before any state update has
  // flushed) must use the return value, not the `kbCursor` state variable.
  const ensureKeyboardMode = useCallback((): { x: number; y: number } => {
    if (kbKeyboardActive) return kbCursor;
    const center = screenCenterToCanvas();
    setKbCursor(center);
    setKbKeyboardActive(true);
    setKbAnnouncement(t('myWorkIdeas.drawingLayer.kbModeEntered'));
    return center;
  }, [kbCursor, kbKeyboardActive, screenCenterToCanvas, t]);

  const focusAndActivateKeyboardMode = useCallback(() => {
    ensureKeyboardMode();
    svgRef.current?.focus();
  }, [ensureKeyboardMode]);

  const moveKeyboardCursor = useCallback(
    (dx: number, dy: number) => {
      setKbCursor((prev) => {
        const next = { x: prev.x + dx, y: prev.y + dy };
        if (kbPenDown) {
          setCurrentPath((p) => `${p} L ${next.x} ${next.y}`);
        }
        return next;
      });
    },
    [kbPenDown]
  );

  const startKeyboardStroke = useCallback(
    (at: { x: number; y: number }) => {
      setCurrentPath(`M ${at.x} ${at.y}`);
      setKbPenDown(true);
      setKbAnnouncement(t('myWorkIdeas.drawingLayer.kbPenDown'));
    },
    [t]
  );

  const liftKeyboardPen = useCallback(() => {
    setKbPenDown(false);
    setKbAnnouncement(t('myWorkIdeas.drawingLayer.kbPenUp'));
  }, [t]);

  const finishKeyboardStroke = useCallback(() => {
    const committed = commitPath(currentPath);
    setCurrentPath('');
    setKbPenDown(false);
    setKbAnnouncement(
      t(
        committed
          ? 'myWorkIdeas.drawingLayer.kbStrokeCompleted'
          : 'myWorkIdeas.drawingLayer.kbStrokeDiscarded'
      )
    );
  }, [commitPath, currentPath, t]);

  const handleCanvasFocus = useCallback(() => {
    ensureKeyboardMode();
  }, [ensureKeyboardMode]);

  const handleCanvasKeyDown = useCallback(
    (e: React.KeyboardEvent<SVGSVGElement>) => {
      if (!active || tool === 'eraser') return;
      const step = e.shiftKey ? KB_STEP_LARGE : KB_STEP;
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          ensureKeyboardMode();
          moveKeyboardCursor(0, -step);
          break;
        case 'ArrowDown':
          e.preventDefault();
          ensureKeyboardMode();
          moveKeyboardCursor(0, step);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          ensureKeyboardMode();
          moveKeyboardCursor(-step, 0);
          break;
        case 'ArrowRight':
          e.preventDefault();
          ensureKeyboardMode();
          moveKeyboardCursor(step, 0);
          break;
        case ' ':
        case 'Enter': {
          e.preventDefault();
          const at = ensureKeyboardMode();
          if (kbPenDown) liftKeyboardPen();
          else startKeyboardStroke(at);
          break;
        }
        case 'Escape':
          if (currentPath) {
            e.preventDefault();
            e.stopPropagation();
            finishKeyboardStroke();
          }
          break;
        default:
          break;
      }
    },
    [
      active,
      currentPath,
      ensureKeyboardMode,
      finishKeyboardStroke,
      kbPenDown,
      liftKeyboardPen,
      moveKeyboardCursor,
      startKeyboardStroke,
      tool,
    ]
  );

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack((r) => [...r, paths]);
    setUndoStack((u) => u.slice(0, -1));
    onPathsChange(prev);
  }, [onPathsChange, paths, undoStack]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((u) => [...u, paths]);
    setRedoStack((r) => r.slice(0, -1));
    onPathsChange(next);
  }, [onPathsChange, paths, redoStack]);

  const handleClear = useCallback(() => {
    if (paths.length === 0) return;
    setUndoStack((prev) => [...prev, paths]);
    setRedoStack([]);
    onPathsChange([]);
  }, [onPathsChange, paths]);

  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [active, handleRedo, handleUndo, onClose]);

  const vpTransformStr = viewportTransform
    ? `translate(${viewportTransform.x}, ${viewportTransform.y}) scale(${viewportTransform.zoom})`
    : undefined;

  if (!active) {
    if (paths.length === 0) return null;
    return (
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-[5]">
        <g transform={vpTransformStr}>
          {paths.map((p) => (
            <path
              key={p.id}
              d={p.d}
              fill="none"
              stroke={p.stroke}
              strokeWidth={p.strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={p.opacity}
            />
          ))}
        </g>
      </svg>
    );
  }

  return (
    <div className="absolute inset-0 z-[70]">
      {/* Drawing SVG */}
      <svg
        ref={svgRef}
        className={`absolute inset-0 w-full h-full ${tool === 'eraser' ? 'cursor-crosshair' : 'cursor-crosshair'} focus-visible:outline focus-visible:outline-2 focus-visible:outline-c-focus focus-visible:-outline-offset-2`}
        onPointerDown={startDrawing}
        onPointerMove={continueDrawing}
        onPointerUp={endDrawing}
        // Naprawa 2026-07-26 (Zadanie C — prawy klik w trybie Rysuj pokazywał
        // natywne menu przeglądarki): ta warstwa SVG leży NA WIERZCHU płótna
        // (z-[70]) tylko w trybie draw i przechwytuje wszystkie zdarzenia
        // wskaźnika — w tym prawy klik — zanim dotrą do `onPaneContextMenu`
        // React Flow niżej. Brakowało tu analogicznego `preventDefault()`.
        onContextMenu={(e) => e.preventDefault()}
        style={{ touchAction: 'none' }}
        // P1.5 (WB-P1-04) — keyboard drawing mode: focusable canvas, arrow
        // keys move a virtual cursor, Space/Enter toggles the pen, Escape
        // commits the stroke. See handleCanvasKeyDown.
        tabIndex={tool === 'eraser' ? -1 : 0}
        role="application"
        aria-roledescription={t('myWorkIdeas.drawingLayer.kbCanvasRole')}
        aria-label={t('myWorkIdeas.drawingLayer.kbCanvasLabel')}
        aria-describedby="wb-draw-kb-instructions"
        onFocus={handleCanvasFocus}
        onKeyDown={handleCanvasKeyDown}
      >
        <g transform={vpTransformStr}>
          {/* Existing paths */}
          {paths.map((p) => {
            const hitWidth = Math.max(p.strokeWidth + 20, 24);
            return (
              <g key={p.id}>
                {tool === 'eraser' && (
                  <path
                    data-path-id={p.id}
                    d={p.d}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={hitWidth}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="cursor-pointer"
                  />
                )}
                <path
                  data-path-id={p.id}
                  d={p.d}
                  fill="none"
                  stroke={p.stroke}
                  strokeWidth={tool === 'eraser' ? p.strokeWidth + 4 : p.strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={p.opacity}
                  className={tool === 'eraser' ? 'pointer-events-none' : ''}
                />
              </g>
            );
          })}
          {/* Current drawing path */}
          {currentPath && (
            <path
              d={currentPath}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={tool === 'highlighter' ? 0.35 : 1}
            />
          )}
          {/* Keyboard cursor (P1.5 / WB-P1-04) — visible position + pen
              state for sighted keyboard-only users; screen readers get the
              same state via the aria-live announcement below. */}
          {kbKeyboardActive && tool !== 'eraser' && (
            <circle
              cx={kbCursor.x}
              cy={kbCursor.y}
              r={Math.max(6, strokeWidth + 4)}
              fill={kbPenDown ? color : 'none'}
              fillOpacity={kbPenDown ? 0.35 : 0}
              stroke={kbPenDown ? color : '#3b82f6'}
              strokeWidth={2}
              strokeDasharray={kbPenDown ? undefined : '3 3'}
              aria-hidden="true"
            />
          )}
        </g>
      </svg>

      {/* Screen-reader instructions + live status (P1.5 / WB-P1-04) */}
      <p id="wb-draw-kb-instructions" className="sr-only">
        {t('myWorkIdeas.drawingLayer.kbInstructions')}
      </p>
      <div role="status" aria-live="polite" className="sr-only">
        {kbAnnouncement}
      </div>

      {/* Toolbar */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[75]">
        <div className="flex items-center gap-1 bg-white/95 dark:bg-navy-900/95 backdrop-blur-md rounded-2xl border border-slate-200/70 dark:border-navy-600/60 shadow-xl shadow-slate-300/20 dark:shadow-navy-950/50 px-3 py-2">
          {/* Tool selection */}
          <ToolBtn
            active={tool === 'pen'}
            onClick={() => setTool('pen')}
            icon={Pen}
            label={t('myWorkIdeas.drawingLayer.pen')}
          />
          <ToolBtn
            active={tool === 'highlighter'}
            onClick={() => setTool('highlighter')}
            icon={Highlighter}
            label={t('myWorkIdeas.drawingLayer.highlighter')}
          />
          <ToolBtn
            active={tool === 'eraser'}
            onClick={() => setTool('eraser')}
            icon={Eraser}
            label={t('myWorkIdeas.drawingLayer.eraser')}
          />

          <div className="w-px h-6 bg-slate-200 dark:bg-navy-700 mx-1" />

          {/* P1.5 (WB-P1-04) — accessible entry point into keyboard drawing
              mode: focuses the canvas and shows the keyboard cursor, so a
              user who cannot drag a pointer can still create a stroke. */}
          <button
            onClick={focusAndActivateKeyboardMode}
            disabled={tool === 'eraser'}
            aria-label={t('myWorkIdeas.drawingLayer.kbToggleLabel')}
            title={t('myWorkIdeas.drawingLayer.kbToggleLabel')}
            className={`p-1.5 rounded-lg transition-all disabled:opacity-30 ${
              kbKeyboardActive
                ? 'bg-c-info/10 text-c-info'
                : 'text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800'
            }`}
          >
            <Keyboard size={14} />
          </button>
          {kbKeyboardActive && (
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 px-1 whitespace-nowrap">
              {kbPenDown
                ? t('myWorkIdeas.drawingLayer.kbStatusPenDown')
                : t('myWorkIdeas.drawingLayer.kbStatusPenUp')}
            </span>
          )}

          <div className="w-px h-6 bg-slate-200 dark:bg-navy-700 mx-1" />

          {/* Color picker */}
          <div className="flex items-center gap-0.5">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                aria-label={`${t('myWorkIdeas.drawingLayer.color')} ${c}`}
                aria-pressed={color === c}
                title={c}
                className={`w-4 h-4 rounded-full border transition-all ${
                  color === c
                    ? 'ring-2 ring-c-info ring-offset-1 scale-110'
                    : 'border-slate-300 dark:border-navy-600'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          <div className="w-px h-6 bg-slate-200 dark:bg-navy-700 mx-1" />

          {/* Stroke width */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setStrokeWidth(Math.max(MIN_STROKE, strokeWidth - 1))}
              aria-label={t('myWorkIdeas.drawingLayer.decreaseStrokeWidth')}
              title={t('myWorkIdeas.drawingLayer.decreaseStrokeWidth')}
              className="p-1 text-slate-600 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <Minus size={10} />
            </button>
            <div className="flex items-center justify-center w-6">
              <Circle
                size={Math.max(4, Math.min(14, strokeWidth * 2))}
                className="text-slate-600 dark:text-slate-400 fill-current"
              />
            </div>
            <button
              onClick={() => setStrokeWidth(Math.min(MAX_STROKE, strokeWidth + 1))}
              aria-label={t('myWorkIdeas.drawingLayer.increaseStrokeWidth')}
              title={t('myWorkIdeas.drawingLayer.increaseStrokeWidth')}
              className="p-1 text-slate-600 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <Plus size={10} />
            </button>
          </div>

          <div className="w-px h-6 bg-slate-200 dark:bg-navy-700 mx-1" />

          {/* Undo/Redo/Clear */}
          <button
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            aria-label={t('myWorkIdeas.drawingLayer.undo')}
            title={t('myWorkIdeas.drawingLayer.undo')}
            className="p-1.5 text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-30"
          >
            <Undo2 size={14} />
          </button>
          <button
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            aria-label={t('myWorkIdeas.drawingLayer.redo')}
            title={t('myWorkIdeas.drawingLayer.redo')}
            className="p-1.5 text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-30"
          >
            <Redo2 size={14} />
          </button>
          <button
            onClick={handleClear}
            disabled={paths.length === 0}
            aria-label={t('myWorkIdeas.drawingLayer.clearDrawing')}
            title={t('myWorkIdeas.drawingLayer.clearDrawing')}
            className="p-1.5 text-slate-600 hover:text-danger-500 disabled:opacity-30"
          >
            <Trash2 size={14} />
          </button>

          <div className="w-px h-6 bg-slate-200 dark:bg-navy-700 mx-1" />

          <button
            onClick={onClose}
            aria-label={t('myWorkIdeas.drawingLayer.closeDrawing')}
            title={t('myWorkIdeas.drawingLayer.close')}
            className="p-1.5 text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

const ToolBtn: React.FC<{
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ size?: number }>;
  label: string;
}> = ({ active, onClick, icon: Icon, label }) => (
  <button
    onClick={onClick}
    aria-label={label}
    aria-pressed={active}
    className={`p-1.5 rounded-lg transition-all ${
      active
        ? 'bg-c-info/10 text-c-info'
        : 'text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800'
    }`}
    title={label}
  >
    <Icon size={14} />
  </button>
);

export default IdeaDrawingLayer;
