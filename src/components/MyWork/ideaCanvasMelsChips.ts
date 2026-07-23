/**
 * ideaCanvasMelsChips — Menu-1 command chips + Menu-3 view actions + right-rail
 * inspector descriptors for `IdeaCanvasMelsView` (EditorShell Wave W-1).
 *
 * Pure builders (no React state) so `IdeaMapWorkspace` can memoise them from
 * its existing handlers.
 *
 * ANATOMY (Z7 — Menu 1 / Menu 3 split, editor-shell-canon § 2):
 *   - Menu 1 (górny pasek) stays CLEAN: identity (breadcrumb · tool icon ·
 *     title · stage chip · saved indicator) + ONE primary "Konwertuj ▾"
 *     (rendered by the host as `primaryActionSlot`) + ghost "Teresa" (secondary
 *     chip) + kebab `⋯` (overflow chips: Eksport · Historia · Duplikuj · Usuń)
 *     + right-panel toggle (shell).
 *   - Menu 3 (druga listwa POD Menu 1) carries the per-tool VIEW actions that
 *     used to live in the top bar: Dodaj węzeł · Auto-układ · AI rozwiń ·
 *     Szablony · (prawa) Eksport · Utwórz z mapy.
 *
 * CRIMSON-SAFE: zero crimson tokens (the tailwind `primary` family / the accent
 * token) anywhere — chips are styled centrally by `<TopBar>` (neutral +
 * `c-focus`); the second bar / convert menu use `bg-c-text text-c-surface` for
 * the sole primary CTA and `text-c-danger` only for the destructive kebab row.
 */

import {
  Copy,
  Download,
  GitBranch,
  HelpCircle,
  History,
  LayoutDashboard,
  LayoutTemplate,
  MessagesSquare,
  Plus,
  Search,
  Sparkles,
  StickyNote,
  Table2,
  Trash2,
  Workflow,
  type LucideIcon,
} from 'lucide-react';

import type {
  RightRailToolDescriptor,
  TopBarChipDescriptor,
} from '@/components/shared/ExecutiveModuleShell';

import type { CanvasToolType } from './ideaSelectionTypes';

// ── Per-tool identity icon (SSOT: superCanvasTypes.OBJECT_FAMILY_ICONS) ──────
export const IDEA_TOOL_ICON: Record<CanvasToolType, LucideIcon> = {
  mindmap: GitBranch,
  whiteboard: StickyNote,
  process_flow: Workflow,
  table: Table2,
};

// ── Menu 1 (top bar) — command chips ────────────────────────────────────────
export interface IdeaMenu1Handlers {
  /** "Discuss with Teresa" (ghost). */
  onDiscuss?: () => void;
  /** Export menu (real; also present on Menu 3). */
  onExport?: () => void;
  /** Version history — disabled placeholder until wired. */
  onHistory?: () => void;
  /** Duplicate idea — disabled placeholder until wired. */
  onDuplicate?: () => void;
  /** Delete idea — disabled placeholder until wired. */
  onDelete?: () => void;
  /** In-canvas search (folded under "Więcej"). */
  onSearch?: () => void;
  /** Keyboard-shortcuts help (folded under "Więcej"). */
  onShowHelp?: () => void;
}

/**
 * Menu 1 chip strip = ghost Teresa (secondary) + kebab `⋯` (overflow).
 * The primary "Konwertuj ▾" is NOT a chip — it is supplied by the host as the
 * shell's `primaryActionSlot` (needs a dropdown the flat chip contract can't
 * express). The right-panel toggle is the shell's own affordance.
 *
 * Kebab order (editor-shell-canon overflow pattern):
 *   default section  → Eksport · Historia · Duplikuj · Usuń (Usuń = danger)
 *   "Więcej" section → Szukaj · Skróty
 */
