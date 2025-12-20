/**
 * Help Panel Component
 * 
 * Slide-out panel showing available playbooks and contextual help.
 * 
 * Step 6: Enterprise+ Ready
 */

import React, { useState, useEffect } from 'react';
import { useHelp, Playbook, PlaybookStep } from '../contexts/HelpContext';
import { usePolicySnapshot } from '../contexts/AccessPolicyContext';
import { X, ChevronRight, CheckCircle, XCircle, BookOpen, Lightbulb, ArrowRight } from 'lucide-react';

interface HelpPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

const HelpPanel: React.FC<HelpPanelProps> = ({ isOpen, onClose }) => {
    const { playbooks, loading, logEvent, getPlaybook } = useHelp();
    const { snapshot } = usePolicySnapshot();
    const [selectedPlaybook, setSelectedPlaybook] = useState<Playbook | null>(null);
    const [currentStep, setCurrentStep] = useState(0);

    // Reset selection when panel closes
    useEffect(() => {
        if (!isOpen) {
            setSelectedPlaybook(null);
            setCurrentStep(0);
        }
    }, [isOpen]);

    const handlePlaybookClick = async (playbook: Playbook) => {
        await logEvent(playbook.key, 'VIEWED');
        const full = await getPlaybook(playbook.key);
        if (full) {
            setSelectedPlaybook(full);
            setCurrentStep(0);
            await logEvent(playbook.key, 'STARTED');
        }
    };

    const handleComplete = async () => {
        if (selectedPlaybook) {
            await logEvent(selectedPlaybook.key, 'COMPLETED');
            setSelectedPlaybook(null);
        }
    };

    const handleDismiss = async (playbook: Playbook) => {
        await logEvent(playbook.key, 'DISMISSED');
    };

    const handleNextStep = () => {
        if (selectedPlaybook?.steps && currentStep < selectedPlaybook.steps.length - 1) {
            setCurrentStep(prev => prev + 1);
        } else {
            handleComplete();
        }
    };

    const handlePrevStep = () => {
        if (currentStep > 0) {
            setCurrentStep(prev => prev - 1);
        }
    };

    if (!isOpen) return null;

    // Get context badge text
    const getOrgTypeBadge = () => {
        if (snapshot?.isDemo) return { text: 'Demo Mode', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' };
        if (snapshot?.isTrial) return { text: `Trial (${snapshot.trialDaysLeft}d left)`, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' };
        if (snapshot?.isPaid) return { text: 'Paid', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' };
        return null;
    };

    const orgBadge = getOrgTypeBadge();

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 z-40 transition-opacity"
                onClick={onClose}
            />

            {/* Panel */}
            <div className="fixed right-0 top-0 h-full w-96 bg-white dark:bg-gray-900 z-50 shadow-2xl transform transition-transform duration-300 ease-out flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                        <BookOpen className="w-5 h-5 text-blue-500" />
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Help & Training</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Context Badge */}
                {orgBadge && (
                    <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${orgBadge.color}`}>
                            {orgBadge.text}
                        </span>
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <div className="flex items-center justify-center h-32">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
                        </div>
                    ) : selectedPlaybook ? (
                        /* Playbook Detail View */
                        <div className="space-y-4">
                            <button
                                onClick={() => setSelectedPlaybook(null)}
                                className="text-sm text-blue-500 hover:underline flex items-center gap-1"
                            >
                                ← Back to playbooks
                            </button>

                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                {selectedPlaybook.title}
                            </h3>

                            {selectedPlaybook.steps && selectedPlaybook.steps.length > 0 && (
                                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                                    {/* Progress */}
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="text-xs text-gray-500">
                                            Step {currentStep + 1} of {selectedPlaybook.steps.length}
                                        </span>
                                        <div className="flex-1 h-1 bg-gray-200 dark:bg-gray-700 rounded-full">
                                            <div
                                                className="h-full bg-blue-500 rounded-full transition-all"
                                                style={{ width: `${((currentStep + 1) / selectedPlaybook.steps.length) * 100}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* Current Step */}
                                    <div className="space-y-3">
                                        <h4 className="font-medium text-gray-900 dark:text-white">
                                            {selectedPlaybook.steps[currentStep].title}
                                        </h4>
                                        <p className="text-sm text-gray-600 dark:text-gray-300">
                                            {selectedPlaybook.steps[currentStep].contentMd}
                                        </p>

                                        {/* Action Button */}
                                        {selectedPlaybook.steps[currentStep].actionType === 'CTA' && (
                                            <button className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium">
                                                {selectedPlaybook.steps[currentStep].actionPayload?.label || 'Take Action'}
                                            </button>
                                        )}
                                    </div>

                                    {/* Navigation */}
                                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                                        <button
                                            onClick={handlePrevStep}
                                            disabled={currentStep === 0}
                                            className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Previous
                                        </button>
                                        <button
                                            onClick={handleNextStep}
                                            className="flex items-center gap-1 text-sm text-blue-500 hover:text-blue-600 font-medium"
                                        >
                                            {currentStep === selectedPlaybook.steps.length - 1 ? 'Complete' : 'Next'}
                                            <ArrowRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* Playbook List View */
                        <div className="space-y-4">
                            {/* Recommended Section */}
                            {playbooks.filter(p => p.isRecommended && p.status === 'AVAILABLE').length > 0 && (
                                <div>
                                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1">
                                        <Lightbulb className="w-4 h-4" />
                                        Recommended for You
                                    </h3>
                                    <div className="space-y-2">
                                        {playbooks
                                            .filter(p => p.isRecommended && p.status === 'AVAILABLE')
                                            .map(playbook => (
                                                <PlaybookCard
                                                    key={playbook.id}
                                                    playbook={playbook}
                                                    onClick={() => handlePlaybookClick(playbook)}
                                                    onDismiss={() => handleDismiss(playbook)}
                                                />
                                            ))
                                        }
                                    </div>
                                </div>
                            )}

                            {/* All Available */}
                            {playbooks.filter(p => !p.isRecommended && p.status === 'AVAILABLE').length > 0 && (
                                <div>
                                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                                        More Help Topics
                                    </h3>
                                    <div className="space-y-2">
                                        {playbooks
                                            .filter(p => !p.isRecommended && p.status === 'AVAILABLE')
                                            .map(playbook => (
                                                <PlaybookCard
                                                    key={playbook.id}
                                                    playbook={playbook}
                                                    onClick={() => handlePlaybookClick(playbook)}
                                                    onDismiss={() => handleDismiss(playbook)}
                                                />
                                            ))
                                        }
                                    </div>
                                </div>
                            )}

                            {/* Completed */}
                            {playbooks.filter(p => p.status === 'COMPLETED').length > 0 && (
                                <div>
                                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                                        Completed
                                    </h3>
                                    <div className="space-y-2 opacity-60">
                                        {playbooks
                                            .filter(p => p.status === 'COMPLETED')
                                            .map(playbook => (
                                                <PlaybookCard
                                                    key={playbook.id}
                                                    playbook={playbook}
                                                    onClick={() => handlePlaybookClick(playbook)}
                                                    completed
                                                />
                                            ))
                                        }
                                    </div>
                                </div>
                            )}

                            {/* Empty State */}
                            {playbooks.length === 0 && (
                                <div className="text-center py-8">
                                    <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                    <p className="text-gray-500">No help topics available</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

// Playbook Card Component
interface PlaybookCardProps {
    playbook: Playbook;
    onClick: () => void;
    onDismiss?: () => void;
    completed?: boolean;
}

const PlaybookCard: React.FC<PlaybookCardProps> = ({ playbook, onClick, onDismiss, completed }) => {
    return (
        <div
            className={`group relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 hover:border-blue-300 dark:hover:border-blue-600 transition-colors cursor-pointer ${completed ? 'bg-gray-50 dark:bg-gray-800/50' : ''}`}
            onClick={onClick}
        >
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        {completed && <CheckCircle className="w-4 h-4 text-green-500" />}
                        <h4 className="font-medium text-gray-900 dark:text-white text-sm">
                            {playbook.title}
                        </h4>
                    </div>
                    {playbook.description && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                            {playbook.description}
                        </p>
                    )}
                    {playbook.recommendationReason && (
                        <p className="text-xs text-blue-500 mt-1">
                            {playbook.recommendationReason}
                        </p>
                    )}
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
            </div>

            {/* Dismiss button */}
            {onDismiss && !completed && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDismiss();
                    }}
                    className="absolute top-2 right-8 opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-all"
                    title="Dismiss"
                >
                    <XCircle className="w-4 h-4 text-gray-400 hover:text-red-500" />
                </button>
            )}
        </div>
    );
};

export default HelpPanel;
