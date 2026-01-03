/**
 * ProjectItem
 * 
 * Single project row with expand/collapse and actions.
 * Displays a folder that can be expanded to show conversations inside.
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
    Folder, FolderOpen, ChevronRight, ChevronDown, 
    MoreHorizontal, Edit2, Trash2, Loader2 
} from 'lucide-react';
import { ChatProject, useChatProjectStore } from '../../store/useChatProjectStore';
import { Conversation, useConversationStore } from '../../store/useConversationStore';
import { ConversationItem } from './ConversationItem';
import { Api } from '../../services/api';

interface ProjectItemProps {
    project: ChatProject;
    isExpanded: boolean;
    onToggleExpand: () => void;
    onSelectConversation: (id: string) => void;
    activeConversationId: string | null;
}

export const ProjectItem: React.FC<ProjectItemProps> = ({
    project,
    isExpanded,
    onToggleExpand,
    onSelectConversation,
    activeConversationId
}) => {
    const { t } = useTranslation();
    const { updateProject, deleteProject } = useChatProjectStore();
    const [showActions, setShowActions] = useState(false);
    const [isRenaming, setIsRenaming] = useState(false);
    const [newName, setNewName] = useState(project.name);
    const [isDeleting, setIsDeleting] = useState(false);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [isLoadingConversations, setIsLoadingConversations] = useState(false);

    // Load conversations when expanded
    useEffect(() => {
        if (isExpanded && conversations.length === 0) {
            loadConversations();
        }
    }, [isExpanded]);

    const loadConversations = async () => {
        setIsLoadingConversations(true);
        try {
            const result = await Api.getChatProject(project.id);
            setConversations(result.conversations?.map(mapApiConversation) || []);
        } catch (err) {
            console.error('[ProjectItem] Load conversations error:', err);
        } finally {
            setIsLoadingConversations(false);
        }
    };

    const handleRename = async () => {
        if (!newName.trim() || newName === project.name) {
            setIsRenaming(false);
            setNewName(project.name);
            return;
        }

        try {
            await updateProject(project.id, { name: newName.trim() });
            setIsRenaming(false);
        } catch (err) {
            console.error('[ProjectItem] Rename error:', err);
            setNewName(project.name);
        }
    };

    const handleDelete = async () => {
        if (!confirm(t('aiChat.project.deleteConfirm', 'Czy na pewno chcesz usunąć ten projekt? Rozmowy nie zostaną usunięte, tylko przeniesione poza projekt.'))) {
            return;
        }

        setIsDeleting(true);
        try {
            await deleteProject(project.id);
        } catch (err) {
            console.error('[ProjectItem] Delete error:', err);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleRename();
        } else if (e.key === 'Escape') {
            setIsRenaming(false);
            setNewName(project.name);
        }
    };

    return (
        <div className="select-none">
            {/* Project Header */}
            <div
                className={`
                    group flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-all
                    hover:bg-slate-100 dark:hover:bg-navy-800
                `}
                onMouseEnter={() => setShowActions(true)}
                onMouseLeave={() => setShowActions(false)}
                onClick={onToggleExpand}
            >
                {/* Expand/Collapse Arrow */}
                <div className="shrink-0 text-slate-400 dark:text-slate-500">
                    {isExpanded ? (
                        <ChevronDown size={14} />
                    ) : (
                        <ChevronRight size={14} />
                    )}
                </div>

                {/* Folder Icon */}
                <div 
                    className="shrink-0 p-1 rounded"
                    style={{ backgroundColor: `${project.color}15` }}
                >
                    {isExpanded ? (
                        <FolderOpen size={16} style={{ color: project.color }} />
                    ) : (
                        <Folder size={16} style={{ color: project.color }} />
                    )}
                </div>

                {/* Name / Rename Input */}
                {isRenaming ? (
                    <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onBlur={handleRename}
                        onKeyDown={handleKeyDown}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                        className="
                            flex-1 px-2 py-0.5 rounded text-sm
                            bg-white dark:bg-navy-900
                            border border-primary-500
                            text-navy-900 dark:text-white
                            focus:outline-none focus:ring-1 focus:ring-primary-500
                        "
                    />
                ) : (
                    <span className="flex-1 text-sm font-medium text-navy-900 dark:text-white truncate">
                        {project.name}
                    </span>
                )}

                {/* Conversation Count Badge */}
                <span className="text-xs text-slate-400 dark:text-slate-500 tabular-nums">
                    {project.conversationCount}
                </span>

                {/* Actions */}
                {showActions && !isRenaming && (
                    <div 
                        className="flex items-center gap-0.5"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={() => {
                                setNewName(project.name);
                                setIsRenaming(true);
                            }}
                            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-navy-700 rounded transition-colors"
                            title={t('aiChat.project.rename', 'Zmień nazwę')}
                        >
                            <Edit2 size={14} />
                        </button>
                        <button
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
                            title={t('aiChat.project.delete', 'Usuń projekt')}
                        >
                            {isDeleting ? (
                                <Loader2 size={14} className="animate-spin" />
                            ) : (
                                <Trash2 size={14} />
                            )}
                        </button>
                    </div>
                )}
            </div>

            {/* Expanded Conversations */}
            {isExpanded && (
                <div className="ml-4 pl-2 border-l-2 border-slate-200 dark:border-navy-700 mt-1">
                    {isLoadingConversations ? (
                        <div className="flex items-center justify-center py-4">
                            <Loader2 size={16} className="animate-spin text-primary-500" />
                        </div>
                    ) : conversations.length === 0 ? (
                        <p className="text-xs text-slate-400 dark:text-slate-500 py-2 px-2">
                            {t('aiChat.project.empty', 'Brak rozmów w tym projekcie')}
                        </p>
                    ) : (
                        <div className="space-y-0.5 py-1">
                            {conversations.map(conv => (
                                <ConversationItem
                                    key={conv.id}
                                    conversation={conv}
                                    isActive={conv.id === activeConversationId}
                                    onSelect={() => onSelectConversation(conv.id)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// API Mapper (same as conversation store)
function mapApiConversation(api: any): Conversation {
    return {
        id: api.id,
        title: api.title,
        titleSource: api.title_source || 'auto',
        projectId: api.project_id,
        chatProjectId: api.chat_project_id || null,
        organizationId: api.organization_id,
        starred: api.starred || false,
        archived: api.archived || false,
        tags: api.tags ? (typeof api.tags === 'string' ? JSON.parse(api.tags) : api.tags) : [],
        pmoContext: api.pmo_context,
        messageCount: api.message_count || 0,
        lastMessagePreview: api.last_message_preview,
        lastMessageAt: api.last_message_at ? new Date(api.last_message_at) : undefined,
        createdAt: new Date(api.created_at),
        updatedAt: new Date(api.updated_at)
    };
}

export default ProjectItem;





