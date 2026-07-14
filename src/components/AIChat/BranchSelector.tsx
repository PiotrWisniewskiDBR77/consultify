/**
 * BranchSelector Component
 *
 * Allows users to view and switch between conversation branches.
 * Provides UI for creating new branches from any message.
 *
 * FLOW-CONVERSATION-BRANCHES: Branch selection and navigation
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
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

// ==========================================
// TYPES
// ==========================================

export interface ConversationBranch {
  id: string;
  conversationId: string;
  rootMessageId: string;
  name: string;
  description?: string;
  isMain: boolean;
  messageCount?: number;
  createdAt: Date;
  updatedAt: Date;
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
        <span className="flex-1 text-sm truncate">
          {branch.name}
          {branch.isMain && <span className="ml-1 text-xs text-slate-400">(main)</span>}
        </span>
      )}

      {branch.messageCount !== undefined && (
        <span className="text-xs text-slate-400">{branch.messageCount}</span>
      )}

      {/* Actions menu */}
      {(onRename || onDelete) && !branch.isMain && (
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-1 opacity-0 group-hover:opacity-100 hover:bg-slate-200 dark:hover:bg-navy-700 rounded transition-all"
          >
            <MoreHorizontal size={14} />
          </button>

          {showMenu && (
            <div
              className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-navy-800 rounded-lg shadow-lg border border-slate-200 dark:border-navy-700 py-1 z-50"
              onClick={(e) => e.stopPropagation()}
            >
              {onRename && (
                <button
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
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');

  const activeBranch = branches.find((b) => b.id === activeBranchId);

  const handleCreateBranch = useCallback(() => {
    if (newBranchName.trim() && onCreateBranch) {
      onCreateBranch(newBranchName.trim());
      setNewBranchName('');
      setShowCreateForm(false);
    }
  }, [newBranchName, onCreateBranch]);

  // Don't show selector if only main branch
  if (branches.length <= 1 && !onCreateBranch) {
    return null;
  }

  return (
    <div className={`relative ${className}`}>
      {/* Trigger button */}
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm
          bg-slate-100 dark:bg-navy-800 hover:bg-slate-200 dark:hover:bg-navy-700
          border border-slate-200 dark:border-navy-700 transition-colors
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <GitBranch size={14} className="text-slate-500" />
        <span className="max-w-[120px] truncate">
          {activeBranch?.name || t('branch.main', 'Main')}
        </span>
        {branches.length > 1 && <span className="text-xs text-slate-400">({branches.length})</span>}
        <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          {/* Menu */}
          <div className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-navy-800 rounded-xl shadow-xl border border-slate-200 dark:border-navy-700 py-2 z-50">
            {/* Header */}
            <div className="px-3 pb-2 mb-2 border-b border-slate-100 dark:border-navy-700">
              <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                {t('branch.title', 'Conversation Branches')}
              </h4>
            </div>

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
                      className="flex-1 px-2 py-1.5 text-sm bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-lg outline-none focus:border-blue-400"
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateBranch()}
                    />
                    <button
                      onClick={handleCreateBranch}
                      disabled={!newBranchName.trim()}
                      className="p-1.5 bg-c-text text-c-bg rounded-lg hover:bg-c-text-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowCreateForm(true)}
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
