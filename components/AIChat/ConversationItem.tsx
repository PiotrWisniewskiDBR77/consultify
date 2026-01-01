/**
 * ConversationItem
 * 
 * Single conversation row with hover actions.
 */

import React, { useState } from 'react';
import { MessageSquare, MoreHorizontal, Star, Trash2, Archive, Edit2 } from 'lucide-react';
import { Conversation } from '../../store/useConversationStore';
import { ConversationActions } from './ConversationActions';

interface ConversationItemProps {
    conversation: Conversation;
    isActive: boolean;
    onSelect: () => void;
}

export const ConversationItem: React.FC<ConversationItemProps> = ({
    conversation,
    isActive,
    onSelect
}) => {
    const [showActions, setShowActions] = useState(false);
    const [actionsOpen, setActionsOpen] = useState(false);

    // Format relative time
    const getRelativeTime = (date?: Date) => {
        if (!date) return '';
        const now = new Date();
        const diff = now.getTime() - new Date(date).getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (minutes < 1) return 'just now';
        if (minutes < 60) return `${minutes}m`;
        if (hours < 24) return `${hours}h`;
        if (days < 7) return `${days}d`;
        return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    };

    // Get icon based on tags
    const getConversationIcon = () => {
        if (conversation.tags.includes('assessment')) {
            return <span className="text-blue-500">📊</span>;
        }
        if (conversation.tags.includes('initiative')) {
            return <span className="text-green-500">💡</span>;
        }
        if (conversation.tags.includes('roadmap')) {
            return <span className="text-purple-500">🗺️</span>;
        }
        if (conversation.tags.includes('report')) {
            return <span className="text-orange-500">📝</span>;
        }
        return <MessageSquare size={14} className="text-slate-400 dark:text-slate-500" />;
    };

    return (
        <div
            className={`
                group relative flex items-start gap-2 px-2 py-2 rounded-lg cursor-pointer transition-all
                ${isActive
                    ? 'bg-primary-100 dark:bg-primary-900/30 border border-primary-200 dark:border-primary-700'
                    : 'hover:bg-slate-100 dark:hover:bg-navy-800 border border-transparent'
                }
            `}
            onMouseEnter={() => setShowActions(true)}
            onMouseLeave={() => !actionsOpen && setShowActions(false)}
            onClick={onSelect}
        >
            {/* Icon */}
            <div className="mt-0.5 shrink-0">
                {getConversationIcon()}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                    {conversation.starred && (
                        <Star size={12} className="text-amber-500 fill-amber-500 shrink-0" />
                    )}
                    <span className={`text-sm font-medium truncate ${
                        isActive
                            ? 'text-primary-700 dark:text-primary-300'
                            : 'text-navy-900 dark:text-white'
                    }`}>
                        {conversation.title}
                    </span>
                </div>
                
                {conversation.lastMessagePreview && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {conversation.lastMessagePreview}
                    </p>
                )}
                
                <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">
                        {getRelativeTime(conversation.lastMessageAt || conversation.updatedAt)}
                    </span>
                    {conversation.messageCount > 0 && (
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">
                            • {conversation.messageCount} messages
                        </span>
                    )}
                </div>
            </div>

            {/* Actions Button */}
            {(showActions || actionsOpen) && (
                <div 
                    className="absolute right-1 top-1"
                    onClick={(e) => e.stopPropagation()}
                >
                    <ConversationActions
                        conversation={conversation}
                        onOpenChange={setActionsOpen}
                    />
                </div>
            )}
        </div>
    );
};

export default ConversationItem;


