/**
 * REJESTR AKCJI (2026-08-09, N5 druga fala — wzór: `PaneContextMenu.tsx`,
 * e6ac31f10b): 15 z 44-45 pozycji tego menu (grupy Edit + Structure + Delete)
 * mają teraz odpowiadający wpis w `IDEA_ACTION_REGISTRY`
 * (`idea.node.mm_*`, `getAction(id)`) i wykonują się przez
 * `runIdeaAction(id, ctx)`. Grupy AI/Convert/Convert branch/Style & data
 * ŚWIADOMIE NIETKNIĘTE (osobne przyszłe fale) — dla nich `onSelect` zostaje
 * dokładnie `() => onAction(item.id)`, bez żadnego udziału rejestru.
 *
 * TAK SAMO jak menu tła: komponent przekazuje `ctx.params.run` — dokładnie
 * ten sam mechanizm co `PaneContextMenu.tsx`/`WhiteboardToolbar.tsx`
 * (`runMindmapNodeBusAction`/`runMindmapNodeUiOnlyCallback` w rejestrze).
 * Powód: `IdeaRecommendationMap.handleContextAction` ma bezpośredni dostęp do
 * lokalnego stanu tego komponentu (schowek Mapy myśli, `preContextMenuSelectionRef`,
 * `getContextTargetNode`) — closure, którego `useMindMapQuickActions.ts` NIE
 * dzieli w całości. Klik człowieka więc idzie DOKŁADNIE tą samą ścieżką co
 * przed tą migracją (`onAction` prop, `IdeaRecommendationMap.tsx`'s
 * `handleContextAction` NIETKNIĘTE poza dwoma uczciwymi dopiskami `pushUndo()`
 * — patrz tamten plik). Rejestr dokłada DRUGĄ ścieżkę dla Teresy
 * (`ctx.source === 'teresa'`, brak `run`): 7 z 15 pozycji mają dziś realny,
 * żywy odbiornik w `useMindMapQuickActions.ts` (dodaj dziecko/rodzeństwo,
 * duplikuj, usuń, zwiń/rozwiń, połącz, odłącz gałąź, duplikuj gałąź — 3 z tych
 * to NOWE odbiorniki dopisane tą samą zmianą, patrz ten plik i
 * `IdeaRecommendationMap.tsx`); pozostałe 8 (edytuj, otwórz szczegóły,
 * kopiuj/wytnij/wklej, skup na poddrzewie, wejdź głębiej) zostają uczciwie
 * UI-only — stan lokalny UI/schowek bez sensownego odpowiednika dla LLM,
 * `runMindmapNodeUiOnlyCallback` zwraca to wprost.
 *
 * Zachowanie wizualne (kolejność, separatory, stan disabled, skróty
 * klawiszowe, ikony) jest 1:1 ze stanem sprzed migracji — źródłem
 * etykiet/ikon/skrótów zostaje TEN plik (i18n `myWorkMindmap.ctxMenu.*`),
 * NIE `def.label`/`def.icon` z rejestru (te opisują akcję dla WSZYSTKICH
 * powierzchni, np. Menu 3 w przyszłości).
 */
import {
  BookOpen,
  ChevronRight,
  Clipboard,
  ClipboardCopy,
  Copy,
  Diamond,
  Edit3,
  ExternalLink,
  FileText,
  FoldVertical,
  GitBranch,
  Globe,
  Image,
  Link2,
  ListChecks,
  MessageSquare,
  Network,
  Paintbrush,
  Plus,
  Rocket,
  ScanSearch,
  Scissors,
  Share2,
  Sparkles,
  Star,
  StickyNote,
  Tag,
  Target,
  Trash2,
  UserPlus,
  Workflow,
} from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { type ActionContext, getAction, runIdeaAction } from '@/actions/ideaActionRegistry';
import { EMPTY_SELECTION } from '@/components/MyWork/ideaSelectionTypes';
import { CanvasContextMenu } from '@/components/shared/CanvasContextMenu';

import { type MenuItemBase } from './contextMenuTypes';

/** Lokalny id menu (i18n `myWorkMindmap.ctxMenu.<id>`, tożsamość klik-ścieżki
 * przez `onAction`) → id w rejestrze akcji (tożsamość Teresy/dispatchu).
 * WYŁĄCZNIE grupy Edit/Structure/Delete (15 pozycji) — AI/Convert/Convert
 * branch/Style & data celowo brak w tej mapie (osobne przyszłe fale). */
