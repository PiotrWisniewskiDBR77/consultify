/**
 * ConversationList
 * 
 * Renders grouped conversations with section headers.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Star, Clock, Calendar, CalendarDays, Archive, FolderOpen } from 'lucide-react';
import { Conversation } from '../../store/useConversationStore';
import { ConversationItem } from './ConversationItem';

type ConversationGroup = 'pinned' | 'today' | 'yesterday' | 'thisWeek' | 'lastMonth' | 'older' | 'archived';

interface ConversationListProps {
    groups: Record<ConversationGroup, Conversation[]>;
    activeId: string | null;
    onSelect: (id: string) => void;
}

const GROUP_CONFIG: Record<ConversationGroup, { icon: React.ElementType; labelKey: string; defaultLabel: string }> = {
    pinned: { icon: Star, labelKey: 'aiChat.sections.pinned', defaultLabel: 'Pinned' },
    today: { icon: Clock, labelKey: 'aiChat.sections.today', defaultLabel: 'Today' },
    yesterday: { icon: Calendar, labelKey: 'aiChat.sections.yesterday', defaultLabel: 'Yesterday' },
    thisWeek: { icon: CalendarDays, labelKey: 'aiChat.sections.thisWeek', defaultLabel: 'This Week' },
    lastMonth: { icon: CalendarDays, labelKey: 'aiChat.sections.lastMonth', defaultLabel: 'Last 30 Days' },
    older: { icon: FolderOpen, labelKey: 'aiChat.sections.older', defaultLabel: 'Older' },
    archived: { icon: Archive, labelKey: 'aiChat.sections.archived', defaultLabel: 'Archived' }
};

const GROUP_ORDER: ConversationGroup[] = ['pinned', 'today', 'yesterday', 'thisWeek', 'lastMonth', 'older', 'archived'];

export const ConversationList: React.FC<ConversationListProps> = ({
    groups,
    activeId,
    onSelect
}) => {
    const { t } = useTranslation();

    return (
        <div className="space-y-4 py-2">
            {GROUP_ORDER.map(groupKey => {
                const conversations = groups[groupKey];
                if (!conversations || conversations.length === 0) return null;

                const config = GROUP_CONFIG[groupKey];
                const Icon = config.icon;

                return (
                    <div key={groupKey}>
                        {/* Section Header */}
                        <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            <Icon size={12} className={groupKey === 'pinned' ? 'text-amber-500' : ''} />
                            {t(config.labelKey, config.defaultLabel)}
                        </div>

                        {/* Conversations */}
                        <div className="space-y-0.5">
                            {conversations.map(conv => (
                                <ConversationItem
                                    key={conv.id}
                                    conversation={conv}
                                    isActive={conv.id === activeId}
                                    onSelect={() => onSelect(conv.id)}
                                />
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default ConversationList;


