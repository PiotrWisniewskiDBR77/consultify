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
  FolderInput,
  FolderPlus,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
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
import { EmptyState } from '../ui/composed/EmptyState';
import { LoadingState } from '../ui/primitives';
import { requiresOrganizationVisibilityConsent } from './chatHistoryVisibility';
import { CONVERSATION_DND_TYPE, ConversationItem } from './ConversationItem';
import { ConversationList } from './ConversationList';
import { ConversationSearch } from './ConversationSearch';
import { ProjectMembersModal } from './ProjectMembersModal';
import { useChatProjectsRealtime } from './useChatProjectsRealtime';

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
  /** Rename / recolor / re-parent a folder (F1 + F4c). */
  onUpdateProject?: (
    id: string,
    updates: { name?: string; color?: string; parentId?: string | null }
  ) => void;
  /** F2 — manage members of a team folder (only passed for the team section). */
  onManageMembers?: (project: ChatProject) => void;
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

/** Quick folder color palette (F1). Crimson-first, on brand. */
const FOLDER_COLORS = [
  '#85182F',
  '#A82D49',
  '#2563EB',
  '#059669',
  '#D97706',
  '#7C3AED',
  '#0891B2',
  '#64748B',
];

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
  onUpdateProject,
  onManageMembers,
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [movePickerId, setMovePickerId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  // F4c: descendants of a folder (to exclude as move targets — no loops).
  const descendantsOf = (rootId: string): Set<string> => {
    const out = new Set<string>();
    const stack = [rootId];
    while (stack.length) {
      const cur = stack.pop() as string;
      for (const p of projects) {
        if (p.parentId === cur && !out.has(p.id)) {
          out.add(p.id);
          stack.push(p.id);
        }
      }
    }
    return out;
  };

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

  // F4c: nested folders — render the flat list as a tree (pre-order, descending
  // only into expanded folders), each row carrying its depth for indentation.
  const idSet = new Set(projects.map((p) => p.id));
  const childrenOf = (pid: string | null) =>
    projects.filter((p) => {
      const par = p.parentId && idSet.has(p.parentId) ? p.parentId : null;
      return par === pid;
    });
  const roots = childrenOf(null);
  const visibleRoots = showAll ? roots : roots.slice(0, MAX_VISIBLE_FOLDERS);
  const orderedFolders: Array<{ project: ChatProject; depth: number }> = [];
  const walkFolders = (list: ChatProject[], depth: number) => {
    for (const p of list) {
      orderedFolders.push({ project: p, depth });
      if (expandedProjectIds.includes(p.id)) walkFolders(childrenOf(p.id), depth + 1);
    }
  };
  walkFolders(visibleRoots, 0);
  const hasMore = roots.length > MAX_VISIBLE_FOLDERS;

  return (
    <div className="px-2.5 pb-1">
      <div
        className="flex items-center justify-between px-1 py-0.5 cursor-pointer group/section hover:bg-c-surface-raised rounded-md transition-colors"
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
        <span className="text-[10px] font-semibold text-c-text-muted uppercase tracking-wider flex items-center gap-1.5">
          <span className="shrink-0 text-c-text-muted group-hover/section:text-c-text-secondary">
            {sectionCollapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
          </span>
          {icon}
          {title}
          {projects.length > 0 && (
            <span className="text-[9px] text-c-text-secondary font-normal tabular-nums">
              {projects.length}
            </span>
          )}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowInput(true);
          }}
          className="p-0.5 text-c-text-secondary hover:text-c-text hover:bg-c-surface-raised rounded transition-colors"
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
                className="flex-1 px-2 py-1.5 text-sm rounded-lg bg-c-surface-raised border border-c-border-subtle text-c-text placeholder:text-c-text-muted focus:outline-none focus:ring-2 focus:ring-c-focus"
                autoFocus
              />
              <button
                onClick={handleCreate}
                disabled={!name.trim()}
                className="px-2 py-1.5 text-sm bg-c-text text-c-bg hover:opacity-90 disabled:bg-c-border disabled:text-c-text-muted rounded-lg transition-colors"
              >
                {t('common.add', 'Add')}
              </button>
            </div>
          )}

          {/* Project List */}
          {projects.length > 0 ? (
            <div>
              {orderedFolders.map(({ project, depth }) => {
                const isExpanded = expandedProjectIds.includes(project.id);
                const projectConversations = getConversationsByProjectId(project.id);

                return (
                  <div key={project.id}>
                    <div
                      style={{ paddingLeft: 8 + depth * 12 }}
                      className={`group flex items-center gap-1.5 pr-2 py-1 rounded-md cursor-pointer transition-colors ${
                        dropTargetId === project.id
                          ? 'bg-primary-100 dark:bg-primary-900/30 ring-1 ring-primary-400/50'
                          : 'hover:bg-c-surface-raised'
                      }`}
                      onClick={() => onToggleExpanded(project.id)}
                      onDragOver={(e) => handleFolderDragOver(e, project.id)}
                      onDragLeave={handleFolderDragLeave}
                      onDrop={(e) => handleFolderDrop(e, project.id)}
                    >
                      <button
                        className="shrink-0 text-c-text-muted"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleExpanded(project.id);
                        }}
                      >
                        {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      </button>
                      <Folder size={13} className="shrink-0" style={{ color: project.color }} />
                      {editingId === project.id ? (
                        <input
                          autoFocus
                          value={renameDraft}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setRenameDraft(e.target.value)}
                          onBlur={() => {
                            const v = renameDraft.trim();
                            if (v && v !== project.name) onUpdateProject?.(project.id, { name: v });
                            setEditingId(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const v = renameDraft.trim();
                              if (v && v !== project.name)
                                onUpdateProject?.(project.id, { name: v });
                              setEditingId(null);
                            }
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          className="flex-1 min-w-0 bg-c-surface border border-c-focus-solid rounded px-1.5 py-0.5 text-[13px] text-c-text outline-none"
                        />
                      ) : (
                        <span
                          className="flex-1 text-[13px] text-c-text-secondary truncate hover:text-primary-600 dark:hover:text-primary-400"
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
                      )}
                      <span className="text-[10px] tabular-nums text-c-text-muted">
                        {project.conversationCount}
                      </span>
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuId(menuId === project.id ? null : project.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 text-c-text-muted hover:text-c-text rounded transition-all"
                        >
                          <MoreHorizontal size={13} />
                        </button>

                        {/* Project Menu */}
                        {menuId === project.id && (
                          <div className="absolute right-0 top-full mt-1 z-50 w-40 bg-c-surface rounded-lg shadow-lg border border-slate-200/60 dark:border-white/[0.03] py-1">
                            {onUpdateProject && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingId(project.id);
                                  setRenameDraft(project.name);
                                  setMenuId(null);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-c-text-secondary hover:bg-c-surface-raised hover:text-c-text"
                              >
                                <Pencil size={13} />
                                {t('aiChat.actions.rename', 'Rename')}
                              </button>
                            )}
                            {onUpdateProject && (
                              <div className="px-3 py-1.5">
                                <div className="text-[10px] uppercase tracking-wider text-c-text-muted mb-1">
                                  {t('aiChat.folderColor', 'Color')}
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {FOLDER_COLORS.map((c) => (
                                    <button
                                      key={c}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onUpdateProject(project.id, { color: c });
                                        setMenuId(null);
                                      }}
                                      className={`w-4 h-4 rounded-full border transition-transform hover:scale-110 ${
                                        project.color === c ? 'border-c-text' : 'border-transparent'
                                      }`}
                                      style={{ backgroundColor: c }}
                                      title={c}
                                      aria-label={c}
                                    />
                                  ))}
                                </div>
                              </div>
                            )}
                            {onManageMembers && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onManageMembers(project);
                                  setMenuId(null);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-c-text-secondary hover:bg-c-surface-raised hover:text-c-text"
                              >
                                <Users size={13} />
                                {t('aiChat.members.manage', 'Members & sharing')}
                              </button>
                            )}
                            {/* F4c: move into another folder */}
                            {onUpdateProject && (
                              <div className="px-3 py-1.5">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMovePickerId(
                                      movePickerId === project.id ? null : project.id
                                    );
                                  }}
                                  className="w-full flex items-center gap-2 text-sm text-c-text-secondary"
                                >
                                  <FolderInput size={13} />
                                  {t('aiChat.moveToFolderShort', 'Move to folder')}
                                </button>
                                {movePickerId === project.id && (
                                  <div className="mt-1 max-h-40 overflow-y-auto rounded-md border border-c-border-subtle">
                                    {project.parentId && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onUpdateProject(project.id, { parentId: null });
                                          setMovePickerId(null);
                                          setMenuId(null);
                                        }}
                                        className="w-full text-left px-2 py-1 text-[12px] text-c-text-secondary hover:bg-c-surface-raised"
                                      >
                                        {t('aiChat.moveToTopLevel', '↥ Top level')}
                                      </button>
                                    )}
                                    {(() => {
                                      const excluded = descendantsOf(project.id);
                                      const targets = projects.filter(
                                        (p) =>
                                          p.id !== project.id &&
                                          p.scope === project.scope &&
                                          !excluded.has(p.id) &&
                                          p.id !== project.parentId
                                      );
                                      if (targets.length === 0) {
                                        return (
                                          <div className="px-2 py-1 text-[11px] text-c-text-muted italic">
                                            {t('aiChat.noTargetFolders', 'No other folders')}
                                          </div>
                                        );
                                      }
                                      return targets.map((tp) => (
                                        <button
                                          key={tp.id}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onUpdateProject(project.id, { parentId: tp.id });
                                            setMovePickerId(null);
                                            setMenuId(null);
                                          }}
                                          className="w-full flex items-center gap-1.5 text-left px-2 py-1 text-[12px] text-c-text-secondary hover:bg-c-surface-raised hover:text-c-text"
                                        >
                                          <Folder size={11} style={{ color: tp.color }} />
                                          <span className="truncate">{tp.name}</span>
                                        </button>
                                      ));
                                    })()}
                                  </div>
                                )}
                              </div>
                            )}
                            <div className="my-1 border-t border-c-border-subtle" />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteProject(project.id);
                                setMenuId(null);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-900/20"
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
                      <div className="ml-7 px-2 py-1 text-[11px] text-c-text-muted italic">
                        {t('aiChat.noFolderConversations', 'No conversations in this folder')}
                      </div>
                    )}
                  </div>
                );
              })}

              {hasMore && (
                <button
                  onClick={() => setShowAll(!showAll)}
                  className="w-full flex items-center justify-center gap-1 px-2 py-1 text-[10px] font-medium text-c-text-muted hover:text-c-text hover:bg-c-surface-raised rounded-md transition-colors"
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
              className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-[11px] text-c-text-muted hover:text-c-text border border-dashed border-c-border-subtle rounded-md hover:border-c-border-strong transition-colors"
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
    bulkOperation,
  } = useConversationStore();

  // Bulk-select (F1)
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  // Team-project members modal (F2)
  const [membersModalProject, setMembersModalProject] = useState<ChatProject | null>(null);

  // F4b: live-refresh the sidebar when a teammate changes a shared folder.
  const currentUser = useAppStore((s) => s.currentUser);
  const realtimeRefetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleRealtimeChanged = useCallback(() => {
    if (realtimeRefetchTimer.current) clearTimeout(realtimeRefetchTimer.current);
    realtimeRefetchTimer.current = setTimeout(() => {
      // Read fetchers from the stores at call time (avoids closure-ordering on the
      // destructured values, which are declared lower in this component).
      void useChatProjectStore.getState().fetchProjects({ force: true });
      void useConversationStore.getState().fetchConversations();
    }, 400);
  }, []);
  useChatProjectsRealtime(
    (currentUser as any)?.organizationId,
    (currentUser as any)?.id,
    handleRealtimeChanged
  );

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  const runBulk = useCallback(
    async (action: 'archive' | 'delete') => {
      const ids = Array.from(selectedIds);
      if (ids.length === 0) return;
      if (action === 'delete' && !window.confirm(`Delete ${ids.length} conversation(s)?`)) return;
      setBulkBusy(true);
      try {
        await bulkOperation(ids, action);
        exitSelectMode();
      } catch (err) {
        console.error('[ChatHistorySidebar] Bulk operation failed:', err);
      } finally {
        setBulkBusy(false);
      }
    },
    [selectedIds, bulkOperation, exitSelectMode]
  );

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
    updateProject,
    toggleProjectExpanded,
    getConversationsByProjectId,
    getPersonalProjects,
    getTeamProjects,
    moveConversationToProject,
  } = useChatProjectStore();

  // Section collapse state for My Folders / Team Folders
  const [myFoldersCollapsed, setMyFoldersCollapsed] = useState(false);
  const [teamFoldersCollapsed, setTeamFoldersCollapsed] = useState(false);
  const historyPreferenceKey = `consultify-chat-history:${String((currentUser as any)?.id || 'anonymous')}:${String((currentUser as any)?.organizationId || 'personal')}`;

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(historyPreferenceKey) || '{}');
      setMyFoldersCollapsed(saved.myFoldersCollapsed === true);
      setTeamFoldersCollapsed(saved.teamFoldersCollapsed === true);
    } catch {
      setMyFoldersCollapsed(false);
      setTeamFoldersCollapsed(false);
    }
  }, [historyPreferenceKey]);

  const togglePersistedSection = useCallback(
    (section: 'personal' | 'team') => {
      const nextMy = section === 'personal' ? !myFoldersCollapsed : myFoldersCollapsed;
      const nextTeam = section === 'team' ? !teamFoldersCollapsed : teamFoldersCollapsed;
      setMyFoldersCollapsed(nextMy);
      setTeamFoldersCollapsed(nextTeam);
      try {
        window.localStorage.setItem(
          historyPreferenceKey,
          JSON.stringify({ myFoldersCollapsed: nextMy, teamFoldersCollapsed: nextTeam })
        );
      } catch {
        // Storage can be unavailable in privacy-restricted browser contexts.
      }
    },
    [historyPreferenceKey, myFoldersCollapsed, teamFoldersCollapsed]
  );

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
  const [searchScopeLimited, setSearchScopeLimited] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runServerSearch = useCallback(
    async (query: string) => {
      setServerSearchLoading(true);
      try {
        const result = (await serverSearch({ q: query, limit: 30 })) as any;
        if (result?.failed) {
          // Distinct from "no matches": the search did not run at all, so
          // showing an empty list as the answer would be a false negative
          // ("Results may be incomplete" over nothing — M01-P02 §3.6).
          setServerResults(null);
          setSearchFailed(true);
          setSearchPartial(false);
          setSearchScopeLimited(false);
          return;
        }
        setServerResults(result.conversations);
        setSearchFailed(false);
        setSearchPartial(Boolean(result?.partial));
        setSearchScopeLimited(Boolean(result?.scopeLimited));
      } catch {
        setServerResults(null);
        setSearchFailed(true);
        setSearchPartial(false);
        setSearchScopeLimited(false);
      } finally {
        setServerSearchLoading(false);
      }
    },
    [serverSearch]
  );

  // Trigger server-side search when query is >= 3 chars (debounced)
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    if (!searchQuery || searchQuery.length < 3) {
      setServerResults(null);
      setSearchFailed(false);
      setSearchPartial(false);
      setSearchScopeLimited(false);
      return;
    }

    searchDebounceRef.current = setTimeout(() => {
      void runServerSearch(searchQuery);
    }, 400);

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery, runServerSearch]);

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
      // Opening a search hit jumps to the message that matched, not just the
      // conversation (GF-CHAT-05 deep link). ConversationRouteSync/the chat
      // panel consumes `m` and scrolls to that message anchor.
      const matchedMessageId = serverResults?.find((c) => c.id === id)?.matchedMessageId;
      const target = matchedMessageId
        ? `/chat/${id}?m=${encodeURIComponent(matchedMessageId)}`
        : `/chat/${id}`;
      navigate(target, { replace: false });
      setActiveConversation(id);
      if (window.innerWidth < 1024) toggleSidebar();
    },
    [navigate, setActiveConversation, toggleSidebar, serverResults]
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

  // F1: rename / recolor a folder (surfaces the existing PATCH /chat-projects/:id).
  const handleUpdateProject = useCallback(
    (id: string, updates: { name?: string; color?: string }) => {
      void updateProject(id, updates).catch((err: any) => {
        console.error('[ChatHistorySidebar] Failed to update folder:', err);
      });
    },
    [updateProject]
  );

  // DnD: move conversation to a folder
  const handleDropToFolder = useCallback(
    async (conversationId: string, folderId: string) => {
      const destination = projects.find((project) => project.id === folderId);
      const conversation = conversations.find((item) => item.id === conversationId);
      const source = conversation?.chatProjectId
        ? projects.find((project) => project.id === conversation.chatProjectId)
        : null;
      const broadensVisibility = requiresOrganizationVisibilityConsent(
        destination?.scope,
        source?.scope
      );
      if (
        broadensVisibility &&
        !window.confirm(
          t(
            'aiChat.confirmMovePrivateToOrganization',
            'Move this private conversation to an organization folder? Organization members with access to the folder will be able to see it.'
          )
        )
      ) {
        return;
      }
      try {
        const result = await moveConversationToProject(conversationId, folderId, {
          visibilityConsent: broadensVisibility,
        });
        if (result.visibilityReceiptId) {
          toast.success(
            `${t('aiChat.visibilityConsentRecorded', 'Organization visibility recorded. Receipt')}: ${result.visibilityReceiptId}`,
            { duration: 8000 }
          );
        }
      } catch (err) {
        console.error('[ChatHistorySidebar] DnD move to folder failed:', err);
      }
    },
    [conversations, moveConversationToProject, projects, t]
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
          id="chat-history-panel"
          role="complementary"
          aria-label={t('aiChat.history', 'Chat history')}
          aria-hidden={!isSidebarOpen}
          inert={!isSidebarOpen}
          data-testid="chat-history-sidebar"
          onTransitionEnd={(e) => {
            if (e.currentTarget !== e.target) return;
            if (!isSidebarOpen) setShouldRenderSidebar(false);
          }}
          className={`
                fixed top-0 h-full z-dropdown
                bg-c-bg
                border-r border-c-border-subtle
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
                className="p-1 text-c-text-secondary hover:text-c-text hover:bg-c-surface-raised rounded-md transition-colors"
                title={t('aiChat.closeSidebar', 'Close sidebar')}
              >
                <X size={16} />
              </button>
              <div className="flex-1" />
            </div>
            <button
              onClick={handleNewChat}
              data-testid="chat-history-new-chat"
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-c-text text-c-bg hover:opacity-90 rounded-xl font-medium text-sm transition-colors shadow-sm hover:shadow-md"
            >
              {t('aiChat.newChat', 'Nowy czat')}
            </button>

            {/* Bulk-select toolbar (F1) */}
            {!selectMode ? (
              <button
                onClick={() => setSelectMode(true)}
                className="mt-2 w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-[11px] font-medium text-c-text-muted hover:text-c-text hover:bg-c-surface-raised rounded-lg transition-colors"
              >
                {t('aiChat.bulk.select', 'Select')}
              </button>
            ) : (
              <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-c-surface-raised px-2 py-1.5">
                <span className="text-[11px] font-medium text-c-text-secondary tabular-nums">
                  {String(
                    t('aiChat.bulk.selected', '{{count}} selected', {
                      count: selectedIds.size,
                    } as any)
                  )}
                </span>
                <div className="flex-1" />
                <button
                  onClick={() => void runBulk('archive')}
                  disabled={bulkBusy || selectedIds.size === 0}
                  title={t('aiChat.actions.archive', 'Archive')}
                  className="p-1 rounded text-c-text-secondary hover:bg-c-border-subtle disabled:opacity-40"
                >
                  <Archive size={14} />
                </button>
                <button
                  onClick={() => void runBulk('delete')}
                  disabled={bulkBusy || selectedIds.size === 0}
                  title={t('common.delete', 'Delete')}
                  className="p-1 rounded text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-900/20 disabled:opacity-40"
                >
                  <Trash2 size={14} />
                </button>
                <button
                  onClick={exitSelectMode}
                  title={t('common.cancel', 'Cancel')}
                  className="p-1 rounded text-c-text-secondary hover:bg-c-border-subtle"
                >
                  <X size={14} />
                </button>
              </div>
            )}
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
            <div className="px-3 py-1.5 border-b border-c-border-subtle flex items-center gap-1.5">
              <button
                onClick={() => setActiveFolderId(null)}
                className="text-[11px] text-c-text-muted hover:text-c-text transition-colors"
              >
                {t('aiChat.allConversations', 'All')}
              </button>
              <ChevronRight size={10} className="text-c-text-secondary" />
              <div className="flex items-center gap-1 text-[11px] font-medium text-c-text-secondary">
                <Folder size={11} style={{ color: activeFolder.color }} />
                <span className="truncate">{activeFolder.name}</span>
              </div>
            </div>
          )}

          {/* Main scrollable area: Folders + Conversations — bounded scroll container (C3.1) */}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            {isLoading ? (
              <LoadingState variant="spinner" className="py-8" />
            ) : activeFolderId && folderGroups ? (
              /* C3.3: Folder-scoped view — show only this folder's conversations */
              folderConversations.length === 0 ? (
                <EmptyState
                  compact
                  icon={<Folder />}
                  title={t('aiChat.noFolderConversations', 'No conversations in this folder')}
                  description=""
                />
              ) : (
                <div className="px-3">
                  <ConversationList
                    groups={folderGroups}
                    activeId={activeConversationId}
                    onSelect={handleSelectConversation}
                    selectMode={selectMode}
                    selectedIds={selectedIds}
                    onToggleSelect={toggleSelect}
                  />
                </div>
              )
            ) : searchQuery ? (
              /* Search mode: show flat grouped results (server-side when available) */
              serverSearchLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                  <span className="ml-2 text-xs text-c-text-muted">
                    {t('aiChat.searching', 'Searching...')}
                  </span>
                </div>
              ) : searchFailed ? (
                /* The search itself failed (network/4xx/5xx). Never fall
                   through to "no results", which would assert there are no
                   matches when in fact we do not know (M01-P02 §3.6). */
                <div
                  className="mx-3 my-2 px-3 py-2.5 rounded-md bg-c-surface-raised border border-c-border"
                  role="status"
                  aria-live="polite"
                  data-testid="chat-search-error"
                >
                  <p className="text-[11px] text-c-text">
                    {t('aiChat.searchFailed', 'Search is unavailable right now.')}
                  </p>
                  <button
                    type="button"
                    data-testid="chat-search-retry"
                    onClick={() => void runServerSearch(searchQuery)}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-c-border px-2 py-1 text-[11px] text-c-text hover:bg-c-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                  >
                    <RefreshCw size={11} />
                    {t('aiChat.searchRetry', 'Try again')}
                  </button>
                </div>
              ) : visibleGroups.length === 0 && !searchPartial && !searchScopeLimited ? (
                <EmptyState
                  compact
                  icon={<Search />}
                  title={t('aiChat.noResults', 'No conversations found')}
                  description=""
                />
              ) : (
                <div className="px-3">
                  {/* Degraded posture: throttled, genuinely-partial results (§2.3.5 E2/E8) */}
                  {searchPartial && (
                    <div className="mb-2 px-2.5 py-1.5 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-700/40">
                      <p className="text-[11px] text-amber-700 dark:text-amber-400">
                        {t('aiChat.partialResults', 'Results may be incomplete. Try again later.')}
                      </p>
                    </div>
                  )}
                  {/* Some matches were withheld by access rules (§2.3.3 P34 /
                      GF-CHAT-08). Deliberately not a count: the number itself
                      would describe conversations the viewer is not allowed
                      to see, and this is shown even when zero results are
                      visible, since we cannot assert "no matches" while
                      results may be withheld. */}
                  {searchScopeLimited && (
                    <div className="mb-2 px-2.5 py-1.5 rounded-md bg-c-surface-raised border border-c-border-subtle">
                      <p className="text-[11px] text-c-text-muted">
                        {t(
                          'aiChat.scopeLimited',
                          'Some results are hidden by access restrictions.'
                        )}
                      </p>
                    </div>
                  )}
                  <ConversationList
                    groups={displayGroups}
                    activeId={activeConversationId}
                    onSelect={handleSelectConversation}
                    selectMode={selectMode}
                    selectedIds={selectedIds}
                    onToggleSelect={toggleSelect}
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
                    onUpdateProject={handleUpdateProject}
                    onCreateProject={handleCreatePersonalProject}
                    createButtonLabel={t('aiChat.newPersonalFolder', 'New personal folder')}
                    emptyLabel={t('aiChat.createFolder', 'Create folder')}
                    t={t}
                    onFolderClick={setActiveFolderId}
                    sectionCollapsed={myFoldersCollapsed}
                    onToggleSectionCollapsed={() => togglePersistedSection('personal')}
                    onDropConversation={handleDropToFolder}
                  />

                  {/* Organization Folders (Shared) — Consultify has no sub-team
                      concept below the org, so 'team' scope is labeled
                      Organization for the user (#11-extend, mirrors #11 fix
                      in NotebookLibraryContent). Underlying scope value
                      ('team'), API and store fields are unchanged. */}
                  <FolderSection
                    title={t('aiChat.teamFolders', 'Organization Folders')}
                    icon={<Users size={11} />}
                    projects={teamProjects}
                    expandedProjectIds={expandedProjectIds}
                    activeConversationId={activeConversationId}
                    getConversationsByProjectId={getConversationsByProjectId}
                    onToggleExpanded={toggleProjectExpanded}
                    onSelectConversation={handleSelectConversation}
                    onDeleteProject={handleDeleteProject}
                    onUpdateProject={handleUpdateProject}
                    onManageMembers={setMembersModalProject}
                    onCreateProject={handleCreateTeamProject}
                    createButtonLabel={t('aiChat.newTeamFolder', 'New organization folder')}
                    emptyLabel={t('aiChat.createTeamFolder', 'Create organization folder')}
                    t={t}
                    onFolderClick={setActiveFolderId}
                    sectionCollapsed={teamFoldersCollapsed}
                    onToggleSectionCollapsed={() => togglePersistedSection('team')}
                    onDropConversation={handleDropToFolder}
                  />
                </div>

                {/* Separator between folders and unassigned conversations */}
                {(personalProjects.length > 0 || teamProjects.length > 0) &&
                  unassignedConversations.length > 0 && (
                    <div className="border-t border-c-border-subtle mx-3" />
                  )}

                {/* Unassigned Conversations — also a drop zone to remove from folder */}
                <div
                  className={`px-3 min-h-[40px] transition-colors ${
                    isUnassignedDropTarget
                      ? 'bg-c-surface-raised ring-1 ring-inset ring-c-border-strong rounded-lg mx-1'
                      : ''
                  }`}
                  onDragOver={handleUnassignedDragOver}
                  onDragLeave={handleUnassignedDragLeave}
                  onDrop={handleUnassignedDrop}
                >
                  {unassignedConversations.length === 0 &&
                  personalProjects.length === 0 &&
                  teamProjects.length === 0 ? (
                    <EmptyState
                      compact
                      icon={<Search />}
                      title={t('aiChat.noConversations', 'No conversations yet')}
                      description={t('aiChat.startNewChat', 'Start a new chat to begin')}
                    />
                  ) : (
                    <ConversationList
                      groups={unassignedGroups}
                      activeId={activeConversationId}
                      onSelect={handleSelectConversation}
                      selectMode={selectMode}
                      selectedIds={selectedIds}
                      onToggleSelect={toggleSelect}
                    />
                  )}
                </div>
              </>
            )}
          </div>

          {/* Footer - Archive toggle */}
          <div className="px-3 py-2 border-t border-c-border-subtle">
            <button
              onClick={toggleShowArchived}
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-[13px] rounded-lg transition-colors ${
                showArchived
                  ? 'bg-c-surface-raised text-c-text-secondary'
                  : 'text-c-text-muted hover:bg-c-surface-raised'
              }`}
            >
              <Archive size={14} />
              {t('aiChat.sections.archived', 'Archived')}
              {displayGroups.archived.length > 0 && (
                <span className="ml-auto text-[10px] tabular-nums bg-c-surface-raised px-1.5 py-0.5 rounded-full">
                  {displayGroups.archived.length}
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* F2: team-project members & sharing */}
      {membersModalProject && (
        <ProjectMembersModal
          isOpen={!!membersModalProject}
          onClose={() => setMembersModalProject(null)}
          projectId={membersModalProject.id}
          projectName={membersModalProject.name}
        />
      )}
    </>
  );
};

export default ChatHistorySidebar;