export function buildIdeaMenu1Chips(args: {
  handlers: IdeaMenu1Handlers;
  isPolish: boolean;
}): TopBarChipDescriptor[] {
  const { handlers, isPolish } = args;
  const soon = isPolish ? 'Wkrótce' : 'Coming soon';
  const chips: TopBarChipDescriptor[] = [];

  // Ghost Teresa — always-visible secondary entry to the unified AI.
  if (handlers.onDiscuss) {
    chips.push({
      id: 'idea-teresa',
      label: 'Teresa',
      icon: MessagesSquare,
      group: 'secondary',
      onClick: handlers.onDiscuss,
      tooltip: isPolish ? 'Omów z Teresą' : 'Discuss with Teresa',
      testId: 'idea-menu1-teresa',
    });
  }

  // Kebab `⋯` — document-level actions.
  chips.push({
    id: 'idea-export',
    label: isPolish ? 'Eksport' : 'Export',
    icon: Download,
    group: 'overflow',
    disabled: !handlers.onExport,
    onClick: handlers.onExport,
    testId: 'idea-menu1-export',
  });
  chips.push({
    id: 'idea-history',
    label: isPolish ? 'Historia' : 'History',
    icon: History,
    group: 'overflow',
    // Enabled once a version-history flow is wired (SnapshotHistory, all canvas
    // tools). Stays honest-disabled only if the caller passes no handler.
    disabled: !handlers.onHistory,
    onClick: handlers.onHistory,
    tooltip: handlers.onHistory ? undefined : soon,
    testId: 'idea-menu1-history',
  });
  chips.push({
    id: 'idea-duplicate',
    label: isPolish ? 'Duplikuj' : 'Duplicate',
    icon: Copy,
    group: 'overflow',
    disabled: !handlers.onDuplicate,
    onClick: handlers.onDuplicate,
    tooltip: handlers.onDuplicate ? undefined : soon,
    testId: 'idea-menu1-duplicate',
  });
  chips.push({
    id: 'idea-delete',
    label: isPolish ? 'Usuń' : 'Delete',
    icon: Trash2,
    group: 'overflow',
    danger: true,
    disabled: !handlers.onDelete,
    onClick: handlers.onDelete,
    tooltip: handlers.onDelete ? undefined : soon,
    testId: 'idea-menu1-delete',
  });

  // "Więcej" — power-user overflow (kept reachable, never hidden).
  if (handlers.onSearch) {
    chips.push({
      id: 'idea-search',
      label: isPolish ? 'Szukaj' : 'Search',
      icon: Search,
      group: 'overflow',
      overflowSection: isPolish ? 'Więcej' : 'More',
      onClick: handlers.onSearch,
      testId: 'idea-menu1-search',
    });
  }
  if (handlers.onShowHelp) {
    chips.push({
      id: 'idea-shortcuts',
      label: isPolish ? 'Skróty' : 'Shortcuts',
      icon: HelpCircle,
      group: 'overflow',
      overflowSection: isPolish ? 'Więcej' : 'More',
      onClick: handlers.onShowHelp,
      testId: 'idea-menu1-shortcuts',
    });
  }

  return chips;
}

// ── Menu 3 (second bar) — per-tool view actions ─────────────────────────────
export interface IdeaMenu3Action {
  id: string;
  label: string;
  icon: LucideIcon;
  onClick?: () => void;
  disabled?: boolean;
  tooltip?: string;
  testId?: string;
}

export interface IdeaMenu3Handlers {
  /** Primary "add" verb for the active tool. */
  onAddPrimary?: () => void;
  /** Auto-layout / tidy (mind map + process flow only). */
  onAutoLayout?: () => void;
  /** AI expand / suggestions. */
  onAIExpand?: () => void;
  /** Template gallery. */
  onOpenTemplateGallery?: () => void;
  /** Export (real; mirrors the kebab entry). */
  onExport?: () => void;
  /** Open the Convert panel ("Utwórz z mapy"). */
  onConvertFromMap?: () => void;
}

const MENU3_ADD_LABEL: Record<CanvasToolType, { en: string; pl: string }> = {
  mindmap: { en: 'Add node', pl: 'Dodaj węzeł' },
  process_flow: { en: 'Add shape', pl: 'Dodaj kształt' },
  table: { en: 'Add row', pl: 'Dodaj wiersz' },
  whiteboard: { en: 'Add sticky', pl: 'Dodaj karteczkę' },
};

const MENU3_ADD_ICON: Record<CanvasToolType, LucideIcon> = {
  mindmap: Plus,
  process_flow: Workflow,
  table: Table2,
  whiteboard: Plus,
};

/**
 * Build the Menu-3 view actions, split into a left cluster (create / shape the
 * view) and a right cluster (Eksport · Utwórz z mapy). `hasContent` gates the
 * actions that need a non-empty canvas.
 */
