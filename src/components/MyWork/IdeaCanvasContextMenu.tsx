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
  Brain,
  BringToFront,
  Clipboard,
  Copy,
  GitBranch,
  Layers,
  Lightbulb,
  Link2,
  ListChecks,
  Loader2,
  Lock,
  MessageSquare,
  Network,
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
  | 'send_to_back';

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
};
const BASE_ACTION_BY_KIND: Partial<Record<BaseActionKind, BaseMenuItem>> = Object.fromEntries(
  [...BASE_NODE_ACTIONS, ...DESTRUCTIVE_NODE_ACTIONS].map((item) => [item.kind, item])
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
}) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const [loadingId, setLoadingId] = useState<string | null>(null);

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
      if (!nodeId) return;

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
          navigator.clipboard?.writeText(target.nodeLabel || '').catch(() => {});
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
      onDeleteNode,
      onDuplicate,
      onLockNode,
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

  const nodeHeaderTypeLabel = getCanvasNodeTypeLabel(target.nodeType, isPl);
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

  const registryBaseItems =
    useRegistry && isOnNode && registryById
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

  const registryGeneratorIds = useRegistry
    ? isOnNode
      ? REGISTRY_NODE_MENU_IDS.filter((id) => REGISTRY_ID_TO_ITEM_ID[id])
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
              disabled: !isAccepted || !!loadingId,
              disabledReason: !isAccepted
                ? t('myWorkIdeas.canvasContextMenu.acceptChallengeUnlockAi')
                : loadingId
                  ? t('common.loading', 'Loading')
                  : undefined,
              separatorBefore: isOnNode && index === 0,
              closeOnSelect: false,
              onSelect: () => runViaRegistry(def.id, () => void handleAction(item)),
            };
          })
      : [];

  const registryDestructiveItems =
    useRegistry && isOnNode && registryById
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
          ? [...registryBaseItems, ...registryGeneratorItems, ...registryDestructiveItems]
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
