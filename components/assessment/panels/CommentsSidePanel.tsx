/**
 * CommentsSidePanel
 * 
 * Slide-in panel wrapper for AxisCommentsPanel.
 * Shows threaded comments for a specific assessment axis.
 */

import React, { useEffect, useRef } from 'react';
import { X, MessageSquare } from 'lucide-react';
import { AxisCommentsPanel } from '../AxisCommentsPanel';

// DRD Axis labels
const AXIS_LABELS: Record<string, string> = {
    processes: 'Procesy',
    digitalProducts: 'Produkty Cyfrowe',
    businessModels: 'Modele Biznesowe',
    dataManagement: 'Zarządzanie Danymi',
    culture: 'Kultura',
    cybersecurity: 'Cyberbezpieczeństwo',
    aiMaturity: 'Dojrzałość AI'
};

interface CommentsSidePanelProps {
    assessmentId: string;
    axisId: string;
    isOpen: boolean;
    onClose: () => void;
    onCommentCountChange?: (count: number) => void;
    isReadOnly?: boolean;
}

export const CommentsSidePanel: React.FC<CommentsSidePanelProps> = ({
    assessmentId,
    axisId,
    isOpen,
    onClose,
    onCommentCountChange,
    isReadOnly = false
}) => {
    const panelRef = useRef<HTMLDivElement>(null);
    const axisLabel = AXIS_LABELS[axisId] || axisId;

    // Close on escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node) && isOpen) {
                onClose();
            }
        };

        // Delay adding listener to avoid immediate close
        const timer = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside);
        }, 100);

        return () => {
            clearTimeout(timer);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose]);

    // Prevent body scroll when panel is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div 
                className="fixed inset-0 bg-black/30 z-40 transition-opacity duration-300"
                style={{ opacity: isOpen ? 1 : 0 }}
            />

            {/* Panel */}
            <div
                ref={panelRef}
                className={`
                    fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-navy-900 
                    shadow-xl z-50 flex flex-col
                    transform transition-transform duration-300 ease-out
                    ${isOpen ? 'translate-x-0' : 'translate-x-full'}
                `}
            >
                {/* Header */}
                <div className="shrink-0 px-4 py-4 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-navy-950">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                                <MessageSquare className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div>
                                <h3 className="font-bold text-navy-900 dark:text-white">
                                    Komentarze
                                </h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    {axisLabel}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                            aria-label="Zamknij panel komentarzy"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Comments Content */}
                <div className="flex-1 overflow-hidden">
                    <AxisCommentsPanel
                        assessmentId={assessmentId}
                        axisId={axisId}
                        axisLabel={axisLabel}
                        isReadOnly={isReadOnly}
                        onCommentCountChange={onCommentCountChange}
                    />
                </div>
            </div>
        </>
    );
};

