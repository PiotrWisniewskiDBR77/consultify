/**
 * ChatHistorySidebar
 *
 * FLOATING overlay sidebar showing conversation history AND projects.
 * When closed, completely disappears except for a floating toggle button.
 * Groups: Projects → Pinned → Today → Yesterday → This Week → Last Month → Older → Archived
 */

import {
    Archive,
    ChevronDown,
    ChevronRight,
    Folder,
    FolderPlus,
    MoreHorizontal,
    Pencil,
    Plus,
    Search,
    Trash2,
    X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useChatProjectStore, ChatProject } from '../../store/useChatProjectStore';
import { Conversation, groupConversations, useConversationStore } from '../../store/useConversationStore';
import { ConversationList } from './ConversationList';
import { ConversationSearch } from './ConversationSearch';

interface ChatHistorySidebarProps {
    projectId?: string;
    onNewChat: () => void;
    className?: string;
}

export const ChatHistorySidebar: React.FC<ChatHistorySidebarProps> = ({ projectId, onNewChat, className = '' }) => {
    const { t } = useTranslation();
    
    // Conversation store
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
        clearActiveChat,
    } = useConversationStore();

    // Project store
    const {
        projects,
        expandedProjectIds,
        isLoading: isLoadingProjects,
        fetchProjects,
        createProject,
        deleteProject,
        toggleProjectExpanded,
        getConversationsByProjectId,
    } = useChatProjectStore();

    // Local state
    const [showNewProjectInput, setShowNewProjectInput] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');
    const [projectMenuId, setProjectMenuId] = useState<string | null>(null);

    // Fetch conversations and projects on mount
    useEffect(() => {
        fetchConversations({ projectId });
        fetchProjects();
    }, [projectId, fetchConversations, fetchProjects]);

    // Filter conversations based on search
    const filteredConversations = searchQuery
        ? conversations.filter(
              (c) =>
                  c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  c.lastMessagePreview?.toLowerCase().includes(searchQuery.toLowerCase()),
          )
        : conversations;

    // Group filtered conversations
    const displayGroups = searchQuery ? groupConversations(filteredConversations) : groupedConversations;

    // Calculate visible groups (exclude empty and archived unless shown)
    const visibleGroups = Object.entries(displayGroups).filter(([key, items]) => {
        if (items.length === 0) return false;
        if (key === 'archived' && !showArchived) return false;
        return true;
    });

    // Handle new chat - clear active and call parent handler
    const handleNewChat = () => {
        clearActiveChat();
        onNewChat();
    };

    // Handle create project
    const handleCreateProject = useCallback(async () => {
        if (!newProjectName.trim()) return;
        try {
            await createProject({ name: newProjectName.trim() });
            setNewProjectName('');
            setShowNewProjectInput(false);
        } catch (err) {
            console.error('[ChatHistorySidebar] Failed to create project:', err);
        }
    }, [newProjectName, createProject]);

    // Handle delete project
    const handleDeleteProject = useCallback(async (id: string) => {
        try {
            await deleteProject(id);
            setProjectMenuId(null);
        } catch (err) {
            console.error('[ChatHistorySidebar] Failed to delete project:', err);
        }
    }, [deleteProject]);

    return (
        <>
            {/* NOTE: Floating buttons removed - ChatMenu now provides these functions */}

            {/* Overlay Background */}
            {isSidebarOpen && (
                <div className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40 lg:hidden" onClick={toggleSidebar} />
            )}

            {/* Sidebar Panel - Floating Overlay */}
            <div
                className={`
                fixed top-0 left-0 h-full z-50
                bg-white dark:bg-navy-900 
                border-r border-slate-200 dark:border-navy-800
                shadow-2xl
                flex flex-col
                transition-transform duration-300 ease-in-out
                ${isSidebarOpen ? 'translate-x-0 w-80' : '-translate-x-full w-80'}
                ${className}
            `}
            >
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

                {/* Projects Section */}
                {!searchQuery && projects.length > 0 && (
                    <div className="px-3 pb-3 border-b border-slate-200 dark:border-white/5">
                        <div className="flex items-center justify-between mb-2 px-1">
                            <h5 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                {t('aiChat.projects', 'Projects')}
                            </h5>
                            <button
                                onClick={() => setShowNewProjectInput(true)}
                                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 rounded transition-colors"
                                title={t('aiChat.newProject', 'New Project')}
                            >
                                <FolderPlus size={14} />
                            </button>
                        </div>

                        {/* New Project Input */}
                        {showNewProjectInput && (
                            <div className="mb-2 flex gap-2">
                                <input
                                    type="text"
                                    value={newProjectName}
                                    onChange={(e) => setNewProjectName(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleCreateProject();
                                        if (e.key === 'Escape') {
                                            setShowNewProjectInput(false);
                                            setNewProjectName('');
                                        }
                                    }}
                                    placeholder={t('aiChat.projectName', 'Project name...')}
                                    className="flex-1 px-2 py-1.5 text-sm rounded-lg bg-slate-100 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                                    autoFocus
                                />
                                <button
                                    onClick={handleCreateProject}
                                    disabled={!newProjectName.trim()}
                                    className="px-2 py-1.5 text-sm bg-primary-600 hover:bg-primary-500 disabled:bg-slate-300 dark:disabled:bg-navy-700 text-white rounded-lg transition-colors"
                                >
                                    {t('common.add', 'Add')}
                                </button>
                            </div>
                        )}

                        {/* Project List */}
                        <div className="space-y-0.5">
                            {projects.map((project) => {
                                const isExpanded = expandedProjectIds.includes(project.id);
                                const projectConversations = getConversationsByProjectId(project.id);
                                
                                return (
                                    <div key={project.id}>
                                        <div
                                            className="group flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 cursor-pointer transition-colors"
                                            onClick={() => toggleProjectExpanded(project.id)}
                                        >
                                            <button className="shrink-0 text-slate-400">
                                                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                            </button>
                                            <Folder 
                                                size={16} 
                                                className="shrink-0"
                                                style={{ color: project.color }}
                                            />
                                            <span className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                                                {project.name}
                                            </span>
                                            <span className="text-xs text-slate-400 dark:text-slate-500">
                                                {project.conversationCount}
                                            </span>
                                            <div className="relative">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setProjectMenuId(projectMenuId === project.id ? null : project.id);
                                                    }}
                                                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded transition-all"
                                                >
                                                    <MoreHorizontal size={14} />
                                                </button>
                                                
                                                {/* Project Menu */}
                                                {projectMenuId === project.id && (
                                                    <div className="absolute right-0 top-full mt-1 z-50 w-32 bg-white dark:bg-navy-800 rounded-lg shadow-lg border border-slate-200 dark:border-navy-700 py-1">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeleteProject(project.id);
                                                            }}
                                                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                        >
                                                            <Trash2 size={14} />
                                                            {t('common.delete', 'Delete')}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        
                                        {/* Project Conversations */}
                                        {isExpanded && projectConversations.length > 0 && (
                                            <div className="ml-6 mt-1 space-y-0.5">
                                                {projectConversations.map((conv) => (
                                                    <button
                                                        key={conv.id}
                                                        onClick={() => {
                                                            setActiveConversation(conv.id);
                                                            if (window.innerWidth < 1024) toggleSidebar();
                                                        }}
                                                        className={`w-full text-left px-2 py-1.5 rounded-lg text-sm truncate transition-colors ${
                                                            activeConversationId === conv.id
                                                                ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-900 dark:text-primary-100'
                                                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800'
                                                        }`}
                                                    >
                                                        {conv.title || t('aiChat.newConversation', 'New conversation')}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        
                                        {isExpanded && projectConversations.length === 0 && (
                                            <div className="ml-6 mt-1 px-2 py-2 text-xs text-slate-400 dark:text-slate-500 italic">
                                                {t('aiChat.noProjectConversations', 'No conversations in this project')}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Create First Project Section */}
                {!searchQuery && projects.length === 0 && (
                    <div className="px-3 pb-3 border-b border-slate-200 dark:border-white/5">
                        <h5 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 px-1">
                            {t('aiChat.projects', 'Projects')}
                        </h5>
                        
                        {showNewProjectInput ? (
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newProjectName}
                                    onChange={(e) => setNewProjectName(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleCreateProject();
                                        if (e.key === 'Escape') {
                                            setShowNewProjectInput(false);
                                            setNewProjectName('');
                                        }
                                    }}
                                    placeholder={t('aiChat.projectName', 'Project name...')}
                                    className="flex-1 px-2 py-1.5 text-sm rounded-lg bg-slate-100 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                                    autoFocus
                                />
                                <button
                                    onClick={handleCreateProject}
                                    disabled={!newProjectName.trim()}
                                    className="px-2 py-1.5 text-sm bg-primary-600 hover:bg-primary-500 disabled:bg-slate-300 dark:disabled:bg-navy-700 text-white rounded-lg transition-colors"
                                >
                                    {t('common.add', 'Add')}
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setShowNewProjectInput(true)}
                                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 border border-dashed border-slate-300 dark:border-navy-700 rounded-lg hover:border-slate-400 dark:hover:border-navy-600 transition-colors"
                            >
                                <FolderPlus size={16} />
                                {t('aiChat.createProject', 'Create a project')}
                            </button>
                        )}
                    </div>
                )}

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
                                    : t('aiChat.noConversations', 'No conversations yet')}
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
