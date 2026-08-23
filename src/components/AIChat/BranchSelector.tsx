/**
 * BranchSelector Component
 *
 * Allows users to view and switch between conversation branches.
 * Provides UI for creating new branches from any message.
 *
 * FLOW-CONVERSATION-BRANCHES: Branch selection and navigation
 *
 * M01-P03A (2026-08-05): the shape below matches the REAL backend contract
 * (server/src/routes/conversations.routes.ts POST/GET /:id/branch[es]),
 * backed by the `conversation_branches` table from migration
 * `672_enterprise_agent_planner.sql` — NOT the archived `282_*` migration's
 * `root_message_id`/`is_main` shape this component used to expose (that
 * migration is dead/overwritten; see docs/modules/01_czat for the canonical
 * contract). `id` on a branch IS the branch's own conversation id — select
 * it and open that conversation directly, no separate id space to resolve.
 * There is no `isMain` flag: the "main" state is represented by
 * `activeBranchId === null` (the conversation the branches were forked
 * from), which is not itself a row in `branches`.
 */

import {
  ChevronDown,
  GitBranch,
  GitFork,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  CHAT_HEADER_CONTROL_ACTIVE_CLASS,
  CHAT_HEADER_SELECTOR_CLASS,
} from './chatHeaderControlStyles';

// ==========================================
// TYPES
// ==========================================

export interface ConversationBranch {
  /** The branch's own conversation id — use to open/switch to it. */
  id: string;
  /** The source/parent conversation this branch was forked FROM. */
  conversationId: string;
  /** Ancestor branch id, if this branch was forked from another branch. */
  parentBranchId?: string | null;
  /** The message in the source conversation this branch forked from. */
  forkMessageId: string;
  name: string;
  messageCount?: number;
  createdAt: string | Date;
  createdBy?: string;
}

interface BranchSelectorProps {
  branches: ConversationBranch[];
  activeBranchId: string | null;
  onSelectBranch: (branchId: string) => void;
  onCreateBranch?: (name: string, fromMessageId?: string) => void;
  onRenameBranch?: (branchId: string, newName: string) => void;
  onDeleteBranch?: (branchId: string) => void;
  className?: string;
  disabled?: boolean;
  /** Loading state while the branch list is being fetched. */
  isLoading?: boolean;
  /** True while a create-branch request is in flight. */
  isCreating?: boolean;
  /** Non-null when the last fetch/create/rename/delete failed. */
  error?: string | null;
  /**
   * Label to show on the trigger when the active conversation IS a branch
   * (its own `branchName`) but is not itself a row inside `branches` —
   * `branches` here is always the active conversation's CHILDREN, so the
   * active conversation can never match an id in that list. Falls back to
   * `branch.main` ("Main") when omitted, i.e. the active conversation is the
   * original/root, not a branch.
   */
  currentLabel?: string | null;
}

interface BranchItemProps {
  branch: ConversationBranch;
  isActive: boolean;
  onSelect: () => void;
  onRename?: (newName: string) => void;
  onDelete?: () => void;
}

// ==========================================
// COMPONENTS
// ==========================================

/**
 * Individual branch item
 */
