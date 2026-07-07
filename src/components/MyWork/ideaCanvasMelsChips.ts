/**
 * ideaCanvasMelsChips — per-tool command-row chips + right-rail inspector
 * descriptors for `IdeaCanvasMelsView` (EditorShell Wave W-1).
 *
 * Pure builders (no React state) so `IdeaMapWorkspace` can memoise them from
 * its existing handlers. Mind Map is the reference; Process Flow / Idea Table /
 * Whiteboard get their own sensible 1-4 primary actions since they share the
 * same chrome but have different core verbs.
 *
 * Hierarchy (editor-shell-canon § 2 STREFA GÓRNA):
 *   - `group: 'primary'`   → 1-4 prominent always-visible actions per tool.
 *   - `group: 'secondary'` → grouped ghost buttons.
 *   - `group: 'overflow'`  → folded behind the `⋯` menu (search / help / etc.).
 *
 * CRIMSON-SAFE: no `primary-*` classes anywhere — chips are styled centrally by
 * `<TopBar>` (neutral + `c-focus`), tone only via semantic `dotTone`.
 */

import {
  Download,
  GitBranch,
  HelpCircle,
  LayoutTemplate,
  MessagesSquare,
  Plus,
  Search,
  Sparkles,
  Table2,
  Waypoints,
} from 'lucide-react';

import type {
  RightRailToolDescriptor,
  TopBarChipDescriptor,
} from '@/components/shared/ExecutiveModuleShell';

import type { CanvasToolType } from './ideaSelectionTypes';

export interface IdeaCanvasChipHandlers {
  /** Primary "add" verb for the active tool (add node / shape / row / sticky). */
  onAddPrimary?: () => void;
  /** Auto-layout / tidy (mind map + process flow). */
  onAutoLayout?: () => void;
  /** Convert-from-canvas ("Utwórz z mapy"). */
  onConvert?: () => void;
  /** "Discuss with Teresa". */
  onDiscuss?: () => void;
  /** AI expand / suggestions. */
  onAIExpand?: () => void;
  /** Apply / open template gallery. */
  onOpenTemplateGallery?: () => void;
  /** Export menu. */
  onExport?: () => void;
  /** In-canvas search. */
  onSearch?: () => void;
  /** Keyboard-shortcuts help. */
  onShowHelp?: () => void;
}

export interface IdeaCanvasChipState {
  /** Disables Convert / Discuss / Export when the canvas is empty. */
  hasContent?: boolean;
}

export interface IdeaCanvasChipLabels {
  addNode: string;
  addShape: string;
  addRow: string;
  addSticky: string;
  autoLayout: string;
  convert: string;
  discuss: string;
  aiExpand: string;
  templates: string;
  export: string;
  search: string;
  help: string;
}

export const DEFAULT_IDEA_CANVAS_CHIP_LABELS: IdeaCanvasChipLabels = {
  addNode: 'Add node',
  addShape: 'Add shape',
  addRow: 'Add row',
  addSticky: 'Add sticky',
  autoLayout: 'Auto-layout',
  convert: 'Convert',
  discuss: 'Discuss with Teresa',
  aiExpand: 'AI expand',
  templates: 'Templates',
  export: 'Export',
  search: 'Search',
  help: 'Shortcuts',
};

const ADD_LABEL: Record<CanvasToolType, keyof IdeaCanvasChipLabels> = {
  mindmap: 'addNode',
  process_flow: 'addShape',
  table: 'addRow',
  whiteboard: 'addSticky',
};

const ADD_ICON: Record<CanvasToolType, TopBarChipDescriptor['icon']> = {
  mindmap: Plus,
  process_flow: Waypoints,
  table: Table2,
  whiteboard: Plus,
};

/**
 * Build the command-row chips for the given tool. Per-tool primary sets:
 *   - Mind Map      : Add node · Auto-layout · Convert · Discuss with Teresa
 *   - Process Flow  : Add shape · Auto-layout · Convert · Discuss with Teresa
 *   - Idea Table    : Add row · Convert · Discuss with Teresa
 *   - Whiteboard    : Add sticky · Convert · Discuss with Teresa
 * Secondary: AI expand · Templates · Export. Overflow: Search · Shortcuts.
 */
