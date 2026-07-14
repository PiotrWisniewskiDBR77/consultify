import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalDistributeCenter,
  Bold,
  CheckSquare,
  CircleDot,
  Edit3,
  FoldVertical,
  GitBranch,
  GitPullRequest,
  Hash,
  Link2,
  ListChecks,
  Lock,
  MoreVertical,
  Paperclip,
  Plus,
  Rocket,
  Sparkles,
  Star,
  StickyNote,
  Tags,
  ToggleRight,
  UnfoldVertical,
  Unlock,
  Waypoints,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { ArtifactLink } from '@/utils/artifactLinks';

import type { AlignMode } from './alignDistribute';
import { ArtifactLinksPopover } from './floating-toolbar/ArtifactLinksPopover';
import { BranchThemeDropdown } from './floating-toolbar/BranchThemeDropdown';
import { ColorPickerPopover } from './floating-toolbar/ColorPickerPopover';
import { FloatingAIPopover } from './floating-toolbar/FloatingAIPopover';
import { FontSizeDropdown } from './floating-toolbar/FontSizeDropdown';
import {
  QuickLinkPopover,
  QuickNotesPopover,
  QuickTagsPopover,
} from './floating-toolbar/QuickEditPopovers';
import { QuickTaskPopover } from './floating-toolbar/QuickTaskPopover';
import { SemanticControlsPopover } from './floating-toolbar/SemanticControlsPopover';
import { SemanticTypeDropdown } from './floating-toolbar/SemanticTypeDropdown';

type DropdownId =
  | 'semanticType'
  | 'semantic'
  | 'branchTheme'
  | 'color'
  | 'fontSize'
  | 'artifacts'
  | 'task'
  | 'convertBranch'
  | 'ai'
  | 'quickNotes'
  | 'quickTags'
  | 'quickLink'
  | null;

export interface FloatingNodeToolbarProps {
  nodeId: string;
  nodeData?: Record<string, any>;
  disabled?: boolean;
  isProtected?: boolean;
  hasChildren?: boolean;
  /**
   * M06 Fala 3.2: 'multi' renders only the shared styling controls (type,
   * branch theme, auto-layout, color, font size, bold, lock) that apply
   * uniformly to every selected node — hides single-node-only affordances
   * (add child/sibling, rename, collapse, artifacts, quick task/notes/tags/
   * link, convert branch, AI, chat, context menu). Defaults to 'single' so
   * every existing call site is unaffected.
   */
  mode?: 'single' | 'multi';
  /** Count of selected nodes when mode === 'multi' (for the toolbar label). */
  selectionCount?: number;
  /**
   * M06 Fala 3.1 (behind `mindmapAlignSnap`): when true and mode === 'multi',
   * render the align/distribute button cluster. Distribute buttons are disabled
   * unless `canDistribute` (≥3 nodes selected).
   */
  showAlign?: boolean;
  canDistribute?: boolean;
  onAlignDistribute?: (mode: AlignMode) => void;
  style?: {
    color?: string;
    fillOpacity?: number;
    lineStyle?: 'solid' | 'dashed' | 'dotted';
    fontSize?: number;
    bold?: boolean;
    semanticType?: string;
    branchTheme?: string;
    autoLayout?: boolean;
    locked?: boolean;
  };
  position: { x: number; y: number };
  onUpdate: (patch: Record<string, any>) => void;
  onAddChild: () => void;
  onAddSibling: () => void;
  onOpenContextMenu: (pos: { x: number; y: number }) => void;
  onOpenArtifactModal: () => void;
  onOpenNodeDetail: () => void;
  onRemoveArtifact: (link: ArtifactLink) => void;
  onOpenLinkedArtifact: (link: ArtifactLink) => void;
  onOpenChatAboutNode: () => void;
  onAction: (action: string) => void;
}

