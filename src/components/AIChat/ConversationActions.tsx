/**
 * ConversationActions
 *
 * Dropdown menu for conversation actions: rename, star, archive, delete.
 */

import {
  Archive,
  ArchiveRestore,
  Download,
  Edit2,
  Folder,
  FolderPlus,
  Link2,
  MoreHorizontal,
  Star,
  StarOff,
  Trash2,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { Conversation, useConversationStore } from '../../store/useConversationStore';
import { MoveToProjectModal } from './MoveToProjectModal';

interface ConversationActionsProps {
  conversation: Conversation;
  onOpenChange?: (open: boolean) => void;
  onRenameStart?: () => void;
}

export const ConversationActions: React.FC<ConversationActionsProps> = ({
  conversation,
  onOpenChange,
  onRenameStart,
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
    exportConversation,
    purgeConversation,
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
                        border border-c-border
                        rounded
                        text-navy-900 dark:text-white
                        focus:outline-none focus:ring-2 focus:ring-blue-500/50
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
                    text-slate-600 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300
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
              setIsOpen(false);
              onOpenChange?.(false);
              if (onRenameStart) {
                onRenameStart();
              } else {
                setIsRenaming(true);
              }
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
                <Folder size={14} className="text-c-text-secondary" />
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

          {/* Share link (F4) */}
          <button
            onClick={async (e) => {
              e.stopPropagation();
              setIsOpen(false);
              onOpenChange?.(false);
              const tid = toast.loading(t('aiChat.share.creating', 'Creating share link…'));
              try {
                const res: any = await Api.shareConversation(conversation.id);
                const token = res?.shareToken || res?.share_token;
                const url = token
                  ? `${window.location.origin}/share/${token}`
                  : res?.shareUrl || '';
                if (url) {
                  try {
                    await navigator.clipboard.writeText(url);
                    toast.success(t('aiChat.share.copied', 'Share link copied to clipboard'), {
                      id: tid,
                    });
                  } catch {
                    toast.success(url, { id: tid, duration: 6000 });
                  }
                } else {
                  toast.error(t('aiChat.share.failed', 'Could not create link'), { id: tid });
                }
              } catch (err: any) {
                toast.error(err?.message || t('aiChat.share.failed', 'Could not create link'), {
                  id: tid,
                });
              }
            }}
            className="
                            w-full flex items-center gap-2 px-3 py-2 text-sm
                            text-slate-700 dark:text-slate-300
                            hover:bg-slate-100 dark:hover:bg-navy-700
                            transition-colors
                        "
          >
            <Link2 size={14} />
            {t('aiChat.actions.shareLink', 'Share link')}
          </button>

          {/* Export conversation (§2.3.5 E10) */}
          <button
            onClick={async (e) => {
              e.stopPropagation();
              setIsOpen(false);
              onOpenChange?.(false);
              try {
                const result = await exportConversation(conversation.id, { format: 'markdown' });
                if (typeof result === 'string') {
                  const blob = new Blob([result], { type: 'text/markdown' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${conversation.title || 'conversation'}.md`;
                  a.click();
                  URL.revokeObjectURL(url);
                }
              } catch (err: any) {
                if (err?.response?.data?.code === 'EXPORT_TOO_LARGE') {
                  window.alert(
                    t(
                      'aiChat.exportTooLarge',
                      'This conversation is too large for full export. Please use date filters.'
                    )
                  );
                }
              }
            }}
            className="
                            w-full flex items-center gap-2 px-3 py-2 text-sm
                            text-slate-700 dark:text-slate-300
                            hover:bg-slate-100 dark:hover:bg-navy-700
                            transition-colors
                        "
          >
            <Download size={14} />
            {t('aiChat.actions.export', 'Export')}
          </button>

          {/* Divider */}
          <div className="my-1 border-t border-slate-200 dark:border-navy-700" />

          {/* Delete (destructive — requires explicit confirmation) */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              const title = conversation.title || 'this conversation';
              const msg = t(
                'aiChat.confirmDeleteDestructive',
                `Delete "${title}"?\n\nThis action is destructive. The conversation will be moved to trash and permanently removed after 30 days. This cannot be undone.`
              );
              if (window.confirm(msg)) {
                handleAction(() => deleteConversation(conversation.id));
              }
            }}
            className="
                            w-full flex items-center gap-2 px-3 py-2 text-sm
                            text-danger-600 dark:text-danger-400
                            hover:bg-danger-50 dark:hover:bg-danger-900/20
                            transition-colors
                        "
          >
            <Trash2 size={14} />
            {t('aiChat.actions.delete', 'Delete')}
          </button>

          {/* Purge / Delete My Data (§2.3.3 — self-service permanent removal) */}
          {conversation.deletedAt && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                const msg = t(
                  'aiChat.confirmPurge',
                  `Permanently delete "${conversation.title || 'this conversation'}"?\n\nAll messages and attachments will be irreversibly removed. An audit record will be kept. This CANNOT be undone.`
                );
                if (window.confirm(msg)) {
                  handleAction(() => purgeConversation(conversation.id));
                }
              }}
              className="
                              w-full flex items-center gap-2 px-3 py-2 text-sm
                              text-danger-700 dark:text-danger-300 font-medium
                              hover:bg-danger-100 dark:hover:bg-danger-900/30
                              transition-colors
                          "
            >
              <Trash2 size={14} />
              {t('aiChat.actions.purge', 'Permanently Delete')}
            </button>
          )}
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
