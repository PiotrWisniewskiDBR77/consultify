/**
 * MoveToProjectModal
 * 
 * Modal for moving a conversation to a chat project (folder).
 * Supports selecting existing projects or creating new ones inline.
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, FolderPlus, Folder, Check, Plus, FolderX, Loader2 } from 'lucide-react';
import { useChatProjectStore, ChatProject } from '../../store/useChatProjectStore';
import { Conversation } from '../../store/useConversationStore';

interface MoveToProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    conversation: Conversation | null;
    onSuccess?: () => void;
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

export const MoveToProjectModal: React.FC<MoveToProjectModalProps> = ({
    isOpen,
    onClose,
    conversation,
    onSuccess
}) => {
    const { t } = useTranslation();
    const { projects, fetchProjects, createProject, moveConversationToProject, isLoading } = useChatProjectStore();
    
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
    const [isCreatingNew, setIsCreatingNew] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');
    const [newProjectColor, setNewProjectColor] = useState(PROJECT_COLORS[0]);
    const [isMoving, setIsMoving] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchProjects();
            // Pre-select current project if conversation is already in one
            setSelectedProjectId(conversation?.chatProjectId || null);
        }
    }, [isOpen, conversation]);

    const handleMove = async () => {
        if (!conversation) return;
        
        setIsMoving(true);
        try {
            await moveConversationToProject(conversation.id, selectedProjectId);
            onSuccess?.();
            onClose();
        } catch (err) {
            console.error('[MoveToProject] Error:', err);
        } finally {
            setIsMoving(false);
        }
    };

    const handleCreateAndMove = async () => {
        if (!newProjectName.trim() || !conversation) return;
        
        setIsCreating(true);
        try {
            const newProject = await createProject({
                name: newProjectName.trim(),
                color: newProjectColor
            });
            await moveConversationToProject(conversation.id, newProject.id);
            onSuccess?.();
            onClose();
        } catch (err) {
            console.error('[MoveToProject] Create error:', err);
        } finally {
            setIsCreating(false);
            setIsCreatingNew(false);
            setNewProjectName('');
        }
    };

    const handleRemoveFromProject = async () => {
        if (!conversation || !conversation.chatProjectId) return;
        
        setIsMoving(true);
        try {
            await moveConversationToProject(conversation.id, null);
            onSuccess?.();
            onClose();
        } catch (err) {
            console.error('[MoveToProject] Remove error:', err);
        } finally {
            setIsMoving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="
                relative w-full max-w-md mx-4
                bg-white dark:bg-navy-900
                rounded-2xl shadow-2xl
                animate-in fade-in zoom-in-95 duration-200
                max-h-[80vh] flex flex-col
            ">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-navy-800">
                    <div className="flex items-center gap-2">
                        <FolderPlus size={20} className="text-primary-500" />
                        <h2 className="text-lg font-semibold text-navy-900 dark:text-white">
                            {t('aiChat.moveToProject.title', 'Przenieś do projektu')}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 overflow-y-auto flex-1">
                    {!conversation ? (
                        <p className="text-center text-slate-500 dark:text-slate-400 py-8">
                            {t('aiChat.moveToProject.noConversation', 'Nie wybrano rozmowy')}
                        </p>
                    ) : isCreatingNew ? (
                        /* Create new project form */
                        <div className="space-y-4">
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                {t('aiChat.moveToProject.createNew', 'Utwórz nowy projekt:')}
                            </p>
                            
                            {/* Project name input */}
                            <input
                                type="text"
                                value={newProjectName}
                                onChange={(e) => setNewProjectName(e.target.value)}
                                placeholder={t('aiChat.moveToProject.projectName', 'Nazwa projektu...')}
                                autoFocus
                                className="
                                    w-full px-4 py-3 rounded-xl
                                    bg-slate-50 dark:bg-navy-800
                                    border border-slate-200 dark:border-navy-700
                                    text-navy-900 dark:text-white
                                    placeholder:text-slate-400
                                    focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500
                                    transition-all
                                "
                            />
                            
                            {/* Color picker */}
                            <div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                                    {t('aiChat.moveToProject.selectColor', 'Kolor:')}
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {PROJECT_COLORS.map(color => (
                                        <button
                                            key={color}
                                            onClick={() => setNewProjectColor(color)}
                                            className={`
                                                w-8 h-8 rounded-full transition-all
                                                ${newProjectColor === color 
                                                    ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-navy-900 ring-slate-800 dark:ring-white scale-110' 
                                                    : 'hover:scale-105'
                                                }
                                            `}
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                </div>
                            </div>
                            
                            {/* Buttons */}
                            <div className="flex gap-2 pt-2">
                                <button
                                    onClick={() => {
                                        setIsCreatingNew(false);
                                        setNewProjectName('');
                                    }}
                                    className="
                                        flex-1 px-4 py-2.5 rounded-xl
                                        text-slate-600 dark:text-slate-300
                                        hover:bg-slate-100 dark:hover:bg-navy-800
                                        transition-colors
                                    "
                                >
                                    {t('common.cancel', 'Anuluj')}
                                </button>
                                <button
                                    onClick={handleCreateAndMove}
                                    disabled={!newProjectName.trim() || isCreating}
                                    className="
                                        flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                                        bg-primary-600 hover:bg-primary-500 text-white
                                        font-medium transition-all
                                        disabled:opacity-50 disabled:cursor-not-allowed
                                    "
                                >
                                    {isCreating ? (
                                        <Loader2 size={18} className="animate-spin" />
                                    ) : (
                                        <Plus size={18} />
                                    )}
                                    {t('aiChat.moveToProject.createAndMove', 'Utwórz i przenieś')}
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* Project list */
                        <div className="space-y-2">
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                                {t('aiChat.moveToProject.selectProject', 'Wybierz projekt lub utwórz nowy:')}
                            </p>

                            {/* Create new project button */}
                            <button
                                onClick={() => setIsCreatingNew(true)}
                                className="
                                    w-full flex items-center gap-3 p-3 rounded-xl
                                    border-2 border-dashed border-slate-200 dark:border-navy-700
                                    hover:border-primary-400 dark:hover:border-primary-600
                                    hover:bg-primary-50 dark:hover:bg-primary-900/10
                                    text-slate-600 dark:text-slate-300
                                    transition-all duration-200
                                "
                            >
                                <div className="p-2 rounded-lg bg-slate-100 dark:bg-navy-800">
                                    <Plus size={20} className="text-primary-500" />
                                </div>
                                <span className="font-medium">
                                    {t('aiChat.moveToProject.newProject', 'Nowy projekt')}
                                </span>
                            </button>

                            {/* Remove from project option */}
                            {conversation.chatProjectId && (
                                <button
                                    onClick={handleRemoveFromProject}
                                    className="
                                        w-full flex items-center gap-3 p-3 rounded-xl
                                        border-2 border-slate-200 dark:border-navy-700
                                        hover:border-red-300 dark:hover:border-red-600
                                        hover:bg-red-50 dark:hover:bg-red-900/10
                                        text-slate-600 dark:text-slate-300
                                        transition-all duration-200
                                    "
                                >
                                    <div className="p-2 rounded-lg bg-slate-100 dark:bg-navy-800">
                                        <FolderX size={20} className="text-red-500" />
                                    </div>
                                    <span className="font-medium text-red-600 dark:text-red-400">
                                        {t('aiChat.moveToProject.removeFromProject', 'Usuń z projektu')}
                                    </span>
                                </button>
                            )}

                            {/* Existing projects */}
                            {isLoading ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 size={24} className="animate-spin text-primary-500" />
                                </div>
                            ) : projects.length === 0 ? (
                                <div className="text-center py-8 text-slate-400">
                                    <Folder size={40} className="mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">
                                        {t('aiChat.moveToProject.noProjects', 'Nie masz jeszcze żadnych projektów')}
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2 mt-3">
                                    {projects.map(project => {
                                        const isSelected = selectedProjectId === project.id;
                                        const isCurrent = conversation.chatProjectId === project.id;

                                        return (
                                            <button
                                                key={project.id}
                                                onClick={() => setSelectedProjectId(project.id)}
                                                className={`
                                                    w-full flex items-center gap-3 p-3 rounded-xl
                                                    border-2 transition-all duration-200
                                                    ${isSelected
                                                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                                                        : 'border-slate-200 dark:border-navy-700 hover:border-slate-300 dark:hover:border-navy-600'
                                                    }
                                                `}
                                            >
                                                <div 
                                                    className="p-2 rounded-lg"
                                                    style={{ backgroundColor: `${project.color}20` }}
                                                >
                                                    <Folder size={20} style={{ color: project.color }} />
                                                </div>
                                                <div className="flex-1 text-left">
                                                    <p className={`font-medium ${isSelected ? 'text-primary-700 dark:text-primary-300' : 'text-navy-900 dark:text-white'}`}>
                                                        {project.name}
                                                    </p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                                        {project.conversationCount} {t('aiChat.moveToProject.conversations', 'rozmów')}
                                                        {isCurrent && (
                                                            <span className="ml-2 text-primary-500">
                                                                ({t('aiChat.moveToProject.current', 'obecny')})
                                                            </span>
                                                        )}
                                                    </p>
                                                </div>
                                                {isSelected && (
                                                    <Check size={20} className="text-primary-500" />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {conversation && !isCreatingNew && (
                    <div className="flex gap-3 p-4 border-t border-slate-200 dark:border-navy-800">
                        <button
                            onClick={onClose}
                            className="
                                flex-1 px-4 py-2.5 rounded-xl
                                text-slate-600 dark:text-slate-300
                                hover:bg-slate-100 dark:hover:bg-navy-800
                                transition-colors
                            "
                        >
                            {t('common.cancel', 'Anuluj')}
                        </button>
                        <button
                            onClick={handleMove}
                            disabled={isMoving || selectedProjectId === conversation.chatProjectId}
                            className="
                                flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                                bg-primary-600 hover:bg-primary-500 text-white
                                font-medium transition-all
                                disabled:opacity-50 disabled:cursor-not-allowed
                            "
                        >
                            {isMoving ? (
                                <Loader2 size={18} className="animate-spin" />
                            ) : (
                                <FolderPlus size={18} />
                            )}
                            {t('aiChat.moveToProject.move', 'Przenieś')}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MoveToProjectModal;