export function buildIdeaMenu3Actions(args: {
  tool: CanvasToolType;
  handlers: IdeaMenu3Handlers;
  hasContent: boolean;
  isPolish: boolean;
}): { left: IdeaMenu3Action[]; right: IdeaMenu3Action[] } {
  const { tool, handlers, hasContent, isPolish } = args;
  const pl = isPolish;
  const supportsAutoLayout = tool === 'mindmap' || tool === 'process_flow';

  const left: IdeaMenu3Action[] = [];
  const right: IdeaMenu3Action[] = [];

  if (handlers.onAddPrimary) {
    left.push({
      id: 'menu3-add',
      label: MENU3_ADD_LABEL[tool][pl ? 'pl' : 'en'],
      icon: MENU3_ADD_ICON[tool],
      onClick: handlers.onAddPrimary,
      testId: 'idea-menu3-add',
    });
  }
  if (supportsAutoLayout && handlers.onAutoLayout) {
    left.push({
      id: 'menu3-auto-layout',
      label: pl ? 'Auto-układ' : 'Auto-layout',
      icon: LayoutDashboard,
      onClick: handlers.onAutoLayout,
      testId: 'idea-menu3-auto-layout',
    });
  }
  if (handlers.onAIExpand) {
    left.push({
      id: 'menu3-ai-expand',
      label: pl ? 'AI rozwiń' : 'AI expand',
      icon: Sparkles,
      onClick: handlers.onAIExpand,
      testId: 'idea-menu3-ai-expand',
    });
  }
  if (handlers.onOpenTemplateGallery) {
    left.push({
      id: 'menu3-templates',
      label: pl ? 'Szablony' : 'Templates',
      icon: LayoutTemplate,
      onClick: handlers.onOpenTemplateGallery,
      testId: 'idea-menu3-templates',
    });
  }

  if (handlers.onExport) {
    right.push({
      id: 'menu3-export',
      label: pl ? 'Eksport' : 'Export',
      icon: Download,
      onClick: handlers.onExport,
      disabled: !hasContent,
      tooltip: hasContent ? undefined : pl ? 'Pusta mapa' : 'Empty map',
      testId: 'idea-menu3-export',
    });
  }
  if (handlers.onConvertFromMap) {
    right.push({
      id: 'menu3-convert-from-map',
      label: pl ? 'Utwórz z mapy' : 'Create from map',
      icon: GitBranch,
      onClick: handlers.onConvertFromMap,
      disabled: !hasContent,
      tooltip: hasContent ? undefined : pl ? 'Pusta mapa' : 'Empty map',
      testId: 'idea-menu3-convert-from-map',
    });
  }

  return { left, right };
}

/**
 * Right-rail inspector tabs (≤5, D-W-2): Problem · Status · Inspector(tool) ·
 * Convert · Health. Descriptors only carry id/label/icon; the host renders the
 * matching existing panel content via `renderRightRailPanel(activeToolId)`.
 */
export type IdeaCanvasRightToolId = 'problem' | 'status' | 'inspector' | 'convert' | 'health';

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
  /**
   * Why a tab is unavailable for the active representation. A tab whose section
   * renders nothing MUST be disabled with a reason — a clickable icon that
   * opens an empty panel is a dead click.
   */
  disabledReasons?: Partial<Record<IdeaCanvasRightToolId, string>>;
}): RightRailToolDescriptor[] {
  const labels = { ...DEFAULT_IDEA_CANVAS_RIGHT_RAIL_LABELS, ...args?.labels };
  const disabled = args?.disabled ?? {};
  const powody = args?.disabledReasons ?? {};
  return [
    {
      id: 'problem',
      label: labels.problem,
      icon: HelpCircle,
      disabled: disabled.problem,
      disabledReason: powody.problem,
    },
    {
      id: 'status',
      label: labels.status,
      icon: GitBranch,
      disabled: disabled.status,
      disabledReason: powody.status,
    },
    {
      id: 'inspector',
      label: labels.inspector,
      icon: Sparkles,
      disabled: disabled.inspector,
      disabledReason: powody.inspector,
    },
    {
      id: 'convert',
      label: labels.convert,
      icon: Workflow,
      disabled: disabled.convert,
      disabledReason: powody.convert,
    },
    {
      id: 'health',
      label: labels.health,
      icon: LayoutTemplate,
      disabled: disabled.health,
      disabledReason: powody.health,
    },
  ];
}
