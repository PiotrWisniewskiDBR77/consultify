import { CheckSquare, ClipboardCheck, Map, MessageSquare, Rocket, Scale, Star } from 'lucide-react';
import React, { useMemo } from 'react';

import { Conversation, getConversationEntityType } from '../../store/useConversationStore';
import { ConversationActions } from './ConversationActions';

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

const TAG_COLORS: Record<string, string> = {
  assessment: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
  initiative: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400',
  roadmap: 'bg-violet-50 text-violet-600 dark:bg-violet-900/20 dark:text-violet-400',
  task: 'bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400',
  decision: 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400',
};

export const ConversationItem: React.FC<ConversationItemProps> = ({
  conversation,
  isActive,
  onSelect,
  compact = false,
}) => {
  const entityType = useMemo(() => getConversationEntityType(conversation), [conversation]);

  const config = entityType ? ENTITY_CONFIG[entityType] : null;
  const IconComponent = config?.icon || MessageSquare;
  const iconColor = isActive
    ? config?.activeColor || 'text-primary-500'
    : config?.color || 'text-slate-400 group-hover:text-slate-500 dark:text-slate-400';

  return (
    <div
      onClick={() => onSelect(conversation.id)}
      className={`
        group relative flex flex-col gap-1 ${compact ? 'p-2' : 'p-3'} rounded-xl cursor-pointer transition-all
        ${
          isActive
            ? 'bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-900/30'
            : 'hover:bg-slate-50 dark:hover:bg-navy-800 border border-transparent'
        }
      `}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <IconComponent size={compact ? 14 : 16} className={`shrink-0 ${iconColor}`} />
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

      {/* Entity tag badge */}
      {entityType && !compact && (
        <div className="ml-6">
          <span
            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${TAG_COLORS[entityType] || ''}`}
          >
            {config?.label}
          </span>
        </div>
      )}

      {conversation.lastMessagePreview && !compact && (
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
