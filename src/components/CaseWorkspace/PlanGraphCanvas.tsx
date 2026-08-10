/**
 * Plan Ekspercki — płótno przepływu. REALNIE interaktywne.
 *
 * WARUNEK WŁAŚCICIELA #3: przeciąganie (pan), przybliżanie (zoom kółkiem i
 * przyciskami), „Dopasuj do ekranu", czytelny kierunek przepływu (strzałki),
 * ZERO ucinania węzłów. Alternatywa „Lista" jest dostępna zawsze — ten
 * komponent nigdy nie jest jedyną drogą do treści planu.
 *
 * To NIE jest ekran listowy, więc nie przechodzi przez `StandardTable` —
 * kanon list dotyczy list. Płótno jest centrum archetypu Canvas (SPEC-A):
 * powłoka, pasek i podgląd zostają wspólne, zmienia się tylko środek.
 *
 * Świadomie bez `reactflow`: potrzebny jest odczyt (pan/zoom/fit/wybór węzła),
 * nie edytor. Własne SVG to ~1 plik zamiast dodatkowego drzewa zależności,
 * które w tym repo już raz rozjechało się na dwóch kopiach zustanda.
 *
 * DOSTĘPNOŚĆ: płótno jest fokusowalne (Tab), obsługuje strzałki (przesuwanie),
 * `+`/`-` (zoom), `0` (dopasuj). Każdy węzeł jest osobnym przyciskiem w
 * kolejności Tab, więc klawiatura dociera do wszystkich kroków bez myszy.
 */

import { Crosshair, Maximize2, Minus, Plus } from 'lucide-react';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { planEdgeTypeLabel, planNodeTypeLabel } from '@/utils/enumLabels';

import type { CanonicalGraph, GraphEdge, GraphNode } from './types';
import { FOCUS_RING } from './ui';

const NODE_W = 236;
const NODE_H = 92;
// Odstęp poziomy musi pomieścić opis strzałki („Gdy warunek spełniony"),
// inaczej etykieta wpada pod następny węzeł i wygląda jak usterka renderowania
// — dokładnie to pokazał pierwszy zrzut kontrolny.
const GAP_X = 150;
const GAP_Y = 28;
const PADDING = 48;

export interface PositionedNode {
  node: GraphNode;
  x: number;
  y: number;
  label: string;
  typeLabel: string;
}

/** Etykieta biznesowa węzła — nigdy surowy `nodeId` jako główna treść. */
export function nodeLabel(node: GraphNode): string {
  const meta = node.metadata ?? {};
  const candidate =
    (typeof meta.label === 'string' && meta.label) ||
    (typeof meta.name === 'string' && meta.name) ||
    (typeof meta.title === 'string' && meta.title) ||
    (typeof (node as { label?: unknown }).label === 'string' &&
      ((node as { label?: string }).label as string)) ||
    '';
  if (candidate.trim()) return candidate.trim();
  // Brak nazwy biznesowej w danych: mówimy to wprost po polsku i dopiero w
  // widoku eksperckim pokazujemy identyfikator obok (TechnicalId), zamiast
  // podstawiać surowy klucz jako nazwę kroku.
  return 'Krok bez nazwy';
}

/**
 * Układ warstwowy: warstwa = najdłuższa ścieżka od węzła wejściowego.
 * Cykle (graf nie musi być drzewem) są przycinane licznikiem odwiedzin, więc
 * funkcja zawsze się kończy, nawet dla planu z pętlą ponowienia.
 */
