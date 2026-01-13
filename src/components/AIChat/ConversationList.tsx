/**
 * ConversationList
 *
 * Displays grouped conversation history with time-based sections.
 * Groups: Pinned → Today → Yesterday → This Week → Last Month → Older → Archived
 *
 * @version 2.0.0
 */

import { Archive, Clock, Pin, Star } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { ConversationItem } from './ConversationItem';

interface ConversationListProps {
  groups: Record<string, any[]>;
  activeId?: string | null;
  onSelect: (id: string) => void;
}

interface GroupConfig {
  label: string;
  icon?: React.ElementType;
  iconColor?: string;
}

export const ConversationList: React.FC<ConversationListProps> = ({
  groups,
  activeId,
  onSelect,
}) => {
  const { t } = useTranslation();

  // Map of group keys to config with i18n labels and icons
  const groupConfig: Record<string, GroupConfig> = {
    pinned: {
      label: t('aiChat.groups.pinned', 'Przypięte'),
      icon: Pin,
      iconColor: 'text-amber-500',
    },
    today: {
      label: t('aiChat.groups.today', 'Dzisiaj'),
      icon: Clock,
      iconColor: 'text-green-500',
    },
    yesterday: {
      label: t('aiChat.groups.yesterday', 'Wczoraj'),
    },
    thisWeek: {
      label: t('aiChat.groups.thisWeek', 'Ten tydzień'),
    },
    lastMonth: {
      label: t('aiChat.groups.lastMonth', 'Ostatni miesiąc'),
    },
    older: {
      label: t('aiChat.groups.older', 'Starsze'),
    },
    archived: {
      label: t('aiChat.groups.archived', 'Archiwum'),
      icon: Archive,
      iconColor: 'text-slate-400',
    },
  };

  // Order of groups (important for display)
  const groupOrder = ['pinned', 'today', 'yesterday', 'thisWeek', 'lastMonth', 'older', 'archived'];

  return (
    <div className="space-y-4 pb-6">
      {groupOrder.map((groupKey) => {
        const conversations = groups[groupKey];
        if (!conversations || conversations.length === 0) return null;

        const config = groupConfig[groupKey] || { label: groupKey };
        const Icon = config.icon;

        return (
          <div key={groupKey} className="space-y-1">
            {/* Group Header */}
            <div className="flex items-center gap-1.5 px-3 py-1">
              {Icon && (
                <Icon
                  size={10}
                  className={config.iconColor || 'text-slate-400 dark:text-slate-500'}
                />
              )}
              <h5 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                {config.label}
              </h5>
              <span className="text-[9px] text-slate-300 dark:text-slate-600 ml-auto">
                {conversations.length}
              </span>
            </div>

            {/* Conversations */}
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
