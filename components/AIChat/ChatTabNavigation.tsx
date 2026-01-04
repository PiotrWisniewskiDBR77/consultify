/**
 * ChatTabNavigation
 *
 * Tab navigation for switching between Chats and Projects views.
 * Similar to Claude AI's project/chat organization.
 */

import { Folder, MessageSquare } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

export type ChatTab = 'chats' | 'projects';

interface ChatTabNavigationProps {
    activeTab: ChatTab;
    onTabChange: (tab: ChatTab) => void;
    chatsCount?: number;
    projectsCount?: number;
}

export const ChatTabNavigation: React.FC<ChatTabNavigationProps> = ({
    activeTab,
    onTabChange,
    chatsCount = 0,
    projectsCount = 0,
}) => {
    const { t } = useTranslation();

    const tabs: { id: ChatTab; label: string; icon: React.ElementType; count: number }[] = [
        {
            id: 'chats',
            label: t('aiChat.tabs.chats', 'Rozmowy'),
            icon: MessageSquare,
            count: chatsCount,
        },
        {
            id: 'projects',
            label: t('aiChat.tabs.projects', 'Projekty'),
            icon: Folder,
            count: projectsCount,
        },
    ];

    return (
        <div className="flex border-b border-slate-200 dark:border-navy-800 bg-slate-50/50 dark:bg-navy-950/50">
            {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className={`
                            flex-1 flex items-center justify-center gap-2 px-4 py-3
                            text-sm font-medium transition-all relative
                            ${
                                isActive
                                    ? 'text-primary-600 dark:text-primary-400'
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                            }
                        `}
                    >
                        <Icon size={16} className={isActive ? 'text-primary-500' : ''} />
                        <span>{tab.label}</span>

                        {/* Count badge */}
                        {tab.count > 0 && (
                            <span
                                className={`
                                min-w-[20px] px-1.5 py-0.5 rounded-full text-xs tabular-nums
                                ${
                                    isActive
                                        ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                                        : 'bg-slate-200 dark:bg-navy-700 text-slate-600 dark:text-slate-400'
                                }
                            `}
                            >
                                {tab.count}
                            </span>
                        )}

                        {/* Active indicator */}
                        {isActive && (
                            <span
                                className="
                                absolute bottom-0 left-4 right-4 h-0.5
                                bg-primary-500 rounded-t-full
                            "
                            />
                        )}
                    </button>
                );
            })}
        </div>
    );
};

export default ChatTabNavigation;

