import React from 'react';

import { ConversationItem } from './ConversationItem';

interface ConversationListProps {
    groups: Record<string, any[]>;
    activeId?: string | null;
    onSelect: (id: string) => void;
}

export const ConversationList: React.FC<ConversationListProps> = ({ groups, activeId, onSelect }) => {
    // Map of group keys to human readable labels
    const groupLabels: Record<string, string> = {
        pinned: 'Pinned',
        today: 'Today',
        yesterday: 'Yesterday',
        thisWeek: 'This Week',
        lastMonth: 'Last Month',
        older: 'Older',
        archived: 'Archived',
    };

    return (
        <div className="space-y-6 pb-6">
            {Object.entries(groups).map(([groupKey, conversations]) => {
                if (!conversations || conversations.length === 0) return null;

                return (
                    <div key={groupKey} className="space-y-1">
                        <h5 className="px-3 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                            {groupLabels[groupKey] || groupKey}
                        </h5>
                        <div className="space-y-0.5">
                            {conversations.map((conv) => (
                                <ConversationItem
                                    key={conv.id}
                                    conversation={conv}
                                    isActive={activeId === conv.id}
                                    onSelect={onSelect}
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
