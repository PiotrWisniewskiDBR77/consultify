/**
 * IdeaCanvasContextMenu — right-click context menu for canvas tools.
 *
 * Base ops (K1/Miro parity), on node only: Edit label, Duplicate, Copy,
 * Delete, Lock, Layer (bring to front / send to back).
 * AI actions, on node: Expand, Challenge, Find evidence, Suggest connections.
 * On empty space: Fill gap, Brainstorm here.
 */
import {
  BookOpen,
  Boxes,
  Brain,
  BringToFront,
  Clipboard,
  ClipboardPaste,
  Copy,
  FolderInput,
  FolderOutput,
  GitBranch,
  Layers,
  Lightbulb,
  Link2,
  ListChecks,
  Loader2,
  Lock,
  Maximize2,
  MessageSquare,
  Network,
  PackageOpen,
  Pencil,
  Search,
  SendToBack,
  Sparkles,
  Table2,
  Tags,
  Target,
  Trash2,
  Unlock,
} from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  type ActionContext,
  getActionsForSurface,
  runIdeaAction,
} from '@/actions/ideaActionRegistry';
import { CanvasContextMenu } from '@/components/shared/CanvasContextMenu';
import i18n from '@/i18n';
import { generateAIProposal, type GeneratorType } from '@/services/ideaAIGenerator';

import { getCanvasNodeTypeLabel } from './canvas/canvasNodeTypeVocabulary';
import { EMPTY_SELECTION, type AIProposalBatch, type CanvasToolType } from './ideaSelectionTypes';

interface ContextMenuPosition {
  x: number;
  y: number;
}

interface ContextMenuTarget {
  nodeId?: string;
  nodeLabel?: string;
  nodeType?: string;
  nodeLocked?: boolean;
  /** WB-FRAME-01: raw ReactFlow node type (`frameNode`/`groupNode`/…) — distinct
   * from `nodeType` above (the display-label semantic type). */
  nodeKind?: string;
  /** WB-FRAME-01: id of the containing frame, if this node is one of its children. */
  nodeParentId?: string;
}

export interface IdeaCanvasContextMenuProps {
  position: ContextMenuPosition | null;
  target: ContextMenuTarget;
  onClose: () => void;
  ideaId: string;
  activeTool: CanvasToolType;
  title: string;
  seedText: string;
  branch: string;
  area: string;
  graphNodes: any[];
  graphEdges: any[];
  graphLanes?: any[];
  isAccepted: boolean;
  onGenerateProposal: (batch: AIProposalBatch) => void;
  onSendToChat?: (prompt: string) => void;
  onAttachKnowledge?: (nodeId: string) => void;
  /** Whiteboard-only: open the node comment thread panel (blob-persisted). */
  onOpenComments?: (nodeId: string) => void;
  /** K1 base ops (Miro parity) — canvas-wide lock state; base ops disable when true. */
  locked?: boolean;
  /** Reuses the same handler wired to the top WhiteboardSelectionBar. */
  onDuplicate?: () => void;
  /** Reuses the same handler wired to the top WhiteboardSelectionBar. */
  onDeleteNode?: () => void;
  /** Reuses the same handler wired to the top WhiteboardSelectionBar. */
  onLockNode?: () => void;
  onBringToFront?: () => void;
  onSendToBack?: () => void;
  /**
   * WB-CLIPBOARD-01 fix: real object copy (node + its internal edges) into
   * the tool's own clipboard (`useWhiteboardNodes.ts` copySelected) — NOT the
   * OS clipboard. Right-click already re-selects the clicked node before this
   * menu opens (see `handleCanvasContextMenu`), so this operates on the same
   * selection `onDuplicate` above does.
   */
  onCopySelected?: () => void;
  /** Pastes the tool clipboard's contents as new elements (pane menu only). */
  onPaste?: () => void;
  /** Greys out "Paste" with a reason when the tool clipboard is empty. */
  pasteDisabled?: boolean;
  /**
   * WB-FRAME-01 (frame context menu, 2026-08-10) — container-aware ops shown
   * ONLY when `target.nodeKind` is `frameNode`/`groupNode` (Whiteboard's
   * frame). See `useWhiteboardNodes.ts` for what each one actually does and
   * the honest scoping decisions behind them.
   */
  onSelectFrameContents?: (frameId: string) => void;
  onAddSelectionToFrame?: (frameId: string) => void;
  onResizeFrameToFit?: (frameId: string) => void;
  /** Shown on a CHILD node's own menu (not the frame's) when it has a parent. */
  onRemoveFromFrame?: (nodeId: string) => void;
  onDeleteFrame?: (frameId: string, releaseContents: boolean) => void;
}

interface MenuItem {
  id: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  labelPl: string;
  labelEn: string;
  generatorType?: GeneratorType;
  chatPrompt?: (label: string, isPl: boolean) => string;
  nodeOnly?: boolean;
  emptyOnly?: boolean;
  /** Restrict item to specific canvas tools (undefined = all tools). */
  tools?: CanvasToolType[];
}

/**
 * K1 base ops (Miro parity) — plain canvas operations, not AI-generated.
 * `kind` selects which prop-supplied handler runs in handleBaseAction; every
 * handler is the SAME callback already wired to the top WhiteboardSelectionBar
 * (or, for `edit`, the same `idea-workspace-node-update` CustomEvent that
 * IdeaWhiteboardTool already listens for) — no new canvas mutation logic here.
 */