export function buildIdeaCanvasTopBarChips(args: {
  tool: CanvasToolType;
  handlers: IdeaCanvasChipHandlers;
  state?: IdeaCanvasChipState;
  labels?: Partial<IdeaCanvasChipLabels>;
}): TopBarChipDescriptor[] {
  const { tool, handlers, state } = args;
  const labels = { ...DEFAULT_IDEA_CANVAS_CHIP_LABELS, ...args.labels };
  const hasContent = state?.hasContent ?? true;
  const supportsAutoLayout = tool === 'mindmap' || tool === 'process_flow';

  const chips: TopBarChipDescriptor[] = [];

  // PRIMARY 1 — Add (always available; core creation verb per tool).
  if (handlers.onAddPrimary) {
    chips.push({
      id: 'canvas-add',
      label: labels[ADD_LABEL[tool]],
      icon: ADD_ICON[tool],
      group: 'primary',
      onClick: handlers.onAddPrimary,
      testId: 'idea-canvas-chip-add',
    });
  }

  // PRIMARY 2 — Auto-layout (mind map + process flow only).
  if (supportsAutoLayout && handlers.onAutoLayout) {
    chips.push({
      id: 'canvas-auto-layout',
      label: labels.autoLayout,
      icon: LayoutTemplate,
      group: 'primary',
      onClick: handlers.onAutoLayout,
      testId: 'idea-canvas-chip-auto-layout',
    });
  }

  // PRIMARY 3 — Convert ("Utwórz z mapy").
  if (handlers.onConvert) {
    chips.push({
      id: 'canvas-convert',
      label: labels.convert,
      icon: GitBranch,
      group: 'primary',
      disabled: !hasContent,
      onClick: handlers.onConvert,
      testId: 'idea-canvas-chip-convert',
    });
  }

  // PRIMARY 4 — Discuss with Teresa (unified AI entry).
  if (handlers.onDiscuss) {
    chips.push({
      id: 'canvas-discuss',
      label: labels.discuss,
      icon: MessagesSquare,
      group: 'primary',
      disabled: !hasContent,
      onClick: handlers.onDiscuss,
      testId: 'idea-canvas-chip-discuss',
    });
  }

  // SECONDARY — AI expand / Templates / Export.
  if (handlers.onAIExpand) {
    chips.push({
      id: 'canvas-ai-expand',
      label: labels.aiExpand,
      icon: Sparkles,
      group: 'secondary',
      onClick: handlers.onAIExpand,
      testId: 'idea-canvas-chip-ai-expand',
    });
  }
  if (handlers.onOpenTemplateGallery) {
    chips.push({
      id: 'canvas-templates',
      label: labels.templates,
      icon: LayoutTemplate,
      group: 'secondary',
      onClick: handlers.onOpenTemplateGallery,
      testId: 'idea-canvas-chip-templates',
    });
  }
  if (handlers.onExport) {
    chips.push({
      id: 'canvas-export',
      label: labels.export,
      icon: Download,
      group: 'secondary',
      disabled: !hasContent,
      onClick: handlers.onExport,
      testId: 'idea-canvas-chip-export',
    });
  }

  // OVERFLOW — Search / Shortcuts (rare, folded behind `⋯`).
  if (handlers.onSearch) {
    chips.push({
      id: 'canvas-search',
      label: labels.search,
      icon: Search,
      group: 'overflow',
      overflowSection: 'Canvas',
      onClick: handlers.onSearch,
      testId: 'idea-canvas-chip-search',
    });
  }
  if (handlers.onShowHelp) {
    chips.push({
      id: 'canvas-help',
      label: labels.help,
      icon: HelpCircle,
      group: 'overflow',
      overflowSection: 'Canvas',
      onClick: handlers.onShowHelp,
      testId: 'idea-canvas-chip-help',
    });
  }

  return chips;
}

/**
 * Right-rail inspector tabs (≤5, D-W-2): Problem · Status · Inspector(tool) ·
 * Convert · Health. Descriptors only carry id/label/icon; the host renders the
 * matching existing panel content via `renderRightRailPanel(activeToolId)`.
 */
export type IdeaCanvasRightToolId =
  | 'problem'
  | 'status'
  | 'inspector'
  | 'convert'
  | 'health';

export interface IdeaCanvasRightRailLabels {
  problem: string;
  status: string;
  inspector: string;
  convert: string;
  health: string;
}

export const DEFAULT_IDEA_CANVAS_RIGHT_RAIL_LABELS: IdeaCanvasRightRailLabels = {
  problem: 'Problem',
  status: 'Status',
  inspector: 'Inspector',
  convert: 'Convert',
  health: 'Health',
};

export function buildIdeaCanvasRightRailTools(args?: {
  labels?: Partial<IdeaCanvasRightRailLabels>;
  disabled?: Partial<Record<IdeaCanvasRightToolId, boolean>>;
}): RightRailToolDescriptor[] {
  const labels = { ...DEFAULT_IDEA_CANVAS_RIGHT_RAIL_LABELS, ...args?.labels };
  const disabled = args?.disabled ?? {};
  return [
    { id: 'problem', label: labels.problem, icon: HelpCircle, disabled: disabled.problem },
    { id: 'status', label: labels.status, icon: GitBranch, disabled: disabled.status },
    { id: 'inspector', label: labels.inspector, icon: Sparkles, disabled: disabled.inspector },
    { id: 'convert', label: labels.convert, icon: Waypoints, disabled: disabled.convert },
    { id: 'health', label: labels.health, icon: LayoutTemplate, disabled: disabled.health },
  ];
}