export const FloatingNodeToolbar: React.FC<FloatingNodeToolbarProps> = ({
  nodeId,
  nodeData,
  disabled = false,
  isProtected = false,
  hasChildren = false,
  mode = 'single',
  selectionCount,
  showAlign = false,
  canDistribute = false,
  onAlignDistribute,
  style = {},
  position,
  onUpdate,
  onAddChild,
  onAddSibling,
  onOpenContextMenu,
  onOpenArtifactModal,
  onOpenNodeDetail,
  onRemoveArtifact,
  onOpenLinkedArtifact,
  onOpenChatAboutNode,
  onAction,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const isMulti = mode === 'multi';
  const [openDropdown, setOpenDropdown] = useState<DropdownId>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    setOpenDropdown(null);
  }, [nodeId]);

  const toggle = useCallback((id: DropdownId) => {
    setOpenDropdown((cur) => (cur === id ? null : id));
  }, []);

  const closeDD = useCallback(() => setOpenDropdown(null), []);

  const btnClass = (active: boolean) =>
    `flex h-9 w-9 items-center justify-center rounded-hig-lg transition-all duration-150 ${
      active
        ? 'bg-c-surface-raised dark:bg-c-surface text-c-text dark:text-c-text'
        : 'text-c-text-secondary dark:text-c-text-muted hover:bg-c-surface-raised dark:hover:bg-c-surface-raised'
    }`;

  return (
    <div
      ref={ref}
      className="floating-node-toolbar absolute z-dropdown pointer-events-auto"
      style={{
        left: position.x,
        top: position.y - 48,
        transform: 'translateX(-50%)',
      }}
    >
      <div className="flex items-center gap-0.5 rounded-hig-2xl bg-c-surface-raised dark:bg-c-surface backdrop-blur-sm border border-c-border-subtle dark:border-c-border-subtle shadow-hig-xl px-1 py-0.5">
        {/* Multi-select label — replaces the single-node growth affordances */}
        {isMulti && (
          <div className="flex h-9 items-center px-2 text-[10px] font-semibold text-c-text-secondary dark:text-c-text-muted whitespace-nowrap">
            {isPl
              ? `${selectionCount ?? ''} zaznaczonych`.trim()
              : `${selectionCount ?? ''} selected`.trim()}
          </div>
        )}

        {/* M06 Fala 3.1: align / distribute cluster (multi-select only). */}
        {isMulti && showAlign && onAlignDistribute && (
          <>
            {(
              [
                {
                  m: 'align-left',
                  Icon: AlignStartVertical,
                  pl: 'Wyrównaj do lewej',
                  en: 'Align left',
                  dist: false,
                },
                {
                  m: 'align-center-h',
                  Icon: AlignCenterVertical,
                  pl: 'Wyśrodkuj w poziomie',
                  en: 'Align center',
                  dist: false,
                },
                {
                  m: 'align-right',
                  Icon: AlignEndVertical,
                  pl: 'Wyrównaj do prawej',
                  en: 'Align right',
                  dist: false,
                },
                {
                  m: 'align-top',
                  Icon: AlignStartHorizontal,
                  pl: 'Wyrównaj do góry',
                  en: 'Align top',
                  dist: false,
                },
                {
                  m: 'align-middle-v',
                  Icon: AlignCenterHorizontal,
                  pl: 'Wyśrodkuj w pionie',
                  en: 'Align middle',
                  dist: false,
                },
                {
                  m: 'align-bottom',
                  Icon: AlignEndHorizontal,
                  pl: 'Wyrównaj do dołu',
                  en: 'Align bottom',
                  dist: false,
                },
                {
                  m: 'distribute-h',
                  Icon: AlignHorizontalDistributeCenter,
                  pl: 'Rozłóż poziomo',
                  en: 'Distribute horizontally',
                  dist: true,
                },
                {
                  m: 'distribute-v',
                  Icon: AlignVerticalDistributeCenter,
                  pl: 'Rozłóż pionowo',
                  en: 'Distribute vertically',
                  dist: true,
                },
              ] as const
            ).map(({ m, Icon, pl, en, dist }) => {
              const disabledBtn = dist && !canDistribute;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => onAlignDistribute(m as AlignMode)}
                  disabled={disabledBtn}
                  title={isPl ? pl : en}
                  aria-label={isPl ? pl : en}
                  className={`${btnClass(false)} ${disabledBtn ? 'opacity-40 pointer-events-none' : ''}`}
                >
                  <Icon size={13} />
                </button>
              );
            })}
            <div className="w-px h-4 bg-c-surface-raised dark:bg-c-surface-raised mx-0.5" />
          </>
        )}

        {!isMulti && (
          <>
            {/* 0a. Add child — primary growth affordance */}
            <button
              onClick={onAddChild}
              disabled={disabled}
              title={isPl ? 'Dodaj gałąź (Tab)' : 'Add child (Tab)'}
              aria-label={isPl ? 'Dodaj gałąź (Tab)' : 'Add child (Tab)'}
              className={`flex h-9 items-center gap-1 px-1.5 rounded-hig-lg transition-all duration-150 text-c-text-secondary dark:text-c-text-muted hover:bg-c-surface-raised dark:hover:bg-c-surface ${disabled ? 'opacity-40 pointer-events-none' : ''}`}
            >
              <Plus size={14} strokeWidth={2.5} />
              <span className="text-[10px] font-semibold">{isPl ? 'Gałąź' : 'Child'}</span>
            </button>

            {/* 0b. Add sibling — secondary growth affordance */}
            {!isProtected && (
              <button
                onClick={onAddSibling}
                disabled={disabled}
                title={isPl ? 'Dodaj sąsiada (Shift+Enter)' : 'Add sibling (Shift+Enter)'}
                aria-label={isPl ? 'Dodaj sąsiada (Shift+Enter)' : 'Add sibling (Shift+Enter)'}
                className={`flex h-9 items-center gap-1 px-1.5 rounded-hig-lg transition-all duration-150 text-c-text-secondary dark:text-c-text-muted hover:bg-c-surface-raised dark:hover:bg-c-surface-raised ${disabled ? 'opacity-40 pointer-events-none' : ''}`}
              >
                <GitBranch size={13} />
                <span className="text-[10px] font-medium">{isPl ? 'Sąsiad' : 'Sibling'}</span>
              </button>
            )}

            {/* 0c. Rename */}
            <button
              onClick={() => onAction('ctx_edit')}
              disabled={disabled || isProtected}
              title={isPl ? 'Zmień nazwę (F2)' : 'Rename (F2)'}
              aria-label={isPl ? 'Zmień nazwę (F2)' : 'Rename (F2)'}
              className={btnClass(false)}
            >
              <Edit3 size={13} />
            </button>

            {/* 0d. Collapse/Expand */}
            {hasChildren && (
              <button
                onClick={() => onAction('mm_toggle_collapse')}
                title={
                  isPl
                    ? nodeData?._collapsed
                      ? 'Rozwiń (Space)'
                      : 'Zwiń (Space)'
                    : nodeData?._collapsed
                      ? 'Expand (Space)'
                      : 'Collapse (Space)'
                }
                aria-label={isPl ? 'Zwiń/Rozwiń' : 'Collapse/Expand'}
                className={btnClass(false)}
              >
                {nodeData?._collapsed ? <UnfoldVertical size={13} /> : <FoldVertical size={13} />}
              </button>
            )}
          </>
        )}

        <div className="w-px h-4 bg-c-surface-raised dark:bg-c-surface-raised mx-0.5" />

        {/* 1. Semantic Type */}
        <div className="relative">
          <button
            onClick={() => toggle('semanticType')}
            title={isPl ? 'Typ węzła' : 'Node type'}
            aria-label={isPl ? 'Typ węzła' : 'Node type'}
            className={btnClass(openDropdown === 'semanticType')}
          >
            <CircleDot size={13} />
          </button>
          {openDropdown === 'semanticType' && (
            <div className="absolute top-full left-0 mt-1 z-dropdown">
              <SemanticTypeDropdown
                isPl={!!isPl}
                current={style.semanticType}
                onSelect={(type) => onUpdate({ semanticType: type })}
                onClose={closeDD}
              />
            </div>
          )}
        </div>

        {/* 1b. Semantic control center */}
        <div className="relative">
          <button
            onClick={() => toggle('semantic')}
            title={isPl ? 'Semantyka i tagi' : 'Semantics and tags'}
            aria-label={isPl ? 'Semantyka i tagi' : 'Semantics and tags'}
            className={btnClass(openDropdown === 'semantic')}
          >
            <Tags size={13} />
          </button>
          {openDropdown === 'semantic' && (
            <div className="absolute top-full left-0 mt-1 z-dropdown">
              <SemanticControlsPopover
                isPl={!!isPl}
                disabled={disabled}
                nodeData={nodeData}
                onUpdate={(patch) => onUpdate(patch)}
                onOpenNodeDetail={() => {
                  onOpenNodeDetail();
                  closeDD();
                }}
              />
            </div>
          )}
        </div>

        {/* 2. Branch theme / line style */}
        <div className="relative">
          <button
            onClick={() => toggle('branchTheme')}
            title={isPl ? 'Styl linii' : 'Line style'}
            aria-label={isPl ? 'Styl linii' : 'Line style'}
            className={btnClass(openDropdown === 'branchTheme')}
          >
            <Waypoints size={13} />
          </button>
          {openDropdown === 'branchTheme' && (
            <div className="absolute top-full left-0 mt-1 z-dropdown">
              <BranchThemeDropdown
                isPl={!!isPl}
                current={style.branchTheme}
                onSelect={(theme) => onUpdate({ branchTheme: theme })}
                onClose={closeDD}
              />
            </div>
          )}
        </div>

        {/* 3. Auto-layout toggle */}
        <button
          onClick={() => onUpdate({ autoLayout: !style.autoLayout })}
          title={isPl ? 'Auto-układ gałęzi' : 'Auto-layout branch'}
          aria-label={isPl ? 'Auto-układ gałęzi' : 'Auto-layout branch'}
          className={btnClass(!!style.autoLayout)}
        >
          <ToggleRight size={13} />
        </button>

        {/* 4. Color */}
        <div className="relative">
          <button
            onClick={() => toggle('color')}
            title={isPl ? 'Kolor' : 'Color'}
            aria-label={isPl ? 'Kolor' : 'Color'}
            className={btnClass(openDropdown === 'color')}
          >
            <div
              className="w-3.5 h-3.5 rounded-full border border-c-border-subtle dark:border-c-border-subtle"
              style={{ backgroundColor: style.color || 'var(--c-tag-2)' }}
            />
          </button>
          {openDropdown === 'color' && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-dropdown">
              <ColorPickerPopover
                isPl={!!isPl}
                currentColor={style.color}
                currentFillOpacity={style.fillOpacity}
                currentLineStyle={style.lineStyle}
                onUpdate={(patch) => onUpdate(patch)}
                onClose={closeDD}
              />
            </div>
          )}
        </div>

        {/* 5. Font size */}
        <div className="relative">
          <button
            onClick={() => toggle('fontSize')}
            title={isPl ? 'Rozmiar czcionki' : 'Font size'}
            aria-label={isPl ? 'Rozmiar czcionki' : 'Font size'}
            className={`${btnClass(openDropdown === 'fontSize')} text-[10px] font-semibold`}
          >
            {style.fontSize || 14}
          </button>
          {openDropdown === 'fontSize' && (
            <div className="absolute top-full left-0 mt-1 z-dropdown">
              <FontSizeDropdown
                current={style.fontSize || 14}
                onSelect={(size) => onUpdate({ fontSize: size })}
                onClose={closeDD}
              />
            </div>
          )}
        </div>

        {/* 6. Bold */}
        <button
          onClick={() => onUpdate({ bold: !style.bold })}
          title={isPl ? 'Pogrubienie' : 'Bold'}
          aria-label={isPl ? 'Pogrubienie' : 'Bold'}
          className={btnClass(!!style.bold)}
        >
          <Bold size={13} />
        </button>

        <div className="w-px h-4 bg-c-surface-raised dark:bg-c-surface-raised mx-0.5" />

        {/* 7. Link / Artifact */}
        {!isMulti && (
          <div className="relative">
            <button
              onClick={() => toggle('artifacts')}
              title={isPl ? 'Powiązane artefakty' : 'Linked artifacts'}
              aria-label={isPl ? 'Powiązane artefakty' : 'Linked artifacts'}
              className={btnClass(openDropdown === 'artifacts')}
            >
              <Paperclip size={13} />
            </button>
            {openDropdown === 'artifacts' && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-dropdown">
                <ArtifactLinksPopover
                  isPl={!!isPl}
                  disabled={disabled}
                  links={Array.isArray(nodeData?.artifactLinks) ? nodeData.artifactLinks : []}
                  onAttach={() => {
                    onOpenArtifactModal();
                    closeDD();
                  }}
                  onOpenNodeDetail={() => {
                    onOpenNodeDetail();
                    closeDD();
                  }}
                  onOpenArtifact={(link) => {
                    onOpenLinkedArtifact(link);
                    closeDD();
                  }}
                  onRemoveArtifact={(link) => onRemoveArtifact(link)}
                />
              </div>
            )}
          </div>
        )}

        {/* 8. Quick Task */}
        {!isMulti && (
          <div className="relative">
            <button
              onClick={() => toggle('task')}
              title={isPl ? 'Szybkie zadanie' : 'Quick task'}
              aria-label={isPl ? 'Szybkie zadanie' : 'Quick task'}
              className={btnClass(openDropdown === 'task')}
            >
              <CheckSquare size={13} />
            </button>
            {openDropdown === 'task' && (
              <div className="absolute top-full left-0 mt-1 z-dropdown">
                <QuickTaskPopover
                  isPl={!!isPl}
                  nodeId={nodeId}
                  nodeLabel={nodeData?.label}
                  onClose={closeDD}
                  onAction={onAction}
                />
              </div>
            )}
          </div>
        )}

        {/* 8b. Convert branch */}
        {!isMulti && hasChildren && !isProtected && (
          <div className="relative">
            <button
              onClick={() => toggle('convertBranch')}
              disabled={disabled}
              title={isPl ? 'Konwertuj gałąź na...' : 'Convert branch to...'}
              aria-label={isPl ? 'Konwertuj gałąź na...' : 'Convert branch to...'}
              className={btnClass(openDropdown === 'convertBranch')}
            >
              <GitPullRequest size={13} />
            </button>
            {openDropdown === 'convertBranch' && (
              <div className="absolute top-full right-0 mt-1 z-dropdown min-w-[180px] py-1.5 px-1 rounded-hig-xl bg-c-surface-raised dark:bg-c-surface backdrop-blur-xl border border-c-border-subtle dark:border-c-border-subtle shadow-hig-xl animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 pt-1 pb-1 text-[9px] font-semibold uppercase tracking-wider text-c-text-secondary dark:text-c-text-secondary">
                  {isPl ? 'Konwertuj gałąź na...' : 'Convert branch to...'}
                </div>
                {(
                  [
                    {
                      id: 'ctx_subtree_convert_decision',
                      label: isPl ? 'Decyzja' : 'Decision',
                      icon: Star,
                    },
                    {
                      id: 'ctx_subtree_convert_tasks',
                      label: isPl ? 'Zadania' : 'Tasks',
                      icon: ListChecks,
                    },
                    {
                      id: 'ctx_subtree_convert_task_set',
                      label: isPl ? 'Zestaw zadań' : 'Task set',
                      icon: ListChecks,
                    },
                    {
                      id: 'ctx_subtree_convert_initiative',
                      label: isPl ? 'Inicjatywa' : 'Initiative',
                      icon: Rocket,
                    },
                    {
                      id: 'ctx_subtree_convert_process_flow',
                      label: isPl ? 'Przepływ procesu' : 'Process Flow',
                      icon: Waypoints,
                    },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onAction(item.id);
                      closeDD();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-[6px] text-left text-[11px] font-medium text-c-text-secondary dark:text-c-text hover:bg-c-surface-raised dark:hover:bg-c-surface-raised rounded-hig-md transition-colors"
                  >
                    <item.icon
                      size={13}
                      className="shrink-0 text-c-text-secondary dark:text-c-text-secondary"
                    />
                    <span className="flex-1 truncate">{item.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 9. Lock */}
        <button
          onClick={() => onUpdate({ locked: !style.locked })}
          title={isPl ? (style.locked ? 'Odblokuj' : 'Zablokuj') : style.locked ? 'Unlock' : 'Lock'}
          aria-label={
            isPl ? (style.locked ? 'Odblokuj' : 'Zablokuj') : style.locked ? 'Unlock' : 'Lock'
          }
          className={btnClass(!!style.locked)}
        >
          {style.locked ? <Lock size={13} /> : <Unlock size={13} />}
        </button>

        {/* 9a. Quick Notes */}
        {!isMulti && (
          <div className="relative">
            <button
              onClick={() => toggle('quickNotes')}
              disabled={disabled}
              title={isPl ? 'Szybka notatka' : 'Quick notes'}
              className={btnClass(openDropdown === 'quickNotes')}
            >
              <StickyNote size={13} />
            </button>
            {openDropdown === 'quickNotes' && (
              <div className="absolute top-full left-0 mt-1 z-dropdown">
                <QuickNotesPopover
                  isPl={!!isPl}
                  nodeId={nodeId}
                  currentNotes={nodeData?.notes || ''}
                  onSave={(id, notes) => onUpdate({ notes })}
                  onClose={closeDD}
                />
              </div>
            )}
          </div>
        )}

        {/* 9b. Quick Tags */}
        {!isMulti && (
          <div className="relative">
            <button
              onClick={() => toggle('quickTags')}
              disabled={disabled}
              title={isPl ? 'Szybkie tagi' : 'Quick tags'}
              className={btnClass(openDropdown === 'quickTags')}
            >
              <Hash size={13} />
            </button>
            {openDropdown === 'quickTags' && (
              <div className="absolute top-full left-0 mt-1 z-dropdown">
                <QuickTagsPopover
                  isPl={!!isPl}
                  nodeId={nodeId}
                  currentTags={Array.isArray(nodeData?.tags) ? nodeData.tags : []}
                  onSave={(id, tags) => onUpdate({ tags })}
                  onClose={closeDD}
                />
              </div>
            )}
          </div>
        )}

        {/* 9c. Quick Link */}
        {!isMulti && (
          <div className="relative">
            <button
              onClick={() => toggle('quickLink')}
              disabled={disabled}
              title={isPl ? 'Szybki link' : 'Quick link'}
              className={btnClass(openDropdown === 'quickLink')}
            >
              <Link2 size={13} />
            </button>
            {openDropdown === 'quickLink' && (
              <div className="absolute top-full left-0 mt-1 z-dropdown">
                <QuickLinkPopover
                  isPl={!!isPl}
                  nodeId={nodeId}
                  currentLink={nodeData?.evidenceLink || ''}
                  onSave={(id, link) => onUpdate({ evidenceLink: link })}
                  onClose={closeDD}
                />
              </div>
            )}
          </div>
        )}

        <div className="w-px h-4 bg-c-surface-raised dark:bg-c-surface-raised mx-0.5" />

        {/* 10. AI */}
        {!isMulti && (
          <div className="relative">
            <button
              onClick={() => toggle('ai')}
              title="AI"
              aria-label="AI"
              className={btnClass(openDropdown === 'ai')}
            >
              <Sparkles size={13} />
            </button>
            {openDropdown === 'ai' && (
              <div className="absolute top-full right-0 mt-1 z-dropdown">
                <FloatingAIPopover
                  isPl={!!isPl}
                  nodeId={nodeId}
                  onAction={onAction}
                  onOpenChatAboutNode={onOpenChatAboutNode}
                  onClose={closeDD}
                />
              </div>
            )}
          </div>
        )}

        {/* 10. More (opens context menu) — single-node only, context menu acts on one node */}
        {!isMulti && (
          <button
            onClick={(e) => onOpenContextMenu({ x: e.clientX, y: e.clientY })}
            title={isPl ? 'Więcej opcji' : 'More options'}
            aria-label={isPl ? 'Więcej opcji' : 'More options'}
            className={btnClass(false)}
          >
            <MoreVertical size={13} />
          </button>
        )}
      </div>
    </div>
  );
};

export default FloatingNodeToolbar;
