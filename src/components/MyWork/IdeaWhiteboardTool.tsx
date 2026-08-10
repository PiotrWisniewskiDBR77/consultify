/**
 * IdeaWhiteboardTool — V3 Whiteboard canvas for Idea Workspace.
 *
 * Free-form canvas with sticky notes, text blocks, connectors.
 * Pan/zoom, lasso select, multi-move, grouping.
 * Data lives in shared IdeaWorkspaceGraph (nodes/edges/extensions.whiteboard).
 */
import 'reactflow/dist/style.css';
import './whiteboard/whiteboard-canvas.css';

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  ArrowUpDown,
  CheckSquare,
  Copy,
  ExternalLink,
  Group,
  Link2,
  Lock,
  Rocket,
  Trash2,
  Ungroup,
  Wand2,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import ReactFlow, {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  type Connection,
  type Edge,
  type EdgeChange,
  MiniMap,
  type Node,
  type NodeChange,
  ReactFlowProvider,
  useReactFlow,
  useStore as useReactFlowStore,
} from 'reactflow';

import { type ActionContext, runIdeaAction } from '@/actions/ideaActionRegistry';
import { SkeletonState } from '@/components/shared/states';
import { Api } from '@/services/api';
import { generateAIProposal } from '@/services/ideaAIGenerator';
import { useAppStore } from '@/store/useAppStore';
import { withNormalizedArtifactLinks } from '@/utils/artifactLinks';
import { isCanvasObjectEditBarEnabled } from '@/utils/canvasObjectEditBarFlag';
import {
  IDEA_BOTTOM_BAR_MINIMAP_LIFT,
  isIdeaBottomBarUnifiedEnabled,
} from '@/utils/ideaBottomBarUnifiedFlag';
import { isVf1CanvasSpecAEnabled } from '@/utils/vf1CanvasSpecAFlag';

import { getCanvasBg } from './canvas/canvasBackground';
import { CanvasSnapGuides } from './canvas/CanvasSnapGuides';
import { CanvasZoomControls } from './canvas/CanvasZoomControls';
import {
  getIdeaCanvasCursorClass,
  getIdeaCanvasCursorProps,
  type IdeaCanvasCursorMode,
  publishIdeaCanvasCursorMode,
} from './canvas/ideaCanvasCursorMode';
import { useCanvasSnapping } from './canvas/useCanvasSnapping';
import {
  formatIdeaMapSyncLabel,
  resolveIdeaMapHydration,
  useIdeaMapSync,
} from './canvas/useIdeaMapSync';
import { getIdeasToolInteractionProps } from './canvas/useIdeasToolDefaults';
import { useCanvasKeyboard } from './canvas/useIdeasToolKeyboard';
import { type DrawingPath, IdeaDrawingLayer } from './IdeaDrawingLayer';
import { IdeaScenesManager, type Scene } from './IdeaScenesManager';
import {
  type AIProposal,
  type AIProposalBatch,
  type CanvasBgPattern,
  type CanvasToolType,
  EMPTY_SELECTION,
  IDEA_WORKSPACE_INSERT_EVENT,
  IDEA_WORKSPACE_THEME_EVENT,
  type IdeaWorkspaceInsertDetail,
  type IdeaWorkspaceSelection,
} from './ideaSelectionTypes';
export type { CanvasBgPattern } from './ideaSelectionTypes';
import {
  isWhiteboardSessionInPanelEnabled,
  WHITEBOARD_SESSION_PANEL_SLOT_ID,
} from '@/utils/whiteboardSessionInPanelFlag';

import { readCanvasObjectStyle } from './canvas/canvasObjectStyle';
import {
  type EdgeArrowDirection,
  nextArrowDirection,
  resolveArrowDirection,
} from './canvas/edgeArrowMarkers';
import { ObjectEditBar, type ObjectEditBarGroup } from './canvas/ObjectEditBar';
import {
  buildStyleGroups,
  ObjectEditBarDock,
  useObjectEditBarSlot,
} from './canvas/objectEditBarDock';
import { MenuListPopover } from './canvas/ObjectEditBarPopovers';
import {
  isContextMenuKey,
  resolveKeyboardContextMenuTarget,
} from './canvas/resolveKeyboardContextMenuTarget';
import { IdeaAINudgeStrip } from './IdeaAINudgeStrip';
import { IdeaCanvasContextMenu } from './IdeaCanvasContextMenu';
import { IdeaProposalReview } from './IdeaProposalReview';
import { IdeaSlashCommandMenu } from './IdeaSlashCommandMenu';
import { emitIdeaUndoState } from './ideaUndoStateBus';
import { applySmartLayout, type LayoutAlgorithm } from './layout/IdeaSmartLayout';
import { CollaborationOverlay } from './mindmap/CollaborationOverlay';
import { IDEA_PANEL_TOOL_SLOT_ID } from './panel/ideaPanel6Sections';
import { isIdeaPanel6SectionsEnabled } from './panel/ideaPanel6SectionsFlag';
import { useConfirmDialog } from './shared/ConfirmDialog';
import { KeyboardShortcutsHelp } from './shared/KeyboardShortcutsHelp';
import { whiteboardEdgeTypes, whiteboardNodeTypes } from './whiteboard/nodes/nodeTypes';
import {
  appendComment as appendNodeComment,
  readComments as readNodeComments,
  removeComment as removeNodeComment,
  type WhiteboardNodeComment,
} from './whiteboard/nodes/whiteboardNodeComments';
import { WhiteboardNodeCommentThread } from './whiteboard/nodes/WhiteboardNodeCommentThread';
import { STICKY_COLORS, STICKY_SIZES, useIsDark } from './whiteboard/nodes/whiteboardNodeHelpers';
import { usePortalSlot } from './whiteboard/usePortalSlot';
import {
  DEFAULT_WHITEBOARD_NODE_SIZE,
  resolveWhiteboardPlacement,
  type WhiteboardRect,
} from './whiteboard/whiteboardPlacement';
import { useWhiteboardCollab } from './whiteboard/useWhiteboardCollab';
import { useWhiteboardNodes } from './whiteboard/useWhiteboardNodes';
import {
  useWhiteboardQuickActions,
  type WhiteboardAIGeneratorType,
} from './whiteboard/useWhiteboardQuickActions';
import {
  createWhiteboardActivityEntry,
  createWhiteboardHistoryEntry,
  cycleWhiteboardClassification,
  cycleWhiteboardRole,
  FACILITATION_TRANSITIONS,
  type FacilitationPhase,
  getSemanticTypeLabel,
  inferWhiteboardSemanticType,
  resolveConvertOutcomeType,
  type WhiteboardActivityEntry,
  type WhiteboardClassification,
  type WhiteboardHistoryEntry,
  type WhiteboardLibraryItem,
  type WhiteboardOutcomeRecord,
  type WhiteboardSessionState,
  type WhiteboardSharePolicy,
  type WhiteboardVoteEntry,
} from './whiteboard/whiteboardContracts';
import { WhiteboardEdgeContextMenu } from './whiteboard/WhiteboardEdgeContextMenu';
import { WhiteboardEmptyState } from './whiteboard/WhiteboardEmptyState';
import { uploadWhiteboardImageWithFallback } from './whiteboard/whiteboardImageUpload';
import {
  getWhiteboardModeCopy,
  getWhiteboardShortcuts,
} from './whiteboard/whiteboardInteractionGrammar';
import {
  applyProposalNodeMoves,
  applyProposalNodeUpdates,
  isWbNodeKind,
  resolveProposalEdges,
  toWbNodeKind,
  type WbNodeKind,
} from './whiteboard/whiteboardProposalPatch';
import { toggleReaction } from './whiteboard/whiteboardReactions';
import { WhiteboardSelectionBar } from './whiteboard/WhiteboardSelectionBar';
import { WhiteboardSessionPanel } from './whiteboard/WhiteboardSessionPanel';
import { WhiteboardStyleBar } from './whiteboard/WhiteboardStyleBar';
import { WhiteboardToolbar } from './whiteboard/WhiteboardToolbar';

// ── Node/edge types (extracted to whiteboard/nodes/) ─────────────────────────
const nodeTypes = whiteboardNodeTypes;
const edgeTypes = whiteboardEdgeTypes;

// ── Inner canvas (needs useReactFlow context) ────────────────────────────────

interface WhiteboardCanvasProps {
  nodes: Node[];
  edges: Edge[];
  locked: boolean;
  /**
   * Z1 (rozdz. 06 §3): tryb kursora płótna sterowany pstryczkiem lewego raila.
   * Do 2026-07-23 Tablica w ogóle go nie odbierała — pstryczek kłamał o stanie.
   */
  cursorMode?: IdeaCanvasCursorMode;
  isPolish?: boolean;
  onNodesChange?: (changes: NodeChange[]) => void;
  onEdgesChange?: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  onNodeDoubleClick?: (nodeId: string, nodeData: any) => void;
  bgPattern?: CanvasBgPattern;
  onViewportChange?: (vp: { x: number; y: number; zoom: number }) => void;
  onExternalInsert?: (items: WhiteboardExternalInsert[]) => void;
  onFullscreenToggle?: () => void;
  isFullscreen?: boolean;
  onContextMenu?: (e: React.MouseEvent, nodeId?: string, nodeData?: any) => void;
  // P2-6 (rozdz. 08 §4): prawy klik na krawędzi otwiera menu krawędzi.
  onEdgeContextMenu?: (e: React.MouseEvent, edgeId: string) => void;
  // Z15: patch a single node's style (accent/fontSize/fontWeight) onto node.data.
  onNodeStyleChange?: (nodeId: string, patch: Record<string, unknown>) => void;
  /**
   * Gdy pasek edycji obiektu jest ZADOKOWANY w listwie Menu 3
   * (ff_canvasObjectEditBar), pływający `WhiteboardStyleBar` niósłby DOKŁADNIE
   * te same kontrolki dwa razy — doktryna gęstości §3 (zdublowana akcja).
   * Wtedy chowamy pływający; przy fladze OFF nic się nie zmienia.
   */
  suppressFloatingStyleBar?: boolean;
}

// WB-P1-02: `createNode`/`addElement`/`handleExternalInsert` live in the
// OUTER `IdeaWhiteboardTool` component, which renders OUTSIDE
// `<ReactFlowProvider>` (see the `<ReactFlowProvider><WhiteboardCanvas/>` JSX
// below) — so they have no `useReactFlow()` access of their own and can't
// call `screenToFlowPosition` directly. This imperative handle is the pull
// side of that gap: the outer component asks the mounted canvas for a live
// viewport reading (flow coords) at the moment it needs to place a new node,
// rather than trying to keep a push-synced copy (which would go stale
// between `onMoveEnd` events and initial mount).
export interface WhiteboardCanvasHandle {
  /** Flow-space point at the visual center of the current viewport. */
  getCenter: () => { x: number; y: number };
  /** Visible viewport, in flow coords, at the current pan/zoom. */
  getViewportRect: () => WhiteboardRect;
}

// Z15: node types that expose the floating per-element style bar.
const STYLEABLE_WB_NODE_TYPES = new Set(['stickyNote', 'textBlock', 'shapeNode']);

const WhiteboardCanvas = React.forwardRef<WhiteboardCanvasHandle, WhiteboardCanvasProps>(({
  nodes,
  edges,
  locked,
  cursorMode = 'select',
  isPolish = false,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeDoubleClick,
  bgPattern = 'dots',
  onViewportChange,
  onExternalInsert,
  onFullscreenToggle: externalOnFullscreenToggle,
  isFullscreen: externalIsFullscreen = false,
  onContextMenu: externalOnContextMenu,
  onEdgeContextMenu: externalOnEdgeContextMenu,
  onNodeStyleChange,
  suppressFloatingStyleBar,
}, ref) => {
  const { screenToFlowPosition, setViewport, fitView } = useReactFlow();
  // Z15: subscribe to the live viewport transform so the floating style bar
  // tracks the node while panning/zooming (re-renders on [x,y,zoom] change).
  const rfTransform = useReactFlowStore((s) => s.transform);
  // Z14: 8px grid + magnetic neighbour-edge snapping while dragging.
  const { onNodeDrag: onSnapNodeDrag, onNodeDragStop: onSnapNodeDragStop } = useCanvasSnapping({
    enabled: !locked,
    grid: 8,
    threshold: 6,
  });
  const { t } = useTranslation();
  const isDarkCanvas = useIsDark();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [showMiniMap, setShowMiniMap] = React.useState(false);
  const [internalFullscreen, setInternalFullscreen] = React.useState(false);

  const toggleInternalFullscreen = React.useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current
        .requestFullscreen?.()
        .then(() => setInternalFullscreen(true))
        .catch(() => {});
    } else {
      document
        .exitFullscreen?.()
        .then(() => setInternalFullscreen(false))
        .catch(() => {});
    }
  }, []);

  React.useEffect(() => {
    if (externalOnFullscreenToggle) return;
    const handler = () => setInternalFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, [externalOnFullscreenToggle]);

  const onFullscreenToggle = externalOnFullscreenToggle ?? toggleInternalFullscreen;
  const isFullscreen = externalOnFullscreenToggle ? externalIsFullscreen : internalFullscreen;

  const selectedNodeId = React.useMemo(
    () => nodes.find((node) => node.selected)?.id ?? null,
    [nodes]
  );

  // Z15: floating style bar — active only when EXACTLY ONE styleable node is
  // selected. Anchor = top-center of the node, transformed into screen space via
  // the live viewport (mirrors the Mind Map FloatingNodeToolbar anchor math).
  const styleBarTarget = React.useMemo(() => {
    if (locked || !onNodeStyleChange || suppressFloatingStyleBar) return null;
    const selected = nodes.filter((n) => n.selected);
    if (selected.length !== 1) return null;
    const node = selected[0];
    if (!node.type || !STYLEABLE_WB_NODE_TYPES.has(node.type)) return null;
    if (node.data?.locked) return null;
    if (!node.position) return null;
    const [tx, ty, zoom] = rfTransform;
    const width = node.width || 180;
    const screenX = node.position.x * zoom + tx + (width * zoom) / 2;
    const screenY = node.position.y * zoom + ty;
    return { node, position: { x: screenX, y: screenY } };
  }, [locked, onNodeStyleChange, suppressFloatingStyleBar, nodes, rfTransform]);

  React.useEffect(() => {
    // Naprawa 2026-07-26 (Zadanie B — Scenes nie przełącza widoku): `.react-flow`
    // to DZIECKO tego kontenera (`<div ref={containerRef}><ReactFlow/></div>`,
    // patrz JSX niżej), nie jego PRZODEK. `Element.closest()` przeszukuje
    // WYŁĄCZNIE element i jego przodków, więc zawsze zwracał `null` tutaj —
    // efekt bailował na `if (!rfEl) return`, a nasłuch na
    // `idea-whiteboard-set-viewport` NIGDY się nie rejestrował. Scena wciąż
    // poprawnie dispatchowała zdarzenie (`idea-whiteboard-navigate` w innym
    // efekcie niżej), ale nic go tu nie odbierało — kliknięcie sceny wyglądało
    // jak martwe, mimo że cały łańcuch zdarzeń działał aż do tego miejsca.
    const rfEl = containerRef.current?.querySelector('.react-flow');
    if (!rfEl) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      // If fit flag is set, use fitView instead of setViewport
      if (detail?.fit) {
        const fitOpts: Record<string, unknown> = {
          padding: detail.padding || 0.2,
          duration: detail.duration || 300,
        };
        // Optional: fit to a specific subset of nodes (e.g. unconnected nodes
        // highlighted from the AI nudge strip) instead of the whole canvas.
        if (Array.isArray(detail.nodeIds) && detail.nodeIds.length > 0) {
          fitOpts.nodes = detail.nodeIds.map((id: string) => ({ id }));
        }
        fitView(fitOpts);
      } else if (
        detail &&
        typeof detail.x === 'number' &&
        typeof detail.y === 'number' &&
        typeof detail.zoom === 'number'
      ) {
        setViewport(detail, { duration: 600 });
      }
    };
    rfEl.addEventListener('idea-whiteboard-set-viewport', handler);
    return () => rfEl.removeEventListener('idea-whiteboard-set-viewport', handler);
  }, [setViewport, fitView]);

  // A6: zoom-to-fit shortcuts (Cmd/Ctrl+0 and Shift+1) — consistent with the
  // Mind Map and Process Flow tools. Whiteboard previously had neither.
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing =
        !!t && (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key === '0') {
        e.preventDefault();
        fitView({ padding: 0.2, duration: 300 });
        return;
      }
      // e.code is layout-independent (Shift+1 yields "!" on most layouts).
      if (!typing && e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey && e.code === 'Digit1') {
        e.preventDefault();
        fitView({ padding: 0.2, duration: 300 });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [fitView]);

  const getCenter = React.useCallback(() => {
    return screenToFlowPosition({
      x: (containerRef.current?.clientWidth ?? 400) / 2,
      y: (containerRef.current?.clientHeight ?? 300) / 2,
    });
  }, [screenToFlowPosition]);

  // WB-P1-02: visible viewport in flow coordinates, used by the placement
  // service to clamp fresh inserts on-screen at any pan/zoom (including
  // browser-level zoom, which scales clientWidth/Height the same way).
  const getViewportRect = React.useCallback((): WhiteboardRect => {
    const topLeft = screenToFlowPosition({ x: 0, y: 0 });
    const bottomRight = screenToFlowPosition({
      x: containerRef.current?.clientWidth ?? 400,
      y: containerRef.current?.clientHeight ?? 300,
    });
    return {
      x: topLeft.x,
      y: topLeft.y,
      width: Math.max(bottomRight.x - topLeft.x, 1),
      height: Math.max(bottomRight.y - topLeft.y, 1),
    };
  }, [screenToFlowPosition]);

  // WB-P1-02: expose both to the outer `IdeaWhiteboardTool`, which needs
  // them for the shared placement service but renders outside
  // `<ReactFlowProvider>` (see `WhiteboardCanvasHandle` doc above).
  React.useImperativeHandle(ref, () => ({ getCenter, getViewportRect }), [
    getCenter,
    getViewportRect,
  ]);

  const handlePaste = React.useCallback(
    (e: ClipboardEvent) => {
      if (locked) return;
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (!file) return;
          // L-05/D-02: cap inline base64 images at 10MB (request body limit).
          if (file.size > MAX_WHITEBOARD_IMAGE_BYTES) {
            toast.error(t('myWork.whiteboard.errors.imageTooLarge', 'Image too large (max 10MB)'));
            return;
          }

          const center = getCenter();
          const label = file.name || 'Pasted image';
          void uploadWhiteboardImageWithFallback(file).then((result) => {
            if (!result.uploaded) {
              toast(
                t(
                  'myWork.whiteboard.errors.imageUploadFallback',
                  'Image saved locally (offline) — storage upload unavailable'
                ),
                { icon: '⚠️' }
              );
            }
            onExternalInsert?.([
              {
                kind: 'image',
                label,
                imageUrl: result.imageUrl,
                src: result.src,
                width: 300,
                position: center,
              },
            ]);
          });
          return;
        }
      }

      const text = e.clipboardData?.getData('text/plain')?.trim();
      if (text) {
        e.preventDefault();
        const center = getCenter();
        const isUrl = /^https?:\/\//i.test(text);
        onExternalInsert?.([
          isUrl
            ? { kind: 'link', label: text, url: text, position: center }
            : {
                kind: 'text',
                label: text,
                position: center,
                colorIndex: Math.floor(Math.random() * STICKY_COLORS.length),
              },
        ]);
      }
    },
    [getCenter, locked, onExternalInsert]
  );

  const handleDrop = React.useCallback(
    (e: React.DragEvent) => {
      if (locked) return;
      e.preventDefault();

      const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const files = e.dataTransfer.files;

      if (files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const id = `wb-drop-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`;

          if (file.type.startsWith('image/')) {
            // L-05/D-02: cap inline base64 images at 10MB (request body limit).
            if (file.size > MAX_WHITEBOARD_IMAGE_BYTES) {
              toast.error(
                t('myWork.whiteboard.errors.imageTooLarge', 'Image too large (max 10MB)')
              );
              continue;
            }
            const dropPosition = { x: pos.x + i * 30, y: pos.y + i * 30 };
            void uploadWhiteboardImageWithFallback(file).then((result) => {
              if (!result.uploaded) {
                toast(
                  t(
                    'myWork.whiteboard.errors.imageUploadFallback',
                    'Image saved locally (offline) — storage upload unavailable'
                  ),
                  { icon: '⚠️' }
                );
              }
              onExternalInsert?.([
                {
                  kind: 'image',
                  label: file.name,
                  imageUrl: result.imageUrl,
                  src: result.src,
                  width: 250,
                  position: dropPosition,
                },
              ]);
            });
          } else {
            onExternalInsert?.([
              {
                kind: 'link',
                label: file.name,
                url: '',
                position: { x: pos.x + i * 30, y: pos.y + i * 30 },
              },
            ]);
          }
        }
        return;
      }

      const text = e.dataTransfer.getData('text/plain')?.trim();
      if (text) {
        const isUrl = /^https?:\/\//i.test(text);
        onExternalInsert?.([
          isUrl
            ? { kind: 'link', label: text, url: text, position: pos }
            : {
                kind: 'text',
                label: text,
                position: pos,
                colorIndex: Math.floor(Math.random() * STICKY_COLORS.length),
              },
        ]);
      }
    },
    [locked, onExternalInsert, screenToFlowPosition]
  );

  const handleDragOver = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('paste', handlePaste);
    return () => el.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative"
      tabIndex={0}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {styleBarTarget && onNodeStyleChange && (
        <WhiteboardStyleBar
          node={styleBarTarget.node}
          position={styleBarTarget.position}
          locked={locked}
          onChange={onNodeStyleChange}
        />
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={locked ? undefined : onNodesChange}
        onEdgesChange={locked ? undefined : onEdgesChange}
        onConnect={onConnect}
        onNodeDrag={locked ? undefined : onSnapNodeDrag}
        onNodeDragStop={locked ? undefined : onSnapNodeDragStop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeDoubleClick={(_event: any, node: any) => {
          if (onNodeDoubleClick) onNodeDoubleClick(node.id, node.data);
        }}
        onNodeContextMenu={(event: any, node: any) => {
          event.preventDefault();
          externalOnContextMenu?.(event, node.id, node.data);
        }}
        onEdgeContextMenu={(event: any, edge: any) => {
          event.preventDefault();
          externalOnEdgeContextMenu?.(event, edge.id);
        }}
        onPaneContextMenu={(event: any) => {
          event.preventDefault();
          externalOnContextMenu?.(event);
        }}
        {...getIdeasToolInteractionProps('whiteboard', { locked })}
        // Z1 (rozdz. 06 §3): tryb kursora z lewego raila REALNIE przestawia
        // płótno. `select` = zero nadpisań (zachowanie Z10), `pan` = rączka
        // (nic nie da się ruszyć ani zaznaczyć). Spread MUSI być po
        // getIdeasToolInteractionProps, żeby wygrał z domyślnymi.
        {...getIdeaCanvasCursorProps(cursorMode)}
        // Fala 8: connectionMode="loose" already comes from
        // getIdeasToolInteractionProps (spread above); connectionRadius widens
        // the drop-snap zone around each 4-side handle (parity with Process
        // Flow's IdeaProcessFlowTool, same magnetic-connector feel).
        connectionRadius={40}
        deleteKeyCode={null}
        fitView
        className={`bg-c-surface-raised ${getIdeaCanvasCursorClass(cursorMode)}`}
        defaultEdgeOptions={{ type: 'labeled' }}
        onMoveEnd={(_event: unknown, viewport: { x: number; y: number; zoom: number }) =>
          onViewportChange?.(viewport)
        }
      >
        {bgPattern !== 'blank' && (
          <Background
            gap={bgPattern === 'lines' ? 48 : 24}
            size={bgPattern === 'grid' ? 24 : 1}
            color={getCanvasBg('whiteboard', isDarkCanvas ? 'dark' : 'light').color}
            variant={
              bgPattern === 'grid'
                ? ('cross' as any)
                : bgPattern === 'lines'
                  ? ('lines' as any)
                  : ('dots' as any)
            }
          />
        )}
        {showMiniMap && (
          <MiniMap
            nodeColor={(n: Node) => {
              if (n.type === 'stickyNote') {
                const idx = (n.data?.colorIndex ?? 0) % STICKY_COLORS.length;
                const c = STICKY_COLORS[idx];
                return isDarkCanvas ? c.darkHex || c.hex : c.hex;
              }
              if (n.type === 'kpiBadge') {
                const s = n.data?.status;
                return s === 'on_track'
                  ? 'var(--c-success)'
                  : s === 'off_track'
                    ? 'var(--c-danger)'
                    : s === 'at_risk'
                      ? 'var(--c-warning)'
                      : 'var(--c-text-muted)';
              }
              if (n.type === 'scoreNode') return 'var(--c-tag-2)';
              if (n.type === 'progressNode') return 'var(--c-info)';
              if (n.type === 'summaryCard') return 'var(--c-tag-3)';
              if (n.type === 'frameNode') return 'var(--c-surface-raised)';
              if (n.type === 'shapeNode')
                return n.data?.bgColor || 'color-mix(in srgb, var(--c-tag-2) 20%, transparent)';
              if (n.type === 'groupNode') return 'var(--c-surface)';
              return 'var(--c-border-subtle)';
            }}
            maskColor={isDarkCanvas ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.08)'}
            className="!bg-c-surface !border-c-border-subtle !rounded-xl"
            /**
             * Wymaganie #6 dolnego paska: minimapa nie może wjeżdżać POD pasek
             * (pasek `z-dropdown`, minimapa domyślnie `z-index:5`). Mapa myśli
             * ma to uniesienie od dawna na sztywno; tutaj wchodzi razem z flagą
             * `ideaBottomBarUnified`, bo to zmiana wizualna (OFF = jak dziś).
             */
            style={
              isIdeaBottomBarUnifiedEnabled()
                ? { marginBottom: IDEA_BOTTOM_BAR_MINIMAP_LIFT, zIndex: 10 }
                : undefined
            }
          />
        )}
        <CanvasZoomControls
          isPolish={isPolish}
          selectedNodeId={selectedNodeId}
          showMiniMap={showMiniMap}
          onToggleMiniMap={() => setShowMiniMap((prev) => !prev)}
          onFullscreenToggle={onFullscreenToggle}
          isFullscreen={isFullscreen}
        />
        {!locked && <CanvasSnapGuides threshold={6} />}
      </ReactFlow>
    </div>
  );
});
WhiteboardCanvas.displayName = 'WhiteboardCanvas';