type BaseActionKind =
  | 'edit'
  | 'duplicate'
  | 'copy'
  | 'delete'
  | 'lock'
  | 'bring_to_front'
  | 'send_to_back'
  | 'paste';

interface BaseMenuItem {
  id: string;
  kind: BaseActionKind;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  labelPl: string;
  labelEn: string;
  danger?: boolean;
}

// CB-05/RB-043/RV-004: destructive ops must be the FINAL, visually separated
// group — split out of the base ops so `Delete` never renders mid-menu ahead
// of the AI/collaboration group below it.
const BASE_NODE_ACTIONS: BaseMenuItem[] = [
  { id: 'base_edit', kind: 'edit', icon: Pencil, labelPl: 'Edytuj', labelEn: 'Edit' },
  {
    id: 'base_duplicate',
    kind: 'duplicate',
    icon: Copy,
    labelPl: 'Duplikuj',
    labelEn: 'Duplicate',
  },
  { id: 'base_copy', kind: 'copy', icon: Clipboard, labelPl: 'Kopiuj', labelEn: 'Copy' },
  {
    id: 'base_bring_to_front',
    kind: 'bring_to_front',
    icon: BringToFront,
    labelPl: 'Warstwa: na wierzch',
    labelEn: 'Layer: bring to front',
  },
  {
    id: 'base_send_to_back',
    kind: 'send_to_back',
    icon: SendToBack,
    labelPl: 'Warstwa: pod spód',
    labelEn: 'Layer: send to back',
  },
  { id: 'base_lock', kind: 'lock', icon: Lock, labelPl: 'Zablokuj', labelEn: 'Lock' },
];

// Pane (background) base op — WB-CLIPBOARD-01: pastes the tool clipboard
// filled by `base_copy` above. Lives on the PANE menu (not the node menu),
// same placement as Process Flow's own "Paste" in `getCanvasContextActions`
// (`ProcessFlowContextMenu.tsx`).
const BASE_PANE_ACTIONS: BaseMenuItem[] = [
  {
    id: 'base_paste',
    kind: 'paste',
    icon: ClipboardPaste,
    labelPl: 'Wklej',
    labelEn: 'Paste',
  },
];

const DESTRUCTIVE_NODE_ACTIONS: BaseMenuItem[] = [
  {
    id: 'base_delete',
    kind: 'delete',
    icon: Trash2,
    labelPl: 'Usuń',
    labelEn: 'Delete',
    danger: true,
  },
];

const NODE_ACTIONS: MenuItem[] = [
  {
    id: 'expand',
    icon: GitBranch,
    labelPl: 'AI: Rozbuduj',
    labelEn: 'AI: Expand',
    generatorType: 'mindmap_expand',
    nodeOnly: true,
  },
  {
    id: 'challenge',
    icon: Target,
    labelPl: 'AI: Kwestionuj',
    labelEn: 'AI: Challenge',
    nodeOnly: true,
    chatPrompt: (label, _isPl) =>
      i18n.t('myWorkIdeas.canvasContextMenu.challengePrompt', { value: label }),
  },
  {
    id: 'evidence',
    icon: Search,
    labelPl: 'AI: Znajdź dowody',
    labelEn: 'AI: Find evidence',
    nodeOnly: true,
    chatPrompt: (label, _isPl) =>
      i18n.t('myWorkIdeas.canvasContextMenu.evidencePrompt', { value: label }),
  },
  {
    id: 'connections',
    icon: Link2,
    labelPl: 'AI: Sugeruj połączenia',
    labelEn: 'AI: Suggest connections',
    nodeOnly: true,
    chatPrompt: (label, _isPl) =>
      i18n.t('myWorkIdeas.canvasContextMenu.connectionsPrompt', { value: label }),
  },
  {
    id: 'attach_knowledge',
    icon: BookOpen,
    labelPl: 'Dołącz wiedzę',
    labelEn: 'Attach knowledge',
    nodeOnly: true,
  },
  // Whiteboard node comment thread (blob-persisted via node.data.comments[],
  // rides the graph autosave — same contract as Process Flow).
  {
    id: 'wb_comments',
    icon: MessageSquare,
    labelPl: 'Komentarze',
    labelEn: 'Comments',
    nodeOnly: true,
    tools: ['whiteboard'],
  },
  // V51-05: Whiteboard facilitation (generate→preview→apply via IdeaProposalReview)
  {
    id: 'wb_find_themes',
    icon: Layers,
    labelPl: 'AI: Znajdź tematy',
    labelEn: 'AI: Find themes',
    generatorType: 'wb_find_themes',
    nodeOnly: true,
    tools: ['whiteboard'],
  },
  {
    id: 'wb_name_clusters',
    icon: Tags,
    labelPl: 'AI: Nazwij klastry',
    labelEn: 'AI: Name clusters',
    generatorType: 'wb_name_clusters',
    nodeOnly: true,
    tools: ['whiteboard'],
  },
  {
    id: 'wb_extract_actions',
    icon: ListChecks,
    labelPl: 'AI: Wyodrębnij akcje',
    labelEn: 'AI: Extract actions',
    generatorType: 'wb_extract_actions',
    nodeOnly: true,
    tools: ['whiteboard'],
  },
];

