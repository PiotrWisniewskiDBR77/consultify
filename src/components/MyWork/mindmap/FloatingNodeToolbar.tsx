import {
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
        ? 'bg-slate-200/70 dark:bg-navy-800 text-slate-900 dark:text-slate-100'
        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-white/[0.04]'
    }`;

  return (
    <div
      ref={ref}
      className="floating-node-toolbar absolute z-[80] pointer-events-auto"
      style={{
        left: position.x,
        top: position.y - 48,
        transform: 'translateX(-50%)',
      }}
    >
      <div className="flex items-center gap-0.5 rounded-hig-2xl bg-white/95 dark:bg-navy-900/95 backdrop-blur-sm border border-slate-200/60 dark:border-navy-700/60 shadow-hig-xl px-1 py-0.5">
        {/* 0a. Add child — primary growth affordance */}
        <button
          onClick={onAddChild}
          disabled={disabled}
          title={isPl ? 'Dodaj gałąź (Tab)' : 'Add child (Tab)'}
          aria-label={isPl ? 'Dodaj gałąź (Tab)' : 'Add child (Tab)'}
          className={`flex h-9 items-center gap-1 px-1.5 rounded-hig-lg transition-all duration-150 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 ${disabled ? 'opacity-40 pointer-events-none' : ''}`}
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
            className={`flex h-9 items-center gap-1 px-1.5 rounded-hig-lg transition-all duration-150 text-slate-500 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-white/[0.04] ${disabled ? 'opacity-40 pointer-events-none' : ''}`}
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

        <div className="w-px h-4 bg-slate-200/50 dark:bg-white/[0.06] mx-0.5" />

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
            <div className="absolute top-full left-0 mt-1 z-[100]">
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
            <div className="absolute top-full left-0 mt-1 z-[100]">
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
            <div className="absolute top-full left-0 mt-1 z-[100]">
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
              className="w-3.5 h-3.5 rounded-full border border-slate-300 dark:border-white/20"
              style={{ backgroundColor: style.color || 'var(--color-primary-500, #A51C30)' }}
            />
          </button>
          {openDropdown === 'color' && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-[100]">
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
            <div className="absolute top-full left-0 mt-1 z-[100]">
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

        <div className="w-px h-4 bg-slate-200/50 dark:bg-white/[0.06] mx-0.5" />

        {/* 7. Link / Artifact */}
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
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-[100]">
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

        {/* 8. Quick Task */}
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
            <div className="absolute top-full left-0 mt-1 z-[100]">
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

        {/* 8b. Convert branch */}
        {hasChildren && !isProtected && (
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
              <div className="absolute top-full right-0 mt-1 z-[100] min-w-[180px] py-1.5 px-1 rounded-hig-xl bg-white/95 dark:bg-navy-900/95 backdrop-blur-xl border border-slate-200/60 dark:border-navy-700/60 shadow-hig-xl animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 pt-1 pb-1 text-[9px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-500">
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
                    className="w-full flex items-center gap-2 px-3 py-[6px] text-left text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100/60 dark:hover:bg-white/[0.04] rounded-hig-md transition-colors"
                  >
                    <item.icon size={13} className="shrink-0 text-slate-600 dark:text-slate-500" />
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
            <div className="absolute top-full left-0 mt-1 z-[100]">
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

        {/* 9b. Quick Tags */}
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
            <div className="absolute top-full left-0 mt-1 z-[100]">
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

        {/* 9c. Quick Link */}
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
            <div className="absolute top-full left-0 mt-1 z-[100]">
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

        <div className="w-px h-4 bg-slate-200/50 dark:bg-white/[0.06] mx-0.5" />

        {/* 10. AI */}
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
            <div className="absolute top-full right-0 mt-1 z-[100]">
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

        {/* 10. More (opens context menu) */}
        <button
          onClick={(e) => onOpenContextMenu({ x: e.clientX, y: e.clientY })}
          title={isPl ? 'Więcej opcji' : 'More options'}
          aria-label={isPl ? 'Więcej opcji' : 'More options'}
          className={btnClass(false)}
        >
          <MoreVertical size={13} />
        </button>
      </div>
    </div>
  );
};

export default FloatingNodeToolbar;
