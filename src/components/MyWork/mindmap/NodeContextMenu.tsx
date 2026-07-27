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
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
  /**
   * „Przypięte" podmenu = otwarte KLIKNIĘCIEM (albo klawiaturą), więc zjechanie
   * myszą go NIE zamyka. Najechanie zostaje skrótem: otwiera nieprzypięte
   * podmenu, które chowa się po 200 ms od zjechania.
   */
  const [pinned, setPinned] = useState(false);
  const pinnedRef = useRef(false);
  pinnedRef.current = pinned;
  const submenuTimerRef = useRef<number | null>(null);
  const submenuPanelRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const headerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  /**
   * Pozycja panelu podmenu liczona względem nagłówka kategorii.
   *
   * Podmenu MUSI być portalowane do <body>: kontener menu ma `overflow-y: auto`
   * (żeby długie menu się przewijało), a wtedy CSS wylicza `overflow-x: auto` —
   * dziecko na `left: 100%` było PRZYCINANE i niewidoczne (`elementFromPoint` w
   * miejscu panelu zwracał `react-flow__pane`). Dlatego nawet najechanie myszą
   * nie pokazywało nic — kategorie wyglądały na całkiem martwe.
   */
  const [submenuPos, setSubmenuPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (!submenu) {
      setSubmenuPos(null);
      return;
    }
    const header = headerRefs.current[submenu];
    const panel = submenuPanelRefs.current[submenu];
    if (!header) return;
    const MARGIN = 8;
    const hr = header.getBoundingClientRect();
    const pw = panel?.offsetWidth || 210;
    const ph = panel?.offsetHeight || 300;
    let left = hr.right + 4;
    if (left + pw > window.innerWidth - MARGIN) left = Math.max(MARGIN, hr.left - pw - 4);
    let top = hr.top;
    if (top + ph > window.innerHeight - MARGIN)
      top = Math.max(MARGIN, window.innerHeight - MARGIN - ph);
    setSubmenuPos({ left, top });
  }, [submenu]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Panel podmenu żyje w portalu (poza `ref`), więc klik w jego pozycję
      // musi być jawnie uznany za „wewnątrz menu" — inaczej menu zamknęłoby się
      // na `mousedown`, zanim `click` zdążyłby odpalić akcję.
      const insideSubmenu = submenu ? !!submenuPanelRefs.current[submenu]?.contains(target) : false;
      if (ref.current && !ref.current.contains(target) && !insideSubmenu) onClose();
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (submenu) {
          headerRefs.current[submenu]?.focus();
          setSubmenu(null);
          setPinned(false);
          return;
        }
        onClose();
      }
    };
    // CAPTURE PHASE IS LOAD-BEARING — nie zmieniaj na zwykły listener.
    // d3-zoom (pod ReactFlow) w swoim `mousedowned` woła `nopropagation(event)`
    // = `event.stopImmediatePropagation()` (d3-zoom/src/zoom.js:280) na
    // `.react-flow__pane`. Każdy `mousedown` na pustym płótnie ginie więc, zanim
    // dojdzie do `window` w fazie bąbelkowania — menu kontekstowe zostawało
    // otwarte na zawsze (Piotr 07-27: „nie mogę go zamknąć"). Faza przechwytywania
    // na `window` odpala się PRZED handlerem d3, więc jest nie do zatrzymania.
    window.addEventListener('mousedown', handler, true);
    window.addEventListener('keydown', keyHandler);
    return () => {
      window.removeEventListener('mousedown', handler, true);
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
        className={`w-full flex items-center gap-2 px-3 py-[6px] text-left text-[11px] font-medium transition-colors rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus ${menuItemClass({ ...item, disabled })}`}
      >
        <Icon
          size={13}
          className={`shrink-0 ${item.danger ? 'text-c-danger' : 'text-c-text-secondary dark:text-c-text-secondary'}`}
        />
        <span className="flex-1 truncate">
          {t(`myWorkMindmap.ctxMenu.${item.id}`, item.labelEn)}
        </span>
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

        {subGroups.map((group) => {
          const key = group.titleEn;
          const open = submenu === key;
          const panelId = `ctx-submenu-${key.replace(/[^a-zA-Z0-9]+/g, '-')}`;
          return (
            <div
              key={key}
              className="relative"
              onMouseEnter={() => {
                // Najechanie = SKRÓT (otwiera nieprzypięte podmenu). Przejście
                // myszą na inną kategorię odpina poprzednią.
                if (submenuTimerRef.current) window.clearTimeout(submenuTimerRef.current);
                setSubmenu(key);
                setPinned(false);
              }}
              onMouseLeave={() => {
                // Podmenu otwarte klikiem/klawiaturą zostaje — zjechanie myszą go
                // nie zamyka (to był ból: kategoria „nie działa" pod kliknięciem).
                if (pinnedRef.current) return;
                submenuTimerRef.current = window.setTimeout(() => {
                  if (!pinnedRef.current) setSubmenu(null);
                }, 200);
              }}
            >
              <button
                ref={(el) => {
                  headerRefs.current[key] = el;
                }}
                type="button"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls={open ? panelId : undefined}
                // Nagłówek kategorii reaguje NA KLIKNIĘCIE (wcześniej był to
                // <button> bez onClick — klik dosłownie nic nie robił, stąd
                // „tutaj nic nie działa z tych 4 przycisków").
                onClick={() => {
                  if (submenuTimerRef.current) window.clearTimeout(submenuTimerRef.current);
                  if (open && pinned) {
                    setSubmenu(null);
                    setPinned(false);
                    return;
                  }
                  setSubmenu(key);
                  setPinned(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') {
                    // preventDefault na Enter/Space blokuje syntetyczny klik
                    // przycisku, więc podmenu nie przełącza się dwa razy.
                    e.preventDefault();
                    if (submenuTimerRef.current) window.clearTimeout(submenuTimerRef.current);
                    if (open && pinned && e.key !== 'ArrowRight') {
                      setSubmenu(null);
                      setPinned(false);
                      return;
                    }
                    setSubmenu(key);
                    setPinned(true);
                    window.setTimeout(() => {
                      submenuPanelRefs.current[key]
                        ?.querySelector<HTMLButtonElement>('button:not([disabled])')
                        ?.focus();
                    }, 0);
                  }
                }}
                className="w-full flex items-center gap-2 px-3 py-[6px] text-left text-[11px] font-medium text-c-text-secondary dark:text-c-text hover:bg-c-surface-raised dark:hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus rounded-md"
              >
                <span className="flex-1">{t(group.titleKey, group.titleEn)}</span>
                <ChevronRight
                  size={11}
                  className={`text-c-text-secondary transition-transform ${open ? 'rotate-90' : ''}`}
                />
              </button>

              {open && (
                <ContextMenuPortal>
                  <div
                    id={panelId}
                    ref={(el) => {
                      submenuPanelRefs.current[key] = el;
                    }}
                    style={{
                      position: 'fixed',
                      left: submenuPos ? submenuPos.left : -9999,
                      top: submenuPos ? submenuPos.top : -9999,
                    }}
                    className="z-[101] min-w-[200px] max-h-[70vh] overflow-y-auto py-1.5 px-1 rounded-xl bg-c-surface-raised dark:bg-c-surface backdrop-blur-xl border border-c-border-subtle dark:border-c-border-subtle shadow-2xl animate-in fade-in slide-in-from-left-1 duration-100"
                    onMouseEnter={() => {
                      // Most myszy nagłówek → zawartość: kasujemy timer, więc
                      // podmenu nie znika w trakcie przejazdu.
                      if (submenuTimerRef.current) window.clearTimeout(submenuTimerRef.current);
                    }}
                    onMouseLeave={() => {
                      if (pinnedRef.current) return;
                      submenuTimerRef.current = window.setTimeout(() => {
                        if (!pinnedRef.current) setSubmenu(null);
                      }, 200);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowLeft') {
                        e.preventDefault();
                        setSubmenu(null);
                        setPinned(false);
                        headerRefs.current[key]?.focus();
                        return;
                      }
                      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
                      e.preventDefault();
                      const focusables = Array.from(
                        e.currentTarget.querySelectorAll<HTMLButtonElement>(
                          'button:not([disabled])'
                        )
                      );
                      if (focusables.length === 0) return;
                      const idx = focusables.indexOf(document.activeElement as HTMLButtonElement);
                      const next =
                        e.key === 'ArrowDown'
                          ? focusables[(idx + 1 + focusables.length) % focusables.length]
                          : focusables[(idx - 1 + focusables.length) % focusables.length];
                      next?.focus();
                    }}
                  >
                    <div className="px-3 pt-1 pb-1 text-[9px] font-bold uppercase tracking-wider text-c-text-secondary dark:text-c-text-secondary">
                      {t(group.titleKey, group.titleEn)}
                    </div>
                    {group.items.map(renderItem)}
                  </div>
                </ContextMenuPortal>
              )}
            </div>
          );
        })}

        <div className="my-1.5 mx-2 h-px bg-c-surface-raised dark:bg-c-surface-raised" />
        {deleteGroup.items.map(renderItem)}
      </div>
    </ContextMenuPortal>
  );
};
