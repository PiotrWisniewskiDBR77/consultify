import 'reactflow/dist/style.css';
import './mindmap/mindmap-effects.css';

import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Edit3,
  ExternalLink,
  FileText,
  Flower2,
  GitBranch,
  Lightbulb,
  Link2,
  Loader2,
  Lock,
  MoreVertical,
  MoveRight,
  Paperclip,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  StickyNote,
  Unlock,
  X,
} from 'lucide-react';
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import ReactFlow, {
  addEdge,
  applyNodeChanges,
  Background,
  type Connection,
  ConnectionMode,
  type Edge,
  Handle,
  MiniMap,
  type Node,
  type NodeProps,
  Panel,
  Position,
  ReactFlowProvider,
  useEdgesState,
  useNodesInitialized,
  useNodesState,
  useReactFlow,
} from 'reactflow';

import { Callout, EmptyStateInline } from '@/components/shared/NModeBlocks';
import { useFeatureFlagsContext } from '@/contexts/FeatureFlagsContext';
import { usePortalSlot } from '@/hooks/usePortalSlot';
import { Api, getMapVersionFromPayload } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';
import {
  type ArtifactLink,
  artifactLinkToOpenPayload,
  type ArtifactType,
  buildArtifactLink,
  getArtifactPath,
} from '@/utils/artifactLinks';
import {
  CANVAS_OBJECT_EDIT_BAR_SLOT_ID,
  isCanvasObjectEditBarEnabled,
} from '@/utils/canvasObjectEditBarFlag';

import TeresaMark from '../shared/TeresaMark';
import { getCanvasBg } from './canvas/canvasBackground';
import { isCanvasKeyboardScope, resolveMindMapGrammarAction } from './canvas/mindmapKeyboardScope';
import {
  canvasObjectSurfaceStyle,
  canvasObjectTextStyle,
  canvasShapeClasses,
  readCanvasObjectStyle,
} from './canvas/canvasObjectStyle';
import { CanvasSnapGuides } from './canvas/CanvasSnapGuides';
import { CanvasZoomControls } from './canvas/CanvasZoomControls';
import { getIdeaCanvasCursorClass, getIdeaCanvasCursorProps } from './canvas/ideaCanvasCursorMode';
import { ObjectEditBar, type ObjectEditBarGroup } from './canvas/ObjectEditBar';
import {
  buildStyleGroups,
  ObjectEditBarDock,
  useObjectEditBarSlot,
} from './canvas/objectEditBarDock';
import { ArrowDirectionPopover, type CanvasArrowDirection } from './canvas/ObjectEditBarPopovers';
import { useCanvasSnapping } from './canvas/useCanvasSnapping';
import { useIdeaCollab } from './canvas/useIdeaCollab';
import { getIdeasToolInteractionProps } from './canvas/useIdeasToolDefaults';
import {
  IDEA_STAGE_COLORS,
  IDEA_STAGE_LABELS,
  IDEA_STAGES_V5,
  type IdeaStageV5,
  normalizeStageToV5,
} from './ideaEntryTypes';
import {
  type CanvasToolType,
  IDEA_WORKSPACE_INSERT_EVENT,
  IDEA_WORKSPACE_THEME_EVENT,
  type IdeaWorkspaceInsertDetail,
  type MapStructureType,
  type MindMapInteractionMode,
} from './ideaSelectionTypes';
import { knowledgeNodeTypes } from './knowledge/KnowledgeCardNodes';
import { ActivityFeed, pushActivity } from './mindmap/ActivityFeed';
import { AddEvidenceModal } from './mindmap/AddEvidenceModal';
import { AIAutoClustering, type Cluster } from './mindmap/AIAutoClustering';
import { AIBlindSpotsDetector } from './mindmap/AIBlindSpotsDetector';
import { AIBranchBalancer } from './mindmap/AIBranchBalancer';
import { AICompetitiveLandscape } from './mindmap/AICompetitiveLandscape';
import { AIDependencyDetector, type DetectedDependency } from './mindmap/AIDependencyDetector';
import { AIPriorityRecommender } from './mindmap/AIPriorityRecommender';
import { AIProposalDiffModal } from './mindmap/AIProposalDiffModal';
import { AISentimentOverlay, type SentimentResult } from './mindmap/AISentimentOverlay';
import { detectMindmapIntent, type SidekickContext } from './mindmap/aiSidekickContext';
import { AIWhatIfScenarios } from './mindmap/AIWhatIfScenarios';
import { type AlignMode, computeAlignDistribute } from './mindmap/alignDistribute';
import { AssignPersonModal } from './mindmap/AssignPersonModal';
import { AttachArtifactModal } from './mindmap/AttachArtifactModal';
import { IdeaAINudgeStrip } from './IdeaAINudgeStrip';
import { BatchConvertModal } from './mindmap/BatchConvertModal';
import { BranchComparison } from './mindmap/BranchComparison';
import { BranchSummaryPanel } from './mindmap/BranchSummaryPanel';
import { ClusterBubbles } from './mindmap/ClusterBubbles';
import {
  CollaborationOverlay,
  type CollaborationSessionState,
} from './mindmap/CollaborationOverlay';
import { DocumentToMap } from './mindmap/DocumentToMap';
import { EdgeContextMenu } from './mindmap/EdgeContextMenu';
import { EmbedInReports } from './mindmap/EmbedInReports';
import { ExportDiagramCode } from './mindmap/ExportDiagramCode';
import { ExportPowerPoint } from './mindmap/ExportPowerPoint';
import { FloatingNodeToolbar } from './mindmap/FloatingNodeToolbar';
import { GradientEdge } from './mindmap/GradientEdge';
import { IdeaFunnelAnalytics } from './mindmap/IdeaFunnelAnalytics';
import { ImageUrlModal } from './mindmap/ImageUrlModal';
import { ImportExternalMap } from './mindmap/ImportExternalMap';
import { InterviewToMap } from './mindmap/InterviewToMap';
import { LabeledEdge } from './mindmap/LabeledEdge';
import { LargeMapOptimizer } from './mindmap/LargeMapOptimizer';
import { BranchHealthDot, computeBranchHealth, MapHealthScore } from './mindmap/MapHealthScore';
import { MindMap3DView } from './mindmap/MindMap3DView';
import { MindmapCommandPalette } from './mindmap/MindmapCommandPalette';
import { MindMapFrameNode } from './mindmap/MindMapFrameNode';
import { normalizeMindmapNodeQuickAction } from './mindmap/mindmapInteractionGrammar';
import {
  appendAIHistoryEntry,
  applyNodeStyle,
  applyStyleToNodes,
  collectDescendantIds,
  copyNodeStyle,
} from './mindmap/mindMapNodeModel';
import {
  MindMapNodeResizer,
  MM_MIN_NODE_HEIGHT,
  MM_MIN_NODE_WIDTH,
  useNodeHasExplicitSize,
} from './mindmap/MindMapNodeResizer';
import { type NodeComment, NodeCommentThread } from './mindmap/NodeCommentThread';
import { NodeContextMenu } from './mindmap/NodeContextMenu';
import { type NodeDetailData, NodeDetailDrawer, type NodeStatus } from './mindmap/NodeDetailDrawer';
import {
  GlowWrapper,
  MaturityRing,
  type NodeStatusType,
  StatusDot,
  VoteStars,
} from './mindmap/NodeEnhancements';
import { PaneContextMenu } from './mindmap/PaneContextMenu';
import { PresentationMode } from './mindmap/PresentationMode';
import { SnapshotHistory } from './mindmap/SnapshotHistory';
import { applyStructureLayout } from './mindmap/StructureLayouts';
import { type BreadcrumbItem, SubMapBreadcrumb } from './mindmap/SubMapBreadcrumb';
import { resolveTagColor } from './mindmap/tagColorMapping';
import { TimeHeatmap } from './mindmap/TimeHeatmap';
import { TimelineView } from './mindmap/TimelineView';
import { StructurePickerPopover } from './mindmap/toolbar-popovers/StructurePickerPopover';
import { type UnifiedNodeData, UnifiedNodeDetailDrawer } from './mindmap/UnifiedNodeDetailDrawer';
import { useAutoLayout } from './mindmap/useAutoLayout';
import { useMapExport } from './mindmap/useMapExport';
import { useMapExportPdf } from './mindmap/useMapExportPdf';
import {
  hasMindMapClipboard,
  isRelationEdge,
  isStructuralEdge,
  useMindMapNodes,
} from './mindmap/useMindMapNodes';
import { useMindMapPersistence } from './mindmap/useMindMapPersistence';
import { useMindMapQuickActions } from './mindmap/useMindMapQuickActions';
import { shouldVirtualize } from './mindmap/virtualization';
import { VoiceToNode } from './mindmap/VoiceToNode';
import { IDEA_PANEL_AI_SLOT_ID } from './panel/ideaPanel6Sections';
import { isIdeaPanel6SectionsEnabled } from './panel/ideaPanel6SectionsFlag';
import { useConfirmDialog } from './shared/ConfirmDialog';
import { useIsDark } from './whiteboard/nodes/whiteboardNodeHelpers';
type IdeaNodeData = NodeDetailData & {
  _depth?: number;
};

type AIMapProposal = {
  add: { nodes: Node[]; edges: Edge[] };
  remove: { nodeIds: string[]; edgeIds: string[] };
  reorder?: { note?: string; order?: string[] } | null;
  rationale?: string | null;
};

type DebugSource =
  | 'lifecycle'
  | 'input'
  | 'handler'
  | 'keyboard'
  | 'selection'
  | 'persistence'
  | 'custom'
  | 'warning'
  | 'error';

type DebugReaction = 'handled' | 'blocked' | 'silent';
type DebugSeverity = 'info' | 'warn' | 'error';

type DebugEntry = {
  id: string;
  ts: string;
  source: DebugSource;
  message: string;
  detail?: string;
  reaction?: DebugReaction;
  severity: DebugSeverity;
};

type PendingInteraction = {
  kind: 'click' | 'dblclick' | 'contextmenu';
  target: string;
  createdAt: number;
  timeoutId: number;
};

const MAX_DEBUG_ENTRIES = 500;
const DEBUG_SESSION_KEY = '__mm_debug_v2';
const LEGACY_DEBUG_SESSION_KEY = '__mm_debug';

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function truncateDebugText(value: string, max = 120) {
  const normalized = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized.length > max ? `${normalized.slice(0, max - 1)}...` : normalized;
}

function describeDebugTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return 'unknown-target';
  if (target.closest('[data-mm-debug-overlay="true"]')) return 'debug-overlay';

  const nodeEl = target.closest('.react-flow__node') as HTMLElement | null;
  if (nodeEl) {
    const nodeId = nodeEl.getAttribute('data-id') || 'unknown-node';
    return `node:${nodeId}`;
  }

  const edgeEl = target.closest('.react-flow__edge') as HTMLElement | null;
  if (edgeEl) {
    const edgeId = edgeEl.getAttribute('data-id') || 'unknown-edge';
    return `edge:${edgeId}`;
  }

  if (target.closest('.react-flow__pane')) return 'canvas-pane';

  const bits: string[] = [];
  const role = target.getAttribute('role');
  const testId = target.getAttribute('data-testid');
  const ariaLabel = target.getAttribute('aria-label');
  const tag = target.tagName.toLowerCase();
  const cls = String(target.className || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .join('.');
  const text = truncateDebugText(target.textContent || '', 40);

  bits.push(tag);
  if (role) bits.push(`role=${role}`);
  if (testId) bits.push(`testid=${testId}`);
  if (ariaLabel) bits.push(`label=${truncateDebugText(ariaLabel, 40)}`);
  if (cls) bits.push(`.${cls}`);
  if (text) bits.push(`text=${text}`);
  return bits.join(' ');
}

function formatDebugKey(event: KeyboardEvent) {
  const parts: string[] = [];
  if (event.metaKey) parts.push('Meta');
  if (event.ctrlKey) parts.push('Ctrl');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');
  const key = event.key === ' ' ? 'Space' : event.key;
  if (!['Meta', 'Control', 'Alt', 'Shift'].includes(key)) parts.push(key);
  return parts.join('+') || key;
}

function summarizeDebugDetail(detail: unknown) {
  try {
    return truncateDebugText(JSON.stringify(detail), 160);
  } catch {
    return truncateDebugText(String(detail || ''), 160);
  }
}

function normalizeLegacyDebugEntries(raw: unknown): DebugEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, index) => {
      if (item && typeof item === 'object' && 'message' in item) {
        const entry = item as Partial<DebugEntry>;
        return {
          id: String(entry.id || `legacy-${index}`),
          ts: String(entry.ts || ''),
          source: (entry.source as DebugSource) || 'lifecycle',
          message: String(entry.message || ''),
          detail: entry.detail ? String(entry.detail) : undefined,
          reaction: entry.reaction as DebugReaction | undefined,
          severity: (entry.severity as DebugSeverity) || 'info',
        };
      }
      if (typeof item === 'string') {
        return {
          id: `legacy-${index}`,
          ts: '',
          source: item.includes('ERROR') || item.includes('REJECTION') ? 'error' : 'lifecycle',
          message: item,
          severity: item.includes('ERROR') || item.includes('REJECTION') ? 'error' : 'info',
        };
      }
      return null;
    })
    .filter(Boolean) as DebugEntry[];
}

const BRANCH_COLORS: Record<
  string,
  { bg: string; border: string; text: string; ring: string; edge: string }
> = {
  problem: {
    bg: 'bg-danger-100 dark:bg-danger-900/25',
    border: 'border-danger-400/70',
    text: 'text-danger-700 dark:text-danger-300',
    ring: 'ring-danger-400',
    edge: '#fb7185',
  },
  goal: {
    bg: 'bg-emerald-100 dark:bg-emerald-900/25',
    border: 'border-emerald-400/70',
    text: 'text-emerald-700 dark:text-emerald-300',
    ring: 'ring-emerald-400',
    edge: '#34d399',
  },
  options: {
    bg: 'bg-amber-100 dark:bg-amber-900/25',
    border: 'border-amber-400/70',
    text: 'text-amber-700 dark:text-amber-300',
    ring: 'ring-amber-400',
    edge: '#fbbf24',
  },
  evidence: {
    bg: 'bg-sky-100 dark:bg-sky-900/25',
    border: 'border-sky-400/70',
    text: 'text-sky-700 dark:text-sky-300',
    ring: 'ring-sky-400',
    edge: '#38bdf8',
  },
  risks: {
    bg: 'bg-violet-100 dark:bg-violet-900/25',
    border: 'border-violet-400/70',
    text: 'text-violet-700 dark:text-violet-300',
    ring: 'ring-violet-400',
    edge: '#a78bfa',
  },
  experiments: {
    bg: 'bg-blue-100 dark:bg-blue-900/25',
    border: 'border-blue-400/70',
    text: 'text-blue-700 dark:text-blue-300',
    ring: 'ring-blue-400',
    edge: '#22d3ee',
  },
  plan: {
    bg: 'bg-blue-100 dark:bg-blue-900/25',
    border: 'border-blue-400/70',
    text: 'text-blue-700 dark:text-blue-300',
    ring: 'ring-blue-400',
    edge: '#60a5fa',
  },
  // Consulting templates
  strengths: {
    bg: 'bg-emerald-100 dark:bg-emerald-900/25',
    border: 'border-emerald-400/70',
    text: 'text-emerald-700 dark:text-emerald-300',
    ring: 'ring-emerald-400',
    edge: '#34d399',
  },
  weaknesses: {
    bg: 'bg-danger-100 dark:bg-danger-900/25',
    border: 'border-danger-400/70',
    text: 'text-danger-700 dark:text-danger-300',
    ring: 'ring-danger-400',
    edge: '#fb7185',
  },
  opportunities: {
    bg: 'bg-amber-100 dark:bg-amber-900/25',
    border: 'border-amber-400/70',
    text: 'text-amber-700 dark:text-amber-300',
    ring: 'ring-amber-400',
    edge: '#fbbf24',
  },
  threats: {
    bg: 'bg-violet-100 dark:bg-violet-900/25',
    border: 'border-violet-400/70',
    text: 'text-violet-700 dark:text-violet-300',
    ring: 'ring-violet-400',
    edge: '#a78bfa',
  },
  // 5 Whys
  why1: {
    bg: 'bg-amber-100 dark:bg-amber-900/25',
    border: 'border-amber-400/70',
    text: 'text-amber-700 dark:text-amber-300',
    ring: 'ring-amber-400',
    edge: '#fb923c',
  },
  why2: {
    bg: 'bg-amber-100 dark:bg-amber-900/25',
    border: 'border-amber-400/70',
    text: 'text-amber-700 dark:text-amber-300',
    ring: 'ring-amber-400',
    edge: '#fbbf24',
  },
  why3: {
    bg: 'bg-yellow-100 dark:bg-yellow-900/25',
    border: 'border-yellow-400/70',
    text: 'text-yellow-700 dark:text-yellow-300',
    ring: 'ring-yellow-400',
    edge: '#facc15',
  },
  why4: {
    bg: 'bg-lime-100 dark:bg-lime-900/25',
    border: 'border-lime-400/70',
    text: 'text-lime-700 dark:text-lime-300',
    ring: 'ring-lime-400',
    edge: '#a3e635',
  },
  root_cause: {
    bg: 'bg-danger-100 dark:bg-danger-900/25',
    border: 'border-danger-400/70',
    text: 'text-danger-700 dark:text-danger-300',
    ring: 'ring-danger-400',
    edge: '#f87171',
  },
  // Ishikawa (6M)
  man: {
    bg: 'bg-blue-100 dark:bg-blue-900/25',
    border: 'border-blue-400/70',
    text: 'text-blue-700 dark:text-blue-300',
    ring: 'ring-blue-400',
    edge: '#60a5fa',
  },
  machine: {
    bg: 'bg-indigo-100 dark:bg-indigo-900/25',
    border: 'border-indigo-400/70',
    text: 'text-indigo-700 dark:text-indigo-300',
    ring: 'ring-indigo-400',
    edge: '#818cf8',
  },
  material: {
    bg: 'bg-blue-100 dark:bg-blue-900/25',
    border: 'border-blue-400/70',
    text: 'text-blue-700 dark:text-blue-300',
    ring: 'ring-blue-400',
    edge: '#2dd4bf',
  },
  method: {
    bg: 'bg-violet-100 dark:bg-violet-900/25',
    border: 'border-violet-400/70',
    text: 'text-violet-700 dark:text-violet-300',
    ring: 'ring-violet-400',
    edge: '#6366f1',
  },
  measurement: {
    bg: 'bg-fuchsia-100 dark:bg-fuchsia-900/25',
    border: 'border-fuchsia-400/70',
    text: 'text-fuchsia-700 dark:text-fuchsia-300',
    ring: 'ring-fuchsia-400',
    edge: '#d946ef',
  },
  environment: {
    bg: 'bg-green-100 dark:bg-green-900/25',
    border: 'border-green-400/70',
    text: 'text-green-700 dark:text-green-300',
    ring: 'ring-green-400',
    edge: '#4ade80',
  },
  // Stakeholder map
  high_influence: {
    bg: 'bg-danger-100 dark:bg-danger-900/25',
    border: 'border-danger-400/70',
    text: 'text-danger-700 dark:text-danger-300',
    ring: 'ring-danger-400',
    edge: '#f87171',
  },
  medium_influence: {
    bg: 'bg-amber-100 dark:bg-amber-900/25',
    border: 'border-amber-400/70',
    text: 'text-amber-700 dark:text-amber-300',
    ring: 'ring-amber-400',
    edge: '#fbbf24',
  },
  low_influence: {
    bg: 'bg-emerald-100 dark:bg-emerald-900/25',
    border: 'border-emerald-400/70',
    text: 'text-emerald-700 dark:text-emerald-300',
    ring: 'ring-emerald-400',
    edge: '#34d399',
  },
  // Porter's 5 Forces
  rivalry: {
    bg: 'bg-danger-100 dark:bg-danger-900/25',
    border: 'border-danger-400/70',
    text: 'text-danger-700 dark:text-danger-300',
    ring: 'ring-danger-400',
    edge: '#fb7185',
  },
  new_entrants: {
    bg: 'bg-amber-100 dark:bg-amber-900/25',
    border: 'border-amber-400/70',
    text: 'text-amber-700 dark:text-amber-300',
    ring: 'ring-amber-400',
    edge: '#fb923c',
  },
  substitutes: {
    bg: 'bg-amber-100 dark:bg-amber-900/25',
    border: 'border-amber-400/70',
    text: 'text-amber-700 dark:text-amber-300',
    ring: 'ring-amber-400',
    edge: '#fbbf24',
  },
  buyer_power: {
    bg: 'bg-sky-100 dark:bg-sky-900/25',
    border: 'border-sky-400/70',
    text: 'text-sky-700 dark:text-sky-300',
    ring: 'ring-sky-400',
    edge: '#38bdf8',
  },
  supplier_power: {
    bg: 'bg-indigo-100 dark:bg-indigo-900/25',
    border: 'border-indigo-400/70',
    text: 'text-indigo-700 dark:text-indigo-300',
    ring: 'ring-indigo-400',
    edge: '#818cf8',
  },
  // Value Chain
  inbound: {
    bg: 'bg-blue-100 dark:bg-blue-900/25',
    border: 'border-blue-400/70',
    text: 'text-blue-700 dark:text-blue-300',
    ring: 'ring-blue-400',
    edge: '#22d3ee',
  },
  operations: {
    bg: 'bg-blue-100 dark:bg-blue-900/25',
    border: 'border-blue-400/70',
    text: 'text-blue-700 dark:text-blue-300',
    ring: 'ring-blue-400',
    edge: '#60a5fa',
  },
  outbound: {
    bg: 'bg-violet-100 dark:bg-violet-900/25',
    border: 'border-violet-400/70',
    text: 'text-violet-700 dark:text-violet-300',
    ring: 'ring-violet-400',
    edge: '#6366f1',
  },
  marketing: {
    bg: 'bg-pink-100 dark:bg-pink-900/25',
    border: 'border-pink-400/70',
    text: 'text-pink-700 dark:text-pink-300',
    ring: 'ring-pink-400',
    edge: '#f472b6',
  },
  service: {
    bg: 'bg-emerald-100 dark:bg-emerald-900/25',
    border: 'border-emerald-400/70',
    text: 'text-emerald-700 dark:text-emerald-300',
    ring: 'ring-emerald-400',
    edge: '#34d399',
  },
  support: {
    bg: 'bg-slate-200 dark:bg-slate-700/40',
    border: 'border-slate-400/70',
    text: 'text-slate-600 dark:text-slate-300',
    ring: 'ring-slate-400',
    edge: '#94a3b8',
  },
  // McKinsey 7S
  strategy: {
    bg: 'bg-blue-100 dark:bg-blue-900/25',
    border: 'border-blue-400/70',
    text: 'text-blue-700 dark:text-blue-300',
    ring: 'ring-blue-400',
    edge: '#60a5fa',
  },
  structure: {
    bg: 'bg-indigo-100 dark:bg-indigo-900/25',
    border: 'border-indigo-400/70',
    text: 'text-indigo-700 dark:text-indigo-300',
    ring: 'ring-indigo-400',
    edge: '#818cf8',
  },
  systems: {
    bg: 'bg-violet-100 dark:bg-violet-900/25',
    border: 'border-violet-400/70',
    text: 'text-violet-700 dark:text-violet-300',
    ring: 'ring-violet-400',
    edge: '#6366f1',
  },
  shared_values: {
    bg: 'bg-danger-100 dark:bg-danger-900/25',
    border: 'border-danger-400/70',
    text: 'text-danger-700 dark:text-danger-300',
    ring: 'ring-danger-400',
    edge: '#fb7185',
  },
  skills: {
    bg: 'bg-emerald-100 dark:bg-emerald-900/25',
    border: 'border-emerald-400/70',
    text: 'text-emerald-700 dark:text-emerald-300',
    ring: 'ring-emerald-400',
    edge: '#34d399',
  },
  style: {
    bg: 'bg-amber-100 dark:bg-amber-900/25',
    border: 'border-amber-400/70',
    text: 'text-amber-700 dark:text-amber-300',
    ring: 'ring-amber-400',
    edge: '#fbbf24',
  },
  staff: {
    bg: 'bg-blue-100 dark:bg-blue-900/25',
    border: 'border-blue-400/70',
    text: 'text-blue-700 dark:text-blue-300',
    ring: 'ring-blue-400',
    edge: '#22d3ee',
  },
  // OKR
  obj1: {
    bg: 'bg-blue-100 dark:bg-blue-900/25',
    border: 'border-blue-400/70',
    text: 'text-blue-700 dark:text-blue-300',
    ring: 'ring-blue-400',
    edge: '#60a5fa',
  },
  obj2: {
    bg: 'bg-emerald-100 dark:bg-emerald-900/25',
    border: 'border-emerald-400/70',
    text: 'text-emerald-700 dark:text-emerald-300',
    ring: 'ring-emerald-400',
    edge: '#34d399',
  },
  // Kotter's 8 Steps
  urgency: {
    bg: 'bg-danger-100 dark:bg-danger-900/25',
    border: 'border-danger-400/70',
    text: 'text-danger-700 dark:text-danger-300',
    ring: 'ring-danger-400',
    edge: '#f87171',
  },
  coalition: {
    bg: 'bg-amber-100 dark:bg-amber-900/25',
    border: 'border-amber-400/70',
    text: 'text-amber-700 dark:text-amber-300',
    ring: 'ring-amber-400',
    edge: '#fb923c',
  },
  vision: {
    bg: 'bg-amber-100 dark:bg-amber-900/25',
    border: 'border-amber-400/70',
    text: 'text-amber-700 dark:text-amber-300',
    ring: 'ring-amber-400',
    edge: '#fbbf24',
  },
  communicate: {
    bg: 'bg-sky-100 dark:bg-sky-900/25',
    border: 'border-sky-400/70',
    text: 'text-sky-700 dark:text-sky-300',
    ring: 'ring-sky-400',
    edge: '#38bdf8',
  },
  obstacles: {
    bg: 'bg-danger-100 dark:bg-danger-900/25',
    border: 'border-danger-400/70',
    text: 'text-danger-700 dark:text-danger-300',
    ring: 'ring-danger-400',
    edge: '#fb7185',
  },
  wins: {
    bg: 'bg-emerald-100 dark:bg-emerald-900/25',
    border: 'border-emerald-400/70',
    text: 'text-emerald-700 dark:text-emerald-300',
    ring: 'ring-emerald-400',
    edge: '#34d399',
  },
  build: {
    bg: 'bg-blue-100 dark:bg-blue-900/25',
    border: 'border-blue-400/70',
    text: 'text-blue-700 dark:text-blue-300',
    ring: 'ring-blue-400',
    edge: '#60a5fa',
  },
  anchor: {
    bg: 'bg-violet-100 dark:bg-violet-900/25',
    border: 'border-violet-400/70',
    text: 'text-violet-700 dark:text-violet-300',
    ring: 'ring-violet-400',
    edge: '#a78bfa',
  },
  uncategorized: {
    bg: 'bg-slate-100 dark:bg-slate-800/40',
    border: 'border-slate-300/70',
    text: 'text-slate-600 dark:text-slate-400',
    ring: 'ring-slate-400',
    edge: '#94a3b8',
  },
};

// V5-IDEA-43: Hierarchical color system — depth-based opacity modulation
const DEPTH_OPACITY = [1, 0.85, 0.7, 0.55, 0.4] as const;

/** Edge colors for AI-detected dependency types (AIDependencyDetector). */
const DEP_EDGE_COLOR: Record<string, string> = {
  depends_on: 'var(--c-danger)',
  enables: 'var(--c-success)',
  conflicts_with: 'var(--c-warning)',
  related_to: 'var(--c-info)',
};

function getNodeDepth(data: IdeaNodeData) {
  return data._depth ?? 0;
}

/**
 * Minimap fill — MUST mirror the key the canvas paints a node with, otherwise the
 * thumbnail is a field of identical grey dots that says nothing about the map.
 *
 * Canvas order (see `EditableIdeaNodeComponent`): explicit `data.color` / semantic
 * accent (`inferNodeAccentColor`) → first tag (`resolveTagColor`) → branch palette
 * modulated by depth (`branchColor`). Real maps have most nodes on
 * `branchKey: 'uncategorized'`, so keying only on `branchKey` (the old behaviour)
 * collapsed ~95% of the map to one slate tone.
 */
function miniMapNodeColor(node: Node): string {
  const data = (node.data || {}) as Record<string, any>;
  if (node.type === 'center') return 'var(--c-warning)';

  // Same precedence as the rendered node: explicit/semantic accent wins.
  const accent = inferNodeAccentColor(data);
  if (accent) return accent;

  const tag = resolveTagColor(Array.isArray(data.tags) ? data.tags : []);
  if (tag) return tag.color;

  switch (node.type) {
    case 'branch':
    case 'idea':
      return branchColor(data.branchKey, data._depth).edge;
    case 'knowledgeCard':
      return 'var(--c-tag-2)';
    case 'noteCard':
      return 'var(--c-tag-9)';
    case 'evidenceCard':
      return 'var(--c-tag-8)';
    default:
      return 'var(--c-border-strong)';
  }
}

function branchColor(key: string, depth?: number) {
  const base = BRANCH_COLORS[key] || BRANCH_COLORS.uncategorized;
  if (depth == null || depth <= 0) return base;
  const d = Math.min(depth, DEPTH_OPACITY.length - 1);
  const opacity = DEPTH_OPACITY[d];
  return {
    ...base,
    edge:
      base.edge +
      Math.round(opacity * 255)
        .toString(16)
        .padStart(2, '0'),
  };
}

const SEMANTIC_ACCENT_RULES: Array<{ match: string[]; color: string }> = [
  { match: ['risk', 'threat', 'blocker', 'issue'], color: '#f43f5e' },
  { match: ['opportunity', 'growth', 'upside'], color: '#10b981' },
  { match: ['decision', 'choice', 'tradeoff'], color: '#6366f1' },
  { match: ['action', 'task', 'next-step', 'plan'], color: '#22c55e' },
  { match: ['hypothesis', 'assumption', 'idea'], color: '#f59e0b' },
  { match: ['evidence', 'fact', 'proof', 'signal'], color: '#0ea5e9' },
  { match: ['customer', 'user', 'persona'], color: '#ec4899' },
];

