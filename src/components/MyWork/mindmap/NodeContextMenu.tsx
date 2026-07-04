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
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { MENU_CONTAINER_CLASS, type MenuItemBase, menuItemClass } from './contextMenuTypes';

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
  titlePl: string;
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
  const ref = useRef<HTMLDivElement>(null);
  const [submenu, setSubmenu] = useState<string | null>(null);
  const submenuTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) onClose();
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (submenu) {
          setSubmenu(null);
          return;
        }
        onClose();
      }
    };
    window.addEventListener('mousedown', handler);
    window.addEventListener('keydown', keyHandler);
    return () => {
      window.removeEventListener('mousedown', handler);
      window.removeEventListener('keydown', keyHandler);
      if (submenuTimerRef.current) window.clearTimeout(submenuTimerRef.current);
    };
  }, [onClose, submenu]);

  const handleClick = useCallback(
    (action: string) => {
      onAction(action);
      onClose();
    },
    [onAction, onClose]
  );

  const isProtected = nodeId === 'root' || nodeId.startsWith('branch-');

  const groups: MenuGroup[] = useMemo(
    () => [
      {
        titlePl: 'Edycja',
        titleEn: 'Edit',
        items: [
          {
            id: 'ctx_edit',
            labelPl: 'Edytuj',
            labelEn: 'Edit',
            icon: Edit3,
            shortcut: 'F2',
            disabled: isProtected,
          },
          {
            id: 'ctx_open_detail',
            labelPl: 'Otwórz szczegóły',
            labelEn: 'Open details',
            icon: ExternalLink,
            disabled: isProtected,
          },
          {
            id: 'ctx_add_child',
            labelPl: 'Dodaj gałąź',
            labelEn: 'Add child',
            icon: Plus,
            shortcut: 'Tab',
            disabled: isLocked,
          },
          {
            id: 'ctx_add_sibling',
            labelPl: 'Dodaj sąsiada',
            labelEn: 'Add sibling',
            icon: GitBranch,
            shortcut: 'Enter',
            disabled: isLocked || isProtected,
          },
          {
            id: 'ctx_duplicate',
            labelPl: 'Duplikuj',
            labelEn: 'Duplicate',
            icon: Copy,
            shortcut: '⌘D',
            disabled: isLocked || isProtected,
          },
          {
            id: 'ctx_copy_nodes',
            labelPl: 'Kopiuj',
            labelEn: 'Copy',
            icon: ClipboardCopy,
            shortcut: '⌘C',
            disabled: isProtected,
          },
          {
            id: 'ctx_cut_nodes',
            labelPl: 'Wytnij',
            labelEn: 'Cut',
            icon: Scissors,
            shortcut: '⌘X',
            disabled: isLocked || isProtected,
          },
          {
            id: 'ctx_paste_nodes',
            labelPl: 'Wklej',
            labelEn: 'Paste',
            icon: Clipboard,
            shortcut: '⌘V',
            disabled: isLocked || !canPasteNodes,
          },
        ],
      },
      {
        titlePl: 'Struktura',
        titleEn: 'Structure',
        items: [
          {
            id: 'ctx_toggle_collapse',
            labelPl: 'Zwiń / rozwiń',
            labelEn: 'Fold / unfold',
            icon: FoldVertical,
            shortcut: 'Space',
            disabled: isProtected,
          },
          {
            id: 'ctx_focus_subtree',
            labelPl: 'Skup poddrzewo',
            labelEn: 'Focus subtree',
            icon: ScanSearch,
            disabled: isProtected,
          },
          {
            id: 'ctx_drill_down',
            labelPl: 'Drill down',
            labelEn: 'Drill down',
            icon: ChevronRight,
            disabled: isProtected,
          },
          {
            id: 'ctx_connect_to_selected',
            labelPl: 'Połącz z zaznaczonym',
            labelEn: 'Connect to selected',
            icon: Link2,
            disabled: isLocked || isProtected,
          },
          {
            id: 'ctx_detach_branch',
            labelPl: 'Odłącz gałąź',
            labelEn: 'Detach branch',
            icon: Scissors,
            disabled: isLocked || isProtected,
          },
          {
            id: 'ctx_duplicate_branch',
            labelPl: 'Duplikuj gałąź',
            labelEn: 'Duplicate branch',
            icon: Copy,
            disabled: isLocked || isProtected,
          },
        ],
      },
      {
        titlePl: 'AI',
        titleEn: 'AI',
        items: [
          {
            id: 'ctx_ai_expand',
            labelPl: 'Rozbuduj temat',
            labelEn: 'Expand topic',
            icon: Sparkles,
            disabled: isLocked,
          },
          {
            id: 'ctx_ai_deepen',
            labelPl: 'Pogłęb',
            labelEn: 'Deepen',
            icon: Sparkles,
            disabled: isLocked,
          },
          {
            id: 'ctx_what_if',
            labelPl: 'Co jeśli...?',
            labelEn: 'What if...?',
            icon: GitBranch,
            disabled: isLocked,
          },
          {
            id: 'ctx_summarize_branch',
            labelPl: 'Podsumuj gałąź',
            labelEn: 'Summarize branch',
            icon: FileText,
            disabled: isLocked,
          },
          {
            id: 'ctx_dependencies',
            labelPl: 'Wykryj zależności',
            labelEn: 'Detect dependencies',
            icon: Network,
            disabled: isLocked,
          },
          {
            id: 'ctx_priority',
            labelPl: 'Priorytetyzacja',
            labelEn: 'Prioritize',
            icon: Target,
            disabled: isLocked,
          },
          {
            id: 'ctx_competitive',
            labelPl: 'Konkurencja',
            labelEn: 'Competitors',
            icon: Globe,
            disabled: isLocked,
          },
          {
            id: 'ai_suggest_links',
            labelPl: 'AI: Zasugeruj powiązania',
            labelEn: 'AI: Suggest links',
            icon: Sparkles,
            disabled: isLocked,
          },
        ],
      },
      {
        titlePl: 'Konwersja',
        titleEn: 'Convert',
        items: [
          {
            id: 'ctx_convert_initiative',
            labelPl: '→ Inicjatywa',
            labelEn: '→ Initiative',
            icon: Rocket,
            disabled: isLocked,
          },
          {
            id: 'ctx_convert_decision',
            labelPl: '→ Decyzja',
            labelEn: '→ Decision',
            icon: Star,
            disabled: isLocked,
          },
          {
            id: 'ctx_convert_tasks',
            labelPl: '→ Zadania',
            labelEn: '→ Tasks',
            icon: ListChecks,
            disabled: isLocked,
          },
        ],
      },
      ...(hasChildren
        ? ([
            {
              titlePl: 'Konwertuj gałąź na...',
              titleEn: 'Convert branch to...',
              items: [
                {
                  id: 'ctx_subtree_convert_decision',
                  labelPl: '→ Decyzja (gałąź)',
                  labelEn: '→ Decision (branch)',
                  icon: Star,
                  disabled: isLocked,
                },
                {
                  id: 'ctx_subtree_convert_tasks',
                  labelPl: '→ Zadania (gałąź)',
                  labelEn: '→ Tasks (branch)',
                  icon: ListChecks,
                  disabled: isLocked,
                },
                {
                  id: 'ctx_subtree_convert_task_set',
                  labelPl: '→ Zestaw zadań (gałąź)',
                  labelEn: '→ Task set (branch)',
                  icon: ListChecks,
                  disabled: isLocked,
                },
                {
                  id: 'ctx_subtree_convert_initiative',
                  labelPl: '→ Inicjatywa (gałąź)',
                  labelEn: '→ Initiative (branch)',
                  icon: Rocket,
                  disabled: isLocked,
                },
                {
                  id: 'ctx_subtree_convert_process_flow',
                  labelPl: '→ Przepływ procesu (gałąź)',
                  labelEn: '→ Process Flow (branch)',
                  icon: Workflow,
                  disabled: isLocked,
                },
              ] as MenuItemBase[],
            },
          ] as MenuGroup[])
        : []),
      {
        titlePl: 'Wygląd i dane',
        titleEn: 'Style & data',
        items: [
          {
            id: 'ctx_change_shape',
            labelPl: 'Zmień kształt',
            labelEn: 'Change shape',
            icon: Diamond,
            disabled: isLocked || isProtected,
          },
          {
            id: 'ctx_add_image',
            labelPl: 'Dodaj obraz',
            labelEn: 'Add image',
            icon: Image,
            disabled: isLocked || isProtected,
          },
          {
            id: 'ctx_copy_style',
            labelPl: 'Kopiuj styl',
            labelEn: 'Copy style',
            icon: Paintbrush,
            disabled: isProtected,
          },
          {
            id: 'ctx_paste_style',
            labelPl: 'Wklej styl',
            labelEn: 'Paste style',
            icon: Paintbrush,
            disabled: isLocked || isProtected || !canPasteStyle,
          },
          {
            id: 'ctx_vote_up',
            labelPl: 'Głosuj ↑',
            labelEn: 'Vote up',
            icon: Star,
            disabled: isLocked || isProtected,
          },
          {
            id: 'ctx_assign',
            labelPl: 'Przypisz osobę',
            labelEn: 'Assign person',
            icon: UserPlus,
            disabled: isLocked || isProtected,
          },
          {
            id: 'ctx_comments',
            labelPl: 'Komentarze',
            labelEn: 'Comments',
            icon: MessageSquare,
            disabled: isProtected,
          },
          {
            id: 'ctx_quick_notes',
            labelPl: 'Notatki',
            labelEn: 'Notes',
            icon: StickyNote,
            disabled: isProtected,
          },
          {
            id: 'ctx_quick_tags',
            labelPl: 'Tagi',
            labelEn: 'Tags',
            icon: Tag,
            disabled: isProtected,
          },
          {
            id: 'ctx_attach_knowledge',
            labelPl: 'Dołącz wiedzę',
            labelEn: 'Attach knowledge',
            icon: BookOpen,
            disabled: isLocked || isProtected,
          },
          {
            id: 'ctx_attach_artifact',
            labelPl: 'Dołącz artefakt',
            labelEn: 'Attach artifact',
            icon: BookOpen,
            disabled: isLocked || isProtected,
          },
          {
            id: 'ctx_open_linked_artifacts',
            labelPl: 'Powiązane artefakty',
            labelEn: 'Linked artifacts',
            icon: ExternalLink,
            disabled: isProtected,
          },
          {
            id: 'ctx_share_branch',
            labelPl: 'Kopiuj link',
            labelEn: 'Copy link',
            icon: Share2,
            disabled: isProtected,
          },
        ],
      },
      {
        titlePl: '',
        titleEn: '',
        items: [
          {
            id: 'ctx_delete',
            labelPl: 'Usuń',
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

  const clampedX = Math.min(x, window.innerWidth - 260);
  const clampedY = Math.min(y, window.innerHeight - 400);

  const renderItem = (item: MenuItemBase) => {
    const Icon = item.icon;
    const comingSoon = comingSoonIds?.includes(item.id) ?? false;
    const disabled = item.disabled || comingSoon;
    return (
      <button
        key={item.id}
        type="button"
        disabled={disabled}
        onClick={() => handleClick(item.id)}
        className={`w-full flex items-center gap-2 px-3 py-[6px] text-left text-[11px] font-medium transition-colors rounded-md ${menuItemClass({ ...item, disabled })}`}
      >
        <Icon
          size={13}
          className={`shrink-0 ${item.danger ? 'text-danger-500' : 'text-slate-600 dark:text-slate-500'}`}
        />
        <span className="flex-1 truncate">{isPl ? item.labelPl : item.labelEn}</span>
        {comingSoon && (
          <span className="text-[9px] text-slate-500 dark:text-slate-400 ml-2 shrink-0 italic">
            {isPl ? 'Wkrótce' : 'Coming soon'}
          </span>
        )}
        {item.shortcut && !comingSoon && (
          <span className="text-[9px] text-slate-600 dark:text-slate-500 font-mono ml-2 shrink-0">
            {item.shortcut}
          </span>
        )}
      </button>
    );
  };

  const hasSubmenuGroups = groups.length > 5;

  if (!hasSubmenuGroups) {
    return (
      <div
        ref={ref}
        className={`${MENU_CONTAINER_CLASS} min-w-[230px] max-h-[80vh] overflow-y-auto`}
        style={{ left: clampedX, top: clampedY }}
      >
        {groups.map((group, gi) => (
          <React.Fragment key={gi}>
            {group.titlePl && (
              <div className="px-3 pt-2 pb-1 text-[9px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-500">
                {isPl ? group.titlePl : group.titleEn}
              </div>
            )}
            {group.items.map(renderItem)}
            {gi < groups.length - 1 && (
              <div className="my-1.5 mx-2 h-px bg-slate-200/40 dark:bg-white/[0.04]" />
            )}
          </React.Fragment>
        ))}
      </div>
    );
  }

  const mainItems = groups.slice(0, 2);
  const subGroups = groups.slice(2, -1);
  const deleteGroup = groups[groups.length - 1];

  return (
    <div
      ref={ref}
      className={`${MENU_CONTAINER_CLASS} min-w-[230px]`}
      style={{ left: clampedX, top: clampedY }}
    >
      {mainItems.map((group, gi) => (
        <React.Fragment key={gi}>
          <div className="px-3 pt-2 pb-1 text-[9px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-500">
            {isPl ? group.titlePl : group.titleEn}
          </div>
          {group.items.map(renderItem)}
          <div className="my-1.5 mx-2 h-px bg-slate-200/40 dark:bg-white/[0.04]" />
        </React.Fragment>
      ))}

      {subGroups.map((group) => (
        <div
          key={group.titleEn}
          className="relative"
          onMouseEnter={() => {
            if (submenuTimerRef.current) window.clearTimeout(submenuTimerRef.current);
            setSubmenu(group.titleEn);
          }}
          onMouseLeave={() => {
            submenuTimerRef.current = window.setTimeout(() => setSubmenu(null), 200);
          }}
        >
          <button
            type="button"
            className="w-full flex items-center gap-2 px-3 py-[6px] text-left text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100/60 dark:hover:bg-white/[0.04] rounded-md"
          >
            <span className="flex-1">{isPl ? group.titlePl : group.titleEn}</span>
            <ChevronRight size={11} className="text-slate-600" />
          </button>

          {submenu === group.titleEn && (
            <div
              className="absolute left-full top-0 ml-1 min-w-[200px] py-1.5 px-1 rounded-xl bg-white/95 dark:bg-navy-900/95 backdrop-blur-xl border border-slate-200/60 dark:border-navy-700/60 shadow-2xl animate-in fade-in slide-in-from-left-1 duration-100"
              onMouseEnter={() => {
                if (submenuTimerRef.current) window.clearTimeout(submenuTimerRef.current);
              }}
              onMouseLeave={() => {
                submenuTimerRef.current = window.setTimeout(() => setSubmenu(null), 200);
              }}
            >
              <div className="px-3 pt-1 pb-1 text-[9px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-500">
                {isPl ? group.titlePl : group.titleEn}
              </div>
              {group.items.map(renderItem)}
            </div>
          )}
        </div>
      ))}

      <div className="my-1.5 mx-2 h-px bg-slate-200/40 dark:bg-white/[0.04]" />
      {deleteGroup.items.map(renderItem)}
    </div>
  );
};