const EMPTY_ACTIONS: MenuItem[] = [
  {
    id: 'fill_gap',
    icon: Lightbulb,
    labelPl: 'AI: Wypełnij luki',
    labelEn: 'AI: Fill gaps',
    generatorType: 'suggestions',
    emptyOnly: true,
  },
  {
    id: 'brainstorm',
    icon: Brain,
    labelPl: 'AI: Brainstorm tutaj',
    labelEn: 'AI: Brainstorm here',
    generatorType: 'whiteboard_brainstorm',
    emptyOnly: true,
  },
  // V51-05: cross-tool conversions — result previews on the whiteboard; the
  // proposal's resultSummary points the user to the target tool after accept.
  {
    id: 'wb_to_map_branches',
    icon: Network,
    labelPl: 'AI: Przekształć w mapę myśli',
    labelEn: 'AI: Convert to mind map',
    generatorType: 'wb_to_map_branches',
    emptyOnly: true,
    tools: ['whiteboard'],
  },
  {
    id: 'wb_to_table',
    icon: Table2,
    labelPl: 'AI: Przekształć w tabelę',
    labelEn: 'AI: Convert to table',
    generatorType: 'wb_to_table',
    emptyOnly: true,
    tools: ['whiteboard'],
  },
];

// ─────────────────── Action Registry wiring (N7, 2026-08-09) ───────────────────
// Whiteboard's PPM (node + pane) is now driven by IDEA_ACTION_REGISTRY for
// `activeTool === 'whiteboard'` ONLY — the four arrays above stay the SOURCE
// OF BEHAVIOR (icons + handleBaseAction/handleAction execute exactly as
// before) AND the fallback rendering path for any OTHER `activeTool` value.
// This component is imported by IdeaProcessFlowTool.tsx too, but — verified
// by grepping for `<IdeaCanvasContextMenu` across src/ — Process Flow does
// NOT render it (kept its own `ProcessFlowContextMenu`, see comment at
// IdeaProcessFlowTool.tsx:3730). The `activeTool === 'whiteboard'` gate below
// is therefore a no-op today for every caller except Whiteboard, kept as a
// safety net in case that ever changes (matches the component's own existing
// `tools`-array filtering mechanism on NODE_ACTIONS/EMPTY_ACTIONS).
//
// Order below is 1:1 with the pre-registry hardcoded render order (base ops,
// then AI/collab items, then destructive last for the node menu; declaration
// order for the pane menu) — `getActionsForSurface` preserves `IDEA_ACTIONS`
// declaration order, so these two id lists ARE the render order.
const REGISTRY_NODE_MENU_IDS = [
  'idea.node.edit',
  'idea.node.duplicate',
  'idea.node.copy',
  'idea.node.bring_to_front',
  'idea.node.send_to_back',
  'idea.node.lock',
  'idea.node.expand',
  'idea.node.challenge',
  'idea.node.find_evidence',
  'idea.node.suggest_connections',
  'idea.node.attach_knowledge',
  'idea.node.comments',
  'idea.node.ai_find_themes',
  'idea.node.ai_name_clusters',
  'idea.node.ai_extract_actions',
  'idea.node.delete',
];
const REGISTRY_PANE_MENU_IDS = [
  'idea.canvas.fill_gap',
  'idea.canvas.brainstorm_here',
  'idea.canvas.to_mindmap',
  'idea.canvas.to_table',
];

/** Registry id → BASE_NODE_ACTIONS/DESTRUCTIVE_NODE_ACTIONS `kind` (K1 ops). */
const REGISTRY_ID_TO_BASE_KIND: Partial<Record<string, BaseActionKind>> = {
  'idea.node.edit': 'edit',
  'idea.node.duplicate': 'duplicate',
  'idea.node.copy': 'copy',
  'idea.node.bring_to_front': 'bring_to_front',
  'idea.node.send_to_back': 'send_to_back',
  'idea.node.lock': 'lock',
  'idea.node.delete': 'delete',
  'idea.canvas.paste': 'paste',
};
const BASE_ACTION_BY_KIND: Partial<Record<BaseActionKind, BaseMenuItem>> = Object.fromEntries(
  [...BASE_NODE_ACTIONS, ...DESTRUCTIVE_NODE_ACTIONS, ...BASE_PANE_ACTIONS].map((item) => [
    item.kind,
    item,
  ])
);

/** Registry id → original `MenuItem.id` in NODE_ACTIONS/EMPTY_ACTIONS (AI/collab items). */
const REGISTRY_ID_TO_ITEM_ID: Partial<Record<string, string>> = {
  'idea.node.expand': 'expand',
  'idea.node.challenge': 'challenge',
  'idea.node.find_evidence': 'evidence',
  'idea.node.suggest_connections': 'connections',
  'idea.node.attach_knowledge': 'attach_knowledge',
  'idea.node.comments': 'wb_comments',
  'idea.node.ai_find_themes': 'wb_find_themes',
  'idea.node.ai_name_clusters': 'wb_name_clusters',
  'idea.node.ai_extract_actions': 'wb_extract_actions',
  'idea.canvas.fill_gap': 'fill_gap',
  'idea.canvas.brainstorm_here': 'brainstorm',
  'idea.canvas.to_mindmap': 'wb_to_map_branches',
  'idea.canvas.to_table': 'wb_to_table',
};
const GENERATOR_ITEM_BY_ID: Partial<Record<string, MenuItem>> = Object.fromEntries(
  [...NODE_ACTIONS, ...EMPTY_ACTIONS].map((item) => [item.id, item])
);