const REGISTRY_ID_BY_LOCAL_ID: Record<string, string> = {
  ctx_edit: 'idea.node.mm_edit',
  ctx_open_detail: 'idea.node.mm_open_detail',
  ctx_add_child: 'idea.node.mm_add_child',
  ctx_add_sibling: 'idea.node.mm_add_sibling',
  ctx_duplicate: 'idea.node.mm_duplicate',
  ctx_copy_nodes: 'idea.node.mm_copy',
  ctx_cut_nodes: 'idea.node.mm_cut',
  ctx_paste_nodes: 'idea.node.mm_paste',
  ctx_toggle_collapse: 'idea.node.mm_toggle_collapse',
  ctx_focus_subtree: 'idea.node.mm_focus_subtree',
  ctx_drill_down: 'idea.node.mm_drill_down',
  ctx_connect_to_selected: 'idea.node.mm_connect_to_selected',
  ctx_detach_branch: 'idea.node.mm_detach_branch',
  ctx_duplicate_branch: 'idea.node.mm_duplicate_branch',
  ctx_delete: 'idea.node.mm_delete',
};

export interface NodeContextMenuProps {
  x: number;
  y: number;
  nodeId: string;
  nodeType: string;
  isLocked: boolean;
  isPl: boolean;
  canPasteStyle?: boolean;
  canPasteNodes?: boolean;
  hasChildren?: boolean;
  /**
   * DP-5: item ids rendered as disabled with a "Wkrótce / Coming soon" badge
   * (feature-flagged heuristic AI actions that are not yet honestly AI-backed).
   */
  comingSoonIds?: string[];
  onClose: () => void;
  onAction: (action: string) => void;
}

interface MenuGroup {
  titleKey: string;
  titleEn: string;
  items: MenuItemBase[];
}