// ── Main component ───────────────────────────────────────────────────────────

type WhiteboardQuickStart = 'brainstorm' | 'affinity' | 'workshop';

type WhiteboardCanvasSnapshot = {
  nodes: Node[];
  edges: Edge[];
  drawingPaths: DrawingPath[];
  scenes: Scene[];
};

type WhiteboardExternalInsert =
  | {
      kind: 'image';
      label: string;
      // A6: exactly one of these is set — `imageUrl` for storage-backed
      // uploads, `src` (inline base64) for the pre-A6 / fallback path.
      // ImageNode renders `data.imageUrl || data.src` so both work identically.
      src?: string;
      imageUrl?: string;
      width?: number;
      position?: { x: number; y: number };
    }
  | {
      kind: 'link';
      label: string;
      url: string;
      position?: { x: number; y: number };
    }
  | {
      kind: 'text';
      label: string;
      position?: { x: number; y: number };
      colorIndex?: number;
    };

function cloneCanvasSnapshot(snapshot: WhiteboardCanvasSnapshot): WhiteboardCanvasSnapshot {
  return {
    nodes: snapshot.nodes.map((node) => ({ ...node, data: { ...(node.data || {}) } })),
    edges: snapshot.edges.map((edge) => ({ ...edge, data: { ...(edge.data || {}) } })),
    drawingPaths: snapshot.drawingPaths.map((path) => ({ ...path })),
    scenes: snapshot.scenes.map((scene) => ({ ...scene })),
  };
}

function isNodeDataLocked(node: Node | null | undefined): boolean {
  return Boolean(node?.data?.locked);
}

// WB-P2-02 — "Find themes" must not present generic output as insight. The
// i18n keys `createNode` stamps onto a brand-new, never-renamed sticky/text/
// shape/frame/etc. — same list as `defaultLabelKeys` inside `createNode`.
const GENERIC_WHITEBOARD_LABEL_I18N_KEYS = [
  'defaultSticky',
  'defaultText',
  'defaultGroup',
  'defaultShape',
  'defaultFrame',
  'defaultImage',
  'defaultLink',
  'defaultKpi',
  'defaultScore',
  'defaultProgress',
  'defaultSummary',
] as const;

/**
 * Builds the set of "still-default" labels in BOTH languages (not just the
 * currently active one) — a board can mix content authored in either
 * locale, and switching the UI language later must not make old default
 * labels suddenly look "real". Uses the real `t` from the calling component
 * (with an explicit `{ lng }` override) so this stays correct under the
 * known pre-existing test-mock behavior where `t()` returns the raw key —
 * in that case every entry collapses to the same raw key, which still
 * matches because freshly-created nodes get their default label from that
 * same `t()` call.
 */
export function collectGenericWhiteboardLabels(
  t: (key: string, opts?: Record<string, unknown>) => string
) {
  const generic = new Set<string>();
  for (const key of GENERIC_WHITEBOARD_LABEL_I18N_KEYS) {
    for (const lng of ['en', 'pl']) {
      const label = t(`myWork.whiteboard.nodes.${key}`, { lng });
      if (typeof label === 'string' && label.trim()) generic.add(label.trim().toLowerCase());
    }
  }
  return generic;
}

/** Empty/whitespace-only or matching a known default = not real semantic input yet. */
export function isGenericWhiteboardLabel(label: unknown, generic: Set<string>): boolean {
  if (typeof label !== 'string') return true;
  const trimmed = label.trim();
  if (!trimmed) return true;
  return generic.has(trimmed.toLowerCase());
}

function normalizeVoteSummary(
  summary: Array<{ vote_target_id?: string; total?: number | string; count?: number | string }>
): Record<string, number> {
  return summary.reduce<Record<string, number>>((acc, entry) => {
    const nodeId = String(entry.vote_target_id || '').trim();
    if (!nodeId) return acc;
    const total = Number(entry.total ?? entry.count ?? 0);
    acc[nodeId] = Number.isFinite(total) ? total : 0;
    return acc;
  }, {});
}

// L-05/D-02: inline base64 image cap — matches the 10MB request body limit.
const MAX_WHITEBOARD_IMAGE_BYTES = 10 * 1024 * 1024;

const DEFAULT_SESSION_STATE: WhiteboardSessionState = {
  active: false,
  role: 'facilitator',
  sessionId: null,
  toolSessionId: null,
  timerSeconds: 300,
  timerEndsAt: null,
  votingOpen: false,
  followMe: false,
  spotlightNodeId: null,
  reactionsEnabled: true,
  facilitationPhase: 'start',
  updatedAt: 0,
};

const DEFAULT_SHARE_POLICY: WhiteboardSharePolicy = {
  classification: 'internal',
  watermark: 'Consultify Whiteboard',
  exportAllowed: true,
  shareAllowed: true,
};

interface IdeaWhiteboardToolProps {
  open: boolean;
  ideaId: string;
  locked?: boolean;
  refreshToken?: number;
  title?: string;
  seedText?: string;
  stage?: string;
  onSaved?: () => void;
  onSelectionChange?: (sel: IdeaWorkspaceSelection) => void;
  onNodeDetail?: (nodeId: string, nodeData: any) => void;
  drillFocusNodeId?: string | null;
  focusMode?: 'system' | 'object' | null;
  focusObjectId?: string | null;
  onFullscreenToggle?: () => void;
  isFullscreen?: boolean;
  /** Z9: when true (mels canvas shell — Menu 1 shows the save indicator), the
   *  WhiteboardToolbar hides its own Save button to avoid duplication. Default
   *  OFF → legacy layout unchanged. */
  hideSaveIndicator?: boolean;
  onGraphChange?: (graph: {
    nodes: any[];
    edges: any[];
    extensions?: Record<string, unknown>;
  }) => void;
}