function withAlpha(color: string, alphaHex: string) {
  if (!/^#([0-9a-f]{6})$/i.test(color)) return color;
  return `${color}${alphaHex}`;
}

function inferNodeAccentColor(data: Record<string, any> | undefined): string | undefined {
  if (!data) return undefined;
  if (typeof data.color === 'string' && data.color.trim()) return data.color.trim();
  const semanticTokens = [
    typeof data.semanticType === 'string' ? data.semanticType : '',
    ...(Array.isArray(data.tags) ? data.tags : []),
  ]
    .map((value) =>
      String(value || '')
        .trim()
        .toLowerCase()
    )
    .filter(Boolean);

  for (const token of semanticTokens) {
    const rule = SEMANTIC_ACCENT_RULES.find((entry) =>
      entry.match.some((keyword) => token.includes(keyword))
    );
    if (rule) return rule.color;
  }
  return undefined;
}

/**
 * PUŁAPKA nr 1 z audytu paska edycji, rozwiązana tutaj.
 *
 * Ramka na mapie (`type: 'group'`) NIE rysuje swojego pudełka w komponencie —
 * kreskowaną obwódkę, tło i promień nakłada reactflow z `node.style` na wrapper
 * węzła. Patch wysłany na `node.data` (czyli tam, gdzie pisze pasek dla
 * wszystkich pozostałych typów) do niej po prostu NIE dolatuje i użytkownik
 * widzi „kliknąłem kolor, nic się nie stało".
 *
 * Ta funkcja przepisuje kolor tła i kolor ramki z patcha `data` na `node.style`
 * WYŁĄCZNIE dla węzłów typu `group`; dla reszty zwraca węzeł bez zmian
 * (referencyjnie ten sam obiekt, więc React nie przerysowuje niczego zbędnie).
 * `null` z palety = „skasuj mój wybór" i przywraca wartość domyślną.
 */
function applyFrameStyleToNode(node: Node, patch: Record<string, any>): Node {
  if (node.type !== 'group') return node;
  if (patch.bgColor === undefined && patch.borderColor === undefined) return node;
  const style: Record<string, any> = { ...(node.style || {}) };
  if (patch.bgColor !== undefined) {
    style.backgroundColor = patch.bgColor
      ? `color-mix(in srgb, ${patch.bgColor} 14%, transparent)`
      : undefined;
  }
  if (patch.borderColor !== undefined) {
    style.borderColor = patch.borderColor || undefined;
  }
  return { ...node, style };
}

// ─────── Node Types ───────

/**
 * Blokada całego płótna (tryb read-only / obserwator). Węzły muszą ją znać,
 * żeby NIE pokazywać uchwytów zmiany rozmiaru — `nodesDraggable={false}`
 * blokuje tylko przeciąganie, `NodeResizer` żyje własnym życiem.
 */
const MindMapLockedContext = React.createContext<boolean>(false);

const CenterNodeComponent: React.FC<NodeProps> = React.memo(({ data, selected, id }) => {
  const mapLocked = useContext(MindMapLockedContext);
  const hasExplicitSize = useNodeHasExplicitSize(id);
  // Clean, consulting-grade root node (Whimsical-style): solid neutral surface on
  // c-* tokens, no glowing gradient orb / pulsing glow / rotating conic border
  // (those read as a toy, not a work tool). Emphasis via a slightly stronger ring
  // + shadow, not animation.
  // Pasek edycji obiektu: korzeń też musi słuchać tła/ramki/typografii —
  // inaczej „zmieniam kolor, nic się nie dzieje" dla najważniejszego węzła mapy.
  const rootStyle = readCanvasObjectStyle(data);
  const rootSurface = canvasObjectSurfaceStyle(rootStyle, { bgOpacityPct: 22 });
  const rootText = canvasObjectTextStyle(rootStyle);
  return (
    <>
      {/* Ręczna zmiana rozmiaru — korzeń jest KOŁEM, więc trzymamy proporcję. */}
      <MindMapNodeResizer
        selected={selected}
        locked={mapLocked || Boolean(data?.locked)}
        minWidth={96}
        minHeight={96}
        keepAspectRatio
      />
      <div
        style={rootSurface}
        className={`relative flex items-center justify-center ${
          hasExplicitSize ? 'w-full h-full' : 'w-32 h-32'
        } rounded-full bg-c-surface-raised border-2 shadow-lg transition-transform duration-200 hover:scale-105 ${
          selected ? 'border-c-focus' : 'border-c-border'
        }`}
      >
        <Handle type="source" position={Position.Top} id="top" className="!opacity-0 !w-1 !h-1" />
        <Handle
          type="source"
          position={Position.Right}
          id="right"
          className="!opacity-0 !w-1 !h-1"
        />
        <Handle
          type="source"
          position={Position.Bottom}
          id="bottom"
          className="!opacity-0 !w-1 !h-1"
        />
        <Handle type="source" position={Position.Left} id="left" className="!opacity-0 !w-1 !h-1" />
        <div className="text-center px-3">
          <Flower2 size={30} className="text-c-text-secondary mx-auto" />
          <div
            style={rootText}
            className="text-[11px] font-semibold text-c-text mt-1.5 line-clamp-2"
          >
            {data.label}
          </div>
        </div>
        {selected && (
          <button
            type="button"
            className="nodrag absolute left-full top-1/2 z-20 ml-3 -translate-y-1/2 h-10 w-10 rounded-full bg-c-surface-raised text-c-text border-2 border-c-border shadow-lg hover:bg-c-surface active:scale-[0.98] transition-all flex items-center justify-center"
            onClick={(e) => {
              e.stopPropagation();
              window.dispatchEvent(
                new CustomEvent('idea-mindmap-node-quick-action', {
                  detail: { action: 'add_child', nodeId: id },
                })
              );
            }}
          >
            <Plus size={20} strokeWidth={2.5} />
          </button>
        )}
      </div>
    </>
  );
});
CenterNodeComponent.displayName = 'RecommendationCenterNode';

const BranchNodeComponent: React.FC<NodeProps> = React.memo(({ data, selected, id }) => {
  const { t } = useTranslation();
  const { getNodes, getEdges } = useReactFlow();
  const colors = useMemo(
    () => branchColor(data.branchKey, data._depth),
    [data.branchKey, data._depth]
  );
  const collapsed = data._collapsed;
  const childCount = data.count || 0;
  const rfNodes = getNodes();
  const rfEdges = getEdges();
  const nodeCount = rfNodes.length;
  const edgeCount = rfEdges.length;
  const health = useMemo(
    () => computeBranchHealth(id, rfNodes, rfEdges),
    [id, nodeCount, edgeCount]
  );
  const mapLocked = useContext(MindMapLockedContext);
  const hasExplicitSize = useNodeHasExplicitSize(id);
  // Pasek edycji obiektu — gałąź czyta ten sam kontrakt co węzeł-idea.
  const branchStyle = readCanvasObjectStyle(data);
  const branchSurface = canvasObjectSurfaceStyle(branchStyle, { bgOpacityPct: 20 });
  const branchText = canvasObjectTextStyle(branchStyle);

  if (data._simplified) {
    return (
      <div
        className={`px-3 py-1.5 rounded-xl border ${colors.border} ${colors.bg} text-center min-w-[100px]`}
      >
        <Handle type="target" position={Position.Left} className="!opacity-0 !w-1 !h-1" />
        <Handle
          type="source"
          position={Position.Right}
          id="right"
          className="!opacity-0 !w-1 !h-1"
        />
        <div className={`text-xs font-semibold ${colors.text}`}>{data.label}</div>
        <div className="text-[10px] text-slate-600 dark:text-c-text-muted">{childCount} nodes</div>
      </div>
    );
  }

  return (
    <div
      style={branchSurface}
      className={`relative px-4 py-2.5 rounded-2xl border-2 ${colors.border} ${colors.bg} ${
        selected ? `ring-2 ${colors.ring}` : ''
      } shadow-md text-center ${
        // Ręcznie ustawiony rozmiar jest TWARDY — pudełko przestaje się
        // dopasowywać do treści i wypełnia węzeł.
        hasExplicitSize ? 'w-full h-full flex flex-col justify-center' : 'min-w-[120px]'
      }`}
    >
      {/* Ręczna zmiana rozmiaru gałęzi (uchwyty tylko przy zaznaczeniu).
          Wewnątrz pudełka, bo to ono jest pudełkiem węzła (`relative`) —
          uchwyty siadają dokładnie na jego krawędziach. */}
      <MindMapNodeResizer
        selected={selected}
        locked={mapLocked || Boolean(data?.locked)}
        minWidth={MM_MIN_NODE_WIDTH}
        minHeight={MM_MIN_NODE_HEIGHT}
      />
      <Handle type="target" position={Position.Left} className="!opacity-0 !w-1 !h-1" />
      <Handle type="source" position={Position.Right} id="right" className="!opacity-0 !w-1 !h-1" />
      <Handle type="source" position={Position.Top} id="top" className="!opacity-0 !w-1 !h-1" />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="!opacity-0 !w-1 !h-1"
      />
      <div className="absolute -top-1 -right-1 z-10">
        <BranchHealthDot score={health.score} />
      </div>
      {selected && (
        <button
          type="button"
          title={t('ideas.mindmap.addNodeTab', 'Add node (Tab)')}
          className="nodrag absolute -right-2 top-1/2 -translate-y-1/2 z-20 w-5 h-5 flex items-center justify-center rounded-full bg-c-text text-c-surface shadow-lg hover:opacity-90 active:scale-[0.98] transition-all"
          onClick={(e) => {
            e.stopPropagation();
            window.dispatchEvent(
              new CustomEvent('idea-mindmap-node-quick-action', {
                detail: { action: 'mm_add_child', nodeId: id },
              })
            );
          }}
        >
          <Plus size={12} strokeWidth={2.5} />
        </button>
      )}
      <div
        style={branchText}
        className={`text-xs font-semibold ${colors.text} flex items-center gap-1 justify-center`}
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
        <GitBranch size={12} />
        {data.label}
      </div>
      <div className="text-[10px] text-slate-600 dark:text-c-text-muted mt-0.5">
        {childCount} {childCount === 1 ? 'node' : 'nodes'}
        {collapsed ? ` (${collapsed ? '...' : ''})` : ''}
      </div>
      {selected && (
        <div className="nodrag absolute -bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1">
          <button
            type="button"
            className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-c-text text-c-surface text-[9px] font-medium shadow-lg hover:opacity-90 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              window.dispatchEvent(
                new CustomEvent('idea-mindmap-node-quick-action', {
                  detail: { action: 'mm_ai_expand_node', nodeId: id },
                })
              );
            }}
          >
            <Sparkles size={10} />
            <span>
              {childCount === 0
                ? t('ideas.mindmap.aiExpand', 'AI Expand')
                : t('ideas.mindmap.moreAi', 'More AI')}
            </span>
          </button>
          <button
            type="button"
            title={t('ideas.mindmap.summarizeBranch', 'Summarize branch')}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[9px] font-medium shadow-lg hover:bg-emerald-700 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              window.dispatchEvent(
                new CustomEvent('idea-mindmap-summarize-branch', {
                  detail: { nodeId: id, nodeLabel: data.label || '' },
                })
              );
            }}
          >
            <FileText size={10} />
            <span>{t('ideas.mindmap.summarize', 'Summarize')}</span>
          </button>
        </div>
      )}
    </div>
  );
});
BranchNodeComponent.displayName = 'RecommendationBranchNode';

const handleBase = '!w-2.5 !h-2.5 !border-2 transition-all duration-150';
const MINDMAP_NODE_QUICK_ACTION_EVENT = 'idea-mindmap-node-quick-action';
const MindMapInteractionModeContext = React.createContext<MindMapInteractionMode>('select');
const MindMapIdeaIdContext = React.createContext<string>('');