export function layoutGraph(graph: CanonicalGraph): {
  nodes: PositionedNode[];
  width: number;
  height: number;
} {
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph?.edges) ? graph.edges : [];
  if (!nodes.length) return { nodes: [], width: 0, height: 0 };

  const outgoing = new Map<string, string[]>();
  const indegree = new Map<string, number>();
  for (const node of nodes) indegree.set(node.nodeId, 0);
  for (const edge of edges) {
    if (!indegree.has(edge.targetNodeId) || !indegree.has(edge.sourceNodeId)) continue;
    outgoing.set(edge.sourceNodeId, [
      ...(outgoing.get(edge.sourceNodeId) ?? []),
      edge.targetNodeId,
    ]);
    indegree.set(edge.targetNodeId, (indegree.get(edge.targetNodeId) ?? 0) + 1);
  }

  const entries = (
    Array.isArray(graph.entryNodeIds) && graph.entryNodeIds.length
      ? graph.entryNodeIds
      : nodes.filter((n) => (indegree.get(n.nodeId) ?? 0) === 0).map((n) => n.nodeId)
  ).filter((id) => indegree.has(id));
  const roots = entries.length ? entries : [nodes[0].nodeId];

  const layer = new Map<string, number>();
  const visits = new Map<string, number>();
  const stack: Array<{ id: string; depth: number }> = roots.map((id) => ({ id, depth: 0 }));
  while (stack.length) {
    const current = stack.pop()!;
    const seen = visits.get(current.id) ?? 0;
    if (seen > nodes.length) continue; // zabezpieczenie przed cyklem
    visits.set(current.id, seen + 1);
    const known = layer.get(current.id);
    if (known !== undefined && known >= current.depth) continue;
    layer.set(current.id, current.depth);
    for (const next of outgoing.get(current.id) ?? []) {
      stack.push({ id: next, depth: current.depth + 1 });
    }
  }
  // Węzły nieosiągalne z wejścia i tak muszą być widoczne — inaczej plan
  // „gubi" kroki, a użytkownik nie ma jak się dowiedzieć, że istnieją.
  let orphanLayer = 0;
  for (const node of nodes) {
    if (!layer.has(node.nodeId)) {
      layer.set(node.nodeId, orphanLayer);
      orphanLayer += 1;
    }
  }

  const byLayer = new Map<number, GraphNode[]>();
  for (const node of nodes) {
    const l = layer.get(node.nodeId) ?? 0;
    byLayer.set(l, [...(byLayer.get(l) ?? []), node]);
  }

  const layerKeys = [...byLayer.keys()].sort((a, b) => a - b);
  const tallest = Math.max(...layerKeys.map((k) => byLayer.get(k)!.length), 1);
  const height = tallest * NODE_H + (tallest - 1) * GAP_Y;

  const positioned: PositionedNode[] = [];
  layerKeys.forEach((key, columnIndex) => {
    const column = byLayer.get(key)!;
    const columnHeight = column.length * NODE_H + (column.length - 1) * GAP_Y;
    const offsetY = (height - columnHeight) / 2;
    column.forEach((node, rowIndex) => {
      positioned.push({
        node,
        x: columnIndex * (NODE_W + GAP_X),
        y: offsetY + rowIndex * (NODE_H + GAP_Y),
        label: nodeLabel(node),
        typeLabel: planNodeTypeLabel(String(node.type ?? ''), true),
      });
    });
  });

  const width = layerKeys.length * NODE_W + Math.max(0, layerKeys.length - 1) * GAP_X;
  return { nodes: positioned, width, height };
}

export interface PlanGraphCanvasProps {
  graph: CanonicalGraph;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
  /** Nakładka stanów wykonania (Realizacja) — nieobecny klucz = brak stanu. */
  runtimeStateByNodeId?: Record<
    string,
    { label: string; tone: 'active' | 'waiting' | 'blocked' | 'done' }
  >;
}