/**
 * SYS-P3-01: three of these NODE-menu AI items are genuinely whole-board
 * scope, not the clicked node/current selection their placement in a
 * `nodeOnly` menu implies. Verified against the real request payload
 * (`handleAction` above sends `existingNodes: graphNodes` — ALL board nodes,
 * unfiltered by selection — and the server's `getScopedGeneratorContext` in
 * `ideaAIGeneratorService.ts` only narrows context for `sticky_summarize`,
 * not for `wb_find_themes`/`wb_name_clusters`/`wb_extract_actions`). Fixing
 * the behavior (making these truly selection-aware) is out of scope for a
 * P3 label pass — it would change what the LLM actually analyzes. Fixing the
 * LABEL instead: same "Document" chip Mind Map's node AI menu already uses
 * for its analogous whole-map-despite-node-menu items (`myWorkMindmap.
 * ctxMenu.scopeDocument`, MM-P2-03), so the same scope word means the same
 * target breadth on both tools (chapter 09 §8.3 canon).
 */
const NODE_MENU_DOCUMENT_SCOPE_IDS = new Set<string>([
  'idea.node.ai_find_themes',
  'idea.node.ai_name_clusters',
  'idea.node.ai_extract_actions',
]);
/** Same three items, keyed by their local `MenuItem.id` — used by the
 * non-registry fallback render path below (dead for whiteboard today, kept
 * in sync defensively — see the comment above `REGISTRY_NODE_MENU_IDS`). */
const NODE_MENU_DOCUMENT_SCOPE_LOCAL_IDS = new Set<string>([
  'wb_find_themes',
  'wb_name_clusters',
  'wb_extract_actions',
]);

