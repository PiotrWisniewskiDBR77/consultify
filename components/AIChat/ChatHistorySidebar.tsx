/**
 * ChatHistorySidebar
 * 
 * FLOATING overlay sidebar showing conversation history.
 * When closed, completely disappears except for a floating toggle button.
 * Groups: Pinned → Today → Yesterday → This Week → Last Month → Older → Archived
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
    Plus, 
    Search, 
    ChevronLeft, 
    ChevronRight,
    Archive,
    Star,
    PanelLeft,
    X
} from 'lucide-react';
import { useConversationStore, groupConversations, Conversation } from '../../store/useConversationStore';
import { ConversationList } from './ConversationList';
import { ConversationSearch } from './ConversationSearch';

interface ChatHistorySidebarProps {
    projectId?: string;
    onNewChat: () => void;
    className?: string;
}

export const ChatHistorySidebar: React.FC<ChatHistorySidebarProps> = ({
    projectId,
    onNewChat,
    className = ''
}) => {
    const { t } = useTranslation();
    const {
        conversations,
        groupedConversations,
        activeConversationId,
        isLoading,
        isSidebarOpen,
        searchQuery,
        showArchived,
        fetchConversations,
        setActiveConversation,
        toggleSidebar,
        setSearchQuery,
        toggleShowArchived,
        clearActiveChat
    } = useConversationStore();

    // Fetch conversations on mount
    useEffect(() => {
        fetchConversations({ projectId });
    }, [projectId, fetchConversations]);

    // Filter conversations based on search
    const filteredConversations = searchQuery
        ? conversations.filter(c =>
            c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.lastMessagePreview?.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : conversations;

    // Group filtered conversations
    const displayGroups = searchQuery
        ? groupConversations(filteredConversations)
        : groupedConversations;

    // Calculate visible groups (exclude empty and archived unless shown)
    const visibleGroups = Object.entries(displayGroups)
        .filter(([key, items]) => {
            if (items.length === 0) return false;
            if (key === 'archived' && !showArchived) return false;
            return true;
        });

    // Handle new chat - clear active and call parent handler
    const handleNewChat = () => {
        clearActiveChat();
        onNewChat();
    };

    return (
        <>
            {/* NOTE: Floating buttons removed - ChatMenu now provides these functions */}

            {/* Overlay Background */}
            {isSidebarOpen && (
                <div 
                    className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40 lg:hidden"
                    onClick={toggleSidebar}
                />
            )}

            {/* Sidebar Panel - Floating Overlay */}
            <div className={`
                fixed top-0 left-0 h-full z-50
                bg-white dark:bg-navy-900 
                border-r border-slate-200 dark:border-navy-800
                shadow-2xl
                flex flex-col
                transition-transform duration-300 ease-in-out
                ${isSidebarOpen ? 'translate-x-0 w-80' : '-translate-x-full w-80'}
                ${className}
            `}>
                {/* Header */}
                <div className="p-4 border-b border-slate-200 dark:border-white/5">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-semibold text-navy-900 dark:text-white">
                            {t('aiChat.history', 'History')}
                        </h3>
                        <button
                            onClick={toggleSidebar}
                            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg transition-colors"
                            title={t('aiChat.closeSidebar', 'Close sidebar')}
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* New Chat Button */}
                    <button
                        onClick={handleNewChat}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 hover:bg-primary-500 text-white rounded-xl font-medium text-sm transition-colors shadow-sm hover:shadow-md"
                    >
                        <Plus size={18} />
                        {t('aiChat.newSession', 'New Strategy Session')}
                    </button>
                </div>

                {/* Search */}
                <div className="px-4 py-3">
                    <ConversationSearch
                        value={searchQuery}
                        onChange={setSearchQuery}
                        placeholder={t('aiChat.searchPlaceholder', 'Search conversations...')}
                    />
                </div>

                {/* Conversation List */}
                <div className="flex-1 overflow-y-auto px-3">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : visibleGroups.length === 0 ? (
                        <div className="text-center py-12 px-4">
                            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-slate-100 dark:bg-navy-800 flex items-center justify-center">
                                <Search size={20} className="text-slate-400" />
                            </div>
                            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                                {searchQuery
                                    ? t('aiChat.noResults', 'No conversations found')
                                    : t('aiChat.noConversations', 'No conversations yet')
                                }
                            </p>
                            {!searchQuery && (
                                <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                                    {t('aiChat.startNewChat', 'Start a new chat to begin')}
                                </p>
                            )}
                        </div>
                    ) : (
                        <ConversationList
                            groups={displayGroups}
                            activeId={activeConversationId}
                            onSelect={(id) => {
                                setActiveConversation(id);
                                // Close sidebar on mobile after selection
                                if (window.innerWidth < 1024) {
                                    toggleSidebar();
                                }
                            }}
                        />
                    )}
                </div>

                {/* Footer - Archive toggle */}
                <div className="p-4 border-t border-slate-200 dark:border-white/5">
                    <button
                        onClick={toggleShowArchived}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm rounded-xl transition-colors ${
                            showArchived
                                ? 'bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300'
                                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800'
                        }`}
                    >
                        <Archive size={16} />
                        {t('aiChat.sections.archived', 'Archived')}
                        {displayGroups.archived.length > 0 && (
                            <span className="ml-auto text-xs bg-slate-200 dark:bg-navy-700 px-2 py-0.5 rounded-full">
                                {displayGroups.archived.length}
                            </span>
                        )}
                    </button>
                </div>
            </div>
        </>
    );
};

export default ChatHistorySidebar;

