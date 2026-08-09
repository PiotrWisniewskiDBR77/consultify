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
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import i18n from '@/i18n';
import { Api } from '@/services/api';
import { generateAIProposal, type GeneratorType } from '@/services/ideaAIGenerator';

import { getCanvasNodeTypeLabel } from './canvas/canvasNodeTypeVocabulary';
import { useAccessibleMenu } from './canvas/useAccessibleMenu';
import type { AIProposalBatch, CanvasToolType } from './ideaSelectionTypes';

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
  // CB-05/RB-042/RV-003: shared accessible menu contract (focus entry, arrows/
  // Home/End, focus return) — `menuRef` stays the container ref used by the
  // existing outside-click/Escape listener below.
  const menuRef = useAccessibleMenu<HTMLDivElement>(!!position);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    if (!position) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) onClose();
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    // CAPTURE PHASE IS LOAD-BEARING — nie zmieniaj na zwykły listener.
    // d3-zoom (pod ReactFlow) w swoim `mousedowned` woła `nopropagation(event)`
    // = `event.stopImmediatePropagation()` (d3-zoom/src/zoom.js:280) na
    // `.react-flow__pane`. Każdy `mousedown` na pustym płótnie Whiteboardu ginie
    // więc, zanim dojdzie do `document` w fazie bąbelkowania — menu zostawało
    // otwarte na zawsze (Piotr 07-27: „nie mogę go zamknąć").
    window.addEventListener('mousedown', handler, true);
    document.addEventListener('keydown', keyHandler);
    return () => {
      window.removeEventListener('mousedown', handler, true);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [onClose, position]);

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

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label={menuAriaLabel}
      className="fixed z-toast bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl shadow-xl py-1.5 min-w-[200px] animate-in fade-in zoom-in-95 duration-150"
      style={{ left: position.x, top: position.y }}
    >
      {isOnNode && target.nodeLabel && (
        <div className="px-3 py-1.5 border-b border-slate-200/30 dark:border-white/[0.04]">
          <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {nodeHeaderTypeLabel}
          </div>
          <div className="text-[11px] font-medium text-slate-800 dark:text-slate-200 truncate max-w-[180px]">
            {target.nodeLabel}
          </div>
        </div>
      )}

      {/* K1 base ops (Miro parity) — plain, non-destructive canvas operations.
          Delete moved out to its own final group below (RB-043/RV-004: the
          destructive group must be last and visually separated, not embedded
          ahead of the AI/collaboration group). */}
      {isOnNode && (
        <div className="py-1 border-b border-slate-200/30 dark:border-white/[0.04]">
          {BASE_NODE_ACTIONS.map((item) => {
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
            return (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                onClick={() => handleBaseAction(item)}
                disabled={locked}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-[11px] font-medium transition-colors disabled:opacity-40 ${
                  item.danger
                    ? 'text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20'
                    : 'text-c-text hover:bg-c-surface-raised'
                }`}
              >
                <Icon
                  size={14}
                  className={item.danger ? 'shrink-0' : 'text-c-text-muted shrink-0'}
                />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      )}

      {!isOnNode && (
        <div className="px-3 py-1.5 border-b border-slate-200/30 dark:border-white/[0.04]">
          <div className="text-[10px] font-bold text-c-info flex items-center gap-1">
            <Sparkles size={10} />
            {t('myWorkIdeas.canvasContextMenu.aiActions')}
          </div>
        </div>
      )}

      {actions.map((item) => {
        const Icon = item.icon;
        const isLoading = loadingId === item.id;
        return (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            onClick={() => handleAction(item)}
            disabled={!isAccepted || !!loadingId}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:bg-c-info/10 transition-colors disabled:opacity-40"
          >
            {isLoading ? (
              <Loader2 size={14} className="animate-spin text-c-info shrink-0" />
            ) : (
              <Icon size={14} className="text-c-info shrink-0" />
            )}
            <span>{isPl ? item.labelPl : item.labelEn}</span>
          </button>
        );
      })}

      {/* RB-043/RV-004: destructive group — final position, visually
          separated (top border + tinted background), never mixed ahead of
          the AI group above. Undo stays reliable/visible: delete still goes
          through the same handler wired to the canvas's local undo stack
          (LOCAL_STACK_UNDO), and the rail's Undo button is always on screen. */}
      {isOnNode && (
        <div className="py-1 border-t border-slate-200/30 dark:border-white/[0.04] bg-danger-50/40 dark:bg-danger-900/10">
          {DESTRUCTIVE_NODE_ACTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              onClick={() => handleBaseAction(item)}
              disabled={locked}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-[11px] font-medium transition-colors disabled:opacity-40 text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20"
            >
              <item.icon size={14} className="shrink-0" />
              <span>{isPl ? item.labelPl : item.labelEn}</span>
            </button>
          ))}
        </div>
      )}

      {!isAccepted && (
        <div className="px-3 py-1.5 text-[10px] text-amber-600 dark:text-amber-400 border-t border-slate-200/30 dark:border-white/[0.04]">
          {t('myWorkIdeas.canvasContextMenu.acceptChallengeUnlockAi')}
        </div>
      )}
    </div>
  );
};

export default IdeaCanvasContextMenu;
