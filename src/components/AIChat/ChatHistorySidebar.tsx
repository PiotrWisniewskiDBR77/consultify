/**
 * ChatHistorySidebar
 *
 * FLOATING overlay sidebar showing conversation history AND projects.
 * When closed, completely disappears except for a floating toggle button.
 *
 * Layout:
 * ┌────────────────────────┐
 * │ Header + New Chat      │
 * │ Search                 │
 * ├────────────────────────┤
 * │ MY PROJECTS (personal) │
 * │ TEAM PROJECTS (shared) │
 * ├────────────────────────┤
 * │ Conversations by date  │
 * ├────────────────────────┤
 * │ Archive toggle         │
 * └────────────────────────┘
 */

import {
  Archive,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderPlus,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAppStore } from '../../store/useAppStore';
import {
  ChatProject,
  ChatProjectScope,
  useChatProjectStore,
} from '../../store/useChatProjectStore';
import {
  Conversation,
  groupConversations,
  useConversationStore,
} from '../../store/useConversationStore';
import { ConversationItem } from './ConversationItem';
import { ConversationList } from './ConversationList';
import { ConversationSearch } from './ConversationSearch';

interface ChatHistorySidebarProps {
  projectId?: string;
  onNewChat: () => void;
  className?: string;
}

// ==================== PROJECT SECTION COMPONENT ====================

interface ProjectSectionProps {
  title: string;
  icon: React.ReactNode;
  projects: ChatProject[];
  expandedProjectIds: string[];
  activeConversationId: string | null;
  getConversationsByProjectId: (id: string) => Conversation[];
  onToggleExpanded: (id: string) => void;
  onSelectConversation: (id: string) => void;
  onDeleteProject: (id: string) => void;
  onCreateProject: (name: string) => void;
  createButtonLabel: string;
  emptyLabel: string;
  t: (key: string, fallback: string) => string;
}

