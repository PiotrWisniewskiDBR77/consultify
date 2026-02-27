import { CheckSquare, ClipboardCheck, Map, MessageSquare, Rocket, Scale, Star } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  Conversation,
  getConversationEntityType,
  useConversationStore,
} from '../../store/useConversationStore';
import { ConversationActions } from './ConversationActions';

export const CONVERSATION_DND_TYPE = 'application/x-conversation-id';

interface ConversationItemProps {
  conversation: Conversation;
  isActive?: boolean;
  onSelect: (id: string) => void;
  /** Compact mode for nested-in-folder display */
  compact?: boolean;
}

// Entity type -> icon, color, and label mappings
const ENTITY_CONFIG: Record<
  string,
  { icon: React.ElementType; color: string; activeColor: string; label: string }
> = {
  assessment: {
    icon: ClipboardCheck,
    color: 'text-blue-500',
    activeColor: 'text-blue-600',
    label: 'Assessment',
  },
  initiative: {
    icon: Rocket,
    color: 'text-emerald-500',
    activeColor: 'text-emerald-600',
    label: 'Initiative',
  },
  roadmap: {
    icon: Map,
    color: 'text-violet-500',
    activeColor: 'text-violet-600',
    label: 'Roadmap',
  },
  task: {
    icon: CheckSquare,
    color: 'text-orange-500',
    activeColor: 'text-orange-600',
    label: 'Task',
  },
  decision: {
    icon: Scale,
    color: 'text-rose-500',
    activeColor: 'text-rose-600',
    label: 'Decision',
  },
};

export const ConversationItem: React.FC<ConversationItemProps> = ({
  conversation,
  isActive,
  onSelect,
}) => {
  const entityType = useMemo(() => getConversationEntityType(conversation), [conversation]);
  const { renameConversation } = useConversationStore();

  // Inline rename state
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(conversation.title);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync rename value when conversation title changes externally (e.g. auto-title)
  useEffect(() => {
    if (!isRenaming) {
      setRenameValue(conversation.title);
    }
  }, [conversation.title, isRenaming]);

  // Focus input when entering rename mode
  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  const handleFinishRename = useCallback(async () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== conversation.title) {
      await renameConversation(conversation.id, trimmed);
    }
    setIsRenaming(false);
  }, [renameValue, conversation.title, conversation.id, renameConversation]);

  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleFinishRename();
      } else if (e.key === 'Escape') {
        setRenameValue(conversation.title);
        setIsRenaming(false);
      }
    },
    [handleFinishRename, conversation.title]
  );

  const config = entityType ? ENTITY_CONFIG[entityType] : null;
  const IconComponent = config?.icon || MessageSquare;
  const iconColor = isActive
    ? config?.activeColor || 'text-primary-500'
    : config?.color || 'text-slate-400 group-hover:text-slate-500 dark:text-slate-400';

  // Determine if this is an auto-titled "New conversation" that should show a hint
  const isDefaultTitle =
    !conversation.title ||
    conversation.title === 'New conversation' ||
    conversation.title === 'Nowa rozmowa';

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.setData(CONVERSATION_DND_TYPE, conversation.id);
      e.dataTransfer.setData('text/plain', conversation.title || 'Conversation');
      e.dataTransfer.effectAllowed = 'move';
      (e.currentTarget as HTMLElement).style.opacity = '0.4';
    },
    [conversation.id, conversation.title]
  );

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    (e.currentTarget as HTMLElement).style.opacity = '1';
  }, []);

  return (
    <div
      draggable={!isRenaming}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={() => !isRenaming && onSelect(conversation.id)}
      className={`
        group relative flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer transition-all
        ${
          isActive
            ? 'bg-primary-500/10 dark:bg-primary-500/15 text-primary-700 dark:text-primary-200'
            : 'hover:bg-slate-100/70 dark:hover:bg-navy-800/70 text-slate-600 dark:text-slate-400'
        }
      `}
    >
      <IconComponent size={14} className={`shrink-0 ${iconColor}`} />

      {isRenaming ? (
        <input
          ref={inputRef}
          type="text"
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onKeyDown={handleRenameKeyDown}
          onBlur={handleFinishRename}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 min-w-0 px-1.5 py-0.5 text-[13px] rounded bg-white dark:bg-navy-800 border border-primary-400 dark:border-primary-600 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50"
        />
      ) : (
        <span
          className={`flex-1 min-w-0 text-[13px] truncate ${
            isDefaultTitle
              ? 'text-slate-400 dark:text-slate-500 italic'
              : isActive
                ? 'text-primary-900 dark:text-primary-100 font-medium'
                : 'text-slate-700 dark:text-slate-300'
          }`}
        >
          {conversation.title || 'New Conversation'}
        </span>
      )}

      {conversation.starred && (
        <Star size={10} className="shrink-0 text-amber-400 fill-amber-400" />
      )}

      <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <ConversationActions conversation={conversation} />
      </div>
    </div>
  );
};

export default ConversationItem;