const BranchItem: React.FC<BranchItemProps> = ({
  branch,
  isActive,
  onSelect,
  onRename,
  onDelete,
}) => {
  const { t } = useTranslation();
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(branch.name);

  const handleRename = () => {
    if (editName.trim() && editName !== branch.name && onRename) {
      onRename(editName.trim());
    }
    setIsEditing(false);
  };

  return (
    <div
      className={`
        group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors
        ${
          isActive
            ? 'bg-slate-200/70 dark:bg-white/[0.08] text-slate-900 dark:text-white'
            : 'hover:bg-slate-100 dark:hover:bg-navy-800'
        }
      `}
      onClick={() => !isEditing && onSelect()}
      onKeyDown={(event) => {
        if (isEditing || (event.key !== 'Enter' && event.key !== ' ')) return;
        event.preventDefault();
        onSelect();
      }}
      role="button"
      tabIndex={isEditing ? -1 : 0}
      aria-current={isActive ? 'page' : undefined}
      aria-label={`${t('branch.open', 'Open branch')}: ${branch.name}`}
    >
      <GitBranch
        size={14}
        className={isActive ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400'}
      />

      {isEditing ? (
        <input
          type="text"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onBlur={handleRename}
          onKeyDown={(e) => e.key === 'Enter' && handleRename()}
          autoFocus
          className="flex-1 px-1 py-0.5 text-sm bg-white dark:bg-navy-900 border border-primary-300 rounded outline-none"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="flex-1 text-sm truncate">{branch.name}</span>
      )}

      {branch.messageCount !== undefined && (
        <span className="text-xs text-slate-400">{branch.messageCount}</span>
      )}

      {/* Actions menu — every row in `branches` is a real fork (the implicit
          "main" conversation is never a row here, see activeBranchId===null
          handling above), so no isMain guard is needed. */}
      {(onRename || onDelete) && (
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-1 opacity-0 group-hover:opacity-100 hover:bg-slate-200 dark:hover:bg-navy-700 rounded transition-all"
            aria-label={`${t('branch.actions', 'Branch actions')}: ${branch.name}`}
            aria-expanded={showMenu}
            aria-haspopup="menu"
          >
            <MoreHorizontal size={14} />
          </button>

          {showMenu && (
            <div
              role="menu"
              className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-navy-800 rounded-lg shadow-lg border border-slate-200 dark:border-navy-700 py-1 z-50"
              onClick={(e) => e.stopPropagation()}
            >
              {onRename && (
                <button
                  role="menuitem"
                  onClick={() => {
                    setIsEditing(true);
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-navy-700"
                >
                  <Pencil size={12} />
                  {t('branch.rename', 'Rename')}
                </button>
              )}
              {onDelete && (
                <button
                  role="menuitem"
                  onClick={() => {
                    onDelete();
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-900/20"
                >
                  <Trash2 size={12} />
                  {t('branch.delete', 'Delete')}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Branch selector dropdown
 */
export const BranchSelector: React.FC<BranchSelectorProps> = ({
  branches,
  activeBranchId,
  onSelectBranch,
  onCreateBranch,
  onRenameBranch,
  onDeleteBranch,
  className = '',
  disabled = false,
  isLoading = false,
  isCreating = false,
  error = null,
  currentLabel = null,
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const activeBranch = branches.find((b) => b.id === activeBranchId);

  const handleCreateBranch = useCallback(() => {
    if (newBranchName.trim() && onCreateBranch) {
      onCreateBranch(newBranchName.trim());
      // Do NOT close the form or clear the name here: `onCreateBranch` is a
      // fire-and-forget `void` callback from this component's point of view
      // (the actual async work + `isCreating` flag live in the caller).
      // Closing immediately made the "creating" state — the disabled
      // input/spinner below — structurally unreachable: the form vanished
      // the instant you clicked submit, before a single frame of loading
      // feedback ever painted (found by actually driving this in a
      // browser, not from reading the code). The effect below closes the
      // form once `isCreating` flips back to false (success OR failure).
    }
  }, [newBranchName, onCreateBranch]);

  // Reset the create form once an in-flight create settles (either way).
  const wasCreatingRef = useRef(false);
  useEffect(() => {
    if (wasCreatingRef.current && !isCreating) {
      // Preserve the attempted name and form on failure so the user can retry
      // without reconstructing input. Success is the only path that clears it.
      if (!error) {
        setShowCreateForm(false);
        setNewBranchName('');
      }
    }
    wasCreatingRef.current = isCreating;
  }, [error, isCreating]);

  useEffect(() => {
    if (!isOpen) return undefined;
    dialogRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsOpen(false);
        requestAnimationFrame(() => triggerRef.current?.focus());
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // `branches` no longer includes an implicit "main" row (see the
  // ConversationBranch doc-comment above) — hide the selector only when
  // there are truly zero branches AND no way to create one.
  if (branches.length === 0 && !onCreateBranch && !isLoading) {
    return null;
  }

  return (
    <div className={`relative ${className}`}>
      {/* Trigger button */}
      <button
        ref={triggerRef}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        data-testid="branch-selector-trigger"
        className={`${CHAT_HEADER_SELECTOR_CLASS} ${isOpen ? CHAT_HEADER_CONTROL_ACTIVE_CLASS : ''}`}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-controls="chat-branch-selector-menu"
        aria-label={t('branch.currentBranch', 'Current branch: {{name}}', {
          name: activeBranch?.name || currentLabel || t('branch.main', 'Main'),
        })}
        title={activeBranch?.name || currentLabel || t('branch.main', 'Main')}
      >
        <GitBranch size={14} className="text-slate-500" />
        <span className="max-w-[120px] truncate">
          {activeBranch?.name || currentLabel || t('branch.main', 'Main')}
        </span>
        {isLoading ? (
          <span
            className="h-3 w-3 rounded-full border-2 border-slate-300 border-t-slate-500 animate-spin"
            data-testid="branch-selector-loading"
          />
        ) : (
          branches.length > 0 && <span className="text-xs text-slate-400">({branches.length})</span>
        )}
        <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              setIsOpen(false);
              requestAnimationFrame(() => triggerRef.current?.focus());
            }}
          />

          {/* Menu */}
          <div
            ref={dialogRef}
            id="chat-branch-selector-menu"
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            aria-label={t('branch.title', 'Conversation Branches')}
            className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-navy-800 rounded-xl shadow-xl border border-slate-200 dark:border-navy-700 py-2 z-50"
          >
            {/* Header */}
            <div className="px-3 pb-2 mb-2 border-b border-slate-100 dark:border-navy-700">
              <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                {t('branch.title', 'Conversation Branches')}
              </h4>
            </div>

            {error && (
              <div
                className="mx-2 mb-2 px-2 py-1.5 text-xs rounded-lg bg-danger-50 dark:bg-danger-900/20 text-danger-600 dark:text-danger-400"
                data-testid="branch-selector-error"
                role="alert"
              >
                {error}
              </div>
            )}

            {isLoading && branches.length === 0 ? (
              <div
                className="px-3 py-4 text-xs text-slate-400 text-center"
                data-testid="branch-selector-loading-list"
              >
                {t('branch.loading', 'Loading branches…')}
              </div>
            ) : !isLoading && branches.length === 0 && !error ? (
              <div
                className="px-3 py-4 text-xs text-slate-400 text-center"
                data-testid="branch-selector-empty"
              >
                {t('branch.empty', 'No branches yet.')}
              </div>
            ) : null}

            {/* Branch list */}
            <div className="max-h-48 overflow-y-auto px-1">
              {branches.map((branch) => (
                <BranchItem
                  key={branch.id}
                  branch={branch}
                  isActive={branch.id === activeBranchId}
                  onSelect={() => {
                    onSelectBranch(branch.id);
                    setIsOpen(false);
                  }}
                  onRename={onRenameBranch ? (name) => onRenameBranch(branch.id, name) : undefined}
                  onDelete={onDeleteBranch ? () => onDeleteBranch(branch.id) : undefined}
                />
              ))}
            </div>

            {/* Create new branch */}
            {onCreateBranch && (
              <div className="mt-2 pt-2 border-t border-slate-100 dark:border-navy-700 px-2">
                {showCreateForm ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newBranchName}
                      onChange={(e) => setNewBranchName(e.target.value)}
                      placeholder={t('branch.namePlaceholder', 'Branch name...')}
                      autoFocus
                      disabled={isCreating}
                      className="flex-1 px-2 py-1.5 text-sm bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg outline-none focus:border-blue-400 disabled:opacity-50"
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateBranch()}
                    />
                    <button
                      type="button"
                      onClick={handleCreateBranch}
                      disabled={!newBranchName.trim() || isCreating}
                      data-testid="branch-selector-submit-create"
                      aria-label={t('branch.createSubmit', 'Create branch')}
                      className="p-1.5 bg-c-text text-c-bg rounded-lg hover:bg-c-text-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isCreating ? (
                        <span className="block h-3.5 w-3.5 rounded-full border-2 border-c-bg/40 border-t-c-bg animate-spin" />
                      ) : (
                        <Plus size={14} />
                      )}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(true)}
                    data-testid="branch-selector-open-create"
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-700 rounded-lg transition-colors"
                  >
                    <GitFork size={14} />
                    {t('branch.create', 'Create new branch')}
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

/**
 * Inline branch indicator (shown on messages)
 */
export const BranchIndicator: React.FC<{
  branchCount: number;
  onClick?: () => void;
}> = ({ branchCount, onClick }) => {
  const { t } = useTranslation();

  if (branchCount <= 0) return null;

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 px-2 py-0.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 rounded transition-colors"
      title={t('branch.fromHere', '{{count}} branches from here', { count: branchCount })}
    >
      <GitBranch size={12} />
      <span>{branchCount}</span>
    </button>
  );
};

export default BranchSelector;
