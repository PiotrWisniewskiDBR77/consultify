/**
 * ChatHistorySidebar
 *
 * FLOATING overlay sidebar showing conversation history AND folders.
 * When closed, completely disappears except for a floating toggle button.
 *
 * Layout:
 * ┌────────────────────────┐
 * │ Header + New Chat      │
 * │ Search                 │
 * ├────────────────────────┤
 * │ MY FOLDERS (personal)  │
 * │ TEAM FOLDERS (shared)  │
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
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

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
import { CONVERSATION_DND_TYPE, ConversationItem } from './ConversationItem';
import { ConversationList } from './ConversationList';
import { ConversationSearch } from './ConversationSearch';

interface ChatHistorySidebarProps {
  projectId?: string;
  onNewChat: () => void;
  className?: string;
}

// ==================== FOLDER SECTION COMPONENT ====================

interface FolderSectionProps {
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
  /** C3.3: Called when user clicks the folder name to enter folder-scoped view */
  onFolderClick?: (folderId: string) => void;
  /** Whether the entire section is collapsed */
  sectionCollapsed?: boolean;
  /** Toggle section collapsed state */
  onToggleSectionCollapsed?: () => void;
  /** DnD: Called when a conversation is dropped onto a folder */
  onDropConversation?: (conversationId: string, folderId: string) => void;
}

/** Max folders visible before "Show more" is displayed */
const MAX_VISIBLE_FOLDERS = 4;

