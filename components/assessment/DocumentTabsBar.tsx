/**
 * DocumentTabsBar
 * 
 * A tab bar component for managing opened documents (reports, initiatives).
 * Features:
 * - Multiple tabs for opened documents
 * - Tab close button (X)
 * - Active tab highlighting
 * - Compact design that doesn't block other UI elements
 * - Scroll support for many tabs
 */

import React from 'react';
import { X, FileText, Lightbulb, Plus } from 'lucide-react';

export type DocumentType = 'report' | 'initiative';

export interface OpenDocument {
    id: string;
    type: DocumentType;
    name: string;
    status?: string;
    isDirty?: boolean;
}

interface DocumentTabsBarProps {
    openDocuments: OpenDocument[];
    activeDocumentId: string | null;
    onSelectDocument: (id: string) => void;
    onCloseDocument: (id: string) => void;
    onCloseAll?: () => void;
    showListButton?: boolean;
    onShowList?: () => void;
}

export const DocumentTabsBar: React.FC<DocumentTabsBarProps> = ({
    openDocuments,
    activeDocumentId,
    onSelectDocument,
    onCloseDocument,
    onCloseAll,
    showListButton = true,
    onShowList
}) => {
    if (openDocuments.length === 0) {
        return null;
    }

    const getIcon = (type: DocumentType) => {
        switch (type) {
            case 'report':
                return <FileText size={14} />;
            case 'initiative':
                return <Lightbulb size={14} />;
            default:
                return <FileText size={14} />;
        }
    };

    const getTypeColor = (type: DocumentType, isActive: boolean) => {
        if (isActive) {
            return type === 'report' 
                ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30' 
                : 'border-amber-500 bg-amber-50 dark:bg-amber-900/30';
        }
        return 'border-transparent bg-slate-100 dark:bg-navy-800 hover:bg-slate-200 dark:hover:bg-navy-700';
    };

    const getIconColor = (type: DocumentType, isActive: boolean) => {
        if (isActive) {
            return type === 'report'
                ? 'text-purple-600 dark:text-purple-400'
                : 'text-amber-600 dark:text-amber-400';
        }
        return 'text-slate-500 dark:text-slate-400';
    };

    return (
        <div className="shrink-0 bg-white dark:bg-navy-900 border-b border-slate-200 dark:border-white/10 px-4 py-1.5">
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
                {/* List button - return to table view */}
                {showListButton && onShowList && (
                    <button
                        onClick={onShowList}
                        className={`
                            flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all
                            border-2 border-dashed border-slate-300 dark:border-slate-600
                            text-slate-500 dark:text-slate-400
                            hover:border-slate-400 dark:hover:border-slate-500
                            hover:bg-slate-50 dark:hover:bg-navy-800
                            shrink-0 mr-2
                        `}
                        title="Pokaż listę"
                    >
                        <Plus size={14} className="rotate-45" />
                        Lista
                    </button>
                )}

                {/* Document tabs */}
                {openDocuments.map((doc) => {
                    const isActive = doc.id === activeDocumentId;
                    
                    return (
                        <div
                            key={doc.id}
                            className={`
                                group flex items-center gap-2 px-3 py-1.5 rounded-md transition-all
                                border-b-2 cursor-pointer shrink-0 max-w-[200px]
                                ${getTypeColor(doc.type, isActive)}
                            `}
                            onClick={() => onSelectDocument(doc.id)}
                        >
                            <span className={getIconColor(doc.type, isActive)}>
                                {getIcon(doc.type)}
                            </span>
                            <span 
                                className={`
                                    text-xs font-medium truncate
                                    ${isActive 
                                        ? 'text-navy-900 dark:text-white' 
                                        : 'text-slate-600 dark:text-slate-300'
                                    }
                                `}
                                title={doc.name}
                            >
                                {doc.name}
                                {doc.isDirty && <span className="text-amber-500 ml-1">•</span>}
                            </span>
                            
                            {/* Close button */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onCloseDocument(doc.id);
                                }}
                                className={`
                                    p-0.5 rounded hover:bg-slate-200 dark:hover:bg-white/10
                                    opacity-0 group-hover:opacity-100 transition-opacity
                                    ${isActive ? 'opacity-100' : ''}
                                `}
                                title="Zamknij"
                            >
                                <X size={12} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" />
                            </button>
                        </div>
                    );
                })}

                {/* Close all button */}
                {openDocuments.length > 1 && onCloseAll && (
                    <button
                        onClick={onCloseAll}
                        className="ml-2 px-2 py-1 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded transition-colors shrink-0"
                        title="Zamknij wszystkie"
                    >
                        Zamknij wszystkie
                    </button>
                )}
            </div>
        </div>
    );
};