const ProjectSection: React.FC<ProjectSectionProps> = ({
  title,
  icon,
  projects,
  expandedProjectIds,
  activeConversationId,
  getConversationsByProjectId,
  onToggleExpanded,
  onSelectConversation,
  onDeleteProject,
  onCreateProject,
  createButtonLabel,
  emptyLabel,
  t,
}) => {
  const [showInput, setShowInput] = useState(false);
  const [name, setName] = useState('');
  const [menuId, setMenuId] = useState<string | null>(null);

  const handleCreate = () => {
    if (!name.trim()) return;
    onCreateProject(name.trim());
    setName('');
    setShowInput(false);
  };

  return (
    <div className="px-3 pb-2">
      <div className="flex items-center justify-between mb-1.5 px-1">
        <h5 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
          {icon}
          {title}
        </h5>
        <button
          onClick={() => setShowInput(true)}
          className="p-1 text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 rounded transition-colors"
          title={createButtonLabel}
        >
          <FolderPlus size={13} />
        </button>
      </div>

      {/* New Project Input */}
      {showInput && (
        <div className="mb-2 flex gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
              if (e.key === 'Escape') {
                setShowInput(false);
                setName('');
              }
            }}
            placeholder={t('aiChat.projectName', 'Project name...')}
            className="flex-1 px-2 py-1.5 text-sm rounded-lg bg-slate-100 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
            autoFocus
          />
          <button
            onClick={handleCreate}
            disabled={!name.trim()}
            className="px-2 py-1.5 text-sm bg-primary-600 hover:bg-primary-500 disabled:bg-slate-300 dark:disabled:bg-navy-700 text-white rounded-lg transition-colors"
          >
            {t('common.add', 'Add')}
          </button>
        </div>
      )}

      {/* Project List */}
      {projects.length > 0 ? (
        <div className="space-y-0.5">
          {projects.map((project) => {
            const isExpanded = expandedProjectIds.includes(project.id);
            const projectConversations = getConversationsByProjectId(project.id);

            return (
              <div key={project.id}>
                <div
                  className="group flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 cursor-pointer transition-colors"
                  onClick={() => onToggleExpanded(project.id)}
                >
                  <button className="shrink-0 text-slate-400 dark:text-slate-500">
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                  <Folder size={15} className="shrink-0" style={{ color: project.color }} />
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
                        setMenuId(menuId === project.id ? null : project.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300 rounded transition-all"
                    >
                      <MoreHorizontal size={14} />
                    </button>

                    {/* Project Menu */}
                    {menuId === project.id && (
                      <div className="absolute right-0 top-full mt-1 z-50 w-32 bg-white dark:bg-navy-800 rounded-lg shadow-lg border border-slate-200 dark:border-navy-700 py-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteProject(project.id);
                            setMenuId(null);
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
                  <div className="ml-4 mt-0.5 space-y-0.5">
                    {projectConversations.map((conv) => (
                      <ConversationItem
                        key={conv.id}
                        conversation={conv}
                        isActive={activeConversationId === conv.id}
                        onSelect={onSelectConversation}
                        compact
                      />
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
      ) : !showInput ? (
        <button
          onClick={() => setShowInput(true)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 border border-dashed border-slate-300 dark:border-navy-700 rounded-lg hover:border-slate-400 dark:hover:border-navy-600 transition-colors"
        >
          <FolderPlus size={14} />
          {emptyLabel}
        </button>
      ) : null}
    </div>
  );
};

// ==================== MAIN SIDEBAR ====================

export const ChatHistorySidebar: React.FC<ChatHistorySidebarProps> = ({
  projectId,
  onNewChat,
  className = '',
}) => {
  const { t } = useTranslation();

  // App store - for sidebar position awareness
  const { isSidebarCollapsed } = useAppStore();

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
    getPersonalProjects,
    getTeamProjects,
  } = useChatProjectStore();

  // Derived project lists
  const personalProjects = getPersonalProjects();
  const teamProjects = getTeamProjects();

  // Fetch conversations and projects on mount
  // Note: fetchConversations and fetchProjects are stable Zustand actions -
  // we intentionally exclude them from deps to prevent infinite loops
  useEffect(() => {
    fetchConversations({ projectId });
    fetchProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Filter conversations based on search
  const filteredConversations = searchQuery
    ? conversations.filter(
        (c) =>
          c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.lastMessagePreview?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : conversations;

  // Group filtered conversations
  const displayGroups = searchQuery
    ? groupConversations(filteredConversations)
    : groupedConversations;

  // Calculate visible groups (exclude empty and archived unless shown)
  const visibleGroups = Object.entries(displayGroups).filter(([key, items]) => {
    if (items.length === 0) return false;
    if (key === 'archived' && !showArchived) return false;
    return true;
  });

  // Unassigned conversations (not in any folder, not archived)
  const unassignedConversations = filteredConversations.filter(
    (c) => !c.chatProjectId && !c.archived
  );
  const unassignedGroups = groupConversations(unassignedConversations);

  // Handle new chat - clear active and call parent handler
  const handleNewChat = () => {
    clearActiveChat();
    onNewChat();
  };

  // Handle select conversation
  const handleSelectConversation = useCallback(
    (id: string) => {
      setActiveConversation(id);
      if (window.innerWidth < 1024) toggleSidebar();
    },
    [setActiveConversation, toggleSidebar]
  );

  // Handle create project with scope
  const handleCreatePersonalProject = useCallback(
    async (name: string) => {
      try {
        await createProject({ name, scope: 'personal' });
      } catch (err) {
        console.error('[ChatHistorySidebar] Failed to create personal project:', err);
      }
    },
    [createProject]
  );

  const handleCreateTeamProject = useCallback(
    async (name: string) => {
      try {
        await createProject({ name, scope: 'team' });
      } catch (err) {
        console.error('[ChatHistorySidebar] Failed to create team project:', err);
      }
    },
    [createProject]
  );

  // Handle delete project
  const handleDeleteProject = useCallback(
    async (id: string) => {
      try {
        await deleteProject(id);
      } catch (err) {
        console.error('[ChatHistorySidebar] Failed to delete project:', err);
      }
    },
    [deleteProject]
  );

  return (
    <>
      {/* Overlay Background */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar Panel - Floating Overlay */}
      <div
        data-testid="chat-history-sidebar"
        className={`
                fixed top-0 h-full z-40
                bg-white dark:bg-navy-900 
                border-r border-slate-200 dark:border-navy-800
                shadow-2xl
                flex flex-col
                transition-all duration-300 ease-in-out
                ${isSidebarCollapsed ? 'left-16' : 'lg:left-64 left-0'}
                ${isSidebarOpen ? 'translate-x-0 w-80 pointer-events-auto' : '-translate-x-full w-80 pointer-events-none'}
                ${className}
            `}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-navy-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-navy-900 dark:text-white">
              {t('aiChat.history', 'History')}
            </h3>
            <button
              onClick={toggleSidebar}
              data-testid="chat-history-close"
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg transition-colors"
              title={t('aiChat.closeSidebar', 'Close sidebar')}
            >
              <X size={18} />
            </button>
          </div>

          {/* New Chat Button */}
          <button
            onClick={handleNewChat}
            data-testid="chat-history-new-chat"
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 hover:bg-primary-500 text-white rounded-xl font-medium text-sm transition-colors shadow-sm hover:shadow-md"
          >
            <Plus size={18} />
            {t('aiChat.newChat', 'Nowy czat')}
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

        {/* Main scrollable area: Folders + Conversations */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : searchQuery ? (
            /* Search mode: show flat grouped results */
            visibleGroups.length === 0 ? (
              <div className="text-center py-12 px-4">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-slate-100 dark:bg-navy-800 flex items-center justify-center">
                  <Search size={20} className="text-slate-400 dark:text-slate-500" />
                </div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                  {t('aiChat.noResults', 'No conversations found')}
                </p>
              </div>
            ) : (
              <div className="px-3">
                <ConversationList
                  groups={displayGroups}
                  activeId={activeConversationId}
                  onSelect={handleSelectConversation}
                />
              </div>
            )
          ) : (
            /* Default mode: Project folders first, then unassigned conversations */
            <>
              {/* Project Folders (Primary Navigation) */}
              <div className="pb-1">
                {/* My Projects (Personal) */}
                <ProjectSection
                  title={t('aiChat.myProjects', 'My Projects')}
                  icon={<Folder size={11} />}
                  projects={personalProjects}
                  expandedProjectIds={expandedProjectIds}
                  activeConversationId={activeConversationId}
                  getConversationsByProjectId={getConversationsByProjectId}
                  onToggleExpanded={toggleProjectExpanded}
                  onSelectConversation={handleSelectConversation}
                  onDeleteProject={handleDeleteProject}
                  onCreateProject={handleCreatePersonalProject}
                  createButtonLabel={t('aiChat.newPersonalFolder', 'New personal folder')}
                  emptyLabel={t('aiChat.createFolder', 'Create folder')}
                  t={t}
                />

                {/* Team Projects (Shared) */}
                <ProjectSection
                  title={t('aiChat.teamProjects', 'Team Projects')}
                  icon={<Users size={11} />}
                  projects={teamProjects}
                  expandedProjectIds={expandedProjectIds}
                  activeConversationId={activeConversationId}
                  getConversationsByProjectId={getConversationsByProjectId}
                  onToggleExpanded={toggleProjectExpanded}
                  onSelectConversation={handleSelectConversation}
                  onDeleteProject={handleDeleteProject}
                  onCreateProject={handleCreateTeamProject}
                  createButtonLabel={t('aiChat.newTeamFolder', 'New team folder')}
                  emptyLabel={t('aiChat.createTeamFolder', 'Create team folder')}
                  t={t}
                />
              </div>

              {/* Separator between folders and unassigned conversations */}
              {(personalProjects.length > 0 || teamProjects.length > 0) &&
                unassignedConversations.length > 0 && (
                  <div className="border-t border-slate-200 dark:border-navy-700 mx-3" />
                )}

              {/* Unassigned Conversations (not in any folder) */}
              <div className="px-3">
                {unassignedConversations.length === 0 && personalProjects.length === 0 && teamProjects.length === 0 ? (
                  <div className="text-center py-12 px-4">
                    <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-slate-100 dark:bg-navy-800 flex items-center justify-center">
                      <Search size={20} className="text-slate-400 dark:text-slate-500" />
                    </div>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                      {t('aiChat.noConversations', 'No conversations yet')}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                      {t('aiChat.startNewChat', 'Start a new chat to begin')}
                    </p>
                  </div>
                ) : (
                  <ConversationList
                    groups={unassignedGroups}
                    activeId={activeConversationId}
                    onSelect={handleSelectConversation}
                  />
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer - Archive toggle */}
        <div className="p-4 border-t border-slate-200 dark:border-navy-700">
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
