/**
 * Shared ReactFlow configuration for all Ideas workspace tools.
 * Implements Miro/FigJam-style interaction model:
 *   - Left click on node = select/drag
 *   - Left click on empty + drag = selection box
 *   - Middle/Right button = pan
 *   - Scroll = zoom
 *   - Space (hold) = temporary pan mode
 */

import { ConnectionMode } from 'reactflow';

export type IdeasToolType = 'mindmap' | 'processflow' | 'whiteboard' | 'table';

export interface IdeasToolInteractionOptions {
  locked?: boolean;
  connectMode?: boolean;
}

const SHARED_PRO_OPTIONS = { hideAttribution: true } as const;

const SHARED_FIT_VIEW_OPTIONS = { padding: 0.3 } as const;

/**
 * Returns standardized ReactFlow props for Miro-style interaction.
 * All 3 ReactFlow-based Ideas tools (mindmap, processflow, whiteboard) should
 * spread these props onto their <ReactFlow> component.
 */
export function getIdeasToolInteractionProps(
  _toolType: IdeasToolType,
  { locked = false, connectMode = false }: IdeasToolInteractionOptions = {}
) {
  return {
    // Miro-style: middle/right button = pan, left button = select/drag nodes
    panOnDrag: [1, 2] as number[],
    selectionOnDrag: true,
    selectionMode: 'partial' as const,
    zoomOnScroll: true,
    zoomOnPinch: true,
    zoomOnDoubleClick: false,
    panOnScroll: false,
    preventScrolling: true,
    // Space+drag = temporary pan (ReactFlow built-in)
    panActivationKeyCode: 'Space' as const,
    nodesDraggable: !locked,
    nodesConnectable: !locked && connectMode,
    nodesFocusable: true,
    edgesFocusable: true,
    elementsSelectable: true,
    connectionMode: ConnectionMode.Loose,
    deleteKeyCode: locked ? null : (['Backspace', 'Delete'] as string[]),
    minZoom: 0.1,
    maxZoom: 3,
    proOptions: SHARED_PRO_OPTIONS,
    fitViewOptions: SHARED_FIT_VIEW_OPTIONS,
  };
}

export type IdeasToolCursorMode = 'default' | 'pan' | 'connect';

export function getIdeasToolCursorClass(mode: IdeasToolCursorMode): string {
  switch (mode) {
    case 'pan':
      return 'cursor-grab active:cursor-grabbing';
    case 'connect':
      return 'cursor-crosshair';
    default:
      return 'cursor-default';
  }
}

export { SHARED_FIT_VIEW_OPTIONS, SHARED_PRO_OPTIONS };
