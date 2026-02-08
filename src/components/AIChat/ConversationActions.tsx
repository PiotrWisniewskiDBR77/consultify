/**
 * ConversationActions
 *
 * Dropdown menu for conversation actions: rename, star, archive, delete.
 */

import {
  Archive,
  ArchiveRestore,
  Copy,
  Download,
  Edit2,
  Folder,
  FolderPlus,
  MoreHorizontal,
  Star,
  StarOff,
  Trash2,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Conversation, useConversationStore } from '../../store/useConversationStore';
import { MoveToProjectModal } from './MoveToProjectModal';

interface ConversationActionsProps {
  conversation: Conversation;
  onOpenChange?: (open: boolean) => void;
}

export const ConversationActions: React.FC<ConversationActionsProps> = ({
  conversation,
  onOpenChange,
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(conversation.title);
  const [showMoveToProject, setShowMoveToProject] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    starConversation,
    unstarConversation,
    archiveConversation,
    unarchiveConversation,
    deleteConversation,
    renameConversation,
  } = useConversationStore();

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        onOpenChange?.(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onOpenChange]);

  // Focus input when renaming
  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  const toggleMenu = () => {
    const newState = !isOpen;
    setIsOpen(newState);
    onOpenChange?.(newState);
  };

  const handleAction = async (action: () => Promise<void>) => {
    setIsOpen(false);
    onOpenChange?.(false);
    await action();
  };

  const handleRename = async () => {
    if (renameValue.trim() && renameValue !== conversation.title) {
      await renameConversation(conversation.id, renameValue.trim());
    }
    setIsRenaming(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRename();
    } else if (e.key === 'Escape') {
      setRenameValue(conversation.title);
      setIsRenaming(false);
    }
  };

  // Rename mode
  if (isRenaming) {
    return (
      <div className="flex items-center gap-1" ref={menuRef}>
        <input
          ref={inputRef}
          type="text"
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleRename}
          className="
                        px-2 py-1 text-sm
                        bg-white dark:bg-navy-800
                        border border-primary-500
                        rounded
                        text-navy-900 dark:text-white
                        focus:outline-none focus:ring-2 focus:ring-primary-500/50
                        w-40
                    "
        />
      </div>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      {/* Trigger Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          toggleMenu();
        }}
        className="
                    p-1.5 rounded-md
                    text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300
                    hover:bg-slate-200 dark:hover:bg-navy-700
                    transition-colors
                "
      >
        <MoreHorizontal size={16} className="pointer-events-none" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="
                    absolute right-0 top-full mt-1 z-50
                    w-48 py-1
                    bg-white dark:bg-navy-800
                    border border-slate-200 dark:border-navy-700
                    rounded-lg shadow-lg
                    animate-in fade-in-0 zoom-in-95 duration-100
                "
        >
          {/* Rename */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsRenaming(true);
              setIsOpen(false);
              onOpenChange?.(false);
            }}
            className="
                            w-full flex items-center gap-2 px-3 py-2 text-sm
                            text-slate-700 dark:text-slate-300
                            hover:bg-slate-100 dark:hover:bg-navy-700
                            transition-colors
                        "
          >
            <Edit2 size={14} />
            {t('aiChat.actions.rename', 'Rename')}
          </button>

          {/* Star/Unstar */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleAction(
                conversation.starred
                  ? () => unstarConversation(conversation.id)
                  : () => starConversation(conversation.id)
              );
            }}
            className="
                            w-full flex items-center gap-2 px-3 py-2 text-sm
                            text-slate-700 dark:text-slate-300
                            hover:bg-slate-100 dark:hover:bg-navy-700
                            transition-colors
                        "
          >
            {conversation.starred ? (
              <>
                <StarOff size={14} />
                {t('aiChat.actions.unstar', 'Unpin')}
              </>
            ) : (
              <>
                <Star size={14} />
                {t('aiChat.actions.star', 'Pin to top')}
              </>
            )}
          </button>

          {/* Add to Project */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
              onOpenChange?.(false);
              setShowMoveToProject(true);
            }}
            className="
                            w-full flex items-center gap-2 px-3 py-2 text-sm
                            text-slate-700 dark:text-slate-300
                            hover:bg-slate-100 dark:hover:bg-navy-700
                            transition-colors
                        "
          >
            {conversation.chatProjectId ? (
              <>
                <Folder size={14} className="text-primary-500" />
                {t('aiChat.actions.moveProject', 'Zmień projekt')}
              </>
            ) : (
              <>
                <FolderPlus size={14} />
                {t('aiChat.actions.addToProject', 'Dodaj do projektu')}
              </>
            )}
          </button>

          {/* Archive/Unarchive */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleAction(
                conversation.archived
                  ? () => unarchiveConversation(conversation.id)
                  : () => archiveConversation(conversation.id)
              );
            }}
            className="
                            w-full flex items-center gap-2 px-3 py-2 text-sm
                            text-slate-700 dark:text-slate-300
                            hover:bg-slate-100 dark:hover:bg-navy-700
                            transition-colors
                        "
          >
            {conversation.archived ? (
              <>
                <ArchiveRestore size={14} />
                {t('aiChat.actions.unarchive', 'Unarchive')}
              </>
            ) : (
              <>
                <Archive size={14} />
                {t('aiChat.actions.archive', 'Archive')}
              </>
            )}
          </button>

          {/* Divider */}
          <div className="my-1 border-t border-slate-200 dark:border-navy-700" />

          {/* Delete */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (
                window.confirm(
                  t('aiChat.confirmDelete', 'Are you sure you want to delete this conversation?')
                )
              ) {
                handleAction(() => deleteConversation(conversation.id));
              }
            }}
            className="
                            w-full flex items-center gap-2 px-3 py-2 text-sm
                            text-red-600 dark:text-red-400
                            hover:bg-red-50 dark:hover:bg-red-900/20
                            transition-colors
                        "
          >
            <Trash2 size={14} />
            {t('aiChat.actions.delete', 'Delete')}
          </button>
        </div>
      )}

      {/* Move to Project Modal */}
      <MoveToProjectModal
        isOpen={showMoveToProject}
        onClose={() => setShowMoveToProject(false)}
        conversation={conversation}
      />
    </div>
  );
};

export default ConversationActions;
