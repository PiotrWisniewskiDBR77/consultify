/**
 * ChatSlidingPanel
 * 
 * Claude-style sliding panel for chat history and project organization.
 * Slides in from the left when activated, showing:
 * - New Chat button
 * - Tab navigation (Chats / Projects)
 * - Conversation list grouped by time
 * - Project folders with nested conversations
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X, Search, Settings, Loader2 } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useConversationStore, groupConversations } from '../../store/useConversationStore';
import { useChatProjectStore } from '../../store/useChatProjectStore';
import { ChatTabNavigation, ChatTab } from './ChatTabNavigation';
import { ConversationList } from './ConversationList';
import { ProjectList } from './ProjectList';

interface ChatSlidingPanelProps {
    onNewChat: () => void;
    onSelectConversation: (id: string) => void;
    activeConversationId: string | null;
}

export const ChatSlidingPanel: React.FC<ChatSlidingPanelProps> = ({
    onNewChat,
    onSelectConversation,
    activeConversationId
}) => {
    const { t } = useTranslation();
    const { isChatSlidingPanelOpen, setChatSlidingPanelOpen } = useAppStore();
    const {
        conversations,
        groupedConversations,
        isLoading: isLoadingConversations,
        fetchConversations,
        setSearchQuery,
        searchQuery
    } = useConversationStore();
    const { projects, fetchProjects } = useChatProjectStore();

    const [activeTab, setActiveTab] = useState<ChatTab>('chats');
    const [localSearchQuery, setLocalSearchQuery] = useState('');
    const panelRef = useRef<HTMLDivElement>(null);

    // Fetch data on mount
    useEffect(() => {
        if (isChatSlidingPanelOpen) {
            fetchConversations();
            fetchProjects();
        }
    }, [isChatSlidingPanelOpen]);

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                // Check if click is on the sidebar toggle button (don't close in that case)
                const target = e.target as HTMLElement;
                if (target.closest('[data-chat-toggle]')) return;

                setChatSlidingPanelOpen(false);
            }
        };

        if (isChatSlidingPanelOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isChatSlidingPanelOpen, setChatSlidingPanelOpen]);

    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isChatSlidingPanelOpen) {
                setChatSlidingPanelOpen(false);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isChatSlidingPanelOpen, setChatSlidingPanelOpen]);

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            setSearchQuery(localSearchQuery);
        }, 300);
        return () => clearTimeout(timer);
    }, [localSearchQuery, setSearchQuery]);

    const handleNewChat = useCallback(() => {
        onNewChat();
        // Don't close panel - user might want to see their new chat in the list
    }, [onNewChat]);

    const handleSelectConversation = useCallback((id: string) => {
        onSelectConversation(id);
        // Keep panel open for easy switching between conversations
    }, [onSelectConversation]);

    // Filter conversations based on search
    const filteredGroupedConversations = React.useMemo(() => {
        if (!localSearchQuery.trim()) {
            return groupedConversations;
        }

        const query = localSearchQuery.toLowerCase();
        const filtered = conversations.filter(c =>
            c.title.toLowerCase().includes(query) ||
            c.lastMessagePreview?.toLowerCase().includes(query)
        );

        return groupConversations(filtered);
    }, [conversations, groupedConversations, localSearchQuery]);

    // Count non-archived conversations
    const activeConversationsCount = conversations.filter(c => !c.archived).length;

    return (
        <>
            {/* Backdrop overlay for mobile */}
            {isChatSlidingPanelOpen && (
                <div
                    className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 lg:hidden"
                    onClick={() => setChatSlidingPanelOpen(false)}
                />
            )}

            {/* Sliding Panel */}
            <div
                ref={panelRef}
                className={`
                    absolute top-0 left-0 h-full w-[280px] z-40
                    bg-white dark:bg-navy-900
                    border-r border-slate-200 dark:border-navy-800
                    shadow-xl
                    transform transition-transform duration-200 ease-out
                    flex flex-col
                    ${isChatSlidingPanelOpen ? 'translate-x-0' : '-translate-x-full'}
                `}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-3 border-b border-slate-200 dark:border-navy-800">
                    <h2 className="text-sm font-semibold text-navy-900 dark:text-white">
                        {t('aiChat.panel.title', 'AI Chat')}
                    </h2>
                    <button
                        onClick={() => setChatSlidingPanelOpen(false)}
                        className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg transition-colors"
                        title={t('common.close', 'Zamknij')}
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* New Chat Button */}
                <div className="p-3 border-b border-slate-200 dark:border-navy-800">
                    <button
                        onClick={handleNewChat}
                        className="
                            w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                            bg-primary-600 hover:bg-primary-500 active:bg-primary-700
                            text-white font-medium
                            shadow-sm hover:shadow-md
                            transition-all duration-200
                        "
                    >
                        <Plus size={18} />
                        {t('aiChat.newChat', 'Nowa rozmowa')}
                    </button>
                </div>

                {/* Tab Navigation */}
                <ChatTabNavigation
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    chatsCount={activeConversationsCount}
                    projectsCount={projects.length}
                />

                {/* Search (only for Chats tab) */}
                {activeTab === 'chats' && (
                    <div className="px-3 py-2 border-b border-slate-200 dark:border-navy-800">
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={localSearchQuery}
                                onChange={(e) => setLocalSearchQuery(e.target.value)}
                                placeholder={t('aiChat.searchPlaceholder', 'Szukaj rozmów...')}
                                className="
                                    w-full pl-9 pr-3 py-2 rounded-lg text-sm
                                    bg-slate-50 dark:bg-navy-800
                                    border border-slate-200 dark:border-navy-700
                                    text-navy-900 dark:text-white
                                    placeholder:text-slate-400
                                    focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500
                                    transition-all
                                "
                            />
                            {localSearchQuery && (
                                <button
                                    onClick={() => setLocalSearchQuery('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    {activeTab === 'chats' ? (
                        isLoadingConversations ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 size={24} className="animate-spin text-primary-500" />
                            </div>
                        ) : (
                            <ConversationList
                                groups={filteredGroupedConversations}
                                activeId={activeConversationId}
                                onSelect={handleSelectConversation}
                            />
                        )
                    ) : (
                        <ProjectList
                            onSelectConversation={handleSelectConversation}
                            activeConversationId={activeConversationId}
                        />
                    )}
                </div>

                {/* Footer */}
                <div className="p-3 border-t border-slate-200 dark:border-navy-800">
                    <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
                        <span>
                            {activeConversationsCount} {t('aiChat.conversations', 'rozmów')}
                        </span>
                        {projects.length > 0 && (
                            <span>
                                {projects.length} {t('aiChat.projects', 'projektów')}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default ChatSlidingPanel;








