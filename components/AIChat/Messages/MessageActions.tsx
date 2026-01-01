/**
 * MessageActions - Hover actions for chat messages
 * User messages: Edit, Delete
 * AI messages: Regenerate, Copy, Feedback, View Artifacts
 */

import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Copy,
  Check,
  RefreshCw,
  Pencil,
  Trash2,
  ThumbsUp,
  ThumbsDown,
  MoreHorizontal,
  FileCode,
  Share,
  Bookmark,
  Volume2
} from 'lucide-react';
import { ChatMessage, MessageFeedback } from '../../../types';

interface MessageActionsProps {
  message: ChatMessage;
  onEdit?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
  onRegenerate?: (messageId: string) => void;
  onCopy?: (content: string) => void;
  onFeedback?: (messageId: string, feedback: MessageFeedback) => void;
  onViewArtifacts?: (messageId: string) => void;
  onSpeak?: (content: string) => void;
  className?: string;
}

export const MessageActions: React.FC<MessageActionsProps> = ({
  message,
  onEdit,
  onDelete,
  onRegenerate,
  onCopy,
  onFeedback,
  onViewArtifacts,
  onSpeak,
  className = ''
}) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [showMore, setShowMore] = useState(false);

  const isUserMessage = message.role === 'user';
  const isAIMessage = message.role === 'ai';
  const hasArtifacts = message.artifacts && message.artifacts.length > 0;
  const hasFeedback = message.feedback !== undefined;

  const handleCopy = useCallback(async () => {
    if (!onCopy) {
      try {
        await navigator.clipboard.writeText(message.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    } else {
      onCopy(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [message.content, onCopy]);

  const handleFeedback = useCallback((rating: 'positive' | 'negative') => {
    if (onFeedback) {
      onFeedback(message.id, {
        rating,
        timestamp: new Date()
      });
    }
  }, [message.id, onFeedback]);

  return (
    <div className={`flex items-center gap-0.5 ${className}`}>
      {/* User Message Actions */}
      {isUserMessage && (
        <>
          {message.canEdit && onEdit && (
            <ActionButton
              icon={<Pencil size={14} />}
              label={t('chat.actions.edit', 'Edit')}
              onClick={() => onEdit(message.id)}
            />
          )}
          {onDelete && (
            <ActionButton
              icon={<Trash2 size={14} />}
              label={t('chat.actions.delete', 'Delete')}
              onClick={() => onDelete(message.id)}
              variant="danger"
            />
          )}
        </>
      )}

      {/* AI Message Actions */}
      {isAIMessage && (
        <>
          {/* Copy */}
          <ActionButton
            icon={copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
            label={copied ? t('chat.actions.copied', 'Copied!') : t('chat.actions.copy', 'Copy')}
            onClick={handleCopy}
          />

          {/* Regenerate */}
          {onRegenerate && (
            <ActionButton
              icon={<RefreshCw size={14} />}
              label={t('chat.actions.regenerate', 'Regenerate')}
              onClick={() => onRegenerate(message.id)}
            />
          )}

          {/* Feedback */}
          {onFeedback && !hasFeedback && (
            <>
              <ActionButton
                icon={<ThumbsUp size={14} />}
                label={t('chat.actions.helpful', 'Helpful')}
                onClick={() => handleFeedback('positive')}
              />
              <ActionButton
                icon={<ThumbsDown size={14} />}
                label={t('chat.actions.notHelpful', 'Not helpful')}
                onClick={() => handleFeedback('negative')}
              />
            </>
          )}

          {/* Feedback indicator if already given */}
          {hasFeedback && (
            <span className={`px-1.5 py-0.5 rounded text-xs ${
              message.feedback?.rating === 'positive' 
                ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' 
                : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
            }`}>
              {message.feedback?.rating === 'positive' ? '👍' : '👎'}
            </span>
          )}

          {/* View Artifacts */}
          {hasArtifacts && onViewArtifacts && (
            <ActionButton
              icon={<FileCode size={14} />}
              label={t('chat.actions.viewArtifacts', 'View Artifacts')}
              onClick={() => onViewArtifacts(message.id)}
              highlight
            />
          )}

          {/* Speak */}
          {onSpeak && (
            <ActionButton
              icon={<Volume2 size={14} />}
              label={t('chat.actions.speak', 'Speak')}
              onClick={() => onSpeak(message.content)}
            />
          )}

          {/* More menu */}
          <div className="relative">
            <ActionButton
              icon={<MoreHorizontal size={14} />}
              label={t('chat.actions.more', 'More')}
              onClick={() => setShowMore(!showMore)}
            />
            
            {showMore && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowMore(false)} 
                />
                <div className="absolute right-0 top-full mt-1 py-1 bg-white dark:bg-navy-800 rounded-lg shadow-lg border border-slate-200 dark:border-navy-700 z-20 min-w-[160px]">
                  <DropdownItem
                    icon={<Share size={14} />}
                    label={t('chat.actions.share', 'Share')}
                    onClick={() => {
                      // Share functionality
                      setShowMore(false);
                    }}
                  />
                  <DropdownItem
                    icon={<Bookmark size={14} />}
                    label={t('chat.actions.bookmark', 'Bookmark')}
                    onClick={() => {
                      // Bookmark functionality
                      setShowMore(false);
                    }}
                  />
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};

// ==================== Sub-components ====================

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  variant?: 'default' | 'danger';
  highlight?: boolean;
}

const ActionButton: React.FC<ActionButtonProps> = ({
  icon,
  label,
  onClick,
  variant = 'default',
  highlight = false
}) => {
  const baseClasses = 'p-1.5 rounded-md transition-colors';
  const variantClasses = {
    default: highlight 
      ? 'text-brand hover:bg-brand/10 dark:text-brand-light dark:hover:bg-brand/20'
      : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-700',
    danger: 'text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
  };

  return (
    <button
      onClick={onClick}
      className={`${baseClasses} ${variantClasses[variant]}`}
      title={label}
    >
      {icon}
    </button>
  );
};

interface DropdownItemProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}

const DropdownItem: React.FC<DropdownItemProps> = ({ icon, label, onClick }) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
  >
    {icon}
    {label}
  </button>
);

export default MessageActions;


