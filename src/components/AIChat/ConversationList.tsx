/**
 * ConversationList
 *
 * Displays grouped conversation history with time-based sections.
 * Groups: Pinned → Today → Yesterday → This Week → Last Month → Older → Archived
 *
 * C3.1: Each group shows max MAX_VISIBLE_PER_GROUP items with "Show more" toggle.
 *
 * @version 2.1.0
 */

import { Archive, ChevronDown, ChevronRight, Clock, Pin, Star } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useConversationStore } from '../../store/useConversationStore';
import { ConversationItem } from './ConversationItem';

/** Max conversations visible per time-group before "Show more" */
const MAX_VISIBLE_PER_GROUP = 5;

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
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const collapsedConversationGroups = useConversationStore((s) => s.collapsedConversationGroups);
  const toggleConversationGroupCollapsed = useConversationStore(
    (s) => s.toggleConversationGroupCollapsed
  );

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

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
    thisWeek: {
      label: t('aiChat.groups.thisWeek', 'Ten tydzień'),
    },
    thisMonth: {
      label: t('aiChat.groups.thisMonth', 'Ten miesiąc'),
    },
    older: {
      label: t('aiChat.groups.older', 'Starsze'),
    },
    archived: {
      label: t('aiChat.groups.archived', 'Archiwum'),
      icon: Archive,
      iconColor: 'text-slate-600',
    },
  };

  // Order of groups (important for display)
  const groupOrder = ['pinned', 'today', 'thisWeek', 'thisMonth', 'older', 'archived'];

  return (
    <div className="space-y-2 pb-4">
      {groupOrder.map((groupKey) => {
        const conversations = groups[groupKey];
        if (!conversations || conversations.length === 0) return null;

        const config = groupConfig[groupKey] || { label: groupKey };
        const Icon = config.icon;
        const isGroupCollapsed = collapsedConversationGroups[groupKey] ?? false;
        const isExpanded = expandedGroups[groupKey] ?? false;
        const hasMore = conversations.length > MAX_VISIBLE_PER_GROUP;
        const visibleConversations = isExpanded
          ? conversations
          : conversations.slice(0, MAX_VISIBLE_PER_GROUP);

        return (
          <div key={groupKey}>
            {/* Group Header */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => toggleConversationGroupCollapsed(groupKey)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggleConversationGroupCollapsed(groupKey);
                }
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 cursor-pointer hover:bg-slate-50 dark:hover:bg-navy-800/50 rounded-md transition-colors group/header"
              aria-expanded={!isGroupCollapsed}
              aria-label={t('aiChat.toggleGroup', 'Toggle {{label}}', { label: config.label })}
            >
              <span className="shrink-0 text-slate-600 dark:text-slate-500 group-hover/header:text-slate-600 dark:group-hover/header:text-slate-300">
                {isGroupCollapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
              </span>
              {Icon && (
                <Icon
                  size={10}
                  className={config.iconColor || 'text-slate-600 dark:text-slate-500'}
                />
              )}
              <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-500 uppercase tracking-wider flex-1">
                {config.label}
              </span>
              <span className="text-[9px] tabular-nums text-slate-600 dark:text-slate-600">
                {conversations.length}
              </span>
            </div>

            {/* Conversations */}
            {!isGroupCollapsed && (
              <>
                <div className="mt-0.5">
                  {visibleConversations.map((conv) => (
                    <ConversationItem
                      key={conv.id}
                      conversation={conv}
                      isActive={activeId === conv.id}
                      onSelect={onSelect}
                    />
                  ))}
                </div>
                {hasMore && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleGroup(groupKey);
                    }}
                    className="w-full flex items-center justify-center gap-1 px-2 py-1 text-[10px] font-medium text-slate-600 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800/50 rounded-md transition-colors"
                  >
                    {isExpanded ? (
                      <>
                        <ChevronRight size={10} className="rotate-[-90deg]" />
                        {t('aiChat.showLess', 'Show less')}
                      </>
                    ) : (
                      <>
                        <ChevronDown size={10} />
                        {t('aiChat.showMore', 'Show more')} (
                        {conversations.length - MAX_VISIBLE_PER_GROUP})
                      </>
                    )}
                  </button>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ConversationList;
