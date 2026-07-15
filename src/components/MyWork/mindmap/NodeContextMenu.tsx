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
import { useTranslation } from 'react-i18next';

import { usePointFixedMenuPosition } from '@/hooks/useFixedMenuPosition';

import { ContextMenuPortal } from './ContextMenuPortal';
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
  isPl: _isPl,
  canPasteStyle = false,
  canPasteNodes = false,
  hasChildren = false,
  comingSoonIds,
  onClose,
  onAction,
}) => {
  const { t } = useTranslation();
  const { ref, style: posStyle } = usePointFixedMenuPosition(x, y, true);
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
          className={`shrink-0 ${item.danger ? 'text-c-danger' : 'text-c-text-secondary dark:text-c-text-secondary'}`}
        />
        <span className="flex-1 truncate">{t(`myWorkMindmap.ctxMenu.${item.id}`, item.labelEn)}</span>
        {comingSoon && (
          <span className="text-[9px] text-c-text-secondary dark:text-c-text-secondary ml-2 shrink-0 italic">
            {t('ideas.mindmap.comingSoon', 'Coming soon')}
          </span>
        )}
        {item.shortcut && !comingSoon && (
          <span className="text-[9px] text-c-text-secondary dark:text-c-text-secondary font-mono ml-2 shrink-0">
            {item.shortcut}
          </span>
        )}
      </button>
    );
  };

  const hasSubmenuGroups = groups.length > 5;

  if (!hasSubmenuGroups) {
    return (
      <ContextMenuPortal>
        <div
          ref={ref}
          className={`${MENU_CONTAINER_CLASS} min-w-[230px] overflow-y-auto`}
          style={posStyle}
        >
          {groups.map((group, gi) => (
            <React.Fragment key={gi}>
              {group.titleKey && (
                <div className="px-3 pt-2 pb-1 text-[9px] font-bold uppercase tracking-wider text-c-text-secondary dark:text-c-text-secondary">
                  {t(group.titleKey, group.titleEn)}
                </div>
              )}
              {group.items.map(renderItem)}
              {gi < groups.length - 1 && (
                <div className="my-1.5 mx-2 h-px bg-c-surface-raised dark:bg-c-surface-raised" />
              )}
            </React.Fragment>
          ))}
        </div>
      </ContextMenuPortal>
    );
  }

  const mainItems = groups.slice(0, 2);
  const subGroups = groups.slice(2, -1);
  const deleteGroup = groups[groups.length - 1];

  return (
    <ContextMenuPortal>
      <div
        ref={ref}
        className={`${MENU_CONTAINER_CLASS} min-w-[230px] overflow-y-auto`}
        style={posStyle}
      >
        {mainItems.map((group, gi) => (
          <React.Fragment key={gi}>
            <div className="px-3 pt-2 pb-1 text-[9px] font-bold uppercase tracking-wider text-c-text-secondary dark:text-c-text-secondary">
              {t(group.titleKey, group.titleEn)}
            </div>
            {group.items.map(renderItem)}
            <div className="my-1.5 mx-2 h-px bg-c-surface-raised dark:bg-c-surface-raised" />
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
              className="w-full flex items-center gap-2 px-3 py-[6px] text-left text-[11px] font-medium text-c-text-secondary dark:text-c-text hover:bg-c-surface-raised dark:hover:bg-c-surface-raised rounded-md"
            >
              <span className="flex-1">{t(group.titleKey, group.titleEn)}</span>
              <ChevronRight size={11} className="text-c-text-secondary" />
            </button>

            {submenu === group.titleEn && (
              <div
                className="absolute left-full top-0 ml-1 min-w-[200px] max-h-[70vh] overflow-y-auto py-1.5 px-1 rounded-xl bg-c-surface-raised dark:bg-c-surface backdrop-blur-xl border border-c-border-subtle dark:border-c-border-subtle shadow-2xl animate-in fade-in slide-in-from-left-1 duration-100"
                onMouseEnter={() => {
                  if (submenuTimerRef.current) window.clearTimeout(submenuTimerRef.current);
                }}
                onMouseLeave={() => {
                  submenuTimerRef.current = window.setTimeout(() => setSubmenu(null), 200);
                }}
              >
                <div className="px-3 pt-1 pb-1 text-[9px] font-bold uppercase tracking-wider text-c-text-secondary dark:text-c-text-secondary">
                  {t(group.titleKey, group.titleEn)}
                </div>
                {group.items.map(renderItem)}
              </div>
            )}
          </div>
        ))}

        <div className="my-1.5 mx-2 h-px bg-c-surface-raised dark:bg-c-surface-raised" />
        {deleteGroup.items.map(renderItem)}
      </div>
    </ContextMenuPortal>
  );
};
