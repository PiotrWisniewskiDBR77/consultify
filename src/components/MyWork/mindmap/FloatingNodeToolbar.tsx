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

import { type ActionContext, getAction, runIdeaAction } from '@/actions/ideaActionRegistry';
import { EMPTY_SELECTION } from '@/components/MyWork/ideaSelectionTypes';
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

/**
 * N5 trzecia fala (2026-08-09) — dual-surface z `NodeContextMenu.tsx`'s
 * `REGISTRY_ID_BY_LOCAL_ID` (Convert branch group): TE SAME 5 lokalnych id
 * (`ctx_subtree_convert_*`, renderowane tu 1:1 z tego samego zestawu co menu
 * kontekstowe) → TE SAME 5 wpisów rejestru, `surfaces: ['context','floating']`
 * po stronie `ideaActionRegistry.ts` (Z1: jedna realna akcja = jeden id).
 * Lokalna kopia mapy (nie import z `NodeContextMenu.tsx`, który jej nie
 * eksportuje) — duplikacja WYŁĄCZNIE tej stałej, nie logiki dispatchu.
 */
const CONVERT_BRANCH_REGISTRY_ID_BY_LOCAL_ID: Record<string, string> = {
  ctx_subtree_convert_decision: 'idea.node.mm_convert_branch_decision',
  ctx_subtree_convert_tasks: 'idea.node.mm_convert_branch_tasks',
  ctx_subtree_convert_task_set: 'idea.node.mm_convert_branch_task_set',
  ctx_subtree_convert_initiative: 'idea.node.mm_convert_branch_initiative',
  ctx_subtree_convert_process_flow: 'idea.node.mm_convert_branch_process_flow',
};

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
  const { t, i18n } = useTranslation();
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
            {t('ideas.mindmap.nSelected', '{{count}} selected', {
              count: selectionCount ?? 0,
            }).trim()}
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
                  en: 'Align left',
                  dist: false,
                },
                {
                  m: 'align-center-h',
                  Icon: AlignCenterVertical,
                  en: 'Align center',
                  dist: false,
                },
                {
                  m: 'align-right',
                  Icon: AlignEndVertical,
                  en: 'Align right',
                  dist: false,
                },
                {
                  m: 'align-top',
                  Icon: AlignStartHorizontal,
                  en: 'Align top',
                  dist: false,
                },
                {
                  m: 'align-middle-v',
                  Icon: AlignCenterHorizontal,
                  en: 'Align middle',
                  dist: false,
                },
                {
                  m: 'align-bottom',
                  Icon: AlignEndHorizontal,
                  en: 'Align bottom',
                  dist: false,
                },
                {
                  m: 'distribute-h',
                  Icon: AlignHorizontalDistributeCenter,
                  en: 'Distribute horizontally',
                  dist: true,
                },
                {
                  m: 'distribute-v',
                  Icon: AlignVerticalDistributeCenter,
                  en: 'Distribute vertically',
                  dist: true,
                },
              ] as const
            ).map(({ m, Icon, en, dist }) => {
              const disabledBtn = dist && !canDistribute;
              const label = t(`myWorkMindmap.align.${m}`, en);
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => onAlignDistribute(m as AlignMode)}
                  disabled={disabledBtn}
                  title={label}
                  aria-label={label}
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
              title={t('ideas.mindmap.addChildTab', 'Add child (Tab)')}
              aria-label={t('ideas.mindmap.addChildTab', 'Add child (Tab)')}
              className={`flex h-9 items-center gap-1 px-1.5 rounded-hig-lg transition-all duration-150 text-c-text-secondary dark:text-c-text-muted hover:bg-c-surface-raised dark:hover:bg-c-surface ${disabled ? 'opacity-40 pointer-events-none' : ''}`}
            >
              <Plus size={14} strokeWidth={2.5} />
              <span className="text-[10px] font-semibold">{t('ideas.mindmap.child', 'Child')}</span>
            </button>

            {/* 0b. Add sibling — secondary growth affordance */}
            {!isProtected && (
              <button
                onClick={onAddSibling}
                disabled={disabled}
                title={t('ideas.mindmap.addSiblingShiftEnter', 'Add sibling (Shift+Enter)')}
                aria-label={t('ideas.mindmap.addSiblingShiftEnter', 'Add sibling (Shift+Enter)')}
                className={`flex h-9 items-center gap-1 px-1.5 rounded-hig-lg transition-all duration-150 text-c-text-secondary dark:text-c-text-muted hover:bg-c-surface-raised dark:hover:bg-c-surface-raised ${disabled ? 'opacity-40 pointer-events-none' : ''}`}
              >
                <GitBranch size={13} />
                <span className="text-[10px] font-medium">
                  {t('ideas.mindmap.sibling', 'Sibling')}
                </span>
              </button>
            )}

            {/* 0c. Rename */}
            <button
              onClick={() => onAction('ctx_edit')}
              disabled={disabled || isProtected}
              title={t('ideas.mindmap.renameF2', 'Rename (F2)')}
              aria-label={t('ideas.mindmap.renameF2', 'Rename (F2)')}
              className={btnClass(false)}
            >
              <Edit3 size={13} />
            </button>

            {/* 0d. Collapse/Expand */}
            {hasChildren && (
              <button
                onClick={() => onAction('mm_toggle_collapse')}
                title={
                  nodeData?._collapsed
                    ? t('myWorkMindmap.expandSpace', 'Expand (Space)')
                    : t('myWorkMindmap.collapseSpace', 'Collapse (Space)')
                }
                aria-label={t('ideas.mindmap.collapseExpand', 'Collapse/Expand')}
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
            title={t('ideas.mindmap.nodeType', 'Node type')}
            aria-label={t('ideas.mindmap.nodeType', 'Node type')}
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
            title={t('ideas.mindmap.semanticsTags', 'Semantics and tags')}
            aria-label={t('ideas.mindmap.semanticsTags', 'Semantics and tags')}
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
            title={t('ideas.mindmap.lineStyle', 'Line style')}
            aria-label={t('ideas.mindmap.lineStyle', 'Line style')}
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
                onArrowSelect={(direction) => {
                  // Hurtowo na całą gałąź. Obsługa (BFS w dół + zapis pola
                  // `arrowDirection`) siedzi w `useMindMapQuickActions`, tam
                  // gdzie reszta akcji `mm_*` — pasek nie zna grafu.
                  window.dispatchEvent(
                    new CustomEvent('idea-workspace-quick-action', {
                      detail: { action: 'mm_edge_arrow', nodeId, direction },
                    })
                  );
                  closeDD();
                }}
                onClose={closeDD}
              />
            </div>
          )}
        </div>

        {/* 3. Auto-layout toggle */}
        <button
          onClick={() => onUpdate({ autoLayout: !style.autoLayout })}
          title={t('ideas.mindmap.autoLayoutBranch', 'Auto-layout branch')}
          aria-label={t('ideas.mindmap.autoLayoutBranch', 'Auto-layout branch')}
          className={btnClass(!!style.autoLayout)}
        >
          <ToggleRight size={13} />
        </button>

        {/* 4. Color */}
        <div className="relative">
          <button
            onClick={() => toggle('color')}
            title={t('ideas.mindmap.color', 'Color')}
            aria-label={t('ideas.mindmap.color', 'Color')}
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
            title={t('ideas.mindmap.fontSize', 'Font size')}
            aria-label={t('ideas.mindmap.fontSize', 'Font size')}
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
          title={t('ideas.mindmap.bold', 'Bold')}
          aria-label={t('ideas.mindmap.bold', 'Bold')}
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
              title={t('ideas.mindmap.linkedArtifacts', 'Linked artifacts')}
              aria-label={t('ideas.mindmap.linkedArtifacts', 'Linked artifacts')}
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
              title={t('ideas.mindmap.quickTask', 'Quick task')}
              aria-label={t('ideas.mindmap.quickTask', 'Quick task')}
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
              title={t('ideas.mindmap.convertBranch', 'Convert branch to...')}
              aria-label={t('ideas.mindmap.convertBranch', 'Convert branch to...')}
              className={btnClass(openDropdown === 'convertBranch')}
            >
              <GitPullRequest size={13} />
            </button>
            {openDropdown === 'convertBranch' && (
              <div className="absolute top-full right-0 mt-1 z-dropdown min-w-[180px] py-1.5 px-1 rounded-hig-xl bg-c-surface-raised dark:bg-c-surface backdrop-blur-xl border border-c-border-subtle dark:border-c-border-subtle shadow-hig-xl animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 pt-1 pb-1 text-[9px] font-semibold uppercase tracking-wider text-c-text-secondary dark:text-c-text-secondary">
                  {t('ideas.mindmap.convertBranch', 'Convert branch to...')}
                </div>
                {(
                  [
                    {
                      id: 'ctx_subtree_convert_decision',
                      label: t('ideas.mindmap.decision', 'Decision'),
                      icon: Star,
                    },
                    {
                      id: 'ctx_subtree_convert_tasks',
                      label: t('ideas.mindmap.tasks', 'Tasks'),
                      icon: ListChecks,
                    },
                    {
                      id: 'ctx_subtree_convert_task_set',
                      label: t('ideas.mindmap.taskSet', 'Task set'),
                      icon: ListChecks,
                    },
                    {
                      id: 'ctx_subtree_convert_initiative',
                      label: t('ideas.mindmap.initiative', 'Initiative'),
                      icon: Rocket,
                    },
                    {
                      id: 'ctx_subtree_convert_process_flow',
                      label: t('ideas.mindmap.processFlow', 'Process Flow'),
                      icon: Waypoints,
                    },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      // N5 trzecia fala (2026-08-09): route through the action
                      // registry (same wrapping `NodeContextMenu.tsx` already
                      // does for every migrated item) instead of calling
                      // `onAction(item.id)` bare. `ctx.params.run` = the exact
                      // previous click path (`onAction(item.id)` →
                      // `IdeaRecommendationMap.tsx`'s `onAction` prop for this
                      // toolbar → local `SUBTREE_MAP` → `convertBranch()`) —
                      // byte-identical human click behaviour, registry layers
                      // the Teresa/bus path on top (see `runMindmapNodeConvertAction`).
                      const registryId = CONVERT_BRANCH_REGISTRY_ID_BY_LOCAL_ID[item.id];
                      if (registryId && !getAction(registryId)) {
                        throw new Error(
                          `FloatingNodeToolbar: brak wpisu rejestru dla pozycji „Convert branch" '${item.id}' (oczekiwano '${registryId}')`
                        );
                      }
                      if (registryId) {
                        const ctx: ActionContext = {
                          ideaId: '',
                          tool: 'mindmap',
                          selection: EMPTY_SELECTION,
                          surface: 'floating',
                          source: 'ui',
                          language: isPl ? 'pl' : 'en',
                          params: { run: () => onAction(item.id) },
                        };
                        void runIdeaAction(registryId, ctx);
                      } else {
                        onAction(item.id);
                      }
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
          title={
            style.locked ? t('ideas.mindmap.unlock', 'Unlock') : t('ideas.mindmap.lock', 'Lock')
          }
          aria-label={
            style.locked ? t('ideas.mindmap.unlock', 'Unlock') : t('ideas.mindmap.lock', 'Lock')
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
              title={t('ideas.mindmap.quickNotes', 'Quick notes')}
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
              title={t('ideas.mindmap.quickTags', 'Quick tags')}
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
              title={t('ideas.mindmap.quickLink', 'Quick link')}
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
            title={t('ideas.mindmap.moreOptions', 'More options')}
            aria-label={t('ideas.mindmap.moreOptions', 'More options')}
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