const EditableIdeaNodeComponent: React.FC<NodeProps> = React.memo(({ id, data, selected }) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language?.startsWith('pl');
  const interactionMode = useContext(MindMapInteractionModeContext);
  const ideaId = useContext(MindMapIdeaIdContext);
  const mapLocked = useContext(MindMapLockedContext);
  const hasExplicitSize = useNodeHasExplicitSize(id);
  const { getNodes, getEdges } = useReactFlow();
  const colors = useMemo(
    () => branchColor(data.branchKey, data._depth),
    [data.branchKey, data._depth]
  );
  const tagColor = useMemo(() => resolveTagColor(data.tags || []), [data.tags]);
  const isAI =
    data.sourceType === 'ai_chat' ||
    data.sourceType === 'ai_hint' ||
    data.sourceType === 'ai_suggestion';
  const isNew = data._isNew;
  const nodeStatus: NodeStatusType = data.status || 'idea';
  const p = data.priority ?? 50;
  const priorityColor = p >= 75 ? 'bg-emerald-400' : p >= 50 ? 'bg-amber-400' : 'bg-slate-400';
  const votes = data.votes ?? 0;
  const maturityScore =
    nodeStatus === 'converted'
      ? 100
      : nodeStatus === 'ready_to_convert'
        ? 80
        : nodeStatus === 'validated'
          ? 60
          : nodeStatus === 'exploring'
            ? 35
            : 10;

  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(data.label || ''));
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const suggestTimerRef = useRef<number | null>(null);
  const suggestCacheRef = useRef<Map<string, string[]>>(new Map());

  useEffect(() => {
    if (data._startEditing) {
      setEditValue(String(data.label || ''));
      setEditing(true);
    }
  }, [data._startEditing, data.label]);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [editing]);

  useEffect(() => {
    if (suggestTimerRef.current) {
      window.clearTimeout(suggestTimerRef.current);
      suggestTimerRef.current = null;
    }

    if (!editing || editValue.trim() !== '') {
      setSuggestions([]);
      setLoadingSuggestions(false);
      return;
    }

    const branchKey = data.branchKey as string | undefined;
    const cacheKey = branchKey || '__default__';

    const cached = suggestCacheRef.current.get(cacheKey);
    if (cached) {
      setSuggestions(cached);
      setLoadingSuggestions(false);
      return;
    }

    setLoadingSuggestions(true);

    const branchSuggestionsFallback: Record<string, string[]> = {
      causes: [
        'Market shift',
        'Process gap',
        'Resource constraint',
        'Customer feedback',
        'Competitor action',
      ],
      options: ['Quick win', 'Strategic pivot', 'Partnership', 'New feature', 'Cost reduction'],
      validation: [
        'A/B test',
        'User interview',
        'Data analysis',
        'Prototype test',
        'Expert review',
      ],
      risks: ['Timeline risk', 'Budget overrun', 'Skill gap', 'Dependency', 'Market change'],
      next: [
        'Research spike',
        'Stakeholder review',
        'Build prototype',
        'Run pilot',
        'Document findings',
      ],
    };
    const defaultsFallback = [
      'Key insight',
      'Open question',
      'Action item',
      'Evidence needed',
      'Hypothesis',
    ];

    let cancelled = false;

    suggestTimerRef.current = window.setTimeout(async () => {
      if (cancelled) return;

      const allEdges = getEdges();
      const parentEdge = allEdges.find((e: Edge) => e.target === id);
      const parentNode = parentEdge
        ? getNodes().find((n: Node) => n.id === parentEdge.source)
        : undefined;

      try {
        const res = await Api.getMyIdeaAISuggestions(ideaId, {
          seedText: parentNode?.data?.label || '',
          mapNodes: getNodes().map((n: Node) => ({ id: n.id, label: n.data?.label, type: n.type })),
          mapEdges: allEdges.map((e: Edge) => ({ source: e.source, target: e.target })),
          activeTool: 'mindmap',
          language: i18n.language,
          ...(branchKey ? { branchKey } : {}),
          ...(parentNode?.data?.label ? { parentLabel: parentNode.data.label } : {}),
        });
        if (cancelled) return;
        const texts = Array.isArray(res?.suggestions)
          ? res.suggestions.map((s: any) => String(s.text)).filter(Boolean)
          : [];
        if (texts.length > 0) {
          suggestCacheRef.current.set(cacheKey, texts);
          setSuggestions(texts);
        } else {
          const fallback =
            branchKey && branchSuggestionsFallback[branchKey]
              ? branchSuggestionsFallback[branchKey]
              : defaultsFallback;
          setSuggestions(fallback);
        }
      } catch {
        if (cancelled) return;
        const fallback =
          branchKey && branchSuggestionsFallback[branchKey]
            ? branchSuggestionsFallback[branchKey]
            : defaultsFallback;
        setSuggestions(fallback);
      }
      if (!cancelled) setLoadingSuggestions(false);
    }, 1500);

    return () => {
      cancelled = true;
      if (suggestTimerRef.current) {
        window.clearTimeout(suggestTimerRef.current);
        suggestTimerRef.current = null;
      }
    };
  }, [editing, editValue, data.branchKey, ideaId, id, getNodes, getEdges, i18n.language]);

  const confirmEdit = useCallback(() => {
    setEditing(false);
    const trimmed = editValue.trim();
    window.dispatchEvent(
      new CustomEvent('idea-mindmap-node-edit', {
        detail: { nodeId: id, label: trimmed, cancelled: false },
      })
    );
  }, [editValue, id]);

  const cancelEdit = useCallback(() => {
    setEditing(false);
    window.dispatchEvent(
      new CustomEvent('idea-mindmap-node-edit', {
        detail: { nodeId: id, label: data.label, cancelled: true },
      })
    );
  }, [data.label, id]);

  const labelRef = useRef(data.label);
  labelRef.current = data.label;
  // DP-3 (T7 Part B): a node locked by another collaborator cannot enter
  // inline edit mode — the drawer/inline text editor stays read-only until
  // the peer releases the lock.
  const isRemoteLocked = !!data._remoteLocked;
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isRemoteLocked) return;
      setEditValue(String(labelRef.current || ''));
      setEditing(true);
    },
    [isRemoteLocked]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        confirmEdit();
      }
      if (e.key === 'Escape') {
        cancelEdit();
      }
    },
    [cancelEdit, confirmEdit]
  );

  const shape = data.shape || 'default';
  const canAddSibling = id !== 'root' && !id.startsWith('branch-');
  const handleTarget = `${handleBase} ${
    interactionMode === 'connect'
      ? '!opacity-100 !bg-emerald-300 dark:!bg-emerald-600 !border-emerald-500 hover:!bg-emerald-400 hover:!scale-150'
      : '!opacity-0 !pointer-events-none'
  }`;
  const handleSource = `${handleBase} ${
    interactionMode === 'connect'
      ? '!opacity-100 !bg-amber-300 dark:!bg-amber-600 !border-amber-500 hover:!bg-amber-400 hover:!scale-150'
      : '!opacity-0 !pointer-events-none'
  }`;
  // Kształty: przy fladze paska edycji korzystamy ze WSPÓLNEJ mapy kształtów
  // (`canvasShapeClasses`) — ta sama paleta co w Tablicy i Procesie, z dwoma
  // kształtami więcej (prostokąt, pigułka), których stary cykl `ctx_change_shape`
  // w ogóle nie znał. Przy fladze OFF — dokładnie stare zachowanie.
  const canvasShape = canvasShapeClasses(shape);
  const useCanvasShape = isCanvasObjectEditBarEnabled();
  const shapeClass = useCanvasShape
    ? canvasShape.box
    : shape === 'circle'
      ? 'rounded-full aspect-square flex items-center justify-center'
      : shape === 'diamond'
        ? 'rotate-45'
        : shape === 'hexagon'
          ? '[clip-path:polygon(25%_0%,75%_0%,100%_50%,75%_100%,25%_100%,0%_50%)]'
          : 'rounded-xl';

  const innerRotate = useCanvasShape ? canvasShape.inner : shape === 'diamond' ? '-rotate-45' : '';

  // PASEK EDYCJI OBIEKTU — tu renderer CZYTA to, co pasek zapisuje. Krytyczne:
  // `bgColor` i `borderColor` są ODDZIELNE (stare `data.color` sterowało obiema
  // rzeczami naraz), a `fontSize`/`bold` były do tej pory MARTWE — etykieta
  // miała na sztywno `text-[11px] font-semibold` i nikt ich nie czytał.
  const objectStyle = readCanvasObjectStyle(data);
  const objectSurface = canvasObjectSurfaceStyle(objectStyle, { bgOpacityPct: 20 });
  const objectText = canvasObjectTextStyle(objectStyle);

  if (data._simplified) {
    return (
      <div
        className={`px-2 py-1 rounded-lg border ${colors.border} ${colors.bg} text-xs min-w-[80px] max-w-[180px]`}
      >
        <div className={`font-semibold ${colors.text} line-clamp-1`}>{data.label || '...'}</div>
        <Handle
          type="target"
          position={Position.Left}
          id="target-left"
          className="!opacity-0 !w-1 !h-1"
        />
        <Handle
          type="source"
          position={Position.Right}
          id="source-right"
          className="!opacity-0 !w-1 !h-1"
        />
      </div>
    );
  }

  const depth = getNodeDepth(data);
  const depthScale = depth <= 1 ? 1 : depth === 2 ? 0.95 : 0.9;
  const depthOpacity = depth <= 1 ? '' : depth === 2 ? 'opacity-90' : 'opacity-80';
  const accentColor = inferNodeAccentColor(data);
  const accentChipStyle = accentColor
    ? {
        backgroundColor: withAlpha(accentColor, '18'),
        borderColor: withAlpha(accentColor, '33'),
        color: accentColor,
      }
    : undefined;
  const nodeSurfaceStyle =
    depthScale < 1 || accentColor || objectSurface
      ? {
          ...(depthScale < 1 ? { transform: `scale(${depthScale})` } : {}),
          ...(accentColor
            ? {
                borderColor: accentColor,
                backgroundImage: `linear-gradient(180deg, ${withAlpha(accentColor, '18')} 0px, transparent 34px)`,
                boxShadow: selected
                  ? `0 0 0 2px ${withAlpha(accentColor, '33')}, 0 10px 24px -16px ${withAlpha(accentColor, 'aa')}`
                  : `0 10px 24px -18px ${withAlpha(accentColor, '99')}`,
              }
            : {}),
          // NA KOŃCU — jawny wybór właściciela w pasku bije akcent semantyczny
          // wyliczony z tagów. `backgroundImage: 'none'` z `objectSurface`
          // kasuje gradient akcentu, żeby wybrane tło było naprawdę widoczne.
          ...(objectSurface || {}),
        }
      : undefined;

  return (
    <GlowWrapper isNew={isNew} isAI={isAI}>
      <div
        onDoubleClick={handleDoubleClick}
        style={nodeSurfaceStyle}
        title={isRemoteLocked ? t('mindmap.thisNodeIsBeingEditedBy') : undefined}
        className={`group px-3 py-2 ${shapeClass} border-2 ${!accentColor && tagColor ? tagColor.borderClass : colors.border} ${!accentColor && tagColor ? tagColor.bgClass : colors.bg} ${depthOpacity} ${
          data._searchHit
            ? 'ring-offset-2 shadow-hig-focus animate-pulse'
            : data._dropTarget
              ? 'ring-3 ring-slate-400 ring-offset-2 border-slate-500 shadow-lg shadow-slate-500/30'
              : data._justMoved
                ? 'ring-2 ring-emerald-400 animate-pulse'
                : selected
                  ? `ring-2 ${colors.ring}`
                  : ''
        } ${isRemoteLocked ? 'opacity-50 grayscale cursor-not-allowed' : 'cursor-pointer'} ${
          // Ręcznie ustawiony rozmiar jest TWARDY: pudełko wypełnia węzeł i
          // przestaje się dopasowywać do treści (min-w/max-w by je ścisnęły).
          hasExplicitSize ? 'w-full h-full flex flex-col' : 'min-w-[120px] max-w-[210px]'
        } relative transition-colors duration-150`}
      >
        {/* Ręczna zmiana rozmiaru węzła (uchwyty tylko przy zaznaczeniu).
            Wewnątrz pudełka węzła, bo to ono jest `relative` — uchwyty siadają
            dokładnie na jego krawędziach, niezależnie od GlowWrappera. */}
        <MindMapNodeResizer
          selected={selected}
          locked={mapLocked || isRemoteLocked || Boolean(data?.locked)}
          minWidth={MM_MIN_NODE_WIDTH}
          minHeight={MM_MIN_NODE_HEIGHT}
        />
        <Handle type="target" position={Position.Left} id="target-left" className={handleTarget} />
        <Handle type="target" position={Position.Top} id="target-top" className={handleTarget} />
        <Handle
          type="source"
          position={Position.Right}
          id="source-right"
          className={handleSource}
        />
        <Handle
          type="source"
          position={Position.Bottom}
          id="source-bottom"
          className={handleSource}
        />

        {selected && !editing && interactionMode === 'select' && (
          <>
            <button
              type="button"
              aria-label={t('mindmap.openNodeProperties')}
              title={t('mindmap.openNodeProperties')}
              onClick={(e) => {
                e.stopPropagation();
                window.dispatchEvent(
                  new CustomEvent(MINDMAP_NODE_QUICK_ACTION_EVENT, {
                    detail: { action: 'open_properties', nodeId: id },
                  })
                );
              }}
              className="absolute right-2 top-2 z-20 h-7 w-7 rounded-full border border-c-border bg-c-surface text-c-text-secondary hover:bg-c-surface-raised transition-colors flex items-center justify-center dark:text-c-text-muted"
            >
              <Pencil size={13} />
            </button>
          </>
        )}
        {selected && !editing && (
          <div className="nodrag absolute -right-3 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-1">
            <button
              type="button"
              title={t('mindmap.addChildTab')}
              className="w-6 h-6 flex items-center justify-center rounded-full bg-c-text text-c-surface hover:opacity-90 active:scale-[0.98] transition-all"
              onClick={(e) => {
                e.stopPropagation();
                window.dispatchEvent(
                  new CustomEvent(MINDMAP_NODE_QUICK_ACTION_EVENT, {
                    detail: { action: 'mm_add_child', nodeId: id },
                  })
                );
              }}
            >
              <Plus size={14} strokeWidth={2.5} />
            </button>
          </div>
        )}
        {selected && !editing && canAddSibling && (
          <div className="nodrag absolute -bottom-3 left-1/2 -translate-x-1/2 z-20">
            <button
              type="button"
              title={t('mindmap.addSiblingShiftEnter')}
              className="w-5 h-5 flex items-center justify-center rounded-full bg-c-text text-c-surface active:scale-[0.98] transition-all opacity-70 hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                window.dispatchEvent(
                  new CustomEvent(MINDMAP_NODE_QUICK_ACTION_EVENT, {
                    detail: { action: 'mm_add_sibling', nodeId: id },
                  })
                );
              }}
            >
              <Plus size={12} strokeWidth={2} />
            </button>
          </div>
        )}

        {/* Status dot */}
        {nodeStatus !== 'idea' && (
          <div className="absolute -top-1 -right-1">
            <StatusDot status={nodeStatus} size={8} />
          </div>
        )}

        {/* Artifact link badge */}
        {Array.isArray(data.artifactLinks) && data.artifactLinks.length > 0 && (
          <div
            className="absolute -bottom-1 -right-1 flex items-center gap-0.5 rounded-full bg-c-text text-c-surface px-1 py-0.5 shadow-sm cursor-pointer hover:opacity-90 transition-colors"
            title={data.artifactLinks
              .map((l: any) => l.label || l.title || `${l.artifactRef?.type || l.type}`)
              .join(', ')}
            onClick={(e) => {
              e.stopPropagation();
              if (data.artifactLinks.length === 1) {
                const first = data.artifactLinks[0];
                const artType = first?.artifactRef?.type || first?.type;
                const artId = first?.artifactRef?.id || first?.id;
                if (artType && artId) {
                  window.dispatchEvent(
                    new CustomEvent('mywork-open-item', {
                      detail: { type: artType, id: artId, name: first?.label || artType },
                    })
                  );
                }
              } else {
                window.dispatchEvent(
                  new CustomEvent('idea-mindmap-open-drawer', { detail: { nodeId: id } })
                );
              }
            }}
          >
            <Paperclip size={8} />
            <span className="text-[7px] font-bold leading-none">{data.artifactLinks.length}</span>
          </div>
        )}

        {/* MM-15: Converted indicator */}
        {nodeStatus === 'converted' && data._convertedTo && (
          <div
            className="absolute -bottom-1 -left-1 flex items-center gap-0.5 rounded-full bg-c-text text-c-surface px-1.5 py-0.5 text-[7px] font-bold shadow-sm"
            title={t('mindmap.convertedToTarget', { target: data._convertedTo })}
          >
            <ExternalLink size={8} />
            <span className="uppercase">{String(data._convertedTo).replace('_', ' ')}</span>
          </div>
        )}

        {/* Po ręcznym powiększeniu treść ma WYPEŁNIĆ pudełko (flex-1 + własny
            scroll), a nie zostać przyklejona do górnej krawędzi z pustką pod
            spodem. Bez jawnego rozmiaru — zero zmian względem stanu sprzed. */}
        <div className={`${innerRotate} ${hasExplicitSize ? 'flex-1 min-h-0 overflow-auto' : ''}`}>
          {/* Image thumbnail (R3.5) */}
          {data.imageUrl && !editing && (
            <div className="mb-1.5 -mx-1 -mt-1 rounded-lg overflow-hidden">
              <img
                src={data.imageUrl}
                alt=""
                className="w-full h-16 object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}

          {editing ? (
            <>
              <textarea
                ref={textareaRef}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={confirmEdit}
                onKeyDown={handleKeyDown}
                rows={2}
                className="w-full text-[11px] font-semibold text-slate-800 dark:text-slate-200 bg-transparent border-none outline-none resize-none p-0 leading-tight nodrag"
                placeholder={t('mindmap.type')}
              />
              {loadingSuggestions && suggestions.length === 0 && editValue.trim() === '' && (
                <div className="flex flex-wrap gap-1 mt-1 nodrag">
                  {[72, 56, 64].map((w, i) => (
                    <span
                      key={i}
                      className="inline-block h-[18px] rounded-full bg-c-surface-raised animate-pulse"
                      style={{ width: w }}
                    />
                  ))}
                </div>
              )}
              {suggestions.length > 0 && editValue.trim() === '' && (
                <div className="flex flex-wrap gap-1 mt-1 nodrag">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      className="text-[9px] px-2 py-0.5 rounded-full bg-c-surface-raised text-slate-700 dark:text-slate-200 hover:bg-state-hover transition-colors"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setEditValue(s);
                        setSuggestions([]);
                        textareaRef.current?.focus();
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex items-start gap-1.5">
                <div className="flex-shrink-0 mt-0.5">
                  {isAI ? (
                    <TeresaMark size={10} className="text-c-info" />
                  ) : (
                    <Lightbulb size={10} className="text-amber-500" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    // `objectText` (czcionka / wielkość / kolor / grubość /
                    // podkreślenie) MUSI iść inline: klasy `text-[11px]
                    // font-semibold` niżej są statyczne, więc bez tego pola
                    // paska pozostałyby martwe — dokładnie tak było do dziś.
                    style={objectText}
                    className={`text-[11px] font-semibold ${data.label ? colors.text : 'text-slate-600 dark:text-slate-500 italic'} ${
                      // Przy domyślnym (dopasowanym do treści) pudełku etykieta
                      // musi się urwać po 2 wierszach, bo inaczej węzeł rósłby
                      // w nieskończoność. Gdy użytkownik SAM nadał rozmiar,
                      // urywanie jest wbrew jego decyzji — tekst ma się zawinąć
                      // i wykorzystać miejsce, które właśnie zrobił.
                      hasExplicitSize ? 'whitespace-pre-wrap break-words' : 'line-clamp-2'
                    } leading-tight`}
                  >
                    {data.label || t('mindmap.clickToType')}
                  </div>
                  {data.nodeType && (
                    <div className="text-[9px] text-slate-600 dark:text-slate-500 mt-0.5 uppercase tracking-wide">
                      {String(data.nodeType).replace(/_/g, ' ')}
                    </div>
                  )}
                  {(data.semanticType || (Array.isArray(data.tags) && data.tags.length > 0)) && (
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      {data.semanticType && (
                        <span
                          className="rounded-full border px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300"
                          style={accentChipStyle}
                        >
                          {String(data.semanticType)}
                        </span>
                      )}
                      {Array.isArray(data.tags) &&
                        data.tags.slice(0, 2).map((tag: string) => (
                          <span
                            key={tag}
                            className="rounded-full border bg-c-surface-raised px-1.5 py-0.5 text-[8px] font-medium text-slate-500 dark:text-slate-400"
                            style={accentChipStyle}
                          >
                            #{tag}
                          </span>
                        ))}
                      {Array.isArray(data.tags) && data.tags.length > 2 && (
                        <span className="rounded-full bg-c-surface-raised px-1.5 py-0.5 text-[7px] font-bold text-slate-600 dark:text-slate-500">
                          +{data.tags.length - 2}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {/* Maturity ring */}
                {nodeStatus !== 'idea' && (
                  <div className="shrink-0">
                    <MaturityRing score={maturityScore} size={16} strokeWidth={2} />
                  </div>
                )}
              </div>
              {/* Collapse indicator */}
              {(data._collapsed || (data._childCount ?? 0) > 0) && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.dispatchEvent(
                      new CustomEvent('mm-toggle-collapse', { detail: { nodeId: id } })
                    );
                  }}
                  className="nodrag mt-0.5 flex items-center gap-0.5 text-slate-600 hover:bg-slate-100/80 dark:hover:bg-slate-700/50 rounded px-0.5 transition-colors"
                  title={data._collapsed ? t('mindmap.expand') : t('mindmap.collapse')}
                >
                  {data._collapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
                  {data._collapsed && (data._childCount ?? 0) > 0 && (
                    <span className="text-[9px] font-medium">{data._childCount}</span>
                  )}
                </button>
              )}
              {/* Depth context snippet */}
              {(data.context || data.goal) && (
                <div className="text-[9px] text-slate-600 dark:text-slate-500 mt-0.5 line-clamp-1 italic">
                  {data.goal ? `🎯 ${data.goal}` : data.context}
                </div>
              )}
              <div className="mt-1.5 flex items-center gap-1.5">
                <div className="w-8 h-0.5 rounded-full bg-c-surface-raised overflow-hidden">
                  <div
                    className={`h-full rounded-full ${priorityColor}`}
                    style={{ width: `${Math.max(10, p)}%` }}
                  />
                </div>
                {votes > 0 && <VoteStars votes={votes} compact disabled />}
                {data.assignee && (
                  <div
                    className="w-4 h-4 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center text-[7px] font-bold"
                    title={data.assignee}
                  >
                    {String(data.assignee).charAt(0).toUpperCase()}
                  </div>
                )}
                {/* Depth model indicators */}
                {data.notes && (
                  <StickyNote size={9} className="text-amber-400 dark:text-amber-500 shrink-0" />
                )}
                {data.riskNote && (
                  <AlertTriangle
                    size={9}
                    className="text-danger-400 dark:text-danger-500 shrink-0"
                  />
                )}
                {Array.isArray(data.evidenceLinks) && data.evidenceLinks.length > 0 && (
                  <span
                    className="inline-flex items-center gap-0.5 shrink-0"
                    title={`${data.evidenceLinks.length} ${t('mindmap.evidence')}`}
                  >
                    <Link2 size={8} className="text-blue-400 dark:text-blue-500" />
                    <span className="text-[7px] font-bold text-blue-400 dark:text-blue-500">
                      {data.evidenceLinks.length}
                    </span>
                  </span>
                )}
                {depth > 0 && (
                  // RISK-35 (S1-CONTRAST, 2026-08-12): dark:text-slate-500 measured
                  // 3.22:1 at depth 2 (this badge inherits the node's depth-based fade,
                  // `depthOpacity` above — opacity-90 at depth 2, opacity-80 at depth
                  // 3+) against the 4.5:1 WCAG 1.4.3 text bar. text-c-text-secondary
                  // cleared it in both themes AT DEPTH 2 (8.92:1 dark / 5.60:1 light —
                  // see docs/qa/ideas-complete-transformation-2026-08-09/21_FOCUS_AND_CONTRAST.md
                  // §8), but S1-CONTRAST only measured depth 2 and called depth 3+
                  // "hypothetical". S9-GATE4EVIDENCE (2026-08-12) built a real
                  // depth-3 node (dev-render/screens/mindmap-canvas.tsx,
                  // idea-scope-1-detail) and measured it: at opacity-80 (depth 3+),
                  // text-c-text-secondary composites to 4.41:1 in LIGHT theme — a
                  // real, reachable sub-4.5 failure (dark stays fine at 7.22:1,
                  // min-opacity for text-c-text-secondary to clear 4.5:1 is 0.8096,
                  // i.e. the depth-3 fade of 0.8 misses by less than 0.01 alpha).
                  //
                  // Fix: text-c-text (the strong-text token, NEVER the tailwind
                  // "primary" family — every shade of that is crimson) instead
                  // of text-c-text-secondary. Three options were
                  // weighed: (1) exempt the badge from depthOpacity entirely —
                  // rejected, it would need moving the badge outside the node's
                  // opacity stacking context (portal/absolute overlay), a much
                  // bigger structural change for a 1-line contrast fix; (2) raise
                  // the depth-3 opacity value itself — rejected, that refades the
                  // WHOLE node (border+bg+every child), not just this label, losing
                  // the depth-hierarchy visual the opacity ladder exists for;
                  // (3) THIS: strengthen only the badge's own color token. Clears
                  // with margin at every depth in both themes (light: 9.32:1 at
                  // depth3 / 13.01:1 at depth2; dark: 11.48:1 at depth3 / 14.43:1 at
                  // depth2 — computed via scripts/contrast-ratio.mjs), so it never
                  // regresses if the opacity ladder changes again later.
                  <div className="text-[8px] text-c-text ml-auto" title={`Depth ${depth}`}>
                    L{depth}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </GlowWrapper>
  );
});
EditableIdeaNodeComponent.displayName = 'EditableRecommendationIdeaNode';

const nodeTypes = {
  center: CenterNodeComponent,
  branch: BranchNodeComponent,
  idea: EditableIdeaNodeComponent,
  // Ramka (`mm_add_frame`, Ctrl+G). Wcześniej BRAK wpisu → reactflow rysował
  // wbudowany węzeł `group`: goły prostokąt bez etykiety i bez uchwytów.
  group: MindMapFrameNode,
  ...knowledgeNodeTypes,
};

const edgeTypes = {
  labeled: LabeledEdge,
  gradient: GradientEdge,
};

type IdeaRecommendationMapProps = {
  ideaId: string;
  ideaTitle: string;
  onClose: () => void;
  onCenterEdit?: () => void;
  preferredTool?: CanvasToolType;
  extensions?: Record<string, unknown>;
  onPreferredToolLoaded?: (tool: CanvasToolType | null) => void;
  variant?: 'overlay' | 'embedded';
  showClose?: boolean;
  className?: string;
  locked?: boolean;
  onSelectionChange?: (sel: import('./ideaSelectionTypes').IdeaWorkspaceSelection) => void;
  onViewportReport?: (viewport: { x: number; y: number; zoom: number }) => void;
  focusMode?: 'system' | 'object' | null;
  focusObjectId?: string | null;
  /** When provided, fullscreen toggles the parent workspace (canvas + right panels) */
  onFullscreenToggle?: () => void;
  isFullscreen?: boolean;
  /** Pinned card integration — stage, summary, actions */
  stage?: string;
  seedText?: string;
  onEditCard?: () => void;
  onAISummarize?: () => void;
  onStageChange?: (newStage: IdeaStageV5) => void;
  graphNodeCount?: number;
  evidenceCount?: number;
  /** Open AI chat with optional prompt */
  onOpenChat?: (prompt?: string) => void;
  interactionMode?: MindMapInteractionMode;
  onInteractionModeChange?: (mode: MindMapInteractionMode) => void;
  /**
   * B2 (2026-07-27): bump = „graf zostal podmieniony z ZEWNATRZ" (szablon z
   * galerii, retry po bledzie narzedzia). Parytet z IdeaTableTool /
   * IdeaProcessFlowTool / IdeaWhiteboardTool, ktore ten prop mialy od dawna —
   * Mind Map byl jedynym narzedziem bez tego sygnalu, wiec po zastosowaniu
   * szablonu kanwa zostawala stara.
   */
  refreshToken?: number;
  externalRuntime?: {
    version: number;
    loading: boolean;
    /** D2: non-null when the last GET /map attempt failed. See useMindMapPersistence. */
    loadError?: string | null;
    saving: boolean;
    lastSavedAt: number | null;
    syncState: 'idle' | 'queued' | 'saving' | 'saved' | 'offline' | 'conflict';
    nodes: Node[];
    edges: Edge[];
    extensions: Record<string, unknown>;
    captureGraph: (
      graph: { nodes: Node[]; edges: Edge[]; extensions?: Record<string, unknown> },
      opts?: { reason?: 'draft' | 'manual' | 'semantic' | 'ai'; immediate?: boolean }
    ) => void;
    flushGraph: (opts?: {
      reason?: 'draft' | 'manual' | 'semantic' | 'ai';
      createSnapshot?: boolean;
      snapshotLabel?: string;
    }) => Promise<unknown>;
    refresh: () => Promise<void>;
  };
};

// ─────── Undo/Redo for map state ───────
type MapSnapshot = { nodes: Node[]; edges: Edge[]; collapsedNodeIds?: Set<string> };

function MindMapInner({
  ideaId,
  ideaTitle,
  onClose,
  onCenterEdit,
  preferredTool,
  extensions,
  onPreferredToolLoaded,
  variant = 'overlay',
  showClose = true,
  className,
  locked = false,
  onSelectionChange,
  onViewportReport,
  focusMode,
  focusObjectId,
  onFullscreenToggle,
  isFullscreen = false,
  stage,
  seedText,
  onEditCard,
  onAISummarize,
  onStageChange,
  graphNodeCount = 0,
  evidenceCount = 0,
  onOpenChat,
  interactionMode: externalInteractionMode = 'select',
  onInteractionModeChange,
  refreshToken,
  externalRuntime,
}: IdeaRecommendationMapProps) {
  const { t, i18n } = useTranslation();
  const currentUser = useAppStore((state) => state.currentUser);
  const isPolish = useMemo(() => i18n.language?.startsWith('pl'), [i18n.language]);
  const isDarkMindmap = useIsDark();
  const { dialog: subtreeDeleteDialog, confirm: confirmSubtreeDelete } = useConfirmDialog();
  const debugEnabled = false;
  const {
    fitView: fitViewSurowy,
    getViewport,
    setViewport,
    getIntersectingNodes,
    screenToFlowPosition,
  } = useReactFlow();

  /**
   * ★ IDE-026 — SUFIT PRZYBLIŻENIA (zgłoszenie właściciela, TRZECI raz:
   * „wcisnąłem element i nagle mi się przybliżył. Wyłączmy przybliżenia
   * automatyczne").
   *
   * W tym pliku i w `useMindMapNodes` jest DWADZIEŚCIA KILKA wywołań `fitView`
   * (dodanie węzła, skasowanie, wklejenie, drill-down, nawigacja, okruszki…).
   * Łatanie ich po jednym już raz zawiodło — przy kolejnej funkcji ktoś dopisze
   * dwudzieste piąte bez sufitu. Dlatego sufit wisi w JEDNYM miejscu: na wejściu.
   *
   * ZASADA: kadrowanie automatyczne może ODDALIĆ (żeby coś zmieścić), ale NIGDY
   * nie przybliża — sufit to bieżący zoom. Widok się przesuwa, skala stoi.
   * Wyjątek: polecenia JAWNE użytkownika („Dopasuj widok", Auto-układ, pierwsze
   * otwarcie) przekazują `jawne: true` i mają pełną swobodę.
   *
   * Bez sufitu ReactFlow liczy zoom jako „zmieść ten prostokąt w oknie" i obcina
   * dopiero o własne `maxZoom` (2.0), więc kadr na jednym małym węźle skakał
   * z ~45% na 200%.
   */
  const fitView = useCallback(
    (opts?: Record<string, any>) => {
      const { jawne, ...reszta } = opts || {};
      if (jawne) return fitViewSurowy(reszta as any);
      let sufit = 1;
      try {
        const z = getViewport?.()?.zoom;
        if (Number.isFinite(z) && (z as number) > 0) sufit = z as number;
      } catch {
        /* płótno w trakcie demontażu — zostaw sufit 1 (nigdy nie przybliża) */
      }
      // Jeśli wołający sam podał maxZoom, bierzemy OSTROŻNIEJSZY z dwóch.
      const podany = Number(reszta.maxZoom);
      const maxZoom = Number.isFinite(podany) && podany > 0 ? Math.min(podany, sufit) : sufit;
      return fitViewSurowy({ ...reszta, maxZoom } as any);
    },
    [fitViewSurowy, getViewport]
  );
  // True once ReactFlow has measured every node — the only reliable signal that
  // fitView can compute real bounds (firing it earlier silently no-ops).
  const nodesInitialized = useNodesInitialized();
  const { autoLayout, partialLayoutSubtree } = useAutoLayout();
  const { exportAsPNG, exportAsSVG, exportAsJSON, exportAsMarkdown } = useMapExport();
  const { exportAsPdf } = useMapExportPdf();
  const interactionMode = externalInteractionMode;
  const [simplifiedMode, setSimplifiedMode] = useState(false);
  const reactFlowNodeTypes = useRef(nodeTypes).current;
  const reactFlowEdgeTypes = useMemo(() => (simplifiedMode ? {} : edgeTypes), [simplifiedMode]);
  const reactFlowFitViewOptions = useMemo(() => ({ padding: 0.3 }), []);
  const reactFlowProOptions = useMemo(() => ({ hideAttribution: true }), []);
  const reactFlowDefaultEdgeOptions = useMemo(
    () =>
      simplifiedMode
        ? {
            type: 'default',
            style: { stroke: 'var(--c-tag-2)', strokeWidth: 1.5, opacity: 0.5 },
            animated: false,
          }
        : {
            type: 'gradient',
            style: { stroke: 'var(--c-tag-2)', strokeWidth: 2, opacity: 0.7 },
            animated: true,
            data: { animated: true, showParticles: true },
          },
    [simplifiedMode]
  );
  const updateInteractionMode = useCallback(
    (mode: MindMapInteractionMode) => {
      onInteractionModeChange?.(mode);
    },
    [onInteractionModeChange]
  );

  // ── Debug logger: live event stream + silent-interaction detector ─────────
  const debugEntriesRef = useRef<DebugEntry[]>([]);
  const pendingInteractionsRef = useRef<Map<string, PendingInteraction>>(new Map());
  const debugPausedRef = useRef(false);
  const lastInputSummaryRef = useRef('none');
  const lastHandlerSummaryRef = useRef('none');
  const [debugTick, setDebugTick] = useState(0);
  const [debugPaused, setDebugPaused] = useState(false);
  const [debugOverlayExpanded, setDebugOverlayExpanded] = useState(true);

  useEffect(() => {
    debugPausedRef.current = debugPaused;
  }, [debugPaused]);

  const persistDebugEntries = useCallback(() => {
    if (!debugEnabled) return;
    try {
      sessionStorage.setItem(DEBUG_SESSION_KEY, JSON.stringify(debugEntriesRef.current));
    } catch {
      /* ignore */
    }
  }, [debugEnabled]);

  const appendDebugEntry = useCallback(
    (
      message: string,
      meta?: Partial<Pick<DebugEntry, 'source' | 'detail' | 'reaction' | 'severity'>>
    ) => {
      if (!debugEnabled) return;
      const ts = new Date().toLocaleTimeString('en-GB', {
        hour12: false,
        fractionalSecondDigits: 3,
      });
      const severity =
        meta?.severity ||
        (message.includes('ERROR') || message.includes('REJECTION')
          ? 'error'
          : message.includes('NO_REACTION')
            ? 'warn'
            : 'info');
      const entry: DebugEntry = {
        id: uid(),
        ts,
        source: meta?.source || 'handler',
        message,
        detail: meta?.detail,
        reaction: meta?.reaction,
        severity,
      };
      console.log(`%c[MM] ${message}`, 'color: #f59e0b; font-weight: bold', meta?.detail || '');
      debugEntriesRef.current = [...debugEntriesRef.current.slice(-(MAX_DEBUG_ENTRIES - 1)), entry];
      persistDebugEntries();
      if (!debugPausedRef.current) setDebugTick((t) => t + 1);
    },
    [debugEnabled, persistDebugEntries]
  );

  const debugLog = useCallback(
    (
      msg: string,
      meta?: Partial<Pick<DebugEntry, 'source' | 'detail' | 'reaction' | 'severity'>>
    ) => {
      appendDebugEntry(msg, meta);
    },
    [appendDebugEntry]
  );

  const trackInputEvent = useCallback(
    (
      kind: PendingInteraction['kind'] | 'pointerdown' | 'pointerup' | 'keydown',
      target: EventTarget | null,
      detail?: string
    ) => {
      const targetLabel = describeDebugTarget(target);
      if (targetLabel === 'debug-overlay') return;
      lastInputSummaryRef.current = `${kind} -> ${targetLabel}`;
      debugLog(`INPUT ${kind}`, {
        source: kind === 'keydown' ? 'keyboard' : 'input',
        detail: [targetLabel, detail].filter(Boolean).join(' | '),
      });
      if (kind === 'click' || kind === 'dblclick' || kind === 'contextmenu') {
        const key = `${kind}:${targetLabel}`;
        const previous = pendingInteractionsRef.current.get(key);
        if (previous) window.clearTimeout(previous.timeoutId);
        const timeoutId = window.setTimeout(() => {
          const pending = pendingInteractionsRef.current.get(key);
          if (!pending) return;
          pendingInteractionsRef.current.delete(key);
          debugLog(`NO_REACTION ${kind}`, {
            source: 'warning',
            reaction: 'silent',
            severity: 'warn',
            detail: targetLabel,
          });
        }, 260);
        pendingInteractionsRef.current.set(key, {
          kind,
          target: targetLabel,
          createdAt: Date.now(),
          timeoutId,
        });
      }
    },
    [debugLog]
  );

  const markInputHandled = useCallback(
    (
      kind: PendingInteraction['kind'],
      target: EventTarget | null,
      handlerName: string,
      detail?: string,
      reaction: DebugReaction = 'handled'
    ) => {
      const targetLabel = describeDebugTarget(target);
      const candidates = Array.from(pendingInteractionsRef.current.entries()).filter(
        ([, pending]) =>
          pending.kind === kind &&
          Date.now() - pending.createdAt < 1200 &&
          (pending.target === targetLabel ||
            targetLabel.includes(pending.target) ||
            pending.target.includes(targetLabel))
      );
      for (const [key, pending] of candidates) {
        window.clearTimeout(pending.timeoutId);
        pendingInteractionsRef.current.delete(key);
      }
      lastHandlerSummaryRef.current = `${handlerName} -> ${targetLabel}`;
      debugLog(handlerName, {
        source: 'handler',
        reaction,
        severity: reaction === 'blocked' ? 'warn' : 'info',
        detail: [targetLabel, detail].filter(Boolean).join(' | '),
      });
    },
    [debugLog]
  );

  useEffect(() => {
    if (!debugEnabled) return;
    let hadPreviousLogs = false;
    try {
      const prev =
        sessionStorage.getItem(DEBUG_SESSION_KEY) ||
        sessionStorage.getItem(LEGACY_DEBUG_SESSION_KEY);
      if (prev) {
        const parsed = normalizeLegacyDebugEntries(JSON.parse(prev));
        if (parsed.length > 0) {
          hadPreviousLogs = true;
          debugEntriesRef.current = [
            ...parsed.slice(-(MAX_DEBUG_ENTRIES - 1)),
            {
              id: uid(),
              ts: new Date().toLocaleTimeString('en-GB', {
                hour12: false,
                fractionalSecondDigits: 3,
              }),
              source: 'lifecycle',
              message: 'REAL_PAGE_RELOAD',
              detail: 'Recover previous debug session',
              severity: 'warn',
            },
          ];
        }
      }
    } catch {
      /* */
    }
    persistDebugEntries();
    debugLog(
      `${hadPreviousLogs ? 'REACT_REMOUNT' : 'REACT_MOUNT'} ideaId=${ideaId} locked=${locked}`,
      {
        source: 'lifecycle',
      }
    );

    const errorHandler = (e: ErrorEvent) => {
      debugLog(`ERROR: ${e.message} at ${e.filename}:${e.lineno}`, {
        source: 'error',
        severity: 'error',
      });
    };
    const rejectionHandler = (e: PromiseRejectionEvent) => {
      debugLog(`UNHANDLED REJECTION: ${String(e.reason).slice(0, 200)}`, {
        source: 'error',
        severity: 'error',
      });
    };
    const beforeUnload = () => {
      debugLog('REAL_PAGE_RELOAD beforeunload', { source: 'lifecycle', severity: 'warn' });
      persistDebugEntries();
      try {
        const vp = getViewport();
        localStorage.setItem(`mm-viewport-${ideaId}`, JSON.stringify(vp));
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('error', errorHandler);
    window.addEventListener('unhandledrejection', rejectionHandler);
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      for (const pending of pendingInteractionsRef.current.values()) {
        window.clearTimeout(pending.timeoutId);
      }
      pendingInteractionsRef.current.clear();
      debugLog('REACT_UNMOUNT', { source: 'lifecycle' });
      persistDebugEntries();
      try {
        const vp = getViewport();
        localStorage.setItem(`mm-viewport-${ideaId}`, JSON.stringify(vp));
      } catch {
        /* ignore */
      }
      window.removeEventListener('error', errorHandler);
      window.removeEventListener('unhandledrejection', rejectionHandler);
      window.removeEventListener('beforeunload', beforeUnload);
    };
  }, [debugEnabled, debugLog, ideaId, locked, persistDebugEntries]);

  const debugEntries = useMemo(() => debugEntriesRef.current.slice(-140).reverse(), [debugTick]);
  const debugStats = useMemo(() => {
    const all = debugEntriesRef.current;
    return {
      total: all.length,
      errors: all.filter((entry) => entry.severity === 'error').length,
      warnings: all.filter((entry) => entry.severity === 'warn').length,
      silent: all.filter((entry) => entry.reaction === 'silent').length,
      blocked: all.filter((entry) => entry.reaction === 'blocked').length,
      inputs: all.filter((entry) => entry.source === 'input' || entry.source === 'keyboard').length,
      handlers: all.filter((entry) => entry.source === 'handler').length,
      customs: all.filter((entry) => entry.source === 'custom').length,
    };
  }, [debugTick]);

  const [showMiniMap, setShowMiniMap] = useState(false);
  // M06 Fala 3.1: snap-to-grid toggle (local, default OFF even when the flag is
  // ON). 16px grid matches the mind-map spacing rhythm.
  const [snapEnabled, setSnapEnabled] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const pointerHandler = (event: PointerEvent) => {
      trackInputEvent(
        event.type as 'pointerdown' | 'pointerup',
        event.target,
        `button=${event.button} x=${Math.round(event.clientX)} y=${Math.round(event.clientY)}`
      );
    };

    const clickHandler = (event: MouseEvent) => {
      trackInputEvent(
        event.type as 'click' | 'dblclick' | 'contextmenu',
        event.target,
        `button=${event.button} x=${Math.round(event.clientX)} y=${Math.round(event.clientY)}`
      );
    };

    container.addEventListener('pointerdown', pointerHandler, true);
    container.addEventListener('pointerup', pointerHandler, true);
    container.addEventListener('click', clickHandler, true);
    container.addEventListener('dblclick', clickHandler, true);
    container.addEventListener('contextmenu', clickHandler, true);

    return () => {
      container.removeEventListener('pointerdown', pointerHandler, true);
      container.removeEventListener('pointerup', pointerHandler, true);
      container.removeEventListener('click', clickHandler, true);
      container.removeEventListener('dblclick', clickHandler, true);
      container.removeEventListener('contextmenu', clickHandler, true);
    };
  }, [trackInputEvent]);

  const [nodes, setNodes, baseOnNodesChange] = useNodesState([] as Node[]) as [
    Node[],
    React.Dispatch<React.SetStateAction<Node[]>>,
    (changes: unknown) => void,
  ];
  const [edges, setEdges, baseOnEdgesChange] = useEdgesState([] as Edge[]) as [
    Edge[],
    React.Dispatch<React.SetStateAction<Edge[]>>,
    (changes: import('reactflow').EdgeChange[]) => void,
  ];

  // Initial viewport: restore this idea's saved viewport, otherwise fit the whole
  // graph into view. Without this the canvas mounts at {x:0,y:0,zoom:1}, so a
  // freshly opened map renders clipped in the top-left corner (the center node
  // sits at flow-origin, branches fall behind the toolbar / off-screen). It also
  // makes reload restore the prior viewport — `mm-viewport-${ideaId}` was being
  // saved on unload but never read back. Runs once per idea, after nodes arrive.
  const didInitialFitRef = useRef<string | null>(null);
  useEffect(() => {
    if (!nodesInitialized || nodes.length === 0) return;
    if (didInitialFitRef.current === ideaId) return;
    didInitialFitRef.current = ideaId;
    let saved: { x: number; y: number; zoom: number } | null = null;
    try {
      const raw = localStorage.getItem(`mm-viewport-${ideaId}`);
      if (raw) {
        const vp = JSON.parse(raw);
        if (
          vp &&
          Number.isFinite(vp.x) &&
          Number.isFinite(vp.y) &&
          Number.isFinite(vp.zoom) &&
          vp.zoom > 0
        ) {
          saved = vp;
        }
      }
    } catch {
      /* ignore malformed saved viewport */
    }
    try {
      if (saved) {
        setViewport(saved, { duration: 0 });
      } else {
        fitView({ padding: 0.3, duration: 0, jawne: true });
      }
    } catch {
      /* fitView throws if the canvas is mid-teardown — safe to ignore */
    }
    // Give the surface keyboard focus on first load so the documented grammar
    // ("Select a branch and press Tab to add the first node") works immediately —
    // ReactFlow nodes are not focusable, so without this the canvas opens with
    // focus on <body> and the first Tab/Enter/arrow press does nothing until the
    // user happens to focus the surface. Don't steal focus from an open text field.
    if (!locked) {
      const ae = document.activeElement as HTMLElement | null;
      const typingElsewhere =
        ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable);
      if (!typingElsewhere) {
        try {
          containerRef.current?.focus({ preventScroll: true });
        } catch {
          /* not focusable yet — ignore */
        }
      }
    }
  }, [nodesInitialized, nodes.length, ideaId, fitView, setViewport, locked]);

  // ── Graph CRUD collaboration ──────────────────────────────────────────────
  // DP-3 (T6): shared useIdeaCollab (same hook as the whiteboard) applies
  // collaborators' graph_patch ops to the live canvas via functional
  // setNodes/setEdges — remote-apply without re-hydration or canvas remount.
  // DP-3 (T7 Part A): the mind map now also EMITS local mutations through the
  // same hook (previously only the whiteboard called broadcast* — the map
  // defined but never invoked these, so local edits never reached peers).
  // `broadcast*` internally no-ops while `applyingRemoteRef` is held, so
  // applying a remote patch never echoes back onto the wire.
  const {
    registerCollabSend,
    broadcastGraphPatch,
    broadcastNodeChanges,
    broadcastEdgeChanges,
    broadcastNodeUpdate,
    broadcastEdgeAdd,
  } = useIdeaCollab({
    ideaId,
    tool: 'mindmap',
    currentUserId: currentUser?.id || 'anonymous',
    setNodes,
    setEdges,
  });

  const updateNodeDataById = useCallback(
    (nodeId: string, updater: (data: any) => any) => {
      let nextData: any = null;
      setNodes((prev: Node[]) =>
        prev.map((n) => {
          if (n.id !== nodeId) return n;
          nextData = updater(n.data);
          return { ...n, data: nextData };
        })
      );
      // DP-3 (T7 Part A): broadcast style/priority/assignee/image/artifact
      // patches applied through the floating toolbar (shared setter).
      if (nextData) broadcastNodeUpdate({ id: nodeId, data: nextData } as any);
    },
    [broadcastNodeUpdate, setNodes]
  );

  // ── Collapse/Expand ──────────────────────────────────────────────────────
  const [collapsedNodeIds, setCollapsedNodeIds] = useState<Set<string>>(new Set());
  const [drillPath, setDrillPath] = useState<BreadcrumbItem[]>([]);
  const [remoteLockedNodeIds, setRemoteLockedNodeIds] = useState<Set<string>>(new Set());
  const drillFocusId = drillPath.length > 0 ? drillPath[drillPath.length - 1].nodeId : null;

  // M06 Fala 3.2: active search-result highlight (IdeaUnifiedSearch → this
  // node id). Purely a rendering flag (mirrors _dropTarget/_justMoved) — no
  // structural change, cleared after a short pulse so it doesn't linger.
  const [searchHitNodeId, setSearchHitNodeId] = useState<string | null>(null);

  // Apply collapse visibility + drill-down filtering
  const visibleNodes = useMemo(() => {
    const childrenOf = new Map<string, string[]>();
    for (const e of edges) {
      if ((e as any)?.data?.edgeRole === 'relation') continue;
      if (!childrenOf.has(e.source)) childrenOf.set(e.source, []);
      childrenOf.get(e.source)!.push(e.target);
    }

    // Drill-down: only show the focused node and its descendants
    let drillVisibleIds: Set<string> | null = null;
    if (drillFocusId) {
      drillVisibleIds = new Set<string>();
      drillVisibleIds.add(drillFocusId);
      function collectDescendants(parentId: string) {
        const children = childrenOf.get(parentId) || [];
        for (const cid of children) {
          drillVisibleIds!.add(cid);
          collectDescendants(cid);
        }
      }
      collectDescendants(drillFocusId);
    }

    // Collapse: hide descendants of collapsed nodes
    const hiddenIds = new Set<string>();
    function hideDescendants(parentId: string) {
      const children = childrenOf.get(parentId) || [];
      for (const cid of children) {
        if (cid === 'root' || cid.startsWith('branch-')) continue;
        hiddenIds.add(cid);
        hideDescendants(cid);
      }
    }
    for (const nid of collapsedNodeIds) hideDescendants(nid);

    return nodes.map((n) => {
      const hiddenByDrill = drillVisibleIds ? !drillVisibleIds.has(n.id) : false;
      const nextHidden = hiddenIds.has(n.id) || hiddenByDrill;
      const isCollapsed = collapsedNodeIds.has(n.id);
      const childCount = (childrenOf.get(n.id) || []).length;
      const dataChanged =
        Boolean(n.hidden) !== nextHidden ||
        Boolean(n.data?._collapsed) !== isCollapsed ||
        (n.data?._childCount ?? 0) !== childCount;
      if (!dataChanged) return n;
      return {
        ...n,
        hidden: nextHidden,
        data: { ...n.data, _collapsed: isCollapsed, _childCount: childCount },
      };
    });
  }, [collapsedNodeIds, drillFocusId, edges, nodes]);

  // Ostatni węzeł, dla którego pokazaliśmy dymek „zaznaczenie przeniesione".
  const selectionMovedNoticeRef = useRef<string | null>(null);
  useEffect(() => {
    const hiddenSelected = visibleNodes.filter((n) => n.hidden && n.selected);
    if (hiddenSelected.length === 0) {
      selectionMovedNoticeRef.current = null;
      return;
    }

    const targetId = hiddenSelected[0].id;
    let ancestorId: string | null = null;
    let currentId: string | null = targetId;
    while (currentId) {
      const parentEdge = edges.find((e) => e.target === currentId && isStructuralEdge(e));
      if (!parentEdge) break;
      currentId = parentEdge.source;
      const parentNode = visibleNodes.find((n) => n.id === currentId);
      if (parentNode && !parentNode.hidden) {
        ancestorId = currentId;
        break;
      }
    }

    setNodes((prev: Node[]) =>
      prev.map((n) => ({
        ...n,
        selected:
          n.id === ancestorId
            ? true
            : hiddenSelected.some((h) => h.id === n.id)
              ? false
              : n.selected,
      }))
    );

    // Komunikat TYLKO wtedy, gdy zaznaczenie faktycznie DOKĄDŚ powędrowało.
    // Bez `ancestorId` nic się nie „przeniosło" — zaznaczenie zostało po prostu
    // zdjęte (węzeł ukryty przez tryb skupienia/drążenia, nie przez zwinięcie
    // gałęzi), a dymek kłamał i wyskakiwał obok komunikatu operacji, którą
    // użytkownik właśnie wykonał (zgłoszenie: „drugi, niepowiązany komunikat"
    // przy próbie dodania węzła).
    if (!ancestorId) return;
    // Efekt przelicza się przy KAŻDEJ zmianie `nodes`, więc bez tego strażnika
    // ta sama sytuacja potrafiła odpalić dymek wielokrotnie pod rząd.
    if (selectionMovedNoticeRef.current === targetId) return;
    selectionMovedNoticeRef.current = targetId;
    toast(t('mindmap.selectionMovedBranchCollapsed'), { id: 'mm-op-cue', duration: 2000 });
  }, [edges, isPolish, setNodes, visibleNodes]);

  const visibleEdges = useMemo(() => {
    const hiddenNodeIds = new Set(visibleNodes.filter((n) => n.hidden).map((n) => n.id));
    if (hiddenNodeIds.size === 0) return edges;
    return edges.map((e) => {
      const nextHidden = hiddenNodeIds.has(e.source) || hiddenNodeIds.has(e.target);
      return e.hidden === nextHidden ? e : { ...e, hidden: nextHidden };
    });
  }, [edges, visibleNodes]);

  // Focus filtering: when focusMode === 'object' and focusObjectId set, show only that node + direct connections
  const focusFilteredNodes = useMemo(() => {
    if (focusMode !== 'object' || !focusObjectId) return visibleNodes;
    const allowedIds = new Set<string>([focusObjectId]);
    for (const e of edges) {
      if (e.source === focusObjectId) allowedIds.add(e.target);
      if (e.target === focusObjectId) allowedIds.add(e.source);
    }
    return visibleNodes.map((n) => {
      const nextHidden = n.hidden || !allowedIds.has(n.id);
      return n.hidden === nextHidden ? n : { ...n, hidden: nextHidden };
    });
  }, [edges, focusMode, focusObjectId, visibleNodes]);

  const focusFilteredEdges = useMemo(() => {
    if (focusMode !== 'object' || !focusObjectId) return visibleEdges;
    const hiddenNodeIds = new Set(focusFilteredNodes.filter((n) => n.hidden).map((n) => n.id));
    if (hiddenNodeIds.size === 0) return visibleEdges;
    return visibleEdges.map((e) => {
      const nextHidden = hiddenNodeIds.has(e.source) || hiddenNodeIds.has(e.target);
      return e.hidden === nextHidden ? e : { ...e, hidden: nextHidden };
    });
  }, [focusFilteredNodes, focusMode, focusObjectId, visibleEdges]);

  const enrichedNodes = useMemo(() => {
    const structuralChildCount = new Map<string, number>();
    for (const e of edges) {
      if ((e as any)?.data?.edgeRole === 'relation') continue;
      structuralChildCount.set(e.source, (structuralChildCount.get(e.source) || 0) + 1);
    }
    return focusFilteredNodes.map((n) => {
      const extra: Record<string, unknown> = {};
      if (simplifiedMode) extra._simplified = true;
      // DP-3 (T7 Part B): flag nodes locked by another collaborator so the
      // node components can grey out + block inline editing. Functional-only
      // (data flag), no layout/remount — matches the existing _dropTarget /
      // _justMoved pattern.
      const remoteLocked = remoteLockedNodeIds.has(n.id);
      if (remoteLocked !== !!n.data?._remoteLocked) extra._remoteLocked = remoteLocked;
      // M06 Fala 3.2: flag the active search-result node for a transient
      // highlight ring — same pattern as _remoteLocked above.
      const isSearchHit = searchHitNodeId != null && n.id === searchHitNodeId;
      if (isSearchHit !== !!n.data?._searchHit) extra._searchHit = isSearchHit;
      if (n.type === 'branch') {
        const count = structuralChildCount.get(n.id) || 0;
        if (count !== n.data?.count || simplifiedMode || Object.keys(extra).length > 0) {
          return {
            ...n,
            focusable: false,
            data: { ...n.data, count, ...extra },
          };
        }
        // React Flow 11 hard-codes role="button" for every focusable node.
        // Branch cards contain native buttons, so keep the wrapper mouse-
        // selectable but remove its duplicate keyboard stop; the real branch
        // commands remain natively focusable inside the card.
        return n.focusable === false ? n : { ...n, focusable: false };
      }
      if (Object.keys(extra).length > 0) {
        return { ...n, data: { ...n.data, ...extra } };
      }
      return n;
    });
  }, [edges, focusFilteredNodes, remoteLockedNodeIds, simplifiedMode, searchHitNodeId]);

  const visibleIdeaNodeCount = useMemo(
    () => enrichedNodes.filter((n) => n.type === 'idea' && !n.hidden).length,
    [enrichedNodes]
  );

  // ── Undo/Redo (shared hook pattern) ──────────────────────────────────────
  const undoStackRef = useRef<MapSnapshot[]>([]);
  const redoStackRef = useRef<MapSnapshot[]>([]);
  const MAX_UNDO = 50;

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const pushUndo = useCallback(() => {
    undoStackRef.current = [
      ...undoStackRef.current.slice(-(MAX_UNDO - 1)),
      { nodes: [...nodes], edges: [...edges], collapsedNodeIds: new Set(collapsedNodeIds) },
    ];
    redoStackRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }, [collapsedNodeIds, nodes, edges]);

  const undo = useCallback(() => {
    if (undoStackRef.current.length === 0) return;
    const prev = undoStackRef.current[undoStackRef.current.length - 1];
    undoStackRef.current = undoStackRef.current.slice(0, -1);
    redoStackRef.current = [
      { nodes: [...nodes], edges: [...edges], collapsedNodeIds: new Set(collapsedNodeIds) },
      ...redoStackRef.current,
    ];
    setNodes(prev.nodes);
    setEdges(prev.edges);
    if (prev.collapsedNodeIds) setCollapsedNodeIds(prev.collapsedNodeIds);
    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(true);
  }, [collapsedNodeIds, edges, nodes, setCollapsedNodeIds, setEdges, setNodes]);

  const redo = useCallback(() => {
    if (redoStackRef.current.length === 0) return;
    const next = redoStackRef.current[0];
    redoStackRef.current = redoStackRef.current.slice(1);
    undoStackRef.current = [
      ...undoStackRef.current,
      { nodes: [...nodes], edges: [...edges], collapsedNodeIds: new Set(collapsedNodeIds) },
    ];
    setNodes(next.nodes);
    setEdges(next.edges);
    if (next.collapsedNodeIds) setCollapsedNodeIds(next.collapsedNodeIds);
    setCanUndo(true);
    setCanRedo(redoStackRef.current.length > 0);
  }, [collapsedNodeIds, edges, nodes, setCollapsedNodeIds, setEdges, setNodes]);

  const clearUndoHistory = useCallback(() => {
    undoStackRef.current = [];
    redoStackRef.current = [];
    setCanUndo(false);
    setCanRedo(false);
  }, []);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('mm-undo-state', { detail: { canUndo, canRedo } }));
  }, [canUndo, canRedo]);

  // ── Context menu ─────────────────────────────────────────────────────────
  const [contextMenu, setContextMenu] = useState<{
    nodeId: string;
    nodeType: string;
    x: number;
    y: number;
  } | null>(null);
  const [paneContextMenu, setPaneContextMenu] = useState<{
    x: number;
    y: number;
    canvasX: number;
    canvasY: number;
  } | null>(null);
  const [edgeContextMenu, setEdgeContextMenu] = useState<{
    edgeId: string;
    isUserCreated: boolean;
    x: number;
    y: number;
  } | null>(null);
  const [styleClipboard, setStyleClipboard] = useState<{
    shape?: string;
    branchKey?: string;
    priority?: number;
  } | null>(null);

  // ── Node Detail Drawer ──────────────────────────────────────────────────
  const [drawerNodeId, setDrawerNodeId] = useState<string | null>(null);
  const [nodeMetaMap, setNodeMetaMap] = useState<
    Record<string, { notes?: string; status?: NodeStatus }>
  >({});

  const drawerNodeData = useMemo((): NodeDetailData | null => {
    if (!drawerNodeId) return null;
    const node = nodes.find((n) => n.id === drawerNodeId);
    if (!node) return null;
    const meta = nodeMetaMap[drawerNodeId] || {};
    return {
      nodeId: node.id,
      label: node.data?.label || '',
      branchKey: node.data?.branchKey || 'uncategorized',
      sourceType: node.data?.sourceType,
      nodeType: node.data?.nodeType || node.type,
      priority: node.data?.priority,
      notes: meta.notes || node.data?.notes || '',
      status: meta.status || node.data?.status || 'idea',
      childNodeIds: edges
        .filter((e) => e.source === node.id && isStructuralEdge(e))
        .map((e) => e.target),
      parentNodeId: edges.find((e) => e.target === node.id && isStructuralEdge(e))?.source,
      context: node.data?.context || '',
      goal: node.data?.goal || '',
      rationale: node.data?.rationale || '',
      riskNote: node.data?.riskNote || '',
      tags: Array.isArray(node.data?.tags) ? node.data.tags : [],
      evidenceLinks: node.data?.evidenceLinks || [],
      semanticType: node.data?.semanticType || '',
      artifactLinks: Array.isArray(node.data?.artifactLinks) ? node.data.artifactLinks : [],
      aiExpansionHistory: Array.isArray(node.data?.aiExpansionHistory)
        ? node.data.aiExpansionHistory
        : [],
    };
  }, [drawerNodeId, edges, nodeMetaMap, nodes]);

  const handleUpdateNode = useCallback(
    (nodeId: string, patch: Partial<NodeDetailData>) => {
      if (patch.notes !== undefined || patch.status !== undefined) {
        setNodeMetaMap((prev) => ({
          ...prev,
          [nodeId]: { ...prev[nodeId], ...patch },
        }));
      }
      const depthFields: (keyof NodeDetailData)[] = [
        'context',
        'goal',
        'rationale',
        'riskNote',
        'semanticType',
        'tags',
        'evidenceLinks',
        'artifactLinks',
        'aiExpansionHistory',
      ];
      const dataPatch: Record<string, unknown> = {};
      if (patch.status) dataPatch.status = patch.status;
      if (patch.notes !== undefined) dataPatch.notes = patch.notes;
      for (const f of depthFields) {
        if (patch[f] !== undefined) dataPatch[f] = patch[f];
      }
      if (Object.keys(dataPatch).length > 0) {
        setNodes((prev: Node[]) =>
          prev.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...dataPatch } } : n))
        );
        // DP-3 (T7 Part A): broadcast drawer field edits (status/notes/context/…).
        broadcastNodeUpdate({ id: nodeId, data: dataPatch } as any);
      }
    },
    [broadcastNodeUpdate, setNodes]
  );

  // NodeDetailData ↔ UnifiedNodeData: pola wspólne mapują się 1:1, ale
  // `attachments`/`comments` mają w obu typach INNE kształty (name/author vs
  // title/userName). Ten wariant (mindmap) nie buduje attachments/comments
  // (drawerNodeData ich nie ustawia), a handleUpdateNode persystuje tylko
  // notes/status/pola głębi — więc rozbieżne pola jawnie pomijamy zamiast
  // rzutować całość na ślepo.
  const drawerUnifiedNodeData = useMemo((): UnifiedNodeData | null => {
    if (!drawerNodeData) return null;
    const { attachments: _attachments, comments: _comments, ...compatible } = drawerNodeData;
    return compatible;
  }, [drawerNodeData]);

  const handleUnifiedUpdateNode = useCallback(
    (nodeId: string, patch: Partial<UnifiedNodeData>) => {
      const { attachments: _attachments, comments: _comments, status, ...rest } = patch;
      handleUpdateNode(nodeId, {
        ...rest,
        // Statusy 'ready'/'rejected' istnieją tylko w unified; magazyn danych
        // węzła jest schemaless (n.data), więc przekazujemy wartość 1:1.
        ...(status !== undefined ? { status: status as NodeDetailData['status'] } : {}),
      });
    },
    [handleUpdateNode]
  );

  const handleConvertNode = useCallback(
    (nodeId: string, target: 'initiative' | 'decision') => {
      const action = target === 'initiative' ? 'convert_initiative' : 'convert_decision';
      setNodes((prev: Node[]) => prev.map((n) => ({ ...n, selected: n.id === nodeId })));
      window.dispatchEvent(
        new CustomEvent('idea-workspace-quick-action', { detail: { action, nodeIds: [nodeId] } })
      );
      setDrawerNodeId(null);
    },
    [setNodes]
  );

  const handleNavigateToNode = useCallback(
    (nodeId: string) => {
      setNodes((prev: Node[]) => prev.map((n) => ({ ...n, selected: n.id === nodeId })));
      setDrawerNodeId(nodeId);
      setTimeout(() => {
        try {
          fitView({ nodes: [{ id: nodeId } as any], padding: 0.5, duration: 400 });
        } catch {
          /* ignore */
        }
      }, 100);
    },
    [fitView, setNodes]
  );

  const handleDrillDown = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;
      setDrillPath((prev) => {
        const existingIdx = prev.findIndex((p) => p.nodeId === nodeId);
        if (existingIdx >= 0) return prev.slice(0, existingIdx + 1);
        return [...prev, { nodeId, label: node.data?.label || nodeId }];
      });
      setDrawerNodeId(null);
      setTimeout(() => {
        try {
          fitView({ padding: 0.3, duration: 400 });
        } catch {
          /* ignore */
        }
      }, 100);
    },
    [fitView, nodes]
  );

  const handleBreadcrumbNavigate = useCallback(
    (nodeId: string | null) => {
      if (!nodeId) {
        setDrillPath([]);
      } else {
        setDrillPath((prev) => {
          const idx = prev.findIndex((p) => p.nodeId === nodeId);
          return idx >= 0 ? prev.slice(0, idx + 1) : prev;
        });
      }
      setTimeout(() => {
        try {
          fitView({ padding: 0.3, duration: 400 });
        } catch {
          /* ignore */
        }
      }, 100);
    },
    [fitView]
  );

  // ── Selection ────────────────────────────────────────────────────────────
  const prevSelectedIdsRef = useRef<string>('');

  const reportSelection = useCallback(
    (currentNodes: Node[]) => {
      try {
        if (!onSelectionChange) return;
        const selected = currentNodes.filter((n: Node) => n.selected);
        const key = selected
          .map((n) => n.id)
          .sort()
          .join(',');
        if (key === prevSelectedIdsRef.current) return;
        prevSelectedIdsRef.current = key;
        debugLog(`reportSelection: ${selected.length} selected [${key.slice(0, 60)}]`, {
          source: 'selection',
        });
        if (selected.length === 0) {
          onSelectionChange({ type: 'none', count: 0, ids: [] });
        } else {
          onSelectionChange({
            type: 'node',
            count: selected.length,
            ids: selected.map((n: Node) => n.id),
            primaryId: selected[0]?.id,
            meta: {
              nodeType: selected[0]?.type,
              shape: selected[0]?.data?.shape,
              color: selected[0]?.data?.color,
              label: selected[0]?.data?.label,
              description: selected[0]?.data?.description,
              // FIX-16 (Day 3 layer-2 acceptance): the real, functioning "assign
              // person" feature (AssignPersonModal, below) persists to
              // `data.assignee` — the inspector's Owner field was reading only
              // `data.owner`, which mindmap nodes never populate, so a real
              // assignment always rendered as empty. Fallback like
              // ProcessFlowPropertiesPanel already does (`assignee ?? owner`).
              owner: selected[0]?.data?.owner ?? selected[0]?.data?.assignee,
              semanticType: selected[0]?.data?.semanticType,
              status: selected[0]?.data?.status,
              tags: Array.isArray(selected[0]?.data?.tags) ? selected[0]?.data?.tags : undefined,
              artifactRef: selected[0]?.data?.artifactRef,
              attachments: Array.isArray(selected[0]?.data?.attachments)
                ? selected[0]?.data?.attachments
                : undefined,
            },
          });
        }
      } catch (err: any) {
        debugLog(`ERROR in reportSelection: ${err?.message || err}`, {
          source: 'error',
          severity: 'error',
        });
        console.error('[MindMap Debug] reportSelection error:', err);
      }
    },
    [debugLog, onSelectionChange]
  );

  useEffect(() => {
    reportSelection(nodes);
  }, [nodes, reportSelection]);

  const onNodesChange = useCallback(
    (changes: import('reactflow').NodeChange[]) => {
      try {
        const types = changes.map((c) => c.type);
        const uniqueTypes = [...new Set(types)];
        if (uniqueTypes.some((t) => t !== 'position' && t !== 'dimensions')) {
          debugLog(`onNodesChange: [${uniqueTypes.join(',')}] count=${changes.length}`, {
            source: 'handler',
          });
        }
        // DP-3 (T7 Part A): emit final drag/resize positions + removals to
        // collaborators — mirrors the proven whiteboard wiring (L-02). Only
        // dragging===false / resizing===false / remove changes are sent
        // (see useIdeaCollab.broadcastNodeChanges); selection churn and
        // in-flight frames are filtered out there, so this is safe to call
        // unconditionally on every change batch.
        broadcastNodeChanges(changes, applyNodeChanges(changes, nodes));
        baseOnNodesChange(changes);
      } catch (err: any) {
        debugLog(`ERROR in onNodesChange: ${err?.message || err}`, {
          source: 'error',
          severity: 'error',
        });
        console.error('[MindMap Debug] onNodesChange error:', err);
      }
    },
    [baseOnNodesChange, broadcastNodeChanges, debugLog, nodes]
  );

  // DP-3 (T7 Part A): broadcast edge removals (e.g. Delete on a selected edge)
  // to collaborators — mirrors broadcastNodeChanges above / whiteboard L-02.
  const onEdgesChange = useCallback(
    (changes: import('reactflow').EdgeChange[]) => {
      broadcastEdgeChanges(changes);
      baseOnEdgesChange(changes);
    },
    [baseOnEdgesChange, broadcastEdgeChanges]
  );

  // ── GAP-3: Map structure type ─────────────────────────────────────
  const [structureType, setStructureType] = useState<MapStructureType>(
    () => ((extensions as any)?.mindmap?.structureType as MapStructureType) || 'mindmap'
  );
  const [showStructurePicker, setShowStructurePicker] = useState(false);

  const {
    loading,
    saving,
    lastSavedAt,
    persistence,
    mapLoadError,
    retryLoadMap,
    setSaving,
    setLastSavedAt,
    scheduleSave,
    saveViewportOnly,
    localVersionRef,
  } = useMindMapPersistence({
    ideaId,
    ideaTitle,
    isPolish,
    locked,
    preferredTool,
    extensions,
    structureType,
    i18nLanguage: i18n.language,
    nodes,
    edges,
    setNodes,
    setEdges,
    setCollapsedNodeIds,
    collapsedNodeIds,
    fitView,
    setViewport,
    getViewport,
    onPreferredToolLoaded,
    onViewportReport,
    clearUndoHistory,
    refreshToken,
    externalRuntime,
  });

  // D2: retry affordance for the map-load-error state below. Tracks its own
  // in-flight flag (rather than reusing `loading`) so the retry button shows
  // a spinner without flipping the whole canvas back to the full-screen
  // loading state.
  const [retryingMapLoad, setRetryingMapLoad] = useState(false);
  const handleRetryMapLoad = useCallback(async () => {
    setRetryingMapLoad(true);
    try {
      await retryLoadMap();
    } finally {
      setRetryingMapLoad(false);
    }
  }, [retryLoadMap]);

  const debouncedSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  nodesRef.current = nodes;
  edgesRef.current = edges;
  const debouncedSave = useCallback(() => {
    if (debouncedSaveTimerRef.current) clearTimeout(debouncedSaveTimerRef.current);
    debouncedSaveTimerRef.current = setTimeout(() => {
      scheduleSave(nodesRef.current as any, edgesRef.current as any);
    }, 500);
  }, [scheduleSave]);

  useEffect(() => {
    return () => {
      if (debouncedSaveTimerRef.current) clearTimeout(debouncedSaveTimerRef.current);
    };
  }, []);

  // ── Node operations (extracted to useMindMapNodes) ──────────────────────
  const {
    editingNodeIdRef,
    isNodeLockedByPeer,
    getSelectedNode,
    selectedNodeIds,
    findParentId,
    findChildrenIds,
    getSubtreeNodeIds,
    addChildNode,
    addSiblingNode,
    deleteSelected,
    duplicateSelected,
    copySelected,
    cutSelected,
    pasteNodes,
    focusSelectedNode,
    reparentNode,
    promoteNode,
    demoteNode,
    moveBetweenSiblings,
    clearDropTargets,
    isReparentable,
    reparentSelectedPromote,
    reparentSelectedDemote,
    startEditingSelected,
    toggleCollapse: toggleCollapseNode,
    setFoldLevel: setFoldLevelRaw,
    addRootTopic,
  } = useMindMapNodes({
    nodes,
    edges,
    setNodes,
    setEdges,
    locked,
    isPolish,
    pushUndo,
    fitView,
    // Sufit zoomu przy kadrowaniu nowego/kotwiczonego węzła — patrz
    // `revealNodeInContext` w useMindMapNodes (nigdy nie przybliżaj).
    getViewport,
    remoteLockedNodeIds,
    autoLayout,
    partialLayoutSubtree,
    // DP-3 (T7 Part A): broadcast graph CRUD (add/remove node+edge, reparent)
    // performed inside this hook so collaborators see them live.
    broadcastGraphPatch,
    confirmSubtreeDelete: (childCount: number) =>
      confirmSubtreeDelete({
        title: t('mindmap.deleteNodes'),
        description: t('mindmap.deleteSubtreeWarning', { count: childCount }),
        confirmLabel: t('mindmap.delete'),
        cancelLabel: t('mindmap.cancel'),
        variant: 'danger',
      }),
  });

  // ── AI Sidekick context detection ──────────────────────────────────────
  const sidekickCtx = useMemo<SidekickContext>(
    () =>
      detectMindmapIntent({
        nodes: nodes.map((n: Node) => ({ id: n.id, data: n.data, type: n.type })),
        edges: edges.map((e: Edge) => ({ source: e.source, target: e.target })),
        selectedNodeIds,
        isEditing: editingNodeIdRef.current !== null,
        hasTemplate: nodes.some((n: Node) => n.data?._fromTemplate === true),
        activeTool: 'mindmap',
      }),
    [nodes, edges, selectedNodeIds]
  );

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('idea-mindmap-sidekick-context', {
        detail: { ...sidekickCtx, ideaId, ideaTitle },
      })
    );
  }, [sidekickCtx, ideaId, ideaTitle]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      const action = normalizeMindmapNodeQuickAction(String(detail.action || ''));
      if (action === 'add_child' && detail.nodeId) addChildNode(detail.nodeId);
      if (action === 'add_sibling' && detail.nodeId) addSiblingNode(detail.nodeId);
      if (action === 'open_properties' && detail.nodeId) setDrawerNodeId(detail.nodeId);
      if (action === 'pane_fit_view') {
        try {
          fitView({ padding: 0.3, duration: 300, jawne: true });
        } catch {
          /* */
        }
      }
      if (action === 'pane_auto_layout') {
        const laid = autoLayout(nodes as any, edges as any);
        setNodes(laid);
        setTimeout(() => {
          try {
            fitView({ padding: 0.3, duration: 300, jawne: true });
          } catch {
            /* */
          }
        }, 50);
      }
      if (action === 'set_layout_mode' && detail.layoutMode) {
        setLayoutMode(detail.layoutMode as 'tree' | 'radial' | 'force');
        setStructureType('mindmap');
      }
      if (action === 'set_structure_type' && detail.structureType) {
        setStructureType(detail.structureType as MapStructureType);
        const laid = applyStructureLayout(
          detail.structureType as MapStructureType,
          nodes as any,
          edges as any,
          autoLayout
        );
        setNodes(laid);
        setTimeout(() => {
          try {
            fitView({ padding: 0.3, duration: 300 });
          } catch {
            /* */
          }
        }, 50);
      }
      if (action === 'set_map_theme' && detail.theme) {
        window.dispatchEvent(
          new CustomEvent('idea-mindmap-apply-theme', { detail: { themeId: detail.theme } })
        );
      }
      if (action === 'apply_style') {
        const selectedIds = (nodes as any[]).filter((n: any) => n.selected).map((n: any) => n.id);
        if (selectedIds.length > 0) {
          const { action: _a, ...stylePatch } = detail;
          setNodes((prev: any[]) =>
            prev.map((n: any) =>
              selectedIds.includes(n.id) ? { ...n, data: { ...n.data, ...stylePatch } } : n
            )
          );
        }
      }
    };
    window.addEventListener(MINDMAP_NODE_QUICK_ACTION_EVENT, handler);
    return () => window.removeEventListener(MINDMAP_NODE_QUICK_ACTION_EVENT, handler);
  }, [addChildNode, addSiblingNode, autoLayout, edges, fitView, nodes, setNodes]);

  const toggleCollapse = useCallback(
    (nodeId: string) => {
      pushUndo();
      const wasCollapsed = collapsedNodeIds.has(nodeId);
      toggleCollapseNode(nodeId, setCollapsedNodeIds);
      toast(wasCollapsed ? t('mindmap.expanded') : t('mindmap.collapsed'), {
        id: 'mm-op-cue',
        duration: 1200,
      });
    },
    [collapsedNodeIds, isPolish, pushUndo, toggleCollapseNode, setCollapsedNodeIds]
  );

  useEffect(() => {
    const handler = (e: Event) => {
      const nodeId = (e as CustomEvent).detail?.nodeId;
      if (nodeId) toggleCollapse(nodeId);
    };
    window.addEventListener('mm-toggle-collapse', handler);
    return () => window.removeEventListener('mm-toggle-collapse', handler);
  }, [toggleCollapse]);

  const setFoldLevel = useCallback(
    (maxLevel: number) => setFoldLevelRaw(maxLevel, setCollapsedNodeIds),
    [setFoldLevelRaw, setCollapsedNodeIds]
  );

  // ── Manual drag tracking (disables auto-relayout for the session) ────────
  const userDraggedRef = useRef(false);

  const onNodeDrag = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (!node || !isReparentable(node.id)) {
        clearDropTargets();
        return;
      }
      const intersecting = getIntersectingNodes(node) as Node[];
      const subtree = new Set(getSubtreeNodeIds(node.id));
      const currentParent = findParentId(node.id);
      const validTarget = intersecting.find(
        (n: Node) =>
          n.id !== node.id && !subtree.has(n.id) && n.id !== currentParent && n.id !== 'root'
      );
      setNodes((prev: Node[]) =>
        prev.map((n) => {
          const shouldHighlight = validTarget?.id === n.id;
          if (n.data?._dropTarget === shouldHighlight) return n;
          return { ...n, data: { ...n.data, _dropTarget: shouldHighlight } };
        })
      );
    },
    [
      clearDropTargets,
      findParentId,
      getIntersectingNodes,
      getSubtreeNodeIds,
      isReparentable,
      setNodes,
    ]
  );

  const onNodeDragStop = useCallback(
    (event?: React.MouseEvent, node?: Node) => {
      userDraggedRef.current = true;
      clearDropTargets();
      debugLog('NODE_DRAG_STOP', {
        source: 'handler',
        detail: node ? `node:${node.id}` : undefined,
      });
      if (event?.target) {
        markInputHandled(
          'click',
          event.target,
          'onNodeDragStop',
          node ? `node:${node.id}` : undefined
        );
      }
      debouncedSave();
      if (!node || !isReparentable(node.id)) return;

      const intersecting = getIntersectingNodes(node) as Node[];
      const subtree = new Set(getSubtreeNodeIds(node.id));
      const currentParent = findParentId(node.id);
      const validTarget = intersecting.find(
        (n: Node) =>
          n.id !== node.id && !subtree.has(n.id) && n.id !== currentParent && n.id !== 'root'
      );
      if (validTarget) {
        const ok = reparentNode(node.id, validTarget.id);
        if (ok) {
          toast.success(
            t('mindmap.movedUnderTarget', {
              label: validTarget.data?.label || validTarget.id,
            })
          );
        }
      }
    },
    [
      clearDropTargets,
      debouncedSave,
      debugLog,
      findParentId,
      getIntersectingNodes,
      getSubtreeNodeIds,
      isPolish,
      isReparentable,
      markInputHandled,
      reparentNode,
    ]
  );

  const currentUserName = useMemo(() => {
    const fullName = [currentUser?.firstName, currentUser?.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();
    return fullName || currentUser?.email || t('mindmap.you');
  }, [currentUser?.email, currentUser?.firstName, currentUser?.lastName, isPolish]);

  const notifyLockedNode = useCallback(() => {
    toast.error(t('mindmap.thisNodeIsCurrentlyLockedBy'));
  }, [isPolish]);

  const handleCollabSessionStateChange = useCallback(
    (state: CollaborationSessionState | null) => {
      const next = new Set(
        Object.entries(state?.lockedNodes || {})
          .filter(([, userId]) => userId !== currentUser?.id)
          .map(([nodeId]) => nodeId)
      );

      setRemoteLockedNodeIds((prev) => {
        if (prev.size === next.size && Array.from(next).every((nodeId) => prev.has(nodeId))) {
          return prev;
        }
        return next;
      });
    },
    [currentUser?.id]
  );

  useEffect(() => {
    if (remoteLockedNodeIds.size === 0) return;

    setNodes((prev: Node[]) => {
      let hasChanges = false;
      const nextNodes = prev.map((node) => {
        if (!node.selected || !remoteLockedNodeIds.has(node.id)) {
          return node;
        }

        hasChanges = true;
        return { ...node, selected: false };
      });

      return hasChanges ? nextNodes : prev;
    });

    if (contextMenu && remoteLockedNodeIds.has(contextMenu.nodeId)) {
      setContextMenu(null);
    }
    if (drawerNodeId && remoteLockedNodeIds.has(drawerNodeId)) {
      setDrawerNodeId(null);
    }
  }, [contextMenu, drawerNodeId, remoteLockedNodeIds, setNodes]);

  // ── Apply incoming graph patches from collaborators ──────────────────────
  // DP-3 (T6): handled by the shared useIdeaCollab hook above (guarded by
  // applyingRemoteRef, idempotent adds, functional updates — no remount).

  // Node operations (findParentId, findChildrenIds, addChildNode, addSiblingNode,
  // deleteSelected, duplicateSelected, focusSelectedNode, reparentSelectedPromote,
  // reparentSelectedDemote, startEditingSelected) are now in useMindMapNodes hook above.

  // ── Handle inline edit completion ────────────────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const { nodeId, label, cancelled } = (e as CustomEvent).detail;
      console.log('[MindMap:edit] event:', { nodeId, label, cancelled });
      debugLog(`CUSTOM_EVENT idea-mindmap-node-edit`, {
        source: 'custom',
        detail: summarizeDebugDetail({ nodeId, cancelled, label }),
      });
      editingNodeIdRef.current = null;

      const rollbackNode = (nid: string) => {
        setNodes((prev: Node[]) => prev.filter((n) => n.id !== nid));
        setEdges((prev: Edge[]) =>
          prev.filter((edge) => edge.source !== nid && edge.target !== nid)
        );
      };

      if (cancelled) {
        const target = nodes.find((n) => n.id === nodeId);
        const hadNoLabel = !!target && !String(target.data?.label || '').trim();
        if (hadNoLabel) {
          rollbackNode(nodeId);
        } else {
          setNodes((prev: Node[]) =>
            prev.map((n) =>
              n.id === nodeId ? { ...n, data: { ...n.data, _startEditing: undefined } } : n
            )
          );
        }
        return;
      }
      if (!label) {
        const target = nodes.find((n) => n.id === nodeId);
        const hadNoLabel = !!target && !String(target.data?.label || '').trim();
        if (hadNoLabel) {
          console.log('[MindMap:edit] empty label on new node → rollback (delete node)');
          rollbackNode(nodeId);
        } else {
          setNodes((prev: Node[]) =>
            prev.map((n) =>
              n.id === nodeId ? { ...n, data: { ...n.data, _startEditing: undefined } } : n
            )
          );
        }
        return;
      }

      const existingNode = nodes.find((n) => n.id === nodeId);
      const originalLabel = existingNode?.data?.label ?? '';
      if (label !== originalLabel) {
        pushUndo();
      }

      setNodes((prev: Node[]) =>
        prev.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, label, _startEditing: undefined } } : n
        )
      );
      // DP-3 (T7 Part A): broadcast the committed label to collaborators.
      broadcastNodeUpdate({ id: nodeId, data: { label } } as any);

      if (label !== originalLabel) {
        toast.success(t('mindmap.renamed'), {
          id: 'mm-op-cue',
          duration: 1500,
        });
      }
    };
    window.addEventListener('idea-mindmap-node-edit', handler);
    return () => window.removeEventListener('idea-mindmap-node-edit', handler);
  }, [broadcastNodeUpdate, debugLog, isPolish, nodes, pushUndo, setEdges, setNodes]);

  useEffect(() => {
    const handler = (e: Event) => {
      const nodeId = String((e as CustomEvent).detail?.nodeId || '').trim();
      if (!nodeId) return;
      setDrawerNodeId(nodeId);
    };
    window.addEventListener('idea-mindmap-open-drawer', handler);
    return () => window.removeEventListener('idea-mindmap-open-drawer', handler);
  }, []);

  // M06 Fala 3.2: IdeaUnifiedSearch (⌘F) dispatches this on Enter/Shift+Enter
  // navigation and on result click. Jump the viewport to the matched node and
  // pulse-highlight it — the search overlay itself already tracks "X/Y" state,
  // this is purely the canvas-side reaction that was previously missing.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      if (detail.ideaId && detail.ideaId !== ideaId) return;

      // Wariant ZBIOROWY (`nodeIds`) — dodany dla widgetu „Zdrowie mapy":
      // klik w konkretny brak („5 węzłów bez etykiety") ma pokazać WSZYSTKIE
      // winne węzły, nie jeden. Zaznacza je na płótnie i kadruje do nich —
      // ten sam ruch, co pigułka „N niepowiązanych elementów" w Whiteboard.
      const nodeIds = Array.isArray(detail.nodeIds)
        ? detail.nodeIds.map((id: unknown) => String(id || '').trim()).filter(Boolean)
        : [];
      if (nodeIds.length > 0) {
        const idSet = new Set<string>(nodeIds);
        setNodes((prev: Node[]) => prev.map((n) => ({ ...n, selected: idSet.has(n.id) })));
        setSearchHitNodeId(nodeIds[0]);
        try {
          fitView({
            nodes: nodeIds.map((id: string) => ({ id }) as any),
            padding: 0.4,
            duration: 400,
          });
        } catch {
          /* fitView throws if the canvas is mid-teardown — safe to ignore */
        }
        return;
      }

      const nodeId = String(detail.nodeId || '').trim();
      if (!nodeId) return;
      setSearchHitNodeId(nodeId);
      try {
        fitView({ nodes: [{ id: nodeId } as any], padding: 0.6, duration: 350 });
      } catch {
        /* fitView throws if the canvas is mid-teardown — safe to ignore */
      }
    };
    window.addEventListener('idea-workspace-highlight-node', handler);
    return () => window.removeEventListener('idea-workspace-highlight-node', handler);
  }, [fitView, ideaId, setNodes]);

  // Clear the pulse after a short delay so it doesn't linger once the user
  // moves on (matches the _justMoved ring's transient nature elsewhere).
  useEffect(() => {
    if (!searchHitNodeId) return;
    const t = setTimeout(() => setSearchHitNodeId(null), 1600);
    return () => clearTimeout(t);
  }, [searchHitNodeId]);

  // ── Handle edge label edits ──────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const { edgeId, label } = (e as CustomEvent).detail;
      debugLog(`CUSTOM_EVENT idea-mindmap-edge-label`, {
        source: 'custom',
        detail: summarizeDebugDetail({ edgeId, label }),
      });
      setEdges((prev: Edge[]) =>
        prev.map((edge) => (edge.id === edgeId ? { ...edge, data: { ...edge.data, label } } : edge))
      );
    };
    window.addEventListener('idea-mindmap-edge-label', handler);
    return () => window.removeEventListener('idea-mindmap-edge-label', handler);
  }, [debugLog, setEdges]);

  // MM-15: Mark converted nodes with status: 'converted'
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      if (detail.ideaId && detail.ideaId !== ideaId) return;
      const convertedIds = Array.isArray(detail.nodeIds) ? detail.nodeIds : [];
      if (convertedIds.length === 0) return;
      const convertedSet = new Set(convertedIds);
      setNodes((prev: Node[]) => {
        const next = prev.map((n) =>
          convertedSet.has(n.id)
            ? { ...n, data: { ...n.data, status: 'converted', _convertedTo: detail.target } }
            : n
        );
        scheduleSave(next as any, edges as any);
        return next;
      });
    };
    window.addEventListener('idea-mindmap-mark-converted', handler);
    return () => window.removeEventListener('idea-mindmap-mark-converted', handler);
  }, [ideaId, edges, scheduleSave, setNodes]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.ideaId && detail.ideaId !== ideaId) return;
      if (detail?.nodeId) {
        setSummaryBranchId(detail.nodeId);
        setSummaryBranchLabel(detail.nodeLabel || '');
        setSummaryPanelOpen(true);
      }
    };
    window.addEventListener('idea-mindmap-summarize-branch', handler);
    return () => window.removeEventListener('idea-mindmap-summarize-branch', handler);
  }, [ideaId]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      exportAsPdf(detail.title || ideaTitle || 'Mind Map');
    };
    window.addEventListener('idea-mindmap-export-pdf', handler);
    return () => window.removeEventListener('idea-mindmap-export-pdf', handler);
  }, [exportAsPdf, ideaTitle]);

  // Quick action listener is wired below (after all state declarations).

  // ── Insert from AI Suggestions panel ─────────────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = ((e as CustomEvent).detail || {}) as IdeaWorkspaceInsertDetail;
      const { items, ideaId: evtIdeaId } = detail;
      if (evtIdeaId && evtIdeaId !== ideaId) return;
      if (!Array.isArray(items) || items.length === 0) return;
      debugLog(`CUSTOM_EVENT ${IDEA_WORKSPACE_INSERT_EVENT}`, {
        source: 'custom',
        detail: summarizeDebugDetail({ count: items.length, ideaId: evtIdeaId || ideaId }),
      });
      pushUndo();

      const branchMap: Record<string, string> = {
        topics: 'options',
        findings: 'evidence',
        next_steps: 'experiments',
      };

      for (const item of items) {
        const anchorId =
          String(
            item.anchorNodeId || detail.anchorNodeId || item.parentId || detail.parentId || ''
          ).trim() || null;
        const anchorNode = anchorId ? nodes.find((n) => n.id === anchorId) : null;
        const branchKey =
          String(anchorNode?.data?.branchKey || branchMap[item.type || ''] || 'options').trim() ||
          'options';
        const branchNode = nodes.find((n) => n.data?.branchKey === branchKey);
        const sourceNode = anchorNode || branchNode || nodes.find((n) => n.id === 'root') || null;
        const childrenOfSource = edges.filter(
          (edge) => edge.source === sourceNode?.id && isStructuralEdge(edge)
        );
        const yOffset = childrenOfSource.length * 70;
        const explicitPosition = item.position || detail.position;
        const defaultPosition = sourceNode
          ? sourceNode.id.startsWith('branch-')
            ? { x: (sourceNode.position?.x ?? 0) + 220, y: (sourceNode.position?.y ?? 0) + yOffset }
            : {
                x: (sourceNode.position?.x ?? 0) + 180,
                y: (sourceNode.position?.y ?? 0) + 60 + yOffset,
              }
          : { x: 220, y: yOffset };

        const newId = `node-${uid()}`;
        const newNode: Node = {
          id: newId,
          type: 'idea',
          position: explicitPosition || defaultPosition,
          data: {
            label: item.text || item.label,
            branchKey,
            sourceType: 'ai_suggestion',
            priority: 50,
            ...(item.data || {}),
            ...(anchorId ? { parentId: anchorId } : {}),
          },
        } as any;

        const colors = branchColor(branchKey);
        const newEdge: Edge = {
          id: `edge-${uid()}`,
          source: sourceNode?.id || `branch-${branchKey}`,
          target: newId,
          type: 'smoothstep',
          style: { stroke: colors.edge, strokeWidth: 1.5, opacity: 0.5 },
          animated: true,
          data: { userCreated: false },
        } as any;

        setNodes((prev: Node[]) => [...prev, newNode]);
        setEdges((prev: Edge[]) => [...prev, newEdge]);
      }
      toast.success(t('mindmap.insertedIntoMap'), { duration: 1000 });
    };
    window.addEventListener(IDEA_WORKSPACE_INSERT_EVENT, handler);
    return () => window.removeEventListener(IDEA_WORKSPACE_INSERT_EVENT, handler);
  }, [debugLog, edges, ideaId, isPolish, nodes, pushUndo, setEdges, setNodes]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      if (detail.ideaId && detail.ideaId !== ideaId) return;
      const themeId = String(detail.themeId || '');
      debugLog(`CUSTOM_EVENT ${IDEA_WORKSPACE_THEME_EVENT}`, {
        source: 'custom',
        detail: summarizeDebugDetail({ themeId, ideaId }),
      });
      if (themeId === 'ops') {
        setLayoutMode('tree');
        setHeatmapMode(false);
      }
      if (themeId === 'workshop') {
        setShowClusterBubbles(true);
        setHeatmapMode(false);
      }
      if (themeId === 'strategy') {
        setLayoutMode('radial');
        setShowClusterBubbles(false);
      }
    };
    window.addEventListener(IDEA_WORKSPACE_THEME_EVENT, handler);
    return () => window.removeEventListener(IDEA_WORKSPACE_THEME_EVENT, handler);
  }, [debugLog, ideaId]);

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const target = e.target as HTMLElement;
      const container = containerRef.current;
      const active = document.activeElement;

      const keyLabel = formatDebugKey(e);
      const isEditing = editingNodeIdRef.current !== null;
      const isInput =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      trackInputEvent('keydown', target, keyLabel);

      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        debugLog('KEY_HANDLED save', { source: 'keyboard', reaction: 'handled', detail: keyLabel });
        scheduleSave(nodes as any, edges as any);
        if (externalRuntime) {
          void externalRuntime.flushGraph({ reason: 'manual' });
        }
        return;
      }
      // A6: Shift+1 = zoom to fit (shared cross-tool shortcut, FigJam-style).
      // e.code is layout-independent (Shift+1 yields "!" as e.key on most layouts).
      if (e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey && e.code === 'Digit1') {
        const t = e.target as HTMLElement | null;
        const typing =
          !!t && (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable);
        if (!typing) {
          e.preventDefault();
          try {
            fitView({ padding: 0.3, duration: 300 });
          } catch {
            /* */
          }
          return;
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '0') {
        e.preventDefault();
        debugLog('KEY_HANDLED fitView', {
          source: 'keyboard',
          reaction: 'handled',
          detail: keyLabel,
        });
        try {
          fitView({ padding: 0.3, duration: 300 });
        } catch {
          /* */
        }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        debugLog('KEY_HANDLED redo', {
          source: 'keyboard',
          reaction: 'handled',
          detail: keyLabel,
        });
        redo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        debugLog('KEY_HANDLED snapshotHistory', {
          source: 'keyboard',
          reaction: 'handled',
          detail: keyLabel,
        });
        setShowSnapshots((prev) => !prev);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        debugLog('KEY_HANDLED undo', { source: 'keyboard', reaction: 'handled', detail: keyLabel });
        undo();
        return;
      }
      // V4-IDEA-07: Select all (Ctrl+A)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a' && !e.shiftKey) {
        e.preventDefault();
        debugLog('KEY_HANDLED selectAll', {
          source: 'keyboard',
          reaction: 'handled',
          detail: keyLabel,
        });
        setNodes((prev: Node[]) => prev.map((n) => ({ ...n, selected: n.id !== 'root' })));
        return;
      }
      // V4-IDEA-07: Clear selection (Ctrl+D)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        debugLog('KEY_HANDLED clearSelection', {
          source: 'keyboard',
          reaction: 'handled',
          detail: keyLabel,
        });
        setNodes((prev: Node[]) => prev.map((n) => ({ ...n, selected: false })));
        return;
      }

      // GAP-9: Fold levels — Alt+0/1/2/3/9
      if (e.altKey && !e.metaKey && !e.ctrlKey && !e.shiftKey && /^[0-3]$/.test(e.key)) {
        e.preventDefault();
        const level = Number(e.key);
        debugLog('KEY_HANDLED foldLevel', {
          source: 'keyboard',
          reaction: 'handled',
          detail: `Alt+${e.key} → level ${level}`,
        });
        setFoldLevel(level);
        toast.success(t('mindmap.quickActions.viewLevel', { level }), {
          duration: 1200,
        });
        return;
      }
      if (e.altKey && !e.metaKey && !e.ctrlKey && e.key === '9') {
        e.preventDefault();
        debugLog('KEY_HANDLED foldExpandAll', {
          source: 'keyboard',
          reaction: 'handled',
          detail: 'Alt+9 → expand all',
        });
        setFoldLevel(Infinity);
        toast.success(t('mindmap.allExpanded'), { duration: 1200 });
        return;
      }

      // ReactFlow nodes are not focusable, so clicking a node leaves focus on
      // the container itself (it carries `tabIndex={-1}` — see the JSX root
      // below — so the browser's click-to-focus ancestor walk lands there).
      // The map's keyboard grammar (Tab=child, Enter=sibling, Delete, …)
      // keeps working in that state because `container.contains(active)`
      // is still true.
      //
      // F-K1 fix (G4-KBD-P0, 2026-08-11): this used to ALSO treat "nothing
      // real is focused" (activeElement === body/documentElement) as
      // in-scope, which is true EVERYWHERE on the page before anything has
      // been focused — that's what let a bare Tab keypress anywhere hijack
      // focus/add a node. The container already gets real DOM focus on
      // mount (see the viewport-restore effect's `containerRef.current?.
      // focus()` call below) specifically to keep "select a branch and
      // press Tab" working from a fresh load, so that fallback was both
      // redundant and unsafe. See `mindmapKeyboardScope.ts` for the
      // extracted, unit-tested containment check.
      //
      // Scoped here — AFTER Ctrl/Cmd+S/Z/Shift+Z/Shift+H/A/D and Alt+0-9 —
      // deliberately, not at the top of the handler: those modifier combos
      // are this map's "always on while open" shortcuts (mirrors the same
      // fix in useIdeasToolKeyboard.ts for Process Flow/Whiteboard, which
      // discovered — via tests/components/MyWork/IdeaWhiteboardTool.
      // drawUndo.test.tsx firing Ctrl+Z directly on `document` with nothing
      // focused — that scoping modifier-combo undo/save this strictly
      // breaks a real, tested, deliberate contract). Only the plain
      // "grammar" keys below (mode toggles, Tab/Enter/F2/Delete/Escape,
      // arrow navigation) require genuine in-map focus.
      const isWithinMap = isCanvasKeyboardScope(container, target, active);
      if (!isWithinMap) return;

      if (isEditing || isInput) {
        debugLog('KEY_IGNORED editing_or_input', {
          source: 'keyboard',
          reaction: 'silent',
          severity: 'warn',
          detail: `${keyLabel} | editing=${isEditing} input=${isInput}`,
        });
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        debugLog('KEY_HANDLED copy', { source: 'keyboard', reaction: 'handled', detail: keyLabel });
        copySelected();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'x') {
        e.preventDefault();
        debugLog('KEY_HANDLED cut', { source: 'keyboard', reaction: 'handled', detail: keyLabel });
        cutSelected();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        debugLog('KEY_HANDLED paste', {
          source: 'keyboard',
          reaction: 'handled',
          detail: keyLabel,
        });
        pasteNodes();
        return;
      }

      if (e.key.toLowerCase() === 'v') {
        e.preventDefault();
        updateInteractionMode('select');
        return;
      }
      if (e.key.toLowerCase() === 'h') {
        e.preventDefault();
        updateInteractionMode('pan');
        return;
      }

      // F-K2 fix (G4-KBD-P0, 2026-08-11): `resolveMindMapGrammarAction`
      // requires `!e.shiftKey` for Tab — this used to fire on Shift+Tab too
      // (a pure focus-navigation key), silently spawning a real empty child
      // node with its inline editor open on every backward-Tab.
      const grammarAction = resolveMindMapGrammarAction(e);
      if (grammarAction === 'add_child') {
        e.preventDefault();
        debugLog('KEY_HANDLED addChild', {
          source: 'keyboard',
          reaction: 'handled',
          detail: keyLabel,
        });
        addChildNode();
        return;
      }
      if (grammarAction === 'add_sibling') {
        e.preventDefault();
        debugLog('KEY_HANDLED addSibling', {
          source: 'keyboard',
          reaction: 'handled',
          detail: keyLabel,
        });
        addSiblingNode();
        return;
      }
      if (e.key === 'F2') {
        e.preventDefault();
        debugLog('KEY_HANDLED startEditing', {
          source: 'keyboard',
          reaction: 'handled',
          detail: keyLabel,
        });
        startEditingSelected();
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        debugLog('KEY_HANDLED deleteSelected', {
          source: 'keyboard',
          reaction: 'handled',
          detail: keyLabel,
        });
        deleteSelected();
        return;
      }
      if (e.key === 'Escape') {
        debugLog('KEY_HANDLED escape', {
          source: 'keyboard',
          reaction: 'handled',
          detail: keyLabel,
        });
        setNodes((prev: Node[]) => prev.map((n) => ({ ...n, selected: false })));
        setContextMenu(null);
        return;
      }
      if (e.key === ' ') {
        e.preventDefault();
        const sel = getSelectedNode();
        if (sel) {
          debugLog('KEY_HANDLED toggleCollapse', {
            source: 'keyboard',
            reaction: 'handled',
            detail: `${keyLabel} | ${sel.id}`,
          });
          toggleCollapse(sel.id);
        } else {
          debugLog('KEY_NO_SELECTION toggleCollapse', {
            source: 'keyboard',
            reaction: 'silent',
            severity: 'warn',
            detail: keyLabel,
          });
        }
        return;
      }

      // Alt+Arrow: reparent operations
      if (e.altKey && e.key.startsWith('Arrow')) {
        e.preventDefault();
        const rSel = getSelectedNode();
        if (!rSel) return;
        if (e.key === 'ArrowUp') {
          debugLog('KEY_HANDLED promoteNode', {
            source: 'keyboard',
            reaction: 'handled',
            detail: keyLabel,
          });
          promoteNode(rSel.id);
          return;
        }
        if (e.key === 'ArrowDown') {
          debugLog('KEY_HANDLED demoteNode', {
            source: 'keyboard',
            reaction: 'handled',
            detail: keyLabel,
          });
          demoteNode(rSel.id);
          return;
        }
        if (e.key === 'ArrowLeft') {
          debugLog('KEY_HANDLED moveSiblingLeft', {
            source: 'keyboard',
            reaction: 'handled',
            detail: keyLabel,
          });
          moveBetweenSiblings(rSel.id, 'left');
          return;
        }
        if (e.key === 'ArrowRight') {
          debugLog('KEY_HANDLED moveSiblingRight', {
            source: 'keyboard',
            reaction: 'handled',
            detail: keyLabel,
          });
          moveBetweenSiblings(rSel.id, 'right');
          return;
        }
      }

      // Arrow key navigation
      const sel = getSelectedNode();
      if (!sel) {
        if (e.key.startsWith('Arrow')) {
          debugLog('KEY_NO_SELECTION navigation', {
            source: 'keyboard',
            reaction: 'silent',
            severity: 'warn',
            detail: keyLabel,
          });
        }
        return;
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        debugLog('KEY_HANDLED navRight', {
          source: 'keyboard',
          reaction: 'handled',
          detail: `${keyLabel} | from=${sel.id}`,
        });
        const children = findChildrenIds(sel.id);
        if (children.length > 0) {
          setNodes((prev: Node[]) => prev.map((n) => ({ ...n, selected: n.id === children[0] })));
        }
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        debugLog('KEY_HANDLED navLeft', {
          source: 'keyboard',
          reaction: 'handled',
          detail: `${keyLabel} | from=${sel.id}`,
        });
        const parentId = findParentId(sel.id);
        if (parentId) {
          setNodes((prev: Node[]) => prev.map((n) => ({ ...n, selected: n.id === parentId })));
        }
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        debugLog(`KEY_HANDLED ${e.key === 'ArrowDown' ? 'navDown' : 'navUp'}`, {
          source: 'keyboard',
          reaction: 'handled',
          detail: `${keyLabel} | from=${sel.id}`,
        });
        const parentId = findParentId(sel.id);
        if (!parentId) return;
        const siblings = findChildrenIds(parentId);
        const idx = siblings.indexOf(sel.id);
        const nextIdx =
          e.key === 'ArrowDown' ? Math.min(idx + 1, siblings.length - 1) : Math.max(idx - 1, 0);
        if (nextIdx !== idx) {
          setNodes((prev: Node[]) =>
            prev.map((n) => ({ ...n, selected: n.id === siblings[nextIdx] }))
          );
        }
        return;
      }
    };
    const container = containerRef.current;
    // Listen in CAPTURE phase at the window level. ReactFlow nodes are not
    // click-focusable, so after a click focus sits on <body>; a plain bubble-phase
    // listener then sees Tab with defaultPrevented already true (something upstream
    // consumes it) and bails — which is why the map's keyboard grammar
    // (Tab/Enter/Delete/arrows) silently did nothing after a click. Capture runs
    // first, before anything can preventDefault, so the grammar works regardless of
    // exactly which element holds focus. The handler still guards text inputs
    // (isInput/isEditing) and out-of-map focus (isWithinMap), so we never hijack
    // typing in another surface.
    container?.addEventListener('keydown', handler, true);
    window.addEventListener('keydown', handler, true);
    return () => {
      container?.removeEventListener('keydown', handler, true);
      window.removeEventListener('keydown', handler, true);
    };
  }, [
    addChildNode,
    addSiblingNode,
    copySelected,
    cutSelected,
    debugLog,
    deleteSelected,
    demoteNode,
    edges,
    findChildrenIds,
    findParentId,
    getSelectedNode,
    isPolish,
    moveBetweenSiblings,
    nodes,
    pasteNodes,
    promoteNode,
    redo,
    scheduleSave,
    setFoldLevel,
    setNodes,
    startEditingSelected,
    trackInputEvent,
    toggleCollapse,
    undo,
    updateInteractionMode,
  ]);

  // ── Connect ──────────────────────────────────────────────────────────────
  const onConnect = useCallback(
    (connection: Connection) => {
      debugLog(`onConnect: ${connection.source} → ${connection.target}`, { source: 'handler' });
      if (locked) return;
      if (!connection.source || !connection.target) return;
      if (connection.source === connection.target) return;
      pushUndo();
      const id = `edge-${uid()}`;
      const newEdge: Edge = {
        id,
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle || undefined,
        targetHandle: connection.targetHandle || undefined,
        type: 'labeled',
        style: { stroke: 'var(--c-tag-2)', strokeWidth: 2, opacity: 0.7, strokeDasharray: '6 3' },
        animated: false,
        data: {
          userCreated: true,
          edgeRole: 'relation',
          relationType: 'related',
          flowState: 'forward',
          label: '',
        },
      };
      setEdges((prev: Edge[]) => addEdge(newEdge, prev));
      broadcastEdgeAdd(newEdge);
      updateInteractionMode('select');
    },
    [broadcastEdgeAdd, locked, pushUndo, setEdges, updateInteractionMode]
  );

  const onEdgeClick = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      markInputHandled('click', event.target, 'onEdgeClick', `edge:${edge.id}`);
      if (locked) return;
      if (!isRelationEdge(edge)) return;
      const isUser = !!edge.data?.userCreated;
      const currentState = edge.data?.flowState || 'forward';

      if (currentState === 'reversed' && isUser) {
        pushUndo();
        setEdges((prev: Edge[]) => (prev || []).filter((e: Edge) => e.id !== edge.id));
        toast.success(t('mindmap.connectionRemoved'), { duration: 1200 });
        return;
      }

      setEdges((prev: Edge[]) =>
        (prev || [])
          .map((e: Edge) => {
            if (e.id !== edge.id) return e;
            if (currentState === 'forward') {
              return {
                ...e,
                animated: false,
                style: { ...e.style, opacity: 0.8, strokeDasharray: '5 5' },
                data: { ...e.data, flowState: 'stopped' },
              };
            }
            if (currentState === 'stopped') {
              return {
                ...e,
                source: e.target,
                target: e.source,
                sourceHandle: e.targetHandle,
                targetHandle: e.sourceHandle,
                animated: true,
                style: { ...e.style, opacity: 0.7, strokeDasharray: undefined },
                data: { ...e.data, flowState: 'reversed' },
              };
            }
            if (currentState === 'reversed') {
              return {
                ...e,
                source: e.target,
                target: e.source,
                sourceHandle: e.targetHandle,
                targetHandle: e.sourceHandle,
                animated: true,
                style: { ...e.style, opacity: 0.6, strokeDasharray: undefined },
                data: { ...e.data, flowState: 'forward' },
              };
            }
            return e;
          })
          .filter(Boolean)
      );
    },
    [isPolish, locked, pushUndo, setEdges]
  );

  useEffect(() => {
    const handler = (e: Event) => {
      const { edgeId, isUserCreated, x, y } = (e as CustomEvent).detail;
      setContextMenu(null);
      setPaneContextMenu(null);
      setEdgeContextMenu({ edgeId, isUserCreated, x, y });
    };
    window.addEventListener('mindmap-edge-contextmenu', handler);
    return () => window.removeEventListener('mindmap-edge-contextmenu', handler);
  }, []);

  // handleEdgeContextAction USUNIĘTE (2026-08-09, rejestr akcji Z1/E02
  // rozszerzenie z Tablicy). Wszystkie 7 pozycji menu krawędzi (dawniej 6 tu +
  // „Kierunek strzałki" już wcześniej poza tą funkcją) idzie teraz przez
  // rejestr: `EdgeContextMenu.tsx` dispatchuje `runIdeaAction(...)`, realna
  // mutacja żyje w `useMindMapQuickActions.ts` (`mm_edge_*`), adresowana
  // `edgeId` — DOKŁADNIE jak „Kierunek strzałki" (`mm_edge_arrow`) już
  // działało od 2026-07-28. Menu samo zamyka się przez `CanvasContextMenu`
  // (`closeOnSelect` domyślnie true) — nie trzeba już `setEdgeContextMenu(null)`
  // z tego miejsca.

  const selectedBranchKey = useMemo(() => {
    const selected = nodes.find((n: any) => n?.selected);
    if (!selected) return 'options';
    if (selected.type === 'branch') return String((selected as any).data?.branchKey || 'options');
    if (selected.type === 'idea') return String((selected as any).data?.branchKey || 'options');
    return 'options';
  }, [nodes]);

  // ── Feature flags (DP-5: honest AI overlays) ─────────────────────────────
  const { isEnabled: isFeatureEnabled } = useFeatureFlagsContext();
  // Overlays whose displayed result is a client-side heuristic, not real LLM
  // output (AIBranchBalancer, AISentimentOverlay, AIAutoClustering,
  // AIDependencyDetector) — hidden until backed by real AI analysis.
  // See DEFAULT_FLAGS in useFeatureFlags for the honesty audit details.
  const heuristicAiOverlaysEnabled = isFeatureEnabled('mindmapHeuristicAiOverlays');
  // M06 Fala 4.1b: render the single canonical UnifiedNodeDetailDrawer instead of
  // the legacy NodeDetailDrawer. OFF (default) = today's separate drawer, no change.
  const drawerUnifiedEnabled = isFeatureEnabled('mindmapDrawerUnified');

  // ── Visual modes ─────────────────────────────────────────────────────────
  const [showClusterBubbles, setShowClusterBubbles] = useState(false);
  const [heatmapMode, setHeatmapMode] = useState(false);
  const [particleFlow, setParticleFlow] = useState(false);

  // ── P4 modals ───────────────────────────────────────────────────────────
  const [showBatchConvert, setShowBatchConvert] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showPresentation, setShowPresentation] = useState(false);
  const [showSnapshots, setShowSnapshots] = useState(false);

  // ── P6 modals ───────────────────────────────────────────────────────────
  const [showVoiceToNode, setShowVoiceToNode] = useState(false);
  const [showDocToMap, setShowDocToMap] = useState(false);
  const [showInterviewToMap, setShowInterviewToMap] = useState(false);

  // ── What-If Scenarios ────────────────────────────────────────────────────
  const [showWhatIf, setShowWhatIf] = useState(false);

  // ── R1: AI Deep Intelligence ──────────────────────────────────────────
  const [showDependencyDetector, setShowDependencyDetector] = useState(false);
  const [showPriorityRecommender, setShowPriorityRecommender] = useState(false);
  const [showAutoClustering, setShowAutoClustering] = useState(false);
  const [showSentimentOverlay, setShowSentimentOverlay] = useState(false);

  // ── Inline modals (replacing window.prompt) ─────────────────────────
  const [assignModalNodeId, setAssignModalNodeId] = useState<string | null>(null);
  const [attachArtifactNodeId, setAttachArtifactNodeId] = useState<string | null>(null);
  const [imageUrlNodeId, setImageUrlNodeId] = useState<string | null>(null);

  // ── R2: Collaboration ─────────────────────────────────────────────────
  const [commentNodeId, setCommentNodeId] = useState<string | null>(null);
  const [nodeComments, setNodeComments] = useState<Record<string, NodeComment[]>>({});
  const [showActivityFeed, setShowActivityFeed] = useState(false);

  useEffect(() => {
    if (commentNodeId && remoteLockedNodeIds.has(commentNodeId)) {
      setCommentNodeId(null);
    }
  }, [commentNodeId, remoteLockedNodeIds]);

  // ── R5: Analytics ─────────────────────────────────────────────────────
  const [showHealthScore, setShowHealthScore] = useState(true);

  /**
   * PANELE INFORMACYJNE DO PRAWEGO PANELU (2026-07-28, `ff_ideaPanel6Sections`).
   *
   * Zasada zaakceptowana przez właściciela: żaden panel INFORMACYJNY nie pływa
   * nad płótnem — mieszka w prawym panelu i daje się schować. (Sterowanie —
   * dolny pasek i mini-mapa — zostaje nad płótnem świadomie.)
   *
   * Mapa myśli wnosi do sekcji „AI" dwa panele:
   *   • Zdrowie mapy — rysuje je już `IdeaWorkspaceTools` (sekcja AI), więc tu
   *     tylko GASIMY overlay, żeby nie było dwóch kopii.
   *   • AI Blind Spots — mieszka w TYM komponencie (trzyma stan detekcji i
   *     handler „Dodaj"), więc portalujemy go do `IDEA_PANEL_AI_SLOT_ID`.
   *     Portal, a nie przeniesienie kodu: te same propsy, ten sam stan, zero
   *     prop-drillingu przez IdeaMapWorkspace — wzorzec 1:1 z panelem sesji
   *     Whiteboard (`WHITEBOARD_SESSION_PANEL_SLOT_ID`, 07-26).
   */
  const paneleWPrawymPanelu = isIdeaPanel6SectionsEnabled();
  const aiPanelSlot = usePortalSlot(paneleWPrawymPanelu ? IDEA_PANEL_AI_SLOT_ID : null);
  const [showFunnelAnalytics, setShowFunnelAnalytics] = useState(false);

  // ── R4: Export & Embed ──────────────────────────────────────────────
  const [showExportPPTX, setShowExportPPTX] = useState(false);
  const [showEmbedInReports, setShowEmbedInReports] = useState(false);

  // ── R1.2: Competitive Landscape ──────────────────────────────────────
  const [showCompetitiveLandscape, setShowCompetitiveLandscape] = useState(false);

  // ── R5.3: Branch Comparison ────────────────────────────────────────
  const [showBranchComparison, setShowBranchComparison] = useState(false);

  // ── R5.4: Time Heatmap ─────────────────────────────────────────────
  const [showTimeHeatmap, setShowTimeHeatmap] = useState(false);

  // ── R4.2: Export Diagram Code ──────────────────────────────────────
  const [showExportDiagramCode, setShowExportDiagramCode] = useState(false);

  // ── Export format menu (replacing window.prompt) ──────────────────
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  // ── R3.1+R3: Layout modes ──────────────────────────────────────────
  const [layoutMode, setLayoutMode] = useState<'tree' | 'radial' | 'force'>('tree');

  // ── R4.3: Import External Map ──────────────────────────────────────
  const [showImportExternalMap, setShowImportExternalMap] = useState(false);

  // ── R3.3: 3D Mind Map ──────────────────────────────────────────────
  const [showMindMap3D, setShowMindMap3D] = useState(false);

  // ── R4.5: Webhook Settings ─────────────────────────────────────────

  // ── Branch Summary Panel ──────────────────────────────────────────
  const [summaryPanelOpen, setSummaryPanelOpen] = useState(false);
  const [summaryBranchId, setSummaryBranchId] = useState('');
  const [summaryBranchLabel, setSummaryBranchLabel] = useState('');

  // ── Command palette ──────────────────────────────────────────────────────
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── AI expand ────────────────────────────────────────────────────────────
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiProposal, setAiProposal] = useState<AIMapProposal | null>(null);
  const [selectedAddIdx, setSelectedAddIdx] = useState<Record<number, boolean>>({});
  const [applySuggestedOrder, setApplySuggestedOrder] = useState(false);

  const closeAIModal = useCallback(() => {
    setShowAIModal(false);
    setAiProposal(null);
    setSelectedAddIdx({});
    setApplySuggestedOrder(false);
  }, []);

  const selectedAddCount = useMemo(() => {
    if (!aiProposal) return 0;
    return (aiProposal.add?.nodes || []).reduce(
      (sum, _n, idx) => sum + (selectedAddIdx[idx] ? 1 : 0),
      0
    );
  }, [aiProposal, selectedAddIdx]);

  const applyAIProposal = useCallback(
    async (overrideSelectedIdx?: Record<number, boolean>) => {
      if (!aiProposal) return;
      if (locked) {
        toast(t('mindmap.acceptTheChallengeFirst') as any);
        return;
      }
      const effectiveIdx = overrideSelectedIdx ?? selectedAddIdx;
      const toAddNodes = (aiProposal.add?.nodes || []).filter((_n, idx) => effectiveIdx[idx]);
      const toAddEdges = aiProposal.add?.edges || [];

      if (toAddNodes.length === 0) {
        toast(t('mindmap.noSelectedChanges') as any);
        return;
      }

      pushUndo();
      setSaving(true);
      try {
        const aiSummaryBySource = new Map<string, string[]>();
        for (const edge of toAddEdges as any[]) {
          const targetNode = toAddNodes.find((node: any) => node.id === edge.target);
          if (!edge?.source || !targetNode?.data?.label) continue;
          aiSummaryBySource.set(edge.source, [
            ...(aiSummaryBySource.get(edge.source) || []),
            String(targetNode.data.label),
          ]);
        }
        const nextNodes = (() => {
          const byId = new Map<string, Node>();
          for (const n of nodes as any) byId.set(String((n as any)?.id), n as any);
          for (const n of toAddNodes as any) byId.set(String((n as any)?.id), n as any);
          for (const [sourceId, labels] of aiSummaryBySource.entries()) {
            const existing = byId.get(String(sourceId));
            if (!existing) continue;
            byId.set(String(sourceId), {
              ...existing,
              data: {
                ...(existing.data || {}),
                aiExpansionHistory: appendAIHistoryEntry(existing.data?.aiExpansionHistory as any, {
                  timestamp: new Date().toISOString(),
                  prompt: t('mindmap.aiExpandBranch'),
                  resultSummary: labels.join(', '),
                }),
              },
            } as Node);
          }
          return Array.from(byId.values());
        })();
        const nextEdges = (() => {
          const byId = new Map<string, Edge>();
          for (const e of edges as any) byId.set(String((e as any)?.id), e as any);
          for (const e of toAddEdges as any) byId.set(String((e as any)?.id), e as any);
          return Array.from(byId.values());
        })();

        setNodes(nextNodes as any);
        setEdges(nextEdges as any);

        if (externalRuntime) {
          externalRuntime.captureGraph(
            {
              nodes: nextNodes as any,
              edges: nextEdges as any,
              extensions: extensions || undefined,
            },
            { reason: 'ai', immediate: true }
          );
          await externalRuntime.flushGraph({ reason: 'ai' });
        } else if (persistence === 'online') {
          const response = await Api.syncMyIdeaMap(ideaId, {
            nodes: nextNodes as any,
            edges: nextEdges as any,
            preferredTool: preferredTool || undefined,
            extensions: extensions || undefined,
            fromAI: true,
            baseVersion: localVersionRef.current,
            reason: 'ai',
          });
          localVersionRef.current = Math.max(
            1,
            Number(response?.version || localVersionRef.current || 1)
          );
          setLastSavedAt(Date.now());
        }

        toast.success(t('mindmap.appliedAiProposalsCount', { count: toAddNodes.length }), {
          duration: 1200,
        });
        closeAIModal();
      } catch (err: any) {
        if (err?.status === 409) {
          toast(t('mindmap.changeConflictDetectedRefreshingMapFrom'), { icon: '⚠️' });
          closeAIModal();
        } else {
          toast.error(err?.message || t('mindmap.failedToApplyProposals'));
        }
      } finally {
        setSaving(false);
      }
    },
    [
      aiProposal,
      closeAIModal,
      edges,
      extensions,
      ideaId,
      isPolish,
      localVersionRef,
      locked,
      nodes,
      persistence,
      preferredTool,
      pushUndo,
      selectedAddIdx,
      setEdges,
      setNodes,
    ]
  );

  const handleAIExpand = useCallback(
    async (targetNodeId?: string) => {
      if (locked) {
        toast(t('mindmap.acceptTheChallengeFirst') as any);
        return;
      }
      if (persistence !== 'online') {
        toast(t('mindmap.aiRequiresBackend') as any);
        return;
      }
      if (targetNodeId && !nodes.find((n: any) => n?.id === targetNodeId)) {
        // CB-05/decyzja 5: jawny node target, którego nie ma na płótnie, musi
        // zostać jawnie odrzucony — nigdy po cichu nie spada na
        // zaznaczenie/root.
        toast.error(t('mindmap.aiExpandTargetNodeMissing') as any);
        return;
      }
      setSaving(true);
      try {
        const anchor = targetNodeId
          ? nodes.find((n: any) => n?.id === targetNodeId)
          : nodes.find((n: any) => n?.selected) || nodes.find((n: any) => String(n?.id) === 'root');
        const anchorLabel = anchor?.data?.label || '';
        const anchorBranch = anchor?.data?.branchKey || selectedBranchKey;

        // Gather ancestor context for node-specific generation (structural tree only)
        const ancestorLabels: string[] = [];
        if (anchor && anchor.id !== 'root') {
          let currentId = anchor.id;
          for (let depth = 0; depth < 5; depth++) {
            const parentEdge = edges.find((e) => e.target === currentId && isStructuralEdge(e));
            if (!parentEdge) break;
            const parentNode = nodes.find((n) => n.id === parentEdge.source);
            if (parentNode?.data?.label) ancestorLabels.unshift(parentNode.data.label);
            currentId = parentEdge.source;
          }
        }

        const res = await Api.expandMyIdeaMap(ideaId, {
          anchorNodeId: String(anchor?.id || 'root'),
          branchKey: anchorBranch,
          count: 5,
          language: i18n.language,
          proposeOnly: true,
          context: anchorLabel
            ? `Node: "${anchorLabel}"${ancestorLabels.length > 0 ? ` | Path: ${ancestorLabels.join(' → ')} → ${anchorLabel}` : ''}`
            : undefined,
        });
        const proposedNodes = (() => {
          if (Array.isArray(res?.proposal?.add?.nodes)) return res.proposal.add.nodes;
          if (Array.isArray(res?.proposal?.add)) return res.proposal.add;
          return [];
        })();
        const proposedEdges = (() => {
          if (Array.isArray(res?.proposal?.add?.edges)) return res.proposal.add.edges;
          if (Array.isArray(res?.proposal?.edges)) return res.proposal.edges;
          return [];
        })();
        if (!proposedNodes.length) {
          toast(t('mindmap.noNewSuggestions') as any);
          return;
        }

        setAiProposal({
          add: { nodes: proposedNodes, edges: proposedEdges },
          remove: { nodeIds: [], edgeIds: [] },
          reorder: null,
          rationale: null,
        });
        setSelectedAddIdx(
          Object.fromEntries(proposedNodes.map((_: any, idx: number) => [idx, true])) as Record<
            number,
            boolean
          >
        );
        setApplySuggestedOrder(false);
        setShowAIModal(true);
      } catch (err: any) {
        toast.error(err?.message || t('mindmap.aiFailed'));
      } finally {
        setSaving(false);
      }
    },
    [edges, i18n.language, ideaId, isPolish, locked, nodes, persistence, selectedBranchKey]
  );

  // N5 druga fala (2026-08-09) — see the `handlers.detachBranch`/
  // `duplicateBranch` comment below for why these are refs, not direct
  // function values.
  const detachBranchRef = useRef<((nodeId?: string) => void) | undefined>(undefined);
  const duplicateBranchRef = useRef<((nodeId?: string) => void) | undefined>(undefined);
  // N5 trzecia fala (2026-08-09) — same TDZ reason as the two refs above:
  // `convertBranch` (Convert/Convert-branch groups) is declared later in this
  // component too.
  const convertBranchRef = useRef<((target: string, nodeId?: string) => void) | undefined>(
    undefined
  );
  // E11 fix (2026-08-10) — same TDZ reason: `convertSingleNode` is declared
  // later in this component (next to `convertBranch`).
  const convertSingleNodeRef = useRef<((target: string, nodeId?: string) => void) | undefined>(
    undefined
  );

  // ── Quick action listener (extracted to useMindMapQuickActions) ──────────
  useMindMapQuickActions({
    ideaId,
    ideaTitle,
    isPolish,
    locked,
    nodes,
    edges,
    layoutMode,
    structureType,
    extensions,
    handlers: {
      addChildNode,
      addSiblingNode,
      addRootTopic,
      duplicateSelected,
      deleteSelected,
      // N5 druga fala (2026-08-09) — NodeContextMenu.tsx Structure group
      // (`idea.node.mm_detach_branch`/`idea.node.mm_duplicate_branch`).
      // Functions already existed (V5-IDEA-17) but are declared LATER in this
      // component (after `getContextTargetNode`/`collectDescendants`, which
      // this `useMindMapQuickActions(...)` call precedes) — a direct
      // reference here would be a TDZ error. Forwarded through a ref instead
      // of reordering ~100 lines of this already-large component; the ref is
      // populated synchronously right after the real functions are defined
      // (see `detachBranchRef.current = detachBranch;` below), well before
      // any click could invoke it.
      detachBranch: (nodeId?: string) => detachBranchRef.current?.(nodeId),
      duplicateBranch: (nodeId?: string) => duplicateBranchRef.current?.(nodeId),
      // N5 trzecia fala (2026-08-09) — `idea.node.mm_convert_branch_*`.
      convertBranch: (target: string, nodeId?: string) =>
        convertBranchRef.current?.(target, nodeId),
      // E11 fix (2026-08-10) — `idea.node.mm_convert_initiative`/`_decision`/
      // `_tasks` (single_item, no cascade).
      convertSingleNode: (target: string, nodeId?: string) =>
        convertSingleNodeRef.current?.(target, nodeId),
      getSelectedNode,
      toggleCollapse,
      setFoldLevel,
      focusSelectedNode,
      reparentSelectedPromote,
      reparentSelectedDemote,
      pushUndo,
      undo,
      redo: redo,
      handleAIExpand,
      autoLayout,
      fitView,
      exportAsSVG,
      exportAsPNG,
      exportAsJSON,
      exportAsMarkdown,
      onOpenChat,
    },
    setters: {
      setNodes,
      setEdges,
      setInteractionMode: updateInteractionMode,
      setLayoutMode,
      setShowClusterBubbles,
      setHeatmapMode,
      setParticleFlow,
      setShowWhatIf,
      setShowBatchConvert,
      setShowTimeline,
      setShowPresentation,
      setShowSnapshots,
      setShowVoiceToNode,
      setShowDocToMap,
      setShowInterviewToMap,
      setShowDependencyDetector,
      setShowPriorityRecommender,
      setShowAutoClustering,
      setShowSentimentOverlay,
      setShowActivityFeed,
      setShowHealthScore,
      setShowFunnelAnalytics,
      setShowExportPPTX,
      setShowEmbedInReports,
      setShowCompetitiveLandscape,
      setShowBranchComparison,
      setShowTimeHeatmap,
      setShowExportDiagramCode,
      setShowImportExternalMap,
      setShowMindMap3D,
      setCommentNodeId,
      setExportMenuOpen,
      setShowMiniMap,
      setStructureType,
      setShowStructurePicker,
    },
  });

  // ── Node click / context menu ────────────────────────────────────────────
  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      try {
        markInputHandled('click', event.target, 'onNodeClick', `id=${node.id} type=${node.type}`);
        window.setTimeout(() => containerRef.current?.focus(), 0);
        if (isNodeLockedByPeer(node.id)) {
          debugLog(`NODE_CLICK_BLOCKED locked node=${node.id}`, {
            source: 'handler',
            reaction: 'blocked',
            severity: 'warn',
          });
          notifyLockedNode();
          return;
        }
        setNodes((prev: Node[]) => {
          let hasChanges = false;
          const next = prev.map((candidate) => {
            const shouldSelect = candidate.id === node.id;
            if (Boolean(candidate.selected) === shouldSelect) return candidate;
            hasChanges = true;
            return { ...candidate, selected: shouldSelect };
          });
          return hasChanges ? next : prev;
        });
        if (node.type === 'center') {
          debugLog(`NODE_CLICK_ACTION center -> onCenterEdit`, { source: 'handler' });
          onCenterEdit?.();
        }
        if (node.type === 'branch') {
          debugLog(`NODE_CLICK_ACTION branch -> selectOnly`, { source: 'handler' });
        }
        if (node.type === 'idea') {
          debugLog(`NODE_CLICK_NOOP idea node=${node.id}`, {
            source: 'handler',
            reaction: 'silent',
            severity: 'warn',
          });
        }
        debugLog(`onNodeClick DONE`, { source: 'handler', detail: node.id });
      } catch (err: any) {
        debugLog(`ERROR in onNodeClick: ${err?.message || err}`, {
          source: 'error',
          severity: 'error',
        });
        console.error('[MindMap Debug] onNodeClick error:', err);
      }
    },
    [debugLog, isNodeLockedByPeer, markInputHandled, notifyLockedNode, onCenterEdit, toggleCollapse]
  );

  const onNodeDoubleClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      try {
        markInputHandled(
          'dblclick',
          event.target,
          'onNodeDoubleClick',
          `id=${node.id} type=${node.type}`
        );
        if (isNodeLockedByPeer(node.id)) {
          debugLog(`NODE_DOUBLE_CLICK_BLOCKED locked node=${node.id}`, {
            source: 'handler',
            reaction: 'blocked',
            severity: 'warn',
          });
          notifyLockedNode();
          return;
        }
        if (node.type === 'idea') {
          debugLog(`NODE_DOUBLE_CLICK_ACTION openDrawer ${node.id}`, { source: 'handler' });
          setDrawerNodeId(node.id);
        }
        if (node.type === 'branch') {
          debugLog(`NODE_DOUBLE_CLICK_ACTION branch -> toggleCollapse`, { source: 'handler' });
          toggleCollapse(node.id);
        }
        debugLog(`onNodeDoubleClick DONE`, { source: 'handler', detail: node.id });
      } catch (err: any) {
        debugLog(`ERROR in onNodeDoubleClick: ${err?.message || err}`, {
          source: 'error',
          severity: 'error',
        });
        console.error('[MindMap Debug] onNodeDoubleClick error:', err);
      }
    },
    [debugLog, isNodeLockedByPeer, markInputHandled, notifyLockedNode]
  );

  const preContextMenuSelectionRef = useRef<string[]>([]);

  const onNodeContextMenu = useCallback(
    (e: React.MouseEvent, node: Node) => {
      markInputHandled(
        'contextmenu',
        e.target,
        'onNodeContextMenu',
        `id=${node.id} type=${node.type}`
      );
      e.preventDefault();
      setPaneContextMenu(null);
      setEdgeContextMenu(null);
      if (isNodeLockedByPeer(node.id)) {
        debugLog(`NODE_CONTEXT_MENU_BLOCKED locked node=${node.id}`, {
          source: 'handler',
          reaction: 'blocked',
          severity: 'warn',
        });
        notifyLockedNode();
        return;
      }
      preContextMenuSelectionRef.current = (nodes as Node[])
        .filter((n) => n.selected)
        .map((n) => n.id);
      setNodes((prev: Node[]) =>
        prev.map((candidate) => ({ ...candidate, selected: candidate.id === node.id }))
      );
      setContextMenu({
        nodeId: node.id,
        nodeType: node.type || 'idea',
        x: e.clientX,
        y: e.clientY,
      });
    },
    [isNodeLockedByPeer, markInputHandled, nodes, notifyLockedNode, setNodes]
  );

  const onPaneContextMenu = useCallback(
    (e: React.MouseEvent) => {
      markInputHandled('contextmenu', e.target, 'onPaneContextMenu');
      e.preventDefault();
      setContextMenu(null);
      setEdgeContextMenu(null);
      const reactFlowBounds = containerRef.current?.getBoundingClientRect();
      const viewport = getViewport();
      const canvasX = reactFlowBounds
        ? (e.clientX - reactFlowBounds.left - viewport.x) / viewport.zoom
        : 0;
      const canvasY = reactFlowBounds
        ? (e.clientY - reactFlowBounds.top - viewport.y) / viewport.zoom
        : 0;
      setPaneContextMenu({
        x: e.clientX,
        y: e.clientY,
        canvasX,
        canvasY,
      });
    },
    [getViewport, markInputHandled]
  );

  const onPaneClick = useCallback(
    (event: React.MouseEvent) => {
      markInputHandled('click', event.target, 'onPaneClick');
      if (interactionMode === 'connect') {
        updateInteractionMode('select');
      }
      window.setTimeout(() => containerRef.current?.focus(), 0);
      debugLog('PANE_CLICK', { source: 'handler' });
    },
    [debugLog, interactionMode, markInputHandled, updateInteractionMode]
  );

  // V5-IDEA-17: Helper to get the context-menu target node (right-clicked) or fallback to selected
  const getContextTargetNode = useCallback(() => {
    if (contextMenu?.nodeId) {
      return (nodes as Node[]).find((n) => n.id === contextMenu.nodeId) || getSelectedNode();
    }
    return getSelectedNode();
  }, [contextMenu, getSelectedNode, nodes]);

  // V5-IDEA-17: Collect all descendants of a node (for branch operations)
  const collectDescendants = useCallback(
    (nodeId: string): string[] => {
      return collectDescendantIds(nodeId, edges as Edge[]);
    },
    [edges]
  );

  // V5-IDEA-17: Detach branch — disconnect node from parent, make it a root-level node
  const detachBranch = useCallback(
    (nodeId?: string) => {
      const targetId = nodeId || getContextTargetNode()?.id;
      if (!targetId) return;
      // HONEST FIX (2026-08-09, N5 druga fala — rejestr akcji
      // `idea.node.mm_detach_branch`): znalezione przy wiringu, nie
      // wprowadzone tym wpisem — ta mutacja NIGDY nie wołała pushUndo(), więc
      // Ctrl+Z jej nie cofał (w przeciwieństwie do sąsiednich operacji na
      // węzłach, które pushUndo już miały). Naprawione tutaj, tak samo jak
      // przy 3 pozycjach menu krawędzi w poprzedniej fali.
      pushUndo();
      setEdges((prev: Edge[]) => prev.filter((e) => e.target !== targetId));
      toast.success(t('mindmap.branchDetached'), { duration: 800 });
    },
    [getContextTargetNode, isPolish, pushUndo, setEdges]
  );
  detachBranchRef.current = detachBranch;

  // V5-IDEA-17: Duplicate branch — clone node + all descendants
  const duplicateBranch = useCallback(
    (nodeId?: string) => {
      const targetId = nodeId || getContextTargetNode()?.id;
      if (!targetId) return;
      // HONEST FIX (2026-08-09, N5 druga fala — rejestr akcji
      // `idea.node.mm_duplicate_branch`): tak samo jak `detachBranch` powyżej,
      // ta mutacja nigdy nie wołała pushUndo(). Naprawione tutaj.
      pushUndo();
      const descendants = collectDescendants(targetId);
      const allIds = [targetId, ...descendants];
      const idMap = new Map<string, string>();
      for (const id of allIds) {
        idMap.set(id, `${id}-dup-${Date.now()}`);
      }

      const newNodes: Node[] = [];
      for (const id of allIds) {
        const orig = (nodes as Node[]).find((n) => n.id === id);
        if (!orig) continue;
        newNodes.push({
          ...orig,
          id: idMap.get(id)!,
          position: { x: orig.position.x + 60, y: orig.position.y + 40 },
          selected: false,
          data: { ...orig.data },
        });
      }

      const newEdges: Edge[] = [];
      for (const e of edges as Edge[]) {
        if (idMap.has(e.source) && idMap.has(e.target)) {
          newEdges.push({
            ...e,
            id: `${e.id}-dup-${Date.now()}`,
            source: idMap.get(e.source)!,
            target: idMap.get(e.target)!,
          });
        }
      }

      // Connect duplicate root to the same structural parent as original
      const parentEdge = (edges as Edge[]).find(
        (e) => e.target === targetId && isStructuralEdge(e)
      );
      if (parentEdge) {
        newEdges.push({
          ...parentEdge,
          id: `e-dup-root-${Date.now()}`,
          target: idMap.get(targetId)!,
        });
      }

      setNodes((prev: Node[]) => [...prev, ...newNodes]);
      setEdges((prev: Edge[]) => [...prev, ...newEdges]);
      toast.success(t('mindmap.duplicatedBranchCount', { count: newNodes.length }), {
        duration: 1000,
      });
    },
    [collectDescendants, edges, getContextTargetNode, isPolish, nodes, pushUndo, setEdges, setNodes]
  );
  duplicateBranchRef.current = duplicateBranch;

  // V5-IDEA-17: Summarize branch — send to AI chat
  const summarizeBranch = useCallback(
    (nodeId?: string) => {
      const targetId = nodeId || getContextTargetNode()?.id;
      if (!targetId) return;
      const target = (nodes as Node[]).find((n) => n.id === targetId);
      const descendants = collectDescendants(targetId);
      const branchLabels = [targetId, ...descendants]
        .map((id) => (nodes as Node[]).find((n) => n.id === id)?.data?.label)
        .filter(Boolean);

      const prompt = t('mindmap.summarizeBranchPrompt', {
        label: target?.data?.label || targetId,
        branchList: branchLabels.map((l) => `- ${l}`).join('\n'),
      });

      window.dispatchEvent(
        new CustomEvent('idea-workspace-chat-prompt', { detail: { prompt, ideaId } })
      );
    },
    [collectDescendants, getContextTargetNode, ideaId, isPolish, nodes]
  );

  const convertBranch = useCallback(
    (target: string, nodeId?: string) => {
      const targetNodeId = nodeId || getContextTargetNode()?.id;
      if (!targetNodeId) return;
      const descendants = collectDescendants(targetNodeId);
      const branchNodeIds = [targetNodeId, ...descendants];

      const actionMap: Record<string, string> = {
        initiative: 'convert_initiative',
        decision: 'convert_decision',
        task_set: 'convert_task_set',
        report: 'convert_report',
        presentation: 'convert_presentation',
      };
      const action = actionMap[target] || `convert_${target}`;
      // E11 fix (2026-08-10): this used to fire a `toast.success("Converting
      // branch to…")` immediately on click, before anything was actually
      // converted — a premature-success pattern. The receiver now opens a
      // mandatory preview (IdeaMapWorkspace.handleConvert); the real success/
      // error toast fires only after the user confirms and the server call
      // resolves, so no toast belongs here.
      window.dispatchEvent(
        new CustomEvent('idea-workspace-quick-action', {
          detail: { action, nodeIds: branchNodeIds, ideaId, scope: 'single_item_cascade' },
        })
      );
    },
    [collectDescendants, getContextTargetNode, ideaId]
  );
  // N5 trzecia fala (2026-08-09) — see `detachBranchRef.current = detachBranch;`
  // above for why this is a ref assignment, not a direct handler value.
  convertBranchRef.current = convertBranch;

  // E11 fix (2026-08-10, docs/standards/idea-workspace/10_*, §2.1 „Element"):
  // the plain "Convert" node-menu items (ctx_convert_initiative/decision/tasks)
  // used to be wired to `convertBranch` — same function as "Convert branch" —
  // so a single-node label silently cascaded to every descendant
  // (E02-N5-CONVERT honesty finding). This is the real single-item version:
  // exactly one nodeId, never descendants.
  const convertSingleNode = useCallback(
    (target: string, nodeId?: string) => {
      const targetNodeId = nodeId || getContextTargetNode()?.id;
      if (!targetNodeId) return;

      const actionMap: Record<string, string> = {
        initiative: 'convert_initiative',
        decision: 'convert_decision',
        task_set: 'convert_task_set',
        report: 'convert_report',
        presentation: 'convert_presentation',
      };
      const action = actionMap[target] || `convert_${target}`;
      window.dispatchEvent(
        new CustomEvent('idea-workspace-quick-action', {
          detail: { action, nodeIds: [targetNodeId], ideaId, scope: 'single_item' },
        })
      );
    },
    [getContextTargetNode, ideaId]
  );
  // ref declared earlier (near convertBranchRef) for the same TDZ reason.
  convertSingleNodeRef.current = convertSingleNode;

  const handleContextAction = useCallback(
    (action: string) => {
      debugLog(`handleContextAction: "${action}"`);
      console.log('[MindMap] handleContextAction:', action);
      const ctxNode = getContextTargetNode();
      console.log('[MindMap] ctxNode:', ctxNode?.id, ctxNode?.type);
      const updateNodeData = (nodeId: string, updater: (data: any) => any) => {
        setNodes((prev: Node[]) =>
          prev.map((node) =>
            node.id === nodeId ? { ...node, data: updater(node.data || {}) } : node
          )
        );
      };

      if (action === 'ctx_edit') startEditingSelected();
      if (action === 'ctx_open_detail') {
        if (ctxNode && ctxNode.type === 'idea') setDrawerNodeId(ctxNode.id);
      }
      if (action === 'ctx_toggle_collapse' && ctxNode) toggleCollapse(ctxNode.id);
      if (action === 'ctx_focus_subtree' && ctxNode) handleDrillDown(ctxNode.id);
      if (action === 'ctx_drill_down') {
        if (ctxNode) handleDrillDown(ctxNode.id);
      }
      if (action === 'ctx_add_child') addChildNode(ctxNode?.id);
      if (action === 'ctx_add_sibling') addSiblingNode(ctxNode?.id);
      if (action === 'ctx_ai_expand' || action === 'ctx_ai_deepen') {
        handleAIExpand(ctxNode?.id);
      }
      if (action === 'ctx_ai_rewrite_node' && ctxNode) {
        // J26 (channel 2): direct node rewrite via the Propose→Accept path.
        window.dispatchEvent(
          new CustomEvent('idea-mindmap-rewrite-node', {
            detail: {
              ideaId,
              nodeId: ctxNode.id,
              nodeLabel: String(ctxNode.data?.label || ''),
            },
          })
        );
      }
      if (action === 'ctx_what_if') setShowWhatIf(true);
      if (action === 'ctx_vote_up') {
        if (ctxNode && ctxNode.type === 'idea') {
          const currentVotes = ctxNode.data?.votes ?? 0;
          const newVotes = currentVotes >= 5 ? 0 : currentVotes + 1;
          updateNodeData(ctxNode.id, (data) => ({ ...data, votes: newVotes }));
        }
      }
      if (action === 'ctx_assign') {
        if (ctxNode && ctxNode.type === 'idea') {
          setAssignModalNodeId(ctxNode.id);
        }
      }
      if (action === 'ctx_comments') {
        if (ctxNode && ctxNode.type === 'idea') setCommentNodeId(ctxNode.id);
      }
      if (action === 'ctx_quick_notes' || action === 'ctx_quick_tags') {
        if (ctxNode && ctxNode.type === 'idea') setDrawerNodeId(ctxNode.id);
      }
      if (action === 'ctx_attach_knowledge') {
        if (ctxNode) {
          window.dispatchEvent(
            new CustomEvent('idea-workspace-attach-knowledge', {
              detail: { nodeId: ctxNode.id, ideaId },
            })
          );
        }
      }
      if (action === 'ctx_attach_artifact' && ctxNode) {
        setAttachArtifactNodeId(ctxNode.id);
      }
      if (action === 'ctx_open_linked_artifacts' && ctxNode) {
        const links = Array.isArray(ctxNode.data?.artifactLinks) ? ctxNode.data.artifactLinks : [];
        if (links.length === 0) {
          toast(t('mindmap.thisNodeHasNoLinkedArtifacts'));
        } else if (links.length === 1) {
          const link = links[0];
          window.dispatchEvent(
            new CustomEvent('mywork-open-item', {
              detail: artifactLinkToOpenPayload(link),
            })
          );
        } else {
          setDrawerNodeId(ctxNode.id);
        }
      }
      // E10 (2026-08-10): ctx_dependencies/ctx_priority/ctx_competitive MOVED
      // to handlePaneContextAction (pane_dependencies/pane_priority/
      // pane_competitive below) — see NodeContextMenu.tsx header comment.
      // These three generators take the whole map regardless of which node
      // was clicked, so they no longer live in this per-node handler.
      if (action === 'ctx_change_shape') {
        if (ctxNode && ctxNode.type === 'idea') {
          const shapes = ['default', 'circle', 'diamond', 'hexagon'];
          const current = ctxNode.data?.shape || 'default';
          const nextIdx = (shapes.indexOf(current) + 1) % shapes.length;
          updateNodeData(ctxNode.id, (data) => ({ ...data, shape: shapes[nextIdx] }));
          toast.success(
            t('myWork.ideaMap.toast.shapeChanged', 'Shape: {{shape}}', { shape: shapes[nextIdx] }),
            { duration: 800 }
          );
        }
      }
      if (action === 'ctx_connect_to_selected' && ctxNode) {
        const priorIds = preContextMenuSelectionRef.current;
        const peerId = priorIds.find((id) => id !== ctxNode.id);
        const peer = peerId ? nodes.find((n) => n.id === peerId) : undefined;
        if (!peer) {
          toast(t('mindmap.selectAnotherNodeToCreateA'));
        } else {
          // HONEST FIX (2026-08-09, N5 druga fala — rejestr akcji
          // `idea.node.mm_connect_to_selected`): znalezione przy wiringu, ta
          // mutacja nigdy nie wołała pushUndo() — naprawione tutaj, tak samo
          // jak `detachBranch`/`duplicateBranch` powyżej.
          pushUndo();
          setEdges((prev: Edge[]) => [
            ...prev,
            {
              id: `edge-${uid()}`,
              source: ctxNode.id,
              target: peer.id,
              type: 'labeled',
              data: { userCreated: true, edgeRole: 'relation', relation: 'related' },
            } as Edge,
          ]);
        }
      }
      // V5-IDEA-17: New branch operations
      if (action === 'ctx_detach_branch') detachBranch(ctxNode?.id);
      if (action === 'ctx_duplicate_branch') duplicateBranch(ctxNode?.id);
      if (action === 'ctx_summarize_branch') summarizeBranch(ctxNode?.id);
      // E11 fix (2026-08-10): these are the plain, non-"branch" Convert items
      // (single_item scope per docs/standards/idea-workspace/10_*, §2.1) — they
      // must convert ONLY the right-clicked node, never its descendants. Prior
      // code routed them through convertBranch() (identical to the "Convert
      // branch" items below), which silently cascaded despite the label.
      if (action === 'ctx_convert_tasks') convertSingleNode('task_set', ctxNode?.id);
      if (action === 'ctx_convert_initiative') convertSingleNode('initiative', ctxNode?.id);
      if (action === 'ctx_convert_decision') convertSingleNode('decision', ctxNode?.id);
      // MM-15: Subtree conversion actions
      if (action === 'ctx_subtree_convert_decision') convertBranch('decision', ctxNode?.id);
      if (action === 'ctx_subtree_convert_tasks') convertBranch('task_set', ctxNode?.id);
      if (action === 'ctx_subtree_convert_task_set') convertBranch('task_set', ctxNode?.id);
      if (action === 'ctx_subtree_convert_initiative') convertBranch('initiative', ctxNode?.id);
      if (action === 'ctx_subtree_convert_process_flow') {
        // H2.3 fix: route through convertBranch (like every other subtree
        // conversion) so the branch's nodes/edges are actually transformed
        // into Process Flow, instead of just switching the active tool with
        // nothing carried over.
        convertBranch('process_flow', ctxNode?.id);
      }
      if (action === 'ctx_add_image') {
        if (ctxNode && ctxNode.type === 'idea') {
          setImageUrlNodeId(ctxNode.id);
        }
      }
      if (action === 'ctx_copy_style' && ctxNode) {
        setStyleClipboard(copyNodeStyle(ctxNode));
        toast.success(t('mindmap.styleCopied'), { duration: 800 });
      }
      if (action === 'ctx_paste_style' && ctxNode && styleClipboard) {
        setNodes((prev: Node[]) =>
          prev.map((node) => (node.id === ctxNode.id ? applyNodeStyle(node, styleClipboard) : node))
        );
      }
      if (action === 'ctx_share_branch') {
        if (ctxNode) {
          const url = `${window.location.origin}${window.location.pathname}?focusNode=${ctxNode.id}`;
          navigator.clipboard
            .writeText(url)
            .then(() => {
              toast.success(t('mindmap.linkCopied'), { duration: 1200 });
            })
            .catch(() => {
              window.prompt(t('mindmap.copyLink'), url);
            });
        }
      }
      if (action === 'ctx_duplicate') duplicateSelected();
      if (action === 'ctx_copy_nodes') copySelected();
      if (action === 'ctx_cut_nodes') cutSelected();
      if (action === 'ctx_paste_nodes') pasteNodes();
      if (action === 'ctx_delete') deleteSelected();
    },
    [
      addChildNode,
      addSiblingNode,
      convertBranch,
      copySelected,
      cutSelected,
      deleteSelected,
      detachBranch,
      duplicateBranch,
      duplicateSelected,
      getContextTargetNode,
      getSelectedNode,
      handleAIExpand,
      handleDrillDown,
      isPolish,
      ideaId,
      nodes,
      pasteNodes,
      pushUndo,
      setEdges,
      setNodes,
      styleClipboard,
      startEditingSelected,
      summarizeBranch,
      toggleCollapse,
    ]
  );

  const handlePaneContextAction = useCallback(
    (action: string) => {
      const pos = paneContextMenu
        ? { x: paneContextMenu.canvasX, y: paneContextMenu.canvasY }
        : { x: 0, y: 0 };

      if (action === 'pane_add_node') {
        const newId = `node-${uid()}`;
        const newNode: Node = {
          id: newId,
          type: 'idea',
          position: pos,
          data: {
            label: '',
            branchKey: 'uncategorized',
            sourceType: 'manual',
            priority: 50,
            _startEditing: Date.now(),
          },
        } as any;
        const rootEdge: Edge = {
          id: `edge-${uid()}`,
          source: 'root',
          target: newId,
          type: 'gradient',
          style: { stroke: 'var(--c-tag-8)', strokeWidth: 1.5, opacity: 0.5 },
          animated: true,
          data: { userCreated: true, edgeRole: 'structural' },
        } as any;
        pushUndo();
        setNodes((prev: Node[]) => [
          ...prev.map((n) => ({ ...n, selected: false })),
          { ...newNode, selected: true },
        ]);
        setEdges((prev: Edge[]) => [...prev, rootEdge]);
      }

      if (action === 'pane_add_topic') {
        const newId = `node-${uid()}`;
        const newNode: Node = {
          id: newId,
          type: 'idea',
          position: pos,
          data: {
            label: t('mindmap.newTopic'),
            branchKey: 'uncategorized',
            sourceType: 'manual',
            priority: 50,
            semanticType: 'topic',
            _startEditing: Date.now(),
          },
        } as any;
        const rootEdge: Edge = {
          id: `edge-${uid()}`,
          source: 'root',
          target: newId,
          type: 'gradient',
          style: { stroke: 'var(--c-tag-8)', strokeWidth: 1.5, opacity: 0.5 },
          animated: true,
          data: { userCreated: true, edgeRole: 'structural' },
        } as any;
        pushUndo();
        setNodes((prev: Node[]) => [
          ...prev.map((n) => ({ ...n, selected: false })),
          { ...newNode, selected: true },
        ]);
        setEdges((prev: Edge[]) => [...prev, rootEdge]);
      }

      if (action === 'pane_copy') copySelected();
      if (action === 'pane_cut') cutSelected();
      if (action === 'pane_paste')
        pasteNodes(
          paneContextMenu ? { x: paneContextMenu.canvasX, y: paneContextMenu.canvasY } : undefined
        );

      if (action === 'pane_undo') undo();
      if (action === 'pane_redo') redo();

      if (action === 'pane_select_all') {
        setNodes((prev: Node[]) => prev.map((n) => ({ ...n, selected: true })));
      }

      if (action === 'pane_collapse_all') {
        setFoldLevel(0);
        toast.success(t('mindmap.showingLevel0'), { duration: 1200 });
      }

      if (action === 'pane_expand_all') {
        setFoldLevel(Infinity);
        toast.success(t('mindmap.allExpanded'), { duration: 1200 });
      }

      if (action === 'pane_fold_1') {
        setFoldLevel(1);
        toast.success(t('mindmap.showingLevel1'), { duration: 1200 });
      }
      if (action === 'pane_fold_2') {
        setFoldLevel(2);
        toast.success(t('mindmap.showingLevel2'), { duration: 1200 });
      }

      if (action === 'pane_auto_layout') {
        const laid = autoLayout(nodes as Node[], edges as Edge[]);
        setNodes(laid);
        setTimeout(() => {
          try {
            fitView({ padding: 0.3, duration: 300, jawne: true });
          } catch {
            /* */
          }
        }, 50);
      }

      if (action === 'pane_fit_view') {
        try {
          fitView({ padding: 0.3, duration: 300, jawne: true });
        } catch {
          /* */
        }
      }

      if (action === 'pane_center_root') {
        const rootNode = (nodes as Node[]).find((n) => n.id === 'root');
        if (rootNode) {
          try {
            fitView({ nodes: [{ id: 'root' } as any], padding: 0.5, duration: 400 });
          } catch {
            /* */
          }
        }
      }

      if (action === 'pane_zoom_in') {
        const vp = getViewport();
        setViewport({ ...vp, zoom: Math.min(vp.zoom * 1.3, 4) }, { duration: 200 });
      }

      if (action === 'pane_zoom_out') {
        const vp = getViewport();
        setViewport({ ...vp, zoom: Math.max(vp.zoom / 1.3, 0.1) }, { duration: 200 });
      }

      if (action === 'pane_ai_suggest') {
        handleAIExpand();
      }

      if (action === 'pane_auto_cluster') {
        window.dispatchEvent(
          new CustomEvent('idea-workspace-quick-action', {
            detail: { action: 'mm_auto_cluster' },
          })
        );
      }

      // E10 (2026-08-10): relocated from handleContextAction (per-node menu)
      // — see NodeContextMenu.tsx's header comment. `setShowDependencyDetector`
      // /`setShowPriorityRecommender`/`setShowCompetitiveLandscape` themselves
      // are unchanged (same modals, same whole-map generators); only the menu
      // that triggers them moved, since the node under the cursor never
      // affected their result.
      if (action === 'pane_dependencies') setShowDependencyDetector(true);
      if (action === 'pane_priority') setShowPriorityRecommender(true);
      if (action === 'pane_competitive') setShowCompetitiveLandscape(true);

      setPaneContextMenu(null);
    },
    [
      autoLayout,
      copySelected,
      cutSelected,
      edges,
      fitView,
      getSelectedNode,
      getViewport,
      handleAIExpand,
      isPolish,
      nodes,
      paneContextMenu,
      pasteNodes,
      pushUndo,
      redo,
      setCollapsedNodeIds,
      setEdges,
      setFoldLevel,
      setNodes,
      setShowCompetitiveLandscape,
      setShowDependencyDetector,
      setShowPriorityRecommender,
      setViewport,
      undo,
    ]
  );

  // #6b (doktryna EWOLUCJA+ŻYWY): narzędzia idei = autosave ciągły, ZERO
  // tekstów o stanie zapisu/trybie w UI — pasek "tytuł · Mode · Not saved"
  // usunięty w całości (był dubletem breadcrumb/kontekstu). Autosave dalej
  // zapisuje w tle (queueSync/persistence bez zmian) — zniknął tylko napis.

  const containerClassName =
    variant === 'overlay'
      ? 'fixed inset-0 z-modal bg-c-bg'
      : `relative w-full h-full bg-c-bg isolate z-0 ${className || ''}`;

  // M06 Fala 3.2: behind `mindmapMultiToolbar`, a >1 selection shows a shared
  // styling toolbar anchored above the topmost selected node. OFF keeps the
  // exact pre-existing behavior (null unless exactly one node is selected).
  const multiToolbarEnabled = isFeatureEnabled('mindmapMultiToolbar');

  // M06 Fala 3.1: align/distribute buttons + snap-to-grid + smart guides, all
  // behind `mindmapAlignSnap`. Snap is opt-in even when the flag is ON — it
  // starts OFF so the flag alone never changes drag behavior on the canvas.
  const alignSnapEnabled = isFeatureEnabled('mindmapAlignSnap');

  // M06 Fala 3.3: real viewport culling for large maps. We flip ReactFlow's
  // built-in `onlyRenderVisibleElements` (DOM mounted only for viewport-visible
  // nodes) instead of stripping nodes from the graph — so the store stays whole
  // and the minimap, multi-select styling, SmartGuidesOverlay peers and edge
  // endpoints all keep working for off-screen nodes. Engages only past the
  // threshold so small/medium maps stay byte-identical to OFF.
  const virtualizationEnabled = isFeatureEnabled('mindmapVirtualization');
  const onlyRenderVisibleElements = shouldVirtualize(virtualizationEnabled, nodes.length);

  // Z14: neighbour-edge magnetic snapping. Gated by the same opt-in as native
  // grid (alignSnapEnabled flag AND the snapEnabled toggle) so the flag alone
  // never changes drag behavior. Grid stays native (snapGrid 16) → gridEnabled
  // false. Composed with the reparent onNodeDrag below (both run per frame).
  const { onNodeDrag: onSnapNodeDrag } = useCanvasSnapping({
    enabled: alignSnapEnabled && snapEnabled,
    threshold: 6,
    gridEnabled: false,
  });
  const onNodeDragCombined = useCallback(
    (event: React.MouseEvent, node: Node) => {
      onNodeDrag(event, node); // reparent drop-target highlight
      onSnapNodeDrag(event, node); // magnetic neighbour snap (opt-in)
    },
    [onNodeDrag, onSnapNodeDrag]
  );

  // Slot doku paska edycji — czytany TU (a nie dopiero niżej), bo decyduje, czy
  // pasek pływa, czy siedzi w listwie; od tego zależy warunek `contextMenu`.
  const editBarSlot = useObjectEditBarSlot();
  const editBarDockAvailable = isCanvasObjectEditBarEnabled() && !!editBarSlot;

  const floatingToolbarInfo = useMemo(() => {
    if (locked) return null;
    // Pasek PŁYWAJĄCY chowa się przy menu kontekstowym, bo inaczej zasłaniałby
    // je nad węzłem. Pasek ZADOKOWANY w górnej listwie nic nie zasłania, a
    // znikanie go przy otwarciu jego WŁASNEGO kebaba wygląda na awarię: cała
    // linia przeskakuje (tożsamość rozwija się z powrotem do pilli) w chwili,
    // gdy użytkownik sięga po pozycję z menu. Warunek zostaje więc TYLKO dla
    // wariantu pływającego — zachowanie przy fladze OFF bez zmian.
    if (contextMenu && !editBarDockAvailable) return null;
    if (selectedNodeIds.length === 1) {
      const nodeId = selectedNodeIds[0];
      const node = (nodes as Node[]).find((n) => n.id === nodeId);
      if (!node || !node.position) return null;
      const vp = getViewport();
      const screenX = node.position.x * vp.zoom + vp.x;
      const screenY = node.position.y * vp.zoom + vp.y;
      return {
        nodeId,
        node,
        position: { x: screenX + ((node.width || 160) * vp.zoom) / 2, y: screenY },
        mode: 'single' as const,
        nodeIds: selectedNodeIds,
      };
    }
    if (!multiToolbarEnabled) return null;
    if (selectedNodeIds.length <= 1) return null;
    const selectedSet = new Set(selectedNodeIds);
    const selected = (nodes as Node[]).filter((n) => selectedSet.has(n.id) && n.position);
    if (selected.length === 0) return null;
    const vp = getViewport();
    // Anchor above the topmost (lowest y) selected node, horizontally
    // centered over the selection bbox — mirrors the single-node anchor math.
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    for (const n of selected) {
      const w = n.width || 160;
      minX = Math.min(minX, n.position.x);
      maxX = Math.max(maxX, n.position.x + w);
      minY = Math.min(minY, n.position.y);
    }
    const screenX = minX * vp.zoom + vp.x;
    const screenWidth = (maxX - minX) * vp.zoom;
    const screenY = minY * vp.zoom + vp.y;
    // Use the first selected node as the representative node for style
    // read-back (shows its current color/shape/etc. as the toolbar's value).
    const repNode = selected[0];
    return {
      nodeId: repNode.id,
      node: repNode,
      position: { x: screenX + screenWidth / 2, y: screenY },
      mode: 'multi' as const,
      nodeIds: selected.map((n) => n.id),
    };
  }, [
    locked,
    selectedNodeIds,
    nodes,
    contextMenu,
    editBarDockAvailable,
    getViewport,
    multiToolbarEnabled,
  ]);

  const handleFloatingToolbarUpdate = useCallback(
    (patch: Record<string, any>) => {
      debugLog(`floatingToolbarUpdate: ${JSON.stringify(patch).slice(0, 100)}`);
      if (!floatingToolbarInfo) return;
      if (floatingToolbarInfo.mode === 'multi' && floatingToolbarInfo.nodeIds.length > 1) {
        const targetIds = floatingToolbarInfo.nodeIds;
        setNodes((prev: Node[]) =>
          applyStyleToNodes(prev, targetIds, patch).map((n) =>
            targetIds.includes(n.id) ? applyFrameStyleToNode(n, patch) : n
          )
        );
        for (const nodeId of targetIds) {
          broadcastNodeUpdate({ id: nodeId, data: patch } as any);
        }
        return;
      }
      updateNodeDataById(floatingToolbarInfo.nodeId, (data: any) => ({ ...data, ...patch }));
      // PUŁAPKA nr 1 z audytu: ramka (`type: 'group'`) rysuje pudełko z
      // `node.style`, nie z `node.data` — sam patch na `data` do niej NIE
      // dolatuje i kolor „nie działa". Osobne przejście po `node.style`.
      if (patch.bgColor !== undefined || patch.borderColor !== undefined) {
        const targetId = floatingToolbarInfo.nodeId;
        setNodes((prev: Node[]) =>
          prev.map((n) => (n.id === targetId ? applyFrameStyleToNode(n, patch) : n))
        );
      }
    },
    [debugLog, floatingToolbarInfo, updateNodeDataById, setNodes, broadcastNodeUpdate]
  );

  // ── PASEK EDYCJI OBIEKTU (ff_canvasObjectEditBar) ──────────────────────────
  // Zaznaczenie → pasek dokuje się w listwie Menu 3 („tam gdzie jest AddNode,
  // Auto Layout, AI Expand, Templates"). Bez slotu (flaga OFF albo Menu 3
  // schowane przez ff_ideaTopBarOneLine) zostaje stary pasek pływający.
  // `editBarSlot` / `editBarDockAvailable` — patrz wyżej (przy `floatingToolbarInfo`).
  const editBarDocked = editBarDockAvailable && !!floatingToolbarInfo;

  const editBarModel = useMemo(() => {
    if (!editBarDocked || !floatingToolbarInfo) return null;
    const info = floatingToolbarInfo;
    const nodeData = (info.node.data || {}) as Record<string, any>;
    const isMulti = info.mode === 'multi';
    const isProtected = info.nodeId === 'root' || info.nodeId.startsWith('branch-');
    const style = readCanvasObjectStyle(nodeData);
    const nodeDisabled = locked || !!nodeData.locked;

    const growth: ObjectEditBarGroup = { id: 'growth', controls: [] };
    if (!isMulti) {
      growth.controls.push({
        kind: 'button',
        id: 'add-child',
        icon: Plus,
        label: t('ideas.mindmap.addChildTab', 'Add child (Tab)'),
        disabled: nodeDisabled,
        onClick: () => addChildNode(info.nodeId),
      });
      if (!isProtected) {
        growth.controls.push({
          kind: 'button',
          id: 'add-sibling',
          icon: GitBranch,
          label: t('ideas.mindmap.addSiblingShiftEnter', 'Add sibling (Shift+Enter)'),
          disabled: nodeDisabled,
          onClick: () => addSiblingNode(info.nodeId),
        });
      }
      growth.controls.push({
        kind: 'button',
        id: 'rename',
        icon: Edit3,
        label: t('ideas.mindmap.renameF2', 'Rename (F2)'),
        disabled: nodeDisabled || isProtected,
        // `_startEditing` to ten sam sygnał, którym menu kontekstowe wchodzi w
        // edycję etykiety (czyta go `EditableIdeaNodeComponent`) — bez
        // dublowania logiki zmiany nazwy.
        onClick: () =>
          updateNodeDataById(info.nodeId, (d: any) => ({ ...d, _startEditing: Date.now() })),
      });
    }

    const styleGroups = buildStyleGroups({
      style,
      onPatch: handleFloatingToolbarUpdate,
      t,
      disabled: nodeDisabled,
      show: { shape: true },
    });

    // Strzałki / kierunek przepływu — funkcja JUŻ ISTNIEJE (`mm_edge_arrow`,
    // gałąź feat/strzalki-kierunku): hurtowo na całą gałąź, dotąd schowana w
    // rozwijce stylu linii. Pasek tylko ją WYSTAWIA, nie robi drugi raz.
    const structure: ObjectEditBarGroup = {
      id: 'structure',
      controls: [
        {
          kind: 'popover',
          id: 'arrows',
          icon: MoveRight,
          label: t('canvasEditBar.arrowTitle', 'Strzałki i kierunek'),
          disabled: nodeDisabled,
          align: 'center',
          render: (close) => (
            <ArrowDirectionPopover
              value={nodeData.arrowDirection as CanvasArrowDirection | undefined}
              onPick={(direction) => {
                window.dispatchEvent(
                  new CustomEvent('idea-workspace-quick-action', {
                    detail: { action: 'mm_edge_arrow', nodeId: info.nodeId, direction },
                  })
                );
              }}
              close={close}
            />
          ),
        },
        {
          kind: 'button',
          id: 'lock',
          icon: nodeData.locked ? Lock : Unlock,
          label: nodeData.locked
            ? t('ideas.mindmap.unlock', 'Unlock')
            : t('ideas.mindmap.lock', 'Lock'),
          active: !!nodeData.locked,
          onClick: () => handleFloatingToolbarUpdate({ locked: !nodeData.locked }),
        },
      ],
    };

    // „Więcej" otwiera pełne menu kontekstowe węzła — dzięki temu ŻADNA akcja
    // starego paska pływającego nie staje się nieosiągalna po zadokowaniu.
    if (!isMulti) {
      structure.controls.push({
        kind: 'button',
        id: 'more',
        icon: MoreVertical,
        label: t('ideas.mindmap.moreOptions', 'More options'),
        onClick: () => {
          const el =
            typeof document === 'undefined'
              ? null
              : document.querySelector('[data-testid="object-edit-bar-more"]');
          const rect = el?.getBoundingClientRect();
          setContextMenu({
            nodeId: info.nodeId,
            nodeType: info.node.type || 'idea',
            x: rect ? rect.left : 240,
            y: rect ? rect.bottom + 4 : 120,
          });
        },
      });
    }

    return {
      title: isMulti
        ? t('ideas.mindmap.nSelected', '{{count}} selected', { count: info.nodeIds.length }).trim()
        : t('canvasEditBar.titleNode', 'Węzeł'),
      groups: [growth, ...styleGroups, structure],
    };
  }, [
    editBarDocked,
    floatingToolbarInfo,
    locked,
    t,
    addChildNode,
    addSiblingNode,
    updateNodeDataById,
    handleFloatingToolbarUpdate,
    setContextMenu,
  ]);

  // M06 Fala 3.1: apply an align/distribute op to the current multi-selection.
  // Pure geometry (computeAlignDistribute) → position patches; positions are
  // written through setNodes (no data mutation), pushed onto the undo stack
  // beforehand, broadcast per-node like a drag, and debounce-persisted. No-op
  // when the flag is off or the selection is too small for the mode.
  const applyAlignDistribute = useCallback(
    (mode: AlignMode) => {
      if (!alignSnapEnabled || locked) return;
      const selectedSet = new Set(selectedNodeIds);
      const selected = (nodes as Node[]).filter((n) => selectedSet.has(n.id) && n.position);
      const patches = computeAlignDistribute(
        selected.map((n) => ({
          id: n.id,
          position: n.position,
          width: n.width,
          height: n.height,
          data: n.data as any,
        })),
        mode
      );
      if (patches.length === 0) return;
      const patchById = new Map(patches.map((p) => [p.id, p.position]));
      pushUndo();
      setNodes((prev: Node[]) =>
        prev.map((n) => {
          const next = patchById.get(n.id);
          return next ? { ...n, position: next } : n;
        })
      );
      for (const p of patches) {
        broadcastNodeUpdate({ id: p.id, position: p.position } as any);
      }
      debouncedSave();
    },
    [
      alignSnapEnabled,
      locked,
      selectedNodeIds,
      nodes,
      pushUndo,
      setNodes,
      broadcastNodeUpdate,
      debouncedSave,
    ]
  );

  return (
    <div ref={containerRef} className={containerClassName} tabIndex={-1} data-mm-surface="mindmap">
      {/* PASEK EDYCJI OBIEKTU zadokowany w listwie Menu 3 (ff_canvasObjectEditBar).
          Renderuje się TYLKO gdy slot faktycznie istnieje — inaczej niżej
          zostaje stary pasek pływający, więc kontrolki nigdy nie znikają. */}
      {editBarDocked && editBarModel ? (
        <ObjectEditBarDock slot={editBarSlot}>
          <ObjectEditBar model={editBarModel} />
        </ObjectEditBarDock>
      ) : null}

      {/* Floating node toolbar */}
      {floatingToolbarInfo && !editBarDocked && (
        <FloatingNodeToolbar
          nodeId={floatingToolbarInfo.nodeId}
          nodeData={floatingToolbarInfo.node.data}
          disabled={locked || !!floatingToolbarInfo.node.data?.locked}
          isProtected={
            floatingToolbarInfo.nodeId === 'root' ||
            floatingToolbarInfo.nodeId.startsWith('branch-')
          }
          hasChildren={findChildrenIds(floatingToolbarInfo.nodeId).length > 0}
          mode={floatingToolbarInfo.mode}
          selectionCount={floatingToolbarInfo.nodeIds.length}
          showAlign={alignSnapEnabled && floatingToolbarInfo.mode === 'multi'}
          onAlignDistribute={applyAlignDistribute}
          canDistribute={floatingToolbarInfo.nodeIds.length >= 3}
          style={{
            color: floatingToolbarInfo.node.data?.color,
            fillOpacity: floatingToolbarInfo.node.data?.fillOpacity,
            lineStyle: floatingToolbarInfo.node.data?.lineStyle,
            fontSize: floatingToolbarInfo.node.data?.fontSize,
            bold: floatingToolbarInfo.node.data?.bold,
            semanticType: floatingToolbarInfo.node.data?.semanticType,
            branchTheme: floatingToolbarInfo.node.data?.branchTheme,
            autoLayout: floatingToolbarInfo.node.data?.autoLayout,
            locked: floatingToolbarInfo.node.data?.locked,
          }}
          position={floatingToolbarInfo.position}
          onUpdate={handleFloatingToolbarUpdate}
          onAddChild={() => addChildNode(floatingToolbarInfo.nodeId)}
          onAddSibling={() => addSiblingNode(floatingToolbarInfo.nodeId)}
          onOpenContextMenu={(pos) =>
            setContextMenu({
              nodeId: floatingToolbarInfo.nodeId,
              nodeType: floatingToolbarInfo.node.type || 'idea',
              x: pos.x,
              y: pos.y,
            })
          }
          onOpenArtifactModal={() => setAttachArtifactNodeId(floatingToolbarInfo.nodeId)}
          onOpenNodeDetail={() => setDrawerNodeId(floatingToolbarInfo.nodeId)}
          onRemoveArtifact={(link) => {
            const artifactType = link?.artifactRef?.type;
            const artifactId = link?.artifactRef?.id;
            if (!artifactType || !artifactId) return;
            void (async () => {
              try {
                await Api.detachArtifactFromObject(
                  ideaId,
                  floatingToolbarInfo.nodeId,
                  artifactType,
                  artifactId,
                  { baseVersion: externalRuntime?.version ?? localVersionRef.current }
                );
                if (externalRuntime) {
                  await externalRuntime.refresh();
                } else {
                  updateNodeDataById(floatingToolbarInfo.nodeId, (data: any) => ({
                    ...data,
                    artifactLinks: (Array.isArray(data.artifactLinks)
                      ? data.artifactLinks
                      : []
                    ).filter(
                      (item: ArtifactLink) =>
                        !(
                          item?.artifactRef?.type === link?.artifactRef?.type &&
                          item?.artifactRef?.id === link?.artifactRef?.id &&
                          item?.label === link?.label
                        )
                    ),
                  }));
                }
                toast.success(t('mindmap.artifactDetached'), {
                  duration: 900,
                });
              } catch (err: any) {
                const conflictVersion = getMapVersionFromPayload(err?.data);
                if (conflictVersion) {
                  localVersionRef.current = Math.max(localVersionRef.current || 1, conflictVersion);
                }
                if (err?.status === 409 && externalRuntime) {
                  await externalRuntime.refresh().catch(() => {});
                }
                toast.error(err?.message || t('mindmap.failedToDetachArtifact'));
              }
            })();
          }}
          onOpenLinkedArtifact={(link) => {
            const artifactType = link?.artifactRef?.type;
            const artifactId = link?.artifactRef?.id;
            if (!artifactType || !artifactId) return;
            window.dispatchEvent(
              new CustomEvent('mywork-open-item', {
                detail: {
                  type: artifactType,
                  id: artifactId,
                  name: link.label || `${artifactType}:${artifactId}`,
                },
              })
            );
          }}
          onOpenChatAboutNode={() => {
            const label = floatingToolbarInfo.node.data?.label || '';
            window.dispatchEvent(
              new CustomEvent('idea-workspace-quick-action', {
                detail: { action: 'mm_chat_about_node', nodeId: floatingToolbarInfo.nodeId, label },
              })
            );
          }}
          onAction={(action) => {
            const SUBTREE_MAP: Record<string, string> = {
              ctx_subtree_convert_decision: 'decision',
              ctx_subtree_convert_tasks: 'task_set',
              ctx_subtree_convert_task_set: 'task_set',
              ctx_subtree_convert_initiative: 'initiative',
              // H2.3 fix: was a bare tool-switch with no data carried over;
              // route through convertBranch like every other subtree target.
              ctx_subtree_convert_process_flow: 'process_flow',
            };
            if (SUBTREE_MAP[action]) {
              convertBranch(SUBTREE_MAP[action], floatingToolbarInfo.nodeId);
              return;
            }
            window.dispatchEvent(
              new CustomEvent('idea-workspace-quick-action', {
                detail: { action, nodeId: floatingToolbarInfo.nodeId },
              })
            );
          }}
        />
      )}

      {/* Node context menu */}
      {contextMenu && (
        <NodeContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          nodeId={contextMenu.nodeId}
          nodeType={contextMenu.nodeType}
          isLocked={locked}
          isPl={isPolish}
          canPasteStyle={!!styleClipboard}
          canPasteNodes={hasMindMapClipboard()}
          hasChildren={findChildrenIds(contextMenu.nodeId).length > 0}
          onClose={() => setContextMenu(null)}
          onAction={handleContextAction}
        />
      )}

      {/* Pane (empty canvas) context menu */}
      {paneContextMenu && (
        <PaneContextMenu
          x={paneContextMenu.x}
          y={paneContextMenu.y}
          canvasX={paneContextMenu.canvasX}
          canvasY={paneContextMenu.canvasY}
          isPl={isPolish}
          isLocked={locked}
          canUndo={undoStackRef.current.length > 0}
          canRedo={redoStackRef.current.length > 0}
          canPaste={hasMindMapClipboard()}
          hasSelection={selectedNodeIds.length > 0}
          // E10 (2026-08-10): gate moved with `pane_dependencies` from
          // NodeContextMenu.tsx (was `comingSoonIds={['ctx_dependencies']}` there).
          comingSoonIds={heuristicAiOverlaysEnabled ? [] : ['pane_dependencies']}
          onClose={() => setPaneContextMenu(null)}
          onAction={handlePaneContextAction}
        />
      )}

      {/* Edge context menu */}
      {edgeContextMenu && (
        <EdgeContextMenu
          x={edgeContextMenu.x}
          y={edgeContextMenu.y}
          edgeId={edgeContextMenu.edgeId}
          isPl={isPolish}
          isLocked={locked}
          isUserCreated={edgeContextMenu.isUserCreated}
          onClose={() => setEdgeContextMenu(null)}
        />
      )}

      {/* AI suggestions modal */}
      {showAIModal && aiProposal && (
        <AIProposalDiffModal
          proposal={aiProposal}
          isPl={isPolish}
          existingNodes={nodes}
          onApply={(selected) => void applyAIProposal(selected)}
          onReject={closeAIModal}
        />
      )}

      {/* Breadcrumb for drill-down — positioned below the unified header.
          #6e: also top chrome — hides in fullscreen. */}
      {drillPath.length > 0 && !isFullscreen && (
        <div className="absolute top-[110px] left-3 z-dropdown">
          <SubMapBreadcrumb
            path={drillPath}
            onNavigate={handleBreadcrumbNavigate}
            isPl={isPolish}
          />
        </div>
      )}

      {/* #6b: pasek tytuł/Mode/Not-saved USUNIĘTY W CAŁOŚCI (dublet + zapis
          jest ciągły — SaaS nie pokazuje "not saved"). Close (X) zostaje —
          to jedyny sposób wyjścia z wariantu overlay, nie jest częścią
          usuniętego paska stanu. */}
      {/* #6e: close (X) is top chrome too — hides in fullscreen (Esc exits
          fullscreen first via native browser Fullscreen API; the X returns
          once fullscreen ends). */}
      {showClose && !isFullscreen && (
        <div className="absolute top-3 left-3 z-dropdown">
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-c-surface/80 backdrop-blur-lg border border-c-border-subtle shadow-lg text-slate-600 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 hover:bg-c-surface-raised transition-colors"
            title={t('mindmap.closeMap')}
          >
            <X size={12} />
          </button>
        </div>
      )}

      {!loading && !mapLoadError && (
        <CanvasZoomControls
          isPolish={isPolish}
          selectedNodeId={selectedNodeIds[0] || null}
          showMiniMap={showMiniMap}
          onToggleMiniMap={() => setShowMiniMap((prev) => !prev)}
          {...(alignSnapEnabled
            ? { snapEnabled, onToggleSnap: () => setSnapEnabled((prev) => !prev) }
            : {})}
          onFullscreenToggle={onFullscreenToggle}
          isFullscreen={isFullscreen}
        />
      )}

      {/* Large map warning */}
      {nodes.length >= 500 && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-sticky px-4 py-2 rounded-xl bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 text-xs font-medium shadow-lg">
          {t('mindmap.mapReached500NodeLimitAdding')}
        </div>
      )}

      {/* Canvas */}
      {loading ? (
        <div className="w-full h-full flex items-center justify-center">
          <Loader2 className="animate-spin text-amber-500" size={34} />
        </div>
      ) : mapLoadError ? (
        // D2: GET /map failed and there is no real graph to fall back on —
        // show an explicit, accessible error instead of silently rendering
        // an empty/starter canvas that looks like a normal (if boring) map.
        <div
          role="alert"
          aria-live="assertive"
          className="w-full h-full flex flex-col items-center justify-center gap-4 bg-c-surface-raised dark:bg-c-surface p-8 text-center"
        >
          <div className="p-3 rounded-2xl bg-c-surface border border-c-danger">
            <AlertTriangle size={32} className="text-c-danger" aria-hidden="true" />
          </div>
          <div>
            <div className="text-sm font-semibold text-c-text mb-1">
              {t('mindmap.persistence.mapLoadErrorTitle')}
            </div>
            <div className="text-xs text-c-text-secondary dark:text-c-text-muted max-w-sm">
              {t('mindmap.persistence.mapLoadErrorBody')}
            </div>
          </div>
          <button
            type="button"
            onClick={handleRetryMapLoad}
            disabled={retryingMapLoad}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-c-surface dark:bg-c-surface-raised text-c-text-secondary dark:text-c-text hover:bg-c-surface dark:hover:bg-c-surface-raised transition-colors disabled:opacity-60"
          >
            {retryingMapLoad ? (
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw size={14} aria-hidden="true" />
            )}
            {t('mindmap.persistence.mapLoadErrorRetry')}
          </button>
        </div>
      ) : (
        <MindMapIdeaIdContext.Provider value={ideaId}>
          <MindMapLockedContext.Provider value={Boolean(locked)}>
            <MindMapInteractionModeContext.Provider value={interactionMode}>
              <ReactFlow
                nodes={enrichedNodes}
                edges={focusFilteredEdges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onMoveEnd={(_event: any, viewport: { x: number; y: number; zoom: number }) => {
                  onViewportReport?.(viewport);
                  saveViewportOnly();
                  try {
                    localStorage.setItem(`mm-viewport-${ideaId}`, JSON.stringify(viewport));
                  } catch {
                    /* */
                  }
                }}
                onNodeClick={onNodeClick}
                onNodeDoubleClick={onNodeDoubleClick}
                onNodeContextMenu={onNodeContextMenu}
                onPaneClick={onPaneClick}
                onPaneContextMenu={onPaneContextMenu}
                onConnect={onConnect}
                onEdgeClick={onEdgeClick}
                onNodeDrag={onNodeDragCombined}
                onNodeDragStop={onNodeDragStop}
                {...(alignSnapEnabled && snapEnabled
                  ? { snapToGrid: true, snapGrid: [16, 16] as [number, number] }
                  : {})}
                {...(onlyRenderVisibleElements ? { onlyRenderVisibleElements: true } : {})}
                nodeTypes={reactFlowNodeTypes}
                edgeTypes={reactFlowEdgeTypes}
                // ReactFlow's built-in keyboard-a11y makes nodes focusable and binds
                // Tab/arrow keys to node focus-traversal — which silently swallows the
                // mind-map grammar (Tab=add child, Enter=sibling, arrows=navigate)
                // before our own keydown handler can see it. Disable it so the map's
                // grammar actually works. (We provide arrow/Tab navigation ourselves.)
                disableKeyboardA11y
                {...getIdeasToolInteractionProps('mindmap', {
                  locked,
                  connectMode: interactionMode === 'connect',
                })}
                // Z1 (parytet z Tablicą/Przepływem): tryb kursora z lewego raila
                // REALNIE przestawia płótno, nie tylko afordancję węzła. `select`
                // = zero nadpisań (Z10 nietknięte). `connect` mapujemy na `select`
                // helpera (helper zna tylko select/pan/draw) — helper nie nadpisuje
                // niczego dla select, więc uchwyty/`nodesConnectable`/crosshair
                // trybu connect zostają nietknięte. `pan` = rączka (nic się nie
                // rusza ani nie zaznacza). Spread MUSI być po
                // getIdeasToolInteractionProps, żeby wygrał z domyślnymi.
                {...getIdeaCanvasCursorProps(interactionMode === 'pan' ? 'pan' : 'select')}
                className={`mm-canvas bg-c-bg ${
                  interactionMode === 'connect'
                    ? 'cursor-crosshair'
                    : getIdeaCanvasCursorClass(interactionMode === 'pan' ? 'pan' : 'select') ||
                      'cursor-default'
                }`}
                aria-label={t('mindmap.ideaRecommendationMapArrowNavigationEnte')}
                defaultEdgeOptions={reactFlowDefaultEdgeOptions}
                onDragOver={(event: React.DragEvent) => {
                  if (event.dataTransfer.types.includes('application/idea-context-item')) {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'copy';
                  }
                }}
                onDrop={(event: React.DragEvent) => {
                  const raw = event.dataTransfer.getData('application/idea-context-item');
                  if (!raw) return;
                  event.preventDefault();
                  try {
                    const item = JSON.parse(raw);
                    const position = screenToFlowPosition({
                      x: event.clientX,
                      y: event.clientY,
                    });
                    const newId = `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                    const branchKey =
                      item.type === 'initiative'
                        ? 'options'
                        : item.type === 'gap'
                          ? 'causes'
                          : item.type === 'insight'
                            ? 'evidence'
                            : item.type === 'kpi'
                              ? 'validation'
                              : 'uncategorized';
                    const newNode = {
                      id: newId,
                      type: 'idea' as const,
                      position,
                      data: {
                        label: item.title || item.text || 'Dropped item',
                        branchKey,
                        sourceType: 'context_panel',
                        priority: 50,
                        notes: item.detail || '',
                        context: item.source ? `Source: ${item.source}` : '',
                        semanticType:
                          item.type === 'gap'
                            ? 'risk'
                            : item.type === 'insight'
                              ? 'evidence'
                              : item.type === 'kpi'
                                ? 'evidence'
                                : item.type === 'initiative'
                                  ? 'action'
                                  : 'topic',
                        status: 'idea',
                        tags: item.type ? [item.type] : [],
                      },
                    };
                    const nearestNode = nodes
                      .filter((n) => !n.hidden)
                      .reduce(
                        (best, n) => {
                          const dx = n.position.x - position.x;
                          const dy = n.position.y - position.y;
                          const dist = Math.sqrt(dx * dx + dy * dy);
                          if (!best || dist < best.dist) return { node: n, dist };
                          return best;
                        },
                        null as { node: any; dist: number } | null
                      );

                    const parentId =
                      nearestNode && nearestNode.dist < 300 ? nearestNode.node.id : 'root';
                    const colors = branchColor(branchKey);
                    const newEdge = {
                      id: `edge-${newId}`,
                      source: parentId,
                      target: newId,
                      type: 'gradient',
                      style: { stroke: colors.edge, strokeWidth: 1.5, opacity: 0.5 },
                      animated: true,
                      data: { edgeRole: 'structural' },
                    };

                    pushUndo();
                    setNodes((prev) => [
                      ...prev.map((n) => ({ ...n, selected: false })),
                      { ...newNode, selected: true },
                    ]);
                    setEdges((prev) => [...prev, newEdge]);
                  } catch {
                    /* ignore bad data */
                  }
                }}
              >
                {/* P2: background via SSOT canvasBackground.ts */}
                {(() => {
                  const bg = getCanvasBg('mindmap', isDarkMindmap ? 'dark' : 'light');
                  return (
                    <Background
                      color={bg.color}
                      gap={bg.gap}
                      size={bg.size}
                      variant={bg.variant as any}
                    />
                  );
                })()}
                {/* M06 Fala 3.1 / Z14: alignment guides during drag (flag-gated, read-only). */}
                {alignSnapEnabled && <CanvasSnapGuides threshold={6} />}
                {showMiniMap && (
                  <MiniMap
                    nodeColor={miniMapNodeColor}
                    // Stroke = fill: a fixed grey 3px outline swallowed the node colour
                    // at this scale and made every node read as the same dot.
                    nodeStrokeColor={miniMapNodeColor}
                    nodeStrokeWidth={1}
                    nodeBorderRadius={6}
                    /**
                     * The mask paints everything OUTSIDE the current viewport, so it has to
                     * CONTRAST with the minimap background. `var(--c-bg)` is the page
                     * background itself → effectively zero contrast in light mode, i.e.
                     * "where am I" was invisible. Semi-transparent slate reads in both themes.
                     */
                    maskColor={isDarkMindmap ? 'rgba(2, 6, 23, 0.55)' : 'rgba(15, 23, 42, 0.28)'}
                    /**
                     * `marginBottom` lifts the minimap clear of `CanvasZoomControls`
                     * (bottom-3, ~42px tall, z-dropdown) — it used to slide underneath.
                     */
                    style={{
                      width: 180,
                      height: 130,
                      marginBottom: 62,
                      zIndex: 10,
                      // Inline, not a class: React Flow's own stylesheet hard-codes a
                      // white `.react-flow__minimap` background and loads after Tailwind,
                      // so a `bg-*` utility loses and dark mode stays a white slab.
                      backgroundColor: 'var(--c-surface)',
                    }}
                    zoomable
                    pannable
                    className="rounded-xl border border-c-border shadow-lg"
                  />
                )}

                {/* Empty state: pre-accept onboarding overlay OR post-accept quick-start */}
                {visibleIdeaNodeCount === 0 && (
                  <>
                    {locked ? (
                      <Panel position="center">
                        <div className="pointer-events-auto max-w-sm mx-auto rounded-2xl bg-c-surface/80 backdrop-blur-xl shadow-2xl border border-c-border-subtle p-8 text-center onboarding-overlay-enter">
                          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
                            <Lightbulb size={28} className="text-white" />
                          </div>
                          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-2">
                            {t('mindmap.describeYourChallenge')}
                          </h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                            {t('mindmap.fillInTheTitleAndDescription')}
                          </p>
                          <div className="space-y-2 text-left mb-6">
                            {[
                              { n: '1', en: 'Name your challenge' },
                              { n: '2', en: 'Describe the problem or idea' },
                              { n: '3', en: 'Click "Accept" in the Tools panel' },
                            ].map((step) => (
                              <div key={step.n} className="flex items-center gap-3">
                                <span className="w-6 h-6 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-semibold flex items-center justify-center shrink-0">
                                  {step.n}
                                </span>
                                <span className="text-sm text-slate-600 dark:text-slate-300">
                                  {t(`myWorkMindmap.emptyStep.${step.n}`, step.en)}
                                </span>
                              </div>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() => onCenterEdit?.()}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-amber-500 to-amber-500 text-white shadow-lg shadow-amber-500/20 hover:shadow-xl hover:shadow-amber-500/30 transition-all"
                          >
                            <Sparkles size={16} />
                            {t('mindmap.openPanelStart')}
                          </button>
                        </div>
                      </Panel>
                    ) : (
                      <Panel position="bottom-center">
                        <div className="mb-14 px-5 py-3 rounded-2xl bg-c-surface/90 backdrop-blur-xl border border-c-border-subtle shadow-xl text-sm text-slate-500 dark:text-slate-400 flex items-center gap-4 pointer-events-auto">
                          <Lightbulb size={16} className="text-amber-500 shrink-0" />
                          <span className="text-slate-600 dark:text-slate-300">
                            {t('mindmap.selectABranchAndPressTab')}
                          </span>
                          <div className="w-px h-5 bg-c-border" />
                        </div>
                      </Panel>
                    )}
                  </>
                )}

                {/* Cluster Bubbles overlay */}
                {showClusterBubbles && (
                  <ClusterBubbles
                    nodes={enrichedNodes
                      .filter((n) => !n.hidden)
                      .map((n) => ({ id: n.id, position: n.position, data: n.data }))}
                    edges={focusFilteredEdges
                      .filter((e) => !e.hidden)
                      .map((e) => ({ source: e.source, target: e.target }))}
                    enabled={showClusterBubbles}
                  />
                )}

                {/* Active branch info removed — redundant with visual branch nodes on canvas */}
              </ReactFlow>
              {/* Overlay „Zdrowie mapy" — TYLKO przy fladze OFF. Przy ON tę samą
                treść rysuje sekcja „AI" prawego panelu (IdeaWorkspaceTools),
                więc overlay zniknąłby jako duplikat, a nie jako utrata funkcji. */}
              {showHealthScore && !paneleWPrawymPanelu && (
                <MapHealthScore nodes={nodes} edges={edges} visible={showHealthScore} />
              )}
            </MindMapInteractionModeContext.Provider>
          </MindMapLockedContext.Provider>
        </MindMapIdeaIdContext.Provider>
      )}

      {/* AI Branch Balancer — DP-5: client-side heuristic (no LLM), flag OFF by default */}
      {heuristicAiOverlaysEnabled && (
        <AIBranchBalancer
          nodes={nodes.map((n) => ({ id: n.id, data: n.data, type: n.type }))}
          edges={edges.map((e) => ({ id: e.id, source: e.source, target: e.target }))}
          locked={locked}
          onFocusBranch={(branchKey) => {
            const branchNode = nodes.find(
              (n) => n.data?.branchKey === branchKey && n.id.startsWith('branch-')
            );
            if (branchNode) {
              setNodes((prev: Node[]) =>
                prev.map((n) => ({ ...n, selected: n.id === branchNode.id }))
              );
              setTimeout(() => {
                try {
                  fitView({ nodes: [{ id: branchNode.id } as any], padding: 0.5, duration: 400 });
                } catch {
                  /* ignore */
                }
              }, 100);
            }
          }}
        />
      )}

      {/* AI What-If Scenarios */}
      {showWhatIf &&
        (() => {
          const sel = nodes.find((n: any) => n?.selected);
          return (
            <AIWhatIfScenarios
              open={showWhatIf}
              onClose={() => setShowWhatIf(false)}
              ideaId={ideaId}
              ideaTitle={ideaTitle}
              selectedNodeLabel={sel?.data?.label || ideaTitle}
              selectedNodeId={sel?.id || 'root'}
              branchKey={sel?.data?.branchKey || 'options'}
              allNodes={nodes.map((n) => ({ id: n.id, data: n.data }))}
              locked={locked}
              onApplyScenario={(scenario) => {
                pushUndo();
                window.dispatchEvent(
                  new CustomEvent('idea-workspace-insert', {
                    detail: {
                      items: [
                        {
                          text: scenario.title,
                          type: scenario.type === 'risk' ? 'risk_flags' : 'topics',
                        },
                      ],
                      ideaId,
                    },
                  })
                );
              }}
            />
          );
        })()}

      {/* AI Blind Spots Detector — jeden byt, dwa adresy: overlay (flaga OFF)
          albo karta w sekcji „AI" prawego panelu (flaga ON, przez portal).
          Propsy IDENTYCZNE w obu gałęziach — funkcje („Dodaj", „Odrzuć",
          „Sprawdź ponownie") nie mogą zależeć od miejsca renderu. */}
      {enrichedNodes.length > 0
        ? (() => {
            const detektor = (
              <AIBlindSpotsDetector
                ideaId={ideaId}
                ideaTitle={ideaTitle}
                nodes={nodes.map((n) => ({ id: n.id, data: n.data }))}
                edges={edges.map((e) => ({ id: e.id, source: e.source, target: e.target }))}
                persistence={persistence}
                locked={locked}
                onAddBlindSpot={(spot) => {
                  pushUndo();
                  window.dispatchEvent(
                    new CustomEvent('idea-workspace-insert', {
                      detail: {
                        items: [{ text: spot.area, type: 'topics' }],
                        ideaId,
                      },
                    })
                  );
                }}
                embedded={paneleWPrawymPanelu}
              />
            );
            if (!paneleWPrawymPanelu) return detektor;
            // Slot istnieje tylko, gdy prawy panel stoi na sekcji „AI" (poziom
            // Idei). Bez slotu nie renderujemy nic — detekcja rusza przy
            // pierwszym otwarciu sekcji. To świadome: panel informacyjny liczy
            // się wtedy, gdy użytkownik na niego patrzy, a nie w tle bez celu.
            return aiPanelSlot ? createPortal(detektor, aiPanelSlot) : null;
          })()
        : null}

      {/* Batch Convert Modal */}
      {showBatchConvert ? (
        <BatchConvertModal
          open={showBatchConvert}
          onClose={() => setShowBatchConvert(false)}
          nodes={nodes
            .filter((n) => n.type === 'idea')
            .map((n) => ({
              id: n.id,
              label: n.data?.label || '',
              branchKey: n.data?.branchKey || '',
              status: n.data?.status,
            }))}
          locked={locked}
          onConvert={(nodeIds, target) => {
            for (const nid of nodeIds) {
              setNodes((prev: Node[]) =>
                prev.map((n) =>
                  n.id === nid ? { ...n, data: { ...n.data, status: 'converted' } } : n
                )
              );
            }
            window.dispatchEvent(
              new CustomEvent('idea-workspace-quick-action', {
                detail: {
                  action: target === 'initiative' ? 'convert_initiative' : 'convert_decision',
                  nodeIds,
                },
              })
            );
          }}
        />
      ) : null}

      {/* Timeline View */}
      {showTimeline ? (
        <TimelineView
          open={showTimeline}
          onClose={() => setShowTimeline(false)}
          nodes={nodes
            .filter((n) => n.type === 'idea')
            .map((n) => ({
              id: n.id,
              label: n.data?.label || '',
              branchKey: n.data?.branchKey || '',
              status: n.data?.status || 'idea',
            }))}
          onSelectNode={(nodeId) => {
            setShowTimeline(false);
            setNodes((prev: Node[]) => prev.map((n) => ({ ...n, selected: n.id === nodeId })));
            setTimeout(() => {
              try {
                fitView({ nodes: [{ id: nodeId } as any], padding: 0.5, duration: 400 });
              } catch {
                /* ignore */
              }
            }, 100);
          }}
        />
      ) : null}

      {/* Presentation Mode */}
      {showPresentation ? (
        <PresentationMode
          open={showPresentation}
          onClose={() => setShowPresentation(false)}
          ideaTitle={ideaTitle}
          branches={nodes
            .filter((n) => n.id.startsWith('branch-'))
            .map((bn) => ({
              branchKey: bn.data?.branchKey || '',
              label: bn.data?.label || '',
              nodes: edges
                .filter((e) => e.source === bn.id)
                .map((e) => {
                  const child = nodes.find((n) => n.id === e.target);
                  return child
                    ? {
                        id: child.id,
                        label: child.data?.label || '',
                        status: child.data?.status,
                        notes: child.data?.notes || '',
                      }
                    : null;
                })
                .filter(Boolean) as Array<{
                id: string;
                label: string;
                status?: string;
                notes?: string;
              }>,
            }))}
          onFocusBranch={(branchKey) => {
            setShowPresentation(false);
            const branchNode = nodes.find(
              (n) => n.data?.branchKey === branchKey && n.id.startsWith('branch-')
            );
            if (branchNode) {
              setNodes((prev: Node[]) =>
                prev.map((n) => ({ ...n, selected: n.id === branchNode.id }))
              );
              setTimeout(() => {
                try {
                  fitView({ nodes: [{ id: branchNode.id } as any], padding: 0.5, duration: 400 });
                } catch {
                  /* ignore */
                }
              }, 100);
            }
          }}
        />
      ) : null}

      {/* Voice to Node */}
      {showVoiceToNode ? (
        <VoiceToNode
          open={showVoiceToNode}
          onClose={() => setShowVoiceToNode(false)}
          locked={locked}
          onAddNodes={(labels) => {
            pushUndo();
            for (const label of labels) {
              window.dispatchEvent(
                new CustomEvent('idea-workspace-insert', {
                  detail: { items: [{ text: label, type: 'topics' }], ideaId },
                })
              );
            }
          }}
        />
      ) : null}

      {/* Document to Map */}
      {showDocToMap ? (
        <DocumentToMap
          open={showDocToMap}
          onClose={() => setShowDocToMap(false)}
          ideaId={ideaId}
          ideaTitle={ideaTitle}
          locked={locked}
          onAddNodes={(labels) => {
            pushUndo();
            for (const label of labels) {
              window.dispatchEvent(
                new CustomEvent('idea-workspace-insert', {
                  detail: { items: [{ text: label, type: 'topics' }], ideaId },
                })
              );
            }
          }}
        />
      ) : null}

      {/* Interview to Map */}
      {showInterviewToMap ? (
        <InterviewToMap
          open={showInterviewToMap}
          onClose={() => setShowInterviewToMap(false)}
          ideaId={ideaId}
          ideaTitle={ideaTitle}
          locked={locked}
          onAddNodes={(items) => {
            pushUndo();
            const branchMap: Record<string, string> = {
              problem: 'topics',
              goal: 'topics',
              options: 'topics',
              evidence: 'findings',
              risks: 'risk_flags',
              experiments: 'next_steps',
            };
            for (const item of items) {
              window.dispatchEvent(
                new CustomEvent('idea-workspace-insert', {
                  detail: {
                    items: [{ text: item.text, type: branchMap[item.branchKey] || 'topics' }],
                    ideaId,
                  },
                })
              );
            }
          }}
        />
      ) : null}

      {/* Snapshot History */}
      {showSnapshots ? (
        <SnapshotHistory
          open={showSnapshots}
          onClose={() => setShowSnapshots(false)}
          ideaId={ideaId}
          currentNodes={nodes}
          currentEdges={edges}
          onRestore={(restoredNodes, restoredEdges) => {
            pushUndo();
            setNodes(restoredNodes);
            setEdges(restoredEdges);
            scheduleSave(restoredNodes as any, restoredEdges as any);
            setShowSnapshots(false);
            toast.success(t('mindmap.versionRestored'));
          }}
          onPreview={(previewNodes, previewEdges) => {
            setNodes(previewNodes);
            setEdges(previewEdges);
          }}
        />
      ) : null}

      {/* Node Detail Drawer */}
      {drawerNodeId ? (
        drawerUnifiedEnabled ? (
          // M06 Fala 4.1b: canonical unified drawer (mindmap variant). NodeDetailData
          // already carries nodeId, so it maps 1:1 into UnifiedNodeData.
          <UnifiedNodeDetailDrawer
            variant="mindmap"
            open={!!drawerNodeId}
            onClose={() => setDrawerNodeId(null)}
            nodeData={drawerUnifiedNodeData}
            ideaId={ideaId}
            ideaTitle={ideaTitle}
            locked={locked || remoteLockedNodeIds.has(drawerNodeId)}
            allNodes={nodes.map((n) => ({ id: n.id, data: n.data }))}
            allEdges={edges.map((e) => ({ id: e.id, source: e.source, target: e.target }))}
            onUpdateNode={handleUnifiedUpdateNode}
            onConvertNode={handleConvertNode}
            onNavigateToNode={handleNavigateToNode}
            onDrillDown={handleDrillDown}
          />
        ) : (
          <NodeDetailDrawer
            open={!!drawerNodeId}
            onClose={() => setDrawerNodeId(null)}
            nodeData={drawerNodeData}
            ideaId={ideaId}
            ideaTitle={ideaTitle}
            // DP-3 (T7 Part B): read-only while another collaborator holds the
            // lock on this node (defense-in-depth alongside the drawer-close
            // effect above, in case a lock arrives mid-edit).
            locked={locked || remoteLockedNodeIds.has(drawerNodeId)}
            allNodes={nodes.map((n) => ({ id: n.id, data: n.data }))}
            allEdges={edges.map((e) => ({ id: e.id, source: e.source, target: e.target }))}
            onUpdateNode={handleUpdateNode}
            onAIExpandNode={(nodeId) => {
              setNodes((prev: Node[]) => prev.map((n) => ({ ...n, selected: n.id === nodeId })));
              handleAIExpand();
            }}
            onConvertNode={handleConvertNode}
            onNavigateToNode={handleNavigateToNode}
            onDrillDown={handleDrillDown}
          />
        )
      ) : null}

      {/* R1.3: AI Dependency Detection — DP-5: heuristic pair mapping, flag OFF by default */}
      {heuristicAiOverlaysEnabled && showDependencyDetector ? (
        <AIDependencyDetector
          open={showDependencyDetector}
          onClose={() => setShowDependencyDetector(false)}
          ideaId={ideaId}
          ideaTitle={ideaTitle}
          nodes={nodes.map((n) => ({ id: n.id, data: n.data }))}
          edges={edges.map((e) => ({ id: e.id, source: e.source, target: e.target }))}
          locked={locked}
          onAddDependency={(dep) => {
            pushUndo();
            const edgeId = `dep-edge-${uid()}`;
            const depType = dep.type || 'related_to';
            const color = DEP_EDGE_COLOR[depType] ?? 'var(--c-info)';
            const newEdge: Edge = {
              id: edgeId,
              source: dep.sourceNodeId,
              target: dep.targetNodeId,
              type: 'labeled',
              animated: true,
              style: {
                stroke: color,
                strokeWidth: 2,
                opacity: 0.7,
                strokeDasharray: depType === 'conflicts_with' ? '5 5' : undefined,
              },
              data: { label: dep.relationship, depType, userCreated: true, edgeRole: 'relation' },
            };
            setEdges((prev: Edge[]) => addEdge(newEdge, prev));
            pushActivity(ideaId, {
              type: 'node_edited',
              actor: 'You',
              nodeLabel: dep.sourceLabel,
              nodeId: dep.sourceNodeId,
              detail: `Dependency → ${dep.targetLabel}`,
            });
          }}
          onAddAll={(deps) => {
            pushUndo();
            for (const dep of deps) {
              const edgeId = `dep-edge-${uid()}`;
              const depType = dep.type || 'related_to';
              const color = DEP_EDGE_COLOR[depType] ?? 'var(--c-info)';
              const newEdge: Edge = {
                id: edgeId,
                source: dep.sourceNodeId,
                target: dep.targetNodeId,
                type: 'labeled',
                animated: true,
                style: {
                  stroke: color,
                  strokeWidth: 2,
                  opacity: 0.7,
                  strokeDasharray: depType === 'conflicts_with' ? '5 5' : undefined,
                },
                data: { label: dep.relationship, depType, userCreated: true, edgeRole: 'relation' },
              };
              setEdges((prev: Edge[]) => addEdge(newEdge, prev));
            }
            pushActivity(ideaId, {
              type: 'node_edited',
              actor: 'You',
              detail: `Added ${deps.length} dependencies`,
            });
          }}
        />
      ) : null}

      {/* R1.5: AI Priority Recommender */}
      {showPriorityRecommender ? (
        <AIPriorityRecommender
          open={showPriorityRecommender}
          onClose={() => setShowPriorityRecommender(false)}
          ideaId={ideaId}
          ideaTitle={ideaTitle}
          nodes={nodes.map((n) => ({ id: n.id, data: n.data }))}
          locked={locked}
          onApplyPriorities={(updates) => {
            pushUndo();
            setNodes((prev: Node[]) =>
              prev.map((n) => {
                const upd = updates.find((u) => u.nodeId === n.id);
                if (!upd) return n;
                return { ...n, data: { ...n.data, priority: upd.priority } };
              })
            );
            pushActivity(ideaId, {
              type: 'ai_suggestion',
              actor: 'AI',
              detail: `Updated ${updates.length} node priorities`,
            });
          }}
        />
      ) : null}

      {/* R1.1: AI Auto-Clustering — DP-5: substring-match membership, flag OFF by default */}
      {heuristicAiOverlaysEnabled && showAutoClustering ? (
        <AIAutoClustering
          open={showAutoClustering}
          onClose={() => setShowAutoClustering(false)}
          ideaId={ideaId}
          ideaTitle={ideaTitle}
          nodes={nodes.map((n) => ({ id: n.id, data: n.data }))}
          locked={locked}
          onApplyClusters={(clusters) => {
            pushUndo();
            setNodes((prev: Node[]) =>
              prev.map((n) => {
                const cluster = clusters.find((c) => c.nodeIds.includes(n.id));
                if (!cluster) return n;
                return {
                  ...n,
                  data: { ...n.data, clusterColor: cluster.color, clusterName: cluster.name },
                };
              })
            );
            pushActivity(ideaId, {
              type: 'ai_suggestion',
              actor: 'AI',
              detail: `Applied ${clusters.length} clusters`,
            });
          }}
        />
      ) : null}

      {/* R1.4: AI Sentiment Analysis — DP-5: confidence-threshold heuristic, flag OFF by default */}
      {heuristicAiOverlaysEnabled && showSentimentOverlay ? (
        <AISentimentOverlay
          open={showSentimentOverlay}
          onClose={() => setShowSentimentOverlay(false)}
          ideaId={ideaId}
          ideaTitle={ideaTitle}
          nodes={nodes.map((n) => ({ id: n.id, data: n.data }))}
          locked={locked}
          onApplySentiment={(results) => {
            pushUndo();
            setNodes((prev: Node[]) =>
              prev.map((n) => {
                const r = results.find((s) => s.nodeId === n.id);
                if (!r) return n;
                const sentimentColor =
                  r.sentiment === 'positive'
                    ? 'var(--c-success)'
                    : r.sentiment === 'negative'
                      ? 'var(--c-danger)'
                      : 'var(--c-tag-8)';
                return { ...n, data: { ...n.data, sentimentColor, sentiment: r.sentiment } };
              })
            );
            pushActivity(ideaId, {
              type: 'ai_suggestion',
              actor: 'AI',
              detail: `Sentiment analysis applied to ${results.length} nodes`,
            });
          }}
        />
      ) : null}

      {/* R2.3: Comment Threads */}
      {commentNodeId &&
        (() => {
          const node = nodes.find((n) => n.id === commentNodeId);
          return (
            <NodeCommentThread
              open={!!commentNodeId}
              onClose={() => setCommentNodeId(null)}
              ideaId={ideaId}
              nodeId={commentNodeId}
              nodeLabel={node?.data?.label || commentNodeId}
              comments={nodeComments[commentNodeId] || []}
              locked={locked}
              currentUser="You"
              onAddComment={(nid, comment) => {
                setNodeComments((prev) => ({
                  ...prev,
                  [nid]: [...(prev[nid] || []), comment],
                }));
                pushActivity(ideaId, {
                  type: 'comment',
                  actor: comment.author,
                  nodeLabel: node?.data?.label,
                  nodeId: nid,
                  detail: comment.text.slice(0, 60),
                });
              }}
              onDeleteComment={(nid, commentId) => {
                setNodeComments((prev) => ({
                  ...prev,
                  [nid]: (prev[nid] || []).filter((c) => c.id !== commentId),
                }));
              }}
            />
          );
        })()}

      {/* R2.4: Activity Feed */}
      {showActivityFeed ? (
        <ActivityFeed
          open={showActivityFeed}
          onClose={() => setShowActivityFeed(false)}
          ideaId={ideaId}
          onNavigateToNode={handleNavigateToNode}
        />
      ) : null}

      {/* R5.1: Map Health Score — moved to IdeaWorkspaceTools panel */}

      {/* R5.2: Idea Funnel Analytics */}
      {showFunnelAnalytics ? (
        <IdeaFunnelAnalytics
          open={showFunnelAnalytics}
          onClose={() => setShowFunnelAnalytics(false)}
          nodes={nodes.map((n) => ({ id: n.id, data: n.data }))}
        />
      ) : null}

      {/* R4.1: Export to PowerPoint */}
      <ExportPowerPoint
        open={showExportPPTX}
        onClose={() => setShowExportPPTX(false)}
        ideaId={ideaId}
        ideaTitle={ideaTitle}
        branches={nodes
          .filter((n) => n.id.startsWith('branch-'))
          .map((bn) => ({
            branchKey: bn.data?.branchKey || '',
            label: bn.data?.label || '',
            nodes: edges
              .filter((e) => e.source === bn.id)
              .map((e) => {
                const child = nodes.find((n) => n.id === e.target);
                return child
                  ? { id: child.id, label: child.data?.label || '', status: child.data?.status }
                  : null;
              })
              .filter(Boolean) as Array<{ id: string; label: string; status?: string }>,
          }))}
      />

      {/* R4.4: Embed in Reports */}
      <EmbedInReports
        open={showEmbedInReports}
        onClose={() => setShowEmbedInReports(false)}
        ideaId={ideaId}
        ideaTitle={ideaTitle}
        nodes={nodes.map((n) => ({ id: n.id, data: n.data }))}
        edges={edges.map((e) => ({ source: e.source, target: e.target }))}
      />

      {/* R1.2: AI Competitive Landscape */}
      {showCompetitiveLandscape ? (
        <AICompetitiveLandscape
          open={showCompetitiveLandscape}
          onClose={() => setShowCompetitiveLandscape(false)}
          ideaId={ideaId}
          ideaTitle={ideaTitle}
          nodes={nodes.map((n) => ({ id: n.id, data: n.data }))}
          locked={locked}
          onAddToMap={(items) => {
            // HONEST FIX (2026-08-09, N5 czwarta fala — rejestr akcji
            // `idea.view.mm_ai_competitors`, E10 2026-08-10: przeniesione z
            // `idea.node.mm_ai_competitors` na menu tła, patrz
            // PaneContextMenu.tsx): znalezione przy wiringu, ta
            // mutacja nigdy nie wołała pushUndo(), w przeciwieństwie do
            // WSZYSTKICH innych wywołujących `idea-workspace-insert` w tym
            // pliku (onAddBlindSpot/onAddNodes×2/onImport itd.) — naprawione
            // tutaj, ten sam wzorzec co `mm_connect_to_selected` w drugiej fali.
            pushUndo();
            for (const item of items) {
              window.dispatchEvent(
                new CustomEvent('idea-workspace-insert', {
                  detail: { items: [item], ideaId },
                })
              );
            }
            pushActivity(ideaId, {
              type: 'ai_suggestion',
              actor: 'AI',
              detail: `Competitive landscape: ${items.length} items`,
            });
          }}
        />
      ) : null}

      {/* R5.3: Branch Comparison */}
      {showBranchComparison ? (
        <BranchComparison
          open={showBranchComparison}
          onClose={() => setShowBranchComparison(false)}
          nodes={nodes.map((n) => ({ id: n.id, data: n.data }))}
          edges={edges.map((e) => ({ source: e.source, target: e.target }))}
        />
      ) : null}

      {/* R5.4: Time Heatmap */}
      {showTimeHeatmap ? (
        <TimeHeatmap
          open={showTimeHeatmap}
          onClose={() => setShowTimeHeatmap(false)}
          ideaId={ideaId}
        />
      ) : null}

      {/* R4.2: Export Diagram Code */}
      {showExportDiagramCode ? (
        <ExportDiagramCode
          open={showExportDiagramCode}
          onClose={() => setShowExportDiagramCode(false)}
          ideaTitle={ideaTitle}
          nodes={nodes.map((n) => ({ id: n.id, data: n.data }))}
          edges={edges.map((e) => ({ source: e.source, target: e.target }))}
        />
      ) : null}

      {/* R4.3: Import External Map */}
      {showImportExternalMap ? (
        <ImportExternalMap
          open={showImportExternalMap}
          onClose={() => setShowImportExternalMap(false)}
          locked={locked}
          onImport={(items) => {
            pushUndo();
            for (const item of items) {
              window.dispatchEvent(
                new CustomEvent('idea-workspace-insert', {
                  detail: { items: [{ text: item.label, type: 'topics' }], ideaId },
                })
              );
            }
            pushActivity(ideaId, {
              type: 'node_added',
              actor: 'You',
              detail: `Imported ${items.length} nodes from external file`,
            });
          }}
        />
      ) : null}

      {/* GAP-3: Structure Picker Popover */}
      {showStructurePicker && (
        <div className="fixed inset-0 z-overlay" onClick={() => setShowStructurePicker(false)}>
          <div
            className="absolute top-16 left-1/2 -translate-x-1/2"
            onClick={(e) => e.stopPropagation()}
          >
            <StructurePickerPopover
              isPl={isPolish}
              current={structureType}
              onSelect={(type) => {
                // Closure (2026-08-10, `idea.view.mm_structure_type` in
                // ideaActionRegistry.ts): routed through the SAME bus event
                // Teresa uses (and MindmapCommandPalette.tsx:330 already used)
                // instead of duplicating pushUndo+setStructureType+
                // applyStructureLayout+setNodes+fitView a second time in this
                // component — one real mechanism (useMindMapQuickActions.ts
                // `mm_set_structure`), not two.
                window.dispatchEvent(
                  new CustomEvent('idea-workspace-quick-action', {
                    detail: { action: 'mm_set_structure', structureType: type },
                  })
                );
              }}
              onClose={() => setShowStructurePicker(false)}
            />
          </div>
        </div>
      )}

      {/* R3.3: 3D Mind Map View */}
      {showMindMap3D ? (
        <MindMap3DView
          open={showMindMap3D}
          onClose={() => setShowMindMap3D(false)}
          ideaTitle={ideaTitle}
          nodes={nodes.map((n) => ({ id: n.id, data: n.data, position: n.position }))}
          edges={edges.map((e) => ({ source: e.source, target: e.target }))}
        />
      ) : null}

      {/* R2.1+R2.2: Collaboration Overlay (auto-hides when no connection) */}
      {enrichedNodes.length > 0 ? (
        <CollaborationOverlay
          ideaId={ideaId}
          currentUserId={currentUser?.id || 'anonymous'}
          currentUserName={currentUserName}
          selectedNodeIds={selectedNodeIds}
          onSessionStateChange={handleCollabSessionStateChange}
          onRegisterSend={registerCollabSend}
        />
      ) : null}

      {/* Export format menu */}
      {exportMenuOpen && (
        <div
          className="fixed inset-0 z-context-menu flex items-center justify-center bg-black/20"
          onClick={() => setExportMenuOpen(false)}
        >
          <div
            className="w-56 rounded-lg border border-c-border bg-c-surface p-2 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 px-2 text-[10px] font-bold uppercase tracking-wider text-slate-600">
              {t('mindmap.exportFormat')}
            </div>
            {[
              { key: 'png', label: 'PNG', fn: () => exportAsPNG(`${ideaTitle || 'mindmap'}.png`) },
              { key: 'svg', label: 'SVG', fn: () => exportAsSVG(`${ideaTitle || 'mindmap'}.svg`) },
              {
                key: 'json',
                label: 'JSON',
                fn: () => exportAsJSON(nodes, edges, extensions, `${ideaTitle || 'mindmap'}.json`),
              },
              {
                key: 'md',
                label: t('mindmap.markdownOutline'),
                fn: () => {
                  exportAsMarkdown(
                    nodes,
                    edges,
                    { includeMetadata: true },
                    `${ideaTitle || 'mindmap'}.md`
                  );
                  toast.success(t('mindmap.markdownCopiedToClipboard'));
                },
              },
            ].map((opt) => (
              <button
                key={opt.key}
                onClick={() => {
                  opt.fn();
                  setExportMenuOpen(false);
                }}
                className="w-full rounded px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-navy-800"
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Inline modals replacing window.prompt */}
      {assignModalNodeId ? (
        <AssignPersonModal
          open={!!assignModalNodeId}
          onClose={() => setAssignModalNodeId(null)}
          currentAssignee={
            assignModalNodeId
              ? nodes.find((n) => n.id === assignModalNodeId)?.data?.assignee
              : undefined
          }
          recentAssignees={nodes.filter((n) => n.data?.assignee).map((n) => n.data.assignee)}
          onAssign={(name) => {
            if (assignModalNodeId) {
              updateNodeDataById(assignModalNodeId, (data: any) => ({ ...data, assignee: name }));
              toast.success(t('mindmap.assignedName', { name }), {
                duration: 1000,
              });
            }
          }}
        />
      ) : null}
      {attachArtifactNodeId ? (
        <AttachArtifactModal
          open={!!attachArtifactNodeId}
          onClose={() => setAttachArtifactNodeId(null)}
          onAttach={(type, id, label) => {
            if (attachArtifactNodeId) {
              void (async () => {
                try {
                  await Api.attachArtifactToObject(ideaId, attachArtifactNodeId, {
                    artifactRef: { type, id },
                    label,
                    linkRole: 'related',
                    baseVersion: externalRuntime?.version ?? localVersionRef.current,
                  });
                  if (externalRuntime) {
                    await externalRuntime.refresh();
                  } else {
                    updateNodeDataById(attachArtifactNodeId, (data: any) => ({
                      ...data,
                      artifactLinks: [
                        ...(Array.isArray(data.artifactLinks) ? data.artifactLinks : []),
                        buildArtifactLink(type, id, 'related', label),
                      ],
                    }));
                  }
                  toast.success(t('mindmap.artifactAttached'), {
                    duration: 900,
                  });
                } catch (err: any) {
                  const conflictVersion = getMapVersionFromPayload(err?.data);
                  if (conflictVersion) {
                    localVersionRef.current = Math.max(
                      localVersionRef.current || 1,
                      conflictVersion
                    );
                  }
                  if (err?.status === 409 && externalRuntime) {
                    await externalRuntime.refresh().catch(() => {});
                  }
                  toast.error(err?.message || t('mindmap.failedToAttachArtifact'));
                }
              })();
            }
          }}
        />
      ) : null}
      {imageUrlNodeId ? (
        <ImageUrlModal
          open={!!imageUrlNodeId}
          onClose={() => setImageUrlNodeId(null)}
          onSubmit={(url) => {
            if (imageUrlNodeId) {
              updateNodeDataById(imageUrlNodeId, (data: any) => ({ ...data, imageUrl: url }));
              toast.success(t('mindmap.imageAdded'), { duration: 800 });
            }
          }}
        />
      ) : null}

      {debugEnabled && (
        <div
          data-mm-debug-overlay="true"
          className="absolute bottom-2 left-2 z-context-menu w-[560px] max-w-[calc(100vw-1rem)] rounded-2xl bg-black/95 text-[10px] font-mono text-green-200 pointer-events-auto backdrop-blur-sm border border-green-500/30 shadow-2xl shadow-black/40 select-text"
        >
          <div className="sticky top-0 z-10 border-b border-green-500/20 bg-black/95 px-3 py-2">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-green-300">
                  DEBUG INSPECTOR ({debugStats.total})
                </div>
                <div className="mt-1 flex flex-wrap gap-1 text-[9px]">
                  <span className="rounded bg-white/5 px-1.5 py-0.5 text-blue-300">
                    inputs {debugStats.inputs}
                  </span>
                  <span className="rounded bg-white/5 px-1.5 py-0.5 text-emerald-300">
                    handlers {debugStats.handlers}
                  </span>
                  <span className="rounded bg-white/5 px-1.5 py-0.5 text-violet-300">
                    custom {debugStats.customs}
                  </span>
                  <span className="rounded bg-white/5 px-1.5 py-0.5 text-amber-300">
                    blocked {debugStats.blocked}
                  </span>
                  <span className="rounded bg-white/5 px-1.5 py-0.5 text-amber-300">
                    silent {debugStats.silent}
                  </span>
                  <span className="rounded bg-white/5 px-1.5 py-0.5 text-danger-300">
                    errors {debugStats.errors}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-[9px]">
                <button
                  onClick={() => {
                    setDebugPaused((prev) => !prev);
                    setDebugTick((t) => t + 1);
                  }}
                  className={
                    debugPaused
                      ? 'text-amber-300 hover:text-amber-200'
                      : 'text-emerald-300 hover:text-emerald-200'
                  }
                >
                  {debugPaused ? 'resume' : 'pause'}
                </button>
                <button
                  onClick={() => setDebugOverlayExpanded((prev) => !prev)}
                  className="text-blue-300 hover:text-blue-200"
                >
                  {debugOverlayExpanded ? 'collapse' : 'expand'}
                </button>
                <button
                  onClick={() => {
                    const lines = debugEntriesRef.current.map((entry) =>
                      [
                        `[${entry.ts}]`,
                        entry.source.toUpperCase(),
                        entry.message,
                        entry.detail || '',
                      ]
                        .filter(Boolean)
                        .join(' | ')
                    );
                    navigator.clipboard?.writeText(lines.join('\n'));
                  }}
                  className="text-blue-300 hover:text-blue-200"
                >
                  copy
                </button>
                <button
                  onClick={() => {
                    for (const pending of pendingInteractionsRef.current.values()) {
                      window.clearTimeout(pending.timeoutId);
                    }
                    pendingInteractionsRef.current.clear();
                    debugEntriesRef.current = [];
                    sessionStorage.removeItem(DEBUG_SESSION_KEY);
                    sessionStorage.removeItem(LEGACY_DEBUG_SESSION_KEY);
                    lastInputSummaryRef.current = 'none';
                    lastHandlerSummaryRef.current = 'none';
                    setDebugTick((t) => t + 1);
                  }}
                  className="text-danger-300 hover:text-danger-200"
                >
                  clear
                </button>
              </div>
            </div>
            <div className="mt-2 space-y-1 text-[9px] text-slate-600">
              <div>last input: {lastInputSummaryRef.current}</div>
              <div>last handler: {lastHandlerSummaryRef.current}</div>
              {debugPaused && (
                <div className="text-amber-300">stream paused, logs still collected</div>
              )}
            </div>
          </div>

          {debugOverlayExpanded && (
            <div className="max-h-[38vh] overflow-y-auto px-2 py-2">
              {debugEntries.length === 0 ? (
                <div className="px-2 py-3 text-slate-600">No events yet.</div>
              ) : (
                debugEntries.map((entry) => {
                  const lineClass =
                    entry.severity === 'error'
                      ? 'text-danger-300'
                      : entry.reaction === 'silent'
                        ? 'text-amber-300'
                        : entry.reaction === 'blocked'
                          ? 'text-amber-300'
                          : entry.source === 'input'
                            ? 'text-blue-300'
                            : entry.source === 'keyboard'
                              ? 'text-sky-300'
                              : entry.source === 'custom'
                                ? 'text-violet-300'
                                : entry.source === 'persistence'
                                  ? 'text-blue-300'
                                  : entry.source === 'selection'
                                    ? 'text-lime-300'
                                    : 'text-green-200';
                  return (
                    <div
                      key={entry.id}
                      className={`rounded-lg px-2 py-1 mb-1 bg-white/[0.03] border border-white/[0.04] ${lineClass}`}
                    >
                      <div className="flex items-start gap-2">
                        <span className="shrink-0 text-slate-500">[{entry.ts}]</span>
                        <span className="shrink-0 uppercase opacity-70">{entry.source}</span>
                        <span className="break-words">{entry.message}</span>
                      </div>
                      {entry.detail && (
                        <div className="mt-0.5 pl-[88px] text-slate-600 break-words">
                          {entry.detail}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      <BranchSummaryPanel
        open={summaryPanelOpen}
        onClose={() => setSummaryPanelOpen(false)}
        ideaId={ideaId}
        ideaTitle={ideaTitle || ''}
        branchNodeId={summaryBranchId}
        branchLabel={summaryBranchLabel}
        nodes={nodes}
        edges={edges}
      />

      <MindmapCommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onAction={(action) => {
          setCommandPaletteOpen(false);
          window.dispatchEvent(
            new CustomEvent('idea-workspace-quick-action', { detail: { action, ideaId } })
          );
        }}
      />

      <LargeMapOptimizer
        nodeCount={nodes.length}
        edgeCount={edges.length}
        onToggleSimplifiedMode={setSimplifiedMode}
      />

      {/* MYW-IDEAS-011: previously mounted only in IdeaWhiteboardTool, so the
          same owner-approved (source/preview/apply/dismiss, durable
          dismissal, no silent mutation) AI nudge strip was invisible in
          Mind Map. `mm_ai_expand`/`mm_ai_summarize` are the tool's own real
          quick actions (useMindMapQuickActions.ts), dispatched the same way
          MindmapCommandPalette above already dispatches every other mm_*
          action — not a borrowed/foreign handler like whiteboard needed. */}
      {nodes.length > 0 && (
        <IdeaAINudgeStrip
          ideaId={ideaId}
          userId={currentUser?.id || null}
          organizationId={currentUser?.organizationId || null}
          activeTool={'mindmap' as any}
          title={ideaTitle}
          seedText={seedText}
          isAccepted
          graphNodes={nodes as any[]}
          graphEdges={edges as any[]}
          onActionExpand={() => {
            window.dispatchEvent(
              new CustomEvent('idea-workspace-quick-action', {
                detail: { action: 'mm_ai_expand', ideaId },
              })
            );
            return { status: 'handed_off' as const };
          }}
          onActionConvert={() => {
            window.dispatchEvent(
              new CustomEvent('idea-workspace-quick-action', {
                detail: { action: 'mm_ai_summarize', ideaId },
              })
            );
            return { status: 'handed_off' as const };
          }}
        />
      )}
      {subtreeDeleteDialog}
    </div>
  );
}

export const IdeaRecommendationMap: React.FC<IdeaRecommendationMapProps> = (props) => (
  <ReactFlowProvider>
    <MindMapInner {...props} />
  </ReactFlowProvider>
);

export default IdeaRecommendationMap;
