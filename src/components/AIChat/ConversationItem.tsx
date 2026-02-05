import { MessageSquare, Star } from 'lucide-react';
import React from 'react';

import { Conversation } from '../../store/useConversationStore';
import { ConversationActions } from './ConversationActions';

interface ConversationItemProps {
  conversation: Conversation;
  isActive?: boolean;
  onSelect: (id: string) => void;
}

export const ConversationItem: React.FC<ConversationItemProps> = ({
  conversation,
  isActive,
  onSelect,
}) => {
  return (
    <div
      onClick={() => onSelect(conversation.id)}
      className={`
                group relative flex flex-col gap-1 p-3 rounded-xl cursor-pointer transition-all
                ${
                  isActive
                    ? 'bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-900/30'
                    : 'hover:bg-slate-50 dark:hover:bg-navy-800 border border-transparent'
                }
            `}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <MessageSquare
            size={16}
            className={
              isActive
                ? 'text-primary-500'
                : 'text-slate-400 group-hover:text-slate-500 dark:text-slate-400'
            }
          />
          <h4
            className={`text-sm font-medium truncate ${isActive ? 'text-primary-900 dark:text-primary-100' : 'text-slate-700 dark:text-slate-300'}`}
          >
            {conversation.title || 'New Conversation'}
          </h4>
        </div>
        {conversation.starred && (
          <Star size={12} className="text-amber-400 fill-amber-400 shrink-0 mt-1" />
        )}
      </div>

      {conversation.lastMessagePreview && (
        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 ml-6">
          {conversation.lastMessagePreview}
        </p>
      )}

      <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <ConversationActions conversation={conversation} />
      </div>
    </div>
  );
};

export default ConversationItem;