export const IdeaCanvasContextMenu: React.FC<IdeaCanvasContextMenuProps> = ({
  position,
  target,
  onClose,
  ideaId,
  activeTool,
  title,
  seedText,
  branch,
  area,
  graphNodes,
  graphEdges,
  graphLanes = [],
  isAccepted,
  onGenerateProposal,
  onSendToChat,
  onAttachKnowledge,
  onOpenComments,
  locked,
  onDuplicate,
  onDeleteNode,
  onLockNode,
  onBringToFront,
  onSendToBack,
  onCopySelected,
  onPaste,
  pasteDisabled,
  onSelectFrameContents,
  onAddSelectionToFrame,
  onResizeFrameToFit,
  onRemoveFromFrame,
  onDeleteFrame,
}) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const [loadingId, setLoadingId] = useState<string | null>(null);

  /** SYS-P3-01 — same canon word/translation Mind Map uses for "Document". */
  const documentScopeLabel = t('myWorkMindmap.ctxMenu.scopeDocument', 'Document');

  const handleAction = useCallback(
    async (item: MenuItem) => {
      if (!isAccepted) return;

      if (item.id === 'attach_knowledge' && target.nodeId && onAttachKnowledge) {
        onAttachKnowledge(target.nodeId);
        onClose();
        return;
      }

      if (item.id === 'wb_comments' && target.nodeId && onOpenComments) {
        onOpenComments(target.nodeId);
        onClose();
        return;
      }

      if (item.chatPrompt && onSendToChat) {
        onSendToChat(item.chatPrompt(target.nodeLabel || '', isPl));
        onClose();
        return;
      }

      if (item.generatorType) {
        setLoadingId(item.id);
        try {
          const batch = await generateAIProposal({
            ideaId,
            generatorType: item.generatorType,
            tool: activeTool,
            context: {
              seedText: target.nodeLabel
                ? `${seedText}\n\nFocus on: ${target.nodeLabel}`
                : seedText,
              title,
              branch,
              area,
              existingNodes: graphNodes,
              existingEdges: graphEdges,
              existingLanes: graphLanes,
              language: i18n.language || 'en',
            },
          });
          onGenerateProposal(batch);
          onClose();
        } catch {
          // handled by toast in parent
        } finally {
          setLoadingId(null);
        }
      }
    },
    [
      activeTool,
      area,
      branch,
      graphEdges,
      graphLanes,
      graphNodes,
      i18n.language,
      ideaId,
      isAccepted,
      isPl,
      onAttachKnowledge,
      onOpenComments,
      onClose,
      onGenerateProposal,
      onSendToChat,
      seedText,
      target.nodeId,
      target.nodeLabel,
      title,
    ]
  );

  // K1 base ops — every branch below calls the SAME handler already wired to
  // the top WhiteboardSelectionBar (onDuplicate/onDeleteNode/onLockNode), or
  // for `edit` re-dispatches the existing `idea-workspace-node-update`
  // CustomEvent that IdeaWhiteboardTool already listens for (see the
  // `attach_artifact` quick-action dispatch above for the same pattern).
  const handleBaseAction = useCallback(
    (item: BaseMenuItem) => {
      if (locked) return;
      const nodeId = target.nodeId;
      // `paste` is the one base op that lives on the PANE menu (no node
      // target) — every other kind still requires a clicked node.
      if (item.kind !== 'paste' && !nodeId) return;

      switch (item.kind) {
        case 'edit': {
          const next = window.prompt(
            isPl ? 'Nowa etykieta:' : 'New label:',
            target.nodeLabel || ''
          );
          if (next !== null && next !== target.nodeLabel) {
            window.dispatchEvent(
              new CustomEvent('idea-workspace-node-update', {
                detail: { nodeId, data: { label: next } },
              })
            );
          }
          break;
        }
        case 'copy':
          // WB-CLIPBOARD-01 fix: real object copy (node + internal edges)
          // into the tool clipboard — was `navigator.clipboard.writeText`
          // (label text only, no object, no matching paste).
          onCopySelected?.();
          break;
        case 'paste':
          onPaste?.();
          break;
        case 'duplicate':
          onDuplicate?.();
          break;
        case 'delete':
          onDeleteNode?.();
          break;
        case 'lock':
          onLockNode?.();
          break;
        case 'bring_to_front':
          onBringToFront?.();
          break;
        case 'send_to_back':
          onSendToBack?.();
          break;
      }
      onClose();
    },
    [
      isPl,
      locked,
      onBringToFront,
      onClose,
      onCopySelected,
      onDeleteNode,
      onDuplicate,
      onLockNode,
      onPaste,
      onSendToBack,
      target.nodeId,
      target.nodeLabel,
    ]
  );

  if (!position) return null;

  const isOnNode = !!target.nodeId;
  const actions = (isOnNode ? NODE_ACTIONS : EMPTY_ACTIONS).filter(
    (item) => !item.tools || item.tools.includes(activeTool)
  );

  // WB-FRAME-01 (frame context menu, 2026-08-10): a frame right-click used to
  // flow through this SAME generic node menu, distinguished only by
  // `target.nodeType`'s header label — and even that fell back to the
  // generic "Element" label, because a plain frame's `node.data` never sets
  // `semanticType`/`type` (confirmed by reading `createNode`'s `kind ===
  // 'frame'` branch before writing this). `target.nodeKind` (the RAW
  // ReactFlow node type, newly threaded through `handleCanvasContextMenu`)
  // is what actually distinguishes a frame reliably.
  const isFrameTarget = isOnNode && (target.nodeKind === 'frameNode' || target.nodeKind === 'groupNode');
  const nodeHeaderTypeLabel = getCanvasNodeTypeLabel(
    target.nodeType || (isFrameTarget ? 'frame' : undefined),
    isPl
  );
  const menuAriaLabel = isOnNode
    ? t('myWorkIdeas.canvasContextMenu.nodeMenuAriaLabel', {
        defaultValue: `${nodeHeaderTypeLabel} actions`,
        type: nodeHeaderTypeLabel,
      })
    : t('myWorkIdeas.canvasContextMenu.backgroundMenuAriaLabel', {
        defaultValue: 'Canvas actions',
      });

  // Runs a registry action: the UI path (`ctx.params.run`) executes the
  // ORIGINAL component behavior (handleBaseAction/handleAction) unchanged;
  // any other caller (Teresa) goes through that action's own registry
  // handler (bus dispatch or an honest UI-only refusal — see
  // `ideaActionRegistry.ts`, `runContextMenuUiOnlyCallback`/`runToolbarBusAction`/
  // `runNodeEditLabelCallback`).
  const runViaRegistry = (actionId: string, run: () => void) => {
    const ctx: ActionContext = {
      ideaId,
      tool: activeTool,
      selection: EMPTY_SELECTION,
      surface: 'context',
      source: 'ui',
      language: isPl ? 'pl' : 'en',
      params: { run },
    };
    void runIdeaAction(actionId, ctx);
  };

  // Registry-driven path (N7, 2026-08-09) — Whiteboard only. Every OTHER
  // `activeTool` keeps the pre-registry hardcoded arrays below completely
  // untouched (Process Flow doesn't render this component at all today, see
  // the comment above `REGISTRY_NODE_MENU_IDS`, but the gate stays literal
  // per-tool as a safety net rather than relying on that fact).
  const useRegistry = activeTool === 'whiteboard';
  const registryById = useRegistry
    ? new Map(
        getActionsForSurface('context', { tool: 'whiteboard' }).map((entry) => [
          entry.def.id,
          entry,
        ])
      )
    : null;

  // WB-FRAME-01: a frame gets its OWN item list (`registryFrameItems` below)
  // instead of this generic one — `!isFrameTarget` here and on the two other
  // `isOnNode` blocks below (generator ids, destructive) is what actually
  // stops a frame from also rendering "AI: Expand"/"Attach knowledge"/plain
  // "Delete" alongside its container-aware items.
  const registryBaseItems =
    useRegistry && isOnNode && !isFrameTarget && registryById
      ? REGISTRY_NODE_MENU_IDS.filter(
          (id) => REGISTRY_ID_TO_BASE_KIND[id] && id !== 'idea.node.delete'
        )
          .map((id) => registryById.get(id))
          .filter((entry): entry is NonNullable<typeof entry> => !!entry)
          .map(({ def }) => {
            const kind = REGISTRY_ID_TO_BASE_KIND[def.id]!;
            const item = BASE_ACTION_BY_KIND[kind]!;
            const isLockItem = kind === 'lock';
            const Icon = isLockItem && target.nodeLocked ? Unlock : item.icon;
            const label = isLockItem
              ? target.nodeLocked
                ? isPl
                  ? 'Odblokuj'
                  : 'Unlock'
                : isPl
                  ? def.label.pl
                  : def.label.en
              : isPl
                ? def.label.pl
                : def.label.en;
            return {
              id: def.id,
              label,
              icon: <Icon size={14} className="text-c-text-muted" />,
              danger: item.danger,
              disabled: !!locked,
              disabledReason: locked
                ? t('myWorkIdeas.canvasContextMenu.canvasLocked', 'Canvas is locked')
                : undefined,
              // Kept out of the destructive group visually (separator handled
              // below by `idea.node.delete` itself) — matches original order.
              onSelect: () => runViaRegistry(def.id, () => handleBaseAction(item)),
            };
          })
      : [];

  // WB-CLIPBOARD-01 fix: pane (background) base ops — today just "Paste".
  // Same shape as `registryBaseItems` above but gated `!isOnNode` (Paste has
  // no node target) and disabled by an EMPTY CLIPBOARD, not canvas lock alone
  // — matches Process Flow's `pasteDisabled` in `getCanvasContextActions`.
  const registryPaneBaseItems =
    useRegistry && !isOnNode && registryById
      ? (() => {
          const entry = registryById.get('idea.canvas.paste');
          if (!entry) return [];
          const { def } = entry;
          const item = BASE_ACTION_BY_KIND.paste!;
          const Icon = item.icon;
          return [
            {
              id: def.id,
              label: isPl ? def.label.pl : def.label.en,
              icon: <Icon size={14} className="text-c-text-muted" />,
              disabled: !!locked || !!pasteDisabled,
              disabledReason: locked
                ? t('myWorkIdeas.canvasContextMenu.canvasLocked', 'Canvas is locked')
                : pasteDisabled
                  ? t('myWorkIdeas.canvasContextMenu.clipboardEmpty', 'Clipboard is empty')
                  : undefined,
              onSelect: () => runViaRegistry(def.id, () => handleBaseAction(item)),
            },
          ];
        })()
      : [];

  const registryGeneratorIds = useRegistry
    ? isOnNode
      ? isFrameTarget
        ? []
        : REGISTRY_NODE_MENU_IDS.filter((id) => REGISTRY_ID_TO_ITEM_ID[id])
      : REGISTRY_PANE_MENU_IDS
    : [];
  const registryGeneratorItems =
    useRegistry && registryById
      ? registryGeneratorIds
          .map((id) => registryById.get(id))
          .filter((entry): entry is NonNullable<typeof entry> => !!entry)
          .map(({ def }, index) => {
            const item = GENERATOR_ITEM_BY_ID[REGISTRY_ID_TO_ITEM_ID[def.id]!]!;
            const Icon = item.icon;
            const isLoading = loadingId === item.id;
            return {
              id: def.id,
              label: isPl ? def.label.pl : def.label.en,
              icon: isLoading ? (
                <Loader2 size={14} className="animate-spin text-c-info" />
              ) : (
                <Icon size={14} className="text-c-info" />
              ),
              // SYS-P3-01: honest scope chip for the 3 items that operate on
              // the WHOLE board despite sitting in this node-only menu.
              shortcut: NODE_MENU_DOCUMENT_SCOPE_IDS.has(def.id) ? documentScopeLabel : undefined,
              disabled: !isAccepted || !!loadingId,
              disabledReason: !isAccepted
                ? t('myWorkIdeas.canvasContextMenu.acceptChallengeUnlockAi')
                : loadingId
                  ? t('common.loading', 'Loading')
                  : undefined,
              // Separate the AI group from the base ops above it — node menu
              // always has base ops ahead of it; pane menu only does once
              // "Paste" (registryPaneBaseItems) is non-empty.
              separatorBefore:
                index === 0 && (isOnNode || registryPaneBaseItems.length > 0),
              closeOnSelect: false,
              onSelect: () => runViaRegistry(def.id, () => void handleAction(item)),
            };
          })
      : [];

  const registryDestructiveItems =
    useRegistry && isOnNode && !isFrameTarget && registryById
      ? (() => {
          const entry = registryById.get('idea.node.delete');
          if (!entry) return [];
          const { def } = entry;
          const item = BASE_ACTION_BY_KIND.delete!;
          return [
            {
              id: def.id,
              label: isPl ? def.label.pl : def.label.en,
              icon: <item.icon size={14} />,
              danger: true,
              disabled: !!locked,
              disabledReason: locked
                ? t('myWorkIdeas.canvasContextMenu.canvasLocked', 'Canvas is locked')
                : undefined,
              separatorBefore: true,
              onSelect: () => runViaRegistry(def.id, () => handleBaseAction(item)),
            },
          ];
        })()
      : [];

  // WB-FRAME-01 (frame context menu, 2026-08-10) — container-aware ops,
  // shown ONLY when the right-clicked node is a real frame (`isFrameTarget`).
  // Counts below read `graphNodes` directly (already passed in as a prop) —
  // same fields (`parentNode`/`parentId`/`data.parentId`) `useWhiteboardNodes.ts`
  // reads, duplicated here read-only to drive disabled/enabled state without
  // a new prop just for two counts.
  const frameChildCount = isFrameTarget
    ? (graphNodes as any[]).filter((n) => {
        const pid = n?.parentNode || n?.parentId || n?.data?.parentId;
        return pid === target.nodeId;
      }).length
    : 0;
  const frameAddableCount = isFrameTarget
    ? (graphNodes as any[]).filter((n) => {
        if (n?.id === target.nodeId || !n?.selected || n?.data?.locked) return false;
        if (n?.parentNode || n?.parentId || n?.data?.parentId) return false;
        return n?.type !== 'frameNode' && n?.type !== 'groupNode';
      }).length
    : 0;

  const registryFrameItems =
    useRegistry && isFrameTarget && registryById && target.nodeId
      ? (() => {
          const frameId = target.nodeId!;
          const editEntry = registryById.get('idea.node.edit');
          const selectEntry = registryById.get('idea.frame.select_contents');
          const addEntry = registryById.get('idea.frame.add_selection');
          const resizeEntry = registryById.get('idea.frame.resize_to_fit');
          const deleteWithEntry = registryById.get('idea.frame.delete_with_contents');
          const deleteReleaseEntry = registryById.get('idea.frame.delete_release');
          const items: any[] = [];
          if (editEntry) {
            items.push({
              id: editEntry.def.id,
              label: isPl ? editEntry.def.label.pl : editEntry.def.label.en,
              icon: <Pencil size={14} className="text-c-text-muted" />,
              disabled: !!locked,
              disabledReason: locked
                ? t('myWorkIdeas.canvasContextMenu.canvasLocked', 'Canvas is locked')
                : undefined,
              onSelect: () =>
                runViaRegistry(editEntry.def.id, () => handleBaseAction(BASE_ACTION_BY_KIND.edit!)),
            });
          }
          if (selectEntry) {
            items.push({
              id: selectEntry.def.id,
              label: isPl ? selectEntry.def.label.pl : selectEntry.def.label.en,
              icon: <Boxes size={14} className="text-c-text-muted" />,
              disabled: frameChildCount === 0,
              disabledReason:
                frameChildCount === 0
                  ? t('myWorkIdeas.canvasContextMenu.frameEmpty', 'Frame has no contents')
                  : undefined,
              onSelect: () =>
                runViaRegistry(selectEntry.def.id, () => {
                  onSelectFrameContents?.(frameId);
                  onClose();
                }),
            });
          }
          if (addEntry) {
            items.push({
              id: addEntry.def.id,
              label: isPl ? addEntry.def.label.pl : addEntry.def.label.en,
              icon: <FolderInput size={14} className="text-c-text-muted" />,
              disabled: !!locked || frameAddableCount === 0,
              disabledReason: locked
                ? t('myWorkIdeas.canvasContextMenu.canvasLocked', 'Canvas is locked')
                : frameAddableCount === 0
                  ? t(
                      'myWorkIdeas.canvasContextMenu.frameNoSelection',
                      'Select unlocked elements first (outside this frame)'
                    )
                  : undefined,
              onSelect: () =>
                runViaRegistry(addEntry.def.id, () => {
                  onAddSelectionToFrame?.(frameId);
                  onClose();
                }),
            });
          }
          if (resizeEntry) {
            items.push({
              id: resizeEntry.def.id,
              label: isPl ? resizeEntry.def.label.pl : resizeEntry.def.label.en,
              icon: <Maximize2 size={14} className="text-c-text-muted" />,
              disabled: !!locked || frameChildCount === 0,
              disabledReason: locked
                ? t('myWorkIdeas.canvasContextMenu.canvasLocked', 'Canvas is locked')
                : frameChildCount === 0
                  ? t('myWorkIdeas.canvasContextMenu.frameEmpty', 'Frame has no contents')
                  : undefined,
              onSelect: () =>
                runViaRegistry(resizeEntry.def.id, () => {
                  onResizeFrameToFit?.(frameId);
                  onClose();
                }),
            });
          }
          if (deleteWithEntry) {
            items.push({
              id: deleteWithEntry.def.id,
              label: isPl ? deleteWithEntry.def.label.pl : deleteWithEntry.def.label.en,
              icon: <Trash2 size={14} />,
              danger: true,
              disabled: !!locked,
              disabledReason: locked
                ? t('myWorkIdeas.canvasContextMenu.canvasLocked', 'Canvas is locked')
                : undefined,
              separatorBefore: true,
              onSelect: () =>
                runViaRegistry(deleteWithEntry.def.id, () => {
                  onDeleteFrame?.(frameId, false);
                  onClose();
                }),
            });
          }
          if (deleteReleaseEntry) {
            items.push({
              id: deleteReleaseEntry.def.id,
              label: isPl ? deleteReleaseEntry.def.label.pl : deleteReleaseEntry.def.label.en,
              icon: <PackageOpen size={14} className="text-c-text-muted" />,
              disabled: !!locked,
              disabledReason: locked
                ? t('myWorkIdeas.canvasContextMenu.canvasLocked', 'Canvas is locked')
                : undefined,
              onSelect: () =>
                runViaRegistry(deleteReleaseEntry.def.id, () => {
                  onDeleteFrame?.(frameId, true);
                  onClose();
                }),
            });
          }
          return items;
        })()
      : [];

  // WB-FRAME-01: "Remove from frame" — shown on a CHILD node's own menu
  // (never on the frame's own menu above), only when this node actually has
  // a parent (`target.nodeParentId`, threaded through `handleCanvasContextMenu`).
  const registryChildFrameItems =
    useRegistry && isOnNode && !isFrameTarget && target.nodeParentId && target.nodeId && registryById
      ? (() => {
          const entry = registryById.get('idea.node.remove_from_frame');
          if (!entry) return [];
          const { def } = entry;
          const nodeId = target.nodeId!;
          return [
            {
              id: def.id,
              label: isPl ? def.label.pl : def.label.en,
              icon: <FolderOutput size={14} className="text-c-text-muted" />,
              disabled: !!locked,
              disabledReason: locked
                ? t('myWorkIdeas.canvasContextMenu.canvasLocked', 'Canvas is locked')
                : undefined,
              onSelect: () =>
                runViaRegistry(def.id, () => {
                  onRemoveFromFrame?.(nodeId);
                  onClose();
                }),
            },
          ];
        })()
      : [];

  return (
    <CanvasContextMenu
      x={position.x}
      y={position.y}
      onClose={onClose}
      ariaLabel={menuAriaLabel}
      testId="idea-canvas-context-menu"
      header={
        isOnNode && target.nodeLabel ? (
          <div>
            <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {nodeHeaderTypeLabel}
            </div>
            <div className="text-[11px] font-medium text-slate-800 dark:text-slate-200 truncate max-w-[180px]">
              {target.nodeLabel}
            </div>
          </div>
        ) : !isOnNode ? (
          <div className="text-[10px] font-bold text-c-info flex items-center gap-1">
            <Sparkles size={10} />
            {t('myWorkIdeas.canvasContextMenu.aiActions')}
          </div>
        ) : undefined
      }
      items={
        useRegistry
          ? [
              ...registryFrameItems,
              ...registryBaseItems,
              ...registryChildFrameItems,
              ...registryPaneBaseItems,
              ...registryGeneratorItems,
              ...registryDestructiveItems,
            ]
          : [
              ...(isOnNode
                ? BASE_NODE_ACTIONS.map((item) => {
                    const isLockItem = item.kind === 'lock';
                    const Icon = isLockItem && target.nodeLocked ? Unlock : item.icon;
                    const label = isLockItem
                      ? target.nodeLocked
                        ? isPl
                          ? 'Odblokuj'
                          : 'Unlock'
                        : isPl
                          ? item.labelPl
                          : item.labelEn
                      : isPl
                        ? item.labelPl
                        : item.labelEn;
                    return {
                      id: item.id,
                      label,
                      icon: <Icon size={14} className="text-c-text-muted" />,
                      danger: item.danger,
                      disabled: !!locked,
                      disabledReason: locked
                        ? t('myWorkIdeas.canvasContextMenu.canvasLocked', 'Canvas is locked')
                        : undefined,
                      onSelect: () => handleBaseAction(item),
                    };
                  })
                : []),
              ...actions.map((item, index) => {
                const Icon = item.icon;
                const isLoading = loadingId === item.id;
                return {
                  id: item.id,
                  label: isPl ? item.labelPl : item.labelEn,
                  icon: isLoading ? (
                    <Loader2 size={14} className="animate-spin text-c-info" />
                  ) : (
                    <Icon size={14} className="text-c-info" />
                  ),
                  // SYS-P3-01 (fallback path — see NODE_MENU_DOCUMENT_SCOPE_LOCAL_IDS).
                  shortcut: NODE_MENU_DOCUMENT_SCOPE_LOCAL_IDS.has(item.id)
                    ? documentScopeLabel
                    : undefined,
                  disabled: !isAccepted || !!loadingId,
                  disabledReason: !isAccepted
                    ? t('myWorkIdeas.canvasContextMenu.acceptChallengeUnlockAi')
                    : loadingId
                      ? t('common.loading', 'Loading')
                      : undefined,
                  separatorBefore: isOnNode && index === 0,
                  closeOnSelect: false,
                  onSelect: () => void handleAction(item),
                };
              }),
              // RB-043/RV-004: destructive group — final position, visually
              // separated from the base/AI groups above (separatorBefore). Delete
              // still routes through the same handler wired to the canvas's local
              // undo stack (LOCAL_STACK_UNDO), and the rail's Undo button stays on
              // screen, so this stays reversible/visible like every other op.
              ...(isOnNode
                ? DESTRUCTIVE_NODE_ACTIONS.map((item) => ({
                    id: item.id,
                    label: isPl ? item.labelPl : item.labelEn,
                    icon: <item.icon size={14} />,
                    danger: true,
                    disabled: !!locked,
                    disabledReason: locked
                      ? t('myWorkIdeas.canvasContextMenu.canvasLocked', 'Canvas is locked')
                      : undefined,
                    separatorBefore: true,
                    onSelect: () => handleBaseAction(item),
                  }))
                : []),
            ]
      }
    />
  );
};

export default IdeaCanvasContextMenu;