export const PlanGraphCanvas: React.FC<PlanGraphCanvasProps> = ({
  graph,
  selectedNodeId,
  onSelectNode,
  runtimeStateByNodeId,
}) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [transform, setTransform] = useState({ k: 1, x: 0, y: 0 });
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const didInitialFit = useRef(false);

  const layout = useMemo(() => layoutGraph(graph), [graph]);
  const edges: GraphEdge[] = useMemo(
    () => (Array.isArray(graph?.edges) ? graph.edges : []),
    [graph]
  );
  const positionById = useMemo(() => {
    const map = new Map<string, PositionedNode>();
    for (const item of layout.nodes) map.set(item.node.nodeId, item);
    return map;
  }, [layout]);

  useLayoutEffect(() => {
    const element = wrapperRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => {
      setViewport({ width: element.clientWidth, height: element.clientHeight });
    });
    observer.observe(element);
    setViewport({ width: element.clientWidth, height: element.clientHeight });
    return () => observer.disconnect();
  }, []);

  /**
   * „Dopasuj do ekranu": skala liczona z PEŁNEGO prostokąta treści powiększonego
   * o margines, więc żaden węzeł nie może zostać ucięty na krawędzi — to był
   * jawny warunek odbioru.
   */
  const fitToView = useCallback(() => {
    const contentW = layout.width + PADDING * 2;
    const contentH = layout.height + PADDING * 2;
    if (!viewport.width || !viewport.height || !contentW || !contentH) return;
    const k = Math.min(viewport.width / contentW, viewport.height / contentH, 1);
    const x = (viewport.width - layout.width * k) / 2;
    const y = (viewport.height - layout.height * k) / 2;
    setTransform({ k, x, y });
  }, [layout.width, layout.height, viewport.width, viewport.height]);

  useEffect(() => {
    if (didInitialFit.current) return;
    if (!viewport.width || !layout.nodes.length) return;
    didInitialFit.current = true;
    fitToView();
  }, [fitToView, viewport.width, layout.nodes.length]);

  const zoomBy = useCallback(
    (factor: number, centerX?: number, centerY?: number) => {
      setTransform((prev) => {
        const k = Math.min(2.5, Math.max(0.2, prev.k * factor));
        const cx = centerX ?? viewport.width / 2;
        const cy = centerY ?? viewport.height / 2;
        // Zoom zakotwiczony w punkcie: to, co jest pod kursorem, zostaje pod kursorem.
        const x = cx - ((cx - prev.x) / prev.k) * k;
        const y = cy - ((cy - prev.y) / prev.k) * k;
        return { k, x, y };
      });
    },
    [viewport.width, viewport.height]
  );

  /*
   * Kółko myszy obsługuje WYŁĄCZNIE natywny listener poniżej — świadomie BEZ
   * Reactowego `onWheel`.
   *
   * ★ ZMIERZONE NA ŻYWYM PŁÓTNIE (nie z lektury kodu): dopóki oba handlery
   * istniały naraz, jeden obrót kółka wywoływał zoom DWA razy
   * (0,510 → 0,571 → 0,639; wskaźnik skakał 51% → 64% zamiast 51% → 57%),
   * a React montuje `wheel` jako listener PASYWNY, więc jego
   * `event.preventDefault()` tylko wypisywał do konsoli
   * „Unable to preventDefault inside passive event listener invocation"
   * i NIE blokował przewijania strony. Jeden listener = jedna reguła.
   */
  useEffect(() => {
    const element = wrapperRef.current;
    if (!element) return undefined;
    const handler = (event: WheelEvent) => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      zoomBy(
        event.deltaY < 0 ? 1.12 : 1 / 1.12,
        event.clientX - rect.left,
        event.clientY - rect.top
      );
    };
    element.addEventListener('wheel', handler, { passive: false });
    return () => element.removeEventListener('wheel', handler);
  }, [zoomBy]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest('[data-plan-node]')) return; // klik w węzeł = wybór, nie przeciąganie
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: transform.x,
      originY: transform.y,
    };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setTransform((prev) => ({
      ...prev,
      x: drag.originX + (event.clientX - drag.startX),
      y: drag.originY + (event.clientY - drag.startY),
    }));
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
      try {
        (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
      } catch {
        /* wskaźnik mógł już zniknąć (dotyk) */
      }
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = 60;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setTransform((p) => ({ ...p, x: p.x + step }));
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      setTransform((p) => ({ ...p, x: p.x - step }));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setTransform((p) => ({ ...p, y: p.y + step }));
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setTransform((p) => ({ ...p, y: p.y - step }));
    } else if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      zoomBy(1.2);
    } else if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      zoomBy(1 / 1.2);
    } else if (event.key === '0') {
      event.preventDefault();
      fitToView();
    }
  };

  if (!layout.nodes.length) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-c-border bg-c-surface p-8 text-center text-sm text-c-text-muted">
        Ten plan nie ma jeszcze żadnych kroków.
      </div>
    );
  }

  return (
    <div className="relative h-full min-w-0 overflow-hidden rounded-xl border border-c-border bg-c-surface">
      <div
        ref={wrapperRef}
        role="application"
        aria-label="Plan zlecenia — płótno przepływu. Przeciągaj myszą, przybliżaj kółkiem, klawisze: strzałki przesuwają, plus i minus przybliżają, zero dopasowuje widok."
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        data-testid="plan-plotno"
        className={`h-full w-full cursor-grab touch-none active:cursor-grabbing ${FOCUS_RING}`}
      >
        <svg width="100%" height="100%" aria-hidden={false} role="presentation">
          <defs>
            <marker
              id="zlecenia-strzalka"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" className="fill-c-text-muted" />
            </marker>
            <pattern id="zlecenia-siatka" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" className="fill-c-border" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#zlecenia-siatka)" opacity="0.5" />
          <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.k})`}>
            {edges.map((edge) => {
              const from = positionById.get(edge.sourceNodeId);
              const to = positionById.get(edge.targetNodeId);
              if (!from || !to) return null;
              const x1 = from.x + NODE_W;
              const y1 = from.y + NODE_H / 2;
              const x2 = to.x;
              const y2 = to.y + NODE_H / 2;
              const dx = Math.max(40, Math.abs(x2 - x1) / 2);
              const kind = String(edge.edgeType ?? edge.type ?? 'SEQUENCE').toUpperCase();
              const dashed = kind !== 'SEQUENCE';
              return (
                <g key={edge.edgeId}>
                  <path
                    d={`M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`}
                    fill="none"
                    strokeWidth={1.5}
                    strokeDasharray={dashed ? '5 4' : undefined}
                    className="stroke-c-text-muted"
                    markerEnd="url(#zlecenia-strzalka)"
                  />
                  {kind !== 'SEQUENCE'
                    ? (() => {
                        const text = planEdgeTypeLabel(kind, true);
                        // Szerokość liczona z długości napisu (bez pomiaru DOM —
                        // płótno jest w SVG i musi rysować się w jednym przebiegu).
                        const boxW = text.length * 5.9 + 12;
                        const cx = (x1 + x2) / 2;
                        const cy = (y1 + y2) / 2 - 12;
                        return (
                          <>
                            {/* Podkład: bez niego napis zlewa się z krzywą i siatką. */}
                            <rect
                              x={cx - boxW / 2}
                              y={cy - 9}
                              width={boxW}
                              height={16}
                              rx={8}
                              className="fill-c-surface stroke-c-border"
                              strokeWidth={1}
                            />
                            <text
                              x={cx}
                              y={cy + 2}
                              textAnchor="middle"
                              className="fill-c-text-muted"
                              style={{ fontSize: 11 }}
                            >
                              {text}
                            </text>
                          </>
                        );
                      })()
                    : null}
                </g>
              );
            })}
            {layout.nodes.map((item) => {
              const isSelected = item.node.nodeId === selectedNodeId;
              const runtime = runtimeStateByNodeId?.[item.node.nodeId];
              return (
                <foreignObject
                  key={item.node.nodeId}
                  x={item.x}
                  y={item.y}
                  width={NODE_W}
                  height={NODE_H}
                  data-plan-node={item.node.nodeId}
                >
                  <button
                    type="button"
                    onClick={() => onSelectNode(item.node.nodeId)}
                    aria-pressed={isSelected}
                    className={`flex h-full w-full flex-col justify-between rounded-xl border bg-c-surface-raised p-3 text-left ${FOCUS_RING} ${
                      isSelected
                        ? 'border-c-border-strong ring-2 ring-c-focus'
                        : 'border-c-border hover:border-c-border-strong'
                    }`}
                  >
                    <span className="line-clamp-2 text-[13px] font-medium leading-snug text-c-text">
                      {item.label}
                    </span>
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-[11px] text-c-text-muted">
                        {item.typeLabel}
                      </span>
                      {runtime ? (
                        <span
                          className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                            runtime.tone === 'blocked'
                              ? 'bg-danger-50 text-danger-700 dark:bg-danger-500/10 dark:text-danger-300'
                              : runtime.tone === 'done'
                                ? 'bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-300'
                                : 'bg-c-surface text-c-text-secondary'
                          }`}
                        >
                          {runtime.label}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </foreignObject>
              );
            })}
          </g>
        </svg>
      </div>

      {/* Sterowanie widokiem — neutralne, nigdy crimson (crimson = krytyczne). */}
      <div className="pointer-events-none absolute bottom-3 right-3 flex flex-wrap justify-end gap-1.5">
        <div className="pointer-events-auto flex items-center gap-1 rounded-xl border border-c-border bg-c-surface p-1 shadow-sm">
          <button
            type="button"
            onClick={() => zoomBy(1 / 1.2)}
            aria-label="Oddal plan"
            className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-c-text-secondary hover:bg-c-surface-raised ${FOCUS_RING}`}
          >
            <Minus size={16} aria-hidden />
          </button>
          <span
            aria-live="polite"
            className="min-w-[3.25rem] text-center text-xs tabular-nums text-c-text-secondary"
          >
            {Math.round(transform.k * 100)}%
          </span>
          <button
            type="button"
            onClick={() => zoomBy(1.2)}
            aria-label="Przybliż plan"
            className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-c-text-secondary hover:bg-c-surface-raised ${FOCUS_RING}`}
          >
            <Plus size={16} aria-hidden />
          </button>
          <button
            type="button"
            onClick={fitToView}
            data-testid="plan-dopasuj"
            className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-c-text-secondary hover:bg-c-surface-raised ${FOCUS_RING}`}
          >
            <Maximize2 size={14} aria-hidden />
            Dopasuj do ekranu
          </button>
          <button
            type="button"
            onClick={() => setTransform((p) => ({ ...p, k: 1 }))}
            aria-label="Ustaw powiększenie na sto procent"
            className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-c-text-secondary hover:bg-c-surface-raised ${FOCUS_RING}`}
          >
            <Crosshair size={15} aria-hidden />
          </button>
        </div>
      </div>

      <p className="pointer-events-none absolute bottom-3 left-3 max-w-[45%] text-[11px] leading-snug text-c-text-muted">
        Przeciągnij, aby przesunąć. Kółko myszy przybliża. Strzałka pokazuje kolejność kroków.
      </p>
    </div>
  );
};

export default PlanGraphCanvas;