export const NodeContextMenu: React.FC<NodeContextMenuProps> = ({
  x,
  y,
  nodeId,
  nodeType,
  isLocked,
  isPl,
  canPasteStyle = false,
  canPasteNodes = false,
  hasChildren = false,
  comingSoonIds,
  onClose,
  onAction,
}) => {
  const { t } = useTranslation();

  const isProtected = nodeId === 'root' || nodeId.startsWith('branch-');

  const groups: MenuGroup[] = useMemo(
    () => [
      {
        titleKey: 'myWorkMindmap.ctxMenu.group.edit',
        titleEn: 'Edit',
        items: [
          {
            id: 'ctx_edit',
            labelEn: 'Edit',
            icon: Edit3,
            shortcut: 'F2',
            disabled: isProtected,
          },
          {
            id: 'ctx_open_detail',
            labelEn: 'Open details',
            icon: ExternalLink,
            disabled: isProtected,
          },
          {
            id: 'ctx_add_child',
            labelEn: 'Add child',
            icon: Plus,
            shortcut: 'Tab',
            disabled: isLocked,
          },
          {
            id: 'ctx_add_sibling',
            labelEn: 'Add sibling',
            icon: GitBranch,
            shortcut: 'Enter',
            disabled: isLocked || isProtected,
          },
          {
            id: 'ctx_duplicate',
            labelEn: 'Duplicate',
            icon: Copy,
            shortcut: '⌘D',
            disabled: isLocked || isProtected,
          },
          {
            id: 'ctx_copy_nodes',
            labelEn: 'Copy',
            icon: ClipboardCopy,
            shortcut: '⌘C',
            disabled: isProtected,
          },
          {
            id: 'ctx_cut_nodes',
            labelEn: 'Cut',
            icon: Scissors,
            shortcut: '⌘X',
            disabled: isLocked || isProtected,
          },
          {
            id: 'ctx_paste_nodes',
            labelEn: 'Paste',
            icon: Clipboard,
            shortcut: '⌘V',
            disabled: isLocked || !canPasteNodes,
          },
        ],
      },
      {
        titleKey: 'myWorkMindmap.ctxMenu.group.structure',
        titleEn: 'Structure',
        items: [
          {
            id: 'ctx_toggle_collapse',
            labelEn: 'Fold / unfold',
            icon: FoldVertical,
            shortcut: 'Space',
            disabled: isProtected,
          },
          {
            id: 'ctx_focus_subtree',
            labelEn: 'Focus subtree',
            icon: ScanSearch,
            disabled: isProtected,
          },
          {
            id: 'ctx_drill_down',
            labelEn: 'Drill down',
            icon: ChevronRight,
            disabled: isProtected,
          },
          {
            id: 'ctx_connect_to_selected',
            labelEn: 'Connect to selected',
            icon: Link2,
            disabled: isLocked || isProtected,
          },
          {
            id: 'ctx_detach_branch',
            labelEn: 'Detach branch',
            icon: Scissors,
            disabled: isLocked || isProtected,
          },
          {
            id: 'ctx_duplicate_branch',
            labelEn: 'Duplicate branch',
            icon: Copy,
            disabled: isLocked || isProtected,
          },
        ],
      },
      {
        titleKey: 'myWorkMindmap.ctxMenu.group.ai',
        titleEn: 'AI',
        items: [
          {
            // J26 (channel 2): direct "AI rewrites this node's label" action.
            id: 'ctx_ai_rewrite_node',
            labelEn: 'AI: Rewrite this node',
            icon: Sparkles,
            disabled: isLocked,
          },
          {
            id: 'ctx_ai_expand',
            labelEn: 'Expand topic',
            icon: Sparkles,
            disabled: isLocked,
          },
          {
            id: 'ctx_ai_deepen',
            labelEn: 'Deepen',
            icon: Sparkles,
            disabled: isLocked,
          },
          {
            id: 'ctx_what_if',
            labelEn: 'What if...?',
            icon: GitBranch,
            disabled: isLocked,
          },
          {
            id: 'ctx_summarize_branch',
            labelEn: 'Summarize branch',
            icon: FileText,
            disabled: isLocked,
          },
          {
            id: 'ctx_dependencies',
            labelEn: 'Detect dependencies',
            icon: Network,
            disabled: isLocked,
          },
          {
            id: 'ctx_priority',
            labelEn: 'Prioritize',
            icon: Target,
            disabled: isLocked,
          },
          {
            id: 'ctx_competitive',
            labelEn: 'Competitors',
            icon: Globe,
            disabled: isLocked,
          },
          {
            id: 'ai_suggest_links',
            labelEn: 'AI: Suggest links',
            icon: Sparkles,
            disabled: isLocked,
          },
        ],
      },
      {
        titleKey: 'myWorkMindmap.ctxMenu.group.convert',
        titleEn: 'Convert',
        items: [
          {
            id: 'ctx_convert_initiative',
            labelEn: '→ Initiative',
            icon: Rocket,
            disabled: isLocked,
          },
          {
            id: 'ctx_convert_decision',
            labelEn: '→ Decision',
            icon: Star,
            disabled: isLocked,
          },
          {
            id: 'ctx_convert_tasks',
            labelEn: '→ Tasks',
            icon: ListChecks,
            disabled: isLocked,
          },
        ],
      },
      ...(hasChildren
        ? ([
            {
              titleKey: 'myWorkMindmap.ctxMenu.group.convertBranch',
              titleEn: 'Convert branch to...',
              items: [
                {
                  id: 'ctx_subtree_convert_decision',
                  labelEn: '→ Decision (branch)',
                  icon: Star,
                  disabled: isLocked,
                },
                {
                  id: 'ctx_subtree_convert_tasks',
                  labelEn: '→ Tasks (branch)',
                  icon: ListChecks,
                  disabled: isLocked,
                },
                {
                  id: 'ctx_subtree_convert_task_set',
                  labelEn: '→ Task set (branch)',
                  icon: ListChecks,
                  disabled: isLocked,
                },
                {
                  id: 'ctx_subtree_convert_initiative',
                  labelEn: '→ Initiative (branch)',
                  icon: Rocket,
                  disabled: isLocked,
                },
                {
                  id: 'ctx_subtree_convert_process_flow',
                  labelEn: '→ Process Flow (branch)',
                  icon: Workflow,
                  disabled: isLocked,
                },
              ] as MenuItemBase[],
            },
          ] as MenuGroup[])
        : []),
      {
        titleKey: 'myWorkMindmap.ctxMenu.group.styleData',
        titleEn: 'Style & data',
        items: [
          {
            id: 'ctx_change_shape',
            labelEn: 'Change shape',
            icon: Diamond,
            disabled: isLocked || isProtected,
          },
          {
            id: 'ctx_add_image',
            labelEn: 'Add image',
            icon: Image,
            disabled: isLocked || isProtected,
          },
          {
            id: 'ctx_copy_style',
            labelEn: 'Copy style',
            icon: Paintbrush,
            disabled: isProtected,
          },
          {
            id: 'ctx_paste_style',
            labelEn: 'Paste style',
            icon: Paintbrush,
            disabled: isLocked || isProtected || !canPasteStyle,
          },
          {
            id: 'ctx_vote_up',
            labelEn: 'Vote up',
            icon: Star,
            disabled: isLocked || isProtected,
          },
          {
            id: 'ctx_assign',
            labelEn: 'Assign person',
            icon: UserPlus,
            disabled: isLocked || isProtected,
          },
          {
            id: 'ctx_comments',
            labelEn: 'Comments',
            icon: MessageSquare,
            disabled: isProtected,
          },
          {
            id: 'ctx_quick_notes',
            labelEn: 'Notes',
            icon: StickyNote,
            disabled: isProtected,
          },
          {
            id: 'ctx_quick_tags',
            labelEn: 'Tags',
            icon: Tag,
            disabled: isProtected,
          },
          {
            id: 'ctx_attach_knowledge',
            labelEn: 'Attach knowledge',
            icon: BookOpen,
            disabled: isLocked || isProtected,
          },
          {
            id: 'ctx_attach_artifact',
            labelEn: 'Attach artifact',
            icon: BookOpen,
            disabled: isLocked || isProtected,
          },
          {
            id: 'ctx_open_linked_artifacts',
            labelEn: 'Linked artifacts',
            icon: ExternalLink,
            disabled: isProtected,
          },
          {
            id: 'ctx_share_branch',
            labelEn: 'Copy link',
            icon: Share2,
            disabled: isProtected,
          },
        ],
      },
      {
        titleKey: '',
        titleEn: '',
        items: [
          {
            id: 'ctx_delete',
            labelEn: 'Delete',
            icon: Trash2,
            shortcut: 'Del',
            danger: true,
            disabled: isLocked || isProtected,
          },
        ],
      },
    ],
    [canPasteNodes, canPasteStyle, hasChildren, isLocked, isProtected]
  );

  return (
    <CanvasContextMenu
      x={x}
      y={y}
      minWidth={244}
      onClose={onClose}
      ariaLabel={t('myWorkMindmap.ctxMenu.nodeActions', 'Node actions')}
      testId="mindmap-node-context-menu"
      header={
        <div className="text-xs font-semibold text-c-text">
          {t('myWorkMindmap.ctxMenu.nodeType', 'Node')}: {nodeType}
        </div>
      }
      items={groups.flatMap((group) =>
        group.items.map((item, itemIndex) => {
          const Icon = item.icon;
          const comingSoon = comingSoonIds?.includes(item.id) ?? false;
          const disabled = item.disabled || comingSoon;
          const registryId = REGISTRY_ID_BY_LOCAL_ID[item.id];
          // Odbiór (Z3): każda pozycja Edit/Structure/Delete MUSI mieć wpis w
          // rejestrze — brak wpisu to błąd migracji, nie stan przejściowy do
          // cichego pominięcia. Pozycje spoza tych trzech grup (AI/Convert/
          // Convert branch/Style & data) NIE są w `REGISTRY_ID_BY_LOCAL_ID` —
          // dla nich `registryId` jest `undefined` i menu zachowuje się
          // dokładnie jak przed tą migracją (patrz `onSelect` niżej).
          if (registryId && !getAction(registryId)) {
            throw new Error(
              `NodeContextMenu: brak wpisu rejestru dla pozycji menu '${item.id}' (oczekiwano '${registryId}')`
            );
          }
          return {
            id: item.id,
            label: t(`myWorkMindmap.ctxMenu.${item.id}`, item.labelEn),
            groupLabel: group.titleKey ? t(group.titleKey, group.titleEn) : undefined,
            icon: <Icon size={14} />,
            shortcut: comingSoon ? t('ideas.mindmap.comingSoon', 'Coming soon') : item.shortcut,
            disabled,
            disabledReason: comingSoon
              ? t('ideas.mindmap.comingSoon', 'Coming soon')
              : disabled
                ? t('myWorkMindmap.ctxMenu.unavailable', 'Unavailable in the current state')
                : undefined,
            danger: item.danger,
            separatorBefore: itemIndex === 0 && group === groups[groups.length - 1],
            onSelect: registryId
              ? () => {
                  const ctx: ActionContext = {
                    ideaId: '',
                    tool: 'mindmap',
                    selection: EMPTY_SELECTION,
                    surface: 'context',
                    source: 'ui',
                    language: isPl ? 'pl' : 'en',
                    // `run` = dokładnie dotychczasowa klik-ścieżka (`onAction`
                    // prop, `IdeaRecommendationMap.handleContextAction`
                    // nietknięte poza dwoma dopiskami `pushUndo()`). Rejestr
                    // konsultuje `run` PRZED jakąkolwiek szyną (Z1/
                    // `runMindmapNodeBusAction`), więc kliknięcie człowieka
                    // zachowuje się 1:1 jak przed migracją.
                    params: { run: () => onAction(item.id) },
                  };
                  void runIdeaAction(registryId, ctx);
                }
              : () => onAction(item.id),
          };
        })
      )}
    />
  );
};
