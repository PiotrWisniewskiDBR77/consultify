/**
 * ProjectList
 * 
 * List of chat projects (folders) with create button.
 * Each project can be expanded to show its conversations.
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, FolderPlus, Loader2, Folder } from 'lucide-react';
import { useChatProjectStore, ChatProject } from '../../store/useChatProjectStore';
import { useConversationStore } from '../../store/useConversationStore';
import { ProjectItem } from './ProjectItem';

interface ProjectListProps {
    onSelectConversation: (id: string) => void;
    activeConversationId: string | null;
}

// Project color options
const PROJECT_COLORS = [
    '#6366f1', // Indigo
    '#8b5cf6', // Violet  
    '#ec4899', // Pink
    '#ef4444', // Red
    '#f97316', // Orange
    '#eab308', // Yellow
    '#22c55e', // Green
    '#14b8a6', // Teal
    '#06b6d4', // Cyan
    '#3b82f6', // Blue
];

export const ProjectList: React.FC<ProjectListProps> = ({
    onSelectConversation,
    activeConversationId
}) => {
    const { t } = useTranslation();
    const { 
        projects, 
        expandedProjectIds, 
        isLoading, 
        fetchProjects, 
        createProject, 
        toggleProjectExpanded 
    } = useChatProjectStore();
    
    const [isCreating, setIsCreating] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');
    const [newProjectColor, setNewProjectColor] = useState(PROJECT_COLORS[0]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        fetchProjects();
    }, []);

    const handleCreate = async () => {
        if (!newProjectName.trim()) return;

        setIsSubmitting(true);
        try {
            await createProject({
                name: newProjectName.trim(),
                color: newProjectColor
            });
            setIsCreating(false);
            setNewProjectName('');
            setNewProjectColor(PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)]);
        } catch (err) {
            console.error('[ProjectList] Create error:', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleCreate();
        } else if (e.key === 'Escape') {
            setIsCreating(false);
            setNewProjectName('');
        }
    };

    return (
        <div className="flex flex-col h-full">
            {/* Create New Project */}
            {isCreating ? (
                <div className="p-2 space-y-2 border-b border-slate-200 dark:border-navy-800">
                    <input
                        type="text"
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        onKeyDown={handleKeyDown}
                        autoFocus
                        placeholder={t('aiChat.project.namePlaceholder', 'Nazwa projektu...')}
                        className="
                            w-full px-3 py-2 rounded-lg text-sm
                            bg-slate-50 dark:bg-navy-800
                            border border-slate-200 dark:border-navy-700
                            text-navy-900 dark:text-white
                            placeholder:text-slate-400
                            focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500
                            transition-all
                        "
                    />
                    
                    {/* Color Picker */}
                    <div className="flex items-center gap-1.5">
                        {PROJECT_COLORS.map(color => (
                            <button
                                key={color}
                                onClick={() => setNewProjectColor(color)}
                                className={`
                                    w-5 h-5 rounded-full transition-all
                                    ${newProjectColor === color 
                                        ? 'ring-2 ring-offset-1 ring-offset-white dark:ring-offset-navy-900 ring-slate-600 dark:ring-white scale-110' 
                                        : 'hover:scale-105 opacity-70 hover:opacity-100'
                                    }
                                `}
                                style={{ backgroundColor: color }}
                            />
                        ))}
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => {
                                setIsCreating(false);
                                setNewProjectName('');
                            }}
                            className="
                                flex-1 px-3 py-1.5 rounded-lg text-sm
                                text-slate-600 dark:text-slate-300
                                hover:bg-slate-100 dark:hover:bg-navy-700
                                transition-colors
                            "
                        >
                            {t('common.cancel', 'Anuluj')}
                        </button>
                        <button
                            onClick={handleCreate}
                            disabled={!newProjectName.trim() || isSubmitting}
                            className="
                                flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-sm
                                bg-primary-600 hover:bg-primary-500 text-white
                                font-medium transition-all
                                disabled:opacity-50 disabled:cursor-not-allowed
                            "
                        >
                            {isSubmitting ? (
                                <Loader2 size={14} className="animate-spin" />
                            ) : (
                                <Plus size={14} />
                            )}
                            {t('common.create', 'Utwórz')}
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    onClick={() => setIsCreating(true)}
                    className="
                        flex items-center gap-2 m-2 px-3 py-2 rounded-lg
                        border-2 border-dashed border-slate-200 dark:border-navy-700
                        hover:border-primary-400 dark:hover:border-primary-600
                        hover:bg-primary-50 dark:hover:bg-primary-900/10
                        text-slate-500 dark:text-slate-400
                        hover:text-primary-600 dark:hover:text-primary-400
                        transition-all duration-200
                    "
                >
                    <FolderPlus size={16} />
                    <span className="text-sm font-medium">
                        {t('aiChat.project.create', 'Nowy projekt')}
                    </span>
                </button>
            )}

            {/* Projects List */}
            <div className="flex-1 overflow-y-auto px-1">
                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 size={24} className="animate-spin text-primary-500" />
                    </div>
                ) : projects.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 dark:text-slate-500">
                        <Folder size={40} className="mx-auto mb-2 opacity-50" />
                        <p className="text-sm">
                            {t('aiChat.project.noProjects', 'Brak projektów')}
                        </p>
                        <p className="text-xs mt-1">
                            {t('aiChat.project.noProjectsHint', 'Utwórz projekt, aby grupować rozmowy')}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-1 py-2">
                        {projects.map(project => (
                            <ProjectItem
                                key={project.id}
                                project={project}
                                isExpanded={expandedProjectIds.includes(project.id)}
                                onToggleExpand={() => toggleProjectExpanded(project.id)}
                                onSelectConversation={onSelectConversation}
                                activeConversationId={activeConversationId}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProjectList;