const FolderSection: React.FC<FolderSectionProps> = ({
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
  onFolderClick,
  sectionCollapsed = false,
  onToggleSectionCollapsed,
  onDropConversation,
}) => {
  const [showInput, setShowInput] = useState(false);
  const [name, setName] = useState('');
  const [menuId, setMenuId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const handleFolderDragOver = useCallback((e: React.DragEvent, folderId: string) => {
    if (e.dataTransfer.types.includes(CONVERSATION_DND_TYPE)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDropTargetId(folderId);
    }
  }, []);

  const handleFolderDragLeave = useCallback((e: React.DragEvent) => {
    const related = e.relatedTarget as Node | null;
    if (!e.currentTarget.contains(related)) {
      setDropTargetId(null);
    }
  }, []);

  const handleFolderDrop = useCallback(
    (e: React.DragEvent, folderId: string) => {
      e.preventDefault();
      setDropTargetId(null);
      const conversationId = e.dataTransfer.getData(CONVERSATION_DND_TYPE);
      if (conversationId && onDropConversation) {
        onDropConversation(conversationId, folderId);
      }
    },
    [onDropConversation]
  );

  const handleCreate = () => {
    if (!name.trim()) return;
    onCreateProject(name.trim());
    setName('');
    setShowInput(false);
  };

  const visibleProjects = showAll ? projects : projects.slice(0, MAX_VISIBLE_FOLDERS);
  const hasMore = projects.length > MAX_VISIBLE_FOLDERS;

  return (
    <div className="px-2.5 pb-1">
      <div
        className="flex items-center justify-between px-1 py-0.5 cursor-pointer group/section hover:bg-slate-50 dark:hover:bg-navy-800/50 rounded-md transition-colors"
        onClick={onToggleSectionCollapsed}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && onToggleSectionCollapsed) {
            e.preventDefault();
            onToggleSectionCollapsed();
          }
        }}
        aria-expanded={!sectionCollapsed}
      >
        <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
          <span className="shrink-0 text-slate-400 dark:text-slate-500 group-hover/section:text-slate-600 dark:group-hover/section:text-slate-300">
            {sectionCollapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
          </span>
          {icon}
          {title}
          {projects.length > 0 && (
            <span className="text-[9px] text-slate-300 dark:text-slate-600 font-normal tabular-nums">
              {projects.length}
            </span>
          )}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowInput(true);
          }}
          className="p-0.5 text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 rounded transition-colors"
          title={createButtonLabel}
        >
          <FolderPlus size={12} />
        </button>
      </div>

      {/* Section content — hidden when collapsed */}
      {!sectionCollapsed && (
        <>
          {/* New Folder Input */}
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
                placeholder={t('aiChat.folderName', 'Folder name...')}
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
            <div>
              {visibleProjects.map((project) => {
                const isExpanded = expandedProjectIds.includes(project.id);
                const projectConversations = getConversationsByProjectId(project.id);

                return (
                  <div key={project.id}>
                    <div
                      className={`group flex items-center gap-1.5 px-2 py-1 rounded-md cursor-pointer transition-colors ${
                        dropTargetId === project.id
                          ? 'bg-primary-100 dark:bg-primary-900/30 ring-1 ring-primary-400/50'
                          : 'hover:bg-slate-100 dark:hover:bg-navy-800'
                      }`}
                      onClick={() => onToggleExpanded(project.id)}
                      onDragOver={(e) => handleFolderDragOver(e, project.id)}
                      onDragLeave={handleFolderDragLeave}
                      onDrop={(e) => handleFolderDrop(e, project.id)}
                    >
                      <button
                        className="shrink-0 text-slate-400 dark:text-slate-500"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleExpanded(project.id);
                        }}
                      >
                        {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      </button>
                      <Folder size={13} className="shrink-0" style={{ color: project.color }} />
                      <span
                        className="flex-1 text-[13px] text-slate-700 dark:text-slate-300 truncate hover:text-primary-600 dark:hover:text-primary-400"
                        onClick={(e) => {
                          if (onFolderClick) {
                            e.stopPropagation();
                            onFolderClick(project.id);
                          }
                        }}
                        title={t('aiChat.openFolder', 'Open folder')}
                      >
                        {project.name}
                      </span>
                      <span className="text-[10px] tabular-nums text-slate-400 dark:text-slate-500">
                        {project.conversationCount}
                      </span>
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuId(menuId === project.id ? null : project.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300 rounded transition-all"
                        >
                          <MoreHorizontal size={13} />
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
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                            >
                              <Trash2 size={13} />
                              {t('common.delete', 'Delete')}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Folder Conversations */}
                    {isExpanded && projectConversations.length > 0 && (
                      <div className="ml-5">
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
                      <div className="ml-7 px-2 py-1 text-[11px] text-slate-400 dark:text-slate-500 italic">
                        {t('aiChat.noFolderConversations', 'No conversations in this folder')}
                      </div>
                    )}
                  </div>
                );
              })}

              {hasMore && (
                <button
                  onClick={() => setShowAll(!showAll)}
                  className="w-full flex items-center justify-center gap-1 px-2 py-1 text-[10px] font-medium text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800/50 rounded-md transition-colors"
                >
                  {showAll ? (
                    <>
                      <ChevronRight size={10} className="rotate-[-90deg]" />
                      {t('aiChat.showLess', 'Show less')}
                    </>
                  ) : (
                    <>
                      <ChevronDown size={10} />
                      {t('aiChat.showMore', 'Show more')} ({projects.length - MAX_VISIBLE_FOLDERS})
                    </>
                  )}
                </button>
              )}
            </div>
          ) : !showInput ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowInput(true);
              }}
              className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-[11px] text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 border border-dashed border-slate-300/60 dark:border-navy-700/60 rounded-md hover:border-slate-400 dark:hover:border-navy-600 transition-colors"
            >
              <FolderPlus size={12} />
              {emptyLabel}
            </button>
          ) : null}
        </>
      )}
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
  const navigate = useNavigate();

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
    createConversation,
    toggleSidebar,
    setSearchQuery,
    toggleShowArchived,
    clearActiveChat,
  } = useConversationStore();

  // Fully unmount when closed to avoid any invisible click-blocking strip on some layouts/breakpoints.
  const [shouldRenderSidebar, setShouldRenderSidebar] = useState(isSidebarOpen);
  useEffect(() => {
    if (isSidebarOpen) {
      setShouldRenderSidebar(true);
      return;
    }

    // Fallback for environments where transitionend may not fire (e.g. reduced motion / zero-duration).
    const t = window.setTimeout(() => setShouldRenderSidebar(false), 350);
    return () => window.clearTimeout(t);
  }, [isSidebarOpen]);

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
    moveConversationToProject,
  } = useChatProjectStore();

  // Section collapse state for My Folders / Team Folders
  const [myFoldersCollapsed, setMyFoldersCollapsed] = useState(false);
  const [teamFoldersCollapsed, setTeamFoldersCollapsed] = useState(false);

  // C3.3: Active folder filter — clicking a folder name filters to that folder's conversations
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const activeFolder = activeFolderId
    ? projects.find((p) => p.id === activeFolderId) || null
    : null;

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

  // Server-side search state
  const { serverSearch } = useConversationStore();
  const [serverResults, setServerResults] = useState<Conversation[] | null>(null);
  const [serverSearchLoading, setServerSearchLoading] = useState(false);
  const [searchPartial, setSearchPartial] = useState(false);
  const [searchScopeBlocked, setSearchScopeBlocked] = useState(0);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Trigger server-side search when query is >= 3 chars (debounced)
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    if (!searchQuery || searchQuery.length < 3) {
      setServerResults(null);
      setSearchPartial(false);
      setSearchScopeBlocked(0);
      return;
    }

    setServerSearchLoading(true);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const result = (await serverSearch({ q: searchQuery, limit: 30 })) as any;
        setServerResults(result.conversations);
        setSearchPartial(Boolean(result?.partial));
        setSearchScopeBlocked(Number(result?.scopeBlocked || 0));
      } catch {
        setServerResults(null);
        setSearchPartial(true);
        setSearchScopeBlocked(0);
      } finally {
        setServerSearchLoading(false);
      }
    }, 400);

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery, serverSearch]);

  // Filter conversations based on search (client-side for short queries, server-side for longer)
  const filteredConversations = searchQuery
    ? serverResults !== null
      ? serverResults
      : conversations.filter(
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

  // C3.3: Folder-scoped conversations (when a folder is active)
  const folderConversations = activeFolderId ? getConversationsByProjectId(activeFolderId) : [];
  const folderGroups = activeFolderId ? groupConversations(folderConversations) : null;

  // C3.4: Handle new chat — if a folder is active, create conversation in that folder's context
  const handleNewChat = async () => {
    clearActiveChat();
    if (activeFolderId) {
      try {
        const conv = await createConversation({ chatProjectId: activeFolderId });
        if (conv?.id) {
          setActiveConversation(conv.id);
          return;
        }
      } catch (e) {
        console.error('[ChatHistorySidebar] Failed to create conversation in folder context:', e);
      }
    }
    onNewChat();
  };

  // Handle select conversation
  const handleSelectConversation = useCallback(
    (id: string) => {
      navigate(`/chat/${id}`, { replace: false });
      setActiveConversation(id);
      if (window.innerWidth < 1024) toggleSidebar();
    },
    [navigate, setActiveConversation, toggleSidebar]
  );

  // Handle create folder with scope
  const handleCreatePersonalProject = useCallback(
    async (name: string) => {
      try {
        await createProject({ name, scope: 'personal' });
      } catch (err) {
        console.error('[ChatHistorySidebar] Failed to create personal folder:', err);
      }
    },
    [createProject]
  );

  const handleCreateTeamProject = useCallback(
    async (name: string) => {
      try {
        await createProject({ name, scope: 'team' });
      } catch (err) {
        console.error('[ChatHistorySidebar] Failed to create team folder:', err);
      }
    },
    [createProject]
  );

  // Handle delete folder
  // chat-history fix 2026-04-18 (feedback #407a17df): require confirm + surface
  // server error to user instead of silently swallowing (regression).
  const handleDeleteProject = useCallback(
    async (id: string) => {
      const folder = projects.find((p) => p.id === id);
      const count = folder?.conversationCount ?? 0;
      const name = folder?.name || t('aiChat.folder', 'folder');
      const msg =
        count > 0
          ? t(
              'aiChat.confirmDeleteFolderWithConvs',
              `Delete folder "${name}"? The ${count} conversation(s) inside will NOT be deleted, just detached from this folder.`
            )
          : t('aiChat.confirmDeleteFolder', `Delete folder "${name}"?`);
      if (!window.confirm(msg)) return;
      try {
        await deleteProject(id);
      } catch (err: any) {
        console.error('[ChatHistorySidebar] Failed to delete folder:', err);
        window.alert(
          err?.message ||
            t('aiChat.deleteFolderFailed', 'Could not delete folder. Please try again.')
        );
      }
    },
    [deleteProject, projects, t]
  );

  // DnD: move conversation to a folder
  const handleDropToFolder = useCallback(
    async (conversationId: string, folderId: string) => {
      try {
        await moveConversationToProject(conversationId, folderId);
      } catch (err) {
        console.error('[ChatHistorySidebar] DnD move to folder failed:', err);
      }
    },
    [moveConversationToProject]
  );

  // DnD: remove conversation from folder (drop onto unassigned area)
  const [isUnassignedDropTarget, setIsUnassignedDropTarget] = useState(false);

  const handleUnassignedDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes(CONVERSATION_DND_TYPE)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setIsUnassignedDropTarget(true);
    }
  }, []);

  const handleUnassignedDragLeave = useCallback((e: React.DragEvent) => {
    const related = e.relatedTarget as Node | null;
    if (!e.currentTarget.contains(related)) {
      setIsUnassignedDropTarget(false);
    }
  }, []);

  const handleUnassignedDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsUnassignedDropTarget(false);
      const conversationId = e.dataTransfer.getData(CONVERSATION_DND_TYPE);
      if (conversationId) {
        try {
          await moveConversationToProject(conversationId, null);
        } catch (err) {
          console.error('[ChatHistorySidebar] DnD remove from folder failed:', err);
        }
      }
    },
    [moveConversationToProject]
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
      {shouldRenderSidebar && (
        <div
          data-testid="chat-history-sidebar"
          onTransitionEnd={(e) => {
            if (e.currentTarget !== e.target) return;
            if (!isSidebarOpen) setShouldRenderSidebar(false);
          }}
          className={`
                fixed top-0 h-full z-40
                bg-slate-50 dark:bg-navy-900
                border-r border-slate-200 dark:border-navy-800
                shadow-2xl
                flex flex-col
                transition-all duration-300 ease-in-out
                left-0 w-80
                ${
                  isSidebarOpen
                    ? isSidebarCollapsed
                      ? 'translate-x-0 lg:translate-x-16 pointer-events-auto'
                      : 'translate-x-0 lg:translate-x-64 pointer-events-auto'
                    : '-translate-x-full pointer-events-none'
                }
                ${className}
            `}
        >
          {/* Header */}
          <div className="px-3 pt-3 pb-2">
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={toggleSidebar}
                data-testid="chat-history-close"
                className="p-1 text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-md transition-colors"
                title={t('aiChat.closeSidebar', 'Close sidebar')}
              >
                <X size={16} />
              </button>
              <div className="flex-1" />
            </div>
            <button
              onClick={handleNewChat}
              data-testid="chat-history-new-chat"
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-500 text-white rounded-xl font-medium text-sm transition-colors shadow-sm hover:shadow-md"
            >
              {t('aiChat.newChat', 'Nowy czat')}
            </button>
          </div>

          {/* Search — compact */}
          <div className="px-3 py-2">
            <ConversationSearch
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder={t('aiChat.searchPlaceholder', 'Search conversations...')}
            />
          </div>

          {/* Folder breadcrumb */}
          {activeFolderId && activeFolder && (
            <div className="px-3 py-1.5 border-b border-slate-200/60 dark:border-navy-700/60 flex items-center gap-1.5">
              <button
                onClick={() => setActiveFolderId(null)}
                className="text-[11px] text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                {t('aiChat.allConversations', 'All')}
              </button>
              <ChevronRight size={10} className="text-slate-300 dark:text-slate-600" />
              <div className="flex items-center gap-1 text-[11px] font-medium text-slate-700 dark:text-slate-300">
                <Folder size={11} style={{ color: activeFolder.color }} />
                <span className="truncate">{activeFolder.name}</span>
              </div>
            </div>
          )}

          {/* Main scrollable area: Folders + Conversations — bounded scroll container (C3.1) */}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : activeFolderId && folderGroups ? (
              /* C3.3: Folder-scoped view — show only this folder's conversations */
              folderConversations.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-slate-100 dark:bg-navy-800 flex items-center justify-center">
                    <Folder size={20} className="text-slate-400 dark:text-slate-500" />
                  </div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                    {t('aiChat.noFolderConversations', 'No conversations in this folder')}
                  </p>
                </div>
              ) : (
                <div className="px-3">
                  <ConversationList
                    groups={folderGroups}
                    activeId={activeConversationId}
                    onSelect={handleSelectConversation}
                  />
                </div>
              )
            ) : searchQuery ? (
              /* Search mode: show flat grouped results (server-side when available) */
              serverSearchLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                  <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">
                    {t('aiChat.searching', 'Searching...')}
                  </span>
                </div>
              ) : visibleGroups.length === 0 && !searchPartial ? (
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
                  {/* Degraded posture: partial results indicator (§2.3.5 E2/E8) */}
                  {searchPartial && (
                    <div className="mb-2 px-2.5 py-1.5 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-700/40">
                      <p className="text-[11px] text-amber-700 dark:text-amber-400">
                        {t('aiChat.partialResults', 'Results may be incomplete. Try again later.')}
                      </p>
                    </div>
                  )}
                  {/* E7: Scope-blocked results indicator */}
                  {searchScopeBlocked > 0 && (
                    <div className="mb-2 px-2.5 py-1.5 rounded-md bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/40">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {t(
                          'aiChat.scopeBlocked',
                          '{{count}} result(s) hidden due to access restrictions.',
                          { count: searchScopeBlocked }
                        )}
                      </p>
                    </div>
                  )}
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
                {/* Chat Folders (Primary Navigation) */}
                <div className="pb-1">
                  {/* My Folders (Personal) */}
                  <FolderSection
                    title={t('aiChat.myFolders', 'My Folders')}
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
                    onFolderClick={setActiveFolderId}
                    sectionCollapsed={myFoldersCollapsed}
                    onToggleSectionCollapsed={() => setMyFoldersCollapsed((v) => !v)}
                    onDropConversation={handleDropToFolder}
                  />

                  {/* Team Folders (Shared) */}
                  <FolderSection
                    title={t('aiChat.teamFolders', 'Team Folders')}
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
                    onFolderClick={setActiveFolderId}
                    sectionCollapsed={teamFoldersCollapsed}
                    onToggleSectionCollapsed={() => setTeamFoldersCollapsed((v) => !v)}
                    onDropConversation={handleDropToFolder}
                  />
                </div>

                {/* Separator between folders and unassigned conversations */}
                {(personalProjects.length > 0 || teamProjects.length > 0) &&
                  unassignedConversations.length > 0 && (
                    <div className="border-t border-slate-200 dark:border-navy-700 mx-3" />
                  )}

                {/* Unassigned Conversations — also a drop zone to remove from folder */}
                <div
                  className={`px-3 min-h-[40px] transition-colors ${
                    isUnassignedDropTarget
                      ? 'bg-slate-100/80 dark:bg-navy-800/60 ring-1 ring-inset ring-slate-300/50 dark:ring-navy-600/50 rounded-lg mx-1'
                      : ''
                  }`}
                  onDragOver={handleUnassignedDragOver}
                  onDragLeave={handleUnassignedDragLeave}
                  onDrop={handleUnassignedDrop}
                >
                  {unassignedConversations.length === 0 &&
                  personalProjects.length === 0 &&
                  teamProjects.length === 0 ? (
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
          <div className="px-3 py-2 border-t border-slate-200/60 dark:border-navy-700/60">
            <button
              onClick={toggleShowArchived}
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-[13px] rounded-lg transition-colors ${
                showArchived
                  ? 'bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-navy-800'
              }`}
            >
              <Archive size={14} />
              {t('aiChat.sections.archived', 'Archived')}
              {displayGroups.archived.length > 0 && (
                <span className="ml-auto text-[10px] tabular-nums bg-slate-200 dark:bg-navy-700 px-1.5 py-0.5 rounded-full">
                  {displayGroups.archived.length}
                </span>
              )}
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatHistorySidebar;