export const IdeaWhiteboardTool: React.FC<IdeaWhiteboardToolProps> = ({
  open,
  ideaId,
  locked: lockedProp = false,
  refreshToken,
  onSaved,
  onSelectionChange,
  onNodeDetail,
  drillFocusNodeId,
  focusMode,
  focusObjectId,
  onFullscreenToggle: externalOnFullscreenToggle,
  isFullscreen: externalIsFullscreen,
  onGraphChange,
  hideSaveIndicator = false,
  title: ideaTitle = '',
  seedText: ideaSeedText = '',
  stage: ideaStage = '',
}) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  // VF1 SPEC-A canvas skeleton — default OFF, gated per rule #7.
  const vf1CanvasSpecAEnabled = isVf1CanvasSpecAEnabled();
  const currentUser = useAppStore((state) => state.currentUser);
  const { dialog: confirmDialog, confirm: showConfirm } = useConfirmDialog();
  const currentUserId = String(currentUser?.id || 'current-user');
  const currentUserName = useMemo(() => {
    const fullName = [currentUser?.firstName, currentUser?.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();
    return fullName || currentUser?.email || t('myWork.whiteboard.presence.you');
  }, [currentUser?.email, currentUser?.firstName, currentUser?.lastName, isPl]);

  const [loading, setLoading] = useState(false);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  /**
   * Z1 (rozdz. 06 §3) — JEDEN stan trybu zamiast dwóch.
   *
   * Do 2026-07-23 Tablica trzymała `whiteboardMode` ('board' | 'draw') sterowany
   * wyłącznie przyciskiem „Rysuj", a lewy rail przestawiał NIEZALEŻNY, niczego
   * nieświadomy `interactionMode` ('select' | 'pan') w IdeaMapWorkspace. Dwa
   * równoległe przełączniki tego samego pojęcia = pstryczek raila kłamał.
   *
   * Teraz stanem jest `canvasMode` ('select' | 'pan' | 'draw'); 'board' z
   * dawnego kontraktu (persystencja, toolbar, kopie) to po prostu „nie draw" i
   * jest z niego WYLICZANE, nie trzymane osobno.
   */
  const [canvasMode, setCanvasMode] = useState<IdeaCanvasCursorMode>('select');
  const whiteboardMode: 'board' | 'draw' = canvasMode === 'draw' ? 'draw' : 'board';
  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false);
  const [drawingPaths, setDrawingPaths] = useState<DrawingPath[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [sessionState, setSessionState] = useState<WhiteboardSessionState>(DEFAULT_SESSION_STATE);
  // Naprawa 2026-07-26 (Zadanie A, `ff_whiteboardSessionInPanel`, default OFF):
  // gdy flaga ON, `WhiteboardSessionPanel` nie renderuje się jako floating
  // overlay nad płótnem — zamiast tego portaluje się do slotu wystawionego
  // przez prawy panel „Właściwości" (sekcja „Inspektor tablicy" w
  // IdeaWorkspaceTools.tsx). `sessionPanelSlot` jest `null` dopóki ten slot
  // nie pojawi się w DOM (panel zamknięty / inna zakładka) — wtedy portal po
  // prostu nic nie renderuje, zamiast rzucać błąd.
  //
  // 2026-07-28 (`ff_ideaPanel6Sections`): układ sześciu sekcji przenosi WSZYSTKIE
  // panele informacyjne z płótna do prawego panelu — Warstwa sesji i Sceny lądują
  // w sekcji „Narzędzie". Warstwa sesji była już w połowie przeniesiona (własna
  // flaga z 07-26, nigdy nie włączona), więc nie budujemy jej od nowa: wystarczy,
  // że DOWOLNA z dwóch flag włącza tryb panelowy. Sceny dostają analogiczny
  // portal do `IDEA_PANEL_TOOL_SLOT_ID`.
  const panele6Enabled = isIdeaPanel6SectionsEnabled();
  const whiteboardSessionInPanelEnabled = isWhiteboardSessionInPanelEnabled() || panele6Enabled;
  const sessionPanelSlot = usePortalSlot(WHITEBOARD_SESSION_PANEL_SLOT_ID);
  const toolPanelSlot = usePortalSlot(IDEA_PANEL_TOOL_SLOT_ID);
  // B1 (M09): an 'observer' in an active facilitation session is view-only. This folds into
  // the existing `locked` mechanism already threaded through every mutation site below, so
  // node creation / drag / resize / edit / draw are all disabled without touching each call
  // site. Server-side enforcement (my-work.routes.ts, WHITEBOARD_OBSERVER_READONLY) is the
  // real gate; this is the UX so an observer isn't left wondering why edits silently 403.
  const isObserver = sessionState.role === 'observer';
  const locked = lockedProp || isObserver;
  const [sharePolicy, setSharePolicy] = useState<WhiteboardSharePolicy>(DEFAULT_SHARE_POLICY);
  const [libraryItems, setLibraryItems] = useState<WhiteboardLibraryItem[]>([]);
  const [outcomeRegistry, setOutcomeRegistry] = useState<WhiteboardOutcomeRecord[]>([]);
  const [activityLog, setActivityLog] = useState<WhiteboardActivityEntry[]>([]);
  const [historyLog, setHistoryLog] = useState<WhiteboardHistoryEntry[]>([]);
  const [sessionVotes, setSessionVotes] = useState<Record<string, number>>({});
  const [myVoteCounts, setMyVoteCounts] = useState<Record<string, number>>({});
  const [presenceUsers, setPresenceUsers] = useState<
    Array<{
      userId: string;
      userName?: string;
      cursorState?: Record<string, unknown>;
      activeBlockId?: string | null;
    }>
  >([]);
  const [outlineImportOpen, setOutlineImportOpen] = useState(false);
  const [outlineImportValue, setOutlineImportValue] = useState('');
  // CB-05/RB-042/RV-003: scopes the Shift+F10/ContextMenu keyboard-invocation
  // listener (below, near handleEdgeContextMenu) to this tool's own region
  // instead of the whole document.
  const wbKeyboardMenuContainerRef = useRef<HTMLDivElement>(null);
  // WB-P1-02: pull-based handle onto the mounted `WhiteboardCanvas` — see
  // `WhiteboardCanvasHandle` doc — so `createNode` can read a live viewport
  // reading despite this component rendering outside `<ReactFlowProvider>`.
  const canvasApiRef = useRef<WhiteboardCanvasHandle>(null);
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [contextMenuTarget, setContextMenuTarget] = useState<{
    nodeId?: string;
    nodeLabel?: string;
    nodeType?: string;
    nodeLocked?: boolean;
  }>({});
  // P2-6 (rozdz. 08 §4): menu krawędzi — prawy klik na połączeniu.
  const [edgeContextMenu, setEdgeContextMenu] = useState<{
    edgeId: string;
    x: number;
    y: number;
  } | null>(null);
  // Node comment threads — comments live in `node.data.comments[]` and ride the
  // existing setNodes → onGraphChange → PUT /map autosave (blob contract,
  // identical to Process Flow). Opened from the canvas context menu (PPM).
  const [commentsPanelNodeId, setCommentsPanelNodeId] = useState<string | null>(null);
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashMenuPos, setSlashMenuPos] = useState<{ x: number; y: number } | undefined>();
  const [bgPattern, setBgPattern] = useState<CanvasBgPattern>('dots');
  const [proposalBatch, setProposalBatch] = useState<AIProposalBatch | null>(null);
  const [viewportTransform, setViewportTransform] = useState<{
    x: number;
    y: number;
    zoom: number;
  }>({ x: 0, y: 0, zoom: 1 });
  const selectedNodeIds = useMemo(
    () => nodes.filter((node) => node.selected).map((node) => node.id),
    [nodes]
  );
  const { saving, syncState, lastSavedAt, queueSync, flushNow, primeServerVersion } =
    useIdeaMapSync({
      ideaId,
      tool: 'whiteboard',
      open,
      locked,
    });
  // M09 L-02: realtime graph sync (org-scoped WS, mirrors M06 Mind Map).
  // DP-3 (T6): shared useIdeaCollab under the hood; ideaId scopes remote events.
  const collab = useWhiteboardCollab({ ideaId, currentUserId, setNodes, setEdges });
  // useWhiteboardCollab returns a fresh object literal each render, but its inner
  // callbacks ARE memoized. Depend on the stable callback (not the object) so
  // handleToggleReaction — and therefore hydrate, which lists it — stays stable.
  // Depending on `collab` directly re-creates hydrate every render, which re-fires
  // the hydrate effect and its setSessionState → infinite render loop (B4×B1).
  const { broadcastNodeUpdate: collabBroadcastNodeUpdate } = collab;

  // B4: emoji reactions on nodes. Gated behind the (previously-dead)
  // session.reactionsEnabled flag + an active facilitation session. Toggling a
  // reaction mutates the node's own `data.reactions`, which persists through the
  // existing setNodes → onGraphChange → /map autosave path (no new endpoint),
  // and broadcasts via the existing collab `update_node` op so collaborators see
  // it live (reuse only — no new WS message type).
  const handleToggleReaction = useCallback(
    (nodeId: string, emoji: string) => {
      // Observers (B1 read-only) must not mutate the board — reacting is a write.
      if (locked) return;
      setNodes((nds) => {
        let updated: Node | null = null;
        const next = nds.map((n) => {
          if (n.id !== nodeId) return n;
          const nextReactions = toggleReaction(n.data?.reactions, emoji, currentUserId);
          updated = { ...n, data: { ...n.data, reactions: nextReactions } };
          return updated;
        });
        if (updated) {
          // Broadcast only the persistable slice (id + data.reactions); the
          // collab receiver shallow-merges node + node.data.
          collabBroadcastNodeUpdate({
            id: (updated as Node).id,
            data: { reactions: (updated as Node).data?.reactions },
          } as Node);
        }
        return next;
      });
    },
    [collabBroadcastNodeUpdate, currentUserId, locked, setNodes]
  );

  // Z15: per-element style patch (accentColor / fontSize / fontWeight) from the
  // floating style bar. Mirrors handleToggleReaction: mutate node.data, persist
  // through the existing setNodes → onGraphChange autosave, and broadcast just the
  // changed slice via the existing collab update_node op (no new endpoint/schema).
  const handleNodeStyleChange = useCallback(
    (nodeId: string, patch: Record<string, unknown>) => {
      if (locked) return;
      setNodes((nds) => {
        let updated: Node | null = null;
        const next = nds.map((n) => {
          if (n.id !== nodeId) return n;
          const nextData = { ...n.data };
          for (const [k, v] of Object.entries(patch)) {
            if (v === null) delete nextData[k];
            else nextData[k] = v;
          }
          updated = { ...n, data: nextData };
          return updated;
        });
        if (updated) {
          collabBroadcastNodeUpdate({
            id: (updated as Node).id,
            data: (updated as Node).data,
          } as Node);
        }
        return next;
      });
    },
    [collabBroadcastNodeUpdate, locked, setNodes]
  );

  // Reactions are live only during an active facilitation session with the flag on.
  // Observers (B1 read-only) never get the reaction affordance — reacting is a write.
  const reactionsActive = Boolean(sessionState.active && sessionState.reactionsEnabled && !locked);
  // Ref mirror so the (open-scoped) hydrate closure can seed reactionsEnabled with
  // the current value without taking reactionsActive as a dep (which would trigger a
  // full re-hydrate/network fetch every time the flag flips). The sync effect below
  // keeps live nodes correct after hydration.
  const reactionsActiveRef = useRef(reactionsActive);
  reactionsActiveRef.current = reactionsActive;

  // Hydration injects reactionsEnabled once; keep every node's copy in sync when
  // the session flag flips mid-board so the affordance appears/disappears live.
  useEffect(() => {
    setNodes((nds) => {
      if (nds.every((n) => Boolean(n.data?.reactionsEnabled) === reactionsActive)) return nds;
      return nds.map((n) =>
        Boolean(n.data?.reactionsEnabled) === reactionsActive
          ? n
          : { ...n, data: { ...n.data, reactionsEnabled: reactionsActive } }
      );
    });
  }, [reactionsActive, setNodes]);

  const lastSnapshotRef = useRef<WhiteboardCanvasSnapshot | null>(null);
  const undoStackRef = useRef<WhiteboardCanvasSnapshot[]>([]);
  const redoStackRef = useRef<WhiteboardCanvasSnapshot[]>([]);

  // Nadaj stan Cofnij/Ponów na wspólny autobus — bez tego przyciski w lewym
  // pasku są trwale wygaszone (stosy żyją w refach, więc nie ma przerysowania,
  // z którego pasek mógłby to wyczytać sam).
  const emitUndoState = useCallback(() => {
    emitIdeaUndoState(
      'whiteboard',
      undoStackRef.current.length > 0,
      redoStackRef.current.length > 0
    );
  }, []);
  const toolSessionId = useMemo(() => `whiteboard:${ideaId}`, [ideaId]);
  const appendActivity = useCallback(
    (entry: WhiteboardActivityEntry) => {
      setActivityLog((prev) => [entry, ...prev].slice(0, 40));
    },
    [setActivityLog]
  );
  const pushUndoSnapshot = useCallback(() => {
    const snapshot = cloneCanvasSnapshot({ nodes, edges, drawingPaths, scenes });
    undoStackRef.current = [...undoStackRef.current.slice(-24), snapshot];
    redoStackRef.current = [];
    lastSnapshotRef.current = snapshot;
    emitUndoState();
  }, [drawingPaths, edges, emitUndoState, nodes, scenes]);

  const restoreSnapshot = useCallback(
    (snapshot: WhiteboardCanvasSnapshot) => {
      const cloned = cloneCanvasSnapshot(snapshot);
      setNodes(cloned.nodes);
      setEdges(cloned.edges);
      setDrawingPaths(cloned.drawingPaths);
      setScenes(cloned.scenes);
      lastSnapshotRef.current = cloned;
    },
    [setEdges, setNodes]
  );

  const undoWhiteboard = useCallback(() => {
    const previous = undoStackRef.current[undoStackRef.current.length - 1];
    if (!previous) return;
    const current = cloneCanvasSnapshot({ nodes, edges, drawingPaths, scenes });
    undoStackRef.current = undoStackRef.current.slice(0, -1);
    redoStackRef.current = [current, ...redoStackRef.current.slice(0, 24)];
    restoreSnapshot(previous);
    emitUndoState();
    appendActivity(
      createWhiteboardActivityEntry('history', t('myWork.whiteboard.activity.undo'), currentUserId)
    );
  }, [
    appendActivity,
    currentUserId,
    drawingPaths,
    edges,
    emitUndoState,
    isPl,
    nodes,
    restoreSnapshot,
    scenes,
  ]);

  const redoWhiteboard = useCallback(() => {
    const next = redoStackRef.current[0];
    if (!next) return;
    const current = cloneCanvasSnapshot({ nodes, edges, drawingPaths, scenes });
    redoStackRef.current = redoStackRef.current.slice(1);
    undoStackRef.current = [...undoStackRef.current.slice(-24), current];
    restoreSnapshot(next);
    emitUndoState();
    appendActivity(
      createWhiteboardActivityEntry('history', t('myWork.whiteboard.activity.redo'), currentUserId)
    );
  }, [
    appendActivity,
    currentUserId,
    drawingPaths,
    edges,
    emitUndoState,
    isPl,
    nodes,
    restoreSnapshot,
    scenes,
  ]);
  const handleSelectionUpdate = useCallback(
    (nds: Node[]) => {
      const selected = nds.filter((n: Node) => n.selected);
      if (selected.length === 0) {
        onSelectionChange?.(EMPTY_SELECTION);
      } else {
        onSelectionChange?.({
          type: 'node',
          count: selected.length,
          ids: selected.map((n: Node) => n.id),
          primaryId: selected[0]?.id,
          meta: {
            nodeType: selected[0]?.type,
            label: selected[0]?.data?.label,
            description: selected[0]?.data?.description,
            owner: selected[0]?.data?.owner,
            status: selected[0]?.data?.status,
            tags: Array.isArray(selected[0]?.data?.tags) ? selected[0]?.data?.tags : undefined,
            artifactRef: selected[0]?.data?.artifactRef,
            attachments: Array.isArray(selected[0]?.data?.attachments)
              ? selected[0]?.data?.attachments
              : undefined,
            shape:
              typeof selected[0]?.data?.shape === 'string' ? selected[0]?.data?.shape : undefined,
            semanticType: inferWhiteboardSemanticType(selected[0]),
          },
        });
      }
    },
    [onSelectionChange]
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const mutatingChange = changes.some(
        (change) => change.type !== 'select' && change.type !== 'dimensions'
      );
      if (mutatingChange) pushUndoSnapshot();
      setNodes((nds) => {
        const filteredChanges = changes.filter((change) => {
          if (change.type === 'select') return true;
          const targetNode = nds.find((node) => node.id === change.id);
          return !isNodeDataLocked(targetNode);
        });
        const next = applyNodeChanges(filteredChanges, nds);
        const hasSelectionChange = changes.some((c: NodeChange) => c.type === 'select');
        if (hasSelectionChange) handleSelectionUpdate(next);
        // L-02: emit final positions / removals to collaborators.
        collab.broadcastNodeChanges(changes, next);
        return next;
      });
    },
    [collab, handleSelectionUpdate, pushUndoSnapshot]
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      if (changes.some((change) => change.type !== 'select')) pushUndoSnapshot();
      collab.broadcastEdgeChanges(changes);
      setEdges((eds) => applyEdgeChanges(changes, eds));
    },
    [collab, pushUndoSnapshot]
  );
  const [extensions, setExtensions] = useState<Record<string, unknown>>({});

  useEffect(() => {
    onGraphChange?.({
      nodes: nodes as any[],
      edges: edges as any[],
      extensions,
    });
  }, [edges, extensions, nodes, onGraphChange]);

  const frameCollapseKey = nodes
    .filter((n) => n.type === 'frameNode')
    .map((n) => `${n.id}:${n.data?.collapsed ? 1 : 0}`)
    .join(',');

  useEffect(() => {
    setNodes((nds) => {
      const frames = nds.filter((n) => n.type === 'frameNode');
      if (frames.length === 0) return nds;

      const childCounts = new Map<string, number>();
      for (const n of nds) {
        const pid = (n as any).parentNode || (n as any).parentId;
        if (pid) childCounts.set(pid, (childCounts.get(pid) || 0) + 1);
      }

      let changed = false;
      const next = nds.map((n) => {
        if (n.type === 'frameNode') {
          const count = childCounts.get(n.id) || 0;
          if (n.data?.childCount !== count) {
            changed = true;
            return { ...n, data: { ...n.data, childCount: count } };
          }
        }
        const pid = (n as any).parentNode || (n as any).parentId;
        if (pid) {
          const parent = frames.find((f) => f.id === pid);
          if (parent && Boolean(parent.data?.collapsed) !== Boolean(n.hidden)) {
            changed = true;
            return { ...n, hidden: Boolean(parent.data?.collapsed) };
          }
        }
        return n;
      });
      return changed ? next : nds;
    });
  }, [frameCollapseKey, setNodes]);

  const didPersistRef = useRef(false);
  const stickyColorCounter = useRef(0);
  // Guard against re-entrant hydration. The hydrate effect re-runs whenever `hydrate`'s
  // identity or `refreshToken` changes; on a saturated connection pool a second hydrate
  // could fire before the GET /map of the first resolves, piling up pending requests and
  // wedging the board on the skeleton forever. One fetch in flight at a time.
  const hydrateInFlightRef = useRef(false);

  // ── Hydrate ──────────────────────────────────────────────────────────────

  const hydrate = useCallback(async () => {
    if (!open) return;
    if (hydrateInFlightRef.current) return;
    hydrateInFlightRef.current = true;
    setLoading(true);
    try {
      const res = await Api.getMyIdeaMap(ideaId, { language: i18n.language });
      const hydration = resolveIdeaMapHydration(ideaId, res?.map || {});
      const map = hydration.map || {};
      primeServerVersion(Number(map?.version || 1));
      const rawNodes = Array.isArray(map.nodes) ? (map.nodes as any[]) : [];
      const rawEdges = Array.isArray(map.edges) ? (map.edges as any[]) : [];
      const rawExt =
        map?.extensions && typeof map.extensions === 'object'
          ? (map.extensions as Record<string, unknown>)
          : {};

      const hydratedNodes = rawNodes
        .filter((n: any) => n?.id)
        .map((n: any) => {
          const normalizedNode = withNormalizedArtifactLinks(n);
          const nid = String(normalizedNode.id);
          const nodeData: Record<string, unknown> = {
            ...(normalizedNode?.data || { label: '' }),
            locked,
            semanticLabel: getSemanticTypeLabel(
              inferWhiteboardSemanticType(normalizedNode),
              Boolean(isPl)
            ),
            onLabelChange: (next: string) => {
              setNodes((nds: Node[]) =>
                nds.map((nd: Node) =>
                  nd.id === nid ? { ...nd, data: { ...nd.data, label: next } } : nd
                )
              );
            },
            // B4: reaction wiring. `reactionsEnabled` is refreshed by a
            // dedicated effect whenever the session flag flips; the persisted
            // `reactions` array survives via the normalizedNode.data spread.
            currentUserId,
            reactionsEnabled: reactionsActiveRef.current,
            onToggleReaction: handleToggleReaction,
          };
          if (normalizedNode?.type === 'frameNode') {
            nodeData.onCollapseToggle = (next: boolean) => {
              setNodes((nds: Node[]) =>
                nds.map((nd: Node) =>
                  nd.id === nid ? { ...nd, data: { ...nd.data, collapsed: next } } : nd
                )
              );
            };
          }
          // L-05b: ensure resizable node types have a concrete style box so the
          // 100%-fill wrapper + NodeResizer work even on boards saved before resize.
          // Use a narrow style shape (not React.CSSProperties) to keep type-checking light.
          let hydratedStyle:
            | { width: number; height: number }
            | Record<string, unknown>
            | undefined;
          if (normalizedNode?.style) {
            hydratedStyle = normalizedNode.style as Record<string, unknown>;
          } else if (normalizedNode?.type === 'shapeNode') {
            const sh = normalizedNode?.data?.shape;
            hydratedStyle = {
              width: sh === 'circle' ? 120 : sh === 'diamond' ? 100 : sh === 'hexagon' ? 140 : 160,
              height: sh === 'circle' ? 120 : sh === 'diamond' ? 100 : sh === 'hexagon' ? 120 : 80,
            };
          } else if (normalizedNode?.type === 'imageNode') {
            hydratedStyle = {
              width: Number(normalizedNode?.data?.width || 200),
              height: Number(normalizedNode?.data?.height || 150),
            };
          } else if (normalizedNode?.type === 'textBlock') {
            hydratedStyle = { width: 220, height: 80 };
          }
          const hydratedNode: Node = {
            id: nid,
            type: normalizedNode?.type || 'stickyNote',
            position: normalizedNode?.position || { x: 100, y: 100 },
            data: nodeData,
            // Ramka jest KONTENEREM, nie elementem operowanym. React Flow nadaje
            // kazdemu fokusowalnemu wezlowi `role="button"`, a ramka slusznie
            // zawiera wlasny przycisk zwijania — powstawal przycisk w przycisku
            // (axe: nested-interactive). Zdejmujemy fokus z samej ramki; jej
            // przycisk zwijania i tak zostaje w kolejnosci tabulacji, bo jest
            // prawdziwym <button>. Pozostale typy wezlow bez zmian.
            ...(normalizedNode?.type === 'frameNode' ? { focusable: false } : {}),
            ...(normalizedNode?.parentNode ||
            normalizedNode?.parentId ||
            normalizedNode?.data?.parentId
              ? {
                  parentNode:
                    normalizedNode?.parentNode ||
                    normalizedNode?.parentId ||
                    normalizedNode?.data?.parentId,
                  parentId:
                    normalizedNode?.parentId ||
                    normalizedNode?.parentNode ||
                    normalizedNode?.data?.parentId,
                }
              : {}),
            ...(hydratedStyle ? { style: hydratedStyle as React.CSSProperties } : {}),
          };
          return hydratedNode;
        });
      setNodes(hydratedNodes);
      setEdges(
        rawEdges
          .filter((e: any) => e?.id && e?.source && e?.target)
          .map((e: any) => ({
            id: String(e.id),
            source: String(e.source),
            target: String(e.target),
            type: e?.type || 'labeled',
            animated: Boolean(e?.animated),
            label: e?.label || e?.data?.label || '',
            data: e?.data || {},
          }))
      );
      setExtensions(rawExt);

      const wbExt =
        rawExt?.whiteboard && typeof rawExt.whiteboard === 'object'
          ? (rawExt.whiteboard as Record<string, any>)
          : {};
      if (Array.isArray(wbExt.drawingPaths)) setDrawingPaths(wbExt.drawingPaths);
      if (Array.isArray(wbExt.scenes)) setScenes(wbExt.scenes);
      if (wbExt.mode === 'board' || wbExt.mode === 'draw') {
        // Kontrakt persystencji zostaje 'board' | 'draw' (zapisane tablice) —
        // mapujemy na jeden stan trybu; 'board' wraca jako 'select'.
        setCanvasMode(wbExt.mode === 'draw' ? 'draw' : 'select');
      }
      if (wbExt.sessionState && typeof wbExt.sessionState === 'object') {
        setSessionState({
          ...DEFAULT_SESSION_STATE,
          toolSessionId,
          ...(wbExt.sessionState as Partial<WhiteboardSessionState>),
        });
      } else {
        setSessionState({ ...DEFAULT_SESSION_STATE, toolSessionId });
      }
      if (wbExt.sharePolicy && typeof wbExt.sharePolicy === 'object') {
        setSharePolicy({
          ...DEFAULT_SHARE_POLICY,
          ...(wbExt.sharePolicy as Partial<WhiteboardSharePolicy>),
        });
      } else {
        setSharePolicy(DEFAULT_SHARE_POLICY);
      }
      setLibraryItems(Array.isArray(wbExt.libraryItems) ? wbExt.libraryItems : []);
      setOutcomeRegistry(Array.isArray(wbExt.outcomeRegistry) ? wbExt.outcomeRegistry : []);
      setActivityLog(Array.isArray(wbExt.activityLog) ? wbExt.activityLog : []);
      setHistoryLog(Array.isArray(wbExt.historyLog) ? wbExt.historyLog : []);
      setSessionVotes(
        wbExt.sessionVotes && typeof wbExt.sessionVotes === 'object' ? wbExt.sessionVotes : {}
      );
      if (wbExt.bgPattern && ['dots', 'grid', 'lines', 'blank'].includes(wbExt.bgPattern)) {
        setBgPattern(wbExt.bgPattern as CanvasBgPattern);
      }
      if (wbExt.latestSnapshot && typeof wbExt.latestSnapshot === 'object') {
        lastSnapshotRef.current = wbExt.latestSnapshot as WhiteboardCanvasSnapshot;
      }

      if (!didPersistRef.current) {
        didPersistRef.current = true;
        const preferred = map?.preferredTool ? String(map.preferredTool) : null;
        if (preferred !== 'whiteboard') {
          Api.syncMyIdeaMap(ideaId, {
            nodes: rawNodes as any,
            edges: rawEdges as any,
            baseVersion: Number(map?.version || 1),
            preferredTool: 'whiteboard',
            extensions: rawExt,
          }).catch(() => toast.error(t('myWork.whiteboard.errors.syncFailed')));
        }
      }
    } catch (err: any) {
      toast.error(err?.message || t('myWork.whiteboard.errors.loadFailed'));
      setNodes([]);
      setEdges([]);
      setExtensions({});
    } finally {
      setLoading(false);
      hydrateInFlightRef.current = false;
    }
  }, [
    currentUserId,
    handleToggleReaction,
    i18n.language,
    ideaId,
    isPl,
    open,
    setEdges,
    setNodes,
    toolSessionId,
  ]);

  useEffect(() => {
    if (!open) return;
    didPersistRef.current = false;
    hydrate();
  }, [hydrate, open, refreshToken]);

  const rememberSnapshot = useCallback(
    (label: string) => {
      lastSnapshotRef.current = cloneCanvasSnapshot({
        nodes,
        edges,
        drawingPaths,
        scenes,
      });
      setHistoryLog((prev) => [createWhiteboardHistoryEntry(label), ...prev].slice(0, 20));
    },
    [drawingPaths, edges, nodes, scenes]
  );

  const buildWhiteboardExtensions = useCallback(() => {
    return {
      ...(extensions?.whiteboard && typeof extensions.whiteboard === 'object'
        ? extensions.whiteboard
        : {}),
      mode: whiteboardMode,
      viewState: { snap: false, showGrid: true },
      drawingPaths,
      scenes,
      bgPattern,
      sessionState: {
        ...sessionState,
        updatedAt: Date.now(),
      },
      sharePolicy,
      libraryItems,
      outcomeRegistry,
      activityLog,
      historyLog,
      sessionVotes,
      myVoteCounts,
      latestSnapshot: lastSnapshotRef.current,
    };
  }, [
    activityLog,
    bgPattern,
    drawingPaths,
    extensions,
    historyLog,
    libraryItems,
    myVoteCounts,
    outcomeRegistry,
    scenes,
    sessionState,
    sessionVotes,
    sharePolicy,
    whiteboardMode,
  ]);
  const saveStatusLabel = useMemo(
    () => formatIdeaMapSyncLabel(syncState, lastSavedAt, isPl),
    [isPl, lastSavedAt, syncState]
  );
  const buildPersistPayload = useCallback(
    () => ({
      nodes: nodes as any,
      edges: edges as any,
      preferredTool: 'whiteboard' as CanvasToolType,
      extensions: {
        ...extensions,
        whiteboard: buildWhiteboardExtensions(),
      },
    }),
    [buildWhiteboardExtensions, edges, extensions, nodes]
  );

  // B1 (M09): read THIS user's own role row from the shared session (tool_facilitation_roles).
  // Returns 'observer' | 'facilitator' | 'participant' | null. Best-effort: any failure → null
  // so we fall back to the facilitator_id-derived default and never wrongly lock the board.
  const resolveMyAssignedRole = useCallback(
    async (sessionId: string): Promise<string | null> => {
      try {
        const res: any = await Api.facilitationGetRoles(sessionId);
        const roles: any[] = Array.isArray(res?.roles) ? res.roles : [];
        const mine = roles.find((r) => String(r?.user_id ?? r?.userId ?? '') === currentUserId);
        const roleName = String(mine?.role_name ?? mine?.roleName ?? '').toLowerCase();
        return roleName || null;
      } catch {
        return null;
      }
    },
    [currentUserId]
  );

  const ensureFacilitationSession = useCallback(async () => {
    if (sessionState.sessionId) return sessionState.sessionId;
    // Idempotent on the server (M09 L-04): a 2nd participant on the same board resolves
    // to the SAME shared session (shared timer/phase/voting/roles), not a private one.
    const created = await Api.facilitationCreateSession({
      toolSessionId,
      settings: { tool: 'whiteboard', ideaId },
    });
    const sessionId = String(created?.id || '');
    if (!sessionId) throw new Error(t('myWork.whiteboard.errors.missingSessionId'));

    // M09 L-04: READ the shared session state from the server (previously 0 call-sites).
    // Role is derived from the server's facilitator_id (the session creator) — NOT
    // self-assigned on the client; joiners become participants automatically.
    const server: any = await Api.facilitationGetSession(sessionId).catch(() => null);
    const facilitatorId = String(server?.facilitator_id || server?.facilitatorId || '');
    // B1 (M09): a facilitator can assign THIS user the 'observer' role; that assignment
    // (tool_facilitation_roles) overrides the facilitator_id-derived default so the board
    // renders read-only. Roles table wins for 'observer'; otherwise fall back to the
    // creator-vs-joiner default (facilitator / participant).
    const assignedRole = await resolveMyAssignedRole(sessionId);
    const serverRole =
      assignedRole === 'observer'
        ? 'observer'
        : facilitatorId && facilitatorId === currentUserId
          ? 'facilitator'
          : 'participant';
    const rawTimer = server?.timer_state ?? server?.timerState;
    const timerState: Record<string, unknown> =
      rawTimer && typeof rawTimer === 'object'
        ? (rawTimer as Record<string, unknown>)
        : typeof rawTimer === 'string'
          ? ((): Record<string, unknown> => {
              try {
                return JSON.parse(rawTimer);
              } catch {
                return {};
              }
            })()
          : {};
    const serverPhase = server?.current_phase ?? server?.currentPhase;

    setSessionState((prev) => ({
      ...prev,
      active: true,
      sessionId,
      toolSessionId,
      role: serverRole as typeof prev.role,
      facilitationPhase: ((typeof serverPhase === 'string' && serverPhase) ||
        prev.facilitationPhase) as typeof prev.facilitationPhase,
      timerEndsAt:
        typeof timerState.endsAt === 'number' ? (timerState.endsAt as number) : prev.timerEndsAt,
      // Voting-open is signalled by the server phase ('voting'); toggleSessionVoting
      // persists it via facilitationUpdatePhase, so joiners pick it up here.
      votingOpen:
        serverPhase === 'voting' ||
        (typeof timerState.votingOpen === 'boolean'
          ? (timerState.votingOpen as boolean)
          : prev.votingOpen),
      updatedAt: Date.now(),
    }));

    // Only the facilitator (session creator) records the facilitator role row; joiners
    // are participants by default and must not override the facilitator.
    if (serverRole === 'facilitator') {
      await Api.facilitationAssignRole(sessionId, {
        userId: currentUserId,
        roleName: 'facilitator',
        permissions: ['timer', 'voting', 'follow'],
      }).catch(() => toast.error(t('myWork.whiteboard.errors.roleChangeFailed')));
    }
    return sessionId;
  }, [currentUserId, ideaId, resolveMyAssignedRole, sessionState.sessionId, t, toolSessionId]);

  const syncFacilitationVotes = useCallback(
    async (sessionId: string) => {
      const [summaryRes, votesRes] = await Promise.all([
        Api.facilitationGetVoteSummary(sessionId),
        Api.facilitationGetVotes(sessionId),
      ]);
      const summary = Array.isArray(summaryRes?.summary) ? summaryRes.summary : [];
      const votes = Array.isArray(votesRes?.votes) ? votesRes.votes : [];
      setSessionVotes(normalizeVoteSummary(summary));
      setMyVoteCounts(
        (votes as Array<Record<string, unknown>>).reduce((acc: Record<string, number>, vote) => {
          if (String(vote.voter_id || vote.voterId || '') !== currentUserId) return acc;
          const nodeId = String(vote.vote_target_id || vote.voteTargetId || '');
          if (!nodeId) return acc;
          acc[nodeId] = (acc[nodeId] || 0) + Number(vote.vote_value ?? vote.voteValue ?? 1);
          return acc;
        }, {})
      );
    },
    [currentUserId]
  );

  /**
   * Wejście „Rysuj / Canvas" (przycisk paska Tablicy + skrót Esc + quick action
   * `wb_mode_draw`). Zachowuje dotychczasowy kontrakt 'board' | 'draw', ale
   * ustawia JEDEN stan: 'draw' albo powrót do zaznaczania.
   */
  const setBoardMode = useCallback(
    (mode: 'board' | 'draw') => {
      setCanvasMode(mode === 'draw' ? 'draw' : 'select');
      appendActivity(
        createWhiteboardActivityEntry(
          'session',
          mode === 'draw'
            ? t('myWork.whiteboard.activity.drawModeEnabled')
            : t('myWork.whiteboard.activity.boardModeEnabled'),
          currentUserId
        )
      );
    },
    [appendActivity, currentUserId, isPl]
  );

  /**
   * Z1: wejście z lewego raila (`mm_select_mode` / `mm_pan_mode`). Ten sam,
   * jedyny stan trybu — więc wybranie Zaznaczania/Przesuwania automatycznie
   * wychodzi z trybu rysowania, zamiast zostawiać dwa sprzeczne stany.
   */
  const setCursorMode = useCallback((mode: 'select' | 'pan') => {
    setCanvasMode(mode);
  }, []);

  // Rail dostaje `interactionMode` z IdeaMapWorkspace i nie wie nic o trybie
  // „Rysuj" Tablicy — rozgłaszamy realny tryb, żeby ikona pstryczka nie kłamała.
  useEffect(() => {
    if (!open) return;
    publishIdeaCanvasCursorMode('whiteboard', canvasMode);
  }, [canvasMode, open]);

  const whiteboardModeCopy = useMemo(
    () => getWhiteboardModeCopy(whiteboardMode, isPl, locked),
    [isPl, locked, whiteboardMode]
  );
  const whiteboardShortcuts = useMemo(() => getWhiteboardShortcuts(isPl), [isPl]);

  const cycleSessionRole = useCallback(() => {
    const previousRole = sessionState.role;
    const nextRole = cycleWhiteboardRole(previousRole);
    setSessionState((prev) => ({
      ...prev,
      active: true,
      role: nextRole,
      updatedAt: Date.now(),
    }));
    appendActivity(
      createWhiteboardActivityEntry(
        'session',
        t('myWork.whiteboard.activity.sessionRole', { role: nextRole }),
        currentUserId
      )
    );
    ensureFacilitationSession()
      .then((sessionId) =>
        Api.facilitationAssignRole(sessionId, {
          userId: currentUserId,
          roleName: nextRole,
          permissions: nextRole === 'facilitator' ? ['timer', 'voting', 'follow'] : [],
        })
      )
      .catch((error: unknown) => {
        // Server rejected the role change (e.g. 403 — backend authz gate: only the
        // session owner, an existing facilitator, or an org admin may assign roles).
        // Revert the optimistic local role so the UI doesn't show a role the
        // server never persisted.
        if ((error as { status?: number } | null)?.status === 403) {
          setSessionState((prev) => ({
            ...prev,
            role: previousRole,
            updatedAt: Date.now(),
          }));
        }
        toast.error(t('myWork.whiteboard.errors.roleChangeFailed'));
      });
  }, [appendActivity, currentUserId, ensureFacilitationSession, isPl, sessionState.role]);

  const toggleSessionTimer = useCallback(() => {
    const timerEndsAt = sessionState.timerEndsAt
      ? null
      : Date.now() + sessionState.timerSeconds * 1000;
    const nextState = {
      ...sessionState,
      active: true,
      timerEndsAt,
      updatedAt: Date.now(),
    };
    setSessionState(nextState);
    appendActivity(
      createWhiteboardActivityEntry(
        'session',
        timerEndsAt
          ? t('myWork.whiteboard.activity.timerStarted')
          : t('myWork.whiteboard.activity.timerStopped'),
        currentUserId
      )
    );
    ensureFacilitationSession()
      .then((sessionId) =>
        Api.facilitationUpdateTimer(sessionId, {
          timerEndsAt,
          timerSeconds: sessionState.timerSeconds,
          updatedBy: currentUserId,
        })
      )
      .catch(() => toast.error(t('myWork.whiteboard.errors.timerFailed')));
  }, [appendActivity, currentUserId, ensureFacilitationSession, isPl, sessionState]);

  const toggleSessionVoting = useCallback(() => {
    const votingOpen = !sessionState.votingOpen;
    setSessionState((prev) => ({
      ...prev,
      active: true,
      votingOpen,
      updatedAt: Date.now(),
    }));
    window.dispatchEvent(
      new CustomEvent('idea-whiteboard-toggle-voting-overlay', {
        detail: { open: votingOpen, ideaId },
      })
    );
    appendActivity(
      createWhiteboardActivityEntry(
        'session',
        votingOpen
          ? t('myWork.whiteboard.activity.votingOpened')
          : t('myWork.whiteboard.activity.votingClosed'),
        currentUserId
      )
    );
    ensureFacilitationSession()
      .then(async (sessionId) => {
        await Api.facilitationUpdatePhase(sessionId, votingOpen ? 'voting' : 'board');
        if (votingOpen) {
          await syncFacilitationVotes(sessionId);
        }
      })
      .catch(() => toast.error(t('myWork.whiteboard.errors.votingFailed')));
  }, [
    appendActivity,
    currentUserId,
    ensureFacilitationSession,
    ideaId,
    isPl,
    sessionState.votingOpen,
    syncFacilitationVotes,
  ]);

  const toggleSessionFollow = useCallback(() => {
    const followMe = !sessionState.followMe;
    setSessionState((prev) => ({ ...prev, active: true, followMe, updatedAt: Date.now() }));
    appendActivity(
      createWhiteboardActivityEntry(
        'session',
        followMe
          ? t('myWork.whiteboard.activity.followMeOn')
          : t('myWork.whiteboard.activity.followMeOff'),
        currentUserId
      )
    );
    ensureFacilitationSession()
      .then((sessionId) => Api.facilitationUpdatePhase(sessionId, followMe ? 'follow_me' : 'board'))
      .catch(() => toast.error(t('myWork.whiteboard.errors.followFailed')));
  }, [appendActivity, currentUserId, ensureFacilitationSession, isPl, sessionState.followMe]);

  const handlePhaseChange = useCallback(
    (phase: FacilitationPhase) => {
      const current = sessionState.facilitationPhase;
      const valid = FACILITATION_TRANSITIONS[current];
      if (!valid.includes(phase)) return;
      setSessionState((prev) => ({
        ...prev,
        active: true,
        facilitationPhase: phase,
        updatedAt: Date.now(),
      }));
      appendActivity(
        createWhiteboardActivityEntry(
          'session',
          t('myWork.whiteboard.activity.phase', { phase }),
          currentUserId
        )
      );
      toast.success(t('myWork.whiteboard.toast.phaseChanged', { phase }), { duration: 1200 });
      ensureFacilitationSession()
        .then((sessionId) => Api.facilitationUpdatePhase(sessionId, phase))
        .catch(() => toast.error(t('myWork.whiteboard.errors.phaseChangeFailed')));

      if (phase === 'handoff') {
        setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent('idea-workspace-quick-action', {
              detail: { action: 'convert_initiative', ideaId },
            })
          );
        }, 800);
      }
    },
    [appendActivity, currentUserId, ensureFacilitationSession, isPl, sessionState.facilitationPhase]
  );

  const toggleSpotlightSelection = useCallback(() => {
    const selectedId = nodes.find((node) => node.selected)?.id || null;
    const spotlightNodeId = sessionState.spotlightNodeId === selectedId ? null : selectedId;
    setSessionState((prev) => ({ ...prev, active: true, spotlightNodeId, updatedAt: Date.now() }));
    appendActivity(
      createWhiteboardActivityEntry(
        'session',
        spotlightNodeId
          ? t('myWork.whiteboard.activity.spotlightSet')
          : t('myWork.whiteboard.activity.spotlightCleared'),
        currentUserId,
        selectedId ? [selectedId] : undefined
      )
    );
  }, [appendActivity, currentUserId, isPl, nodes]);

  const importOutline = useCallback(() => {
    if (!locked) setOutlineImportOpen(true);
  }, [appendActivity, currentUserId, isPl, locked, rememberSnapshot]);

  const saveSelectionToLibrary = useCallback(() => {
    const selected = nodes.filter((node) => node.selected);
    if (selected.length === 0) {
      toast(t('myWork.whiteboard.toast.selectFirst'));
      return;
    }
    const selectedIds = new Set(selected.map((node) => node.id));
    const item: WhiteboardLibraryItem = {
      id: `wb-library-${Date.now()}`,
      name:
        selected.length === 1
          ? String(selected[0]?.data?.label || t('myWork.whiteboard.nodes.groupLabel'))
          : `${t('myWork.whiteboard.nodes.groupLabel')} (${selected.length})`,
      createdAt: Date.now(),
      nodes: selected.map((node) => ({
        ...node,
        selected: false,
      })),
      edges: edges.filter((edge) => selectedIds.has(edge.source) && selectedIds.has(edge.target)),
    };
    setLibraryItems((prev) => [item, ...prev].slice(0, 12));
    appendActivity(
      createWhiteboardActivityEntry(
        'library',
        t('myWork.whiteboard.activity.savedToLibrary'),
        currentUserId,
        selected.map((node) => node.id)
      )
    );
  }, [appendActivity, currentUserId, edges, isPl, nodes]);

  const insertLatestLibraryItem = useCallback(() => {
    const item = libraryItems[0];
    if (!item) {
      toast(t('myWork.whiteboard.toast.libraryEmpty'));
      return;
    }
    pushUndoSnapshot();
    const idMap = new Map<string, string>();
    const insertedNodes = item.nodes.map((rawNode, index) => {
      const originalId = String(rawNode.id || '');
      const nextId = `wb-lib-${Date.now()}-${index}`;
      idMap.set(originalId, nextId);
      return {
        ...rawNode,
        id: nextId,
        position: {
          x: Number((rawNode.position as any)?.x || 0) + 80,
          y: Number((rawNode.position as any)?.y || 0) + 80,
        },
        selected: false,
        data: {
          ...((rawNode.data as Record<string, unknown>) || {}),
          onLabelChange: (label: string) => {
            setNodes((prev) =>
              prev.map((node) =>
                node.id === nextId ? { ...node, data: { ...node.data, label } } : node
              )
            );
          },
        },
      } as Node;
    });
    const insertedEdges = item.edges.map((rawEdge, index) => ({
      ...rawEdge,
      id: `wb-edge-lib-${Date.now()}-${index}`,
      source: idMap.get(String(rawEdge.source || '')) || String(rawEdge.source || ''),
      target: idMap.get(String(rawEdge.target || '')) || String(rawEdge.target || ''),
    })) as Edge[];
    setNodes((prev) => [...prev, ...insertedNodes]);
    setEdges((prev) => [...prev, ...insertedEdges]);
    appendActivity(
      createWhiteboardActivityEntry(
        'library',
        t('myWork.whiteboard.activity.insertedFromLibrary'),
        currentUserId,
        insertedNodes.map((node) => node.id)
      )
    );
    rememberSnapshot(t('myWork.whiteboard.history.insertLibraryFragment'));
  }, [appendActivity, currentUserId, isPl, libraryItems, pushUndoSnapshot, rememberSnapshot]);

  const restoreLatestHistory = useCallback(() => {
    if (!lastSnapshotRef.current) {
      toast(t('myWork.whiteboard.toast.noSnapshot'));
      return;
    }
    const snapshot = lastSnapshotRef.current;
    pushUndoSnapshot();
    restoreSnapshot(snapshot);
    appendActivity(
      createWhiteboardActivityEntry(
        'history',
        t('myWork.whiteboard.activity.restoredSnapshot'),
        currentUserId
      )
    );
  }, [appendActivity, currentUserId, isPl, pushUndoSnapshot, restoreSnapshot]);

  const cycleGovernance = useCallback(() => {
    setSharePolicy((prev) => {
      const classification = cycleWhiteboardClassification(prev.classification);
      appendActivity(
        createWhiteboardActivityEntry(
          'governance',
          t('myWork.whiteboard.activity.classification', { classification }),
          currentUserId
        )
      );
      return {
        ...prev,
        classification,
        watermark: `${classification.toUpperCase()} • ${
          String(prev.watermark || 'Consultify Whiteboard')
            .split(' • ')
            .slice(-1)[0]
        }`,
      };
    });
  }, [appendActivity, currentUserId, isPl]);

  // ── Connections ──────────────────────────────────────────────────────────

  const onConnect = useCallback(
    (connection: Connection) => {
      if (locked) return;
      const sourceNode = nodes.find((node) => node.id === connection.source);
      const targetNode = nodes.find((node) => node.id === connection.target);
      if (isNodeDataLocked(sourceNode) || isNodeDataLocked(targetNode)) return;
      pushUndoSnapshot();
      setEdges((eds: Edge[]) => {
        const next = addEdge({ ...connection, type: 'labeled' }, eds);
        // L-02: broadcast the newly created edge to collaborators.
        const added = next.find((e: Edge) => !eds.some((prev) => prev.id === e.id));
        if (added) collab.broadcastEdgeAdd(added);
        return next;
      });
    },
    [collab, locked, nodes, pushUndoSnapshot, setEdges]
  );

  // ── Add elements ─────────────────────────────────────────────────────────

  const createNode = useCallback(
    // `index` is kept for call-site compatibility (batch ordering) but no
    // longer drives placement directly — see the placement service call
    // below, which is collision-aware instead of a fixed per-index offset.
    // `extraOccupiedRects` lets a caller building several nodes in one batch
    // (paste, outline import, AI proposal apply) pass the rects of siblings
    // it already created earlier in the *same* batch — those haven't reached
    // `nodes` state yet, so without this a 12-item batch could still stack
    // on itself even though each call is individually collision-checked
    // against the canvas.
    (
      kind: WbNodeKind,
      extraData?: Record<string, unknown>,
      _index = 0,
      extraOccupiedRects: WhiteboardRect[] = []
    ): Node => {
      const id = `wb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const explicitPosition = extraData?.position as { x: number; y: number } | undefined;

      const typeMap: Record<WbNodeKind, string> = {
        sticky: 'stickyNote',
        text: 'textBlock',
        group: 'frameNode',
        shape_rectangle: 'shapeNode',
        shape_circle: 'shapeNode',
        shape_diamond: 'shapeNode',
        shape_hexagon: 'shapeNode',
        frame: 'frameNode',
        image: 'imageNode',
        link: 'linkNode',
        kpi_badge: 'kpiBadge',
        score: 'scoreNode',
        progress: 'progressNode',
        summary: 'summaryCard',
      };

      const shapeMap: Record<string, string> = {
        shape_rectangle: 'rectangle',
        shape_circle: 'circle',
        shape_diamond: 'diamond',
        shape_hexagon: 'hexagon',
      };

      const defaultLabelKeys: Record<WbNodeKind, string> = {
        sticky: 'defaultSticky',
        text: 'defaultText',
        group: 'defaultGroup',
        shape_rectangle: 'defaultShape',
        shape_circle: 'defaultShape',
        shape_diamond: 'defaultShape',
        shape_hexagon: 'defaultShape',
        frame: 'defaultFrame',
        image: 'defaultImage',
        link: 'defaultLink',
        kpi_badge: 'defaultKpi',
        score: 'defaultScore',
        progress: 'defaultProgress',
        summary: 'defaultSummary',
      };

      const colorIndex = kind === 'sticky' ? stickyColorCounter.current++ : 0;
      const labelKey = defaultLabelKeys[kind] || 'defaultText';

      const nodeData: Record<string, unknown> = {
        label: t(`myWork.whiteboard.nodes.${labelKey}`),
        locked: Boolean(extraData?.locked ?? locked),
        semanticType:
          typeof extraData?.semanticType === 'string'
            ? extraData.semanticType
            : kind === 'sticky'
              ? 'note'
              : kind === 'image'
                ? 'image'
                : kind === 'link'
                  ? 'link'
                  : undefined,
        semanticLabel:
          typeof extraData?.semanticType === 'string'
            ? getSemanticTypeLabel(extraData.semanticType as any, Boolean(isPl))
            : undefined,
        onLabelChange: (next: string) => {
          setNodes((nds: Node[]) =>
            nds.map((nd: Node) =>
              nd.id === id ? { ...nd, data: { ...nd.data, label: next } } : nd
            )
          );
        },
        // WB-P2-01: paired with `_isNew` below — StickyNoteNode/TextBlockNode
        // open straight into inline naming for a brand-new object (no need to
        // already know about double-click) and call this back once, on
        // mount, to clear the flag. Without the clear, `_isNew` would sit in
        // persisted node data forever and re-trigger edit mode on every
        // later remount of the SAME node (e.g. its parent frame collapsing
        // then expanding), not just the one moment right after creation.
        onConsumeAutoEdit: () => {
          setNodes((nds: Node[]) =>
            nds.map((nd: Node) =>
              nd.id === id && nd.data?._isNew
                ? { ...nd, data: { ...nd.data, _isNew: false } }
                : nd
            )
          );
        },
        // B4: seed reactions wiring on freshly-created nodes too — otherwise a
        // node added mid-session (after the one-shot hydrate/flag-flip sync
        // effect ran) would silently lack `onToggleReaction`/`currentUserId`
        // and never render the affordance even while a session is active.
        currentUserId,
        reactionsEnabled: reactionsActiveRef.current,
        onToggleReaction: handleToggleReaction,
        ...(extraData || {}),
      };
      delete nodeData.position;

      if (kind === 'sticky') nodeData.colorIndex = colorIndex % STICKY_COLORS.length;
      if (shapeMap[kind]) nodeData.shape = shapeMap[kind];
      if (kind === 'frame') {
        nodeData.width = 400;
        nodeData.height = 300;
        nodeData.collapsed = false;
        nodeData.childCount = 0;
        nodeData.onCollapseToggle = (next: boolean) => {
          setNodes((nds: Node[]) =>
            nds.map((nd: Node) =>
              nd.id === id ? { ...nd, data: { ...nd.data, collapsed: next } } : nd
            )
          );
        };
      }

      // L-05b: give resizable nodes an initial style box so NodeResizer has a
      // concrete size to grow from (the node element provides the 100% wrapper box).
      const nodeType = typeMap[kind];
      let initialStyle: { width: number; height: number } | undefined;
      if (kind === 'group' || kind === 'frame') {
        initialStyle = {
          width: Number(extraData?.width || 400),
          height: Number(extraData?.height || 300),
        };
      } else if (nodeType === 'shapeNode') {
        const sh = shapeMap[kind];
        initialStyle = {
          width: Number(
            extraData?.width ??
              (sh === 'circle' ? 120 : sh === 'diamond' ? 100 : sh === 'hexagon' ? 140 : 160)
          ),
          height: Number(
            extraData?.height ??
              (sh === 'circle' ? 120 : sh === 'diamond' ? 100 : sh === 'hexagon' ? 120 : 80)
          ),
        };
      } else if (nodeType === 'textBlock') {
        initialStyle = {
          width: Number(extraData?.width || 220),
          height: Number(extraData?.height || 80),
        };
      } else if (nodeType === 'imageNode') {
        initialStyle = {
          width: Number(extraData?.width || 200),
          height: Number(extraData?.height || 150),
        };
      }

      // WB-P1-02: single shared placement service for every insertion path
      // (toolbar add, paste, drop, outline import, AI proposal apply, ghost
      // card materialization all funnel through this `createNode`). Explicit
      // callers keep their intended top-left anchor (e.g. a template layout
      // or the exact cursor drop point) — the service only nudges it when it
      // would collide with something already on the canvas. Callers with no
      // opinion (plain toolbar clicks) anchor on the current viewport center
      // so the new object appears where the user is looking, not at a fixed
      // canvas-origin offset that ignores pan/zoom.
      const placementSize = initialStyle
        ? initialStyle
        : kind === 'sticky'
          ? {
              width: (STICKY_SIZES[String(extraData?.size || 'm')] || STICKY_SIZES.m).w,
              height: (STICKY_SIZES[String(extraData?.size || 'm')] || STICKY_SIZES.m).h,
            }
          : DEFAULT_WHITEBOARD_NODE_SIZE;
      // `canvasApiRef` is the pull-based bridge to the mounted
      // `WhiteboardCanvas` (see `WhiteboardCanvasHandle`) — it's the only way
      // this outer component can read a live viewport reading, since it
      // renders outside `<ReactFlowProvider>` itself. Falls back to a fixed
      // guess if the canvas hasn't mounted yet (shouldn't happen in practice:
      // every call site runs from a user interaction after the board is open).
      const anchor =
        explicitPosition ||
        (() => {
          const center = canvasApiRef.current?.getCenter() ?? { x: 400, y: 300 };
          return {
            x: center.x - placementSize.width / 2,
            y: center.y - placementSize.height / 2,
          };
        })();
      const occupiedRects: WhiteboardRect[] = nodes
        .filter((n) => !n.hidden)
        .map((n) => ({
          x: n.position.x,
          y: n.position.y,
          width:
            (typeof n.width === 'number' && n.width > 0 ? n.width : undefined) ??
            (typeof n.style?.width === 'number' ? (n.style.width as number) : undefined) ??
            DEFAULT_WHITEBOARD_NODE_SIZE.width,
          height:
            (typeof n.height === 'number' && n.height > 0 ? n.height : undefined) ??
            (typeof n.style?.height === 'number' ? (n.style.height as number) : undefined) ??
            DEFAULT_WHITEBOARD_NODE_SIZE.height,
        }))
        .concat(extraOccupiedRects);
      const resolvedPosition = resolveWhiteboardPlacement({
        size: placementSize,
        anchor,
        occupiedRects,
        viewport: canvasApiRef.current?.getViewportRect(),
        grid: 8,
      });

      const newNode: Node = {
        id,
        type: nodeType,
        position: resolvedPosition,
        data: nodeData,
        draggable: !nodeData.locked,
        connectable: !nodeData.locked,
        deletable: !nodeData.locked,
        ...(initialStyle ? { style: initialStyle } : {}),
      };
      if (extraData?.semanticType === 'theme') {
        newNode.type = 'summaryCard';
      }
      if (extraData?.semanticType === 'outcome') {
        newNode.type = 'summaryCard';
      }
      if (extraData?.semanticType === 'decision') {
        newNode.type = 'textBlock';
        newNode.data = {
          ...newNode.data,
          artifactRef: {
            type: 'decision',
            id: String((extraData as Record<string, unknown>)?.linkedOutcomeId || id),
          },
        };
      }
      if (extraData?.semanticType === 'action') {
        newNode.type = 'stickyNote';
        newNode.data = {
          ...newNode.data,
          colorIndex: 2,
          status: 'todo',
        };
      }
      return newNode;
    },
    [
      currentUserId,
      handleToggleReaction,
      isPl,
      locked,
      nodes,
      setNodes,
    ]
  );

  const createOutcomeRecord = useCallback(
    (
      type: WhiteboardOutcomeRecord['type'],
      node: Node,
      sourceNodeIds?: string[],
      exportInfo?: { exportedToType?: string; exportedToId?: string }
    ): WhiteboardOutcomeRecord => ({
      id: `wb-outcome-${node.id}`,
      type,
      title: String(node.data?.label || getSemanticTypeLabel(type, Boolean(isPl))),
      nodeId: node.id,
      sourceNodeIds: sourceNodeIds?.length ? sourceNodeIds : [node.id],
      exportedToType: exportInfo?.exportedToType,
      exportedToId: exportInfo?.exportedToId,
      linkedOutcomeId:
        typeof node.data?.linkedOutcomeId === 'string' ? node.data.linkedOutcomeId : undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }),
    [isPl]
  );

  const registerOutcomeRecord = useCallback(
    (record: WhiteboardOutcomeRecord) => {
      setOutcomeRegistry((prev) => {
        const next = prev.filter((item) => item.id !== record.id);
        const updated = [record, ...next].slice(0, 40);
        window.dispatchEvent(
          new CustomEvent('idea-whiteboard-outcomes-changed', {
            detail: { ideaId, outcomes: updated },
          })
        );
        return updated;
      });
    },
    [ideaId, setOutcomeRegistry]
  );

  const handleExternalInsert = useCallback(
    (items: WhiteboardExternalInsert[]) => {
      if (locked || items.length === 0) return;
      pushUndoSnapshot();
      // WB-P1-02: accumulate each created node's rect as we go so a batch of
      // several items (e.g. a multi-file drop or an outline import) never
      // stacks on its own earlier siblings — `nodes` state doesn't see them
      // until the single `setNodes` call below.
      const batchRects: WhiteboardRect[] = [];
      const pushBatchRect = (node: Node) => {
        const style = node.style as { width?: number; height?: number } | undefined;
        batchRects.push({
          x: node.position.x,
          y: node.position.y,
          width: style?.width ?? DEFAULT_WHITEBOARD_NODE_SIZE.width,
          height: style?.height ?? DEFAULT_WHITEBOARD_NODE_SIZE.height,
        });
      };
      const created = items.map((item, index) => {
        let node: Node;
        if (item.kind === 'image') {
          node = createNode(
            'image',
            {
              label: item.label,
              // A6: pass through whichever the upload path produced. ImageNode
              // reads `data.imageUrl || data.src`, so only one needs to be set.
              ...(item.imageUrl ? { imageUrl: item.imageUrl } : {}),
              ...(item.src ? { src: item.src } : {}),
              width: item.width ?? 300,
              position: item.position,
              semanticType: 'image',
            },
            index,
            batchRects
          );
        } else if (item.kind === 'link') {
          node = createNode(
            'link',
            {
              label: item.label,
              url: item.url,
              position: item.position,
              semanticType: 'link',
            },
            index,
            batchRects
          );
        } else {
          node = createNode(
            item.label.length > 100 ? 'text' : 'sticky',
            {
              label: item.label,
              position: item.position,
              colorIndex: item.colorIndex,
              semanticType: item.label.length > 100 ? undefined : 'note',
            },
            index,
            batchRects
          );
        }
        pushBatchRect(node);
        return node;
      });
      setNodes((prev) => [...prev, ...created]);
      appendActivity(
        createWhiteboardActivityEntry(
          'import',
          t('myWork.whiteboard.activity.pasteImport'),
          currentUserId,
          created.map((node) => node.id)
        )
      );
      rememberSnapshot(t('myWork.whiteboard.history.importExternal'));
    },
    [appendActivity, createNode, currentUserId, isPl, locked, pushUndoSnapshot, rememberSnapshot]
  );

  const applyOutlineImport = useCallback(() => {
    const lines = outlineImportValue
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 24);
    if (lines.length === 0) {
      setOutlineImportOpen(false);
      setOutlineImportValue('');
      return;
    }
    handleExternalInsert(
      lines.map((line, index) => ({
        kind: 'text' as const,
        label: line,
        position: { x: 120 + (index % 4) * 190, y: 120 + Math.floor(index / 4) * 130 },
        colorIndex: index % STICKY_COLORS.length,
      }))
    );
    setOutlineImportOpen(false);
    setOutlineImportValue('');
    appendActivity(
      createWhiteboardActivityEntry(
        'import',
        t('myWork.whiteboard.toast.importedNotes', { count: lines.length }),
        currentUserId
      )
    );
  }, [appendActivity, currentUserId, handleExternalInsert, isPl, outlineImportValue]);

  const addElement = useCallback(
    (kind: WbNodeKind, extraData?: Record<string, unknown>) => {
      if (locked) return;

      // P13 Limit enforcement: warn at 200, block at 500
      if (nodes.length >= 200) {
        toast(t('myWork.whiteboard.errors.objectLimitWarning'), {
          icon: '⚠️',
          duration: 3000,
        });
      }
      if (nodes.length >= 500) {
        toast.error(t('myWork.whiteboard.errors.objectLimitReached'), {
          duration: 3000,
        });
        return;
      }

      pushUndoSnapshot();
      // WB-P2-01: a brand-new sticky/text with no caller-supplied label yet
      // (rail/toolbar "Add sticky"/"Add text" — the exact first-time-user
      // path from the finding) opens straight into inline naming instead of
      // requiring the user to already know about double-click. Skipped when
      // the caller already provided real content (e.g. Teresa's
      // `idea.element.add` with a label, or a semantic quick-add like
      // wb_add_area) — that text is already meaningful, no need to
      // interrupt with an editor.
      const isNamableCreate = kind === 'sticky' || kind === 'text';
      const hasExplicitLabel =
        typeof extraData?.label === 'string' && extraData.label.trim().length > 0;
      const newNode = createNode(
        kind,
        isNamableCreate && !hasExplicitLabel ? { ...extraData, _isNew: true } : extraData,
        nodes.length
      );
      setNodes((prev: Node[]) => [...prev, newNode]);
      collab.broadcastNodeAdd(newNode); // L-02: realtime add
      const semanticType =
        typeof newNode.data?.semanticType === 'string' ? newNode.data.semanticType : undefined;
      if (
        semanticType === 'cluster' ||
        semanticType === 'theme' ||
        semanticType === 'outcome' ||
        semanticType === 'decision' ||
        semanticType === 'action'
      ) {
        registerOutcomeRecord(createOutcomeRecord(semanticType, newNode));
      }
      appendActivity(
        createWhiteboardActivityEntry(
          'create',
          t('myWork.whiteboard.activity.addedElement', { kind }),
          currentUserId,
          [newNode.id]
        )
      );
    },
    [
      appendActivity,
      collab,
      createNode,
      createOutcomeRecord,
      currentUserId,
      isPl,
      locked,
      nodes,
      nodes.length,
      pushUndoSnapshot,
      registerOutcomeRecord,
      setNodes,
      t,
    ]
  );

  const seedQuickStart = useCallback(
    (mode: WhiteboardQuickStart) => {
      if (locked) return;
      pushUndoSnapshot();

      setBgPattern('dots');
      setNodes((prev: Node[]) => {
        if (prev.length > 0) return prev;

        const created: Node[] = [];
        const make = (kind: WbNodeKind, extraData: Record<string, unknown>) => {
          const node = createNode(kind, extraData, prev.length + created.length);
          created.push(node);
        };

        if (mode === 'brainstorm') {
          make('frame', {
            label: t('myWork.whiteboard.quickStart.brainstorm.sessionTopic'),
            position: { x: 120, y: 80 },
            width: 540,
            height: 250,
            bgColor: 'rgba(245, 158, 11, 0.08)',
          });
          make('sticky', {
            label: t('myWork.whiteboard.quickStart.brainstorm.idea', { n: 1 }),
            position: { x: 180, y: 150 },
          });
          make('sticky', {
            label: t('myWork.whiteboard.quickStart.brainstorm.idea', { n: 2 }),
            position: { x: 360, y: 150 },
          });
          make('sticky', {
            label: t('myWork.whiteboard.quickStart.brainstorm.idea', { n: 3 }),
            position: { x: 240, y: 290 },
          });
          make('sticky', {
            label: t('myWork.whiteboard.quickStart.brainstorm.idea', { n: 4 }),
            position: { x: 430, y: 290 },
          });
        }

        if (mode === 'affinity') {
          make('frame', {
            label: t('myWork.whiteboard.quickStart.affinity.themeA'),
            position: { x: 120, y: 80 },
            width: 260,
            height: 320,
            bgColor: 'rgba(165,28,48, 0.08)',
          });
          make('frame', {
            label: t('myWork.whiteboard.quickStart.affinity.themeB'),
            position: { x: 420, y: 80 },
            width: 260,
            height: 320,
            bgColor: 'rgba(59, 130, 246, 0.08)',
          });
          make('sticky', {
            label: t('myWork.whiteboard.quickStart.affinity.input', { n: 1 }),
            position: { x: 165, y: 145 },
          });
          make('sticky', {
            label: t('myWork.whiteboard.quickStart.affinity.input', { n: 2 }),
            position: { x: 165, y: 265 },
          });
          make('sticky', {
            label: t('myWork.whiteboard.quickStart.affinity.input', { n: 3 }),
            position: { x: 470, y: 145 },
          });
          make('sticky', {
            label: t('myWork.whiteboard.quickStart.affinity.input', { n: 4 }),
            position: { x: 470, y: 265 },
          });
        }

        if (mode === 'workshop') {
          make('text', {
            label: t('myWork.whiteboard.quickStart.workshop.goals'),
            position: { x: 140, y: 65 },
          });
          make('frame', {
            label: t('myWork.whiteboard.quickStart.workshop.discuss'),
            position: { x: 120, y: 110 },
            width: 220,
            height: 300,
            bgColor: 'rgba(245, 158, 11, 0.08)',
          });
          make('frame', {
            label: t('myWork.whiteboard.quickStart.workshop.decisions'),
            position: { x: 380, y: 110 },
            width: 220,
            height: 300,
            bgColor: 'rgba(16, 185, 129, 0.08)',
          });
          make('frame', {
            label: t('myWork.whiteboard.quickStart.workshop.parkingLot'),
            position: { x: 640, y: 110 },
            width: 220,
            height: 300,
            bgColor: 'rgba(148, 163, 184, 0.12)',
          });
        }

        return [...prev, ...created];
      });

      toast.success(
        mode === 'brainstorm'
          ? t('myWork.whiteboard.toast.quickStartBrainstorm')
          : mode === 'affinity'
            ? t('myWork.whiteboard.toast.quickStartAffinity')
            : t('myWork.whiteboard.toast.quickStartWorkshop'),
        { duration: 900 }
      );
      appendActivity(
        createWhiteboardActivityEntry(
          'create',
          t('myWork.whiteboard.activity.quickStart', { mode }),
          currentUserId
        )
      );
      rememberSnapshot(t('myWork.whiteboard.history.quickStart', { mode }));
    },
    [appendActivity, createNode, currentUserId, isPl, locked, pushUndoSnapshot, rememberSnapshot]
  );

  // ── Node CRUD, grouping, distribution (extracted to useWhiteboardNodes) ──
  const {
    deleteSelected,
    duplicateSelected,
    groupSelected,
    ungroupSelected,
    distributeNodes,
    tidyBoard,
    // WB-CLIPBOARD-01 fix: real object clipboard (node+edges), not the
    // OS-clipboard text copy `handleBaseAction` used to do.
    copySelected,
    pasteClipboard,
    clipboardCount,
  } = useWhiteboardNodes({
    nodes,
    edges,
    setNodes,
    setEdges,
    locked: locked || false,
    isPl,
    pushSnapshot: pushUndoSnapshot,
  });

  // ── Quick action listener (extracted to useWhiteboardQuickActions) ───────
  // AI runner is defined below (needs handleGenerateProposal); bridged via ref
  // like the hook's own internal latest-handler pattern.
  const runAIActionRef = useRef<(generatorType: WhiteboardAIGeneratorType) => void>(() => {});
  // Edge actions (2026-08-09, E02 follow-up): `handleEdge*` live further down
  // (need `edges`/`edgeContextMenu` state declared later in this component),
  // so they're bridged via the same latest-ref pattern as `runAIActionRef`
  // above — the hook call below needs a stable function identity NOW, the
  // real implementation is assigned after the `handleEdge*` useCallbacks.
  // This is what gives Whiteboard edges a real, addressable dispatch-bus
  // receiver (`wb_edge_*` on `idea-workspace-quick-action`), matching how
  // Mind Map edges already dispatch `mm_edge_arrow` to
  // `useMindMapQuickActions.ts` — see `runEdgeParamCallback` in
  // `ideaActionRegistry.ts` for the caller side.
  const editEdgeLabelRef = useRef<(edgeId: string, label?: string) => void>(() => {});
  const reverseEdgeRef = useRef<(edgeId: string) => void>(() => {});
  const cycleEdgeArrowRef = useRef<(edgeId: string) => void>(() => {});
  const cycleEdgeStyleRef = useRef<(edgeId: string) => void>(() => {});
  const deleteEdgeRef = useRef<(edgeId: string) => void>(() => {});
  useWhiteboardQuickActions({
    open,
    handlers: {
      addElement,
      deleteSelected,
      duplicateSelected,
      groupSelected,
      ungroupSelected,
      distributeNodes,
      tidyBoard,
      setMode: setBoardMode,
      setCursorMode,
      cycleSessionRole,
      toggleSessionTimer,
      toggleSessionVoting,
      toggleSessionFollow,
      toggleSpotlightSelection,
      importOutline,
      saveSelectionToLibrary,
      insertLatestLibraryItem,
      restoreLatestHistory,
      cycleGovernance,
      undo: undoWhiteboard,
      redo: redoWhiteboard,
      runAIAction: (generatorType) => runAIActionRef.current(generatorType),
      editEdgeLabel: (edgeId, label) => editEdgeLabelRef.current(edgeId, label),
      reverseEdge: (edgeId) => reverseEdgeRef.current(edgeId),
      cycleEdgeArrow: (edgeId) => cycleEdgeArrowRef.current(edgeId),
      cycleEdgeStyle: (edgeId) => cycleEdgeStyleRef.current(edgeId),
      deleteEdge: (edgeId) => deleteEdgeRef.current(edgeId),
    },
  });

  useEffect(() => {
    if (!open) return;
    const handler = async (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      if (detail.ideaId && detail.ideaId !== ideaId) return;
      const nodeId = String(detail.nodeId || detail.voteTargetId || '');
      if (!nodeId) return;
      try {
        const sessionId = await ensureFacilitationSession();
        await Api.facilitationCastVote(sessionId, {
          voteTargetId: nodeId,
          voteType: 'upvote',
          voteValue: 1,
        });
        await syncFacilitationVotes(sessionId);
        appendActivity(
          createWhiteboardActivityEntry(
            'vote',
            t('myWork.whiteboard.activity.voteSaved'),
            currentUserId,
            [nodeId]
          )
        );
      } catch (error: any) {
        toast.error(error?.message || t('myWork.whiteboard.errors.voteSaveFailed'));
      }
    };
    window.addEventListener('idea-whiteboard-cast-vote', handler);
    return () => window.removeEventListener('idea-whiteboard-cast-vote', handler);
  }, [
    appendActivity,
    currentUserId,
    ensureFacilitationSession,
    ideaId,
    isPl,
    open,
    syncFacilitationVotes,
  ]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      const nodeId = String(detail.nodeId || '');
      if (!nodeId || !detail.data || typeof detail.data !== 'object') return;
      setNodes((prev) =>
        prev.map((node) =>
          node.id === nodeId ? { ...node, data: { ...node.data, ...detail.data } } : node
        )
      );
      appendActivity(
        createWhiteboardActivityEntry(
          'update',
          t('myWork.whiteboard.activity.updatedObject'),
          currentUserId,
          [nodeId]
        )
      );
    };
    window.addEventListener('idea-workspace-node-update', handler);
    return () => window.removeEventListener('idea-workspace-node-update', handler);
  }, [appendActivity, currentUserId, isPl, open]);

  useEffect(() => {
    if (!open || !sessionState.timerEndsAt) return;
    const msLeft = sessionState.timerEndsAt - Date.now();
    if (msLeft <= 0) {
      setSessionState((prev) => ({ ...prev, timerEndsAt: null, updatedAt: Date.now() }));
      appendActivity(
        createWhiteboardActivityEntry(
          'session',
          t('myWork.whiteboard.activity.timerCompleted'),
          currentUserId
        )
      );
      if (sessionState.sessionId) {
        Api.facilitationUpdateTimer(sessionState.sessionId, {
          timerEndsAt: null,
          timerSeconds: sessionState.timerSeconds,
          updatedBy: currentUserId,
        }).catch(() => toast.error(t('myWork.whiteboard.errors.timerFailed')));
      }
      return;
    }
    const timer = window.setTimeout(() => {
      setSessionState((prev) => ({ ...prev, timerEndsAt: null, updatedAt: Date.now() }));
      appendActivity(
        createWhiteboardActivityEntry(
          'session',
          t('myWork.whiteboard.activity.timerCompleted'),
          currentUserId
        )
      );
      if (sessionState.sessionId) {
        Api.facilitationUpdateTimer(sessionState.sessionId, {
          timerEndsAt: null,
          timerSeconds: sessionState.timerSeconds,
          updatedBy: currentUserId,
        }).catch(() => toast.error(t('myWork.whiteboard.errors.timerFailed')));
      }
    }, msLeft);
    return () => window.clearTimeout(timer);
  }, [
    appendActivity,
    currentUserId,
    isPl,
    open,
    sessionState.sessionId,
    sessionState.timerEndsAt,
    sessionState.timerSeconds,
  ]);

  useEffect(() => {
    if (!open) return;
    window.dispatchEvent(
      new CustomEvent('idea-whiteboard-facilitation-state', {
        detail: {
          ideaId,
          sessionState,
          voteSummary: sessionVotes,
          myVoteCounts,
        },
      })
    );
  }, [ideaId, myVoteCounts, open, sessionState, sessionVotes]);

  useEffect(() => {
    if (!open || !sessionState.sessionId || !sessionState.votingOpen) return;
    syncFacilitationVotes(sessionState.sessionId).catch(() =>
      toast.error(t('myWork.whiteboard.errors.voteSyncFailed'))
    );
    const interval = window.setInterval(() => {
      syncFacilitationVotes(sessionState.sessionId as string).catch(() =>
        toast.error(t('myWork.whiteboard.errors.voteSyncFailed'))
      );
    }, 5000);
    return () => window.clearInterval(interval);
  }, [open, sessionState.sessionId, sessionState.votingOpen, syncFacilitationVotes]);

  // B1 (M09): resolve THIS user's facilitation role as soon as the board opens, so an
  // 'observer' the facilitator locked is rendered read-only WITHOUT them first having to
  // interact with a facilitation control. We only ADOPT the session locally when the user
  // is an observer — for facilitator/participant we leave the lazy join path unchanged
  // (facilitation stays dormant until they actually use it), preserving existing behavior.
  useEffect(() => {
    if (!open || sessionState.sessionId) return;
    let cancelled = false;
    (async () => {
      try {
        // READ-ONLY: resolves an existing active session without creating one, so simply
        // opening the board never spawns a facilitation row (facilitation stays lazy).
        const resolved: any = await Api.facilitationResolveByTool(toolSessionId);
        const session = resolved?.session;
        const sessionId = String(session?.id || '');
        if (!sessionId || cancelled) return;
        const assignedRole = await resolveMyAssignedRole(sessionId);
        if (cancelled || assignedRole !== 'observer') return;
        setSessionState((prev) => ({
          ...prev,
          active: true,
          sessionId,
          toolSessionId,
          role: 'observer',
          updatedAt: Date.now(),
        }));
      } catch {
        /* best-effort: never block opening the board */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, sessionState.sessionId, toolSessionId, resolveMyAssignedRole]);

  // M09 L-04: live cross-participant sync of facilitation state. While the session is
  // active, re-read the SHARED server session so a 2nd participant sees the facilitator's
  // phase / voting / timer / role changes without a reload (votes are polled separately
  // above once votingOpen flips true).
  useEffect(() => {
    const sessionId = sessionState.sessionId;
    if (!open || !sessionId || !sessionState.active) return;
    let cancelled = false;
    const refresh = async () => {
      const server: any = await Api.facilitationGetSession(sessionId).catch(() => null);
      if (cancelled || !server) return;
      const facilitatorId = String(server.facilitator_id || server.facilitatorId || '');
      // B1 (M09): honor a facilitator-assigned 'observer' role on every poll so it is not
      // clobbered back to 'participant' by the facilitator_id default (which would silently
      // re-enable editing for someone the facilitator locked to view-only).
      const assignedRole = await resolveMyAssignedRole(sessionId);
      if (cancelled) return;
      const serverRole =
        assignedRole === 'observer'
          ? 'observer'
          : facilitatorId && facilitatorId === currentUserId
            ? 'facilitator'
            : 'participant';
      const rawTimer = server.timer_state ?? server.timerState;
      let timerState: Record<string, unknown> = {};
      if (rawTimer && typeof rawTimer === 'object') timerState = rawTimer;
      else if (typeof rawTimer === 'string') {
        try {
          timerState = JSON.parse(rawTimer);
        } catch {
          timerState = {};
        }
      }
      const serverPhase = server.current_phase ?? server.currentPhase;
      setSessionState((prev) => {
        if (!prev.active || prev.sessionId !== sessionId) return prev;
        return {
          ...prev,
          role: serverRole as typeof prev.role,
          facilitationPhase: ((typeof serverPhase === 'string' && serverPhase) ||
            prev.facilitationPhase) as typeof prev.facilitationPhase,
          votingOpen:
            serverPhase === 'voting' ||
            (typeof timerState.votingOpen === 'boolean'
              ? (timerState.votingOpen as boolean)
              : prev.votingOpen),
          timerEndsAt:
            typeof timerState.endsAt === 'number'
              ? (timerState.endsAt as number)
              : prev.timerEndsAt,
        };
      });
    };
    const interval = window.setInterval(refresh, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [open, sessionState.sessionId, sessionState.active, currentUserId, resolveMyAssignedRole]);

  useEffect(() => {
    if (!open) return;
    const syncPresence = async () => {
      try {
        await Api.toolSessionJoinPresence(toolSessionId, {
          userName: currentUserName,
          cursorState: {
            viewport: viewportTransform,
            spotlightNodeId: sessionState.spotlightNodeId,
            role: sessionState.role,
          },
          activeBlockId: selectedNodeIds[0],
        });
        const presenceRes = await Api.toolSessionListPresence(toolSessionId);
        setPresenceUsers(Array.isArray(presenceRes?.presence) ? presenceRes.presence : []);
      } catch {
        /* best-effort */
      }
    };
    syncPresence();
    const heartbeat = window.setInterval(() => {
      Api.toolSessionHeartbeat(toolSessionId, {
        viewport: viewportTransform,
        spotlightNodeId: sessionState.spotlightNodeId,
        role: sessionState.role,
      }).catch(() => toast.error(t('myWork.whiteboard.errors.presenceFailed')));
      Api.toolSessionListPresence(toolSessionId)
        .then((presenceRes) => {
          setPresenceUsers(Array.isArray(presenceRes?.presence) ? presenceRes.presence : []);
        })
        .catch(() => toast.error(t('myWork.whiteboard.errors.presenceFailed')));
    }, 5000);
    return () => {
      window.clearInterval(heartbeat);
      Api.toolSessionDisconnect(toolSessionId).catch(() =>
        toast.error(t('myWork.whiteboard.errors.disconnectFailed'))
      );
    };
  }, [
    currentUserName,
    open,
    selectedNodeIds,
    sessionState.role,
    sessionState.spotlightNodeId,
    toolSessionId,
    viewportTransform,
  ]);

  useEffect(() => {
    if (!open || !sessionState.followMe) return;
    const facilitator = presenceUsers.find((entry) => {
      const role = String((entry.cursorState as Record<string, unknown> | undefined)?.role || '');
      return role === 'facilitator' && String(entry.userId || '') !== currentUserId;
    });
    const viewport = (facilitator?.cursorState as Record<string, unknown> | undefined)?.viewport as
      | { x?: number; y?: number; zoom?: number }
      | undefined;
    if (
      viewport &&
      typeof viewport.x === 'number' &&
      typeof viewport.y === 'number' &&
      typeof viewport.zoom === 'number'
    ) {
      window.dispatchEvent(
        new CustomEvent('idea-whiteboard-navigate', {
          detail: { viewport: { x: viewport.x, y: viewport.y, zoom: viewport.zoom }, ideaId },
        })
      );
    }
  }, [currentUserId, ideaId, open, presenceUsers, sessionState.followMe]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      if (detail.ideaId && detail.ideaId !== ideaId) return;
      const outputId = String(detail.outputId || '');
      const target = String(detail.target || '');
      const nodeIds = Array.isArray(detail.nodeIds) ? detail.nodeIds.map(String) : [];
      if (!outputId || nodeIds.length === 0) return;
      const linkedNodes = nodes.filter((node) => nodeIds.includes(node.id));
      linkedNodes.forEach((node) => {
        // A4: resolve via node semantics with a target-derived fallback so generic
        // nodes (plain sticky/text) converted from the SelectionBar still get an
        // outcomeRegistry entry with the exportedTo ref (no silent skip).
        const outcomeType = resolveConvertOutcomeType(node, target);
        if (outcomeType) {
          registerOutcomeRecord(
            createOutcomeRecord(outcomeType, node, nodeIds, {
              exportedToId: outputId,
              exportedToType: target,
            })
          );
        }
      });
    };
    window.addEventListener('idea-whiteboard-register-output', handler);
    return () => window.removeEventListener('idea-whiteboard-register-output', handler);
  }, [createOutcomeRecord, ideaId, nodes, open, registerOutcomeRecord]);

  // ── Ghost card materialization (idea-workspace-insert) ─────────────────
  useEffect(() => {
    if (!open) return;
    const handler = (e: Event) => {
      const detail = ((e as CustomEvent).detail || {}) as IdeaWorkspaceInsertDetail;
      if (!detail) return;
      if (Array.isArray(detail.items)) {
        for (const item of detail.items) {
          const label = item.text || item.label || '';
          const position = item.position || detail.position;
          addElement('sticky', { label, position, ...(item.data || {}) });
        }
        return;
      }
      const kind = isWbNodeKind(detail.nodeType) ? detail.nodeType : 'sticky';
      const label = detail.label || detail.text || '';
      const color = detail.color;
      addElement(kind, {
        label,
        position: detail.position,
        colorIndex: color ? STICKY_COLORS.findIndex((c) => c.hex === color) : undefined,
      });
    };
    window.addEventListener(IDEA_WORKSPACE_INSERT_EVENT, handler);
    return () => window.removeEventListener(IDEA_WORKSPACE_INSERT_EVENT, handler);
  }, [open, addElement]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      if (detail.ideaId && detail.ideaId !== ideaId) return;
      const themeId = String(detail.themeId || '');
      if (themeId === 'ops') setBgPattern('grid');
      if (themeId === 'workshop') setBgPattern('dots');
      if (themeId === 'strategy') setBgPattern('lines');
    };
    window.addEventListener(IDEA_WORKSPACE_THEME_EVENT, handler);
    return () => window.removeEventListener(IDEA_WORKSPACE_THEME_EVENT, handler);
  }, [ideaId, open]);

  // ── Scene navigation (idea-whiteboard-navigate) ────────────────────────
  useEffect(() => {
    if (!open) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.viewport) return;
      const rfContainer = document.querySelector('.react-flow');
      if (rfContainer) {
        const evt = new CustomEvent('idea-whiteboard-set-viewport', { detail: detail.viewport });
        rfContainer.dispatchEvent(evt);
      }
    };
    window.addEventListener('idea-whiteboard-navigate', handler);
    return () => window.removeEventListener('idea-whiteboard-navigate', handler);
  }, [open]);

  // Mark converted nodes with a visual indicator when notified
  useEffect(() => {
    if (!open) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const nodeIds: string[] = Array.isArray(detail?.nodeIds)
        ? detail.nodeIds
        : detail?.nodeId
          ? [detail.nodeId]
          : [];
      if (nodeIds.length === 0) return;
      setNodes((prev) =>
        prev.map((n) =>
          nodeIds.includes(n.id) ? { ...n, data: { ...n.data, _converted: true } } : n
        )
      );
    };
    window.addEventListener('idea-mindmap-mark-converted', handler);
    return () => window.removeEventListener('idea-mindmap-mark-converted', handler);
  }, [open, setNodes]);

  // ── Save ─────────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (locked) return;
    try {
      await flushNow(buildPersistPayload(), {
        reason: 'manual',
        createSnapshot: true,
        snapshotLabel: t('myWork.whiteboard.history.checkpoint'),
      });
      rememberSnapshot(t('myWork.whiteboard.history.manualSave'));
      toast.success(t('myWork.whiteboard.toolbar.save'), { duration: 900 });
      onSaved?.();
    } catch (err: any) {
      toast.error(err?.message || t('myWork.whiteboard.errors.saveFailed'));
    }
  }, [buildPersistPayload, flushNow, isPl, locked, onSaved, rememberSnapshot]);

  // ── Align selected nodes ─────────────────────────────────────────────────

  const alignNodes = useCallback(
    (direction: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
      pushUndoSnapshot();
      setNodes((nds: Node[]) => {
        const selected = nds.filter((n: Node) => n.selected && !isNodeDataLocked(n));
        if (selected.length < 2) return nds;

        const getNodeW = (n: Node): number =>
          (n.style?.width as number) ||
          n.data?.width ||
          (n.type === 'frameNode' ? 400 : n.type === 'stickyNote' ? 180 : 200);
        const getNodeH = (n: Node): number =>
          (n.style?.height as number) ||
          n.data?.height ||
          (n.type === 'frameNode' ? 300 : n.type === 'stickyNote' ? 100 : 80);

        let ref: number;
        switch (direction) {
          case 'left':
            ref = Math.min(...selected.map((n) => n.position.x));
            break;
          case 'right':
            ref = Math.max(...selected.map((n) => n.position.x + getNodeW(n)));
            break;
          case 'center': {
            const minX = Math.min(...selected.map((n) => n.position.x));
            const maxX = Math.max(...selected.map((n) => n.position.x + getNodeW(n)));
            ref = (minX + maxX) / 2;
            break;
          }
          case 'top':
            ref = Math.min(...selected.map((n) => n.position.y));
            break;
          case 'bottom':
            ref = Math.max(...selected.map((n) => n.position.y + getNodeH(n)));
            break;
          case 'middle': {
            const minY = Math.min(...selected.map((n) => n.position.y));
            const maxY = Math.max(...selected.map((n) => n.position.y + getNodeH(n)));
            ref = (minY + maxY) / 2;
            break;
          }
        }

        const ids = new Set(selected.map((n: Node) => n.id));
        return nds.map((n: Node) => {
          if (!ids.has(n.id)) return n;
          const pos = { ...n.position };
          const w = getNodeW(n);
          const h = getNodeH(n);
          switch (direction) {
            case 'left':
              pos.x = ref;
              break;
            case 'right':
              pos.x = ref - w;
              break;
            case 'center':
              pos.x = ref - w / 2;
              break;
            case 'top':
              pos.y = ref;
              break;
            case 'bottom':
              pos.y = ref - h;
              break;
            case 'middle':
              pos.y = ref - h / 2;
              break;
          }
          return { ...n, position: pos };
        });
      });
    },
    [pushUndoSnapshot, setNodes]
  );

  // ── Lock selected nodes ─────────────────────────────────────────────────

  const lockSelected = useCallback(() => {
    pushUndoSnapshot();
    setNodes((nds: Node[]) =>
      nds.map((n: Node) =>
        n.selected
          ? {
              ...n,
              draggable: Boolean(n.data?.locked),
              connectable: Boolean(n.data?.locked),
              deletable: Boolean(n.data?.locked),
              data: { ...n.data, locked: !n.data?.locked },
            }
          : n
      )
    );
  }, [pushUndoSnapshot, setNodes]);

  // ── Layer order (K1 base ops: bring to front / send to back) ────────────
  // Node z-order in React Flow follows array order (later = painted on top),
  // same convention already used by groupSelected's `[groupNode, ...updated]`.
  const bringSelectedToFront = useCallback(() => {
    if (locked) return;
    pushUndoSnapshot();
    setNodes((nds: Node[]) => {
      const selected = nds.filter((n: Node) => n.selected && !isNodeDataLocked(n));
      if (selected.length === 0) return nds;
      const rest = nds.filter((n: Node) => !(n.selected && !isNodeDataLocked(n)));
      return [...rest, ...selected];
    });
  }, [locked, pushUndoSnapshot, setNodes]);

  const sendSelectedToBack = useCallback(() => {
    if (locked) return;
    pushUndoSnapshot();
    setNodes((nds: Node[]) => {
      const selected = nds.filter((n: Node) => n.selected && !isNodeDataLocked(n));
      if (selected.length === 0) return nds;
      const rest = nds.filter((n: Node) => !(n.selected && !isNodeDataLocked(n)));
      return [...selected, ...rest];
    });
  }, [locked, pushUndoSnapshot, setNodes]);

  // ── Smart layout ─────────────────────────────────────────────────────────
  const handleLayout = useCallback(
    (algorithm: LayoutAlgorithm) => {
      if (locked) return;
      pushUndoSnapshot();
      const { nodes: laid } = applySmartLayout(nodes, edges, { algorithm, spacing: 200 });
      setNodes(laid);
    },
    [edges, locked, nodes, pushUndoSnapshot, setNodes]
  );

  useEffect(() => {
    if (!open || locked || loading) return;
    if (nodes.length === 0 && edges.length === 0 && drawingPaths.length === 0) return;
    queueSync(buildPersistPayload(), { reason: 'draft' });
  }, [
    buildPersistPayload,
    drawingPaths.length,
    loading,
    locked,
    nodes.length,
    edges.length,
    open,
    queueSync,
  ]);

  // ── Context menu handler ──────────────────────────────────────────────────
  const handleCanvasContextMenu = useCallback(
    (e: React.MouseEvent, nodeId?: string, nodeData?: any) => {
      e.preventDefault();
      setContextMenuPos({ x: e.clientX, y: e.clientY });
      setContextMenuTarget(
        nodeId
          ? {
              nodeId,
              nodeLabel: nodeData?.label,
              nodeType: nodeData?.semanticType || nodeData?.type,
              nodeLocked: Boolean(nodeData?.locked),
            }
          : {}
      );
      // K1: right-click on a node outside the current selection selects it
      // alone, so the base-ops menu's reused selection handlers (duplicate/
      // lock/delete/layer) act on the element the user actually right-clicked.
      // A right-click inside an existing multi-selection keeps that selection.
      if (nodeId) {
        setNodes((nds: Node[]) => {
          const alreadySelected = nds.some((n) => n.id === nodeId && n.selected);
          if (alreadySelected) return nds;
          return nds.map((n) => ({ ...n, selected: n.id === nodeId }));
        });
      }
    },
    [setNodes]
  );

  // ── Edge context menu (P2-6, rozdz. 08 §4) ────────────────────────────────
  const handleEdgeContextMenu = useCallback((e: React.MouseEvent, edgeId: string) => {
    e.preventDefault();
    setContextMenuPos(null);
    setEdgeContextMenu({ edgeId, x: e.clientX, y: e.clientY });
  }, []);

  // CB-05/RB-042/RV-003: keyboard invocation for the node/edge/background
  // context menus. Until this, the menus only opened via pointer right-click
  // — Shift+F10 (and the Windows "ContextMenu" key) on a keyboard-focused
  // node opened nothing, because ReactFlow's own node/edge onKeyDown never
  // handles those keys (confirmed against @reactflow/core — it only wires
  // Escape/selection keys). Anchors the menu on the focused element's own
  // bounding rect instead of pointer coordinates.
  useEffect(() => {
    const el = wbKeyboardMenuContainerRef.current;
    if (!el) return;
    const handler = (e: KeyboardEvent) => {
      if (!isContextMenuKey(e)) return;
      const target = resolveKeyboardContextMenuTarget(el, document.activeElement as HTMLElement);
      if (!target) return;
      e.preventDefault();
      if (target.kind === 'node') {
        const node = nodes.find((n) => n.id === target.nodeId);
        if (!node) return;
        setEdgeContextMenu(null);
        setContextMenuPos({ x: target.rect.right, y: target.rect.top });
        setContextMenuTarget({
          nodeId: target.nodeId,
          nodeLabel: node.data?.label,
          nodeType: node.data?.semanticType || node.data?.type,
          nodeLocked: Boolean(node.data?.locked),
        });
        setNodes((nds: Node[]) => {
          const alreadySelected = nds.some((n) => n.id === target.nodeId && n.selected);
          if (alreadySelected) return nds;
          return nds.map((n) => ({ ...n, selected: n.id === target.nodeId }));
        });
      } else if (target.kind === 'edge') {
        setContextMenuPos(null);
        setEdgeContextMenu({ edgeId: target.edgeId, x: target.rect.left, y: target.rect.top });
      } else {
        // Background — open centered on the canvas region.
        setEdgeContextMenu(null);
        setContextMenuPos({
          x: target.rect.left + target.rect.width / 2,
          y: target.rect.top + target.rect.height / 2,
        });
        setContextMenuTarget({});
      }
    };
    el.addEventListener('keydown', handler);
    return () => el.removeEventListener('keydown', handler);
  }, [nodes, setNodes]);

  // edge.set_label — realny handler: aktualizuje data.label, autosave przez
  // onGraphChange, realtime przez collab update_edge.
  //
  // `edgeIdArg`/`labelArg` (2026-08-09, E02 follow-up): opcjonalne — gdy
  // podane (wywołanie z `wb_edge_edit_label` na szynie, patrz
  // `useWhiteboardQuickActions.ts`), używamy ich zamiast lokalnego stanu
  // `edgeContextMenu` i pomijamy `window.prompt` (headless caller, np.
  // Teresa, nie odpowie na natywny prompt). Menu prawego kliku nadal woła
  // `handleEdgeEditLabel()` bez argumentów — zachowanie 1:1 ze stanem sprzed
  // tej zmiany.
  const handleEdgeEditLabel = useCallback(
    (edgeIdArg?: string, labelArg?: string) => {
      const edgeId = edgeIdArg ?? edgeContextMenu?.edgeId;
      if (!edgeId) return;
      const edge = edges.find((ed) => ed.id === edgeId);
      if (!edge) return;
      const current = String(edge.data?.label || '');
      const next =
        edgeIdArg !== undefined
          ? (labelArg ?? current)
          : window.prompt(isPl ? 'Etykieta połączenia:' : 'Connection label:', current);
      if (next === null || next === current) return;
      pushUndoSnapshot();
      let updated: Edge | undefined;
      setEdges((prev) =>
        prev.map((ed) => {
          if (ed.id !== edgeId) return ed;
          updated = { ...ed, data: { ...(ed.data || {}), label: next } };
          return updated;
        })
      );
      if (updated) collab.broadcastGraphPatch([{ op: 'update_edge', data: updated as any }]);
    },
    [collab, edgeContextMenu, edges, isPl, pushUndoSnapshot, setEdges]
  );

  // edge.set_style — cykl styli obsługiwanych przez LabeledEdge.
  const handleEdgeCycleStyle = useCallback(
    (edgeIdArg?: string) => {
      const edgeId = edgeIdArg ?? edgeContextMenu?.edgeId;
      if (!edgeId) return;
      const order = ['solid', 'dashed', 'dotted', 'wavy'] as const;
      pushUndoSnapshot();
      let updated: Edge | undefined;
      setEdges((prev) =>
        prev.map((ed) => {
          if (ed.id !== edgeId) return ed;
          const cur = String(ed.data?.edgeStyle || 'solid');
          const nextStyle = order[(order.indexOf(cur as any) + 1) % order.length];
          updated = { ...ed, data: { ...(ed.data || {}), edgeStyle: nextStyle } };
          return updated;
        })
      );
      if (updated) collab.broadcastGraphPatch([{ op: 'update_edge', data: updated as any }]);
    },
    [collab, edgeContextMenu, pushUndoSnapshot, setEdges]
  );

  // edge.set_arrow — strzałka kierunku przepływu (2026-07-28, zgłoszenie
  // właściciela). Cykl none → end → both → start na `data.arrowDirection`,
  // czyli DOKŁADNIE tym polu, którego używa Przepływ procesu i Mapa myśli
  // (SSOT geometrii: `canvas/edgeArrowMarkers.tsx`). Ta sama ścieżka zapisu co
  // `handleEdgeCycleStyle` → undo + collab + autosave bez nowej mechaniki.
  const handleEdgeCycleArrow = useCallback(
    (edgeIdArg?: string) => {
      const edgeId = edgeIdArg ?? edgeContextMenu?.edgeId;
      if (!edgeId) return;
      pushUndoSnapshot();
      let updated: Edge | undefined;
      let applied: EdgeArrowDirection = 'none';
      setEdges((prev) =>
        prev.map((ed) => {
          if (ed.id !== edgeId) return ed;
          applied = nextArrowDirection(resolveArrowDirection(ed.data?.arrowDirection, 'none'));
          updated = { ...ed, data: { ...(ed.data || {}), arrowDirection: applied } };
          return updated;
        })
      );
      if (updated) collab.broadcastGraphPatch([{ op: 'update_edge', data: updated as any }]);
      toast.success(
        t(`mindmap.edgeArrow.${applied}`, {
          defaultValue: applied === 'none' ? 'Arrow: none' : `Arrow: ${applied}`,
        }),
        { duration: 900 }
      );
    },
    [collab, edgeContextMenu, pushUndoSnapshot, setEdges, t]
  );

  // edge.reverse — zamiana source/target (i uchwytów), kierunek strzałki podąża.
  const handleEdgeReverse = useCallback(
    (edgeIdArg?: string) => {
      const edgeId = edgeIdArg ?? edgeContextMenu?.edgeId;
      if (!edgeId) return;
      pushUndoSnapshot();
      let updated: Edge | undefined;
      setEdges((prev) =>
        prev.map((ed) => {
          if (ed.id !== edgeId) return ed;
          updated = {
            ...ed,
            source: ed.target,
            target: ed.source,
            sourceHandle: ed.targetHandle ?? null,
            targetHandle: ed.sourceHandle ?? null,
          };
          return updated;
        })
      );
      if (updated) collab.broadcastGraphPatch([{ op: 'update_edge', data: updated as any }]);
    },
    [collab, edgeContextMenu, pushUndoSnapshot, setEdges]
  );

  // edge.delete — routujemy przez onEdgesChange, żeby dostać undo + collab
  // broadcast (remove_edge) + persist tą samą ścieżką co reszta zmian krawędzi.
  const handleEdgeDelete = useCallback(
    (edgeIdArg?: string) => {
      const edgeId = edgeIdArg ?? edgeContextMenu?.edgeId;
      if (!edgeId) return;
      onEdgesChange([{ id: edgeId, type: 'remove' }]);
    },
    [edgeContextMenu, onEdgesChange]
  );

  // Bridge for the refs declared near the `useWhiteboardQuickActions` call
  // above (needed there for a real `wb_edge_*` bus receiver before these
  // callbacks exist in render order) — same pattern as `runAIActionRef`.
  editEdgeLabelRef.current = handleEdgeEditLabel;
  reverseEdgeRef.current = handleEdgeReverse;
  cycleEdgeArrowRef.current = handleEdgeCycleArrow;
  cycleEdgeStyleRef.current = handleEdgeCycleStyle;
  deleteEdgeRef.current = handleEdgeDelete;

  const handleSlashCommand = useCallback(
    (action: string) => {
      setSlashMenuOpen(false);
      window.dispatchEvent(
        new CustomEvent('idea-workspace-quick-action', {
          detail: { action, ideaId },
        })
      );
    },
    [ideaId]
  );

  // ── AI Proposals (Propose→Accept) ──────────────────────────────────────────
  // Inserts proposal nodes+edges preserving the patch topology: proposal node ids
  // are remapped to fresh canvas ids so patch edges stay connected.
  const insertProposalGraph = useCallback(
    (
      addNodes: NonNullable<AIProposal['patch']['addNodes']>,
      addEdges: NonNullable<AIProposal['patch']['addEdges']>
    ) => {
      if (!addNodes.length && !addEdges.length) return;
      pushUndoSnapshot();
      const idMap = new Map<string, string>();
      const created: Node[] = [];
      // WB-P1-02: same batch-rect accumulation as handleExternalInsert — an
      // accepted proposal can add several nodes at once, and without this
      // they'd only be collision-checked against the pre-existing canvas,
      // not against each other.
      const batchRects: WhiteboardRect[] = [];
      addNodes.forEach((an, index) => {
        const node = createNode(
          toWbNodeKind(an.type),
          {
            ...(an.label ? { label: an.label } : {}),
            ...(an.position && { position: an.position }),
            ...(an.data || {}),
          },
          nodes.length + index,
          batchRects
        );
        const style = node.style as { width?: number; height?: number } | undefined;
        batchRects.push({
          x: node.position.x,
          y: node.position.y,
          width: style?.width ?? DEFAULT_WHITEBOARD_NODE_SIZE.width,
          height: style?.height ?? DEFAULT_WHITEBOARD_NODE_SIZE.height,
        });
        if (an.id) idMap.set(String(an.id), node.id);
        created.push(node);
      });
      if (created.length) {
        setNodes((prev: Node[]) => [...prev, ...created]);
        for (const node of created) collab.broadcastNodeAdd(node);
      }
      const existingIds = new Set(nodes.map((node) => node.id));
      const resolvedEdges = resolveProposalEdges(addEdges, idMap, existingIds);
      if (resolvedEdges.length) {
        setEdges((prev: Edge[]) => [...prev, ...(resolvedEdges as Edge[])]);
      }
    },
    [collab, createNode, nodes, pushUndoSnapshot, setEdges, setNodes]
  );

  // Applies an ACCEPTED proposal patch to the canvas. Only ever called from the
  // review flow (whiteboardCanon AC-05: generate→preview→apply, no silent apply).
  const applyProposalPatch = useCallback(
    (p: AIProposal) => {
      insertProposalGraph(p.patch?.addNodes || [], p.patch?.addEdges || []);
      // wb_to_table (cross-tool preview): insert generated row nodes as stickies
      const generatedRowNodes = (p.patch?.extensions as any)?.table?.generatedRowNodes;
      if (Array.isArray(generatedRowNodes) && generatedRowNodes.length) {
        insertProposalGraph(
          generatedRowNodes.map((rn: any) => ({
            id: String(rn?.id || ''),
            label: String(rn?.data?.label || ''),
            type: rn?.type,
            position: rn?.position,
            data: rn?.data || {},
          })),
          []
        );
      }
      // wb_name_clusters: rename existing nodes (merge data, keep callbacks)
      if (p.patch?.updateNodes?.length) {
        const updateNodes = p.patch.updateNodes;
        setNodes((nds: Node[]) => applyProposalNodeUpdates(nds, updateNodes));
      }
      // whiteboard_organize: reposition existing nodes
      if (p.patch?.moveNodes?.length) {
        const moveNodes = p.patch.moveNodes;
        setNodes((nds: Node[]) => applyProposalNodeMoves(nds, moveNodes));
      }
      // Cross-tool proposals (wb_to_map_branches → mindmap, wb_to_table → table):
      // no tool switching here — the preview lands on the whiteboard and the
      // resultSummary tells the user where to continue.
      if (p.generatorStatus === 'cross-tool' && p.resultSummary) {
        toast(p.resultSummary, { icon: 'ℹ️' });
      }
    },
    [insertProposalGraph, setNodes]
  );

  const handleAcceptProposal = useCallback(
    (proposalId: string) => {
      if (!proposalBatch) return;
      const updated: AIProposalBatch = {
        ...proposalBatch,
        proposals: proposalBatch.proposals.map((p) =>
          p.id === proposalId ? { ...p, status: 'accepted' as const } : p
        ),
      };
      setProposalBatch(updated);
      const accepted = updated.proposals.filter(
        (p) => p.id === proposalId && p.status === 'accepted'
      );
      for (const p of accepted) {
        applyProposalPatch(p);
      }
      appendActivity(
        createWhiteboardActivityEntry(
          'ai',
          `${t('myWork.whiteboard.ai.acceptedProposal')}: ${proposalId}`,
          currentUserId
        )
      );
      toast.success(t('myWork.whiteboard.ai.proposalApplied'));
    },
    [applyProposalPatch, appendActivity, currentUserId, isPl, proposalBatch]
  );

  const handleRejectProposal = useCallback(
    (proposalId: string) => {
      if (!proposalBatch) return;
      setProposalBatch((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          proposals: prev.proposals.map((p) =>
            p.id === proposalId ? { ...p, status: 'rejected' as const } : p
          ),
        };
      });
      appendActivity(
        createWhiteboardActivityEntry(
          'ai',
          `${t('myWork.whiteboard.ai.rejectedProposal')}: ${proposalId}`,
          currentUserId
        )
      );
    },
    [appendActivity, currentUserId, isPl, proposalBatch]
  );

  const handleAcceptAllProposals = useCallback(() => {
    if (!proposalBatch) return;
    const updated: AIProposalBatch = {
      ...proposalBatch,
      proposals: proposalBatch.proposals.map((p) =>
        p.status === 'pending' ? { ...p, status: 'accepted' as const } : p
      ),
    };
    setProposalBatch(updated);
    for (const p of updated.proposals.filter((pr) => pr.status === 'accepted')) {
      applyProposalPatch(p);
    }
    appendActivity(
      createWhiteboardActivityEntry('ai', t('myWork.whiteboard.ai.acceptedAll'), currentUserId)
    );
    toast.success(t('myWork.whiteboard.ai.allProposalsApplied'));
  }, [applyProposalPatch, appendActivity, currentUserId, isPl, proposalBatch]);

  const handleRejectAllProposals = useCallback(() => {
    setProposalBatch((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        proposals: prev.proposals.map((p) =>
          p.status === 'pending' ? { ...p, status: 'rejected' as const } : p
        ),
      };
    });
    appendActivity(
      createWhiteboardActivityEntry('ai', t('myWork.whiteboard.ai.rejectedAll'), currentUserId)
    );
  }, [appendActivity, currentUserId, isPl]);

  const handleGenerateProposal = useCallback(
    (batch: AIProposalBatch) => {
      setProposalBatch(batch);
      appendActivity(
        createWhiteboardActivityEntry(
          'ai',
          `${t('myWork.whiteboard.ai.generated')}: ${batch.generatorType}`,
          currentUserId
        )
      );
    },
    [appendActivity, currentUserId, isPl]
  );

  // ── AI quick actions (wb_* facilitation generators) ───────────────────────
  // generate → preview (IdeaProposalReview) → apply; never applied silently (AC-05).
  const aiActionPendingRef = useRef(false);
  const runWhiteboardAIAction = useCallback(
    async (generatorType: WhiteboardAIGeneratorType) => {
      if (locked || aiActionPendingRef.current) return;
      if (nodes.length === 0) {
        toast.error(t('myWork.whiteboard.ai.needsElements'));
        return;
      }
      // WB-P2-02: "Find themes" groups by LABEL SEMANTICS — if every object
      // in scope is still an unrenamed default ("New note", "Text", …), the
      // model has nothing real to cluster and would either fabricate themes
      // from nothing or return generic noise presented as insight. Coach the
      // missing input instead of running the generator (chapter 09 grounding
      // rule: say what's missing rather than let AI improvise specificity it
      // doesn't have). Scope matches what `context` below actually sends:
      // the active selection when there is one, otherwise the whole board.
      if (generatorType === 'wb_find_themes') {
        const scopeNodes =
          selectedNodeIds.length > 0
            ? nodes.filter((n) => selectedNodeIds.includes(n.id))
            : nodes;
        const generic = collectGenericWhiteboardLabels(t);
        const hasRealLabel = scopeNodes.some(
          (n) => !isGenericWhiteboardLabel(n.data?.label, generic)
        );
        if (!hasRealLabel) {
          toast.error(t('myWork.whiteboard.ai.needsRealLabels'), { duration: 5000 });
          return;
        }
      }
      aiActionPendingRef.current = true;
      const toastId = toast.loading(t('myWork.whiteboard.ai.generating'));
      try {
        const batch = await generateAIProposal({
          ideaId,
          generatorType,
          tool: 'whiteboard',
          context: {
            seedText: ideaSeedText,
            title: ideaTitle,
            existingNodes: nodes.map((node) => ({
              id: node.id,
              type: node.type,
              position: node.position,
              data: { label: node.data?.label, semanticType: node.data?.semanticType },
            })),
            existingEdges: edges.map((edge) => ({
              id: edge.id,
              source: edge.source,
              target: edge.target,
            })),
            language: i18n.language || 'en',
            ...(selectedNodeIds.length > 0 && {
              selection: {
                type: 'nodes',
                count: selectedNodeIds.length,
                ids: selectedNodeIds,
                primaryId: selectedNodeIds[0],
              },
            }),
          },
        });
        if (!batch.proposals.length) {
          toast.error(t('myWork.whiteboard.ai.noProposals'));
          return;
        }
        handleGenerateProposal(batch);
      } catch (error: any) {
        toast.error(error?.message || t('myWork.whiteboard.ai.generateFailed'));
      } finally {
        toast.dismiss(toastId);
        aiActionPendingRef.current = false;
      }
    },
    [
      edges,
      handleGenerateProposal,
      i18n.language,
      ideaId,
      ideaSeedText,
      ideaTitle,
      locked,
      nodes,
      selectedNodeIds,
    ]
  );
  runAIActionRef.current = runWhiteboardAIAction;

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  // Reconciliacja z Rejestrem Akcji (2026-08-10, E02 DoD) — patrz analogiczny
  // komentarz w `IdeaMapWorkspace.tsx` przy `runMindmapKeyboardAction`: każdy
  // callback z wpisem w `ideaActionRegistry.ts` idzie przez `runIdeaAction`
  // z `ctx.params.run` = DOKŁADNIE ta sama funkcja, którą wołał przed tym
  // wpisem — zachowanie klawisza bajtowo identyczne, zyskuje tylko wpis w
  // rejestrze i drugie wejście dla Teresy (tam, gdzie już istnieje odbiornik
  // na szynie). `onFitView` ŚWIADOMIE NIE przechodzi przez rejestr — czysta
  // nawigacja kamery, zero mutacji, bez menu/przycisku gdziekolwiek w kodzie
  // Tablicy (ta sama kategoria co Mapy myśli `onFocusSelection`).
  const runWbKeyboardAction = useCallback(
    (actionId: string, run: () => void) => {
      const ctx: ActionContext = {
        ideaId,
        tool: 'whiteboard',
        selection: EMPTY_SELECTION,
        surface: 'context',
        source: 'ui',
        language: isPl ? 'pl' : 'en',
        params: { run },
      };
      void runIdeaAction(actionId, ctx);
    },
    [ideaId, isPl]
  );

  // P3: shared grammar (Delete/Ctrl+Z/S/D/0/A/Shift+Z)
  useCanvasKeyboard({
    toolType: 'whiteboard',
    enabled: open,
    locked: locked || false,
    callbacks: {
      onSave: () => runWbKeyboardAction('idea.canvas.save', handleSave),
      onUndo: () => runWbKeyboardAction('idea.canvas.undo', undoWhiteboard),
      onRedo: () => runWbKeyboardAction('idea.canvas.redo', redoWhiteboard),
      onSelectAll: () =>
        runWbKeyboardAction('idea.canvas.wb_select_all', () =>
          setNodes((nds) => nds.map((n) => ({ ...n, selected: true })))
        ),
      onDeleteSelected: () => runWbKeyboardAction('idea.node.delete', deleteSelected),
      onDuplicate: () => runWbKeyboardAction('idea.node.duplicate', duplicateSelected),
      // WB-CLIPBOARD-01 fix: Ctrl+C/Ctrl+V now drive the same real object
      // clipboard as the context menu's Copy/Paste (see useWhiteboardNodes).
      onCopy: () => runWbKeyboardAction('idea.node.copy', copySelected),
      onPaste: () => runWbKeyboardAction('idea.canvas.paste', () => pasteClipboard()),
      onFitView: () => {
        // Dispatch viewport event to fit-to-view (fitView is not available outside ReactFlowProvider)
        const rfContainer = document.querySelector('.react-flow');
        if (rfContainer) {
          const evt = new CustomEvent('idea-whiteboard-set-viewport', {
            detail: { padding: 0.2, duration: 300, fit: true },
          });
          rfContainer.dispatchEvent(evt);
        }
      },
    },
  });

  // WB-specific shortcuts + Ctrl+S typing-safe fallback
  useEffect(() => {
    if (!open) return;
    const isEditing = () => {
      const el = document.activeElement;
      return (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        (el as HTMLElement)?.isContentEditable
      );
    };
    const handler = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !isEditing()) {
        e.preventDefault();
        setShortcutsHelpOpen((prev) => !prev);
        return;
      }
      if (e.key === 'Escape') {
        if (contextMenuPos) {
          e.preventDefault();
          setContextMenuPos(null);
          return;
        }
        if (slashMenuOpen) {
          e.preventDefault();
          setSlashMenuOpen(false);
          return;
        }
        if (proposalBatch) {
          e.preventDefault();
          setProposalBatch(null);
          return;
        }
        if (shortcutsHelpOpen) {
          e.preventDefault();
          setShortcutsHelpOpen(false);
          return;
        }
        if (whiteboardMode === 'draw') {
          e.preventDefault();
          setBoardMode('board');
          return;
        }
      }
      // Typing-safe fallback: fires even when an input is focused
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
        return;
      }
      if (isEditing()) return;
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        ungroupSelected();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        groupSelected();
        return;
      }
      if (e.key === '/' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setSlashMenuOpen(true);
        return;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    contextMenuPos,
    groupSelected,
    handleSave,
    open,
    proposalBatch,
    setBoardMode,
    shortcutsHelpOpen,
    slashMenuOpen,
    ungroupSelected,
    whiteboardMode,
  ]);

  // ── Focus-mode filtering (nodes + edges) ───────────────────────────────────
  const { nodes: displayNodes, edges: displayEdges } = useMemo(() => {
    const effectiveFocusId =
      focusMode === 'object' && focusObjectId
        ? focusObjectId
        : focusMode == null && drillFocusNodeId
          ? drillFocusNodeId
          : null;

    if (!effectiveFocusId || focusMode === 'system') {
      return { nodes, edges };
    }

    const visibleIds = new Set<string>();
    visibleIds.add(effectiveFocusId);

    const focusNode = nodes.find((n) => n.id === effectiveFocusId);
    const parentId = focusNode
      ? (focusNode as any).parentNode || (focusNode as any).parentId || focusNode.data?.parentId
      : undefined;

    if (parentId) {
      visibleIds.add(parentId);
      for (const n of nodes) {
        const pid = (n as any).parentNode || (n as any).parentId || n.data?.parentId;
        if (pid === parentId) visibleIds.add(n.id);
      }
    } else {
      for (const n of nodes) {
        const pid = (n as any).parentNode || (n as any).parentId || n.data?.parentId;
        if (pid === effectiveFocusId) visibleIds.add(n.id);
      }
    }

    const filteredNodes = nodes.filter((n: Node) => visibleIds.has(n.id));
    const filteredEdges = edges.filter(
      (e: Edge) => visibleIds.has(e.source) && visibleIds.has(e.target)
    );
    return { nodes: filteredNodes, edges: filteredEdges };
  }, [nodes, edges, focusMode, focusObjectId, drillFocusNodeId]);

  const selectedNodes = useMemo(() => nodes.filter((node: Node) => node.selected), [nodes]);
  const canvasNodes = useMemo(
    () =>
      displayNodes.map((node) => ({
        ...node,
        draggable: !locked && !isNodeDataLocked(node),
        connectable: !locked && !isNodeDataLocked(node),
        deletable: !locked && !isNodeDataLocked(node),
      })),
    [displayNodes, locked]
  );
  const selectedCount = selectedNodes.length;
  // A4: selectedNodeIds is already computed once at component top (from nodes'
  // selected flag) and is in scope here; reuse it for the SelectionBar convert
  // dispatch instead of redeclaring it.
  const hasSelectedFrame = selectedNodes.some(
    (node: Node) => node.type === 'frameNode' || node.type === 'groupNode'
  );

  // ── PASEK EDYCJI OBIEKTU (ff_canvasObjectEditBar) ──────────────────────────
  // Zgłoszenie właściciela: „zróbmy to tak jak w mapie myśli. menu kontekstowe,
  // czyli ikony i to co będzie się otwierać na środku menu narzędzia. no brakuje
  // nam czcionek (kolorów, wielkości, podkreśleń, bordów…)".
  //
  // WYMÓG TWARDY „nic nie znika": pasek zaznaczenia Tablicy niósł 11 funkcji
  // (Attach · Linked · Promote decision · Promote action · Align · Distribute ·
  // Group · Ungroup · Duplicate · Lock · Delete). WSZYSTKIE są niżej — etykiety
  // zamieniono na ikony, rozwijki Align/Distribute na popovery z tą samą
  // zawartością co do pozycji.
  const editBarSlot = useObjectEditBarSlot();
  const wbEditBarDocked = isCanvasObjectEditBarEnabled() && !!editBarSlot && selectedCount > 0;

  // Zmiana stylu dla CAŁEGO zaznaczenia (stary `handleNodeStyleChange` umiał
  // tylko jeden węzeł — pasek zaznaczenia bywa wielokrotny).
  const handleSelectionStyleChange = useCallback(
    (patch: Record<string, unknown>) => {
      for (const id of selectedNodeIds) handleNodeStyleChange(id, patch);
    },
    [selectedNodeIds, handleNodeStyleChange]
  );

  const wbQuickAction = useCallback(
    (action: string) => {
      window.dispatchEvent(
        new CustomEvent('idea-workspace-quick-action', {
          detail: {
            action,
            ideaId,
            ...(selectedNodeIds?.length ? { nodeIds: selectedNodeIds } : {}),
          },
        })
      );
    },
    [ideaId, selectedNodeIds]
  );

  const wbEditBarModel = useMemo(() => {
    if (!wbEditBarDocked) return null;
    const primary = selectedNodes[0];
    const style = readCanvasObjectStyle(primary?.data);
    const styleGroups = buildStyleGroups({
      style,
      onPatch: handleSelectionStyleChange,
      t,
      disabled: locked,
      show: { shape: true },
    });

    const arrange: ObjectEditBarGroup = {
      id: 'arrange',
      controls: [
        {
          kind: 'popover',
          id: 'align',
          icon: AlignCenter,
          label: t('myWork.whiteboard.selectionBar.align'),
          disabled: locked || selectedCount < 2,
          align: 'center',
          render: (close) => (
            <MenuListPopover
              title={t('myWork.whiteboard.selectionBar.align')}
              close={close}
              items={[
                {
                  id: 'left',
                  label: t('myWork.whiteboard.selection.alignLeft'),
                  icon: AlignLeft,
                  onClick: () => alignNodes('left'),
                },
                {
                  id: 'center',
                  label: t('myWork.whiteboard.selection.alignCenter'),
                  icon: AlignCenter,
                  onClick: () => alignNodes('center'),
                },
                {
                  id: 'right',
                  label: t('myWork.whiteboard.selection.alignRight'),
                  icon: AlignRight,
                  onClick: () => alignNodes('right'),
                },
                {
                  id: 'top',
                  label: t('myWork.whiteboard.selection.alignTop'),
                  icon: ArrowUp,
                  onClick: () => alignNodes('top'),
                },
                {
                  id: 'middle',
                  label: t('myWork.whiteboard.selection.alignMiddle'),
                  icon: AlignCenter,
                  onClick: () => alignNodes('middle'),
                },
                {
                  id: 'bottom',
                  label: t('myWork.whiteboard.selection.alignBottom'),
                  icon: ArrowDown,
                  onClick: () => alignNodes('bottom'),
                },
              ]}
            />
          ),
        },
        {
          kind: 'popover',
          id: 'distribute',
          icon: ArrowLeftRight,
          label: t('myWork.whiteboard.selectionBar.distribute'),
          disabled: locked || selectedCount < 3,
          align: 'center',
          render: (close) => (
            <MenuListPopover
              title={t('myWork.whiteboard.selectionBar.distribute')}
              close={close}
              items={[
                {
                  id: 'dist_h',
                  label: t('myWork.whiteboard.selection.distributeH'),
                  icon: ArrowLeftRight,
                  onClick: () => distributeNodes('horizontal'),
                },
                {
                  id: 'dist_v',
                  label: t('myWork.whiteboard.selection.distributeV'),
                  icon: ArrowUpDown,
                  onClick: () => distributeNodes('vertical'),
                },
              ]}
            />
          ),
        },
        {
          // WB-P2-03: "Tidy board" / "Auto arrange selection" — same command,
          // label reflects what it will do given the current selection
          // (>=2 unlocked selected → arranges just the selection; otherwise
          // the whole board). See useWhiteboardNodes.tidyBoard for the
          // collision-free layout + frame/group-preserving logic.
          kind: 'button',
          id: 'tidy',
          icon: Wand2,
          label:
            selectedCount >= 2
              ? t('myWork.whiteboard.selection.tidySelection')
              : t('myWork.whiteboard.selection.tidyBoard'),
          disabled: locked,
          onClick: tidyBoard,
        },
        {
          kind: 'button',
          id: 'group',
          icon: Group,
          label: t('myWork.whiteboard.selection.group'),
          disabled: locked || selectedCount < 2,
          onClick: groupSelected,
        },
        {
          kind: 'button',
          id: 'ungroup',
          icon: Ungroup,
          label: t('myWork.whiteboard.selection.ungroup'),
          disabled: locked || !hasSelectedFrame,
          onClick: ungroupSelected,
        },
        {
          kind: 'button',
          id: 'duplicate',
          icon: Copy,
          label: t('myWork.whiteboard.selection.duplicate'),
          disabled: locked,
          onClick: duplicateSelected,
        },
        {
          kind: 'button',
          id: 'lock',
          icon: Lock,
          label: t('myWork.whiteboard.selection.lock'),
          disabled: locked,
          onClick: lockSelected,
        },
      ],
    };

    const links: ObjectEditBarGroup = {
      id: 'links',
      controls: [
        {
          kind: 'button',
          id: 'attach',
          icon: Link2,
          label: t('myWork.whiteboard.selectionBar.attach'),
          disabled: locked,
          onClick: () => wbQuickAction('attach_artifact'),
        },
        {
          kind: 'button',
          id: 'linked',
          icon: ExternalLink,
          label: t('myWork.whiteboard.selectionBar.linked'),
          onClick: () => wbQuickAction('open_linked_artifacts'),
        },
        {
          kind: 'button',
          id: 'promote-decision',
          icon: Rocket,
          label: t('myWork.whiteboard.selectionBar.convertDecision'),
          disabled: locked,
          onClick: () => wbQuickAction('wb_convert_decision'),
        },
        {
          kind: 'button',
          id: 'promote-action',
          icon: CheckSquare,
          label: t('myWork.whiteboard.selectionBar.convertAction'),
          disabled: locked,
          onClick: () => wbQuickAction('wb_convert_action'),
        },
        {
          kind: 'button',
          id: 'delete',
          icon: Trash2,
          label: t('myWork.whiteboard.selection.delete'),
          disabled: locked,
          tone: 'danger',
          onClick: deleteSelected,
        },
      ],
    };

    return {
      title: t('myWork.whiteboard.selection.elementsSelected', { count: selectedCount }),
      groups: [...styleGroups, arrange, links],
    };
  }, [
    wbEditBarDocked,
    selectedNodes,
    selectedCount,
    hasSelectedFrame,
    locked,
    t,
    handleSelectionStyleChange,
    alignNodes,
    distributeNodes,
    tidyBoard,
    groupSelected,
    ungroupSelected,
    duplicateSelected,
    lockSelected,
    deleteSelected,
    wbQuickAction,
  ]);

  if (!open) return null;

  return (
    <div
      ref={wbKeyboardMenuContainerRef}
      className="w-full h-full flex flex-col bg-c-surface"
      role="region"
      aria-label={t('myWork.whiteboard.regionLabel')}
    >
      <WhiteboardToolbar
        isPl={isPl}
        locked={locked}
        hideSaveIndicator={hideSaveIndicator}
        saving={saving}
        loading={loading}
        sessionState={sessionState}
        sharePolicy={sharePolicy}
        presenceUsers={presenceUsers}
        bgPattern={bgPattern}
        drawingPathCount={drawingPaths.length}
        saveStatusLabel={saveStatusLabel}
        shortcutsHelpOpen={shortcutsHelpOpen}
        canUndo={undoStackRef.current.length > 0}
        canRedo={redoStackRef.current.length > 0}
        onAddElement={(kind, extraData) => addElement(kind as WbNodeKind, extraData)}
        onClearDrawings={async () => {
          const ok = await showConfirm({
            title: t('myWorkIdeas.whiteboardTool.clearDrawings'),
            description: t('myWorkIdeas.whiteboardTool.allPenPathsWillRemovedThis'),
            confirmLabel: t('myWorkIdeas.whiteboardTool.clear'),
            cancelLabel: t('myWorkIdeas.whiteboardTool.cancel'),
            variant: 'danger',
          });
          if (!ok) return;
          // CB-05 re-review: Clear Drawings is destructive (RB-043/§9) — it
          // must go through the same undo stack as every other mutation so
          // Ctrl/Cmd+Z (or the rail's Undo button) actually brings the
          // drawings back. Snapshot BEFORE clearing, exactly like every
          // other mutating handler in this file (see pushUndoSnapshot's
          // other call sites).
          pushUndoSnapshot();
          setDrawingPaths([]);
          toast.success(t('myWork.whiteboard.drawingsCleared'));
        }}
        onToggleVoting={toggleSessionVoting}
        onCycleRole={cycleSessionRole}
        onToggleFollow={toggleSessionFollow}
        onExport={() =>
          window.dispatchEvent(
            new CustomEvent('idea-workspace-open-export-menu', { detail: { ideaId } })
          )
        }
        onToggleShortcuts={() => setShortcutsHelpOpen((prev) => !prev)}
        onSetBgPattern={setBgPattern}
        onSave={handleSave}
        onUndo={undoWhiteboard}
        onRedo={redoWhiteboard}
        onTidyBoard={tidyBoard}
      />

      {/* Canvas */}
      {loading ? (
        vf1CanvasSpecAEnabled ? (
          // VF1 SPEC-A (flag OFF default): canonical A·Canvas skeleton.
          <div className="flex-1">
            <SkeletonState variant="canvas" />
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-4 p-6">
            <div className="flex items-center gap-3">
              <div className="h-8 w-32 bg-c-surface-raised rounded-xl animate-pulse" />
              <div className="h-8 w-24 bg-c-surface-raised rounded-xl animate-pulse" />
              <div className="h-8 w-20 bg-c-surface-raised rounded-xl animate-pulse" />
            </div>
            <div className="flex-1 grid grid-cols-3 gap-4">
              <div className="h-40 bg-c-surface-raised rounded-2xl animate-pulse" />
              <div className="h-32 bg-c-surface-raised rounded-2xl animate-pulse mt-8" />
              <div className="h-36 bg-c-surface-raised rounded-2xl animate-pulse mt-4" />
              <div className="h-28 bg-c-surface-raised rounded-2xl animate-pulse" />
              <div className="h-44 bg-c-surface-raised rounded-2xl animate-pulse" />
              <div className="h-24 bg-c-surface-raised rounded-2xl animate-pulse mt-6" />
            </div>
          </div>
        )
      ) : (
        <div className="flex-1 relative">
          {whiteboardSessionInPanelEnabled ? (
            sessionPanelSlot &&
            createPortal(
              <WhiteboardSessionPanel
                isPl={isPl}
                locked={locked}
                sessionState={sessionState}
                whiteboardModeCopy={whiteboardModeCopy}
                activityLog={activityLog}
                historyLog={historyLog}
                libraryItems={libraryItems}
                onCycleGovernance={cycleGovernance}
                onRestoreLatestHistory={restoreLatestHistory}
                onPhaseChange={handlePhaseChange}
                embedded
              />,
              sessionPanelSlot
            )
          ) : (
            <WhiteboardSessionPanel
              isPl={isPl}
              locked={locked}
              sessionState={sessionState}
              whiteboardModeCopy={whiteboardModeCopy}
              activityLog={activityLog}
              historyLog={historyLog}
              libraryItems={libraryItems}
              onCycleGovernance={cycleGovernance}
              onRestoreLatestHistory={restoreLatestHistory}
              onPhaseChange={handlePhaseChange}
            />
          )}

          {/* Idea lifecycle stage badge */}
          {ideaStage && (
            <div className="absolute top-2 right-2 z-20 px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider bg-c-surface backdrop-blur-sm border border-slate-200/60 dark:border-white/[0.03] text-c-text-secondary shadow-sm">
              {ideaStage}
            </div>
          )}

          {/* B1 (M09): observer read-only badge — signals why board interactions are disabled */}
          {isObserver && (
            <div
              data-testid="whiteboard-observer-badge"
              className="absolute top-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-c-surface backdrop-blur-sm border border-slate-200/60 dark:border-white/[0.03] text-c-text-secondary shadow-sm"
            >
              <svg
                className="w-3 h-3"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              {t('myWorkIdeas.whiteboardTool.observerViewOnly')}
            </div>
          )}

          {/* Pasek edycji zadokowany w listwie Menu 3. Gdy jest — pływający
              pasek zaznaczenia się NIE renderuje (jedno miejsce prawdy);
              gdy slotu brak (flaga OFF / brak Menu 3) — wraca pływający. */}
          {wbEditBarDocked && wbEditBarModel ? (
            <ObjectEditBarDock slot={editBarSlot}>
              <ObjectEditBar model={wbEditBarModel} />
            </ObjectEditBarDock>
          ) : null}

          {!wbEditBarDocked && (
            <WhiteboardSelectionBar
              isPl={isPl}
              locked={locked}
              selectedCount={selectedCount}
              hasSelectedFrame={hasSelectedFrame}
              ideaId={ideaId}
              selectedNodeIds={selectedNodeIds}
              onAlignNodes={alignNodes}
              onDistributeNodes={distributeNodes}
              onGroupSelected={groupSelected}
              onUngroupSelected={ungroupSelected}
              onDuplicateSelected={duplicateSelected}
              onLockSelected={lockSelected}
              onDeleteSelected={deleteSelected}
            />
          )}

          <ReactFlowProvider>
            <WhiteboardCanvas
              ref={canvasApiRef}
              nodes={canvasNodes}
              edges={displayEdges}
              locked={locked || whiteboardMode === 'draw'}
              cursorMode={canvasMode}
              isPolish={isPl}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeDoubleClick={onNodeDetail}
              bgPattern={bgPattern}
              onViewportChange={setViewportTransform}
              onExternalInsert={handleExternalInsert}
              onFullscreenToggle={externalOnFullscreenToggle}
              isFullscreen={externalIsFullscreen}
              onContextMenu={handleCanvasContextMenu}
              onEdgeContextMenu={handleEdgeContextMenu}
              onNodeStyleChange={handleNodeStyleChange}
              suppressFloatingStyleBar={wbEditBarDocked}
            />
          </ReactFlowProvider>

          {edgeContextMenu && (
            <WhiteboardEdgeContextMenu
              x={edgeContextMenu.x}
              y={edgeContextMenu.y}
              isPl={isPl}
              isLocked={locked}
              onClose={() => setEdgeContextMenu(null)}
              onEditLabel={handleEdgeEditLabel}
              onCycleStyle={handleEdgeCycleStyle}
              onCycleArrow={handleEdgeCycleArrow}
              onReverse={handleEdgeReverse}
              onDelete={handleEdgeDelete}
            />
          )}

          <IdeaCanvasContextMenu
            position={contextMenuPos}
            target={contextMenuTarget}
            onClose={() => setContextMenuPos(null)}
            ideaId={ideaId}
            activeTool={'whiteboard' as any}
            title={ideaTitle}
            seedText={ideaSeedText}
            branch=""
            area=""
            graphNodes={nodes as any[]}
            graphEdges={edges as any[]}
            isAccepted
            onGenerateProposal={handleGenerateProposal}
            onAttachKnowledge={(nodeId) => {
              window.dispatchEvent(
                new CustomEvent('idea-workspace-quick-action', {
                  detail: { action: 'attach_artifact', nodeId },
                })
              );
            }}
            onOpenComments={(nodeId) => setCommentsPanelNodeId(nodeId)}
            locked={locked}
            onDuplicate={duplicateSelected}
            onDeleteNode={deleteSelected}
            onLockNode={lockSelected}
            onBringToFront={bringSelectedToFront}
            onSendToBack={sendSelectedToBack}
            onCopySelected={copySelected}
            onPaste={() => pasteClipboard()}
            pasteDisabled={clipboardCount() === 0}
          />

          {commentsPanelNodeId &&
            (() => {
              const node = nodes.find((n) => n.id === commentsPanelNodeId);
              if (!node) return null;
              const nodeComments = readNodeComments(node.data);
              return (
                <WhiteboardNodeCommentThread
                  open
                  onClose={() => setCommentsPanelNodeId(null)}
                  nodeId={commentsPanelNodeId}
                  nodeLabel={String(node.data?.label || node.data?.text || commentsPanelNodeId)}
                  comments={nodeComments}
                  locked={locked}
                  currentUser={currentUserName}
                  isPl={!!isPl}
                  onAddComment={(nodeId, comment: WhiteboardNodeComment) => {
                    setNodes((nds) =>
                      nds.map((n) =>
                        n.id === nodeId
                          ? {
                              ...n,
                              data: {
                                ...n.data,
                                comments: appendNodeComment(readNodeComments(n.data), comment),
                              },
                            }
                          : n
                      )
                    );
                  }}
                  onDeleteComment={(nodeId, commentId) => {
                    setNodes((nds) =>
                      nds.map((n) =>
                        n.id === nodeId
                          ? {
                              ...n,
                              data: {
                                ...n.data,
                                comments: removeNodeComment(readNodeComments(n.data), commentId),
                              },
                            }
                          : n
                      )
                    );
                  }}
                />
              );
            })()}

          <IdeaSlashCommandMenu
            open={slashMenuOpen}
            activeTool={'whiteboard' as any}
            onClose={() => setSlashMenuOpen(false)}
            onCommand={handleSlashCommand}
          />

          {nodes.length === 0 && (
            <WhiteboardEmptyState
              isPl={isPl}
              locked={locked}
              onSeedQuickStart={seedQuickStart}
              onAddSticky={() => addElement('sticky')}
            />
          )}

          {outlineImportOpen && (
            <div
              className="absolute inset-0 z-30 flex items-center justify-center backdrop-blur-[1px]"
              style={{ backgroundColor: 'color-mix(in srgb, var(--c-bg) 45%, transparent)' }}
            >
              <div className="w-full max-w-lg rounded-2xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-4 shadow-2xl dark:shadow-[0_0_40px_rgba(0,0,0,0.5)]">
                <div className="text-sm font-semibold text-c-text">
                  {t('myWork.whiteboard.outlineImport.title')}
                </div>
                <div className="mt-1 text-xs text-c-text-muted">
                  {t('myWork.whiteboard.outlineImport.description')}
                </div>
                <textarea
                  value={outlineImportValue}
                  onChange={(event) => setOutlineImportValue(event.target.value)}
                  rows={8}
                  className="mt-3 w-full rounded-xl border border-c-border-subtle bg-c-surface-raised px-3 py-2 text-sm text-c-text outline-none focus:border-c-border-strong"
                  placeholder={t('myWork.whiteboard.outlineImport.placeholder')}
                />
                <div className="mt-3 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setOutlineImportOpen(false);
                      setOutlineImportValue('');
                    }}
                    className="rounded-xl px-3 py-2 text-xs font-semibold text-c-text-secondary hover:bg-c-surface-raised"
                  >
                    {t('myWork.whiteboard.outlineImport.cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={applyOutlineImport}
                    className="rounded-xl bg-c-text px-3 py-2 text-xs font-semibold text-c-surface hover:brightness-110"
                  >
                    {t('myWork.whiteboard.outlineImport.confirm')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Drawing layer overlay */}
          <IdeaDrawingLayer
            active={whiteboardMode === 'draw'}
            onClose={() => setBoardMode('board')}
            paths={drawingPaths}
            onPathsChange={setDrawingPaths}
            viewportTransform={viewportTransform}
          />

          {/* Sceny — jeden byt, dwa adresy: overlay nad płótnem (flaga OFF)
              albo karta w sekcji „Narzędzie" prawego panelu (flaga ON, portal).
              Propsy identyczne, więc dodawanie/przełączanie/kolejność/nazwa/
              usuwanie i tryb prezentacji działają tak samo w obu miejscach. */}
          {(() => {
            const sceny = (
              <IdeaScenesManager
                scenes={scenes}
                onScenesChange={setScenes}
                currentViewport={viewportTransform}
                onNavigateToScene={(viewport) => {
                  window.dispatchEvent(
                    new CustomEvent('idea-whiteboard-navigate', { detail: { viewport, ideaId } })
                  );
                }}
                embedded={panele6Enabled}
              />
            );
            if (!panele6Enabled) return sceny;
            return toolPanelSlot ? createPortal(sceny, toolPanelSlot) : null;
          })()}

          <CollaborationOverlay
            ideaId={ideaId}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
            selectedNodeIds={selectedNodeIds}
            onRegisterSend={collab.registerCollabSend}
          />
          {/* AI Proposal Review overlay */}
          {proposalBatch && (
            <div className="absolute bottom-4 left-4 right-4 z-dropdown max-w-lg mx-auto">
              <IdeaProposalReview
                batch={proposalBatch}
                onAccept={handleAcceptProposal}
                onReject={handleRejectProposal}
                onAcceptAll={handleAcceptAllProposals}
                onRejectAll={handleRejectAllProposals}
                onDismiss={() => setProposalBatch(null)}
              />
            </div>
          )}

          {/* AI Nudge Strip */}
          {!proposalBatch && nodes.length > 0 && (
            <IdeaAINudgeStrip
              ideaId={ideaId}
              activeTool={'whiteboard' as any}
              title={ideaTitle}
              seedText={ideaSeedText}
              isAccepted
              graphNodes={nodes as any[]}
              graphEdges={edges as any[]}
              // P1-1 (Z3): pasek podpowiedzi AI wysyłał `mm_ai_expand` /
              // `mm_ai_summarize`, które obsługuje WYŁĄCZNIE
              // useMindMapQuickActions (montowany tylko w Mapie myśli) — w
              // Whiteboardzie oba przyciski nie robiły NIC. Podpięte do realnych
              // generatorów tablicy (useWhiteboardQuickActions → AI_ACTION_MAP,
              // ścieżka propozycja→akceptacja).
              onActionExpand={() =>
                window.dispatchEvent(
                  new CustomEvent('idea-workspace-quick-action', {
                    detail: { action: 'wb_ai_find_themes', ideaId },
                  })
                )
              }
              onActionConvert={() =>
                window.dispatchEvent(
                  new CustomEvent('idea-workspace-quick-action', {
                    detail: { action: 'wb_ai_to_map', ideaId },
                  })
                )
              }
              // AGT/whiteboard fix: "N unconnected elements" pill's "Go" button had no
              // handler of its own — it silently fell through to onActionExpand
              // (wb_ai_find_themes), an unrelated AI action. There is no existing
              // "suggest connections" engine in whiteboard/ to call instead, so the
              // minimal real fix is: select the unconnected nodes on the canvas and
              // fit the view to them, so the user can see and connect them by hand.
              onActionConnect={(nodeIds) => {
                const idSet = new Set(nodeIds);
                setNodes((nds) => nds.map((n) => ({ ...n, selected: idSet.has(n.id) })));
                const rfContainer = document.querySelector('.react-flow');
                if (rfContainer) {
                  rfContainer.dispatchEvent(
                    new CustomEvent('idea-whiteboard-set-viewport', {
                      detail: { fit: true, padding: 0.3, duration: 400, nodeIds },
                    })
                  );
                }
              }}
            />
          )}

          <KeyboardShortcutsHelp
            isOpen={shortcutsHelpOpen}
            onClose={() => setShortcutsHelpOpen(false)}
            shortcuts={whiteboardShortcuts}
          />
        </div>
      )}
      {confirmDialog}
    </div>
  );
};

// ── Toolbar primitives extracted to whiteboard/WhiteboardToolbarPrimitives.tsx ──

export default IdeaWhiteboardTool;
